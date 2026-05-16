# I-Kons Center

**Инструмент бизнес-аналитики для информационного центра предприятия атомной отрасли**

Веб-приложение для построения дашбордов, виджетов и KPI на основе данных из различных источников. Концептуально аналогично Microsoft Power BI и Visiology, но спроектировано с учётом специфики отрасли — в том числе поддерживает KPI с направлением «меньше — лучше» (для показателей безопасности и аварийности).

---

## 🎯 Возможности

- **Источники данных**: подключение CSV/Excel-файлов, баз данных PostgreSQL и MySQL
- **Наборы данных**: автоматическая инспекция структуры с определением типов полей
- **Семантический слой**: переиспользуемые метрики (sum/avg/min/max/count) и измерения
- **Конструктор виджетов**: 5 типов визуализации (bar/line/pie/table/KPI) с фильтрами и агрегациями
- **Дашборды**: drag-and-drop компоновка с использованием react-grid-layout
- **KPI**: автоматический расчёт из метрик с прогресс-баром выполнения цели и поддержкой обоих направлений (higher_better/lower_better)
- **Управление пользователями**: RBAC с тремя ролями (admin / expert / viewer)
- **Глобальный поиск** по сущностям (Ctrl+K)

## 🛠 Технологический стек

| Слой | Технология |
| --- | --- |
| Backend | Python 3.12, Flask, SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, bcrypt |
| Анализ данных | pandas, openpyxl (Excel), psycopg2 (Postgres), PyMySQL |
| База данных | PostgreSQL 16 |
| Frontend | React 19, React Router 7, Axios, Tailwind CSS |
| Визуализация | Recharts, react-grid-layout |
| Контейнеризация | Docker, Docker Compose |

## 📁 Структура проекта

```
i-kons-center/
├── backend/                     # Серверная часть (Flask)
│   ├── app/
│   │   ├── auth/                # JWT, декораторы ролей
│   │   ├── database/            # SQLAlchemy
│   │   ├── models/              # ORM-модели всех сущностей
│   │   ├── routes/              # REST API blueprints
│   │   ├── services/            # Бизнес-логика (агрегация, KPI, источники)
│   │   ├── config.py
│   │   └── __init__.py          # Фабрика приложения
│   ├── migrations/              # Миграции Alembic
│   ├── uploads/                 # Загруженные CSV/Excel
│   ├── bootstrap_admin.py       # Авто-создание администратора
│   ├── entrypoint.sh            # Скрипт инициализации контейнера
│   ├── Dockerfile
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                    # Клиентская часть (React)
│   ├── src/
│   │   ├── api/                 # HTTP-клиенты API
│   │   ├── components/          # Переиспользуемые компоненты
│   │   ├── context/             # AuthContext, ToastContext, ConfirmContext
│   │   ├── pages/               # Страницы приложения
│   │   ├── router/              # AppRouter, RoleRoute
│   │   └── services/api.js      # Axios-клиент
│   ├── Dockerfile
│   ├── package.json
│   └── tailwind.config.js
│
├── db/
│   └── scripts/                 # SQL для initdb (роли, категории KPI)
│       ├── 01-create-roles.sql
│       └── 02-create-kpi-categories.sql
│
├── docker-compose.yml
├── er.puml                      # ER-диаграмма (PlantUML)
└── README.md
```

---

## 🚀 Запуск через Docker (рекомендуемый)

Требуется установленный **Docker** и **Docker Compose**.

```bash
# 1. Клонировать репозиторий
git clone <repository-url> i-kons-center
cd i-kons-center

# 2. Запустить весь стек одной командой
docker compose up -d --build

# 3. Применить миграции (один раз — при первом запуске)
docker compose exec backend flask db upgrade
```

После этого приложение доступно:
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432 (postgres / postgres / infocenter)

При первом запуске автоматически создаётся:
- Учётные данные администратора (по умолчанию `admin@local` / `admin`)
- Базовые роли (admin, expert, viewer)
- Категории KPI (Производство, Безопасность, Персонал, Финансы, ИТ-инфраструктура, Качество)

### Если миграции ещё не созданы

В свежем проекте папки `backend/migrations` нет. Тогда сначала:

```bash
docker compose exec backend flask db init
docker compose exec backend flask db migrate -m "initial schema"
docker compose exec backend flask db upgrade
```

### Полная пересборка с очисткой

```bash
docker compose down -v       # удаляет тома postgres_data и uploads_data
docker compose up -d --build
```

---

## 🔐 Настройка администратора

