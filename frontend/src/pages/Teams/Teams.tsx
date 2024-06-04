import SearchNavbar from '@/components/SearchNavbar';
import TeamListingCard from '@/components/TeamsPage/TeamListingCard';
import TeamSchema from '../../components/TeamsPage/TeamsListingSchema';
import { useState } from 'react';
import { z } from 'zod';

export type TeamType = z.infer<typeof TeamSchema>;

const Teams: React.FC = () => {
  const [teams, setTeams] = useState<TeamType[]>([]);

  return (
    <>
      <SearchNavbar
        search_for="teams"
        setTeams={(teams: TeamType[]) => setTeams(teams)}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-center items-center -z-10">
        <TeamListingCard teams={teams} />
      </div>
    </>
  );
};

export default Teams;
