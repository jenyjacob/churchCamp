from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import Camper, Expense, FamilyPayment, FeeRate
from db import db
from datetime import datetime
from utils.permissions import require_page_permission

finance_bp = Blueprint("finance", __name__)

DEFAULT_RATES = {
    1: 350.0,
    2: 390.0,
    3: 570.0,
    4: 700.0,
    5: 750.0
}

def get_fee_rates_dict():
    """Load fee rates from database. Seed defaults if empty."""
    try:
        rates = FeeRate.query.all()
        if not rates:
            for mc, pr in DEFAULT_RATES.items():
                exists = FeeRate.query.filter_by(member_count=mc).first()
                if not exists:
                    r = FeeRate(member_count=mc, price=pr)
                    db.session.add(r)
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
            rates = FeeRate.query.all()
        return {r.member_count: r.price for r in rates}
    except Exception:
        db.session.rollback()
        return DEFAULT_RATES

def calculate_family_fee(member_count, rates_dict):
    if member_count <= 0:
        return 0.0
    max_tier = max(rates_dict.keys()) if rates_dict else 5
    lookup_count = min(member_count, max_tier)
    return rates_dict.get(lookup_count, 750.0)

def parse_custom_activities(notes_str):
    import re, json
    if not notes_str:
        return {}
    match = re.search(r'<!-- ACTIVITIES_JSON:\s*(.*?)\s*-->', notes_str)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return {}

@finance_bp.route("/fees", methods=["GET"])
@jwt_required()
@require_page_permission("finance", "read")
def get_fees():
    import json
    # 1. Fetch all registered campers OR campers participating in activities
    campers = Camper.query.filter(
        (Camper.registration_status == "registered") | 
        (Camper.kayaking > 0) | 
        (Camper.boat_tour > 0)
    ).all()
    rates_dict = get_fee_rates_dict()

    # Load settings for activity names and prices
    settings_dict = {}
    try:
        from models import Setting
        db_settings = Setting.query.all()
        for s in db_settings:
            settings_dict[s.key] = s.value
    except Exception:
        pass

    try:
        activity_list = json.loads(settings_dict.get("activity_names", '["Kayaking", "Boat Tour"]'))
    except Exception:
        activity_list = ["Kayaking", "Boat Tour"]
    if len(activity_list) < 1 or not activity_list[0]:
        activity_list = ["Kayaking", "Boat Tour"]
    if len(activity_list) < 2 or not activity_list[1]:
        activity_list.append("Boat Tour")

    # Load prices for all activities
    activity_prices = []
    for i in range(len(activity_list)):
        price_key = f"activity_{i+1}_price"
        default_p = "10.0" if i == 0 else "20.0" if i == 1 else "15.0"
        try:
            price = float(settings_dict.get(price_key, default_p))
        except Exception:
            price = 15.0
        activity_prices.append(price)

    # 2. Group campers by family_group
    families = {}
    for camper in campers:
        # Treat unassigned family groups as individual single-person families
        fg = camper.family_group
        if not fg or fg.strip() == "":
            fg = f"single-{camper.id}"

        if fg not in families:
            families[fg] = {
                "family_group": fg,
                "members": [],
                "eligible_count": 0,
                "kayaking_spots": 0,
                "boat_tour_spots": 0,
                "custom_spots": {}
            }

        # Check eligibility: must be registered status and (age >= 5 or age is null)
        is_eligible = (camper.registration_status == "registered") and ((camper.age is None) or (camper.age >= 5))
        
        custom_acts = parse_custom_activities(camper.notes)

        families[fg]["members"].append({
            "id": camper.id,
            "first_name": camper.first_name,
            "last_name": camper.last_name,
            "full_name": f"{camper.first_name} {camper.last_name}",
            "age": camper.age,
            "is_eligible": is_eligible,
            "kayaking": camper.kayaking or 0,
            "boat_tour": camper.boat_tour or 0,
            "notes": camper.notes,
            "custom_activities": custom_acts
        })

        if is_eligible:
            families[fg]["eligible_count"] += 1
        
        families[fg]["kayaking_spots"] += camper.kayaking or 0
        families[fg]["boat_tour_spots"] += camper.boat_tour or 0
        for i in range(2, len(activity_list)):
            act_name = activity_list[i]
            spots = int(custom_acts.get(act_name, 0))
            families[fg]["custom_spots"][i] = families[fg]["custom_spots"].get(i, 0) + spots

    # 3. Fetch all family payment records from DB
    payments = {p.family_group: p for p in FamilyPayment.query.all()}

    # 4. Compute tiered fees and build results
    results = []
    total_expected = 0.0
    total_collected = 0.0

    for fg, family in families.items():
        eligible_count = family["eligible_count"]
        tiered_fee = calculate_family_fee(eligible_count, rates_dict)
        
        # Look up stored payment record
        pay_record = payments.get(fg)
        amount_paid = pay_record.amount_paid if pay_record else 0.0
        status = pay_record.status if pay_record else "unpaid"
        notes = pay_record.notes if pay_record else ""
        override_fee = pay_record.override_fee if pay_record else None

        if override_fee is not None:
            calculated_fee = override_fee
            is_overridden = True
        else:
            calculated_fee = tiered_fee
            is_overridden = False

        activity_fee = 0.0
        # Activity 1
        activity_fee += family["kayaking_spots"] * activity_prices[0]
        # Activity 2
        if len(activity_prices) > 1:
            activity_fee += family["boat_tour_spots"] * activity_prices[1]
        # Additional activities
        for i in range(2, len(activity_list)):
            spots = family["custom_spots"].get(i, 0)
            if len(activity_prices) > i:
                activity_fee += spots * activity_prices[i]

        total_expected += (calculated_fee + activity_fee)
        total_collected += amount_paid

        # Format display name of the family
        # e.g., "George Family" or list of names
        if fg.startswith("single-"):
            display_name = f"Single: {family['members'][0]['full_name']}"
        else:
            display_name = f"Family #{fg} ({family['members'][0]['last_name']})"

        results.append({
            "family_group": fg,
            "display_name": display_name,
            "members": family["members"],
            "eligible_count": eligible_count,
            "calculated_fee": calculated_fee,
            "tiered_fee": tiered_fee,
            "override_fee": override_fee,
            "is_overridden": is_overridden,
            "activity_fee": activity_fee,
            "activity_1_spots": family["kayaking_spots"],
            "activity_2_spots": family["boat_tour_spots"],
            "custom_spots": family["custom_spots"],
            "total_expected_fee": calculated_fee + activity_fee,
            "amount_paid": amount_paid,
            "status": status,
            "notes": notes
        })

    # Sort results so families needing action or custom groups are grouped nicely
    results.sort(key=lambda x: x["family_group"])

    return jsonify({
        "families": results,
        "total_expected_fees": total_expected,
        "total_collected_fees": total_collected,
        "activity_names": activity_list,
        "activity_prices": activity_prices
    }), 200

