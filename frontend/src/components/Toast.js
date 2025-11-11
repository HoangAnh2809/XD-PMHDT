import React, { useState, useEffect } from 'react';
import './Toast.css';

const Toast = ({ 
  message, 
  type = 'info', 
  duration = 5000, 
  position = 'top-right',
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const toastClasses = [
    'toast',
    `toast--${type}`,
    `toast--${position}`,
    isExiting ? 'toast--exiting' : ''
  ].filter(Boolean).join(' ');

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={toastClasses}>
      <div className="toast__content">
        <div className="toast__icon">{getIcon()}</div>
        <div className="toast__message">{message}</div>
        <button 
          className="toast__close"
          onClick={handleClose}
          aria-label="Đóng thông báo"
        >
          ×
        </button>
      </div>
      {duration > 0 && (
        <div className="toast__progress">
          <div 
            className="toast__progress-bar" 
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  );
};

// Toast Container Component
export const ToastContainer = ({ children, position = 'top-right' }) => {
  return (
    <div className={`toast-container toast-container--${position}`}>
      {children}
    </div>
  );
};

// Toast Manager Hook
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message, duration = 5000) => 
    showToast(message, 'success', duration);
  
  const showError = (message, duration = 7000) => 
    showToast(message, 'error', duration);
  
  const showWarning = (message, duration = 6000) => 
    showToast(message, 'warning', duration);
  
  const showInfo = (message, duration = 5000) => 
    showToast(message, 'info', duration);

  const ToastManager = ({ position = 'top-right' }) => (
    <ToastContainer position={position}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContainer>
  );

  return {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    ToastManager
  };
};

export default Toast;
