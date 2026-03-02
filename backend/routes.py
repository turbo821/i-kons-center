import os
from flask import request, jsonify, current_app
from models import db, Category, DashboardCard
import re
import uuid

def safe_filename(filename):
    """
    Разрешаем:
    - кириллицу
    - латиницу
    - цифры
    - пробелы
    - точки
    - дефисы
    - подчеркивания
    """

    # убираем путь если кто-то передал C:\... или ../../
    filename = filename.split("/")[-1]
    filename = filename.split("\\")[-1]

    # удаляем запрещенные символы
    filename = re.sub(r'[^\w\s\-.А-Яа-яЁё]', '', filename)

    # убираем лишние пробелы
    filename = filename.strip()

    return filename

def register_routes(app):

    # ============================
    # CATEGORY CRUD
    # ============================

    @app.route("/api/categories", methods=["GET"])
    def get_categories():
        categories = Category.query.all()
        result = [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "color": c.color
            }
            for c in categories
        ]
        return jsonify(result)


    @app.route("/api/categories/<int:id>", methods=["GET"])
    def get_category(id):
        category = Category.query.get_or_404(id)
        return jsonify({
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "color": category.color
        })


    @app.route("/api/categories", methods=["POST"])
    def create_category():
        data = request.json

        category = Category(
            name=data["name"],
            description=data.get("description"),
            color=data.get("color")
        )

        db.session.add(category)
        db.session.commit()

        return jsonify({"message": "Category created", "id": category.id}), 201


    @app.route("/api/categories/<int:id>", methods=["PUT"])
    def update_category(id):
        category = Category.query.get_or_404(id)
        data = request.json

        category.name = data.get("name", category.name)
        category.description = data.get("description", category.description)
        category.color = data.get("color", category.color)

        db.session.commit()

        return jsonify({"message": "Category updated"})


    @app.route("/api/categories/<int:id>", methods=["DELETE"])
    def delete_category(id):
        category = Category.query.get_or_404(id)
        db.session.delete(category)
        db.session.commit()

        return jsonify({"message": "Category deleted"})


    # ============================
    # DASHBOARD CARD CRUD
    # ============================

    @app.route("/api/cards", methods=["GET"])
    def get_cards():
        cards = DashboardCard.query.all()
        result = [
            {
                "id": c.id,
                "title": c.title,
                "responsible": c.responsible,
                "update_period": c.update_period,
                "pdf_path": c.pdf_path,
                "category_id": c.category_id,
                "category_name": c.category.name if c.category else None
            }
            for c in cards
        ]
        return jsonify(result)


    @app.route("/api/cards/<int:id>", methods=["GET"])
    def get_card(id):
        card = DashboardCard.query.get_or_404(id)
        return jsonify({
            "id": card.id,
            "title": card.title,
            "responsible": card.responsible,
            "description": card.description,
            "update_period": card.update_period,
            "pdf_path": card.pdf_path,
            "category_id": card.category_id
        })


    @app.route("/api/cards", methods=["POST"])
    def create_card():
        title = request.form.get("title")
        responsible = request.form.get("responsible")
        description = request.form.get("description")
        update_period = request.form.get("update_period")
        category_id = request.form.get("category_id")
        file = request.files.get("pdf")

        category = Category.query.get_or_404(category_id)

        category_folder = os.path.join(
            current_app.config["UPLOAD_FOLDER"],
            safe_filename(category.name)
        )
        os.makedirs(category_folder, exist_ok=True)

        pdf_path = None

        if file:
            original_filename = safe_filename(file.filename)
            unique_name = f"{uuid.uuid4()}_{original_filename}"
            
            file_path = os.path.join(category_folder, unique_name)

            file.save(file_path)

            pdf_path = os.path.join(
                safe_filename(category.name),
                unique_name
            )

        card = DashboardCard(
            title=title,
            responsible=responsible,
            description=description,
            update_period=update_period,
            pdf_path=pdf_path,
            category_id=category.id
        )

        db.session.add(card)
        db.session.commit()

        return jsonify({"id": card.id}), 201


    @app.route("/api/cards/<int:id>", methods=["PUT"])
    def update_card(id):
        card = DashboardCard.query.get_or_404(id)

        card.title = request.form.get("title", card.title)
        card.responsible = request.form.get("responsible", card.responsible)
        card.update_period = request.form.get("update_period", card.update_period)
        card.description = request.form.get("description", card.description)

        db.session.commit()

        return jsonify({"message": "Card updated"})


    @app.route("/api/cards/<int:id>", methods=["DELETE"])
    def delete_card(id):
        card = DashboardCard.query.get_or_404(id)
        db.session.delete(card)
        db.session.commit()

        return jsonify({"message": "Card deleted"})

