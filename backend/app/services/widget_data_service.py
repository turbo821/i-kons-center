"""
Сервис агрегации данных для виджетов.

Основной публичный метод: aggregate_widget_data(widget) → dict
    {
      "rows": [...],          # данные для графика (recharts-формат)
      "metric_keys": [...],   # имена столбцов-метрик
      "dimension_keys": [...] # имена столбцов-измерений
    }

Все агрегации выполняются через pandas для единообразия и независимости
от типа источника данных (CSV/Postgres/MySQL — обработка одинакова).
"""

from datetime import datetime
from typing import Optional

import pandas as pd

from app.models import Widget
from app.services import datasource_service as ds_service


# Лимит строк, которые читаем из источника для агрегации.
# Для диплома хватит запасом; в проде должны быть SQL-агрегации.
AGGREGATION_ROW_LIMIT = 100_000


# Допустимые операторы фильтров и их реализация над pandas.Series
FILTER_OPERATORS = {
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "not_in",
    "contains",
    "between",
}


# Допустимые типы агрегации с их реализацией pandas
AGGREGATION_FUNCS = {
    "sum": "sum",
    "avg": "mean",
    "min": "min",
    "max": "max",
    "count": "count",
    "count_distinct": "nunique",
}


# ---------------------------------------------------------------------------
# Приведение значения фильтра к типу поля
# ---------------------------------------------------------------------------

def _cast_filter_value(value: str, data_type: str):
    """
    Приводит строковое значение фильтра к нужному типу.
    Возвращает None если значение пустое.
    """
    if value is None or value == "":
        return None

    try:
        if data_type == "integer":
            return int(value)
        if data_type == "float":
            return float(value)
        if data_type == "boolean":
            return value.lower() in ("true", "1", "yes", "да")
        if data_type in ("date", "datetime"):
            return pd.to_datetime(value, errors="coerce")
        return str(value)
    except (ValueError, TypeError):
        return value  # оставим как есть; фильтр просто не сработает


# ---------------------------------------------------------------------------
# Применение одного фильтра к DataFrame
# ---------------------------------------------------------------------------

def _apply_filter(df: pd.DataFrame, filter_obj) -> pd.DataFrame:
    """Возвращает DataFrame с применённым фильтром."""
    field_name = filter_obj.field.name
    if field_name not in df.columns:
        return df  # поле могло удалиться — пропускаем фильтр

    series = df[field_name]
    data_type = filter_obj.field.data_type
    op = filter_obj.operator
    raw_value = filter_obj.value

    # Спецоператоры с многозначным value (in, between)
    if op in ("in", "not_in"):
        values = [
            _cast_filter_value(v.strip(), data_type)
            for v in (raw_value or "").split(",")
            if v.strip()
        ]
        if not values:
            return df
        mask = series.isin(values)
        return df[~mask] if op == "not_in" else df[mask]

    if op == "between":
        parts = [v.strip() for v in (raw_value or "").split(",")]
        if len(parts) != 2:
            return df
        lo = _cast_filter_value(parts[0], data_type)
        hi = _cast_filter_value(parts[1], data_type)
        if lo is None or hi is None:
            return df
        if data_type in ("date", "datetime"):
            series = pd.to_datetime(series, errors="coerce")
        return df[(series >= lo) & (series <= hi)]

    # Одиночное value
    value = _cast_filter_value(raw_value, data_type)
    if value is None:
        return df

    if op == "contains":
        # contains имеет смысл только для строк
        return df[series.astype(str).str.contains(str(value), case=False, na=False)]

    # Для дат — обеспечим корректное сравнение
    if data_type in ("date", "datetime") and not pd.api.types.is_datetime64_any_dtype(series):
        series = pd.to_datetime(series, errors="coerce")

    if op == "eq":
        return df[series == value]
    if op == "neq":
        return df[series != value]
    if op == "gt":
        return df[series > value]
    if op == "gte":
        return df[series >= value]
    if op == "lt":
        return df[series < value]
    if op == "lte":
        return df[series <= value]

    return df  # неизвестный оператор — игнорируем


