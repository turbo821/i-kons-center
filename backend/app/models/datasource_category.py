from app.database.db import db


class DataSourceCategory(db.Model):
    """Категория для источников данных."""
    __tablename__ = "datasource_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    datasources = db.relationship(
        "DataSource",
        back_populates="category"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "datasources_count": len(self.datasources),
        }
