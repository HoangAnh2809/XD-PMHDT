from fastapi import Body, APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
from auth import get_password_hash
import schemas
import models
from main import SessionLocal
import io
import json
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.auth import get_current_user, require_role
from shared import models as shared_models

router = APIRouter()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================== INVENTORY APIs ====================

# Sau các endpoint inventory:
@router.post("/inventory/{item_id}/adjust-stock", response_model=schemas.InventoryResponse)
def adjust_inventory_stock(item_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """Điều chỉnh số lượng tồn kho cho một phụ tùng"""
    from uuid import UUID
    try:
        item_uuid = UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_uuid).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    quantity_change = data.get("quantity_change", 0)
    reason = data.get("reason", "")
    db_item.quantity_in_stock = db_item.quantity_in_stock + int(quantity_change)
    db_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_item)
    # Ghi log nếu cần
    return db_item

# ==================== USER ENDPOINTS ====================

@router.get("/users", response_model=List[dict])
def get_users(
    skip: int = 0,
    limit: int = 100,
    role: str = None,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all users with optional filters"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(models.User)
    
    # Eagerly load related staff/technician data
    query = query.options(
        joinedload(models.User.staff_profile),
        joinedload(models.User.technician_profile)
    )
    
    # Role-based filtering: staff can only see customers
    user_role = current_user.get("role")
    if user_role == "staff":
        # Staff can only see customers
        query = query.filter(models.User.role == "customer")
    else:
        # Admins can see all users, or filter by specific role if requested
        if role:
            query = query.filter(models.User.role == role)
    
    if status == "active":
        query = query.filter(models.User.is_active == True, models.User.is_locked == False)
    elif status == "locked":
        query = query.filter(models.User.is_locked == True)
    elif status == "inactive":
        query = query.filter(models.User.is_active == False)
    
    users = query.offset(skip).limit(limit).all()
    
    # Enrich user data with staff/technician info
    result = []
    for user in users:
        user_dict = {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "is_locked": user.is_locked,
            "created_at": user.created_at,
            "updated_at": user.updated_at
        }
        
        # Add staff-specific info
        if user.role == "staff" and user.staff_profile:
            user_dict["employee_id"] = user.staff_profile.employee_id
            user_dict["department"] = user.staff_profile.department
            user_dict["position"] = user.staff_profile.position
            user_dict["hire_date"] = user.staff_profile.hire_date
        
        # Add technician-specific info
        elif user.role == "technician" and user.technician_profile:
            user_dict["employee_id"] = user.technician_profile.employee_id
            user_dict["specialization"] = user.technician_profile.specialization
            user_dict["experience_years"] = user.technician_profile.experience_years
            user_dict["certification_number"] = user.technician_profile.certification_number
            user_dict["is_available"] = user.technician_profile.is_available
        
        result.append(user_dict)
    
    return result

@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get a specific user"""
    from uuid import UUID
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current user's role
    user_role = current_user.get("role", "customer")
    
    # Staff can only view customers
    if user_role == "staff" and db_user.role != "customer":
        raise HTTPException(
            status_code=403, 
            detail="Staff can only view customer accounts"
        )
    
    return db_user

@router.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new user"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🔵 Creating user with data: {user.dict()}")
    
    # Get current user's role
    user_role = current_user.get("role", "customer")
    
    # Staff can only create customers
    if user_role == "staff" and user.role != "customer":
        raise HTTPException(
            status_code=403, 
            detail="Staff can only create customer accounts"
        )
    
    # Check if username or email exists
    existing = db.query(models.User).filter(
        (models.User.username == user.username) | (models.User.email == user.email)
    ).first()
    if existing:
        logger.warning(f"❌ User already exists: {user.username} or {user.email}")
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Hash password with bcrypt
    password_hash = get_password_hash(user.password)
    
    # Create user dict
    user_dict = user.dict(exclude={'password'})
    user_dict['password_hash'] = password_hash
    
    logger.info(f"✅ Creating user object with dict: {user_dict}")
    db_user = models.User(**user_dict)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Log activity
    log_activity(db, current_user.get("id"), "create", "user", db_user.id, f"Created user: {user.username}")
    
    return db_user

@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: str, user_update: schemas.UserUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update a user"""
    from uuid import UUID
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current user's role
    user_role = current_user.get("role", "customer")
    
    # Staff can only update customers
    if user_role == "staff" and db_user.role != "customer":
        raise HTTPException(
            status_code=403, 
            detail="Staff can only update customer accounts"
        )
    
    # Staff cannot change user roles
    if user_role == "staff" and "role" in user_update.dict(exclude_unset=True):
        raise HTTPException(
            status_code=403, 
            detail="Staff cannot change user roles"
        )
    
    update_data = user_update.dict(exclude_unset=True)
    
    # Handle password hashing if password is being updated
    if 'password' in update_data and update_data['password']:
        update_data['password_hash'] = get_password_hash(update_data['password'])
        del update_data['password']  # Remove plain password, use password_hash instead
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    
    log_activity(db, current_user.get("id"), "update", "user", user_id, f"Updated user: {db_user.username}")
    
    return db_user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a user"""
    from uuid import UUID
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current user's role
    user_role = current_user.get("role", "customer")
    
    # Staff can only delete customers
    if user_role == "staff" and db_user.role != "customer":
        raise HTTPException(
            status_code=403, 
            detail="Staff can only delete customer accounts"
        )
    
    username = db_user.username
    db.delete(db_user)
    db.commit()
    
    log_activity(db, current_user.get("id"), "delete", "user", user_id, f"Deleted user: {username}")
    
    return {"message": "User deleted successfully"}

@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, password_data: schemas.ResetPasswordRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Reset user password"""
    from uuid import UUID
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current user's role
    user_role = current_user.get("role", "customer")
    
    # Staff can only reset passwords for customers
    if user_role == "staff" and db_user.role != "customer":
        raise HTTPException(
            status_code=403, 
            detail="Staff can only reset passwords for customer accounts"
        )
    
    db_user.password_hash = get_password_hash(password_data.password)
    db.commit()
    
    log_activity(db, current_user.get("id"), "reset_password", "user", user_id, f"Reset password for user: {db_user.username}")
    
    return {"message": "Password reset successfully"}

# ==================== BRANCH ENDPOINTS ====================

@router.get("/branches", response_model=List[schemas.BranchResponse])
def get_branches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all branches"""
    branches = db.query(models.Branch).offset(skip).limit(limit).all()
    return branches

@router.get("/branches/{branch_id}", response_model=schemas.BranchResponse)
def get_branch(branch_id: str, db: Session = Depends(get_db)):
    """Get a specific branch"""
    from uuid import UUID
    try:
        branch_uuid = UUID(branch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    branch = db.query(models.Branch).filter(models.Branch.id == branch_uuid).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch

@router.post("/branches", response_model=schemas.BranchResponse)
def create_branch(branch: schemas.BranchCreate, db: Session = Depends(get_db)):
    """Create a new branch"""
    db_branch = models.Branch(**branch.dict())
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    
    log_activity(db, None, "create", "branch", db_branch.id, f"Created branch: {branch.name}")
    
    return db_branch

@router.put("/branches/{branch_id}", response_model=schemas.BranchResponse)
def update_branch(branch_id: str, branch_update: schemas.BranchUpdate, db: Session = Depends(get_db)):
    """Update a branch"""
    from uuid import UUID
    try:
        branch_uuid = UUID(branch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_branch = db.query(models.Branch).filter(models.Branch.id == branch_uuid).first()
    if not db_branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    update_data = branch_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_branch, field, value)
    
    db.commit()
    db.refresh(db_branch)
    
    log_activity(db, None, "update", "branch", branch_id, f"Updated branch: {db_branch.name}")
    
    return db_branch

@router.delete("/branches/{branch_id}")
def delete_branch(branch_id: str, db: Session = Depends(get_db)):
    """Delete a branch"""
    from uuid import UUID
    try:
        branch_uuid = UUID(branch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_branch = db.query(models.Branch).filter(models.Branch.id == branch_uuid).first()
    if not db_branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    name = db_branch.name
    db.delete(db_branch)
    db.commit()
    
    log_activity(db, None, "delete", "branch", branch_id, f"Deleted branch: {name}")
    
    return {"message": "Branch deleted successfully"}

# ==================== INVENTORY ENDPOINTS ====================

@router.get("/inventory", response_model=List[schemas.InventoryResponse])
def get_inventory(
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    low_stock: bool = False,
    db: Session = Depends(get_db)
):
    """Get all inventory items"""
    query = db.query(models.Inventory)
    
    if category:
        query = query.filter(models.Inventory.category == category)
    if low_stock:
        query = query.filter(models.Inventory.quantity_in_stock < models.Inventory.minimum_stock_level)
    
    items = query.offset(skip).limit(limit).all()
    return items

@router.post("/inventory", response_model=schemas.InventoryResponse)
def create_inventory_item(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    """Create a new inventory item"""
    db_item = models.Inventory(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    log_activity(db, None, "create", "inventory", db_item.id, f"Created inventory item: {item.name}")
    
    return db_item

@router.put("/inventory/{item_id}", response_model=schemas.InventoryResponse)
def update_inventory_item(item_id: str, item_update: schemas.InventoryUpdate, db: Session = Depends(get_db)):
    """Update an inventory item"""
    from uuid import UUID
    try:
        item_uuid = UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_uuid).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = item_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)
    
    db_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_item)
    
    log_activity(db, None, "update", "inventory", item_id, f"Updated inventory item: {db_item.name}")
    
    return db_item

@router.delete("/inventory/{item_id}")
def delete_inventory_item(item_id: str, db: Session = Depends(get_db)):
    """Delete an inventory item"""
    from uuid import UUID
    try:
        item_uuid = UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_uuid).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    name = db_item.name
    db.delete(db_item)
    db.commit()
    
    log_activity(db, None, "delete", "inventory", item_id, f"Deleted inventory item: {name}")
    
    return {"message": "Item deleted successfully"}

# ==================== SERVICES ENDPOINTS ====================

@router.get("/services", response_model=List[schemas.ServiceResponse])
def get_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all services"""
    services = db.query(shared_models.ServiceType).offset(skip).limit(limit).all()
    return services

@router.post("/services", response_model=schemas.ServiceResponse)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    """Create a new service"""
    db_service = shared_models.ServiceType(**service.dict())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    
    log_activity(db, None, "create", "service", db_service.id, f"Created service: {service.name}")
    
    return db_service

# ==================== DASHBOARD STATS ====================

@router.get("/stats/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    
    # Total users
    total_users = db.query(func.count(models.User.id)).scalar()
    
    # Total revenue (from completed appointments)
    total_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
        models.Appointment.status == "completed"
    ).scalar() or 0
    
    # Completed services
    completed_services = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.status == "completed"
    ).scalar()
    
    # Monthly revenue (last 7 days)
    today = datetime.utcnow()
    weekly_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
            models.Appointment.status == "completed",
            models.Appointment.updated_at >= day_start,
            models.Appointment.updated_at < day_end
        ).scalar() or 0
        
        weekly_data.append({
            "label": day.strftime("%a"),
            "value": float(revenue) / 1000000,  # Convert to millions
            "height": f"{min(int(revenue / 10000), 100)}%"
        })
    
    # Top services - Get from service_types table joined with appointments
    top_services = db.query(
        shared_models.ServiceType.name,
        func.count(models.Appointment.id).label('count')
    ).join(
        models.Appointment,
        shared_models.ServiceType.id == models.Appointment.service_type_id
    ).filter(
        models.Appointment.status == "completed"
    ).group_by(shared_models.ServiceType.name).order_by(desc('count')).limit(5).all()
    
    top_services_data = [{
        "name": name if name else "Unknown Service",
        "count": max(count, 10),  # Use default count
        "percent": min(int(count / 10 * 100), 100) if count else 50
    } for name, count in top_services] if top_services else [
        {"name": "Battery Check", "count": 15, "percent": 100},
        {"name": "Tire Service", "count": 12, "percent": 80},
        {"name": "Brake Inspection", "count": 10, "percent": 67},
        {"name": "Wheel Alignment", "count": 8, "percent": 53},
        {"name": "AC Service", "count": 6, "percent": 40}
    ]
    
    # Recent activities
    recent_activities = db.query(models.ActivityLog).order_by(
        desc(models.ActivityLog.created_at)
    ).limit(5).all()
    
    activities_data = [{
        "type": log.entity_type or "system",
        "icon": get_activity_icon(log.action),
        "message": log.details.get('message', log.action) if log.details else log.action,
        "time": format_time_ago(log.created_at),
        "color": get_activity_color(log.entity_type or "system")
    } for log in recent_activities]
    
    # Top technicians
    top_techs = db.query(
        models.User.id,
        models.User.full_name,
        func.count(models.Appointment.id).label('completed')
    ).join(models.Technician, models.User.id == models.Technician.user_id).join(
        models.Appointment, models.Technician.id == models.Appointment.technician_id
    ).filter(
        models.User.role == "technician",
        models.Appointment.status == "completed"
    ).group_by(models.User.id, models.User.full_name).order_by(desc('completed')).limit(3).all()
    
    top_techs_data = [{
        "rank": idx + 1,
        "name": name,
        "avatar": name[0] if name else "T",
        "completed": completed,
        "rating": 4.8  # Mock rating
    } for idx, (user_id, name, completed) in enumerate(top_techs)]
    
    return {
        "total_users": total_users,
        "total_revenue": total_revenue,
        "completed_services": completed_services,
        "average_rating": 4.8,
        "monthly_revenue": weekly_data,
        "top_services": top_services_data,
        "recent_activities": activities_data,
        "top_technicians": top_techs_data
    }

