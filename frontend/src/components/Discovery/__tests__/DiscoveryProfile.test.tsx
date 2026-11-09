// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { AuthContext } from '@/auth/AuthContext';
import { ThemeProvider } from '@/components/theme-provider';
import { DiscoveryProfile } from '../DiscoveryProfile';
import { DiscoverySurface } from '../DiscoverySurface';
import { fetchCountries, fetchResults } from '@/discovery/api';
import { requestDeviceLocation } from '@/discovery/deviceLocation';
import { resolveCurrentCity } from '@/discovery/resolveCity';
import { readDiscoveryPreference } from '@/discovery/preferences';
import type { DiscoveryPreference } from '@/discovery/place';
vi.mock('@/discovery/api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
vi.mock('@/discovery/preferences', () => ({ readCachedDiscoveryPreference: () => ({ preference: null, warning: false }), readDiscoveryPreference: vi.fn(), writeDiscoveryPreference: async () => ({ warning: false }) }));
vi.mock('@/discovery/deviceLocation', () => ({ getLocationPermission: async () => 'unknown', requestDeviceLocation: vi.fn() }));
vi.mock('@/discovery/resolveCity', () => ({ resolveCurrentCity: vi.fn() }));
vi.mock('@/discovery/geoNames', () => ({ resolvePlaceCenter: async () => null, searchCityPlaces: async () => [] }));
const base = { user: null, status: 'anonymous' as const, telegramIssue: null, login: async () => false, logout: async () => {}, retryTelegramLogin: async () => false, shareTelegramContact: async () => 'cancelled' as const };
const preference: DiscoveryPreference = { version: 1, mode: 'manual', place: { geo: { level: 'city', country: 'Example', state: 'Region', city: 'Saved City' }, center: [12, 34] }, recent: [], welcomeSeen: true, updatedAt: 100 };
function Profile() { const { surface, openSurface, closeSurface, location: place } = useDiscovery(); const route = useLocation(); return <><button onClick={() => openSurface('profile')}>Open profile</button><DiscoverySurface open={surface === 'profile'} title="Profile" description="Account and device location" onClose={closeSurface}><DiscoveryProfile /></DiscoverySurface><output aria-label="Mode">{place.mode}</output><output aria-label="Route">{route.pathname}:{route.state?.from}</output></>; }
async function mount(status: 'anonymous' | 'authenticated' | 'loading' = 'anonymous', failure = false) {
  function Session() { const [loggedIn, setLoggedIn] = useState(status === 'authenticated'); const [attempts, setAttempts] = useState(0); return <AuthContext.Provider value={{ ...base, status: status === 'loading' ? status : loggedIn ? 'authenticated' : 'anonymous', user: loggedIn ? { uid: '1', username: 'sample', first_name: 'Sample', last_name: 'Person', image_url: '/sample.png' } : null, logout: async () => { setLoggedIn(false); setAttempts(attempts + 1); if (failure && attempts === 0) throw new Error('offline'); } }}><Profile /></AuthContext.Provider>; }
  const view = render(<MemoryRouter initialEntries={['/map?q=tennis']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ThemeProvider><DiscoveryProvider><Session /></DiscoveryProvider></ThemeProvider></MemoryRouter>); await waitFor(() => expect(screen.getByLabelText('Mode').textContent).toBe('manual')); fireEvent.click(screen.getByRole('button', { name: 'Open profile' })); return view;
}
beforeEach(() => { vi.mocked(fetchCountries).mockResolvedValue([]); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] }); vi.mocked(readDiscoveryPreference).mockResolvedValue({ preference, warning: true }); window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('offers anonymous login with full return context and the existing appearance setting', async () => {
  await mount(); await screen.findByText(/Browsing Saved City/); fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'dark' } }); expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(screen.queryByText(/payments|saved activities|edit profile/i)).toBeNull(); fireEvent.click(screen.getByRole('link', { name: 'Log in' })); expect(screen.getByLabelText('Route').textContent).toBe('/login:/map?level=city&country=Example&state=Region&city=Saved+City&entity=activities&view=map&q=tennis');
});
it('shows loading rather than session actions', async () => { await mount('loading'); expect(screen.getByRole('status').textContent).toContain('Checking session'); expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull(); });
it('preserves logout failure through anonymous state and retries without closing Profile', async () => {
  await mount('authenticated', true); expect(screen.getByText('Sample Person')).toBeTruthy(); expect(screen.getByAltText('Sample Person').getAttribute('src')).toBe('/sample.png');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Log out' }))); expect(screen.getByRole('alert').textContent).toContain('Unable to finish logging out');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry logout' }))); expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
});
it('explains device following, warns without blocking and forgets the remembered city', async () => {
  await mount(); await screen.findByText(/Browsing Saved City/); expect(screen.getByText(/GeoNames receives your coordinates/)).toBeTruthy(); expect(screen.getByText(/may not be remembered/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Use current location' })).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Forget remembered places' }));
  await waitFor(() => expect(screen.getByLabelText('Mode').textContent).toBe('off')); expect(screen.getByText(/Following is off/)).toBeTruthy();
});

it('uses the actual Profile location action, retains the city on denial and enables following after retry', async () => {
  vi.mocked(requestDeviceLocation).mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')).mockResolvedValue({ latitude: 12, longitude: 34 });
  vi.mocked(resolveCurrentCity).mockResolvedValue({ country: 'Example', state: 'Region', city: 'New City', geonameId: 101, center: [12, 34] });
  await mount(); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Use current location' })));
  expect(screen.getByText(/Browsing Saved City/)).toBeTruthy(); expect(screen.getAllByRole('status').some(status => /denied/i.test(status.textContent ?? ''))).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Use current location' })));
  expect(screen.getByText('Following your city')).toBeTruthy(); expect(screen.getByLabelText('Mode').textContent).toBe('auto'); expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
});
