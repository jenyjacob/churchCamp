from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import RunOfShowBlock, RosterTeam, SetupTask, ContingencyPlan
from db import db
from utils.permissions import require_page_permission
from utils.logging import log_action

retreat_ops_bp = Blueprint("retreat_ops", __name__)

VALID_STATUSES = ["Not started", "In progress", "Done", "Delayed"]


# ---------------------------------------------------------------------------
# Run of Show
# ---------------------------------------------------------------------------

@retreat_ops_bp.route("/run-of-show", methods=["GET"])
@jwt_required()
@require_page_permission("retreat_ops", "read")
def list_run_of_show():
    blocks = RunOfShowBlock.query.order_by(
        RunOfShowBlock.day.asc(), RunOfShowBlock.order_index.asc(), RunOfShowBlock.id.asc()
    ).all()
    return jsonify({"blocks": [b.to_dict() for b in blocks]}), 200


@retreat_ops_bp.route("/run-of-show", methods=["POST"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def create_run_of_show():
    data = request.get_json() or {}
    if not data.get("day") or not data.get("block_title"):
        return jsonify({"error": "Day and block title are required"}), 400

    status = data.get("status", "Not started")
    if status not in VALID_STATUSES:
        status = "Not started"

    block = RunOfShowBlock(
        day=data["day"].strip(),
        order_index=data.get("order_index", 0),
        start_time=data.get("start_time"),
        end_time=data.get("end_time"),
        block_title=data["block_title"].strip(),
        location=data.get("location"),
        point_person=data.get("point_person"),
        supporting_teams=data.get("supporting_teams"),
        setup_time=data.get("setup_time"),
        setup_notes=data.get("setup_notes"),
        tech_cues=data.get("tech_cues"),
        kidz_corner_note=data.get("kidz_corner_note"),
        contingency=data.get("contingency"),
        status=status,
    )
    db.session.add(block)
    db.session.commit()
    log_action("CREATE_RUN_OF_SHOW_BLOCK", f"Created block '{block.block_title}' on {block.day}")
    return jsonify({"block": block.to_dict()}), 201


@retreat_ops_bp.route("/run-of-show/<int:block_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def update_run_of_show(block_id):
    block = RunOfShowBlock.query.get_or_404(block_id)
    data = request.get_json() or {}

    for field in [
        "day", "start_time", "end_time", "block_title", "location",
        "point_person", "supporting_teams", "setup_time", "setup_notes",
        "tech_cues", "kidz_corner_note", "contingency",
    ]:
        if field in data:
            setattr(block, field, data[field])

    if "order_index" in data:
        block.order_index = data["order_index"]

    if "status" in data:
        block.status = data["status"] if data["status"] in VALID_STATUSES else block.status

    db.session.commit()
    log_action("UPDATE_RUN_OF_SHOW_BLOCK", f"Updated block '{block.block_title}' (ID: {block.id})")
    return jsonify({"block": block.to_dict()}), 200


@retreat_ops_bp.route("/run-of-show/<int:block_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def delete_run_of_show(block_id):
    block = RunOfShowBlock.query.get_or_404(block_id)
    title = block.block_title
    db.session.delete(block)
    db.session.commit()
    log_action("DELETE_RUN_OF_SHOW_BLOCK", f"Deleted block '{title}' (ID: {block_id})")
    return jsonify({"message": "Block deleted"}), 200


# ---------------------------------------------------------------------------
# Roster (staff / volunteer teams)
# ---------------------------------------------------------------------------

@retreat_ops_bp.route("/roster", methods=["GET"])
@jwt_required()
@require_page_permission("retreat_ops", "read")
def list_roster():
    teams = RosterTeam.query.order_by(RosterTeam.name.asc()).all()
    return jsonify({"teams": [t.to_dict() for t in teams]}), 200


@retreat_ops_bp.route("/roster", methods=["POST"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def create_roster_team():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Team name is required"}), 400

    team = RosterTeam(
        name=data["name"].strip(),
        lead=data.get("lead"),
        phone=data.get("phone"),
        members=data.get("members"),
        owns_blocks=data.get("owns_blocks"),
        notes=data.get("notes"),
    )
    db.session.add(team)
    db.session.commit()
    log_action("CREATE_ROSTER_TEAM", f"Created roster team '{team.name}'")
    return jsonify({"team": team.to_dict()}), 201


@retreat_ops_bp.route("/roster/<int:team_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def update_roster_team(team_id):
    team = RosterTeam.query.get_or_404(team_id)
    data = request.get_json() or {}
    for field in ["name", "lead", "phone", "members", "owns_blocks", "notes"]:
        if field in data:
            setattr(team, field, data[field])
    db.session.commit()
    log_action("UPDATE_ROSTER_TEAM", f"Updated roster team '{team.name}' (ID: {team.id})")
    return jsonify({"team": team.to_dict()}), 200


@retreat_ops_bp.route("/roster/<int:team_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def delete_roster_team(team_id):
    team = RosterTeam.query.get_or_404(team_id)
    name = team.name
    db.session.delete(team)
    db.session.commit()
    log_action("DELETE_ROSTER_TEAM", f"Deleted roster team '{name}' (ID: {team_id})")
    return jsonify({"message": "Team deleted"}), 200


# ---------------------------------------------------------------------------
# Setup & Supplies checklist
# ---------------------------------------------------------------------------

@retreat_ops_bp.route("/setup-tasks", methods=["GET"])
@jwt_required()
@require_page_permission("retreat_ops", "read")
def list_setup_tasks():
    tasks = SetupTask.query.order_by(SetupTask.id.asc()).all()
    return jsonify({"tasks": [t.to_dict() for t in tasks]}), 200


@retreat_ops_bp.route("/setup-tasks", methods=["POST"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def create_setup_task():
    data = request.get_json() or {}
    if not data.get("item"):
        return jsonify({"error": "Item/task is required"}), 400

    task = SetupTask(
        item=data["item"].strip(),
        for_block=data.get("for_block"),
        owner=data.get("owner"),
        deadline=data.get("deadline"),
        qty_detail=data.get("qty_detail"),
        done=bool(data.get("done", False)),
    )
    db.session.add(task)
    db.session.commit()
    log_action("CREATE_SETUP_TASK", f"Created setup task '{task.item}'")
    return jsonify({"task": task.to_dict()}), 201


@retreat_ops_bp.route("/setup-tasks/<int:task_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def update_setup_task(task_id):
    task = SetupTask.query.get_or_404(task_id)
    data = request.get_json() or {}
    for field in ["item", "for_block", "owner", "deadline", "qty_detail"]:
        if field in data:
            setattr(task, field, data[field])
    if "done" in data:
        task.done = bool(data["done"])
    db.session.commit()
    log_action("UPDATE_SETUP_TASK", f"Updated setup task '{task.item}' (ID: {task.id})")
    return jsonify({"task": task.to_dict()}), 200


@retreat_ops_bp.route("/setup-tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def delete_setup_task(task_id):
    task = SetupTask.query.get_or_404(task_id)
    item = task.item
    db.session.delete(task)
    db.session.commit()
    log_action("DELETE_SETUP_TASK", f"Deleted setup task '{item}' (ID: {task_id})")
    return jsonify({"message": "Task deleted"}), 200


# ---------------------------------------------------------------------------
# Contingency plan
# ---------------------------------------------------------------------------

@retreat_ops_bp.route("/contingency", methods=["GET"])
@jwt_required()
@require_page_permission("retreat_ops", "read")
def list_contingency():
    plans = ContingencyPlan.query.order_by(ContingencyPlan.order_index.asc(), ContingencyPlan.id.asc()).all()
    return jsonify({"plans": [p.to_dict() for p in plans]}), 200


@retreat_ops_bp.route("/contingency", methods=["POST"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def create_contingency():
    data = request.get_json() or {}
    if not data.get("scenario"):
        return jsonify({"error": "Scenario is required"}), 400

    plan = ContingencyPlan(
        scenario=data["scenario"].strip(),
        trigger=data.get("trigger"),
        action=data.get("action"),
        who_decides=data.get("who_decides"),
        order_index=data.get("order_index", 0),
    )
    db.session.add(plan)
    db.session.commit()
    log_action("CREATE_CONTINGENCY_PLAN", f"Created contingency scenario '{plan.scenario}'")
    return jsonify({"plan": plan.to_dict()}), 201


@retreat_ops_bp.route("/contingency/<int:plan_id>", methods=["PUT"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def update_contingency(plan_id):
    plan = ContingencyPlan.query.get_or_404(plan_id)
    data = request.get_json() or {}
    for field in ["scenario", "trigger", "action", "who_decides"]:
        if field in data:
            setattr(plan, field, data[field])
    if "order_index" in data:
        plan.order_index = data["order_index"]
    db.session.commit()
    log_action("UPDATE_CONTINGENCY_PLAN", f"Updated contingency scenario '{plan.scenario}' (ID: {plan.id})")
    return jsonify({"plan": plan.to_dict()}), 200


@retreat_ops_bp.route("/contingency/<int:plan_id>", methods=["DELETE"])
@jwt_required()
@require_page_permission("retreat_ops", "edit")
def delete_contingency(plan_id):
    plan = ContingencyPlan.query.get_or_404(plan_id)
    scenario = plan.scenario
    db.session.delete(plan)
    db.session.commit()
    log_action("DELETE_CONTINGENCY_PLAN", f"Deleted contingency scenario '{scenario}' (ID: {plan_id})")
    return jsonify({"message": "Plan deleted"}), 200
