import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import menuSvg from '@/assets/svgs/menu.svg';

const MobileNavbar = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useContext(AuthContext);
  return (
    <div className="lg:hidden">
      <Sheet key="left">
        <SheetTrigger asChild>
          <Button className="lg:hidden p-0" variant="outline">
            <Image
              className="w-7 h-7 red p-0"
              src={menuSvg}
              alt="Menu icon"
              width={500}
              height={500}
            />
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <NavigationMenu className="max-w-full min-w-full w-full flex flex-col">
            <NavigationMenuList className="flex flex-col justify-between w-full min-w-full max-w-full">
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

              <NavigationMenuItem onClick={() => navigate('/activities')}>
                <Link href="activities/" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Activities
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Home
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              {isLoggedIn ? (
                <NavigationMenuItem></NavigationMenuItem>
              ) : (
                <>
                  <NavigationMenuItem>
                    <Link href="/register" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={navigationMenuTriggerStyle()}
                      >
                        Signup
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Link href="/login" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={navigationMenuTriggerStyle()}
                      >
                        Login
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                </>
              )}
            </NavigationMenuList>
          </NavigationMenu>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileNavbar;
