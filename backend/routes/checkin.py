from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Camper, CheckIn
from db import db
from datetime import datetime
from utils.permissions import require_page_permission

checkin_bp = Blueprint("checkin", __name__)

@checkin_bp.route("/", methods=["POST"])
@jwt_required()
@require_page_permission("checkin", "edit")
def check_in():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    camper_id = data.get("camper_id")

    if not camper_id:
        return jsonify({"error": "camper_id is required"}), 400

    camper = Camper.query.get_or_404(camper_id)

    # Check if already checked in
    active = CheckIn.query.filter_by(
        camper_id=camper_id, checked_out_at=None
    ).first()
    if active:
        return jsonify({"error": "Camper is already checked in"}), 409

    checkin = CheckIn(
        camper_id=camper_id,
        checked_in_by=user_id,
        notes=data.get("notes"),
    )
    db.session.add(checkin)

    # Automatically set waiver as submitted upon check-in
    if not camper.waiver_submitted:
        camper.waiver_submitted = True
        if camper.family_group:
            Camper.query.filter_by(family_group=camper.family_group).update({"waiver_submitted": True})

    db.session.commit()
    from utils.logging import log_action
    log_action("CHECK_IN", f"Checked in camper {camper.first_name} {camper.last_name} (ID: {camper.id})")
    return jsonify({"checkin": checkin.to_dict(), "camper": camper.to_dict()}), 201

@checkin_bp.route("/<int:checkin_id>/checkout", methods=["POST"])
@jwt_required()
@require_page_permission("checkin", "edit")
def check_out(checkin_id):
    user_id = int(get_jwt_identity())
    checkin = CheckIn.query.get_or_404(checkin_id)

    if checkin.checked_out_at:
        return jsonify({"error": "Already checked out"}), 409

    checkin.checked_out_at = datetime.utcnow()
    checkin.checked_out_by = user_id
    db.session.commit()
    from utils.logging import log_action
    log_action("CHECK_OUT", f"Checked out camper {checkin.camper.first_name} {checkin.camper.last_name} (ID: {checkin.camper_id})")

    return jsonify({"checkin": checkin.to_dict()}), 200

@checkin_bp.route("/", methods=["GET"])
@jwt_required()
@require_page_permission("checkin", "read")
def get_checkins():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    active_only = request.args.get("active_only", "false").lower() == "true"

    query = CheckIn.query
    if active_only:
        query = query.filter(CheckIn.checked_out_at.is_(None))

    paginated = query.order_by(CheckIn.checked_in_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "checkins": [c.to_dict() for c in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    }), 200

@checkin_bp.route("/camper/<int:camper_id>", methods=["GET"])
@jwt_required()
@require_page_permission("checkin", "read")
def get_camper_checkins(camper_id):
    checkins = CheckIn.query.filter_by(camper_id=camper_id).order_by(
        CheckIn.checked_in_at.desc()
    ).all()
    return jsonify({"checkins": [c.to_dict() for c in checkins]}), 200

@checkin_bp.route("/<int:checkin_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("checkin", "edit")
def delete_checkin(checkin_id):
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    if claims.get("role") not in ["admin", "owner"]:
        return jsonify({"error": "Admin access required"}), 403

    checkin = CheckIn.query.get_or_404(checkin_id)
    camper_id = checkin.camper_id
    camper = Camper.query.get(camper_id)
    camper_name = f"{camper.first_name} {camper.last_name}" if camper else "Unknown"

    db.session.delete(checkin)

    # Reset waiver submission status upon check-in reset
    if camper:
        if camper.family_group:
            # Check if any other family member is currently active on site
            other_checked_in = db.session.query(Camper).join(CheckIn).filter(
                Camper.family_group == camper.family_group,
                Camper.id != camper.id,
                CheckIn.id != checkin.id,
                CheckIn.checked_out_at.is_(None)
            ).first()
            
            if not other_checked_in:
                Camper.query.filter_by(family_group=camper.family_group).update({"waiver_submitted": False})
        else:
            camper.waiver_submitted = False

    db.session.commit()

    # Log action
    from utils.logging import log_action
    log_action("RESET_CHECK_IN", f"Reset check-in record for camper {camper_name} (ID: {camper_id})")

    return jsonify({"message": "Check-in reset successfully"}), 200
