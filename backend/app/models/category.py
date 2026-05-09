from app.database.db import db


class Category(db.Model):
    """Категории KPI — позволяют группировать показатели по направлениям."""
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(150), unique=True, nullable=False)

    description = db.Column(db.Text, nullable=True)

    kpis = db.relationship(
        "KPI",
        back_populates="category"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
        }
