/**
 * Componente: AdminMediTour
 * Propósito: Tutorial interactivo y exploratorio para el panel de Administrador Médico.
 * Permite tomar un tour guiado o explorar funciones específicas con plantillas visuales.
 */
const ADMIN_TOUR_VERSION = 'v1';

class AdminMediTour extends HTMLElement {
    constructor() {
        super();
        this._isActive = false;
        this._currentStep = 0;
        this._steps = [];
        this._topics = [];
        this._spotlight = null;
        this._tooltip = null;

        // Binds
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleResize = this._handleResize.bind(this);
    }

    connectedCallback() {
        this._defineSteps();
        this._defineTopics();
        this._renderBase();
        // overlay elements are created dynamically on startTour, appended to body
    }

    disconnectedCallback() {
        this.stopTour();
    }

    _defineSteps() {
        this._steps = [
            {
                target: null,
                title: 'Panel Médico Universitario',
                description: 'Bienvenido al panel de control para personal médico y psicológico. Aquí gestionarás tus consultas, agendas y el historial clínico de los estudiantes.',
                position: 'center'
            },
            {
                target: '#medi-pro-name',
                title: 'Tu Perfil',
                description: 'Aquí verás tu nombre y rol actual. Si eres psicólogo(a), asegúrate de haber seleccionado el perfil correcto al ingresar.',
                position: 'bottom'
            },
            {
                target: '.row.g-3.mb-4.row-cols-2',
                title: 'Acciones Principales',
                description: 'Estas tarjetas te dan acceso rápido a las funciones más utilizadas. Tócalas o presiona los botones para comenzar un flujo (Consulta, Agenda, etc.)',
                position: 'bottom'
            },
            {
                target: null,
                getDynamicTarget: () => {
                    const el = document.getElementById('stat-atendidos');
                    return el ? el.closest('.row') : null;
                },
                title: 'Estadísticas del Día',
                description: 'Cuatro tarjetas en tiempo real: <strong>Atendidos</strong> (consultas completadas hoy), <strong>En Espera</strong> (pacientes con QR activo), <strong>Agenda</strong> (citas programadas) y <strong>Seguimientos</strong> pendientes. Se actualizan automáticamente cada 15 segundos.',
                position: 'bottom'
            },
            {
                target: '#medi-agenda-list',
                title: 'Agenda del Día',
                description: 'Lista rápida de tus próximas citas e interacciones agendadas. Se actualiza dinámicamente según la disponibilidad.',
                position: 'top'
            },
            {
                target: '#medi-recent-list',
                title: 'Actividad Reciente',
                description: 'Historial de los últimos pacientes que has atendido o consultas registradas preventivamente.',
                position: 'top'
            },
            {
                target: null,
                title: '¡Todo listo!',
                description: 'Puedes repetir este tour guiado o buscar información detallada sobre procesos específicos desde el menú "Explorar por Tema".',
                position: 'center'
            }
        ];
    }

