# Mã nguồn thực tế từ backend/chat_service/schemas.py
# Schemas for chat service (placeholder)
from pydantic import BaseModel
from datetime import datetime

class ChatMessageSchema(BaseModel):
    sender: str
    content: str
    timestamp: datetime