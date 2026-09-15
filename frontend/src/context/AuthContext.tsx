import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { onForcedLogout, tokenStore } from '@/api/client';
import { authApi } from '@/api/endpoints';
import type { AuthUser, Role } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isCustomer: boolean;
  /** Employee ke assigned restaurant ids */
  assignedRestaurantIds: number[];
  login(email: string, password: string): Promise<AuthUser>;
  register(body: { fullName: string; email: string; phone?: string; password: string }): Promise<AuthUser>;
  logout(): Promise<void>;
  patchUser(patch: Partial<AuthUser>): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const raw = tokenStore.rawUser;
  const token = tokenStore.access;
  if (!raw || !token) return null;

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    // token localStorage se hi authoritative maano (refresh ke baad naya hota hai)
    return { ...parsed, accessToken: token };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState(false);

  /* refresh fail ho jaye to client forceLogout() call karta hai */
  useEffect(() => onForcedLogout(() => setUser(null)), []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authApi.login({ email, password });
      tokenStore.save(data.accessToken, data.refreshToken, data);
      setUser(data);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (body: { fullName: string; email: string; phone?: string; password: string }) => {
      setIsLoading(true);
      try {
        const data = await authApi.register(body);
        tokenStore.save(data.accessToken, data.refreshToken, data);
        setUser(data);
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh;
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // server par revoke fail ho to bhi local logout karna hai
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const patchUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      tokenStore.save(next.accessToken, next.refreshToken, next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? null;
    return {
      user,
      isLoading,
      isAuthenticated: user !== null,
      role,
      isAdmin: role === 'Admin',
      isEmployee: role === 'Employee',
      isCustomer: role === 'Customer',
      assignedRestaurantIds: user?.assignedRestaurants?.map((a) => a.restaurantId) ?? [],
      login,
      register,
      logout,
      patchUser,
    };
  }, [user, isLoading, login, register, logout, patchUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider.');
  return ctx;
}
