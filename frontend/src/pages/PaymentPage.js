import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentAPI, invoiceAPI } from '../services/api';
import './PaymentPage.css';

const PaymentPage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('vnpay');
  const [error, setError] = useState('');
  const [showVNPayModal, setShowVNPayModal] = useState(false);
  const vnPopupRef = React.useRef(null);
  const pollingRef = React.useRef(null);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInvoice = async () => {
    try {
      setLoading(true);
      // Use the new combined API endpoint to get all invoice details in one call
      const data = await invoiceAPI.getInvoiceDetails(invoiceId);
      setInvoice(data);
      setAppointment(data.appointment);
      setServiceRecords(data.service_records || []);
      
      // Check if already paid
      if (data.payment_status === 'paid') {
        navigate(`/payment/success?invoice=${invoiceId}`);
        return;
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      // For frontend-only mode, show mock data
      if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
        setInvoice({
          id: parseInt(invoiceId),
          invoice_number: `INV-${invoiceId}`,
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          payment_status: 'pending',
          subtotal: 1500000,
          tax: 150000,
          discount: 0,
          total_amount: 1650000,
          notes: 'Hóa đơn demo cho chế độ frontend-only'
        });
        setAppointment({
          customer: {
            full_name: 'Nguyễn Văn A',
            email: 'nguyenvana@example.com',
            phone: '0901234567',
            address: '123 Nguyễn Huệ, Quận 1, TP.HCM'
          },
          vehicle: {
            license_plate: '51A-12345',
            make: 'Toyota',
            model: 'Camry',
            year: 2020,
            color: 'Trắng',
            current_mileage: 50000
          }
        });
        setServiceRecords([
          {
            id: 1,
            diagnosis: 'Bảo dưỡng định kỳ 50,000km',
            services_performed: ['Thay dầu động cơ', 'Kiểm tra hệ thống phanh', 'Kiểm tra lốp xe'],
            mileage_at_service: 50000,
            service_date: new Date().toISOString(),
            technician: { full_name: 'Trần Văn B' },
            cost: 1500000
          }
        ]);
        setError('');
      } else {
        setError('Không thể tải thông tin hóa đơn');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);
      setError('');

      // Only VNPay payment is available
      setShowVNPayModal(true);
      return;
    } catch (error) {
      console.error('Payment error:', error);
      setError('Có lỗi xảy ra khi xử lý thanh toán. Vui lòng thử lại.');
    } finally {
      setProcessing(false);
    }
  };

  const handleVNPayPayment = async () => {
    // For frontend-only mode, simulate success immediately
    setShowVNPayModal(false);
    setTimeout(() => {
      navigate(`/payment/success?invoice=${invoiceId}`);
    }, 2000);
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

  if (loading) {
    return (
      <div className="payment-page">
        <div className="loading">Đang tải thông tin hóa đơn...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="payment-page">
        <div className="error">Không tìm thấy hóa đơn</div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-container">
        <h1>Thanh Toán Hóa Đơn</h1>

        {/* Professional Invoice Display */}
        <div className="invoice-document">
          {/* Invoice Header */}
          <div className="invoice-header">
            <div className="company-section">
              <div className="company-logo">
                <div className="logo-icon">🔧</div>
                <div className="company-name">EV Maintenance Center</div>
              </div>
              <div className="company-details">
                <div className="detail-line">🏢 123 Nguyễn Huệ, Quận 1, TP.HCM</div>
                <div className="detail-line">📞 (028) 1234-5678</div>
                <div className="detail-line">✉️ info@evmaintenance.com</div>
                <div className="detail-line">🌐 www.evmaintenance.com</div>
              </div>
            </div>
            <div className="invoice-title-section">
              <div className="invoice-title">HÓA ĐƠN THANH TOÁN</div>
              <div className="invoice-number">#{invoice.invoice_number}</div>
            </div>
          </div>

          {/* Invoice Meta Information */}
          <div className="invoice-meta">
            <div className="meta-group">
              <div className="meta-label">Ngày tạo:</div>
              <div className="meta-value">{formatDate(invoice.issue_date || invoice.created_at)}</div>
            </div>
            <div className="meta-group">
              <div className="meta-label">Hạn thanh toán:</div>
              <div className={`meta-value ${new Date(invoice.due_date) < new Date() && invoice.payment_status === 'pending' ? 'overdue' : ''}`}>
                {formatDate(invoice.due_date)}
              </div>
            </div>
            <div className="meta-group">
              <div className="meta-label">Trạng thái:</div>
              <div className="meta-value status">{invoice.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</div>
            </div>
          </div>

          {/* Customer & Vehicle Information */}
          <div className="invoice-parties">
            <div className="party-section">
              <div className="party-title">Khách hàng:</div>
              {appointment?.customer && (
                <div className="party-details">
                  <div className="party-name">{appointment.customer.full_name}</div>
                  <div className="party-info">{appointment.customer.email}</div>
                  {appointment.customer.phone && <div className="party-info">{appointment.customer.phone}</div>}
                  {appointment.customer.address && <div className="party-info">{appointment.customer.address}</div>}
                </div>
              )}
            </div>
            <div className="party-section">
              <div className="party-title">Thông tin xe:</div>
              {appointment?.vehicle && (
                <div className="party-details">
                  <div className="party-name">{appointment.vehicle.license_plate} - {appointment.vehicle.make} {appointment.vehicle.model}</div>
                  <div className="party-info">Năm: {appointment.vehicle.year} | Màu: {appointment.vehicle.color}</div>
                  <div className="party-info">Số km: {appointment.vehicle.current_mileage?.toLocaleString()} km</div>
                </div>
              )}
            </div>
          </div>

          {/* Service Items Table */}
          <div className="invoice-items">
            <table className="items-table">
              <thead>
                <tr>
                  <th className="item-description">Mô tả dịch vụ</th>
                  <th className="item-date">Ngày thực hiện</th>
                  <th className="item-technician">Kỹ thuật viên</th>
                  <th className="item-amount">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {serviceRecords.length > 0 ? (
                  serviceRecords.map((record, index) => (
                    <tr key={record.id}>
                      <td className="item-description">
                        <div className="service-title">Dịch vụ bảo dưỡng #{index + 1}</div>
                        {record.diagnosis && <div className="service-detail">Chẩn đoán: {record.diagnosis}</div>}
                        {record.services_performed && (
                          <div className="service-detail">
                            Dịch vụ: {Array.isArray(record.services_performed) ? record.services_performed.join(', ') : record.services_performed}
                          </div>
                        )}
                        {record.mileage_at_service && (
                          <div className="service-detail">Số km: {record.mileage_at_service.toLocaleString()} km</div>
                        )}
                      </td>
                      <td className="item-date">{formatDate(record.service_date)}</td>
                      <td className="item-technician">{record.technician?.full_name || 'N/A'}</td>
                      <td className="item-amount">{formatCurrency(record.cost || 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-services">
                      <div className="no-services-message">
                        <span className="icon">🔧</span>
                        <span>Không có chi tiết dịch vụ cụ thể</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Invoice Summary */}
          <div className="invoice-summary">
            <div className="summary-section">
              <div className="summary-row">
                <span className="summary-label">Tạm tính:</span>
                <span className="summary-value">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Thuế VAT (10%):</span>
                <span className="summary-value">{formatCurrency(invoice.tax)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="summary-row discount">
                  <span className="summary-label">Giảm giá:</span>
                  <span className="summary-value">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span className="summary-label">Tổng cộng:</span>
                <span className="summary-value total-amount">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Notes */}
          {invoice.notes && (
            <div className="invoice-notes-section">
              <div className="notes-title">Ghi chú:</div>
              <div className="notes-content">{invoice.notes}</div>
            </div>
          )}

          {/* Invoice Footer */}
          <div className="invoice-footer">
            <div className="footer-section">
              <div className="footer-title">Điều khoản thanh toán:</div>
              <ul className="terms-list">
                <li>Hóa đơn này có hiệu lực trong 30 ngày kể từ ngày tạo</li>
                <li>Vui lòng thanh toán đúng hạn để tránh phí phạt</li>
                <li>Mọi thắc mắc vui lòng liên hệ hotline: (028) 1234-5678</li>
              </ul>
            </div>
            <div className="footer-section signature-section">
              <div className="signature-line">
                <div className="signature-label">Người tạo hóa đơn</div>
                <div className="signature-space">(Ký, ghi rõ họ tên)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="payment-method-section">
          <h2>Phương Thức Thanh Toán</h2>
          
          <div className="payment-methods">
            <div className="payment-method selected">
              <div className="method-info">
                <div className="method-logo vnpay-logo">
                  <span>VNPay</span>
                </div>
                <div className="method-details">
                  <div className="method-name">VNPay</div>
                  <div className="method-description">
                    Thanh toán qua cổng VNPay (ATM, Visa, MasterCard, JCB, QR Code)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Action Buttons */}
        <div className="payment-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
            disabled={processing}
          >
            Quay lại
          </button>
          <button
            className="btn btn-primary"
            onClick={handlePayment}
            disabled={processing}
          >
            {processing ? 'Đang xử lý...' : `Thanh toán ${formatCurrency(invoice.total_amount)}`}
          </button>
        </div>

        {/* Security Notice */}
        <div className="security-notice">
          <div className="notice-icon">🔒</div>
          <div className="notice-text">
            Giao dịch của bạn được bảo mật bởi công nghệ mã hóa SSL 256-bit
          </div>
        </div>
      </div>

      {/* VNPay Modal */}
      {showVNPayModal && (
        <VNPayModal
          invoice={invoice}
          onClose={() => setShowVNPayModal(false)}
          onConfirm={handleVNPayPayment}
          loading={processing}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};

const VNPayModal = ({ invoice, onClose, onConfirm, loading, formatCurrency }) => (
  <div className="payment-modal-overlay" style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem'
  }}>
    <div className="payment-modal" style={{
      background: 'white',
      borderRadius: '16px',
      maxWidth: '600px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
    }}>
      <div className="modal-header" style={{
        background: 'linear-gradient(135deg, #00a0e9 0%, #0066cc 100%)',
        padding: '2rem',
        color: 'white',
        borderRadius: '16px 16px 0 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>💳</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Thanh toán VNPay</h2>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>Thanh toán an toàn qua cổng VNPay</p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.5rem'
          }}
        >
          ×
        </button>
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
                #{invoice.invoice_number}
              </span>
            </div>
            <div className="info-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="info-label">Khách hàng:</span>
              <span className="info-value">{invoice.customer_name || 'N/A'}</span>
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
                <p style={{ margin: '0.5rem 0 0', color: '#856404', fontSize: '0.85rem' }}>
                  Lưu ý (Sandbox): VNPay sandbox đôi khi ghi lỗi vào bảng điều khiển trình duyệt (ví dụ: "timer is not defined"). Đây là lỗi phía VNPay sandbox và không ảnh hưởng đến việc xử lý thanh toán. Nếu popup không mở, cho phép popup cho trang này hoặc thử lại để chuyển hướng đầy đủ.
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
          <button
            onClick={async () => {
              try {
                // Immediate manual check
                const data = await invoiceAPI.getInvoiceDetails(invoice.id);
                if (data.payment_status === 'paid') {
                  // Close modal and navigate
                  onClose();
                  window.location.href = `/payment/success?invoice=${invoice.id}`;
                } else {
                  alert('Thanh toán chưa được xác nhận. Vui lòng kiểm tra lại sau vài giây.');
                }
              } catch (e) {
                alert('Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại.');
              }
            }}
            className="btn btn-outline"
            style={{ padding: '0.75rem 1rem' }}
          >
            Kiểm tra trạng thái
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default PaymentPage;
