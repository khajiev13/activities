import { useEffect, useState } from 'react';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import type { DiscoveryEntity, DiscoveryResults } from '@/discovery/types';
import RenderMap from '@/components/Map/RenderMap';
import { CityPicker } from './CityPicker';
import { DiscoveryHeader } from './DiscoveryHeader';
import { ResultsPanel } from './ResultsPanel';
export function DiscoveryPage({ entity }: { entity?: DiscoveryEntity }) {
  const { state, setState, location, surface, openSurface } = useDiscovery();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (location.welcome && surface === 'none') openSurface('city'); }, [location.welcome, surface, openSurface]);
  const [mapError, setMapError] = useState(false); const [mapVersion, setMapVersion] = useState(0);
  const [organization, setOrganization] = useState<DiscoveryResults['organizations'][number] | null>(null);
  const contextKey = JSON.stringify([state.geo, state.entity, state.query]);
  useEffect(() => { setOrganization(null); }, [contextKey]);
  const list = Boolean(entity) || state.view === 'list' || mapError;
  return <div className={`discovery-page${entity ? ' directory' : ''}${list ? ' list-view' : ''}${expanded ? ' expanded-results' : ''}`}>
    <DiscoveryHeader dedicated={Boolean(entity)} onChooseCity={() => openSurface('city')} />
    <div className="discovery-workspace">
      {!entity && <div className="discovery-map" aria-hidden={list || expanded ? true : undefined}><RenderMap key={mapVersion} onOrganization={setOrganization} onError={() => setMapError(true)} /></div>}
      {mapError && !entity && <div className="discovery-map-error" role="alert"><p>Map unavailable. You can still browse all results below.</p><button onClick={() => { setMapError(false); setMapVersion(v => v + 1); }}>Retry map</button></div>}
      <ResultsPanel compact={!list && !expanded} onExpand={mapError || entity ? undefined : () => { if (list && !entity && !mapError) { setState(s => ({ ...s, view: 'map' })); setExpanded(false); } else setExpanded(value => !value); }} onOrganization={setOrganization} />
    </div>
    {organization && <section className="discovery-preview" aria-label="Organization preview"><button onClick={() => setOrganization(null)}>Close preview</button><h2>{organization.name}</h2><p>{organization.location.name} · {organization.city.name}</p><p>{organization.teams_count} teams · {organization.number_of_people_joined} members</p><p>{organization.hosting_activities_count} activities · {organization.number_of_teams_sponsored} teams sponsored</p></section>}
    <CityPicker />
  </div>;
}
