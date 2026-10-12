import bcrypt from 'bcryptjs';
import { HttpError } from '../../lib/http-error.js';
import { findActiveUserForLogin } from '../users/users.repository.js';
import { signToken } from './token.js';

// Compared against when the email is unknown, so both failure paths take the same time.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);

export async function login(email: string, password: string) {
  const found = await findActiveUserForLogin(email);
  const passwordOk = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !passwordOk) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  return { user: found.user, token: signToken(found.user) };
}
