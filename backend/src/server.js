import 'dotenv/config';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './db.js';
import { sweepNoShows } from './services/booking.js';

const config = readConfig();
const db = openDatabase(config.databasePath);
function recordMissedPickups() {
  try {
    sweepNoShows(db);
  } catch (error) {
    console.error('No-show sweep failed:', error.code ?? error.name);
  }
}

recordMissedPickups();
setInterval(recordMissedPickups, 60_000).unref();

createApp(db, config).listen(config.port, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${config.port}`);
});
