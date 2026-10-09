import os
import uuid
import json
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Zoom Clone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database & WebSocket connection manager
users_db: Dict[str, dict] = {}
rooms_db: Dict[str, dict] = {}
websocket_connections: Dict[str, List[WebSocket]] = {}

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

# Helper to broadcast WebSocket messages to all room members
async def broadcast_to_room(room_id: str, message: dict, sender_ws: Optional[WebSocket] = None):
    if room_id in websocket_connections:
        dead_sockets = []
        for ws in websocket_connections[room_id]:
            if ws != sender_ws:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    dead_sockets.append(ws)
        for ds in dead_sockets:
            websocket_connections[room_id].remove(ds)

# ----------------- AUTH ENDPOINTS ----------------- #

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    if req.email in users_db:
        raise HTTPException(status_code=400, detail="User already exists with this email")
    user_id = str(uuid.uuid4())
    users_db[req.email] = {"id": user_id, "email": req.email, "password": req.password, "name": req.name}
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
            status = "waiting"
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
async def admit_participant(room_id: str, req: ActionRequest):
    if room_id in rooms_db and req.participant_id in rooms_db[room_id]["participants"]:
        p = rooms_db[room_id]["participants"][req.participant_id]
        p["status"] = "admitted"
        await broadcast_to_room(room_id, {"type": "admitted", "sender": p["name"], "participantId": req.participant_id})
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.post("/api/meetings/{room_id}/reject")
async def reject_participant(room_id: str, req: ActionRequest):
    if room_id in rooms_db and req.participant_id in rooms_db[room_id]["participants"]:
        p = rooms_db[room_id]["participants"].pop(req.participant_id)
        await broadcast_to_room(room_id, {"type": "leave", "sender": p["name"], "participantId": req.participant_id})
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.post("/api/meetings/{room_id}/leave")
async def leave_meeting(room_id: str, req: ActionRequest):
    if room_id in rooms_db and req.participant_id in rooms_db[room_id]["participants"]:
        p = rooms_db[room_id]["participants"].pop(req.participant_id)
        await broadcast_to_room(room_id, {"type": "leave", "sender": p["name"], "participantId": req.participant_id})
        return {"status": "success"}
    return {"status": "not found"}

# ----------------- WEBSOCKET SIGNALING ----------------- #

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in websocket_connections:
        websocket_connections[room_id] = []
    websocket_connections[room_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "leave":
                    sender_name = msg.get("sender")
                    if room_id in rooms_db:
                        p_to_remove = None
                        for pid, pdata in rooms_db[room_id]["participants"].items():
                            if pdata["name"] == sender_name or pid == msg.get("participantId"):
                                p_to_remove = pid
                                break
                        if p_to_remove:
                            rooms_db[room_id]["participants"].pop(p_to_remove, None)
            except Exception:
                pass

            await broadcast_to_room(room_id, json.loads(data), sender_ws=websocket)
    except WebSocketDisconnect:
        if room_id in websocket_connections and websocket in websocket_connections[room_id]:
            websocket_connections[room_id].remove(websocket)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Zoom Clone FastAPI Backend"}