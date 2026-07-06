from db import db
from datetime import datetime

class Camper(db.Model):
    __tablename__ = "campers"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=True)
    age = db.Column(db.Integer, nullable=True)
    gender = db.Column(db.Enum("male", "female", "other"), nullable=True)
    cabin_group = db.Column(db.String(100), nullable=True)
    family_group = db.Column(db.String(100), nullable=True)

    # Guardian info
    guardian_name = db.Column(db.String(150), nullable=True)
    guardian_phone = db.Column(db.String(30), nullable=True)

    # Medical
    allergies = db.Column(db.Text, nullable=True)
    waiver_submitted = db.Column(db.Boolean, default=False, nullable=False)

    # Status
    registration_status = db.Column(
        db.Enum("registered", "waitlist", "cancelled"),
        default="registered",
        nullable=False
    )
    notes = db.Column(db.Text, nullable=True)
    kayaking = db.Column(db.Integer, default=0, nullable=False)
    boat_tour = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to check-ins
    checkins = db.relationship("CheckIn", backref="camper", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": f"{self.first_name} {self.last_name}",
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "age": self.age,
            "gender": self.gender,
            "cabin_group": self.cabin_group,
            "family_group": self.family_group,
            "guardian_name": self.guardian_name,
            "guardian_phone": self.guardian_phone,
            "allergies": self.allergies,
            "waiver_submitted": self.waiver_submitted,
            "registration_status": self.registration_status,
            "notes": self.notes,
            "kayaking": self.kayaking,
            "boat_tour": self.boat_tour,
            "checked_in": any(c.checked_out_at is None for c in self.checkins),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
