from flask import request
from flask_jwt_extended import get_jwt_identity
from models import AuditLog, User
from db import db

def log_action(action, details=None, user_id=None, username=None):
    """Log user activities to the database and print to console/logs."""
    try:
        resolved_user_id = user_id
        resolved_username = username

        # Resolve user context from request if JWT is valid and user_id not provided
        try:
            current_identity = get_jwt_identity()
            if current_identity and not resolved_user_id:
                user = User.query.get(int(current_identity))
                if user:
                    resolved_user_id = user.id
                    resolved_username = user.username
        except Exception:
            pass # Not within an active JWT request context

        # Try to resolve client IP
        ip_addr = None
        try:
            if request:
                ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr)
        except Exception:
            pass

        log_entry = AuditLog(
            user_id=resolved_user_id,
            username=resolved_username,
            action=action,
            details=details,
            ip_address=ip_addr
        )
        db.session.add(log_entry)
        db.session.commit()

        # Log print statement for console output verification
        user_str = resolved_username if resolved_username else "Anonymous"
        print(f"[AUDIT LOG] {user_str}: {action} - [REDACTED]")
    except Exception as e:
        print(f"[AUDIT ERROR] Logging failed: {str(e)}")
