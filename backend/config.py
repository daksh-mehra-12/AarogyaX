import os
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.environ.get('TEST_DB_PATH') or os.path.join(BASE_DIR, 'aarogya.db').replace('\\', '/')

raw_db_url = os.environ.get('DATABASE_URL', '')
if not raw_db_url or raw_db_url.startswith('sqlite:'):
    db_uri = f"sqlite:///{DEFAULT_DB_PATH}"
else:
    db_uri = raw_db_url

secret_key = os.environ.get('SECRET_KEY')
if not secret_key or secret_key.startswith('replace_with_'):
    raise RuntimeError(
        "Set SECRET_KEY in the environment or project .env before starting the backend."
    )

class Config:
    SECRET_KEY = secret_key
    SQLALCHEMY_DATABASE_URI = db_uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    SENDER_EMAIL = os.environ.get('SENDER_EMAIL', '')
