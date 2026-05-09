from app.database.db import db


class DataSource(db.Model):
    """
    Источник данных. Поддерживаемые типы (поле type):
      - 'csv'      — загруженный CSV/Excel-файл
      - 'postgres' — внешняя БД PostgreSQL
      - 'mysql'    — внешняя БД MySQL

    connection_string:
      - для csv: путь к файлу на сервере (uploads/...)
      - для postgres/mysql: SQLAlchemy URI или JSON с параметрами подключения
    """
    __tablename__ = "data_sources"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(150), nullable=False)

    type = db.Column(db.String(50), nullable=False)

    connection_string = db.Column(db.Text, nullable=False)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    # Кто создал источник (для аудита и разграничения)
    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Связи
    datasets = db.relationship(
        "Dataset",
        back_populates="datasource",
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": self.created_by,
        }
