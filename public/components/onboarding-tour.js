/**
 * SIA Onboarding Tour - Tutorial interactivo paso a paso
 *
 * Para forzar que TODOS los usuarios vean el tutorial de nuevo,
 * solo sube este número (v1 → v2 → v3 …).
 * Cualquier versión anterior quedará ignorada automáticamente.
 */
const SIA_TOUR_VERSION = 'v2';  // ← cambia esto para re-mostrar a todos

class SiaOnboardingTour extends HTMLElement {
    constructor() {
        super();
        this._currentStep = 0;
        this._steps = [];
        this._isActive = false;
        this._overlay = null;
        this._spotlight = null;
        this._tooltip = null;
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleResize = this._debounce(this._repositionCurrent.bind(this), 150);
        // Bloqueador de scroll (wheel + touchmove)
        this._scrollBlocker = null;
    }

    connectedCallback() {
        this._defineSteps();
    }

    disconnectedCallback() {
        this.stop();
    }

    // ── Definicion de pasos ──────────────────────────────────────────

    _defineSteps() {
        this._steps = [
            // Paso 0: Bienvenida (centro, sin target)
            {
                target: null,
                title: 'Bienvenido al SIA',
                description: 'Este es tu Sistema Integral de Alumnos. Aqui puedes acceder a todos los servicios del TecNM Los Cabos desde un solo lugar. Te mostraremos como funciona en unos pasos.',
                position: 'center'
            },
            // Paso 1: Header / saludo
            {
                target: '.sia-dash-header',
                title: 'Tu espacio personal',
                description: 'Aqui veras tu nombre y el saludo cambia segun la hora del dia. Toca tu foto o iniciales para ir a tu perfil.',
                position: 'bottom'
            },
            // Paso 2: Boton QR
            {
                target: '#dash-qr-btn',
                title: 'Tu ID Digital',
                description: 'Con un solo toque abres tu credencial digital con codigo QR. Usala para prestamos de libros, acceso a areas del campus y mas. Sin necesidad de credencial fisica.',
                position: 'bottom'
            },
            // Paso 3: Boton Tutorial
            {
                target: '#btn-replay-tutorial',
                title: 'Ver Tutorial',
                description: 'Puedes volver a ver este tutorial en cualquier momento tocando este boton.',
                position: 'bottom'
            },
            // Paso 4: Avisos / Stories
            {
                target: '#dashboard-stories-wrapper',
                title: 'Avisos y Novedades',
                description: 'Desliza para ver los avisos del campus. Los circulos con borde de color son avisos nuevos que aun no has leido. Toca uno para ver el detalle completo.',
                position: 'bottom'
            },
            // Paso 5: Grid de modulos (vista general)
            {
                target: '.sia-modules-grid',
                title: 'Tus Modulos',
                description: 'Estos son los servicios disponibles para ti. Cada tarjeta te lleva a un modulo diferente. Si ves un numero o punto de color, significa que hay algo pendiente.',
                position: 'top'
            },
            // Paso 6: Medi
            {
                target: '#smart-card-medi',
                title: 'Servicios Médicos',
                description: 'Solicita citas medicas, consulta tu historial clinico y accede al chat medico para dudas rapidas. El punto rojo indica citas pendientes.',
                position: 'bottom'
            },
            // Paso 7: Biblio
            {
                target: '#smart-card-biblio',
                title: 'Biblioteca Digital',
                description: 'Busca y reserva libros del acervo, gestiona tus prestamos activos y consulta el catalogo digital. El indicador amarillo avisa si tienes un libro por vencer.',
                position: 'bottom'
            },
            // Paso 8: Aula
            {
                target: '#smart-card-aula',
                title: 'Aula Virtual',
                description: 'Accede a tus cursos en linea, consulta materiales de clase, entrega tareas y revisa tus calificaciones.',
                position: 'bottom'
            },
            // Paso 9: Foro
            {
                target: '#smart-card-foro',
                title: 'Foro y Eventos',
                description: 'Enterate de conferencias, talleres, torneos y actividades del campus. Puedes inscribirte a eventos directamente desde aqui.',
                position: 'top'
            },
            // Paso 10: Quejas
            {
                target: '#smart-card-quejas',
                title: 'Quejas y Sugerencias',
                description: 'Envia quejas formales o sugerencias de mejora de forma confidencial. Puedes dar seguimiento al estatus de cada reporte que hayas enviado.',
                position: 'top'
            },
            // Paso 11: Encuestas
            {
                target: '#smart-card-encuestas',
                title: 'Encuestas',
                description: 'Responde encuestas de evaluacion docente y satisfaccion de servicios. Tu opinion ayuda a mejorar el campus.',
                position: 'top'
            },
            // Paso 12: Lactario (condicional)
            {
                target: '#smart-card-lactario-wrapper',
                title: 'Lactario',
                description: 'Reserva espacios en la sala de lactancia del campus y gestiona tus reservaciones.',
                position: 'top',
                condition: () => {
                    const el = document.getElementById('smart-card-lactario-wrapper');
                    return el && !el.classList.contains('d-none');
                }
            },
            // Paso 13: Banner de ayuda
            {
                target: '.sia-help-banner',
                title: 'Ayuda y Soporte',
                description: 'Si necesitas asistencia, aqui encontraras accesos directos a soporte tecnico y al buzon de quejas del campus.',
                position: 'top'
            },
            // Paso 14: Fin
            {
                target: null,
                title: '¡Listo! Ya conoces tu SIA',
                description: 'Ya puedes explorar libremente todos los servicios. Si quieres volver a ver este tutorial, usa el boton "Tutorial" en tu dashboard. ¡Bienvenido al TecNM!',
                position: 'center'
            }
        ];
    }

