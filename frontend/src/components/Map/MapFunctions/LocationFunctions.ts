// mapFunctions.ts
import * as maptilersdk from '@maptiler/sdk';

export const centerOnLocation = (
  map: React.MutableRefObject<maptilersdk.Map | null>,
  lng: number,
  lat: number,
  zoom: number
) => {
  if (map.current) {
    map.current.flyTo({ center: [lng, lat], zoom: zoom });
  }
};
