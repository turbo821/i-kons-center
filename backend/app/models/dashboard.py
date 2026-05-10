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

    creator = db.relationship(
        "User",
        back_populates="dashboards"
    )

    dashboard_widgets = db.relationship(
        "DashboardWidget",
        back_populates="dashboard",
        cascade="all, delete-orphan"
    )

    dashboard_kpis = db.relationship(
        "DashboardKPI",
        back_populates="dashboard",
        cascade="all, delete-orphan"
    )

    # Технический shortcut: KPI напрямую (без позиций)
    kpis = db.relationship(
        "KPI",
        secondary="dashboard_kpis",
        back_populates="dashboards",
        viewonly=True,
        overlaps="dashboard_kpis,dashboard_links"
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
            # Единый массив элементов: и виджеты, и KPI с координатами.
            # Поле kind помогает фронту отрисовать правильный компонент.
            items = []

            for dw in self.dashboard_widgets:
                if dw.widget is None:
                    continue
                items.append({
                    "kind": "widget",
                    "ref_id": dw.widget.id,
                    **dw.widget.to_dict(),
                    "position_x": dw.position_x,
                    "position_y": dw.position_y,
                    "width": dw.width,
                    "height": dw.height,
                })

            for dk in self.dashboard_kpis:
                if dk.kpi is None:
                    continue
                items.append({
                    "kind": "kpi",
                    "ref_id": dk.kpi.id,
                    **dk.kpi.to_dict(),
                    "position_x": dk.position_x,
                    "position_y": dk.position_y,
                    "width": dk.width,
                    "height": dk.height,
                })

            data["items"] = items

        return data
