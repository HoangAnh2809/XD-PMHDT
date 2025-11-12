import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceAPI } from '../services/api';

const TechnicianInvoiceButton = ({ appointmentId, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const createInvoice = async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      setMessage('');
      const res = await invoiceAPI.generateInvoiceForAppointment(appointmentId);
      // API returns invoice in res.data
      const data = res.data || res;
      setInvoice(data);
      setMessage('Hóa đơn đã được tạo');
      if (onCreated) onCreated(data);
    } catch (err) {
      console.error('Error creating invoice:', err);
      setMessage(err.response?.data?.detail || 'Lỗi khi tạo hóa đơn');
    } finally {
      setLoading(false);
    }
  };
  
  const [invoice, setInvoice] = useState(null);
  
  // When appointmentId missing, show a helpful disabled button and link
  if (!appointmentId) {
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button className="btn btn-outline-primary" disabled title="Không tìm thấy appointment_id">
          📄 Tạo hóa đơn
        </button>
        <div style={{ marginTop: '0.5rem', color: '#666' }}>
          Không tìm thấy appointment_id cho công việc này. Bạn có thể tạo hóa đơn thủ công:
          <div style={{ marginTop: '0.25rem' }}>
            <Link to="/technician/invoices/create">Mở trang Tạo hóa đơn</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{marginTop: '0.5rem'}}>
      <button className="btn btn-outline-primary" onClick={createInvoice} disabled={loading}>
        {loading ? 'Đang tạo...' : '📄 Tạo hóa đơn'}
      </button>
      {message && <div style={{marginTop: '0.5rem', color: '#666'}}>{message}</div>}
      {invoice && invoice.id && (
        <div style={{ marginTop: '0.5rem' }}>
          <Link to={`/payment/${invoice.id}`}>Mở hóa đơn #{invoice.id}</Link>
        </div>
      )}
    </div>
  );
};

export default TechnicianInvoiceButton;
