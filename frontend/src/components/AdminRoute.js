import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    // Not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    // Logged in but not admin, redirect to appropriate dashboard
    const dashboards = {
      'technician': '/technician/dashboard',
      'staff': '/staff/dashboard',
      'customer': '/dashboard'
    };
    return <Navigate to={dashboards[user.role] || '/'} replace />;
  }

  // Is admin, allow access
  return children;
};

export default AdminRoute;
