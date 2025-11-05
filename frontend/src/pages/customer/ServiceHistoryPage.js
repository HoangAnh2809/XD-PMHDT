import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { customerAPI } from '../../services/api';

const ServiceHistoryPage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAppointments();
      // Sort by date, newest first
      const sorted = (response.data || []).sort((a, b) => 
        new Date(b.appointment_date) - new Date(a.appointment_date)
      );
      setAppointments(sorted);
    } catch (error) {
      // Appointments API not ready - showing empty list
      setAppointments([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
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

  const formatDate = (dateString) => {
    // Parse as UTC time and convert to local time for display
    const utcDate = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    const localDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000));

    return localDate.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) {
      return;
    }

    try {
      await customerAPI.cancelAppointment(appointmentId);
      // Reload appointments
      loadAppointments();
    } catch (error) {
      console.error('Error canceling appointment:', error);
      alert('Không thể hủy lịch hẹn. Vui lòng thử lại.');
    }
  };

  const canCancelAppointment = (appointment) => {
    return appointment.status === 'pending';
  };

  const viewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="loading">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      
      <div className="hero" style={{ padding: '3rem 2rem' }}>
        <h1>📋 Lịch sử dịch vụ</h1>
        <p>Theo dõi lịch sử các dịch vụ bảo dưỡng và sửa chữa của bạn</p>
      </div>

      <div className="container">
        {/* Statistics Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card primary">
            <div className="stat-label">Tổng số dịch vụ</div>
            <div className="stat-value">{appointments.length}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Hoàn thành</div>
            <div className="stat-value">
              {appointments.filter(a => a.status === 'completed').length}
            </div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Đang thực hiện</div>
            <div className="stat-value">
              {appointments.filter(a => a.status === 'in_progress').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Chờ xác nhận</div>
            <div className="stat-value">
              {appointments.filter(a => a.status === 'pending').length}
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="card">
          <div className="card-header">
            <h2>Danh sách dịch vụ</h2>
          </div>

          {appointments.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '1rem' }}>
                📭 Chưa có lịch sử dịch vụ nào
              </p>
              <button 
                onClick={() => navigate('/customer/booking')}
                className="btn btn-primary"
              >
                Đặt lịch ngay
              </button>
            </div>
          ) : (
            <div className="service-history-list">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="history-item">
                  <div className="history-header">
                    <div className="history-title">
                      <h3>{appointment.service_type?.name || 'Dịch vụ'}</h3>
                      {getStatusBadge(appointment.status)}
                    </div>
                    <div className="history-date">
                      🗓️ {formatDate(appointment.appointment_date)}
                    </div>
                  </div>

                  <div className="history-details">
                    <div className="detail-item">
                      <span className="detail-label">🚗 Xe:</span>
                      <span className="detail-value">
                        {appointment.vehicle ? 
                          `${appointment.vehicle.make} ${appointment.vehicle.model} - ${appointment.vehicle.license_plate}` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">🏢 Trung tâm:</span>
                      <span className="detail-value">
                        {appointment.service_center?.name || 'N/A'}
                      </span>
                    </div>
                    {appointment.notes && (
                      <div className="detail-item">
                        <span className="detail-label">📝 Ghi chú:</span>
                        <span className="detail-value">{appointment.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="history-actions">
                    <button 
                      onClick={() => viewDetails(appointment)}
                      className="btn btn-outline"
                    >
                      Xem chi tiết
                    </button>
                    {canCancelAppointment(appointment) && (
                      <button 
                        onClick={() => handleCancelAppointment(appointment.id)}
                        className="btn btn-outline"
                        style={{ borderColor: '#ef5350', color: '#ef5350' }}
                      >
                        Hủy lịch hẹn
                      </button>
                    )}
                    {appointment.status === 'completed' && appointment.invoice_id && (
                      <button 
                        onClick={() => navigate('/customer/payment', { state: { invoiceId: appointment.invoice_id } })}
                        className="btn btn-primary"
                      >
                        💳 Thanh toán
                      </button>
                    )}
                    {appointment.status === 'pending' && (
                      <button 
                        onClick={() => navigate(`/customer/booking`)}
                        className="btn btn-secondary"
                      >
                        Quản lý
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowDetailModal(false)}
            >
              ✕
            </button>
            
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
              <h2 style={{ color: 'white', margin: 0 }}>Chi tiết dịch vụ</h2>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h3>Thông tin dịch vụ</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Mã đơn:</span>
                    <span className="info-value">#{selectedAppointment.id}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Loại dịch vụ:</span>
                    <span className="info-value">{selectedAppointment.service_type?.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Trạng thái:</span>
                    <span className="info-value">{getStatusBadge(selectedAppointment.status)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Thời gian:</span>
                    <span className="info-value">{formatDate(selectedAppointment.appointment_date)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Thông tin xe</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Hãng xe:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.make}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Model:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.model}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Biển số:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.license_plate}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Năm sản xuất:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.year}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Trung tâm dịch vụ</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Tên:</span>
                    <span className="info-value">{selectedAppointment.service_center?.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Địa chỉ:</span>
                    <span className="info-value">{selectedAppointment.service_center?.address}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Điện thoại:</span>
                    <span className="info-value">{selectedAppointment.service_center?.phone}</span>
                  </div>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div className="detail-section">
                  <h3>Ghi chú</h3>
                  <p style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="btn btn-outline btn-large"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceHistoryPage;
