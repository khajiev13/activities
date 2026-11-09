import { useEffect, useRef, useState } from 'react';
import { getTelegramApp } from '@/platform/telegram';
import { getLocationPermission, requestDeviceLocation } from './deviceLocation';
import { resolveCurrentCity } from './resolveCity';
import { resolvePlaceCenter, searchCityPlaces } from './geoNames';
import { readCachedDiscoveryPreference, readDiscoveryPreference, writeDiscoveryPreference } from './preferences';
import { placeKey, PlaceSelectionSchema } from './place';
import { serializeDiscovery } from './query';
import type { CityPlace, DiscoveryPreference, LocationMode, PlaceSelection } from './place';
import type { CityOption, DiscoveryState } from './types';

export type DiscoverySurface = 'none' | 'city' | 'search' | 'results' | 'profile' | 'create';
type LocationState = {
  place: PlaceSelection | null; mode: LocationMode; ready: boolean; welcome: boolean;
  status: 'idle' | 'locating' | 'resolving' | 'denied' | 'unavailable' | 'unmatched' | 'error';
  notice: string | null; persistenceWarning: boolean; recent: PlaceSelection[];
  cameraRequest: { sequence: number; place: PlaceSelection | null };
};
type Inputs = {
  state: DiscoveryState; cities: CityOption[]; enabled: boolean; path: string; surface: DiscoverySurface;
  updateState: (state: DiscoveryState) => void;
};
const samePlace = (a: PlaceSelection | null, b: PlaceSelection | null) => a === b || Boolean(a && b && placeKey(a) === placeKey(b));
const emptyPreference = (): DiscoveryPreference => ({ version: 1, mode: 'off', place: null, recent: [], welcomeSeen: false, updatedAt: 0 });
const intentKey = (state: DiscoveryState) => JSON.stringify([state.geo, state.follow]);

