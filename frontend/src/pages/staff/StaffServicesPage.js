import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { staffAPI } from '../../services/api';
import StaffLayout from '../../components/StaffLayout';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function StaffServicesPage() {
  const [services, setServices] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: '',
    estimated_duration: '',
    warranty_period: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [refreshKey, setRefreshKey] = useState(0);

  const { user, loading: authLoading } = useAuth();

  const resolveImageUrl = (url) => {
    if (!url) return null;
    try {
      const u = String(url);
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
      // For images, use API Gateway proxy since frontend container can't access service_center directly
      // Add timestamp for cache-busting
      const timestamp = Date.now();
      if (u.startsWith('/uploads/')) return `${API_BASE_URL}${u}?t=${timestamp}`;
      // If backend stored a leading-slash path like '/uploads/..', use API Gateway
      if (u.startsWith('/')) return `${API_BASE_URL}${u}?t=${timestamp}`;
      // Otherwise assume it's relative to API Gateway
      return `${API_BASE_URL}/${u}?t=${timestamp}`;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMessage({ type: 'warning', text: 'Vui lòng đăng nhập để xem danh sách dịch vụ.' });
      setLoading(false);
      return;
    }
    if (user.role !== 'staff' && user.role !== 'admin') {
      setMessage({ type: 'warning', text: 'Bạn không có quyền xem danh sách dịch vụ.' });
      setLoading(false);
      return;
    }

    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const loadServices = async () => {
    setLoading(true);
    // If current user is not staff or admin, avoid calling staff-only endpoints
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      console.warn('Skipping service-center API call: insufficient role', user?.role);
      setMessage({ type: 'warning', text: 'Bạn không có quyền xem danh sách dịch vụ. Hiển thị dữ liệu mẫu.' });
      setServices([
        {
          id: '1',
          name: 'Kiểm tra Pin',
          description: 'Kiểm tra tình trạng pin và hệ thống sạc',
          base_price: 500000,
          estimated_duration: '60 phút',
          warranty_period: '3 tháng',
          is_active: true
        },
        {
          id: '2',
          name: 'Bảo dưỡng định kỳ',
          description: 'Kiểm tra tổng thể, thay dầu, kiểm tra phanh',
          base_price: 2000000,
          estimated_duration: '180 phút',
          warranty_period: '6 tháng',
          is_active: true
        }
      ]);
      setLoading(false);
      return;
    }
    try {
      const response = await staffAPI.getServiceTypes();
      console.log('StaffServicesPage - Loaded services:', response.data);
      console.log('StaffServicesPage - Number of services:', response.data?.length || 0);
      // Force a new array reference to ensure React detects the change
      setServices([...(response.data || [])]);
      setRefreshKey(prev => prev + 1);
      console.log('StaffServicesPage - Services state updated, refreshKey:', refreshKey + 1);
    } catch (error) {
      console.error('Error loading services:', error);
      setMessage({ type: 'error', text: 'Không thể tải danh sách dịch vụ. Đang sử dụng dữ liệu mẫu.' });
      // Fallback to mock data if API fails
      setServices([
        {
          id: '1',
          name: 'Kiểm tra Pin',
          description: 'Kiểm tra tình trạng pin và hệ thống sạc',
          base_price: 500000,
          estimated_duration: '60 phút',
          warranty_period: '3 tháng',
          is_active: true
        },
        {
          id: '2',
          name: 'Bảo dưỡng định kỳ',
          description: 'Kiểm tra tổng thể, thay dầu, kiểm tra phanh',
          base_price: 2000000,
          estimated_duration: '180 phút',
          warranty_period: '6 tháng',
          is_active: true
        }
      ]);
    }
    setLoading(false);
  };

  const formatPrice = (price) => {
    if (!price) return 'Liên hệ';
    return `${parseFloat(price).toLocaleString('vi-VN')} VNĐ`;
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      description: '',
      base_price: '',
      estimated_duration: '',
      warranty_period: ''
    });
    setImageFile(null);
    setImagePreview(null);
    setIsEditing(false);
    setShowFormModal(true);
  };

  const openEditModal = (service) => {
    setFormData({
      name: service.name,
      description: service.description || '',
      base_price: service.base_price || '',
      estimated_duration: service.estimated_duration || '',
      warranty_period: service.warranty_period || ''
    });
    setImageFile(null);
    setImagePreview(service.image_url || null);
    setSelectedService(service);
    setIsEditing(true);
    setShowFormModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Vui lòng chọn file ảnh (JPG, PNG, GIF)' });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Kích thước ảnh không được vượt quá 5MB' });
        return;
      }
      
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.base_price) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên và giá dịch vụ' });
      return;
    }

    try {
      // If there's an image, use FormData, otherwise use JSON
      
      if (imageFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('description', formData.description || '');
        formDataToSend.append('base_price', parseFloat(formData.base_price));
        if (formData.estimated_duration) {
          formDataToSend.append('estimated_duration', parseInt(formData.estimated_duration));
        }
        if (formData.warranty_period) {
          formDataToSend.append('warranty_period', formData.warranty_period);
        }
        formDataToSend.append('image', imageFile);

        if (isEditing) {
          await staffAPI.updateServiceType(selectedService.id, formDataToSend, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          setMessage({ type: 'success', text: 'Đã cập nhật dịch vụ và ảnh thành công' });
        } else {
          await staffAPI.createServiceType(formDataToSend, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          setMessage({ type: 'success', text: 'Đã thêm dịch vụ mới với ảnh thành công' });
        }
      } else {
        // Always use FormData for consistency with backend
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('description', formData.description || '');
        formDataToSend.append('base_price', parseFloat(formData.base_price));
        if (formData.estimated_duration) {
          formDataToSend.append('estimated_duration', parseInt(formData.estimated_duration));
        }
        if (formData.warranty_period) {
          formDataToSend.append('warranty_period', formData.warranty_period);
        }

        if (isEditing) {
          await staffAPI.updateServiceType(selectedService.id, formDataToSend, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          setMessage({ type: 'success', text: 'Đã cập nhật dịch vụ thành công' });
        } else {
          await staffAPI.createServiceType(formDataToSend, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          setMessage({ type: 'success', text: 'Đã thêm dịch vụ mới thành công' });
        }
      }

      setShowFormModal(false);
      console.log('StaffServicesPage - About to reload services after update');
      await loadServices();
      console.log('StaffServicesPage - Services reloaded after update, current services count:', services.length);
      // Force refresh of the UI
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error submitting service:', error);
      
      // Parse error message properly
      let errorMessage = 'Lỗi khi lưu dịch vụ';
      
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        // Check if detail is an array of validation errors
        if (Array.isArray(detail)) {
          errorMessage = detail.map(err => {
            if (typeof err === 'object' && err.msg) {
              return `${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`;
            }
            return String(err);
          }).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (serviceId) => {
    if (!window.confirm('Bạn có chắc muốn xóa dịch vụ này?')) {
      return;
    }

    try {
      const response = await staffAPI.deleteServiceType(serviceId);
      if (response.data.soft_delete) {
        setMessage({ type: 'success', text: response.data.message });
      } else {
        setMessage({ type: 'success', text: 'Đã xóa dịch vụ thành công' });
      }
      await loadServices();
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting service:', error);
      const errorMessage = error.response?.data?.detail || 'Không thể xóa dịch vụ';
      setMessage({ type: 'error', text: errorMessage });
    }
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
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        {/* Header with Add Button */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>🔧 Quản lý dịch vụ</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
                Tổng số: {services.length} dịch vụ
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={loadServices}
                className="btn btn-outline"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                🔄 {loading ? 'Đang tải...' : 'Làm mới'}
              </button>
              <button onClick={openAddModal} className="btn btn-primary">
                ➕ Thêm dịch vụ mới
              </button>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="services-grid" key={refreshKey} style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem'
        }}>
          {services.map((service) => (
            <div key={service.id} className="service-card">
              {service.image_url && (
                <div style={{ 
                  width: '100%', 
                  height: '180px', 
                  overflow: 'hidden',
                  borderRadius: '8px 8px 0 0'
                }}>
                  <img 
                    src={resolveImageUrl(service.image_url)} 
                    alt={service.name}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover' 
                    }}
                  />
                </div>
              )}
              <div className="service-card-header">
                <h3>{service.name}</h3>
                <span className="service-price">{formatPrice(service.base_price)}</span>
              </div>
              
              <div className="service-card-body">
                <p>{service.description || 'Không có mô tả'}</p>
                
                <div className="service-details">
                  {service.estimated_duration && (
                    <div className="service-detail-item">
                      <span className="detail-icon">⏱️</span>
                      <span>{service.estimated_duration}</span>
                    </div>
                  )}
                  {service.warranty_period && (
                    <div className="service-detail-item">
                      <span className="detail-icon">🛡️</span>
                      <span>Bảo hành: {service.warranty_period}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="service-card-footer">
                <button
                  onClick={() => {
                    setSelectedService(service);
                    setShowDetailModal(true);
                  }}
                  className="btn btn-primary btn-block"
                >
                  Xem chi tiết
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => openEditModal(service)} 
                    className="btn btn-block"
                    style={{ background: '#28a745', color: 'white' }}
                  >
                    ✏️ Sửa
                  </button>
                  <button 
                    onClick={() => handleDelete(service.id)} 
                    className="btn btn-block"
                    style={{ background: '#dc3545', color: 'white' }}
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {services.length === 0 && (
          <div className="card">
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.2rem', color: '#666' }}>
                📭 Chưa có dịch vụ nào
              </p>
            </div>
          </div>
        )}

        {/* Service Detail Modal */}
        {showDetailModal && selectedService && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
              
              <div className="modal-header">
                <h2>{selectedService.name}</h2>
              </div>
              
              <div className="modal-body">
                {selectedService.image_url && (
                  <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    <img 
                      src={resolveImageUrl(selectedService.image_url)} 
                      alt={selectedService.name}
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '300px', 
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                )}
                
                <div className="detail-section">
                  <h3>Thông tin dịch vụ</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Mã dịch vụ:</span>
                      <span className="info-value">#{selectedService.id}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Giá cơ bản:</span>
                      <span className="info-value">{formatPrice(selectedService.base_price)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Thời gian thực hiện:</span>
                      <span className="info-value">{selectedService.estimated_duration || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Bảo hành:</span>
                      <span className="info-value">{selectedService.warranty_period || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {selectedService.description && (
                  <div className="detail-section">
                    <h3>Mô tả</h3>
                    <p style={{ lineHeight: 1.6 }}>{selectedService.description}</p>
                  </div>
                )}

                <div className="modal-actions">
                  <button onClick={() => setShowDetailModal(false)} className="btn btn-outline">
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Service Form Modal */}
        {showFormModal && (
          <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowFormModal(false)}>✕</button>
              
              <div className="modal-header">
                <h2>{isEditing ? '✏️ Sửa dịch vụ' : '➕ Thêm dịch vụ mới'}</h2>
              </div>
              
              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Tên dịch vụ *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="VD: Bảo dưỡng định kỳ"
                    />
                  </div>

                  <div className="form-group">
                    <label>Mô tả</label>
                    <textarea
                      className="form-control"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="4"
                      placeholder="Mô tả chi tiết về dịch vụ..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Ảnh dịch vụ</label>
                    <div style={{ 
                      border: '2px dashed #ddd', 
                      borderRadius: '8px', 
                      padding: '1.5rem', 
                      textAlign: 'center',
                      background: '#f9f9f9'
                    }}>
                      {imagePreview ? (
                        <div style={{ position: 'relative' }}>
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '200px', 
                              borderRadius: '8px',
                              marginBottom: '1rem'
                            }} 
                          />
                          <div>
                            <button
                              type="button"
                              onClick={removeImage}
                              className="btn"
                              style={{ background: '#dc3545', color: 'white' }}
                            >
                              🗑️ Xóa ảnh
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🖼️</div>
                          <label 
                            htmlFor="imageInput" 
                            className="btn btn-primary"
                            style={{ cursor: 'pointer' }}
                          >
                            📷 Chọn ảnh dịch vụ
                          </label>
                          <input
                            id="imageInput"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                          />
                          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                            Chọn file JPG, PNG hoặc GIF (tối đa 5MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Giá cơ bản (VNĐ) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.base_price}
                      onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                      required
                      min="0"
                      step="1000"
                      placeholder="VD: 500000"
                    />
                  </div>

                  <div className="form-group">
                    <label>Thời gian dự kiến (phút)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.estimated_duration}
                      onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                      placeholder="VD: 60-90 phút"
                    />
                  </div>

                  <div className="form-group">
                    <label>Thời gian bảo hành</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.warranty_period}
                      onChange={(e) => setFormData({ ...formData, warranty_period: e.target.value })}
                      placeholder="VD: 3 tháng"
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowFormModal(false)} className="btn btn-outline">
                      Hủy
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {isEditing ? '💾 Lưu thay đổi' : '➕ Thêm dịch vụ'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  );
}