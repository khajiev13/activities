import * as maptilersdk from '@maptiler/sdk';
import team_icon from '@/assets/pngs/team_icon.png';
import { TeamType } from '@/pages/Teams/Teams';

export const displayTeams = (
  teams: TeamType[],
  map: maptilersdk.Map,
  setSelectedTeam: (team: TeamType) => void,
  setOpen: (open: boolean) => void
): (() => void) => {
  // Check if the image is loaded, if not then load
  if (!map.hasImage('team_icon')) {
    map.loadImage(team_icon, function (error, image) {
      if (error) throw error;
      if (image) {
        map.addImage('team_icon', image);
      } else {
        console.error('Image not loaded correctly');
      }
    });
  }

  // Convert teams to GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    features: teams.map((team) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          team.location[0].points.longitude,
          team.location[0].points.latitude,
        ],
      },
      properties: {
        name: team.name,
        icon: 'team_icon',
      },
    })),
  };

  map.addSource('teams', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  // Add a new layer to visualize the clusters
  map.addLayer({
    id: 'teams_clusters',
    type: 'circle',
    source: 'teams',
    filter: ['has', 'point_count'],
    paint: {
      // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
      // with three steps to implement three types of circles:
      //   * Blue, 20px circles when point count is less than 100
      //   * Yellow, 30px circles when point count is between 100 and 750
      //   * Pink, 40px circles when point count is greater than or equal to 750
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#EA580B',
        20,
        '#51bbd6',
        100,
        '#f1f075',
        750,
        '#f28cb1',
      ],
      'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
    },
  });

  // Add a layer for the clusters' count labels
  map.addLayer({
    id: 'teams_cluster_count',
    type: 'symbol',
    source: 'teams',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
  });
  // inspect a cluster on click
  map.on('click', 'teams_clusters', function (e) {
    var features = map.queryRenderedFeatures(e.point, {
      layers: ['teams_clusters'],
    });
    var clusterId = features[0].properties.cluster_id;
    console.log(clusterId);
    console.log(features);
    const source = map.getSource('teams') as maptilersdk.GeoJSONSource;
    source.getClusterExpansionZoom(clusterId, function (err, zoom) {
      //Set the zoom and center to the cluster

      var coordinates = (features[0].geometry as GeoJSON.Point).coordinates;
      if (err || !zoom) return;
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        const center: [number, number] = [coordinates[0], coordinates[1]];
        map.easeTo({
          center: center,
          zoom: zoom,
        });
      }
    });
  });

  // Add a new layer for the team markers
  map.addLayer({
    id: 'teams',
    type: 'symbol',
    source: 'teams',
    layout: {
      'icon-image': '{icon}',
      'icon-size': 1,
      'icon-allow-overlap': true,
    },
  });

  // Setup click handler to open a popup or details pane
  map.on('click', 'teams', function (e) {
    const features = map.queryRenderedFeatures(e.point, { layers: ['teams'] });
    if (!features.length) return;

    const team = teams.find(
      (team) => team.name === features[0].properties.name
    );
    if (team) {
      setSelectedTeam(team);
      setOpen(true);
    }
  });

  return () => {
    if (map.getLayer('teams')) map.removeLayer('teams');
    if (map.getLayer('teams_clusters')) map.removeLayer('teams_clusters');
    if (map.getLayer('teams_cluster_count'))
      map.removeLayer('teams_cluster_count');
    if (map.getSource('teams')) map.removeSource('teams');
  };
};
