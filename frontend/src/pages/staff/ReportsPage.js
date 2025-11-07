import React, { useState } from 'react';
import StaffLayout from '../../components/StaffLayout';
import { staffAPI } from '../../services/api';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('appointments');
  const [period, setPeriod] = useState('daily');
  const [format, setFormat] = useState('excel');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const reportTypes = [
    { id: 'appointments', name: 'Lịch hẹn', icon: '📅', desc: 'Chi tiết lịch hẹn theo thời gian' },
    { id: 'revenue', name: 'Doanh thu', icon: '💰', desc: 'Báo cáo doanh thu và thu chi' },
    { id: 'parts', name: 'Phụ tùng', icon: '🧰', desc: 'Xuất nhập tồn phụ tùng' },
    { id: 'customers', name: 'Khách hàng', icon: '👥', desc: 'Danh sách và lịch sử khách hàng' }
  ];

  const handleExport = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      // Use period for API call (daily/weekly/monthly)
      const response = await staffAPI.getReport(period, format, dateFrom, dateTo);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const reportName = reportTypes.find(r => r.id === reportType)?.name || reportType;
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `bao_cao_${reportName}_${period}_${timestamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage({ 
        type: 'success', 
        text: `✅ Đã xuất báo cáo ${reportName} (${format === 'excel' ? 'Excel' : 'PDF'}) thành công!` 
      });
      
      // Auto hide message after 5 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Error exporting report:', error);
      const errorMsg = error.response?.data?.detail || 'Không thể xuất báo cáo. Vui lòng thử lại.';
      setMessage({ 
        type: 'error', 
        text: `❌ ${errorMsg}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    // Reset dates when changing period
    setDateFrom('');
    setDateTo('');
  };

  const getDateRangeHint = () => {
    switch (period) {
      case 'daily':
        return '📅 Báo cáo theo ngày (mặc định: hôm nay)';
      case 'weekly':
        return '📆 Báo cáo theo tuần (mặc định: tuần này)';
      case 'monthly':
        return '🗓️ Báo cáo theo tháng (mặc định: tháng này)';
      default:
        return '';
    }
  };
  
  const getReportDescription = () => {
    const selected = reportTypes.find(r => r.id === reportType);
    return selected?.desc || '';
  };

  return (
    <StaffLayout>
      <div className="container">
        {/* Alert Message */}
        {message.text && (
          <div 
            className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
            style={{
              marginBottom: '1.5rem',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '500',
              animation: 'slideDown 0.3s ease-out'
            }}
          >
            {message.text}
          </div>
        )}

        {/* Header */}
        <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <div className="card-header" style={{ borderBottom: 'none' }}>
            <h2 style={{ margin: 0, fontSize: '2rem' }}>📊 Hệ thống báo cáo</h2>
            <p style={{ margin: '0.5rem 0 0 0', opacity: 0.95, fontSize: '1.05rem' }}>
              Xuất báo cáo Excel và PDF với dữ liệu chi tiết và trực quan
            </p>
          </div>
        </div>

        {/* Report Type Selection */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h3>📋 Chọn loại báo cáo</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {reportTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => setReportType(type.id)}
                  style={{
                    padding: '1.5rem',
                    border: reportType === type.id ? '3px solid #667eea' : '2px solid #e0e0e0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: reportType === type.id ? '#f0f4ff' : 'white',
                    boxShadow: reportType === type.id ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                    transform: reportType === type.id ? 'translateY(-4px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (reportType !== type.id) {
                      e.currentTarget.style.borderColor = '#667eea';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (reportType !== type.id) {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                    {type.icon}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem', textAlign: 'center', color: '#333' }}>
                    {type.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                    {type.desc}
                  </div>
                  {reportType === type.id && (
                    <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                      <span style={{ 
                        background: '#667eea', 
                        color: 'white', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        ✓ Đã chọn
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Report Configuration */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h3>⚙️ Cấu hình báo cáo</h3>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem' }}>
              {getReportDescription()}
            </p>
          </div>
          <div className="card-body">
            {/* Period Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1.05rem' }}>
                🕐 Khoảng thời gian:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <button
                  onClick={() => handlePeriodChange('daily')}
                  className={`btn ${period === 'daily' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ 
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: period === 'daily' ? '600' : '500',
                    transition: 'all 0.2s'
                  }}
                >
                  📅 Theo ngày
                </button>
                <button
                  onClick={() => handlePeriodChange('weekly')}
                  className={`btn ${period === 'weekly' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ 
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: period === 'weekly' ? '600' : '500',
                    transition: 'all 0.2s'
                  }}
                >
                  📆 Theo tuần
                </button>
                <button
                  onClick={() => handlePeriodChange('monthly')}
                  className={`btn ${period === 'monthly' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ 
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: period === 'monthly' ? '600' : '500',
                    transition: 'all 0.2s'
                  }}
                >
                  🗓️ Theo tháng
                </button>
              </div>
              <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
                {getDateRangeHint()}
              </p>
            </div>

            {/* Date Range */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1.05rem' }}>
                📆 Tùy chỉnh khoảng thời gian (tùy chọn):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                    Từ ngày:
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="form-control"
                    style={{ padding: '0.75rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', display: 'block' }}>
                    Đến ngày:
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="form-control"
                    style={{ padding: '0.75rem' }}
                  />
                </div>
              </div>
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
                💡 Để trống để sử dụng khoảng thời gian mặc định theo chu kỳ đã chọn
              </p>
            </div>

            {/* Format Selection */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1.05rem' }}>
                📁 Định dạng xuất file:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div
                  onClick={() => setFormat('excel')}
                  style={{
                    padding: '1.5rem',
                    border: format === 'excel' ? '3px solid #28a745' : '2px solid #e0e0e0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    background: format === 'excel' ? '#f0fff4' : 'white',
                    textAlign: 'center',
                    boxShadow: format === 'excel' ? '0 4px 12px rgba(40, 167, 69, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem', color: '#28a745' }}>
                    Excel (.xlsx)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    Dữ liệu dạng bảng, có thể chỉnh sửa
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#28a745' }}>
                    ✓ Hỗ trợ công thức, biểu đồ
                  </div>
                </div>
                
                <div
                  onClick={() => setFormat('pdf')}
                  style={{
                    padding: '1.5rem',
                    border: format === 'pdf' ? '3px solid #dc3545' : '2px solid #e0e0e0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    background: format === 'pdf' ? '#fff5f5' : 'white',
                    textAlign: 'center',
                    boxShadow: format === 'pdf' ? '0 4px 12px rgba(220, 53, 69, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📄</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem', color: '#dc3545' }}>
                    PDF (.pdf)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    Định dạng cố định, sẵn sàng in
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#dc3545' }}>
                    ✓ Bảo mật, dễ chia sẻ
                  </div>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div style={{ 
              textAlign: 'center', 
              marginTop: '2rem',
              padding: '2rem',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              borderRadius: '12px'
            }}>
              <button
                onClick={handleExport}
                disabled={loading}
                className="btn btn-primary"
                style={{ 
                  minWidth: '250px',
                  fontSize: '1.2rem',
                  padding: '1rem 2.5rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s',
                  background: loading ? '#999' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ 
                      display: 'inline-block', 
                      width: '20px', 
                      height: '20px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      marginRight: '0.5rem'
                    }}></span>
                    Đang tạo báo cáo...
                  </>
                ) : (
                  <>
                    📥 Xuất báo cáo {format === 'excel' ? 'Excel' : 'PDF'}
                  </>
                )}
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                File sẽ được tải xuống tự động sau khi tạo xong
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="card">
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <h3 style={{ margin: 0 }}>📚 Hướng dẫn sử dụng</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Report Types Info */}
              <div style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
                <h4 style={{ marginTop: 0, color: '#667eea' }}>📊 Loại báo cáo</h4>
                <ul style={{ lineHeight: '2', color: '#666', paddingLeft: '1.5rem' }}>
                  <li><strong>Lịch hẹn:</strong> Chi tiết từng cuộc hẹn</li>
                  <li><strong>Doanh thu:</strong> Tổng hợp thu chi</li>
                  <li><strong>Phụ tùng:</strong> Xuất nhập tồn kho</li>
                  <li><strong>Khách hàng:</strong> Danh sách & lịch sử</li>
                </ul>
              </div>

              {/* Period Info */}
              <div style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #28a745' }}>
                <h4 style={{ marginTop: 0, color: '#28a745' }}>🕐 Chu kỳ báo cáo</h4>
                <ul style={{ lineHeight: '2', color: '#666', paddingLeft: '1.5rem' }}>
                  <li><strong>Ngày:</strong> 1 ngày cụ thể</li>
                  <li><strong>Tuần:</strong> Thứ 2 → Chủ nhật</li>
                  <li><strong>Tháng:</strong> Đầu → cuối tháng</li>
                  <li><strong>Tùy chỉnh:</strong> Chọn khoảng riêng</li>
                </ul>
              </div>

              {/* Format Info */}
              <div style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #dc3545' }}>
                <h4 style={{ marginTop: 0, color: '#dc3545' }}>📁 Định dạng file</h4>
                <ul style={{ lineHeight: '2', color: '#666', paddingLeft: '1.5rem' }}>
                  <li><strong>Excel:</strong> Chỉnh sửa, tạo chart</li>
                  <li><strong>PDF:</strong> In ấn, lưu trữ</li>
                  <li><strong>Auto download:</strong> Tự động tải</li>
                  <li><strong>Tên file:</strong> Có ngày tháng</li>
                </ul>
              </div>
            </div>

            {/* Report Content Info */}
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1.5rem', 
              background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)', 
              borderLeft: '4px solid #ffc107',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ marginTop: 0, color: '#856404' }}>📌 Nội dung báo cáo bao gồm:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>✅ Tổng quan:</strong>
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                    <li>Tổng số lịch hẹn</li>
                    <li>Phân loại trạng thái</li>
                    <li>Tổng doanh thu</li>
                  </ul>
                </div>
                <div>
                  <strong>📋 Chi tiết:</strong>
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                    <li>Thông tin khách hàng</li>
                    <li>Chi tiết xe & dịch vụ</li>
                    <li>Giá cả & thanh toán</li>
                  </ul>
                </div>
                <div>
                  <strong>📊 Trực quan:</strong>
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                    <li>Bảng dữ liệu đẹp</li>
                    <li>Định dạng chuyên nghiệp</li>
                    <li>Sẵn sàng trình bày</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem 1.5rem', 
              background: '#e7f3ff', 
              borderLeft: '4px solid #0066cc',
              borderRadius: '8px'
            }}>
              <strong style={{ color: '#0066cc' }}>💡 Mẹo sử dụng:</strong>
              <ul style={{ marginTop: '0.5rem', marginBottom: 0, lineHeight: '1.8', color: '#555' }}>
                <li>Báo cáo <strong>Excel</strong> phù hợp để phân tích sâu, tạo pivot table và biểu đồ</li>
                <li>Báo cáo <strong>PDF</strong> phù hợp để gửi email, in ấn và lưu trữ lâu dài</li>
                <li>Sử dụng <strong>tùy chỉnh ngày</strong> để so sánh giữa các khoảng thời gian</li>
                <li>Tên file tự động có <strong>ngày tháng</strong> để dễ quản lý</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </StaffLayout>
  );
}
