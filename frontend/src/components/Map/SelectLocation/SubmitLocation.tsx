import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManualLocationGeo } from '../MapFunctions/AddLocation';

type Props = {
  name: string; setName: (value: string) => void;
  longitude: string; latitude: string; setLongitude: (value: string) => void; setLatitude: (value: string) => void;
  manual: boolean; setManual: (value: boolean) => void;
  geo: ManualLocationGeo; setGeo: (value: ManualLocationGeo) => void;
  loading: boolean; onSubmit: () => void;
};
export function SubmitLocation({ name, setName, longitude, latitude, setLongitude, setLatitude, manual, setManual, geo, setGeo, loading, onSubmit }: Props) {
  const id = useId();
  return <fieldset className="space-y-4 min-w-0" disabled={loading}>
    <div><Label htmlFor={`${id}-name`}>Venue name</Label><Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} autoComplete="off" className="text-base min-h-11" /></div>
    <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() => setManual(!manual)} aria-expanded={manual}>{manual ? 'Hide manual location fields' : 'Enter location manually'}</Button>
    {manual && <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Enter the venue coordinates and its country, state or region, and city to save without the lookup provider.</p>
      <div className="grid grid-cols-2 gap-3">{([['Longitude', longitude, setLongitude], ['Latitude', latitude, setLatitude]] as const).map(([label, value, setter]) => <div key={label}><Label htmlFor={`${id}-${label}`}>{label}</Label><Input id={`${id}-${label}`} type="number" step="any" min={label === 'Longitude' ? -180 : -90} max={label === 'Longitude' ? 180 : 90} value={value} onChange={event => setter(event.target.value)} className="text-base min-h-11" /></div>)}</div>
      {([['country', 'Country'], ['state', 'State or region'], ['city', 'City']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`${id}-${key}`}>{label}</Label><Input id={`${id}-${key}`} value={geo[key]} onChange={event => setGeo({ ...geo, [key]: event.target.value })} className="text-base min-h-11" /></div>)}
    </div>}
    <p className="text-sm text-muted-foreground">When geography is looked up, GeoNames receives the selected venue coordinates.</p>
    <Button type="button" onClick={onSubmit} disabled={loading} className="min-h-11 w-full">{loading ? 'Saving location…' : 'Use this location'}</Button>
  </fieldset>;
}
