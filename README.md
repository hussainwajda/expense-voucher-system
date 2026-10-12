# Expense Voucher Management System

A web app that replaces ABC Company's paper expense vouchers. **Employees** create and sign vouchers, the **Director** approves (with a signature) or rejects (with a reason), and the **Accounts Team** sees every voucher for reimbursement processing.

**Repository:** https://github.com/hussainwajda/expense-voucher-system

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS · Node.js + Express 5 + TypeScript · PostgreSQL · JWT (httpOnly cookie) · Zod validation · Vitest + Supertest

## Screenshots

| | |
| --- | --- |
| ![Login](docs/screenshots/01-login.jpg) | ![Employee dashboard](docs/screenshots/02-employee-dashboard.jpg) |
| ![New voucher](docs/screenshots/03-new-voucher-form.jpg) | ![Rejected voucher](docs/screenshots/04-rejected-voucher-detail.jpg) |
| ![Director dashboard](docs/screenshots/05-director-dashboard.jpg) | ![Approve dialog](docs/screenshots/06-director-approve-dialog.jpg) |
| ![Accounts dashboard](docs/screenshots/07-accounts-dashboard.jpg) | ![Filtered list](docs/screenshots/08-accounts-filtered-list.jpg) |

---

## Contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Project structure](#project-structure)
4. [Database schema](#database-schema)
5. [Workflow and business rules](#workflow-and-business-rules)
6. [API documentation](#api-documentation)
7. [Security](#security)
8. [Testing](#testing)
9. [Assumptions](#assumptions)
10. [Production build](#production-build)

---

## Features

| Area | What's included |
| --- | --- |
| **Authentication** | Email/password login, JWT in an httpOnly `SameSite=Lax` cookie (Bearer header also accepted for API clients), protected routes, role guards on both client and server, login rate limiting |
| **Employee** | Create vouchers, save as Draft, edit or delete drafts, sign by **uploading** an image, **drawing** on a signature pad, or reusing a **saved** signature, submit for approval, track status, see rejection reasons, "Copy as new draft" to resubmit a rejected claim |
| **Director** | Pending-approvals queue (oldest first), view all submitted vouchers, approve with signature (upload / draw / saved), reject with a mandatory reason, cannot edit employee data |
| **Accounts** | View every submitted voucher with both signatures, search / filter / sort, **CSV export**, print-ready voucher (with amount in words) |
| **Search & filter** *(bonus)* | Voucher number, employee name, department, category, status, voucher-date range, amount range, sortable columns, pagination; state is kept in the URL so views can be bookmarked |
| **Dashboards** | Role-specific stats exactly as in the brief, plus recent vouchers or activity |
| **Audit trail** | Every create / edit / submit / approve / reject is recorded with actor and time, and shown as a timeline |
| **Data integrity** | Business rules enforced in the API **and** in PostgreSQL (CHECK constraints + a workflow trigger) |
| **UX** | Responsive (tables become cards on mobile), accessible forms and dialogs, toasts, empty and error states, print stylesheet |

---

## Quick start

**Requirements:** Node.js 20.19+ (tested on 24) and npm. Docker is **not** required.

```bash
# 1. Install dependencies (npm or pnpm both work)
npm install

# 2. Configure the API
cp server/.env.example server/.env

# 3. Start PostgreSQL. Leave it running in its own terminal.
npm run db:local

# 4. In a second terminal, start the API (:4000) and the web app (:5173)
npm run dev
```

Open **http://localhost:5173**.

`npm run db:local` downloads a real PostgreSQL server through the [`embedded-postgres`](https://github.com/leinelissen/embedded-postgres) npm package, keeps its data in `server/.pgdata/`, applies migrations, and loads demo data on first run.

### Demo accounts

All demo accounts use the password **`Password@123`**. The login page has one-click buttons for each.

| Role | Email | Name |
| --- | --- | --- |
| Employee | `employee@abc.example` | Arjun Sharma |
| Employee | `neha@abc.example` | Neha Kapoor |
| Employee | `rahul@abc.example` | Rahul Verma |
| Director | `director@abc.example` | Vikram Rao |
| Accounts | `accounts@abc.example` | Priya Nair |

The seed data includes vouchers in every status: drafts, pending, approved (including one approved today) and rejected.

### Other ways to run PostgreSQL

Both options serve the same URL as `.env.example` (`postgresql://postgres:postgres@localhost:5433/evms`), so nothing else changes.

```bash
# Docker
docker compose up -d
npm run db:migrate
npm run db:seed
```

```bash
# Your own PostgreSQL: create a database, set DATABASE_URL in server/.env, then
npm run db:migrate
npm run db:seed
```

### Scripts

| Command (from the repo root) | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) + web app (Vite) together |
| `npm run db:local` | Start embedded PostgreSQL, migrate, seed if empty |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Load demo data (skipped if users exist; `npm --prefix server run db:seed -- --force` wipes and reseeds) |
| `npm --prefix server run db:reset` | Drop everything, re-migrate, reseed (development only) |
| `npm test` | API integration tests (starts a throwaway PostgreSQL automatically) |
| `npm run typecheck` | TypeScript checks for server and client |
| `npm run build` / `npm start` | Production build; the API then also serves the React app |

---

## Project structure

```
.
├── docker-compose.yml             optional PostgreSQL
├── server/                        Express API
│   ├── db/migrations/             plain SQL migrations (001_initial_schema.sql)
│   ├── scripts/                   migrate, seed, local-db (embedded Postgres)
│   ├── src/
│   │   ├── app.ts                 middleware and route wiring
│   │   ├── config/env.ts          validated environment config
│   │   ├── db/                    pg pool, transactions, migration runner
│   │   ├── middleware/            authenticate / requireRole, uploads, error handler
│   │   ├── lib/                   HttpError, signature file storage, dates
│   │   └── modules/
│   │       ├── auth/              login, logout, me, JWT
│   │       ├── vouchers/          routes → service → repository, schemas, policy, CSV
│   │       ├── dashboard/         per-role stats
│   │       ├── users/             saved signature
│   │       └── meta/              departments, categories, statuses
│   └── tests/                     Vitest + Supertest integration tests
└── client/                        React app
    └── src/
        ├── api/                   typed fetch client and endpoints
        ├── auth/                  AuthProvider, RequireAuth / RequireRole guards
        ├── components/            layout, signature pad / field, timeline, printable voucher, UI kit
        ├── pages/                 Login, Dashboard, Voucher list / form / detail, Profile
        └── hooks/                 TanStack Query hooks
```

The API is layered: **routes** parse HTTP; **services** hold business rules, permissions and transactions; **repositories** contain SQL. Validation uses Zod at the service boundary, and the same rules are mirrored in the client forms for instant feedback.

---

## Database schema

The schema lives in [`server/db/migrations/001_initial_schema.sql`](server/db/migrations/001_initial_schema.sql). A small runner ([`server/src/db/migrator.ts`](server/src/db/migrator.ts)) applies migration files in order and records them in `schema_migrations`.

```mermaid
erDiagram
    departments ||--o{ users : "belongs to"
    departments ||--o{ vouchers : "charged to"
    expense_categories ||--o{ vouchers : "categorises"
    users ||--o{ vouchers : "creates (employee_id)"
    users ||--o{ vouchers : "decides (decided_by)"
    vouchers ||--o{ voucher_events : "history"
    users ||--o{ voucher_events : "actor"
```

### Tables

**`users`**: everyone who can log in.

| Column | Notes |
| --- | --- |
| `id` | identity PK |
| `full_name`, `email` | email unique, case-insensitive (`lower(email)` index) |
| `password_hash` | bcrypt |
| `role` | enum `EMPLOYEE` / `DIRECTOR` / `ACCOUNTS` |
| `employee_code` | optional, unique ("Employee ID" in the brief) |
| `department_id` | FK, the default department for new vouchers |
| `signature_path` | optional saved signature (relative path under `UPLOAD_DIR`) |
| `is_active` | deactivated users can't log in; existing sessions stop working immediately |

**`vouchers`**: one row per expense voucher.

| Group | Columns |
| --- | --- |
| Basic | `voucher_number` (unique, generated: `EV-<year>-<00001>`), `voucher_date`, `expense_date`, `department_id`, `category_id`, `title`, `description`, `amount NUMERIC(12,2)` |
| Employee | `employee_id` (FK users), `employee_signature_path` |
| Approval | `status` (enum `DRAFT` / `PENDING_APPROVAL` / `APPROVED` / `REJECTED`), `submitted_at`, `decided_by` (FK users), `decided_at` (approval/rejection date), `director_signature_path`, `rejection_reason` |
| Audit | `created_at`, `updated_at` (kept current by a trigger) |

**`voucher_events`**: append-only history: `event_type` (`CREATED`, `UPDATED`, `SUBMITTED`, `APPROVED`, `REJECTED`), `from_status`, `to_status`, `actor_id`, `note` (holds the rejection reason), `created_at`. It drives the timeline on each voucher and the Director's "Recent activity".

**`departments`**, **`expense_categories`**: lookup tables used by forms and filters.

### Rules enforced by the database

| Constraint / trigger | Rule |
| --- | --- |
| `CHECK (amount > 0)`, `NOT NULL`s | amount > 0; department, title, expense date and amount are mandatory |
| `vouchers_expense_not_after_voucher` | expense date ≤ voucher date |
| `vouchers_submitted_has_signature` | anything past Draft has an employee signature (rule 12) |
| `vouchers_approved_has_director_signature` | approved ⇒ Director signature (rule 13) |
| `vouchers_rejected_has_reason` | rejected ⇒ non-blank reason (rule 8) |
| `vouchers_decision_fields` | `decided_by`/`decided_at` set exactly when approved or rejected |
| `enforce_voucher_workflow` trigger | only `DRAFT→DRAFT`, `DRAFT→PENDING_APPROVAL`, `PENDING_APPROVAL→APPROVED/REJECTED` are allowed; employee-entered fields are frozen once submitted; only drafts can be deleted |
| `voucher_number_seq` + `UNIQUE` | voucher numbers are unique and generated automatically (rules 1 and 2) |

Indexes cover the common list queries: by employee, status, voucher date, department, category and decision date.

---

## Workflow and business rules

```
Draft ──submit──▶ Submitted ──▶ Pending Approval ──approve──▶ Approved ──▶ visible to Accounts
  │ edit / delete                       │
  │ (owner only)                        └──reject (reason)──▶ Rejected ──▶ employee sees reason
```

"Submitted" is the submit **event** (`submitted_at` plus a `SUBMITTED` history row). The voucher then waits in `PENDING_APPROVAL`, which is the status the dashboards count. The voucher timeline shows every step from the brief.

| # | Business rule | Enforced in |
| --- | --- | --- |
| 1, 2 | Unique, auto-generated voucher number | DB default from a sequence + `UNIQUE` |
| 3 | New vouchers start as Draft | Insert never sets status; DB default `DRAFT` |
| 4, 5 | Only drafts are editable/deletable, only by their author | `vouchers.service.ts` (409 `INVALID_STATE`), guarded `UPDATE … WHERE status='DRAFT'`, DB trigger |
| 6 | Only the Director approves/rejects | `requireRole('DIRECTOR')` on the routes |
| 7 | Approved vouchers are read-only | Workflow trigger (terminal state) |
| 8 | Rejection needs a reason | Zod (`reason` ≥ 5 chars) + DB CHECK |
| 9 | Employees see only their own vouchers | Query scope + `canView` policy (404 for others) |
| 10, 11 | Director and Accounts see every voucher | Organisation-wide scope (see the drafts assumption below) |
| 12 | Submitted vouchers carry the employee's signature | Service check + DB CHECK |
| 13 | Approved vouchers carry the Director's signature | Service check + DB CHECK |

Status changes run inside a transaction with `SELECT … FOR UPDATE`, so two people acting on the same voucher at once can't both succeed.

---

## API documentation

Base URL: `http://localhost:4000/api` (the web app reaches it through Vite's `/api` proxy). Bodies are JSON unless they include a signature image, in which case they are `multipart/form-data` with the image in a field named **`signature`** (PNG, JPEG or WebP, 2 MB max by default).

### Authentication

The session is an httpOnly cookie named `evms_session`. API clients may instead send `Authorization: Bearer <token>` using the `token` returned by login.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | public | `{ "email", "password" }` → `{ user, token, expiresIn }` and sets the cookie. Rate-limited to 10 failed attempts per 15 min per IP. |
| `POST` | `/auth/logout` | public | Clears the cookie. `204` |
| `GET` | `/auth/me` | any | `{ user }` for the current session |
| `GET` | `/health` | public | `{ "status": "ok" }` (also checks the DB) |

```bash
curl -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"employee@abc.example","password":"Password@123"}'
```

### Vouchers

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| `GET` | `/vouchers` | all | List with search, filter, sort and pagination (query below). Employees get their own vouchers; Director and Accounts get all submitted ones. |
| `GET` | `/vouchers/export` | Director, Accounts | Same filters, returns CSV (up to 5,000 rows) |
| `POST` | `/vouchers` | Employee | Create a **draft**. `201` + `{ voucher }` |
| `GET` | `/vouchers/:id` | all (if visible) | `{ voucher }` including `history[]` |
| `PATCH` | `/vouchers/:id` | Employee (owner, draft) | Partial update; optional new `signature` |
| `DELETE` | `/vouchers/:id` | Employee (owner, draft) | `204` |
| `POST` | `/vouchers/:id/submit` | Employee (owner, draft) | Draft → Pending Approval; requires a signature |
| `POST` | `/vouchers/:id/duplicate` | Employee (owner) | New draft copied from an existing voucher (e.g. a rejected one) |
| `POST` | `/vouchers/:id/approve` | Director | Requires `signature` file **or** `useSavedSignature: true` |
| `POST` | `/vouchers/:id/reject` | Director | `{ "reason": "…" }` (required, 5–1000 chars) |
| `GET` | `/vouchers/:id/signatures/employee` | all (if visible) | Signature image |
| `GET` | `/vouchers/:id/signatures/director` | all (if visible) | Signature image |

**Create / update fields**

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | required, ≤ 150 chars |
| `departmentId` | int | required, must exist |
| `categoryId` | int | required, must exist |
| `expenseDate` | `YYYY-MM-DD` | required, not in the future, ≤ voucher date |
| `voucherDate` | `YYYY-MM-DD` | optional (defaults to today), not in the future |
| `amount` | number | required, > 0, ≤ 10,000,000, max 2 decimals |
| `description` | string | optional, ≤ 2000 chars |
| `signature` | file | optional on create/update, required before submit |
| `useSavedSignature` | boolean | copy the user's saved signature onto the voucher |

Fields like `status`, `employeeId` or `voucherNumber` in the body are ignored.

```bash
# Create a draft with a signature image, then submit it
curl -b cookies.txt -X POST http://localhost:4000/api/vouchers \
  -F title='Taxi to client office' -F departmentId=2 -F categoryId=4 \
  -F amount=450.50 -F expenseDate=2026-10-10 -F signature=@my-signature.png
curl -b cookies.txt -X POST http://localhost:4000/api/vouchers/13/submit
```

**List query parameters** (all optional)

| Param | Example | Notes |
| --- | --- | --- |
| `q` | `q=EV-2026` | matches voucher number, title, employee name or employee ID |
| `voucherNumber`, `employeeName` | `employeeName=neha` | partial, case-insensitive |
| `status` | `PENDING_APPROVAL` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED` |
| `departmentId`, `categoryId` | `3` | |
| `dateFrom`, `dateTo` | `2026-10-01` | voucher-date range, inclusive |
| `amountMin`, `amountMax` | `1000` | inclusive |
| `sortBy` | `amount` | `voucherNumber`, `voucherDate`, `expenseDate`, `title`, `amount`, `status`, `employeeName`, `department`, `category`, `createdAt` (default), `updatedAt`, `submittedAt`, `decidedAt` |
| `sortOrder` | `asc` | `asc` or `desc` (default) |
| `page`, `pageSize` | `2`, `20` | `pageSize` ≤ 100, default 10 |

Response: `{ data: Voucher[], pagination: { page, pageSize, total, totalPages }, sort }`.

**Voucher object**

```jsonc
{
  "id": 5,
  "voucherNumber": "EV-2026-00005",
  "voucherDate": "2026-10-08",
  "expenseDate": "2026-10-07",
  "department": { "id": 2, "name": "Engineering" },
  "category": { "id": 1, "name": "Travel" },
  "title": "Flight to Bengaluru for vendor meeting",
  "description": "Return economy fare…",
  "amount": 8450,
  "status": "APPROVED",
  "employee": { "id": 3, "name": "Arjun Sharma", "employeeCode": "EMP-1001" },
  "employeeSignatureUrl": "/api/vouchers/5/signatures/employee?v=1a2b3c4d",
  "submittedAt": "2026-10-08T12:49:02.832Z",
  "decidedAt": "2026-10-12T11:37:02.832Z",
  "decidedBy": { "id": 1, "name": "Vikram Rao" },
  "directorSignatureUrl": "/api/vouchers/5/signatures/director?v=9f8e7d6c",
  "rejectionReason": null,
  "createdAt": "…", "updatedAt": "…",
  "permissions": { "canEdit": false, "canDelete": false, "canSubmit": false, "canDuplicate": false, "canApprove": false, "canReject": false },
  "history": [ { "type": "CREATED", "actor": { "name": "Arjun Sharma", "role": "EMPLOYEE" }, "createdAt": "…" }, "…" ]  // detail only
}
```

`permissions` is computed by the server for the current user, and the UI uses it to decide which buttons to show.

### Dashboard, users, lookups

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| `GET` | `/dashboard` | all | Role-specific payload (below) |
| `GET` | `/meta` | all | `{ departments, categories, statuses }` |
| `GET` | `/users/me/signature` | Employee, Director | Saved signature image |
| `PUT` | `/users/me/signature` | Employee, Director | Upload/replace the saved signature (`signature` file) |
| `DELETE` | `/users/me/signature` | Employee, Director | Remove it (signed vouchers keep their own copy) |

Dashboard payloads:

- **Employee**: `stats { totalVouchers, draftVouchers, pendingApproval, approvedVouchers, rejectedVouchers, totalAmountClaimed, approvedAmount }`, `recentVouchers[]`
- **Director**: `stats { pendingApproval, approvedToday, rejectedToday, totalPendingAmount }`, `awaitingApproval[]` (oldest first), `recentActivity[]`
- **Accounts**: `stats { totalVouchers, pendingApproval, approvedVouchers, rejectedVouchers, totalApprovedAmount }`, `recentApproved[]`

### Errors

Every error has the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "amount: Amount must be greater than zero.", "details": { "amount": ["Amount must be greater than zero."] } } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` / `BAD_REQUEST` | invalid input (`details` maps field → messages) |
| 401 | `UNAUTHORIZED` / `INVALID_CREDENTIALS` | not logged in, expired session, wrong password |
| 403 | `FORBIDDEN` | wrong role for the action |
| 404 | `NOT_FOUND` | doesn't exist **or** not visible to you (other people's vouchers return 404 rather than 403) |
| 409 | `INVALID_STATE` | action not allowed in the voucher's current status (e.g. editing a submitted voucher) |
| 413 | `FILE_TOO_LARGE` | signature over the size limit |
| 415 | `UNSUPPORTED_FILE_TYPE` | not a real PNG/JPEG/WebP (checked by file signature, not the declared type) |
| 429 | `TOO_MANY_REQUESTS` | login rate limit |

---

## Security

- Passwords hashed with bcrypt. Login takes the same time for unknown emails and wrong passwords, and returns the same message for both.
- JWT (HS256, 8 h by default) stored in an **httpOnly** cookie, so page scripts can't read it. `SameSite=Lax` blocks cross-site POST/PATCH/DELETE (CSRF), and the cookie is `Secure` in production.
- The user is reloaded from the database on every request, so deactivations and role changes apply immediately.
- Authorization is checked on the server for every route (role guard plus per-voucher policy); the client-side guards only shape the UI.
- Uploads are held in memory, size-limited, checked by **magic bytes**, and stored under random UUID names outside the web root. They are served only through access-checked routes with the correct `Content-Type`. SVG is not accepted, because it can carry scripts.
- SQL is fully parameterised. Sort columns come from an allow-list, and `%`/`_` in searches are escaped.
- CSV export neutralises spreadsheet formulas (`=`, `+`, `-`, `@`).
- `helmet` security headers (with a CSP when serving the built app) and a JSON body size limit.

---

## Testing

```bash
npm test
```

61 integration tests run the real Express app against a real PostgreSQL. The suite starts a temporary embedded instance, so nothing needs to be installed; set `TEST_DATABASE_URL` to use a disposable database of your own. Coverage includes:

- auth: login and cookie flags, wrong credentials, Bearer tokens, tampered tokens, logout
- the full workflow: draft → submit → approve/reject, required signatures and reasons, read-only after submission, terminal states, saved-signature copies, duplicating
- validation of every field rule, unknown lookups, fake images, oversized uploads
- role isolation for Employee, Director and Accounts across every endpoint
- search, filter, sort, pagination and LIKE-escaping
- dashboard numbers for each role
- database safeguards that hold even with direct SQL

---

## Assumptions

1. **Users are provisioned by an administrator** (seeded here). There is no self-registration, because the brief only lists login.
2. **"Submitted" and "Pending Approval".** Submitting is recorded as an event (`submitted_at` + history). The stored status becomes `PENDING_APPROVAL` immediately. The dashboards in the brief count Pending, not Submitted.
3. **Drafts are private to their author.** The Director and Accounts see every voucher **once it is submitted**. The brief's workflow begins at submission, and neither the Director's nor the Accounts dashboard counts drafts. Requesting someone else's draft returns 404.
4. **Rejected is final.** The brief says employees can't modify rejected vouchers, so to resubmit, the employee uses **Copy as new draft**, which creates a new voucher with a new number and leaves the original untouched.
5. **Signatures are snapshotted per voucher.** A voucher keeps its own copy of the signature image, so later changes to a saved signature never alter signed vouchers. Employees and the Director can sign by upload, by drawing (exported as PNG), or with a saved signature.
6. **Expense category is required.** It isn't in the brief's mandatory list, but it is needed for filtering and accounting. Description and Employee ID are optional.
7. **Dates.** Voucher date defaults to today. Neither date may be in the future, and the expense date can't be after the voucher date. "Today" (including "Approved today") uses `APP_TIMEZONE`, default `Asia/Kolkata`.
8. **Currency is INR.** Amounts are stored as `NUMERIC(12,2)`, between ₹0.01 and ₹1 crore, with at most 2 decimals.
9. **Date-range filter** applies to the voucher date.
10. **Accounts is read-only.** Marking vouchers as *paid* isn't in the brief and would be the natural next feature. The **Print** button (Save as PDF from the browser) covers the optional "download or print".
11. **Voucher numbers** are `EV-<year>-<sequence>` from one global sequence. They are unique across years, and deleting a draft can leave a gap, which is normal for sequence-based numbering.

---

## Production build

```bash
npm run build              # compiles the API to server/dist and the client to client/dist
NODE_ENV=production npm start
```

With `NODE_ENV=production`, the API serves the built React app from the same origin, so one process and one port serve everything. Set a strong `JWT_SECRET` and a real `DATABASE_URL`, and run `npm run db:migrate` on deploy. Session cookies are `Secure` in production; serve over HTTPS, or set `COOKIE_SECURE=false` only for a plain-HTTP internal test.
