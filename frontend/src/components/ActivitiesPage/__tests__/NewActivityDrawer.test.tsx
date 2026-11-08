// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AxiosHeaders } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import client from '@/api/client';
import NewActivityDrawer from '../NewActivityDrawer';
import type { LocationDetails } from '@/components/Map/MapFunctions/AddLocation';

// The old swipe widget needs layout APIs absent in jsdom; no form behavior is mocked.
vi.mock('@/components/ui/carousel', () => ({ Carousel: ({ children }: { children: ReactNode }) => <div>{children}</div>, CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>, CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>, CarouselPrevious: () => null, CarouselNext: () => null }));
vi.mock('@/components/SelectLocation', () => ({ default: ({ setLocation }: { setLocation: (value: LocationDetails) => void }) => <button type="button" onClick={() => setLocation({ country: 'Example country', state: 'Example state', city: 'Example city', location_pk: 'venue-1', location_name: 'Example pitch', country_code: 'EX', timezone: 'UTC', sunrise: '06:00', sunset: '18:00' })}>Choose example venue</button> }));
vi.mock('@/components/SelectTeam', () => ({ SelectTeam: ({ setTeamProp }: { setTeamProp: (team: { name: string; image_url: null }) => void }) => <><button type="button" onClick={() => setTeamProp({ name: 'Team Alpha', image_url: null })}>Pick Alpha</button><button type="button" onClick={() => setTeamProp({ name: 'Team Beta', image_url: null })}>Pick Beta</button></> }));
const original = client.defaults.adapter;
let writes: Record<string, unknown>[];
function Route() { const location = useLocation(); return <output aria-label="Current route">{location.pathname}{location.search}</output>; }
function mount(onCreated = vi.fn(), path = '/activities') { return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NewActivityDrawer setProgressBar={() => {}} onCreated={onCreated} /><Route /></MemoryRouter>); }
function competition() { const tab = screen.getByRole('tab', { name: 'Yes' }); fireEvent.mouseDown(tab, { button: 0, ctrlKey: false }); fireEvent.click(tab); }
function fill() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Example match' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A synthetic activity description.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose example venue' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '90' } });
}
beforeEach(() => {
  writes = []; window.scrollTo = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  client.defaults.adapter = async config => {
    if (config.method === 'post') writes.push(JSON.parse(config.data));
    return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { error: 0, data: config.method === 'post' ? { pk: 'activity-1' } : [{ pk: 'category-1', name: 'Ball games' }] } };
  };
});
afterEach(() => { cleanup(); client.defaults.adapter = original; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('validates missing competition teams before loading and lets the user correct the draft', async () => {
  mount(); fill(); competition();
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(false);
  expect(writes).toHaveLength(0);
});
it('requires two distinct teams and permits correcting a duplicate', async () => {
  mount(); fill(); competition();
  fireEvent.click(screen.getAllByRole('button', { name: 'Pick Alpha' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Pick Alpha' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Change team 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pick Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(writes).toHaveLength(1));
});
it('preserves the complete payload and finishes as soon as the server responds', async () => {
  const done = vi.fn(); mount(done); fill();
  fireEvent.click(screen.getByLabelText('Outdoor activity'));
  fireEvent.click(await screen.findByLabelText('Ball games'));
  fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T14:30' } });
  fireEvent.click(screen.getByLabelText('Public Activity'));
  competition();
  fireEvent.click(screen.getAllByRole('button', { name: 'Pick Alpha' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Pick Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Current route').textContent).toBe('/activities/activity-1');
  expect(writes).toEqual([{ title: 'Example match', description: 'A synthetic activity description.', public: false,
    categories: [{ pk: 'category-1', name: 'Ball games' }], date_time: new Date('2026-12-01T14:30').toISOString(), duration_in_minutes: 90,
    country: { name: 'Example country' }, state: { name: 'Example state' }, city: { name: 'Example city' }, location: { pk: 'venue-1' }, name_for_location: 'Example pitch',
    country_code_for_chosen_location: 'EX', timezone_for_chosen_location: 'UTC', sunrise_time_for_chosen_location: '06:00', sunset_time_for_chosen_location: '18:00',
    is_competition: true, competition: { team_1: { name: 'Team Alpha' }, team_2: { name: 'Team Beta' } } }]);
});
it('retains inputs after a failed POST and allows retry without duplicate writes while pending', async () => {
  let release: () => void = () => {}; let attempt = 0;
  client.defaults.adapter = async config => {
    if (config.method !== 'post') return { config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { error: 0, data: [{ pk: 'category-1', name: 'Ball games' }] } };
    attempt++; writes.push(JSON.parse(config.data));
    if (attempt === 1) throw new Error('synthetic offline');
    await new Promise<void>(resolve => { release = resolve; });
    return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'activity-1' } } };
  };
  const done = vi.fn(); mount(done); fill();
  fireEvent.click(screen.getByLabelText('Outdoor activity')); fireEvent.click(await screen.findByLabelText('Ball games'));
  fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T14:30' } });
  fireEvent.click(screen.getByLabelText('Public Activity')); competition();
  fireEvent.click(screen.getAllByRole('button', { name: 'Pick Alpha' })[0]); fireEvent.click(screen.getByRole('button', { name: 'Pick Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Example match');
  expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe('A synthetic activity description.');
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('90');
  expect(screen.getByText('Example pitch')).toBeTruthy();
  expect((screen.getByLabelText('Ball games') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('Date and time') as HTMLInputElement).value).toBe('2026-12-01T14:30');
  expect((screen.getByLabelText('Public Activity') as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText('Team Alpha')).toBeTruthy(); expect(screen.getByText('Team Beta')).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Create' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(writes).toHaveLength(2)); expect(done).not.toHaveBeenCalled();
  release(); await waitFor(() => expect(done).toHaveBeenCalledOnce()); expect(writes[1]).toEqual(writes[0]);
});

it('keeps the discovery query on the created detail route so Back can restore the city and search', async () => {
  const query = '?level=city&country=Example&state=Region&city=City&entity=activities&view=list&q=ball';
  mount(vi.fn(), '/activities' + query); fill();
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(screen.getByLabelText('Current route').textContent).toBe('/activities/activity-1' + query));
});
