from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, date, time
from uuid import UUID

# Appointment Schemas
class AppointmentDetailResponse(BaseModel):
    id: UUID
    customer_id: Optional[UUID]
    vehicle_id: Optional[UUID]
    service_center_id: Optional[UUID]
    service_type_id: Optional[UUID]
    technician_id: Optional[UUID]
    appointment_date: datetime
    scheduled_date: Optional[datetime]
    status: str
    customer_notes: Optional[str]
    staff_notes: Optional[str]
    estimated_cost: Optional[float]
    actual_cost: Optional[float]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    customer: Optional[Dict[str, Any]]
    vehicle: Optional[Dict[str, Any]]
    service_type: Optional[Dict[str, Any]]
    service_center: Optional[Dict[str, Any]]
    technician: Optional[Dict[str, Any]]

class AppointmentStatusUpdate(BaseModel):
    status: str
    staff_notes: Optional[str] = None

class TechnicianAssignment(BaseModel):
    technician_id: UUID

# Service Record Schemas
class ServiceRecordCreate(BaseModel):
    appointment_id: UUID
    vehicle_id: UUID
    mileage_at_service: Optional[int]
    services_performed: Optional[Dict[str, Any]]
    parts_used: Optional[Dict[str, Any]]
    labor_hours: Optional[float]
    total_cost: float
    diagnosis: Optional[str]
    recommendations: Optional[str]
    next_service_date: Optional[date]

class ServiceRecordResponse(BaseModel):
    id: UUID
    appointment_id: UUID
    vehicle_id: UUID
    technician_id: Optional[UUID]
    service_date: datetime
    mileage_at_service: Optional[int]
    services_performed: Optional[Dict[str, Any]]
    parts_used: Optional[Dict[str, Any]]
    labor_hours: Optional[float]
    total_cost: Optional[float]
    diagnosis: Optional[str]
    recommendations: Optional[str]
    next_service_date: Optional[date]

    class Config:
        from_attributes = True

# Part Schemas
class PartCreate(BaseModel):
    part_number: str
    name: str
    description: Optional[str]
    category: Optional[str]
    unit_price: float
    quantity_in_stock: int = 0
    minimum_stock_level: int = 10
    supplier: Optional[str]
    compatible_models: Optional[Dict[str, Any]]

class PartUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[float] = None
    quantity_in_stock: Optional[int] = None
    minimum_stock_level: Optional[int] = None
    supplier: Optional[str] = None
    is_active: Optional[bool] = None

class PartResponse(BaseModel):
    id: UUID
    part_number: str
    name: str
    description: Optional[str]
    category: Optional[str]
    unit_price: float
    quantity_in_stock: int
    minimum_stock_level: int
    supplier: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True

class StockAdjustment(BaseModel):
    quantity_change: int
    reason: Optional[str]

# Technician Schemas
class TechnicianResponse(BaseModel):
    id: UUID
    employee_id: Optional[str]
    full_name: str
    phone: Optional[str]
    email: str
    specialization: Optional[str]
    experience_years: Optional[int]
    is_available: bool
    certification_number: Optional[str]
    certification_expiry: Optional[date]

class TechnicianAvailability(BaseModel):
    is_available: bool

# Work Schedule Schemas
class WorkScheduleCreate(BaseModel):
    technician_id: UUID
    service_center_id: UUID
    shift_date: date
    shift_start: time
    shift_end: time

class WorkScheduleResponse(BaseModel):
    id: UUID
    technician_id: UUID
    service_center_id: UUID
    shift_date: date
    shift_start: time
    shift_end: time
    is_available: bool

    class Config:
        from_attributes = True

# Customer Schemas
class CustomerInfoResponse(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    vehicle_count: int
    created_at: Optional[datetime] = None

# Vehicle Schemas
class VehicleInfoResponse(BaseModel):
    id: UUID
    customer_id: UUID
    vin: str
    make: str
    model: str
    year: int
    license_plate: Optional[str]
    current_mileage: int
    status: str
    last_maintenance_date: Optional[date]
    next_maintenance_date: Optional[date]

    class Config:
        from_attributes = True

# Checklist Schemas
class ChecklistItemResponse(BaseModel):
    id: UUID
    checklist_id: UUID
    category: str
    item_name: str
    description: Optional[str]
    is_required: bool
    display_order: int
    is_completed: bool = False
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[UUID] = None

    class Config:
        from_attributes = True

class ChecklistCategoryResponse(BaseModel):
    category: str
    items: List[ChecklistItemResponse]

class AppointmentChecklistResponse(BaseModel):
    appointment_id: UUID
    checklist_name: str
    total_items: int
    completed_items: int
    progress_percentage: float
    categories: List[ChecklistCategoryResponse]

class ChecklistItemUpdate(BaseModel):
    is_completed: bool
    notes: Optional[str] = None

# Service Type Schemas
class ServiceTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    base_price: float
    estimated_duration: Optional[int] = None
    is_active: bool = True
    image_url: Optional[str] = None

class ServiceTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    estimated_duration: Optional[int] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None

class ServiceTypeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    base_price: float
    estimated_duration: Optional[int]
    is_active: bool
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
