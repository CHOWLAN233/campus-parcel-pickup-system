import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { businessDate } from '../src/services/booking.js';

const password = 'DemoPass#2026';
const config = { nodeEnv: 'test', sessionSecret: 'test-secret-only-for-in-memory-database',
  bookingStartOffsetDays: 0, bookingDays: 3 };
let db, app, slotId, slotDate;

beforeEach(() => {
  db = openDatabase(':memory:');
  db.exec(readFileSync(resolve('../database/schema.sql'), 'utf8'));
  db.exec(readFileSync(resolve('../database/seed.sql'), 'utf8'));
  const start = Date.parse(`${businessDate(Date.now() + 86400000)}T10:00:00+08:00`);
  slotDate = businessDate(start);
  slotId = Number(db.prepare(`INSERT INTO pickup_slots(start_at, end_at, capacity, occupied, status)
    VALUES (?, ?, 60, 0, 'AVAILABLE')`).run(start, start + 3600000).lastInsertRowid);
  app = createApp(db, config);
});
afterEach(() => db.close());

async function registerAndLogin(studentId) {
  const agent = request.agent(app);
  expect((await agent.post('/api/auth/register').send({ studentId, password })).status).toBe(201);
  expect((await agent.post('/api/auth/login').send({ studentId, password })).status).toBe(200);
  return agent;
}

describe('FR-00/01 registration and sessions', () => {
  it('serves health and static frontend files', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
    expect((await request(app).get('/login.html')).text).toContain('ExpressBook');
  });

  it('registers only fictional whitelist IDs and rejects duplicates', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/register').send({ studentId: 'STU0001', password })).status).toBe(201);
    expect((await agent.post('/api/auth/register').send({ studentId: 'STU0001', password })).body.code).toBe('ALREADY_REGISTERED');
    expect((await agent.post('/api/auth/register').send({ studentId: 'REAL0000', password })).body.code).toBe('INVALID_INPUT');
    expect(db.prepare('SELECT password_hash FROM users WHERE student_id = ?').get('STU0001').password_hash).not.toBe(password);
  });

  it('uses one login error and invalidates the server session on logout', async () => {
    const agent = await registerAndLogin('STU0001');
    expect((await agent.get('/api/auth/me')).body.user.studentId).toBe('STU0001');
    const unknown = await request(app).post('/api/auth/login').send({ studentId: 'STU9999', password });
    const wrong = await request(app).post('/api/auth/login').send({ studentId: 'STU0001', password: 'wrong' });
    expect(unknown.body).toEqual(wrong.body);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('FR-02/03/04/05 slots and bookings', () => {
  it('returns frontend-compatible slot shape and rejects invalid dates', async () => {
    const agent = await registerAndLogin('STU0001');
    const result = await agent.get(`/api/slots?date=${slotDate}`);
    expect(result.body.slots[0]).toMatchObject({ id: slotId, capacity: 60, occupied: 0, remaining: 60, status: 'AVAILABLE' });
    expect((await agent.get('/api/slots?date=2026-99-99')).body.code).toBe('INVALID_DATE');
  });

  it('creates one future booking and rejects a second with no capacity change', async () => {
    const agent = await registerAndLogin('STU0001');
    const first = await agent.post('/api/appointments').send({ slotId });
    expect(first.status).toBe(201);
    expect(first.body.appointment).toMatchObject({ status: 'BOOKED', occupiedCapacity: 1, proxyCount: 0 });
    expect((await agent.post('/api/appointments').send({ slotId })).body.code).toBe('BOOKING_EXISTS');
    expect((await agent.get('/api/appointments/me')).body.appointments).toHaveLength(1);
    expect(db.prepare('SELECT occupied FROM pickup_slots WHERE id = ?').get(slotId).occupied).toBe(1);
  });
});

describe('FR-07/08/09 invitation and atomic capacity', () => {
  it('issues a one-hour code, stores only HMAC, and reserves it with two units', async () => {
    const collector = await registerAndLogin('STU0001');
    const issuer = await registerAndLogin('STU0002');
    const issued = await issuer.post('/api/authorizations');
    expect(issued.status).toBe(201);
    const code = issued.body.invitationCode;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(JSON.stringify(db.prepare('SELECT * FROM pickup_authorizations').get())).not.toContain(code);
    const booked = await collector.post('/api/appointments').send({ slotId, invitationCode: code });
    expect(booked.status).toBe(201);
    expect(booked.body.appointment).toMatchObject({ occupiedCapacity: 2, proxyCount: 1, helperStudentId: 'STU0002' });
    expect(db.prepare('SELECT occupied FROM pickup_slots WHERE id = ?').get(slotId).occupied).toBe(2);
    expect((await issuer.get('/api/authorizations/me')).body.authorizations[0].status).toBe('RESERVED');
  });

  it('rolls back a proxy booking when only one unit remains', async () => {
    const collector = await registerAndLogin('STU0001');
    const issuer = await registerAndLogin('STU0002');
    const code = (await issuer.post('/api/authorizations')).body.invitationCode;
    db.prepare('UPDATE pickup_slots SET occupied = 59 WHERE id = ?').run(slotId);
    const failed = await collector.post('/api/appointments').send({ slotId, invitationCode: code });
    expect(failed.body.code).toBe('SLOT_FULL');
    expect(db.prepare('SELECT occupied FROM pickup_slots WHERE id = ?').get(slotId).occupied).toBe(59);
    expect(db.prepare('SELECT status FROM pickup_authorizations').get().status).toBe('ACTIVE');
    expect(db.prepare('SELECT COUNT(*) AS n FROM appointments').get().n).toBe(0);
  });

  it('rejects own, expired and already reserved invitation codes', async () => {
    const collector = await registerAndLogin('STU0001');
    const issuer = await registerAndLogin('STU0002');
    const third = await registerAndLogin('STU0003');
    const firstCode = (await issuer.post('/api/authorizations')).body.invitationCode;
    expect((await issuer.post('/api/authorizations')).body.code).toBe('INVITATION_EXISTS');
    expect((await issuer.post('/api/appointments').send({ slotId, invitationCode: firstCode })).body.code).toBe('INVALID_INVITATION');
    db.prepare('UPDATE pickup_authorizations SET expires_at = ?').run(Date.now() - 1);
    expect((await collector.post('/api/appointments').send({ slotId, invitationCode: firstCode })).body.code).toBe('INVITATION_EXPIRED');
    const secondCode = (await issuer.post('/api/authorizations')).body.invitationCode;
    expect((await collector.post('/api/appointments').send({ slotId, invitationCode: secondCode })).status).toBe(201);
    expect((await third.post('/api/appointments').send({ slotId, invitationCode: secondCode })).body.code).toBe('INVITATION_USED');
    expect(db.prepare('SELECT occupied FROM pickup_slots WHERE id = ?').get(slotId).occupied).toBe(2);
  });
});
