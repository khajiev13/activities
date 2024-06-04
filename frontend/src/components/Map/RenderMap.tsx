// ExtendedMap.tsx
import React from 'react';
import BaseMap from './BaseMap';
import * as maptilersdk from '@maptiler/sdk';
import SearchNavbar from '../SearchNavbar';
import { SearchForButtons } from './UI/SearchForButtons';
import { ActivityCardPropsType } from '../ActivitiesPage/ActivitiesListSchema';
import ListActivityCard from '../ActivitiesPage/ListActivityCard';
import { displayActivities } from './MapFunctions/DisplayActivities';
import { TeamType } from '@/pages/Teams/Teams';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { displayTeams } from './MapFunctions/DisplayTeams';
import TeamCard from '../TeamsPage/TeamCard';
// Create a page with other components and display them full screen on the map
const RenderMap: React.FC = () => {
  //Toggle when the user clicks people,activities,organizations or teams
  const [searchFor, setSearchFor] = React.useState('activities');
  const [activities, setActivities] = React.useState<ActivityCardPropsType[]>(
    []
  );
  const [map, setMap] = React.useState<maptilersdk.Map>();
  const [open, setOpen] = React.useState(false);
  const [selectedActivity, setSelectedActivity] = React.useState<
    ActivityCardPropsType | undefined
  >(undefined);
  const [selectedTeam, setSelectedTeam] = React.useState<TeamType | undefined>(
    undefined
  );
  const [teams, setTeams] = React.useState<TeamType[]>([]);

  //Handle the map load
  const handleMapLoad = (map: maptilersdk.Map) => {
    setMap(map);
  };
  React.useEffect(() => {
    if (!map) return;
    // Call displayActivities and store the cleanup function
    console.log(searchFor, activities, teams);
    if (searchFor === 'activities' && activities) {
      setSelectedTeam(undefined);
      const activities_cleanup = displayActivities(
        activities,
        map,
        setSelectedActivity,
        setOpen
      );
      return () => {
        activities_cleanup();
      };
    }
    // Call displayTeams and store the cleanup function
    else if (searchFor === 'teams' && teams) {
      setSelectedActivity(undefined);
      const teams_cleanup = displayTeams(teams, map, setSelectedTeam, setOpen);
      return () => {
        teams_cleanup();
      };
    }

    // Use the cleanup function for cleanup
  }, [searchFor, activities, teams]);

  return (
    <>
      <div className="fixed w-full left-0 top-6 z-1000">
        <SearchNavbar
          setActivities={searchFor === 'activities' ? setActivities : undefined}
          setTeams={searchFor === 'teams' ? setTeams : undefined}
          search_for={searchFor}
        />
      </div>
      <div className="fixed left-0 top-20 flex justify-start z-1000">
        <SearchForButtons setSearchFor={setSearchFor} />
      </div>
      <div className="fixed p-0 m-0 top-0 bottom-0 left-0 right-0 h-screen w-screen z-50">
        <BaseMap onMapLoad={handleMapLoad} />
      </div>
      <Drawer shouldScaleBackground open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex justify-center items-center">
          {/* Display the selected activity card */}
          {selectedActivity && (
            <ListActivityCard
              className="border-none w-1/2"
              {...selectedActivity}
            />
          )}
          {/* Display the selected team */}
          {selectedTeam && (
            <TeamCard
              name={selectedTeam.name}
              image_url={selectedTeam.image_url}
              location_name={selectedTeam.city_name}
              tshirt_color={selectedTeam.tshirt_color[0].name}
              shorts_color={selectedTeam.shorts_color[0].name}
              socks_color={selectedTeam.socks_color[0].name}
              away_tshirt_color={selectedTeam.away_tshirt_color[0].name}
              color_picker_needed={false}
            />
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default RenderMap;
