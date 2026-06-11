# ✝ Church Camp Manager

A full-stack web application for registering campers and managing daily check-in/check-out at a church camp.

**Stack:** Flask · React · MySQL · GitHub Actions CI/CD · AWS EC2 Free Tier ($0/month)

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Quick Start — Local Development](#quick-start--local-development)
5. [Backend Setup (Flask)](#backend-setup-flask)
6. [Frontend Setup (React)](#frontend-setup-react)
7. [Full Code Reference](#full-code-reference)
   - [Backend Code](#backend-code)
   - [Frontend Code](#frontend-code)
   - [Docker & Infrastructure](#docker--infrastructure)
   - [CI/CD Workflow](#cicd-workflow)
8. [AWS Free Tier Deployment](#aws-free-tier-deployment)
9. [API Reference](#api-reference)
10. [Security Checklist](#security-checklist)
11. [Troubleshooting](#troubleshooting)

---

## Features

- **JWT Authentication** — Secure login with bcrypt password hashing
- **Role-Based Access** — Admin (full CRUD) vs Staff (view + check-in only)
- **Live Dashboard** — Real-time stats: registered, checked in, paid
- **Camper Management** — Register, search, filter, edit campers with medical/guardian info
- **Check-In / Check-Out** — Debounced live search, duplicate prevention, notes per visit
- **Staff Management** — Admin creates/edits/deactivates staff accounts
- **CI/CD Pipeline** — Auto-test and deploy on every `git push` via GitHub Actions
- **Free Hosting** — AWS EC2 t2.micro + CloudFront = $0/month for 12 months

---

## Architecture

```
Browser
   │
   ▼
CloudFront (HTTPS CDN — free tier)
   │
   ├──▶  S3 / Nginx         (React static frontend)
   │
   └──▶  EC2 t2.micro  Ubuntu 24.04
              ├── Nginx      (reverse proxy — port 80)
              ├── Gunicorn   (Flask API   — port 5000)
              └── MySQL 8.0  (database    — port 3306)
```

| Component  | Technology                   | Purpose                    |
|------------|------------------------------|----------------------------|
| Frontend   | React 18 + React Router v6   | User interface & navigation |
| Backend    | Python 3.11 + Flask 3        | REST API & business logic  |
| Database   | MySQL 8.0 + SQLAlchemy ORM   | Data persistence           |
| Auth       | JWT + bcrypt                 | Secure login & roles       |
| Web Server | Nginx + Gunicorn             | Production serving         |
| CI/CD      | GitHub Actions (free)        | Auto test & deploy on push |
| Hosting    | AWS EC2 t2.micro Free Tier   | $0/month for 12 months     |

### Default Credentials

| Field    | Value        |
|----------|--------------|
| Username | `admin`      |
| Password | `Admin@1234!` |

> ⚠️ **Change the default password immediately after first login** via Admin → Users → Edit.

---

## Project Structure

```
church-camp/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD pipeline
├── backend/
│   ├── app.py                  # Flask app factory
│   ├── config.py               # Environment config
│   ├── db.py                   # SQLAlchemy instance
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py             # User model
│   │   ├── camper.py           # Camper model
│   │   └── checkin.py          # CheckIn model
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py             # /api/auth/
│   │   ├── campers.py          # /api/campers/
│   │   ├── checkin.py          # /api/checkin/
│   │   └── users.py            # /api/users/
│   ├── tests/
│   │   └── test_auth.py
│   └── utils/
│       └── seed.py
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── index.css
│   │   ├── setupProxy.js       # Dev proxy only
│   │   ├── context/AuthContext.js
│   │   ├── utils/api.js
│   │   ├── components/AppShell.js
│   │   └── pages/
│   │       ├── LoginPage.js
│   │       ├── HomePage.js
│   │       ├── CampersPage.js
│   │       ├── CheckInPage.js
│   │       └── UsersPage.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── infra/
│   └── init_db.sql
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Quick Start — Local Development

### Option A: Docker Compose (easiest)

```bash
# Clone / navigate to project
cd church-camp

# Start everything (MySQL + Flask + React)
docker compose up --build

# Open http://localhost in browser
# Login: admin / Admin@1234!
```

### Option B: Manual Setup

**Requirements:** Python 3.11+, Node 18+, MySQL 8.0

```bash
# 1. Start MySQL and create database
mysql -u root -p
# CREATE DATABASE churchcamp;
# CREATE USER 'campuser'@'localhost' IDENTIFIED BY 'camppass';
# GRANT ALL PRIVILEGES ON churchcamp.* TO 'campuser'@'localhost';
# FLUSH PRIVILEGES; EXIT;

# 2. Backend
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Edit .env with your values
python app.py
# Flask runs on http://localhost:5000
# First run creates: admin / Admin@1234!

# 3. Frontend (new terminal)
cd frontend
npm install
npm start
# React runs on http://localhost:3000
```

---

## Backend Setup (Flask)

### `backend/.env.example`

```env
DATABASE_URL=mysql+pymysql://campuser:camppass@localhost:3306/churchcamp
JWT_SECRET_KEY=replace-with-long-random-string-min-32-chars
SECRET_KEY=another-long-random-string-here
CORS_ORIGINS=http://localhost:3000
```

### `backend/requirements.txt`

```
Flask==3.0.3
Flask-Cors==4.0.1
Flask-JWT-Extended==4.6.0
Flask-SQLAlchemy==3.1.1
PyMySQL==1.1.1
cryptography==42.0.8
Werkzeug==3.0.3
gunicorn==22.0.0
python-dotenv==1.0.1
pytest==8.2.2
```

---

## Frontend Setup (React)

### `frontend/package.json`

```json
{
  "name": "church-camp-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.0",
    "axios": "^1.7.2",
    "http-proxy-middleware": "^2.0.6",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "proxy": "http://localhost:5000"
}
```

---

## Full Code Reference

### Backend Code

#### `backend/app.py`

```python
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from db import db
from routes.auth import auth_bp
from routes.campers import campers_bp
from routes.checkin import checkin_bp
from routes.users import users_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r'/api/*': {'origins': app.config['CORS_ORIGINS']}})
    db.init_app(app)
    JWTManager(app)
    app.register_blueprint(auth_bp,    url_prefix='/api/auth')
    app.register_blueprint(campers_bp, url_prefix='/api/campers')
    app.register_blueprint(checkin_bp, url_prefix='/api/checkin')
    app.register_blueprint(users_bp,   url_prefix='/api/users')
    with app.app_context():
        db.create_all()
        from utils.seed import seed_admin
        seed_admin()
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=False)
```

#### `backend/config.py`

```python
import os
from datetime import timedelta

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'mysql+pymysql://campuser:camppass@localhost:3306/churchcamp')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'change-me-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    SECRET_KEY = os.environ.get('SECRET_KEY', 'flask-secret-change-me')
```

#### `backend/db.py`

```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
```

#### `backend/models/user.py`

```python
from db import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80),  unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role          = db.Column(db.Enum('admin','user'), nullable=False, default='user')
    full_name     = db.Column(db.String(150), nullable=True)
    email         = db.Column(db.String(150), unique=True, nullable=True)
    is_active     = db.Column(db.Boolean, default=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id, 'username': self.username, 'role': self.role,
            'full_name': self.full_name, 'email': self.email,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

#### `backend/models/camper.py`

```python
from db import db
from datetime import datetime

class Camper(db.Model):
    __tablename__ = 'campers'
    id                  = db.Column(db.Integer, primary_key=True)
    first_name          = db.Column(db.String(100), nullable=False)
    last_name           = db.Column(db.String(100), nullable=False)
    age                 = db.Column(db.Integer, nullable=True)
    gender              = db.Column(db.Enum('male','female','other'), nullable=True)
    grade               = db.Column(db.String(20),  nullable=True)
    cabin_group         = db.Column(db.String(100), nullable=True)
    session             = db.Column(db.String(100), nullable=True)
    guardian_name       = db.Column(db.String(150), nullable=True)
    guardian_phone      = db.Column(db.String(30),  nullable=True)
    guardian_email      = db.Column(db.String(150), nullable=True)
    emergency_contact   = db.Column(db.String(150), nullable=True)
    emergency_phone     = db.Column(db.String(30),  nullable=True)
    allergies           = db.Column(db.Text, nullable=True)
    medical_notes       = db.Column(db.Text, nullable=True)
    medications         = db.Column(db.Text, nullable=True)
    registration_status = db.Column(
        db.Enum('registered','waitlist','cancelled'),
        default='registered', nullable=False)
    payment_status      = db.Column(
        db.Enum('paid','partial','unpaid'),
        default='unpaid', nullable=False)
    notes               = db.Column(db.Text, nullable=True)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    checkins = db.relationship('CheckIn', backref='camper', lazy=True)

    def to_dict(self):
        return {
            'id': self.id, 'first_name': self.first_name, 'last_name': self.last_name,
            'full_name': f'{self.first_name} {self.last_name}',
            'age': self.age, 'gender': self.gender, 'grade': self.grade,
            'cabin_group': self.cabin_group, 'session': self.session,
            'guardian_name': self.guardian_name, 'guardian_phone': self.guardian_phone,
            'guardian_email': self.guardian_email,
            'emergency_contact': self.emergency_contact,
            'emergency_phone': self.emergency_phone,
            'allergies': self.allergies, 'medical_notes': self.medical_notes,
            'medications': self.medications,
            'registration_status': self.registration_status,
            'payment_status': self.payment_status, 'notes': self.notes,
            'checked_in': any(c.checked_out_at is None for c in self.checkins),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

#### `backend/models/checkin.py`

```python
from db import db
from datetime import datetime

class CheckIn(db.Model):
    __tablename__ = 'checkins'
    id             = db.Column(db.Integer, primary_key=True)
    camper_id      = db.Column(db.Integer, db.ForeignKey('campers.id'), nullable=False)
    checked_in_by  = db.Column(db.Integer, db.ForeignKey('users.id'),   nullable=False)
    checked_in_at  = db.Column(db.DateTime, default=datetime.utcnow,    nullable=False)
    checked_out_at = db.Column(db.DateTime, nullable=True)
    checked_out_by = db.Column(db.Integer, db.ForeignKey('users.id'),   nullable=True)
    notes          = db.Column(db.Text, nullable=True)
    staff_in  = db.relationship('User', foreign_keys=[checked_in_by])
    staff_out = db.relationship('User', foreign_keys=[checked_out_by])

    def to_dict(self):
        return {
            'id': self.id, 'camper_id': self.camper_id,
            'camper_name': f'{self.camper.first_name} {self.camper.last_name}'
                           if self.camper else None,
            'checked_in_by':  self.staff_in.username  if self.staff_in  else None,
            'checked_in_at':  self.checked_in_at.isoformat(),
            'checked_out_at': self.checked_out_at.isoformat() if self.checked_out_at else None,
            'checked_out_by': self.staff_out.username if self.staff_out else None,
            'notes': self.notes,
        }
```

#### `backend/routes/auth.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
    if not user.is_active:
        return jsonify({'error': 'Account disabled. Contact administrator.'}), 403
    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role})
    return jsonify({'access_token': token, 'user': user.to_dict()}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200
```

#### `backend/routes/campers.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import Camper
from db import db

campers_bp = Blueprint('campers', __name__)

def require_admin():
    return get_jwt().get('role') == 'admin'

@campers_bp.route('/', methods=['GET'])
@jwt_required()
def get_campers():
    search   = request.args.get('search', '').strip()
    status   = request.args.get('status', '').strip()
    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    query    = Camper.query
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(
            Camper.first_name.ilike(like),
            Camper.last_name.ilike(like),
            Camper.guardian_name.ilike(like)))
    if status:
        query = query.filter(Camper.registration_status == status)
    paged = query.order_by(Camper.last_name).paginate(
        page=page, per_page=per_page, error_out=False)
    return jsonify({
        'campers': [c.to_dict() for c in paged.items],
        'total': paged.total, 'pages': paged.pages
    }), 200

@campers_bp.route('/', methods=['POST'])
@jwt_required()
def create_camper():
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    if not data.get('first_name') or not data.get('last_name'):
        return jsonify({'error': 'First and last name required'}), 400
    fields = ['first_name','last_name','age','gender','grade','cabin_group','session',
              'guardian_name','guardian_phone','guardian_email','emergency_contact',
              'emergency_phone','allergies','medical_notes','medications',
              'registration_status','payment_status','notes']
    camper = Camper(**{k: data.get(k) for k in fields})
    db.session.add(camper)
    db.session.commit()
    return jsonify({'camper': camper.to_dict()}), 201

@campers_bp.route('/<int:cid>', methods=['PUT'])
@jwt_required()
def update_camper(cid):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    camper = Camper.query.get_or_404(cid)
    data   = request.get_json()
    for f in ['first_name','last_name','age','gender','grade','cabin_group','session',
              'guardian_name','guardian_phone','guardian_email','emergency_contact',
              'emergency_phone','allergies','medical_notes','medications',
              'registration_status','payment_status','notes']:
        if f in data:
            setattr(camper, f, data[f])
    db.session.commit()
    return jsonify({'camper': camper.to_dict()}), 200

@campers_bp.route('/<int:cid>', methods=['DELETE'])
@jwt_required()
def delete_camper(cid):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    camper = Camper.query.get_or_404(cid)
    db.session.delete(camper)
    db.session.commit()
    return jsonify({'message': 'Camper deleted'}), 200

@campers_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    all_c = Camper.query.all()
    return jsonify({
        'total_registered':  Camper.query.count(),
        'status_registered': Camper.query.filter_by(registration_status='registered').count(),
        'checked_in': sum(1 for c in all_c if any(ci.checked_out_at is None for ci in c.checkins)),
        'paid': Camper.query.filter_by(payment_status='paid').count(),
    }), 200
```

#### `backend/routes/checkin.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Camper, CheckIn
from db import db
from datetime import datetime

checkin_bp = Blueprint('checkin', __name__)

@checkin_bp.route('/', methods=['POST'])
@jwt_required()
def check_in():
    user_id   = int(get_jwt_identity())
    data      = request.get_json()
    camper_id = data.get('camper_id')
    if not camper_id:
        return jsonify({'error': 'camper_id is required'}), 400
    Camper.query.get_or_404(camper_id)
    if CheckIn.query.filter_by(camper_id=camper_id, checked_out_at=None).first():
        return jsonify({'error': 'Camper is already checked in'}), 409
    ci = CheckIn(camper_id=camper_id, checked_in_by=user_id, notes=data.get('notes'))
    db.session.add(ci)
    db.session.commit()
    return jsonify({'checkin': ci.to_dict()}), 201

@checkin_bp.route('/<int:checkin_id>/checkout', methods=['POST'])
@jwt_required()
def check_out(checkin_id):
    user_id = int(get_jwt_identity())
    ci = CheckIn.query.get_or_404(checkin_id)
    if ci.checked_out_at:
        return jsonify({'error': 'Already checked out'}), 409
    ci.checked_out_at = datetime.utcnow()
    ci.checked_out_by = user_id
    db.session.commit()
    return jsonify({'checkin': ci.to_dict()}), 200

@checkin_bp.route('/', methods=['GET'])
@jwt_required()
def get_checkins():
    page        = int(request.args.get('page', 1))
    per_page    = int(request.args.get('per_page', 50))
    active_only = request.args.get('active_only','false').lower() == 'true'
    query = CheckIn.query
    if active_only:
        query = query.filter(CheckIn.checked_out_at.is_(None))
    paged = query.order_by(CheckIn.checked_in_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False)
    return jsonify({'checkins': [c.to_dict() for c in paged.items], 'total': paged.total}), 200
```

#### `backend/routes/users.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import User
from db import db

users_bp = Blueprint('users', __name__)

def require_admin():
    return get_jwt().get('role') == 'admin'

@users_bp.route('/', methods=['GET'])
@jwt_required()
def get_users():
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    return jsonify({'users': [u.to_dict() for u in User.query.order_by(User.username).all()]}), 200

@users_bp.route('/', methods=['POST'])
@jwt_required()
def create_user():
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json()
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
    user = User(username=data['username'], role=data.get('role','user'),
                full_name=data.get('full_name'), email=data.get('email'))
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'user': user.to_dict()}), 201

@users_bp.route('/<int:uid>', methods=['PUT'])
@jwt_required()
def update_user(uid):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    user = User.query.get_or_404(uid)
    data = request.get_json()
    for f in ['role', 'full_name', 'email', 'is_active']:
        if f in data:
            setattr(user, f, data[f])
    if data.get('password'):
        user.set_password(data['password'])
    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200

@users_bp.route('/<int:uid>', methods=['DELETE'])
@jwt_required()
def delete_user(uid):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403
    user = User.query.get_or_404(uid)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted'}), 200
```

#### `backend/utils/seed.py`

```python
from models import User
from db import db

def seed_admin():
    if User.query.count() == 0:
        admin = User(username='admin', role='admin',
                     full_name='Camp Administrator',
                     email='admin@churchcamp.org')
        admin.set_password('Admin@1234!')
        db.session.add(admin)
        db.session.commit()
        print('Default admin created: admin / Admin@1234!')
        print('Change this password immediately after first login!')
```

#### `backend/tests/test_auth.py`

```python
import pytest, json
from app import create_app
from db import db as _db

@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        _db.create_all()
        from utils.seed import seed_admin
        seed_admin()
    yield app

@pytest.fixture
def client(app):
    return app.test_client()

def test_login_success(client):
    res = client.post('/api/auth/login',
        data=json.dumps({'username': 'admin', 'password': 'Admin@1234!'}),
        content_type='application/json')
    assert res.status_code == 200
    assert 'access_token' in json.loads(res.data)

def test_login_wrong_password(client):
    res = client.post('/api/auth/login',
        data=json.dumps({'username': 'admin', 'password': 'wrong'}),
        content_type='application/json')
    assert res.status_code == 401

def test_login_missing_fields(client):
    res = client.post('/api/auth/login',
        data=json.dumps({'username': 'admin'}),
        content_type='application/json')
    assert res.status_code == 400

def test_protected_route_no_token(client):
    res = client.get('/api/campers/')
    assert res.status_code == 401
```

---

### Frontend Code

#### `frontend/src/utils/api.js`

```js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to /login on 401
api.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export default api;
```

#### `frontend/src/context/AuthContext.js`

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/api/auth/me')
        .then(r => setUser(r.data.user))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [logout]);

  const login = async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password });
    localStorage.setItem('token', res.data.access_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin', loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

#### `frontend/src/App.js`

```jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell    from './components/AppShell';
import LoginPage   from './pages/LoginPage';
import HomePage    from './pages/HomePage';
import CampersPage from './pages/CampersPage';
import CheckInPage from './pages/CheckInPage';
import UsersPage   from './pages/UsersPage';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index          element={<HomePage />} />
        <Route path="campers" element={<CampersPage />} />
        <Route path="checkin" element={<CheckInPage />} />
        <Route path="users"   element={<RequireAdmin><UsersPage /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><AppRoutes /></AuthProvider>
    </BrowserRouter>
  );
}
```

#### `frontend/src/components/AppShell.js`

```jsx
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)
                   || user?.username?.slice(0, 2).toUpperCase();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="cross">✝</span>
          <h2>Camp Registration</h2>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/"        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Dashboard</NavLink>
          <NavLink to="/campers" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Campers</NavLink>
          <NavLink to="/checkin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Check-In</NavLink>
          {isAdmin && (
            <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>Users</NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="avatar">{initials}</div>
            <div className="info">
              <div className="name">{user?.full_name || user?.username}</div>
              <div className="role-tag">{user?.role}</div>
            </div>
          </div>
          <button className="nav-item w-full" onClick={logout}>Sign Out</button>
        </div>
      </aside>
      <div className="main-content"><Outlet /></div>
    </div>
  );
}
```

#### `frontend/src/pages/LoginPage.js`

```jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [form,    setForm]    = useState({ username: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="cross-mark">✝</span>
        <h1>Welcome Back</h1>
        <p className="tagline">Church Camp Registration &amp; Check-In</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" required
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### `frontend/src/pages/HomePage.js`

```jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function HomePage() {
  const { isAdmin } = useAuth();
  const [stats,  setStats]  = useState(null);
  const [active, setActive] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/campers/stats'),
      api.get('/api/checkin/?active_only=true&per_page=8'),
    ]).then(([s, c]) => {
      setStats(s.data);
      setActive(c.data.checkins);
    });
  }, []);

  return (
    <>
      <div className="top-bar">
        <h1>Dashboard</h1>
        <span className="text-muted">{new Date().toLocaleDateString()}</span>
      </div>
      <div className="page-body">
        <div className="stat-grid">
          <div className="stat-card green-accent">
            <div className="label">Total Registered</div>
            <div className="value">{stats?.total_registered ?? '-'}</div>
          </div>
          <div className="stat-card gold-accent">
            <div className="label">Checked In Now</div>
            <div className="value">{stats?.checked_in ?? '-'}</div>
          </div>
          <div className="stat-card green-accent">
            <div className="label">Confirmed</div>
            <div className="value">{stats?.status_registered ?? '-'}</div>
          </div>
          <div className="stat-card gold-accent">
            <div className="label">Paid</div>
            <div className="value">{stats?.paid ?? '-'}</div>
          </div>
        </div>
        <div className="quick-actions">
          <Link to="/checkin" className="btn btn-primary">Go to Check-In</Link>
          <Link to="/campers" className="btn btn-outline">View Campers</Link>
          {isAdmin && <Link to="/campers" className="btn btn-ghost">Register Camper</Link>}
        </div>
      </div>
    </>
  );
}
```

#### `frontend/src/setupProxy.js`

```js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',  // Use 127.0.0.1, not localhost
      changeOrigin: true,
      logLevel: 'debug',
    })
  );
};
```

#### `frontend/src/index.css` — Key Design Tokens

```css
:root {
  --forest:     #1E4D2B;   /* primary green  */
  --forest-mid: #2E6B3E;   /* medium green   */
  --gold:       #C8972B;   /* accent gold    */
  --cream:      #F8F5EE;   /* background     */
  --charcoal:   #2C2C2C;   /* body text      */
  --muted:      #6B7280;   /* secondary text */
  --radius:     8px;
  --shadow:     0 2px 8px rgba(30,77,43,0.10);
}
/* Fonts: Playfair Display (headings) + Inter (body) from Google Fonts */
```

---

### Docker & Infrastructure

#### `docker-compose.yml`

```yaml
version: '3.9'
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE:      churchcamp
      MYSQL_USER:          campuser
      MYSQL_PASSWORD:      camppass
    ports: ['3306:3306']
    volumes: [db_data:/var/lib/mysql]
    healthcheck:
      test: ['CMD','mysqladmin','ping','-h','localhost','-u','campuser','-pcamppass']
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL:   mysql+pymysql://campuser:camppass@db:3306/churchcamp
      JWT_SECRET_KEY: dev-secret-change-in-prod
      CORS_ORIGINS:   http://localhost:3000
    ports: ['5000:5000']
    depends_on:
      db: { condition: service_healthy }
    command: python app.py

  frontend:
    build: ./frontend
    ports: ['80:80']
    depends_on: [backend]

volumes:
  db_data:
```

#### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser
EXPOSE 5000
CMD ["gunicorn","--bind","0.0.0.0:5000","--workers","4","--timeout","60","app:create_app()"]
```

#### `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
```

#### `frontend/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    gzip on;

    location /api/ {
        proxy_pass       http://backend:5000;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control 'public, immutable';
    }
}
```

#### `infra/init_db.sql`

```sql
CREATE DATABASE IF NOT EXISTS churchcamp
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'campuser'@'localhost'
  IDENTIFIED BY 'CHANGE_THIS_PASSWORD';

GRANT ALL PRIVILEGES ON churchcamp.* TO 'campuser'@'localhost';
FLUSH PRIVILEGES;
-- Tables are auto-created by SQLAlchemy on first app start
```

---

### CI/CD Workflow

#### `.github/workflows/deploy.yml`

```yaml
name: CI/CD — Church Camp Manager

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:

  test-backend:
    name: Test Flask Backend
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: rootpass
          MYSQL_DATABASE:      churchcamp_test
          MYSQL_USER:          campuser
          MYSQL_PASSWORD:      camppass
        ports: ['3306:3306']
        options: >-
          --health-cmd='mysqladmin ping -h localhost -u campuser -pcamppass'
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt
      - name: Install dependencies
        run: cd backend && pip install -r requirements.txt
      - name: Run pytest
        env:
          DATABASE_URL: mysql+pymysql://campuser:camppass@127.0.0.1:3306/churchcamp_test
          JWT_SECRET_KEY: test-secret-key
          SECRET_KEY: test-flask-secret
          CORS_ORIGINS: http://localhost:3000
        run: cd backend && python -m pytest tests/ -v --tb=short
      - name: Verify Flask starts
        env:
          DATABASE_URL: mysql+pymysql://campuser:camppass@127.0.0.1:3306/churchcamp_test
          JWT_SECRET_KEY: test-secret-key
          SECRET_KEY: test-flask-secret
          CORS_ORIGINS: http://localhost:3000
        run: |
          cd backend && timeout 15 python app.py &
          sleep 8
          curl -f http://localhost:5000/api/auth/me || true
          echo "Flask started OK"

  test-frontend:
    name: Test React Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - name: Build React
        env:
          REACT_APP_API_URL: http://placeholder
          CI: false
        run: cd frontend && npm run build && echo "Build OK"

  deploy:
    name: Deploy to EC2
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Build React for production
        env:
          REACT_APP_API_URL: http://${{ secrets.EC2_HOST }}
          CI: false
        run: cd frontend && npm ci && npm run build
      - name: Set up SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.EC2_SSH_KEY }}" > ~/.ssh/churchcamp-key.pem
          chmod 600 ~/.ssh/churchcamp-key.pem
          ssh-keyscan -H ${{ secrets.EC2_HOST }} >> ~/.ssh/known_hosts
      - name: Upload backend
        run: |
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/churchcamp-key.pem" \
            --exclude='.env' --exclude='venv/' --exclude='__pycache__/' \
            backend/ \
            ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/home/ubuntu/backend/
      - name: Upload frontend
        run: |
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/churchcamp-key.pem" \
            frontend/build/ \
            ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/var/www/churchcamp/
      - name: Restart services
        run: |
          ssh -i ~/.ssh/churchcamp-key.pem \
            ${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }} << 'ENDSSH'
          cd /home/ubuntu/backend
          source venv/bin/activate
          pip install -r requirements.txt -q
          sudo systemctl restart churchcamp
          sudo systemctl reload nginx
          sleep 3
          sudo systemctl is-active churchcamp && echo "Flask: OK"
          sudo systemctl is-active nginx      && echo "Nginx: OK"
          echo "Deployment complete!"
          ENDSSH
