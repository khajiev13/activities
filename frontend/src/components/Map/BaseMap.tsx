// BaseMap.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

interface BaseMapProps {
  onMapLoad: (map: maptilersdk.Map) => void;
}

const BaseMap: React.FC<BaseMapProps> = ({ onMapLoad }) => {
  const theme = document.documentElement.classList.contains('light')
    ? 'light'
    : 'dark';
  const mapContainer = useRef(null);

  const map = useRef<maptilersdk.Map | null>(null);
  const beijing = { lat: 39.9042, lng: 116.4074 };
  const [zoom] = useState(14);
  maptilersdk.config.apiKey = 'gZuSG7vpf1He1WQkjERt';
  console.log(theme);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style:
        theme === 'dark'
          ? maptilersdk.MapStyle.BASIC.DARK
          : maptilersdk.MapStyle.BASIC.LIGHT,

      zoom: zoom,
      fullscreenControl: 'top-right',
      navigationControl: false,
      center: [beijing.lng, beijing.lat],
    });

    // Call the onMapLoad prop with the map object
    onMapLoad(map.current);
  }, [beijing.lat, beijing.lng, zoom]);

  return (
    <div
      className="relative w-full h-full min-h-80 p-0 m-0!"
      style={{ height: '100%', padding: 0, margin: 0 }}
    >
      <div
        style={{ padding: 0 }}
        ref={mapContainer}
        className="absolute w-full h-full map p-0 m-0"
      />
    </div>
  );
};

export default BaseMap;
