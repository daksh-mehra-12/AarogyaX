# Aarogya X — Setup & Developer Onboarding Guide

This guide provides step-by-step instructions to set up, configure, run, and test Aarogya X locally.

---

## System Requirements

- **Python**: Version `3.10+` (Tested on Python 3.11/3.14)
- **Node.js**: Version `18.0+` or `20.0+`
- **Package Manager**: `npm` or `pnpm`
- **OS**: Windows, macOS, or Linux

---

## 1. Repository Setup

```bash
# Clone repository
git clone https://github.com/your-username/aarogya-x.git
cd aarogya-x
```

---

## 2. Environment Configuration

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

Default `.env` configuration for local development:

```env
PORT=5000
SECRET_KEY=aarogya_secret_key_local_dev_32char
DATABASE_URL=sqlite:///aarogya.db
NODE_ENV=development
```

---

## 3. Backend Setup & Seeding

```bash
# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database seed script (Seeds RBAC users & sample clinical cases)
python backend/seed_demo_data.py
```

### Pre-configured Seed Credentials:

| Role | Email | Default Password |
| :--- | :--- | :--- |
| **Medical Intern** | `intern@test.com` | `password123` |
| **Junior Doctor** | `jr@test.com` | `password123` |
| **Senior Consultant** | `consultant@test.com` | `password123` |
| **System Admin** | `admin@test.com` | `password123` |

---

## 4. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
pnpm install   # or npm install

# Start Vite development server
pnpm run dev   # or npm run dev
```

The frontend will start at `http://localhost:5173`.

---

## 5. Running Full Application

### Option A: Simultaneous Running via Root Scripts
From root project directory:

```bash
# Start Backend API (Port 5000)
npm run dev:backend

# In a separate terminal window, start Frontend (Port 5173)
npm run dev:frontend
```

---

## 6. Running Tests & Quality Verification

```bash
# Run Backend Unit Tests (RBAC & ML Inference)
python -m unittest discover -s tests

# Run Frontend Type Checking
cd frontend && pnpm run typecheck

# Run Frontend Production Build Check
cd frontend && pnpm run build
```
