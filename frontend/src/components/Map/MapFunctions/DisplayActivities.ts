import { ActivityCardPropsType } from '@/components/ActivitiesPage/ActivitiesListSchema';
import * as maptilersdk from '@maptiler/sdk'; // replace with actual import
import pin from '@/assets/pngs/pin.png';

export const displayActivities = (
  activities: ActivityCardPropsType[],
  map: maptilersdk.Map,
  setSelectedActivity: (activity: ActivityCardPropsType) => void,
  setOpen: (open: boolean) => void
): (() => void) => {
  //Check if the image is loaded, if not then load
  if (!map.hasImage('evento_pin')) {
    map.loadImage(pin, function (error, image) {
      if (error) throw error;
      if (image) {
        map.addImage('evento_pin', image);
      } else {
        console.error('Image is not loaded correctly');
      }
    });
  }

  // Convert activities to GeoJSON

  const geojson = {
    type: 'FeatureCollection',
    features: activities.map((activity) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          activity.location.points.longitude,
          activity.location.points.latitude,
        ],
      },
      properties: {
        pk: activity.pk,
      },
    })),
  };
  map.addSource('activities', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14, // Max zoom to cluster points on
    clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
  });

  // Add a new layer to visualize the clusters
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'activities',
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
    id: 'cluster-count',
    type: 'symbol',
    source: 'activities',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
  });
  map.addLayer({
    id: 'unclustered-point',
    type: 'symbol',
    source: 'activities',
    filter: ['!', ['has', 'point_count']],
    // paint: {
    //   'circle-color': '#11b4da',
    //   'circle-radius': 4,
    //   'circle-stroke-width': 9,
    //   'circle-stroke-color': '#fff',
    // },
    layout: {
      'icon-image': 'evento_pin',
      'icon-size': 2,
      'icon-allow-overlap': true,
    },
  });
  // inspect a cluster on click
  map.on('click', 'clusters', function (e) {
    var features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters'],
    });
    var clusterId = features[0].properties.cluster_id;
    console.log(clusterId);
    console.log(features);
    const source = map.getSource('activities') as maptilersdk.GeoJSONSource;
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

  map.on('click', 'unclustered-point', function (e: maptilersdk.MapMouseEvent) {
    const features = map.queryRenderedFeatures(e.point);
    if (features.length > 0) {
      const pk = features[0].properties.pk;
      const activity = activities.find((activity) => activity.pk === pk);
      if (activity) {
        setSelectedActivity(activity);
        setOpen(true);
      }
    }
  });

  return () => {
    if (map.getLayer('clusters')) {
      map.removeLayer('clusters');
    }

    if (map.getLayer('cluster-count')) {
      map.removeLayer('cluster-count');
    }

    if (map.getLayer('unclustered-point')) {
      map.removeLayer('unclustered-point');
    }

    if (map.getSource('activities')) {
      map.removeSource('activities');
    }
  };
};
