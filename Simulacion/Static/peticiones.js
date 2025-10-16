

async function nombre() {
    try {
        const response = await fetch("/lista");
        if (response.ok) {
            const data = await response.json();
            console.log(data);
        } else {
            console.error("Retorno no exitososososo, código:", response.status);
        }
    } catch (error) {
        console.error("Error al hacer fetch:", error);
    }
}

async function infoasteroide(nombre) {
    try {
        const response = await fetch(`/infoasteroide?name=${encodeURIComponent(nombre)}`);;
        if (response.ok) {
            const data = await response.json();
            console.log("infoasteroide",data);
            return data
        } else {
            console.error("Retorno no exitoso en infoasteroides, código:", response.status);
        }
    } catch (error) {
        console.error("Error al hacer fetch:", error);
    }
}

async function infoasteroide_nombre(nombre) { 
    try {
        const response = await fetch(`/infoasteroide?name=${encodeURIComponent(nombre)}`);
        if (response.ok) {
            const data = await response.json();
            console.log("infoasteroide", data);

            // ✅ Mostrar solo el nombre en el HTML
            const nombreElemento = document.getElementById("Resultado_meteoro");
            if (nombreElemento) {
                nombreElemento.innerText = data.name; // solo el nombre
            }

            return data;
        } else {
            console.error("Retorno no exitoso en infoasteroides, código:", response.status);
        }
    } catch (error) {
        console.error("Error al hacer fetch:", error);
    }
}

async function infoasteroide_velocidad(nombre) { 
    try {
        const response = await fetch(`/velocidad?name=${encodeURIComponent(nombre)}`);
        if (response.ok) {
            const data = await response.json();
            console.log("velocidad", data);
            const nombreElemento = document.getElementById("Resultado_meteoro");
            if (nombreElemento) {
                nombreElemento.innerText = data.velocidad;
            }
            return data;
        } else {
            console.error("Retorno no exitoso en infoasteroides, código:", response.status);
        }
    } catch (error) {
        console.error("Error al hacer fetch:", error);
    }
}

async function infoasteroide_nombre(nombre) { 
    try {
        const response = await fetch(`/infoasteroide?name=${encodeURIComponent(nombre)}`);
        if (response.ok) {
            const data = await response.json();
            console.log("infoasteroide", data);

            // ✅ Mostrar solo el nombre en el HTML
            const nombreElemento = document.getElementById("Resultado_meteoro");
            if (nombreElemento) {
                nombreElemento.innerText = data.name; // solo el nombre
            }

            return data;
        } else {
            console.error("Retorno no exitoso en infoasteroides, código:", response.status);
        }
    } catch (error) {
        console.error("Error al hacer fetch:", error);
    }
}

async function todos(nombre) { 
    try {
        const response = await fetch(`/todos?name=${encodeURIComponent(nombre)}`);
        if (response.ok) {
            const data = await response.json();
            console.log("Datos completos:", data);

            const nombreElemento = document.getElementById("Resultado_meteoro");
            const velocidad = document.getElementById("Resultado_Velocidad");
            const tamano = document.getElementById("Resultado_tamano");
            const orbita = document.getElementById("Resultado_orbit_an");
            const escala = document.getElementById("Resultado_Escala");
            const energy = document.getElementById("impact-energy");
            

            if (nombreElemento) nombreElemento.innerText = data.nombreElemento;
            if (velocidad) velocidad.innerText = data.velocidad;
            if (tamano) tamano.innerText = data.tamano;
            if (orbita) orbita.innerText = data.orbita;
            if (escala) escala.innerText = data.scale_category;
            if (energy) energy.innerText = data.energy_megatons + " MT";
            

            return data;
        } else {
            console.error("Retorno no exitoso en /todos, código:", response.status);
        }
    } catch (error) {
        console.error("Error al hacer fetch:", error);
    }
}

async function mostrarImpacto(nombre) {
    try {
        const response = await fetch(`/todos?name=${encodeURIComponent(nombre)}`);
        if (!response.ok) throw new Error("Error al obtener datos del asteroide");

        const data = await response.json();

        // Suponiendo que el JSON incluye algo como:
        // data.impact_location = { x: 10, y: 0, z: -20 }
        const impact = data.impact_location || { x: 0, y: 0, z: 0 };
        const diametro = data.tamano || 10; // en metros, ajusta escala visual

        // Crear el círculo rojo transparente
        const geometry = new THREE.CircleGeometry(diametro / 2, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });

        const circuloImpacto = new THREE.Mesh(geometry, material);

        // Rotar para que quede sobre el suelo (plano XZ)
        circuloImpacto.rotation.x = -Math.PI / 2;

        // Posicionar en el punto de impacto
        circuloImpacto.position.set(impact.x, impact.y, impact.z);

        // Agregar a la escena
        scene.add(circuloImpacto);

        console.log("🟥 Zona de impacto colocada:", impact);

    } catch (error) {
        console.error("Error al mostrar impacto:", error);
    }
}
// Ejemplo: cuando termines de obtener los datos del asteroide
fetch('/api/impacto')
  .then(res => res.json())
  .then(data => {
    mostrarImpacto(data); // 👈 Aquí dibuja el círculo en el mapa
  });
