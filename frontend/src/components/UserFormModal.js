import React, { useState, useEffect } from 'react';
import '../pages/admin/AdminPages.css';

const UserFormModal = ({ show, onClose, onSave, user }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    phone: '',
    role: 'customer',
    is_active: true
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      // Editing existing user
      setFormData({
        username: user.username || '',
        email: user.email || '',
        full_name: user.full_name || '',
        password: '', // Don't pre-fill password
        phone: user.phone || '',
        role: user.role || 'customer',
        is_active: user.is_active !== undefined ? user.is_active : true
      });
    } else {
      // Creating new user
      setFormData({
        username: '',
        email: '',
        full_name: '',
        password: '',
        phone: '',
        role: 'customer',
        is_active: true
      });
    }
    setErrors({});
  }, [user, show]);

  const validateForm = () => {
    const newErrors = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username là bắt buộc';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username phải có ít nhất 3 ký tự';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username chỉ được chứa chữ, số và dấu gạch dưới';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email là bắt buộc';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Họ tên là bắt buộc';
    } else if (formData.full_name.length < 2) {
      newErrors.full_name = 'Họ tên phải có ít nhất 2 ký tự';
    }

    // Password validation (only for new users or if password is provided)
    if (!user && !formData.password) {
      newErrors.password = 'Password là bắt buộc cho user mới';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password phải có ít nhất 6 ký tự';
    }

    // Phone validation (optional but must be valid if provided)
    if (formData.phone && !/^[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Số điện thoại phải có 10-11 chữ số';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare data to send
      const dataToSend = { ...formData };
      
      // If editing and password is empty, don't send password
      if (user && !dataToSend.password) {
        delete dataToSend.password;
      }

      await onSave(dataToSend);
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
      setErrors({ 
        submit: error.response?.data?.detail || 'Có lỗi xảy ra khi lưu user' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2>{user ? '✏️ Sửa người dùng' : '➕ Thêm người dùng mới'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && (
              <div style={{
                backgroundColor: '#fed7d7',
                border: '1px solid #f56565',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                color: '#742a2a'
              }}>
                <strong>❌ Lỗi:</strong> {errors.submit}
              </div>
            )}

            {/* Username */}
            <div className="form-group">
              <label>
                Username <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="username"
                className="form-control"
                value={formData.username}
                onChange={handleChange}
                placeholder="Nhập username (a-z, 0-9, _)"
                disabled={!!user} // Không cho sửa username nếu đang edit
              />
              {errors.username && (
                <small style={{ color: '#f56565', display: 'block', marginTop: '0.25rem' }}>
                  {errors.username}
                </small>
              )}
            </div>

            {/* Email */}
            <div className="form-group">
              <label>
                Email <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@example.com"
              />
              {errors.email && (
                <small style={{ color: '#f56565', display: 'block', marginTop: '0.25rem' }}>
                  {errors.email}
                </small>
              )}
            </div>

            {/* Full Name */}
            <div className="form-group">
              <label>
                Họ và tên <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="full_name"
                className="form-control"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
              />
              {errors.full_name && (
                <small style={{ color: '#f56565', display: 'block', marginTop: '0.25rem' }}>
                  {errors.full_name}
                </small>
              )}
            </div>

            {/* Password */}
            <div className="form-group">
              <label>
                Password {!user && <span style={{ color: 'red' }}>*</span>}
                {user && <small style={{ color: '#718096' }}> (Để trống nếu không đổi)</small>}
              </label>
              <input
                type="password"
                name="password"
                className="form-control"
                value={formData.password}
                onChange={handleChange}
                placeholder={user ? 'Nhập password mới nếu muốn đổi' : 'Tối thiểu 6 ký tự'}
              />
              {errors.password && (
                <small style={{ color: '#f56565', display: 'block', marginTop: '0.25rem' }}>
                  {errors.password}
                </small>
              )}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label>Số điện thoại</label>
              <input
                type="tel"
                name="phone"
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
                placeholder="0912345678"
              />
              {errors.phone && (
                <small style={{ color: '#f56565', display: 'block', marginTop: '0.25rem' }}>
                  {errors.phone}
                </small>
              )}
            </div>

            {/* Role */}
            <div className="form-group">
              <label>
                Vai trò <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                name="role"
                className="form-control"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="customer">👤 Customer (Khách hàng)</option>
                <option value="technician">🔧 Technician (Kỹ thuật viên)</option>
                <option value="staff">👔 Staff (Nhân viên)</option>
                <option value="admin">👑 Admin (Quản trị viên)</option>
              </select>
            </div>

            {/* Active Status */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span style={{ marginLeft: '0.5rem' }}>✓ Tài khoản đang hoạt động</span>
              </label>
              <small style={{ color: '#718096', display: 'block', marginTop: '0.25rem' }}>
                Bỏ tick để vô hiệu hóa tài khoản này
              </small>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '⏳ Đang lưu...' : (user ? '💾 Cập nhật' : '➕ Tạo mới')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
