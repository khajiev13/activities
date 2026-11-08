import { useEffect, useMemo, useRef, useState } from 'react';
import type * as maptilersdk from '@maptiler/sdk';
import BaseMap from './BaseMap';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import { displayActivities } from './MapFunctions/DisplayActivities';
import { displayTeams } from './MapFunctions/DisplayTeams';
import { displayOrganizations } from './MapFunctions/DisplayOrganizations';
import { ResultCard } from '@/components/Discovery/ResultCard';
import type { DiscoveryResults } from '@/discovery/types';
export default function RenderMap({ onOrganization, onError }: { onOrganization: (item: DiscoveryResults['organizations'][number]) => void; onError: () => void }) {
  const { state, results, selected, setSelected, loading: resultsLoading } = useDiscovery(); const [map, setMap] = useState<maptilersdk.Map>();
  const [loading, setLoading] = useState(true);
  const fitKey = useRef(''); const callbacks = useRef({ onOrganization, onError, setSelected }); callbacks.current = { onOrganization, onError, setSelected };
  const points = useMemo(() => {
    const geo = state.geo;
    // A region change can render once before its request clears the previous results.
    // Only current-region records may determine the new camera.
    const belongs = (country: string, region: string, city: string) => geo && country === geo.country
      && (geo.level === 'country' || region === geo.state) && (geo.level !== 'city' || city === geo.city);
    const locations = state.entity === 'teams'
      ? results.teams.filter(item => belongs(item.country_name, item.state_name, item.city_name)).map(item => item.location[0])
      : state.entity === 'activities'
        ? results.activities.filter(item => belongs(item.country.name, item.state.name, item.city.name)).map(item => item.location)
        : results.organizations.filter(item => belongs(item.country.name, item.state.name, item.city.name)).map(item => item.location);
    return locations.filter(location => location && Number.isFinite(location.points.longitude) && Number.isFinite(location.points.latitude) && Math.abs(location.points.longitude) <= 180 && Math.abs(location.points.latitude) <= 90).map(location => [location.points.longitude, location.points.latitude] as [number, number]);
  }, [state.entity, state.geo, results]);
  const geographyKey = JSON.stringify(state.geo);
  const cameraGeography = useRef(geographyKey);
  const regionKey = JSON.stringify([state.geo, state.entity, points]);
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
      else cleanup = displayOrganizations(results.organizations, map, item => callbacks.current.onOrganization(item), () => {});
      if (cameraGeography.current !== geographyKey && !points.length) map.jumpTo({ center: [0, 20], zoom: 2, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
      cameraGeography.current = geographyKey;
      if (fitKey.current !== regionKey && points.length) {
        const lng = points.map(point => point[0]); const lat = points.map(point => point[1]);
        map.fitBounds([[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]], { padding: { top: 40, right: 40, bottom: window.innerWidth < 1024 ? 240 : 40, left: 40 }, maxZoom: 13, duration: 0 });
      }
      fitKey.current = regionKey;
    };
    // SDK style replacement can emit style.load before isStyleLoaded becomes true.
    // Retry only missing result sources on idle, without recreating them on every render.
    const restoreMissingResults = () => { if (!map.getSource(state.entity)) draw(); };
    draw(); map.on('style.load', draw); map.on('load', draw); map.on('idle', restoreMissingResults);
    return () => { map.off('style.load', draw); map.off('load', draw); map.off('idle', restoreMissingResults); cleanup?.(); };
  }, [map, state.entity, results, regionKey, geographyKey, points]);
  const selectedActivity = state.entity === 'activities' ? results.activities.find(item => item.pk === selected) : undefined;
  const selectedTeam = state.entity === 'teams' ? results.teams.find(item => item.name === selected) : undefined;
  return <><BaseMap onMapLoad={setMap} onMapError={onError} />{loading && <p className="discovery-map-status" role="status">Loading map tiles…</p>}
    {!loading && !resultsLoading && state.geo && points.length === 0 && <p className="discovery-map-status" style={{ right: 12 }} role="status">No mapped locations are available for {[state.geo.city, state.geo.state, state.geo.country].filter(Boolean).join(', ')}.</p>}
    {(selectedActivity || selectedTeam) && <section className="discovery-map-selection" aria-label="Selected result">
      {selectedActivity && <ResultCard entity="activities" item={selectedActivity} />}
      {selectedTeam && <ResultCard entity="teams" item={selectedTeam} />}
      <button onClick={() => setSelected(null)}>Close selection</button>
    </section>}
  </>;
}
