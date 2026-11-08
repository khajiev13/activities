// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosHeaders } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import client from '@/api/client';
import NewTeamDrawer from '../NewTeamDrawer';
import type { LocationDetails } from '@/components/Map/MapFunctions/AddLocation';

vi.mock('@/components/SelectLocation', () => ({ default: ({ setLocation }: { setLocation: (value: LocationDetails) => void }) => <button type="button" onClick={() => setLocation({ country: 'Example', state: 'Region', city: 'City', location_pk: 'venue-1', location_name: 'Example pitch', country_code: 'EX', timezone: 'UTC', sunrise: '06:00', sunset: '18:00' })}>Choose example venue</button> }));
const original = client.defaults.adapter;
let writes: FormData[];
const longName = 'Example organization with a very long display name for a small phone screen';
function Route() { const route = useLocation(); return <output aria-label="Current route">{route.pathname}{route.search}</output>; }
function mount(onCreated = vi.fn(), onPersisted = vi.fn(), progress = vi.fn()) { return render(<MemoryRouter initialEntries={['/teams?level=city&country=Example&state=Region&city=City&q=ball']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NewTeamDrawer setProgressBar={progress} onCreated={onCreated} onPersisted={onPersisted} /><Route /></MemoryRouter>); }
function fill() { fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Example team' } }); fireEvent.change(screen.getByLabelText('Founded date'), { target: { value: '2020-01-02' } }); fireEvent.click(screen.getByRole('button', { name: 'Choose example venue' })); }
beforeEach(() => {
  writes = []; URL.createObjectURL = vi.fn(() => 'blob:synthetic-team'); URL.revokeObjectURL = vi.fn(); vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })); Element.prototype.scrollIntoView = vi.fn();
  client.defaults.adapter = async config => { if (config.method === 'post') writes.push(config.data); return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { error: 0, data: config.method === 'post' ? { name: 'Created team' } : config.url === '/api/organizations/list/' ? [{ pk: 'org-1', name: longName }, { pk: 'org-2', name: 'Second sponsor' }] : [{ pk: 'cat-1', name: 'Ball games' }] } }; };
});
afterEach(() => { cleanup(); client.defaults.adapter = original; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('preserves every team multipart field and uses the returned team with discovery context', async () => {
  const done = vi.fn(); const persisted = vi.fn(); mount(done, persisted); fill();
  fireEvent.click(screen.getByLabelText('Women’s team')); fireEvent.click(screen.getByLabelText('Public Team'));
  fireEvent.click(screen.getByLabelText('Outdoor activity')); fireEvent.click(await screen.findByLabelText('Ball games'));
  fireEvent.click(screen.getByLabelText('Belongs to an organization')); fireEvent.click(await screen.findByRole('option', { name: longName }));
  fireEvent.click(screen.getByRole('button', { name: 'Add sponsor' })); fireEvent.click(await within(screen.getByRole('group', { name: 'Sponsor 1' })).findByRole('option', { name: 'Second sponsor' }));
  for (const [label, color] of [['Home shirt', '#112233'], ['Away shirt', '#223344'], ['Shorts', '#334455'], ['Socks', '#445566']]) fireEvent.change(screen.getByLabelText(label), { target: { value: color } });
  const image = new File(['pixels'], 'team.png', { type: 'image/png' }); fireEvent.change(screen.getByLabelText('Logo of the team (optional)'), { target: { files: [image] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(done).toHaveBeenCalledOnce()); expect(persisted).toHaveBeenCalledOnce();
  expect(Object.fromEntries(writes[0])).toEqual({ name: 'Example team', men_team: 'false', public_team: 'true', founded_at: new Date('2020-01-02T00:00:00').toISOString(), belongs_to_organization: 'org-1', country_name: 'Example', state_name: 'Region', city_name: 'City', location: 'venue-1', categories: '[{"pk":"cat-1","name":"Ball games"}]', sponsors: '["org-2"]', tshirt_color: '#112233', away_tshirt_color: '#223344', shorts_color: '#334455', socks_color: '#445566', image });
  await waitFor(() => expect(screen.getByLabelText('Current route').textContent).toBe('/teams/Created%20team?level=city&country=Example&state=Region&city=City&q=ball'));
});
it('keeps invalid drafts editable and submits without an optional image after correction', async () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toHaveLength(0);
  fill(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1)); expect(writes[0].has('image')).toBe(false); expect(writes[0].get('men_team')).toBe('true'); expect(writes[0].get('public_team')).toBe('false');
});
it('retains upload and domain choices after failure and prevents duplicate pending writes', async () => {
  let release: () => void = () => {};
  const previous = client.defaults.adapter; client.defaults.adapter = async config => { if (config.method !== 'post') return (previous as import('axios').AxiosAdapter)(config); writes.push(config.data); if (writes.length === 1) throw new Error('synthetic upload failure'); await new Promise<void>(resolve => { release = resolve; }); return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { name: 'Created team' } } }; };
  const done = vi.fn(); mount(done); fill(); fireEvent.click(screen.getByLabelText('Women’s team')); fireEvent.click(screen.getByLabelText('Public Team')); fireEvent.change(screen.getByLabelText('Home shirt'), { target: { value: '#112233' } }); fireEvent.click(screen.getByLabelText('Outdoor activity')); fireEvent.click(await screen.findByLabelText('Ball games'));
  fireEvent.click(screen.getByLabelText('Belongs to an organization')); fireEvent.click(await screen.findByRole('option', { name: longName })); fireEvent.click(screen.getByRole('button', { name: 'Add sponsor' })); fireEvent.click(await within(screen.getByRole('group', { name: 'Sponsor 1' })).findByRole('option', { name: 'Second sponsor' }));
  const image = new File(['pixels'], 'team.png', { type: 'image/png' }); fireEvent.change(screen.getByLabelText('Logo of the team (optional)'), { target: { files: [image] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Example team'); expect((screen.getByLabelText('Founded date') as HTMLInputElement).value).toBe('2020-01-02'); expect(screen.getByText('Example pitch')).toBeTruthy(); expect((screen.getByLabelText('Logo of the team (optional)') as HTMLInputElement).files?.[0]).toBe(image);
  const button = screen.getByRole('button', { name: 'Create' }); fireEvent.click(button); fireEvent.click(button); await waitFor(() => expect(writes).toHaveLength(2)); expect(done).not.toHaveBeenCalled(); expect(Object.fromEntries(writes[1])).toEqual(Object.fromEntries(writes[0]));
  await act(async () => release()); await waitFor(() => expect(done).toHaveBeenCalledOnce());
});
it('replaces and removes sponsor slots without accumulating stale selections or navigating', async () => {
  mount(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Add sponsor' })); const first = within(screen.getByRole('group', { name: 'Sponsor 1' }));
  fireEvent.change(await first.findByRole('combobox', { name: 'Search sponsor 1' }), { target: { value: 'very long' } }); expect(first.queryByRole('option', { name: 'Second sponsor' })).toBeNull(); fireEvent.click(first.getByRole('option', { name: longName }));
  fireEvent.click(first.getByRole('button', { name: 'Change sponsor 1' })); fireEvent.click(await first.findByRole('option', { name: 'Second sponsor' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add sponsor' })); fireEvent.click(await within(screen.getByRole('group', { name: 'Sponsor 2' })).findByRole('option', { name: longName })); fireEvent.click(screen.getByRole('button', { name: 'Remove sponsor 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1)); expect(writes[0].get('sponsors')).toBe('["org-1"]');
});
it.each([true, false])('does not affect a replacement draft after a discarded request finishes (success=%s)', async success => {
  let release: () => void = () => {}; client.defaults.adapter = async config => { writes.push(config.data); await new Promise<void>(resolve => { release = resolve; }); if (!success) throw new Error('synthetic failure'); return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { name: 'Created team' } } }; };
  const done = vi.fn(); const persisted = vi.fn(); const progress = vi.fn(); const first = mount(done, persisted, progress); fill(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1)); first.unmount();
  mount(done, persisted, progress); fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Replacement team' } }); const calls = progress.mock.calls.length;
  await act(async () => release()); expect(done).not.toHaveBeenCalled(); expect(persisted).toHaveBeenCalledTimes(success ? 1 : 0); expect(progress).toHaveBeenCalledTimes(calls); expect(screen.queryByRole('alert')).toBeNull(); expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Replacement team'); expect(screen.getByLabelText('Current route').textContent).toBe('/teams?level=city&country=Example&state=Region&city=City&q=ball');
});
it('clears a changed location and requires a fresh selection before submission', async () => {
  mount(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Change location' })); expect(screen.getByRole('button', { name: 'Choose example venue' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Choose example venue' })); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1));
});
it.each([['bad.svg', 'image/svg+xml', 1], ['large.png', 'image/png', 5 * 1024 * 1024 + 1]])('keeps the team editable after rejecting %s', async (name, type, size) => {
  mount(); fill(); fireEvent.change(screen.getByLabelText('Logo of the team (optional)'), { target: { files: [new File([new Uint8Array(size)], name, { type })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Logo of the team (optional)'), { target: { files: [] } }); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1));
});
it('keeps the team editable for an incomplete creation response', async () => {
  client.defaults.adapter = async config => ({ config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: {} } });
  const done = vi.fn(); const persisted = vi.fn(); mount(done, persisted); fill(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy(); expect(done).not.toHaveBeenCalled(); expect(persisted).not.toHaveBeenCalled();
});
