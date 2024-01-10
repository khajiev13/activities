import ListActivityCard from '@/components/ActivitiesPage/ListActivityCard';
import { ActivityCardProps } from '@/components/ActivitiesPage/ListActivityCard';

const Activities = () => {
  const activityCardProps: ActivityCardProps = {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-12">
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
      <ListActivityCard {...activityCardProps} />
    </div>
  );
};

export default Activities;
