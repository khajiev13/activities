import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export const useAuthNavigation = (shouldNavigate: boolean) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldNavigate) {
      navigate('/login');
    }
  }, [shouldNavigate, navigate]);
};
