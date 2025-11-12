import React, { useState, useEffect } from 'react';

const BranchFormModal = ({ show, onClose, onSave, branch }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    is_active: true
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branch) {
      // Edit mode - populate form with branch data
      setFormData({
        name: branch.name || '',
        address: branch.address || '',
        phone: branch.phone || '',
        email: branch.email || '',
        is_active: branch.is_active !== undefined ? branch.is_active : true
      });
    } else {
      // Create mode - reset form
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
        is_active: true
      });
    }
    setErrors({});
    setSubmitError('');
  }, [branch, show]);

  const validateForm = () => {
    const newErrors = {};

    // Validate name
    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Tên chi nhánh phải có ít nhất 2 ký tự';
    }

    // Validate address
    if (!formData.address || formData.address.trim().length < 5) {
      newErrors.address = 'Địa chỉ phải có ít nhất 5 ký tự';
    }

    // Validate phone (optional but must be valid if provided)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^[0-9]{10,11}$/;
      const phoneDigits = formData.phone.replace(/\s/g, '');
      if (!phoneRegex.test(phoneDigits)) {
        newErrors.phone = 'Số điện thoại phải có 10-11 chữ số';
      }
    }

    // Validate email (optional but must be valid if provided)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Email không hợp lệ';
      }
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
    setSubmitError('');

    try {
      // Clean phone number (remove spaces)
      const submitData = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/\s/g, '') : null,
        email: formData.email || null
      };

      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error('Error saving branch:', error);
      setSubmitError(error.response?.data?.detail || error.message || 'Có lỗi xảy ra khi lưu chi nhánh');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{branch ? '✏️ Sửa chi nhánh' : '➕ Tạo chi nhánh mới'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {submitError && (
              <div className="alert alert-danger" style={{ 
                padding: '1rem', 
                marginBottom: '1rem', 
                backgroundColor: '#f8d7da', 
                color: '#721c24',
                borderRadius: '4px' 
              }}>
                {submitError}
              </div>
            )}

            {/* Name */}
            <div className="form-group">
              <label htmlFor="name">
                Tên chi nhánh <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-control"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ví dụ: Chi nhánh Quận 1"
                disabled={loading}
              />
              {errors.name && (
                <small style={{ color: '#f56565', fontSize: '0.875rem' }}>
                  {errors.name}
                </small>
              )}
            </div>

            {/* Address */}
            <div className="form-group">
              <label htmlFor="address">
                Địa chỉ <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                id="address"
                name="address"
                className="form-control"
                value={formData.address}
                onChange={handleChange}
                placeholder="Nhập địa chỉ chi tiết"
                rows="3"
                disabled={loading}
              />
              {errors.address && (
                <small style={{ color: '#f56565', fontSize: '0.875rem' }}>
                  {errors.address}
                </small>
              )}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label htmlFor="phone">Số điện thoại</label>
              <input
                type="text"
                id="phone"
                name="phone"
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ví dụ: 0912345678"
                disabled={loading}
              />
              {errors.phone && (
                <small style={{ color: '#f56565', fontSize: '0.875rem' }}>
                  {errors.phone}
                </small>
              )}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                placeholder="Ví dụ: branch@example.com"
                disabled={loading}
              />
              {errors.email && (
                <small style={{ color: '#f56565', fontSize: '0.875rem' }}>
                  {errors.email}
                </small>
              )}
            </div>

            {/* Is Active */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  disabled={loading}
                />
                <span>Chi nhánh đang hoạt động</span>
              </label>
            </div>
          </div>

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
              {loading ? 'Đang lưu...' : (branch ? '💾 Cập nhật' : '➕ Tạo mới')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchFormModal;
