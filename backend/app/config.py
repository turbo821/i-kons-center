import os
from datetime import timedelta


class Config:
    # Database
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "infocenter")

    # Явно указываем client_encoding=utf8 — иначе psycopg2 на Windows
    # с локалью cp1251 пытается декодировать дефолты libpq как UTF-8
    # и падает с UnicodeDecodeError.
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        f"?client_encoding=utf8"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Дополнительные параметры engine — передаём явные client_encoding
    # и connect_args на случай, если URI-параметр не прочитается.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {
            "client_encoding": "utf8",
        }
    }

    # JWT
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "change-me-in-production"
    )

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # Загрузка файлов
    UPLOAD_FOLDER = os.getenv(
        "UPLOAD_FOLDER",
        os.path.join(os.path.dirname(__file__), "..", "uploads")
    )

    MAX_CONTENT_LENGTH = 50 * 1024 * 1024

    ALLOWED_FILE_EXTENSIONS = {"csv", "xls", "xlsx"}