from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import ScheduleEvent
from db import db

schedule_bp = Blueprint("schedule", __name__)

def require_admin():
    claims = get_jwt()
    return claims.get("role") in ["admin", "owner"]

@schedule_bp.route("/", methods=["GET"])
def get_schedule():
    events = ScheduleEvent.query.all()
    # Sort events by day and time on python side or db side
    # Simple order: return them as is, we can sort them by Day and Time
    return jsonify({"events": [e.to_dict() for e in events]}), 200

@schedule_bp.route("/", methods=["POST"])
@jwt_required()
def create_event():
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    if not data.get("day") or not data.get("time") or not data.get("title"):
        return jsonify({"error": "Day, time, and title are required"}), 400

    event = ScheduleEvent(
        day=data["day"].strip(),
        time=data["time"].strip(),
        title=data["title"].strip(),
        description=data.get("description", "").strip() if data.get("description") else None,
        location=data.get("location", "").strip() if data.get("location") else None
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({"event": event.to_dict()}), 201

@schedule_bp.route("/<int:event_id>", methods=["PUT"])
@jwt_required()
def update_event(event_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    event = ScheduleEvent.query.get_or_404(event_id)
    data = request.get_json()

    event.day = data.get("day", event.day).strip()
    event.time = data.get("time", event.time).strip()
    event.title = data.get("title", event.title).strip()
    event.description = data.get("description", event.description).strip() if data.get("description") is not None else event.description
    event.location = data.get("location", event.location).strip() if data.get("location") is not None else event.location

    db.session.commit()
    return jsonify({"event": event.to_dict()}), 200

@schedule_bp.route("/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_event(event_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    event = ScheduleEvent.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Event deleted"}), 200
