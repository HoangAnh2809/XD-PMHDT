import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { staffAPI, serviceCenterAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AppointmentForm = ({ appointmentId: propAppointmentId }) => {
  const { id: paramId } = useParams() || {};
  const appointmentId = propAppointmentId || paramId;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState({
    id: null,
    appointment_date: null,
    status: 'pending',
    customer_name: '',
    vehicle_info: '',
    service_type: '',
    estimated_cost: 0,
    actual_cost: 0,
    customer_notes: '',
    staff_notes: '',
    technician_id: null
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'staff' && user.role !== 'admin') {
      navigate('/');
      return;
    }
    loadTechnicians();
    if (appointmentId) loadAppointment(appointmentId);
    else setLoading(false);
  }, [authLoading, user, appointmentId]);

  const loadTechnicians = async () => {
    try {
      const res = await staffAPI.getTechnicians();
      setTechnicians(res.data || []);
    } catch (err) {
      console.error('Failed to load technicians', err);
    }
  };

  const loadAppointment = async (id) => {
    setLoading(true);
    try {
      // re-use service center endpoint for single appointment via appointments list (could be improved)
      const res = await staffAPI.getAppointments();
      const appt = (res.data || []).find(a => a.id === id) || null;
      if (appt) {
        setForm({
          id: appt.id,
          appointment_date: appt.appointment_date,
          status: appt.status,
          customer_name: appt.customer_name || (appt.customer && appt.customer.full_name) || '',
          vehicle_info: appt.vehicle_info || '',
          service_type: appt.service_type || (appt.service_type && appt.service_type.name) || '',
          estimated_cost: appt.estimated_cost || 0,
          actual_cost: appt.actual_cost || 0,
          customer_notes: appt.customer_notes || '',
          staff_notes: appt.staff_notes || '',
          technician_id: appt.technician_id || null
        });
      } else {
        // fallback: try serviceCenterAPI to list and filter
        const all = await serviceCenterAPI.getAllAppointments();
        const found = (all.data || []).find(a => a.id === id);
        if (found) {
          setForm({
            id: found.id,
            appointment_date: found.appointment_date,
            status: found.status,
            customer_name: found.customer_name || '',
            vehicle_info: found.vehicle_info || '',
            service_type: found.service_type || '',
            estimated_cost: found.estimated_cost || 0,
            actual_cost: found.actual_cost || 0,
            customer_notes: found.customer_notes || '',
            staff_notes: found.staff_notes || '',
            technician_id: found.technician_id || null
          });
        } else {
          console.warn('Appointment not found:', id);
        }
      }
    } catch (error) {
      console.error('Error loading appointment:', error);
    }
    setLoading(false);
  };

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.id) {
      alert('Không có lịch hẹn để lưu.');
      return;
    }
    setSaving(true);
    try {
      // Update status or assign technician via existing endpoints
      if (form.technician_id) {
        await staffAPI.assignTechnician(form.id, { technician_id: form.technician_id });
      }
      await staffAPI.updateAppointmentStatus(form.id, { status: form.status, staff_notes: form.staff_notes });
      // If actual_cost changed, call service record creation or appointment patch if exists
      alert('Lưu thành công');
      navigate('/staff/appointments');
    } catch (err) {
      console.error('Error saving appointment:', err);
      alert('Lưu thất bại');
    }
    setSaving(false);
  };

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="appointment-form container">
      <h2>Chi tiết lịch hẹn</h2>
      <div className="form-row">
        <label>Khách hàng</label>
        <div>{form.customer_name}</div>
      </div>
      <div className="form-row">
        <label>Xe</label>
        <div>{form.vehicle_info}</div>
      </div>
      <div className="form-row">
        <label>Dịch vụ</label>
        <div>{form.service_type}</div>
      </div>
      <div className="form-row">
        <label>Ngày hẹn</label>
        <div>{form.appointment_date}</div>
      </div>

      <div className="form-row">
        <label>Trạng thái</label>
        <select value={form.status} onChange={e => handleChange('status', e.target.value)}>
          <option value="pending">Chờ xác nhận</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="in_progress">Đang thực hiện</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      <div className="form-row">
        <label>Ghi chú nhân viên</label>
        <textarea value={form.staff_notes} onChange={e => handleChange('staff_notes', e.target.value)} />
      </div>

      <div className="form-row">
        <label>Phân công kỹ thuật viên</label>
        <select value={form.technician_id || ''} onChange={e => handleChange('technician_id', e.target.value || null)}>
          <option value="">-- Chọn kỹ thuật viên --</option>
          {technicians.map(t => (
            <option key={t.id} value={t.id}>{t.full_name || t.user?.full_name || t.employee_id}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Chi phí ước tính</label>
        <input type="number" value={form.estimated_cost} onChange={e => handleChange('estimated_cost', Number(e.target.value))} />
      </div>

      <div className="form-row">
        <label>Chi phí thực tế</label>
        <input type="number" value={form.actual_cost} onChange={e => handleChange('actual_cost', Number(e.target.value))} />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>Lưu</button>
        <button className="btn btn-outline" style={{ marginLeft: '1rem' }} onClick={() => navigate(-1)}>Hủy</button>
      </div>
    </div>
  );
};

export default AppointmentForm;
