from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models import Setting, User
from db import db
from utils.logging import log_action

settings_bp = Blueprint("settings", __name__)





DEFAULT_SETTINGS = {
    "team_1_name": "Team Peter",
    "team_2_name": "Team Paul",
    "signup_title": "GCA 2026 Church Camp Sign-Up Form",
    "signup_dates": "August 14–16, 2026",
    "signup_location": "Camp Prothro",
    "activity_names": '["KAYAKING", "BOAT TOUR"]',
    "activity_1_price": "10.0",
    "activity_2_price": "20.0"
}

@settings_bp.route("/public", methods=["GET"])
def get_public_settings():
    settings_dict = dict(DEFAULT_SETTINGS)
    try:
        db_settings = Setting.query.all()
        for s in db_settings:
            settings_dict[s.key] = s.value
    except Exception:
        pass
    return jsonify({
        "settings": settings_dict
    }), 200

@settings_bp.route("/", methods=["GET"])
@jwt_required()
def get_settings():
    # Return all settings. Merge defaults with DB overrides.
    settings_dict = dict(DEFAULT_SETTINGS)
    
    try:
        db_settings = Setting.query.all()
        for s in db_settings:
            settings_dict[s.key] = s.value
    except Exception as e:
        # Fallback if table doesn't exist yet
        pass

    return jsonify({
        "settings": settings_dict
    }), 200

@settings_bp.route("/", methods=["POST"])
@jwt_required()
def update_settings():
    claims = get_jwt()
    current_role = claims.get("role")
    
    if current_role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    updated = []
    for key, val in data.items():
        if val is None or not str(val).strip():
            continue
        
        s = Setting.query.filter_by(key=key).first()
        if s:
            s.value = str(val).strip()
        else:
            s = Setting(key=key, value=str(val).strip())
            db.session.add(s)
        
        updated.append(key)

    db.session.commit()

    # Log action
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    log_action(
        "UPDATE_SETTINGS",
        f"Updated configuration settings: {', '.join(updated)}",
        user.id,
        user.username
    )

    # Return updated list
    return get_settings()