@finance_bp.route("/fees", methods=["POST"])
@jwt_required()
@require_page_permission("finance", "edit")
def update_fee_payment():
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    role = claims.get("role", "user")

    data = request.get_json()
    fg = data.get("family_group")
    amount_paid = data.get("amount_paid")
    status = data.get("status", "unpaid")
    notes = data.get("notes", "")
    override_fee_input = data.get("override_fee")

    if not fg:
        return jsonify({"error": "family_group is required"}), 400

    try:
        amount_paid = float(amount_paid) if amount_paid is not None else 0.0
    except ValueError:
        return jsonify({"error": "amount_paid must be a valid number"}), 400

    if status not in ["unpaid", "partial", "paid"]:
        return jsonify({"error": "status must be one of: unpaid, partial, paid"}), 400

    # Determine override fee value (None or Float)
    parsed_override_fee = None
    if override_fee_input is not None and str(override_fee_input).strip() != "":
        try:
            parsed_override_fee = float(override_fee_input)
        except ValueError:
            return jsonify({"error": "override_fee must be a valid number"}), 400

    payment = FamilyPayment.query.filter_by(family_group=fg).first()

    # Guard: only Owner is allowed to change override fee
    is_changing_override = False
    if payment:
        is_changing_override = (payment.override_fee != parsed_override_fee)
    else:
        is_changing_override = (parsed_override_fee is not None)

    if is_changing_override and role != "owner":
        return jsonify({"error": "Only the Owner is authorized to change individual family prices."}), 403

    if not payment:
        payment = FamilyPayment(
            family_group=fg,
            amount_paid=amount_paid,
            status=status,
            notes=notes,
            override_fee=parsed_override_fee
        )
        db.session.add(payment)
    else:
        payment.amount_paid = amount_paid
        payment.status = status
        payment.notes = notes
        if role == "owner":
            payment.override_fee = parsed_override_fee

    db.session.commit()

    from utils.logging import log_action
    log_action("RECORD_FEE_PAYMENT", f"Recorded payment for Family '{fg}': Paid ${amount_paid} (Status: {status}, Override Fee: {parsed_override_fee})")

    return jsonify({"payment": payment.to_dict()}), 200

