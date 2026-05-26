"""
Скрипт инициализации администратора при первом запуске приложения.

Запускается автоматически при старте Docker-контейнера. Логика:
1. Проверяет, есть ли уже пользователь с ролью admin
2. Если есть — выходит (повторно админа не создаём)
3. Если нет — создаёт админа с креденшелами из переменных окружения:
       ADMIN_USERNAME (по умолчанию 'admin')
       ADMIN_EMAIL    (по умолчанию 'admin@local')
       ADMIN_PASSWORD (по умолчанию 'admin')

Также гарантирует наличие базовых ролей (admin, expert, viewer) —
если SQL-скрипты initdb не отработали (например, при ручной миграции).
"""

import os
import sys
import bcrypt

from app import create_app
from app.database.db import db
from app.models import User, Role


DEFAULT_ROLES = [
    ("admin",  "Администратор системы"),
    ("expert", "Аналитик / эксперт"),
    ("viewer", "Просмотр аналитики"),
]


def ensure_schema():
    """
    Создаёт отсутствующие таблицы (idempotent).

    db.create_all() создаёт только те таблицы, которых ещё нет в БД, и не
    трогает существующие. Это нужно, чтобы новые таблицы модели ролевых
    групп (role_groups, user_group_memberships, group_category_access)
    появились без отдельной Alembic-миграции. Существующие таблицы
    остаются нетронутыми.
    """
    db.create_all()
    print("[bootstrap] Схема синхронизирована (db.create_all)", flush=True)


def ensure_roles():
    """Создаёт базовые роли, если их нет."""
    for name, description in DEFAULT_ROLES:
        existing = db.session.query(Role).filter_by(name=name).first()
        if not existing:
            db.session.add(Role(name=name, description=description))
    db.session.commit()


def ensure_admin():
    """Создаёт админа, если в системе нет ни одного admin."""
    admin_role = db.session.query(Role).filter_by(name="admin").first()
    if admin_role is None:
        print("[bootstrap] Роль 'admin' не найдена, прерываю", flush=True)
        return False

    # Есть ли уже хоть один пользователь с ролью admin?
    has_admin = (
        db.session.query(User)
        .filter(User.roles.any(Role.name == "admin"))
        .first()
    )

    if has_admin:
        print(
            f"[bootstrap] Администратор уже существует ({has_admin.email}), "
            f"повторное создание не требуется",
            flush=True,
        )
        return False

    username = os.getenv("ADMIN_USERNAME", "admin")
    email = os.getenv("ADMIN_EMAIL", "admin@local")
    password = os.getenv("ADMIN_PASSWORD", "admin")

    # Проверим, нет ли пользователя с таким email (даже если он не админ)
    existing_user = db.session.query(User).filter_by(email=email).first()
    if existing_user:
        # Просто добавим ему роль admin
        existing_user.roles = list(set(existing_user.roles + [admin_role]))
        db.session.commit()
        print(
            f"[bootstrap] Существующему пользователю {email} назначена роль admin",
            flush=True,
        )
        return True

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    admin = User(
        username=username,
        email=email,
        password_hash=password_hash,
        status="active",
        roles=[admin_role],
    )
    db.session.add(admin)
    db.session.commit()

    print(
        f"[bootstrap] Создан администратор: {email} (пароль из ADMIN_PASSWORD)",
        flush=True,
    )
    return True


def main():
    app = create_app()
    with app.app_context():
        try:
            ensure_schema()
            ensure_roles()
            ensure_admin()
        except Exception as e:
            print(f"[bootstrap] Ошибка: {e}", flush=True)
            sys.exit(1)


if __name__ == "__main__":
    main()
