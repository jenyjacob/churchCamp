import base64
import json
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import User, UserPasskey, WebauthnChallenge

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=data["username"]).first()

    if not user or not user.check_password(data["password"]):
        from utils.logging import log_action
        log_action("LOGIN_FAILURE", f"Failed login attempt for username: {data.get('username')}")
        return jsonify({"error": "Invalid username or password"}), 401

    if not user.is_active:
        from utils.logging import log_action
        log_action("LOGIN_FAILURE", f"Disabled account login attempt for username: {data.get('username')}", user.id, user.username)
        return jsonify({"error": "Account is disabled. Contact an administrator."}), 403

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})

    from utils.logging import log_action
    log_action("LOGIN_SUCCESS", "User logged in successfully", user.id, user.username)

    return jsonify({
        "access_token": token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    if not data or not data.get("current_password") or not data.get("new_password"):
        return jsonify({"error": "Current password and new password are required"}), 400

    if not user.check_password(data["current_password"]):
        return jsonify({"error": "Invalid current password"}), 400

    user.set_password(data["new_password"])
    from db import db
    db.session.commit()

    from utils.logging import log_action
    log_action("CHANGE_PASSWORD", "User successfully changed their password", user.id, user.username)

    return jsonify({"message": "Password changed successfully"}), 200

@auth_bp.route("/register-passkey/options", methods=["POST"])
@jwt_required()
def register_passkey_options():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Clean up old challenges
    from datetime import datetime, timedelta
    from db import db
    cutoff = datetime.utcnow() - timedelta(minutes=10)
    try:
        WebauthnChallenge.query.filter(WebauthnChallenge.created_at < cutoff).delete()
        db.session.commit()
    except Exception:
        db.session.rollback()

    rp_id = current_app.config["WEBAUTHN_RP_ID"]
    rp_name = current_app.config["WEBAUTHN_RP_NAME"]

    from webauthn import generate_registration_options
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        UserVerificationRequirement,
        AuthenticatorAttachment,
        ResidentKeyRequirement,
        AttestationConveyancePreference,
    )
    from webauthn.helpers import bytes_to_base64url, options_to_json, base64url_to_bytes

    # Exclude already registered credentials
    exclude_credentials = []
    for pk in user.passkeys:
        try:
            exclude_credentials.append({
                "id": base64url_to_bytes(pk.credential_id),
                "type": "public-key"
            })
        except Exception:
            pass

    registration_options = generate_registration_options(
        rp_id=rp_id,
        rp_name=rp_name,
        user_id=str(user.id).encode("utf-8"),
        user_name=user.username,
        user_display_name=user.full_name or user.username,
        attestation=AttestationConveyancePreference.NONE,
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.REQUIRED
        )
    )

    challenge_str = bytes_to_base64url(registration_options.challenge)
    challenge_entry = WebauthnChallenge(challenge=challenge_str)
    db.session.add(challenge_entry)
    db.session.commit()

    options_json = options_to_json(registration_options)
    return jsonify(json.loads(options_json)), 200

@auth_bp.route("/register-passkey/verify", methods=["POST"])
@jwt_required()
def register_passkey_verify():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    if not data or not data.get("credential") or not data.get("challenge"):
        return jsonify({"error": "Credential and challenge are required"}), 400

    challenge_str = data["challenge"]
    credential_data = data["credential"]
    key_name = data.get("name", "My Passkey")

    from db import db
    challenge_entry = WebauthnChallenge.query.filter_by(challenge=challenge_str).first()
    if not challenge_entry:
        return jsonify({"error": "Invalid or expired registration challenge"}), 400

    db.session.delete(challenge_entry)
    db.session.commit()

    rp_id = current_app.config["WEBAUTHN_RP_ID"]
    expected_origin = current_app.config["WEBAUTHN_RP_ORIGIN"]

    from webauthn import verify_registration_response
    from webauthn.helpers import base64url_to_bytes

    try:
        registration_verification = verify_registration_response(
            credential=credential_data,
            expected_challenge=base64url_to_bytes(challenge_str),
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            require_user_verification=False,
        )
    except Exception as e:
        from utils.logging import log_action
        log_action("PASSKEY_REG_FAILURE", f"Passkey verification failed: {str(e)}", user.id, user.username)
        return jsonify({"error": f"Verification failed: {str(e)}"}), 400

    public_key_b64 = base64.b64encode(registration_verification.credential_public_key).decode("utf-8")
    credential_id_str = credential_data["id"]

    existing_key = UserPasskey.query.filter_by(credential_id=credential_id_str).first()
    if existing_key:
        return jsonify({"error": "Passkey is already registered"}), 400

    new_passkey = UserPasskey(
        user_id=user.id,
        credential_id=credential_id_str,
        public_key=public_key_b64,
        sign_count=registration_verification.sign_count,
        name=key_name
    )

    db.session.add(new_passkey)
    db.session.commit()

    from utils.logging import log_action
    log_action("PASSKEY_REG_SUCCESS", f"Registered passkey successfully: {key_name}", user.id, user.username)

    return jsonify({"message": "Passkey registered successfully"}), 200

