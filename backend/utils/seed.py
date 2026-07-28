import os
import secrets
import string
from models import User
from db import db

def seed_admin():
    """Create initial admin account if no users exist in the database."""
    if User.query.count() == 0:
        seed_username = os.environ.get("SEED_ADMIN_USERNAME", "admin")
        
        # If no password is provided in environment variables, generate a secure random compliant password
        env_password = os.environ.get("SEED_ADMIN_PASSWORD")
        if not env_password:
            uppers = string.ascii_uppercase
            lowers = string.ascii_lowercase
            digits = string.digits
            specials = "@$!%*?&#^-+=_"
            pool = uppers + lowers + digits + specials
            
            # Ensure at least one char from each category
            seed_password_chars = [
                secrets.choice(uppers),
                secrets.choice(lowers),
                secrets.choice(digits),
                secrets.choice(specials)
            ]
            for _ in range(12):
                seed_password_chars.append(secrets.choice(pool))
            secrets.SystemRandom().shuffle(seed_password_chars)
            seed_password = "".join(seed_password_chars)
        else:
            seed_password = env_password

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

        print("=" * 60)
        print(" INITIAL ADMIN SEED ACCOUNT SETUP ")
        print(f" Username: {seed_username}")
        if not env_password:
            print(f" Generated Password: {seed_password}")
            print(" IMPORTANT: Copy this password now! It will only be shown once in this log.")
        else:
            print(" Password: (configured via SEED_ADMIN_PASSWORD env var)")
        print("=" * 60)
