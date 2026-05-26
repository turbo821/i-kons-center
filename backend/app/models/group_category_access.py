from app.database.db import db


# Типы сущностей, к категориям которых выдаётся доступ.
ENTITY_DATASOURCE = "datasource"
ENTITY_WIDGET = "widget"
ENTITY_DASHBOARD = "dashboard"
ENTITY_KPI = "kpi"

VALID_ENTITY_TYPES = (
    ENTITY_DATASOURCE,
    ENTITY_WIDGET,
    ENTITY_DASHBOARD,
    ENTITY_KPI,
)

# Сопоставление типа сущности и его таблицы категорий (имя модели).
# Используется для валидации category_id и для отображения имени категории.
ENTITY_CATEGORY_MODEL = {
    ENTITY_DATASOURCE: "DataSourceCategory",
    ENTITY_WIDGET: "WidgetCategory",
    ENTITY_DASHBOARD: "DashboardCategory",
    ENTITY_KPI: "KPICategory",
}


class GroupCategoryAccess(db.Model):
    """
    Доступ ролевой группы к конкретной категории конкретного типа сущности.

    Пример: группа «Финансы» получает доступ к категории источников данных
    с id=3 («Бюджет»). Тогда все участники группы видят источники этой
    категории, а участники с ролью expert внутри группы — могут их
    редактировать.

    category_id = NULL означает виртуальную категорию «Без категории» —
    доступ к сущностям соответствующего типа, у которых не задана категория.

    Сам уровень «просмотр / редактирование» здесь НЕ хранится: он
    определяется ролью пользователя внутри группы (expert → редактирование,
    viewer → просмотр). Это упрощает модель и соответствует постановке:
    «дать роль внутри группы эксперт (редактирует) или зритель (смотрит)».
    """
    __tablename__ = "group_category_access"

    id = db.Column(db.Integer, primary_key=True)

    group_id = db.Column(
        db.Integer,
        db.ForeignKey("role_groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Тип сущности: 'datasource' | 'widget' | 'dashboard' | 'kpi'
    entity_type = db.Column(db.String(30), nullable=False)

    # id категории соответствующего типа; NULL = «Без категории»
    category_id = db.Column(db.Integer, nullable=True)

    # Дискриминатор для уникальности, переносимый между СУБД.
    # NULL в обычном UNIQUE не работает (в Postgres NULL != NULL, в SQLite
    # partial-индексы ведут себя иначе), поэтому ключ всегда строка:
    # реальная категория -> str(category_id), «Без категории» -> "none".
    # Это гарантирует, что группа не получит одну и ту же категорию дважды,
    # но при этом может открывать несколько РАЗНЫХ категорий одного типа.
    category_key = db.Column(db.String(30), nullable=False, default="none")

    __table_args__ = (
        db.UniqueConstraint(
            "group_id", "entity_type", "category_key",
            name="uq_group_entity_categorykey",
        ),
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Поддерживаем category_key в согласованном состоянии
        self.category_key = (
            "none" if self.category_id is None else str(self.category_id)
        )

    group = db.relationship("RoleGroup", back_populates="category_accesses")

    def _category_name(self):
        """Возвращает имя категории (или метку «Без категории»)."""
        if self.category_id is None:
            return "Без категории"

        # Ленивый импорт во избежание циклических зависимостей
        from app.models import (
            DataSourceCategory,
            WidgetCategory,
            DashboardCategory,
            KPICategory,
        )
        model_map = {
            ENTITY_DATASOURCE: DataSourceCategory,
            ENTITY_WIDGET: WidgetCategory,
            ENTITY_DASHBOARD: DashboardCategory,
            ENTITY_KPI: KPICategory,
        }
        model = model_map.get(self.entity_type)
        if model is None:
            return None
        cat = db.session.get(model, self.category_id)
        return cat.name if cat else None

    def to_dict(self):
        return {
            "id": self.id,
            "group_id": self.group_id,
            "entity_type": self.entity_type,
            "category_id": self.category_id,
            "category_name": self._category_name(),
        }
