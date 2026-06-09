#!/bin/sh
set -e

# 1. Ожидание готовности PostgreSQL
echo "[entrypoint] Ожидание PostgreSQL ($DB_HOST:$DB_PORT)..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] PostgreSQL готов"

# 2. Применение миграций (если папка migrations существует и непустая).
#    Если миграций нет — bootstrap_admin.py создаст таблицы через
#    db.create_all() на следующем шаге.
if [ -d /app/migrations/versions ] && [ "$(ls -A /app/migrations/versions 2>/dev/null)" ]; then
  echo "[entrypoint] Применение миграций..."
  flask db upgrade
else
  echo "[entrypoint] Миграции не найдены — схема будет создана через bootstrap"
fi

# 3. Инициализация системы (схема, роли, категории, админ)
echo "[entrypoint] Инициализация системы..."
python bootstrap_admin.py

# 4. Запуск приложения
if [ "${FLASK_ENV}" = "production" ] || [ "${GUNICORN_ENABLED}" = "true" ]; then
    echo "[entrypoint] Запуск Gunicorn (production)..."
    exec gunicorn --bind 0.0.0.0:5000 \
                  --workers ${GUNICORN_WORKERS:-4} \
                  --worker-class sync \
                  --timeout 120 \
                  --access-logfile - \
                  --error-logfile - \
                  run:app
else
    echo "[entrypoint] Запуск Flask dev server..."
    exec python run.py
fi