from app.database.db import db


class Dimension(db.Model):
    """
    Измерение — поле, по которому выполняется группировка.
    """
    __tablename__ = "dimensions"

    id = db.Column(db.Integer, primary_key=True)

    field_id = db.Column(
        db.Integer,
        db.ForeignKey("dataset_fields.id", ondelete="CASCADE"),
        nullable=False
    )

    name = db.Column(db.String(150), nullable=False)

    field = db.relationship(
        "DatasetField",
        back_populates="dimensions"
    )

    widgets = db.relationship(
        "Widget",
        secondary="widget_dimensions",
        back_populates="dimensions"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "field_id": self.field_id,
            "field_name": self.field.name if self.field else None,
            "name": self.name,
        }


class WidgetDimension(db.Model):
    """Связующая таблица «виджет — измерение» (m2m)."""
    __tablename__ = "widget_dimensions"

    widget_id = db.Column(
        db.Integer,
        db.ForeignKey("widgets.id", ondelete="CASCADE"),
        primary_key=True
    )

    dimension_id = db.Column(
        db.Integer,
        db.ForeignKey("dimensions.id", ondelete="CASCADE"),
        primary_key=True
    )
