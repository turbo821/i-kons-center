from app.database.db import db


class Dashboard(db.Model):
    __tablename__ = "dashboards"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(150), nullable=False)

    description = db.Column(db.Text, nullable=True)

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("dashboard_categories.id", ondelete="SET NULL"),
        nullable=True
    )

    # Закреплён ли дашборд на главной странице
    is_pinned = db.Column(
        db.Boolean,
        nullable=False,
        server_default=db.text("false"),
        default=False,
    )

    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    creator = db.relationship(
        "User",
        back_populates="dashboards"
    )
    
    category = db.relationship(
        "DashboardCategory",
        back_populates="dashboards"
    )

    dashboard_widgets = db.relationship(
        "DashboardWidget",
        back_populates="dashboard",
        cascade="all, delete-orphan"
    )

    dashboard_kpis = db.relationship(
        "DashboardKPI",
        back_populates="dashboard",
        cascade="all, delete-orphan"
    )

    # Текстовые элементы на дашборде (подписи, заметки)
    dashboard_texts = db.relationship(
        "DashboardText",
        back_populates="dashboard",
        cascade="all, delete-orphan"
    )

    # Технический shortcut: KPI напрямую (без позиций)
    kpis = db.relationship(
        "KPI",
        secondary="dashboard_kpis",
        back_populates="dashboards",
        viewonly=True,
        overlaps="dashboard_kpis,dashboard_links"
    )

    def to_dict(self, include_widgets=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "is_pinned": bool(self.is_pinned),
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_widgets:
            # Единый массив элементов: виджеты, KPI и текстовые блоки.
            # Поле kind помогает фронту отрисовать правильный компонент.
            items = []

            for dw in self.dashboard_widgets:
                if dw.widget is None:
                    continue
                items.append({
                    "kind": "widget",
                    "ref_id": dw.widget.id,
                    **dw.widget.to_dict(),
                    "position_x": dw.position_x,
                    "position_y": dw.position_y,
                    "width": dw.width,
                    "height": dw.height,
                })

            for dk in self.dashboard_kpis:
                if dk.kpi is None:
                    continue
                items.append({
                    "kind": "kpi",
                    "ref_id": dk.kpi.id,
                    **dk.kpi.to_dict(),
                    "position_x": dk.position_x,
                    "position_y": dk.position_y,
                    "width": dk.width,
                    "height": dk.height,
                })

            for dt in self.dashboard_texts:
                items.append({
                    "kind": "text",
                    "ref_id": dt.id,
                    "content": dt.content,
                    "font_size": dt.font_size or "base",
                    "text_align": dt.text_align or "left",
                    "position_x": dt.position_x,
                    "position_y": dt.position_y,
                    "width": dt.width,
                    "height": dt.height,
                })

            data["items"] = items

        return data
