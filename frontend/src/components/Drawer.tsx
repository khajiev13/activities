import type { DiscoveryEntity } from '@/discovery/types';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useLocation } from 'react-router-dom';
import NewActivityDrawer from '@/components/ActivitiesPage/NewActivityDrawer';
import { Progress } from './ui/progress';
import { useState } from 'react';
import NewOrganizationDrawer from '@/components/OrganizationsPage/NewOrganizationDrawer';
import NewTeamDrawer from './TeamsPage/NewTeamDrawer';

export function Create({ entity }: { entity?: DiscoveryEntity }) {
  const location = useLocation();
  const formPath = entity ? `/${entity}` : location.pathname;

  const [open, setOpen] = useState(false);
  const [progressBar, setProgressBar] = useState<number>(0);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground dismissible={false}>
      <DrawerTrigger asChild>
        <Button variant="outline" aria-label="Create">
          <Plus className="h-8 w-8" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[95vh] overflow-y-hidden">
        <div className="mx-auto w-full max-w-xl">
          <DrawerHeader>
            <DrawerTitle>
              {formPath === '/activities'
                ? 'Create a new activity'
                : formPath === '/teams'
                ? 'Create a new team'
                : formPath === '/organizations'
                ? 'Create a new organization'
                : null}
            </DrawerTitle>
            <DrawerDescription>
              {formPath === '/activities'
                ? "It's going to take few steps. Swipe right for the next step!"
                : formPath === '/teams'
                ? 'Fill in the forms to create a new team! Scroll down as you fill in the forms!'
                : formPath === '/organizations'
                ? 'Fill in the forms to create a new team! Scroll down as you fill in the forms!'
                : null}
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[700px]">
            {['/activities', '/activities/'].includes(formPath) ? (
              <NewActivityDrawer setProgressBar={setProgressBar} />
            ) : ['/teams', '/teams/'].includes(formPath) ? (
              <>
                <Progress className="mb-4" value={progressBar} />
                <NewTeamDrawer setProgressBar={setProgressBar} />
              </>
            ) : ['/organizations', '/organizations/'].includes(
                formPath
              ) ? (
              <>
                <Progress value={progressBar} />
                <NewOrganizationDrawer setProgressBar={setProgressBar} onCreated={() => setOpen(false)} />
              </>
            ) : null}
          </div>
          {/* If it's activiites page then we would like to display the progress bar at the bottom */}
          {['/activities', '/activities/'].includes(formPath) ? (
            <DrawerFooter>
              <Progress
                className=" sm:w-[300px] md:w-[535px]"
                value={progressBar}
              />
              <DrawerClose asChild className="w-full">
                <Button variant={'outline'} className="w-full">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          ) : (
            <DrawerFooter>
              <DrawerClose asChild className="w-full">
                <Button variant={'outline'} className="w-full">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
