import os
import secrets
from datetime import timedelta

# Enforce environment checks in production mode
is_prod = os.environ.get("FLASK_ENV") == "production"

if is_prod:
    jwt_key = os.environ.get("JWT_SECRET_KEY")
    if not jwt_key:
        raise ValueError("CRITICAL ERROR: JWT_SECRET_KEY environment variable is not set in production!")
    flask_secret = os.environ.get("SECRET_KEY")
    if not flask_secret:
        raise ValueError("CRITICAL ERROR: SECRET_KEY environment variable is not set in production!")
    db_url = os.environ.get("DATABASE_URL")
    if not db_url or "sqlite" in db_url:
        raise ValueError("CRITICAL ERROR: DATABASE_URL is not set or uses SQLite in production!")

class Config:
    # Database connection string from environment
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///churchcamp.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Connection pool hardening: pool_pre_ping tests each connection with a
    # lightweight ping before handing it to a request and transparently
    # replaces it if it's gone bad/stale (e.g. a connection left in a
    # corrupted protocol state after an interrupted result read, or one the
    # MySQL server closed server-side due to wait_timeout). pool_recycle
    # proactively retires connections older than this many seconds so they
    # never get old enough for MySQL to close them out from under us.
    # Only applied for non-SQLite URLs since SQLite doesn't use these options.
    if "sqlite" not in SQLALCHEMY_DATABASE_URI:
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_pre_ping": True,
            "pool_recycle": 280,
        }

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

