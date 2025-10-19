from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import os
import logging
import httpx

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logging.error(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    return payload

def require_role(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            # Log details for debugging authorization issues
            logging.getLogger("service_center.auth").warning(
                "Authorization failed: user=%s role=%s allowed=%s payload=%s",
                current_user.get("email") or current_user.get("sub") or "<unknown>",
                user_role,
                allowed_roles,
                current_user,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        return current_user
    return role_checker

# HTTP Client for API Gateway communication
class APIGatewayClient:
    def __init__(self):
        self.base_url = os.getenv("API_GATEWAY_URL", "http://api_gateway:8000")
        self.timeout = 30.0
        # Create a long-lived internal service token so services can call
        # protected endpoints via the API Gateway. This token has role 'admin'
        # to allow internal operations like invoice generation. The token
        # expiry is set very long for local/dev environments; change this
        # if you want tighter security in production.
        try:
            self.service_token = create_access_token(
                data={
                    "sub": "internal-service",
                    "user_id": os.getenv("SERVICE_USER_ID", "00000000-0000-0000-0000-000000000000"),
                    "role": "admin",
                    "full_name": "internal service"
                },
                expires_delta=timedelta(days=3650)
            )
        except Exception:
            # Fallback: if token creation fails for any reason, set to None
            self.service_token = None

    async def call_service(self, service_path: str, method: str = "GET", data: dict = None, headers: dict = None):
        """
        Call API Gateway service endpoint
        Args:
            service_path: Path like '/customer/vehicles' or '/notification/send'
            method: HTTP method (GET, POST, PUT, DELETE)
            data: Request data for POST/PUT
            headers: Additional headers
        """
        url = f"{self.base_url}{service_path}"

        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)

        # If caller didn't supply an Authorization header, attach
        # the internal service token so API Gateway will forward it
        # to downstream services that require authentication.
        if "Authorization" not in request_headers and getattr(self, "service_token", None):
            request_headers["Authorization"] = f"Bearer {self.service_token}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method == "GET":
                    response = await client.get(url, headers=request_headers)
                elif method == "POST":
                    response = await client.post(url, headers=request_headers, json=data)
                elif method == "PUT":
                    response = await client.put(url, headers=request_headers, json=data)
                elif method == "DELETE":
                    response = await client.delete(url, headers=request_headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                response.raise_for_status()
                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail=f"Service timeout calling {service_path}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Service error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")

# Global client instance
api_gateway_client = APIGatewayClient()
