import { useContext, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '@/auth/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function AccountMenu() {
  const { user, status, logout } = useContext(AuthContext);
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Your account';
  const onLogout = async () => {
    setLoggingOut(true); setError(false);
    try { await logout(); setOpen(false); } catch { setError(true); }
    finally { setLoggingOut(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className="app-icon-button app-account-button" aria-label="Account">
      {user?.image_url ? <img src={user.image_url} alt="" /> : <UserRound size={20} aria-hidden="true" />}
    </button></DialogTrigger>
    <DialogContent className="app-account-dialog">
      <DialogHeader><DialogTitle>Your account</DialogTitle><DialogDescription>Manage your session and appearance.</DialogDescription></DialogHeader>
      {status === 'loading' ? <p role="status">Checking session…</p> : status === 'authenticated' ? <>
        <div className="app-account-identity">{user?.image_url && <img src={user.image_url} alt={name} />}<strong>{name}</strong></div>
        <button className="app-account-action" type="button" disabled={loggingOut} onClick={onLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</button>
        {error && <p role="alert">Unable to finish logging out. Please try again.</p>}
      </> : <Link className="app-account-action" to="/login" state={{ from: location.pathname + location.search + location.hash }} onClick={() => setOpen(false)}>Log in</Link>}
      <label className="app-theme-control">Appearance<select value={theme} onChange={event => setTheme(event.target.value as 'light' | 'dark' | 'system')}>
        <option value="system">Automatic</option><option value="light">Light</option><option value="dark">Dark</option>
      </select></label>
    </DialogContent>
  </Dialog>;
}
