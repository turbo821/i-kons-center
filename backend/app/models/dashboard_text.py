from app.database.db import db


class DashboardText(db.Model):
    """
    Текстовый элемент на дашборде: заметка, заголовок, подпись.

    В отличие от Widget/KPI, текст не «переиспользуется» между дашбордами,
    поэтому он сразу хранит и контент, и координаты, и привязан к дашборду
    напрямую (без отдельной таблицы-связки).
    """
    __tablename__ = "dashboard_texts"

    id = db.Column(db.Integer, primary_key=True)

    dashboard_id = db.Column(
        db.Integer,
        db.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False
    )

    content = db.Column(db.Text, nullable=False, default="")

    position_x = db.Column(db.Integer, default=0, nullable=False)
    position_y = db.Column(db.Integer, default=0, nullable=False)
    width = db.Column(db.Integer, default=4, nullable=False)
    height = db.Column(db.Integer, default=2, nullable=False)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    dashboard = db.relationship(
        "Dashboard",
        back_populates="dashboard_texts"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "content": self.content,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width,
            "height": self.height,
        }
