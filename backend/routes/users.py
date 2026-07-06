from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import User, AuditLog
from db import db

users_bp = Blueprint("users", __name__)

def require_admin_or_owner():
    claims = get_jwt()
    if claims.get("role") not in ["admin", "owner"]:
        return False
    return True

@users_bp.route("/", methods=["GET"])
@jwt_required()
def get_users():
    if not require_admin_or_owner():
        return jsonify({"error": "Admin access required"}), 403
    users = User.query.order_by(User.username).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200

@users_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():
    if not require_admin_or_owner():
        return jsonify({"error": "Admin access required"}), 403

    claims = get_jwt()
    data = request.get_json()
    if data.get("role") == "owner" and claims.get("role") != "owner":
        return jsonify({"error": "Only owners can create owner profiles"}), 403

    data = request.get_json()
    if not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password are required"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already exists"}), 409

    user = User(
        username=data["username"].strip(),
        role=data.get("role", "user"),
        full_name=data.get("full_name", "").strip() or None,
        email=data.get("email", "").strip() or None,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    from utils.logging import log_action
    log_action("CREATE_USER", f"Created user '{user.username}' with role '{user.role}'")
    return jsonify({"user": user.to_dict()}), 201

@users_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    if not require_admin_or_owner():
        return jsonify({"error": "Admin access required"}), 403

    user = User.query.get_or_404(user_id)
    claims = get_jwt()
    data = request.get_json()

    # Admin cannot modify Owner
    if user.role == "owner" and claims.get("role") != "owner":
        return jsonify({"error": "Admin cannot modify owner profiles"}), 403

    # Admin cannot promote anyone to Owner
    if data.get("role") == "owner" and claims.get("role") != "owner":
        return jsonify({"error": "Only owners can assign owner role"}), 403

    for field in ["role", "full_name", "email", "is_active"]:
        if field in data:
            val = data[field]
            if field in ["email", "full_name"] and isinstance(val, str):
                val = val.strip() or None
            setattr(user, field, val)

    if "password" in data and data["password"]:
        user.set_password(data["password"])

    db.session.commit()
    from utils.logging import log_action
    log_action("UPDATE_USER", f"Updated user profile for '{user.username}' (ID: {user.id})")
    return jsonify({"user": user.to_dict()}), 200

@users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    if not require_admin_or_owner():
        return jsonify({"error": "Admin access required"}), 403

    user = User.query.get_or_404(user_id)
    claims = get_jwt()

    # Admin cannot delete Owner
    if user.role == "owner" and claims.get("role") != "owner":
        return jsonify({"error": "Admin cannot delete owner profiles"}), 403

    username = user.username
    db.session.delete(user)
    db.session.commit()
    from utils.logging import log_action
    log_action("DELETE_USER", f"Deleted user '{username}' (ID: {user_id})")
    return jsonify({"message": "User deleted"}), 200

def require_owner():
    claims = get_jwt()
    return claims.get("role") == "owner"

@users_bp.route("/audit-logs", methods=["GET"])
@jwt_required()
def get_audit_logs():
    if not require_owner():
        return jsonify({"error": "Owner access required"}), 403

    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    paginated = AuditLog.query.order_by(AuditLog.timestamp.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "logs": [log.to_dict() for log in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    }), 200

@users_bp.route("/audit-logs", methods=["DELETE"])
@jwt_required()
def delete_audit_logs():
    if not require_owner():
        return jsonify({"error": "Owner access required"}), 403

    AuditLog.query.delete()
    db.session.commit()
    from utils.logging import log_action
    log_action("CLEAR_LOGS", "All audit logs were cleared by the system Owner")
    return jsonify({"message": "Audit logs cleared successfully"}), 200
