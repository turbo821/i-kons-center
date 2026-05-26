"""
REST API для наборов данных.

Политика для файловых источников (csv, csv_link):
  - датасет создаётся автоматически при создании источника
    (см. datasource_routes.upload_file_datasource / create_link_datasource);
  - вручную создавать и удалять датасет нельзя — у файлового источника
    есть ровно один логический датасет, привязанный к содержимому файла;
  - переименовать датасет можно (PUT /api/datasets/<id>).
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.database.db import db
from app.models import DataSource, Dataset, DatasetField
from app.auth.decorators import role_required, get_current_user_id
from app.services import datasource_service as ds_service
from app.services import access_service as access
from app.services.access_service import ENTITY_DATASOURCE


dataset_bp = Blueprint("datasets", __name__, url_prefix="/api/datasets")

EDITOR_ROLES = ("admin", "expert")

# Источники, где датасеты управляются системой (auto-create) и не могут
# создаваться/удаляться вручную.
FILE_LIKE_TYPES = ("csv", "csv_link")


def _sync_dataset_fields(dataset: Dataset, fields_info: list[dict]) -> None:
    """
    Синхронизирует поля датасета с результатом инспекции.
    Стратегия: полная замена.
    """
    for old in list(dataset.fields):
        db.session.delete(old)
    db.session.flush()

    for info in fields_info:
        field = DatasetField(
            dataset_id=dataset.id,
            name=info["name"],
            data_type=info["data_type"],
        )
        db.session.add(field)


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@dataset_bp.route("", methods=["GET"])
@jwt_required()
def list_datasets():
    """Опционально можно фильтровать по datasource_id."""
    q = db.session.query(Dataset)

    ds_id = request.args.get("datasource_id", type=int)
    if ds_id:
        q = q.filter_by(datasource_id=ds_id)

    # Оставляем только датасеты, чьи источники в доступных категориях.
    # Фильтруем через JOIN на data_sources по их category_id.
    user_id = get_current_user_id()
    viewable = access.viewable_category_ids(user_id, ENTITY_DATASOURCE)
    if not viewable:
        return jsonify([])

    q = q.join(DataSource, Dataset.datasource_id == DataSource.id)
    conditions = []
    real_ids = [c for c in viewable if c is not None]
    if real_ids:
        conditions.append(DataSource.category_id.in_(real_ids))
    if None in viewable:
        conditions.append(DataSource.category_id.is_(None))
    q = q.filter(db.or_(*conditions))

    items = q.order_by(Dataset.created_at.desc()).all()
    return jsonify([d.to_dict() for d in items])


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@dataset_bp.route("", methods=["POST"])
@role_required(*EDITOR_ROLES)
def create_dataset():
    """
    Body для SQL-источников:
    {
      "datasource_id": 1,
      "name": "Продажи 2024",
      "table_name": "sales"   // или
      "query": "SELECT ..."
    }

    Для файловых источников (csv / csv_link) ручное создание датасетов
    запрещено: датасет один и создаётся автоматически при создании
    источника.
    """
    data = request.json or {}

    if not data.get("datasource_id") or not data.get("name"):
        return jsonify({
            "message": "Поля 'datasource_id' и 'name' обязательны"
        }), 400

    ds = db.session.get(DataSource, data["datasource_id"])
    if ds is None:
        return jsonify({"message": "Источник данных не найден"}), 404

    # Создавать датасет можно только в источнике, доступном на редактирование
    denied = access.check_edit(get_current_user_id(), ENTITY_DATASOURCE, ds.category_id)
    if denied:
        return jsonify(denied[0]), denied[1]

    if ds.type in FILE_LIKE_TYPES:
        return jsonify({
            "message": (
                "Для файловых источников (CSV / Excel) набор данных "
                "создаётся автоматически при загрузке файла. "
                "Дополнительные наборы данных создавать нельзя."
            )
        }), 400

    table_name = data.get("table_name")
    user_query = data.get("query")

    if not (table_name or user_query):
        return jsonify({
            "message": "Для SQL-источников нужно указать table_name или query"
        }), 400

    try:
        fields_info = ds_service.inspect_dataset(
            ds,
            query=user_query,
            table_name=table_name,
        )
    except (ValueError, OSError) as e:
        return jsonify({
            "message": f"Не удалось проинспектировать данные: {e}"
        }), 400

    if not fields_info:
        return jsonify({
            "message": "Не удалось определить поля (пустой результат)"
        }), 400

    stored_query = user_query
    if not stored_query and table_name:
        stored_query = f'SELECT * FROM "{table_name}"'

    dataset = Dataset(
        datasource_id=ds.id,
        name=data["name"],
        sql_query=stored_query,
    )
    db.session.add(dataset)
    db.session.flush()

    _sync_dataset_fields(dataset, fields_info)
    db.session.commit()

    return jsonify(dataset.to_dict(include_fields=True)), 201


# ---------------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------------
@dataset_bp.route("/<int:dataset_id>", methods=["GET"])
@jwt_required()
def get_dataset(dataset_id):
    dataset = db.session.get(Dataset, dataset_id)
    if dataset is None:
        return jsonify({"message": "Не найдено"}), 404
    denied = access.check_dataset_view(get_current_user_id(), dataset)
    if denied:
        return jsonify(denied[0]), denied[1]
    return jsonify(dataset.to_dict(include_fields=True))


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@dataset_bp.route("/<int:dataset_id>", methods=["DELETE"])
@role_required(*EDITOR_ROLES)
def delete_dataset(dataset_id):
    dataset = db.session.get(Dataset, dataset_id)
    if dataset is None:
        return jsonify({"message": "Не найдено"}), 404

    denied = access.check_dataset_edit(get_current_user_id(), dataset)
    if denied:
        return jsonify(denied[0]), denied[1]

    # Защита: для файловых источников удаление через API запрещено.
    # Удалить датасет можно только удалив сам источник целиком.
    if dataset.datasource.type in FILE_LIKE_TYPES:
        return jsonify({
            "message": (
                "Нельзя удалить: для файловых источников набор данных "
                "управляется системой. Удалите источник целиком."
            )
        }), 409

    if dataset.widgets:
        return jsonify({
            "message": "Нельзя удалить: есть связанные виджеты"
        }), 409

    db.session.delete(dataset)
    db.session.commit()
    return jsonify({"message": "Удалено"})


# ---------------------------------------------------------------------------
# PREVIEW
# ---------------------------------------------------------------------------
@dataset_bp.route("/<int:dataset_id>/preview", methods=["GET"])
@jwt_required()
def preview_dataset(dataset_id):
    dataset = db.session.get(Dataset, dataset_id)
    if dataset is None:
        return jsonify({"message": "Не найдено"}), 404

    denied = access.check_dataset_view(get_current_user_id(), dataset)
    if denied:
        return jsonify(denied[0]), denied[1]

    limit = request.args.get("limit", default=50, type=int)
    limit = max(1, min(limit, 500))

    try:
        df = ds_service.read_dataset(
            dataset.datasource,
            query=dataset.sql_query,
            limit=limit,
        )
    except (ValueError, OSError) as e:
        return jsonify({"message": str(e)}), 400

    df = df.where(df.notnull(), None)

    return jsonify({
        "columns": list(df.columns),
        "rows": df.astype(object).values.tolist(),
        "total_rows": len(df),
    })


# ---------------------------------------------------------------------------
# REFRESH FIELDS
# ---------------------------------------------------------------------------
@dataset_bp.route("/<int:dataset_id>/refresh", methods=["POST"])
@role_required(*EDITOR_ROLES)
def refresh_dataset_fields(dataset_id):
    dataset = db.session.get(Dataset, dataset_id)
    if dataset is None:
        return jsonify({"message": "Не найдено"}), 404

    denied = access.check_dataset_edit(get_current_user_id(), dataset)
    if denied:
        return jsonify(denied[0]), denied[1]

    try:
        fields_info = ds_service.inspect_dataset(
            dataset.datasource,
            query=dataset.sql_query,
        )
    except (ValueError, OSError) as e:
        return jsonify({"message": str(e)}), 400

    _sync_dataset_fields(dataset, fields_info)
    db.session.commit()

    return jsonify(dataset.to_dict(include_fields=True))

@dataset_bp.route("/<int:ds_id>", methods=["PUT"])
@role_required(*EDITOR_ROLES)
def update_dataset(ds_id):
    """
    Body:
    {
      "name": "...",
      "query": "SELECT ..."   (опционально, только для SQL-источников)
    }
    Для файловых источников можно менять только имя.
    """
    dataset = db.session.get(Dataset, ds_id)
    if dataset is None:
        return jsonify({"message": "Не найдено"}), 404

    denied = access.check_dataset_edit(get_current_user_id(), dataset)
    if denied:
        return jsonify(denied[0]), denied[1]

    data = request.json or {}

    # Имя можно менять всегда — даже если есть зависимые виджеты,
    # это безопасное переименование.
    if "name" in data:
        if not data["name"]:
            return jsonify({"message": "Имя не может быть пустым"}), 400
        dataset.name = data["name"]

    # query можно менять только для SQL-источников и только если
    # нет зависимых виджетов/метрик/измерений (потому что поля могут
    # переопределиться).
    if "query" in data:
        if dataset.datasource.type in FILE_LIKE_TYPES:
            return jsonify({
                "message": (
                    "Для файловых источников нельзя задать SQL-запрос: "
                    "набор данных строится по содержимому файла целиком."
                )
            }), 400

        has_widgets = bool(dataset.widgets)
        has_metrics = any(f.metrics for f in dataset.fields)
        has_dimensions = any(f.dimensions for f in dataset.fields)

        if has_widgets or has_metrics or has_dimensions:
            return jsonify({
                "message": (
                    "Нельзя менять запрос: к набору данных привязаны "
                    "виджеты, метрики или измерения"
                )
            }), 409

        if not data["query"]:
            return jsonify({"message": "query не может быть пустым"}), 400

        dataset.sql_query = data["query"]

        for f in list(dataset.fields):
            db.session.delete(f)
        db.session.flush()
        try:
            fields_info = ds_service.inspect_dataset(
                dataset.datasource, data["query"]
            )
        except (ValueError, OSError, KeyError) as e:
            db.session.rollback()
            return jsonify({
                "message": f"Не удалось определить поля: {e}"
            }), 400

        for info in fields_info:
            db.session.add(DatasetField(
                dataset_id=dataset.id,
                name=info["name"],
                data_type=info["data_type"],
            ))

    db.session.commit()
    return jsonify(dataset.to_dict(include_fields=True))
