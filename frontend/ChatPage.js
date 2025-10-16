import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { chatAPI } from '../../services/api';
import serviceChecker from '../../utils/serviceChecker';

const ChatPage = () => {
  return (
    <div>
      <h1>Chat</h1>
      {/* Nội dung trang chat */}
    </div>
  );
};

export default ChatPage;