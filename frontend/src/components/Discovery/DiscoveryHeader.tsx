import { ChevronDown } from 'lucide-react';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import type { DiscoveryEntity } from '@/discovery/types';
import { Create } from '@/components/Drawer';
import { RequireAuth } from '@/auth/RequireAuth';
export function DiscoveryHeader({ dedicated, onChooseCity }: { dedicated: boolean; onChooseCity: () => void }) {
  const { state, setState } = useDiscovery();
  const region = state.geo?.city ?? state.geo?.state ?? state.geo?.country ?? 'Choose a city';
  return <div className="discovery-header">
    <div className="discovery-header-top"><button className="discovery-city" onClick={onChooseCity}><strong>{region}<ChevronDown size={18} aria-hidden="true" /></strong><span>{state.geo ? [state.geo.level === 'city' ? state.geo.state : null, state.geo.level !== 'country' ? state.geo.country : null].filter(Boolean).join(', ') : 'Find your next activity'}</span></button>
      {!dedicated && <RequireAuth action="Create"><Create entity={state.entity} /></RequireAuth>}
    </div>
    {!dedicated && <div className="discovery-entities" aria-label="Result type">{(['activities', 'teams', 'organizations'] as DiscoveryEntity[]).map(entity => <button key={entity} aria-pressed={state.entity === entity} onClick={() => setState(s => ({ ...s, entity }))}>{entity[0].toUpperCase() + entity.slice(1)}</button>)}</div>}
    <div className="discovery-search-row"><label className="discovery-search"><span className="sr-only">Search {state.entity}</span><input type="search" placeholder={`Search ${state.entity}`} value={state.query} onChange={event => setState(s => ({ ...s, query: event.target.value }))} /></label>
      {!dedicated && <div className="discovery-view" aria-label="Result view">{(['map', 'list'] as const).map(view => <button key={view} aria-pressed={state.view === view} onClick={() => setState(s => ({ ...s, view }))}>{view === 'map' ? 'Map' : 'List'}</button>)}</div>}
    </div>
  </div>;
}
