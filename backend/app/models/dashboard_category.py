from app.database.db import db


class DashboardCategory(db.Model):
    """Категория для дашбордов."""
    __tablename__ = "dashboard_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    dashboards = db.relationship(
        "Dashboard",
        back_populates="category"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "dashboards_count": len(self.dashboards),
        }
