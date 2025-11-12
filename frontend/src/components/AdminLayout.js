import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const menuItems = [
    {
      id: 'dashboard',
      icon: '📊',
      label: 'Dashboard & Báo cáo',
      path: '/admin/dashboard',
      description: 'Tổng quan & phân tích'
    },
    {
      id: 'users',
      icon: '👥',
      label: 'Quản lý người dùng',
      path: '/admin/users',
      description: 'Users & Phân quyền'
    },
    {
      id: 'branches',
      icon: '🏢',
      label: 'Trung tâm & Chi nhánh',
      path: '/admin/branches',
      description: 'Centers & Locations'
    },
    {
      id: 'staff',
      icon: '🧑‍🔧',
      label: 'Quản lý nhân sự',
      path: '/admin/staff',
      description: 'Staff & Performance'
    },
    {
      id: 'inventory',
      icon: '🧰',
      label: 'Quản lý phụ tùng',
      path: '/admin/inventory',
      description: 'Parts & Stock'
    },
    {
      id: 'finance',
      icon: '💵',
      label: 'Quản lý tài chính',
      path: '/admin/finance',
      description: 'Revenue & Expenses'
    },
    {
      id: 'shifts',
      icon: '🕒',
      label: 'Quản lý ca làm',
      path: '/admin/shifts',
      description: 'Work Schedules & Shifts'
    },
    {
      id: 'ai',
      icon: '🤖',
      label: 'Gợi ý AI',
      path: '/admin/ai-suggestions',
      description: 'AI-powered Insights'
    },
    // Đã xóa menu 'Cài đặt hệ thống' theo yêu cầu
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <span className="logo-icon">⚡</span>
            {!sidebarCollapsed && <span className="logo-text">EV Admin</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="admin-nav">
          {menuItems.map(item => (
            <div
              key={item.id}
              className={`admin-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && (
                <div className="nav-content">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-description">{item.description}</span>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User Info */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="user-avatar">
              {user.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            {!sidebarCollapsed && (
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-role">Administrator</div>
              </div>
            )}
          </div>
          <button 
            className="btn-logout"
            onClick={handleLogout}
            title="Đăng xuất"
          >
            🚪 {!sidebarCollapsed && 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Top Bar */}
        <div className="admin-topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-icon">🏠</span>
            <span className="breadcrumb-text">
              {menuItems.find(item => isActive(item.path))?.label || 'Admin Panel'}
            </span>
          </div>
          
          <div className="topbar-actions">
            <button className="topbar-btn" title="Thông báo">
              🔔
              <span className="notification-badge">5</span>
            </button>
            <button className="topbar-btn" title="Trợ giúp">
              ❓
            </button>
            <button 
              className="topbar-btn"
              onClick={() => navigate('/')}
              title="Về trang chủ"
            >
              🏠
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
