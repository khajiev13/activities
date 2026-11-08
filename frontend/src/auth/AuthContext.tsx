import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as authApi from '../api/authApi';
import type { AuthUser } from '../api/authApi';
import client from '../api/client';
import { getAccessToken, onChange } from '../api/tokenStore';

type AuthState = { user: AuthUser | null; status: 'loading' | 'authenticated' | 'anonymous'; telegramIssue: authApi.TelegramLoginIssue | null };
type AuthContextValue = AuthState & {
  login: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  retryTelegramLogin: () => Promise<boolean>;
  shareTelegramContact: () => Promise<'cancelled' | 'authenticated' | 'pending' | 'failed' | 'stale'>;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  telegramIssue: null,
  login: async () => false,
  logout: async () => {},
  retryTelegramLogin: async () => false,
  shareTelegramContact: async () => 'cancelled',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading', telegramIssue: null });
  const generation = useRef(0);

  useEffect(() => {
    let mounted = true;
    const version = ++generation.current;
    const unsubscribe = onChange((token) => {
      if (!token) {
        generation.current++;
        setState({ user: null, status: 'anonymous', telegramIssue: authApi.getTelegramLoginIssue() });
      }
    });
    (async () => {
      try {
        const token = await authApi.refreshAccessToken();
        if (!mounted || version !== generation.current) return;
        if (!token) {
          setState({ user: null, status: 'anonymous', telegramIssue: authApi.getTelegramLoginIssue() });
          return;
        }
        const response = await client.get<AuthUser>('/api/users/me');
        if (mounted && version === generation.current && getAccessToken()) {
          setState({ user: response.data, status: 'authenticated', telegramIssue: null });
        }
      } catch {
        if (mounted && version === generation.current) {
          setState({ user: null, status: 'anonymous', telegramIssue: authApi.isInTelegram() ? authApi.getTelegramLoginIssue() ?? 'network' : null });
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
    setState({ user: result.user, status: 'authenticated', telegramIssue: null });
    return true;
  }, []);

  const authenticateTelegram = useCallback(async (version: number, afterContact: boolean) => {
    if (!authApi.isInTelegram()) return false;
    setState({ user: null, status: 'loading', telegramIssue: null });
    // The native callback can arrive before the bot has persisted the verified contact.
    for (let attempt = 0; attempt < (afterContact ? 5 : 1); attempt++) {
      if (afterContact) await new Promise(resolve => window.setTimeout(resolve, 1000));
      if (version !== generation.current) return false;
      const token = await authApi.refreshAccessToken();
      if (version !== generation.current) return false;
      if (token) {
        try {
          const response = await client.get<AuthUser>('/api/users/me');
          if (version !== generation.current || !getAccessToken()) return false;
          setState({ user: response.data, status: 'authenticated', telegramIssue: null });
          return true;
        } catch {
          if (version !== generation.current) return false;
          setState({ user: null, status: 'anonymous', telegramIssue: 'network' });
          return false;
        }
      }
      if (authApi.getTelegramLoginIssue() !== 'phone_required') break;
    }
    if (version === generation.current) {
      setState({ user: null, status: 'anonymous', telegramIssue: authApi.getTelegramLoginIssue() });
    }
    return false;
  }, []);

  const retryTelegramLogin = useCallback(() => authenticateTelegram(++generation.current, false), [authenticateTelegram]);
  const shareTelegramContact = useCallback(async () => {
    const version = ++generation.current;
    const shared = await authApi.requestTelegramContact();
    if (version !== generation.current) return 'stale' as const;
    if (!shared) return 'cancelled' as const;
    const authenticated = await authenticateTelegram(version, true);
    if (version !== generation.current) return 'stale' as const;
    if (authenticated) return 'authenticated' as const;
    return authApi.getTelegramLoginIssue() === 'phone_required' ? 'pending' as const : 'failed' as const;
  }, [authenticateTelegram]);

  const logout = useCallback(async () => {
    generation.current++;
    setState({ user: null, status: 'anonymous', telegramIssue: authApi.getTelegramLoginIssue() });
    await authApi.logout();
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout, retryTelegramLogin, shareTelegramContact }}>{children}</AuthContext.Provider>;
}
