import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { publicAPI } from '../../services/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ServicesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await publicAPI.getServiceTypes();
      // Add cache-busting to ensure fresh data
      const servicesWithTimestamp = (response.data || []).map(service => ({
        ...service,
        _loadedAt: Date.now() // Add timestamp to force re-render
      }));
      setServices(servicesWithTimestamp);
      setError(null);
    } catch (err) {
      console.error('Error loading services:', err);
      setError('Không thể tải danh sách dịch vụ');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = (serviceId) => {
    if (!user) {
      navigate('/login', { state: { from: '/services', service_id: serviceId } });
      return;
    }
    navigate('/customer/booking', { state: { service_id: serviceId } });
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="container" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner"></div>
          <p>Đang tải danh sách dịch vụ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Navbar />
        <div className="container" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="alert alert-error">
            {error}
          </div>
          <button onClick={loadServices} className="btn btn-primary">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const visibleServices = services
    .filter((s) => {
      const name = (s && s.name) ? String(s.name).toLowerCase() : '';
      return !name.includes('e2e');
    })
    .filter((service, index, self) => 
      index === self.findIndex((s) => s.id === service.id)
    );

  const resolveImageUrl = (url) => {
    if (!url) return null;
    try {
      const u = String(url);
      let fullUrl;
      if (u.startsWith('http://') || u.startsWith('https://')) {
        fullUrl = u;
      } else if (u.startsWith('/')) {
        fullUrl = `${API_BASE_URL}${u}`;
      } else {
        fullUrl = `${API_BASE_URL}/${u}`;
      }
      // Add cache-busting parameter to prevent browser caching of updated images
      const separator = fullUrl.includes('?') ? '&' : '?';
      return `${fullUrl}${separator}t=${Date.now()}`;
    } catch (e) {
      return null;
    }
  };

  return (
    <div>
      <Navbar />

      <div className="hero">
        <h1>Dịch vụ của chúng tôi</h1>
        <p>Các gói dịch vụ bảo dưỡng và sửa chữa xe điện chuyên nghiệp</p>
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={loadServices}
            className="btn btn-outline"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            🔄 {loading ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
          </button>
          <small style={{ color: '#666', fontSize: '0.9em' }}>
            Nhấn để tải dữ liệu và hình ảnh mới nhất
          </small>
        </div>
      </div>

      <div className="container">
        {visibleServices.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3>Không có dịch vụ nào</h3>
            <p>Hiện tại chưa có dịch vụ nào được cung cấp.</p>
          </div>
        ) : (
          <div className="services-grid">
            {visibleServices.map((service) => (
              <div key={service.id} className="service-card">
                <div className="service-image">
                  <img
                    src={resolveImageUrl(service.image_url) || `${API_BASE_URL}/uploads/service_images/default-service.jpg`}
                    alt={service.name}
                    onError={(e) => {
                      e.target.src = `${API_BASE_URL}/uploads/service_images/default-service.jpg`;
                    }}
                  />
                </div>
                <div className="service-content">
                  <h3>{service.name}</h3>
                  <p className="service-description">
                    {service.description || 'Dịch vụ chuyên nghiệp cho xe điện của bạn'}
                  </p>
                  <div className="service-info">
                    <div className="info-item">
                      <span className="info-label">💰 Giá:</span>
                      <span className="info-value">
                        {parseFloat(service.base_price || 0).toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">⏱️ Thời gian:</span>
                      <span className="info-value">
                        {service.estimated_duration || 0} phút
                      </span>
                    </div>
                  </div>

                  <div className="service-actions">
                    <button
                      onClick={() => handleBookService(service.id)}
                      className="btn btn-primary"
                    >
                      Đặt lịch ngay
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{marginTop: '3rem', background: '#f8f9fa'}}>
          <h2>Gói bảo dưỡng định kỳ</h2>
          <p>Đăng ký gói bảo dưỡng định kỳ để nhận ưu đãi đặc biệt!</p>
          <ul style={{marginTop: '1rem', lineHeight: '2'}}>
            <li>✅ Giảm 20% cho các dịch vụ trong gói</li>
            <li>✅ Ưu tiên đặt lịch</li>
            <li>✅ Nhắc nhở bảo dưỡng tự động</li>
            <li>✅ Hỗ trợ khẩn cấp miễn phí</li>
          </ul>
          <button
            onClick={() => user ? navigate('/customer/booking') : navigate('/login')}
            className="btn btn-success"
            style={{marginTop: '1rem'}}
          >
            Đăng ký ngay
          </button>
        </div>

        {!user && (
          <div className="card" style={{marginTop: '3rem', background: '#fff3cd', borderColor: '#ffc107'}}>
            <h3>Đăng nhập để đặt lịch</h3>
            <p>Bạn cần đăng nhập để sử dụng dịch vụ đặt lịch bảo dưỡng.</p>
            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
              <a href="/login" className="btn btn-primary">
                Đăng nhập
              </a>
              <a href="/register" className="btn btn-outline">
                Đăng ký tài khoản
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesPage;
