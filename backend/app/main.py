import os
import uuid
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Zoom Clone API")

# Configure CORS for Vercel frontend and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for users and meeting rooms
users_db: Dict[str, dict] = {}
rooms_db: Dict[str, dict] = {}
websocket_connections: Dict[str, List[WebSocket]] = {}

# Pydantic Schemas
class SignupRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class CreateMeetingRequest(BaseModel):
    title: str
    host_id: Optional[str] = "guest"

class JoinRequest(BaseModel):
    name: str
    is_host: Optional[bool] = False
    participant_id: Optional[str] = None

class ActionRequest(BaseModel):
    participant_id: str

# ----------------- AUTH ENDPOINTS ----------------- #

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    if req.email in users_db:
        raise HTTPException(status_code=400, detail="User already exists with this email")
    
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "email": req.email,
        "password": req.password,
        "name": req.name
    }
    users_db[req.email] = user_data
    return {"id": user_id, "email": req.email, "name": req.name}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = users_db.get(req.email)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {"id": user["id"], "email": user["email"], "name": user["name"]}

# ----------------- MEETING ENDPOINTS ----------------- #

@app.post("/api/meetings/create")
def create_meeting(req: CreateMeetingRequest):
    meeting_id = str(uuid.uuid4())[:6]
    rooms_db[meeting_id] = {
        "meeting_id": meeting_id,
        "title": req.title,
        "host_id": req.host_id,
        "host_name": None,
        "participants": {}
    }
    return {"meeting_id": meeting_id, "title": req.title, "host_id": req.host_id}

@app.post("/api/meetings/{room_id}/join")
def join_meeting(room_id: str, req: JoinRequest):
    if room_id not in rooms_db:
        rooms_db[room_id] = {
            "meeting_id": room_id,
            "title": "Instant Meeting",
            "host_id": "guest",
            "host_name": req.name,
            "participants": {}
        }
        status = "admitted"
        is_host = True
    else:
        room = rooms_db[room_id]
        if room["host_name"] is None or req.is_host:
            room["host_name"] = req.name
            status = "admitted"
            is_host = True
        elif req.name == room["host_name"]:
            status = "admitted"
            is_host = True
        else:
            status = "waiting" # Guests go to Waiting Room for host approval
            is_host = False

    pid = req.participant_id or f"p_{str(uuid.uuid4())[:8]}"
    
    existing = rooms_db[room_id]["participants"].get(pid)
    if existing:
        status = existing["status"]

    rooms_db[room_id]["participants"][pid] = {
        "id": pid,
        "name": req.name,
        "status": status,
        "is_host": is_host
    }

    return {
        "participant_id": pid,
        "status": status,
        "is_host": is_host,
        "host_name": rooms_db[room_id]["host_name"]
    }

@app.get("/api/meetings/{room_id}/state")
def get_room_state(room_id: str):
    if room_id not in rooms_db:
        return {"room_id": room_id, "host_name": None, "admitted": [], "waiting": []}

    participants = list(rooms_db[room_id]["participants"].values())
    admitted = [p for p in participants if p["status"] == "admitted"]
    waiting = [p for p in participants if p["status"] == "waiting"]

    return {
        "room_id": room_id,
        "host_name": rooms_db[room_id]["host_name"],
        "admitted": admitted,
        "waiting": waiting
    }

@app.post("/api/meetings/{room_id}/admit")
def admit_participant(room_id: str, req: ActionRequest):
    if room_id in rooms_db and req.participant_id in rooms_db[room_id]["participants"]:
        rooms_db[room_id]["participants"][req.participant_id]["status"] = "admitted"
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.post("/api/meetings/{room_id}/reject")
def reject_participant(room_id: str, req: ActionRequest):
    if room_id in rooms_db and req.participant_id in rooms_db[room_id]["participants"]:
        del rooms_db[room_id]["participants"][req.participant_id]
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.post("/api/meetings/{room_id}/leave")
def leave_meeting(room_id: str, req: ActionRequest):
    if room_id in rooms_db and req.participant_id in rooms_db[room_id]["participants"]:
        del rooms_db[room_id]["participants"][req.participant_id]
        return {"status": "success"}
    return {"status": "not found"}

# ----------------- WEBSOCKET ENDPOINT ----------------- #

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in websocket_connections:
        websocket_connections[room_id] = []
    websocket_connections[room_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            for conn in websocket_connections.get(room_id, []):
                if conn != websocket:
                    await conn.send_text(data)
    except WebSocketDisconnect:
        if room_id in websocket_connections and websocket in websocket_connections[room_id]:
            websocket_connections[room_id].remove(websocket)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Zoom Clone FastAPI Backend"}