    // ── API Publica ──────────────────────────────────────────────────

    start() {
        if (this._isActive) return;
        this._isActive = true;
        this._currentStep = 0;
        this._buildOverlay();
        document.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('resize', this._handleResize);
        this._showStep(0);
    }

    stop() {
        if (!this._isActive) return;
        this._isActive = false;
        document.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('resize', this._handleResize);
        this._unblockScroll();
        this._removeOverlay();
    }

    // ── Construccion del DOM ─────────────────────────────────────────

    _buildOverlay() {
        this._overlay = document.createElement('div');
        this._overlay.className = 'sia-tour-overlay';

        this._spotlight = document.createElement('div');
        this._spotlight.className = 'sia-tour-spotlight';

        this._tooltip = document.createElement('div');
        this._tooltip.className = 'sia-tour-tooltip';

        this._overlay.appendChild(this._spotlight);
        this._overlay.appendChild(this._tooltip);
        document.body.appendChild(this._overlay);

        requestAnimationFrame(() => {
            this._overlay.classList.add('sia-tour-overlay--visible');
        });
    }

    _removeOverlay() {
        if (!this._overlay) return;
        this._overlay.classList.remove('sia-tour-overlay--visible');
        this._overlay.classList.add('sia-tour-overlay--exiting');
        setTimeout(() => {
            this._overlay?.remove();
            this._overlay = null;
            this._spotlight = null;
            this._tooltip = null;
        }, 350);
    }

    // ── Bloqueo de scroll ────────────────────────────────────────────

    _blockScroll() {
        if (this._scrollBlocker) return; // ya bloqueado
        this._scrollBlocker = (e) => e.preventDefault();
        window.addEventListener('wheel',      this._scrollBlocker, { passive: false });
        window.addEventListener('touchmove',  this._scrollBlocker, { passive: false });
    }

    _unblockScroll() {
        if (!this._scrollBlocker) return;
        window.removeEventListener('wheel',     this._scrollBlocker);
        window.removeEventListener('touchmove', this._scrollBlocker);
        this._scrollBlocker = null;
    }

    // ── Navegacion de pasos ──────────────────────────────────────────

