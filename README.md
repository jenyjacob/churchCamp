# ⛺ Church Camp Registration & Check-In System

A full-stack web application for managing church camp registrations and check-ins.

**Stack:** React + Flask + MySQL | **Hosting:** AWS (ECS Fargate + RDS + S3/CloudFront)

---

## 🗂️ Project Structure

```
church-camp/
├── backend/          Flask API (Python)
│   ├── app.py
│   ├── config.py
│   ├── models/       SQLAlchemy models (User, Camper, CheckIn)
│   ├── routes/       REST endpoints (auth, campers, checkin, users)
│   ├── utils/        Seed admin utility
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/         React app
│   ├── src/
│   │   ├── pages/    LoginPage, HomePage, CampersPage, CheckInPage, UsersPage
│   │   ├── components/  AppShell (sidebar layout)
│   │   ├── context/  AuthContext (JWT)
│   │   └── utils/    api.js (Axios)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── infra/            DB init SQL
├── docker-compose.yml
└── README.md
```

---

## 👤 Default Login

After first startup, a default admin account is created:

| Field    | Value         |
|----------|---------------|
| Username | `admin`       |
| Password | `Admin@1234!` |

⚠️ **Change this password immediately** after first login via Admin → Users.

---

## 🔐 Roles

| Role    | Permissions                              |
|---------|------------------------------------------|
| `admin` | Full CRUD: campers, users, check-ins     |
| `user`  | View campers, perform check-in/check-out |

---

## 🚀 Local Development (Docker Compose)

### Prerequisites
- Docker Desktop installed and running

### Start everything

```bash
cd church-camp
docker compose up --build
```

- Frontend: http://localhost:80
- Backend API: http://localhost:5000
- MySQL: localhost:3306

### Without Docker (manual)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Set env vars
export DATABASE_URL="mysql+pymysql://campuser:camppass@localhost:3306/churchcamp"
export JWT_SECRET_KEY="your-secret-key"

python app.py
```

**Frontend:**
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:5000 npm start
```

---

## ☁️ AWS Deployment Guide

### Architecture Overview

```
Internet
   │
   ▼
CloudFront (CDN + HTTPS)
   │
   ├──▶ S3 Bucket (React static files)
   │
   └──▶ ALB (Application Load Balancer)
           │
           ▼
        ECS Fargate (Flask backend container)
           │
           ▼
        RDS MySQL (Multi-AZ for production)
```

---

### Step 1 — Prerequisites

```bash
# Install AWS CLI
pip install awscli
aws configure   # Enter: Access Key, Secret, Region (e.g. us-east-1), json

# Install ECS CLI (optional but helpful)
npm install -g @aws-amplify/cli
```

---

### Step 2 — Create RDS MySQL Database

1. Open AWS Console → **RDS** → Create database
2. Settings:
   - Engine: **MySQL 8.0**
   - Template: Production (or Free Tier for testing)
   - DB instance identifier: `churchcamp-db`
   - Master username: `admin`
   - Master password: (use a strong password)
   - Instance class: `db.t3.micro` (free tier) or `db.t3.small`
   - Storage: 20 GB gp2
   - Multi-AZ: Yes (for production)
   - VPC: Default or your custom VPC
   - Public access: **No** (backend connects via VPC)
   - VPC security group: Create new → allow port 3306 from ECS security group
3. After creation, note the **Endpoint** (e.g. `churchcamp-db.xxxxx.us-east-1.rds.amazonaws.com`)
4. Connect and run `infra/init_db.sql` to create the database and user:
   ```bash
   mysql -h <RDS_ENDPOINT> -u admin -p < infra/init_db.sql
   ```

---

### Step 3 — Store Secrets in AWS Secrets Manager

```bash
# JWT secret
aws secretsmanager create-secret \
  --name "churchcamp/jwt-secret" \
  --secret-string "$(openssl rand -hex 48)"

# Database password
aws secretsmanager create-secret \
  --name "churchcamp/db-password" \
  --secret-string "YOUR_RDS_PASSWORD"
```

---

### Step 4 — Push Backend Docker Image to ECR

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

# Create ECR repository
aws ecr create-repository --repository-name churchcamp-backend --region $AWS_REGION

