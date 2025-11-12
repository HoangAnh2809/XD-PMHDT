"""
backend.shared package

This package contains utilities and shared code used across services in the `backend/` folder.

Public modules:
- auth
- cache
- database
- health_check
- logging_config
- models
- security
- validation

Owner: Dev 1 (see BACKEND_ASSIGNMENT.md)
"""

from .auth import *
from .cache import *
from .database import *
from .health_check import *
from .logging_config import *
from .models import *
from .security import *
from .validation import *

__all__ = [
    'auth', 'cache', 'database', 'health_check', 'logging_config', 'models', 'security', 'validation'
]
