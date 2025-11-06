import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../services/adminAPI';
import './AdminPages.css';

import { useAuth } from '../../contexts/AuthContext';

const AdminInventoryPage = () => {
  const { user } = useAuth();
  const [parts, setParts] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: 'battery',
    quantity_in_stock: 0,
    minimum_stock_level: 0,
    unit_price: 0,
    supplier: '',
    location: '',
    part_number: '',
    description: ''
  });
  const [stockAdjustment, setStockAdjustment] = useState({
    type: 'in', // 'in' or 'out'
    quantity: 0,
    note: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const categories = [
    { value: 'battery', label: '🔋 Pin', icon: '🔋' },
    { value: 'motor', label: '⚙️ Motor', icon: '⚙️' },
    { value: 'charger', label: '🔌 Sạc', icon: '🔌' },
    { value: 'brake', label: '🛑 Phanh', icon: '🛑' },
    { value: 'tire', label: '⭕ Lốp', icon: '⭕' },
    { value: 'electronics', label: '💡 Điện tử', icon: '💡' },
    { value: 'body', label: '🚗 Thân xe', icon: '🚗' },
    { value: 'other', label: '📦 Khác', icon: '📦' }
  ];

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    try {
      const response = await inventoryAPI.getAll();
      setParts(response.data || []);
    } catch (error) {
      console.error('Error loading parts:', error);
      setMessage({ type: 'error', text: '❌ Không thể tải danh sách phụ tùng. Vui lòng thử lại.' });
      setParts([]);
    }
  };

  const handleOpenPartModal = (part = null) => {
    if (part) {
      // Edit mode
      setFormData({
        name: part.name || '',
        category: part.category || 'battery',
        quantity_in_stock: part.quantity_in_stock || 0,
        minimum_stock_level: part.minimum_stock_level || 0,
        unit_price: part.unit_price || 0,
        supplier: part.supplier || '',
        location: part.location || '',
        part_number: part.part_number || '',
        description: part.description || ''
      });
      setSelectedPart(part);
    } else {
      // Create mode
      setFormData({
        name: '',
        category: 'battery',
        quantity_in_stock: 0,
        minimum_stock_level: 0,
        unit_price: 0,
        supplier: '',
        location: '',
        part_number: '',
        description: ''
      });
      setSelectedPart(null);
    }
    setShowPartModal(true);
  };

  const handleOpenStockModal = (part) => {
    setSelectedPart(part);
    setStockAdjustment({
      type: 'in',
      quantity: 0,
      note: ''
    });
    setShowStockModal(true);
  };

  const handleSavePart = async () => {
    try {
      if (!formData.name || !formData.supplier || !formData.part_number) {
        setMessage({ type: 'error', text: '❌ Vui lòng điền đầy đủ thông tin bắt buộc!' });
        return;
      }

      if (selectedPart) {
        // Update existing part
        await inventoryAPI.update(selectedPart.id, formData);
        setMessage({ type: 'success', text: '✅ Cập nhật phụ tùng thành công!' });
      } else {
        // Create new part
        await inventoryAPI.create(formData);
        setMessage({ type: 'success', text: '✅ Thêm phụ tùng mới thành công!' });
      }
      
      setShowPartModal(false);
      loadParts(); // Reload from backend
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving part:', error);
      const errorMsg = error.response?.data?.detail || 'Lỗi khi lưu phụ tùng!';
      setMessage({ type: 'error', text: `❌ ${errorMsg}` });
    }
  };

  const handleStockAdjustment = async () => {
    try {
      if (!stockAdjustment.quantity || stockAdjustment.quantity <= 0) {
        setMessage({ type: 'error', text: '❌ Số lượng phải lớn hơn 0!' });
        return;
      }

      const newStock = stockAdjustment.type === 'in' 
        ? selectedPart.quantity_in_stock + parseInt(stockAdjustment.quantity)
        : selectedPart.quantity_in_stock - parseInt(stockAdjustment.quantity);

      if (newStock < 0) {
        setMessage({ type: 'error', text: '❌ Không đủ hàng để xuất!' });
        return;
      }

      // Update stock via API
      await inventoryAPI.update(selectedPart.id, { quantity_in_stock: newStock });

      const action = stockAdjustment.type === 'in' ? 'Nhập kho' : 'Xuất kho';
      setMessage({ type: 'success', text: `✅ ${action} thành công! Tồn kho mới: ${newStock}` });
      setShowStockModal(false);
      loadParts(); // Reload from backend
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      const errorMsg = error.response?.data?.detail || 'Lỗi khi điều chỉnh tồn kho!';
      setMessage({ type: 'error', text: `❌ ${errorMsg}` });
    }
  };

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Bạn có chắc muốn xóa phụ tùng này?')) {
      return;
    }

    try {
      await inventoryAPI.delete(partId);
      setMessage({ type: 'success', text: '✅ Đã xóa phụ tùng!' });
      loadParts(); // Reload from backend
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error deleting part:', error);
      const errorMsg = error.response?.data?.detail || 'Lỗi khi xóa phụ tùng!';
      setMessage({ type: 'error', text: `❌ ${errorMsg}` });
    }
  };

  const filteredParts = parts.filter(part => {
    const matchesCategory = filterCategory === 'all' || part.category === filterCategory;
    const matchesLowStock = !showLowStock || part.quantity_in_stock < part.minimum_stock_level;
    const matchesSearch = !searchTerm || 
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesLowStock && matchesSearch;
  });

  const lowStockCount = parts.filter(p => p.quantity_in_stock < p.minimum_stock_level).length;
  const totalValue = parts.reduce((sum, p) => sum + (p.quantity_in_stock * p.unit_price), 0);
  const totalItems = parts.reduce((sum, p) => sum + p.quantity_in_stock, 0);

  const getCategoryIcon = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.icon : '📦';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const exportInventoryReport = () => {
    // Export to CSV
    const headers = ['SKU', 'Tên', 'Danh mục', 'Tồn kho', 'Min Stock', 'Giá', 'Nhà cung cấp', 'Vị trí'];
    const rows = parts.map(p => [
      p.part_number,
      p.name,
      p.category,
      p.quantity_in_stock,
      p.minimum_stock_level,
      p.unit_price,
      p.supplier,
      p.location
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    setMessage({ type: 'success', text: '✅ Đã tải báo cáo xuống!' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>🧰 Quản lý Phụ tùng</h1>
          <p>Theo dõi tồn kho, nhập xuất và dự báo phụ tùng</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={exportInventoryReport}>
            📥 Xuất báo cáo
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenPartModal()}>
            ➕ Thêm phụ tùng
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-icon">📦</span>
          <div>
            <div className="stat-number">{parts.length}</div>
            <div className="stat-label">Loại phụ tùng</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">📊</span>
          <div>
            <div className="stat-number">{totalItems}</div>
            <div className="stat-label">Tổng số lượng</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">⚠️</span>
          <div>
            <div className="stat-number" style={{ color: lowStockCount > 0 ? '#f56565' : '#48bb78' }}>
              {lowStockCount}
            </div>
            <div className="stat-label">Sắp hết hàng</div>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <div>
            <div className="stat-number" style={{ fontSize: '1.5rem' }}>
              {formatCurrency(totalValue)}
            </div>
            <div className="stat-label">Giá trị tồn kho</div>
          </div>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong>Cảnh báo tồn kho thấp!</strong>
            <p>Có {lowStockCount} phụ tùng đang dưới ngưỡng tồn kho tối thiểu.</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="filters-bar">
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-control"
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="🔍 Tìm theo tên, SKU, nhà cung cấp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
            style={{ flex: 1, maxWidth: '400px' }}
          />

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
            />
            <span>Chỉ hiện sắp hết hàng</span>
          </label>

          <span className="filter-result">
            {filteredParts.length} phụ tùng
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Tên phụ tùng</th>
                <th>Danh mục</th>
                <th>Tồn kho</th>
                <th>Min</th>
                <th>Đơn giá</th>
                <th>Giá trị</th>
                <th>Nhà cung cấp</th>
                <th>Vị trí</th>
                <th>Hành động</th>
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
                filteredParts.map(part => (
                  <tr key={part.id} className={part.quantity_in_stock < part.minimum_stock_level ? 'row-warning' : ''}>
                    <td><strong>{part.part_number}</strong></td>
                    <td>{part.name}</td>
                    <td>
                      <span>{getCategoryIcon(part.category)} {part.category}</span>
                    </td>
                    <td>
                      <strong style={{ color: part.quantity_in_stock < part.minimum_stock_level ? '#f56565' : '#48bb78' }}>
                        {part.quantity_in_stock}
                      </strong>
                    </td>
                    <td>{part.minimum_stock_level}</td>
                    <td>{formatCurrency(part.unit_price)}</td>
                    <td>{formatCurrency(part.quantity_in_stock * part.unit_price)}</td>
                    <td>{part.supplier}</td>
                    <td><span className="badge badge-info">{part.location}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-success" 
                          onClick={() => handleOpenStockModal(part)}
                          title="Nhập/Xuất kho"
                        >
                          📦
                        </button>
                        <button 
                          className="btn btn-sm btn-primary" 
                          onClick={() => handleOpenPartModal(part)}
                          title="Sửa"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleDeletePart(part.id)}
                          title="Xóa"
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

      {/* Part Form Modal (Thêm/Sửa) */}
      {showPartModal && (
        <div className="modal-overlay" onClick={() => setShowPartModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedPart ? '✏️ Sửa phụ tùng' : '➕ Thêm phụ tùng mới'}</h2>
              <button className="modal-close" onClick={() => setShowPartModal(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>SKU <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="BAT-001"
                  />
                </div>

                <div className="form-group">
                  <label>Tên phụ tùng <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Pin BYD Atto 3"
                  />
                </div>

                <div className="form-group">
                  <label>Danh mục</label>
                  <select
                    className="form-control"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Nhà cung cấp <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="BYD Vietnam"
                  />
                </div>

                <div className="form-group">
                  <label>Tồn kho ban đầu</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.quantity_in_stock || 0}
                    onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Tồn kho tối thiểu</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.minimum_stock_level || 0}
                    onChange={(e) => setFormData({ ...formData, minimum_stock_level: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Giá (VNĐ)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.unit_price || 0}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseInt(e.target.value) || 0 })}
                    min="0"
                    step="1000"
                  />
                  {formData.unit_price > 0 && (
                    <small style={{ color: '#28a745' }}>{formatCurrency(formData.unit_price)}</small>
                  )}
                </div>

                <div className="form-group">
                  <label>Vị trí kho</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Kho A-1"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Mô tả</label>
                  <textarea
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    placeholder="Mô tả chi tiết về phụ tùng..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPartModal(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleSavePart}>
                {selectedPart ? '💾 Cập nhật' : '➕ Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal (Nhập/Xuất kho) */}
      {showStockModal && selectedPart && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📦 Điều chỉnh tồn kho</h2>
              <button className="modal-close" onClick={() => setShowStockModal(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="info-section" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>{selectedPart.name}</h3>
                <p style={{ margin: 0, color: '#666' }}>
                  SKU: <strong>{selectedPart.part_number}</strong> | 
                  Tồn kho hiện tại: <strong style={{ color: '#00d4ff', fontSize: '1.2rem' }}>{selectedPart.quantity_in_stock}</strong>
                </p>
              </div>

              <div className="form-group">
                <label>Loại giao dịch</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="adjustment_type"
                      value="in"
                      checked={stockAdjustment.type === 'in'}
                      onChange={(e) => setStockAdjustment({ ...stockAdjustment, type: e.target.value })}
                    />
                    <span>📥 Nhập kho</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="adjustment_type"
                      value="out"
                      checked={stockAdjustment.type === 'out'}
                      onChange={(e) => setStockAdjustment({ ...stockAdjustment, type: e.target.value })}
                    />
                    <span>📤 Xuất kho</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Số lượng <span className="required">*</span></label>
                <input
                  type="number"
                  className="form-control"
                  value={stockAdjustment.quantity || 0}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                  min="1"
                  placeholder="Nhập số lượng"
                />
                {stockAdjustment.quantity > 0 && (
                  <small style={{ color: '#666' }}>
                    Tồn kho mới sẽ là: <strong>
                      {stockAdjustment.type === 'in' 
                        ? selectedPart.quantity_in_stock + parseInt(stockAdjustment.quantity)
                        : selectedPart.quantity_in_stock - parseInt(stockAdjustment.quantity)
                      }
                    </strong>
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  className="form-control"
                  value={stockAdjustment.note || ''}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, note: e.target.value })}
                  rows="3"
                  placeholder="Lý do nhập/xuất kho..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStockModal(false)}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={handleStockAdjustment}
                disabled={user && user.username && user.username.toLowerCase().includes('ai')}
                title={user && user.username && user.username.toLowerCase().includes('ai') ? 'AI không có quyền tạo đơn nhập' : ''}
              >
                ✅ Xác nhận
              </button>
              {user && user.username && user.username.toLowerCase().includes('ai') && (
                <div style={{ color: 'red', marginTop: 8 }}>
                  AI không có quyền tạo đơn nhập. Vui lòng thao tác thủ công.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryPage;
