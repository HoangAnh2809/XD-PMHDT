"""
Enhanced Security Module
Provides comprehensive security features including rate limiting, security headers, and threat detection
"""
import time
import hashlib
import hmac
import secrets
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)

@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_type: str
    ip_address: str
    user_id: Optional[str]
    user_agent: str
    timestamp: datetime
    details: Dict
    severity: str  # low, medium, high, critical

class RateLimiter:
    """Advanced rate limiting with multiple strategies"""
    
    def __init__(self):
        self.requests = {}
        self.blocked_ips = {}
        self.suspicious_ips = {}
    
    def is_allowed(self, key: str, limit: int, window: int, 
                  burst_limit: int = None) -> Tuple[bool, Dict[str, Any]]:
        """Check if request is allowed with burst protection"""
        current_time = time.time()
        
        # Clean expired entries
        self._cleanup_expired_entries(current_time)
        
        # Check if IP is blocked
        if key in self.blocked_ips:
            if self.blocked_ips[key] > current_time:
                return False, {"reason": "IP blocked", "retry_after": self.blocked_ips[key] - current_time}
            else:
                del self.blocked_ips[key]
        
        # Initialize request tracking
        if key not in self.requests:
            self.requests[key] = []
        
        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key] 
            if current_time - req_time < window
        ]
        
        # Check burst limit (short-term protection)
        recent_requests = [
            req_time for req_time in self.requests[key] 
            if current_time - req_time < 60  # Last minute
        ]
        
        if burst_limit and len(recent_requests) >= burst_limit:
            # Mark as suspicious
            self.suspicious_ips[key] = current_time + 300  # 5 minutes
            return False, {"reason": "Burst limit exceeded", "retry_after": 60}
        
        # Check regular limit
        if len(self.requests[key]) >= limit:
            # Progressive blocking for repeated violations
            if key in self.suspicious_ips:
                block_duration = min(3600, 300 * (len(self.requests[key]) // limit))  # Up to 1 hour
                self.blocked_ips[key] = current_time + block_duration
                return False, {"reason": "Rate limit exceeded - IP blocked", "retry_after": block_duration}
            else:
                return False, {"reason": "Rate limit exceeded", "retry_after": window}
        
        # Add current request
        self.requests[key].append(current_time)
        
        return True, {
            "remaining": limit - len(self.requests[key]),
            "reset_time": current_time + window
        }
    
    def _cleanup_expired_entries(self, current_time: float):
        """Clean up expired rate limiting entries"""
        # Clean requests older than 1 hour
        for key in list(self.requests.keys()):
            self.requests[key] = [
                req_time for req_time in self.requests[key] 
                if current_time - req_time < 3600
            ]
            if not self.requests[key]:
                del self.requests[key]
        
        # Clean expired blocked IPs
        self.blocked_ips = {
            ip: block_time for ip, block_time in self.blocked_ips.items()
            if block_time > current_time
        }
        
        # Clean expired suspicious IPs
        self.suspicious_ips = {
            ip: sus_time for ip, sus_time in self.suspicious_ips.items()
            if sus_time > current_time
        }

class SecurityHeaders:
    """Security headers management"""
    
    DEFAULT_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none';"
        )
    }
    
    @staticmethod
    def get_headers(is_https: bool = True) -> Dict[str, str]:
        """Get security headers"""
        headers = SecurityHeaders.DEFAULT_HEADERS.copy()
        
        if not is_https:
            # Remove HSTS for non-HTTPS
            headers.pop("Strict-Transport-Security", None)
        
        return headers

