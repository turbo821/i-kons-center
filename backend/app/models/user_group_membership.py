from app.database.db import db


# Роли внутри группы. На уровне БД храним строку, валидируем в коде.
GROUP_ROLE_EXPERT = "expert"   # может редактировать сущности открытых категорий
GROUP_ROLE_VIEWER = "viewer"   # только просмотр

VALID_GROUP_ROLES = (GROUP_ROLE_EXPERT, GROUP_ROLE_VIEWER)


class UserGroupMembership(db.Model):
    """
    Связь «пользователь — ролевая группа» с ролью пользователя внутри группы.

    Один пользователь может состоять в нескольких группах, и в каждой иметь
    свою роль (expert или viewer). Пара (user_id, group_id) уникальна —
    нельзя добавить пользователя в одну группу дважды.
    """
    __tablename__ = "user_group_memberships"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    group_id = db.Column(
        db.Integer,
        db.ForeignKey("role_groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Роль пользователя внутри этой группы: 'expert' | 'viewer'
    group_role = db.Column(
        db.String(20),
        nullable=False,
        default=GROUP_ROLE_VIEWER,
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "group_id", name="uq_user_group"),
    )

    # Связи
    user = db.relationship("User", back_populates="group_memberships")
    group = db.relationship("RoleGroup", back_populates="memberships")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "group_id": self.group_id,
            "group_role": self.group_role,
            "username": self.user.username if self.user else None,
            "email": self.user.email if self.user else None,
        }
