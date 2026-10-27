import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '../utils/storage';
import { salesApi } from '../api/sales.api';

export interface OfflineSaleLine {
  productId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

export type OfflineSaleStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineSale {
  id: string; // also sent to the backend as clientRef
  reference: string; // "OFFLINE-0007"
  createdAt: string;
  lines: OfflineSaleLine[];
  customerId: string;
  customerName: string;
  paymentMethod: string; // never MOBILE_MONEY — that path stays online-only
  warehouseId?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: OfflineSaleStatus;
  error?: string;
  invoiceId?: string; // set once create() succeeds, even if approve() hasn't yet
  invoiceNo?: string; // set once fully synced
}

const OFFLINE_SALES_KEY = 'nexora-pos-offline-sales';
const REF_SEQ_KEY = 'nexora-pos-offline-sale-seq';

const ALREADY_APPROVED_PATTERN = /already (APPROVED|PAID|SENT)/i;

// Local "sold while offline, sync when back online" queue — same shape as
// useHeldOrders.ts (local-only state with no backend equivalent until it
// syncs). Each entry becomes a real draft→approved invoice once syncAll()
// can reach the server; the clientRef makes retrying that safe (see
// InvoicesService.create() on the backend).
export const useOfflineSales = () => {
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const salesRef = useRef<OfflineSale[]>([]);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(OFFLINE_SALES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as OfflineSale[];
          salesRef.current = parsed;
          setSales(parsed);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: OfflineSale[]) => {
    salesRef.current = next;
    setSales(next);
    await storage.setItem(OFFLINE_SALES_KEY, JSON.stringify(next));
  }, []);

  const updateOne = useCallback(
    (id: string, patch: Partial<OfflineSale>) => {
      const next = salesRef.current.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      );
      return persist(next);
    },
    [persist],
  );

  const nextReference = useCallback(async () => {
    const raw = await storage.getItem(REF_SEQ_KEY);
    const seq = (raw ? parseInt(raw, 10) : 0) + 1;
    await storage.setItem(REF_SEQ_KEY, String(seq));
    return `OFFLINE-${String(seq).padStart(4, '0')}`;
  }, []);

  const enqueue = useCallback(
    async (
      lines: OfflineSaleLine[],
      customer: { id: string; name: string },
      paymentMethod: string,
      warehouseId: string | undefined,
      totals: { subtotal: number; taxTotal: number; total: number },
    ) => {
      const reference = await nextReference();
      const sale: OfflineSale = {
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        reference,
        createdAt: new Date().toISOString(),
        lines,
        customerId: customer.id,
        customerName: customer.name,
        paymentMethod,
        warehouseId,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        status: 'pending',
      };
      await persist([sale, ...salesRef.current]);
      return sale;
    },
    [persist, nextReference],
  );

  // Runs one queued sale through create→approve, tolerating a retry that
  // partially succeeded last time (invoiceId already set, or approve()
  // failing because a prior attempt already approved it).
  const syncOne = useCallback(
    async (sale: OfflineSale) => {
      await updateOne(sale.id, { status: 'syncing', error: undefined });
      try {
        let invoiceId = sale.invoiceId;
        let invoiceNo = sale.invoiceNo;

        if (!invoiceId) {
          const invoice = await salesApi.createInvoice({
            customerId: sale.customerId,
            invoiceDate: sale.createdAt,
            paymentMethod: sale.paymentMethod,
            clientRef: sale.id,
            items: sale.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
            })),
          });
          invoiceId = invoice.id;
          invoiceNo = invoice.invoiceNo;
          await updateOne(sale.id, { invoiceId, invoiceNo });
        }

        try {
          await salesApi.approveInvoice(invoiceId, {
            warehouseId: sale.warehouseId,
            paymentMethod: sale.paymentMethod,
          });
        } catch (approveErr: any) {
          const message: string = approveErr?.response?.data?.message ?? '';
          if (ALREADY_APPROVED_PATTERN.test(message)) {
            // A previous sync attempt already got this far — not a failure.
          } else {
            throw approveErr;
          }
        }

        await updateOne(sale.id, { status: 'synced', invoiceId, invoiceNo });
      } catch (err: any) {
        const message =
          err?.response?.data?.message ?? err?.message ?? 'Sync failed.';
        await updateOne(sale.id, {
          status: 'failed',
          error: Array.isArray(message) ? message.join(', ') : message,
        });
      }
    },
    [updateOne],
  );

  const syncAll = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const toSync = salesRef.current.filter(
        (s) => s.status === 'pending' || s.status === 'failed',
      );
      for (const sale of toSync) {
        await syncOne(sale);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [syncOne]);

  const retryOne = useCallback(
    (id: string) => {
      const sale = salesRef.current.find((s) => s.id === id);
      if (sale) return syncOne(sale);
      return Promise.resolve();
    },
    [syncOne],
  );

  const clearSynced = useCallback(
    () => persist(salesRef.current.filter((s) => s.status !== 'synced')),
    [persist],
  );

  const pendingCount = sales.filter(
    (s) =>
      s.status === 'pending' || s.status === 'syncing' || s.status === 'failed',
  ).length;

  return {
    sales,
    isLoading,
    pendingCount,
    enqueue,
    syncAll,
    retryOne,
    clearSynced,
  };
};
