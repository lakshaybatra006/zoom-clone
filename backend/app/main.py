import random
import string
import uuid
from datetime import datetime
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zoom Clone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_meeting_id():
    return "".join([str(random.randint(0, 9)) for _ in range(10)])

def generate_passcode():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/signup", response_model=schemas.UserResponse)
def signup(user_data: schemas.UserSignup, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"usr_{uuid.uuid4().hex[:8]}"
    user = models.User(
        id=user_id,
        email=user_data.email,
        name=user_data.name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/api/auth/login", response_model=schemas.UserResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    return user

# --- MEETING ENDPOINTS ---

@app.post("/api/meetings/instant", response_model=schemas.MeetingResponse)
def create_instant_meeting(req: schemas.InstantMeetingCreate, db: Session = Depends(get_db)):
    meeting_id = generate_meeting_id()
    passcode = generate_passcode()
    invite_link = f"http://localhost:3000/room/{meeting_id}?pwd={passcode}"

    meeting = models.Meeting(
        meeting_id=meeting_id,
        title=req.title,
        host_id=req.host_id,
        scheduled_at=datetime.utcnow(),
        duration_minutes=30,
        status="active",
        passcode=passcode,
        invite_link=invite_link
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting

@app.post("/api/meetings/schedule", response_model=schemas.MeetingResponse)
def schedule_meeting(req: schemas.ScheduleMeetingCreate, db: Session = Depends(get_db)):
    meeting_id = generate_meeting_id()
    passcode = generate_passcode()
    invite_link = f"http://localhost:3000/room/{meeting_id}?pwd={passcode}"

    meeting = models.Meeting(
        meeting_id=meeting_id,
        title=req.title,
        description=req.description,
        host_id=req.host_id,
        scheduled_at=req.scheduled_at,
        duration_minutes=req.duration_minutes or 30,
        status="scheduled",
        passcode=passcode,
        invite_link=invite_link
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting

@app.get("/api/meetings/validate/{meeting_id}", response_model=schemas.MeetingResponse)
def validate_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@app.get("/api/meetings/upcoming", response_model=List[schemas.MeetingResponse])
def get_upcoming_meetings(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.Meeting).filter(
        models.Meeting.host_id == user_id,
        models.Meeting.status == "scheduled"
    ).order_by(models.Meeting.scheduled_at.asc()).all()

@app.get("/api/meetings/recent", response_model=List[schemas.MeetingResponse])
def get_recent_meetings(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.Meeting).filter(
        models.Meeting.host_id == user_id,
        models.Meeting.status == "active"
    ).order_by(models.Meeting.created_at.desc()).limit(5).all()