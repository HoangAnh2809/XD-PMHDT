import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const roleRedirect = {
      customer: '/customer/dashboard',
      staff: '/staff/dashboard',
      technician: '/technician/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={roleRedirect[user.role] || '/'} replace />;
  }

  // If children is a function, call it with user data
  if (typeof children === 'function') {
    return children({ user });
  }

  return children;
};

export default ProtectedRoute;
