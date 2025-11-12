"""
Technician Performance Tracker
Theo dõi chi tiết hiệu suất làm việc của kỹ thuật viên
"""
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
import logging

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.models import (
    Appointment, AppointmentStatus, Technician, ServiceRecord,
    AppointmentChecklistProgress, User
)
from shared.database import get_db_context

logger = logging.getLogger(__name__)


class PerformanceTracker:
    """
    Theo dõi và phân tích hiệu suất kỹ thuật viên
    """
    
    def get_technician_performance(
        self,
        technician_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Lấy báo cáo hiệu suất chi tiết của kỹ thuật viên
        """
        with get_db_context() as db:
            if not start_date:
                start_date = date.today() - timedelta(days=30)
            if not end_date:
                end_date = date.today()
            
            technician = db.query(Technician).filter(Technician.id == technician_id).first()
            if not technician:
                return {'error': 'Technician not found'}
            
            # Lấy tất cả appointments trong khoảng thời gian
            appointments = db.query(Appointment).filter(
                Appointment.technician_id == technician_id,
                func.date(Appointment.appointment_date) >= start_date,
                func.date(Appointment.appointment_date) <= end_date
            ).all()
            
            total_tasks = len(appointments)
            completed_tasks = sum(1 for apt in appointments if apt.status == AppointmentStatus.completed)
            in_progress_tasks = sum(1 for apt in appointments if apt.status == AppointmentStatus.in_progress)
            cancelled_tasks = sum(1 for apt in appointments if apt.status == AppointmentStatus.cancelled)
            
            # Tính completion rate
            completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
            
            # Tính average completion time
            completion_times = []
            for apt in appointments:
                if apt.status == AppointmentStatus.completed and apt.created_at and apt.updated_at:
                    time_taken = apt.updated_at - apt.created_at
                    completion_times.append(time_taken.total_seconds() / 3600)  # hours
            
            avg_completion_hours = sum(completion_times) / len(completion_times) if completion_times else 0
            
            # Tính quality score dựa trên checklist completion
            quality_scores = self._calculate_quality_scores(technician_id, appointments, db)
            
            # Tính revenue generated
            total_revenue = sum(
                float(apt.actual_cost) for apt in appointments 
                if apt.actual_cost and apt.status == AppointmentStatus.completed
            )
            
            # Productivity (tasks per day)
            days_worked = (end_date - start_date).days + 1
            tasks_per_day = total_tasks / days_worked if days_worked > 0 else 0
            
            # On-time completion rate
            on_time_count = 0
            for apt in appointments:
                if apt.status == AppointmentStatus.completed:
                    if apt.updated_at and apt.appointment_date:
                        scheduled_date = apt.appointment_date.date() if hasattr(apt.appointment_date, 'date') else apt.appointment_date
                        completed_date = apt.updated_at.date()
                        if completed_date <= scheduled_date:
                            on_time_count += 1
            
            on_time_rate = (on_time_count / completed_tasks * 100) if completed_tasks > 0 else 0
            
            return {
                'technician_id': str(technician_id),
                'technician_name': technician.user.full_name if technician.user else 'Unknown',
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': days_worked
                },
                'task_statistics': {
                    'total_tasks': total_tasks,
                    'completed': completed_tasks,
                    'in_progress': in_progress_tasks,
                    'cancelled': cancelled_tasks,
                    'completion_rate': round(completion_rate, 2)
                },
                'time_metrics': {
                    'average_completion_hours': round(avg_completion_hours, 2),
                    'tasks_per_day': round(tasks_per_day, 2),
                    'on_time_completion_rate': round(on_time_rate, 2)
                },
                'quality_metrics': quality_scores,
                'financial_metrics': {
                    'total_revenue_generated': round(total_revenue, 2),
                    'average_revenue_per_task': round(total_revenue / completed_tasks, 2) if completed_tasks > 0 else 0
                },
                'rating': self._calculate_overall_rating(completion_rate, quality_scores['overall_score'], on_time_rate)
            }
    
    def _calculate_quality_scores(
        self,
        technician_id: str,
        appointments: List[Appointment],
        db: Session
    ) -> Dict:
        """
        Tính điểm chất lượng dựa trên checklist completion
        """
        total_checklist_items = 0
        completed_checklist_items = 0
        
        for apt in appointments:
            if apt.status == AppointmentStatus.completed:
                checklist_progress = db.query(AppointmentChecklistProgress).filter(
                    AppointmentChecklistProgress.appointment_id == apt.id
                ).all()
                
                for progress in checklist_progress:
                    total_checklist_items += 1
                    if progress.is_completed:
                        completed_checklist_items += 1
        
        checklist_completion_rate = (
            completed_checklist_items / total_checklist_items * 100
        ) if total_checklist_items > 0 else 0
        
        # Quality score (weighted)
        # 60% checklist completion + 40% assumed customer satisfaction
        # TODO: Add real customer satisfaction when review system is implemented
        assumed_satisfaction = 85  # Placeholder
        
        overall_score = (checklist_completion_rate * 0.6 + assumed_satisfaction * 0.4)
        
        return {
            'checklist_completion_rate': round(checklist_completion_rate, 2),
            'total_checklist_items': total_checklist_items,
            'completed_checklist_items': completed_checklist_items,
            'customer_satisfaction_score': assumed_satisfaction,  # Placeholder
            'overall_score': round(overall_score, 2)
        }
    
    def _calculate_overall_rating(
        self,
        completion_rate: float,
        quality_score: float,
        on_time_rate: float
    ) -> Dict:
        """
        Tính rating tổng thể (1-5 sao)
        """
        # Weighted average: 40% completion, 40% quality, 20% on-time
        weighted_score = (
            completion_rate * 0.4 +
            quality_score * 0.4 +
            on_time_rate * 0.2
        )
        
        # Convert to 5-star scale
        stars = (weighted_score / 100) * 5
        
        # Performance level
        if stars >= 4.5:
            level = 'Xuất sắc'
        elif stars >= 4.0:
            level = 'Tốt'
        elif stars >= 3.0:
            level = 'Trung bình'
        elif stars >= 2.0:
            level = 'Cần cải thiện'
        else:
            level = 'Kém'
        
        return {
            'overall_score': round(weighted_score, 2),
            'stars': round(stars, 1),
            'level': level
        }
    
    def get_all_technicians_ranking(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        Xếp hạng tất cả kỹ thuật viên theo hiệu suất
        """
        with get_db_context() as db:
            technicians = db.query(Technician).all()
            
            rankings = []
            for tech in technicians:
                performance = self.get_technician_performance(
                    str(tech.id),
                    start_date,
                    end_date
                )
                
                if 'error' not in performance:
                    rankings.append({
                        'technician_id': str(tech.id),
                        'technician_name': tech.user.full_name if tech.user else 'Unknown',
                        'overall_score': performance['rating']['overall_score'],
                        'stars': performance['rating']['stars'],
                        'level': performance['rating']['level'],
                        'completed_tasks': performance['task_statistics']['completed'],
                        'completion_rate': performance['task_statistics']['completion_rate'],
                        'quality_score': performance['quality_metrics']['overall_score']
                    })
            
            # Sort by overall score
            rankings.sort(key=lambda x: x['overall_score'], reverse=True)
            
            # Add rank
            for i, item in enumerate(rankings[:limit], start=1):
                item['rank'] = i
            
            return rankings[:limit]
    
    def get_performance_trends(
        self,
        technician_id: str,
        months: int = 6
    ) -> Dict:
        """
        Lấy xu hướng hiệu suất theo tháng
        """
        with get_db_context() as db:
            trends = []
            
            for i in range(months):
                end_date = date.today().replace(day=1) - timedelta(days=1) if i > 0 else date.today()
                start_date = end_date.replace(day=1)
                
                if i > 0:
                    # Go back one more month
                    for _ in range(i):
                        start_date = start_date.replace(day=1) - timedelta(days=1)
                        start_date = start_date.replace(day=1)
                
                performance = self.get_technician_performance(technician_id, start_date, end_date)
                
                if 'error' not in performance:
                    trends.append({
                        'month': start_date.strftime('%Y-%m'),
                        'completion_rate': performance['task_statistics']['completion_rate'],
                        'quality_score': performance['quality_metrics']['overall_score'],
                        'tasks_completed': performance['task_statistics']['completed'],
                        'revenue': performance['financial_metrics']['total_revenue_generated']
                    })
            
            trends.reverse()  # Oldest first
            
            return {
                'technician_id': str(technician_id),
                'trends': trends
            }


# Singleton instance
performance_tracker = PerformanceTracker()
