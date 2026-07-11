from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt
from models.permission import PagePermission
from routes.permissions import DEFAULT_PERMISSIONS

def require_page_permission(page_key, required_level="read"):
    """
    Decorator to verify if the current logged-in user's role has 
    the necessary permission (read/edit) for a specific page key.
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            claims = get_jwt()
            role = claims.get("role", "user")
            
            # 1. Owner always has edit access
            if role == "owner":
                return f(*args, **kwargs)
                
            # 2. Get default level for this role
            access_level = DEFAULT_PERMISSIONS.get(role, {}).get(page_key, "hide")
            
            # 3. Check for custom database override
            custom_perm = PagePermission.query.filter_by(role=role, page_key=page_key).first()
            if custom_perm:
                access_level = custom_perm.access_level
                
            # 4. Check if access matches required level
            # Levels of access: edit > read > hide
            if required_level == "edit" and access_level != "edit":
                return jsonify({"error": f"Edit permission required for '{page_key}' page."}), 403
            elif required_level == "read" and access_level == "hide":
                return jsonify({"error": f"Access denied to '{page_key}' page."}), 403
                
            return f(*args, **kwargs)
        return wrapped
    return decorator
