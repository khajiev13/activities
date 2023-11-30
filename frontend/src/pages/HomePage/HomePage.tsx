import { useEffect } from 'react';
import axiosInstance from '../../axios';
import Logout from '../../components/Logout';
import { useNavigate } from 'react-router-dom';
const HomePage = () => {
  const navigate = useNavigate();
  // Firstly check if the user is logged in.
  const checkIfHasTokens = () => {
    const access_token = localStorage.getItem('access_token');
    const refresh_token = localStorage.getItem('refresh_token');
    if (access_token && refresh_token) {
      return true;
    } else {
      return false;
    }
  };

  const fetchActivities = () => {
    axiosInstance
      .get('api/teams/')
      .then((response) => {
        console.log('Success getting activities:', response.data);
        // Handle the activities here...
      })
      .catch((error) => {
        console.error('Error getting activities:', error);
      });
  };
  checkIfHasTokens();
  useEffect(() => {
    const tokens = checkIfHasTokens();
    if (tokens) {
      fetchActivities();
    } else {
      navigate('/login');
    }
  }, []);

  return (
    <>
      <div className="">Hi, this is the homepage...</div>
      <Logout />
    </>
  );
};

export default HomePage;
