"""
Authentication and authorization for chat service
JWT token verification and user extraction
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

# Security scheme
security = HTTPBearer()


def verify_token(token: str) -> Optional[dict]:
    """
    Verify JWT token and extract user information
    
    Returns:
        dict: User information if valid
        None: If token is invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_data = {
            "user_id": payload.get("sub"),
            "username": payload.get("username"),
            "role": payload.get("role"),
            "email": payload.get("email")
        }
        
        if not user_data["user_id"]:
            return None
        
        return user_data
        
    except JWTError as e:
        logger.error(f"JWT verification error: {str(e)}")
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user from JWT token (REST endpoints)
    
    Raises:
        HTTPException: If token is invalid or missing
    
    Returns:
        dict: User information
    """
    token = credentials.credentials
    
    user = verify_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_user_ws(token: Optional[str]) -> Optional[dict]:
    """
    Verify user for WebSocket connection
    
    Args:
        token: JWT token from query parameter
    
    Returns:
        dict: User information if valid
        None: If token is invalid or missing
    """
    if not token:
        logger.warning("WebSocket connection attempt without token")
        return None
    
    return verify_token(token)


def require_role(allowed_roles: list):
    """
    Dependency factory to require specific roles
    
    Usage:
        @app.get("/admin/users", dependencies=[Depends(require_role(["admin"]))])
    """
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        return current_user
    
    return role_checker
