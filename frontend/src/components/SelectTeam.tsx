import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import SearchTeam from './SearchTeam';
import { Team } from './ActivitiesPage/NewActivityDrawer/IsCompetition';

type Props = {
  setTeamProp: (team: Team) => void;
};

export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false);

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener('change', onChange);
    setValue(result.matches);

    return () => result.removeEventListener('change', onChange);
  }, [query]);

  return value;
}

export function SelectTeam({ setTeamProp }: Props) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Choose a team</Button>
        </DialogTrigger>
        <DialogContent className="bg-transparent border-none ">
          <DialogHeader>
            <DialogTitle>Choose a team</DialogTitle>
            <DialogDescription>
              Search for the team and just click on it.
            </DialogDescription>
          </DialogHeader>
          <SearchTeam setTeamProp={setTeamProp} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Select a team</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Choose a team</DrawerTitle>
          <DrawerDescription>
            Please search for the team and just click on it.
          </DrawerDescription>
        </DrawerHeader>
        <SearchTeam setTeamProp={setTeamProp} />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
