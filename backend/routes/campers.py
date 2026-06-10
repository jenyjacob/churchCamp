from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import Camper
from db import db

campers_bp = Blueprint("campers", __name__)

def require_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"

@campers_bp.route("/", methods=["GET"])
@jwt_required()
def get_campers():
    search = request.args.get("search", "").strip()
    session = request.args.get("session", "").strip()
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
            )
        )
    if session:
        query = query.filter(Camper.session == session)
    if status:
        query = query.filter(Camper.registration_status == status)

    paginated = query.order_by(Camper.last_name, Camper.first_name).paginate(
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
    if not data.get("first_name") or not data.get("last_name"):
        return jsonify({"error": "First and last name are required"}), 400

    camper = Camper(
        first_name=data["first_name"],
        last_name=data["last_name"],
        date_of_birth=data.get("date_of_birth"),
        age=data.get("age"),
        gender=data.get("gender"),
        grade=data.get("grade"),
        cabin_group=data.get("cabin_group"),
        session=data.get("session"),
        guardian_name=data.get("guardian_name"),
        guardian_phone=data.get("guardian_phone"),
        guardian_email=data.get("guardian_email"),
        emergency_contact=data.get("emergency_contact"),
        emergency_phone=data.get("emergency_phone"),
        allergies=data.get("allergies"),
        medical_notes=data.get("medical_notes"),
        medications=data.get("medications"),
        registration_status=data.get("registration_status", "registered"),
        payment_status=data.get("payment_status", "unpaid"),
        notes=data.get("notes"),
    )
    db.session.add(camper)
    db.session.commit()
    return jsonify({"camper": camper.to_dict()}), 201

@campers_bp.route("/<int:camper_id>", methods=["PUT"])
@jwt_required()
def update_camper(camper_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    camper = Camper.query.get_or_404(camper_id)
    data = request.get_json()

    fields = [
        "first_name", "last_name", "date_of_birth", "age", "gender", "grade",
        "cabin_group", "session", "guardian_name", "guardian_phone", "guardian_email",
        "emergency_contact", "emergency_phone", "allergies", "medical_notes",
        "medications", "registration_status", "payment_status", "notes"
    ]
    for field in fields:
        if field in data:
            setattr(camper, field, data[field])

    db.session.commit()
    return jsonify({"camper": camper.to_dict()}), 200

@campers_bp.route("/<int:camper_id>", methods=["DELETE"])
@jwt_required()
def delete_camper(camper_id):
    if not require_admin():
        return jsonify({"error": "Admin access required"}), 403

    camper = Camper.query.get_or_404(camper_id)
    db.session.delete(camper)
    db.session.commit()
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
    paid = Camper.query.filter_by(payment_status="paid").count()
    return jsonify({
        "total_registered": total,
        "status_registered": registered,
        "checked_in": checked_in,
        "paid": paid,
    }), 200
