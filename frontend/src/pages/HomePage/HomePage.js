import React, { useEffect } from 'react';
import axiosInstance from '../../axios';

const HomePage = () => {
  useEffect(() => {
    axiosInstance
      .get('api/colors/')
      .then((response) => {
        console.log('Success getting colors:', response.data);
        // Handle the colors here...
      })
      .catch((error) => {
        console.error('Error getting colors:', error);
      });
  }, []);

  return <div>Hi, this is the homepage...</div>;
};

export default HomePage;
