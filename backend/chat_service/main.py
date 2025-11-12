"""
Chat Service - FastAPI Microservice
Provides real-time chat with AI assistant, chat history, and WebSocket support
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime
import json
import logging

from database import engine, Base, get_db
from models import ChatSession, ChatMessage, ChatParticipant
from schemas import (
    ChatSessionCreate, ChatSessionResponse, 
    ChatMessageCreate, ChatMessageResponse,
    AIRequest, AIResponse
)
from websocket import ConnectionManager
from ai_service import AIService
from auth import get_current_user, get_current_user_ws

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="EV Service Center - Chat Service",
    description="Real-time chat with AI assistant and support",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize WebSocket connection manager
manager = ConnectionManager()

# Initialize AI service
ai_service = AIService()


# ==================== WebSocket Endpoints ====================

@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = None
):
    """
    WebSocket endpoint for real-time chat
    Usage: ws://localhost:8003/ws/chat/{session_id}?token=JWT_TOKEN
    """
    # Verify JWT token
    user = await get_current_user_ws(token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # Accept WebSocket connection
    await manager.connect(websocket, session_id, user['user_id'])
    
    try:
        # Send connection confirmation
        await manager.send_personal_message(
            {
                "type": "system",
                "message": "Đã kết nối tới chat service",
                "timestamp": datetime.now().isoformat()
            },
            websocket
        )
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Save message to database
            db = next(get_db())
            # Ensure message_type uses lowercase enum values to match DB constraint
            incoming_type = message_data.get('type', 'text') or 'text'
            if isinstance(incoming_type, str):
                incoming_type = incoming_type.lower()
            new_message = ChatMessage(
                session_id=session_id,
                sender_id=user['user_id'],
                sender_type=user['role'],
                message_type=incoming_type,
                content=message_data.get('content'),
                message_metadata=message_data.get('metadata', {})
            )
            # Offload DB insert to thread to avoid blocking WebSocket loop
            import asyncio as _asyncio
            def _save_message():
                db.add(new_message)
                db.commit()
                db.refresh(new_message)
                db.close()
                return new_message

            new_message = await _asyncio.to_thread(_save_message)
            
            # Broadcast message to all participants in session
            await manager.broadcast_to_session(
                session_id,
                {
                    "message_id": new_message.id,
                    "sender_id": new_message.sender_id,
                    "sender_type": new_message.sender_type,
                    "content": new_message.content,
                    "type": new_message.message_type,
                    "timestamp": new_message.created_at.isoformat(),
                    "metadata": new_message.message_metadata
                }
            )
            
            # If message is for AI assistant, get AI response
            if message_data.get('to_ai', False):
                ai_response = await ai_service.get_response(
                    message=message_data.get('content'),
                    session_id=session_id,
                    user_context=user
                )
                
                # Save AI response to database
                ai_message = ChatMessage(
                    session_id=session_id,
                    sender_id='ai_assistant',
                    sender_type='ai',
                    message_type='text',
                    content=ai_response['content'],
                    message_metadata=ai_response.get('metadata', {})
                )
                # Save AI message in background thread
                def _save_ai_message():
                    db_ai = next(get_db())
                    db_ai.add(ai_message)
                    db_ai.commit()
                    db_ai.refresh(ai_message)
                    db_ai.close()
                    return ai_message

                ai_message = await _asyncio.to_thread(_save_ai_message)
                
                # Send AI response to client
                await manager.broadcast_to_session(
                    session_id,
                    {
                        "message_id": ai_message.id,
                        "sender_id": 'ai_assistant',
                        "sender_type": 'ai',
                        "content": ai_message.content,
                        "type": ai_message.message_type,
                        "timestamp": ai_message.created_at.isoformat(),
                        "metadata": ai_message.message_metadata
                    }
                )
            
            db.close()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
        logger.info(f"User {user['user_id']} disconnected from session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket, session_id)


# ==================== REST API Endpoints ====================

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "service": "chat-service",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/sessions", response_model=ChatSessionResponse)
def create_chat_session(
    session_data: ChatSessionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new chat session
    - For customer support
    - For AI assistant
    - For technician-customer communication
    """
    # Create session
    new_session = ChatSession(
        session_type=session_data.session_type,
        title=session_data.title,
        session_metadata=session_data.metadata or {},
        created_by=current_user['user_id']
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    # Add creator as participant
    participant = ChatParticipant(
        session_id=new_session.id,
        user_id=current_user['user_id'],
        user_type=current_user['role'],
        role='creator'
    )
    db.add(participant)
    db.commit()
    
    return new_session


@app.get("/sessions", response_model=List[ChatSessionResponse])
def get_my_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all chat sessions for current user"""
    # Get sessions where user is participant
    sessions = db.query(ChatSession).join(ChatParticipant).filter(
        ChatParticipant.user_id == current_user['user_id']
    ).order_by(ChatSession.updated_at.desc()).all()
    
    return sessions


@app.get("/sessions/{session_id}", response_model=ChatSessionResponse)
def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific chat session details"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is participant
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return session


@app.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
def get_session_messages(
    session_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages from a chat session"""
    # Verify user is participant
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get messages
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.desc()).offset(offset).limit(limit).all()
    
    return messages


