import { useEffect, useMemo, useRef, useState } from 'react';
import type * as maptilersdk from '@maptiler/sdk';
import BaseMap from './BaseMap';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import { displayActivities } from './MapFunctions/DisplayActivities';
import { displayTeams } from './MapFunctions/DisplayTeams';
import { displayOrganizations } from './MapFunctions/DisplayOrganizations';
import { ResultCard } from '@/components/Discovery/ResultCard';
import { placeKey } from '@/discovery/place';
import type { DiscoveryResults } from '@/discovery/types';
export default function RenderMap({ onOrganization, onError }: { onOrganization: (item: DiscoveryResults['organizations'][number]) => void; onError: () => void }) {
  const { state, results, selected, setSelected, loading: resultsLoading, location, cameraMemory } = useDiscovery(); const [map, setMap] = useState<maptilersdk.Map>();
  const [organizationPin, setOrganizationPin] = useState<{ point: { longitude: number; latitude: number }; sequence: number; context: string }>();
  const pinContext = JSON.stringify([state.geo, state.entity, state.query]);
  const currentPinContext = useRef(pinContext); currentPinContext.current = pinContext;
  const [loading, setLoading] = useState(true);
  const geometry = useRef({ top: 24, bottom: 180 });
  const applied = useRef(cameraMemory.current?.appliedSequence ?? 0);
  const request = useRef({ intent: location.cameraRequest, place: location.place }); request.current = { intent: location.cameraRequest, place: location.place };
  const callbacks = useRef({ onOrganization, onError, setSelected }); callbacks.current = { onOrganization, onError, setSelected };
  const points = useMemo(() => {
    const geo = state.geo;
    // Empty-map feedback only; results never determine the city camera.
    const belongs = (country: string, region: string, city: string) => geo && country === geo.country
      && (geo.level === 'country' || region === geo.state) && (geo.level !== 'city' || city === geo.city);
    const locations = state.entity === 'teams'
      ? results.teams.filter(item => belongs(item.country_name, item.state_name, item.city_name)).map(item => item.location[0])
      : state.entity === 'activities'
        ? results.activities.filter(item => belongs(item.country.name, item.state.name, item.city.name)).map(item => item.location)
        : results.organizations.filter(item => belongs(item.country.name, item.state.name, item.city.name)).map(item => item.location);
    return locations.filter(location => location && Number.isFinite(location.points.longitude) && Number.isFinite(location.points.latitude) && Math.abs(location.points.longitude) <= 180 && Math.abs(location.points.latitude) <= 90).map(location => [location.points.longitude, location.points.latitude] as [number, number]);
  }, [state.entity, state.geo, results]);
  useEffect(() => {
    if (!map) return;
    const canvas = map.getContainer();
    // Task6 places this ancestor around the map AND all floating controls.
    const root = canvas.closest<HTMLElement>('[data-discovery-geometry]') ?? canvas.closest<HTMLElement>('.discovery-page') ?? canvas;
    const properties = ['--discovery-dock-height', '--discovery-credit-height', '--discovery-top-height', '--discovery-actions-height', '--discovery-preview-height'];
    const previous = properties.map(name => root.style.getPropertyValue(name));
    const observed = new Set<Element>();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => measure());
    const measure = () => {
      const dock = root.querySelector<HTMLElement>('[data-discovery-dock]') ?? root.querySelector<HTMLElement>('.discovery-results.compact');
      const top = root.querySelector<HTMLElement>('[data-discovery-top]');
      const actions = root.querySelector<HTMLElement>('[data-discovery-actions]');
      const previews = [...root.querySelectorAll<HTMLElement>('[data-discovery-preview], .discovery-preview')];
      const credits = [...canvas.querySelectorAll<HTMLElement>('.maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right')];
      const elements = [canvas, dock, top, actions, ...previews, ...credits].filter((item): item is HTMLElement => Boolean(item));
      for (const element of observed) { if (!elements.includes(element as HTMLElement)) { observer?.unobserve(element); observed.delete(element); } }
      for (const element of elements) if (!observed.has(element)) { observer?.observe(element); observed.add(element); }
      const height = (element: HTMLElement | null) => element?.getBoundingClientRect().height ?? 0;
      // The SDK logo has a negative margin: include the actual anchor, not only its parent.
      const creditHeight = Math.max(30, ...credits.flatMap(element => [height(element), ...[...element.querySelectorAll<HTMLElement>('a')].map(height)]));
      const values = [height(dock) || 58, creditHeight, height(top), height(actions) || 48, Math.max(0, ...previews.map(height))];
      properties.forEach((name, index) => { const value = `${Math.ceil(values[index])}px`; if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value); });
      const rect = canvas.getBoundingClientRect();
      const lower = [dock, actions, ...previews, ...credits].filter((item): item is HTMLElement => Boolean(item && height(item) > 0));
      const topPadding = top && height(top) ? Math.max(24, top.getBoundingClientRect().bottom - rect.top + 12) : 24;
      const bottomPadding = Math.max(24, ...lower.map(element => rect.bottom - element.getBoundingClientRect().top + 12));
      // Keep a usable camera target even in a short keyboard viewport.
      const maxTop = rect.height > 0 ? Math.max(0, rect.height - 100) : topPadding;
      const usableTop = Math.min(topPadding, maxTop);
      geometry.current = { top: usableTop, bottom: Math.min(bottomPadding, rect.height > 0 ? Math.max(0, rect.height - usableTop - 80) : bottomPadding) };
    };
    const mutations = new MutationObserver(measure);
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'hidden'] });
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect(); mutations.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure);
      properties.forEach((name, index) => previous[index] ? root.style.setProperty(name, previous[index]) : root.style.removeProperty(name));
    };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    const remember = () => {
      const center = map.getCenter();
      cameraMemory.current = { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), appliedSequence: applied.current };
    };
    const memory = cameraMemory.current;
    if (memory) map.jumpTo({ center: memory.center, zoom: memory.zoom, bearing: memory.bearing, pitch: memory.pitch, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    map.on('moveend', remember);
    return () => { remember(); map.off('moveend', remember); };
  }, [map, cameraMemory]);
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const { intent, place } = request.current;
      if ((intent.place ? placeKey(intent.place) : null) !== (place ? placeKey(place) : null)) return;
      if (!map.isStyleLoaded() || intent.sequence <= applied.current) return;
      const center = intent.place?.center;
      if (intent.place && (!center || !center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90)) return;
      // Mark before stop/easeTo, whose synchronous moveend may otherwise store the old sequence.
      applied.current = intent.sequence;
      map.stop();
      map.easeTo({ center: center ?? [0, 20], zoom: intent.place?.geo.level === 'city' ? 12 : intent.place?.geo.level === 'state' ? 6 : intent.place ? 4 : 2,
        bearing: 0, pitch: 0, padding: { ...geometry.current, left: 24, right: 24 },
        duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 500 });
      const current = map.getCenter();
      cameraMemory.current = { center: [current.lng, current.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), appliedSequence: applied.current };
    };
    apply(); map.on('load', apply); map.on('idle', apply);
    return () => { map.off('load', apply); map.off('idle', apply); };
  }, [map, location.cameraRequest, location.place, cameraMemory]);
  useEffect(() => {
    if (!map) return;
    const ready = () => setLoading(false);
    const pending = () => setLoading(true);
    map.on('load', ready); map.on('idle', ready); map.on('dataloading', pending);
    if (map.loaded()) ready();
    const timeout = window.setTimeout(() => { if (!map.loaded()) callbacks.current.onError(); }, 15000);
    return () => { clearTimeout(timeout); map.off('load', ready); map.off('idle', ready); map.off('dataloading', pending); };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    let cleanup: (() => void) | undefined;
    const draw = () => {
      if (!map.isStyleLoaded()) return;
      cleanup?.();
      if (state.entity === 'activities') cleanup = displayActivities(results.activities, map, item => callbacks.current.setSelected(item.pk), () => {});
      else if (state.entity === 'teams') cleanup = displayTeams(results.teams, map, item => callbacks.current.setSelected(item.name), () => {});
      else cleanup = displayOrganizations(results.organizations, map, item => { setOrganizationPin(previous => ({ point: item.location.points, context: currentPinContext.current, sequence: (previous?.sequence ?? 0) + 1 })); callbacks.current.onOrganization(item); }, () => {});
    };
    // SDK style replacement can emit style.load before isStyleLoaded becomes true.
    // Retry only missing result sources on idle, without recreating them on every render.
    const restoreMissingResults = () => { if (!map.getSource(state.entity)) draw(); };
    draw(); map.on('style.load', draw); map.on('load', draw); map.on('idle', restoreMissingResults);
    return () => { map.off('style.load', draw); map.off('load', draw); map.off('idle', restoreMissingResults); cleanup?.(); };
  }, [map, state.entity, results]);
  const selectedActivity = state.entity === 'activities' ? results.activities.find(item => item.pk === selected) : undefined;
  const selectedTeam = state.entity === 'teams' ? results.teams.find(item => item.name === selected) : undefined;
  const selectedOrganization = organizationPin?.context === pinContext ? organizationPin : undefined;
  const selectionKey = state.entity === 'organizations' && selectedOrganization ? `organizations:${selectedOrganization.sequence}` : selected ? `${state.entity}:${selected}` : '';
  const adjustedSelection = useRef(cameraMemory.current ? selectionKey : '');
  const selectedPoint = state.entity === 'organizations' ? selectedOrganization?.point : selectedActivity?.location.points ?? selectedTeam?.location[0]?.points;
  useEffect(() => {
    if (!selectionKey) { adjustedSelection.current = ''; return; }
    if (!map || !selectedPoint || adjustedSelection.current === selectionKey) return;
    const { longitude, latitude } = selectedPoint;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return;
    const timer = window.requestAnimationFrame(() => {
      const rect = map.getContainer().getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      adjustedSelection.current = selectionKey;
      const point = map.project([longitude, latitude]);
      const x = Math.max(24, Math.min(rect.width - 24, point.x));
      const y = Math.max(geometry.current.top + 24, Math.min(rect.height - geometry.current.bottom - 24, point.y));
      if (x !== point.x || y !== point.y) map.panBy([point.x - x, point.y - y], { duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 250 });
    });
    return () => window.cancelAnimationFrame(timer);
  }, [map, selectionKey, selectedPoint]);
  return <><BaseMap onMapLoad={setMap} onMapError={onError} />{loading && <p className="discovery-map-status" role="status">Loading map tiles…</p>}
    {!loading && !resultsLoading && state.geo && points.length === 0 && <p className="discovery-map-status" style={{ right: 12 }} role="status">No mapped locations are available for {[state.geo.city, state.geo.state, state.geo.country].filter(Boolean).join(', ')}.</p>}
    {location.notice && <div className="discovery-map-recovery" role="status"><p>{location.notice}</p><button onClick={() => location.recenter()}>Center map</button></div>}
    {(selectedActivity || selectedTeam) && <section data-discovery-preview className="discovery-map-selection" aria-label="Selected result">
      {selectedActivity && <ResultCard entity="activities" item={selectedActivity} />}
      {selectedTeam && <ResultCard entity="teams" item={selectedTeam} />}
      <button onClick={() => setSelected(null)}>Close selection</button>
    </section>}
  </>;
}
