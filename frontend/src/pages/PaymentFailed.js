import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentAPI } from '../services/api';
import './PaymentResult.css';

const PaymentFailed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    handlePaymentReturn();
  }, []);

  const handlePaymentReturn = async () => {
    try {
      setLoading(true);
      
      const vnp_ResponseCode = searchParams.get('vnp_ResponseCode');
      const vnp_TxnRef = searchParams.get('vnp_TxnRef');
      const vnp_Message = searchParams.get('vnp_Message');

      // For failed payments, just display the error information
      if (vnp_ResponseCode && vnp_TxnRef) {
        setErrorInfo({
          transactionId: vnp_TxnRef,
          responseCode: vnp_ResponseCode,
          message: vnp_Message || getErrorMessage(vnp_ResponseCode)
        });
      } else {
        setErrorInfo({
          message: 'Thanh toán không thành công'
        });
      }
    } catch (error) {
      console.error('Error processing payment return:', error);
      setErrorInfo({
        message: 'Có lỗi xảy ra khi xử lý thanh toán'
      });
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code) => {
    const errorMessages = {
      '01': 'Giao dịch chưa hoàn tất',
      '02': 'Giao dịch bị lỗi',
      '04': 'Giao dịch đảo (Khách hàng đã bị trừ tiền tại Ngân hàng nhưng GD chưa thành công ở VNPAY)',
      '05': 'VNPAY đang xử lý giao dịch này (GD hoàn tiền)',
      '06': 'VNPAY đã gửi yêu cầu hoàn tiền sang Ngân hàng (GD hoàn tiền)',
      '07': 'Giao dịch bị nghi ngờ gian lận',
      '09': 'GD Hoàn trả bị từ chối',
      '10': 'Khách hàng hủy giao dịch',
      '11': 'Giao dịch hết hạn',
      '12': 'Thẻ bị khóa',
      '13': 'Quý khách nhập sai mật khẩu quá số lần quy định',
      '24': 'Khách hàng hủy giao dịch',
      '51': 'Tài khoản không đủ số dư',
      '65': 'Tài khoản vượt quá hạn mức giao dịch',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '79': 'Giao dịch vượt quá số lần cho phép',
      '99': 'Lỗi không xác định'
    };

    return errorMessages[code] || 'Thanh toán không thành công';
  };

  const handleRetry = () => {
    const invoiceId = searchParams.get('invoice');
    if (invoiceId) {
      navigate(`/payment/${invoiceId}`);
    } else {
      navigate('/invoices');
    }
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
    <div className="payment-result-page failed">
      <div className="result-container">
        <div className="error-animation">
          <div className="error-circle">
            <div className="error-icon">✕</div>
          </div>
        </div>

        <h1>Thanh Toán Không Thành Công</h1>
        <p className="subtitle">Rất tiếc, giao dịch của quý khách chưa được hoàn tất</p>

        {errorInfo && (
          <div className="payment-details error">
            <h2>Thông Tin Lỗi</h2>
            
            <div className="detail-grid">
              {errorInfo.transactionId && (
                <div className="detail-item full-width">
                  <span className="label">Mã giao dịch:</span>
                  <span className="value">{errorInfo.transactionId}</span>
                </div>
              )}
              
              {errorInfo.responseCode && (
                <div className="detail-item">
                  <span className="label">Mã lỗi:</span>
                  <span className="value error-code">{errorInfo.responseCode}</span>
                </div>
              )}
              
              <div className="detail-item full-width">
                <span className="label">Lý do:</span>
                <span className="value error-message">{errorInfo.message}</span>
              </div>
            </div>
          </div>
        )}

        <div className="error-suggestions">
          <h3>Vui lòng kiểm tra:</h3>
          <ul>
            <li>✓ Thông tin thẻ/tài khoản chính xác</li>
            <li>✓ Tài khoản có đủ số dư</li>
            <li>✓ Đường truyền Internet ổn định</li>
            <li>✓ Thẻ/tài khoản đã được kích hoạt thanh toán online</li>
          </ul>
        </div>

        <div className="result-actions">
          <button 
            className="btn btn-primary"
            onClick={handleRetry}
          >
            Thử lại
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Về trang chủ
          </button>
        </div>

        <div className="support-info">
          <p>Nếu cần hỗ trợ, vui lòng liên hệ:</p>
          <p><strong>📞 Hotline:</strong> 1900-xxxx</p>
          <p><strong>✉️ Email:</strong> support@evmaintenance.com</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
