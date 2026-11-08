import axios, { AxiosHeaders, type AxiosAdapter } from 'axios';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import client from '../client';
import { AddLocation } from '../../components/Map/MapFunctions/AddLocation';
const original = client.defaults.adapter; const originalProvider = axios.defaults.adapter;
axios.defaults.adapter = async () => { throw new Error('legacy provider disabled in test'); };
afterEach(() => { client.defaults.adapter = original; vi.useRealTimers(); vi.unstubAllGlobals(); });
function providers(timezoneFailure = false) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    expect(options.credentials).toBe('omit'); expect(options.headers).toBeUndefined();
    if (url.includes('timezoneJSON') && timezoneFailure) throw new Error('optional provider offline');
    return { ok: true, json: async () => url.includes('timezoneJSON') ? { countryCode: 'EX', sunrise: '06:00', sunset: '18:00', timezoneId: 'UTC' } : { geonames: [{ countryName: 'Example country', adminName1: 'Example state', name: 'Example city' }] } };
  }));
}
function api() {
  client.defaults.adapter = async config => {
    expect(config.url).toBe('/api/locations/');
    expect(JSON.parse(config.data)).toEqual({ name: 'Example pitch', longitude: 10, latitude: 20, country: 'Example country', state: 'Example state', city: 'Example city' });
    return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'venue-1', name: 'Example pitch' } } };
  };
}
it('adapts venue pk/name, retains optional data and uses credential-free provider requests', async () => {
  providers(); api();
  expect(await AddLocation('Example pitch', 10, 20)).toEqual({ location_pk: 'venue-1', location_name: 'Example pitch', country: 'Example country', state: 'Example state', city: 'Example city', country_code: 'EX', sunrise: '06:00', sunset: '18:00', timezone: 'UTC' });
});
it('throws a retryable typed error and does not POST incomplete provider data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  let writes = 0; client.defaults.adapter = async () => { writes++; throw new Error('unexpected write'); };
  await expect(AddLocation('Example pitch', 10, 20)).rejects.toMatchObject({ name: 'LocationSelectionError', retryable: true });
  expect(writes).toBe(0);
});
it('creates a complete manual venue without provider access and permits retry after API failure', async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('provider must not be called'); }));
  client.defaults.adapter = async () => { throw new Error('offline'); };
  const geo = { country: 'Example country', state: 'Example state', city: 'Example city' };
  await expect(AddLocation('Example pitch', 10, 20, geo)).rejects.toMatchObject({ name: 'LocationSelectionError', retryable: true });
  api(); expect(await AddLocation('Example pitch', 10, 20, geo)).toMatchObject({ location_pk: 'venue-1', ...geo });
  expect(fetch).not.toHaveBeenCalled();
});
it('retains valid required geography when optional timezone lookup fails', async () => {
  providers(true); api(); expect(await AddLocation('Example pitch', 10, 20)).toMatchObject({ location_pk: 'venue-1', timezone: '', sunrise: '', sunset: '' });
});
it.each([[NaN, 20], [10, 91], [181, 20]])('rejects invalid coordinates before provider or write', async (lng, lat) => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(AddLocation('Example pitch', lng, lat)).rejects.toMatchObject({ name: 'LocationSelectionError' }); expect(fetcher).not.toHaveBeenCalled();
});

// The legacy provider adapter is isolated to this test worker.
afterAll(() => { axios.defaults.adapter = originalProvider; });

it.each(['fetch', 'body'] as const)('bounds required provider %s and ignores late completion after manual retry', async stage => {
  vi.useFakeTimers(); let complete!: (value: unknown) => void; let signal: AbortSignal | undefined;
  const held = new Promise(resolve => { complete = resolve; });
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
    signal = options.signal ?? undefined;
    return stage === 'fetch' ? held : Promise.resolve({ ok: true, json: () => held });
  }));
  api(); const write = vi.fn(client.defaults.adapter as AxiosAdapter); client.defaults.adapter = write;
  const pending = AddLocation('Example pitch', 10, 20);
  const outcome = pending.then(() => 'saved', error => error.name);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await Promise.race([outcome, Promise.resolve('still pending')])).toBe('LocationSelectionError');
  expect(signal?.aborted).toBe(true); expect(write).not.toHaveBeenCalled();
  await AddLocation('Example pitch', 10, 20, { country: 'Example country', state: 'Example state', city: 'Example city' });
  complete(stage === 'fetch' ? { ok: true, json: async () => ({ geonames: [{ countryName: 'Example country', adminName1: 'Example state', name: 'Example city' }] }) } : { geonames: [{ countryName: 'Example country', adminName1: 'Example state', name: 'Example city' }] });
  await vi.advanceTimersByTimeAsync(10000); expect(write).toHaveBeenCalledTimes(1);
});
it.each(['fetch', 'body'] as const)('bounds optional timezone %s, saves complete geography once and ignores late data', async stage => {
  vi.useFakeTimers(); let complete!: (value: unknown) => void; let signal: AbortSignal | undefined;
  const held = new Promise(resolve => { complete = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (!url.includes('timezoneJSON')) return { ok: true, json: async () => ({ geonames: [{ countryName: 'Example country', adminName1: 'Example state', name: 'Example city' }] }) };
    signal = options.signal ?? undefined;
    return stage === 'fetch' ? held : { ok: true, json: () => held };
  }));
  api(); const write = vi.fn(client.defaults.adapter as AxiosAdapter); client.defaults.adapter = write;
  const pending = AddLocation('Example pitch', 10, 20); let saved: unknown;
  void pending.then(value => { saved = value; });
  await vi.advanceTimersByTimeAsync(5000);
  expect(saved).toMatchObject({ location_pk: 'venue-1', city: 'Example city', timezone: '', country_code: '', sunrise: '', sunset: '' });
  expect(signal?.aborted).toBe(true); expect(write).toHaveBeenCalledTimes(1);
  complete(stage === 'fetch' ? { ok: true, json: async () => ({ timezoneId: 'Late/Zone' }) } : { timezoneId: 'Late/Zone' });
  await vi.advanceTimersByTimeAsync(10000); expect(write).toHaveBeenCalledTimes(1); expect(await pending).toMatchObject({ timezone: '' });
});
