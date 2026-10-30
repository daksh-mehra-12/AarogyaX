from collections import Counter, defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, Patient, Case, Prediction, ADRReport, AmrRecord, AmrSusceptibility
from auth import require_role
from ml.predict import _EMPIRICAL_RECORDS

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/dashboard")
def dashboard_stats(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    patient_count = db.query(Patient).filter(Patient.created_by == current_user.id).count()
    case_count = db.query(Case).filter(Case.created_by == current_user.id).count()
    adr_count = db.query(ADRReport).filter(ADRReport.created_by == current_user.id).count()

    active_cases_count = db.query(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["open", "in_progress", "in-progress"])
    ).count()

    resolved_cases_count = db.query(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["closed", "resolved"])
    ).count()

    high_risk_cases_count = db.query(Case).join(Prediction).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["open", "in_progress", "in-progress"]),
        Prediction.resistance_risk.in_(["high", "critical"])
    ).distinct().count()

    avg_resistance_prob = db.query(func.avg(Prediction.resistance_probability)).join(Case).filter(
        Case.created_by == current_user.id,
        Case.status.in_(["open", "in_progress", "in-progress"])
    ).scalar()

    if avg_resistance_prob is not None:
        resistance_rate = float(avg_resistance_prob)
    elif active_cases_count > 0:
        resistance_rate = (high_risk_cases_count / active_cases_count)
    else:
        resistance_rate = 0.0

    # Compute topInfectionTypes from real user cases & AMR records
    inf_counter: Counter = Counter()
    user_cases = db.query(Case.infection_type).filter(Case.created_by == current_user.id).all()
    for (inf_type,) in user_cases:
        if inf_type:
            inf_counter[str(inf_type).strip()] += 1

    user_amr = db.query(AmrRecord.specimen_type).filter(AmrRecord.created_by == current_user.id).all()
    for (spec_type,) in user_amr:
        if spec_type:
            inf_counter[str(spec_type).strip()] += 1

    top_infection_types = [
        {"type": k, "count": v}
        for k, v in inf_counter.most_common(5)
    ]

    return {
        "totalPatients": patient_count,
        "totalCases": case_count,
        "activeCases": active_cases_count,
        "resolvedCases": resolved_cases_count,
        "highRiskCases": high_risk_cases_count,
        "highRiskRatio": round(resistance_rate * 100, 1),
        "resistanceRate": round(resistance_rate, 3),
        "pendingAdrReports": adr_count,
        "topInfectionTypes": top_infection_types,
    }


@router.get("/recent-activity")
def recent_activity(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    cases = db.query(Case).filter(
        Case.created_by == current_user.id
    ).order_by(Case.created_at.desc()).limit(6).all()

    activity = []
    for c in cases:
        activity.append({
            "id": str(c.id),
            "description": f"Case #{c.case_number} created for {c.infection_type.upper()}",
            "timestamp": c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else "",
            "type": "case"
        })

    amr_recs = db.query(AmrRecord).filter(
        AmrRecord.created_by == current_user.id
    ).order_by(AmrRecord.created_at.desc()).limit(4).all()

    for r in amr_recs:
        activity.append({
            "id": f"amr-{r.id}",
            "description": f"AMR Record #{r.record_id} logged for {r.organism} ({r.specimen_type})",
            "timestamp": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            "type": "amr"
        })

    adrs = db.query(ADRReport).filter(
        ADRReport.created_by == current_user.id
    ).order_by(ADRReport.created_at.desc()).limit(3).all()

    for a in adrs:
        activity.append({
            "id": f"adr-{a.id}",
            "description": f"ADR #{a.report_number} reported for {a.drug_name}",
            "timestamp": a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else "",
            "type": "adr"
        })

    activity.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"activity": activity[:8]}


