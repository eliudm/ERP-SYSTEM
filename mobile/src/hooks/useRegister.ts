import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { salesApi } from '../api/sales.api';

const REGISTER_KEY = 'nexora-pos-register';

interface RegisterState {
  isOpen: boolean;
  openedAt?: string;
  openingFloat?: number;
  lastClosedAt?: string;
  sessionId?: string;   // backend POS session id
  sessionRef?: string;  // e.g. "MAIN/00001"
}

export const useRegister = () => {
  const [state, setState] = useState<RegisterState>({ isOpen: false });
  const [isLoading, setIsLoading] = useState(true);
  const [openError, setOpenError] = useState<string | null>(null);

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
    async (openingFloat: number, branchId?: string | null) => {
      setOpenError(null);
      try {
        const session = await salesApi.openPosSession(branchId);
        await persist({
          isOpen: true,
          openedAt: session.openedAt,
          openingFloat,
          sessionId: session.id,
          sessionRef: session.sessionRef,
        });
      } catch (err: any) {
        const msg: string =
          err?.response?.data?.message ??
          err?.message ??
          'Failed to open register';
        setOpenError(msg);
        throw new Error(msg);
      }
    },
    [persist],
  );

  const closeRegister = useCallback(
    async (closingNote?: string, closingCounts?: Record<string, number>) => {
      if (state.sessionId) {
        try {
          await salesApi.closePosSession(state.sessionId, {
            closingNote,
            closingCounts,
          });
        } catch {
          // best-effort — still close locally even if API call fails
        }
      }
      await persist({
        isOpen: false,
        lastClosedAt: new Date().toISOString(),
      });
    },
    [state.sessionId, persist],
  );

  return { ...state, isLoading, openError, openRegister, closeRegister };
};
