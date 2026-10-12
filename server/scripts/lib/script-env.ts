import path from 'node:path';
import dotenv from 'dotenv';
import { SERVER_ROOT, resolveFromServerRoot } from '../../src/paths.js';

// The CLI scripts only need a few settings, so they don't load the full (strict) app config.
dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy server/.env.example to server/.env first.');
    process.exit(1);
  }
  return url;
}

export const scriptEnv = {
  uploadDir: resolveFromServerRoot(process.env.UPLOAD_DIR ?? 'uploads'),
  timeZone: process.env.APP_TIMEZONE ?? 'Asia/Kolkata',
  localPgPort: Number(process.env.LOCAL_PG_PORT ?? 5433),
};
