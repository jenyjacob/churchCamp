from models import User
from db import db

def seed_admin():
    """Create default admin if no users exist."""
    if User.query.count() == 0:
        admin = User(
            username="admin",
            role="admin",
            full_name="Camp Administrator",
            email="admin@churchcamp.org",
        )
        admin.set_password("Admin@1234!")
        db.session.add(admin)
        db.session.commit()
        print("Default admin user created: admin / Admin@1234!")
        print("Warning: Change the password immediately after first login!")
