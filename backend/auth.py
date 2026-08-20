import logging
from functools import wraps
from flask import request, jsonify
import jwt
from config import Config
from database import db
from models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('rbac')


def get_token_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    try:
        token = auth_header.split(' ')[1]
        data = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
        user_id = data.get('user_id')
        if not user_id:
            return None
        return db.session.get(User, user_id)
    except Exception:
        return None


def role_required(*allowed_roles):
    """
    Authorization decorator that verifies user authentication and checks
    user.role against allowed_roles. Returns 401 if unauthenticated,
    403 if unauthorized, and logs access denials.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_token_user()
            if not user:
                return jsonify({'error': 'Unauthorized: Authentication token missing or invalid'}), 401
            
            if user.role not in allowed_roles:
                logger.warning(
                    f"[RBAC DENIED] User: {user.email} | Role: {user.role} | "
                    f"Path: {request.path} | Method: {request.method}"
                )
                return jsonify({
                    'error': f"Forbidden: Access denied for role '{user.role}' on route {request.path}",
                    'role': user.role,
                    'required_roles': list(allowed_roles)
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
