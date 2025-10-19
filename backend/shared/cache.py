"""
Redis Cache Service
Provides centralized caching functionality for all microservices
"""
import json
import logging
import redis
from typing import Any, Optional, Union
from datetime import timedelta
import os

logger = logging.getLogger(__name__)

class CacheService:
    """
    Redis-based cache service with JSON serialization
    """
    
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            logger.info("Redis cache service initialized successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Cache disabled.")
            self.enabled = False
            self.redis_client = None
    
    def _serialize(self, data: Any) -> str:
        """Serialize data to JSON string"""
        try:
            return json.dumps(data, default=str)
        except (TypeError, ValueError) as e:
            logger.error(f"Serialization error: {e}")
            return str(data)
    
    def _deserialize(self, data: str) -> Any:
        """Deserialize JSON string to Python object"""
        try:
            return json.loads(data)
        except (json.JSONDecodeError, TypeError) as e:
            logger.error(f"Deserialization error: {e}")
            return data
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.enabled:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value is None:
                return None
            return self._deserialize(value)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Union[int, timedelta] = 3600) -> bool:
        """Set value in cache with TTL"""
        if not self.enabled:
            return False
        
        try:
            serialized_value = self._serialize(value)
            if isinstance(ttl, timedelta):
                ttl = int(ttl.total_seconds())
            
            return self.redis_client.setex(key, ttl, serialized_value)
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.enabled:
            return False
        
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.enabled:
            return False
        
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment numeric value in cache"""
        if not self.enabled:
            return None
        
        try:
            return self.redis_client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Cache increment error for key {key}: {e}")
            return None
    
    async def expire(self, key: str, ttl: Union[int, timedelta]) -> bool:
        """Set expiration for existing key"""
        if not self.enabled:
            return False
        
        try:
            if isinstance(ttl, timedelta):
                ttl = int(ttl.total_seconds())
            return bool(self.redis_client.expire(key, ttl))
        except Exception as e:
            logger.error(f"Cache expire error for key {key}: {e}")
            return False

# Global cache service instance
cache_service = CacheService()

# Cache decorator for functions
def cached(ttl: Union[int, timedelta] = 3600, key_prefix: str = ""):
    """
    Decorator to cache function results
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix}:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached_result = await cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache_service.set(cache_key, result, ttl)
            logger.debug(f"Cached result for {cache_key}")
            
            return result
        
        return wrapper
    return decorator

# Common cache keys
class CacheKeys:
    """Standard cache key patterns"""
    USER_PROFILE = "user:profile:{user_id}"
    USER_VEHICLES = "user:vehicles:{user_id}"
    SERVICE_TYPES = "service:types"
    SERVICE_CENTERS = "service:centers"
    PARTS_INVENTORY = "parts:inventory"
    APPOINTMENTS = "appointments:{date}"
    DASHBOARD_STATS = "dashboard:stats:{user_id}"
    CHAT_SESSIONS = "chat:sessions:{user_id}"
    NOTIFICATIONS = "notifications:{user_id}"