# Expense API Endpoints
@finance_bp.route("/expenses", methods=["GET"])
@jwt_required()
@require_page_permission("finance", "read")
def get_expenses():
    expenses = Expense.query.order_by(Expense.date.desc()).all()
    return jsonify({"expenses": [e.to_dict() for e in expenses]}), 200

@finance_bp.route("/expenses", methods=["POST"])
@jwt_required()
@require_page_permission("finance", "edit")
def create_expense():
    data = request.get_json()
    desc = data.get("description")
    cat = data.get("category")
    amt = data.get("amount")
    date_str = data.get("date")

    if not desc or not cat or amt is None or not date_str:
        return jsonify({"error": "description, category, amount, and date are required"}), 400

    try:
        amount = float(amt)
        date_val = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as e:
        return jsonify({"error": f"Invalid date or amount formatting: {str(e)}"}), 400

    expense = Expense(
        description=desc.strip(),
        category=cat.strip(),
        amount=amount,
        date=date_val
    )
    db.session.add(expense)
    db.session.commit()

    from utils.logging import log_action
    log_action("CREATE_EXPENSE", f"Added expense: '{desc.strip()}' - ${amount} in category '{cat.strip()}'")

    return jsonify({"expense": expense.to_dict()}), 201

@finance_bp.route("/expenses/<int:expense_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("finance", "edit")
def update_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    data = request.get_json()

    if "description" in data:
        expense.description = data["description"].strip()
    if "category" in data:
        expense.category = data["category"].strip()
    if "amount" in data:
        try:
            expense.amount = float(data["amount"])
        except ValueError:
            return jsonify({"error": "amount must be a valid number"}), 400
    if "date" in data:
        try:
            expense.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "date must be in YYYY-MM-DD format"}), 400

    db.session.commit()

    from utils.logging import log_action
    log_action("UPDATE_EXPENSE", f"Updated expense ID {expense_id}: {expense.description} - ${expense.amount}")

    return jsonify({"expense": expense.to_dict()}), 200

