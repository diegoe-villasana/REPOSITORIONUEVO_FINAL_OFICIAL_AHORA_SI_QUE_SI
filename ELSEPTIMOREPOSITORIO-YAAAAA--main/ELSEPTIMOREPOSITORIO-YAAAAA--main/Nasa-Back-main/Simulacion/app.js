// NASA Earth-Moon-NEO Visualization Application

import { GoogleGenerativeAI } from "@google/generative-ai";

// Simple OrbitControls implementation
class SimpleOrbitControls {
	constructor(object, domElement) {
		this.object = object;
		this.domElement = domElement;
		this.target = new THREE.Vector3();
		this.minDistance = 0;
		this.maxDistance = Infinity;
		this.maxPolarAngle = Math.PI;
		this.enableDamping = true;
		this.dampingFactor = 0.05;
		this.enablePan = true;
		
		this.spherical = new THREE.Spherical();
		this.sphericalDelta = new THREE.Spherical();
		this.scale = 1;
		
		this.rotateStart = new THREE.Vector2();
		this.rotateEnd = new THREE.Vector2();
		this.rotateDelta = new THREE.Vector2();
		
		this.panStart = new THREE.Vector2();
		this.panEnd = new THREE.Vector2();
		this.panDelta = new THREE.Vector2();
		
		this.isMouseDown = false;
		this.isRightMouseDown = false;
		
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onWheel = this.onWheel.bind(this);
		this.onContextMenu = this.onContextMenu.bind(this);
		
		this.domElement.addEventListener('mousedown', this.onMouseDown);
		this.domElement.addEventListener('wheel', this.onWheel);
		document.addEventListener('keydown', this.onKeyDown.bind(this));
		
		this.update();
	}
	
	onMouseDown(event) {
		if (event.button === 0) { // Left mouse button - rotate
			this.isMouseDown = true;
			this.rotateStart.set(event.clientX, event.clientY);
		} else if (event.button === 2) { // Right mouse button - pan
			this.isRightMouseDown = true;
			this.panStart.set(event.clientX, event.clientY);
		}
		
		document.addEventListener('mousemove', this.onMouseMove);
		document.addEventListener('mouseup', this.onMouseUp);
		document.addEventListener('contextmenu', this.onContextMenu);
		
		// User interaction detected
		lastUserInteraction = Date.now();
	}
	
	onMouseMove(event) {
		if (this.isMouseDown) {
			// Handle rotation
			this.rotateEnd.set(event.clientX, event.clientY);
			this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(0.0015);
			
			this.sphericalDelta.theta -= this.rotateDelta.x;
			this.sphericalDelta.phi -= this.rotateDelta.y;
			
			this.rotateStart.copy(this.rotateEnd);
		} else if (this.isRightMouseDown && this.enablePan) {
			// Handle panning
			this.panEnd.set(event.clientX, event.clientY);
			this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(0.1);
			
			this.pan(this.panDelta.x, this.panDelta.y);
			
			this.panStart.copy(this.panEnd);
		}
		
		// Update interaction timestamp
		lastUserInteraction = Date.now();
	}
	
	onMouseUp(event) {
		this.isMouseDown = false;
		lastUserInteraction = Date.now();
	}
	
	onContextMenu(event) {
		event.preventDefault(); // Prevent context menu
	}
	
	pan(deltaX, deltaY) {
		const position = this.object.position;
		const targetDistance = position.distanceTo(this.target);
		
		// Calculate pan vectors based on camera orientation
		const panVector = new THREE.Vector3();
		const rightVector = new THREE.Vector3();
		const upVector = new THREE.Vector3();
		
		this.object.getWorldDirection(panVector);
		rightVector.crossVectors(panVector, this.object.up).normalize();
		upVector.crossVectors(rightVector, panVector).normalize();
		
		// Scale pan movement based on distance to target
		const panScale = targetDistance * 0.001;
		
		// Apply pan movement to target
		rightVector.multiplyScalar(-deltaX * panScale);
		upVector.multiplyScalar(deltaY * panScale);
		
		this.target.add(rightVector);
		this.target.add(upVector);
	}
	
	onKeyDown(event) {
		const chatInput = document.getElementById('chat-input');
		if (chatInput && document.activeElement === chatInput) {
			return;
		}
		
		const panSpeed = 10; // Keyboard pan speed
		
		switch(event.code) {
			case 'KeyW':
			case 'ArrowUp':
				this.pan(0, panSpeed);
				break;
			case 'KeyS':
			case 'ArrowDown':
				this.pan(0, -panSpeed);
				break;
			case 'KeyA':
			case 'ArrowLeft':
				this.pan(panSpeed, 0);
				break;
			case 'KeyD':
			case 'ArrowRight':
				this.pan(-panSpeed, 0);
				break;
		}
		
		// Update interaction timestamp
		lastUserInteraction = Date.now();
	}
	
	onWheel(event) {
		event.preventDefault();
		
		if (event.deltaY < 0) {
			this.scale *= 0.95; // Smoother zoom in
		} else {
			this.scale *= 1.05; // Smoother zoom out
		}
		
		lastUserInteraction = Date.now();
	}
	
	update() {
		const position = this.object.position;
		const offset = new THREE.Vector3();
		
		offset.copy(position).sub(this.target);
		
		this.spherical.setFromVector3(offset);
		
		this.spherical.theta += this.sphericalDelta.theta;
		this.spherical.phi += this.sphericalDelta.phi;
		
		this.spherical.phi = Math.max(0.01, Math.min(this.maxPolarAngle - 0.01, this.spherical.phi));
		
		this.spherical.radius *= this.scale;
		this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
		
		offset.setFromSpherical(this.spherical);
		position.copy(this.target).add(offset);
		
		this.object.lookAt(this.target);
		
		if (this.enableDamping) {
			this.sphericalDelta.theta *= (1 - this.dampingFactor);
			this.sphericalDelta.phi *= (1 - this.dampingFactor);
		} else {
			this.sphericalDelta.set(0, 0, 0);
		}
		
		this.scale = 1;
		
		return false;
	}
}

// Global variables
let scene, camera, renderer, earth, moon, earthGroup, moonOrbit;
let controls, sunLight;
let earthDayTexture, earthNightTexture, earthNormalMap, moonTexture;
let meteoriteGroup, trajectoryGroup;
let meteoriteData = null;
let texturesLoaded = 0;
const totalTextures = 4;
let raycaster, mouse;

// Performance optimizations
let sharedGeometry, sharedMaterial, hazardousMaterial;
let frameCount = 0;
let lastTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;
let performanceStats = { fps: 0, frameTime: 0 };

// Physical constants
const EARTH_RADIUS = 10;
const MOON_RADIUS = 2.7;
const MOON_DISTANCE = 60;
const EARTH_MOON_DISTANCE = 60;
const TRAJECTORY_SCALE = 0.5;

// Camera tracking system
let cameraMode = 'auto'; // 'auto' or 'manual'
let lastUserInteraction = 0;
let autoReturnDelay = 10000; 
let targetCameraPosition = new THREE.Vector3();
let isTransitioning = false;

// Filter system
let filters = {
	hazardous: true,
	safe: true,
	trajectories: true
};

// Panel states - load from localStorage or use defaults
function loadPanelStates() {
	const defaults = {
		info: true,
		controls: false,  // Start collapsed
		performance: true,
		neo: true,
		ai: false
	};
	
	const saved = localStorage.getItem('nasatest_panel_states');
	return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
}

let panelStates = loadPanelStates();

// Global panel visibility - load from localStorage or default to true
let panelsVisible = localStorage.getItem('nasatest_panels_visible') !== null ? 
	localStorage.getItem('nasatest_panels_visible') === 'true' : true;

// Meteorite overlay state
let selectedMeteorite = null;
let meteoriteOverlay = null;
let previousCameraMode = null;
let lastCameraPosition = new THREE.Vector3();

// AI Assistant System
let aiSystem = {
	geminiApiKey: null,
	elevenlabsApiKey: null,
	currentAudio: null,
	recognition: null,
	isListening: false,
	isMuted: false,
	volume: 0.7,
	voiceId: 'pqHfZKP75CvOlQylNhV4', // Bill - Deep, authoritative voice good for scientific narration
	currentContext: null,
	genAI: null 
};

function togglePanel(panelId) {
	const content = document.getElementById(`${panelId}-content`);
	const icon = document.getElementById(`${panelId}-collapse`);
	const panel = document.getElementById(`${panelId}-panel`);
	
	panelStates[panelId] = !panelStates[panelId];
	
	// Save individual panel states to localStorage
	localStorage.setItem('nasatest_panel_states', JSON.stringify(panelStates));
	
	if (panelStates[panelId]) {
		content.classList.remove('collapsed');
		icon.classList.remove('rotated');
		panel.classList.remove('collapsed');
	} else {
		content.classList.add('collapsed');
		icon.classList.add('rotated');
		panel.classList.add('collapsed');
	}
}

// Make togglePanel available globally for HTML onclick handlers
window.togglePanel = togglePanel;
window.togglePerformancePanel = togglePerformancePanel;
window.toggleCameraMode = toggleCameraMode;
window.toggleAllPanels = toggleAllPanels;
window.hideMeteoriteOverlay = hideMeteoriteOverlay;

function togglePerformancePanel() {
	const perfPanel = document.getElementById('performance-panel');
	const fab = document.getElementById('fab-performance');
	
	if (perfPanel.style.display === 'none' || !perfPanel.style.display) {
		perfPanel.style.display = 'block';
		fab.classList.add('active');
	} else {
		perfPanel.style.display = 'none';
		fab.classList.remove('active');
	}
}

function toggleCameraMode() {
	if (cameraMode === 'auto') {
		cameraMode = 'manual';
		lastUserInteraction = Date.now();
		console.log('Camera mode: Manual (FAB toggle)');
	} else {
		cameraMode = 'auto';
		isTransitioning = true;
		
		// When switching to auto mode, show all meteorites and hide overlay
		showAllMeteorites();
		if (meteoriteOverlay) {
			hideMeteoriteOverlay();
		}
		
		console.log('Camera mode: Auto (FAB toggle)');
	}
	updateCameraModeDisplay();
}

