import session from 'express-session';

export class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStatement = db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?');
    this.setStatement = db.prepare('INSERT INTO sessions(sid, expires_at, data) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET expires_at = excluded.expires_at, data = excluded.data');
    this.deleteStatement = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStatement = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) { callback(error); }
  }

  set(sid, data, callback = () => {}) {
    try {
      const expiresAt = data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;
      this.setStatement.run(sid, expiresAt, JSON.stringify(data));
      callback(null);
    } catch (error) { callback(error); }
  }

  destroy(sid, callback = () => {}) {
    try { this.deleteStatement.run(sid); callback(null); }
    catch (error) { callback(error); }
  }

  touch(sid, data, callback = () => {}) {
    try {
      const expiresAt = data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;
      this.touchStatement.run(expiresAt, sid);
      callback(null);
    } catch (error) { callback(error); }
  }
}
