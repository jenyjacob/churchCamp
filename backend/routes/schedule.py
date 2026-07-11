from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import ScheduleEvent
from db import db
from utils.permissions import require_page_permission

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

def parse_time_range(time_str):
    def to_minutes(t_part):
        t_part = t_part.strip().upper()
        try:
            parts = t_part.split(" ")
            time_val = parts[0]
            ampm = parts[1]
            h, m = map(int, time_val.split(":"))
            if ampm == "PM" and h != 12:
                h += 12
            elif ampm == "AM" and h == 12:
                h = 0
            return h * 60 + m
        except Exception:
            return 0

    if " - " in time_str:
        parts = time_str.split(" - ")
        start = to_minutes(parts[0])
        end = to_minutes(parts[1])
        if start > end:
            start, end = end, start
        return start, end
    else:
        start = to_minutes(time_str)
        return start, start

def is_overlapping(range1, range2):
    s1, e1 = range1
    s2, e2 = range2
    if s1 == e1 and s2 == e2:
        return s1 == s2
    if s1 == e1:
        return s2 <= s1 < e2
    if s2 == e2:
        return s1 <= s2 < e1
    return s1 < e2 and s2 < e1

@schedule_bp.route("/", methods=["POST"])
@jwt_required()
@require_page_permission("schedule", "edit")
def create_event():
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    if not data.get("day") or not data.get("time") or not data.get("title"):
        return jsonify({"error": "Day, time, and title are required"}), 400

    day = data["day"].strip()
    new_time = data["time"].strip()
    new_range = parse_time_range(new_time)

    # Check for overlapping events on the same day
    existing_events = ScheduleEvent.query.filter_by(day=day).all()
    for existing in existing_events:
        existing_range = parse_time_range(existing.time)
        if is_overlapping(new_range, existing_range):
            return jsonify({
                "error": f"Time conflict: '{data['title'].strip()}' ({new_time}) overlaps with existing event '{existing.title}' ({existing.time}) on {day}."
            }), 409

    event = ScheduleEvent(
        day=day,
        time=new_time,
        title=data["title"].strip(),
        description=data.get("description", "").strip() if data.get("description") else None,
        location=data.get("location", "").strip() if data.get("location") else None
    )
    db.session.add(event)
    db.session.commit()
    from utils.logging import log_action
    log_action("CREATE_SCHEDULE_EVENT", f"Created event '{event.title}' on {event.day} at {event.time}")
    return jsonify({"event": event.to_dict()}), 201

@schedule_bp.route("/<int:event_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("schedule", "edit")
def update_event(event_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    event = ScheduleEvent.query.get_or_404(event_id)
    data = request.get_json()

    proposed_day = data.get("day", event.day).strip()
    proposed_time = data.get("time", event.time).strip()
    proposed_title = data.get("title", event.title).strip()
    new_range = parse_time_range(proposed_time)

    # Check for overlapping events on the same day (excluding the current event id)
    existing_events = ScheduleEvent.query.filter(
        ScheduleEvent.day == proposed_day,
        ScheduleEvent.id != event_id
    ).all()
    
    for existing in existing_events:
        existing_range = parse_time_range(existing.time)
        if is_overlapping(new_range, existing_range):
            return jsonify({
                "error": f"Time conflict: '{proposed_title}' ({proposed_time}) overlaps with existing event '{existing.title}' ({existing.time}) on {proposed_day}."
            }), 409

    event.day = proposed_day
    event.time = proposed_time
    event.title = proposed_title
    event.description = data.get("description", event.description).strip() if data.get("description") is not None else event.description
    event.location = data.get("location", event.location).strip() if data.get("location") is not None else event.location

    db.session.commit()
    from utils.logging import log_action
    log_action("UPDATE_SCHEDULE_EVENT", f"Updated event '{event.title}' (ID: {event.id})")
    return jsonify({"event": event.to_dict()}), 200

@schedule_bp.route("/<int:event_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("schedule", "edit")
def delete_event(event_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    event = ScheduleEvent.query.get_or_404(event_id)
    event_title = event.title
    db.session.delete(event)
    db.session.commit()
    from utils.logging import log_action
    log_action("DELETE_SCHEDULE_EVENT", f"Deleted event '{event_title}' (ID: {event_id})")
    return jsonify({"message": "Event deleted"}), 200
