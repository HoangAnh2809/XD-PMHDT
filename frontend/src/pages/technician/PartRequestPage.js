import React, { useState, useEffect } from 'react';
import TechnicianLayout from '../../components/TechnicianLayout';
import { technicianAPI } from '../../services/api';
import './PartsRequestPage.css';

export default function PartsRequestPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [availableParts, setAvailableParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [formData, setFormData] = useState({
    task_id: '',
    part_id: '',
    quantity: 1,
    notes: '',
    urgency: 'normal'
  });
  const [currentTask, setCurrentTask] = useState(null);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedPart, setSelectedPart] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadRequests(), loadCurrentTask()]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const loadRequests = async () => {
    try {
      const data = await technicianAPI.getPartsRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading requests:', error);
      setRequests([]);
    }
  };

  const loadCurrentTask = async () => {
    try {
      const tasks = await technicianAPI.getTodayTasks();
      const taskList = Array.isArray(tasks) ? tasks : [];
      // Allow requesting parts for any assigned task, not just in_progress
      const assignedTasks = taskList.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
      setAvailableTasks(assignedTasks);
      
      // Set the first available task as current, or the one in progress if available
      const inProgress = taskList.find(t => t.status === 'in_progress');
      const current = inProgress || (assignedTasks.length > 0 ? assignedTasks[0] : null);
      setCurrentTask(current);
      
      if (current) {
        setFormData({ ...formData, task_id: current.id });
      }
    } catch (error) {
      console.error('Error loading current task:', error);
      setCurrentTask(null);
      setAvailableTasks([]);
    }
  };

  const loadAvailableParts = async (search = '') => {
    try {
      const data = await technicianAPI.getAvailableParts(search);
      setAvailableParts(data || mockParts);
    } catch (error) {
      console.error('Error loading parts:', error);
      setAvailableParts(mockParts);
    }
  };

  const filterRequests = () => {
    let filtered = [...requests];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(r => new Date(r.created_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(r => new Date(r.created_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(r => new Date(r.created_at) >= filterDate);
          break;
      }
    }

    setFilteredRequests(filtered);
  };

  const handleOpenModal = () => {
    setShowModal(true);
    loadAvailableParts();
    setFormData({
      task_id: currentTask?.id || (availableTasks.length > 0 ? availableTasks[0].id : ''),
      part_id: '',
      quantity: 1,
      notes: '',
      urgency: 'normal'
    });
    setSelectedPart(null);
  };

  const handleSearchParts = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.length >= 2) {
      loadAvailableParts(value);
    }
  };

  const handlePartSelect = (part) => {
    setSelectedPart(part);
    setFormData({ ...formData, part_id: part.id });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.task_id) {
      setMessage({ type: 'error', text: 'Vui lòng chọn công việc cần phụ tùng' });
      return;
    }

    if (!formData.part_id || !formData.quantity) {
      setMessage({ type: 'error', text: 'Vui lòng chọn phụ tùng và số lượng' });
      return;
    }

    try {
      await technicianAPI.requestPart(formData);
      setMessage({ type: 'success', text: '✅ Đã gửi yêu cầu phụ tùng thành công!' });
      setShowModal(false);
      setFormData({ 
        task_id: currentTask?.id || (availableTasks.length > 0 ? availableTasks[0].id : ''), 
        part_id: '', 
        quantity: 1, 
        notes: '', 
        urgency: 'normal' 
      });
      setSelectedPart(null);
      await loadRequests();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage({ type: 'error', text: 'Lỗi khi gửi yêu cầu: ' + (error.response?.data?.detail || error.message) });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { class: 'badge-warning', text: 'Chờ duyệt', icon: '⏳' },
      'approved': { class: 'badge-info', text: 'Đã duyệt', icon: '✅' },
      'delivered': { class: 'badge-success', text: 'Đã giao', icon: '🚚' },
      'rejected': { class: 'badge-danger', text: 'Từ chối', icon: '❌' }
    };
    return badges[status] || { class: 'badge-secondary', text: status, icon: '❓' };
  };

  const getUrgencyBadge = (urgency) => {
    const badges = {
      'normal': { class: 'urgency-normal', text: 'Bình thường', color: '#4caf50' },
      'high': { class: 'urgency-high', text: 'Cao', color: '#ff9800' },
      'urgent': { class: 'urgency-urgent', text: 'Khẩn cấp', color: '#f44336' }
    };
    return badges[urgency] || badges.normal;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const mockParts = [
    { id: 1, part_number: 'BRAKE-001', name: 'Bộ Má Phanh', category: 'Phanh', stock: 15, price: 1500000 },
    { id: 2, part_number: 'FILTER-001', name: 'Lọc Gió Cabin', category: 'Lọc', stock: 30, price: 300000 },
    { id: 3, part_number: 'TIRE-001', name: 'Lốp Xe Điện 18"', category: 'Lốp xe', stock: 20, price: 2000000 },
    { id: 4, part_number: 'BAT-001', name: 'Bộ Pin Xe Điện', category: 'Pin', stock: 5, price: 50000000 }
  ];

  if (loading) {
    return (
      <TechnicianLayout>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      </TechnicianLayout>
    );
  }

  return (
    <TechnicianLayout>
      <div className="parts-request-page">
        {/* Header Section */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-info">
              <h1>🔧 Phụ Tùng Cần Thay</h1>
              <p>Quản lý và yêu cầu phụ tùng cho công việc bảo dưỡng</p>
            </div>
            <div className="header-actions">
              <button
                onClick={handleOpenModal}
                className="btn-primary-large"
                disabled={availableTasks.length === 0}
              >
                <span className="btn-icon">➕</span>
                Yêu cầu phụ tùng
              </button>
            </div>
          </div>

          {availableTasks.length === 0 && (
            <div className="warning-banner">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <h4>Không có công việc nào được giao</h4>
                <p>Bạn cần được giao công việc để có thể yêu cầu phụ tùng</p>
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        {message.text && (
          <div className={`message-banner ${message.type}`}>
            <span className="message-icon">{message.type === 'success' ? '✅' : '❌'}</span>
            <span className="message-text">{message.text}</span>
            <button
              className="message-close"
              onClick={() => setMessage({ type: '', text: '' })}
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="stats-grid">
          <div className="stat-card pending">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <div className="stat-number">{requests.filter(r => r.status === 'pending').length}</div>
              <div className="stat-label">Chờ duyệt</div>
            </div>
          </div>
          <div className="stat-card approved">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-number">{requests.filter(r => r.status === 'approved').length}</div>
              <div className="stat-label">Đã duyệt</div>
            </div>
          </div>
          <div className="stat-card delivered">
            <div className="stat-icon">🚚</div>
            <div className="stat-content">
              <div className="stat-number">{requests.filter(r => r.status === 'delivered').length}</div>
              <div className="stat-label">Đã giao</div>
            </div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <div className="stat-number">{requests.filter(r => r.status === 'rejected').length}</div>
              <div className="stat-label">Từ chối</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label className="filter-label">Trạng thái:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="delivered">Đã giao</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Thời gian:</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả</option>
              <option value="today">Hôm nay</option>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
          </div>
        </div>

        {/* Requests List */}
        <div className="requests-section">
          <div className="section-header">
            <h2>📋 Danh sách yêu cầu ({filteredRequests.length})</h2>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>Chưa có yêu cầu phụ tùng</h3>
              <p>Hãy tạo yêu cầu đầu tiên để bắt đầu</p>
            </div>
          ) : (
            <div className="requests-grid">
              {filteredRequests.map(request => (
                <div key={request.id} className="request-card">
                  <div className="request-header">
                    <div className="request-title">
                      <h4>{request.part_name}</h4>
                      <span className="part-number">{request.part_number}</span>
                    </div>
                    <div className="request-status">
                      <span className={`status-badge ${getStatusBadge(request.status).class}`}>
                        <span className="status-icon">{getStatusBadge(request.status).icon}</span>
                        {getStatusBadge(request.status).text}
                      </span>
                    </div>
                  </div>

                  <div className="request-content">
                    <div className="request-info">
                      <div className="info-item">
                        <span className="info-label">🚗 Xe:</span>
                        <span className="info-value">{request.vehicle_info}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">📦 Số lượng:</span>
                        <span className="info-value quantity">{request.quantity}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">⚡ Ưu tiên:</span>
                        <span
                          className={`urgency-badge ${getUrgencyBadge(request.urgency).class}`}
                          style={{ backgroundColor: getUrgencyBadge(request.urgency).color }}
                        >
                          {getUrgencyBadge(request.urgency).text}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">📅 Thời gian:</span>
                        <span className="info-value">{formatDate(request.created_at)}</span>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="request-notes">
                        <span className="notes-label">📝 Ghi chú:</span>
                        <p className="notes-content">{request.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Request Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>➕ Yêu cầu phụ tùng mới</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSubmit} className="modal-body">
                {availableTasks.length > 0 && (
                  <div className="current-task-info">
                    <div className="task-icon">🚗</div>
                    <div className="task-details">
                      <h4>Công việc hiện tại</h4>
                      <p>{currentTask?.vehicle_info || 'Chọn công việc'}</p>
                      <span className="task-service">{currentTask?.service_type || ''}</span>
                    </div>
                  </div>
                )}

                {availableTasks.length > 1 && (
                  <div className="form-section">
                    <h3>📋 Chọn công việc</h3>
                    <div className="form-group">
                      <label>Công việc cần phụ tùng *</label>
                      <select
                        className="form-control"
                        value={formData.task_id}
                        onChange={(e) => {
                          const selectedTaskId = e.target.value;
                          const selectedTask = availableTasks.find(t => t.id === selectedTaskId);
                          setCurrentTask(selectedTask);
                          setFormData({ ...formData, task_id: selectedTaskId });
                        }}
                        required
                      >
                        <option value="">-- Chọn công việc --</option>
                        {availableTasks.map(task => (
                          <option key={task.id} value={task.id}>
                            {task.vehicle_info} - {task.service_type} ({task.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-section">
                  <h3>🔍 Tìm kiếm phụ tùng</h3>
                  <div className="form-group">
                    <input
                      type="text"
                      className="form-control search-input"
                      value={searchTerm}
                      onChange={handleSearchParts}
                      placeholder="Nhập tên hoặc mã phụ tùng..."
                    />
                  </div>

                  <div className="parts-grid">
                    {availableParts.map(part => (
                      <div
                        key={part.id}
                        className={`part-card ${selectedPart?.id === part.id ? 'selected' : ''}`}
                        onClick={() => handlePartSelect(part)}
                      >
                        <div className="part-header">
                          <h4>{part.name}</h4>
                          <span className="part-number">{part.part_number}</span>
                        </div>
                        <div className="part-details">
                          <span className="part-category">{part.category}</span>
                          <span className="part-stock">Tồn kho: {part.stock}</span>
                          <span className="part-price">{part.price.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPart && (
                  <div className="form-section">
                    <h3>📋 Chi tiết yêu cầu</h3>

                    <div className="selected-part-summary">
                      <div className="summary-icon">✅</div>
                      <div className="summary-content">
                        <h4>{selectedPart.name}</h4>
                        <p>{selectedPart.part_number} • {selectedPart.category}</p>
                        <span className="summary-price">{selectedPart.price.toLocaleString('vi-VN')} VNĐ</span>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Số lượng *</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                          min="1"
                          max={selectedPart.stock}
                          required
                        />
                        <small className="form-hint">Tối đa: {selectedPart.stock} cái</small>
                      </div>

                      <div className="form-group">
                        <label>Mức độ ưu tiên *</label>
                        <select
                          className="form-control"
                          value={formData.urgency}
                          onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                          required
                        >
                          <option value="normal">🟢 Bình thường</option>
                          <option value="high">🟠 Cao</option>
                          <option value="urgent">🔴 Khẩn cấp</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Ghi chú</label>
                      <textarea
                        className="form-control"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows="3"
                        placeholder="Lý do yêu cầu, tình trạng chi tiết..."
                      />
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Hủy
                  </button>
                  <button type="submit" className="btn-primary" disabled={!selectedPart}>
                    📤 Gửi yêu cầu
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
