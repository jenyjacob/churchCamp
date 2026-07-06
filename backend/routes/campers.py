from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import Camper
from db import db

campers_bp = Blueprint("campers", __name__)

def require_admin():
    claims = get_jwt()
    return claims.get("role") in ["admin", "owner"]

@campers_bp.route("/", methods=["GET"])
@jwt_required()
def get_campers():
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = Camper.query

    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                Camper.first_name.ilike(like),
                Camper.last_name.ilike(like),
                Camper.guardian_name.ilike(like),
                Camper.family_group.ilike(like),
            )
        )
    if status:
        query = query.filter(Camper.registration_status == status)

    order_by_clause = db.case(
        (db.or_(Camper.family_group.is_(None), Camper.family_group == ''), 1),
        else_=0
    )
    paginated = query.order_by(
        order_by_clause,
        Camper.family_group,
        Camper.last_name,
        Camper.first_name
    ).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "campers": [c.to_dict() for c in paginated.items],
        "total": paginated.total,
        "pages": paginated.pages,
        "page": page,
    }), 200

@campers_bp.route("/<int:camper_id>", methods=["GET"])
@jwt_required()
def get_camper(camper_id):
    camper = Camper.query.get_or_404(camper_id)
    return jsonify({"camper": camper.to_dict()}), 200

@campers_bp.route("/", methods=["POST"])
@jwt_required()
def create_camper():
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    data = {k: (None if v == "" else v) for k, v in data.items()}
    if not data.get("first_name") or not data.get("last_name"):
        return jsonify({"error": "First and last name are required"}), 400

    camper = Camper(
        first_name=data["first_name"],
        last_name=data["last_name"],
        date_of_birth=data.get("date_of_birth"),
        age=data.get("age"),
        gender=data.get("gender"),
        cabin_group=data.get("cabin_group"),
        family_group=data.get("family_group"),
        guardian_name=data.get("guardian_name"),
        guardian_phone=data.get("guardian_phone"),
        allergies=data.get("allergies"),
        registration_status=data.get("registration_status", "registered"),
        notes=data.get("notes"),
    )
    db.session.add(camper)
    db.session.commit()
    from utils.logging import log_action
    log_action("REGISTER_CAMPER", f"Registered camper {camper.first_name} {camper.last_name} (ID: {camper.id})")
    return jsonify({"camper": camper.to_dict()}), 201

@campers_bp.route("/<int:camper_id>", methods=["PUT"])
@jwt_required()
def update_camper(camper_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    camper = Camper.query.get_or_404(camper_id)
    data = request.get_json()
    data = {k: (None if v == "" else v) for k, v in data.items()}

    fields = [
        "first_name", "last_name", "date_of_birth", "age", "gender", "grade",
        "cabin_group", "session", "family_group", "guardian_name", "guardian_phone", "guardian_email",
        "emergency_contact", "emergency_phone", "allergies", "medical_notes",
        "medications", "registration_status", "payment_status", "notes"
    ]
    for field in fields:
        if field in data:
            setattr(camper, field, data[field])

    db.session.commit()
    from utils.logging import log_action
    log_action("UPDATE_CAMPER", f"Updated camper {camper.first_name} {camper.last_name} (ID: {camper.id})")
    return jsonify({"camper": camper.to_dict()}), 200

@campers_bp.route("/<int:camper_id>", methods=["DELETE"])
@jwt_required()
def delete_camper(camper_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    camper = Camper.query.get_or_404(camper_id)
    camper_name = f"{camper.first_name} {camper.last_name}"
    db.session.delete(camper)
    db.session.commit()
    from utils.logging import log_action
    log_action("DELETE_CAMPER", f"Deleted camper {camper_name} (ID: {camper_id})")
    return jsonify({"message": "Camper deleted"}), 200

@campers_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    total = Camper.query.count()
    registered = Camper.query.filter_by(registration_status="registered").count()
    checked_in = sum(
        1 for c in Camper.query.all()
        if any(ci.checked_out_at is None for ci in c.checkins)
    )
    return jsonify({
        "total_registered": total,
        "status_registered": registered,
        "checked_in": checked_in,
    }), 200
