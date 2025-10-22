import React, { useState, useEffect } from 'react';
import { statsAPI } from '../../services/adminAPI';

const AdminDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    stats: [],
    revenueData: [],
    topServices: [],
    recentActivities: [],
    topPerformers: []
  });

  const loadMockData = () => {
    // Mock data as fallback
    const stats = [
      { 
        icon: '👥', 
        label: 'Tổng người dùng', 
        value: '2,547', 
        change: '+12.5%', 
        positive: true,
        color: '#667eea'
      },
      { 
        icon: '💰', 
        label: 'Doanh thu tháng', 
        value: '₫156.8M', 
        change: '+23.8%', 
        positive: true,
        color: '#48bb78'
      },
      { 
        icon: '🔧', 
        label: 'Dịch vụ hoàn thành', 
        value: '1,843', 
        change: '+8.2%', 
        positive: true,
        color: '#00d4ff'
      },
      { 
        icon: '⭐', 
        label: 'Đánh giá trung bình', 
        value: '4.8/5', 
        change: '+0.3', 
        positive: true,
        color: '#f59e0b'
      }
    ];

    const revenueData = [
      { label: 'T2', value: 15, height: '45%' },
      { label: 'T3', value: 22, height: '66%' },
      { label: 'T4', value: 18, height: '54%' },
      { label: 'T5', value: 28, height: '84%' },
      { label: 'T6', value: 25, height: '75%' },
      { label: 'T7', value: 32, height: '96%' },
      { label: 'CN', value: 20, height: '60%' }
    ];

    const topServices = [
      { name: 'Thay pin xe đạp điện', count: 245, percent: 85 },
      { name: 'Bảo dưỡng định kỳ', count: 189, percent: 65 },
      { name: 'Sửa chữa động cơ', count: 156, percent: 54 },
      { name: 'Thay lốp xe', count: 134, percent: 46 },
      { name: 'Kiểm tra hệ thống điện', count: 98, percent: 34 }
    ];

    const recentActivities = [
      { type: 'user', icon: '👤', message: 'Nguyễn Văn A đã đăng ký tài khoản mới', time: '2 phút trước', color: '#667eea' },
      { type: 'payment', icon: '💳', message: 'Thanh toán #INV-2547 đã được xác nhận (₫2.5M)', time: '15 phút trước', color: '#48bb78' },
      { type: 'service', icon: '🔧', message: 'Kỹ thuật viên Trần B đã hoàn thành dịch vụ #SV-8823', time: '28 phút trước', color: '#00d4ff' },
      { type: 'alert', icon: '⚠️', message: 'Cảnh báo: Phụ tùng "Pin 48V" sắp hết hàng (còn 5)', time: '1 giờ trước', color: '#f59e0b' },
      { type: 'staff', icon: '👨‍🔧', message: 'Chi nhánh Hà Nội cần thêm 2 kỹ thuật viên', time: '2 giờ trước', color: '#764ba2' }
    ];

    const topPerformers = [
      { rank: 1, name: 'Trần Văn B', avatar: 'B', completed: 156, rating: 4.9 },
      { rank: 2, name: 'Nguyễn Thị C', avatar: 'C', completed: 142, rating: 4.8 },
      { rank: 3, name: 'Lê Văn D', avatar: 'D', completed: 128, rating: 4.7 }
    ];

    setDashboardData({
      stats,
      revenueData,
      topServices,
      recentActivities,
      topPerformers
    });
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await statsAPI.getDashboard();
        const data = response.data;

      // Transform API data to component format
      const stats = [
        { 
          icon: '👥', 
          label: 'Tổng người dùng', 
          value: data.total_users.toLocaleString(), 
          change: '+12.5%', 
          positive: true,
          color: '#667eea'
        },
        { 
          icon: '💰', 
          label: 'Doanh thu tháng', 
          value: `₫${(data.total_revenue / 1000000).toFixed(1)}M`, 
          change: '+23.8%', 
          positive: true,
          color: '#48bb78'
        },
        { 
          icon: '🔧', 
          label: 'Dịch vụ hoàn thành', 
          value: data.completed_services.toLocaleString(), 
          change: '+8.2%', 
          positive: true,
          color: '#00d4ff'
        },
        { 
          icon: '⭐', 
          label: 'Đánh giá trung bình', 
          value: `${data.average_rating.toFixed(1)}/5`, 
          change: '+0.3', 
          positive: true,
          color: '#f59e0b'
        }
      ];

      setDashboardData({
        stats,
        revenueData: data.monthly_revenue || [],
        topServices: data.top_services || [],
        recentActivities: data.recent_activities || [],
        topPerformers: data.top_technicians || []
      });
      
    } catch (err) {
      console.error('❌ Error fetching dashboard data:', err);
      setError('Không thể tải dữ liệu dashboard. Hiển thị dữ liệu mẫu.');
      // Fallback to mock data
      loadMockData();
    } finally {
      setLoading(false);
    }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="card">
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p>Đang tải dữ liệu dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && dashboardData.stats.length === 0) {
    return (
      <div className="admin-page">
        <div className="card">
          <div className="card-header">
            <h3>❌ Lỗi</h3>
          </div>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#f56565', marginBottom: '1rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              🔄 Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { stats, revenueData, topServices, recentActivities, topPerformers } = dashboardData;

  return (
    <div className="admin-page">
      {/* Error notification banner */}
      {error && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong>Thông báo:</strong> {error}
          </div>
          <button 
            className="btn btn-sm btn-primary" 
            onClick={() => window.location.reload()}
            style={{ whiteSpace: 'nowrap' }}
          >
            🔄 Thử lại
          </button>
        </div>
      )}
      
      {/* Stats Overview */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card-admin" style={{ borderLeftColor: stat.color }}>
            <div className="stat-icon-admin" style={{ background: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content-admin">
              <div className="stat-label-admin">{stat.label}</div>
              <div className="stat-value-admin">{stat.value}</div>
              <div className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                {stat.positive ? '↗' : '↘'} {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Revenue Chart */}
        <div className="dashboard-card large">
          <div className="card-header">
            <h3>📈 Biểu đồ doanh thu</h3>
            <select 
              className="chart-period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
              <option value="year">12 tháng qua</option>
            </select>
          </div>
          <div className="chart-placeholder">
            <div className="chart-bars">
              {revenueData.map((item, index) => (
                <div key={index} className="chart-bar">
                  <div 
                    className="bar-fill" 
                    style={{ height: item.height }}
                    title={`${item.value}M`}
                  />
                  <div className="bar-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Services */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>🏆 Dịch vụ phổ biến</h3>
          </div>
          <div className="service-list">
            {topServices.map((service, index) => (
              <div key={index} className="service-item">
                <div className="service-info">
                  <span className="service-name">{service.name}</span>
                  <span className="service-count">{service.count} lượt</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${service.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>🔔 Hoạt động gần đây</h3>
          </div>
          <div className="activity-list">
            {recentActivities.map((activity, index) => (
              <div key={index} className="activity-item">
                <div 
                  className={`activity-icon ${activity.type}`}
                  style={{ background: `${activity.color}20`, color: activity.color }}
                >
                  {activity.icon}
                </div>
                <div className="activity-content">
                  <p className="activity-message">{activity.message}</p>
                  <span className="activity-time">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>🌟 Kỹ thuật viên xuất sắc</h3>
          </div>
          <div className="performers-list">
            {topPerformers.map((performer) => (
              <div key={performer.rank} className="performer-item">
                <div className="performer-rank">#{performer.rank}</div>
                <div className="performer-avatar">{performer.avatar}</div>
                <div className="performer-info">
                  <div className="performer-name">{performer.name}</div>
                  <div className="performer-stats">
                    <span>✅ {performer.completed} dịch vụ</span>
                    <span>⭐ {performer.rating}/5.0</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
