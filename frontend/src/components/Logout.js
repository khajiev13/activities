import React from 'react';
import axiosInstance from '../axios';

export default function Logout() {
  const logout = () => {
    axiosInstance.post('api/users/token/logout-blacklist/', {
      refresh_token: localStorage.getItem('refresh_token'),
    });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    axiosInstance.defaults.headers['Authorization'] = null;
  };

  return <button className='bg-maincolor text-white' onClick={logout}>Logout</button>;
}