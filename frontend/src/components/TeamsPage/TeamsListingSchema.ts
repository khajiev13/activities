import { z } from 'zod';

const TeamSchema = z.object({
  away_tshirt_color: z.array(
    z.object({
      name: z.string(),
    })
  ),
  categories: z.array(
    z.object({
      is_indoor: z.boolean(),
      is_online: z.boolean(),
      is_outdoor: z.boolean(),
      name: z.string(),
      pk: z.string(),
    })
  ),
  city_name: z.string(),
  country_name: z.string(),
  founded_at: z.string(),
  image_url: z.string().url(),
  location: z.array(
    z.object({
      name: z.string(),
      pk: z.string(),
      points: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
    })
  ),

  men_team: z.boolean(),
  name: z.string(),
  public_team: z.boolean(),
  shorts_color: z.array(
    z.object({
      name: z.string(),
    })
  ),
  socks_color: z.array(
    z.object({
      name: z.string(),
    })
  ),
  state_name: z.string(),
  tshirt_color: z.array(
    z.object({
      name: z.string(),
    })
  ),
});

export default TeamSchema;
