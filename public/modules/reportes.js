/**
 * ============================================================
 *  Reportes.js — Módulo Orquestador del Centro de Reportes SIA
 * ============================================================
 *  Coordina la navegación, carga de datos y delegación a
 *  sub-módulos: Reportes.Filters, Reportes.Charts,
 *  Reportes.Biblio, Reportes.Medico, Reportes.Poblacion.
 *
 *  @version 4.0.0
 *  @requires ReportesService, Bootstrap 5.3, Chart.js
 * ============================================================
 */
var Reportes = (function () {
    'use strict';

    // ==================== ESTADO INTERNO ====================

    /** @type {Object} Contexto de la app (auth, db, profile) */
    let _ctx = null;
    /** @type {'landing'|'detail'} Vista actual */
    let _currentView = 'landing';
    /** @type {'BIBLIO'|'MEDICO'|'POBLACION'|null} Área seleccionada */
    let _currentArea = null;
    /** @type {string|null} Pestaña activa dentro del área */
    let _currentTab = null;
    /** @type {Date|null} Fecha inicio del rango personalizado */
    let _dateStart = null;
    /** @type {Date|null} Fecha fin del rango personalizado */
    let _dateEnd = null;
    /** @type {string} Período predeterminado */
    let _presetPeriod = 'monthly';
    /** @type {Object} Filtros demográficos activos */
    let _demoFilters = { carrera: null, turno: null, genero: null, generacion: null };
    /** @type {Array} Datos crudos del período actual */
    let _rawData = [];
    /** @type {Array} Datos filtrados por filtros demográficos */
    let _filteredData = [];
    /** @type {Object} Datos extra (catálogo, activos, expedientes, etc.) */
    let _extraData = {};
    /** @type {Object} Registro de gráficas principales */
    let _charts = {};
    /** @type {Object} Registro de gráficas en modales */
    let _modalCharts = {};
    /** @type {{category:string|null,data:Array,activeFilters:Set<string>}} Estado del modal de detalle */
    let _modalDetailState = { category: null, data: [], activeFilters: new Set() };
    let _loadRequestSeq = 0;
    let _landingRequestSeq = 0;

    // ==================== CONFIGURACIÓN DE ÁREAS ====================

    /** Definiciones de áreas del sistema */
    const AREAS = {
        BIBLIO: {
            name: 'Biblioteca',
            fullName: 'Biblioteca',
            icon: 'bi-book-half',
            color: 'warning',
            gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
            description: 'Gestión de visitas, préstamos de libros y catálogo bibliográfico.',
            tabs: [
                { id: 'visitas', label: 'Visitas', icon: 'bi-door-open' },
                { id: 'prestamos', label: 'Préstamos', icon: 'bi-book' },
                { id: 'catalogo', label: 'Catálogo', icon: 'bi-collection' }
            ]
        },
        MEDICO: {
            name: 'Servicios Médicos',
            fullName: 'Servicios Médicos y Psicopedagógicos',
            icon: 'bi-heart-pulse-fill',
            color: 'primary',
            gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            description: 'Atención médica, consultas psicológicas y seguimiento clínico.',
            tabs: [
                { id: 'consultas', label: 'Consultas', icon: 'bi-clipboard2-pulse' },
                { id: 'diagnosticos', label: 'Diagnósticos', icon: 'bi-activity' },
                { id: 'perfil', label: 'Perfil Clínico', icon: 'bi-heart-pulse' }
            ]
        },
        POBLACION: {
            name: 'Población SIA',
            fullName: 'Población Global SIA',
            icon: 'bi-people-fill',
            color: 'success',
            gradient: 'linear-gradient(135deg, #0d9488, #0f766e)',
            description: 'Estadísticas demográficas, salud e indicadores socioeconómicos.',
            tabs: [
                { id: 'demografia', label: 'Demografía', icon: 'bi-bar-chart' },
                { id: 'salud', label: 'Salud', icon: 'bi-hospital' },
                { id: 'socioeconomico', label: 'Socioeconómico', icon: 'bi-cash-stack' }
            ]
        },
        VOCACIONAL: {
            name: 'Test Vocacional',
            fullName: 'Aspirantes Test Vocacional',
            icon: 'bi-journal-check',
            color: 'info',
            gradient: 'linear-gradient(135deg, #0dcaf0, #0bacbe)',
            description: 'CRM de prospectos, estadísticas y configuración del test.',
            tabs: [
                { id: 'dashboard', label: 'Estadísticas', icon: 'bi-speedometer2' },
                { id: 'prospectos', label: 'Base Prospectos', icon: 'bi-people' },
                { id: 'configuracion', label: 'Configurar Test', icon: 'bi-gear' }
            ]
        }
    };

    function _tabSupportsFilters(area = _currentArea, tab = _currentTab) {
        if (area === 'VOCACIONAL') return false;
        if (area === 'BIBLIO' && tab === 'catalogo') return false;
        if (area === 'MEDICO' && tab === 'perfil') return false;
        return true;
    }

    function _getCurrentTabMeta(area = _currentArea, tab = _currentTab) {
        const areaDef = AREAS[area];
        if (!areaDef) return null;
        return areaDef.tabs.find(t => t.id === tab) || areaDef.tabs[0] || null;
    }

    function _getCurrentTabRecords(records, area = _currentArea, tab = _currentTab) {
        const source = Array.isArray(records) ? records : [];

        if (area === 'BIBLIO') {
            if (tab === 'visitas') return source.filter(d => d.subarea === 'Visitas');
            if (tab === 'prestamos') return source.filter(d => d.subarea === 'Préstamos');
            if (tab === 'catalogo') return [];
        }

        return source;
    }

    function _getExportContext(area = _currentArea, tab = _currentTab) {
        const tabMeta = _getCurrentTabMeta(area, tab);

        if (area === 'BIBLIO' && tab === 'catalogo') {
            return {
                kind: 'catalogo',
                tabLabel: tabMeta?.label || 'Catálogo',
                supportsPeriod: false,
                supportsTypeSelection: false
            };
        }

        if (area === 'MEDICO' && tab === 'perfil') {
            return {
                kind: 'expedientes',
                tabLabel: tabMeta?.label || 'Perfil Clínico',
                supportsPeriod: false,
                supportsTypeSelection: false
            };
        }

        return {
            kind: 'records',
            tabLabel: tabMeta?.label || 'Reporte',
            supportsPeriod: true,
            supportsTypeSelection: _getExportTypes(area, tab).length > 1
        };
    }

    function _renderFilterBar() {
        const filterBar = document.getElementById('reportes-filter-bar');
        if (!filterBar) return;

        const _F = window.Reportes && window.Reportes.Filters;
        if (_F && _F.render && _tabSupportsFilters()) {
            _F.render('reportes-filter-bar');
            if (_rawData.length && _F.populateFilterOptions) {
                _F.populateFilterOptions(_rawData);
            }
            return;
        }

        if (_tabSupportsFilters()) {
            filterBar.innerHTML = '';
            return;
        }

        const ctx = _getExportContext();
        filterBar.innerHTML = `
            <div class="alert alert-light border rounded-4 py-2 px-3 mb-0 small text-muted">
                <i class="bi bi-info-circle me-1"></i>
                Los filtros de periodo y demografía no aplican en la pestaña <strong>${ctx.tabLabel}</strong>.
            </div>
        `;
    }

    function _matchesExportType(item, type) {
        if (!item || !type) return false;

        if (_currentArea === 'BIBLIO') {
            if (type === 'VISITAS') return item.subarea === 'Visitas';
            if (type === 'PRESTAMOS') return item.subarea === 'Préstamos';
        } else if (_currentArea === 'MEDICO') {
            if (type === 'Consulta Médica') return item.tipo === 'Consulta Médica';
            if (type === 'Consulta Psicológica') return item.tipo === 'Consulta Psicológica';
        } else if (_currentArea === 'POBLACION') {
            if (type === 'ESTUDIANTE') return item.subarea === 'ESTUDIANTE';
            if (type === 'DOCENTE') return item.subarea === 'DOCENTE';
            if (type === 'ADMINISTRATIVO') return item.subarea === 'ADMINISTRATIVO';
            if (type === 'ADMIN_MODULO') return item.subarea === 'ADMIN_MODULO';
        }

        return false;
    }

    function _applyExportTypeFilters(records, selectedTypes) {
        if (!Array.isArray(selectedTypes) || selectedTypes.length === 0) return records;
        return (records || []).filter(item => selectedTypes.some(type => _matchesExportType(item, type)));
    }

    function _sanitizeFileName(text) {
        return String(text || 'reporte')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'reporte';
    }

    function _getHomeBreadcrumb() {
        const breadcrumbState = window.SIA?.Breadcrumbs?.getState?.();
        const stateTrail = Array.isArray(breadcrumbState?.trail) ? breadcrumbState.trail : [];
        const rootCrumb = stateTrail[0];
        if (rootCrumb?.viewId) {
            return {
                label: rootCrumb.label || 'Inicio',
                viewId: rootCrumb.viewId
            };
        }

        const profile = _ctx?.profile || window.SIA?.currentUserProfile || null;
        const homeViewId = typeof window.SIA?.getHomeView === 'function'
            ? window.SIA.getHomeView(profile)
            : 'view-dashboard';

        return {
            label: 'Inicio',
            viewId: homeViewId || 'view-dashboard'
        };
    }

    function _syncBreadcrumbTrail() {
        const breadcrumbsApi = window.SIA?.Breadcrumbs || window.SIABreadcrumbs || null;
        const setBreadcrumbs = window.SIA?.setBreadcrumbs
            || (breadcrumbsApi?.setView ? (viewId, options = {}) => breadcrumbsApi.setView(viewId, options) : null);
        const setBreadcrumbTrail = window.SIA?.setBreadcrumbTrail
            || (breadcrumbsApi?.setTrail ? (viewId, trail, options = {}) => breadcrumbsApi.setTrail(viewId, trail, options) : null);
        if (!setBreadcrumbs && !setBreadcrumbTrail) return;

        if (_currentView === 'landing') {
            setBreadcrumbs?.('view-reportes');
            return;
        }

        const area = AREAS[_currentArea];
        const tabMeta = _getCurrentTabMeta();
        if (!area) {
            setBreadcrumbs?.('view-reportes');
            return;
        }

        const homeCrumb = _getHomeBreadcrumb();

        setBreadcrumbTrail?.('view-reportes', [
            { label: homeCrumb.label, viewId: homeCrumb.viewId },
            { label: 'Reportes' },
            { label: area.name },
            { label: tabMeta?.label || area.tabs[0]?.label || 'Detalle' }
        ], {
            rootViewId: homeCrumb.viewId
        });
    }

    // ==================== INICIALIZACIÓN ====================

    /**
     * Punto de entrada del módulo.
     * @param {Object} ctx - Contexto con auth, db y profile
     */
    function init(ctx) {
        _ctx = ctx;
        if (!isAuthorized()) return;
        render();
    }

    /**
     * Verifica si el usuario tiene permisos para acceder a reportes.
     * @returns {boolean}
     */
    function isAuthorized() {
        const email = _ctx.auth.currentUser?.email || '';
        const role = _ctx.profile?.role;
        const permissions = _ctx.profile?.permissions || {};

        if (email === 'biblioteca@loscabos.tecnm.mx') return true;
        if (email === 'desarrolloacademico@loscabos.tecnm.mx') return true;
        if (role === 'superadmin') return true;
        if (role === 'department_admin' && permissions.reportes === 'admin') return true;

        return false;
    }

    // ==================== RENDERIZADO PRINCIPAL ====================

    /**
     * Renderiza la vista actual (landing o detail).
     * Destruye todas las gráficas antes de re-renderizar.
     */
    function render() {
        const container = document.getElementById('view-reportes');
        if (!container) return;

        destroyAllCharts();
        _syncBreadcrumbTrail();

        if (_currentView === 'landing') {
            renderLanding(container);
        } else {
            renderDetail(container);
        }
    }

    // ==================== RELOJ GLOBAL ====================
    let _clockInterval = null;

    function _startClock() {
        if (_clockInterval) clearInterval(_clockInterval);
        const updateClock = () => {
            const timeEl = document.getElementById('global-realtime-clock');
            const dateEl = document.getElementById('global-realtime-date');
            if (!timeEl || !dateEl) return;
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            dateEl.textContent = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        };
        updateClock();
        _clockInterval = setInterval(updateClock, 1000);
    }

    function _stopClock() {
        if (_clockInterval) {
            clearInterval(_clockInterval);
            _clockInterval = null;
        }
    }

    /**
     * Destruye todas las instancias de Chart.js registradas.
     */
    function destroyAllCharts() {
        _stopClock();
        Object.keys(_charts).forEach(key => {
            if (_charts[key]) _charts[key].destroy();
        });
        _charts = {};

        Object.keys(_modalCharts).forEach(key => {
            if (_modalCharts[key]) _modalCharts[key].destroy();
        });
        _modalCharts = {};
    }

    // ==================== LANDING PAGE ====================

    /**
     * Renderiza la página de inicio con KPIs y tarjetas de área.
     * @param {HTMLElement} container
     */
    function renderLanding(container) {
        container.innerHTML = `
            <div class="container-fluid p-4">
                <!-- KPI Resumen Superior -->
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="card border-0 bg-success bg-opacity-10 rounded-4">
                            <div class="card-body d-flex align-items-center gap-3">
                                <div class="rounded-circle bg-primary bg-opacity-25 p-3">
                                    <i class="bi bi-people-fill text-primary fs-4"></i>
                                </div>
                                <div>
                                    <div class="text-muted small fw-bold">USUARIOS REGISTRADOS</div>
                                    <div class="fs-4 fw-bold" id="kpi-usuarios">
                                        <span class="placeholder-glow text-dark"><span class="placeholder col-6"></span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0 bg-success bg-opacity-10 rounded-4">
                            <div class="card-body d-flex align-items-center gap-3">
                                <div class="rounded-circle bg-success bg-opacity-25 p-3">
                                    <i class="bi bi-door-open-fill text-success fs-4"></i>
                                </div>
                                <div>
                                    <div class="text-muted small fw-bold">VISITAS HOY</div>
                                    <div class="fs-4 fw-bold" id="kpi-visitas">
                                        <span class="placeholder-glow"><span class="placeholder col-6"></span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0 bg-warning bg-opacity-10 rounded-4">
                            <div class="card-body d-flex align-items-center gap-3">
                                <div class="rounded-circle bg-warning bg-opacity-25 p-3">
                                    <i class="bi bi-clipboard2-pulse-fill text-warning fs-4"></i>
                                </div>
                                <div>
                                    <div class="text-muted small fw-bold">CONSULTAS HOY</div>
                                    <div class="fs-4 fw-bold" id="kpi-consultas">
                                        <span class="placeholder-glow"><span class="placeholder col-6"></span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <h4 class="fw-bold mb-1">Centro de Reportes</h4>
                <p class="text-muted mb-4">Selecciona un area para explorar sus indicadores.</p>

                <!-- Tarjetas de Área -->
                <div class="row g-4">
                    ${Object.entries(AREAS).map(([key, area]) => `
                    <div class="col-md-4">
                        <div class="card h-100 border-0 shadow-sm hover-scale cursor-pointer rounded-4"
                             onclick="Reportes.navigateTo('${key}')">
                            <div class="card-body p-4 text-center">
                                <div class="rounded-circle bg-${area.color} bg-opacity-10 text-${area.color} mb-3 mx-auto d-flex align-items-center justify-content-center"
                                     style="width: 72px; height: 72px;">
                                    <i class="bi ${area.icon} display-5"></i>
                                </div>
                                <h5 class="fw-bold mb-2">${area.name}</h5>
                                <p class="text-muted small mb-3">${area.description}</p>
                                <div class="text-muted small" id="landing-stat-${key}">
                                    <span class="placeholder-glow"><span class="placeholder col-8"></span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            <style>
                .hover-scale { transition: transform 0.2s ease-in-out; }
                .hover-scale:hover { transform: translateY(-5px); }
                .cursor-pointer { cursor: pointer; }
            </style>
        `;

        // Cargar KPIs de forma asíncrona
        _loadLandingKPIs();
    }

    /**
     * Carga los KPIs de la landing page de forma asíncrona.
     * @private
     */
    async function _loadLandingKPIsLegacy() {
        return _loadLandingKPIs();
        const requestId = ++_landingRequestSeq;

        // Cargar cada KPI independientemente para que uno no bloquee a otro
        // 1. Usuarios registrados
        try {
            const size = await getCountSafe(_ctx.db.collection('usuarios'));
            const kpiUsuarios = document.getElementById('kpi-usuarios');
            if (kpiUsuarios) kpiUsuarios.textContent = size.toLocaleString('es-MX');
            const landingPob = document.getElementById('landing-stat-POBLACION');
            if (landingPob) landingPob.textContent = `${size} usuarios registrados`;
        } catch (e) {
            console.warn('[Reportes] Error cargando usuarios:', e);
            const el = document.getElementById('kpi-usuarios');
            if (el) el.textContent = '--';
        }

        // 2. Visitas de hoy
        try {
            const query = _ctx.db.collection('biblio-visitas')
                .where('fecha', '>=', today)
                .where('fecha', '<=', todayEnd);
            const size = await getCountSafe(query);

            const kpiVisitas = document.getElementById('kpi-visitas');
            if (kpiVisitas) kpiVisitas.textContent = size.toLocaleString('es-MX');
            const landingBiblio = document.getElementById('landing-stat-BIBLIO');
            if (landingBiblio) landingBiblio.textContent = `${size} visitas hoy`;
        } catch (e) {
            console.warn('[Reportes] Error cargando visitas:', e);
            const el = document.getElementById('kpi-visitas');
            if (el) el.textContent = '--';
        }

        // 3. Consultas de hoy — usa citas-medi (colección top-level, no requiere índice especial)
        try {
            const query = _ctx.db.collection('citas-medi')
                .where('fechaSolicitud', '>=', today)
                .where('fechaSolicitud', '<=', todayEnd);
            const size = await getCountSafe(query);

            const kpiConsultas = document.getElementById('kpi-consultas');
            if (kpiConsultas) kpiConsultas.textContent = size.toLocaleString('es-MX');
            const landingMedico = document.getElementById('landing-stat-MEDICO');
            if (landingMedico) landingMedico.textContent = `${size} consultas hoy`;
        } catch (e) {
            console.warn('[Reportes] Error cargando consultas:', e);
            const el = document.getElementById('kpi-consultas');
            if (el) el.textContent = '--';
        }
    }

    async function _loadLandingKPIs() {
        const requestId = ++_landingRequestSeq;

        try {
            const kpis = await ReportesService.fetchLandingKPIs(_ctx);
            if (requestId !== _landingRequestSeq || _currentView !== 'landing') return;

            const formatCount = (value) => Number.isFinite(value) ? value.toLocaleString('es-MX') : '--';

            const kpiUsuarios = document.getElementById('kpi-usuarios');
            if (kpiUsuarios) kpiUsuarios.textContent = formatCount(kpis.usuarios);
            const landingPob = document.getElementById('landing-stat-POBLACION');
            if (landingPob) {
                landingPob.textContent = Number.isFinite(kpis.usuarios)
                    ? `${kpis.usuarios} usuarios registrados`
                    : '--';
            }

            const kpiVisitas = document.getElementById('kpi-visitas');
            if (kpiVisitas) kpiVisitas.textContent = formatCount(kpis.visitasHoy);
            const landingBiblio = document.getElementById('landing-stat-BIBLIO');
            if (landingBiblio) {
                landingBiblio.textContent = Number.isFinite(kpis.visitasHoy)
                    ? `${kpis.visitasHoy} visitas hoy`
                    : '--';
            }

            const kpiConsultas = document.getElementById('kpi-consultas');
            if (kpiConsultas) kpiConsultas.textContent = formatCount(kpis.consultasHoy);
            const landingMedico = document.getElementById('landing-stat-MEDICO');
            if (landingMedico) {
                landingMedico.textContent = Number.isFinite(kpis.consultasHoy)
                    ? `${kpis.consultasHoy} consultas hoy`
                    : '--';
            }
        } catch (e) {
            if (requestId !== _landingRequestSeq || _currentView !== 'landing') return;

            console.warn('[Reportes] Error cargando KPIs de landing:', e);
            ['kpi-usuarios', 'kpi-visitas', 'kpi-consultas'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.textContent = '--';
            });
        }
    }

    // ==================== NAVEGACIÓN ====================

    /**
     * Navega a la vista de detalle de un área.
     * @param {string} area - 'BIBLIO' | 'MEDICO' | 'POBLACION'
     */
    function navigateTo(area) {
        _currentArea = area;
        _currentView = 'detail';
        _currentTab = AREAS[area].tabs[0].id;
        render();
        loadData();
    }

    /**
     * Regresa a la vista de landing.
     */
    function goBack() {
        _loadRequestSeq++;
        _currentView = 'landing';
        _currentArea = null;
        _currentTab = null;
        _rawData = [];
        _filteredData = [];
        _extraData = {};
        _demoFilters = { carrera: null, turno: null, genero: null, generacion: null };
        render();
    }

    /**
     * Cambia la pestaña activa sin recargar datos.
     * @param {string} tab - ID de la pestaña
     */
    function setTab(tab) {
        _currentTab = tab;
        _renderFilterBar();
        _syncBreadcrumbTrail();
        // Re-renderizar solo el contenido, no recargar datos
        const contentEl = document.getElementById('reportes-content');
        if (contentEl) {
            destroyAllCharts();
            renderDashboardContent(contentEl);
        }
        // Actualizar estado visual de las pestañas
        _updateTabUI();
    }

    /**
     * Actualiza el estado visual de las pestañas.
     * @private
     */
    function _updateTabUI() {
        const tabs = document.querySelectorAll('#reportes-tabs .reportes-tab-btn');
        tabs.forEach(t => {
            if (t.dataset.tab === _currentTab) {
                t.classList.add('btn-primary', 'shadow', 'text-white');
                t.classList.remove('btn-light', 'text-muted');
            } else {
                t.classList.remove('btn-primary', 'shadow', 'text-white');
                t.classList.add('btn-light', 'text-muted');
            }
        });
    }

    // ==================== CARGA DE DATOS ====================

    /**
     * Carga datos del área actual desde ReportesService.
     * Incluye datos extra según el área (catálogo, expedientes, etc.).
     */
    async function loadData() {
        const requestId = ++_loadRequestSeq;
        const requestedArea = _currentArea;
        const container = document.getElementById('reportes-content');
        if (!container) return;

        // Mostrar spinner
        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center h-100 pt-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>`;

        try {
            // Calcular rango de fechas
            const _Fil = window.Reportes && window.Reportes.Filters;
            const dateRange = _Fil
                ? _Fil.getDateRange(_presetPeriod)
                : _getDateRange(_presetPeriod);

            if (requestId !== _loadRequestSeq || _currentView !== 'detail' || requestedArea !== _currentArea) return;

            _dateStart = dateRange.start;
            _dateEnd = dateRange.end;

            // Obtener datos principales
            if (_currentArea === 'VOCACIONAL') {
                _rawData = [];
            } else {
                _rawData = await ReportesService.getReportData(_ctx, {
                    start: dateRange.start,
                    end: dateRange.end,
                    areas: [_currentArea]
                });
            }

            if (requestId !== _loadRequestSeq || _currentView !== 'detail' || requestedArea !== _currentArea) return;

            // Obtener datos extra según el área (usando funciones del servicio)
            _extraData = {};
            if (_currentArea === 'BIBLIO') {
                const [catalogo, activos] = await Promise.all([
                    ReportesService.fetchBiblioCatalogo(_ctx),
                    ReportesService.fetchBiblioActivos(_ctx)
                ]);
                _extraData.catalogo = catalogo;
                _extraData.activos = activos;
            } else if (_currentArea === 'MEDICO') {
                _extraData.expedientes = await ReportesService.fetchExpedientesStats(_ctx);
            }

            if (requestId !== _loadRequestSeq || _currentView !== 'detail' || requestedArea !== _currentArea) return;

            // Aplicar filtros demográficos
            _filteredData = _applyDemoFiltersToData(_rawData);

            // Poblar opciones de filtro
            if (_Fil && _Fil.populateFilterOptions && _tabSupportsFilters()) {
                _Fil.populateFilterOptions(_rawData);
            }

            const currentContainer = document.getElementById('reportes-content');
            if (!currentContainer || requestId !== _loadRequestSeq || _currentView !== 'detail' || requestedArea !== _currentArea) return;
            renderDashboardContent(currentContainer);
        } catch (e) {
            if (requestId !== _loadRequestSeq || _currentView !== 'detail' || requestedArea !== _currentArea) return;
            console.error('[Reportes] Error cargando datos:', e);
            container.innerHTML = `
                <div class="alert alert-danger rounded-4 shadow-sm">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error al cargar datos: ${e.message}
                </div>`;
        }
    }

    /**
     * Fallback para calcular rango de fechas si Filters no está cargado.
     * @private
     */
    function _getDateRange(period) {
        const now = new Date();
        let start = new Date();
        let end = new Date();
        switch (period) {
            case 'daily':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'weekly': {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            }
            case 'monthly':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'quarterly': {
                const q = Math.floor((now.getMonth() + 3) / 3);
                start = new Date(now.getFullYear(), (q - 1) * 3, 1);
                end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
                break;
            }
            case 'semester': {
                const s = now.getMonth() < 6 ? 0 : 6;
                start = new Date(now.getFullYear(), s, 1);
                end = new Date(now.getFullYear(), s + 6, 0, 23, 59, 59);
                break;
            }
            case 'annual':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;
        }
        return { start, end };
    }

    // ==================== VISTA DE DETALLE ====================

    /**
     * Renderiza la vista de detalle de un área con header, filtros, pestañas y contenido.
     * @param {HTMLElement} container
     */
    function renderDetail(container) {
        const area = AREAS[_currentArea];
        if (!area) return;

        container.innerHTML = `
            <div class="container-fluid p-4">
                <!-- Banner Encabezado -->
                <div class="bg-white rounded-4 shadow-sm border p-3 mb-4 d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 gap-md-0">
                    <div class="d-flex align-items-center w-100">
                        <button class="btn btn-primary btn-lg rounded-circle me-3 shadow-sm flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;" onclick="Reportes.goBack()">
                            <i class="bi bi-arrow-left fs-4"></i>
                        </button>
                        <div class="flex-grow-1">
                            <div class="badge bg-primary bg-opacity-10 text-primary mb-1 text-uppercase">REPORTE ANALÍTICO SIA</div>
                            <h2 class="fw-bolder mb-0">${area.fullName}</h2>
                        </div>
                    </div>
                    
                    <div class="d-flex flex-column align-items-end flex-shrink-0 border-start ps-4 d-none d-md-flex" style="min-width: 220px;">
                        <div class="fw-bold fs-4 text-dark" id="global-realtime-clock">--:--:--</div>
                        <div class="text-muted small text-capitalize" id="global-realtime-date">Cargando fecha...</div>
                        <div class="d-flex align-items-center gap-2 mt-2">
                            <button class="btn btn-success btn-sm rounded-pill px-3 shadow-sm fw-bold" onclick="Reportes.showExportModal('excel')">
                                <i class="bi bi-file-earmark-excel-fill me-1"></i>Excel
                            </button>
                            <button class="btn btn-danger btn-sm rounded-pill px-3 shadow-sm fw-bold" onclick="Reportes.showExportModal('pdf')">
                                <i class="bi bi-file-earmark-pdf-fill me-1"></i>PDF
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Barra de Filtros -->
                <div id="reportes-filter-bar" class="mb-3"></div>

                <!-- Navegación por Pestañas -->
                <div class="d-flex mb-4 overflow-auto pb-1">
                    <div class="bg-light border p-1 rounded-pill d-inline-flex shadow-sm" id="reportes-tabs">
                        ${area.tabs.map(tab => `
                        <button class="btn btn-sm rounded-pill px-4 fw-bold reportes-tab-btn ${_currentTab === tab.id ? 'btn-primary shadow text-white' : 'btn-light text-muted'}"
                                data-tab="${tab.id}"
                                onclick="Reportes.setTab('${tab.id}')">
                            <i class="bi ${tab.icon} me-2"></i>${tab.label}
                        </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Área de Contenido -->
                <div id="reportes-content" style="min-height: 400px;">
                    <div class="d-flex justify-content-center align-items-center h-100 pt-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                    </div>
                </div>

                <!-- Modales -->
                ${renderExportModal()}
                ${renderDetailModal()}
            </div>
            <style>
                .hover-scale { transition: transform 0.2s ease-in-out; }
                .hover-scale:hover { transform: translateY(-5px); }
                .cursor-pointer { cursor: pointer; }
                .reportes-tab-btn { transition: all 0.2s ease; border: none; }
                .reportes-tab-btn:hover:not(.btn-primary) { background-color: #e2e8f0; color: #1e293b !important; }
            </style>
        `;

        // Iniciar reloj
        _startClock();

        _renderFilterBar();
    }

    // ==================== DELEGACIÓN DE CONTENIDO ====================

    /**
     * Delega el renderizado del contenido al sub-módulo correspondiente.
     * @param {HTMLElement} container
     */
    function renderDashboardContent(container) {
        const R = window.Reportes || {};
        const subMap = { BIBLIO: R.Biblio, MEDICO: R.Medico, POBLACION: R.Poblacion, VOCACIONAL: R.Vocacional };
        const sub = subMap[_currentArea];

        if (sub && typeof sub.render === 'function') {
            sub.render(container);
        } else {
            // Intentar carga dinámica como fallback
            const fileMap = {
                BIBLIO: 'modules/reportes/reportes-biblio.js',
                MEDICO: 'modules/reportes/reportes-medico.js',
                POBLACION: 'modules/reportes/reportes-poblacion.js',
                VOCACIONAL: 'modules/vocacional-admin.js'
            };
            const src = fileMap[_currentArea];

            console.warn('[Reportes] Sub-modulo no encontrado para', _currentArea,
                '— keys en window.Reportes:', Object.keys(R),
                '— Intentando carga dinamica de', src);

            container.innerHTML = `
                <div class="d-flex justify-content-center align-items-center pt-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando sub-modulo...</span>
                    </div>
                </div>`;

            // Cargar dependencias primero (Charts), luego el sub-módulo
            _dynamicLoadScripts([
                'modules/reportes/reportes-charts.js',
                'modules/reportes/reportes-filters.js',
                src
            ]).then(() => {
                const R2 = window.Reportes || {};

                _renderFilterBar();

                const sub2 = { BIBLIO: R2.Biblio, MEDICO: R2.Medico, POBLACION: R2.Poblacion, VOCACIONAL: R2.Vocacional }[_currentArea];
                if (sub2 && typeof sub2.render === 'function') {
                    console.log('[Reportes] Sub-modulo cargado dinamicamente:', _currentArea);
                    sub2.render(container);
                } else {
                    console.error('[Reportes] Fallo carga dinamica. window.Reportes keys:', Object.keys(window.Reportes || {}));
                    container.innerHTML = `
                        <div class="alert alert-warning rounded-4 shadow-sm">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            No se pudo cargar el sub-modulo de <strong>${AREAS[_currentArea]?.name || _currentArea}</strong>.
                            <br><small class="text-muted">Verifica la consola del navegador (F12) y que los archivos existan en <code>${src}</code>.</small>
                        </div>`;
                }
            });
        }
    }

    /**
     * Carga scripts dinámicamente en secuencia.
     * @param {string[]} srcs - Rutas de los scripts
     * @returns {Promise<void>}
     * @private
     */
    function _dynamicLoadScripts(srcs) {
        return srcs.reduce((chain, src) => {
            return chain.then(() => new Promise((resolve) => {
                // Primero verificar si el archivo es accesible
                const url = '/' + src + '?v=' + Date.now();
                fetch(url).then(resp => {
                    console.log('[Reportes] fetch', src, '→ status:', resp.status,
                        'content-type:', resp.headers.get('content-type'));
                    if (!resp.ok) {
                        console.error('[Reportes] Archivo no encontrado (', resp.status, '):', src);
                        return resolve();
                    }
                    // Cargar como script
                    const s = document.createElement('script');
                    s.src = url;
                    s.onload = () => {
                        console.log('[Reportes] Script ejecutado OK:', src,
                            '→ Biblio:', !!window.Reportes?.Biblio,
                            'Medico:', !!window.Reportes?.Medico,
                            'Poblacion:', !!window.Reportes?.Poblacion);
                        resolve();
                    };
                    s.onerror = (err) => {
                        console.error('[Reportes] Error ejecutando script:', src, err);
                        resolve();
                    };
                    document.head.appendChild(s);
                }).catch(err => {
                    console.error('[Reportes] fetch falló para:', src, err);
                    resolve();
                });
            }));
        }, Promise.resolve());
    }

    // ==================== FILTROS DEMOGRÁFICOS ====================

    /**
     * Aplica los filtros demográficos y re-renderiza el contenido.
     */
    function applyDemoFilters() {
        _filteredData = _applyDemoFiltersToData(_rawData);
        const contentEl = document.getElementById('reportes-content');
        if (contentEl) {
            destroyAllCharts();
            renderDashboardContent(contentEl);
        }
    }

    /**
     * Aplica filtros demográficos a un conjunto de datos.
     * @param {Array} data
     * @returns {Array}
     * @private
     */
    function _applyDemoFiltersToData(data) {
        return data.filter(item => {
            if (_demoFilters.carrera && item.carrera !== _demoFilters.carrera) return false;
            if (_demoFilters.turno && item.turno !== _demoFilters.turno) return false;
            if (_demoFilters.genero && item.genero !== _demoFilters.genero) return false;
            if (_demoFilters.generacion && item.generacion !== parseInt(_demoFilters.generacion)) return false;
            return true;
        });
    }

    // ==================== ACCESO AL ESTADO ====================

    /**
     * Retorna el estado actual para que los sub-módulos puedan leerlo.
     * @returns {Object}
     */
    function getState() {
        return {
            ctx: _ctx,
            currentView: _currentView,
            currentArea: _currentArea,
            currentTab: _currentTab,
            dateStart: _dateStart,
            dateEnd: _dateEnd,
            presetPeriod: _presetPeriod,
            demoFilters: _demoFilters,
            rawData: _rawData,
            filteredData: _filteredData,
            extraData: _extraData,
            areas: AREAS
        };
    }

    /**
     * Retorna el registro de gráficas para que los sub-módulos registren las suyas.
     * @returns {Object}
     */
    function getChartRegistry() {
        return _charts;
    }

    /**
     * Permite a sub-módulos actualizar el estado interno.
     * @param {Object} updates - propiedades a actualizar
     */
    function setState(updates) {
        if (updates.presetPeriod !== undefined) _presetPeriod = updates.presetPeriod;
        if (updates.dateStart !== undefined) _dateStart = updates.dateStart;
        if (updates.dateEnd !== undefined) _dateEnd = updates.dateEnd;
        if (updates.demoFilters !== undefined) _demoFilters = updates.demoFilters;
    }

    // ==================== MODAL DE EXPORTACIÓN ====================

    /**
     * Genera el HTML del modal de configuración de exportación.
     * @returns {string}
     */
    function renderExportModal() {
        return `
        <div class="modal fade" id="exportConfigModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content rounded-4 border-0 shadow">
                    <div class="modal-header border-0 pb-1">
                        <div>
                            <h5 class="modal-title fw-bold mb-0" id="export-modal-title">Exportar Reporte</h5>
                            <small class="text-muted" id="export-modal-area"></small>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body pt-2">
                        <div id="export-context-hint" class="alert alert-light border rounded-3 py-2 px-3 small d-none"></div>
                        <!-- Formato -->
                        <div class="mb-3">
                            <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Formato</label>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-success flex-fill rounded-3 export-format-btn active" data-format="excel">
                                    <i class="bi bi-file-earmark-excel fs-5 d-block mb-1"></i>
                                    <span class="small fw-bold">Excel</span>
                                </button>
                                <button class="btn btn-outline-danger flex-fill rounded-3 export-format-btn" data-format="pdf">
                                    <i class="bi bi-file-earmark-pdf fs-5 d-block mb-1"></i>
                                    <span class="small fw-bold">PDF</span>
                                </button>
                            </div>
                        </div>
                        <!-- Periodo -->
                        <div class="mb-3" id="export-period-block">
                            <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Periodo</label>
                            <select class="form-select form-select-sm rounded-3" id="export-period">
                                <option value="current" selected>Periodo actual del dashboard</option>
                                <option value="daily">Hoy</option>
                                <option value="weekly">Esta semana</option>
                                <option value="monthly">Este mes</option>
                                <option value="quarterly">Trimestre</option>
                                <option value="semester">Semestre</option>
                                <option value="annual">Año completo</option>
                            </select>
                        </div>
                        <!-- Alcance -->
                        <div class="mb-2" id="export-scope-block">
                            <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Incluir</label>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="exportScope" id="export-all" value="all" checked>
                                <label class="form-check-label small" for="export-all">Todo</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="exportScope" id="export-custom" value="custom">
                                <label class="form-check-label small" for="export-custom">Seleccionar</label>
                            </div>
                        </div>
                        <div id="custom-export-options" class="d-none ps-2 mb-2">
                            <div id="export-types-checkboxes" class="d-flex flex-column gap-1"></div>
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-light btn-sm rounded-pill px-3" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary btn-sm rounded-pill px-4" id="confirm-export-btn">
                            <i class="bi bi-download me-1"></i>Descargar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Muestra el modal de exportación con la configuración adecuada.
     * @param {string} format - 'excel' | 'pdf'
     */
    function showExportModal(format) {
        const modal = document.getElementById('exportConfigModal');
        if (!modal) return;
        const exportContext = _getExportContext();
        const types = _getExportTypes();

        // Actualizar título con el área
        const areaTitle = document.getElementById('export-modal-area');
        if (areaTitle) areaTitle.textContent = `${AREAS[_currentArea]?.name || ''} · ${exportContext.tabLabel}`;

        const hintEl = document.getElementById('export-context-hint');
        if (hintEl) {
            const messages = [];
            if (!exportContext.supportsPeriod) {
                messages.push(`La pestaña ${exportContext.tabLabel} se exportará completa; el período no aplica.`);
            }
            if (!exportContext.supportsTypeSelection) {
                messages.push('Se exportará exactamente la pestaña actual.');
            }
            hintEl.classList.toggle('d-none', messages.length === 0);
            hintEl.innerHTML = messages.join('<br>');
        }

        // Seleccionar formato activo
        let _selectedFormat = format || 'excel';
        modal.querySelectorAll('.export-format-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === _selectedFormat);
            btn.onclick = () => {
                _selectedFormat = btn.dataset.format;
                modal.querySelectorAll('.export-format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });

        // Llenar checkboxes según área actual
        const checkboxContainer = document.getElementById('export-types-checkboxes');
        if (checkboxContainer) {
            checkboxContainer.innerHTML = types.map(t => `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${t.value}" id="exp-${t.id}" checked>
                    <label class="form-check-label small" for="exp-${t.id}">${t.label}</label>
                </div>
            `).join('');
        }

        const periodBlock = document.getElementById('export-period-block');
        const periodSelect = document.getElementById('export-period');
        if (periodBlock) periodBlock.classList.toggle('d-none', !exportContext.supportsPeriod);
        if (periodSelect) {
            periodSelect.disabled = !exportContext.supportsPeriod;
            if (!exportContext.supportsPeriod) periodSelect.value = 'current';
        }

        const scopeBlock = document.getElementById('export-scope-block');
        const customOptions = document.getElementById('custom-export-options');
        const exportAllRadio = document.getElementById('export-all');
        if (scopeBlock) scopeBlock.classList.toggle('d-none', !exportContext.supportsTypeSelection);
        if (customOptions) customOptions.classList.add('d-none');
        if (exportAllRadio) exportAllRadio.checked = true;

        // Listeners de radio buttons
        document.querySelectorAll('input[name="exportScope"]').forEach(radio => {
            radio.onchange = (e) => {
                const opts = document.getElementById('custom-export-options');
                if (opts) opts.classList.toggle('d-none', e.target.value === 'all');
            };
        });

        const confirmBtn = document.getElementById('confirm-export-btn');
        if (confirmBtn) {
            confirmBtn.onclick = () => executeExport(_selectedFormat);
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    /**
     * Retorna los tipos de exportación según el área actual.
     * @private
     */
    function _getExportTypes(area = _currentArea, tab = _currentTab) {
        if (area === 'BIBLIO') {
            if (tab === 'visitas') return [{ id: 'visitas', value: 'VISITAS', label: 'Visitas' }];
            if (tab === 'prestamos') return [{ id: 'prestamos', value: 'PRESTAMOS', label: 'Préstamos' }];
            return [];
        } else if (area === 'MEDICO') {
            if (tab === 'perfil') return [];
            return [
                { id: 'medica', value: 'Consulta Médica', label: 'Consulta Medica' },
                { id: 'psico', value: 'Consulta Psicológica', label: 'Consulta Psicologica' }
            ];
        } else if (area === 'POBLACION') {
            return [
                { id: 'estudiantes', value: 'ESTUDIANTE', label: 'Estudiantes' },
                { id: 'docentes', value: 'DOCENTE', label: 'Personal Academico' },
                { id: 'admin', value: 'ADMINISTRATIVO', label: 'Personal Administrativo' },
                { id: 'adminmod', value: 'ADMIN_MODULO', label: 'Admins de Modulo' }
            ];
        }
        return [];
    }

    function _buildSpecialExportPayload(exportContext) {
        if (exportContext.kind === 'catalogo') {
            const catalogo = Array.isArray(_extraData.catalogo) ? _extraData.catalogo : [];
            const categorias = new Set(catalogo.map(item => item.categoria).filter(Boolean));
            const sinCopias = catalogo.filter(item => Number(item.copiasDisponibles || 0) <= 0).length;

            return {
                kind: 'generic',
                title: `Catálogo Bibliográfico`,
                subtitle: AREAS[_currentArea]?.name || 'Reportes',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}`),
                summary: [
                    ['Área', AREAS[_currentArea]?.name || _currentArea],
                    ['Pestaña', exportContext.tabLabel],
                    ['Total títulos', catalogo.length],
                    ['Sin copias disponibles', sinCopias],
                    ['Categorías únicas', categorias.size]
                ],
                columns: ['Título', 'Autor', 'Categoría', 'Copias Disponibles', 'Activo'],
                rows: catalogo.map(item => [
                    item.titulo || 'Sin título',
                    item.autor || 'Desconocido',
                    item.categoria || 'General',
                    item.copiasDisponibles ?? 0,
                    item.active !== false ? 'Sí' : 'No'
                ])
            };
        }

        if (exportContext.kind === 'expedientes') {
            const expedientes = Array.isArray(_extraData.expedientes) ? _extraData.expedientes : [];
            const conCronicas = expedientes.filter(e =>
                e.enfermedadesCronicas && (
                    (Array.isArray(e.enfermedadesCronicas) && e.enfermedadesCronicas.length > 0) ||
                    (typeof e.enfermedadesCronicas === 'string' && e.enfermedadesCronicas.trim() !== '' && e.enfermedadesCronicas.toLowerCase() !== 'ninguna')
                )
            ).length;

            return {
                kind: 'generic',
                title: `Perfil Clínico`,
                subtitle: AREAS[_currentArea]?.name || 'Reportes',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}`),
                summary: [
                    ['Área', AREAS[_currentArea]?.name || _currentArea],
                    ['Pestaña', exportContext.tabLabel],
                    ['Total expedientes', expedientes.length],
                    ['Con condiciones crónicas', conCronicas]
                ],
                columns: ['Paciente', 'Tipo de Sangre', 'Enfermedades Crónicas', 'Alergias', 'Peso', 'Altura', 'Presión', 'Frecuencia Cardiaca'],
                rows: expedientes.map(item => [
                    item.nombre || 'Paciente',
                    item.tipoSangre || 'No especificado',
                    Array.isArray(item.enfermedadesCronicas) ? item.enfermedadesCronicas.join(', ') : (item.enfermedadesCronicas || 'Ninguna'),
                    Array.isArray(item.alergias) ? item.alergias.join(', ') : (item.alergias || 'Ninguna'),
                    item.peso || '--',
                    item.altura || '--',
                    item.presion || '--',
                    item.frecuenciaCardiaca || '--'
                ])
            };
        }

        return {
            kind: 'generic',
            title: exportContext.tabLabel,
            subtitle: AREAS[_currentArea]?.name || 'Reportes',
            filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}`),
            summary: [['Área', AREAS[_currentArea]?.name || _currentArea]],
            columns: [],
            rows: []
        };
    }

    /**
     * Ejecuta la exportación con la configuración seleccionada.
     * @param {string} format - 'excel' | 'pdf'
     */
    async function executeExport(format) {
        const exportContext = _getExportContext();
        let period = document.getElementById('export-period')?.value || 'current';
        const scope = exportContext.supportsTypeSelection
            ? (document.querySelector('input[name="exportScope"]:checked')?.value || 'all')
            : 'all';

        // Si es "current", usar el periodo del dashboard actual
        if (!exportContext.supportsPeriod) {
            period = 'current';
        } else if (period === 'current') {
            period = _presetPeriod;
        }

        let selectedTypes = [];
        if (exportContext.supportsTypeSelection && scope === 'custom') {
            document.querySelectorAll('#export-types-checkboxes input:checked').forEach(cb => {
                selectedTypes.push(cb.value);
            });
        }

        const config = { period, scope, selectedTypes, dateStart: _dateStart, dateEnd: _dateEnd };

        const btn = document.getElementById('confirm-export-btn');
        let oldText = '';
        if (btn) {
            oldText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';
            btn.disabled = true;
        }

        try {
            let exportData;

            if (exportContext.kind !== 'records') {
                exportData = _buildSpecialExportPayload(exportContext);
            } else {
                let sourceData = _rawData;

                // Si el período de exportación difiere del actual, recargar datos
                if (config.period !== _presetPeriod) {
                    const _FilEx = window.Reportes && window.Reportes.Filters;
                    const dateRange = _FilEx
                        ? _FilEx.getDateRange(config.period)
                        : _getDateRange(config.period);
                    sourceData = await ReportesService.getReportData(_ctx, {
                        start: dateRange.start,
                        end: dateRange.end,
                        areas: [_currentArea]
                    });
                }

                sourceData = _applyDemoFiltersToData(sourceData);
                sourceData = _getCurrentTabRecords(sourceData);
                exportData = _applyExportTypeFilters(sourceData, selectedTypes);
            }

            if (scope === 'custom' && exportContext.supportsTypeSelection && selectedTypes.length === 0) {
                throw new Error('Selecciona al menos un tipo para exportar');
            }

            if (!window.ExportUtils) {
                alert('Error: Utilidades de exportacion no disponibles');
                return;
            }

            if (format === 'pdf') {
                await window.ExportUtils.generatePDF(config, exportData, _currentArea);
            } else {
                window.ExportUtils.generateExcel(config, exportData, _currentArea);
            }

            // Cerrar modal
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('exportConfigModal'));
            if (modalInstance) modalInstance.hide();
        } catch (e) {
            console.error('[Reportes] Error de exportacion:', e);
            alert('Error generando reporte: ' + e.message);
        } finally {
            if (btn) {
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
        }
    }

    function renderExportModal() {
        return `
        <div class="modal fade" id="exportConfigModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content rounded-4 border-0 shadow">
                    <div class="modal-header border-0 pb-1">
                        <div>
                            <h5 class="modal-title fw-bold mb-0" id="export-modal-title">Exportar reporte</h5>
                            <small class="text-muted" id="export-modal-area"></small>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body pt-2">
                        <div class="row g-3">
                            <div class="col-lg-7">
                                <div id="export-context-hint" class="alert alert-light border rounded-4 py-2 px-3 small d-none"></div>
                                <div class="card border-0 bg-light rounded-4 mb-3">
                                    <div class="card-body p-3">
                                        <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Formato</label>
                                        <div class="row g-2">
                                            <div class="col-sm-6">
                                                <button class="btn btn-outline-success w-100 h-100 rounded-4 p-3 text-start export-format-btn active" data-format="excel">
                                                    <i class="bi bi-file-earmark-excel fs-4 d-block mb-2"></i>
                                                    <span class="fw-bold d-block">Excel</span>
                                                    <span class="small text-muted">Libro por hojas, filtros y detalle completo.</span>
                                                </button>
                                            </div>
                                            <div class="col-sm-6">
                                                <button class="btn btn-outline-danger w-100 h-100 rounded-4 p-3 text-start export-format-btn" data-format="pdf">
                                                    <i class="bi bi-file-earmark-pdf fs-4 d-block mb-2"></i>
                                                    <span class="fw-bold d-block">PDF</span>
                                                    <span class="small text-muted">Resumen ejecutivo con indicadores y narrativa visual.</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="card border-0 shadow-sm rounded-4">
                                    <div class="card-body p-3 p-lg-4">
                                        <div class="mb-3" id="export-period-block">
                                            <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Periodo</label>
                                            <select class="form-select rounded-4" id="export-period">
                                                <option value="current" selected>Periodo actual del dashboard</option>
                                                <option value="daily">Hoy</option>
                                                <option value="weekly">Esta semana</option>
                                                <option value="monthly">Este mes</option>
                                                <option value="quarterly">Trimestre</option>
                                                <option value="semester">Semestre</option>
                                                <option value="annual">Anio completo</option>
                                            </select>
                                        </div>
                                        <div class="mb-3 d-none" id="export-filter-mode-block">
                                            <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Seleccion de datos</label>
                                            <div class="list-group rounded-4 overflow-hidden border">
                                                <label class="list-group-item border-0 border-bottom d-flex gap-3 align-items-start py-3">
                                                    <input class="form-check-input mt-1" type="radio" name="exportFilterMode" value="current" checked>
                                                    <div>
                                                        <div class="fw-bold small">Vista actual</div>
                                                        <div class="text-muted small">Respeta filtros visibles y la pestana actual.</div>
                                                    </div>
                                                </label>
                                                <label class="list-group-item border-0 d-flex gap-3 align-items-start py-3">
                                                    <input class="form-check-input mt-1" type="radio" name="exportFilterMode" value="period">
                                                    <div>
                                                        <div class="fw-bold small">Periodo completo</div>
                                                        <div class="text-muted small">Incluye todo el periodo sin filtros demograficos activos.</div>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                        <div class="mb-2" id="export-scope-block">
                                            <label class="form-label fw-semibold small text-uppercase text-muted mb-2">Alcance</label>
                                            <div class="d-flex flex-wrap gap-3">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="exportScope" id="export-all" value="all" checked>
                                                    <label class="form-check-label small fw-semibold" for="export-all">Todo lo aplicable</label>
                                                </div>
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" name="exportScope" id="export-custom" value="custom">
                                                    <label class="form-check-label small fw-semibold" for="export-custom">Seleccion manual</label>
                                                </div>
                                            </div>
                                        </div>
                                        <div id="custom-export-options" class="d-none mt-3">
                                            <div class="rounded-4 border bg-light p-3">
                                                <div class="small fw-semibold text-uppercase text-muted mb-2">Tipos incluidos</div>
                                                <div id="export-types-checkboxes" class="d-flex flex-column gap-2"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg-5">
                                <div class="card border-0 rounded-4 h-100" style="background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%);">
                                    <div class="card-body p-3 p-lg-4">
                                        <div class="small fw-semibold text-uppercase text-muted mb-2">Vista previa</div>
                                        <div id="export-preview-content" class="small text-muted">Preparando resumen de exportacion...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-light rounded-pill px-3" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary rounded-pill px-4" id="confirm-export-btn">
                            <i class="bi bi-download me-1"></i>Descargar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function _exportNormalizeValue(value, fallback = '--') {
        if (value === undefined || value === null) return fallback;
        if (value instanceof Date) return value.toLocaleDateString('es-MX');
        if (Array.isArray(value)) {
            const parts = value.map((item) => _exportNormalizeValue(item, '')).filter(Boolean).filter((item) => item !== '--');
            return parts.length ? parts.join(', ') : fallback;
        }
        const text = String(value).trim();
        return text ? text : fallback;
    }

    function _exportSplitValues(value) {
        if (Array.isArray(value)) return value.flatMap((item) => _exportSplitValues(item));
        return String(value || '').split(/[,;/]+/).map((item) => item.trim()).filter(Boolean);
    }

    function _exportMeaningful(value) {
        const text = _exportNormalizeValue(value, '').toLowerCase();
        return !!text && !['--', 'n/a', 'na', 'no especificado', 'sin dato', 'ninguno', 'ninguna'].includes(text);
    }

    function _exportPct(count, total) {
        return total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0.0%';
    }

    function _exportGetPeriodLabel(period) {
        const labels = {
            current: 'Periodo actual',
            daily: 'Hoy',
            weekly: 'Esta semana',
            monthly: 'Este mes',
            quarterly: 'Trimestre',
            semester: 'Semestre',
            annual: 'Anio completo',
            custom: 'Rango personalizado'
        };
        return labels[period] || period || 'Actual';
    }

    function _exportGetActiveFilterEntries() {
        const entries = [];
        if (_demoFilters.carrera) entries.push(['Carrera', _demoFilters.carrera]);
        if (_demoFilters.turno) entries.push(['Turno', _demoFilters.turno]);
        if (_demoFilters.genero) entries.push(['Genero', _demoFilters.genero]);
        if (_demoFilters.generacion) entries.push(['Generacion', _demoFilters.generacion]);
        return entries;
    }

    function _readExportConfig(exportContext) {
        const requestedPeriod = document.getElementById('export-period')?.value || 'current';
        const scope = exportContext.supportsTypeSelection
            ? (document.querySelector('input[name="exportScope"]:checked')?.value || 'all')
            : 'all';
        const supportsFilterMode = exportContext.kind === 'records' && _tabSupportsFilters();
        const filterMode = supportsFilterMode
            ? (document.querySelector('input[name="exportFilterMode"]:checked')?.value || 'current')
            : 'period';

        const selectedTypes = [];
        if (exportContext.supportsTypeSelection && scope === 'custom') {
            document.querySelectorAll('#export-types-checkboxes input:checked').forEach((cb) => selectedTypes.push(cb.value));
        }

        return {
            requestedPeriod,
            period: requestedPeriod === 'current' ? _presetPeriod : requestedPeriod,
            scope,
            selectedTypes,
            filterMode,
            dateStart: _dateStart,
            dateEnd: _dateEnd,
            area: _currentArea,
            areaName: AREAS[_currentArea]?.name || _currentArea,
            tabId: _currentTab,
            tabLabel: exportContext.tabLabel
        };
    }

    function _exportCollectCounts(records, getter, options = {}) {
        const {
            multi = false,
            includeMissing = false,
            missingLabel = 'No especificado'
        } = options;
        const counts = {};

        (Array.isArray(records) ? records : []).forEach((record) => {
            const rawValue = typeof getter === 'function' ? getter(record) : null;
            const values = multi ? _exportSplitValues(rawValue) : [rawValue];

            if (!values.length && includeMissing) {
                counts[missingLabel] = (counts[missingLabel] || 0) + 1;
                return;
            }

            let matched = false;
            values.forEach((value) => {
                const label = _exportNormalizeValue(value, '');
                if (!_exportMeaningful(label)) return;
                matched = true;
                counts[label] = (counts[label] || 0) + 1;
            });

            if (!matched && includeMissing) {
                counts[missingLabel] = (counts[missingLabel] || 0) + 1;
            }
        });

        return counts;
    }

    function _exportBuildSection(title, map, total, options = {}) {
        const {
            headers = ['Valor', 'Cantidad', '%'],
            limit = 10,
            tone = 'primary',
            sorter = null
        } = options;

        let entries = Object.entries(map || {}).filter(([, count]) => Number(count) > 0);
        if (!entries.length) return null;

        if (typeof sorter === 'function') {
            entries.sort(sorter);
        } else {
            entries.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es'));
        }

        if (Number.isFinite(limit) && limit > 0) {
            entries = entries.slice(0, limit);
        }

        return {
            title,
            headers,
            rows: entries.map(([label, count]) => [label, count, _exportPct(count, total)]),
            tone
        };
    }

    function _exportCountUnique(records, getter) {
        const values = new Set();
        (Array.isArray(records) ? records : []).forEach((record) => {
            const value = _exportNormalizeValue(typeof getter === 'function' ? getter(record) : null, '');
            if (_exportMeaningful(value)) values.add(value);
        });
        return values.size;
    }

    function _exportAverage(records, getter, decimals = 1) {
        let total = 0;
        let count = 0;
        (Array.isArray(records) ? records : []).forEach((record) => {
            const value = Number(typeof getter === 'function' ? getter(record) : NaN);
            if (!Number.isFinite(value)) return;
            total += value;
            count += 1;
        });
        if (!count) return null;
        return Number((total / count).toFixed(decimals));
    }

    function _exportSum(records, getter) {
        return (Array.isArray(records) ? records : []).reduce((sum, record) => {
            const value = Number(typeof getter === 'function' ? getter(record) : 0);
            return Number.isFinite(value) ? sum + value : sum;
        }, 0);
    }

    function _exportFormatDate(value, withTime = false) {
        if (!value) return '--';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        const options = withTime
            ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
            : { year: 'numeric', month: '2-digit', day: '2-digit' };
        return date.toLocaleString('es-MX', options);
    }

    function _exportFormatHour(value) {
        if (value === undefined || value === null || value === '') return '--';
        const num = Number.parseInt(value, 10);
        if (Number.isFinite(num)) {
            return `${String(num).padStart(2, '0')}:00`;
        }

        const text = String(value).trim();
        return text || '--';
    }

    function _exportResolveRangeLabel(start, end) {
        if (!(start instanceof Date) && !(end instanceof Date)) return 'Segun periodo seleccionado';
        const from = start instanceof Date ? _exportFormatDate(start) : '--';
        const to = end instanceof Date ? _exportFormatDate(end) : '--';
        return `${from} a ${to}`;
    }

    function _exportDescribeTypes(exportContext, selectedTypes) {
        const available = _getExportTypes();
        if (!exportContext.supportsTypeSelection || !available.length) {
            return exportContext.tabLabel || 'Vista actual';
        }
        if (!Array.isArray(selectedTypes) || !selectedTypes.length) {
            return 'Todos los aplicables';
        }

        const labels = available
            .filter((type) => selectedTypes.includes(type.value))
            .map((type) => type.label);

        return labels.length ? labels.join(', ') : 'Todos los aplicables';
    }

    function _exportBuildSummary(exportContext, records, config, extraRows = []) {
        const filterEntries = config.filterMode === 'current' ? _exportGetActiveFilterEntries() : [];

        return [
            ['Area', config.areaName || AREAS[_currentArea]?.name || _currentArea],
            ['Pestana', exportContext.tabLabel || _getCurrentTabMeta()?.label || '--'],
            ['Periodo', _exportGetPeriodLabel(config.requestedPeriod)],
            ['Seleccion de datos', config.filterMode === 'current' ? 'Vista actual con filtros' : 'Periodo completo'],
            ['Tipos incluidos', _exportDescribeTypes(exportContext, config.selectedTypes)],
            ['Registros exportados', records.length],
            ['Rango', _exportResolveRangeLabel(config.dateStart, config.dateEnd)],
            ['Filtros activos', filterEntries.length ? filterEntries.map(([key, value]) => `${key}: ${value}`).join(' | ') : 'Sin filtros adicionales'],
            ...extraRows
        ];
    }

    function _applyExportSelection(records, exportContext, config) {
        if (exportContext.kind !== 'records') return [];

        let selected = Array.isArray(records) ? [...records] : [];

        if (config.filterMode === 'current' && _tabSupportsFilters()) {
            selected = _applyDemoFiltersToData(selected);
        }

        selected = _getCurrentTabRecords(selected, _currentArea, _currentTab);
        selected = _applyExportTypeFilters(selected, config.selectedTypes);

        return selected;
    }

    function _buildGenericRecordRows(records) {
        return (Array.isArray(records) ? records : []).map((item) => [
            _exportFormatDate(item.fecha),
            _exportFormatHour(item.hora),
            _exportNormalizeValue(item.usuario),
            _exportNormalizeValue(item.matricula),
            _exportNormalizeValue(item.subarea),
            _exportNormalizeValue(item.tipo),
            _exportNormalizeValue(item.status),
            _exportNormalizeValue(item.detalle),
            _exportNormalizeValue(item.diagnostico),
            _exportNormalizeValue(item.profesional),
            _exportNormalizeValue(item.carrera),
            _exportNormalizeValue(item.genero),
            _exportNormalizeValue(item.turno),
            _exportNormalizeValue(item.generacion)
        ]);
    }

    function _renderExportPreview(exportContext) {
        const previewEl = document.getElementById('export-preview-content');
        if (!previewEl) return;

        const config = _readExportConfig(exportContext);
        const filterEntries = config.filterMode === 'current' ? _exportGetActiveFilterEntries() : [];
        const selectedTypesText = _exportDescribeTypes(exportContext, config.selectedTypes);
        const hasValidationError = config.scope === 'custom' && exportContext.supportsTypeSelection && config.selectedTypes.length === 0;

        let estimatedCount = null;
        if (config.requestedPeriod === 'current' && exportContext.kind === 'records') {
            estimatedCount = _applyExportSelection(_rawData, exportContext, config).length;
        }

        const filterHtml = filterEntries.length
            ? filterEntries.map(([label, value]) => `<span class="badge rounded-pill text-bg-light border">${label}: ${value}</span>`).join(' ')
            : '<span class="text-muted">Sin filtros demograficos adicionales.</span>';

        const countHtml = estimatedCount === null
            ? '<div class="small text-muted">El total exacto se recalculara al descargar segun el periodo elegido.</div>'
            : `<div class="display-6 fw-bold text-dark mb-1">${estimatedCount}</div><div class="small text-muted">registros estimados con la configuracion actual</div>`;

        previewEl.innerHTML = `
            <div class="d-flex flex-column gap-3">
                <div>
                    <div class="fw-bold text-dark">${AREAS[_currentArea]?.name || _currentArea}</div>
                    <div class="text-muted">${exportContext.tabLabel || 'Reporte'} · ${_exportGetPeriodLabel(config.requestedPeriod)}</div>
                </div>
                <div class="rounded-4 bg-white border p-3">
                    ${countHtml}
                </div>
                <div>
                    <div class="small fw-semibold text-uppercase text-muted mb-2">Configuracion</div>
                    <div class="small text-dark mb-1"><strong>Datos:</strong> ${config.filterMode === 'current' ? 'Vista actual con filtros' : 'Periodo completo sin filtros demograficos'}</div>
                    <div class="small text-dark mb-1"><strong>Tipos:</strong> ${selectedTypesText}</div>
                    <div class="small text-dark"><strong>Rango:</strong> ${_exportResolveRangeLabel(config.dateStart, config.dateEnd)}</div>
                </div>
                <div>
                    <div class="small fw-semibold text-uppercase text-muted mb-2">Filtros activos</div>
                    <div class="d-flex flex-wrap gap-2">${filterHtml}</div>
                </div>
                ${hasValidationError ? '<div class="alert alert-warning border-0 rounded-4 small mb-0">Selecciona al menos un tipo para continuar.</div>' : ''}
            </div>
        `;
    }

    function showExportModal(format) {
        const modal = document.getElementById('exportConfigModal');
        if (!modal) return;

        const exportContext = _getExportContext();
        const types = _getExportTypes();
        const supportsFilterMode = exportContext.kind === 'records' && _tabSupportsFilters();
        let selectedFormat = format || 'excel';

        const areaTitle = document.getElementById('export-modal-title');
        const areaSubtitle = document.getElementById('export-modal-area');
        const hintEl = document.getElementById('export-context-hint');
        const periodBlock = document.getElementById('export-period-block');
        const periodSelect = document.getElementById('export-period');
        const filterModeBlock = document.getElementById('export-filter-mode-block');
        const scopeBlock = document.getElementById('export-scope-block');
        const customOptions = document.getElementById('custom-export-options');
        const checkboxContainer = document.getElementById('export-types-checkboxes');
        const confirmBtn = document.getElementById('confirm-export-btn');
        const exportAllRadio = document.getElementById('export-all');

        if (areaTitle) areaTitle.textContent = `Exportar ${exportContext.tabLabel}`;
        if (areaSubtitle) areaSubtitle.textContent = `${AREAS[_currentArea]?.name || ''} · Centro de reportes`;

        if (hintEl) {
            const hints = [];
            if (!exportContext.supportsPeriod) {
                hints.push(`La pestana ${exportContext.tabLabel} se exporta completa y no depende del periodo.`);
            }
            if (!supportsFilterMode && exportContext.kind === 'records') {
                hints.push('La exportacion se limita a la pestana activa; los filtros demograficos no aplican aqui.');
            }
            if (exportContext.supportsTypeSelection) {
                hints.push('Puedes exportar todo o solo los tipos que te interesan.');
            }

            hintEl.classList.toggle('d-none', hints.length === 0);
            hintEl.innerHTML = hints.join('<br>');
        }

        modal.querySelectorAll('.export-format-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.format === selectedFormat);
            btn.onclick = () => {
                selectedFormat = btn.dataset.format;
                modal.querySelectorAll('.export-format-btn').forEach((item) => item.classList.remove('active'));
                btn.classList.add('active');
            };
        });

        if (periodBlock) periodBlock.classList.toggle('d-none', !exportContext.supportsPeriod);
        if (periodSelect) {
            periodSelect.disabled = !exportContext.supportsPeriod;
            periodSelect.value = 'current';
            periodSelect.onchange = () => _renderExportPreview(exportContext);
        }

        if (filterModeBlock) filterModeBlock.classList.toggle('d-none', !supportsFilterMode);
        modal.querySelectorAll('input[name="exportFilterMode"]').forEach((radio) => {
            radio.checked = radio.value === 'current';
            radio.onchange = () => _renderExportPreview(exportContext);
        });

        if (scopeBlock) scopeBlock.classList.toggle('d-none', !exportContext.supportsTypeSelection);
        if (customOptions) customOptions.classList.add('d-none');
        if (exportAllRadio) exportAllRadio.checked = true;

        if (checkboxContainer) {
            checkboxContainer.innerHTML = types.map((type) => `
                <label class="form-check d-flex align-items-start gap-2 mb-0">
                    <input class="form-check-input mt-1" type="checkbox" value="${type.value}" id="exp-${type.id}" checked>
                    <span class="small text-dark">${type.label}</span>
                </label>
            `).join('');

            checkboxContainer.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
                checkbox.onchange = () => _renderExportPreview(exportContext);
            });
        }

        modal.querySelectorAll('input[name="exportScope"]').forEach((radio) => {
            radio.onchange = (event) => {
                if (customOptions) customOptions.classList.toggle('d-none', event.target.value !== 'custom');
                _renderExportPreview(exportContext);
            };
        });

        if (confirmBtn) {
            confirmBtn.onclick = () => executeExport(selectedFormat);
        }

        _renderExportPreview(exportContext);
        new bootstrap.Modal(modal).show();
    }

    function _buildBiblioExportPayload(records, exportContext, config) {
        const commonSummary = _exportBuildSummary(exportContext, records, config);

        if (_currentTab === 'prestamos') {
            const activos = records.filter((item) => ['Activo', 'Pendiente', 'Retraso'].includes(item.status)).length;
            const retraso = records.filter((item) => item.status === 'Retraso').length;
            const noRecogido = records.filter((item) => item.status === 'No recogido').length;
            const deudaTotal = _exportSum(records, (item) => item.montoDeuda || item.multaActual || 0);
            const sections = [
                _exportBuildSection('Estado de prestamos', _exportCollectCounts(records, (item) => item.status), records.length, { tone: 'warning', limit: 8 }),
                _exportBuildSection('Titulos mas solicitados', _exportCollectCounts(records, (item) => item.detalle), records.length, { tone: 'primary', limit: 12 }),
                _exportBuildSection('Origen del prestamo', _exportCollectCounts(records, (item) => item.origenPrestamo), records.length, { tone: 'accent', limit: 6 }),
                _exportBuildSection('Carreras con mas movimiento', _exportCollectCounts(records, (item) => item.carrera), records.length, { tone: 'success', limit: 10 })
            ].filter(Boolean);

            const rows = records.map((item) => [
                _exportFormatDate(item.fecha),
                _exportNormalizeValue(item.usuario),
                _exportNormalizeValue(item.matricula),
                _exportNormalizeValue(item.carrera),
                _exportNormalizeValue(item.detalle),
                _exportNormalizeValue(item.status),
                _exportFormatDate(item.fechaVencimiento),
                _exportFormatDate(item.fechaDevolucionReal),
                Number(item.multaActual || item.montoDeuda || 0).toFixed(2),
                _exportNormalizeValue(item.extensiones ?? 0, '0'),
                _exportNormalizeValue(item.origenPrestamo)
            ]);

            return {
                kind: 'generic',
                title: `${AREAS[_currentArea]?.name || 'Biblioteca'} · Prestamos`,
                subtitle: 'Exportacion ejecutiva de movimientos bibliograficos',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
                summary: commonSummary,
                highlights: [
                    { label: 'Prestamos', value: records.length.toLocaleString('es-MX'), hint: 'Registros exportados' },
                    { label: 'Titulos unicos', value: _exportCountUnique(records, (item) => item.detalle).toLocaleString('es-MX'), hint: 'Material distinto solicitado' },
                    { label: 'Activos', value: activos.toLocaleString('es-MX'), hint: 'Prestamos vigentes o pendientes' },
                    { label: 'Con retraso', value: retraso.toLocaleString('es-MX'), hint: 'Prestamos fuera de fecha' },
                    { label: 'No recogido', value: noRecogido.toLocaleString('es-MX'), hint: 'Solicitudes no completadas' },
                    { label: 'Deuda estimada', value: `$${deudaTotal.toFixed(2)}`, hint: 'Multa actual o deuda registrada' }
                ],
                sections,
                dataTitle: 'Detalle de prestamos',
                detailSheetName: 'Prestamos',
                columns: ['Fecha', 'Usuario', 'Matricula', 'Carrera', 'Titulo', 'Estado', 'Vencimiento', 'Devolucion', 'Monto', 'Extensiones', 'Origen'],
                rows,
                pdfRows: rows.slice(0, 80),
                notes: [
                    'El PDF resume indicadores y muestra una muestra operativa del detalle.',
                    'El archivo Excel conserva el universo completo de registros exportados.'
                ]
            };
        }

        const avgStay = _exportAverage(records, (item) => item.duracionMin, 0);
        const sections = [
            _exportBuildSection('Motivos de visita', _exportCollectCounts(records, (item) => item.tipo || item.detalle), records.length, { tone: 'warning', limit: 10 }),
            _exportBuildSection('Estado de visita', _exportCollectCounts(records, (item) => item.status), records.length, { tone: 'success', limit: 6 }),
            _exportBuildSection('Carreras con mas visitas', _exportCollectCounts(records, (item) => item.carrera), records.length, { tone: 'primary', limit: 10 }),
            _exportBuildSection('Horas de mayor afluencia', _exportCollectCounts(records, (item) => _exportFormatHour(item.hora)), records.length, {
                tone: 'accent',
                limit: 8,
                sorter: (a, b) => String(a[0]).localeCompare(String(b[0]), 'es')
            })
        ].filter(Boolean);

        const rows = records.map((item) => [
            _exportFormatDate(item.fecha),
            _exportFormatHour(item.hora),
            _exportNormalizeValue(item.usuario),
            _exportNormalizeValue(item.matricula),
            _exportNormalizeValue(item.carrera),
            _exportNormalizeValue(item.genero),
            _exportNormalizeValue(item.tipo),
            _exportNormalizeValue(item.detalle),
            _exportNormalizeValue(item.status),
            _exportFormatDate(item.salida, true),
            item.duracionMin ?? '--',
            item.esGrupal ? `Si (${item.cantidadGrupo || 1})` : 'No'
        ]);

        return {
            kind: 'generic',
            title: `${AREAS[_currentArea]?.name || 'Biblioteca'} · Visitas`,
            subtitle: 'Exportacion ejecutiva de trafico y uso de espacios',
            filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
            summary: commonSummary,
            highlights: [
                { label: 'Visitas', value: records.length.toLocaleString('es-MX'), hint: 'Registros exportados' },
                { label: 'Usuarios unicos', value: _exportCountUnique(records, (item) => item._uid || item.matricula || item.usuario).toLocaleString('es-MX'), hint: 'Personas distintas identificadas' },
                { label: 'Grupales', value: records.filter((item) => item.esGrupal).length.toLocaleString('es-MX'), hint: 'Visitas con usuarios relacionados' },
                { label: 'Duracion prom.', value: avgStay === null ? '--' : `${avgStay} min`, hint: 'Solo visitas con salida registrada' },
                { label: 'En curso', value: records.filter((item) => String(item.status).toLowerCase().includes('curso')).length.toLocaleString('es-MX'), hint: 'Sin salida confirmada' }
            ],
            sections,
            dataTitle: 'Detalle de visitas',
            detailSheetName: 'Visitas',
            columns: ['Fecha', 'Hora', 'Usuario', 'Matricula', 'Carrera', 'Genero', 'Motivo', 'Servicios', 'Estado', 'Salida', 'Duracion min', 'Visita grupal'],
            rows,
            pdfRows: rows.slice(0, 80),
            notes: [
                'La muestra PDF prioriza lectura ejecutiva y deja el detalle completo para Excel.',
                'Las filas conservan los datos operativos tal como se normalizaron desde reportes.'
            ]
        };
    }

    function _buildMedicoExportPayload(records, exportContext, config) {
        const closedRecords = records.filter((record) => _isClosedMedicalRecord(record));
        const categorizer = window.Reportes?.Medico?.categorizeSimilar;
        const diagnosticSource = closedRecords.filter((item) => _exportMeaningful(item.diagnostico || item.detalle));

        const diagnosticMap = _exportCollectCounts(diagnosticSource, (item) => {
            const value = item.diagnostico || item.detalle;
            return typeof categorizer === 'function' ? categorizer(value) : value;
        });

        const commonSummary = _exportBuildSummary(exportContext, records, config, [
            ['Consultas cerradas', closedRecords.length]
        ]);
        const sections = [
            _exportBuildSection('Tipo de atencion', _exportCollectCounts(records, (item) => item.tipo), records.length, { tone: 'primary', limit: 6 }),
            _exportBuildSection('Estado de atencion', _exportCollectCounts(records, (item) => item.status), records.length, { tone: 'accent', limit: 8 }),
            _exportBuildSection('Profesionales con mas carga', _exportCollectCounts(records, (item) => item.profesional), records.length, { tone: 'success', limit: 10 }),
            _exportBuildSection('Carreras atendidas', _exportCollectCounts(records, (item) => item.carrera), records.length, { tone: 'warning', limit: 10 }),
            _exportBuildSection('Diagnosticos agrupados', diagnosticMap, diagnosticSource.length || records.length, { tone: 'danger', limit: 12 })
        ].filter(Boolean);

        const rows = records.map((item) => [
            _exportFormatDate(item.fecha),
            _exportFormatHour(item.hora),
            _exportNormalizeValue(item.usuario),
            _exportNormalizeValue(item.matricula),
            _exportNormalizeValue(item.tipo),
            _exportNormalizeValue(item.subarea),
            _exportNormalizeValue(item.detalle),
            _exportNormalizeValue(item.diagnostico),
            _exportNormalizeValue(item.status),
            _exportNormalizeValue(item.profesional),
            _exportNormalizeValue(item.carrera),
            _exportNormalizeValue(item.genero),
            _exportNormalizeValue(item.turno)
        ]);

        const titleSuffix = _currentTab === 'diagnosticos' ? 'Diagnosticos' : 'Consultas';
        return {
            kind: 'generic',
            title: `${AREAS[_currentArea]?.name || 'Servicios Medicos'} · ${titleSuffix}`,
            subtitle: 'Exportacion ejecutiva clinica y psicopedagogica',
            filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
            summary: commonSummary,
            highlights: [
                { label: 'Atenciones', value: records.length.toLocaleString('es-MX'), hint: 'Citas exportadas' },
                { label: 'Pacientes unicos', value: _exportCountUnique(records, (item) => item._uid || item.matricula || item.usuario).toLocaleString('es-MX'), hint: 'Personas distintas atendidas' },
                { label: 'Medicas', value: records.filter((item) => item.tipo === 'Consulta Médica' || item.tipo === 'Consulta MÃ©dica').length.toLocaleString('es-MX'), hint: 'Consulta medica general' },
                { label: 'Psicologicas', value: records.filter((item) => item.tipo === 'Consulta Psicológica' || item.tipo === 'Consulta PsicolÃ³gica').length.toLocaleString('es-MX'), hint: 'Consulta psicologica' },
                { label: 'Cerradas', value: closedRecords.length.toLocaleString('es-MX'), hint: 'Con estado final' },
                { label: 'Diag. agrupados', value: Object.keys(diagnosticMap).length.toLocaleString('es-MX'), hint: 'Categorias clinicas detectadas' }
            ],
            sections,
            dataTitle: _currentTab === 'diagnosticos' ? 'Detalle clinico para diagnosticos' : 'Detalle de consultas',
            detailSheetName: _currentTab === 'diagnosticos' ? 'Diagnosticos' : 'Consultas',
            columns: ['Fecha', 'Hora', 'Paciente', 'Matricula', 'Tipo', 'Subarea', 'Motivo', 'Diagnostico', 'Estado', 'Profesional', 'Carrera', 'Genero', 'Turno'],
            rows,
            pdfRows: rows.slice(0, 80),
            notes: [
                'Los diagnosticos agrupados consideran solo consultas cerradas para evitar mezclar pendientes con cierres clinicos.',
                'Excel conserva el detalle completo del universo exportado.'
            ]
        };
    }

    function _buildPoblacionExportPayload(records, exportContext, config) {
        const commonSummary = _exportBuildSummary(exportContext, records, config);

        if (_currentTab === 'salud') {
            const conDiscapacidad = records.filter((item) => Array.isArray(item.discapacidades) && item.discapacidades.length > 0).length;
            const conCronica = records.filter((item) => _exportSplitValues(item.enfermedadCronica).some((value) => _exportMeaningful(value))).length;
            const apoyoPsico = records.filter((item) => String(item.apoyoPsico || '').toLowerCase().startsWith('s')).length;
            const sections = [
                _exportBuildSection('Tipos de discapacidad', _exportCollectCounts(records, (item) => item.discapacidades, { multi: true }), records.length, { tone: 'info', limit: 12 }),
                _exportBuildSection('Condiciones cronicas', _exportCollectCounts(records, (item) => item.enfermedadCronica, { multi: true }), records.length, { tone: 'danger', limit: 12 }),
                _exportBuildSection('Alergias frecuentes', _exportCollectCounts(records, (item) => item.alergia, { multi: true }), records.length, { tone: 'warning', limit: 12 }),
                _exportBuildSection('Apoyo psicologico', _exportCollectCounts(records, (item) => item.apoyoPsico, { includeMissing: true, missingLabel: 'No' }), records.length, { tone: 'accent', limit: 4 })
            ].filter(Boolean);

            const rows = records.map((item) => [
                _exportNormalizeValue(item.usuario),
                _exportNormalizeValue(item.matricula),
                _exportNormalizeValue(item.subarea),
                _exportNormalizeValue(item.usaLentes),
                _exportNormalizeValue(item.discapacidades),
                _exportNormalizeValue(item.enfermedadCronica),
                _exportNormalizeValue(item.alergia),
                _exportNormalizeValue(item.apoyoPsico),
                _exportNormalizeValue(item.genero),
                _exportNormalizeValue(item.carrera)
            ]);

            return {
                kind: 'generic',
                title: `${AREAS[_currentArea]?.name || 'Poblacion SIA'} · Salud`,
                subtitle: 'Exportacion ejecutiva de indicadores de salud y seguimiento',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
                summary: commonSummary,
                highlights: [
                    { label: 'Poblacion', value: records.length.toLocaleString('es-MX'), hint: 'Perfiles analizados' },
                    { label: 'Usa lentes', value: records.filter((item) => String(item.usaLentes || '').toLowerCase().startsWith('s')).length.toLocaleString('es-MX'), hint: 'Apoyo visual detectado' },
                    { label: 'Discapacidad', value: conDiscapacidad.toLocaleString('es-MX'), hint: 'Con al menos una discapacidad registrada' },
                    { label: 'Cronica', value: conCronica.toLocaleString('es-MX'), hint: 'Con condicion cronica capturada' },
                    { label: 'Apoyo psico', value: apoyoPsico.toLocaleString('es-MX'), hint: 'Con necesidad de apoyo psicologico' }
                ],
                sections,
                dataTitle: 'Detalle de salud poblacional',
                detailSheetName: 'Salud',
                columns: ['Nombre', 'Matricula', 'Subarea', 'Usa lentes', 'Discapacidades', 'Condicion cronica', 'Alergias', 'Apoyo psicologico', 'Genero', 'Carrera'],
                rows,
                pdfRows: rows.slice(0, 80),
                notes: [
                    'Las listas multiples se normalizan para evitar agrupar valores concatenados como una sola categoria.',
                    'Los totales conservan el detalle completo en Excel.'
                ]
            };
        }

        if (_currentTab === 'socioeconomico') {
            const becados = records.filter((item) => _exportNormalizeValue(item.beca, 'No') !== 'No').length;
            const trabajan = records.filter((item) => String(item.trabaja || '').toLowerCase().startsWith('s')).length;
            const idiomas = records.filter((item) => _exportNormalizeValue(item.idiomas, 'Ninguno') !== 'Ninguno').length;
            const colonias = _exportCountUnique(records, (item) => item.colonia === 'No especificada' ? '' : item.colonia);
            const sections = [
                _exportBuildSection('Estado de beca', _exportCollectCounts(records, (item) => item.beca, { includeMissing: true, missingLabel: 'No' }), records.length, { tone: 'success', limit: 8 }),
                _exportBuildSection('Situacion laboral', _exportCollectCounts(records, (item) => item.trabaja, { includeMissing: true, missingLabel: 'No' }), records.length, { tone: 'primary', limit: 4 }),
                _exportBuildSection('Idiomas extra', _exportCollectCounts(records, (item) => item.idiomas, { multi: true }), records.length, { tone: 'accent', limit: 12 }),
                _exportBuildSection('Colonias con mayor presencia', _exportCollectCounts(records, (item) => item.colonia === 'No especificada' ? '' : item.colonia), records.length, { tone: 'warning', limit: 12 }),
                _exportBuildSection('Dependientes', _exportCollectCounts(records, (item) => item.dependientes, { includeMissing: true, missingLabel: 'No' }), records.length, { tone: 'secondary', limit: 4 })
            ].filter(Boolean);

            const rows = records.map((item) => [
                _exportNormalizeValue(item.usuario),
                _exportNormalizeValue(item.matricula),
                _exportNormalizeValue(item.subarea),
                _exportNormalizeValue(item.beca),
                _exportNormalizeValue(item.trabaja),
                _exportNormalizeValue(item.idiomas),
                _exportNormalizeValue(item.colonia),
                _exportNormalizeValue(item.dependientes),
                _exportNormalizeValue(item.carrera),
                _exportNormalizeValue(item.turno)
            ]);

            return {
                kind: 'generic',
                title: `${AREAS[_currentArea]?.name || 'Poblacion SIA'} · Socioeconomico`,
                subtitle: 'Exportacion ejecutiva de contexto social y economico',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
                summary: commonSummary,
                highlights: [
                    { label: 'Poblacion', value: records.length.toLocaleString('es-MX'), hint: 'Perfiles exportados' },
                    { label: 'Becados', value: becados.toLocaleString('es-MX'), hint: 'Con beca distinta a No' },
                    { label: 'Trabajan', value: trabajan.toLocaleString('es-MX'), hint: 'Actividad laboral reportada' },
                    { label: 'Idiomas', value: idiomas.toLocaleString('es-MX'), hint: 'Con idioma extra o dialecto' },
                    { label: 'Colonias', value: colonias.toLocaleString('es-MX'), hint: 'Colonias distintas detectadas' }
                ],
                sections,
                dataTitle: 'Detalle socioeconomico',
                detailSheetName: 'Socioeconomico',
                columns: ['Nombre', 'Matricula', 'Subarea', 'Beca', 'Trabaja', 'Idiomas', 'Colonia', 'Dependientes', 'Carrera', 'Turno'],
                rows,
                pdfRows: rows.slice(0, 80),
                notes: [
                    'La seccion de idiomas separa listas multiples para reflejar cada idioma como categoria propia.',
                    'Las colonias sin texto util se excluyen de los rankings y permanecen visibles en el detalle.'
                ]
            };
        }

        const sections = [
            _exportBuildSection('Distribucion por subarea', _exportCollectCounts(records, (item) => item.subarea, { includeMissing: true }), records.length, { tone: 'success', limit: 8 }),
            _exportBuildSection('Carreras con mayor poblacion', _exportCollectCounts(records, (item) => item.carrera), records.length, { tone: 'primary', limit: 12 }),
            _exportBuildSection('Genero', _exportCollectCounts(records, (item) => item.genero, { includeMissing: true }), records.length, { tone: 'accent', limit: 8 }),
            _exportBuildSection('Generacion', _exportCollectCounts(records, (item) => item.generacion), records.length, {
                tone: 'warning',
                limit: 12,
                sorter: (a, b) => String(b[0]).localeCompare(String(a[0]), 'es')
            }),
            _exportBuildSection('Turno', _exportCollectCounts(records, (item) => item.turno), records.length, { tone: 'info', limit: 6 }),
            _exportBuildSection('Estado civil', _exportCollectCounts(records, (item) => item.estadoCivil), records.length, { tone: 'secondary', limit: 8 })
        ].filter(Boolean);

        const rows = records.map((item) => [
            _exportNormalizeValue(item.usuario),
            _exportNormalizeValue(item.matricula),
            _exportNormalizeValue(item.subarea),
            _exportNormalizeValue(item.carrera),
            _exportNormalizeValue(item.genero),
            _exportNormalizeValue(item.turno),
            _exportNormalizeValue(item.generacion),
            _exportNormalizeValue(item.estadoCivil),
            _exportNormalizeValue(item.dependientes),
            _exportNormalizeValue(item.colonia),
            _exportFormatDate(item.fecha)
        ]);

        return {
            kind: 'generic',
            title: `${AREAS[_currentArea]?.name || 'Poblacion SIA'} · Demografia`,
            subtitle: 'Exportacion ejecutiva de composicion poblacional',
            filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
            summary: commonSummary,
            highlights: [
                { label: 'Usuarios', value: records.length.toLocaleString('es-MX'), hint: 'Perfiles exportados' },
                { label: 'Estudiantes', value: records.filter((item) => item.subarea === 'ESTUDIANTE').length.toLocaleString('es-MX'), hint: 'Poblacion estudiantil' },
                { label: 'Docentes', value: records.filter((item) => item.subarea === 'DOCENTE').length.toLocaleString('es-MX'), hint: 'Personal academico' },
                { label: 'Administrativos', value: records.filter((item) => item.subarea === 'ADMINISTRATIVO').length.toLocaleString('es-MX'), hint: 'Personal administrativo' },
                { label: 'Admins modulo', value: records.filter((item) => item.subarea === 'ADMIN_MODULO').length.toLocaleString('es-MX'), hint: 'Roles administrativos del sistema' }
            ],
            sections,
            dataTitle: 'Detalle demografico',
            detailSheetName: 'Demografia',
            columns: ['Nombre', 'Matricula', 'Subarea', 'Carrera', 'Genero', 'Turno', 'Generacion', 'Estado civil', 'Dependientes', 'Colonia', 'Registro'],
            rows,
            pdfRows: rows.slice(0, 80),
            notes: [
                'Los rankings excluyen valores vacios o no especificados para priorizar informacion util.',
                'El detalle conserva todas las filas del conjunto exportado.'
            ]
        };
    }

    function _buildRecordExportPayload(records, exportContext, config) {
        if (_currentArea === 'BIBLIO') {
            return _buildBiblioExportPayload(records, exportContext, config);
        }
        if (_currentArea === 'MEDICO') {
            return _buildMedicoExportPayload(records, exportContext, config);
        }
        if (_currentArea === 'POBLACION') {
            return _buildPoblacionExportPayload(records, exportContext, config);
        }

        const summary = _exportBuildSummary(exportContext, records, config);
        const rows = _buildGenericRecordRows(records);
        return {
            kind: 'generic',
            title: `${AREAS[_currentArea]?.name || _currentArea} · ${exportContext.tabLabel}`,
            subtitle: 'Exportacion ejecutiva',
            filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}_${config.requestedPeriod}`),
            summary,
            highlights: [
                { label: 'Registros', value: records.length.toLocaleString('es-MX'), hint: 'Filas exportadas' }
            ],
            sections: [],
            dataTitle: 'Detalle',
            detailSheetName: 'Detalle',
            columns: ['Fecha', 'Hora', 'Usuario', 'Matricula', 'Subarea', 'Tipo', 'Estado', 'Detalle', 'Diagnostico', 'Profesional', 'Carrera', 'Genero', 'Turno', 'Generacion'],
            rows,
            pdfRows: rows.slice(0, 80),
            notes: ['La exportacion usa un formato generico al no existir una plantilla especifica para esta vista.']
        };
    }

    function _buildSpecialExportPayload(exportContext, config = {}) {
        if (exportContext.kind === 'catalogo') {
            const catalogo = Array.isArray(_extraData.catalogo) ? _extraData.catalogo : [];
            const activos = Array.isArray(_extraData.activos) ? _extraData.activos : [];
            const categorias = _exportCollectCounts(catalogo, (item) => item.categoria);
            const disponibilidad = {
                'Con disponibilidad': catalogo.filter((item) => Number(item.copiasDisponibles || 0) > 0).length,
                'Sin copias': catalogo.filter((item) => Number(item.copiasDisponibles || 0) <= 0).length,
                'Inactivos': catalogo.filter((item) => item.active === false).length
            };
            const activosStatus = _exportCollectCounts(activos, (item) => item.status, { includeMissing: true, missingLabel: 'Sin estado' });
            const rows = catalogo.map((item) => [
                _exportNormalizeValue(item.titulo),
                _exportNormalizeValue(item.autor),
                _exportNormalizeValue(item.categoria),
                item.copiasDisponibles ?? 0,
                item.active === false ? 'Inactivo' : 'Activo'
            ]);

            return {
                kind: 'generic',
                title: 'Biblioteca · Catalogo',
                subtitle: 'Panorama editorial y disponibilidad del acervo',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}`),
                summary: _exportBuildSummary(exportContext, catalogo, {
                    ...config,
                    requestedPeriod: config.requestedPeriod || 'current',
                    areaName: AREAS[_currentArea]?.name || _currentArea,
                    filterMode: 'period',
                    selectedTypes: []
                }, [
                    ['Activos registrados', activos.length]
                ]),
                highlights: [
                    { label: 'Titulos', value: catalogo.length.toLocaleString('es-MX'), hint: 'Registros de catalogo' },
                    { label: 'Categorias', value: Object.keys(categorias).length.toLocaleString('es-MX'), hint: 'Categorias unicas' },
                    { label: 'Activos', value: catalogo.filter((item) => item.active !== false).length.toLocaleString('es-MX'), hint: 'Titulos activos' },
                    { label: 'Sin copias', value: disponibilidad['Sin copias'].toLocaleString('es-MX'), hint: 'No disponibles al momento' }
                ],
                sections: [
                    _exportBuildSection('Categorias con mas volumen', categorias, catalogo.length, { tone: 'warning', limit: 12 }),
                    _exportBuildSection('Disponibilidad del catalogo', disponibilidad, catalogo.length, { tone: 'primary', limit: 6 }),
                    _exportBuildSection('Estado de activos de biblioteca', activosStatus, activos.length || 1, { tone: 'accent', limit: 8 })
                ].filter(Boolean),
                dataTitle: 'Detalle de catalogo',
                detailSheetName: 'Catalogo',
                columns: ['Titulo', 'Autor', 'Categoria', 'Copias disponibles', 'Estado'],
                rows,
                pdfRows: rows.slice(0, 80),
                notes: [
                    'El resumen combina catalogo bibliografico y estado de activos cuando esa informacion esta cargada.',
                    'Excel conserva todos los titulos del catalogo.'
                ]
            };
        }

        if (exportContext.kind === 'expedientes') {
            const expedientes = Array.isArray(_extraData.expedientes) ? _extraData.expedientes : [];
            const cronicas = _exportCollectCounts(expedientes, (item) => item.enfermedadesCronicas, { multi: true });
            const alergias = _exportCollectCounts(expedientes, (item) => item.alergias, { multi: true });
            const tiposSangre = _exportCollectCounts(expedientes, (item) => item.tipoSangre);
            const rows = expedientes.map((item) => [
                _exportNormalizeValue(item.nombre),
                _exportNormalizeValue(item.tipoSangre),
                _exportNormalizeValue(item.enfermedadesCronicas),
                _exportNormalizeValue(item.alergias),
                _exportNormalizeValue(item.peso),
                _exportNormalizeValue(item.altura),
                _exportNormalizeValue(item.presion),
                _exportNormalizeValue(item.frecuenciaCardiaca)
            ]);

            return {
                kind: 'generic',
                title: 'Servicios Medicos · Perfil clinico',
                subtitle: 'Panorama consolidado de expedientes clinicos',
                filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}`),
                summary: _exportBuildSummary(exportContext, expedientes, {
                    ...config,
                    requestedPeriod: config.requestedPeriod || 'current',
                    areaName: AREAS[_currentArea]?.name || _currentArea,
                    filterMode: 'period',
                    selectedTypes: []
                }),
                highlights: [
                    { label: 'Expedientes', value: expedientes.length.toLocaleString('es-MX'), hint: 'Perfiles clinicos cargados' },
                    { label: 'Cronicas', value: expedientes.filter((item) => _exportSplitValues(item.enfermedadesCronicas).some((value) => _exportMeaningful(value))).length.toLocaleString('es-MX'), hint: 'Con condicion cronica registrada' },
                    { label: 'Alergias', value: expedientes.filter((item) => _exportSplitValues(item.alergias).some((value) => _exportMeaningful(value))).length.toLocaleString('es-MX'), hint: 'Con alergia capturada' },
                    { label: 'Tipos sangre', value: Object.keys(tiposSangre).length.toLocaleString('es-MX'), hint: 'Diversidad de tipos reportados' }
                ],
                sections: [
                    _exportBuildSection('Tipos de sangre', tiposSangre, expedientes.length, { tone: 'danger', limit: 10 }),
                    _exportBuildSection('Condiciones cronicas', cronicas, expedientes.length, { tone: 'warning', limit: 12 }),
                    _exportBuildSection('Alergias frecuentes', alergias, expedientes.length, { tone: 'accent', limit: 12 })
                ].filter(Boolean),
                dataTitle: 'Detalle de expedientes',
                detailSheetName: 'Expedientes',
                columns: ['Paciente', 'Tipo de sangre', 'Condiciones cronicas', 'Alergias', 'Peso', 'Altura', 'Presion', 'Frecuencia cardiaca'],
                rows,
                pdfRows: rows.slice(0, 80),
                notes: [
                    'Las condiciones y alergias se separan por lista para reflejar cada categoria clinica correctamente.',
                    'El detalle Excel conserva todos los expedientes cargados en la vista.'
                ]
            };
        }

        return {
            kind: 'generic',
            title: exportContext.tabLabel,
            subtitle: AREAS[_currentArea]?.name || 'Reportes',
            filenameBase: _sanitizeFileName(`Reporte_${_currentArea}_${_currentTab}`),
            summary: _exportBuildSummary(exportContext, [], {
                ...config,
                requestedPeriod: config.requestedPeriod || 'current',
                areaName: AREAS[_currentArea]?.name || _currentArea,
                filterMode: 'period',
                selectedTypes: []
            }),
            highlights: [],
            sections: [],
            dataTitle: 'Detalle',
            detailSheetName: 'Detalle',
            columns: [],
            rows: [],
            pdfRows: [],
            notes: ['No se encontro una configuracion especifica para esta exportacion.']
        };
    }

    async function executeExport(format) {
        const exportContext = _getExportContext();
        const config = _readExportConfig(exportContext);

        const btn = document.getElementById('confirm-export-btn');
        const originalText = btn?.innerHTML || '';
        if (btn) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';
            btn.disabled = true;
        }

        try {
            if (!window.ExportUtils) {
                throw new Error('Utilidades de exportacion no disponibles');
            }

            if (config.scope === 'custom' && exportContext.supportsTypeSelection && config.selectedTypes.length === 0) {
                throw new Error('Selecciona al menos un tipo para exportar');
            }

            let payload;
            if (exportContext.kind !== 'records') {
                payload = _buildSpecialExportPayload(exportContext, config);
            } else {
                let sourceData = _rawData;

                if (config.requestedPeriod !== 'current') {
                    const filtersModule = window.Reportes && window.Reportes.Filters;
                    const dateRange = filtersModule?.getDateRange
                        ? filtersModule.getDateRange(config.period)
                        : _getDateRange(config.period);
                    sourceData = await ReportesService.getReportData(_ctx, {
                        start: dateRange.start,
                        end: dateRange.end,
                        areas: [_currentArea]
                    });
                    config.dateStart = dateRange.start;
                    config.dateEnd = dateRange.end;
                } else if (!(config.dateStart instanceof Date) || !(config.dateEnd instanceof Date)) {
                    const currentRange = _getDateRange(_presetPeriod);
                    config.dateStart = currentRange.start;
                    config.dateEnd = currentRange.end;
                }

                const selectedRecords = _applyExportSelection(sourceData, exportContext, config);
                payload = _buildRecordExportPayload(selectedRecords, exportContext, config);
            }

            if (format === 'pdf') {
                await window.ExportUtils.generatePDF(config, payload, _currentArea);
            } else {
                window.ExportUtils.generateExcel(config, payload, _currentArea);
            }

            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('exportConfigModal'));
            if (modalInstance) modalInstance.hide();
        } catch (e) {
            console.error('[Reportes] Error de exportacion:', e);
            alert('Error generando reporte: ' + e.message);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }

    // ==================== MODAL DE DETALLE ====================

    /**
     * Genera el HTML del modal de detalle por drill-down.
     * @returns {string}
     */
    function renderDetailModal() {
        return `
        <div class="modal fade" id="cardDetailModal" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content rounded-4">
                    <div class="modal-header border-0">
                        <div class="flex-grow-1">
                            <h5 class="modal-title fw-bold mb-1" id="detail-modal-title">Detalle</h5>
                            <p class="text-muted small mb-0" id="detail-modal-subtitle">--</p>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Filtros de dimensión -->
                        <div class="d-flex gap-2 mb-4 flex-wrap" id="detail-modal-filters">
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="genero">
                                <i class="bi bi-gender-ambiguous me-1"></i>Genero
                            </button>
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="carrera">
                                <i class="bi bi-mortarboard me-1"></i>Carrera
                            </button>
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="turno">
                                <i class="bi bi-clock me-1"></i>Turno
                            </button>
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="generacion">
                                <i class="bi bi-calendar-event me-1"></i>Generacion
                            </button>
                        </div>
                        <!-- Gráficas del modal -->
                        <div class="row g-4" id="detail-modal-charts"></div>
                    </div>
                    <div class="modal-footer border-0">
                        <button class="btn btn-outline-success rounded-pill" onclick="Reportes.exportModalData('excel')">
                            <i class="bi bi-file-earmark-excel me-1"></i>Exportar Excel
                        </button>
                        <button class="btn btn-outline-danger rounded-pill" onclick="Reportes.exportModalData('pdf')">
                            <i class="bi bi-file-earmark-pdf me-1"></i>Exportar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Abre el modal de detalle con gráficas desglosadas por dimensión.
     * @param {string} category - Nombre de la categoría
     * @param {Array} data - Datos filtrados para esa categoría
     */
    function openCardDetailModal(category, data) {
        const modal = document.getElementById('cardDetailModal');
        if (!modal) return;
        _modalDetailState = {
            category,
            data: Array.isArray(data) ? data : [],
            activeFilters: new Set(['genero', 'carrera', 'turno', 'generacion'])
        };

        const title = document.getElementById('detail-modal-title');
        const subtitle = document.getElementById('detail-modal-subtitle');
        if (title) title.textContent = category;
        if (subtitle) subtitle.textContent = `${_modalDetailState.data.length} registros totales`;

        // Configurar toggles de filtro
        const filterBtns = modal.querySelectorAll('#detail-modal-filters button');
        const activeFilters = _modalDetailState.activeFilters;

        filterBtns.forEach(btn => {
            btn.classList.add('active');
            btn.onclick = () => {
                const filter = btn.dataset.filter;
                if (activeFilters.has(filter)) {
                    activeFilters.delete(filter);
                    btn.classList.remove('active');
                } else {
                    activeFilters.add(filter);
                    btn.classList.add('active');
                }
                _renderDetailCharts(category, data, activeFilters);
            };
        });

        _renderDetailCharts(category, data, activeFilters);

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    /**
     * Renderiza las gráficas del modal de detalle.
     * @param {string} category
     * @param {Array} data
     * @param {Set} activeFilters
     * @private
     */
    function _renderDetailCharts(category, data, activeFilters) {
        const container = document.getElementById('detail-modal-charts');
        if (!container) return;
        _modalDetailState.category = category;
        _modalDetailState.data = Array.isArray(data) ? data : [];
        _modalDetailState.activeFilters = new Set(activeFilters || []);

        // Limpiar gráficas existentes del modal
        Object.keys(_modalCharts).forEach(key => {
            if (_modalCharts[key]) _modalCharts[key].destroy();
        });
        _modalCharts = {};

        const dimensions = [
            { key: 'genero', title: 'Por Genero', icon: 'bi-gender-ambiguous', chartType: 'doughnut', field: 'genero' },
            { key: 'carrera', title: 'Por Carrera', icon: 'bi-mortarboard', chartType: 'bar', field: 'carrera' },
            { key: 'turno', title: 'Por Turno', icon: 'bi-clock', chartType: 'pie', field: 'turno' },
            { key: 'generacion', title: 'Por Generacion', icon: 'bi-calendar-event', chartType: 'bar', field: 'generacion' }
        ];

        let html = '';
        dimensions.forEach(dim => {
            if (!activeFilters.has(dim.key)) return;
            html += `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3"><i class="bi ${dim.icon} text-primary me-2"></i>${dim.title}</h6>
                        <canvas id="chart-modal-${dim.key}" style="max-height: 200px;"></canvas>
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;

        // Crear gráficas después del DOM update
        setTimeout(() => {
            const colors = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];

            dimensions.forEach(dim => {
                if (!activeFilters.has(dim.key)) return;
                const canvas = document.getElementById(`chart-modal-${dim.key}`);
                if (!canvas) return;

                // Agrupar datos por la dimensión
                const counts = {};
                data.forEach(d => {
                    const val = d[dim.field] || 'No especificado';
                    counts[val] = (counts[val] || 0) + 1;
                });

                let labels, values;
                if (dim.chartType === 'bar') {
                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    labels = sorted.map(([k]) => k);
                    values = sorted.map(([, v]) => v);
                } else {
                    labels = Object.keys(counts);
                    values = Object.values(counts);
                }

                _modalCharts[dim.key] = new Chart(canvas, {
                    type: dim.chartType === 'pie' ? 'pie' : dim.chartType,
                    data: {
                        labels,
                        datasets: [{
                            label: 'Registros',
                            data: values,
                            backgroundColor: dim.chartType === 'bar' ? colors[0] : colors.slice(0, labels.length)
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: dim.chartType !== 'bar', position: 'bottom' }
                        },
                        scales: dim.chartType === 'bar' ? { y: { beginAtZero: true } } : {}
                    }
                });
            });
        }, 50);
    }

    /**
     * Abre detalle de un diagnóstico o categoría específica.
     * @param {string} diagnostico - Nombre del diagnóstico/categoría
     * @param {string} tipo - Tipo de sección (medico, psico, biblio, pob*, etc.)
     */
    function _isClosedMedicalRecord(record) {
        const status = String(record?.statusCode || record?.status || '').toLowerCase();
        return ['finalizada', 'finalizado', 'completada', 'cerrada'].includes(status);
    }

    function openDiagnosticoDetail(diagnostico, tipo) {
        const sourceData = Array.isArray(_filteredData) && _filteredData.length ? _filteredData : _rawData;
        const medicoCategorizer = window.Reportes?.Medico?.categorizeSimilar;
        let data = [];
        if (tipo.startsWith('pob')) {
            data = sourceData.filter(d => {
                if (tipo === 'pobcar') return d.carrera === diagnostico;
                if (tipo === 'pobcol') return d.colonia === diagnostico;
                if (tipo === 'pobdis') return d.discapacidades && d.discapacidades.includes(diagnostico);
                if (tipo === 'pobext') {
                    if (diagnostico === 'Becados') return d.beca && d.beca !== 'No';
                    if (diagnostico === 'Trabajan actualmente') return d.trabaja === 'Si' || d.trabaja === 'Sí';
                    if (diagnostico === 'Uso Lentes/Apoyo Visual') return d.usaLentes === 'Sí';
                    if (diagnostico === 'Hablan Idioma o Dialecto') return d.idiomas && d.idiomas !== 'Ninguno';
                }
                return false;
            });
        } else if (tipo.startsWith('biblio')) {
            data = sourceData.filter(d => {
                if (tipo === 'biblio') return (d.detalle || 'Desconocido') === diagnostico;
                if (tipo === 'bibliocar') return d.carrera === diagnostico;
                return false;
            });
        } else {
            data = sourceData.filter(d => {
                if (tipo === 'medcar') return d.carrera === diagnostico;
                if (tipo === 'medgen') return d.genero === diagnostico;
                const desc = d.diagnostico || d.detalle || '';
                if (!desc) return false;

                if (tipo === 'meddiag' || tipo === 'psicodiag') {
                    if (!_isClosedMedicalRecord(d)) return false;
                    const grouped = typeof medicoCategorizer === 'function' ? medicoCategorizer(desc) : desc;
                    const isPsicoRecord = d.tipo === 'Consulta Psicológica' || d.subarea === 'Psicología';
                    if (grouped !== diagnostico) return false;
                    return tipo === 'psicodiag' ? isPsicoRecord : !isPsicoRecord;
                }

                return desc === diagnostico;
            });
        }
        openCardDetailModal(diagnostico, data);
    }

    function _buildModalExportPayload() {
        const data = Array.isArray(_modalDetailState.data) ? _modalDetailState.data : [];
        const activeFilters = _modalDetailState.activeFilters || new Set();
        const dimensions = [
            { key: 'genero', title: 'Por Género', field: 'genero' },
            { key: 'carrera', title: 'Por Carrera', field: 'carrera' },
            { key: 'turno', title: 'Por Turno', field: 'turno' },
            { key: 'generacion', title: 'Por Generación', field: 'generacion' }
        ];

        const sections = dimensions
            .filter(dim => activeFilters.has(dim.key))
            .map(dim => {
                const counts = {};
                data.forEach(item => {
                    const value = item[dim.field] || 'No especificado';
                    counts[value] = (counts[value] || 0) + 1;
                });

                const rows = Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([value, count]) => [value, count]);

                return { title: dim.title, headers: ['Valor', 'Cantidad'], rows };
            });

        return {
            kind: 'generic',
            title: `Detalle · ${_modalDetailState.category || 'Categoría'}`,
            subtitle: AREAS[_currentArea]?.name || _currentArea,
            filenameBase: _sanitizeFileName(`Detalle_${_currentArea}_${_modalDetailState.category || 'categoria'}`),
            summary: [
                ['Área', AREAS[_currentArea]?.name || _currentArea],
                ['Pestaña', _getCurrentTabMeta()?.label || '--'],
                ['Categoría', _modalDetailState.category || '--'],
                ['Registros', data.length]
            ],
            sections,
            columns: ['Fecha', 'Usuario', 'Matrícula', 'Subárea', 'Tipo', 'Detalle', 'Diagnóstico', 'Carrera', 'Género', 'Turno', 'Generación'],
            rows: data.map(item => [
                item.fecha instanceof Date ? item.fecha.toLocaleDateString('es-MX') : '--',
                item.usuario || '--',
                item.matricula || '--',
                item.subarea || '--',
                item.tipo || '--',
                item.detalle || '--',
                item.diagnostico || '--',
                item.carrera || '--',
                item.genero || '--',
                item.turno || '--',
                item.generacion || '--'
            ])
        };
    }

    function _buildModalExportPayload() {
        const data = Array.isArray(_modalDetailState.data) ? _modalDetailState.data : [];
        const activeFilters = _modalDetailState.activeFilters || new Set();
        const dimensions = [
            { key: 'genero', title: 'Distribucion por genero', field: 'genero', tone: 'accent' },
            { key: 'carrera', title: 'Distribucion por carrera', field: 'carrera', tone: 'primary' },
            { key: 'turno', title: 'Distribucion por turno', field: 'turno', tone: 'warning' },
            { key: 'generacion', title: 'Distribucion por generacion', field: 'generacion', tone: 'success' }
        ];

        const rows = _buildGenericRecordRows(data);
        const sections = dimensions
            .filter((dimension) => activeFilters.has(dimension.key))
            .map((dimension) => _exportBuildSection(
                dimension.title,
                _exportCollectCounts(data, (item) => item[dimension.field], { includeMissing: true }),
                data.length,
                {
                    tone: dimension.tone,
                    limit: dimension.key === 'carrera' ? 12 : 10,
                    sorter: dimension.key === 'generacion'
                        ? ((a, b) => String(b[0]).localeCompare(String(a[0]), 'es'))
                        : null
                }
            ))
            .filter(Boolean);

        return {
            kind: 'generic',
            title: `Detalle · ${_modalDetailState.category || 'Categoria'}`,
            subtitle: `${AREAS[_currentArea]?.name || _currentArea} · ${_getCurrentTabMeta()?.label || 'Detalle'}`,
            filenameBase: _sanitizeFileName(`Detalle_${_currentArea}_${_modalDetailState.category || 'categoria'}`),
            summary: [
                ['Area', AREAS[_currentArea]?.name || _currentArea],
                ['Pestana', _getCurrentTabMeta()?.label || '--'],
                ['Categoria analizada', _modalDetailState.category || '--'],
                ['Registros', data.length],
                ['Dimensiones activas', dimensions.filter((dimension) => activeFilters.has(dimension.key)).map((dimension) => dimension.key).join(', ') || 'Ninguna'],
                ['Periodo base', _exportGetPeriodLabel(_presetPeriod)],
                ['Rango', _exportResolveRangeLabel(_dateStart, _dateEnd)]
            ],
            highlights: [
                { label: 'Registros', value: data.length.toLocaleString('es-MX'), hint: 'Filas incluidas en el modal actual' },
                { label: 'Usuarios unicos', value: _exportCountUnique(data, (item) => item._uid || item.matricula || item.usuario).toLocaleString('es-MX'), hint: 'Personas distintas detectadas' },
                { label: 'Subareas', value: _exportCountUnique(data, (item) => item.subarea).toLocaleString('es-MX'), hint: 'Cobertura operativa del subconjunto' },
                { label: 'Carreras', value: _exportCountUnique(data, (item) => item.carrera).toLocaleString('es-MX'), hint: 'Diversidad academica visible' }
            ],
            sections,
            dataTitle: 'Detalle del subconjunto analizado',
            detailSheetName: 'DetalleModal',
            columns: ['Fecha', 'Hora', 'Usuario', 'Matricula', 'Subarea', 'Tipo', 'Estado', 'Detalle', 'Diagnostico', 'Profesional', 'Carrera', 'Genero', 'Turno', 'Generacion'],
            rows,
            pdfRows: rows.slice(0, 80),
            notes: [
                'Esta exportacion corresponde al subconjunto abierto desde el modal de detalle.',
                'Las dimensiones activas controlan solo las tablas resumen; el detalle conserva todas las filas del modal.'
            ]
        };
    }

    /**
     * Exporta datos del modal abierto.
     * @param {string} format - 'excel' | 'pdf'
     */
    async function exportModalData(format) {
        if (!window.ExportUtils) {
            alert('Error: utilidades de exportación no disponibles');
            return;
        }

        if (!_modalDetailState.data || _modalDetailState.data.length === 0) {
            alert('No hay datos para exportar en el modal actual');
            return;
        }

        const payload = _buildModalExportPayload();
        const config = {
            period: _presetPeriod,
            dateStart: _dateStart,
            dateEnd: _dateEnd
        };

        if (format === 'pdf') {
            await window.ExportUtils.generatePDF(config, payload, _currentArea);
        } else {
            window.ExportUtils.generateExcel(config, payload, _currentArea);
        }
    }

    // ==================== API PÚBLICA ====================

    return {
        init,
        navigateTo,
        goBack,
        setTab,
        showExportModal,
        openCardDetail: openCardDetailModal,
        openDiagnosticoDetail,
        exportModalData,
        applyDemoFilters,
        getState,
        getChartRegistry,
        destroyAllCharts,
        setState,
        loadData,
        render
    };

})();

window.Reportes = Reportes;
console.log('[SIA] reportes.js cargado, API:', Object.keys(Reportes));
