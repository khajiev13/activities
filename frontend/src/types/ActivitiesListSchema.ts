import { z } from 'zod';

export const ActivityCardProps = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      pk: z.string(),
    })
  ),
  city: z.object({
    name: z.string(),
  }),
  competition: z.object({
    team_1: z.object({
      image_url: z.string().nullable(),
      name: z.string().nullable(),
    }),
    team_2: z.object({
      image_url: z.string().nullable(),
      name: z.string().nullable(),
    }),
  }),
  country: z.object({
    name: z.string(),
  }),
  creator: z.object({
    first_name: z.string(),
    image_url: z.string(),
    last_name: z.string(),
    username: z.string(),
  }),
  date_time: z.string(),
  description: z.string(),
  duration_in_minutes: z.number(),
  location: z.object({
    name: z.string(),
    pk: z.string(),
    points: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
  number_of_people_joined: z.number(),
  people_joined: z.array(
    z.object({
      first_name: z.string().nullable(),
      image_url: z.string().nullable(),
      last_name: z.string().nullable(),
      username: z.string().nullable(),
    })
  ),
  pk: z.string(),
  public: z.boolean(),
  state: z.object({
    name: z.string(),
  }),
  title: z.string(),
});

export const ActivityDetailsType = z.object({
  title: z.string(),
  description: z.string(),
  date_time: z.string(),
  duration_in_minutes: z.number(),
  public: z.boolean(),
  pk: z.string(),
  city: z.object({
    name: z.string(),
  }),
  country: z.object({
    name: z.string(),
  }),
  state: z.object({
    name: z.string(),
  }),
  location: z.object({
    name: z.string(),
  }),
  categories: z.array(
    z.object({
      name: z.string(),
    })
  ),
  creator: z.object({
    first_name: z.string(),
    last_name: z.string(),
    username: z.string(),
    image_url: z.string(),
  }),
  people_joined: z.array(
    z.object({
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
      username: z.string().nullable(),
      image_url: z.string().nullable(),
    })
  ),
  number_of_people_joined: z.number(),
  competition: z.object({
    team_1: z.object({
      name: z.string().nullable(),
      image_url: z.string().nullable(),
    }),
    team_2: z.object({
      name: z.string().nullable(),
      image_url: z.string().nullable(),
    }),
  }),
});

export type ActivityDetailsType = z.infer<typeof ActivityDetailsType>;

export type ActivityCardPropsType = z.infer<typeof ActivityCardProps>;
