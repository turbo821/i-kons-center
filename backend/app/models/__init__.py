"""
Единая точка импорта всех моделей.

Импорт этого пакета гарантирует, что SQLAlchemy зарегистрировал все модели,
а Flask-Migrate сможет автоматически обнаружить их при генерации миграций.
"""

from app.models.role import Role
from app.models.user_role import UserRole
from app.models.user import User

from app.models.data_source import DataSource
from app.models.dataset import Dataset, DatasetField

from app.models.metric import Metric
from app.models.dimension import Dimension
from app.models.filter import Filter

from app.models.dashboard import Dashboard
from app.models.widget import Widget

from app.models.category import Category
from app.models.kpi import KPI, DashboardKPI

__all__ = [
    "Role",
    "UserRole",
    "User",
    "DataSource",
    "Dataset",
    "DatasetField",
    "Metric",
    "Dimension",
    "Filter",
    "Dashboard",
    "Widget",
    "Category",
    "KPI",
    "DashboardKPI",
]
