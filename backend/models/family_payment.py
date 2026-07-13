from db import db
from datetime import datetime

class FamilyPayment(db.Model):
    __tablename__ = "family_payments"

    family_group = db.Column(db.String(100), primary_key=True)
    amount_paid = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(50), nullable=False, default="unpaid") # unpaid, partial, paid
    notes = db.Column(db.Text, nullable=True)
    override_fee = db.Column(db.Float, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "family_group": self.family_group,
            "amount_paid": self.amount_paid,
            "status": self.status,
            "notes": self.notes,
            "override_fee": self.override_fee,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
