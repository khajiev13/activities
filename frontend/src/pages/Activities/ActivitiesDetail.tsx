import axiosInstance from '@/axios';
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
// import { WobbleCard } from '@/components/ui/wobble-card';
import { ActivityDetailsType } from '@/types/ActivitiesListSchema.ts';
import { useState } from 'react';
import ActivityDetail from '@/components/ActivitiesPage/ActivityDetail';




export const ActivitiesDetail = () => {
  const [activity, setActivity] = useState<ActivityDetailsType>();
  const { activity_pk } = useParams<{ activity_pk: string }>();
  useEffect(() => {
    axiosInstance
      .get(`/api/activities/${activity_pk}`)
      .then((response) => {
        // handle the response

        setActivity(response.data);
      })
      .catch(() => {
        // Keep failed requests out of the console.
      });
  }, []);

  return (
    <>
    <div className='w-screen h-screen overflow-scroll'>      
      <ActivityDetail />
    </div>
      
    </>
  );
};
