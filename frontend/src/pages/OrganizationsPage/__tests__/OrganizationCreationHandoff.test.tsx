// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanupVaul } from '@/test/cleanupVaul';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import client from '@/api/client';
import { DiscoveryProvider } from '@/discovery/DiscoveryContext';
import { Create } from '@/components/Drawer';
const { reloadCalls } = vi.hoisted(() => ({ reloadCalls: vi.fn() }));
vi.mock('@/discovery/preferences', () => ({ readCachedDiscoveryPreference: () => ({ preference: null, warning: false }), readDiscoveryPreference: async () => ({ preference: null, warning: false }), writeDiscoveryPreference: async () => ({ warning: false }) }));
vi.mock('@/discovery/deviceLocation', () => ({ getLocationPermission: async () => 'unknown', requestDeviceLocation: vi.fn() }));
vi.mock('@/discovery/geoNames', () => ({ resolvePlaceCenter: async () => null, searchCityPlaces: async () => [] }));
vi.mock('@/discovery/DiscoveryContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/discovery/DiscoveryContext')>();
  return { ...actual, useDiscovery: () => { const value = actual.useDiscovery(); return { ...value, reload: () => { reloadCalls(); value.reload(); } }; }, useOptionalDiscovery: () => { const value = actual.useOptionalDiscovery(); return value && { ...value, reload: () => { reloadCalls(); value.reload(); } }; } };
});
import NewOrganizationDrawer from '@/components/OrganizationsPage/NewOrganizationDrawer';
import Organizations from '../Organizations';
import type { LocationDetails } from '@/components/Map/MapFunctions/AddLocation';

vi.mock('@maptiler/sdk', () => ({}));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('@/components/SelectLocation', () => ({ default: ({ setLocation }: { setLocation: (value: LocationDetails) => void }) => <button type="button" onClick={() => setLocation({ country: 'UK', state: 'Scotland', city: 'Edinburgh', location_pk: 'pitch', location_name: 'New pitch', country_code: 'GB', timezone: 'Europe/London', sunrise: '', sunset: '' })}>Choose stored Edinburgh location</button> }));
const originalAdapter = client.defaults.adapter;
const progress = vi.fn();
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(async () => { await cleanupVaul(); vi.useRealTimers(); client.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); vi.clearAllMocks(); });
function success(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { error: 0, data } };
}
function CurrentRoute() { const location = useLocation(); return <><output aria-label="Current route">{location.pathname}{location.search}</output><output aria-label="Handoff pending">{String(Boolean(location.state?.createdOrganization || location.state?.organizationResultsInvalidated))}</output></>; }
it.each([['England', 'Cambridge', 'old-search', 'legacy'], ['Scotland', 'Edinburgh', '', 'legacy'], ['England', 'Cambridge', 'old-search', 'shell'], ['Scotland', 'Edinburgh', '', 'shell']] as const)('keeps actual organization creation visible from %s/%s (%s, %s) with one invalidation', async (originState, originCity, query, source) => {
  const created = { pk: 'new-org', name: 'New Edinburgh Club', created_at: '2026-11-08', image_url: null, country: { name: 'UK' }, state: { name: 'Scotland' }, city: { name: 'Edinburgh' }, location: { pk: 'pitch', name: 'New pitch', points: { latitude: 55.95, longitude: -3.19 } }, teams_count: 0, number_of_people_joined: 1, number_of_teams_sponsored: 0, hosting_leagues_count: 0, hosting_activities_count: 0 };
  let posts = 0; let refreshed = false;
  client.defaults.adapter = async config => {
    if (config.method === 'post') {
      posts++; expect(config.url).toBe('/api/organizations/');
      const data = config.data as FormData;
      expect(data.get('name')).toBe('New Edinburgh Club'); expect(data.get('country')).toBe('UK');
      expect(data.get('state')).toBe('Scotland'); expect(data.get('city')).toBe('Edinburgh');
      expect(data.get('pk_for_location')).toBe('pitch'); expect(data.get('image')).toBeInstanceOf(File);
      return success(config, created);
    }
    if (config.url === '/api/countries/list/') return success(config, [{ name: 'UK', states: [{ name: 'Scotland', cities: [{ name: 'Edinburgh' }] }] }]);
    if (config.url === '/api/organizations/city/Edinburgh/') {
      if (!posts) return success(config, []);
      refreshed = true; expect(config.params).toEqual({ countries: ['UK'], states: ['Scotland'], search_by: '' });
      return success(config, [created]);
    }
    return success(config, []);
  };
  const close = vi.fn();
  render(<MemoryRouter initialEntries={[`/map?level=city&country=UK&state=${originState}&city=${originCity}&entity=organizations&view=map&q=${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><CurrentRoute /><Routes>
    <Route path="/map" element={source === 'shell' ? <Create entity="organizations" onCreated={close} /> : <NewOrganizationDrawer setProgressBar={progress} onCreated={close} />} />
    <Route path="/organizations" element={<Organizations />} />
  </Routes></DiscoveryProvider></MemoryRouter>);
  if (source === 'shell') { window.scrollTo = vi.fn(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await screen.findByRole('dialog'); }
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'New Edinburgh Club' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose stored Edinburgh location' }));
  fireEvent.change(screen.getByLabelText('Picture (optional)'), { target: { files: [new File(['pixels'], 'club.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(await screen.findByRole('button', { name: 'About New Edinburgh Club' })).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull(); expect(refreshed).toBe(true); expect(posts).toBe(1); expect(reloadCalls).toHaveBeenCalledOnce(); expect(screen.getByLabelText('Handoff pending').textContent).toBe('false');
  const route = screen.getByLabelText('Current route').textContent!;
  expect(route).toContain('/organizations?'); expect(new URL(route, 'https://example.invalid').searchParams.get('city')).toBe('Edinburgh');
  expect(new URL(route, 'https://example.invalid').searchParams.get('q')).toBe('');
});
