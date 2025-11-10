import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import { staffAPI, invoiceAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function ManageAppointmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'timeline'
  const [message, setMessage] = useState({ type: '', text: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [customerIndex, setCustomerIndex] = useState(new Map());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterAppointments();
  }, [filterStatus, searchTerm, appointments, dateFrom, dateTo]);

  const exportToCSV = () => {
    const headers = [
      'ID Lịch hẹn',
      'Ngày đặt lịch',
      'Thời gian đặt lịch',
      'Ngày hẹn',
      'Thời gian hẹn',
      'Trạng thái',
      'Tên khách hàng',
      'Số điện thoại',
      'Email',
      'Địa chỉ',
      'Biển số xe',
      'Hãng xe',
      'Mẫu xe',
      'Năm sản xuất',
      'Số km hiện tại',
      'Kỹ thuật viên',
      'Dịch vụ',
      'Giá dự kiến',
      'Giá thực tế',
      'Ghi chú khách hàng',
      'Ghi chú nhân viên'
    ];

    const csvData = filteredAppointments.map(appointment => [
      appointment.id,
      formatDateTime(appointment.created_at).split(' ')[0], // Ngày đặt lịch
      formatDateTime(appointment.created_at).split(' ')[1] || '', // Thời gian đặt lịch
      formatDateTime(appointment.scheduled_date).split(' ')[0], // Ngày hẹn
      formatDateTime(appointment.scheduled_date).split(' ')[1] || '', // Thời gian hẹn
      getStatusText(appointment.status),
      appointment.customer?.full_name || '',
      appointment.customer?.phone || '',
      appointment.customer?.email || '',
      appointment.customer?.address || '',
      appointment.vehicle?.license_plate || '',
      appointment.vehicle?.make || '',
      appointment.vehicle?.model || '',
      appointment.vehicle?.year || '',
      appointment.vehicle?.current_mileage || '',
      appointment.technician?.full_name || '',
      appointment.service_type?.name || '',
      appointment.estimated_cost ? `${appointment.estimated_cost.toLocaleString()} VND` : '',
      appointment.actual_cost ? `${appointment.actual_cost.toLocaleString()} VND` : '',
      appointment.customer_notes || '',
      appointment.staff_notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lich-hen-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const loadData = async () => {
    setLoading(true);
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
      console.warn('Skipping appointments/technicians API calls: insufficient role', user?.role);
      setMessage({ type: 'warning', text: 'Bạn không có quyền xem trang này.' });
      setAppointments([]);
      setTechnicians([]);
      setLoading(false);
      return;
    }
    try {
      const [appointmentsRes, techniciansRes] = await Promise.all([
        staffAPI.getAppointments(),
        staffAPI.getTechnicians()
      ]);
      
      // Sort by date, newest first
      const sorted = (appointmentsRes.data || []).sort((a, b) => 
        new Date(b.scheduled_date) - new Date(a.scheduled_date)
      );
      
      setAppointments(sorted);
      setTechnicians(techniciansRes.data || []);
      generateCustomerIndex(sorted);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Không thể tải dữ liệu' });
      setAppointments([]);
      setTechnicians([]);
    }
    setLoading(false);
  };

  // Generate sequential customer IDs
  const generateCustomerIndex = (appointments) => {
    const customerMap = new Map();
    let index = 1;
    
    appointments.forEach(appointment => {
      if (appointment.customer?.id && !customerMap.has(appointment.customer.id)) {
        customerMap.set(appointment.customer.id, index++);
      }
    });
    
    setCustomerIndex(customerMap);
  };

  // Helper function to get customer sequential ID
  const getCustomerSequentialId = (customerId) => {
    return customerIndex.get(customerId) || 'N/A';
  };

  const filterAppointments = () => {
    let filtered = appointments;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(apt => apt.status === filterStatus);
    }

    // Filter by date range (booking date)
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(apt => new Date(apt.created_at) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(apt => new Date(apt.created_at) <= toDate);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt =>
        apt.customer?.full_name?.toLowerCase().includes(term) ||
        apt.customer?.phone?.includes(term) ||
        apt.vehicle?.license_plate?.toLowerCase().includes(term) ||
        apt.id?.toString().includes(term)
      );
    }

    setFilteredAppointments(filtered);
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      await staffAPI.updateAppointmentStatus(appointmentId, { status: newStatus });
      setMessage({ type: 'success', text: 'Cập nhật trạng thái thành công!' });
      
      // Nếu hoàn thành appointment, tạo invoice và hiển thị
      if (newStatus === 'completed') {
        try {
          const invoiceResponse = await invoiceAPI.generateInvoiceForAppointment(appointmentId);
          setCurrentInvoice(invoiceResponse.data);
          setShowInvoiceModal(true);
          setMessage({ type: 'success', text: 'Hoàn thành dịch vụ và tạo hóa đơn thành công!' });
        } catch (invoiceError) {
          console.error('Error generating invoice:', invoiceError);
          setMessage({ type: 'warning', text: 'Hoàn thành dịch vụ thành công nhưng không thể tạo hóa đơn tự động.' });
        }
      }
      
      loadData();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      setMessage({ type: 'error', text: 'Không thể cập nhật trạng thái' });
    }
  };

  const assignTechnician = async () => {
    if (!selectedTechnician) {
      setMessage({ type: 'error', text: 'Vui lòng chọn kỹ thuật viên' });
      return;
    }

    try {
      await staffAPI.assignTechnician(selectedAppointment.id, {
        technician_id: selectedTechnician // UUID string, không cần parseInt
      });
      
      setMessage({ type: 'success', text: 'Phân công kỹ thuật viên thành công!' });
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      console.error('Error assigning technician:', error);
      setMessage({ type: 'error', text: 'Không thể phân công kỹ thuật viên' });
    }
  };

  const deleteAppointment = async () => {
    if (!appointmentToDelete) return;

    try {
      await staffAPI.deleteAppointment(appointmentToDelete.id);
      setMessage({ type: 'success', text: 'Xóa lịch hẹn thành công!' });
      setShowDeleteModal(false);
      setAppointmentToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      
      // Provide more specific error messages based on status
      let errorMessage = 'Không thể xóa lịch hẹn.';
      
      if (error.response) {
        if (error.response.status === 400) {
          errorMessage = 'Không thể xóa lịch hẹn đang thực hiện hoặc đã hoàn thành.';
        } else if (error.response.status === 404) {
          errorMessage = 'Lịch hẹn không tồn tại.';
        } else if (error.response.status === 403) {
          errorMessage = 'Bạn không có quyền xóa lịch hẹn này.';
        }
      } else {
        errorMessage = 'Lỗi kết nối. Vui lòng thử lại sau.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  const printServiceReceipt = (appointment) => {
    // Create printable content
    const printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
        <h1 style="text-align: center; color: #1a1a2e;">PHIẾU TIẾP NHẬN DỊCH VỤ</h1>
        <hr/>
        <h3>Thông tin khách hàng</h3>
        <p><strong>Họ tên:</strong> ${appointment.customer?.full_name || 'N/A'}</p>
        <p><strong>Số điện thoại:</strong> ${appointment.customer?.phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${appointment.customer?.email || 'N/A'}</p>
        
        <h3>Thông tin xe</h3>
        <p><strong>Xe:</strong> ${appointment.vehicle?.make} ${appointment.vehicle?.model}</p>
        <p><strong>Biển số:</strong> ${appointment.vehicle?.license_plate}</p>
        <p><strong>VIN:</strong> ${appointment.vehicle?.vin || 'N/A'}</p>
        
        <h3>Thông tin dịch vụ</h3>
        <p><strong>Mã lịch hẹn:</strong> #${appointment.id}</p>
        <p><strong>Loại dịch vụ:</strong> ${appointment.service_type?.name || 'N/A'}</p>
        <p><strong>Trung tâm:</strong> ${appointment.service_center?.name || 'N/A'}</p>
        <p><strong>Thời gian hẹn:</strong> ${formatDateTime(appointment.scheduled_date)}</p>
        <p><strong>Ghi chú:</strong> ${appointment.notes || 'Không có'}</p>
        
        <hr/>
        <p style="text-align: center; margin-top: 40px;">
          <strong>Chữ ký khách hàng</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Chữ ký nhân viên</strong>
        </p>
      </div>
    `;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
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

  const getStatusStats = () => {
    return {
      total: appointments.length,
      pending: appointments.filter(a => a.status === 'pending').length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length,
      in_progress: appointments.filter(a => a.status === 'in_progress').length,
      completed: appointments.filter(a => a.status === 'completed').length
    };
  };

  if (loading) {
    return (
      <StaffLayout>
        <div className="loading">Đang tải dữ liệu...</div>
      </StaffLayout>
    );
  }

  const stats = getStatusStats();

  return (
    <StaffLayout>
      <div className="container">
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        {/* Statistics */}
        <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-label">Tổng lịch hẹn</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Chờ xác nhận</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
          <div className="stat-card primary">
            <div className="stat-label">Đã xác nhận</div>
            <div className="stat-value">{stats.confirmed}</div>
          </div>
          <div className="stat-card info">
            <div className="stat-label">Đang thực hiện</div>
            <div className="stat-value">{stats.in_progress}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Hoàn thành</div>
            <div className="stat-value">{stats.completed}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="filters-bar">
            <div className="filter-group">
              <label>Lọc theo trạng thái:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-control"
                style={{ width: '200px' }}
              >
                <option value="all">Tất cả</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="in_progress">Đang thực hiện</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Ngày đặt lịch từ:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="form-control"
                style={{ width: '150px' }}
              />
            </div>

            <div className="filter-group">
              <label>Đến:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="form-control"
                style={{ width: '150px' }}
              />
            </div>

            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo tên KH, SĐT, biển số..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ flex: 1, maxWidth: '400px' }}
            />

            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setFilterStatus('all');
                setSearchTerm('');
              }}
              className="btn btn-outline"
              title="Xóa tất cả bộ lọc"
            >
              🧹 Xóa lọc
            </button>

            <button
              onClick={loadData}
              className="btn btn-secondary"
              disabled={loading}
              title="Làm mới dữ liệu"
            >
              {loading ? '⏳' : '🔄'} Làm mới
            </button>

            <button
              onClick={exportToCSV}
              className="btn btn-success"
              disabled={filteredAppointments.length === 0}
              title="Xuất dữ liệu ra file CSV"
            >
              📊 Xuất CSV
            </button>

            <div className="search-stats">
              Hiển thị <strong>{filteredAppointments.length}</strong> lịch hẹn
            </div>
          </div>
        </div>
        {/* View Mode Selector */}
        <div className="view-selector">
          <div className="view-buttons">
            <button
              onClick={() => setViewMode('cards')}
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            >
              📋 Card View
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            >
              ⏰ Timeline View
            </button>
          </div>
        </div>
        <div className="appointments-container">
          {filteredAppointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>Không tìm thấy lịch hẹn</h3>
              <p>
                {searchTerm || filterStatus !== 'all' || dateFrom || dateTo
                  ? 'Thử điều chỉnh bộ lọc hoặc tìm kiếm khác'
                  : 'Chưa có lịch hẹn nào được tạo'
                }
              </p>
              {(searchTerm || filterStatus !== 'all' || dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setFilterStatus('all');
                    setSearchTerm('');
                  }}
                  className="btn btn-primary"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="appointments-grid">
              {filteredAppointments.map((appointment) => (
                <div key={appointment.id} className={`appointment-card ${appointment.status}`}>
                  <div className="card-header">
                    <div className="appointment-id">#{appointment.id}</div>
                    <div className="status-badge">
                      {getStatusBadge(appointment.status)}
                    </div>
                  </div>

                  <div className="card-body">
                    {/* Customer Info */}
                    <div className="customer-section">
                      <div className="customer-avatar">
                        {appointment.customer?.avatar_url ? (
                          <img
                            src={`http://localhost:8001${appointment.customer.avatar_url}`}
                            alt="Avatar"
                            className="avatar-img"
                          />
                        ) : (
                          <div className="avatar-placeholder">
                            {appointment.customer?.full_name?.charAt(0)?.toUpperCase() || 'N'}
                          </div>
                        )}
                      </div>
                      <div className="customer-details">
                        <h4 className="customer-name">{appointment.customer?.full_name || 'Khách hàng'}</h4>
                        <div className="customer-contact">
                          <span>📞 {appointment.customer?.phone || 'Chưa cập nhật'}</span>
                          <span>📧 {appointment.customer?.email || 'Chưa cập nhật'}</span>
                        </div>
                        {appointment.customer?.address && (
                          <div className="customer-address" title={appointment.customer.address}>
                            📍 {appointment.customer.address.length > 30
                              ? `${appointment.customer.address.substring(0, 30)}...`
                              : appointment.customer.address}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="vehicle-section">
                      <div className="vehicle-icon">🚗</div>
                      <div className="vehicle-details">
                        <div className="vehicle-name">
                          {appointment.vehicle?.make || 'Hãng'} {appointment.vehicle?.model || 'Mẫu'}
                        </div>
                        <div className="vehicle-meta">
                          <span className="license-plate">{appointment.vehicle?.license_plate || 'Chưa cập nhật'}</span>
                          {appointment.vehicle?.year && (
                            <span className="year">• {appointment.vehicle.year}</span>
                          )}
                          {appointment.vehicle?.current_mileage && (
                            <span className="mileage">• {appointment.vehicle.current_mileage.toLocaleString()} km</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Service Info */}
                    <div className="service-section">
                      <div className="service-icon">🔧</div>
                      <div className="service-details">
                        <div className="service-name">{appointment.service_type?.name || 'Dịch vụ chưa xác định'}</div>
                        <div className="service-center">{appointment.service_center?.name || 'Trung tâm chưa xác định'}</div>
                      </div>
                    </div>

                    {/* Technician Info */}
                    <div className="technician-section">
                      <div className="technician-icon">👷</div>
                      <div className="technician-details">
                        <div className="technician-name">
                          {appointment.technician?.full_name || 'Chưa phân công kỹ thuật viên'}
                        </div>
                        {appointment.technician?.specialization && (
                          <div className="technician-specialty">
                            {appointment.technician.specialization}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="dates-section">
                      <div className="date-item">
                        <div className="date-label">📅 Đặt lịch:</div>
                        <div className="date-value">
                          <div className="date">{new Date(appointment.created_at).toLocaleDateString('vi-VN')}</div>
                          <div className="time">{new Date(appointment.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                      <div className="date-item">
                        <div className="date-label">🕐 Hẹn đến:</div>
                        <div className="date-value">
                          <div className="date">{formatDate(appointment.scheduled_date) || 'Chưa xác định'}</div>
                          <div className="time">
                            {appointment.scheduled_date ?
                              new Date(appointment.scheduled_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                              : 'Chưa xác định'
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {(appointment.customer_notes || appointment.staff_notes) && (
                      <div className="notes-section">
                        {appointment.customer_notes && (
                          <div className="note-item customer-note">
                            <span className="note-icon">💬</span>
                            <span className="note-text" title={appointment.customer_notes}>
                              {appointment.customer_notes.length > 50
                                ? `${appointment.customer_notes.substring(0, 50)}...`
                                : appointment.customer_notes}
                            </span>
                          </div>
                        )}
                        {appointment.staff_notes && (
                          <div className="note-item staff-note">
                            <span className="note-icon">👨‍💼</span>
                            <span className="note-text" title={appointment.staff_notes}>
                              {appointment.staff_notes.length > 50
                                ? `${appointment.staff_notes.substring(0, 50)}...`
                                : appointment.staff_notes}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pricing */}
                    {(appointment.estimated_cost || appointment.actual_cost) && (
                      <div className="pricing-section">
                        {appointment.estimated_cost && (
                          <div className="price-item">
                            <span className="price-label">Giá dự kiến:</span>
                            <span className="price-value">{appointment.estimated_cost.toLocaleString()} VNĐ</span>
                          </div>
                        )}
                        {appointment.actual_cost && (
                          <div className="price-item actual">
                            <span className="price-label">Giá thực tế:</span>
                            <span className="price-value">{appointment.actual_cost.toLocaleString()} VNĐ</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="card-actions">
                    <button
                      onClick={() => {
                        setSelectedAppointment(appointment);
                        setShowDetailModal(true);
                      }}
                      className="btn btn-sm btn-outline"
                      title="Chi tiết"
                    >
                      👁️ Xem chi tiết
                    </button>

                    <button
                      onClick={() => {
                        setSelectedAppointment(appointment);
                        setShowAssignModal(true);
                      }}
                      className="btn btn-sm btn-secondary"
                      title="Phân công"
                    >
                      👷 Phân công
                    </button>

                    {(appointment.status === 'in_progress' || appointment.status === 'confirmed') && (
                      <button
                        onClick={() => navigate(`/staff/appointments/${appointment.id}/checklist`)}
                        className="btn btn-sm btn-success"
                        title="Checklist"
                      >
                        ✓ Checklist
                      </button>
                    )}

                    <button
                      onClick={() => printServiceReceipt(appointment)}
                      className="btn btn-sm btn-outline"
                      title="In phiếu"
                    >
                      🖨️ In phiếu
                    </button>

                    {appointment.status !== 'in_progress' && appointment.status !== 'completed' && (
                      <button
                        onClick={() => {
                          setAppointmentToDelete(appointment);
                          setShowDeleteModal(true);
                        }}
                        className="btn btn-sm btn-danger"
                        title="Xóa lịch hẹn"
                      >
                        🗑️ Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="timeline-container">
              {filteredAppointments
                .sort((a, b) => {
                  const dateA = new Date(a.scheduled_date || a.created_at);
                  const dateB = new Date(b.scheduled_date || b.created_at);
                  return dateA - dateB;
                })
                .map((appointment, index, sortedAppointments) => {
                  const currentDate = new Date(appointment.scheduled_date || appointment.created_at);
                  const prevDate = index > 0 ? new Date(sortedAppointments[index - 1].scheduled_date || sortedAppointments[index - 1].created_at) : null;
                  const showDateHeader = !prevDate || currentDate.toDateString() !== prevDate.toDateString();

                  return (
                    <div key={appointment.id}>
                      {showDateHeader && (
                        <div className="timeline-date-header">
                          <div className="date-badge">
                            📅 {currentDate.toLocaleDateString('vi-VN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      )}

                      <div className="timeline-item">
                        <div className="timeline-marker">
                          <div className={`status-indicator ${appointment.status}`}>
                            {appointment.status === 'pending' && '⏳'}
                            {appointment.status === 'confirmed' && '✅'}
                            {appointment.status === 'in_progress' && '🔧'}
                            {appointment.status === 'completed' && '🎉'}
                            {appointment.status === 'cancelled' && '❌'}
                          </div>
                        </div>

                        <div className="timeline-content">
                          <div className="timeline-card">
                            <div className="timeline-header">
                              <div className="appointment-info">
                                <div className="appointment-id">#{appointment.id}</div>
                                <div className="appointment-time">
                                  {appointment.scheduled_date ?
                                    new Date(appointment.scheduled_date).toLocaleTimeString('vi-VN', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                    : 'Chưa xác định'
                                  }
                                </div>
                              </div>
                              <div className="status-badge">
                                {getStatusBadge(appointment.status)}
                              </div>
                            </div>

                            <div className="timeline-body">
                              <div className="customer-info">
                                <div className="customer-avatar">
                                  {appointment.customer?.avatar_url ? (
                                    <img
                                      src={`http://localhost:8001${appointment.customer.avatar_url}`}
                                      alt="Avatar"
                                      className="avatar-img"
                                    />
                                  ) : (
                                    <div className="avatar-placeholder">
                                      {appointment.customer?.full_name?.charAt(0)?.toUpperCase() || 'K'}
                                    </div>
                                  )}
                                </div>
                                <div className="customer-details">
                                  <div className="customer-name">{appointment.customer?.full_name || 'Khách hàng'}</div>
                                  <div className="customer-contact">
                                    📞 {appointment.customer?.phone || 'Chưa cập nhật'}
                                  </div>
                                </div>
                              </div>

                              <div className="service-info">
                                <div className="service-name">
                                  🔧 {appointment.service_type?.name || 'Dịch vụ chưa xác định'}
                                </div>
                                <div className="vehicle-name">
                                  🚗 {appointment.vehicle?.make} {appointment.vehicle?.model} - {appointment.vehicle?.license_plate || 'Chưa cập nhật'}
                                </div>
                              </div>

                              <div className="technician-info">
                                <div className="technician-name">
                                  👷 {appointment.technician?.full_name || 'Chưa phân công'}
                                </div>
                                <div className="service-center">
                                  🏢 {appointment.service_center?.name || 'Trung tâm chưa xác định'}
                                </div>
                              </div>

                              {(appointment.customer_notes || appointment.staff_notes) && (
                                <div className="notes-preview">
                                  {appointment.customer_notes && (
                                    <div className="note-preview">
                                      💬 {appointment.customer_notes.length > 40
                                        ? `${appointment.customer_notes.substring(0, 40)}...`
                                        : appointment.customer_notes}
                                    </div>
                                  )}
                                  {appointment.staff_notes && (
                                    <div className="note-preview">
                                      👨‍💼 {appointment.staff_notes.length > 40
                                        ? `${appointment.staff_notes.substring(0, 40)}...`
                                        : appointment.staff_notes}
                                    </div>
                                  )}
                                </div>
                              )}

                              {(appointment.estimated_cost || appointment.actual_cost) && (
                                <div className="pricing-preview">
                                  {appointment.estimated_cost && (
                                    <span className="price">💰 Dự kiến: {appointment.estimated_cost.toLocaleString()} VNĐ</span>
                                  )}
                                  {appointment.actual_cost && (
                                    <span className="price actual">💰 Thực tế: {appointment.actual_cost.toLocaleString()} VNĐ</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="timeline-actions">
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowDetailModal(true);
                                }}
                                className="btn btn-sm btn-outline"
                                title="Chi tiết"
                              >
                                👁️ Chi tiết
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowAssignModal(true);
                                }}
                                className="btn btn-sm btn-secondary"
                                title="Phân công"
                              >
                                👷 Phân công
                              </button>

                              {(appointment.status === 'in_progress' || appointment.status === 'confirmed') && (
                                <button
                                  onClick={() => navigate(`/staff/appointments/${appointment.id}/checklist`)}
                                  className="btn btn-sm btn-success"
                                  title="Checklist"
                                >
                                  ✓ Checklist
                                </button>
                              )}

                              <button
                                onClick={() => printServiceReceipt(appointment)}
                                className="btn btn-sm btn-outline"
                                title="In phiếu"
                              >
                                🖨️ In phiếu
                              </button>

                              {appointment.status !== 'in_progress' && appointment.status !== 'completed' && (
                                <button
                                  onClick={() => {
                                    setAppointmentToDelete(appointment);
                                    setShowDeleteModal(true);
                                  }}
                                  className="btn btn-sm btn-danger"
                                  title="Xóa lịch hẹn"
                                >
                                  🗑️ Xóa
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            
            <div className="modal-header">
              <h2>📋 Chi tiết lịch hẹn #{selectedAppointment.id}</h2>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h3>👤 Thông tin khách hàng</h3>
                <div className="customer-profile-header">
                  <div className="customer-avatar">
                    {selectedAppointment.customer?.avatar_url ? (
                      <img 
                        src={`http://localhost:8001${selectedAppointment.customer.avatar_url}`} 
                        alt="Avatar" 
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {selectedAppointment.customer?.full_name?.charAt(0)?.toUpperCase() || 'N'}
                      </div>
                    )}
                  </div>
                  <div className="customer-basic-info">
                    <h4>{selectedAppointment.customer?.full_name}</h4>
                    <div className="customer-meta">
                      <span className="customer-id">ID: {getCustomerSequentialId(selectedAppointment.customer?.id)}</span>
                      <span className="customer-created">
                        Khách hàng từ: {selectedAppointment.customer?.created_at ? 
                          new Date(selectedAppointment.customer.created_at).toLocaleDateString('vi-VN') 
                          : 'Chưa cập nhật'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">📞 Số điện thoại:</span>
                    <span className="info-value">{selectedAppointment.customer?.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">📧 Email:</span>
                    <span className="info-value">{selectedAppointment.customer?.email || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">🏠 Địa chỉ:</span>
                    <span className="info-value">{selectedAppointment.customer?.address || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">🎂 Ngày sinh:</span>
                    <span className="info-value">
                      {selectedAppointment.customer?.date_of_birth 
                        ? new Date(selectedAppointment.customer.date_of_birth).toLocaleDateString('vi-VN')
                        : 'Chưa cập nhật'
                      }
                    </span>
                  </div>
                  <div className="info-item full-width">
                    <span className="info-label">🚨 Người liên hệ khẩn cấp:</span>
                    <span className="info-value">{selectedAppointment.customer?.emergency_contact || 'Chưa cập nhật'}</span>
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
                    <span className="info-label">Mẫu xe:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.model}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Năm sản xuất:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.year}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Biển số:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.license_plate}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Màu sắc:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.color}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">VIN:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.vin || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Dung lượng pin:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.battery_capacity ? `${selectedAppointment.vehicle.battery_capacity} kWh` : 'Chưa cập nhật'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Số km hiện tại:</span>
                    <span className="info-value">{selectedAppointment.vehicle?.current_mileage ? `${selectedAppointment.vehicle.current_mileage.toLocaleString()} km` : 'Chưa cập nhật'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>💰 Thông tin thanh toán</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Giá dự kiến:</span>
                    <span className="info-value">
                      {selectedAppointment.estimated_cost 
                        ? `${selectedAppointment.estimated_cost.toLocaleString()} VNĐ` 
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Giá thực tế:</span>
                    <span className="info-value">
                      {selectedAppointment.actual_cost 
                        ? `${selectedAppointment.actual_cost.toLocaleString()} VNĐ` 
                        : 'Chưa có'
                      }
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Trạng thái thanh toán:</span>
                    <span className="info-value">
                      {selectedAppointment.payment_status === 'paid' ? '✅ Đã thanh toán' :
                       selectedAppointment.payment_status === 'pending' ? '⏳ Chờ thanh toán' :
                       selectedAppointment.payment_status === 'failed' ? '❌ Thanh toán thất bại' :
                       '💰 Chưa thanh toán'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Phương thức thanh toán:</span>
                    <span className="info-value">
                      {selectedAppointment.payment_method === 'cash' ? '💵 Tiền mặt' :
                       selectedAppointment.payment_method === 'vnpay' ? '🏦 VNPay' :
                       selectedAppointment.payment_method === 'momo' ? '📱 MoMo' :
                       selectedAppointment.payment_method === 'sepay' ? '🏪 SePay' :
                       selectedAppointment.payment_method === 'bank_transfer' ? '🏦 Chuyển khoản' :
                       'Chưa chọn'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>🔧 Thông tin dịch vụ</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Dịch vụ:</span>
                    <span className="info-value">{selectedAppointment.service_type?.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Trung tâm:</span>
                    <span className="info-value">{selectedAppointment.service_center?.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Thời gian ước tính:</span>
                    <span className="info-value">
                      {selectedAppointment.service_type?.estimated_duration || 'Chưa cập nhật'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Bảo hành:</span>
                    <span className="info-value">
                      {selectedAppointment.service_type?.warranty_period || 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>📅 Thông tin lịch hẹn</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Mã lịch hẹn:</span>
                    <span className="info-value">#{selectedAppointment.id}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Thời gian đặt lịch:</span>
                    <span className="info-value">
                      {selectedAppointment.created_at 
                        ? new Date(selectedAppointment.created_at).toLocaleString('vi-VN')
                        : 'Chưa cập nhật'
                      }
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Thời gian hẹn:</span>
                    <span className="info-value">{formatDateTime(selectedAppointment.appointment_date || selectedAppointment.scheduled_date)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Cập nhật lần cuối:</span>
                    <span className="info-value">
                      {selectedAppointment.updated_at 
                        ? new Date(selectedAppointment.updated_at).toLocaleString('vi-VN')
                        : 'Chưa cập nhật'
                      }
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Trạng thái:</span>
                    <span className="info-value">{getStatusBadge(selectedAppointment.status)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Ưu tiên:</span>
                    <span className="info-value">
                      {selectedAppointment.priority === 'high' ? '🔴 Cao' : 
                       selectedAppointment.priority === 'medium' ? '🟡 Trung bình' : '🟢 Thấp'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>💬 Ghi chú & Lý do</h3>
                <div className="notes-section">
                  {selectedAppointment.customer_notes && (
                    <div className="note-item">
                      <h4>📝 Ghi chú của khách hàng:</h4>
                      <p className="note-content">{selectedAppointment.customer_notes}</p>
                    </div>
                  )}
                  {selectedAppointment.staff_notes && (
                    <div className="note-item">
                      <h4>👨‍💼 Ghi chú của nhân viên:</h4>
                      <p className="note-content">{selectedAppointment.staff_notes}</p>
                    </div>
                  )}
                  {(!selectedAppointment.customer_notes && !selectedAppointment.staff_notes) && (
                    <p className="no-notes">Không có ghi chú nào.</p>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>📊 Lịch sử cập nhật</h3>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-marker">📅</div>
                    <div className="timeline-content">
                      <div className="timeline-title">Tạo lịch hẹn</div>
                      <div className="timeline-time">
                        {selectedAppointment.created_at 
                          ? new Date(selectedAppointment.created_at).toLocaleString('vi-VN')
                          : 'Chưa cập nhật'
                        }
                      </div>
                    </div>
                  </div>
                  
                  {selectedAppointment.status !== 'pending' && (
                    <div className="timeline-item">
                      <div className="timeline-marker">
                        {selectedAppointment.status === 'confirmed' ? '✅' :
                         selectedAppointment.status === 'in_progress' ? '🔧' :
                         selectedAppointment.status === 'completed' ? '🎉' : '❌'}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-title">
                          {selectedAppointment.status === 'confirmed' ? 'Xác nhận lịch hẹn' :
                           selectedAppointment.status === 'in_progress' ? 'Bắt đầu thực hiện' :
                           selectedAppointment.status === 'completed' ? 'Hoàn thành' : 'Hủy lịch hẹn'}
                        </div>
                        <div className="timeline-time">
                          {selectedAppointment.updated_at 
                            ? new Date(selectedAppointment.updated_at).toLocaleString('vi-VN')
                            : 'Chưa cập nhật'
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>⚙️ Cập nhật trạng thái</h3>
                <div className="status-actions">
                  {selectedAppointment.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => updateAppointmentStatus(selectedAppointment.id, 'confirmed')}
                        className="btn btn-success"
                      >
                        ✅ Xác nhận lịch hẹn
                      </button>
                      <button 
                        onClick={() => updateAppointmentStatus(selectedAppointment.id, 'cancelled')}
                        className="btn btn-danger"
                      >
                        ❌ Hủy lịch hẹn
                      </button>
                    </>
                  )}
                  {selectedAppointment.status === 'confirmed' && (
                    <button 
                      onClick={() => updateAppointmentStatus(selectedAppointment.id, 'in_progress')}
                      className="btn btn-primary"
                    >
                      🔧 Bắt đầu thực hiện
                    </button>
                  )}
                  {selectedAppointment.status === 'in_progress' && (
                    <button 
                      onClick={() => updateAppointmentStatus(selectedAppointment.id, 'completed')}
                      className="btn btn-success"
                    >
                      ✅ Hoàn thành
                    </button>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => printServiceReceipt(selectedAppointment)} className="btn btn-outline">
                  🖨️ In phiếu tiếp nhận
                </button>
                {selectedAppointment.status !== 'in_progress' && selectedAppointment.status !== 'completed' && (
                  <button 
                    onClick={() => {
                      setAppointmentToDelete(selectedAppointment);
                      setShowDeleteModal(true);
                      setShowDetailModal(false);
                    }} 
                    className="btn btn-danger"
                  >
                    🗑️ Xóa lịch hẹn
                  </button>
                )}
                <button onClick={() => setShowDetailModal(false)} className="btn btn-outline">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Technician Modal */}
      {showAssignModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAssignModal(false)}>✕</button>
            
            <div className="modal-header">
              <h2>👷 Phân công kỹ thuật viên</h2>
            </div>
            
            <div className="modal-body">
              <p><strong>Lịch hẹn:</strong> #{selectedAppointment.id} - {selectedAppointment.service_type?.name}</p>
              <p><strong>Khách hàng:</strong> {selectedAppointment.customer?.full_name}</p>
              
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>Chọn kỹ thuật viên:</label>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="form-control"
                >
                  <option value="">-- Chọn kỹ thuật viên --</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.full_name || tech.username} - {tech.specialty || 'Kỹ thuật viên'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button onClick={assignTechnician} className="btn btn-primary">
                  ✅ Xác nhận phân công
                </button>
                <button onClick={() => setShowAssignModal(false)} className="btn btn-outline">
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Appointment Modal */}
      {showDeleteModal && appointmentToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            
            <div className="modal-header">
              <h2>🗑️ Xóa lịch hẹn</h2>
            </div>
            
            <div className="modal-body">
              <p>Bạn có chắc chắn muốn xóa lịch hẹn #{appointmentToDelete.id} không?</p>
              
              <div className="modal-actions">
                <button onClick={deleteAppointment} className="btn btn-danger">
                  ✅ Xóa lịch hẹn
                </button>
                <button onClick={() => setShowDeleteModal(false)} className="btn btn-outline">
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && currentInvoice && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInvoiceModal(false)}>✕</button>
            
            <div className="modal-header">
              <h2>🧾 Hóa đơn dịch vụ</h2>
              <div className="invoice-number">#{currentInvoice.invoice_number}</div>
            </div>
            
            <div className="modal-body">
              <div className="invoice-details">
                <div className="invoice-section">
                  <h3>Thông tin khách hàng</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Họ tên:</span>
                      <span className="info-value">{currentInvoice.customer?.full_name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Số điện thoại:</span>
                      <span className="info-value">{currentInvoice.customer?.phone}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Email:</span>
                      <span className="info-value">{currentInvoice.customer?.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Địa chỉ:</span>
                      <span className="info-value">{currentInvoice.customer?.address}</span>
                    </div>
                  </div>
                </div>

                <div className="invoice-section">
                  <h3>Thông tin xe</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Biển số:</span>
                      <span className="info-value">{currentInvoice.appointment?.vehicle?.license_plate}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Hãng xe:</span>
                      <span className="info-value">{currentInvoice.appointment?.vehicle?.make}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Mẫu xe:</span>
                      <span className="info-value">{currentInvoice.appointment?.vehicle?.model}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Năm sản xuất:</span>
                      <span className="info-value">{currentInvoice.appointment?.vehicle?.year}</span>
                    </div>
                  </div>
                </div>

                <div className="invoice-section">
                  <h3>Chi tiết dịch vụ</h3>
                  <div className="service-details">
                    <div className="service-item">
                      <div className="service-name">{currentInvoice.appointment?.service_type?.name}</div>
                      <div className="service-price">{currentInvoice.subtotal?.toLocaleString()} VNĐ</div>
                    </div>
                    {currentInvoice.tax > 0 && (
                      <div className="service-item tax">
                        <div className="service-name">Thuế VAT (10%)</div>
                        <div className="service-price">{currentInvoice.tax?.toLocaleString()} VNĐ</div>
                      </div>
                    )}
                    {currentInvoice.discount > 0 && (
                      <div className="service-item discount">
                        <div className="service-name">Giảm giá</div>
                        <div className="service-price">-{currentInvoice.discount?.toLocaleString()} VNĐ</div>
                      </div>
                    )}
                    <div className="service-item total">
                      <div className="service-name"><strong>Tổng cộng</strong></div>
                      <div className="service-price total-amount">{currentInvoice.total_amount?.toLocaleString()} VNĐ</div>
                    </div>
                  </div>
                </div>

                <div className="invoice-section">
                  <h3>Thông tin thanh toán</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Ngày tạo:</span>
                      <span className="info-value">
                        {new Date(currentInvoice.issue_date).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Hạn thanh toán:</span>
                      <span className="info-value">
                        {currentInvoice.due_date 
                          ? new Date(currentInvoice.due_date).toLocaleDateString('vi-VN')
                          : 'Ngay lập tức'
                        }
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Trạng thái:</span>
                      <span className="info-value">
                        {currentInvoice.payment_status === 'paid' ? '✅ Đã thanh toán' :
                         currentInvoice.payment_status === 'pending' ? '⏳ Chờ thanh toán' :
                         currentInvoice.payment_status === 'failed' ? '❌ Thanh toán thất bại' :
                         '💰 Chưa thanh toán'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Phương thức:</span>
                      <span className="info-value">
                        {currentInvoice.payment_method === 'cash' ? '💵 Tiền mặt' :
                         currentInvoice.payment_method === 'vnpay' ? '🏦 VNPay' :
                         currentInvoice.payment_method === 'momo' ? '📱 MoMo' :
                         currentInvoice.payment_method === 'sepay' ? '🏪 SePay' :
                         currentInvoice.payment_method === 'bank_transfer' ? '🏦 Chuyển khoản' :
                         'Chưa chọn'}
                      </span>
                    </div>
                  </div>
                </div>

                {currentInvoice.notes && (
                  <div className="invoice-section">
                    <h3>Ghi chú</h3>
                    <p className="invoice-notes">{currentInvoice.notes}</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button onClick={() => window.print()} className="btn btn-outline">
                  🖨️ In hóa đơn
                </button>
                <button 
                  onClick={() => {
                    // Có thể gửi email hóa đơn cho khách hàng
                    setMessage({ type: 'info', text: 'Tính năng gửi email hóa đơn sẽ được thêm sau!' });
                  }} 
                  className="btn btn-secondary"
                >
                  📧 Gửi email
                </button>
                <button onClick={() => setShowInvoiceModal(false)} className="btn btn-primary">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </StaffLayout>
  );
}
