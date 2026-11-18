import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');
  db.transaction(() => {
    const columns = db.pragma('table_info(audit_logs)');
    if (columns.length && !columns.some(({ name }) => name === 'reason')) {
      db.exec('ALTER TABLE audit_logs ADD COLUMN reason TEXT');
    }
  }).immediate();
  return db;
}

export function inTransaction(db, operation) {
  return db.transaction(operation)();
}
