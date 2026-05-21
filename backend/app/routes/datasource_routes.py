"""
REST API для работы с источниками данных.

Маршруты:
    GET    /api/datasources
    POST   /api/datasources
    POST   /api/datasources/upload
    POST   /api/datasources/link
    GET    /api/datasources/<id>
    PUT    /api/datasources/<id>
    DELETE /api/datasources/<id>
    POST   /api/datasources/<id>/test
    GET    /api/datasources/<id>/tables
    POST   /api/datasources/<id>/replace-file
    PUT    /api/datasources/<id>/connection
    PUT    /api/datasources/<id>/link-path
"""

import json
import os

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database.db import db
from app.models import DataSource, DataSourceCategory, Dataset, DatasetField
from app.auth.decorators import role_required
from app.services import datasource_service as ds_service


datasource_bp = Blueprint(
    "datasources",
    __name__,
    url_prefix="/api/datasources"
)

EDITOR_ROLES = ("admin", "expert")


def _add_dataset_for_file(
    ds: DataSource,
    name: str,
    sheet_name: str | None,
) -> Dataset:
    """
    Создаёт один датасет для файлового источника + поля по инспекции.
    Для xlsx sheet_name хранится в sql_query (он же используется как
    «селектор» при чтении).
    """
    fields_info = ds_service.inspect_dataset(ds, query=sheet_name)

    dataset = Dataset(
        datasource_id=ds.id,
        name=name,
        sql_query=sheet_name,  # None для csv; имя листа для xlsx
    )
    db.session.add(dataset)
    db.session.flush()

    for info in fields_info:
        db.session.add(DatasetField(
            dataset_id=dataset.id,
            name=info["name"],
            data_type=info["data_type"],
        ))

    return dataset


def _auto_create_file_datasets(ds: DataSource, default_name: str) -> None:
    """
    Создаёт датасеты для файлового источника.

    Логика:
      - CSV → один датасет с именем default_name.
      - XLSX → по датасету на каждый лист, имя = имя листа.
        Если файл без листов (теоретически невозможно) — поднимаем ошибку.

    Транзакция: вызывающий код решает, commit или rollback.
    """
    path = ds.connection_string

    if ds_service.is_excel_file(path):
        sheets = ds_service.list_excel_sheets(path)
        if not sheets:
            raise ValueError("В Excel-файле нет листов")

        for sheet in sheets:
            _add_dataset_for_file(ds, name=sheet, sheet_name=sheet)
        return

    # csv (и .csv-варианты)
    _add_dataset_for_file(ds, name=default_name, sheet_name=None)


