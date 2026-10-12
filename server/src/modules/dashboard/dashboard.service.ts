import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import type { AuthUser, VoucherEventType, VoucherStatus } from '../../domain.js';
import { toVoucherDto } from '../vouchers/vouchers.mapper.js';
import { listVouchers } from '../vouchers/vouchers.repository.js';
import { listQuerySchema } from '../vouchers/vouchers.schemas.js';

const RECENT_LIMIT = 6;

/** Re-use the voucher list query (and its scoping rules) for dashboard widgets. */
async function recentVouchers(user: AuthUser, query: Record<string, unknown>) {
  const parsed = listQuerySchema.parse({ pageSize: RECENT_LIMIT, ...query });
  const scope = user.role === 'EMPLOYEE' ? { kind: 'own' as const, employeeId: user.id } : { kind: 'organisation' as const };
  const { rows } = await listVouchers(pool, scope, parsed);
  return rows.map((row) => toVoucherDto(row, user));
}

async function employeeDashboard(user: AuthUser) {
  const { rows } = await pool.query<{
    total: number; draft: number; pending: number; approved: number; rejected: number;
    total_claimed: number; approved_amount: number;
  }>(
    `SELECT count(*)                                              AS total,
            count(*) FILTER (WHERE status = 'DRAFT')              AS draft,
            count(*) FILTER (WHERE status = 'PENDING_APPROVAL')   AS pending,
            count(*) FILTER (WHERE status = 'APPROVED')           AS approved,
            count(*) FILTER (WHERE status = 'REJECTED')           AS rejected,
            coalesce(sum(amount) FILTER (WHERE status <> 'DRAFT'), 0)    AS total_claimed,
            coalesce(sum(amount) FILTER (WHERE status = 'APPROVED'), 0)  AS approved_amount
     FROM vouchers WHERE employee_id = $1`,
    [user.id],
  );
  const s = rows[0]!;
  return {
    role: 'EMPLOYEE' as const,
    stats: {
      totalVouchers: s.total,
      draftVouchers: s.draft,
      pendingApproval: s.pending,
      approvedVouchers: s.approved,
      rejectedVouchers: s.rejected,
      // "Claimed" = submitted for reimbursement, i.e. everything except drafts.
      totalAmountClaimed: s.total_claimed,
      approvedAmount: s.approved_amount,
    },
    recentVouchers: await recentVouchers(user, { sortBy: 'updatedAt' }),
  };
}

async function directorDashboard(user: AuthUser) {
  const { rows } = await pool.query<{
    pending: number; approved_today: number; rejected_today: number; pending_amount: number;
  }>(
    `SELECT count(*) FILTER (WHERE status = 'PENDING_APPROVAL') AS pending,
            count(*) FILTER (WHERE status = 'APPROVED' AND (decided_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date) AS approved_today,
            count(*) FILTER (WHERE status = 'REJECTED' AND (decided_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date) AS rejected_today,
            coalesce(sum(amount) FILTER (WHERE status = 'PENDING_APPROVAL'), 0) AS pending_amount
     FROM vouchers`,
    [env.APP_TIMEZONE],
  );
  const s = rows[0]!;

  // Workflow activity only: draft edits stay private to the employee.
  const activity = await pool.query<{
    id: number; event_type: VoucherEventType; to_status: VoucherStatus; note: string | null; created_at: Date;
    voucher_id: number; voucher_number: string; title: string; amount: number;
    actor_name: string; employee_name: string;
  }>(
    `SELECT ev.id, ev.event_type, ev.to_status, ev.note, ev.created_at,
            v.id AS voucher_id, v.voucher_number, v.title, v.amount,
            actor.full_name AS actor_name, emp.full_name AS employee_name
     FROM voucher_events ev
     JOIN vouchers v ON v.id = ev.voucher_id
     JOIN users actor ON actor.id = ev.actor_id
     JOIN users emp ON emp.id = v.employee_id
     WHERE ev.event_type IN ('SUBMITTED', 'APPROVED', 'REJECTED')
     ORDER BY ev.created_at DESC, ev.id DESC
     LIMIT 10`,
  );

  return {
    role: 'DIRECTOR' as const,
    stats: {
      pendingApproval: s.pending,
      approvedToday: s.approved_today,
      rejectedToday: s.rejected_today,
      totalPendingAmount: s.pending_amount,
    },
    // Oldest first: the ones that have waited longest.
    awaitingApproval: await recentVouchers(user, { status: 'PENDING_APPROVAL', sortBy: 'submittedAt', sortOrder: 'asc' }),
    recentActivity: activity.rows.map((a) => ({
      id: a.id,
      type: a.event_type,
      toStatus: a.to_status,
      note: a.note,
      createdAt: a.created_at,
      actorName: a.actor_name,
      voucher: { id: a.voucher_id, voucherNumber: a.voucher_number, title: a.title, amount: a.amount, employeeName: a.employee_name },
    })),
  };
}

async function accountsDashboard(user: AuthUser) {
  const { rows } = await pool.query<{
    total: number; pending: number; approved: number; rejected: number; approved_amount: number;
  }>(
    `SELECT count(*)                                            AS total,
            count(*) FILTER (WHERE status = 'PENDING_APPROVAL') AS pending,
            count(*) FILTER (WHERE status = 'APPROVED')         AS approved,
            count(*) FILTER (WHERE status = 'REJECTED')         AS rejected,
            coalesce(sum(amount) FILTER (WHERE status = 'APPROVED'), 0) AS approved_amount
     FROM vouchers
     WHERE status <> 'DRAFT'`,
  );
  const s = rows[0]!;
  return {
    role: 'ACCOUNTS' as const,
    stats: {
      totalVouchers: s.total,
      pendingApproval: s.pending,
      approvedVouchers: s.approved,
      rejectedVouchers: s.rejected,
      totalApprovedAmount: s.approved_amount,
    },
    recentApproved: await recentVouchers(user, { status: 'APPROVED', sortBy: 'decidedAt', sortOrder: 'desc' }),
  };
}

export function getDashboard(user: AuthUser) {
  switch (user.role) {
    case 'EMPLOYEE':
      return employeeDashboard(user);
    case 'DIRECTOR':
      return directorDashboard(user);
    case 'ACCOUNTS':
      return accountsDashboard(user);
  }
}
