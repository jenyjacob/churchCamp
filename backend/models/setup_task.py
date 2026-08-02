from db import db
from datetime import datetime

class SetupTask(db.Model):
    """A single setup/supplies checklist item (item, owner, deadline, done)."""
    __tablename__ = "setup_tasks"

    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String(255), nullable=False)
    for_block = db.Column(db.String(150), nullable=True)
    owner = db.Column(db.String(150), nullable=True)
    deadline = db.Column(db.String(100), nullable=True)  # free-text, e.g. "Fri 3:30 PM"
    qty_detail = db.Column(db.String(255), nullable=True)
    done = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "item": self.item,
            "for_block": self.for_block,
            "owner": self.owner,
            "deadline": self.deadline,
            "qty_detail": self.qty_detail,
            "done": self.done,
        }
