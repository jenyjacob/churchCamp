from db import db
from datetime import datetime

class UserPasskey(db.Model):
    __tablename__ = "user_passkeys"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    credential_id = db.Column(db.String(512), unique=True, nullable=False)
    public_key = db.Column(db.Text, nullable=False)  # Base64 encoded COSE public key bytes
    sign_count = db.Column(db.Integer, default=0)
    name = db.Column(db.String(100), nullable=True)  # e.g., "My iPhone", "Windows Hello"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Note: user backref relation will be automatically set
    user = db.relationship("User", backref=db.backref("passkeys", lazy=True, cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "credential_id": self.credential_id,
            "name": self.name,
            "sign_count": self.sign_count,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
