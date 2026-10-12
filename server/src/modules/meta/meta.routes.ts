import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { VOUCHER_STATUSES } from '../../domain.js';

export const metaRouter = Router();

const STATUS_LABELS: Record<(typeof VOUCHER_STATUSES)[number], string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/** Lookup lists for forms and filters. */
metaRouter.get('/', async (_req, res) => {
  const [departments, categories] = await Promise.all([
    pool.query<{ id: number; name: string }>('SELECT id, name FROM departments ORDER BY name'),
    pool.query<{ id: number; name: string }>('SELECT id, name FROM expense_categories ORDER BY name'),
  ]);
  res.json({
    departments: departments.rows,
    categories: categories.rows,
    statuses: VOUCHER_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
  });
});
