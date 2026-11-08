import { useEffect, useMemo, useRef, useState } from 'react';
import type * as maptilersdk from '@maptiler/sdk';
import BaseMap from './BaseMap';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import { displayActivities } from './MapFunctions/DisplayActivities';
import { displayTeams } from './MapFunctions/DisplayTeams';
import { displayOrganizations } from './MapFunctions/DisplayOrganizations';
import type { DiscoveryResults } from '@/discovery/types';
export default function RenderMap({ onOrganization, onError }: { onOrganization: (item: DiscoveryResults['organizations'][number]) => void; onError: () => void }) {
  const { state, results } = useDiscovery(); const [map, setMap] = useState<maptilersdk.Map>();
  const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<string | null>(null);
  const fitKey = useRef(''); const callbacks = useRef({ onOrganization, onError }); callbacks.current = { onOrganization, onError };
  const points = useMemo(() => {
    const locations = state.entity === 'teams' ? results.teams.map(item => item.location[0]) : state.entity === 'activities' ? results.activities.map(item => item.location) : results.organizations.map(item => item.location);
    return locations.filter(location => location && Number.isFinite(location.points.longitude) && Number.isFinite(location.points.latitude) && Math.abs(location.points.longitude) <= 180 && Math.abs(location.points.latitude) <= 90).map(location => [location.points.longitude, location.points.latitude] as [number, number]);
  }, [state.entity, results]);
  const regionKey = JSON.stringify([state.geo, state.entity, points]);
  useEffect(() => { setSelected(null); }, [regionKey]);
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
      if (state.entity === 'activities') cleanup = displayActivities(results.activities, map, item => setSelected(item.pk), () => {});
      else if (state.entity === 'teams') cleanup = displayTeams(results.teams, map, item => setSelected(item.name), () => {});
      else cleanup = displayOrganizations(results.organizations, map, item => callbacks.current.onOrganization(item), () => {});
      if (fitKey.current !== regionKey && points.length) {
        const lng = points.map(point => point[0]); const lat = points.map(point => point[1]);
        map.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]], { padding: { top: 40, right: 40, bottom: window.innerWidth < 1024 ? 240 : 40, left: 40 }, maxZoom: 13, duration: 0 });
      }
      fitKey.current = regionKey;
    };
    draw(); map.on('style.load', draw); map.on('load', draw);
    return () => { map.off('style.load', draw); map.off('load', draw); cleanup?.(); };
  }, [map, state.entity, results, regionKey, points]);
  return <><BaseMap onMapLoad={setMap} onMapError={onError} />{loading && <p className="discovery-map-status" role="status">Loading map tiles…</p>}
    {selected && <div className="discovery-map-selection"><p>{state.entity === 'activities' ? results.activities.find(item => item.pk === selected)?.title : selected}</p><p>Open this result in the list for details.</p><button onClick={() => setSelected(null)}>Close selection</button></div>}
  </>;
}
