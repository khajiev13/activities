import { useEffect, useMemo, useRef, useState } from 'react';
import { DiscoverySurface } from './DiscoverySurface';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import { flattenCities } from '@/discovery/query';
import { normalizePlaceName, placeKey } from '@/discovery/place';
import type { CityPlace, PlaceSelection } from '@/discovery/place';
const label = (place: PlaceSelection) => [place.geo.city, place.geo.state, place.geo.country].filter(Boolean).join(', ');
const fromCity = ({ country, state, city, geonameId, center }: CityPlace): PlaceSelection => ({ geo: { level: 'city', country, state, city }, geonameId, center });

export function CityPicker() {
  const { state, countries, countriesLoading, countriesError, retryCountries, location, surface, openSurface, closeSurface } = useDiscovery();
  const { searchPlaces, cancelPending } = location;
  const open = surface === 'city';
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<CityPlace[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [retry, setRetry] = useState(0);
  const [searchPaused, setSearchPaused] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const queryKey = normalizePlaceName(query);
  const cities = useMemo(() => flattenCities(countries), [countries]);
  useEffect(() => {
    let active = true;
    setProvider([]); setSearchStatus('idle');
    if (!open) { setQuery(''); setSearchPaused(false); return; }
    if (searchPaused || queryKey.length < 2) return;
    setSearchStatus('loading');
    const timer = window.setTimeout(() => {
      void searchPlaces(queryKey).then(places => { if (active) { setProvider(places.slice(0, 20)); setSearchStatus('idle'); } }).catch(() => { if (active) setSearchStatus('error'); });
    }, 300);
    // The location owner cancels requests. This guard only protects rendered rows.
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, queryKey, retry, searchPlaces, searchPaused]);
  const recent = location.recent.slice(0, 5).filter(place => normalizePlaceName(label(place)).includes(queryKey));
  const seen = new Set(recent.map(placeKey));
  const choices = [
    ...cities.filter(city => normalizePlaceName([city.city, city.state, city.country].join(', ')).includes(queryKey)).map(city => ({ geo: { level: 'city' as const, ...city } })),
    ...provider.map(fromCity),
  ].filter(place => { const key = placeKey(place); if (seen.has(key)) return false; seen.add(key); return true; });
  // Retain provider metadata when a catalogue row supplies canonical backend spelling.
  const choose = (place: PlaceSelection) => {
    const match = provider.find(city => placeKey(fromCity(city)) === placeKey(place));
    setAcknowledged(false);
    void location.selectPlace(match ? { ...place, geonameId: match.geonameId, center: match.center } : place);
    closeSurface();
  };
  const close = () => { location.dismissWelcome(); closeSurface(); };
  const detectCurrent = async () => {
    setSearchPaused(true);
    if (await location.useCurrentLocation()) { setAcknowledged(true); closeSurface(); }
  };
  const pending = location.status === 'locating' || location.status === 'resolving';
  const messages = {
    idle: '', locating: 'Getting your location…', resolving: 'Finding a matching city…',
    denied: 'Location permission denied. Enable location access and try again, or choose a city.',
    unavailable: 'Device location is unavailable. Try again or choose a city.',
    unmatched: 'Could not identify your city. Try again or choose a city.',
    error: 'Could not find your city. Check your connection and try again, or choose a city.',
  };
  const current = state.geo ? { geo: state.geo } : location.place;
  return <>{!open && acknowledged && location.mode === 'auto' && location.place && <div className="discovery-location-success"><p role="status">City selected from your location: {label(location.place)}.</p><button onClick={() => openSurface('city')}>Change</button></div>}
    <DiscoverySurface open={open} title="Choose a city" description="Search cities worldwide or browse a country or state." onClose={close} initialFocus={input}>
        {current && <p className="text-sm">Current: {label(current)}</p>}
        <label className="grid gap-2 text-sm">Search cities<input ref={input} className="rounded-xl border bg-background px-3 text-base" value={query} onChange={event => { if (normalizePlaceName(event.target.value) !== queryKey) cancelPending(); setSearchPaused(false); setQuery(event.target.value); }} /></label>
        <div className="grid gap-2">
          <button type="button" className="app-account-action" onClick={() => { void detectCurrent(); }} disabled={pending}>Use current location</button>
          <p className="text-xs text-muted-foreground">GeoNames receives your coordinates to find a city. Eventopia does not save your exact location. With location access, your city is checked when you open or resume the app.</p>
          {messages[location.status] && <p role="status" className="text-sm">{messages[location.status]}</p>}
          {location.notice && location.status === 'idle' && <p role="status" className="text-sm">{location.notice}</p>}
          {location.persistenceWarning && <p className="text-sm">Your choice may not be remembered on this device.</p>}
        </div>
        {recent.length > 0 && <section aria-label="Recent places" className="grid gap-2"><h3 className="text-sm font-semibold">Recent places</h3>{recent.map(place => <button className="app-account-action justify-start text-left" key={placeKey(place)} onClick={() => choose(place)}>{label(place)}</button>)}</section>}
        {countriesLoading && <p role="status">Loading cities…</p>}
        {countriesError && <div role="alert" className="grid gap-2 text-sm"><p>{countriesError}</p><button className="app-account-action" onClick={() => { cancelPending(); retryCountries(); }}>Retry cities</button></div>}
        {searchStatus === 'loading' && <p role="status">Searching cities…</p>}
        {searchStatus === 'error' && <div role="alert" className="grid gap-2 text-sm"><p>City search is unavailable. Recent places and available cities still work.</p><button className="app-account-action" onClick={() => { setSearchPaused(false); setRetry(value => value + 1); }}>Retry search</button></div>}
        <div className="grid gap-2" aria-label="Available cities">
          {choices.map(place => <button className="app-account-action justify-start text-left" key={placeKey(place)} onClick={() => choose(place)}>{label(place)}</button>)}
          {!countriesLoading && !countriesError && searchStatus === 'idle' && !recent.length && !choices.length && <p className="text-sm">No matching cities. Browse a country or state below.</p>}
        </div>
        <details><summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">Browse regions</summary><div className="grid gap-2">{countries.map(country => <div className="grid gap-2" key={country.name}>
          <button className="app-account-action justify-start text-left" onClick={() => choose({ geo: { level: 'country', country: country.name } })}>Browse {country.name}</button>
          {country.states.map(state => <button className="app-account-action justify-start text-left" key={state.name} onClick={() => choose({ geo: { level: 'state', country: country.name, state: state.name } })}>Browse {state.name}, {country.name}</button>)}
        </div>)}</div></details>
    </DiscoverySurface></>;
}
