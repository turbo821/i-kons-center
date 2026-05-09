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

    def to_dict(self):
        return {
            "id": self.id,
            "field_id": self.field_id,
            "name": self.name,
            "aggregation_type": self.aggregation_type,
        }
