import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { SIGNATURE_MIME_TYPES } from '../lib/signature-files.js';

/**
 * Parses an optional `signature` image from multipart/form-data requests.
 * JSON requests pass straight through, so the same route accepts either.
 * Files stay in memory (they're small) until the magic-byte check in saveSignature().
 */
export const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 30 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in SIGNATURE_MIME_TYPES) return cb(null, true);
    cb(new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Signature must be a PNG, JPEG or WebP image.'));
  },
}).single('signature');
