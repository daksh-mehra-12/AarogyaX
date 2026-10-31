import os
import sys
from werkzeug.security import generate_password_hash

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database import SessionLocal
from models import User

DEFAULT_PASSWORD = os.environ.get("AAROGYA_DEFAULT_SEED_PASSWORD")

SEED_USERS = [
    {
        "name": "Dr. Alex Intern",
        "email": "intern@test.com",
        "password": DEFAULT_PASSWORD,
        "role": "intern"
    },
    {
        "name": "Dr. Sarah Junior",
        "email": "jr@test.com",
        "password": DEFAULT_PASSWORD,
        "role": "junior"
    },
    {
        "name": "Dr. Rajesh Consultant",
        "email": "consultant@test.com",
        "password": DEFAULT_PASSWORD,
        "role": "consultant"
    },
    {
        "name": "System Administrator",
        "email": "admin@test.com",
        "password": DEFAULT_PASSWORD,
        "role": "admin"
    }
]

def seed_rbac_users():
    if not DEFAULT_PASSWORD:
        print(
            "[RBAC] Demo accounts were not seeded; set AAROGYA_DEFAULT_SEED_PASSWORD "
            "to enable them in a local development environment.",
            flush=True,
        )
        return

    db = SessionLocal()
    try:
        for user_data in SEED_USERS:
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing:
                hashed_pw = generate_password_hash(user_data["password"])
                user = User(
                    name=user_data["name"],
                    email=user_data["email"],
                    password=hashed_pw,
                    role=user_data["role"]
                )
                db.add(user)
                print(f"[+] Seeded RBAC user: {user_data['email']} ({user_data['role']})")
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    seed_rbac_users()