    _defineTopics() {
        this._topics = [
            {
                id: 'consulta',
                icon: 'bi-clipboard-pulse',
                color: 'success',
                title: 'Consulta Rápida',
                subtitle: 'Ingreso directo mediante matrícula',
                description: 'Permite buscar a un estudiante mediante su N° de Control (Matrícula) para registrar una visita espontánea o consulta general (Walk-in) sin necesidad de una cita previa programada.',
                steps: [
                    'Presiona la tarjeta "Consulta Rápida".',
                    'Aparecerá un buscador; ingresa la matrícula del estudiante.',
                    'El sistema buscará al estudiante y verificará tus permisos.',
                    'Si se encuentra, se abrirá de inmediato el modal de Consulta SOAP.'
                ]
            },
            {
                id: 'agenda',
                icon: 'bi-calendar-week',
                color: 'primary',
                title: 'Mi Agenda',
                subtitle: 'Control de citas del día y futuras',
                description: 'Gestiona tu horario y revisa a los alumnos que han solicitado un espacio contigo. Puedes confirmar o cancelar citas desde aquí.',
                steps: [
                    'Presiona la tarjeta "Mi Agenda".',
                    'Verás la lista completa de citas programadas.',
                    'Puedes proceder con la consulta cuando gustes o reagendarla.'
                ]
            },
            {
                id: 'sala_espera',
                icon: 'bi-people',
                color: 'danger',
                title: 'Sala de Espera',
                subtitle: 'Pacientes presentes físicamente',
                description: 'Muestra a los estudiantes que han llegado al consultorio e ingresado mediante su código QR digital en enfermería o sala de espera.',
                steps: [
                    'Revisa cuántos alumnos están en Sala de Espera.',
                    'Selecciona a un paciente de la lista para agendarlo o ver perfil.',
                    'Podrás gestionar todas las citas en espera desde aquí.'
                ]
            },
            {
                id: 'expediente',
                icon: 'bi-file-earmark-medical',
                color: 'info',
                title: 'Expediente y Búsqueda',
                subtitle: 'Busca por nombre o matrícula',
                description: 'Localiza el registro completo de cualquier estudiante para revisar diagnósticos pasados, estado nutricional o información de emergencia.',
                steps: [
                    'Usa "Buscar Paciente".',
                    'Selecciona el resultado correcto.',
                    'Examina las "Consultas Anteriores" en el lado derecho del panel de la consulta.'
                ],
                mockHtml: `
                    <div class="card border-0 shadow-sm mt-3">
                        <div class="card-header bg-light border-0 py-2">
                            <i class="bi bi-person-badge text-primary me-2"></i><strong>Ejemplo de Perfil de Paciente</strong>
                        </div>
                        <div class="card-body bg-white py-3">
                            <div class="d-flex align-items-center mb-3">
                                <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold me-3" style="width:50px; height:50px;">AL</div>
                                <div>
                                    <h6 class="mb-0 fw-bold">Alan Lovato Torres</h6>
                                    <small class="text-muted">ISC • 20001234</small>
                                </div>
                            </div>
                            <div class="row g-2 small">
                                <div class="col-6"><span class="text-muted"><i class="bi bi-droplet text-danger"></i> Sangre:</span> <strong>O+</strong></div>
                                <div class="col-6"><span class="text-muted"><i class="bi bi-heart-pulse text-danger"></i> Alergias:</span> <strong>Penicilina</strong></div>
                            </div>
                            <hr class="my-2">
                            <div class="text-muted small"><i class="bi bi-clock-history"></i> Última visita: Hace 2 meses (Fiebre)</div>
                        </div>
                    </div>
                `
            },
            {
                id: 'agendar',
                icon: 'bi-calendar-plus',
                color: 'warning',
                title: 'Agendar Cita Manual',
                subtitle: 'Bloquear espacio de consulta',
                description: 'Permite al personal registrar una cita programada directamente para un alumno (útil si el estudiante la solicita presencialmente o requiere seguimiento forzoso).',
                steps: [
                    'Toca "Agendar Cita".',
                    'Busca y selecciona al paciente.',
                    'Elige la fecha y el horario disponible.',
                    'Confirma el motivo (Consulta o Seguimiento).'
                ]
            },
            {
                id: 'soap',
                icon: 'bi-journal-medical',
                color: 'dark',
                title: 'Modal de Consulta (SOAP)',
                subtitle: 'Registro estandarizado',
                description: 'El sistema emplea el método SOAP para registro clínico rápido. Se abre automáticamente al iniciar atención desde la Agenda, Búsqueda o Sala de Espera.',
                steps: [
                    '<strong>(S) Subjetivo:</strong> Ingresa motivo y síntomas referidos.',
                    '<strong>(O) Objetivo:</strong> Registra vitales (PA, FC, Temp, Peso, Talla).',
                    '<strong>(A) Análisis:</strong> Define el diagnóstico final / CIE-10.',
                    '<strong>(P) Plan:</strong> Escribe indicaciones médicas o tratamiento.'
                ],
                mockHtml: `
                    <div class="card border-0 shadow-sm border-start border-4 border-success mt-3">
                        <div class="card-body bg-white py-3">
                            <h6 class="fw-bold mb-3"><i class="bi bi-check2-square text-success me-2"></i>Estructura del Registro Médico</h6>
                            <ul class="list-unstyled small mb-0">
                                <li class="mb-2"><span class="badge bg-light text-dark border">Subjetivo</span> Motivo de consulta (texto libre)</li>
                                <li class="mb-2"><span class="badge bg-light text-dark border">Objetivo</span> <span class="text-danger">❤️ 120/80</span> | <span class="text-info">🌡 36.5°C</span></li>
                                <li class="mb-2"><span class="badge bg-light text-dark border">Análisis</span> Selección de Diagnóstico (Ej. Amigdalitis aguda)</li>
                                <li class="mb-2"><span class="badge bg-light text-dark border">Plan</span> "Reposo 2 días, tomar Paracetamol 500mg c/8h..."</li>
                            </ul>
                        </div>
                    </div>
                `
            }
        ];
    }

