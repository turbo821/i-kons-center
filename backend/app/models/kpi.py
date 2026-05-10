from app.database.db import db


class KPI(db.Model):
    """
    Ключевой показатель эффективности.

    Архитектура: KPI ссылается на Metric и наследует её вычислимость.
    Фактическое значение KPI получается агрегацией данных по metric_id
    (с фильтрами KPI, если заданы).

    direction: 'higher_better' (продажи, выработка) | 'lower_better' (аварии, простой)
    """
    __tablename__ = "kpis"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(200), nullable=False)

    description = db.Column(db.Text, nullable=True)

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True
    )

    # Ссылка на метрику для автоматического вычисления.
    # Опциональна — если null, KPI работает в режиме «ручной ввод» (current_value).
    metric_id = db.Column(
        db.Integer,
        db.ForeignKey("metrics.id", ondelete="SET NULL"),
        nullable=True
    )

    # Документационная формула — например, "Сумма выработки / Целевая выработка"
    formula = db.Column(db.Text, nullable=True)

    # Целевое значение
    target_value = db.Column(db.Float, nullable=True)

    # Единица измерения: "шт", "%", "₽", "МВт·ч", "мЗв"
    unit = db.Column(db.String(50), nullable=True)

    # Направление достижения цели
    direction = db.Column(
        db.String(20),
        default="higher_better",
        nullable=False
    )

    # Резервное поле для ручного ввода значения, если metric_id не задан
    manual_value = db.Column(db.Float, nullable=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    # Связи
    category = db.relationship(
        "Category",
        back_populates="kpis"
    )

    metric = db.relationship("Metric")

    dashboards = db.relationship(
        "Dashboard",
        secondary="dashboard_kpis",
        back_populates="kpis"
    )

    def to_dict(self, include_metric=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "metric_id": self.metric_id,
            "formula": self.formula,
            "target_value": self.target_value,
            "unit": self.unit,
            "direction": self.direction,
            "manual_value": self.manual_value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_metric and self.metric:
            data["metric"] = self.metric.to_dict()
        return data


class DashboardKPI(db.Model):
    """Связующая таблица «дашборд — KPI» (M:N)."""
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
