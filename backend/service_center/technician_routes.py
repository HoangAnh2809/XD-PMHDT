"""
Technician API Routes
Handles all endpoints for technician dashboard and operations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, date, timedelta
from uuid import UUID

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db
from shared.models import (
    Appointment, Vehicle, Customer, User, ServiceType,
    Technician, Part, ServiceRecord, AppointmentChecklistProgress,
    ChecklistItem, ServiceChecklist
)
from shared.auth import require_role
from schemas import *

router = APIRouter(prefix="/technician", tags=["Technician"])


# ==================== DASHBOARD STATS ====================
@router.get("/stats")
async def get_technician_stats(
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get technician dashboard statistics"""
    # Get technician profile
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    today = date.today()
    
    # Today's tasks (appointments assigned to this technician)
    today_tasks = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) == today
    ).count()
    
    # Completed tasks today
    completed_today = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) == today,
        Appointment.status == "completed"
    ).count()
    
    # In-progress tasks
    in_progress = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        Appointment.status == "in_progress"
    ).count()
    
    # This week's tasks
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_tasks = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) >= week_start,
        func.date(Appointment.appointment_date) <= week_end
    ).count()
    
    # This month's completed tasks
    month_start = today.replace(day=1)
    completed_month = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) >= month_start,
        Appointment.status == "completed"
    ).count()
    
    return {
        "today_tasks": today_tasks,
        "completed_today": completed_today,
        "in_progress": in_progress,
        "week_tasks": week_tasks,
        "completed_month": completed_month,
        "is_available": tech.is_available
    }


# ==================== TODAY'S TASKS ====================
@router.get("/tasks/today")
async def get_today_tasks(
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get today's assigned tasks"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    today = date.today()
    
    appointments = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) == today
    ).order_by(Appointment.appointment_date).all()
    
    # Enrich with customer and vehicle info
    result = []
    for apt in appointments:
        customer = db.query(Customer).join(User).filter(Customer.id == apt.customer_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == apt.vehicle_id).first()
        service_type = db.query(ServiceType).filter(ServiceType.id == apt.service_type_id).first()
        
        result.append({
            "id": str(apt.id),
            "appointment_date": apt.appointment_date.isoformat(),
            "status": apt.status,
            "customer_name": customer.user.full_name if customer else "Unknown",
            "customer_phone": customer.user.phone if customer else None,
            "vehicle_make": vehicle.make if vehicle else None,
            "vehicle_model": vehicle.model if vehicle else None,
            "vehicle_license": vehicle.license_plate if vehicle else None,
            "service_type": service_type.name if service_type else "Unknown",
            "estimated_cost": float(apt.estimated_cost or 0),
            "customer_notes": apt.customer_notes,
            "staff_notes": apt.staff_notes
        })
    
    return result


