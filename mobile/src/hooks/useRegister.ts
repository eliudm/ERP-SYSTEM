import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';

const REGISTER_KEY = 'nexora-pos-register';

interface RegisterState {
  isOpen: boolean;
  openedAt?: string;
  openingFloat?: number;
  lastClosedAt?: string;
}

// Mirrors the web POS's register concept (frontend/src/pages/sales/pos/POSPage.tsx,
// via useAuthStore's posVerified/posLastClosedDate) — there's no backend model for
// this, it's a per-device reconciliation aid on top of the real sales data.
export const useRegister = () => {
  const [state, setState] = useState<RegisterState>({ isOpen: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(REGISTER_KEY);
        if (raw) setState(JSON.parse(raw) as RegisterState);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: RegisterState) => {
    setState(next);
    await storage.setItem(REGISTER_KEY, JSON.stringify(next));
  }, []);

  const openRegister = useCallback(
    (openingFloat: number) =>
      persist({
        isOpen: true,
        openedAt: new Date().toISOString(),
        openingFloat,
      }),
    [persist],
  );

  const closeRegister = useCallback(
    () =>
      persist({
        isOpen: false,
        lastClosedAt: new Date().toISOString(),
      }),
    [persist],
  );

  return { ...state, isLoading, openRegister, closeRegister };
};
