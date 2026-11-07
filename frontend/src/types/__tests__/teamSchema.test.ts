import { describe, expect, it } from 'vitest';
import TeamSchema from '../TeamsListingSchema';
import TeamDetailSchema from '../TeamDetailsSchema';

const team = {
  name: 'Test United', image_url: null, founded_at: '2024-01-01',
  city_name: 'Tashkent', state_name: 'Tashkent', country_name: 'Uzbekistan',
  men_team: true, public_team: true, categories: [], location: [],
  tshirt_color: [], away_tshirt_color: [], shorts_color: [], socks_color: [],
  members: [{ username: 'player', first_name: 'Test', last_name: 'Player',
    image_url: null, plays_for_division: null, name_on_jersey: 'PLAYER',
    role: 'Midfielder', player_number: 7 }],
};

describe('team API schemas', () => {
  it('accepts nullable team and member images, nullable division and a member without gender', () => {
    expect(() => TeamDetailSchema.parse(team)).not.toThrow();
  });
  it('accepts a null founded date in listing and detail without inventing a date', () => {
    expect(TeamSchema.parse({ ...team, founded_at: null }).founded_at).toBeNull();
    expect(TeamDetailSchema.parse({ ...team, founded_at: null }).founded_at).toBeNull();
  });
});
