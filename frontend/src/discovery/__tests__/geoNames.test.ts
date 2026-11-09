import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchCityPlaces, resolvePlaceCenter } from '../geoNames';

const paris = { name: 'Paris', countryName: 'France', countryCode: 'FR', adminName1: 'Île-de-France', adminCode1: '11', geonameId: 2988507, fcl: 'P', fcode: 'PPLC', lng: '2.3488', lat: '48.8534' };
const city = { country: 'France', state: 'Île-de-France', city: 'Paris' };
const response = (geonames: unknown[], totalResultsCount = geonames.length) => new Response(JSON.stringify({ geonames, totalResultsCount }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('manual global place search', () => {
  it('finds a complete city absent from catalogue and bounds unauthenticated global suggestions', async () => {
    const fetcher = vi.fn(async () => response([paris])); vi.stubGlobal('fetch', fetcher);
    expect(await searchCityPlaces('Pa', [])).toEqual([{ ...city, geonameId: 2988507, center: [2.3488, 48.8534] }]);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]; const params = new URL(url).searchParams;
    expect(new URL(url).origin).toBe('https://secure.geonames.org'); expect(params.get('maxRows')).toBe('20'); expect(params.get('featureClass')).toBe('P'); expect(params.get('country')).toBeNull(); expect(params.get('style')).toBe('FULL'); expect(options.credentials).toBe('omit'); expect(options.headers).toBeUndefined();
  });
  it('does not request a one-character query', async () => { const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); expect(await searchCityPlaces(' p ', [])).toEqual([]); expect(fetcher).not.toHaveBeenCalled(); });
  it('preserves unique exact stored spellings only within the same complete tuple', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([paris, { ...paris, geonameId: 99, adminName1: 'Texas', adminCode1: 'TX' }])));
    const stored = { country: ' France ', state: 'I\u0302le-de-France', city: ' PARIS ' };
    const results = await searchCityPlaces('Paris', [stored, { ...city, state: 'Elsewhere', city: 'Wrong alias' }]);
    expect(results).toEqual([{ ...stored, geonameId: 2988507, center: [2.3488, 48.8534] }, { country: 'France', state: 'Texas', city: 'Paris', geonameId: 99, center: [2.3488, 48.8534] }]);
  });
  it('does not choose between distinct normalized catalogue spellings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([paris])));
    expect(await searchCityPlaces('Paris', [city, { ...city, city: 'PARIS' }])).toEqual([{ ...city, geonameId: 2988507, center: [2.3488, 48.8534] }]);
  });
  it('allows explicit generic PPL but excludes neighborhoods, historical and abandoned codes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(['PPL', 'PPLX', 'PPLQ', 'PPLH', 'PPLW', 'PPLS', 'PPLCH'].map((fcode, index) => ({ ...paris, fcode, geonameId: index + 1 })))));
    expect((await searchCityPlaces('Paris', [])).map(row => row.geonameId)).toEqual([1]);
  });
  it.each([{ countryName: '' }, { adminName1: undefined }, { countryCode: undefined }, { adminCode1: '' }, { geonameId: -1 }, { lat: 'NaN' }, { lng: '181' }, { lat: '' }, { lng: null }])('excludes invalid provider metadata %#', async invalid => {
    vi.stubGlobal('fetch', vi.fn(async () => response([{ ...paris, ...invalid }]))); expect(await searchCityPlaces('Paris', [])).toEqual([]);
  });
  it('allows a truncated manual suggestions list but never returns over twenty rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(Array.from({ length: 23 }, (_, i) => ({ ...paris, geonameId: i + 1 })), 100)));
    expect(await searchCityPlaces('Paris', [])).toHaveLength(20);
  });
});

describe('exact selected-place centers', () => {
  it('retains a stored district tuple and its own point rather than an enclosing city', async () => {
    const district = { ...city, city: 'Wangfujing', country: 'China', state: 'Beijing' };
    vi.stubGlobal('fetch', vi.fn(async () => response([{ ...paris, name: 'Wangfujing', countryName: 'China', adminName1: 'Beijing', fcode: 'PPL', geonameId: 10175057, lng: '116.4115', lat: '39.90807' }, paris])));
    expect(await resolvePlaceCenter({ level: 'city', ...district })).toEqual({ geo: { level: 'city', ...district }, geonameId: 10175057, center: [116.4115, 39.90807] });
  });
  it.each([
    { rows: [paris, { ...paris, geonameId: 99 }] },
    { rows: [{ ...paris, adminName1: 'Other' }] },
    { rows: [{ ...paris, name: 'Nearby Paris' }] },
  ])('rejects duplicate identities, wrong parents and alternate-name-only matches %#', async ({ rows }) => {
    vi.stubGlobal('fetch', vi.fn(async () => response(rows))); expect(await resolvePlaceCenter({ level: 'city', ...city })).toBeNull();
  });
  it('rejects conflicting metadata for the same provider identity rather than choosing the last row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([paris, { ...paris, lng: '3' }]))); expect(await resolvePlaceCenter({ level: 'city', ...city })).toBeNull();
  });
  it('rejects truncated or missing search totals when uniqueness is required', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([paris], 21))); expect(await resolvePlaceCenter({ level: 'city', ...city })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ geonames: [paris] })))); expect(await resolvePlaceCenter({ level: 'city', ...city })).toBeNull();
  });
  it('resolves only a unique exact country or administrative region', async () => {
    const fetcher = vi.fn(async () => response([{ ...paris, name: 'France', fcl: 'A', fcode: 'PCLI' }])); vi.stubGlobal('fetch', fetcher);
    expect(await resolvePlaceCenter({ level: 'country', country: 'France' })).toEqual({ geo: { level: 'country', country: 'France' }, geonameId: 2988507, center: [2.3488, 48.8534] });
    fetcher.mockImplementation(async () => response([{ ...paris, name: 'Île-de-France', fcl: 'A', fcode: 'ADM1' }]));
    expect(await resolvePlaceCenter({ level: 'state', country: 'France', state: 'Île-de-France' })).toEqual({ geo: { level: 'state', country: 'France', state: 'Île-de-France' }, geonameId: 2988507, center: [2.3488, 48.8534] });
  });
});

describe('bounded provider transport', () => {
  it.each([{ status: { value: 18 } }, {}, { geonames: 'invalid' }])('rejects malformed or service-error envelopes %#', async envelope => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(envelope)))); await expect(searchCityPlaces('Paris', [])).rejects.toThrow();
  });
  it('rejects HTTP failure', async () => { vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 }))); await expect(searchCityPlaces('Paris', [])).rejects.toThrow(); });
  it('times out even when fetch ignores cancellation', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); const result = searchCityPlaces('Paris', []); const assertion = expect(result).rejects.toHaveProperty('name', 'TimeoutError'); await vi.advanceTimersByTimeAsync(5000); await assertion;
  });
  it('includes a hanging response body in the five-second request limit', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) })));
    const result = searchCityPlaces('Paris', []); const assertion = expect(result).rejects.toHaveProperty('name', 'TimeoutError'); await vi.advanceTimersByTimeAsync(5000); await assertion;
  });
  it('cancels a hanging body and ignores its later completion', async () => {
    let complete!: (value: unknown) => void; vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(resolve => { complete = resolve; }) })));
    const controller = new AbortController(); const result = searchCityPlaces('Paris', [], controller.signal); await Promise.resolve(); controller.abort(); complete?.({ geonames: [paris] }); await expect(result).rejects.toHaveProperty('name', 'AbortError');
  });
  it('does not request when already aborted', async () => {
    const controller = new AbortController(); controller.abort(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); await expect(searchCityPlaces('Paris', [], controller.signal)).rejects.toHaveProperty('name', 'AbortError'); expect(fetcher).not.toHaveBeenCalled();
  });
});
