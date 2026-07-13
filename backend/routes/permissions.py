from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models import PagePermission, User
from db import db
from utils.logging import log_action

permissions_bp = Blueprint("permissions", __name__)

DEFAULT_PERMISSIONS = {
    "owner": {
        "dashboard": "edit",
        "campers": "edit",
        "checkin": "edit",
        "cabins": "edit",
        "schedule": "edit",
        "outdoor": "edit",
        "apparel": "edit",
        "users": "edit",
        "logs": "edit",
        "role_assigner": "edit",
        "finance": "edit"
    },
    "admin": {
        "dashboard": "read",
        "campers": "edit",
        "checkin": "edit",
        "cabins": "edit",
        "schedule": "edit",
        "outdoor": "edit",
        "apparel": "edit",
        "users": "edit",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "edit"
    },
    "director": {
        "dashboard": "read",
        "campers": "edit",
        "checkin": "edit",
        "cabins": "edit",
        "schedule": "edit",
        "outdoor": "edit",
        "apparel": "edit",
        "users": "hide",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "read"
    },
    "user": {
        "dashboard": "read",
        "campers": "edit",
        "checkin": "edit",
        "cabins": "hide",
        "schedule": "hide",
        "outdoor": "hide",
        "apparel": "hide",
        "users": "hide",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "hide"
    },
    "finance": {
        "dashboard": "read",
        "campers": "hide",
        "checkin": "hide",
        "cabins": "hide",
        "schedule": "hide",
        "outdoor": "hide",
        "apparel": "hide",
        "users": "hide",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "edit"
    }
}

@permissions_bp.route("/my-permissions", methods=["GET"])
@jwt_required()
def get_my_permissions():
    claims = get_jwt()
    role = claims.get("role", "user")
    
    # Start with default permissions for this role
    perms = dict(DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["user"]))
    
    # Overwrite with any custom permissions from the DB if not owner
    if role != "owner":
        db_perms = PagePermission.query.filter_by(role=role).all()
        for p in db_perms:
            perms[p.page_key] = p.access_level
            
    return jsonify({
        "role": role,
        "permissions": perms
    }), 200

@permissions_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_permissions():
    claims = get_jwt()
    role = claims.get("role")
    
    if role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    # Build the full grid containing default settings and custom overrides
    grid = {}
    for target_role in ["admin", "director", "finance", "user"]:
        grid[target_role] = dict(DEFAULT_PERMISSIONS[target_role])
        db_perms = PagePermission.query.filter_by(role=target_role).all()
        for p in db_perms:
            grid[target_role][p.page_key] = p.access_level
            
    return jsonify({
        "permissions": grid
    }), 200

@permissions_bp.route("/", methods=["POST"])
@jwt_required()
def update_permission():
    claims = get_jwt()
    current_role = claims.get("role")
    
    if current_role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    data = request.get_json()
    role = data.get("role")
    page_key = data.get("page_key")
    access_level = data.get("access_level")

    if not role or not page_key or not access_level:
        return jsonify({"error": "role, page_key, and access_level are required"}), 400

    if role not in ["admin", "director", "finance", "user"]:
        return jsonify({"error": f"Cannot modify permissions for role: {role}"}), 400

    if page_key not in DEFAULT_PERMISSIONS["owner"].keys():
        return jsonify({"error": f"Invalid page key: {page_key}"}), 400

    if access_level not in ["hide", "read", "edit"]:
        return jsonify({"error": f"Invalid access level: {access_level}"}), 400

    # Find existing or create new
    p = PagePermission.query.filter_by(role=role, page_key=page_key).first()
    if p:
        old_level = p.access_level
        p.access_level = access_level
    else:
        old_level = DEFAULT_PERMISSIONS[role].get(page_key, "hide")
        p = PagePermission(role=role, page_key=page_key, access_level=access_level)
        db.session.add(p)

    db.session.commit()
    
    # Log action
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    log_action(
        "UPDATE_ROLE_PERMISSION", 
        f"Updated role {role} permission for page {page_key} from {old_level} to {access_level}",
        user.id,
        user.username
    )

    return jsonify({
        "message": "Permission updated successfully",
        "permission": p.to_dict()
    }), 200
