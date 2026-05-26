"""
REST API для управления ролевыми группами (только глобальный admin).

Маршруты:
    GET    /api/role-groups                          — список групп
    POST   /api/role-groups                          — создать группу
    GET    /api/role-groups/<id>                      — детали группы (члены, доступы)
    PUT    /api/role-groups/<id>                      — переименовать / описание
    DELETE /api/role-groups/<id>                      — удалить группу

    Управление членством:
    POST   /api/role-groups/<id>/members             — добавить пользователя
    PUT    /api/role-groups/<id>/members/<user_id>   — сменить роль в группе
    DELETE /api/role-groups/<id>/members/<user_id>   — убрать пользователя

    Управление доступом к категориям:
    PUT    /api/role-groups/<id>/access              — задать список доступов
"""

from flask import Blueprint, request, jsonify

from app.database.db import db
from app.models import (
    User,
    RoleGroup,
    UserGroupMembership,
    GroupCategoryAccess,
    DataSourceCategory,
    WidgetCategory,
    DashboardCategory,
    KPICategory,
)
from app.models.user_group_membership import VALID_GROUP_ROLES
from app.models.group_category_access import (
    VALID_ENTITY_TYPES,
    ENTITY_DATASOURCE,
    ENTITY_WIDGET,
    ENTITY_DASHBOARD,
    ENTITY_KPI,
)
from app.auth.decorators import admin_required


role_group_bp = Blueprint(
    "role_groups",
    __name__,
    url_prefix="/api/role-groups",
)


# Сопоставление типа сущности и модели категории — для валидации category_id
_CATEGORY_MODEL = {
    ENTITY_DATASOURCE: DataSourceCategory,
    ENTITY_WIDGET: WidgetCategory,
    ENTITY_DASHBOARD: DashboardCategory,
    ENTITY_KPI: KPICategory,
}


# ---------------------------------------------------------------------------
# CRUD групп
# ---------------------------------------------------------------------------
@role_group_bp.route("", methods=["GET"])
@admin_required
def list_groups():
    items = db.session.query(RoleGroup).order_by(RoleGroup.name).all()
    return jsonify([g.to_dict() for g in items])


@role_group_bp.route("", methods=["POST"])
@admin_required
def create_group():
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "Поле 'name' обязательно"}), 400

    existing = db.session.query(RoleGroup).filter_by(name=name).first()
    if existing:
        return jsonify({"message": f"Группа '{name}' уже существует"}), 409

    group = RoleGroup(name=name, description=data.get("description"))
    db.session.add(group)
    db.session.commit()
    return jsonify(group.to_dict(include_details=True)), 201


@role_group_bp.route("/<int:group_id>", methods=["GET"])
@admin_required
def get_group(group_id):
    group = db.session.get(RoleGroup, group_id)
    if group is None:
        return jsonify({"message": "Группа не найдена"}), 404
    return jsonify(group.to_dict(include_details=True))


@role_group_bp.route("/<int:group_id>", methods=["PUT"])
@admin_required
def update_group(group_id):
    group = db.session.get(RoleGroup, group_id)
    if group is None:
        return jsonify({"message": "Группа не найдена"}), 404

    data = request.json or {}

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify({"message": "Имя не может быть пустым"}), 400
        clash = (
            db.session.query(RoleGroup)
            .filter(RoleGroup.name == name, RoleGroup.id != group_id)
            .first()
        )
        if clash:
            return jsonify({"message": f"Группа '{name}' уже существует"}), 409
        group.name = name

    if "description" in data:
        group.description = data["description"]

    db.session.commit()
    return jsonify(group.to_dict(include_details=True))


@role_group_bp.route("/<int:group_id>", methods=["DELETE"])
@admin_required
def delete_group(group_id):
    group = db.session.get(RoleGroup, group_id)
    if group is None:
        return jsonify({"message": "Группа не найдена"}), 404

    db.session.delete(group)
    db.session.commit()
    return jsonify({"message": "Группа удалена"})


