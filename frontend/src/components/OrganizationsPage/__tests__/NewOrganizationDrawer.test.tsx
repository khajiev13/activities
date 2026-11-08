// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosHeaders } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import client from '@/api/client';
import NewOrganizationDrawer from '../NewOrganizationDrawer';
import type { LocationDetails } from '@/components/Map/MapFunctions/AddLocation';

vi.mock('@/components/SelectLocation', () => ({ default: ({ setLocation }: { setLocation: (value: LocationDetails) => void }) => <button type="button" onClick={() => setLocation({ country: 'Example', state: 'Region', city: 'City', location_pk: 'venue-1', location_name: 'Example pitch', country_code: 'EX', timezone: 'UTC', sunrise: '06:00', sunset: '18:00' })}>Choose example venue</button> }));
const original = client.defaults.adapter;
let writes: FormData[];
function Route() { const route = useLocation(); return <output aria-label="Current route">{route.pathname}{route.search}</output>; }
function mount(onCreated = vi.fn(), onPersisted = vi.fn(), progress = vi.fn()) { return render(<MemoryRouter initialEntries={['/map?city=City&q=old']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NewOrganizationDrawer setProgressBar={progress} onCreated={onCreated} onPersisted={onPersisted} /><Route /></MemoryRouter>); }
function fill() { fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Example organization' } }); fireEvent.click(screen.getByRole('button', { name: 'Choose example venue' })); }
beforeEach(() => {
  writes = []; vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  client.defaults.adapter = async config => { writes.push(config.data); return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'org-1', name: 'Example organization' } } }; };
});
afterEach(() => { cleanup(); client.defaults.adapter = original; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('creates without an optional image and sends all stored geography fields', async () => {
  const done = vi.fn(); const persisted = vi.fn(); mount(done, persisted); fill(); fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(Object.fromEntries(writes[0])).toEqual({ name: 'Example organization', pk_for_location: 'venue-1', country: 'Example', state: 'Region', city: 'City' });
  expect(done).toHaveBeenCalledOnce(); expect(persisted).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Current route').textContent).toBe('/organizations');
});
it('keeps invalid and failed image drafts editable and retries the same multipart upload once', async () => {
  let release: () => void = () => {};
  client.defaults.adapter = async config => { writes.push(config.data); if (writes.length === 1) throw new Error('synthetic upload failure'); await new Promise<void>(resolve => { release = resolve; }); return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'org-1' } } }; };
  const done = vi.fn(); mount(done); fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toHaveLength(0);
  fill(); const image = new File(['pixels'], 'club.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Picture (optional)'), { target: { files: [image] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Example organization'); expect(screen.getByText('Example pitch')).toBeTruthy(); expect((screen.getByLabelText('Picture (optional)') as HTMLInputElement).files?.[0]).toBe(image);
  const button = screen.getByRole('button', { name: 'Create' }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(writes).toHaveLength(2)); expect(done).not.toHaveBeenCalled(); expect(writes[1].get('image')).toBe(image);
  expect(Object.fromEntries(writes[1])).toEqual(Object.fromEntries(writes[0]));
  await act(async () => release()); await waitFor(() => expect(done).toHaveBeenCalledOnce());
});
it.each([['bad.svg', 'image/svg+xml', 1], ['large.png', 'image/png', 5 * 1024 * 1024 + 1]])('rejects %s and allows correcting the file without losing the location', async (name, type, size) => {
  mount(); fill(); fireEvent.change(screen.getByLabelText('Picture (optional)'), { target: { files: [new File([new Uint8Array(size)], name, { type })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy(); expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Picture (optional)'), { target: { files: [] } }); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1)); expect(writes[0].get('pk_for_location')).toBe('venue-1');
});
it.each([true, false])('does not affect a replacement draft after a discarded request finishes (success=%s)', async success => {
  let release: () => void = () => {}; client.defaults.adapter = async config => { writes.push(config.data); await new Promise<void>(resolve => { release = resolve; }); if (!success) throw new Error('synthetic failure'); return { config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: { pk: 'org-1' } } }; };
  const done = vi.fn(); const persisted = vi.fn(); const progress = vi.fn(); const first = mount(done, persisted, progress); fill(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); await waitFor(() => expect(writes).toHaveLength(1)); first.unmount();
  mount(done, persisted, progress); fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Replacement organization' } }); const progressCalls = progress.mock.calls.length;
  await act(async () => release()); expect(done).not.toHaveBeenCalled(); expect(persisted).toHaveBeenCalledTimes(success ? 1 : 0); expect(progress).toHaveBeenCalledTimes(progressCalls);
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Replacement organization'); expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByLabelText('Current route').textContent).toBe('/map?city=City&q=old');
});
it('keeps the draft open for an incomplete creation response', async () => {
  client.defaults.adapter = async config => ({ config, status: 201, statusText: 'Created', headers: new AxiosHeaders(), data: { error: 0, data: {} } });
  const done = vi.fn(); const persisted = vi.fn(); mount(done, persisted); fill(); fireEvent.click(screen.getByRole('button', { name: 'Create' })); expect(await screen.findByRole('alert')).toBeTruthy(); expect(done).not.toHaveBeenCalled(); expect(persisted).not.toHaveBeenCalled();
});
