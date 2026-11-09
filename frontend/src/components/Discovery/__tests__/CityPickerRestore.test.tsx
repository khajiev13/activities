// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '@/discovery/DiscoveryContext';
import { CityPicker } from '../CityPicker';
import type { DiscoveryPreference } from '@/discovery/place';
import type { TelegramApp } from '@/platform/telegram';
vi.mock('@/discovery/api', () => ({ fetchCountries: async () => [], fetchResults: async () => ({ activities: [], teams: [], organizations: [] }) }));
vi.mock('@/discovery/deviceLocation', () => ({ getLocationPermission: async () => 'unknown', requestDeviceLocation: vi.fn() }));
vi.mock('@/api/authApi', () => ({ isInTelegram: () => true }));
const nativeWindow = window as Window & { Telegram?: { WebApp: TelegramApp } };
let discovery: ReturnType<typeof useDiscovery>;
function Probe() { discovery = useDiscovery(); return <><button onClick={() => discovery.openSurface('city')}>Choose place</button><CityPicker /></>; }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete nativeWindow.Telegram; });
it('ordinary city Close during native-only restore preserves rendered and native saved city', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  const saved: DiscoveryPreference = { version: 1, mode: 'manual', place: { geo: { level: 'city', country: 'Example', state: 'North', city: 'Saved' }, geonameId: 101, center: [10, 20] }, recent: [], welcomeSeen: true, updatedAt: 100 };
  let nativeSaved = saved; let finishRead: ((error: string | null, value?: string) => void) | undefined;
  nativeWindow.Telegram = { WebApp: { isVersionAtLeast: () => true, isActive: true, DeviceStorage: { getItem: (_key, callback) => { finishRead = callback; }, setItem: (_key, value, callback) => { nativeSaved = JSON.parse(value); callback?.(null, true); } } } };
  render(<MemoryRouter initialEntries={['/map']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Probe /></DiscoveryProvider></MemoryRouter>);
  await act(async () => {}); fireEvent.click(screen.getByRole('button', { name: 'Choose place' }));
  expect(discovery.location.welcome).toBe(false); fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () => finishRead?.(null, JSON.stringify(saved)));
  expect(discovery.location.mode).toBe('manual'); expect(discovery.location.place).toEqual(saved.place); expect(nativeSaved).toEqual(saved);
});
