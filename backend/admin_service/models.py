from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship, backref
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from main import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True,
                default=uuid.uuid4, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    role = Column(String)  # admin, staff, technician, customer
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    password_hash = Column(String)

    # Staff-specific fields (stored as JSON for flexibility)
    branch_id = Column(UUID(as_uuid=True), ForeignKey(
        "service_centers.id"), nullable=True)
    position = Column(String, nullable=True)
    hire_date = Column(DateTime, nullable=True)
    salary = Column(Float, nullable=True)
    # morning, afternoon, night, flexible
    shift = Column(String, nullable=True)
    skills = Column(JSON, nullable=True)  # For technicians