class ThreatDetector:
    """Advanced threat detection and prevention"""
    
    def __init__(self):
        self.suspicious_patterns = {
            'sql_injection': [
                r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)",
                r"(--|\#|\/\*|\*\/)",
                r"(\b(OR|AND)\s+\d+\s*=\s*\d+)",
                r"(\b(OR|AND)\s+'.*'\s*=\s*'.*')",
            ],
            'xss': [
                r"<script[^>]*>.*?</script>",
                r"javascript:",
                r"on\w+\s*=",
                r"<iframe[^>]*>.*?</iframe>",
                r"eval\s*\(",
                r"expression\s*\(",
            ],
            'path_traversal': [
                r"\.\.\/",
                r"\.\.\\",
                r"\/etc\/passwd",
                r"\/windows\/system32",
                r"\/proc\/",
            ],
            'command_injection': [
                r"[;&|`$]",
                r"exec\s*\(",
                r"system\s*\(",
                r"shell_exec\s*\(",
            ]
        }
        
        self.rate_limiters = {
            'login': RateLimiter(),
            'api': RateLimiter(),
            'general': RateLimiter()
        }
    
    def detect_threats(self, request: Request, body: str = None) -> List[SecurityEvent]:
        """Detect potential security threats"""
        threats = []
        
        # Check URL parameters
        for param, value in request.query_params.items():
            threats.extend(self._check_suspicious_content(param, value, "query_param"))
        
        # Check path parameters
        for param, value in request.path_params.items():
            threats.extend(self._check_suspicious_content(param, value, "path_param"))
        
        # Check request body
        if body:
            threats.extend(self._check_suspicious_content("body", body, "request_body"))
        
        # Check headers for suspicious content
        for header, value in request.headers.items():
            if header.lower() in ['user-agent', 'referer', 'origin']:
                threats.extend(self._check_suspicious_content(header, value, "header"))
        
        return threats
    
    def _check_suspicious_content(self, field: str, content: str, source: str) -> List[SecurityEvent]:
        """Check content for suspicious patterns"""
        threats = []
        
        if not isinstance(content, str):
            return threats
        
        content_lower = content.lower()
        
        for threat_type, patterns in self.suspicious_patterns.items():
            for pattern in patterns:
                import re
                if re.search(pattern, content, re.IGNORECASE):
                    threats.append(SecurityEvent(
                        event_type=f"suspicious_{threat_type}",
                        ip_address="",  # Will be filled by caller
                        user_id=None,
                        user_agent="",
                        timestamp=datetime.utcnow(),
                        details={
                            "field": field,
                            "source": source,
                            "pattern": pattern,
                            "content_preview": content[:100]
                        },
                        severity="high" if threat_type in ['sql_injection', 'command_injection'] else "medium"
                    ))
        
        return threats
    
    def check_rate_limit(self, request: Request, limit_type: str = "general") -> Tuple[bool, Dict]:
        """Check rate limiting"""
        client_ip = self._get_client_ip(request)
        rate_limiter = self.rate_limiters.get(limit_type, self.rate_limiters['general'])
        
        # Different limits for different types
        limits = {
            'login': (5, 900),      # 5 attempts per 15 minutes
            'api': (100, 3600),     # 100 requests per hour
            'general': (1000, 3600) # 1000 requests per hour
        }
        
        limit, window = limits.get(limit_type, limits['general'])
        burst_limit = limit // 10  # 10% of limit as burst limit
        
        return rate_limiter.is_allowed(client_ip, limit, window, burst_limit)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return request.client.host if request.client else "unknown"

class CSRFProtection:
    """CSRF protection implementation"""
    
    def __init__(self):
        self.tokens = {}
        self.token_expiry = 3600  # 1 hour
    
    def generate_token(self, session_id: str) -> str:
        """Generate CSRF token for session"""
        token = secrets.token_urlsafe(32)
        self.tokens[token] = {
            'session_id': session_id,
            'created_at': time.time(),
            'used': False
        }
        return token
    
    def validate_token(self, token: str, session_id: str) -> bool:
        """Validate CSRF token"""
        if token not in self.tokens:
            return False
        
        token_data = self.tokens[token]
        
        # Check expiry
        if time.time() - token_data['created_at'] > self.token_expiry:
            del self.tokens[token]
            return False
        
        # Check session match
        if token_data['session_id'] != session_id:
            return False
        
        # Mark as used (one-time use)
        token_data['used'] = True
        return True
    
    def cleanup_expired_tokens(self):
        """Clean up expired tokens"""
        current_time = time.time()
        expired_tokens = [
            token for token, data in self.tokens.items()
            if current_time - data['created_at'] > self.token_expiry
        ]
        
        for token in expired_tokens:
            del self.tokens[token]

class SecurityManager:
    """Main security manager"""
    
    def __init__(self):
        self.threat_detector = ThreatDetector()
        self.csrf_protection = CSRFProtection()
        self.security_events = []
    
    def analyze_request(self, request: Request, body: str = None) -> Tuple[bool, List[SecurityEvent]]:
        """Comprehensive request security analysis"""
        threats = []
        
        # Detect threats
        threats.extend(self.threat_detector.detect_threats(request, body))
        
        # Check rate limiting
        allowed, rate_info = self.threat_detector.check_rate_limit(request)
        if not allowed:
            threats.append(SecurityEvent(
                event_type="rate_limit_exceeded",
                ip_address=self.threat_detector._get_client_ip(request),
                user_id=None,
                user_agent=request.headers.get("user-agent", ""),
                timestamp=datetime.utcnow(),
                details=rate_info,
                severity="medium"
            ))
        
        # Add IP and user agent to all threats
        client_ip = self.threat_detector._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        for threat in threats:
            threat.ip_address = client_ip
            threat.user_agent = user_agent
        
        # Store security events
        self.security_events.extend(threats)
        
        # Clean up old events (keep last 1000)
        if len(self.security_events) > 1000:
            self.security_events = self.security_events[-1000:]
        
        # Determine if request should be blocked
        critical_threats = [t for t in threats if t.severity == "critical"]
        high_threats = [t for t in threats if t.severity == "high"]
        
        should_block = len(critical_threats) > 0 or len(high_threats) > 2
        
        return not should_block, threats
    
    def log_security_event(self, event: SecurityEvent):
        """Log security event"""
        logger.warning(
            f"Security Event: {event.event_type} from {event.ip_address}",
            extra={
                "event_type": event.event_type,
                "ip_address": event.ip_address,
                "user_id": event.user_id,
                "severity": event.severity,
                "details": event.details
            }
        )

# Global security manager
security_manager = SecurityManager()
