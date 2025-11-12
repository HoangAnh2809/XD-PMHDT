import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { chatAPI } from '../services/api';
import serviceChecker from '../utils/serviceChecker';
import './FloatingChatButton.css';

const FloatingChatButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [chatServiceAvailable, setChatServiceAvailable] = useState(true); // Assume available initially

  useEffect(() => {
    // Show for logged-in customers
    if (user && user.role === 'customer' && chatServiceAvailable) {
      loadUnreadCount();
      // Poll every 30 seconds only if service is available
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, chatServiceAvailable]);

  const loadUnreadCount = async () => {
    // Check service availability first
    const chatAvailable = serviceChecker.isAvailable('chat');
    
    // If we know it's unavailable, don't make the request
    if (chatAvailable === false) {
      setUnreadCount(0);
      setChatServiceAvailable(false);
      return;
    }

    try {
      // Get unread chat messages count
      const sessions = await chatAPI.getMySessions();
      const unread = sessions.data.filter(s => s.unread_count > 0).length;
      setUnreadCount(unread);
      setChatServiceAvailable(true);
      serviceChecker.markAvailable('chat'); // Cache success
    } catch (error) {
      // Chat service not available - stop polling
      setChatServiceAvailable(false);
      setUnreadCount(0);
      serviceChecker.markUnavailable('chat'); // Cache failure
    }
  };

  const handleClick = () => {
    if (user && user.role === 'customer') {
      navigate('/customer/chat');
    } else {
      // For non-logged in users, show quick chat popup
      setShowQuickChat(!showQuickChat);
    }
  };

  // Hide button on chat page
  useEffect(() => {
    const hiddenPaths = ['/customer/chat'];
    const shouldHide = hiddenPaths.some(path => window.location.pathname.includes(path));
    setIsVisible(!shouldHide);
  }, [window.location.pathname]);

  // Show for all users except on certain pages
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <button 
        className="floating-chat-button"
        onClick={handleClick}
        aria-label="Mở chat hỗ trợ"
        title="Chat với chúng tôi"
      >
        <span className="chat-icon">💬</span>
        {unreadCount > 0 && (
          <span className="chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
        <span className="chat-pulse"></span>
      </button>

      {/* Quick Chat Popup for non-logged in users */}
      {showQuickChat && !user && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '350px',
          maxHeight: '500px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1.5rem',
            color: 'white'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>💬 Chat hỗ trợ</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                  Chúng tôi sẵn sàng hỗ trợ bạn!
                </p>
              </div>
              <button
                onClick={() => setShowQuickChat(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '1.5rem' }}>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Xin chào! Để sử dụng tính năng chat trực tuyến, vui lòng đăng nhập hoặc chọn cách liên hệ khác:
            </p>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShowQuickChat(false);
                  navigate('/login');
                }}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
              >
                🔐 Đăng nhập để chat
              </button>

              <button
                onClick={() => {
                  setShowQuickChat(false);
                  navigate('/register');
                }}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
              >
                ✨ Đăng ký tài khoản
              </button>

              <div style={{
                borderTop: '1px solid #eee',
                paddingTop: '1rem',
                marginTop: '0.5rem'
              }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem', fontWeight: '600' }}>
                  Hoặc liên hệ qua:
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <a
                    href="tel:1900xxxx"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: '#1a1a2e',
                      fontSize: '0.9rem'
                    }}
                  >
                    <span>📞</span>
                    <span>Hotline: 1900 xxxx</span>
                  </a>

                  <a
                    href="mailto:support@evmaintenance.com"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: '#1a1a2e',
                      fontSize: '0.9rem'
                    }}
                  >
                    <span>📧</span>
                    <span>Email hỗ trợ</span>
                  </a>

                  <button
                    onClick={() => {
                      setShowQuickChat(false);
                      navigate('/contact');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#1a1a2e',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <span>🏢</span>
                    <span>Gửi yêu cầu hỗ trợ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChatButton;
