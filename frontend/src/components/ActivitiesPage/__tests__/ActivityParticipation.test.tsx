// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '@/auth/AuthContext';
import axiosInstance from '@/axios';
import { ActivitiesDetail } from '@/pages/Activities/ActivitiesDetail';
import type { ActivityDetailsType } from '@/types/ActivitiesListSchema';
vi.mock('@/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const original: ActivityDetailsType = {
  pk: 'one', title: 'First activity', description: 'An actual activity', date_time: '2026-11-08T12:00:00Z',
  duration_in_minutes: 60, public: true, country: { name: 'Uzbekistan' }, state: { name: 'Tashkent' },
  city: { name: 'Tashkent' }, location: { name: 'Pitch' }, categories: [{ name: 'Football' }],
  creator: { first_name: 'Organizer', last_name: 'One', username: 'organizer', image_url: '' },
  people_joined: [], number_of_people_joined: 0,
  competition: { team_1: { name: null, image_url: null }, team_2: { name: null, image_url: null } },
};
const member = { first_name: 'Ada', last_name: 'Player', username: 'ada', image_url: '' };
let current = original;
const auth = { user: { ...member, uid: '1' }, status: 'authenticated' as const, telegramIssue: null,
  login: async () => true, logout: async () => {}, retryTelegramLogin: async () => false, shareTelegramContact: async () => 'cancelled' as const };
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}:{location.state?.from}</output>; }
function setup(status: 'authenticated' | 'anonymous' | 'loading' = 'authenticated') {
  return render(<MemoryRouter initialEntries={['/activities/one?city=Tashkent&q=ball']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthContext.Provider value={{ ...auth, status, user: status === 'authenticated' ? auth.user : null }}>
      <Link to="/activities/two?city=Tashkent">Second activity</Link><Location />
      <Routes><Route path="/activities/:activity_pk" element={<ActivitiesDetail />} /><Route path="/login" element={<p>Login screen</p>} /></Routes>
    </AuthContext.Provider></MemoryRouter>);
}
beforeEach(() => { current = original; vi.mocked(axiosInstance.get).mockImplementation(async () => ({ data: current })); vi.mocked(axiosInstance.post).mockReset(); });
afterEach(cleanup);
it('joins then leaves and displays authoritative attendee counts after refetch', async () => {
  vi.mocked(axiosInstance.post).mockImplementation(async (url) => { current = url?.endsWith('/join/') ? { ...original, people_joined: [member], number_of_people_joined: 7 } : original; return { data: {} }; });
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Join activity' }));
  expect(await screen.findByText('7 people joined')).toBeTruthy();
  expect(screen.getByText('Ada Player')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Leave activity' }));
  expect(await screen.findByText('0 people joined')).toBeTruthy();
  expect(screen.queryByText('Ada Player')).toBeNull();
  expect(vi.mocked(axiosInstance.post).mock.calls.map(([url]) => url)).toEqual(['/api/activities/one/join/', '/api/activities/one/leave/']);
});
it('keeps membership unchanged after failure and allows retry', async () => {
  vi.mocked(axiosInstance.post).mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(async () => { current = { ...original, people_joined: [member], number_of_people_joined: 1 }; return { data: {} }; });
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Join activity' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.getByText('0 people joined')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Join activity' }));
  expect(await screen.findByRole('button', { name: 'Leave activity' })).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('allows only one pending participation mutation', async () => {
  let resolve!: (value: { data: object }) => void;
  vi.mocked(axiosInstance.post).mockImplementation(() => new Promise(done => { resolve = done; }));
  setup(); const button = await screen.findByRole('button', { name: 'Join activity' });
  fireEvent.click(button); fireEvent.click(button); expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: {} }));
});
it('preserves the exact detail and discovery query when asking anonymous visitors to log in', async () => {
  setup('anonymous'); fireEvent.click(await screen.findByRole('link', { name: 'Join activity' }));
  expect(screen.getByText('/login:/activities/one?city=Tashkent&q=ball')).toBeTruthy();
});
it('does not expose personal actions while the session is pending', async () => {
  setup('loading'); await screen.findByText('First activity');
  expect(screen.queryByRole('button', { name: /Join activity|Leave activity/ })).toBeNull();
  expect(screen.getByText('Checking session…')).toBeTruthy();
});
it('ignores a completed mutation after changing activity', async () => {
  let resolve!: (value: { data: object }) => void;
  vi.mocked(axiosInstance.post).mockImplementation(() => new Promise(done => { resolve = done; }));
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Join activity' }));
  current = { ...original, pk: 'two', title: 'New detail' };
  fireEvent.click(screen.getByRole('link', { name: 'Second activity' })); await screen.findByText('New detail');
  current = { ...original, people_joined: [member], number_of_people_joined: 12 };
  await act(async () => resolve({ data: {} }));
  await waitFor(() => expect(screen.getByText('New detail')).toBeTruthy());
  expect(screen.getByText('0 people joined')).toBeTruthy(); expect(screen.queryByText('12 people joined')).toBeNull();
});
