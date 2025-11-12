from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import sys
import os
from uuid import UUID
from datetime import datetime
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db, engine
from shared.models import Base, Notification, User
from shared.auth import get_current_user, require_role, api_gateway_client
from schemas import NotificationCreate, NotificationResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Notification Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/notifications", response_model=List[NotificationResponse])
async def get_my_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.user_id == current_user["user_id"])
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return notifications

@app.post("/notifications", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    notification: NotificationCreate,
    current_user: dict = Depends(require_role(["staff", "admin"])),
    db: Session = Depends(get_db)
):
    db_notification = Notification(**notification.model_dump())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    return db_notification

@app.put("/notifications/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user["user_id"]
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    db.commit()
    
    return {"message": "Notification marked as read"}

@app.put("/notifications/mark-all-read")
async def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == current_user["user_id"],
        Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"message": "All notifications marked as read"}

@app.get("/notifications/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user["user_id"],
        Notification.is_read == False
    ).count()
    
    return {"unread_count": count}

@app.post("/send")
async def send_notification(
    customer_id: UUID,
    type: str,
    title: str,
    message: str,
    metadata: dict = None,
    current_user: dict = Depends(require_role(["staff", "admin", "system"])),
    db: Session = Depends(get_db)
):
    """Send notification to customer via database and email"""
    
    # Get customer info via API Gateway
    try:
        customer_data = await api_gateway_client.call_service(f"/customer/profile/{customer_id}")
        customer_email = customer_data["email"]
        customer_name = customer_data["full_name"]
    except Exception as e:
        raise HTTPException(status_code=404, detail="Customer not found or service unavailable")
    
    # Create notification in database
    db_notification = Notification(
        user_id=customer_id,
        type=type,
        title=title,
        message=message,
        metadata=metadata or {}
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    # Send email notification
    try:
        await send_email_notification(customer_email, customer_name, title, message)
    except Exception as e:
        # Log error but don't fail the request
        print(f"Failed to send email notification: {e}")
    
    return {"message": "Notification sent successfully", "notification_id": str(db_notification.id)}

async def send_email_notification(to_email: str, to_name: str, subject: str, message: str):
    """Send email notification using SMTP"""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "your-email@gmail.com")
    smtp_password = os.getenv("SMTP_PASSWORD", "your-app-password")
    
    # Create message
    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = to_email
    msg['Subject'] = f"EV Maintenance - {subject}"
    
    # Email body
    html_body = f"""
    <html>
    <body>
        <h2>Xin chào {to_name}!</h2>
        <p>{message}</p>
        <br>
        <p>Trân trọng,<br>Đội ngũ EV Maintenance</p>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html_body, 'html'))
    
    # Send email
    try:
        server = aiosmtplib.SMTP(hostname=smtp_host, port=smtp_port, use_tls=True)
        await server.connect()
        await server.login(smtp_user, smtp_password)
        await server.sendmail(smtp_user, to_email, msg.as_string())
        await server.quit()
    except Exception as e:
        raise Exception(f"Email sending failed: {str(e)}")


# ==================== PAYMENT REMINDERS ====================

@app.post("/reminders/run-payment-check")
async def run_payment_reminder_check(
    current_user: dict = Depends(require_role(["admin", "staff"]))
):
    """Chạy job kiểm tra và gửi nhắc thanh toán (manual trigger)"""
    from reminder_scheduler import payment_reminder_scheduler
    
    try:
        results = payment_reminder_scheduler.process_reminders()
        return {
            "status": "success",
            "results": results,
            "message": f"Đã gửi {results['upcoming_sent']} nhắc sắp đến hạn, {results['overdue_sent']} nhắc quá hạn"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi chạy payment reminder: {str(e)}")


@app.get("/reminders/upcoming-payments")
async def get_upcoming_payment_reminders(
    current_user: dict = Depends(require_role(["admin", "staff"]))
):
    """Xem danh sách các hóa đơn cần nhắc nhở"""
    from reminder_scheduler import payment_reminder_scheduler
    
    upcoming = payment_reminder_scheduler.check_upcoming_payments()
    overdue = payment_reminder_scheduler.check_overdue_payments()
    
    return {
        "upcoming": [
            {
                "invoice_number": item['invoice'].invoice_number,
                "customer_id": str(item['customer_id']),
                "amount": float(item['invoice'].total_amount),
                "due_date": item['invoice'].due_date.isoformat(),
                "days_until_due": item.get('days_until_due'),
                "days_overdue": item.get('days_overdue')
            }
            for item in upcoming
        ],
        "overdue": [
            {
                "invoice_number": item['invoice'].invoice_number,
                "customer_id": str(item['customer_id']),
                "amount": float(item['invoice'].total_amount),
                "due_date": item['invoice'].due_date.isoformat(),
                "days_overdue": item['days_overdue']
            }
            for item in overdue
        ]
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "notification_service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