function toggleAllPanels() {
	const panels = ['info-panel', 'controls-panel', 'neo-panel'];
	panelsVisible = !panelsVisible;
	
	// Save panel state to localStorage
	localStorage.setItem('nasatest_panels_visible', panelsVisible.toString());
	
	panels.forEach(panelId => {
		const panel = document.getElementById(panelId);
		if (panelsVisible) {
			panel.style.display = 'block';
			panel.style.opacity = '1';
			panel.style.transform = 'translateY(0)';
		} else {
			panel.style.opacity = '0';
			panel.style.transform = 'translateY(-20px)';
			setTimeout(() => {
				if (!panelsVisible) panel.style.display = 'none';
			}, 400);
		}
	});
}

window.toggleAllPanels = toggleAllPanels;

function updateCameraModeDisplay() {
	const modeText = document.getElementById('mode-text');
	const modeDot = document.getElementById('mode-dot');
	
	if (cameraMode === 'auto') {
		modeText.textContent = 'Follow Sun';
		modeDot.classList.remove('manual');
	} else {
		modeText.textContent = 'Manual';
		modeDot.classList.add('manual');
	}
}

function showNEOInfo(data) {
	console.log('showNEOInfo called with data:', data); // Debug log
	const panel = document.getElementById('neo-panel');
	const nameEl = document.getElementById('neo-name');
	
	nameEl.innerHTML = `<i data-lucide="target" class="lucide-icon"></i>${data.name}`;
	lucide.createIcons();
	
	if (data.diameter !== undefined) {
		// NEO data
		document.getElementById('neo-mass').textContent = data.diameter.toFixed(1);
		document.getElementById('neo-year').textContent = data.orbit_radius.toFixed(2);
		document.getElementById('neo-coords').textContent = data.is_hazardous ? 'Yes' : 'No';
		document.getElementById('neo-id').textContent = data.id;
		
		// Display impact statistics if available
		if (data.impact_stats) {
			console.log('Impact stats found:', data.impact_stats); // Debug log
			const stats = data.impact_stats;
			
			// Format mass in appropriate units
			let massText;
			if (stats.mass_tons > 1000000) {
				massText = `${(stats.mass_tons / 1000000).toFixed(1)} million tons`;
			} else if (stats.mass_tons > 1000) {
				massText = `${(stats.mass_tons / 1000).toFixed(1)} thousand tons`;
			} else {
				massText = `${stats.mass_tons.toFixed(0)} tons`;
			}
			
			// Format energy in appropriate units
			let energyText;
			if (stats.energy_kilotons > 1000) {
				energyText = `${stats.energy_megatons.toFixed(1)} megatons`;
			} else if (stats.energy_kilotons > 1) {
				energyText = `${stats.energy_kilotons.toFixed(1)} kilotons`;
			} else if (stats.energy_kilotons > 0.001) {
				energyText = `${(stats.energy_kilotons * 1000).toFixed(1)} tons TNT`;
			} else {
				energyText = `${(stats.energy_kilotons * 1000000).toFixed(0)} kg TNT`;
			}
			
			document.getElementById('neo-impact-mass').textContent = massText;
			document.getElementById('neo-impact-energy').textContent = energyText;
			document.getElementById('neo-impact-scale').textContent = stats.scale_category;
			document.getElementById('neo-impact-comparison').textContent = stats.historical_comparison;
		} else {
			// No impact data available
			document.getElementById('neo-impact-mass').textContent = 'N/A';
			document.getElementById('neo-impact-energy').textContent = 'N/A';
			document.getElementById('neo-impact-scale').textContent = 'N/A';
			document.getElementById('neo-impact-comparison').textContent = 'N/A';
		}
	} else {
		// Legacy meteorite data
		document.getElementById('neo-mass').textContent = data.mass.toLocaleString();
		document.getElementById('neo-year').textContent = data.year;
		document.getElementById('neo-coords').textContent =
		`${data.latitude.toFixed(2)}°, ${data.longitude.toFixed(2)}°`;
		document.getElementById('neo-id').textContent = '-';
		
		// Clear impact data for legacy meteorites
		document.getElementById('neo-impact-mass').textContent = 'N/A';
		document.getElementById('neo-impact-energy').textContent = 'N/A';
		document.getElementById('neo-impact-scale').textContent = 'N/A';
		document.getElementById('neo-impact-comparison').textContent = 'N/A';
	}
	
	panel.style.display = 'block';
}

function hideNEOInfo() {
	const panel = document.getElementById('neo-panel');
	panel.style.display = 'none';
}

function initializePanels() {
	// Set initial panel states
	Object.keys(panelStates).forEach(panelId => {
		if (!panelStates[panelId] && panelId !== 'performance') {
			togglePanel(panelId);
		}
	});
	
	// Performance panel starts hidden
	document.getElementById('performance-panel').style.display = 'none';
}

function init() {
	// Initialize AI system first
	initializeAISystem();
	
	// Scene setup
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);
	
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
	camera.position.set(30, 20, 90); // Angled view
	
	// Renderer setup
	renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: true
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputColorSpace = THREE.SRGBColorSpace; // Updated for newer Three.js
	document.getElementById('container').appendChild(renderer.domElement);
	
	// Controls - always look at Earth
	controls = new SimpleOrbitControls(camera, renderer.domElement);
	controls.target.set(0, 0, 0);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.enablePan = false;
	controls.minDistance = 25;
	controls.maxDistance = 300;
	controls.maxPolarAngle = Math.PI;
	
	setupLighting();
	
	createEarthMoonSystem();
	
	createSpaceBackground();
	
	createOrbitalPaths();
	
	loadNASATextures();
	
	loadMeteoriteData();
	
	// Add trajectory creation debugging
	setTimeout(() => {
		console.log('=== TRAJECTORY DIAGNOSTICS ===');
		console.log('Scene children count:', scene.children.length);
		console.log('Trajectory group exists:', !!trajectoryGroup);
		if (trajectoryGroup) {
			console.log('Trajectory group children:', trajectoryGroup.children.length);
			console.log('Trajectory group visible:', trajectoryGroup.visible);
			trajectoryGroup.children.forEach((child, i) => {
				console.log(`Trajectory ${i}: visible=${child.visible}, userData=`, child.userData);
			});
		}
		console.log('===============================');
	}, 3000);
	
	setupMouseInteraction();
	
	setupFilterControls();
	
	initializePanels();
	
	animate();
}

function setupLighting() {
	const ambientLight = new THREE.AmbientLight(0x404040, 0.05);
	scene.add(ambientLight);
	
	sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
	sunLight.position.set(200, 0, 100); 
	sunLight.castShadow = true;
	sunLight.shadow.mapSize.width = 2048;
	sunLight.shadow.mapSize.height = 2048;
	sunLight.shadow.camera.near = 50;
	sunLight.shadow.camera.far = 1000;
	sunLight.shadow.camera.left = -100;
	sunLight.shadow.camera.right = 100;
	sunLight.shadow.camera.top = 100;
	sunLight.shadow.camera.bottom = -100;
	scene.add(sunLight);
	
	// const sunHelper = new THREE.DirectionalLightHelper(sunLight, 5);
	// scene.add(sunHelper);
}

function createEarthMoonSystem() {
	// Optimized Earth geometry - reduced resolution for better performance
	const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 32);
	const earthMaterial = new THREE.MeshPhongMaterial({
		shininess: 5,
		specular: 0x111111,
		color: 0xaaaeff
	});
	
	earth = new THREE.Mesh(earthGeometry, earthMaterial);
	earth.castShadow = true;
	earth.receiveShadow = true;
	
	earthGroup = new THREE.Group();
	earthGroup.add(earth);
	scene.add(earthGroup);
	
	const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, 32, 16);
	const moonMaterial = new THREE.MeshLambertMaterial({
		color: 0xffffff
	});
	
	moon = new THREE.Mesh(moonGeometry, moonMaterial);
	moon.position.set(EARTH_MOON_DISTANCE, 0, 0);
	moon.castShadow = true;
	moon.receiveShadow = true;
	
	moonOrbit = new THREE.Group();
	moonOrbit.add(moon);
	scene.add(moonOrbit);
	
	const orbitGeometry = new THREE.RingGeometry(EARTH_MOON_DISTANCE - 0.3, EARTH_MOON_DISTANCE + 0.3, 128);
	const orbitMaterial = new THREE.MeshBasicMaterial({
		color: 0x444444,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.02
	});
	const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
	orbitRing.rotation.x = Math.PI / 2;
	scene.add(orbitRing);
}

function loadNASATextures() {
	const textureLoader = new THREE.TextureLoader();
	
	textureLoader.load(
	'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/Earth%20(A)/Earth%20(A).jpg',
	function(texture) {
		earthDayTexture = texture;
		earth.material.map = texture;
		earth.material.needsUpdate = true;
		updateLoadingStatus();
	},
	function(progress) {
		console.log('Loading Earth texture: ' + (progress.loaded / progress.total * 100) + '%');
	},
	function(error) {
		console.log('Earth texture failed, using fallback');
		createFallbackEarthTexture();
		updateLoadingStatus();
	}
	);
	
	// Moon texture from NASA
	textureLoader.load(
	'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/Moon/Moon.jpg',
	function(texture) {
		moonTexture = texture;
		moon.material.map = texture;
		moon.material.needsUpdate = true;
		updateLoadingStatus();
	},
	function(progress) {
		console.log('Loading Moon texture: ' + (progress.loaded / progress.total * 100) + '%');
	},
	function(error) {
		console.log('Moon texture failed, using fallback');
		createFallbackMoonTexture();
		updateLoadingStatus();
	}
	);
	
	createEarthNightTexture();
	
	createEarthNormalMap();
}

// function createFallbackEarthTexture() {
// 	const canvas = document.createElement('canvas');
// 	canvas.width = 2048;
// 	canvas.height = 1024;
// 	const context = canvas.getContext('2d');
//
// 	// Create Earth-like appearance
// 	const gradient = context.createLinearGradient(0, 0, 2048, 1024);
// 	gradient.addColorStop(0, '#1e3a5f');    // Deep ocean
// 	gradient.addColorStop(0.3, '#2b5f2f');  // Forest
// 	gradient.addColorStop(0.6, '#4a7c59');  // Land
// 	gradient.addColorStop(0.8, '#8b7355');  // Desert
// 	gradient.addColorStop(1, '#e0e0e0');    // Ice
//
// 	context.fillStyle = gradient;
// 	context.fillRect(0, 0, 2048, 1024);
//
// 	// Add continents
// 	context.fillStyle = '#2d5016';
// 	for (let i = 0; i < 20; i++) {
// 		const x = Math.random() * 2048;
// 		const y = Math.random() * 1024;
// 		const w = Math.random() * 300 + 100;
// 		const h = Math.random() * 200 + 50;
// 		context.fillRect(x, y, w, h);
// 	}
//
// 	earthDayTexture = new THREE.CanvasTexture(canvas);
// }

function createFallbackMoonTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 512;
	const context = canvas.getContext('2d');
	
	const gradient = context.createRadialGradient(512, 256, 100, 512, 256, 400);
	gradient.addColorStop(0, '#f0f0f0');
	gradient.addColorStop(0.7, '#d0d0d0');
	gradient.addColorStop(1, '#a0a0a0');
	
	context.fillStyle = gradient;
	context.fillRect(0, 0, 1024, 512);
	
	for (let i = 0; i < 50; i++) {
		const x = Math.random() * 1024;
		const y = Math.random() * 512;
		const radius = Math.random() * 25 + 5;
		
		context.fillStyle = '#909090';
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
		
		context.fillStyle = '#707070';
		context.beginPath();
		context.arc(x + radius/4, y + radius/4, radius/2, 0, Math.PI * 2);
		context.fill();
	}
	
	moonTexture = new THREE.CanvasTexture(canvas);
}

function createEarthNightTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 2048;
	canvas.height = 1024;
	const context = canvas.getContext('2d');
	
	context.fillStyle = '#000011';
	context.fillRect(0, 0, 2048, 1024);
	
	context.fillStyle = '#ffff88';
	for (let i = 0; i < 1000; i++) {
		const x = Math.random() * 2048;
		const y = Math.random() * 1024;
		const size = Math.random() * 2 + 1;
		context.fillRect(x, y, size, size);
	}
	
	earthNightTexture = new THREE.CanvasTexture(canvas);
	updateLoadingStatus();
}

function createEarthNormalMap() {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 512;
	const context = canvas.getContext('2d');
	
	context.fillStyle = '#8080ff';
	context.fillRect(0, 0, 1024, 512);
	
	for (let i = 0; i < 200; i++) {
		const x = Math.random() * 1024;
		const y = Math.random() * 512;
		const radius = Math.random() * 20 + 5;
		context.fillStyle = '#a0a0ff';
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
	}
	
	earthNormalMap = new THREE.CanvasTexture(canvas);
	earth.material.normalMap = earthNormalMap;
	earth.material.needsUpdate = true;
	updateLoadingStatus();
}

function updateLoadingStatus() {
	texturesLoaded++;
	const loadingDiv = document.getElementById('loading');
	const progressBar = document.getElementById('loading-progress');
	const progressText = document.getElementById('loading-percentage');
	
	const progress = (texturesLoaded / totalTextures) * 100;
	
	if (progressBar) {
		progressBar.style.width = progress + '%';
	}
	
	if (progressText) {
		progressText.textContent = Math.round(progress) + '%';
	}
	
	if (texturesLoaded >= totalTextures) {
		setTimeout(() => {
			loadingDiv.classList.add('hidden');
			setTimeout(() => {
				loadingDiv.style.display = 'none';
			}, 500);
		}, 500);
	}
}

function createSpaceBackground() {
	// Create a reasonably sized spherical skybox
	const skyboxGeometry = new THREE.SphereGeometry(500, 64, 32);
	
	// Create dark blue space with stars
	const canvas = document.createElement('canvas');
	canvas.width = 2048;
	canvas.height = 2048;
	const context = canvas.getContext('2d');
	
	// Much darker space background
	const gradient = context.createRadialGradient(
		canvas.width/2, canvas.height/2, 0,
		canvas.width/2, canvas.height/2, canvas.width/2
	);
	gradient.addColorStop(0, '#020204'); // Almost black center
	gradient.addColorStop(0.5, '#010102'); // Nearly black
	gradient.addColorStop(1, '#000000'); // Pure black
	
	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);
	
	// Add tiny particle-like stars
	context.fillStyle = '#ffffff';
	for (let i = 0; i < 1200; i++) {
		const x = Math.random() * canvas.width;
		const y = Math.random() * canvas.height;
		const radius = Math.random() * 0.4 + 0.1; // Much smaller
		const alpha = Math.random() * 0.6 + 0.1; // Slightly dimmer
		
		context.globalAlpha = alpha;
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
	}
	
	// Add some slightly larger particles (still very small)
	for (let i = 0; i < 150; i++) {
		const x = Math.random() * canvas.width;
		const y = Math.random() * canvas.height;
		const radius = Math.random() * 0.8 + 0.4; // Much smaller than before
		
		// Subtle glow effect
		const starGradient = context.createRadialGradient(x, y, 0, x, y, radius * 2);
		starGradient.addColorStop(0, '#ffffff');
		starGradient.addColorStop(0.3, '#aaaaff');
		starGradient.addColorStop(1, 'transparent');
		
		context.globalAlpha = 0.5; // More subtle
		context.fillStyle = starGradient;
		context.beginPath();
		context.arc(x, y, radius * 3, 0, Math.PI * 2);
		context.fill();
		
		// Bright center
		context.globalAlpha = 1;
		context.fillStyle = '#ffffff';
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
	}
	
	const texture = new THREE.CanvasTexture(canvas);
	texture.mapping = THREE.EquirectangularReflectionMapping;
	
	const skyboxMaterial = new THREE.MeshBasicMaterial({
		map: texture,
		side: THREE.BackSide
	});
	
	const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
	scene.add(skybox);
	
	// Add 3D star field for extra depth
	create3DStarField();
	
	console.log('Created dark blue space background with stars');
}

function create3DStarField() {
	// Create 3D star particles for more depth
	const starCount = 8000;
	const starGeometry = new THREE.BufferGeometry();
	const starPositions = new Float32Array(starCount * 3);
	const starColors = new Float32Array(starCount * 3);
	
	for (let i = 0; i < starCount; i++) {
		// Random position in a large sphere around the scene
		const radius = 200 + Math.random() * 300;
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.random() * Math.PI;
		
		starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
		starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);  
		starPositions[i * 3 + 2] = radius * Math.cos(phi);
		
		// Star colors - mostly white with some blue/yellow tint
		const colorVariation = Math.random();
		if (colorVariation < 0.8) {
			// White stars
			starColors[i * 3] = 1.0;
			starColors[i * 3 + 1] = 1.0;
			starColors[i * 3 + 2] = 1.0;
		} else if (colorVariation < 0.9) {
			// Blue stars
			starColors[i * 3] = 0.8;
			starColors[i * 3 + 1] = 0.9;
			starColors[i * 3 + 2] = 1.0;
		} else {
			// Yellow stars
			starColors[i * 3] = 1.0;
			starColors[i * 3 + 1] = 1.0;
			starColors[i * 3 + 2] = 0.8;
		}
	}
	
	starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
	starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
	
	const starMaterial = new THREE.PointsMaterial({
		size: 0.3, // Much smaller particle size
		vertexColors: true,
		transparent: true,
		opacity: 0.4 // More subtle
	});
	
	const stars = new THREE.Points(starGeometry, starMaterial);
	scene.add(stars);
	
	console.log('Created 3D star field with', starCount, 'stars');
}

function createOrbitalPaths() {
	// Add some orbital reference circles at different distances
	const orbitalRadii = [90, 120, 160, 200];
	
	orbitalRadii.forEach(radius => {
		const orbitGeometry = new THREE.RingGeometry(radius - 0.2, radius + 0.2, 128);
		const orbitMaterial = new THREE.MeshBasicMaterial({
			color: 0x333344,
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 0.1
		});
		const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
		orbitRing.rotation.x = Math.PI / 2;
		orbitRing.rotation.z = Math.random() * Math.PI / 4; // Slight random tilt
		scene.add(orbitRing);
	});
	
	// Add ecliptic plane indicator
	const eclipticGeometry = new THREE.PlaneGeometry(400, 400, 1, 1);
	const eclipticMaterial = new THREE.MeshBasicMaterial({
		color: 0x444466,
		transparent: true,
		opacity: 0.03,
		side: THREE.DoubleSide
	});
	const eclipticPlane = new THREE.Mesh(eclipticGeometry, eclipticMaterial);
	eclipticPlane.rotation.x = Math.PI / 2;
	scene.add(eclipticPlane);
}

function createTrajectoryLine(trajectoryPoints, isHazardous = false) {
	if (!trajectoryPoints || trajectoryPoints.length < 2) return null;
	
	console.log(`Creating trajectory line with ${trajectoryPoints.length} points`);
	console.log('First point:', trajectoryPoints[0]);
	console.log('Last point:', trajectoryPoints[trajectoryPoints.length - 1]);
	
	// Scale factor to bring trajectory coordinates into Earth-Moon system range
	// Using global TRAJECTORY_SCALE constant
	
	// Create line geometry from trajectory points with scaling
	const points = trajectoryPoints.map(point => 
		new THREE.Vector3(
			point.x * TRAJECTORY_SCALE, 
			point.y * TRAJECTORY_SCALE, 
			point.z * TRAJECTORY_SCALE
		)
	);
	
	console.log('Scaled points range:', {
		first: points[0],
		last: points[points.length - 1]
	});
	
	// Method 1: Create basic line
	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineBasicMaterial({
		color: isHazardous ? 0xff44ff : 0x44ffff, 
		transparent: false,
		opacity: 1.0
	});
	const line = new THREE.Line(geometry, material);
	
	// Method 2: Create tube geometry for better visibility (thinner for less clutter)
	const curve = new THREE.CatmullRomCurve3(points);
	const tubeGeometry = new THREE.TubeGeometry(curve, points.length, 0.15, 6, false);
	const tubeMaterial = new THREE.MeshBasicMaterial({
		color: isHazardous ? 0xff66ff : 0x44ffff,
		transparent: true,
		opacity: 0.6
	});
	const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
	
	// Method 3: Create fewer discrete points for key orbital positions (every 10th point)
	const keyPointsGroup = new THREE.Group();
	const sphereGeometry = new THREE.SphereGeometry(0.25, 8, 6);
	const sphereMaterial = new THREE.MeshBasicMaterial({
		color: isHazardous ? 0xff88ff : 0x44ffff,
		transparent: true,
		opacity: 0.9
	});
	
	points.forEach((point, index) => {
		if (index % 10 === 0) { // Show every 10th point to mark key positions
			const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
			sphere.position.copy(point);
			keyPointsGroup.add(sphere);
		}
	});
	
	// Create a group containing all visualization methods
	const group = new THREE.Group();
	group.add(line);           // Basic line
	group.add(tube);           // Tube geometry
	group.add(keyPointsGroup); // Key orbital positions
	
	console.log('Created trajectory line group with multiple visualization methods');
	return group;
}

