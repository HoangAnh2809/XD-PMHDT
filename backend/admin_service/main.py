from fastapi import FastAPI, Depends, HTTPException, status, Request, WebSocket
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
import sys
import os
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import get_db, engine
from shared.models import User, Customer, Staff, Technician, Base
from shared.auth import (
    verify_password, 
    create_access_token, 
    decode_access_token,
    get_password_hash,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from schemas import UserCreate, UserResponse, Token, UserLogin
import httpx

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EV Maintenance API Gateway", version="1.0.0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('api_gateway')

# CORS middleware - Must be configured before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Additional CORS headers middleware
@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Service URLs
CUSTOMER_SERVICE_URL = os.getenv("CUSTOMER_SERVICE_URL", "http://localhost:8001")
SERVICE_CENTER_URL = os.getenv("SERVICE_CENTER_URL", "http://localhost:8002")
CHAT_SERVICE_URL = os.getenv("CHAT_SERVICE_URL", "http://localhost:8003")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8004")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL", "http://localhost:8005")
ADMIN_SERVICE_URL = os.getenv("ADMIN_SERVICE_URL", "http://localhost:8007")

@app.get("/")
async def root():
    return {
        "message": "EV Maintenance API Gateway", 
        "version": "1.0.0",
        "services": {
            "customer": CUSTOMER_SERVICE_URL,
            "service_center": SERVICE_CENTER_URL,
            "chat": CHAT_SERVICE_URL,
            "notification": NOTIFICATION_SERVICE_URL,
            "payment": PAYMENT_SERVICE_URL,
            "admin": ADMIN_SERVICE_URL
        }
    }

@app.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Auto-generate username from email (part before @)
    username = user_data.email.split('@')[0]
    
    # Check if username already exists, if so, append numbers
    base_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1
    
    # Create user
    db_user = User(
        email=user_data.email,
        username=username,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create role-specific profile
    if user_data.role == "customer":
        customer = Customer(user_id=db_user.id)
        db.add(customer)
    elif user_data.role == "staff":
        staff = Staff(user_id=db_user.id)
        db.add(staff)
    elif user_data.role == "technician":
        technician = Technician(user_id=db_user.id)
        db.add(technician)
    
    db.commit()
    
    return UserResponse(
        id=str(db_user.id),
        email=db_user.email,
        full_name=db_user.full_name,
        phone=db_user.phone,
        role=db_user.role,
        is_active=db_user.is_active
    )

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email, 
            "user_id": str(user.id),
            "role": user.role,
            "full_name": user.full_name
        },
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", role=user.role)

@app.post("/auth/login-json", response_model=Token)
async def login_json(user_login: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_login.email).first()
    if not user or not verify_password(user_login.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email, 
            "user_id": str(user.id),
            "role": user.role,
            "full_name": user.full_name
        },
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", role=user.role)

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(request: Request, db: Session = Depends(get_db)):
    logger.info("Auth me request from %s headers=%s", request.client.host if request.client else '<unknown>', dict(request.headers))
    
    # Get token from Authorization header or query params
    auth_header = request.headers.get("Authorization")
    token = None
    
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        # Check for token in query params
        token = request.query_params.get("token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Decode and validate token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active
    )

# Proxy endpoints to microservices
async def proxy_request(url: str, method: str = "GET", headers: dict = None, json_data: dict = None, params: dict = None):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            request_headers = headers or {}
            if method == "GET":
                response = await client.get(url, headers=request_headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=request_headers, json=json_data)
            elif method == "PUT":
                response = await client.put(url, headers=request_headers, json=json_data)
            elif method == "DELETE":
                response = await client.delete(url, headers=request_headers)
            
            # Return the response with the same status code
            return response
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Service timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# Customer Service Proxy Routes
from fastapi import Request
from fastapi.responses import JSONResponse

