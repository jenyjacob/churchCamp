import os
from datetime import timedelta

class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "mysql+pymysql://campuser:camppass@localhost:3307/churchcamp"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-me-in-production-please")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # CORS
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

    # Secret key
    SECRET_KEY = os.environ.get("SECRET_KEY", "flask-secret-change-me")
