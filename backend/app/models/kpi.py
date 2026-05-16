from app.database.db import db


class KPI(db.Model):
    """Ключевой показатель эффективности."""
    __tablename__ = "kpis"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(200), nullable=False)

    description = db.Column(db.Text, nullable=True)

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("kpi_categories.id", ondelete="SET NULL"),
        nullable=True
    )

    metric_id = db.Column(
        db.Integer,
        db.ForeignKey("metrics.id", ondelete="SET NULL"),
        nullable=True
    )

    formula = db.Column(db.Text, nullable=True)

    target_value = db.Column(db.Float, nullable=True)

    unit = db.Column(db.String(50), nullable=True)
    direction = db.Column(db.String(20), default="higher_better", nullable=False)
    manual_value = db.Column(db.Float, nullable=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    category = db.relationship("KPICategory", back_populates="kpis")
    metric = db.relationship("Metric")

    dashboards = db.relationship(
        "Dashboard",
        secondary="dashboard_kpis",
        back_populates="kpis"
    )

    # Размещения KPI на дашбордах (с координатами)
    dashboard_links = db.relationship(
        "DashboardKPI",
        back_populates="kpi",
        cascade="all, delete-orphan"
    )

    def to_dict(self, include_metric=False):
        # Информация о метрике с указанием источника и датасета
        metric_info = None
        if self.metric is not None:
            field = self.metric.field
            dataset = field.dataset if field else None
            datasource = dataset.datasource if dataset else None
            metric_info = {
                "id": self.metric.id,
                "name": self.metric.name,
                "field_name": field.name if field else None,
                "dataset_name": dataset.name if dataset else None,
                "datasource_name": datasource.name if datasource else None,
                "datasource_category_name": (
                    datasource.category.name
                    if datasource and datasource.category else None
                ),
            }

        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "metric_id": self.metric_id,
            "metric_info": metric_info,
            "formula": self.formula,
            "target_value": self.target_value,
            "unit": self.unit,
            "direction": self.direction,
            "manual_value": self.manual_value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_metric and self.metric:
            data["metric"] = self.metric.to_dict()
        return data
