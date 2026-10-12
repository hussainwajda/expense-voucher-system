import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError, z } from 'zod';
import { env } from '../config/env.js';
import { HttpError, type ErrorDetails } from '../lib/http-error.js';

// Friendly messages for database constraints that can surface through the API.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  vouchers_expense_not_after_voucher: 'Expense date cannot be after the voucher date.',
  vouchers_submitted_has_signature: 'Employee signature is required before submission.',
  vouchers_approved_has_director_signature: 'Director signature is required before approval.',
  vouchers_rejected_has_reason: 'A rejection reason is required.',
  users_email_lower_key: 'A user with this email already exists.',
};

function send(res: Response, status: number, code: string, message: string, details?: ErrorDetails) {
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

interface PgError extends Error {
  code: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && typeof (err as PgError).code === 'string' && /^[0-9A-Z]{5}$/.test((err as PgError).code);
}

export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, 'NOT_FOUND', `No API route for ${req.method} ${req.originalUrl}`);
}

// Express recognises error handlers by their four parameters, so `_next` must stay.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    req.socket.destroy();
    return;
  }

  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const { fieldErrors, formErrors } = z.flattenError(err);
    const details: ErrorDetails = Object.fromEntries(
      Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1])),
    );
    if (formErrors.length) details._form = formErrors;
    const first = err.issues[0];
    const message = first ? `${first.path.length ? `${first.path.join('.')}: ` : ''}${first.message}` : 'Invalid input.';
    return send(res, 400, 'VALIDATION_ERROR', message, details);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, 'FILE_TOO_LARGE', `Signature image must be ${env.MAX_UPLOAD_MB} MB or smaller.`);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return send(res, 400, 'BAD_REQUEST', `Unexpected file field "${err.field}". Upload the image as "signature".`);
    }
    return send(res, 400, 'BAD_REQUEST', err.message);
  }

  // body-parser errors (malformed JSON, payload too large)
  const bodyErr = err as { type?: string; status?: number };
  if (bodyErr?.type === 'entity.parse.failed') return send(res, 400, 'BAD_REQUEST', 'Request body is not valid JSON.');
  if (bodyErr?.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');

  if (isPgError(err)) {
    const friendly = err.constraint ? CONSTRAINT_MESSAGES[err.constraint] : undefined;
    switch (err.code) {
      case '23505':
        return send(res, 409, 'CONFLICT', friendly ?? 'A record with these details already exists.');
      case '23514': // check_violation, also raised by the voucher workflow trigger
        return send(res, 409, 'INVALID_STATE', friendly ?? err.message);
      case '23503':
        return send(res, 400, 'VALIDATION_ERROR', 'A referenced record (department, category or user) does not exist.');
      case '22P02':
      case '22007':
      case '22008':
      case '22003':
        return send(res, 400, 'VALIDATION_ERROR', 'One of the supplied values has an invalid format.');
    }
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}
