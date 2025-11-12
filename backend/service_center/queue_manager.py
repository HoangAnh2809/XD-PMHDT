"""
Queue Management System
Hệ thống quản lý hàng chờ cho trung tâm dịch vụ
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import logging

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.models import Appointment, AppointmentStatus, ServiceType, Technician, Vehicle, Customer
from shared.database import get_db_context

logger = logging.getLogger(__name__)


class QueuePriority:
    """Mức độ ưu tiên trong hàng chờ"""
    URGENT = 1      # Khẩn cấp
    HIGH = 2        # Cao
    NORMAL = 3      # Bình thường
    LOW = 4         # Thấp


class QueueManager:
    """
    Quản lý hàng chờ dịch vụ
    """
    
    def __init__(self):
        self.priority_weights = {
            QueuePriority.URGENT: 1.0,
            QueuePriority.HIGH: 2.0,
            QueuePriority.NORMAL: 3.0,
            QueuePriority.LOW: 4.0
        }
    
    def calculate_priority(self, appointment: Appointment, db: Session) -> int:
        """
        Tính toán mức độ ưu tiên dựa trên:
        - Thời gian đặt lịch
        - Loại dịch vụ
        - Khách hàng VIP
        - Thời gian chờ
        """
        priority = QueuePriority.NORMAL
        
        # Kiểm tra loại dịch vụ khẩn cấp
        if appointment.service_type_id:
            service_type = db.query(ServiceType).filter(
                ServiceType.id == appointment.service_type_id
            ).first()
            
            if service_type and 'emergency' in service_type.name.lower():
                return QueuePriority.URGENT
        
        # Kiểm tra thời gian chờ (quá 2 giờ -> HIGH priority)
        if appointment.created_at:
            wait_time = datetime.now() - appointment.created_at
            if wait_time > timedelta(hours=2):
                priority = QueuePriority.HIGH
        
        # Kiểm tra khách hàng VIP (nếu có field is_vip)
        # TODO: Thêm logic VIP customer nếu cần
        
        return priority
    
    def get_queue_status(self, service_center_id: Optional[str] = None) -> Dict:
        """
        Lấy trạng thái hàng chờ hiện tại
        """
        with get_db_context() as db:
            # Lọc các appointment đang chờ và confirmed
            query = db.query(Appointment).filter(
                Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed])
            )
            
            if service_center_id:
                query = query.filter(Appointment.service_center_id == service_center_id)
            
            appointments = query.order_by(Appointment.appointment_date).all()
            
            # Phân loại theo priority
            queue_by_priority = {
                QueuePriority.URGENT: [],
                QueuePriority.HIGH: [],
                QueuePriority.NORMAL: [],
                QueuePriority.LOW: []
            }
            
            total_wait_time = timedelta()
            count = 0
            
            for appointment in appointments:
                priority = self.calculate_priority(appointment, db)
                
                # Tính thời gian chờ
                wait_time = datetime.now() - appointment.created_at if appointment.created_at else timedelta()
                total_wait_time += wait_time
                count += 1
                
                # Lấy thông tin khách hàng và xe
                customer = db.query(Customer).filter(Customer.id == appointment.customer_id).first()
                vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
                service_type = db.query(ServiceType).filter(
                    ServiceType.id == appointment.service_type_id
                ).first() if appointment.service_type_id else None
                
                queue_item = {
                    'appointment_id': str(appointment.id),
                    'customer_name': customer.user.full_name if customer and customer.user else 'Unknown',
                    'vehicle_info': f"{vehicle.make} {vehicle.model}" if vehicle else 'Unknown',
                    'service_type': service_type.name if service_type else 'Unknown',
                    'appointment_date': appointment.appointment_date.isoformat() if appointment.appointment_date else None,
                    'status': appointment.status,
                    'wait_time_minutes': int(wait_time.total_seconds() / 60),
                    'estimated_duration': service_type.estimated_duration if service_type else 60,
                    'priority': priority
                }
                
                queue_by_priority[priority].append(queue_item)
            
            # Tính average wait time
            avg_wait_minutes = int((total_wait_time.total_seconds() / 60) / count) if count > 0 else 0
            
            return {
                'total_in_queue': count,
                'average_wait_minutes': avg_wait_minutes,
                'urgent': queue_by_priority[QueuePriority.URGENT],
                'high': queue_by_priority[QueuePriority.HIGH],
                'normal': queue_by_priority[QueuePriority.NORMAL],
                'low': queue_by_priority[QueuePriority.LOW],
                'queue_by_priority': queue_by_priority
            }
    
    def get_next_appointment(self, technician_id: Optional[str] = None) -> Optional[Dict]:
        """
        Lấy appointment tiếp theo từ hàng chờ theo priority
        """
        with get_db_context() as db:
            query = db.query(Appointment).filter(
                Appointment.status == AppointmentStatus.confirmed
            )
            
            if technician_id:
                query = query.filter(Appointment.technician_id == technician_id)
            
            appointments = query.order_by(Appointment.appointment_date).all()
            
            # Tìm appointment có priority cao nhất
            highest_priority_apt = None
            highest_priority = QueuePriority.LOW + 1
            
            for apt in appointments:
                priority = self.calculate_priority(apt, db)
                if priority < highest_priority:
                    highest_priority = priority
                    highest_priority_apt = apt
            
            if highest_priority_apt:
                customer = db.query(Customer).filter(
                    Customer.id == highest_priority_apt.customer_id
                ).first()
                vehicle = db.query(Vehicle).filter(
                    Vehicle.id == highest_priority_apt.vehicle_id
                ).first()
                
                return {
                    'appointment_id': str(highest_priority_apt.id),
                    'customer_name': customer.user.full_name if customer and customer.user else 'Unknown',
                    'vehicle_info': f"{vehicle.make} {vehicle.model}" if vehicle else 'Unknown',
                    'priority': highest_priority,
                    'wait_time_minutes': int((datetime.now() - highest_priority_apt.created_at).total_seconds() / 60) if highest_priority_apt.created_at else 0
                }
            
            return None
    
    def estimate_wait_time(self, appointment_id: str) -> Dict:
        """
        Ước tính thời gian chờ cho một appointment
        """
        with get_db_context() as db:
            appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            
            if not appointment:
                return {'error': 'Appointment not found'}
            
            if appointment.status not in [AppointmentStatus.pending, AppointmentStatus.confirmed]:
                return {'wait_time_minutes': 0, 'position': 0, 'message': 'Not in queue'}
            
            # Đếm số appointment trước nó
            priority = self.calculate_priority(appointment, db)
            
            appointments_before = db.query(Appointment).filter(
                Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed]),
                Appointment.appointment_date <= appointment.appointment_date,
                Appointment.id != appointment.id
            ).all()
            
            position = 1
            estimated_minutes = 0
            
            for apt in appointments_before:
                apt_priority = self.calculate_priority(apt, db)
                if apt_priority <= priority:
                    position += 1
                    
                    # Cộng thời gian ước tính
                    service_type = db.query(ServiceType).filter(
                        ServiceType.id == apt.service_type_id
                    ).first() if apt.service_type_id else None
                    
                    estimated_minutes += service_type.estimated_duration if service_type else 60
            
            return {
                'appointment_id': str(appointment_id),
                'position_in_queue': position,
                'estimated_wait_minutes': estimated_minutes,
                'estimated_wait_hours': round(estimated_minutes / 60, 1),
                'priority': priority,
                'priority_name': self._get_priority_name(priority)
            }
    
    def _get_priority_name(self, priority: int) -> str:
        """Chuyển priority number sang tên"""
        names = {
            QueuePriority.URGENT: 'Khẩn cấp',
            QueuePriority.HIGH: 'Cao',
            QueuePriority.NORMAL: 'Bình thường',
            QueuePriority.LOW: 'Thấp'
        }
        return names.get(priority, 'Unknown')
    
    def move_to_in_progress(self, appointment_id: str) -> bool:
        """
        Chuyển appointment từ queue sang in_progress
        """
        with get_db_context() as db:
            appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            
            if appointment and appointment.status in [AppointmentStatus.pending, AppointmentStatus.confirmed]:
                appointment.status = AppointmentStatus.in_progress
                db.commit()
                logger.info(f"Moved appointment {appointment_id} to in_progress")
                return True
            
            return False


# Singleton instance
queue_manager = QueueManager()
