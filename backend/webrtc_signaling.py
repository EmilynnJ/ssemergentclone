import json
import uuid
import asyncio
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
import logging

logger = logging.getLogger(__name__)

class RTCRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.clients: Dict[str, WebSocket] = {}
        self.session_data: Dict = {}
        self.created_at = asyncio.get_event_loop().time()
        
    async def add_client(self, client_id: str, websocket: WebSocket):
        self.clients[client_id] = websocket
        await self.broadcast_to_others(client_id, {
            "type": "user_joined",
            "user_id": client_id,
            "room_id": self.room_id
        })
        
    async def remove_client(self, client_id: str):
        if client_id in self.clients:
            del self.clients[client_id]
            await self.broadcast_to_others(client_id, {
                "type": "user_left",
                "user_id": client_id,
                "room_id": self.room_id
            })
            
    async def broadcast_to_others(self, sender_id: str, message: dict):
        for client_id, websocket in self.clients.items():
            if client_id != sender_id:
                try:
                    await websocket.send_text(json.dumps(message))
                except:
                    # Remove disconnected clients
                    asyncio.create_task(self.remove_client(client_id))
                    
    async def send_to_user(self, target_id: str, message: dict):
        if target_id in self.clients:
            try:
                await self.clients[target_id].send_text(json.dumps(message))
                return True
            except:
                asyncio.create_task(self.remove_client(target_id))
        return False
        
    def get_client_count(self) -> int:
        return len(self.clients)

class WebRTCSignalingServer:
    def __init__(self):
        self.rooms: Dict[str, RTCRoom] = {}
        self.user_to_room: Dict[str, str] = {}
        
    async def create_room(self, room_id: str = None) -> str:
        if not room_id:
            room_id = str(uuid.uuid4())
        
        if room_id not in self.rooms:
            self.rooms[room_id] = RTCRoom(room_id)
            logger.info(f"Created WebRTC room: {room_id}")
            
        return room_id
        
    async def join_room(self, room_id: str, user_id: str, websocket: WebSocket) -> bool:
        if room_id not in self.rooms:
            await self.create_room(room_id)
            
        room = self.rooms[room_id]
        
        # Remove user from previous room if exists
        if user_id in self.user_to_room:
            await self.leave_room(user_id)
            
        await room.add_client(user_id, websocket)
        self.user_to_room[user_id] = room_id
        
        logger.info(f"User {user_id} joined room {room_id}")
        return True
        
    async def leave_room(self, user_id: str):
        if user_id in self.user_to_room:
            room_id = self.user_to_room[user_id]
            if room_id in self.rooms:
                room = self.rooms[room_id]
                await room.remove_client(user_id)
                
                # Clean up empty rooms
                if room.get_client_count() == 0:
                    del self.rooms[room_id]
                    logger.info(f"Cleaned up empty room: {room_id}")
                    
            del self.user_to_room[user_id]
            logger.info(f"User {user_id} left room {room_id}")
            
    async def handle_signaling_message(self, user_id: str, message: dict):
        if user_id not in self.user_to_room:
            return False
            
        room_id = self.user_to_room[user_id]
        room = self.rooms.get(room_id)
        
        if not room:
            return False
            
        message_type = message.get("type")
        target_id = message.get("target")
        
        # Add sender information
        message["sender"] = user_id
        message["room_id"] = room_id
        
        if message_type in ["offer", "answer", "ice-candidate"]:
            # Direct peer-to-peer signaling
            if target_id:
                return await room.send_to_user(target_id, message)
            else:
                # Broadcast to all others in room
                await room.broadcast_to_others(user_id, message)
                return True
                
        elif message_type == "call-request":
            # Call request to specific user
            if target_id:
                return await room.send_to_user(target_id, message)
                
        elif message_type == "call-response":
            # Response to call request
            if target_id:
                return await room.send_to_user(target_id, message)
                
        elif message_type == "end-call":
            # End call notification
            await room.broadcast_to_others(user_id, message)
            return True
            
        return False
        
    def get_room_info(self, room_id: str) -> Optional[dict]:
        if room_id in self.rooms:
            room = self.rooms[room_id]
            return {
                "room_id": room_id,
                "client_count": room.get_client_count(),
                "clients": list(room.clients.keys()),
                "created_at": room.created_at
            }
        return None
        
    def get_user_room(self, user_id: str) -> Optional[str]:
        return self.user_to_room.get(user_id)

# Global signaling server instance
signaling_server = WebRTCSignalingServer()

# WebRTC Configuration for TURN servers
def get_rtc_configuration():
    import os
    
    turn_servers = os.getenv("TURN_SERVERS", "relay1.expressturn.com:3480")
    turn_username = os.getenv("TURN_USERNAME", "")
    turn_credential = os.getenv("TURN_CREDENTIAL", "")
    
    ice_servers = [
        {"urls": ["stun:stun.l.google.com:19302"]},  # Free STUN server
    ]
    
    if turn_servers and turn_username and turn_credential:
        ice_servers.append({
            "urls": [f"turn:{turn_servers}"],
            "username": turn_username,
            "credential": turn_credential
        })
    
    return {
        "iceServers": ice_servers,
        "iceCandidatePoolSize": 10
    }