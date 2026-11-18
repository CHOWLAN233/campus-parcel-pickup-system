import { createHmac, randomBytes } from 'node:crypto';
import { ApiError } from '../errors.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CANCELLATION_NOTICE_MS = 24 * 60 * 60 * 1000;
const BUSINESS_OFFSET_MS = 8 * 3600000;

export function businessDate(timestamp) {
  return new Date(timestamp + BUSINESS_OFFSET_MS).toISOString().slice(0, 10);
}

export function dateInWindow(date, now, config) {
  const today = Date.parse(`${businessDate(now)}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  const offset = (target - today) / 86400000;
  return offset >= config.bookingStartOffsetDays && offset < config.bookingStartOffsetDays + config.bookingDays;
}

export function slotView(slot) {
  const remaining = slot.capacity - slot.occupied;
  return {
    id: slot.id,
    startAt: new Date(slot.start_at).toISOString(),
    endAt: new Date(slot.end_at).toISOString(),
    capacity: slot.capacity,
    occupied: slot.occupied,
    remaining,
    status: slot.status === 'CLOSED' ? 'CLOSED' : remaining === 0 ? 'FULL' : 'AVAILABLE',
  };
}

export function appointmentView(row, now = Date.now()) {
  const cancelBefore = row.start_at - CANCELLATION_NOTICE_MS;
  return {
    id: row.id,
    slotId: row.slot_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    status: row.status,
    canCancel: row.status === 'BOOKED' && now <= cancelBefore,
    cancelBefore: new Date(cancelBefore).toISOString(),
    proxyCount: row.occupied_capacity - 1,
    occupiedCapacity: row.occupied_capacity,
    ...(row.helper_student_id ? { helperStudentId: row.helper_student_id } : {}),
  };
}

export function writeAudit(db, actorId, action, targetType, targetId, now, reason = null) {
  db.prepare(`INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, created_at, reason)
    VALUES (?, ?, ?, ?, ?, ?)`).run(actorId, action, targetType, targetId, now, reason);
}

export function sweepNoShows(db, now = Date.now()) {
  db.transaction(() => {
    const missed = db.prepare(`SELECT a.id FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
      WHERE a.status = 'BOOKED' AND s.end_at <= ?`).all(now);
    for (const { id } of missed) {
      db.prepare("UPDATE appointments SET status = 'NO_SHOW', updated_at = ? WHERE id = ?").run(now, id);
      db.prepare("INSERT INTO no_show_records(appointment_id, recorded_at) VALUES (?, ?)").run(id, now);
      db.prepare(`UPDATE pickup_authorizations SET status = 'EXPIRED'
        WHERE bound_appointment_id = ? AND status = 'RESERVED'`).run(id);
      writeAudit(db, null, 'NO_SHOW_RECORDED', 'appointment', id, now);
    }
  }).immediate();
}

export function createBookingService(db, config) {
  const codeHash = (code) => createHmac('sha256', config.sessionSecret).update(code).digest('hex');
  const getAppointment = db.prepare(`
    SELECT a.*, s.start_at, s.end_at, owner.student_id, u.student_id AS helper_student_id,
      pa.status AS authorization_status
    FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
    JOIN users owner ON owner.id = a.user_id
    LEFT JOIN appointment_helpers h ON h.appointment_id = a.id
    LEFT JOIN pickup_authorizations pa ON pa.id = h.authorization_id
    LEFT JOIN users u ON u.id = pa.issuer_user_id
    WHERE a.id = ?`);

  const createAppointment = db.transaction((userId, slotId, invitationCode) => {
    const now = Date.now();
    const slot = db.prepare('SELECT * FROM pickup_slots WHERE id = ?').get(slotId);
    if (!slot || slot.start_at <= now || slot.status !== 'AVAILABLE' || !dateInWindow(businessDate(slot.start_at), now, config)) {
      throw new ApiError(409, 'SLOT_FULL', 'Slot is not available.');
    }
    const hasFutureBooking = db.prepare(`SELECT 1 FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
      LEFT JOIN appointment_helpers h ON h.appointment_id = a.id
      WHERE (a.user_id = ? OR h.helper_user_id = ?) AND a.status = 'BOOKED' AND s.start_at > ? LIMIT 1`);
    if (hasFutureBooking.get(userId, userId, now)) {
      throw new ApiError(409, 'BOOKING_EXISTS', 'An active booking already exists.');
    }

    let authorization;
    if (invitationCode) {
      authorization = db.prepare('SELECT * FROM pickup_authorizations WHERE code_hash = ?').get(codeHash(invitationCode));
      if (!authorization || authorization.issuer_user_id === userId) throw new ApiError(409, 'INVALID_INVITATION', 'Invalid invitation.');
      if (authorization.status === 'EXPIRED') throw new ApiError(409, 'INVITATION_EXPIRED', 'Invitation has expired.');
      if (authorization.status !== 'ACTIVE') throw new ApiError(409, 'INVITATION_USED', 'Invitation is unavailable.');
      if (authorization.expires_at <= now) throw new ApiError(409, 'INVITATION_EXPIRED', 'Invitation has expired.');
      if (hasFutureBooking.get(authorization.issuer_user_id, authorization.issuer_user_id, now)) {
        throw new ApiError(409, 'INVITATION_BOOKING_CONFLICT', 'The invitation owner already has a future booking.');
      }
    }
    const units = authorization ? 2 : 1;
    const updated = db.prepare(`UPDATE pickup_slots SET occupied = occupied + ?
      WHERE id = ? AND status = 'AVAILABLE' AND occupied + ? <= capacity`).run(units, slotId, units);
    if (updated.changes !== 1) throw new ApiError(409, 'SLOT_FULL', 'Not enough available spaces.');
    const result = db.prepare(`INSERT INTO appointments(user_id, slot_id, status, occupied_capacity, created_at, updated_at)
      VALUES (?, ?, 'BOOKED', ?, ?, ?)`).run(userId, slotId, units, now, now);
    const appointmentId = Number(result.lastInsertRowid);
    if (authorization) {
      const reserved = db.prepare(`UPDATE pickup_authorizations SET status = 'RESERVED', bound_appointment_id = ?
        WHERE id = ? AND status = 'ACTIVE' AND expires_at > ?`).run(appointmentId, authorization.id, now);
      if (reserved.changes !== 1) throw new ApiError(409, 'INVITATION_USED', 'Invitation is unavailable.');
      db.prepare('INSERT INTO appointment_helpers(appointment_id, authorization_id, helper_user_id) VALUES (?, ?, ?)')
        .run(appointmentId, authorization.id, authorization.issuer_user_id);
    }
    return appointmentView(getAppointment.get(appointmentId));
  });

  const cancelAppointment = db.transaction((userId, appointmentId) => {
    const now = Date.now();
    const appointment = getAppointment.get(appointmentId);
    if (!appointment || appointment.user_id !== userId) {
      throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
    }
    if (appointment.status === 'CANCELLED') return appointmentView(appointment, now);
    if (appointment.status !== 'BOOKED' || now > appointment.start_at - CANCELLATION_NOTICE_MS) {
      throw new ApiError(409, 'CANCEL_NOT_ALLOWED', 'This booking can no longer be cancelled.');
    }

    db.prepare("UPDATE appointments SET status = 'CANCELLED', updated_at = ? WHERE id = ?")
      .run(now, appointmentId);
    db.prepare('UPDATE pickup_slots SET occupied = occupied - ? WHERE id = ?')
      .run(appointment.occupied_capacity, appointment.slot_id);
    if (appointment.occupied_capacity === 2) {
      const released = db.prepare(`UPDATE pickup_authorizations
        SET status = CASE WHEN expires_at > ? THEN 'ACTIVE' ELSE 'EXPIRED' END,
            bound_appointment_id = NULL
        WHERE bound_appointment_id = ? AND status = 'RESERVED'`).run(now, appointmentId);
      if (released.changes !== 1) throw new Error('Missing reserved invitation for proxy booking');
      db.prepare('DELETE FROM appointment_helpers WHERE appointment_id = ?').run(appointmentId);
    }
    writeAudit(db, userId, 'APPOINTMENT_CANCELLED', 'appointment', appointmentId, now);
    return appointmentView(getAppointment.get(appointmentId), now);
  });

  const issueAuthorization = db.transaction((userId) => {
    const now = Date.now();
    db.prepare(`UPDATE pickup_authorizations SET status = 'EXPIRED'
      WHERE issuer_user_id = ? AND status = 'ACTIVE' AND expires_at <= ?`).run(userId, now);
    const active = db.prepare(`SELECT 1 FROM pickup_authorizations
      WHERE issuer_user_id = ? AND status IN ('ACTIVE', 'RESERVED') LIMIT 1`).get(userId);
    if (active) throw new ApiError(409, 'INVITATION_EXISTS', 'An invitation already exists.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = [...randomBytes(8)].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
      const hash = codeHash(code);
      if (db.prepare('SELECT 1 FROM pickup_authorizations WHERE code_hash = ?').get(hash)) continue;
      const result = db.prepare(`INSERT INTO pickup_authorizations
        (issuer_user_id, code_hash, status, issued_at, expires_at) VALUES (?, ?, 'ACTIVE', ?, ?)`)
        .run(userId, hash, now, now + 3600000);
      return { id: Number(result.lastInsertRowid), invitationCode: code,
        expiresAt: new Date(now + 3600000).toISOString(), status: 'ACTIVE' };
    }
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Could not issue invitation.');
  });

  function getStaffAppointment(id) {
    const row = getAppointment.get(id);
    if (!row) throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
    const now = Date.now();
    return {
      ...appointmentView(row, now),
      canComplete: row.status === 'BOOKED' && now >= row.start_at && now < row.end_at,
      studentId: row.student_id,
      authorizationStatus: row.authorization_status,
      authorizationValid: row.occupied_capacity === 1 || row.authorization_status === 'RESERVED',
    };
  }

  const completeAppointment = db.transaction((actorId, id, correctionReason) => {
    const now = Date.now();
    const row = getAppointment.get(id);
    if (!row) throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
    if (!correctionReason && row.status === 'COMPLETED') return getStaffAppointment(id);
    const correcting = Boolean(correctionReason);
    const canComplete = row.status === 'BOOKED' && now >= row.start_at && now < row.end_at;
    if (correcting ? row.status !== 'NO_SHOW' : !canComplete) {
      throw new ApiError(409, 'HANDOVER_NOT_ALLOWED', 'Handover is unavailable for this booking.');
    }
    if (row.occupied_capacity === 2) {
      const changed = db.prepare(`UPDATE pickup_authorizations SET status = 'USED'
        WHERE bound_appointment_id = ? AND status = ?`).run(id, correcting ? 'EXPIRED' : 'RESERVED');
      if (changed.changes !== 1) {
        throw new ApiError(409, 'HANDOVER_NOT_ALLOWED', 'The bound invitation cannot be used.');
      }
    }
    db.prepare("UPDATE appointments SET status = 'COMPLETED', updated_at = ? WHERE id = ?").run(now, id);
    if (correcting) db.prepare('DELETE FROM no_show_records WHERE appointment_id = ?').run(id);
    writeAudit(db, actorId, correcting ? 'NO_SHOW_CORRECTED' : 'HANDOVER_COMPLETED', 'appointment', id, now, correctionReason ?? null);
    return getStaffAppointment(id);
  });

  const revokeAuthorization = db.transaction((userId, id) => {
    const now = Date.now();
    const row = db.prepare('SELECT * FROM pickup_authorizations WHERE id = ? AND issuer_user_id = ?').get(id, userId);
    if (!row) throw new ApiError(404, 'AUTHORIZATION_NOT_FOUND', 'Invitation not found.');
    if (row.status !== 'REVOKED') {
      if (row.status !== 'ACTIVE' || row.expires_at <= now) {
        throw new ApiError(409, 'INVITATION_REVOKE_NOT_ALLOWED', 'Only an active, unbound invitation can be revoked.');
      }
      db.prepare("UPDATE pickup_authorizations SET status = 'REVOKED' WHERE id = ?").run(id);
      writeAudit(db, userId, 'INVITATION_REVOKED', 'authorization', id, now);
    }
    return { id, status: 'REVOKED', expiresAt: new Date(row.expires_at).toISOString() };
  });

  return {
    createAppointment: (...args) => createAppointment.immediate(...args),
    cancelAppointment: (...args) => cancelAppointment.immediate(...args),
    issueAuthorization: (...args) => issueAuthorization.immediate(...args),
    revokeAuthorization: (...args) => revokeAuthorization.immediate(...args),
    completeAppointment: (...args) => completeAppointment.immediate(...args),
    getStaffAppointment,
  };
}
