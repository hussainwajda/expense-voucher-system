import { z } from 'zod';
import { VOUCHER_STATUSES } from '../../domain.js';
import { todayIso } from '../../lib/dates.js';

const MAX_AMOUNT = 10_000_000;

/** Treat empty form fields as "not provided" so multipart and JSON bodies behave the same. */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

/** Like emptyToUndefined, and also turns numeric strings from multipart forms into numbers. */
const toNumber = (v: unknown) => {
  const value = emptyToUndefined(v);
  return typeof value === 'string' ? Number(value.trim()) : value;
};

const requiredMessage = (label: string, invalid: string) => (iss: { input?: unknown }) =>
  iss.input === undefined ? `${label} is required.` : invalid;

const isoDate = (label: string) =>
  z.preprocess(emptyToUndefined, z.iso.date({ error: requiredMessage(label, `${label} must be a valid date (YYYY-MM-DD).`) }));

const lookupId = (label: string) => {
  const invalid = `Choose a valid ${label.toLowerCase()}.`;
  return z.preprocess(toNumber, z.number({ error: requiredMessage(label, invalid) }).int(invalid).positive(invalid));
};

/** Accepts real booleans (JSON) and their string forms (multipart). */
export const booleanish = z.union([
  z.boolean(),
  z.enum(['true', 'false', '1', '0', 'on', 'off']).transform((v) => v === 'true' || v === '1' || v === 'on'),
]);

export const voucherIdParams = z.object({
  id: z.coerce.number().int().positive('Voucher id must be a positive integer.'),
});

/** The employee-entered part of a voucher. Used for create, and for edits after merging with stored values. */
export const voucherFieldsSchema = z
  .object({
    voucherDate: z.preprocess(emptyToUndefined, z.iso.date('Voucher date must be a valid date (YYYY-MM-DD).').optional()),
    expenseDate: isoDate('Expense date'),
    departmentId: lookupId('Department'),
    categoryId: lookupId('Expense category'),
    title: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'Expense title is required.' })
        .trim()
        .min(1, 'Expense title is required.')
        .max(150, 'Expense title must be 150 characters or fewer.'),
    ),
    description: z
      .string()
      .trim()
      .max(2000, 'Description must be 2000 characters or fewer.')
      .nullish()
      .transform((v) => (v ? v : null)),
    amount: z.preprocess(
      toNumber,
      z
        .number({ error: requiredMessage('Amount', 'Amount must be a number.') })
        .positive('Amount must be greater than zero.')
        .max(MAX_AMOUNT, `Amount cannot exceed ${MAX_AMOUNT.toLocaleString('en-IN')}.`)
        .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Amount can have at most 2 decimal places.'),
    ),
    useSavedSignature: booleanish.optional(),
  })
  .transform((v) => ({ ...v, voucherDate: v.voucherDate ?? todayIso() }))
  .superRefine((v, ctx) => {
    const today = todayIso();
    if (v.voucherDate > today) {
      ctx.addIssue({ code: 'custom', path: ['voucherDate'], message: 'Voucher date cannot be in the future.' });
    }
    if (v.expenseDate > today) {
      ctx.addIssue({ code: 'custom', path: ['expenseDate'], message: 'Expense date cannot be in the future.' });
    } else if (v.expenseDate > v.voucherDate) {
      ctx.addIssue({ code: 'custom', path: ['expenseDate'], message: 'Expense date cannot be after the voucher date.' });
    }
  });

export type VoucherFields = z.output<typeof voucherFieldsSchema>;

/** Keys an employee may send when creating or editing a draft. */
export const EDITABLE_KEYS = ['voucherDate', 'expenseDate', 'departmentId', 'categoryId', 'title', 'description', 'amount'] as const;

export const approveSchema = z.object({
  useSavedSignature: booleanish.optional(),
});

export const rejectSchema = z.object({
  reason: z
    .string({ error: 'Rejection reason is required.' })
    .trim()
    .min(5, 'Rejection reason is required (at least 5 characters).')
    .max(1000, 'Rejection reason must be 1000 characters or fewer.'),
});

export const SORT_FIELDS = [
  'voucherNumber',
  'voucherDate',
  'expenseDate',
  'title',
  'amount',
  'status',
  'employeeName',
  'department',
  'category',
  'createdAt',
  'updatedAt',
  'submittedAt',
  'decidedAt',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().max(100).optional());
const optionalId = z.preprocess(toNumber, z.number().int().positive().optional());
const optionalDate = z.preprocess(emptyToUndefined, z.iso.date('Use the format YYYY-MM-DD.').optional());
const optionalAmount = z.preprocess(toNumber, z.number().min(0, 'Amount filters cannot be negative.').optional());

export const listQuerySchema = z
  .object({
    q: optionalText,
    voucherNumber: optionalText,
    employeeName: optionalText,
    departmentId: optionalId,
    categoryId: optionalId,
    status: z.preprocess(emptyToUndefined, z.enum(VOUCHER_STATUSES).optional()),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    amountMin: optionalAmount,
    amountMax: optionalAmount,
    sortBy: z.preprocess(emptyToUndefined, z.enum(SORT_FIELDS).default('createdAt')),
    sortOrder: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('desc')),
    page: z.preprocess(toNumber, z.number().int().min(1).default(1)),
    pageSize: z.preprocess(toNumber, z.number().int().min(1).max(100).default(10)),
  })
  .superRefine((q, ctx) => {
    if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) {
      ctx.addIssue({ code: 'custom', path: ['dateTo'], message: '"To" date must be on or after the "From" date.' });
    }
    if (q.amountMin !== undefined && q.amountMax !== undefined && q.amountMin > q.amountMax) {
      ctx.addIssue({ code: 'custom', path: ['amountMax'], message: 'Maximum amount must be at least the minimum amount.' });
    }
  });

export type ListQuery = z.output<typeof listQuerySchema>;
