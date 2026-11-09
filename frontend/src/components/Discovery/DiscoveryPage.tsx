import { useEffect, useRef, useState } from 'react';
import { List, LocateFixed, Map, UserRound } from 'lucide-react';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import type { DiscoveryEntity, DiscoveryResults } from '@/discovery/types';
import RenderMap from '@/components/Map/RenderMap';
import { Create } from '@/components/Drawer';
import { RequireAuth } from '@/auth/RequireAuth';
import { CityPicker } from './CityPicker';
import { DiscoveryHeader } from './DiscoveryHeader';
import { DiscoveryProfile } from './DiscoveryProfile';
import { DiscoverySurface } from './DiscoverySurface';
import { ResultsPanel } from './ResultsPanel';
export function DiscoveryPage({ entity }: { entity?: DiscoveryEntity }) {
  const { state, setState, location, surface, openSurface, closeSurface, selected, setSelected, results, loading, error } = useDiscovery();
  const input = useRef<HTMLInputElement>(null);
  const [mapError, setMapError] = useState(false); const [mapVersion, setMapVersion] = useState(0);
  const [organization, setOrganization] = useState<DiscoveryResults['organizations'][number] | null>(null);
  const contextKey = JSON.stringify([state.geo, state.entity, state.query]);
  useEffect(() => { setOrganization(null); }, [contextKey]);
  // Legacy directory and view=list links still open the category list over the map.
  useEffect(() => { if (entity || state.view === 'list') openSurface('results'); }, [entity, state.view]); // eslint-disable-line react-hooks/exhaustive-deps -- Initial URL intent, not surface-close changes.
  useEffect(() => { if (location.welcome && surface === 'none') openSurface('city'); }, [location.welcome, surface, openSurface]);
  const close = () => { if (surface === 'results' && state.view === 'list' && !entity) setState(s => ({ ...s, view: 'map' })); closeSurface(); };
  const preview = Boolean(organization || (state.entity === 'activities' ? results.activities.some(item => item.pk === selected) : state.entity === 'teams' && results.teams.some(item => item.name === selected)));
  const covered = surface !== 'none';
  const chooseOrganization = (item: DiscoveryResults['organizations'][number]) => { setSelected(null); setOrganization(item); if (surface === 'results') close(); };
  const count = results[state.entity].length;
  return <div className="discovery-page full-map" data-discovery-geometry data-has-preview={preview || undefined}>
    <div className="discovery-background" data-discovery-background aria-hidden={covered || undefined} {...{ inert: covered ? '' : undefined }}>
      <div className="discovery-map"><RenderMap key={mapVersion} onOrganization={chooseOrganization} onError={() => setMapError(true)} /></div>
      <DiscoveryHeader />
      {mapError && <div className="discovery-map-error" role="alert"><p>Map unavailable. You can still browse all results.</p><button onClick={() => { setMapError(false); setMapVersion(v => v + 1); }}>Retry map</button><button onClick={() => openSurface('results')}>Show results</button></div>}
      <button className="discovery-center" aria-label="Center map" title="Center map" onClick={() => { setSelected(null); setOrganization(null); location.recenter(); }}><LocateFixed size={22} aria-hidden="true" /></button>
      {organization && <section data-discovery-preview className="discovery-preview" aria-label="Organization preview"><button onClick={() => setOrganization(null)}>Close preview</button><h2>{organization.name}</h2><p>{organization.location.name} · {organization.city.name}</p><p>{organization.teams_count} teams · {organization.number_of_people_joined} members</p><p>{organization.hosting_activities_count} activities · {organization.number_of_teams_sponsored} teams sponsored</p></section>}
      <div className="discovery-actions" data-discovery-actions hidden={preview}>
        <button className="discovery-results-button" onClick={() => openSurface('results')}><List size={19} aria-hidden="true" /><span>Results: {loading ? 'Loading' : error ? 'Retry' : count} {state.entity}</span></button>
        <RequireAuth action="Create"><Create entity={state.entity} open={surface === 'create'} onOpenChange={next => next ? openSurface('create') : closeSurface()} /></RequireAuth>
      </div>
      <nav className="discovery-dock" data-discovery-dock aria-label="Main navigation"><button aria-current="page" onClick={() => { setSelected(null); setOrganization(null); }}><Map size={20} aria-hidden="true" /><span>Map</span></button><button onClick={() => openSurface('profile')}><UserRound size={20} aria-hidden="true" /><span>Profile</span></button></nav>
    </div>
    <CityPicker />
    <DiscoverySurface open={surface === 'search'} title={`Search ${state.entity}`} description={`Refine ${state.entity} in your chosen city or region.`} onClose={close} initialFocus={input}>
      <form className="discovery-content-search" onSubmit={event => { event.preventDefault(); close(); }}><label>Search {state.entity}<input ref={input} type="search" value={state.query} onChange={event => setState(s => ({ ...s, query: event.target.value }))} /></label><button className="app-account-action" type="submit">Show on map</button><button className="app-account-action" type="button" disabled={!state.query} onClick={() => { setState(s => ({ ...s, query: '' })); input.current?.focus(); }}>Clear search</button></form>
    </DiscoverySurface>
    <DiscoverySurface open={surface === 'results'} title="Results" description={`${state.entity[0].toUpperCase() + state.entity.slice(1)} in your chosen city or region.`} onClose={close} kind="results"><ResultsPanel compact={false} onOrganization={chooseOrganization} /></DiscoverySurface>
    <DiscoverySurface open={surface === 'profile'} title="Profile" description="Manage your account, appearance and device location." onClose={close}><DiscoveryProfile /></DiscoverySurface>
  </div>;
}
