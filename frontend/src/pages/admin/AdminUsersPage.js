import React, { useState, useEffect } from 'react';
import { userAPI } from '../../services/adminAPI';
import UserFormModal from '../../components/UserFormModal';
import './AdminPages.css';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = {};
        if (filterRole !== 'all') params.role = filterRole;
        if (filterStatus !== 'all') params.status = filterStatus;
        
        const response = await userAPI.getAll(params);
        setUsers(response.data);
      } catch (error) {
        console.error('Error loading users:', error);
        setError('Không thể tải danh sách người dùng. Sử dụng dữ liệu mẫu.');
        // Fallback to mock data
        const mockUsers = [
          { id: 1, username: 'customer1', email: 'customer1@example.com', full_name: 'Nguyễn Văn A', role: 'customer', is_active: true, is_locked: false, created_at: '2025-01-15', last_login: '2025-10-05' },
          { id: 2, username: 'tech1', email: 'tech1@example.com', full_name: 'Trần Văn B', role: 'technician', is_active: true, is_locked: false, created_at: '2025-02-20', last_login: '2025-10-04' },
          { id: 3, username: 'staff1', email: 'staff1@example.com', full_name: 'Lê Thị C', role: 'staff', is_active: true, is_locked: false, created_at: '2025-03-10', last_login: '2025-10-05' },
          { id: 4, username: 'admin1', email: 'admin@example.com', full_name: 'Administrator', role: 'admin', is_active: true, is_locked: false, created_at: '2025-01-01', last_login: '2025-10-05' },
          { id: 5, username: 'customer2', email: 'customer2@example.com', full_name: 'Phạm Văn D', role: 'customer', is_active: false, is_locked: true, created_at: '2025-04-05', last_login: '2025-09-20' }
        ];
        setUsers(mockUsers);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [filterRole, filterStatus]);

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true; // If no search term, show all
    
    const searchLower = searchTerm.toLowerCase();
    const matchesUsername = user.username?.toLowerCase().includes(searchLower);
    const matchesEmail = user.email?.toLowerCase().includes(searchLower);
    const matchesFullName = user.full_name?.toLowerCase().includes(searchLower);
    
    return matchesUsername || matchesEmail || matchesFullName;
  });

  const getRoleBadge = (role) => {
    if (!role) return <span className="badge badge-secondary">N/A</span>;
    
    const badges = {
      'customer': { icon: '👤', label: 'Customer', class: 'badge-info' },
      'technician': { icon: '🔧', label: 'Technician', class: 'badge-warning' },
      'staff': { icon: '👔', label: 'Staff', class: 'badge-primary' },
      'admin': { icon: '👑', label: 'Admin', class: 'badge-danger' }
    };
    const badge = badges[role] || badges['customer'];
    return <span className={`badge ${badge.class}`}>{badge.icon} {badge.label}</span>;
  };

  const getStatusBadge = (user) => {
    if (!user) return <span className="badge badge-secondary">N/A</span>;
    
    if (user.is_locked) {
      return <span className="badge badge-danger">🔒 Locked</span>;
    }
    return user.is_active ? 
      <span className="badge badge-success">✓ Active</span> :
      <span className="badge badge-secondary">⏸ Inactive</span>;
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleResetPassword = async (user) => {
    const newPassword = prompt(`Nhập password mới cho ${user.username}:`);
    if (newPassword && newPassword.length >= 6) {
      try {
        await userAPI.resetPassword(user.id, newPassword);
        alert('Password đã được reset thành công!');
      } catch (error) {
        alert('Lỗi khi reset password: ' + (error.response?.data?.detail || error.message));
      }
    } else if (newPassword) {
      alert('Password phải có ít nhất 6 ký tự!');
    }
  };

  const handleToggleStatus = async (user) => {
    const newLockStatus = !user.is_locked;
    const action = newLockStatus ? 'khóa' : 'mở khóa';
    
    if (window.confirm(`Bạn có chắc muốn ${action} tài khoản ${user.username}?`)) {
      try {
        await userAPI.update(user.id, { is_locked: newLockStatus });
        window.location.reload(); // Reload to fetch fresh data
        alert(`Đã ${action} tài khoản thành công!`);
      } catch (error) {
        alert('Lỗi khi cập nhật: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Bạn có chắc muốn xóa user ${user.username}? Hành động này không thể hoàn tác!`)) {
      try {
        await userAPI.delete(user.id);
        window.location.reload(); // Reload to fetch fresh data
        alert('Đã xóa người dùng thành công!');
      } catch (error) {
        alert('Lỗi khi xóa: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleSaveUser = async (userData) => {
    try {
      if (selectedUser) {
        // Update existing user
        await userAPI.update(selectedUser.id, userData);
      } else {
        // Create new user
        await userAPI.create(userData);
      }
      setShowModal(false);
      window.location.reload(); // Reload to fetch fresh data
      alert(selectedUser ? 'Cập nhật thành công!' : 'Tạo người dùng thành công!');
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="admin-page">
      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong>Thông báo:</strong> {error}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>👥 Quản lý người dùng & Phân quyền</h1>
          <p>Tạo và quản lý tài khoản, phân quyền truy cập</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateUser}>
          ➕ Tạo người dùng mới
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-icon">👥</span>
          <div>
            <div className="stat-number">{users.length}</div>
            <div className="stat-label">Tổng người dùng</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">👤</span>
          <div>
            <div className="stat-number">{users.filter(u => u.role === 'customer').length}</div>
            <div className="stat-label">Customers</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🔧</span>
          <div>
            <div className="stat-number">{users.filter(u => u.role === 'technician').length}</div>
            <div className="stat-label">Technicians</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">👔</span>
          <div>
            <div className="stat-number">{users.filter(u => u.role === 'staff').length}</div>
            <div className="stat-label">Staff</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🔒</span>
          <div>
            <div className="stat-number">{users.filter(u => u.is_locked).length}</div>
            <div className="stat-label">Locked</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="filters-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm theo tên, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">Tất cả vai trò</option>
            <option value="customer">Customer</option>
            <option value="technician">Technician</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
          </select>

          <span className="filter-result">
            Hiển thị {filteredUsers.length}/{users.length} users
          </span>
        </div>

        {/* Users Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Đăng nhập cuối</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    Không tìm thấy người dùng nào
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>#{user.id}</td>
                    <td><strong>{user.username}</strong></td>
                    <td>{user.email}</td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td>{getStatusBadge(user)}</td>
                    <td>{user.created_at}</td>
                    <td>{user.last_login}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon" 
                          title="Sửa"
                          onClick={() => handleEditUser(user)}
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-icon" 
                          title="Reset password"
                          onClick={() => handleResetPassword(user)}
                        >
                          🔑
                        </button>
                        <button 
                          className="btn-icon" 
                          title={user.status === 'active' ? 'Khóa' : 'Mở khóa'}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.status === 'active' ? '🔒' : '🔓'}
                        </button>
                        <button 
                          className="btn-icon danger" 
                          title="Xóa"
                          onClick={() => handleDeleteUser(user)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UserFormModal Component */}
      <UserFormModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
        user={selectedUser}
      />
    </div>
  );
};

export default AdminUsersPage;
