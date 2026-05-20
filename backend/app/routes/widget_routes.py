"""
REST API для виджетов.

Маршруты:
    GET    /api/widgets                     — список (?dashboard_id=...)
    POST   /api/widgets                     — создать виджет
    GET    /api/widgets/<id>                — получить виджет с конфигурацией
    PUT    /api/widgets/<id>                — обновить (метрики, измерения, фильтры)
    DELETE /api/widgets/<id>                — удалить
    GET    /api/widgets/<id>/data           — агрегированные данные для отрисовки
"""

from typing import Optional

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import (
    Widget,
    WidgetCategory,
    Dataset,
    Metric,
    Dimension,
    Filter,
    DatasetField,
    DashboardWidget,
)
from app.auth.decorators import role_required
from app.services.widget_data_service import (
    aggregate_widget_data,
    FILTER_OPERATORS,
)


widget_bp = Blueprint("widgets", __name__, url_prefix="/api/widgets")

EDITOR_ROLES = ("admin", "expert")

ALLOWED_WIDGET_TYPES = {"bar", "line", "pie", "table", "horizontal_bar"}


def _resolve_metrics(metric_ids: list[int]) -> tuple[list[Metric], Optional[str]]:
    if not metric_ids:
        return [], None
    items = db.session.query(Metric).filter(Metric.id.in_(metric_ids)).all()
    if len(items) != len(set(metric_ids)):
        return [], "Часть метрик не найдена"
    return items, None


def _resolve_dimensions(dim_ids: list[int]) -> tuple[list[Dimension], Optional[str]]:
    if not dim_ids:
        return [], None
    items = db.session.query(Dimension).filter(Dimension.id.in_(dim_ids)).all()
    if len(items) != len(set(dim_ids)):
        return [], "Часть измерений не найдена"
    return items, None


