import { z } from 'zod';

export const OrganizationListingSchema = z.object({
  pk: z.string(),
  name: z.string(),
  created_at: z.date(),
  location: z.object({
    name: z.string(),
    pk: z.string(),
    points: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
  country: z.object({
    name: z.string(),
  }),
  state: z.object({
    name: z.string(),
  }),
  city: z.object({
    name: z.string(),
  }),
  image_url: z.string().nullable(),
  teams_count: z.number(),
  number_of_people_joined: z.number(),
  number_of_teams_sponsored: z.number(),
  hosting_leagues_count: z.number().nullable(),
  hosting_activities_count: z.number(),
});

export type OrganizationListingType = z.infer<typeof OrganizationListingSchema>;
