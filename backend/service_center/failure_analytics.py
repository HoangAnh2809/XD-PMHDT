"""
EV Failure Trends Analytics
Phân tích xu hướng hỏng hóc xe điện
"""
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, case
from collections import Counter
import logging

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.models import (
    Appointment, ServiceRecord, ServiceType, Part, Vehicle,
    AppointmentStatus, ChecklistItem, AppointmentChecklistProgress
)
from shared.database import get_db_context

logger = logging.getLogger(__name__)


class FailureAnalytics:
    """
    Phân tích xu hướng hỏng hóc và sự cố của xe điện
    """
    
    def get_common_issues(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 10
    ) -> Dict:
        """
        Lấy danh sách các sự cố phổ biến nhất
        """
        with get_db_context() as db:
            if not start_date:
                start_date = date.today() - timedelta(days=90)  # 3 months
            if not end_date:
                end_date = date.today()
            
            # Lấy service types được sử dụng nhiều nhất
            service_stats = db.query(
                ServiceType.name,
                ServiceType.category,
                func.count(Appointment.id).label('count'),
                func.avg(Appointment.actual_cost).label('avg_cost')
            ).join(
                Appointment,
                ServiceType.id == Appointment.service_type_id
            ).filter(
                func.date(Appointment.appointment_date) >= start_date,
                func.date(Appointment.appointment_date) <= end_date,
                Appointment.status == AppointmentStatus.completed
            ).group_by(
                ServiceType.name,
                ServiceType.category
            ).order_by(desc('count')).limit(limit).all()
            
            common_issues = []
            for stat in service_stats:
                common_issues.append({
                    'issue_name': stat.name,
                    'category': stat.category,
                    'occurrence_count': stat.count,
                    'average_cost': round(float(stat.avg_cost or 0), 2),
                    'percentage': 0  # Will calculate below
                })
            
            # Calculate percentages
            total_count = sum(issue['occurrence_count'] for issue in common_issues)
            for issue in common_issues:
                issue['percentage'] = round(
                    (issue['occurrence_count'] / total_count * 100) if total_count > 0 else 0,
                    2
                )
            
            return {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'total_issues': total_count,
                'common_issues': common_issues
            }
    
    def get_parts_failure_rate(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 15
    ) -> Dict:
        """
        Phân tích tỷ lệ hỏng của phụ tùng
        """
        with get_db_context() as db:
            if not start_date:
                start_date = date.today() - timedelta(days=180)  # 6 months
            if not end_date:
                end_date = date.today()
            
            # Lấy service records với parts used
            service_records = db.query(ServiceRecord).filter(
                func.date(ServiceRecord.service_date) >= start_date,
                func.date(ServiceRecord.service_date) <= end_date,
                ServiceRecord.parts_used.isnot(None)
            ).all()
            
            # Parse parts_used (assuming format: "Part1, Part2, Part3")
            parts_counter = Counter()
            parts_cost = {}
            
            for record in service_records:
                if record.parts_used:
                    parts_list = [p.strip() for p in record.parts_used.split(',')]
                    for part_name in parts_list:
                        if part_name:
                            parts_counter[part_name] += 1
                            # Try to get cost info
                            part = db.query(Part).filter(Part.name.ilike(f"%{part_name}%")).first()
                            if part and part_name not in parts_cost:
                                parts_cost[part_name] = float(part.unit_price)
            
            # Top failing parts
            top_parts = []
            for part_name, count in parts_counter.most_common(limit):
                top_parts.append({
                    'part_name': part_name,
                    'failure_count': count,
                    'unit_cost': parts_cost.get(part_name, 0),
                    'total_cost': parts_cost.get(part_name, 0) * count
                })
            
            return {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'total_parts_replaced': sum(parts_counter.values()),
                'unique_parts': len(parts_counter),
                'top_failing_parts': top_parts
            }
    
    def get_vehicle_model_reliability(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Phân tích độ tin cậy theo model xe
        """
        with get_db_context() as db:
            if not start_date:
                start_date = date.today() - timedelta(days=365)  # 1 year
            if not end_date:
                end_date = date.today()
            
            # Count service requests per vehicle model
            model_stats = db.query(
                Vehicle.make,
                Vehicle.model,
                func.count(Appointment.id).label('service_count'),
                func.avg(Appointment.actual_cost).label('avg_cost')
            ).join(
                Appointment,
                Vehicle.id == Appointment.vehicle_id
            ).filter(
                func.date(Appointment.appointment_date) >= start_date,
                func.date(Appointment.appointment_date) <= end_date,
                Appointment.status == AppointmentStatus.completed
            ).group_by(
                Vehicle.make,
                Vehicle.model
            ).order_by(desc('service_count')).all()
            
            reliability_data = []
            for stat in model_stats:
                # Calculate reliability score (inverse of service frequency)
                # More services = less reliable
                reliability_score = max(0, 100 - (stat.service_count * 2))
                
                reliability_data.append({
                    'make': stat.make,
                    'model': stat.model,
                    'vehicle_name': f"{stat.make} {stat.model}",
                    'service_frequency': stat.service_count,
                    'average_repair_cost': round(float(stat.avg_cost or 0), 2),
                    'reliability_score': round(reliability_score, 1),
                    'reliability_rating': self._get_reliability_rating(reliability_score)
                })
            
            return {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'vehicle_models': reliability_data
            }
    
    def _get_reliability_rating(self, score: float) -> str:
        """Convert score to rating"""
        if score >= 90:
            return 'Rất tốt'
        elif score >= 75:
            return 'Tốt'
        elif score >= 60:
            return 'Trung bình'
        elif score >= 40:
            return 'Kém'
        else:
            return 'Rất kém'
    
    def get_seasonal_trends(
        self,
        months: int = 12
    ) -> Dict:
        """
        Phân tích xu hướng theo mùa
        """
        with get_db_context() as db:
            trends = []
            
            for i in range(months):
                # Calculate month range
                end_date = date.today().replace(day=1)
                for _ in range(i):
                    end_date = (end_date.replace(day=1) - timedelta(days=1))
                
                start_date = end_date.replace(day=1)
                next_month = end_date + timedelta(days=32)
                end_date = next_month.replace(day=1) - timedelta(days=1)
                
                # Count appointments
                count = db.query(func.count(Appointment.id)).filter(
                    func.date(Appointment.appointment_date) >= start_date,
                    func.date(Appointment.appointment_date) <= end_date,
                    Appointment.status == AppointmentStatus.completed
                ).scalar()
                
                # Average cost
                avg_cost = db.query(func.avg(Appointment.actual_cost)).filter(
                    func.date(Appointment.appointment_date) >= start_date,
                    func.date(Appointment.appointment_date) <= end_date,
                    Appointment.status == AppointmentStatus.completed
                ).scalar()
                
                trends.append({
                    'month': start_date.strftime('%Y-%m'),
                    'month_name': start_date.strftime('%B %Y'),
                    'service_count': count,
                    'average_cost': round(float(avg_cost or 0), 2)
                })
            
            trends.reverse()  # Oldest first
            
            return {
                'seasonal_trends': trends
            }
    
    def get_diagnostic_insights(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Phân tích insights từ diagnosis notes
        """
        with get_db_context() as db:
            if not start_date:
                start_date = date.today() - timedelta(days=90)
            if not end_date:
                end_date = date.today()
            
            # Get service records with diagnosis
            records = db.query(ServiceRecord).filter(
                func.date(ServiceRecord.service_date) >= start_date,
                func.date(ServiceRecord.service_date) <= end_date,
                ServiceRecord.diagnosis.isnot(None)
            ).all()
            
            # Keywords to look for
            keywords = {
                'battery': ['pin', 'battery', 'acquy', 'sạc'],
                'motor': ['động cơ', 'motor', 'engine'],
                'brake': ['phanh', 'brake'],
                'tire': ['lốp', 'tire', 'wheel'],
                'electrical': ['điện', 'electric', 'wiring'],
                'cooling': ['làm mát', 'cooling', 'radiator']
            }
            
            category_counts = {cat: 0 for cat in keywords.keys()}
            
            for record in records:
                if record.diagnosis:
                    diagnosis_lower = record.diagnosis.lower()
                    for category, kws in keywords.items():
                        if any(kw in diagnosis_lower for kw in kws):
                            category_counts[category] += 1
            
            insights = [
                {
                    'category': cat,
                    'count': count,
                    'percentage': round((count / len(records) * 100) if records else 0, 2)
                }
                for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
            ]
            
            return {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'total_diagnoses': len(records),
                'diagnostic_insights': insights
            }


# Singleton instance
failure_analytics = FailureAnalytics()
