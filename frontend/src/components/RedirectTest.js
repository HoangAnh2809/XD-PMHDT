import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const RedirectTest = () => {
  const { user, loading } = useAuth();

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '20px', borderRadius: '8px' }}>
      <h3>🔒 Redirect Test Component</h3>
      <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
      <p><strong>User:</strong> {user ? `${user.full_name || user.username} (${user.role})` : 'Not logged in'}</p>
      <p><strong>Current URL:</strong> {window.location.pathname}</p>
      
      {user && (
        <div style={{ backgroundColor: '#ffeb3b', padding: '10px', marginTop: '10px', borderRadius: '4px' }}>
          ⚠️ <strong>WARNING:</strong> Logged in user accessing public page! 
          Should redirect to: /{user.role}/dashboard
        </div>
      )}
      
      {!user && (
        <div style={{ backgroundColor: '#4caf50', color: 'white', padding: '10px', marginTop: '10px', borderRadius: '4px' }}>
          ✅ <strong>OK:</strong> No user logged in. Public access allowed.
        </div>
      )}
    </div>
  );
};

export default RedirectTest;