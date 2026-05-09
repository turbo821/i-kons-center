from functools import wraps

from flask_jwt_extended import verify_jwt_in_request
from flask_jwt_extended import get_jwt

from flask import jsonify


def role_required(*role_names):
    """
    Декоратор: пускает пользователя, если у него есть ХОТЯ БЫ ОДНА
    из перечисленных ролей.

    Примеры использования:
        @role_required("admin")
        @role_required("admin", "expert")
    """

    def wrapper(fn):

        @wraps(fn)
        def decorator(*args, **kwargs):

            verify_jwt_in_request()

            claims = get_jwt()
            user_roles = set(claims.get("roles", []))

            allowed = set(role_names)

            if not (user_roles & allowed):
                return jsonify({
                    "message": "Forbidden"
                }), 403

            return fn(*args, **kwargs)

        return decorator

    return wrapper
