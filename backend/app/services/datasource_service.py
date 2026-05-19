"""
Сервис для работы с источниками данных.

Абстрагирует три типа подключений (csv, postgres, mysql) под единый интерфейс:
    - test_connection(datasource)          → bool
    - list_tables(datasource)              → list[str]
    - read_dataset(datasource, query)      → pandas.DataFrame
    - inspect_dataset(datasource, query)   → list[{name, data_type}]
"""

import os
import json
import uuid
from typing import Optional

import pandas as pd
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
from flask import current_app

from app.services.type_mapping import (
    pandas_dtype_to_internal,
    sql_type_to_internal,
)

# Лимит строк для пробного чтения и предпросмотра
PREVIEW_ROW_LIMIT = 1000

# Сколько строк читать для определения типа поля в результирующем запросе.
# Маленькое число держит inspect_dataset быстрым, но 100 строк уже достаточно
# для надёжной эвристики (NaN/целые/дробные/даты).
TYPE_INSPECTION_SAMPLE = 100


# --------------------------------------------------------------------------
# Загрузка файлов
# --------------------------------------------------------------------------

def is_allowed_file(filename: str) -> bool:
    """Проверка расширения по белому списку из конфига."""
    if "." not in filename:
        return False

    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_FILE_EXTENSIONS"]


def save_uploaded_file(file: FileStorage) -> str:
    """
    Сохраняет файл на диск с уникальным именем (избегаем коллизий).
    Возвращает абсолютный путь, который попадёт в DataSource.connection_string.
    """
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)

    original_name = secure_filename(file.filename)
    if not original_name:
        raise ValueError("Имя файла недопустимо")

    # Уникализация: <uuid>__<original_name>
    unique_name = f"{uuid.uuid4().hex}__{original_name}"
    full_path = os.path.join(upload_dir, unique_name)

    file.save(full_path)
    return full_path


def remove_file_if_exists(path: str) -> None:
    """Безопасно удаляет файл (используется при удалении DataSource)."""
    if path and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            # Не критично: запись в БД важнее физического файла
            pass


# --------------------------------------------------------------------------
# Чтение CSV/Excel в DataFrame
# --------------------------------------------------------------------------

def _read_file_to_df(
    file_path: str,
    nrows: Optional[int] = None
) -> pd.DataFrame:
    """Читает CSV или Excel в DataFrame в зависимости от расширения."""
    ext = file_path.rsplit(".", 1)[1].lower()

    if ext == "csv":
        # Пробуем utf-8, при ошибке — cp1251 (распространено в РФ-выгрузках)
        try:
            return pd.read_csv(file_path, nrows=nrows)
        except UnicodeDecodeError:
            return pd.read_csv(file_path, nrows=nrows, encoding="cp1251")

    if ext in ("xls", "xlsx"):
        return pd.read_excel(file_path, nrows=nrows)

    raise ValueError(f"Неподдерживаемое расширение: {ext}")


# --------------------------------------------------------------------------
# Подключение к внешним БД
# --------------------------------------------------------------------------

def _build_sql_engine(datasource):
    """
    Создаёт SQLAlchemy engine для внешней БД.
    connection_string хранит JSON: {host, port, database, user, password}
    """
    try:
        params = json.loads(datasource.connection_string)
    except json.JSONDecodeError as e:
        raise ValueError("Параметры подключения повреждены (не JSON)") from e

    driver = {
        "postgres": "postgresql+psycopg2",
        "mysql": "mysql+pymysql",
    }.get(datasource.type)

    if not driver:
        raise ValueError(
            f"Неподдерживаемый тип источника: {datasource.type}"
        )

    uri = (
        f"{driver}://{params['user']}:{params['password']}"
        f"@{params['host']}:{params['port']}/{params['database']}"
    )

    # pool_pre_ping — проверка живого соединения перед запросом
    return create_engine(uri, pool_pre_ping=True)


# --------------------------------------------------------------------------
# Публичный API сервиса
# --------------------------------------------------------------------------

