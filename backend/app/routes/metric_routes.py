"""
REST API для метрик (вычисляемых показателей).

Маршруты:
    GET    /api/metrics                       — список (?dataset_id=...)
    POST   /api/metrics                       — создать или вернуть существующую
    PUT    /api/metrics/<id>                  — обновить (name / aggregation_type / field_id)
    DELETE /api/metrics/<id>                  — удалить
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import Metric, DatasetField, Dataset
from app.auth.decorators import role_required, get_current_user_id
from app.services.widget_data_service import AGGREGATION_FUNCS
from app.services import access_service as access
from app.services.access_service import ENTITY_DATASOURCE


metric_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")

EDITOR_ROLES = ("admin", "expert")


# Агрегации, разрешённые только на числовых полях. count и count_distinct
# работают на любых типах, поэтому в этот набор не входят.
_NUMERIC_ONLY_AGGS = ("sum", "avg")


def _validate_aggregation(aggregation_type, field):
    """
    Возвращает строку с ошибкой или None если всё ок.
    Проверяем: 1) известная агрегация, 2) совместимость с типом поля.
    """
    if aggregation_type not in AGGREGATION_FUNCS:
        return (
            f"Недопустимый тип агрегации. Разрешены: "
            f"{', '.join(AGGREGATION_FUNCS.keys())}"
        )

    if (
        aggregation_type in _NUMERIC_ONLY_AGGS
        and field.data_type not in ("integer", "float")
    ):
        return (
            f"Агрегация '{aggregation_type}' "
            f"применима только к числовым полям"
        )

    return None


@metric_bp.route("", methods=["GET"])
@jwt_required()
def list_metrics():
    """Список метрик. Можно фильтровать по dataset_id (через JOIN на field)."""
    q = db.session.query(Metric)

    dataset_id = request.args.get("dataset_id", type=int)
    if dataset_id:
        q = q.join(DatasetField).filter(DatasetField.dataset_id == dataset_id)

    items = q.all()

    # Оставляем только метрики, источник которых доступен пользователю
    user_id = get_current_user_id()
    viewable = access.viewable_category_ids(user_id, ENTITY_DATASOURCE)
    items = [
        m for m in items
        if m.field and m.field.dataset and m.field.dataset.datasource
        and m.field.dataset.datasource.category_id in viewable
    ]
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

    field = db.session.get(DatasetField, data["field_id"])
    if not field:
        return jsonify({"message": "Поле не найдено"}), 404

    denied = access.check_field_edit(get_current_user_id(), field)
    if denied:
        return jsonify(denied[0]), denied[1]

    err = _validate_aggregation(data["aggregation_type"], field)
    if err:
        return jsonify({"message": err}), 400

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


@metric_bp.route("/<int:metric_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_metric(metric_id):
    """
    Обновить метрику. Допустимы изменения:
      - name (отображаемое имя — оно идёт на графики)
      - aggregation_type
      - field_id (можно перепривязать к другому полю того же датасета)

    Меняем поэлементно: то, что не пришло — не трогаем.
    """
    metric = db.session.get(Metric, metric_id)
    if metric is None:
        return jsonify({"message": "Не найдено"}), 404

    # Редактировать метрику можно, только если есть право на её текущее поле
    denied = access.check_field_edit(get_current_user_id(), metric.field)
    if denied:
        return jsonify(denied[0]), denied[1]

    data = request.json or {}

    # field_id: проверяем существование и совместимость с агрегацией.
    # Берём «целевую» агрегацию из payload, если она пришла, иначе текущую.
    new_field = metric.field
    if "field_id" in data and data["field_id"] is not None:
        new_field = db.session.get(DatasetField, data["field_id"])
        if not new_field:
            return jsonify({"message": "Поле не найдено"}), 404
        denied_target = access.check_field_edit(get_current_user_id(), new_field)
        if denied_target:
            return jsonify(denied_target[0]), denied_target[1]

    new_agg = data.get("aggregation_type", metric.aggregation_type)
    err = _validate_aggregation(new_agg, new_field)
    if err:
        return jsonify({"message": err}), 400

    if "name" in data:
        new_name = (data.get("name") or "").strip()
        if not new_name:
            return jsonify({"message": "Имя не может быть пустым"}), 400
        metric.name = new_name

    if "aggregation_type" in data:
        metric.aggregation_type = data["aggregation_type"]

    if "field_id" in data and data["field_id"] is not None:
        metric.field_id = data["field_id"]

    db.session.commit()
    return jsonify(metric.to_dict())


@metric_bp.route("/<int:metric_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_metric(metric_id):
    metric = db.session.get(Metric, metric_id)
    if metric is None:
        return jsonify({"message": "Не найдено"}), 404

    denied = access.check_field_edit(get_current_user_id(), metric.field)
    if denied:
        return jsonify(denied[0]), denied[1]

    if metric.widgets:
        return jsonify({
            "message": "Нельзя удалить: метрика используется в виджетах"
        }), 409

    db.session.delete(metric)
    db.session.commit()
    return jsonify({"message": "Удалено"})