```

**GitHub Secrets to add** (repo → Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `EC2_HOST` | Your EC2 public IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Contents of `churchcamp-key.pem` |
| `JWT_SECRET_KEY` | Your production JWT secret |
| `SECRET_KEY` | Your Flask secret key |

**Allow passwordless restarts on EC2** (run once):

```bash
sudo visudo
# Add at the very bottom:
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart churchcamp, /bin/systemctl reload nginx, /bin/systemctl is-active churchcamp, /bin/systemctl is-active nginx
```

---

## AWS Free Tier Deployment

**Cost: $0/month for 12 months**

| Service | Free Allowance | Cost |
|---------|----------------|------|
| EC2 t2.micro | 750 hrs/month | $0 |
| EBS 8GB | 30GB/month | $0 |
| CloudFront | 1TB + 10M requests | $0 |
| **Total** | | **$0** |

### Step 1 — Launch EC2

1. AWS Console → EC2 → **Launch Instance**
2. Name: `churchcamp-server`
3. AMI: Ubuntu Server 24.04 LTS (Free tier eligible)
4. Instance type: `t2.micro`
5. Create key pair → `churchcamp-key` → RSA → `.pem` → **Download**
6. Security group — Inbound rules:

   | Type | Port | Source |
   |------|------|--------|
   | SSH | 22 | My IP |
   | HTTP | 80 | Anywhere |
   | HTTPS | 443 | Anywhere |

### Step 2 — Set Up Server

```bash
# Connect
ssh -i churchcamp-key.pem ubuntu@YOUR_EC2_IP

