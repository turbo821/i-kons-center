from app.database.db import db


class DashboardText(db.Model):
    """
    Текстовый элемент на дашборде: заметка, заголовок, подпись.

    В отличие от Widget/KPI, текст не «переиспользуется» между дашбордами,
    поэтому он сразу хранит и контент, и координаты, и привязан к дашборду
    напрямую (без отдельной таблицы-связки).

    Поля font_size и text_align контролируют визуальное оформление
    блока. Размер хранится как «токен» (sm/base/lg/xl/2xl/3xl) — это даёт
    предсказуемую типографику в дашборде без свободного ввода пикселей,
    и хорошо ложится на Tailwind классы.
    """
    __tablename__ = "dashboard_texts"

    # Допустимые значения для font_size — соответствуют классам Tailwind
    FONT_SIZES = ("sm", "base", "lg", "xl", "2xl", "3xl")
    TEXT_ALIGNS = ("left", "center", "right")

    id = db.Column(db.Integer, primary_key=True)

    dashboard_id = db.Column(
        db.Integer,
        db.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False
    )

    content = db.Column(db.Text, nullable=False, default="")

    font_size = db.Column(
        db.String(8),
        nullable=False,
        server_default="base",
        default="base",
    )

    text_align = db.Column(
        db.String(8),
        nullable=False,
        server_default="left",
        default="left",
    )

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
            "font_size": self.font_size or "base",
            "text_align": self.text_align or "left",
            "position_x": self.position_x,
            "position_y": self.position_y,
            "width": self.width,
            "height": self.height,
        }
