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
