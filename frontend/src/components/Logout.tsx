import React, { MouseEvent } from 'react';
import axiosInstance from '../axios';
import { useNavigate } from 'react-router-dom';

const Logout: React.FC = () => {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await axiosInstance.post('api/users/token/logout-blacklist/', {
        refresh_token: localStorage.getItem('refresh_token'),
      });
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      axiosInstance.defaults.headers['Authorization'] = null;
      navigate('/login');
    } catch (err) {
      console.log(err);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    logout();
  };

  return (
    <>
      <button className="bg-maincolor text-white" onClick={handleClick}>
        Logout
      </button>
    </>
  );
};

export default Logout;
