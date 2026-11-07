import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as authApi from '../api/authApi';
import type { AuthUser } from '../api/authApi';
import client from '../api/client';
import { getAccessToken, onChange } from '../api/tokenStore';

type AuthState = { user: AuthUser | null; status: 'loading' | 'authenticated' | 'anonymous' };
type AuthContextValue = AuthState & {
  login: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading' });
  const generation = useRef(0);

  useEffect(() => {
    let mounted = true;
    const version = ++generation.current;
    const unsubscribe = onChange((token) => {
      if (!token) {
        generation.current++;
        setState({ user: null, status: 'anonymous' });
      }
    });
    (async () => {
      try {
        const token = await authApi.refreshAccessToken();
        if (!mounted || version !== generation.current) return;
        if (!token) {
          setState({ user: null, status: 'anonymous' });
          return;
        }
        const response = await client.get<AuthUser>('/api/users/me');
        if (mounted && version === generation.current && getAccessToken()) {
          setState({ user: response.data, status: 'authenticated' });
        }
      } catch {
        if (mounted && version === generation.current) {
          setState({ user: null, status: 'anonymous' });
        }
      }
    })();
    return () => {
      mounted = false;
      generation.current++;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (phone: string, code: string) => {
    const version = ++generation.current;
    const result = await authApi.verifyOtp(phone, code);
    if (version !== generation.current || !getAccessToken()) return false;
    setState({ user: result.user, status: 'authenticated' });
    return true;
  }, []);

  const logout = useCallback(async () => {
    generation.current++;
    setState({ user: null, status: 'anonymous' });
    await authApi.logout();
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}