function createTrajectoryVisualizations() {
	if (!meteoriteData || !meteoriteData.neos) return;
	
	console.log('Creating trajectory visualizations...');
	console.log('NEO data:', meteoriteData.neos.length, 'objects');
	
	// Create group for all trajectory lines
	if (trajectoryGroup) {
		scene.remove(trajectoryGroup);
		trajectoryGroup = null;
	}
	
	trajectoryGroup = new THREE.Group();
	scene.add(trajectoryGroup);
	
	const neos = meteoriteData.neos;
	let createdTrajectories = 0;
	let totalTrajectoryPoints = 0;
	
	neos.forEach((neo, index) => {
		if (neo.trajectory && neo.trajectory.length > 1) {
			console.log(`Creating trajectory for NEO ${index}: ${neo.name} with ${neo.trajectory.length} points`);
			
			const trajectoryLine = createTrajectoryLine(neo.trajectory, neo.is_hazardous);
			
			if (trajectoryLine) {
				// Store NEO data for filtering
				trajectoryLine.userData = {
					neoId: neo.id,
					isHazardous: neo.is_hazardous,
					name: neo.name,
					pointCount: neo.trajectory.length
				};
				
				trajectoryGroup.add(trajectoryLine);
				createdTrajectories++;
				totalTrajectoryPoints += neo.trajectory.length;
				console.log(`Added trajectory ${createdTrajectories} for ${neo.name}`);
			} else {
				console.log(`Failed to create trajectory for ${neo.name}`);
			}
		} else {
			console.log(`NEO ${neo.name} has no trajectory data or insufficient points`);
		}
	});
	
	console.log(`Created ${createdTrajectories} trajectory visualizations total`);
	console.log(`Total trajectory points: ${totalTrajectoryPoints}`);
	console.log('Trajectory group children:', trajectoryGroup.children.length);
	
	// Update the UI with trajectory stats
	updateTrajectoryStats(createdTrajectories, totalTrajectoryPoints);
}

function loadMeteoriteData() {
	fetch('meteorites_data.json')
	.then(response => response.json())
	.then(data => {
		meteoriteData = data;
		createNEOVisualizations();
		createTrajectoryVisualizations();
		updateNEOInfo();
	})
	.catch(error => {
		console.error('Error loading NEO data:', error);
		document.getElementById('neo-count').textContent = 'Error loading data';
	});
}

function calculateDaylightCameraPosition() {
	if (!sunLight || !earth) return null;
	
	// Get the sun's position (light direction)
	const sunDirection = sunLight.position.clone().normalize();
	
	// Calculate optimal viewing position
	// Position camera to look at the day/night terminator from the sunlit side
	const distance = 75; // Optimized distance from Earth center
	const heightOffset = 25; // Better elevation for improved view
	const sideOffset = 15; // Add slight side angle for more interesting view
	
	// Calculate position that shows the daylight side prominently
	const cameraPosition = sunDirection.clone()
	.multiplyScalar(distance)
	.add(new THREE.Vector3(sideOffset, heightOffset, 0));
	
	return cameraPosition;
}

function updateCameraTracking() {
	// Auto camera mode: follow Earth's illuminated side
	if (cameraMode === 'auto') {
		const newPosition = calculateDaylightCameraPosition();
		if (newPosition) {
			// Smoothly move camera to follow illuminated side
			camera.position.lerp(newPosition, 0.02); // Smooth interpolation
			camera.lookAt(0, 0, 0); // Always look at Earth center
		}
	}
	// Manual mode: no automatic camera changes
}

function createNEOVisualizations() {
	if (!meteoriteData) return;
	
	// Handle both old meteorite data and new NEO data
	const objects = meteoriteData.neos || meteoriteData.meteorites || [];
	const isNEOData = !!meteoriteData.neos;
	
	if (objects.length === 0) return;
	
	// Create group for all objects
	meteoriteGroup = new THREE.Group();
	scene.add(meteoriteGroup);
	
	// Create shared geometry and materials for better performance
	if (!sharedGeometry) {
		sharedGeometry = new THREE.SphereGeometry(1, 12, 8); // Base unit sphere, optimized detail
	}
	
	// Create LOD geometries for different distances
	const lodGeometries = {
		high: new THREE.SphereGeometry(1, 16, 10),    // Close objects
		medium: sharedGeometry,                        // Medium distance
		low: new THREE.SphereGeometry(1, 8, 6)        // Far objects
	};
	
	// Create materials for different types (shared, not cloned)
	const hazardousMaterial = new THREE.MeshPhongMaterial({
		color: 0xff22ff,
		emissive: 0x441111,
		shininess: 100,
		transparent: true,
		opacity: 0.9
	});
	
	const safeMaterial = new THREE.MeshPhongMaterial({
		color: 0xfbfbfb,
		emissive: 0x111144,
		shininess: 100,
		transparent: true,
		opacity: 0.8
	});
	
	const meteoriteMaterial = new THREE.MeshPhongMaterial({
		color: 0xfbfbfb,
		emissive: 0x441111,
		shininess: 100,
		transparent: true,
		opacity: 0.8
	});
	
	const glowMaterial = new THREE.MeshBasicMaterial({
		color: 0xff66ff,
		transparent: true,
		opacity: 0.3
	});
	
	objects.forEach((obj, index) => {
		// Use shared geometry with scaling instead of creating new geometry
		let material;
		if (isNEOData) {
			material = obj.is_hazardous ? hazardousMaterial : safeMaterial;
		} else {
			material = meteoriteMaterial;
		}
		
		const mesh = new THREE.Mesh(sharedGeometry, material);
		
		// Scale the shared geometry to the object's size
		mesh.scale.setScalar(obj.size);
		
		// Position object with scaling to match trajectory coordinates
		// Using global TRAJECTORY_SCALE constant
		mesh.position.set(
			obj.position.x * TRAJECTORY_SCALE,
			obj.position.y * TRAJECTORY_SCALE,
			obj.position.z * TRAJECTORY_SCALE
		);
		
		// Store object daSIMULor interaction
		if (isNEOData) {
			mesh.userData = {
				name: obj.name,
				diameter: obj.diameter_meters,
				orbit_radius: obj.orbit_radius_au,
				orbit_distance: obj.orbit_radius_au,
				is_hazardous: obj.is_hazardous,
				id: obj.id,
				inclination: obj.inclination,
				eccentricity: obj.eccentricity,
				originalSize: obj.size,  // Store original size for LOD
				impact_stats: obj.impact_stats,  // Include impact statistics
				mass: obj.impact_stats ? obj.impact_stats.mass : 1000000,
				impact_energy: obj.impact_stats ? obj.impact_stats.impact_energy : 10000000,
				mesh: mesh  // Reference to the mesh for positioning
			};
		} else {
			// Legacy meteorite data
			mesh.userData = {
				name: obj.name,
				mass: obj.mass,
				year: obj.year,
				latitude: obj.latitude,
				longitude: obj.longitude,
				originalSize: obj.size  // Store original size for LOD
			};
		}
		
		// Create glow effect for hazardous NEOs or large meteorites
		const shouldGlow = isNEOData ? obj.is_hazardous : obj.mass > 50000000;
		if (shouldGlow) {
			const glowMesh = new THREE.Mesh(sharedGeometry, glowMaterial);
			glowMesh.scale.setScalar(obj.size * 1.8);
			glowMesh.position.copy(mesh.position);
			meteoriteGroup.add(glowMesh);
			
			// Animate glow
			glowMesh.userData.animationOffset = index * 0.1;
		}
		
		meteoriteGroup.add(mesh);
	});
	
	console.log(`Created ${objects.length} ${isNEOData ? 'NEO' : 'meteorite'} visualizations`);
}

function updateNEOInfo() {
	if (meteoriteData) {
		const isNEOData = !!meteoriteData.neos;
		const objects = meteoriteData.neos || meteoriteData.meteorites || [];
		
		if (isNEOData) {
			document.getElementById('neo-count').textContent = `${objects.length} Near Earth Objects`;
			document.getElementById('hazardous-count').textContent =
			`${meteoriteData.metadata.hazardous_count || 0} hazardous`;
		} else {
			document.getElementById('neo-count').textContent = `${objects.length} meteorite impacts`;
			document.getElementById('hazardous-count').textContent = '0 hazardous';
		}
		
		// Update loading message
		const loadingDiv = document.getElementById('loading');
		if (loadingDiv.style.display !== 'none' && !loadingDiv.innerHTML.includes('textures')) {
			loadingDiv.innerHTML = `
			<div style="display: flex; align-items: center; gap: 8px;">
			<div style="width: 8px; height: 8px; background: #00ff88; border-radius: 50%;"></div>
			${isNEOData ? 'NEO' : 'Meteorite'} data loaded!
			</div>
			`;
		}
	}
}

function updateTrajectoryStats(trajectoryCount, totalPoints) {
	// Update the hazardous count display to include trajectory info
	const hazardousCountEl = document.getElementById('hazardous-count');
	if (hazardousCountEl && trajectoryCount > 0) {
		hazardousCountEl.innerHTML = `
			${meteoriteData.metadata.hazardous_count || 0} hazardous<br>
			<small style="color: #888; font-size: 11px;">
				${trajectoryCount} trajectories (${totalPoints.toLocaleString()} points)
			</small>
		`;
	}
}

let lastRaycastTime = 0;
const raycastThrottle = 50; // milliseconds

function setupMouseInteraction() {
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
	
	renderer.domElement.addEventListener('mousemove', onMouseMove);
	renderer.domElement.addEventListener('click', onMouseClick);
}

