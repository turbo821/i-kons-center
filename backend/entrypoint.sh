#!/bin/sh
set -e

# Ожидание готовности БД
echo "[entrypoint] Ожидание PostgreSQL ($DB_HOST:$DB_PORT)..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] PostgreSQL готов"

# Применение миграций
echo "[entrypoint] Применение миграций..."
flask db upgrade || {
  echo "[entrypoint] Миграции не применились — возможно, ещё не инициализированы"
  echo "[entrypoint] Запустите 'flask db init' и 'flask db migrate' один раз вручную"
}

# Создание администратора
echo "[entrypoint] Проверка администратора..."
python bootstrap_admin.py

# Запуск приложения через gunicorn (для production)
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