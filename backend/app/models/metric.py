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

    name = db.Column(db.String(150), nullable=False)

    aggregation_type = db.Column(db.String(30), nullable=False)

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
        return {
            "id": self.id,
            "field_id": self.field_id,
            "field_name": self.field.name if self.field else None,
            "name": self.name,
            "aggregation_type": self.aggregation_type,
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
