import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from './errors.js';
import { createApiRouter } from './routes/api.js';
import { SqliteSessionStore } from './session-store.js';

const frontendPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');

export function createApp(db, config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));
  app.use(session({
    name: 'parcel.sid',
    secret: config.sessionSecret,
    store: new SqliteSessionStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.nodeEnv === 'production', maxAge: 86400000 },
  }));
  app.use('/api', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api', createApiRouter(db, config));

  app.use('/api', (_request, response) => {
    response.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found.' });
  });
  app.use(express.static(frontendPath));
  app.get('/', (_request, response) => response.redirect('/login.html'));
  app.use((error, _request, response, _next) => {
    if (error instanceof ApiError) return response.status(error.status).json({ code: error.code, message: error.message });
    if (error instanceof SyntaxError && error.status === 400) return response.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid JSON.' });
    console.error('Request failed:', error.code ?? error.name);
    response.status(500).json({ code: 'INTERNAL_ERROR', message: 'Request failed.' });
  });
  return app;
}
