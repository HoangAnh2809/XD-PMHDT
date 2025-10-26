import React, { useState, useEffect, useCallback } from 'react';
import { userAPI, branchAPI } from '../../services/adminAPI';
import StaffFormModal from '../../components/StaffFormModal';
import './AdminPages.css';

const AdminStaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = {};
      if (filterRole !== 'all') {
        params.role = filterRole;
      }
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      const response = await userAPI.getAll(params);
      
      // Filter only staff and technicians
      const staffData = (response.data || []).filter(
        user => user.role === 'staff' || user.role === 'technician'
      );
      
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading staff:', error);
      alert('Lỗi khi tải danh sách nhân viên: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus]);

  const loadBranches = useCallback(async () => {
    try {
      const response = await branchAPI.getAll();
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  }, []);

  useEffect(() => {
    loadStaff();
    loadBranches();
  }, [loadStaff, loadBranches]);

  const handleCreateStaff = () => {
    setSelectedStaff(null);
    setShowModal(true);
  };

  const handleEditStaff = (staffMember) => {
    setSelectedStaff(staffMember);
    setShowModal(true);
  };

  const handleSaveStaff = async (staffData) => {
    try {
      if (selectedStaff) {
        // Update existing staff
        const response = await userAPI.update(selectedStaff.id, staffData);
        alert('✅ Cập nhật nhân viên thành công!');
        await loadStaff();
        setShowModal(false);
      } else {
        // Create new staff
        const response = await userAPI.create(staffData);
        alert('✅ Thêm nhân viên mới thành công!');
        await loadStaff();
        setShowModal(false);
      }
    } catch (error) {
      console.error('❌ Error saving staff:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Handle validation errors (422) and other errors
      let errorMessage = 'Không thể lưu nhân viên';
      
      if (error.response?.status === 400) {
        // Duplicate username/email or other bad request
        errorMessage = error.response?.data?.detail || 'Username hoặc email đã tồn tại';
      } else if (error.response?.status === 422 && error.response?.data?.detail) {
        const details = error.response.data.detail;
        if (Array.isArray(details)) {
          // Pydantic validation errors
          errorMessage = details.map(err => {
            const field = err.loc ? err.loc.join('.') : 'unknown';
            return `${field}: ${err.msg}`;
          }).join('\n');
        } else if (typeof details === 'string') {
          errorMessage = details;
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ Lỗi:\n${errorMessage}`);
      
      // Re-throw error so modal can handle it (keeps modal open with error message)
      throw error;
    }
  };

  const handleDeleteStaff = async (staffMember) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhân viên "${staffMember.full_name}"?\n\nHành động này không thể hoàn tác!`)) {
      return;
    }

    try {
      await userAPI.delete(staffMember.id);
      await loadStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Lỗi khi xóa nhân viên: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const newStatus = !staffMember.is_active;
    const action = newStatus ? 'kích hoạt' : 'vô hiệu hóa';
    
    if (!window.confirm(`Bạn có chắc muốn ${action} nhân viên "${staffMember.full_name}"?`)) {
      return;
    }

    try {
      await userAPI.update(staffMember.id, { is_active: newStatus });
      await loadStaff();
    } catch (error) {
      console.error('Error toggling staff status:', error);
      alert(`Lỗi khi ${action} nhân viên: ` + (error.response?.data?.detail || error.message));
    }
  };

  const handleResetPassword = async (staffMember) => {
    if (!window.confirm(`Bạn có chắc muốn reset mật khẩu cho "${staffMember.full_name}"?\n\nMật khẩu mới sẽ là: default123`)) {
      return;
    }

    try {
      await userAPI.resetPassword(staffMember.id, { password: 'default123' });
      alert(`Đã reset mật khẩu cho ${staffMember.full_name}\nMật khẩu mới: default123`);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Lỗi khi reset mật khẩu: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Filter staff based on search and filters
  const filteredStaff = staff.filter(member => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        member.full_name?.toLowerCase().includes(searchLower) ||
        member.email?.toLowerCase().includes(searchLower) ||
        member.username?.toLowerCase().includes(searchLower) ||
        member.phone?.includes(searchTerm) ||
        member.position?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Branch filter
    if (filterBranch !== 'all' && member.branch_id !== filterBranch) {
      return false;
    }

    return true;
  });

  // Calculate stats
  const totalStaff = filteredStaff.length;
  const activeStaff = filteredStaff.filter(m => m.is_active).length;
  const technicians = filteredStaff.filter(m => m.role === 'technician').length;
  const officeStaff = filteredStaff.filter(m => m.role === 'staff').length;

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : 'N/A';
  };

  const getRoleBadgeClass = (role) => {
    switch(role) {
      case 'technician': return 'badge-primary';
      case 'staff': return 'badge-success';
      default: return 'badge-secondary';
    }
  };

  const getRoleLabel = (role) => {
    switch(role) {
      case 'technician': return '🔧 Technician';
      case 'staff': return '👔 Staff';
      default: return role;
    }
  };

  const getShiftLabel = (shift) => {
    const shifts = {
      'morning': '🌅 Sáng (7-15h)',
      'afternoon': '🌆 Chiều (15-23h)',
      'night': '🌙 Đêm (23-7h)',
      'flexible': '🔄 Linh hoạt'
    };
    return shifts[shift] || shift;
  };

  const formatSalary = (salary) => {
    if (!salary) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(salary);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="page-header">
          <h1>👥 Quản lý Nhân sự</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>👥 Quản lý Nhân sự</h1>
          <p className="page-subtitle">
            Quản lý nhân viên văn phòng và kỹ thuật viên
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateStaff}>
          ➕ Thêm nhân viên
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-details">
            <div className="stat-value">{totalStaff}</div>
            <div className="stat-label">Tổng nhân viên</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">✓</div>
          <div className="stat-details">
            <div className="stat-value">{activeStaff}</div>
            <div className="stat-label">Đang làm việc</div>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">🔧</div>
          <div className="stat-details">
            <div className="stat-value">{technicians}</div>
            <div className="stat-label">Kỹ thuật viên</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">👔</div>
          <div className="stat-details">
            <div className="stat-value">{officeStaff}</div>
            <div className="stat-label">Nhân viên văn phòng</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="content-card">
        <div className="search-bar">
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Tìm kiếm theo tên, email, username, SĐT, vị trí..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="filter-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Tất cả vai trò</option>
            <option value="staff">👔 Staff</option>
            <option value="technician">🔧 Technician</option>
          </select>

          <select
            className="filter-select"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
          >
            <option value="all">Tất cả chi nhánh</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">✓ Đang làm việc</option>
            <option value="inactive">✗ Nghỉ việc</option>
          </select>
        </div>

        {filteredStaff.length > 0 && (
          <div className="search-stats">
            Hiển thị {filteredStaff.length} / {staff.length} nhân viên
          </div>
        )}
      </div>

      {/* Staff Grid */}
      {filteredStaff.length === 0 ? (
        <div className="content-card">
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>Không tìm thấy nhân viên</h3>
            <p>
              {searchTerm || filterRole !== 'all' || filterBranch !== 'all' || filterStatus !== 'all'
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
                : 'Chưa có nhân viên nào. Hãy thêm nhân viên đầu tiên!'}
            </p>
            {(searchTerm || filterRole !== 'all' || filterBranch !== 'all' || filterStatus !== 'all') && (
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setSearchTerm('');
                  setFilterRole('all');
                  setFilterBranch('all');
                  setFilterStatus('all');
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="staff-grid">
          {filteredStaff.map(member => (
            <div key={member.id} className="staff-card">
              <div className="staff-card-header">
                <div className="staff-avatar">
                  {member.full_name?.charAt(0) || '👤'}
                </div>
                <div className="staff-info">
                  <h3>{member.full_name}</h3>
                  <p className="staff-email">{member.email}</p>
                  <div className="staff-badges">
                    <span className={`badge ${getRoleBadgeClass(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </span>
                    <span className={`badge ${member.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {member.is_active ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="staff-card-body">
                <div className="staff-detail-row">
                  <span className="detail-label">👤 Username:</span>
                  <span className="detail-value">{member.username || 'N/A'}</span>
                </div>

                <div className="staff-detail-row">
                  <span className="detail-label">📞 Điện thoại:</span>
                  <span className="detail-value">{member.phone || 'N/A'}</span>
                </div>

                <div className="staff-detail-row">
                  <span className="detail-label">🏢 Chi nhánh:</span>
                  <span className="detail-value">{getBranchName(member.branch_id)}</span>
                </div>

                <div className="staff-detail-row">
                  <span className="detail-label">💼 Vị trí:</span>
                  <span className="detail-value">{member.position || 'N/A'}</span>
                </div>

                <div className="staff-detail-row">
                  <span className="detail-label">📅 Ngày vào:</span>
                  <span className="detail-value">{formatDate(member.hire_date)}</span>
                </div>

                <div className="staff-detail-row">
                  <span className="detail-label">💰 Lương:</span>
                  <span className="detail-value">{formatSalary(member.salary)}</span>
                </div>

                <div className="staff-detail-row">
                  <span className="detail-label">⏰ Ca làm:</span>
                  <span className="detail-value">{getShiftLabel(member.shift)}</span>
                </div>

                {member.role === 'technician' && member.skills && member.skills.length > 0 && (
                  <div className="staff-skills">
                    <strong>Kỹ năng:</strong>
                    <div className="skills-list">
                      {member.skills.map(skill => (
                        <span key={skill} className="skill-badge">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="staff-detail-row">
                  <span className="detail-label">🆔 ID:</span>
                  <span className="detail-value" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {member.id}
                  </span>
                </div>
              </div>

              <div className="staff-card-footer">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleEditStaff(member)}
                >
                  ✏️ Sửa
                </button>

                <button
                  className={`btn btn-sm ${member.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleStatus(member)}
                >
                  {member.is_active ? '⏸ Vô hiệu' : '▶️ Kích hoạt'}
                </button>

                <button
                  className="btn btn-sm btn-info"
                  onClick={() => handleResetPassword(member)}
                >
                  🔑 Reset PW
                </button>

                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteStaff(member)}
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Staff Form Modal */}
      <StaffFormModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveStaff}
        staff={selectedStaff}
        branches={branches}
      />
    </div>
  );
};

export default AdminStaffPage;