# ==================== ACTIVITY LOGS ====================

@router.get("/activities", response_model=List[schemas.ActivityLogResponse])
def get_activities(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Get activity logs"""
    activities = db.query(models.ActivityLog).order_by(
        desc(models.ActivityLog.created_at)
    ).offset(skip).limit(limit).all()
    return activities

# ==================== HELPER FUNCTIONS ====================

def log_activity(db: Session, user_id, action, entity_type, entity_id, description):
    """Log an activity"""
    activity = models.ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details={"message": description} if description else None
    )
    db.add(activity)
    db.commit()

def get_activity_icon(action):
    """Get icon for activity action"""
    icons = {
        "create": "➕",
        "update": "✏️",
        "delete": "🗑️",
        "reset_password": "🔑"
    }
    return icons.get(action, "📝")

def get_activity_color(entity_type):
    """Get color for entity type"""
    colors = {
        "user": "#667eea",
        "branch": "#48bb78",
        "inventory": "#f59e0b",
        "service": "#00d4ff",
        "appointment": "#764ba2"
    }
    return colors.get(entity_type, "#718096")

def format_time_ago(dt):
    """Format datetime to 'X minutes/hours ago'"""
    now = datetime.utcnow()
    diff = now - dt
    
    if diff.days > 0:
        return f"{diff.days} ngày trước"
    elif diff.seconds >= 3600:
        hours = diff.seconds // 3600
        return f"{hours} giờ trước"
    elif diff.seconds >= 60:
        minutes = diff.seconds // 60
        return f"{minutes} phút trước"
    else:
        return "Vừa xong"

# ==================== FINANCE ENDPOINTS ====================

@router.get("/finance/stats", response_model=schemas.FinanceStats)
def get_finance_stats(db: Session = Depends(get_db)):
    """Get financial statistics"""
    
    # Total revenue from completed appointments
    total_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
        models.Appointment.status == "completed",
        models.Appointment.actual_cost.isnot(None)
    ).scalar() or 0
    
    # Total expenses (mock - would come from expenses table)
    total_expenses = total_revenue * 0.6  # 60% of revenue as expenses
    
    # Net profit
    net_profit = total_revenue - total_expenses
    
    # Total transactions
    total_transactions = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.status == "completed"
    ).scalar()
    
    # Completed services
    completed_services = total_transactions
    
    # Pending payments
    pending_payments = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.status == "confirmed"
    ).scalar()
    
    # Revenue growth (last 30 days vs previous 30 days)
    today = datetime.utcnow()
    thirty_days_ago = today - timedelta(days=30)
    sixty_days_ago = today - timedelta(days=60)
    
    current_month_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
        models.Appointment.status == "completed",
        models.Appointment.updated_at >= thirty_days_ago
    ).scalar() or 0
    
    previous_month_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
        models.Appointment.status == "completed",
        models.Appointment.updated_at >= sixty_days_ago,
        models.Appointment.updated_at < thirty_days_ago
    ).scalar() or 1  # Avoid division by zero
    
    revenue_growth = ((current_month_revenue - previous_month_revenue) / previous_month_revenue) * 100 if previous_month_revenue > 0 else 0
    
    # Top services by revenue
    top_services_query = db.query(
        models.ServiceType.name,
        func.count(models.Appointment.id).label('count'),
        func.sum(models.Appointment.actual_cost).label('revenue')
    ).join(
        models.Appointment,
        models.ServiceType.id == models.Appointment.service_type_id
    ).filter(
        models.Appointment.status == "completed"
    ).group_by(models.ServiceType.name).order_by(desc('revenue')).limit(5).all()
    
    top_services = [{
        "name": name if name else "Unknown Service",
        "count": count,
        "revenue": float(revenue) if revenue else 0
    } for name, count, revenue in top_services_query] if top_services_query else [
        {"name": "Battery Check", "count": 45, "revenue": 22500000},
        {"name": "Tire Service", "count": 38, "revenue": 19000000},
        {"name": "Brake Inspection", "count": 32, "revenue": 16000000},
        {"name": "Wheel Alignment", "count": 28, "revenue": 14000000},
        {"name": "AC Service", "count": 25, "revenue": 12500000}
    ]
    
    # Monthly data (last 12 months)
    monthly_data = []
    for i in range(11, -1, -1):
        month_start = today.replace(day=1) - timedelta(days=30 * i)
        month_end = month_start + timedelta(days=30)
        
        month_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
            models.Appointment.status == "completed",
            models.Appointment.updated_at >= month_start,
            models.Appointment.updated_at < month_end
        ).scalar() or 0
        
        monthly_data.append({
            "month": month_start.strftime("%b %Y"),
            "revenue": float(month_revenue),
            "expenses": float(month_revenue * 0.6),
            "profit": float(month_revenue * 0.4)
        })
    
    return schemas.FinanceStats(
        total_revenue=float(total_revenue),
        total_expenses=float(total_expenses),
        net_profit=float(net_profit),
        total_transactions=total_transactions,
        completed_services=completed_services,
        pending_payments=pending_payments,
        revenue_growth=float(revenue_growth),
        top_services=top_services,
        monthly_data=monthly_data
    )

@router.get("/finance/transactions")
def get_transactions(
    skip: int = 0,
    limit: int = 50,
    status: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    """Get all financial transactions"""
    query = db.query(models.Appointment).filter(
        models.Appointment.actual_cost.isnot(None)
    )
    
    if status:
        query = query.filter(models.Appointment.status == status)
    
    if start_date:
        query = query.filter(models.Appointment.created_at >= datetime.fromisoformat(start_date))
    
    if end_date:
        query = query.filter(models.Appointment.created_at <= datetime.fromisoformat(end_date))
    
    transactions = query.order_by(desc(models.Appointment.created_at)).offset(skip).limit(limit).all()
    
    # Format response
    result = []
    for t in transactions:
        # Get service name
        service = db.query(models.ServiceType).filter(models.ServiceType.id == t.service_type_id).first()
        service_name = service.name if service else "Unknown Service"
        
        result.append({
            "id": str(t.id),
            "appointment_id": str(t.id),
            "customer_name": "Customer",  # Would need to join with customers table
            "service_name": service_name,
            "amount": float(t.actual_cost) if t.actual_cost else 0,
            "type": "revenue",
            "status": t.status,
            "payment_method": "Cash",  # Mock data
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    
    return result

@router.get("/finance/revenue")
def get_revenue_data(
    period: str = "monthly",  # daily, weekly, monthly
    db: Session = Depends(get_db)
):
    """Get revenue data by period"""
    today = datetime.utcnow()
    data = []
    
    if period == "daily":
        # Last 30 days
        for i in range(29, -1, -1):
            day = today - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
                models.Appointment.status == "completed",
                models.Appointment.updated_at >= day_start,
                models.Appointment.updated_at < day_end
            ).scalar() or 0
            
            transactions = db.query(func.count(models.Appointment.id)).filter(
                models.Appointment.status == "completed",
                models.Appointment.updated_at >= day_start,
                models.Appointment.updated_at < day_end
            ).scalar() or 0
            
            data.append({
                "date": day.strftime("%Y-%m-%d"),
                "amount": float(revenue),
                "transactions": transactions
            })
    
    elif period == "monthly":
        # Last 12 months
        for i in range(11, -1, -1):
            month_start = today.replace(day=1) - timedelta(days=30 * i)
            month_end = month_start + timedelta(days=30)
            
            revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
                models.Appointment.status == "completed",
                models.Appointment.updated_at >= month_start,
                models.Appointment.updated_at < month_end
            ).scalar() or 0
            
            transactions = db.query(func.count(models.Appointment.id)).filter(
                models.Appointment.status == "completed",
                models.Appointment.updated_at >= month_start,
                models.Appointment.updated_at < month_end
            ).scalar() or 0
            
            data.append({
                "date": month_start.strftime("%Y-%m"),
                "amount": float(revenue),
                "transactions": transactions
            })
    
    return data

@router.get("/finance/expenses")
def get_expense_data(db: Session = Depends(get_db)):
    """Get expense breakdown by category"""
    
    # Mock expense data (would come from expenses table in real app)
    total_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
        models.Appointment.status == "completed"
    ).scalar() or 100000000
    
    expenses = [
        {"category": "Phụ tùng & Vật liệu", "amount": total_revenue * 0.35, "percentage": 35},
        {"category": "Lương nhân viên", "amount": total_revenue * 0.20, "percentage": 20},
        {"category": "Vận hành & Bảo trì", "amount": total_revenue * 0.10, "percentage": 10},
        {"category": "Marketing", "amount": total_revenue * 0.05, "percentage": 5},
        {"category": "Chi phí khác", "amount": total_revenue * 0.05, "percentage": 5}
    ]
    
    return expenses

# ==================== FINANCE EXPORT ENDPOINTS ====================

@router.get("/finance/export/pdf")
def export_finance_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export finance report as PDF (simplified version - returns CSV for now)"""
    
    # Get finance data
    stats = {}
    total_revenue = db.query(func.sum(models.Appointment.actual_cost)).filter(
        models.Appointment.status == "completed"
    ).scalar() or 0
    
    total_transactions = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.status == "completed"
    ).scalar() or 0
    
    # Create CSV content (as PDF generation requires additional libraries)
    content = f"""BÁO CÁO TÀI CHÍNH
Ngày xuất: {datetime.now().strftime('%d/%m/%Y %H:%M')}
{'-' * 50}

TỔNG QUAN TÀI CHÍNH:
Tổng doanh thu: {total_revenue:,.0f} VNĐ
Tổng giao dịch: {total_transactions}
Lợi nhuận ròng: {total_revenue * 0.4:,.0f} VNĐ

{'-' * 50}
Báo cáo được tạo tự động bởi hệ thống EV Care
"""
    
    # Create in-memory file
    output = io.BytesIO()
    output.write(content.encode('utf-8'))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=finance-report-{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )

@router.get("/finance/export/excel")
def export_finance_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export finance report as Excel (simplified CSV version)"""
    
    # Get transactions
    transactions = db.query(models.Appointment).filter(
        models.Appointment.status == "completed"
    ).limit(1000).all()
    
    # Create CSV content
    csv_content = "ID,Dịch vụ,Số tiền,Trạng thái,Ngày tạo\n"
    
    for t in transactions:
        # Get service name separately
        service_name = "N/A"
        if t.service_type_id:
            service = db.query(models.ServiceType).filter(models.ServiceType.id == t.service_type_id).first()
            service_name = service.name if service else "N/A"
        csv_content += f"{t.id},{service_name},{t.actual_cost},{t.status},{t.created_at}\n"
    
    # Create in-memory file
    output = io.BytesIO()
    output.write(csv_content.encode('utf-8-sig'))  # BOM for Excel UTF-8
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=finance-report-{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

# ==================== APPOINTMENTS ENDPOINTS ====================

@router.get("/appointments", response_model=List[schemas.AppointmentResponse])
def get_appointments(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get all appointments"""
    query = db.query(models.Appointment)
    
    if status:
        query = query.filter(models.Appointment.status == status)
    
    appointments = query.offset(skip).limit(limit).all()
    return appointments

@router.get("/appointments/{appointment_id}", response_model=schemas.AppointmentResponse)
def get_appointment(appointment_id: str, db: Session = Depends(get_db)):
    """Get a specific appointment"""
    from uuid import UUID
    try:
        appointment_uuid = UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_uuid).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@router.post("/appointments", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    """Create a new appointment"""
    db_appointment = models.Appointment(**appointment.dict())
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    
    log_activity(db, None, "create", "appointment", db_appointment.id, f"Created appointment: {db_appointment.id}")
    
    return db_appointment

@router.put("/appointments/{appointment_id}", response_model=schemas.AppointmentResponse)
def update_appointment(appointment_id: str, appointment_update: schemas.AppointmentUpdate, db: Session = Depends(get_db)):
    """Update an appointment"""
    from uuid import UUID
    try:
        appointment_uuid = UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_uuid).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    update_data = appointment_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_appointment, field, value)
    
    db.commit()
    db.refresh(db_appointment)
    
    log_activity(db, None, "update", "appointment", appointment_id, f"Updated appointment: {db_appointment.id}")
    
    return db_appointment

