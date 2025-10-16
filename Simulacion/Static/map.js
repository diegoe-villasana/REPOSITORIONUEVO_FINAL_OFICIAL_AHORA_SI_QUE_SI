document.addEventListener('DOMContentLoaded', function () {
    // map.js - visualización de impactos/intensidades
    // Uso:
    //  - Desde otros scripts puedes llamar: window.drawIntensityCircle(lat, lng, intensity)
    //    donde intensity es un número (por ejemplo magnitud de sismo o un proxy).
    //  - Si quieres obtener intensidad desde tu API, haz fetch('/api/intensity?lat=..&lng=..')
    //    y luego pasa el valor recibido a drawIntensityCircle.
    // Ejemplo:
    //   fetch(`/api/intensity?lat=${lat}&lng=${lng}`).then(r=>r.json()).then(j=>window.drawIntensityCircle(lat,lng,j.intensity));
    // Inicializar el mapa y centrarlo en una vista global
    var map = L.map('map').setView([20, 0], 2);

    // Añadir las capas base: satelital (ESRI) y calles (OpenStreetMap)
    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    });

    const osmStreets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    // Añade la capa satelital por defecto
    esriSat.addTo(map);

    // Control para alternar entre capas base (ubicado en bottomleft para evitar solapamiento con HUD)
    L.control.layers({
        'Satelital': esriSat,
        'Mapa calles': osmStreets
    }, null, { position: 'bottomleft' }).addTo(map);

    let impactMarker;
    let impactCircle;
    let intensityCircle; // circle used for earthquake/impact intensity visualization
    let intensityApiEndpoint = '/api/intensity'; // default endpoint (can be changed)
    // Local store for meteorite parameters keyed by name
    const meteoriteStore = {};

    // Local physics helpers (mirror de utils.py)
    const MT_TO_J = 4.184e15;
    function calculateImpactEnergyMegatons(diameter_m, velocity_kms, density_kgm3) {
        if (!diameter_m || !velocity_kms || !density_kgm3) return 0;
        const velocity_ms = velocity_kms * 1000;
        const radius_m = diameter_m / 2;
        const volume_m3 = (4/3) * Math.PI * Math.pow(radius_m, 3);
        const mass_kg = volume_m3 * density_kgm3;
        const kinetic_energy_joules = 0.5 * mass_kg * Math.pow(velocity_ms, 2);
        return kinetic_energy_joules / MT_TO_J;
    }

    function calculateCraterDiameterFromEnergy(energy_megatons, target_density_kgm3=1800) {
        if (!energy_megatons || energy_megatons <= 0) return 0;
        const energy_joules = energy_megatons * MT_TO_J;
        const Cf = 1.161;
        const transient_diameter = Cf * Math.pow(energy_joules / target_density_kgm3, 1 / 3.4);
        const final_diameter_meters = transient_diameter * 1.25;
        return final_diameter_meters;
    }

    // Expose function to place marker from external scripts (e.g., globe)
    window.placeImpactFromGlobe = function(lat, lng) {
        const latlng = L.latLng(lat, lng);
        // update hidden inputs if present
        const latInput = document.getElementById('impact-lat');
        const lngInput = document.getElementById('impact-lng');
        if (latInput) latInput.value = lat.toFixed(6);
        if (lngInput) lngInput.value = lng.toFixed(6);

        if (impactMarker) {
            impactMarker.setLatLng(latlng).update();
        } else {
            impactMarker = L.marker(latlng).addTo(map).bindPopup('Punto de impacto seleccionado.');
        }
        // open popup and pan map
        impactMarker.openPopup();
        map.panTo(latlng);
    };

    // Dibuja un círculo rojo alrededor de (lat,lng) cuya área depende de la intensidad
    // intensity: número en megatones (energy_megatons) o cualquier proxy numérico.
    // Expuesta para que otros scripts (globo, llamadas API) puedan invocarla.
    window.drawIntensityCircle = function(lat, lng, intensity) {
        if (!lat || !lng) return;

    // convertir intensidad a número y calcular radio usando helper
    const base = Math.max(0, Number(intensity) || 1);
    const radio = intensityToRadius(base);

        // Si existe el círculo previo usado para intensidad, lo removemos
        if (intensityCircle) {
            map.removeLayer(intensityCircle);
            intensityCircle = null;
        }

        intensityCircle = L.circle([lat, lng], {
            radius: radio,
            color: 'red',
            weight: 2,
            fillColor: '#ff4444',
            fillOpacity: 0.35
        }).addTo(map);

    // mostrar popup con intensidad (megatones) y radio en metros/kilómetros
    const radiusText = (radio >= 1000) ? ( (radio/1000).toFixed(2) + ' km') : (Math.round(radio) + ' m');
    intensityCircle.bindPopup(`<strong>Intensidad (megatones):</strong> ${base}<br><strong>Radio:</strong> ${radiusText}`).openPopup();

    // Actualizar cuadro de Richter equivalente
    updateRichterBox(base);

        // abrir popup y ajustar vista para mostrar el círculo
        intensityCircle.openPopup();
        map.fitBounds(intensityCircle.getBounds());
    };

    // Helper: mapa intensidad -> radio (metros)
    function intensityToRadius(intensity) {
        const MIN_RAD = 500; // 0.5 km
        const MAX_RAD = 2000000; // 2000 km
        // fórmula exponencial suavizada: MIN_RAD * 10^(intensity/2)
        let r = MIN_RAD * Math.pow(10, intensity / 2);
        r = Math.min(Math.max(r, MIN_RAD), MAX_RAD);
        return r;
    }

    // Small helper to update the impact-scale box (safe no-op if element missing)
    function updateRichterBox(value) {
        try {
            const el = document.getElementById('Resultado_Escala');
            if (!el) return;
            if (value === null || value === undefined || isNaN(value)) {
                el.innerText = '—';
            } else {
                // Show energy/magnitude proxy with two decimals
                el.innerText = (Math.round((Number(value) + Number.EPSILON) * 100) / 100).toString();
            }
        } catch (e) { /* ignore */ }
    }

    // Exponer setter por si se desea cambiar el endpoint desde consola u otro script
    window.setIntensityApiEndpoint = function(url) {
        intensityApiEndpoint = String(url);
    };

    // (Se removieron funciones de escala Richter porque la UI fue simplificada)

    // Centraliza la lógica para calcular y dibujar el círculo de intensidad
    function computeAndDrawIntensity(latlng) {
        if (!latlng) return;
        // Al iniciar un nuevo cálculo/dibujo, eliminar impactos previos (incluyendo marcador)
        clearPreviousImpacts({ removeMarker: true });
        // obtener parámetros del meteorito seleccionado en la lista (o valores default)
        const select = document.getElementById('meteorite-select');
        let selectedName = select ? select.value : null;
        let diameter = 0, velocity = 0, density = 3000;
        if (selectedName && meteoriteStore[selectedName]) {
            const m = meteoriteStore[selectedName];
            diameter = parseFloat(m.diameter) || parseFloat(m.tamano) || 0;
            velocity = parseFloat(m.velocity) || 0;
            density = parseFloat(m.density) || density;
        } else {
            // fallback: read from custom inputs if present
            diameter = parseFloat(document.getElementById('custom-diameter')?.value) || 0;
            velocity = parseFloat(document.getElementById('custom-velocity')?.value) || 0;
            density = parseFloat(document.getElementById('custom-density')?.value) || density;
        }

        const intensityInput = document.getElementById('quake-intensity');
        let intensityValueFromForm = null;
        if (intensityInput) {
            const v = parseFloat(intensityInput.value);
            if (!isNaN(v)) intensityValueFromForm = v;
        }

    // intensityProxy: use local energy in megatons as proxy
    const localEnergy = calculateImpactEnergyMegatons(diameter, velocity, density);
    const intensityProxy = localEnergy > 0 ? localEnergy : (diameter > 0 ? diameter / 1000 : 1);

        const useApi = document.getElementById('use-api-intensity')?.checked;

        if (useApi) {
            const payload = {
                lat: latlng.lat,
                lng: latlng.lng,
                diameter: diameter,
                velocity: velocity,
                density: density,
                angle: parseFloat(document.getElementById('angle')?.value) || null
            };

            fetch(intensityApiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => {
                if (!res.ok) throw new Error('API returned ' + res.status);
                return res.json();
            })
            .then(json => {
                let apiIntensity = null;
                let craterDiameter = null;
                // Mostrar contenido de la respuesta en el panel lateral si existe
                try {
                    const apiBox = document.getElementById('api-params');
                    const apiContent = document.getElementById('api-params-content');
                    if (apiContent && apiBox) {
                        apiContent.innerText = JSON.stringify(json, null, 2);
                        apiBox.style.display = 'block';
                    }
                } catch (e) { /* no-op */ }
                if (json) {
                    if (json.crater_diameter_meters) craterDiameter = parseFloat(json.crater_diameter_meters);
                    const candidates = ['intensity', 'magnitude', 'value', 'energy_megatons', 'mag', 'energy_megatons'];
                    for (const key of candidates) {
                        if (json.hasOwnProperty(key)) {
                            const v = parseFloat(json[key]);
                            if (!isNaN(v)) { apiIntensity = v; break; }
                        } else if (json.data && json.data.hasOwnProperty(key)) {
                            const v = parseFloat(json.data[key]);
                            if (!isNaN(v)) { apiIntensity = v; break; }
                        }
                    }
                }

                if (craterDiameter !== null && !isNaN(craterDiameter) && craterDiameter > 0) {
                    // usar diámetro de cráter
                    const radiusFromCrater = craterDiameter / 2;
                    if (intensityCircle) { map.removeLayer(intensityCircle); intensityCircle = null; }
                    intensityCircle = L.circle([latlng.lat, latlng.lng], {
                        radius: radiusFromCrater,
                        color: 'red',
                        weight: 2,
                        fillColor: '#ff4444',
                        fillOpacity: 0.35
                    }).addTo(map).bindPopup(`<strong>Diámetro cráter:</strong> ${Math.round(craterDiameter)} m`).openPopup();
                    map.fitBounds(intensityCircle.getBounds());
                } else {
                    const finalIntensity = (apiIntensity !== null) ? apiIntensity : (intensityValueFromForm !== null ? intensityValueFromForm : intensityProxy);
                    window.drawIntensityCircle(latlng.lat, latlng.lng, finalIntensity);
                }
            })
            .catch(err => {
                console.warn('Error obteniendo intensidad desde API (clic), usando fallback:', err);
                const finalIntensity = (intensityValueFromForm !== null) ? intensityValueFromForm : intensityProxy;
                window.drawIntensityCircle(latlng.lat, latlng.lng, finalIntensity);
            });
        } else {
            const finalIntensity = (intensityValueFromForm !== null) ? intensityValueFromForm : intensityProxy;
            window.drawIntensityCircle(latlng.lat, latlng.lng, finalIntensity);
        }
    }

    // Helper para limpiar impactos previos (círculos y marcador opcionalmente)
    function clearPreviousImpacts(options = {}) {
        const { removeMarker = false } = options;
        try { if (impactCircle) { map.removeLayer(impactCircle); impactCircle = null; } } catch(e){}
        try { if (intensityCircle) { map.removeLayer(intensityCircle); intensityCircle = null; } } catch(e){}
        if (removeMarker) {
            try { if (impactMarker) { map.removeLayer(impactMarker); impactMarker = null; } } catch(e){}
        }
    }

    // Evento de clic en el mapa para colocar el marcador de impacto
    map.on('click', function(e) {
        // Limpiar impactos previos (conservar marcador nuevo)
        clearPreviousImpacts({ removeMarker: false });
        // Añade un nuevo marcador en la ubicación del clic
        if (impactMarker) {
            impactMarker.setLatLng(e.latlng).update();
        } else {
            impactMarker = L.marker(e.latlng).addTo(map).bindPopup('Punto de impacto seleccionado.');
        }
        impactMarker.openPopup();
        // fill hidden inputs for form
        try { document.getElementById('impact-lat').value = e.latlng.lat.toFixed(6); } catch(e){}
        try { document.getElementById('impact-lng').value = e.latlng.lng.toFixed(6); } catch(e){}
    });

    // Botón para cargar meteorito seleccionado en los inputs personalizados
    const loadBtn = document.getElementById('load-meteorite');
    if (loadBtn) {
        loadBtn.addEventListener('click', function() {
            const select = document.getElementById('meteorite-select');
            if (!select) return;
            const name = select.value;
            // if we have it stored, populate custom inputs
            if (meteoriteStore[name]) {
                const m = meteoriteStore[name];
                try { if (m.diameter) document.getElementById('custom-diameter').value = m.diameter; } catch(e){}
                try { if (m.velocity) document.getElementById('custom-velocity').value = m.velocity; } catch(e){}
                try { if (m.density) document.getElementById('custom-density').value = m.density; } catch(e){}
                try { document.getElementById('Resultado_meteoro').innerText = name; } catch(e){}
            } else {
                // attempt to fetch using todos if available
                if (typeof todos === 'function') {
                    todos(name).then(data => {
                        meteoriteStore[name] = meteoriteStore[name] || {};
                        meteoriteStore[name].diameter = data.tamano || data.diameter || meteoriteStore[name].diameter;
                        meteoriteStore[name].velocity = data.velocidad || data.velocity || meteoriteStore[name].velocity;
                        meteoriteStore[name].density = data.density || data.densidad || meteoriteStore[name].density;
                        // populate inputs
                        try { if (meteoriteStore[name].diameter) document.getElementById('custom-diameter').value = meteoriteStore[name].diameter; } catch(e){}
                        try { if (meteoriteStore[name].velocity) document.getElementById('custom-velocity').value = meteoriteStore[name].velocity; } catch(e){}
                        try { if (meteoriteStore[name].density) document.getElementById('custom-density').value = meteoriteStore[name].density; } catch(e){}
                        try { document.getElementById('Resultado_meteoro').innerText = name; } catch(e){}
                    }).catch(err => console.warn('Error load todos():', err));
                }
            }
        });
    }

    // Sincronizar con mapa: centra en el marcador o crea uno si hay coords en inputs
    const syncBtn = document.getElementById('sync-map');
    if (syncBtn) {
        syncBtn.addEventListener('click', function() {
            const lat = parseFloat(document.getElementById('impact-lat')?.value);
            const lng = parseFloat(document.getElementById('impact-lng')?.value);
            if (!isNaN(lat) && !isNaN(lng)) {
                const latlng = L.latLng(lat, lng);
                // limpiar dibujos previos
                clearPreviousImpacts({ removeMarker: false });
                if (impactMarker) {
                    impactMarker.setLatLng(latlng).update();
                } else {
                    impactMarker = L.marker(latlng).addTo(map).bindPopup('Punto de impacto sincronizado').openPopup();
                }
                map.panTo(latlng);
            } else if (impactMarker) {
                map.panTo(impactMarker.getLatLng());
            } else {
                alert('No hay coordenadas para sincronizar. Haz clic en el mapa para seleccionar un punto.');
            }
        });
    }

    // Evento de envío del formulario
    document.getElementById('impact-form').addEventListener('submit', function(e) {
        e.preventDefault(); // Evita que la página se recargue

        if (!impactMarker) {
            alert('Por favor, selecciona un punto de impacto en el mapa haciendo clic en él.');
            return;
        }

        // Obtener los valores del formulario
        // prefer custom input
        const diameter = parseFloat(document.getElementById('custom-diameter')?.value) || 0;
        // Estimación simple del radio del cráter (ej: 10 veces el diámetro del proyectil)
        const craterRadius = diameter > 0 ? diameter * 10 : 1000;

        // Limpiar impactos previos (conservar marcador)
        clearPreviousImpacts({ removeMarker: false });

        // Dibuja un nuevo círculo en la ubicación del marcador
        impactCircle = L.circle(impactMarker.getLatLng(), {
            radius: craterRadius,
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5
        }).addTo(map);

        // Calcular y dibujar intensidad desde los controles (flujo: primero ingresas datos en el formulario)
        try {
            computeAndDrawIntensity(impactMarker.getLatLng());
        } catch (err) {
            console.warn('No se pudo dibujar círculo de intensidad desde submit:', err);
        }

        // === Enviar datos al backend para obtener análisis de Gemini ===
        (async () => {
            try {
                const loader = document.getElementById('gemini-loader');
                const geminiText = document.getElementById('gemini-text');
                if (loader) loader.style.display = 'inline-block';
                if (geminiText) geminiText.innerText = 'Analizando impacto con Gemini...';

                // Obtener parámetros del meteorito (mismo fallback que computeAndDrawIntensity)
                const select = document.getElementById('meteorite-select');
                let selectedName = select ? select.value : null;
                let d = parseFloat(document.getElementById('custom-diameter')?.value) || 0;
                let v = parseFloat(document.getElementById('custom-velocity')?.value) || 0;
                let den = parseFloat(document.getElementById('custom-density')?.value) || 3000;
                if (selectedName && meteoriteStore[selectedName]) {
                    const m = meteoriteStore[selectedName];
                    d = parseFloat(m.diameter) || d;
                    v = parseFloat(m.velocity) || v;
                    den = parseFloat(m.density) || den;
                }

                const payload = {
                    meteorite: { diameter: d, velocity: v, density: den },
                    location: { lat: parseFloat(document.getElementById('impact-lat')?.value) || impactMarker.getLatLng().lat, lng: parseFloat(document.getElementById('impact-lng')?.value) || impactMarker.getLatLng().lng }
                };

                const res = await fetch('/api/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Leer la respuesta como texto UNA vez y luego intentar parsear JSON.
                // Esto evita el error 'body stream already read' cuando se intenta
                // consumir la respuesta dos veces (res.json() seguido de res.text()).
                let data;
                const rawText = await res.text();
                if (!rawText) {
                    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} - empty response from /api/simulate`);
                    data = {};
                } else {
                    // Intentar interpretar como JSON
                    try {
                        data = JSON.parse(rawText);
                    } catch (parseErr) {
                        // No es JSON; si la respuesta no es OK, lanzar un error más amigable
                        if (!res.ok) {
                            const trimmed = rawText.trim();
                            // si parece HTML (página de error) mostrar mensaje claro en vez de HTML crudo
                            if (trimmed.startsWith('<')) {
                                throw new Error(`HTTP ${res.status} ${res.statusText} - La ruta /api/simulate devolvió una página HTML (posible 404). Verifica que el backend esté en ejecución y que la ruta exista.`);
                            }
                            // si no es HTML, incluir el texto como detalle
                            throw new Error(`HTTP ${res.status} ${res.statusText} - ${trimmed}`);
                        }
                        // si la respuesta es OK pero no JSON, envolver texto para mostrarlo
                        data = { gemini_analysis: rawText };
                    }
                }

                // Mostrar el texto devuelto por Gemini o texto crudo
                if (geminiText) {
                    if (data.gemini_analysis) {
                        if (typeof data.gemini_analysis === 'string') {
                            geminiText.innerText = data.gemini_analysis;
                        } else {
                            // pretty-print structured gemini_analysis
                            try { geminiText.innerText = JSON.stringify(data.gemini_analysis, null, 2); } catch(e) { geminiText.innerText = String(data.gemini_analysis); }
                        }
                    } else if (data.text) {
                        geminiText.innerText = data.text;
                    } else {
                        geminiText.innerText = 'Análisis recibido.';
                    }
                }
                // actualizar panel de energía/cráter si vienen
                try { if (data.impact_effects && data.impact_effects.energy_megatons) document.getElementById('impact-energy').innerText = data.impact_effects.energy_megatons + ' MT'; } catch(e){}
                try { if (data.impact_effects && data.impact_effects.crater_diameter_meters) document.getElementById('Resultado_Escala').innerText = Math.round(data.impact_effects.crater_diameter_meters) + ' m'; } catch(e){}

            } catch (err) {
                console.warn('Error llamando a /api/simulate:', err);
                try { document.getElementById('gemini-text').innerText = 'No se pudo obtener análisis de Gemini: ' + err.message; } catch(e){}
            } finally {
                try { const loader = document.getElementById('gemini-loader'); if (loader) loader.style.display = 'none'; } catch(e){}
            }
        })();

        // Ajusta la vista del mapa para mostrar el cráter completo
        map.fitBounds(impactCircle.getBounds());
    });

    // Limpiar formulario personalizado
    const clearCustom = document.getElementById('clear-custom');
    if (clearCustom) {
        clearCustom.addEventListener('click', function() {
            try {
                document.getElementById('custom-name').value = '';
                document.getElementById('custom-diameter').value = 1000;
                document.getElementById('custom-velocity').value = 20;
                document.getElementById('custom-density').value = 3000;
                // reset info panel
                try { document.getElementById('Resultado_meteoro').innerText = 'N/A'; } catch(e){}
                try { document.getElementById('Resultado_tamano').innerText = 'N/A'; } catch(e){}
                try { document.getElementById('Resultado_Velocidad').innerText = 'N/A'; } catch(e){}
            } catch (e) { console.warn('clear-custom error', e); }
        });
    }

    // Añadir meteorito personalizado a la lista y simular
    const addCustomBtn = document.getElementById('add-custom');
    if (addCustomBtn) {
        addCustomBtn.addEventListener('click', function() {
            const name = document.getElementById('custom-name').value || ('Personal-' + Date.now());
            const d = parseFloat(document.getElementById('custom-diameter').value) || 1000;
            const v = parseFloat(document.getElementById('custom-velocity').value) || 20;
            const den = parseFloat(document.getElementById('custom-density').value) || 3000;
            const select = document.getElementById('meteorite-select');
            if (select) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.text = name;
                select.appendChild(opt);
                select.value = name;
            }
            // store
            meteoriteStore[name] = { diameter: d, velocity: v, density: den };
            // populate custom inputs so computeAndDrawIntensity uses them as fallback
            const cd = document.getElementById('custom-diameter');
            const cv = document.getElementById('custom-velocity');
            const cden = document.getElementById('custom-density');
            if (cd) cd.value = d;
            if (cv) cv.value = v;
            if (cden) cden.value = den;
            // Update info panel values
            try { document.getElementById('Resultado_meteoro').innerText = name; } catch(e){}
            try { document.getElementById('Resultado_tamano').innerText = d; } catch(e){}
            try { document.getElementById('Resultado_Velocidad').innerText = v; } catch(e){}
            // draw circle if marker present (clear previous first)
            if (impactMarker) {
                clearPreviousImpacts({ removeMarker: false });
                computeAndDrawIntensity(impactMarker.getLatLng());
            }
        });
    }

    // Usar y Simular: llama a 'todos' (función global) y luego dibuja
    const useSimBtn = document.getElementById('use-simulate');
    if (useSimBtn) {
        useSimBtn.addEventListener('click', function() {
            const select = document.getElementById('meteorite-select');
            if (!select) return;
            const name = select.value;
            // la función todos(name) ya está definida en peticiones.js y devuelve datos
            if (typeof todos === 'function') {
                todos(name).then(data => {
                    meteoriteStore[name] = meteoriteStore[name] || {};
                    // tolerant mapping for different keys
                    if (data.tamano) meteoriteStore[name].diameter = data.tamano;
                    if (data.diameter) meteoriteStore[name].diameter = data.diameter;
                    if (data.velocidad) meteoriteStore[name].velocity = data.velocidad;
                    if (data.velocity) meteoriteStore[name].velocity = data.velocity;
                    if (data.density) meteoriteStore[name].density = data.density;
                    if (data.densidad) meteoriteStore[name].density = data.densidad;

                    // intentar poblar campos personalizados si vienen
                    try {
                        if (meteoriteStore[name].diameter) {
                            const cd = document.getElementById('custom-diameter'); if (cd) cd.value = meteoriteStore[name].diameter;
                            try { document.getElementById('Resultado_tamano').innerText = meteoriteStore[name].diameter; } catch(e){}
                        }
                        if (meteoriteStore[name].velocity) {
                            const cv = document.getElementById('custom-velocity'); if (cv) cv.value = meteoriteStore[name].velocity;
                            try { document.getElementById('Resultado_Velocidad').innerText = meteoriteStore[name].velocity; } catch(e){}
                        }
                        if (meteoriteStore[name].density) {
                            const cden = document.getElementById('custom-density'); if (cden) cden.value = meteoriteStore[name].density;
                        }
                        try { document.getElementById('Resultado_meteoro').innerText = name; } catch(e){}
                    } catch (e) { /* ignore */ }

                    // call compute if marker exists (clear previous first)
                    if (impactMarker) {
                        clearPreviousImpacts({ removeMarker: false });
                        computeAndDrawIntensity(impactMarker.getLatLng());
                    }
                }).catch(err => console.warn('Error en todos():', err));
            }
        });
    }

    // Mostrar/ocultar input de intensidad manual según checkbox "use-api-intensity"
    const useApiCheckbox = document.getElementById('use-api-intensity');
    const quakeContainer = document.getElementById('quake-intensity-container');
    if (useApiCheckbox && quakeContainer) {
        // inicializar estado
        quakeContainer.style.display = useApiCheckbox.checked ? 'none' : 'block';
        useApiCheckbox.addEventListener('change', () => {
            quakeContainer.style.display = useApiCheckbox.checked ? 'none' : 'block';
        });
    }
});