    _renderBase() {
        // Estilos del Web Component
        const style = document.createElement('style');
        style.textContent = `
            .admin-tour-modal { background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
            .admin-tour-modal.visible { opacity: 1; pointer-events: auto; }
            
            .adm-modal-content { background: #f8f9fa; width: 90%; max-width: 800px; max-height: 90vh; border-radius: 1.5rem; overflow: hidden; display: flex; flex-direction: column; transform: translateY(20px); transition: transform 0.3s; box-shadow: 0 1rem 3rem rgba(0,0,0,0.175); }
            .admin-tour-modal.visible .adm-modal-content { transform: translateY(0); }
            
            .adm-header { background: linear-gradient(135deg, #0984e3 0%, #6c5ce7 100%); color: white; padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; }
            .adm-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
            .adm-close:hover { background: rgba(255,255,255,0.3); }
            
            .adm-tabs { display: flex; background: white; border-bottom: 1px solid #e9ecef; }
            .adm-tab { flex: 1; text-align: center; padding: 1rem; cursor: pointer; font-weight: 600; color: #6c757d; border-bottom: 3px solid transparent; transition: 0.2s; }
            .adm-tab:hover { background: #f8f9fa; color: #0984e3; }
            .adm-tab.active { color: #0984e3; border-bottom-color: #0984e3; background: #f1f8ff; }
            
            .adm-body { flex: 1; overflow-y: auto; padding: 2rem; display: none; }
            .adm-body.active { display: block; animation: fadeIn 0.3s; }
            
            /* Start Tour View */
            .adm-start-view { text-align: center; padding: 2rem 0; }
            .adm-start-view i { font-size: 4rem; color: #0984e3; margin-bottom: 1rem; display: inline-block; }
            .adm-btn-start { background: #0984e3; color: white; border: none; padding: 1rem 2.5rem; border-radius: 50px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(9,132,227,0.3); margin-top: 1.5rem; display: inline-flex; align-items: center; gap: 0.5rem; }
            .adm-btn-start:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(9,132,227,0.4); }
            
            /* Explore Grid */
            .adm-topics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
            .adm-topic-card { background: white; border: 1px solid #e9ecef; border-radius: 1rem; padding: 1.25rem; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
            .adm-topic-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(0,0,0,0.05); border-color: #dee2e6; }
            .adm-topic-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 1rem; }
            .adm-topic-title { font-weight: 700; font-size: 1rem; color: #212529; margin-bottom: 0.25rem; }
            .adm-topic-subtitle { font-size: 0.75rem; color: #6c757d; line-height: 1.3; }
            
            /* Topic Detail View */
            #adm-view-detail { padding: 0; display: none; }
            #adm-view-detail.active { display: flex; flex-direction: column; }
            .adm-detail-header { padding: 1.5rem 2rem; border-bottom: 1px solid #e9ecef; display: flex; align-items: center; gap: 1rem; background: white; }
            .adm-btn-back { background: #f8f9fa; border: 1px solid #dee2e6; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #495057; transition: 0.2s; flex-shrink: 0; }
            .adm-btn-back:hover { background: #e2e6ea; }
            .adm-detail-content { padding: 2rem; overflow-y: auto; background: #f8f9fa; flex: 1; }
            
            /* Overlay Engine — injected into document.body at runtime */
            .adm-tour-overlay { position: fixed; inset: 0; pointer-events: auto; z-index: 100000; opacity: 0; transition: opacity 0.3s; }
            .adm-tour-overlay.active { opacity: 1; }
            .adm-tour-spotlight { position: fixed; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.72); pointer-events: none; transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); opacity: 0; z-index: 100001; }
            .adm-tour-spotlight.visible { opacity: 1; }
            
            .adm-tour-tooltip { position: fixed; width: 360px; background: white; border-radius: 18px; padding: 1.75rem; opacity: 0; pointer-events: auto; z-index: 100002; transition: opacity 0.35s, transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: 0 12px 40px rgba(0,0,0,0.28); transform: translateY(8px); }
            .adm-tour-tooltip.visible { opacity: 1; transform: translateY(0); }
            
            .adm-tt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; }
            .adm-tt-step { font-size: 0.78rem; font-weight: 700; color: #0984e3; text-transform: uppercase; letter-spacing: 0.6px; }
            .adm-tt-title { font-size: 1.2rem; font-weight: 800; color: #1a1a2e; margin-bottom: 0.6rem; }
            .adm-tt-desc { font-size: 0.95rem; color: #4a4a6a; line-height: 1.65; margin-bottom: 1.5rem; }
            
            .adm-tt-footer { display: flex; justify-content: space-between; align-items: center; }
            .adm-tt-nav { display: flex; gap: 0.5rem; }
            .adm-tt-btn { border: none; background: #f1f3f5; color: #495057; padding: 0.55rem 1.2rem; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.88rem; }
            .adm-tt-btn:hover { background: #e2e6ea; color: #212529; }
            .adm-tt-btn-primary { background: linear-gradient(135deg,#0984e3,#6c5ce7); color: white; padding-inline: 1.4rem; }
            .adm-tt-btn-primary:hover { opacity: 0.9; background: linear-gradient(135deg,#0984e3,#6c5ce7); color: white; }
            
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            @media (max-width: 768px) {
                .adm-modal-content { width: 100%; height: 100%; max-height: 100%; border-radius: 0; transform: translateY(100%); }
                .tour-tooltip-b { width: calc(100vw - 32px); }
            }
        `;

        // Estructura del modal
        this.innerHTML = `
            <div id="adm-tour-launcher" class="admin-tour-modal">
                <div class="adm-modal-content">
                    <div class="adm-header">
                        <div>
                            <h4 class="mb-0 fw-bold" style="font-size: 1.3rem;"><i class="bi bi-rocket-takeoff-fill me-2 text-warning"></i>Guía Médica</h3>
                            <div class="small opacity-75">Domina todas las herramientas del panel clínico</div>
                        </div>
                        <button class="adm-close" onclick="this.closest('admin-medi-tour').close()"><i class="bi bi-x-lg"></i></button>
                    </div>
                    
                    <div class="adm-tabs">
                        <div class="adm-tab active" data-tab="adm-view-start" onclick="this.closest('admin-medi-tour')._switchTab('adm-view-start')">
                            <i class="bi bi-play-circle-fill me-2"></i>Tour Guiado
                        </div>
                        <div class="adm-tab" data-tab="adm-view-explore" onclick="this.closest('admin-medi-tour')._switchTab('adm-view-explore')">
                            <i class="bi bi-grid-fill me-2"></i>Explorar por Tema
                        </div>
                    </div>
                    
                    <!-- View: Start Tour -->
                    <div id="adm-view-start" class="adm-body active">
                        <div class="adm-start-view">
                            <i class="bi bi-map"></i>
                            <h4 class="fw-bold">Comienza tu recorrido intercativo</h4>
                            <p class="text-muted mb-4 mx-auto" style="max-width: 400px;">Te mostraremos paso a paso la estructura del panel administrativo, las herramientas principales y dónde encontrar la información de los pacientes.</p>
                            
                            <button class="adm-btn-start" onclick="this.closest('admin-medi-tour').startTour()">
                                Iniciar Recorrido <i class="bi bi-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- View: Explore Catalog -->
                    <div id="adm-view-explore" class="adm-body">
                        <div class="adm-topics-grid" id="adm-topics-container">
                            <!-- Injected dynamically -->
                        </div>
                    </div>
                    
                    <!-- View: Topic Detail -->
                    <div id="adm-view-detail" class="adm-body">
                        <div class="adm-detail-header">
                            <button class="adm-btn-back" onclick="this.closest('admin-medi-tour')._switchTab('adm-view-explore')">
                                <i class="bi bi-arrow-left"></i>
                            </button>
                            <div class="d-flex align-items-center gap-3">
                                <div id="adm-detail-icon" class="text-white rounded flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; font-size: 1.2rem;"></div>
                                <div>
                                    <h5 class="fw-bold mb-0" id="adm-detail-title">Título</h5>
                                    <div class="small text-muted" id="adm-detail-subtitle">Subtítulo</div>
                                </div>
                            </div>
                        </div>
                        <div class="adm-detail-content">
                            <p id="adm-detail-desc" class="mb-4" style="font-size: 1.05rem;"></p>
                            <h6 class="fw-bold text-muted mb-3 text-uppercase" style="font-size: 0.8rem; letter-spacing: 0.5px;">Flujo sugerido</h6>
                            <div class="card border-0 shadow-sm">
                                <ul class="list-group list-group-flush" id="adm-detail-steps">
                                    <!-- Injected -->
                                </ul>
                            </div>
                            <div id="adm-detail-mock" class="mt-4">
                                <!-- Injected mock visual if available -->
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
            
            <!-- (Overlay is injected into document.body at runtime via startTour) -->
        `;

        this.appendChild(style);

        // Renderizar catálogo de temas
        const container = this.querySelector('#adm-topics-container');
        let html = '';
        this._topics.forEach(t => {
            html += `
                <div class="adm-topic-card" onclick="this.closest('admin-medi-tour').showTopic('${t.id}')">
                    <div class="adm-topic-icon bg-${t.color} text-white"><i class="bi ${t.icon}"></i></div>
                    <div class="adm-topic-title">${t.title}</div>
                    <div class="adm-topic-subtitle">${t.subtitle}</div>
                </div>
            `;
        });
        container.innerHTML = html;

        // Overlay elements are created on startTour and appended to body
        this._spotlight = null;
        this._tooltip = null;
        this._overlay = null;
    }

