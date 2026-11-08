import type { DevicePosition } from './deviceLocation';
import type { CityOption } from './types';

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
type Place = { name?: unknown; countryName?: unknown; adminName1?: unknown; geonameId?: unknown; fcl?: unknown; fcode?: unknown };

async function lookup(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<Place[]> {
  if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
  const controller = new AbortController();
  const url = new URL(endpoint, 'https://secure.geonames.org/');
  // Reuse the existing public GeoNames account; no Eventopia authentication.
  url.search = new URLSearchParams({ ...params, lang: 'en', username: 'khajiev13' }).toString();
  let timeout: ReturnType<typeof setTimeout>;
  let abort: () => void;
  const cancellation = new Promise<never>((_resolve, reject) => {
    abort = () => { controller.abort(); reject(new DOMException('Lookup cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(() => { controller.abort(); reject(new DOMException('Lookup timed out', 'TimeoutError')); }, 5000);
  });
  try {
    const places = await Promise.race([cancellation, (async () => {
      const response = await fetch(url.toString(), { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('City lookup unavailable');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || 'status' in data || !('geonames' in data) || !Array.isArray(data.geonames)) throw new Error('Invalid city lookup response');
      return data.geonames.filter((place): place is Place => Boolean(place) && typeof place === 'object');
    })()]);
    if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
    return places;
  } finally {
    clearTimeout(timeout!);
    signal?.removeEventListener('abort', abort!);
  }
}

export async function resolveCity(position: DevicePosition, cities: CityOption[], signal?: AbortSignal): Promise<CityOption | null> {
  const [place] = await lookup('findNearbyPlaceNameJSON', { lat: String(position.latitude), lng: String(position.longitude) }, signal);
  if (!place || !text(place.name) || !text(place.countryName) || !text(place.adminName1)) return null;
  const country = normalize(place.countryName);
  const state = normalize(place.adminName1);
  const compatible = cities.filter(city => normalize(city.country) === country && normalize(city.state) === state);
  const unique = (candidates: CityOption[]) => {
    const tuples = new Map(candidates.map(city => [JSON.stringify([city.country, city.state, city.city]), city]));
    return tuples.size === 1 ? [...tuples.values()][0] : null;
  };
  const direct = compatible.filter(city => normalize(city.city) === normalize(place.name as string));
  if (direct.length) return unique(direct);
  if (!compatible.length || !Number.isSafeInteger(place.geonameId) || Number(place.geonameId) <= 0) return null;
  const ancestors = await lookup('hierarchyJSON', { geonameId: String(place.geonameId) }, signal);
  // Hierarchies also contain continents, countries and states. A matching name
  // at those levels is not evidence for a city, even when its parents agree.
  // Municipality levels vary by country, so allow lower administrative levels
  // alongside populated places, with complete compatible parent/identity data.
  const names = new Set(ancestors.filter(ancestor => text(ancestor.name)
    && Number.isSafeInteger(ancestor.geonameId) && Number(ancestor.geonameId) > 0
    && text(ancestor.countryName) && normalize(ancestor.countryName) === country
    && text(ancestor.adminName1) && normalize(ancestor.adminName1) === state
    && text(ancestor.fcode) && ((ancestor.fcl === 'P' && /^PPL(?:[A-Z0-9]*)$/.test(ancestor.fcode))
      || (ancestor.fcl === 'A' && /^ADM[2-5]$/.test(ancestor.fcode))))
    .map(ancestor => normalize(ancestor.name as string)));
  return unique(compatible.filter(city => names.has(normalize(city.city))));
}
