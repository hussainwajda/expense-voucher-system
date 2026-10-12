import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type pg from 'pg';
import { renderSignaturePng } from './signature-png.js';

type Queryable = Pick<pg.Client | pg.Pool, 'query'>;

export const DEMO_PASSWORD = 'Password@123';

export const DEPARTMENTS = ['Administration', 'Engineering', 'Finance', 'Human Resources', 'Marketing', 'Operations', 'Sales'];

export const CATEGORIES = [
  'Travel',
  'Accommodation',
  'Food & Meals',
  'Local Conveyance',
  'Office Supplies',
  'Client Entertainment',
  'Training & Development',
  'Communication',
  'Miscellaneous',
];

// Fictional demo users. Emails use the reserved .example TLD.
const USERS = [
  { key: 'director', name: 'Vikram Rao', email: 'director@abc.example', role: 'DIRECTOR', code: 'DIR-001', dept: 'Administration', signs: true },
  { key: 'accounts', name: 'Priya Nair', email: 'accounts@abc.example', role: 'ACCOUNTS', code: 'ACC-001', dept: 'Finance', signs: false },
  { key: 'arjun', name: 'Arjun Sharma', email: 'employee@abc.example', role: 'EMPLOYEE', code: 'EMP-1001', dept: 'Engineering', signs: true },
  { key: 'neha', name: 'Neha Kapoor', email: 'neha@abc.example', role: 'EMPLOYEE', code: 'EMP-1002', dept: 'Marketing', signs: true },
  { key: 'rahul', name: 'Rahul Verma', email: 'rahul@abc.example', role: 'EMPLOYEE', code: 'EMP-1003', dept: 'Sales', signs: true },
] as const;

type UserKey = (typeof USERS)[number]['key'];

interface DemoVoucher {
  owner: UserKey;
  title: string;
  category: string;
  amount: number;
  description?: string;
  /** Hours before "now" that the voucher was created. */
  createdHoursAgo: number;
  /** Days between the expense and the voucher date. */
  expenseDaysBefore: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  signed?: boolean;
  submittedHoursAgo?: number;
  decidedHoursAgo?: number;
  rejectionReason?: string;
}

// Listed oldest first so voucher numbers increase with time.
const VOUCHERS: DemoVoucher[] = [
  { owner: 'rahul', title: 'Train tickets Mumbai to Pune (client demo)', category: 'Travel', amount: 1540, createdHoursAgo: 24 * 21, expenseDaysBefore: 2, status: 'APPROVED', submittedHoursAgo: 24 * 21 - 1, decidedHoursAgo: 24 * 20 },
  { owner: 'arjun', title: 'Cloud certification exam fee', category: 'Training & Development', amount: 12000, description: 'Associate-level cloud certification, pre-approved by the engineering manager.', createdHoursAgo: 24 * 12, expenseDaysBefore: 3, status: 'APPROVED', submittedHoursAgo: 24 * 12 - 2, decidedHoursAgo: 24 * 10 },
  { owner: 'neha', title: 'Client dinner after product launch', category: 'Client Entertainment', amount: 7850.5, description: 'Dinner with two partner representatives after the launch event.', createdHoursAgo: 24 * 9, expenseDaysBefore: 1, status: 'APPROVED', submittedHoursAgo: 24 * 9 - 3, decidedHoursAgo: 24 * 7 },
  { owner: 'arjun', title: 'Noise-cancelling headphones', category: 'Office Supplies', amount: 18999, createdHoursAgo: 24 * 8, expenseDaysBefore: 0, status: 'REJECTED', submittedHoursAgo: 24 * 8 - 1, decidedHoursAgo: 24 * 6, rejectionReason: 'Personal equipment is not reimbursable under the expense policy. Please raise a purchase request with IT instead.' },
  { owner: 'arjun', title: 'Flight to Bengaluru for vendor meeting', category: 'Travel', amount: 8450, description: 'Return economy fare, booked two weeks in advance.', createdHoursAgo: 24 * 4, expenseDaysBefore: 1, status: 'APPROVED', submittedHoursAgo: 24 * 4 - 1, decidedHoursAgo: 0.2 },
  { owner: 'arjun', title: 'Hotel stay in Bengaluru (2 nights)', category: 'Accommodation', amount: 6200, createdHoursAgo: 24 * 3, expenseDaysBefore: 1, status: 'PENDING_APPROVAL', submittedHoursAgo: 24 * 3 - 1 },
  { owner: 'neha', title: 'Trade show banner and brochure printing', category: 'Miscellaneous', amount: 15600, createdHoursAgo: 24 * 2, expenseDaysBefore: 2, status: 'PENDING_APPROVAL', submittedHoursAgo: 24 * 2 - 2 },
  { owner: 'rahul', title: 'Mobile bill for September', category: 'Communication', amount: 1299, createdHoursAgo: 30, expenseDaysBefore: 5, status: 'REJECTED', submittedHoursAgo: 29, decidedHoursAgo: 0.1, rejectionReason: 'Mobile bills are already covered by the monthly phone allowance.' },
  { owner: 'rahul', title: 'Fuel for client site visits (week 40)', category: 'Local Conveyance', amount: 2180, createdHoursAgo: 20, expenseDaysBefore: 3, status: 'PENDING_APPROVAL', submittedHoursAgo: 19 },
  { owner: 'neha', title: 'Courier charges for event samples', category: 'Miscellaneous', amount: 420, createdHoursAgo: 6, expenseDaysBefore: 0, status: 'DRAFT' },
  { owner: 'arjun', title: 'Team lunch after the release', category: 'Food & Meals', amount: 3250.75, description: 'Lunch for the six-person release team.', createdHoursAgo: 3, expenseDaysBefore: 0, status: 'DRAFT', signed: true },
  { owner: 'arjun', title: 'Cab fare for client visit', category: 'Local Conveyance', amount: 640, createdHoursAgo: 1, expenseDaysBefore: 1, status: 'DRAFT' },
];

function isoDateInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function minusDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export interface SeedOptions {
  uploadDir: string;
  timeZone: string;
  log?: (msg: string) => void;
}

/** Wipe all application data (keeps the schema). */
export async function clearData(db: Queryable, uploadDir: string) {
  await db.query(
    `TRUNCATE voucher_events, vouchers, users, departments, expense_categories RESTART IDENTITY CASCADE;
     ALTER SEQUENCE voucher_number_seq RESTART WITH 1;`,
  );
  await fs.rm(path.join(uploadDir, 'signatures'), { recursive: true, force: true });
}

export async function hasUsers(db: Queryable) {
  const { rows } = await db.query<{ n: string }>('SELECT count(*) AS n FROM users');
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Insert lookup data, demo users and a spread of vouchers in every status. Expects empty tables. */
export async function seedDemoData(db: Queryable, { uploadDir, timeZone, log = console.log }: SeedOptions) {
  await fs.mkdir(path.join(uploadDir, 'signatures'), { recursive: true });
  const writeSignature = async (seedText: string) => {
    const rel = `signatures/${randomUUID()}.png`;
    await fs.writeFile(path.join(uploadDir, rel), renderSignaturePng(seedText));
    return rel;
  };

  const deptIds = new Map<string, number>();
  for (const name of DEPARTMENTS) {
    const { rows } = await db.query<{ id: number }>('INSERT INTO departments (name) VALUES ($1) RETURNING id', [name]);
    deptIds.set(name, rows[0]!.id);
  }
  const categoryIds = new Map<string, number>();
  for (const name of CATEGORIES) {
    const { rows } = await db.query<{ id: number }>('INSERT INTO expense_categories (name) VALUES ($1) RETURNING id', [name]);
    categoryIds.set(name, rows[0]!.id);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = new Map<UserKey, { id: number; name: string; signature: string | null; dept: string }>();
  for (const u of USERS) {
    const signature = u.signs ? await writeSignature(u.name) : null;
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO users (full_name, email, password_hash, role, employee_code, department_id, signature_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [u.name, u.email, passwordHash, u.role, u.code, deptIds.get(u.dept), signature],
    );
    users.set(u.key, { id: rows[0]!.id, name: u.name, signature, dept: u.dept });
  }

  const director = users.get('director')!;
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000);

  for (const v of VOUCHERS) {
    const owner = users.get(v.owner)!;
    const createdAt = hoursAgo(v.createdHoursAgo);
    const submittedAt = v.submittedHoursAgo !== undefined ? hoursAgo(v.submittedHoursAgo) : null;
    const decidedAt = v.decidedHoursAgo !== undefined ? hoursAgo(v.decidedHoursAgo) : null;
    const voucherDate = isoDateInZone(createdAt, timeZone);
    const expenseDate = minusDays(voucherDate, v.expenseDaysBefore);
    const signed = v.status !== 'DRAFT' || v.signed;
    const employeeSig = signed ? await writeSignature(owner.name) : null;
    const directorSig = v.status === 'APPROVED' ? await writeSignature(director.name) : null;
    const decided = v.status === 'APPROVED' || v.status === 'REJECTED';
    const updatedAt = decidedAt ?? submittedAt ?? createdAt;

    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO vouchers
         (voucher_date, expense_date, department_id, category_id, title, description, amount,
          employee_id, employee_signature_path, status, submitted_at,
          decided_by, decided_at, director_signature_path, rejection_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        voucherDate, expenseDate, deptIds.get(owner.dept), categoryIds.get(v.category), v.title, v.description ?? null, v.amount,
        owner.id, employeeSig, v.status, submittedAt,
        decided ? director.id : null, decided ? decidedAt : null, directorSig, v.rejectionReason ?? null, createdAt, updatedAt,
      ],
    );
    const voucherId = rows[0]!.id;

    const events: Array<[string, string | null, string, number, Date, string | null]> = [
      ['CREATED', null, 'DRAFT', owner.id, createdAt, null],
    ];
    if (submittedAt) events.push(['SUBMITTED', 'DRAFT', 'PENDING_APPROVAL', owner.id, submittedAt, null]);
    if (v.status === 'APPROVED') events.push(['APPROVED', 'PENDING_APPROVAL', 'APPROVED', director.id, decidedAt!, null]);
    if (v.status === 'REJECTED') events.push(['REJECTED', 'PENDING_APPROVAL', 'REJECTED', director.id, decidedAt!, v.rejectionReason!]);
    for (const [type, from, to, actor, at, note] of events) {
      await db.query(
        `INSERT INTO voucher_events (voucher_id, actor_id, event_type, from_status, to_status, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [voucherId, actor, type, from, to, note, at],
      );
    }
  }

  log(`Seeded ${DEPARTMENTS.length} departments, ${CATEGORIES.length} categories, ${USERS.length} users and ${VOUCHERS.length} vouchers.`);
  log('\nDemo accounts (password for all: ' + DEMO_PASSWORD + ')');
  for (const u of USERS) log(`  ${u.role.padEnd(9)} ${u.email.padEnd(24)} ${u.name}`);
}
