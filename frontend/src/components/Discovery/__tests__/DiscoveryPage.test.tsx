// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanupVaul } from '@/test/cleanupVaul';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { DiscoveryProvider } from '@/discovery/DiscoveryContext';
import { fetchCountries, fetchResults } from '@/discovery/api';
import { AuthContext } from '@/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { ResultCard } from '../ResultCard';
import { DiscoveryPage } from '../DiscoveryPage';
import type { DiscoveryResults } from '@/discovery/types';
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
vi.mock('@/components/Drawer', () => ({ Create: ({ entity }: { entity: string }) => <button>Create {entity}</button> }));
const sdk = vi.hoisted(() => ({ styleReady: true, sources: new Map<string, { data: { features: { properties: { pk?: string } }[] } }>(), fits: vi.fn(), jumps: vi.fn(), listeners: new Map<string, Set<() => void>>() }));
vi.mock('@maptiler/sdk', () => ({ config: {}, MapStyle: { BASIC: { DARK: 'dark', LIGHT: 'light' } }, Map: class {
  on(name: string, layer: string | (() => void), fn?: () => void) { const cb = typeof layer === 'function' ? layer : fn!; if (!sdk.listeners.has(name)) sdk.listeners.set(name, new Set()); sdk.listeners.get(name)!.add(cb); }
  once(name: string, fn: () => void) { this.on(name, fn); }
  off(name: string, layer: string | (() => void), fn?: () => void) { sdk.listeners.get(name)?.delete(typeof layer === 'function' ? layer : fn!); }
  isStyleLoaded() { return sdk.styleReady; } loaded() { return true; } resize() {} remove() {} setStyle() {}
  addSource(id: string, data: never) { sdk.sources.set(id, data); } getSource(id: string) { return sdk.sources.get(id); } removeSource(id: string) { sdk.sources.delete(id); }
  hasImage() { return true; }
  addLayer() {} getLayer() { return true; } removeLayer() {} fitBounds = sdk.fits; jumpTo = sdk.jumps;
} }));
const organization = { pk: 'org-1', name: 'Real Club', created_at: new Date('2026-11-08'), image_url: null, country: { name: 'UK' }, state: { name: 'England' }, city: { name: 'Cambridge' }, location: { name: 'Pitch', pk: 'pitch', points: { latitude: 52, longitude: 0 } }, teams_count: 2, number_of_people_joined: 3, number_of_teams_sponsored: 1, hosting_leagues_count: 0, hosting_activities_count: 4 };
const results: DiscoveryResults = { activities: [], teams: [], organizations: [organization] };
const url = '/map?level=city&country=UK&state=England&city=Cambridge&entity=organizations&view=map&q=sport';
function mount(path = url) { return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Routes><Route path="/map" element={<DiscoveryPage />} /><Route path="/organizations" element={<DiscoveryPage entity="organizations" />} /><Route path="/login" element={<Link to={url}>Return</Link>} /></Routes></DiscoveryProvider></MemoryRouter>); }
beforeEach(() => { sdk.styleReady = true; vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.useFakeTimers({ shouldAdvanceTime: true }); window.scrollTo = vi.fn(); vi.mocked(fetchCountries).mockResolvedValue([{ name: 'UK', states: [{ name: 'England', cities: [{ name: 'Cambridge' }] }] }]); vi.mocked(fetchResults).mockResolvedValue(results); });
afterEach(async () => { await cleanupVaul(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); sdk.sources.clear(); sdk.listeners.clear(); });
it('offers manual city and explicit location action on first visit without assuming a city', async () => {
  mount('/map'); expect(await screen.findByRole('dialog')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Use my location' })).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: 'Cambridge, England, UK' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(screen.getByRole('button', { name: /Cambridge/ })).toBeTruthy();
});
it('restores URL, plots matching result IDs, keeps map across list toggle, and does not refit for panel changes', async () => {
  mount(); expect(screen.getByRole('searchbox', { name: 'Search organizations' }).getAttribute('value')).toBe('sport');
  expect(await screen.findByText('Real Club')).toBeTruthy();
  await waitFor(() => expect(sdk.sources.get('organizations')?.data.features[0].properties.pk).toBe('org-1'));
  const fits = sdk.fits.mock.calls.length; fireEvent.click(screen.getByRole('button', { name: 'List' }));
  expect(screen.getByText('Real Club').closest('[data-result-id]')?.getAttribute('data-result-id')).toBe('org-1');
  expect(sdk.fits).toHaveBeenCalledTimes(fits);
});
it('shows real tile loading while a new viewport loads and clears it on idle', async () => {
  mount(); await screen.findByText('Real Club');
  act(() => { for (const fn of sdk.listeners.get('dataloading') ?? []) fn(); });
  expect(screen.getByText('Loading map tiles…')).toBeTruthy();
  act(() => { for (const fn of sdk.listeners.get('idle') ?? []) fn(); });
  expect(screen.queryByText('Loading map tiles…')).toBeNull();
});
it('restores result layers when style.load arrives before the replacement style is ready', async () => {
  const rendered = mount(); await screen.findByText('Real Club');
  await waitFor(() => expect(sdk.sources.has('organizations')).toBe(true));
  const fits = sdk.fits.mock.calls.length;
  act(() => {
    sdk.sources.clear(); sdk.styleReady = false;
    for (const fn of sdk.listeners.get('style.load') ?? []) fn();
  });
  expect(sdk.sources.has('organizations')).toBe(false);
  act(() => {
    sdk.styleReady = true;
    for (const fn of sdk.listeners.get('idle') ?? []) fn();
  });
  await waitFor(() => expect(sdk.sources.has('organizations')).toBe(true));
  const restored = sdk.sources.get('organizations');
  act(() => { for (const fn of sdk.listeners.get('idle') ?? []) fn(); });
  expect(sdk.sources.get('organizations')).toBe(restored);
  expect(sdk.fits).toHaveBeenCalledTimes(fits);
  expect(sdk.sources.get('organizations')?.data.features[0].properties.pk).toBe('org-1');
  rendered.unmount();
  expect(sdk.listeners.get('idle')?.size).toBe(0);
});
it('keeps invalid coordinates in list while excluding them from map', async () => {
  vi.mocked(fetchResults).mockResolvedValue({ ...results, organizations: [{ ...organization, location: { ...organization.location, points: { latitude: 999, longitude: 0 } } }] });
  mount(); expect(await screen.findByText('Real Club')).toBeTruthy(); await waitFor(() => expect(sdk.sources.get('organizations')?.data.features).toEqual([]));
});
it.each(['empty', 'unmappable'] as const)('resets the camera after changing a populated city to an %s city', async kind => {
  vi.mocked(fetchCountries).mockResolvedValue([{ name: 'UK', states: [{ name: 'England', cities: [{ name: 'Cambridge' }] }, { name: 'Scotland', cities: [{ name: 'Edinburgh' }] }] }]);
  const other = { ...organization, pk: 'org-other', name: 'Other Club', state: { name: 'Scotland' }, city: { name: 'Edinburgh' }, location: { ...organization.location, points: { latitude: 999, longitude: 0 } } };
  vi.mocked(fetchResults).mockImplementation(async state => state.geo?.city === 'Edinburgh'
    ? { activities: [], teams: [], organizations: kind === 'empty' ? [] : [other] } : results);
  mount(); await screen.findByText('Real Club'); await waitFor(() => expect(sdk.fits).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /Cambridge/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edinburgh, Scotland, UK' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  if (kind === 'empty') await screen.findByText(/No organizations found/); else await screen.findByText('Other Club');
  expect(await screen.findByText('No mapped locations are available for Edinburgh, Scotland, UK.')).toBeTruthy();
  expect(sdk.jumps).toHaveBeenCalledWith({ center: [0, 20], zoom: 2, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  const fits = sdk.fits.mock.calls.length; const jumps = sdk.jumps.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'List' })); fireEvent.click(screen.getByRole('button', { name: 'Map' }));
  expect(sdk.fits).toHaveBeenCalledTimes(fits); expect(sdk.jumps).toHaveBeenCalledTimes(jumps);
});
it('preserves intentional pan when search becomes empty within the same geography', async () => {
  vi.mocked(fetchResults).mockImplementation(async state => state.query === 'none' ? { activities: [], teams: [], organizations: [] } : results);
  mount(); await screen.findByText('Real Club'); await waitFor(() => expect(sdk.fits).toHaveBeenCalled());
  const jumps = sdk.jumps.mock.calls.length;
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'none' } });
  await screen.findByText(/No organizations found/);
  expect(sdk.jumps).toHaveBeenCalledTimes(jumps);
  expect(screen.queryByText(/This map view does not show the selected region/)).toBeNull();
});
it('shows usable list after a map failure and an informational organization preview without invented detail or join action', async () => {
  mount(); await screen.findByText('Real Club'); act(() => { for (const fn of sdk.listeners.get('error') ?? []) fn(); });
  expect(await screen.findByText(/Map unavailable/)).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'About Real Club' }));
  expect(screen.getByRole('region', { name: 'Organization preview' }).textContent).toContain('2 teams'); expect(screen.queryByRole('link', { name: /join|details/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Teams' }));
  expect(screen.queryByRole('region', { name: 'Organization preview' })).toBeNull();
});
it('distinguishes loading, failure/retry and empty state', async () => {
  let reject: (error: Error) => void = () => {}; vi.mocked(fetchResults).mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; }));
  mount(); expect(screen.getByText('Loading organizations…')).toBeTruthy();
  await act(async () => reject(new Error('offline'))); expect(screen.getByRole('button', { name: 'Retry results' })).toBeTruthy();
  vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] }); fireEvent.click(screen.getByRole('button', { name: 'Retry results' }));
  expect(await screen.findByText(/No organizations found/)).toBeTruthy();
});

