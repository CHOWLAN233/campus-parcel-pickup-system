import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { databasePath, bookingStartOffsetDays, bookingDays, nodeEnv } = readConfig();
const db = openDatabase(databasePath);
try {
  db.exec(fs.readFileSync(path.join(projectRoot, 'database/schema.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(projectRoot, 'database/seed.sql'), 'utf8'));
  if (nodeEnv !== 'production') {
    const addSlot = db.prepare('INSERT OR IGNORE INTO pickup_slots(start_at, end_at, capacity, occupied, status) VALUES (?, ?, 60, 0, ?)');
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const dateAt = (offset) => new Date(Date.parse(`${today}T00:00:00+08:00`) + offset * 86400000).toISOString().slice(0, 10);
    db.transaction(() => {
      for (let day = bookingStartOffsetDays; day < bookingStartOffsetDays + bookingDays; day++) {
        for (const hour of [9, 10, 11, 14]) {
          const start = Date.parse(`${dateAt(day)}T${String(hour).padStart(2, '0')}:00:00+08:00`);
          addSlot.run(start, start + 3600000, 'AVAILABLE');
        }
      }
    })();
  }
  console.log(`Database initialized at ${databasePath}`);
} finally {
  db.close();
}