Учётные данные администратора задаются переменными окружения. По умолчанию:
- `ADMIN_USERNAME=admin`
- `ADMIN_EMAIL=admin@local`
- `ADMIN_PASSWORD=admin`

Чтобы изменить — отредактируйте `docker-compose.yml` в секции `backend.environment` или создайте `.env` рядом с `docker-compose.yml`:

```env
ADMIN_USERNAME=ivanov
ADMIN_EMAIL=ivanov@example.com
ADMIN_PASSWORD=very-strong-password
```

Логика создания администратора **идемпотентна**: если в системе уже есть пользователь с ролью `admin`, повторное создание не выполняется.

---

## 💻 Локальный запуск без Docker

Требуется: **Python 3.12**, **Node.js 20+**, локальный **PostgreSQL 16**.

### 1. PostgreSQL

```bash
# Создать БД и пользователя
psql -U postgres -c "CREATE DATABASE infocenter;"

# Выполнить инициализационные SQL
psql -U postgres -d infocenter -f db/scripts/01-create-roles.sql
psql -U postgres -d infocenter -f db/scripts/02-kpi-categories.sql
psql -U postgres -d infocenter -f db/scripts/03-datasource-categories.sql
psql -U postgres -d infocenter -f db/scripts/04-widget-categories.sql
psql -U postgres -d infocenter -f db/scripts/05-dashboard-categories.sql
```

### 2. Backend

```bash
cd backend

# Виртуальное окружение
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Зависимости
pip install --upgrade pip
pip install -r requirements.txt

# Переменные окружения для подключения к локальной БД
# Windows (PowerShell):
$env:DB_HOST = "localhost"
$env:ADMIN_EMAIL = "admin@local"
$env:ADMIN_PASSWORD = "admin"

# Миграции
flask db init                            # один раз
flask db migrate -m "initial schema"
flask db upgrade

# Создание администратора
python bootstrap_admin.py

# Запуск сервера
python run.py
```

Backend будет доступен на http://localhost:5000.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend будет доступен на http://localhost:3000.

---

## 📊 Архитектура

### Слои backend

1. **Модели (`app/models/`)** — SQLAlchemy ORM, описывают структуру БД
2. **Сервисы (`app/services/`)** — бизнес-логика:
   - `datasource_service.py` — единый интерфейс работы с CSV/Postgres/MySQL
   - `widget_data_service.py` — pandas-pipeline агрегации данных для виджетов
   - `kpi_service.py` — расчёт фактических значений KPI с учётом направления цели
3. **Маршруты (`app/routes/`)** — REST API blueprints, обработка HTTP

### Pipeline обработки данных

Источник → DataFrame (pandas) → фильтры → группировка → агрегация → JSON для recharts

Все типы источников приводятся к единому pandas.DataFrame, что обеспечивает унифицированную обработку независимо от провайдера данных.

### Роли и разграничение прав

- **admin** — полный доступ + управление пользователями
- **expert** — создание и редактирование источников, виджетов, дашбордов, KPI
- **viewer** — только просмотр аналитики

При регистрации новый пользователь автоматически получает роль `viewer`. Назначить дополнительные роли может только администратор через страницу управления пользователями.

---

## 🗄 Схема данных

ER-диаграмма приведена в файле `er.puml` (формат PlantUML).

Ключевые архитектурные решения:
- **M:N связи через association objects** с дополнительными атрибутами:
  - `DashboardWidget` — позиции виджетов на дашборде
  - `DashboardKPI` — позиции KPI на дашборде
- **Семантический слой**: метрики и измерения являются самостоятельными сущностями, переиспользуемыми между виджетами (через `WidgetMetric` и `WidgetDimension`)
- **KPI с автоматическим расчётом**: связь с `Metric` обеспечивает синхронизацию показателей с данными
- **Каскадные удаления**: настроены через `ondelete` в FK с учётом семантики (RESTRICT для критичных связей, CASCADE для подчинённых)

---

## 🧪 Демонстрационный сценарий

1. Войти как `admin@local` / `admin`
2. **Источники данных** → «Загрузить файл» → выбрать CSV (например, `sales.csv`)
3. Открыть источник → «Создать набор данных» → поля определятся автоматически
4. **Виджеты** → «Создать виджет» → выбрать датасет → добавить метрику и измерение → «Применить»
5. **Показатели KPI** → создать KPI на основе метрики, задать целевое значение
6. **Дашборды** → создать дашборд → «Редактировать» → добавить виджеты и KPI → разместить drag-and-drop

---

## 📝 Лицензия

MIT
