// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaseMap from '../BaseMap';
const sdk = vi.hoisted(() => ({ maps: [] as Array<{ options: Record<string, unknown>; listeners: Map<string, Set<() => void>>; remove: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; setStyle: ReturnType<typeof vi.fn> }> }));
vi.mock('@maptiler/sdk', () => ({ config: {}, MapStyle: { BASIC: { DARK: 'dark', LIGHT: 'light' } }, Map: class {
  options; listeners = new Map<string, Set<() => void>>(); remove = vi.fn(); resize = vi.fn(); setStyle = vi.fn();
  constructor(options: Record<string, unknown>) { this.options = options; sdk.maps.push(this); }
  on(name: string, fn: () => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn); }
  off(name: string, fn: () => void) { this.listeners.get(name)?.delete(fn); }
} }));
afterEach(() => { cleanup(); sdk.maps.length = 0; vi.unstubAllGlobals(); });
it('starts neutral, creates once, observes resize/theme and removes listeners and map', async () => {
  let resize = () => {}; const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { constructor(fn: () => void) { resize = fn; } observe() {} disconnect = disconnect; });
  const loaded = vi.fn(); const view = render(<BaseMap onMapLoad={loaded} />);
  const map = sdk.maps[0]; expect(map.options.center).toEqual([0, 20]); expect(map.options.zoom).toBe(2); expect(map.options.geolocateControl).toBe(false);
  view.rerender(<BaseMap onMapLoad={loaded} />); expect(sdk.maps).toHaveLength(1);
  act(() => resize()); expect(map.resize).toHaveBeenCalled();
  await act(async () => document.documentElement.classList.toggle('dark')); expect(map.setStyle).toHaveBeenCalled();
  view.unmount(); expect(map.remove).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalled();
  expect([...map.listeners.values()].every(listeners => !listeners.size)).toBe(true);
});
it('reports SDK load errors to the page', () => {
  const error = vi.fn(); render(<BaseMap onMapLoad={() => {}} onMapError={error} />);
  act(() => { for (const fn of sdk.maps[0].listeners.get('error') ?? []) fn(); });
  expect(error).toHaveBeenCalled();
});
