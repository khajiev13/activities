import axios from 'axios';
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

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  requestContact?: (callback: (shared: boolean) => void) => void;
};
type TelegramWindow = Window & { Telegram?: { WebApp?: TelegramWebApp } };

function getWebApp(): TelegramWebApp | undefined {
  return typeof window === 'undefined' ? undefined : (window as TelegramWindow).Telegram?.WebApp;
}

export function initializeTelegramWebApp(): void {
  if (!isInTelegram()) return;
  const webApp = getWebApp();
  // Older clients may omit optional methods or reject a native capability.
  for (const method of ['ready', 'expand'] as const) {
    try { webApp?.[method]?.(); } catch { /* Authentication remains available. */ }
  }
}

export function requestTelegramContact(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const webApp = getWebApp();
    if (!isInTelegram() || !webApp?.requestContact || webApp.isVersionAtLeast?.('6.9') === false) {
      reject(new Error('Contact sharing is unavailable. Update Telegram and reopen this app.'));
      return;
    }
    try { webApp.requestContact(resolve); } catch { reject(new Error('Unable to open contact sharing. Please try again in Telegram.')); }
  });
}

export type TelegramLoginIssue = 'phone_required' | 'expired' | 'network';
let telegramLoginIssue: TelegramLoginIssue | null = null;
export function getTelegramLoginIssue(): TelegramLoginIssue | null {
  return telegramLoginIssue;
}

function getInitData(): string {
  return getWebApp()?.initData ?? '';
}

export function isInTelegram(): boolean {
  return getInitData().length > 0;
}

export async function requestOtp(phone: string): Promise<{ retry_after_seconds: number }> {
  const response = await client.post<{ retry_after_seconds: number }>('/api/auth/otp/request', { phone });
  return response.data;
}

const verifyFlights = new Set<Promise<LoginResult>>();

export function verifyOtp(phone: string, code: string): Promise<LoginResult> {
  if (logoutFlight) return Promise.reject(new Error('Logout is in progress'));
  const version = sessionVersion;
  const flight = (async () => {
    const response = await client.post<LoginResult>('/api/auth/otp/verify', { phone, code });
    if (version === sessionVersion && !logoutFlight) setAccessToken(response.data.access_token);
    return response.data;
  })().finally(() => { verifyFlights.delete(flight); });
  verifyFlights.add(flight);
  return flight;
}

let sessionVersion = 0;
let logoutFlight: Promise<void> | null = null;

export async function loginWithWebApp(initData: string): Promise<LoginResult> {
  const version = sessionVersion;
  try {
    const response = await client.post<LoginResult>('/api/auth/telegram/webapp', { init_data: initData }, {
      // XHR still sends same-origin cookies when withCredentials is false.
      adapter: 'fetch',
      withCredentials: false,
    });
    if (version === sessionVersion && !logoutFlight) {
      telegramLoginIssue = null;
      setAccessToken(response.data.access_token);
    }
    return response.data;
  } catch (cause) {
    if (version === sessionVersion && !logoutFlight) {
      telegramLoginIssue = axios.isAxiosError(cause) && cause.response?.data?.error === 103
        ? 'phone_required'
        : axios.isAxiosError(cause) && cause.response?.status === 401 ? 'expired' : 'network';
    }
    throw cause;
  }
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
  const pendingVerifications = [...verifyFlights];
  const telegram = isInTelegram();
  logoutFlight = (async () => {
    try {
      if (!telegram) {
        // Let cookie-issuing requests finish before revoking the browser session.
        if (pendingRefresh) await pendingRefresh;
        await Promise.allSettled(pendingVerifications);
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
