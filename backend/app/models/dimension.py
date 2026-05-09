from app.database.db import db


class Dimension(db.Model):
    """
    Измерение — поле, по которому выполняется группировка.
    Обычно это категории, даты, статусы и т.п.
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

    def to_dict(self):
        return {
            "id": self.id,
            "field_id": self.field_id,
            "name": self.name,
        }
