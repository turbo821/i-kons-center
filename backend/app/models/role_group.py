from app.database.db import db


class RoleGroup(db.Model):
    """
    Ролевая группа — кастомная группа доступа, которую создаёт администратор.

    Идея модели прав:
      - пользователь сам по себе (с глобальной ролью viewer) не видит ничего;
      - администратор создаёт группы и добавляет в них пользователей;
      - у пользователя внутри каждой группы своя роль: 'expert' (может
        редактировать) или 'viewer' (только просмотр);
      - группе открывается доступ к конкретным категориям конкретных типов
        сущностей (источники / виджеты / дашборды / KPI).

    Эффективный доступ пользователя к категории — это объединение прав по
    всем его группам (берём максимум: если хоть где-то expert — может
    редактировать).
    """
    __tablename__ = "role_groups"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(150), unique=True, nullable=False)

    description = db.Column(db.Text, nullable=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    # Членства пользователей в этой группе
    memberships = db.relationship(
        "UserGroupMembership",
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Доступы к категориям, выданные этой группе
    category_accesses = db.relationship(
        "GroupCategoryAccess",
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self, include_details=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "members_count": len(self.memberships),
            "categories_count": len(self.category_accesses),
        }
        if include_details:
            data["members"] = [m.to_dict() for m in self.memberships]
            data["categories"] = [a.to_dict() for a in self.category_accesses]
        return data
