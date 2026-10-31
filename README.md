# Aarogya X

**Predict • Prevent • Protect**

Aarogya X is a clinical decision-support prototype for antimicrobial-resistance (AMR) surveillance, patient and case records, adverse drug reaction (ADR) reporting, and antimicrobial stewardship.

> **Clinical safety:** Aarogya X is not a medical device or a substitute for clinical judgment, microbiology results, local protocols, or specialist review. Its predictions and generated content have not been independently validated for clinical use. Do not use it to make treatment decisions for real patients.

## Overview

AMR surveillance and pharmacovigilance involve related patient, infection, laboratory, prescribing, and adverse-reaction information. Aarogya X brings these workflows into a web application with a React interface, a FastAPI API, a SQLAlchemy data model, and a scikit-learn prediction pipeline.

The repository includes four serialized prediction pipelines and a small AMR surveillance CSV. The model metadata describes 182 records, of which 37 were used as a holdout set. The stored evaluation metrics are development artifacts only; they do not establish clinical validity, generalizability, or suitability for patient care.

## Features and implementation status

| Area | Status in this repository |
|---|---|
| Sign-in, registration, and role-aware screens | Implemented. The API hashes passwords and issues JWTs; users can currently choose their registration role, including `admin`. This is not safe for an internet-facing deployment without trusted role provisioning. |
| Patient records and vitals | Implemented API and UI workflows, with per-user record ownership checks exercised by tests. |
| Cases and predictions | Implemented case CRUD, PDF endpoints, and prediction workflows. |
| AMR laboratory records | Implemented records with organism, specimen, collection details, and susceptibility results. |
| ADR reporting | Implemented report CRUD and PDF generation. |
| AMR prediction | Implemented four scikit-learn pipelines plus empirical-dataset lookups and clinical-context adjustments. The small dataset and lack of independent clinical validation make this experimental. |
| AI assistant | Partially implemented. It calls Gemini when an API key is configured; otherwise it returns responses from keyword-based clinical templates. It is not a verified clinical knowledge service. |
| Analytics and stewardship | Implemented API and UI workflows that combine application records with the included surveillance dataset. Some displayed policy logic is application-side guidance, not a validated prescribing protocol. |
| PDF reports | Implemented in frontend exports and backend ReportLab endpoints. |
| Email and Gmail | Partially implemented. Backend email endpoints use SMTP; browser Gmail sending uses Firebase/Google sign-in and the Gmail API, which require external project and OAuth configuration. |
| Official-document directory | Implemented as a set of configured external links and a generated PVPI-style form. External sources are not fetched or verified at request time. |

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Wouter, TanStack Query, Tailwind CSS 4, Recharts |
| Node server | Node.js, Express, `tsx`; serves the Vite app in development and `dist/` in production |
| Backend | Python, FastAPI, Uvicorn, Pydantic, SQLAlchemy |
| Database | SQLite by default; SQLAlchemy can use a configured `DATABASE_URL` |
| Authentication | Werkzeug password hashing, signed JWTs, application role checks |
| AI | Google Gemini API (optional, via `GEMINI_API_KEY`) and local keyword-based response templates |
| ML | pandas, NumPy, scikit-learn, joblib; four checked-in model pipelines |
| Documents and email | ReportLab, jsPDF, Firebase Authentication, Gmail API, SMTP |
| Tests | Node.js test runner, TypeScript tests, Python `unittest`, FastAPI `TestClient` |

## Architecture

```text
Browser
  └── React / Vite frontend
        ├── /api/* → Express reverse proxy → FastAPI (default port 5000)
        ├── Google Gemini API (optional clinical assistant)
        └── Firebase Authentication → Gmail API (optional email workflow)

FastAPI
  ├── SQLAlchemy models → SQLite by default (or DATABASE_URL)
  ├── AMR prediction → scikit-learn pipelines + surveillance CSV
  ├── PDF generation → ReportLab
  └── SMTP email endpoints (optional)
```

In development, `npm run dev` starts the Express server, the Vite middleware, and a Python FastAPI child process. In production, the Express server serves the built `dist/` directory and proxies API and OpenAPI requests to FastAPI.

## Frontend architecture

- `src/pages/` contains the routed dashboard, patient, case, AMR, ADR, analytics, stewardship, reporting, AI, and settings screens.
- `src/components/` contains shared layouts, clinical forms, visualizations, dialogs, and UI primitives.
- `src/api/api.ts` contains shared API types, request helpers, and React Query hooks.
- `src/hooks/` contains authentication, Gmail, and toast hooks.
- `src/lib/` contains access rules, clinical vital helpers, Markdown parsing, and PDF data utilities.
- `src/services/gmail.ts` configures Firebase Auth and Gmail API operations from Vite environment variables.