function onMouseClick(event) {
	if (!meteoriteGroup) return;
	
	// Calculate mouse position in normalized device coordinates
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	
	// Update the picking ray with the camera and mouse position
	raycaster.setFromCamera(mouse, camera);
	
	// Calculate objects intersecting the picking ray
	const meshesToTest = meteoriteGroup.children.filter(child => child.userData.name);
	const intersects = raycaster.intersectObjects(meshesToTest);
	
	if (intersects.length > 0) {
		const selectedNEO = intersects[0].object;
		if (selectedNEO.userData.name) {
			// Switch to manual camera mode
			if (cameraMode === 'auto') {
				cameraMode = 'manual';
				lastUserInteraction = Date.now();
				updateCameraModeDisplay();
			}
			
			// Position camera above the meteorite
			positionCameraAboveMeteorite(selectedNEO.userData);
			
			// Create a clean copy without circular references for AI analysis
			const cleanData = { ...selectedNEO.userData };
			delete cleanData.mesh; // Remove circular reference
			
			triggerContextualAnalysis(cleanData);
		}
	} 	
}

function onMouseMove(event) {
	if (!meteoriteGroup) return;
	
	// Throttle raycasting for better performance
	const now = Date.now();
	if (now - lastRaycastTime < raycastThrottle) {
		return;
	}
	lastRaycastTime = now;
	
	// Calculate mouse position in normalized device coordinates
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	
	// Update the picking ray with the camera and mouse position
	raycaster.setFromCamera(mouse, camera);
	
	// Calculate objects intersecting the picking ray (only test main meshes, not glow effects)
	const meshesToTest = meteoriteGroup.children.filter(child => child.userData.name);
	const intersects = raycaster.intersectObjects(meshesToTest);
	
	if (intersects.length > 0) {
		const meteorite = intersects[0].object;
		if (meteorite.userData.name) {
			showNEOInfo(meteorite.userData);
			document.body.style.cursor = 'pointer';
		}
	} else {
		hideNEOInfo();
		document.body.style.cursor = 'default';
	}
}

function setupFilterControls() {
	const hazardousBtn = document.getElementById('filter-hazardous');
	const safeBtn = document.getElementById('filter-safe');
	const trajectoriesBtn = document.getElementById('filter-trajectories');
	
	hazardousBtn.addEventListener('click', () => {
		filters.hazardous = !filters.hazardous;
		hazardousBtn.classList.toggle('active', filters.hazardous);
		updateNEOVisibility();
	});
	
	safeBtn.addEventListener('click', () => {
		filters.safe = !filters.safe;
		safeBtn.classList.toggle('active', filters.safe);
		updateNEOVisibility();
	});
	
	trajectoriesBtn.addEventListener('click', () => {
		filters.trajectories = !filters.trajectories;
		trajectoriesBtn.classList.toggle('active', filters.trajectories);
		updateTrajectoryVisibility();
	});
}

function updateNEOVisibility() {
	if (!meteoriteGroup || !meteoriteData) return;
	
	const isNEOData = !!meteoriteData.neos;
	if (!isNEOData) return; // Only works with NEO data
	
	meteoriteGroup.children.forEach(child => {
		if (!child.userData.name) return; // Skip glow effects
		
		const isHazardous = child.userData.is_hazardous;
		let shouldShow = false;
		
		if (isHazardous && filters.hazardous) {
			shouldShow = true;
		} else if (!isHazardous && filters.safe) {
			shouldShow = true;
		}
		
		child.visible = shouldShow;
		
		// Also hide/show glow effects
		const glowMesh = meteoriteGroup.children.find(glow =>
		glow.userData.animationOffset !== undefined &&
		glow.position.equals(child.position)
		);
		if (glowMesh) {
			glowMesh.visible = shouldShow;
		}
	});
	
	updateTrajectoryVisibility();
	updateVisibleCount();
}

function updateTrajectoryVisibility() {
	if (!trajectoryGroup) return;
	
	trajectoryGroup.children.forEach(trajectory => {
		if (filters.trajectories) {
			// Show trajectory based on NEO filters
			const isHazardous = trajectory.userData.isHazardous;
			let shouldShow = false;
			
			if (isHazardous && filters.hazardous) {
				shouldShow = true;
			} else if (!isHazardous && filters.safe) {
				shouldShow = true;
			}
			
			trajectory.visible = shouldShow;
		} else {
			// Hide all trajectories
			trajectory.visible = false;
		}
	});
}

function updateVisibleCount() {
	if (!meteoriteGroup) return;
	
	let visibleCount = 0;
	meteoriteGroup.children.forEach(child => {
		if (child.userData.name && child.visible) {
			visibleCount++;
		}
	});
	
	document.getElementById('object-count').textContent = visibleCount;
}

function animate(currentTime = 0) {
	requestAnimationFrame(animate);
	
	if (currentTime - lastTime < frameInterval) {
		return;
	}
	
	const deltaTime = currentTime - lastTime;
	lastTime = currentTime;
	frameCount++;
	
	//  FPS
	if (frameCount % 60 === 0) {
		performanceStats.fps = Math.round(1000 / deltaTime);
		performanceStats.frameTime = deltaTime.toFixed(2);
		updatePerformanceDisplay();
	}
	
	if (cameraMode === 'manual') {
		controls.update();
		
		// Check if camera moved manually while meteorite overlay is visible
		if (meteoriteOverlay && selectedMeteorite) {
			const currentPos = camera.position;
			const distance = lastCameraPosition.distanceTo(currentPos);
			
			// If camera moved significantly, hide overlay
			if (distance > 0.5) {
				hideMeteoriteOverlay();
			}
		}
		
		// Update last camera position
		lastCameraPosition.copy(camera.position);
	}
	
	updateCameraTracking();
	
	if (currentTime - lastLODUpdate > lodUpdateInterval) {
		updateLOD();
		lastLODUpdate = currentTime;
	}
	
	if (earth && moon) {
		earth.rotation.y += 0.0005 * (deltaTime / 16.67);
		
		moonOrbit.rotation.y += 0.00015 * (deltaTime / 16.67);
		
		moon.rotation.y += 0.00015 * (deltaTime / 16.67);
		
		const time = Date.now() * 0.0001;
		sunLight.position.x = Math.cos(time) * 200;
		sunLight.position.z = Math.sin(time) * 200;
	}
	
	if (meteoriteGroup) {
		const time = Date.now() * 0.001;
		meteoriteGroup.children.forEach(child => {
			if (child.userData.animationOffset !== undefined) {
				const pulse = Math.sin(time + child.userData.animationOffset) * 0.5 + 0.5;
				child.material.opacity = 0.2 + pulse * 0.3;
				child.scale.setScalar(0.8 + pulse * 0.4);
			}
		});
	}
	
	renderer.render(scene, camera);
}

function updatePerformanceDisplay() {
	document.getElementById('fps').textContent = performanceStats.fps;
	document.getElementById('frame-time').textContent = performanceStats.frameTime;
	document.getElementById('object-count').textContent = meteoriteGroup ? meteoriteGroup.children.length : 0;
	updateCameraModeDisplay();
}

let lastLODUpdate = 0;
const lodUpdateInterval = 500;

function updateLOD() {
	if (!meteoriteGroup || !camera) return;
	
	const cameraPosition = camera.position;
	
	meteoriteGroup.children.forEach(child => {
		if (!child.userData.name) return;
		
		const distance = cameraPosition.distanceTo(child.position);
		
		if (distance < 50) {
			// High detail for close objects
			if (child.geometry.parameters.widthSegments !== 16) {
				child.geometry.dispose();
				child.geometry = new THREE.SphereGeometry(1, 16, 10);
				child.scale.setScalar(child.userData.originalSize || child.scale.x);
			}
		} else if (distance < 150) {
			// Medium detail
			if (child.geometry.parameters.widthSegments !== 12) {
				child.geometry.dispose();
				child.geometry = sharedGeometry;
				child.scale.setScalar(child.userData.originalSize || child.scale.x);
			}
		} else {
			// Low detail for far objects
			if (child.geometry.parameters.widthSegments !== 8) {
				child.geometry.dispose();
				child.geometry = new THREE.SphereGeometry(1, 8, 6);
				child.scale.setScalar(child.userData.originalSize || child.scale.x);
			}
		}
	});
}

const chatInput = document.getElementById('chat-input-container');
if (chatInput && document.activeElement !== chatInput) {
	document.addEventListener('keydown', (event) => {
		if (event.key.toLowerCase() === 'p') {
			togglePerformancePanel();
		} else if (event.key.toLowerCase() === 'c') {
			toggleCameraMode();
		} else if (event.key.toLowerCase() === 'h') {
			// Toggle all panels with 'h' for hide
			toggleAllPanels();
		}
	});
}

// AI Assistant System Functions

function initializeAISystem() {
	console.log('Initializing AI system...');
	
	// Use hardcoded API keys
	aiSystem.geminiApiKey = 'AIzaSyDEFp98qCas7KHws3kR2TPWx6fIWXf10LU';
	aiSystem.elevenlabsApiKey = '138aa4dcf00277ab29d4e7a2e3d861574c168fdb2307de86b79273d98e5338c2';
	
	// Initialize Google GenerativeAI
	try {
		aiSystem.genAI = new GoogleGenerativeAI(aiSystem.geminiApiKey);
		console.log('Google GenerativeAI initialized successfully');
	} catch (error) {
		console.error('Failed to initialize Google GenerativeAI:', error);
	}
	
	// Initialize speech recognition
	initializeSpeechRecognition();
	
	// Add welcome message after a short delay to ensure DOM is ready
	setTimeout(() => {
		if (aiSystem.genAI) {
			addChatMessage('AI Assistant ready! You can now use voice commands or type questions about Near Earth Objects.', 'assistant');
		} else {
			addChatMessage('AI Assistant initialization failed.', 'system');
		}
	}, 500);
}



function initializeSpeechRecognition() {
	if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
		console.warn('Speech recognition not supported');
		return;
	}
	
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	aiSystem.recognition = new SpeechRecognition();
	
	aiSystem.recognition.continuous = false;
	aiSystem.recognition.interimResults = false;
	aiSystem.recognition.lang = 'en-US';
	
	aiSystem.recognition.onstart = () => {
		aiSystem.isListening = true;
		updateVoiceButton();
		addChatMessage('Listening...', 'system');
	};
	
	aiSystem.recognition.onresult = (event) => {
		const transcript = event.results[0][0].transcript;
		addChatMessage(transcript, 'user');
		processVoiceCommand(transcript);
	};
	
	aiSystem.recognition.onerror = (event) => {
		console.error('Speech recognition error:', event.error);
		addChatMessage(`Speech recognition error: ${event.error}`, 'system');
		aiSystem.isListening = false;
		updateVoiceButton();
	};
	
	aiSystem.recognition.onend = () => {
		aiSystem.isListening = false;
		updateVoiceButton();
	};
}

