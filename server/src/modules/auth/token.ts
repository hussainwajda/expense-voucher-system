import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { Role } from '../../domain.js';

export const AUTH_COOKIE = 'evms_session';

export function signToken(user: { id: number; role: Role }): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: env.sessionTtlSeconds,
  });
}

/** Returns the user id from a valid token; throws on an invalid or expired one. */
export function verifyToken(token: string): number {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  const userId = typeof payload === 'object' ? Number(payload.sub) : Number.NaN;
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('Malformed token subject');
  return userId;
}

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true, // not readable from JavaScript, so an XSS bug can't steal the session
    sameSite: 'lax', // not sent on cross-site POST/PATCH/DELETE, which blocks CSRF
    secure: env.isProduction,
    path: '/',
    maxAge: env.sessionTtlSeconds * 1000,
  };
}
