from app.database.db import db


class Metric(db.Model):
    """
    Вычисляемый показатель: агрегат над полем датасета.
    aggregation_type: 'sum', 'avg', 'min', 'max', 'count', 'count_distinct'
    """
    __tablename__ = "metrics"

    id = db.Column(db.Integer, primary_key=True)

    field_id = db.Column(
        db.Integer,
        db.ForeignKey("dataset_fields.id", ondelete="CASCADE"),
        nullable=False
    )

    name = db.Column(db.String(200), nullable=False)

    aggregation_type = db.Column(db.String(50), nullable=False)

    field = db.relationship(
        "DatasetField",
        back_populates="metrics"
    )

    # M2M-связь с виджетами (через widget_metrics)
    widgets = db.relationship(
        "Widget",
        secondary="widget_metrics",
        back_populates="metrics"
    )

    def to_dict(self):
        field = self.field
        dataset = field.dataset if field else None
        datasource = dataset.datasource if dataset else None

        return {
            "id": self.id,
            "field_id": self.field_id,
            "field_name": self.field.name if self.field else None,
            "name": self.name,
            "aggregation_type": self.aggregation_type,
            "dataset_id": dataset.id if dataset else None,
            "dataset_name": dataset.name if dataset else None,
            "datasource_id": datasource.id if datasource else None,
            "datasource_name": datasource.name if datasource else None,
            "datasource_category_name": (
                datasource.category.name
                if datasource and datasource.category else None
            ),
        }


class WidgetMetric(db.Model):
    """Связующая таблица «виджет — метрика» (m2m)."""
    __tablename__ = "widget_metrics"

    widget_id = db.Column(
        db.Integer,
        db.ForeignKey("widgets.id", ondelete="CASCADE"),
        primary_key=True
    )

    metric_id = db.Column(
        db.Integer,
        db.ForeignKey("metrics.id", ondelete="CASCADE"),
        primary_key=True
    )
