"""
Скрипт инициализации системы при первом запуске.

Запускается автоматически при старте Docker-контейнера. Логика:
1. Создаёт глобальную роль admin (если ещё нет)
2. Создаёт базовый набор категорий для KPI, источников, виджетов и
   дашбордов (если ещё нет — повторно дубли не создаются)
3. Создаёт пользователя-администратора с креденшелами из переменных
   окружения (если в системе нет ни одного admin):
       ADMIN_USERNAME (по умолчанию 'admin')
       ADMIN_EMAIL    (по умолчанию 'admin@local')
       ADMIN_PASSWORD (по умолчанию 'admin')

Скрипт идемпотентен: повторный запуск не приводит к дублированию данных.
Запускается ПОСЛЕ применения миграций (см. entrypoint.sh), благодаря чему
гарантированно работает с актуальной схемой БД.
"""

import os
import sys
import bcrypt

from app import create_app
from app.database.db import db
from app.models import (
    User,
    Role,
    KPICategory,
    DataSourceCategory,
    WidgetCategory,
    DashboardCategory,
)


DEFAULT_ROLES = [
    ("admin", "Администратор системы"),
]


# Дефолтные категории для каждого типа сущности.
# Заполняются при первом запуске для удобства начала работы.
# Существующие категории с теми же именами не дублируются.
DEFAULT_KPI_CATEGORIES = [
    ("Производство",      "Показатели выработки и производственного цикла"),
    ("Безопасность",      "Показатели промышленной и радиационной безопасности"),
    ("Персонал",          "Кадровые показатели: численность, квалификация, обучение"),
    ("Финансы",           "Финансово-экономические показатели подразделений"),
    ("ИТ-инфраструктура", "Мониторинг доступности и производительности ИТ-систем"),
    ("Качество",          "Показатели качества продукции и процессов"),
]

DEFAULT_DATASOURCE_CATEGORIES = [
    ("Производственные данные", "Данные с производства и оборудования"),
    ("Кадровые системы",        "Данные отдела кадров и HR"),
    ("Финансовые данные",       "Бухгалтерские и финансовые системы"),
    ("ИТ-системы",              "Мониторинг и логи ИТ-инфраструктуры"),
    ("Внешние данные",          "Импортируемые отчёты и сторонние источники"),
]

DEFAULT_WIDGET_CATEGORIES = [
    ("Производство", "Виджеты по производственным показателям"),
    ("Безопасность", "Виджеты по показателям безопасности"),
    ("Персонал",     "Виджеты по кадровым показателям"),
    ("Финансы",      "Финансовые виджеты"),
    ("Качество",     "Виджеты качества"),
]

DEFAULT_DASHBOARD_CATEGORIES = [
    ("Для руководства",    "Стратегические показатели для руководящего состава"),
    ("Операционные",       "Оперативные дашборды по подразделениям"),
    ("Безопасность",       "Мониторинг показателей безопасности"),
    ("ИТ-инфраструктура",  "Состояние ИТ-систем"),
    ('Финансы', 'Финансовые показатели')
]


def ensure_schema():
    """Создаёт все таблицы по моделям SQLAlchemy, если их ещё нет.

    Запускается перед заполнением справочников. Метод db.create_all()
    идемпотентен: создаёт только отсутствующие таблицы, существующие не
    трогает. Это даёт работающую схему даже без миграций Flask-Migrate —
    что удобно для развёртывания «с нуля» в Docker.

    Если в проекте используются миграции, они должны быть применены до
    запуска этого скрипта. Тогда create_all не создаст ничего нового.
    """
    db.create_all()
    print("[bootstrap] Схема БД проверена/создана", flush=True)


def ensure_roles():
    """Создаёт базовые роли, если их нет."""
    for name, description in DEFAULT_ROLES:
        existing = db.session.query(Role).filter_by(name=name).first()
        if not existing:
            db.session.add(Role(name=name, description=description))
    db.session.commit()


