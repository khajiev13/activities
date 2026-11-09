import { useEffect, useRef, useState } from 'react';
import { useOptionalDiscovery } from '@/discovery/DiscoveryContext';
import BaseMap from './Map/BaseMap';
import * as maptilersdk from '@maptiler/sdk';
import { SubmitLocation } from './Map/SelectLocation/SubmitLocation';
import { AddLocation, type LocationDetails, type ManualLocationGeo } from './Map/MapFunctions/AddLocation';

type Props = { setLocation: (location: LocationDetails) => void };
export default function SelectLocation({ setLocation }: Props) {
  const discovery = useOptionalDiscovery();
  const marker = useRef<maptilersdk.Marker | null>(null);
  const detach = useRef<() => void>(() => {});
  const busy = useRef(false);
  const active = useRef(true);
  const [name, setName] = useState('');
  const [longitude, setLongitude] = useState(''); const [latitude, setLatitude] = useState('');
  const [manual, setManual] = useState(false); const [mapError, setMapError] = useState(false);
  const [geo, setGeo] = useState<ManualLocationGeo>({ country: '', state: '', city: '' });
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; detach.current(); marker.current?.remove(); marker.current = null; }; }, []);
  const handleMapLoad = (map: maptilersdk.Map) => {
    detach.current();
    const click = (event: maptilersdk.MapMouseEvent) => {
      if (busy.current) return;
      marker.current?.remove();
      marker.current = new maptilersdk.Marker().setLngLat([event.lngLat.lng, event.lngLat.lat]).addTo(map);
      setLongitude(String(event.lngLat.lng)); setLatitude(String(event.lngLat.lat)); setError(null);
    };
    map.on('click', click); detach.current = () => map.off('click', click);
  };
  async function submit() {
    if (busy.current) return;
    if (!name.trim() || !longitude.trim() || !latitude.trim()) { setError('Choose a point or enter coordinates, and give the venue a name.'); return; }
    const hasManualGeo = manual && Object.values(geo).some(value => value.trim());
    if (hasManualGeo && !Object.values(geo).every(value => value.trim())) { setError('Complete country, state or region, and city.'); return; }
    busy.current = true; setLoading(true); setError(null);
    try {
      const location = await AddLocation(name, Number(longitude), Number(latitude), hasManualGeo ? geo : undefined);
      discovery?.retryCountries();
      if (active.current) setLocation(location);
    } catch { if (active.current) { setError('Could not save this location. Try again, or complete the manual location fields.'); setManual(true); } }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }
  return <div className="space-y-4 w-full min-w-0">
    <p className="text-sm">Choose the venue point on the map, then enter its name below.</p>
    <div className="relative h-64 overflow-hidden rounded-lg border"><BaseMap onMapLoad={handleMapLoad} onMapError={() => { setMapError(true); setManual(true); }} /></div>
    {mapError && <p className="text-sm">Map unavailable. You can enter the venue manually.</p>}
    <p role="status" className="text-sm">{longitude && latitude ? 'Point selected. Confirm the venue name below.' : 'No point selected yet.'}</p>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <SubmitLocation name={name} setName={setName} longitude={longitude} latitude={latitude} setLongitude={setLongitude} setLatitude={setLatitude} manual={manual} setManual={setManual} geo={geo} setGeo={setGeo} loading={loading} onSubmit={submit} />
  </div>;
}
