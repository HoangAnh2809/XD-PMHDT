"""
Enhanced Validation and Sanitization
Provides comprehensive input validation and sanitization
"""
import re
import html
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, date
import uuid
from email_validator import validate_email, EmailNotValidError
import phonenumbers
from phonenumbers import NumberParseException

class ValidationError(Exception):
    """Custom validation error"""
    pass

class InputValidator:
    """Comprehensive input validation and sanitization"""
    
    # Common regex patterns
    PATTERNS = {
        'username': re.compile(r'^[a-zA-Z0-9_]{3,30}$'),
        'license_plate': re.compile(r'^[0-9]{2}[A-Z]{1,2}-[0-9]{4,5}$'),
        'vin': re.compile(r'^[A-HJ-NPR-Z0-9]{17}$'),
        'phone': re.compile(r'^(\+84|0)[0-9]{9,10}$'),
        'password': re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'),
        'alphanumeric': re.compile(r'^[a-zA-Z0-9\s\-_]+$'),
        'currency': re.compile(r'^\d+(\.\d{1,2})?$'),
        'uuid': re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    }
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 255) -> str:
        """Sanitize string input"""
        if not isinstance(value, str):
            raise ValidationError("Input must be a string")
        
        # HTML escape to prevent XSS
        sanitized = html.escape(value.strip())
        
        # Limit length
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        return sanitized
    
    @staticmethod
    def validate_email_address(email: str) -> str:
        """Validate and normalize email address"""
        try:
            validated = validate_email(email)
            return validated.email
        except EmailNotValidError as e:
            raise ValidationError(f"Invalid email address: {str(e)}")
    
    @staticmethod
    def validate_phone_number(phone: str, country_code: str = "VN") -> str:
        """Validate and normalize phone number"""
        try:
            parsed = phonenumbers.parse(phone, country_code)
            if not phonenumbers.is_valid_number(parsed):
                raise ValidationError("Invalid phone number")
            
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except NumberParseException:
            raise ValidationError("Invalid phone number format")
    
    @staticmethod
    def validate_username(username: str) -> str:
        """Validate username format"""
        sanitized = InputValidator.sanitize_string(username, 30)
        
        if not InputValidator.PATTERNS['username'].match(sanitized):
            raise ValidationError(
                "Username must be 3-30 characters long and contain only letters, numbers, and underscores"
            )
        
        return sanitized
    
    @staticmethod
    def validate_password(password: str) -> str:
        """Validate password strength"""
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        
        if not InputValidator.PATTERNS['password'].match(password):
            raise ValidationError(
                "Password must contain at least one lowercase letter, one uppercase letter, "
                "one digit, and one special character (@$!%*?&)"
            )
        
        return password
    
    @staticmethod
    def validate_license_plate(plate: str) -> str:
        """Validate Vietnamese license plate format"""
        sanitized = InputValidator.sanitize_string(plate.upper(), 10)
        
        if not InputValidator.PATTERNS['license_plate'].match(sanitized):
            raise ValidationError(
                "License plate must be in format: XX-Y-XXXX or XX-Y-XXXXX (Vietnamese format)"
            )
        
        return sanitized
    
    @staticmethod
    def validate_vin(vin: str) -> str:
        """Validate VIN format"""
        sanitized = InputValidator.sanitize_string(vin.upper(), 17)
        
        if not InputValidator.PATTERNS['vin'].match(sanitized):
            raise ValidationError("VIN must be exactly 17 characters (alphanumeric, excluding I, O, Q)")
        
        return sanitized
    
    @staticmethod
    def validate_uuid(uuid_str: str) -> str:
        """Validate UUID format"""
        try:
            uuid.UUID(uuid_str)
            return str(uuid_str)
        except ValueError:
            raise ValidationError("Invalid UUID format")
    
    @staticmethod
    def validate_currency(amount: Union[str, int, float]) -> float:
        """Validate currency amount"""
        try:
            amount_float = float(amount)
            if amount_float < 0:
                raise ValidationError("Currency amount cannot be negative")
            
            # Round to 2 decimal places
            return round(amount_float, 2)
        except (ValueError, TypeError):
            raise ValidationError("Invalid currency format")
    
    @staticmethod
    def validate_date_range(start_date: date, end_date: date) -> tuple:
        """Validate date range"""
        if start_date > end_date:
            raise ValidationError("Start date cannot be after end date")
        
        return start_date, end_date
    
    @staticmethod
    def validate_pagination(page: int, limit: int, max_limit: int = 100) -> tuple:
        """Validate pagination parameters"""
        if page < 1:
            page = 1
        
        if limit < 1:
            limit = 10
        elif limit > max_limit:
            limit = max_limit
        
        return page, limit
    
    @staticmethod
    def validate_json_data(data: Any) -> Dict:
        """Validate JSON data structure"""
        if not isinstance(data, dict):
            raise ValidationError("Data must be a JSON object")
        
        # Recursively sanitize string values
        return InputValidator._recursive_sanitize(data)
    
    @staticmethod
    def _recursive_sanitize(data: Any) -> Any:
        """Recursively sanitize nested data structures"""
        if isinstance(data, dict):
            return {key: InputValidator._recursive_sanitize(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [InputValidator._recursive_sanitize(item) for item in data]
        elif isinstance(data, str):
            return InputValidator.sanitize_string(data)
        else:
            return data

class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = {}
    
    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        """Check if request is allowed based on rate limit"""
        import time
        current_time = time.time()
        
        if key not in self.requests:
            self.requests[key] = []
        
        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key] 
            if current_time - req_time < window
        ]
        
        # Check if under limit
        if len(self.requests[key]) >= limit:
            return False
        
        # Add current request
        self.requests[key].append(current_time)
        return True

class SecurityValidator:
    """Security-focused validation"""
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)",
        r"(--|\#|\/\*|\*\/)",
        r"(\b(OR|AND)\s+\d+\s*=\s*\d+)",
        r"(\b(OR|AND)\s+'.*'\s*=\s*'.*')",
        r"(\b(OR|AND)\s+\".*\"\s*=\s*\".*\")",
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>.*?</iframe>",
        r"<object[^>]*>.*?</object>",
        r"<embed[^>]*>.*?</embed>",
    ]
    
    @staticmethod
    def detect_sql_injection(value: str) -> bool:
        """Detect potential SQL injection attempts"""
        if not isinstance(value, str):
            return False
        
        value_upper = value.upper()
        for pattern in SecurityValidator.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value_upper, re.IGNORECASE):
                return True
        
        return False
    
    @staticmethod
    def detect_xss(value: str) -> bool:
        """Detect potential XSS attempts"""
        if not isinstance(value, str):
            return False
        
        for pattern in SecurityValidator.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        
        return False
    
    @staticmethod
    def validate_input_security(value: str) -> str:
        """Validate input for security threats"""
        if SecurityValidator.detect_sql_injection(value):
            raise ValidationError("Potential SQL injection detected")
        
        if SecurityValidator.detect_xss(value):
            raise ValidationError("Potential XSS attack detected")
        
        return InputValidator.sanitize_string(value)

# Global instances
input_validator = InputValidator()
rate_limiter = RateLimiter()
security_validator = SecurityValidator()
