import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, 'aarogya.db').replace('\\', '/')

raw_db_url = os.environ.get('DATABASE_URL', '')
if not raw_db_url or raw_db_url.startswith('sqlite:'):
    db_uri = f"sqlite:///{DEFAULT_DB_PATH}"
else:
    db_uri = raw_db_url

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'aarogya_secret_key_dev_placeholder_32char')
    SQLALCHEMY_DATABASE_URI = db_uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    SENDER_EMAIL = os.environ.get('SENDER_EMAIL', '')

