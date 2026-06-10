from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Camper, CheckIn
from db import db
from datetime import datetime

checkin_bp = Blueprint("checkin", __name__)

@checkin_bp.route("/", methods=["POST"])
@jwt_required()
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
    db.session.commit()

    return jsonify({"checkin": checkin.to_dict(), "camper": camper.to_dict()}), 201

@checkin_bp.route("/<int:checkin_id>/checkout", methods=["POST"])
@jwt_required()
def check_out(checkin_id):
    user_id = int(get_jwt_identity())
    checkin = CheckIn.query.get_or_404(checkin_id)

    if checkin.checked_out_at:
        return jsonify({"error": "Already checked out"}), 409

    checkin.checked_out_at = datetime.utcnow()
    checkin.checked_out_by = user_id
    db.session.commit()

    return jsonify({"checkin": checkin.to_dict()}), 200

@checkin_bp.route("/", methods=["GET"])
@jwt_required()
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
def get_camper_checkins(camper_id):
    checkins = CheckIn.query.filter_by(camper_id=camper_id).order_by(
        CheckIn.checked_in_at.desc()
    ).all()
    return jsonify({"checkins": [c.to_dict() for c in checkins]}), 200
