"""
Системная статистика и глобальный поиск.

Все выборки фильтруются по эффективному доступу пользователя: счётчики на
главной и результаты глобального поиска показывают только те сущности,
которые пользователю реально доступны (через ролевые группы). Это
исключает «протекание» названий и количеств недоступных сущностей.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from app.database.db import db
from app.models import (
    User,
    DataSource,
    Dataset,
    Widget,
    Dashboard,
    KPI,
)
from app.auth.decorators import get_current_user_id
from app.services import access_service as access
from app.services.access_service import (
    ENTITY_DATASOURCE,
    ENTITY_WIDGET,
    ENTITY_DASHBOARD,
    ENTITY_KPI,
    is_global_admin,
)
from flask_jwt_extended import get_jwt


stats_bp = Blueprint("stats", __name__, url_prefix="/api/stats")


def _accessible_datasource_filter(user_id):
    """Список условий для выборки доступных источников; None если доступа нет."""
    viewable = access.viewable_category_ids(user_id, ENTITY_DATASOURCE)
    if not viewable:
        return None
    conds = []
    real = [c for c in viewable if c is not None]
    if real:
        conds.append(DataSource.category_id.in_(real))
    if None in viewable:
        conds.append(DataSource.category_id.is_(None))
    return conds


@stats_bp.route("/overview", methods=["GET"])
@jwt_required()
def system_overview():
    """Счётчики доступных сущностей и последние доступные дашборды."""
    user_id = get_current_user_id()
    claims = get_jwt()

    # Счётчики считаем по отфильтрованным запросам
    ds_q = access.filter_query_by_access(
        db.session.query(DataSource), DataSource, user_id, ENTITY_DATASOURCE
    )
    w_q = access.filter_query_by_access(
        db.session.query(Widget), Widget, user_id, ENTITY_WIDGET
    )
    d_q = access.filter_query_by_access(
        db.session.query(Dashboard), Dashboard, user_id, ENTITY_DASHBOARD
    )
    k_q = access.filter_query_by_access(
        db.session.query(KPI), KPI, user_id, ENTITY_KPI
    )

    # Датасеты — через категорию источника
    ds_conds = _accessible_datasource_filter(user_id)
    if ds_conds is None:
        datasets_count = 0
    else:
        datasets_count = (
            db.session.query(Dataset)
            .join(DataSource, Dataset.datasource_id == DataSource.id)
            .filter(or_(*ds_conds))
            .count()
        )

    counts = {
        "datasources": ds_q.count(),
        "datasets": datasets_count,
        "widgets": w_q.count(),
        "dashboards": d_q.count(),
        "kpis": k_q.count(),
    }
    # Счётчик пользователей — только для администратора
    if is_global_admin(claims.get("roles", [])):
        counts["users"] = db.session.query(User).count()

    recent_dashboards = (
        d_q.order_by(Dashboard.is_pinned.desc(), Dashboard.created_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        "counts": counts,
        "recent_dashboards": [d.to_dict() for d in recent_dashboards],
    })


@stats_bp.route("/search", methods=["GET"])
@jwt_required()
def global_search():
    """
    Глобальный поиск по доступным пользователю сущностям.
    Query: ?q=строка. Возвращает топ-5 совпадений в каждой категории.
    """
    user_id = get_current_user_id()

    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"results": []})

    pattern = f"%{q}%"
    limit = 5
    results = []

    # Дашборды (только доступные)
    d_base = access.filter_query_by_access(
        db.session.query(Dashboard), Dashboard, user_id, ENTITY_DASHBOARD
    )
    dashboards = (
        d_base.filter(
            or_(Dashboard.name.ilike(pattern), Dashboard.description.ilike(pattern))
        )
        .limit(limit)
        .all()
    )
    for d in dashboards:
        results.append({
            "kind": "dashboard",
            "id": d.id,
            "title": d.name,
            "subtitle": d.description or "",
            "url": f"/dashboards/{d.id}",
        })

    # Виджеты (только доступные)
    w_base = access.filter_query_by_access(
        db.session.query(Widget), Widget, user_id, ENTITY_WIDGET
    )
    widgets = w_base.filter(Widget.title.ilike(pattern)).limit(limit).all()
    for w in widgets:
        # Ссылка на редактор только если есть право редактирования
        can_edit = access.can_edit_category(user_id, ENTITY_WIDGET, w.category_id)
        results.append({
            "kind": "widget",
            "id": w.id,
            "title": w.title,
            "subtitle": w.dataset.name if w.dataset else "",
            "url": f"/widgets/{w.id}/edit" if can_edit else "/widgets",
        })

    # KPI (только доступные)
    k_base = access.filter_query_by_access(
        db.session.query(KPI), KPI, user_id, ENTITY_KPI
    )
    kpis = (
        k_base.filter(or_(KPI.name.ilike(pattern), KPI.description.ilike(pattern)))
        .limit(limit)
        .all()
    )
    for k in kpis:
        results.append({
            "kind": "kpi",
            "id": k.id,
            "title": k.name,
            "subtitle": k.category.name if k.category else "",
            "url": "/kpi",
        })

    # Источники данных (только доступные)
    ds_base = access.filter_query_by_access(
        db.session.query(DataSource), DataSource, user_id, ENTITY_DATASOURCE
    )
    datasources = (
        ds_base.filter(DataSource.name.ilike(pattern)).limit(limit).all()
    )
    for ds in datasources:
        results.append({
            "kind": "datasource",
            "id": ds.id,
            "title": ds.name,
            "subtitle": ds.type,
            "url": f"/datasources/{ds.id}",
        })

    # Наборы данных (через доступные источники)
    ds_conds = _accessible_datasource_filter(user_id)
    if ds_conds is not None:
        datasets = (
            db.session.query(Dataset)
            .join(DataSource, Dataset.datasource_id == DataSource.id)
            .filter(Dataset.name.ilike(pattern))
            .filter(or_(*ds_conds))
            .limit(limit)
            .all()
        )
        for d in datasets:
            results.append({
                "kind": "dataset",
                "id": d.id,
                "title": d.name,
                "subtitle": d.datasource.name if d.datasource else "",
                "url": f"/datasources/{d.datasource_id}",
            })

    return jsonify({"results": results, "query": q})
