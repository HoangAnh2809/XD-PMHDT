# Mã nguồn thực tế từ backend/chat_service/websocket.py
# WebSocket logic for chat service (placeholder)
from fastapi import WebSocket

async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message received in room {room_id}: {data}")