import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { HttpError } from './http-error.js';

const SIGNATURE_SUBDIR = 'signatures';

export const SIGNATURE_MIME_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

type SignatureMime = keyof typeof SIGNATURE_MIME_TYPES;

const EXTENSION_MIME: Record<string, SignatureMime> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** Identify an image by its magic bytes instead of trusting the client-supplied MIME type. */
export function detectImageType(buf: Buffer): SignatureMime | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Validate an uploaded image and store it under a random name. Returns the path relative to UPLOAD_DIR. */
export async function saveSignature(buf: Buffer, uploadDir = env.uploadDir): Promise<string> {
  const type = detectImageType(buf);
  if (!type) {
    throw new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Signature must be a PNG, JPEG or WebP image.');
  }
  const relPath = path.posix.join(SIGNATURE_SUBDIR, `${randomUUID()}.${SIGNATURE_MIME_TYPES[type]}`);
  await fs.mkdir(path.join(uploadDir, SIGNATURE_SUBDIR), { recursive: true });
  await fs.writeFile(path.join(uploadDir, relPath), buf, { flag: 'wx' });
  return relPath;
}

/**
 * Copy a stored signature to a new file. Vouchers keep their own copy so that
 * changing your saved signature later never alters an already-signed voucher.
 */
export async function copySignature(relPath: string, uploadDir = env.uploadDir): Promise<string> {
  const ext = path.extname(relPath) || '.png';
  const newRel = path.posix.join(SIGNATURE_SUBDIR, `${randomUUID()}${ext}`);
  await fs.mkdir(path.join(uploadDir, SIGNATURE_SUBDIR), { recursive: true });
  await fs.copyFile(absoluteSignaturePath(relPath, uploadDir), path.join(uploadDir, newRel));
  return newRel;
}

/** Best-effort cleanup: a missing file is not an error. */
export async function deleteSignature(relPath: string | null | undefined, uploadDir = env.uploadDir) {
  if (!relPath) return;
  await fs.rm(absoluteSignaturePath(relPath, uploadDir), { force: true }).catch(() => {});
}

/** Resolve a stored relative path, refusing anything that escapes the upload directory. */
export function absoluteSignaturePath(relPath: string, uploadDir = env.uploadDir): string {
  const root = path.resolve(uploadDir);
  const abs = path.resolve(root, relPath);
  if (!abs.startsWith(root + path.sep)) {
    throw new Error(`Refusing to access file outside the upload directory: ${relPath}`);
  }
  return abs;
}

export function signatureMimeType(relPath: string): string {
  return EXTENSION_MIME[path.extname(relPath).slice(1).toLowerCase()] ?? 'application/octet-stream';
}
