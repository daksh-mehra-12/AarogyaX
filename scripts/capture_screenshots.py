import os
import sys
import time
import json
import urllib.request
from playwright.sync_api import sync_playwright

def log(msg):
    print(msg, flush=True)

def capture_screenshots():
    screenshots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots"))
    os.makedirs(screenshots_dir, exist_ok=True)
    log(f"[+] Screenshots output directory: {screenshots_dir}")

    # Fetch token & user object via REST API
    req_data = json.dumps({"email": "consultant@test.com", "password": "password123"}).encode('utf-8')
    req = urllib.request.Request("http://localhost:5000/api/auth/login", data=req_data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            token = res_json['token']
            user_obj = res_json['user']
            log(f"[+] Successfully authenticated via API. User: {user_obj['name']} ({user_obj['role']})")
    except Exception as e:
        log(f"[ERROR] API authentication failed: {e}")
        return

    with sync_playwright() as p:
        log("[+] Launching Chromium browser (viewport: 1440x900)...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Login Page Screenshot
        log("[+] Navigating to http://localhost:5173/login...")
        page.goto("http://localhost:5173/login", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=os.path.join(screenshots_dir, "login.png"))
        log("[OK] Captured login.png")

        # Inject auth into localStorage
        log("[+] Injecting auth session tokens into localStorage...")
        user_str = json.dumps(user_obj)
        page.evaluate(f"window.localStorage.setItem('aarogya_token', '{token}')")
        page.evaluate(f"window.localStorage.setItem('aarogya_user', JSON.stringify({user_str}))")

        # Pages to capture
        pages_to_capture = [
            ("http://localhost:5173/dashboard", "dashboard.png"),
            ("http://localhost:5173/patients", "patient-management.png"),
            ("http://localhost:5173/patients/1", "patient-details.png"),
            ("http://localhost:5173/cases/new", "create-case.png"),
            ("http://localhost:5173/cases/1", "case-details.png"),
            ("http://localhost:5173/predict", "amr-prediction.png"),
            ("http://localhost:5173/adr", "adr-reporting.png"),
            ("http://localhost:5173/analytics", "analytics-dashboard.png"),
            ("http://localhost:5173/stewardship", "stewardship-dashboard.png"),
            ("http://localhost:5173/ai", "ai-assistant.png"),
            ("http://localhost:5173/reports", "reports.png"),
            ("http://localhost:5173/settings", "settings.png")
        ]

        for url, filename in pages_to_capture:
            try:
                log(f"[+] Capturing {filename} from {url}...")
                page.goto(url, wait_until="networkidle")
                time.sleep(1.5)
                page.screenshot(path=os.path.join(screenshots_dir, filename))
                log(f"[OK] Captured {filename}")
            except Exception as ex:
                log(f"[WARN] Error capturing {filename}: {ex}")

        # Trigger Prediction to capture prediction-result.png
        try:
            log("[+] Generating prediction for prediction-result.png...")
            page.goto("http://localhost:5173/predict", wait_until="networkidle")
            time.sleep(1)
            sub_btn = page.query_selector('button[type="submit"]')
            if sub_btn:
                sub_btn.click()
                time.sleep(2)
            page.screenshot(path=os.path.join(screenshots_dir, "prediction-result.png"))
            log("[OK] Captured prediction-result.png")
        except Exception as ex:
            log(f"[WARN] Error capturing prediction-result.png: {ex}")

        browser.close()
        log("[SUCCESS] All 14 UI screenshots captured and saved to docs/screenshots/")

if __name__ == "__main__":
    capture_screenshots()