    _showStep(index) {
        // Saltar pasos condicionales
        while (index >= 0 && index < this._steps.length) {
            const step = this._steps[index];
            if (step.condition && !step.condition()) { index++; continue; }
            break;
        }

        if (index >= this._steps.length) { this._complete(); return; }
        if (index < 0) index = 0;

        this._currentStep = index;
        const step = this._steps[index];

        // Resolver target dinamico
        let targetSelector = step.target;
        if (step.getDynamicTarget) targetSelector = step.getDynamicTarget();
        const targetEl = targetSelector ? document.querySelector(targetSelector) : null;

        // 1. Fade out tooltip actual
        this._tooltip.classList.remove('sia-tour-tooltip--visible');
        this._tooltip.classList.add('sia-tour-tooltip--transitioning');

        // 2. Determinar si es paso central (bienvenida/fin) o con target
        if (!targetEl) {
            // ── Paso central ──
            // El overlay tiene fondo propio; no usar spotlight
            this._overlay.classList.add('sia-tour-overlay--center');
            this._spotlight.classList.remove('sia-tour-spotlight--visible');
            this._spotlight.style.cssText = 'opacity:0;';

            setTimeout(() => {
                this._blockScroll();
                this._positionTooltipCenter();
                this._renderTooltipContent(step, index);
                this._tooltip.classList.remove('sia-tour-tooltip--transitioning');
                this._tooltip.classList.add('sia-tour-tooltip--visible');
            }, 220);

        } else {
            // ── Paso con target ──
            this._overlay.classList.remove('sia-tour-overlay--center');

            // 3. Desbloquear scroll para poder hacer scrollIntoView
            this._unblockScroll();

            setTimeout(() => {
                // 4. Scroll instantaneo al elemento
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // 5. Esperar que el scroll termine y luego posicionar
                setTimeout(() => {
                    // 6. Posicionar spotlight y tooltip (coordenadas viewport, sin scrollY)
                    this._positionSpotlight(targetEl);
                    this._positionTooltip(targetEl, step.position);
                    this._spotlight.classList.add('sia-tour-spotlight--visible');

                    this._renderTooltipContent(step, index);
                    this._tooltip.classList.remove('sia-tour-tooltip--transitioning');
                    this._tooltip.classList.add('sia-tour-tooltip--visible');

                    // 7. Volver a bloquear scroll
                    this._blockScroll();

                }, 500); // tiempo para scroll suave
            }, 220);
        }
    }

    _next() { this._showStep(this._currentStep + 1); }

    _prev() {
        let idx = this._currentStep - 1;
        while (idx >= 0) {
            const s = this._steps[idx];
            if (s.condition && !s.condition()) { idx--; continue; }
            break;
        }
        this._showStep(Math.max(0, idx));
    }

    _skip()     { this._markCompleted(); this.stop(); }
    _complete() { this._markCompleted(); this.stop(); }

