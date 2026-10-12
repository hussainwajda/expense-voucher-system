import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { metaRouter } from './modules/meta/meta.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { vouchersRouter } from './modules/vouchers/vouchers.routes.js';
import { CLIENT_DIST_DIR } from './paths.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // blob: lets the client preview a signature image before uploading it.
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  );
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (env.NODE_ENV === 'development') app.use(morgan('dev'));

  // Public
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);

  // Everything below requires a valid session
  app.use('/api/meta', authenticate, metaRouter);
  app.use('/api/dashboard', authenticate, dashboardRouter);
  app.use('/api/vouchers', authenticate, vouchersRouter);
  app.use('/api/users', authenticate, usersRouter);
  app.use('/api', notFoundHandler);

  // In production the API also serves the built React app (single deployable).
  const indexHtml = path.join(CLIENT_DIST_DIR, 'index.html');
  if (env.isProduction && fs.existsSync(indexHtml)) {
    app.use(express.static(CLIENT_DIST_DIR, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(indexHtml));
  }

  app.use(errorHandler);
  return app;
}
