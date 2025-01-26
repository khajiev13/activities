import { z } from 'zod';
import TeamSchema from "@/types/TeamsListingSchema.ts";// Adjust import path as needed

const RoleEnum = z.enum([
    'Goalkeeper',
    'Defender',
    'Midfielder',
    'Forward'
]);

const MemberSchema = z.object({
    username: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    image_url: z.string().optional(),
    name_on_jersey: z.string(),
    role: RoleEnum,
    plays_for_division: z.number(),
    gender: z.string(),
    player_number: z.number()
});

const LocationSchema = z.object({
    pk: z.string(),
    name: z.string(),
    points: z.object({
        latitude: z.number(),
        longitude: z.number()
    })
});

const TeamDetailSchema = TeamSchema.extend({
    members: z.array(MemberSchema),
    sponsors: z.array(z.object({
        name: z.string()
    })).optional(),
    belongs_to_organization: z.array(z.object({
        name: z.string()
    })).optional(),
    location: z.array(LocationSchema)
});

// Type export for TypeScript usage
export type TeamDetail = z.infer<typeof TeamDetailSchema>;
export default TeamDetailSchema;