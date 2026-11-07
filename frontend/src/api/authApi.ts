import client from './client';
import { setAccessToken } from './tokenStore';

export interface AuthUser {
  uid: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

export interface LoginResult {
  access_token: string;
  user: AuthUser;
}

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initData?: string } };
};

function getInitData(): string {
  return typeof window === 'undefined' ? '' : (window as TelegramWindow).Telegram?.WebApp?.initData ?? '';
}

export function isInTelegram(): boolean {
  return getInitData().length > 0;
}

export async function requestOtp(phone: string): Promise<{ retry_after_seconds: number }> {
  const response = await client.post<{ retry_after_seconds: number }>('/api/auth/otp/request', { phone });
  return response.data;
}

export async function verifyOtp(phone: string, code: string): Promise<LoginResult> {
  const response = await client.post<LoginResult>('/api/auth/otp/verify', { phone, code });
  setAccessToken(response.data.access_token);
  return response.data;
}

let sessionVersion = 0;
let logoutFlight: Promise<void> | null = null;

export async function loginWithWebApp(initData: string): Promise<LoginResult> {
  const version = sessionVersion;
  const response = await client.post<LoginResult>('/api/auth/telegram/webapp', { init_data: initData }, {
    // XHR still sends same-origin cookies when withCredentials is false.
    adapter: 'fetch',
    withCredentials: false,
  });
  if (version === sessionVersion && !logoutFlight) setAccessToken(response.data.access_token);
  return response.data;
}

let refreshFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (logoutFlight) return Promise.resolve(null);
  if (!refreshFlight) {
    const version = sessionVersion;
    refreshFlight = (async () => {
      try {
        if (isInTelegram()) {
          const result = await loginWithWebApp(getInitData());
          return version === sessionVersion ? result.access_token : null;
        }
        const response = await client.post<{ access_token: string }>('/api/auth/refresh', undefined, {
          headers: { 'X-Requested-With': 'eventopia' },
        });
        if (version !== sessionVersion) return null;
        setAccessToken(response.data.access_token);
        return response.data.access_token;
      } catch {
        if (version === sessionVersion) setAccessToken(null);
        return null;
      }
    })().finally(() => { refreshFlight = null; });
  }
  return refreshFlight;
}

export function logout(): Promise<void> {
  if (logoutFlight) return logoutFlight;
  sessionVersion++;
  setAccessToken(null);
  const pendingRefresh = refreshFlight;
  const telegram = isInTelegram();
  logoutFlight = (async () => {
    try {
      if (!telegram) {
        // Let any refresh cookie rotation finish before revoking that session.
        if (pendingRefresh) await pendingRefresh;
        await client.post('/api/auth/logout', undefined, {
          headers: { 'X-Requested-With': 'eventopia' },
        });
      }
    } finally {
      setAccessToken(null);
    }
  })().finally(() => { logoutFlight = null; });
  return logoutFlight;
}
