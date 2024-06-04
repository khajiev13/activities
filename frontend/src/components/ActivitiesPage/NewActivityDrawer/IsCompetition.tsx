import { CompetitionDisplay } from '@/components/CompetitionDisplay';
import { FormLabel } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

export type Team = {
  name: string;
  image_url: string;
  score?: number;
};

type Props = {
  setTeam1Prop: (team: string) => void;
  setTeam2Prop: (team: string) => void;
  setIsCompetition: (isCompetition: boolean) => void;
};

export const IsCompetition = ({
  setTeam1Prop,
  setTeam2Prop,
  setIsCompetition,
}: Props) => {
  const [team1, setTeam1] = useState<Team | undefined>(undefined);
  const [team2, setTeam2] = useState<Team | undefined>(undefined);
  return (
    <Tabs defaultValue="organization" className="w-full">
      <div className="flex items-center mt-4 w-full p-0 m-0">
        <FormLabel>Is this activity a competition?</FormLabel>
        <TabsList className="ml-auto">
          <TabsTrigger
            value="yes"
            className="text-zinc-600 dark:text-zinc-200"
            onClick={() => {
              setIsCompetition(true);
            }}
          >
            Yes
          </TabsTrigger>
          <TabsTrigger
            value="no"
            className="text-zinc-600 dark:text-zinc-200"
            onClick={() => {
              setIsCompetition(false);
            }}
          >
            No
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent className="p-0 m-0" value="yes">
        <CompetitionDisplay
          team1={team1}
          team2={team2}
          league_name="Beijing International Friendly Leaugue"
          setTeam1Prop={(team: Team) => {
            setTeam1Prop(team.name);
            setTeam1(team);
          }}
          setTeam2Prop={(team: Team) => {
            setTeam2Prop(team.name);
            setTeam2(team);
          }}
        />
      </TabsContent>
    </Tabs>
  );
};
