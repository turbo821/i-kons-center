"""
REST API для категорий KPI.

Маршруты:
    GET    /api/categories         — список
    POST   /api/categories         — создать
    PUT    /api/categories/<id>    — обновить
    DELETE /api/categories/<id>    — удалить
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import Category
from app.auth.decorators import role_required


category_bp = Blueprint("categories", __name__, url_prefix="/api/categories")

EDITOR_ROLES = ("admin", "expert")


@category_bp.route("", methods=["GET"])
@jwt_required()
def list_categories():
    items = db.session.query(Category).order_by(Category.name).all()
    return jsonify([c.to_dict() for c in items])


@category_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_category():
    data = request.json or {}

    if not data.get("name"):
        return jsonify({"message": "Поле 'name' обязательно"}), 400

    # Проверка уникальности
    existing = db.session.query(Category).filter_by(name=data["name"]).first()
    if existing:
        return jsonify({
            "message": f"Категория '{data['name']}' уже существует"
        }), 409

    category = Category(
        name=data["name"],
        description=data.get("description"),
    )
    db.session.add(category)
    db.session.commit()

    return jsonify(category.to_dict()), 201


@category_bp.route("/<int:cat_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_category(cat_id):
    category = db.session.get(Category, cat_id)
    if category is None:
        return jsonify({"message": "Не найдено"}), 404

    data = request.json or {}

    if "name" in data:
        if not data["name"]:
            return jsonify({"message": "Имя не может быть пустым"}), 400
        category.name = data["name"]

    if "description" in data:
        category.description = data["description"]

    db.session.commit()
    return jsonify(category.to_dict())


@category_bp.route("/<int:cat_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_category(cat_id):
    category = db.session.get(Category, cat_id)
    if category is None:
        return jsonify({"message": "Не найдено"}), 404

    if category.kpis:
        return jsonify({
            "message": "Нельзя удалить: категория используется в KPI"
        }), 409

    db.session.delete(category)
    db.session.commit()
    return jsonify({"message": "Удалено"})
