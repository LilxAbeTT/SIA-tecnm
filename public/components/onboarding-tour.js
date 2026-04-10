/**
 * SIA Onboarding Tour - Tutorial interactivo paso a paso
 *
 * Para forzar que TODOS los usuarios vean el tutorial de nuevo,
 * solo sube este número (v1 → v2 → v3 …).
 * Cualquier versión anterior quedará ignorada automáticamente.
 */
const SIA_TOUR_VERSION = 'v8';  // ← cambia esto para re-mostrar a todos
window.SIA_TOUR_VERSION = SIA_TOUR_VERSION; // Exported globally for other modules

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
        const isVisible = (selector) => {
            const el = selector ? document.querySelector(selector) : null;
            if (!el) return false;
            if (el.classList?.contains('d-none')) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        this._steps = [
            {
                target: null,
                title: 'Bienvenido a tu dashboard',
                description: 'Esta guia te explica las zonas principales del tablero del estudiante. Al terminar sabras donde revisar pendientes, modulos, eventos, metas y accesos rapidos.',
                position: 'center'
            },
            {
                target: '#dash-avatar-wrapper',
                title: 'Perfil rapido',
                description: 'Toca tu foto o iniciales para abrir accesos rapidos como perfil, credencial digital, restablecer el orden de modulos o cerrar sesion.',
                position: 'bottom'
            },
            {
                target: '#dash-dark-mode-btn',
                title: 'Modo oscuro',
                description: 'Usa este boton para alternar entre vista clara y oscura sin salir del dashboard.',
                position: 'bottom'
            },
            {
                target: '#dash-qr-btn',
                title: 'Credencial digital',
                description: 'Aqui abres tu QR institucional para identificarte y usar funciones que dependen de tu credencial digital.',
                position: 'bottom'
            },
            {
                target: '#btn-replay-tutorial',
                title: 'Volver a ver la guia',
                description: 'Si mas adelante quieres repasar el dashboard, usa este boton y el tutorial se reiniciara.',
                position: 'bottom'
            },
            {
                target: '#dashboard-stories-wrapper',
                title: 'Novedades',
                description: 'Aqui aparecen avisos, lanzamientos, eventos o contenidos destacados. Desliza horizontalmente y toca cualquier historia para abrir su detalle.',
                position: 'bottom'
            },
            {
                target: '#dash-activity-section',
                title: 'Tu semana',
                description: 'Resume tu actividad semanal para darte contexto rapido. Te ayuda a ubicar dias con carga, movimientos o asuntos por revisar.',
                position: 'bottom'
            },
            {
                target: '#dash-task-center-section',
                title: 'Centro de tareas',
                description: 'Esta lista concentra lo mas importante por atender. Combina pendientes de Medi, Aula, Biblioteca, Eventos, Encuestas y otros modulos en un solo lugar.',
                position: 'top'
            },
            {
                target: '.dash-scope-group',
                title: 'Filtro por horizonte',
                description: 'Cambia entre Hoy, Semana y Todo para decidir si quieres ver solo lo urgente o un panorama mas amplio del dashboard.',
                position: 'bottom',
                condition: () => isVisible('.dash-scope-group')
            },
            {
                target: '.sia-modules-grid',
                title: 'Tus modulos',
                description: 'Estas tarjetas son la puerta de entrada a cada servicio. En movil puedes mantener presionada una tarjeta y moverla para dejar primero las que mas usas.',
                position: 'top'
            },
            {
                target: '#smart-card-medi',
                title: 'Servicios medicos',
                description: 'Aqui entras a tus citas, seguimiento medico o psicologico y funciones rapidas de salud.',
                position: 'bottom',
                condition: () => isVisible('#smart-card-medi')
            },
            {
                target: '#smart-card-biblio',
                title: 'Biblioteca',
                description: 'Desde esta tarjeta revisas prestamos, devoluciones, reservas y alertas relacionadas con biblioteca.',
                position: 'bottom',
                condition: () => isVisible('#smart-card-biblio')
            },
            {
                target: '#smart-card-aula',
                title: 'Aula',
                description: 'Te lleva a clases, tareas, comunidad y avance academico. Si algo requiere atencion, normalmente aparecera reflejado aqui y en el centro de tareas.',
                position: 'top',
                condition: () => isVisible('#smart-card-aula')
            },
            {
                target: '#smart-card-foro',
                title: 'Eventos',
                description: 'Aqui accedes a convocatorias, talleres, conferencias y actividades del campus.',
                position: 'top',
                condition: () => isVisible('#smart-card-foro')
            },
            {
                target: '#dash-events-section',
                title: 'Proximos eventos',
                description: 'Cuando existan eventos relevantes, esta franja te mostrara los mas cercanos para abrirlos, seguirlos o exportarlos a tu calendario.',
                position: 'top',
                condition: () => isVisible('#dash-events-section')
            },
            {
                target: '#smart-card-quejas',
                title: 'Quejas y sugerencias',
                description: 'Usa este modulo para registrar casos y dar seguimiento a respuestas, estados y atencion de calidad.',
                position: 'top',
                condition: () => isVisible('#smart-card-quejas')
            },
            {
                target: '#smart-card-encuestas',
                title: 'Encuestas',
                description: 'Aqui respondes encuestas activas del campus. Si hay participaciones pendientes, el dashboard suele marcarlas como prioridad.',
                position: 'top',
                condition: () => isVisible('#smart-card-encuestas')
            },
            {
                target: '#smart-card-cafeteria',
                title: 'Cafeteria',
                description: 'Si este servicio esta disponible para tu perfil, desde aqui puedes consultar menu, pedidos o estado de cafeteria.',
                position: 'top',
                condition: () => isVisible('#smart-card-cafeteria')
            },
            {
                target: '#smart-card-lactario-wrapper',
                title: 'Sala de lactancia',
                description: 'Si este servicio aplica para tu perfil, aqui podras revisar espacios, reservas y disponibilidad.',
                position: 'top',
                condition: () => isVisible('#smart-card-lactario-wrapper')
            },
            {
                target: '#dash-scorecard-section',
                title: 'Mi avance academico',
                description: 'Resume cursos inscritos, tareas por atender, certificados, riesgo y tendencia. Toca la cabecera para expandir o contraer el detalle.',
                position: 'top',
                condition: () => isVisible('#dash-scorecard-section')
            },
            {
                target: '#dash-goals-section',
                title: 'Metas y recordatorios',
                description: 'Este panel te sirve para llevar objetivos manuales del semestre y recordatorios con fecha. Usa Gestionar para editarlos sin salir del dashboard.',
                position: 'top',
                condition: () => isVisible('#dash-goals-section')
            },
            {
                target: '.sia-summary-banner',
                title: 'Resumen de hoy',
                description: 'Concentra el estado general del dia y destaca la accion mas urgente. Si aparece un boton, te lleva directo al pendiente principal.',
                position: 'top'
            },
            {
                target: '#dash-history-section',
                title: 'Actividad reciente',
                description: 'Te ayuda a retomar contexto mostrando tus ultimos movimientos relevantes dentro del ecosistema SIA.',
                position: 'top'
            },
            {
                target: '#dash-tip-section',
                title: 'Tip contextual',
                description: 'Aqui aparecen recomendaciones utiles segun tu estado actual. Cuando exista una accion clara, tambien veras un acceso directo para resolverla.',
                position: 'top'
            },
            {
                target: '#dash-sos-fab',
                title: 'SOS de emergencia',
                description: 'Este boton flotante abre tu panel rapido de emergencia con datos clinicos clave y accesos para pedir ayuda.',
                position: 'left',
                condition: () => isVisible('#dash-sos-fab')
            },
            {
                target: null,
                title: 'Listo para usar SIA',
                description: 'Ya conoces las zonas principales del dashboard. Puedes volver a esta guia en cualquier momento desde el boton Tutorial.',
                position: 'center'
            }
        ];
    }

    // ── API Publica ──────────────────────────────────────────────────

    start() {
        if (this._isActive) return;
        this._isActive = true;
        window.SIA_TOUR_ACTIVE = true;
        this._currentStep = 0;
        this._buildOverlay();
        document.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('resize', this._handleResize);
        this._showStep(0);
    }

    stop() {
        if (!this._isActive) return;
        this._isActive = false;
        window.SIA_TOUR_ACTIVE = false;
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
        window.addEventListener('wheel', this._scrollBlocker, { passive: false });
        window.addEventListener('touchmove', this._scrollBlocker, { passive: false });
    }

    _unblockScroll() {
        if (!this._scrollBlocker) return;
        window.removeEventListener('wheel', this._scrollBlocker);
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
                    // 6. Primero renderizar contenido para poder calcular alturas
                    this._renderTooltipContent(step, index);

                    requestAnimationFrame(() => {
                        // 7. Posicionar spotlight y tooltip con dimensiones reales (coordenadas viewport)
                        this._positionSpotlight(targetEl);
                        this._positionTooltip(targetEl, step.position);

                        this._spotlight.classList.add('sia-tour-spotlight--visible');
                        this._tooltip.classList.remove('sia-tour-tooltip--transitioning');
                        this._tooltip.classList.add('sia-tour-tooltip--visible');

                        // 8. Volver a bloquear scroll
                        this._blockScroll();
                    });

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

    _skip() { this._markCompleted(); this.stop(); }
    _complete() { this._markCompleted(); this.stop(); }

    async _markCompleted() {
        try {
            const uid = window.Store?.userProfile?.uid
                || window.SIA?.currentUserProfile?.uid;

            if (uid && window.SIA?.updateUserPreferences) {
                await window.SIA.updateUserPreferences(uid, {
                    [`tour_${SIA_TOUR_VERSION}`]: true
                });
                localStorage.setItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`, 'true');
            } else if (uid) {
                localStorage.setItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`, 'true');
            }
        } catch (e) {
            console.warn("Could not save tour completion to DB", e);
            try {
                const uid = window.Store?.userProfile?.uid
                    || window.SIA?.currentUserProfile?.uid
                    || 'unknown';
                localStorage.setItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`, 'true');
            } catch (e2) { }
        }
    }

    // ── Posicionamiento (coordenadas de VIEWPORT — overlay es position:fixed) ──

    _positionSpotlight(el) {
        const rect = el.getBoundingClientRect();
        const pad = 8;
        // SIN window.scrollY — el overlay es fixed, todo es relativo al viewport
        this._spotlight.style.top = `${rect.top - pad}px`;
        this._spotlight.style.left = `${rect.left - pad}px`;
        this._spotlight.style.width = `${rect.width + pad * 2}px`;
        this._spotlight.style.height = `${rect.height + pad * 2}px`;
        this._spotlight.style.opacity = '';
    }

    _positionTooltip(el, position) {
        const rect = el.getBoundingClientRect();
        const tooltipW = Math.min(320, window.innerWidth - 32);
        this._tooltip.style.width = `${tooltipW}px`;
        this._tooltip.style.transform = '';
        this._tooltip.style.top = '';
        this._tooltip.style.left = '';

        let top, left;
        // Altura real con el texto renderizado o una por defecto si falla
        const tH = this._tooltip.offsetHeight || 220;

        // Zonas seguras para barras de moviles
        const headerH = 75;
        const bottomNavH = 85;

        if (position === 'bottom') {
            top = rect.bottom + 14;
            left = rect.left + rect.width / 2 - tooltipW / 2;
        } else if (position === 'top') {
            top = rect.top - tH - 14;
            left = rect.left + rect.width / 2 - tooltipW / 2;
        } else if (position === 'left') {
            top = rect.top + rect.height / 2 - tH / 2;
            left = rect.left - tooltipW - 14;
        } else { // right
            top = rect.top + rect.height / 2 - tH / 2;
            left = rect.right + 14;
        }

        // Si el tooltip se sale arriba (por encima del header)
        if (top < headerH) {
            top = rect.bottom + 14;
        }
        // Si se sale abajo (se oculta en fondo debajo del navbar de abajo)
        if (top + tH > window.innerHeight - bottomNavH) {
            top = rect.top - tH - 14;

            // Si al obligarlo a subir se sale del header, centrar forzosamente sobre el target
            if (top < headerH) {
                top = rect.top + (rect.height / 2) - (tH / 2);
            }
        }

        // Clamp horizontal
        left = Math.max(16, Math.min(left, window.innerWidth - tooltipW - 16));
        // Clamp vertical
        top = Math.max(headerH, Math.min(top, window.innerHeight - tH - bottomNavH));

        this._tooltip.style.top = `${top}px`;
        this._tooltip.style.left = `${left}px`;

        // Ajuste defensivo para asegurar contenido scrollable interno
        this._tooltip.style.maxHeight = `calc(100vh - ${headerH + bottomNavH + 20}px)`;
        this._tooltip.style.overflowY = 'auto';
    }

    _positionTooltipCenter() {
        const tooltipW = Math.min(340, window.innerWidth - 32);
        this._tooltip.style.width = `${tooltipW}px`;
        this._tooltip.style.top = '50%';
        this._tooltip.style.left = '50%';
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
        const total = this._getVisibleStepCount();
        const visibleIndex = this._getVisibleIndex(index);
        const isFirst = (visibleIndex === 0);
        const isLast = this._getNextVisibleIndex(index) >= this._steps.length;
        const pct = ((visibleIndex + 1) / total) * 100;

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
        else if (e.key === 'Escape') { e.preventDefault(); this._skip(); }
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
            const profile = window.Store?.userProfile || window.SIA?.currentUserProfile;
            if (!profile || !profile.uid) return false;

            // Solo mostrar a estudiantes o usuarios sin rol definido (por precaucion)
            if (profile.role && profile.role !== 'student') return false;

            return !localStorage.getItem(`sia_tutorial_done_${window.SIA_TOUR_VERSION}_${profile.uid}`);
        } catch (e) { return false; }
    }

    static async resetForUser() {
        try {
            const uid = window.Store?.userProfile?.uid
                || window.SIA?.currentUserProfile?.uid;
            if (uid) {
                localStorage.removeItem(`sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`);
                if (window.SIA?.updateUserPreferences) {
                    await window.SIA.updateUserPreferences(uid, {
                        [`tour_${SIA_TOUR_VERSION}`]: false
                    });
                }
            }
        } catch (e) { console.warn("Could not reset DB tour status", e); }
    }
}

if (!customElements.get('sia-onboarding-tour')) {
    customElements.define('sia-onboarding-tour', SiaOnboardingTour);
    window.SiaOnboardingTour = SiaOnboardingTour; // Exposed globally 
}
