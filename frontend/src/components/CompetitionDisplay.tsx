'use client';

import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';
import { SelectTeam } from './SelectTeam';
import { Card } from './ui/card';
import { Team } from './ActivitiesPage/NewActivityDrawer/IsCompetition';

type Props = {
  league_name?: string;
  team1?: { name: string; image_url: string; score?: number };
  team2?: { name: string; image_url: string; score?: number };
  setTeam1Prop?: (team: Team) => void;
  setTeam2Prop?: (team: Team) => void;
};

export function CompetitionDisplay({
  league_name,
  team1,
  team2,
  setTeam1Prop,
  setTeam2Prop,
}: Props) {
  return (
    <CardContainer className="inter-var">
      <CardBody className="bg-background relative group/card  dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-background dark:border-white/[0.2] border-black/[0.1] min-w-fit sm:w-[30rem] h-auto rounded-xl p-6 border  ">
        <CardItem
          translateZ="50"
          className="text-xl font-bold text-neutral-600 dark:text-white"
        >
          {league_name ? league_name : 'Match '}
        </CardItem>

        <div className="flex justify-between items-center mt-5">
          <CardItem
            translateZ={100}
            className=" py-2 rounded-xl text-xs font-normal dark:text-white flex-1 min-h-30"
          >
            {/* <SelectTeam /> */}
            <Card className="p-0 m-0 min-h-36 flex justify-center items-center">
              {team1 ? (
                <div className="flex flex-col h-full items-center justify-center p-6 m-0">
                  <img
                    src={team1.image_url}
                    alt="Team picture"
                    height="100"
                    width="100"
                    className="object-contain"
                  />
                  <h3 className="text-base sm:text-sm text-black mt-4 mb-2 dark:text-neutral-200 h-4">
                    {team1.name}
                  </h3>
                </div>
              ) : (
                <SelectTeam setTeamProp={setTeam1Prop ?? (() => {})} />
              )}
            </Card>
          </CardItem>
          <CardItem translateZ={50} className="p-0 m-0">
            {/* <SelectTeam /> */}
            <Card className="border-none ">
              <h3 className=" text-black dark:text-neutral-200 sm:text-5xl text-center">
                {team1?.score && team1.score}:{team2?.score && team2.score}
              </h3>
            </Card>
          </CardItem>
          <CardItem translateZ={100} className="flex-1">
            <Card className="p-0 m-0 min-h-36 flex justify-center items-center">
              {team2 ? (
                <div className="flex flex-col h-full items-center justify-center p-6 m-0">
                  <img
                    src={team2.image_url}
                    alt="Team picture"
                    height="100"
                    width="100"
                    className="object-contain"
                  />
                  <h3 className="text-base sm:text-sm text-black mt-4 mb-2 dark:text-neutral-200 h-4">
                    {team2.name}
                  </h3>
                </div>
              ) : (
                <SelectTeam setTeamProp={setTeam2Prop ?? (() => {})} />
              )}
            </Card>
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
}
