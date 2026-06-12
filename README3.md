# ✝ Church Camp Manager

A full-stack web application for registering campers and managing daily check-in/check-out at a church camp.

**Stack:** Flask · React · MySQL · GitHub Actions CI/CD · AWS EC2 Free Tier ($0/month)

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [API Reference](#api-reference)
4. [Security Checklist](#security-checklist)

---

## Features

- **JWT Authentication** — Secure login with bcrypt password hashing
- **Role-Based Access** — Admin (full CRUD) vs Staff (view + check-in only)
- **Live Dashboard** — Real-time stats: registered, checked in, paid
- **Camper Management** — Register, search, filter, edit campers with medical/guardian info
- **Check-In / Check-Out** — Debounced live search, duplicate prevention, notes per visit
- **Staff Management** — Admin creates/edits/deactivates staff accounts
- **CI/CD Pipeline** — Auto-test and deploy on every push via GitHub Actions
- **Free Hosting** — AWS EC2 t2.micro + CloudFront = $0/month for 12 months

---

## Architecture

| Component  | Technology                   | Purpose                     |
|------------|------------------------------|-----------------------------|
| Frontend   | React 18 + React Router v6   | User interface & navigation |
| Backend    | Python 3.11 + Flask 3        | REST API & business logic   |
| Database   | MySQL 8.0 + SQLAlchemy ORM   | Data persistence            |
| Auth       | JWT + bcrypt                 | Secure login & roles        |
| Web Server | Nginx + Gunicorn             | Production serving          |
| CI/CD      | GitHub Actions (free)        | Auto test & deploy on push  |
| Hosting    | AWS EC2 t2.micro Free Tier   | $0/month for 12 months      |

### Infrastructure Overview

The browser connects through CloudFront (HTTPS CDN) which routes traffic to an EC2 t2.micro instance running Ubuntu 24.04. The instance runs Nginx as a reverse proxy on port 80, Gunicorn serving the Flask API on port 5000, and MySQL 8.0 on port 3306. The React frontend is served as static files via Nginx or S3.

### AWS Free Tier Cost Breakdown

| Service     | Free Allowance         | Monthly Cost |
|-------------|------------------------|--------------|
| EC2 t2.micro | 750 hrs/month         | $0           |
| EBS 8GB     | 30GB/month             | $0           |
| CloudFront  | 1TB + 10M requests     | $0           |
| **Total**   |                        | **$0**       |

### Default Credentials

| Field    | Value         |
|----------|---------------|
| Username | `admin`       |
| Password | `Admin@1234!` |

> ⚠️ **Change the default password immediately after first login** via Admin → Users → Edit.

---

## API Reference

All protected endpoints require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint         | Auth | Description          |
|--------|------------------|------|----------------------|
| POST   | `/api/auth/login` | None | Login, returns JWT  |
| GET    | `/api/auth/me`   | JWT  | Current user info    |

### Campers

| Method | Endpoint              | Auth  | Description                      |
|--------|-----------------------|-------|----------------------------------|
| GET    | `/api/campers/`       | JWT   | List (search, filter, paginate)  |
| GET    | `/api/campers/:id`    | JWT   | Single camper                    |
| POST   | `/api/campers/`       | Admin | Register camper                  |
| PUT    | `/api/campers/:id`    | Admin | Update camper                    |
| DELETE | `/api/campers/:id`    | Admin | Delete camper                    |
| GET    | `/api/campers/stats`  | JWT   | Dashboard stats                  |

### Check-In

| Method | Endpoint                      | Auth | Description          |
|--------|-------------------------------|------|----------------------|
| POST   | `/api/checkin/`               | JWT  | Check in             |
| POST   | `/api/checkin/:id/checkout`   | JWT  | Check out            |
| GET    | `/api/checkin/`               | JWT  | List (active_only param) |

### Users (Admin Only)

| Method | Endpoint          | Auth  | Description              |
|--------|-------------------|-------|--------------------------|
| GET    | `/api/users/`     | Admin | List staff               |
| POST   | `/api/users/`     | Admin | Create user              |
| PUT    | `/api/users/:id`  | Admin | Update / reset password  |
| DELETE | `/api/users/:id`  | Admin | Delete user              |

---

## Security Checklist

- [ ] Change default admin password immediately after first login
- [ ] Use strong `JWT_SECRET_KEY` (48+ random chars)
- [ ] Use strong `SECRET_KEY` (different from JWT key, 48+ chars)
- [ ] Use strong MySQL passwords
- [ ] Remove port 5000 from EC2 security group after setup
- [ ] Serve over HTTPS via CloudFront
- [ ] Enable automatic Ubuntu security updates
- [ ] Never commit `.env` to git
- [ ] SSH port 22 restricted to your IP only

---

*Church Camp Manager — Flask · React · MySQL · GitHub Actions CI/CD · AWS EC2 Free Tier*