function toggleVoiceRecognition() {
	if (!aiSystem.recognition) {
		addChatMessage('Speech recognition not available', 'system');
		return;
	}
	
	if (aiSystem.isListening) {
		aiSystem.recognition.stop();
	} else {
		aiSystem.recognition.start();
	}
}

function updateVoiceButton() {
	const voiceBtn = document.getElementById('voice-toggle');
	if (voiceBtn) {
		voiceBtn.classList.toggle('listening', aiSystem.isListening);
	}
}

function sendChatMessage() {
	console.log('sendChatMessage called');
	const input = document.getElementById('chat-input');
	if (!input) {
		console.error('Chat input element not found');
		return;
	}
	
	const message = input.value.trim();
	console.log('Message to send:', message);
	
	if (!message) {
		console.log('Empty message, not sending');
		return;
	}
	
	addChatMessage(message, 'user');
	input.value = '';
	
	processUserMessage(message);
}

function addChatMessage(message, type) {
	const chatMessages = document.getElementById('chat-messages');
	if (!chatMessages) {
		console.warn('Chat messages container not found');
		return;
	}
	
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${type}`;
	
	const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
	
	// For assistant messages, add a speaker button to replay audio
	const speakerButton = type === 'assistant' && aiSystem.elevenlabsApiKey ? 
		`<button class="replay-audio-btn" data-message-text="${encodeURIComponent(message)}" title="Replay Audio">
			<i data-lucide="volume-2" class="lucide-icon"></i>
		</button>` : '';
	
	messageDiv.innerHTML = `
		<div class="message-content">${message}</div>
		<div class="message-footer">
			<div class="message-time">${timestamp}</div>
			${speakerButton}
		</div>
	`;
	
	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	
	// Add event listener to the replay button if it exists
	// if (speakerButton) {
		const replayBtn = messageDiv.querySelector('.replay-audio-btn');
		console.log('btnExist');
		if (replayBtn) {
			replayBtn.addEventListener('click', function() {
				console.log('Replay button clicked!');
				const messageText = decodeURIComponent(this.getAttribute('data-message-text'));
				replayMessageAudio(this, messageText);
			});
		} else {
			console.log('Replay button not found in message');
		}
	// }
	
	// Initialize Lucide icons for the new button
	if (speakerButton && typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
}

// Replay audio for a specific message
function replayMessageAudio(buttonElement, messageText) {
	console.log('Replay button clicked, message:', messageText?.substring(0, 50) + '...');
	
	if (!aiSystem.elevenlabsApiKey) {
		console.log('ElevenLabs API key not configured');
		return;
	}
	
	if (aiSystem.isMuted) {
		console.log('Audio is muted');
		return;
	}
	
	if (!messageText || messageText.trim().length === 0) {
		console.log('No message text to replay');
		return;
	}
	
	// Add loading state to button
	const icon = buttonElement.querySelector('.lucide-icon');
	const originalIconName = icon.getAttribute('data-lucide');
	icon.setAttribute('data-lucide', 'loader-2');
	buttonElement.classList.add('loading');
	buttonElement.disabled = true;
	
	// Recreate the icon
	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
	
	// Generate and play audio
	generateSpeech(messageText).then(() => {
		// Reset button state
		icon.setAttribute('data-lucide', originalIconName);
		buttonElement.classList.remove('loading');
		buttonElement.disabled = false;
		
		if (typeof lucide !== 'undefined') {
			lucide.createIcons();
		}
	}).catch((error) => {
		console.error('Error replaying audio:', error);
		// Reset button state on error
		icon.setAttribute('data-lucide', originalIconName);
		buttonElement.classList.remove('loading');
		buttonElement.disabled = false;
		
		if (typeof lucide !== 'undefined') {
			lucide.createIcons();
		}
	});
}

// Make function globally available
window.replayMessageAudio = replayMessageAudio;

async function processUserMessage(message) {
	if (!aiSystem.genAI) {
		addChatMessage('Gemini API key not configured. Please set up API keys to use AI features.', 'system');
		return;
	}
	
	// Add thinking indicator
	addChatMessage('Analyzing...', 'assistant');
	
	try {
		// Prepare context about current scene state
		const context = getCurrentSceneContext();
		
		// Call Gemini API
		const response = await callGeminiAPI(message, context);
		
		// Remove thinking indicator
		const messages = document.querySelectorAll('.message.assistant');
		const lastMessage = messages[messages.length - 1];
		if (lastMessage && lastMessage.textContent.includes('Analyzing...')) {
			lastMessage.remove();
		}
		
		// Process camera commands from AI response
		const cameraCommands = parseCameraCommands(response);
		if (cameraCommands.length > 0) {
			executeCameraCommands(cameraCommands);
		}
		
		// Clean response for display (remove camera commands)
		const cleanResponse = cleanResponseForDisplay(response);
		addChatMessage(cleanResponse, 'assistant');
		
		// Generate audio if enabled (use clean response)
		if (aiSystem.elevenlabsApiKey && !aiSystem.isMuted && cleanResponse.trim().length > 0) {
			generateSpeech(cleanResponse);
		}
		
	} catch (error) {
		console.error('Error processing message:', error);
		addChatMessage('Sorry, I encountered an error processing your request.', 'assistant');
	}
}

function processVoiceCommand(transcript) {
	const command = transcript.toLowerCase();
	
	// Handle specific voice commands for scene manipulation
	if (command.includes('show') || command.includes('find')) {
		if (command.includes('dangerous') || command.includes('hazardous')) {
			highlightHazardousNEOs();
			processUserMessage(`Tell me about the most dangerous Near Earth Objects currently visible.`);
		} else if (command.includes('largest') || command.includes('biggest')) {
			highlightLargestNEOs();
			processUserMessage(`Explain the largest Near Earth Objects in the current view.`);
		} else if (command.includes('closest') || command.includes('nearest')) {
			highlightClosestNEOs();
			processUserMessage(`Describe the closest Near Earth Objects to Earth.`);
		} else {
			processUserMessage(transcript);
		}
	} else if (command.includes('zoom') || command.includes('focus')) {
		// Extract object name if mentioned
		const neoNames = getCurrentNEONames();
		const mentionedNEO = neoNames.find(name => command.includes(name.toLowerCase()));
		if (mentionedNEO) {
			focusOnNEO(mentionedNEO);
			processUserMessage(`Tell me about ${mentionedNEO} in detail.`);
		} else {
			processUserMessage(transcript);
		}
	} else {
		// Regular AI conversation
		processUserMessage(transcript);
	}
}

function getCurrentSceneContext() {
	const context = {
		cameraPosition: camera.position.toArray(),
		visibleNEOs: [],
		currentlySelected: aiSystem.currentContext,
		totalNEOs: meteoriteGroup ? meteoriteGroup.children.length : 0
	};
	
	// Get info about visible NEOs in the scene
	if (meteoriteGroup) {
		meteoriteGroup.children.forEach(child => {
			if (child.userData.name) {
				const distance = camera.position.distanceTo(child.position);
				if (distance < 200) { // Only include nearby objects
					context.visibleNEOs.push({
						name: child.userData.name,
						distance: Math.round(distance),
						isHazardous: child.userData.is_hazardous,
						diameter: child.userData.diameter
					});
				}
			}
		});
	}
	
	return context;
}

async function callGeminiAPI(message, context) {
	if (!aiSystem.genAI) {
		throw new Error('Google GenerativeAI not initialized');
	}
	
	try {
		// Try different model names that work with the v1beta API
		// Prioritizing gemini-2.5-pro as the recommended model
		const possibleModels = [
			// Gemini 2.5 Pro - RECOMMENDED
			"gemini-2.5-pro",
			"models/gemini-2.5-pro",
			
			// Other Gemini 2.5 models
			"gemini-2.5-flash",
			"models/gemini-2.5-flash",
			
			// Gemini 1.5 models (fallback)
			"gemini-1.5-pro",
			"models/gemini-1.5-pro",
			"gemini-1.5-flash",
			"models/gemini-1.5-flash",
			"gemini-1.5-pro-latest",
			"models/gemini-1.5-pro-latest",
			"gemini-1.5-flash-latest",
			"models/gemini-1.5-flash-latest",
			
			// Experimental and versioned models
			"gemini-1.5-pro-exp-0827",
			"models/gemini-1.5-pro-exp-0827",
			"gemini-1.5-flash-exp-0827",
			"models/gemini-1.5-flash-exp-0827",
			"gemini-1.5-pro-002",
			"models/gemini-1.5-pro-002",
			"gemini-1.5-flash-002",
			"models/gemini-1.5-flash-002",
			
			// Gemini 1.0 models (legacy fallback)
			"gemini-1.0-pro",
			"models/gemini-1.0-pro",
			"gemini-1.0-pro-latest",
			"models/gemini-1.0-pro-latest",
			"gemini-1.0-pro-001",
			"models/gemini-1.0-pro-001",
			
			// Legacy models (last resort)
			"gemini-pro",
			"models/gemini-pro"
		];
		
		let model;
		let lastError;
		let workingModel = localStorage.getItem('working_gemini_model');
		
		// If we have a previously working model, try it first
		if (workingModel) {
			try {
				model = aiSystem.genAI.getGenerativeModel({ model: workingModel });
				const testResult = await model.generateContent("Test");
				await testResult.response;
				console.log(`Using cached working model: ${workingModel}`);
			} catch (error) {
				console.log(`Cached model ${workingModel} no longer works, trying others...`);
				model = null;
				localStorage.removeItem('working_gemini_model');
			}
		}
		
		// If no cached model or it failed, try all models
		if (!model) {
			for (const modelName of possibleModels) {
				try {
					model = aiSystem.genAI.getGenerativeModel({ model: modelName });
					
					// Test with a simple prompt first
					const testResult = await model.generateContent("Hello");
					await testResult.response;
					console.log(`Successfully using model: ${modelName}`);
					
					// Cache the working model
					localStorage.setItem('working_gemini_model', modelName);
					break;
				} catch (error) {
					console.log(`Model ${modelName} failed:`, error.message);
					lastError = error;
					continue;
				}
			}
		}
		
		if (!model) {
			throw new Error(`No working model found. Last error: ${lastError?.message}`);
		}
		
		// Get current NEO names for camera control
		const neoNames = getCurrentNEONames();
		
		const systemPrompt = `You are an expert space exploration guide with the personality of a Discovery Channel narrator. You're helping users explore Near Earth Objects (NEOs) in an interactive 3D visualization.

Current scene context: ${JSON.stringify(context)}

Available NEOs for camera control: ${neoNames.join(', ')}

CAMERA CONTROL SYSTEM:
You can control the 3D camera view by including special commands in your response. These commands will be executed automatically and then hidden from the user:

- [FOCUS:NEO_NAME] - Focus camera on a specific NEO (use exact name from available list)
- [FOCUS:EARTH] - Focus camera on Earth with overview of surrounding NEOs
- [FOCUS:OVERVIEW] - Show wide overview of entire solar system and NEO field

Examples:
"Let me show you Apophis up close. [FOCUS:Apophis] This massive asteroid..."
"Now let's see Earth and the surrounding threats. [FOCUS:EARTH] From this perspective..."
"Here's the big picture of our cosmic neighborhood. [FOCUS:OVERVIEW] As you can see..."

Use these commands naturally when:
- Discussing specific NEOs (focus on them)
- Explaining Earth's position relative to NEOs
- Showing scale or overview perspectives
- Guiding users through the visualization

Provide engaging, educational responses about space, asteroids, and NEOs. Keep responses conversational but informative, like a documentary narrator. When discussing specific NEOs, mention their key characteristics like size, hazard status, and orbital properties.

If asked about dangerous or hazardous objects, emphasize both the scientific facts and the fascination of space exploration. Always maintain an enthusiastic but educational tone.

The test answers should be given in plain text do not use any from of markdown syntaxis`;
		
		const prompt = `${systemPrompt}\n\nUser question: ${message}`;
		
		const result = await model.generateContent(prompt);
		const response = await result.response;
		return response.text();
		
	} catch (error) {
		console.error('Gemini API error:', error);
		throw new Error(`Failed to generate response: ${error.message}`);
	}
}

async function generateSpeech(text) {
	if (!aiSystem.elevenlabsApiKey) {
		console.log('ElevenLabs API key not set');
		return Promise.reject('API key not set');
	}
	
	if (!text || text.trim().length === 0) {
		console.log('No text to synthesize');
		return Promise.reject('No text provided');
	}
	
	console.log('Generating speech for:', text.substring(0, 50) + '...');
	
	try {
		const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${aiSystem.voiceId}`, {
			method: 'POST',
			headers: {
				'Accept': 'audio/mpeg',
				'Content-Type': 'application/json',
				'xi-api-key': aiSystem.elevenlabsApiKey
			},
			body: JSON.stringify({
				text: text,
				model_id: 'eleven_turbo_v2',
				voice_settings: {
					stability: 0.75,
					similarity_boost: 0.85,
					style: 0.3,
					use_speaker_boost: true
				}
			})
		});
		
		console.log('ElevenLabs response status:', response.status);
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error('ElevenLabs API error:', response.status, errorText);
			return Promise.reject(`API error: ${response.status}`);
		}
		
		const audioBlob = await response.blob();
		console.log('Audio blob size:', audioBlob.size, 'bytes');
		
		if (audioBlob.size === 0) {
			console.error('Received empty audio blob');
			return Promise.reject('Empty audio blob');
		}
		
		const audioUrl = URL.createObjectURL(audioBlob);
		
		// Stop current audio if playing
		if (aiSystem.currentAudio) {
			aiSystem.currentAudio.pause();
			aiSystem.currentAudio = null;
		}
		
		aiSystem.currentAudio = new Audio(audioUrl);
		aiSystem.currentAudio.volume = aiSystem.volume;
		
		// Return a promise that resolves when audio finishes or rejects on error
		return new Promise((resolve, reject) => {
			// Add error handling for audio playback
			aiSystem.currentAudio.addEventListener('error', (e) => {
				console.error('Audio playback error:', e);
				reject(e);
			});
			
			aiSystem.currentAudio.addEventListener('loadstart', () => {
				console.log('Audio loading started');
			});
			
			aiSystem.currentAudio.addEventListener('canplay', () => {
				console.log('Audio can start playing');
			});
			
			// Clean up URL when audio ends
			aiSystem.currentAudio.addEventListener('ended', () => {
				console.log('Audio playback ended');
				URL.revokeObjectURL(audioUrl);
				resolve();
			});
			
			// Start playback
			const playPromise = aiSystem.currentAudio.play();
			
			if (playPromise !== undefined) {
				playPromise.then(() => {
					console.log('Audio playback started successfully');
				}).catch((error) => {
					console.error('Audio playback failed:', error);
					reject(error);
				});
			}
		});
		
	} catch (error) {
		console.error('Error generating speech:', error);
		return Promise.reject(error);
	}
}

