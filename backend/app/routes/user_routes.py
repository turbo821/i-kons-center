"""
REST API для управления пользователями (только admin).

Маршруты:
    GET    /api/users                  — список всех
    GET    /api/users/<id>             — детали
    PUT    /api/users/<id>/roles       — изменить роли
    PUT    /api/users/<id>/status      — активировать/деактивировать
    DELETE /api/users/<id>             — удалить
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database.db import db
from app.models import User, Role
from app.auth.decorators import role_required


user_bp = Blueprint("users", __name__, url_prefix="/api/users")


@user_bp.route("", methods=["GET"])
@role_required("admin")
def list_users():
    items = db.session.query(User).order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in items])


@user_bp.route("/<int:user_id>", methods=["GET"])
@role_required("admin")
def get_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Пользователь не найден"}), 404
    return jsonify(user.to_dict())


@user_bp.route("/<int:user_id>/roles", methods=["PUT"])
@role_required("admin")
def update_user_roles(user_id):
    """
    Body: {"role_names": ["admin", "expert"]}
    """
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Пользователь не найден"}), 404

    # Защита: admin не может снять с себя роль admin (иначе потеряет доступ)
    current_user_id = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({
            "message": "Нельзя изменить роли самому себе"
        }), 400

    data = request.json or {}
    role_names = data.get("role_names")
    if not isinstance(role_names, list):
        return jsonify({"message": "role_names должен быть списком"}), 400

    roles = db.session.query(Role).filter(Role.name.in_(role_names)).all()
    found_names = {r.name for r in roles}
    missing = set(role_names) - found_names
    if missing:
        return jsonify({
            "message": f"Роли не найдены: {', '.join(missing)}"
        }), 400

    if not roles:
        return jsonify({
            "message": "У пользователя должна быть хотя бы одна роль"
        }), 400

    user.roles = roles
    db.session.commit()

    return jsonify(user.to_dict())


@user_bp.route("/<int:user_id>/status", methods=["PUT"])
@role_required("admin")
def update_user_status(user_id):
    """Body: {"status": "active" | "blocked"}"""
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Пользователь не найден"}), 404

    current_user_id = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({
            "message": "Нельзя изменить свой статус"
        }), 400

    data = request.json or {}
    new_status = data.get("status")
    if new_status not in ("active", "blocked"):
        return jsonify({
            "message": "Статус должен быть 'active' или 'blocked'"
        }), 400

    user.status = new_status
    db.session.commit()

    return jsonify(user.to_dict())


@user_bp.route("/<int:user_id>", methods=["DELETE"])
@role_required("admin")
def delete_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Пользователь не найден"}), 404

    current_user_id = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"message": "Нельзя удалить самого себя"}), 400

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Удалено"})
