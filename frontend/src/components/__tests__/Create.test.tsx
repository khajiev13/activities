// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { fetchCountries, fetchResults } from '@/discovery/api';
import { Create } from '../Drawer';
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
vi.mock('@/components/ActivitiesPage/NewActivityDrawer', () => ({ default: ({ onCreated }: { onCreated?: () => void }) => <><label>Activity draft<input /></label><button onClick={onCreated}>Finish activity</button></> }));
vi.mock('@/components/TeamsPage/NewTeamDrawer', () => ({ default: () => <label>Team draft<input /></label> }));
vi.mock('@/components/OrganizationsPage/NewOrganizationDrawer', () => ({ default: ({ onCreated }: { onCreated?: () => void }) => <><label>Organization draft<input /></label><button onClick={onCreated}>Finish organization</button></> }));
beforeEach(() => { window.scrollTo = vi.fn(); vi.mocked(fetchCountries).mockResolvedValue([]); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
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
