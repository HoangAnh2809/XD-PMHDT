import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { customerAPI } from '../../services/api';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || ''
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await customerAPI.getProfile();
        setProfileData(response.data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Only send updatable fields (exclude email)
      const updateData = {
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address
      };
      
      const response = await customerAPI.updateProfile(updateData);
      updateUser(response.data);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      setIsEditing(false);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || error.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }

    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự!' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await customerAPI.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setIsChangingPassword(false);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <Navbar />
      
      <div className="hero" style={{ padding: '3rem 2rem' }}>
        <h1>👤 Hồ sơ cá nhân</h1>
        <p>Quản lý thông tin tài khoản của bạn</p>
      </div>

      <div className="container">
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Profile Information */}
          <div className="card">
            <div className="card-header">
              <h2>Thông tin cá nhân</h2>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="btn btn-outline"
                >
                  ✏️ Chỉnh sửa
                </button>
              )}
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Họ và tên</label>
                <input
                  type="text"
                  name="full_name"
                  className="form-control"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={true}
                  title="Email không thể thay đổi"
                  style={{ cursor: 'not-allowed', opacity: 0.6 }}
                />
                <small style={{ color: '#666', fontSize: '0.85rem' }}>Email không thể thay đổi</small>
              </div>

              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              </div>

              <div className="form-group">
                <label>Địa chỉ</label>
                <textarea
                  name="address"
                  className="form-control"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  rows="3"
                />
              </div>

              {isEditing && (
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Đang lưu...' : '💾 Lưu thay đổi'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        full_name: user.full_name || '',
                        email: user.email || '',
                        phone: user.phone || '',
                        address: user.address || ''
                      });
                    }}
                    className="btn btn-outline"
                    disabled={loading}
                  >
                    Hủy
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Account Settings */}
          <div>
            {/* Account Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3>Thông tin tài khoản</h3>
              </div>
              <div className="info-list">
                <div className="info-item">
                  <span className="info-label">👤 Tên đăng nhập:</span>
                  <span className="info-value">{user?.username}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">🎫 Vai trò:</span>
                  <span className="info-value">
                    <span className="badge badge-primary">Khách hàng</span>
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">📅 Ngày tạo:</span>
                  <span className="info-value">
                    {loadingProfile ? 'Đang tải...' : 
                     profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="card">
              <div className="card-header">
                <h3>Bảo mật</h3>
              </div>
              
              {!isChangingPassword ? (
                <div style={{ padding: '1rem' }}>
                  <button 
                    onClick={() => setIsChangingPassword(true)}
                    className="btn btn-primary btn-large"
                    style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      fontWeight: '600',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    � Đổi mật khẩu
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="btn btn-danger btn-large"
                    style={{ marginTop: '1rem' }}
                  >
                    🚪 Đăng xuất
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword}>
                  <div className="form-group">
                    <label>Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      name="current_password"
                      className="form-control"
                      value={passwordData.current_password}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Mật khẩu mới</label>
                    <input
                      type="password"
                      name="new_password"
                      className="form-control"
                      value={passwordData.new_password}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      name="confirm_password"
                      className="form-control"
                      value={passwordData.confirm_password}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-large"
                      disabled={loading}
                    >
                      {loading ? 'Đang lưu...' : 'Cập nhật'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
                      }}
                      className="btn btn-outline btn-large"
                      disabled={loading}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3>Liên kết nhanh</h3>
          </div>
          <div className="quick-links-grid">
            <button onClick={() => navigate('/customer/vehicles')} className="quick-link-card">
              <span className="quick-link-icon">🚗</span>
              <span className="quick-link-title">Quản lý xe</span>
            </button>
            <button onClick={() => navigate('/customer/service-history')} className="quick-link-card">
              <span className="quick-link-icon">📋</span>
              <span className="quick-link-title">Lịch sử dịch vụ</span>
            </button>
            <button onClick={() => navigate('/customer/booking')} className="quick-link-card">
              <span className="quick-link-icon">📅</span>
              <span className="quick-link-title">Đặt lịch mới</span>
            </button>
            <button onClick={() => navigate('/services')} className="quick-link-card">
              <span className="quick-link-icon">🔧</span>
              <span className="quick-link-title">Dịch vụ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;