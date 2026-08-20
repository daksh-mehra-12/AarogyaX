import os
from flask import Flask
from flask_cors import CORS
from config import Config
from database import db
import models  # Ensures all SQLAlchemy models are registered before db.create_all()
from routes import routes
from seed_rbac import seed_rbac_users

app = Flask(__name__)
app.config.from_object(Config)

CORS(app)
db.init_app(app)
app.register_blueprint(routes)

def init_db():
    with app.app_context():
        db.create_all()
        seed_rbac_users()

init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
