import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TechnicianLayout from '../../components/TechnicianLayout';
import { technicianAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './TaskDetailsPage.css';

const TaskDetailsPage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [checklist, setChecklist] = useState([]);
  const [progressHistory, setProgressHistory] = useState([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [updatingChecklist, setUpdatingChecklist] = useState(false);
  const [task, setTask] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partsRequests, setPartsRequests] = useState([]);
  const [showPartsManagement, setShowPartsManagement] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [showQuickNote, setShowQuickNote] = useState(false);

  useEffect(() => {
    loadTaskDetails();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTaskDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const taskData = await technicianAPI.getTaskDetails(taskId);
      setTask(taskData);

      // Load checklist if task is in progress or completed
      if (taskData.status === 'in_progress' || taskData.status === 'completed') {
        try {
          const checklistData = await technicianAPI.getTaskChecklist(taskId);
          setChecklist(checklistData.items || []);
        } catch (checklistError) {
          // No checklist available for this task
        }

        try {
          const historyData = await technicianAPI.getProgressHistory(taskId);
          setProgressHistory(historyData.history || []);
        } catch (historyError) {
          // No progress history available
        }
      }

      // Load parts requests for this task
      try {
        const partsData = await technicianAPI.getPartsRequests({ task_id: taskId });
        setPartsRequests(partsData || []);
      } catch (partsError) {
        // No parts requests available
      }

      // Load invoice information if task is completed
      if (taskData.status === 'completed') {
        try {
          const invoiceData = await technicianAPI.getInvoices({ appointment_id: taskId });
          if (invoiceData && invoiceData.length > 0) {
            setInvoice(invoiceData[0]); // Get the first invoice for this appointment
          }
        } catch (invoiceError) {
          // No invoice found for this task
        }
      }

      // Task object already contains all customer, vehicle, and service information
      // No need to fetch additional appointment data
    } catch (err) {
      console.error('Error loading task details:', err);
      // Ensure error is a string, not an object
      const errorMessage = err?.message || err?.response?.data?.message || 'Không thể tải thông tin công việc. Vui lòng thử lại.';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Không thể tải thông tin công việc. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có lịch hẹn';
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year}, ${hours}:${minutes} (giờ Việt Nam – GMT+7)`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Chưa có lịch hẹn';
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return formatCurrency(0);
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
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

  const handleCreateInvoice = () => {
    const appointmentId = task.id;
    const isValidAppointmentId = appointmentId && 
                                typeof appointmentId === 'string' && 
                                appointmentId.trim() !== '' &&
                                appointmentId !== 'null' &&
                                appointmentId !== 'undefined' &&
                                !appointmentId.includes('N/A');

    if (appointmentId && isValidAppointmentId) {
      navigate(`/staff/invoices/create?appointmentId=${appointmentId}`);
    } else {
      alert('Không thể tạo hóa đơn: Thiếu thông tin lịch hẹn hợp lệ');
    }
  };

  const handleStartTask = () => {
    navigate(`/technician/tasks/${taskId}/checklist`);
  };

  const updateChecklistItem = async (itemId, completed) => {
    // Prevent updates if task is completed
    if (effectiveStatus === 'completed') {
      alert('Không thể chỉnh sửa checklist vì công việc đã hoàn thành.');
      return;
    }

    try {
      setUpdatingChecklist(true);
      await technicianAPI.updateChecklistItem(taskId, itemId, { completed });

      // Update local state
      setChecklist(prev => prev.map(item =>
        item.id === itemId ? { ...item, completed } : item
      ));

      // Reload progress history
      try {
        const historyData = await technicianAPI.getProgressHistory(taskId);
        setProgressHistory(historyData.history || []);
      } catch (historyError) {
        // Error reloading progress history
      }

      // Show success message
      alert('Cập nhật checklist thành công!');
  } catch (err) {
    console.error('Error updating checklist item:', err);
    alert('Không thể cập nhật checklist. Vui lòng thử lại.');
  } finally {
    setUpdatingChecklist(false);
  }
};

  const handleAddQuickNote = async () => {
    if (!quickNote.trim()) return;

    try {
      await technicianAPI.updateTaskNotes(taskId, { notes: quickNote });
      setQuickNote('');
      setShowQuickNote(false);
      alert('Thêm ghi chú thành công!');
      // Reload task details to show updated notes
      loadTaskDetails();
    } catch (err) {
      console.error('Error adding quick note:', err);
      alert('Không thể thêm ghi chú. Vui lòng thử lại.');
    }
  };

  const handleRequestParts = () => {
    navigate(`/technician/parts?taskId=${taskId}`);
  };

  const getPartsStatusBadge = (status) => {
    const badges = {
      'pending': 'badge-warning',
      'approved': 'badge-info',
      'delivered': 'badge-success',
      'rejected': 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  };

  const getPartsStatusText = (status) => {
    const texts = {
      'pending': 'Chờ duyệt',
      'approved': 'Đã duyệt',
      'delivered': 'Đã giao',
      'rejected': 'Từ chối'
    };
    return texts[status] || status;
  };  if (loading) {
    return (
      <TechnicianLayout>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Đang tải thông tin công việc...</p>
        </div>
      </TechnicianLayout>
    );
  }

  if (error) {
    return (
      <TechnicianLayout>
        <div className="error-container">
          <div className="error-card">
            <h4 className="error-title">
              <span className="error-icon">❌</span>
              Lỗi
            </h4>
            <p className="error-message">{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/technician/tasks')}>
              ← Quay lại danh sách công việc
            </button>
          </div>
        </div>
      </TechnicianLayout>
    );
  }

  if (!task) {
    return (
      <TechnicianLayout>
        <div className="error-container">
          <div className="error-card">
            <h4 className="error-title">
              <span className="error-icon">⚠️</span>
              Không tìm thấy công việc
            </h4>
            <p className="error-message">Công việc với ID {taskId} không tồn tại.</p>
            <button className="btn btn-primary" onClick={() => navigate('/technician/tasks')}>
              ← Quay lại danh sách công việc
            </button>
          </div>
        </div>
      </TechnicianLayout>
    );
  }

  // Dev/testing override: append ?showCompleted=1 to force completed UI locally
  const searchParams = new URLSearchParams(location.search);
  const forceCompleted = searchParams.get('showCompleted') === '1';
  const effectiveStatus = forceCompleted ? 'completed' : task.status;

  return (
    <TechnicianLayout>
      <div className="task-details-container">
        <div className="task-header">
          <div className="header-content">
            <h1 className="task-title">
              <span className="task-icon">�</span>
              Chi tiết công việc
            </h1>
            <p className="task-subtitle">Thông tin đầy đủ về công việc và lịch hẹn</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline-secondary" onClick={() => navigate('/technician/tasks')}>
              <span>←</span> Quay lại
            </button>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card vehicle-card">
            <div className="card-icon">🚗</div>
            <div className="card-content">
              <h3>Thông tin xe</h3>
              <p className="primary-info">
                {typeof task.vehicle_make === 'string' && typeof task.vehicle_model === 'string'
                  ? `${task.vehicle_make} ${task.vehicle_model}`.trim() || 'Xe chưa xác định'
                  : 'Xe chưa xác định'}
              </p>
              <p className="secondary-info">
                {typeof task.vehicle_license === 'string' ? task.vehicle_license : 'Chưa có biển số'}
              </p>
            </div>
          </div>

          <div className="summary-card customer-card">
            <div className="card-icon">👤</div>
            <div className="card-content">
              <h3>Khách hàng</h3>
              <p className="primary-info">
                {typeof task.customer_name === 'string' ? task.customer_name : 'Khách hàng ẩn danh'}
              </p>
              <p className="secondary-info">
                {typeof task.customer_phone === 'string' ? task.customer_phone : 'Chưa có SĐT'}
              </p>
            </div>
          </div>

          <div className="summary-card task-card">
            <div className="card-icon">🆔</div>
            <div className="card-content">
              <h3>ID đơn hàng</h3>
              <p className="primary-info task-id">{task.id}</p>
              <p className="secondary-info">Dịch vụ: {task.service_type || 'Bảo dưỡng'}</p>
            </div>
          </div>

          <div className="summary-card status-card">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <h3>Trạng thái</h3>
              <p className="primary-info">
                <span className={`status-badge ${getStatusBadge(effectiveStatus)}`}>
                  {getStatusText(effectiveStatus)}
                </span>
              </p>
              <p className="secondary-info">{formatDate(task.appointment_date)}</p>
            </div>
          </div>
        </div>

        {/* Task Overview */}
        <div className="details-section">
          <div className="section-card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon">🔧</span>
                Tổng quan công việc
              </h2>
            </div>
            <div className="card-content">
              <div className="overview-grid">
                <div className="overview-item">
                  <h4>Thông tin xe</h4>
                  <p className="highlight">{task.vehicle_make} {task.vehicle_model}</p>
                  <p>Biển số: {task.vehicle_license || 'N/A'}</p>
                  <p>Năm: {task.vehicle_year || 'N/A'}</p>
                </div>
                <div className="overview-item">
                  <h4>Khách hàng</h4>
                  <p className="highlight">{task.customer_name || 'N/A'}</p>
                  <p>SĐT: {task.customer_phone || 'N/A'}</p>
                  <p>Email: {task.customer_email || 'N/A'}</p>
                </div>
                <div className="overview-item">
                  <h4>Dịch vụ</h4>
                  <p className="highlight">{task.service_type || 'Bảo dưỡng'}</p>
                  <p>Giá dự kiến: {formatCurrency(task.estimated_cost || 0)}</p>
                  <p>Thời gian: {task.estimated_duration || 120} phút</p>
                </div>
                <div className="overview-item">
                  <h4>Lịch hẹn</h4>
                  <p className="highlight">{formatDate(task.appointment_date)}</p>
                  <p className={`status-text ${getStatusBadge(effectiveStatus)}`}>
                    {getStatusText(effectiveStatus)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-section">
          <div className="action-buttons">
            {effectiveStatus === 'pending' && (
              <button className="btn btn-primary action-btn" onClick={handleStartTask}>
                <span className="btn-icon">🚀</span>
                Bắt đầu công việc
              </button>
            )}
            {effectiveStatus === 'in_progress' && (
              <button className="btn btn-info action-btn" onClick={handleStartTask}>
                <span className="btn-icon">📝</span>
                Tiếp tục làm việc
              </button>
            )}

            {/* Parts Management */}
            <button
              className="btn btn-warning action-btn"
              onClick={() => setShowPartsManagement(!showPartsManagement)}
            >
              <span className="btn-icon">⚙️</span>
              Quản lý phụ tùng ({partsRequests.length})
            </button>

            {/* Quick Note */}
            <button
              className="btn btn-outline-info action-btn"
              onClick={() => setShowQuickNote(!showQuickNote)}
            >
              <span className="btn-icon">📝</span>
              Thêm ghi chú nhanh
            </button>
          </div>

          {/* Invoice Creation Section */}
          {task.id && user && (user.role === 'staff' || user.role === 'admin') && (
            <div className="invoice-section">
              <div className="invoice-card">
                <h4 className="invoice-title">
                  <span className="title-icon">💰</span>
                  Tạo hóa đơn
                </h4>
                {(() => {
                  const appointmentId = task.id;
                  const isValidAppointmentId = appointmentId && 
                                              typeof appointmentId === 'string' && 
                                              appointmentId !== 'N/A' && 
                                              appointmentId.trim() !== '' &&
                                              appointmentId !== 'null' &&
                                              appointmentId !== 'undefined';

                  if (!isValidAppointmentId) {
                    return (
                      <div className="invoice-error">
                        <button className="btn btn-secondary" disabled>
                          ❌ Không thể tạo hóa đơn
                        </button>
                        <small>Thiếu thông tin lịch hẹn</small>
                      </div>
                    );
                  }

                  return effectiveStatus === 'completed' ? (
                    <div className="invoice-success">
                      <button className="btn btn-success" onClick={handleCreateInvoice}>
                        ✅ Tạo hóa đơn
                      </button>
                      <small>🎉 Công việc đã hoàn thành</small>
                    </div>
                  ) : (
                    <div className="invoice-warning">
                      <button className="btn btn-warning" onClick={handleCreateInvoice}>
                        ⚠️ Tạo hóa đơn (chưa hoàn thành)
                      </button>
                      <small>Công việc chưa hoàn thành</small>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Quick Note Modal */}
        {showQuickNote && (
          <div className="quick-note-modal">
            <div className="modal-content">
              <h4>Thêm ghi chú nhanh</h4>
              <textarea
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="Nhập ghi chú cho công việc này..."
                rows="3"
              />
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleAddQuickNote}>
                  Thêm ghi chú
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setShowQuickNote(false)}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Parts Management Section */}
        {showPartsManagement && (
          <div className="parts-management-section">
            <div className="section-header">
              <h3>⚙️ Quản lý phụ tùng</h3>
              <button className="btn btn-primary" onClick={handleRequestParts}>
                + Yêu cầu phụ tùng mới
              </button>
            </div>

            {partsRequests.length > 0 ? (
              <div className="parts-list">
                {partsRequests.map((request, index) => (
                  <div key={request.id || index} className="parts-item">
                    <div className="parts-info">
                      <h4>{request.part_name || 'Phụ tùng'}</h4>
                      <p>Số lượng: {request.quantity || 1}</p>
                      <p>Giá: {formatCurrency(request.price || 0)}</p>
                    </div>
                    <div className="parts-status">
                      <span className={`badge ${getPartsStatusBadge(request.status)}`}>
                        {getPartsStatusText(request.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-parts">
                <p>Chưa có yêu cầu phụ tùng nào cho công việc này.</p>
                <button className="btn btn-outline-primary" onClick={handleRequestParts}>
                  Tạo yêu cầu đầu tiên
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detailed Information */}
        <div className="details-section">
          <div className="info-grid">
            <div className="info-card customer-info">
              <h3 className="info-title">
                <span className="info-icon">👤</span>
                Thông tin khách hàng
              </h3>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">Họ tên:</span>
                  <span className="value">{task.customer_name || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Email:</span>
                  <span className="value">{task.customer_email || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">SĐT:</span>
                  <span className="value">{task.customer_phone || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Địa chỉ:</span>
                  <span className="value">{task.customer_address || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="info-card vehicle-info">
              <h3 className="info-title">
                <span className="info-icon">🚗</span>
                Thông tin xe
              </h3>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">Hãng xe:</span>
                  <span className="value">{task.vehicle_make || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Mẫu xe:</span>
                  <span className="value">{task.vehicle_model || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Năm SX:</span>
                  <span className="value">{task.vehicle_year || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Biển số:</span>
                  <span className="value">{task.vehicle_license || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">VIN:</span>
                  <span className="value">{task.vehicle_vin || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Km hiện tại:</span>
                  <span className="value">{task.current_mileage ? `${task.current_mileage.toLocaleString()} km` : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="info-card service-info">
              <h3 className="info-title">
                <span className="info-icon">🔧</span>
                Thông tin dịch vụ
              </h3>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">Loại dịch vụ:</span>
                  <span className="value">{task.service_type || 'Bảo dưỡng'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Mô tả:</span>
                  <span className="value">{task.service_description || 'Dịch vụ bảo dưỡng và sửa chữa'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Giá dự kiến:</span>
                  <span className="value highlight">{formatCurrency(task.estimated_cost || 0)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Thời gian dự kiến:</span>
                  <span className="value">{task.estimated_duration ? `${task.estimated_duration} phút` : '120 phút'}</span>
                </div>
              </div>
            </div>

            <div className="info-card appointment-info">
              <h3 className="info-title">
                <span className="info-icon">📅</span>
                Thông tin lịch hẹn
              </h3>
              <div className="info-content">
                <div className="info-row">
                  <span className="label">ID đơn hàng:</span>
                  <span className="value task-id">{task.id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Ngày hẹn:</span>
                  <span className="value">{formatDate(task.appointment_date)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Trạng thái:</span>
                  <span className={`value status ${getStatusBadge(effectiveStatus)}`}>
                    {getStatusText(effectiveStatus)}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Ghi chú KH:</span>
                  <span className="value">{task.customer_notes || 'Không có'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Ghi chú NV:</span>
                  <span className="value">{task.staff_notes || 'Không có'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Notes */}
        {task.notes && (
          <div className="card">
            <h3>📝 Ghi chú công việc</h3>
            <p style={{whiteSpace: 'pre-wrap'}}>{task.notes}</p>
          </div>
        )}

        {/* Checklist Section */}
        {(effectiveStatus === 'in_progress' || effectiveStatus === 'completed') && checklist.length > 0 && (
          <div className="checklist-section">
            <div className="section-card">
              <div className="card-header">
                <div className="header-content">
                  <h3 className="card-title">
                    <span className="card-icon">📋</span>
                    Danh sách kiểm tra công việc
                  </h3>
                  <button
                    className="btn btn-outline-primary btn-sm toggle-btn"
                    onClick={() => setShowChecklist(!showChecklist)}
                  >
                    {showChecklist ? 'Ẩn chi tiết' : 'Hiện chi tiết'}
                  </button>
                </div>
              </div>

              {effectiveStatus === 'completed' && (
                <div className="completed-notice">
                  <span className="notice-icon">🔒</span>
                  <span>Checklist đã bị khóa vì công việc đã hoàn thành. Không thể chỉnh sửa thêm.</span>
                </div>
              )}

              {showChecklist && (
                <div className="card-content">
                  <div className="checklist-grid">
                    {checklist.map((item, index) => (
                      <div
                        key={item.id}
                        className={`checklist-item ${item.completed ? 'completed' : ''}`}
                      >
                        <div className="item-header">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={(e) => updateChecklistItem(item.id, e.target.checked)}
                            disabled={updatingChecklist || effectiveStatus === 'completed'}
                            className="checkbox"
                          />
                          <span className="item-title">
                            {index + 1}. {item.description}
                          </span>
                          {effectiveStatus === 'completed' && (
                            <span className="lock-icon">🔒</span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="item-notes">
                            <span className="notes-icon">📝</span>
                            {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Progress Summary */}
                  <div className="progress-summary">
                    <h4>📊 Tiến độ công việc</h4>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${checklist.length > 0 ? (checklist.filter(item => item.completed).length / checklist.length) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      {checklist.filter(item => item.completed).length}/{checklist.length} hoàn thành
                      ({Math.round((checklist.filter(item => item.completed).length / checklist.length) * 100) || 0}%)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress History */}
        {progressHistory.length > 0 && (
          <div className="history-section">
            <div className="section-card">
              <div className="card-header">
                <h3 className="card-title">
                  <span className="card-icon">📈</span>
                  Lịch sử tiến độ
                </h3>
              </div>
              <div className="card-content">
                <div className="history-list">
                  {progressHistory.map((entry, index) => (
                    <div key={index} className={`history-item ${index % 2 === 0 ? 'even' : 'odd'}`}>
                      <div className="history-content">
                        <div className="history-main">
                          <span className="action">{entry.action}</span>
                          {entry.item_description && (
                            <div className="item-desc">{entry.item_description}</div>
                          )}
                        </div>
                        <div className="history-meta">
                          <div className="timestamp">{formatDate(entry.timestamp)}</div>
                          <div className="technician">{entry.technician_name || 'Kỹ thuật viên'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {effectiveStatus === 'completed' && (
          <div className="completion-section">
            <div className="completion-card">
              <div className="completion-header">
                <h3 className="completion-title">
                  <span className="title-icon">🎉</span>
                  Tóm tắt hoàn thành công việc
                </h3>
              </div>

              {/* Invoice Information */}
              {invoice && (
                <div className="invoice-summary">
                  <h4 className="section-title">
                    <span className="section-icon">📄</span>
                    Thông tin hóa đơn
                    <span className={`payment-badge ${invoice.payment_status === 'paid' ? 'paid' : 'pending'}`}>
                      {invoice.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </span>
                  </h4>

                  <div className="invoice-grid">
                    <div className="invoice-item">
                      <span className="label">Mã hóa đơn:</span>
                      <span className="value">{invoice.invoice_number || `INV-${invoice.id?.slice(-6)}`}</span>
                    </div>
                    <div className="invoice-item">
                      <span className="label">Tổng tiền:</span>
                      <span className="value highlight">{formatCurrency(invoice.total_amount || 0)}</span>
                    </div>
                    <div className="invoice-item">
                      <span className="label">Ngày tạo:</span>
                      <span className="value">{invoice.created_at ? formatDate(invoice.created_at) : 'N/A'}</span>
                    </div>
                    <div className="invoice-item">
                      <span className="label">Thanh toán:</span>
                      <span className="value">
                        {invoice.payment_method === 'cash' ? 'Tiền mặt' :
                         invoice.payment_method === 'vnpay' ? 'VNPay' :
                         invoice.payment_method === 'momo' ? 'MoMo' :
                         invoice.payment_method === 'sepay' ? 'SePay' : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Invoice breakdown */}
                  <div className="invoice-breakdown">
                    <h5>Chi tiết hóa đơn:</h5>
                    <div className="breakdown-row">
                      <span>Tiền dịch vụ:</span>
                      <span>{formatCurrency(invoice.subtotal || invoice.total_amount || 0)}</span>
                    </div>
                    {invoice.tax && invoice.tax > 0 && (
                      <div className="breakdown-row">
                        <span>Thuế VAT (10%):</span>
                        <span>{formatCurrency(invoice.tax)}</span>
                      </div>
                    )}
                    {invoice.discount && invoice.discount > 0 && (
                      <div className="breakdown-row">
                        <span>Giảm giá:</span>
                        <span>-{formatCurrency(invoice.discount)}</span>
                      </div>
                    )}
                    <hr />
                    <div className="breakdown-row total">
                      <span>Tổng cộng:</span>
                      <span>{formatCurrency(invoice.total_amount || 0)}</span>
                    </div>
                  </div>

                  {/* Payment status */}
                  <div className="payment-status">
                    {invoice.payment_status === 'paid' ? (
                      <div className="status-success">
                        ✅ Hóa đơn đã được thanh toán thành công
                        {invoice.payment_date && (
                          <div className="payment-date">Ngày thanh toán: {formatDate(invoice.payment_date)}</div>
                        )}
                      </div>
                    ) : (
                      <div className="status-warning">
                        ⏳ Hóa đơn đang chờ thanh toán
                        <div className="due-date">Hạn thanh toán: {invoice.due_date ? formatDate(invoice.due_date) : 'Ngay lập tức'}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Completion Stats */}
              <div className="completion-stats">
                <div className="stat-card">
                  <h4>💰 Chi phí cuối cùng</h4>
                  <div className="stat-value">{formatCurrency(task.estimated_cost || 0)}</div>
                  <small>Giá thực tế từ giá dự kiến</small>
                </div>
                <div className="stat-card">
                  <h4>📅 Thời gian hoàn thành</h4>
                  <div className="stat-value">{formatDate(task.appointment_date)}</div>
                  <small>Ngày lịch hẹn</small>
                </div>
                <div className="stat-card">
                  <h4>🔧 Dịch vụ đã thực hiện</h4>
                  <div className="stat-value">{task.service_type || 'Bảo dưỡng'}</div>
                  <small>{task.service_description || 'Hoàn thành theo yêu cầu'}</small>
                </div>
                <div className="stat-card">
                  <h4>🚗 Xe đã sửa chữa</h4>
                  <div className="stat-value">{task.vehicle_make} {task.vehicle_model}</div>
                  <small>Biển số: {task.vehicle_license || 'N/A'}</small>
                </div>
              </div>

              {/* Customer Information */}
              <div className="customer-summary">
                <h4 className="section-title">
                  <span className="section-icon">👤</span>
                  Thông tin khách hàng chi tiết
                </h4>
                <div className="customer-grid">
                  <div className="customer-item">
                    <span className="label">Họ tên:</span>
                    <span className="value">{task.customer_name || 'N/A'}</span>
                  </div>
                  <div className="customer-item">
                    <span className="label">Email:</span>
                    <span className="value">{task.customer_email || 'N/A'}</span>
                  </div>
                  <div className="customer-item">
                    <span className="label">SĐT:</span>
                    <span className="value">{task.customer_phone || 'N/A'}</span>
                  </div>
                  <div className="customer-item">
                    <span className="label">Địa chỉ:</span>
                    <span className="value">{task.customer_address || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="completion-message">
                <h4>✅ Trạng thái hoàn thành</h4>
                <p>
                  Công việc đã được hoàn thành thành công. Tất cả các yêu cầu bảo dưỡng và sửa chữa đã được thực hiện theo đúng tiêu chuẩn.
                </p>
                {task.staff_notes && (
                  <div className="staff-notes">
                    <strong>Ghi chú từ nhân viên:</strong>
                    <p>{task.staff_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
};

export default TaskDetailsPage;