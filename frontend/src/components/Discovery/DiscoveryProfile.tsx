import { useDiscovery } from '@/discovery/DiscoveryContext';
import { AccountContents } from '@/components/layout/AccountMenu';

export function DiscoveryProfile() {
  const { location, state, openSurface, closeSurface } = useDiscovery();
  const city = state.geo?.city ?? state.geo?.state ?? state.geo?.country;
  const pending = location.status === 'locating' || location.status === 'resolving';
  return <div className="discovery-profile">
    <AccountContents onDone={closeSurface} />
    <section className="discovery-profile-location" aria-label="Device location settings">
      <h3>Location on this device</h3>
      <strong>{location.mode === 'off' ? 'Following is off' : location.mode === 'auto' ? 'Following your city' : city ? `Browsing ${city}` : 'Choose a city'}</strong>
      {city && <p>{[state.geo?.city, state.geo?.state, state.geo?.country].filter(Boolean).join(', ')}</p>}
      <p>{location.mode === 'auto' ? 'Your city is checked when you open or resume the app with location access.' : 'Your chosen city stays selected while you travel. Use current location to follow your city again.'}</p>
      <button type="button" className="app-account-action" onClick={() => openSurface('city', 'profile')}>Choose a city</button>
      <button type="button" className="app-account-action" disabled={pending} onClick={() => { void location.useCurrentLocation(); }}>{pending ? 'Finding your city…' : 'Use current location'}</button>
      <p>GeoNames receives your coordinates to find a city. Eventopia remembers only the city or region, not your exact location.</p>
      {location.notice && <p role="status">{location.notice}</p>}
      {location.status !== 'idle' && !pending && <p role="status">{location.status === 'denied' ? 'Location permission denied. Enable location access or choose a city.' : location.status === 'unmatched' ? 'Could not identify your city. Choose a city or try again.' : 'Device location is unavailable. Choose a city or try again.'}</p>}
      {location.persistenceWarning && <p>Your choice may not be remembered on this device.</p>}
      <button type="button" className="app-account-action" onClick={location.forgetPlaces}>Forget remembered places</button>
      <p>Forget removes remembered places on this device and turns off automatic following.</p>
    </section>
  </div>;
}
