import { Router } from 'express';
import bcrypt from 'bcrypt';
import { ApiError } from '../errors.js';
import { appointmentView, businessDate, createBookingService, dateInWindow, slotView } from '../services/booking.js';

const userView = (user) => ({ id: user.id, studentId: user.student_id, role: user.role });
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};

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

  function requireStudent(request, response, next) {
    requireUser(request, response, (error) => {
      if (error) return next(error);
      if (request.user.role !== 'STUDENT') return next(new ApiError(403, 'FORBIDDEN', 'Student access required.'));
      next();
    });
  }

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
    if (!validDate(date) || !dateInWindow(date, Date.now(), config)) {
      throw new ApiError(400, 'INVALID_DATE', 'Date is outside the booking window.');
    }
    const slots = db.prepare('SELECT * FROM pickup_slots ORDER BY start_at').all()
      .filter((slot) => businessDate(slot.start_at) === date).map(slotView);
    response.json({ slots });
  });

  router.get('/appointments/me', requireStudent, (request, response) => {
    const rows = db.prepare(`SELECT a.*, s.start_at, s.end_at, u.student_id AS helper_student_id
      FROM appointments a JOIN pickup_slots s ON s.id = a.slot_id
      LEFT JOIN appointment_helpers h ON h.appointment_id = a.id
      LEFT JOIN pickup_authorizations pa ON pa.id = h.authorization_id
      LEFT JOIN users u ON u.id = pa.issuer_user_id
      WHERE a.user_id = ? ORDER BY a.created_at DESC, a.id DESC`).all(request.user.id);
    response.json({ appointments: rows.map(appointmentView) });
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

  router.get('/authorizations/me', requireStudent, (request, response) => {
    const rows = db.prepare(`SELECT id,
      CASE WHEN status = 'ACTIVE' AND expires_at <= ? THEN 'EXPIRED' ELSE status END AS status,
      expires_at FROM pickup_authorizations WHERE issuer_user_id = ? ORDER BY id DESC`)
      .all(Date.now(), request.user.id);
    response.json({ authorizations: rows.map((row) => ({ id: row.id, status: row.status,
      expiresAt: new Date(row.expires_at).toISOString() })) });
  });

  router.post('/authorizations', requireStudent, (request, response) => {
    response.status(201).json(booking.issueAuthorization(request.user.id));
  });

  return router;
}
