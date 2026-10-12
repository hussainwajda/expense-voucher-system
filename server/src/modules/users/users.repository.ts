import type { Db } from '../../db/pool.js';
import { pool } from '../../db/pool.js';
import type { AuthUser, Role } from '../../domain.js';

interface UserRow {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  employee_code: string | null;
  department_id: number | null;
  department_name: string | null;
  signature_path: string | null;
}

const USER_COLUMNS = `
  u.id, u.full_name, u.email, u.role, u.employee_code,
  u.department_id, d.name AS department_name, u.signature_path`;
const USER_FROM = 'FROM users u LEFT JOIN departments d ON d.id = u.department_id';

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    employeeCode: row.employee_code,
    department: row.department_id ? { id: row.department_id, name: row.department_name ?? '' } : null,
    hasSignature: row.signature_path !== null,
  };
}

export async function findActiveUserById(id: number, db: Db = pool): Promise<AuthUser | null> {
  const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE u.id = $1 AND u.is_active`, [id]);
  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function findActiveUserForLogin(email: string, db: Db = pool) {
  const { rows } = await db.query<UserRow & { password_hash: string }>(
    `SELECT ${USER_COLUMNS}, u.password_hash ${USER_FROM}
     WHERE lower(u.email) = lower($1) AND u.is_active`,
    [email],
  );
  const row = rows[0];
  return row ? { user: toAuthUser(row), passwordHash: row.password_hash } : null;
}

export async function getSignaturePath(userId: number, db: Db = pool): Promise<string | null> {
  const { rows } = await db.query<{ signature_path: string | null }>(
    'SELECT signature_path FROM users WHERE id = $1',
    [userId],
  );
  return rows[0]?.signature_path ?? null;
}

/** Sets (or clears) the saved signature and returns the previous path so the caller can delete it. */
export async function replaceSignaturePath(userId: number, newPath: string | null, db: Db = pool) {
  const { rows } = await db.query<{ old_path: string | null }>(
    `UPDATE users u SET signature_path = $2
     FROM (SELECT signature_path AS old_path FROM users WHERE id = $1 FOR UPDATE) prev
     WHERE u.id = $1
     RETURNING prev.old_path`,
    [userId, newPath],
  );
  return rows[0]?.old_path ?? null;
}
