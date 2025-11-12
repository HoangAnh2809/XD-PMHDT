import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { customerAPI } from '../../services/api';

const ServiceHistoryPage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedServiceRecord, setSelectedServiceRecord] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showServiceDetailModal, setShowServiceDetailModal] = useState(false);

  useEffect(() => {
    loadAppointments();
    loadServiceHistory();
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

  const loadServiceHistory = async () => {
    try {
      const response = await customerAPI.getServiceHistory();
      // Sort by date, newest first
      const sorted = (response.data || []).sort((a, b) => 
        new Date(b.service_date) - new Date(a.service_date)
      );
      setServiceHistory(sorted);
    } catch (error) {
      console.error('Error loading service history:', error);
      setServiceHistory([]);
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

  const viewServiceDetails = async (serviceRecord) => {
    setSelectedServiceRecord(serviceRecord);
    setShowServiceDetailModal(true);
    // Fetch vehicle info
    try {
      const vehicleResponse = await customerAPI.getVehicle(serviceRecord.vehicle_id);
      setSelectedVehicle(vehicleResponse.data);
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      // Fallback to service record vehicle data
      setSelectedVehicle(serviceRecord.vehicle || null);
    }
  };

  // open full screen detail panel (alternate to modal)
  const [showFullDetail, setShowFullDetail] = useState(false);
  const openFullDetail = async (serviceRecord) => {
    setSelectedServiceRecord(serviceRecord);
    setShowFullDetail(true);
    // Fetch vehicle info from vehicles API
    try {
      const vehicleResponse = await customerAPI.getVehicle(serviceRecord.vehicle_id);
      setSelectedVehicle(vehicleResponse.data);
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      // Fallback to service record vehicle data if available
      setSelectedVehicle(serviceRecord.vehicle || null);
    }
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
            <div className="stat-value">{serviceHistory.length}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Lịch hẹn</div>
            <div className="stat-value">{appointments.length}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Đang thực hiện</div>
            <div className="stat-value">
              {appointments.filter(a => a.status === 'in_progress').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hoàn thành</div>
            <div className="stat-value">
              {appointments.filter(a => a.status === 'completed').length}
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="card">
          <div className="card-header">
            <h2>Lịch sử dịch vụ chi tiết</h2>
          </div>

          {serviceHistory.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '1rem' }}>
                📭 Chưa có lịch sử dịch vụ nào
              </p>
            </div>
          ) : (
            <div className="service-history-list">
              {serviceHistory.map((record) => (
                <div key={record.id} className="history-item">
                  <div className="history-header">
                    <div className="history-title">
                      <h3>Dịch vụ bảo dưỡng #{record.id.slice(-8)}</h3>
                      <span className="badge badge-completed">Hoàn thành</span>
                    </div>
                    <div className="history-date">
                      🗓️ {formatDate(record.service_date)}
                    </div>
                  </div>

                  <div className="history-details">
                    <div className="detail-item">
                      <span className="detail-label">🚗 Xe:</span>
                      <span className="detail-value">
                        {record.vehicle ? 
                          `${record.vehicle.make} ${record.vehicle.model} - ${record.vehicle.license_plate}` 
                          : 'N/A'}
                      </span>
                    </div>
                    {record.mileage_at_service && (
                      <div className="detail-item">
                        <span className="detail-label">📊 Số km:</span>
                        <span className="detail-value">{record.mileage_at_service.toLocaleString()} km</span>
                      </div>
                    )}
                    {record.total_cost && (
                      <div className="detail-item">
                        <span className="detail-label">💰 Tổng chi phí:</span>
                        <span className="detail-value">{record.total_cost.toLocaleString()} VND</span>
                      </div>
                    )}
                  </div>

                  <div className="history-actions">
                    <button 
                      onClick={() => viewServiceDetails(record)}
                      className="btn btn-primary"
                    >
                      Xem chi tiết dịch vụ
                    </button>
                    <button
                      onClick={() => openFullDetail(record)}
                      className="btn btn-outline"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Mở xem rộng
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Appointments List */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h2>Lịch hẹn dịch vụ</h2>
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

      {/* Service Detail Modal */}
      {showServiceDetailModal && selectedServiceRecord && (
        <div className="modal-overlay" onClick={() => setShowServiceDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowServiceDetailModal(false)}
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
                    <span className="info-label">Mã dịch vụ:</span>
                    <span className="info-value">#{selectedServiceRecord.id.slice(-8)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Ngày thực hiện:</span>
                    <span className="info-value">{formatDate(selectedServiceRecord.service_date)}</span>
                  </div>
                  {selectedServiceRecord.mileage_at_service && (
                    <div className="info-item">
                      <span className="info-label">Số km khi bảo dưỡng:</span>
                      <span className="info-value">{selectedServiceRecord.mileage_at_service.toLocaleString()} km</span>
                    </div>
                  )}
                  {selectedServiceRecord.total_cost && (
                    <div className="info-item">
                      <span className="info-label">Tổng chi phí:</span>
                      <span className="info-value">{selectedServiceRecord.total_cost.toLocaleString()} VND</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Thông tin xe</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Hãng xe:</span>
                    <span className="info-value">{selectedVehicle?.make || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Model:</span>
                    <span className="info-value">{selectedVehicle?.model || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Biển số:</span>
                    <span className="info-value">{selectedVehicle?.license_plate || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Năm sản xuất:</span>
                    <span className="info-value">{selectedVehicle?.year || 'Chưa cập nhật'}</span>
                  </div>
                </div>
              </div>

              {selectedServiceRecord.services_performed && (
                <div className="detail-section">
                  <h3>Dịch vụ đã thực hiện</h3>
                  <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    {typeof selectedServiceRecord.services_performed === 'object' ? (
                      <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                        {Object.entries(selectedServiceRecord.services_performed).map(([key, value]) => (
                          <li key={key} style={{ marginBottom: '0.5rem' }}>
                            <strong>{key}:</strong> {String(value)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: 0 }}>{selectedServiceRecord.services_performed}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedServiceRecord.diagnosis && (
                <div className="detail-section">
                  <h3>Chẩn đoán</h3>
                  <p style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', margin: 0 }}>
                    {selectedServiceRecord.diagnosis}
                  </p>
                </div>
              )}

              {selectedServiceRecord.recommendations && (
                <div className="detail-section">
                  <h3>Khuyến nghị</h3>
                  <p style={{ padding: '1rem', background: '#d1ecf1', borderRadius: '8px', margin: 0 }}>
                    {selectedServiceRecord.recommendations}
                  </p>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  onClick={() => setShowServiceDetailModal(false)}
                  className="btn btn-outline btn-large"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <span className="info-value">{selectedAppointment.service_center?.name || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Địa chỉ:</span>
                    <span className="info-value">{selectedAppointment.service_center?.address || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Điện thoại:</span>
                    <span className="info-value">{selectedAppointment.service_center?.phone || 'Chưa cập nhật'}</span>
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

      {/* Full-screen detail panel (richer view) */}
      {showFullDetail && selectedServiceRecord && (
        <div
          className="full-detail-overlay"
          onClick={() => setShowFullDetail(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}
        >
          <div
            className="full-detail-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1100px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee' }}>
              <div>
                <h2 style={{ margin: 0 }}>Chi tiết dịch vụ #{selectedServiceRecord.id.slice(-8)}</h2>
                <div style={{ color: '#666', marginTop: '0.25rem' }}>{formatDate(selectedServiceRecord.service_date)}</div>
              </div>
              <div>
                <button className="btn btn-outline" onClick={() => setShowFullDetail(false)}>Đóng</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1rem', padding: '1.25rem' }}>
              <div>
                <section style={{ marginBottom: '1rem' }}>
                  <h3>Tổng quan</h3>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div className="info-item"><span className="info-label">🚗 Xe:</span> <span className="info-value">{selectedVehicle ? `${selectedVehicle.make || 'Chưa cập nhật'} ${selectedVehicle.model || 'Chưa cập nhật'} - ${selectedVehicle.license_plate || 'Chưa cập nhật'}` : 'Đang tải...'}</span></div>
                      {selectedServiceRecord.mileage_at_service && <div className="info-item"><span className="info-label">📊 Số km:</span> <span className="info-value">{selectedServiceRecord.mileage_at_service.toLocaleString()} km</span></div>}
                      {selectedServiceRecord.total_cost && <div className="info-item"><span className="info-label">💰 Tổng:</span> <span className="info-value">{selectedServiceRecord.total_cost.toLocaleString()} VND</span></div>}
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <div className="info-item"><span className="info-label">🏷️ Ghi chú nội bộ:</span> <span className="info-value">{selectedServiceRecord.internal_notes || '—'}</span></div>
                      <div className="info-item"><span className="info-label">🧾 Hoá đơn:</span> <span className="info-value">{selectedServiceRecord.invoice_id ? (<button className="btn btn-outline" onClick={() => navigate('/customer/payment', { state: { invoiceId: selectedServiceRecord.invoice_id } })}>Xem hoá đơn</button>) : 'Chưa tạo'}</span></div>
                      {selectedServiceRecord.service_center && (
                        <div className="info-item"><span className="info-label">🏢 Trung tâm:</span> <span className="info-value">{selectedServiceRecord.service_center.name || 'Chưa cập nhật'}</span></div>
                      )}
                    </div>
                  </div>
                </section>

                {selectedServiceRecord.services_performed && (
                  <section style={{ marginBottom: '1rem' }}>
                    <h3>Dịch vụ & Phụ tùng</h3>
                    <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#fafafa' }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Mục</th>
                            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Chi tiết</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem' }}>Số lượng</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem' }}>Giá</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(selectedServiceRecord.services_performed) ? (
                            selectedServiceRecord.services_performed.map((s, idx) => (
                              <tr key={idx} style={{ borderTop: '1px solid #f1f1f1' }}>
                                <td style={{ padding: '0.75rem' }}>{s.name || s.item}</td>
                                <td style={{ padding: '0.75rem' }}>{s.detail || s.description || '-'}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{s.quantity || '-'}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{s.price ? Number(s.price).toLocaleString() : '-'}</td>
                              </tr>
                            ))
                          ) : (
                            Object.entries(selectedServiceRecord.services_performed).map(([key, val]) => (
                              <tr key={key} style={{ borderTop: '1px solid #f1f1f1' }}>
                                <td style={{ padding: '0.75rem' }}>{key}</td>
                                <td style={{ padding: '0.75rem' }}>{String(val)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>—</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>—</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {selectedServiceRecord.diagnosis && (
                  <section style={{ marginBottom: '1rem' }}>
                    <h3>Chẩn đoán</h3>
                    <div style={{ padding: '0.75rem', background: '#fff3cd', borderRadius: 6 }}>{selectedServiceRecord.diagnosis}</div>
                  </section>
                )}

                {selectedServiceRecord.recommendations && (
                  <section style={{ marginBottom: '1rem' }}>
                    <h3>Khuyến nghị</h3>
                    <div style={{ padding: '0.75rem', background: '#d1ecf1', borderRadius: 6 }}>{selectedServiceRecord.recommendations}</div>
                  </section>
                )}
              </div>

              <aside>
                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                  <h4>Thông tin kỹ thuật viên</h4>
                  <div className="info-item"><span className="info-label">Tên:</span> <span className="info-value">{selectedServiceRecord.technician?.name || 'Chưa cập nhật'}</span></div>
                  <div className="info-item"><span className="info-label">Số điện thoại:</span> <span className="info-value">{selectedServiceRecord.technician?.phone || 'Chưa cập nhật'}</span></div>
                  <div className="info-item"><span className="info-label">Ghi chú kỹ thuật:</span> <span className="info-value">{selectedServiceRecord.technician_notes || 'Chưa có'}</span></div>
                </div>

                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                  <h4>Hình ảnh</h4>
                  {selectedServiceRecord.photos && selectedServiceRecord.photos.length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {selectedServiceRecord.photos.map((p, i) => (
                        <img key={i} src={p} alt={`photo-${i}`} style={{ width: '100%', borderRadius: 6 }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#666' }}>Không có ảnh</div>
                  )}
                </div>

                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem' }}>
                  <h4>Thông tin thanh toán</h4>
                  <div className="info-item"><span className="info-label">Trạng thái hoá đơn:</span> <span className="info-value">{selectedServiceRecord.invoice_status || 'Chưa tạo'}</span></div>
                  {selectedServiceRecord.total_cost && <div className="info-item"><span className="info-label">Tổng:</span> <span className="info-value">{selectedServiceRecord.total_cost.toLocaleString()} VND</span></div>}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceHistoryPage;
