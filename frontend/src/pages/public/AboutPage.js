import React from 'react';
import Navbar from '../../components/Navbar';

const AboutPage = () => {
  return (
    <div>
      <Navbar />
      
      <div className="hero">
        <h1>Về chúng tôi</h1>
        <p>Đơn vị hàng đầu trong lĩnh vực bảo dưỡng và sửa chữa xe điện</p>
      </div>

      <div className="container">
        <div className="card" style={{marginTop: '2rem'}}>
          <h2>Giới thiệu</h2>
          <p style={{lineHeight: '1.8', marginTop: '1rem'}}>
            EV Maintenance là hệ thống quản lý bảo dưỡng xe điện hàng đầu tại Việt Nam. 
            Chúng tôi cung cấp giải pháp toàn diện cho việc bảo dưỡng, sửa chữa và quản lý 
            xe điện với đội ngũ kỹ thuật viên được đào tạo chuyên nghiệp và trang thiết bị hiện đại.
          </p>
        </div>

        <div className="card">
          <h2>Sứ mệnh</h2>
          <p style={{lineHeight: '1.8', marginTop: '1rem'}}>
            Mang đến trải nghiệm dịch vụ bảo dưỡng xe điện tốt nhất cho khách hàng 
            thông qua công nghệ hiện đại, quy trình chuyên nghiệp và đội ngũ nhân viên tận tâm.
          </p>
        </div>

        <div className="card">
          <h2>Giá trị cốt lõi</h2>
          <ul style={{lineHeight: '2', marginTop: '1rem'}}>
            <li>🎯 <strong>Chất lượng:</strong> Cam kết cung cấp dịch vụ chất lượng cao nhất</li>
            <li>⚡ <strong>Nhanh chóng:</strong> Thời gian xử lý nhanh, hiệu quả</li>
            <li>💰 <strong>Minh bạch:</strong> Giá cả rõ ràng, không phát sinh</li>
            <li>🤝 <strong>Tận tâm:</strong> Luôn lắng nghe và phục vụ khách hàng</li>
            <li>🔧 <strong>Chuyên nghiệp:</strong> Đội ngũ kỹ thuật viên có chứng chỉ</li>
          </ul>
        </div>

        <div className="card">
          <h2>Đội ngũ của chúng tôi</h2>
          <p style={{lineHeight: '1.8', marginTop: '1rem'}}>
            Chúng tôi tự hào có đội ngũ hơn 50 kỹ thuật viên được đào tạo bài bản, 
            có chứng chỉ chuyên môn về xe điện từ các nhà sản xuất hàng đầu. 
            Đội ngũ nhân viên tư vấn nhiệt tình, am hiểu sản phẩm sẵn sàng hỗ trợ khách hàng 24/7.
          </p>
        </div>

        <div className="card" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'}}>
          <h2>Liên hệ với chúng tôi</h2>
          <p style={{marginTop: '1rem'}}>
            📍 Địa chỉ: 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh
          </p>
          <p>📞 Hotline: 0283-123-456</p>
          <p>📧 Email: support@evmaintenance.com</p>
          <p>⏰ Giờ làm việc: Thứ 2 - Thứ 6: 8:00 - 18:00, Thứ 7: 8:00 - 16:00</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
