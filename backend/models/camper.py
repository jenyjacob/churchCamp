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
    grade = db.Column(db.String(20), nullable=True)
    cabin_group = db.Column(db.String(100), nullable=True)
    session = db.Column(db.String(100), nullable=True)

    # Guardian info
    guardian_name = db.Column(db.String(150), nullable=True)
    guardian_phone = db.Column(db.String(30), nullable=True)
    guardian_email = db.Column(db.String(150), nullable=True)
    emergency_contact = db.Column(db.String(150), nullable=True)
    emergency_phone = db.Column(db.String(30), nullable=True)

    # Medical
    allergies = db.Column(db.Text, nullable=True)
    medical_notes = db.Column(db.Text, nullable=True)
    medications = db.Column(db.Text, nullable=True)

    # Status
    registration_status = db.Column(
        db.Enum("registered", "waitlist", "cancelled"),
        default="registered",
        nullable=False
    )
    payment_status = db.Column(
        db.Enum("paid", "partial", "unpaid"),
        default="unpaid",
        nullable=False
    )
    notes = db.Column(db.Text, nullable=True)
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
            "grade": self.grade,
            "cabin_group": self.cabin_group,
            "session": self.session,
            "guardian_name": self.guardian_name,
            "guardian_phone": self.guardian_phone,
            "guardian_email": self.guardian_email,
            "emergency_contact": self.emergency_contact,
            "emergency_phone": self.emergency_phone,
            "allergies": self.allergies,
            "medical_notes": self.medical_notes,
            "medications": self.medications,
            "registration_status": self.registration_status,
            "payment_status": self.payment_status,
            "notes": self.notes,
            "checked_in": any(c.checked_out_at is None for c in self.checkins),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
