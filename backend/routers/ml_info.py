import os
import json
from fastapi import APIRouter, Depends, HTTPException
from models import User
from auth import require_role

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])

META_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml", "models_meta.json"))

@router.get("/info")
def get_ml_info(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin"))
):
    if os.path.exists(META_PATH):
        try:
            with open(META_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="Model metadata not found")

@router.get("/models")
def get_ml_models(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin"))
):
    if os.path.exists(META_PATH):
        try:
            with open(META_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                all_models = list(data.get("all_model_results", {}).values())
                return {
                    "selected_algorithm": data.get("selected_algorithm", "GradientBoosting"),
                    "models": all_models
                }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="Model metadata not found")
