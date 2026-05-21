"""
Сервис для работы с источниками данных.

Поддерживаемые типы (DataSource.type):
    - "csv"      — загруженный CSV/Excel-файл (хранится в uploads/)
    - "csv_link" — CSV/Excel-файл «по ссылке»: connection_string хранит путь
                   к существующему файлу на сервере; файл не копируется и
                   не удаляется системой.
    - "postgres" — внешняя БД PostgreSQL
    - "mysql"    — внешняя БД MySQL

Для Excel-файлов поддерживается несколько листов:
    - функция list_excel_sheets(path) возвращает имена листов;
    - inspect_dataset / read_dataset для xlsx используют параметр `query`
      датасета как имя листа (для csv `query` всегда None).
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

FILE_TYPES = ("csv", "csv_link")
EXCEL_EXTENSIONS = ("xls", "xlsx")


# --------------------------------------------------------------------------
# Файлы
# --------------------------------------------------------------------------

def is_allowed_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_FILE_EXTENSIONS"]


def _file_extension(path: str) -> str:
    """Возвращает расширение файла без точки и в нижнем регистре."""
    _, ext = os.path.splitext(path)
    return ext.lstrip(".").lower()


def is_excel_file(path: str) -> bool:
    return _file_extension(path) in EXCEL_EXTENSIONS


def save_uploaded_file(file: FileStorage) -> str:
    """
    Сохраняет загруженный файл на диск с уникальным именем.
    Возвращает абсолютный путь — он попадёт в DataSource.connection_string.

    Особенность: secure_filename из Werkzeug по умолчанию вырезает не-ASCII
    символы. Для кириллических имён («Данные.xlsx») он съест и название,
    и расширение. Поэтому расширение мы вытаскиваем из исходного
    file.filename ДО санитизации и приклеиваем его к итоговому имени.
    """
    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)

    _, ext = os.path.splitext(file.filename or "")
    ext = (ext or "").lower()

    safe_full = secure_filename(file.filename or "")
    safe_base, _ = os.path.splitext(safe_full)
    if not safe_base:
        safe_base = "file"

    unique_name = f"{uuid.uuid4().hex}__{safe_base}{ext}"
    full_path = os.path.join(upload_dir, unique_name)

    file.save(full_path)
    return full_path


def remove_file_if_exists(path: str) -> None:
    if path and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass


def validate_external_file_path(path: str) -> tuple[bool, str]:
    """Проверяет путь для type='csv_link'."""
    if not path:
        return False, "Путь не указан"

    if not os.path.isabs(path):
        return False, "Укажите абсолютный путь к файлу"

    if not os.path.isfile(path):
        return False, f"Файл не найден: {path}"

    if not is_allowed_file(path):
        return False, "Поддерживаются только файлы CSV, XLS, XLSX"

    # Проверка читаемости — пробуем открыть. Для Excel читаем первый
    # лист, чтобы не тащить весь файл в память при валидации.
    try:
        if is_excel_file(path):
            sheets = list_excel_sheets(path)
            if not sheets:
                return False, "В Excel-файле нет листов"
            _read_file_to_df(path, nrows=1, sheet_name=sheets[0])
        else:
            _read_file_to_df(path, nrows=1)
    except (ValueError, OSError, pd.errors.ParserError) as e:
        return False, f"Файл невозможно прочитать: {e}"

    return True, "OK"


# --------------------------------------------------------------------------
# Чтение CSV/Excel
# --------------------------------------------------------------------------

def list_excel_sheets(file_path: str) -> list[str]:
    """
    Возвращает имена листов Excel-файла.
    pd.ExcelFile читает только метаданные, не загружая данные листов.
    """
    if not is_excel_file(file_path):
        return []
    with pd.ExcelFile(file_path) as xf:
        return list(xf.sheet_names)


def _read_file_to_df(
    file_path: str,
    nrows: Optional[int] = None,
    sheet_name: Optional[str] = None,
) -> pd.DataFrame:
    """
    Читает CSV или Excel в DataFrame.
    Для Excel параметр sheet_name указывает конкретный лист (по умолчанию
    берётся первый лист).
    """
    ext = _file_extension(file_path)

    if ext == "csv":
        try:
            return pd.read_csv(file_path, nrows=nrows)
        except UnicodeDecodeError:
            return pd.read_csv(file_path, nrows=nrows, encoding="cp1251")

    if ext in EXCEL_EXTENSIONS:
        # Если лист не указан — берём первый (pd.read_excel так и делает
        # по умолчанию). Если указан несуществующий — read_excel поднимет
        # ValueError, что мы поймаем выше.
        if sheet_name is None:
            return pd.read_excel(file_path, nrows=nrows)
        return pd.read_excel(file_path, sheet_name=sheet_name, nrows=nrows)

    raise ValueError(f"Неподдерживаемое расширение: {ext or '<нет>'}")


# --------------------------------------------------------------------------
# Подключение к внешним БД
# --------------------------------------------------------------------------

def _build_sql_engine(datasource):
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
    """Возвращает (успех, сообщение)."""
    try:
        if datasource.type in FILE_TYPES:
            if not os.path.isfile(datasource.connection_string):
                return False, "Файл не найден"
            # Для xlsx проверяем что есть хотя бы один лист и он читается
            if is_excel_file(datasource.connection_string):
                sheets = list_excel_sheets(datasource.connection_string)
                if not sheets:
                    return False, "В Excel-файле нет листов"
                _read_file_to_df(
                    datasource.connection_string,
                    nrows=1,
                    sheet_name=sheets[0],
                )
            else:
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
    Список «таблиц»:
      - csv: одна виртуальная таблица с именем файла;
      - xlsx: имена листов;
      - SQL: реальные таблицы и представления.
    """
    if datasource.type in FILE_TYPES:
        path = datasource.connection_string
        if is_excel_file(path):
            return list_excel_sheets(path)
        base = os.path.basename(path)
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

    Для CSV: query игнорируется.
    Для Excel: query содержит имя листа (т.к. в одном файле может быть
    несколько листов, каждый — свой датасет).
    Для SQL: см. ветку внутри.
    """
    if datasource.type in FILE_TYPES:
        path = datasource.connection_string
        if is_excel_file(path):
            sheet = query or None
            df = _read_file_to_df(path, nrows=PREVIEW_ROW_LIMIT, sheet_name=sheet)
        else:
            df = _read_file_to_df(path, nrows=PREVIEW_ROW_LIMIT)
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

    Для csv: читаем файл целиком.
    Для xlsx: query = имя листа, читаем именно этот лист.
    Для SQL: query — SELECT-запрос или сгенерированное SELECT * FROM <table>.
    """
    if datasource.type in FILE_TYPES:
        path = datasource.connection_string
        if is_excel_file(path):
            sheet = query or None
            return _read_file_to_df(path, nrows=limit, sheet_name=sheet)
        return _read_file_to_df(path, nrows=limit)

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
