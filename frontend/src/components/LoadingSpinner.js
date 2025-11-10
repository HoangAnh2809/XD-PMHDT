import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary', 
  text = 'Đang tải...',
  fullScreen = false 
}) => {
  const spinnerClasses = [
    'loading-spinner',
    `loading-spinner--${size}`,
    `loading-spinner--${color}`,
    fullScreen ? 'loading-spinner--fullscreen' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={spinnerClasses}>
      <div className="loading-spinner__container">
        <div className="loading-spinner__ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        {text && <div className="loading-spinner__text">{text}</div>}
      </div>
    </div>
  );
};

export default LoadingSpinner;
