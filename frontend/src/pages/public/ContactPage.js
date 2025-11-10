import React, { useState } from 'react';
import Navbar from '../../components/Navbar';

const ContactPage = () => {
  // Redirect handled by PublicRoute wrapper

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In production, send to backend
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });
    }, 3000);
  };

  return (
    <div>
      <Navbar />
      
      <div className="hero">
        <h1>Liên hệ với chúng tôi</h1>
        <p>Chúng tôi luôn sẵn sàng hỗ trợ bạn</p>
      </div>

      <div className="container">
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem'}}>
          <div className="card">
            <h2>Gửi tin nhắn</h2>
            
            {submitted && (
              <div className="alert alert-success">
                Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong thời gian sớm nhất.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Họ và tên *</label>
                <input
                  type="text"
                  name="name"
                  className="form-control"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  name="subject"
                  className="form-control"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nội dung *</label>
                <textarea
                  name="message"
                  className="form-control"
                  rows="5"
                  value={formData.message}
                  onChange={handleChange}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Gửi tin nhắn
              </button>
            </form>
          </div>

          <div>
            <div className="card">
              <h2>Thông tin liên hệ</h2>
              <div style={{marginTop: '1.5rem'}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '0.5rem'}}>📍 Địa chỉ</h3>
                <p style={{color: '#666'}}>123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh</p>
              </div>
              <div style={{marginTop: '1.5rem'}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '0.5rem'}}>📞 Hotline</h3>
                <p style={{color: '#666'}}>0283-123-456</p>
              </div>
              <div style={{marginTop: '1.5rem'}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '0.5rem'}}>📧 Email</h3>
                <p style={{color: '#666'}}>support@evmaintenance.com</p>
              </div>
              <div style={{marginTop: '1.5rem'}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '0.5rem'}}>⏰ Giờ làm việc</h3>
                <p style={{color: '#666'}}>
                  Thứ 2 - Thứ 6: 8:00 - 18:00<br/>
                  Thứ 7: 8:00 - 16:00<br/>
                  Chủ nhật: Nghỉ
                </p>
              </div>
            </div>

            <div className="card" style={{marginTop: '1rem', background: '#f8f9fa'}}>
              <h3>Hỗ trợ khẩn cấp 24/7</h3>
              <p style={{marginTop: '1rem', color: '#666'}}>
                Nếu bạn cần hỗ trợ khẩn cấp ngoài giờ làm việc, vui lòng gọi số:
              </p>
              <p style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#dc3545', marginTop: '0.5rem'}}>
                1900-xxxx
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
