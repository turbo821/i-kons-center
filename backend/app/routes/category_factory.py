"""
Фабрика роутов для категорий.

Используется для четырёх типов категорий — источников данных, виджетов,
дашбордов и KPI. Все они имеют одинаковую структуру CRUD:
    GET    /api/<entity>-categories         — список
    POST   /api/<entity>-categories         — создание
    PUT    /api/<entity>-categories/<id>    — обновление
    DELETE /api/<entity>-categories/<id>    — удаление

Чтобы не дублировать одинаковую логику четыре раза, используется
фабричная функция create_category_blueprint(), которая принимает
модель и название и возвращает готовый Blueprint.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.auth.decorators import role_required, admin_required


EDITOR_ROLES = ("admin", "expert")


def create_category_blueprint(name, model, dependant_attr):
    """
    Создаёт Blueprint для CRUD категорий.

    name           — имя для URL и blueprint, например "datasource"
    model          — класс модели категории (например DataSourceCategory)
    dependant_attr — имя relationship у категории, по которому проверяется
                     наличие зависимых сущностей при удалении
                     (например, "datasources")
    """
    bp = Blueprint(
        f"{name}_categories",
        __name__,
        url_prefix=f"/api/{name}-categories"
    )

    @bp.route("", methods=["GET"])
    @jwt_required()
    def list_categories():
        items = db.session.query(model).order_by(model.name).all()
        return jsonify([c.to_dict() for c in items])

    @bp.route("", methods=["POST"])
    @admin_required
    def create_category():
        data = request.json or {}

        if not data.get("name"):
            return jsonify({"message": "Поле 'name' обязательно"}), 400

        existing = db.session.query(model).filter_by(name=data["name"]).first()
        if existing:
            return jsonify({
                "message": f"Категория '{data['name']}' уже существует"
            }), 409

        category = model(
            name=data["name"],
            description=data.get("description"),
        )
        db.session.add(category)
        db.session.commit()
        return jsonify(category.to_dict()), 201

    @bp.route("/<int:cat_id>", methods=["PUT"])
    @admin_required
    def update_category(cat_id):
        category = db.session.get(model, cat_id)
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

    @bp.route("/<int:cat_id>", methods=["DELETE"])
    @admin_required
    def delete_category(cat_id):
        category = db.session.get(model, cat_id)
        if category is None:
            return jsonify({"message": "Не найдено"}), 404

        dependants = getattr(category, dependant_attr, [])
        if dependants:
            return jsonify({
                "message": f"Нельзя удалить: к категории привязаны элементы ({len(dependants)} шт.)"
            }), 409

        db.session.delete(category)
        db.session.commit()
        return jsonify({"message": "Удалено"})

    return bp
