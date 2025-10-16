import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentAPI, invoiceAPI } from '../services/api';
import './PaymentPage.css';

const PaymentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await invoiceAPI.getInvoiceById(id);
        setInvoice(response.data);
        setAmount(response.data.amount);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      await paymentAPI.processPayment({ id, amount, paymentMethod });
      alert('Payment successful!');
      navigate('/success');
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="payment-page">
      <h1>Payment</h1>
      <div className="invoice-details">
        <h2>Invoice ID: {invoice.id}</h2>
        <p>Amount: ${amount}</p>
      </div>
      <div className="payment-methods">
        <h3>Select Payment Method</h3>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="">--Choose a method--</option>
          <option value="credit_card">Credit Card</option>
          <option value="paypal">PayPal</option>
        </select>
      </div>
      <button onClick={handlePayment} disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
};

export default PaymentPage;