import json
from datetime import datetime
from db import db

class BreakfastOrder(db.Model):
    __tablename__ = "breakfast_orders"

    id = db.Column(db.Integer, primary_key=True)
    camper_id = db.Column(db.Integer, db.ForeignKey("campers.id"), nullable=False, unique=True, index=True)
    wants_breakfast = db.Column(db.Boolean, default=False, nullable=False)
    items = db.Column(db.Text, nullable=True)  # JSON: {"Pancakes": 2, "Eggs": 1}
    recorded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    camper = db.relationship("Camper", backref=db.backref("breakfast_order", uselist=False))

    def get_items(self):
        try:
            return json.loads(self.items) if self.items else {}
        except Exception:
            return {}

    def to_dict(self):
        return {
            "id": self.id,
            "camper_id": self.camper_id,
            "camper_name": f"{self.camper.first_name} {self.camper.last_name}" if self.camper else None,
            "wants_breakfast": self.wants_breakfast,
            "items": self.get_items(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