// This is the only owner of discovery restore, permission, device, provider,
// search and center work. Every continuation checks the same generation.
export function useDiscoveryLocation(inputs: Inputs) {
  const current = useRef(inputs); current.current = inputs;
  const [cache] = useState(readCachedDiscoveryPreference);
  const [model, setModel] = useState<LocationState>(() => {
    const { state } = inputs;
    const cachedPlace = cache.preference?.place ?? null;
    const place = state.geo ? samePlace({ geo: state.geo }, cachedPlace) ? cachedPlace : { geo: state.geo } : cachedPlace;
    return { place, mode: state.geo && !state.follow ? 'manual' : state.follow ? 'auto' : cache.preference?.mode ?? 'off', ready: Boolean(cache.preference), welcome: false, status: 'idle', notice: null, persistenceWarning: cache.warning, recent: cache.preference?.recent ?? [], cameraRequest: { sequence: 0, place: null } };
  });
  const value = useRef(model);
  const [owner] = useState(() => {
    let preference = cache.preference;
    let generation = 0;
    let pending: { controller: AbortController; generation: number; kind: string } | null = null;
    let mounted = true;
    let restored = false;
    let restoreUnknown = !cache.preference;
    let announcementTimer: ReturnType<typeof setTimeout> | undefined;
    let lastAttempt = -Infinity;
    let deferredCenter: PlaceSelection | null = null;
    let deferredRestore: { preference: DiscoveryPreference | null; warning: boolean } | null = null;
    let pausedVisit = Boolean(inputs.state.geo && !inputs.state.follow);
    let urlPlace: PlaceSelection | null = inputs.state.geo ? { geo: inputs.state.geo } : null;
    let urlFollow = inputs.state.follow;
    let expectedUrl: string | null = null;
    let previous = { path: inputs.path, state: inputs.state, surface: inputs.surface, enabled: inputs.enabled };
    const update = (patch: Partial<LocationState>) => { value.current = { ...value.current, ...patch }; if (mounted) setModel(value.current); };
    const cancelPending = () => {
      generation++; pending?.controller.abort(); pending = null; deferredRestore = null;
      clearTimeout(announcementTimer);
      if (value.current.notice?.startsWith('Updated to ')) update({ notice: null });
      if (value.current.status === 'locating' || value.current.status === 'resolving') update({ status: 'idle' });
    };
    const begin = (kind: string) => {
      cancelPending();
      const job = { controller: new AbortController(), generation, kind }; pending = job; return job;
    };
    const valid = (job: NonNullable<typeof pending>) => mounted && generation === job.generation && !job.controller.signal.aborted;
    const foreground = () => {
      const app = getTelegramApp();
      return document.visibilityState !== 'hidden' && (!app?.isVersionAtLeast?.('8.0') || app.isActive === true);
    };
    const eligible = () => current.current.enabled && current.current.surface === 'none' && foreground();
    const writeUrl = (place: PlaceSelection | null, mode: LocationMode, source = current.current.state) => {
      if (!current.current.enabled) return;
      const next: DiscoveryState = { entity: source.entity, view: source.view, query: source.query, geo: place?.geo ?? null, ...(mode === 'auto' ? { follow: true as const } : {}) };
      if (serializeDiscovery(next) === serializeDiscovery(current.current.state)) return;
      expectedUrl = serializeDiscovery(next);
      current.current.updateState(next);
    };
    const save = (patch: Partial<DiscoveryPreference>) => {
      const next = { ...(preference ?? emptyPreference()), ...patch, updatedAt: Math.max(Date.now(), (preference?.updatedAt ?? 0) + 1) };
      preference = next;
      void writeDiscoveryPreference(next).then(result => { if (mounted && preference === next) update({ persistenceWarning: value.current.persistenceWarning || result.warning }); });
    };
    const moveCamera = (place: PlaceSelection | null) => update({ cameraRequest: { sequence: value.current.cameraRequest.sequence + 1, place } });
    const showPlace = (place: PlaceSelection | null, mode: LocationMode, explicit = false, source = current.current.state) => {
      const changed = !samePlace(value.current.place, place);
      if (changed) deferredCenter = null;
      update({ place, mode, notice: null, status: 'idle' });
      if (place?.center && (explicit || changed || value.current.cameraRequest.sequence === 0)) moveCamera(place);
      writeUrl(place, mode, source);
    };
    const remember = (place: PlaceSelection, mode: LocationMode) => {
      const recent = [place, ...(preference?.recent ?? []).filter(item => !samePlace(item, place))].slice(0, 5);
      update({ recent, welcome: false }); save({ place, mode, recent, welcomeSeen: true });
    };
    const centerPlace = async (place: PlaceSelection, explicit: boolean, persist: boolean) => {
      if (place.center) { if (explicit) moveCamera(place); return; }
      if (!explicit && !eligible()) { deferredCenter = place; return; }
      deferredCenter = null;
      const job = begin(persist ? 'accepted-center' : 'center');
      try {
        const centered = await resolvePlaceCenter(place.geo, job.controller.signal);
        if (!valid(job)) return;
        pending = null;
        if (!centered?.center) { update({ notice: 'Could not find this place’s center. Try again with Center map.' }); return; }
        update({ place: centered, notice: null }); moveCamera(centered);
        if (persist) remember(centered, value.current.mode);
      } catch {
        if (valid(job)) { pending = null; update({ notice: 'Could not find this place’s center. Try again with Center map.' }); }
      }
    };
    const locate = async (explicit: boolean): Promise<boolean> => {
      if (!current.current.enabled || !foreground() || (current.current.surface !== 'none' && !(explicit && (current.current.surface === 'city' || current.current.surface === 'profile')))) return false;
      const job = begin('location');
      try {
        if (!explicit) {
          const permission = await getLocationPermission(job.controller.signal);
          if (!valid(job) || !eligible()) return false;
          if (permission !== 'granted') {
            pending = null;
            update({ ready: true, welcome: !preference?.welcomeSeen && !value.current.place, status: permission === 'denied' ? 'denied' : permission === 'unavailable' ? 'unavailable' : 'idle', notice: permission === 'denied' ? 'Location access is denied. Choose a city or enable location access and try again.' : permission === 'unavailable' ? 'Location is unavailable. Choose a city instead.' : null });
            if (value.current.place && !value.current.place.center) void centerPlace(value.current.place, false, false);
            return false;
          }
        }
        if (!valid(job)) return false;
        // Set before device I/O: paired native/browser foreground events cannot
        // issue two requests, including when the first request later fails.
        lastAttempt = Date.now(); update({ status: 'locating', notice: null, welcome: false });
        const position = await requestDeviceLocation(job.controller.signal);
        if (!valid(job)) return false;
        // A valid explicit device fix accepts following independently of provider
        // availability. Keep the previous coarse city and camera until resolved.
        if (explicit) {
          pausedVisit = false; urlFollow = true; urlPlace = null; restored = true; restoreUnknown = false;
          update({ mode: 'auto', ready: true });
          save({ mode: 'auto', place: value.current.place, welcomeSeen: true });
          writeUrl(value.current.place, 'auto');
        }
        update({ status: 'resolving' });
        const city = await resolveCurrentCity(position, current.current.cities, job.controller.signal);
        if (!valid(job)) return false;
        pending = null;
        if (!city) { update({ status: 'unmatched', notice: 'Could not identify your city. Choose a city or try again.' }); return false; }
        const place: PlaceSelection = { geo: { level: 'city', country: city.country, state: city.state, city: city.city }, geonameId: city.geonameId, center: city.center };
        pausedVisit = false; urlFollow = true; urlPlace = null; restored = true;
        const changed = !samePlace(value.current.place, place);
        showPlace(place, 'auto', explicit); remember(place, 'auto'); update({ ready: true });
        if (!explicit && changed) {
          const notice = `Updated to ${place.geo.city}.`;
          update({ notice });
          announcementTimer = setTimeout(() => { if (value.current.notice === notice) update({ notice: null }); }, 5000);
        }
        return true;
      } catch (reason) {
        if (!valid(job)) return false;
        pending = null;
        const name = reason instanceof Error || reason instanceof DOMException ? reason.name : '';
        update({ status: name === 'NotAllowedError' ? 'denied' : name === 'NotSupportedError' ? 'unavailable' : 'error', notice: name === 'NotAllowedError' ? 'Location access is denied. Choose a city or enable location access and try again.' : 'Could not get your location. Choose a city or try again.' });
        return false;
      }
    };
    const resume = () => {
      if (!restored || !eligible() || pending) return;
      if (deferredRestore) {
        const result = deferredRestore; deferredRestore = null;
        preference = result.preference; restoreUnknown = !preference && result.warning;
        restorePlace(); update({ persistenceWarning: value.current.persistenceWarning || result.warning });
        if (value.current.place && !value.current.place.center && (pausedVisit || value.current.mode !== 'auto')) void centerPlace(value.current.place, false, false);
      }
      if (deferredCenter) { void centerPlace(deferredCenter, false, false); return; }
      if (pausedVisit || (!urlFollow && restoreUnknown) || (preference && value.current.mode !== 'auto') || Date.now() - lastAttempt < 300000) return;
      void locate(false);
    };
    const restorePlace = () => {
      const savedPlace = preference?.place ?? null;
      const place = urlPlace ? samePlace(urlPlace, savedPlace) ? savedPlace : urlPlace : savedPlace;
      const mode = pausedVisit ? 'manual' : urlFollow ? 'auto' : preference?.mode ?? 'off';
      showPlace(place, mode); update({ recent: preference?.recent ?? [], ready: true });
    };
    const bootstrap = async () => {
      mounted = true;
      const job = begin('restore');
      // Render and publish cached geography before the bounded native read.
      if (value.current.place) showPlace(value.current.place, value.current.mode);
      const result = await readDiscoveryPreference(job.controller.signal);
      if (!valid(job)) return;
      pending = null; restored = true;
      // A bounded storage read may finish behind a sheet. Reconcile its value
      // only when Map is eligible; explicit intents still invalidate this stage.
      if (!eligible()) { deferredRestore = result; return; }
      preference = result.preference; restoreUnknown = !preference && result.warning;
      restorePlace(); update({ persistenceWarning: value.current.persistenceWarning || result.warning });
      if (pausedVisit || (preference && value.current.mode !== 'auto')) {
        if (value.current.place && !value.current.place.center && current.current.enabled) void centerPlace(value.current.place, false, false);
      } else resume();
    };
    const contextChanged = () => {
      const next = current.current;
      const stateKey = serializeDiscovery(next.state);
      const routeChanged = previous.path !== next.path || serializeDiscovery(previous.state) !== stateKey;
      const surfaceChanged = previous.surface !== next.surface;
      const ownUrl = routeChanged && previous.path === next.path && expectedUrl === stateKey;
      const externalRoute = (routeChanged && !ownUrl) || previous.enabled !== next.enabled;
      // A picker closes immediately after accepting a manual place. Its new
      // center may finish; old search/device work still belongs to the surface.
      const acceptedClose = surfaceChanged && previous.surface === 'city' && (next.surface === 'none' || next.surface === 'profile') && pending?.kind === 'accepted-center';
      const restoring = pending?.kind === 'restore' || Boolean(deferredRestore);
      if (externalRoute || (surfaceChanged && !acceptedClose && !restoring)) cancelPending();
      if (ownUrl) expectedUrl = null;
      if (externalRoute && next.enabled && (intentKey(previous.state) !== intentKey(next.state) || !previous.enabled)) {
        pausedVisit = Boolean(next.state.geo && !next.state.follow);
        urlPlace = next.state.geo ? { geo: next.state.geo } : null; urlFollow = next.state.follow;
        restored = true;
        restorePlace();
        if (value.current.place && !value.current.place.center && pausedVisit) void centerPlace(value.current.place, false, false);
      }
      if (externalRoute || (surfaceChanged && !restoring)) restored = true;
      previous = { path: next.path, state: next.state, surface: next.surface, enabled: next.enabled };
      resume();
    };
    return {
      bootstrap, contextChanged,
      foregroundChanged: () => {
        // Storage is bounded and does not request location. Retain its evidence
        // while hidden, staging the result until eligible Map returns.
        if (!foreground()) { if (pending?.kind !== 'restore' && !deferredRestore) cancelPending(); } else resume();
      },
      dispose: () => { mounted = false; cancelPending(); },
      actions: {
        cancelPending,
        selectPlace: (candidate: PlaceSelection, state = current.current.state) => {
          const parsed = PlaceSelectionSchema.safeParse(candidate); if (!parsed.success) return;
          cancelPending(); deferredCenter = null; restored = true; pausedVisit = false; urlPlace = null; urlFollow = undefined;
          const place = parsed.data;
          showPlace(place, 'manual', true, state); remember(place, 'manual'); update({ ready: true });
          if (!place.center) return centerPlace(place, true, true);
        },
        useCurrentLocation: () => { restored = true; return locate(true); },
        recenter: () => {
          const place = value.current.place;
          // Camera-only intent must not invalidate preference reconciliation.
          // Bootstrap will resolve a missing center and resume eligible following.
          if (pending?.kind === 'restore') { if (place?.center) moveCamera(place); return; }
          cancelPending();
          if (place) return centerPlace(place, true, false);
        },
        forgetPlaces: () => {
          cancelPending(); deferredCenter = null; restored = true; pausedVisit = false; urlPlace = null; urlFollow = undefined;
          update({ place: null, mode: 'off', recent: [], welcome: false, ready: true, status: 'idle', notice: null });
          save({ place: null, mode: 'off', recent: [], welcomeSeen: true }); writeUrl(null, 'off'); moveCamera(null);
        },
        dismissWelcome: () => { if (!value.current.welcome) return; update({ welcome: false }); save({ welcomeSeen: true }); },
        searchPlaces: async (query: string): Promise<CityPlace[]> => {
          const job = begin('search');
          try {
            const places = await searchCityPlaces(query, current.current.cities, job.controller.signal);
            if (!valid(job)) return []; pending = null; return places;
          } catch (reason) { if (!valid(job)) return []; pending = null; throw reason; }
        },
      },
    };
  });
  const stateKey = serializeDiscovery(inputs.state);
  useEffect(() => { owner.contextChanged(); }, [owner, inputs.path, inputs.enabled, inputs.surface, stateKey]);
  useEffect(() => {
    void owner.bootstrap();
    const app = getTelegramApp();
    document.addEventListener('visibilitychange', owner.foregroundChanged);
    if (app?.isVersionAtLeast?.('8.0')) { app.onEvent?.('activated', owner.foregroundChanged); app.onEvent?.('deactivated', owner.foregroundChanged); }
    return () => {
      document.removeEventListener('visibilitychange', owner.foregroundChanged);
      app?.offEvent?.('activated', owner.foregroundChanged); app?.offEvent?.('deactivated', owner.foregroundChanged);
      owner.dispose();
    };
  }, [owner]);
  return { ...model, ...owner.actions };
}
