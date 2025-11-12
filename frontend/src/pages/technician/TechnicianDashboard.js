import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { technicianAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayAssignments: 0,
    inProgress: 0,
    completed: 0,
    avgCompletionTime: 0,
    customerSatisfaction: 0
  });
  const [todayTasks, setTodayTasks] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Check if user has technician role
  useEffect(() => {
    if (user && !['technician', 'admin'].includes(user.role)) {
      console.warn('User does not have technician role, redirecting to appropriate dashboard');
      const roleRedirects = {
        customer: '/customer/dashboard',
        staff: '/staff/dashboard',
        admin: '/admin/dashboard',
        technician: '/technician/dashboard'
      };
      navigate(roleRedirects[user.role] || '/customer/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 120000); // Refresh mỗi 2 phút
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, tasksData, scheduleData, notifData] = await Promise.all([
        technicianAPI.getStats(),
        technicianAPI.getTodayTasks(),
        technicianAPI.getMySchedule(),
        technicianAPI.getNotifications()
      ]);

      setStats(statsData || {});
      // Ensure all data is arrays
      setTodayTasks(Array.isArray(tasksData) ? tasksData : []);
      setSchedule(Array.isArray(scheduleData) ? scheduleData : []);
      setNotifications(Array.isArray(notifData) ? notifData : []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Check if it's an authorization error
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.warn('Access denied to technician dashboard, user may not have technician role');
        // Optionally redirect to appropriate dashboard
        // navigate('/customer/dashboard');
      }
      // Set safe defaults on error
      setStats({});
      setTodayTasks([]);
      setSchedule([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': 'badge-warning',
      'in_progress': 'badge-info',
      'completed': 'badge-success',
      'waiting_parts': 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  };

  const getStatusText = (status) => {
    const texts = {
      'pending': 'Chờ xử lý',
      'in_progress': 'Đang thực hiện',
      'completed': 'Hoàn thành',
      'waiting_parts': 'Chờ phụ tùng'
    };
    return texts[status] || status;
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'high') return '🔴';
    if (priority === 'medium') return '🟡';
    return '🟢';
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container" style={{textAlign: 'center', marginTop: '3rem'}}>
          <div className="spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
      <div className="container" style={{marginTop: '2rem'}}>
        {/* Welcome Section */}
        <div className="welcome-section">
          <div>
            <h1>🔧 Bảng điều khiển Kỹ thuật viên</h1>
            <p>Chào mừng bạn đến với khu vực làm việc</p>
          </div>
          {schedule && (
            <div className="current-shift">
              <div className="shift-badge">
                <span className="shift-icon">⏰</span>
                <div>
                  <div className="shift-name">{schedule.shift_name}</div>
                  <div className="shift-time">{schedule.start_time} - {schedule.end_time}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="notifications-banner" style={{marginBottom: '1.5rem'}}>
            {notifications.map((notif, index) => (
              <div key={index} className={`notification-item ${notif.type}`}>
                <span className="notif-icon">
                  {notif.type === 'new_vehicle' && '🚗'}
                  {notif.type === 'urgent' && '⚠️'}
                  {notif.type === 'info' && 'ℹ️'}
                </span>
                <span>{notif.message}</span>
                <span className="notif-time">{notif.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="dashboard-grid">
          <div className="stat-card primary">
            <div className="stat-icon">📋</div>
            <div className="stat-details">
              <div className="stat-value">{stats.todayAssignments}</div>
              <div className="stat-label">Công việc hôm nay</div>
            </div>
          </div>

          <div className="stat-card info">
            <div className="stat-icon">⚙️</div>
            <div className="stat-details">
              <div className="stat-value">{stats.inProgress}</div>
              <div className="stat-label">Đang thực hiện</div>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon">✅</div>
            <div className="stat-details">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Hoàn thành hôm nay</div>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-icon">⏱️</div>
            <div className="stat-details">
              <div className="stat-value">{stats.avgCompletionTime}h</div>
              <div className="stat-label">Thời gian TB/xe</div>
            </div>
          </div>

          <div className="stat-card performance">
            <div className="stat-icon">⭐</div>
            <div className="stat-details">
              <div className="stat-value">{stats.customerSatisfaction}/5</div>
              <div className="stat-label">Đánh giá KH</div>
            </div>
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="card" style={{marginTop: '2rem'}}>
          <div className="card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2>📝 Công việc hôm nay</h2>
            <button className="btn btn-primary" onClick={() => navigate('/technician/tasks')}>
              Xem tất cả
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="empty-state" style={{textAlign: 'center', padding: '2rem'}}>
              <div style={{fontSize: '3rem'}}>😊</div>
              <p>Chưa có công việc nào được phân công hôm nay</p>
            </div>
          ) : (
            <div className="tasks-list">
              {todayTasks.map(task => (
                <div key={task.id} className="task-item" style={{padding: '1rem', borderBottom: '1px solid #e9ecef'}}>
                  <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                    <div className="task-priority" style={{fontSize: '1.5rem'}}>
                      {getPriorityIcon(task.priority)}
                    </div>
                    
                    <div className="task-info" style={{flex: 1}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                        <h4 style={{margin: 0}}>{task.vehicle_info}</h4>
                        <span className={`badge ${getStatusBadge(task.status)}`}>
                          {getStatusText(task.status)}
                        </span>
                      </div>
                      
                      <div style={{display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666'}}>
                        <span>📋 {task.service_type}</span>
                        <span>👤 {task.customer_name}</span>
                        <span>⏰ {task.scheduled_time}</span>
                      </div>

                      {task.notes && (
                        <div style={{fontSize: '0.85rem', color: '#666', fontStyle: 'italic'}}>
                          📌 {task.notes}
                        </div>
                      )}
                    </div>

                    <div className="task-actions">
                      {task.status === 'pending' && (
                        <button className="btn btn-sm btn-primary" onClick={() => navigate(`/technician/tasks/${task.id}/start`)}>
                          Bắt đầu
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button className="btn btn-sm btn-info" onClick={() => navigate(`/technician/tasks/${task.id}/checklist`)}>
                          Tiếp tục
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card" style={{marginTop: '2rem'}}>
          <h2>⚡ Truy cập nhanh</h2>
          <div className="quick-actions-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem'}}>
            <button className="quick-action-btn" onClick={() => navigate('/technician/tasks')}>
              <span className="action-icon" style={{fontSize: '2rem'}}>📋</span>
              <span className="action-title">Quản lý công việc</span>
            </button>

            <button className="quick-action-btn" onClick={() => navigate('/technician/schedule')}>
              <span className="action-icon" style={{fontSize: '2rem'}}>📅</span>
              <span className="action-title">Lịch làm việc</span>
            </button>

            <button className="quick-action-btn" onClick={() => navigate('/technician/parts')}>
              <span className="action-icon" style={{fontSize: '2rem'}}>⚙️</span>
              <span className="action-title">Phụ tùng</span>
            </button>

            <button className="quick-action-btn" onClick={() => navigate('/technician/reports')}>
              <span className="action-icon" style={{fontSize: '2rem'}}>📊</span>
              <span className="action-title">Báo cáo</span>
            </button>

            <button className="quick-action-btn" onClick={() => navigate('/technician/ai-assistant')}>
              <span className="action-icon" style={{fontSize: '2rem'}}>🤖</span>
              <span className="action-title">AI Trợ lý</span>
            </button>

            <button className="quick-action-btn" onClick={() => navigate('/technician/performance')}>
              <span className="action-icon" style={{fontSize: '2rem'}}>📈</span>
              <span className="action-title">Hiệu suất</span>
            </button>
          </div>
        </div>
      </div>
  );
};

export default TechnicianDashboard;