import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <Link to={user ? `/${user.role}/dashboard` : "/"} className="navbar-brand">
        🔌 EV Maintenance
      </Link>
      
      <ul className="navbar-menu">
        {user && user.role === 'customer' ? (
          <>
            <li><Link to="/customer/dashboard">Trang chủ</Link></li>
            <li><Link to="/customer/booking">Đặt lịch</Link></li>
            <li><Link to="/services">Dịch vụ</Link></li>
            <li><Link to="/about">Giới thiệu</Link></li>
            <li><Link to="/contact">Liên hệ</Link></li>
          </>
        ) : user && (user.role === 'staff' || user.role === 'admin') ? (
          <>
            <li><Link to="/staff/dashboard">Dashboard</Link></li>
            <li><Link to="/staff/appointments">Lịch hẹn</Link></li>
            <li><Link to="/staff/customers">Khách hàng</Link></li>
            <li><Link to="/staff/parts">Phụ tùng</Link></li>
          </>
        ) : user && user.role === 'technician' ? (
          <>
            <li><Link to="/technician/dashboard">Dashboard</Link></li>
            <li><Link to="/technician/tasks">Công việc</Link></li>
            <li><Link to="/technician/schedule">Lịch làm việc</Link></li>
          </>
        ) : (
          <>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/services">Dịch vụ</Link></li>
            <li><Link to="/about">Về chúng tôi</Link></li>
            <li><Link to="/contact">Liên hệ</Link></li>
          </>
        )}
        
        {user ? (
          <>
            {user.role === 'customer' ? (
              <li className="dropdown" ref={menuRef}>
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="dropdown-toggle"
                >
                  👤 {user.full_name || user.username} ▾
                </button>
                {showUserMenu && (
                  <ul className="dropdown-menu">
                    <li>
                      <Link to="/customer/profile" onClick={() => setShowUserMenu(false)}>
                        👤 Hồ sơ cá nhân
                      </Link>
                    </li>
                    <li>
                      <Link to="/customer/vehicles" onClick={() => setShowUserMenu(false)}>
                        🚗 Quản lý xe
                      </Link>
                    </li>
                    <li>
                      <Link to="/customer/booking" onClick={() => setShowUserMenu(false)}>
                        📅 Đặt lịch
                      </Link>
                    </li>
                    <li>
                      <Link to="/customer/service-history" onClick={() => setShowUserMenu(false)}>
                        📋 Lịch sử dịch vụ
                      </Link>
                    </li>
                    <li>
                      <Link to="/customer/payment" onClick={() => setShowUserMenu(false)}>
                        💳 Thanh toán
                      </Link>
                    </li>
                    <li>
                      <Link to="/customer/chat" onClick={() => setShowUserMenu(false)}>
                        💬 Chat hỗ trợ
                      </Link>
                    </li>
                    <li className="dropdown-divider"></li>
                    <li>
                      <button onClick={handleLogout} className="dropdown-item-btn">
                        🚪 Đăng xuất
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            ) : user.role === 'staff' || user.role === 'admin' ? (
              <li className="dropdown" ref={menuRef}>
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="dropdown-toggle"
                >
                  👔 {user.full_name || user.username} ▾
                </button>
                {showUserMenu && (
                  <ul className="dropdown-menu">
                    <li>
                      <Link to="/staff/dashboard" onClick={() => setShowUserMenu(false)}>
                        📊 Dashboard
                      </Link>
                    </li>
                    <li className="dropdown-divider"></li>
                    <li>
                      <Link to="/staff/appointments" onClick={() => setShowUserMenu(false)}>
                        📅 Quản lý lịch hẹn
                      </Link>
                    </li>
                    <li>
                      <Link to="/staff/customers" onClick={() => setShowUserMenu(false)}>
                        👥 Quản lý khách hàng
                      </Link>
                    </li>
                    <li>
                      <Link to="/staff/services" onClick={() => setShowUserMenu(false)}>
                        🔧 Quản lý dịch vụ
                      </Link>
                    </li>
                    <li>
                      <Link to="/staff/parts" onClick={() => setShowUserMenu(false)}>
                        🧰 Quản lý phụ tùng
                      </Link>
                    </li>
                    <li className="dropdown-divider"></li>
                    <li>
                      <button onClick={handleLogout} className="dropdown-item-btn">
                        🚪 Đăng xuất
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            ) : (
              <>
                <li>
                  <Link to={`/${user.role}/dashboard`}>
                    Dashboard
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} className="btn btn-secondary">
                    Đăng xuất
                  </button>
                </li>
              </>
            )}
          </>
        ) : (
          <>
            <li><Link to="/login">Đăng nhập</Link></li>
            <li>
              <Link to="/register" className="btn btn-primary">
                Đăng ký
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
