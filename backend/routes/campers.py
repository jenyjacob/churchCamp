from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import Camper, Tshirt
from db import db
from utils.limiter import rate_limit

from utils.permissions import require_page_permission

campers_bp = Blueprint("campers", __name__)

def require_admin():
    claims = get_jwt()
    return claims.get("role") in ["admin", "owner"]

@campers_bp.route("/", methods=["GET"])
@jwt_required()
@require_page_permission("campers", "read")
def get_campers():
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))

    query = Camper.query

    if search:
        like = f"%{search}%"
        # Find all family groups for campers matching the search criteria
        matched_families = db.session.query(Camper.family_group).filter(
            db.or_(
                Camper.first_name.ilike(like),
                Camper.last_name.ilike(like),
                Camper.guardian_name.ilike(like),
                Camper.family_group.ilike(like),
            )
        ).filter(Camper.family_group.isnot(None), Camper.family_group != '').distinct().all()
        
        family_ids = [f[0] for f in matched_families if f[0]]
        
        if family_ids:
            query = query.filter(
                db.or_(
                    Camper.first_name.ilike(like),
                    Camper.last_name.ilike(like),
                    Camper.guardian_name.ilike(like),
                    Camper.family_group.ilike(like),
                    Camper.family_group.in_(family_ids)
                )
            )
        else:
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
    ordered_query = query.order_by(
        order_by_clause,
        Camper.family_group,
        Camper.last_name,
        Camper.first_name
    )

    if per_page == -1:
        items = ordered_query.all()
        return jsonify({
            "campers": [c.to_dict() for c in items],
            "total": len(items),
            "pages": 1,
            "page": 1,
        }), 200

    paginated = ordered_query.paginate(
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
@require_page_permission("campers", "read")
def get_camper(camper_id):
    camper = Camper.query.get_or_404(camper_id)
    return jsonify({"camper": camper.to_dict()}), 200

@campers_bp.route("/", methods=["POST"])
@jwt_required()
@require_page_permission("campers", "edit")
def create_camper():
    data = request.get_json()
    data = {k: (None if v == "" else v) for k, v in data.items()}
    if not data.get("first_name") or not data.get("last_name"):
        return jsonify({"error": "First and last name are required"}), 400

    family_group = data.get("family_group")
    waiver_status = data.get("waiver_submitted", False)
    if family_group and not waiver_status:
        existing_family_member = Camper.query.filter_by(family_group=family_group, waiver_submitted=True).first()
        if existing_family_member:
            waiver_status = True

    kayaking = 0
    if data.get("kayaking") is not None:
        try:
            kayaking = int(data.get("kayaking"))
        except (ValueError, TypeError):
            pass

    boat_tour = 0
    if data.get("boat_tour") is not None:
        try:
            boat_tour = int(data.get("boat_tour"))
        except (ValueError, TypeError):
            pass

    camper = Camper(
        first_name=data["first_name"],
        last_name=data["last_name"],
        date_of_birth=data.get("date_of_birth"),
        age=data.get("age"),
        gender=data.get("gender"),
        cabin_group=data.get("cabin_group"),
        family_group=family_group,
        guardian_name=data.get("guardian_name"),
        guardian_phone=data.get("guardian_phone"),
        allergies=data.get("allergies"),
        waiver_submitted=waiver_status,
        registration_status=data.get("registration_status", "registered"),
        notes=data.get("notes"),
        kayaking=kayaking,
        boat_tour=boat_tour,
    )
    db.session.add(camper)
    db.session.commit()
    from utils.logging import log_action
    log_action("REGISTER_CAMPER", f"Registered camper {camper.first_name} {camper.last_name} (ID: {camper.id})")
    return jsonify({"camper": camper.to_dict()}), 201

@campers_bp.route("/public-signup", methods=["POST"])
@rate_limit(5, 60)
def public_signup():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No registration details provided"}), 400

    phone = data.get("phone")
    email = data.get("email")
    attendees = data.get("attendees", [])

    if not phone:
        return jsonify({"error": "Guardian phone number is required"}), 400

    # Auto assign family group starting from 1001
    all_family_groups = db.session.query(Camper.family_group).filter(Camper.family_group.isnot(None)).distinct().all()
    max_num = 1000
    for (fg,) in all_family_groups:
        if fg and fg.isdigit():
            max_num = max(max_num, int(fg))
    family_group = str(max_num + 1)

    if not attendees:
        return jsonify({"error": "At least one attendee is required"}), 400

    created_campers = []
    
    waiver_status = False
    existing_family_member = Camper.query.filter_by(family_group=family_group, waiver_submitted=True).first()
    if existing_family_member:
        waiver_status = True

    for att in attendees:
        first_name = att.get("first_name")
        last_name = att.get("last_name")
        age = att.get("age")
        gender = att.get("gender")
        allergies = att.get("allergies")
        tshirt_size = att.get("tshirt_size")

        kayaking = 0
        if att.get("kayaking") is not None:
            try:
                kayaking = int(att.get("kayaking"))
            except (ValueError, TypeError):
                pass

        boat_tour = 0
        if att.get("boat_tour") is not None:
            try:
                boat_tour = int(att.get("boat_tour"))
            except (ValueError, TypeError):
                pass

        if not first_name or not last_name:
            return jsonify({"error": "First and last name are required for all attendees"}), 400

        parsed_age = None
        if age is not None and str(age).strip() != "":
            try:
                parsed_age = int(age)
            except ValueError:
                return jsonify({"error": f"Invalid age for attendee {first_name}"}), 400

            if parsed_age < 18 and (parsed_age is None or parsed_age < 0):
                return jsonify({"error": f"Valid age is required for child attendee {first_name}"}), 400

        camper = Camper(
            first_name=first_name,
            last_name=last_name,
            age=parsed_age,
            gender=gender if gender in ["male", "female"] else None,
            family_group=str(family_group),
            guardian_name="Self" if parsed_age is None or parsed_age >= 18 else None,
            guardian_phone=phone,
            allergies=allergies,
            waiver_submitted=waiver_status,
            registration_status="registered",
            notes=f"Public Signup. Email: {email or 'N/A'}",
            kayaking=kayaking,
            boat_tour=boat_tour
        )
        db.session.add(camper)
        db.session.flush()

        if tshirt_size:
            tshirt = Tshirt(
                camper_id=camper.id,
                attendee_name=f"{first_name} {last_name}",
                tshirt_size=tshirt_size
            )
            db.session.add(tshirt)

        created_campers.append(camper)

    db.session.commit()

    from utils.logging import log_action
    log_action("PUBLIC_SIGNUP", f"Public signup for family group {family_group} with {len(created_campers)} attendees")

    return jsonify({
        "message": "Registration successful!",
        "campers": [c.to_dict() for c in created_campers]
    }), 201

@campers_bp.route("/<int:camper_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("campers", "edit")
def update_camper(camper_id):
    claims = get_jwt()
    role = claims.get("role")
    
    if role not in ["admin", "owner", "director"]:
        return jsonify({"error": "Admin or Director access required"}), 403

    camper = Camper.query.get_or_404(camper_id)
    data = request.get_json()
    data = {k: (None if v == "" else v) for k, v in data.items()}

    # Camp Director can only modify outdoor activities
    if role == "director":
        for field in ["kayaking", "boat_tour"]:
            if field in data:
                try:
                    val = int(data[field]) if data[field] is not None else 0
                except (ValueError, TypeError):
                    val = 0
                setattr(camper, field, val)
    else:
        fields = [
            "first_name", "last_name", "date_of_birth", "age", "gender", "grade",
            "cabin_group", "session", "family_group", "guardian_name", "guardian_phone", "guardian_email",
            "emergency_contact", "emergency_phone", "allergies", "medical_notes",
            "medications", "registration_status", "payment_status", "notes", "waiver_submitted",
            "kayaking", "boat_tour"
        ]
        
        waiver_changed = "waiver_submitted" in data and data["waiver_submitted"] != camper.waiver_submitted

        for field in fields:
            if field in data:
                val = data[field]
                if field in ["kayaking", "boat_tour"]:
                    try:
                        val = int(val) if val is not None else 0
                    except (ValueError, TypeError):
                        val = 0
                setattr(camper, field, val)

        if "tshirt_size" in data:
            t_size = data["tshirt_size"]
            if t_size:
                tshirt = Tshirt.query.filter_by(camper_id=camper.id).first()
                if tshirt:
                    tshirt.tshirt_size = t_size
                    tshirt.attendee_name = f"{camper.first_name} {camper.last_name}"
                else:
                    tshirt = Tshirt(
                        camper_id=camper.id,
                        attendee_name=f"{camper.first_name} {camper.last_name}",
                        tshirt_size=t_size
                    )
                    db.session.add(tshirt)
            else:
                Tshirt.query.filter_by(camper_id=camper.id).delete()

        if waiver_changed and camper.family_group:
            Camper.query.filter_by(family_group=camper.family_group).update({"waiver_submitted": camper.waiver_submitted})
            from utils.logging import log_action
            log_action("UPDATE_FAMILY_WAIVER", f"Synchronized waiver submission status ({camper.waiver_submitted}) for Family Group #{camper.family_group}")

    db.session.commit()
    from utils.logging import log_action
    log_action("UPDATE_CAMPER", f"Updated camper {camper.first_name} {camper.last_name} (ID: {camper.id})")
    return jsonify({"camper": camper.to_dict()}), 200

@campers_bp.route("/<int:camper_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("campers", "edit")
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
    waivers_submitted = Camper.query.filter_by(waiver_submitted=True).count()
    total_families = db.session.query(Camper.family_group).filter(
        Camper.family_group.isnot(None),
        Camper.family_group != ""
    ).distinct().count()

    return jsonify({
        "total_registered": total,
        "status_registered": registered,
        "checked_in": checked_in,
        "waivers_submitted": waivers_submitted,
        "total_families": total_families,
    }), 200

@campers_bp.route("/outdoor", methods=["GET"])
@jwt_required()
def get_outdoor_activities():
    campers = Camper.query.filter(
        (Camper.kayaking > 0) | (Camper.boat_tour > 0)
    ).all()
    
    total_kayaking = sum(c.kayaking for c in campers)
    total_boat_tour = sum(c.boat_tour for c in campers)
    
    return jsonify({
        "campers": [c.to_dict() for c in campers],
        "total_kayaking": total_kayaking,
        "total_boat_tour": total_boat_tour
    }), 200
