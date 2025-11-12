import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentAPI, invoiceAPI } from '../services/api';
import './PaymentResult.css';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    handlePaymentReturn();
  }, []);

  const handlePaymentReturn = async () => {
    try {
      setLoading(true);
      
      // Get payment result from URL params
      const vnp_ResponseCode = searchParams.get('vnp_ResponseCode');
      const vnp_TxnRef = searchParams.get('vnp_TxnRef');
      const invoiceId = searchParams.get('invoice');
      
      // If VNPay callback
      if (vnp_ResponseCode && vnp_TxnRef) {
        // For VNPay, just check the response code from URL
        if (vnp_ResponseCode === '00') {
          // Payment successful - get invoice details
          const invoiceData = await invoiceAPI.getInvoice(invoiceId || vnp_TxnRef.split('-')[0]);
          setInvoice(invoiceData);
          setPaymentInfo({
            transactionId: vnp_TxnRef,
            responseCode: vnp_ResponseCode,
            method: 'VNPay'
          });
        } else {
          // Payment failed - redirect to failed page
          navigate(`/payment/failed?vnp_ResponseCode=${vnp_ResponseCode}&vnp_TxnRef=${vnp_TxnRef}`);
          return;
        }
      } else if (invoiceId) {
        // Direct access with invoice ID
        const invoiceData = await invoiceAPI.getInvoice(invoiceId);
        setInvoice(invoiceData);
        setPaymentInfo({
          method: invoiceData.payment_method || 'Cash'
        });
      } else {
        // No valid parameters - redirect to home or show error
        navigate('/');
        return;
      }
    } catch (error) {
      console.error('Error processing payment return:', error);
      setError('Không thể tải thông tin hóa đơn. Vui lòng liên hệ hỗ trợ nếu thanh toán đã được thực hiện.');
      
      // If there's an error, try to get invoice from URL param
      const invoiceId = searchParams.get('invoice');
      if (invoiceId) {
        try {
          const invoiceData = await invoiceAPI.getInvoice(invoiceId);
          setInvoice(invoiceData);
          setPaymentInfo({
            method: 'Unknown'
          });
          setError(null); // Clear error if we successfully loaded invoice
        } catch (e) {
          console.error('Could not load invoice:', e);
          // Keep the error message
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount) || amount === 0) {
      return 'Chưa xác định';
    }
    
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="payment-result-page">
        <div className="result-container">
          <div className="loading-spinner"></div>
          <p>Đang xử lý kết quả thanh toán...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page success">
      <div className="result-container">
        <div className="success-animation">
          <div className="checkmark-circle">
            <div className="checkmark"></div>
          </div>
        </div>

        <h1>Thanh Toán Thành Công!</h1>
        <p className="subtitle">Cảm ơn quý khách đã sử dụng dịch vụ của chúng tôi</p>

        {error && (
          <div className="error-message" style={{ 
            backgroundColor: '#fee', 
            color: '#c33', 
            padding: '1rem', 
            borderRadius: '4px', 
            marginBottom: '1rem',
            border: '1px solid #fcc'
          }}>
            <strong>Lưu ý:</strong> {error}
          </div>
        )}

        {invoice && (
          <div className="payment-details">
            <h2>Thông Tin Thanh Toán</h2>
            
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">Số hóa đơn:</span>
                <span className="value">{invoice.invoice_number || 'Chưa có'}</span>
              </div>
              
              <div className="detail-item">
                <span className="label">Số tiền:</span>
                <span className="value amount">
                  {formatCurrency(invoice.total_amount)}
                  {invoice.total_amount === null || invoice.total_amount === undefined || isNaN(invoice.total_amount) || invoice.total_amount === 0 ? (
                    <small style={{ color: '#666', display: 'block', fontSize: '0.8em' }}>
                      (Vui lòng kiểm tra hóa đơn để biết số tiền chính xác)
                    </small>
                  ) : null}
                </span>
              </div>
              
              <div className="detail-item">
                <span className="label">Phương thức:</span>
                <span className="value">
                  {paymentInfo?.method === 'VNPay' && 'VNPay'}
                  {paymentInfo?.method === 'Momo' && 'Ví MoMo'}
                  {paymentInfo?.method === 'Cash' && 'Tiền mặt'}
                  {paymentInfo?.method === 'vnpay' && 'VNPay'}
                  {paymentInfo?.method === 'momo' && 'Ví MoMo'}
                  {paymentInfo?.method === 'cash' && 'Tiền mặt'}
                  {(!paymentInfo?.method || paymentInfo?.method === 'Unknown') && (invoice?.payment_method || 'Chưa xác định')}
                </span>
              </div>
              
              <div className="detail-item">
                <span className="label">Thời gian:</span>
                <span className="value">{formatDate(invoice.payment_date || new Date())}</span>
              </div>

              {paymentInfo?.transactionId && (
                <div className="detail-item full-width">
                  <span className="label">Mã giao dịch:</span>
                  <span className="value transaction-id">{paymentInfo.transactionId}</span>
                </div>
              )}
            </div>

            {/* Payment Breakdown */}
            {(invoice.subtotal || invoice.tax || invoice.discount) && (
              <div className="payment-breakdown">
                <h3>Chi Tiết Thanh Toán</h3>
                <div className="breakdown-grid">
                  {invoice.subtotal && (
                    <div className="breakdown-item">
                      <span className="label">Tiền dịch vụ:</span>
                      <span className="value">{formatCurrency(invoice.subtotal)}</span>
                    </div>
                  )}
                  {invoice.tax && invoice.tax > 0 && (
                    <div className="breakdown-item">
                      <span className="label">Thuế VAT (10%):</span>
                      <span className="value">{formatCurrency(invoice.tax)}</span>
                    </div>
                  )}
                  {invoice.discount && invoice.discount > 0 && (
                    <div className="breakdown-item">
                      <span className="label">Giảm giá:</span>
                      <span className="value">-{formatCurrency(invoice.discount)}</span>
                    </div>
                  )}
                  <div className="breakdown-item total">
                    <span className="label">Tổng cộng:</span>
                    <span className="value">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Information */}
            {invoice.appointment?.customer && (
              <div className="customer-info">
                <h3>Thông Tin Khách Hàng</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Họ tên:</span>
                    <span className="value">{invoice.appointment.customer.full_name || 'N/A'}</span>
                  </div>
                  {invoice.appointment.customer.phone && (
                    <div className="info-item">
                      <span className="label">Số điện thoại:</span>
                      <span className="value">{invoice.appointment.customer.phone}</span>
                    </div>
                  )}
                  {invoice.appointment.customer.email && (
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span className="value">{invoice.appointment.customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vehicle Information */}
            {invoice.appointment?.vehicle && (
              <div className="vehicle-info">
                <h3>Thông Tin Xe</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Biển số:</span>
                    <span className="value">{invoice.appointment.vehicle.license_plate || 'N/A'}</span>
                  </div>
                  {(invoice.appointment.vehicle.make || invoice.appointment.vehicle.model) && (
                    <div className="info-item">
                      <span className="label">Hãng xe:</span>
                      <span className="value">
                        {invoice.appointment.vehicle.make || ''} {invoice.appointment.vehicle.model || ''}
                      </span>
                    </div>
                  )}
                  {invoice.appointment.vehicle.year && (
                    <div className="info-item">
                      <span className="label">Năm sản xuất:</span>
                      <span className="value">{invoice.appointment.vehicle.year}</span>
                    </div>
                  )}
                  {invoice.appointment.vehicle.current_mileage && (
                    <div className="info-item">
                      <span className="label">Số km hiện tại:</span>
                      <span className="value">{invoice.appointment.vehicle.current_mileage.toLocaleString()} km</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service Information */}
            {invoice.appointment && (
              <div className="service-info">
                <h3>Thông Tin Dịch Vụ</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Ngày hẹn:</span>
                    <span className="value">
                      {invoice.appointment.appointment_date ? 
                        new Date(invoice.appointment.appointment_date).toLocaleDateString('vi-VN') : 
                        'N/A'
                      }
                    </span>
                  </div>
                  {invoice.appointment.status && (
                    <div className="info-item">
                      <span className="label">Trạng thái:</span>
                      <span className="value">
                        {invoice.appointment.status === 'completed' && 'Hoàn thành'}
                        {invoice.appointment.status === 'in_progress' && 'Đang thực hiện'}
                        {invoice.appointment.status === 'scheduled' && 'Đã lên lịch'}
                        {invoice.appointment.status === 'cancelled' && 'Đã hủy'}
                        {!['completed', 'in_progress', 'scheduled', 'cancelled'].includes(invoice.appointment.status) && invoice.appointment.status}
                      </span>
                    </div>
                  )}
                  {invoice.appointment.technician?.full_name && (
                    <div className="info-item">
                      <span className="label">Kỹ thuật viên:</span>
                      <span className="value">{invoice.appointment.technician.full_name}</span>
                    </div>
                  )}
                  {invoice.appointment.service_center?.name && (
                    <div className="info-item">
                      <span className="label">Trung tâm dịch vụ:</span>
                      <span className="value">{invoice.appointment.service_center.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service Records */}
            {invoice.service_records && invoice.service_records.length > 0 && (
              <div className="service-records">
                <h3>Dịch Vụ Đã Thực Hiện</h3>
                {invoice.service_records.map((record, index) => (
                  <div key={record.id || index} className="service-record">
                    <div className="record-header">
                      <span className="record-date">
                        {record.service_date ? 
                          new Date(record.service_date).toLocaleDateString('vi-VN') : 
                          'N/A'
                        }
                      </span>
                      {record.cost && (
                        <span className="record-cost">{formatCurrency(record.cost)}</span>
                      )}
                    </div>
                    {record.services_performed && (
                      <div className="record-services">
                        <strong>Dịch vụ:</strong> {Array.isArray(record.services_performed) ? 
                          record.services_performed.join(', ') : 
                          record.services_performed
                        }
                      </div>
                    )}
                    {record.diagnosis && (
                      <div className="record-diagnosis">
                        <strong>Chẩn đoán:</strong> {record.diagnosis}
                      </div>
                    )}
                    {record.technician?.full_name && (
                      <div className="record-technician">
                        <strong>Kỹ thuật viên:</strong> {record.technician.full_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="result-actions">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/invoices')}
          >
            Xem hóa đơn
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Về trang chủ
          </button>
        </div>

        <div className="support-info">
          <p>Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ:</p>
          <p><strong>📞 Hotline:</strong> 1900-xxxx</p>
          <p><strong>✉️ Email:</strong> support@evmaintenance.com</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
