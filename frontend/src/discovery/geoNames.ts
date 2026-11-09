import { normalizePlaceName } from './place';
import type { CityPlace, PlaceSelection } from './place';
import type { CityOption, GeoSelection } from './types';

export type GeoNamesPlace = {
  name: string; country: string; countryCode: string; state: string; adminCode1: string;
  geonameId: number; center: [number, number]; fcl: string; fcode: string;
};
type Envelope = { rows: unknown[]; total: number | undefined };
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const same = (a: string, b: string) => normalizePlaceName(a) === normalizePlaceName(b);
const point = (value: unknown, max: number): number | null => {
  if (!(typeof value === 'number' || text(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= max ? number : null;
};

// One deadline is shared by every request in a resolution, including JSON bodies.
export function createGeoNamesLookup(signal?: AbortSignal) {
  const deadline = Date.now() + 12000;
  return async (endpoint: string, params: Record<string, string>): Promise<Envelope> => {
    if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
    const remaining = Math.min(5000, deadline - Date.now());
    if (remaining <= 0) throw new DOMException('Lookup timed out', 'TimeoutError');
    const controller = new AbortController();
    const url = new URL(endpoint, 'https://secure.geonames.org/');
    // Existing public account; Eventopia authentication never enters this adapter.
    url.search = new URLSearchParams({ ...params, style: 'FULL', lang: 'en', username: 'khajiev13' }).toString();
    let timeout: ReturnType<typeof setTimeout>;
    let abort: () => void;
    const cancellation = new Promise<never>((_resolve, reject) => {
      abort = () => { controller.abort(); reject(new DOMException('Lookup cancelled', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once: true });
      timeout = setTimeout(() => { controller.abort(); reject(new DOMException('Lookup timed out', 'TimeoutError')); }, remaining);
    });
    try {
      const envelope = await Promise.race([cancellation, (async () => {
        const response = await fetch(url.toString(), { credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('Place lookup unavailable');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || 'status' in data || !('geonames' in data) || !Array.isArray(data.geonames)) throw new Error('Invalid place lookup response');
        const total = 'totalResultsCount' in data ? data.totalResultsCount : undefined;
        if (total !== undefined && (typeof total !== 'number' || !Number.isSafeInteger(total) || total < data.geonames.length)) throw new Error('Invalid place lookup count');
        return { rows: data.geonames, total: total as number | undefined };
      })()]);
      if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
      return envelope;
    } finally {
      clearTimeout(timeout!);
      signal?.removeEventListener('abort', abort!);
    }
  };
}

export function parseGeoNamesPlace(row: unknown, requireState = true): GeoNamesPlace | null {
  if (!row || typeof row !== 'object') return null;
  const p = row as Record<string, unknown>;
  if (!text(p.name) || !text(p.countryName) || !text(p.countryCode) || !/^[A-Z]{2}$/.test(p.countryCode)
    || (requireState && (!text(p.adminName1) || !text(p.adminCode1)))
    || !Number.isSafeInteger(p.geonameId) || Number(p.geonameId) <= 0 || !text(p.fcl) || !text(p.fcode)) return null;
  const longitude = point(p.lng, 180); const latitude = point(p.lat, 90);
  if (longitude === null || latitude === null) return null;
  return { name: p.name, country: p.countryName, countryCode: p.countryCode, state: text(p.adminName1) ? p.adminName1 : '', adminCode1: text(p.adminCode1) ? p.adminCode1 : '', geonameId: Number(p.geonameId), center: [longitude, latitude], fcl: p.fcl, fcode: p.fcode };
}

export const isManualPlace = (place: GeoNamesPlace) => place.fcl === 'P' && /^(?:PPL|PPLC|PPLA[2-5]?|PPLL|PPLR|STLMT)$/.test(place.fcode);
export const isStrongCity = (place: GeoNamesPlace) => place.fcl === 'P' && /^(?:PPLC|PPLA[2-5]?)$/.test(place.fcode);
export const isCityEvidence = (place: GeoNamesPlace) => isManualPlace(place) || (place.fcl === 'A' && /^ADM[2-5]$/.test(place.fcode));
export const sameParents = (a: GeoNamesPlace, b: GeoNamesPlace) => a.countryCode === b.countryCode && a.adminCode1 === b.adminCode1 && same(a.country, b.country) && same(a.state, b.state);
export const completeSearch = (envelope: Envelope) => envelope.total !== undefined && envelope.total === envelope.rows.length && envelope.rows.length <= 20;
export const completeEvidence = (envelope: Envelope) => envelope.total === undefined || envelope.total === envelope.rows.length;
export const matchesCity = (place: GeoNamesPlace, city: CityOption) => same(place.country, city.country) && same(place.state, city.state) && same(place.name, city.city);
// Duplicate rows may corroborate an identity, but conflicting metadata cannot
// be resolved by whichever row happened to be last in the provider response.
export function uniquePlaceIdentity(places: GeoNamesPlace[]): GeoNamesPlace | null {
  if (!places.length) return null;
  const first = places[0];
  return places.every(place => place.geonameId === first.geonameId && sameParents(place, first) && same(place.name, first.name)
    && place.center[0] === first.center[0] && place.center[1] === first.center[1] && place.fcl === first.fcl && place.fcode === first.fcode) ? first : null;
}

export function uniqueStoredCities(cities: CityOption[]): CityOption[] {
  return [...new Map(cities.map(city => [JSON.stringify([city.country, city.state, city.city]), city])).values()];
}
export function toCityPlace(place: GeoNamesPlace, cities: CityOption[]): CityPlace {
  const matches = uniqueStoredCities(cities.filter(city => matchesCity(place, city)));
  const city = matches.length === 1 ? matches[0] : { country: place.country, state: place.state, city: place.name };
  return { ...city, geonameId: place.geonameId, center: place.center };
}

export async function searchCityPlaces(query: string, cities: CityOption[], signal?: AbortSignal): Promise<CityPlace[]> {
  if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
  const name = query.trim();
  if (name.length < 2) return [];
  const result = await createGeoNamesLookup(signal)('searchJSON', { name_startsWith: name, featureClass: 'P', maxRows: '20' });
  const places = result.rows.slice(0, 20).map(row => parseGeoNamesPlace(row)).filter((place): place is GeoNamesPlace => Boolean(place && isManualPlace(place)));
  return [...new Map(places.map(place => [place.geonameId, toCityPlace(place, cities)])).values()];
}

export async function resolvePlaceCenter(geo: GeoSelection, signal?: AbortSignal): Promise<PlaceSelection | null> {
  const name = geo.level === 'city' ? geo.city : geo.level === 'state' ? geo.state : geo.country;
  if (!text(name) || !text(geo.country) || (geo.level === 'city' && !text(geo.state))) return null;
  const result = await createGeoNamesLookup(signal)('searchJSON', { name_equals: name, maxRows: '20', ...(geo.level === 'city' ? { featureClass: 'P' } : { featureClass: 'A', featureCode: geo.level === 'state' ? 'ADM1' : 'PCLI' }) });
  if (!completeSearch(result)) return null;
  const parsed = result.rows.map(row => parseGeoNamesPlace(row, geo.level !== 'country'));
  if (parsed.some(place => !place)) return null;
  const places = parsed.filter((place): place is GeoNamesPlace => Boolean(place && same(place.name, name) && same(place.country, geo.country)
    && (geo.level === 'city' ? isManualPlace(place) && same(place.state, geo.state!) : place.fcl === 'A' && place.fcode === (geo.level === 'state' ? 'ADM1' : 'PCLI') && (geo.level !== 'state' || same(place.state, geo.state!)))));
  const place = uniquePlaceIdentity(places);
  if (!place) return null;
  return { geo, geonameId: place.geonameId, center: place.center };
}
