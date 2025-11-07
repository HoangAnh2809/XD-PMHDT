import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './InvoiceListPage.css';

const InvoiceListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, paid, overdue
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInvoices();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterInvoices();
  }, [invoices, filter, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInvoices = async () => {
    try {
      setLoading(true);
      let data;

      if (user?.role === 'customer') {
        // Customers can only see their own invoices
        data = await invoiceAPI.getInvoices(user.id);
      } else {
        // Staff/admin can see all invoices
        data = await invoiceAPI.getInvoices();
      }

      // Ensure data is an array
      const invoicesArray = Array.isArray(data) ? data : [];
      setInvoices(invoicesArray);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setError('Không thể tải danh sách hóa đơn');
      setInvoices([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    if (!Array.isArray(invoices)) {
      setFilteredInvoices([]);
      return;
    }

    let filtered = [...invoices];

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(invoice => {
        switch (filter) {
          case 'pending':
            return invoice.payment_status === 'pending';
          case 'paid':
            return invoice.payment_status === 'paid';
          case 'overdue':
            return invoice.payment_status === 'pending' &&
                   new Date(invoice.due_date) < new Date();
          default:
            return true;
        }
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.appointment?.customer?.full_name &&
         invoice.appointment.customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredInvoices(filtered);
  };

  const handlePayment = (invoiceId) => {
    navigate(`/payment/${invoiceId}`);
  };

  const handleViewDetail = (invoiceId) => {
    navigate(`/invoice/${invoiceId}`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getStatusBadge = (status, dueDate) => {
    const isOverdue = status === 'pending' && new Date(dueDate) < new Date();

    if (isOverdue) {
      return <span className="status-badge overdue">Quá hạn</span>;
    }

    switch (status) {
      case 'paid':
        return <span className="status-badge paid">Đã thanh toán</span>;
      case 'pending':
        return <span className="status-badge pending">Chờ thanh toán</span>;
      case 'failed':
        return <span className="status-badge failed">Thanh toán thất bại</span>;
      default:
        return <span className="status-badge unknown">Không xác định</span>;
    }
  };

  const getPaymentMethodText = (method) => {
    switch (method) {
      case 'vnpay':
        return 'VNPay';
      case 'momo':
        return 'Ví MoMo';
      case 'sepay':
        return 'SePay';
      case 'cash':
        return 'Tiền mặt';
      case 'bank_transfer':
        return 'Chuyển khoản';
      default:
        return 'Chưa xác định';
    }
  };

  if (loading) {
    return (
      <div className="invoice-list-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Đang tải danh sách hóa đơn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-list-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>📄 Danh Sách Hóa Đơn</h1>
          <p>Quản lý và thanh toán hóa đơn dịch vụ</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadInvoices}>
            🔄 Làm mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Trạng thái:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả</option>
            <option value="pending">Chờ thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Tìm kiếm:</label>
          <input
            type="text"
            placeholder="Tìm theo số hóa đơn hoặc tên khách hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3>{Array.isArray(invoices) ? invoices.length : 0}</h3>
            <p>Tổng hóa đơn</p>
          </div>
        </div>
        <div className="stat-card stat-pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>{Array.isArray(invoices) ? invoices.filter(inv => inv.payment_status === 'pending').length : 0}</h3>
            <p>Chờ thanh toán</p>
          </div>
        </div>
        <div className="stat-card stat-paid">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{Array.isArray(invoices) ? invoices.filter(inv => inv.payment_status === 'paid').length : 0}</h3>
            <p>Đã thanh toán</p>
          </div>
        </div>
        <div className="stat-card stat-overdue">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{Array.isArray(invoices) ? invoices.filter(inv =>
              inv.payment_status === 'pending' &&
              new Date(inv.due_date) < new Date()
            ).length : 0}</h3>
            <p>Quá hạn</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Invoice List */}
      <div className="invoice-list">
        {filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>Không tìm thấy hóa đơn</h3>
            <p>Không có hóa đơn nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          filteredInvoices.map(invoice => (
            <div key={invoice.id} className="invoice-card">
              <div className="invoice-header">
                <div className="invoice-info">
                  <h3>{invoice.invoice_number}</h3>
                  {getStatusBadge(invoice.payment_status, invoice.due_date)}
                </div>
                <div className="invoice-amount">
                  <span className="amount">{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>

              <div className="invoice-details">
                <div className="detail-row">
                  <span className="label">Ngày tạo:</span>
                  <span className="value">{formatDate(invoice.issue_date || invoice.created_at)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Hạn thanh toán:</span>
                  <span className={`value ${new Date(invoice.due_date) < new Date() && invoice.payment_status === 'pending' ? 'overdue' : ''}`}>
                    {formatDate(invoice.due_date)}
                  </span>
                </div>
                {invoice.payment_method && (
                  <div className="detail-row">
                    <span className="label">Phương thức:</span>
                    <span className="value">{getPaymentMethodText(invoice.payment_method)}</span>
                  </div>
                )}
                {invoice.payment_date && (
                  <div className="detail-row">
                    <span className="label">Ngày thanh toán:</span>
                    <span className="value">{formatDate(invoice.payment_date)}</span>
                  </div>
                )}
              </div>

              {invoice.notes && (
                <div className="invoice-notes">
                  <strong>Ghi chú:</strong> {invoice.notes}
                </div>
              )}

              <div className="invoice-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => handleViewDetail(invoice.id)}
                >
                  👁️ Xem chi tiết
                </button>

                {invoice.payment_status === 'pending' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePayment(invoice.id)}
                  >
                    💳 Thanh toán
                  </button>
                )}

                {invoice.payment_status === 'paid' && (
                  <button
                    className="btn btn-success"
                    disabled
                  >
                    ✅ Đã thanh toán
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InvoiceListPage;