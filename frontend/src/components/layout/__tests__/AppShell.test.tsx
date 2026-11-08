// @vitest-environment jsdom
import type { TelegramApp } from '@/platform/telegram';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '@/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { AppShell } from '../AppShell';
import { PageHeader } from '../PageHeader';

vi.mock('@/components/Drawer', () => ({ Create: () => <button>Create</button> }));
const telegramWindow = window as Window & { Telegram?: { WebApp: TelegramApp } };
vi.mock('@/api/authApi', () => ({ isInTelegram: () => Boolean(telegramWindow.Telegram) }));
let dark = false;
let systemListener: () => void;
const removeSystemListener = vi.fn();
const nativeEvents = new Map<string, () => void>();
const logout = vi.fn(async () => {});
const anonymous = { user: null, status: 'anonymous' as const, telegramIssue: null,
  login: async () => false, logout, retryTelegramLogin: async () => false,
  shareTelegramContact: async () => 'cancelled' as const };
function Location() { const location = useLocation(); return <><output>{location.pathname}{location.search}</output><output aria-label="Return route">{location.state?.from}</output></>; }
function ThemeState() { const { theme, resolvedTheme } = useTheme(); return <output>{theme}:{resolvedTheme}</output>; }
function shell(path = '/activities', authenticated = false) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthContext.Provider value={authenticated ? { ...anonymous, status: 'authenticated', user: {
      uid: '1', username: 'ada', first_name: 'Ada', last_name: 'Lovelace', image_url: '/avatar.png',
    } } : anonymous}><ThemeProvider><AppShell><p>Page content</p><Location /></AppShell></ThemeProvider></AuthContext.Provider>
  </MemoryRouter>);
}
beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), clear: () => stored.clear() }); dark = false; nativeEvents.clear(); delete telegramWindow.Telegram;
  window.matchMedia = vi.fn().mockImplementation(() => ({ get matches() { return dark; },
    addEventListener: (_: string, listener: () => void) => { systemListener = listener; }, removeEventListener: removeSystemListener }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('responsive shell', () => {
  it('has four labeled destinations and follows the active route while preserving query context', () => {
    shell('/activities?city=Tashkent&q=tennis');
    for (const name of ['Explore', 'Activities', 'Teams', 'Organizations']) expect(screen.getByRole('link', { name })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Activities' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('link', { name: 'Teams' }));
    expect(screen.getByRole('link', { name: 'Teams' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('/teams?city=Tashkent&q=tennis')).toBeTruthy();
    expect(screen.getByText('Page content')).toBeTruthy();
  });
  it('labels root Explore as the active destination', () => {
    shell('/'); expect(screen.getByRole('link', { name: 'Explore' }).getAttribute('aria-current')).toBe('page');
  });
  it('offers a login that remembers the route and only supported account actions', () => {
    shell('/teams?city=Tashkent'); fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.queryByText(/payments|saved activities|edit profile/i)).toBeNull();
    fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'dark' } });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Log in' }));
    expect(screen.getByText('/login')).toBeTruthy();
    expect(screen.getByLabelText('Return route').textContent).toBe('/teams?city=Tashkent');
  });
  it('uses the real account identity and logout action', () => {
    shell('/teams', true); fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByAltText('Ada Lovelace').getAttribute('src')).toBe('/avatar.png');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' })); expect(logout).toHaveBeenCalledOnce();
  });
  it('returns a direct detail link to a safe list fallback', () => {
    render(<MemoryRouter initialEntries={['/activities/42?city=Tashkent']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PageHeader title="Activity" backTo="/activities?city=Tashkent" /><Location />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('/activities?city=Tashkent')).toBeTruthy();
  });
  it('rejects an external direct-link fallback', () => {
    render(<MemoryRouter initialEntries={['/activities/42']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PageHeader title="Activity" backTo="https://example.com" /><Location />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('/')).toBeTruthy();
  });
  it('registers native Back only off root and cleans it up', () => {
    const callback = vi.fn(); const offClick = vi.fn(); const hide = vi.fn(); const show = vi.fn();
    telegramWindow.Telegram = { WebApp: { BackButton: { show, hide, onClick: callback, offClick } } };
    const view = shell('/teams/team'); expect(show).toHaveBeenCalledOnce();
    const back = callback.mock.calls[0][0]; act(() => back()); expect(screen.getByText('/teams')).toBeTruthy();
    expect(hide).toHaveBeenCalled(); view.unmount(); expect(offClick).toHaveBeenCalledWith(back);
    shell('/map'); expect(callback).toHaveBeenCalledOnce();
  });
});
describe('theme priority and subscriptions', () => {
  function theme() { return render(<ThemeProvider><ThemeState /></ThemeProvider>); }
  it('follows system changes and removes its listener', () => {
    const view = theme(); expect(screen.getByText('system:light')).toBeTruthy();
    dark = true; act(() => systemListener()); expect(screen.getByText('system:dark')).toBeTruthy();
    view.unmount(); expect(removeSystemListener).toHaveBeenCalled();
  });
  it('prefers Telegram over system and reacts to native changes', () => {
    dark = true; const app = { colorScheme: 'light', onEvent: (name: string, cb: () => void) => nativeEvents.set(name, cb), offEvent: vi.fn() };
    telegramWindow.Telegram = { WebApp: app }; const view = theme(); expect(screen.getByText('system:light')).toBeTruthy();
    app.colorScheme = 'dark'; act(() => nativeEvents.get('themeChanged')?.()); expect(screen.getByText('system:dark')).toBeTruthy();
    view.unmount(); expect(app.offEvent).toHaveBeenCalledWith('themeChanged', expect.any(Function));
  });
  it('prefers explicit choice over Telegram and ignores invalid persisted values', () => {
    telegramWindow.Telegram = { WebApp: { colorScheme: 'dark' } }; localStorage.setItem('vite-ui-theme', 'light');
    const view = theme(); expect(screen.getByText('light:light')).toBeTruthy(); view.unmount();
    localStorage.setItem('vite-ui-theme', 'invalid'); theme(); expect(screen.getByText('system:dark')).toBeTruthy();
  });
});

it('keeps rejected logout feedback visible after auth becomes anonymous and offers retry', async () => {
  let attempts = 0;
  function Session() {
    const [authenticated, setAuthenticated] = useState(true);
    return <AuthContext.Provider value={{ ...anonymous, status: authenticated ? 'authenticated' : 'anonymous',
      user: authenticated ? { uid: '1', username: 'ada', first_name: 'Ada', last_name: 'Lovelace', image_url: '' } : null,
      logout: async () => { setAuthenticated(false); attempts++; if (attempts === 1) throw new Error('offline'); },
    }}><ThemeProvider><AppShell><p>Page</p></AppShell></ThemeProvider></AuthContext.Provider>;
  }
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Session /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Log out' })));
  expect(screen.getByRole('alert').textContent).toContain('Unable to finish logging out');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry logout' })));
  expect(attempts).toBe(2); expect(screen.queryByRole('dialog')).toBeNull();
});