def _replace_filters(widget: Widget, filters_data: list[dict]) -> Optional[str]:
    for old in list(widget.filters):
        db.session.delete(old)
    db.session.flush()

    for f in filters_data or []:
        field_id = f.get("field_id")
        operator = f.get("operator")
        value = f.get("value", "")

        if not field_id or not operator:
            return "У фильтра обязательны поля 'field_id' и 'operator'"

        if operator not in FILTER_OPERATORS:
            return (
                f"Недопустимый оператор '{operator}'. "
                f"Разрешены: {', '.join(FILTER_OPERATORS)}"
            )

        if not db.session.get(DatasetField, field_id):
            return f"Поле id={field_id} не найдено"

        new_filter = Filter(
            widget_id=widget.id,
            field_id=field_id,
            operator=operator,
            value=str(value) if value is not None else None,
        )
        db.session.add(new_filter)

    return None


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@widget_bp.route("", methods=["GET"])
@jwt_required()
def list_widgets():
    """
    Возвращает все виджеты. Опционально можно фильтровать
    по dashboard_id — вернутся виджеты, размещённые на дашборде.
    """
    dashboard_id = request.args.get("dashboard_id", type=int)
    category_id = request.args.get("category_id", type=int)

    if dashboard_id is not None:
        # Виджеты, размещённые на дашборде (через DashboardWidget)
        items = (
            db.session.query(Widget)
            .join(DashboardWidget, DashboardWidget.widget_id == Widget.id)
            .filter(DashboardWidget.dashboard_id == dashboard_id)
            .all()
        )
    else:
        q = db.session.query(Widget)
        if category_id is not None:
            q = q.filter_by(category_id=category_id)
        items = q.order_by(Widget.id.desc()).all()

    return jsonify([w.to_dict() for w in items])


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@widget_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_widget():
    """
    Body:
    {
      "dataset_id": 1,
      "title": "Продажи по регионам",
      "type": "bar",
      "metric_ids": [1, 2],
      "dimension_ids": [3],
      "filters": [{"field_id": 5, "operator": "eq", "value": "active"}]
    }
    """
    data = request.json or {}

    if not data.get("dataset_id") or not data.get("title") or not data.get("type"):
        return jsonify({
            "message": "Поля 'dataset_id', 'title' и 'type' обязательны"
        }), 400

    if data["type"] not in ALLOWED_WIDGET_TYPES:
        return jsonify({
            "message": (
                f"Недопустимый тип. Разрешены: "
                f"{', '.join(ALLOWED_WIDGET_TYPES)}"
            )
        }), 400

    if not db.session.get(Dataset, data["dataset_id"]):
        return jsonify({"message": "Датасет не найден"}), 404

    category_id = data.get("category_id")
    if category_id and not db.session.get(WidgetCategory, category_id):
        return jsonify({
            "message": f"Категория id={category_id} не найдена"
        }), 400
    metrics, err = _resolve_metrics(data.get("metric_ids") or [])
    if err:
        return jsonify({"message": err}), 400

    dimensions, err = _resolve_dimensions(data.get("dimension_ids") or [])
    if err:
        return jsonify({"message": err}), 400

    widget = Widget(
        dataset_id=data["dataset_id"],
        title=data["title"],
        type=data["type"],
        category_id=category_id,
    )
    widget.metrics = metrics
    widget.dimensions = dimensions

    db.session.add(widget)
    db.session.flush()

    err = _replace_filters(widget, data.get("filters") or [])
    if err:
        db.session.rollback()
        return jsonify({"message": err}), 400

    db.session.commit()
    return jsonify(widget.to_dict(include_config=True)), 201


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------
@widget_bp.route("/<int:widget_id>", methods=["GET"])
@jwt_required()
def get_widget(widget_id):
    widget = db.session.get(Widget, widget_id)
    if widget is None:
        return jsonify({"message": "Не найдено"}), 404
    return jsonify(widget.to_dict(include_config=True))


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------
@widget_bp.route("/<int:widget_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_widget(widget_id):
    widget = db.session.get(Widget, widget_id)
    if widget is None:
        return jsonify({"message": "Не найдено"}), 404

    data = request.json or {}

    for field in ("title", "type"):
        if field in data:
            if field == "type" and data[field] not in ALLOWED_WIDGET_TYPES:
                return jsonify({"message": "Недопустимый тип"}), 400
            setattr(widget, field, data[field])

    if "category_id" in data:
        cat = data["category_id"]
        if cat and not db.session.get(WidgetCategory, cat):
            return jsonify({
                "message": f"Категория id={cat} не найдена"
            }), 400
        widget.category_id = cat

    if "metric_ids" in data:
        metrics, err = _resolve_metrics(data["metric_ids"])
        if err:
            return jsonify({"message": err}), 400
        widget.metrics = metrics

    if "dimension_ids" in data:
        dims, err = _resolve_dimensions(data["dimension_ids"])
        if err:
            return jsonify({"message": err}), 400
        widget.dimensions = dims

    if "filters" in data:
        err = _replace_filters(widget, data["filters"])
        if err:
            db.session.rollback()
            return jsonify({"message": err}), 400

    db.session.commit()
    return jsonify(widget.to_dict(include_config=True))


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@widget_bp.route("/<int:widget_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_widget(widget_id):
    widget = db.session.get(Widget, widget_id)
    if widget is None:
        return jsonify({"message": "Не найдено"}), 404

    db.session.delete(widget)
    db.session.commit()
    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# DATA
# ---------------------------------------------------------------------------
@widget_bp.route("/<int:widget_id>/data", methods=["GET"])
@jwt_required()
def widget_data(widget_id):
    widget = db.session.get(Widget, widget_id)
    if widget is None:
        return jsonify({"message": "Не найдено"}), 404

    try:
        result = aggregate_widget_data(widget)
    except (ValueError, OSError, KeyError) as e:
        return jsonify({"message": f"Ошибка вычисления: {e}"}), 400

    return jsonify(result)
