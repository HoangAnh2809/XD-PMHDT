import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect handled by PublicRoute wrapper
  
  const features = [
    {
      icon: '📅',
      title: 'Đặt lịch trực tuyến',
      description: 'Đặt lịch bảo dưỡng và sửa chữa dễ dàng, nhanh chóng qua hệ thống online 24/7.'
    },
    {
      icon: '🔔',
      title: 'Nhắc nhở thông minh',
      description: 'Nhận thông báo tự động nhắc nhở bảo dưỡng định kỳ theo km hoặc thời gian.'
    },
    {
      icon: '📊',
      title: 'Theo dõi lịch sử',
      description: 'Quản lý đầy đủ lịch sử bảo dưỡng, sửa chữa và chi phí của từng xe.'
    },
    {
      icon: '💳',
      title: 'Thanh toán online',
      description: 'Hỗ trợ thanh toán qua VNPay, Momo và nhiều phương thức tiện lợi khác.'
    },
    {
      icon: '👨‍🔧',
      title: 'Kỹ thuật viên chuyên nghiệp',
      description: 'Đội ngũ được đào tạo bài bản với chứng chỉ quốc tế về xe điện.'
    },
    {
      icon: '🛡️',
      title: 'Bảo hành chính hãng',
      description: 'Cam kết bảo hành dịch vụ và phụ tùng chính hãng với chất lượng tốt nhất.'
    }
  ];

  const testimonials = [
    {
      name: 'Nguyễn Văn An',
      role: 'Chủ xe VinFast VF8',
      avatar: '👨‍💼',
      content: 'Dịch vụ rất chuyên nghiệp, kỹ thuật viên nhiệt tình. Xe sau khi bảo dưỡng chạy êm ái hơn hẳn. Tôi rất hài lòng!',
      rating: 5
    },
    {
      name: 'Trần Thị Bình',
      role: 'Chủ xe Tesla Model 3',
      avatar: '👩‍💼',
      content: 'Hệ thống đặt lịch online rất tiện lợi, giá cả minh bạch. Trung tâm sạch sẽ, hiện đại. Tôi sẽ giới thiệu cho bạn bè.',
      rating: 5
    },
    {
      name: 'Lê Minh Cường',
      role: 'Chủ xe Hyundai Kona EV',
      avatar: '👨',
      content: 'Đội ngũ tư vấn nhiệt tình, giải thích rõ ràng về tình trạng xe. Giá dịch vụ hợp lý, chất lượng tốt.',
      rating: 5
    }
  ];

  const popularServices = [
    {
      title: 'Bảo dưỡng định kỳ',
      price: '2,000,000 VNĐ',
      image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=250&fit=crop'
    },
    {
      title: 'Kiểm tra Pin',
      price: '500,000 VNĐ',
      image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=400&h=250&fit=crop'
    },
    {
      title: 'Sửa chữa Khẩn cấp',
      price: '1,500,000 VNĐ',
      image: 'https://images.unsplash.com/photo-1632823469662-70740d49f9e9?w=400&h=250&fit=crop'
    }
  ];

  return (
    <div>
      <Navbar />
      
      {/* Hero Section */}
      <section className="hero-modern">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            Hệ thống quản lý bảo dưỡng<br />
            <span className="highlight">xe điện</span> hàng đầu Việt Nam
          </h1>
          <p className="hero-subtitle">
            Giải pháp toàn diện cho việc bảo dưỡng và sửa chữa xe điện của bạn.<br />
            Chuyên nghiệp - Nhanh chóng - Uy tín
          </p>
          <div className="hero-buttons">
            <button 
              onClick={() => navigate(user ? '/customer/dashboard' : '/register')} 
              className="btn btn-primary btn-large"
            >
              {user ? 'Vào Dashboard' : 'Đăng ký ngay'}
            </button>
            <button 
              onClick={() => navigate(user ? '/customer/booking' : '/services')} 
              className="btn btn-outline-light btn-large"
            >
              {user ? 'Đặt lịch ngay' : 'Xem dịch vụ'}
            </button>
          
          </div>
        </div>
        <div className="hero-scroll-indicator">
          <span>Cuộn xuống để khám phá</span>
          <div className="scroll-arrow">↓</div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Tại sao chọn chúng tôi?</h2>
          <p className="section-subtitle">
            Chúng tôi cung cấp dịch vụ bảo dưỡng xe điện toàn diện với công nghệ hiện đại
          </p>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Services Section */}
      <section className="services-preview-section">
        <div className="container">
          <h2 className="section-title">Dịch vụ phổ biến</h2>
          <p className="section-subtitle">
            Những dịch vụ được khách hàng lựa chọn nhiều nhất
          </p>
          
          <div className="services-preview-grid">
            {popularServices.map((service, index) => (
              <div key={index} className="service-preview-card">
                <div className="service-preview-image">
                  <img src={service.image} alt={service.title} />
                  <div className="service-preview-overlay">
                    <button 
                      onClick={() => navigate(user ? '/customer/booking' : '/services')}
                      className="btn btn-primary"
                    >
                      {user ? 'Đặt lịch ngay' : 'Xem chi tiết'}
                    </button>
                  </div>
                </div>
                <div className="service-preview-content">
                  <h3>{service.title}</h3>
                  <p className="service-preview-price">{service.price}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button 
              onClick={() => navigate(user ? '/customer/booking' : '/services')}
              className="btn btn-primary btn-large"
            >
              {user ? 'Đặt lịch bảo dưỡng' : 'Xem tất cả dịch vụ'}
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="container">
          <h2 className="section-title" style={{ color: 'white' }}>
            Khách hàng nói gì về chúng tôi
          </h2>
          <p className="section-subtitle" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Hơn 10,000 khách hàng đã tin tưởng và hài lòng với dịch vụ của chúng tôi
          </p>
          
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-rating">
                  {'⭐'.repeat(testimonial.rating)}
                </div>
                <p className="testimonial-content">"{testimonial.content}"</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{testimonial.avatar}</div>
                  <div className="author-info">
                    <div className="author-name">{testimonial.name}</div>
                    <div className="author-role">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>{user ? 'Bắt đầu quản lý xe của bạn' : 'Sẵn sàng bảo dưỡng xe của bạn?'}</h2>
            <p>
              {user 
                ? 'Truy cập dashboard để xem xe, đặt lịch và theo dõi lịch sử bảo dưỡng'
                : 'Đăng ký ngay hôm nay để nhận ưu đãi đặc biệt cho lần đầu sử dụng dịch vụ'
              }
            </p>
            <div className="cta-buttons">
              <button 
                onClick={() => navigate(user ? '/customer/dashboard' : '/register')}
                className="btn btn-primary btn-large"
              >
                {user ? '📊 Vào Dashboard' : 'Đăng ký miễn phí'}
              </button>
              <button 
                onClick={() => navigate(user ? '/customer/booking' : '/contact')}
                className="btn btn-outline btn-large"
              >
                {user ? '📅 Đặt lịch ngay' : 'Liên hệ tư vấn'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="footer-section">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <h3>EV Maintenance</h3>
              <p>Hệ thống quản lý bảo dưỡng xe điện hàng đầu Việt Nam</p>
              <div className="footer-social">
                <a href="#facebook">📘</a>
                <a href="#twitter">🐦</a>
                <a href="#instagram">📷</a>
                <a href="#youtube">📺</a>
              </div>
            </div>
            
            <div className="footer-col">
              <h4>Dịch vụ</h4>
              <ul>
                <li><a href="/services">Bảo dưỡng định kỳ</a></li>
                <li><a href="/services">Kiểm tra pin</a></li>
                <li><a href="/services">Sửa chữa khẩn cấp</a></li>
                <li><a href="/services">Nâng cấp hệ thống</a></li>
              </ul>
            </div>
            
            <div className="footer-col">
              <h4>Hỗ trợ</h4>
              <ul>
                <li><a href="/about">Về chúng tôi</a></li>
                <li><a href="/contact">Liên hệ</a></li>
                <li><a href="/faq">Câu hỏi thường gặp</a></li>
                <li><a href="/terms">Điều khoản dịch vụ</a></li>
              </ul>
            </div>
            
            <div className="footer-col">
              <h4>Liên hệ</h4>
              <ul>
                <li>📞 Hotline: 0283-123-456</li>
                <li>📧 Email: support@evmaintenance.com</li>
                <li>📍 Địa chỉ: Hồ Chí Minh, Việt Nam</li>
                <li>🕐 T2-CN: 8:00 - 20:00</li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2025 EV Maintenance System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
