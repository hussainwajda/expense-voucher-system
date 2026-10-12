import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { ApiError, setUnauthorizedHandler } from '@/api/client';
import { authApi } from '@/api/endpoints';
import type { User } from '@/api/types';

interface AuthContextValue {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous' | 'error';
  retry: () => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Replace the cached user, e.g. after uploading a signature. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // The session lives in an httpOnly cookie, so asking the API is the only way to know who we are.
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await authApi.me()).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Swap the signed-in user and drop everything cached for the previous one. The ['me'] query itself
  // is kept (not cleared) because this provider is subscribed to it.
  const switchUser = useCallback(
    (user: User | null) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      qc.setQueryData(['me'], user);
    },
    [qc],
  );

  useEffect(() => {
    // Any 401 from the API means the session ended (expired or logged out elsewhere).
    setUnauthorizedHandler(() => switchUser(null));
    return () => setUnauthorizedHandler(null);
  }, [switchUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user } = await authApi.login(email, password);
      switchUser(user);
      return user;
    },
    [switchUser],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    switchUser(null);
  }, [switchUser]);

  const setUser = useCallback((user: User) => qc.setQueryData(['me'], user), [qc]);

  const value = useMemo<AuthContextValue>(() => {
    const status = me.isPending ? 'loading' : me.isError ? 'error' : me.data ? 'authenticated' : 'anonymous';
    return { user: me.data ?? null, status, retry: () => void me.refetch(), login, logout, setUser };
  }, [me, login, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For components rendered behind <RequireAuth>, where a user is guaranteed. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called outside an authenticated route');
  return user;
}
