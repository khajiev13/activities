import axiosInstance from '@/axios';

export interface LocationDetails {
  country: string;
  state: string;
  city: string;
  location_pk: string;
  location_name: string;
  country_code: string;
  timezone: string;
  sunrise: string;
  sunset: string;
}
export type ManualLocationGeo = Pick<LocationDetails, 'country' | 'state' | 'city'>;
export class LocationSelectionError extends Error {
  readonly retryable = true;
  constructor(message: string) { super(message); this.name = 'LocationSelectionError'; }
}
const optionalDetails = { country_code: '', timezone: '', sunrise: '', sunset: '' };
async function providerJson(path: string, lng: number, lat: number) {
  const query = new URLSearchParams({ lat: String(lat), lng: String(lng), username: 'khajiev13' });
  // Venue lookup is separate from discovery GPS, and never carries Eventopia credentials.
  const response = await fetch(`https://secure.geonames.org/${path}?${query}`, { credentials: 'omit' });
  if (!response.ok) throw new LocationSelectionError('Location lookup is unavailable. Try again or enter the geography manually.');
  return response.json();
}
export async function AddLocation(name: string, lng: number, lat: number, manualGeo?: ManualLocationGeo): Promise<LocationDetails> {
  if (!name.trim() || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    throw new LocationSelectionError('Enter a venue name and valid longitude and latitude.');
  }
  try {
    let geo = manualGeo;
    let extra = { ...optionalDetails };
    if (!geo) {
      const data = await providerJson('findNearbyPlaceNameJSON', lng, lat);
      const place = data.geonames?.[0];
      geo = { country: place?.countryName, state: place?.adminName1, city: place?.name };
    }
    if (![geo.country, geo.state, geo.city].every(value => typeof value === 'string' && value.trim())) {
      throw new LocationSelectionError('Enter country, state or region, and city to complete this location.');
    }
    if (!manualGeo) {
      try {
        const time = await providerJson('timezoneJSON', lng, lat);
        const text = (value: unknown) => typeof value === 'string' ? value : '';
        extra = { country_code: text(time.countryCode), timezone: text(time.timezoneId), sunrise: text(time.sunrise), sunset: text(time.sunset) };
      } catch { /* Timezone and sun data are optional; complete geography is sufficient. */ }
    }
    const response = await axiosInstance.post('/api/locations/', { name: name.trim(), longitude: lng, latitude: lat, country: geo.country.trim(), state: geo.state.trim(), city: geo.city.trim() });
    if (typeof response.data?.pk !== 'string' || !response.data.pk || typeof response.data?.name !== 'string' || !response.data.name) {
      throw new LocationSelectionError('The venue response was incomplete. Please try again.');
    }
    return { ...geo, ...extra, location_pk: response.data.pk, location_name: response.data.name };
  } catch (error) {
    if (error instanceof LocationSelectionError) throw error;
    throw new LocationSelectionError('Could not save this location. Try again or enter the geography manually.');
  }
}
