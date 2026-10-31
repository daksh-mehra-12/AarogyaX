import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone

from database import get_db

router = APIRouter(tags=["Health"])

@router.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1")).scalar()
    except Exception as e:
        db_status = f"error: {str(e)}"

    ml_meta_exists = os.path.exists(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml", "models_meta.json"))
    )

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "Aarogya X FastAPI Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "mlEngine": "loaded" if ml_meta_exists else "unavailable",
        "framework": "FastAPI",
        "version": "3.6.0"
    }
