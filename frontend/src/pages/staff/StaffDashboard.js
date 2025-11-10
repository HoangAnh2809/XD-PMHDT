import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import { staffAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    inProgressAppointments: 0,
    lowStockParts: 0,
    availableTechnicians: 0,
    monthlyRevenue: 0,
    totalCustomers: 0,
    completedToday: 0
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait until auth check completes
    if (authLoading) return;

    // If user not authenticated or not staff/admin, redirect or show message
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.role !== 'staff' && user.role !== 'admin') {
      // Redirect to user's dashboard (role-based)
      const rolePaths = {
        customer: '/customer/dashboard',
        technician: '/technician/dashboard',
        admin: '/admin/dashboard',
        staff: '/staff/dashboard'
      };
      const target = rolePaths[user.role] || '/';
      navigate(target, { replace: true });
      return;
    }

    loadDashboardData();
  }, [authLoading, user, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
        console.warn('Skipping dashboard API calls: insufficient role', user?.role);
        // keep default stats/recentActivities
        setLoading(false);
        return;
      }
      // Load dashboard stats from backend
      const statsRes = await staffAPI.getDashboardStats();
      const backendStats = statsRes.data || {};
      
      // Load appointments for recent list
      const appointmentsRes = await staffAPI.getAppointments();
      const appointments = appointmentsRes.data || [];
      
      setStats({
        todayAppointments: backendStats.today_appointments || 0,
        pendingAppointments: backendStats.pending_appointments || 0,
        inProgressAppointments: backendStats.in_progress_appointments || 0,
        lowStockParts: backendStats.low_stock_parts || 0,
        availableTechnicians: backendStats.available_technicians || 0,
        monthlyRevenue: backendStats.monthly_revenue || 0,
        totalCustomers: backendStats.total_customers || 0,
        completedToday: backendStats.completed_today || 0
      });
      
      // Recent appointments (last 5)
      setRecentAppointments(appointments.slice(0, 5));
      
      // Mock recent activities
      setRecentActivities([
        { id: 1, type: 'appointment', message: 'Lịch hẹn mới được tạo', time: '5 phút trước', icon: '📅' },
        { id: 2, type: 'customer', message: 'Khách hàng mới đăng ký', time: '15 phút trước', icon: '👤' },
        { id: 3, type: 'service', message: 'Dịch vụ hoàn thành', time: '30 phút trước', icon: '✅' },
        { id: 4, type: 'part', message: 'Phụ tùng được nhập kho', time: '1 giờ trước', icon: '📦' },
        { id: 5, type: 'appointment', message: 'Lịch hẹn được xác nhận', time: '2 giờ trước', icon: '✔️' }
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Set default values on error
      setStats({
        todayAppointments: 0,
        pendingAppointments: 0,
        inProgressAppointments: 0,
        lowStockParts: 0,
        availableTechnicians: 0,
        monthlyRevenue: 0,
        totalCustomers: 0,
        completedToday: 0
      });
      setRecentAppointments([]);
      setRecentActivities([]);
    }
    setLoading(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'Chờ xác nhận', class: 'badge-pending' },
      'confirmed': { label: 'Đã xác nhận', class: 'badge-confirmed' },
      'in_progress': { label: 'Đang thực hiện', class: 'badge-in-progress' },
      'completed': { label: 'Hoàn thành', class: 'badge-completed' },
      'cancelled': { label: 'Đã hủy', class: 'badge-cancelled' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'badge-pending' };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <StaffLayout>
        <div className="loading">Đang tải dữ liệu...</div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="container">
        {/* Welcome Section */}
        <div className="welcome-section">
          <h2>👋 Chào mừng trở lại!</h2>
          <p>Đây là tổng quan hoạt động của hệ thống</p>
        </div>

        {/* Statistics Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card primary" onClick={() => navigate('/staff/appointments')}>
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-label">Lịch hẹn hôm nay</div>
              <div className="stat-value">{stats.todayAppointments}</div>
            </div>
            <div className="stat-trend">↑ {stats.completedToday} hoàn thành</div>
          </div>

          <div className="stat-card warning" onClick={() => navigate('/staff/appointments')}>
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <div className="stat-label">Chờ xử lý</div>
              <div className="stat-value">{stats.pendingAppointments}</div>
            </div>
            <div className="stat-trend">Cần xác nhận</div>
          </div>

          <div className="stat-card info">
            <div className="stat-icon">�</div>
            <div className="stat-content">
              <div className="stat-label">Đang bảo dưỡng</div>
              <div className="stat-value">{stats.inProgressAppointments}</div>
            </div>
            <div className="stat-trend">Xe đang xử lý</div>
          </div>

          <div className="stat-card danger" onClick={() => navigate('/staff/parts')}>
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <div className="stat-label">Phụ tùng sắp hết</div>
              <div className="stat-value">{stats.lowStockParts}</div>
            </div>
            <div className="stat-trend">Cần nhập thêm</div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon">👨‍🔧</div>
            <div className="stat-content">
              <div className="stat-label">Kỹ thuật viên rảnh</div>
              <div className="stat-value">{stats.availableTechnicians}</div>
            </div>
            <div className="stat-trend">Sẵn sàng phục vụ</div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">Doanh thu tháng</div>
              <div className="stat-value">{(stats.monthlyRevenue / 1000000).toFixed(1)}M</div>
            </div>
            <div className="stat-trend">VNĐ</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="dashboard-content-grid">
          {/* Recent Appointments */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📋 Lịch hẹn gần đây</h3>
              <button 
                onClick={() => navigate('/staff/appointments')}
                className="btn btn-sm btn-outline"
              >
                Xem tất cả
              </button>
            </div>
            <div className="card-body">
              {recentAppointments.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  Chưa có lịch hẹn nào
                </p>
              ) : (
                <div className="appointments-list">
                  {recentAppointments.map((appointment) => (
                    <div key={appointment.id} className="appointment-item">
                      <div className="appointment-info">
                        <div className="appointment-title">
                          <strong>{appointment.customer?.full_name || 'N/A'}</strong>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="appointment-details">
                          <span>🚗 {appointment.vehicle?.license_plate || 'N/A'}</span>
                          <span>•</span>
                          <span>{appointment.service_type?.name || 'Dịch vụ'}</span>
                        </div>
                        <div className="appointment-time">
                          🕐 {formatDate(appointment.scheduled_date)}
                        </div>
                      </div>
                      <button 
                        onClick={() => navigate('/staff/appointments')}
                        className="btn btn-sm btn-primary"
                      >
                        Chi tiết
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>🔔 Hoạt động gần đây</h3>
            </div>
            <div className="card-body">
              <div className="activities-list">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-icon">{activity.icon}</div>
                    <div className="activity-content">
                      <div className="activity-message">{activity.message}</div>
                      <div className="activity-time">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3>⚡ Thao tác nhanh</h3>
          </div>
          <div className="quick-actions-grid">
            <button 
              onClick={() => navigate('/staff/appointments')}
              className="quick-action-btn"
            >
              <span className="action-icon">📅</span>
              <span className="action-label">Xem lịch hẹn</span>
            </button>
            <button 
              onClick={() => navigate('/staff/customers')}
              className="quick-action-btn"
            >
              <span className="action-icon">👥</span>
              <span className="action-label">Tìm khách hàng</span>
            </button>
            <button 
              onClick={() => navigate('/staff/invoices')}
              className="quick-action-btn"
            >
              <span className="action-icon">💳</span>
              <span className="action-label">Quản lý thanh toán</span>
            </button>
            <button 
              onClick={() => navigate('/staff/services')}
              className="quick-action-btn"
            >
              <span className="action-icon">🔧</span>
              <span className="action-label">Dịch vụ</span>
            </button>
            <button 
              onClick={() => navigate('/staff/parts')}
              className="quick-action-btn"
            >
              <span className="action-icon">🧰</span>
              <span className="action-label">Quản lý kho</span>
            </button>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
};

export default StaffDashboard;
