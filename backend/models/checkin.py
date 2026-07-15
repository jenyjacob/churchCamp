from db import db
from datetime import datetime

class CheckIn(db.Model):
    __tablename__ = "checkins"

    id = db.Column(db.Integer, primary_key=True)
    camper_id = db.Column(db.Integer, db.ForeignKey("campers.id"), nullable=False)
    checked_in_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    checked_in_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    checked_out_at = db.Column(db.DateTime, nullable=True)
    checked_out_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    staff_in = db.relationship("User", foreign_keys=[checked_in_by])
    staff_out = db.relationship("User", foreign_keys=[checked_out_by])

    def to_dict(self):
        return {
            "id": self.id,
            "camper_id": self.camper_id,
            "camper_name": f"{self.camper.first_name} {self.camper.last_name}" if self.camper else None,
            "checked_in_by": self.staff_in.username if self.staff_in else None,
            "checked_in_at": self.checked_in_at.isoformat() if self.checked_in_at else None,
            "checked_out_at": self.checked_out_at.isoformat() if self.checked_out_at else None,
            "checked_out_by": self.staff_out.username if self.staff_out else None,
            "family_group": self.camper.family_group if self.camper else None,
            "notes": self.notes,
        }
