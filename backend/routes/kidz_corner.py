from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from models import (
    KidzCornerVolunteer,
    KidzCornerKid,
    KidzCornerCheckIn,
    KidzCornerScheduleItem,
    KidzCornerCraft,
    KidzCornerBudgetItem,
    KidzCornerAVLink,
)
from db import db
from utils.permissions import require_page_permission
from utils.logging import log_action

kidz_corner_bp = Blueprint("kidz_corner", __name__)

PAGE_KEY = "kidz_corner"
CHECKIN_PAGE_KEY = "kidz_corner_checkin"
BUDGET_PAGE_KEY = "kidz_corner_budget"


# ---------------------------------------------------------------------------
# Volunteers
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/volunteers", methods=["GET"])
@jwt_required()
@require_page_permission(PAGE_KEY, "read")
def list_volunteers():
    rows = KidzCornerVolunteer.query.order_by(
        KidzCornerVolunteer.order_index.asc(), KidzCornerVolunteer.id.asc()
    ).all()
    return jsonify({"volunteers": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/volunteers", methods=["POST"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def create_volunteer():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400
    row = KidzCornerVolunteer(
        name=data["name"].strip(),
        assignment=data.get("assignment"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(row)
    db.session.commit()
    log_action("CREATE_KIDZ_CORNER_VOLUNTEER", f"Added volunteer '{row.name}'")
    return jsonify({"volunteer": row.to_dict()}), 201


@kidz_corner_bp.route("/volunteers/<int:row_id>", methods=["PUT"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def update_volunteer(row_id):
    row = KidzCornerVolunteer.query.get_or_404(row_id)
    data = request.get_json() or {}
    for field in ["name", "assignment"]:
        if field in data:
            setattr(row, field, data[field])
    if "order_index" in data:
        row.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_VOLUNTEER", f"Updated volunteer '{row.name}' (ID: {row.id})")
    return jsonify({"volunteer": row.to_dict()}), 200


@kidz_corner_bp.route("/volunteers/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def delete_volunteer(row_id):
    row = KidzCornerVolunteer.query.get_or_404(row_id)
    name = row.name
    db.session.delete(row)
    db.session.commit()
    log_action("DELETE_KIDZ_CORNER_VOLUNTEER", f"Deleted volunteer '{name}' (ID: {row_id})")
    return jsonify({"message": "Volunteer deleted"}), 200


# ---------------------------------------------------------------------------
# Kids
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/kids", methods=["GET"])
@jwt_required()
@require_page_permission(PAGE_KEY, "read")
def list_kids():
    rows = KidzCornerKid.query.order_by(
        KidzCornerKid.order_index.asc(), KidzCornerKid.id.asc()
    ).all()
    return jsonify({"kids": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/kids", methods=["POST"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def create_kid():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400
    row = KidzCornerKid(
        name=data["name"].strip(),
        age=data.get("age"),
        allergies=data.get("allergies"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(row)
    db.session.commit()
    log_action("CREATE_KIDZ_CORNER_KID", f"Added kid '{row.name}'")
    return jsonify({"kid": row.to_dict()}), 201


@kidz_corner_bp.route("/kids/<int:row_id>", methods=["PUT"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def update_kid(row_id):
    row = KidzCornerKid.query.get_or_404(row_id)
    data = request.get_json() or {}
    for field in ["name", "age", "allergies"]:
        if field in data:
            setattr(row, field, data[field])
    if "order_index" in data:
        row.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_KID", f"Updated kid '{row.name}' (ID: {row.id})")
    return jsonify({"kid": row.to_dict()}), 200


@kidz_corner_bp.route("/kids/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def delete_kid(row_id):
    row = KidzCornerKid.query.get_or_404(row_id)
    name = row.name
    db.session.delete(row)
    db.session.commit()
    log_action("DELETE_KIDZ_CORNER_KID", f"Deleted kid '{name}' (ID: {row_id})")
    return jsonify({"message": "Kid deleted"}), 200


# ---------------------------------------------------------------------------
# VBS Check-In
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/checkins", methods=["GET"])
@jwt_required()
@require_page_permission(CHECKIN_PAGE_KEY, "read")
def list_kidz_corner_checkins():
    active_only = request.args.get("active_only", "false").lower() == "true"
    query = KidzCornerCheckIn.query
    if active_only:
        query = query.filter(KidzCornerCheckIn.checked_out_at.is_(None))
    rows = query.order_by(KidzCornerCheckIn.checked_in_at.desc()).all()
    return jsonify({"checkins": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/checkins", methods=["POST"])
@jwt_required()
@require_page_permission(CHECKIN_PAGE_KEY, "edit")
def check_in_kid():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    kid_id = data.get("kid_id")

    if not kid_id:
        return jsonify({"error": "kid_id is required"}), 400

    kid = KidzCornerKid.query.get_or_404(kid_id)

    active = KidzCornerCheckIn.query.filter_by(kid_id=kid_id, checked_out_at=None).first()
    if active:
        return jsonify({"error": f"{kid.name} is already checked in"}), 409

    # Volunteers can jot down allergies/notes discovered at the door without
    # needing full edit access to the Kidz Corner roster.
    if "allergies" in data and data["allergies"] != kid.allergies:
        kid.allergies = data["allergies"]

    row = KidzCornerCheckIn(
        kid_id=kid_id,
        checked_in_by=user_id,
        notes=data.get("notes"),
    )
    db.session.add(row)
    db.session.commit()
    log_action("KIDZ_CORNER_CHECK_IN", f"Checked in kid '{kid.name}' (ID: {kid.id}) for VBS")
    return jsonify({"checkin": row.to_dict(), "kid": kid.to_dict()}), 201


@kidz_corner_bp.route("/checkins/<int:row_id>/checkout", methods=["POST"])
@jwt_required()
@require_page_permission(CHECKIN_PAGE_KEY, "edit")
def check_out_kid(row_id):
    user_id = int(get_jwt_identity())
    row = KidzCornerCheckIn.query.get_or_404(row_id)

    if row.checked_out_at:
        return jsonify({"error": "Already checked out"}), 409

    row.checked_out_at = datetime.utcnow()
    row.checked_out_by = user_id
    db.session.commit()
    kid_name = row.kid.name if row.kid else str(row.kid_id)
    log_action("KIDZ_CORNER_CHECK_OUT", f"Checked out kid '{kid_name}' (Checkin ID: {row.id})")
    return jsonify({"checkin": row.to_dict()}), 200


@kidz_corner_bp.route("/checkins/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(CHECKIN_PAGE_KEY, "edit")
def delete_kidz_corner_checkin(row_id):
    claims = get_jwt()
    if claims.get("role") not in ["admin", "owner"]:
        return jsonify({"error": "Admin access required"}), 403

    row = KidzCornerCheckIn.query.get_or_404(row_id)
    kid_name = row.kid.name if row.kid else str(row.kid_id)
    db.session.delete(row)
    db.session.commit()
    log_action("KIDZ_CORNER_RESET_CHECK_IN", f"Reset VBS check-in for '{kid_name}' (ID: {row_id})")
    return jsonify({"message": "Check-in reset successfully"}), 200


@kidz_corner_bp.route("/kids/<int:kid_id>/allergies", methods=["PUT"])
@jwt_required()
@require_page_permission(CHECKIN_PAGE_KEY, "edit")
def update_kid_allergies(kid_id):
    """
    Lightweight endpoint so check-in volunteers can record/update a kid's
    allergies or notes without needing full edit access to the Kidz Corner roster.
    """
    kid = KidzCornerKid.query.get_or_404(kid_id)
    data = request.get_json() or {}
    if "allergies" not in data:
        return jsonify({"error": "allergies is required"}), 400
    kid.allergies = data["allergies"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_KID_ALLERGIES", f"Updated allergies/notes for '{kid.name}' (ID: {kid.id})")
    return jsonify({"kid": kid.to_dict()}), 200


# ---------------------------------------------------------------------------
# Schedule items
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/schedule", methods=["GET"])
@jwt_required()
@require_page_permission(PAGE_KEY, "read")
def list_schedule():
    rows = KidzCornerScheduleItem.query.order_by(
        KidzCornerScheduleItem.day.asc(), KidzCornerScheduleItem.order_index.asc(), KidzCornerScheduleItem.id.asc()
    ).all()
    return jsonify({"items": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/schedule", methods=["POST"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def create_schedule_item():
    data = request.get_json() or {}
    if not data.get("day") or not data.get("activity"):
        return jsonify({"error": "Day and activity are required"}), 400
    row = KidzCornerScheduleItem(
        day=data["day"].strip(),
        date=data.get("date"),
        time=data.get("time"),
        activity=data["activity"].strip(),
        volunteers_needed=data.get("volunteers_needed"),
        items_needed=data.get("items_needed"),
        notes=data.get("notes"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(row)
    db.session.commit()
    log_action("CREATE_KIDZ_CORNER_SCHEDULE_ITEM", f"Added schedule item '{row.activity}' on {row.day}")
    return jsonify({"item": row.to_dict()}), 201


@kidz_corner_bp.route("/schedule/<int:row_id>", methods=["PUT"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def update_schedule_item(row_id):
    row = KidzCornerScheduleItem.query.get_or_404(row_id)
    data = request.get_json() or {}
    for field in ["day", "date", "time", "activity", "volunteers_needed", "items_needed", "notes"]:
        if field in data:
            setattr(row, field, data[field])
    if "order_index" in data:
        row.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_SCHEDULE_ITEM", f"Updated schedule item '{row.activity}' (ID: {row.id})")
    return jsonify({"item": row.to_dict()}), 200


@kidz_corner_bp.route("/schedule/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def delete_schedule_item(row_id):
    row = KidzCornerScheduleItem.query.get_or_404(row_id)
    activity = row.activity
    db.session.delete(row)
    db.session.commit()
    log_action("DELETE_KIDZ_CORNER_SCHEDULE_ITEM", f"Deleted schedule item '{activity}' (ID: {row_id})")
    return jsonify({"message": "Schedule item deleted"}), 200


# ---------------------------------------------------------------------------
# Crafts
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/crafts", methods=["GET"])
@jwt_required()
@require_page_permission(PAGE_KEY, "read")
def list_crafts():
    rows = KidzCornerCraft.query.order_by(
        KidzCornerCraft.day.asc(), KidzCornerCraft.order_index.asc(), KidzCornerCraft.id.asc()
    ).all()
    return jsonify({"crafts": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/crafts", methods=["POST"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def create_craft():
    data = request.get_json() or {}
    if not data.get("day"):
        return jsonify({"error": "Day is required"}), 400
    row = KidzCornerCraft(
        day=data["day"].strip(),
        title=data.get("title"),
        materials=data.get("materials"),
        how_to=data.get("how_to"),
        ages=data.get("ages"),
        things_to_bring=data.get("things_to_bring"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(row)
    db.session.commit()
    log_action("CREATE_KIDZ_CORNER_CRAFT", f"Added craft for {row.day}")
    return jsonify({"craft": row.to_dict()}), 201


@kidz_corner_bp.route("/crafts/<int:row_id>", methods=["PUT"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def update_craft(row_id):
    row = KidzCornerCraft.query.get_or_404(row_id)
    data = request.get_json() or {}
    for field in ["day", "title", "materials", "how_to", "ages", "things_to_bring"]:
        if field in data:
            setattr(row, field, data[field])
    if "order_index" in data:
        row.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_CRAFT", f"Updated craft (ID: {row.id})")
    return jsonify({"craft": row.to_dict()}), 200


@kidz_corner_bp.route("/crafts/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def delete_craft(row_id):
    row = KidzCornerCraft.query.get_or_404(row_id)
    db.session.delete(row)
    db.session.commit()
    log_action("DELETE_KIDZ_CORNER_CRAFT", f"Deleted craft (ID: {row_id})")
    return jsonify({"message": "Craft deleted"}), 200


# ---------------------------------------------------------------------------
# Budget
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/budget", methods=["GET"])
@jwt_required()
@require_page_permission(BUDGET_PAGE_KEY, "read")
def list_budget():
    rows = KidzCornerBudgetItem.query.order_by(
        KidzCornerBudgetItem.order_index.asc(), KidzCornerBudgetItem.id.asc()
    ).all()
    return jsonify({"items": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/budget", methods=["POST"])
@jwt_required()
@require_page_permission(BUDGET_PAGE_KEY, "edit")
def create_budget_item():
    data = request.get_json() or {}
    row = KidzCornerBudgetItem(
        month=data.get("month"),
        income_actual=data.get("income_actual"),
        expenses_actual=data.get("expenses_actual"),
        expenses_projected=data.get("expenses_projected"),
        related_files=data.get("related_files"),
        notes=data.get("notes"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(row)
    db.session.commit()
    log_action("CREATE_KIDZ_CORNER_BUDGET_ITEM", f"Added budget line '{row.notes or row.month}'")
    return jsonify({"item": row.to_dict()}), 201


@kidz_corner_bp.route("/budget/<int:row_id>", methods=["PUT"])
@jwt_required()
@require_page_permission(BUDGET_PAGE_KEY, "edit")
def update_budget_item(row_id):
    row = KidzCornerBudgetItem.query.get_or_404(row_id)
    data = request.get_json() or {}
    for field in ["month", "income_actual", "expenses_actual", "expenses_projected", "related_files", "notes"]:
        if field in data:
            setattr(row, field, data[field])
    if "order_index" in data:
        row.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_BUDGET_ITEM", f"Updated budget line (ID: {row.id})")
    return jsonify({"item": row.to_dict()}), 200


@kidz_corner_bp.route("/budget/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(BUDGET_PAGE_KEY, "edit")
def delete_budget_item(row_id):
    row = KidzCornerBudgetItem.query.get_or_404(row_id)
    db.session.delete(row)
    db.session.commit()
    log_action("DELETE_KIDZ_CORNER_BUDGET_ITEM", f"Deleted budget line (ID: {row_id})")
    return jsonify({"message": "Budget line deleted"}), 200


# ---------------------------------------------------------------------------
# Audio/Video links
# ---------------------------------------------------------------------------

@kidz_corner_bp.route("/av-links", methods=["GET"])
@jwt_required()
@require_page_permission(PAGE_KEY, "read")
def list_av_links():
    rows = KidzCornerAVLink.query.order_by(
        KidzCornerAVLink.order_index.asc(), KidzCornerAVLink.id.asc()
    ).all()
    return jsonify({"links": [r.to_dict() for r in rows]}), 200


@kidz_corner_bp.route("/av-links", methods=["POST"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def create_av_link():
    data = request.get_json() or {}
    if not data.get("label"):
        return jsonify({"error": "Label is required"}), 400
    row = KidzCornerAVLink(
        category=data.get("category", "Action Song List"),
        label=data["label"].strip(),
        url=data.get("url"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(row)
    db.session.commit()
    log_action("CREATE_KIDZ_CORNER_AV_LINK", f"Added AV link '{row.label}'")
    return jsonify({"link": row.to_dict()}), 201


@kidz_corner_bp.route("/av-links/<int:row_id>", methods=["PUT"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def update_av_link(row_id):
    row = KidzCornerAVLink.query.get_or_404(row_id)
    data = request.get_json() or {}
    for field in ["category", "label", "url"]:
        if field in data:
            setattr(row, field, data[field])
    if "order_index" in data:
        row.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_KIDZ_CORNER_AV_LINK", f"Updated AV link '{row.label}' (ID: {row.id})")
    return jsonify({"link": row.to_dict()}), 200


@kidz_corner_bp.route("/av-links/<int:row_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission(PAGE_KEY, "edit")
def delete_av_link(row_id):
    row = KidzCornerAVLink.query.get_or_404(row_id)
    label = row.label
    db.session.delete(row)
    db.session.commit()
    log_action("DELETE_KIDZ_CORNER_AV_LINK", f"Deleted AV link '{label}' (ID: {row_id})")
    return jsonify({"message": "AV link deleted"}), 200