vi.mock('@/components/ActivitiesPage/NewActivityDrawer', () => ({ default: () => <p>Activity creation form</p> }));
vi.mock('@/components/TeamsPage/NewTeamDrawer', () => ({ default: () => <p>Team creation form</p> }));
vi.mock('@/components/OrganizationsPage/NewOrganizationDrawer', () => ({ default: () => <p>Organization creation form</p> }));
it.each([['activities', 'Activity'], ['teams', 'Team'], ['organizations', 'Organization']] as const)('opens the existing %s creation form from Explore', async (entity, label) => {
  const { Create } = await vi.importActual<typeof import('@/components/Drawer')>('@/components/Drawer');
  render(<MemoryRouter initialEntries={['/map']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Create entity={entity} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByText(`${label} creation form`)).toBeTruthy();
});

const anonymous = { user: null, status: 'anonymous' as const, telegramIssue: null, login: async () => false, logout: async () => {}, retryTelegramLogin: async () => false, shareTelegramContact: async () => 'cancelled' as const };
const team = { name: 'Real Team', founded_at: null, image_url: 'https://example.invalid/team.png', city_name: 'Cambridge', state_name: 'England', country_name: 'UK', location: [organization.location], men_team: true, public_team: true, categories: [], tshirt_color: [], away_tshirt_color: [], shorts_color: [], socks_color: [] };
it('restores query and list position through real detail and login return links', async () => {
  vi.mocked(fetchResults).mockResolvedValue({ ...results, teams: [team] });
  const path = '/teams?level=city&country=UK&state=England&city=Cambridge&entity=teams&view=list&q=sport';
  const view = render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthContext.Provider value={anonymous}><DiscoveryProvider><AppShell><Routes>
    <Route path="/teams" element={<DiscoveryPage entity="teams" />} />
    <Route path="/teams/:name" element={<p>Real team detail route</p>} />
    <Route path="/login" element={<p>Login route</p>} />
  </Routes></AppShell></DiscoveryProvider></AuthContext.Provider></MemoryRouter>);
  fireEvent.scroll((await screen.findByText('Real Team')).closest('.discovery-results-scroll')!, { target: { scrollTop: 180 } });
  const card = screen.getByRole('link', { name: 'Real Team' }); expect(card.getAttribute('href')).toContain('q=sport');
  fireEvent.click(card); expect(screen.getByText('Real team detail route')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect((await screen.findByText('Real Team')).closest('.discovery-results-scroll')?.scrollTop).toBe(180);
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  fireEvent.click(screen.getByRole('link', { name: 'Log in' }));
  expect(screen.getByText('Login route')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect((await screen.findByText('Real Team')).closest('.discovery-results-scroll')?.scrollTop).toBe(180);
  view.unmount();
});
it('shows an icon fallback after a team image fails', () => {
  const view = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ResultCard entity="teams" item={team} /></MemoryRouter>);
  fireEvent.error(view.container.querySelector('img')!);
  expect(view.container.querySelector('.discovery-card-image svg')).toBeTruthy();
});
