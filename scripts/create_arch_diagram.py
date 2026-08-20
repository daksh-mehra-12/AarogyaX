import os
from PIL import Image, ImageDraw, ImageFont

def draw_architecture_diagram():
    width, height = 1600, 1150
    img = Image.new('RGB', (width, height), color='#0F172A')
    draw = ImageDraw.Draw(img)

    try:
        title_font = ImageFont.truetype("arial.ttf", 36)
        heading_font = ImageFont.truetype("arial.ttf", 22)
        sub_font = ImageFont.truetype("arial.ttf", 16)
        small_font = ImageFont.truetype("arial.ttf", 14)
    except:
        title_font = ImageFont.load_default()
        heading_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    CARD_BG = '#1E293B'
    BORDER_COLOR = '#334155'
    ACCENT_BLUE = '#38BDF8'
    ACCENT_TEAL = '#2DD4BF'
    ACCENT_INDIGO = '#818CF8'
    ACCENT_EMERALD = '#34D399'
    ACCENT_AMBER = '#FBBF24'
    TEXT_MAIN = '#F8FAFC'
    TEXT_MUTED = '#94A3B8'

    draw.text((60, 40), "Aarogya X — System Architecture & Data Flow", fill=ACCENT_BLUE, font=title_font)
    draw.text((60, 85), "AI-Powered Antimicrobial Resistance Decision Support System", fill=TEXT_MUTED, font=sub_font)

    draw.rectangle([60, 130, 1540, 300], fill=CARD_BG, outline='#0EA5E9', width=2)
    draw.text((80, 145), "FRONTEND LAYER — React 19 + Vite + TypeScript + Tailwind CSS", fill=ACCENT_BLUE, font=heading_font)
    
    frontend_modules = [
        "Patient Management", "Infection Case Tracker", "AMR Risk Predictor",
        "ADR Monitoring", "Stewardship Console", "Analytics Dashboard",
        "AI Clinical Assistant", "PDF Report Generator"
    ]
    for i, mod in enumerate(frontend_modules):
        col = i % 4
        row = i // 4
        x = 80 + col * 355
        y = 190 + row * 45
        draw.rectangle([x, y, x + 340, y + 38], fill='#090D16', outline='#1E293B', width=1)
        draw.text((x + 15, y + 10), mod, fill=TEXT_MAIN, font=sub_font)

    draw.line([(800, 300), (800, 350)], fill=ACCENT_BLUE, width=4)
    draw.polygon([(790, 350), (810, 350), (800, 365)], fill=ACCENT_BLUE)
    draw.text((815, 320), "HTTPS / REST API (JSON Payload & JWT Auth)", fill=ACCENT_TEAL, font=small_font)

    draw.rectangle([60, 365, 1540, 680], fill=CARD_BG, outline='#6366F1', width=2)
    draw.text((80, 380), "BACKEND LAYER — Flask 3.0 REST API Gateway & Core Services", fill=ACCENT_INDIGO, font=heading_font)

    draw.rectangle([80, 420, 520, 650], fill='#090D16', outline=BORDER_COLOR, width=1)
    draw.text((95, 435), "Authentication & RBAC Middleware", fill=ACCENT_AMBER, font=sub_font)
    draw.text((95, 470), "• JWT Token Verification (HS256)", fill=TEXT_MUTED, font=small_font)
    draw.text((95, 495), "• Werkzeug Password Hashing", fill=TEXT_MUTED, font=small_font)
    draw.text((95, 520), "• Role Enforcer: Admin | Consultant", fill=TEXT_MUTED, font=small_font)
    draw.text((95, 545), "  Junior Doctor | Medical Intern", fill=TEXT_MUTED, font=small_font)
    draw.text((95, 570), "• Endpoint Scope Validation", fill=TEXT_MUTED, font=small_font)

    draw.rectangle([540, 420, 1060, 650], fill='#090D16', outline=BORDER_COLOR, width=1)
    draw.text((555, 435), "Core Business Logic & API Controllers", fill=ACCENT_TEAL, font=sub_font)
    draw.text((555, 470), "• /api/patients — CRUD & Profile Management", fill=TEXT_MUTED, font=small_font)
    draw.text((555, 495), "• /api/cases — Infection & Culture Registry", fill=TEXT_MUTED, font=small_font)
    draw.text((555, 520), "• /api/adr — Adverse Reaction Reporting", fill=TEXT_MUTED, font=small_font)
    draw.text((555, 545), "• /api/stewardship — Hospital Guidelines", fill=TEXT_MUTED, font=small_font)
    draw.text((555, 570), "• /api/analytics — AMR Trends & Metrics", fill=TEXT_MUTED, font=small_font)
    draw.text((555, 595), "• /api/reports — Departmental Exporting", fill=TEXT_MUTED, font=small_font)

    draw.rectangle([1080, 420, 1520, 650], fill='#090D16', outline=BORDER_COLOR, width=1)
    draw.text((1095, 435), "ML Prediction Engine (ml/predict.py)", fill=ACCENT_EMERALD, font=sub_font)
    draw.text((1095, 470), "• Dynamic Model Selector Interface", fill=TEXT_MUTED, font=small_font)
    draw.text((1095, 495), "• Feature Encoding & Imputation Pipeline", fill=TEXT_MUTED, font=small_font)
    draw.text((1095, 520), "• Risk Score & Probability Computation", fill=TEXT_MUTED, font=small_font)
    draw.text((1095, 545), "• Rule-Based Dosage Recommendation", fill=TEXT_MUTED, font=small_font)
    draw.text((1095, 570), "• Clinical Rationale Synthesis", fill=TEXT_MUTED, font=small_font)

    draw.line([(800, 680), (800, 740)], fill=ACCENT_TEAL, width=4)
    draw.polygon([(790, 740), (810, 740), (800, 755)], fill=ACCENT_TEAL)
    draw.text((630, 705), "SQLAlchemy ORM", fill=ACCENT_TEAL, font=small_font)

    draw.line([(1300, 680), (1300, 740)], fill=ACCENT_EMERALD, width=4)
    draw.polygon([(1290, 740), (1310, 740), (1300, 755)], fill=ACCENT_EMERALD)
    draw.text((1315, 705), "Joblib Model Deserialization", fill=ACCENT_EMERALD, font=small_font)

    draw.rectangle([60, 755, 950, 1080], fill=CARD_BG, outline='#10B981', width=2)
    draw.text((80, 770), "PERSISTENCE LAYER — SQLite Database (aarogya.db)", fill=ACCENT_EMERALD, font=heading_font)
    
    tables = [
        ("users", "id, name, email, password, role, created_at"),
        ("patients", "id, patient_id, name, age, gender, weight, region, comorbidities"),
        ("cases", "id, case_number, patient_id, infection_type, severity, icu, organism"),
        ("predictions", "id, case_id, resistance_probability, recommended_drug, risk"),
        ("adr_reports", "id, report_number, case_id, patient_id, drug_name, reaction")
    ]
    for i, (tbl, cols) in enumerate(tables):
        y = 810 + i * 50
        draw.rectangle([80, y, 930, y + 42], fill='#090D16', outline=BORDER_COLOR, width=1)
        draw.text((95, y + 10), f"TABLE: {tbl}", fill=ACCENT_BLUE, font=sub_font)
        draw.text((280, y + 12), f"Columns: {cols}", fill=TEXT_MUTED, font=small_font)

    draw.rectangle([970, 755, 1260, 1080], fill=CARD_BG, outline='#F59E0B', width=2)
    draw.text((985, 770), "TRAINED ML MODELS", fill=ACCENT_AMBER, font=heading_font)
    
    ml_artifacts = [
        "random_forest.pkl (97.2%)",
        "gradient_boosting.pkl (100.0%)",
        "decision_tree.pkl (100.0%)",
        "logistic_regression.pkl (88.9%)",
        "models_meta.json",
        "Dataset (CSV Organism Mapping)"
    ]
    for i, item in enumerate(ml_artifacts):
        y = 815 + i * 42
        draw.rectangle([985, y, 1245, y + 34], fill='#090D16', outline=BORDER_COLOR, width=1)
        draw.text((995, y + 8), item, fill=TEXT_MAIN, font=small_font)

    draw.rectangle([1280, 755, 1540, 1080], fill=CARD_BG, outline='#EC4899', width=2)
    draw.text((1295, 770), "EXTERNAL SERVICES", fill='#F472B6', font=heading_font)

    services = [
        ("Gemini AI API", "Clinical Q&A LLM Assistant"),
        ("SMTP Service", "Gmail TLS Email Dispatcher"),
        ("ReportLab", "Dynamic PDF Generation")
    ]
    for i, (s_title, s_desc) in enumerate(services):
        y = 815 + i * 85
        draw.rectangle([1295, y, 1525, y + 72], fill='#090D16', outline=BORDER_COLOR, width=1)
        draw.text((1305, y + 12), s_title, fill=ACCENT_BLUE, font=sub_font)
        draw.text((1305, y + 40), s_desc, fill=TEXT_MUTED, font=small_font)

    draw.text((60, 1100), "Aarogya X — Decision Support Software (Academic & Portfolio Prototype)", fill=TEXT_MUTED, font=small_font)

    docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))
    os.makedirs(docs_dir, exist_ok=True)
    out_path = os.path.join(docs_dir, "architecture.png")
    img.save(out_path, quality=95)
    print(f"[+] Architecture diagram saved successfully to: {out_path}")

if __name__ == "__main__":
    draw_architecture_diagram()
