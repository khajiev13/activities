import { useContext, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export function RequireAuth({ children, action }: { children: ReactNode; action?: string }) {
  const { status } = useContext(AuthContext);
  const location = useLocation();
  if (status === 'loading') return <span role="status">Checking session…</span>;
  if (status === 'anonymous') {
    const state = { from: location.pathname + location.search + location.hash };
    if (action) {
      return <Link to="/login" state={state} className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">{action}</Link>;
    }
    return <Navigate to="/login" state={state} replace />;
  }
  return <>{children}</>;
}
