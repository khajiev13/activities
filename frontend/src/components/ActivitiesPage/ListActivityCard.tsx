import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDownIcon,
  CircleIcon,
  PlusIcon,
  BookmarkFilledIcon,
} from '@radix-ui/react-icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { HashIcon, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ActivityCardProps {
  id: number;
  title: string;
  description: string;
  isPublic: boolean;
  participantsCount: number;
  creatorName: string;
  categories: string[];
  dateTime: string;
  city: string;
  duration: string;
}

export const ListActivityCard: React.FC<ActivityCardProps> = ({
  id,
  title,
  description,
  isPublic,
  participantsCount,
  creatorName,
  categories,
  dateTime,
  city,
  duration,
}) => {
  const shortDescription =
    description.length > 100
      ? `${description.substring(0, 97)}...`
      : description;

  return (
    <Card className="sm:p-0">
      <CardHeader className="grid grid-cols-[1fr_100px] gap-2 space-y-0 pb-0">
        <div className="space-y-1">
          <Link to={`/activities/${id}`} className="p-0">
            <CardTitle className="flex items-center gap-3 flex-wrap ">
              {title}
              <Badge variant="secondary" className="flex justify-center ">
                <MapPin className=" h-6 w-6 gap-3" /> Tashkent
              </Badge>
            </CardTitle>
          </Link>
        </div>
        <div className="flex items-start p-0">
          <Button variant="secondary" className="px-3 shadow-none ">
            <PlusIcon className="mr-2 h-6 w-6" />
            Join
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="px-2 shadow-none">
                <ChevronDownIcon className="h-4 w-4 text-secondary-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              alignOffset={-5}
              className="w-[200px]"
              forceMount
            >
              <DropdownMenuLabel>Suggested Lists</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>
                Future Ideas
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>My Stack</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Inspiration</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <BookmarkFilledIcon className="mr-2 h-4 w-4" /> Add to bookmark
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{shortDescription}</CardDescription>
        <div className="flex space-x-4 text-sm text-muted-foreground flex-col gap-3">
          <div className="categories flex flex-row gap-1 flex-wrap">
            {categories &&
              categories.map((category) => (
                <Badge className="flex items-center ">
                  <HashIcon className="h-5 w-5" />
                  {category}
                </Badge>
              ))}
          </div>

          <div className="flex flex-row justify-between items-center !mx-0">
            <div className="flex -space-x-4 rtl:space-x-reverse">
              <Avatar className="border-2 w-8 h-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 w-8 h-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 w-8 h-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 w-8 h-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar className="border-2 w-8 h-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Button className="rounded-full w-8 h-8 flex items-center justify-center  font-bold z-50">
                +10 {/*  Participants count */}
              </Button>
            </div>

            <div>Updated April 2023</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListActivityCard;
