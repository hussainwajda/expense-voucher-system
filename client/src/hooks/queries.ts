import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { dashboardApi, metaApi, vouchersApi } from '@/api/endpoints';
import type { VoucherQuery } from '@/api/types';

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: metaApi.get, staleTime: Infinity });
}

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
}

export function useVoucherList(query: VoucherQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['vouchers', query],
    queryFn: ({ signal }) => vouchersApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled,
  });
}

export function useVoucher(id: number) {
  return useQuery({
    queryKey: ['voucher', id],
    queryFn: async () => (await vouchersApi.get(id)).voucher,
    enabled: Number.isInteger(id) && id > 0,
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

/** Refresh everything that shows voucher data after a change. */
export function useRefreshVoucherData() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['vouchers'] }),
      qc.invalidateQueries({ queryKey: ['voucher'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }, [qc]);
}
