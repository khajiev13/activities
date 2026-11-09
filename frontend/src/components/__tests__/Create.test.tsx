// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TelegramApp } from '@/platform/telegram';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanupVaul } from '@/test/cleanupVaul';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { readDiscoveryPreference } from '@/discovery/preferences';
import { fetchCountries, fetchResults } from '@/discovery/api';
import { Create } from '../Drawer';
import client from '@/api/client';
import { AxiosHeaders } from 'axios';
import type { LocationDetails } from '@/components/Map/MapFunctions/AddLocation';
const originalAdapter = client.defaults.adapter;
const form = vi.hoisted(() => ({ actual: false, actualTeam: false, actualOrg: false }));
const native = vi.hoisted(() => ({ app: undefined as TelegramApp | undefined }));
vi.mock('@/platform/telegram', () => ({ getTelegramApp: () => native.app }));
vi.mock('@/discovery/preferences', () => ({ readCachedDiscoveryPreference: () => ({ preference: null, warning: false }), readDiscoveryPreference: vi.fn(async () => ({ preference: null, warning: false })), writeDiscoveryPreference: async () => ({ warning: false }) }));
vi.mock('@/discovery/deviceLocation', () => ({ getLocationPermission: async () => 'unknown', requestDeviceLocation: vi.fn() }));
vi.mock('@/discovery/geoNames', () => ({ resolvePlaceCenter: async () => null, searchCityPlaces: async () => [] }));
vi.mock('@/components/SelectLocation', () => ({ default: ({ setLocation }: { setLocation: (value: LocationDetails) => void }) => <button type="button" onClick={() => setLocation({ country: 'Example country', state: 'Example state', city: 'Example city', location_pk: 'venue-1', location_name: 'Example pitch', country_code: '', timezone: '', sunrise: '', sunset: '' })}>Choose example venue</button> }));
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
vi.mock('@/components/ActivitiesPage/NewActivityDrawer', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/ActivitiesPage/NewActivityDrawer')>();
  return { default: (props: { setProgressBar: (value: number) => void; onCreated?: () => void; onPersisted?: () => void }) => form.actual ? <actual.default {...props} /> : <><label>Activity draft<input /></label><button onClick={() => { props.onPersisted?.(); props.onCreated?.(); }}>Finish activity</button></> };
});
vi.mock('@/components/TeamsPage/NewTeamDrawer', async importOriginal => { const actual = await importOriginal<typeof import('@/components/TeamsPage/NewTeamDrawer')>(); return { default: (props: { setProgressBar: (value: number) => void; onCreated?: () => void; onPersisted?: () => void }) => form.actualTeam ? <actual.default {...props} /> : <><label>Team draft<input /></label><button onClick={() => { props.onPersisted?.(); props.onCreated?.(); }}>Finish team</button></> }; });
vi.mock('@/components/OrganizationsPage/NewOrganizationDrawer', async importOriginal => { const actual = await importOriginal<typeof import('@/components/OrganizationsPage/NewOrganizationDrawer')>(); return { default: (props: { setProgressBar: (value: number) => void; onCreated?: () => void; onPersisted?: () => void }) => form.actualOrg ? <actual.default {...props} /> : <><label>Organization draft<input /></label><button onClick={() => { props.onPersisted?.(); props.onCreated?.(); }}>Finish organization</button></> }; });
beforeEach(() => { native.app = undefined; vi.mocked(readDiscoveryPreference).mockResolvedValue({ preference: null, warning: false }); vi.useFakeTimers({ shouldAdvanceTime: true }); form.actual = false; form.actualTeam = false; form.actualOrg = false; window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); window.scrollTo = vi.fn(); vi.mocked(fetchCountries).mockResolvedValue([]); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] }); });
afterEach(async () => { await cleanupVaul(); vi.useRealTimers(); client.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it.each([['activities', 'Activity draft'], ['teams', 'Team draft'], ['organizations', 'Organization draft']] as const)('uses the explicitly chosen %s entity on Explore', async (entity, label) => {
  render(<MemoryRouter initialEntries={['/map']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Create entity={entity} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByLabelText(label)).toBeTruthy();
});
it('retains a dirty draft on cancel and only discards after confirmation', async () => {
  render(<MemoryRouter initialEntries={['/activities']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Create /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.change(await screen.findByLabelText('Activity draft'), { target: { value: 'Example draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(await screen.findByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect((screen.getByLabelText('Activity draft') as HTMLInputElement).value).toBe('Example draft');
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect((await screen.findByLabelText('Activity draft') as HTMLInputElement).value).toBe('');
});
function Counts() { const value = useDiscovery(); return <output>{value.loading ? 'Refreshing' : 'Ready'}</output>; }
it.each([['activities', 'activity'], ['teams', 'team'], ['organizations', 'organization']] as const)('closes %s success and refreshes results without duplicating the venue catalogue refresh', async (entity, label) => {
  const done = vi.fn(); render(<MemoryRouter initialEntries={['/map?level=city&country=Example&state=Region&city=City&entity=activities']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Create entity={entity} onCreated={done} /><Counts /></DiscoveryProvider></MemoryRouter>);
  await screen.findByText('Ready'); const countries = vi.mocked(fetchCountries).mock.calls.length; const results = vi.mocked(fetchResults).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.click(await screen.findByRole('button', { name: `Finish ${label}` }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(done).toHaveBeenCalledOnce();
  expect(fetchCountries).toHaveBeenCalledTimes(countries); expect(fetchResults).toHaveBeenCalledTimes(results + 1);
});

function CurrentRoute() { const location = useLocation(); return <output aria-label="Current route">{location.pathname}{location.search}</output>; }
it('refreshes persisted results without closing a replacement draft or navigating after a pending draft is discarded', async () => {
  form.actual = true; let finish: () => void = () => {}; let writes = 0;
  client.defaults.adapter = async config => {
    expect(config.url).toBe('/api/activities/'); writes++;
    await new Promise<void>(resolve => { finish = resolve; });
    return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'discarded-request-activity' } } };
  };
  const path = '/activities?level=city&country=Example&state=Region&city=City&entity=activities&view=list'; const done = vi.fn();
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Create onCreated={done} /><CurrentRoute /><Counts /></DiscoveryProvider></MemoryRouter>);
  await screen.findByText('Ready'); const results = vi.mocked(fetchResults).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'First synthetic draft' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A synthetic activity description.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose example venue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(await screen.findByRole('button', { name: 'Discard draft' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
  fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Replacement draft' } });
  expect(screen.queryByRole('progressbar')).toBeNull();
  await act(async () => finish());
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByLabelText('Current route').textContent).toBe(path);
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Replacement draft'); expect(screen.getByRole('dialog')).toBeTruthy();
  expect(done).not.toHaveBeenCalled(); await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(results + 1)); expect(writes).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(await screen.findByRole('alertdialog')).toBeTruthy();
});

it.each(['teams', 'organizations'] as const)('keeps a replacement %s shell draft open after a discarded real form succeeds', async entity => {
  form.actualTeam = entity === 'teams'; form.actualOrg = entity === 'organizations';
  let finish: () => void = () => {}; let writes = 0;
  client.defaults.adapter = async config => {
    expect(config.url).toBe(`/api/${entity}/`); writes++; await new Promise<void>(resolve => { finish = resolve; });
    return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: entity === 'teams' ? { name: 'Created team' } : { pk: 'org-1' } } };
  };
  const path = `/${entity}?level=city&country=Example&state=Region&city=City&entity=${entity}&view=list`; const done = vi.fn();
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Create onCreated={done} /><CurrentRoute /><Counts /></DiscoveryProvider></MemoryRouter>);
  await screen.findByText('Ready'); const results = vi.mocked(fetchResults).mock.calls.length; const countries = vi.mocked(fetchCountries).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'First synthetic draft' } });
  if (entity === 'teams') fireEvent.change(screen.getByLabelText('Founded date'), { target: { value: '2020-01-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose example venue' })); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(await screen.findByRole('button', { name: 'Discard draft' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Replacement draft' } });
  expect(screen.queryByRole('progressbar')).toBeNull(); await act(async () => finish());
  expect(screen.queryByRole('progressbar')).toBeNull(); expect(screen.getByLabelText('Current route').textContent).toBe(path); expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Replacement draft'); expect(screen.getByRole('dialog')).toBeTruthy(); expect(done).not.toHaveBeenCalled();
  await waitFor(() => expect(fetchResults).toHaveBeenCalledTimes(results + 1)); expect(fetchCountries).toHaveBeenCalledTimes(countries);
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(await screen.findByRole('alertdialog')).toBeTruthy();
});

function ControlledCreate() { const { surface, openSurface, closeSurface } = useDiscovery(); return <><Create entity="activities" open={surface === 'create'} onOpenChange={next => next ? openSurface('create') : closeSurface()} /><output aria-label="Surface">{surface}</output><button onClick={() => openSurface('profile')}>Competing profile</button></>; }
it('keeps the exclusive Create surface authoritative until discard accepts closure', async () => {
  render(<MemoryRouter initialEntries={['/map?level=country&country=Example']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><ControlledCreate /></DiscoveryProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.change(await screen.findByLabelText('Activity draft'), { target: { value: 'Keep this draft' } });
  expect(screen.getByLabelText('Surface').textContent).toBe('create');
  fireEvent.click(screen.getByText('Competing profile')); expect(screen.getByLabelText('Surface').textContent).toBe('create');
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect(screen.getByLabelText('Surface').textContent).toBe('create');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(await screen.findByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' })); await waitFor(() => expect(screen.getByLabelText('Surface').textContent).toBe('none'));
});

it('routes native Back through dirty confirmation and retains ownership when editing continues', async () => {
  const handlers = new Set<() => void>(); native.app = { BackButton: { show: vi.fn(), hide: vi.fn(), onClick: callback => handlers.add(callback), offClick: callback => { handlers.delete(callback); } } };
  render(<MemoryRouter initialEntries={['/map?level=country&country=Example']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><ControlledCreate /></DiscoveryProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.change(await screen.findByLabelText('Activity draft'), { target: { value: 'Native draft' } });
  expect(handlers.size).toBe(1); act(() => [...handlers][0]()); fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' })); expect(screen.getByLabelText('Surface').textContent).toBe('create'); expect(handlers.size).toBe(1);
  act(() => [...handlers][0]()); fireEvent.click(await screen.findByRole('button', { name: 'Discard draft' })); await waitFor(() => expect(screen.getByLabelText('Surface').textContent).toBe('none')); expect(handlers.size).toBe(0);
});

it('defers a late native city until the actual dirty draft accepts discard', async () => {
  let finish!: (value: Awaited<ReturnType<typeof readDiscoveryPreference>>) => void;
  vi.mocked(readDiscoveryPreference).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter initialEntries={['/map']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><ControlledCreate /><CurrentRoute /></DiscoveryProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.change(await screen.findByLabelText('Activity draft'), { target: { value: 'Unchanged draft' } });
  await act(async () => finish({ preference: { version: 1, mode: 'manual', place: { geo: { level: 'city', country: 'Example', state: 'Region', city: 'New City' }, geonameId: 101, center: [12, 34] }, recent: [], welcomeSeen: true, updatedAt: 100 }, warning: false }));
  expect(screen.getByLabelText('Current route').textContent).toBe('/map');
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Current route').textContent).toBe('/map'); expect((screen.getByLabelText('Activity draft') as HTMLInputElement).value).toBe('Unchanged draft');
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  await waitFor(() => expect(screen.getByLabelText('Surface').textContent).toBe('none')); expect(screen.getByLabelText('Current route').textContent).toContain('city=New+City');
});
