from app.database.db import db


class Widget(db.Model):
    """
    Визуальный элемент.
    Сами по себе виджеты не привязаны к дашборду — связь M:N через
    DashboardWidget, который и хранит координаты на каждом дашборде.

    type: 'bar', 'line', 'pie', 'table', 'kpi_card'
    """
    __tablename__ = "widgets"

    id = db.Column(db.Integer, primary_key=True)

    dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("datasets.id", ondelete="RESTRICT"),
        nullable=False
    )

    title = db.Column(db.String(200), nullable=False)

    type = db.Column(db.String(50), nullable=False)

    # Связи
    dataset = db.relationship(
        "Dataset",
        back_populates="widgets"
    )

    filters = db.relationship(
        "Filter",
        back_populates="widget",
        cascade="all, delete-orphan"
    )

    metrics = db.relationship(
        "Metric",
        secondary="widget_metrics",
        back_populates="widgets"
    )

    dimensions = db.relationship(
        "Dimension",
        secondary="widget_dimensions",
        back_populates="widgets"
    )

    # Размещения этого виджета на разных дашбордах
    dashboard_widgets = db.relationship(
        "DashboardWidget",
        back_populates="widget",
        cascade="all, delete-orphan"
    )

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("widget_categories.id", ondelete="SET NULL"),
        nullable=True
    )

    category = db.relationship(
        "WidgetCategory",
        back_populates="widgets"
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    def to_dict(self, include_config=False):
        data = {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "dataset_name": self.dataset.name if self.dataset else None,
            "title": self.title,
            "type": self.type,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
        }
        if include_config:
            data["metrics"] = [m.to_dict() for m in self.metrics]
            data["dimensions"] = [d.to_dict() for d in self.dimensions]
            data["filters"] = [f.to_dict() for f in self.filters]
        return data
