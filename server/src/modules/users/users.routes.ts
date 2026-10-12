import { Router } from 'express';
import { currentUser, requireRole } from '../../middleware/authenticate.js';
import { signatureUpload } from '../../middleware/upload.js';
import { HttpError } from '../../lib/http-error.js';
import { sendSignature } from '../../lib/send-signature.js';
import { deleteSignature, saveSignature } from '../../lib/signature-files.js';
import { findActiveUserById, getSignaturePath, replaceSignaturePath } from './users.repository.js';

export const usersRouter = Router();

// A saved signature lets employees (on vouchers) and the Director (on approvals) sign without re-uploading.
const canSign = requireRole('EMPLOYEE', 'DIRECTOR');

usersRouter.get('/me/signature', canSign, async (req, res) => {
  const relPath = await getSignaturePath(currentUser(req).id);
  if (!relPath) throw HttpError.notFound('You have not saved a signature yet.');
  await sendSignature(res, relPath);
});

usersRouter.put('/me/signature', canSign, signatureUpload, async (req, res) => {
  const user = currentUser(req);
  if (!req.file) {
    throw HttpError.validation('Choose a signature image to upload.', { signature: ['Choose a signature image to upload.'] });
  }
  const newPath = await saveSignature(req.file.buffer);
  let oldPath: string | null;
  try {
    oldPath = await replaceSignaturePath(user.id, newPath);
  } catch (err) {
    await deleteSignature(newPath);
    throw err;
  }
  await deleteSignature(oldPath);
  res.json({ user: await findActiveUserById(user.id) });
});

usersRouter.delete('/me/signature', canSign, async (req, res) => {
  const user = currentUser(req);
  await deleteSignature(await replaceSignaturePath(user.id, null));
  res.json({ user: await findActiveUserById(user.id) });
});
