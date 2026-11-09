import { z } from 'zod';
import { GeoSelectionSchema } from './types';
import type { CityOption, GeoSelection } from './types';

export type PlaceSelection = { geo: GeoSelection; geonameId?: number; center?: [number, number] };
export type CityPlace = CityOption & { geonameId: number; center: [number, number] };
export type LocationMode = 'auto' | 'manual' | 'off';
export type DiscoveryPreference = {
  version: 1;
  mode: LocationMode;
  place: PlaceSelection | null;
  recent: PlaceSelection[];
  welcomeSeen: boolean;
  updatedAt: number;
};

export function normalizePlaceName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function placeKey(place: PlaceSelection): string {
  const { level, country, state, city } = place.geo;
  return JSON.stringify([level, country, state ?? '', city ?? ''].map(normalizePlaceName));
}

export const PlaceSelectionSchema = z.object({
  geo: GeoSelectionSchema,
  geonameId: z.number().int().positive().safe().optional(),
  center: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]).optional(),
}).refine(place => (place.geonameId === undefined) === (place.center === undefined));

export const DiscoveryPreferenceSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['auto', 'manual', 'off']),
  place: PlaceSelectionSchema.nullable(),
  recent: z.array(PlaceSelectionSchema).transform(places => {
    const seen = new Set<string>();
    return places.filter(place => {
      const key = placeKey(place);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }),
  welcomeSeen: z.boolean(),
  updatedAt: z.number().finite().nonnegative(),
});
