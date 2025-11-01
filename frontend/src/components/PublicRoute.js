import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
  }, [user, loading, location.pathname]);

  if (loading) {
    return (
      <div className="loading" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        Đang tải...
      </div>
    );
  }

  const token = localStorage.getItem('token');

  // Các trang public được phép truy cập khi chưa đăng nhập
  const publicPages = ['/', '/services', '/about', '/contact', '/login', '/register'];
  const isPublicPage = publicPages.includes(location.pathname);

  // Nếu là trang public, cho phép truy cập bất kể trạng thái đăng nhập
  if (isPublicPage) {
    return children;
  }

  // Nếu đã đăng nhập và có role, redirect về dashboard tương ứng
  if (user && user.role) {
    // Technicians are redirected from public pages except login/register
    if (user.role === 'technician' && !['/login', '/register'].includes(location.pathname)) {
      return <Navigate to="/technician/dashboard" replace />;
    }

    // Cho phép tất cả user truy cập login/register
    if (location.pathname === '/login' || location.pathname === '/register') {
      return children;
    }

    // Nếu không phải trang public, redirect về dashboard tương ứng
    const roleRedirect = {
      customer: '/customer/dashboard',
      staff: '/staff/dashboard',
      admin: '/admin/dashboard',
      technician: '/technician/dashboard'
    };

    const targetPath = roleRedirect[user.role] || '/customer/dashboard';
    return <Navigate to={targetPath} replace />;
  }

  // Nếu có token nhưng chưa có user info, redirect về dashboard
  if (token && !user) {
    return <Navigate to="/customer/dashboard" replace />;
  }

  // Nếu chưa đăng nhập và cố truy cập trang protected, redirect về login
  return <Navigate to="/login" replace />;
};

export default PublicRoute;
