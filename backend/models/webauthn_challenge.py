from db import db
from datetime import datetime

class WebauthnChallenge(db.Model):
    __tablename__ = "webauthn_challenges"

    id = db.Column(db.Integer, primary_key=True)
    challenge = db.Column(db.String(256), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