@app.api_route("/customer/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_customer_service(path: str, request: Request):
    """Proxy all /customer/* requests to customer service"""
    url = f"{CUSTOMER_SERVICE_URL}/{path}"
    
    # Get auth header
    auth_header = request.headers.get("Authorization")
    headers = {"Authorization": auth_header} if auth_header else {}
    
    # Get query params
    params = dict(request.query_params)
    
    # Get body for POST/PUT requests
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            pass
    
    response = await proxy_request(
        url, 
        method=request.method,
        headers=headers,
        json_data=body,
        params=params
    )
    
    try:
        content = response.json()
    except:
        content = {"error": "Invalid response", "status": response.status_code}
    
    return JSONResponse(content=content, status_code=response.status_code)

# Service Center Proxy Routes  
@app.api_route("/service-center/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_service_center(path: str, request: Request):
    """Proxy all /service-center/* requests to service center service"""
    url = f"{SERVICE_CENTER_URL}/{path}"
    
    auth_header = request.headers.get("Authorization")
    # Check for token in query params if Authorization header is not present
    if not auth_header:
        token = request.query_params.get("token")
        if token:
            auth_header = f"Bearer {token}"
    
    # Log a short preview of the Authorization header for debugging
    if auth_header:
        logger.info("Proxying to service_center %s from %s auth_preview=%s", url, request.client.host if request.client else '<unknown>', auth_header[:30])
    else:
        logger.info("Proxying to service_center %s from %s (no auth header)", url, request.client.host if request.client else '<unknown>')
    headers = {"Authorization": auth_header} if auth_header else {}
    params = dict(request.query_params)
    
    # Remove token from params since it's now in the header
    if "token" in params:
        del params["token"]
    
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            pass
    
    response = await proxy_request(
        url,
        method=request.method,
        headers=headers,
        json_data=body,
        params=params
    )
    
    try:
        content = response.json()
    except:
        content = {"error": "Invalid response", "status": response.status_code}
    
    return JSONResponse(content=content, status_code=response.status_code)

# Chat Service Proxy Routes (including WebSocket)
@app.api_route("/chat/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_chat_service(path: str, request: Request):
    """Proxy all /chat/* requests to chat service"""
    url = f"{CHAT_SERVICE_URL}/{path}"
    
    auth_header = request.headers.get("Authorization")
    headers = {"Authorization": auth_header} if auth_header else {}
    params = dict(request.query_params)
    
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            pass
    
    response = await proxy_request(
        url,
        method=request.method,
        headers=headers,
        json_data=body,
        params=params
    )
    
    try:
        content = response.json()
    except:
        content = {"error": "Invalid response from chat service", "details": response.text}
    
    return JSONResponse(content=content, status_code=response.status_code)

# Notification Service Proxy Routes
@app.api_route("/notification/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_notification_service(path: str, request: Request):
    """Proxy all /notification/* requests to notification service"""
    url = f"{NOTIFICATION_SERVICE_URL}/{path}"
    
    auth_header = request.headers.get("Authorization")
    headers = {"Authorization": auth_header} if auth_header else {}
    params = dict(request.query_params)
    
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            pass
    
    response = await proxy_request(
        url,
        method=request.method,
        headers=headers,
        json_data=body,
        params=params
    )
    
    try:
        content = response.json()
    except:
        content = {"error": "Invalid response", "status": response.status_code}
    
    return JSONResponse(content=content, status_code=response.status_code)

# Payment Service Proxy Routes
@app.api_route("/payment/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_payment_service(path: str, request: Request):
    """Proxy all /payment/* requests to payment service"""
    url = f"{PAYMENT_SERVICE_URL}/{path}"
    
    auth_header = request.headers.get("Authorization")
    # Log a short preview of the Authorization header for debugging similar to service_center proxy
    if auth_header:
        logger.info("Proxying to payment %s from %s auth_preview=%s", url, request.client.host if request.client else '<unknown>', auth_header[:30])
    else:
        logger.info("Proxying to payment %s from %s (no auth header)", url, request.client.host if request.client else '<unknown>')

    headers = {"Authorization": auth_header} if auth_header else {}
    params = dict(request.query_params)
    
    # Remove token from params since it's now in the header
    if "token" in params:
        del params["token"]
    
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            pass
    
    response = await proxy_request(
        url,
        method=request.method,
        headers=headers,
        json_data=body,
        params=params
    )
    
    try:
        content = response.json()
    except:
        content = {"error": "Invalid response", "status": response.status_code}
    
    return JSONResponse(content=content, status_code=response.status_code)

# Admin Service Proxy Routes
@app.api_route("/admin/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_admin_service(path: str, request: Request):
    """Proxy all /admin/* requests to admin service /api/admin/*"""
    url = f"{ADMIN_SERVICE_URL}/api/admin/{path}"
    
    auth_header = request.headers.get("Authorization")
    headers = {"Authorization": auth_header} if auth_header else {}
    params = dict(request.query_params)
    
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.json()
        except:
            pass
    
    response = await proxy_request(
        url,
        method=request.method,
        headers=headers,
        json_data=body,
        params=params
    )
    
    try:
        content = response.json()
    except:
        content = {"error": "Invalid response", "status": response.status_code}
    
    return JSONResponse(content=content, status_code=response.status_code)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "api_gateway"}

# WebSocket proxy for chat service
@app.websocket("/chat/ws/chat/{session_id}")
async def websocket_chat_proxy(websocket: WebSocket, session_id: str):
    """Proxy WebSocket connections to chat service"""
    await websocket.accept()
    
    # Get token from query params
    token = websocket.query_params.get("token", "")
    
    # Create WebSocket connection to chat service
    import websockets
    chat_ws_url = f"{CHAT_SERVICE_URL.replace('http', 'ws')}/ws/chat/{session_id}?token={token}"
    
    try:
        async with websockets.connect(chat_ws_url) as chat_ws:
            # Forward messages between client and chat service
            async def forward_to_chat():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await chat_ws.send(data)
                except Exception as e:
                    print(f"Error forwarding to chat: {e}")
            
            async def forward_to_client():
                try:
                    async for message in chat_ws:
                        await websocket.send_text(message)
                except Exception as e:
                    print(f"Error forwarding to client: {e}")
            
            import asyncio
            await asyncio.gather(
                forward_to_chat(),
                forward_to_client()
            )
    except Exception as e:
        print(f"WebSocket proxy error: {e}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
