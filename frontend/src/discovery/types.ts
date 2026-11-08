import { z } from 'zod';
import type { ActivityCardPropsType } from '@/types/ActivitiesListSchema';
import type { TeamType } from '@/pages/Teams/Teams';
import type { OrganizationListingType } from '@/types/OrganizationsListingSchema';

export type DiscoveryEntity = 'activities' | 'teams' | 'organizations';
export type DiscoveryView = 'map' | 'list';

const geoName = z.string().refine((name) => name.trim().length > 0);
export const GeoSelectionSchema = z.discriminatedUnion('level', [
  z.object({ level: z.literal('country'), country: geoName }),
  z.object({ level: z.literal('state'), country: geoName, state: geoName }),
  z.object({ level: z.literal('city'), country: geoName, state: geoName, city: geoName }),
]);

export type GeoSelection = {
  level: 'country' | 'state' | 'city';
  country: string;
  state?: string;
  city?: string;
};
export type CountryOption = { name: string; states: { name: string; cities: { name: string }[] }[] };
export type CityOption = { country: string; state: string; city: string };
export type DiscoveryState = {
  geo: GeoSelection | null;
  entity: DiscoveryEntity;
  view: DiscoveryView;
  query: string;
};
export type DiscoveryResults = {
  activities: ActivityCardPropsType[];
  teams: TeamType[];
  organizations: OrganizationListingType[];
};
