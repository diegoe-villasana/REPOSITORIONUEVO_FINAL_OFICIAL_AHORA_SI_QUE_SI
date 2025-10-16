# app/services.py (Versión con JSON local, sin NASA)

import json # <-- Importamos la librería para manejar JSON
import google.generativeai as genai
from flask import current_app

def get_nasa_neos():
    """
    Obtiene los datos de los meteoritos desde el archivo local meteorites_data.json.
    """
    try:
        # 'with open(...)' abre, lee y cierra el archivo de forma segura.
        with open('meteorites_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        print("ERROR: El archivo 'meteorites_data.json' no se encontró en la carpeta principal.")
        return {"error": "El archivo de datos de meteoritos no fue encontrado."}
    except json.JSONDecodeError:
        print("ERROR: El archivo 'meteorites_data.json' tiene un formato JSON inválido.")
        return {"error": "Error al leer el archivo de datos de meteoritos."}

def get_gemini_analysis(meteorite_data, location):
    """
    Genera un análisis del impacto ambiental usando la API de Gemini.
    (Esta función no cambia)
    """
    # Use .get to avoid raising KeyError if the config key isn't present
    api_key = current_app.config.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'Gemini API key not configured. Please set GEMINI_API_KEY in the environment or .env'}

    genai.configure(api_key=api_key)
    # Permite configurar el nombre del modelo desde app config
    model_name = current_app.config.get('GEMINI_MODEL', 'gemini-2.5-pro')
    model = genai.GenerativeModel(model_name)

    prompt = f"""
    Eres un experto en astrofísica y comunicación de riesgos. Analiza el impacto de un meteorito de forma CONCISA.

    Datos del Impacto:
    - Diámetro: {meteorite_data['diameter']:.2f} metros
    - Energía: {meteorite_data['energy']:.2f} megatones de TNT
    - Ubicación (Lat/Lng): {location['lat']}, {location['lng']}

    Instrucciones para tu respuesta:
    1.  **Descripción de la Zona:** En UNA SOLA FRASE, describe el tipo de área en la ubicación.
    2.  **Análisis de Daños:** En un PÁRRAFO CORTO (máximo 4 o 5 líneas), resume los efectos inmediatos más devastadores del impacto.
    3.  **No uses listas, asteriscos ni lenguaje demasiado técnico.** Sé directo y claro.
    """

    try:
        response = model.generate_content(prompt)
        raw = None
        if hasattr(response, 'text') and response.text:
            raw = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            raw = response.candidates[0].content

        if not raw:
            return {'error': 'No se obtuvo respuesta de Gemini.'}

        text = raw.strip()
        # Intentar parsear JSON directo
        try:
            parsed = json.loads(text)
            return parsed
        except Exception:
            # Intentar extraer primer objeto JSON en el texto
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1 and end > start:
                try:
                    snippet = text[start:end+1]
                    parsed = json.loads(snippet)
                    return parsed
                except Exception:
                    pass

        # Si no se pudo parsear, devolver el texto crudo en campo 'text'
        return {'text': text}
    except Exception as e:
        return {'error': f"Error generando el análisis de Gemini: {e}"}