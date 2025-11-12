import React from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Xác nhận', 
  cancelText = 'Hủy',
  type = 'warning',
  onConfirm, 
  onCancel,
  isLoading = false 
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !isLoading) {
      onCancel();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '🗑️';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return '❓';
    }
  };

  const dialogClasses = [
    'confirm-dialog',
    `confirm-dialog--${type}`,
    isLoading ? 'confirm-dialog--loading' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className="confirm-dialog-overlay"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={dialogClasses}>
        <div className="confirm-dialog__header">
          <div className="confirm-dialog__icon">{getIcon()}</div>
          <h3 className="confirm-dialog__title">{title}</h3>
        </div>
        
        <div className="confirm-dialog__body">
          <p className="confirm-dialog__message">{message}</p>
        </div>
        
        <div className="confirm-dialog__footer">
          <button
            type="button"
            className="confirm-dialog__button confirm-dialog__button--cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            className={`confirm-dialog__button confirm-dialog__button--confirm confirm-dialog__button--${type}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="confirm-dialog__spinner"></span>
                Đang xử lý...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
