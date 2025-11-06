import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { paymentAPI } from '../../services/api';

const InvoiceDetailPage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInvoiceDetail();
  }, [invoiceId]);

  const loadInvoiceDetail = async () => {
    try {
      setLoading(true);
      const response = await paymentAPI.getInvoiceDetail(invoiceId);
      setInvoice(response.data);
    } catch (error) {
      console.error('Error loading invoice detail:', error);
      setError('Không thể tải chi tiết hóa đơn. Vui lòng thử lại.');
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

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: 'Chờ thanh toán', class: 'badge-warning' },
      'paid': { label: 'Đã thanh toán', class: 'badge-success' },
      'failed': { label: 'Thanh toán thất bại', class: 'badge-danger' },
      'cancelled': { label: 'Đã hủy', class: 'badge-secondary' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'badge-secondary' };
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="loading">Đang tải chi tiết hóa đơn...</div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="alert alert-error">
            {error || 'Không tìm thấy hóa đơn'}
          </div>
          <button
            onClick={() => navigate('/customer/payment')}
            className="btn btn-primary"
          >
            ← Quay lại danh sách hóa đơn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />

      <div className="hero" style={{ padding: '2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <h1 style={{ color: 'white', marginBottom: '0.5rem' }}>📄 Chi tiết hóa đơn</h1>
        <p style={{ color: 'white', opacity: 0.9, margin: 0 }}>
          {invoice.invoice_number}
        </p>
      </div>

      <div className="container">
        {/* Navigation */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/customer/payment')}
            className="btn btn-outline"
            style={{ marginRight: '1rem' }}
          >
            ← Quay lại danh sách
          </button>
          {invoice.payment_status === 'pending' && (
            <button
              onClick={() => navigate('/customer/payment')}
              className="btn btn-primary"
            >
              💳 Thanh toán ngay
            </button>
          )}
        </div>

        {/* Invoice Header */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>🧾 Thông tin hóa đơn</h2>
              {getStatusBadge(invoice.payment_status)}
            </div>
          </div>

          <div style={{ padding: '2rem' }}>
            <div className="info-grid" style={{ marginBottom: '2rem' }}>
              <div className="info-item">
                <span className="info-label">Mã hóa đơn:</span>
                <span className="info-value" style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                  {invoice.invoice_number}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Ngày tạo:</span>
                <span className="info-value">{formatDate(invoice.issue_date || invoice.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Ngày đến hạn:</span>
                <span className="info-value">{formatDate(invoice.due_date)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Trạng thái:</span>
                <span className="info-value">{getStatusBadge(invoice.payment_status)}</span>
              </div>
            </div>

            {invoice.notes && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <strong>📝 Ghi chú:</strong> {invoice.notes}
              </div>
            )}
          </div>
        </div>

        {/* Service Information */}
        {invoice.appointment && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <h2>🔧 Thông tin dịch vụ</h2>
            </div>

            <div style={{ padding: '2rem' }}>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Dịch vụ:</span>
                  <span className="info-value">{invoice.appointment.service_type?.name || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Ngày hẹn:</span>
                  <span className="info-value">{formatDate(invoice.appointment.appointment_date)}</span>
                </div>
                {invoice.appointment.vehicle && (
                  <>
                    <div className="info-item">
                      <span className="info-label">Xe:</span>
                      <span className="info-value">
                        {invoice.appointment.vehicle.make} {invoice.appointment.vehicle.model}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Biển số:</span>
                      <span className="info-value">{invoice.appointment.vehicle.license_plate}</span>
                    </div>
                  </>
                )}
                {invoice.appointment.service_center && (
                  <div className="info-item">
                    <span className="info-label">Trung tâm:</span>
                    <span className="info-value">{invoice.appointment.service_center.name}</span>
                  </div>
                )}
                {invoice.appointment.technician && (
                  <div className="info-item">
                    <span className="info-label">Kỹ thuật viên:</span>
                    <span className="info-value">{invoice.appointment.technician.user?.full_name || 'N/A'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Breakdown */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h2>💰 Chi tiết thanh toán</h2>
          </div>

          <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
                <span>Tiền dịch vụ:</span>
                <span style={{ fontWeight: '500' }}>{formatCurrency(invoice.subtotal)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
                <span>Thuế VAT (10%):</span>
                <span style={{ fontWeight: '500' }}>{formatCurrency(invoice.tax)}</span>
              </div>

              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #eee', color: '#48bb78' }}>
                  <span>Giảm giá:</span>
                  <span style={{ fontWeight: '500' }}>-{formatCurrency(invoice.discount)}</span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1rem 0',
                borderTop: '2px solid #1a1a2e',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: '#d63031'
              }}>
                <span>Tổng cộng:</span>
                <span>{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        {invoice.payment_status === 'paid' && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <h2>✅ Thông tin thanh toán</h2>
            </div>

            <div style={{ padding: '2rem' }}>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Phương thức:</span>
                  <span className="info-value">
                    <span className="badge badge-info">
                      {invoice.payment_method === 'vnpay' && '💳 VNPay'}
                      {invoice.payment_method === 'momo' && '📱 Momo'}
                      {invoice.payment_method === 'cash' && '💵 Tiền mặt'}
                      {!invoice.payment_method && 'N/A'}
                    </span>
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Ngày thanh toán:</span>
                  <span className="info-value">{formatDate(invoice.payment_date)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <button
            onClick={() => navigate('/customer/payment')}
            className="btn btn-outline btn-large"
            style={{ marginRight: '1rem' }}
          >
            ← Quay lại danh sách
          </button>

          {invoice.payment_status === 'pending' && (
            <button
              onClick={() => navigate('/customer/payment')}
              className="btn btn-primary btn-large"
            >
              💳 Thanh toán ngay
            </button>
          )}

          {invoice.payment_status === 'paid' && (
            <button
              onClick={() => window.print()}
              className="btn btn-secondary btn-large"
            >
              🖨️ In hóa đơn
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailPage;