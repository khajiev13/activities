import { afterEach, describe, expect, it, vi } from 'vitest';
import client from '@/api/client';
import { resolveCity, resolveCurrentCity } from '../resolveCity';
const position = { latitude: 12, longitude: 34 };
const city = { country: 'France', state: 'Île-de-France', city: 'Paris' };
const paris = { name: 'Paris', countryName: 'France', countryCode: 'FR', adminName1: 'Île-de-France', adminCode1: '11', geonameId: 2988507, fcl: 'P', fcode: 'PPLC', lng: '2.3488', lat: '48.8534' };
const district = { ...paris, name: 'Quartier', fcode: 'PPL', geonameId: 123 };
const adm = { ...paris, fcl: 'A', fcode: 'ADM3', geonameId: 456 };
const response = (geonames: unknown[], totalResultsCount = geonames.length) => new Response(JSON.stringify({ geonames, totalResultsCount }));
const expected = { ...city, geonameId: 2988507, center: [2.3488, 48.8534] };
// GeoNames public responses captured 2026-11-09: findNearbyPlaceNameJSON at
// Aktepa's public center, hierarchyJSON?geonameId=1514635, and the complete
// searchJSON?name_equals=Tashkent&country=UZ&adminCode1=13&featureClass=P.
// Freeze relevant fields only; these are public feature centers, not device GPS.
const aktepa = { name: 'Aktepa', countryName: 'Uzbekistan', countryCode: 'UZ', adminName1: 'Tashkent', adminCode1: '13', geonameId: 1514635, fcl: 'P', fcode: 'PPLX', lng: '69.20778', lat: '41.305' };
const tashkent = { name: 'Tashkent', countryName: 'Uzbekistan', countryCode: 'UZ', adminName1: 'Tashkent', adminCode1: '13', geonameId: 1512569, fcl: 'P', fcode: 'PPLC', lng: '69.21627', lat: '41.26465' };
const tashkentRegion = { name: 'Tashkent', countryName: 'Uzbekistan', countryCode: 'UZ', adminName1: 'Tashkent', adminCode1: '13', geonameId: 1484839, fcl: 'A', fcode: 'ADM1', lng: '69.25', lat: '41.33333' };
const tashkentCity = { country: 'Uzbekistan', state: 'Tashkent', city: 'Tashkent' };
const publicPosition = { latitude: 41.305, longitude: 69.20778 };
function provider(reverse: unknown[], hierarchy: unknown[], searches: unknown[] = []) {
  const fetcher = vi.fn(async (input: string) => {
    const path = new URL(input).pathname;
    return response(path === '/findNearbyPlaceNameJSON' ? reverse : path === '/hierarchyJSON' ? hierarchy : searches);
  }); vi.stubGlobal('fetch', fetcher); return fetcher;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('conservative current-city resolution', () => {
  it('does not automatically label a PPL-only Wangfujing locality a city even with a stored tuple', async () => {
    const wang = { ...district, name: 'Wangfujing', countryName: 'China', countryCode: 'CN', adminName1: 'Beijing', adminCode1: '22', geonameId: 10175057 };
    provider([wang], [{ ...wang, name: 'Beijing', fcl: 'A', fcode: 'ADM1' }]);
    expect(await resolveCity(position, [{ country: 'China', state: 'Beijing', city: 'Wangfujing' }])).toBeNull();
  });
  it('gathers direct and hierarchy evidence before selecting and keeps exact catalogue labels', async () => {
    const stored = { country: ' France ', state: 'I\u0302le-de-France', city: ' PARIS ' }; const fetcher = provider([paris], [paris], [paris]); const authenticated = vi.spyOn(client, 'request');
    expect(await resolveCurrentCity(position, [stored])).toEqual({ ...stored, geonameId: 2988507, center: [2.3488, 48.8534] });
    expect(fetcher.mock.calls.some(([url]) => new URL(url).pathname === '/hierarchyJSON')).toBe(true); expect(authenticated).not.toHaveBeenCalled();
    for (const [url, options] of fetcher.mock.calls as unknown as [string, RequestInit][]) { expect(new URL(url).origin).toBe('https://secure.geonames.org'); expect(options.credentials).toBe('omit'); expect(options.headers).toBeUndefined(); }
  });
  it('resolves neighborhood plus unique strong Tashkent hierarchy without a catalogue', async () => {
    const tashkent = { ...paris, name: 'Tashkent', countryName: 'Uzbekistan', countryCode: 'UZ', adminName1: 'Tashkent', adminCode1: '13', geonameId: 1512569, lng: '69.2163', lat: '41.26465' };
    provider([{ ...tashkent, name: 'Chilonzor', fcode: 'PPL', geonameId: 99 }], [tashkent], [tashkent]);
    expect(await resolveCurrentCity(position, [])).toEqual({ country: 'Uzbekistan', state: 'Tashkent', city: 'Tashkent', geonameId: 1512569, center: [69.2163, 41.26465] });
  });
  it('resolves public Aktepa PPLX through its Tashkent city hierarchy and complete scoped search', async () => {
    // Reverse and hierarchy responses omit totalResultsCount in the public API.
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ geonames: [aktepa] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ geonames: [
        { fcl: 'L', fcode: 'AREA' }, { fcl: 'L', fcode: 'CONT' }, { fcl: 'A', fcode: 'PCLI' }, tashkentRegion, tashkent, aktepa,
      ] })))
      .mockResolvedValueOnce(response([tashkent], 1));
    vi.stubGlobal('fetch', fetcher);
    expect(await resolveCurrentCity(publicPosition, [])).toEqual({ country: 'Uzbekistan', state: 'Tashkent', city: 'Tashkent', geonameId: 1512569, center: [69.21627, 41.26465] });
    const requests = fetcher.mock.calls.map(([url]) => new URL(url));
    expect(requests.map(url => url.pathname)).toEqual(['/findNearbyPlaceNameJSON', '/hierarchyJSON', '/searchJSON']);
    expect(requests[1].searchParams.get('geonameId')).toBe('1514635');
    expect(Object.fromEntries(requests[2].searchParams)).toMatchObject({ name_equals: 'Tashkent', country: 'UZ', adminCode1: '13', featureClass: 'P', maxRows: '20' });
    for (const [url, options] of fetcher.mock.calls as [string, RequestInit][]) { expect(new URL(url).origin).toBe('https://secure.geonames.org'); expect(options.credentials).toBe('omit'); expect(options.headers).toBeUndefined(); }
  });
  it('preserves the unique normalized full catalogue tuple for public Aktepa to Tashkent', async () => {
    const stored = { country: ' Uzbekistan ', state: 'TASHKENT', city: ' tashkent ' };
    provider([aktepa], [tashkentRegion, tashkent, aktepa], [tashkent]);
    expect(await resolveCurrentCity(publicPosition, [stored])).toEqual({ country: ' Uzbekistan ', state: 'TASHKENT', city: ' tashkent ', geonameId: 1512569, center: [69.21627, 41.26465] });
  });
  it('resolves the public Tashkent city center directly', async () => {
    provider([tashkent], [tashkentRegion, tashkent], [tashkent]);
    expect(await resolveCurrentCity({ latitude: 41.26465, longitude: 69.21627 }, [])).toEqual({ country: 'Uzbekistan', state: 'Tashkent', city: 'Tashkent', geonameId: 1512569, center: [69.21627, 41.26465] });
  });
  it('does not promote a PPLX neighborhood or its ADM1 parent without strong city evidence', async () => {
    const fetcher = provider([aktepa], [tashkentRegion, aktepa], [tashkent]);
    expect(await resolveCurrentCity(publicPosition, [])).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects PPLX hierarchy city evidence with conflicting administrative parents', async () => {
    provider([aktepa], [{ ...tashkent, adminCode1: '14' }], [tashkent]);
    expect(await resolveCurrentCity(publicPosition, [])).toBeNull();
  });
  it('rejects multiple strong city identities after a PPLX reverse result', async () => {
    provider([aktepa], [tashkent], [tashkent, { ...tashkent, geonameId: 99 }]);
    expect(await resolveCurrentCity(publicPosition, [])).toBeNull();
  });
  it('rejects a truncated exact search after a PPLX reverse result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([aktepa])).mockResolvedValueOnce(response([tashkent])).mockResolvedValueOnce(response([tashkent], 2)));
    expect(await resolveCurrentCity(publicPosition, [])).toBeNull();
  });
  it.each([false, true])('preserves a distinct stored Aktepa district instead of silently selecting Tashkent (stored city: %s)', async hasCity => {
    provider([aktepa], [tashkent], [tashkent]);
    expect(await resolveCurrentCity(publicPosition, [{ ...tashkentCity, city: 'Aktepa' }, ...(hasCity ? [tashkentCity] : [])])).toBeNull();
  });
  it('rejects incomplete PPLX reverse parent metadata before hierarchy lookup', async () => {
    const fetcher = provider([{ ...aktepa, adminCode1: undefined }], [tashkent], [tashkent]);
    expect(await resolveCurrentCity(publicPosition, [])).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects a PPLX reverse row and PPLC hierarchy row claiming the same provider identity', async () => {
    provider([{ ...paris, fcode: 'PPLX' }], [paris], [paris]);
    expect(await resolveCurrentCity(position, [city])).toBeNull();
  });
  it.each(['ADM2', 'ADM3', 'ADM4', 'ADM5'])('resolves Paris %s only after exact scoped populated-city evidence', async fcode => {
    const fetcher = provider([district], [{ ...adm, fcode }], [paris]); expect(await resolveCurrentCity(position, [city])).toEqual(expected);
    const searches = fetcher.mock.calls.map(([url]) => new URL(url)).filter(url => url.pathname === '/searchJSON'); expect(searches).toHaveLength(1);
    expect(Object.fromEntries(searches[0].searchParams)).toMatchObject({ name_equals: 'Paris', country: 'FR', adminCode1: '11', featureClass: 'P', maxRows: '20', style: 'FULL' });
  });
  it('keeps the legacy wrapper limited to coarse catalogue city fields', async () => { provider([district], [adm], [paris]); expect(await resolveCity(position, [city])).toEqual(city); });
  it.each([false, true])('rejects conflicting strong city IDs regardless of response order (%s)', async reverseOrder => {
    const candidates = [paris, { ...paris, geonameId: 99, population: 999999999 }]; provider([district], reverseOrder ? candidates.reverse() : candidates, candidates);
    expect(await resolveCurrentCity(position, [city])).toBeNull();
  });
  it('rejects conflicting direct stored district and enclosing stored city tuples', async () => {
    provider([district], [paris], [paris]); expect(await resolveCurrentCity(position, [city, { ...city, city: 'Quartier' }])).toBeNull();
  });
  it('does not reconcile same-name stored cities from different parents', async () => {
    provider([paris], [paris], [paris]); expect(await resolveCurrentCity(position, [{ ...city, state: 'Texas' }])).toEqual(expected);
  });
  it.each([{ countryName: undefined }, { countryCode: undefined }, { adminName1: undefined }, { adminCode1: undefined }, { geonameId: 0 }, { lng: 'NaN' }, { lat: '91' }, { fcl: undefined }, { fcode: 'PPLX' }])('rejects incomplete or non-settlement reverse metadata %#', async invalid => {
    provider([{ ...paris, ...invalid }], [paris], [paris]); expect(await resolveCurrentCity(position, [city])).toBeNull();
  });
  it('rejects hierarchy from conflicting parent codes even when names match', async () => {
    provider([district], [{ ...adm, countryCode: 'US', adminCode1: 'TX' }], [paris]); expect(await resolveCurrentCity(position, [city])).toBeNull();
  });
  it('verifies exact-search parents and returned name rather than trusting provider filtering', async () => {
    provider([district], [adm], [{ ...paris, adminCode1: 'XX' }, { ...paris, name: 'Other' }]); expect(await resolveCurrentCity(position, [city])).toBeNull();
  });
  it('does not promote country or state names to cities', async () => { const fetcher = provider([district], [{ ...adm, fcode: 'ADM1' }], [paris]); expect(await resolveCurrentCity(position, [city])).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(2); });
  it('requires complete hierarchy and exact-search sets even when direct evidence is strong', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([paris])).mockResolvedValueOnce(response([paris], 21)));
    expect(await resolveCurrentCity(position, [city])).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([paris])).mockResolvedValueOnce(response([adm])).mockResolvedValueOnce(response([paris], 21)));
    expect(await resolveCurrentCity(position, [city])).toBeNull();
  });
  it.each([{ ...paris, adminCode1: undefined }, { ...paris, fcl: undefined }])('rejects incomplete relevant hierarchy rows even alongside strong direct evidence %#', async incomplete => {
    provider([paris], [incomplete], [paris]); expect(await resolveCurrentCity(position, [])).toBeNull();
  });
  it('does not treat incomplete exact-search rows as proof of unique city identity', async () => {
    provider([paris], [adm], [paris, { ...paris, geonameId: 98, adminCode1: undefined }]); expect(await resolveCurrentCity(position, [])).toBeNull();
  });
  it('rejects conflicting metadata for a repeated strong identity', async () => {
    provider([paris], [{ ...paris, lng: '3' }], [paris]); expect(await resolveCurrentCity(position, [])).toBeNull();
  });
  it('deduplicates exact hierarchy names and stays within one reverse, one hierarchy and three searches', async () => {
    const fetcher = provider([district], [adm, { ...adm, name: ' PARIS ', geonameId: 10 }, { ...adm, name: 'Second', geonameId: 11 }, { ...adm, name: 'Third', geonameId: 12 }], [paris]);
    await resolveCurrentCity(position, []);
    const paths = fetcher.mock.calls.map(([url]) => new URL(url)); expect(paths.filter(url => url.pathname === '/findNearbyPlaceNameJSON')).toHaveLength(1); expect(paths.filter(url => url.pathname === '/hierarchyJSON')).toHaveLength(1); expect(paths.filter(url => url.pathname === '/searchJSON')).toHaveLength(3);
    expect(new Set(paths.filter(url => url.pathname === '/searchJSON').map(url => url.searchParams.get('name_equals')?.trim().toLowerCase())).size).toBe(3);
  });
  it('does not silently choose when more than three distinct hierarchy names require evidence', async () => {
    const fetcher = provider([paris], [adm, ...['Second', 'Third', 'Fourth'].map((name, i) => ({ ...adm, name, geonameId: i + 20 }))], [paris]); expect(await resolveCurrentCity(position, [])).toBeNull(); expect(fetcher.mock.calls.length).toBeLessThanOrEqual(5);
  });
  it('does not succeed when a required exact lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([paris])).mockResolvedValueOnce(response([adm])).mockResolvedValueOnce(new Response('', { status: 503 })));
    await expect(resolveCurrentCity(position, [city])).rejects.toThrow();
  });
  it('enforces twelve seconds across individually successful requests including bodies', async () => {
    vi.useFakeTimers(); const names = [adm, { ...adm, name: 'Second', geonameId: 11 }, { ...adm, name: 'Third', geonameId: 12 }];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => { await new Promise(resolve => setTimeout(resolve, 4000)); const path = new URL(input).pathname; return response(path === '/findNearbyPlaceNameJSON' ? [district] : path === '/hierarchyJSON' ? names : [paris]); }));
    const result = resolveCurrentCity(position, []); const assertion = expect(result).rejects.toHaveProperty('name', 'TimeoutError'); await vi.advanceTimersByTimeAsync(12000); await assertion;
  });
  it('aborts before transport and while a response body ignores cancellation', async () => {
    const pre = new AbortController(); pre.abort(); const fetcher = provider([paris], [paris]); await expect(resolveCurrentCity(position, [], pre.signal)).rejects.toHaveProperty('name', 'AbortError'); expect(fetcher).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) }))); const pending = new AbortController(); const result = resolveCurrentCity(position, [], pending.signal); pending.abort(); await expect(result).rejects.toHaveProperty('name', 'AbortError');
  });
});
