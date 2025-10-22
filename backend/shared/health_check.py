"""
Health Check and Metrics Service
Provides comprehensive health monitoring and metrics collection
"""
import asyncio
import time
import psutil
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)

@dataclass
class HealthStatus:
    """Health status data structure"""
    service: str
    status: str  # healthy, degraded, unhealthy
    timestamp: datetime
    version: str
    uptime: float
    memory_usage: float
    cpu_usage: float
    dependencies: Dict[str, str]
    metrics: Dict[str, Any]

class MetricsCollector:
    """Collects and stores application metrics"""
    
    def __init__(self):
        self.start_time = time.time()
        self.request_count = 0
        self.error_count = 0
        self.response_times = []
        self.active_connections = 0
        self.database_connections = 0
        self.cache_hits = 0
        self.cache_misses = 0
        
    def record_request(self, response_time: float, status_code: int):
        """Record API request metrics"""
        self.request_count += 1
        
        if status_code >= 400:
            self.error_count += 1
        
        self.response_times.append(response_time)
        
        # Keep only last 1000 response times
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]
    
    def record_cache_operation(self, hit: bool):
        """Record cache operation"""
        if hit:
            self.cache_hits += 1
        else:
            self.cache_misses += 1
    
    def get_average_response_time(self) -> float:
        """Get average response time"""
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)
    
    def get_error_rate(self) -> float:
        """Get error rate percentage"""
        if self.request_count == 0:
            return 0.0
        return (self.error_count / self.request_count) * 100
    
    def get_cache_hit_rate(self) -> float:
        """Get cache hit rate percentage"""
        total_operations = self.cache_hits + self.cache_misses
        if total_operations == 0:
            return 0.0
        return (self.cache_hits / total_operations) * 100

class DependencyChecker:
    """Checks health of external dependencies"""
    
    def __init__(self):
        self.dependencies = {}
    
    async def check_database(self, database_url: str) -> str:
        """Check database connectivity"""
        try:
            from sqlalchemy import create_engine, text
            engine = create_engine(database_url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return "healthy"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return "unhealthy"
    
    async def check_redis(self, redis_url: str) -> str:
        """Check Redis connectivity"""
        try:
            import redis
            r = redis.from_url(redis_url)
            r.ping()
            return "healthy"
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return "unhealthy"
    
    async def check_external_api(self, url: str, timeout: int = 5) -> str:
        """Check external API connectivity"""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(f"{url}/health")
                if response.status_code == 200:
                    return "healthy"
                else:
                    return "degraded"
        except Exception as e:
            logger.error(f"External API health check failed for {url}: {e}")
            return "unhealthy"

class HealthChecker:
    """Main health checking service"""
    
    def __init__(self, service_name: str, version: str = "1.0.0"):
        self.service_name = service_name
        self.version = version
        self.start_time = time.time()
        self.metrics = MetricsCollector()
        self.dependency_checker = DependencyChecker()
        self.dependencies = {}
    
    def add_dependency(self, name: str, check_func, *args, **kwargs):
        """Add a dependency to monitor"""
        self.dependencies[name] = {
            'check_func': check_func,
            'args': args,
            'kwargs': kwargs
        }
    
    async def check_dependencies(self) -> Dict[str, str]:
        """Check all registered dependencies"""
        results = {}
        
        for name, dep in self.dependencies.items():
            try:
                status = await dep['check_func'](*dep['args'], **dep['kwargs'])
                results[name] = status
            except Exception as e:
                logger.error(f"Dependency check failed for {name}: {e}")
                results[name] = "unhealthy"
        
        return results
    
    def get_system_metrics(self) -> Dict[str, float]:
        """Get system resource metrics"""
        try:
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            
            return {
                'memory_usage_mb': memory_info.rss / 1024 / 1024,
                'memory_percent': process.memory_percent(),
                'cpu_percent': process.cpu_percent(),
                'thread_count': process.num_threads(),
                'open_files': len(process.open_files()),
                'connections': len(process.connections())
            }
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {
                'memory_usage_mb': 0.0,
                'memory_percent': 0.0,
                'cpu_percent': 0.0,
                'thread_count': 0,
                'open_files': 0,
                'connections': 0
            }
    
    async def get_health_status(self) -> HealthStatus:
        """Get comprehensive health status"""
        uptime = time.time() - self.start_time
        dependencies = await self.check_dependencies()
        system_metrics = self.get_system_metrics()
        
        # Determine overall status
        if any(status == "unhealthy" for status in dependencies.values()):
            overall_status = "unhealthy"
        elif any(status == "degraded" for status in dependencies.values()):
            overall_status = "degraded"
        else:
            overall_status = "healthy"
        
        metrics_data = {
            'request_count': self.metrics.request_count,
            'error_count': self.metrics.error_count,
            'average_response_time': self.metrics.get_average_response_time(),
            'error_rate': self.metrics.get_error_rate(),
            'cache_hit_rate': self.metrics.get_cache_hit_rate(),
            'uptime_seconds': uptime,
            **system_metrics
        }
        
        return HealthStatus(
            service=self.service_name,
            status=overall_status,
            timestamp=datetime.utcnow(),
            version=self.version,
            uptime=uptime,
            memory_usage=system_metrics.get('memory_percent', 0.0),
            cpu_usage=system_metrics.get('cpu_percent', 0.0),
            dependencies=dependencies,
            metrics=metrics_data
        )
    
    def record_request_metrics(self, response_time: float, status_code: int):
        """Record request metrics"""
        self.metrics.record_request(response_time, status_code)
    
    def record_cache_metrics(self, hit: bool):
        """Record cache metrics"""
        self.metrics.record_cache_operation(hit)

# Middleware for FastAPI
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

class HealthCheckMiddleware(BaseHTTPMiddleware):
    """Middleware to collect request metrics"""
    
    def __init__(self, app, health_checker: HealthChecker):
        super().__init__(app)
        self.health_checker = health_checker
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        try:
            response = await call_next(request)
            response_time = time.time() - start_time
            
            # Record metrics
            self.health_checker.record_request_metrics(
                response_time, response.status_code
            )
            
            return response
        except Exception as e:
            response_time = time.time() - start_time
            self.health_checker.record_request_metrics(response_time, 500)
            raise

# Global health checker instances
health_checkers = {}

def get_health_checker(service_name: str, version: str = "1.0.0") -> HealthChecker:
    """Get or create health checker for service"""
    if service_name not in health_checkers:
        health_checkers[service_name] = HealthChecker(service_name, version)
    return health_checkers[service_name]