    _switchTab(tabId) {
        // Tabs active states
        if (tabId !== 'adm-view-detail') {
            this.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
            const specificTab = this.querySelector(`.adm-tab[data-tab="${tabId}"]`);
            if (specificTab) specificTab.classList.add('active');
        }

        // Bodies active states
        this.querySelectorAll('.adm-body').forEach(b => b.classList.remove('active'));
        this.querySelector(`#${tabId}`).classList.add('active');
    }

    showTopic(topicId) {
        const topic = this._topics.find(t => t.id === topicId);
        if (!topic) return;

        const iEl = this.querySelector('#adm-detail-icon');
        iEl.className = `text-white rounded flex-shrink-0 d-flex align-items-center justify-content-center bg-${topic.color}`;
        iEl.innerHTML = `<i class="bi ${topic.icon}"></i>`;

        this.querySelector('#adm-detail-title').textContent = topic.title;
        this.querySelector('#adm-detail-subtitle').textContent = topic.subtitle;
        this.querySelector('#adm-detail-desc').innerHTML = topic.description;

        const stepsUl = this.querySelector('#adm-detail-steps');
        stepsUl.innerHTML = topic.steps.map((s, i) => `
            <li class="list-group-item px-3 py-3 border-light d-flex gap-3 align-items-start">
                <div class="bg-light text-secondary rounded-circle fw-bold d-flex align-items-center justify-content-center flex-shrink-0" style="width:24px;height:24px;font-size:.8rem;">${i + 1}</div>
                <div>${s}</div>
            </li>
        `).join('');

        const mockEl = this.querySelector('#adm-detail-mock');
        mockEl.innerHTML = topic.mockHtml || '';

        this._switchTab('adm-view-detail');
        AdminMediTour._markCompleted(); // Si entra a explorar, cuenta como visto
    }

