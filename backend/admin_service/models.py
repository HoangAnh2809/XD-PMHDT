from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON, Time, Date, Time, Date
from sqlalchemy.orm import relationship, backref
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from main import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
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
    
    # Relationships to staff and technician tables
    staff_profile = relationship("Staff", uselist=False, lazy='joined')
    technician_profile = relationship("Technician", uselist=False, lazy='joined')

# Define Staff and Technician models locally for admin_service
class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employee_id = Column(String(50), unique=True)
    department = Column(String(100))
    position = Column(String(100))
    hire_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User")

class Technician(Base):
    __tablename__ = "technicians"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employee_id = Column(String(50), unique=True)
    specialization = Column(String(255))
    certification_number = Column(String(100))
    certification_expiry = Column(DateTime)
    experience_years = Column(Integer)
    hourly_rate = Column(Float)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User")

class Branch(Base):
    __tablename__ = "service_centers"  # Use existing table
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True)
    address = Column(Text)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    working_hours = Column(JSON, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

class Inventory(Base):
    __tablename__ = "parts"  # Use existing parts table
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    part_number = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    category = Column(String)
    unit_price = Column(Float)
    quantity_in_stock = Column(Integer, default=0)
    minimum_stock_level = Column(Integer, default=10)
    supplier = Column(String)
    location = Column(String, nullable=True)  # Add location field
    compatible_models = Column(JSON, nullable=True)
    image_url = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

class ServiceType(Base):
    __tablename__ = "service_types"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    base_price = Column(Float, nullable=False)
    estimated_duration = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), nullable=True)
    service_center_id = Column(UUID(as_uuid=True), ForeignKey("service_centers.id"), nullable=True)
    service_type_id = Column(UUID(as_uuid=True), ForeignKey("service_types.id"), nullable=True)
    technician_id = Column(UUID(as_uuid=True), nullable=True)
    appointment_date = Column(DateTime)
    status = Column(String, default='pending')  # pending, confirmed, in_progress, completed, cancelled
    customer_notes = Column(Text, nullable=True)
    staff_notes = Column(Text, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    
    # Add service_type relationship
    service_type = relationship("ServiceType")

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String)
    entity_type = Column(String, nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSON, nullable=True)  # Changed from meta_data to match DB schema
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class SystemSettings(Base):
    __tablename__ = "system_settings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(Text)
    category = Column(String)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WorkSchedule(Base):
    __tablename__ = "work_schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id"), nullable=False)
    service_center_id = Column(UUID(as_uuid=True), ForeignKey("service_centers.id"), nullable=False)
    shift_date = Column(Date, nullable=False)
    shift_start = Column(Time, nullable=False)
    shift_end = Column(Time, nullable=False)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    
    # Relationships
    technician = relationship("Technician")
    service_center = relationship("Branch")
