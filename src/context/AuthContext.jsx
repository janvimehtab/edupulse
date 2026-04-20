import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockLogin, getUserRole } from '../services/firebaseConfig';
import { toast } from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading session from localStorage
    const savedUser = localStorage.getItem('edupulse_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const res = await mockLogin(email, password);
      const userData = await getUserRole(res.user.uid);
      const fullUser = { ...res.user, ...userData };
      setCurrentUser(fullUser);
      localStorage.setItem('edupulse_user', JSON.stringify(fullUser));
      toast.success(`Welcome back, ${fullUser.name}`);
      return fullUser;
    } catch (error) {
      toast.error(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('edupulse_user');
    toast.success('Logged out successfully');
  };

  const value = {
    currentUser,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
