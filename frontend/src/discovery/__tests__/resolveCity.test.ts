import { afterEach, describe, expect, it, vi } from 'vitest';
import client from '@/api/client';
import { resolveCity } from '../resolveCity';
const position = { latitude: 12, longitude: 34 };
const city = { country: 'France', state: 'Île-de-France', city: 'Paris' };
const place = { countryName: 'France', adminName1: 'Île-de-France', name: 'Paris', geonameId: 123 };
const ancestor = { ...place, geonameId: 456, fcl: 'A', fcode: 'ADM3' };
const response = (geonames: unknown[]) => new Response(JSON.stringify({ geonames }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('stored city resolution', () => {
  it('matches normalized full tuple, returning exact stored labels through unauthenticated GET', async () => {
    const authenticated = vi.spyOn(client, 'request'); const fetcher = vi.fn(async () => response([{ ...place, countryName: ' france ', name: ' PARIS ', adminName1: ' I\u0302le-de-France ' }])); vi.stubGlobal('fetch', fetcher);
    expect(await resolveCity(position, [city])).toEqual(city); expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]; expect(new URL(url).origin).toBe('https://secure.geonames.org'); expect(new URL(url).searchParams.get('lang')).toBe('en');
    expect(options.credentials).toBe('omit'); expect(options.method ?? 'GET').toBe('GET'); expect(options.headers).toBeUndefined(); expect(authenticated).not.toHaveBeenCalled();
  });
  it('resolves a district through compatible hierarchy ancestors', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([{ ...place, name: 'District' }])).mockResolvedValueOnce(response([{ name: 'Earth' }, { name: 'France' }, ancestor, { name: 'District' }])); vi.stubGlobal('fetch', fetcher);
    expect(await resolveCity(position, [city])).toEqual(city); expect(new URL(fetcher.mock.calls[1][0]).pathname).toBe('/hierarchyJSON'); expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('geonameId')).toBe('123'); expect(fetcher.mock.calls[1][1].credentials).toBe('omit');
  });
  it('disambiguates duplicate city names by both parents', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([place]))); expect(await resolveCity(position, [{ ...city, country: 'Elsewhere' }, { ...city, state: 'Elsewhere' }, city])).toEqual(city);
  });
  it.each([[{ ...place, countryName: undefined }], [{ ...place, adminName1: undefined }], [{ ...place, name: undefined }]])('does not match missing provider fields', async (places) => {
    vi.stubGlobal('fetch', vi.fn(async () => response([places]))); expect(await resolveCity(position, [city])).toBeNull();
  });
  it('rejects conflicting ancestors and multiple stored ancestor candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([{ ...place, name: 'District' }])).mockResolvedValueOnce(response([{ ...ancestor, countryName: 'Wrong country' }, { ...ancestor, name: 'Other' }]))); expect(await resolveCity(position, [city])).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([{ ...place, name: 'District' }])).mockResolvedValueOnce(response([ancestor, { ...ancestor, name: 'Other', geonameId: 789 }]))); expect(await resolveCity(position, [city, { ...city, city: 'Other' }])).toBeNull();
  });
  it.each([
    ['country', { name: 'Exampleland', fcl: 'A', fcode: 'PCLI' }, 'Exampleland'],
    ['state', { name: 'North', fcl: 'A', fcode: 'ADM1' }, 'North'],
  ])('does not select a city from a same-named %s ancestor', async (_label, record, cityName) => {
    const district = { ...place, name: 'District', countryName: 'Exampleland', adminName1: 'North' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([district])).mockResolvedValueOnce(response([{ ...record, countryName: 'Exampleland', adminName1: 'North', geonameId: 456 }])));
    expect(await resolveCity(position, [{ country: 'Exampleland', state: 'North', city: cityName }])).toBeNull();
  });
  it.each([
    { ...ancestor, fcl: undefined }, { ...ancestor, fcode: undefined },
    { ...ancestor, countryName: undefined }, { ...ancestor, adminName1: undefined },
    { ...ancestor, geonameId: undefined }, { ...ancestor, fcl: 'L', fcode: 'CONT' },
  ])('rejects incomplete or non-city ancestor evidence %#', async (record) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([{ ...place, name: 'District' }])).mockResolvedValueOnce(response([record])));
    expect(await resolveCity(position, [city])).toBeNull();
  });
  it.each(['ADM2', 'ADM3', 'ADM4', 'ADM5'])('preserves compatible municipality ancestor %s', async (fcode) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([{ ...place, name: 'District' }])).mockResolvedValueOnce(response([{ ...ancestor, fcode }])));
    expect(await resolveCity(position, [city])).toEqual(city);
  });
  it('accepts an independent populated-city ancestor even when it shares its state name', async () => {
    const district = { ...place, name: 'District', countryName: 'Exampleland', adminName1: 'North' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([district])).mockResolvedValueOnce(response([
      { ...district, name: 'North', geonameId: 456, fcl: 'A', fcode: 'ADM1' },
      { ...district, name: 'North', geonameId: 789, fcl: 'P', fcode: 'PPLC' },
    ])));
    expect(await resolveCity(position, [{ country: 'Exampleland', state: 'North', city: 'North' }])).toEqual({ country: 'Exampleland', state: 'North', city: 'North' });
  });
  it('returns no selection with absent hierarchy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([{ ...place, name: 'District' }])).mockResolvedValueOnce(response([]))); expect(await resolveCity(position, [city])).toBeNull();
  });
  it('rejects HTTP200 provider status errors and HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: { value: 18, message: 'limit' } })))); await expect(resolveCity(position, [city])).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 }))); await expect(resolveCity(position, [city])).rejects.toThrow();
  });
  it('rejects malformed provider envelopes', async () => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}'))); await expect(resolveCity(position, [city])).rejects.toThrow(); });
  it('aborts before transport and after response even when transport ignores abort', async () => {
    const controller = new AbortController(); controller.abort(); const fetcher = vi.fn(async () => response([place])); vi.stubGlobal('fetch', fetcher); await expect(resolveCity(position, [city], controller.signal)).rejects.toHaveProperty('name', 'AbortError'); expect(fetcher).not.toHaveBeenCalled();
    const pending = new AbortController(); vi.stubGlobal('fetch', vi.fn(async () => { pending.abort(); return response([place]); })); await expect(resolveCity(position, [city], pending.signal)).rejects.toHaveProperty('name', 'AbortError');
  });
  it('times out provider calls even when fetch never settles', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); const result = resolveCity(position, [city]); const rejection = expect(result).rejects.toHaveProperty('name', 'TimeoutError'); await vi.advanceTimersByTimeAsync(5000); await rejection;
  });
});
