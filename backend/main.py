# Quản lý khách hàng - Backend
if __name__ == "__main__":
    print("Customer Service - Team Member 1")

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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
    Customer, User, Notification, ServiceRecord, Invoice, Part
)
from shared.auth import get_current_user, require_role
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

# Mã nguồn thực tế từ backend/admin_service/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.auth import get_current_user, require_role

# Database setup
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/ev_repair_db')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# FastAPI app
app = FastAPI(title="Admin Service API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routes
from routes import router as admin_router

app.include_router(admin_router, prefix="/api/admin", tags=["admin"])

@app.get("/")
def read_root():
    return {"service": "Admin Service", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)