@router.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: str, db: Session = Depends(get_db)):
    """Delete an appointment"""
    from uuid import UUID
    try:
        appointment_uuid = UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    db_appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_uuid).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if appointment can be deleted
    if db_appointment.status in ["in_progress", "completed"]:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete appointment that is in progress or completed"
        )
    
    appointment_id_str = str(db_appointment.id)
    db.delete(db_appointment)
    db.commit()
    
    log_activity(db, None, "delete", "appointment", appointment_id, f"Deleted appointment: {appointment_id_str}")
    
    return {"message": "Appointment deleted successfully"}

# ==================== WORK SCHEDULE ENDPOINTS ====================

@router.get("/work-schedules", response_model=List[schemas.WorkScheduleResponse])
def get_work_schedules(
    skip: int = 0,
    limit: int = 100,
    technician_id: Optional[str] = None,
    service_center_id: Optional[str] = None,
    shift_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all work schedules with optional filters"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(models.WorkSchedule).options(
        joinedload(models.WorkSchedule.technician).joinedload(models.Technician.user),
        joinedload(models.WorkSchedule.service_center)
    )
    
    if technician_id:
        try:
            tech_uuid = UUID(technician_id)
            query = query.filter(models.WorkSchedule.technician_id == tech_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid technician UUID format")
    
    if service_center_id:
        try:
            center_uuid = UUID(service_center_id)
            query = query.filter(models.WorkSchedule.service_center_id == center_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid service center UUID format")
    
    if shift_date:
        try:
            shift_date_obj = datetime.fromisoformat(shift_date).date()
            query = query.filter(models.WorkSchedule.shift_date == shift_date_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    schedules = query.order_by(models.WorkSchedule.shift_date.desc(), models.WorkSchedule.shift_start).offset(skip).limit(limit).all()
    
    # Format response with additional fields
    result = []
    for schedule in schedules:
        schedule_dict = {
            "id": schedule.id,
            "technician_id": schedule.technician.user_id if schedule.technician else None,  # Return user_id instead of technician_id
            "service_center_id": schedule.service_center_id,
            "shift_date": schedule.shift_date,
            "shift_start": schedule.shift_start.strftime("%H:%M") if schedule.shift_start else None,
            "shift_end": schedule.shift_end.strftime("%H:%M") if schedule.shift_end else None,
            "is_available": schedule.is_available,
            "created_at": schedule.created_at,
            "updated_at": schedule.updated_at,
            "technician_name": schedule.technician.user.full_name if schedule.technician and schedule.technician.user else None,
            "service_center_name": schedule.service_center.name if schedule.service_center else None
        }
        result.append(schedule_dict)
    
    return result

@router.get("/work-schedules/{schedule_id}", response_model=schemas.WorkScheduleResponse)
def get_work_schedule(schedule_id: str, db: Session = Depends(get_db)):
    """Get a specific work schedule"""
    from sqlalchemy.orm import joinedload
    from uuid import UUID
    try:
        schedule_uuid = UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    schedule = db.query(models.WorkSchedule).options(
        joinedload(models.WorkSchedule.technician).joinedload(models.Technician.user),
        joinedload(models.WorkSchedule.service_center)
    ).filter(models.WorkSchedule.id == schedule_uuid).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Work schedule not found")
    
    return {
        "id": schedule.id,
        "technician_id": schedule.technician.user_id if schedule.technician else None,  # Return user_id
        "service_center_id": schedule.service_center_id,
        "shift_date": schedule.shift_date,
        "shift_start": schedule.shift_start.strftime("%H:%M") if schedule.shift_start else None,
        "shift_end": schedule.shift_end.strftime("%H:%M") if schedule.shift_end else None,
        "is_available": schedule.is_available,
        "created_at": schedule.created_at,
        "updated_at": schedule.updated_at,
        "technician_name": schedule.technician.user.full_name if schedule.technician and schedule.technician.user else None,
        "service_center_name": schedule.service_center.name if schedule.service_center else None
    }

@router.post("/work-schedules", response_model=schemas.WorkScheduleResponse)
def create_work_schedule(schedule: schemas.WorkScheduleCreate, db: Session = Depends(get_db)):
    """Create a new work schedule"""
    from datetime import time
    
    # Handle technician_id: check if it's a user_id and convert to technician_id
    technician_id = schedule.technician_id
    technician = db.query(models.Technician).filter(models.Technician.id == technician_id).first()
    if not technician:
        # If not found as technician ID, check if it's a user ID
        technician = db.query(models.Technician).filter(models.Technician.user_id == technician_id).first()
        if technician:
            technician_id = technician.id
        else:
            # Check if this is a staff member who needs a technician record created
            user = db.query(models.User).filter(models.User.id == technician_id).first()
            if user and user.role in ['technician', 'staff']:
                # Create technician record for this user if they don't have one
                new_technician = models.Technician(
                    user_id=technician_id,
                    employee_id=f"EMP_{technician_id.hex[:8].upper()}",  # Generate employee ID
                    specialization="General" if user.role == "staff" else "Technical",
                    experience_years=0,
                    certification_number=None,
                    is_available=True
                )
                db.add(new_technician)
                db.commit()
                db.refresh(new_technician)
                technician_id = new_technician.id
                technician = new_technician
            else:
                raise HTTPException(status_code=404, detail="User not found or not eligible for shifts")
    
    # Validate service center exists
    service_center = db.query(models.Branch).filter(models.Branch.id == schedule.service_center_id).first()
    if not service_center:
        raise HTTPException(status_code=404, detail="Service center not found")
    
    # Parse time strings
    try:
        shift_start = time.fromisoformat(schedule.shift_start)
        shift_end = time.fromisoformat(schedule.shift_end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM format")
    
    # Check for conflicting schedules
    existing = db.query(models.WorkSchedule).filter(
        models.WorkSchedule.technician_id == technician_id,
        models.WorkSchedule.shift_date == schedule.shift_date,
        models.WorkSchedule.shift_start < shift_end,
        models.WorkSchedule.shift_end > shift_start
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Technician already has a conflicting schedule for this time")
    
    db_schedule = models.WorkSchedule(
        technician_id=technician_id,
        service_center_id=schedule.service_center_id,
        shift_date=schedule.shift_date,
        shift_start=shift_start,
        shift_end=shift_end,
        is_available=schedule.is_available
    )
    
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    log_activity(db, None, "create", "work_schedule", db_schedule.id, f"Created work schedule for technician {technician.user.full_name if technician.user else 'Unknown'}")
    
    return {
        "id": db_schedule.id,
        "technician_id": technician.user_id,  # Return user_id
        "service_center_id": db_schedule.service_center_id,
        "shift_date": db_schedule.shift_date,
        "shift_start": db_schedule.shift_start.strftime("%H:%M"),
        "shift_end": db_schedule.shift_end.strftime("%H:%M"),
        "is_available": db_schedule.is_available,
        "created_at": db_schedule.created_at,
        "updated_at": db_schedule.updated_at,
        "technician_name": technician.user.full_name if technician.user else None,
        "service_center_name": service_center.name
    }

# Test endpoint without authentication
@router.post("/test/work-schedules", response_model=schemas.WorkScheduleResponse)
def test_create_work_schedule(schedule: schemas.WorkScheduleCreate, db: Session = Depends(get_db)):
    """Test endpoint to create work schedule without authentication"""
    from datetime import time
    
    # Validate technician exists
    technician = db.query(models.Technician).filter(models.Technician.id == schedule.technician_id).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    # Validate service center exists
    service_center = db.query(models.Branch).filter(models.Branch.id == schedule.service_center_id).first()
    if not service_center:
        raise HTTPException(status_code=404, detail="Service center not found")
    
    # Parse time strings
    try:
        shift_start = time.fromisoformat(schedule.shift_start)
        shift_end = time.fromisoformat(schedule.shift_end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM format")
    
    # Check for conflicting schedules
    existing = db.query(models.WorkSchedule).filter(
        models.WorkSchedule.technician_id == schedule.technician_id,
        models.WorkSchedule.shift_date == schedule.shift_date,
        models.WorkSchedule.shift_start < shift_end,
        models.WorkSchedule.shift_end > shift_start
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Technician already has a conflicting schedule for this time")
    
    db_schedule = models.WorkSchedule(
        technician_id=schedule.technician_id,
        service_center_id=schedule.service_center_id,
        shift_date=schedule.shift_date,
        shift_start=shift_start,
        shift_end=shift_end,
        is_available=schedule.is_available
    )
    
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    return {
        "id": db_schedule.id,
        "technician_id": db_schedule.technician_id,
        "service_center_id": db_schedule.service_center_id,
        "shift_date": db_schedule.shift_date,
        "shift_start": db_schedule.shift_start.strftime("%H:%M"),
        "shift_end": db_schedule.shift_end.strftime("%H:%M"),
        "is_available": db_schedule.is_available,
        "created_at": db_schedule.created_at,
        "updated_at": db_schedule.updated_at,
        "technician_name": technician.user.full_name if technician.user else None,
        "service_center_name": service_center.name
    }

@router.put("/work-schedules/{schedule_id}", response_model=schemas.WorkScheduleResponse)
def update_work_schedule(schedule_id: str, schedule_update: schemas.WorkScheduleUpdate, db: Session = Depends(get_db)):
    """Update a work schedule"""
    from sqlalchemy.orm import joinedload
    from uuid import UUID
    from datetime import time
    
    try:
        schedule_uuid = UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    schedule = db.query(models.WorkSchedule).options(
        joinedload(models.WorkSchedule.technician).joinedload(models.Technician.user),
        joinedload(models.WorkSchedule.service_center)
    ).filter(models.WorkSchedule.id == schedule_uuid).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Work schedule not found")
    
    update_data = schedule_update.dict(exclude_unset=True)
    
    # Handle technician_id: check if it's a user_id and convert to technician_id
    if 'technician_id' in update_data:
        tech_id = update_data['technician_id']
        # First check if it's already a technician ID
        technician = db.query(models.Technician).filter(models.Technician.id == tech_id).first()
        if not technician:
            # If not found, check if it's a user ID and find the corresponding technician
            technician = db.query(models.Technician).filter(models.Technician.user_id == tech_id).first()
            if technician:
                update_data['technician_id'] = technician.id
            else:
                # Check if this is a staff member who needs a technician record created
                user = db.query(models.User).filter(models.User.id == tech_id).first()
                if user and user.role in ['technician', 'staff']:
                    # Create technician record for this user if they don't have one
                    new_technician = models.Technician(
                        user_id=tech_id,
                        employee_id=f"EMP_{tech_id.hex[:8].upper()}",  # Generate employee ID
                        specialization="General" if user.role == "staff" else "Technical",
                        experience_years=0,
                        certification_number=None,
                        is_available=True
                    )
                    db.add(new_technician)
                    db.commit()
                    db.refresh(new_technician)
                    update_data['technician_id'] = new_technician.id
                else:
                    raise HTTPException(status_code=404, detail="User not found or not eligible for shifts")
    
    # Handle time parsing
    if 'shift_start' in update_data:
        try:
            update_data['shift_start'] = time.fromisoformat(update_data['shift_start'])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid shift_start time format. Use HH:MM format")
    
    if 'shift_end' in update_data:
        try:
            update_data['shift_end'] = time.fromisoformat(update_data['shift_end'])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid shift_end time format. Use HH:MM format")
    
    # Check for conflicts if technician, date, or time changed
    if any(key in update_data for key in ['technician_id', 'shift_date', 'shift_start', 'shift_end']):
        tech_id = update_data.get('technician_id', schedule.technician_id)
        shift_date = update_data.get('shift_date', schedule.shift_date)
        shift_start = update_data.get('shift_start', schedule.shift_start)
        shift_end = update_data.get('shift_end', schedule.shift_end)
        
        existing = db.query(models.WorkSchedule).filter(
            models.WorkSchedule.id != schedule.id,
            models.WorkSchedule.technician_id == tech_id,
            models.WorkSchedule.shift_date == shift_date,
            models.WorkSchedule.shift_start < shift_end,
            models.WorkSchedule.shift_end > shift_start
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Technician already has a conflicting schedule for this time")
    
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    db.commit()
    db.refresh(schedule)
    
    log_activity(db, None, "update", "work_schedule", schedule_id, f"Updated work schedule for technician {schedule.technician.user.full_name if schedule.technician and schedule.technician.user else 'Unknown'}")
    
    return {
        "id": schedule.id,
        "technician_id": schedule.technician.user_id if schedule.technician else None,  # Return user_id
        "service_center_id": schedule.service_center_id,
        "shift_date": schedule.shift_date,
        "shift_start": schedule.shift_start.strftime("%H:%M"),
        "shift_end": schedule.shift_end.strftime("%H:%M"),
        "is_available": schedule.is_available,
        "created_at": schedule.created_at,
        "updated_at": schedule.updated_at,
        "technician_name": schedule.technician.user.full_name if schedule.technician and schedule.technician.user else None,
        "service_center_name": schedule.service_center.name if schedule.service_center else None
    }

@router.delete("/work-schedules/{schedule_id}")
def delete_work_schedule(schedule_id: str, db: Session = Depends(get_db)):
    """Delete a work schedule"""
    from uuid import UUID
    try:
        schedule_uuid = UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    schedule = db.query(models.WorkSchedule).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Work schedule not found")
    
    # Get technician name for logging
    technician = db.query(models.Technician).filter(models.Technician.id == schedule.technician_id).first()
    technician_name = technician.user.full_name if technician and technician.user else "Unknown"
    
    db.delete(schedule)
    db.commit()
    
    log_activity(db, None, "delete", "work_schedule", schedule_id, f"Deleted work schedule for technician {technician_name}")
    
    return {"message": "Work schedule deleted successfully"}

@router.get("/work-schedules/calendar/{service_center_id}")
def get_schedule_calendar(service_center_id: str, month: Optional[str] = None, db: Session = Depends(get_db)):
    """Get schedule calendar for a service center"""
    from uuid import UUID
    from datetime import datetime, timedelta
    
    try:
        center_uuid = UUID(service_center_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid service center UUID format")
    
    # Parse month parameter (YYYY-MM format)
    if month:
        try:
            year, month_num = map(int, month.split('-'))
            start_date = datetime(year, month_num, 1).date()
            if month_num == 12:
                end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
            else:
                end_date = datetime(year, month_num + 1, 1).date() - timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    else:
        # Default to current month
        today = datetime.utcnow().date()
        start_date = today.replace(day=1)
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    
    # Get all schedules for the service center in the date range
    schedules = db.query(models.WorkSchedule).options(
        joinedload(models.WorkSchedule.technician).joinedload(models.Technician.user)
    ).filter(
        models.WorkSchedule.service_center_id == center_uuid,
        models.WorkSchedule.shift_date >= start_date,
        models.WorkSchedule.shift_date <= end_date
    ).order_by(models.WorkSchedule.shift_date, models.WorkSchedule.shift_start).all()
    
    # Group by date
    calendar = {}
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.isoformat()
        calendar[date_str] = []
        current_date += timedelta(days=1)
    
    for schedule in schedules:
        date_str = schedule.shift_date.isoformat()
        if date_str in calendar:
            calendar[date_str].append({
                "id": str(schedule.id),
                "technician_id": str(schedule.technician.user_id) if schedule.technician else None,  # Return user_id
                "technician_name": schedule.technician.user.full_name if schedule.technician and schedule.technician.user else "Unknown",
                "shift_start": schedule.shift_start.strftime("%H:%M"),
                "shift_end": schedule.shift_end.strftime("%H:%M"),
                "is_available": schedule.is_available
            })
    
    return {
        "service_center_id": service_center_id,
        "month": f"{start_date.year}-{start_date.month:02d}",
        "calendar": calendar
    }
