import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppViewport } from '@/platform/useAppViewport';
import { AccountMenu } from './AccountMenu';
import { PageHeader } from './PageHeader';

export function AppShell({ children }: { children: ReactNode }) {
  useAppViewport();
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const isDirectory = ['/activities', '/teams', '/organizations'].includes(path);
  const isDiscovery = isDirectory || path === '/' || path === '/map';
  const detailParent = path.startsWith('/activities/') ? '/activities' : path.startsWith('/teams/') ? '/teams' : undefined;
  const from: unknown = location.state?.from;
  const authBack = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') && !from.startsWith('/register') ? from : '/';
  const detailFrom = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : undefined;
  const backTo = detailParent ? detailFrom ?? detailParent + location.search : ['/login', '/register'].includes(path) ? authBack : undefined;
  const title = path === '/login' ? 'Log in' : path === '/register' ? 'Register' : detailParent === '/activities' ? 'Activity' : detailParent === '/teams' ? 'Team' : 'Eventopia';
  return <div className={`app-shell${isDiscovery ? ' app-discovery-shell' : ''}`}>
    <a className="app-skip-link" href="#app-content">Skip to content</a>
    <div className="app-body">
      {!isDiscovery && <PageHeader title={title} backTo={backTo}><AccountMenu /></PageHeader>}
      <main id="app-content" className={`app-content${isDirectory || path === '/' || path === '/map' ? ' discovery-content' : ''}`} tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
