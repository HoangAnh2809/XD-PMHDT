import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const StaffLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const menuItems = [
    { path: '/staff/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/staff/appointments', icon: '📅', label: 'Quản lý lịch hẹn' },
    { path: '/staff/customers', icon: '👥', label: 'Quản lý khách hàng' },
    { path: '/staff/invoices', icon: '💳', label: 'Quản lý thanh toán' },
    { path: '/staff/services', icon: '🔧', label: 'Quản lý dịch vụ' },
    { path: '/staff/parts', icon: '🧰', label: 'Quản lý phụ tùng' },
    { path: '/staff/chat', icon: '💬', label: 'Hỗ trợ khách hàng' },
    { path: '/staff/reports', icon: '📊', label: 'Báo cáo' },
  ];

  return (
    <div className="staff-layout">
      {/* Sidebar */}
      <aside className={`staff-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">🔌</span>
            {!sidebarCollapsed && <span className="brand-text">EV Staff</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* User Info */}
        <div className="sidebar-user">
          <div className="user-avatar">
            {(user?.full_name || user?.username)?.charAt(0).toUpperCase()}
          </div>
          {!sidebarCollapsed && (
            <div className="user-info">
              <div className="user-name">{user?.full_name || user?.username}</div>
              <div className="user-role">
                {user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button 
            onClick={handleLogout}
            className="logout-btn"
            title={sidebarCollapsed ? 'Đăng xuất' : ''}
          >
            <span className="nav-icon">🚪</span>
            {!sidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="staff-main">
        <header className="staff-header">
          <div className="header-left">
            <h1 className="page-title">
              {menuItems.find(item => isActive(item.path))?.label || 'Staff Panel'}
            </h1>
          </div>
          <div className="header-right">
            <div className="header-actions">
              <button className="header-btn" title="Thông báo">
                🔔
                <span className="notification-badge">3</span>
              </button>
              <button className="header-btn" title="Cài đặt">
                ⚙️
              </button>
            </div>
          </div>
        </header>

        <main className="staff-content">
          {children}
        </main>

        <footer className="staff-footer">
          <p>&copy; 2025 EV Maintenance System. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default StaffLayout;