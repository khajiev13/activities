// import { Button } from '@/components/ui/button';
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from '@/components/ui/card';
import TeamCard from './TeamCard';
import { TeamType } from '@/pages/Teams/Teams';

type TeamListingCardProps = {
  teams: TeamType[];
};
function TeamListingCard({ teams }: TeamListingCardProps) {
  console.log(teams);
  return (
    <>
      {teams.map((team: TeamType) => (
        <TeamCard
          setUniformColors={(name: string, color: string) => {
            console.log(`Received name: ${name}, color: ${color}`);
          }}
          name={team.name}
          image_url={team.image_url}
          location_name={team.city_name}
          tshirt_color={team.tshirt_color[0].name}
          shorts_color={team.shorts_color[0].name}
          socks_color={team.socks_color[0].name}
          away_tshirt_color={team.away_tshirt_color[0].name}
          color_picker_needed={false}
        />
      ))}
    </>
  );
}

export default TeamListingCard;
