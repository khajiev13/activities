import ListActivityCard from '@/components/ActivitiesPage/ListActivityCard';
import { ActivityCardPropsType } from '@/components/ActivitiesPage/ActivitiesListSchema';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import SearchNavbar from '@/components/SearchNavbar';
import { ScrollArea } from '@/components/ui/scroll-area';

const Activities = () => {
  const [activities, setActivities] = useState<ActivityCardPropsType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  return (
    <>
      <SearchNavbar
        search_for="activities"
        setActivities={(activities: ActivityCardPropsType[]) => {
          setActivities([]);
          setActivities(activities);
        }}
        setLoading={(loading: boolean) => setLoading(loading)}
      />
      <ScrollArea className="h-[680px] rounded-md border-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-none">
          {loading && (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          )}
          {/* Map through the activities and display also pagination should be implemented */}
          {activities.map((activity) => (
            <ListActivityCard {...activity} key={activity.pk} />
          ))}
        </div>
      </ScrollArea>
    </>
  );
};

export default Activities;
