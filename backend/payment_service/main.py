from fastapi import FastAPI, Depends, HTTPException, status, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import sys
import os
import hashlib
import hmac
import urllib.parse
from uuid import UUID
from datetime import datetime, date, timedelta
import json
import requests
from pytz import timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db, engine
from shared.models import Base, Invoice, Payment, Appointment, Customer, Vehicle, Technician, ServiceCenter, ServiceRecord, User
from shared.auth import get_current_user, require_role, api_gateway_client
from schemas import *
from vnpay import VNPay
from config_vnpay import *

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Payment Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# VNPay Configuration (imported from config_vnpay.py)

# Invoice Management
@app.post("/invoices/manual", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_invoice(
    invoice_data: InvoiceCreate,
    current_user: dict = Depends(require_role(["staff", "admin", "technician"])),
    db: Session = Depends(get_db)
):
    """
    Manually create an invoice (for staff/technician use when auto-generation fails)
    """
    # Validate customer exists
    customer = db.query(Customer).filter(Customer.id == invoice_data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # If appointment_id is provided, validate it exists and belongs to the customer
    if invoice_data.appointment_id:
        appointment = db.query(Appointment).filter(
            Appointment.id == invoice_data.appointment_id,
            Appointment.customer_id == invoice_data.customer_id
        ).first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found or doesn't belong to customer")

    # Generate invoice number
    last_invoice = db.query(Invoice).order_by(Invoice.created_at.desc()).first()
    if last_invoice:
        last_num = int(last_invoice.invoice_number.split("-")[-1])
        invoice_number = f"INV-{last_num + 1:06d}"
    else:
        invoice_number = "INV-000001"

    # Calculate totals
    subtotal = invoice_data.subtotal
    tax = subtotal * 0.1  # 10% VAT
    total_amount = subtotal + tax - (invoice_data.discount or 0)

    # Create invoice
    db_invoice = Invoice(
        invoice_number=invoice_number,
        appointment_id=invoice_data.appointment_id,
        customer_id=invoice_data.customer_id,
        service_center_id=invoice_data.service_center_id,
        subtotal=subtotal,
        tax=tax,
        discount=invoice_data.discount,
        total_amount=total_amount,
        due_date=invoice_data.due_date,
        notes=f"Manual invoice created by {current_user['role']} {current_user['user_id']}"
    )

    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    # Log manual invoice creation
    print(f"Manual invoice created: {db_invoice.invoice_number} for customer {db_invoice.customer_id} by user {current_user['user_id']} ({current_user['role']})")

    return db_invoice

@app.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(
    customer_id: UUID = None,
    appointment_id: UUID = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Customers can only see their own invoices
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if not customer:
            return []
        invoices = db.query(Invoice).filter(Invoice.customer_id == customer.id).all()
    else:
        query = db.query(Invoice)
        # Allow filtering by appointment_id for admin/staff calls or internal checks
        if appointment_id:
            query = query.filter(Invoice.appointment_id == appointment_id)
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)
        invoices = query.all()
    
    return invoices


@app.get("/invoices/comprehensive", response_model=List[InvoiceDetailsResponse])
async def get_comprehensive_invoices(
    customer_id: UUID = None,
    appointment_id: UUID = None,
    payment_status: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive invoice list with full appointment, customer, and vehicle details
    """
    # Base query
    query = db.query(Invoice)
    
    # Apply filters
    if appointment_id:
        query = query.filter(Invoice.appointment_id == appointment_id)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)
    
    # Role-based filtering
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if not customer:
            return []
        query = query.filter(Invoice.customer_id == customer.id)
    
    invoices = query.order_by(Invoice.created_at.desc()).all()
    
    # Build comprehensive response for each invoice
    result = []
    for invoice in invoices:
        # Get appointment details if available
        appointment = None
        if invoice.appointment_id:
            appointment_query = db.query(Appointment).filter(Appointment.id == invoice.appointment_id).first()
            if appointment_query:
                # Get related data for appointment
                customer_data = None
                if appointment_query.customer_id:
                    customer_query = db.query(Customer, User).join(User, Customer.user_id == User.id).filter(Customer.id == appointment_query.customer_id).first()
                    if customer_query:
                        customer_obj, user_obj = customer_query
                        customer_data = {
                            "id": customer_obj.id,
                            "full_name": user_obj.full_name,
                            "email": user_obj.email,
                            "phone": user_obj.phone,
                            "address": customer_obj.address
                        }
                
                vehicle_data = None
                if appointment_query.vehicle_id:
                    vehicle = db.query(Vehicle).filter(Vehicle.id == appointment_query.vehicle_id).first()
                    if vehicle:
                        vehicle_data = {
                            "id": vehicle.id,
                            "license_plate": vehicle.license_plate,
                            "make": vehicle.make,
                            "model": vehicle.model,
                            "year": vehicle.year,
                            "color": vehicle.color,
                            "current_mileage": vehicle.current_mileage
                        }
                
                technician_data = None
                if appointment_query.technician_id:
                    technician_query = db.query(Technician, User).join(User, Technician.user_id == User.id).filter(Technician.id == appointment_query.technician_id).first()
                    if technician_query:
                        technician_obj, user_obj = technician_query
                        technician_data = {
                            "id": technician_obj.id,
                            "full_name": user_obj.full_name
                        }
                
                service_center_data = None
                if appointment_query.service_center_id:
                    service_center = db.query(ServiceCenter).filter(ServiceCenter.id == appointment_query.service_center_id).first()
                    if service_center:
                        service_center_data = {
                            "id": service_center.id,
                            "name": service_center.name
                        }
                
                appointment = {
                    "id": appointment_query.id,
                    "appointment_date": appointment_query.appointment_date.isoformat() if appointment_query.appointment_date else None,
                    "status": appointment_query.status,
                    "customer_notes": appointment_query.customer_notes,
                    "estimated_cost": float(appointment_query.estimated_cost) if appointment_query.estimated_cost else None,
                    "actual_cost": float(appointment_query.actual_cost) if appointment_query.actual_cost else None,
                    "customer": customer_data,
                    "vehicle": vehicle_data,
                    "technician": technician_data,
                    "service_center": service_center_data
                }
        
        # Get service records for this appointment
        service_records = []
        if invoice.appointment_id:
            records = db.query(ServiceRecord).filter(ServiceRecord.appointment_id == invoice.appointment_id).all()
            for record in records:
                technician_data = None
                if record.technician_id:
                    technician_query = db.query(Technician, User).join(User, Technician.user_id == User.id).filter(Technician.id == record.technician_id).first()
                    if technician_query:
                        technician_obj, user_obj = technician_query
                        technician_data = {
                            "id": technician_obj.id,
                            "full_name": user_obj.full_name
                        }
                
                service_records.append({
                    "id": record.id,
                    "service_date": record.service_date.isoformat() if record.service_date else None,
                    "mileage_at_service": record.mileage_at_service,
                    "services_performed": record.services_performed,
                    "diagnosis": record.diagnosis,
                    "recommendations": record.recommendations,
                    "cost": float(record.total_cost) if record.total_cost else None,
                    "technician": technician_data
                })
        
        # Build response
        invoice_data = {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "appointment_id": invoice.appointment_id,
            "customer_id": invoice.customer_id,
            "service_center_id": invoice.service_center_id,
            "issue_date": invoice.issue_date,
            "due_date": invoice.due_date,
            "subtotal": float(invoice.subtotal),
            "tax": float(invoice.tax),
            "discount": float(invoice.discount),
            "total_amount": float(invoice.total_amount),
            "payment_status": invoice.payment_status,
            "payment_method": invoice.payment_method,
            "payment_date": invoice.payment_date,
            "notes": invoice.notes,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
            "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
            "appointment": appointment,
            "service_records": service_records
        }
        
        result.append(invoice_data)
    
    return result

@app.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice_detail(
    invoice_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Customers can only see their own invoices
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if not customer or invoice.customer_id != customer.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return invoice

@app.get("/invoices/{invoice_id}/details", response_model=InvoiceDetailsResponse)
async def get_invoice_details(
    invoice_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get invoice with related data
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Customers can only see their own invoices
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if not customer or invoice.customer_id != customer.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get appointment details if available
    appointment = None
    if invoice.appointment_id:
        appointment_query = db.query(Appointment).filter(Appointment.id == invoice.appointment_id).first()
        if appointment_query:
            # Get related data for appointment
            customer = db.query(Customer, User).join(User, Customer.user_id == User.id).filter(Customer.id == appointment_query.customer_id).first()
            vehicle = db.query(Vehicle).filter(Vehicle.id == appointment_query.vehicle_id).first()
            technician = None
            if appointment_query.technician_id:
                technician = db.query(Technician, User).join(User, Technician.user_id == User.id).filter(Technician.id == appointment_query.technician_id).first()
            service_center = db.query(ServiceCenter).filter(ServiceCenter.id == appointment_query.service_center_id).first()
            
            appointment = {
                "id": appointment_query.id,
                "appointment_date": appointment_query.appointment_date,
                "status": appointment_query.status,
                "customer_notes": appointment_query.customer_notes,
                "estimated_cost": float(appointment_query.estimated_cost) if appointment_query.estimated_cost else None,
                "actual_cost": float(appointment_query.actual_cost) if appointment_query.actual_cost else None,
                "customer": {
                    "id": customer[0].id,
                    "full_name": customer[1].full_name,
                    "email": customer[1].email,
                    "phone": customer[1].phone,
                    "address": customer[0].address
                } if customer else None,
                "vehicle": {
                    "id": vehicle.id,
                    "license_plate": vehicle.license_plate,
                    "make": vehicle.make,
                    "model": vehicle.model,
                    "year": vehicle.year,
                    "color": vehicle.color,
                    "current_mileage": vehicle.current_mileage
                } if vehicle else None,
                "technician": {
                    "id": technician[0].id,
                    "full_name": technician[1].full_name
                } if technician else None,
                "service_center": {
                    "id": service_center.id,
                    "name": service_center.name
                } if service_center else None
            }
    
    # Get service records for this appointment
    service_records = []
    if invoice.appointment_id:
        records = db.query(ServiceRecord).filter(ServiceRecord.appointment_id == invoice.appointment_id).all()
        for record in records:
            technician = None
            if record.technician_id:
                technician = db.query(Technician, User).join(User, Technician.user_id == User.id).filter(Technician.id == record.technician_id).first()
            
            service_records.append({
                "id": record.id,
                "service_date": record.service_date,
                "mileage_at_service": record.mileage_at_service,
                "services_performed": record.services_performed,
                "diagnosis": record.diagnosis,
                "recommendations": record.recommendations,
                "cost": float(record.total_cost) if record.total_cost else None,
                "technician": {
                    "id": technician[0].id,
                    "full_name": technician[1].full_name
                } if technician else None
            })
    
    # Build response
    response = {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "appointment_id": invoice.appointment_id,
        "customer_id": invoice.customer_id,
        "service_center_id": invoice.service_center_id,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "subtotal": float(invoice.subtotal),
        "tax": float(invoice.tax),
        "discount": float(invoice.discount),
        "total_amount": float(invoice.total_amount),
        "payment_status": invoice.payment_status,
        "payment_method": invoice.payment_method,
        "payment_date": invoice.payment_date,
        "notes": invoice.notes,
        "appointment": appointment,
        "service_records": service_records
    }
    
    return response

@app.post("/invoices/generate/{appointment_id}", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def generate_invoice_for_appointment(
    appointment_id: UUID,
    current_user: dict = Depends(require_role(["staff", "admin", "technician"])),
    db: Session = Depends(get_db)
):
    # Get appointment details
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Validate appointment has required data
    if not appointment.customer_id:
        raise HTTPException(status_code=400, detail="Appointment must have a customer assigned")

    if not appointment.actual_cost and not appointment.estimated_cost:
        raise HTTPException(status_code=400, detail="Appointment must have cost information")

    # Check if invoice already exists for this appointment
    existing_invoice = db.query(Invoice).filter(Invoice.appointment_id == appointment_id).first()
    if existing_invoice:
        return existing_invoice

    # Generate invoice number
    last_invoice = db.query(Invoice).order_by(Invoice.created_at.desc()).first()
    if last_invoice:
        last_num = int(last_invoice.invoice_number.split("-")[-1])
        invoice_number = f"INV-{last_num + 1:06d}"
    else:
        invoice_number = "INV-000001"

    # Calculate totals
    subtotal = float(appointment.actual_cost or appointment.estimated_cost or 0)
    tax = subtotal * 0.1  # 10% VAT
    total_amount = subtotal + tax

    # Create invoice
    db_invoice = Invoice(
        invoice_number=invoice_number,
        appointment_id=appointment_id,
        customer_id=appointment.customer_id,
        service_center_id=appointment.service_center_id,
        subtotal=subtotal,
        tax=tax,
        discount=0,  # No discount by default
        total_amount=total_amount,
        due_date=datetime.now().date(),  # Due immediately
        notes=f"Invoice generated for completed appointment #{appointment.id}"
    )

    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    # Log invoice creation for debugging
    print(f"Invoice created: {db_invoice.invoice_number} for customer {db_invoice.customer_id} by user {current_user['user_id']} ({current_user['role']})")

    return db_invoice# Payment Processing
@app.post("/payments/vnpay/create")
async def create_vnpay_payment(
    payment_request: PaymentCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if VNPay is properly configured
    if not VNPAY_TMN_CODE or VNPAY_TMN_CODE in ("your-vnpay-tmn-code", "") or not VNPAY_HASH_SECRET or VNPAY_HASH_SECRET in ("your-vnpay-hash-secret", ""):
        raise HTTPException(
            status_code=503,
            detail="Dịch vụ thanh toán VNPay chưa được cấu hình. Vui lòng liên hệ quản trị viên để thiết lập thông tin VNPay."
        )

    invoice = db.query(Invoice).filter(Invoice.id == payment_request.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    
    if invoice.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Hóa đơn đã được thanh toán")
    
    # Check if there's already a pending VNPay payment for this invoice
    existing_payment = db.query(Payment).filter(
        Payment.invoice_id == invoice.id,
        Payment.payment_method == "vnpay",
        Payment.status == "pending"
    ).first()
    
    if existing_payment:
        # Check if the existing payment is still valid (not expired)
        # VNPay payments expire after the ExpireDate, so we check if it's still valid
        # For simplicity, we'll create a new payment if the existing one is older than 5 minutes
        vn_tz = timezone('Asia/Ho_Chi_Minh')
        now_vn = datetime.now(vn_tz)
        payment_age_minutes = (now_vn - existing_payment.created_at.replace(tzinfo=vn_tz)).total_seconds() / 60
        if payment_age_minutes < 25:  # Less than 25 minutes (5 minutes buffer before 30-minute expiry)
            # Reuse existing payment
            payment = existing_payment
            print(f"Reusing existing VNPay payment {payment.id} for invoice {invoice.id}")
        else:
            # Existing payment is too old, create new one
            print(f"Existing VNPay payment {existing_payment.id} is expired, creating new one")
            existing_payment.status = "failed"  # Mark old payment as failed (expired)
            payment = Payment(
                invoice_id=invoice.id,
                payment_method="vnpay",
                amount=invoice.total_amount,
                status="pending"
            )
            db.add(payment)
    else:
        # Create new payment record
        payment = Payment(
            invoice_id=invoice.id,
            payment_method="vnpay",
            amount=invoice.total_amount,
            status="pending"
        )
        db.add(payment)
    
    db.commit()
    db.refresh(payment)
    
    # Get real client IP from request headers
    client_ip = request.client.host if request.client else "127.0.0.1"
    # Handle IPv4-mapped IPv6 addresses
    if client_ip.startswith("::ffff:"):
        client_ip = client_ip[7:]
    
    # Create VNPay payment URL using proper VNPay class
    # VNPay uses Vietnam timezone (UTC+7) for all date calculations
    vn_tz = timezone('Asia/Ho_Chi_Minh')
    now_vn = datetime.now(vn_tz)
    
    vnp = VNPay()
    vnp.requestData['vnp_Version'] = '2.1.0'
    vnp.requestData['vnp_Command'] = 'pay'
    vnp.requestData['vnp_TmnCode'] = VNPAY_TMN_CODE
    vnp.requestData['vnp_Amount'] = int(invoice.total_amount * 100)  # VNPay uses smallest currency unit
    vnp.requestData['vnp_CurrCode'] = 'VND'
    vnp.requestData['vnp_TxnRef'] = str(payment.id)
    vnp.requestData['vnp_OrderInfo'] = f"Payment for invoice {invoice.invoice_number}"
    vnp.requestData['vnp_OrderType'] = 'other'
    vnp.requestData['vnp_Locale'] = 'en'
    vnp.requestData['vnp_ReturnUrl'] = f"{VNPAY_RETURN_URL}?invoice={invoice.id}"
    vnp.requestData['vnp_CreateDate'] = now_vn.strftime("%Y%m%d%H%M%S")
    vnp.requestData['vnp_IpAddr'] = client_ip
    vnp.requestData['vnp_ExpireDate'] = (now_vn + timedelta(minutes=30)).strftime("%Y%m%d%H%M%S")
    
    payment_url = vnp.get_payment_url(VNPAY_URL, VNPAY_HASH_SECRET)
    
    print(f"VNPay URL generated: {payment_url}")
    
    return {
        "payment_id": str(payment.id),
        "payment_url": payment_url,
        "message": "Redirect customer to this URL to complete payment"
    }


@app.post("/debug/vnpay/create")
async def debug_vnpay_create(
    payload: dict = Body(...),
    request: Request = None
):
    """
    Dev-only endpoint to build VNPay requestData and payment URL for debugging.
    Enable by setting environment variable ALLOW_VNPAY_DEBUG=true.

    Expected payload (all optional):
      - amount: number (VND)
      - order_info: string
      - order_type: string
      - locale: string
      - ip: string
      - expire_minutes: int
    """
    # Allow debug in three cases:
    # 1) ALLOW_VNPAY_DEBUG=true
    # 2) request comes from localhost (dev convenience)
    # 3) request sets X-VNPAY-DEBUG header matching VNPAY_DEBUG_TOKEN
    allow_env = os.getenv('ALLOW_VNPAY_DEBUG', 'false').lower() == 'true'
    allow_local = False
    allow_token = False

    # Check client IP for localhost (handle IPv4-mapped IPv6 too)
    try:
        client_ip = request.client.host if request and request.client else None
        # Debug log to help when running locally
        print(f"[DEBUG] /debug/vnpay/create called from client_ip={client_ip}")
        try:
            # Print a few relevant headers for troubleshooting
            h_preview = {k: v for k, v in list(request.headers.items())[:6]} if request else {}
            print(f"[DEBUG] Request headers (preview): {h_preview}")
        except Exception:
            pass
        if client_ip:
            if client_ip.startswith('127.') or client_ip in ('::1', 'localhost') or client_ip.startswith('::ffff:127.'):
                allow_local = True
        # Also accept requests where Host header or request.url indicate localhost
        try:
            host_hdr = request.headers.get('host', '') if request else ''
            url_host = request.url.hostname if request and request.url else ''
            if 'localhost' in host_hdr or '127.0.0.1' in host_hdr or url_host in ('localhost', '127.0.0.1'):
                allow_local = True
        except Exception:
            pass
    except Exception:
        client_ip = None

    # Optional debug token header — set VNPAY_DEBUG_TOKEN in env for secure access
    try:
        header_token = None
        if request:
            header_token = request.headers.get('x-vnpay-debug') or request.headers.get('x-debug-token')
        expected_token = os.getenv('VNPAY_DEBUG_TOKEN')
        if header_token and expected_token and header_token == expected_token:
            allow_token = True
    except Exception:
        allow_token = False

    if not (allow_env or allow_local or allow_token):
        raise HTTPException(status_code=403, detail='VNPay debug endpoint disabled')

    # Basic validation for VNPay configuration
    if not VNPAY_TMN_CODE or VNPAY_TMN_CODE in ('your-vnpay-tmn-code', '') or not VNPAY_HASH_SECRET or VNPAY_HASH_SECRET in ('your-vnpay-hash-secret', ''):
        raise HTTPException(status_code=503, detail='VNPay chưa được cấu hình trên máy chủ')

    amount = payload.get('amount', 1000)
    order_info = payload.get('order_info', f'Debug payment {datetime.now().isoformat()}')
    order_type = payload.get('order_type', 'other')
    locale = payload.get('locale', 'en')
    ip = payload.get('ip', '127.0.0.1')
    expire_minutes = int(payload.get('expire_minutes', 30))

    try:
        # VNPay uses Vietnam timezone (UTC+7) for all date calculations
        vn_tz = timezone('Asia/Ho_Chi_Minh')
        now_vn = datetime.now(vn_tz)
        
        vnp = VNPay()
        vnp.requestData['vnp_Version'] = '2.1.0'
        vnp.requestData['vnp_Command'] = 'pay'
        vnp.requestData['vnp_TmnCode'] = VNPAY_TMN_CODE
        vnp.requestData['vnp_Amount'] = int(float(amount) * 100)
        vnp.requestData['vnp_CurrCode'] = 'VND'
        vnp.requestData['vnp_TxnRef'] = payload.get('txn_ref', f'debug-{int(datetime.now().timestamp())}')
        vnp.requestData['vnp_OrderInfo'] = order_info
        vnp.requestData['vnp_OrderType'] = order_type
        vnp.requestData['vnp_Locale'] = locale
        vnp.requestData['vnp_ReturnUrl'] = VNPAY_RETURN_URL
        vnp.requestData['vnp_CreateDate'] = now_vn.strftime('%Y%m%d%H%M%S')
        vnp.requestData['vnp_IpAddr'] = ip
        vnp.requestData['vnp_ExpireDate'] = (now_vn + timedelta(minutes=expire_minutes)).strftime('%Y%m%d%H%M%S')

        payment_url = vnp.get_payment_url(VNPAY_URL, VNPAY_HASH_SECRET)

        # Return the requestData and final URL for inspection
        return {
            'requestData': vnp.requestData,
            'payment_url': payment_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Không thể tạo URL VNPay debug: {e}')

@app.post("/payments/cash")
async def record_cash_payment(
    payment_request: PaymentCreate,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == payment_request.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Create payment record
    payment = Payment(
        invoice_id=invoice.id,
        payment_method="cash",
        amount=invoice.total_amount,
        status="paid",
        payment_date=datetime.now()
    )
    db.add(payment)
    
    # Update invoice
    invoice.payment_status = "paid"
    invoice.payment_method = "cash"
    invoice.payment_date = datetime.now()
    
    db.commit()
    db.refresh(payment)
    
    return {
        "payment_id": str(payment.id),
        "status": "paid",
        "message": "Cash payment recorded successfully"
    }

@app.post("/payments/vnpay/callback")
async def vnpay_callback(request: Request, db: Session = Depends(get_db)):
    # Get query parameters
    params = dict(request.query_params)
    
    # Extract payment ID from txn_ref
    payment_id = params.get("vnp_TxnRef")
    response_code = params.get("vnp_ResponseCode")
    
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Không tìm thấy thanh toán")
    
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
    
    # Validate response using VNPay class
    vnp = VNPay()
    vnp.responseData = params
    
    if vnp.validate_response(VNPAY_HASH_SECRET):
        if response_code == "00":  # Success
            payment.status = "paid"
            payment.payment_date = datetime.now()
            payment.payment_gateway_response = params
            
            invoice.payment_status = "paid"
            invoice.payment_method = "vnpay"
            invoice.payment_date = datetime.now()
            
            # Send payment success notification via API Gateway
            try:
                await api_gateway_client.call_service(
                    "/notification/send",
                    method="POST",
                    data={
                        "customer_id": str(invoice.customer_id),
                        "type": "payment_success",
                        "title": "Thanh toán thành công",
                        "message": f"Hóa đơn {invoice.invoice_number} đã được thanh toán thành công. Số tiền: {invoice.total_amount:,.0f} VNĐ",
                        "metadata": {
                            "invoice_id": str(invoice.id),
                            "amount": invoice.total_amount,
                            "payment_method": "vnpay"
                        }
                    }
                )
            except Exception as e:
                # Log error but don't fail the payment
                print(f"Failed to send payment notification: {e}")
        else:
            payment.status = "failed"
            payment.payment_gateway_response = params
    else:
        # Invalid signature
        payment.status = "failed"
        payment.payment_gateway_response = params
        print(f"Invalid VNPay signature for payment {payment_id}")
    
    db.commit()
    
    return {"status": payment.status, "invoice_id": str(invoice.id)}

@app.post("/payments/vnpay/ipn")
async def vnpay_ipn(request: Request, db: Session = Depends(get_db)):
    """
    VNPay Instant Payment Notification endpoint
    VNPay sends POST requests to confirm payment completion
    """
    inputData = dict(request.query_params)
    
    if inputData:
        vnp = VNPay()
        vnp.responseData = inputData
        
        order_id = inputData.get('vnp_TxnRef')
        amount = int(inputData.get('vnp_Amount', 0)) / 100
        order_desc = inputData.get('vnp_OrderInfo')
        vnp_TransactionNo = inputData.get('vnp_TransactionNo')
        vnp_ResponseCode = inputData.get('vnp_ResponseCode')
        vnp_TmnCode = inputData.get('vnp_TmnCode')
        vnp_PayDate = inputData.get('vnp_PayDate')
        vnp_BankCode = inputData.get('vnp_BankCode')
        vnp_CardType = inputData.get('vnp_CardType')
        
        if vnp.validate_response(VNPAY_HASH_SECRET):
            # Check & Update Order Status in your Database
            payment = db.query(Payment).filter(Payment.id == order_id).first()
            if not payment:
                return {"RspCode": "01", "Message": "Không tìm thấy đơn hàng"}
            
            invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
            if not invoice:
                return {"RspCode": "01", "Message": "Không tìm thấy hóa đơn"}
            
            # Check amount
            if abs(float(payment.amount) - float(amount)) > 0.01:
                return {"RspCode": "04", "Message": "Số tiền không hợp lệ"}
            
            # Check if already updated
            if payment.status == "paid":
                return {"RspCode": "02", "Message": "Đơn hàng đã được xác nhận"}
            
            if vnp_ResponseCode == '00':
                # Payment success
                payment.status = "paid"
                payment.payment_date = datetime.now()
                payment.transaction_id = vnp_TransactionNo
                payment.payment_gateway_response = inputData
                
                invoice.payment_status = "paid"
                invoice.payment_method = "vnpay"
                invoice.payment_date = datetime.now()
                
                db.commit()
                
                # Send payment success notification
                try:
                    await api_gateway_client.call_service(
                        "/notification/send",
                        method="POST",
                        data={
                            "customer_id": str(invoice.customer_id),
                            "type": "payment_success",
                            "title": "Thanh toán thành công",
                            "message": f"Hóa đơn {invoice.invoice_number} đã được thanh toán thành công qua VNPay. Số tiền: {invoice.total_amount:,.0f} VNĐ",
                            "metadata": {
                                "invoice_id": str(invoice.id),
                                "amount": invoice.total_amount,
                                "payment_method": "vnpay",
                                "transaction_id": vnp_TransactionNo
                            }
                        }
                    )
                except Exception as e:
                    print(f"Failed to send payment notification: {e}")
                
                print(f"VNPay IPN: Payment {order_id} confirmed successfully")
                return {"RspCode": "00", "Message": "Xác nhận thành công"}
            else:
                # Payment failed
                payment.status = "failed"
                payment.payment_gateway_response = inputData
                db.commit()
                
                print(f"VNPay IPN: Payment {order_id} failed with code {vnp_ResponseCode}")
                return {"RspCode": "00", "Message": "Thanh toán thất bại"}
        else:
            # Invalid Signature
            print(f"VNPay IPN: Invalid signature for order {order_id}")
            return {"RspCode": "97", "Message": "Chữ ký không hợp lệ"}
    else:
        return {"RspCode": "99", "Message": "Yêu cầu không hợp lệ"}

@app.post("/payments/test/callback/{payment_id}")
async def test_vnpay_callback(
    payment_id: str,
    success: bool = True,
    db: Session = Depends(get_db)
):
    """
    Test endpoint to manually trigger VNPay callback for development
    This simulates what VNPay would send when payment is completed
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Simulate VNPay callback data
    callback_data = {
        'vnp_TmnCode': VNPAY_TMN_CODE,
        'vnp_Amount': str(int(payment.amount * 100)),  # Convert to VND smallest unit
        'vnp_BankCode': 'NCB',
        'vnp_BankTranNo': '20251027170000',
        'vnp_CardType': 'ATM',
        'vnp_OrderInfo': f'Payment for invoice {invoice.invoice_number}',
        'vnp_PayDate': datetime.now().strftime('%Y%m%d%H%M%S'),
        'vnp_ResponseCode': '00' if success else '10',  # 00 = success, 10 = failed
        'vnp_TmnCode': VNPAY_TMN_CODE,
        'vnp_TransactionNo': f'test-{payment_id[:8]}',
        'vnp_TxnRef': payment_id,
        'vnp_SecureHashType': 'SHA512'
    }
    
    # Create signature for test data
    vnp = VNPay()
    vnp.requestData = callback_data.copy()
    # Remove hash fields for signing
    if 'vnp_SecureHash' in vnp.requestData:
        del vnp.requestData['vnp_SecureHash']
    if 'vnp_SecureHashType' in vnp.requestData:
        del vnp.requestData['vnp_SecureHashType']
    
    # Generate hash
    hash_data = "&".join([f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in sorted(vnp.requestData.items()) if str(k).startswith('vnp_')])
    callback_data['vnp_SecureHash'] = hmac.new(VNPAY_HASH_SECRET.encode(), hash_data.encode(), hashlib.sha512).hexdigest()
    
    # Now call the actual callback handler
    from fastapi import Request as FastAPIRequest
    from starlette.requests import Request as StarletteRequest
    
    # Create a mock request with the callback data as query params
    class MockRequest:
        def __init__(self, query_params):
            self.query_params = query_params
    
    mock_request = MockRequest(callback_data)
    
    # Call the IPN handler
    result = await vnpay_ipn(mock_request, db)
    
    return {
        "message": f"Test callback {'successful' if success else 'failed'} for payment {payment_id}",
        "callback_data": callback_data,
        "result": result,
        "invoice_status": invoice.payment_status
    }

@app.post("/payments/vnpay/query")
async def query_vnpay_payment(
    payment_id: str,
    current_user: dict = Depends(require_role(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    """
    Query VNPay transaction status
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Không tìm thấy thanh toán")
    
    if payment.payment_method != "vnpay":
        raise HTTPException(status_code=400, detail="Không phải thanh toán VNPay")
    
    # Create query request
    import random
    vnp_RequestId = str(random.randint(10**11, 10**12 - 1))
    vnp_Command = 'querydr'
    vnp_TxnRef = payment_id
    vnp_OrderInfo = 'Kiem tra ket qua giao dich'
    vnp_TransactionDate = payment.created_at.strftime('%Y%m%d%H%M%S') if payment.created_at else datetime.now().strftime('%Y%m%d%H%M%S')
    vnp_CreateDate = datetime.now().strftime('%Y%m%d%H%M%S')
    vnp_IpAddr = "127.0.0.1"
    
    # Create hash data
    hash_data = "|".join([
        vnp_RequestId, '2.1.0', vnp_Command, VNPAY_TMN_CODE,
        vnp_TxnRef, vnp_TransactionDate, vnp_CreateDate,
        vnp_IpAddr, vnp_OrderInfo
    ])
    
    secure_hash = hmac.new(VNPAY_HASH_SECRET.encode(), hash_data.encode(), hashlib.sha512).hexdigest()
    
    data = {
        "vnp_RequestId": vnp_RequestId,
        "vnp_TmnCode": VNPAY_TMN_CODE,
        "vnp_Command": vnp_Command,
        "vnp_TxnRef": vnp_TxnRef,
        "vnp_OrderInfo": vnp_OrderInfo,
        "vnp_TransactionDate": vnp_TransactionDate,
        "vnp_CreateDate": vnp_CreateDate,
        "vnp_IpAddr": vnp_IpAddr,
        "vnp_Version": "2.1.0",
        "vnp_SecureHash": secure_hash
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(VNPAY_API_URL, headers=headers, data=json.dumps(data), timeout=30)
        
        if response.status_code == 200:
            response_json = response.json()
            return {
                "payment_id": payment_id,
                "query_result": response_json,
                "status": "success"
            }
        else:
            return {
                "payment_id": payment_id,
                "error": f"Request failed with status code: {response.status_code}",
                "status": "error"
            }
    except Exception as e:
        return {
            "payment_id": payment_id,
            "error": str(e),
            "status": "error"
        }

@app.post("/payments/vnpay/refund")
async def refund_vnpay_payment(
    refund_request: dict,
    current_user: dict = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Refund VNPay payment
    Required fields in refund_request:
    - payment_id: UUID of the payment to refund
    - amount: Amount to refund (optional, defaults to full amount)
    - reason: Reason for refund
    """
    payment_id = refund_request.get("payment_id")
    refund_amount = refund_request.get("amount")
    reason = refund_request.get("reason", "Refund requested by admin")
    
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Không tìm thấy thanh toán")
    
    if payment.payment_method != "vnpay":
        raise HTTPException(status_code=400, detail="Không phải thanh toán VNPay")
    
    if payment.status != "paid":
        raise HTTPException(status_code=400, detail="Thanh toán chưa hoàn thành")
    
    if not payment.transaction_id:
        raise HTTPException(status_code=400, detail="Không tìm thấy mã giao dịch cho thanh toán này")
    
    # Use refund amount or full payment amount
    amount = refund_amount or payment.amount
    
    # Create refund request
    import random
    vnp_RequestId = str(random.randint(10**11, 10**12 - 1))
    vnp_Command = 'refund'
    vnp_TransactionType = '02'  # Full refund
    vnp_TxnRef = payment_id
    vnp_Amount = int(amount * 100)  # Convert to smallest currency unit
    vnp_OrderInfo = reason
    vnp_TransactionNo = payment.transaction_id
    vnp_TransactionDate = payment.payment_date.strftime('%Y%m%d%H%M%S') if payment.payment_date else datetime.now().strftime('%Y%m%d%H%M%S')
    vnp_CreateDate = datetime.now().strftime('%Y%m%d%H%M%S')
    vnp_CreateBy = current_user.get('user_id', 'admin')
    vnp_IpAddr = "127.0.0.1"
    
    # Create hash data
    hash_data = "|".join([
        vnp_RequestId, '2.1.0', vnp_Command, VNPAY_TMN_CODE, vnp_TransactionType, vnp_TxnRef,
        str(vnp_Amount), vnp_TransactionNo, vnp_TransactionDate, vnp_CreateBy, vnp_CreateDate,
        vnp_IpAddr, vnp_OrderInfo
    ])
    
    secure_hash = hmac.new(VNPAY_HASH_SECRET.encode(), hash_data.encode(), hashlib.sha512).hexdigest()
    
    data = {
        "vnp_RequestId": vnp_RequestId,
        "vnp_TmnCode": VNPAY_TMN_CODE,
        "vnp_Command": vnp_Command,
        "vnp_TxnRef": vnp_TxnRef,
        "vnp_Amount": vnp_Amount,
        "vnp_OrderInfo": vnp_OrderInfo,
        "vnp_TransactionDate": vnp_TransactionDate,
        "vnp_CreateDate": vnp_CreateDate,
        "vnp_IpAddr": vnp_IpAddr,
        "vnp_TransactionType": vnp_TransactionType,
        "vnp_TransactionNo": vnp_TransactionNo,
        "vnp_CreateBy": vnp_CreateBy,
        "vnp_Version": "2.1.0",
        "vnp_SecureHash": secure_hash
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(VNPAY_API_URL, headers=headers, data=json.dumps(data), timeout=30)
        
        if response.status_code == 200:
            response_json = response.json()
            
            # Log refund attempt
            print(f"VNPay refund attempted for payment {payment_id}: {response_json}")
            
            return {
                "payment_id": payment_id,
                "refund_amount": amount,
                "refund_result": response_json,
                "status": "success"
            }
        else:
            return {
                "payment_id": payment_id,
                "error": f"Request failed with status code: {response.status_code}",
                "status": "error"
            }
    except Exception as e:
        return {
            "payment_id": payment_id,
            "error": str(e),
            "status": "error"
        }

@app.get("/health")
async def health_check():
    """Health check endpoint - no authentication required"""
    return {"status": "healthy", "service": "payment_service", "version": "1.0.0"}


@app.get("/invoices/missing-payments")
async def list_invoices_missing_payments(
    current_user: dict = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Admin helper: list invoices that are marked as paid but have no Payment record.
    Use this to inspect inconsistencies before reconciling.
    """
    # Find invoices marked paid that don't have a matching payment
    rows = db.execute(
        """
        SELECT i.id, i.invoice_number, i.total_amount, i.payment_method, i.payment_date
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        WHERE i.payment_status = 'paid' AND p.id IS NULL
        """
    ).fetchall()

    result = []
    for r in rows:
        result.append({
            "invoice_id": str(r[0]),
            "invoice_number": r[1],
            "amount": float(r[2]) if r[2] is not None else None,
            "payment_method": r[3],
            "payment_date": r[4].isoformat() if r[4] else None
        })

    return {"count": len(result), "invoices": result}


@app.post("/invoices/reconcile-missing-payments")
async def reconcile_missing_payments(
    current_user: dict = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Admin-only: create Payment records for invoices marked paid but missing payments.
    This creates Payments with status='paid' and links them to the invoice.
    Use carefully and review `/invoices/missing-payments` first.
    """
    rows = db.execute(
        """
        SELECT i.id, i.invoice_number, i.total_amount, i.payment_method, i.payment_date
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        WHERE i.payment_status = 'paid' AND p.id IS NULL
        """
    ).fetchall()

    created = []
    for r in rows:
        invoice_id = r[0]
        invoice_number = r[1]
        amount = r[2] or 0
        method = r[3] or 'unknown'
        p_date = r[4]

        payment = Payment(
            invoice_id=invoice_id,
            transaction_id=f"reconciled-{invoice_number}-{int(datetime.now().timestamp())}",
            payment_method=method if method in [m.value for m in Payment.__table__.columns['payment_method'].type.enums] else method,
            amount=amount,
            status='paid',
            payment_gateway_response={'reconciled': True},
            payment_date=p_date or datetime.now()
        )
        db.add(payment)
        created.append({"invoice_id": str(invoice_id), "payment_id": str(payment.id)})

    db.commit()

    return {"created_count": len(created), "created": created}

@app.get("/invoices/debug/missing-customer")
async def debug_invoices_missing_customer(
    current_user: dict = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Debug endpoint: find invoices where customer_id is NULL or invalid
    """
    # Find invoices with NULL customer_id
    null_customer_invoices = db.query(Invoice).filter(Invoice.customer_id.is_(None)).all()
    
    # Find invoices where customer_id doesn't match appointment's customer_id
    mismatched_invoices = db.query(Invoice).join(Appointment).filter(
        Invoice.appointment_id.isnot(None),
        Invoice.customer_id != Appointment.customer_id
    ).all()
    
    result = {
        "null_customer_invoices": [],
        "mismatched_customer_invoices": []
    }
    
    for invoice in null_customer_invoices:
        result["null_customer_invoices"].append({
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "appointment_id": str(invoice.appointment_id) if invoice.appointment_id else None,
            "total_amount": float(invoice.total_amount)
        })
    
    for invoice in mismatched_invoices:
        appointment = db.query(Appointment).filter(Appointment.id == invoice.appointment_id).first()
        result["mismatched_customer_invoices"].append({
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "invoice_customer_id": str(invoice.customer_id),
            "appointment_customer_id": str(appointment.customer_id) if appointment else None,
            "total_amount": float(invoice.total_amount)
        })
    
    return result

@app.post("/invoices/fix-missing-customer")
async def fix_invoices_missing_customer(
    current_user: dict = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Fix invoices where customer_id is missing by copying from appointment
    """
    fixed_count = 0
    
    # Fix NULL customer_id invoices
    null_customer_invoices = db.query(Invoice).filter(
        Invoice.customer_id.is_(None),
        Invoice.appointment_id.isnot(None)
    ).all()
    
    for invoice in null_customer_invoices:
        appointment = db.query(Appointment).filter(Appointment.id == invoice.appointment_id).first()
        if appointment and appointment.customer_id:
            invoice.customer_id = appointment.customer_id
            fixed_count += 1
    
    # Fix mismatched customer_id invoices
    mismatched_invoices = db.query(Invoice).join(Appointment).filter(
        Invoice.appointment_id.isnot(None),
        Invoice.customer_id != Appointment.customer_id
    ).all()
    
    for invoice in mismatched_invoices:
        appointment = db.query(Appointment).filter(Appointment.id == invoice.appointment_id).first()
        if appointment and appointment.customer_id:
            invoice.customer_id = appointment.customer_id
            fixed_count += 1
    
    db.commit()
    
    return {"message": f"Fixed {fixed_count} invoices with missing or incorrect customer_id"}

@app.get("/invoices/comprehensive", response_model=List[InvoiceDetailsResponse])
async def get_comprehensive_invoices(
    customer_id: UUID = None,
    appointment_id: UUID = None,
    payment_status: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive invoice list with full appointment, customer, and vehicle details
    """
    # Base query
    query = db.query(Invoice)
    
    # Apply filters
    if appointment_id:
        query = query.filter(Invoice.appointment_id == appointment_id)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)
    
    # Role-based filtering
    if current_user["role"] == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user["user_id"]).first()
        if not customer:
            return []
        query = query.filter(Invoice.customer_id == customer.id)
    
    invoices = query.order_by(Invoice.created_at.desc()).all()
    
    # Build comprehensive response for each invoice
    result = []
    for invoice in invoices:
        # Get appointment details if available
        appointment = None
        if invoice.appointment_id:
            appointment_query = db.query(Appointment).filter(Appointment.id == invoice.appointment_id).first()
            if appointment_query:
                # Get related data for appointment
                customer_data = None
                if appointment_query.customer_id:
                    customer_query = db.query(Customer, User).join(User, Customer.user_id == User.id).filter(Customer.id == appointment_query.customer_id).first()
                    if customer_query:
                        customer_obj, user_obj = customer_query
                        customer_data = {
                            "id": customer_obj.id,
                            "full_name": user_obj.full_name,
                            "email": user_obj.email,
                            "phone": user_obj.phone,
                            "address": customer_obj.address
                        }
                
                vehicle_data = None
                if appointment_query.vehicle_id:
                    vehicle = db.query(Vehicle).filter(Vehicle.id == appointment_query.vehicle_id).first()
                    if vehicle:
                        vehicle_data = {
                            "id": vehicle.id,
                            "license_plate": vehicle.license_plate,
                            "make": vehicle.make,
                            "model": vehicle.model,
                            "year": vehicle.year,
                            "color": vehicle.color,
                            "current_mileage": vehicle.current_mileage
                        }
                
                technician_data = None
                if appointment_query.technician_id:
                    technician_query = db.query(Technician, User).join(User, Technician.user_id == User.id).filter(Technician.id == appointment_query.technician_id).first()
                    if technician_query:
                        technician_obj, user_obj = technician_query
                        technician_data = {
                            "id": technician_obj.id,
                            "full_name": user_obj.full_name
                        }
                
                service_center_data = None
                if appointment_query.service_center_id:
                    service_center = db.query(ServiceCenter).filter(ServiceCenter.id == appointment_query.service_center_id).first()
                    if service_center:
                        service_center_data = {
                            "id": service_center.id,
                            "name": service_center.name
                        }
                
                appointment = {
                    "id": appointment_query.id,
                    "appointment_date": appointment_query.appointment_date.isoformat() if appointment_query.appointment_date else None,
                    "status": appointment_query.status,
                    "customer_notes": appointment_query.customer_notes,
                    "estimated_cost": float(appointment_query.estimated_cost) if appointment_query.estimated_cost else None,
                    "actual_cost": float(appointment_query.actual_cost) if appointment_query.actual_cost else None,
                    "customer": customer_data,
                    "vehicle": vehicle_data,
                    "technician": technician_data,
                    "service_center": service_center_data
                }
        
        # Get service records for this appointment
        service_records = []
        if invoice.appointment_id:
            records = db.query(ServiceRecord).filter(ServiceRecord.appointment_id == invoice.appointment_id).all()
            for record in records:
                technician_data = None
                if record.technician_id:
                    technician_query = db.query(Technician, User).join(User, Technician.user_id == User.id).filter(Technician.id == record.technician_id).first()
                    if technician_query:
                        technician_obj, user_obj = technician_query
                        technician_data = {
                            "id": technician_obj.id,
                            "full_name": user_obj.full_name
                        }
                
                service_records.append({
                    "id": record.id,
                    "service_date": record.service_date.isoformat() if record.service_date else None,
                    "mileage_at_service": record.mileage_at_service,
                    "services_performed": record.services_performed,
                    "diagnosis": record.diagnosis,
                    "recommendations": record.recommendations,
                    "cost": float(record.total_cost) if record.total_cost else None,
                    "technician": technician_data
                })
        
        # Build response
        invoice_data = {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "appointment_id": invoice.appointment_id,
            "customer_id": invoice.customer_id,
            "service_center_id": invoice.service_center_id,
            "issue_date": invoice.issue_date,
            "due_date": invoice.due_date,
            "subtotal": float(invoice.subtotal),
            "tax": float(invoice.tax),
            "discount": float(invoice.discount),
            "total_amount": float(invoice.total_amount),
            "payment_status": invoice.payment_status,
            "payment_method": invoice.payment_method,
            "payment_date": invoice.payment_date,
            "notes": invoice.notes,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
            "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
            "appointment": appointment,
            "service_records": service_records
        }
        
        result.append(invoice_data)
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
