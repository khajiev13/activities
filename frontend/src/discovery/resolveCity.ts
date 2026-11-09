import type { DevicePosition } from './deviceLocation';
import type { CityPlace } from './place';
import { normalizePlaceName } from './place';
import { completeEvidence, completeSearch, createGeoNamesLookup, isCityEvidence, isManualPlace, isStrongCity, matchesCity, parseGeoNamesPlace, sameParents, toCityPlace, uniquePlaceIdentity, uniqueStoredCities } from './geoNames';
import type { GeoNamesPlace } from './geoNames';
import type { CityOption } from './types';

export async function resolveCurrentCity(position: DevicePosition, cities: CityOption[], signal?: AbortSignal): Promise<CityPlace | null> {
  const lookup = createGeoNamesLookup(signal);
  const nearby = await lookup('findNearbyPlaceNameJSON', { lat: String(position.latitude), lng: String(position.longitude), maxRows: '1', localCountry: 'true' });
  if (!completeEvidence(nearby) || nearby.rows.length !== 1) return null;
  const direct = parseGeoNamesPlace(nearby.rows[0]);
  if (!direct || !isManualPlace(direct)) return null;
  const hierarchy = await lookup('hierarchyJSON', { geonameId: String(direct.geonameId) });
  if (!completeEvidence(hierarchy) || hierarchy.rows.length === 0) return null;
  const ancestors: GeoNamesPlace[] = [];
  for (const row of hierarchy.rows) {
    if (!row || typeof row !== 'object') return null;
    const record = row as Record<string, unknown>;
    // Continent, country and ADM1 names cannot prove an independent city.
    if (record.fcl !== 'P' && !(typeof record.fcode === 'string' && /^(?:PPL|ADM[2-5])/.test(record.fcode))) continue;
    const place = parseGeoNamesPlace(row);
    if (!place) return null;
    if (!isCityEvidence(place)) continue;
    if (!sameParents(place, direct)) return null;
    ancestors.push(place);
  }
  const names = new Map(ancestors.map(place => [normalizePlaceName(place.name), place.name]));
  // Every distinct compatible name needs evidence. Never choose a prefix of an
  // over-budget hierarchy just because a candidate already looks convincing.
  if (names.size > 3) return null;
  const evidence = [direct, ...ancestors];
  const strong = evidence.filter(isStrongCity);
  for (const name of names.values()) {
    const result = await lookup('searchJSON', { name_equals: name, country: direct.countryCode, adminCode1: direct.adminCode1, featureClass: 'P', maxRows: '20' });
    if (!completeSearch(result)) return null;
    for (const row of result.rows) {
      const place = parseGeoNamesPlace(row);
      if (!place) return null;
      if (isStrongCity(place) && sameParents(place, direct) && normalizePlaceName(place.name) === normalizePlaceName(name)) strong.push(place);
    }
  }
  const selected = uniquePlaceIdentity(strong);
  if (!selected) return null;
  // A stored district is still a distinct browsing tuple. Gathering both direct
  // and parent matches prevents silently changing which catalogue is queried.
  const stored = uniqueStoredCities(cities.filter(city => evidence.some(place => matchesCity(place, city)) || matchesCity(selected, city)));
  if (stored.length > 1 || (stored.length === 1 && !matchesCity(selected, stored[0]))) return null;
  return toCityPlace(selected, cities);
}

// Legacy detector consumes coarse tuples; all resolution remains above.
export async function resolveCity(position: DevicePosition, cities: CityOption[], signal?: AbortSignal): Promise<CityOption | null> {
  const place = await resolveCurrentCity(position, cities, signal);
  return place ? { country: place.country, state: place.state, city: place.city } : null;
}
