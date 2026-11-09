// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '../DiscoveryContext';
import { getLocationPermission, requestDeviceLocation } from '../deviceLocation';
import { resolveCurrentCity } from '../resolveCity';
import { resolvePlaceCenter, searchCityPlaces } from '../geoNames';
import type { CityPlace, DiscoveryPreference, PlaceSelection } from '../place';
import type { TelegramApp } from '@/platform/telegram';

const store = vi.hoisted(() => ({ preference: null as DiscoveryPreference | null, read: vi.fn(), warning: false }));
vi.mock('../preferences', () => ({
  readCachedDiscoveryPreference: () => ({ preference: store.preference, warning: store.warning }),
  readDiscoveryPreference: (...args: unknown[]) => store.read(...args),
  writeDiscoveryPreference: async (value: DiscoveryPreference) => { store.preference = value; return { warning: store.warning }; },
}));
vi.mock('../api', () => ({ fetchCountries: async () => [], fetchResults: async () => ({ activities: [], teams: [], organizations: [] }) }));
vi.mock('../deviceLocation', () => ({ getLocationPermission: vi.fn(), requestDeviceLocation: vi.fn() }));
vi.mock('../resolveCity', () => ({ resolveCurrentCity: vi.fn() }));
vi.mock('../geoNames', () => ({ resolvePlaceCenter: vi.fn(), searchCityPlaces: vi.fn() }));
vi.mock('@/api/authApi', () => ({ isInTelegram: () => Boolean(nativeWindow.Telegram) }));
const nativeWindow = window as Window & { Telegram?: { WebApp: TelegramApp } };
const city: CityPlace = { country: 'Example', state: 'North', city: 'First', geonameId: 101, center: [10, 20] };
const first: PlaceSelection = { geo: { level: 'city', country: 'Example', state: 'North', city: 'First' }, geonameId: 101, center: [10, 20] };
const second: PlaceSelection = { geo: { level: 'city', country: 'Example', state: 'South', city: 'Second' }, geonameId: 202, center: [30, 40] };
const pref = (mode: DiscoveryPreference['mode'] = 'auto'): DiscoveryPreference => ({ version: 1, mode, place: first, recent: [first], welcomeSeen: true, updatedAt: 100 });
const link = '/map?level=city&country=Example&state=North&city=First';
let d: ReturnType<typeof useDiscovery>;
let navigate: ReturnType<typeof useNavigate>;
let url = '';
function Probe() { d = useDiscovery(); navigate = useNavigate(); const route = useLocation(); url = route.pathname + route.search; return null; }
function App({ path = '/map', session = 'anonymous' }) { return <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><span>{session}</span><Probe /></DiscoveryProvider></MemoryRouter>; }
const flush = () => act(async () => { await Promise.resolve(); });
async function mount(path = '/map') { const view = render(<App path={path} />); await flush(); return view; }
function delayed<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function action(run: () => unknown) { await act(async () => { run(); }); }
async function foreground() { await action(() => document.dispatchEvent(new Event('visibilitychange'))); }
const saved = () => store.preference!;

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000); vi.resetAllMocks();
  store.preference = null; store.warning = false;
  store.read.mockImplementation(async () => ({ preference: store.preference, warning: store.warning }));
  vi.mocked(getLocationPermission).mockResolvedValue('unknown');
  vi.mocked(requestDeviceLocation).mockResolvedValue({ latitude: 1, longitude: 2 });
  vi.mocked(resolveCurrentCity).mockResolvedValue(city);
  vi.mocked(resolvePlaceCenter).mockResolvedValue(null);
  vi.mocked(searchCityPlaces).mockResolvedValue([]);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  delete nativeWindow.Telegram;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete nativeWindow.Telegram; });