The client uses local storage for its application JWT and user record. Gmail OAuth access tokens are held in memory by the Gmail service.

## Backend architecture

`backend/main.py` creates the FastAPI application and registers routers under `backend/routers/`. Routers implement authentication, patients, vitals, cases, predictions, AMR records, ADRs, analytics, stewardship, AI, health checks, and document/email workflows. SQLAlchemy models and Pydantic schemas are defined in `backend/models.py` and `backend/schemas.py`.

The application calls `Base.metadata.create_all()` at startup. No schema migration tool or migration history is included. SQLite is the default and only database driver included; using another SQLAlchemy database requires adding its driver and configuring `DATABASE_URL`.

### Database entities

The SQLAlchemy models cover:

- `User` — account, password hash, and role.
- `Patient` — demographics and clinical risk fields.
- `PatientVital` — recorded blood pressure, heart rate, and temperature.
- `Case` and `Prediction` — infection case details and associated prediction output.
- `ADRReport` — suspected adverse drug reaction reports.
- `AmrRecord` and `AmrSusceptibility` — laboratory surveillance records and susceptibility findings.

Foreign keys and ORM relationships associate patients with their records and cases with predictions. SQLite is intended as the default local setup, not a configured production data platform.

## AI and machine learning

### Clinical assistant

`POST /api/ai` and `POST /api/ai/chat` accept a clinical query. If `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is present, the backend attempts configured Gemini model endpoints. If those calls do not return a usable response, the backend uses its built-in keyword-based templates. The fallback is not retrieval-augmented generation and does not check current external guidelines.

### AMR prediction

`ml/train.py` prepares the included CSV, converts resistance percentages into four risk classes, preprocesses categorical and numerical features, trains candidate classifiers, evaluates them, and writes model files plus metadata. `ml/predict.py` loads the serialized pipelines and returns a risk class and probabilities. Prediction inputs include infection type, organism, antibiotic, and sensitivity; empirical sensitivity and susceptibility/context adjustments are also used in the prediction flow.

| Model | Classifier |
|---|---|
| `RandomForest` | scikit-learn `RandomForestClassifier` pipeline |
| `GradientBoosting` | scikit-learn `GradientBoostingClassifier` pipeline |
| `DecisionTree` | scikit-learn `DecisionTreeClassifier` pipeline |
| `LogisticRegression` | scikit-learn `LogisticRegression` pipeline |

The metadata selects Random Forest as its reported best model, while the prediction request defaults to Gradient Boosting unless a model is selected. Training data is small and the checked-in evaluation is not independent clinical validation; these outputs are for development/demo purposes only.

## Authentication and security notes

- Passwords are hashed with Werkzeug and API access uses signed JWTs.
- Backend routes apply role checks; ownership restrictions are implemented for clinical records and have targeted test coverage.
- Registration currently accepts a client-selected role, including administrator. This behavior was retained at the repository owner's direction; **do not expose registration to untrusted users or deploy this configuration publicly**.
- Set a unique `SECRET_KEY` before starting the API. There is no built-in production secret manager.
- Demo users are disabled unless `AAROGYA_DEFAULT_SEED_PASSWORD` is explicitly set. Set it only to a strong local development password; do not enable demo accounts in a deployed environment.
- Gmail integration requests broad Gmail API scopes. Review and minimize the Google OAuth scope configuration before enabling it for real accounts.
- Use synthetic data for development. The application is not documented or configured as a HIPAA-compliant or otherwise certified clinical system.

## API documentation

When the backend is running, FastAPI serves interactive OpenAPI documentation at:

- Swagger UI: `http://localhost:3000/docs`
- ReDoc: `http://localhost:3000/redoc`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Health check: `http://localhost:3000/api/health`

The API groups include authentication (`/api/auth`), patients and vitals (`/api/patients`), cases (`/api/cases`), predictions (`/api/predict`), AMR (`/api/amr-records`), ADR (`/api/adr`), analytics (`/api/analytics`), machine-learning metadata (`/api/ml`), stewardship/reports, AI, and official documents. See the router files in `backend/routers/` for exact paths, request schemas, and permissions.

## Repository structure

```text
.
├── backend/
│   ├── routers/             FastAPI route modules
│   ├── main.py              API app and router registration
│   ├── models.py            SQLAlchemy entities
│   ├── schemas.py            Pydantic request/response models
│   ├── config.py             Database and runtime configuration
│   ├── bootstrap_packages.py Portable Python dependency bootstrap
│   └── requirements.txt      Python dependencies
├── dataset/                  AMR surveillance CSV
├── ml/                       Training, inference, metadata, model pipelines
├── public/                   UI logo and background assets
├── scripts/test.mjs          Cross-platform test runner
├── src/                       React application
├── tests/                     Python API and authorization tests
├── .env.example               Safe local environment template
├── package.json               Node dependencies and commands
├── server.ts                  Express/Vite server and API proxy
└── vite.config.ts             Vite configuration
```

