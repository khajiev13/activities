// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramApp } from '@/platform/telegram';
import type { DiscoveryPreference, PlaceSelection } from '../place';

const key = 'eventopia.discovery.v1';
const telegramWindow = window as Window & { Telegram?: { WebApp: TelegramApp } };
vi.mock('@/api/authApi', () => ({ isInTelegram: () => Boolean(telegramWindow.Telegram) }));
let read: typeof import('../preferences').readDiscoveryPreference;
let write: typeof import('../preferences').writeDiscoveryPreference;
let cached: typeof import('../preferences').readCachedDiscoveryPreference;
const place: PlaceSelection = { geo: { level: 'city', country: 'Example Country', state: 'Example State', city: 'Example City' }, geonameId: 123, center: [34, 12] };
const preference = (updatedAt = 100): DiscoveryPreference => ({ version: 1, mode: 'manual', place, recent: [place], welcomeSeen: true, updatedAt });
const local = () => JSON.parse(localStorage.getItem(key)!);
type NativeStorage = NonNullable<TelegramApp['DeviceStorage']>;
const native = (storage: NativeStorage, supported = true) => { telegramWindow.Telegram = { WebApp: { isVersionAtLeast: version => supported && version === '9.0', DeviceStorage: storage } }; };

beforeEach(async () => {
  vi.useFakeTimers(); vi.resetModules();
  // Node 26's own localStorage shadows jsdom's storage without a file flag.
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  delete telegramWindow.Telegram;
  ({ readDiscoveryPreference: read, writeDiscoveryPreference: write, readCachedDiscoveryPreference: cached } = await import('../preferences'));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete telegramWindow.Telegram; });

