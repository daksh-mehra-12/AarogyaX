import os
import sys
from contextlib import asynccontextmanager

# Ensure clean /tmp/aarogya_python_packages, backend, and root directory are in python sys.path
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
for p in (PROJECT_ROOT, BASE_DIR):
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

from bootstrap_packages import ensure_packages
ensure_packages()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models
from seed_rbac import seed_rbac_users

from routers.auth import router as auth_router
from routers.patients import router as patients_router
from routers.cases import router as cases_router
from routers.predict import router as predict_router
from routers.adr import router as adr_router
from routers.analytics import router as analytics_router
from routers.stewardship import router as stewardship_router
from routers.ml_info import router as ml_info_router
from routers.ai import router as ai_router
from routers.official_docs import router as official_docs_router
from routers.health import router as health_router
from routers.amr import router as amr_router

Base.metadata.create_all(bind=engine)
seed_rbac_users()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist without altering existing data
    Base.metadata.create_all(bind=engine)
    seed_rbac_users()
    yield

app = FastAPI(
    title="Aarogya X — Health AI System API",
    description="FastAPI Backend for Antimicrobial Resistance Prediction, Clinical Decision Support, and Pharmacovigilance Surveillance.",
    version="3.6.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all FastAPI routers
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(cases_router)
app.include_router(predict_router)
app.include_router(amr_router)
app.include_router(adr_router)
app.include_router(analytics_router)
app.include_router(stewardship_router)
app.include_router(ml_info_router)
app.include_router(ai_router)
app.include_router(official_docs_router)
app.include_router(health_router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("BACKEND_PORT", os.environ.get("PORT", 5000)))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)