function toggleMute() {
	aiSystem.isMuted = !aiSystem.isMuted;
	const muteBtn = document.getElementById('mute-toggle');
	if (muteBtn) {
		muteBtn.classList.toggle('muted', aiSystem.isMuted);
	}
	
	if (aiSystem.currentAudio) {
		if (aiSystem.isMuted) {
			aiSystem.currentAudio.pause();
		}
	}
}

// Scene manipulation functions for voice commands
function highlightHazardousNEOs() {
	if (!meteoriteGroup) return;
	
	meteoriteGroup.children.forEach(child => {
		if (child.userData.is_hazardous) {
			// Add a pulsing highlight effect
			const originalScale = child.scale.x;
			const highlightAnimation = () => {
				child.scale.setScalar(originalScale * (1 + 0.2 * Math.sin(Date.now() * 0.01)));
			};
			
			// Run animation for 3 seconds
			const interval = setInterval(highlightAnimation, 16);
			setTimeout(() => {
				clearInterval(interval);
				child.scale.setScalar(originalScale);
			}, 3000);
		}
	});
}

function highlightLargestNEOs() {
	if (!meteoriteGroup) return;
	
	// Find the largest NEOs
	const sortedNEOs = meteoriteGroup.children
		.filter(child => child.userData.diameter)
		.sort((a, b) => b.userData.diameter - a.userData.diameter)
		.slice(0, 5);
	
	sortedNEOs.forEach(neo => {
		const originalScale = neo.scale.x;
		const highlightAnimation = () => {
			neo.scale.setScalar(originalScale * (1 + 0.3 * Math.sin(Date.now() * 0.008)));
		};
		
		const interval = setInterval(highlightAnimation, 16);
		setTimeout(() => {
			clearInterval(interval);
			neo.scale.setScalar(originalScale);
		}, 4000);
	});
}

function highlightClosestNEOs() {
	if (!meteoriteGroup || !earthGroup) return;
	
	const earthPosition = earthGroup.position;
	const sortedNEOs = meteoriteGroup.children
		.filter(child => child.userData.name)
		.sort((a, b) => {
			const distA = earthPosition.distanceTo(a.position);
			const distB = earthPosition.distanceTo(b.position);
			return distA - distB;
		})
		.slice(0, 5);
	
	sortedNEOs.forEach(neo => {
		const originalScale = neo.scale.x;
		const highlightAnimation = () => {
			neo.scale.setScalar(originalScale * (1 + 0.25 * Math.sin(Date.now() * 0.012)));
		};
		
		const interval = setInterval(highlightAnimation, 16);
		setTimeout(() => {
			clearInterval(interval);
			neo.scale.setScalar(originalScale);
		}, 3500);
	});
}

function focusOnNEO(neoName) {
	if (!meteoriteGroup) return;
	
	const targetNEO = meteoriteGroup.children.find(child => 
		child.userData.name && child.userData.name.toLowerCase().includes(neoName.toLowerCase())
	);
	
	if (targetNEO) {
		// Calculate position that centers the NEO while keeping Earth in background
		const neoPosition = targetNEO.position.clone();
		const earthPosition = new THREE.Vector3(0, 0, 0); // Earth is at origin
		
		// Create a vector from Earth to NEO
		const earthToNeo = neoPosition.clone().sub(earthPosition);
		
		// Position camera on the opposite side of NEO from Earth, but closer to NEO
		const distance = 40; // Distance from NEO
		const cameraDirection = earthToNeo.clone().normalize().multiplyScalar(-distance);
		const targetPosition = neoPosition.clone().add(cameraDirection);
		
		// Add slight offset to avoid perfectly linear alignment
		targetPosition.add(new THREE.Vector3(5, 8, 5));
		
		// Set camera position and look at the NEO
		camera.position.copy(targetPosition);
		camera.lookAt(neoPosition);
		
		console.log(`Focused on ${neoName} with Earth in background`);
		return true;
	}
	return false;
}

function focusOnEarth() {
	// Position camera to show Earth with surrounding NEOs
	const earthPosition = new THREE.Vector3(0, 0, 0);
	const cameraDistance = 150;
	
	// Position camera at a good angle to see Earth and nearby NEOs
	camera.position.set(100, 80, 100);
	camera.lookAt(earthPosition);
	
	console.log('Focused on Earth with NEO overview');
}

function focusOverview() {
	// Wide view showing the entire NEO field and Earth
	const cameraDistance = 300;
	
	// Position camera far back to see the full scope
	camera.position.set(200, 150, 200);
	camera.lookAt(new THREE.Vector3(0, 0, 0));
	
	console.log('Showing overview of entire NEO field');
}

// Camera control command parser
function parseCameraCommands(text) {
	const commands = [];
	const focusRegex = /\[FOCUS:([^\]]+)\]/g;
	let match;
	
	while ((match = focusRegex.exec(text)) !== null) {
		commands.push({
			type: 'FOCUS',
			target: match[1].trim(),
			fullMatch: match[0]
		});
	}
	
	return commands;
}

// Execute camera commands
function executeCameraCommands(commands) {
	commands.forEach(command => {
		if (command.type === 'FOCUS') {
			const target = command.target.toLowerCase();
			
			if (target === 'earth') {
				focusOnEarth();
			} else if (target === 'overview') {
				focusOverview();
			} else {
				// Try to focus on specific NEO
				const success = focusOnNEO(command.target);
				if (!success) {
					console.warn(`Could not find NEO: ${command.target}`);
				}
			}
		}
	});
}

