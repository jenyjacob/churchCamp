from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import User

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=data["username"]).first()

    if not user or not user.check_password(data["password"]):
        from utils.logging import log_action
        log_action("LOGIN_FAILURE", f"Failed login attempt for username: {data.get('username')}")
        return jsonify({"error": "Invalid username or password"}), 401

    if not user.is_active:
        from utils.logging import log_action
        log_action("LOGIN_FAILURE", f"Disabled account login attempt for username: {data.get('username')}", user.id, user.username)
        return jsonify({"error": "Account is disabled. Contact an administrator."}), 403

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})

    from utils.logging import log_action
    log_action("LOGIN_SUCCESS", "User logged in successfully", user.id, user.username)

    return jsonify({
        "access_token": token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200
