import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { customerAPI } from '../../services/api';

const ServicesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const bookingFormRef = useRef(null);

  // Redirect handled by PublicRoute wrapper
  
  const [bookingForm, setBookingForm] = useState({
    service_type_id: '',
    vehicle_id: '',
    service_center_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });
  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceCenters, setServiceCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedService, setSelectedService] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Check if selected date/time is valid
  const isValidDateTime = () => {
    if (!bookingForm.appointment_date || !bookingForm.appointment_time) {
      return true; // Don't show error if fields are empty
    }
    
    const appointmentDateTime = new Date(`${bookingForm.appointment_date}T${bookingForm.appointment_time}:00`);
    const oneHourFromNow = new Date(new Date().getTime() + 60 * 60 * 1000);
    
    return appointmentDateTime >= oneHourFromNow;
  };

  // Load data when user is logged in
  React.useEffect(() => {
    if (user) {
      loadData();
    } else {
      // Load only service types for public view
      loadServiceTypes();
    }
  }, [user]);

  const loadServiceTypes = async () => {
    try {
      const serviceTypesRes = await customerAPI.getServiceTypes();
      setServiceTypes(serviceTypesRes.data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
      setServiceTypes([]); // Ensure it's always an array
    }
  };

  const loadData = async () => {
    try {
      const [vehiclesRes, serviceTypesRes, centersRes] = await Promise.all([
        customerAPI.getVehicles(),
        customerAPI.getServiceTypes(),
        customerAPI.getServiceCenters()
      ]);
      setVehicles(vehiclesRes.data || []);
      setServiceTypes(serviceTypesRes.data || []);
      setServiceCenters(centersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      // Ensure all state variables are arrays even on error
      setVehicles([]);
      setServiceTypes([]);
      setServiceCenters([]);
    }
  };

  const scrollToBooking = (serviceId = null, useBookingPage = false) => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate('/login', { state: { from: '/services', service_id: serviceId } });
      return;
    }
    
    // Option 1: Navigate to dedicated booking page
    if (useBookingPage) {
      navigate('/customer/booking', { 
        state: { service_id: serviceId }
      });
      return;
    }
    
    // Option 2: Scroll to booking form on same page (current behavior)
    // Pre-select service if provided
    if (serviceId) {
      setBookingForm({
        ...bookingForm,
        service_type_id: serviceId
      });
    }
    
    bookingFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBookingChange = (e) => {
    setBookingForm({
      ...bookingForm,
      [e.target.name]: e.target.value
    });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    // Validate appointment date and time
    const appointmentDateTime = new Date(`${bookingForm.appointment_date}T${bookingForm.appointment_time}:00`);
    const now = new Date();
    
    if (appointmentDateTime <= now) {
      setMessage({ 
        type: 'error', 
        text: 'Thời gian đặt lịch phải sau thời điểm hiện tại. Vui lòng chọn ngày và giờ khác.' 
      });
      setLoading(false);
      return;
    }

    // Check if appointment is at least 1 hour from now
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    if (appointmentDateTime < oneHourFromNow) {
      setMessage({ 
        type: 'error', 
        text: 'Vui lòng đặt lịch trước ít nhất 1 giờ so với thời điểm hiện tại.' 
      });
      setLoading(false);
      return;
    }

    try {
      const appointmentData = {
        vehicle_id: bookingForm.vehicle_id,
        service_type_id: bookingForm.service_type_id,
        service_center_id: bookingForm.service_center_id,
        appointment_date: `${bookingForm.appointment_date}T${bookingForm.appointment_time}:00`,
        customer_notes: bookingForm.notes || ''
      };
      
      await customerAPI.createAppointment(appointmentData);
      setMessage({ type: 'success', text: 'Đặt lịch thành công! Chúng tôi sẽ liên hệ với bạn sớm.' });
      
      // Reset form
      setBookingForm({
        service_type_id: '',
        vehicle_id: '',
        service_center_id: '',
        appointment_date: '',
        appointment_time: '',
        notes: ''
      });
      
      // Redirect to appointments page after 2 seconds
      setTimeout(() => {
        navigate('/customer/appointments');
      }, 2000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Đặt lịch thất bại. Vui lòng thử lại.' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get service image based on name
  const getServiceImage = (name) => {
    const imageMap = {
      'Kiểm tra Pin': 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=500&h=300&fit=crop',
      'Xoay Vị Trí Lốp': 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=500&h=300&fit=crop',
      'Kiểm tra Hệ thống Phanh': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&h=300&fit=crop',
      'Cập nhật Phần mềm': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop',
      'Bảo dưỡng Toàn diện': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&h=300&fit=crop',
      'Sửa chữa Khẩn cấp': 'https://images.unsplash.com/photo-1632823469662-70740d49f9e9?w=500&h=300&fit=crop'
    };
    return imageMap[name] || 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=500&h=300&fit=crop';
  };

  // Map serviceTypes from database to display format
  const getDisplayServices = () => {
    if (!serviceTypes || serviceTypes.length === 0) {
      return services; // Fallback to hard-coded services
    }

    return serviceTypes.map(service => ({
      id: service.id, // UUID from database
      name: service.name,
      description: service.description || 'Dịch vụ chất lượng cao cho xe điện của bạn',
      price: `${parseFloat(service.base_price || 0).toLocaleString('vi-VN')} VNĐ`,
      duration: `${service.estimated_duration || 0} phút`,
      image: getServiceImage(service.name),
      rating: 4.8,
      reviewCount: 100
    }));
  };

  const services = [
    {
      id: 1,
      name: 'Kiểm tra Pin',
      description: 'Kiểm tra sức khỏe pin, dung lượng và hiệu suất hoạt động',
      detailedDescription: 'Dịch vụ kiểm tra toàn diện hệ thống pin xe điện bao gồm: đánh giá tình trạng sức khỏe pin (SOH), kiểm tra dung lượng thực tế, phân tích hiệu suất sạc/xả, kiểm tra hệ thống làm mát pin, và cung cấp báo cáo chi tiết về tuổi thọ pin.',
      price: '500,000 VNĐ',
      duration: '60 phút',
      image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=500&h=300&fit=crop',
      rating: 4.8,
      reviewCount: 324,
      features: [
        'Kiểm tra SOH (State of Health) pin',
        'Đo dung lượng thực tế',
        'Phân tích hiệu suất sạc/xả',
        'Kiểm tra hệ thống làm mát',
        'Báo cáo chi tiết tuổi thọ pin'
      ],
      warranty: '30 ngày bảo hành dịch vụ'
    },
    {
      id: 2,
      name: 'Bảo dưỡng định kỳ',
      description: 'Kiểm tra tổng thể, thay dầu, kiểm tra phanh và lốp',
      detailedDescription: 'Gói bảo dưỡng định kỳ toàn diện cho xe điện bao gồm kiểm tra 50 điểm quan trọng, thay dầu hộp số (nếu có), kiểm tra và bảo dưỡng hệ thống phanh, kiểm tra áp suất và độ mòn lốp, cân bằng động bánh xe, kiểm tra hệ thống treo, và làm sạch hệ thống điều hòa.',
      price: '2,000,000 VNĐ',
      duration: '180 phút',
      image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&h=300&fit=crop',
      rating: 4.9,
      reviewCount: 582,
      features: [
        'Kiểm tra 50 điểm quan trọng',
        'Thay dầu hộp số (nếu có)',
        'Bảo dưỡng hệ thống phanh',
        'Kiểm tra áp suất và độ mòn lốp',
        'Cân bằng động bánh xe',
        'Kiểm tra hệ thống treo',
        'Làm sạch hệ thống điều hòa'
      ],
      warranty: '90 ngày bảo hành dịch vụ'
    },
    {
      id: 3,
      name: 'Kiểm tra Phanh',
      description: 'Kiểm tra hệ thống phanh tái sinh và phanh cơ học',
      detailedDescription: 'Dịch vụ chuyên sâu về hệ thống phanh xe điện, bao gồm kiểm tra và hiệu chỉnh hệ thống phanh tái sinh (regenerative braking), kiểm tra độ dày má phanh, đo độ mòn đĩa phanh, kiểm tra dầu phanh, và test hiệu suất phanh trên đường thử.',
      price: '800,000 VNĐ',
      duration: '90 phút',
      image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&h=300&fit=crop',
      rating: 4.7,
      reviewCount: 256,
      features: [
        'Kiểm tra phanh tái sinh',
        'Đo độ dày má phanh',
        'Kiểm tra độ mòn đĩa phanh',
        'Thay dầu phanh nếu cần',
        'Test hiệu suất trên đường thử',
        'Hiệu chỉnh hệ thống ABS'
      ],
      warranty: '60 ngày bảo hành dịch vụ'
    },
    {
      id: 4,
      name: 'Cập nhật Phần mềm',
      description: 'Cập nhật phần mềm điều khiển xe lên phiên bản mới nhất',
      detailedDescription: 'Dịch vụ cập nhật firmware và software cho hệ thống điều khiển xe điện, bao gồm: cập nhật phần mềm quản lý pin (BMS), hệ thống giải trí, hệ thống hỗ trợ lái xe (ADAS), và các module điều khiển khác. Giúp cải thiện hiệu suất, sửa lỗi và thêm tính năng mới.',
      price: '300,000 VNĐ',
      duration: '45 phút',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop',
      rating: 4.6,
      reviewCount: 189,
      features: [
        'Cập nhật BMS (Battery Management System)',
        'Cập nhật hệ thống giải trí',
        'Cập nhật ADAS',
        'Cải thiện hiệu suất',
        'Sửa lỗi hệ thống',
        'Thêm tính năng mới'
      ],
      warranty: 'Hỗ trợ miễn phí 60 ngày'
    },
    {
      id: 5,
      name: 'Sửa chữa Khẩn cấp 24/7',
      description: 'Hỗ trợ sửa chữa khẩn cấp 24/7',
      detailedDescription: 'Dịch vụ cấp cứu và sửa chữa khẩn cấp 24/7 cho xe điện, bao gồm: cứu hộ tại chỗ, sạc pin khẩn cấp, thay lốp, sửa chữa các sự cố điện tử, và kéo xe về trung tâm nếu cần. Đội ngũ kỹ thuật viên chuyên nghiệp sẵn sàng hỗ trợ bất cứ lúc nào.',
      price: '1,500,000 VNĐ',
      duration: '120 phút',
      image: 'https://images.unsplash.com/photo-1632823469662-70740d49f9e9?w=500&h=300&fit=crop',
      rating: 4.9,
      reviewCount: 412,
      features: [
        'Hỗ trợ 24/7',
        'Cứu hộ tại chỗ',
        'Sạc pin khẩn cấp',
        'Thay lốp xe',
        'Sửa chữa sự cố điện tử',
        'Kéo xe miễn phí nếu cần'
      ],
      warranty: 'Bảo hành 30 ngày cho phụ tùng thay thế'
    },
    {
      id: 6,
      name: 'Kiểm tra Hệ thống Điện',
      description: 'Chẩn đoán và kiểm tra toàn bộ hệ thống điện xe',
      detailedDescription: 'Dịch vụ chẩn đoán chuyên sâu hệ thống điện xe điện, bao gồm: kiểm tra mạch điện cao áp, hệ thống sạc, inverter, motor điện, các cảm biến và module điều khiển. Sử dụng thiết bị chẩn đoán chuyên dụng để phát hiện lỗi tiềm ẩn.',
      price: '700,000 VNĐ',
      duration: '90 phút',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=500&h=300&fit=crop',
      rating: 4.7,
      reviewCount: 198,
      features: [
        'Kiểm tra mạch điện cao áp',
        'Chẩn đoán hệ thống sạc',
        'Kiểm tra inverter và motor',
        'Test các cảm biến',
        'Quét mã lỗi ECU',
        'Báo cáo chi tiết kèm hình ảnh'
      ],
      warranty: '45 ngày bảo hành dịch vụ'
    },
    {
      id: 7,
      name: 'Thay Lốp & Cân Chỉnh',
      description: 'Thay lốp mới và cân chỉnh độ chính xác bánh xe',
      detailedDescription: 'Dịch vụ thay lốp chuyên nghiệp cho xe điện với các loại lốp tiết kiệm năng lượng. Bao gồm: tháo lắp lốp, cân bằng động, kiểm tra và điều chỉnh góc đặt bánh xe (wheel alignment), kiểm tra hệ thống treo và giảm xóc.',
      price: '1,200,000 VNĐ',
      duration: '120 phút',
      image: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=500&h=300&fit=crop',
      rating: 4.8,
      reviewCount: 346,
      features: [
        'Thay lốp tiết kiệm năng lượng',
        'Cân bằng động bánh xe',
        'Cân chỉnh góc đặt bánh xe',
        'Kiểm tra áp suất lốp',
        'Kiểm tra hệ thống treo',
        'Tư vấn loại lốp phù hợp'
      ],
      warranty: 'Bảo hành lốp theo nhà sản xuất'
    },
    {
      id: 8,
      name: 'Bảo dưỡng Điều hòa',
      description: 'Vệ sinh, bảo dưỡng hệ thống điều hòa không khí',
      detailedDescription: 'Dịch vụ bảo dưỡng hệ thống điều hòa xe điện, bao gồm: vệ sinh dàn lạnh/nóng, thay lọc gió cabin, kiểm tra gas lạnh, khử mùi và diệt khuẩn, kiểm tra compressor điện và các van điều khiển.',
      price: '600,000 VNĐ',
      duration: '75 phút',
      image: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=500&h=300&fit=crop',
      rating: 4.6,
      reviewCount: 275,
      features: [
        'Vệ sinh dàn lạnh, dàn nóng',
        'Thay lọc gió cabin',
        'Kiểm tra và nạp gas lạnh',
        'Khử mùi, diệt khuẩn',
        'Kiểm tra compressor điện',
        'Vệ sinh cửa gió, khoang máy'
      ],
      warranty: '60 ngày bảo hành dịch vụ'
    },
    {
      id: 9,
      name: 'Sơn & Phục hồi Ngoại thất',
      description: 'Sơn phủ, đánh bóng và phục hồi ngoại thất xe',
      detailedDescription: 'Dịch vụ làm đẹp ngoại thất xe điện với công nghệ hiện đại: sơn phủ ceramic, đánh bóng nano, phục hồi vết xước, làm mới đèn pha, phủ kính chống nước. Giúp xe luôn mới và bảo vệ sơn xe lâu dài.',
      price: '3,500,000 VNĐ',
      duration: '240 phút',
      image: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=500&h=300&fit=crop',
      rating: 4.9,
      reviewCount: 428,
      features: [
        'Phủ ceramic cao cấp',
        'Đánh bóng nano',
        'Phục hồi vết xước nhẹ',
        'Làm mới đèn pha',
        'Phủ kính chống nước',
        'Vệ sinh toàn bộ ngoại thất'
      ],
      warranty: '12 tháng bảo hành lớp phủ'
    },
    {
      id: 10,
      name: 'Nội thất & Vệ sinh Sâu',
      description: 'Vệ sinh sâu và bảo dưỡng nội thất xe',
      detailedDescription: 'Dịch vụ vệ sinh sâu toàn bộ nội thất xe điện: giặt ghế da/nỉ, vệ sinh thảm, trần xe, cửa xe, taplo, khử mùi ozone, phủ bảo vệ da, diệt khuẩn toàn bộ khoang cabin.',
      price: '1,800,000 VNĐ',
      duration: '150 phút',
      image: 'https://images.unsplash.com/photo-1600320254374-ce2d293c324e?w=500&h=300&fit=crop',
      rating: 4.8,
      reviewCount: 367,
      features: [
        'Giặt ghế da/nỉ chuyên sâu',
        'Vệ sinh thảm, trần, cửa xe',
        'Làm sạch taplo, console',
        'Khử mùi ozone',
        'Phủ bảo vệ da',
        'Diệt khuẩn cabin'
      ],
      warranty: '30 ngày bảo hành dịch vụ'
    },
    {
      id: 11,
      name: 'Nâng cấp Hệ thống Âm thanh',
      description: 'Lắp đặt, nâng cấp hệ thống âm thanh cao cấp',
      detailedDescription: 'Dịch vụ tư vấn và nâng cấp hệ thống âm thanh xe điện với các thiết bị cao cấp: loa, amply, sub, màn hình android, camera 360, cách âm chống ồn, tối ưu hóa chất lượng âm thanh.',
      price: '5,000,000 VNĐ',
      duration: '300 phút',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=300&fit=crop',
      rating: 4.7,
      reviewCount: 215,
      features: [
        'Tư vấn thiết bị phù hợp',
        'Lắp đặt loa, amply cao cấp',
        'Màn hình Android/CarPlay',
        'Camera 360 độ',
        'Cách âm chống ồn',
        'Điều chỉnh EQ tối ưu'
      ],
      warranty: '24 tháng bảo hành thiết bị'
    },
    {
      id: 12,
      name: 'Kiểm tra An toàn Tổng thể',
      description: 'Kiểm tra 100 điểm an toàn theo tiêu chuẩn quốc tế',
      detailedDescription: 'Gói kiểm tra an toàn toàn diện 100 điểm theo tiêu chuẩn quốc tế cho xe điện: hệ thống phanh, đèn, bánh xe, khung gầm, pin, điện, ADAS, túi khí, dây an toàn. Cung cấp báo cáo chi tiết và chứng nhận an toàn.',
      price: '1,000,000 VNĐ',
      duration: '120 phút',
      image: 'https://images.unsplash.com/photo-1590859808308-3d2d9c515b1a?w=500&h=300&fit=crop',
      rating: 4.9,
      reviewCount: 534,
      features: [
        'Kiểm tra 100 điểm an toàn',
        'Test hệ thống ADAS',
        'Kiểm tra túi khí',
        'Đánh giá khung gầm',
        'Test hệ thống phanh ABS',
        'Chứng nhận an toàn'
      ],
      warranty: 'Chứng nhận hiệu lực 6 tháng'
    }
  ];

  return (
    <div>
      <Navbar />
      
      <div className="hero">
        <h1>Dịch vụ của chúng tôi</h1>
        <p>Các gói dịch vụ bảo dưỡng và sửa chữa xe điện chuyên nghiệp</p>
      </div>

      <div className="container">
        <div className="services-grid">
          {(getDisplayServices() || []).map((service) => (
            <div key={service.id} className="service-card">
              <div className="service-image">
                <img src={service.image} alt={service.name} />
              </div>
              <div className="service-content">
                <h3>{service.name}</h3>
                <p className="service-description">{service.description}</p>
                <div className="service-info">
                  <div className="info-item">
                    <span className="info-label">💰 Giá:</span>
                    <span className="info-value">{service.price}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">⏱️ Thời gian:</span>
                    <span className="info-value">{service.duration}</span>
                  </div>
                </div>
                
                {/* Rating Section */}
                <div className="service-rating">
                  <div className="rating-stars">
                    {[...Array(5)].map((_, index) => (
                      <span 
                        key={index} 
                        className={index < Math.floor(service.rating) ? 'star filled' : 'star'}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                  <div className="rating-info">
                    <span className="rating-number">{service.rating}</span>
                    <span className="rating-separator">•</span>
                    <span className="rating-reviews">{service.reviewCount} đánh giá</span>
                  </div>
                </div>

                <div className="service-actions">
                  <button 
                    onClick={() => {
                      setSelectedService(service);
                      setShowDetailModal(true);
                    }}
                    className="btn btn-outline"
                  >
                    Xem chi tiết
                  </button>
                  <button 
                    onClick={() => scrollToBooking(service.id, true)}
                    className="btn btn-primary"
                    title="Chuyển đến trang đặt lịch"
                  >
                    Đặt lịch ngay
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{marginTop: '3rem', background: '#f8f9fa'}}>
          <h2>Gói bảo dưỡng định kỳ</h2>
          <p>Đăng ký gói bảo dưỡng định kỳ để nhận ưu đãi đặc biệt!</p>
          <ul style={{marginTop: '1rem', lineHeight: '2'}}>
            <li>✅ Giảm 20% cho các dịch vụ trong gói</li>
            <li>✅ Ưu tiên đặt lịch</li>
            <li>✅ Nhắc nhở bảo dưỡng tự động</li>
            <li>✅ Hỗ trợ khẩn cấp miễn phí</li>
          </ul>
          <button 
            onClick={scrollToBooking}
            className="btn btn-success" 
            style={{marginTop: '1rem'}}
          >
            Đăng ký ngay
          </button>
        </div>

        {/* Booking Form - Only show when user is logged in */}
        {user && (
          <div ref={bookingFormRef} className="card" style={{marginTop: '3rem', background: '#fff'}}>
            <h2>Đặt lịch bảo dưỡng</h2>
            <p style={{color: '#666', marginBottom: '2rem'}}>
              Điền thông tin bên dưới để đặt lịch bảo dưỡng xe của bạn
            </p>

            {message.text && (
              <div className={`alert alert-${message.type}`} style={{marginBottom: '1rem'}}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              <div className="form-group">
                <label>Chọn xe *</label>
                <select
                  name="vehicle_id"
                  className="form-control"
                  value={bookingForm.vehicle_id}
                  onChange={handleBookingChange}
                  required
                >
                  <option value="">-- Chọn xe --</option>
                  {(vehicles || []).map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} - {vehicle.license_plate}
                    </option>
                  ))}
                </select>
                {vehicles.length === 0 && (
                  <small style={{color: '#ff6b6b'}}>
                    Bạn chưa có xe nào. <a href="/customer/vehicles">Thêm xe ngay</a>
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Loại dịch vụ *</label>
                <select
                  name="service_type_id"
                  className="form-control"
                  value={bookingForm.service_type_id}
                  onChange={handleBookingChange}
                  required
                >
                  <option value="">-- Chọn dịch vụ --</option>
                  {(serviceTypes || []).map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.price?.toLocaleString('vi-VN')} VNĐ
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Trung tâm dịch vụ *</label>
                <select
                  name="service_center_id"
                  className="form-control"
                  value={bookingForm.service_center_id}
                  onChange={handleBookingChange}
                  required
                >
                  <option value="">-- Chọn trung tâm --</option>
                  {(serviceCenters || []).map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name} - {center.address}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label>Ngày hẹn *</label>
                  <input
                    type="date"
                    name="appointment_date"
                    className="form-control"
                    value={bookingForm.appointment_date}
                    onChange={handleBookingChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                  <small style={{color: '#666', fontSize: '0.875rem'}}>
                    Chỉ được chọn ngày từ hôm nay trở đi
                  </small>
                </div>

                <div className="form-group">
                  <label>Giờ hẹn *</label>
                  <input
                    type="time"
                    name="appointment_time"
                    className="form-control"
                    value={bookingForm.appointment_time}
                    onChange={handleBookingChange}
                    required
                  />
                  <small style={{color: '#666', fontSize: '0.875rem'}}>
                    Đặt lịch trước ít nhất 1 giờ
                  </small>
                </div>
              </div>

              <div className="alert alert-info" style={{marginTop: '1rem', background: '#e7f3ff', border: '1px solid #b3d9ff', color: '#004085'}}>
                <strong>📌 Lưu ý:</strong> Thời gian đặt lịch phải sau thời điểm hiện tại ít nhất 1 giờ.
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  name="notes"
                  className="form-control"
                  rows="4"
                  value={bookingForm.notes}
                  onChange={handleBookingChange}
                  placeholder="Thêm ghi chú về tình trạng xe hoặc yêu cầu đặc biệt..."
                ></textarea>
              </div>

              {/* Show warning if datetime is invalid */}
              {!isValidDateTime() && bookingForm.appointment_date && bookingForm.appointment_time && (
                <div className="alert alert-error" style={{marginTop: '1rem'}}>
                  ⚠️ Thời gian đặt lịch không hợp lệ. Vui lòng chọn thời gian sau thời điểm hiện tại ít nhất 1 giờ.
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{width: '100%', marginTop: '1rem'}}
                disabled={loading || vehicles.length === 0 || !isValidDateTime()}
              >
                {loading ? 'Đang xử lý...' : 'Xác nhận đặt lịch'}
              </button>
              
              {(!isValidDateTime() && bookingForm.appointment_date && bookingForm.appointment_time) && (
                <small style={{color: '#dc3545', display: 'block', marginTop: '0.5rem', textAlign: 'center'}}>
                  Nút đặt lịch bị vô hiệu hóa do thời gian không hợp lệ
                </small>
              )}
            </form>
          </div>
        )}

        {/* Login prompt for non-authenticated users */}
        {!user && (
          <div className="card" style={{marginTop: '3rem', background: '#fff3cd', borderColor: '#ffc107'}}>
            <h3>Đăng nhập để đặt lịch</h3>
            <p>Bạn cần đăng nhập để sử dụng dịch vụ đặt lịch bảo dưỡng.</p>
            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
              <a href="/login" className="btn btn-primary">
                Đăng nhập
              </a>
              <a href="/register" className="btn btn-outline">
                Đăng ký tài khoản
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Service Detail Modal */}
      {showDetailModal && selectedService && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowDetailModal(false)}
            >
              ✕
            </button>
            
            <div className="modal-header">
              <img 
                src={selectedService.image} 
                alt={selectedService.name}
                className="modal-image"
              />
            </div>
            
            <div className="modal-body">
              <h2>{selectedService.name}</h2>
              
              <div className="modal-price-duration">
                <div className="price-tag">
                  <span className="label">Giá dịch vụ</span>
                  <span className="price">{selectedService.price}</span>
                </div>
                <div className="duration-tag">
                  <span className="label">Thời gian</span>
                  <span className="duration">{selectedService.duration}</span>
                </div>
              </div>

              <div className="modal-section">
                <h3>Mô tả chi tiết</h3>
                <p>{selectedService.detailedDescription}</p>
              </div>

              <div className="modal-section">
                <h3>Dịch vụ bao gồm</h3>
                <ul className="features-list">
                  {(selectedService.features || []).map((feature, index) => (
                    <li key={index}>
                      <span className="check-icon">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="modal-section">
                <h3>Bảo hành</h3>
                <p className="warranty-info">
                  <span className="warranty-icon">🛡️</span>
                  {selectedService.warranty}
                </p>
              </div>

              <div className="modal-actions">
                <button 
                  onClick={() => {
                    setShowDetailModal(false);
                    scrollToBooking();
                  }}
                  className="btn btn-primary btn-large"
                >
                  Đặt lịch ngay
                </button>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="btn btn-outline btn-large"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
