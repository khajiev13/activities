import { DiscoveryPage } from '@/components/Discovery/DiscoveryPage';
import type TeamSchema from '@/types/TeamsListingSchema';
import type { z } from 'zod';
export type TeamType = z.infer<typeof TeamSchema>;
export default function Teams() { return <DiscoveryPage entity="teams" />; }
