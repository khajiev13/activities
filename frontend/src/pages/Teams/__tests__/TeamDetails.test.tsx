// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '@/auth/AuthContext';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/layout/AppShell';
import TeamDetails from '../TeamDetails';
import axiosInstance from '@/axios';
vi.mock('@/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/components/Drawer', () => ({ Create: () => null }));
const member = { username: 'ada', first_name: 'Ada', last_name: 'Player', name_on_jersey: 'Player', player_number: 8, role: 'Midfielder' };
const team = { name: 'Actual team', image_url: null, city_name: 'Tashkent', state_name: 'Tashkent', country_name: 'Uzbekistan', founded_at: '2020-01-01', men_team: false, public_team: true,
  tshirt_color: [{name: '#ff0000'}], shorts_color: [{name: '#000000'}], socks_color: [{name: '#ffffff'}], away_tshirt_color: [{name: '#0000ff'}], categories: [],
  location: [{ pk: 'pitch', name: 'Actual pitch', points: { latitude: 41, longitude: 69 } }], members: [], sponsors: [{name: 'Actual sponsor'}], belongs_to_organization: [{name: 'Actual organization'}] };
let current: object = team;
function Location() { const loc = useLocation(); return <output>{loc.pathname}{loc.search}</output>; }
function setup() { return render(<MemoryRouter initialEntries={['/teams/Actual%20team?city=Tashkent']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <AuthContext.Provider value={{ user: { ...member, uid: '1', image_url: '' }, status: 'authenticated', telegramIssue: null, login: async () => true, logout: async () => {}, retryTelegramLogin: async () => false, shareTelegramContact: async () => 'cancelled' }}>
    <ThemeProvider><AppShell><Location /><Routes><Route path="/teams/:team_name" element={<TeamDetails />} /><Route path="/teams" element={<p>Team directory</p>} /></Routes></AppShell></ThemeProvider>
  </AuthContext.Provider></MemoryRouter>); }
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} }); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }); current = team; window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })); vi.mocked(axiosInstance.get).mockImplementation(async () => ({data: current})); vi.mocked(axiosInstance.post).mockReset(); });
afterEach(cleanup);
it('shows actual membership and position after joining and preserves supported metadata', async () => {
  vi.mocked(axiosInstance.post).mockImplementation(async () => { current = {...team, members: [member]}; return {data:{}}; });
  setup(); await screen.findByText('No members yet.'); await act(async () => {}); fireEvent.click(screen.getByRole('button', {name:'Join'}));
  fireEvent.change(screen.getByLabelText('Jersey name'), {target:{value:'Player'}});
  fireEvent.change(screen.getByLabelText('Number'), {target:{value:'8'}});
  fireEvent.change(screen.getByLabelText('Position'), {target:{value:'Midfielder'}});
  await act(async () => fireEvent.click(screen.getByRole('button', {name:'Join team'})));
  expect(await screen.findByText('You are a member · Midfielder')).toBeTruthy();
  expect(screen.getByText('Player · #8 · Midfielder')).toBeTruthy(); expect(screen.queryByRole('button', {name:'Join'})).toBeNull();
  expect(screen.getByText('Actual pitch')).toBeTruthy(); expect(screen.getByText('Actual sponsor')).toBeTruthy(); expect(screen.getByRole('link', {name:'Actual organization'}).getAttribute('href')).toBe('/organizations?city=Tashkent');
  expect(axiosInstance.post).toHaveBeenCalledWith('/api/teams/Actual%20team/join/', {name_on_jersey:'Player',player_number:8,position:'Midfielder'});
});
it('returns a direct team detail to the team directory with its query', async () => {
  setup(); await screen.findByText('Actual team'); fireEvent.click(screen.getByRole('button', {name:'Back'}));
  expect(screen.getByText('/teams?city=Tashkent')).toBeTruthy();
});
it('retains the joining form and membership after a failed join for retry', async () => {
  vi.mocked(axiosInstance.post).mockRejectedValue(new Error('offline')); setup(); await screen.findByText('No members yet.'); await act(async () => {}); fireEvent.click(screen.getByRole('button', {name:'Join'}));
  fireEvent.change(screen.getByLabelText('Jersey name'), {target:{value:'Player'}}); fireEvent.change(screen.getByLabelText('Number'), {target:{value:'8'}}); fireEvent.change(screen.getByLabelText('Position'), {target:{value:'Midfielder'}});
  await act(async () => fireEvent.click(screen.getByRole('button', {name:'Join team'})));
  expect(screen.getByRole('alert').textContent).toContain('Unable to join'); expect(screen.getByRole('button', {name:'Join team'}).hasAttribute('disabled')).toBe(false);
});
