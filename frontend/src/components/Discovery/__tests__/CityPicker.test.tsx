// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CityPicker } from '../CityPicker';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { fetchCountries, fetchResults } from '@/discovery/api';
import { getLocationPermission, requestDeviceLocation } from '@/discovery/deviceLocation';
import { resolveCurrentCity } from '@/discovery/resolveCity';
import { resolvePlaceCenter, searchCityPlaces } from '@/discovery/geoNames';
import { readDiscoveryPreference } from '@/discovery/preferences';
import type { CityPlace, DiscoveryPreference, PlaceSelection } from '@/discovery/place';
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
vi.mock('@/discovery/deviceLocation', () => ({ getLocationPermission: vi.fn(), requestDeviceLocation: vi.fn() }));
vi.mock('@/discovery/resolveCity', () => ({ resolveCurrentCity: vi.fn() }));
vi.mock('@/discovery/geoNames', () => ({ resolvePlaceCenter: vi.fn(), searchCityPlaces: vi.fn() }));
vi.mock('@/discovery/preferences', () => ({ readCachedDiscoveryPreference: () => ({ preference: null, warning: false }), readDiscoveryPreference: vi.fn(), writeDiscoveryPreference: async () => ({ warning: false }) }));
const countries = [{ name: 'France', states: [{ name: 'Île-de-France', cities: [{ name: 'Paris' }] }] }, { name: 'Other', states: [{ name: 'North', cities: [{ name: 'Paris' }] }] }, { name: 'Empty', states: [] }];
const remote: CityPlace = { country: 'Example', state: 'West', city: 'New City', geonameId: 123, center: [12, 34] };
const stored: PlaceSelection = { geo: { level: 'city', country: 'Saved Country', state: 'Saved State', city: 'Saved City' }, geonameId: 124, center: [10, 20] };
const preference = (recent: PlaceSelection[] = [stored]): DiscoveryPreference => ({ version: 1, mode: 'manual', place: stored, recent, welcomeSeen: true, updatedAt: 1 });
function Probe() {
  const d = useDiscovery();
  return <><button onClick={() => d.openSurface('city')}>Choose place</button><button onClick={() => d.openSurface('city', 'profile')}>Profile city</button><output aria-label="Surface">{d.surface}</output><output aria-label="Place">{JSON.stringify(d.location.place)}</output><output aria-label="Mode">{d.location.mode}</output><CityPicker /></>;
}
async function mount(saved: DiscoveryPreference | null = null) {
  vi.mocked(readDiscoveryPreference).mockResolvedValue({ preference: saved, warning: false });
  const view = render(<MemoryRouter initialEntries={['/map']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Probe /></DiscoveryProvider></MemoryRouter>);
  await act(async () => {}); screen.getByRole('button', { name: 'Choose place' }).focus(); fireEvent.click(screen.getByRole('button', { name: 'Choose place' })); return view;
}
const input = () => screen.getByRole('textbox', { name: 'Search cities' });
const search = async (query: string) => { fireEvent.change(input(), { target: { value: query } }); await act(async () => { vi.advanceTimersByTime(300); }); };
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(fetchCountries).mockResolvedValue(countries); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] });
  vi.mocked(getLocationPermission).mockResolvedValue('unknown'); vi.mocked(searchCityPlaces).mockResolvedValue([]); vi.mocked(resolvePlaceCenter).mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('offers one focused search and explains optional location and following without prompting', async () => {
  await mount(); expect(screen.getAllByRole('textbox')).toHaveLength(1); expect(document.activeElement).toBe(input());
  expect(screen.getByRole('button', { name: 'Use current location' })).toBeTruthy(); expect(screen.getByText(/GeoNames receives your coordinates/)).toBeTruthy(); expect(screen.getByText(/open.*resume/i)).toBeTruthy(); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('debounces two characters for 300ms and preserves focus when global suggestions arrive', async () => {
  vi.mocked(searchCityPlaces).mockResolvedValue([remote]); await mount(); vi.useRealTimers(); vi.useFakeTimers({ shouldAdvanceTime: false });
  await search('N'); expect(searchCityPlaces).not.toHaveBeenCalled();
  fireEvent.change(input(), { target: { value: 'Ne' } }); await act(async () => vi.advanceTimersByTime(299)); expect(searchCityPlaces).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(1)); expect(screen.getByRole('button', { name: 'New City, West, Example' })).toBeTruthy(); expect(document.activeElement).toBe(input());
});
it('selects exact catalogue parents and closes before a missing center finishes', async () => {
  vi.mocked(resolvePlaceCenter).mockImplementation(() => new Promise(() => {})); await mount();
  fireEvent.change(input(), { target: { value: 'North' } }); expect(screen.queryByRole('button', { name: 'Paris, Île-de-France, France' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Paris, North, Other' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByLabelText('Place').textContent).toContain('"country":"Other","state":"North","city":"Paris"'); expect(screen.getByLabelText('Mode').textContent).toBe('manual');
});
it('deduplicates full tuples preserving backend spelling and caps provider rows at twenty', async () => {
  vi.mocked(searchCityPlaces).mockResolvedValue([{ ...remote, country: 'France', state: 'Île-de-France', city: 'PARIS' }, ...Array.from({ length: 23 }, (_, i) => ({ ...remote, city: `Paris ${i}`, geonameId: i + 1000 }))]); await mount(); await search('Paris');
  expect(screen.getByRole('button', { name: 'Paris, Île-de-France, France' })).toBeTruthy(); expect(screen.queryByRole('button', { name: 'PARIS, Île-de-France, France' })).toBeNull(); expect(screen.getByRole('button', { name: 'Paris 18, West, Example' })).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Paris 19, West, Example' })).toBeNull(); expect(screen.getByRole('button', { name: 'Paris, North, Other' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Paris, Île-de-France, France' })); expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByLabelText('Place').textContent).toBe('{"geo":{"level":"city","country":"France","state":"Île-de-France","city":"Paris"},"geonameId":123,"center":[12,34]}');
});
it('shows at most five recents and keeps stored choices available after provider failure', async () => {
  const recent = [stored, ...Array.from({ length: 5 }, (_, i) => ({ ...stored, geo: { ...stored.geo, city: `Saved ${i}` } }))]; vi.mocked(searchCityPlaces).mockRejectedValue(new Error('offline')); await mount(preference(recent));
  expect(within(screen.getByRole('region', { name: 'Recent places' })).getAllByRole('button')).toHaveLength(5); await search('Saved'); expect(screen.getByRole('alert').textContent).toMatch(/search.*unavailable/i);
  fireEvent.click(screen.getByRole('button', { name: 'Saved City, Saved State, Saved Country' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByLabelText('Place').textContent).toContain('Saved City');
});
it('retries global search failure and distinguishes no matches', async () => {
  vi.mocked(searchCityPlaces).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([remote]).mockResolvedValue([]); await mount(); await search('New');
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' })); await act(async () => vi.advanceTimersByTime(300)); expect(screen.getByRole('button', { name: 'New City, West, Example' })).toBeTruthy();
  await search('Unknown'); expect(screen.getByText(/No matching cities/)).toBeTruthy();
});
it('ignores stale query and closed-dialog responses and clears query on reopen', async () => {
  let finish!: (places: CityPlace[]) => void; vi.mocked(searchCityPlaces).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue([]); await mount(); await search('Old'); const signal = vi.mocked(searchCityPlaces).mock.calls[0][2]; await search('Fresh'); expect(signal?.aborted).toBe(true);
  await act(async () => finish([remote])); expect(screen.queryByRole('button', { name: 'New City, West, Example' })).toBeNull();
  vi.mocked(searchCityPlaces).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await search('Close'); fireEvent.click(screen.getByRole('button', { name: 'Close' })); await act(async () => finish([remote])); fireEvent.click(screen.getByRole('button', { name: 'Choose place' })); expect((input() as HTMLInputElement).value).toBe(''); expect(screen.queryByRole('button', { name: 'New City, West, Example' })).toBeNull();
});
it.each(['denied', 'unmatched', 'offline'] as const)('keeps previous city after %s and retries successfully', async reason => {
  if (reason === 'unmatched') { vi.mocked(requestDeviceLocation).mockResolvedValue({ latitude: 12, longitude: 34 }); vi.mocked(resolveCurrentCity).mockResolvedValue(null); }
  else vi.mocked(requestDeviceLocation).mockRejectedValue(new DOMException('Unavailable', reason === 'denied' ? 'NotAllowedError' : 'NetworkError'));
  await mount(preference()); fireEvent.click(screen.getByRole('button', { name: 'Use current location' })); await act(async () => {}); expect(screen.getByRole('dialog')).toBeTruthy(); expect(screen.getByLabelText('Place').textContent).toContain('Saved City'); expect(screen.getByRole('status').textContent).toMatch(reason === 'denied' ? /denied/i : reason === 'unmatched' ? /identify|choose a city/i : /could not|unavailable/i);
  vi.mocked(requestDeviceLocation).mockResolvedValue({ latitude: 12, longitude: 34 }); vi.mocked(resolveCurrentCity).mockResolvedValue(remote); fireEvent.click(screen.getByRole('button', { name: 'Use current location' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(screen.getByLabelText('Mode').textContent).toBe('auto'); expect(screen.getByLabelText('Place').textContent).toContain('New City'); expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
});
it('manual choice cancels GPS so late device results cannot replace it', async () => {
  let finish!: (p: { latitude: number; longitude: number }) => void; vi.mocked(requestDeviceLocation).mockImplementation(() => new Promise(resolve => { finish = resolve; })); await mount(); fireEvent.click(screen.getByRole('button', { name: 'Use current location' })); const signal = vi.mocked(requestDeviceLocation).mock.calls[0][0]; fireEvent.click(screen.getByRole('button', { name: 'Paris, North, Other' })); await act(async () => finish({ latitude: 12, longitude: 34 })); expect(signal?.aborted).toBe(true); expect(screen.getByLabelText('Place').textContent).toContain('Paris'); expect(screen.getByLabelText('Mode').textContent).toBe('manual');
});
it('retains country and state browsing including countries without cities', async () => {
  await mount(); fireEvent.click(screen.getByText('Browse regions')); fireEvent.click(screen.getByRole('button', { name: 'Browse Empty' })); expect(screen.getByLabelText('Place').textContent).toContain('"level":"country","country":"Empty"'); fireEvent.click(screen.getByRole('button', { name: 'Choose place' })); fireEvent.click(screen.getByRole('button', { name: 'Browse Île-de-France, France' })); expect(screen.getByLabelText('Place').textContent).toContain('"level":"state","country":"France","state":"Île-de-France"');
});
it('retries catalogue failure without prompting location', async () => {
  vi.mocked(fetchCountries).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(countries); await mount(); fireEvent.click(screen.getByRole('button', { name: 'Retry cities' })); expect(await screen.findByRole('button', { name: 'Paris, North, Other' })).toBeTruthy(); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('returns to Profile after selecting a city opened there', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(screen.getByRole('button', { name: 'Profile city' })); fireEvent.click(screen.getByRole('button', { name: 'Paris, North, Other' })); expect(screen.getByLabelText('Surface').textContent).toBe('profile');
});
it('restores focus to the opener on close', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Close' })); await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Choose place' })));
});

it.each(['close', 'unmount', 'retry'] as const)('cancels pending GPS on %s without changing the previous city', async action => {
  let finish!: (p: { latitude: number; longitude: number }) => void;
  vi.mocked(requestDeviceLocation).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  if (action === 'retry') vi.mocked(fetchCountries).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(countries);
  const view = await mount(preference()); fireEvent.click(screen.getByRole('button', { name: 'Use current location' }));
  const signal = vi.mocked(requestDeviceLocation).mock.calls[0][0];
  if (action === 'close') fireEvent.click(screen.getByRole('button', { name: 'Close' })); else if (action === 'retry') fireEvent.click(screen.getByRole('button', { name: 'Retry cities' })); else view.unmount();
  await act(async () => finish({ latitude: 12, longitude: 34 })); expect(signal?.aborted).toBe(true);
  if (action === 'close') expect(screen.getByLabelText('Place').textContent).toContain('Saved City');
});
it('keeps an equivalent normalized query active while the provider response is pending', async () => {
  let finish!: (places: CityPlace[]) => void;
  vi.mocked(searchCityPlaces).mockImplementation(() => new Promise(resolve => { finish = resolve; })); await mount(); await search('New');
  fireEvent.change(input(), { target: { value: 'New ' } });
  await act(async () => finish([remote])); expect(screen.getByRole('button', { name: 'New City, West, Example' })).toBeTruthy();
});
it('explicit GPS is not canceled by a previously scheduled search debounce', async () => {
  let finish!: (p: { latitude: number; longitude: number }) => void;
  vi.mocked(requestDeviceLocation).mockImplementation(() => new Promise(resolve => { finish = resolve; })); vi.mocked(resolveCurrentCity).mockResolvedValue(remote);
  await mount(); fireEvent.change(input(), { target: { value: 'New' } }); fireEvent.click(screen.getByRole('button', { name: 'Use current location' }));
  await act(async () => vi.advanceTimersByTime(300)); await act(async () => finish({ latitude: 12, longitude: 34 }));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByLabelText('Mode').textContent).toBe('auto'); expect(screen.getByLabelText('Place').textContent).toContain('New City');
});

it('does not describe a catalogue outage as a completed empty search', async () => {
  vi.mocked(fetchCountries).mockRejectedValue(new Error('offline')); await mount();
  expect(screen.getByRole('button', { name: 'Retry cities' })).toBeTruthy(); expect(screen.queryByText(/No matching cities/)).toBeNull();
});
