import { CanceledError } from 'axios';
import { z } from 'zod';
import client from '@/api/client';
import { ActivityCardProps } from '@/types/ActivitiesListSchema';
import TeamSchema from '@/types/TeamsListingSchema';
import { OrganizationListingSchema } from '@/types/OrganizationsListingSchema';
import { GeoSelectionSchema } from './types';
import type { CountryOption, DiscoveryResults, DiscoveryState } from './types';

const countriesSchema = z.array(z.object({
  name: z.string(),
  states: z.array(z.object({
    name: z.string(),
    cities: z.array(z.object({ name: z.string() })),
  })),
}));

export async function fetchCountries(signal?: AbortSignal): Promise<CountryOption[]> {
  const response = await client.get('/api/countries/list/', { signal });
  return countriesSchema.parse(response.data);
}

export async function fetchResults(state: DiscoveryState, signal?: AbortSignal): Promise<DiscoveryResults> {
  if (signal?.aborted) throw new CanceledError();
  const results: DiscoveryResults = { activities: [], teams: [], organizations: [] };
  if (!state.geo) return results;
  const geo = GeoSelectionSchema.parse(state.geo);
  const name = geo.level === 'country' ? geo.country : geo.level === 'state' ? geo.state : geo.city;
  // Existing path handlers split comma lists and cannot route encoded slashes.
  // Parent array query values remain safe; inspect only the literal path segment.
  const unsafePath = /[,/]/.test(name);
  const fallback = geo.level !== 'country' && unsafePath;
  if ((geo.level === 'country' || fallback) && /[,/]/.test(geo.country)) {
    throw new Error('This country cannot be loaded. Please choose another region.');
  }
  const level = fallback ? 'country' : geo.level;
  const params = {
    ...(!fallback && geo.level !== 'country' ? { countries: [geo.country] } : {}),
    ...(!fallback && geo.level === 'city' ? { states: [geo.state] } : {}),
    search_by: state.query,
  };
  const response = await client.get(`/api/${state.entity}/${level}/${encodeURIComponent(fallback ? geo.country : name)}/`, { params, signal });
  switch (state.entity) {
    case 'activities':
      results.activities = z.array(ActivityCardProps).parse(response.data);
      break;
    case 'teams':
      results.teams = z.array(TeamSchema).parse(response.data);
      break;
    case 'organizations':
      results.organizations = z.array(OrganizationListingSchema).parse(response.data);
      break;
  }
  if (fallback) {
    const matches = (country: string, region: string, city: string) => country === geo.country
      && region === geo.state && (geo.level !== 'city' || city === geo.city);
    results.activities = results.activities.filter(item => matches(item.country.name, item.state.name, item.city.name));
    results.teams = results.teams.filter(item => matches(item.country_name, item.state_name, item.city_name));
    results.organizations = results.organizations.filter(item => matches(item.country.name, item.state.name, item.city.name));
  }
  return results;
}
