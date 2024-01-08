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
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import axiosInstance from '@/axios';
import {
  Bookmark,
  CircleUserRound,
  LogOutIcon,
  PersonStandingIcon,
  Settings,
} from 'lucide-react';

export default function UserNav() {
  const { firstName, lastName, username, imageUrl } = useContext(AuthContext);
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  const user_logout = async () => {
    try {
      const response = await axiosInstance.post(
        'api/users/token/logout-blacklist/',
        {
          refresh_token: localStorage.getItem('refresh_token'),
        }
      );
      console.log(response);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      axiosInstance.defaults.headers['Authorization'] = null;
      // Delete the values inside the Context
      logout();
      // Navigate the user to login page
      navigate('/login');
    } catch (err) {
      console.log(err);
      navigate('/login');
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    user_logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              className=""
              src={imageUrl ? imageUrl : 'link'}
              alt="@shadcn"
            />
            <AvatarFallback>
              {firstName && lastName ? firstName[0] + lastName[0] : 'ES'}
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
