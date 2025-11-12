"""
Database models for chat service
"""
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from database import Base
from sqlalchemy import event


class SessionType(str, enum.Enum):
    """Types of chat sessions"""
    CUSTOMER_SUPPORT = "customer_support"
    AI_ASSISTANT = "ai_assistant"
    TECHNICIAN_CUSTOMER = "technician_customer"
    INTERNAL = "internal"


class SessionStatus(str, enum.Enum):
    """Status of chat sessions"""
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class MessageType(str, enum.Enum):
    """Types of messages"""
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"
    AI_RESPONSE = "ai_response"


class ChatSession(Base):
    """
    Chat sessions table
    Stores all chat conversations
    """
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_type = Column(String(50), nullable=False)  # VARCHAR with CHECK constraint
    title = Column(String(200))
    status = Column(String(50), default=SessionStatus.ACTIVE.value)  # VARCHAR with CHECK constraint
    created_by = Column(String(100), nullable=False)  # user_id of creator
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    session_metadata = Column(JSON, default={})  # Additional data (service_id, vehicle_id, etc.)
    
    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    participants = relationship("ChatParticipant", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """
    Chat messages table
    Stores all messages in chat sessions
    """
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String(100), nullable=False)  # user_id or 'ai_assistant'
    sender_type = Column(String(50), nullable=False)  # 'customer', 'technician', 'staff', 'ai', 'system'
    # store message_type as plain string (lowercase) to match DB CHECK constraint
    message_type = Column(String(50), default=MessageType.TEXT.value)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    is_read = Column(Integer, default=0)  # 0 = unread, 1 = read
    message_metadata = Column(JSON, default={})  # File URLs, image URLs, AI context, etc.
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")


@event.listens_for(ChatMessage, 'before_insert')
def normalize_message_type(mapper, connection, target):
    """Ensure message_type is stored as lowercase string to satisfy DB CHECK constraint."""
    try:
        mt = target.message_type
        if mt is None:
            target.message_type = 'text'
        elif isinstance(mt, str):
            target.message_type = mt.lower()
        else:
            # Could be an Enum member
            try:
                target.message_type = str(mt.value).lower()
            except Exception:
                try:
                    target.message_type = str(mt).lower()
                except Exception:
                    target.message_type = 'text'
    except Exception:
        target.message_type = 'text'


class ChatParticipant(Base):
    """
    Chat participants table
    Tracks who has access to each chat session
    """
    __tablename__ = "chat_participants"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(100), nullable=False)
    user_type = Column(String(50), nullable=False)  # 'customer', 'technician', 'staff', 'admin'
    role = Column(String(50), default='member')  # 'creator', 'member', 'observer'
    joined_at = Column(DateTime, default=datetime.now)
    last_read_at = Column(DateTime)  # Track read status
    
    # Relationships
    session = relationship("ChatSession", back_populates="participants")
