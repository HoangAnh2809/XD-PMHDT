import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import './InvoiceDetailPage.css';

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await invoiceAPI.getInvoiceById(id);
        setInvoice(response.data);
      } catch (error) {
        console.error('Error fetching invoice:', error);
      }
    };

    fetchInvoice();
  }, [id]);

  const handleBack = () => {
    navigate(-1);
  };

  if (!invoice) {
    return <div>Loading...</div>;
  }

  return (
    <div className="invoice-detail-page">
      <h1>Invoice Details</h1>
      <button onClick={handleBack}>Back</button>
      <div className="invoice-detail-content">
        <h2>Invoice ID: {invoice.id}</h2>
        <p>Date: {new Date(invoice.date).toLocaleDateString()}</p>
        <p>Customer: {invoice.customerName}</p>
        <h3>Items</h3>
        <ul>
          {invoice.items.map((item) => (
            <li key={item.id}>
              {item.name} - Quantity: {item.quantity} - Price: ${item.price}
            </li>
          ))}
        </ul>
        <h3>Total Amount: ${invoice.totalAmount}</h3>
      </div>
    </div>
  );
};

export default InvoiceDetailPage;