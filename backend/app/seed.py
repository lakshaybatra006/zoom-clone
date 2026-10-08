from datetime import datetime, timedelta
from app.database import engine, SessionLocal, Base
from app.models import User, Meeting

def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    default_user = User(
        id="usr_default_01",
        email="alex.morgan@zoomclone.com",
        name="Alex Morgan"
    )
    db.add(default_user)
    db.commit()

    sample_meeting = Meeting(
        meeting_id="8429102049",
        title="Weekly Sprint Sync",
        description="Discuss engineering priorities and frontend fixes.",
        host_id="usr_default_01",
        scheduled_at=datetime.utcnow() + timedelta(days=1),
        duration_minutes=45,
        status="scheduled",
        passcode="xyz123",
        invite_link="http://localhost:3000/room/8429102049?pwd=xyz123"
    )
    db.add(sample_meeting)
    db.commit()
    db.close()
    print("Database seeded successfully!")

if __name__ == "__main__":
    seed()