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
  const params = {
    ...(geo.level !== 'country' ? { countries: [geo.country] } : {}),
    ...(geo.level === 'city' ? { states: [geo.state] } : {}),
    search_by: state.query,
  };
  const response = await client.get(`/api/${state.entity}/${geo.level}/${encodeURIComponent(name)}/`, { params, signal });
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
  return results;
}