it('displays cache immediately while native read hangs, then follows with granted permission', async () => {
  store.preference = pref(); const native = delayed<{ preference: DiscoveryPreference; warning: boolean }>(); store.read.mockReturnValue(native.promise);
  vi.mocked(getLocationPermission).mockResolvedValue('granted');
  render(<App />);
  expect(d.location?.place).toEqual(first);
  expect(requestDeviceLocation).not.toHaveBeenCalled();
  await action(() => native.resolve({ preference: pref(), warning: false }));
  expect(d.location.mode).toBe('auto'); expect(url).toContain('loc=auto'); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
});
it('starts automatic following without preferences when readable permission is granted', async () => {
  vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount();
  expect(d.location?.place).toEqual(first); expect(saved().mode).toBe('auto'); expect(saved().place).toEqual(first);
});
it('opens first-use welcome once and persists dismissal', async () => {
  const view = await mount(); expect(d.location?.welcome).toBe(true);
  await action(() => d.location.dismissWelcome()); expect(d.location.welcome).toBe(false); expect(saved().welcomeSeen).toBe(true);
  view.unmount(); await mount(); expect(d.location.welcome).toBe(false); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('explicit location works in city surface and accepts its city before the caller closes', async () => {
  await mount(); await action(() => d.openSurface('city')); await action(() => d.location.useCurrentLocation());
  expect(d.surface).toBe('city'); expect(d.location.place).toEqual(first); expect(saved().mode).toBe('auto'); expect(url).toContain('loc=auto');
  await action(() => d.closeSurface()); expect(d.location.place).toEqual(first); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
});
it.each(['denied', 'unknown', 'prompt', 'unavailable'] as const)('never automatically requests when permission is %s', async permission => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue(permission); await mount('/map?loc=auto');
  expect(d.location?.place).toEqual(first); expect(requestDeviceLocation).not.toHaveBeenCalled();
  expect(d.location.status).toBe(permission === 'denied' ? 'denied' : permission === 'unavailable' ? 'unavailable' : 'idle');
});
it('reloads auto marker and respects revoked permission on a later foreground', async () => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount(link + '&loc=auto');
  expect(d.location?.mode).toBe('auto'); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
  vi.mocked(getLocationPermission).mockResolvedValue('denied'); await act(async () => { await vi.advanceTimersByTimeAsync(300000); }); await foreground();
  expect(requestDeviceLocation).toHaveBeenCalledTimes(1); expect(d.location.status).toBe('denied'); expect(d.location.place).toEqual(first);
});
it('unmarked valid geography wins for the visit without changing the saved auto preference', async () => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount('/map?level=city&country=Example&state=South&city=Second');
  expect(d.location?.place?.geo).toEqual(second.geo); expect(d.location.mode).toBe('manual'); expect(saved().mode).toBe('auto'); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('bare root restores saved manual city and legacy setState selection persists without the auto marker', async () => {
  store.preference = pref('manual'); await mount('/'); expect(d.location?.place).toEqual(first); expect(url).toContain('city=First');
  await action(() => d.setState(s => ({ ...s, geo: second.geo, follow: true })));
  expect(d.location.place?.geo).toEqual(second.geo); expect(saved().mode).toBe('manual'); expect(url).not.toContain('loc=auto');
});
it('manual selection persists recent places and removes the follow marker', async () => {
  store.preference = pref(); await mount('/map?loc=auto'); await action(() => d.location.selectPlace(second));
  expect(d.location.place).toEqual(second); expect(d.location.mode).toBe('manual'); expect(saved().recent).toEqual([second, first]); expect(url).not.toContain('loc=auto');
  expect(saved().updatedAt).toBeGreaterThan(100); const before = saved().updatedAt;
  await action(() => d.location.selectPlace(first)); expect(saved().updatedAt).toBeGreaterThan(before);
});
it('forget clears place and recent history, persists off/welcomeSeen and prevents restart', async () => {
  store.preference = pref(); await mount(); await action(() => d.location.forgetPlaces());
  expect(d.location.place).toBeNull(); expect(d.location.recent).toEqual([]); expect(d.location.mode).toBe('off'); expect(saved()).toMatchObject({ mode: 'off', place: null, recent: [], welcomeSeen: true }); expect(url).not.toContain('city=');
  vi.mocked(getLocationPermission).mockResolvedValue('granted'); await act(async () => { await vi.advanceTimersByTimeAsync(300000); }); await foreground(); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('requires browser and native foreground, coalesces activated/visibility events at the five minute boundary', async () => {
  const events = new Map<string, () => void>(); let active = false;
  nativeWindow.Telegram = { WebApp: { isVersionAtLeast: () => true, get isActive() { return active; }, onEvent: (name, fn) => events.set(name, fn), offEvent: name => { events.delete(name); } } };
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); const view = await mount();
  expect(d.location?.place).toEqual(first); expect(getLocationPermission).not.toHaveBeenCalled(); expect(requestDeviceLocation).not.toHaveBeenCalled();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); active = true; await action(() => events.get('activated')?.()); expect(requestDeviceLocation).not.toHaveBeenCalled();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); await action(() => { events.get('activated')?.(); document.dispatchEvent(new Event('visibilitychange')); }); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(299999); }); await foreground(); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); }); await action(() => { events.get('activated')?.(); document.dispatchEvent(new Event('visibilitychange')); }); expect(requestDeviceLocation).toHaveBeenCalledTimes(2);
  view.unmount(); expect(events.size).toBe(0);
});
it('login/logout rerenders never request location', async () => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); const view = await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(300000); });
  view.rerender(<App session="authenticated" />); await flush(); view.rerender(<App session="anonymous" />); await flush();
  expect(d.location?.mode).toBe('auto'); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
});
it.each(['/activities/item', '/new', 'profile', 'create'] as const)('pauses automatic work under %s and retries only on eligible return', async target => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount();
  await action(() => target.startsWith('/') ? navigate(target) : d.openSurface(target as 'profile' | 'create'));
  await act(async () => { await vi.advanceTimersByTimeAsync(300000); }); await foreground(); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
  await action(() => target.startsWith('/') ? navigate('/map?loc=auto') : d.closeSurface()); expect(requestDeviceLocation).toHaveBeenCalledTimes(2);
});
it.each(['read', 'gps', 'provider', 'center'] as const)('late %s completion cannot overwrite a newer manual choice', async stage => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted');
  const pending = delayed<never>();
  if (stage === 'read') store.read.mockReturnValue(pending.promise);
  if (stage === 'gps') vi.mocked(requestDeviceLocation).mockReturnValue(pending.promise);
  if (stage === 'provider') vi.mocked(resolveCurrentCity).mockReturnValue(pending.promise);
  if (stage === 'center') { store.preference = pref('manual'); vi.mocked(resolvePlaceCenter).mockReturnValue(pending.promise); }
  await mount(); if (stage === 'center') await action(() => d.location.selectPlace({ geo: first.geo }));
  await action(() => d.location.selectPlace(second));
  await action(() => pending.resolve((stage === 'read' ? { preference: { ...pref(), updatedAt: 9_000_000 }, warning: false } : stage === 'gps' ? { latitude: 1, longitude: 2 } : stage === 'provider' ? city : first) as never));
  expect(d.location.place).toEqual(second); expect(saved().place).toEqual(second); expect(url).toContain('city=Second'); expect(d.location.cameraRequest.place).toEqual(second);
});
it.each(['navigate', 'forget', 'profile', 'deactivate'] as const)('late provider completion cannot mutate after %s', async intent => {
  const events = new Map<string, () => void>(); let active = true;
  nativeWindow.Telegram = { WebApp: { isVersionAtLeast: () => true, get isActive() { return active; }, onEvent: (name, fn) => events.set(name, fn) } };
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); const pending = delayed<CityPlace | null>(); vi.mocked(resolveCurrentCity).mockReturnValue(pending.promise); await mount();
  const timestamp = saved().updatedAt;
  await action(() => { if (intent === 'navigate') navigate('/activities/item'); else if (intent === 'forget') d.location.forgetPlaces(); else if (intent === 'profile') d.openSurface('profile'); else { active = false; events.get('deactivated')?.(); } });
  await action(() => pending.resolve({ ...city, city: 'Late' }));
  expect(d.location.place).toEqual(intent === 'forget' ? null : first); if (intent !== 'forget') expect(saved().updatedAt).toBe(timestamp);
});
it('same-city auto preserves camera sequence; explicit select and recenter each move once', async () => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount(); const sequence = d.location.cameraRequest.sequence;
  await act(async () => { await vi.advanceTimersByTimeAsync(300000); }); await foreground(); expect(d.location.cameraRequest.sequence).toBe(sequence);
  await action(() => d.location.selectPlace(first)); expect(d.location.cameraRequest.sequence).toBe(sequence + 1);
  await action(() => d.location.recenter()); expect(d.location.cameraRequest.sequence).toBe(sequence + 2);
});
it('failed center retains the previous camera and gives a retry notice', async () => {
  store.preference = pref('manual'); await mount(); const camera = d.location.cameraRequest;
  await action(() => d.location.selectPlace({ geo: second.geo }));
  expect(d.location.place?.geo).toEqual(second.geo); expect(d.location.cameraRequest).toEqual(camera); expect(d.location.notice).toMatch(/center.*try again/i);
  vi.mocked(resolvePlaceCenter).mockResolvedValue(second); await action(() => d.location.recenter()); expect(d.location.cameraRequest.place).toEqual(second); expect(d.location.notice).toBeNull();
});
it.each([['NotAllowedError', 'denied'], ['NotSupportedError', 'unavailable'], ['TimeoutError', 'error']] as const)('retains city and offers recovery after %s', async (name, status) => {
  store.preference = pref('manual'); await mount(); vi.mocked(requestDeviceLocation).mockRejectedValue(new DOMException('Synthetic failure', name)); await action(() => d.location.useCurrentLocation());
  expect(d.location.place).toEqual(first); expect(d.location.status).toBe(status); expect(d.location.notice).toMatch(/choose|try again/i);
});
it('unresolved city retains previous selection and reports unmatched', async () => {
  store.preference = pref('manual'); await mount(); vi.mocked(resolveCurrentCity).mockResolvedValue(null); await action(() => d.location.useCurrentLocation()); expect(d.location.place).toEqual(first); expect(d.location.status).toBe('unmatched');
});
it('closed city search cannot return stale results and newer search cancels older search', async () => {
  await mount(); await action(() => d.openSurface('city')); const pending = delayed<CityPlace[]>(); vi.mocked(searchCityPlaces).mockReturnValue(pending.promise);
  let search!: Promise<CityPlace[]>; await action(() => { search = d.location.searchPlaces('Fi'); }); await action(() => d.closeSurface()); await action(() => pending.resolve([city])); expect(await search).toEqual([]);
  await action(() => d.openSurface('city')); const older = delayed<CityPlace[]>(); vi.mocked(searchCityPlaces).mockReturnValueOnce(older.promise).mockResolvedValue([city]);
  let old!: Promise<CityPlace[]>; await action(() => { old = d.location.searchPlaces('Ol'); }); await action(() => d.location.searchPlaces('Fi')); await action(() => older.resolve([{ ...city, city: 'Old' }])); expect(await old).toEqual([]);
});
it('storage failure is nonblocking and Profile → city → close restores Profile with camera memory intact', async () => {
  store.warning = true; await mount(); await action(() => d.openSurface('profile')); await action(() => d.openSurface('city', 'profile')); await action(() => d.location.selectPlace(second));
  const memory = d.cameraMemory; memory.current = { center: [10, 20], zoom: 7, bearing: 0, pitch: 0, appliedSequence: 1 };
  await action(() => d.closeSurface()); expect(d.surface).toBe('profile'); expect(d.cameraMemory).toBe(memory); expect(d.location.place).toEqual(second); expect(d.location.persistenceWarning).toBe(true);
});
it('closing the picker preserves only the newly accepted manual city center', async () => {
  store.preference = pref('manual'); await mount(); await action(() => d.openSurface('city'));
  const pending = delayed<PlaceSelection | null>(); vi.mocked(resolvePlaceCenter).mockReturnValue(pending.promise);
  await action(() => { d.location.selectPlace({ geo: second.geo }); d.closeSurface(); });
  expect(d.surface).toBe('none'); expect(d.location.place?.geo).toEqual(second.geo);
  await action(() => pending.resolve(second)); expect(d.location.cameraRequest.place).toEqual(second); expect(saved().place).toEqual(second);
});
it('newer native preference replaces restored cache without treating its own URL as a manual link', async () => {
  store.preference = pref('manual'); const pending = delayed<{ preference: DiscoveryPreference; warning: boolean }>(); store.read.mockReturnValue(pending.promise);
  await mount(); expect(d.location.place).toEqual(first);
  await action(() => pending.resolve({ preference: { ...pref('manual'), place: second, updatedAt: 500 }, warning: false }));
  expect(d.location.place).toEqual(second); expect(url).toContain('city=Second');
});
it('explicit location returns true only for accepted success so the picker can retain recovery UI', async () => {
  await mount(); await action(() => d.openSurface('city')); let accepted: unknown;
  await act(async () => { accepted = await d.location.useCurrentLocation(); }); expect(accepted).toBe(true);
  vi.mocked(resolveCurrentCity).mockResolvedValue(null); await act(async () => { accepted = await d.location.useCurrentLocation(); }); expect(accepted).toBe(false); expect(d.surface).toBe('city');
  vi.mocked(requestDeviceLocation).mockRejectedValue(new DOMException('Denied', 'NotAllowedError')); await act(async () => { accepted = await d.location.useCurrentLocation(); }); expect(accepted).toBe(false);
});
it('native read cancelled by backgrounding cannot strand the location lifecycle on return', async () => {
  store.preference = pref(); store.read.mockReturnValue(new Promise(() => {})); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); await foreground();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); await foreground();
  expect(requestDeviceLocation).toHaveBeenCalledTimes(1); expect(d.location.mode).toBe('auto');
});
it('legacy combined geography/query/entity updates preserve every selected field', async () => {
  await mount(link); await action(() => d.setState(s => ({ ...s, geo: second.geo, query: 'tennis', entity: 'teams' })));
  expect(d.state).toMatchObject({ geo: second.geo, query: 'tennis', entity: 'teams' }); expect(saved().mode).toBe('manual');
});
it('StrictMode setup replay makes only one device request', async () => {
  vi.mocked(getLocationPermission).mockResolvedValue('granted');
  render(<StrictMode><App /></StrictMode>); await flush();
  expect(d.location.place).toEqual(first); expect(requestDeviceLocation).toHaveBeenCalledTimes(1);
});
it('query/category/list/Profile changes preserve camera sequence and memory', async () => {
  store.preference = pref('manual'); await mount(); const camera = d.location.cameraRequest; const memory = d.cameraMemory;
  await action(() => d.setState(s => ({ ...s, query: 'sport', entity: 'teams', view: 'list' })));
  await action(() => d.openSurface('profile')); await action(() => d.closeSurface());
  expect(d.location.cameraRequest).toEqual(camera); expect(d.cameraMemory).toBe(memory);
});
it('create rejects a competing surface until its own confirmed close', async () => {
  await mount(); await action(() => d.openSurface('create')); await action(() => d.openSurface('profile'));
  expect(d.surface).toBe('create'); await action(() => d.closeSurface()); expect(d.surface).toBe('none');
});
it('an external bare-root navigation restores saved following after a manual-link visit', async () => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount(link);
  expect(requestDeviceLocation).not.toHaveBeenCalled(); await action(() => navigate('/'));
  expect(d.location.mode).toBe('auto'); expect(requestDeviceLocation).toHaveBeenCalledTimes(1); expect(url).toContain('loc=auto');
});
it('suspends restoration and auto work while a creation handoff owns the destination URL', async () => {
  store.preference = pref(); vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount(link);
  await action(() => navigate('/organizations', { state: { createdOrganization: { pending: true } } }));
  expect(url).toBe('/organizations'); expect(requestDeviceLocation).not.toHaveBeenCalled();
  await action(() => navigate('/organizations?level=city&country=Example&state=South&city=Second', { replace: true, state: {} }));
  expect(d.location.place?.geo).toEqual(second.geo); expect(d.location.mode).toBe('manual'); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('defers a stored city center lookup until both foreground and the discovery surface are eligible', async () => {
  const events = new Map<string, () => void>(); let active = false;
  nativeWindow.Telegram = { WebApp: { isVersionAtLeast: () => true, get isActive() { return active; }, onEvent: (name, fn) => events.set(name, fn) } };
  store.preference = { ...pref('manual'), place: { geo: first.geo } }; vi.mocked(resolvePlaceCenter).mockResolvedValue(first);
  await mount(); expect(resolvePlaceCenter).not.toHaveBeenCalled();
  await action(() => d.openSurface('profile')); active = true; await action(() => events.get('activated')?.()); expect(resolvePlaceCenter).not.toHaveBeenCalled();
  await action(() => d.closeSurface()); expect(d.location.cameraRequest.place).toEqual(first); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
it('recenter on an unmarked visit never changes the saved auto mode or recent history', async () => {
  store.preference = { ...pref(), place: { geo: first.geo } }; await mount(link); const before = saved();
  vi.mocked(resolvePlaceCenter).mockResolvedValue(first); await action(() => d.location.recenter());
  expect(d.location.cameraRequest.place).toEqual(first); expect(d.location.mode).toBe('manual'); expect(saved()).toEqual(before);
});
it.each([true, false])('recenter during native restore preserves following and saved intent (cached center: %s)', async hasCenter => {
  const cached = { ...pref(), place: hasCenter ? first : { geo: first.geo } };
  store.preference = cached;
  const native = delayed<{ preference: DiscoveryPreference; warning: boolean }>(); store.read.mockReturnValue(native.promise);
  vi.mocked(getLocationPermission).mockResolvedValue('granted');
  await mount(); const sequence = d.location.cameraRequest.sequence;
  await action(() => d.location.recenter());
  expect(d.location.cameraRequest.sequence).toBe(sequence + (hasCenter ? 1 : 0));
  expect(saved()).toEqual(cached); expect(d.location.mode).toBe('auto');
  await action(() => native.resolve({ preference: cached, warning: false }));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); await foreground();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); await foreground();
  expect(requestDeviceLocation).toHaveBeenCalledTimes(1); expect(d.location.place).toEqual(first);
  expect(saved().mode).toBe('auto'); expect(saved().recent).toEqual(cached.recent);
});
it('recenter keeps native reconciliation alive so a newer saved manual choice still wins', async () => {
  const cached = pref(); store.preference = cached;
  const native = delayed<{ preference: DiscoveryPreference; warning: boolean }>(); store.read.mockReturnValue(native.promise);
  vi.mocked(getLocationPermission).mockResolvedValue('granted'); await mount();
  await action(() => d.location.recenter()); expect(saved()).toEqual(cached);
  await action(() => native.resolve({ preference: { ...pref('manual'), place: second, recent: [second], updatedAt: 500 }, warning: false }));
  expect(d.location.place).toEqual(second); expect(d.location.mode).toBe('manual'); expect(d.location.recent).toEqual([second]);
  expect(url).toContain('city=Second'); expect(requestDeviceLocation).not.toHaveBeenCalled();
});
