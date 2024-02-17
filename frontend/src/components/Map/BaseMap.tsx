// BaseMap.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { centerOnLocation } from './MapFunctions/LocationFunctions';

interface BaseMapProps {
  onMapLoad: (map: maptilersdk.Map) => void;
}

const BaseMap: React.FC<BaseMapProps> = ({ onMapLoad }) => {
  const theme = document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
  const mapContainer = useRef(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [zoom] = useState(14);
  maptilersdk.config.apiKey = 'gZuSG7vpf1He1WQkjERt';

  useEffect(() => {
    if (theme) {
      document.body.classList.add(theme);
    }
    return () => {
      document.body.classList.remove('light', 'dark');
    };
  }, [theme]);

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
    });

    centerOnLocation(map, 69.2163, 41.2995, zoom);

    // Call the onMapLoad prop with the map object
    onMapLoad(map.current);
  }, [zoom]);

  return (
    <div className="relative w-full h-full min-h-80" style={{ height: '100%' }}>
      <div ref={mapContainer} className="absolute w-full h-full" />
    </div>
  );
};

export default BaseMap;
