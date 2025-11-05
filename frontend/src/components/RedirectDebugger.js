import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const RedirectDebugger = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  const addLog = (message) => {
    setLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog(`Page load: ${location.pathname}`);
  }, [location.pathname]);

  useEffect(() => {
    addLog(`User state: ${user ? `${user.role} logged in` : 'No user'}`);
  }, [user]);

  useEffect(() => {
    addLog(`Loading state: ${loading}`);
  }, [loading]);

  // Manual redirect test
  const testRedirect = () => {
    if (user) {
      const targetPath = `/${user.role}/dashboard`;
      addLog(`Manual redirect to: ${targetPath}`);
      navigate(targetPath, { replace: true });
    }
  };

  if (process.env.NODE_ENV === 'production') return null;

  if (!isVisible) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: '#1976d2',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '11px',
        zIndex: 10000,
        cursor: 'pointer'
      }}
      onClick={() => setIsVisible(true)}
      title="Click to show redirect debugger"
      >
        🔄 Redirect
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: '#1976d2',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '400px',
      zIndex: 10000
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0 }}>🔄 Redirect Debugger</h4>
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
      
      <div><strong>Current:</strong> {location.pathname}</div>
      <div><strong>User:</strong> {user ? `${user.role}` : 'None'}</div>
      <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
      
      {user && (
        <button 
          onClick={testRedirect}
          style={{
            backgroundColor: '#ff5722',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Force Redirect
        </button>
      )}
      
      <div style={{ marginTop: '10px', fontSize: '10px' }}>
        <strong>Recent logs:</strong>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default RedirectDebugger;