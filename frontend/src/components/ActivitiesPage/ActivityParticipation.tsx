import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import axiosInstance from '@/axios';
import { Button } from '@/components/ui/button';
import type { ActivityDetailsType } from '@/types/ActivitiesListSchema';

export default function ActivityParticipation({ activity, onChanged }: { activity: ActivityDetailsType; onChanged: () => void | Promise<void> }) {
  const { user } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const joined = Boolean(user?.username && activity.people_joined.some(person => person.username === user.username));
  const change = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      await axiosInstance.post(`/api/activities/${encodeURIComponent(activity.pk)}/${joined ? 'leave' : 'join'}/`, {});
      if (mounted.current) await onChanged();
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) { pending.current = false; setBusy(false); } }
  };
  return <div className="sticky bottom-0 z-10 border-t bg-background py-3 space-y-2">
    {error && <p role="alert" className="text-sm text-foreground">Unable to update participation. Please try again.</p>}
    <RequireAuth action="Join activity"><Button className="min-h-12 w-full text-base" disabled={busy} onClick={change}>{busy ? 'Updating…' : joined ? 'Leave activity' : 'Join activity'}</Button></RequireAuth>
    <p className="text-xs text-muted-foreground">You can join or leave again at any time.</p>
  </div>;
}
