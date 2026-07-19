import os
import secrets
from datetime import timedelta

class Config:
    # Database connection string from environment
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///churchcamp.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Authentication Key
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or secrets.token_hex(32)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # CORS Allowed Origins
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

    # Flask Session / CSRF Secret Key
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

    # WebAuthn / Passkeys Configuration
    WEBAUTHN_RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost")
    WEBAUTHN_RP_NAME = os.environ.get("WEBAUTHN_RP_NAME", "GCA Camp Manager")
    WEBAUTHN_RP_ORIGIN = os.environ.get("WEBAUTHN_RP_ORIGIN", "http://localhost:3000")

