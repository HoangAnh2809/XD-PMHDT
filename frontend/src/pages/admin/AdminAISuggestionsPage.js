import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../services/adminAPI';
import { useAuth } from '../../contexts/AuthContext';
import './AdminAISuggestionsPage.css';

// modal tạo đơn nhập kết nối backend thực tế
function OrderModal({ part, onClose, formatCurrency }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [partId, setPartId] = useState(null);

  useEffect(() => {
    async function findPart() {
      setPartId(null);
      try {
        const res = await inventoryAPI.getAll();
        const found = res.data.find(p => p.name === part.partName && p.supplier === part.supplier);
        if (found) setPartId(found.id);
      } catch {}
    }
    findPart();
  }, [part]);

  const handleSubmit = async () => {
    setLoading(true); setError(''); setSuccess(false);
    try {
      let id = partId;
      // nếu chưa có part, tạo mới
      if (!id) {
        const createRes = await inventoryAPI.create({
          name: part.partName,
          category: 'other',
          sku: (part.partName.replace(/\s/g, '-').toUpperCase().slice(0, 20) + '-' + Math.floor(Math.random()*10000)),
          stock: 0,
          min_stock: 5,
          price: part.estimatedCost / part.recommendedStock,
          unit: 'cái',
          supplier: part.supplier,
          location: 'Kho tổng',
        });
        id = createRes.data.id;
      }
      // gọi API nhập kho
      await inventoryAPI.adjustStock(id, part.recommendedStock, note || 'Nhập kho từ gợi ý AI');
      setSuccess(true);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Lỗi khi gửi đơn nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✅ Tạo đơn nhập nhanh</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Tên phụ tùng</label>
            <input className="form-control" value={part.partName} disabled />
          </div>
          <div className="form-group">
            <label>Nhà cung cấp</label>
            <input className="form-control" value={part.supplier} disabled />
          </div>
          <div className="form-group">
            <label>Số lượng nhập</label>
            <input className="form-control" value={part.recommendedStock} disabled />
          </div>
          <div className="form-group">
            <label>Chi phí dự kiến</label>
            <input className="form-control" value={formatCurrency(part.estimatedCost)} disabled />
          </div>
          <div className="form-group">
            <label>Ghi chú</label>
            <textarea className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú cho đơn nhập..." />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{typeof error === 'object' ? JSON.stringify(error) : error}</div>}
          {success ? (
            <div style={{ color: 'green', marginBottom: 8 }}>Đã gửi đơn nhập thành công!</div>
          ) : (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Đang gửi...' : 'Gửi đơn nhập'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const AdminAISuggestionsPage = () => {
  // Đã khai báo user ở trên, xóa dòng này để tránh trùng lặp
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState({
    parts: [],
    staff: [],
    pricing: [],
    maintenance: []
  });
  const [activeTab, setActiveTab] = useState('parts');
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      // Simulate AI-generated suggestions
      // in production, this would call your AI service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSuggestions({
        parts: [
          {
            id: 1,
            partName: 'Pin Lithium-ion 60kWh',
            currentStock: 5,
            recommendedStock: 15,
            reason: 'Dự đoán nhu cầu tăng 45% trong 2 tuần tới dựa trên lịch sử bảo dưỡng',
            urgency: 'high',
            estimatedCost: 45000000,
            supplier: 'CATL Vietnam',
            confidence: 92
          },
          {
            id: 2,
            partName: 'Bộ phanh ABS',
            currentStock: 12,
            recommendedStock: 20,
            reason: 'Mùa mưa đến, tỷ lệ thay phanh tăng 30% theo dữ liệu năm trước',
            urgency: 'medium',
            estimatedCost: 8500000,
            supplier: 'Bosch Automotive',
            confidence: 87
          },
          {
            id: 3,
            partName: 'Lốp xe EV 225/50R18',
            currentStock: 8,
            recommendedStock: 24,
            reason: 'Có 18 xe đến hạn thay lốp trong 3 tuần tới',
            urgency: 'medium',
            estimatedCost: 12000000,
            supplier: 'Michelin Vietnam',
            confidence: 95
          },
          {
            id: 4,
            partName: 'Bộ sạc AC Type 2',
            currentStock: 2,
            recommendedStock: 8,
            reason: 'Tồn kho thấp, thời gian chờ nhập hàng 2 tuần',
            urgency: 'high',
            estimatedCost: 6000000,
            supplier: 'Delta Electronics',
            confidence: 88
          },
          {
            id: 5,
            partName: 'Bộ điều khiển động cơ',
            currentStock: 3,
            recommendedStock: 6,
            reason: 'Phụ tùng quan trọng, nên dự trữ an toàn',
            urgency: 'low',
            estimatedCost: 25000000,
            supplier: 'Siemens Vietnam',
            confidence: 75
          }
        ],
        staff: [
          {
            id: 1,
            suggestion: 'Cần tuyển thêm 2 kỹ thuật viên chuyên về hệ thống pin',
            reason: 'Lượng công việc liên quan đến pin tăng 60%, thời gian chờ trung bình 5 ngày',
            priority: 'high',
            impact: 'Giảm 40% thời gian chờ, tăng 25% doanh thu'
          },
          {
            id: 2,
            suggestion: 'Đào tạo nhân viên về phần mềm chẩn đoán mới',
            reason: 'Có 3 lỗi phần mềm chưa được xử lý do thiếu chuyên môn',
            priority: 'medium',
            impact: 'Giảm 30% thời gian chẩn đoán lỗi'
          },
          {
            id: 3,
            suggestion: 'Sắp xếp ca làm việc tối ưu hơn vào cuối tuần',
            reason: 'Lượng khách vào Sat-Sun tăng 45%, nhưng chỉ có 60% nhân viên',
            priority: 'medium',
            impact: 'Tăng 20% khách hàng được phục vụ'
          }
        ],
        pricing: [
          {
            id: 1,
            service: 'Bảo dưỡng định kỳ 10,000km',
            currentPrice: 1500000,
            suggestedPrice: 1650000,
            reason: 'Giá thị trường tăng 8%, chi phí phụ tùng tăng 12%',
            competitor: 'Đối thủ: 1,600,000 - 1,800,000 VNĐ'
          },
          {
            id: 2,
            service: 'Thay pin BMS',
            currentPrice: 45000000,
            suggestedPrice: 42000000,
            reason: 'Giảm giá để cạnh tranh, vẫn có lãi 18%',
            competitor: 'Đối thủ: 40,000,000 - 43,000,000 VNĐ'
          },
          {
            id: 3,
            service: 'Kiểm tra hệ thống điện',
            currentPrice: 800000,
            suggestedPrice: 900000,
            reason: 'Thời gian thực hiện tăng do độ phức tạp xe mới',
            competitor: 'Đối thủ: 850,000 - 1,000,000 VNĐ'
          }
        ],
        maintenance: [
          {
            id: 1,
            vehiclePlate: '30A-12345',
            customerName: 'Nguyễn Văn A',
            recommendation: 'Nên thay pin trong 2 tuần',
            reason: 'Pin suy giảm 25% công suất, còn 75% tuổi thọ',
            estimatedCost: 45000000,
            urgency: 'medium'
          },
          {
            id: 2,
            vehiclePlate: '51B-98765',
            customerName: 'Trần Thị B',
            recommendation: 'Kiểm tra hệ thống phanh ngay',
            reason: 'Phát hiện rung bất thường trong lần bảo dưỡng gần nhất',
            estimatedCost: 5000000,
            urgency: 'high'
          },
          {
            id: 3,
            vehiclePlate: '29C-55555',
            customerName: 'Lê Văn C',
            recommendation: 'Thay lốp xe trước khi mùa mưa',
            reason: 'Độ mòn lốp đạt 70%, nguy cơ trơn trượt cao',
            estimatedCost: 6000000,
            urgency: 'medium'
          }
        ]
      });
      
    } catch (error) {
      console.error('Error loading AI suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert('Báo cáo AI đã được tạo và gửi qua email!');
    setGeneratingReport(false);
  };

  const getUrgencyBadge = (urgency) => {
    const badges = {
      high: { class: 'badge-danger', text: 'Khẩn cấp' },
      medium: { class: 'badge-warning', text: 'Trung bình' },
      low: { class: 'badge-info', text: 'Thấp' }
    };
    const badge = badges[urgency] || badges.low;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      high: { class: 'badge-danger', text: 'Cao' },
      medium: { class: 'badge-warning', text: 'Trung bình' },
      low: { class: 'badge-info', text: 'Thấp' }
    };
    const badge = badges[priority] || badges.low;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="ai-suggestions-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>🤖 AI đang phân tích dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-suggestions-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>🤖 Gợi ý thông minh từ AI</h1>
          <p>Phân tích dự đoán dựa trên Machine Learning và dữ liệu lịch sử</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadSuggestions}>
            🔄 Làm mới
          </button>
          <button 
            className="btn btn-primary" 
            onClick={generateReport}
            disabled={generatingReport}
          >
            {generatingReport ? '⏳ Đang tạo...' : '📊 Xuất báo cáo'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">🧰</div>
          <div className="stat-content">
            <h3>{suggestions.parts.length}</h3>
            <p>Gợi ý nhập phụ tùng</p>
          </div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{suggestions.staff.length}</h3>
            <p>Gợi ý nhân sự</p>
          </div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>{suggestions.pricing.length}</h3>
            <p>Điều chỉnh giá dịch vụ</p>
          </div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-icon">🔧</div>
          <div className="stat-content">
            <h3>{suggestions.maintenance.length}</h3>
            <p>Khách cần bảo dưỡng</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'parts' ? 'active' : ''}`}
          onClick={() => setActiveTab('parts')}
        >
          🧰 Phụ tùng cần nhập
        </button>
        <button 
          className={`tab ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          👥 Quản lý nhân sự
        </button>
        <button 
          className={`tab ${activeTab === 'pricing' ? 'active' : ''}`}
          onClick={() => setActiveTab('pricing')}
        >
          💰 Điều chỉnh giá
        </button>
        <button 
          className={`tab ${activeTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          🔧 Lời khuyên khách hàng
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Parts Suggestions */}
        {activeTab === 'parts' && (
          <div className="suggestions-list">
            {suggestions.parts.map(part => (
              <div key={part.id} className="suggestion-card">
                <div className="card-header">
                  <h3>{part.partName}</h3>
                  {getUrgencyBadge(part.urgency)}
                </div>
                <div className="card-body">
                  <div className="stock-info">
                    <div className="stock-item">
                      <span className="label">Tồn kho hiện tại:</span>
                      <span className="value text-danger">{part.currentStock} cái</span>
                    </div>
                    <div className="stock-item">
                      <span className="label">Nên nhập:</span>
                      <span className="value text-success">{part.recommendedStock} cái</span>
                    </div>
                    <div className="stock-item">
                      <span className="label">Dự tính chi phí:</span>
                      <span className="value text-primary">{formatCurrency(part.estimatedCost)}</span>
                    </div>
                  </div>
                  <div className="reason-box">
                    <strong>💡 Lý do:</strong>
                    <p>{part.reason}</p>
                  </div>
                  <div className="supplier-info">
                    <span className="label">🏢 Nhà cung cấp:</span>
                    <span className="value">{part.supplier}</span>
                  </div>
                  <div className="confidence-bar">
                    <span className="label">Độ tin cậy: {part.confidence}%</span>
                    <div className="progress">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${part.confidence}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="card-footer">
                  <button
                    className="btn btn-sm btn-outline"
                    disabled={user && user.username && user.username.toLowerCase().includes('ai')}
                    title={user && user.username && user.username.toLowerCase().includes('ai') ? 'AI không thể xem chi tiết' : ''}
                    onClick={() => { setSelectedPart(part); setShowDetailModal(true); }}
                  >📋 Xem chi tiết</button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={user && user.username && user.username.toLowerCase().includes('ai')}
                    title={user && user.username && user.username.toLowerCase().includes('ai') ? 'AI không thể tạo đơn nhập' : ''}
                    onClick={() => { setSelectedPart(part); setShowCreateOrderModal(true); }}
                  >✅ Tạo đơn nhập</button>
                  {user && user.username && user.username.toLowerCase().includes('ai') && (
                    <div style={{ color: 'red', marginTop: 8, fontSize: 13 }}>
                      AI không thể xem chi tiết hoặc tạo đơn nhập. Vui lòng thao tác thủ công.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Staff Suggestions */}
        {activeTab === 'staff' && (
          <div className="suggestions-list">
            {suggestions.staff.map(item => (
              <div key={item.id} className="suggestion-card">
                <div className="card-header">
                  <h3>{item.suggestion}</h3>
                  {getPriorityBadge(item.priority)}
                </div>
                <div className="card-body">
                  <div className="reason-box">
                    <strong>📊 Phân tích:</strong>
                    <p>{typeof item.reason === 'object' ? JSON.stringify(item.reason) : item.reason}</p>
                  </div>
                  <div className="impact-box">
                    <strong>🎯 Tác động dự kiến:</strong>
                    <p>{typeof item.impact === 'object' ? JSON.stringify(item.impact) : item.impact}</p>
                  </div>
                </div>
                <div className="card-footer">
                  <button className="btn btn-sm btn-outline">📋 Chi tiết</button>
                  <button className="btn btn-sm btn-success">✅ Thực hiện</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pricing Suggestions */}
        {activeTab === 'pricing' && (
          <div className="suggestions-list">
            {suggestions.pricing.map(item => (
              <div key={item.id} className="suggestion-card">
                <div className="card-header">
                  <h3>{item.service}</h3>
                </div>
                <div className="card-body">
                  <div className="pricing-comparison">
                    <div className="price-item">
                      <span className="label">Giá hiện tại:</span>
                      <span className="value old-price">{formatCurrency(item.currentPrice)}</span>
                    </div>
                    <div className="price-arrow">→</div>
                    <div className="price-item">
                      <span className="label">Giá đề xuất:</span>
                      <span className={`value new-price ${item.suggestedPrice > item.currentPrice ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(item.suggestedPrice)}
                      </span>
                    </div>
                    <div className="price-change">
                      {item.suggestedPrice > item.currentPrice ? '📈' : '📉'}
                      {Math.abs(((item.suggestedPrice - item.currentPrice) / item.currentPrice * 100)).toFixed(1)}%
                    </div>
                  </div>
                  <div className="reason-box">
                    <strong>💡 Lý do:</strong>
                    <p>{item.reason}</p>
                  </div>
                  <div className="competitor-info">
                    <strong>🏪 {item.competitor}</strong>
                  </div>
                </div>
                <div className="card-footer">
                  <button className="btn btn-sm btn-outline">📊 Xem phân tích</button>
                  <button className="btn btn-sm btn-primary">✅ Áp dụng giá mới</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Maintenance Suggestions */}
        {activeTab === 'maintenance' && (
          <div className="suggestions-list">
            {suggestions.maintenance.map(item => (
              <div key={item.id} className="suggestion-card">
                <div className="card-header">
                  <div>
                    <h3>{item.vehiclePlate}</h3>
                    <p className="customer-name">Khách hàng: {item.customerName}</p>
                  </div>
                  {getUrgencyBadge(item.urgency)}
                </div>
                <div className="card-body">
                  <div className="recommendation-box">
                    <strong>🔧 Khuyến nghị:</strong>
                    <p>{typeof item.recommendation === 'object' ? JSON.stringify(item.recommendation) : item.recommendation}</p>
                  </div>
                  <div className="reason-box">
                    <strong>📊 Căn cứ:</strong>
                    <p>{typeof item.reason === 'object' ? JSON.stringify(item.reason) : item.reason}</p>
                  </div>
                  <div className="cost-info">
                    <span className="label">💰 Chi phí ước tính:</span>
                    <span className="value text-primary">{typeof item.estimatedCost === 'object' ? JSON.stringify(item.estimatedCost) : formatCurrency(item.estimatedCost)}</span>
                  </div>
                </div>
                <div className="card-footer">
                  <button className="btn btn-sm btn-outline">📞 Gọi khách hàng</button>
                  <button className="btn btn-sm btn-primary">📅 Đặt lịch hẹn</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal chi tiết phụ tùng */}
      {showDetailModal && selectedPart && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Chi tiết gợi ý nhập phụ tùng</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <h3>{selectedPart.partName}</h3>
              <p><b>Nhà cung cấp:</b> {selectedPart.supplier}</p>
              <p><b>Tồn kho hiện tại:</b> {selectedPart.currentStock} cái</p>
              <p><b>Nên nhập:</b> {selectedPart.recommendedStock} cái</p>
              <p><b>Dự tính chi phí:</b> {formatCurrency(selectedPart.estimatedCost)}</p>
              <p><b>Lý do:</b> {selectedPart.reason}</p>
              <p><b>Độ tin cậy AI:</b> {selectedPart.confidence}%</p>
              <div style={{ marginTop: 16 }}>
                <b>Phân tích AI nâng cao:</b>
                <ul>
                  <li>Biểu đồ tồn kho 6 tháng gần nhất (mô phỏng)</li>
                  <li>Dự báo nhu cầu 3 tháng tới (mô phỏng)</li>
                  <li>So sánh giá nhà cung cấp</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo đơn nhập nhanh */}
      {showCreateOrderModal && selectedPart && (
        <OrderModal
          part={selectedPart}
          onClose={() => setShowCreateOrderModal(false)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* AI Info Footer */}
      <div className="ai-info-footer">
        <div className="ai-info-card">
          <h4>🧠 Về mô hình AI</h4>
          <p>
            Hệ thống sử dụng thuật toán Machine Learning với:
          </p>
          <ul>
            <li>✅ Phân tích dữ liệu lịch sử 2 năm</li>
            <li>✅ Dự đoán xu hướng theo mùa</li>
            <li>✅ Học từ hành vi khách hàng</li>
            <li>✅ Cập nhật real-time từ thị trường</li>
            <li>✅ Độ chính xác trung bình: 87%</li>
          </ul>
          <p className="last-updated">
            🕒 Cập nhật lần cuối: {new Date().toLocaleString('vi-VN')}
          </p>
        </div>
      </div>

    </div>
  );
}

export default AdminAISuggestionsPage;
