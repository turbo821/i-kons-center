from app.database.db import db


class DashboardWidget(db.Model):
    """
    Связующая таблица «дашборд — виджет» (M:N).
    Хранит координаты и размер виджета на конкретном дашборде:
    один виджет может быть размещён на нескольких дашбордах
    в разных местах и разного размера.
    """
    __tablename__ = "dashboard_widgets"

    dashboard_id = db.Column(
        db.Integer,
        db.ForeignKey("dashboards.id", ondelete="CASCADE"),
        primary_key=True
    )

    widget_id = db.Column(
        db.Integer,
        db.ForeignKey("widgets.id", ondelete="CASCADE"),
        primary_key=True
    )

    position_x = db.Column(db.Integer, default=0, nullable=False)
    position_y = db.Column(db.Integer, default=0, nullable=False)
    width = db.Column(db.Integer, default=6, nullable=False)
    height = db.Column(db.Integer, default=4, nullable=False)

    # ORM-связи
    dashboard = db.relationship(
        "Dashboard",
        back_populates="dashboard_widgets"
    )

    widget = db.relationship(
        "Widget",
        back_populates="dashboard_widgets"
    )

    def to_dict(self):
        return {
            "dashboard_id": self.dashboard_id,
            "widget_id": self.widget_id,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width,
            "height": self.height,
        }
