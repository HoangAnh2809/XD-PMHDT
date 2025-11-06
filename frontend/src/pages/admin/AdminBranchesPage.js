import React, { useState, useEffect } from 'react';
import { branchAPI } from '../../services/adminAPI';
import BranchFormModal from '../../components/BranchFormModal';
import './AdminPages.css';

const AdminBranchesPage = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const response = await branchAPI.getAll();
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
      alert('Lỗi khi tải danh sách chi nhánh: ' + (error.response?.data?.detail || error.message));
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = () => {
    setSelectedBranch(null);
    setShowModal(true);
  };

  const handleEditBranch = (branch) => {
    setSelectedBranch(branch);
    setShowModal(true);
  };

  const handleSaveBranch = async (branchData) => {
    try {
      if (selectedBranch) {
        // Update existing branch
        await branchAPI.update(selectedBranch.id, branchData);
        alert('Chi nhánh đã được cập nhật thành công!');
      } else {
        // Create new branch
        await branchAPI.create(branchData);
        alert('Chi nhánh mới đã được tạo thành công!');
      }
      loadBranches();
      setShowModal(false);
      setSelectedBranch(null);
    } catch (error) {
      console.error('Error saving branch:', error);
      throw error; // Let modal handle the error
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (window.confirm(`Bạn có chắc muốn xóa chi nhánh "${branch.name}"?\n\nHành động này không thể hoàn tác!`)) {
      try {
        await branchAPI.delete(branch.id);
        alert('Chi nhánh đã được xóa thành công!');
        loadBranches();
      } catch (error) {
        console.error('Error deleting branch:', error);
        alert('Lỗi khi xóa chi nhánh: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const handleToggleStatus = async (branch) => {
    const newStatus = !branch.is_active;
    const action = newStatus ? 'mở' : 'đóng';
    
    if (window.confirm(`Bạn có chắc muốn ${action} chi nhánh "${branch.name}"?`)) {
      try {
        await branchAPI.update(branch.id, { is_active: newStatus });
        alert(`Chi nhánh đã được ${action} thành công!`);
        loadBranches();
      } catch (error) {
        console.error('Error toggling branch status:', error);
        alert('Lỗi khi thay đổi trạng thái: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  // Filter branches
  const filteredBranches = branches.filter(branch => {
    const matchesSearch = !searchTerm || 
      branch.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.phone?.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && branch.is_active) ||
      (filterStatus === 'inactive' && !branch.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const activeBranches = branches.filter(b => b.is_active).length;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>🏢 Quản lý Trung tâm & Chi nhánh</h1>
          <p>Cấu hình và quản lý các chi nhánh dịch vụ</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateBranch}>
          ➕ Tạo chi nhánh mới
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-icon">🏢</span>
          <div>
            <div className="stat-number">{branches.length}</div>
            <div className="stat-label">Tổng chi nhánh</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">✓</span>
          <div>
            <div className="stat-number">{activeBranches}</div>
            <div className="stat-label">Đang hoạt động</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">⏸</span>
          <div>
            <div className="stat-number">{branches.length - activeBranches}</div>
            <div className="stat-label">Tạm đóng</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="search-bar">
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Tìm kiếm theo tên, địa chỉ, số điện thoại..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, maxWidth: '400px' }}
        />
        <select
          className="form-control"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">✓ Đang hoạt động</option>
          <option value="inactive">⏸ Tạm đóng</option>
        </select>
        {(searchTerm || filterStatus !== 'all') && (
          <span className="search-stats">
            Hiển thị {filteredBranches.length} / {branches.length} chi nhánh
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner">Đang tải...</div>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          {searchTerm || filterStatus !== 'all' 
            ? '🔍 Không tìm thấy chi nhánh nào phù hợp'
            : '📝 Chưa có chi nhánh nào. Click "Tạo chi nhánh mới" để thêm.'}
        </div>
      ) : (
        <div className="branches-grid">
          {filteredBranches.map(branch => (
            <div key={branch.id} className="branch-card">
              <div className="branch-card-header">
                <h3>{branch.name}</h3>
                <span className={`badge ${branch.is_active ? 'badge-success' : 'badge-secondary'}`}>
                  {branch.is_active ? '✓ Hoạt động' : '⏸ Tạm đóng'}
                </span>
              </div>
              <div className="branch-card-body">
                <div className="branch-info-item">
                  <span className="info-icon">📍</span>
                  <span>{branch.address}</span>
                </div>
                {branch.phone && (
                  <div className="branch-info-item">
                    <span className="info-icon">📞</span>
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="branch-info-item">
                    <span className="info-icon">📧</span>
                    <span>{branch.email}</span>
                  </div>
                )}
                <div className="branch-info-item">
                  <span className="info-icon">🆔</span>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    ID: {branch.id.substring(0, 8)}...
                  </span>
                </div>
              </div>
              <div className="branch-card-footer">
                <button 
                  className="btn btn-sm btn-secondary" 
                  onClick={() => handleEditBranch(branch)}
                  title="Sửa thông tin chi nhánh"
                >
                  ✏️ Sửa
                </button>
                <button 
                  className={`btn btn-sm ${branch.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleStatus(branch)}
                  title={branch.is_active ? 'Đóng chi nhánh' : 'Mở chi nhánh'}
                >
                  {branch.is_active ? '⏸ Đóng' : '▶️ Mở'}
                </button>
                <button 
                  className="btn btn-sm btn-danger" 
                  onClick={() => handleDeleteBranch(branch)}
                  title="Xóa chi nhánh"
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <BranchFormModal
        show={showModal}
        onClose={() => { setShowModal(false); setSelectedBranch(null); }}
        onSave={handleSaveBranch}
        branch={selectedBranch}
      />
    </div>
  );
};

export default AdminBranchesPage;
