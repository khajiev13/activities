import { AxiosHeaders, CanceledError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import client from '../../api/client';
import { fetchCountries, fetchResults } from '../api.ts';
import type { DiscoveryState } from '../types';

const originalAdapter = client.defaults.adapter;
afterEach(() => { client.defaults.adapter = originalAdapter; });

const state: DiscoveryState = {
  geo: { level: 'city', country: 'United Kingdom', state: 'England', city: 'Cambridge' },
  entity: 'activities', view: 'map', query: 'football',
};
const location = { pk: 'pitch', name: 'Pitch', points: { latitude: 52.2, longitude: 0.1 } };
const activity = {
  pk: 'activity', title: 'Football', description: 'Friendly match', date_time: '2026-11-08T10:00:00Z',
  duration_in_minutes: 60, public: true, categories: [{ name: 'Football', pk: 'football' }],
  city: { name: 'Cambridge' }, country: { name: 'United Kingdom' }, state: { name: 'England' }, location,
  creator: { first_name: 'Test', last_name: 'Player', username: 'test', image_url: '' },
  people_joined: [], number_of_people_joined: 0,
  competition: { team_1: { name: null, image_url: null }, team_2: { name: null, image_url: null } },
};
const team = {
  name: 'Test United', founded_at: null, image_url: null, city_name: 'Cambridge', state_name: 'England',
  country_name: 'United Kingdom', location: [location], men_team: true, public_team: true,
  categories: [], tshirt_color: [], away_tshirt_color: [], shorts_color: [], socks_color: [],
};
const organization = {
  pk: 'organization', name: 'Sports Club', created_at: '2026-11-08T10:00:00+05:00', location,
  country: { name: 'United Kingdom' }, state: { name: 'England' }, city: { name: 'Cambridge' }, image_url: null,
  teams_count: 2, number_of_people_joined: 3, number_of_teams_sponsored: 1,
  hosting_leagues_count: 0, hosting_activities_count: 4,
};
function success(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { error: 0, data } };
}

