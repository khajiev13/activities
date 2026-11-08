import axiosInstance from '@/axios';
import { useParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityDetailsType } from '@/types/ActivitiesListSchema';
import ActivityDetail from '@/components/ActivitiesPage/ActivityDetail';
import ActivityParticipation from '@/components/ActivitiesPage/ActivityParticipation';
import { Button } from '@/components/ui/button';

export const ActivitiesDetail = () => {
  const { activity_pk } = useParams<{ activity_pk: string }>();
  const [activity, setActivity] = useState<ActivityDetailsType | null>(null);
  const [error, setError] = useState(false);
  const route = useMemo(() => ({ activity_pk, active: false, request: 0 }), [activity_pk]);
  const fetchActivity = useCallback(async () => {
    if (!route.active) return;
    const request = ++route.request;
    try {
      const response = await axiosInstance.get(`/api/activities/${encodeURIComponent(activity_pk || '')}`);
      if (!route.active || route.request !== request) return;
      setActivity(ActivityDetailsType.parse(response.data)); setError(false);
    } catch (cause) {
      if (!route.active || route.request !== request) return;
      setError(true); throw cause;
    }
  }, [activity_pk, route]);
  useEffect(() => {
    route.active = true; setActivity(null); setError(false);
    void fetchActivity().catch(() => {});
    return () => { route.active = false; route.request++; };
  }, [fetchActivity, route]);
  if (!activity) return error ? <div role="alert">Unable to load activity. <Button variant="outline" onClick={() => void fetchActivity().catch(() => {})}>Try again</Button></div> : <p role="status">Loading activity…</p>;
  return <ActivityDetail activity={activity} action={<ActivityParticipation key={activity.pk} activity={activity} onChanged={fetchActivity} />} />;
};
