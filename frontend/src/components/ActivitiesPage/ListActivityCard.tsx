import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  // CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
// import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  ChevronDownIcon,
  // CircleIcon,
  // PlusIcon,
  BookmarkFilledIcon,
} from '@radix-ui/react-icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, AlarmClock, HashIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import BadgeCityName from '../BadgeCityName';
import { Badge } from '../ui/badge';
import { ActivityCardPropsType } from './ActivitiesListSchema';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { CompetitionDisplay } from '../CompetitionDisplay';
import { ConfirmationAlertModal } from '../ConfirmationAlertModel';
import axiosInstance from '@/axios';
import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { toast } from 'sonner';

type ExtendedActivityCardPropsType = ActivityCardPropsType & {
  className?: string;
};

export const ListActivityCard: React.FC<ExtendedActivityCardPropsType> = (
  props
) => {
  const { username } = useContext(AuthContext);
  const [justJoined, setJustJoined] = React.useState(
    props.people_joined.some((person) => person.username === username)
  );
  const shortDescription =
    props.description.length > 100
      ? `${props.description.substring(0, 97)}...`
      : props.description;

  const joinActivity = () => {
    console.log(
      props.pk,
      props.country.name,
      props.city.name,
      props.state.name
    );
    axiosInstance.post(`/api/activities/${props.pk}/join/`, {}).then((res) => {
      console.log(res.data);
      toast.success('Activity joined successfully');
      setJustJoined(true);
    });
  };
  const leaveActivity = () => {
    axiosInstance.post(`/api/activities/${props.pk}/leave/`, {}).then((res) => {
      console.log(res.data);
      toast.success('Activity left successfully');
      setJustJoined(false);
    });
  };

  return (
    <Card className={`sm:p-0 ${props.className}`} key={props.pk}>
      <CardHeader className="grid grid-cols-[1fr_100px] gap-2 space-y-0 pb-0">
        <HoverCard>
          <HoverCardTrigger>
            <div className="space-y-1">
              <Link to={`/activities/${props.pk}`} className="p-0">
                <CardTitle className="flex items-center gap-3 flex-wrap ">
                  {props.title}{' '}
                  <span className="flex text-sm items-center">
                    <AlarmClock /> {props.duration_in_minutes}
                  </span>{' '}
                  <br />
                  <BadgeCityName
                    cityName={props.state.name + ' ' + props.city.name}
                  />
                </CardTitle>
              </Link>
            </div>
          </HoverCardTrigger>
          {props.competition.team_1.name && props.competition.team_2.name ? (
            <HoverCardContent className="w-full  z-1000 bg-transparent border-none">
              <CompetitionDisplay
                team1={{
                  name: props.competition.team_1.name ?? '',
                  image_url: props.competition.team_1.image_url ?? '',
                }}
                team2={{
                  name: props.competition.team_2.name ?? '',
                  image_url: props.competition.team_2.image_url ?? '',
                }}
              />
            </HoverCardContent>
          ) : (
            <HoverCardContent className="w-80  z-1000">
              <div className="flex justify-between space-x-4">
                <Avatar>
                  <AvatarImage src={props.creator.image_url} />
                  <AvatarFallback>VC</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">
                    @{props.creator.username}
                  </h4>
                  <p className="text-sm">
                    The creator of this activity is{' '}
                    {props.creator.first_name + ' ' + props.creator.last_name}
                  </p>
                </div>
              </div>
            </HoverCardContent>
          )}
        </HoverCard>

        <div className="flex items-start p-0">
          <div>
            {/* Other components */}
            {justJoined ? (
              <ConfirmationAlertModal
                title="Are you sure you want to quit?"
                description="This action cannot be undone."
                onConfirm={leaveActivity}
                buttonComponent={
                  <Button
                    variant="destructive"
                    className="px-3 shadow-none mr-1"
                  >
                    Leave
                  </Button>
                }
              ></ConfirmationAlertModal>
            ) : (
              <ConfirmationAlertModal
                title="Are you sure you want to join?"
                description="This action cannot be undone."
                onConfirm={joinActivity}
                buttonComponent={
                  <Button variant="secondary" className="px-3 shadow-none mr-1">
                    Join Now
                  </Button>
                }
              ></ConfirmationAlertModal>
            )}

            {/* Other components */}
          </div>

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
        <CardDescription className="m-2 my-3">
          {props.public ? 'Public activitiy: ' : 'Private activity'}
          {shortDescription}
        </CardDescription>
        <div className="flex space-x-4 text-sm text-muted-foreground flex-col gap-3">
          <div className="categories flex flex-row gap-1 flex-wrap mx-2">
            {props.categories &&
              props.categories.map((category) => (
                <Badge key={category.pk} className="flex items-center ">
                  <HashIcon className="h-5 w-5" />
                  {category.name}
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
              <Button className="rounded-full w-8 h-8 flex items-center justify-center  font-bold z-40">
                +{props.number_of_people_joined}
              </Button>
            </div>

            <div className="flex gap-4 items-center">
              <CalendarDays />
              {new Date(props.date_time).toLocaleDateString() +
                ' ' +
                new Date(props.date_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListActivityCard;
