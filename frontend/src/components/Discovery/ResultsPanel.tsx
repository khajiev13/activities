import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import { ResultCard } from './ResultCard';
import type { DiscoveryResults } from '@/discovery/types';
export function ResultsPanel({ compact, onExpand, onOrganization }: { compact: boolean; onExpand?: () => void; onOrganization: (item: DiscoveryResults['organizations'][number]) => void }) {
  const { state, results, loading, error, reload, scrollPositions } = useDiscovery();
  const location = useLocation(); const key = location.pathname + location.search;
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (!loading && scroll.current) scroll.current.scrollTop = scrollPositions.get(key) ?? 0; }, [key, scrollPositions, loading]);
  const count = results[state.entity].length;
  return <section className={`discovery-results${compact ? ' compact' : ''}`} aria-label="Discovery results">
    <div className="discovery-results-heading"><div><h2>{state.entity[0].toUpperCase() + state.entity.slice(1)}</h2><p>{state.geo ? `${count} ${count === 1 ? 'result' : 'results'} · ${state.geo.city ?? state.geo.state ?? state.geo.country}` : 'Choose a region to see results'}</p></div>{onExpand && <button onClick={onExpand}>{compact ? 'Expand results' : 'Compact results'}</button>}</div>
    <div className="discovery-results-scroll" ref={scroll} onScroll={event => !loading && scrollPositions.set(key, event.currentTarget.scrollTop)}>
      {loading ? <p role="status">Loading {state.entity}…</p> : error ? <div role="alert"><p>{error}</p><button onClick={reload}>Retry results</button></div> : !state.geo ? <p>Choose a city, state or country to get started.</p> : count === 0 ? <p>No {state.entity} found. Try another search or region.</p> : state.entity === 'activities' ? results.activities.map(item => <ResultCard key={item.pk} entity="activities" item={item} />) : state.entity === 'teams' ? results.teams.map(item => <ResultCard key={item.name} entity="teams" item={item} />) : results.organizations.map(item => <ResultCard key={item.pk} entity="organizations" item={item} onSelect={() => onOrganization(item)} />)}
    </div>
  </section>;
}
