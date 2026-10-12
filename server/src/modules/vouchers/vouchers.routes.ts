import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { sendSignature } from '../../lib/send-signature.js';
import { currentUser, requireRole } from '../../middleware/authenticate.js';
import { signatureUpload } from '../../middleware/upload.js';
import { todayIso } from '../../lib/dates.js';
import { voucherIdParams } from './vouchers.schemas.js';
import * as service from './vouchers.service.js';

export const vouchersRouter = Router();

const employeeOnly = requireRole('EMPLOYEE');
const directorOnly = requireRole('DIRECTOR');

// Collection ---------------------------------------------------------------

vouchersRouter.get('/', async (req, res) => {
  res.json(await service.listVouchers(currentUser(req), req.query));
});

// Declared before "/:id" so "export" isn't read as an id.
vouchersRouter.get('/export', requireRole('DIRECTOR', 'ACCOUNTS'), async (req, res) => {
  const { csv, total, truncated } = await service.exportVouchersCsv(currentUser(req), req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vouchers-${todayIso()}.csv"`);
  res.setHeader('X-Total-Count', String(total));
  if (truncated) res.setHeader('X-Export-Truncated', 'true');
  res.send(csv);
});

vouchersRouter.post('/', employeeOnly, signatureUpload, async (req, res) => {
  const voucher = await service.createVoucher(currentUser(req), req.body, req.file);
  res.status(201).location(`/api/vouchers/${voucher.id}`).json({ voucher });
});

// Single voucher --------------------------------------------------------------

vouchersRouter.get('/:id', async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  res.json({ voucher: await service.getVoucher(currentUser(req), id) });
});

vouchersRouter.patch('/:id', employeeOnly, signatureUpload, async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  res.json({ voucher: await service.updateVoucher(currentUser(req), id, req.body, req.file) });
});

vouchersRouter.delete('/:id', employeeOnly, async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  await service.deleteVoucher(currentUser(req), id);
  res.status(204).end();
});

// Workflow actions -----------------------------------------------------------

vouchersRouter.post('/:id/submit', employeeOnly, async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  res.json({ voucher: await service.submitVoucher(currentUser(req), id) });
});

vouchersRouter.post('/:id/duplicate', employeeOnly, async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  const voucher = await service.duplicateVoucher(currentUser(req), id);
  res.status(201).location(`/api/vouchers/${voucher.id}`).json({ voucher });
});

vouchersRouter.post('/:id/approve', directorOnly, signatureUpload, async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  res.json({ voucher: await service.approveVoucher(currentUser(req), id, req.body, req.file) });
});

vouchersRouter.post('/:id/reject', directorOnly, async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  res.json({ voucher: await service.rejectVoucher(currentUser(req), id, req.body) });
});

// Signature images (access-checked like the voucher itself) -------------------

vouchersRouter.get('/:id/signatures/:kind', async (req, res) => {
  const { id } = voucherIdParams.parse(req.params);
  const kind = req.params.kind;
  if (kind !== 'employee' && kind !== 'director') throw HttpError.notFound('Unknown signature type.');
  await sendSignature(res, await service.getSignatureFile(currentUser(req), id, kind));
});
