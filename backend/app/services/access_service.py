"""
Сервис разграничения доступа на основе ролевых групп.

Центральное место всей новой модели прав. Здесь вычисляется, к каким
категориям каких типов сущностей у пользователя есть доступ и на каком
уровне (просмотр / редактирование).

Модель (кратко):
  - глобальная роль 'admin' даёт доступ к администрированию (управление
    пользователями, группами, ролями), но НЕ даёт автоматического доступа
    к сущностям — даже админу нужно состоять в группе;
  - пользователь состоит в произвольном числе групп, в каждой — роль
    'expert' (редактирование) или 'viewer' (просмотр);
  - группе открыт доступ к набору категорий (тип сущности + category_id,
    где NULL = «Без категории»);
  - эффективный доступ к категории = максимум по всем группам пользователя:
    если хотя бы в одной группе пользователь expert и группе открыта эта
    категория — он может редактировать; если только viewer — только смотреть.

Уровни доступа: "edit" > "view" > None.
"""

from app.database.db import db
from app.models import (
    User,
    UserGroupMembership,
    GroupCategoryAccess,
)
from app.models.group_category_access import (
    VALID_ENTITY_TYPES,
    ENTITY_DATASOURCE,
    ENTITY_WIDGET,
    ENTITY_DASHBOARD,
    ENTITY_KPI,
)
from app.models.user_group_membership import (
    GROUP_ROLE_EXPERT,
    GROUP_ROLE_VIEWER,
)


ACCESS_NONE = None
ACCESS_VIEW = "view"
ACCESS_EDIT = "edit"

# Порядок уровней для вычисления максимума
_LEVEL_RANK = {ACCESS_NONE: 0, ACCESS_VIEW: 1, ACCESS_EDIT: 2}


def _max_level(a, b):
    """Возвращает более сильный из двух уровней доступа."""
    return a if _LEVEL_RANK[a] >= _LEVEL_RANK[b] else b


def is_global_admin(user_or_roles):
    """
    Проверяет глобальную роль admin.

    Принимает либо объект User, либо список имён ролей (как в JWT-claims).
    """
    if user_or_roles is None:
        return False
    if isinstance(user_or_roles, User):
        return "admin" in user_or_roles.role_names
    # список/множество имён ролей
    return "admin" in set(user_or_roles)

# Строит карту эффективного доступа пользователя.
def build_access_map(user_id):
    access_map = {etype: {} for etype in VALID_ENTITY_TYPES}

    memberships = (
        db.session.query(UserGroupMembership)
        .filter(UserGroupMembership.user_id == user_id)
        .all()
    )
    if not memberships:
        return access_map

    role_by_group = {m.group_id: m.group_role for m in memberships}
    group_ids = list(role_by_group.keys())

    accesses = (
        db.session.query(GroupCategoryAccess)
        .filter(GroupCategoryAccess.group_id.in_(group_ids))
        .all()
    )

    for acc in accesses:
        group_role = role_by_group.get(acc.group_id)
        if group_role == GROUP_ROLE_EXPERT:
            level = ACCESS_EDIT
        elif group_role == GROUP_ROLE_VIEWER:
            level = ACCESS_VIEW
        else:
            continue

        if acc.entity_type not in access_map:
            continue

        cat_key = acc.category_id
        existing = access_map[acc.entity_type].get(cat_key, ACCESS_NONE)
        access_map[acc.entity_type][cat_key] = _max_level(existing, level)

    return access_map


def get_access_level(user_id, entity_type, category_id):
    """
    Уровень доступа пользователя к конкретной категории.

    Возвращает "edit", "view" или None.
    """
    access_map = build_access_map(user_id)
    return access_map.get(entity_type, {}).get(category_id, ACCESS_NONE)


def can_view_category(user_id, entity_type, category_id):
    return get_access_level(user_id, entity_type, category_id) in (
        ACCESS_VIEW,
        ACCESS_EDIT,
    )


def can_edit_category(user_id, entity_type, category_id):
    return get_access_level(user_id, entity_type, category_id) == ACCESS_EDIT


