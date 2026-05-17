"""
REST API для KPI.

Маршруты:
    GET    /api/kpis                     — список (?category_id=...)
    POST   /api/kpis                     — создать
    GET    /api/kpis/<id>                — получить с метрикой
    PUT    /api/kpis/<id>                — обновить
    DELETE /api/kpis/<id>                — удалить
    GET    /api/kpis/<id>/value          — текущее значение + % выполнения
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import KPI, KPICategory, Metric
from app.auth.decorators import role_required
from app.services.kpi_service import calculate_kpi_value


kpi_bp = Blueprint("kpis", __name__, url_prefix="/api/kpis")

EDITOR_ROLES = ("admin", "expert")

ALLOWED_DIRECTIONS = {"higher_better", "lower_better"}


def _validate_payload(data: dict) -> str | None:
    """Возвращает текст ошибки или None."""
    if not data.get("name"):
        return "Поле 'name' обязательно"

    direction = data.get("direction", "higher_better")
    if direction not in ALLOWED_DIRECTIONS:
        return (
            f"direction должен быть одним из: "
            f"{', '.join(ALLOWED_DIRECTIONS)}"
        )

    # Проверка ссылочной целостности
    if data.get("category_id"):
        if not db.session.get(KPICategory, data["category_id"]):
            return f"Категория id={data['category_id']} не найдена"

    if data.get("metric_id"):
        if not db.session.get(Metric, data["metric_id"]):
            return f"Метрика id={data['metric_id']} не найдена"

    return None


@kpi_bp.route("", methods=["GET"])
@jwt_required()
def list_kpis():
    q = db.session.query(KPI)

    category_id = request.args.get("category_id", type=int)
    if category_id:
        q = q.filter_by(category_id=category_id)

    items = q.order_by(KPI.created_at.desc()).all()
    return jsonify([k.to_dict() for k in items])


@kpi_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_kpi():
    """
    Body:
    {
      "name": "Выработка электроэнергии",
      "description": "...",
      "category_id": 1,
      "metric_id": 5,           // опционально, для автовычисления
      "manual_value": 1000,     // опционально, если metric_id не задан
      "formula": "Сумма за период",
      "target_value": 5000,
      "unit": "МВт·ч",
      "direction": "higher_better"
    }
    """
    data = request.json or {}

    err = _validate_payload(data)
    if err:
        return jsonify({"message": err}), 400

    kpi = KPI(
        name=data["name"],
        description=data.get("description"),
        category_id=data.get("category_id"),
        metric_id=data.get("metric_id"),
        formula=data.get("formula"),
        target_value=data.get("target_value"),
        unit=data.get("unit"),
        direction=data.get("direction", "higher_better"),
        manual_value=data.get("manual_value"),
    )
    db.session.add(kpi)
    db.session.commit()

    return jsonify(kpi.to_dict()), 201


@kpi_bp.route("/<int:kpi_id>", methods=["GET"])
@jwt_required()
def get_kpi(kpi_id):
    kpi = db.session.get(KPI, kpi_id)
    if kpi is None:
        return jsonify({"message": "Не найдено"}), 404
    return jsonify(kpi.to_dict(include_metric=True))


@kpi_bp.route("/<int:kpi_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_kpi(kpi_id):
    kpi = db.session.get(KPI, kpi_id)
    if kpi is None:
        return jsonify({"message": "Не найдено"}), 404

    data = request.json or {}

    err = _validate_payload(data)
    if err:
        return jsonify({"message": err}), 400

    # Обновляем все известные поля
    for field in (
        "name",
        "description",
        "category_id",
        "metric_id",
        "formula",
        "target_value",
        "unit",
        "direction",
        "manual_value",
    ):
        if field in data:
            setattr(kpi, field, data[field])

    db.session.commit()
    return jsonify(kpi.to_dict())


@kpi_bp.route("/<int:kpi_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_kpi(kpi_id):
    kpi = db.session.get(KPI, kpi_id)
    if kpi is None:
        return jsonify({"message": "Не найдено"}), 404

    db.session.delete(kpi)
    db.session.commit()
    return jsonify({"message": "Удалено"})


@kpi_bp.route("/<int:kpi_id>/value", methods=["GET"])
@jwt_required()
def kpi_value(kpi_id):
    """Главный endpoint: возвращает фактическое значение + % выполнения."""
    kpi = db.session.get(KPI, kpi_id)
    if kpi is None:
        return jsonify({"message": "Не найдено"}), 404

    try:
        result = calculate_kpi_value(kpi)
    except (ValueError, OSError, KeyError) as e:
        return jsonify({"message": f"Ошибка вычисления: {e}"}), 400

    return jsonify(result)
