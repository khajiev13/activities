import TeamListingCard from '@/components/TeamsPage/TeamListingCard';
import React from 'react';

const Teams: React.FC = () => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ">
        <TeamListingCard />
      </div>
    </>
  );
};

export default Teams;
