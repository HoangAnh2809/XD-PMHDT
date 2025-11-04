import TechnicianInvoiceButton from '../../components/TechnicianInvoiceButton';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { technicianAPI, serviceCenterAPI } from '../../services/api';

const TaskChecklistPage = () => {
  const params = useParams();
  // accept either /tasks/:id or /tasks/:taskId routes
  const id = params.id || params.taskId;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [notes, setNotes] = useState('');
  const [partsNeeded, setPartsNeeded] = useState([]);
  const [showPartModal, setShowPartModal] = useState(false);
  const [partName, setPartName] = useState('');
  const [partQuantity, setPartQuantity] = useState(1);
  const [partNotes, setPartNotes] = useState('');
  const [partSubmitting, setPartSubmitting] = useState(false);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [partSearchLoading, setPartSearchLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  let partSearchTimer = null;
  const [images, setImages] = useState([]);

  useEffect(() => {
    loadTaskDetails();
  }, [id]);

  const loadTaskDetails = async () => {
    try {
      setLoading(true);
      const data = await technicianAPI.getTaskDetails(id);
      setTask(data);
      setChecklist(data.checklist || getDefaultChecklist());
      setNotes(data.notes || '');
      setPartsNeeded(data.parts_needed || []);
      setImages(data.images || []);

      // Load appointment details if task has appointment_id
      if (data.appointment_id || data.appointment?.id) {
        try {
          const appointmentId = data.appointment_id || data.appointment?.id;
          const appointmentData = await serviceCenterAPI.getAppointment(appointmentId);
          setAppointment(appointmentData);
        } catch (appointmentError) {
          console.error('Error loading appointment details:', appointmentError);
          // Don't fail the whole page load if appointment details fail
        }
      }
    } catch (error) {
      console.error('Error loading task:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultChecklist = () => [
    { id: 1, category: 'Pin', item: 'Kiểm tra dung lượng pin', completed: false, notes: '' },
    { id: 2, category: 'Pin', item: 'Kiểm tra hệ thống sạc', completed: false, notes: '' },
    { id: 3, category: 'Pin', item: 'Kiểm tra nhiệt độ pin', completed: false, notes: '' },
    { id: 4, category: 'Động cơ', item: 'Kiểm tra motor điện', completed: false, notes: '' },
    { id: 5, category: 'Động cơ', item: 'Kiểm tra hệ thống truyền động', completed: false, notes: '' },
    { id: 6, category: 'Phanh', item: 'Kiểm tra má phanh', completed: false, notes: '' },
    { id: 7, category: 'Phanh', item: 'Kiểm tra hệ thống ABS', completed: false, notes: '' },
    { id: 8, category: 'Lốp', item: 'Kiểm tra áp suất lốp', completed: false, notes: '' },
    { id: 9, category: 'Lốp', item: 'Kiểm tra độ mòn lốp', completed: false, notes: '' },
    { id: 10, category: 'Điện tử', item: 'Quét mã lỗi', completed: false, notes: '' },
    { id: 11, category: 'Điện tử', item: 'Kiểm tra hệ thống điện', completed: false, notes: '' },
    { id: 12, category: 'Khác', item: 'Kiểm tra đèn chiếu sáng', completed: false, notes: '' },
    { id: 13, category: 'Khác', item: 'Kiểm tra hệ thống làm mát', completed: false, notes: '' }
  ];

  const toggleChecklistItem = async (itemId) => {
    const updatedChecklist = checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedChecklist);

    try {
      // Only call API for checklist items that look like UUIDs (server-side checklist)
      const isUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
      if (isUuid(itemId)) {
        await technicianAPI.updateChecklistItem(id, itemId, !checklist.find(i => i.id === itemId).completed);
      } else {
        // local-only checklist (no server-side checklist configured) — skip API call
        console.debug('Local default checklist updated; no server checklist to update');
      }
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const updateChecklistNotes = (itemId, value) => {
    setChecklist(checklist.map(item =>
      item.id === itemId ? { ...item, notes: value } : item
    ));
  };

  const saveChecklistNotes = async (itemId) => {
    const item = checklist.find(i => i.id === itemId);
    try {
      const isUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
      if (isUuid(itemId)) {
        await technicianAPI.updateChecklistNotes(id, itemId, item.notes);
      } else {
        console.debug('Local default checklist notes saved locally; no server checklist to update');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const addPartRequest = () => {
    setShowPartModal(true);
  };

  const closePartModal = () => {
    setShowPartModal(false);
    setPartName('');
    setPartQuantity(1);
    setPartNotes('');
    setPartSubmitting(false);
  };

  const submitPartRequest = async () => {
    if (!partName || partQuantity <= 0) {
      alert('Vui lòng nhập tên phụ tùng và số lượng hợp lệ');
      return;
    }

    try {
      setPartSubmitting(true);
      await technicianAPI.requestPart({
        task_id: id,
        part_name: partName,
        quantity: partQuantity,
        notes: partNotes
      });
      // Refresh task details to show requested part
      await loadTaskDetails();
      closePartModal();
      alert('Yêu cầu phụ tùng đã được gửi');
    } catch (err) {
      console.error('Error requesting part:', err);
      alert('Lỗi khi gửi yêu cầu phụ tùng: ' + (err.message || err));
      setPartSubmitting(false);
    }
  };

  const searchParts = (query) => {
    if (partSearchTimer) clearTimeout(partSearchTimer);
    if (!query || query.length < 2) {
      setPartSuggestions([]);
      return;
    }
    setPartSearchLoading(true);
    partSearchTimer = setTimeout(async () => {
      try {
        const res = await technicianAPI.getAvailableParts(query);
        setPartSuggestions(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Error searching parts:', err);
        setPartSuggestions([]);
      } finally {
        setPartSearchLoading(false);
      }
    }, 300);
  };

  const pickPartSuggestion = (part) => {
    setSelectedPart(part);
    setPartName(part.name || part.part_name || '');
    setPartQuantity(1);
    setPartSuggestions([]);
  };

  const uploadImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('task_id', id);
      
      await technicianAPI.uploadTaskImage(id, formData);
      loadTaskDetails();
    } catch (error) {
      alert('Lỗi khi tải ảnh: ' + error.message);
    }
  };

  const updateTaskStatus = async (newStatus, actualCost = null) => {
    try {
      const payload = { status: newStatus, notes };
      if (actualCost !== null) {
        payload.actual_cost = actualCost;
      }
      await technicianAPI.updateTaskStatus(id, payload);
      navigate('/technician/tasks');
    } catch (error) {
      alert('Lỗi khi cập nhật trạng thái: ' + error.message);
    }
  };

  const completeTask = async () => {
    const completedCount = checklist.filter(item => item.completed).length;
    const totalCount = checklist.length;
    
    if (completedCount < totalCount) {
      if (!window.confirm(`Chỉ hoàn thành ${completedCount}/${totalCount} mục. Bạn có chắc muốn kết thúc?`)) {
        return;
      }
    }

    // Calculate actual_cost based on completed checklist items
    const actualCost = calculateActualCostFromChecklist();
    
    await updateTaskStatus('completed', actualCost);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const calculateActualCostFromChecklist = () => {
    // Sum up estimated_cost of all completed checklist items
    return checklist
      .filter(item => item.completed)
      .reduce((total, item) => total + (item.estimated_cost || 0), 0);
  };

  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const currentActualCost = calculateActualCostFromChecklist();

  if (loading) {
    return (
      <div className="container" style={{marginTop: '2rem', textAlign: 'center'}}>
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  // Derived safe fields to avoid crashes when backend returns a different shape
  const vehicleInfo = task
    ? (task.vehicle_info || `${task.vehicle_make || ''} ${task.vehicle_model || ''}`.trim() || 'N/A')
    : '';

  const scheduledTime = task
    ? (task.scheduled_time || (task.appointment_date ? new Date(task.appointment_date).toLocaleString('vi-VN') : 'N/A'))
    : '';

  const completedCount = checklist.filter(item => item.completed).length;
  const progressPercent = (completedCount / (checklist.length || 1) * 100).toFixed(0);

  return (
    <div className="container" style={{marginTop: '2rem'}}>
        {/* Task Header */}
        <div className="card" style={{marginBottom: '1.5rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <h1>🔧 {vehicleInfo}</h1>
              <div style={{marginTop: '0.5rem', color: '#666'}}>
                <p>👤 Khách hàng: <strong>{task?.customer_name || 'N/A'}</strong></p>
                <p>📋 Dịch vụ: <strong>{task?.service_type || 'N/A'}</strong></p>
                <p>⏰ Thời gian: {scheduledTime}</p>
              </div>
            </div>
            <div>
              <button className="btn btn-secondary" onClick={() => navigate('/technician/tasks')}>
                ← Quay lại
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{marginTop: '1.5rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
              <span>Tiến độ: {completedCount}/{checklist.length} mục</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{background: '#e9ecef', borderRadius: '4px', height: '24px', overflow: 'hidden'}}>
              <div style={{
                background: 'linear-gradient(90deg, #28a745, #20c997)',
                width: `${progressPercent}%`,
                height: '100%',
                transition: 'width 0.3s'
              }}></div>
            </div>
            <div style={{marginTop: '0.5rem', textAlign: 'right', fontSize: '0.9rem', color: '#28a745', fontWeight: 'bold'}}>
              💰 Giá thực tế hiện tại: {formatCurrency(currentActualCost)}
            </div>
          </div>
        </div>

        {/* Appointment Details */}
        {appointment && (
          <div style={{ marginBottom: '2rem' }}>
            <h2>📋 Thông tin đơn đặt lịch</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              
              {/* Customer Info */}
              <div style={{ padding: '1.5rem', background: '#e8f4fd', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
                <h4 style={{ color: '#0066cc', marginBottom: '1rem' }}>👤 Thông tin khách hàng</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Tên:</strong> {appointment.customer?.full_name || 'N/A'}</div>
                  <div><strong>Email:</strong> {appointment.customer?.email || 'N/A'}</div>
                  <div><strong>SĐT:</strong> {appointment.customer?.phone || 'N/A'}</div>
                  <div><strong>Địa chỉ:</strong> {appointment.customer?.address || 'N/A'}</div>
                </div>
              </div>

              {/* Vehicle Info */}
              <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #b3e5fc' }}>
                <h4 style={{ color: '#0277bd', marginBottom: '1rem' }}>🚗 Thông tin xe</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Hãng xe:</strong> {appointment.vehicle?.make || 'N/A'}</div>
                  <div><strong>Mẫu xe:</strong> {appointment.vehicle?.model || 'N/A'}</div>
                  <div><strong>Năm sản xuất:</strong> {appointment.vehicle?.year || 'N/A'}</div>
                  <div><strong>Biển số:</strong> {appointment.vehicle?.license_plate || 'N/A'}</div>
                  <div><strong>VIN:</strong> {appointment.vehicle?.vin || 'N/A'}</div>
                  <div><strong>Số km hiện tại:</strong> {appointment.vehicle?.current_mileage ? `${appointment.vehicle.current_mileage.toLocaleString()} km` : 'N/A'}</div>
                </div>
              </div>

              {/* Service Info */}
              <div style={{ padding: '1.5rem', background: '#f3e5f5', borderRadius: '8px', border: '1px solid #ce93d8' }}>
                <h4 style={{ color: '#7b1fa2', marginBottom: '1rem' }}>🔧 Thông tin dịch vụ</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Loại dịch vụ:</strong> {appointment.service_type?.name || 'N/A'}</div>
                  <div><strong>Mô tả:</strong> {appointment.service_type?.description || 'N/A'}</div>
                  <div><strong>Giá cơ bản:</strong> {formatCurrency(appointment.service_type?.base_price)}</div>
                  <div><strong>Thời gian dự kiến:</strong> {appointment.service_type?.estimated_duration || 'N/A'}</div>
                </div>
              </div>

              {/* Appointment Info */}
              <div style={{ padding: '1.5rem', background: '#fff3e0', borderRadius: '8px', border: '1px solid #ffb74d' }}>
                <h4 style={{ color: '#f57c00', marginBottom: '1rem' }}>📅 Thông tin lịch hẹn</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>ID lịch hẹn:</strong> <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>{appointment.id}</code></div>
                  <div><strong>Ngày hẹn:</strong> {formatDate(appointment.appointment_date)}</div>
                  <div><strong>Trạng thái:</strong> 
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.85rem',
                      background: appointment.status === 'completed' ? '#e8f5e8' : 
                                 appointment.status === 'in_progress' ? '#fff3e0' : '#ffebee',
                      color: appointment.status === 'completed' ? '#2e7d32' : 
                             appointment.status === 'in_progress' ? '#f57c00' : '#c62828'
                    }}>
                      {appointment.status === 'pending' ? 'Chờ xử lý' :
                       appointment.status === 'in_progress' ? 'Đang thực hiện' :
                       appointment.status === 'completed' ? 'Hoàn thành' :
                       appointment.status === 'cancelled' ? 'Đã hủy' : appointment.status}
                    </span>
                  </div>
                  <div><strong>Giá dự kiến:</strong> {formatCurrency(appointment.estimated_cost)}</div>
                  <div><strong>Giá thực tế:</strong> {formatCurrency(appointment.actual_cost)}</div>
                  <div><strong>Ghi chú khách hàng:</strong> {appointment.customer_notes || 'Không có'}</div>
                  <div><strong>Ghi chú nhân viên:</strong> {appointment.staff_notes || 'Không có'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="row">
          {/* Checklist */}
          <div className="col-md-8">
            <div className="card">
              <h2>📝 Danh sách kiểm tra</h2>
              
              {Object.entries(groupedChecklist).map(([category, items]) => (
                <div key={category} style={{marginBottom: '1.5rem'}}>
                  <h3 style={{color: '#667eea', marginBottom: '1rem'}}>{category}</h3>
                  
                  {items.map(item => (
                    <div key={item.id} style={{marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px'}}>
                      <div style={{display: 'flex', alignItems: 'flex-start', gap: '0.75rem'}}>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleChecklistItem(item.id)}
                          style={{marginTop: '0.25rem', width: '20px', height: '20px'}}
                        />
                        <div style={{flex: 1}}>
                          <div style={{textDecoration: item.completed ? 'line-through' : 'none'}}>
                            {item.item_name || item.item}
                            {item.estimated_cost > 0 && (
                              <span style={{marginLeft: '1rem', fontSize: '0.9rem', color: '#28a745', fontWeight: 'bold'}}>
                                💰 {formatCurrency(item.estimated_cost)}
                              </span>
                            )}
                          </div>
                          <textarea
                            className="form-control"
                            placeholder="Ghi chú (nếu có)..."
                            value={item.notes}
                            onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
                            onBlur={() => saveChecklistNotes(item.id)}
                            style={{marginTop: '0.5rem', fontSize: '0.9rem'}}
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-md-4">
            {/* Parts Needed */}
            <div className="card" style={{marginBottom: '1.5rem'}}>
              <h3>⚙️ Phụ tùng cần thiết</h3>
              
              {partsNeeded.length === 0 ? (
                <p style={{color: '#666', fontSize: '0.9rem'}}>Chưa có phụ tùng nào được yêu cầu</p>
              ) : (
                <div>
                  {partsNeeded.map((part, index) => (
                    <div key={index} style={{padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', marginBottom: '0.5rem'}}>
                      <div><strong>{part.part_name}</strong></div>
                      <div style={{fontSize: '0.85rem', color: '#666'}}>
                        Số lượng: {part.quantity} | {part.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <button className="btn btn-outline-primary" style={{marginTop: '1rem', width: '100%'}} onClick={addPartRequest}>
                + Yêu cầu phụ tùng
              </button>
            </div>

            {/* Part Request Modal */}
            {showPartModal && (
              <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999}}>
                <div style={{background: '#fff', padding: '1.25rem', borderRadius: '8px', width: '480px', maxWidth: '90%'}}>
                  <h4>Yêu cầu phụ tùng</h4>
                  <div style={{marginTop: '0.75rem', position: 'relative'}}>
                    <label>Tên phụ tùng</label>
                    <input className="form-control" value={partName} onChange={(e) => { setPartName(e.target.value); searchParts(e.target.value); }} />
                    {partSearchLoading && <div style={{position: 'absolute', right: '10px', top: '34px'}}>...</div>}
                    {partSuggestions.length > 0 && (
                      <div style={{position: 'absolute', left: 0, right: 0, top: '62px', background: '#fff', border: '1px solid #ddd', zIndex: 10000, maxHeight: '180px', overflowY: 'auto'}}>
                        {partSuggestions.map(p => (
                          <div key={p.id} style={{padding: '0.5rem', borderBottom: '1px solid #f1f1f1', cursor: 'pointer'}} onClick={() => pickPartSuggestion(p)}>
                            <div><strong>{p.name || p.part_name}</strong></div>
                            <div style={{fontSize: '0.85rem', color: '#666'}}>Available: {p.quantity_available || p.quantity || 0}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{marginTop: '0.75rem', display: 'flex', gap: '0.5rem'}}>
                    <div style={{flex: 1}}>
                      <label>Số lượng</label>
                      <input type="number" className="form-control" value={partQuantity} min={1} onChange={(e) => setPartQuantity(parseInt(e.target.value || '1'))} />
                    </div>
                    <div style={{flex: 2}}>
                      <label>Ghi chú (tùy chọn)</label>
                      <input className="form-control" value={partNotes} onChange={(e) => setPartNotes(e.target.value)} />
                    </div>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem'}}>
                    <button className="btn btn-secondary" onClick={closePartModal} disabled={partSubmitting}>Hủy</button>
                    <button className="btn btn-primary" onClick={submitPartRequest} disabled={partSubmitting}>{partSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Images */}
            <div className="card" style={{marginBottom: '1.5rem'}}>
              <h3>📸 Hình ảnh</h3>
              
              <div style={{marginBottom: '1rem'}}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      uploadImage(e.target.files[0]);
                    }
                  }}
                  style={{display: 'none'}}
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="btn btn-outline-secondary" style={{width: '100%', cursor: 'pointer'}}>
                  📷 Tải ảnh lên
                </label>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem'}}>
                {images.map((img, index) => (
                  <img key={index} src={img.url} alt={`Ảnh ${index + 1}`} style={{width: '100%', borderRadius: '4px'}} />
                ))}
              </div>
            </div>

            {/* General Notes */}
            <div className="card">
              <h3>📝 Ghi chú chung</h3>
              <textarea
                className="form-control"
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú về tình trạng xe, vấn đề phát sinh..."
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="card" style={{marginTop: '1.5rem'}}>
          <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
            <button 
              className="btn btn-warning"
              onClick={() => updateTaskStatus('waiting_parts')}
            >
              ⏸️ Tạm dừng - Chờ phụ tùng
            </button>
            <button 
              className="btn btn-success"
              onClick={completeTask}
            >
              ✅ Hoàn thành công việc
            </button>
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              {/* Allow technician to create invoice for the related appointment/task */}
              <TechnicianInvoiceButton appointmentId={task?.appointment_id || task?.appointment?.id} onCreated={() => loadTaskDetails()} />
            </div>
          </div>
        </div>
      </div>
  );
};

export default TaskChecklistPage;
