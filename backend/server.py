import os
import asyncpg
import stripe
import json
import asyncio
from typing import Optional, Dict, Any, List, Set
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
import jwt
import requests
from passlib.context import CryptContext
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
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") # New
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

# Security settings and helper functions (JWT and password hashing)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-for-dev-only") # Ensure this is set in .env for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week (adjust as needed)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(security)) -> User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = await get_user_by_id(user_id) # This uses the existing helper
    if user is None:
        raise credentials_exception
    # Ensure get_user_by_id returns a Pydantic User model or convert it
    # For now, assuming get_user_by_id returns a dict that can be parsed into User model
    # If get_user_by_id returns a dict:
    try:
        user_model = User(**user)
        return user_model
    except Exception: # Handle potential Pydantic validation error
        raise credentials_exception


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

# New Pydantic models for auth
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: str

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

class Client(BaseModel): # This is the existing Client model, used for DB representation
    id: str # This is the client specific ID (PK of clients table)
    user_id: str # FK to users table
    balance: float = 0.0
    created_at: datetime
    updated_at: datetime

# New Pydantic model for the /api/client/profile response
class ClientProfile(BaseModel):
    user_id: str # This is users.id
    email: EmailStr # from users table
    first_name: Optional[str] = None # from users table
    last_name: Optional[str] = None # from users table
    role: str # from users table
    balance: float # from clients table
    client_created_at: datetime # from clients table (to distinguish from user's created_at)
    client_updated_at: datetime # from clients table

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
    billing_duration_seconds: Optional[int] = None # Stores total seconds for billing
    created_at: datetime
    updated_at: datetime

# For displaying session details with participant names
class SessionDetailsBase(ReadingSession):
    pass # Inherits all fields from ReadingSession

class SessionDetailsClientView(SessionDetailsBase):
    reader_first_name: Optional[str] = None
    reader_last_name: Optional[str] = None
    # Combined field for convenience, can be constructed on frontend too
    reader_name: Optional[str] = None

class SessionDetailsReaderView(SessionDetailsBase):
    client_first_name: Optional[str] = None
    client_last_name: Optional[str] = None
    # Combined field
    client_name: Optional[str] = None

class AdminReaderView(User): # Inherits from User, adds reader-specific fields
    reader_db_id: str # Actual ID from readers table
    bio: Optional[str] = None
    specialties: List[str] = []
    is_online: bool = False
    chat_rate_per_minute: Optional[Decimal] = None
    phone_rate_per_minute: Optional[Decimal] = None
    video_rate_per_minute: Optional[Decimal] = None
    availability_status: str
    application_status: str # From readers table
    reader_created_at: datetime # readers.created_at
    reader_updated_at: datetime # readers.updated_at


class ReaderEarningsSummary(BaseModel):
    pending_balance: Decimal = Decimal('0.00')
    paid_out_total: Decimal = Decimal('0.00')
    total_earned_lifetime: Decimal = Decimal('0.00')
    recent_earnings: List[Dict[str, Any]] = [] # e.g. last 5-10 earnings records

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
    action: str  # accept, reject, start, end, cancel_client (ensure cancel_client is handled or removed if not)

