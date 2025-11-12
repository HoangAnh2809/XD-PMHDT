import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import StaffLayout from '../../components/StaffLayout';
import { paymentAPI } from '../../services/api';
import InvoiceDetailContent from '../../pages/customer/InvoiceDetailPage';

// Wrapper page that shows the existing invoice detail content and adds staff actions
const InvoiceDetailPage = () => {
  const { invoiceId } = useParams();
  const [recording, setRecording] = useState(false);
  const [vnPayLoading, setVnPayLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('cash');

  const handleCashPayment = async () => {
    try {
      setRecording(true);
      await paymentAPI.recordCashPayment(invoiceId);
      alert('✅ Đã ghi nhận thanh toán tiền mặt');
      setShowPaymentModal(false);
      // Stay on the page
    } catch (err) {
      console.error('Error recording cash payment (staff):', err);
      alert('❌ Lỗi khi ghi nhận thanh toán. Vui lòng thử lại.');
    } finally {
      setRecording(false);
    }
  };

  const handleVNPayPayment = async () => {
    try {
      setVnPayLoading(true);
      const response = await paymentAPI.createVNPayPayment(invoiceId);
      if (response.data.payment_url) {
        // Open VNPay payment URL in a new window
        window.open(response.data.payment_url, '_blank');
        alert('Đã mở trang thanh toán VNPay. Vui lòng hoàn tất thanh toán.');
        setShowPaymentModal(false);
      } else {
        alert('❌ Không thể tạo liên kết thanh toán VNPay. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error creating VNPay payment (staff):', err);
      alert('❌ Lỗi khi tạo thanh toán VNPay. Vui lòng thử lại.');
    } finally {
      setVnPayLoading(false);
    }
  };

  const handlePaymentConfirm = () => {
    if (selectedMethod === 'cash') {
      handleCashPayment();
    } else if (selectedMethod === 'vnpay') {
      handleVNPayPayment();
    }
  };

  return (
    <StaffLayout>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', right: 24, top: 80, zIndex: 20 }}>
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', borderRadius: 8 }}
          >
            💰 Thanh toán
          </button>
        </div>
        <InvoiceDetailContent />

        {/* Payment Method Modal */}
        {showPaymentModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              minWidth: '400px',
              maxWidth: '500px'
            }}>
              <h3 style={{ marginTop: 0, color: '#2d3748' }}>Chọn phương thức thanh toán</h3>
              <div style={{ margin: '1.5rem 0' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={selectedMethod === 'cash'}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span>💵 Tiền mặt</span>
                  </label>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="vnpay"
                      checked={selectedMethod === 'vnpay'}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span>💳 VNPay</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1rem', borderRadius: 8 }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handlePaymentConfirm}
                  disabled={recording || vnPayLoading}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', borderRadius: 8 }}
                >
                  {recording || vnPayLoading ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  );
};

export default InvoiceDetailPage;
