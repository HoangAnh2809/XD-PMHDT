"""
WebSocket connection manager for real-time chat
"""
from fastapi import WebSocket
from typing import Dict, List, Set
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for chat sessions
    Supports multiple sessions and broadcasting
    """
    
    def __init__(self):
        # Dictionary: session_id -> list of websocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        
        # Dictionary: websocket -> (session_id, user_id)
        self.connection_info: Dict[WebSocket, tuple] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str, user_id: str):
        """
        Accept WebSocket connection and add to session
        """
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        
        self.active_connections[session_id].append(websocket)
        self.connection_info[websocket] = (session_id, user_id)
        
        logger.info(f"User {user_id} connected to session {session_id}")
        logger.info(f"Total connections in session {session_id}: {len(self.active_connections[session_id])}")
    
    def disconnect(self, websocket: WebSocket, session_id: str):
        """
        Remove WebSocket connection from session
        """
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                
                # Clean up empty session lists
                if len(self.active_connections[session_id]) == 0:
                    del self.active_connections[session_id]
        
        if websocket in self.connection_info:
            user_id = self.connection_info[websocket][1]
            del self.connection_info[websocket]
            logger.info(f"User {user_id} disconnected from session {session_id}")
    
    def disconnect_session(self, session_id: str):
        """
        Disconnect all connections in a session
        """
        if session_id in self.active_connections:
            connections = self.active_connections[session_id].copy()
            for websocket in connections:
                self.disconnect(websocket, session_id)
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Send message to a specific WebSocket connection
        """
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception as e:
            logger.error(f"Error sending personal message: {str(e)}")
    
    async def broadcast_to_session(self, session_id: str, message: dict):
        """
        Broadcast message to all connections in a session
        """
        if session_id not in self.active_connections:
            logger.warning(f"No active connections for session {session_id}")
            return
        
        disconnected = []
        # Send to all websockets concurrently to avoid slow sequential awaits
        send_tasks = []
        for websocket in list(self.active_connections[session_id]):
            async def _send(ws):
                try:
                    await ws.send_text(json.dumps(message, default=str))
                except Exception as e:
                    logger.error(f"Error broadcasting to session {session_id}: {str(e)}")
                    return ws
                return None

            send_tasks.append(_send(websocket))

        results = await asyncio.gather(*send_tasks, return_exceptions=False)
        for res in results:
            if res is not None:
                disconnected.append(res)
        
        # Clean up disconnected websockets
        for websocket in disconnected:
            self.disconnect(websocket, session_id)
    
    async def broadcast_to_all(self, message: dict):
        """
        Broadcast message to all active connections across all sessions
        """
        # Kick off broadcasts concurrently across sessions
        tasks = [self.broadcast_to_session(session_id, message) for session_id in list(self.active_connections.keys())]
        await asyncio.gather(*tasks)
    
    def get_session_users(self, session_id: str) -> Set[str]:
        """
        Get list of user IDs currently connected to a session
        """
        users = set()
        
        if session_id in self.active_connections:
            for websocket in self.active_connections[session_id]:
                if websocket in self.connection_info:
                    users.add(self.connection_info[websocket][1])
        
        return users
    
    def get_connection_count(self, session_id: str) -> int:
        """
        Get number of active connections in a session
        """
        if session_id in self.active_connections:
            return len(self.active_connections[session_id])
        return 0
    
    def get_total_connections(self) -> int:
        """
        Get total number of active connections across all sessions
        """
        total = 0
        for connections in self.active_connections.values():
            total += len(connections)
        return total
