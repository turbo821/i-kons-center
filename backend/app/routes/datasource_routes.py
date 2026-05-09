"""
REST API для работы с источниками данных.

Маршруты:
    GET    /api/datasources              — список
    POST   /api/datasources               — создать (JSON, для SQL-источников)
    POST   /api/datasources/upload        — загрузить CSV/Excel
    GET    /api/datasources/<id>          — получить один
    DELETE /api/datasources/<id>          — удалить
    POST   /api/datasources/<id>/test     — проверка подключения
    GET    /api/datasources/<id>/tables   — список таблиц источника
"""

import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database.db import db
from app.models import DataSource
from app.auth.decorators import role_required
from app.services import datasource_service as ds_service


datasource_bp = Blueprint(
    "datasources",
    __name__,
    url_prefix="/api/datasources"
)

# Кто может управлять источниками — admin и expert.
# Для краткости вынесем в одно место:
EDITOR_ROLES = ("admin", "expert")


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@datasource_bp.route("", methods=["GET"])
@jwt_required()
def list_datasources():
    """Просматривать список источников могут все авторизованные."""
    items = DataSource.query.order_by(DataSource.created_at.desc()).all()
    return jsonify([d.to_dict() for d in items])


# ---------------------------------------------------------------------------
# CREATE — SQL-источник (postgres/mysql)
# ---------------------------------------------------------------------------
@datasource_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_sql_datasource():
    """
    Body:
    {
      "name": "Производственная БД",
      "type": "postgres" | "mysql",
      "host": "10.0.0.5",
      "port": 5432,
      "database": "prod",
      "user": "reader",
      "password": "..."
    }
    """
    data = request.json or {}

    required = ("name", "type", "host", "port", "database", "user", "password")
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({
            "message": f"Не заданы поля: {', '.join(missing)}"
        }), 400

    if data["type"] not in ("postgres", "mysql"):
        return jsonify({
            "message": "Поддерживаются только типы: postgres, mysql"
        }), 400

    connection_params = {
        "host": data["host"],
        "port": int(data["port"]),
        "database": data["database"],
        "user": data["user"],
        "password": data["password"],
    }

    user_id = int(get_jwt_identity())

    ds = DataSource(
        name=data["name"],
        type=data["type"],
        connection_string=json.dumps(connection_params),
        created_by=user_id,
    )

    # Проверим подключение перед сохранением — пустые источники не нужны
    ok, msg = ds_service.test_connection(ds)
    if not ok:
        return jsonify({
            "message": f"Не удалось подключиться: {msg}"
        }), 400

    db.session.add(ds)
    db.session.commit()

    return jsonify(ds.to_dict()), 201


# ---------------------------------------------------------------------------
# CREATE — загрузка файла CSV/Excel
# ---------------------------------------------------------------------------
@datasource_bp.route("/upload", methods=["POST"])
@role_required(*EDITOR_ROLES)
def upload_file_datasource():
    """
    multipart/form-data:
      file: <file>
      name: <строка> (опционально, по умолчанию = имя файла)
    """
    if "file" not in request.files:
        return jsonify({"message": "Файл не передан (поле 'file')"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"message": "Имя файла пустое"}), 400

    if not ds_service.is_allowed_file(file.filename):
        return jsonify({
            "message": "Поддерживаются только файлы CSV, XLS, XLSX"
        }), 400

    try:
        saved_path = ds_service.save_uploaded_file(file)
    except (OSError, ValueError) as e:
        return jsonify({"message": f"Ошибка сохранения: {e}"}), 400

    user_id = int(get_jwt_identity())

    ds = DataSource(
        name=request.form.get("name") or file.filename,
        type="csv",
        connection_string=saved_path,
        created_by=user_id,
    )

    # Проверка валидности файла (можно ли его распарсить)
    ok, msg = ds_service.test_connection(ds)
    if not ok:
        ds_service.remove_file_if_exists(saved_path)
        return jsonify({
            "message": f"Файл невозможно прочитать: {msg}"
        }), 400

    db.session.add(ds)
    db.session.commit()

    return jsonify(ds.to_dict()), 201


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------
@datasource_bp.route("/<int:ds_id>", methods=["GET"])
@jwt_required()
def get_datasource(ds_id):
    ds = DataSource.query.get_or_404(ds_id)
    return jsonify(ds.to_dict())


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@datasource_bp.route("/<int:ds_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_datasource(ds_id):
    ds = DataSource.query.get_or_404(ds_id)

    # Если есть привязанные датасеты — запрещаем удаление,
    # иначе оборвём всю цепочку виджетов.
    if ds.datasets:
        return jsonify({
            "message": "Нельзя удалить источник: есть связанные наборы данных"
        }), 409

    if ds.type == "csv":
        ds_service.remove_file_if_exists(ds.connection_string)

    db.session.delete(ds)
    db.session.commit()

    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# TEST CONNECTION
# ---------------------------------------------------------------------------
@datasource_bp.route("/<int:ds_id>/test", methods=["POST"])
@jwt_required()
def test_connection(ds_id):
    ds = DataSource.query.get_or_404(ds_id)
    ok, msg = ds_service.test_connection(ds)
    return jsonify({"ok": ok, "message": msg})


# ---------------------------------------------------------------------------
# LIST TABLES (для конструктора датасетов)
# ---------------------------------------------------------------------------
@datasource_bp.route("/<int:ds_id>/tables", methods=["GET"])
@jwt_required()
def list_tables(ds_id):
    ds = DataSource.query.get_or_404(ds_id)
    try:
        tables = ds_service.list_tables(ds)
    except (ValueError, OSError) as e:
        return jsonify({"message": str(e)}), 400
    return jsonify(tables)
