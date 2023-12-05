import React, { createContext, useState } from 'react';

interface AuthContextProps {
  isLoggedIn: boolean;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  login: (firstName: string, lastName: string, username: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextProps>({
  isLoggedIn: false,
  firstName: '',
  lastName: '',
  username: '',
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

  const login = (firstName: string, lastName: string, username: string) => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');

    setFirstName(firstName);
    localStorage.setItem('firstName', firstName);

    setLastName(lastName);
    localStorage.setItem('lastName', lastName);

    setUsername(username);
    localStorage.setItem('username', username);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setFirstName('');
    setLastName('');
    setUsername('');

    // Also clear the values from localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('firstName');
    localStorage.removeItem('lastName');
    localStorage.removeItem('username');
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, firstName, lastName, username, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
