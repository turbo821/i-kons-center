"""
Сервис для работы с источниками данных.

Поддерживаемые типы (DataSource.type):
    - "csv"      — загруженный CSV/Excel-файл (хранится в uploads/)
    - "csv_link" — CSV/Excel-файл «по ссылке»: connection_string хранит путь
                   к существующему файлу на сервере; файл не копируется и
                   не удаляется системой. При каждом чтении данные берутся
                   свежими (полезно, если файл регулярно обновляется
                   внешним процессом).
    - "postgres" — внешняя БД PostgreSQL
    - "mysql"    — внешняя БД MySQL

Публичный API:
    - test_connection(datasource)          → (ok, message)
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


PREVIEW_ROW_LIMIT = 1000
TYPE_INSPECTION_SAMPLE = 100

# Множество типов источников, использующих файловое чтение через pandas.
# Используется во многих местах — выделили константу, чтобы не плодить
# дубли "if t == csv or t == csv_link".
FILE_TYPES = ("csv", "csv_link")


# --------------------------------------------------------------------------
# Файлы
# --------------------------------------------------------------------------

def is_allowed_file(filename: str) -> bool:
    """Проверка расширения по белому списку из конфига."""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_FILE_EXTENSIONS"]


def save_uploaded_file(file: FileStorage) -> str:
    """
    Сохраняет загруженный файл на диск с уникальным именем.
    Возвращает абсолютный путь — он попадёт в DataSource.connection_string.

    Особенность: secure_filename из Werkzeug по умолчанию вырезает не-ASCII
    символы. Для кириллических имён ("Данные.xlsx") он съест и название,
    и иногда расширение (если на расширении остаётся только латиница без
    точки). Поэтому расширение мы вытаскиваем из исходного file.filename
    ДО санитизации и приклеиваем его к итоговому имени отдельно.
    """
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)

    # Расширение берём из исходного имени, ДО secure_filename
    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or "").lower()  # ".xlsx", ".csv", ".xls" или ""

    # Санитизированное «имя без расширения». Может оказаться пустым
    # (например, для имени «Данные.xlsx» → секьюр-фильтр оставит "xlsx",
    # а splitext по этому уже даст ("xlsx", "")).
    safe_full = secure_filename(file.filename or "")
    safe_base, _ = os.path.splitext(safe_full)
    if not safe_base:
        safe_base = "file"

    # Финальное имя: <uuid>__<имя_без_расширения><расширение>
    unique_name = f"{uuid.uuid4().hex}__{safe_base}{ext}"
    full_path = os.path.join(upload_dir, unique_name)

    file.save(full_path)
    return full_path


def remove_file_if_exists(path: str) -> None:
    """Безопасно удаляет файл (используется только для type='csv')."""
    if path and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass


def validate_external_file_path(path: str) -> tuple[bool, str]:
    """
    Проверяет, что указанный путь существует, является файлом, имеет
    разрешённое расширение и может быть прочитан pandas.

    Используется для type='csv_link', где пользователь сам вводит путь.
    Возвращает (ok, message).
    """
    if not path:
        return False, "Путь не указан"

    if not os.path.isabs(path):
        return False, "Укажите абсолютный путь к файлу"

    if not os.path.isfile(path):
        return False, f"Файл не найден: {path}"

    if not is_allowed_file(path):
        return False, "Поддерживаются только файлы CSV, XLS, XLSX"

    try:
        _read_file_to_df(path, nrows=1)
    except (ValueError, OSError, pd.errors.ParserError) as e:
        return False, f"Файл невозможно прочитать: {e}"

    return True, "OK"


# --------------------------------------------------------------------------
# Чтение CSV/Excel
# --------------------------------------------------------------------------

def _read_file_to_df(
    file_path: str,
    nrows: Optional[int] = None
) -> pd.DataFrame:
    """Читает CSV или Excel в DataFrame в зависимости от расширения."""
    ext = file_path.rsplit(".", 1)[1].lower()

    if ext == "csv":
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
    connection_string хранит JSON: {host, port, database, user, password}.
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
    return create_engine(uri, pool_pre_ping=True)


# --------------------------------------------------------------------------
# Публичный API
# --------------------------------------------------------------------------

def test_connection(datasource) -> tuple[bool, str]:
    """Проверка работоспособности подключения. Возвращает (успех, сообщение)."""
    try:
        if datasource.type in FILE_TYPES:
            if not os.path.isfile(datasource.connection_string):
                return False, "Файл не найден"
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
      - для csv / csv_link: одна виртуальная «таблица» с именем файла;
      - для SQL: реальные таблицы и представления через INSPECT.
    """
    if datasource.type in FILE_TYPES:
        base = os.path.basename(datasource.connection_string)
        # Для uploaded-файлов убираем uuid-префикс «hash__»
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

    Для CSV-подобных: query игнорируется, тип определяем через pandas.
    Для SQL: смотри комментарий внутри ветки.
    """
    if datasource.type in FILE_TYPES:
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
            # Читаем выборку через pandas — он корректно определит dtype'ы
            # по фактическим значениям. cursor.description нельзя
            # использовать для агрегаций — он возвращает type_code как
            # число, и приведение к строке даёт мусор.
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

    Для csv_link: при каждом вызове читаем файл свежим, что и обеспечивает
    «живое» обновление данных при внешних правках файла.
    """
    if datasource.type in FILE_TYPES:
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
