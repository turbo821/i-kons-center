# i-kons-center
Инструмент бизнес-аналитики для информационного центра

## 🛠 Технологии
* **Backend:** Python, Flask
* **Frontend:** React

---

## 🚀 Инструкция по запуску

Для работы проекта вам понадобятся установленные **Python 3.12**, **Node.js** и **npm**.

### 1. Настройка Backend
Откройте терминал и перейдите в директорию бэкенда:

```bash
cd backend

# Создание виртуального окружения
python -m venv venv

# Активация окружения (Windows)
venv\Scripts\activate

# Активация окружения (macOS/Linux)
source venv/bin/activate

# Установка зависимостей
pip install --upgrade pip
pip install -r requirements.txt
pip install --only-binary :all: psycopg2-binary

# Миграции

# один раз
flask db init
flask db migrate -m "initial schema"
flask db upgrade

# Запуск сервера
python run.py
```

### 2. Настройка Frontend
Откройте второе окно терминала и перейдите в директорию фронтенда:

```bash
cd frontend

# Установка пакетов
npm install

# Запуск приложения в режиме разработки
npm start
```

Приложение будет доступно по адресу: [http://localhost:3000](http://localhost:3000)

---

## 📁 Структура проекта
* `backend/` — исходный код серверной части.
* `frontend/` — исходный код клиентской части.

## Команды для запуска и применения миграций

```bash
# 1. Если Postgres уже запускался ранее — снести том,
# чтобы initdb-скрипты выполнились заново:
docker compose down -v

# 2. Поднять стек:
docker compose up -d --build

# 3. Создать первую миграцию (внутри контейнера backend):
docker compose exec backend flask db init        # один раз
docker compose exec backend flask db migrate -m "initial schema"
docker compose exec backend flask db upgrade

# 4. Проверить:
docker compose exec db psql -U postgres -d infocenter -c "\dt"
# Должно вывести: users, roles, user_roles, data_sources,
# datasets, dataset_fields, metrics, dimensions, filters,
# dashboards, widgets, categories, kpis, dashboard_kpis,
# alembic_version
```
