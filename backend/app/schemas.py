from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserSignup(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str

    class Config:
        from_attributes = True

class InstantMeetingCreate(BaseModel):
    host_id: str
    title: str = "Instant Meeting"

class ScheduleMeetingCreate(BaseModel):
    host_id: str
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: Optional[int] = 30

class JoinMeetingRequest(BaseModel):
    meeting_id: str
    user_id: Optional[str] = None
    display_name: str

class MeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    description: Optional[str] = None
    host_id: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    passcode: str
    invite_link: str
    created_at: datetime

    class Config:
        from_attributes = True