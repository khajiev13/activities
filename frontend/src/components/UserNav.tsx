import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContext } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import {
  Bookmark,
  CircleUserRound,
  LogOutIcon,
  PersonStandingIcon,
  Settings,
} from 'lucide-react';

export default function UserNav() {
  const { user, logout } = useContext(AuthContext);
  const firstName = user?.first_name;
  const lastName = user?.last_name;
  const username = user?.username;
  const imageUrl = user?.image_url;
  const navigate = useNavigate();
  const user_logout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Unable to end the server session', {
        description: 'You are signed out on this page, but the server session may still be active. Retry before leaving this device.',
        duration: Infinity,
        action: { label: 'Retry logout', onClick: () => { void user_logout(); } },
      });
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    user_logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="User menu" variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              className=""
              src={imageUrl || undefined}
              alt={username || 'User'}
            />
            <AvatarFallback>
              {((firstName?.[0] || '') + (lastName?.[0] || '') || username?.slice(0, 2) || 'ES').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {firstName} {lastName}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {username}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <CircleUserRound className="mr-2 h-5 w-5" />
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bookmark className="mr-2 h-5 w-5" />
            Bookmark
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-5 w-5" />
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <PersonStandingIcon className="mr-2 h-5 w-5" />
            New Team
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleClick}>
            <LogOutIcon className="mr-2 h-5 w-5" />
            Logout
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
