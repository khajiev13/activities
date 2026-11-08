import { useState } from 'react';
import { SelectTeam } from '@/components/SelectTeam';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type Team = { name: string; image_url: string | null; score?: number };
type Props = { setTeam1Prop: (team: string) => void; setTeam2Prop: (team: string) => void; setIsCompetition: (isCompetition: boolean) => void };
export function IsCompetition({ setTeam1Prop, setTeam2Prop, setIsCompetition }: Props) {
  const [first, setFirst] = useState<Team>(); const [second, setSecond] = useState<Team>();
  return <Tabs defaultValue="no" onValueChange={value => setIsCompetition(value === 'yes')} className="w-full min-w-0">
    <p className="text-sm mb-2">Is this activity a competition?</p><TabsList aria-label="Competition"><TabsTrigger value="yes" className="min-h-11">Yes</TabsTrigger><TabsTrigger value="no" className="min-h-11">No</TabsTrigger></TabsList>
    <TabsContent value="yes" className="space-y-4">{([[first, setFirst, setTeam1Prop], [second, setSecond, setTeam2Prop]] as const).map(([team, setTeam, notify], index) => <div key={index} className="rounded-lg border p-3 space-y-2"><p className="font-medium">Team {index + 1}</p>{team ? <><p>{team.name}</p><Button type="button" variant="outline" className="min-h-11" onClick={() => { setTeam(undefined); notify(''); }}>Change team {index + 1}</Button></> : <SelectTeam setTeamProp={value => { setTeam(value); notify(value.name); }} />}</div>)}</TabsContent>
  </Tabs>;
}