// Clean response text by removing camera commands
function cleanResponseForDisplay(text) {
	return text.replace(/\[FOCUS:[^\]]+\]/g, '').trim();
}

function getCurrentNEONames() {
	if (!meteoriteGroup) return [];
	
	return meteoriteGroup.children
		.filter(child => child.userData.name)
		.map(child => child.userData.name);
}

// Contextual NEO Analysis Function
function triggerContextualAnalysis(neoData) {
	if (!aiSystem.geminiApiKey) {
		addChatMessage('Click detected on NEO: ' + neoData.name + '. Enable AI features to get detailed analysis.', 'system');
		return;
	}
	
	// Store selected object for context
	aiSystem.currentContext = neoData;
	
	// Generate contextual analysis prompt
	const analysisPrompt = `I've selected ${neoData.name} in the 3D visualization. Please provide a Discovery Channel-style analysis including:
	
	- Key characteristics (diameter: ${neoData.diameter}m, hazardous: ${neoData.is_hazardous ? 'Yes' : 'No'})
	- What makes this object interesting or significant
	- Its orbital characteristics and potential impact scenarios
	- Any fascinating facts about this type of NEO
	
	Make it engaging like a space documentary narrator would describe it.`;
	
	// Add user message to chat
	addChatMessage(`🎯 Analyzing ${neoData.name}`, 'user');
	
	// Process with AI
	processUserMessage(analysisPrompt);
	
	// Focus camera on the selected NEO with Earth in background
	focusOnNEO(neoData.name);
	
	// Visual feedback - highlight the selected object
	highlightSelectedNEO(neoData.name);
	
	// Auto-open AI panel if it's closed
	if (!panelStates.ai) {
		togglePanel('ai');
	}
}

function highlightSelectedNEO(neoName) {
	// Visual feedback disabled - no animation when selecting NEOs
	// Users can see selection in the NEO details panel
}

function showMeteoriteOverlay(neoData) {
	// Remove existing overlay if present
	if (meteoriteOverlay) {
		hideMeteoriteOverlay();
	}
	
	// Store selected meteorite
	selectedMeteorite = neoData;
	
	// Switch to manual camera mode and store previous mode
	if (cameraMode === 'auto') {
		previousCameraMode = 'auto';
		cameraMode = 'manual';
		lastUserInteraction = Date.now();
		updateCameraModeDisplay();
	}
	
	// Position camera above the meteorite
	positionCameraAboveMeteorite(neoData);
	
	// Create overlay HTML
	const overlayHTML = `
		<div class="meteorite-info-card">
			<div class="close-hint">Click outside or move camera to close</div>
			<h2>
				<i data-lucide="target" class="lucide-icon"></i>
				${neoData.name}
			</h2>
			<div class="meteorite-stats">
				<div class="meteorite-stat">
					<span class="stat-label">Diameter</span>
					<div class="stat-value">${neoData.diameter}m</div>
				</div>
				<div class="meteorite-stat">
					<span class="stat-label">Orbit Distance</span>
					<div class="stat-value">${neoData.orbit_distance} AU</div>
				</div>
				<div class="meteorite-stat">
					<span class="stat-label">Mass (Est.)</span>
					<div class="stat-value">${Math.round(neoData.mass).toLocaleString()} tons</div>
				</div>
				<div class="meteorite-stat">
					<span class="stat-label">Impact Energy</span>
					<div class="stat-value">${Math.round(neoData.impact_energy / 1000).toLocaleString()}kt</div>
				</div>
			</div>
			<div class="hazardous-indicator ${neoData.is_hazardous ? 'hazardous' : 'safe'}">
				<i data-lucide="${neoData.is_hazardous ? 'alert-triangle' : 'check-circle'}" class="lucide-icon"></i>
				${neoData.is_hazardous ? 'Potentially Hazardous' : 'Non-Hazardous'}
			</div>
		</div>
	`;
	
	// Create and show overlay
	meteoriteOverlay = document.createElement('div');
	meteoriteOverlay.className = 'meteorite-overlay';
	meteoriteOverlay.innerHTML = overlayHTML;
	
	// Add click handler to close overlay when clicking outside the card
	meteoriteOverlay.addEventListener('click', (event) => {
		if (event.target === meteoriteOverlay) {
			hideMeteoriteOverlay();
		}
	});
	
	document.body.appendChild(meteoriteOverlay);
	
	// Initialize Lucide icons in the new content
	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
}

function hideMeteoriteOverlay() {
	if (meteoriteOverlay) {
		meteoriteOverlay.remove();
		meteoriteOverlay = null;
	}
	selectedMeteorite = null;
	
	// Show all meteorites again
	showAllMeteorites();
	
	// Restore previous camera mode if it was auto
	if (previousCameraMode === 'auto') {
		cameraMode = 'auto';
		isTransitioning = true;
		updateCameraModeDisplay();
		previousCameraMode = null;
	}
}

function positionCameraAboveMeteorite(neoData) {
	if (!neoData.mesh || !neoData.mesh.position) return;
	
	// Hide all other meteorites except the focused one
	focusOnSingleMeteorite(neoData.mesh);
	
	const meteoritePosition = neoData.mesh.position;
	const offset = 15; // Distance above the meteorite
	
	// Calculate position above the meteorite
	const direction = meteoritePosition.clone().normalize();
	const cameraPosition = meteoritePosition.clone().add(direction.multiplyScalar(offset));
	
	// Smoothly move camera to position
	const duration = 1000; // 1 second
	const startPosition = camera.position.clone();
	const startTime = Date.now();
	
	function animateCamera() {
		const elapsed = Date.now() - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
		
		camera.position.lerpVectors(startPosition, cameraPosition, easedProgress);
		
		// Look at the meteorite
		camera.lookAt(meteoritePosition);
		
		if (progress < 1) {
			requestAnimationFrame(animateCamera);
		}
	}
	
	animateCamera();
}

// Hide all meteorites except the focused one
function focusOnSingleMeteorite(targetMesh) {
	if (!meteoriteGroup) return;
	
	meteoriteGroup.children.forEach(child => {
		if (child.userData.name) {
			if (child === targetMesh) {
				// Keep the focused meteorite visible and highlighted
				child.visible = true;
				child.material.opacity = 1.0;
				child.material.transparent = false;
				
				// Add a subtle glow effect
				if (child.material.emissive) {
					child.material.emissive.setHex(0x002244);
				}
			} else {
				// Hide or make other meteorites very transparent
				child.visible = false;
			}
		}
	});
}

// Show all meteorites (restore normal view)
function showAllMeteorites() {
	if (!meteoriteGroup) return;
	
	meteoriteGroup.children.forEach(child => {
		if (child.userData.name) {
			child.visible = true;
			child.material.opacity = 1.0;
			child.material.transparent = false;
			
			// Remove glow effect
			if (child.material.emissive) {
				child.material.emissive.setHex(0x000000);
			}
		}
	});
}

// Apply saved panel state on app load
function applySavedPanelState() {
	const panels = ['info-panel', 'controls-panel', 'neo-panel'];
	
	// Apply overall panel visibility
	panels.forEach(panelId => {
		const panel = document.getElementById(panelId);
		if (panel) {
			if (panelsVisible) {
				panel.style.display = 'block';
				panel.style.opacity = '1';
				panel.style.transform = 'translateY(0)';
			} else {
				panel.style.display = 'none';
				panel.style.opacity = '0';
				panel.style.transform = 'translateY(-20px)';
			}
		}
	});
	
	// Apply individual panel collapsed/expanded states
	Object.keys(panelStates).forEach(panelId => {
		const content = document.getElementById(`${panelId}-content`);
		const icon = document.getElementById(`${panelId}-collapse`);
		const panel = document.getElementById(`${panelId}-panel`);
		
		if (content && icon && panel) {
			if (panelStates[panelId]) {
				content.classList.remove('collapsed');
				icon.classList.remove('rotated');
				panel.classList.remove('collapsed');
			} else {
				content.classList.add('collapsed');
				icon.classList.add('rotated');
				panel.classList.add('collapsed');
			}
		}
	});
}

// Initialize the scene and DOM
function initializeApp() {
	// Initialize Three.js scene
	init();
	
	// Apply saved panel state
	applySavedPanelState();
	
	// Initialize Lucide icons
	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
	
	// Initialize event listeners
	initializeEventListeners();
	
	// Initialize AI features (already done in init() function)
	// initializeSpeechRecognition(); // This is called in initializeAISystem()
	
	console.log('NASA Visualization App initialized successfully');
}

// Initialize event listeners
function initializeEventListeners() {
	console.log('Initializing event listeners...');
	
	// Chat input
	const chatInput = document.getElementById('chat-input');
	if (chatInput) {
		chatInput.addEventListener('keypress', function(e) {
			if (e.key === 'Enter') {
				sendChatMessage();
			}
		});
		console.log('Chat input listener added');
	} else {
		console.warn('Chat input element not found');
	}
	
	const sendBtn = document.getElementById('send-message');
	if (sendBtn) {
		sendBtn.addEventListener('click', sendChatMessage);
		console.log('Send button listener added');
	} else {
		console.warn('Send button element not found');
	}
	
	// Voice button
	const voiceBtn = document.getElementById('voice-toggle');
	if (voiceBtn) {
		voiceBtn.addEventListener('click', toggleVoiceRecognition);
		console.log('Voice button listener added');
	} else {
		console.warn('Voice button element not found');
	}
	
	// Mute button
	const muteBtn = document.getElementById('mute-toggle');
	if (muteBtn) {
		muteBtn.addEventListener('click', toggleMute);
		console.log('Mute button listener added');
	} else {
		console.warn('Mute button element not found');
	}
	
	// Volume control
	const volumeControl = document.getElementById('volume-control');
	if (volumeControl) {
		volumeControl.addEventListener('input', function(e) {
			aiSystem.volume = e.target.value / 100;
			if (aiSystem.currentAudio) {
				aiSystem.currentAudio.volume = aiSystem.volume;
			}
		});
		console.log('Volume control listener added');
	} else {
		console.warn('Volume control element not found');
	}
	
	console.log('Event listeners initialization complete');
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeApp);
} else {
	initializeApp();
}
