import { useContext, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export function RequireAuth({ children, action }: { children: ReactNode; action?: string }) {
  const { status } = useContext(AuthContext);
  const location = useLocation();
  if (status === 'loading') return <span role="status">Checking session…</span>;
  if (status === 'anonymous') {
    const state = { from: location.pathname + location.search + location.hash, returnState: location.state };
    if (action) {
      const returnHistoryIndex = typeof window.history.state?.idx === 'number' ? window.history.state.idx : undefined;
      return <Link to="/login" state={{ ...state, returnHistoryIndex }} className="inline-flex min-h-12 w-full items-center justify-center rounded-md border px-4 py-2 text-base font-medium">{action}</Link>;
    }
    return <Navigate to="/login" state={state} replace />;
  }
  return <>{children}</>;
}