@router.get("/resistance-trends")
def resistance_trends(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    """
    Aggregates resistance risk distribution from real SQLite Prediction and AmrRecord rows,
    combined with the clinical surveillance dataset profile grouped across the 3 anatomical
    infection cohorts and logged case months.
    """
    month_buckets = defaultdict(lambda: {"highRisk": 0, "mediumRisk": 0, "lowRisk": 0})

    # 1. Include all clinical Case Predictions in SQLite
    case_preds = (
        db.query(Case.created_at, Prediction.resistance_risk)
        .join(Prediction, Prediction.case_id == Case.id)
        .all()
    )
    for created_at, risk in case_preds:
        m_label = created_at.strftime("%b %Y") if isinstance(created_at, datetime) else "Current"
        r = (risk or "medium").lower()
        if r in ("high", "critical"):
            month_buckets[m_label]["highRisk"] += 1
        elif r == "medium":
            month_buckets[m_label]["mediumRisk"] += 1
        else:
            month_buckets[m_label]["lowRisk"] += 1

    # 2. Include all AMR Laboratory Records in SQLite
    amr_rows = db.query(AmrRecord.collection_date, AmrRecord.predicted_risk).all()
    for coll_date, risk in amr_rows:
        m_label = "Current"
        if coll_date:
            try:
                dt = datetime.strptime(str(coll_date)[:10], "%Y-%m-%d")
                m_label = dt.strftime("%b %Y")
            except Exception:
                m_label = str(coll_date)[:7]
        r = (risk or "medium").lower()
        if r in ("high", "critical"):
            month_buckets[m_label]["highRisk"] += 1
        elif r == "medium":
            month_buckets[m_label]["mediumRisk"] += 1
        else:
            month_buckets[m_label]["lowRisk"] += 1

    # 3. Also include the empirical clinical dataset distribution by infection cohort
    # so clinicians can compare dataset surveillance baselines with active hospital logs
    cohort_buckets = defaultdict(lambda: {"highRisk": 0, "mediumRisk": 0, "lowRisk": 0})
    cohort_labels = {
        "UTI": "Dataset: UTI",
        "bloodstream infections": "Dataset: Bloodstream",
        "Ventilator-Associated Pneumonia": "Dataset: VAP / Resp",
    }
    for rec in _EMPIRICAL_RECORDS:
        c_name = cohort_labels.get(rec["infection"], f"Dataset: {rec['infection']}")
        res_pct = float(rec["resistance"])
        if res_pct >= 60.0:
            cohort_buckets[c_name]["highRisk"] += 1
        elif res_pct >= 30.0:
            cohort_buckets[c_name]["mediumRisk"] += 1
        else:
            cohort_buckets[c_name]["lowRisk"] += 1

    trends = []
    for cohort_key in ["Dataset: UTI", "Dataset: Bloodstream", "Dataset: VAP / Resp"]:
        if cohort_key in cohort_buckets:
            trends.append({
                "month": cohort_key,
                **cohort_buckets[cohort_key]
            })

    for m_label, counts in month_buckets.items():
        trends.append({
            "month": f"Hospital ({m_label})",
            **counts
        })

    return {"trends": trends}


@router.get("/drug-usage")
def drug_usage(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    """
    Computes top recommended / tested antimicrobials from real SQLite Predictions,
    AMR Laboratory Records, and the clinical AMR surveillance dataset.
    """
    drug_counter: Counter = Counter()

    # Count drugs from clinical case predictions
    for (drug,) in db.query(Prediction.recommended_drug).all():
        if drug:
            drug_counter[str(drug).strip()] += 1

    # Count drugs from AMR lab records & susceptibility panels
    for (drug,) in db.query(AmrRecord.recommended_drug).all():
        if drug:
            drug_counter[str(drug).strip()] += 1

    for (abx, susc) in db.query(AmrSusceptibility.antibiotic, AmrSusceptibility.susceptibility).all():
        if abx and susc and str(susc).lower().startswith("s"):
            drug_counter[str(abx).strip()] += 1

    # Include empirical dataset susceptible isolate count (>=50% sensitivity) per antibiotic
    for rec in _EMPIRICAL_RECORDS:
        if float(rec["sensitivity"]) >= 50.0:
            drug_counter[rec["antibiotic"]] += 1

    top_drugs = [
        {"name": name, "count": count}
        for name, count in drug_counter.most_common(6)
    ]

    return {"drugs": top_drugs}


@router.get("/organism-frequency")
def organism_frequency(
    current_user: User = Depends(require_role("intern", "junior", "consultant", "admin")),
    db: Session = Depends(get_db)
):
    """
    Computes pathogen isolate frequency from real SQLite Cases, AMR Laboratory Records,
    and the clinical AMR surveillance dataset.
    """
    org_counter: Counter = Counter()

    for (org,) in db.query(Case.organism).all():
        if org and str(org).strip():
            org_counter[str(org).strip()] += 1

    for (org,) in db.query(AmrRecord.organism).all():
        if org and str(org).strip():
            org_counter[str(org).strip()] += 1

    for rec in _EMPIRICAL_RECORDS:
        org_counter[rec["organism"]] += 1

    top_organisms = [
        {"name": name, "count": count}
        for name, count in org_counter.most_common(6)
    ]

    return {"organisms": top_organisms}

