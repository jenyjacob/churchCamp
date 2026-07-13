from db import db

class Tshirt(db.Model):
    __tablename__ = "tshirts"

    id = db.Column(db.Integer, primary_key=True)
    camper_id = db.Column(db.Integer, db.ForeignKey("campers.id", ondelete="CASCADE"), nullable=False)
    attendee_name = db.Column(db.String(255), nullable=False)
    tshirt_size = db.Column(db.String(50), nullable=False)
    indian_size = db.Column(db.String(50), nullable=True)

    # Relationship
    camper = db.relationship("Camper", back_populates="tshirts")

    def to_dict(self):
        return {
            "id": self.id,
            "camper_id": self.camper_id,
            "attendee_name": self.attendee_name,
            "tshirt_size": self.tshirt_size,
            "indian_size": self.indian_size,
        }
