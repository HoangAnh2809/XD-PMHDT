import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { customerAPI, notificationAPI } from '../../services/api';

const CustomerDashboard = () => {
  const [stats, setStats] = useState({
    vehicles: 0,
    appointments: 0,
    reminders: 0,
    unreadNotifications: 0
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [vehicles, appointments, reminders, notifications] = await Promise.allSettled([
        customerAPI.getVehicles(),
        customerAPI.getAppointments(),
        customerAPI.getMaintenanceReminders(),
        notificationAPI.getUnreadCount()
      ]);

      setStats({
        vehicles: vehicles.status === 'fulfilled' ? vehicles.value.data.length : 0,
        appointments: appointments.status === 'fulfilled' 
          ? appointments.value.data.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length 
          : 0,
        reminders: reminders.status === 'fulfilled' ? reminders.value.data.length : 0,
        unreadNotifications: notifications.status === 'fulfilled' ? notifications.value.data.unread_count : 0
      });

      if (appointments.status === 'fulfilled') {
        setRecentAppointments(appointments.value.data.slice(0, 5));
      }
    } catch (error) {
      // Dashboard APIs not ready yet
      // Set default empty stats on error
      setStats({
        vehicles: 0,
        appointments: 0,
        reminders: 0,
        unreadNotifications: 0
      });
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      in_progress: 'badge-in-progress',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled'
    };
    return badges[status] || 'badge-pending';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      in_progress: 'Đang thực hiện',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy'
    };
    return texts[status] || status;
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      
      <div className="container">
        <h1 style={{marginTop: '2rem', marginBottom: '2rem'}}>
          Dashboard - Khách hàng
        </h1>

        <div className="dashboard-grid">
          <Link to="/customer/vehicles" style={{textDecoration: 'none'}}>
            <div className="stat-card primary">
              <div className="stat-label">Xe của tôi</div>
              <div className="stat-value">{stats.vehicles}</div>
            </div>
          </Link>

          <Link to="/customer/appointments" style={{textDecoration: 'none'}}>
            <div className="stat-card success">
              <div className="stat-label">Lịch hẹn đang chờ</div>
              <div className="stat-value">{stats.appointments}</div>
            </div>
          </Link>

          <div className="stat-card warning">
            <div className="stat-label">Nhắc nhở bảo dưỡng</div>
            <div className="stat-value">{stats.reminders}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Thông báo mới</div>
            <div className="stat-value">{stats.unreadNotifications}</div>
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem'}}>
          <div className="card">
            <div className="card-header">Lịch hẹn gần đây</div>
            
            {recentAppointments.length === 0 ? (
              <p style={{color: '#666', textAlign: 'center', padding: '2rem'}}>
                Bạn chưa có lịch hẹn nào
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ngày hẹn</th>
                    <th>Dịch vụ</th>
                    <th>Trạng thái</th>
                    <th>Chi phí dự kiến</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAppointments.map((apt) => (
                    <tr key={apt.id}>
                      <td>{new Date(apt.appointment_date).toLocaleString('vi-VN')}</td>
                      <td>Bảo dưỡng</td>
                      <td>
                        <span className={`badge ${getStatusBadge(apt.status)}`}>
                          {getStatusText(apt.status)}
                        </span>
                      </td>
                      <td>{apt.estimated_cost?.toLocaleString('vi-VN')} VNĐ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{marginTop: '1rem', textAlign: 'center'}}>
              <Link to="/customer/appointments" className="btn btn-primary">
                Xem tất cả lịch hẹn
              </Link>
            </div>
          </div>

          <div>
            <div className="card">
              <div className="card-header">Hành động nhanh</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
                <Link to="/customer/booking" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)', transition: 'transform 0.2s'}}>
                  📅 Đặt lịch bảo dưỡng
                </Link>
                <Link to="/customer/vehicles" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)', transition: 'transform 0.2s'}}>
                  🚗 Quản lý xe
                </Link>
                <Link to="/customer/service-history" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(79, 172, 254, 0.4)', transition: 'transform 0.2s'}}>
                  📊 Lịch sử dịch vụ
                </Link>
                <Link to="/customer/payment" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(67, 233, 123, 0.4)', transition: 'transform 0.2s'}}>
                  💳 Thanh toán
                </Link>
                <Link to="/customer/chat" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(250, 112, 154, 0.4)', transition: 'transform 0.2s'}}>
                  💬 Chat hỗ trợ
                </Link>
                <Link to="/customer/profile" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', color: 'white', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(48, 207, 208, 0.4)', transition: 'transform 0.2s'}}>
                  👤 Hồ sơ cá nhân
                </Link>
              </div>
            </div>

            {stats.reminders > 0 && (
              <div className="card" style={{marginTop: '1rem', background: '#fff3cd', borderLeft: '4px solid #ffc107'}}>
                <h3 style={{fontSize: '1rem', marginBottom: '0.5rem'}}>⚠️ Nhắc nhở</h3>
                <p style={{fontSize: '0.9rem', margin: 0}}>
                  Bạn có {stats.reminders} xe cần bảo dưỡng sắp tới.
                </p>
                <Link to="/customer/appointments" className="btn btn-warning" style={{marginTop: '1rem', width: '100%', textAlign: 'center'}}>
                  Đặt lịch ngay
                </Link>
              </div>
            )}

            <div className="card" style={{marginTop: '1rem'}}>
              <div className="card-header">🌟 Khám phá thêm</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem'}}>
                <Link to="/services" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)', color: 'white', fontWeight: '600', border: 'none', boxShadow: '0 3px 10px rgba(255, 107, 107, 0.3)', padding: '0.8rem'}}>
                  🔧 Dịch vụ của chúng tôi
                </Link>
                <Link to="/about" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)', color: 'white', fontWeight: '600', border: 'none', boxShadow: '0 3px 10px rgba(78, 205, 196, 0.3)', padding: '0.8rem'}}>
                  ℹ️ Giới thiệu về chúng tôi
                </Link>
                <Link to="/contact" className="btn" style={{textAlign: 'center', background: 'linear-gradient(135deg, #f7b731 0%, #f79c42 100%)', color: 'white', fontWeight: '600', border: 'none', boxShadow: '0 3px 10px rgba(247, 183, 49, 0.3)', padding: '0.8rem'}}>
                  📞 Liên hệ hỗ trợ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;