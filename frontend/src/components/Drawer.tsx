import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { DiscoveryEntity } from '@/discovery/types';
import { useOptionalDiscovery } from '@/discovery/DiscoveryContext';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import NewActivityDrawer from '@/components/ActivitiesPage/NewActivityDrawer';
import NewOrganizationDrawer from '@/components/OrganizationsPage/NewOrganizationDrawer';
import NewTeamDrawer from './TeamsPage/NewTeamDrawer';
import { Progress } from './ui/progress';

export function Create({ entity, onCreated }: { entity?: DiscoveryEntity; onCreated?: () => void }) {
  const location = useLocation(); const discovery = useOptionalDiscovery();
  const current = entity ?? (location.pathname.replace(/\/$/, '').slice(1) as DiscoveryEntity);
  const [open, setOpen] = useState(false); const [dirty, setDirty] = useState(false); const [confirm, setConfirm] = useState(false);
  const [progressBar, setProgressBar] = useState(0);
  const label = current === 'teams' ? 'team' : current === 'organizations' ? 'organization' : 'activity';
  function close() { setOpen(false); setDirty(false); setProgressBar(0); }
  function requestOpen(next: boolean) { if (!next && dirty) setConfirm(true); else if (!next) close(); else setOpen(true); }
  function complete() { close(); onCreated?.(); }
  function created() { discovery?.reload(); complete(); }
  return <>
    <Drawer open={open} onOpenChange={requestOpen} shouldScaleBackground dismissible={false}>
      <DrawerTrigger asChild><Button variant="outline" aria-label="Create" className="min-h-11 min-w-11"><Plus className="h-6 w-6" /></Button></DrawerTrigger>
      <DrawerContent className="h-[95dvh] max-h-[95dvh] overflow-hidden">
        <div className="mx-auto w-full max-w-xl min-h-0 flex flex-1 flex-col">
          <DrawerHeader className="shrink-0"><DrawerTitle>Create a new {label}</DrawerTitle><DrawerDescription>Fill in the labeled sections, then create your {label}.</DrawerDescription></DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onChangeCapture={() => setDirty(true)} onClickCapture={event => { if ((event.target as Element).closest('button, [role="switch"], [role="tab"], canvas')) setDirty(true); }}>
            {open && (current === 'teams' ? <NewTeamDrawer setProgressBar={setProgressBar} /> : current === 'organizations' ? <NewOrganizationDrawer setProgressBar={setProgressBar} onCreated={created} /> : <NewActivityDrawer setProgressBar={setProgressBar} onPersisted={discovery?.reload} onCreated={complete} />)}
          </div>
          <DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            {progressBar > 0 && <Progress value={progressBar} aria-label="Creation progress" />}
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => requestOpen(false)}>Close</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><AlertDialogTitle>Discard this draft?</AlertDialogTitle><AlertDialogDescription>Your changes will be lost if you close this form.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel className="min-h-11">Keep editing</AlertDialogCancel><AlertDialogAction className="min-h-11" onClick={() => { setConfirm(false); close(); }}>Discard draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
