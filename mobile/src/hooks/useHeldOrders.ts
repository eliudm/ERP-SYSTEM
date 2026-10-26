import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';

export interface HeldOrderLine {
  productId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  taxRate: number;
  quantity: number;
}

export interface HeldOrder {
  id: string;
  reference: string;
  createdAt: string;
  lines: HeldOrderLine[];
  customerId?: string;
  customerName?: string;
}

const HELD_ORDERS_KEY = 'nexora-pos-held-orders';
const REF_SEQ_KEY = 'nexora-pos-order-seq';

// Local "park a sale, resume it later" queue — mirrors the reference app's
// Orders tab (Load Order / Review). There's no backend concept of a draft
// order at this granularity, so this lives entirely on-device, same as the
// cash-register state in useRegister.
export const useHeldOrders = () => {
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(HELD_ORDERS_KEY);
        if (raw) setOrders(JSON.parse(raw) as HeldOrder[]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: HeldOrder[]) => {
    setOrders(next);
    await storage.setItem(HELD_ORDERS_KEY, JSON.stringify(next));
  }, []);

  const nextReference = useCallback(async () => {
    const raw = await storage.getItem(REF_SEQ_KEY);
    const seq = (raw ? parseInt(raw, 10) : 0) + 1;
    await storage.setItem(REF_SEQ_KEY, String(seq));
    return `Order ${String(seq).padStart(4, '0')}`;
  }, []);

  const parkOrder = useCallback(
    async (lines: HeldOrderLine[], customer?: { id: string; name: string }) => {
      const reference = await nextReference();
      const order: HeldOrder = {
        id: `held-${Date.now()}`,
        reference,
        createdAt: new Date().toISOString(),
        lines,
        customerId: customer?.id,
        customerName: customer?.name,
      };
      await persist([order, ...orders]);
      return order;
    },
    [orders, persist, nextReference],
  );

  const removeOrder = useCallback(
    (id: string) => persist(orders.filter((o) => o.id !== id)),
    [orders, persist],
  );

  return { orders, isLoading, parkOrder, removeOrder };
};
