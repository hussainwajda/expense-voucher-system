import fs from 'node:fs/promises';
import type { Response } from 'express';
import { HttpError } from './http-error.js';
import { absoluteSignaturePath, signatureMimeType } from './signature-files.js';

/** Stream a stored signature image. Callers must have already checked that the user may see it. */
export async function sendSignature(res: Response, relPath: string) {
  const abs = absoluteSignaturePath(relPath);
  try {
    await fs.access(abs);
  } catch {
    throw HttpError.notFound('The signature image file is missing.');
  }
  res.setHeader('Cache-Control', 'private, no-cache');
  res.type(signatureMimeType(relPath));
  await new Promise<void>((resolve, reject) => {
    res.sendFile(abs, (err) => (err ? reject(err) : resolve()));
  });
}