@app.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_message(
    session_id: str,
    message_data: ChatMessageCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message to a chat session (REST fallback)
    Prefer WebSocket for real-time messaging
    """
    # Verify user is participant
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create message
    # Normalize incoming message_type to lowercase string
    msg_type = (message_data.message_type or 'text')
    if isinstance(msg_type, str):
        msg_type = msg_type.lower()
    new_message = ChatMessage(
        session_id=session_id,
        sender_id=current_user['user_id'],
        sender_type=current_user['role'],
        message_type=msg_type,
        content=message_data.content,
        message_metadata=message_data.metadata or {}
    )
    # Offload DB write to background thread for REST fallback too
    import asyncio as _asyncio
    def _save_rest_message():
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        return new_message

    new_message = await _asyncio.to_thread(_save_rest_message)
    
    # Update session timestamp
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    session.updated_at = datetime.now()
    db.commit()
    
    return new_message


@app.post("/sessions/{session_id}/participants")
def add_participant(
    session_id: str,
    user_id: str,
    user_type: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a participant to chat session"""
    # Verify session exists and user has permission
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if requester is creator or admin
    requester = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()
    
    if not requester or (requester.role != 'creator' and current_user['role'] != 'admin'):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if user is already participant
    existing = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == user_id
    ).first()
    
    if existing:
        return {"message": "User is already a participant"}
    
    # Add participant
    participant = ChatParticipant(
        session_id=session_id,
        user_id=user_id,
        user_type=user_type,
        role='member'
    )
    db.add(participant)
    db.commit()
    
    return {"message": "Participant added successfully"}


@app.post("/ai/ask", response_model=AIResponse)
async def ask_ai(
    request: AIRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ask AI assistant a question (REST endpoint)
    For quick questions without needing a full chat session
    """
    response = await ai_service.get_response(
        message=request.message,
        session_id=request.session_id,
        user_context=current_user,
        context=request.context
    )
    
    # Optionally save to database if session_id provided
    if request.session_id:
        # Save user message
        user_message = ChatMessage(
            session_id=request.session_id,
            sender_id=current_user['user_id'],
            sender_type=current_user['role'],
            message_type='text',
            content=request.message,
            message_metadata=request.context or {}
        )
        db.add(user_message)
        
        # Save AI response
        ai_message = ChatMessage(
            session_id=request.session_id,
            sender_id='ai_assistant',
            sender_type='ai',
            message_type='text',
            content=response['content'],
            metadata=response.get('metadata', {})
        )
        db.add(ai_message)
        db.commit()
    
    return response


@app.get("/sessions/{session_id}/participants")
def get_session_participants(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all participants in a chat session"""
    # Verify user is participant
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Access denied")
    
    participants = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id
    ).all()
    
    return participants


@app.delete("/sessions/{session_id}")
def close_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Close/end a chat session"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user permissions: allow if admin or staff (support), otherwise require creator
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()

    # Admins and staff/support can close sessions even if they are not participants
    logger.info(f"close_session requested by user: {current_user}")
    logger.info(f"participant record: {participant}")

    if current_user.get('role') in ['admin', 'staff']:
        pass
    else:
        # Non-staff users must be the creator to close
        if not participant or participant.role != 'creator':
            raise HTTPException(status_code=403, detail="Permission denied")
    
    # Update session status
    session.status = 'closed'
    session.updated_at = datetime.now()
    db.commit()
    
    # Disconnect all WebSocket connections
    manager.disconnect_session(session_id)
    
    return {"message": "Session closed successfully"}


# Staff Support Endpoints
@app.get("/sessions/all/active", response_model=List[ChatSessionResponse])
def get_all_active_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active chat sessions (for staff/admin)"""
    # Only staff and admin can view all sessions
    if current_user['role'] not in ['staff', 'admin']:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get all active sessions
    sessions = db.query(ChatSession).filter(
        ChatSession.status == 'active'
    ).order_by(ChatSession.updated_at.desc()).all()
    
    return sessions


@app.post("/sessions/{session_id}/join-as-staff")
def join_session_as_staff(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow staff to join a customer chat session"""
    # Only staff and admin can join sessions
    if current_user['role'] not in ['staff', 'admin']:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Verify session exists
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if staff is already a participant
    existing = db.query(ChatParticipant).filter(
        ChatParticipant.session_id == session_id,
        ChatParticipant.user_id == current_user['user_id']
    ).first()
    
    if existing:
        return {"message": "Already joined this session", "participant_id": str(existing.id)}
    
    # Add staff as participant
    participant = ChatParticipant(
        session_id=session_id,
        user_id=current_user['user_id'],
        user_type=current_user.get('role') or 'staff',
        role='member'
    )
    db.add(participant)
    
    # Add system message
    # Use lowercase message_type to satisfy DB enum/check constraint
    system_message = ChatMessage(
        session_id=session_id,
        sender_id=current_user['user_id'],
        sender_type='staff',
        message_type='system',
        content=f"Nhân viên hỗ trợ đã tham gia cuộc trò chuyện"
    )
    db.add(system_message)
    
    db.commit()
    db.refresh(participant)
    
    return {
        "message": "Successfully joined session",
        "participant_id": str(participant.id),
        "session_id": session_id
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
