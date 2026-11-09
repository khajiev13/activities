import { GeoSelectionSchema } from './types';
import type { CityOption, CountryOption, DiscoveryState } from './types';

export function parseDiscovery(params: URLSearchParams): DiscoveryState {
  const geo = GeoSelectionSchema.safeParse({
    level: params.get('level'),
    country: params.get('country'),
    state: params.get('state'),
    city: params.get('city'),
  });
  const entity = params.get('entity');
  return {
    geo: geo.success ? geo.data : null,
    entity: entity === 'teams' || entity === 'organizations' ? entity : 'activities',
    view: params.get('view') === 'list' ? 'list' : 'map',
    query: params.get('q') ?? '',
    ...(params.get('loc') === 'auto' ? { follow: true as const } : {}),
  };
}

export function serializeDiscovery(state: DiscoveryState): string {
  const params = new URLSearchParams();
  const geo = GeoSelectionSchema.safeParse(state.geo);
  if (geo.success) {
    params.set('level', geo.data.level);
    params.set('country', geo.data.country);
    if ('state' in geo.data) params.set('state', geo.data.state);
    if ('city' in geo.data) params.set('city', geo.data.city);
  }
  params.set('entity', state.entity);
  params.set('view', state.view);
  params.set('q', state.query);
  if (state.follow) params.set('loc', 'auto');
  return params.toString();
}

export function flattenCities(countries: CountryOption[]): CityOption[] {
  const cities: CityOption[] = [];
  const seen = new Set<string>();
  for (const country of countries) {
    for (const state of country.states) {
      for (const city of state.cities) {
        const key = JSON.stringify([country.name, state.name, city.name]);
        if (seen.has(key)) continue;
        seen.add(key);
        cities.push({ country: country.name, state: state.name, city: city.name });
      }
    }
  }
  return cities;
}
