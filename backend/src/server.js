import 'dotenv/config';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './db.js';

const config = readConfig();
const db = openDatabase(config.databasePath);
createApp(db, config).listen(config.port, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${config.port}`);
});
