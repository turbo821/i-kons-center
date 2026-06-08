"""
Сервис агрегации данных для виджетов.

Основной публичный метод: aggregate_widget_data(widget) → dict

Формат ответа (recharts-совместимый):
    {
      "rows": [...],            # данные для графика
      "metric_keys": [...],     # имена столбцов-метрик
      "dimension_keys": [...],  # имена измерений (для таблицы/легенды)
      "x_key": "...",           # поле для оси X (первое измерение) или None
      "series_keys": [...],     # имена серий для раскраски/легенды:
                                #   - при pivot по 2-му измерению — значения
                                #     второго+ измерений;
                                #   - иначе — имена метрик.
      "stacked": false          # подсказка фронту (не используется жёстко)
    }

Логика по измерениям:
  - 1 метрика + 2+ измерения  → pivot: ось = первое измерение,
    серии = комбинации значений остальных измерений.
  - неск. метрик + 1 измерение → серии = метрики (как раньше).
  - неск. метрик + 2+ измерений → берём только первое измерение как ось,
    серии = метрики (доп. измерения игнорируются, чтобы не плодить
    «метрика × серия»).
"""

from datetime import datetime
from typing import Optional

import pandas as pd

from app.models import Widget
from app.services import datasource_service as ds_service


AGGREGATION_ROW_LIMIT = 100_000

FILTER_OPERATORS = {
    "eq", "neq", "gt", "gte", "lt", "lte",
    "in", "not_in", "contains", "between",
}

AGGREGATION_FUNCS = {
    "sum": "sum",
    "avg": "mean",
    "min": "min",
    "max": "max",
    "count": "count",
    "count_distinct": "nunique",
}

# Разделитель для склейки значений нескольких измерений в одну метку серии.
SERIES_SEP = " / "


# ---------------------------------------------------------------------------
# Имена измерений: поддерживаем и кастомное имя (d.name), и имя поля.
# ---------------------------------------------------------------------------

def _dim_display_name(d) -> str:
    """Отображаемое имя измерения: кастомное, если задано, иначе имя поля."""
    custom = getattr(d, "name", None)
    if custom:
        return custom
    return d.field.name


# ---------------------------------------------------------------------------
# Приведение значения фильтра к типу поля
# ---------------------------------------------------------------------------

def _cast_filter_value(value: str, data_type: str):
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
        return value


def _apply_filter(df: pd.DataFrame, filter_obj) -> pd.DataFrame:
    field_name = filter_obj.field.name
    if field_name not in df.columns:
        return df

    series = df[field_name]
    data_type = filter_obj.field.data_type
    op = filter_obj.operator
    raw_value = filter_obj.value

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

    value = _cast_filter_value(raw_value, data_type)
    if value is None:
        return df

    if op == "contains":
        return df[series.astype(str).str.contains(str(value), case=False, na=False)]

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

    return df


def _to_json_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return value


# ---------------------------------------------------------------------------
# Главная агрегация
# ---------------------------------------------------------------------------

def aggregate_widget_data(widget: Widget) -> dict:
    if not widget.dataset:
        raise ValueError("У виджета нет датасета")

    df = ds_service.read_dataset(
        widget.dataset.datasource,
        query=widget.dataset.sql_query,
        limit=AGGREGATION_ROW_LIMIT,
    )

    for f in widget.filters:
        df = _apply_filter(df, f)

    # --- Случай 3: есть и измерения, и метрики -------------------------------
    if widget.dimensions and widget.metrics:
        return _aggregate_with_dimensions(widget, df)

    # --- Случай 4: только метрики (карточка с числами) -----------------------
    if widget.metrics and not widget.dimensions:
        result_row = {}
        metric_keys = []
        for m in widget.metrics:
            metric_keys.append(m.name)
            col = m.field.name
            func = AGGREGATION_FUNCS.get(m.aggregation_type)
            if col not in df.columns or not func:
                result_row[m.name] = None
                continue
            try:
                value = getattr(df[col], func)()
            except (TypeError, ValueError):
                value = None
            result_row[m.name] = _to_json_value(value)

        return {
            "rows": [result_row],
            "metric_keys": metric_keys,
            "dimension_keys": [],
            "x_key": None,
            "series_keys": metric_keys,
            "stacked": False,
        }

    # --- Случай 5: ни метрик, ни измерений — таблица «как есть» --------------
    return {
        "rows": [
            {col: _to_json_value(row[col]) for col in df.columns}
            for _, row in df.head(500).iterrows()
        ],
        "metric_keys": [],
        "dimension_keys": list(df.columns),
        "x_key": None,
        "series_keys": [],
        "stacked": False,
    }


