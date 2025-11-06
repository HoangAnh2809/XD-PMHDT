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
      // If there's an error, try to get invoice from URL param
      const invoiceId = searchParams.get('invoice');
      if (invoiceId) {
        try {
          const invoiceData = await invoiceAPI.getInvoice(invoiceId);
          setInvoice(invoiceData);
          setPaymentInfo({
            method: 'Unknown'
          });
        } catch (e) {
          console.error('Could not load invoice:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
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

        {invoice && (
          <div className="payment-details">
            <h2>Thông Tin Thanh Toán</h2>
            
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">Số hóa đơn:</span>
                <span className="value">{invoice.invoice_number}</span>
              </div>
              
              <div className="detail-item">
                <span className="label">Số tiền:</span>
                <span className="value amount">{formatCurrency(invoice.total_amount)}</span>
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
