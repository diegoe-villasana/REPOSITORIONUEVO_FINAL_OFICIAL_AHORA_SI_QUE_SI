document.addEventListener('DOMContentLoaded', function() {
    const carouselSlide = document.querySelector('.carousel-slide');
    if (carouselSlide) {
        const images = document.querySelectorAll('.carousel-slide img');
        if (images.length === 0) return;

        let counter = 0;
        const numImages = images.length;
        
        function slide() {
            counter++;
            if (counter >= numImages) {
                counter = 0;
            }
            const offset = -counter * (100 / numImages);
            carouselSlide.style.transform = `translateX(${offset}%)`;
        }

        // Ajustar el ancho del slide dinámicamente
        carouselSlide.style.width = `${numImages * 100}%`;
        images.forEach(img => {
            img.style.width = `${100 / numImages}%`;
        });

        setInterval(slide, 4000); // Cambia la imagen cada 4 segundos
    }
    
    // --- Collapsible panels (panel-header toggles next .panel-content) ---
    const panelHeaders = document.querySelectorAll('.panel-header');
    panelHeaders.forEach(headerEl => {
        // make header focusable for keyboard
        headerEl.setAttribute('tabindex', '0');

        function toggle(e) {
            // find the nearest panel-content sibling
            const content = headerEl.nextElementSibling;
            if (!content) return;
            const collapseIcon = headerEl.querySelector('.collapse-icon');
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                if (collapseIcon) collapseIcon.classList.remove('rotated');
            } else {
                content.classList.add('collapsed');
                if (collapseIcon) collapseIcon.classList.add('rotated');
            }
        }

        headerEl.addEventListener('click', toggle);
        headerEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });

    // --- Ensure floating panels don't overlap the header ---
    const infoPanel = document.getElementById('info-panel');
    const controlsPanel = document.getElementById('controls-panel');

    function updatePanelPositions() {
        const headerEl = document.querySelector('header');
        const headerRect = headerEl ? headerEl.getBoundingClientRect() : { height: 0 };
        const topOffset = Math.max(headerRect.height, 56) + 12; // fallback
        if (infoPanel) infoPanel.style.top = `${topOffset}px`;
        if (controlsPanel) controlsPanel.style.top = `${topOffset}px`;
    }

    // update on load, resize and when header visibility changes
    window.addEventListener('resize', updatePanelPositions);
    const obs = new MutationObserver(updatePanelPositions);
    const headerNode = document.querySelector('header');
    if (headerNode) obs.observe(headerNode, { attributes: true, attributeFilter: ['class', 'style'] });
    // initial position
    updatePanelPositions();

    // --- Header auto-hide / show behaviour ---
    const header = document.querySelector('header');
    if (header) {
        let hideTimeout = null;
        const HIDE_DELAY = 1200; // ms after leaving top before hiding
        const SHOW_ZONE = 60; // px from top where header will reappear on mousemove

        // Helper to hide header
        function hideHeader() {
            if (!header.classList.contains('hidden')) {
                header.classList.add('hidden');
            }
        }

        // Helper to show header
        function showHeader() {
            if (header.classList.contains('hidden')) {
                header.classList.remove('hidden');
            }
        }

        // Throttle helper
        function throttle(fn, wait) {
            let last = 0;
            return function(...args) {
                const now = Date.now();
                if (now - last >= wait) {
                    last = now;
                    fn.apply(this, args);
                }
            };
        }

        // When mouse moves near the top, show header immediately (throttled)
        const onMouseMove = throttle((e) => {
            if (e.clientY <= SHOW_ZONE) {
                showHeader();
                if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
            } else {
                // If mouse leaves top area, schedule hiding
                if (!hideTimeout) {
                    hideTimeout = setTimeout(hideHeader, HIDE_DELAY);
                }
            }
        }, 50);
        document.addEventListener('mousemove', onMouseMove);

        // Also show header when scrolling up; hide when scrolling down after delay
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const currentY = window.scrollY;
            if (currentY < 10) {
                // near top of page - always show
                showHeader();
            } else if (currentY < lastScrollY) {
                // scrolling up
                showHeader();
            } else if (currentY > lastScrollY) {
                // scrolling down - schedule hide
                if (!hideTimeout) hideTimeout = setTimeout(hideHeader, 600);
            }
            lastScrollY = currentY;
        }, { passive: true });

        // Initially hide header after a short delay so users see content
        setTimeout(() => {
            hideHeader();
        }, 1500);
    }

    // --- Prevent opening heavy globe on low-end devices without consent ---
    (function preventHeavyGlobeOnLowEnd() {
        const openGlobeBtn = document.getElementById('open-globe');
        if (!openGlobeBtn) return;
        function isLowEndDevice() {
            const ua = navigator.userAgent || '';
            const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
            const mem = navigator.deviceMemory || 0;
            return isMobile || (mem > 0 && mem < 2);
        }

        openGlobeBtn.addEventListener('click', (e) => {
            // if device is low-end and user hasn't allowed heavy assets, ask for confirmation
            try {
                const allowHeavy = sessionStorage.getItem('allowHeavyGlobe');
                if (!allowHeavy && isLowEndDevice()) {
                    e.preventDefault();
                    const ok = confirm('Tu dispositivo parece móvil o de baja memoria. ¿Deseas cargar el Globo 3D (puede consumir datos y batería)? Pulsa Aceptar para cargar.');
                    if (ok) sessionStorage.setItem('allowHeavyGlobe', '1');
                    // simulate click again so globe.js open handler runs
                    if (ok) openGlobeBtn.click();
                }
            } catch (err) {
                // ignore storage errors and allow normal behaviour
            }
        });
    })();
});