"""
Сервис вычисления значений KPI.

Главная функция: calculate_kpi_value(kpi) → dict
{
    "current_value": 1234.5,         # фактическое значение
    "target_value": 1000,            # целевое
    "unit": "шт",
    "direction": "higher_better",
    "achievement_percent": 123.45,   # % выполнения
    "is_target_met": True
}

Алгоритм:
  1. Если у KPI задан metric_id — читаем датасет метрики и применяем агрегацию
  2. Если metric_id не задан — берём manual_value
  3. Считаем процент выполнения с учётом direction
"""

from app.services import datasource_service as ds_service
from app.services.widget_data_service import (
    AGGREGATION_FUNCS,
    AGGREGATION_ROW_LIMIT,
    _to_json_value,
)


def _compute_metric_value(metric):
    """
    Возвращает скалярное значение метрики (агрегацию по всему датасету).
    Метрика → DatasetField → Dataset → DataSource → данные.
    """
    field = metric.field
    if field is None:
        return None

    dataset = field.dataset
    if dataset is None:
        return None

    df = ds_service.read_dataset(
        dataset.datasource,
        query=dataset.sql_query,
        limit=AGGREGATION_ROW_LIMIT,
    )

    col = field.name
    if col not in df.columns:
        return None

    func = AGGREGATION_FUNCS.get(metric.aggregation_type)
    if not func:
        return None

    series = df[col]
    try:
        value = getattr(series, func)()
    except (TypeError, ValueError):
        return None

    return _to_json_value(value)


def _compute_achievement_percent(current, target, direction):
    """
    higher_better: 100% при current >= target, считается как current/target
    lower_better:  100% при current <= target, считается как target/current
    """
    if current is None or target is None or target == 0:
        return None

    try:
        current = float(current)
        target = float(target)
    except (TypeError, ValueError):
        return None

    if direction == "lower_better":
        if current == 0:
            return 100.0 if target > 0 else None
        return round((target / current) * 100, 2)

    return round((current / target) * 100, 2)


def calculate_kpi_value(kpi) -> dict:
    """
    Главная функция: возвращает словарь с фактическим значением KPI,
    целью и процентом достижения.
    """
    # 1. Получаем фактическое значение
    if kpi.metric_id and kpi.metric is not None:
        try:
            current_value = _compute_metric_value(kpi.metric)
        except (ValueError, OSError, KeyError):
            current_value = None
    else:
        current_value = kpi.manual_value

    # 2. Считаем процент выполнения
    achievement = _compute_achievement_percent(
        current_value,
        kpi.target_value,
        kpi.direction,
    )

    # 3. Определяем, достигнута ли цель
    is_target_met = None
    if achievement is not None:
        is_target_met = achievement >= 100.0

    return {
        "current_value": current_value,
        "target_value": kpi.target_value,
        "unit": kpi.unit,
        "direction": kpi.direction,
        "achievement_percent": achievement,
        "is_target_met": is_target_met,
    }
