from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import ProgrammingError
from typing import List, Optional
from datetime import datetime, date, timedelta
import sys
import os
import shutil
from uuid import UUID

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db, engine
from shared.models import (
    Base, Appointment, Vehicle, Customer, User, ServiceType,
    ServiceCenter, Technician, Part, ServiceRecord, Invoice, Staff,
    ServiceChecklist, ChecklistItem, AppointmentChecklistProgress
)
from shared.auth import get_current_user, require_role, api_gateway_client
from schemas import *

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Service Center Management", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Create service_images subdirectory
SERVICE_IMAGES_DIR = os.path.join(UPLOAD_DIR, "service_images")
os.makedirs(SERVICE_IMAGES_DIR, exist_ok=True)

# Mount static files for uploaded images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Import and include technician routes
from technician_routes import router as technician_router
app.include_router(technician_router)

# Appointment Management
@app.get("/appointments", response_model=List[AppointmentDetailResponse])
async def get_all_appointments(
    id: Optional[UUID] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Appointment)
        
        if id:
            query = query.filter(Appointment.id == id)
        if status:
            query = query.filter(Appointment.status == status)
        if date_from:
            query = query.filter(Appointment.appointment_date >= date_from)
        if date_to:
            query = query.filter(Appointment.appointment_date <= date_to)
    except ProgrammingError as e:
        # Likely the DB schema is missing a recently added column (e.g. invoice_id).
        # Return an empty list to avoid crashing the entire service while migrations are applied.
        import logging
        logging.getLogger('service_center.db').error('Database programming error while building appointment query: %s', e)
        return []
    
    # For technicians, only show their appointments
    if current_user["role"] == "technician":
        tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
        if tech:
            query = query.filter(Appointment.technician_id == tech.id)
    
    try:
        appointments = query.order_by(Appointment.appointment_date).all()
    except ProgrammingError as e:
        import logging
        logging.getLogger('service_center.db').error('Database programming error when fetching appointments: %s', e)
        return []
    
    # Enrich with full customer, vehicle, service type, service center, and technician info
    result = []
    for apt in appointments:
        # Get customer info from local DB (shared database) instead of API Gateway
        customer_query = db.query(Customer).join(User).filter(Customer.id == apt.customer_id).first()
        if customer_query:
            customer = {
                "id": str(customer_query.user.id),
                "full_name": customer_query.user.full_name,
                "phone": customer_query.user.phone,
                "email": customer_query.user.email,
                "address": customer_query.address,
                "date_of_birth": customer_query.date_of_birth.isoformat() if customer_query.date_of_birth else None,
                "avatar_url": customer_query.avatar_url,
                "created_at": customer_query.created_at.isoformat() if customer_query.created_at else None
            }
        else:
            customer = None
        
        # Call customer service for vehicle info
        try:
            vehicle_data = await api_gateway_client.call_service(f"/customer/vehicles/{apt.vehicle_id}")
            vehicle = {
                "id": vehicle_data["id"],
                "make": vehicle_data["make"],
                "model": vehicle_data["model"],
                "year": vehicle_data["year"],
                "license_plate": vehicle_data["license_plate"],
                "color": vehicle_data["color"],
                "vin": vehicle_data["vin"],
                "battery_capacity": vehicle_data["battery_capacity"],
                "current_mileage": vehicle_data["current_mileage"],
                "last_maintenance_date": vehicle_data["last_maintenance_date"],
                "next_maintenance_date": vehicle_data["next_maintenance_date"]
            }
        except Exception as e:
            # Fallback to basic vehicle info if API call fails
            vehicle = None
        
        # Get service type, service center, and technician from local DB (these are service_center data)
        service_type = db.query(ServiceType).filter(ServiceType.id == apt.service_type_id).first()
        service_center = db.query(ServiceCenter).filter(ServiceCenter.id == apt.service_center_id).first()
        technician = db.query(Technician).join(User).filter(Technician.id == apt.technician_id).first() if apt.technician_id else None
        
        # Build customer object
        customer_data = None
        if customer:
            customer_data = {
                "id": customer["id"],
                "full_name": customer["full_name"],
                "phone": customer["phone"],
                "email": customer["email"],
                "address": customer["address"],
                "date_of_birth": customer["date_of_birth"],
                "avatar_url": customer["avatar_url"],
                "created_at": customer["created_at"]
            }
        
        # Build vehicle object
        vehicle_data = None
        if vehicle:
            vehicle_data = {
                "id": vehicle["id"],
                "make": vehicle["make"],
                "model": vehicle["model"],
                "year": vehicle["year"],
                "license_plate": vehicle["license_plate"],
                "color": vehicle["color"],
                "vin": vehicle["vin"],
                "battery_capacity": vehicle["battery_capacity"],
                "current_mileage": vehicle["current_mileage"],
                "last_maintenance_date": vehicle["last_maintenance_date"],
                "next_maintenance_date": vehicle["next_maintenance_date"]
            }
        
        # Build service type object
        service_type_data = None
        if service_type:
            service_type_data = {
                "id": service_type.id,
                "name": service_type.name,
                "description": service_type.description,
                "base_price": service_type.base_price,
                "estimated_duration": service_type.estimated_duration
            }
        
        # Build service center object
        service_center_data = None
        if service_center:
            service_center_data = {
                "id": service_center.id,
                "name": service_center.name,
                "address": service_center.address,
                "phone": service_center.phone,
                "email": service_center.email
            }
        
        # Build technician object
        technician_data = None
        if technician:
            technician_data = {
                "id": technician.id,
                "full_name": technician.user.full_name,
                "phone": technician.user.phone,
                "email": technician.user.email,
                "specialization": technician.specialization,
                "experience_years": technician.experience_years,
                "certification_number": technician.certification_number
            }
        
        result.append({
            "id": apt.id,
            "customer_id": apt.customer_id,
            "vehicle_id": apt.vehicle_id,
            "service_center_id": apt.service_center_id,
            "service_type_id": apt.service_type_id,
            "technician_id": apt.technician_id,
            "appointment_date": apt.appointment_date,
            "scheduled_date": apt.appointment_date,  # Alias for frontend compatibility
            "status": apt.status,
            "customer_notes": apt.customer_notes,
            "staff_notes": apt.staff_notes,
            "estimated_cost": apt.estimated_cost,
            "actual_cost": apt.actual_cost,
            "created_at": apt.created_at,
            "updated_at": apt.updated_at,
            "customer": customer_data,
            "vehicle": vehicle_data,
            "service_type": service_type_data,
            "service_center": service_center_data,
            "technician": technician_data
        })
    
    return result

