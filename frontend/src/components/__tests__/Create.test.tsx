// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { fetchCountries, fetchResults } from '@/discovery/api';
import { Create } from '../Drawer';
import client from '@/api/client';
import { AxiosHeaders } from 'axios';
import type { LocationDetails } from '@/components/Map/MapFunctions/AddLocation';
const originalAdapter = client.defaults.adapter;
const form = vi.hoisted(() => ({ actual: false }));
vi.mock('@/components/SelectLocation', () => ({ default: ({ setLocation }: { setLocation: (value: LocationDetails) => void }) => <button type="button" onClick={() => setLocation({ country: 'Example country', state: 'Example state', city: 'Example city', location_pk: 'venue-1', location_name: 'Example pitch', country_code: '', timezone: '', sunrise: '', sunset: '' })}>Choose example venue</button> }));
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
vi.mock('@/components/ActivitiesPage/NewActivityDrawer', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/ActivitiesPage/NewActivityDrawer')>();
  return { default: (props: { setProgressBar: (value: number) => void; onCreated?: () => void; onPersisted?: () => void }) => form.actual ? <actual.default {...props} /> : <><label>Activity draft<input /></label><button onClick={() => { props.onPersisted?.(); props.onCreated?.(); }}>Finish activity</button></> };
});
vi.mock('@/components/TeamsPage/NewTeamDrawer', () => ({ default: () => <label>Team draft<input /></label> }));
vi.mock('@/components/OrganizationsPage/NewOrganizationDrawer', () => ({ default: ({ onCreated }: { onCreated?: () => void }) => <><label>Organization draft<input /></label><button onClick={onCreated}>Finish organization</button></> }));
beforeEach(() => { form.actual = false; window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); window.scrollTo = vi.fn(); vi.mocked(fetchCountries).mockResolvedValue([]); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] }); });
afterEach(() => { cleanup(); client.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); vi.clearAllMocks(); });
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
it('closes activity success and refreshes the existing result set without duplicating venue catalogue refresh', async () => {
  const done = vi.fn(); render(<MemoryRouter initialEntries={['/map?level=city&country=Example&state=Region&city=City&entity=activities']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Create entity="activities" onCreated={done} /><Counts /></DiscoveryProvider></MemoryRouter>);
  await screen.findByText('Ready'); const countries = vi.mocked(fetchCountries).mock.calls.length; const results = vi.mocked(fetchResults).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); fireEvent.click(await screen.findByRole('button', { name: 'Finish activity' }));
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
