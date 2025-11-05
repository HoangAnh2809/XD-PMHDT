import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TechnicianLayout from '../../components/TechnicianLayout';
import { serviceCenterAPI, invoiceAPI, technicianAPI, paymentAPI } from '../../services/api';

const CreateInvoicePage = () => {
  const [searchParams] = useSearchParams();
  const [appointmentId, setAppointmentId] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [task, setTask] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Parts request states
  const [partsRequests, setPartsRequests] = useState([]);
  const [loadingParts, setLoadingParts] = useState(false);
  
  // Invoice viewing and payment states
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [vnPayLoading, setVnPayLoading] = useState(false);

  // Load parts requests when appointment is loaded
  useEffect(() => {
    if (appointment && appointment.id) {
      loadPartsRequests(appointment.id);
    }
  }, [appointment]);

  // Function to load parts requests for the appointment
  const loadPartsRequests = async (appointmentId) => {
    setLoadingParts(true);
    try {
      const allRequests = await technicianAPI.getPartsRequests();
      // Filter requests for this specific appointment
      const appointmentRequests = allRequests.filter(request => 
        request.appointment_id === appointmentId || 
        request.task?.appointment_id === appointmentId
      );
      setPartsRequests(appointmentRequests);
    } catch (err) {
      console.error('Error loading parts requests:', err);
      // Don't show error for parts loading as it's not critical
    } finally {
      setLoadingParts(false);
    }
  };

  // Function to validate UUID format
  const isValidUUID = (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const loadAppointment = async () => {
    if (!appointmentId.trim()) {
      setError('Vui lòng nhập mã lịch hẹn');
      return;
    }

    // Additional validation
    if (appointmentId === 'N/A' || appointmentId === 'null' || appointmentId === 'undefined' || !isValidUUID(appointmentId)) {
      setError('Mã lịch hẹn không hợp lệ. Vui lòng nhập mã lịch hẹn chính xác (UUID format).');
      return;
    }

    setError(null);
    setAppointment(null);
    setLoading(true);

    try {
      const data = await serviceCenterAPI.getAppointment(appointmentId.trim());

      if (!data) {
        setError('Không tìm thấy lịch hẹn với mã này. Vui lòng kiểm tra lại mã lịch hẹn.');
        return;
      }
      setAppointment(data);

      // Try to load associated task and checklist
      try {
        // Find task by appointment_id
        const tasksResponse = await technicianAPI.getTasks({ appointment_id: appointmentId.trim() });
        if (tasksResponse && tasksResponse.length > 0) {
          const associatedTask = tasksResponse[0]; // Get the first task
          setTask(associatedTask);
          
          // Load checklist for this task
          const checklistData = await technicianAPI.getTaskChecklist(associatedTask.id);
          setChecklist(Array.isArray(checklistData) ? checklistData : []);
        }
      } catch (taskError) {
        // Don't fail the whole process if task loading fails
      }
    } catch (err) {
      console.error('Error loading appointment:', err);
      // Ensure error is a string, not an object
      const errorMessage = err?.response?.data?.detail ||
                          err?.response?.data?.message ||
                          err?.message ||
                          'Lỗi khi tải thông tin lịch hẹn';

      // Check for authentication errors
      if (err?.response?.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (err?.response?.status === 403) {
        setError('Bạn không có quyền truy cập thông tin này.');
      } else if (err?.response?.status === 404) {
        setError('Không tìm thấy lịch hẹn với mã này.');
      } else if (err?.response?.status === 422) {
        setError('Định dạng mã lịch hẹn không hợp lệ. Vui lòng nhập UUID hợp lệ.');
      } else {
        setError(typeof errorMessage === 'string' ? errorMessage : 'Lỗi khi tải thông tin lịch hẹn');
      }
    } finally {
      setLoading(false);
    }
  };

  const createInvoice = async () => {
    if (!appointment) return;

    setError(null);
    setResult(null);
    setCreating(true);

    try {
      // Use actual cost from checklist and parts if available, otherwise use appointment's actual_cost or estimated_cost
      const invoiceAmount = totalInvoiceAmount > 0 ? totalInvoiceAmount : 
                           (appointment.actual_cost || appointment.estimated_cost || 0);

      const customerId = appointment.customer_id || (appointment.customer && appointment.customer.id);
      const serviceCenterId = appointment.service_center_id || (appointment.service_center && appointment.service_center.id);

      if (!customerId) {
        throw new Error('Không thể tạo hóa đơn: Thiếu thông tin khách hàng');
      }

      const invoiceData = {
        appointment_id: appointment.id,
        customer_id: customerId,
        service_center_id: serviceCenterId,
        subtotal: invoiceAmount,
        discount: 0,
        due_date: new Date().toISOString().split('T')[0], // Format: YYYY-MM-DD
        notes: `Hóa đơn cho lịch hẹn ${appointment.id}${task ? ` - Task ${task.id}` : ''}`
      };

      const res = await invoiceAPI.createInvoice(invoiceData);
      setResult(res.data || res);
    } catch (err) {
      console.error('Error creating invoice:', err);
      // Ensure error is a string, not an object
      const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Lỗi khi tạo hóa đơn';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Lỗi khi tạo hóa đơn');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có lịch hẹn';
    
    try {
      // Parse the date string, handling timezone +07:00
      const date = new Date(dateString);
      
      // Format as dd/mm/yyyy, hh:mm (giờ Việt Nam – GMT+7)
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year}, ${hours}:${minutes} (giờ Việt Nam – GMT+7)`;
    } catch (error) {
      return 'Chưa có lịch hẹn';
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return formatCurrency(0);
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const calculateActualCostFromChecklist = () => {
    // Sum up estimated_cost of all completed checklist items
    if (!Array.isArray(checklist)) return 0;
    return checklist
      .filter(item => item.completed)
      .reduce((total, item) => total + (item.estimated_cost || 0), 0);
  };

  const calculatePartsCost = () => {
    // Sum up cost of all approved parts requests
    if (!Array.isArray(partsRequests)) return 0;
    return partsRequests
      .filter(request => request.status === 'approved' || request.status === 'delivered')
      .reduce((total, request) => {
        const quantity = request.quantity || 1;
        const unitPrice = request.part?.price || request.unit_price || 0;
        return total + (quantity * unitPrice);
      }, 0);
  };

  const currentActualCost = calculateActualCostFromChecklist();
  const partsCost = calculatePartsCost();
  const totalInvoiceAmount = currentActualCost + partsCost;

  // Payment handling functions
  const handleViewInvoice = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await paymentAPI.getInvoiceDetail(invoiceId);
      setViewingInvoice(response.data);
    } catch (err) {
      console.error('Error loading invoice:', err);
      alert('❌ Không thể tải chi tiết hóa đơn. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCashPayment = async () => {
    if (!viewingInvoice) return;
    
    try {
      setRecordingPayment(true);
      await paymentAPI.recordCashPayment(viewingInvoice.id);
      alert('✅ Đã ghi nhận thanh toán tiền mặt');
      setShowPaymentModal(false);
      // Reload invoice details
      await handleViewInvoice(viewingInvoice.id);
    } catch (err) {
      console.error('Error recording cash payment:', err);
      alert('❌ Lỗi khi ghi nhận thanh toán. Vui lòng thử lại.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleVNPayPayment = async () => {
    if (!viewingInvoice) return;
    
    try {
      setVnPayLoading(true);
      const response = await paymentAPI.createVNPayPayment(viewingInvoice.id);
      if (response.data.payment_url) {
        // Open VNPay payment URL in a new window
        window.open(response.data.payment_url, '_blank');
        alert('Đã mở trang thanh toán VNPay. Vui lòng hoàn tất thanh toán.');
        setShowPaymentModal(false);
        // Reload invoice details after a delay
        setTimeout(() => handleViewInvoice(viewingInvoice.id), 3000);
      } else {
        alert('❌ Không thể tạo liên kết thanh toán VNPay. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error creating VNPay payment:', err);
      alert('❌ Lỗi khi tạo thanh toán VNPay. Vui lòng thử lại.');
    } finally {
      setVnPayLoading(false);
    }
  };

  const handlePaymentConfirm = () => {
    if (selectedPaymentMethod === 'cash') {
      handleCashPayment();
    } else if (selectedPaymentMethod === 'vnpay') {
      handleVNPayPayment();
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'Chờ thanh toán', class: 'badge-warning' },
      'paid': { label: 'Đã thanh toán', class: 'badge-success' },
      'failed': { label: 'Thanh toán thất bại', class: 'badge-danger' },
      'cancelled': { label: 'Đã hủy', class: 'badge-secondary' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'badge-secondary' };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  return (
    <TechnicianLayout>
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>📄 Tạo hóa đơn từ lịch hẹn</h1>
        <p>Tìm kiếm lịch hẹn và tạo hóa đơn cho khách hàng.</p>

        {/* Search Section */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h3>🔍 Tìm lịch hẹn</h3>
          {searchParams.get('appointmentId') && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e8f4fd', border: '1px solid #b3d9ff', borderRadius: '4px', color: '#0066cc' }}>
              <strong>ℹ️ Lưu ý:</strong> Mã lịch hẹn đã được tự động điền từ trang công việc. Bạn có thể tìm kiếm lịch hẹn khác nếu cần.
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Mã lịch hẹn (Appointment ID)
              </label>
              <input
                className="form-control"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
                placeholder="Nhập UUID của lịch hẹn (ví dụ: ea9c0b6f-5f89-44cc-94d3-15d2a944d734)"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={loadAppointment}
              disabled={loading}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {loading ? '🔄 Đang tải...' : '🔍 Tìm kiếm'}
            </button>
          </div>
        </div>

        {/* Appointment Details */}
        {appointment && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>📋 Thông tin lịch hẹn</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              
              {/* Customer Info */}
              <div style={{ padding: '1.5rem', background: '#e8f4fd', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
                <h4 style={{ color: '#0066cc', marginBottom: '1rem' }}>👤 Thông tin khách hàng</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Tên:</strong> {appointment.customer && typeof appointment.customer.full_name === 'string' ? appointment.customer.full_name : 'Khách hàng ẩn danh'}</div>
                  <div><strong>Email:</strong> {appointment.customer && typeof appointment.customer.email === 'string' ? appointment.customer.email : 'Chưa cung cấp'}</div>
                  <div><strong>SĐT:</strong> {appointment.customer && typeof appointment.customer.phone === 'string' ? appointment.customer.phone : 'Chưa cung cấp'}</div>
                  <div><strong>Địa chỉ:</strong> {appointment.customer && typeof appointment.customer.address === 'string' ? appointment.customer.address : 'Chưa cung cấp'}</div>
                </div>
              </div>

              {/* Vehicle Info */}
              <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #b3e5fc' }}>
                <h4 style={{ color: '#0277bd', marginBottom: '1rem' }}>🚗 Thông tin xe</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Hãng xe:</strong> {appointment.vehicle && typeof appointment.vehicle.make === 'string' ? appointment.vehicle.make : 'Chưa xác định'}</div>
                  <div><strong>Mẫu xe:</strong> {appointment.vehicle && typeof appointment.vehicle.model === 'string' ? appointment.vehicle.model : 'Chưa xác định'}</div>
                  <div><strong>Năm sản xuất:</strong> {appointment.vehicle && typeof appointment.vehicle.year === 'string' ? appointment.vehicle.year : 'Chưa cập nhật'}</div>
                  <div><strong>Biển số:</strong> {appointment.vehicle && typeof appointment.vehicle.license_plate === 'string' ? appointment.vehicle.license_plate : 'Chưa có biển số'}</div>
                  <div><strong>VIN:</strong> {appointment.vehicle && typeof appointment.vehicle.vin === 'string' ? appointment.vehicle.vin : 'Chưa cập nhật'}</div>
                  <div><strong>Số km hiện tại:</strong> {appointment.vehicle && typeof appointment.vehicle.current_mileage === 'number' ? `${appointment.vehicle.current_mileage.toLocaleString()} km` : '0 km'}</div>
                </div>
              </div>

              {/* Service Info */}
              <div style={{ padding: '1.5rem', background: '#f3e5f5', borderRadius: '8px', border: '1px solid #ce93d8' }}>
                <h4 style={{ color: '#7b1fa2', marginBottom: '1rem' }}>🔧 Thông tin dịch vụ</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Loại dịch vụ:</strong> {appointment.service_type && typeof appointment.service_type.name === 'string' ? appointment.service_type.name : 'Dịch vụ bảo dưỡng'}</div>
                  <div><strong>Mô tả:</strong> {appointment.service_type && typeof appointment.service_type.description === 'string' ? appointment.service_type.description : 'Dịch vụ bảo dưỡng và sửa chữa xe'}</div>
                  <div><strong>Giá cơ bản:</strong> {appointment.service_type && typeof appointment.service_type.base_price === 'number' ? formatCurrency(appointment.service_type.base_price) : formatCurrency(0)}</div>
                  <div><strong>Giá dự kiến:</strong> {typeof appointment.estimated_cost === 'number' ? formatCurrency(appointment.estimated_cost) : formatCurrency(0)}</div>
                  <div><strong>Giá từ checklist:</strong> <span style={{color: Array.isArray(checklist) && checklist.length > 0 && currentActualCost > 0 ? '#2e7d32' : '#f57c00', fontWeight: 'bold'}}>
                    {Array.isArray(checklist) && checklist.length > 0 && currentActualCost > 0 ? formatCurrency(currentActualCost) : 'Chưa có checklist hoặc chưa hoàn thành'}
                  </span></div>
                  <div><strong>Giá thực tế:</strong> {typeof appointment.actual_cost === 'number' ? formatCurrency(appointment.actual_cost) : formatCurrency(0)}</div>
                  <div><strong>Thời gian dự kiến:</strong> {appointment.service_type && typeof appointment.service_type.estimated_duration === 'string' ? appointment.service_type.estimated_duration : '2 giờ'}</div>
                </div>
              </div>

              {/* Appointment Info */}
              <div style={{ padding: '1.5rem', background: '#fff3e0', borderRadius: '8px', border: '1px solid #ffb74d' }}>
                <h4 style={{ color: '#f57c00', marginBottom: '1rem' }}>📅 Thông tin lịch hẹn</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                       appointment.status === 'cancelled' ? 'Đã hủy' : 
                       typeof appointment.status === 'string' ? appointment.status : 'Chờ xử lý'}
                    </span>
                  </div>
                  <div><strong>Giá dự kiến:</strong> {typeof appointment.estimated_cost === 'number' ? formatCurrency(appointment.estimated_cost) : formatCurrency(0)}</div>
                  <div><strong>Giá từ checklist:</strong> <span style={{color: Array.isArray(checklist) && checklist.length > 0 && currentActualCost > 0 ? '#2e7d32' : '#f57c00', fontWeight: 'bold'}}>
                    {Array.isArray(checklist) && checklist.length > 0 && currentActualCost > 0 ? formatCurrency(currentActualCost) : 'Chưa có checklist hoặc chưa hoàn thành'}
                  </span></div>
                  <div><strong>Giá thực tế:</strong> {typeof appointment.actual_cost === 'number' ? formatCurrency(appointment.actual_cost) : formatCurrency(0)}</div>
                  <div><strong>Ghi chú khách hàng:</strong> {typeof appointment.customer_notes === 'string' ? appointment.customer_notes : 'Không có ghi chú'}</div>
                  <div><strong>Ghi chú nhân viên:</strong> {typeof appointment.staff_notes === 'string' ? appointment.staff_notes : 'Không có ghi chú'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task Checklist Section */}
        {task && Array.isArray(checklist) && checklist.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>📋 Chi tiết checklist công việc</h3>
            <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Tiến độ:</strong> {checklist.filter(item => item.completed).length}/{checklist.length} mục đã hoàn thành
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {checklist.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      background: item.completed ? '#f0f8f0' : '#fff',
                      borderColor: item.completed ? '#4caf50' : '#ddd'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <span style={{
                        fontWeight: 'bold',
                        textDecoration: item.completed ? 'line-through' : 'none',
                        color: item.completed ? '#666' : '#000'
                      }}>
                        {index + 1}. {item.item_name || item.description || item.item}
                      </span>
                    </div>
                    
                    {item.estimated_cost > 0 && (
                      <div style={{ fontSize: '0.9rem', color: item.completed ? '#2e7d32' : '#666' }}>
                        💰 Giá: {formatCurrency(item.estimated_cost)}
                        {item.completed && <span style={{ marginLeft: '0.5rem', color: '#2e7d32' }}>✅</span>}
                      </div>
                    )}
                    
                    {item.notes && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                        📝 {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {currentActualCost > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f5e8', borderRadius: '6px', border: '1px solid #4caf50' }}>
                  <h4 style={{ color: '#2e7d32', margin: '0 0 0.5rem 0' }}>💰 Tổng giá từ checklist đã hoàn thành</h4>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2e7d32' }}>
                    {formatCurrency(currentActualCost)}
                  </div>
                  <small style={{ color: '#666' }}>
                    Giá này được tính từ {Array.isArray(checklist) ? checklist.filter(item => item.completed).length : 0} mục checklist đã hoàn thành
                  </small>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Parts Requests Section */}
        {appointment && Array.isArray(partsRequests) && partsRequests.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>🔧 Phụ tùng đã yêu cầu</h3>
            <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
              {loadingParts ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div>🔄 Đang tải danh sách phụ tùng...</div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Số lượng phụ tùng:</strong> {partsRequests.length} yêu cầu 
                    ({partsRequests.filter(r => r.status === 'approved' || r.status === 'delivered').length} đã duyệt)
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                    {partsRequests.map((request, index) => (
                      <div
                        key={request.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          background: request.status === 'approved' || request.status === 'delivered' ? '#f0f8f0' : 
                                     request.status === 'pending' ? '#fff3cd' : '#ffebee',
                          borderColor: request.status === 'approved' || request.status === 'delivered' ? '#4caf50' : 
                                      request.status === 'pending' ? '#ffc107' : '#f44336'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>
                              {request.part?.name || request.part_name || `Phụ tùng ${index + 1}`}
                            </h5>
                            <div style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'monospace' }}>
                              Mã: {request.part?.part_number || request.part_number || 'N/A'}
                            </div>
                          </div>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'white',
                            background: request.status === 'approved' || request.status === 'delivered' ? '#4caf50' :
                                       request.status === 'pending' ? '#ff9800' : '#f44336'
                          }}>
                            {request.status === 'approved' ? 'Đã duyệt' :
                             request.status === 'delivered' ? 'Đã giao' :
                             request.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                          <div><strong>Số lượng:</strong> {request.quantity || 1}</div>
                          <div><strong>Đơn giá:</strong> {formatCurrency(request.part?.price || request.unit_price || 0)}</div>
                          <div><strong>Thành tiền:</strong> {formatCurrency((request.quantity || 1) * (request.part?.price || request.unit_price || 0))}</div>
                          <div><strong>Ưu tiên:</strong> 
                            <span style={{
                              color: request.urgency === 'high' ? '#d32f2f' : 
                                     request.urgency === 'medium' ? '#f57c00' : '#2e7d32',
                              fontWeight: '600'
                            }}>
                              {request.urgency === 'high' ? 'Cao' : 
                               request.urgency === 'medium' ? 'Trung bình' : 'Thấp'}
                            </span>
                          </div>
                        </div>
                        
                        {request.notes && (
                          <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'white', borderRadius: '4px', borderLeft: '3px solid #007bff' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>📝 Lý do:</div>
                            <div style={{ fontSize: '0.85rem', color: '#333' }}>{request.notes}</div>
                          </div>
                        )}
                        
                        {request.status === 'approved' && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#2e7d32' }}>
                            ✅ Phụ tùng này sẽ được tính vào hóa đơn
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {partsCost > 0 && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f5e8', borderRadius: '6px', border: '1px solid #4caf50' }}>
                      <h4 style={{ color: '#2e7d32', margin: '0 0 0.5rem 0' }}>💰 Tổng chi phí phụ tùng đã duyệt</h4>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2e7d32' }}>
                        {formatCurrency(partsCost)}
                      </div>
                      <small style={{ color: '#666' }}>
                        Chi phí này sẽ được cộng vào tổng hóa đơn
                      </small>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Create Invoice Button */}
        {appointment && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '8px' }}>
              <h4 style={{ color: '#856404', margin: '0 0 0.5rem 0' }}>💰 Giá hóa đơn sẽ được tạo</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#856404' }}>
                {formatCurrency(totalInvoiceAmount > 0 ? totalInvoiceAmount : (appointment.actual_cost || appointment.estimated_cost || 0))}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#856404', marginTop: '0.5rem' }}>
                {totalInvoiceAmount > 0 ? (
                  <div>
                    <div>💼 Chi phí công việc: {formatCurrency(currentActualCost)}</div>
                    <div>🔧 Chi phí phụ tùng: {formatCurrency(partsCost)}</div>
                    <div style={{ borderTop: '1px solid #856404', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                      <strong>Tổng cộng: {formatCurrency(totalInvoiceAmount)}</strong>
                    </div>
                  </div>
                ) : (
                  <small>
                    {appointment.actual_cost ? 'Giá thực tế từ lịch hẹn' : 'Giá dự kiến từ lịch hẹn'}
                  </small>
                )}
              </div>
            </div>
            
            <button
              className="btn btn-success btn-lg"
              onClick={createInvoice}
              disabled={creating}
              style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}
            >
              {creating ? '⏳ Đang tạo hóa đơn...' : '✅ Tạo hóa đơn'}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #4caf50', background: '#e8f5e8', borderRadius: '8px' }}>
            <h3 style={{ color: '#2e7d32', marginBottom: '1rem' }}>✅ Hóa đơn đã được tạo thành công!</h3>
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
              <h4>Thông tin hóa đơn:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div><strong>ID hóa đơn:</strong> {typeof result.id === 'string' ? result.id : (typeof result.invoice_id === 'string' ? result.invoice_id : 'INV-001')}</div>
                <div><strong>Tổng tiền:</strong> {typeof result.total_amount === 'number' ? formatCurrency(result.total_amount) : (typeof result.amount === 'number' ? formatCurrency(result.amount) : formatCurrency(0))}</div>
                <div><strong>Trạng thái:</strong> {typeof result.payment_status === 'string' ? getStatusBadge(result.payment_status) : getStatusBadge('pending')}</div>
                <div><strong>Ngày tạo:</strong> {formatDate(result.issue_date || result.created_at)}</div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={() => handleViewInvoice(result.id || result.invoice_id)}
                  className="btn btn-primary"
                >
                  �️ Xem chi tiết và thanh toán
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Detail View */}
        {viewingInvoice && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #2196f3', background: '#e3f2fd', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0d47a1', margin: 0 }}>👁️ Chi tiết hóa đơn</h3>
              <button
                onClick={() => setViewingInvoice(null)}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem' }}
              >
                ✕ Đóng
              </button>
            </div>

            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #bbdefb' }}>
              {/* Invoice Header */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0 }}>🧾 Thông tin hóa đơn</h4>
                  {getStatusBadge(viewingInvoice.payment_status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><strong>Mã hóa đơn:</strong> <span style={{ fontFamily: 'monospace' }}>{viewingInvoice.invoice_number}</span></div>
                  <div><strong>Ngày tạo:</strong> {formatDate(viewingInvoice.issue_date || viewingInvoice.created_at)}</div>
                  <div><strong>Ngày đến hạn:</strong> {formatDate(viewingInvoice.due_date)}</div>
                  <div><strong>Trạng thái:</strong> {getStatusBadge(viewingInvoice.payment_status)}</div>
                </div>

                {viewingInvoice.notes && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px' }}>
                    <strong>📝 Ghi chú:</strong> {viewingInvoice.notes}
                  </div>
                )}
              </div>

              {/* Service Information */}
              {viewingInvoice.appointment && (
                <div style={{ marginBottom: '2rem' }}>
                  <h4>🔧 Thông tin dịch vụ</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div><strong>Dịch vụ:</strong> {viewingInvoice.appointment.service_type?.name || 'N/A'}</div>
                    <div><strong>Ngày hẹn:</strong> {formatDate(viewingInvoice.appointment.appointment_date)}</div>
                    {viewingInvoice.appointment.vehicle && (
                      <>
                        <div><strong>Xe:</strong> {viewingInvoice.appointment.vehicle.make} {viewingInvoice.appointment.vehicle.model}</div>
                        <div><strong>Biển số:</strong> {viewingInvoice.appointment.vehicle.license_plate}</div>
                      </>
                    )}
                    {viewingInvoice.appointment.service_center && (
                      <div><strong>Trung tâm:</strong> {viewingInvoice.appointment.service_center.name}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              <div style={{ marginBottom: '2rem' }}>
                <h4>💰 Chi tiết thanh toán</h4>
                <div style={{ maxWidth: '400px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <span>Chi phí công việc:</span>
                    <span>{formatCurrency(currentActualCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <span>Chi phí phụ tùng:</span>
                    <span>{formatCurrency(partsCost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                    <span>Tiền dịch vụ:</span>
                    <span>{formatCurrency(viewingInvoice.subtotal || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                    <span>Thuế VAT (10%):</span>
                    <span>{formatCurrency(viewingInvoice.tax || 0)}</span>
                  </div>
                  {viewingInvoice.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee', color: '#48bb78' }}>
                      <span>Giảm giá:</span>
                      <span>-{formatCurrency(viewingInvoice.discount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '2px solid #1a1a2e', fontSize: '1.2rem', fontWeight: 'bold', color: '#d63031' }}>
                    <span>Tổng cộng:</span>
                    <span>{formatCurrency(viewingInvoice.total_amount || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Actions */}
              {viewingInvoice.payment_status === 'pending' && (
                <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #e0e0e0' }}>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="btn btn-success btn-lg"
                    style={{ padding: '0.75rem 2rem' }}
                  >
                    💰 Thanh toán ngay
                  </button>
                </div>
              )}

              {viewingInvoice.payment_status === 'paid' && viewingInvoice.payment_date && (
                <div style={{ padding: '1rem', background: '#f0f8f0', borderRadius: '4px', border: '1px solid #4caf50' }}>
                  <h5 style={{ color: '#2e7d32', margin: '0 0 0.5rem 0' }}>✅ Đã thanh toán</h5>
                  <div><strong>Phương thức:</strong> 
                    {viewingInvoice.payment_method === 'vnpay' && ' 💳 VNPay'}
                    {viewingInvoice.payment_method === 'momo' && ' 📱 Momo'}
                    {viewingInvoice.payment_method === 'cash' && ' 💵 Tiền mặt'}
                    {!viewingInvoice.payment_method && ' N/A'}
                  </div>
                  <div><strong>Ngày thanh toán:</strong> {formatDate(viewingInvoice.payment_date)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #f44336', background: '#ffebee', borderRadius: '8px', color: '#c62828' }}>
            <h3>❌ Lỗi</h3>
            <p>{error}</p>
            {error.includes('đăng nhập') && (
              <button
                className="btn btn-primary"
                onClick={() => window.location.href = '/login'}
                style={{ marginTop: '1rem' }}
              >
                🔐 Đăng nhập lại
              </button>
            )}
            {process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>ℹ️ Thông tin debug (chỉ dành cho developer)</summary>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', fontFamily: 'monospace', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
                  <div>Appointment ID: {appointmentId || 'Không có'}</div>
                  <div>UUID Valid: {appointmentId ? (isValidUUID(appointmentId) ? '✅ Có' : '❌ Không') : 'N/A'}</div>
                  <div>Token: {localStorage.getItem('token') ? 'Có' : 'Không có'}</div>
                  <div>User: {localStorage.getItem('user') ? 'Có' : 'Không có'}</div>
                  <div>API URL: {process.env.REACT_APP_API_URL || 'http://localhost:8000'}</div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && viewingInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            minWidth: '400px',
            maxWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0, color: '#2d3748' }}>💰 Thanh toán hóa đơn</h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Hóa đơn: <strong>{viewingInvoice.invoice_number}</strong><br/>
              Số tiền: <strong style={{ color: '#d63031' }}>{formatCurrency(viewingInvoice.total_amount || 0)}</strong>
            </p>

            <div style={{ margin: '1.5rem 0' }}>
              <h4 style={{ marginBottom: '1rem' }}>Chọn phương thức thanh toán:</h4>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={selectedPaymentMethod === 'cash'}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span>💵 Tiền mặt</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="vnpay"
                    checked={selectedPaymentMethod === 'vnpay'}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span>💳 VNPay (Online Banking)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-outline"
                style={{ padding: '0.5rem 1rem', borderRadius: 8 }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePaymentConfirm}
                disabled={recordingPayment || vnPayLoading}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', borderRadius: 8 }}
              >
                {recordingPayment || vnPayLoading ? '⏳ Đang xử lý...' : '✅ Xác nhận thanh toán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </TechnicianLayout>
  );
};

export default CreateInvoicePage;
