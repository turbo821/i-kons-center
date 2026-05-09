from app.database.db import db


class Dashboard(db.Model):
    __tablename__ = "dashboards"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(150), nullable=False)

    description = db.Column(db.Text, nullable=True)

    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    # Связи
    creator = db.relationship(
        "User",
        back_populates="dashboards"
    )

    widgets = db.relationship(
        "Widget",
        back_populates="dashboard",
        cascade="all, delete-orphan"
    )

    # KPI, отображаемые на дашборде (m2m через DashboardKPI)
    kpis = db.relationship(
        "KPI",
        secondary="dashboard_kpis",
        back_populates="dashboards"
    )

    def to_dict(self, include_widgets=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_widgets:
            data["widgets"] = [w.to_dict() for w in self.widgets]
        return data
