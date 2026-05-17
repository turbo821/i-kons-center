"""
REST API для дашбордов.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database.db import db
from app.models import (
    Dashboard,
    DashboardCategory,
    Widget,
    DashboardWidget,
    KPI,
    DashboardKPI,
)
from app.auth.decorators import role_required


dashboard_bp = Blueprint("dashboards", __name__, url_prefix="/api/dashboards")

EDITOR_ROLES = ("admin", "expert")


@dashboard_bp.route("", methods=["GET"])
@jwt_required()
def list_dashboards():
    q = db.session.query(Dashboard)
    category_id = request.args.get("category_id", type=int)
    if category_id is not None:
        q = q.filter_by(category_id=category_id)
    items = q.order_by(Dashboard.created_at.desc()).all()
    return jsonify([d.to_dict() for d in items])


@dashboard_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_dashboard():
    data = request.json or {}

    if not data.get("name"):
        return jsonify({"message": "Поле 'name' обязательно"}), 400

    category_id = data.get("category_id")
    if category_id and not db.session.get(DashboardCategory, category_id):
        return jsonify({
            "message": f"Категория id={category_id} не найдена"
        }), 400

    user_id = int(get_jwt_identity())

    dashboard = Dashboard(
        name=data["name"],
        description=data.get("description"),
        category_id=category_id,
        created_by=user_id,
    )
    db.session.add(dashboard)
    db.session.commit()

    return jsonify(dashboard.to_dict()), 201


@dashboard_bp.route("/<int:dashboard_id>", methods=["GET"])
@jwt_required()
def get_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Не найдено"}), 404
    return jsonify(dashboard.to_dict(include_widgets=True))


@dashboard_bp.route("/<int:dashboard_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Не найдено"}), 404

    data = request.json or {}

    if "name" in data:
        if not data["name"]:
            return jsonify({"message": "Имя не может быть пустым"}), 400
        dashboard.name = data["name"]

    if "description" in data:
        dashboard.description = data["description"]

    if "category_id" in data:
        cat = data["category_id"]
        if cat and not db.session.get(DashboardCategory, cat):
            return jsonify({
                "message": f"Категория id={cat} не найдена"
            }), 400
        dashboard.category_id = cat

    db.session.commit()
    return jsonify(dashboard.to_dict())


@dashboard_bp.route("/<int:dashboard_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Не найдено"}), 404

    db.session.delete(dashboard)
    db.session.commit()
    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# Виджеты на дашборде
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>/widgets", methods=["POST"])
@role_required(*EDITOR_ROLES)
def add_widget_to_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Дашборд не найден"}), 404

    data = request.json or {}
    widget_id = data.get("widget_id")
    if not widget_id:
        return jsonify({"message": "widget_id обязателен"}), 400

    widget = db.session.get(Widget, widget_id)
    if widget is None:
        return jsonify({"message": "Виджет не найден"}), 404

    existing = (
        db.session.query(DashboardWidget)
        .filter_by(dashboard_id=dashboard_id, widget_id=widget_id)
        .first()
    )
    if existing:
        return jsonify({
            "message": "Виджет уже добавлен на этот дашборд"
        }), 409

    placement = DashboardWidget(
        dashboard_id=dashboard_id,
        widget_id=widget_id,
        position_x=data.get("position_x", 0),
        position_y=data.get("position_y", 100),
        width=data.get("width", 6),
        height=data.get("height", 4),
    )
    db.session.add(placement)
    db.session.commit()

    return jsonify(placement.to_dict()), 201


@dashboard_bp.route(
    "/<int:dashboard_id>/widgets/<int:widget_id>",
    methods=["DELETE"]
)
@role_required(*EDITOR_ROLES)
def remove_widget_from_dashboard(dashboard_id, widget_id):
    placement = (
        db.session.query(DashboardWidget)
        .filter_by(dashboard_id=dashboard_id, widget_id=widget_id)
        .first()
    )
    if placement is None:
        return jsonify({"message": "Размещение не найдено"}), 404

    db.session.delete(placement)
    db.session.commit()
    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# KPI на дашборде
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>/kpis", methods=["POST"])
@role_required(*EDITOR_ROLES)
def add_kpi_to_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Дашборд не найден"}), 404

    data = request.json or {}
    kpi_id = data.get("kpi_id")
    if not kpi_id:
        return jsonify({"message": "kpi_id обязателен"}), 400

    kpi = db.session.get(KPI, kpi_id)
    if kpi is None:
        return jsonify({"message": "KPI не найден"}), 404

    existing = (
        db.session.query(DashboardKPI)
        .filter_by(dashboard_id=dashboard_id, kpi_id=kpi_id)
        .first()
    )
    if existing:
        return jsonify({
            "message": "KPI уже добавлен на этот дашборд"
        }), 409

    placement = DashboardKPI(
        dashboard_id=dashboard_id,
        kpi_id=kpi_id,
        position_x=data.get("position_x", 0),
        position_y=data.get("position_y", 100),
        width=data.get("width", 3),
        height=data.get("height", 3),
    )
    db.session.add(placement)
    db.session.commit()

    return jsonify(placement.to_dict()), 201


@dashboard_bp.route(
    "/<int:dashboard_id>/kpis/<int:kpi_id>",
    methods=["DELETE"]
)
@role_required(*EDITOR_ROLES)
def remove_kpi_from_dashboard(dashboard_id, kpi_id):
    placement = (
        db.session.query(DashboardKPI)
        .filter_by(dashboard_id=dashboard_id, kpi_id=kpi_id)
        .first()
    )
    if placement is None:
        return jsonify({"message": "Размещение не найдено"}), 404

    db.session.delete(placement)
    db.session.commit()
    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# Пакетное обновление layout (виджеты + KPI вместе)
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>/layout", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_dashboard_layout(dashboard_id):
    """
    Body:
    {
      "items": [
        {"kind": "widget", "ref_id": 1, "position_x": 0, "position_y": 0, "width": 6, "height": 4},
        {"kind": "kpi",    "ref_id": 5, "position_x": 6, "position_y": 0, "width": 3, "height": 3}
      ]
    }
    """
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Дашборд не найден"}), 404

    data = request.json or {}
    items = data.get("items") or []

    # Загружаем все размещения одним махом
    widget_placements = (
        db.session.query(DashboardWidget)
        .filter_by(dashboard_id=dashboard_id)
        .all()
    )
    kpi_placements = (
        db.session.query(DashboardKPI)
        .filter_by(dashboard_id=dashboard_id)
        .all()
    )

    widgets_by_id = {p.widget_id: p for p in widget_placements}
    kpis_by_id = {p.kpi_id: p for p in kpi_placements}

    for item in items:
        kind = item.get("kind")
        ref_id = item.get("ref_id")
        if not kind or not ref_id:
            continue

        if kind == "widget":
            placement = widgets_by_id.get(ref_id)
        elif kind == "kpi":
            placement = kpis_by_id.get(ref_id)
        else:
            continue

        if not placement:
            continue

        for key in ("position_x", "position_y", "width", "height"):
            if key in item:
                setattr(placement, key, int(item[key]))

    db.session.commit()
    return jsonify({"message": "Layout сохранён"})