    /* ==============================
       OVERLAY ENGINE METHODS
       ============================== */

    open() {
        this.querySelector('#adm-tour-launcher').classList.add('visible');
    }

    close() {
        this.querySelector('#adm-tour-launcher').classList.remove('visible');
    }

    _buildOverlay() {
        this._overlay = document.createElement('div');
        this._overlay.className = 'adm-tour-overlay';

        this._spotlight = document.createElement('div');
        this._spotlight.className = 'adm-tour-spotlight';

        this._tooltip = document.createElement('div');
        this._tooltip.className = 'adm-tour-tooltip';

        this._overlay.appendChild(this._spotlight);
        this._overlay.appendChild(this._tooltip);
        document.body.appendChild(this._overlay);

        requestAnimationFrame(() => this._overlay.classList.add('active'));
    }

    _destroyOverlay() {
        if (!this._overlay) return;
        this._overlay.classList.remove('active');
        setTimeout(() => {
            this._overlay?.remove();
            this._overlay = null;
            this._spotlight = null;
            this._tooltip = null;
        }, 350);
    }

    startTour() {
        this.close();
        if (this._isActive) return;
        this._isActive = true;
        this._currentStep = 0;

        this._buildOverlay();
        document.body.style.overflow = 'hidden';

        document.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('resize', this._handleResize);

        this._renderStep();
        AdminMediTour._markCompleted();
    }