# Authenticate Docker
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push
cd backend
docker build -t churchcamp-backend .
docker tag churchcamp-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/churchcamp-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/churchcamp-backend:latest
```

---

### Step 5 — Deploy Backend on ECS Fargate

1. **Create ECS Cluster:**
   - AWS Console → ECS → Create Cluster
   - Name: `churchcamp-cluster`
   - Infrastructure: **AWS Fargate**

2. **Create Task Definition:**
   - Family: `churchcamp-backend`
   - Task role: Create IAM role with `secretsmanager:GetSecretValue`
   - Container:
     - Image: your ECR image URI
     - Port: `5000`
     - Environment variables:
       ```
       DATABASE_URL = mysql+pymysql://campuser:<password>@<RDS_ENDPOINT>:3306/churchcamp
       JWT_SECRET_KEY = (from Secrets Manager)
       SECRET_KEY = (from Secrets Manager)
       CORS_ORIGINS = https://your-cloudfront-domain.cloudfront.net
       ```

3. **Create Service:**
   - Launch type: Fargate
   - Task definition: `churchcamp-backend`
   - Desired tasks: 2 (for HA)
   - Load balancer: Application Load Balancer
   - Target group: port 5000, health check path `/api/auth/me` (will return 401, that's OK — set success codes to `200,401`)

---

### Step 6 — Deploy Frontend to S3 + CloudFront

```bash
# Build React app
cd frontend
REACT_APP_API_URL=https://YOUR_ALB_DNS_NAME npm run build

# Create S3 bucket (replace with your unique name)
BUCKET_NAME=churchcamp-frontend-$(date +%s)
aws s3 mb s3://$BUCKET_NAME --region us-east-1

# Enable static website hosting
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html

# Upload build
aws s3 sync build/ s3://$BUCKET_NAME --delete

# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config file://infra/cloudfront-config.json
```

**S3 bucket policy** (allow CloudFront access):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
  }]
}
```

---

### Step 7 — Configure HTTPS (ACM Certificate)

1. AWS Console → **Certificate Manager** → Request certificate
2. Add your domain (e.g. `camp.yourchurch.org`)
3. DNS validation → add the CNAME to your DNS
4. Attach certificate to:
   - CloudFront distribution (frontend)
   - ALB listener (backend HTTPS on port 443)

---

### Step 8 — Update CORS

Once you have your CloudFront domain, update the backend environment variable:
```
CORS_ORIGINS=https://camp.yourchurch.org,https://your-cf-domain.cloudfront.net
```

Redeploy the ECS service to pick up the new environment variable.

---

## 🔒 Security Checklist

- [ ] Change default `admin` password on first login
- [ ] Use strong, unique `JWT_SECRET_KEY` and `SECRET_KEY`
- [ ] RDS not publicly accessible (VPC only)
- [ ] HTTPS on all endpoints (ACM + ALB + CloudFront)
- [ ] ECS task role follows least privilege
- [ ] S3 bucket blocks all public access (CloudFront OAC only)
- [ ] Enable RDS automated backups (7-day minimum)
- [ ] Enable CloudTrail for audit logging
- [ ] Set up CloudWatch alarms for ECS CPU/memory

---

## 📡 API Reference

| Method | Endpoint                         | Auth     | Description              |
|--------|----------------------------------|----------|--------------------------|
| POST   | `/api/auth/login`                | None     | Login, returns JWT       |
| GET    | `/api/auth/me`                   | JWT      | Get current user         |
| GET    | `/api/campers/`                  | JWT      | List campers (paginated) |
| POST   | `/api/campers/`                  | Admin    | Register new camper      |
| PUT    | `/api/campers/:id`               | Admin    | Update camper            |
| DELETE | `/api/campers/:id`               | Admin    | Delete camper            |
| GET    | `/api/campers/stats`             | JWT      | Dashboard statistics     |
| POST   | `/api/checkin/`                  | JWT      | Check in a camper        |
| POST   | `/api/checkin/:id/checkout`      | JWT      | Check out a camper       |
| GET    | `/api/checkin/`                  | JWT      | List check-ins           |
| GET    | `/api/users/`                    | Admin    | List all users           |
| POST   | `/api/users/`                    | Admin    | Create a staff user      |
| PUT    | `/api/users/:id`                 | Admin    | Update user              |
| DELETE | `/api/users/:id`                 | Admin    | Delete user              |