The SQLite database, local Firebase configuration, `.env` files, dependencies, caches, and build output are excluded from Git.

## Requirements

- Node.js 20.19+ or 22.12+.
- Python 3.10+ and `pip`.
- Network access on first backend startup to install the pinned Python dependencies.
- Optional: Gemini API access, Firebase Web App configuration and Google OAuth setup, and SMTP credentials for their corresponding integrations.

## Environment configuration

Copy `.env.example` to `.env` and set a unique `SECRET_KEY`. For example:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set the generated value as `SECRET_KEY` in `.env`. The API refuses to start without this value.

| Variable | Required | Purpose |
|---|---:|---|
| `SECRET_KEY` | Yes | Signs application JWTs. Generate a unique value; never commit it. |
| `GEMINI_API_KEY` | No | Enables Gemini calls from the AI assistant. |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Gmail sign-in only | Firebase Web App configuration used by the browser. Restrict the Firebase key in the provider console. |
| `DATABASE_URL` | No | SQLAlchemy database URL. Defaults to the local SQLite database. |
| `AAROGYA_DEFAULT_SEED_PASSWORD` | No | Enables local demo accounts when explicitly set; avoid outside development. |
| `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SENDER_EMAIL` | SMTP email only | Backend SMTP configuration. |
| `PORT`, `BACKEND_PORT` | No | Node server and FastAPI ports; defaults are 3000 and 5000. |
| `PYTHON` | No | Python executable to use when the default command is not available. |

`VITE_` variables are included in the browser build; they must never contain server secrets. Keep `.env` and any provider credentials out of version control.

## Local setup

1. Install Node.js and Python, then install JavaScript dependencies:

   ```sh
   npm install
   ```

2. Create and configure `.env`:

   ```sh
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env`. Generate and set `SECRET_KEY`; add optional integration settings only when needed.

3. Start the combined application:

   ```sh
   npm run dev
   ```

   The first backend startup installs Python packages into the operating system's temporary directory. The web application is available at `http://localhost:3000`.

### Run the backend directly

With the required environment variables available to the process:

```sh
python backend/bootstrap_packages.py
python backend/main.py
```

The API listens on port 5000 by default. Set `BACKEND_PORT` to change it. Requests from the frontend are normally proxied by the combined Express server.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Run the frontend development server and FastAPI backend together. |
| `npm run build` | Create the production frontend in `dist/`. |
| `npm run clean` | Remove generated frontend build output. |
| `npm start` | Start the Express/FastAPI server; set `NODE_ENV=production` to serve the built frontend. |
| `npm run lint` | Run the TypeScript compiler check, including unused local and parameter checks. |
| `npm run test:frontend` | Run the TypeScript/JavaScript unit tests. |
| `npm test` | Run frontend tests and all Python API tests using a temporary test database. |

## Testing and validation

`npm test` runs four frontend test files and four Python test modules covering cross-user access, dynamic model selection, role permissions, and AMR records. The test runner uses a temporary SQLite database and removes it when finished. It sets test-only seed credentials and a test JWT key; those values are not suitable for deployment.

Build and type-check independently with:

```sh
npm run build
npm run lint
```

The project has no separately configured browser end-to-end suite or automated external-service tests. Gemini, Gmail OAuth, SMTP, and official-document links require their respective external configuration and are not validated by the local unit/API tests.

## Deployment

No public deployment URL, container/deployment manifest, or production hosting configuration was supplied with this repository. A basic deployment must:

1. Install Node.js and Python dependencies.
2. Set `NODE_ENV=production`, `SECRET_KEY`, and any required integration/database variables in the hosting provider's secret configuration.
3. Run `npm run build`, then `npm start`.
4. Persist the database or configure a managed `DATABASE_URL`; do not rely on an ephemeral filesystem for SQLite.
5. Restrict network access, configure HTTPS, replace open self-registration/role assignment with trusted provisioning, and review clinical-data, privacy, audit, backup, OAuth, and jurisdictional requirements before any real-world use.

This is operational guidance, not evidence that the application is production-ready or compliant.

## Screenshots and demo

No application screenshots, demo video, or verified public demo URL were supplied. The images in `public/` are interface branding assets, not screenshots.

## Future work

No official product roadmap was supplied. Potential areas to evaluate include trusted administrator-managed role provisioning, independent clinical validation, database migrations, audit logging, and production deployment/security controls. These are suggestions, not committed project plans.

## Contributors and license

The existing GitHub repository is owned by [@daksh-mehra-12](https://github.com/daksh-mehra-12). No additional contributor list was supplied. No `LICENSE` file or license declaration is present; no license is asserted by this README.
