from db import db
from datetime import datetime

class RunOfShowBlock(db.Model):
    """
    Detailed internal run-of-show for the retreat weekend (Point Person, Supporting
    Teams, setup notes, tech cues, contingency, status, etc).

    Intentionally separate from ScheduleEvent (the simpler public-facing Schedule
    page) so the two features never collide.
    """
    __tablename__ = "run_of_show_blocks"

    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.String(50), nullable=False)  # e.g. "Friday", "Saturday", "Sunday"
    order_index = db.Column(db.Integer, nullable=False, default=0)  # manual ordering within a day

    start_time = db.Column(db.String(20), nullable=True)  # "14:00"
    end_time = db.Column(db.String(20), nullable=True)    # "16:00"

    block_title = db.Column(db.String(150), nullable=False)
    location = db.Column(db.String(150), nullable=True)

    point_person = db.Column(db.String(150), nullable=True)
    supporting_teams = db.Column(db.String(255), nullable=True)

    setup_time = db.Column(db.String(20), nullable=True)
    setup_notes = db.Column(db.Text, nullable=True)

    tech_cues = db.Column(db.Text, nullable=True)
    kidz_corner_note = db.Column(db.Text, nullable=True)
    contingency = db.Column(db.Text, nullable=True)

    status = db.Column(db.String(30), nullable=False, default="Not started")
    # allowed values: "Not started", "In progress", "Done", "Delayed"

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "day": self.day,
            "order_index": self.order_index,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "block_title": self.block_title,
            "location": self.location,
            "point_person": self.point_person,
            "supporting_teams": self.supporting_teams,
            "setup_time": self.setup_time,
            "setup_notes": self.setup_notes,
            "tech_cues": self.tech_cues,
            "kidz_corner_note": self.kidz_corner_note,
            "contingency": self.contingency,
            "status": self.status,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