@auth_bp.route("/login-passkey/options", methods=["POST"])
def login_passkey_options():
    # Dynamic challenge clean up
    from datetime import datetime, timedelta
    from db import db
    cutoff = datetime.utcnow() - timedelta(minutes=10)
    try:
        WebauthnChallenge.query.filter(WebauthnChallenge.created_at < cutoff).delete()
        db.session.commit()
    except Exception:
        db.session.rollback()

    rp_id = current_app.config["WEBAUTHN_RP_ID"]

    from webauthn import generate_authentication_options
    from webauthn.helpers import bytes_to_base64url, options_to_json
    from webauthn.helpers.structs import UserVerificationRequirement

    # Generate authentication options (allow user-less discoverable credential selection)
    authentication_options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.PREFERRED
    )

    challenge_str = bytes_to_base64url(authentication_options.challenge)
    challenge_entry = WebauthnChallenge(challenge=challenge_str)
    db.session.add(challenge_entry)
    db.session.commit()

    options_json = options_to_json(authentication_options)
    return jsonify(json.loads(options_json)), 200

@auth_bp.route("/login-passkey/verify", methods=["POST"])
def login_passkey_verify():
    data = request.get_json()
    if not data or not data.get("credential") or not data.get("challenge"):
        return jsonify({"error": "Credential and challenge are required"}), 400

    challenge_str = data["challenge"]
    credential_data = data["credential"]

    from db import db
    challenge_entry = WebauthnChallenge.query.filter_by(challenge=challenge_str).first()
    if not challenge_entry:
        return jsonify({"error": "Invalid or expired login challenge"}), 400

    db.session.delete(challenge_entry)
    db.session.commit()

    credential_id_str = credential_data["id"]
    passkey = UserPasskey.query.filter_by(credential_id=credential_id_str).first()
    if not passkey:
        return jsonify({"error": "Passkey not recognized. Please sign in with username/password and register your passkey first."}), 400

    user = User.query.get(passkey.user_id)
    if not user:
        return jsonify({"error": "User associated with this passkey not found"}), 404

    if not user.is_active:
        from utils.logging import log_action
        log_action("LOGIN_FAILURE", f"Disabled account passkey attempt for user: {user.username}", user.id, user.username)
        return jsonify({"error": "Account is disabled. Contact an administrator."}), 403

    rp_id = current_app.config["WEBAUTHN_RP_ID"]
    expected_origin = current_app.config["WEBAUTHN_RP_ORIGIN"]

    from webauthn import verify_authentication_response
    from webauthn.helpers import base64url_to_bytes

    try:
        public_key_bytes = base64.b64decode(passkey.public_key)

        authentication_verification = verify_authentication_response(
            credential=credential_data,
            expected_challenge=base64url_to_bytes(challenge_str),
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            credential_public_key=public_key_bytes,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=False,
        )
    except Exception as e:
        from utils.logging import log_action
        log_action("PASSKEY_AUTH_FAILURE", f"Passkey login failed: {str(e)}", user.id, user.username)
        return jsonify({"error": f"Verification failed: {str(e)}"}), 400

    passkey.sign_count = authentication_verification.new_sign_count
    db.session.commit()

    from utils.logging import log_action
    log_action("LOGIN_SUCCESS", "User logged in successfully via passkey biometric", user.id, user.username)

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})

    return jsonify({
        "access_token": token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/passkeys", methods=["GET"])
@jwt_required()
def get_passkeys():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    passkeys = [pk.to_dict() for pk in user.passkeys]
    return jsonify({"passkeys": passkeys}), 200

@auth_bp.route("/passkeys/<int:passkey_id>", methods=["DELETE"])
@jwt_required()
def delete_passkey(passkey_id):
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    passkey = UserPasskey.query.filter_by(id=passkey_id, user_id=user.id).first()
    if not passkey:
        return jsonify({"error": "Passkey not found"}), 404

    from utils.logging import log_action
    log_action("PASSKEY_DELETE", f"User deleted passkey: {passkey.name}", user.id, user.username)

    db.session.delete(passkey)
    db.session.commit()

    return jsonify({"message": "Passkey deleted successfully"}), 200

