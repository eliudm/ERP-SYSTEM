import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { authApi, AuthUser } from '../api/auth.api';
import { TOKEN_KEY } from '../api/client';
import { storage } from '../utils/storage';

interface SessionContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // PIN-based quick unlock (see src/modules/auth/dto/pin.dto.ts on the
  // backend) — a lighter re-auth for an already-signed-in session, used
  // for the POS lock screen instead of a full email/password login.
  hasPin: boolean;
  isLocked: boolean;
  setPin: (pin: string) => Promise<void>;
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

const USER_KEY = 'nexora-auth-user';
const HAS_PIN_KEY = 'nexora-has-pin';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser, storedHasPin] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(USER_KEY),
          storage.getItem(HAS_PIN_KEY),
        ]);
        if (token && storedUser) {
          setUser(JSON.parse(storedUser) as AuthUser);
          const pinEnabled = storedHasPin === 'true';
          setHasPin(pinEnabled);
          // A PIN set earlier means every fresh app open — not just a
          // resume from background — should require it, same as leaving
          // the register locked between shifts.
          setIsLocked(pinEnabled);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { access_token, user: authUser } = await authApi.login(
      email,
      password,
    );
    await Promise.all([
      storage.setItem(TOKEN_KEY, access_token),
      storage.setItem(USER_KEY, JSON.stringify(authUser)),
    ]);
    setUser(authUser);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      storage.deleteItem(TOKEN_KEY),
      storage.deleteItem(USER_KEY),
      storage.deleteItem(HAS_PIN_KEY),
    ]);
    setUser(null);
    setHasPin(false);
    setIsLocked(false);
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await authApi.setPin(pin);
    await storage.setItem(HAS_PIN_KEY, 'true');
    setHasPin(true);
  }, []);

  const lock = useCallback(() => {
    if (hasPin) setIsLocked(true);
  }, [hasPin]);

  const unlockWithPin = useCallback(async (pin: string) => {
    try {
      const { valid } = await authApi.verifyPin(pin);
      if (valid) setIsLocked(false);
      return valid;
    } catch {
      return false;
    }
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
        hasPin,
        isLocked,
        setPin,
        lock,
        unlockWithPin,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
};
