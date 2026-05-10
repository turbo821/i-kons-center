from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

from app.database.db import db
from app.config import Config

import app.models  # noqa: F401

from app.routes.auth_routes import auth_bp
from app.routes.datasource_routes import datasource_bp
from app.routes.dataset_routes import dataset_bp
from app.routes.metric_routes import metric_bp
from app.routes.dimension_routes import dimension_bp
from app.routes.widget_routes import widget_bp
from app.routes.dashboard_routes import dashboard_bp


jwt = JWTManager()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    app.register_blueprint(auth_bp)
    app.register_blueprint(datasource_bp)
    app.register_blueprint(dataset_bp)
    app.register_blueprint(metric_bp)
    app.register_blueprint(dimension_bp)
    app.register_blueprint(widget_bp)
    app.register_blueprint(dashboard_bp)

    return app
