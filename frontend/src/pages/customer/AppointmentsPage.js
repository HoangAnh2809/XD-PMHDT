import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { customerAPI } from '../../services/api';

const AppointmentsPage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAppointments();
      setAppointments(response.data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setMessage({
        type: 'error',
        text: 'Không thể tải danh sách lịch hẹn. Vui lòng thử lại.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) {
      return;
    }

    try {
      await customerAPI.cancelAppointment(appointmentId);
      setMessage({
        type: 'success',
        text: 'Hủy lịch hẹn thành công.'
      });
      // Reload appointments
      loadAppointments();
    } catch (error) {
      console.error('Error canceling appointment:', error);
      setMessage({
        type: 'error',
        text: 'Không thể hủy lịch hẹn. Vui lòng thử lại.'
      });
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'Chờ xác nhận',
      'confirmed': 'Đã xác nhận',
      'in_progress': 'Đang thực hiện',
      'completed': 'Hoàn thành',
      'cancelled': 'Đã hủy'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#ffa726',
      'confirmed': '#42a5f5',
      'in_progress': '#ab47bc',
      'completed': '#66bb6a',
      'cancelled': '#ef5350'
    };
    return colorMap[status] || '#666';
  };

  const getAppointmentTypeText = (type) => {
    const typeMap = {
      'service': 'Dịch vụ',
      'parts': 'Phụ tùng',
      'service_and_parts': 'Dịch vụ + Phụ tùng'
    };
    return typeMap[type] || type;
  };

  const formatDateTime = (dateTimeStr) => {
    // Parse as UTC time and convert to local time for display
    const utcDate = new Date(dateTimeStr + (dateTimeStr.includes('Z') ? '' : 'Z'));
    const localDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000));

    return {
      date: localDate.toLocaleDateString('vi-VN'),
      time: localDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (filterStatus === 'all') return true;
    return appointment.status === filterStatus;
  });

  const canCancelAppointment = (appointment) => {
    return appointment.status === 'pending';
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="container" style={{ textAlign: 'center', padding: '3rem' }}>
          <div>Đang tải danh sách lịch hẹn...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />

      <div className="hero">
        <h1>📅 Lịch hẹn của tôi</h1>
        <p>Quản lý các lịch hẹn bảo dưỡng và sửa chữa xe</p>
      </div>

      <div className="container">
        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ marginBottom: '2rem' }}>
            {message.text}
          </div>
        )}

        {/* Filter Controls */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>Lọc theo trạng thái:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-control"
                style={{ display: 'inline-block', width: 'auto', marginRight: '1rem' }}
              >
                <option value="all">Tất cả</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="in_progress">Đang thực hiện</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
            {/* <button
              onClick={() => navigate('/services')}
              className="btn btn-primary"
            >
              + Đặt lịch mới
            </button> */}
          </div>
        </div>

        {/* Appointments List */}
        {filteredAppointments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3>Không có lịch hẹn nào</h3>
            <p>Bạn chưa có lịch hẹn nào. Hãy đặt lịch bảo dưỡng ngay!</p>
            {/* <button
              onClick={() => navigate('/services')}
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
            >
              Đặt lịch ngay
            </button> */}
          </div>
        ) : (
          <div className="appointments-grid">
            {filteredAppointments.map((appointment) => {
              const dateTime = formatDateTime(appointment.appointment_date);
              return (
                <div key={appointment.id} className="card appointment-card">
                  <div className="card-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>Lịch hẹn #{appointment.id.slice(-8)}</h3>
                      <span
                        style={{
                          background: getStatusColor(appointment.status),
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.875rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {getStatusText(appointment.status)}
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    {/* Vehicle Info */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>🚗 Thông tin xe</h4>
                      <p style={{ margin: '0.25rem 0' }}>
                        <strong>{appointment.vehicle?.make} {appointment.vehicle?.model}</strong>
                      </p>
                      <p style={{ margin: '0.25rem 0', color: '#666' }}>
                        Biển số: {appointment.vehicle?.license_plate}
                      </p>
                    </div>

                    {/* Appointment Type */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>📋 Loại lịch hẹn</h4>
                      <p style={{ margin: '0.25rem 0', color: '#00d4ff', fontWeight: 'bold' }}>
                        {getAppointmentTypeText(appointment.appointment_type)}
                      </p>
                    </div>

                    {/* Service Info */}
                    {appointment.service_type && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4>🔧 Dịch vụ</h4>
                        <p style={{ margin: '0.25rem 0' }}>
                          <strong>{appointment.service_type?.name}</strong>
                        </p>
                        {appointment.service_type?.base_price && (
                          <p style={{ margin: '0.25rem 0', color: '#666' }}>
                            Giá cơ bản: {appointment.service_type.base_price.toLocaleString('vi-VN')} VNĐ
                          </p>
                        )}
                      </div>
                    )}

                    {/* Parts Info */}
                    {appointment.parts && appointment.parts.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4>🔩 Phụ tùng ({appointment.parts.length} loại)</h4>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', padding: '0.5rem' }}>
                          {appointment.parts.map((part, index) => (
                            <div key={index} style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: index < appointment.parts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                              <div style={{ fontWeight: 'bold' }}>{part.name}</div>
                              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                {part.part_number} - Số lượng: {part.quantity} - Giá: {(part.unit_price * part.quantity).toLocaleString('vi-VN')} VNĐ
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Service Center Info */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>🏢 Trung tâm dịch vụ</h4>
                      <p style={{ margin: '0.25rem 0' }}>
                        <strong>{appointment.service_center?.name}</strong>
                      </p>
                      <p style={{ margin: '0.25rem 0', color: '#666' }}>
                        {appointment.service_center?.address}
                      </p>
                    </div>

                    {/* Date & Time */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>📅 Thời gian</h4>
                      <p style={{ margin: '0.25rem 0' }}>
                        <strong>{dateTime.date}</strong> lúc <strong>{dateTime.time}</strong>
                      </p>
                    </div>

                    {/* Cost Info */}
                    {(appointment.estimated_cost || appointment.actual_cost) && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4>💰 Chi phí</h4>
                        {appointment.estimated_cost && (
                          <p style={{ margin: '0.25rem 0', color: '#ffa726' }}>
                            Ước tính: {appointment.estimated_cost.toLocaleString('vi-VN')} VNĐ
                          </p>
                        )}
                        {appointment.actual_cost && (
                          <p style={{ margin: '0.25rem 0', color: '#66bb6a' }}>
                            Thực tế: {appointment.actual_cost.toLocaleString('vi-VN')} VNĐ
                          </p>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {appointment.customer_notes && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4>📝 Ghi chú</h4>
                        <p style={{ margin: '0.25rem 0', fontStyle: 'italic' }}>
                          {appointment.customer_notes}
                        </p>
                      </div>
                    )}

                    {/* Staff Notes */}
                    {appointment.staff_notes && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4>👨‍🔧 Ghi chú từ nhân viên</h4>
                        <p style={{ margin: '0.25rem 0', fontStyle: 'italic', color: '#666' }}>
                          {appointment.staff_notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                      {canCancelAppointment(appointment) && (
                        <button
                          onClick={() => handleCancelAppointment(appointment.id)}
                          className="btn btn-outline"
                          style={{ marginRight: '0.5rem', borderColor: '#ef5350', color: '#ef5350' }}
                        >
                          Hủy lịch hẹn
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/customer/chat`)}
                        className="btn btn-primary"
                      >
                        💬 Liên hệ hỗ trợ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .appointments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 1.5rem;
        }

        .appointment-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .card-header {
          border-bottom: 1px solid #eee;
          padding-bottom: 1rem;
          margin-bottom: 1rem;
        }

        .card-body h4 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .appointments-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AppointmentsPage;