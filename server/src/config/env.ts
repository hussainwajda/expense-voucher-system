import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { SERVER_ROOT, resolveFromServerRoot } from '../paths.js';

// Values already present in process.env (e.g. set by the test runner) win over .env.
dotenv.config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(24 * 30).default(8),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(2),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  APP_TIMEZONE: z
    .string()
    .default('Asia/Kolkata')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'APP_TIMEZONE must be a valid IANA time zone'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  // Secure cookies need HTTPS; defaults to on in production.
  cookieSecure: raw.COOKIE_SECURE ? raw.COOKIE_SECURE === 'true' : raw.NODE_ENV === 'production',
  uploadDir: resolveFromServerRoot(raw.UPLOAD_DIR),
  maxUploadBytes: Math.round(raw.MAX_UPLOAD_MB * 1024 * 1024),
  sessionTtlSeconds: Math.round(raw.SESSION_TTL_HOURS * 3600),
  clientOrigins: raw.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
};
