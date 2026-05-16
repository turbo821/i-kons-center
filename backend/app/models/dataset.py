from app.database.db import db


class Dataset(db.Model):
    """
    Набор данных, построенный поверх источника.
    Для CSV sql_query может быть пустым (берётся весь файл).
    Для SQL — это произвольный SELECT-запрос.
    """
    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)

    datasource_id = db.Column(
        db.Integer,
        db.ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False
    )

    name = db.Column(db.String(200), nullable=False)

    # Имя поля 'query' зарезервировано Flask-SQLAlchemy для Model.query —
    # используем sql_query, чтобы избежать конфликта.
    sql_query = db.Column(db.Text, nullable=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    # Связи
    datasource = db.relationship(
        "DataSource",
        back_populates="datasets"
    )

    fields = db.relationship(
        "DatasetField",
        back_populates="dataset",
        cascade="all, delete-orphan"
    )

    widgets = db.relationship(
        "Widget",
        back_populates="dataset"
    )

    def to_dict(self, include_fields=False):
        # Считаем зависимые сущности — для определения, можно ли редактировать
        metrics_count = sum(len(f.metrics) for f in self.fields)
        dimensions_count = sum(len(f.dimensions) for f in self.fields)

        data = {
            "id": self.id,
            "name": self.name,
            "datasource_id": self.datasource_id,
            "datasource_name": (
                self.datasource.name if self.datasource else None
            ),
            "datasource_category_name": (
                self.datasource.category.name
                if self.datasource and self.datasource.category else None
            ),
            "query": self.sql_query,
            "sql_query": self.sql_query,
            "fields": [f.to_dict() for f in self.fields],
            "widgets_count": len(self.widgets),
            "metrics_count": metrics_count,
            "dimensions_count": dimensions_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_fields:
            data["fields"] = [f.to_dict() for f in self.fields]
        
        return data

class DatasetField(db.Model):
    """
    Поле набора данных. data_type принимает значения:
      'string', 'integer', 'float', 'boolean', 'date', 'datetime'
    """
    __tablename__ = "dataset_fields"

    id = db.Column(db.Integer, primary_key=True)

    dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False
    )

    name = db.Column(db.String(200), nullable=False)

    data_type = db.Column(db.String(50), nullable=False)

    # Связи
    dataset = db.relationship(
        "Dataset",
        back_populates="fields"
    )

    metrics = db.relationship(
        "Metric",
        back_populates="field",
        cascade="all, delete-orphan"
    )

    dimensions = db.relationship(
        "Dimension",
        back_populates="field",
        cascade="all, delete-orphan"
    )

    filters = db.relationship(
        "Filter",
        back_populates="field",
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "name": self.name,
            "data_type": self.data_type,
        }
