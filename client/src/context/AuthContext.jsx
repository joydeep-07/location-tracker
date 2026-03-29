import React, { createContext, useContext, useState, useEffect } from 'react';
import { ENDPOINTS } from '../endpoints';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch(ENDPOINTS.AUTH.ME, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const loginContext = (userData) => {
    setUser(userData);
  };

  const logoutContext = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginContext, logoutContext }}>
      {children}
    </AuthContext.Provider>
  );
};
