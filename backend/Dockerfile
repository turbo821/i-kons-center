FROM python:3.12-slim AS builder

# Системные зависимости для сборки
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir --user --upgrade pip \
    && pip install --no-cache-dir --user -r requirements.txt \
    && pip install --no-cache-dir --user gunicorn

# Финальный этап
FROM python:3.12-slim

# Только runtime зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && adduser --uid 1000 --disabled-password --gecos "" appuser

WORKDIR /app

# Копируем зависимости из builder
COPY --from=builder /root/.local /home/appuser/.local

# Копируем код
COPY . .

# Создаем нужные директории
RUN mkdir -p /app/uploads && \
    chown -R appuser:appuser /app && \
    chmod +x /app/entrypoint.sh

USER appuser

# Добавляем user site-packages в PATH
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

ENTRYPOINT ["/app/entrypoint.sh"]