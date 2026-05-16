"""Единая точка импорта всех моделей."""

from app.models.role import Role
from app.models.user_role import UserRole
from app.models.user import User

from app.models.datasource_category import DataSourceCategory
from app.models.data_source import DataSource
from app.models.dataset import Dataset, DatasetField

from app.models.metric import Metric, WidgetMetric
from app.models.dimension import Dimension, WidgetDimension
from app.models.filter import Filter

from app.models.dashboard_category import DashboardCategory
from app.models.dashboard import Dashboard

from app.models.widget_category import WidgetCategory
from app.models.widget import Widget
from app.models.dashboard_widget import DashboardWidget

from app.models.kpi_category import KPICategory
from app.models.kpi import KPI
from app.models.dashboard_kpi import DashboardKPI

__all__ = [
    "Role", "UserRole", "User",
    "DataSource", "Dataset", "DatasetField",
    "Metric", "WidgetMetric",
    "Dimension", "WidgetDimension",
    "Filter",
    "Dashboard", "Widget", "DashboardWidget",
    "Category", "KPI", "DashboardKPI",
    "DataSourceCategory", "DashboardCategory", 
    "WidgetCategory", "KPICategory",
]
