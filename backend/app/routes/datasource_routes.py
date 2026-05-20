"""
REST API для работы с источниками данных.

Маршруты:
    GET    /api/datasources              — список
    POST   /api/datasources               — создать (JSON, SQL-источник)
    POST   /api/datasources/upload        — загрузить CSV/Excel
    POST   /api/datasources/link          — создать «ссылку» на файл по пути
    GET    /api/datasources/<id>          — получить один
    PUT    /api/datasources/<id>          — обновить метаданные
    DELETE /api/datasources/<id>          — удалить
    POST   /api/datasources/<id>/test     — проверка подключения
    GET    /api/datasources/<id>/tables   — список таблиц источника
    POST   /api/datasources/<id>/replace-file  — заменить файл (только csv)
    PUT    /api/datasources/<id>/connection    — обновить SQL-соединение
    PUT    /api/datasources/<id>/link-path     — обновить путь к файлу (csv_link)
"""

import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database.db import db
from app.models import DataSource, DataSourceCategory
from app.auth.decorators import role_required
from app.services import datasource_service as ds_service


datasource_bp = Blueprint(
    "datasources",
    __name__,
    url_prefix="/api/datasources"
)

EDITOR_ROLES = ("admin", "expert")


@datasource_bp.route("", methods=["GET"])
@jwt_required()
def list_datasources():
    q = DataSource.query
    category_id = request.args.get("category_id", type=int)
    if category_id is not None:
        q = q.filter_by(category_id=category_id)
    items = q.order_by(DataSource.created_at.desc()).all()
    return jsonify([d.to_dict() for d in items])


