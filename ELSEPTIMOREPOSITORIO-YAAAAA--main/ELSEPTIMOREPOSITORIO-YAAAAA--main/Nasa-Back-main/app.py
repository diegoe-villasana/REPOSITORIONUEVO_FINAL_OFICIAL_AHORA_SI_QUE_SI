from flask import Flask, jsonify, request, render_template
import sys
from Controllers import calculos
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates\HTML")
CORS(app)

# Load .env from the project folder to populate GEMINI_API_KEY when running
# this module directly (so services.get_gemini_analysis can read it).
from dotenv import load_dotenv
import os
from pathlib import Path
base = Path(__file__).parent
dotenv_path = base / '.env'
load_dotenv(dotenv_path=str(dotenv_path))
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
app.config['GEMINI_MODEL'] = os.getenv('GEMINI_MODEL', 'gemini-2.5-pro')
gk = app.config.get('GEMINI_API_KEY')
if gk:
    print('GEMINI_API_KEY loaded (masked):', gk[:4] + '...' )
else:
    print('GEMINI_API_KEY not found in .env or environment')

import importlib.util
from pathlib import Path

def _register_api_blueprint(app):
    try:
        from app.routes import bp as api_bp
        app.register_blueprint(api_bp)
        return True
    except Exception:
        pass
    try:
        from routes import bp as api_bp
        app.register_blueprint(api_bp)
        return True
    except Exception:
        pass
    try:
        base = Path(__file__).parent
        routes_path = base / 'routes.py'
        if routes_path.exists():
            spec = importlib.util.spec_from_file_location('app.routes', str(routes_path))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if hasattr(module, 'bp'):
                app.register_blueprint(getattr(module, 'bp'))
                return True
    except Exception:
        pass
    return False


# Attempt to register the API blueprint from different possible locations so
# endpoints under /api (e.g. /api/simulate) are available regardless of how the
# app is started.
if not _register_api_blueprint(app):
    print('Warning: api blueprint not registered (no app.routes or routes.py found)')



@app.route("/")
def home():
    return render_template("index.html")

@app.route("/simulacion")
def simulacion():
    return render_template("simulacion.html")

@app.route("/meteoritos")
def meteoritos():
    return render_template("meteoritos.html")

@app.route("/index")
def index():
    return render_template("index.html")

@app.route("/fuentes")
def fuerntes():
    return render_template("fuentes.html")
    

@app.route("/lista", methods=["GET"])
def lista_meteoros():
    names = calculos.Listameteoros()
    if names:
        return jsonify(names)
    return jsonify({"error": "No encontrado"})

@app.route("/infoasteroide", methods=["GET"])
def info_asteroide():#no pasar parametro ya esta en si en la peticion
    name = request.args.get("name")
    info = calculos.infoasteroide(name)
    if info:
        return jsonify(info)
    return jsonify({"error": "No encontrado"}), 404

@app.route("/velocidad", methods=["GET"])
def velocidad():
    name = request.args.get("velocidad")
    info = calculos.velocidad(name)
    if info:
        return jsonify(info)
    return jsonify({"error": "No encontrado"}), 404

@app.route("/todos", methods=["GET"])
def todos():
    name = request.args.get("name")
    if not name:
        return jsonify({"error": "Falta el parámetro 'name'"}), 400
    info = calculos.todos(name)
    if info:
        impact_stats = info.get("impact_stats", {})
        return jsonify({
            "nombreElemento": info.get("name", "N/A"),
            "velocidad": info.get("velocity", "N/A"),
            "tamano": info.get("diameter_meters", "N/A"),
            "orbita": info.get("orbit_radius_au", "N/A"),
            "scale_category": impact_stats.get("scale_category", "N/A"),
            "energy_megatons": impact_stats.get("energy_megatons", "N/A"),
            
        })
    return jsonify({"error": "No encontrado"}), 404



@app.route("/lista_mayor_impacto", methods=["GET"])
def lista_mayor_impacto():
    top5 = calculos.top_impacto(5)
    return jsonify(top5)

if __name__ == "__main__":
    app.run(debug=True)
