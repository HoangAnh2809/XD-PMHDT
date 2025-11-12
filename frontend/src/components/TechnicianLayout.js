import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './TechnicianLayout.css';

function TechnicianLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="technician-layout">
      {/* Sidebar */}
      <aside className="technician-sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">⚡</div>
            <div className="brand-text">
              <h2>EV Service</h2>
              <span>Technician Portal</span>
            </div>
          </div>
          <div className="user-info">
            <div className="user-name">{user?.full_name || user?.username || 'Technician'}</div>
            <div className="user-role">Kỹ thuật viên</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link to="/technician/dashboard" className="nav-item">
            <span className="nav-label">Tổng quan</span>
          </Link>
          <Link to="/technician/tasks" className="nav-item">
            <span className="nav-label">Công việc</span>
          </Link>
          <Link to="/technician/progress" className="nav-item">
            <span className="nav-label">Tiến độ</span>
          </Link>
          <Link to="/technician/parts" className="nav-item">
            <span className="nav-label">Phụ tùng</span>
          </Link>
          <Link to="/technician/schedule" className="nav-item">
            <span className="nav-label">Lịch trình</span>
          </Link>
          <div className="nav-divider"></div>
          <button onClick={() => navigate('/staff/invoices/create')} className="nav-item nav-action">
            <span className="nav-label">Tạo hóa đơn</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="technician-main">
        <div className="technician-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export default TechnicianLayout;
