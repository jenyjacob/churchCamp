from db import db
from datetime import datetime

class ScheduleEvent(db.Model):
    __tablename__ = "schedule_events"

    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.String(50), nullable=False)
    time = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "day": self.day,
            "time": self.time,
            "title": self.title,
            "description": self.description,
            "location": self.location,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
