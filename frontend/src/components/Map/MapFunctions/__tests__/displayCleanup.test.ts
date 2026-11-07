import { expect, it, vi } from 'vitest';
import { displayActivities } from '../DisplayActivities';
import { displayTeams } from '../DisplayTeams';

vi.mock('@maptiler/sdk', () => ({}));

for (const kind of ['activities', 'teams'] as const) {
  it(`removes ${kind} click handlers before layers and attaches one per setup`, () => {
    const listeners = new Map<string, Set<(event: any) => void>>();
    const layers = new Set<string>();
    const sources = new Set<string>();
    let queries = 0;
    const map = {
      hasImage: () => true,
      addSource: (id: string) => sources.add(id),
      addLayer: ({ id }: { id: string }) => layers.add(id),
      getSource: (id: string) => sources.has(id) ? { getClusterExpansionZoom: (_id: number, callback: any) => callback(null, 7) } : undefined,
      getLayer: (id: string) => layers.has(id),
      removeSource: (id: string) => sources.delete(id),
      removeLayer: (id: string) => {
        expect(listeners.get(id)?.size ?? 0).toBe(0);
        layers.delete(id);
      },
      on: (_event: string, id: string, callback: (event: any) => void) => {
        if (!listeners.has(id)) listeners.set(id, new Set());
        listeners.get(id)!.add(callback);
      },
      off: (_event: string, id: string, callback: (event: any) => void) => listeners.get(id)?.delete(callback),
      queryRenderedFeatures: () => { queries++; return [{ properties: { pk: 'activity', name: 'Team', cluster_id: 4 }, geometry: { coordinates: [69, 41] } }]; },
      easeTo: vi.fn(),
    };
    const selected = vi.fn(); const open = vi.fn();
    const setup = () => kind === 'activities'
      ? displayActivities([{ pk: 'activity', location: { points: { longitude: 69, latitude: 41 } } }] as any, map as any, selected, open)
      : displayTeams([{ name: 'Team', location: [{ points: { longitude: 69, latitude: 41 } }] }] as any, map as any, selected, open);
    for (let index = 0; index < 3; index++) { const clean = setup(); clean(); }
    const clean = setup();
    const marker = kind === 'activities' ? 'unclustered-point' : 'teams';
    const cluster = kind === 'activities' ? 'clusters' : 'teams_clusters';
    for (const handler of listeners.get(marker) ?? []) handler({ point: {} });
    expect(queries).toBe(1); expect(selected).toHaveBeenCalledTimes(1); expect(open).toHaveBeenCalledTimes(1);
    for (const handler of listeners.get(cluster) ?? []) handler({ point: {} });
    expect(queries).toBe(2); expect(map.easeTo).toHaveBeenCalledTimes(1);
    clean();
    expect([...listeners.values()].every(value => value.size === 0)).toBe(true);
  });
}
