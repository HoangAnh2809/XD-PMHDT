from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class NotificationCreate(BaseModel):
    user_id: UUID
    type: str
    title: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None

class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    is_read: bool
    related_entity_type: Optional[str]
    related_entity_id: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True