def test_connection(datasource) -> tuple[bool, str]:
    """Проверка работоспособности подключения. Возвращает (успех, сообщение)."""
    try:
        if datasource.type == "csv":
            if not os.path.isfile(datasource.connection_string):
                return False, "Файл не найден на сервере"
            # Прочитать одну строку — убедиться, что файл валидный
            _read_file_to_df(datasource.connection_string, nrows=1)
            return True, "OK"

        if datasource.type in ("postgres", "mysql"):
            engine = _build_sql_engine(datasource)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, "OK"

        return False, f"Неизвестный тип: {datasource.type}"

    except SQLAlchemyError as e:
        return False, f"Ошибка подключения к БД: {e.__class__.__name__}"
    except (ValueError, OSError, KeyError) as e:
        return False, str(e)


def list_tables(datasource) -> list[str]:
    """
    Возвращает список «таблиц» источника:
      - для csv: одна виртуальная «таблица» с именем файла
      - для SQL: реальные таблицы и представления через INSPECT
    """
    if datasource.type == "csv":
        base = os.path.basename(datasource.connection_string)
        # Убираем uuid-префикс для отображения
        display_name = base.split("__", 1)[-1] if "__" in base else base
        return [display_name]

    if datasource.type in ("postgres", "mysql"):
        engine = _build_sql_engine(datasource)
        inspector = inspect(engine)
        tables = inspector.get_table_names() + inspector.get_view_names()
        return sorted(tables)

    return []


def inspect_dataset(
    datasource,
    query: Optional[str],
    table_name: Optional[str] = None,
) -> list[dict]:
    """
    Возвращает список полей (с типами) для будущего датасета.

    Для CSV: query игнорируется, читаем файл целиком и определяем тип
    через pandas.

    Для SQL:
      - если задан table_name → берём метаданные таблицы (быстро, без LIMIT)
      - если задан query → выполняем его с LIMIT и определяем тип через
        pandas-dtype на результирующем DataFrame.
    """
    if datasource.type == "csv":
        df = _read_file_to_df(
            datasource.connection_string,
            nrows=PREVIEW_ROW_LIMIT
        )
        return [
            {"name": col, "data_type": pandas_dtype_to_internal(df[col])}
            for col in df.columns
        ]

    if datasource.type in ("postgres", "mysql"):
        engine = _build_sql_engine(datasource)

        if table_name:
            inspector = inspect(engine)
            cols = inspector.get_columns(table_name)
            return [
                {
                    "name": c["name"],
                    "data_type": sql_type_to_internal(c["type"]),
                }
                for c in cols
            ]

        if query:
            # Читаем небольшую выборку через pandas — он сам приведёт
            # колонки к корректным dtype'ам.
            base = query.rstrip(";").rstrip()
            wrapped = (
                f"SELECT * FROM ({base}) AS sub LIMIT {TYPE_INSPECTION_SAMPLE}"
            )
            df = pd.read_sql(text(wrapped), engine)
            return [
                {"name": col, "data_type": pandas_dtype_to_internal(df[col])}
                for col in df.columns
            ]

        raise ValueError("Нужно указать table_name или query")

    raise ValueError(f"Неизвестный тип источника: {datasource.type}")


def read_dataset(
    datasource,
    query: Optional[str],
    table_name: Optional[str] = None,
    limit: Optional[int] = PREVIEW_ROW_LIMIT,
) -> pd.DataFrame:
    """
    Читает данные датасета в pandas.DataFrame.
    Используется для предпросмотра и для агрегации в виджетах.
    """
    if datasource.type == "csv":
        return _read_file_to_df(datasource.connection_string, nrows=limit)

    if datasource.type in ("postgres", "mysql"):
        engine = _build_sql_engine(datasource)

        if table_name:
            sql = f'SELECT * FROM "{table_name}"'
        elif query:
            sql = query.rstrip(";")
        else:
            raise ValueError("Нужно указать table_name или query")

        if limit:
            sql = f"SELECT * FROM ({sql}) AS sub LIMIT {int(limit)}"

        return pd.read_sql(text(sql), engine)

    raise ValueError(f"Неизвестный тип источника: {datasource.type}")
