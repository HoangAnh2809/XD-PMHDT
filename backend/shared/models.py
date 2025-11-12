from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, DECIMAL, Date, Time, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from .database import Base

class UserRole(str, enum.Enum):
    customer = "customer"
    staff = "staff"
    technician = "technician"
    admin = "admin"

class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class AppointmentType(str, enum.Enum):
    service = "service"
    parts = "parts"
    service_and_parts = "service_and_parts"

class VehicleStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    in_maintenance = "in_maintenance"

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    vnpay = "vnpay"
    momo = "momo"
    bank_transfer = "bank_transfer"

class NotificationType(str, enum.Enum):
    maintenance_reminder = "maintenance_reminder"
    appointment_confirmation = "appointment_confirmation"
    payment_reminder = "payment_reminder"
    service_complete = "service_complete"
    general = "general"

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(Enum(UserRole), nullable=False, default=UserRole.customer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    customer = relationship("Customer", back_populates="user", uselist=False)
    staff = relationship("Staff", back_populates="user", uselist=False)
    technician = relationship("Technician", back_populates="user", uselist=False)

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    address = Column(Text)
    date_of_birth = Column(Date)
    avatar_url = Column(String(500))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="customer")
    vehicles = relationship("Vehicle", back_populates="customer")
    appointments = relationship("Appointment", back_populates="customer")

class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employee_id = Column(String(50), unique=True)
    department = Column(String(100))
    position = Column(String(100))
    hire_date = Column(Date)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="staff")

class Technician(Base):
    __tablename__ = "technicians"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employee_id = Column(String(50), unique=True)
    specialization = Column(String(255))
    certification_number = Column(String(100))
    certification_expiry = Column(Date)
    experience_years = Column(Integer)
    hourly_rate = Column(DECIMAL(10, 2))
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="technician")
    appointments = relationship("Appointment", back_populates="technician")

class ServiceCenter(Base):
    __tablename__ = "service_centers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    working_hours = Column(JSONB)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    appointments = relationship("Appointment", back_populates="service_center")

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"))
    vin = Column(String(17), unique=True, nullable=False)
    make = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    color = Column(String(50))
    battery_capacity = Column(Integer)
    current_mileage = Column(Integer, default=0)
    license_plate = Column(String(20))
    status = Column(Enum(VehicleStatus), default=VehicleStatus.active)
    purchase_date = Column(Date)
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    image_url = Column(String(500))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    customer = relationship("Customer", back_populates="vehicles")
    appointments = relationship("Appointment", back_populates="vehicle")

class ServiceType(Base):
    __tablename__ = "service_types"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    base_price = Column(DECIMAL(10, 2), nullable=False)
    estimated_duration = Column(Integer)  # Changed back to Integer to match database schema
    warranty_period = Column(String(100))
    image_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    appointments = relationship("Appointment", back_populates="service_type")

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"))
    service_center_id = Column(UUID(as_uuid=True), ForeignKey("service_centers.id", ondelete="SET NULL"))
    service_type_id = Column(UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="SET NULL"))
    technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id", ondelete="SET NULL"))
    appointment_date = Column(DateTime, nullable=False)
    appointment_type = Column(Enum(AppointmentType), default=AppointmentType.service, nullable=False)
    parts = Column(JSONB)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.pending)
    customer_notes = Column(Text)
    staff_notes = Column(Text)
    estimated_cost = Column(DECIMAL(10, 2))
    actual_cost = Column(DECIMAL(10, 2))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    customer = relationship("Customer", back_populates="appointments")
    vehicle = relationship("Vehicle", back_populates="appointments")
    service_center = relationship("ServiceCenter", back_populates="appointments")
    service_type = relationship("ServiceType", back_populates="appointments")
    technician = relationship("Technician", back_populates="appointments")

class ServiceRecord(Base):
    __tablename__ = "service_records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"))
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"))
    technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id", ondelete="SET NULL"))
    service_date = Column(DateTime, nullable=False)
    mileage_at_service = Column(Integer)
    services_performed = Column(JSONB)
    parts_used = Column(JSONB)
    labor_hours = Column(DECIMAL(5, 2))
    total_cost = Column(DECIMAL(10, 2))
    diagnosis = Column(Text)
    recommendations = Column(Text)
    next_service_date = Column(Date)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Part(Base):
    __tablename__ = "parts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    part_number = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    quantity_in_stock = Column(Integer, default=0)
    minimum_stock_level = Column(Integer, default=10)
    supplier = Column(String(255))
    compatible_models = Column(JSONB)
    image_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"))
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    service_center_id = Column(UUID(as_uuid=True), ForeignKey("service_centers.id", ondelete="SET NULL"))
    issue_date = Column(DateTime, default=func.now())
    due_date = Column(Date)
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    tax = Column(DECIMAL(10, 2), default=0)
    discount = Column(DECIMAL(10, 2), default=0)
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    payment_method = Column(Enum(PaymentMethod))
    payment_date = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"))
    transaction_id = Column(String(255), unique=True)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    payment_gateway_response = Column(JSONB)
    payment_date = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    related_entity_type = Column(String(50))
    related_entity_id = Column(UUID(as_uuid=True))
    scheduled_date = Column(DateTime)
    sent_date = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class ServiceChecklist(Base):
    __tablename__ = "service_checklists"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_type_id = Column(UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    service_type = relationship("ServiceType")
    items = relationship("ChecklistItem", back_populates="checklist")

class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checklist_id = Column(UUID(as_uuid=True), ForeignKey("service_checklists.id", ondelete="CASCADE"))
    category = Column(String(100), nullable=False)
    item_name = Column(String(255), nullable=False)
    description = Column(Text)
    estimated_cost = Column(DECIMAL(10, 2), default=0)  # Cost for this checklist item
    is_required = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    
    checklist = relationship("ServiceChecklist", back_populates="items")

class AppointmentChecklistProgress(Base):
    __tablename__ = "appointment_checklist_progress"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"))
    checklist_item_id = Column(UUID(as_uuid=True), ForeignKey("checklist_items.id", ondelete="CASCADE"))
    is_completed = Column(Boolean, default=False)
    notes = Column(Text)
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    appointment = relationship("Appointment")
    checklist_item = relationship("ChecklistItem")
    completed_by_user = relationship("User")