def ensure_categories():
    """Создаёт базовые категории для всех типов сущностей.

    Срабатывает при первом запуске (или после очистки тома БД). Существующие
    категории с теми же именами не дублируются благодаря ограничению
    уникальности по name. Если администратор позже добавит/переименует
    категории — этот скрипт их не тронет.
    """
    seeds = [
        (KPICategory, DEFAULT_KPI_CATEGORIES, "KPI"),
        (DataSourceCategory, DEFAULT_DATASOURCE_CATEGORIES, "источников"),
        (WidgetCategory, DEFAULT_WIDGET_CATEGORIES, "виджетов"),
        (DashboardCategory, DEFAULT_DASHBOARD_CATEGORIES, "дашбордов"),
    ]
    created_total = 0
    for Model, defaults, label in seeds:
        created = 0
        for name, description in defaults:
            existing = db.session.query(Model).filter_by(name=name).first()
            if not existing:
                db.session.add(Model(name=name, description=description))
                created += 1
        if created:
            print(
                f"[bootstrap] Создано {created} категорий {label}",
                flush=True,
            )
            created_total += created
    if created_total:
        db.session.commit()


def ensure_admin():
    """Создаёт или обновляет пользователя-администратора.

    Логика:
    1. Если пользователя с email ADMIN_EMAIL нет — создаём с указанным паролем.
    2. Если есть, но без роли admin — выдаём ему роль.
    3. Если есть и роль уже есть — обычно ничего не делаем.
       Если установлена переменная ADMIN_RESET_PASSWORD=true, дополнительно
       сбрасываем пароль на ADMIN_PASSWORD из окружения. Это позволяет
       восстановить доступ при забытом пароле, не пересоздавая БД.
    """
    admin_role = db.session.query(Role).filter_by(name="admin").first()
    if admin_role is None:
        print("[bootstrap] Роль 'admin' не найдена, прерываю", flush=True)
        return False

    username = os.getenv("ADMIN_USERNAME", "admin")
    email = os.getenv("ADMIN_EMAIL", "admin@local")
    password = os.getenv("ADMIN_PASSWORD", "admin")
    reset_password = os.getenv("ADMIN_RESET_PASSWORD", "").lower() == "true"

    existing_user = db.session.query(User).filter_by(email=email).first()

    if existing_user:
        changed = False
        # Гарантируем наличие роли admin
        if admin_role not in existing_user.roles:
            existing_user.roles = list(set(existing_user.roles + [admin_role]))
            changed = True
            print(
                f"[bootstrap] Пользователю {email} выдана роль admin",
                flush=True,
            )
        # Опционально сбрасываем пароль
        if reset_password:
            existing_user.password_hash = bcrypt.hashpw(
                password.encode("utf-8"), bcrypt.gensalt(),
            ).decode("utf-8")
            existing_user.status = "active"
            changed = True
            print(
                f"[bootstrap] Сброшен пароль администратора {email} "
                f"(ADMIN_RESET_PASSWORD=true)",
                flush=True,
            )
        if changed:
            db.session.commit()
        else:
            # Проверим, совпадает ли пароль из env с тем, что в БД.
            # Если расходятся — выведем подсказку, как сбросить.
            try:
                env_matches = bcrypt.checkpw(
                    password.encode("utf-8"),
                    existing_user.password_hash.encode("utf-8"),
                )
            except (ValueError, TypeError):
                env_matches = False

            if env_matches:
                print(
                    f"[bootstrap] Администратор {email} существует, "
                    f"пароль соответствует ADMIN_PASSWORD",
                    flush=True,
                )
            else:
                print(
                    f"[bootstrap] ВНИМАНИЕ: администратор {email} существует, "
                    f"но его текущий пароль НЕ совпадает с ADMIN_PASSWORD",
                    flush=True,
                )
                print(
                    f"[bootstrap]   Возможные причины:",
                    flush=True,
                )
                print(
                    f"[bootstrap]   1) В томе БД остался админ от прошлых запусков "
                    f"со старым паролем",
                    flush=True,
                )
                print(
                    f"[bootstrap]   2) Пароль был изменён через интерфейс приложения",
                    flush=True,
                )
                print(
                    f"[bootstrap]   Чтобы сбросить пароль на ADMIN_PASSWORD из .env, "
                    f"задайте ADMIN_RESET_PASSWORD=true и перезапустите контейнер",
                    flush=True,
                )
        return changed

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
            ensure_categories()
            ensure_admin()
        except Exception as e:
            print(f"[bootstrap] Ошибка: {e}", flush=True)
            sys.exit(1)


if __name__ == "__main__":
    main()