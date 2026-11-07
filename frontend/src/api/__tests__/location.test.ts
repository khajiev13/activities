import axios, { AxiosHeaders } from 'axios';
import { afterEach, expect, it } from 'vitest';
import client from '../client';
import { AddLocation } from '../../components/Map/MapFunctions/AddLocation';

const originalAdapter = axios.defaults.adapter;
const originalClientAdapter = client.defaults.adapter;
afterEach(() => { axios.defaults.adapter = originalAdapter; client.defaults.adapter = originalClientAdapter; });

it('adapts the created location pk/name and retains geocoding details for activity selection', async () => {
  axios.defaults.adapter = async (config) => ({ config, status: 200, statusText: 'OK', headers: new AxiosHeaders(),
    data: config.url?.includes('timezoneJSON') ? { countryCode: 'UZ', sunrise: '06:00', sunset: '18:00', timezoneId: 'Asia/Tashkent' }
      : { geonames: [{ countryName: 'Uzbekistan', adminName1: 'Tashkent', name: 'Tashkent' }] } });
  client.defaults.adapter = async (config) => {
    expect(config.url).toBe('/api/locations/');
    expect(JSON.parse(config.data)).toEqual({ name: 'Test pitch', longitude: 69.24, latitude: 41.3,
      country: 'Uzbekistan', state: 'Tashkent', city: 'Tashkent' });
    return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(),
      data: { requestId: 'test', error: 0, data: { pk: 'pitch-1', name: 'Test pitch', points: { latitude: 41.3, longitude: 69.24 } } } };
  };
  expect(await AddLocation('Test pitch', 69.24, 41.3)).toMatchObject({
    location_pk: 'pitch-1', location_name: 'Test pitch', country: 'Uzbekistan', state: 'Tashkent', city: 'Tashkent',
    sunrise: '06:00', sunset: '18:00', timezone: 'Asia/Tashkent', country_code: 'UZ',
  });
});
