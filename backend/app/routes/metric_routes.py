"""
REST API для метрик (вычисляемых показателей).

Маршруты:
    GET    /api/metrics                       — список (?dataset_id=...)
    POST   /api/metrics                       — создать или вернуть существующую
    DELETE /api/metrics/<id>                  — удалить
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import Metric, DatasetField
from app.auth.decorators import role_required
from app.services.widget_data_service import AGGREGATION_FUNCS


metric_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")

EDITOR_ROLES = ("admin", "expert")


@metric_bp.route("", methods=["GET"])
@jwt_required()
def list_metrics():
    """Список метрик. Можно фильтровать по dataset_id (через JOIN на field)."""
    q = db.session.query(Metric)

    dataset_id = request.args.get("dataset_id", type=int)
    if dataset_id:
        q = q.join(DatasetField).filter(DatasetField.dataset_id == dataset_id)

    items = q.all()
    return jsonify([m.to_dict() for m in items])


@metric_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_metric():
    """
    Body:
    {
      "field_id": 1,
      "name": "Сумма продаж",
      "aggregation_type": "sum"
    }

    Если метрика с такой же парой (field_id, aggregation_type) уже существует —
    возвращаем существующую (идемпотентность для конструктора виджетов).
    """
    data = request.json or {}

    required = ("field_id", "name", "aggregation_type")
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({
            "message": f"Не заданы поля: {', '.join(missing)}"
        }), 400

    if data["aggregation_type"] not in AGGREGATION_FUNCS:
        return jsonify({
            "message": (
                f"Недопустимый тип агрегации. Разрешены: "
                f"{', '.join(AGGREGATION_FUNCS.keys())}"
            )
        }), 400

    # Проверяем существование поля
    field = db.session.get(DatasetField, data["field_id"])
    if not field:
        return jsonify({"message": "Поле не найдено"}), 404

    # Защита: count_distinct/count работают на любом типе,
    # но sum/avg/min/max — только на числах.
    if data["aggregation_type"] in ("sum", "avg") and field.data_type not in ("integer", "float"):
        return jsonify({
            "message": (
                f"Агрегация '{data['aggregation_type']}' "
                f"применима только к числовым полям"
            )
        }), 400

    # Идемпотентность: ищем существующую
    existing = db.session.query(Metric).filter_by(
        field_id=data["field_id"],
        aggregation_type=data["aggregation_type"]
    ).first()

    if existing:
        return jsonify(existing.to_dict()), 200

    metric = Metric(
        field_id=data["field_id"],
        name=data["name"],
        aggregation_type=data["aggregation_type"]
    )
    db.session.add(metric)
    db.session.commit()

    return jsonify(metric.to_dict()), 201


@metric_bp.route("/<int:metric_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_metric(metric_id):
    metric = db.session.get(Metric, metric_id)
    if metric is None:
        return jsonify({"message": "Не найдено"}), 404

    if metric.widgets:
        return jsonify({
            "message": "Нельзя удалить: метрика используется в виджетах"
        }), 409

    db.session.delete(metric)
    db.session.commit()
    return jsonify({"message": "Удалено"})