describe('remembered coarse discovery places', () => {
  it('roundtrips a validated public place through browser storage', async () => {
    expect(await write(preference())).toEqual({ warning: false });
    expect(local()).toEqual(preference());
    expect(await read()).toEqual({ preference: preference(), warning: false });
  });

  it.each([
    ['version', { ...preference(), version: 2 }],
    ['NaN timestamp', { ...preference(), updatedAt: NaN }],
    ['infinite timestamp', { ...preference(), updatedAt: Infinity }],
    ['negative timestamp', { ...preference(), updatedAt: -1 }],
    ['longitude', { ...preference(), place: { ...place, center: [181, 12] } }],
    ['latitude', { ...preference(), place: { ...place, center: [34, -91] } }],
    ['non-finite point', { ...preference(), place: { ...place, center: [34, NaN] } }],
    ['missing country', { ...preference(), place: { geo: { level: 'city', state: 'State', city: 'City' } } }],
    ['missing state', { ...preference(), place: { geo: { level: 'city', country: 'Country', city: 'City' } } }],
    ['blank parent', { ...preference(), place: { geo: { level: 'state', country: ' ', state: 'State' } } }],
    ['invalid identity', { ...preference(), place: { ...place, geonameId: 0 } }],
    ['partial provider metadata', { ...preference(), place: { geo: place.geo, geonameId: 123 } }],
  ])('rejects invalid %s instead of persisting it', async (_name, invalid) => {
    expect(await write(invalid as DiscoveryPreference)).toEqual({ warning: true });
    expect(localStorage.getItem(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify(invalid));
    expect((await read()).preference).toBeNull();
  });

  it('strips auth and raw-location fields at every persisted object boundary', async () => {
    const extra = { ...preference(), token: 'synthetic', latitude: 12, place: { ...place, rawPosition: { latitude: 12 }, geo: { ...place.geo, username: 'synthetic' } }, recent: [{ ...place, launchData: 'synthetic' }] };
    localStorage.setItem(key, JSON.stringify(extra));
    expect((await read()).preference).toEqual(preference());
    await write(extra);
    expect(local()).toEqual(preference());
  });

  it('deduplicates normalized tuples, retains exact names and caps recent places at five', async () => {
    const first = { geo: { level: 'city' as const, country: ' Ｃountry ', state: 'STATE', city: 'City  Name' } };
    const duplicate = { geo: { level: 'city' as const, country: 'country', state: 'state', city: ' city name ' } };
    const others = Array.from({ length: 6 }, (_, index) => ({ geo: { level: 'city' as const, country: 'Country', state: `State ${index}`, city: 'City Name' } }));
    await write({ ...preference(), recent: [first, duplicate, ...others] });
    expect(local().recent).toEqual([first, ...others.slice(0, 4)]);
  });

  it('accepts country/state regions, catalogue cities and forgotten preferences', async () => {
    for (const selection of [{ geo: { level: 'country', country: 'Country' } }, { geo: { level: 'state', country: 'Country', state: 'State' } }, { geo: place.geo }, null] as (PlaceSelection | null)[]) {
      const value = { ...preference(), place: selection, mode: 'off' as const, recent: [] };
      await write(value);
      expect((await read()).preference).toEqual(value);
    }
  });

  it.each([undefined, false])('normally falls back when native storage is absent or below API9 (%s)', async supported => {
    if (supported === false) native({ getItem: () => { throw Error('unsupported'); }, setItem: () => { throw Error('unsupported'); } }, false);
    expect(await write(preference())).toEqual({ warning: false });
    expect(await read()).toEqual({ preference: preference(), warning: false });
  });

  it('chooses the newest valid timestamp across browser and native stores', async () => {
    localStorage.setItem(key, JSON.stringify(preference(100)));
    native({ getItem: (_key, callback) => callback(null, JSON.stringify(preference(200))), setItem: (_key, _value, callback) => callback?.(null, true) });
    expect((await read()).preference?.updatedAt).toBe(200);
    localStorage.setItem(key, JSON.stringify(preference(300)));
    expect((await read()).preference?.updatedAt).toBe(300);
  });

  it('ignores invalid native data while preserving valid local data', async () => {
    localStorage.setItem(key, JSON.stringify(preference()));
    native({ getItem: (_key, callback) => callback(null, '{invalid'), setItem: (_key, _value, callback) => callback?.(null, true) });
    expect((await read()).preference).toEqual(preference());
  });

  it('bounds hanging native reads at 1500ms and ignores late callbacks', async () => {
    let complete: Parameters<NativeStorage['getItem']>[1] | undefined;
    native({ getItem: (_key, callback) => { complete = callback; }, setItem: (_key, _value, callback) => callback?.(null, true) });
    localStorage.setItem(key, JSON.stringify(preference()));
    const pending = read();
    await vi.advanceTimersByTimeAsync(1500);
    const result = await pending;
    expect(result).toEqual({ preference: preference(), warning: true });
    complete?.(null, JSON.stringify(preference(999)));
    expect(result).toEqual({ preference: preference(), warning: true });
    expect(local()).toEqual(preference());
  });

  it('does not let a pending older native read beat a newer local write', async () => {
    let complete: Parameters<NativeStorage['getItem']>[1] | undefined;
    native({ getItem: (_key, callback) => { complete = callback; }, setItem: (_key, _value, callback) => callback?.(null, true) });
    const pending = read();
    await write(preference(300));
    complete?.(null, JSON.stringify(preference(100)));
    expect(await pending).toEqual({ preference: preference(300), warning: false });
  });

  it('mirrors writes synchronously and serializes native writes so the newest value remains', async () => {
    const callbacks: (() => void)[] = []; let stored = '';
    native({ getItem: (_key, callback) => callback(null, stored), setItem: (_key, value, callback) => { callbacks.push(() => { stored = value; callback?.(null, true); }); } });
    const older = write(preference(100));
    const newer = write(preference(200));
    expect(local().updatedAt).toBe(200);
    await vi.advanceTimersByTimeAsync(0);
    callbacks.shift()?.(); await older;
    await vi.advanceTimersByTimeAsync(0);
    callbacks.shift()?.(); await newer;
    expect(JSON.parse(stored).updatedAt).toBe(200);
    expect((await read()).preference?.updatedAt).toBe(200);
  });

  it('bounds hanging native writes at 1500ms without losing the browser mirror', async () => {
    native({ getItem: (_key, callback) => callback(null, ''), setItem: () => undefined });
    const pending = write(preference());
    expect(local()).toEqual(preference());
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toEqual({ warning: true });
    expect((await read()).preference).toEqual(preference());
  });

  it('bounds queued hanging writes from invocation and keeps the newest mirror after late native completion', async () => {
    const callbacks: (() => void)[] = []; let stored = '';
    native({ getItem: (_key, callback) => callback(null, stored), setItem: (_key, value, callback) => { callbacks.push(() => { stored = value; callback?.(null, true); }); } });
    const settled: ({ warning: boolean } | undefined)[] = [undefined, undefined];
    const older = write(preference(100)).then(result => { settled[0] = result; });
    const newer = write(preference(200)).then(result => { settled[1] = result; });
    expect(local().updatedAt).toBe(200);
    await vi.advanceTimersByTimeAsync(1500);
    expect(settled).toEqual([{ warning: true }, { warning: true }]);
    await Promise.all([older, newer]);
    for (const callback of callbacks) callback();
    expect(local().updatedAt).toBe(200);
    expect((await read()).preference?.updatedAt).toBe(200);
  });

  it('settles aborted reads immediately and ignores the later native result', async () => {
    let complete: Parameters<NativeStorage['getItem']>[1] | undefined;
    native({ getItem: (_key, callback) => { complete = callback; }, setItem: (_key, _value, callback) => callback?.(null, true) });
    const controller = new AbortController(); const pending = read(controller.signal); controller.abort();
    const result = await pending;
    expect(result).toEqual({ preference: null, warning: false });
    complete?.(null, JSON.stringify(preference()));
    expect(result.preference).toBeNull();
  });

  it('returns a warning for local storage exceptions while retaining the synchronous mirror', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw Error('unavailable'); });
    expect(await write(preference())).toEqual({ warning: true });
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw Error('unavailable'); });
    expect(await read()).toEqual({ preference: preference(), warning: true });
  });

  it.each(['callback', 'throw', 'false'])('returns a warning for actual native persistence failure (%s)', async failure => {
    native({ getItem: (_key, callback) => { if (failure === 'throw') throw Error('unavailable'); callback('unavailable'); }, setItem: (_key, _value, callback) => { if (failure === 'throw') throw Error('unavailable'); callback?.(failure === 'callback' ? 'unavailable' : null, false); } });
    expect(await write(preference())).toEqual({ warning: true });
    expect(await read()).toEqual({ preference: preference(), warning: true });
  });
});

it('reads validated cache synchronously without waiting for native and keeps the newest mirror on local failure', async () => {
  native({ getItem: () => undefined, setItem: (_key, _value, done) => done?.(null, true) });
  localStorage.setItem(key, JSON.stringify(preference(100)));
  expect(cached()).toEqual({ preference: preference(100), warning: false });
  await write(preference(200));
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw Error('unavailable'); });
  expect(cached()).toEqual({ preference: preference(200), warning: true });
});