# Install software
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nginx mysql-server git rsync

# MySQL setup
sudo systemctl start mysql && sudo systemctl enable mysql
sudo mysql_secure_installation

sudo mysql -u root -p
```

```sql
CREATE DATABASE churchcamp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'campuser'@'localhost' IDENTIFIED BY 'CampPass@123!';
GRANT ALL PRIVILEGES ON churchcamp.* TO 'campuser'@'localhost';
FLUSH PRIVILEGES; EXIT;
```

### Step 3 — Deploy Backend

```bash
# Upload backend from Windows
scp -i churchcamp-key.pem -r ./backend ubuntu@YOUR_EC2_IP:/home/ubuntu/

# On EC2
cd /home/ubuntu/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create .env
nano .env
# DATABASE_URL=mysql+pymysql://campuser:CampPass@123!@localhost:3306/churchcamp
# JWT_SECRET_KEY=your-very-long-random-secret-48-chars
# SECRET_KEY=another-random-secret-also-48-chars
# CORS_ORIGINS=http://YOUR_EC2_IP

# Create systemd service
sudo nano /etc/systemd/system/churchcamp.service
```

```ini
[Unit]
Description=Church Camp Flask Backend
After=network.target mysql.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/backend
EnvironmentFile=/home/ubuntu/backend/.env
ExecStart=/home/ubuntu/backend/venv/bin/gunicorn \
    --bind 127.0.0.1:5000 --workers 2 --timeout 60 'app:create_app()'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable churchcamp
