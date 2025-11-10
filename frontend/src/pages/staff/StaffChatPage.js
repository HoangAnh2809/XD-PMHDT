import React, { useState, useEffect, useRef } from 'react';
import StaffLayout from '../../components/StaffLayout';
import { chatAPI } from '../../services/api';

export default function StaffChatPage() {
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [ws, setWs] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession.id);
      connectWebSocket(selectedSession.id);
    }
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [selectedSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadActiveSessions = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getAllActiveSessions();
      setActiveSessions(response.data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (sessionId) => {
    try {
      const response = await chatAPI.getMessages(sessionId);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const connectWebSocket = (sessionId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const websocket = chatAPI.connectWebSocket(sessionId, token);

    websocket.onopen = () => {
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      setMessages(prev => {
        // Check for duplicates by message ID
        const exists = prev.find(m => m.id === message.message_id);
        if (exists) return prev;
        
        // Check if this replaces a temporary message
        const tempIndex = prev.findIndex(m => m.is_temp && m.content === message.content && m.sender_type === message.sender_type);
        if (tempIndex !== -1) {
          // Replace temporary message with real one
          const updatedMessages = [...prev];
          updatedMessages[tempIndex] = {
            id: message.message_id,
            sender_id: message.sender_id,
            sender_type: message.sender_type,
            content: message.content,
            message_type: message.type,
            created_at: message.timestamp,
            message_metadata: message.metadata
          };
          return updatedMessages;
        }
        
        // Add new message and sort by creation time to ensure proper order
        const newMessage = {
          id: message.message_id,
          sender_id: message.sender_id,
          sender_type: message.sender_type,
          content: message.content,
          message_type: message.type,
          created_at: message.timestamp,
          message_metadata: message.metadata
        };
        
        return [...prev, newMessage].sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        );
      });
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
    };

    setWs(websocket);
  };

  const joinSession = async (session) => {
    try {
      await chatAPI.joinSessionAsStaff(session.id);
      setSelectedSession(session);
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Không thể tham gia phiên chat');
    }
  };

  const deleteSession = async (sessionId, sessionTitle) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cuộc trò chuyện "${sessionTitle || 'Phiên chat'}"?\n\nHành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await chatAPI.closeSession(sessionId);
      
      // Close WebSocket if this is the selected session
      if (selectedSession?.id === sessionId && ws) {
        ws.close();
      }
      
      // Clear selected session if deleted
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setMessages([]);
      }
      
      // Reload sessions list
      await loadActiveSessions();
      
      alert('✅ Đã xóa cuộc trò chuyện thành công!');
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('❌ Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws || !selectedSession) return;

    const messageData = {
      content: newMessage.trim(),
      message_type: 'text'
    };

    // Create temporary message for immediate display
    const tempMessage = {
      id: `temp-${Date.now()}`, // Temporary ID for immediate display
      content: newMessage.trim(),
      message_type: 'text',
      sender_type: 'staff',
      sender_id: 'current-user', // Will be replaced by actual user ID
      created_at: new Date().toISOString(),
      is_temp: true // Mark as temporary
    };

    // Immediately add message to UI
    setMessages(prev => [...prev, tempMessage]);

    // Send via WebSocket
    ws.send(JSON.stringify(messageData));

    setNewMessage('');
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <StaffLayout>
        <div className="loading">Đang tải...</div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="container" style={{ maxWidth: '100%', padding: 0 }}>
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
          {/* Sessions List */}
          <div style={{
            width: '350px',
            borderRight: '1px solid #ddd',
            overflowY: 'auto',
            background: '#f8f9fa'
          }}>
            <div style={{ padding: '1rem', borderBottom: '2px solid #ddd', background: 'white' }}>
              <h3 style={{ margin: 0 }}>💬 Phiên chat đang hoạt động</h3>
              <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                {activeSessions.length} phiên đang chờ
              </p>
            </div>

            {activeSessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                <p>📭 Không có phiên chat nào đang hoạt động</p>
              </div>
            ) : (
              <div>
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e9ecef',
                      background: selectedSession?.id === session.id ? '#e7f3ff' : 'white',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div 
                      onClick={() => joinSession(session)}
                      style={{ cursor: 'pointer', flex: 1 }}
                      onMouseEnter={(e) => {
                        if (selectedSession?.id !== session.id) {
                          e.currentTarget.parentElement.style.background = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSession?.id !== session.id) {
                          e.currentTarget.parentElement.style.background = 'white';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>{session.title || 'Phiên chat'}</strong>
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                          {formatTime(session.updated_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        📱 {session.session_type || 'Hỗ trợ'}
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id, session.title);
                        }}
                        className="btn btn-sm btn-danger"
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.85rem'
                        }}
                      >
                        🗑️ Xóa cuộc trò chuyện
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
            {!selectedSession ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <h2>👈 Chọn một phiên chat để bắt đầu</h2>
                  <p>Nhấn vào phiên chat bên trái để tham gia hỗ trợ khách hàng</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div style={{
                  padding: '1rem',
                  borderBottom: '2px solid #e9ecef',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ margin: 0 }}>💬 {selectedSession.title || 'Phiên chat'}</h3>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                      Loại: {selectedSession.session_type} • Bắt đầu: {formatDate(selectedSession.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSession(selectedSession.id, selectedSession.title)}
                    className="btn btn-danger"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      background: 'rgba(220, 53, 69, 0.9)',
                      border: 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(200, 35, 51, 1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(220, 53, 69, 0.9)'}
                  >
                    🗑️ Xóa cuộc trò chuyện
                  </button>
                </div>

                {/* Messages */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem',
                  background: '#f8f9fa'
                }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                      <p>Chưa có tin nhắn nào</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, index) => (
                        <div
                          key={msg.id || index}
                          style={{
                            marginBottom: '1rem',
                            display: 'flex',
                            justifyContent: msg.sender_type === 'staff' ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{
                            maxWidth: '70%',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            background: msg.sender_type === 'staff' ? '#667eea' : 
                                       msg.sender_type === 'ai' ? '#ffc107' : 
                                       msg.sender_type === 'customer' ? '#28a745' : 'white',
                            color: msg.sender_type === 'staff' || msg.sender_type === 'ai' || msg.sender_type === 'customer' ? 'white' : '#212529',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            border: msg.sender_type === 'customer' ? 'none' : '1px solid #e9ecef',
                            opacity: msg.is_temp ? 0.7 : 1 // Make temporary messages slightly transparent
                          }}>
                            <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', opacity: 0.9 }}>
                              {msg.sender_type === 'staff' ? '👨‍💼 Nhân viên hỗ trợ' :
                               msg.sender_type === 'ai' ? '🤖 AI Assistant' :
                               msg.sender_type === 'customer' ? '👤 Khách hàng' : 
                               msg.sender_type === 'technician' ? '🔧 Kỹ thuật viên' : msg.sender_type}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.content}</div>
                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8, textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                {msg.sender_type === 'staff' ? 'Bạn' : msg.sender_type}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {formatTime(msg.created_at)}
                                {msg.is_temp && (
                                  <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                    ⏳
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <form onSubmit={sendMessage} style={{
                  padding: '1rem',
                  borderTop: '1px solid #e9ecef',
                  display: 'flex',
                  gap: '0.5rem'
                }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={!ws ? "Đang kết nối..." : "Nhập tin nhắn..."}
                    className="form-control"
                    style={{ flex: 1 }}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!ws || !newMessage.trim()}
                  >
                    {!ws ? '⏳ Kết nối...' : '📤'} Gửi
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
