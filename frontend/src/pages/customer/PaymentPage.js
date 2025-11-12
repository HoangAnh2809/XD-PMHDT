import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { paymentAPI } from '../../services/api';

// Utility function for status badges
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

const PaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVNPayModal, setShowVNPayModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);

  // Refs for scrolling
  const unpaidInvoicesRef = useRef(null);
  const paidInvoicesRef = useRef(null);

  useEffect(() => {
    loadInvoices();
    
    // Check payment callback
    const status = searchParams.get('status');
    if (status === 'success') {
      setMessage({ type: 'success', text: '✅ Thanh toán thành công!' });
    } else if (status === 'failed') {
      setMessage({ type: 'error', text: '❌ Thanh toán thất bại. Vui lòng thử lại.' });
    }
  }, [searchParams]);

  // Filter and sort invoices
  useEffect(() => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.service_type?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.vehicle?.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.vehicle?.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.appointment?.vehicle?.model?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.payment_status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.created_at || a.issue_date);
          bValue = new Date(b.created_at || b.issue_date);
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
          bValue = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
          break;
        case 'invoice_number':
          aValue = a.invoice_number || '';
          bValue = b.invoice_number || '';
          break;
        default:
          aValue = new Date(a.created_at || a.issue_date);
          bValue = new Date(b.created_at || b.issue_date);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, statusFilter, sortBy, sortOrder]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await paymentAPI.getInvoices();
      setInvoices(response.data || []);
    } catch (error) {
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        setMessage({ type: 'warning', text: 'Vui lòng đăng nhập để xem hóa đơn thanh toán.' });
      } else {
        // Payment API not ready yet or other error
        setMessage({ type: 'warning', text: 'Dịch vụ thanh toán đang bảo trì. Vui lòng thử lại sau.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (invoice, method) => {
    setSelectedInvoice(invoice);
    if (method === 'vnpay') {
      setShowVNPayModal(true);
    }
  };

  const handleVNPayConfirm = async () => {
    if (!selectedInvoice) return;

    try {
      setLoading(true);
      
      // Check if we're in frontend-only mode
      const isFrontendOnly = process.env.REACT_APP_API_URL?.includes('9999') || 
                            process.env.REACT_APP_API_URL?.includes('localhost:9999');
      
      if (isFrontendOnly) {
        setMessage({ type: 'success', text: '✅ Thanh toán VNPay thành công (Demo)!' });
        setShowVNPayModal(false);
        loadInvoices(); // Refresh to show updated status
        return;
      }

      const response = await paymentAPI.createVNPayPayment(selectedInvoice.id);
      if (response.data.payment_url) {
        // Open VNPay in a new window/tab to avoid JavaScript conflicts
        const vnpayWindow = window.open(response.data.payment_url, '_blank', 'width=800,height=600');
        
        // Monitor the popup window
        const checkClosed = setInterval(() => {
          if (vnpayWindow.closed) {
            clearInterval(checkClosed);
            // Refresh the page to check payment status
            window.location.reload();
          }
        }, 1000);
        
        setShowVNPayModal(false);
      }
    } catch (error) {
      console.error('VNPay payment error:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Lỗi khi tạo thanh toán VNPay. Vui lòng thử lại.' 
      });
      setShowVNPayModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedInvoice) return;

    try {
      setLoading(true);
      
      // Check if we're in frontend-only mode
      const isFrontendOnly = process.env.REACT_APP_API_URL?.includes('9999') || 
                            process.env.REACT_APP_API_URL?.includes('localhost:9999');
      
      if (isFrontendOnly) {
        setMessage({ type: 'success', text: '✅ Thanh toán VNPay thành công (Demo)!' });
        loadInvoices();
        return;
      }

      // Only VNPay is supported now
      setMessage({ type: 'error', text: 'Vui lòng chọn phương thức thanh toán VNPay' });
    } catch (error) {
      // Payment processing failed
      if (error.response?.status === 401 || error.response?.status === 403) {
        setMessage({ 
          type: 'error', 
          text: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: error.response?.data?.detail || 'Lỗi khi xử lý thanh toán. Vui lòng thử lại.' 
        });
      }
    } finally {
      setLoading(false);
    }
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

  // Statistics click handlers
  const handleUnpaidInvoicesClick = () => {
    if (unpaidInvoicesRef.current) {
      unpaidInvoicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePaidInvoicesClick = () => {
    if (paidInvoicesRef.current) {
      paidInvoicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTotalDebtClick = () => {
    setShowDebtModal(true);
  };

  const handleTotalInvoicesClick = () => {
    loadInvoices(); // Refresh data
  };

  const handleViewInvoiceDetail = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetail(true);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const unpaidInvoices = filteredInvoices.filter(inv => inv.payment_status === 'pending');
  const paidInvoices = filteredInvoices.filter(inv => inv.payment_status === 'paid');

  // Calculate statistics
  const totalInvoices = filteredInvoices.length;
  const totalUnpaid = unpaidInvoices.length;
  const totalPaid = paidInvoices.length;
  const totalDebt = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaidAmount = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  if (loading && invoices.length === 0) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="loading">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      
      <div className="hero" style={{ padding: '3rem 2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <h1 style={{ color: 'white' }}>💳 Thanh toán</h1>
        <p style={{ color: 'white', opacity: 0.9 }}>Quản lý hóa đơn và thanh toán dịch vụ</p>
      </div>

      <div className="container">
        {/* Alert Messages */}
        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '2rem' }}>
            {message.text}
            <button 
              onClick={() => setMessage({ type: '', text: '' })}
              style={{ float: 'right', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="card" style={{ marginBottom: '2rem', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  placeholder="🔍 Tìm kiếm hóa đơn (mã, dịch vụ, biển số xe...)"
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
                  <option value="all">Tất cả ({totalInvoices})</option>
                  <option value="pending">Chưa thanh toán ({totalUnpaid})</option>
                  <option value="paid">Đã thanh toán ({totalPaid})</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4a5568' }}>Sắp xếp:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="created_at">Ngày tạo</option>
                  <option value="total_amount">Số tiền</option>
                  <option value="due_date">Hạn thanh toán</option>
                  <option value="invoice_number">Mã hóa đơn</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="dashboard-grid" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
          <div className="stat-card warning" style={{
            background: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(255, 107, 107, 0.15)',
            border: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={handleUnpaidInvoicesClick}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <div className="stat-label" style={{ color: '#c53030', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>CHƯA THANH TOÁN</div>
            <div className="stat-value" style={{ fontSize: '3rem', fontWeight: 'bold', color: '#c53030', marginBottom: '0.5rem' }}>{totalUnpaid}</div>
            <div style={{ fontSize: '0.8rem', color: '#744210' }}>hóa đơn</div>
          </div>
          <div className="stat-card success" style={{
            background: 'linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(72, 187, 120, 0.15)',
            border: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={handlePaidInvoicesClick}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <div className="stat-label" style={{ color: '#22543d', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>ĐÃ THANH TOÁN</div>
            <div className="stat-value" style={{ fontSize: '3rem', fontWeight: 'bold', color: '#22543d', marginBottom: '0.5rem' }}>{totalPaid}</div>
            <div style={{ fontSize: '0.8rem', color: '#22543d' }}>hóa đơn</div>
          </div>
          <div className="stat-card" style={{
            background: 'linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(66, 153, 225, 0.15)',
            border: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={handleTotalDebtClick}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <div className="stat-label" style={{ color: '#2c5282', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>TỔNG PHẢI TRẢ</div>
            <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c5282', marginBottom: '0.5rem' }}>
              {formatCurrency(totalDebt)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#2c5282' }}>đang nợ</div>
          </div>
          <div className="stat-card primary" style={{
            background: 'linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 8px 25px rgba(102, 126, 234, 0.15)',
            border: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={handleTotalInvoicesClick}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-5px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <div className="stat-label" style={{ color: '#2b6cb0', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>TỔNG HÓA ĐƠN</div>
            <div className="stat-value" style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2b6cb0', marginBottom: '0.5rem' }}>{totalInvoices}</div>
            <div style={{ fontSize: '0.8rem', color: '#2b6cb0' }}>tất cả</div>
          </div>
        </div>

        {/* Unpaid Invoices */}
        {unpaidInvoices.length > 0 && (
          <div ref={unpaidInvoicesRef} className="card" style={{ marginBottom: '2rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <div className="card-header" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', color: 'white', borderRadius: '12px 12px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>⚠️ Hóa đơn chưa thanh toán ({unpaidInvoices.length})</h2>
            </div>

            <div style={{ padding: '2rem' }}>
              {unpaidInvoices.map((invoice) => (
                <div key={invoice.id} className="invoice-item" style={{
                  padding: '2rem',
                  marginBottom: '1.5rem',
                  border: '2px solid #ff6b6b',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)',
                  boxShadow: '0 8px 25px rgba(255, 107, 107, 0.15)',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: '#2d3748', fontSize: '1.3rem' }}>
                        #{invoice.invoice_number || invoice.id?.substring(0, 8)}...
                      </h3>
                      <div style={{ color: '#718096', fontSize: '0.95rem', marginBottom: '1rem' }}>
                        📅 Ngày tạo: {formatDate(invoice.created_at || invoice.issue_date)}
                      </div>
                      {getStatusBadge(invoice.payment_status)}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '150px' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e53e3e', marginBottom: '0.5rem' }}>
                        {formatCurrency(invoice.total_amount)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                        {invoice.due_date ? `Đến hạn: ${formatDate(invoice.due_date)}` : 'Không có hạn thanh toán'}
                      </div>
                    </div>
                  </div>

                  {/* Service Info */}
                  {invoice.appointment && (
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <strong style={{ color: '#2d3748' }}>🔧 Dịch vụ:</strong><br />
                          <span style={{ color: '#4a5568' }}>{invoice.appointment.service_type?.name || 'N/A'}</span>
                        </div>
                        {invoice.appointment.vehicle && (
                          <div>
                            <strong style={{ color: '#2d3748' }}>🚗 Xe:</strong><br />
                            <span style={{ color: '#4a5568' }}>{invoice.appointment.vehicle.make} {invoice.appointment.vehicle.model}</span><br />
                            <small style={{ color: '#718096' }}>{invoice.appointment.vehicle.license_plate}</small>
                          </div>
                        )}
                        {invoice.appointment.service_center && (
                          <div>
                            <strong style={{ color: '#2d3748' }}>🏢 Trung tâm:</strong><br />
                            <span style={{ color: '#4a5568' }}>{invoice.appointment.service_center.name}</span>
                          </div>
                        )}
                        {invoice.appointment.technician && (
                          <div>
                            <strong style={{ color: '#2d3748' }}>👨‍🔧 Kỹ thuật viên:</strong><br />
                            <span style={{ color: '#4a5568' }}>{invoice.appointment.technician.full_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment Methods */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                    <button
                      onClick={() => handlePaymentMethodSelect(invoice, 'vnpay')}
                      className="btn btn-primary"
                      style={{
                        padding: '1rem',
                        border: 'none',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 15px rgba(0, 160, 233, 0.3)'
                      }}
                      onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                      onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                      <div style={{ fontSize: '1.5rem' }}>💳</div>
                      VNPay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paid Invoices */}
        <div ref={paidInvoicesRef} className="card" style={{ border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', borderRadius: '16px' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)', color: 'white', borderRadius: '16px 16px 0 0' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>✅ Lịch sử thanh toán</h2>
          </div>

          {paidInvoices.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#666', background: '#f8f9fa', borderRadius: '0 0 16px 16px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
              <h3 style={{ marginBottom: '0.5rem', color: '#4a5568' }}>Chưa có hóa đơn đã thanh toán</h3>
              <p style={{ color: '#718096', marginBottom: '2rem' }}>
                Hóa đơn sẽ được hiển thị ở đây sau khi hoàn thành thanh toán
              </p>
              <button 
                onClick={() => navigate('/customer/booking')}
                className="btn btn-primary btn-large"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                📅 Đặt lịch bảo dưỡng
              </button>
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
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Dịch vụ</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Số tiền</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Trạng thái</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Ngày thanh toán</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Phương thức</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#2d3748', borderBottom: '2px solid #e2e8f0' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {paidInvoices.map((invoice, index) => (
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
                        {invoice.appointment?.service_type?.name || 'N/A'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#48bb78', borderBottom: '1px solid #e2e8f0' }}>
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td style={{ padding: '1rem', color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>
                        {formatDate(invoice.payment_date || invoice.created_at)}
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        <span className="badge badge-info" style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}>
                          {invoice.payment_method === 'vnpay' && '💳 VNPay'}
                          {invoice.payment_method === 'momo' && '📱 Momo'}
                          {invoice.payment_method === 'cash' && '💵 Tiền mặt'}
                          {!invoice.payment_method && 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                        <button
                          onClick={() => navigate(`/customer/invoice/${invoice.id}`)}
                          className="btn btn-sm btn-outline"
                          style={{
                            padding: '0.5rem 1rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
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

        {/* Empty State - No Invoices */}
        {invoices.length === 0 && (
          <div className="card" style={{
            padding: '4rem',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              fontSize: '5rem',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>🧾</div>
            <h3 style={{ marginBottom: '0.5rem', color: '#2d3748', fontSize: '1.5rem' }}>Chưa có hóa đơn nào</h3>
            <p style={{
              color: '#718096',
              marginBottom: '2rem',
              fontSize: '1rem',
              maxWidth: '400px',
              margin: '0 auto 2rem'
            }}>
              Hóa đơn sẽ được tạo tự động sau khi bạn hoàn thành dịch vụ bảo dưỡng xe
            </p>
            <button
              onClick={() => navigate('/customer/booking')}
              className="btn btn-primary btn-large"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              📅 Đặt lịch bảo dưỡng ngay
            </button>
          </div>
        )}
      </div>

      {/* Debt Details Modal */}
      {showDebtModal && (
        <div className="modal-overlay" onClick={() => setShowDebtModal(false)}>
          <div className="modal-content debt-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowDebtModal(false)}
            >
              ✕
            </button>

            <DebtDetailsModal 
              unpaidInvoices={unpaidInvoices} 
              onClose={() => setShowDebtModal(false)} 
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onPaymentClick={handlePaymentMethodSelect}
            />
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceDetail && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowInvoiceDetail(false)}>
          <div className="modal-content invoice-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowInvoiceDetail(false)}
            >
              ✕
            </button>

            <InvoiceDetailModal 
              invoice={selectedInvoice} 
              onClose={() => setShowInvoiceDetail(false)} 
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onPaymentClick={handlePaymentMethodSelect}
            />
          </div>
        </div>
      )}

      {/* VNPay Modal */}
      {showVNPayModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowVNPayModal(false)}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowVNPayModal(false)}
            >
              ✕
            </button>

            <VNPayModal 
              invoice={selectedInvoice} 
              onClose={() => setShowVNPayModal(false)} 
              onConfirm={handleVNPayConfirm}
              loading={loading}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPage;

// Invoice Detail Modal Component
const InvoiceDetailModal = ({ invoice, onClose, formatCurrency, formatDate, onPaymentClick }) => {
  const totalDebt = invoice.payment_status === 'pending' ? invoice.total_amount : 0;

  return (
    <div>
      <div className="modal-header" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        color: 'white',
        borderBottom: '2px solid #90cdf4'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>📋</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Chi tiết hóa đơn</h2>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.8 }}>
              #{invoice.invoice_number || invoice.id?.substring(0, 8)}...
            </p>
          </div>
        </div>
      </div>

      <div className="modal-body" style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Invoice Header */}
        <div style={{
          background: 'linear-gradient(135deg, #f8f9ff 0%, #e6f3ff 100%)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong style={{ color: '#2d3748' }}>📅 Ngày tạo:</strong><br />
              <span style={{ color: '#4a5568' }}>{formatDate(invoice.created_at || invoice.issue_date)}</span>
            </div>
            <div>
              <strong style={{ color: '#2d3748' }}>⏰ Hạn thanh toán:</strong><br />
              <span style={{ color: '#4a5568' }}>{invoice.due_date ? formatDate(invoice.due_date) : 'Không có hạn'}</span>
            </div>
            <div>
              <strong style={{ color: '#2d3748' }}>💰 Tổng tiền:</strong><br />
              <span style={{ color: '#2d3748', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>
            <div>
              <strong style={{ color: '#2d3748' }}>📊 Trạng thái:</strong><br />
              {getStatusBadge(invoice.payment_status)}
            </div>
          </div>
        </div>

        {/* Service Information */}
        {invoice.appointment && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: '1.3rem' }}>🔧 Thông tin dịch vụ</h3>
            <div style={{
              background: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <strong style={{ color: '#2d3748', display: 'block', marginBottom: '0.5rem' }}>Dịch vụ:</strong>
                  <span style={{ color: '#4a5568', fontSize: '1.1rem', fontWeight: '600' }}>
                    {invoice.appointment.service_type?.name || 'N/A'}
                  </span>
                </div>
                {invoice.appointment.vehicle && (
                  <div>
                    <strong style={{ color: '#2d3748', display: 'block', marginBottom: '0.5rem' }}>🚗 Thông tin xe:</strong>
                    <div style={{ color: '#4a5568' }}>
                      <div>{invoice.appointment.vehicle.make} {invoice.appointment.vehicle.model}</div>
                      <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                        Biển số: {invoice.appointment.vehicle.license_plate}
                      </div>
                      {invoice.appointment.vehicle.year && (
                        <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                          Năm: {invoice.appointment.vehicle.year}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {invoice.appointment.service_center && (
                  <div>
                    <strong style={{ color: '#2d3748', display: 'block', marginBottom: '0.5rem' }}>🏢 Trung tâm dịch vụ:</strong>
                    <div style={{ color: '#4a5568' }}>
                      <div>{invoice.appointment.service_center.name}</div>
                      {invoice.appointment.service_center.phone && (
                        <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                          📞 {invoice.appointment.service_center.phone}
                        </div>
                      )}
                      {invoice.appointment.service_center.address && (
                        <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                          📍 {invoice.appointment.service_center.address}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {invoice.appointment.technician && (
                  <div>
                    <strong style={{ color: '#2d3748', display: 'block', marginBottom: '0.5rem' }}>👨‍🔧 Kỹ thuật viên:</strong>
                    <div style={{ color: '#4a5568' }}>
                      <div>{invoice.appointment.technician.full_name}</div>
                      {invoice.appointment.technician.phone && (
                        <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                          📞 {invoice.appointment.technician.phone}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Service Records */}
        {invoice.appointment?.service_records && invoice.appointment.service_records.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: '1.3rem' }}>🔧 Chi tiết công việc</h3>
            <div style={{ background: '#f8f9fa', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {invoice.appointment.service_records.map((record, index) => (
                <div key={record.id} style={{
                  padding: '1rem',
                  borderBottom: index < invoice.appointment.service_records.length - 1 ? '1px solid #e2e8f0' : 'none',
                  background: index % 2 === 0 ? 'white' : '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#2d3748' }}>{record.description || 'Dịch vụ bảo dưỡng'}</strong>
                      {record.notes && (
                        <div style={{ fontSize: '0.9rem', color: '#718096', marginTop: '0.25rem' }}>
                          {record.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                      <div style={{ fontWeight: '600', color: '#2d3748' }}>
                        {formatCurrency(record.cost || 0)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                        {record.duration ? `${record.duration} phút` : ''}
                      </div>
                    </div>
                  </div>
                  {record.parts_used && record.parts_used.length > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#718096', fontWeight: '600' }}>Phụ tùng sử dụng:</small>
                      <div style={{ marginTop: '0.25rem' }}>
                        {record.parts_used.map((part, partIndex) => (
                          <div key={partIndex} style={{ fontSize: '0.85rem', color: '#4a5568' }}>
                            • {part.name || part.part_name} {part.quantity && `(x${part.quantity})`}
                            {part.cost && ` - ${formatCurrency(part.cost)}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Information */}
        {invoice.payment_status === 'paid' && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: '1.3rem' }}>💳 Thông tin thanh toán</h3>
            <div style={{
              background: 'linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong style={{ color: '#2d3748' }}>📅 Ngày thanh toán:</strong><br />
                  <span style={{ color: '#4a5568' }}>{formatDate(invoice.payment_date || invoice.updated_at)}</span>
                </div>
                <div>
                  <strong style={{ color: '#2d3748' }}>💳 Phương thức:</strong><br />
                  <span style={{ color: '#4a5568' }}>
                    {invoice.payment_method === 'vnpay' && '💳 VNPay'}
                
                    {!invoice.payment_method && 'N/A'}
                  </span>
                </div>
                <div>
                  <strong style={{ color: '#2d3748' }}>✅ Trạng thái:</strong><br />
                  <span style={{ color: '#48bb78', fontWeight: '600' }}>Đã thanh toán</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Actions */}
        {invoice.payment_status !== 'paid' && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: '1.3rem' }}>💰 Thanh toán</h3>
            <div style={{
              background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '2px solid #ff6b6b'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <strong style={{ color: '#c53030', fontSize: '1.1rem' }}>Số tiền cần thanh toán:</strong>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c53030' }}>
                  {formatCurrency(invoice.total_amount)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                <button
                  onClick={() => {
                    onClose();
                    onPaymentClick(invoice, 'vnpay');
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '1rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(0, 160, 233, 0.3)'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  <div style={{ fontSize: '1.5rem' }}>💳</div>
                  VNPay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-actions" style={{ 
        padding: '1rem 2rem', 
        background: '#f8f9fa', 
        borderTop: '1px solid #e2e8f0',
        display: 'flex', 
        gap: '1rem', 
        justifyContent: 'flex-end' 
      }}>
        <button
          onClick={onClose}
          className="btn btn-outline"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: 'white',
            color: '#4a5568',
            cursor: 'pointer'
          }}
        >
          ← Đóng
        </button>
        {invoice.payment_status !== 'paid' && (
          <button
            onClick={() => {
              onClose();
              onPaymentClick(invoice, 'vnpay');
            }}
            className="btn btn-primary"
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            💳 Thanh toán ngay
          </button>
        )}
      </div>
    </div>
  );
};

// Debt Details Modal Component
const DebtDetailsModal = ({ unpaidInvoices, onClose, formatCurrency, formatDate, onPaymentClick }) => {
  const totalDebt = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  return (
    <div>
      <div className="modal-header" style={{
        background: 'linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%)',
        padding: '2rem',
        color: '#2c5282',
        borderBottom: '2px solid #90cdf4'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>💰</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Chi tiết nợ cần thanh toán</h2>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.8 }}>Tổng cộng: {formatCurrency(totalDebt)}</p>
          </div>
        </div>
      </div>

      <div className="modal-body" style={{ padding: '2rem', maxHeight: '60vh', overflowY: 'auto' }}>
        {unpaidInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>🎉</div>
            <h3 style={{ marginBottom: '0.5rem', color: '#2d3748' }}>Không có nợ nào!</h3>
            <p>Tất cả hóa đơn đã được thanh toán.</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: '1.2rem' }}>
                📋 Danh sách hóa đơn chưa thanh toán ({unpaidInvoices.length})
              </h3>
              
              {unpaidInvoices.map((invoice, index) => (
                <div key={invoice.id} style={{
                  background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  marginBottom: '1rem',
                  border: '2px solid #ff6b6b',
                  boxShadow: '0 4px 15px rgba(255, 107, 107, 0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#2d3748', fontSize: '1.1rem' }}>
                        Hóa đơn #{invoice.id?.substring(0, 8)}...
                      </h4>
                      <div style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        📅 Ngày tạo: {formatDate(invoice.created_at)}
                      </div>
                      <div style={{ color: '#718096', fontSize: '0.9rem' }}>
                        🔧 Dịch vụ: {invoice.appointment?.service_type?.name || 'N/A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e53e3e', marginBottom: '0.5rem' }}>
                        {formatCurrency(invoice.total_amount)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                        Đến hạn: {formatDate(invoice.due_date)}
                      </div>
                    </div>
                  </div>

                  {/* Quick Payment Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        onClose();
                        onPaymentClick(invoice, 'vnpay');
                      }}
                      className="btn btn-sm"
                      style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                      onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                      💳 VNPay
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{
              background: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '2px solid #48bb78'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#22543d', fontSize: '1.2rem' }}>💡 Tổng kết</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22543d', marginBottom: '0.5rem' }}>
                    {unpaidInvoices.length}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#22543d' }}>Hóa đơn</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22543d', marginBottom: '0.5rem' }}>
                    {formatCurrency(totalDebt)}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#22543d' }}>Tổng tiền</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-actions" style={{ 
        padding: '1rem 2rem', 
        background: '#f8f9fa', 
        borderTop: '1px solid #e2e8f0',
        display: 'flex', 
        gap: '1rem', 
        justifyContent: 'flex-end' 
      }}>
        <button
          onClick={onClose}
          className="btn btn-outline"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: 'white',
            color: '#4a5568',
            cursor: 'pointer'
          }}
        >
          ← Đóng
        </button>
      </div>
    </div>
  );
};

// Payment Method Modals
const VNPayModal = ({ invoice, onClose, onConfirm, loading, formatCurrency }) => (
  <div>
    <div className="modal-header" style={{
      background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
      padding: '2rem',
      color: 'white'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>💳</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Thanh toán VNPay</h2>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>Thanh toán an toàn qua cổng VNPay</p>
        </div>
      </div>
    </div>

    <div className="modal-body" style={{ padding: '2rem' }}>
      {/* Invoice Summary */}
      <div style={{
        background: 'linear-gradient(135deg, #f8f9ff 0%, #e6f3ff 100%)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 1rem', color: '#2d3748', fontSize: '1.2rem' }}>📄 Thông tin hóa đơn</h3>
        <div className="info-grid" style={{ gap: '1rem' }}>
          <div className="info-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="info-label">Mã hóa đơn:</span>
            <span className="info-value" style={{ fontFamily: 'monospace', fontWeight: '600' }}>
              #{invoice.id?.substring(0, 8)}...
            </span>
          </div>
          <div className="info-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="info-label">Dịch vụ:</span>
            <span className="info-value">{invoice.appointment?.service_type?.name || 'N/A'}</span>
          </div>
          <div className="info-item" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem' }}>
            <span className="info-label" style={{ fontSize: '1.1rem', fontWeight: '600' }}>Tổng tiền:</span>
            <span className="info-value" style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#00a0e9' }}>
              {formatCurrency(invoice.total_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* VNPay Features */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem', color: '#2d3748' }}>✨ Ưu điểm thanh toán VNPay</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#2d3748' }}>Bảo mật cao</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>
              Mã hóa SSL 256-bit, bảo vệ thông tin thanh toán
            </p>
          </div>
          <div style={{
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#2d3748' }}>Thanh toán nhanh</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>
              Xử lý giao dịch trong vài giây
            </p>
          </div>
          <div style={{
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌐</div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#2d3748' }}>Nhiều phương thức</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>
              ATM, thẻ tín dụng, ví điện tử
            </p>
          </div>
        </div>
      </div>

      {/* Payment Steps */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem', color: '#2d3748' }}>📋 Hướng dẫn thanh toán</h3>
        <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ fontSize: '1.2rem', color: '#856404' }}>ℹ️</div>
            <div>
              <p style={{ margin: 0, color: '#856404', fontSize: '0.9rem' }}>
                Sau khi nhấn "Thanh toán ngay", bạn sẽ được chuyển hướng đến cổng thanh toán VNPay an toàn.
                Hãy làm theo hướng dẫn trên website VNPay để hoàn tất giao dịch.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          className="btn btn-outline"
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: 'white',
            color: '#4a5568',
            cursor: 'pointer'
          }}
        >
          ← Quay lại
        </button>
        <button
          onClick={onConfirm}
          className="btn btn-primary"
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="loading-spinner" style={{ width: '16px', height: '16px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              Đang xử lý...
            </div>
          ) : (
            '💳 Thanh toán ngay'
          )}
        </button>
      </div>
    </div>
  </div>
);

// Responsive styles
const styles = `
  @media (max-width: 768px) {
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 1rem !important;
    }
    
    .stat-card {
      padding: 1.5rem !important;
    }
    
    .stat-value {
      font-size: 2rem !important;
    }
    
    .invoice-item {
      padding: 1.5rem !important;
    }
    
    .invoice-item h3 {
      font-size: 1.1rem !important;
    }
    
    .table-responsive {
      overflow-x: auto;
    }
    
    .data-table {
      min-width: 600px;
    }
    
    .data-table th,
    .data-table td {
      padding: 0.75rem 0.5rem !important;
      font-size: 0.8rem !important;
    }
    
    .btn {
      padding: 0.75rem !important;
      font-size: 0.85rem !important;
    }
    
    .payment-modal {
      margin: 1rem !important;
      max-width: none !important;
      width: calc(100vw - 2rem) !important;
    }
    
    .debt-modal {
      margin: 1rem !important;
      max-width: none !important;
      width: calc(100vw - 2rem) !important;
    }
    
    .modal-body {
      padding: 1.5rem !important;
    }
  }
  
  @media (max-width: 480px) {
    .dashboard-grid {
      grid-template-columns: 1fr !important;
    }
    
    .hero h1 {
      font-size: 1.5rem !important;
    }
    
    .invoice-item {
      padding: 1rem !important;
    }
    
    .modal-content {
      margin: 1rem !important;
      max-width: none !important;
    }
    
    .modal-actions {
      flex-direction: column !important;
    }
    
    .modal-actions button {
      width: 100% !important;
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
