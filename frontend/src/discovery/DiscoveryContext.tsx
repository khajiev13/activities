import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type MutableRefObject, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchCountries, fetchResults } from './api';
import { useDiscoveryLocation, type DiscoverySurface } from './useDiscoveryLocation';
import { placeKey } from './place';
import { flattenCities, parseDiscovery, serializeDiscovery } from './query';
import type { CountryOption, DiscoveryEntity, DiscoveryResults, DiscoveryState } from './types';
const empty: DiscoveryResults = { activities: [], teams: [], organizations: [] };
function routeEntity(path: string): DiscoveryEntity | undefined {
  return path === '/activities' ? 'activities' : path === '/teams' ? 'teams' : path === '/organizations' ? 'organizations' : undefined;
}
function isDiscovery(path: string) { return path === '/' || path === '/map' || Boolean(routeEntity(path)); }
function readState(path: string, search: string): DiscoveryState {
  const parsed = parseDiscovery(new URLSearchParams(search)); const entity = routeEntity(path);
  return entity ? { ...parsed, entity, view: 'list' } : parsed;
}
type CameraMemory = { center: [number, number]; zoom: number; bearing: number; pitch: number; appliedSequence: number };
type Value = {
  location: ReturnType<typeof useDiscoveryLocation>;
  surface: DiscoverySurface; openSurface: (surface: DiscoverySurface, returnTo?: 'none' | 'profile') => void; closeSurface: () => void;
  cameraMemory: MutableRefObject<CameraMemory | null>;
  state: DiscoveryState; setState: (next: SetStateAction<DiscoveryState>) => void;
  countries: CountryOption[]; countriesLoading: boolean; countriesError: string | null; retryCountries: () => void;
  results: DiscoveryResults; loading: boolean; error: string | null; reload: () => void;
  searchForDestination: (entity?: DiscoveryEntity) => string;
  selected: string | null; setSelected: (id: string | null) => void;
  scrollPositions: Map<string, number>;
};
const Context = createContext<Value | null>(null);
export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const location = useLocation(); const navigate = useNavigate();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const state = readState(path, location.search);
  const current = useRef(state); current.current = state;
  const explore = useRef<DiscoveryState | null>(null);
  if (path === '/' || path === '/map') explore.current = state;
  const scrollPositions = useRef(new Map<string, number>());
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [countriesVersion, setCountriesVersion] = useState(0);
  const [results, setResults] = useState(empty); const [loading, setLoading] = useState(Boolean(state.geo));
  const [error, setError] = useState<string | null>(null); const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setCountriesLoading(true); setCountriesError(null);
    fetchCountries(controller.signal).then(value => { if (active) setCountries(value); }).catch(() => { if (active) setCountriesError('Could not load available cities. Try again.'); }).finally(() => { if (active) setCountriesLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [countriesVersion]);
  const requestKey = JSON.stringify([state.geo, state.entity, state.query]);
  const enabled = isDiscovery(path);
  const [selection, setSelection] = useState<{ context: string; id: string } | null>(null);
  const selected = selection?.context === requestKey ? selection.id : null;
  const setSelected = (id: string | null) => setSelection(id === null ? null : { context: requestKey, id });
  // Detail/login routes can have unrelated queries. Only browsing a new context clears selection.
  useEffect(() => { if (enabled) setSelection(previous => previous?.context === requestKey ? previous : null); }, [enabled, requestKey]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    if (!enabled) return;
    setResults(empty); setError(null);
    if (!current.current.geo) { setLoading(false); return; }
    setLoading(true);
    fetchResults(current.current, controller.signal).then(value => { if (active) setResults(value); }).catch(reason => {
      if (active) setError(reason instanceof Error && reason.message.includes('choose another region') ? reason.message : 'Could not load results. Please try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [requestKey, version, enabled]);
  const updateState = (value: DiscoveryState) => {
    navigate({ pathname: location.pathname, search: serializeDiscovery(value) }, { replace: true, state: location.state });
  };
  const [surface, setSurface] = useState<DiscoverySurface>('none');
  const returnSurface = useRef<'none' | 'profile'>('none');
  const cameraMemory = useRef<CameraMemory | null>(null);
  // The organization form hands its new place to the destination page first.
  const locationEnabled = enabled && !location.state?.createdOrganization;
  const discoveryLocation = useDiscoveryLocation({ state, cities: flattenCities(countries), enabled: locationEnabled, path, surface, updateState });
  const openSurface = (next: DiscoverySurface, returnTo: 'none' | 'profile' = 'none') => {
    // Create owns its close/discard flow; other controls cannot dismiss a draft.
    if (surface === 'create' && next !== 'create') return;
    returnSurface.current = returnTo; setSurface(next);
  };
  const closeSurface = () => { setSurface(surface === 'city' ? returnSurface.current : 'none'); returnSurface.current = 'none'; };
  const setState = (next: SetStateAction<DiscoveryState>) => {
    const value = typeof next === 'function' ? next(current.current) : next;
    const oldKey = current.current.geo ? placeKey({ geo: current.current.geo }) : null;
    const newKey = value.geo ? placeKey({ geo: value.geo }) : null;
    if (value.geo && oldKey !== newKey) {
      // Compatibility for the legacy picker until it uses location.selectPlace.
      discoveryLocation.selectPlace({ geo: value.geo }, value);
    } else updateState(value);
  };
  const searchForDestination = (entity?: DiscoveryEntity) => serializeDiscovery(entity
    ? { ...state, entity, view: 'list' }
    : explore.current ?? { ...state, view: 'map' });
  return <Context.Provider value={{ state, setState, location: discoveryLocation, surface, openSurface, closeSurface, cameraMemory, countries, countriesLoading, countriesError, retryCountries: () => setCountriesVersion(v => v + 1), results, loading, error, reload: () => setVersion(v => v + 1), searchForDestination, selected, setSelected, scrollPositions: scrollPositions.current }}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components -- Public discovery context hooks.
export function useOptionalDiscovery() { return useContext(Context); }
// eslint-disable-next-line react-refresh/only-export-components -- Public discovery context hooks.
export function useDiscovery() { const context = useContext(Context); if (!context) throw new Error('DiscoveryProvider is required'); return context; }
