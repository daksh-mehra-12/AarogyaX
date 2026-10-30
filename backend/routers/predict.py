import os
import sys
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from database import get_db
from models import User, Case, Prediction
from schemas import PredictRequest
from auth import require_role
from ml.predict import predict_amr

router = APIRouter(prefix="/api/predict", tags=["AMR Prediction"])

@router.post("")
def predict(
    data: PredictRequest,
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    req_dict = data.model_dump()
    case_id = data.caseId

    res = predict_amr(req_dict)
    if "error" in res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["error"]
        )

    if case_id:
        case_obj = db.get(Case, case_id)
        if not case_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        # Strict Per-User Authorization (Phase 6)
        if case_obj.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You cannot attach predictions to another user's case."
            )

        # Remove existing prediction for this case if any
        db.query(Prediction).filter(Prediction.case_id == case_id).delete()

        prediction = Prediction(
            case_id=int(case_id),
            resistance_probability=res["resistanceProbability"],
            recommended_drug=res["recommendedDrug"],
            alternative_drugs=",".join(res["alternativeDrugs"]),
            resistance_risk=res["resistanceRisk"],
            confidence=res["confidence"],
            rationale=res["rationale"],
            dosage=res["dosage"]
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)

        return {
            "prediction": prediction.to_dict(),
            "message": "AMR prediction completed successfully"
        }
    else:
        return {
            "prediction": res,
            "message": "AMR prediction completed successfully"
        }
