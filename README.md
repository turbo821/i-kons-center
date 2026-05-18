# I-Kons Center

**Инструмент бизнес-аналитики для информационного центра предприятия атомной отрасли**

Веб-приложение для построения дашбордов, виджетов и KPI на основе данных из различных источников. Концептуально аналогично Microsoft Power BI и Visiology, но спроектировано с учётом специфики отрасли — в том числе поддерживает KPI с направлением «меньше — лучше» (для показателей безопасности и аварийности).

---

## 🎯 Возможности

- **Источники данных**: подключение CSV/Excel-файлов, баз данных PostgreSQL и MySQL
- **Наборы данных**: автоматическая инспекция структуры с определением типов полей
- **Семантический слой**: переиспользуемые метрики (sum/avg/min/max/count) и измерения с пользовательскими подписями для осей графиков
- **Конструктор виджетов**: 5 типов визуализации (bar / line / pie / table / KPI) с фильтрами и агрегациями
- **Дашборды**:
  - drag-and-drop компоновка на сетке (react-grid-layout)
  - **текстовые блоки** (заметки, заголовки, подписи) с настройкой размера шрифта и выравнивания
  - **закрепление дашбордов** на главной странице
  - **экспорт в PDF** через html2canvas + jsPDF
- **KPI**: автоматический расчёт из метрик с прогресс-баром выполнения цели и поддержкой обоих направлений (higher_better / lower_better)
- **Категории** для дашбордов, виджетов, KPI и источников данных
- **Управление пользователями**: RBAC с тремя ролями (admin / expert / viewer)
- **Глобальный поиск** по сущностям (Ctrl+K) — дашборды, виджеты, KPI, источники данных, наборы данных

## 🛠 Технологический стек

| Слой | Технология |
| --- | --- |
| Backend | Python 3.12, Flask, SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, bcrypt |
| Анализ данных | pandas, openpyxl (Excel), psycopg2 (Postgres), PyMySQL |
| База данных | PostgreSQL 16 |
| Frontend | React 19, React Router 7, Axios, Tailwind CSS |
| Визуализация | Recharts, react-grid-layout |
| Экспорт | html2canvas, jsPDF |
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
│   └── scripts/                 # SQL для initdb (роли, категории, расширения)
│       ├── 01-create-roles.sql
│       ├── 02-kpi-categories.sql
│       ├── 03-datasource-categories.sql
│       ├── 04-widget-categories.sql
│       ├── 05-dashboard-categories.sql
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
- Категории KPI, виджетов, дашбордов и источников данных
- Поле `is_pinned` и таблица `dashboard_texts` (через скрипт `06-dashboard-extensions.sql`)

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
npm install     # включает html2canvas и jspdf для экспорта в PDF
npm start
```

Frontend будет доступен на http://localhost:3000.

---

## 📊 Архитектура

### Слои backend

1. **Модели (`app/models/`)** — SQLAlchemy ORM, описывают структуру БД
2. **Сервисы (`app/services/`)** — бизнес-логика:
   - `datasource_service.py` — единый интерфейс работы с CSV/Postgres/MySQL
   - `widget_data_service.py` — pandas-pipeline агрегации данных для виджетов; использует пользовательские имена метрик и измерений как ключи колонок результата
   - `kpi_service.py` — расчёт фактических значений KPI с учётом направления цели
3. **Маршруты (`app/routes/`)** — REST API blueprints, обработка HTTP

### Pipeline обработки данных

Источник → DataFrame (pandas) → фильтры → группировка → агрегация → JSON для recharts

Все типы источников приводятся к единому `pandas.DataFrame`, что обеспечивает унифицированную обработку независимо от провайдера данных. Имена колонок в результирующем JSON соответствуют пользовательским подписям метрик и измерений — благодаря этому подписи автоматически появляются на осях и в легенде графиков без отдельного маппинга.

### Композиция дашборда

Дашборд содержит три типа элементов в едином layout-массиве (`items[].kind`):

- **`widget`** — виджет из общего пула (через `DashboardWidget` с координатами);
- **`kpi`** — KPI-карточка (через `DashboardKPI` с координатами);
- **`text`** — текстовый блок (модель `DashboardText`, привязан к дашборду напрямую, с `font_size` и `text_align`).

Layout сохраняется одним `PUT /api/dashboards/<id>/layout`, который принимает позиции и размеры для всех трёх типов сразу.

### Экспорт в PDF

Кнопка «PDF» на странице дашборда делает снимок DOM-области сетки через `html2canvas` (с увеличенной высотой и нижним паддингом, чтобы не обрезались подписи) и вкладывает результат в A4-альбом через `jsPDF`. Библиотеки подгружаются через динамический `import()` — основной JS-бандл не утяжеляется до первого использования экспорта.

### Роли и разграничение прав

- **admin** — полный доступ + управление пользователями
- **expert** — создание и редактирование источников, виджетов, дашбордов, KPI
- **viewer** — только просмотр аналитики

При регистрации новый пользователь автоматически получает роль `viewer`. Назначить дополнительные роли может только администратор через страницу управления пользователями.

---

## 🗄 Схема данных

Ключевые архитектурные решения:
- **M:N связи через association objects** с дополнительными атрибутами:
  - `DashboardWidget` — позиции виджетов на дашборде;
  - `DashboardKPI` — позиции KPI на дашборде.
- **`DashboardText`** — текстовые блоки хранятся напрямую при дашборде без отдельной таблицы-связки (они не переиспользуются между дашбордами). Содержат собственные координаты и оформление.
- **`Dashboard.is_pinned`** (Boolean) — закрепление дашборда на главной; сортировка `is_pinned DESC, created_at DESC` обеспечивает «закреплённые сверху» во всех листингах.
- **Семантический слой**: метрики и измерения являются самостоятельными сущностями, переиспользуемыми между виджетами (через `WidgetMetric` и `WidgetDimension`). Их `name` используется как заголовок колонки в результирующих данных виджета — поэтому видим на графиках.
- **KPI с автоматическим расчётом**: связь с `Metric` обеспечивает синхронизацию показателей с данными.
- **Каскадные удаления**: настроены через `ondelete` в FK с учётом семантики (RESTRICT для критичных связей, CASCADE для подчинённых).

---

## 🧪 Демонстрационный сценарий

1. Войти как `admin@local` / `admin`
2. **Источники данных** → «Загрузить файл» → выбрать CSV (например, `sales.csv`)
3. Открыть источник → «Создать набор данных» → поля определятся автоматически
4. **Виджеты** → «Создать виджет» → выбрать датасет → создать метрику и измерение (можно указать кастомные подписи — они появятся на осях) → «Применить»
5. **Показатели KPI** → создать KPI на основе метрики, задать целевое значение
6. **Дашборды** → создать дашборд → «Редактировать» → добавить виджеты, KPI и текстовые блоки (с настройкой размера шрифта и выравнивания) → разместить drag-and-drop
7. Закрепить дашборд («Закрепить» в шапке) — он появится отдельным блоком на главной странице
8. Экспортировать дашборд в PDF через кнопку «PDF» в шапке дашборда

---

## 📝 Лицензия

MIT
