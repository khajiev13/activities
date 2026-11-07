import { expect, it } from 'vitest';
import type { Map as TilerMap, MapMouseEvent } from '@maptiler/sdk';
import { displayOrganizations } from '../DisplayOrganizations';
import type { OrganizationListingType } from '@/types/OrganizationsListingSchema';

it('plots organizations by coordinates, opens the clicked organization and cleans up owned map resources', () => {
  const organization: OrganizationListingType = {
    pk: 'org-1', name: 'QA Organization', created_at: new Date(), image_url: null,
    country: { name: 'China' }, state: { name: 'Beijing' }, city: { name: 'Beijing' },
    location: { pk: 'location-1', name: 'Pitch', points: { latitude: 39.9, longitude: 116.4 } },
    teams_count: 0, number_of_people_joined: 0, number_of_teams_sponsored: 0,
    hosting_leagues_count: 0, hosting_activities_count: 0,
  };
  const sources = new Map<string, unknown>();
  const layers = new Set<string>();
  let click: ((event: MapMouseEvent) => void) | undefined;
  let selected: OrganizationListingType | undefined;
  let open = false;
  const map = {
    addSource: (id: string, source: unknown) => sources.set(id, source),
    addLayer: (layer: { id: string }) => layers.add(layer.id),
    on: (_event: string, _layer: string, handler: typeof click) => { click = handler; },
    off: (_event: string, _layer: string, handler: typeof click) => { if (click === handler) click = undefined; },
    getLayer: (id: string) => layers.has(id), getSource: (id: string) => sources.get(id),
    removeLayer: (id: string) => layers.delete(id), removeSource: (id: string) => sources.delete(id),
    queryRenderedFeatures: () => [{ properties: { pk: 'org-1' } }],
  };
  const cleanup = displayOrganizations([organization], map as unknown as TilerMap, (value) => { selected = value; }, (value) => { open = value; });
  expect(sources.get('organizations')).toMatchObject({ data: { features: [{ geometry: { coordinates: [116.4, 39.9] }, properties: { pk: 'org-1' } }] } });
  click!({ point: { x: 10, y: 10 } } as MapMouseEvent);
  expect(selected?.name).toBe('QA Organization');
  expect(open).toBe(true);
  cleanup();
  expect(click).toBeUndefined();
  expect(layers.size).toBe(0);
  expect(sources.size).toBe(0);
});
