from app.database.db import db


class KPI(db.Model):
    __tablename__ = "kpis"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(200), nullable=False)

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True
    )

    formula = db.Column(db.Text, nullable=True)

    target_value = db.Column(db.Float, nullable=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    category = db.relationship(
        "Category",
        back_populates="kpis"
    )

    dashboards = db.relationship(
        "Dashboard",
        secondary="dashboard_kpis",
        back_populates="kpis"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category_id": self.category_id,
            "formula": self.formula,
            "target_value": self.target_value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DashboardKPI(db.Model):
    """Связующая таблица «дашборд — KPI» (m2m)."""
    __tablename__ = "dashboard_kpis"

    dashboard_id = db.Column(
        db.Integer,
        db.ForeignKey("dashboards.id", ondelete="CASCADE"),
        primary_key=True
    )

    kpi_id = db.Column(
        db.Integer,
        db.ForeignKey("kpis.id", ondelete="CASCADE"),
        primary_key=True
    )
