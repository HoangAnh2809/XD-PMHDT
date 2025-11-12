import React, { useState, useEffect } from 'react';
import '../pages/admin/AdminPages.css';

const StaffFormModal = ({ show, onClose, onSave, staff, branches = [] }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    phone: '',
    role: 'staff',
    branch_id: '',
    position: ''
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const positions = {
    staff: ['Receptionist', 'Customer Service', 'Cashier', 'Manager', 'Supervisor'],
    technician: ['Junior Technician', 'Senior Technician', 'Lead Technician', 'Master Technician', 'Specialist']
  };

  useEffect(() => {
    if (staff) {
      setFormData({
        username: staff.username || '',
        email: staff.email || '',
        full_name: staff.full_name || '',
        phone: staff.phone || '',
        role: staff.role || 'staff',
        branch_id: staff.branch_id || '',
        position: staff.position || ''
      });
    } else {
      setFormData({
        username: '',
        email: '',
        full_name: '',
        phone: '',
        role: 'staff',
        branch_id: '',
        position: ''
      });
    }
    setErrors({});
    setSubmitError('');
  }, [staff, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'role') {
      setFormData(prev => ({ ...prev, role: value, position: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!staff && (!formData.username || formData.username.trim().length < 3)) {
      newErrors.username = 'Username phải có ít nhất 3 ký tự';
    }
    if (!formData.email || !formData.email.trim()) {
      newErrors.email = 'Email là bắt buộc';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Họ tên phải có ít nhất 2 ký tự';
    }
    if (formData.phone && formData.phone.trim()) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        newErrors.phone = 'Số điện thoại phải có 10-11 chữ số';
      }
    }
    if (!formData.branch_id || formData.branch_id === '') {
      newErrors.branch_id = 'Vui lòng chọn chi nhánh';
    }
    if (!formData.position || formData.position === '') {
      newErrors.position = 'Vui lòng chọn vị trí';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (!formData.branch_id) {
        setSubmitError('❌ Vui lòng chọn chi nhánh');
        setLoading(false);
        return;
      }
      const dataToSend = {
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        role: formData.role,
        branch_id: formData.branch_id,
        position: formData.position
      };
      if (formData.phone && formData.phone.trim()) {
        dataToSend.phone = formData.phone.replace(/\D/g, '');
      }
      if (!staff) {
        dataToSend.username = formData.username.trim();
        dataToSend.password = 'default123';
      }
      await onSave(dataToSend);

      // Success - only close modal if no error thrown
      onClose();
    } catch (error) {
      console.error('❌ Error saving staff:', error);
      console.error('Response:', error.response?.data);

      // DO NOT close modal on error - show error message instead
      let errorMsg = '❌ Không thể lưu nhân viên. Vui lòng thử lại.';

      if (error.response?.status === 400) {
        // Duplicate username or email
        const detail = error.response?.data?.detail || '';
        if (detail.toLowerCase().includes('username') || detail.toLowerCase().includes('email') || detail.toLowerCase().includes('exists')) {
          errorMsg = '❌ Email hoặc username đã tồn tại trong hệ thống.\n\n📧 Email: ' + formData.email + '\n👤 Username: ' + (formData.username || 'N/A') + '\n\n💡 Vui lòng sử dụng email/username khác.';
        } else {
          errorMsg = '❌ ' + (detail || 'Dữ liệu không hợp lệ');
        }
      } else if (error.response?.status === 422) {
        // Validation errors
        const details = error.response?.data?.detail;
        if (Array.isArray(details)) {
          const errorList = details.map(err => {
            const field = err.loc?.[1] || 'unknown';
            const msg = err.msg || 'Invalid value';
            return '  • ' + field + ': ' + msg;
          }).join('\n');
          errorMsg = '❌ Lỗi validation:\n\n' + errorList;
        } else if (typeof details === 'string') {
          errorMsg = '❌ ' + details;
        }
      } else if (error.response?.data?.message) {
        errorMsg = '❌ ' + error.response.data.message;
      } else if (error.message) {
        errorMsg = '❌ Lỗi kết nối: ' + error.message;
      }

      // Set error message - modal will NOT close
      setSubmitError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{staff ? '✏️ Sửa thông tin nhân viên' : '➕ Thêm nhân viên mới'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Error Banner - Display at top with red background */}
        {submitError && (
          <div className="error-banner" style={{
            backgroundColor: '#fee',
            border: '2px solid #f56565',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            margin: '1rem 1.5rem 0',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <div style={{
              color: '#742a2a',
              fontSize: '0.95rem',
              fontWeight: '600',
              whiteSpace: 'pre-line',
              lineHeight: '1.6'
            }}>
              {submitError}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid-simple">
              {!staff && (
                <div className="form-group">
                  <label>Username <span className="required">*</span></label>
                  <input type="text" name="username" value={formData.username} onChange={handleChange} className={errors.username ? 'error' : ''} placeholder="nguyenvana" />
                  {errors.username && <small className="error-text">{errors.username}</small>}
                </div>
              )}
              <div className="form-group">
                <label>Email <span className="required">*</span></label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className={errors.email ? 'error' : ''} placeholder="nguyenvana@email.com" />
                {errors.email && <small className="error-text">{errors.email}</small>}
                <small style={{ color: '#718096', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  💡 Sử dụng email mới chưa có trong hệ thống
                </small>
              </div>
              <div className="form-group">
                <label>Họ và Tên <span className="required">*</span></label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} className={errors.full_name ? 'error' : ''} placeholder="Nguyễn Văn A" />
                {errors.full_name && <small className="error-text">{errors.full_name}</small>}
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={errors.phone ? 'error' : ''} placeholder="0912345678" />
                {errors.phone && <small className="error-text">{errors.phone}</small>}
              </div>
              <div className="form-group">
                <label>Vai trò <span className="required">*</span></label>
                <select name="role" value={formData.role} onChange={handleChange} disabled={!!staff}>
                  <option value="staff">Staff</option>
                  <option value="technician">Technician</option>
                </select>
              </div>
              <div className="form-group">
                <label>Chi nhánh <span className="required">*</span></label>
                <select name="branch_id" value={formData.branch_id} onChange={handleChange} className={errors.branch_id ? 'error' : ''}>
                  <option value="">-- Chọn chi nhánh --</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {errors.branch_id && <small className="error-text">{errors.branch_id}</small>}
              </div>
              <div className="form-group">
                <label>Vị trí <span className="required">*</span></label>
                <select name="position" value={formData.position} onChange={handleChange} className={errors.position ? 'error' : ''}>
                  <option value="">-- Chọn vị trí --</option>
                  {positions[formData.role]?.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
                {errors.position && <small className="error-text">{errors.position}</small>}
              </div>
            </div>
            <div className="form-note"><p>Các thông tin khác có thể cập nhật sau.</p></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang lưu...' : (staff ? 'Cập nhật' : 'Tạo nhân viên')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffFormModal;
