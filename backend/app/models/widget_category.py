from app.database.db import db


class WidgetCategory(db.Model):
    """Категория для виджетов."""
    __tablename__ = "widget_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    widgets = db.relationship(
        "Widget",
        back_populates="category"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "widgets_count": len(self.widgets),
        }
