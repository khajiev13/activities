import ListActivityCard from '@/components/ActivitiesPage/ListActivityCard';
import { ActivityCardProps } from '@/components/ActivitiesPage/ListActivityCard';
import { useEffect, useState } from 'react';
import axiosInstance from '@/axios';
import { Skeleton } from '@/components/ui/skeleton';

const Activities = () => {
  const activityCardProps: ActivityCardProps = {
    pk: 1,
    title: 'Beijing Huojian VS Shanghai Shenhua',
    description:
      'Competitive competition between Beijing Huojian VS Shanghai Shenhua',
    isPublic: true,
    participantsCount: 10,
    creatorName: 'John Doe',
    categories: ['category1', 'category2', 'category2'],
    dateTime: '2022-01-01T10:00:00',
    city: 'New York',
    duration: '2 hours',
  };
  const [activities, setActivities] = useState<ActivityCardProps[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/api/activities/');
        setActivities(response.data);
        console.log(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch activities', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ">
      {loading && <Skeleton />}
      <ListActivityCard key={activityCardProps.pk} {...activityCardProps} />
      {/* Map through the activities and display also pagination should be implemented */}
      {activities.map((activity) => (
        <ListActivityCard {...activity} key={activity.pk} />
      ))}
    </div>
  );
};

export default Activities;
