from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models import PagePermission, User
from db import db
from utils.logging import log_action

permissions_bp = Blueprint("permissions", __name__)

DEFAULT_PERMISSIONS = {
    "owner": {
        "dashboard": "edit",
        "campers": "edit",
        "teams": "edit",
        "checkin": "edit",
        "cabins": "edit",
        "schedule": "edit",
        "outdoor": "edit",
        "apparel": "edit",
        "users": "edit",
        "logs": "edit",
        "role_assigner": "edit",
        "finance": "edit",
        "receipt_upload": "edit",
        "camp_info": "edit"
    },
    "admin": {
        "dashboard": "read",
        "campers": "edit",
        "teams": "edit",
        "checkin": "edit",
        "cabins": "edit",
        "schedule": "edit",
        "outdoor": "edit",
        "apparel": "edit",
        "users": "edit",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "edit",
        "receipt_upload": "edit",
        "camp_info": "read"
    },
    "director": {
        "dashboard": "read",
        "campers": "edit",
        "teams": "hide",
        "checkin": "edit",
        "cabins": "edit",
        "schedule": "edit",
        "outdoor": "edit",
        "apparel": "edit",
        "users": "hide",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "read",
        "receipt_upload": "hide",
        "camp_info": "read"
    },
    "user": {
        "dashboard": "read",
        "campers": "edit",
        "teams": "hide",
        "checkin": "edit",
        "cabins": "hide",
        "schedule": "hide",
        "outdoor": "hide",
        "apparel": "hide",
        "users": "hide",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "hide",
        "receipt_upload": "hide",
        "camp_info": "read"
    },
    "finance": {
        "dashboard": "read",
        "campers": "hide",
        "teams": "hide",
        "checkin": "hide",
        "cabins": "hide",
        "schedule": "hide",
        "outdoor": "hide",
        "apparel": "edit",
        "users": "hide",
        "logs": "hide",
        "role_assigner": "hide",
        "finance": "edit",
        "receipt_upload": "edit",
        "camp_info": "read"
    }
}

def get_dynamic_roles():
    default_roles = ["owner", "admin", "director", "finance", "user"]
    if "mysql" in str(db.engine.url):
        try:
            result = db.session.execute(db.text("SHOW COLUMNS FROM users LIKE 'role'")).fetchone()
            if result:
                # result[1] is the type definition, e.g. "enum('owner','admin',...)"
                import re
                enum_values = re.findall(r"'(.*?)'", result[1])
                if enum_values:
                    return enum_values
        except Exception:
            pass
    # Fallback/SQLite: get distinct roles from User and PagePermission
    try:
        db_roles = [r[0] for r in db.session.query(User.role).distinct().all()]
        perm_roles = [p[0] for p in db.session.query(PagePermission.role).distinct().all()]
        roles_set = set(default_roles + db_roles + perm_roles)
        # Ensure owner is first, then others
        ordered = ["owner"] + sorted([r for r in roles_set if r != "owner"])
        return ordered
    except Exception:
        return default_roles

@permissions_bp.route("/my-permissions", methods=["GET"])
@jwt_required()
def get_my_permissions():
    claims = get_jwt()
    role = claims.get("role", "user")
    
    # Start with default permissions for this role (fallback to user if custom role has no hardcoded defaults)
    perms = dict(DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["user"]))
    
    # Overwrite with any custom permissions from the DB if not owner
    if role != "owner":
        db_perms = PagePermission.query.filter_by(role=role).all()
        for p in db_perms:
            perms[p.page_key] = p.access_level
            
    return jsonify({
        "role": role,
        "permissions": perms
    }), 200

@permissions_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_permissions():
    claims = get_jwt()
    role = claims.get("role")
    
    if role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    roles = get_dynamic_roles()
    
    # Build the full grid containing default settings and custom overrides
    grid = {}
    for target_role in roles:
        if target_role == "owner":
            continue
        grid[target_role] = dict(DEFAULT_PERMISSIONS.get(target_role, DEFAULT_PERMISSIONS["user"]))
        db_perms = PagePermission.query.filter_by(role=target_role).all()
        for p in db_perms:
            grid[target_role][p.page_key] = p.access_level
            
    return jsonify({
        "roles": roles,
        "permissions": grid
    }), 200

