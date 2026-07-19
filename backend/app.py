import os
from dotenv import load_dotenv
# Load .env file relative to app.py location
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, ".env"))

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from db import db
from routes.auth import auth_bp
from routes.campers import campers_bp
from routes.checkin import checkin_bp
from routes.users import users_bp
from routes.schedule import schedule_bp
from routes.permissions import permissions_bp
from routes.finance import finance_bp
from routes.settings import settings_bp

def create_app():
    # Enforce environment checks in production mode
    is_prod = os.environ.get("FLASK_ENV") == "production"
    if is_prod:
        jwt_key = os.environ.get("JWT_SECRET_KEY")
        if not jwt_key:
            raise ValueError("CRITICAL ERROR: JWT_SECRET_KEY environment variable is not set in production!")
        flask_secret = os.environ.get("SECRET_KEY")
        if not flask_secret:
            raise ValueError("CRITICAL ERROR: SECRET_KEY environment variable is not set in production!")
        db_url = os.environ.get("DATABASE_URL")
        if not db_url or "sqlite" in db_url:
            raise ValueError("CRITICAL ERROR: DATABASE_URL is not set or uses SQLite in production!")

    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload["jti"]
        from models.token_blocklist import TokenBlocklist
        token = TokenBlocklist.query.filter_by(jti=jti).first()
        return token is not None

    # Security Headers hook
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
        return response

    # Global Error Handler to prevent stack trace leak
    @app.errorhandler(Exception)
    def handle_unexpected_exception(e):
        import uuid
        correlation_id = str(uuid.uuid4())
        app.logger.error(f"Correlation ID: {correlation_id} - Exception: {str(e)}", exc_info=True)
        return jsonify({
            "error": "An internal server error occurred.",
            "correlation_id": correlation_id
        }), 500

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(campers_bp, url_prefix="/api/campers")
    app.register_blueprint(checkin_bp, url_prefix="/api/checkin")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(schedule_bp, url_prefix="/api/schedule")
    app.register_blueprint(permissions_bp, url_prefix="/api/permissions")
    app.register_blueprint(finance_bp, url_prefix="/api/finance")
    app.register_blueprint(settings_bp, url_prefix="/api/settings")

    with app.app_context():
        db.create_all()
        
        # Self-healing database migration: add receipt_filename column to expenses table if missing
        from sqlalchemy import text
        try:
            db.session.execute(text("SELECT receipt_filename FROM expenses LIMIT 1"))
        except Exception:
            db.session.rollback()
            try:
                db.session.execute(text("ALTER TABLE expenses ADD COLUMN receipt_filename VARCHAR(255) DEFAULT NULL"))
                db.session.commit()
                print("Database migrated: added receipt_filename column to expenses table.")
            except Exception as migration_ex:
                db.session.rollback()
                print(f"Database migration skipped/failed: {str(migration_ex)}")

        # Self-healing database migration: add discount column to family_payments table if missing
        try:
            db.session.execute(text("SELECT discount FROM family_payments LIMIT 1"))
        except Exception:
            db.session.rollback()
            try:
                db.session.execute(text("ALTER TABLE family_payments ADD COLUMN discount FLOAT DEFAULT 0.0"))
                db.session.commit()
                print("Database migrated: added discount column to family_payments table.")
            except Exception as migration_ex:
                db.session.rollback()
                print(f"Database migration skipped/failed: {str(migration_ex)}")

        # Self-healing database migration: add must_change_password column to users table if missing
        try:
            db.session.execute(text("SELECT must_change_password FROM users LIMIT 1"))
        except Exception:
            db.session.rollback()
            try:
                db.session.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0"))
                db.session.commit()
                print("Database migrated: added must_change_password column to users table.")
            except Exception as migration_ex:
                db.session.rollback()
                print(f"Database migration skipped/failed: {str(migration_ex)}")

        # Self-healing database migration: add failed_login_attempts & locked_until columns to users table if missing
        try:
            db.session.execute(text("SELECT failed_login_attempts FROM users LIMIT 1"))
        except Exception:
            db.session.rollback()
            try:
                db.session.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0"))
                db.session.commit()
                print("Database migrated: added failed_login_attempts column to users table.")
            except Exception as migration_ex:
                db.session.rollback()

        try:
            db.session.execute(text("SELECT locked_until FROM users LIMIT 1"))
        except Exception:
            db.session.rollback()
            try:
                db.session.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME DEFAULT NULL"))
                db.session.commit()
                print("Database migrated: added locked_until column to users table.")
            except Exception as migration_ex:
                db.session.rollback()

        from utils.seed import seed_admin
        seed_admin()

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=False)
