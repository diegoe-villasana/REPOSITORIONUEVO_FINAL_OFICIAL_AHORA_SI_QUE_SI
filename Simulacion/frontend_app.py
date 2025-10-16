from flask import Flask, jsonify, request, render_template
from dotenv import load_dotenv
import os
from pathlib import Path
import sys
from Controllers import calculos
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates\HTML")
CORS(app)

# Load environment variables from .env (if present) and propagate to app config
# Load .env explicitly from the project folder next to this file to avoid
# issues when the server is started with a different working directory.
base = Path(__file__).parent
dotenv_path = base / '.env'
load_dotenv(dotenv_path=str(dotenv_path))
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
app.config['GEMINI_MODEL'] = os.getenv('GEMINI_MODEL', 'gemini-2.5-pro')

# Debug: print whether key was loaded (mask value) so we can see it in logs
gk = app.config.get('GEMINI_API_KEY')
if gk:
    print('GEMINI_API_KEY loaded (masked):', gk[:4] + '...' )
else:
    print('GEMINI_API_KEY not found in .env')

# Try to register API blueprint from package or local module. This attempts
# multiple import strategies so endpoints under /api are available whether the
# app is started via the package (`python -m run`) or directly (`python app.py`).
import importlib.util
from pathlib import Path
def _register_api_blueprint(app):
    # 1) Prefer package import (app.routes)
    try:
        from app.routes import bp as api_bp
        app.register_blueprint(api_bp)
        return True
    except Exception:
        pass

    # 2) Try direct module import (routes.py in same folder)
    try:
        from routes import bp as api_bp
        app.register_blueprint(api_bp)
        return True
    except Exception:
        pass

    # 3) As a last resort, load the routes.py file by path and import
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


# If registration failed, provide local fallback endpoints so the UI can call
# /api/simulate and /api/intensity. These mirror the logic used in the blueprint
# and ensure the frontend works even if blueprint import fails.
if not _register_api_blueprint(app):
    from services import get_gemini_analysis
    import utils as local_utils
    from flask import request, jsonify

    @app.route('/api/simulate', methods=['POST'])
    def simulate_impact_fallback():
        data = request.get_json() or {}
        if not data or 'meteorite' not in data or 'location' not in data:
            return jsonify({'error': 'Datos de entrada inválidos'}), 400
        try:
            location = data['location']
            if 'lat' not in location or 'lng' not in location:
                return jsonify({'error': "location debe contener 'lat' y 'lng'"}), 400
            meteorite = data['meteorite']
            diameter = float(meteorite.get('diameter', 0))
            velocity = float(meteorite.get('velocity', 0))
            density = float(meteorite.get('density', 0))

            energy = local_utils.calculate_impact_energy(diameter, velocity, density)
            crater = local_utils.calculate_crater_diameter(energy)

            meteorite_data_for_gemini = {
                'diameter': diameter, 'velocity': velocity, 'density': density,
                'energy': energy, 'crater_diameter': crater
            }
            try:
                gemini_result = get_gemini_analysis(meteorite_data_for_gemini, location)
                if isinstance(gemini_result, dict):
                    if 'error' in gemini_result:
                        normalized = {'text': f"Error from Gemini service: {gemini_result['error']}"}
                    else:
                        normalized = gemini_result
                elif isinstance(gemini_result, str):
                    normalized = {'text': gemini_result}
                else:
                    normalized = {'text': str(gemini_result)}
            except Exception as e:
                normalized = {'text': f'Exception calling Gemini: {type(e).__name__}: {e}'}
                print('Exception in get_gemini_analysis:', type(e).__name__, e)

            return jsonify({
                'impact_effects': {'energy_megatons': round(energy,2), 'crater_diameter_meters': round(crater,2)},
                'location': location,
                'gemini_analysis': normalized
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    @app.route('/api/intensity', methods=['POST'])
    def api_intensity_fallback():
        data = request.get_json() or {}
        try:
            diameter = float(data.get('diameter', 0))
            velocity = float(data.get('velocity', 0))
            density = float(data.get('density', 0))
            energy = local_utils.calculate_impact_energy(diameter, velocity, density)
            crater = local_utils.calculate_crater_diameter(energy)
            intensity = round(energy, 4)
            return jsonify({'intensity': intensity, 'energy_megatons': round(energy,4), 'crater_diameter_meters': round(crater,2)})
        except Exception as e:
            return jsonify({'error': str(e)}), 400


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
