import TeamSchema from '@/components/TeamsPage/TeamsListingSchema';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import axiosInstance from '@/axios';
import TeamCard from './TeamsPage/TeamCard';
import { DialogClose } from '@radix-ui/react-dialog';
import { Team } from './ActivitiesPage/NewActivityDrawer/IsCompetition';

export type TeamType = z.infer<typeof TeamSchema>;
type Props = {
  setTeamProp?: (team: Team) => void;
};

const SearchTeam = ({ setTeamProp }: Props) => {
  const [teams, setTeams] = useState<TeamType[]>([]);
  let debounceTimer: NodeJS.Timeout;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Send request to backend server
      axiosInstance.get(`/api/teams/search/${value}/`).then((response) => {
        setTeams(response.data);
        console.log(response.data);
      });
    }, 1000); // Wait for 500ms of inactivity before firing
  };

  const setTeam = (team: Team) => {
    if (setTeamProp) {
      setTeamProp(team);
    }
  };

  return (
    <div className="bg-background/95 p-0 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col gap-4 h-96 overflow-auto ">
      <form>
        <Separator />
        <div className="relative mt-3">
          <Search className="absolute left-2 top-2.5 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-8"
            onChange={handleChange}
          />
        </div>
      </form>
      <DialogClose>
        {teams.map((team: TeamType) => (
          <div
            key={team.name}
            className="p-0 m-0"
            onClick={() => setTeam(team)}
          >
            <TeamCard
              name={team.name}
              image_url={team.image_url}
              location_name={team.city_name}
              tshirt_color={team.tshirt_color[0].name}
              shorts_color={team.shorts_color[0].name}
              socks_color={team.socks_color[0].name}
              away_tshirt_color={team.away_tshirt_color[0].name}
              color_picker_needed={false}
            />
          </div>
        ))}
      </DialogClose>
    </div>
  );
};

export default SearchTeam;
