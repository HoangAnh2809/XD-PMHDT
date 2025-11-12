import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TechnicianLayout from '../../components/TechnicianLayout';
import { technicianAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './ProgressUpdatePage.css';

const ProgressUpdatePage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [partsRequests, setPartsRequests] = useState([]);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('progress');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [updatingChecklist, setUpdatingChecklist] = useState(false);

  const [formData, setFormData] = useState({
    status: '',
    progress_percentage: 0,
    notes: '',
    issues_found: '',
    estimated_completion: '',
    total_cost: '',
    labor_hours: 2,
    recommendations: ''
  });

  useEffect(() => {
    if (taskId) {
      loadTaskDetails();
    } else {
      loadCurrentTask();
    }
  }, [taskId]);

  const loadTaskDetails = async () => {
    setLoading(true);
    try {
      // Load task details
      const taskData = await technicianAPI.getTaskDetails(taskId);
      setTask(taskData);

      // Load checklist if task is in progress or completed
      if (taskData.status === 'in_progress' || taskData.status === 'completed') {
        try {
          const checklistData = await technicianAPI.getTaskChecklist(taskId);
          setChecklist(checklistData.items || []);
        } catch (checklistError) {
          console.log('No checklist available');
        }
      }

      // Load parts requests
      try {
        const partsData = await technicianAPI.getPartsRequests({ task_id: taskId });
        setPartsRequests(partsData || []);
      } catch (partsError) {
        console.log('No parts requests available');
      }

      // Load progress history
      try {
        const historyData = await technicianAPI.getProgressHistory(taskId);
        setUpdateHistory(historyData.history || []);
      } catch (historyError) {
        console.log('No progress history available');
      }

      // Initialize form data
      setFormData({
        status: taskData.status || 'in_progress',
        progress_percentage: calculateProgressFromChecklist(checklist),
        notes: '',
        issues_found: '',
        estimated_completion: taskData.estimated_completion || '',
        total_cost: '',
        labor_hours: 2,
        recommendations: ''
      });

    } catch (error) {
      console.error('Error loading task details:', error);
      setMessage({ type: 'error', text: 'Không thể tải thông tin công việc' });
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentTask = async () => {
    setLoading(true);
    try {
      const tasks = await technicianAPI.getTodayTasks();
      const taskList = Array.isArray(tasks) ? tasks : [];
      const inProgress = taskList.find(t => t.status === 'in_progress');
      if (inProgress) {
        // Load full details for the in-progress task
        await loadTaskDetailsForId(inProgress.id);
      } else {
        setTask(null);
      }
    } catch (error) {
      console.error('Error loading current task:', error);
      setTask(null);
    }
    setLoading(false);
  };

  const loadTaskDetailsForId = async (id) => {
    try {
      const taskData = await technicianAPI.getTaskDetails(id);
      setTask(taskData);
      // Load additional data...
      await loadTaskDetails();
    } catch (error) {
      console.error('Error loading task details for ID:', error);
    }
  };

  const calculateProgressFromChecklist = (items) => {
    if (!items || items.length === 0) return 0;
    const completed = items.filter(item => item.completed).length;
    return Math.round((completed / items.length) * 100);
  };

  const updateChecklistItem = async (itemId, completed) => {
    if (task?.status === 'completed') {
      alert('Không thể chỉnh sửa checklist vì công việc đã hoàn thành.');
      return;
    }

    try {
      setUpdatingChecklist(true);
      await technicianAPI.updateChecklistItem(task.id, itemId, { completed });

      // Update local state
      setChecklist(prev => prev.map(item =>
        item.id === itemId ? { ...item, completed } : item
      ));

      // Update progress percentage
      const updatedProgress = calculateProgressFromChecklist(
        checklist.map(item => item.id === itemId ? { ...item, completed } : item)
      );
      setFormData(prev => ({ ...prev, progress_percentage: updatedProgress }));

      // Add to history
      const newHistoryEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        progress: updatedProgress,
        status: task.status,
        notes: `Cập nhật checklist: ${completed ? 'Hoàn thành' : 'Chưa hoàn thành'} mục công việc`,
        technician: user?.username || 'Kỹ thuật viên'
      };
      setUpdateHistory(prev => [newHistoryEntry, ...prev]);

      setMessage({ type: 'success', text: 'Đã cập nhật checklist thành công!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {
      console.error('Error updating checklist item:', error);
      setMessage({ type: 'error', text: 'Không thể cập nhật checklist' });
    } finally {
      setUpdatingChecklist(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.notes.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập ghi chú về tiến độ' });
      return;
    }

    try {
      await technicianAPI.updateProgress(task.id, formData);
      setMessage({ type: 'success', text: '✅ Đã cập nhật tiến độ thành công!' });

      // Add to history
      const newHistoryEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        progress: formData.progress_percentage,
        status: formData.status,
        notes: formData.notes,
        technician: user?.username || 'Kỹ thuật viên'
      };
      setUpdateHistory(prev => [newHistoryEntry, ...prev]);

      // Reset form notes but keep other data
      setFormData({ ...formData, notes: '', issues_found: '' });

      // Reload data
      await loadTaskDetails();

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Error updating progress:', error);
      setMessage({ type: 'error', text: 'Lỗi khi cập nhật tiến độ: ' + (error.response?.data?.detail || error.message) });
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();

    if (!formData.total_cost || parseFloat(formData.total_cost) <= 0) {
      setMessage({ type: 'error', text: 'Vui lòng nhập giá thực tế hợp lệ' });
      return;
    }

    try {
      await technicianAPI.completeTask(task.id, {
        total_cost: parseFloat(formData.total_cost),
        services_performed: formData.notes,
        diagnosis: formData.issues_found,
        labor_hours: formData.labor_hours,
        parts_used: partsRequests.map(p => p.part_name).join(', '),
        mileage: task.current_mileage || 0,
        recommendations: formData.recommendations
      });

      setMessage({ type: 'success', text: '✅ Đã hoàn thành công việc!' });
      setShowCompletionModal(false);
      setTimeout(() => {
        navigate('/technician/tasks');
      }, 2000);
    } catch (error) {
      console.error('Error completing task:', error);
      setMessage({ type: 'error', text: 'Lỗi khi hoàn thành công việc: ' + (error.response?.data?.detail || error.message) });
    }
  };

  const handleRequestParts = () => {
    navigate(`/technician/parts?taskId=${task.id}`);
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có';
    try {
      return new Date(dateString).toLocaleString('vi-VN');
    } catch (error) {
      return dateString;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#ffc107',
      'in_progress': '#17a2b8',
      'waiting_parts': '#dc3545',
      'completed': '#28a745'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusText = (status) => {
    const texts = {
      'pending': 'Chờ xử lý',
      'in_progress': 'Đang thực hiện',
      'waiting_parts': 'Chờ phụ tùng',
      'completed': 'Hoàn thành'
    };
    return texts[status] || status;
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
  };

  const handleCompleteTask = () => {
    setShowCompletionModal(true);
  };

  const mockTask = {
    id: '1',
    vehicle_info: 'VinFast VF8 - 29A-12345',
    customer_name: 'Nguyễn Văn A',
    service_type: 'Bảo dưỡng Toàn diện',
    status: 'in_progress',
    progress_percentage: 45,
    started_at: '2025-10-06T08:00:00',
    estimated_completion: '2025-10-06T14:00:00',
    description: 'Kiểm tra tổng thể, thay dầu, kiểm tra phanh'
  };

  const mockHistory = [
    {
      id: 1,
      timestamp: '2025-10-06T08:00:00',
      progress: 0,
      status: 'in_progress',
      notes: 'Bắt đầu công việc - Kiểm tra sơ bộ xe',
      technician: 'Bạn'
    },
    {
      id: 2,
      timestamp: '2025-10-06T09:30:00',
      progress: 25,
      status: 'in_progress',
      notes: 'Hoàn thành kiểm tra hệ thống phanh - Phanh hoạt động tốt',
      technician: 'Bạn'
    },
    {
      id: 3,
      timestamp: '2025-10-06T10:45:00',
      progress: 45,
      status: 'in_progress',
      notes: 'Đang thực hiện thay dầu động cơ',
      technician: 'Bạn'
    }
  ];

  if (loading) {
    return (
      <TechnicianLayout>
        <div className="progress-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Đang tải thông tin công việc...</p>
          </div>
        </div>
      </TechnicianLayout>
    );
  }

  if (!task) {
    return (
      <TechnicianLayout>
        <div className="progress-container">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>Không có công việc đang thực hiện</h3>
            <p>Chọn một công việc để cập nhật tiến độ</p>
            <button onClick={() => navigate('/technician/tasks')} className="btn btn-primary">
              📋 Xem danh sách công việc
            </button>
          </div>
        </div>
      </TechnicianLayout>
    );
  }

  return (
    <TechnicianLayout>
      <div className="progress-container">
        {/* Header */}
        <div className="progress-header">
          <div className="header-content">
            <h1 className="page-title">
              <span className="title-icon">🔧</span>
              Cập nhật tiến độ chi tiết
            </h1>
            <p className="page-subtitle">Quản lý và theo dõi tiến độ công việc</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline-secondary" onClick={() => navigate('/technician/tasks')}>
              ← Quay lại
            </button>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`message ${message.type}`}>
            <span className="message-icon">{message.type === 'success' ? '✅' : '❌'}</span>
            <span>{message.text}</span>
          </div>
        )}

        {/* Task Overview */}
        <div className="task-overview">
          <div className="overview-grid">
            <div className="overview-card vehicle-card">
              <div className="card-icon">🚗</div>
              <div className="card-content">
                <h3>Thông tin xe</h3>
                <p className="primary-info">
                  {task.vehicle_make} {task.vehicle_model}
                </p>
                <p className="secondary-info">
                  Biển số: {task.vehicle_license || 'N/A'}
                </p>
              </div>
            </div>

            <div className="overview-card customer-card">
              <div className="card-icon">👤</div>
              <div className="card-content">
                <h3>Khách hàng</h3>
                <p className="primary-info">{task.customer_name || 'N/A'}</p>
                <p className="secondary-info">{task.customer_phone || 'N/A'}</p>
              </div>
            </div>

            <div className="overview-card service-card">
              <div className="card-icon">🔧</div>
              <div className="card-content">
                <h3>Dịch vụ</h3>
                <p className="primary-info">{task.service_type || 'Bảo dưỡng'}</p>
                <p className="secondary-info">
                  Dự kiến: {formatCurrency(task.estimated_cost || 0)}
                </p>
              </div>
            </div>

            <div className="overview-card status-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <h3>Trạng thái</h3>
                <p className="primary-info">
                  <span className={`status-badge ${task.status}`}>
                    {getStatusText(task.status)}
                  </span>
                </p>
                <p className="secondary-info">
                  Tiến độ: {formData.progress_percentage}%
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-section">
            <div className="progress-header">
              <h4>Tiến độ công việc</h4>
              <span className="progress-percentage">{formData.progress_percentage}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${formData.progress_percentage}%` }}
              ></div>
            </div>
            <div className="progress-details">
              <span>Bắt đầu: {formatDate(task.appointment_date)}</span>
              <span>Dự kiến hoàn thành: {formatDate(formData.estimated_completion)}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              📝 Cập nhật tiến độ
            </button>
            <button
              className={`tab ${activeTab === 'checklist' ? 'active' : ''}`}
              onClick={() => setActiveTab('checklist')}
            >
              📋 Checklist ({checklist.length})
            </button>
            <button
              className={`tab ${activeTab === 'parts' ? 'active' : ''}`}
              onClick={() => setActiveTab('parts')}
            >
              ⚙️ Phụ tùng ({partsRequests.length})
            </button>
            <button
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 Lịch sử
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'progress' && (
              <div className="progress-tab">
                <div className="form-section">
                  <h3>Cập nhật tiến độ</h3>
                  <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Trạng thái công việc</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="form-control"
                        >
                          <option value="in_progress">🔄 Đang thực hiện</option>
                          <option value="waiting_parts">⏸️ Chờ phụ tùng</option>
                          <option value="completed">✅ Hoàn thành</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Tiến độ hoàn thành (%)</label>
                        <div className="progress-input">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={formData.progress_percentage}
                            onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) })}
                            className="progress-slider"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.progress_percentage}
                            onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) || 0 })}
                            className="progress-number"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Thời gian dự kiến hoàn thành</label>
                        <input
                          type="datetime-local"
                          value={formData.estimated_completion}
                          onChange={(e) => setFormData({ ...formData, estimated_completion: e.target.value })}
                          className="form-control"
                        />
                      </div>

                      <div className="form-group">
                        <label>Giờ lao động (giờ)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={formData.labor_hours}
                          onChange={(e) => setFormData({ ...formData, labor_hours: parseFloat(e.target.value) || 0 })}
                          className="form-control"
                        />
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label>Ghi chú tiến độ *</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="form-control"
                        rows="4"
                        required
                        placeholder="Mô tả công việc đã thực hiện..."
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Vấn đề phát hiện</label>
                      <textarea
                        value={formData.issues_found}
                        onChange={(e) => setFormData({ ...formData, issues_found: e.target.value })}
                        className="form-control"
                        rows="3"
                        placeholder="Mô tả các vấn đề phát hiện (nếu có)..."
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Khuyến nghị cho khách hàng</label>
                      <textarea
                        value={formData.recommendations}
                        onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                        className="form-control"
                        rows="3"
                        placeholder="Khuyến nghị bảo dưỡng tiếp theo..."
                      />
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary">
                        📤 Cập nhật tiến độ
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCompletionModal(true)}
                        className="btn btn-success"
                        disabled={formData.progress_percentage < 100}
                      >
                        ✅ Hoàn thành công việc
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="checklist-tab">
                <div className="checklist-header">
                  <h3>Danh sách kiểm tra công việc</h3>
                  {task.status === 'completed' && (
                    <div className="completed-notice">
                      <span>🔒</span>
                      <span>Checklist đã khóa - công việc hoàn thành</span>
                    </div>
                  )}
                </div>

                {checklist.length > 0 ? (
                  <div className="checklist-items">
                    {checklist.map((item, index) => (
                      <div key={item.id} className={`checklist-item ${item.completed ? 'completed' : ''}`}>
                        <div className="item-content">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={(e) => updateChecklistItem(item.id, e.target.checked)}
                            disabled={updatingChecklist || task.status === 'completed'}
                            className="checkbox"
                          />
                          <span className="item-text">
                            {index + 1}. {item.description}
                          </span>
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
                ) : (
                  <div className="empty-checklist">
                    <div className="empty-icon">📋</div>
                    <p>Chưa có checklist cho công việc này</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'parts' && (
              <div className="parts-tab">
                <div className="parts-header">
                  <h3>Quản lý phụ tùng</h3>
                  <button className="btn btn-primary" onClick={handleRequestParts}>
                    + Yêu cầu phụ tùng mới
                  </button>
                </div>

                {partsRequests.length > 0 ? (
                  <div className="parts-list">
                    {partsRequests.map((request) => (
                      <div key={request.id} className="parts-item">
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
                  <div className="empty-parts">
                    <div className="empty-icon">⚙️</div>
                    <p>Chưa có yêu cầu phụ tùng nào</p>
                    <button className="btn btn-outline-primary" onClick={handleRequestParts}>
                      Tạo yêu cầu đầu tiên
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="history-tab">
                <h3>Lịch sử cập nhật</h3>
                {updateHistory.length > 0 ? (
                  <div className="history-list">
                    {updateHistory.map((entry) => (
                      <div key={entry.id} className="history-item">
                        <div className="history-header">
                          <div className="history-meta">
                            <span className="technician">{entry.technician}</span>
                            <span className="timestamp">{formatDate(entry.timestamp)}</span>
                          </div>
                          <div className="history-status">
                            <span className={`status-badge ${entry.status}`}>
                              {getStatusText(entry.status)}
                            </span>
                            <span className="progress">{entry.progress}%</span>
                          </div>
                        </div>
                        <div className="history-content">
                          {entry.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-history">
                    <div className="empty-icon">📜</div>
                    <p>Chưa có lịch sử cập nhật</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Completion Modal */}
        {showCompletionModal && (
          <div className="modal-overlay">
            <div className="completion-modal">
              <div className="modal-header">
                <h3>✅ Hoàn thành công việc</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowCompletionModal(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCompleteSubmit}>
                <div className="modal-body">
                  <div className="completion-summary">
                    <h4>📋 Tóm tắt công việc</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="label">Xe:</span>
                        <span className="value">{task.vehicle_make} {task.vehicle_model}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Khách hàng:</span>
                        <span className="value">{task.customer_name}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Dịch vụ:</span>
                        <span className="value">{task.service_type}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Thời gian:</span>
                        <span className="value">{formData.labor_hours} giờ</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>💰 Giá thực tế (VNĐ) *</label>
                    <input
                      type="number"
                      value={formData.total_cost}
                      onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                      className="form-control"
                      placeholder="Nhập tổng chi phí thực tế"
                      min="0"
                      step="1000"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Dịch vụ đã thực hiện</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="form-control"
                      rows="3"
                      placeholder="Mô tả chi tiết các dịch vụ đã hoàn thành..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Chẩn đoán kỹ thuật</label>
                    <textarea
                      value={formData.issues_found}
                      onChange={(e) => setFormData({ ...formData, issues_found: e.target.value })}
                      className="form-control"
                      rows="3"
                      placeholder="Mô tả các vấn đề kỹ thuật đã phát hiện..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Khuyến nghị bảo dưỡng</label>
                    <textarea
                      value={formData.recommendations}
                      onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                      className="form-control"
                      rows="3"
                      placeholder="Khuyến nghị cho lần bảo dưỡng tiếp theo..."
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCompletionModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-success">
                    ✅ Xác nhận hoàn thành
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

export default ProgressUpdatePage;
