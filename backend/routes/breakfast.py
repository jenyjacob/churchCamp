import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import BreakfastOrder, Camper
from db import db
from utils.permissions import require_page_permission
from utils.logging import log_action

breakfast_bp = Blueprint("breakfast", __name__)


@breakfast_bp.route("/answered-camper-ids", methods=["GET"])
@jwt_required()
@require_page_permission("checkin", "read")
def get_answered_camper_ids():
    """Camper IDs that have already been asked the breakfast question
    (regardless of yes/no), so Check-In doesn't re-prompt them."""
    ids = [row[0] for row in db.session.query(BreakfastOrder.camper_id).all()]
    return jsonify({"camper_ids": ids}), 200


@breakfast_bp.route("/orders", methods=["GET"])
@jwt_required()
@require_page_permission("checkin", "read")
def list_breakfast_orders():
    """All recorded breakfast orders, keyed by camper, for display alongside
    the Currently On Site list."""
    orders = BreakfastOrder.query.all()
    return jsonify({"orders": [o.to_dict() for o in orders]}), 200


@breakfast_bp.route("/orders", methods=["POST"])
@jwt_required()
@require_page_permission("checkin", "edit")
def save_breakfast_order():
    """Records one shared breakfast answer for a group of campers checked in
    together (e.g. a family). The combined item counts are stored on only the
    first camper in the group so per-item totals in the summary report aren't
    multiplied by group size; every camper in the group is still marked as
    individually answered so nobody gets re-prompted later."""
    data = request.get_json() or {}
    camper_ids = data.get("camper_ids")
    wants_breakfast = bool(data.get("wants_breakfast"))
    items = data.get("items") or {}

    if not camper_ids or not isinstance(camper_ids, list):
        return jsonify({"error": "camper_ids (a non-empty list) is required"}), 400

    campers = Camper.query.filter(Camper.id.in_(camper_ids)).all()
    campers_by_id = {c.id: c for c in campers}
    if not campers:
        return jsonify({"error": "No matching campers found"}), 404

    # Only keep positive integer counts for items actually selected
    clean_items = {}
    if wants_breakfast:
        for name, count in items.items():
            try:
                c = int(count)
            except (TypeError, ValueError):
                continue
            if c > 0:
                clean_items[str(name)] = c

    user_id = get_jwt_identity()
    saved_names = []
    holder_assigned = False
    for camper_id in camper_ids:
        camper = campers_by_id.get(camper_id)
        if not camper:
            continue

        order = BreakfastOrder.query.filter_by(camper_id=camper_id).first()
        if not order:
            order = BreakfastOrder(camper_id=camper_id)
            db.session.add(order)

        order.wants_breakfast = wants_breakfast
        # First camper in the group "holds" the combined item counts; the rest
        # are marked answered with empty items so totals aren't double-counted.
        order.items = json.dumps(clean_items if not holder_assigned else {})
        holder_assigned = True
        order.recorded_by = int(user_id) if user_id else None
        saved_names.append(f"{camper.first_name} {camper.last_name}")

    db.session.commit()

    log_action(
        "RECORD_BREAKFAST_ORDER",
        f"Recorded Sunday breakfast preference for {', '.join(saved_names)}: "
        f"{'wants breakfast (' + ', '.join(f'{v}x {k}' for k, v in clean_items.items()) + ')' if wants_breakfast and clean_items else ('wants breakfast' if wants_breakfast else 'no breakfast')}."
    )

    return jsonify({"message": "Breakfast preference saved."}), 200


@breakfast_bp.route("/summary", methods=["GET"])
@jwt_required()
@require_page_permission("checkin", "read")
def get_breakfast_summary():
    """Aggregated counts per menu item, plus a per-family/camper breakdown of
    who's actually getting breakfast - grouped by family_group since that's
    how the order was originally captured (one shared answer per check-in
    batch), rather than pretending each member ordered independently."""
    orders = BreakfastOrder.query.join(Camper).filter(BreakfastOrder.wants_breakfast == True).all()  # noqa: E712

    item_totals = {}
    groups = {}
    for order in orders:
        camper = order.camper
        if not camper:
            continue
        order_items = order.get_items()
        for name, count in order_items.items():
            item_totals[name] = item_totals.get(name, 0) + count

        family_group = camper.family_group or None
        key = family_group if family_group else f"individual-{order.camper_id}"
        if key not in groups:
            groups[key] = {"family_group": family_group, "members": [], "items": {}}
        groups[key]["members"].append(f"{camper.first_name} {camper.last_name}")
        for name, count in order_items.items():
            groups[key]["items"][name] = groups[key]["items"].get(name, 0) + count

    family_breakdown = sorted(
        groups.values(),
        key=lambda g: (g["family_group"] is None, g["family_group"] or "", g["members"][0] if g["members"] else "")
    )

    total_answered = BreakfastOrder.query.count()

    return jsonify({
        "total_wants_breakfast": len(orders),
        "total_answered": total_answered,
        "item_totals": item_totals,
        "family_breakdown": family_breakdown
    }), 200
