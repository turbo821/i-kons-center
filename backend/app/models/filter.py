from app.database.db import db


class Filter(db.Model):
    """
    Фильтр виджета. operator принимает значения:
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'in', 'not_in', 'contains', 'between'
    """
    __tablename__ = "filters"

    id = db.Column(db.Integer, primary_key=True)

    widget_id = db.Column(
        db.Integer,
        db.ForeignKey("widgets.id", ondelete="CASCADE"),
        nullable=False
    )

    field_id = db.Column(
        db.Integer,
        db.ForeignKey("dataset_fields.id", ondelete="CASCADE"),
        nullable=False
    )

    operator = db.Column(db.String(30), nullable=False)

    value = db.Column(db.String(500), nullable=True)

    widget = db.relationship(
        "Widget",
        back_populates="filters"
    )

    field = db.relationship(
        "DatasetField",
        back_populates="filters"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "widget_id": self.widget_id,
            "field_id": self.field_id,
            "operator": self.operator,
            "value": self.value,
        }
