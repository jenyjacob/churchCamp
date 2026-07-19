import os
import secrets
from models import User
from db import db

def seed_admin():
    """Create initial admin account if no users exist in the database."""
    if User.query.count() == 0:
        seed_username = os.environ.get("SEED_ADMIN_USERNAME", "admin")
        seed_password = os.environ.get("SEED_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
        seed_email = os.environ.get("SEED_ADMIN_EMAIL", "admin@churchcamp.org")

        admin = User(
            username=seed_username,
            role="admin",
            full_name="Camp Administrator",
            email=seed_email,
        )
        admin.set_password(seed_password)
        db.session.add(admin)
        db.session.commit()

        if os.environ.get("SEED_ADMIN_PASSWORD"):
            print(f"Initial seed admin account created for username '{seed_username}'.")
        else:
            print(f"Initial seed admin account created: username='{seed_username}', password='{seed_password}'")
            print("IMPORTANT: Store this password securely and change it immediately after first login!")
