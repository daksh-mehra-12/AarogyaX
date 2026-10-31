# AarogyaX – AI-Powered Healthcare Management Platform

**Smarter Healthcare. Better Insights. Improved Patient Care.**

AarogyaX is an AI-powered healthcare platform designed to simplify healthcare workflows by combining patient management, medical data analysis, machine learning-based predictions, and intelligent healthcare assistance in one application.

The platform aims to support healthcare professionals with organized patient information, data-driven insights, and accessible healthcare tools.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [AI and Machine Learning](#ai-and-machine-learning)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Deployment](#deployment)
- [Future Improvements](#future-improvements)
- [Disclaimer](#disclaimer)

## Overview

Healthcare systems generate large amounts of patient and medical information. Managing this information efficiently and extracting meaningful insights can be challenging.

AarogyaX addresses this challenge through a unified digital platform that brings together:

- Patient and healthcare data management.
- AI-assisted healthcare interactions.
- Machine learning-based prediction workflows.
- Medical analytics and insights.
- Digital healthcare document handling.

The goal is to improve accessibility, streamline workflows, and support informed decision-making.

## Key Features

### 1. Patient Management
- Organized patient information.
- Patient record management.
- Structured access to healthcare data.

### 2. AI Healthcare Assistant
- AI-powered conversational assistance.
- Healthcare-related information support.
- Integration with configured AI services.

### 3. Machine Learning Predictions
The platform includes machine learning workflows using models such as:

- Random Forest
- Logistic Regression
- Decision Tree
- Gradient Boosting

Predictions depend on the implemented model, available input data, and validation logic.

### 4. Medical Data Analytics
- Healthcare data analysis.
- Structured insights and visualizations.
- Patient-related information summaries.

### 5. Document and PDF Handling
- Medical document processing.
- PDF-related workflows.
- Structured access to supported document information.

### 6. Healthcare Workflow Support
- Integrated application workflows.
- Backend API communication.
- Centralized access to supported platform features.

*Only features implemented and verified in the current codebase should be considered production-ready.*

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Machine Learning | Scikit-learn |
| API Communication | REST APIs |
| Database | Configure according to the implemented database |
| AI Integration | Configured AI provider |
| Version Control | Git, GitHub |

## System Architecture

AarogyaX follows a frontend-backend architecture.

```text
                 USER
                   |
                   v
          React + TypeScript
             Frontend
                   |
                   v
              REST APIs
                   |
                   v
             FastAPI
              Backend
                   |
          +--------+--------+
          |        |        |
          v        v        v
       Database  AI/ML   External
                 Models   Services
          |        |        |
          +--------+--------+
                   |
                   v
             API Response
                   |
                   v
              Frontend
```

## Project Structure

The following is a representative structure. Update it to match the actual repository.

```text
AarogyaX/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   ├── models/
│   ├── routes/
│   ├── requirements.txt
│   └── main.py
│
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install the following:

- Node.js and npm
- Python 3.10 or compatible version
- Git
- A configured database
- Required AI service credentials, if applicable

### 1. Clone the Repository

```bash
git clone https://github.com/daksh-mehra-12/AarogyaX.git
cd AarogyaX
```

### 2. Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
npm install
```

Create the required environment configuration using `.env.example`.

Start the development server:

```bash
npm run dev
```

### 3. Backend Setup

Open another terminal:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment.

Windows:

```cmd
venv\Scripts\activate
```

Linux/macOS:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the backend using the actual application entry point. For example:

```bash
uvicorn main:app --reload
```

If the application entry point is different, replace `main:app` accordingly.

## Environment Variables

Create local environment files using the provided `.env.example`.

Typical configuration may include:

```env
# Backend
DATABASE_URL=
SECRET_KEY=
CORS_ORIGINS=

# AI Integration
GEMINI_API_KEY=

# Frontend
VITE_API_BASE_URL=
```

**Important:**
- Never commit real API keys or passwords.
- Do not expose private Firebase configuration.
- Keep production credentials in the hosting provider's environment settings.
- Use only variables actually referenced by the application.

## Running the Application

Run the frontend and backend separately during local development.

Frontend:

```bash
npm run dev
```

Backend:

```bash
uvicorn main:app --reload
```

The exact ports and startup commands depend on the project configuration.

## AI and Machine Learning

AarogyaX integrates machine learning workflows to support healthcare-related data analysis.

The implemented model families include:

- Random Forest
- Logistic Regression
- Decision Tree
- Gradient Boosting

The prediction pipeline should validate incoming data, preprocess inputs, load the appropriate model, execute inference, and return structured responses.

Machine learning predictions are informational and must not replace professional medical diagnosis.

## API Documentation

The backend uses FastAPI for REST API development.

When the backend is running, interactive API documentation is commonly available at:

```text
/docs
```

Alternative documentation:

```text
/redoc
```

Available routes and request schemas should be verified against the backend implementation.

## Security

AarogyaX follows security-conscious development practices:

- Environment-based configuration.
- Secret management through environment variables.
- Input validation.
- Backend-side authorization checks.
- Controlled CORS configuration.
- Protection of local databases and sensitive files.

Security measures must be verified against the actual implementation before production deployment.

## Deployment

The application requires deployment of its frontend, backend, and database as separate or integrated services depending on the architecture.

Typical deployment responsibilities:

| Component | Deployment Requirement |
|---|---|
| Frontend | Production build and static hosting |
| Backend | Python application hosting |
| Database | Production database with persistent storage |
| AI Services | Valid production credentials and connectivity |
| Environment | Production environment variables |
| Integration | Correct API URL, CORS and health checks |

Before deployment, verify:

- Frontend production build.
- Backend startup.
- Database connectivity.
- API integration.
- Authentication and authorization.
- AI service connectivity.
- File upload and document processing.
- Production environment variables.

## Future Improvements

Potential areas for future development:

- Enhanced healthcare analytics.
- More comprehensive patient dashboards.
- Improved model evaluation and monitoring.
- Additional healthcare integrations.
- Better accessibility and multilingual support.
- Scalable cloud infrastructure.

## Disclaimer

AarogyaX is a healthcare technology project intended to support healthcare workflows and provide informational assistance.

Machine learning predictions and AI-generated responses are not medical diagnoses. Users should consult qualified healthcare professionals for medical decisions.

## Repository

GitHub: https://github.com/daksh-mehra-12/AarogyaX

---

**AarogyaX – Bringing Healthcare Data, Intelligence, and Technology Together.**
