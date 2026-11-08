// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { AxiosHeaders, type AxiosAdapter } from 'axios';
import client from '@/api/client';
import SelectLocation from '../SelectLocation';
import { MemoryRouter } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { fetchCountries } from '@/discovery/api';
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
const resources = vi.hoisted(() => ({ click: new Set<(event: { lngLat: { lng: number; lat: number } }) => void>(), markers: 0 }));
vi.mock('@maptiler/sdk', () => ({ Popup: class { _content = document.createElement('div'); setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() {} }, Marker: class { constructor() { resources.markers++; } setLngLat() { return this; } addTo() { return this; } remove() { resources.markers--; } } }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({ destroy() {} }) } }));
vi.mock('../Map/BaseMap', () => ({ default: function MockBaseMap({ onMapLoad, onMapError }: { onMapLoad: (map: unknown) => void; onMapError?: () => void }) {
  useEffect(() => { onMapLoad({ on: (_: string, fn: never) => resources.click.add(fn), off: (_: string, fn: never) => resources.click.delete(fn) }); }, [onMapLoad]);
  return <><button type="button" onClick={() => { for (const fn of resources.click) fn({ lngLat: { lng: 10, lat: 20 } }); }}>Choose example map point</button><button type="button" onClick={onMapError}>Simulate unavailable map</button></>;
} }));
const original = client.defaults.adapter;
let writes = 0;
beforeEach(() => { writes = 0; resources.click.clear(); resources.markers = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('timezoneJSON') ? { timezoneId: 'UTC' } : { geonames: [{ countryName: 'Example country', adminName1: 'Example state', name: 'Example city' }] } })));
  client.defaults.adapter = async config => { writes++; return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'venue-1', name: JSON.parse(config.data).name } } }; };
});
afterEach(() => { cleanup(); client.defaults.adapter = original; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('selects a map point, accepts a React-controlled name, and releases map listeners and markers', async () => {
  const chosen = vi.fn(); const view = render(<SelectLocation setLocation={chosen} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose example map point' }));
  expect(screen.getByRole('status').textContent).toMatch(/Point selected/);
  fireEvent.change(screen.getByLabelText('Venue name'), { target: { value: 'Example pitch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this location' }));
  await waitFor(() => expect(chosen).toHaveBeenCalledWith(expect.objectContaining({ location_pk: 'venue-1', location_name: 'Example pitch', city: 'Example city' })));
  fireEvent.click(screen.getByRole('button', { name: 'Choose example map point' }));
  expect(resources.markers).toBe(1); view.unmount(); expect(resources.markers).toBe(0); expect(resources.click.size).toBe(0);
});
it('retains the name and point after API failure and permits retry', async () => {
  let fail = true; const ok = client.defaults.adapter;
  client.defaults.adapter = async config => { if (fail) throw new Error('offline'); return (ok as AxiosAdapter)(config); };
  const chosen = vi.fn(); render(<SelectLocation setLocation={chosen} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose example map point' }));
  fireEvent.change(screen.getByLabelText('Venue name'), { target: { value: 'Example pitch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this location' })); expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Venue name') as HTMLInputElement).value).toBe('Example pitch');
  expect((screen.getByRole('button', { name: 'Use this location' }) as HTMLButtonElement).disabled).toBe(false);
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Use this location' })); await waitFor(() => expect(chosen).toHaveBeenCalledOnce());
});
it('recovers from provider failure using complete manual geography and coordinates', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider offline')));
  const chosen = vi.fn(); render(<SelectLocation setLocation={chosen} />);
  fireEvent.click(screen.getByRole('button', { name: 'Simulate unavailable map' }));
  fireEvent.change(screen.getByLabelText('Venue name'), { target: { value: 'Example manual pitch' } });
  fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this location' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toBe(0);
  for (const [label, value] of [['Country', 'Example country'], ['State or region', 'Example state'], ['City', 'Example city']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this location' }));
  await waitFor(() => expect(chosen).toHaveBeenCalledWith(expect.objectContaining({ location_name: 'Example manual pitch', city: 'Example city' }))); expect(writes).toBe(1);
});
it('locks a pending location write against repeat clicks', async () => {
  let finish: () => void = () => {}; client.defaults.adapter = async config => { writes++; await new Promise<void>(resolve => { finish = resolve; }); return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'venue-1', name: 'Example pitch' } } }; };
  const chosen = vi.fn(); render(<SelectLocation setLocation={chosen} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose example map point' })); fireEvent.change(screen.getByLabelText('Venue name'), { target: { value: 'Example pitch' } });
  const button = screen.getByRole('button', { name: 'Use this location' }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(writes).toBe(1)); await act(async () => finish()); await waitFor(() => expect(chosen).toHaveBeenCalledOnce());
});

function DraftWithCatalogue() {
  const [open, setOpen] = useState(true); const [saved, setSaved] = useState(false);
  const { countries } = useDiscovery();
  return <><output aria-label="Available cities">{countries.flatMap(country => country.states.flatMap(state => state.cities.map(city => city.name))).join(', ')}</output>
    {open && <SelectLocation setLocation={() => setSaved(true)} />}{saved && <p>Venue saved</p>}
    <button onClick={() => setOpen(false)}>Discard activity draft</button></>;
}
it('refreshes the city catalogue once at venue success even when the activity draft is discarded', async () => {
  let saved = false;
  vi.mocked(fetchCountries).mockImplementation(async () => saved ? [{ name: 'Example country', states: [{ name: 'Example state', cities: [{ name: 'New example city' }] }] }] : []);
  client.defaults.adapter = async config => { expect(config.url).toBe('/api/locations/'); saved = true; return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'venue-1', name: 'Example pitch' } } }; };
  render(<MemoryRouter initialEntries={['/map']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><DraftWithCatalogue /></DiscoveryProvider></MemoryRouter>);
  await waitFor(() => expect(fetchCountries).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Choose example map point' })); fireEvent.change(screen.getByLabelText('Venue name'), { target: { value: 'Example pitch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this location' })); await screen.findByText('Venue saved');
  fireEvent.click(screen.getByRole('button', { name: 'Discard activity draft' }));
  await waitFor(() => expect(screen.getByLabelText('Available cities').textContent).toBe('New example city'));
  expect(fetchCountries).toHaveBeenCalledTimes(2); expect(screen.queryByLabelText('Venue name')).toBeNull();
});
