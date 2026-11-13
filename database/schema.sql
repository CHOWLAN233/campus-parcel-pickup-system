PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS virtual_students (
  student_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'STAFF', 'ADMIN')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pickup_slots (
  id INTEGER PRIMARY KEY,
  start_at INTEGER NOT NULL UNIQUE,
  end_at INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 60 CHECK (capacity BETWEEN 1 AND 60),
  occupied INTEGER NOT NULL DEFAULT 0 CHECK (occupied >= 0 AND occupied <= capacity),
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'CLOSED')),
  CHECK (end_at - start_at = 3600000)
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot_id INTEGER NOT NULL REFERENCES pickup_slots(id),
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
  occupied_capacity INTEGER NOT NULL CHECK (occupied_capacity IN (1, 2)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS appointments_user_status ON appointments(user_id, status);
CREATE INDEX IF NOT EXISTS appointments_slot_status ON appointments(slot_id, status);

CREATE TABLE IF NOT EXISTS pickup_authorizations (
  id INTEGER PRIMARY KEY,
  issuer_user_id INTEGER NOT NULL REFERENCES users(id),
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESERVED', 'USED', 'EXPIRED', 'REVOKED')),
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  bound_appointment_id INTEGER UNIQUE REFERENCES appointments(id)
);
CREATE INDEX IF NOT EXISTS authorizations_issuer ON pickup_authorizations(issuer_user_id, status);

CREATE TABLE IF NOT EXISTS appointment_helpers (
  appointment_id INTEGER PRIMARY KEY REFERENCES appointments(id),
  authorization_id INTEGER NOT NULL UNIQUE REFERENCES pickup_authorizations(id),
  helper_user_id INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS no_show_records (
  id INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id),
  recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  created_at INTEGER NOT NULL
);
