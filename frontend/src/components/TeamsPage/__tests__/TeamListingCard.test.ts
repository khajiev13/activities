import { expect, it } from 'vitest';
import TeamListingCard from '../TeamListingCard';
import type { TeamType } from '@/pages/Teams/Teams';

it('renders valid teams without optional kit colors so listing controls remain available', () => {
  const team: TeamType = {
    name: 'No-kit team', image_url: null, founded_at: null,
    city_name: 'Beijing', state_name: 'Beijing', country_name: 'China',
    men_team: true, public_team: true, categories: [],
    location: [{ pk: 'pitch', name: 'Pitch', points: { latitude: 39.9, longitude: 116.4 } }],
    tshirt_color: [], shorts_color: [], socks_color: [], away_tshirt_color: [],
  };
  expect(() => TeamListingCard({ teams: [team] })).not.toThrow();
});
