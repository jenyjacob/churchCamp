from db import db
from datetime import datetime

class RosterTeam(db.Model):
    """
    Volunteer/staff team roster (Leadership, Kitchen, Worship, Game Team, etc).

    Distinct from the existing camper "Teams" feature (Team Peter / Team Paul),
    which is about grouping campers for competitions, not staff assignments.
    """
    __tablename__ = "roster_teams"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    lead = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    members = db.Column(db.Text, nullable=True)
    owns_blocks = db.Column(db.Text, nullable=True)  # free-text list of blocks this team owns
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "lead": self.lead,
            "phone": self.phone,
            "members": self.members,
            "owns_blocks": self.owns_blocks,
            "notes": self.notes,
        }
