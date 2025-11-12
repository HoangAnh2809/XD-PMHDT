import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { technicianAPI, serviceCenterAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const TechnicianTasksPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [appointments, setAppointments] = useState({});
  const [filter, setFilter] = useState('all'); // all, pending, in_progress, completed
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await technicianAPI.getTasks({ status: filter === 'all' ? null : filter });
      // Ensure data is always an array
      const tasksData = Array.isArray(data) ? data : [];
      setTasks(tasksData);

      // Load appointment details for tasks that have appointment_id
      const appointmentPromises = tasksData
        .filter(task => task.id)
        .map(async (task) => {
          try {
            const appointmentData = await serviceCenterAPI.getAppointment(task.id);
            return { id: task.id, data: appointmentData };
          } catch (error) {
            console.error(`Error loading appointment ${task.id}:`, error);
            return null;
          }
        });

      const appointmentResults = await Promise.all(appointmentPromises);
      const appointmentsMap = {};
      appointmentResults.forEach(result => {
        if (result) {
          appointmentsMap[result.id] = result.data;
        }
      });
      setAppointments(appointmentsMap);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const startTask = async (taskId) => {
    try {
      await technicianAPI.startTask(taskId);
      loadTasks();
      navigate(`/technician/tasks/${taskId}/checklist`);
    } catch (error) {
      alert('Lỗi khi bắt đầu công việc: ' + error.message);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    // Backend returns: vehicle_make, vehicle_model, vehicle_license, customer_name, service_type
    const vehicleInfo = `${task.vehicle_make || ''} ${task.vehicle_model || ''} ${task.vehicle_license || ''}`;
    return (
      vehicleInfo.toLowerCase().includes(searchLower) ||
      (task.customer_name || '').toLowerCase().includes(searchLower) ||
      (task.service_type || '').toLowerCase().includes(searchLower)
    );
  });

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

  const getPriorityBadge = (priority) => {
    if (priority === 'high') return { icon: '🔴', text: 'Khẩn', class: 'badge-danger' };
    if (priority === 'medium') return { icon: '🟡', text: 'Trung bình', class: 'badge-warning' };
    return { icon: '🟢', text: 'Thường', class: 'badge-success' };
  };

  return (
    <div className="container" style={{marginTop: '2rem'}}>
        <div className="page-header">
          <h1>📋 Quản lý Công việc</h1>
          <p>Danh sách công việc được phân công</p>
        </div>

        {/* Filters and Search */}
        <div className="card" style={{marginBottom: '1.5rem'}}>
          <div className="filters-bar">
            <div className="filter-group">
              <label>Trạng thái:</label>
              <select className="form-control" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="pending">Chờ xử lý</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="in_progress">Đang thực hiện</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>

            <div className="search-bar" style={{flex: 1}}>
              <input
                type="text"
                className="form-control"
                placeholder="Tìm kiếm theo xe, khách hàng, dịch vụ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="card">
          {loading ? (
            <div style={{textAlign: 'center', padding: '2rem'}}>
              <div className="spinner"></div>
              <p>Đang tải...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{textAlign: 'center', padding: '3rem'}}>
              <div style={{fontSize: '3rem'}}>📭</div>
              <p>Không có công việc nào</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ưu tiên</th>
                    <th>ID Lịch hẹn</th>
                    <th>Thông tin xe</th>
                    <th>Khách hàng</th>
                    <th>Dịch vụ</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => {
                    const priority = getPriorityBadge(task.priority || 'low');
                    const vehicleInfo = `${task.vehicle_make || ''} ${task.vehicle_model || ''}`.trim() || 'N/A';
                    const appointment = appointments[task.id];
                    
                    return (
                      <tr key={task.id}>
                        <td>
                          <span className={`badge ${priority.class}`}>
                            {priority.icon} {priority.text}
                          </span>
                        </td>
                        <td>
                          {task.id ? (
                            <div>
                              <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: '3px', fontSize: '0.85rem' }}>
                                {task.id}
                              </code>
                              {appointment && (
                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                                  📅 {new Date(appointment.appointment_date).toLocaleDateString('vi-VN')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#999' }}>N/A</span>
                          )}
                        </td>
                        <td>
                          <strong>{vehicleInfo}</strong>
                          {task.vehicle_license && (
                            <div style={{fontSize: '0.85rem', color: '#666'}}>
                              🚗 {task.vehicle_license}
                            </div>
                          )}
                          {appointment?.vehicle?.vin && (
                            <div style={{fontSize: '0.75rem', color: '#888'}}>
                              VIN: {appointment.vehicle.vin}
                            </div>
                          )}
                        </td>
                        <td>
                          <div>
                            <strong>{task.customer_name || 'N/A'}</strong>
                            {appointment?.customer && (
                              <div style={{fontSize: '0.75rem', color: '#666'}}>
                                📧 {appointment.customer.email}<br/>
                                📞 {appointment.customer.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong>{task.service_type || 'N/A'}</strong>
                            {appointment?.service_type && (
                              <div style={{fontSize: '0.75rem', color: '#666'}}>
                                💰 {appointment.service_type.base_price?.toLocaleString('vi-VN')} VND
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {task.appointment_date ? new Date(task.appointment_date).toLocaleString('vi-VN') : 'N/A'}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadge(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {task.status === 'pending' && (
                              <button 
                                className="btn btn-sm btn-primary"
                                onClick={() => startTask(task.id)}
                              >
                                Bắt đầu
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button 
                                className="btn btn-sm btn-info"
                                onClick={() => navigate(`/technician/tasks/${task.id}/checklist`)}
                              >
                                Tiếp tục
                              </button>
                            )}
                            <button 
                              className="btn btn-sm btn-secondary"
                              onClick={() => navigate(`/technician/tasks/${task.id}`)}
                            >
                              Chi tiết
                            </button>
                            {task.id && (user?.role === 'staff' || user?.role === 'admin') && (
                              <button 
                                className="btn btn-sm btn-outline-success"
                                onClick={() => navigate(`/staff/invoices/create?appointmentId=${task.id}`)}
                                title="Tạo hóa đơn cho lịch hẹn này"
                              >
                                📄 Tạo HĐ
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
};

export default TechnicianTasksPage;