# ==================== TASKS MANAGEMENT ====================
@router.get("/tasks")
async def get_tasks(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get all tasks assigned to this technician"""
    try:
        tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
        if not tech:
            return {"error": "Technician profile not found", "user_id": current_user["user_id"]}
        # Normalize status query: clients may send 'null' or 'undefined' strings
        if isinstance(status, str) and status.lower() in ("null", "undefined", "none", ""):
            status = None
        query = db.query(Appointment).filter(Appointment.technician_id == tech.id)
        
        if status:
            query = query.filter(Appointment.status == status)
        
        appointments = query.order_by(Appointment.appointment_date.desc()).limit(50).all()
        
        result = []
        for apt in appointments:
            try:
                customer = db.query(Customer).filter(Customer.id == apt.customer_id).first()
                vehicle = db.query(Vehicle).filter(Vehicle.id == apt.vehicle_id).first()
                service_type = db.query(ServiceType).filter(ServiceType.id == apt.service_type_id).first()
                
                result.append({
                    "id": str(apt.id),
                    "appointment_date": apt.appointment_date.isoformat(),
                    "status": apt.status,
                    "customer_name": customer.user.full_name if customer and customer.user else "Unknown",
                    "customer_phone": customer.user.phone if customer and customer.user else None,
                    "vehicle_make": vehicle.make if vehicle else None,
                    "vehicle_model": vehicle.model if vehicle else None,
                    "vehicle_license": vehicle.license_plate if vehicle else None,
                    # Provide combined fields for older frontends
                    "vehicle_info": (f"{vehicle.make or ''} {vehicle.model or ''}".strip() if vehicle else None),
                    "scheduled_time": (apt.appointment_date.isoformat() if apt.appointment_date else None),
                    "service_type": service_type.name if service_type else "Unknown",
                    "estimated_cost": float(apt.estimated_cost or 0),
                    "actual_cost": float(apt.actual_cost or 0) if apt.actual_cost else None,
                    "customer_notes": apt.customer_notes,
                    "staff_notes": apt.staff_notes
                })
            except Exception as e:
                result.append({
                    "id": str(apt.id),
                    "error": f"Error processing appointment: {str(e)}",
                    "appointment_date": apt.appointment_date.isoformat() if apt.appointment_date else None,
                    "status": apt.status
                })
        
        return result
    except Exception as e:
        return {"error": f"General error: {str(e)}", "user_id": current_user.get("user_id")}


@router.get("/tasks/{task_id}")
async def get_task_details(
    task_id: UUID,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific task"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    customer = db.query(Customer).filter(Customer.id == appointment.customer_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
    service_type = db.query(ServiceType).filter(ServiceType.id == appointment.service_type_id).first()
    
    return {
        "id": str(appointment.id),
        "appointment_date": appointment.appointment_date.isoformat(),
        "status": appointment.status,
        "customer_name": customer.user.full_name if customer and customer.user else "Unknown",
        "customer_phone": customer.user.phone if customer and customer.user else None,
        "customer_email": customer.user.email if customer and customer.user else None,
        "vehicle_id": str(vehicle.id) if vehicle else None,
        "vehicle_make": vehicle.make if vehicle else None,
        "vehicle_model": vehicle.model if vehicle else None,
        "vehicle_year": vehicle.year if vehicle else None,
        "vehicle_license": vehicle.license_plate if vehicle else None,
        # Combined / frontend-friendly fields
        "vehicle_info": (f"{vehicle.make or ''} {vehicle.model or ''}".strip() if vehicle else None),
        "scheduled_time": (appointment.appointment_date.isoformat() if appointment.appointment_date else None),
        "vehicle_vin": vehicle.vin if vehicle else None,
        "current_mileage": vehicle.current_mileage if vehicle else None,
        "battery_capacity": vehicle.battery_capacity if vehicle else None,
        "service_type": service_type.name if service_type else "Unknown",
        "service_description": service_type.description if service_type else None,
        "estimated_duration": service_type.estimated_duration if service_type else None,
        "estimated_cost": float(appointment.estimated_cost or 0),
        "actual_cost": float(appointment.actual_cost) if appointment.actual_cost is not None else None,
        "customer_notes": appointment.customer_notes,
        "staff_notes": appointment.staff_notes,
        "created_at": appointment.created_at.isoformat() if appointment.created_at else None
    }


@router.post("/tasks/{task_id}/start")
async def start_task(
    task_id: UUID,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Start working on a task"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if appointment.status != "pending":
        raise HTTPException(status_code=400, detail="Task has already been started or completed")
    
    appointment.status = "in_progress"
    db.commit()
    
    return {"message": "Task started", "status": "in_progress"}


@router.put("/tasks/{task_id}/status")
async def update_task_status(
    task_id: UUID,
    status_data: dict,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Update task status"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    new_status = status_data.get("status")
    notes = status_data.get("notes")
    actual_cost = status_data.get("actual_cost")
    
    if new_status:
        appointment.status = new_status
    
    if notes:
        appointment.staff_notes = notes
    
    if actual_cost is not None:
        appointment.actual_cost = actual_cost
    
    db.commit()
    
    return {"message": "Task status updated", "status": appointment.status}


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: UUID,
    completion_data: dict,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Complete a task with service record"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Calculate actual_cost based on completed checklist items
    actual_cost = await calculate_actual_cost_from_checklist(task_id, db)
    
    # Update appointment
    appointment.status = "completed"
    appointment.actual_cost = actual_cost
    
    # Create service record
    service_record = ServiceRecord(
        appointment_id=appointment.id,
        vehicle_id=appointment.vehicle_id,
        technician_id=tech.id,
        service_date=datetime.now(),
        mileage_at_service=completion_data.get("mileage"),
        services_performed=completion_data.get("services_performed", ""),
        parts_used=completion_data.get("parts_used", ""),
        labor_hours=completion_data.get("labor_hours", 0),
        total_cost=actual_cost,
        diagnosis=completion_data.get("diagnosis", ""),
        recommendations=completion_data.get("recommendations", "")
    )
    
    db.add(service_record)
    
    # Update vehicle mileage
    if completion_data.get("mileage"):
        vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
        if vehicle:
            vehicle.current_mileage = completion_data.get("mileage")
            vehicle.last_maintenance_date = date.today()
    
    db.commit()
    
    return {"message": "Task completed successfully", "status": "completed", "actual_cost": float(actual_cost)}


async def calculate_actual_cost_from_checklist(task_id: UUID, db: Session) -> float:
    """Calculate actual cost based on completed checklist items"""
    # Get all completed checklist items for this appointment
    completed_progress = db.query(AppointmentChecklistProgress).filter(
        AppointmentChecklistProgress.appointment_id == task_id,
        AppointmentChecklistProgress.is_completed == True
    ).all()
    
    total_cost = 0.0
    
    for progress in completed_progress:
        # Get the checklist item to get its cost
        checklist_item = db.query(ChecklistItem).filter(
            ChecklistItem.id == progress.checklist_item_id
        ).first()
        
        if checklist_item and checklist_item.estimated_cost:
            total_cost += float(checklist_item.estimated_cost)
    
    return total_cost


# ==================== SCHEDULE ====================
@router.get("/schedule/current")
async def get_current_schedule(
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get current week's schedule"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    
    appointments = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) >= week_start,
        func.date(Appointment.appointment_date) <= week_end
    ).order_by(Appointment.appointment_date).all()
    
    result = []
    for apt in appointments:
        customer = db.query(Customer).filter(Customer.id == apt.customer_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == apt.vehicle_id).first()
        service_type = db.query(ServiceType).filter(ServiceType.id == apt.service_type_id).first()
        
        result.append({
            "id": str(apt.id),
            "date": apt.appointment_date.date().isoformat(),
            "time": apt.appointment_date.time().strftime("%H:%M"),
            "status": apt.status,
            "customer_name": customer.user.full_name if customer and customer.user else "Unknown",
            "vehicle": f"{vehicle.make} {vehicle.model}" if vehicle else "Unknown",
            "service_type": service_type.name if service_type else "Unknown"
        })
    
    return result


@router.get("/schedule")
async def get_schedule(
    week_offset: int = 0,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get schedule for a specific week (offset from current week)"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    today = date.today()
    week_start = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)
    week_end = week_start + timedelta(days=6)
    
    appointments = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) >= week_start,
        func.date(Appointment.appointment_date) <= week_end
    ).order_by(Appointment.appointment_date).all()
    
    result = []
    for apt in appointments:
        customer = db.query(Customer).filter(Customer.id == apt.customer_id).first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == apt.vehicle_id).first()
        service_type = db.query(ServiceType).filter(ServiceType.id == apt.service_type_id).first()
        
        result.append({
            "id": str(apt.id),
            "date": apt.appointment_date.date().isoformat(),
            "time": apt.appointment_date.time().strftime("%H:%M"),
            "status": apt.status,
            "customer_name": customer.user.full_name if customer and customer.user else "Unknown",
            "vehicle": f"{vehicle.make} {vehicle.model}" if vehicle else "Unknown",
            "service_type": service_type.name if service_type else "Unknown",
            "estimated_duration": service_type.estimated_duration if service_type else 60
        })
    
    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "appointments": result
    }


# ==================== NOTIFICATIONS ====================
@router.get("/notifications")
async def get_notifications(
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get technician notifications (upcoming tasks, urgent issues)"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    notifications = []
    
    # Today's pending tasks
    today = date.today()
    pending_today = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) == today,
        Appointment.status == "pending"
    ).count()
    
    if pending_today > 0:
        notifications.append({
            "type": "info",
            "title": "Tasks Pending",
            "message": f"You have {pending_today} pending task(s) today",
            "time": datetime.now().isoformat()
        })
    
    # In-progress tasks
    in_progress = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        Appointment.status == "in_progress"
    ).count()
    
    if in_progress > 0:
        notifications.append({
            "type": "warning",
            "title": "Tasks In Progress",
            "message": f"You have {in_progress} task(s) in progress",
            "time": datetime.now().isoformat()
        })
    
    return notifications


# ==================== PARTS REQUEST ====================
@router.post("/parts-request")
async def request_part(
    part_data: dict,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Request a part for a task"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    # In a real system, this would create a PartsRequest record
    # For now, just return success
    return {
        "message": "Part request submitted successfully",
        "part_name": part_data.get("part_name"),
        "quantity": part_data.get("quantity"),
        "status": "pending"
    }


@router.get("/parts-request")
async def get_parts_requests(
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get all parts requests made by this technician"""
    # In a real system, this would query PartsRequest table
    # For now, return empty list
    return []


@router.get("/parts/available")
async def get_available_parts(
    search: Optional[str] = None,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get available parts in inventory"""
    query = db.query(Part).filter(Part.is_active == True, Part.quantity_in_stock > 0)
    
    if search:
        query = query.filter(
            or_(
                Part.name.ilike(f"%{search}%"),
                Part.part_number.ilike(f"%{search}%"),
                Part.category.ilike(f"%{search}%")
            )
        )
    
    parts = query.limit(50).all()
    
    return [
        {
            "id": str(part.id),
            "name": part.name,
            "part_number": part.part_number,
            "category": part.category,
            "quantity_available": part.quantity_in_stock,
            "unit_price": float(part.unit_price)
        }
        for part in parts
    ]


# ==================== CHECKLIST ====================
@router.get("/tasks/{task_id}/checklist")
async def get_task_checklist(
    task_id: UUID,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get checklist for a task"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get checklist for this service type
    checklist = db.query(ServiceChecklist).filter(
        ServiceChecklist.service_type_id == appointment.service_type_id,
        ServiceChecklist.is_active == True
    ).first()
    
    if not checklist:
        return {"items": [], "message": "No checklist available for this service type"}
    
    # Get checklist items
    items = db.query(ChecklistItem).filter(
        ChecklistItem.checklist_id == checklist.id
    ).order_by(ChecklistItem.display_order).all()
    
    # Get progress
    progress_items = db.query(AppointmentChecklistProgress).filter(
        AppointmentChecklistProgress.appointment_id == task_id
    ).all()
    
    progress_map = {str(p.checklist_item_id): p for p in progress_items}
    
    result = []
    for item in items:
        progress = progress_map.get(str(item.id))
        result.append({
            "id": str(item.id),
            "category": item.category,
            "item_name": item.item_name,
            "description": item.description,
            "estimated_cost": float(item.estimated_cost) if item.estimated_cost else 0,
            "is_required": item.is_required,
            "is_completed": progress.is_completed if progress else False,
            "notes": progress.notes if progress else None
        })
    
    return {"items": result}


@router.put("/tasks/{task_id}/checklist/{item_id}")
async def update_checklist_item(
    task_id: UUID,
    item_id: UUID,
    update_data: dict,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Update checklist item completion status"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    # Verify task ownership
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get or create progress
    progress = db.query(AppointmentChecklistProgress).filter(
        AppointmentChecklistProgress.appointment_id == task_id,
        AppointmentChecklistProgress.checklist_item_id == item_id
    ).first()
    
    if not progress:
        progress = AppointmentChecklistProgress(
            appointment_id=task_id,
            checklist_item_id=item_id
        )
        db.add(progress)
    
    progress.is_completed = update_data.get("completed", False)
    progress.notes = update_data.get("notes")
    progress.completed_by = UUID(current_user["user_id"])
    progress.completed_at = datetime.now() if progress.is_completed else None
    
    db.commit()
    
    return {"message": "Checklist item updated", "is_completed": progress.is_completed}


# ==================== PERFORMANCE ====================
@router.get("/performance")
async def get_performance(
    period: str = "month",  # day, week, month, year
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get technician performance metrics"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    today = date.today()
    
    if period == "day":
        start_date = today
    elif period == "week":
        start_date = today - timedelta(days=today.weekday())
    elif period == "month":
        start_date = today.replace(day=1)
    else:  # year
        start_date = today.replace(month=1, day=1)
    
    # Total tasks
    total_tasks = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) >= start_date
    ).count()
    
    # Completed tasks
    completed = db.query(Appointment).filter(
        Appointment.technician_id == tech.id,
        func.date(Appointment.appointment_date) >= start_date,
        Appointment.status == "completed"
    ).count()
    
    # Completion rate
    completion_rate = (completed / total_tasks * 100) if total_tasks > 0 else 0
    
    return {
        "period": period,
        "total_tasks": total_tasks,
        "completed_tasks": completed,
        "completion_rate": round(completion_rate, 1),
        "in_progress": total_tasks - completed
    }


# ==================== TASK PROGRESS ====================
@router.post("/tasks/{task_id}/progress")
async def update_task_progress(
    task_id: UUID,
    progress_data: dict,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Update task progress with notes and updates"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update staff notes with progress
    current_notes = appointment.staff_notes or ""
    new_note = f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {progress_data.get('notes', '')}"
    appointment.staff_notes = current_notes + new_note
    
    db.commit()
    
    return {"message": "Progress updated successfully"}


@router.get("/tasks/{task_id}/progress-history")
async def get_progress_history(
    task_id: UUID,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get progress history for a task"""
    tech = db.query(Technician).filter(Technician.user_id == current_user["user_id"]).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    
    appointment = db.query(Appointment).filter(
        Appointment.id == task_id,
        Appointment.technician_id == tech.id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Parse notes into history entries
    notes = appointment.staff_notes or ""
    history = []
    
    for line in notes.split('\n'):
        if line.strip():
            history.append({
                "timestamp": datetime.now().isoformat(),
                "note": line.strip()
            })
    
    return {"history": history}


# ==================== AI ASSISTANT (PLACEHOLDER) ====================
@router.post("/ai-assistant")
async def ask_ai_assistant(
    question_data: dict,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """AI assistant for diagnostic help (placeholder)"""
    question = question_data.get("question", "")
    context = question_data.get("context", {})
    
    # Placeholder response
    return {
        "answer": f"AI assistant is not yet implemented. You asked: {question}",
        "suggestions": [
            "Check battery voltage",
            "Inspect charging port",
            "Test motor controller"
        ],
        "confidence": 0.75
    }


@router.get("/error-codes/{code}")
async def get_error_code_info(
    code: str,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Get information about an error code (placeholder)"""
    # Placeholder data
    error_codes = {
        "P0420": {
            "description": "Catalyst System Efficiency Below Threshold (Bank 1)",
            "possible_causes": ["Faulty catalytic converter", "Oxygen sensor malfunction", "Exhaust leak"],
            "recommended_actions": ["Test oxygen sensors", "Check for exhaust leaks", "Inspect catalytic converter"]
        },
        "P0171": {
            "description": "System Too Lean (Bank 1)",
            "possible_causes": ["Vacuum leak", "Faulty MAF sensor", "Fuel pressure low"],
            "recommended_actions": ["Check for vacuum leaks", "Test MAF sensor", "Check fuel pressure"]
        }
    }
    
    if code in error_codes:
        return error_codes[code]
    else:
        return {
            "description": "Error code not found in database",
            "possible_causes": [],
            "recommended_actions": ["Consult service manual", "Contact support"]
        }


# ==================== IMAGE UPLOAD (PLACEHOLDER) ====================
@router.post("/tasks/{task_id}/images")
async def upload_task_image(
    task_id: UUID,
    current_user: dict = Depends(require_role(["technician"])),
    db: Session = Depends(get_db)
):
    """Upload images for a task (placeholder)"""
    # In a real system, this would handle file upload
    return {
        "message": "Image upload not yet implemented",
        "task_id": str(task_id)
    }
