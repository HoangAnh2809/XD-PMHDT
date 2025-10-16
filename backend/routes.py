# Mã nguồn thực tế từ backend/admin_service/routes.py
from fastapi import Body, APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta
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

router = APIRouter()
