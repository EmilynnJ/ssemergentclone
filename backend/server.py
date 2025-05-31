import os
import asyncpg
import stripe
import json
import asyncio
from typing import Optional, Dict, Any, List, Set
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
import jwt
import requests
from contextlib import asynccontextmanager
import websockets
import uuid
import logging

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SIGNING_SECRET")

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# Database connection pool
db_pool = None

# WebSocket connections for real-time features
websocket_connections: Dict[str, WebSocket] = {}

# Session billing tracking
active_sessions: Dict[str, dict] = {}

# WebRTC Signaling Server Classes
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

# Pydantic models
class User(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "client"  # client, reader, admin
    created_at: datetime
    updated_at: datetime

class Reader(BaseModel):
    id: str
    user_id: str
    bio: Optional[str] = None
    specialties: List[str] = []
    is_online: bool = False
    chat_rate_per_minute: float = 0.0
    phone_rate_per_minute: float = 0.0
    video_rate_per_minute: float = 0.0
    availability_status: str = "offline"  # offline, online, busy
    created_at: datetime
    updated_at: datetime

class Client(BaseModel):
    id: str
    user_id: str
    balance: float = 0.0
    created_at: datetime
    updated_at: datetime

class ReadingSession(BaseModel):
    id: str
    client_id: str
    reader_id: str
    session_type: str  # chat, phone, video
    billing_type: str = "per_minute"  # per_minute, fixed_duration
    status: str  # pending, active, completed, cancelled
    rate_per_minute: Optional[float] = None
    fixed_price: Optional[float] = None
    duration_minutes: Optional[int] = None
    scheduled_time: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_minutes: float = 0.0
    total_amount: float = 0.0
    room_id: str
    created_at: datetime
    updated_at: datetime

class ReaderStatus(BaseModel):
    availability_status: str
    chat_rate_per_minute: Optional[float] = None
    phone_rate_per_minute: Optional[float] = None
    video_rate_per_minute: Optional[float] = None
    # Fixed duration pricing
    chat_15min_price: Optional[float] = None
    chat_30min_price: Optional[float] = None
    chat_60min_price: Optional[float] = None
    phone_15min_price: Optional[float] = None
    phone_30min_price: Optional[float] = None
    phone_60min_price: Optional[float] = None
    video_15min_price: Optional[float] = None
    video_30min_price: Optional[float] = None
    video_60min_price: Optional[float] = None

class SessionRequest(BaseModel):
    reader_id: str
    session_type: str  # chat, phone, video
    billing_type: str = "per_minute"  # per_minute, fixed_duration
    duration_minutes: Optional[int] = None  # for fixed_duration
    scheduled_time: Optional[datetime] = None  # for scheduled sessions

class SessionAction(BaseModel):
    session_id: str
    action: str  # accept, reject, start, end

class AddFundsRequest(BaseModel):
    amount: float  # Amount in dollars

class WebRTCMessage(BaseModel):
    type: str
    target: Optional[str] = None
    data: Optional[dict] = None

class MessageRequest(BaseModel):
    recipient_id: str
    message_text: str
    is_paid: bool = False
    price: Optional[float] = None

class LiveStreamRequest(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_time: Optional[datetime] = None

class VirtualGiftRequest(BaseModel):
    stream_id: str
    gift_type: str
    gift_value: float
    message: Optional[str] = None

class ForumPostRequest(BaseModel):
    title: str
    content: str
    category: str = "general"

class ForumReplyRequest(BaseModel):
    post_id: str
    content: str

# Database initialization
async def init_db():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    
    # Create tables if they don't exist
    async with db_pool.acquire() as conn:
        # Users table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR PRIMARY KEY,
                email VARCHAR UNIQUE NOT NULL,
                first_name VARCHAR,
                last_name VARCHAR,
                role VARCHAR DEFAULT 'client',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Readers table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS readers (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                bio TEXT,
                specialties JSONB DEFAULT '[]',
                is_online BOOLEAN DEFAULT FALSE,
                chat_rate_per_minute DECIMAL(10,2) DEFAULT 0.00,
                phone_rate_per_minute DECIMAL(10,2) DEFAULT 0.00,
                video_rate_per_minute DECIMAL(10,2) DEFAULT 0.00,
                availability_status VARCHAR DEFAULT 'offline',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Clients table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS clients (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
                balance DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Reading sessions table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS reading_sessions (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                client_id VARCHAR REFERENCES clients(id),
                reader_id VARCHAR REFERENCES readers(id),
                session_type VARCHAR NOT NULL,
                billing_type VARCHAR DEFAULT 'per_minute', -- per_minute, fixed_duration
                status VARCHAR DEFAULT 'pending',
                rate_per_minute DECIMAL(10,2),
                fixed_price DECIMAL(10,2),
                duration_minutes INTEGER,
                scheduled_time TIMESTAMP,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                total_minutes DECIMAL(10,2) DEFAULT 0.00,
                total_amount DECIMAL(10,2) DEFAULT 0.00,
                room_id VARCHAR UNIQUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Messages table for premium messaging
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                sender_id VARCHAR REFERENCES users(id),
                recipient_id VARCHAR REFERENCES users(id),
                message_text TEXT NOT NULL,
                is_paid BOOLEAN DEFAULT FALSE,
                price DECIMAL(10,2) DEFAULT 0.00,
                paid_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Live streams table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS live_streams (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                reader_id VARCHAR REFERENCES readers(id),
                title VARCHAR NOT NULL,
                description TEXT,
                status VARCHAR DEFAULT 'scheduled', -- scheduled, live, ended
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                viewer_count INTEGER DEFAULT 0,
                total_gifts DECIMAL(10,2) DEFAULT 0.00,
                stream_key VARCHAR UNIQUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Virtual gifts table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS virtual_gifts (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                stream_id VARCHAR REFERENCES live_streams(id),
                sender_id VARCHAR REFERENCES users(id),
                gift_type VARCHAR NOT NULL,
                gift_value DECIMAL(10,2) NOT NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Forum posts table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS forum_posts (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id VARCHAR REFERENCES users(id),
                title VARCHAR NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR DEFAULT 'general',
                reply_count INTEGER DEFAULT 0,
                last_reply_at TIMESTAMP,
                is_pinned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Forum replies table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS forum_replies (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
                post_id VARCHAR REFERENCES forum_posts(id) ON DELETE CASCADE,
                user_id VARCHAR REFERENCES users(id),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ''')

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    if db_pool:
        await db_pool.close()

# FastAPI app
app = FastAPI(lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Clerk authentication
async def verify_clerk_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    
    try:
        # Verify JWT token with Clerk
        # In production, you should verify the signature using Clerk's JWKS
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded_token.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {"user_id": user_id, "token_data": decoded_token}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Database helper functions
async def get_user_by_id(user_id: str) -> Optional[dict]:
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(result) if result else None

async def get_or_create_user(user_data: dict) -> dict:
    user_id = user_data["user_id"]
    token_data = user_data["token_data"]
    
    async with db_pool.acquire() as conn:
        # Check if user exists
        existing_user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        
        if existing_user:
            return dict(existing_user)
        
        # Create new user
        email = token_data.get("email", "")
        first_name = token_data.get("first_name", "")
        last_name = token_data.get("last_name", "")
        
        await conn.execute(
            """INSERT INTO users (id, email, first_name, last_name, role) 
               VALUES ($1, $2, $3, $4, 'client')""",
            user_id, email, first_name, last_name
        )
        
        # Create client profile
        await conn.execute(
            "INSERT INTO clients (user_id) VALUES ($1)",
            user_id
        )
        
        return await get_user_by_id(user_id)

# API Routes

@app.get("/api/status")
async def get_status():
    return {"status": "ok", "service": "SoulSeer API"}

@app.get("/api/health")
async def health_check():
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database connection failed")

@app.get("/api/user/profile")
async def get_user_profile(user_data: dict = Depends(verify_clerk_token)):
    user = await get_or_create_user(user_data)
    return user

@app.get("/api/readers/available")
async def get_available_readers():
    """Get all currently available readers"""
    async with db_pool.acquire() as conn:
        readers = await conn.fetch("""
            SELECT r.*, u.first_name, u.last_name, u.email 
            FROM readers r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.availability_status = 'online'
            ORDER BY r.updated_at DESC
        """)
        
        return [dict(reader) for reader in readers]

@app.get("/api/reader/profile")
async def get_reader_profile(user_data: dict = Depends(verify_clerk_token)):
    """Get reader profile for authenticated user"""
    user_id = user_data["user_id"]
    
    async with db_pool.acquire() as conn:
        reader = await conn.fetchrow("""
            SELECT r.*, u.first_name, u.last_name, u.email 
            FROM readers r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.user_id = $1
        """, user_id)
        
        if not reader:
            raise HTTPException(status_code=404, detail="Reader profile not found")
        
        return dict(reader)

@app.put("/api/reader/status")
async def update_reader_status(
    status_update: ReaderStatus,
    user_data: dict = Depends(verify_clerk_token)
):
    """Update reader availability status and rates"""
    user_id = user_data["user_id"]
    
    async with db_pool.acquire() as conn:
        # Check if reader exists
        reader = await conn.fetchrow("SELECT id FROM readers WHERE user_id = $1", user_id)
        if not reader:
            raise HTTPException(status_code=404, detail="Reader profile not found")
        
        # Build update query
        update_fields = ["availability_status = $1", "updated_at = NOW()"]
        values = [status_update.availability_status]
        param_count = 2
        
        if status_update.chat_rate_per_minute is not None:
            update_fields.append(f"chat_rate_per_minute = ${param_count}")
            values.append(status_update.chat_rate_per_minute)
            param_count += 1
            
        if status_update.phone_rate_per_minute is not None:
            update_fields.append(f"phone_rate_per_minute = ${param_count}")
            values.append(status_update.phone_rate_per_minute)
            param_count += 1
            
        if status_update.video_rate_per_minute is not None:
            update_fields.append(f"video_rate_per_minute = ${param_count}")
            values.append(status_update.video_rate_per_minute)
            param_count += 1
        
        values.append(user_id)
        
        query = f"""
            UPDATE readers 
            SET {', '.join(update_fields)}
            WHERE user_id = ${param_count}
            RETURNING *
        """
        
        updated_reader = await conn.fetchrow(query, *values)
        
        # Notify connected clients of status change
        await broadcast_reader_status_change(dict(updated_reader))
        
        return dict(updated_reader)

@app.post("/api/session/request")
async def request_reading_session(
    session_request: SessionRequest,
    user_data: dict = Depends(verify_clerk_token)
):
    """Request a reading session with a reader"""
    user_id = user_data["user_id"]
    
    async with db_pool.acquire() as conn:
        # Get client info
        client = await conn.fetchrow("SELECT * FROM clients WHERE user_id = $1", user_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client profile not found")
        
        # Get reader info and check availability
        reader = await conn.fetchrow("""
            SELECT * FROM readers 
            WHERE id = $1 AND availability_status = 'online'
        """, session_request.reader_id)
        
        if not reader:
            raise HTTPException(status_code=404, detail="Reader not available")
        
        # Determine pricing based on billing type
        if session_request.billing_type == "fixed_duration":
            if not session_request.duration_minutes or session_request.duration_minutes not in [15, 30, 60]:
                raise HTTPException(status_code=400, detail="Invalid duration. Must be 15, 30, or 60 minutes")
            
            # Get fixed price
            price_field = f"{session_request.session_type}_{session_request.duration_minutes}min_price"
            fixed_price = reader.get(price_field, 0)
            
            if fixed_price <= 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Reader does not offer {session_request.duration_minutes}-minute {session_request.session_type} sessions"
                )
            
            # Check client balance for fixed price
            if client['balance'] < fixed_price:
                raise HTTPException(status_code=400, detail="Insufficient balance")
            
            # Create session with fixed pricing
            room_id = str(uuid.uuid4())
            session_id = await conn.fetchval("""
                INSERT INTO reading_sessions 
                (client_id, reader_id, session_type, billing_type, fixed_price, 
                 duration_minutes, scheduled_time, room_id, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
                RETURNING id
            """, client['id'], session_request.reader_id, session_request.session_type, 
                session_request.billing_type, fixed_price, session_request.duration_minutes,
                session_request.scheduled_time, room_id)
        else:
            # Per-minute billing (existing logic)
            rate_field = f"{session_request.session_type}_rate_per_minute"
            rate = reader[rate_field]
            
            if rate <= 0:
                raise HTTPException(status_code=400, detail=f"Reader does not offer {session_request.session_type} sessions")
            
            # Check client balance
            if client['balance'] < rate:
                raise HTTPException(status_code=400, detail="Insufficient balance")
            
            # Create session
            room_id = str(uuid.uuid4())
            session_id = await conn.fetchval("""
                INSERT INTO reading_sessions 
                (client_id, reader_id, session_type, billing_type, rate_per_minute, 
                 scheduled_time, room_id, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                RETURNING id
            """, client['id'], session_request.reader_id, session_request.session_type,
                session_request.billing_type, rate, session_request.scheduled_time, room_id)
        
        # Get complete session info
        session = await conn.fetchrow("""
            SELECT rs.*, 
                   u1.first_name as client_first_name, u1.last_name as client_last_name,
                   u2.first_name as reader_first_name, u2.last_name as reader_last_name
            FROM reading_sessions rs
            JOIN clients c ON rs.client_id = c.id
            JOIN readers r ON rs.reader_id = r.id
            JOIN users u1 ON c.user_id = u1.id
            JOIN users u2 ON r.user_id = u2.id
            WHERE rs.id = $1
        """, session_id)
        
        # Notify reader of incoming session request
        await notify_reader_session_request(dict(session))
        
        return dict(session)

@app.post("/api/session/action")
async def session_action(
    action_data: SessionAction,
    user_data: dict = Depends(verify_clerk_token)
):
    """Handle session actions: accept, reject, start, end"""
    user_id = user_data["user_id"]
    
    async with db_pool.acquire() as conn:
        # Get session info
        session = await conn.fetchrow("""
            SELECT rs.*, 
                   c.user_id as client_user_id, r.user_id as reader_user_id,
                   u1.first_name as client_first_name, u1.last_name as client_last_name,
                   u2.first_name as reader_first_name, u2.last_name as reader_last_name
            FROM reading_sessions rs
            JOIN clients c ON rs.client_id = c.id
            JOIN readers r ON rs.reader_id = r.id
            JOIN users u1 ON c.user_id = u1.id
            JOIN users u2 ON r.user_id = u2.id
            WHERE rs.id = $1
        """, action_data.session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_dict = dict(session)
        
        if action_data.action == "accept":
            # Only reader can accept
            if user_id != session_dict['reader_user_id']:
                raise HTTPException(status_code=403, detail="Only the reader can accept the session")
            
            if session_dict['status'] != 'pending':
                raise HTTPException(status_code=400, detail="Session is not pending")
            
            # Update session status to active and set start time
            await conn.execute("""
                UPDATE reading_sessions 
                SET status = 'active', start_time = NOW(), updated_at = NOW()
                WHERE id = $1
            """, action_data.session_id)
            
            # Start billing
            await start_session_billing(action_data.session_id, session_dict)
            
            # Create WebRTC room
            await signaling_server.create_room(session_dict['room_id'])
            
            # Notify client
            await notify_session_update(session_dict['client_user_id'], {
                "type": "session_accepted",
                "session_id": action_data.session_id,
                "room_id": session_dict['room_id']
            })
            
        elif action_data.action == "reject":
            # Only reader can reject
            if user_id != session_dict['reader_user_id']:
                raise HTTPException(status_code=403, detail="Only the reader can reject the session")
                
            if session_dict['status'] != 'pending':
                raise HTTPException(status_code=400, detail="Session is not pending")
            
            await conn.execute("""
                UPDATE reading_sessions 
                SET status = 'cancelled', updated_at = NOW()
                WHERE id = $1
            """, action_data.session_id)
            
            # Notify client
            await notify_session_update(session_dict['client_user_id'], {
                "type": "session_rejected",
                "session_id": action_data.session_id
            })
            
        elif action_data.action == "end":
            # Either party can end the session
            if user_id not in [session_dict['client_user_id'], session_dict['reader_user_id']]:
                raise HTTPException(status_code=403, detail="Unauthorized to end this session")
                
            if session_dict['status'] != 'active':
                raise HTTPException(status_code=400, detail="Session is not active")
            
            # End billing and calculate final amount
            final_session = await end_session_billing(action_data.session_id, session_dict)
            
            # Notify both parties
            other_user = session_dict['reader_user_id'] if user_id == session_dict['client_user_id'] else session_dict['client_user_id']
            await notify_session_update(other_user, {
                "type": "session_ended",
                "session_id": action_data.session_id,
                "total_amount": final_session['total_amount'],
                "total_minutes": final_session['total_minutes']
            })
            
            return final_session
        
        return {"status": "success", "action": action_data.action}

@app.post("/api/payment/add-funds")
async def add_funds(
    funds_request: AddFundsRequest,
    user_data: dict = Depends(verify_clerk_token)
):
    """Add funds to client account using Stripe"""
    user_id = user_data["user_id"]
    
    try:
        # Create Stripe PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=int(funds_request.amount * 100),  # Convert to cents
            currency='usd',
            metadata={
                'user_id': user_id,
                'type': 'add_funds'
            }
        )
        
        return {
            "client_secret": payment_intent.client_secret,
            "amount": funds_request.amount
        }
    except Exception as e:
        logger.error(f"Error creating payment intent: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to create payment intent")

@app.post("/api/payment/confirm")
async def confirm_payment(
    background_tasks: BackgroundTasks,
    payment_intent_id: str,
    user_data: dict = Depends(verify_clerk_token)
):
    """Confirm payment and add funds to account"""
    user_id = user_data["user_id"]
    
    try:
        # Retrieve payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status == 'succeeded':
            amount = payment_intent.amount / 100  # Convert from cents
            
            async with db_pool.acquire() as conn:
                # Add funds to client account
                await conn.execute("""
                    UPDATE clients 
                    SET balance = balance + $1, updated_at = NOW()
                    WHERE user_id = $2
                """, amount, user_id)
                
                # Get updated balance
                new_balance = await conn.fetchval("""
                    SELECT balance FROM clients WHERE user_id = $1
                """, user_id)
                
                return {
                    "status": "success",
                    "amount_added": amount,
                    "new_balance": float(new_balance)
                }
        else:
            raise HTTPException(status_code=400, detail="Payment not successful")
            
    except Exception as e:
        logger.error(f"Error confirming payment: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to confirm payment")

@app.get("/api/webrtc/config")
async def get_webrtc_config():
    """Get WebRTC configuration including TURN servers"""
    return get_rtc_configuration()

# WebRTC WebSocket endpoint
@app.websocket("/api/webrtc/{room_id}")
async def webrtc_signaling(websocket: WebSocket, room_id: str, user_id: str):
    """WebRTC signaling endpoint"""
    await websocket.accept()
    
    try:
        # Join the signaling room
        await signaling_server.join_room(room_id, user_id, websocket)
        
        while True:
            # Receive signaling messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle signaling message
            await signaling_server.handle_signaling_message(user_id, message)
            
    except WebSocketDisconnect:
        await signaling_server.leave_room(user_id)
    except Exception as e:
        logger.error(f"WebRTC signaling error: {str(e)}")
        await signaling_server.leave_room(user_id)

# WebSocket for real-time notifications
@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()
    websocket_connections[user_id] = websocket
    
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Handle ping/pong or other messages
            await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        if user_id in websocket_connections:
            del websocket_connections[user_id]

# Helper functions for WebSocket notifications
async def broadcast_reader_status_change(reader_data: dict):
    """Notify all connected clients of reader status change"""
    message = {
        "type": "reader_status_change",
        "data": reader_data
    }
    
    # Send to all connected clients
    for user_id, websocket in websocket_connections.items():
        try:
            await websocket.send_text(json.dumps(message))
        except:
            # Remove stale connections
            del websocket_connections[user_id]

async def notify_reader_session_request(session_data: dict):
    """Notify reader of incoming session request"""
    reader_user_id = await get_reader_user_id(session_data['reader_id'])
    
    if reader_user_id and reader_user_id in websocket_connections:
        message = {
            "type": "session_request",
            "data": session_data
        }
        try:
            await websocket_connections[reader_user_id].send_text(json.dumps(message))
        except:
            # Remove stale connection
            del websocket_connections[reader_user_id]

async def get_reader_user_id(reader_id: str) -> Optional[str]:
    """Get user_id for a reader"""
    async with db_pool.acquire() as conn:
        result = await conn.fetchval("SELECT user_id FROM readers WHERE id = $1", reader_id)
        return result

# Session billing functions
async def start_session_billing(session_id: str, session_data: dict):
    """Start billing for an active session"""
    active_sessions[session_id] = {
        "session_id": session_id,
        "client_id": session_data['client_id'],
        "reader_id": session_data['reader_id'],
        "rate_per_minute": session_data['rate_per_minute'],
        "start_time": datetime.now(),
        "last_bill_time": datetime.now(),
        "total_billed": 0.0
    }
    
    # Start background billing task
    asyncio.create_task(bill_session_minutes(session_id))
    logger.info(f"Started billing for session {session_id}")

async def end_session_billing(session_id: str, session_data: dict) -> dict:
    """End billing for a session and finalize charges"""
    if session_id in active_sessions:
        billing_data = active_sessions[session_id]
        end_time = datetime.now()
        
        # Calculate final minutes and amount
        total_seconds = (end_time - billing_data['start_time']).total_seconds()
        total_minutes = total_seconds / 60.0
        total_amount = total_minutes * billing_data['rate_per_minute']
        
        # Apply any remaining partial minute billing
        await bill_partial_minute(session_id, end_time)
        
        async with db_pool.acquire() as conn:
            # Update session with final amounts
            await conn.execute("""
                UPDATE reading_sessions 
                SET status = 'completed', end_time = $1, total_minutes = $2, 
                    total_amount = $3, updated_at = NOW()
                WHERE id = $4
            """, end_time, total_minutes, total_amount, session_id)
            
            # Process revenue split (70% to reader, 30% to platform)
            reader_amount = total_amount * 0.7
            
            # Add earnings to reader (implement reader earnings table if needed)
            # For now, just log the transaction
            logger.info(f"Session {session_id} completed: ${total_amount:.2f} total, ${reader_amount:.2f} to reader")
            
            # Get updated session data
            updated_session = await conn.fetchrow("""
                SELECT * FROM reading_sessions WHERE id = $1
            """, session_id)
        
        # Clean up active session
        del active_sessions[session_id]
        
        return dict(updated_session)
    
    # If session wasn't actively billed, just mark as completed
    async with db_pool.acquire() as conn:
        await conn.execute("""
            UPDATE reading_sessions 
            SET status = 'completed', end_time = NOW(), updated_at = NOW()
            WHERE id = $1
        """, session_id)
        
        updated_session = await conn.fetchrow("""
            SELECT * FROM reading_sessions WHERE id = $1
        """, session_id)
        
        return dict(updated_session)

async def bill_session_minutes(session_id: str):
    """Background task to bill session per minute"""
    while session_id in active_sessions:
        try:
            await asyncio.sleep(60)  # Wait 1 minute
            
            if session_id not in active_sessions:
                break
                
            billing_data = active_sessions[session_id]
            current_time = datetime.now()
            
            # Bill for the minute
            await bill_partial_minute(session_id, current_time)
            
        except Exception as e:
            logger.error(f"Error in billing task for session {session_id}: {str(e)}")
            break

async def bill_partial_minute(session_id: str, current_time: datetime):
    """Bill for a partial or full minute"""
    if session_id not in active_sessions:
        return
        
    billing_data = active_sessions[session_id]
    rate_per_minute = billing_data['rate_per_minute']
    
    async with db_pool.acquire() as conn:
        # Check client balance
        client = await conn.fetchrow("""
            SELECT balance FROM clients 
            WHERE id = $1
        """, billing_data['client_id'])
        
        if not client or client['balance'] < rate_per_minute:
            # Insufficient funds - end session
            logger.warning(f"Insufficient funds for session {session_id}, ending session")
            
            # End the session due to insufficient funds
            await conn.execute("""
                UPDATE reading_sessions 
                SET status = 'completed', end_time = $1, updated_at = NOW()
                WHERE id = $2
            """, current_time, session_id)
            
            # Notify both parties
            session_info = await conn.fetchrow("""
                SELECT rs.*, c.user_id as client_user_id, r.user_id as reader_user_id
                FROM reading_sessions rs
                JOIN clients c ON rs.client_id = c.id
                JOIN readers r ON rs.reader_id = r.id
                WHERE rs.id = $1
            """, session_id)
            
            if session_info:
                await notify_session_update(session_info['client_user_id'], {
                    "type": "session_ended",
                    "reason": "insufficient_funds",
                    "session_id": session_id
                })
                await notify_session_update(session_info['reader_user_id'], {
                    "type": "session_ended", 
                    "reason": "insufficient_funds",
                    "session_id": session_id
                })
            
            # Remove from active sessions
            if session_id in active_sessions:
                del active_sessions[session_id]
            return
        
        # Deduct the minute charge
        await conn.execute("""
            UPDATE clients 
            SET balance = balance - $1, updated_at = NOW()
            WHERE id = $2
        """, rate_per_minute, billing_data['client_id'])
        
        # Update billing data
        billing_data['total_billed'] += rate_per_minute
        billing_data['last_bill_time'] = current_time
        
        logger.info(f"Billed ${rate_per_minute:.2f} for session {session_id}")

async def notify_session_update(user_id: str, message: dict):
    """Notify a user about session updates"""
    if user_id in websocket_connections:
        try:
            await websocket_connections[user_id].send_text(json.dumps(message))
        except:
            # Remove stale connection
            if user_id in websocket_connections:
                del websocket_connections[user_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
