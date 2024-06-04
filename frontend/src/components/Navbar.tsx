'use client';

import * as React from 'react';
import { AuthContext } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

import BoyWithSkateboard from '@/assets/pngs/boy_with_skateboard.png';
import UserNav from '@/components/UserNav';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { useNavigate } from 'react-router-dom';
import { SearchCommand } from './SearchCommand';
import MobileNavbar from './MobileNavbar';

const components: { title: string; href: string; description: string }[] = [
  {
    title: 'EventoMap',
    href: '/map',
    description:
      'Discover more on EventoMap. Find events near you or anywhere in the world.',
  },
  {
    title: 'Teams',
    href: '/teams',
    description:
      'Find teams to join or create your own team and invite others to join.',
  },
  {
    title: 'Organizations',
    href: '/organizations',
    description:
      'Find organizations to join or create your own organization and invite others to join.',
  },
];

export default function Navbar() {
  const { isLoggedIn, firstName } = React.useContext(AuthContext);
  const navigate = useNavigate();
  return (
    <>
      <div className="flex h-16 items-center px-4 z-1000">
        <NavigationMenu className="max-w-full min-w-full w-full block ">
          <NavigationMenuList className="flex justify-between w-full min-w-full max-w-full ">
            <MobileNavbar />
            <NavigationMenuItem>
              <div className="relative z-20 flex items-center text-lg font-medium">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-6 w-6"
                >
                  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                </svg>
                Eventopia
              </div>
            </NavigationMenuItem>

            <NavigationMenuItem className="hidden lg:grid">
              <NavigationMenuTrigger
                className="sm:hidden lg:flex "
                onClick={() => navigate('/activities')}
              >
                Activities
              </NavigationMenuTrigger>
              <NavigationMenuContent className="z-1000">
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr] z-1000">
                  <li className="row-span-3 z-1000">
                    <NavigationMenuLink asChild>
                      <a
                        className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md z-1000"
                        href="/"
                        onClick={() => navigate('/')}
                      >
                        <img src={BoyWithSkateboard} alt="BoyWithSkateboard" />
                        <div className="mb-2 mt-4 text-lg font-medium z-1000">
                          Hi {isLoggedIn ? firstName : 'Eventopist'}!
                        </div>
                        <p className="text-sm leading-tight text-muted-foreground z-1000">
                          Choose the type of activities you like on the right!
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                  <ListItem
                    title="Outdoor Activities"
                    onClick={() => navigate('/activities/outdoors')}
                  >
                    Outdoor activities can be football, basketball, tennis, etc.
                  </ListItem>
                  <ListItem
                    title="Indoor Activities"
                    onClick={() => navigate('/activities/indoors')}
                  >
                    Indoor activities can be chess, board games, billiards, etc.
                  </ListItem>
                  <ListItem
                    title="Language Activities"
                    onClick={() => navigate('/activities/language-activities')}
                  >
                    Learning any language can be easy with us!
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem className="hidden md:grid">
              <NavigationMenuTrigger>Components</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                  {components.map((component) => (
                    <ListItem
                      key={component.title}
                      title={component.title}
                      onClick={() => navigate(component.href)}
                    >
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={`${navigationMenuTriggerStyle()}  hidden lg:flex`}
                onClick={() => navigate('/')}
              >
                Home
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className=" hidden lg:flex">
              <SearchCommand />
            </NavigationMenuItem>
            <NavigationMenuList>
              <NavigationMenuItem>
                <ModeToggle />
              </NavigationMenuItem>
              {isLoggedIn ? (
                <NavigationMenuItem>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <UserNav />
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenuItem>
              ) : (
                <>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      className={`${navigationMenuTriggerStyle()} hidden lg:flex`}
                      onClick={() => navigate('/register')}
                    >
                      Signup
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      onClick={() => navigate('/login')}
                      className={`${navigationMenuTriggerStyle()} hidden lg:flex`}
                    >
                      Login
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </>
              )}
            </NavigationMenuList>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
