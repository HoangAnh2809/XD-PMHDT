import React, { useState, useEffect } from 'react';
import StaffLayout from '../../components/StaffLayout';
import { staffAPI } from '../../services/api';

export default function ManagePartsPage() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedPart, setSelectedPart] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    part_number: '',
    category: '',
    manufacturer: '',
    description: '',
    unit_price: '',
    quantity_in_stock: '',
    minimum_stock_level: '',
    supplier: '',
    location: ''
  });

  const categories = [
    'Động cơ',
    'Hộp số',
    'Phanh',
    'Hệ thống treo',
    'Điện',
    'Thân xe',
    'Nội thất',
    'Dầu nhớt',
    'Lọc',
    'Khác'
  ];

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getParts({});
      setParts(response.data || []);
    } catch (error) {
      console.error('Error loading parts:', error);
      // Use mock data if API fails
      setParts([
        { id: 1, name: 'Dầu động cơ 5W-30', part_number: 'EO-5W30-001', category: 'Dầu nhớt', manufacturer: 'Castrol', unit_price: 250000, quantity_in_stock: 45, minimum_stock_level: 20, supplier: 'Auto Parts Supply', location: 'A-1-01' },
        { id: 2, name: 'Má phanh trước', part_number: 'BP-FR-002', category: 'Phanh', manufacturer: 'Brembo', unit_price: 850000, quantity_in_stock: 12, minimum_stock_level: 15, supplier: 'Brake World', location: 'B-2-03' },
        { id: 3, name: 'Lọc gió động cơ', part_number: 'AF-STD-003', category: 'Lọc', manufacturer: 'Mann Filter', unit_price: 180000, quantity_in_stock: 8, minimum_stock_level: 10, supplier: 'Filter Plus', location: 'C-1-05' },
        { id: 4, name: 'Bugi đánh lửa', part_number: 'SP-NGK-004', category: 'Điện', manufacturer: 'NGK', unit_price: 320000, quantity_in_stock: 25, minimum_stock_level: 15, supplier: 'Spark Supply', location: 'A-3-02' },
        { id: 5, name: 'Dầu hộp số tự động', part_number: 'TF-ATF-005', category: 'Dầu nhớt', manufacturer: 'Mobil', unit_price: 280000, quantity_in_stock: 5, minimum_stock_level: 12, supplier: 'Auto Parts Supply', location: 'A-1-03' },
        { id: 6, name: 'Lò xo treo sau', part_number: 'SS-RR-006', category: 'Hệ thống treo', manufacturer: 'KYB', unit_price: 1200000, quantity_in_stock: 18, minimum_stock_level: 10, supplier: 'Suspension Pro', location: 'D-2-01' }
      ]);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryFilter = (e) => {
    setFilterCategory(e.target.value);
  };

  const handleStockFilter = (e) => {
    setFilterStock(e.target.value);
  };

  const filteredParts = parts.filter(part => {
    const matchSearch = part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       part.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       part.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchCategory = filterCategory === 'all' || part.category === filterCategory;
    
    let matchStock = true;
    if (filterStock === 'low') {
      matchStock = part.quantity_in_stock < part.minimum_stock_level;
    } else if (filterStock === 'out') {
      matchStock = part.quantity_in_stock === 0;
    }
    
    return matchSearch && matchCategory && matchStock;
  });

  const handleAddPart = () => {
    setModalMode('add');
    setFormData({
      name: '',
      part_number: '',
      category: '',
      manufacturer: '',
      description: '',
      unit_price: '',
      quantity_in_stock: '',
      minimum_stock_level: '',
      supplier: '',
      location: ''
    });
    setShowModal(true);
  };

  const handleEditPart = (part) => {
    setModalMode('edit');
    setSelectedPart(part);
    setFormData({
      name: part.name || '',
      part_number: part.part_number || '',
      category: part.category || '',
      manufacturer: part.manufacturer || '',
      description: part.description || '',
      unit_price: part.unit_price || '',
      quantity_in_stock: part.quantity_in_stock || '',
      minimum_stock_level: part.minimum_stock_level || '',
      supplier: part.supplier || '',
      location: part.location || ''
    });
    setShowModal(true);
  };

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phụ tùng này?')) return;
    
    try {
      await staffAPI.deletePart(partId);
      loadParts();
      alert('Xóa phụ tùng thành công!');
    } catch (error) {
      console.error('Error deleting part:', error);
      alert('Lỗi khi xóa phụ tùng!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Prepare data to match backend schema
      const partData = {
        part_number: formData.part_number,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        unit_price: parseFloat(formData.unit_price),
        quantity_in_stock: parseInt(formData.quantity_in_stock) || 0,
        minimum_stock_level: parseInt(formData.minimum_stock_level) || 10,
        supplier: formData.supplier || null,
        compatible_models: null  // Backend expects this field
      };

      if (modalMode === 'add') {
        await staffAPI.createPart(partData);
        alert('Thêm phụ tùng thành công!');
      } else {
        // For update, don't include part_number
        const { part_number, ...updateData } = partData;
        await staffAPI.updatePart(selectedPart.id, updateData);
        alert('Cập nhật phụ tùng thành công!');
      }
      setShowModal(false);
      loadParts();
    } catch (error) {
      console.error('Error saving part:', error);
      const errorMessage = error.response?.data?.detail || 'Lỗi khi lưu phụ tùng!';
      alert(errorMessage);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const getStockStatus = (part) => {
    if (part.quantity_in_stock === 0) {
      return <span className="badge badge-danger">Hết hàng</span>;
    } else if (part.quantity_in_stock < part.minimum_stock_level) {
      return <span className="badge badge-warning">Sắp hết</span>;
    } else {
      return <span className="badge badge-success">Còn hàng</span>;
    }
  };

  if (loading) {
    return (
      <StaffLayout>
        <div className="loading">Đang tải dữ liệu...</div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="container">
        <div className="page-header">
          <div>
            <h2>🧰 Quản lý phụ tùng</h2>
            <p>Quản lý kho phụ tùng và vật tư</p>
          </div>
          <button onClick={handleAddPart} className="btn btn-primary">
            ➕ Thêm phụ tùng
          </button>
        </div>

        {/* Summary Statistics */}
        <div className="parts-stats-grid">
          <div className="parts-stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-info">
              <div className="stat-label">Tổng loại phụ tùng</div>
              <div className="stat-value">{parts.length}</div>
            </div>
          </div>
          <div className="parts-stat-card warning">
            <div className="stat-icon">⚠️</div>
            <div className="stat-info">
              <div className="stat-label">Sắp hết hàng</div>
              <div className="stat-value">
                {parts.filter(p => p.quantity_in_stock < p.minimum_stock_level && p.quantity_in_stock > 0).length}
              </div>
            </div>
          </div>
          <div className="parts-stat-card danger">
            <div className="stat-icon">🚫</div>
            <div className="stat-info">
              <div className="stat-label">Hết hàng</div>
              <div className="stat-value">
                {parts.filter(p => p.quantity_in_stock === 0).length}
              </div>
            </div>
          </div>
          <div className="parts-stat-card success">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-label">Tổng giá trị kho</div>
              <div className="stat-value-small">
                {formatPrice(parts.reduce((sum, p) => sum + (p.unit_price * p.quantity_in_stock), 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="search-bar">
            <input
              type="text"
              placeholder="🔍 Tìm theo tên, mã phụ tùng, nhà sản xuất..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <div className="filters-bar">
              <div className="filter-group">
                <label>Danh mục:</label>
                <select value={filterCategory} onChange={handleCategoryFilter} className="filter-select">
                  <option value="all">Tất cả</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Tình trạng kho:</label>
                <select value={filterStock} onChange={handleStockFilter} className="filter-select">
                  <option value="all">Tất cả</option>
                  <option value="low">Sắp hết</option>
                  <option value="out">Hết hàng</option>
                </select>
              </div>
            </div>
            <div className="search-stats">
              Tìm thấy {filteredParts.length} phụ tùng
            </div>
          </div>

          {/* Parts Table */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phụ tùng</th>
                  <th>Tên phụ tùng</th>
                  <th>Danh mục</th>
                  <th>Nhà sản xuất</th>
                  <th>Giá</th>
                  <th>Tồn kho</th>
                  <th>Mức tối thiểu</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                      Không tìm thấy phụ tùng nào
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((part) => (
                    <tr key={part.id}>
                      <td><code>{part.part_number}</code></td>
                      <td><strong>{part.name}</strong></td>
                      <td>{part.category}</td>
                      <td>{part.manufacturer}</td>
                      <td>{formatPrice(part.unit_price)}</td>
                      <td>
                        <span className={part.quantity_in_stock < part.minimum_stock_level ? 'text-danger' : ''}>
                          <strong>{part.quantity_in_stock}</strong>
                        </span>
                      </td>
                      <td>{part.minimum_stock_level}</td>
                      <td>
                        <span className="badge badge-info">{part.location}</span>
                      </td>
                      <td>{getStockStatus(part)}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleEditPart(part)}
                            className="btn btn-sm btn-primary"
                          >
                            ✏️ Sửa
                          </button>
                          <button 
                            onClick={() => handleDeletePart(part.id)}
                            className="btn btn-sm btn-danger"
                          >
                            🗑️ Xóa
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
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'add' ? '➕ Thêm phụ tùng mới' : '✏️ Chỉnh sửa phụ tùng'}</h3>
              <button onClick={() => setShowModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tên phụ tùng *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="form-control"
                      placeholder="VD: Dầu động cơ 5W-30"
                    />
                  </div>
                  <div className="form-group">
                    <label>Mã phụ tùng *</label>
                    <input
                      type="text"
                      name="part_number"
                      value={formData.part_number}
                      onChange={handleInputChange}
                      required
                      className="form-control"
                      placeholder="VD: EO-5W30-001"
                      disabled={modalMode === 'edit'}
                      title={modalMode === 'edit' ? 'Không thể thay đổi mã phụ tùng' : ''}
                    />
                  </div>
                  <div className="form-group">
                    <label>Danh mục *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      className="form-control"
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nhà sản xuất</label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="VD: Castrol"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Mô tả</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="form-control"
                      rows="3"
                      placeholder="Mô tả chi tiết về phụ tùng..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Giá (VNĐ) *</label>
                    <input
                      type="number"
                      name="unit_price"
                      value={formData.unit_price}
                      onChange={handleInputChange}
                      required
                      min="0"
                      className="form-control"
                      placeholder="250000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Số lượng tồn kho *</label>
                    <input
                      type="number"
                      name="quantity_in_stock"
                      value={formData.quantity_in_stock}
                      onChange={handleInputChange}
                      required
                      min="0"
                      className="form-control"
                      placeholder="45"
                    />
                  </div>
                  <div className="form-group">
                    <label>Mức tồn kho tối thiểu *</label>
                    <input
                      type="number"
                      name="minimum_stock_level"
                      value={formData.minimum_stock_level}
                      onChange={handleInputChange}
                      required
                      min="0"
                      className="form-control"
                      placeholder="20"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nhà cung cấp</label>
                    <input
                      type="text"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="VD: Auto Parts Supply"
                    />
                  </div>
                  <div className="form-group">
                    <label>Vị trí kho</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="VD: A-1-01"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'add' ? '➕ Thêm' : '💾 Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
