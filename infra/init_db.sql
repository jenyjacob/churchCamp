-- Church Camp Database Schema
-- Run this on your RDS MySQL instance to initialize the database

CREATE DATABASE IF NOT EXISTS churchcamp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE churchcamp;

-- Application user (separate from root)
CREATE USER IF NOT EXISTS 'campuser'@'%' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON churchcamp.* TO 'campuser'@'%';
FLUSH PRIVILEGES;

-- Tables are auto-created by SQLAlchemy on first app start (db.create_all())
-- This file is for reference and initial DB/user setup only.
