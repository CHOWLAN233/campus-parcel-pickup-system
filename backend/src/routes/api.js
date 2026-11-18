import { Router } from 'express';
import bcrypt from 'bcrypt';
import { ApiError } from '../errors.js';
import { appointmentView, businessDate, createBookingService, dateInWindow, slotView, sweepNoShows, writeAudit } from '../services/booking.js';

const userView = (user) => ({ id: user.id, studentId: user.student_id, role: user.role });
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};

function parseId(value) {
  const id = Number(value);
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid identifier.');
  }
  return id;
}

function slotTime(value) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?(?:Z|[+-]\d{2}:[0-5]\d)$/.test(value)
    || !validDate(value.slice(0, 10))) return NaN;
  return Date.parse(value);
}

const validSlotStatus = (value) => value === 'AVAILABLE' || value === 'CLOSED';

export function createApiRouter(db, config) {
  const router = Router();
  const booking = createBookingService(db, config);
  const dummyHash = bcrypt.hashSync('NotARealStudent#2026', 12);

  function requireUser(request, _response, next) {
    const user = request.session?.userId
      ? db.prepare('SELECT id, student_id, role FROM users WHERE id = ?').get(request.session.userId)
      : null;
    if (!user) return next(new ApiError(401, 'UNAUTHORIZED', 'Sign in required.'));
    request.user = user;
    next();
  }

  function requireRole(...roles) {
    return (request, response, next) => {
      requireUser(request, response, (error) => {
        if (error) return next(error);
        if (!roles.includes(request.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'Access denied.'));
        next();
      });
    };
  }

  const requireStudent = requireRole('STUDENT');
  const requireStaff = requireRole('STAFF', 'ADMIN');
  const requireAdmin = requireRole('ADMIN');

  router.post('/auth/register', async (request, response) => {
    const { studentId, password } = request.body ?? {};
    if (typeof studentId !== 'string' || !/^STU\d{4}$/.test(studentId)
      || typeof password !== 'string' || password.length < 8 || password.length > 128
      || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new ApiError(400, 'INVALID_INPUT', 'Check the test student ID and password.');
    }
    if (!db.prepare('SELECT 1 FROM virtual_students WHERE student_id = ?').get(studentId)) {
      throw new ApiError(400, 'INVALID_INPUT', 'Check the test student ID and password.');
    }
    if (db.prepare('SELECT 1 FROM users WHERE student_id = ?').get(studentId)) {
      throw new ApiError(409, 'ALREADY_REGISTERED', 'Student ID is already registered.');
    }
    const hash = await bcrypt.hash(password, 12);
    try {
      const result = db.prepare(`INSERT INTO users(student_id, password_hash, role, created_at)
        VALUES (?, ?, 'STUDENT', ?)`).run(studentId, hash, Date.now());
      response.status(201).json({ user: { id: Number(result.lastInsertRowid), studentId, role: 'STUDENT' } });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new ApiError(409, 'ALREADY_REGISTERED', 'Student ID is already registered.');
      throw error;
    }
  });

  router.post('/auth/login', async (request, response, next) => {
    const { studentId, password } = request.body ?? {};
    const user = typeof studentId === 'string'
      ? db.prepare('SELECT id, student_id, role, password_hash FROM users WHERE student_id = ?').get(studentId)
      : null;
    const valid = typeof password === 'string' && await bcrypt.compare(password, user?.password_hash ?? dummyHash);
    if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    request.session.regenerate((error) => {
      if (error) return next(error);
      request.session.userId = user.id;
      request.session.save((saveError) => {
        if (saveError) return next(saveError);
        response.json({ user: userView(user) });
      });
    });
  });

  router.get('/auth/me', requireUser, (request, response) => response.json({ user: userView(request.user) }));
  router.post('/auth/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('parcel.sid', { path: '/', sameSite: 'lax' }).status(204).end();
    });
  });

  router.get('/slots', requireUser, (request, response) => {
    const { date } = request.query;
    if (!validDate(date) || (request.user.role !== 'ADMIN' && !dateInWindow(date, Date.now(), config))) {
      throw new ApiError(400, 'INVALID_DATE', 'Date is outside the booking window.');
    }
    const slots = db.prepare('SELECT * FROM pickup_slots ORDER BY start_at').all()
      .filter((slot) => businessDate(slot.start_at) === date).map(slotView);
    response.json({ slots });
  });

  router.get('/appointments/me', requireStudent, (request, response) => {
    sweepNoShows(db);
    const rows = db.prepare(`SELECT a.*, s.start_at, s.end_at, u.student_id AS helper_student_id
      FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
      LEFT JOIN appointment_helpers h ON h.appointment_id = a.id
      LEFT JOIN pickup_authorizations pa ON pa.id = h.authorization_id
      LEFT JOIN users u ON u.id = pa.issuer_user_id
      WHERE a.user_id = ? ORDER BY a.created_at DESC, a.id DESC`).all(request.user.id);
    response.json({ appointments: rows.map((row) => appointmentView(row)) });
  });

  router.post('/appointments', requireStudent, (request, response) => {
    const { slotId, invitationCode } = request.body ?? {};
    if (!Number.isSafeInteger(slotId) || slotId < 1
      || (invitationCode !== undefined && (typeof invitationCode !== 'string' || !/^[A-HJ-NP-Z2-9]{8}$/.test(invitationCode)))) {
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid booking request.');
    }
    const appointment = booking.createAppointment(request.user.id, slotId, invitationCode);
    response.status(201).json({ appointment });
  });

  router.post('/appointments/:id/cancel', requireStudent, (request, response) => {
    const appointmentId = parseId(request.params.id);
    response.json({ appointment: booking.cancelAppointment(request.user.id, appointmentId) });
  });

  router.get('/authorizations/me', requireStudent, (request, response) => {
    sweepNoShows(db);
    const rows = db.prepare(`SELECT id,
      CASE WHEN status = 'ACTIVE' AND expires_at <= ? THEN 'EXPIRED' ELSE status END AS status,
      expires_at FROM pickup_authorizations WHERE issuer_user_id = ? ORDER BY id DESC`)
      .all(Date.now(), request.user.id);
    response.json({ authorizations: rows.map((row) => ({ id: row.id, status: row.status,
      expiresAt: new Date(row.expires_at).toISOString() })) });
  });

  router.post('/authorizations', requireStudent, (request, response) => {
    sweepNoShows(db);
    response.status(201).json(booking.issueAuthorization(request.user.id));
  });

  router.post('/authorizations/:id/revoke', requireStudent, (request, response) => {
    response.json({ authorization: booking.revokeAuthorization(request.user.id, parseId(request.params.id)) });
  });

  router.get('/no-shows/me', requireStudent, (request, response) => {
    sweepNoShows(db);
    const records = db.prepare(`SELECT n.id, n.appointment_id, n.recorded_at, s.start_at, s.end_at
      FROM no_show_records n JOIN appointments a ON a.id = n.appointment_id
      JOIN pickup_slots s ON s.id = a.slot_id WHERE a.user_id = ?
      ORDER BY n.recorded_at DESC, n.id DESC`).all(request.user.id);
    response.json({ records: records.map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      recordedAt: new Date(row.recorded_at).toISOString(),
      startAt: new Date(row.start_at).toISOString(),
      endAt: new Date(row.end_at).toISOString(),
    })) });
  });

  router.get('/staff/appointments', requireStaff, (request, response) => {
    const { reference } = request.query;
    const id = parseId(typeof reference === 'string' ? reference.trim().replace(/^#/, '') : undefined);
    sweepNoShows(db);
    response.json({ appointment: booking.getStaffAppointment(id) });
  });

  router.post('/staff/appointments/:id/complete', requireStaff, (request, response) => {
    response.json({ appointment: booking.completeAppointment(request.user.id, parseId(request.params.id)) });
  });

  router.post('/staff/appointments/:id/correct-no-show', requireStaff, (request, response) => {
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
    if (!reason || reason.length > 300) {
      throw new ApiError(400, 'INVALID_INPUT', 'Enter a correction reason of at most 300 characters.');
    }
    const id = parseId(request.params.id);
    sweepNoShows(db);
    response.json({ appointment: booking.completeAppointment(request.user.id, id, reason) });
  });

  router.post('/admin/slots', requireAdmin, (request, response) => {
    const { startAt, endAt, capacity = 60, status = 'AVAILABLE' } = request.body ?? {};
    const start = slotTime(startAt);
    const end = slotTime(endAt);
    const slot = db.transaction(() => {
      const now = Date.now();
      if (!(start > now) || end - start !== 3600000 || capacity !== 60 || !validSlotStatus(status)) {
        throw new ApiError(400, 'INVALID_INPUT', 'Use a future one-hour slot, capacity 60, and a valid status.');
      }
      if (db.prepare('SELECT 1 FROM pickup_slots WHERE start_at < ? AND end_at > ?').get(end, start)) {
        throw new ApiError(409, 'SLOT_OVERLAP', 'The pickup slot overlaps an existing slot.');
      }
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO pickup_slots(start_at, end_at, capacity, status) VALUES (?, ?, 60, ?)',
      ).run(start, end, status);
      const id = Number(lastInsertRowid);
      writeAudit(db, request.user.id, 'SLOT_CREATED', 'slot', id, now);
      return db.prepare('SELECT * FROM pickup_slots WHERE id = ?').get(id);
    }).immediate();
    response.status(201).json({ slot: slotView(slot) });
  });

  router.patch('/admin/slots/:id', requireAdmin, (request, response) => {
    const id = parseId(request.params.id);
    const { status, capacity } = request.body ?? {};
    if (!validSlotStatus(status)) throw new ApiError(400, 'INVALID_INPUT', 'Invalid slot status.');
    const slot = db.transaction(() => {
      const row = db.prepare('SELECT * FROM pickup_slots WHERE id = ?').get(id);
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Slot not found.');
      if (capacity !== undefined && capacity !== row.capacity) {
        throw new ApiError(400, 'INVALID_INPUT', 'Slot capacity cannot be changed.');
      }
      if (status !== row.status) {
        db.prepare('UPDATE pickup_slots SET status = ? WHERE id = ?').run(status, id);
        writeAudit(db, request.user.id, status === 'CLOSED' ? 'SLOT_CLOSED' : 'SLOT_OPENED', 'slot', id, Date.now());
      }
      return { ...row, status };
    }).immediate();
    response.json({ slot: slotView(slot) });
  });

  router.get('/admin/audit-logs', requireAdmin, (_request, response) => {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 100').all();
    response.json({ records: rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: new Date(row.created_at).toISOString(),
      reason: row.reason,
      result: 'SUCCESS',
    })) });
  });

  return router;
}
