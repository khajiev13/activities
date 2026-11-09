import { Building2, CalendarDays, ChevronDown, MapPin, Search, Users } from 'lucide-react';
import { useDiscovery } from '@/discovery/DiscoveryContext';
const categories = [{ entity: 'activities', name: 'Activities', icon: CalendarDays }, { entity: 'teams', name: 'Teams', icon: Users }, { entity: 'organizations', name: 'Organizations', icon: Building2 }] as const;
export function DiscoveryHeader() {
  const { state, setState, location, openSurface, setSelected } = useDiscovery();
  const region = state.geo?.city ?? state.geo?.state ?? state.geo?.country ?? 'Choose a city';
  return <div className="discovery-floating-top" data-discovery-top>
    <div className="discovery-floating-row"><button data-discovery-focus className="discovery-city" onClick={() => openSurface('city')}><MapPin size={19} aria-hidden="true" /><span className="discovery-city-copy"><strong>{region}</strong><small>{location.mode === 'auto' ? 'Following your city' : state.geo ? 'Chosen city' : 'Find your next activity'}</small></span><ChevronDown size={16} aria-hidden="true" /></button>
      <button className={`discovery-search-button${state.query ? ' filtered' : ''}`} title={`Search ${state.entity}`} aria-label={`Search ${state.entity}`} onClick={() => openSurface('search')}><Search size={21} aria-hidden="true" /></button>
    </div>
    <div className="discovery-entities" aria-label="Result type">{categories.map(({ entity, name, icon: Icon }) => <button key={entity} title={name} aria-label={name} aria-pressed={state.entity === entity} onClick={() => { setSelected(null); setState(s => ({ ...s, entity })); }}><Icon size={21} aria-hidden="true" /></button>)}</div>
    {state.query && <button className="discovery-query" onClick={() => openSurface('search')}>Search: {state.query}</button>}
  </div>;
}
