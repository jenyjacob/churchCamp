from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import User
from db import db

users_bp = Blueprint("users", __name__)

def require_admin():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return False
    return True

@users_bp.route("/", methods=["GET"])
@jwt_required()
def get_users():
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403
    users = User.query.order_by(User.username).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200

@users_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    if not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password are required"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already exists"}), 409

    user = User(
        username=data["username"],
        role=data.get("role", "user"),
        full_name=data.get("full_name"),
        email=data.get("email"),
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 201

@users_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    user = User.query.get_or_404(user_id)
    data = request.get_json()

    for field in ["role", "full_name", "email", "is_active"]:
        if field in data:
            setattr(user, field, data[field])

    if "password" in data and data["password"]:
        user.set_password(data["password"])

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200

@users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"}), 200
