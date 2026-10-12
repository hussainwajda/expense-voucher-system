import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, Role } from '../domain.js';
import { HttpError } from '../lib/http-error.js';
import { AUTH_COOKIE, verifyToken } from '../modules/auth/token.js';
import { findActiveUserById } from '../modules/users/users.repository.js';

/** Browsers send the httpOnly cookie; API clients (curl, Postman) may send `Authorization: Bearer <jwt>`. */
function extractToken(req: Request): string | null {
  const header = req.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim() || null;
  const cookie: unknown = req.cookies?.[AUTH_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) throw HttpError.unauthorized();

  let userId: number;
  try {
    userId = verifyToken(token);
  } catch {
    throw HttpError.unauthorized('Your session has expired. Please log in again.');
  }

  // Load the user on every request so deactivated accounts and role changes take effect immediately.
  const user = await findActiveUserById(userId);
  if (!user) throw HttpError.unauthorized('Your account is no longer active.');

  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw HttpError.unauthorized();
    if (!roles.includes(req.user.role)) throw HttpError.forbidden();
    next();
  };
}

/** The authenticated user; only call this behind `authenticate`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
