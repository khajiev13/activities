// ExtendedMap.tsx
import React from 'react';
import BaseMap from './BaseMap';
import * as maptilersdk from '@maptiler/sdk';
import { MapControlPanel } from './MapFunctions/MapControlPanel';

const RenderMap: React.FC = () => {
  const handleMapLoad = (map: maptilersdk.Map) => {
    const controlPanel = new MapControlPanel();
    map.addControl(controlPanel, 'top-right');
  };

  return <BaseMap onMapLoad={handleMapLoad} />;
};

export default RenderMap;
