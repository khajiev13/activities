import axios, { type InternalAxiosRequestConfig } from 'axios';
import { refreshAccessToken } from './authApi';
import { getAccessToken } from './tokenStore';

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/',
  withCredentials: true,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json', accept: 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  else config.headers.delete('Authorization');
  return config;
});

client.interceptors.response.use(
  (response) => {
    if (response.data?.error === 0) response.data = response.data.data;
    return response;
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const request = error.config as RetryableRequest | undefined;
    if (!request || error.response?.status !== 401 || request._retry) {
      return Promise.reject(error);
    }
    const path = new URL(request.url ?? '', 'http://eventopia.invalid').pathname;
    if (path.startsWith('/api/auth/')) return Promise.reject(error);

    request._retry = true;
    // A delayed 401 can arrive after another request already refreshed this token.
    const currentToken = getAccessToken();
    if (currentToken && request.headers.get('Authorization') !== `Bearer ${currentToken}`) {
      return client(request);
    }
    const token = await refreshAccessToken();
    if (!token) return Promise.reject(error);
    return client(request);
  },
);

export default client;
