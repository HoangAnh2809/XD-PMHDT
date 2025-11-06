from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Union
from datetime import datetime, date
from uuid import UUID

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: str
    phone: Optional[str] = None
    branch_id: Optional[UUID] = None
    position: Optional[str] = None
    hire_date: Optional[Union[datetime, date, str]] = None
    salary: Optional[float] = None
    shift: Optional[str] = 'morning'
    skills: Optional[List[str]] = []
    is_active: Optional[bool] = True
    
    @field_validator('hire_date', mode='before')
    @classmethod
    def parse_hire_date(cls, v):
        from datetime import datetime as dt, date
        if v is None or isinstance(v, (dt, date)):
            return v
        if isinstance(v, str):
            # Try to parse string to date
            try:
                return dt.fromisoformat(v.replace('Z', '+00:00'))
            except:
                try:
                    return dt.strptime(v, '%Y-%m-%d')
                except:
                    return v
        return v

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    branch_id: Optional[UUID] = None
    position: Optional[str] = None
    hire_date: Optional[Union[datetime, date, str]] = None
    salary: Optional[float] = None
    shift: Optional[str] = None
    skills: Optional[List[str]] = None
    
    @field_validator('hire_date', mode='before')
    @classmethod
    def parse_hire_date(cls, v):
        from datetime import datetime as dt, date
        if v is None or isinstance(v, (dt, date)):
            return v
        if isinstance(v, str):
            try:
                return dt.fromisoformat(v.replace('Z', '+00:00'))
            except:
                try:
                    return dt.strptime(v, '%Y-%m-%d')
                except:
                    return v
        return v

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    is_locked: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Staff-specific fields
    employee_id: Optional[str] = None
    department: Optional[str] = None
    
    # Technician-specific fields  
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    certification_number: Optional[str] = None
    is_available: Optional[bool] = None
    
    class Config:
        from_attributes = True

class ResetPasswordRequest(BaseModel):
    password: str
    
    class Config:
        # Accept both 'password' and 'new_password'
        schema_extra = {
            "example": {
                "password": "newpassword123"
            }
        }

# Branch schemas
class BranchBase(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    working_hours: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    working_hours: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None

class BranchResponse(BranchBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Inventory schemas
class InventoryBase(BaseModel):
    part_number: str
    name: str
    description: Optional[str] = None
    category: str
    unit_price: float
    quantity_in_stock: int
    minimum_stock_level: int
    supplier: Optional[str] = None
    location: Optional[str] = None  # Add location field
    compatible_models: Optional[List[dict]] = None
    image_url: Optional[str] = None
    is_active: bool = True

class InventoryCreate(InventoryBase):
    pass

class InventoryUpdate(BaseModel):
    part_number: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = None
    quantity_in_stock: Optional[int] = None
    minimum_stock_level: Optional[int] = None
    supplier: Optional[str] = None
    location: Optional[str] = None  # Add location field
    compatible_models: Optional[List[dict]] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None

class InventoryResponse(InventoryBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Service schemas
class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    base_price: float
    estimated_duration: Optional[int] = None
    warranty_period: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    estimated_duration: Optional[int] = None
    warranty_period: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class ServiceResponse(ServiceBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Stats schemas
class DashboardStats(BaseModel):
    total_users: int
    total_revenue: float
    completed_services: int
    average_rating: float
    monthly_revenue: List[dict]
    top_services: List[dict]
    recent_activities: List[dict]
    top_technicians: List[dict]

# Activity Log schemas
class ActivityLogCreate(BaseModel):
    user_id: Optional[UUID] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    details: Optional[dict] = None  # Changed from meta_data to match DB
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class ActivityLogResponse(BaseModel):
    id: UUID
    action: str
    entity_type: Optional[str]
    details: Optional[dict]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Finance schemas
class TransactionResponse(BaseModel):
    id: UUID
    appointment_id: Optional[UUID]
    customer_name: str
    service_name: str
    amount: float
    type: str  # revenue or expense
    status: str  # completed, pending, cancelled
    payment_method: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class FinanceStats(BaseModel):
    total_revenue: float
    total_expenses: float
    net_profit: float
    total_transactions: int
    completed_services: int
    pending_payments: int
    revenue_growth: float  # percentage
    top_services: List[dict]
    monthly_data: List[dict]

class RevenueData(BaseModel):
    date: str
    amount: float
    transactions: int
    
class ExpenseData(BaseModel):
    category: str
    amount: float
    percentage: float

# Appointment schemas
class AppointmentCreate(BaseModel):
    vehicle_id: UUID
    service_center_id: UUID
    service_type_id: Optional[UUID] = None
    appointment_date: datetime
    appointment_type: str = "service"  # "service", "parts", "service_and_parts"
    parts: Optional[List[dict]] = None  # List of parts with id and quantity
    customer_notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    vehicle_id: Optional[UUID] = None
    service_center_id: Optional[UUID] = None
    service_type_id: Optional[UUID] = None
    appointment_date: Optional[datetime] = None
    appointment_type: Optional[str] = None
    parts: Optional[List[dict]] = None
    status: Optional[str] = None
    customer_notes: Optional[str] = None
    staff_notes: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None

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
    created_at: datetime

    class Config:
        from_attributes = True

# Work Schedule schemas
class WorkScheduleBase(BaseModel):
    technician_id: UUID
    service_center_id: UUID
    shift_date: date
    shift_start: str  # Time as string (HH:MM format)
    shift_end: str    # Time as string (HH:MM format)
    is_available: bool = True

class WorkScheduleCreate(WorkScheduleBase):
    pass

class WorkScheduleUpdate(BaseModel):
    technician_id: Optional[UUID] = None
    service_center_id: Optional[UUID] = None
    shift_date: Optional[date] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    is_available: Optional[bool] = None

class WorkScheduleResponse(WorkScheduleBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Additional fields for display
    technician_name: Optional[str] = None
    service_center_name: Optional[str] = None
    
    class Config:
        from_attributes = True
