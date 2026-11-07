import axiosInstance from '@/axios';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ActivityDetailsType } from '@/types/ActivitiesListSchema';
import ActivityDetail from '@/components/ActivitiesPage/ActivityDetail';

export const ActivitiesDetail = () => {
  const { activity_pk } = useParams<{ activity_pk: string }>();
  const [activity, setActivity] = useState<ActivityDetailsType | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setActivity(null);
    setError(false);
    axiosInstance.get(`/api/activities/${encodeURIComponent(activity_pk || '')}`)
      .then((response) => {
        const parsed = ActivityDetailsType.parse(response.data);
        if (active) setActivity(parsed);
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [activity_pk]);

  if (error) return <p role="alert">Unable to load activity. Please try again.</p>;
  if (!activity) return <p role="status">Loading activity…</p>;
  return <div className="w-screen h-screen overflow-scroll"><ActivityDetail activity={activity} /></div>;
};