@permissions_bp.route("/", methods=["POST"])
@jwt_required()
def update_permission():
    claims = get_jwt()
    current_role = claims.get("role")
    
    if current_role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    data = request.get_json()
    role = data.get("role")
    page_key = data.get("page_key")
    access_level = data.get("access_level")

    if not role or not page_key or not access_level:
        return jsonify({"error": "role, page_key, and access_level are required"}), 400

    allowed_roles = get_dynamic_roles()
    if role not in allowed_roles:
        return jsonify({"error": f"Invalid role: {role}"}), 400

    if role == "owner":
        return jsonify({"error": "Cannot modify permissions for owner role"}), 400

    if page_key not in DEFAULT_PERMISSIONS["owner"].keys():
        return jsonify({"error": f"Invalid page key: {page_key}"}), 400

    if access_level not in ["hide", "read", "edit"]:
        return jsonify({"error": f"Invalid access level: {access_level}"}), 400

    # Find existing or create new
    p = PagePermission.query.filter_by(role=role, page_key=page_key).first()
    if p:
        old_level = p.access_level
        p.access_level = access_level
    else:
        old_level = DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["user"]).get(page_key, "hide")
        p = PagePermission(role=role, page_key=page_key, access_level=access_level)
        db.session.add(p)

    db.session.commit()
    
    # Log action
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    log_action(
        "UPDATE_ROLE_PERMISSION", 
        f"Updated role {role} permission for page {page_key} from {old_level} to {access_level}",
        user.id,
        user.username
    )

    return jsonify({
        "message": "Permission updated successfully",
        "permission": p.to_dict()
    }), 200

@permissions_bp.route("/roles", methods=["POST"])
@jwt_required()
def create_new_role():
    claims = get_jwt()
    current_role = claims.get("role")
    
    if current_role != "owner":
        return jsonify({"error": "Owner access required"}), 403

    data = request.get_json()
    new_role = data.get("role_name", "").strip().lower()

    if not new_role:
        return jsonify({"error": "role_name is required"}), 400

    # Ensure role name is alphanumeric and lowercase
    import re
    if not re.match(r"^[a-z0-9_]+$", new_role):
        return jsonify({"error": "role_name must contain only lowercase letters, numbers, and underscores"}), 400

    if len(new_role) > 50:
        return jsonify({"error": "role_name must be 50 characters or less"}), 400

    current_roles = get_dynamic_roles()
    if new_role in current_roles:
        return jsonify({"error": f"Role '{new_role}' already exists"}), 400

    # Alter table if MySQL to support the new enum value
    if "mysql" in str(db.engine.url):
        try:
            # Construct new enum string (preserving exact order from dynamic enum list)
            new_enum_values = current_roles + [new_role]
            enum_str = ", ".join([f"'{v}'" for v in new_enum_values])
            alter_query = f"ALTER TABLE users MODIFY COLUMN role ENUM({enum_str}) NOT NULL DEFAULT 'user'"
            
            db.session.execute(db.text(alter_query))
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to alter database users role column schema: {str(e)}"}), 500

    # Populate default PagePermission values for this new role (similar to 'user' defaults)
    for page_key in DEFAULT_PERMISSIONS["user"].keys():
        level = DEFAULT_PERMISSIONS["user"].get(page_key, "hide")
        p = PagePermission(role=new_role, page_key=page_key, access_level=level)
        db.session.add(p)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create default permissions: {str(e)}"}), 500

    # Log action
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    log_action(
        "CREATE_USER_ROLE", 
        f"Created new user role '{new_role}' and altered users table schema.",
        user.id,
        user.username
    )

    return jsonify({
        "message": f"User role '{new_role}' created successfully.",
        "roles": current_roles + [new_role]
    }), 200

@permissions_bp.route("/roles", methods=["GET"])
@jwt_required()
def get_roles_list():
    roles = get_dynamic_roles()
    return jsonify({
        "roles": roles
    }), 200
