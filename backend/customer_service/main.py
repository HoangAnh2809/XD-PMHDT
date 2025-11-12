from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date, timedelta
import sys
import os
import shutil
from uuid import UUID

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db, engine
from shared.models import (
    Base, Vehicle, Appointment, ServiceType, ServiceCenter, 
    Customer, User, Notification, ServiceRecord, Invoice, Part, Technician
)
from shared.auth import get_current_user, require_role, verify_password, get_password_hash
from schemas import (
    VehicleCreate, VehicleResponse, VehicleUpdate,
    AppointmentCreate, AppointmentResponse,
    ServiceTypeResponse, ServiceCenterResponse, PartResponse,
    MaintenanceReminderResponse, CustomerProfileResponse,
    CustomerProfileUpdate, ServiceHistoryResponse
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Customer Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vehicle Management
@app.post("/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle: VehicleCreate,
    current_user: dict = Depends(require_role(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    # Get customer ID
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    # Check if VIN already exists
    existing_vehicle = db.query(Vehicle).filter(Vehicle.vin == vehicle.vin).first()
    if existing_vehicle:
        raise HTTPException(status_code=400, detail="Vehicle with this VIN already exists")
    
    db_vehicle = Vehicle(
        customer_id=customer.id,
        **vehicle.model_dump()
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    
    return db_vehicle

@app.get("/vehicles", response_model=List[VehicleResponse])
async def get_my_vehicles(
    current_user: dict = Depends(require_role(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        return []
    
    vehicles = db.query(Vehicle).filter(Vehicle.customer_id == customer.id).all()
    return vehicles

@app.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check ownership for customers
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if vehicle.customer_id != customer.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return vehicle

@app.put("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: UUID,
    vehicle_update: VehicleUpdate,
    current_user: dict = Depends(require_role(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check ownership
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if vehicle.customer_id != customer.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in vehicle_update.model_dump(exclude_unset=True).items():
        setattr(vehicle, key, value)
    
    db.commit()
    db.refresh(vehicle)
    return vehicle

@app.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: UUID,
    current_user: dict = Depends(require_role(["customer", "admin"])),
    db: Session = Depends(get_db)
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if vehicle.customer_id != customer.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(vehicle)
    db.commit()
    return None

# Appointment Management
@app.get("/service-types", response_model=List[ServiceTypeResponse])
async def get_service_types(db: Session = Depends(get_db)):
    service_types = db.query(ServiceType).filter(ServiceType.is_active == True).all()
    return service_types

@app.get("/service-centers", response_model=List[ServiceCenterResponse])
async def get_service_centers(db: Session = Depends(get_db)):
    centers = db.query(ServiceCenter).filter(ServiceCenter.is_active == True).all()
    return centers

@app.get("/parts", response_model=List[PartResponse])
async def get_parts(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Part).filter(Part.is_active == True)
    
    if category:
        query = query.filter(Part.category == category)
    
    if search:
        query = query.filter(
            (Part.name.ilike(f"%{search}%")) | 
            (Part.part_number.ilike(f"%{search}%"))
        )
    
    parts = query.order_by(Part.name).all()
    return parts

@app.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: AppointmentCreate,
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    # Verify vehicle ownership
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == appointment.vehicle_id,
        Vehicle.customer_id == customer.id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found or not owned by you")
    
    # Validate appointment data based on type
    if appointment.appointment_type == "service" and not appointment.service_type_id:
        raise HTTPException(status_code=400, detail="Service type is required for service appointments")
    
    if appointment.appointment_type in ["parts", "service_and_parts"] and not appointment.parts:
        raise HTTPException(status_code=400, detail="Parts are required for parts appointments")
    
    # Create appointment
    db_appointment = Appointment(
        customer_id=customer.id,
        vehicle_id=appointment.vehicle_id,
        service_center_id=appointment.service_center_id,
        service_type_id=appointment.service_type_id,
        appointment_date=appointment.appointment_date,
        appointment_type=appointment.appointment_type,
        parts=appointment.parts,
        customer_notes=appointment.customer_notes,
        status="pending"
    )
    
    # Calculate estimated cost
    estimated_cost = 0
    
    # Add service cost if applicable
    if appointment.service_type_id:
        service_type = db.query(ServiceType).filter(ServiceType.id == appointment.service_type_id).first()
        if service_type:
            estimated_cost += service_type.base_price
    
    # Add parts cost if applicable
    if appointment.parts:
        for part_item in appointment.parts:
            part = db.query(Part).filter(Part.id == part_item["id"]).first()
            if part:
                quantity = part_item.get("quantity", 1)
                estimated_cost += part.unit_price * quantity
    
    db_appointment.estimated_cost = estimated_cost
    
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    
    return db_appointment

@app.get("/appointments", response_model=List[AppointmentResponse])
async def get_my_appointments(
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        return []
    
    appointments = db.query(Appointment)\
        .options(
            joinedload(Appointment.vehicle),
            joinedload(Appointment.service_center),
            joinedload(Appointment.service_type)
        )\
        .filter(Appointment.customer_id == customer.id)\
        .order_by(Appointment.appointment_date.desc())\
        .all()
    
    return appointments

@app.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: UUID,
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    
    appointment = db.query(Appointment)\
        .options(
            joinedload(Appointment.vehicle),
            joinedload(Appointment.service_center),
            joinedload(Appointment.service_type)
        )\
        .filter(Appointment.id == appointment_id)\
        .first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appointment.customer_id != customer.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return appointment

@app.delete("/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_appointment(
    appointment_id: UUID,
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appointment.customer_id != customer.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if appointment.status not in ["pending"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this appointment")
    
    appointment.status = "cancelled"
    db.commit()
    return None

# Maintenance Reminders
@app.get("/maintenance-reminders", response_model=List[MaintenanceReminderResponse])
async def get_maintenance_reminders(
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        return []
    
    reminders = []
    vehicles = db.query(Vehicle).filter(Vehicle.customer_id == customer.id).all()
    
    for vehicle in vehicles:
        # Check if maintenance is due
        if vehicle.next_maintenance_date:
            days_until = (vehicle.next_maintenance_date - date.today()).days
            if days_until <= 30:  # Remind if due within 30 days
                reminders.append({
                    "vehicle_id": str(vehicle.id),
                    "vehicle_info": f"{vehicle.make} {vehicle.model} ({vehicle.license_plate})",
                    "reminder_type": "scheduled_maintenance",
                    "due_date": vehicle.next_maintenance_date,
                    "message": f"Maintenance due in {days_until} days"
                })
    
    return reminders

# Service History
@app.get("/service-history", response_model=List[ServiceHistoryResponse])
async def get_service_history(
    vehicle_id: Optional[UUID] = None,
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        return []
    
    query = db.query(ServiceRecord)\
        .join(Vehicle)\
        .outerjoin(Appointment)\
        .outerjoin(ServiceCenter)\
        .outerjoin(Technician, ServiceRecord.technician_id == Technician.id)\
        .filter(Vehicle.customer_id == customer.id)
    
    if vehicle_id:
        query = query.filter(ServiceRecord.vehicle_id == vehicle_id)
    
    records = query.order_by(ServiceRecord.service_date.desc()).all()
    
    # Populate vehicle and service_center for each record
    result = []
    for record in records:
        record_dict = {
            "id": record.id,
            "vehicle_id": record.vehicle_id,
            "service_center_id": record.appointment.service_center_id if record.appointment else None,
            "service_date": record.service_date,
            "mileage_at_service": record.mileage_at_service,
            "services_performed": record.services_performed,
            "total_cost": record.total_cost,
            "diagnosis": record.diagnosis,
            "recommendations": record.recommendations,
            "vehicle": record.vehicle,
            "service_center": record.appointment.service_center if record.appointment else None,
            "technician": record.technician
        }
        result.append(record_dict)
    
    return result

# Customer Profile
@app.get("/profile", response_model=CustomerProfileResponse)
async def get_profile(
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    
    if not user or not customer:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "address": customer.address,
        "date_of_birth": customer.date_of_birth,
        "avatar_url": customer.avatar_url
    }

@app.put("/profile", response_model=CustomerProfileResponse)
async def update_profile(
    profile_update: CustomerProfileUpdate,
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    
    if not user or not customer:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Update user info
    if profile_update.full_name:
        user.full_name = profile_update.full_name
    if profile_update.phone:
        user.phone = profile_update.phone
    
    # Update customer info
    if profile_update.address:
        customer.address = profile_update.address
    if profile_update.date_of_birth:
        customer.date_of_birth = profile_update.date_of_birth
    
    db.commit()
    db.refresh(user)
    db.refresh(customer)
    
    return {
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "address": customer.address,
        "date_of_birth": customer.date_of_birth,
        "avatar_url": customer.avatar_url
    }

@app.put("/profile/change-password")
async def change_password(
    password_data: dict,
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    # Verify current password
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")
    
    # Update password
    user.password_hash = get_password_hash(new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

# Upload avatar
@app.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["customer"])),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Save file
    file_extension = file.filename.split(".")[-1]
    filename = f"avatar_{customer.id}.{file_extension}"
    file_path = f"/app/IMG/avatars/{filename}"
    
    os.makedirs("/app/IMG/avatars", exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    customer.avatar_url = f"/IMG/avatars/{filename}"
    db.commit()
    
    return {"avatar_url": customer.avatar_url}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "customer_service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
