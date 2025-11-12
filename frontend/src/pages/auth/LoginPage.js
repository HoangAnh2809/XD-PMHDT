import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Redirect handled by PublicRoute wrapper

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      // Check if we came from a specific page with service selection
      const from = location.state?.from;
      const serviceId = location.state?.service_id;
      
      if (from === '/services' && serviceId && result.role === 'customer') {
        // Redirect to booking page with pre-selected service
        navigate('/customer/booking', { 
          state: { service_id: serviceId }
        });
        return;
      }
      
      // Default redirect based on role
      const redirectPaths = {
        customer: '/customer/dashboard',
        staff: '/staff/dashboard',
        technician: '/technician/dashboard',
        admin: '/admin/dashboard',
      };
      navigate(redirectPaths[result.role] || '/');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div>
      <Navbar />
      
      <div className="container" style={{maxWidth: '500px', marginTop: '4rem'}}>
        <div className="card">
          <h1 style={{textAlign: 'center', marginBottom: '2rem'}}>Đăng nhập</h1>
          
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@email.com"
              />
            </div>

            <div className="form-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Nhập mật khẩu"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{width: '100%', marginTop: '1rem'}}
              disabled={loading}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p style={{textAlign: 'center', marginTop: '1.5rem'}}>
            Chưa có tài khoản?{' '}
            <Link to="/register" style={{color: '#00d4ff', fontWeight: 'bold'}}>
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
