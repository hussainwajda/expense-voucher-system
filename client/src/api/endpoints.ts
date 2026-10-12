import { api, toQueryString } from './client';
import type { Dashboard, Meta, User, VoucherDetail, VoucherList, VoucherQuery } from './types';

export type VoucherPayload = Record<string, string | number | boolean | null | undefined>;

/** Send JSON normally; switch to multipart when a signature image is attached. */
function voucherBody(fields: VoucherPayload, signature?: File | null) {
  if (!signature) return fields;
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  form.append('signature', signature);
  return form;
}

export const authApi = {
  me: () => api<{ user: User }>('/api/auth/me'),
  login: (email: string, password: string) => api<{ user: User }>('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => api<void>('/api/auth/logout', { method: 'POST' }),
};

export const metaApi = {
  get: () => api<Meta>('/api/meta'),
};

export const dashboardApi = {
  get: () => api<Dashboard>('/api/dashboard'),
};

export const vouchersApi = {
  list: (query: VoucherQuery, signal?: AbortSignal) => api<VoucherList>(`/api/vouchers${toQueryString(query)}`, { signal }),
  get: (id: number) => api<{ voucher: VoucherDetail }>(`/api/vouchers/${id}`),
  create: (fields: VoucherPayload, signature?: File | null) =>
    api<{ voucher: VoucherDetail }>('/api/vouchers', { method: 'POST', body: voucherBody(fields, signature) }),
  update: (id: number, fields: VoucherPayload, signature?: File | null) =>
    api<{ voucher: VoucherDetail }>(`/api/vouchers/${id}`, { method: 'PATCH', body: voucherBody(fields, signature) }),
  remove: (id: number) => api<void>(`/api/vouchers/${id}`, { method: 'DELETE' }),
  submit: (id: number) => api<{ voucher: VoucherDetail }>(`/api/vouchers/${id}/submit`, { method: 'POST' }),
  duplicate: (id: number) => api<{ voucher: VoucherDetail }>(`/api/vouchers/${id}/duplicate`, { method: 'POST' }),
  approve: (id: number, signature: File | null, useSavedSignature: boolean) =>
    api<{ voucher: VoucherDetail }>(`/api/vouchers/${id}/approve`, {
      method: 'POST',
      body: voucherBody({ useSavedSignature }, signature),
    }),
  reject: (id: number, reason: string) =>
    api<{ voucher: VoucherDetail }>(`/api/vouchers/${id}/reject`, { method: 'POST', body: { reason } }),
  exportUrl: (query: VoucherQuery) => {
    const { page: _page, pageSize: _pageSize, ...filters } = query;
    return `/api/vouchers/export${toQueryString(filters)}`;
  },
};

export const usersApi = {
  signatureUrl: (version: string | number) => `/api/users/me/signature?v=${version}`,
  uploadSignature: (file: File) => {
    const form = new FormData();
    form.append('signature', file);
    return api<{ user: User }>('/api/users/me/signature', { method: 'PUT', body: form });
  },
  removeSignature: () => api<{ user: User }>('/api/users/me/signature', { method: 'DELETE' }),
};
