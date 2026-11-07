import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let client: typeof import('../client')['default'];
let auth: typeof import('../authApi');
let tokens: typeof import('../tokenStore');
let transportInterceptor: number | undefined;

const user = {
  uid: 'user-1', username: 'player', first_name: 'Player', last_name: null, image_url: null,
};

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { config, data, status, statusText: status === 401 ? '' : 'OK', headers: new AxiosHeaders() };
}

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined,
    response(config, { requestId: 'request-1', error: 101, message: 'Not authenticated' }, 401));
}

function success(config: InternalAxiosRequestConfig, data: unknown) {
  return response(config, { requestId: 'request-1', error: 0, data });
}

function transport(adapter: AxiosAdapter) {
  if (transportInterceptor !== undefined) client.interceptors.request.eject(transportInterceptor);
  // Replace only the transport; real-browser coverage verifies the adapter's cookie semantics.
  transportInterceptor = client.interceptors.request.use((config) => {
    config.adapter = adapter;
    return config;
  });
  client.defaults.adapter = adapter;
}

beforeEach(async () => {
  vi.resetModules();
  transportInterceptor = undefined;
  vi.stubGlobal('window', {});
  ({ default: client } = await import('../client'));
  auth = await import('../authApi');
  tokens = await import('../tokenStore');
  transport(async () => { throw new Error('Unexpected request'); });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API client', () => {
  it('shares one refresh across three parallel 401s and retries each with the new Bearer token', async () => {
    tokens.setAccessToken('expired');
    let refreshes = 0;
    const retried: string[] = [];
    transport(async (config) => {
      if (config.url === '/api/auth/refresh') {
        refreshes++;
        expect(config.headers.get('X-Requested-With')).toBe('eventopia');
        expect(config.withCredentials).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return success(config, { access_token: 'fresh' });
      }
      if (config.headers.get('Authorization') === 'Bearer expired') throw unauthorized(config);
      expect(config.headers.get('Authorization')).toBe('Bearer fresh');
      retried.push(config.url!);
      return success(config, { x: 1 });
    });

    const results = await Promise.all(['/api/one', '/api/two', '/api/three'].map((path) => client.get(path)));
    expect(refreshes).toBe(1);
    expect(retried).toEqual(['/api/one', '/api/two', '/api/three']);
    expect(results.map((result) => result.data)).toEqual([{ x: 1 }, { x: 1 }, { x: 1 }]);
    expect(tokens.getAccessToken()).toBe('fresh');
  });

  it('clears the token and preserves each original 401 when refresh fails', async () => {
    tokens.setAccessToken('expired');
    const originals: AxiosError[] = [];
    let refreshes = 0;
    transport(async (config) => {
      if (config.url === '/api/auth/refresh') {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw unauthorized(config);
      }
      const error = unauthorized(config);
      originals.push(error);
      throw error;
    });
    const results = await Promise.allSettled([client.get('/api/one'), client.get('/api/two')]);
    expect(refreshes).toBe(1);
    expect(results).toEqual(originals.map((reason) => ({ status: 'rejected', reason })));
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('retries a protected request only once when the new token is also rejected', async () => {
    let attempts = 0;
    let refreshes = 0;
    transport(async (config) => {
      if (config.url === '/api/auth/refresh') {
        refreshes++;
        return success(config, { access_token: 'fresh' });
      }
      attempts++;
      throw unauthorized(config);
    });
    await expect(client.get('/api/one')).rejects.toBeInstanceOf(AxiosError);
    expect(attempts).toBe(2);
    expect(refreshes).toBe(1);
  });

  it('does not start another refresh for a late 401 sent with the old token', async () => {
    tokens.setAccessToken('expired');
    let refreshes = 0;
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    transport(async (config) => {
      if (config.url === '/api/auth/refresh') {
        refreshes++;
        return success(config, { access_token: 'fresh' });
      }
      if (config.headers.get('Authorization') === 'Bearer expired') {
        if (config.url === '/api/late') await delayed;
        throw unauthorized(config);
      }
      return success(config, { x: 1 });
    });
    const late = client.get('/api/late');
    await client.get('/api/first');
    release();
    await late;
    expect(refreshes).toBe(1);
  });

  it('never refreshes recursively on any auth endpoint 401', async () => {
    const requested: string[] = [];
    transport(async (config) => {
      requested.push(config.url!);
      throw unauthorized(config);
    });
    for (const path of ['/api/auth/otp/request', '/api/auth/otp/verify', '/api/auth/telegram/webapp', '/api/auth/refresh', '/api/auth/logout']) {
      await expect(client.post(path)).rejects.toBeInstanceOf(AxiosError);
    }
    expect(requested).toHaveLength(5);
  });

  it('unwraps only successful envelopes and keeps other payloads intact', async () => {
    const payloads = [
      { requestId: 'request-1', error: 0, data: { x: 1 } },
      { requestId: 'request-2', error: 104, message: 'Forbidden' },
      { plain: true },
    ];
    transport(async (config) => response(config, payloads.shift()));
    expect((await client.get('/api/one')).data).toEqual({ x: 1 });
    expect((await client.get('/api/two')).data).toEqual({ requestId: 'request-2', error: 104, message: 'Forbidden' });
    expect((await client.get('/api/three')).data).toEqual({ plain: true });
  });

  it('uses the configured API origin, credentials and current memory token', async () => {
    expect(client.defaults.baseURL).toBe('/');
    tokens.setAccessToken('memory-token');
    transport(async (config) => {
      expect(config.withCredentials).toBe(true);
      expect(config.headers.get('Authorization')).toBe('Bearer memory-token');
      return success(config, {});
    });
    await client.get('/api/users/me');
  });
});

describe('authentication API', () => {
  it('sends the OTP payloads and keeps the verified access token in memory', async () => {
    const requested: unknown[] = [];
    transport(async (config) => {
      requested.push([config.url, JSON.parse(config.data)]);
      return success(config, config.url === '/api/auth/otp/request'
        ? { retry_after_seconds: 60 } : { access_token: 'verified', user });
    });
    expect(await auth.requestOtp('+998900000001')).toEqual({ retry_after_seconds: 60 });
    expect(await auth.verifyOtp('+998900000001', '001234')).toEqual({ access_token: 'verified', user });
    expect(requested).toEqual([
      ['/api/auth/otp/request', { phone: '+998900000001' }],
      ['/api/auth/otp/verify', { phone: '+998900000001', code: '001234' }],
    ]);
    expect(tokens.getAccessToken()).toBe('verified');
  });

  it('adds the CSRF header on every browser refresh, including direct concurrent callers', async () => {
    let refreshes = 0;
    transport(async (config) => {
      expect(config.url).toBe('/api/auth/refresh');
      expect(config.method).toBe('post');
      expect(config.headers.get('X-Requested-With')).toBe('eventopia');
      expect(config.withCredentials).toBe(true);
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return success(config, { access_token: 'refreshed' });
    });
    expect(await Promise.all([auth.refreshAccessToken(), auth.refreshAccessToken()])).toEqual(['refreshed', 'refreshed']);
    expect(refreshes).toBe(1);
    expect(await auth.refreshAccessToken()).toBe('refreshed');
    expect(refreshes).toBe(2);
  });

  it('uses raw Telegram initData for refresh and avoids credentials and cookie refresh', async () => {
    const initData = 'query_id=unchanged%20raw&hash=example';
    vi.stubGlobal('window', { Telegram: { WebApp: { initData } } });
    expect(auth.isInTelegram()).toBe(true);
    transport(async (config) => {
      expect(config.url).toBe('/api/auth/telegram/webapp');
      expect(JSON.parse(config.data)).toEqual({ init_data: initData });
      expect(config.withCredentials).toBe(false);
      return success(config, { access_token: 'telegram', user });
    });
    expect(await auth.refreshAccessToken()).toBe('telegram');
    expect(tokens.getAccessToken()).toBe('telegram');
  });

  it('returns null and clears the memory token on a failed refresh', async () => {
    tokens.setAccessToken('expired');
    transport(async (config) => { throw unauthorized(config); });
    expect(await auth.refreshAccessToken()).toBeNull();
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('logs out with the CSRF header and clears memory even when logout fails', async () => {
    tokens.setAccessToken('logged-in');
    transport(async (config) => {
      expect(config.url).toBe('/api/auth/logout');
      expect(config.headers.get('X-Requested-With')).toBe('eventopia');
      throw unauthorized(config);
    });
    await expect(auth.logout()).rejects.toBeInstanceOf(AxiosError);
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('notifies token subscribers and supports unsubscribe', () => {
    const changes: (string | null)[] = [];
    const unsubscribe = tokens.onChange(() => changes.push(tokens.getAccessToken()));
    tokens.setAccessToken('first');
    tokens.setAccessToken(null);
    unsubscribe();
    tokens.setAccessToken('second');
    expect(changes).toEqual(['first', null]);
  });

  it('never persists auth data or logs failed requests', async () => {
    class BrowserStorage { setItem() {} }
    vi.stubGlobal('Storage', BrowserStorage);
    vi.stubGlobal('localStorage', new BrowserStorage());
    vi.stubGlobal('sessionStorage', new BrowserStorage());
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const logs = ['log', 'error', 'warn', 'info', 'debug'].map((method) => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
    transport(async (config) => {
      if (config.url === '/api/auth/otp/verify') return success(config, { access_token: 'secret', user });
      throw unauthorized(config);
    });
    await auth.verifyOtp('+998900000001', '001234');
    await auth.refreshAccessToken();
    expect(storage).not.toHaveBeenCalled();
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });
});

describe('logout and Telegram transport regressions', () => {
  it('finishes an outstanding browser refresh before revoking its rotated cookie and ignores its token', async () => {
    tokens.setAccessToken('before-logout');
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const order: string[] = [];
    let cookie = 'original';
    transport(async (config) => {
      if (config.url === '/api/auth/refresh') {
        started();
        await pending;
        cookie = 'rotated';
        order.push('refresh-response');
        return success(config, { access_token: 'stale-refresh' });
      }
      order.push(`logout:${cookie}`);
      cookie = '';
      return success(config, {});
    });
    const refresh = auth.refreshAccessToken();
    await began;
    const logout = auth.logout();
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const [token] = await Promise.all([refresh, logout]);
    expect(token).toBeNull();
    expect(order).toEqual(['refresh-response', 'logout:rotated']);
    expect(cookie).toBe('');
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('does not start a new refresh while browser logout is outstanding', async () => {
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const paths: string[] = [];
    transport(async (config) => {
      paths.push(config.url!);
      if (config.url === '/api/auth/logout') {
        started();
        await pending;
        return success(config, {});
      }
      return success(config, { access_token: 'unexpected' });
    });
    const logout = auth.logout();
    await began;
    const token = await auth.refreshAccessToken();
    release();
    await logout;
    expect(token).toBeNull();
    expect(paths).toEqual(['/api/auth/logout']);
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('ignores a deferred Mini App refresh after logout without using the cookie logout endpoint', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'synthetic-init-data' } } });
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const paths: string[] = [];
    transport(async (config) => {
      paths.push(config.url!);
      if (config.url === '/api/auth/telegram/webapp') {
        started();
        await pending;
        return success(config, { access_token: 'stale-mini-app', user });
      }
      return success(config, {});
    });
    const refresh = auth.refreshAccessToken();
    await began;
    const logout = auth.logout();
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const [token] = await Promise.all([refresh, logout]);
    expect(token).toBeNull();
    expect(paths).toEqual(['/api/auth/telegram/webapp']);
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('does not restore a deferred direct Mini App login after logout', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'synthetic-init-data' } } });
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    transport(async (config) => {
      if (config.url === '/api/auth/telegram/webapp') {
        started();
        await pending;
        return success(config, { access_token: 'stale-login', user });
      }
      return success(config, {});
    });
    const login = auth.loginWithWebApp('synthetic-init-data');
    await began;
    await auth.logout();
    release();
    await login;
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('selects an actual fetch Request with credentials omit for Mini App exchange', async () => {
    client.interceptors.request.eject(transportInterceptor!);
    client.defaults.adapter = async (config) => success(config, { access_token: 'wrong-default-adapter', user });
    client.defaults.baseURL = 'http://synthetic.invalid';
    const requests: Request[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      requests.push(request);
      return new Response(JSON.stringify({ requestId: 'synthetic', error: 0, data: { access_token: 'synthetic', user } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    });
    await auth.loginWithWebApp('synthetic-init-data');
    expect(requests).toHaveLength(1);
    expect(requests[0].credentials).toBe('omit');
    expect(requests[0].url).toBe('http://synthetic.invalid/api/auth/telegram/webapp');
  });
});
