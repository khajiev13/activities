import type { ReactNode } from 'react';
import { Building2, CalendarDays, Map, Users } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Create } from '@/components/Drawer';
import { RequireAuth } from '@/auth/RequireAuth';
import { useAppViewport } from '@/platform/useAppViewport';
import { AccountMenu } from './AccountMenu';
import { PageHeader } from './PageHeader';

const destinations = [
  { to: '/map', label: 'Explore', icon: Map },
  { to: '/activities', label: 'Activities', icon: CalendarDays },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/organizations', label: 'Organizations', icon: Building2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  useAppViewport();
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const destination = destinations.find(item => path === item.to || path.startsWith(item.to + '/'));
  const isDirectory = ['/activities', '/teams', '/organizations'].includes(path);
  const detailParent = path.startsWith('/activities/') ? '/activities' : path.startsWith('/teams/') ? '/teams' : undefined;
  const from: unknown = location.state?.from;
  const authBack = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') && !from.startsWith('/register') ? from : '/';
  const backTo = detailParent ? detailParent + location.search : ['/login', '/register'].includes(path) ? authBack : undefined;
  const title = path === '/login' ? 'Log in' : path === '/register' ? 'Register' : detailParent === '/activities' ? 'Activity' : detailParent === '/teams' ? 'Team' : destination?.label || 'Eventopia';
  return <div className="app-shell">
    <a className="app-skip-link" href="#app-content">Skip to content</a>
    <div className="app-body">
      <PageHeader title={title} backTo={backTo}>
        {isDirectory && <div className="app-context-create"><RequireAuth action="Create"><Create /></RequireAuth></div>}
        <AccountMenu />
      </PageHeader>
      <main id="app-content" className="app-content" tabIndex={-1}>{children}</main>
    </div>
    <nav className="app-navigation" aria-label="Main navigation">
      <Link className="app-wordmark" to={{ pathname: '/', search: location.search }}>Eventopia</Link>
      {destinations.map(({ to, label, icon: Icon }) => <NavLink key={to} to={{ pathname: to, search: location.search }} className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
        <Icon size={21} aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
    </nav>
  </div>;
}
