from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from app.database.db import db
from app.models.user import User
from app.models.role import Role

import bcrypt

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data["username"]
    email = data["email"]
    password = data["password"]

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"message": "Пользователь с таким email уже существует"}), 400

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    viewer_role = Role.query.filter_by(name="viewer").first()

    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        roles=[viewer_role]
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Пользователь создан"})


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data["email"]
    password = data["password"]
    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"message": "Неверный email или пароль"}), 401

    if user.status == "blocked":
        return jsonify({"message": "Учётная запись заблокирована"}), 403

    valid = bcrypt.checkpw(
        password.encode("utf-8"),
        user.password_hash.encode("utf-8")
    )

    if not valid:
        return jsonify({"message": "Неверный email или пароль"}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "email": user.email,
            "roles": [role.name for role in user.roles]
        }
    )

    return jsonify({
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "roles": [role.name for role in user.roles],
            "groups": _serialize_user_groups(user),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    })


def _serialize_user_groups(user):
    """Сериализует группы пользователя с перечнем открытых ими категорий.

    Используется в эндпоинтах /login и /me, чтобы фронт получал единый
    формат: для каждой группы её роль внутри и список доступных категорий
    (нужно для отображения в профиле).
    """
    if not user:
        return []
    return [
        {
            "group_id": m.group_id,
            "group_name": m.group.name if m.group else None,
            "group_role": m.group_role,
            "categories": [
                a.to_dict() for a in (m.group.category_accesses or [])
            ] if m.group else [],
        }
        for m in user.group_memberships
    ]


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Также возвращаем username — для отображения в Header
    user = db.session.get(User, int(user_id))
    return jsonify({
        "id": user_id,
        "username": user.username if user else None,
        "email": claims["email"],
        "roles": claims["roles"],
        "groups": _serialize_user_groups(user),
        "created_at": user.created_at.isoformat() if user and user.created_at else None,
    })


@auth_bp.route("/me/access", methods=["GET"])
@jwt_required()
def my_access():
    """
    Карта эффективного доступа текущего пользователя — нужна фронту, чтобы
    решать, какие категории показывать и где разрешать редактирование.

    Формат:
    {
      "is_admin": true,
      "access": {
        "datasource": [{"category_id": 3, "level": "edit"},
                       {"category_id": null, "level": "view"}],
        "widget":     [...],
        "dashboard":  [...],
        "kpi":        [...]
      }
    }
    """
    from app.services.access_service import build_access_map, is_global_admin

    user_id = int(get_jwt_identity())
    claims = get_jwt()

    access_map = build_access_map(user_id)
    serialized = {
        etype: [
            {"category_id": cat_id, "level": level}
            for cat_id, level in cats.items()
        ]
        for etype, cats in access_map.items()
    }

    return jsonify({
        "is_admin": is_global_admin(claims.get("roles", [])),
        "access": serialized,
    })


@auth_bp.route("/me/password", methods=["PUT"])
@jwt_required()
def change_password():
    """Смена пароля текущим пользователем.
    Body: {"current_password": "...", "new_password": "..."}
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Пользователь не найден"}), 404

    data = request.json or {}
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({
            "message": "Укажите текущий и новый пароль"
        }), 400

    if len(new_password) < 6:
        return jsonify({
            "message": "Новый пароль должен содержать минимум 6 символов"
        }), 400

    valid = bcrypt.checkpw(
        current_password.encode("utf-8"),
        user.password_hash.encode("utf-8")
    )
    if not valid:
        return jsonify({"message": "Текущий пароль введён неверно"}), 401

    user.password_hash = bcrypt.hashpw(
        new_password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    db.session.commit()
    return jsonify({"message": "Пароль изменён"})


@auth_bp.route("/roles", methods=["GET"])
@jwt_required()
def list_roles():
    """Список всех ролей — нужен на странице управления пользователями."""
    items = db.session.query(Role).order_by(Role.name).all()
    return jsonify([
        {"id": r.id, "name": r.name, "description": r.description}
        for r in items
    ])
