from db import db
from datetime import datetime

class ContingencyPlan(db.Model):
    """A single contingency/safety protocol row (scenario, trigger, action, who decides)."""
    __tablename__ = "contingency_plans"

    id = db.Column(db.Integer, primary_key=True)
    scenario = db.Column(db.String(150), nullable=False)
    trigger = db.Column(db.Text, nullable=True)
    action = db.Column(db.Text, nullable=True)
    who_decides = db.Column(db.String(150), nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "scenario": self.scenario,
            "trigger": self.trigger,
            "action": self.action,
            "who_decides": self.who_decides,
            "order_index": self.order_index,
        }
