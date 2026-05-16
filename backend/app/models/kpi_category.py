from app.database.db import db


class KPICategory(db.Model):
    """
    Категория для KPI.
    Таблица переименована из 'categories' в 'kpi_categories'
    для единообразия с другими типами категорий.
    """
    __tablename__ = "kpi_categories"

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
            "kpis_count": len(self.kpis),
        }
