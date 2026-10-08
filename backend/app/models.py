import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    avatar_url = Column(String, nullable=True)

    meetings = relationship("Meeting", back_populates="host")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    host_id = Column(String, ForeignKey("users.id"))
    scheduled_at = Column(DateTime, default=datetime.datetime.utcnow)
    duration_minutes = Column(Integer, default=30)
    status = Column(String, default="active")
    passcode = Column(String)
    invite_link = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    host = relationship("User", back_populates="meetings")
    participants = relationship("Participant", back_populates="meeting")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    user_id = Column(String, nullable=True)
    display_name = Column(String)
    role = Column(String, default="participant")
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    meeting = relationship("Meeting", back_populates="participants")