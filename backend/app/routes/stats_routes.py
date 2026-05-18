"""
Системная статистика и глобальный поиск.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_, func

from app.database.db import db
from app.models import (
    User,
    DataSource,
    Dataset,
    Widget,
    Dashboard,
    KPI,
)


stats_bp = Blueprint("stats", __name__, url_prefix="/api/stats")


@stats_bp.route("/overview", methods=["GET"])
@jwt_required()
def system_overview():
    """Счётчики основных сущностей и последние дашборды."""
    counts = {
        "users": db.session.query(User).count(),
        "datasources": db.session.query(DataSource).count(),
        "datasets": db.session.query(Dataset).count(),
        "widgets": db.session.query(Widget).count(),
        "dashboards": db.session.query(Dashboard).count(),
        "kpis": db.session.query(KPI).count(),
    }

    # Закреплённые — наверх, далее по дате создания (сначала новые).
    # Так лента «Недавние дашборды» на главной согласуется со списком
    # дашбордов: всё закреплённое всегда видно первым.
    recent_dashboards = (
        db.session.query(Dashboard)
        .order_by(Dashboard.is_pinned.desc(), Dashboard.created_at.desc())
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
    Глобальный поиск по сущностям системы.
    Query: ?q=строка
    Возвращает топ-5 совпадений в каждой категории.
    """
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"results": []})

    # Используем ILIKE для регистронезависимого поиска в Postgres
    pattern = f"%{q}%"
    limit = 5

    results = []

    # Дашборды
    dashboards = (
        db.session.query(Dashboard)
        .filter(
            or_(
                Dashboard.name.ilike(pattern),
                Dashboard.description.ilike(pattern),
            )
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

    # Виджеты
    widgets = (
        db.session.query(Widget)
        .filter(Widget.title.ilike(pattern))
        .limit(limit)
        .all()
    )
    for w in widgets:
        results.append({
            "kind": "widget",
            "id": w.id,
            "title": w.title,
            "subtitle": w.dataset.name if w.dataset else "",
            "url": f"/widgets/{w.id}/edit",
        })

    # KPI
    kpis = (
        db.session.query(KPI)
        .filter(
            or_(
                KPI.name.ilike(pattern),
                KPI.description.ilike(pattern),
            )
        )
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

    # Источники данных
    datasources = (
        db.session.query(DataSource)
        .filter(DataSource.name.ilike(pattern))
        .limit(limit)
        .all()
    )
    for ds in datasources:
        results.append({
            "kind": "datasource",
            "id": ds.id,
            "title": ds.name,
            "subtitle": ds.type,
            "url": f"/datasources/{ds.id}",
        })

    # Наборы данных
    from app.models import Dataset
    datasets = (
        db.session.query(Dataset)
        .filter(Dataset.name.ilike(pattern))
        .limit(limit).all()
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
