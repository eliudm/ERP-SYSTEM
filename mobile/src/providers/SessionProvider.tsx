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
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

const USER_KEY = 'nexora-auth-user';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(USER_KEY),
        ]);
        if (token && storedUser) {
          setUser(JSON.parse(storedUser) as AuthUser);
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
    ]);
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, isLoading, signIn, signOut }}>
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
