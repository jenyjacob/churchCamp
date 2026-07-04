import os
from dotenv import load_dotenv
# Load .env file relative to app.py location
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, ".env"))

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from db import db
from routes.auth import auth_bp
from routes.campers import campers_bp
from routes.checkin import checkin_bp
from routes.users import users_bp
from routes.schedule import schedule_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    JWTManager(app)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(campers_bp, url_prefix="/api/campers")
    app.register_blueprint(checkin_bp, url_prefix="/api/checkin")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(schedule_bp, url_prefix="/api/schedule")

    with app.app_context():
        db.create_all()
        from utils.seed import seed_admin
        seed_admin()

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=False)
