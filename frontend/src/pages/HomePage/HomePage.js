import React, { useEffect } from 'react';
import axiosInstance from '../../axios';
import Logout from '../../components/Logout';

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

  return <>
  <div className=''>Hi, this is the homepage...</div>
  <Logout />
  </> 
};

export default HomePage;
