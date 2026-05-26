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


def admin_required(fn):
    """
    Сокращение для @role_required("admin").

    Используется для операций администрирования: управление пользователями,
    ролевыми группами, назначение глобальных ролей.
    """
    return role_required("admin")(fn)


def get_current_user_id():
    """Возвращает int id текущего пользователя из JWT."""
    from flask_jwt_extended import get_jwt_identity
    identity = get_jwt_identity()
    return int(identity) if identity is not None else None
