import React, { useEffect, useState, useCallback } from 'react';
import StaffLayout from '../../components/StaffLayout';
import { paymentAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const ManageInvoicesPage = () => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [vnPayLoading, setVnPayLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('cash');

  useEffect(() => {
    loadInvoices();
  }, []);

  const navigate = useNavigate();

  const loadInvoices = async () => {
    try {
      console.log('Loading invoices...');
      setLoading(true);
      const res = await paymentAPI.getComprehensiveInvoices();
      console.log('Invoices loaded:', res.data?.length || 0, 'items');
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = useCallback(() => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.vehicle?.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.service_center?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.payment_status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, statusFilter]);

  useEffect(() => {
    filterInvoices();
  }, [filterInvoices]);

  const handleCashPayment = async (invoice) => {
    if (!window.confirm(`Xác nhận thanh toán ${formatCurrency(invoice.total_amount)} bằng tiền mặt cho hóa đơn #${invoice.id?.substring(0, 8)}...?`)) {
      return;
    }

    try {
      setPaymentLoading(true);
      console.log('Starting cash payment for invoice:', invoice.id);

      // Record cash payment (creates Payment record and updates invoice on server)
      await paymentAPI.recordCashPayment(invoice.id);
      console.log('Cash payment recorded successfully');

      // Reload invoices to reflect changes
      await loadInvoices();
      console.log('Invoices reloaded');

      alert('✅ Thanh toán bằng tiền mặt thành công!');
    } catch (error) {
      console.error('Cash payment error:', error);
      alert('❌ Lỗi khi thanh toán. Vui lòng thử lại.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleVNPayPayment = async (invoice) => {
    try {
      setVnPayLoading(true);
      console.log('Starting VNPay payment for invoice:', invoice.id);

      const response = await paymentAPI.createVNPayPayment(invoice.id);
      console.log('VNPay payment response:', response);

      if (response.data.payment_url) {
        console.log('Opening VNPay URL:', response.data.payment_url);
        // Open VNPay payment URL in a new window
        window.open(response.data.payment_url, '_blank');
        alert('Đã mở trang thanh toán VNPay. Vui lòng hoàn tất thanh toán.');
        // Optionally reload after some time, but for now, user can refresh manually
      } else {
        alert('❌ Không thể tạo liên kết thanh toán VNPay. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('VNPay payment error:', error);
      alert('❌ Lỗi khi tạo thanh toán VNPay. Vui lòng thử lại.');
    } finally {
      setVnPayLoading(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!selectedInvoice) {
      console.error('No invoice selected for payment');
      return;
    }

    console.log('Confirming payment for invoice:', selectedInvoice.id, 'method:', selectedMethod);

    if (selectedMethod === 'cash') {
      await handleCashPayment(selectedInvoice);
    } else if (selectedMethod === 'vnpay') {
      await handleVNPayPayment(selectedInvoice);
    }

    setShowPaymentModal(false);
    setSelectedInvoice(null);
    console.log('Payment modal closed');
  };

  const openPaymentModal = (invoice) => {
    console.log('Opening payment modal for invoice:', invoice.id);
    setSelectedInvoice(invoice);
    setSelectedMethod('cash');
    setShowPaymentModal(true);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0 VNĐ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'unpaid': { label: 'Chưa thanh toán', class: 'badge-warning' },
      'paid': { label: 'Đã thanh toán', class: 'badge-success' },
      'pending': { label: 'Đang xử lý', class: 'badge-pending' },
      'cancelled': { label: 'Đã hủy', class: 'badge-cancelled' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'badge-pending' };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  const getPaymentMethodBadge = (method) => {
    const methodMap = {
      'cash': { label: 'Tiền mặt', class: 'badge-success' },
      'vnpay': { label: 'VNPay', class: 'badge-info' },
      'momo': { label: 'Momo', class: 'badge-primary' }
    };
    const methodInfo = methodMap[method] || { label: method || 'N/A', class: 'badge-secondary' };
    return <span className={`badge ${methodInfo.class}`}>{methodInfo.label}</span>;
  };

  // Calculate statistics
  const stats = {
    total: filteredInvoices.length,
    unpaid: filteredInvoices.filter(inv => inv.payment_status === 'unpaid').length,
    paid: filteredInvoices.filter(inv => inv.payment_status === 'paid').length,
    totalAmount: filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    unpaidAmount: filteredInvoices.filter(inv => inv.payment_status === 'unpaid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
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
        {/* Header */}
        <div className="hero" style={{ padding: '3rem 2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', marginBottom: '2rem', borderRadius: '16px' }}>
          <h1 style={{ color: 'white', margin: 0 }}>💳 Quản lý thanh toán</h1>
          <p style={{ color: 'white', opacity: 0.9, margin: '0.5rem 0 0' }}>Quản lý hóa đơn và thanh toán dịch vụ</p>
        </div>

        {/* Statistics Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
          <div className="stat-card primary" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(102, 126, 234, 0.15)',
            border: 'none',
            textAlign: 'center'
          }}>
            <div className="stat-label" style={{ color: 'white', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>TỔNG HÓA ĐƠN</div>
            <div className="stat-value" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>{stats.total}</div>
            <div style={{ fontSize: '0.8rem', color: 'white', opacity: 0.8 }}>hóa đơn</div>
          </div>

          <div className="stat-card warning" style={{
            background: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(255, 107, 107, 0.15)',
            border: 'none',
            textAlign: 'center'
          }}>
            <div className="stat-label" style={{ color: '#c53030', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>CHƯA THANH TOÁN</div>
            <div className="stat-value" style={{ fontSize: '3rem', fontWeight: 'bold', color: '#c53030', marginBottom: '0.5rem' }}>{stats.unpaid}</div>
            <div style={{ fontSize: '0.8rem', color: '#c53030' }}>{formatCurrency(stats.unpaidAmount)}</div>
          </div>

          <div className="stat-card success" style={{
            background: 'linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(72, 187, 120, 0.15)',
            border: 'none',
            textAlign: 'center'
          }}>
            <div className="stat-label" style={{ color: '#22543d', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>ĐÃ THANH TOÁN</div>
            <div className="stat-value" style={{ fontSize: '3rem', fontWeight: 'bold', color: '#22543d', marginBottom: '0.5rem' }}>{stats.paid}</div>
            <div style={{ fontSize: '0.8rem', color: '#22543d' }}>hóa đơn</div>
          </div>

          <div className="stat-card info" style={{
            background: 'linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(66, 153, 225, 0.15)',
            border: 'none',
            textAlign: 'center'
          }}>
            <div className="stat-label" style={{ color: '#2b6cb0', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>TỔNG DOANH THU</div>
            <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2b6cb0', marginBottom: '0.5rem' }}>
              {formatCurrency(stats.totalAmount)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#2b6cb0' }}>từ tất cả hóa đơn</div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="card" style={{ marginBottom: '2rem', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  placeholder="🔍 Tìm kiếm hóa đơn (mã, khách hàng, biển số xe, trung tâm dịch vụ...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4a5568' }}>Trạng thái:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="all">Tất cả ({stats.total})</option>
                  <option value="unpaid">Chưa thanh toán ({stats.unpaid})</option>
                  <option value="paid">Đã thanh toán ({stats.paid})</option>
                  <option value="pending">Đang xử lý</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>

              <button
                onClick={loadInvoices}
                className="btn btn-outline"
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#667eea',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🔄 Làm mới
              </button>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="card" style={{ border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', borderRadius: '16px' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)', borderRadius: '16px 16px 0 0', padding: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#2d3748' }}>📋 Danh sách hóa đơn</h2>
          </div>

          {filteredInvoices.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#666', background: '#f8f9fa', borderRadius: '0 0 16px 16px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
              <h3 style={{ marginBottom: '0.5rem', color: '#4a5568' }}>Không tìm thấy hóa đơn nào</h3>
              <p style={{ color: '#718096' }}>
                {searchTerm || statusFilter !== 'all' ? 'Thử điều chỉnh bộ lọc tìm kiếm' : 'Chưa có hóa đơn nào được tạo'}
              </p>
            </div>
          ) : (
            <div className="table-responsive" style={{ padding: '2rem' }}>
              <table className="data-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
              }}>
                <thead style={{ background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Mã hóa đơn</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Khách hàng</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Trung tâm dịch vụ</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Số tiền</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Trạng thái</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Thanh toán</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Ngày tạo</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, index) => (
                    <tr key={invoice.id} style={{
                      background: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => e.target.closest('tr').style.background = '#f1f5f9'}
                    onMouseOut={(e) => e.target.closest('tr').style.background = index % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                    >
                      <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>
                        #{invoice.id?.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '1rem', color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: '600' }}>{invoice.appointment?.customer?.full_name || 'N/A'}</div>
                        {invoice.appointment?.vehicle?.license_plate && (
                          <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                            🚗 {invoice.appointment.vehicle.license_plate}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>
                        {invoice.appointment?.service_center?.name || 'N/A'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#2d3748', borderBottom: '1px solid #e2e8f0' }}>
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        {getStatusBadge(invoice.payment_status)}
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        {getPaymentMethodBadge(invoice.payment_method)}
                      </td>
                      <td style={{ padding: '1rem', color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>
                        {formatDate(invoice.created_at || invoice.issue_date)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                        {invoice.payment_status === 'unpaid' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(invoice)}
                            disabled={paymentLoading || vnPayLoading}
                            className="btn btn-sm btn-primary"
                            style={{
                              padding: '0.5rem 1rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              marginRight: '0.5rem'
                            }}
                            onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
                            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                          >
                            � Thanh toán
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/staff/invoices/${invoice.id}`)}
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: '0.5rem 1rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            background: 'white',
                            color: '#4a5568',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.borderColor = '#667eea';
                            e.target.style.background = '#f8f9ff';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.borderColor = '#e2e8f0';
                            e.target.style.background = 'white';
                          }}
                        >
                          👁️ Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedInvoice && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ marginTop: 0, color: '#2d3748', textAlign: 'center' }}>
                💰 Thanh toán hóa đơn
              </h3>
              <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: '1.5rem' }}>
                Hóa đơn #{selectedInvoice.id?.substring(0, 8)}... - {formatCurrency(selectedInvoice.total_amount)}
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#2d3748' }}>
                  Chọn phương thức thanh toán:
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem',
                    border: `2px solid ${selectedMethod === 'cash' ? '#48bb78' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedMethod === 'cash' ? '#f0fff4' : 'white',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      value="cash"
                      checked={selectedMethod === 'cash'}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontWeight: '600', color: '#22543d' }}>💵 Tiền mặt</span>
                  </label>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem',
                    border: `2px solid ${selectedMethod === 'vnpay' ? '#4299e1' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedMethod === 'vnpay' ? '#ebf8ff' : 'white',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      value="vnpay"
                      checked={selectedMethod === 'vnpay'}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontWeight: '600', color: '#2b6cb0' }}>💳 VNPay</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#4a5568',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handlePaymentConfirm}
                  disabled={paymentLoading || vnPayLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    opacity: (paymentLoading || vnPayLoading) ? 0.6 : 1
                  }}
                >
                  {(paymentLoading || vnPayLoading) ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  );
};

export default ManageInvoicesPage;
