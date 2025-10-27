from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from uuid import UUID

# Invoice Schemas
class InvoiceCreate(BaseModel):
    appointment_id: Optional[UUID]
    customer_id: UUID
    service_center_id: Optional[UUID]
    subtotal: float
    discount: Optional[float] = 0
    due_date: Optional[date]
    notes: Optional[str]

class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    appointment_id: Optional[UUID]
    customer_id: UUID
    service_center_id: Optional[UUID]
    issue_date: datetime
    due_date: Optional[date]
    subtotal: float
    tax: float
    discount: float
    total_amount: float
    payment_status: str
    payment_method: Optional[str]
    payment_date: Optional[datetime]
    notes: Optional[str]

    class Config:
        from_attributes = True

# Invoice Details Schemas (for payment page)
class CustomerInfo(BaseModel):
    id: Optional[UUID]
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]

class VehicleInfo(BaseModel):
    id: Optional[UUID]
    license_plate: Optional[str]
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    color: Optional[str]
    current_mileage: Optional[int]

class TechnicianInfo(BaseModel):
    id: Optional[UUID]
    full_name: Optional[str]

class ServiceCenterInfo(BaseModel):
    id: Optional[UUID]
    name: Optional[str]

class AppointmentInfo(BaseModel):
    id: Optional[UUID]
    appointment_date: Optional[datetime]
    status: Optional[str]
    customer_notes: Optional[str]
    estimated_cost: Optional[float]
    actual_cost: Optional[float]
    customer: Optional[CustomerInfo]
    vehicle: Optional[VehicleInfo]
    technician: Optional[TechnicianInfo]
    service_center: Optional[ServiceCenterInfo]

class ServiceRecordInfo(BaseModel):
    id: Optional[UUID]
    service_date: Optional[datetime]
    mileage_at_service: Optional[int]
    services_performed: Optional[List[Any]]
    diagnosis: Optional[str]
    recommendations: Optional[str]
    cost: Optional[float]
    technician: Optional[TechnicianInfo]

class InvoiceDetailsResponse(BaseModel):
    id: Optional[UUID]
    invoice_number: Optional[str]
    appointment_id: Optional[UUID]
    customer_id: Optional[UUID]
    service_center_id: Optional[UUID]
    issue_date: Optional[datetime]
    due_date: Optional[date]
    subtotal: Optional[float]
    tax: Optional[float]
    discount: Optional[float]
    total_amount: Optional[float]
    payment_status: Optional[str]
    payment_method: Optional[str]
    payment_date: Optional[datetime]
    notes: Optional[str]
    appointment: Optional[AppointmentInfo]
    service_records: Optional[List[ServiceRecordInfo]]

    class Config:
        from_attributes = True

# Payment Schemas
class PaymentCreate(BaseModel):
    invoice_id: UUID
    payment_method: Optional[str] = None

class PaymentResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    transaction_id: Optional[str]
    payment_method: str
    amount: float
    status: str
    payment_date: Optional[datetime]

    class Config:
        from_attributes = True