@app.put("/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: UUID,
    status_update: AppointmentStatusUpdate,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment.status = status_update.status
    if status_update.staff_notes:
        appointment.staff_notes = status_update.staff_notes

    db.commit()

    # If appointment was completed, ask Payment Service to generate an invoice
    try:
        if status_update.status == "completed":
            # Call payment service via API Gateway (POST /payment/invoices/generate/{appointment_id})
            resp = await api_gateway_client.call_service(f"/payment/invoices/generate/{appointment_id}", method="POST")
            # If payment service returned an invoice id, save it on the appointment
            try:
                invoice_id = None
                if isinstance(resp, dict):
                    invoice_id = resp.get('id') or resp.get('invoice_id') or (resp.get('invoice') and resp['invoice'].get('id'))
                if invoice_id:
                    appointment.invoice_id = UUID(invoice_id)
                    db.commit()
            except Exception:
                # non-fatal; continue
                pass
    except Exception as e:
        # Log the error; do not fail the status update for the appointment
        import logging
        logging.getLogger("service_center.payment").error("Failed to request invoice generation for appointment %s: %s", appointment_id, e)

    return {"message": "Appointment status updated", "status": appointment.status}

@app.put("/appointments/{appointment_id}/assign-technician")
async def assign_technician(
    appointment_id: UUID,
    assignment: TechnicianAssignment,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify technician exists
    technician = db.query(Technician).filter(Technician.id == assignment.technician_id).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    appointment.technician_id = assignment.technician_id
    db.commit()
    
    return {"message": "Technician assigned successfully"}

# Service Record Management
@app.post("/service-records", response_model=ServiceRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_service_record(
    record: ServiceRecordCreate,
    current_user: dict = Depends(require_role(["technician", "staff", "admin"])),
    db: Session = Depends(get_db)
):
    # Get technician ID
    technician = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    
    db_record = ServiceRecord(
        appointment_id=record.appointment_id,
        vehicle_id=record.vehicle_id,
        technician_id=technician.id if technician else None,
        service_date=datetime.now(),
        mileage_at_service=record.mileage_at_service,
        services_performed=record.services_performed,
        parts_used=record.parts_used,
        labor_hours=record.labor_hours,
        total_cost=record.total_cost,
        diagnosis=record.diagnosis,
        recommendations=record.recommendations,
        next_service_date=record.next_service_date
    )
    
    db.add(db_record)
    
    # Update vehicle mileage
    vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()
    if vehicle and record.mileage_at_service:
        vehicle.current_mileage = record.mileage_at_service
        vehicle.last_maintenance_date = date.today()
        if record.next_service_date:
            vehicle.next_maintenance_date = record.next_service_date
    
    # Update appointment
    appointment = db.query(Appointment).filter(Appointment.id == record.appointment_id).first()
    if appointment:
        appointment.actual_cost = record.total_cost
        appointment.status = "completed"
    
    db.commit()
    db.refresh(db_record)

    # After recording service and marking appointment completed, trigger invoice generation
    try:
        resp = await api_gateway_client.call_service(f"/payment/invoices/generate/{record.appointment_id}", method="POST")
        try:
            invoice_id = None
            if isinstance(resp, dict):
                invoice_id = resp.get('id') or resp.get('invoice_id') or (resp.get('invoice') and resp['invoice'].get('id'))
            if invoice_id:
                appointment.invoice_id = UUID(invoice_id)
                db.commit()
        except Exception:
            pass
    except Exception as e:
        import logging
        logging.getLogger("service_center.payment").error("Failed to request invoice generation after service record %s: %s", db_record.id, e)
    
    return db_record

@app.get("/service-records", response_model=List[ServiceRecordResponse])
async def get_service_records(
    vehicle_id: Optional[UUID] = None,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(ServiceRecord)
    
    if vehicle_id:
        query = query.filter(ServiceRecord.vehicle_id == vehicle_id)
    
    records = query.order_by(ServiceRecord.service_date.desc()).all()
    return records

# Parts Inventory Management
@app.get("/parts", response_model=List[PartResponse])
async def get_parts(
    low_stock: bool = False,
    category: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(Part).filter(Part.is_active == True)
    
    if low_stock:
        query = query.filter(Part.quantity_in_stock <= Part.minimum_stock_level)
    
    if category:
        query = query.filter(Part.category == category)
    
    parts = query.all()
    return parts

@app.post("/parts", response_model=PartResponse, status_code=status.HTTP_201_CREATED)
async def create_part(
    part: PartCreate,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    # Check if part number exists
    existing_part = db.query(Part).filter(Part.part_number == part.part_number).first()
    if existing_part:
        raise HTTPException(status_code=400, detail="Part number already exists")
    
    db_part = Part(**part.model_dump())
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    
    return db_part

@app.put("/parts/{part_id}", response_model=PartResponse)
async def update_part(
    part_id: UUID,
    part_update: PartUpdate,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    for key, value in part_update.model_dump(exclude_unset=True).items():
        setattr(part, key, value)
    
    db.commit()
    db.refresh(part)
    return part

@app.post("/parts/{part_id}/adjust-stock")
async def adjust_part_stock(
    part_id: UUID,
    adjustment: StockAdjustment,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    part = db.query(Part).filter(Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    part.quantity_in_stock += adjustment.quantity_change
    
    if part.quantity_in_stock < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    db.commit()
    
    return {
        "message": "Stock adjusted",
        "part_id": str(part.id),
        "new_quantity": part.quantity_in_stock
    }

# Technician Management
@app.get("/technicians", response_model=List[TechnicianResponse])
async def get_technicians(
    available_only: bool = False,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(Technician).join(User).filter(User.role == "technician")
    
    if available_only:
        query = query.filter(Technician.is_available == True)
    
    technicians = query.all()
    
    result = []
    for tech in technicians:
        result.append({
            "id": tech.id,
            "employee_id": tech.employee_id,
            "full_name": tech.user.full_name,
            "phone": tech.user.phone,
            "email": tech.user.email,
            "specialization": tech.specialization,
            "experience_years": tech.experience_years,
            "is_available": tech.is_available,
            "certification_number": tech.certification_number,
            "certification_expiry": tech.certification_expiry
        })
    
    return result

@app.put("/technicians/{technician_id}/availability")
async def update_technician_availability(
    technician_id: UUID,
    availability: TechnicianAvailability,
    current_user: dict = Depends(require_role(["staff", "admin", "technician"])),
    db: Session = Depends(get_db)
):
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    # Technicians can only update their own availability
    if current_user["role"] == "technician":
        tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
        if tech.id != technician_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    technician.is_available = availability.is_available
    db.commit()
    
    return {"message": "Availability updated", "is_available": technician.is_available}

# Work Schedule Management - Commented out until WorkSchedule model is created
# @app.get("/schedules", response_model=List[WorkScheduleResponse])
# async def get_work_schedules(...):
#     ...

# @app.post("/schedules", response_model=WorkScheduleResponse, status_code=status.HTTP_201_CREATED)
# async def create_work_schedule(...):
#     ...

# Customer & Vehicle Management (for service center)
@app.get("/customers", response_model=List[CustomerInfoResponse])
async def get_customers(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Get customers via API Gateway instead of direct DB access"""
    try:
        # Call customer service via API Gateway
        params = {"page": page, "page_size": page_size}
        if search:
            params["search"] = search
        
        customers_data = await api_gateway_client.call_service("/customer/customers", method="GET", data=params)
        
        result = []
        for customer in customers_data:
            # Get vehicle count from local DB (service_center data)
            vehicle_count = db.query(Vehicle).filter(Vehicle.customer_id == customer["id"]).count()
            result.append({
                "id": customer["id"],
                "user_id": customer["user_id"],
                "full_name": customer["full_name"],
                "email": customer["email"],
                "phone": customer["phone"],
                "address": customer["address"],
                "vehicle_count": vehicle_count,
                "created_at": customer["created_at"]
            })
        
        return result
        
    except Exception as e:
        # Fallback to local DB if API Gateway fails
        query = db.query(Customer).join(User).filter(User.role == "customer")
        
        if search:
            # Search by customer name, email, phone, OR vehicle license plate
            query = query.outerjoin(Vehicle, Customer.id == Vehicle.customer_id).filter(
                or_(
                    User.full_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                    User.phone.ilike(f"%{search}%"),
                    Vehicle.license_plate.ilike(f"%{search}%")
                )
            ).distinct()
        
        # Pagination
        offset = (page - 1) * page_size
        customers = query.offset(offset).limit(page_size).all()
        
        result = []
        for customer in customers:
            vehicle_count = db.query(Vehicle).filter(Vehicle.customer_id == customer.id).count()
            result.append({
                "id": customer.id,
                "user_id": customer.user_id,
                "full_name": customer.user.full_name,
                "email": customer.user.email,
                "phone": customer.user.phone,
                "address": customer.address,
                "vehicle_count": vehicle_count,
                "created_at": customer.user.created_at
            })
        
        return result

@app.get("/vehicles", response_model=List[VehicleInfoResponse])
async def get_all_vehicles(
    customer_id: Optional[UUID] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    """Get vehicles via API Gateway instead of direct DB access"""
    try:
        # Call customer service via API Gateway
        params = {}
        if customer_id:
            params["customer_id"] = str(customer_id)
        if search:
            params["search"] = search
        
        vehicles_data = await api_gateway_client.call_service("/customer/vehicles", method="GET", data=params)
        return vehicles_data
        
    except Exception as e:
        # Fallback to local DB if API Gateway fails
        query = db.query(Vehicle)
        
        if customer_id:
            query = query.filter(Vehicle.customer_id == customer_id)
        
        if search:
            query = query.filter(
                or_(
                    Vehicle.vin.ilike(f"%{search}%"),
                    Vehicle.license_plate.ilike(f"%{search}%"),
                    Vehicle.make.ilike(f"%{search}%"),
                    Vehicle.model.ilike(f"%{search}%")
                )
            )
        
        vehicles = query.limit(100).all()
        return vehicles

# Dashboard & Reports
@app.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    try:
        today = date.today()

        # Today's appointments
        today_appointments = db.query(Appointment).filter(
            func.date(Appointment.appointment_date) == today
        ).count()

        # Completed today
        completed_today = db.query(Appointment).filter(
            func.date(Appointment.appointment_date) == today,
            Appointment.status == "completed"
        ).count()

        # Pending appointments
        pending_appointments = db.query(Appointment).filter(
            Appointment.status == "pending"
        ).count()

        # In-progress appointments (vehicles currently being serviced)
        in_progress = db.query(Appointment).filter(
            Appointment.status == "in_progress"
        ).count()

        # Low stock parts
        low_stock_parts = db.query(Part).filter(
            Part.quantity_in_stock <= Part.minimum_stock_level
        ).count()

        # Available technicians
        available_techs = db.query(Technician).filter(
            Technician.is_available == True
        ).count()

        # This month's revenue
        first_day_month = today.replace(day=1)
        monthly_revenue = db.query(func.sum(Invoice.total_amount)).filter(
            Invoice.payment_status == "paid",
            Invoice.issue_date >= first_day_month
        ).scalar() or 0

        # Total customers
        total_customers = db.query(Customer).count()
    except ProgrammingError as e:
        import logging
        logging.getLogger('service_center.db').error('Database programming error while computing dashboard stats: %s', e)
        # Return safe defaults so dashboard doesn't crash while DB migrations run
        return {
            "today_appointments": 0,
            "completed_today": 0,
            "pending_appointments": 0,
            "in_progress_appointments": 0,
            "low_stock_parts": 0,
            "available_technicians": 0,
            "monthly_revenue": 0.0,
            "total_customers": 0
        }
    
    return {
        "today_appointments": today_appointments,
        "completed_today": completed_today,
        "pending_appointments": pending_appointments,
        "in_progress_appointments": in_progress,
        "low_stock_parts": low_stock_parts,
        "available_technicians": available_techs,
        "monthly_revenue": float(monthly_revenue),
        "total_customers": total_customers
    }

# Checklist Management
@app.get("/appointments/{appointment_id}/checklist", response_model=AppointmentChecklistResponse)
async def get_appointment_checklist(
    appointment_id: UUID,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    # Get appointment
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Get checklist for this service type
    checklist = db.query(ServiceChecklist).filter(
        ServiceChecklist.service_type_id == appointment.service_type_id,
        ServiceChecklist.is_active == True
    ).first()
    
    if not checklist:
        raise HTTPException(status_code=404, detail="No checklist found for this service type")
    
    # Get all checklist items
    items = db.query(ChecklistItem).filter(
        ChecklistItem.checklist_id == checklist.id
    ).order_by(ChecklistItem.display_order).all()
    
    # Get progress for this appointment
    progress_items = db.query(AppointmentChecklistProgress).filter(
        AppointmentChecklistProgress.appointment_id == appointment_id
    ).all()
    
    # Create progress map
    progress_map = {p.checklist_item_id: p for p in progress_items}
    
    # Group items by category
    categories_dict = {}
    total_items = len(items)
    completed_items = 0
    
    for item in items:
        if item.category not in categories_dict:
            categories_dict[item.category] = []
        
        progress = progress_map.get(item.id)
        is_completed = progress.is_completed if progress else False
        
        if is_completed:
            completed_items += 1
        
        item_response = ChecklistItemResponse(
            id=item.id,
            checklist_id=item.checklist_id,
            category=item.category,
            item_name=item.item_name,
            description=item.description,
            is_required=item.is_required,
            display_order=item.display_order,
            is_completed=is_completed,
            notes=progress.notes if progress else None,
            completed_at=progress.completed_at if progress else None,
            completed_by=progress.completed_by if progress else None
        )
        categories_dict[item.category].append(item_response)
    
    # Convert to list of categories
    categories = [
        ChecklistCategoryResponse(category=cat, items=items_list)
        for cat, items_list in categories_dict.items()
    ]
    
    # Calculate progress
    progress_percentage = (completed_items / total_items * 100) if total_items > 0 else 0
    
    return AppointmentChecklistResponse(
        appointment_id=appointment_id,
        checklist_name=checklist.name,
        total_items=total_items,
        completed_items=completed_items,
        progress_percentage=round(progress_percentage, 1),
        categories=categories
    )

@app.put("/appointments/{appointment_id}/checklist/{item_id}")
async def update_checklist_item(
    appointment_id: UUID,
    item_id: UUID,
    update_data: ChecklistItemUpdate,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    # Verify appointment exists
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify checklist item exists
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    # Get or create progress record
    progress = db.query(AppointmentChecklistProgress).filter(
        AppointmentChecklistProgress.appointment_id == appointment_id,
        AppointmentChecklistProgress.checklist_item_id == item_id
    ).first()
    
    if not progress:
        progress = AppointmentChecklistProgress(
            appointment_id=appointment_id,
            checklist_item_id=item_id
        )
        db.add(progress)
    
    # Update progress
    progress.is_completed = update_data.is_completed
    progress.notes = update_data.notes
    progress.completed_by = UUID(current_user["sub"])
    progress.completed_at = datetime.now() if update_data.is_completed else None
    
    db.commit()
    db.refresh(progress)
    
    return {
        "message": "Checklist item updated successfully",
        "item_id": str(item_id),
        "is_completed": progress.is_completed
    }

# Reports
@app.get("/reports/{report_type}")
async def generate_report(
    report_type: str,  # daily, weekly, monthly
    format: str = Query("excel", regex="^(excel|pdf)$"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Generate work report in Excel or PDF format"""
    from report_generator import ReportGenerator
    
    # Calculate date range based on report type
    today = date.today()
    if report_type == "daily":
        date_from = date_from or today
        date_to = date_to or today
        report_name = "Ngày"
    elif report_type == "weekly":
        # Current week (Monday to Sunday)
        date_from = date_from or (today - timedelta(days=today.weekday()))
        date_to = date_to or (date_from + timedelta(days=6))
        report_name = "Tuần"
    elif report_type == "monthly":
        # Current month
        date_from = date_from or today.replace(day=1)
        next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        date_to = date_to or (next_month - timedelta(days=1))
        report_name = "Tháng"
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")
    
    # Get appointments in date range
    appointments = db.query(Appointment).filter(
        func.date(Appointment.appointment_date) >= date_from,
        func.date(Appointment.appointment_date) <= date_to
    ).all()
    
    # Get customers and vehicles info
    appointment_details = []
    for apt in appointments:
        customer = db.query(Customer).join(User).filter(Customer.id == apt.customer_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == apt.vehicle_id).first()
        service_type = db.query(ServiceType).filter(ServiceType.id == apt.service_type_id).first()
        
        appointment_details.append({
            'id': str(apt.id),
            'customer_name': customer.user.full_name if customer else 'N/A',
            'vehicle_info': f"{vehicle.make} {vehicle.model} ({vehicle.license_plate})" if vehicle else 'N/A',
            'service_type': service_type.name if service_type else 'N/A',
            'appointment_date': apt.appointment_date.strftime("%d/%m/%Y"),
            'status': apt.status,
            'actual_cost': float(apt.actual_cost or 0)
        })
    
    # Calculate summary
    total_appointments = len(appointments)
    completed = len([a for a in appointments if a.status == 'completed'])
    in_progress = len([a for a in appointments if a.status == 'in_progress'])
    cancelled = len([a for a in appointments if a.status == 'cancelled'])
    total_revenue = sum(float(a.actual_cost or 0) for a in appointments if a.status == 'completed')
    
    summary = {
        'Tổng lịch hẹn': total_appointments,
        'Hoàn thành': completed,
        'Đang thực hiện': in_progress,
        'Đã hủy': cancelled,
        'Doanh thu (VNĐ)': f"{total_revenue:,.0f}"
    }
    
    # Prepare report data
    report_data = {
        'date_from': date_from.strftime("%d/%m/%Y"),
        'date_to': date_to.strftime("%d/%m/%Y"),
        'summary': summary,
        'appointments': appointment_details
    }
    
    # Generate report based on format
    if format == "excel":
        file_buffer = ReportGenerator.generate_excel_report(report_data, report_name)
        filename = f"bao_cao_{report_type}_{date_from.strftime('%Y%m%d')}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:  # pdf
        file_buffer = ReportGenerator.generate_pdf_report(report_data, report_name)
        filename = f"bao_cao_{report_type}_{date_from.strftime('%Y%m%d')}.pdf"
        media_type = "application/pdf"
    
    return StreamingResponse(
        file_buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Service Type Management (CRUD)
@app.get("/service-types", response_model=List[ServiceTypeResponse])
async def get_service_types(
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Get all service types (active and inactive for staff)"""
    service_types = db.query(ServiceType).all()
    return service_types

@app.get("/service-types/public", response_model=List[ServiceTypeResponse])
async def get_public_service_types(db: Session = Depends(get_db)):
    """Get active service types for public access (no authentication required)"""
    service_types = db.query(ServiceType).filter(ServiceType.is_active == True).all()
    return service_types

@app.post("/service-types", response_model=ServiceTypeResponse)
async def create_service_type(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    base_price: float = Form(...),
    estimated_duration: Optional[int] = Form(None),
    warranty_period: Optional[str] = Form(None),
    is_active: bool = Form(True),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(require_role(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    """Create a new service type with optional image upload"""
    # Check if service type with same name already exists
    existing = db.query(ServiceType).filter(ServiceType.name == name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dịch vụ với tên này đã tồn tại"
        )
    
    image_url = None
    if image:
        # Validate file type
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File phải là ảnh")
        
        # Validate file size (max 5MB)
        file_size = 0
        content = await image.read()
        file_size = len(content)
        if file_size > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Kích thước ảnh không được vượt quá 5MB")
        
        # Generate unique filename
        import uuid
        file_extension = os.path.splitext(image.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Generate URL
        image_url = f"/uploads/{unique_filename}"
    
    new_service_type = ServiceType(
        name=name,
        description=description,
        base_price=base_price,
        estimated_duration=estimated_duration,
        warranty_period=warranty_period,
        is_active=is_active,
        image_url=image_url
    )
    
    db.add(new_service_type)
    db.commit()
    db.refresh(new_service_type)
    
    return new_service_type

@app.put("/service-types/{service_type_id}", response_model=ServiceTypeResponse)
async def update_service_type(
    service_type_id: UUID,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    base_price: Optional[float] = Form(None),
    estimated_duration: Optional[int] = Form(None),
    warranty_period: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(require_role(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    """Update an existing service type with optional image upload"""
    print(f"DEBUG: update_service_type called with service_type_id={service_type_id}")
    print(f"DEBUG: name={name}, image={image is not None if image else None}")
    
    service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
    
    if not service_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy dịch vụ"
        )
    
    # Check if trying to update name to an existing one
    if name and name != service_type.name:
        existing = db.query(ServiceType).filter(
            ServiceType.name == name,
            ServiceType.id != service_type_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dịch vụ với tên này đã tồn tại"
            )
    
    # Handle image upload
    if image:
        print(f"DEBUG: Processing image upload, filename={image.filename}")
        # Validate file type
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File phải là ảnh")
        
        # Validate file size (max 5MB)
        file_size = 0
        content = await image.read()
        file_size = len(content)
        if file_size > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Kích thước ảnh không được vượt quá 5MB")
        
        # Delete old image if exists
        if service_type.image_url:
            old_image_path = os.path.join(os.path.dirname(__file__), service_type.image_url.lstrip('/'))
            if os.path.exists(old_image_path):
                try:
                    os.remove(old_image_path)
                except PermissionError as e:
                    # Log the error but continue - old file will remain
                    print(f"Warning: Could not delete old image file {old_image_path}: {e}")
        
        # Generate unique filename
        import uuid
        file_extension = os.path.splitext(image.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        print(f"DEBUG: Saving file to {file_path}")
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Generate URL
        service_type.image_url = f"/uploads/{unique_filename}"
        print(f"DEBUG: Set image_url to {service_type.image_url}")
    
    # Update other fields
    if name is not None:
        service_type.name = name
    if description is not None:
        service_type.description = description
    if base_price is not None:
        service_type.base_price = base_price
    if estimated_duration is not None:
        service_type.estimated_duration = estimated_duration
    if warranty_period is not None:
        service_type.warranty_period = warranty_period
    if is_active is not None:
        service_type.is_active = is_active
    
    db.commit()
    db.refresh(service_type)
    
    print(f"DEBUG: Service type updated successfully, image_url={service_type.image_url}")
    return service_type

@app.delete("/service-types/{service_type_id}")
async def delete_service_type(
    service_type_id: UUID,
    current_user: dict = Depends(require_role(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    """Delete a service type (soft delete by setting is_active=False)"""
    service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id).first()
    
    if not service_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy dịch vụ"
        )
    
    # Check if service type is used in appointments
    appointments_count = db.query(Appointment).filter(
        Appointment.service_type_id == service_type_id
    ).count()
    
    if appointments_count > 0:
        # Soft delete instead of hard delete
        service_type.is_active = False
        db.commit()
        return {
            "message": f"Đã vô hiệu hóa dịch vụ (có {appointments_count} lịch hẹn liên quan)",
            "soft_delete": True
        }
    else:
        # Hard delete if no appointments
        db.delete(service_type)
        db.commit()
        return {
            "message": "Đã xóa dịch vụ thành công",
            "soft_delete": False
        }

@app.delete("/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: UUID,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Delete an appointment (staff/admin only)"""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if appointment can be deleted (not in progress or completed)
    if appointment.status in ["in_progress", "completed"]:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete appointment that is in progress or completed"
        )
    
    # Delete related records first
    db.query(AppointmentChecklistProgress).filter(
        AppointmentChecklistProgress.appointment_id == appointment_id
    ).delete()
    
    # Delete the appointment
    db.delete(appointment)
    db.commit()
    
    return {"message": "Appointment deleted successfully"}


# ==================== QUEUE MANAGEMENT ====================

@app.get("/queue/status")
async def get_queue_status(
    service_center_id: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Lấy trạng thái hàng chờ hiện tại"""
    from queue_manager import queue_manager
    
    try:
        status = queue_manager.get_queue_status(service_center_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting queue status: {str(e)}")


@app.get("/queue/next")
async def get_next_in_queue(
    technician_id: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    """Lấy appointment tiếp theo từ hàng chờ"""
    from queue_manager import queue_manager
    
    # Nếu là technician, dùng user_id của họ
    if current_user.get("role") == "technician" and not technician_id:
        tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
        if tech:
            technician_id = str(tech.id)
    
    next_apt = queue_manager.get_next_appointment(technician_id)
    
    if next_apt:
        return next_apt
    else:
        return {"message": "No appointments in queue"}


@app.get("/queue/estimate/{appointment_id}")
async def estimate_wait_time(
    appointment_id: str,
    db: Session = Depends(get_db)
):
    """Ước tính thời gian chờ cho một appointment (public endpoint cho customer)"""
    from queue_manager import queue_manager
    from uuid import UUID
    
    try:
        apt_uuid = UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid appointment ID")
    
    estimate = queue_manager.estimate_wait_time(str(apt_uuid))
    return estimate


@app.post("/queue/move-to-progress/{appointment_id}")
async def move_appointment_to_progress(
    appointment_id: str,
    current_user: dict = Depends(require_role(["staff", "technician", "admin"])),
    db: Session = Depends(get_db)
):
    """Chuyển appointment từ queue sang in_progress"""
    from queue_manager import queue_manager
    from uuid import UUID
    
    try:
        apt_uuid = UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid appointment ID")
    
    success = queue_manager.move_to_in_progress(str(apt_uuid))
    
    if success:
        return {"message": "Appointment moved to in_progress", "appointment_id": appointment_id}
    else:
        raise HTTPException(status_code=400, detail="Cannot move appointment to in_progress")


# ==================== PERFORMANCE TRACKING ====================

@app.get("/performance/technician/{technician_id}")
async def get_technician_performance_detailed(
    technician_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Lấy báo cáo hiệu suất chi tiết của kỹ thuật viên"""
    from performance_tracker import performance_tracker
    from uuid import UUID
    from datetime import datetime
    
    try:
        tech_uuid = UUID(technician_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    # Parse dates
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    performance = performance_tracker.get_technician_performance(str(tech_uuid), start, end)
    
    if 'error' in performance:
        raise HTTPException(status_code=404, detail=performance['error'])
    
    return performance


@app.get("/performance/ranking")
async def get_technicians_ranking(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 10,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Xếp hạng kỹ thuật viên theo hiệu suất"""
    from performance_tracker import performance_tracker
    from datetime import datetime
    
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    rankings = performance_tracker.get_all_technicians_ranking(start, end, limit)
    
    return {
        "period": {
            "start_date": start.isoformat() if start else None,
            "end_date": end.isoformat() if end else None
        },
        "rankings": rankings
    }


@app.get("/performance/trends/{technician_id}")
async def get_performance_trends(
    technician_id: str,
    months: int = 6,
    current_user: dict = Depends(require_role(["staff", "admin", "technician"])),
    db: Session = Depends(get_db)
):
    """Lấy xu hướng hiệu suất theo tháng"""
    from performance_tracker import performance_tracker
    from uuid import UUID
    
    try:
        tech_uuid = UUID(technician_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    # Technicians can only view their own trends
    if current_user.get("role") == "technician":
        tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
        if not tech or str(tech.id) != str(tech_uuid):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    trends = performance_tracker.get_performance_trends(str(tech_uuid), months)
    
    return trends


# ==================== FAILURE ANALYTICS ====================

@app.get("/analytics/common-issues")
async def get_common_issues(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 10,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Lấy danh sách các sự cố phổ biến nhất"""
    from failure_analytics import failure_analytics
    from datetime import datetime
    
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    return failure_analytics.get_common_issues(start, end, limit)


@app.get("/analytics/parts-failure")
async def get_parts_failure_rate(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 15,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Phân tích tỷ lệ hỏng của phụ tùng"""
    from failure_analytics import failure_analytics
    from datetime import datetime
    
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    return failure_analytics.get_parts_failure_rate(start, end, limit)


@app.get("/analytics/vehicle-reliability")
async def get_vehicle_reliability(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Phân tích độ tin cậy theo model xe"""
    from failure_analytics import failure_analytics
    from datetime import datetime
    
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    return failure_analytics.get_vehicle_model_reliability(start, end)


@app.get("/analytics/seasonal-trends")
async def get_seasonal_trends(
    months: int = 12,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Phân tích xu hướng theo mùa"""
    from failure_analytics import failure_analytics
    
    return failure_analytics.get_seasonal_trends(months)


@app.get("/analytics/diagnostic-insights")
async def get_diagnostic_insights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    """Phân tích insights từ diagnosis notes"""
    from failure_analytics import failure_analytics
    from datetime import datetime
    
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    return failure_analytics.get_diagnostic_insights(start, end)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "service_center"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
