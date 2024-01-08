import React, { createContext, useState } from 'react';

interface AuthContextProps {
  isLoggedIn: boolean;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl?: string | null;
  login: (
    firstName: string,
    lastName: string,
    username: string,
    imageUrl: string | null
  ) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextProps>({
  isLoggedIn: false,
  firstName: '',
  lastName: '',
  username: '',
  imageUrl: '',
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    localStorage.getItem('isLoggedIn') === 'true'
  );
  const [firstName, setFirstName] = useState<string | null>(
    localStorage.getItem('firstName')
  );
  const [lastName, setLastName] = useState<string | null>(
    localStorage.getItem('lastName')
  );
  const [username, setUsername] = useState<string | null>(
    localStorage.getItem('username')
  );
  const [imageUrl, setImageUrl] = useState<string>(
    localStorage.getItem('imageUrl') || ''
  );

  const login = (
    firstName: string,
    lastName: string,
    username: string,
    imageUrl: string | null
  ) => {
    setIsLoggedIn(true);
    setFirstName(firstName);
    setLastName(lastName);
    setUsername(username);
    setImageUrl(imageUrl || ''); // if imageUrl is null, set it to an empty string

    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('firstName', firstName);
    localStorage.setItem('lastName', lastName);
    localStorage.setItem('username', username);
    localStorage.setItem('imageUrl', imageUrl || ''); // if imageUrl is null, set it to an empty string
  };

  const logout = () => {
    setIsLoggedIn(false);
    setFirstName('');
    setLastName('');
    setUsername('');
    setImageUrl('');

    // Also clear the values from localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('firstName');
    localStorage.removeItem('lastName');
    localStorage.removeItem('username');
    localStorage.removeItem('imageUrl');
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        firstName,
        lastName,
        username,
        imageUrl,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
