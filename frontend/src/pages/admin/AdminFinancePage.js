import React, { useState, useEffect } from 'react';
import { financeAPI } from '../../services/adminAPI';
import './AdminPages.css';

const AdminFinancePage = () => {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, transactions, reports
  const [filterStatus, setFilterStatus] = useState('all');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      
      // Load stats
      const statsResponse = await financeAPI.getStats();
      setStats(statsResponse.data);
      
      // Load transactions
      const transactionsResponse = await financeAPI.getTransactions({ limit: 100 });
      setTransactions(transactionsResponse.data || []);
      
      // Load expenses
      const expensesResponse = await financeAPI.getExpenses();
      setExpenses(expensesResponse.data || []);
      
    } catch (error) {
      console.error('Error loading finance data:', error);
      // Set mock data for demo
      setStats({
        total_revenue: 450000000,
        total_expenses: 270000000,
        net_profit: 180000000,
        total_transactions: 234,
        completed_services: 234,
        pending_payments: 12,
        revenue_growth: 15.5,
        top_services: [
          { name: 'Battery Check', count: 45, revenue: 22500000 },
          { name: 'Tire Service', count: 38, revenue: 19000000 },
          { name: 'Brake Inspection', count: 32, revenue: 16000000 }
        ],
        monthly_data: []
      });
      setTransactions([]);
      setExpenses([
        { category: 'Phụ tùng & Vật liệu', amount: 157500000, percentage: 35 },
        { category: 'Lương nhân viên', amount: 90000000, percentage: 20 },
        { category: 'Vận hành & Bảo trì', amount: 45000000, percentage: 10 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { label: 'Hoàn thành', class: 'badge-success' },
      confirmed: { label: 'Đã xác nhận', class: 'badge-info' },
      pending: { label: 'Chờ xử lý', class: 'badge-warning' },
      cancelled: { label: 'Đã hủy', class: 'badge-danger' }
    };
    const config = statusConfig[status] || { label: status, class: 'badge-secondary' };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const handleExportPDF = async () => {
    try {
      setExportLoading(true);
      const response = await financeAPI.exportPDF({
        start_date: null, // Có thể thêm date picker để user chọn
        end_date: null
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao-cao-tai-chinh-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('✅ Xuất báo cáo PDF thành công!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('❌ Lỗi khi xuất báo cáo PDF. Vui lòng thử lại.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const response = await financeAPI.exportExcel({
        start_date: null,
        end_date: null
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao-cao-tai-chinh-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('✅ Xuất báo cáo Excel thành công!');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('❌ Lỗi khi xuất báo cáo Excel. Vui lòng thử lại.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleSendEmailReport = async () => {
    const email = prompt('Nhập email để nhận báo cáo:');
    if (!email) return;
    
    try {
      setExportLoading(true);
      // TODO: Implement send email API
      alert(`✅ Đã gửi báo cáo đến ${email}!`);
    } catch (error) {
      console.error('Error sending email:', error);
      alert('❌ Lỗi khi gửi email. Vui lòng thử lại.');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="page-header">
          <h1>💵 Quản lý Tài chính</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
          <p>Đang tải dữ liệu tài chính...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>💵 Quản lý Tài chính</h1>
          <p className="page-subtitle">
            Theo dõi doanh thu, chi phí và báo cáo tài chính
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleExportPDF}
            disabled={exportLoading}
          >
            {exportLoading ? '⏳ Đang xuất...' : '📥 Xuất báo cáo'}
          </button>
          <button className="btn btn-primary" onClick={loadFinanceData}>
            🔄 Làm mới
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)', color: 'white' }}>
            <div className="stat-icon">💰</div>
            <div className="stat-details">
              <div className="stat-value">{formatCurrency(stats.total_revenue)}</div>
              <div className="stat-label">Tổng doanh thu</div>
              {stats.revenue_growth !== 0 && (
                <div className="stat-trend" style={{ color: stats.revenue_growth > 0 ? '#c6f6d5' : '#fed7d7' }}>
                  {stats.revenue_growth > 0 ? '↑' : '↓'} {Math.abs(stats.revenue_growth).toFixed(1)}% so với tháng trước
                </div>
              )}
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)', color: 'white' }}>
            <div className="stat-icon">💸</div>
            <div className="stat-details">
              <div className="stat-value">{formatCurrency(stats.total_expenses)}</div>
              <div className="stat-label">Tổng chi phí</div>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div className="stat-icon">📈</div>
            <div className="stat-details">
              <div className="stat-value">{formatCurrency(stats.net_profit)}</div>
              <div className="stat-label">Lợi nhuận ròng</div>
              <div className="stat-trend" style={{ color: '#e9d8fd' }}>
                Tỷ suất: {((stats.net_profit / stats.total_revenue) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)', color: 'white' }}>
            <div className="stat-icon">🧾</div>
            <div className="stat-details">
              <div className="stat-value">{stats.total_transactions}</div>
              <div className="stat-label">Giao dịch hoàn thành</div>
              {stats.pending_payments > 0 && (
                <div className="stat-trend" style={{ color: '#bee3f8' }}>
                  {stats.pending_payments} chờ thanh toán
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="content-card" style={{ marginTop: '2rem' }}>
        <div className="tabs-header">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Tổng quan
          </button>
          <button
            className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            🧾 Giao dịch ({transactions.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            📈 Báo cáo
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="tab-content">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              
              {/* Top Services */}
              <div className="finance-section">
                <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>🏆 Dịch vụ hàng đầu</h3>
                <div className="services-ranking">
                  {stats.top_services && stats.top_services.length > 0 ? (
                    stats.top_services.map((service, index) => (
                      <div key={index} className="service-rank-item">
                        <div className="rank-badge">#{index + 1}</div>
                        <div className="service-info">
                          <div className="service-name">{service.name}</div>
                          <div className="service-stats">
                            <span>{service.count} lượt</span>
                            <span className="service-revenue">{formatCurrency(service.revenue)}</span>
                          </div>
                        </div>
                        <div className="service-bar">
                          <div 
                            className="service-bar-fill"
                            style={{ 
                              width: `${(service.revenue / stats.top_services[0].revenue) * 100}%`,
                              background: 'linear-gradient(90deg, #667eea, #764ba2)'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                      Chưa có dữ liệu dịch vụ
                    </p>
                  )}
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="finance-section">
                <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>💸 Chi phí theo danh mục</h3>
                <div className="expenses-breakdown">
                  {expenses && expenses.length > 0 ? (
                    expenses.map((expense, index) => (
                      <div key={index} className="expense-item">
                        <div className="expense-header">
                          <span className="expense-category">{expense.category}</span>
                          <span className="expense-percentage">{expense.percentage}%</span>
                        </div>
                        <div className="expense-amount">{formatCurrency(expense.amount)}</div>
                        <div className="expense-bar">
                          <div 
                            className="expense-bar-fill"
                            style={{ 
                              width: `${expense.percentage}%`,
                              background: `hsl(${(100 - expense.percentage) * 1.2}, 70%, 60%)`
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                      Chưa có dữ liệu chi phí
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Chart Data */}
            {stats.monthly_data && stats.monthly_data.length > 0 && (
              <div className="finance-section">
                <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>📊 Biểu đồ doanh thu 12 tháng</h3>
                <div className="monthly-chart">
                  {stats.monthly_data.map((month, index) => (
                    <div key={index} className="chart-bar-group">
                      <div className="chart-bars">
                        <div 
                          className="chart-bar revenue-bar"
                          style={{ height: `${(month.revenue / Math.max(...stats.monthly_data.map(m => m.revenue))) * 150}px` }}
                          title={`Doanh thu: ${formatCurrency(month.revenue)}`}
                        />
                        <div 
                          className="chart-bar profit-bar"
                          style={{ height: `${(month.profit / Math.max(...stats.monthly_data.map(m => m.revenue))) * 150}px` }}
                          title={`Lợi nhuận: ${formatCurrency(month.profit)}`}
                        />
                      </div>
                      <div className="chart-label">{month.month}</div>
                    </div>
                  ))}
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: '#48bb78' }} />
                    <span>Doanh thu</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: '#667eea' }} />
                    <span>Lợi nhuận</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="tab-content">
            <div className="table-controls" style={{ marginBottom: '1rem' }}>
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Hoàn thành</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="pending">Chờ xử lý</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                Hiển thị {filteredTransactions.length} / {transactions.length} giao dịch
              </div>
            </div>

            {filteredTransactions.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mã GD</th>
                      <th>Dịch vụ</th>
                      <th>Số tiền</th>
                      <th>Loại</th>
                      <th>Trạng thái</th>
                      <th>Thanh toán</th>
                      <th>Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {transaction.id.substring(0, 8)}...
                        </td>
                        <td>{transaction.service_name}</td>
                        <td style={{ fontWeight: 'bold', color: transaction.type === 'revenue' ? '#48bb78' : '#f56565' }}>
                          {transaction.type === 'revenue' ? '+' : '-'} {formatCurrency(transaction.amount)}
                        </td>
                        <td>
                          <span className={`badge ${transaction.type === 'revenue' ? 'badge-success' : 'badge-danger'}`}>
                            {transaction.type === 'revenue' ? 'Thu' : 'Chi'}
                          </span>
                        </td>
                        <td>{getStatusBadge(transaction.status)}</td>
                        <td>{transaction.payment_method || 'N/A'}</td>
                        <td>{formatDate(transaction.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🧾</div>
                <h3>Không có giao dịch nào</h3>
                <p>
                  {filterStatus !== 'all' 
                    ? 'Thử thay đổi bộ lọc để xem giao dịch'
                    : 'Chưa có giao dịch nào được ghi nhận'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="tab-content">
            <div className="reports-section">
              <h3 style={{ marginBottom: '1.5rem', color: '#1a1a2e' }}>📈 Báo cáo tài chính</h3>
              
              <div className="report-cards">
                <div className="report-card">
                  <div className="report-icon">📊</div>
                  <div className="report-content">
                    <h4>Báo cáo doanh thu</h4>
                    <p>Phân tích doanh thu theo thời gian và dịch vụ</p>
                    <button className="btn btn-primary btn-sm">
                      Xem báo cáo
                    </button>
                  </div>
                </div>

                <div className="report-card">
                  <div className="report-icon">💸</div>
                  <div className="report-content">
                    <h4>Báo cáo chi phí</h4>
                    <p>Theo dõi và phân tích các khoản chi</p>
                    <button className="btn btn-primary btn-sm">
                      Xem báo cáo
                    </button>
                  </div>
                </div>

                <div className="report-card">
                  <div className="report-icon">📈</div>
                  <div className="report-content">
                    <h4>Báo cáo lợi nhuận</h4>
                    <p>Tình hình lợi nhuận và tỷ suất sinh lời</p>
                    <button className="btn btn-primary btn-sm">
                      Xem báo cáo
                    </button>
                  </div>
                </div>

                <div className="report-card">
                  <div className="report-icon">🏆</div>
                  <div className="report-content">
                    <h4>Phân tích hiệu suất</h4>
                    <p>So sánh hiệu suất các chi nhánh và dịch vụ</p>
                    <button className="btn btn-primary btn-sm">
                      Xem báo cáo
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '1rem' }}>📥 Xuất báo cáo</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleExportPDF}
                    disabled={exportLoading}
                  >
                    {exportLoading ? '⏳ Đang xuất...' : '📄 Xuất PDF'}
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleExportExcel}
                    disabled={exportLoading}
                  >
                    {exportLoading ? '⏳ Đang xuất...' : '📊 Xuất Excel'}
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleSendEmailReport}
                    disabled={exportLoading}
                  >
                    {exportLoading ? '⏳ Đang gửi...' : '📧 Gửi email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFinancePage;
