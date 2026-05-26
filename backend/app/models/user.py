from app.database.db import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    status = db.Column(
        db.String(50),
        default="active",
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    # Связи
    roles = db.relationship(
        "Role",
        secondary="user_roles",
        lazy="joined"
    )

    # Дашборды, созданные пользователем
    dashboards = db.relationship(
        "Dashboard",
        back_populates="creator",
        cascade="all, delete-orphan"
    )

    # Членства в ролевых группах (с ролью внутри каждой группы)
    group_memberships = db.relationship(
        "UserGroupMembership",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def role_names(self):
        """Список имён ролей — удобно для JWT-claims и сериализации."""
        return [r.name for r in self.roles]

    def to_dict(self, include_groups=False):
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "status": self.status,
            "roles": self.role_names,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_groups:
            data["groups"] = [
                {
                    "group_id": m.group_id,
                    "group_name": m.group.name if m.group else None,
                    "group_role": m.group_role,
                }
                for m in self.group_memberships
            ]
        return data