# ---------------------------------------------------------------------------
# Сериализация значений в JSON-совместимый формат
# ---------------------------------------------------------------------------

def _to_json_value(value):
    """Преобразует значение pandas в чистый Python-тип для JSON."""
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if hasattr(value, "item"):  # numpy scalar
        return value.item()
    return value


# ---------------------------------------------------------------------------
# Основная агрегация
# ---------------------------------------------------------------------------

def aggregate_widget_data(widget: Widget) -> dict:
    """
    Главная функция: возвращает данные виджета, готовые для отрисовки
    на frontend (recharts-совместимый формат).

    Алгоритм:
    1. Прочитать датасет в DataFrame
    2. Применить фильтры
    3. Сгруппировать по dimensions
    4. Применить агрегации metrics
    5. Вернуть в plain-dict формате
    """
    if not widget.dataset:
        raise ValueError("У виджета нет датасета")

    # 1. Чтение исходных данных
    df = ds_service.read_dataset(
        widget.dataset.datasource,
        query=widget.dataset.sql_query,
        limit=AGGREGATION_ROW_LIMIT,
    )

    # 2. Применяем все фильтры по порядку
    for f in widget.filters:
        df = _apply_filter(df, f)

    metric_keys = []
    dimension_keys = []

    # 3. Группировка и агрегация
    if widget.dimensions and widget.metrics:
        # Стандартный случай: group by dimensions, agg metrics
        dim_cols = [d.field.name for d in widget.dimensions]
        dimension_keys = dim_cols[:]

        # Конвертация дат для группировки в строку YYYY-MM-DD,
        # иначе pandas будет группировать по timestamp до миллисекунд
        for d in widget.dimensions:
            if d.field.data_type in ("date", "datetime"):
                col = d.field.name
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")

        # Собираем агрегации в виде {output_name: (input_col, func)}
        agg_spec = {}
        for m in widget.metrics:
            output_name = m.name
            metric_keys.append(output_name)
            input_col = m.field.name
            func = AGGREGATION_FUNCS.get(m.aggregation_type)
            if not func:
                continue
            agg_spec[output_name] = pd.NamedAgg(column=input_col, aggfunc=func)

        if not agg_spec:
            return {"rows": [], "metric_keys": [], "dimension_keys": dimension_keys}

        # Уберём строки с пустыми группирующими полями
        df = df.dropna(subset=dim_cols, how="any")

        grouped = df.groupby(dim_cols, dropna=False, as_index=False).agg(**agg_spec)

        # Сортируем по первой метрике по убыванию (для bar/pie это полезно)
        if metric_keys:
            grouped = grouped.sort_values(by=metric_keys[0], ascending=False)

        rows = [
            {col: _to_json_value(row[col]) for col in grouped.columns}
            for _, row in grouped.iterrows()
        ]
        return {
            "rows": rows,
            "metric_keys": metric_keys,
            "dimension_keys": dimension_keys,
        }

    # 4. Только метрики (без измерений) — карточка KPI: одно число на метрику
    if widget.metrics and not widget.dimensions:
        result_row = {}
        for m in widget.metrics:
            metric_keys.append(m.name)
            col = m.field.name
            func = AGGREGATION_FUNCS.get(m.aggregation_type)
            if col not in df.columns or not func:
                result_row[m.name] = None
                continue
            series = df[col]
            try:
                value = getattr(series, func)()
            except (TypeError, ValueError):
                value = None
            result_row[m.name] = _to_json_value(value)

        return {
            "rows": [result_row],
            "metric_keys": metric_keys,
            "dimension_keys": [],
        }

    # 5. Нет ни метрик, ни измерений — таблица «как есть» (с лимитом)
    return {
        "rows": [
            {col: _to_json_value(row[col]) for col in df.columns}
            for _, row in df.head(500).iterrows()
        ],
        "metric_keys": [],
        "dimension_keys": list(df.columns),
    }
