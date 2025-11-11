import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const AuthDebugger = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [isVisible, setIsVisible] = React.useState(false);

  // hook must be called unconditionally
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      // press Ctrl+Shift+D to toggle debug
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null; // don't show in production
  }

  if (!isVisible) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: '#666',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '11px',
        zIndex: 9999,
        cursor: 'pointer'
      }}
      onClick={() => setIsVisible(true)}
      title="Click or press Ctrl+Shift+D to show debug panel"
      >
        🐛 Debug
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      backgroundColor: '#333', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '8px', 
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0 }}>🐛 Auth Debug</h4>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ✕
        </button>
      </div>
      <div><strong>Path:</strong> {location.pathname}</div>
      <div><strong>Loading:</strong> {loading ? '✅' : '❌'}</div>
      <div><strong>Token:</strong> {token ? '✅' : '❌'}</div>
      <div><strong>User:</strong> {user ? `${user.username} (${user.role})` : '❌'}</div>
      
      {user && (
        <div>
          {(() => {
            const publicPaths = ['/', '/services', '/about', '/contact', '/login', '/register'];
            const isOnPublicPage = publicPaths.includes(location.pathname);
            const expectedPath = `/${user.role}/dashboard`;
            const isOnCorrectPath = location.pathname.startsWith(`/${user.role}`);
            
            if (isOnPublicPage) {
              return (
                <div style={{ 
                  backgroundColor: '#ff5722', 
                  padding: '5px', 
                  marginTop: '5px', 
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  ⚠️ PROBLEM: On public page!
                  <br />Should redirect to: {expectedPath}
                </div>
              );
            } else if (isOnCorrectPath) {
              return (
                <div style={{ 
                  backgroundColor: '#4caf50', 
                  padding: '5px', 
                  marginTop: '5px', 
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  ✅ OK: On correct {user.role} area
                </div>
              );
            } else {
              return (
                <div style={{ 
                  backgroundColor: '#ff9800', 
                  padding: '5px', 
                  marginTop: '5px', 
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  ⚠️ Wrong area: Should be in /{user.role}
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
};

export default AuthDebugger;