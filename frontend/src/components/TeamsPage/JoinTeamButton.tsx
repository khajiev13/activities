import axiosInstance from '@/axios';
import { Button } from '@/components/ui/button';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '../SelectTeam';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  team_name: string;
  onJoined: () => void | Promise<void>;
}

const JoinLeaveTeamButton = ({ team_name, onJoined }: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  async function joinTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    pending.current = true; setLoading(true); setError(false);
    try {
      await axiosInstance.post(`/api/teams/${encodeURIComponent(team_name)}/join/`, {
        name_on_jersey: String(fields.get('name_on_jersey')).trim(),
        player_number: Number(fields.get('player_number')),
        position: fields.get('position'),
      });
      toast.success('You joined the team');
      setOpen(false);
      await onJoined();
    } catch {
      setError(true);
    } finally {
      pending.current = false; setLoading(false);
    }
  }

  const form = (className?: string) => (
    <form className={cn('join-form-scroll grid items-start gap-4', className)} onSubmit={joinTeam}>
      <div className="grid gap-2">
        <Label htmlFor="name_on_jersey">Jersey name</Label>
        <Input className="min-h-12 text-base" id="name_on_jersey" name="name_on_jersey" required pattern=".*\S.*" disabled={loading} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="player_number">Number</Label>
        <Input className="min-h-12 text-base" id="player_number" name="player_number" type="number" min={1} max={99} step={1} required disabled={loading} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="position">Position</Label>
        <select id="position" name="position" required disabled={loading} className="min-h-12 rounded-md border border-input bg-background px-3 text-base">
          <option value="">Choose a position</option>
          {['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map((position) => (
            <option key={position} value={position}>{position}</option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-foreground">Unable to join the team. Please try again.</p>}
      <Button className="min-h-12 w-full text-base" type="submit" disabled={loading}>{loading ? 'Joining…' : 'Join team'}</Button>
    </form>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="min-h-12 w-full text-base" disabled={loading}>Join</Button></DialogTrigger>
        <DialogContent className="join-sheet flex flex-col sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Join {team_name}</DialogTitle>
            <DialogDescription>Choose your jersey name, number and position.</DialogDescription>
          </DialogHeader>
          {form()}
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild><Button className="min-h-12 w-full text-base" disabled={loading}>Join</Button></DrawerTrigger>
      <DrawerContent className="join-sheet mt-0">
        <DrawerHeader className="text-left">
          <DrawerTitle>Join {team_name}</DrawerTitle>
          <DrawerDescription>Choose your jersey name, number and position.</DrawerDescription>
        </DrawerHeader>
        {form('px-4')}
        <DrawerFooter className="pt-2">
          <DrawerClose asChild><Button variant="outline">Cancel</Button></DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
export default JoinLeaveTeamButton;
