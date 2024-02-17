// SelectLocation.tsx
import React, { useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import BaseMap from './BaseMap';
import * as maptilersdk from '@maptiler/sdk';
import lottie from 'lottie-web';
import animationDataLocationPin from '../../illustrations/location-pin.json';
import { SubmitLocation } from './SelectLocation/SubmitLocation';
import { AddLocation } from './MapFunctions/AddLocation';
import { LocationDetails } from './MapFunctions/AddLocation';

type SelectLocationProps = {
  setLocation: (location: LocationDetails) => void;
};

const SelectLocation: React.FC<SelectLocationProps> = ({ setLocation }) => {
  const markerRef = useRef<maptilersdk.Marker | null>(null);
  const popupRef = useRef<maptilersdk.Popup | null>(null);

  const handleMapLoad = (map: maptilersdk.Map) => {
    map.on('click', (e) => {
      // Remove the existing marker and popup
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (popupRef.current) {
        popupRef.current.remove();
      }

      // Create a new div for the marker
      const markerDiv = document.createElement('div');
      markerDiv.style.width = '40px';
      markerDiv.style.height = '40px';

      // Load the Lottie animation
      lottie.loadAnimation({
        container: markerDiv, // the dom element that will contain the animation
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: animationDataLocationPin, // the path to the animation json
      });
      // Add a new marker at the clicked location
      markerRef.current = new maptilersdk.Marker({ element: markerDiv })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(map);

      // Add a new popup at the clicked location
      const PopupContent = <SubmitLocation />;
      const html = ReactDOMServer.renderToString(PopupContent);
      popupRef.current = new maptilersdk.Popup({
        offset: [0, -25],
        className: 'bg-transparent rounded-xl mr-0 p-0',
      })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .setHTML(html)
        .addTo(map);
      // Style the popup
      popupRef.current._content.style.backgroundColor = 'transparent';
      popupRef.current._content.style.borderRadius = '25px';
      popupRef.current._content.style.padding = '0';
      // Add the event listener
      const form = document.getElementById('location-form');
      const input = document.getElementById(
        'location-input'
      ) as HTMLInputElement;
      const button = document.getElementById(
        'location-submit'
      ) as HTMLButtonElement;
      const loader = document.querySelector('#spinner-loading') as HTMLElement;
      if (form && input && button && loader) {
        // We are going to submit the selected location to the server input.value is our name and we have the coordinates from e.lngLat.lng and e.lngLat.lat
        form.addEventListener('submit', async (event) => {
          event.preventDefault();

          // Show the loader and disable the button
          loader.classList.remove('hidden');
          button.disabled = true;
          //Add the location to the server and it returns country_name, state_name, city_name, location_name and location_pk
          const {
            country,
            state,
            city,
            location_name,
            location_pk,
            sunrise,
            sunset,
            country_code,
            timezone,
          } = await AddLocation(input.value, e.lngLat.lng, e.lngLat.lat);

          //Now let's set the location details and make it available to the parent component
          const location: LocationDetails = {
            country,
            state,
            city,
            location_name,
            location_pk,
            sunrise,
            sunset,
            country_code,
            timezone,
          };
          setLocation(location);
        });
      }
    });
  };

  return <BaseMap onMapLoad={handleMapLoad} />;
};

export default SelectLocation;
