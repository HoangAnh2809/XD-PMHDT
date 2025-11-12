from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

# Vehicle Schemas
class VehicleCreate(BaseModel):
    vin: str
    make: str
    model: str
    year: int
    color: Optional[str] = None
    battery_capacity: Optional[int] = None
    current_mileage: int = 0
    license_plate: Optional[str] = None
    purchase_date: Optional[date] = None

class VehicleUpdate(BaseModel):
    color: Optional[str] = None
    current_mileage: Optional[int] = None
    license_plate: Optional[str] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None

class VehicleResponse(BaseModel):
    id: UUID
    vin: str
    make: str
    model: str
    year: int
    color: Optional[str]
    battery_capacity: Optional[int]
    current_mileage: int
    license_plate: Optional[str]
    status: str
    purchase_date: Optional[date]
    last_maintenance_date: Optional[date]
    next_maintenance_date: Optional[date]
    image_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Service Type Schema
class ServiceTypeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    base_price: float
    estimated_duration: Optional[int]
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

# Service Center Schema
class ServiceCenterResponse(BaseModel):
    id: UUID
    name: str
    address: str
    phone: Optional[str]
    email: Optional[str]
    working_hours: Optional[dict]

    class Config:
        from_attributes = True

# Appointment Schemas
class AppointmentCreate(BaseModel):
    vehicle_id: UUID
    service_center_id: UUID
    service_type_id: Optional[UUID] = None
    appointment_date: datetime
    appointment_type: str = "service"  # "service", "parts", "service_and_parts"
    parts: Optional[List[dict]] = None  # List of parts with id and quantity
    customer_notes: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    service_center_id: UUID
    service_type_id: Optional[UUID]
    appointment_date: datetime
    appointment_type: str
    parts: Optional[List[dict]]
    status: str
    customer_notes: Optional[str]
    staff_notes: Optional[str]
    estimated_cost: Optional[float]
    actual_cost: Optional[float]
    invoice_id: Optional[UUID]
    created_at: datetime
    vehicle: Optional[VehicleResponse]
    service_center: Optional[ServiceCenterResponse]
    service_type: Optional[ServiceTypeResponse]

    class Config:
        from_attributes = True

# Parts Schema
class PartResponse(BaseModel):
    id: UUID
    part_number: str
    name: str
    description: Optional[str]
    category: Optional[str]
    unit_price: float
    quantity_in_stock: int
    image_url: Optional[str]

    class Config:
        from_attributes = True

# Maintenance Reminder Schema
class MaintenanceReminderResponse(BaseModel):
    vehicle_id: str
    vehicle_info: str
    reminder_type: str
    due_date: Optional[date]
    message: str

# Service History Schema
class ServiceHistoryResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    service_center_id: Optional[UUID]
    service_date: datetime
    mileage_at_service: Optional[int]
    services_performed: Optional[dict]
    total_cost: Optional[float]
    diagnosis: Optional[str]
    recommendations: Optional[str]
    vehicle: Optional[VehicleResponse]
    service_center: Optional[ServiceCenterResponse]
    technician: Optional[dict]  # Simple dict for technician info

    class Config:
        from_attributes = True

# Customer Profile Schemas
class CustomerProfileResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    phone: Optional[str]
    address: Optional[str]
    date_of_birth: Optional[date]
    avatar_url: Optional[str]

class CustomerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
