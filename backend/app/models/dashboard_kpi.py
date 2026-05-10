from app.database.db import db


class DashboardKPI(db.Model):
    """
    Связующая таблица «дашборд — KPI» (M:N) с координатами размещения.
    По аналогии с DashboardWidget: один KPI может быть размещён на нескольких
    дашбордах в разных местах.
    """
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

    position_x = db.Column(db.Integer, default=0, nullable=False)
    position_y = db.Column(db.Integer, default=0, nullable=False)
    width = db.Column(db.Integer, default=3, nullable=False)
    height = db.Column(db.Integer, default=3, nullable=False)

    dashboard = db.relationship(
        "Dashboard",
        back_populates="dashboard_kpis"
    )

    kpi = db.relationship(
        "KPI",
        back_populates="dashboard_links"
    )

    def to_dict(self):
        return {
            "dashboard_id": self.dashboard_id,
            "kpi_id": self.kpi_id,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width,
            "height": self.height,
        }
