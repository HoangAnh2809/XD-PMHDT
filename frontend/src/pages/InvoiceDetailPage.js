import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import './InvoiceDetailPage.css';

const InvoiceDetailPage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoiceDetail();
  }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInvoiceDetail = async () => {
    try {
      setLoading(true);
      const data = await invoiceAPI.getInvoice(invoiceId);
      setInvoice(data);
    } catch (err) {
      console.error('Error loading invoice detail:', err);
      setError('Không thể tải chi tiết hóa đơn');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    navigate(`/payment/${invoiceId}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real application, this would generate and download a PDF
    alert('Tính năng tải PDF đang được phát triển');
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
      <div className="invoice-detail-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Đang tải chi tiết hóa đơn...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="invoice-detail-page">
        <div className="error-container">
          <div className="error-icon">❌</div>
          <h2>Không tìm thấy hóa đơn</h2>
          <p>Hóa đơn này có thể không tồn tại hoặc bạn không có quyền truy cập.</p>
          <button className="btn btn-primary" onClick={() => navigate('/invoices')}>
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-detail-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>📄 Chi Tiết Hóa Đơn</h1>
          <p>Hóa đơn #{invoice.invoice_number}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handlePrint}>
            🖨️ In hóa đơn
          </button>
          <button className="btn btn-outline" onClick={handleDownload}>
            📥 Tải PDF
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/invoices')}>
            ← Quay lại
          </button>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="invoice-content">
        {/* Invoice Header */}
        <div className="invoice-header-section">
          <div className="company-info">
            <h2>EV Maintenance Center</h2>
            <p>123 Nguyễn Huệ, Quận 1, TP.HCM</p>
            <p>📞 (028) 1234-5678 | ✉️ info@evmaintenance.com</p>
          </div>
          <div className="invoice-info">
            <h1>HÓA ĐƠN</h1>
            <div className="invoice-meta">
              <div className="meta-item">
                <span className="label">Số hóa đơn:</span>
                <span className="value">{invoice.invoice_number}</span>
              </div>
              <div className="meta-item">
                <span className="label">Ngày tạo:</span>
                <span className="value">{formatDate(invoice.issue_date || invoice.created_at)}</span>
              </div>
              <div className="meta-item">
                <span className="label">Hạn thanh toán:</span>
                <span className={`value ${new Date(invoice.due_date) < new Date() && invoice.payment_status === 'pending' ? 'overdue' : ''}`}>
                  {formatDate(invoice.due_date)}
                </span>
              </div>
              <div className="meta-item">
                <span className="label">Trạng thái:</span>
                {getStatusBadge(invoice.payment_status, invoice.due_date)}
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Service Info */}
        <div className="info-section">
          <div className="customer-info">
            <h3>Thông Tin Khách Hàng</h3>
            {invoice.appointment?.customer ? (
              <div className="info-details">
                <p><strong>Tên:</strong> {invoice.appointment.customer.full_name}</p>
                <p><strong>Email:</strong> {invoice.appointment.customer.email}</p>
                {invoice.appointment.customer.phone && (
                  <p><strong>SĐT:</strong> {invoice.appointment.customer.phone}</p>
                )}
                {invoice.appointment.customer.address && (
                  <p><strong>Địa chỉ:</strong> {invoice.appointment.customer.address}</p>
                )}
              </div>
            ) : (
              <p>Thông tin khách hàng không có sẵn</p>
            )}
          </div>

          <div className="service-info">
            <h3>Thông Tin Dịch Vụ</h3>
            {invoice.appointment ? (
              <div className="info-details">
                <p><strong>Mã lịch hẹn:</strong> #{invoice.appointment.id}</p>
                <p><strong>Ngày hẹn:</strong> {formatDate(invoice.appointment.appointment_date)}</p>
                <p><strong>Trạng thái:</strong> {invoice.appointment.status}</p>
                {invoice.appointment.notes && (
                  <p><strong>Ghi chú:</strong> {invoice.appointment.notes}</p>
                )}
              </div>
            ) : (
              <p>Thông tin lịch hẹn không có sẵn</p>
            )}
          </div>
        </div>

        {/* Invoice Items */}
        <div className="items-section">
          <h3>Chi Tiết Dịch Vụ</h3>
          <table className="invoice-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Dịch vụ</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {/* In a real application, this would come from service records */}
              <tr>
                <td>1</td>
                <td>Bảo dưỡng định kỳ xe điện</td>
                <td>1</td>
                <td>{formatCurrency(invoice.subtotal)}</td>
                <td>{formatCurrency(invoice.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Invoice Summary */}
        <div className="summary-section">
          <div className="summary-details">
            <div className="summary-row">
              <span className="label">Tạm tính:</span>
              <span className="value">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Thuế VAT (10%):</span>
              <span className="value">{formatCurrency(invoice.tax)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="summary-row discount">
                <span className="label">Giảm giá:</span>
                <span className="value">-{formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span className="label">Tổng cộng:</span>
              <span className="value">{formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        {invoice.payment_status === 'paid' && (
          <div className="payment-info-section">
            <h3>Thông Tin Thanh Toán</h3>
            <div className="payment-details">
              <div className="payment-row">
                <span className="label">Phương thức thanh toán:</span>
                <span className="value">{getPaymentMethodText(invoice.payment_method)}</span>
              </div>
              <div className="payment-row">
                <span className="label">Ngày thanh toán:</span>
                <span className="value">{formatDate(invoice.payment_date)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="notes-section">
            <h3>Ghi Chú</h3>
            <p>{invoice.notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-section">
          {invoice.payment_status === 'pending' && (
            <button className="btn btn-primary" onClick={handlePayment}>
              💳 Thanh toán ngay
            </button>
          )}

          {invoice.payment_status === 'paid' && (
            <div className="paid-notice">
              <span className="paid-icon">✅</span>
              <span>Hóa đơn đã được thanh toán</span>
            </div>
          )}

          <button className="btn btn-outline" onClick={() => navigate('/invoices')}>
            ← Quay lại danh sách
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailPage;