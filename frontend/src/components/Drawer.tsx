import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { DiscoveryEntity } from '@/discovery/types';
import { useOptionalDiscovery } from '@/discovery/DiscoveryContext';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from './ui/progress';

const NewActivityDrawer = lazy(() => import('@/components/ActivitiesPage/NewActivityDrawer'));
const NewOrganizationDrawer = lazy(() => import('@/components/OrganizationsPage/NewOrganizationDrawer'));
const NewTeamDrawer = lazy(() => import('./TeamsPage/NewTeamDrawer'));

class CreateFormBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="space-y-3 p-4">
      <p role="alert">Could not load this form. Close it or reload to try again.</p>
      <Button type="button" className="min-h-11" onClick={() => window.location.reload()}>Reload form</Button>
    </div>;
    return this.props.children;
  }
}

export function Create({ entity, onCreated }: { entity?: DiscoveryEntity; onCreated?: () => void }) {
  const location = useLocation(); const discovery = useOptionalDiscovery();
  const current = entity ?? (location.pathname.replace(/\/$/, '').slice(1) as DiscoveryEntity);
  const [open, setOpen] = useState(false); const [dirty, setDirty] = useState(false); const [confirm, setConfirm] = useState(false);
  const [progressBar, setProgressBar] = useState(0);
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || !sheet) return;
    const scroller = sheet.querySelector<HTMLElement>('.create-form-scroll');
    let submit: HTMLElement | null = null;
    let previousHeight = 0;
    const update = () => {
      const next = sheet.querySelector<HTMLElement>('[data-create-submit]');
      if (next !== submit) {
        if (submit) observer.unobserve(submit);
        submit = next;
        if (submit) observer.observe(submit);
      }
      const height = sheet.getBoundingClientRect().height;
      sheet.dataset.short = String(height <= 400);
      scroller?.style.setProperty('--create-submit-height', `${submit?.getBoundingClientRect().height ?? 0}px`);
      if (height !== previousHeight && document.activeElement instanceof HTMLElement && document.activeElement.matches('input, textarea, select') && sheet.contains(document.activeElement)) {
        document.activeElement.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
      previousHeight = height;
    };
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    const contents = new MutationObserver(update);
    if (scroller) contents.observe(scroller, { childList: true, subtree: true });
    update();
    return () => { observer.disconnect(); contents.disconnect(); };
  }, [open, sheet]);
  const label = current === 'teams' ? 'team' : current === 'organizations' ? 'organization' : 'activity';
  function close() { setOpen(false); setDirty(false); setProgressBar(0); }
  function requestOpen(next: boolean) { if (!next && dirty) setConfirm(true); else if (!next) close(); else setOpen(true); }
  function complete() { close(); onCreated?.(); }
  return <>
    <Drawer open={open} onOpenChange={requestOpen} shouldScaleBackground dismissible={false}>
      <DrawerTrigger asChild><Button variant="outline" aria-label="Create" className="min-h-11 min-w-11"><Plus className="h-6 w-6" /></Button></DrawerTrigger>
      <DrawerContent ref={setSheet} className="create-sheet overflow-hidden">
        <div className="mx-auto w-full max-w-xl min-h-0 flex flex-1 flex-col">
          <DrawerHeader className="shrink-0"><DrawerTitle>Create a new {label}</DrawerTitle><DrawerDescription>Fill in the labeled sections, then create your {label}.</DrawerDescription></DrawerHeader>
          <div className="create-form-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain" onChangeCapture={() => setDirty(true)} onClickCapture={event => { if ((event.target as Element).closest('button, [role="switch"], [role="tab"], canvas')) setDirty(true); }}>
            {open && <CreateFormBoundary>
              <Suspense fallback={<p role="status" className="p-4">Loading {label} form…</p>}>
                {current === 'teams' ? <NewTeamDrawer setProgressBar={setProgressBar} onPersisted={discovery?.reload} onCreated={complete} /> : current === 'organizations' ? <NewOrganizationDrawer setProgressBar={setProgressBar} onPersisted={discovery?.reload} onCreated={complete} /> : <NewActivityDrawer setProgressBar={setProgressBar} onPersisted={discovery?.reload} onCreated={complete} />}
              </Suspense>
            </CreateFormBoundary>}
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
