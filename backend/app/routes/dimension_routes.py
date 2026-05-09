"""
REST API для измерений (Dimension).

Маршруты:
    GET    /api/dimensions                  — список (?dataset_id=...)
    POST   /api/dimensions                  — создать или вернуть существующую
    DELETE /api/dimensions/<id>             — удалить
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import Dimension, DatasetField
from app.auth.decorators import role_required


dimension_bp = Blueprint("dimensions", __name__, url_prefix="/api/dimensions")

EDITOR_ROLES = ("admin", "expert")


@dimension_bp.route("", methods=["GET"])
@jwt_required()
def list_dimensions():
    q = db.session.query(Dimension)

    dataset_id = request.args.get("dataset_id", type=int)
    if dataset_id:
        q = q.join(DatasetField).filter(DatasetField.dataset_id == dataset_id)

    items = q.all()
    return jsonify([d.to_dict() for d in items])


@dimension_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_dimension():
    """
    Body:
    {
      "field_id": 1,
      "name": "По регионам"
    }

    Идемпотентность: если измерение по этому field_id уже есть — возвращаем его.
    """
    data = request.json or {}

    if not data.get("field_id") or not data.get("name"):
        return jsonify({
            "message": "Поля 'field_id' и 'name' обязательны"
        }), 400

    field = db.session.get(DatasetField, data["field_id"])
    if not field:
        return jsonify({"message": "Поле не найдено"}), 404

    existing = db.session.query(Dimension).filter_by(
        field_id=data["field_id"]
    ).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    dim = Dimension(
        field_id=data["field_id"],
        name=data["name"]
    )
    db.session.add(dim)
    db.session.commit()

    return jsonify(dim.to_dict()), 201


@dimension_bp.route("/<int:dim_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_dimension(dim_id):
    dim = db.session.get(Dimension, dim_id)
    if dim is None:
        return jsonify({"message": "Не найдено"}), 404

    if dim.widgets:
        return jsonify({
            "message": "Нельзя удалить: измерение используется в виджетах"
        }), 409

    db.session.delete(dim)
    db.session.commit()
    return jsonify({"message": "Удалено"})
