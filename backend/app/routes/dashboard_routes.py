"""
REST API для дашбордов.

Маршруты:
    GET    /api/dashboards                              — список
    POST   /api/dashboards                              — создать
    GET    /api/dashboards/<id>                         — получить (с виджетами и позициями)
    PUT    /api/dashboards/<id>                         — обновить мета (имя, описание)
    DELETE /api/dashboards/<id>                         — удалить
    POST   /api/dashboards/<id>/widgets                 — добавить виджет
    DELETE /api/dashboards/<id>/widgets/<widget_id>     — убрать виджет
    PUT    /api/dashboards/<id>/layout                  — пакетное обновление позиций
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database.db import db
from app.models import Dashboard, Widget, DashboardWidget
from app.auth.decorators import role_required


dashboard_bp = Blueprint("dashboards", __name__, url_prefix="/api/dashboards")

EDITOR_ROLES = ("admin", "expert")


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@dashboard_bp.route("", methods=["GET"])
@jwt_required()
def list_dashboards():
    items = db.session.query(Dashboard).order_by(Dashboard.created_at.desc()).all()
    return jsonify([d.to_dict() for d in items])


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@dashboard_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_dashboard():
    data = request.json or {}

    if not data.get("name"):
        return jsonify({"message": "Поле 'name' обязательно"}), 400

    user_id = int(get_jwt_identity())

    dashboard = Dashboard(
        name=data["name"],
        description=data.get("description"),
        created_by=user_id,
    )
    db.session.add(dashboard)
    db.session.commit()

    return jsonify(dashboard.to_dict()), 201


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>", methods=["GET"])
@jwt_required()
def get_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Не найдено"}), 404
    return jsonify(dashboard.to_dict(include_widgets=True))


# ---------------------------------------------------------------------------
# UPDATE meta
# ---------------------------------------------------------------------------
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

    db.session.commit()
    return jsonify(dashboard.to_dict())


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_dashboard(dashboard_id):
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Не найдено"}), 404

    db.session.delete(dashboard)  # cascade сносит DashboardWidget-записи
    db.session.commit()
    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# ADD widget
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>/widgets", methods=["POST"])
@role_required(*EDITOR_ROLES)
def add_widget_to_dashboard(dashboard_id):
    """
    Body:
    {
      "widget_id": 1,
      "position_x": 0, "position_y": 0,
      "width": 6, "height": 4
    }
    """
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

    # Защита: не дублируем размещение того же виджета на том же дашборде
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
        position_y=data.get("position_y", 0),
        width=data.get("width", 6),
        height=data.get("height", 4),
    )
    db.session.add(placement)
    db.session.commit()

    return jsonify(placement.to_dict()), 201


# ---------------------------------------------------------------------------
# REMOVE widget
# ---------------------------------------------------------------------------
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
# UPDATE LAYOUT (пакетное обновление позиций)
# ---------------------------------------------------------------------------
@dashboard_bp.route("/<int:dashboard_id>/layout", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_dashboard_layout(dashboard_id):
    """
    Сохраняет новые координаты для всех виджетов сразу.
    Вызывается после drag-and-drop в react-grid-layout.

    Body:
    {
      "items": [
        {"widget_id": 1, "position_x": 0, "position_y": 0, "width": 6, "height": 4},
        {"widget_id": 2, "position_x": 6, "position_y": 0, "width": 6, "height": 4}
      ]
    }
    """
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return jsonify({"message": "Дашборд не найден"}), 404

    data = request.json or {}
    items = data.get("items") or []

    # Получаем все размещения одним запросом и складываем в dict
    placements = (
        db.session.query(DashboardWidget)
        .filter_by(dashboard_id=dashboard_id)
        .all()
    )
    by_widget = {p.widget_id: p for p in placements}

    for item in items:
        wid = item.get("widget_id")
        placement = by_widget.get(wid)
        if not placement:
            continue  # widget уже не на дашборде — игнорируем

        for key in ("position_x", "position_y", "width", "height"):
            if key in item:
                setattr(placement, key, int(item[key]))

    db.session.commit()
    return jsonify({"message": "Layout сохранён"})