def viewable_category_ids(user_id, entity_type):
    """
    Множество category_id, которые пользователь может просматривать в данном
    типе сущности. Может содержать None (для «Без категории»).
    """
    access_map = build_access_map(user_id)
    return set(access_map.get(entity_type, {}).keys())


def editable_category_ids(user_id, entity_type):
    """Множество category_id, доступных пользователю на редактирование."""
    access_map = build_access_map(user_id)
    return {
        cat_id
        for cat_id, level in access_map.get(entity_type, {}).items()
        if level == ACCESS_EDIT
    }


def filter_query_by_access(query, model, user_id, entity_type):
    cat_ids = viewable_category_ids(user_id, entity_type)

    if not cat_ids:
        return query.filter(db.false())

    conditions = []
    real_ids = [c for c in cat_ids if c is not None]
    if real_ids:
        conditions.append(model.category_id.in_(real_ids))
    if None in cat_ids:
        conditions.append(model.category_id.is_(None))

    return query.filter(db.or_(*conditions))


# ---------------------------------------------------------------------------
# Готовые проверки для маршрутов (возвращают (ok, (json, code) | None))
# ---------------------------------------------------------------------------
def check_view(user_id, entity_type, category_id):
    """
    Проверяет право просмотра сущности данной категории.
    Возвращает None если можно, либо кортеж (payload, status) для ответа.
    """
    if can_view_category(user_id, entity_type, category_id):
        return None
    return ({"message": "Нет доступа к этой категории"}, 403)


def check_edit(user_id, entity_type, category_id):
    """
    Проверяет право редактирования сущности данной категории.
    Возвращает None если можно, либо кортеж (payload, status) для ответа.
    """
    if can_edit_category(user_id, entity_type, category_id):
        return None
    if can_view_category(user_id, entity_type, category_id):
        # Видит, но не редактирует — он зритель в группе
        return ({"message": "Только просмотр: нет прав на изменение в этой категории"}, 403)
    return ({"message": "Нет доступа к этой категории"}, 403)


# ---------------------------------------------------------------------------
# Косвенный доступ: датасет наследует категорию своего источника данных.
# Виджеты строятся на датасетах, метрики/измерения — на полях датасета.
# Поэтому доступ к ним определяется доступом к категории источника.
# ---------------------------------------------------------------------------
def check_dataset_view(user_id, dataset):
    """Доступ к датасету по категории его источника (просмотр)."""
    category_id = (
        dataset.datasource.category_id if dataset and dataset.datasource else None
    )
    return check_view(user_id, ENTITY_DATASOURCE, category_id)


def check_dataset_edit(user_id, dataset):
    """Доступ к датасету по категории его источника (редактирование)."""
    category_id = (
        dataset.datasource.category_id if dataset and dataset.datasource else None
    )
    return check_edit(user_id, ENTITY_DATASOURCE, category_id)


def _field_category(field):
    """Категория источника, к которому относится поле датасета."""
    if field is None:
        return None
    dataset = field.dataset
    if dataset is None or dataset.datasource is None:
        return None
    return dataset.datasource.category_id


def check_field_view(user_id, field):
    """Доступ к полю датасета (просмотр) по категории источника."""
    return check_view(user_id, ENTITY_DATASOURCE, _field_category(field))


def check_field_edit(user_id, field):
    """Доступ к полю датасета (редактирование) по категории источника."""
    return check_edit(user_id, ENTITY_DATASOURCE, _field_category(field))


__all__ = [
    "ACCESS_NONE", "ACCESS_VIEW", "ACCESS_EDIT",
    "ENTITY_DATASOURCE", "ENTITY_WIDGET", "ENTITY_DASHBOARD", "ENTITY_KPI",
    "is_global_admin",
    "build_access_map",
    "get_access_level",
    "can_view_category",
    "can_edit_category",
    "viewable_category_ids",
    "editable_category_ids",
    "filter_query_by_access",
    "check_view",
    "check_edit",
    "check_dataset_view",
    "check_dataset_edit",
    "check_field_view",
    "check_field_edit",
]