# ---------------------------------------------------------------------------
# Членство
# ---------------------------------------------------------------------------
@role_group_bp.route("/<int:group_id>/members", methods=["POST"])
@admin_required
def add_member(group_id):
    """Body: {"user_id": 5, "group_role": "expert" | "viewer"}"""
    group = db.session.get(RoleGroup, group_id)
    if group is None:
        return jsonify({"message": "Группа не найдена"}), 404

    data = request.json or {}
    user_id = data.get("user_id")
    group_role = data.get("group_role", "viewer")

    if not user_id:
        return jsonify({"message": "Поле 'user_id' обязательно"}), 400
    if group_role not in VALID_GROUP_ROLES:
        return jsonify({
            "message": f"group_role должен быть одним из: {', '.join(VALID_GROUP_ROLES)}"
        }), 400

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Пользователь не найден"}), 404

    existing = (
        db.session.query(UserGroupMembership)
        .filter_by(user_id=user_id, group_id=group_id)
        .first()
    )
    if existing:
        return jsonify({"message": "Пользователь уже в группе"}), 409

    membership = UserGroupMembership(
        user_id=user_id,
        group_id=group_id,
        group_role=group_role,
    )
    db.session.add(membership)
    db.session.commit()
    return jsonify(group.to_dict(include_details=True)), 201


@role_group_bp.route("/<int:group_id>/members/<int:user_id>", methods=["PUT"])
@admin_required
def update_member_role(group_id, user_id):
    """Body: {"group_role": "expert" | "viewer"}"""
    membership = (
        db.session.query(UserGroupMembership)
        .filter_by(user_id=user_id, group_id=group_id)
        .first()
    )
    if membership is None:
        return jsonify({"message": "Пользователь не состоит в группе"}), 404

    data = request.json or {}
    group_role = data.get("group_role")
    if group_role not in VALID_GROUP_ROLES:
        return jsonify({
            "message": f"group_role должен быть одним из: {', '.join(VALID_GROUP_ROLES)}"
        }), 400

    membership.group_role = group_role
    db.session.commit()

    group = db.session.get(RoleGroup, group_id)
    return jsonify(group.to_dict(include_details=True))


@role_group_bp.route("/<int:group_id>/members/<int:user_id>", methods=["DELETE"])
@admin_required
def remove_member(group_id, user_id):
    membership = (
        db.session.query(UserGroupMembership)
        .filter_by(user_id=user_id, group_id=group_id)
        .first()
    )
    if membership is None:
        return jsonify({"message": "Пользователь не состоит в группе"}), 404

    db.session.delete(membership)
    db.session.commit()

    group = db.session.get(RoleGroup, group_id)
    return jsonify(group.to_dict(include_details=True))


# ---------------------------------------------------------------------------
# Доступ к категориям
# ---------------------------------------------------------------------------
def _validate_access_item(item):
    """
    Проверяет один элемент доступа.
    Возвращает (нормализованный_dict | None, ошибка | None).
    """
    entity_type = item.get("entity_type")
    if entity_type not in VALID_ENTITY_TYPES:
        return None, (
            f"entity_type должен быть одним из: {', '.join(VALID_ENTITY_TYPES)}"
        )

    category_id = item.get("category_id")  # допустим None («Без категории»)

    if category_id is not None:
        model = _CATEGORY_MODEL[entity_type]
        if db.session.get(model, category_id) is None:
            return None, (
                f"Категория id={category_id} типа '{entity_type}' не найдена"
            )

    return {"entity_type": entity_type, "category_id": category_id}, None


@role_group_bp.route("/<int:group_id>/access", methods=["PUT"])
@admin_required
def set_group_access(group_id):
    """
    Полностью заменяет список доступов группы к категориям.

    Body:
    {
      "access": [
        {"entity_type": "datasource", "category_id": 3},
        {"entity_type": "datasource", "category_id": null},   # «Без категории»
        {"entity_type": "widget",     "category_id": 1}
      ]
    }
    """
    group = db.session.get(RoleGroup, group_id)
    if group is None:
        return jsonify({"message": "Группа не найдена"}), 404

    data = request.json or {}
    access_list = data.get("access")
    if not isinstance(access_list, list):
        return jsonify({"message": "Поле 'access' должно быть списком"}), 400

    # Валидируем и дедуплицируем
    seen = set()
    normalized = []
    for item in access_list:
        norm, err = _validate_access_item(item or {})
        if err:
            return jsonify({"message": err}), 400
        key = (norm["entity_type"], norm["category_id"])
        if key in seen:
            continue
        seen.add(key)
        normalized.append(norm)

    # Заменяем доступы целиком
    for old in list(group.category_accesses):
        db.session.delete(old)
    db.session.flush()

    for norm in normalized:
        db.session.add(GroupCategoryAccess(
            group_id=group_id,
            entity_type=norm["entity_type"],
            category_id=norm["category_id"],
        ))

    db.session.commit()

    db.session.refresh(group)
    return jsonify(group.to_dict(include_details=True))
