import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    
    try {
      if (token) {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          try {
            const response = await authAPI.getMe();
            // Use response data as the authoritative source, token role might be outdated
            // Always trust the API response over token claims
            setUser(response.data);
          } catch (apiError) {
            // If API fails but token is valid, use token data as fallback
            setUser({
              id: decoded.user_id || decoded.sub,
              username: decoded.username || 'user',
              email: decoded.email || '',
              role: decoded.role || 'customer',
              full_name: decoded.full_name || decoded.username || 'User'
            });
          }
        } else {
          logout();
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Don't logout on error, just set loading to false
      setUser(null);
    } finally {
      // Always set loading to false
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    // Wrap login call with a timeout so the UI doesn't remain stuck for long when the backend is unavailable
    const timeoutMs = 10000; // 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('timeout'));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([authAPI.login(email, password), timeoutPromise]);
      const { access_token, role } = response.data;
      localStorage.setItem('token', access_token);
      // Try to fetch user profile but don't block the login success on it failing
      try {
        const userResponse = await authAPI.getMe();
        setUser(userResponse.data);
      } catch (e) {
        console.warn('Login: /auth/me failed after login, falling back to token claims', e);
        // Try decode token and set minimal user info
        try {
          const decoded = jwtDecode(access_token);
          setUser({
            id: decoded.user_id || decoded.sub,
            username: decoded.username || decoded.sub || 'user',
            email: decoded.sub || decoded.email || '',
            role: decoded.role || 'customer',
            full_name: decoded.full_name || decoded.username || 'User'
          });
        } catch (decodeErr) {
          console.error('Failed to decode access token after login:', decodeErr);
        }
      }
      return { success: true, role };
    } catch (error) {
      // Provide richer error information for debugging
      let message = 'Đăng nhập thất bại';
      try {
        if (error.message === 'timeout') {
          message = `Không phản hồi từ máy chủ sau ${timeoutMs/1000}s. Vui lòng kiểm tra backend.`;
        } else if (!error.response) {
          message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend (http://localhost:8000)';
        } else if (error.response.data) {
          message = error.response.data?.detail || JSON.stringify(error.response.data);
          message = `(${error.response.status}) ${message}`;
        } else {
          message = `(${error.response.status}) Không thể xử lý yêu cầu.`;
        }
      } catch (e) {
        message = 'Đăng nhập thất bại (lỗi khi xử lý phản hồi lỗi)';
      }

      console.error('Login error details:', error);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      return { success: true };
    } catch (error) {
      console.error('❌ Lỗi đăng ký:', error);
      console.error('Response:', error.response);
      
      let errorMessage = 'Đăng ký thất bại';
      
      if (error.message === 'Network Error' || !error.response) {
        // CORS or network issue
        errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra:\n' +
                      '1. Backend service đã chạy chưa? (port 8000)\n' +
                      '2. CORS đã được cấu hình đúng chưa?\n' +
                      '3. Kết nối mạng có ổn định không?';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
      } else if (error.response?.status === 409) {
        errorMessage = 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.';
      } else if (error.response?.status === 422) {
        errorMessage = 'Dữ liệu không đúng định dạng. Vui lòng kiểm tra lại.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Lỗi hệ thống. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...userData
    }));
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