def _default_dataset_name_from_path(path: str) -> str:
    """Имя файла без uuid-префикса и расширения."""
    base = os.path.basename(path)
    if "__" in base:
        base = base.split("__", 1)[-1]
    name, _ = os.path.splitext(base)
    return name or "Набор данных"


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
    """
    multipart/form-data: file, name?, category_id?

    После создания источника:
      - для CSV создаётся один датасет с именем файла без расширения;
      - для XLSX создаётся по датасету на каждый лист, имя = имя листа.
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
    db.session.flush()  # нужен id источника для FK на датасет

    try:
        _auto_create_file_datasets(
            ds,
            default_name=_default_dataset_name_from_path(saved_path),
        )
    except (ValueError, OSError) as e:
        db.session.rollback()
        ds_service.remove_file_if_exists(saved_path)
        return jsonify({
            "message": f"Не удалось разобрать файл: {e}"
        }), 400

    db.session.commit()
    return jsonify(ds.to_dict()), 201


@datasource_bp.route("/link", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_link_datasource():
    """
    Создаёт источник csv_link + автоматически датасеты по содержимому
    файла (один для CSV, по одному на лист для XLSX).
    """
    data = request.json or {}

    name = (data.get("name") or "").strip()
    path = (data.get("path") or "").strip()

    if not name:
        return jsonify({"message": "Укажите название источника"}), 400
    if not path:
        return jsonify({"message": "Укажите путь к файлу"}), 400

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
    db.session.flush()

    try:
        _auto_create_file_datasets(
            ds,
            default_name=_default_dataset_name_from_path(path),
        )
    except (ValueError, OSError) as e:
        db.session.rollback()
        return jsonify({
            "message": f"Не удалось разобрать файл: {e}"
        }), 400

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

    # Раньше тут была защита «нельзя удалить, если есть датасеты».
    # Для файловых источников это бессмысленно: датасеты создаются
    # автоматически и удаляются вместе с источником каскадом. Поэтому
    # для файловых разрешаем удаление вместе со всеми датасетами.
    # Для SQL — оставляем защиту (там пользователь сам управляет датасетами).
    if ds.type not in ("csv", "csv_link") and ds.datasets:
        return jsonify({
            "message": "Нельзя удалить источник: есть связанные наборы данных"
        }), 409

    if ds.type == "csv":
        ds_service.remove_file_if_exists(ds.connection_string)

    db.session.delete(ds)
    db.session.commit()

    return jsonify({"message": "Удалено"})


@datasource_bp.route("/<int:ds_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_datasource(ds_id):
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
    """
    Заменяет файл в источнике типа csv.

    Совместимость проверяется так: каждый существующий датасет (он
    привязан к листу, если xlsx) должен находиться в новом файле и иметь
    все требуемые столбцы. Если у xlsx-датасета был лист «Q1», а в новом
    файле его нет — обновление отклоняется.
    """
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

    try:
        new_path = ds_service.save_uploaded_file(file)
    except (OSError, ValueError) as e:
        return jsonify({"message": f"Ошибка сохранения: {e}"}), 400

    old_path = ds.connection_string
    ds.connection_string = new_path

    try:
        problems = _check_file_compat(ds, new_path)
        if problems:
            ds.connection_string = old_path
            ds_service.remove_file_if_exists(new_path)
            return jsonify({
                "message": "Новый файл несовместим:\n" + "\n".join(problems)
            }), 400
    except (ValueError, OSError) as e:
        ds.connection_string = old_path
        ds_service.remove_file_if_exists(new_path)
        return jsonify({"message": f"Не удалось прочитать файл: {e}"}), 400

    ds_service.remove_file_if_exists(old_path)
    db.session.commit()

    return jsonify({"message": "Файл обновлён", "datasource": ds.to_dict()})


@datasource_bp.route("/<int:ds_id>/link-path", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_link_path(ds_id):
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

    old_path = ds.connection_string
    ds.connection_string = new_path

    try:
        problems = _check_file_compat(ds, new_path)
        if problems:
            ds.connection_string = old_path
            return jsonify({
                "message": "Файл несовместим:\n" + "\n".join(problems)
            }), 400
    except (ValueError, OSError) as e:
        ds.connection_string = old_path
        return jsonify({"message": f"Не удалось прочитать файл: {e}"}), 400

    db.session.commit()
    return jsonify({"message": "Путь обновлён", "datasource": ds.to_dict()})


def _check_file_compat(ds: DataSource, new_path: str) -> list[str]:
    """
    Проверяет, что в новом файле есть все нужные столбцы для каждого
    существующего датасета источника. Возвращает список текстовых
    описаний проблем (пустой = всё ок).

    Для xlsx учитываем имя листа (хранится в dataset.sql_query).
    """
    import pandas as pd

    problems: list[str] = []
    is_xlsx = ds_service.is_excel_file(new_path)

    available_sheets: set[str] = set()
    if is_xlsx:
        available_sheets = set(ds_service.list_excel_sheets(new_path))

    for d in ds.datasets:
        required = {f.name for f in d.fields}
        if is_xlsx:
            sheet = d.sql_query
            if sheet and sheet not in available_sheets:
                problems.append(
                    f"в новом файле нет листа «{sheet}» "
                    f"(требуется для набора данных «{d.name}»)"
                )
                continue
            new_df = pd.read_excel(new_path, sheet_name=sheet)
        else:
            new_df = pd.read_csv(new_path)

        missing = required - set(new_df.columns)
        if missing:
            problems.append(
                f"в наборе данных «{d.name}» отсутствуют столбцы: "
                f"{', '.join(sorted(missing))}"
            )

    return problems


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
