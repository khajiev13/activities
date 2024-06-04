import { z } from 'zod';
import TeamSchema from '../TeamsPage/TeamsListingSchema';
import { ActivityCardProps } from '../ActivitiesPage/ActivitiesListSchema';

const OrganizationDetailSchema = z.object({
  pk: z.string(),
  name: z.string(),
  image_url: z.string().nullable(),
  created_at: z.date(),
  location: z.object({
    pk: z.string(),
    name: z.string(),
    points: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
  members: z.array(
    z.object({
      username: z.string().nullable(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
      image_url: z.string().nullable(),
    })
  ),
  state: z.object({
    name: z.string(),
  }),
  city: z.object({
    name: z.string(),
  }),
  sponsors: TeamSchema.array(),
  teams: TeamSchema.array(),
  hosting_activities: ActivityCardProps.array(),
  hosting_leagues: z.string().nullable(),
});

export type OrganizationListingType = z.infer<typeof OrganizationDetailSchema>;