@finance_bp.route("/expenses/<int:expense_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("finance", "edit")
def delete_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    desc = expense.description
    amt = expense.amount

    db.session.delete(expense)
    db.session.commit()

    from utils.logging import log_action
    log_action("DELETE_EXPENSE", f"Deleted expense ID {expense_id}: '{desc}' - ${amt}")

    return jsonify({"message": "Expense deleted successfully"}), 200

@finance_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_page_permission("finance", "read")
def get_finance_stats():
    # 1. Total expenses sum
    total_expenses = db.session.query(db.func.sum(Expense.amount)).scalar() or 0.0

    # 2. Total collected and expected fees (requires grouping and parsing registered/participating campers)
    campers = Camper.query.filter(
        (Camper.registration_status == "registered") | 
        (Camper.kayaking > 0) | 
        (Camper.boat_tour > 0)
    ).all()
    rates_dict = get_fee_rates_dict()
    payments = {p.family_group: p for p in FamilyPayment.query.all()}

    # Load settings for activity list and prices
    settings_dict = {}
    try:
        from models import Setting
        db_settings = Setting.query.all()
        for s in db_settings:
            settings_dict[s.key] = s.value
    except Exception:
        pass

    try:
        activity_list = json.loads(settings_dict.get("activity_names", '["Kayaking", "Boat Tour"]'))
    except Exception:
        activity_list = ["Kayaking", "Boat Tour"]
    if len(activity_list) < 1 or not activity_list[0]:
        activity_list = ["Kayaking", "Boat Tour"]
    if len(activity_list) < 2 or not activity_list[1]:
        activity_list.append("Boat Tour")

    activity_prices = []
    for i in range(len(activity_list)):
        price_key = f"activity_{i+1}_price"
        default_p = "10.0" if i == 0 else "20.0" if i == 1 else "15.0"
        try:
            price = float(settings_dict.get(price_key, default_p))
        except Exception:
            price = 15.0
        activity_prices.append(price)

    families = {}
    for camper in campers:
        fg = camper.family_group
        if not fg or fg.strip() == "":
            fg = f"single-{camper.id}"
        if fg not in families:
            families[fg] = {
                "eligible_count": 0,
                "kayaking_spots": 0,
                "boat_tour_spots": 0,
                "custom_spots": {}
            }
        is_eligible = (camper.registration_status == "registered") and ((camper.age is None) or (camper.age >= 5))
        if is_eligible:
            families[fg]["eligible_count"] += 1
        families[fg]["kayaking_spots"] += camper.kayaking or 0
        families[fg]["boat_tour_spots"] += camper.boat_tour or 0

        custom_acts = parse_custom_activities(camper.notes)
        for i in range(2, len(activity_list)):
            act_name = activity_list[i]
            spots = int(custom_acts.get(act_name, 0))
            families[fg]["custom_spots"][i] = families[fg]["custom_spots"].get(i, 0) + spots

    total_expected = 0.0
    for fg, info in families.items():
        eligible_count = info["eligible_count"]
        tiered_fee = calculate_family_fee(eligible_count, rates_dict)
        
        pay_record = payments.get(fg)
        override_fee = pay_record.override_fee if pay_record else None
        
        base_fee = override_fee if override_fee is not None else tiered_fee
        
        activity_fee = 0.0
        # Activity 1
        activity_fee += info["kayaking_spots"] * activity_prices[0]
        # Activity 2
        if len(activity_prices) > 1:
            activity_fee += info["boat_tour_spots"] * activity_prices[1]
        # Additional activities
        for i in range(2, len(activity_list)):
            spots = info["custom_spots"].get(i, 0)
            if len(activity_prices) > i:
                activity_fee += spots * activity_prices[i]
        
        total_expected += (base_fee + activity_fee)

    total_collected = db.session.query(db.func.sum(FamilyPayment.amount_paid)).scalar() or 0.0

    return jsonify({
        "total_expenses": total_expenses,
        "total_expected_fees": total_expected,
        "total_collected_fees": total_collected,
        "net_balance": total_collected - total_expenses
    }), 200

# Endpoint to fetch configured fee rates
@finance_bp.route("/rates", methods=["GET"])
@jwt_required()
@require_page_permission("finance", "read")
def get_fee_rates():
    rates_dict = get_fee_rates_dict()
    return jsonify({
        "rates": [{"member_count": mc, "price": pr} for mc, pr in sorted(rates_dict.items())]
    }), 200

# Endpoint to save/update fee rates
@finance_bp.route("/rates", methods=["POST"])
@jwt_required()
@require_page_permission("finance", "edit")
def save_fee_rates():
    data = request.get_json()
    rates_list = data.get("rates") # e.g. [{"member_count": 1, "price": 350}, ...]

    if not rates_list or not isinstance(rates_list, list):
        return jsonify({"error": "rates list is required"}), 400

    for item in rates_list:
        mc = item.get("member_count")
        pr = item.get("price")
        if mc is None or pr is None:
            return jsonify({"error": "Each rate must contain member_count and price"}), 400
        try:
            mc = int(mc)
            pr = float(pr)
        except ValueError:
            return jsonify({"error": "member_count must be int and price must be float/number"}), 400

        # Save or update in DB
        rate = FeeRate.query.filter_by(member_count=mc).first()
        if not rate:
            rate = FeeRate(member_count=mc, price=pr)
            db.session.add(rate)
        else:
            rate.price = pr

    db.session.commit()

    from utils.logging import log_action
    log_action("UPDATE_FEE_RATES", "Updated dynamic family fee tier pricing rates")

    # Return refreshed rates dict
    rates_dict = get_fee_rates_dict()
    return jsonify({
        "message": "Fee rates saved successfully",
        "rates": [{"member_count": mc, "price": pr} for mc, pr in sorted(rates_dict.items())]
    }), 200
