import 'dotenv/config';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

const [studentId, role, ...extra] = process.argv.slice(2);
const config = readConfig();
if (config.nodeEnv !== 'development' || !/^STU\d{4}$/.test(studentId ?? '')
  || !['STUDENT', 'STAFF', 'ADMIN'].includes(role) || extra.length) {
  throw new Error('Development only: npm run dev:role -- <fictional student ID> <STUDENT|STAFF|ADMIN>');
}

const db = openDatabase(config.databasePath);
try {
  const result = db.prepare(`UPDATE users SET role = ? WHERE student_id = ?
    AND student_id IN (SELECT student_id FROM virtual_students)`).run(role, studentId);
  if (result.changes !== 1) throw new Error('Register this fictional account before assigning its role.');
  console.log(`Assigned development role ${role} to ${studentId}.`);
} finally {
  db.close();
}