sudo systemctl start churchcamp
sudo systemctl status churchcamp   # should say: active (running)
```

### Step 4 — Deploy Frontend

```bash
# Build on your machine
REACT_APP_API_URL=http://YOUR_EC2_IP npm run build

# Upload
scp -i churchcamp-key.pem -r ./frontend/build/* ubuntu@YOUR_EC2_IP:/var/www/churchcamp/
```

### Step 5 — Configure Nginx

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/churchcamp
```

```nginx
server {
    listen 80;
    server_name YOUR_EC2_IP;

    location /api/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host        $host;
        proxy_set_header   X-Real-IP   $remote_addr;
        proxy_read_timeout 60s;
    }

    location / {
        root      /var/www/churchcamp;
        index     index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/churchcamp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx

# Test: open http://YOUR_EC2_IP in browser
# Login: admin / Admin@1234!
```

### Step 6 — Add CloudFront (Free HTTPS)

1. AWS Console → CloudFront → **Create Distribution**
2. Origin domain: `YOUR_EC2_IP`
3. Protocol: HTTP only
4. Cache policy: CachingDisabled
5. Error pages: 403 and 404 → `/index.html` → HTTP 200
6. After ~10 min you get `https://d1abc123.cloudfront.net`

```bash
# Update CORS on EC2
nano /home/ubuntu/backend/.env
# CORS_ORIGINS=http://YOUR_EC2_IP,https://d1abc123.cloudfront.net
sudo systemctl restart churchcamp
```

### Step 7 — Push to GitHub → Auto-Deploy

```bash
git init && git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOURNAME/church-camp.git
git push -u origin main

# Watch: GitHub → Actions tab
# Every future push auto-deploys in ~3-5 minutes
```

---

## API Reference

All protected endpoints require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user info |

### Campers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/campers/` | JWT | List (search, filter, paginate) |
| GET | `/api/campers/:id` | JWT | Single camper |
| POST | `/api/campers/` | Admin | Register camper |
| PUT | `/api/campers/:id` | Admin | Update camper |
| DELETE | `/api/campers/:id` | Admin | Delete camper |
| GET | `/api/campers/stats` | JWT | Dashboard stats |

### Check-In

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/checkin/` | JWT | Check in |
| POST | `/api/checkin/:id/checkout` | JWT | Check out |
| GET | `/api/checkin/` | JWT | List (active_only param) |

### Users (Admin Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/` | Admin | List staff |
| POST | `/api/users/` | Admin | Create user |
| PUT | `/api/users/:id` | Admin | Update / reset password |
| DELETE | `/api/users/:id` | Admin | Delete user |

---

## Security Checklist

- [ ] Change default admin password immediately after first login
- [ ] Use strong `JWT_SECRET_KEY` (48+ random chars)
- [ ] Use strong `SECRET_KEY` (different from JWT key, 48+ chars)
- [ ] Use strong MySQL passwords (not the examples in this README)
- [ ] Remove port 5000 from EC2 security group after setup
- [ ] Serve over HTTPS via CloudFront
- [ ] Enable automatic Ubuntu security updates: `sudo dpkg-reconfigure --priority=low unattended-upgrades`
- [ ] Never commit `.env` to git
- [ ] SSH port 22 restricted to your IP only

---

## Troubleshooting

### Proxy Error / 504 Timeout (local dev)

```
Proxy error: Could not proxy /api/auth/login (ECONNREFUSED)
```

- Verify `frontend/src/setupProxy.js` exists with `target: 'http://127.0.0.1:5000'`
- Start order: MySQL → Flask → React
- Hard reset: `Ctrl+C` → delete `node_modules/.cache` → `npm start`

### Flask won't connect to MySQL

- Start MySQL: `docker compose up db` (wait for "ready for connections")
- Verify `DATABASE_URL` in `.env` matches your credentials

### Flask not starting on EC2

```bash
sudo journalctl -u churchcamp -n 50   # view logs
sudo systemctl status churchcamp
```

### Quick Commands

| Task | Command |
|------|---------|
| SSH into EC2 | `ssh -i churchcamp-key.pem ubuntu@EC2_IP` |
| View Flask logs live | `sudo journalctl -u churchcamp -f` |
| Restart Flask | `sudo systemctl restart churchcamp` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Check all services | `sudo systemctl status churchcamp nginx mysql` |
| Start all local | `docker compose up --build` |
| Backup database | `mysqldump -u campuser -p churchcamp > backup.sql` |

---

*Church Camp Manager — Flask · React · MySQL · GitHub Actions CI/CD · AWS EC2 Free Tier*
