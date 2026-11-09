// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { LoginForm } from '../LoginForm';
vi.mock('@/api/authApi', () => ({ isInTelegram: () => false, requestOtp: async () => ({retry_after_seconds:0}) }));
afterEach(cleanup);
function Detail() { const loc = useLocation(); const navigate = useNavigate(); return <><output>{loc.pathname}{loc.search}:{loc.state?.from}</output><RequireAuth action="Join activity"><button onClick={() => navigate(-1)}>Return to results</button></RequireAuth></>; }
it('successful login returns to the existing detail entry and Back reaches its original discovery route', async () => {
  window.history.replaceState({idx:0}, '', '/activities?city=Tashkent&q=ball');
  function Session() {
    const [status, setStatus] = useState<'anonymous' | 'authenticated'>('anonymous');
    return <AuthContext.Provider value={{ user:null, status, telegramIssue:null,
      login:async () => { setStatus('authenticated'); return true; }, logout:async () => {}, retryTelegramLogin:async () => false, shareTelegramContact:async () => 'cancelled' }}>
      <Routes><Route path="/activities" element={<Link to="/activities/one?city=Tashkent&q=ball" state={{from:'/activities?city=Tashkent&q=ball'}}>Original results</Link>} /><Route path="/activities/:id" element={<Detail />} /><Route path="/login" element={<LoginForm />} /></Routes>
    </AuthContext.Provider>;
  }
  render(<BrowserRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Session /></BrowserRouter>);
  fireEvent.click(screen.getByText('Original results')); fireEvent.click(screen.getByRole('link',{name:'Join activity'}));
  await act(async () => fireEvent.submit(screen.getByRole('button',{name:'Send code'}).closest('form')!));
  await act(async () => fireEvent.submit(screen.getByRole('button',{name:'Login'}).closest('form')!));
  await screen.findByRole('button',{name:'Return to results'});
  expect(window.history.state.idx).toBe(1);
  expect(screen.getByText('/activities/one?city=Tashkent&q=ball:/activities?city=Tashkent&q=ball')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Return to results'}));
  await waitFor(() => expect(screen.getByText('Original results')).toBeTruthy());
});

it.each(['/activities/one?city=Tashkent', '//outside.test', '/login-again'])('uses a safe replacement for direct login without a previous app history entry (%s)', async from => {
  window.history.replaceState({idx:0, usr:{from,returnState:{from:'/map?city=Tashkent'}}}, '', '/login');
  const safePath = from.startsWith('/activities/') ? '/activities/one?city=Tashkent' : '/';
  render(<BrowserRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><AuthContext.Provider value={{user:null,status:'authenticated',telegramIssue:null,login:async()=>true,logout:async()=>{},retryTelegramLogin:async()=>false,shareTelegramContact:async()=>'cancelled'}}><Routes><Route path="/login" element={<LoginForm />} /><Route path="*" element={<p>Returned safely</p>} /></Routes></AuthContext.Provider></BrowserRouter>);
  await screen.findByText('Returned safely'); expect(window.location.pathname + window.location.search).toBe(safePath);
  expect(window.history.state.idx).toBe(0);
});
