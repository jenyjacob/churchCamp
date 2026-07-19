import os
import secrets
from models import User
from db import db

def seed_admin():
    """Create initial admin account if no users exist in the database."""
    if User.query.count() == 0:
        seed_username = os.environ.get("SEED_ADMIN_USERNAME", "admin")
        seed_password = os.environ.get("SEED_ADMIN_PASSWORD", "Admin@1234!")
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
            print(f"Initial seed admin account created for username '{seed_username}'.")
            print("IMPORTANT: Change the default admin password immediately after first login!")
