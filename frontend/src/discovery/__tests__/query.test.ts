import { describe, expect, it } from 'vitest';
import { flattenCities, parseDiscovery, serializeDiscovery } from '../query';
import type { DiscoveryState } from '../types';

const defaults = { geo: null, entity: 'activities', view: 'map', query: '' };

describe('discovery URL state', () => {
  it('roundtrips explicit follow intent without adding fields to unmarked URLs', () => {
    expect(parseDiscovery(new URLSearchParams('loc=auto'))).toEqual({ ...defaults, follow: true });
    const followed: DiscoveryState = { geo: { level: 'city', country: 'Country', state: 'State', city: 'City' }, entity: 'teams', view: 'list', query: 'hello', follow: true };
    expect(new URLSearchParams(serializeDiscovery(followed)).get('loc')).toBe('auto');
    expect(parseDiscovery(new URLSearchParams(serializeDiscovery(followed)))).toEqual(followed);
    expect(parseDiscovery(new URLSearchParams('loc=manual'))).toEqual(defaults);
    expect(parseDiscovery(new URLSearchParams())).not.toHaveProperty('follow');
  });
  it.each([
    ['United Kingdom', 'England', 'Cambridge'],
    ['Brasil', 'São Paulo', 'São José/Área'],
  ])('roundtrips the full city tuple for %s / %s / %s', (country, state, city) => {
    const discovery: DiscoveryState = { geo: { level: 'city', country, state, city }, entity: 'teams', view: 'list', query: 'café / football' };
    expect(parseDiscovery(new URLSearchParams(serializeDiscovery(discovery)))).toEqual(discovery);
  });

  it.each([
    'level=city&state=England&city=Cambridge',
    'level=city&country=United+Kingdom&city=Cambridge',
    'level=city&country=United+Kingdom&state=England',
    'level=state&state=England',
    'level=country&country=++',
    'level=continent&country=United+Kingdom',
  ])('rejects invalid geography: %s', (query) => {
    expect(parseDiscovery(new URLSearchParams(query))).toEqual(defaults);
  });

  it('defaults unknown entity and view while retaining search text', () => {
    expect(parseDiscovery(new URLSearchParams('entity=people&view=grid&q=hello'))).toEqual({ ...defaults, query: 'hello' });
  });

  it('serializes a canonical allowlist without exact coordinates or identity', () => {
    const state: DiscoveryState & { lat: number; lng: number; username: string } = {
      geo: { level: 'city', country: 'United Kingdom', state: 'England', city: 'Cambridge' },
      entity: 'organizations', view: 'list', query: 'café', lat: 12.345678, lng: 23.456789, username: 'example',
    };
    expect(serializeDiscovery(state)).toBe('level=city&country=United+Kingdom&state=England&city=Cambridge&entity=organizations&view=list&q=caf%C3%A9');
    expect(serializeDiscovery(parseDiscovery(new URLSearchParams('lat=12.345678&lng=23.456789&username=example')))).toBe('entity=activities&view=map&q=');
  });

  it.each([
    ['level=country&country=United+Kingdom&state=England&city=Cambridge', { level: 'country', country: 'United Kingdom' }],
    ['level=state&country=United+Kingdom&state=England&city=Cambridge', { level: 'state', country: 'United Kingdom', state: 'England' }],
  ])('discards descendants below the selected level', (query, geo) => {
    const state = parseDiscovery(new URLSearchParams(query));
    expect(state.geo).toEqual(geo);
    expect(parseDiscovery(new URLSearchParams(serializeDiscovery(state)))).toEqual(state);
  });
});

describe('city options', () => {
  it('excludes empty countries/states and deduplicates full tuples, retaining same-name cities', () => {
    expect(flattenCities([
      { name: 'Empty', states: [] },
      { name: 'United Kingdom', states: [{ name: 'England', cities: [{ name: 'Cambridge' }, { name: 'Cambridge' }] }, { name: 'Empty', cities: [] }] },
      { name: 'United Kingdom', states: [{ name: 'England', cities: [{ name: 'Cambridge' }] }, { name: 'Other', cities: [{ name: 'Cambridge' }] }] },
      { name: 'United States', states: [{ name: 'Massachusetts', cities: [{ name: 'Cambridge' }] }] },
    ])).toEqual([
      { country: 'United Kingdom', state: 'England', city: 'Cambridge' },
      { country: 'United Kingdom', state: 'Other', city: 'Cambridge' },
      { country: 'United States', state: 'Massachusetts', city: 'Cambridge' },
    ]);
  });
});
