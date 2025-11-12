import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { chatAPI } from '../../services/api';
import serviceChecker from '../../utils/serviceChecker';

const ChatPage = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [chatServiceAvailable, setChatServiceAvailable] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadSessions();
    
    return () => {
      // Cleanup WebSocket on unmount
      if (ws) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async () => {
    // Check if chat service is available
    const chatAvailable = serviceChecker.isAvailable('chat');
    
    // If we know it's unavailable, skip the request
    if (chatAvailable === false) {
      setChatServiceAvailable(false);
      setSessions([]);
      return;
    }

    try {
      const response = await chatAPI.getMySessions();
      setSessions(response.data || []);
      setChatServiceAvailable(true);
      serviceChecker.markAvailable('chat');
    } catch (error) {
      // Chat service not ready - gracefully handled in UI
      setChatServiceAvailable(false);
      setSessions([]);
      serviceChecker.markUnavailable('chat');
    }
  };

  const createNewSession = async () => {
    try {
      setLoading(true);
      const sessionData = {
        session_type: 'customer_support',
        title: 'Hỗ trợ khách hàng',
        metadata: {
          customer_id: user.id
        }
      };
      const response = await chatAPI.createSession(sessionData);
      const newSession = response.data;
      
      setSessions([newSession, ...sessions]);
      selectSession(newSession);
      setChatServiceAvailable(true);
    } catch (error) {
      // Cannot create chat session - service unavailable
      setChatServiceAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (session) => {
    // Close existing WebSocket
    if (ws) {
      ws.close();
    }

    setActiveSession(session);
    setMessages([]);
    setIsConnected(false);

    try {
      // Load message history with higher limit to ensure all messages are loaded
      const response = await chatAPI.getMessages(session.id, 500, 0); // Load up to 500 messages
      const messagesData = response.data || [];
      setMessages(messagesData);
      
      // Check if there might be more messages (if we got exactly 500, there might be more)
      setHasMoreMessages(messagesData.length === 500);

      // Connect WebSocket
      const token = localStorage.getItem('token');
      const websocket = chatAPI.connectWebSocket(session.id, token);

      websocket.onopen = () => {
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        setMessages(prev => {
          // Check for duplicates by message ID
          const exists = prev.find(m => m.id === message.id);
          if (exists) return prev;
          
          // Check if this replaces a temporary message
          const tempIndex = prev.findIndex(m => m.is_temp && m.content === message.content && m.sender_id === message.sender_id);
          if (tempIndex !== -1) {
            // Replace temporary message with real one
            const updatedMessages = [...prev];
            updatedMessages[tempIndex] = message;
            return updatedMessages;
          }
          
          // Add new message and sort by creation time to ensure proper order
          const updatedMessages = [...prev, message].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          return updatedMessages;
        });
      };

      websocket.onerror = (error) => {
        setIsConnected(false);
      };

      websocket.onclose = () => {
        setIsConnected(false);
      };

      setWs(websocket);
    } catch (error) {
      // Session loading failed
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws || !isConnected) return;

    const messageData = {
      content: newMessage.trim(),
      message_type: 'text',
      sender_id: user.id,
      sender_type: 'customer'
    };

    // Create temporary message for immediate display
    const tempMessage = {
      id: `temp-${Date.now()}`, // Temporary ID for immediate display
      content: newMessage.trim(),
      message_type: 'text',
      sender_type: 'customer',
      sender_id: user.id,
      created_at: new Date().toISOString(),
      is_temp: true // Mark as temporary
    };

    // Immediately add message to UI
    setMessages(prev => [...prev, tempMessage]);

    // Send via WebSocket
    ws.send(JSON.stringify(messageData));
    
    setNewMessage('');
  };

  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;

    try {
      setAiLoading(true);
      const response = await chatAPI.askAI(
        aiQuestion,
        activeSession?.id || null,
        { user_type: 'customer' }
      );

      // Add AI response to messages
      const aiMessage = {
        id: Date.now(),
        content: response.data.answer,
        message_type: 'text',
        sender_type: 'ai_assistant',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
      setAiQuestion('');
      setShowAIAssistant(false);
    } catch (error) {
      // AI assistant not available
      alert('Không thể kết nối AI Assistant. Vui lòng thử lại.');
    } finally {
      setAiLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!activeSession || loadingMoreMessages) return;

    try {
      setLoadingMoreMessages(true);
      const response = await chatAPI.getMessages(activeSession.id, 500, messages.length);
      const newMessages = response.data || [];
      
      if (newMessages.length > 0) {
        setMessages(prev => {
          // Filter out any duplicates and add older messages to the beginning
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
          
          // Combine and sort by creation time
          const combinedMessages = [...uniqueNewMessages, ...prev].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          
          return combinedMessages;
        });
        setHasMoreMessages(newMessages.length === 500); // If we got exactly 500, there might be more
      } else {
        setHasMoreMessages(false); // No more messages available
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  return (
    <div>
      <Navbar />
      
      <div className="hero" style={{ padding: '2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <h1 style={{ color: 'white', margin: 0 }}>💬 Chat trực tuyến</h1>
        <p style={{ color: 'white', opacity: 0.9, margin: '0.5rem 0 0' }}>
          Trò chuyện với nhân viên trung tâm hoặc AI Assistant
        </p>
      </div>

      <div className="container" style={{ maxWidth: '1400px', padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', height: 'calc(100vh - 250px)' }}>
          
          {/* Sidebar - Sessions List */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee' }}>
              <button 
                onClick={createNewSession}
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading ? 'Đang tạo...' : '+ Cuộc trò chuyện mới'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                  <p style={{ fontSize: '0.9rem' }}>Chưa có cuộc trò chuyện nào</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => selectSession(session)}
                    style={{
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: activeSession?.id === session.id ? '#667eea' : '#f8f9fa',
                      color: activeSession?.id === session.id ? 'white' : '#1a1a2e',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      Chat #{session.id?.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                      {formatDate(session.created_at)} {formatTime(session.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!activeSession ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '2rem' }}>
                {chatServiceAvailable ? (
                  <>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
                    <h2 style={{ marginBottom: '0.5rem', color: '#1a1a2e' }}>Chào mừng đến Chat hỗ trợ</h2>
                    <p style={{ color: '#666', marginBottom: '2rem' }}>
                      Chọn cuộc trò chuyện hoặc tạo mới để bắt đầu
                    </p>
                    <button 
                      onClick={createNewSession}
                      className="btn btn-primary btn-large"
                      disabled={loading}
                    >
                      {loading ? 'Đang tạo...' : 'Bắt đầu chat ngay'}
                    </button>
                  </>
                ) : (
                  <div style={{ maxWidth: '600px', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
                    <h2 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>Dịch vụ Chat tạm thời không khả dụng</h2>
                    <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6' }}>
                      Chúng tôi đang nâng cấp hệ thống chat để phục vụ bạn tốt hơn. 
                      Vui lòng sử dụng các phương thức liên hệ khác bên dưới.
                    </p>
                    
                    <div style={{ 
                      background: '#f8f9fa', 
                      padding: '2rem', 
                      borderRadius: '12px',
                      marginBottom: '1.5rem'
                    }}>
                      <h3 style={{ marginBottom: '1.5rem', color: '#1a1a2e' }}>📞 Các cách liên hệ khác:</h3>
                      
                      <div style={{ display: 'grid', gap: '1rem', textAlign: 'left' }}>
                        <a href="tel:1900xxxx" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem',
                          padding: '1rem',
                          background: 'white',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#1a1a2e',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'transform 0.2s'
                        }}>
                          <span style={{ fontSize: '2rem' }}>📞</span>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>Hotline</div>
                            <div style={{ color: '#667eea' }}>1900 xxxx (24/7)</div>
                          </div>
                        </a>

                        <a href="mailto:support@evmaintenance.com" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem',
                          padding: '1rem',
                          background: 'white',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#1a1a2e',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <span style={{ fontSize: '2rem' }}>📧</span>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>Email</div>
                            <div style={{ color: '#667eea' }}>support@evmaintenance.com</div>
                          </div>
                        </a>

                        <a href="/contact" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem',
                          padding: '1rem',
                          background: 'white',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#1a1a2e',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <span style={{ fontSize: '2rem' }}>🏢</span>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>Trang liên hệ</div>
                            <div style={{ color: '#667eea' }}>Gửi yêu cầu hỗ trợ</div>
                          </div>
                        </a>
                      </div>
                    </div>

                    <button 
                      onClick={loadSessions}
                      className="btn btn-secondary"
                    >
                      🔄 Thử lại
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div style={{ 
                  padding: '1.5rem', 
                  borderBottom: '2px solid #eee',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0' }}>Chat #{activeSession.id?.substring(0, 8)}</h3>
                      <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                        {isConnected ? '🟢 Đang kết nối' : '🔴 Mất kết nối'}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAIAssistant(true)}
                      className="btn"
                      style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: 'none' }}
                    >
                      🤖 AI Assistant
                    </button>
                  </div>
                </div>

                {/* Messages Area */}
                <div style={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  padding: '1.5rem',
                  background: '#f8f9fa'
                }}>
                  {hasMoreMessages && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      <button
                        onClick={loadMoreMessages}
                        className="btn btn-outline"
                        disabled={loadingMoreMessages}
                        style={{ fontSize: '0.9rem' }}
                      >
                        {loadingMoreMessages ? '⏳ Đang tải...' : '📚 Tải thêm tin nhắn cũ'}
                      </button>
                    </div>
                  )}
                  
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
                      <p>Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isMyMessage = msg.sender_type === 'customer' && msg.sender_id === user.id;
                      const isAI = msg.sender_type === 'ai_assistant';
                      const isStaff = msg.sender_type === 'staff' || msg.sender_type === 'technician';
                      
                      return (
                        <div
                          key={msg.id || index}
                          style={{
                            display: 'flex',
                            justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                            marginBottom: '1rem'
                          }}
                        >
                          <div style={{
                            maxWidth: '70%',
                            padding: '1rem 1.25rem',
                            borderRadius: '16px',
                            background: isMyMessage ? '#667eea' : (isAI ? '#764ba2' : (isStaff ? '#28a745' : '#f8f9fa')),
                            color: isMyMessage || isAI || isStaff ? 'white' : '#1a1a2e',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            border: isMyMessage ? 'none' : '1px solid #e9ecef',
                            opacity: msg.is_temp ? 0.7 : 1 // Make temporary messages slightly transparent
                          }}>
                            {!isMyMessage && (
                              <div style={{ 
                                fontSize: '0.8rem', 
                                marginBottom: '0.5rem', 
                                opacity: 0.8,
                                fontWeight: 'bold'
                              }}>
                                {isAI ? '🤖 AI Assistant' : (isStaff ? '👤 Nhân viên hỗ trợ' : '💬 Hệ thống')}
                              </div>
                            )}
                            <div style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                              {msg.content}
                            </div>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              opacity: 0.7,
                              textAlign: 'right',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                {isMyMessage ? 'Bạn' : (msg.message_type === 'ai_response' ? 'AI' : msg.sender_type)}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {formatTime(msg.created_at)}
                                {isMyMessage && !msg.is_temp && (
                                  <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                    {msg.is_read ? '✓✓' : '✓'}
                                  </span>
                                )}
                                {isMyMessage && msg.is_temp && (
                                  <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                    ⏳
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div style={{ padding: '1.5rem', borderTop: '2px solid #eee', background: 'white' }}>
                  <form onSubmit={sendMessage} style={{ display: 'flex', gap: '1rem' }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Nhập tin nhắn..."
                      className="form-control"
                      style={{ flex: 1 }}
                      disabled={!isConnected}
                    />
                    <button 
                      type="submit"
                      className="btn btn-primary"
                      disabled={!isConnected || !newMessage.trim()}
                      style={{ minWidth: '100px' }}
                    >
                      {isConnected ? '📤 Gửi' : '⏳ Đang kết nối...'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div className="modal-overlay" onClick={() => setShowAIAssistant(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <button 
              className="modal-close"
              onClick={() => setShowAIAssistant(false)}
            >
              ✕
            </button>
            
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)', padding: '2rem' }}>
              <h2 style={{ color: 'white', margin: 0 }}>🤖 AI Assistant</h2>
              <p style={{ color: 'white', opacity: 0.9, margin: '0.5rem 0 0' }}>
                Hỏi AI về bảo dưỡng xe điện
              </p>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleAskAI}>
                <div className="form-group">
                  <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                    Câu hỏi của bạn:
                  </label>
                  <textarea
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ví dụ: Làm sao để kiểm tra pin xe điện?"
                    className="form-control"
                    rows="4"
                    disabled={aiLoading}
                  />
                </div>

                <div style={{ 
                  padding: '1rem', 
                  background: '#f8f9fa', 
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>💡 Gợi ý câu hỏi:</div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    • Khi nào cần thay pin xe điện?<br />
                    • Cách kiểm tra tình trạng động cơ điện?<br />
                    • Bảo dưỡng xe điện như thế nào?<br />
                    • Tại sao xe điện bị mất công suất?
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    type="button"
                    onClick={() => setShowAIAssistant(false)}
                    className="btn btn-outline btn-large"
                    disabled={aiLoading}
                  >
                    Đóng
                  </button>
                  <button 
                    type="submit"
                    className="btn btn-primary btn-large"
                    disabled={aiLoading || !aiQuestion.trim()}
                  >
                    {aiLoading ? '⏳ Đang hỏi AI...' : '🤖 Hỏi ngay'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