describe('discovery API', () => {
  it('loads the country hierarchy through the shared envelope-unwrapping client', async () => {
    const countries = [{ name: 'United Kingdom', states: [{ name: 'England', cities: [{ name: 'Cambridge' }] }] }];
    const controller = new AbortController();
    client.defaults.adapter = async (config) => {
      expect(config.url).toBe('/api/countries/list/');
      expect(config.signal).toBe(controller.signal);
      return success(config, countries);
    };
    expect(await fetchCountries(controller.signal)).toEqual(countries);
  });

  it('makes no request before a region is selected', async () => {
    let requests = 0;
    client.defaults.adapter = async (config) => { requests++; return success(config, []); };
    expect(await fetchResults({ ...state, geo: null })).toEqual({ activities: [], teams: [], organizations: [] });
    expect(requests).toBe(0);
  });

  it.each(['activities', 'teams', 'organizations'] as const)('falls back to country for slash city and filters exact parents for %s', async (entity) => {
    const geo = { level: 'city', country: 'United Kingdom', state: 'England', city: 'Cambridge/Area' } as const;
    const base = entity === 'activities' ? activity : entity === 'teams' ? team : organization;
    const located = (country: string, region: string, city: string) => entity === 'teams'
      ? { ...base, country_name: country, state_name: region, city_name: city }
      : { ...base, country: { name: country }, state: { name: region }, city: { name: city } };
    client.defaults.adapter = async config => {
      expect(config.url).toBe(`/api/${entity}/country/United%20Kingdom/`);
      expect(config.params).toEqual({ search_by: 'football' });
      return success(config, [located('United Kingdom', 'England', 'Cambridge/Area'), located('Other', 'England', 'Cambridge/Area'), located('United Kingdom', 'Other', 'Cambridge/Area'), located('United Kingdom', 'England', 'Other')]);
    };
    expect((await fetchResults({ ...state, entity, geo }))[entity]).toHaveLength(1);
  });
  it('falls back for a comma-containing literal city rather than CSV-splitting it', async () => {
    client.defaults.adapter = async config => {
      expect(config.url).toBe('/api/activities/country/United%20Kingdom/');
      expect(config.params.search_by).toBe('football');
      return success(config, [{ ...activity, city: { name: 'Cambridge,Area' } }, activity]);
    };
    expect((await fetchResults({ ...state, geo: { level: 'city', country: 'United Kingdom', state: 'England', city: 'Cambridge,Area' } })).activities).toHaveLength(1);
  });
  it('retains unsafe parent names when only the safe child is in the route path', async () => {
    client.defaults.adapter = async config => {
      expect(config.url).toBe('/api/activities/city/Cambridge/');
      expect(config.params).toEqual({ countries: ['A/B'], states: ['North,South'], search_by: 'football' });
      return success(config, []);
    };
    await fetchResults({ ...state, geo: { level: 'city', country: 'A/B', state: 'North,South', city: 'Cambridge' } });
  });
  it.each(['North/South', 'North,South'])('uses exact state filtering for literal state %s', async (region) => {
    client.defaults.adapter = async config => {
      expect(config.url).toBe('/api/activities/country/United%20Kingdom/');
      return success(config, [{ ...activity, state: { name: region } }, activity]);
    };
    expect((await fetchResults({ ...state, geo: { level: 'state', country: 'United Kingdom', state: region } })).activities).toHaveLength(1);
  });
  it.each(['A/B', 'A,B'])('rejects unsafe country %s with region-choice guidance without transport', async (country) => {
    client.defaults.adapter = async () => { throw new Error('must not request'); };
    await expect(fetchResults({ ...state, geo: { level: 'country', country } })).rejects.toThrow(/choose another region/i);
  });

  it.each(['A/B', 'A,B'])('rejects unsafe country fallback %s without transport', async (country) => {
    client.defaults.adapter = async () => { throw new Error('must not request'); };
    await expect(fetchResults({ ...state, geo: { level: 'city', country, state: 'England', city: 'Cambridge/Area' } })).rejects.toThrow(/choose another region/i);
    await expect(fetchResults({ ...state, geo: { level: 'state', country, state: 'North,South' } })).rejects.toThrow(/choose another region/i);
  });

  it.each([
    [{ level: 'country', country: 'United Kingdom' } as const, '/api/activities/country/United%20Kingdom/', { search_by: 'football' }],
    [{ level: 'state', country: 'United Kingdom', state: 'England' } as const, '/api/activities/state/England/', { countries: ['United Kingdom'], search_by: 'football' }],
  ])('preserves explicit %s browsing', async (geo, url, params) => {
    client.defaults.adapter = async (config) => {
      expect(config.url).toBe(url);
      expect(config.params).toEqual(params);
      return success(config, []);
    };
    await fetchResults({ ...state, geo });
  });

  it.each([
    ['activities', activity], ['teams', team], ['organizations', organization],
  ] as const)('populates only the selected %s array while retaining payload fields', async (entity, item) => {
    client.defaults.adapter = async (config) => {
      expect(config.url).toBe(`/api/${entity}/city/Cambridge/`);
      expect(config.params.search_by).toBe('football');
      return success(config, [item]);
    };
    const expected = entity === 'organizations' ? { ...organization, created_at: new Date('2026-11-08T05:00:00Z') } : item;
    expect(await fetchResults({ ...state, entity })).toEqual({ activities: [], teams: [], organizations: [], [entity]: [expected] });
  });

  it('accepts the date-only created_at returned by existing organization creation', async () => {
    client.defaults.adapter = async (config) => success(config, [{ ...organization, created_at: '2026-11-08' }]);
    const results = await fetchResults({ ...state, entity: 'organizations' });
    expect(results.organizations[0].created_at).toEqual(new Date('2026-11-08T00:00:00Z'));
  });

  it('does not turn a cancelled unselected request into empty success', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchResults({ ...state, geo: null }, controller.signal)).rejects.toBeInstanceOf(CanceledError);
  });

  it('rejects malformed payloads instead of fabricating an empty result', async () => {
    client.defaults.adapter = async (config) => success(config, [{}]);
    await expect(fetchResults(state)).rejects.toThrow();
  });

  it('propagates transport failure', async () => {
    client.defaults.adapter = async () => { throw new Error('Offline'); };
    await expect(fetchResults(state)).rejects.toThrow('Offline');
  });

  it('rejects a pre-aborted results request before transport', async () => {
    const controller = new AbortController();
    controller.abort();
    let requests = 0;
    client.defaults.adapter = async (config) => { requests++; return success(config, []); };
    await expect(fetchResults(state, controller.signal)).rejects.toBeInstanceOf(CanceledError);
    expect(requests).toBe(0);
  });

  it('rejects results cancelled during transport even if transport returns data', async () => {
    const controller = new AbortController();
    client.defaults.adapter = async (config) => {
      expect(config.signal).toBe(controller.signal);
      controller.abort();
      return success(config, [activity]);
    };
    await expect(fetchResults(state, controller.signal)).rejects.toBeInstanceOf(CanceledError);
  });

  it('propagates countries cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchCountries(controller.signal)).rejects.toBeInstanceOf(CanceledError);
  });
});
