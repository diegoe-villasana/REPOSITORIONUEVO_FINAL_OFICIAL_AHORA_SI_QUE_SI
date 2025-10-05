# app/routes.py (Versión sin Google Maps)

from flask import request, jsonify, Blueprint
import services
import utils
from flask import current_app

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/neos', methods=['GET'])
def get_neos():
    """Endpoint para obtener la lista de Objetos Cercanos a la Tierra."""
    neos_data = services.get_nasa_neos()
    if "error" in neos_data:
        return jsonify(neos_data), 500
    return jsonify(neos_data)

@bp.route('/simulate', methods=['POST'])
def simulate_impact():
    """Endpoint principal para simular el impacto de un meteorito."""
    data = request.get_json()

    if not data or 'meteorite' not in data or 'location' not in data:
        return jsonify({"error": "Datos de entrada inválidos"}), 400

    try:
        location = data['location'] # Esperamos {'lat': ..., 'lng': ...}
        if 'lat' not in location or 'lng' not in location:
            return jsonify({'error': "location debe contener 'lat' y 'lng'"}), 400
        meteorite_params = data['meteorite']
        diameter = float(meteorite_params['diameter'])
        velocity = float(meteorite_params['velocity'])
        density = float(meteorite_params['density'])

        # 1. Realizar cálculos
        energy = utils.calculate_impact_energy(diameter, velocity, density)
        crater_diameter = utils.calculate_crater_diameter(energy)

        # 2. Obtener análisis de Gemini
        meteorite_data_for_gemini = {
            "diameter": diameter, "velocity": velocity, "density": density,
            "energy": energy, "crater_diameter": crater_diameter
        }
        try:
            gemini_analysis = services.get_gemini_analysis(meteorite_data_for_gemini, location)
        except Exception as e:
            # No queremos que falle toda la petición si Gemini tiene problemas
            # Devolvemos un dict con 'error' para que el frontend lo maneje
            gemini_analysis = {'error': f"Exception calling Gemini: {type(e).__name__}: {e}"}

        # Normalizar la estructura de gemini_analysis para que el frontend
        # siempre reciba un objeto predecible (dict). Si el servicio devuelve
        # una cadena u otro tipo, la envolvemos como {'text': ...}.
        if isinstance(gemini_analysis, dict):
            normalized_gemini = gemini_analysis
        else:
            try:
                normalized_gemini = { 'text': str(gemini_analysis) }
            except Exception:
                normalized_gemini = { 'text': 'Respuesta de Gemini no disponible.' }

        # 3. Preparar la respuesta
        response_data = {
            "impact_effects": {
                "energy_megatons": round(energy, 2),
                "crater_diameter_meters": round(crater_diameter, 2)
            },
            "location": location,
            "gemini_analysis": normalized_gemini
        }

        return jsonify(response_data)

    except (ValueError, KeyError) as e:
        return jsonify({"error": f"Formato de parámetro inválido o faltan 'lat'/'lng': {e}"}), 400


@bp.route('/intensity', methods=['POST'])
def get_intensity():
    """Calcula y devuelve una 'intensidad' basada en parámetros del proyectil y ubicación.
    Espera JSON: { lat, lng, diameter, velocity, density, angle }
    Devuelve: { intensity: <n>, energy_megatons: <n>, crater_diameter_meters: <n> }
    """
    data = request.get_json() or {}
    try:
        diameter = float(data.get('diameter', 0))
        velocity = float(data.get('velocity', 0))
        density = float(data.get('density', 0))

        # Calculamos energía (megatones) y cráter
        energy = utils.calculate_impact_energy(diameter, velocity, density)
        crater = utils.calculate_crater_diameter(energy)

        # Decidimos 'intensidad' igual a la energía en megatones (puedes adaptar)
        intensity = round(energy, 4)

        return jsonify({
            'intensity': intensity,
            'energy_megatons': round(energy, 4),
            'crater_diameter_meters': round(crater, 2)
        })

    except Exception as e:
        return jsonify({'error': f'Error calculando intensidad: {e}'}), 400