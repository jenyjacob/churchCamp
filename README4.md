# ✝ Church Camp Manager

A full-stack web application for managing church camp registrations and guest check-ins. Built with React, Flask, and MySQL — deployable on AWS EC2 Free Tier.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Default Login](#default-login)
- [Local Development](#local-development)
  - [Option A — Docker Compose](#option-a--docker-compose-easiest)
  - [Option B — Manual Setup](#option-b--manual-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [AWS Free Tier Deployment](#aws-free-tier-deployment)
- [Troubleshooting](#troubleshooting)
- [Security Checklist](#security-checklist)

---

## Overview

Church Camp Manager is a purpose-built registration and check-in system for church camps. Staff can register campers, track payment and registration status, and manage daily check-in and check-out — all from a clean, role-protected web interface.

```
Browser
   │
   ▼
CloudFront (HTTPS CDN)
   │
   ├──▶ S3 Bucket         (React static frontend)
   │
   └──▶ EC2 t2.micro      (Ubuntu 24.04)
              ├── Nginx    (reverse proxy, port 80)
              ├── Gunicorn (Flask API, port 5000)
              └── MySQL    (database, port 3306)
```

---

## Features

| Feature | Admin | Staff |
|---|---|---|
| Login with username & password | ✅ | ✅ |
| View dashboard with live stats | ✅ | ✅ |
| Search & view camper list | ✅ | ✅ |
| Register new campers | ✅ | ❌ |
| Edit camper details | ✅ | ❌ |
| Delete campers | ✅ | ❌ |
| Check in / check out guests | ✅ | ✅ |
| View currently checked-in list | ✅ | ✅ |
| Manage staff user accounts | ✅ | ❌ |
| Assign admin or staff roles | ✅ | ❌ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios |
| Backend | Python 3.11, Flask 3, Flask-JWT-Extended |
| Database | MySQL 8.0, SQLAlchemy ORM |
| Web Server | Nginx + Gunicorn |
| Auth | JWT (JSON Web Tokens), bcrypt password hashing |
| Deployment | AWS EC2 t2.micro, S3, CloudFront |
| Local Dev | Docker Compose |

---

## Project Structure

```
church-camp/
├── backend/
│   ├── app.py                  # Flask app factory & entry point
│   ├── config.py               # Environment config (DB, JWT, CORS)
│   ├── db.py                   # SQLAlchemy instance
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container
│   ├── .env.example            # Environment variable template
│   ├── models/
│   │   ├── user.py             # User model (username, password hash, role)
│   │   ├── camper.py           # Camper model (registration, medical, guardian)
│   │   └── checkin.py          # CheckIn model (timestamps, staff tracking)
│   ├── routes/
│   │   ├── auth.py             # POST /api/auth/login, GET /api/auth/me
│   │   ├── campers.py          # CRUD /api/campers/
│   │   ├── checkin.py          # POST /api/checkin/, POST /api/checkin/:id/checkout
│   │   └── users.py            # CRUD /api/users/ (admin only)
│   └── utils/
│       └── seed.py             # Creates default admin on first run
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js              # Router, protected routes, role guards
│   │   ├── index.js            # React entry point
│   │   ├── index.css           # Global styles & design tokens
│   │   ├── context/
│   │   │   └── AuthContext.js  # JWT auth state, login/logout
│   │   ├── utils/
│   │   │   └── api.js          # Axios instance with JWT interceptor
│   │   ├── components/
│   │   │   └── AppShell.js     # Sidebar navigation layout
│   │   └── pages/
│   │       ├── LoginPage.js    # Login form with error handling
│   │       ├── HomePage.js     # Dashboard: stats + quick actions
│   │       ├── CampersPage.js  # Camper list, search, register/edit/delete
│   │       ├── CheckInPage.js  # Real-time check-in / check-out
│   │       └── UsersPage.js    # Staff user management (admin only)
│   ├── Dockerfile              # Frontend container (nginx)
│   ├── nginx.conf              # Nginx config for React + API proxy
│   └── package.json
│
├── infra/
│   └── init_db.sql             # Database and user initialization SQL
│
├── docker-compose.yml          # Local dev: MySQL + Flask + React
├── .gitignore
└── README.md
```

---

## User Roles

The app has two roles enforced on both the frontend (UI) and backend (API):

**`admin`**
- Full access to all features
- Can register, edit, and delete campers
- Can create, update, and delete staff users
- Can assign roles (admin or user)
- Sees the Admin → Users menu item

**`user`** (Staff)
- Read-only access to camper list and details
- Can perform check-in and check-out
- Cannot edit or delete any records
- No access to user management

---

## Default Login

A default admin account is automatically created the first time the app starts:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@1234!` |

> ⚠️ **Change this password immediately** after first login via Admin → Users → Edit.

---

## Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for Option A
- [Node.js 20 LTS](https://nodejs.org/) — for Option B frontend
- [Python 3.11+](https://www.python.org/downloads/) — for Option B backend

---

### Option A — Docker Compose (Easiest)

Starts MySQL, Flask, and React all at once.

```bash
# 1. Clone or extract the project
cd church-camp

# 2. Start everything
docker compose up --build

# First run takes 3-5 minutes to build images
# Watch for: "✅ Default admin user created: admin / Admin@1234!"

# 3. Open in browser
http://localhost:80        ← the app
http://localhost:5000      ← Flask API directly

# 4. Stop everything
docker compose down

# Stop AND delete the database
docker compose down -v
```

---

### Option B — Manual Setup

Run each service in its own terminal. **Start in order: MySQL → Flask → React.**

**Terminal 1 — MySQL (via Docker)**
```bash
cd church-camp
docker compose up db
# Wait for: "ready for connections"
```

**Terminal 2 — Flask Backend**
```bash
cd church-camp/backend

# Create virtual environment
python -m venv venv

# Activate
source venv/bin/activate        # Mac / Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment file
cp .env.example .env
# Default values already match the Docker MySQL — no changes needed for local dev

# Start Flask (auto-reloads on file changes)
python app.py

# Expected output:
# ✅ Default admin user created: admin / Admin@1234!
# * Running on http://0.0.0.0:5000
```

**Terminal 3 — React Frontend**
```bash
cd church-camp/frontend

# Install dependencies
npm install

# Create proxy file (fixes localhost:3000 → localhost:5000 forwarding)
# Make sure frontend/src/setupProxy.js exists with this content:
#
#   const { createProxyMiddleware } = require('http-proxy-middleware');
#   module.exports = function(app) {
#     app.use('/api', createProxyMiddleware({
#       target: 'http://127.0.0.1:5000',
#       changeOrigin: true,
#     }));
#   };

npm install http-proxy-middleware

# Start dev server
npm start
# Opens automatically at http://localhost:3000
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your values:

```bash
# MySQL connection string
DATABASE_URL=mysql+pymysql://campuser:camppass@localhost:3306/churchcamp

# JWT signing secret — use a long random string (32+ chars)
JWT_SECRET_KEY=replace-with-long-random-string-here

# Flask secret key — use a different long random string
SECRET_KEY=another-long-random-string-here

# Allowed CORS origins (comma-separated)
# Local dev:
CORS_ORIGINS=http://localhost:3000
# Production (add your CloudFront domain):
CORS_ORIGINS=http://YOUR_EC2_IP,https://YOUR_CLOUDFRONT_DOMAIN
```

> ⚠️ Never commit your `.env` file to version control. It is listed in `.gitignore`.

---

## API Reference

All protected routes require the header: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | None | Login — returns JWT token and user info |
| `GET` | `/api/auth/me` | JWT | Get current logged-in user |

**Login request body:**
```json
{
  "username": "admin",
  "password": "Admin@1234!"
}
```

**Login response:**
```json
{
  "access_token": "eyJhbGci...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "full_name": "Camp Administrator",
    "email": "admin@churchcamp.org",
    "is_active": true
  }
}
```

---

### Campers

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/campers/` | JWT | List campers (paginated, searchable) |
| `GET` | `/api/campers/:id` | JWT | Get single camper details |
| `POST` | `/api/campers/` | Admin | Register new camper |
| `PUT` | `/api/campers/:id` | Admin | Update camper details |
| `DELETE` | `/api/campers/:id` | Admin | Delete a camper |
| `GET` | `/api/campers/stats` | JWT | Get dashboard statistics |

**Query parameters for `GET /api/campers/`:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Search by first name, last name, or guardian name |
| `status` | string | Filter by `registered`, `waitlist`, or `cancelled` |
| `session` | string | Filter by session name |
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Results per page (default: 20) |

---

### Check-In

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/checkin/` | JWT | Check in a camper |
| `POST` | `/api/checkin/:id/checkout` | JWT | Check out a camper |
| `GET` | `/api/checkin/` | JWT | List check-ins (supports `active_only=true`) |
| `GET` | `/api/checkin/camper/:id` | JWT | Get check-in history for a camper |

---

### Users (Admin Only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users/` | Admin | List all staff users |
| `POST` | `/api/users/` | Admin | Create new staff user |
| `PUT` | `/api/users/:id` | Admin | Update user (role, password, status) |
| `DELETE` | `/api/users/:id` | Admin | Delete a user |

---

## AWS Free Tier Deployment

Deploy the full app for **$0/month** for the first 12 months using AWS Free Tier.

### Architecture

```
EC2 t2.micro (one server — free tier)
├── Nginx        port 80  — reverse proxy
├── Gunicorn     port 5000 — Flask API
└── MySQL        port 3306 — database

CloudFront + S3 — React frontend (free tier)
```

### Free Tier Cost Breakdown

| Service | Free Allowance | Cost |
|---|---|---|
| EC2 t2.micro | 750 hrs/month | $0 |
| EBS Storage 8GB | 30 GB/month | $0 |
| S3 | 5GB + 20K requests | $0 |
| CloudFront | 1TB + 10M requests | $0 |
| **Total** | | **$0/month** |

> After 12 months, the same setup costs approximately $10–15/month.

### Deployment Steps (Summary)

**1. Launch EC2 t2.micro**
```
AWS Console → EC2 → Launch Instance
AMI: Ubuntu 24.04 LTS | Type: t2.micro | Key pair: churchcamp-key
Security group inbound: SSH (22), HTTP (80), HTTPS (443)
```

**2. SSH into EC2**
```bash
ssh -i churchcamp-key.pem ubuntu@YOUR_EC2_IP
```

**3. Install software on EC2**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nginx mysql-server git
```

**4. Set up MySQL**
```bash
sudo systemctl start mysql && sudo systemctl enable mysql
sudo mysql -u root -p
```
```sql
CREATE DATABASE churchcamp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'campuser'@'localhost' IDENTIFIED BY 'YourStrongPassword!';
GRANT ALL PRIVILEGES ON churchcamp.* TO 'campuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**5. Upload and configure backend**
```bash
# Upload from Windows
scp -i churchcamp-key.pem -r church-camp/backend ubuntu@YOUR_EC2_IP:/home/ubuntu/

# On EC2
cd /home/ubuntu/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
nano .env   # fill in DATABASE_URL, JWT_SECRET_KEY, SECRET_KEY, CORS_ORIGINS
python app.py   # test — then Ctrl+C
```

**6. Run Flask as a system service**
```bash
sudo nano /etc/systemd/system/churchcamp.service
# (paste systemd unit — see full deployment guide)
sudo systemctl daemon-reload
sudo systemctl enable churchcamp
sudo systemctl start churchcamp
```

**7. Configure Nginx**
```bash
sudo nano /etc/nginx/sites-available/churchcamp
# (paste nginx config — see full deployment guide)
sudo ln -s /etc/nginx/sites-available/churchcamp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

**8. Build and upload React frontend**
```bash
# On Windows
cd church-camp/frontend
$env:REACT_APP_API_URL="http://YOUR_EC2_IP"
npm run build

# Upload to EC2
scp -i churchcamp-key.pem -r frontend/build/* ubuntu@YOUR_EC2_IP:/var/www/churchcamp/
```

**9. Add CloudFront**
```
AWS Console → CloudFront → Create Distribution
Origin: YOUR_EC2_IP | Protocol: HTTP | Default root: index.html
Error pages: 403 → /index.html (200), 404 → /index.html (200)
```

> For the full step-by-step deployment guide with all commands and configs, refer to `ChurchCamp_AWS_Deployment_Guide.docx`.

---

## Troubleshooting

### Proxy error on localhost:3000

```
Proxy error: Could not proxy request /api/auth/login from localhost:3000 to http://localhost:5000
```

**Fix:** Make sure `frontend/src/setupProxy.js` exists:
```javascript
const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  app.use('/api', createProxyMiddleware({
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  }));
};
```
Then restart React: `Ctrl+C` → `npm start`

---

### Flask won't start — can't connect to MySQL

```
sqlalchemy.exc.OperationalError: Can't connect to MySQL server
```

**Fix:** Start MySQL first, then Flask.
```bash
docker compose up db        # wait for "ready for connections"
python app.py               # then start Flask
```

---

### Port 5000 already in use (Mac)

macOS Monterey+ uses port 5000 for AirPlay Receiver.

**Fix:** System Settings → General → AirDrop & Handoff → AirPlay Receiver → **Off**

---

### 504 Gateway Timeout in browser

Flask is not running or not reachable from the proxy.

```bash
# Test Flask directly
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@1234!"}'
```

If this works in terminal but fails in browser, the proxy config is the issue. See above.

---

### On EC2 — Flask service not starting

```bash
# View the last 50 log lines
sudo journalctl -u churchcamp -n 50

# Common causes:
# - Wrong DATABASE_URL in .env
# - MySQL not running: sudo systemctl start mysql
# - Wrong file path in ExecStart of the service file
```

---

## Security Checklist

Before sharing the app URL with your team:

- [ ] Change default `admin` password immediately after first login
- [ ] Use a strong `JWT_SECRET_KEY` (48+ random characters)
- [ ] Use a strong `SECRET_KEY` (different from JWT key)
- [ ] Use strong MySQL passwords (not the examples in this README)
- [ ] Remove port 5000 from EC2 security group after testing
- [ ] Serve the app over HTTPS via CloudFront — not the raw EC2 IP
- [ ] Enable automatic Ubuntu security updates on EC2:
  ```bash
  sudo dpkg-reconfigure --priority=low unattended-upgrades
  ```
- [ ] Back up your MySQL data regularly:
  ```bash
  mysqldump -u campuser -p churchcamp > backup_$(date +%Y%m%d).sql
  ```

---

## Quick Command Reference

```bash
# ── Local Dev ──────────────────────────────────────────────────

# Start everything (Docker)
docker compose up --build

# Start only MySQL (for manual backend dev)
docker compose up db

# ── EC2 via SSH ────────────────────────────────────────────────

# Connect
ssh -i churchcamp-key.pem ubuntu@YOUR_EC2_IP

# View Flask logs live
sudo journalctl -u churchcamp -f

# Restart Flask
sudo systemctl restart churchcamp

# Restart Nginx
sudo systemctl restart nginx

# Check service status
sudo systemctl status churchcamp
sudo systemctl status nginx
sudo systemctl status mysql

# ── Redeploy Backend ───────────────────────────────────────────

# Upload new code (Windows PowerShell)
scp -i churchcamp-key.pem -r church-camp/backend ubuntu@YOUR_EC2_IP:/home/ubuntu/

# Restart Flask on EC2 after upload
sudo systemctl restart churchcamp

# ── Redeploy Frontend ──────────────────────────────────────────

# Rebuild (Windows PowerShell)
cd church-camp/frontend
$env:REACT_APP_API_URL="http://YOUR_EC2_IP"
npm run build

# Upload build (Windows PowerShell)
scp -i churchcamp-key.pem -r frontend/build/* ubuntu@YOUR_EC2_IP:/var/www/churchcamp/
```

---

*Church Camp Manager — Built with React, Flask, and MySQL. Hosted on AWS Free Tier.*
