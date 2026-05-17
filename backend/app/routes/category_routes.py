"""Регистрация Blueprint'ов категорий через фабрику."""

from app.routes.category_factory import create_category_blueprint
from app.models import (
    DataSourceCategory,
    WidgetCategory,
    DashboardCategory,
    KPICategory,
)


datasource_category_bp = create_category_blueprint(
    name="datasource",
    model=DataSourceCategory,
    dependant_attr="datasources",
)

widget_category_bp = create_category_blueprint(
    name="widget",
    model=WidgetCategory,
    dependant_attr="widgets",
)

dashboard_category_bp = create_category_blueprint(
    name="dashboard",
    model=DashboardCategory,
    dependant_attr="dashboards",
)

kpi_category_bp = create_category_blueprint(
    name="kpi",
    model=KPICategory,
    dependant_attr="kpis",
)
