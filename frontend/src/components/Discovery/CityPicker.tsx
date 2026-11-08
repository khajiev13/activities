import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Content as DialogContent } from '@radix-ui/react-dialog';
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { flattenCities } from '@/discovery/query';
import { useCityDetection } from '@/discovery/useCityDetection';
import type { CityDetectionStatus } from '@/discovery/useCityDetection';
import type { CountryOption, GeoSelection } from '@/discovery/types';

export type CityPickerProps = { open: boolean; onOpenChange: (open: boolean) => void; countries: CountryOption[]; loading: boolean; error: string | null; value: GeoSelection | null; onSelect: (geo: GeoSelection) => void; onRetry: () => void };
const messages: Record<CityDetectionStatus, string> = {
  idle: '', locating: 'Getting your location…', resolving: 'Finding a matching city…',
  denied: 'Location permission denied. You can choose a city manually.',
  unavailable: 'Device location is unavailable. Choose a city manually.',
  unmatched: 'We found your area; choose a city from the available places.',
  error: 'Could not detect your city. Try again or choose a city manually.',
};

export function CityPicker({ open, onOpenChange, countries, loading, error, value, onSelect, onRetry }: CityPickerProps) {
  const [query, setQuery] = useState('');
  const [detectedCity, setDetectedCity] = useState<GeoSelection | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const cities = useMemo(() => flattenCities(countries), [countries]);
  const selected = useCallback((city: { country: string; state: string; city: string }) => {
    setDetectedCity({ level: 'city', ...city }); onSelect({ level: 'city', ...city }); onOpenChange(false);
  }, [onSelect, onOpenChange]);
  const { status, detect, cancel } = useCityDetection(cities, selected);
  useEffect(() => { if (!open) cancel(); }, [open, cancel]);
  const choose = (geo: GeoSelection) => { setDetectedCity(null); cancel(); onSelect(geo); onOpenChange(false); };
  const changeOpen = (next: boolean) => { if (!next) cancel(); onOpenChange(next); };
  const normalizedQuery = query.normalize('NFKC').trim().toLowerCase();
  const matches = cities.filter(city => `${city.city}, ${city.state}, ${city.country}`.normalize('NFKC').toLowerCase().includes(normalizedQuery));
  const pending = status === 'locating' || status === 'resolving';
  const acknowledgment = detectedCity && value?.level === 'city' && value.country === detectedCity.country && value.state === detectedCity.state && value.city === detectedCity.city;
  return <>{!open && acknowledgment && <div className="discovery-location-success"><p role="status">City selected from your location: {[detectedCity.city, detectedCity.state, detectedCity.country].join(', ')}.</p><button onClick={() => onOpenChange(true)}>Change</button></div>}<Dialog open={open} onOpenChange={changeOpen}>
    <DialogPortal><DialogOverlay /><DialogContent className="app-account-dialog fixed left-1/2 top-1/2 z-50 grid max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border p-6 shadow-lg" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
      <div className="flex items-center justify-between gap-4">
        <DialogTitle>Choose a city</DialogTitle>
        <DialogClose asChild><button className="app-account-action" onClick={cancel}>Close</button></DialogClose>
      </div>
      <DialogDescription>Search available cities or browse a country or state.</DialogDescription>
      {value && <p className="text-sm">Current: {[value.city, value.state, value.country].filter(Boolean).join(', ')}</p>}
      <div className="grid gap-2">
        <button type="button" className="app-account-action" onClick={detect} disabled={pending}>Use my location</button>
        <p className="text-xs text-muted-foreground">GeoNames receives your coordinates to find a city. Eventopia does not save your exact location.</p>
        {messages[status] && <p role="status" className="text-sm">{messages[status]}</p>}
      </div>
      <label className="grid gap-2 text-sm">Search cities<input className="rounded-xl border bg-background px-3 text-base" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {loading && <p role="status">Loading cities…</p>}
      {error && <div role="alert" className="grid gap-2 text-sm"><p>{error}</p><button className="app-account-action" onClick={() => { cancel(); onRetry(); }}>Retry cities</button></div>}
      <div className="grid gap-2" aria-label="Available cities">
        {matches.map(city => <button className="app-account-action justify-start text-left" key={JSON.stringify(city)} onClick={() => choose({ level: 'city', ...city })}>{city.city}, {city.state}, {city.country}</button>)}
        {!loading && !error && !matches.length && <p className="text-sm">No matching cities. Browse a country or state below.</p>}
      </div>
      <details><summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">Browse countries and states</summary>
        <div className="grid gap-2">{countries.map(country => <div className="grid gap-2" key={country.name}>
          <button className="app-account-action justify-start text-left" onClick={() => choose({ level: 'country', country: country.name })}>Browse {country.name}</button>
          {country.states.map(state => <button className="app-account-action justify-start text-left" key={state.name} onClick={() => choose({ level: 'state', country: country.name, state: state.name })}>Browse {state.name}, {country.name}</button>)}
        </div>)}</div>
      </details>
    </DialogContent></DialogPortal>
  </Dialog></>;
}
