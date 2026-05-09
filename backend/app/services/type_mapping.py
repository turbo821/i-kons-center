"""
Маппинг типов из источников данных в единые внутренние типы системы.

Внутренние типы (поле DatasetField.data_type):
    'string', 'integer', 'float', 'boolean', 'date', 'datetime'
"""

import pandas as pd
from pandas.api import types as ptypes


def pandas_dtype_to_internal(series: pd.Series) -> str:
    """
    Определяет внутренний тип по объекту pandas.Series.
    Используется при чтении CSV/Excel.
    """
    if ptypes.is_bool_dtype(series):
        return "boolean"

    if ptypes.is_integer_dtype(series):
        return "integer"

    if ptypes.is_float_dtype(series):
        return "float"

    if ptypes.is_datetime64_any_dtype(series):
        return "datetime"

    # Эвристика: попробовать распарсить как дату.
    # Если получилось — считаем датой, иначе строкой.
    if ptypes.is_object_dtype(series):
        non_null = series.dropna().head(20)
        if len(non_null) > 0:
            try:
                parsed = pd.to_datetime(
                    non_null,
                    errors="coerce",
                    format="mixed"
                )
                # Если 80%+ значений распарсились — это дата
                if parsed.notna().mean() >= 0.8:
                    return "datetime"
            except (ValueError, TypeError):
                pass

    return "string"


def sql_type_to_internal(sql_type) -> str:
    """
    Определяет внутренний тип по объекту SQLAlchemy TypeEngine
    (используется при подключении к внешним БД).
    """
    type_str = str(sql_type).upper()

    if "BOOL" in type_str:
        return "boolean"

    if any(t in type_str for t in ("INT", "SERIAL", "BIGINT", "SMALLINT")):
        return "integer"

    if any(t in type_str for t in ("FLOAT", "REAL", "DOUBLE", "NUMERIC", "DECIMAL")):
        return "float"

    if "TIMESTAMP" in type_str or "DATETIME" in type_str:
        return "datetime"

    if "DATE" in type_str:
        return "date"

    return "string"
