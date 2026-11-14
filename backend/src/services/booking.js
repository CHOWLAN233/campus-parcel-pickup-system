import { createHmac, randomBytes } from 'node:crypto';
import { ApiError } from '../errors.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

export function appointmentView(row) {
  return {
    id: row.id,
    slotId: row.slot_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    status: row.status,
    proxyCount: row.occupied_capacity - 1,
    occupiedCapacity: row.occupied_capacity,
    ...(row.helper_student_id ? { helperStudentId: row.helper_student_id } : {}),
  };
}

export function createBookingService(db, config) {
  const codeHash = (code) => createHmac('sha256', config.sessionSecret).update(code).digest('hex');
  const getAppointment = db.prepare(`
    SELECT a.*, s.start_at, s.end_at, u.student_id AS helper_student_id
    FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
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
    const existing = db.prepare(`SELECT 1 FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
      WHERE a.user_id = ? AND a.status = 'BOOKED' AND s.start_at > ? LIMIT 1`).get(userId, now);
    if (existing) throw new ApiError(409, 'BOOKING_EXISTS', 'An active booking already exists.');

    let authorization;
    if (invitationCode) {
      authorization = db.prepare('SELECT * FROM pickup_authorizations WHERE code_hash = ?').get(codeHash(invitationCode));
      if (!authorization || authorization.issuer_user_id === userId) throw new ApiError(409, 'INVALID_INVITATION', 'Invalid invitation.');
      if (authorization.status !== 'ACTIVE') throw new ApiError(409, 'INVITATION_USED', 'Invitation is unavailable.');
      if (authorization.expires_at <= now) throw new ApiError(409, 'INVITATION_EXPIRED', 'Invitation has expired.');
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

  return {
    createAppointment: (...args) => createAppointment.immediate(...args),
    issueAuthorization: (...args) => issueAuthorization.immediate(...args),
    getAppointment: (id) => appointmentView(getAppointment.get(id)),
  };
}
