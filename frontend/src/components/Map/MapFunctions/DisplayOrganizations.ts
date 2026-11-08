import type * as maptilersdk from '@maptiler/sdk';
import type { OrganizationListingType } from '@/types/OrganizationsListingSchema';

export const displayOrganizations = (
  organizations: OrganizationListingType[],
  map: maptilersdk.Map,
  setSelectedOrganization: (organization: OrganizationListingType) => void,
  setOpen: (open: boolean) => void
): (() => void) => {
  map.addSource('organizations', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: organizations.filter((organization) => { const location = organization.location; return location && Number.isFinite(location.points.longitude) && Number.isFinite(location.points.latitude) && Math.abs(location.points.longitude) <= 180 && Math.abs(location.points.latitude) <= 90; }).map((organization) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [organization.location.points.longitude, organization.location.points.latitude],
        },
        properties: { pk: organization.pk },
      })),
    },
  });
  map.addLayer({
    id: 'organizations', type: 'circle', source: 'organizations',
    paint: { 'circle-radius': 10, 'circle-color': '#EA580B', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' },
  });
  const onClick = (event: maptilersdk.MapMouseEvent) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: ['organizations'] })[0];
    const organization = organizations.find((item) => item.pk === feature?.properties.pk);
    if (organization) {
      setSelectedOrganization(organization);
      setOpen(true);
    }
  };
  map.on('click', 'organizations', onClick);
  return () => {
    map.off('click', 'organizations', onClick);
    if (map.getLayer('organizations')) map.removeLayer('organizations');
    if (map.getSource('organizations')) map.removeSource('organizations');
  };
};
