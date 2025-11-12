import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { customerAPI } from '../../services/api';

const BookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_type_id: '',
    service_center_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: ''
  });

  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceCenters, setServiceCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  // Check for pre-selected service from navigation state or URL params
  useEffect(() => {
    // From location state (when navigating from ServicesPage)
    if (location.state?.service_id) {
      setFormData(prev => ({
        ...prev,
        service_type_id: location.state.service_id
      }));
    }
    
    // From URL params (for deep linking)
    const searchParams = new URLSearchParams(location.search);
    const serviceId = searchParams.get('service');
    if (serviceId) {
      setFormData(prev => ({
        ...prev,
        service_type_id: serviceId
      }));
    }
  }, [location]);

  const loadData = async () => {
    try {
      const results = await Promise.allSettled([
        customerAPI.getVehicles(),
        customerAPI.getServiceTypes(),
        customerAPI.getServiceCenters()
      ]);
      
      // Handle each result separately
      const [vehiclesResult, serviceTypesResult, centersResult] = results;
      
      const vehiclesData = vehiclesResult.status === 'fulfilled' ? vehiclesResult.value.data || [] : [];
      const serviceTypesData = serviceTypesResult.status === 'fulfilled' ? serviceTypesResult.value.data || [] : [];
      const centersData = centersResult.status === 'fulfilled' ? centersResult.value.data || [] : [];
      
      setVehicles(vehiclesData);
      setServiceTypes(serviceTypesData);
      setServiceCenters(centersData);
      
      // Show warning if any API failed
      const failedAPIs = results.filter(r => r.status === 'rejected').length;
      if (failedAPIs > 0) {
        // Some booking APIs not ready yet
        setMessage({ 
          type: 'warning', 
          text: 'Một số dịch vụ đang bảo trì. Vui lòng thử lại sau.' 
        });
      } else if (vehiclesData.length === 0) {
        setMessage({
          type: 'warning',
          text: 'Bạn chưa có xe nào. Vui lòng thêm xe trước khi đặt lịch.'
        });
      }
    } catch (error) {
      console.error('❌ Lỗi tải dữ liệu:', error);
      // Booking API not ready - using fallback data
      setVehicles([]);
      setServiceTypes([]);
      setServiceCenters([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validate required fields
      if (!formData.vehicle_id || formData.vehicle_id === '' || formData.vehicle_id === 'NaN') {
        setMessage({
          type: 'error',
          text: 'Vui lòng chọn xe!'
        });
        setLoading(false);
        return;
      }

      if (!formData.service_type_id || formData.service_type_id === '' || formData.service_type_id === 'NaN') {
        setMessage({
          type: 'error',
          text: 'Vui lòng chọn loại dịch vụ!'
        });
        setLoading(false);
        return;
      }

      if (!formData.service_center_id || formData.service_center_id === '' || formData.service_center_id === 'NaN') {
        setMessage({
          type: 'error',
          text: 'Vui lòng chọn trung tâm dịch vụ!'
        });
        setLoading(false);
        return;
      }

      if (!formData.scheduled_date) {
        setMessage({
          type: 'error',
          text: 'Vui lòng chọn ngày hẹn!'
        });
        setLoading(false);
        return;
      }

      if (!formData.scheduled_time) {
        setMessage({
          type: 'error',
          text: 'Vui lòng chọn giờ hẹn!'
        });
        setLoading(false);
        return;
      }

      // Combine date and time as local datetime string
      const scheduledDateTime = `${formData.scheduled_date}T${formData.scheduled_time}:00`;
      
      // Validate IDs (UUIDs are strings, not integers!)
      if (!formData.vehicle_id || formData.vehicle_id === '') {
        setMessage({
          type: 'error',
          text: 'ID xe không hợp lệ. Vui lòng chọn lại!'
        });
        setLoading(false);
        return;
      }

      if (!formData.service_type_id || formData.service_type_id === '') {
        setMessage({
          type: 'error',
          text: 'ID dịch vụ không hợp lệ. Vui lòng chọn lại!'
        });
        setLoading(false);
        return;
      }

      if (!formData.service_center_id || formData.service_center_id === '') {
        setMessage({
          type: 'error',
          text: 'ID trung tâm không hợp lệ. Vui lòng chọn lại!'
        });
        setLoading(false);
        return;
      }

      const bookingData = {
        vehicle_id: formData.vehicle_id,
        service_type_id: formData.service_type_id,
        service_center_id: formData.service_center_id,
        appointment_date: scheduledDateTime,
        customer_notes: formData.notes || ''
      };

      const response = await customerAPI.createAppointment(bookingData);
      
      setMessage({ 
        type: 'success', 
        text: 'Đặt lịch thành công! Chuyển đến trang quản lý lịch hẹn...' 
      });
      
      setTimeout(() => {
        navigate('/customer/booking');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Lỗi đặt lịch:', error);
      console.error('Response:', error.response);
      
      let errorMessage = 'Có lỗi xảy ra. Vui lòng thử lại.';
      
      if (error.response) {
        // Server responded with error
        if (error.response.status === 400) {
          errorMessage = error.response.data?.detail || error.response.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
        } else if (error.response.status === 401) {
          errorMessage = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
          setTimeout(() => navigate('/login'), 2000);
        } else if (error.response.status === 403) {
          errorMessage = 'Không có quyền thực hiện thao tác này. Vui lòng kiểm tra lại thông tin đăng nhập.';
        } else if (error.response.status === 404) {
          errorMessage = 'Không tìm thấy dịch vụ. Vui lòng kiểm tra lại thông tin.';
        } else if (error.response.status === 500) {
          errorMessage = 'Lỗi hệ thống. Vui lòng liên hệ hỗ trợ.';
        } else {
          errorMessage = error.response.data?.detail || error.response.data?.message || `Lỗi: ${error.response.status}`;
        }
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.';
      }
      
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get available time slots
  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 17; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 17) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  };

  return (
    <div>
      <Navbar />
      
      <div className="hero" style={{ padding: '3rem 2rem' }}>
        <h1>📅 Đặt lịch bảo dưỡng</h1>
        <p>Đặt lịch hẹn dịch vụ bảo dưỡng và sửa chữa xe điện của bạn</p>
      </div>

      <div className="container">
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Booking Form */}
          <div className="card">
            <div className="card-header">
              <h2>Thông tin đặt lịch</h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Chọn xe <span style={{ color: 'red' }}>*</span></label>
                <select
                  name="vehicle_id"
                  className="form-control"
                  value={formData.vehicle_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Chọn xe --</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} - {vehicle.license_plate}
                    </option>
                  ))}
                </select>
                {vehicles.length === 0 && (
                  <small style={{ color: '#666' }}>
                    Chưa có xe nào. <a href="/customer/vehicles">Thêm xe ngay</a>
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Loại dịch vụ <span style={{ color: 'red' }}>*</span></label>
                <select
                  name="service_type_id"
                  className="form-control"
                  value={formData.service_type_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Chọn loại dịch vụ --</option>
                  {serviceTypes.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                      {service.estimated_duration && ` (${service.estimated_duration})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Trung tâm dịch vụ <span style={{ color: 'red' }}>*</span></label>
                <select
                  name="service_center_id"
                  className="form-control"
                  value={formData.service_center_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Chọn trung tâm --</option>
                  {serviceCenters.map(center => (
                    <option key={center.id} value={center.id}>
                      {center.name} - {center.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Ngày hẹn <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="date"
                    name="scheduled_date"
                    className="form-control"
                    value={formData.scheduled_date}
                    onChange={handleInputChange}
                    min={getMinDate()}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Giờ hẹn <span style={{ color: 'red' }}>*</span></label>
                  <select
                    name="scheduled_time"
                    className="form-control"
                    value={formData.scheduled_time}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Chọn giờ --</option>
                    {getTimeSlots().map(time => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  name="notes"
                  className="form-control"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Mô tả tình trạng xe, vấn đề cần kiểm tra..."
                />
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-large"
                  disabled={loading || vehicles.length === 0}
                >
                  {loading ? 'Đang xử lý...' : '📅 Đặt lịch hẹn'}
                </button>
                <button 
                  type="button"
                  onClick={() => navigate('/services')}
                  className="btn btn-outline btn-large"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>

          {/* Info Sidebar */}
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3>💡 Lưu ý</h3>
              </div>
              <ul style={{ padding: '1rem 1rem 1rem 2rem', margin: 0 }}>
                <li style={{ marginBottom: '0.75rem' }}>
                  Vui lòng đặt lịch trước ít nhất 24 giờ
                </li>
                <li style={{ marginBottom: '0.75rem' }}>
                  Thời gian làm việc: 8:00 - 17:30 các ngày trong tuần
                </li>
                <li style={{ marginBottom: '0.75rem' }}>
                  Mang theo giấy tờ xe và giấy bảo hành (nếu có)
                </li>
                <li style={{ marginBottom: '0.75rem' }}>
                  Đến sớm 10-15 phút để làm thủ tục
                </li>
              </ul>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>📞 Hỗ trợ</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                  <strong>Hotline:</strong><br />
                  1900 xxxx
                </p>
                <p style={{ marginBottom: '0.75rem' }}>
                  <strong>Email:</strong><br />
                  support@evmaintenance.com
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong>Giờ làm việc:</strong><br />
                  8:00 - 17:30 (T2-T6)<br />
                  8:00 - 12:00 (T7)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Preview */}
        {formData.service_type_id && (
          <div className="card" style={{ marginTop: '2rem' }}>
            <div className="card-header">
              <h3>Chi tiết dịch vụ đã chọn</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {serviceTypes
                .filter(s => s.id === formData.service_type_id)
                .map(service => (
                  <div key={service.id}>
                    <h4 style={{ color: '#00d4ff', marginBottom: '1rem' }}>
                      {service.name}
                    </h4>
                    {service.description && (
                      <p style={{ marginBottom: '1rem', color: '#666' }}>
                        {service.description}
                      </p>
                    )}
                    <div className="info-grid" style={{ marginTop: '1.5rem' }}>
                      {service.estimated_duration && (
                        <div className="info-item">
                          <span className="info-label">⏱️ Thời gian ước tính:</span>
                          <span className="info-value">{service.estimated_duration}</span>
                        </div>
                      )}
                      {service.base_price && (
                        <div className="info-item">
                          <span className="info-label">💰 Giá cơ bản:</span>
                          <span className="info-value">
                            {parseFloat(service.base_price).toLocaleString('vi-VN')} VNĐ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPage;