from db import db
from datetime import datetime

class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    description = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    receipt_filename = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "description": self.description,
            "category": self.category,
            "amount": self.amount,
            "date": self.date.isoformat() if self.date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "receipt_filename": self.receipt_filename
        }
