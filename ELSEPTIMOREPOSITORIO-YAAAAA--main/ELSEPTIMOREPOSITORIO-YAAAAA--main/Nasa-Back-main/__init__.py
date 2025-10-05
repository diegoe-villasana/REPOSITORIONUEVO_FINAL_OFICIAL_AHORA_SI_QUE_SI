# app/__init__.py (Versión final sin NASA ni Google Maps)
import os
from dotenv import load_dotenv
from flask import Flask

load_dotenv()

class Config:
    """Clase de configuración para cargar las variables de entorno."""
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    with app.app_context():
        from . import routes
        app.register_blueprint(routes.bp)

    return app