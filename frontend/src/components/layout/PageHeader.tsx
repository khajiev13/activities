import { useCallback, useEffect, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTelegramApp } from '@/platform/telegram';

export function PageHeader({ title, backTo, children }: { title: string; backTo?: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const safeFallback = backTo?.startsWith('/') && !backTo.startsWith('//') ? backTo : '/';
  const back = useCallback(() => {
    if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigate(-1);
    else navigate(safeFallback, { replace: true });
  }, [navigate, safeFallback]);
  useEffect(() => {
    const button = getTelegramApp()?.BackButton;
    if (!button) return;
    if (!backTo) { button.hide(); return; }
    button.show();
    button.onClick(back);
    return () => { button.offClick(back); button.hide(); };
  }, [backTo, back]);
  return <header className="app-page-header">
    {backTo && <button type="button" className="app-icon-button" aria-label="Back" onClick={back}><ArrowLeft aria-hidden="true" size={20} /></button>}
    <h1>{title}</h1><div className="app-header-actions">{children}</div>
  </header>;
}