def _prepare_date_dims(widget, df):
    for d in widget.dimensions:
        if d.field.data_type in ("date", "datetime"):
            col = d.field.name
            if col in df.columns:
                parsed = pd.to_datetime(df[col], errors="coerce")
                df[col] = parsed.dt.strftime("%Y-%m-%d").where(parsed.notna(), None)
    return df


def _aggregate_with_dimensions(widget: Widget, df: pd.DataFrame) -> dict:
    df = _prepare_date_dims(widget, df)

    dim_field_cols = [d.field.name for d in widget.dimensions]
    dim_display = [_dim_display_name(d) for d in widget.dimensions]

    # Агрегации метрик
    agg_spec = {}
    metric_keys = []
    for m in widget.metrics:
        func = AGGREGATION_FUNCS.get(m.aggregation_type)
        if not func:
            continue
        metric_keys.append(m.name)
        agg_spec[m.name] = pd.NamedAgg(column=m.field.name, aggfunc=func)

    if not agg_spec:
        return {
            "rows": [], "metric_keys": [], "dimension_keys": dim_display,
            "x_key": dim_display[0] if dim_display else None,
            "series_keys": [], "stacked": False,
        }

    df = df.dropna(subset=dim_field_cols, how="any")

    single_metric = len(metric_keys) == 1
    multi_dim = len(widget.dimensions) >= 2

    if single_metric and multi_dim:
        metric_name = metric_keys[0]
        x_field = dim_field_cols[0]
        x_display = dim_display[0]
        series_fields = dim_field_cols[1:]

        grouped = df.groupby(dim_field_cols, dropna=False, as_index=False).agg(**agg_spec)

        # склейка значений 2-го+ измерений
        def make_series_label(row):
            parts = [str(row[c]) for c in series_fields]
            return SERIES_SEP.join(parts)

        grouped["__series__"] = grouped.apply(make_series_label, axis=1)

        pivot = grouped.pivot_table(
            index=x_field,
            columns="__series__",
            values=metric_name,
            aggfunc="sum",
        )

        series_order = (
            pivot.sum(axis=0).sort_values(ascending=False).index.tolist()
        )
        pivot = pivot[series_order]

        pivot = pivot.loc[pivot.sum(axis=1).sort_values(ascending=False).index]

        rows = []
        for x_val, prow in pivot.iterrows():
            obj = {x_display: _to_json_value(x_val)}
            for s in series_order:
                obj[s] = _to_json_value(prow[s])
            rows.append(obj)

        return {
            "rows": rows,
            "metric_keys": [metric_name],
            "dimension_keys": dim_display,
            "x_key": x_display,
            "series_keys": [str(s) for s in series_order],
            "stacked": False,
        }

    # =====================================================================
    # Обычный случай:
    #   - неск. метрик + 1 измерение → серии = метрики;
    #   - неск. метрик + 2+ измерений → ось = первое измерение,
    #     группируем ТОЛЬКО по первому, серии = метрики.
    # =====================================================================
    if len(widget.dimensions) >= 2 and not single_metric:
        # Берём только первое измерение как ось
        group_cols = [dim_field_cols[0]]
        x_display = dim_display[0]
        grouped = df.groupby(group_cols, dropna=False, as_index=False).agg(**agg_spec)
        grouped = grouped.rename(columns={dim_field_cols[0]: x_display})
        if metric_keys:
            grouped = grouped.sort_values(by=metric_keys[0], ascending=False)

        rows = [
            {col: _to_json_value(row[col]) for col in grouped.columns}
            for _, row in grouped.iterrows()
        ]
        return {
            "rows": rows,
            "metric_keys": metric_keys,
            "dimension_keys": [x_display],
            "x_key": x_display,
            "series_keys": metric_keys,
            "stacked": False,
        }

    # Одно измерение (любое число метрик)
    group_cols = dim_field_cols[:]
    grouped = df.groupby(group_cols, dropna=False, as_index=False).agg(**agg_spec)

    # Переименуем колонки измерений в отображаемые имена
    rename_map = {
        fc: dn for fc, dn in zip(dim_field_cols, dim_display) if fc != dn
    }
    if rename_map:
        grouped = grouped.rename(columns=rename_map)

    if metric_keys:
        grouped = grouped.sort_values(by=metric_keys[0], ascending=False)

    rows = [
        {col: _to_json_value(row[col]) for col in grouped.columns}
        for _, row in grouped.iterrows()
    ]
    return {
        "rows": rows,
        "metric_keys": metric_keys,
        "dimension_keys": dim_display,
        "x_key": dim_display[0],
        "series_keys": metric_keys,
        "stacked": False,
    }