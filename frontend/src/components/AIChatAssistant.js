/**
 * AI Chat Assistant Component
 * Real-time chat with AI assistant using WebSocket
 * 
 * Features:
 * - WebSocket connection for real-time messaging
 * - Message history loading
 * - AI response integration
 * - Auto-scroll to latest message
 * - Connection status indicator
 */

import React, { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../services/api';
import './AIChatAssistant.css';

function AIChatAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat session and WebSocket connection
  useEffect(() => {
    initializeChat();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const initializeChat = async () => {
    try {
      setIsLoading(true);

      // Create new chat session
      const response = await chatAPI.createSession({
        session_type: 'ai_assistant',
        title: 'AI Assistant Chat',
        metadata: {
          source: 'web_app',
          timestamp: new Date().toISOString()
        }
      });

      const sid = response.data.id;
      setSessionId(sid);

      // Load message history (if any)
      const historyResponse = await chatAPI.getMessages(sid);
      if (historyResponse.data.length > 0) {
        setMessages(historyResponse.data.reverse());
      }

      // Connect to WebSocket
      const token = localStorage.getItem('token');
      const websocket = chatAPI.connectWebSocket(sid, token);

      websocket.onopen = () => {
        setIsConnected(true);
        setIsLoading(false);
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        // Ignore system messages
        if (message.type !== 'system') {
          setMessages((prev) => [...prev, message]);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      websocket.onclose = () => {
        setIsConnected(false);
      };

      setWs(websocket);

    } catch (error) {
      console.error('Failed to initialize chat:', error);
      setIsLoading(false);
      alert('Không thể kết nối tới chat service. Vui lòng thử lại.');
    }
  };

  const sendMessage = () => {
    if (!ws || !input.trim() || !isConnected) return;

    // Send message via WebSocket
    ws.send(JSON.stringify({
      type: 'text',
      content: input,
      to_ai: true,  // Request AI response
      metadata: {}
    }));

    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSenderName = (message) => {
    if (message.sender_type === 'ai') {
      return '🤖 AI Assistant';
    }
    return '👤 Bạn';
  };

  const getSenderClass = (message) => {
    return message.sender_type === 'ai' ? 'ai-message' : 'user-message';
  };

  if (isLoading) {
    return (
      <div className="chat-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Đang kết nối tới AI Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <h2>🤖 AI Assistant</h2>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          {isConnected ? 'Đã kết nối' : 'Mất kết nối'}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h3>👋 Xin chào!</h3>
            <p>Tôi là AI Assistant của EV Service Center.</p>
            <p>Tôi có thể giúp bạn với:</p>
            <ul>
              <li>💡 Tư vấn bảo dưỡng xe điện</li>
              <li>📅 Đặt lịch hẹn</li>
              <li>🔧 Giải đáp vấn đề kỹ thuật</li>
              <li>💰 Thông tin về giá cả và dịch vụ</li>
            </ul>
            <p>Hãy hỏi tôi bất cứ điều gì!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`message-wrapper ${getSenderClass(message)}`}
            >
              <div className="message-bubble">
                <div className="message-header">
                  <span className="sender-name">{getSenderName(message)}</span>
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                </div>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            isConnected
              ? 'Nhập tin nhắn... (Enter để gửi)'
              : 'Đang kết nối lại...'
          }
          disabled={!isConnected}
          rows="2"
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected || !input.trim()}
          className="send-button"
        >
          <span>Gửi</span>
          <span className="send-icon">📤</span>
        </button>
      </div>

      {/* Quick Suggestions */}
      {messages.length === 0 && (
        <div className="quick-suggestions">
          <p>Câu hỏi gợi ý:</p>
          <div className="suggestions-grid">
            <button onClick={() => setInput('Xe của tôi cần bảo dưỡng định kỳ')}>
              Bảo dưỡng định kỳ
            </button>
            <button onClick={() => setInput('Làm sao để đặt lịch hẹn?')}>
              Đặt lịch hẹn
            </button>
            <button onClick={() => setInput('Giá dịch vụ bao nhiêu?')}>
              Bảng giá dịch vụ
            </button>
            <button onClick={() => setInput('Cách bảo quản pin xe điện?')}>
              Bảo quản pin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIChatAssistant;
