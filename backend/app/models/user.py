from app.database.db import db
from app.models.user_role import UserRole

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(100), unique=True, nullable=False)

    email = db.Column(db.String(255), unique=True, nullable=False)

    password_hash = db.Column(db.String(255), nullable=False)

    status = db.Column(db.String(50), default="active")

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )

    roles = db.relationship(
        "Role",
        secondary="user_roles",
        lazy="joined"
    )