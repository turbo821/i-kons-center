from app.database.db import db


class Widget(db.Model):
    """
    Визуальный элемент на дашборде.
    type: 'bar', 'line', 'pie', 'table', 'kpi_card'
    """
    __tablename__ = "widgets"

    id = db.Column(db.Integer, primary_key=True)

    dashboard_id = db.Column(
        db.Integer,
        db.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False
    )

    dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("datasets.id", ondelete="RESTRICT"),
        nullable=False
    )

    title = db.Column(db.String(200), nullable=False)

    type = db.Column(db.String(50), nullable=False)

    # Параметры размещения на дашборде (сетка react-grid-layout)
    position_x = db.Column(db.Integer, default=0, nullable=False)
    position_y = db.Column(db.Integer, default=0, nullable=False)
    width = db.Column(db.Integer, default=4, nullable=False)
    height = db.Column(db.Integer, default=4, nullable=False)

    # Связи
    dashboard = db.relationship(
        "Dashboard",
        back_populates="widgets"
    )

    dataset = db.relationship(
        "Dataset",
        back_populates="widgets"
    )

    filters = db.relationship(
        "Filter",
        back_populates="widget",
        cascade="all, delete-orphan"
    )

    def to_dict(self, include_filters=False):
        data = {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "dataset_id": self.dataset_id,
            "title": self.title,
            "type": self.type,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width,
            "height": self.height,
        }
        if include_filters:
            data["filters"] = [f.to_dict() for f in self.filters]
        return data
