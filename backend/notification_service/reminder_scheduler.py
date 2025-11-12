"""
Payment Reminder Scheduler
Tự động nhắc nhở thanh toán gói bảo dưỡng định kỳ
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db_context
from shared.models import (
    Invoice, Payment, Appointment, Customer, User, 
    Notification, PaymentStatus, NotificationType
)

logger = logging.getLogger(__name__)


class PaymentReminderScheduler:
    """
    Hệ thống tự động nhắc nhở thanh toán
    """
    
    def __init__(self):
        self.reminder_days_before = [7, 3, 1]  # Nhắc trước 7, 3, 1 ngày
        self.overdue_days = [1, 3, 7, 14]  # Nhắc sau khi quá hạn
    
    def check_upcoming_payments(self) -> list:
        """
        Kiểm tra các hóa đơn sắp đến hạn thanh toán
        """
        with get_db_context() as db:
            today = datetime.now().date()
            upcoming_invoices = []
            
            for days in self.reminder_days_before:
                reminder_date = today + timedelta(days=days)
                
                invoices = db.query(Invoice).filter(
                    Invoice.payment_status == PaymentStatus.pending,
                    Invoice.due_date == reminder_date
                ).all()
                
                for invoice in invoices:
                    # Kiểm tra đã gửi thông báo chưa
                    existing_notification = db.query(Notification).filter(
                        Notification.user_id == invoice.customer_id,
                        Notification.notification_type == NotificationType.payment_reminder,
                        Notification.created_at >= today
                    ).first()
                    
                    if not existing_notification:
                        upcoming_invoices.append({
                            'invoice': invoice,
                            'days_until_due': days,
                            'customer_id': invoice.customer_id
                        })
            
            return upcoming_invoices
    
    def check_overdue_payments(self) -> list:
        """
        Kiểm tra các hóa đơn quá hạn
        """
        with get_db_context() as db:
            today = datetime.now().date()
            overdue_invoices = []
            
            invoices = db.query(Invoice).filter(
                Invoice.payment_status == PaymentStatus.pending,
                Invoice.due_date < today
            ).all()
            
            for invoice in invoices:
                days_overdue = (today - invoice.due_date).days
                
                # Chỉ nhắc ở các mốc quy định
                if days_overdue in self.overdue_days:
                    # Kiểm tra đã gửi thông báo hôm nay chưa
                    existing_notification = db.query(Notification).filter(
                        Notification.user_id == invoice.customer_id,
                        Notification.notification_type == NotificationType.payment_reminder,
                        Notification.created_at >= today
                    ).first()
                    
                    if not existing_notification:
                        overdue_invoices.append({
                            'invoice': invoice,
                            'days_overdue': days_overdue,
                            'customer_id': invoice.customer_id
                        })
            
            return overdue_invoices
    
    def send_payment_reminder(self, invoice, customer_id, message: str) -> bool:
        """
        Gửi thông báo nhắc thanh toán
        """
        try:
            with get_db_context() as db:
                notification = Notification(
                    user_id=customer_id,
                    notification_type=NotificationType.payment_reminder,
                    title="Nhắc nhở thanh toán",
                    message=message,
                    is_read=False,
                    metadata={
                        'invoice_id': str(invoice.id),
                        'invoice_number': invoice.invoice_number,
                        'total_amount': float(invoice.total_amount),
                        'due_date': invoice.due_date.isoformat() if invoice.due_date else None
                    }
                )
                db.add(notification)
                db.commit()
                
                logger.info(f"Sent payment reminder for invoice {invoice.invoice_number} to customer {customer_id}")
                return True
        except Exception as e:
            logger.error(f"Error sending payment reminder: {e}")
            return False
    
    def process_reminders(self) -> dict:
        """
        Xử lý tất cả các nhắc nhở
        """
        results = {
            'upcoming_sent': 0,
            'overdue_sent': 0,
            'errors': 0
        }
        
        # Xử lý hóa đơn sắp đến hạn
        upcoming = self.check_upcoming_payments()
        for item in upcoming:
            invoice = item['invoice']
            days = item['days_until_due']
            
            message = (
                f"Hóa đơn {invoice.invoice_number} sẽ đến hạn trong {days} ngày. "
                f"Số tiền: {invoice.total_amount:,.0f} VNĐ. "
                f"Hạn thanh toán: {invoice.due_date.strftime('%d/%m/%Y')}. "
                "Vui lòng thanh toán để tránh gián đoạn dịch vụ."
            )
            
            if self.send_payment_reminder(invoice, item['customer_id'], message):
                results['upcoming_sent'] += 1
            else:
                results['errors'] += 1
        
        # Xử lý hóa đơn quá hạn
        overdue = self.check_overdue_payments()
        for item in overdue:
            invoice = item['invoice']
            days = item['days_overdue']
            
            message = (
                f"Hóa đơn {invoice.invoice_number} đã quá hạn {days} ngày. "
                f"Số tiền: {invoice.total_amount:,.0f} VNĐ. "
                f"Hạn thanh toán: {invoice.due_date.strftime('%d/%m/%Y')}. "
                "Vui lòng thanh toán gấp để tránh ảnh hưởng đến dịch vụ."
            )
            
            if self.send_payment_reminder(invoice, item['customer_id'], message):
                results['overdue_sent'] += 1
            else:
                results['errors'] += 1
        
        return results
    
    def check_maintenance_package_renewals(self) -> list:
        """
        Kiểm tra các gói bảo dưỡng sắp hết hạn
        """
        with get_db_context() as db:
            today = datetime.now().date()
            renewal_date = today + timedelta(days=30)  # Nhắc trước 30 ngày
            
            # Tìm các gói bảo dưỡng sắp hết hạn
            # (Giả định có bảng MaintenancePackage - cần tạo nếu chưa có)
            packages_to_renew = []
            
            # Logic kiểm tra gói bảo dưỡng
            # TODO: Implement khi có bảng MaintenancePackage
            
            return packages_to_renew


# Singleton instance
payment_reminder_scheduler = PaymentReminderScheduler()


def run_payment_reminders():
    """
    Hàm để chạy từ cron job hoặc scheduler
    """
    logger.info("Starting payment reminder job...")
    results = payment_reminder_scheduler.process_reminders()
    logger.info(f"Payment reminder job completed: {results}")
    return results


if __name__ == "__main__":
    # Test run
    logging.basicConfig(level=logging.INFO)
    results = run_payment_reminders()
    print(f"Reminder results: {results}")
