import os
from flask import Flask
from flask_cors import CORS
from config import Config
from flask_migrate import Migrate
from models import db
from routes import register_routes
from flask import send_from_directory

app = Flask(__name__)
app.config.from_object(Config)

CORS(app)

db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
    db.create_all()

register_routes(app)

@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory("uploads", filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)