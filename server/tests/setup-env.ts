import { inject } from 'vitest';

// Must run before anything imports src/config/env.ts.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.UPLOAD_DIR = inject('uploadDir');
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hs256';
process.env.SESSION_TTL_HOURS = '8';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.MAX_UPLOAD_MB = '1';