    stopTour() {
        if (!this._isActive) return;
        this._isActive = false;

        document.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('resize', this._handleResize);

        this._destroyOverlay();
        document.body.style.overflow = '';
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') this.stopTour();
        else if (e.key === 'ArrowRight' || e.key === 'Enter') this._nextStep();
        else if (e.key === 'ArrowLeft') this._prevStep();
    }

    _handleResize() {
        if (!this._isActive) return;
        this._spotlight.classList.remove('visible');
        this._tooltip.classList.remove('visible');
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._renderStep(), 300);
    }

    _nextStep() {
        if (this._currentStep < this._steps.length - 1) {
            this._currentStep++;
            this._renderStep();
        } else {
            this.stopTour();
        }
    }

    _prevStep() {
        if (this._currentStep > 0) {
            this._currentStep--;
            this._renderStep();
        }
    }

    _renderStep() {
        const step = this._steps[this._currentStep];

        this._spotlight.classList.remove('visible');
        this._tooltip.classList.remove('visible');

        // Hide previous tooltip first
        this._tooltip?.classList.remove('visible');
        this._spotlight?.classList.remove('visible');

        setTimeout(() => {
            if (!this._isActive) return;
            // Support getDynamicTarget for computed elements
            const targetEl = step.getDynamicTarget
                ? step.getDynamicTarget()
                : (step.target ? document.querySelector(step.target) : null);

            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {
                    if (!this._isActive) return;
                    this._renderTooltipContent(step);
                    requestAnimationFrame(() => {
                        this._positionSpotlight(targetEl);
                        this._positionTooltip(targetEl, step.position);
                        this._spotlight.classList.add('visible');
                        this._tooltip.classList.add('visible');
                    });
                }, 500);
            } else {
                // Center step (welcome / finale)
                window.scrollTo({ top: 0, behavior: 'smooth' });
                this._spotlight.style.opacity = '0';
                setTimeout(() => {
                    if (!this._isActive) return;
                    this._renderTooltipContent(step);
                    const tooltipW = Math.min(400, window.innerWidth - 32);
                    this._tooltip.style.width = `${tooltipW}px`;
                    this._tooltip.style.top = '50%';
                    this._tooltip.style.left = '50%';
                    this._tooltip.style.transform = 'translate(-50%, -50%)';
                    this._tooltip.classList.add('visible');
                }, 220);
            }
        }, 280);
    }

    _renderTooltipContent(step) {
        const isFirst = this._currentStep === 0;
        const isLast = this._currentStep === this._steps.length - 1;
        const host = this; // closure ref for event listeners (won't use inline onclick)

        this._tooltip.innerHTML = `
            <div class="adm-tt-header">
                <span class="adm-tt-step">PASO ${this._currentStep + 1} DE ${this._steps.length}</span>
                <button id="adm-tt-close" class="btn-close" style="font-size:0.75rem;"></button>
            </div>
            <div class="adm-tt-title">${step.title}</div>
            <div class="adm-tt-desc">${step.description}</div>
            <div class="adm-tt-footer">
                <button id="adm-tt-skip" class="adm-tt-btn" style="opacity:${isLast ? '0' : '1'};pointer-events:${isLast ? 'none' : 'auto'}">Omitir</button>
                <div class="adm-tt-nav">
                    ${!isFirst ? `<button id="adm-tt-prev" class="adm-tt-btn"><i class="bi bi-arrow-left"></i></button>` : ''}
                    <button id="adm-tt-next" class="adm-tt-btn adm-tt-btn-primary">
                        ${isLast ? '✓ Terminar' : 'Siguiente <i class="bi bi-arrow-right"></i>'}
                    </button>
                </div>
            </div>
        `;

        // Attach event listeners via JS (no inline onclick — works outside Shadow DOM too)
        this._tooltip.querySelector('#adm-tt-close')?.addEventListener('click', () => host.stopTour());
        this._tooltip.querySelector('#adm-tt-skip')?.addEventListener('click', () => host.stopTour());
        this._tooltip.querySelector('#adm-tt-prev')?.addEventListener('click', () => host._prevStep());
        this._tooltip.querySelector('#adm-tt-next')?.addEventListener('click', () => host._nextStep());
    }

    _positionSpotlight(element) {
        const rect = element.getBoundingClientRect();
        const pad = 10;
        // position:fixed — viewport coords, no scrollY offset needed
        this._spotlight.style.top = `${rect.top - pad}px`;
        this._spotlight.style.left = `${rect.left - pad}px`;
        this._spotlight.style.width = `${rect.width + pad * 2}px`;
        this._spotlight.style.height = `${rect.height + pad * 2}px`;
        this._spotlight.style.opacity = '';
    }

    _positionTooltip(element, positionStr) {
        const rect = element.getBoundingClientRect();
        const tooltipW = Math.min(380, window.innerWidth - 32);
        this._tooltip.style.width = `${tooltipW}px`;
        this._tooltip.style.transform = '';
        const tH = this._tooltip.offsetHeight || 240;
        const headerH = 70;
        const bottomSafe = 20;
        let top, left;

        if (positionStr === 'bottom') {
            top = rect.bottom + 14;
            left = rect.left + rect.width / 2 - tooltipW / 2;
        } else if (positionStr === 'top') {
            top = rect.top - tH - 14;
            left = rect.left + rect.width / 2 - tooltipW / 2;
        } else if (positionStr === 'left') {
            top = rect.top + rect.height / 2 - tH / 2;
            left = rect.left - tooltipW - 14;
        } else {
            top = rect.top + rect.height / 2 - tH / 2;
            left = rect.right + 14;
        }

        if (top < headerH) top = rect.bottom + 14;
        if (top + tH > window.innerHeight - bottomSafe) top = rect.top - tH - 14;
        if (top < headerH) top = headerH + 8;

        left = Math.max(16, Math.min(left, window.innerWidth - tooltipW - 16));
        top = Math.max(headerH, Math.min(top, window.innerHeight - tH - bottomSafe));

        this._tooltip.style.top = `${top}px`;
        this._tooltip.style.left = `${left}px`;
        this._tooltip.style.maxHeight = `calc(100vh - ${headerH + bottomSafe + 20}px)`;
        this._tooltip.style.overflowY = 'auto';
    }

    /* ==============================
       STATIC HELPERS
       ============================== */
    static shouldShow() {
        try {
            const profile = window.Store?.userProfile || window.SIA?.currentUserProfile;
            if (!profile || !profile.uid) return false;

            // Mostrar SOLO a administradores (médicos / psicólogos)
            if (profile.role !== 'admin-medi' && profile.role !== 'admin') return false;

            return !localStorage.getItem(`admin_tour_done_${ADMIN_TOUR_VERSION}_${profile.uid}`);
        } catch (e) { return false; }
    }

    static _markCompleted() {
        try {
            const profile = window.Store?.userProfile || window.SIA?.currentUserProfile;
            if (profile && profile.uid) {
                localStorage.setItem(`admin_tour_done_${ADMIN_TOUR_VERSION}_${profile.uid}`, 'true');
            }
        } catch (e) { }
    }
}

// Registrar el web component
if (!customElements.get('admin-medi-tour')) {
    customElements.define('admin-medi-tour', AdminMediTour);
    window.AdminMediTour = AdminMediTour;
}
