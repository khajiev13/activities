// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { useDiscovery } from '@/discovery/DiscoveryContext';
import RenderMap from '../RenderMap';
const fixtures = vi.hoisted(() => ({ context: {} as ReturnType<typeof useDiscovery>, maps: [] as FakeMap[], draws: vi.fn(), clean: vi.fn() }));
class FakeMap {
  listeners = new Map<string, Set<() => void>>();
  center = { lng: 0, lat: 20 }; zoom = 2; bearing = 0; pitch = 0; ready = true; source = true;
  container = document.createElement('div');
  jumpTo = vi.fn((options: { center: [number, number]; zoom: number; bearing?: number; pitch?: number }) => { this.center = { lng: options.center[0], lat: options.center[1] }; this.zoom = options.zoom; this.bearing = options.bearing ?? 0; this.pitch = options.pitch ?? 0; });
  easeTo = vi.fn(); fitBounds = vi.fn(); panBy = vi.fn(); stop = vi.fn();
  loaded() { return this.ready; } isStyleLoaded() { return this.ready; } getSource() { return this.source; }
  getContainer() { return this.container; } getCenter() { return this.center; } getZoom() { return this.zoom; } getBearing() { return this.bearing; } getPitch() { return this.pitch; }
  project() { return { x: 180, y: 540 }; }
  on(name: string, callback: () => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(callback); }
  off(name: string, callback: () => void) { this.listeners.get(name)?.delete(callback); }
  emit(name: string) { this.listeners.get(name)?.forEach(callback => callback()); }
}
vi.mock('@/discovery/DiscoveryContext', () => ({ useDiscovery: () => fixtures.context }));
vi.mock('../BaseMap', async () => {
  const { useEffect, useRef } = await import('react');
  return { default: function TestBaseMap({ onMapLoad }: { onMapLoad: (map: FakeMap) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { const map = new FakeMap(); map.container = ref.current!; fixtures.maps.push(map); onMapLoad(map); }, [onMapLoad]);
    return <div ref={ref} />;
  } };
});
vi.mock('../MapFunctions/DisplayActivities', () => ({ displayActivities: (...args: unknown[]) => { fixtures.draws(...args); return fixtures.clean; } }));
vi.mock('../MapFunctions/DisplayTeams', () => ({ displayTeams: (...args: unknown[]) => { fixtures.draws(...args); return fixtures.clean; } }));
vi.mock('../MapFunctions/DisplayOrganizations', () => ({ displayOrganizations: (...args: unknown[]) => { fixtures.draws(...args); return fixtures.clean; } }));
vi.mock('@/components/Discovery/ResultCard', () => ({ ResultCard: () => <p>Selected card</p> }));
const place = { geo: { level: 'city' as const, country: 'Example country', state: 'Example region', city: 'Example city' }, center: [10, 40] as [number, number] };
let resize: () => void; const disconnect = vi.fn();
function App() { return <div data-discovery-geometry><div className="discovery-page"><div data-discovery-top /><RenderMap onOrganization={() => {}} onError={() => {}} /></div><div data-discovery-dock /><div data-discovery-actions /></div>; }
beforeEach(() => {
  fixtures.context = { state: { entity: 'activities', view: 'map', query: '', geo: place.geo }, results: { activities: [], teams: [], organizations: [] }, selected: null, loading: false, setSelected: vi.fn(), cameraMemory: { current: null }, location: { place, cameraRequest: { sequence: 1, place }, notice: null, recenter: vi.fn() } } as unknown as ReturnType<typeof useDiscovery>;
  fixtures.maps.length = 0; vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} unobserve() {} disconnect = disconnect; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('centers a city with no records exactly once and preserves browsing across results, query, category, view and style changes', () => {
  const view = render(<App />); const map = fixtures.maps[0];
  expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [10, 40], zoom: 12, duration: 500 }));
  for (const state of [{ query: 'walking' }, { entity: 'teams' }, { view: 'list' }, { view: 'map' }]) {
    fixtures.context.state = { ...fixtures.context.state, ...state } as typeof fixtures.context.state;
    fixtures.context.results = { ...fixtures.context.results }; view.rerender(<App />);
  }
  act(() => map.emit('style.load')); expect(map.easeTo).toHaveBeenCalledTimes(1); expect(map.fitBounds).not.toHaveBeenCalled(); expect(map.jumpTo).not.toHaveBeenCalled();
  fixtures.context.location.cameraRequest = { sequence: 2, place }; view.rerender(<App />); expect(map.easeTo).toHaveBeenCalledTimes(2);
});
it('persists moveend camera and restores it before applying only a newer intent on remount', () => {
  const view = render(<App />); const map = fixtures.maps[0];
  map.center = { lng: 11, lat: 41 }; map.zoom = 8; map.bearing = 15; map.pitch = 10;
  act(() => map.emit('moveend'));
  expect(fixtures.context.cameraMemory.current).toEqual({ center: [11, 41], zoom: 8, bearing: 15, pitch: 10, appliedSequence: 1 });
  view.unmount(); render(<App />); const restored = fixtures.maps[1];
  expect(restored.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: [11, 41], zoom: 8, bearing: 15, pitch: 10 })); expect(restored.easeTo).not.toHaveBeenCalled();
  expect([...map.listeners.values()].every(callbacks => callbacks.size === 0)).toBe(true);
});
it('ignores obsolete and delayed intents and keeps the camera when center lookup fails, with visible retry', () => {
  const view = render(<App />); const map = fixtures.maps[0];
  fixtures.context.location.cameraRequest = { sequence: 0, place: { ...place, center: [20, 50] } }; view.rerender(<App />);
  fixtures.context.location.cameraRequest = { sequence: 2, place: { geo: place.geo } }; fixtures.context.location.notice = 'Could not find this place’s center. Try again with Center map.'; view.rerender(<App />);
  expect(map.easeTo).toHaveBeenCalledTimes(1); expect(map.jumpTo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Center map' })); expect(fixtures.context.location.recenter).toHaveBeenCalledOnce();
  fixtures.context.location.cameraRequest = { sequence: 3, place: { ...place, center: [30, 50] } }; view.rerender(<App />);
  fixtures.context.location.cameraRequest = { sequence: 2, place }; view.rerender(<App />); expect(map.easeTo).toHaveBeenCalledTimes(2);
});
it('waits for load, consumes the latest intent and honors reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  fixtures.context.location.cameraRequest = { sequence: 0, place: null };
  const view = render(<App />); const map = fixtures.maps[0]; map.ready = false;
  fixtures.context.location.cameraRequest = { sequence: 1, place }; view.rerender(<App />); expect(map.easeTo).not.toHaveBeenCalled();
  fixtures.context.location.cameraRequest = { sequence: 2, place: { ...place, center: [30, 50] } }; view.rerender(<App />);
  map.ready = true; act(() => map.emit('load')); expect(map.easeTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ center: [30, 50], duration: 0 }));
});
it('restores missing marker sources after style loading without moving the camera', () => {
  render(<App />); const map = fixtures.maps[0]; const initial = fixtures.draws.mock.calls.length;
  map.source = false; map.ready = false; act(() => map.emit('style.load')); expect(fixtures.draws).toHaveBeenCalledTimes(initial);
  map.ready = true; act(() => map.emit('idle')); expect(fixtures.draws).toHaveBeenCalledTimes(initial + 1); expect(map.easeTo).toHaveBeenCalledTimes(1);
});
it('observes late SDK credits, expansion, dock and preview geometry, then cleans observers', async () => {
  const mutationDisconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const view = render(<App />); const root = view.container.querySelector('[data-discovery-geometry]') as HTMLElement;
  const dock = root.querySelector('[data-discovery-dock]') as HTMLElement;
  dock.getBoundingClientRect = () => ({ height: 76 } as DOMRect);
  const controls = document.createElement('div'); controls.className = 'maplibregl-ctrl-bottom-right'; let creditHeight = 30;
  controls.getBoundingClientRect = () => ({ height: creditHeight } as DOMRect);
  await act(async () => { fixtures.maps[0].container.append(controls); });
  expect(resize).toBeTypeOf('function'); act(() => resize()); expect(root.style.getPropertyValue('--discovery-credit-height')).toBe('30px'); expect(root.style.getPropertyValue('--discovery-dock-height')).toBe('76px');
  creditHeight = 88; act(() => resize()); expect(root.style.getPropertyValue('--discovery-credit-height')).toBe('88px');
  expect(fixtures.maps[0].easeTo).toHaveBeenCalledTimes(1); view.unmount(); expect(disconnect).toHaveBeenCalled(); expect(mutationDisconnect).toHaveBeenCalled(); expect(root.style.getPropertyValue('--discovery-credit-height')).toBe('');
  await act(async () => { controls.append(document.createElement('a')); }); expect(root.style.getPropertyValue('--discovery-credit-height')).toBe(''); mutationDisconnect.mockRestore();
});
it('does not apply a delayed old-city intent after a new place without a center was chosen', () => {
  fixtures.context.location.cameraRequest = { sequence: 0, place: null }; const view = render(<App />); const map = fixtures.maps[0]; map.ready = false;
  fixtures.context.location.cameraRequest = { sequence: 1, place }; view.rerender(<App />);
  fixtures.context.location.place = { geo: { ...place.geo, city: 'Another city' } }; view.rerender(<App />);
  map.ready = true; act(() => map.emit('load')); expect(map.easeTo).not.toHaveBeenCalled();
});
it('keeps a selected pin above the measured preview with one minimal pan, including a rerender before the frame', () => {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
  const view = render(<App />); const map = fixtures.maps[0];
  map.container.getBoundingClientRect = () => ({ width: 360, height: 600, top: 0, bottom: 600 } as DOMRect);
  const teams = [{ name: 'Example team', country_name: place.geo.country, state_name: place.geo.state, city_name: place.geo.city, location: [{ points: { longitude: 10, latitude: 40 } }] }] as unknown as typeof fixtures.context.results.teams;
  fixtures.context.state.entity = 'teams'; fixtures.context.results.teams = teams; fixtures.context.selected = 'Example team'; view.rerender(<App />);
  fixtures.context.results.teams = teams.map(team => ({ ...team, location: team.location.map(location => ({ ...location, points: { ...location.points } })) })); view.rerender(<App />);
  const preview = screen.getByRole('region', { name: 'Selected result' });
  preview.getBoundingClientRect = () => ({ height: 120, top: 390, bottom: 510 } as DOMRect);
  const runFrame = () => { const callback = frame; frame = undefined; callback?.(0); };
  act(() => resize()); act(runFrame);
  expect(map.panBy).toHaveBeenCalledExactlyOnceWith([0, 186], { duration: 250 });
  fixtures.context.state.query = 'new query'; view.rerender(<App />); act(runFrame); expect(map.panBy).toHaveBeenCalledTimes(1);
});
it('applies measured overlay padding only on the next city intent', () => {
  const view = render(<App />); const map = fixtures.maps[0];
  map.container.getBoundingClientRect = () => ({ width: 360, height: 600, top: 0, bottom: 600 } as DOMRect);
  const top = view.container.querySelector('[data-discovery-top]')!; top.getBoundingClientRect = () => ({ height: 100, bottom: 100 } as DOMRect);
  const actions = view.container.querySelector('[data-discovery-actions]')!; actions.getBoundingClientRect = () => ({ height: 48, top: 440 } as DOMRect);
  act(() => resize()); expect(map.easeTo).toHaveBeenCalledTimes(1);
  fixtures.context.location.cameraRequest = { sequence: 2, place }; view.rerender(<App />);
  expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ padding: { top: 112, bottom: 172, left: 24, right: 24 } }));
});
it('keeps an organization marker above its external preview after the marker callback', () => {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; }); vi.stubGlobal('cancelAnimationFrame', () => {});
  fixtures.context.state.entity = 'organizations'; const view = render(<App />); const map = fixtures.maps[0];
  map.container.getBoundingClientRect = () => ({ width: 360, height: 600, top: 0, bottom: 600 } as DOMRect);
  const preview = document.createElement('section'); preview.dataset.discoveryPreview = ''; preview.getBoundingClientRect = () => ({ height: 120, top: 390, bottom: 510 } as DOMRect);
  view.container.querySelector('[data-discovery-geometry]')!.append(preview); act(() => resize());
  const select = fixtures.draws.mock.lastCall?.[2] as (item: unknown) => void;
  act(() => select({ pk: 'Example organization', location: { points: { longitude: 10, latitude: 40 } } })); act(() => frame?.(0));
  expect(map.panBy).toHaveBeenCalledExactlyOnceWith([0, 186], { duration: 250 });
});
it('preserves a remembered pan on detail return with the same selected result', () => {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; }); vi.stubGlobal('cancelAnimationFrame', () => {});
  fixtures.context.state.entity = 'teams'; fixtures.context.selected = 'Example team';
  fixtures.context.results.teams = [{ name: 'Example team', country_name: place.geo.country, state_name: place.geo.state, city_name: place.geo.city, location: [{ points: { longitude: 10, latitude: 40 } }] }] as unknown as typeof fixtures.context.results.teams;
  fixtures.context.cameraMemory.current = { center: [11, 41], zoom: 8, bearing: 0, pitch: 0, appliedSequence: 1 };
  render(<App />); const map = fixtures.maps[0];
  map.container.getBoundingClientRect = () => ({ width: 360, height: 600, top: 0, bottom: 600 } as DOMRect);
  const preview = screen.getByRole('region', { name: 'Selected result' }); preview.getBoundingClientRect = () => ({ height: 120, top: 390 } as DOMRect);
  act(() => resize()); act(() => frame?.(0)); expect(map.panBy).not.toHaveBeenCalled(); expect(map.easeTo).not.toHaveBeenCalled();
});
it('does not reserve the absent Results/Create row below a replacing preview', () => {
  const view = render(<App />); const root = view.container.querySelector('[data-discovery-geometry]') as HTMLElement;
  root.querySelector('[data-discovery-actions]')!.remove(); act(() => resize()); expect(root.style.getPropertyValue('--discovery-actions-height')).toBe('0px');
});

it('prioritizes automatic city success over empty-map feedback until the notice clears', () => {
  fixtures.context.location.notice = 'Updated to Example city.'; fixtures.context.location.status = 'idle';
  const view = render(<App />);
  expect(screen.getByRole('status').textContent).toBe('Updated to Example city.');
  expect(screen.queryByText(/No mapped locations/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Center map' })).toBeNull();
  fixtures.context.location.notice = null; view.rerender(<App />);
  expect(screen.getByRole('status').textContent).toBe('No mapped locations are available for Example city, Example region, Example country.');
});
it('prioritizes the location notice over tile loading and restores loading feedback when it clears', () => {
  fixtures.context.location.notice = 'Updated to Example city.';
  const view = render(<App />); act(() => fixtures.maps[0].emit('dataloading'));
  expect(screen.getByRole('status').textContent).toBe('Updated to Example city.');
  fixtures.context.location.notice = null; view.rerender(<App />);
  expect(screen.getByRole('status').textContent).toBe('Loading map tiles…');
});
