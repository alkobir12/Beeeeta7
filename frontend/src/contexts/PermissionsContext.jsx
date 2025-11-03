import React, { createContext, useContext, useState, useEffect } from 'react';

const PermissionsContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    return {
      permissions: {},
      user: null,
      hasPermission: () => false
    };
  }
  return context;
};

export const PermissionsProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    // Load user and permissions from session
    try {
      const session = JSON.parse(localStorage.getItem('session') || '{}');
      setUser(session);
      setPermissions(session.permissions || {});
    } catch (e) {
      console.error('Error loading session:', e);
    }
  }, []);

  const hasPermission = (permissionKey) => {
    // Admin has all permissions
    if (user?.role === 'admin') return true;
    
    return permissions[permissionKey] === true;
  };

  const canAccess = (permissionKey) => {
    return hasPermission(permissionKey);
  };

  return (
    <PermissionsContext.Provider value={{ user, permissions, hasPermission, canAccess }}>
      {children}
    </PermissionsContext.Provider>
  );
};
