'use client';

import * as React from 'react';
import Link from 'next/link';
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

// const components: { title: string; href: string; description: string }[] = [
//   {
//     title: 'Alert Dialog',
//     href: '/docs/primitives/alert-dialog',
//     description:
//       'A modal dialog that interrupts the user with important content and expects a response.',
//   },
//   {
//     title: 'Hover Card',
//     href: '/docs/primitives/hover-card',
//     description:
//       'For sighted users to preview content available behind a link.',
//   },
//   {
//     title: 'Progress',
//     href: '/docs/primitives/progress',
//     description:
//       'Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.',
//   },
//   {
//     title: 'Scroll-area',
//     href: '/docs/primitives/scroll-area',
//     description: 'Visually or semantically separates content.',
//   },
//   {
//     title: 'Tabs',
//     href: '/docs/primitives/tabs',
//     description:
//       'A set of layered sections of content—known as tab panels—that are displayed one at a time.',
//   },
//   {
//     title: 'Tooltip',
//     href: '/docs/primitives/tooltip',
//     description:
//       'A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.',
//   },
// ];

export default function Navbar() {
  const { isLoggedIn, firstName } = React.useContext(AuthContext);
  const navigate = useNavigate();
  return (
    <>
      <div className="flex h-16 items-center px-4">
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
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        href="/"
                      >
                        <img src={BoyWithSkateboard} alt="BoyWithSkateboard" />
                        <div className="mb-2 mt-4 text-lg font-medium">
                          Hi {isLoggedIn ? firstName : 'Eventopist'}!
                        </div>
                        <p className="text-sm leading-tight text-muted-foreground">
                          Choose the type of activities you like on the right!
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                  <ListItem
                    href="/activities/outdoors"
                    title="Outdoor Activities"
                  >
                    Outdoor activities can be football, basketball, tennis, etc.
                  </ListItem>
                  <ListItem
                    href="/activities/indoors"
                    title="Indoor Activities"
                  >
                    Indoor activities can be chess, board games, billiards, etc.
                  </ListItem>
                  <ListItem
                    href="/activities/language-activities"
                    title="Language Activities"
                  >
                    Learning any language can be easy with us!
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            {/* <NavigationMenuItem>
          <NavigationMenuTrigger>Components</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
              {components.map((component) => (
                <ListItem
                  key={component.title}
                  title={component.title}
                  href={component.href}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem> */}
            <NavigationMenuItem>
              <Link
                href="/"
                legacyBehavior
                passHref
                className="sm:hidden lg:flex"
              >
                <NavigationMenuLink
                  className={`${navigationMenuTriggerStyle()}  hidden lg:flex`}
                >
                  Home
                </NavigationMenuLink>
              </Link>
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
                    <Link href="/register" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={`${navigationMenuTriggerStyle()} hidden lg:flex`}
                      >
                        Signup
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Link href="/login" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={`${navigationMenuTriggerStyle()} hidden lg:flex`}
                      >
                        Login
                      </NavigationMenuLink>
                    </Link>
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