@datasource_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_sql_datasource():
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

    category_id = data.get("category_id")
    if category_id and not db.session.get(DataSourceCategory, category_id):
        return jsonify({
            "message": f"Категория id={category_id} не найдена"
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
        category_id=category_id,
        created_by=user_id,
    )

    ok, msg = ds_service.test_connection(ds)
    if not ok:
        return jsonify({
            "message": f"Не удалось подключиться: {msg}"
        }), 400

    db.session.add(ds)
    db.session.commit()

    return jsonify(ds.to_dict()), 201


@datasource_bp.route("/upload", methods=["POST"])
@role_required(*EDITOR_ROLES)
def upload_file_datasource():
    """multipart/form-data: file, name?, category_id?"""
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

    category_id = request.form.get("category_id", type=int)
    if category_id and not db.session.get(DataSourceCategory, category_id):
        ds_service.remove_file_if_exists(saved_path)
        return jsonify({
            "message": f"Категория id={category_id} не найдена"
        }), 400

    ds = DataSource(
        name=request.form.get("name") or file.filename,
        type="csv",
        connection_string=saved_path,
        category_id=category_id,
        created_by=user_id,
    )

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
# CSV/Excel ПО ССЫЛКЕ (без копирования файла)
# ---------------------------------------------------------------------------
@datasource_bp.route("/link", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_link_datasource():
    """
    Создаёт источник типа csv_link: connection_string хранит абсолютный
    путь к существующему файлу на сервере. Файл не копируется в uploads/.

    Body:
    {
      "name": "Продажи Q1",
      "path": "C:/data/sales.csv",   # или /opt/data/sales.xlsx
      "category_id": 1
    }

    Изменения в файле автоматически подхватываются — при каждом чтении
    мы открываем файл заново. Если файл будет удалён или перемещён,
    источник перестанет работать (вернёт «Файл не найден»).
    """
    data = request.json or {}

    name = (data.get("name") or "").strip()
    path = (data.get("path") or "").strip()

    if not name:
        return jsonify({"message": "Укажите название источника"}), 400
    if not path:
        return jsonify({"message": "Укажите путь к файлу"}), 400

    # Валидируем путь: существует, читается, расширение допустимо
    ok, msg = ds_service.validate_external_file_path(path)
    if not ok:
        return jsonify({"message": msg}), 400

    category_id = data.get("category_id")
    if category_id and not db.session.get(DataSourceCategory, category_id):
        return jsonify({
            "message": f"Категория id={category_id} не найдена"
        }), 400

    user_id = int(get_jwt_identity())

    ds = DataSource(
        name=name,
        type="csv_link",
        connection_string=path,
        category_id=category_id,
        created_by=user_id,
    )
    db.session.add(ds)
    db.session.commit()

    return jsonify(ds.to_dict()), 201


@datasource_bp.route("/<int:ds_id>", methods=["GET"])
@jwt_required()
def get_datasource(ds_id):
    ds = DataSource.query.get_or_404(ds_id)
    return jsonify(ds.to_dict())


@datasource_bp.route("/<int:ds_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_datasource(ds_id):
    ds = DataSource.query.get_or_404(ds_id)

    if ds.datasets:
        return jsonify({
            "message": "Нельзя удалить источник: есть связанные наборы данных"
        }), 409

    # Физически удаляем только файлы, загруженные через /upload.
    # Для csv_link файл принадлежит пользователю — удалять его нельзя.
    if ds.type == "csv":
        ds_service.remove_file_if_exists(ds.connection_string)

    db.session.delete(ds)
    db.session.commit()

    return jsonify({"message": "Удалено"})


@datasource_bp.route("/<int:ds_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_datasource(ds_id):
    """Обновление метаданных (имя, категория)."""
    ds = DataSource.query.get_or_404(ds_id)
    data = request.json or {}

    if "name" in data:
        if not data["name"]:
            return jsonify({"message": "Имя не может быть пустым"}), 400
        ds.name = data["name"]

    if "category_id" in data:
        new_cat = data["category_id"]
        if new_cat and not db.session.get(DataSourceCategory, new_cat):
            return jsonify({
                "message": f"Категория id={new_cat} не найдена"
            }), 400
        ds.category_id = new_cat

    db.session.commit()
    return jsonify(ds.to_dict())


@datasource_bp.route("/<int:ds_id>/replace-file", methods=["POST"])
@role_required(*EDITOR_ROLES)
def replace_file(ds_id):
    """Замена файла. Только для type='csv'. Для csv_link используйте link-path."""
    ds = DataSource.query.get_or_404(ds_id)

    if ds.type != "csv":
        return jsonify({
            "message": (
                "Замена файла доступна только для источников типа 'csv'. "
                "Для csv_link используйте обновление пути."
            )
        }), 400

    if "file" not in request.files:
        return jsonify({"message": "Файл не передан"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"message": "Файл не выбран"}), 400

    if not ds_service.is_allowed_file(file.filename):
        return jsonify({
            "message": "Поддерживаются только файлы CSV, XLS, XLSX"
        }), 400

    required_fields_by_ds = {
        d.id: {f.name for f in d.fields} for d in ds.datasets
    }

    try:
        new_path = ds_service.save_uploaded_file(file)
    except (OSError, ValueError) as e:
        return jsonify({"message": f"Ошибка сохранения: {e}"}), 400

    old_path = ds.connection_string
    ds.connection_string = new_path

    try:
        import pandas as pd
        new_df = (
            pd.read_csv(new_path) if new_path.lower().endswith(".csv")
            else pd.read_excel(new_path)
        )
        new_columns = set(new_df.columns)

        problems = []
        for d_id, required in required_fields_by_ds.items():
            missing = required - new_columns
            if missing:
                problems.append(
                    f"набор данных id={d_id} требует столбцы: "
                    f"{', '.join(missing)}"
                )

        if problems:
            ds.connection_string = old_path
            ds_service.remove_file_if_exists(new_path)
            return jsonify({
                "message": "Новый файл несовместим:\n" + "\n".join(problems)
            }), 400

    except (ValueError, OSError, ImportError) as e:
        ds.connection_string = old_path
        ds_service.remove_file_if_exists(new_path)
        return jsonify({"message": f"Не удалось прочитать файл: {e}"}), 400

    ds_service.remove_file_if_exists(old_path)
    db.session.commit()

    return jsonify({"message": "Файл обновлён", "datasource": ds.to_dict()})


# ---------------------------------------------------------------------------
# Обновление пути для csv_link
# ---------------------------------------------------------------------------
@datasource_bp.route("/<int:ds_id>/link-path", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_link_path(ds_id):
    """
    Обновляет путь к файлу для источника типа csv_link.
    Body: {"path": "/new/path/to/file.csv"}

    Проверяем, что новый файл существует, читается и содержит все
    столбцы, которые требуются существующими датасетами (аналогично
    replace-file для csv).
    """
    ds = DataSource.query.get_or_404(ds_id)

    if ds.type != "csv_link":
        return jsonify({
            "message": (
                "Обновление пути доступно только для источников типа "
                "'csv_link'."
            )
        }), 400

    data = request.json or {}
    new_path = (data.get("path") or "").strip()

    ok, msg = ds_service.validate_external_file_path(new_path)
    if not ok:
        return jsonify({"message": msg}), 400

    # Проверяем совместимость с существующими датасетами по столбцам
    required_fields_by_ds = {
        d.id: {f.name for f in d.fields} for d in ds.datasets
    }
    old_path = ds.connection_string
    ds.connection_string = new_path

    try:
        import pandas as pd
        new_df = (
            pd.read_csv(new_path) if new_path.lower().endswith(".csv")
            else pd.read_excel(new_path)
        )
        new_columns = set(new_df.columns)

        problems = []
        for d_id, required in required_fields_by_ds.items():
            missing = required - new_columns
            if missing:
                problems.append(
                    f"набор данных id={d_id} требует столбцы: "
                    f"{', '.join(missing)}"
                )
        if problems:
            ds.connection_string = old_path
            return jsonify({
                "message": "Файл несовместим:\n" + "\n".join(problems)
            }), 400
    except (ValueError, OSError, ImportError) as e:
        ds.connection_string = old_path
        return jsonify({"message": f"Не удалось прочитать файл: {e}"}), 400

    db.session.commit()
    return jsonify({"message": "Путь обновлён", "datasource": ds.to_dict()})


@datasource_bp.route("/<int:ds_id>/connection", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_connection(ds_id):
    ds = DataSource.query.get_or_404(ds_id)

    if ds.type not in ("postgres", "mysql"):
        return jsonify({
            "message": "Обновление соединения доступно только для SQL-источников"
        }), 400

    data = request.json or {}
    required = ("host", "port", "database", "user", "password")
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({
            "message": f"Не заданы поля: {', '.join(missing)}"
        }), 400

    new_connection = {
        "host": data["host"],
        "port": int(data["port"]),
        "database": data["database"],
        "user": data["user"],
        "password": data["password"],
    }

    old_connection = ds.connection_string
    ds.connection_string = json.dumps(new_connection)

    ok, msg = ds_service.test_connection(ds)
    if not ok:
        ds.connection_string = old_connection
        return jsonify({
            "message": f"Не удалось подключиться: {msg}"
        }), 400

    try:
        for d in ds.datasets:
            ds_service.read_dataset(d.datasource, query=d.sql_query, limit=1)
    except (ValueError, OSError, KeyError) as e:
        ds.connection_string = old_connection
        return jsonify({
            "message": (
                f"Таблицы существующих датасетов недоступны "
                f"в новом подключении: {e}"
            )
        }), 400

    db.session.commit()
    return jsonify({
        "message": "Соединение обновлено",
        "datasource": ds.to_dict()
    })


@datasource_bp.route("/<int:ds_id>/test", methods=["POST"])
@jwt_required()
def test_connection(ds_id):
    ds = DataSource.query.get_or_404(ds_id)
    ok, msg = ds_service.test_connection(ds)
    return jsonify({"ok": ok, "message": msg})


@datasource_bp.route("/<int:ds_id>/tables", methods=["GET"])
@jwt_required()
def list_tables(ds_id):
    ds = DataSource.query.get_or_404(ds_id)
    try:
        tables = ds_service.list_tables(ds)
    except (ValueError, OSError) as e:
        return jsonify({"message": str(e)}), 400
    return jsonify(tables)
