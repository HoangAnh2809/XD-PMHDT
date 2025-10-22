"""
Centralized Logging Configuration
Provides structured logging across all microservices
"""
import logging
import logging.handlers
import os
import sys
from datetime import datetime
import json
from typing import Dict, Any

class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "service": getattr(record, 'service_name', 'unknown'),
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'user_id'):
            log_entry["user_id"] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry["request_id"] = record.request_id
        if hasattr(record, 'duration'):
            log_entry["duration"] = record.duration
        
        return json.dumps(log_entry, ensure_ascii=False)

class StructuredLogger:
    """Enhanced logger with structured logging capabilities"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = logging.getLogger(service_name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup logger with appropriate handlers and formatters"""
        self.logger.setLevel(logging.INFO)
        
        # Remove existing handlers
        self.logger.handlers.clear()
        
        # Console handler with JSON formatting
        console_handler = logging.StreamHandler(sys.stdout)
        json_formatter = JSONFormatter()
        console_handler.setFormatter(json_formatter)
        self.logger.addHandler(console_handler)
        
        # File handler for persistent logs (if log directory exists)
        log_dir = os.getenv("LOG_DIR", "./logs")
        if os.path.exists(log_dir) or os.path.exists(os.path.dirname(log_dir)):
            try:
                os.makedirs(log_dir, exist_ok=True)
                file_handler = logging.handlers.RotatingFileHandler(
                    os.path.join(log_dir, f"{self.service_name}.log"),
                    maxBytes=10*1024*1024,  # 10MB
                    backupCount=5
                )
                file_handler.setFormatter(json_formatter)
                self.logger.addHandler(file_handler)
            except Exception as e:
                self.logger.warning(f"Could not setup file logging: {e}")
    
    def _log_with_context(self, level: str, message: str, **kwargs):
        """Log with additional context"""
        extra = {"service_name": self.service_name}
        extra.update(kwargs)
        
        getattr(self.logger, level.lower())(message, extra=extra)
    
    def info(self, message: str, **kwargs):
        """Log info message with context"""
        self._log_with_context("INFO", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message with context"""
        self._log_with_context("WARNING", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """Log error message with context"""
        self._log_with_context("ERROR", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        """Log debug message with context"""
        self._log_with_context("DEBUG", message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        """Log critical message with context"""
        self._log_with_context("CRITICAL", message, **kwargs)
    
    def log_api_call(self, method: str, endpoint: str, status_code: int, 
                    duration: float, user_id: str = None, **kwargs):
        """Log API call with performance metrics"""
        self.info(
            f"API {method} {endpoint} - {status_code}",
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration=duration,
            user_id=user_id,
            **kwargs
        )
    
    def log_database_operation(self, operation: str, table: str, 
                             duration: float, rows_affected: int = None, **kwargs):
        """Log database operation with metrics"""
        self.info(
            f"DB {operation} on {table}",
            operation=operation,
            table=table,
            duration=duration,
            rows_affected=rows_affected,
            **kwargs
        )
    
    def log_security_event(self, event_type: str, user_id: str = None, 
                          ip_address: str = None, **kwargs):
        """Log security-related events"""
        self.warning(
            f"Security event: {event_type}",
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            **kwargs
        )

# Service-specific logger instances
def get_logger(service_name: str) -> StructuredLogger:
    """Get logger instance for specific service"""
    return StructuredLogger(service_name)

# Performance monitoring decorator
import functools
import time

def monitor_performance(logger: StructuredLogger, operation_name: str):
    """Decorator to monitor function performance"""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                logger.log_database_operation(
                    operation=operation_name,
                    table=getattr(func, '__name__', 'unknown'),
                    duration=duration
                )
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(
                    f"Error in {operation_name}: {str(e)}",
                    operation=operation_name,
                    duration=duration,
                    error=str(e)
                )
                raise
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                logger.log_database_operation(
                    operation=operation_name,
                    table=getattr(func, '__name__', 'unknown'),
                    duration=duration
                )
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(
                    f"Error in {operation_name}: {str(e)}",
                    operation=operation_name,
                    duration=duration,
                    error=str(e)
                )
                raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator
