import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { authenticate, currentUser } from '../../middleware/authenticate.js';
import { login } from './auth.service.js';
import { AUTH_COOKIE, authCookieOptions } from './token.js';

const loginSchema = z.object({
  email: z.string({ error: 'Email is required.' }).trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(200),
});

// Slow down password guessing: 10 failed attempts per IP every 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many failed login attempts. Please wait a few minutes and try again.' },
    });
  },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body ?? {});
  const { user, token } = await login(email, password);
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
  // The token is also returned for API clients that prefer the Authorization header.
  res.json({ user, token, expiresIn: env.sessionTtlSeconds });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, options);
  res.status(204).end();
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: currentUser(req) });
});