class ReaderApplicationUpdate(BaseModel):
    status: str # e.g., 'active', 'suspended', 'pending_approval'

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
                hashed_password TEXT NOT NULL,
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
                application_status VARCHAR(20) DEFAULT 'pending_approval', -- pending_approval, active, suspended
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
                billing_duration_seconds INTEGER, -- For precise billing
                total_minutes DECIMAL(10,2) DEFAULT 0.00, -- Kept for now, or can be calculated from seconds
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

        # Reader earnings table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS reader_earnings (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                reader_id TEXT REFERENCES readers(id) ON DELETE CASCADE,
                session_id TEXT REFERENCES reading_sessions(id) ON DELETE CASCADE,
                total_session_amount DECIMAL(10,2) NOT NULL,
                amount_earned DECIMAL(10,2) NOT NULL,
                payout_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, paid, failed
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        ''')
        await conn.execute('''CREATE INDEX IF NOT EXISTS idx_reader_earnings_reader_id ON reader_earnings(reader_id);''')
        await conn.execute('''CREATE INDEX IF NOT EXISTS idx_reader_earnings_session_id ON reader_earnings(session_id);''')

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
# Get CORS origins from environment variable, defaulting to frontend dev server
# and a placeholder for the Vercel frontend URL.
# The user will set CORS_ALLOWED_ORIGINS in Vercel environment variables.
# Example: "http://localhost:3000,https://your-frontend-deployment.vercel.app"

default_origins = [
    "http://localhost:3000", # For local frontend development
    "http://127.0.0.1:3000", # Another local variant
    # Add any other known development origins if necessary
]

cors_env_origins = os.getenv("CORS_ALLOWED_ORIGINS")
if cors_env_origins:
    allowed_origins = [origin.strip() for origin in cors_env_origins.split(',')]
else:
    # In a Vercel deployment, CORS_ALLOWED_ORIGINS should ideally be set.
    # If not set, for local development, it falls back to default_origins.
    # For production on Vercel, if this var isn't set, it might block frontend if not covered by "*"
    # However, the plan is to set this in Vercel explicitly.
    # If you want to default to ["*"] in production if the env var is missing, that's an alternative.
    # For now, sticking to defined list or specific localhost defaults.
    allowed_origins = default_origins
    logger.warning("CORS_ALLOWED_ORIGINS not set, defaulting to localhost development origins. Set this in Vercel for production.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, # Use the dynamically set list
    allow_credentials=True,
    allow_methods=["*"], # Or specify methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers=["*"], # Or specify headers: ["Authorization", "Content-Type"]
)

# Security
security = HTTPBearer()

# Database helper functions
async def get_user_by_id(user_id: str) -> Optional[dict]:
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(result) if result else None

async def get_client_id_from_user_id(user_id: str, conn) -> Optional[str]:
    """Fetch client_id from user_id."""
    return await conn.fetchval("SELECT id FROM clients WHERE user_id = $1", user_id)

async def get_reader_id_from_user_id(user_id: str, conn) -> Optional[str]:
    """Fetch reader_id from user_id."""
    return await conn.fetchval("SELECT id FROM readers WHERE user_id = $1", user_id)

async def get_user_id_from_client_id(client_id: str, conn) -> Optional[str]:
    """Fetch user_id from client_id."""
    return await conn.fetchval("SELECT user_id FROM clients WHERE id = $1", client_id)

async def get_user_id_from_reader_id(reader_id: str, conn) -> Optional[str]:
    """Fetch user_id from reader_id."""
    return await conn.fetchval("SELECT user_id FROM readers WHERE id = $1", reader_id)

# API Routes

# Auth Endpoints
@app.post("/api/auth/signup", response_model=Token)
async def signup(user_create: UserCreate):
    async with db_pool.acquire() as conn:
        # Check if user email already exists
        existing_user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", user_create.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = get_password_hash(user_create.password)
        user_id = str(uuid.uuid4())
        role = "client" # Default role

        # Insert into users table
        await conn.execute(
            """INSERT INTO users (id, email, hashed_password, role)
               VALUES ($1, $2, $3, $4)""",
            user_id, user_create.email, hashed_password, role
        )
        
        # Insert into clients table
        await conn.execute(
            "INSERT INTO clients (user_id, balance) VALUES ($1, $2)",
            user_id, 0.0
        )
        
        access_token = create_access_token(data={"sub": user_id, "role": role})
        return Token(access_token=access_token, token_type="bearer", role=role, user_id=user_id)

@app.post("/api/auth/signin", response_model=Token)
async def signin(user_login: UserLogin):
    async with db_pool.acquire() as conn:
        user_record = await conn.fetchrow("SELECT * FROM users WHERE email = $1", user_login.email)

        if not user_record:
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        if not verify_password(user_login.password, user_record["hashed_password"]):
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        access_token = create_access_token(data={"sub": user_record["id"], "role": user_record["role"]})
        return Token(access_token=access_token, token_type="bearer", role=user_record["role"], user_id=user_record["id"])

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
async def get_user_profile(current_user: User = Depends(get_current_user)):
    # The user object is already fetched and validated by get_current_user
    # It's also already a Pydantic User model
    return current_user

@app.get("/api/client/profile", response_model=ClientProfile)
async def get_client_profile(current_user: User = Depends(get_current_user)):
    """
    Get client-specific profile information, including balance.
    """
    if current_user.role not in ["client", "admin"]: # Or just allow 'client'
        raise HTTPException(status_code=403, detail="User is not a client")

    async with db_pool.acquire() as conn:
        client_record = await conn.fetchrow(
            "SELECT user_id, balance, created_at, updated_at FROM clients WHERE user_id = $1",
            current_user.id
        )
        if not client_record:
            # This case should ideally not happen if a client record is created upon user signup
            raise HTTPException(status_code=404, detail="Client profile not found for this user")

        return ClientProfile(
            user_id=current_user.id,
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            role=current_user.role,
            balance=client_record['balance'],
            client_created_at=client_record['created_at'],
            client_updated_at=client_record['updated_at']
        )

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
async def get_reader_profile(current_user: User = Depends(get_current_user)):
    """Get reader profile for authenticated user"""
    user_id = current_user.id
    
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

@app.get("/api/client/bookings", response_model=List[ReadingSession])
async def get_client_bookings(current_user: User = Depends(get_current_user)):
    """Fetch all past and upcoming bookings for the current client."""
    async with db_pool.acquire() as conn:
        client_id_db = await get_client_id_from_user_id(current_user.id, conn)
        if not client_id_db:
            # This should not happen if client profile is created on signup
            raise HTTPException(status_code=404, detail="Client profile not found.")

        # Query needs to join with readers and users table to get reader's name.
        # For simplicity, if ReadingSession model is not designed for joined data,
        # we might return a list of dicts or a custom model.
        # Assuming ReadingSession can handle the fields for now, or we adjust the query.
        # The current ReadingSession model might not have fields for reader_name.
        # Let's return the raw records for now and plan to refine the response model if needed.

        sessions_records = await conn.fetch(
            """
            SELECT rs.*,
                   r_user.first_name AS reader_first_name,
                   r_user.last_name AS reader_last_name
            FROM reading_sessions rs
            JOIN readers r_table ON rs.reader_id = r_table.id
            JOIN users r_user ON r_table.user_id = r_user.id
            WHERE rs.client_id = $1
            ORDER BY rs.created_at DESC
            """,
            client_id_db
        )
        # Convert records to ReadingSession Pydantic model, potentially adding extra fields if necessary
        # For now, if ReadingSession doesn't support reader_first_name directly, this will need adjustment.
        # A simple approach is to return List[Dict] or create a new response model.
        # Given the current structure, returning List[Dict] is safer.

        # Modify response to include reader name, this means response_model=List[ReadingSession] might be an issue
        # For now, let's manually construct what we need if ReadingSession model is strict

        bookings = []
        for record in sessions_records:
            booking_dict = dict(record)
            # Add reader name to the dictionary if not part of ReadingSession model
            booking_dict['reader_name'] = f"{record['reader_first_name'] or ''} {record['reader_last_name'] or ''}".strip()
            bookings.append(booking_dict)
        # Now, construct the Pydantic models
        detailed_bookings = []
        for record in sessions_records:
            booking_detail = SessionDetailsClientView(
                **record, # Spread the original session fields
                reader_first_name=record['reader_first_name'],
                reader_last_name=record['reader_last_name'],
                reader_name=f"{record['reader_first_name'] or ''} {record['reader_last_name'] or ''}".strip()
            )
            detailed_bookings.append(booking_detail)
        return detailed_bookings

@app.get("/api/client/messages")
async def get_client_messages(current_user: User = Depends(get_current_user)):
    """Placeholder for fetching client messages."""
    # In a real implementation, this would query a messages table
    # based on current_user.id
    logger.info(f"Client messages endpoint called by user: {current_user.id}")
    return {"message": "Messaging feature coming soon.", "sample_messages": []}

@app.get("/api/reader/sessions/queue", response_model=List[SessionDetailsReaderView])
async def get_reader_sessions_queue(current_user: User = Depends(get_current_user)):
    """Fetch pending and active sessions for the current reader."""
    if current_user.role != 'reader' and current_user.role != 'admin': # Admin can also see for debugging?
        raise HTTPException(status_code=403, detail="User is not a reader.")

    async with db_pool.acquire() as conn:
        reader_id_db = await get_reader_id_from_user_id(current_user.id, conn)
        if not reader_id_db:
            raise HTTPException(status_code=404, detail="Reader profile not found for current user.")

        sessions_records = await conn.fetch(
            """
            SELECT rs.*,
                   u_client.first_name AS client_first_name,
                   u_client.last_name AS client_last_name
            FROM reading_sessions rs
            JOIN clients c ON rs.client_id = c.id
            JOIN users u_client ON c.user_id = u_client.id
            WHERE rs.reader_id = $1 AND rs.status IN ('pending', 'active')
            ORDER BY rs.created_at ASC
            """,
            reader_id_db
        )

        detailed_sessions = []
        for record in sessions_records:
            session_detail = SessionDetailsReaderView(
                **record,
                client_first_name=record['client_first_name'],
                client_last_name=record['client_last_name'],
                client_name=f"{record['client_first_name'] or ''} {record['client_last_name'] or ''}".strip()
            )
            detailed_sessions.append(session_detail)
        return detailed_sessions

@app.get("/api/reader/earnings", response_model=ReaderEarningsSummary)
async def get_reader_earnings(current_user: User = Depends(get_current_user)):
    """Fetch earnings summary and recent earnings for the current reader."""
    if current_user.role != 'reader' and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="User is not a reader.")

    async with db_pool.acquire() as conn:
        reader_id_db = await get_reader_id_from_user_id(current_user.id, conn)
        if not reader_id_db:
            raise HTTPException(status_code=404, detail="Reader profile not found for current user.")

        pending_balance_record = await conn.fetchrow(
            "SELECT COALESCE(SUM(amount_earned), 0.00) AS total FROM reader_earnings WHERE reader_id = $1 AND payout_status = 'pending'",
            reader_id_db
        )
        paid_out_total_record = await conn.fetchrow(
            "SELECT COALESCE(SUM(amount_earned), 0.00) AS total FROM reader_earnings WHERE reader_id = $1 AND payout_status = 'paid'",
            reader_id_db
        )
        total_earned_lifetime_record = await conn.fetchrow(
            "SELECT COALESCE(SUM(amount_earned), 0.00) AS total FROM reader_earnings WHERE reader_id = $1",
            reader_id_db
        )

        recent_earnings_records = await conn.fetch(
            """
            SELECT re.session_id, re.total_session_amount, re.amount_earned, re.payout_status, re.created_at,
                   rs.session_type, u_client.first_name as client_first_name
            FROM reader_earnings re
            JOIN reading_sessions rs ON re.session_id = rs.id
            JOIN clients c ON rs.client_id = c.id
            JOIN users u_client ON c.user_id = u_client.id
            WHERE re.reader_id = $1
            ORDER BY re.created_at DESC
            LIMIT 10
            """,
            reader_id_db
        )

        recent_earnings_list = [
            {
                "session_id": r['session_id'],
                "session_type": r['session_type'],
                "client_name": r['client_first_name'] or "N/A",
                "total_session_amount": r['total_session_amount'],
                "amount_earned": r['amount_earned'],
                "payout_status": r['payout_status'],
                "earned_at": r['created_at'] # This is earnings record creation time
            } for r in recent_earnings_records
        ]

        return ReaderEarningsSummary(
            pending_balance=pending_balance_record['total'] if pending_balance_record else Decimal('0.00'),
            paid_out_total=paid_out_total_record['total'] if paid_out_total_record else Decimal('0.00'),
            total_earned_lifetime=total_earned_lifetime_record['total'] if total_earned_lifetime_record else Decimal('0.00'),
            recent_earnings=recent_earnings_list
        )

@app.get("/api/admin/readers", response_model=List[AdminReaderView])
async def admin_get_readers(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Insufficient privileges.")

    async with db_pool.acquire() as conn:
        reader_records = await conn.fetch(
            """
            SELECT u.*, r.id as reader_db_id, r.bio, r.specialties, r.is_online,
                   r.chat_rate_per_minute, r.phone_rate_per_minute, r.video_rate_per_minute,
                   r.availability_status, r.application_status,
                   r.created_at as reader_created_at, r.updated_at as reader_updated_at
            FROM users u
            JOIN readers r ON u.id = r.user_id
            WHERE u.role = 'reader'
            ORDER BY u.created_at DESC
            """
            # Consider adding WHERE u.role = 'reader' if users table might have other roles that somehow have reader entries
        )
        return [AdminReaderView(**record) for record in reader_records]

@app.put("/api/admin/reader/{target_user_id}/status", response_model=AdminReaderView)
async def admin_update_reader_application_status(
    target_user_id: str,
    status_update: ReaderApplicationUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Insufficient privileges.")

    async with db_pool.acquire() as conn:
        # Check if the target user is actually a reader
        reader_profile_check = await conn.fetchrow("SELECT id FROM readers WHERE user_id = $1", target_user_id)
        if not reader_profile_check:
            raise HTTPException(status_code=404, detail=f"Reader profile not found for user ID: {target_user_id}")

        reader_db_id = reader_profile_check['id']

        await conn.execute(
            "UPDATE readers SET application_status = $1, updated_at = NOW() WHERE id = $2",
            status_update.status, reader_db_id
        )

        # Fetch the updated full profile to return
        updated_reader_record = await conn.fetchrow(
             """
            SELECT u.*, r.id as reader_db_id, r.bio, r.specialties, r.is_online,
                   r.chat_rate_per_minute, r.phone_rate_per_minute, r.video_rate_per_minute,
                   r.availability_status, r.application_status,
                   r.created_at as reader_created_at, r.updated_at as reader_updated_at
            FROM users u
            JOIN readers r ON u.id = r.user_id
            WHERE u.id = $1 AND r.id = $2
            """, target_user_id, reader_db_id
        )
        if not updated_reader_record:
             raise HTTPException(status_code=404, detail="Failed to fetch updated reader profile.") # Should not happen

        return AdminReaderView(**updated_reader_record)

@app.get("/api/admin/logs")
async def admin_get_logs(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Insufficient privileges.")

    # In a real application, this would parse log files or query a logging database.
    logger.info(f"Admin logs accessed by {current_user.email}")
    return [
        {"timestamp": datetime.utcnow().isoformat(), "level": "INFO", "message": "Mock log: User X signed up."},
        {"timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat(), "level": "WARNING", "message": "Mock log: Payment attempt failed for user Y."},
        {"timestamp": (datetime.utcnow() - timedelta(minutes=10)).isoformat(), "level": "ERROR", "message": "Mock log: Unhandled exception in session processing Z."}
    ]

@app.put("/api/reader/status")
async def update_reader_status(
    status_update: ReaderStatus,
    current_user: User = Depends(get_current_user)
):
    """Update reader availability status and rates"""
    user_id = current_user.id
    
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

# Session request endpoint removed, will be re-added with new logic. # This comment is from previous deletion.
# The /api/session/request endpoint is already added above this section.

@app.post("/api/session/action", response_model=ReadingSession)
async def session_action(
    action_data: SessionAction,
    current_user: User = Depends(get_current_user)
):
    """Handle session actions: accept, reject, end, cancel_client."""
    async with db_pool.acquire() as conn:
        # Fetch session details along with client's user_id and reader's user_id for notifications
        session_record = await conn.fetchrow(
            """
            SELECT rs.*, c.user_id AS client_user_id, r.user_id AS reader_user_id
            FROM reading_sessions rs
            JOIN clients c ON rs.client_id = c.id
            JOIN readers r ON rs.reader_id = r.id
            WHERE rs.id = $1
            """,
            action_data.session_id
        )

        if not session_record:
            raise HTTPException(status_code=404, detail="Session not found")

        session = ReadingSession(**session_record) # Convert row to Pydantic model for easier access
        client_user_id = session_record['client_user_id']
        reader_user_id = session_record['reader_user_id']
        updated_session_data_dict = None # To store the dict from fetchrow before converting to Pydantic

        if action_data.action == "accept":
            if current_user.id != reader_user_id or session.status != 'pending':
                raise HTTPException(status_code=403, detail="Action not allowed or invalid session state.")
            
            start_time_utc = datetime.utcnow() # Use UTC for server-side timestamps
            updated_session_data_dict = await conn.fetchrow(
                "UPDATE reading_sessions SET status = 'active', start_time = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
                start_time_utc, session.id
            )
            await signaling_server.create_room(session.room_id) # Ensure WebRTC room is ready
            await notify_user(client_user_id, {"type": "session_accepted", "session_id": session.id, "room_id": session.room_id, "reader_name": current_user.first_name or current_user.email})

        elif action_data.action == "reject":
            if current_user.id != reader_user_id or session.status != 'pending':
                raise HTTPException(status_code=403, detail="Action not allowed or invalid session state.")
            updated_session_data_dict = await conn.fetchrow(
                "UPDATE reading_sessions SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *", session.id
            )
            await notify_user(client_user_id, {"type": "session_rejected", "session_id": session.id, "reader_name": current_user.first_name or current_user.email})

        elif action_data.action == "end":
            if current_user.id not in [client_user_id, reader_user_id] or session.status != 'active':
                raise HTTPException(status_code=403, detail="Action not allowed or invalid session state.")
            
            end_time_utc = datetime.utcnow()
            billing_duration_seconds = 0
            if session.start_time:
                start_time_utc_aware = session.start_time.replace(tzinfo=None) if session.start_time.tzinfo else session.start_time
                billing_duration_seconds = int((end_time_utc - start_time_utc_aware).total_seconds())
            
            total_amount_due = Decimal('0.00')
            if session.rate_per_minute and billing_duration_seconds > 0: # Ensure rate and duration are valid
                total_amount_due = (Decimal(billing_duration_seconds) / Decimal('60.0')) * Decimal(session.rate_per_minute)
                total_amount_due = round(total_amount_due, 2)

            # Fetch client's current balance
            client_balance_record = await conn.fetchrow("SELECT balance FROM clients WHERE id = $1", session.client_id)
            client_balance = Decimal(client_balance_record['balance']) if client_balance_record else Decimal('0.00')

            amount_to_charge = min(total_amount_due, client_balance)
            new_client_balance = client_balance - amount_to_charge

            # Update client's balance
            await conn.execute("UPDATE clients SET balance = $1 WHERE id = $2", new_client_balance, session.client_id)

            # Update reading_sessions with total_amount and billing_duration
            updated_session_data_dict = await conn.fetchrow(
                """UPDATE reading_sessions
                   SET status = 'completed', end_time = $1, billing_duration_seconds = $2, total_amount = $3, updated_at = NOW()
                   WHERE id = $4 RETURNING *""",
                end_time_utc, billing_duration_seconds, total_amount_due, session.id
            )

            # Reader Earnings
            if reader_user_id and total_amount_due > 0 : # Ensure there's an amount to calculate earnings from
                reader_share_percentage = Decimal('0.70') # 70% share for reader
                # Base reader earnings on the actual amount charged to the client, or total_amount_due?
                # For now, using total_amount_due, assuming platform might cover differences or it's an internal metric.
                # If it should be based on what client *could* pay, use amount_to_charge.
                amount_earned_by_reader = total_amount_due * reader_share_percentage
                amount_earned_by_reader = round(amount_earned_by_reader, 2)

                await conn.execute(
                    """INSERT INTO reader_earnings
                       (reader_id, session_id, total_session_amount, amount_earned, payout_status)
                       VALUES ($1, $2, $3, $4, $5)""",
                    session.reader_id, session.id, total_amount_due, amount_earned_by_reader, 'pending'
                )
            
            notification_payload = {
                "type": "session_ended",
                "session_id": session.id,
                "ended_by_role": current_user.role,
                "total_amount": float(total_amount_due), # For notification clarity
                "duration_seconds": billing_duration_seconds
            }
            target_notification_user_id = reader_user_id if current_user.id == client_user_id else client_user_id
            await notify_user(target_notification_user_id, notification_payload)

        elif action_data.action == "cancel_client":
            if current_user.id != client_user_id or session.status != 'pending':
                raise HTTPException(status_code=403, detail="Action not allowed or invalid session state.")
            updated_session_data_dict = await conn.fetchrow(
                "UPDATE reading_sessions SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *", session.id
            )
            await notify_user(reader_user_id, {"type": "session_cancelled_by_client", "session_id": session.id, "client_name": current_user.first_name or current_user.email})
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action specified.")

        if not updated_session_data_dict:
            # This path should ideally not be reached if previous updates were successful and returned data.
            # Re-fetch to ensure the response model is populated.
            updated_session_data_dict = await conn.fetchrow("SELECT * FROM reading_sessions WHERE id = $1", session.id)
            if not updated_session_data_dict:
                 raise HTTPException(status_code=500, detail="Failed to retrieve session state after action.")

        return ReadingSession(**updated_session_data_dict)

@app.post("/api/payment/add-funds")
async def add_funds(
    funds_request: AddFundsRequest,
    current_user: User = Depends(get_current_user)
):
    """Add funds to client account using Stripe"""
    user_id = current_user.id
    
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
    current_user: User = Depends(get_current_user)
):
    """Confirm payment and add funds to account"""
    # user_id = current_user.id # This is users.id
    
    try:
        # Retrieve payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        # Verify the paymentIntent's user_id metadata if it was set during creation
        if payment_intent.metadata.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="PaymentIntent does not belong to current user.")

        if payment_intent.status == 'succeeded':
            amount = payment_intent.amount / 100  # Convert from cents
            
            async with db_pool.acquire() as conn:
                client_id_db = await get_client_id_from_user_id(current_user.id, conn)
                if not client_id_db:
                    raise HTTPException(status_code=404, detail="Client profile not found for current user.")

                # Add funds to client account using client_id_db
                await conn.execute("""
                    UPDATE clients 
                    SET balance = balance + $1, updated_at = NOW()
                    WHERE id = $2
                """, Decimal(str(amount)), client_id_db) # Ensure amount is Decimal for DB
                
                # Get updated balance
                new_balance = await conn.fetchval("""
                    SELECT balance FROM clients WHERE id = $1
                """, client_id_db)
                
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
@app.websocket("/api/webrtc/{room_id}/{user_id_param}") # Added user_id_param to path
async def webrtc_signaling(websocket: WebSocket, room_id: str, user_id_param: str, token: Optional[str] = Query(None)):
    """WebRTC signaling endpoint with authentication."""
    if not token:
        await websocket.close(code=1008) # Policy Violation
        logger.warning(f"WebRTC connection attempt to room {room_id} by {user_id_param} without token.")
        return

    authenticated_user_id_from_token = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_sub_user_id: str = payload.get("sub")

        if token_sub_user_id is None or token_sub_user_id != user_id_param:
            await websocket.close(code=1008) # Policy Violation
            logger.warning(f"WebRTC auth failed for user {user_id_param} in room {room_id}. Token sub: {token_sub_user_id} mismatch or missing.")
            return

        authenticated_user_id_from_token = token_sub_user_id

    except jwt.ExpiredSignatureError:
        await websocket.close(code=1008)
        logger.warning(f"WebRTC token expired for user {user_id_param} in room {room_id}.")
        return
    except jwt.PyJWTError as e:
        await websocket.close(code=1008)
        logger.warning(f"WebRTC token validation error for user {user_id_param} in room {room_id}: {str(e)}")
        return

    # If authentication successful, proceed to join room
    await websocket.accept()
    logger.info(f"WebRTC WebSocket connection established for user {authenticated_user_id_from_token} in room {room_id}")

    # Use the authenticated user_id_from_token for signaling server logic
    await signaling_server.join_room(room_id, authenticated_user_id_from_token, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Pass the authenticated user_id for message handling
            await signaling_server.handle_signaling_message(authenticated_user_id_from_token, message)
            
    except WebSocketDisconnect:
        logger.info(f"WebRTC WebSocket disconnected for user {authenticated_user_id_from_token} in room {room_id}")
    except Exception as e:
        logger.error(f"Error in WebRTC WebSocket for user {authenticated_user_id_from_token} in room {room_id}: {e}")
    finally:
        # Use the authenticated user_id for leaving room
        if authenticated_user_id_from_token:
            await signaling_server.leave_room(authenticated_user_id_from_token)
            logger.info(f"Cleaned up WebRTC WebSocket connection for user {authenticated_user_id_from_token} in room {room_id}")

# WebSocket for real-time notifications
@app.websocket("/api/ws/{user_id_param}") # Renamed path param to avoid conflict with var name
async def websocket_endpoint(websocket: WebSocket, user_id_param: str, token: Optional[str] = Query(None)):
    if not token:
        await websocket.close(code=1008) # Policy Violation or use custom 4000-4999 range
        logger.warning(f"WS connection attempt by {user_id_param} without token.")
        return

    authenticated_user_id = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_user_id: str = payload.get("sub")

        if token_user_id is None or token_user_id != user_id_param:
            await websocket.close(code=1008) # Policy Violation
            logger.warning(f"WS auth failed for {user_id_param}. Token sub: {token_user_id} mismatch or missing.")
            return

        # Optional: Further verify user exists, though token validation should be primary
        # user_db_check = await get_user_by_id(token_user_id)
        # if not user_db_check:
        #     await websocket.close(code=1008)
        #     logger.warning(f"WS auth failed for {user_id_param}. User not found in DB.")
        #     return

        authenticated_user_id = token_user_id # Assign after successful validation

    except jwt.ExpiredSignatureError:
        await websocket.close(code=1008)
        logger.warning(f"WS token expired for {user_id_param}.")
        return
    except jwt.PyJWTError as e:
        await websocket.close(code=1008)
        logger.warning(f"WS token validation error for {user_id_param}: {str(e)}")
        return

    await websocket.accept()
    logger.info(f"WebSocket connection established for user {authenticated_user_id}")
    websocket_connections[authenticated_user_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message from {authenticated_user_id}: {data}")
            # Echoing back can be a simple pong or for debugging.
            # Consider if specific client messages need server processing.
            await websocket.send_text(json.dumps({"type": "pong", "echo": data}))
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {authenticated_user_id}")
    except Exception as e:
        logger.error(f"Error in WebSocket for user {authenticated_user_id}: {e}")
    finally:
        if authenticated_user_id and authenticated_user_id in websocket_connections:
            del websocket_connections[authenticated_user_id]
            logger.info(f"Cleaned up WebSocket connection for user {authenticated_user_id}")

# Helper functions for WebSocket notifications (generic and specific)
async def notify_user(user_id: str, message_data: dict) -> bool:
    """Send a JSON message to a specific user via WebSocket if connected."""
    websocket = websocket_connections.get(user_id)
    if websocket:
        try:
            await websocket.send_text(json.dumps(message_data))
            logger.info(f"Sent WebSocket message to user {user_id}. Type: {message_data.get('type')}")
            return True
        except Exception as e:
            logger.error(f"Error sending WebSocket message to user {user_id}: {e}")
            # Optionally remove stale connection here or let the disconnect handler do it
            # if user_id in websocket_connections: del websocket_connections[user_id]
    else:
        logger.warning(f"User {user_id} not connected for WebSocket message. Type: {message_data.get('type')}")
    return False

async def broadcast_reader_status_change(reader_data: dict):
    """Notify all connected clients of reader status change"""
    message = {
        "type": "reader_status_change",
        "data": reader_data
    }
    # Create a copy of user_ids to avoid issues if websocket_connections is modified during iteration
    connected_user_ids = list(websocket_connections.keys())
    for user_id in connected_user_ids:
        await notify_user(user_id, message)


async def notify_reader_session_request(reader_id_db: str, session_data_for_notification: dict):
    """Notify a specific reader of an incoming session request using their database ID."""
    async with db_pool.acquire() as conn: # Acquire connection for the helper
        reader_user_id = await get_user_id_from_reader_id(reader_id_db, conn)
    
    if reader_user_id:
        # The actual message content for "new_session_request" will be constructed in /api/session/request
        # This function is now primarily for routing the notification to the correct user.
        # For example, `session_data_for_notification` would be the fully prepared message.
        await notify_user(reader_user_id, session_data_for_notification)
    else:
        logger.warning(f"Could not find user_id for reader_id_db: {reader_id_db} to send session request notification.")


# get_reader_user_id is now get_user_id_from_reader_id, defined earlier.
# We keep it if it's used elsewhere, or remove if redundant.
# For now, assuming it might be used by other logic, so keeping.
async def get_reader_user_id(reader_id: str) -> Optional[str]:
    """Get user_id for a reader. DEPRECATED if get_user_id_from_reader_id is used consistently."""
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
    # This function is now a direct call to notify_user
    await notify_user(user_id, message)

async def notify_message_received(message_data: dict):
    """Notify a user about a new message"""
    recipient_user_id = message_data['recipient_id'] # Assuming recipient_id is user_id
    
    await notify_user(recipient_user_id, {
        "type": "message_received",
        "data": message_data
    })

async def broadcast_gift_to_stream(stream_id: str, gift_data: dict):
    """Broadcast gift to all stream viewers"""
    # In a real implementation, this would broadcast to all connected stream viewers
    # For now, we'll store the gift data and it can be retrieved via API
    message = {
        "type": "virtual_gift",
        "stream_id": stream_id,
        "data": gift_data
    }
    
    # Broadcast to all connected users (simplified implementation)
    for user_id, websocket in websocket_connections.items():
        try:
            await websocket.send_text(json.dumps(message))
        except:
            # Remove stale connections
            if user_id in websocket_connections:
                del websocket_connections[user_id]

if __name__ == "__main__":
    import uvicorn
    # Admin specific endpoints
    @app.post("/api/admin/stripe/sync-products")
    async def admin_stripe_sync_products(current_user: User = Depends(get_current_user)):
        if current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="User does not have admin privileges.")

        logger.info(f"Stripe Product Sync Triggered by admin: {current_user.email} (ID: {current_user.id})")
        # Placeholder for actual Stripe product synchronization logic
        # e.g., fetch products from Stripe, compare with DB, update DB.
        return {"status": "success", "message": "Stripe product sync initiated (placeholder)."}

    uvicorn.run(app, host="0.0.0.0", port=8001)