    _markCompleted() {
        try {
            const uid = window.Store?.userProfile?.uid
                     || window.SIA?.currentUserProfile?.uid
                     || 'unknown';
            localStorage.setItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`, 'true');
        } catch (e) { /* ignore */ }
    }

    // ── Posicionamiento (coordenadas de VIEWPORT — overlay es position:fixed) ──

    _positionSpotlight(el) {
        const rect = el.getBoundingClientRect();
        const pad  = 8;
        // SIN window.scrollY — el overlay es fixed, todo es relativo al viewport
        this._spotlight.style.top    = `${rect.top  - pad}px`;
        this._spotlight.style.left   = `${rect.left - pad}px`;
        this._spotlight.style.width  = `${rect.width  + pad * 2}px`;
        this._spotlight.style.height = `${rect.height + pad * 2}px`;
        this._spotlight.style.opacity = '';
    }

    _positionTooltip(el, position) {
        const rect     = el.getBoundingClientRect();
        const tooltipW = Math.min(320, window.innerWidth - 32);
        this._tooltip.style.width     = `${tooltipW}px`;
        this._tooltip.style.transform = '';
        this._tooltip.style.top       = '';
        this._tooltip.style.left      = '';

        let top, left;
        const tH = 200; // altura estimada del tooltip

        if (position === 'bottom') {
            top  = rect.bottom + 14;
            left = rect.left + rect.width / 2 - tooltipW / 2;
        } else if (position === 'top') {
            top  = rect.top - tH - 14;
            left = rect.left + rect.width / 2 - tooltipW / 2;
        } else if (position === 'left') {
            top  = rect.top + rect.height / 2 - tH / 2;
            left = rect.left - tooltipW - 14;
        } else { // right
            top  = rect.top + rect.height / 2 - tH / 2;
            left = rect.right + 14;
        }

        // Si el tooltip se sale arriba, ponerlo abajo
        if (top < 10) {
            top = rect.bottom + 14;
        }
        // Si se sale abajo, ponerlo arriba del todo
        if (top + tH > window.innerHeight - 10) {
            top = rect.top - tH - 14;
        }
        // Clamp horizontal
        left = Math.max(16, Math.min(left, window.innerWidth - tooltipW - 16));
        // Clamp vertical
        top  = Math.max(10, top);

        this._tooltip.style.top  = `${top}px`;
        this._tooltip.style.left = `${left}px`;
    }

    _positionTooltipCenter() {
        const tooltipW = Math.min(340, window.innerWidth - 32);
        this._tooltip.style.width     = `${tooltipW}px`;
        this._tooltip.style.top       = '50%';
        this._tooltip.style.left      = '50%';
        this._tooltip.style.transform = 'translate(-50%, -50%)';
    }

    _repositionCurrent() {
        if (!this._isActive) return;
        const step = this._steps[this._currentStep];
        if (!step) return;
        let sel = step.target;
        if (step.getDynamicTarget) sel = step.getDynamicTarget();
        const el = sel ? document.querySelector(sel) : null;
        if (el) {
            this._positionSpotlight(el);
            this._positionTooltip(el, step.position);
        } else {
            this._positionTooltipCenter();
        }
    }

    // ── Render del tooltip ───────────────────────────────────────────

    _renderTooltipContent(step, index) {
        const total        = this._getVisibleStepCount();
        const visibleIndex = this._getVisibleIndex(index);
        const isFirst      = (visibleIndex === 0);
        const isLast       = this._getNextVisibleIndex(index) >= this._steps.length;
        const pct          = ((visibleIndex + 1) / total) * 100;

        this._tooltip.innerHTML = `
            <div class="tour-progress">
                <span class="tour-step-label">Paso ${visibleIndex + 1} de ${total}</span>
                <div class="tour-progress-bar">
                    <div class="tour-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
            <h6 class="tour-title">${step.title}</h6>
            <p class="tour-desc">${step.description}</p>
            <div class="tour-actions">
                <button class="tour-btn-skip" data-action="skip">Omitir tutorial</button>
                <div class="tour-actions-nav">
                    ${!isFirst ? '<button class="tour-btn-prev" data-action="prev"><i class="bi bi-arrow-left"></i> Anterior</button>' : ''}
                    <button class="tour-btn-next" data-action="next">
                        ${isLast ? 'Finalizar' : 'Siguiente <i class="bi bi-arrow-right"></i>'}
                    </button>
                </div>
            </div>
        `;

        this._tooltip.querySelector('[data-action="next"]')?.addEventListener('click', () => {
            if (isLast) this._complete(); else this._next();
        });
        this._tooltip.querySelector('[data-action="prev"]')?.addEventListener('click', () => this._prev());
        this._tooltip.querySelector('[data-action="skip"]')?.addEventListener('click', () => this._skip());
    }

    // ── Keyboard ─────────────────────────────────────────────────────

    _handleKeyDown(e) {
        if (!this._isActive) return;
        if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this._next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this._prev(); }
        else if (e.key === 'Escape')    { e.preventDefault(); this._skip(); }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    _getVisibleStepCount() {
        return this._steps.filter(s => !s.condition || s.condition()).length;
    }

    _getVisibleIndex(idx) {
        let count = 0;
        for (let i = 0; i < idx; i++) {
            if (!this._steps[i].condition || this._steps[i].condition()) count++;
        }
        return count;
    }

    _getNextVisibleIndex(idx) {
        let next = idx + 1;
        while (next < this._steps.length) {
            if (!this._steps[next].condition || this._steps[next].condition()) return next;
            next++;
        }
        return this._steps.length;
    }

    _debounce(fn, ms) {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }

    // ── Estado del tutorial ──────────────────────────────────────────

    static shouldShow() {
        try {
            const uid = window.Store?.userProfile?.uid
                     || window.SIA?.currentUserProfile?.uid;
            if (!uid) return false;
            return !localStorage.getItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`);
        } catch (e) { return false; }
    }

    static resetForUser() {
        try {
            const uid = window.Store?.userProfile?.uid
                     || window.SIA?.currentUserProfile?.uid;
            if (uid) localStorage.removeItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`);
        } catch (e) { /* ignore */ }
    }
}

if (!customElements.get('sia-onboarding-tour')) {
    customElements.define('sia-onboarding-tour', SiaOnboardingTour);
}
