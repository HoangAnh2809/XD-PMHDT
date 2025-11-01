"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field, field_serializer, model_serializer
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class SessionTypeEnum(str, Enum):
    CUSTOMER_SUPPORT = "customer_support"
    AI_ASSISTANT = "ai_assistant"
    TECHNICIAN_CUSTOMER = "technician_customer"
    INTERNAL = "internal"


class SessionStatusEnum(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class MessageTypeEnum(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"
    AI_RESPONSE = "ai_response"


# ==================== Chat Session Schemas ====================

class ChatSessionCreate(BaseModel):
    session_type: SessionTypeEnum
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class ChatSessionResponse(BaseModel):
    id: str
    session_type: str
    title: Optional[str]
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    metadata: Any = Field(default_factory=dict, validation_alias='session_metadata', serialization_alias='metadata')
    
    @field_serializer('metadata')
    def serialize_metadata(self, value, _info):
        """Convert metadata to dict for JSON serialization"""
        if value is None or (hasattr(value, '__class__') and 'MetaData' in value.__class__.__name__):
            return {}
        if isinstance(value, dict):
            return value
        return {}
    
    class Config:
        from_attributes = True
        populate_by_name = True


# ==================== Chat Message Schemas ====================

class ChatMessageCreate(BaseModel):
    message_type: MessageTypeEnum = MessageTypeEnum.TEXT
    content: str
    metadata: Optional[Dict[str, Any]] = {}


class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    sender_id: str
    sender_type: str
    message_type: str
    content: str
    created_at: datetime
    is_read: int
    metadata: Any = Field(default_factory=dict, validation_alias='message_metadata', serialization_alias='metadata')
    
    @field_serializer('metadata')
    def serialize_metadata(self, value, _info):
        """Convert metadata to dict for JSON serialization"""
        if value is None or (hasattr(value, '__class__') and 'MetaData' in value.__class__.__name__):
            return {}
        if isinstance(value, dict):
            return value
        return {}
    
    class Config:
        from_attributes = True
        populate_by_name = True


# ==================== AI Assistant Schemas ====================

class AIRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = {}


class AIResponse(BaseModel):
    content: str
    confidence: Optional[float] = None
    suggestions: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}


# ==================== WebSocket Schemas ====================

class WebSocketMessage(BaseModel):
    type: str  # 'text', 'image', 'system', etc.
    content: str
    to_ai: bool = False
    metadata: Optional[Dict[str, Any]] = {}
