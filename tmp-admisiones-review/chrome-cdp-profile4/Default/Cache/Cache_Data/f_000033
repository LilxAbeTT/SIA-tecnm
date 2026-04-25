/**
 * vocacional-admin.js
 * Módulo de Administración (CRM) para el Test Vocacional (Departamento de Difusión)
 */

window.AdminVocacional = (function () {

    let _ctx = null;
    let currentTab = 'dashboard';
    let aspirantesData = [];
    let crmStats = null;
    let lastVisibleDoc = null;
    let hasMoreAspirantes = true;
    let isInsideReportes = false;
    let dashboardCharts = [];

    function normalizePermission(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getProfileEmail(ctx = _ctx) {
        return String(
            ctx?.profile?.emailInstitucional
            || ctx?.profile?.email
            || ctx?.auth?.currentUser?.email
            || ctx?.user?.email
            || ''
        ).trim().toLowerCase();
    }

    function hasVocacionalAdminAccess(ctx = _ctx) {
        const profile = ctx?.profile || {};
        const canAccessView = typeof window.SIA?.canAccessView === 'function'
            ? window.SIA.canAccessView(profile, 'view-vocacional-admin')
            : false;

        return !!ctx?.user && (
            profile.role === 'superadmin'
            || canAccessView
            || normalizePermission(profile?.permissions?.vocacional) === 'admin'
            || getProfileEmail(ctx) === 'difusion@loscabos.tecnm.mx'
        );
    }

    function hasReportesAccess(ctx = _ctx) {
        const profile = ctx?.profile || {};
        const canAccessView = typeof window.SIA?.canAccessView === 'function'
            ? window.SIA.canAccessView(profile, 'view-reportes')
            : false;
        const email = getProfileEmail(ctx);

        return !!ctx?.user && (
            profile.role === 'superadmin'
            || canAccessView
            || normalizePermission(profile?.permissions?.reportes) === 'admin'
            || email === 'desarrolloacademico@loscabos.tecnm.mx'
            || email === 'biblioteca@loscabos.tecnm.mx'
        );
    }

    function _resolveAccess(ctx = _ctx) {
        if (!ctx?.user) {
            return {
                allowed: false,
                admin: false,
                message: 'La sesion no esta lista todavia. Intenta nuevamente en unos segundos.'
            };
        }

        const admin = hasVocacionalAdminAccess(ctx);
        if (isInsideReportes) {
            if (admin || hasReportesAccess(ctx)) {
                return { allowed: true, admin, message: '' };
            }
            return {
                allowed: false,
                admin: false,
                message: 'No tienes permisos para ver el modulo vocacional desde Reportes.'
            };
        }

        if (admin) {
            return { allowed: true, admin, message: '' };
        }

        return {
            allowed: false,
            admin: false,
            message: 'No tienes permisos para ver el CRM de Difusion.'
        };
    }

    function updateExportButtonState() {
        if (isInsideReportes) return;
        const btnExport = document.getElementById('btn-export-csv');
        if (!btnExport) return;
        btnExport.disabled = currentTab !== 'prospectos' || aspirantesData.length === 0;
    }

    function renderRestrictedTab(tabId) {
        destroyDashboardCharts();
        const content = document.getElementById('vocacional-content') || _ctx?.container;
        if (!content) return;

        const tabLabels = {
            prospectos: 'Base de Prospectos',
            configuracion: 'Configurar Test'
        };

        content.innerHTML = `
        <div class="alert alert-info border-0 shadow-sm rounded-4 px-4 py-4">
            <div class="d-flex align-items-start gap-3">
                <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
                    <i class="bi bi-info-circle fs-4"></i>
                </div>
                <div>
                    <h5 class="fw-bold mb-1">${tabLabels[tabId] || 'Esta seccion'} requiere permisos vocacionales</h5>
                    <p class="text-muted mb-0">Desde Reportes solo esta disponible la vista agregada de Estadisticas para perfiles sin acceso administrativo al CRM vocacional.</p>
                </div>
            </div>
        </div>`;
    }

    function destroyDashboardCharts() {
        dashboardCharts.forEach((chart) => {
            try {
                chart.destroy();
            } catch (e) {
                console.warn('[AdminVocacional] No se pudo destruir grafica previa:', e);
            }
        });
        dashboardCharts = [];
    }

    function getDashboardChartColors(count = 4) {
        const palette = [
            'rgba(13, 110, 253, 0.82)',
            'rgba(32, 201, 151, 0.82)',
            'rgba(245, 158, 11, 0.82)',
            'rgba(14, 165, 233, 0.82)',
            'rgba(239, 68, 68, 0.82)',
            'rgba(107, 114, 128, 0.82)'
        ];

        return Array.from({ length: Math.max(count, 1) }, (_, index) => palette[index % palette.length]);
    }

    function truncateDashboardLabel(value, maxLength = 26) {
        const label = String(value || '').replace(/\s+/g, ' ').trim();
        if (!label) return '--';
        return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
    }

    function createDashboardChart(canvasId, config) {
        if (typeof window.Chart !== 'function') return null;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const chart = new window.Chart(canvas.getContext('2d'), config);
        dashboardCharts.push(chart);
        return chart;
    }

    function renderDashboardCharts(stats) {
        destroyDashboardCharts();
        if (typeof window.Chart !== 'function') return;

        const totalAspirantes = Number(stats?.totalAspirantes || 0);
        const totalCompleted = Number(stats?.totalCompleted || 0);
        const pendingAspirantes = Math.max(totalAspirantes - totalCompleted, 0);
        const ofertaTotal = Array.isArray(stats?.ofertaEducativa) ? stats.ofertaEducativa.length : 0;
        const careersWithDemand = Object.keys(stats?.demandaCareers || {}).length;
        const careersWithoutDemand = Math.max(ofertaTotal - careersWithDemand, 0);
        const careerEntries = Object.entries(stats?.demandaCareers || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const prepaEntries = Object.entries(stats?.procedenciaPrepas || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const chartColors = getDashboardChartColors(8);

        createDashboardChart('vocacional-funnel-chart', {
            type: 'doughnut',
            data: {
                labels: ['Completados', 'Pendientes'],
                datasets: [{
                    data: [totalCompleted, pendingAspirantes],
                    backgroundColor: ['rgba(25, 135, 84, 0.85)', 'rgba(245, 158, 11, 0.78)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, boxWidth: 10 }
                    }
                }
            }
        });

        createDashboardChart('vocacional-coverage-chart', {
            type: 'doughnut',
            data: {
                labels: ['Con demanda', 'Sin demanda'],
                datasets: [{
                    data: [careersWithDemand, careersWithoutDemand],
                    backgroundColor: ['rgba(14, 116, 144, 0.85)', 'rgba(99, 102, 241, 0.75)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, boxWidth: 10 }
                    }
                }
            }
        });

        createDashboardChart('vocacional-careers-chart', {
            type: 'bar',
            data: {
                labels: (careerEntries.length ? careerEntries : [['Sin datos', 0]]).map(([label]) => truncateDashboardLabel(label, 28)),
                datasets: [{
                    data: (careerEntries.length ? careerEntries : [['Sin datos', 0]]).map(([, value]) => Number(value) || 0),
                    backgroundColor: chartColors,
                    borderRadius: 8,
                    maxBarThickness: 22
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    },
                    y: {
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });

        createDashboardChart('vocacional-prepas-chart', {
            type: 'bar',
            data: {
                labels: (prepaEntries.length ? prepaEntries : [['Sin datos', 0]]).map(([label]) => truncateDashboardLabel(label, 28)),
                datasets: [{
                    data: (prepaEntries.length ? prepaEntries : [['Sin datos', 0]]).map(([, value]) => Number(value) || 0),
                    backgroundColor: chartColors.slice().reverse(),
                    borderRadius: 8,
                    maxBarThickness: 22
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    },
                    y: {
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }

    async function init(ctx, container = null) {
        const nextCtx = { ...(ctx || {}) };
        nextCtx.container = container || document.getElementById('view-vocacional-admin');
        isInsideReportes = nextCtx.container?.id !== 'view-vocacional-admin';

        if (!isInsideReportes) {
            const savedTab = localStorage.getItem('sia_vocacional_admin_tab');
            if (savedTab) {
                currentTab = savedTab;
            }
        }

        // Verificar permisos
        const access = _resolveAccess(nextCtx);

        if (!access.allowed) {
            destroyDashboardCharts();
            _ctx = null;
            nextCtx.container.innerHTML = `
            <div class="container py-5 text-center">
                <i class="bi bi-shield-lock text-danger display-1 mb-3"></i>
                <h2>Acceso Denegado</h2>
                <p class="text-muted">No tienes permisos para ver el CRM de Difusión.</p>
            </div>`;
            const deniedMessage = nextCtx.container.querySelector('.text-muted');
            if (deniedMessage) deniedMessage.textContent = access.message;
            return;
        }

        _ctx = nextCtx;

        if (!isInsideReportes) {
            renderBase();
        } else {
            _ctx.container.innerHTML = '<div id="vocacional-content"><div class="text-center py-5"><div class="spinner-border text-primary"></div></div></div>';
        }
        await loadData();
        if (!isInsideReportes) {
            setupEventListeners();
        }
    }

    function renderBase() {
        _ctx.container.innerHTML = `
        <div class="container py-4 fade-in">
            <!-- HEADER MODULO -->
            <div class="d-flex justify-content-between align-items-end border-bottom pb-3 mb-4">
                <div>
                    <span class="badge bg-primary bg-opacity-10 text-primary mb-2 px-3 py-2 rounded-pill fw-bold">
                        <i class="bi bi-megaphone me-1"></i> Departamento de Difusión
                    </span>
                    <h2 class="fw-bold mb-0 text-dark">CRM - Captación de Prospectos</h2>
                    <p class="text-muted mb-0 mt-1">Monitorea y contacta a los aspirantes del Test Vocacional.</p>
                </div>
                <div>
                    <button class="btn btn-outline-success fw-bold shadow-sm" id="btn-export-csv" disabled>
                        <i class="bi bi-file-earmark-excel me-2"></i>Exportar CSV
                    </button>
                </div>
            </div>

           <ul class="nav nav-pills mb-4 d-flex gap-3 nav-custom-pills" id="vocacional-tabs">
              <li class="nav-item">
                <a class="nav-link ${currentTab === 'dashboard' ? 'active' : ''} fw-bold text-nowrap" href="#" data-tab="dashboard">
                  <i class="bi bi-speedometer2 me-2"></i>Estadísticas
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${currentTab === 'prospectos' ? 'active' : ''} fw-bold text-nowrap" href="#" data-tab="prospectos">
                  <i class="bi bi-people me-2"></i>Base de Prospectos
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${currentTab === 'configuracion' ? 'active' : ''} fw-bold text-nowrap" href="#" data-tab="configuracion">
                  <i class="bi bi-gear me-2"></i>Configurar Test
                </a>
              </li>
           </ul>

            <!-- ÁREA DE CONTENIDO -->
            <div id="vocacional-content">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="mt-2 text-muted fw-bold">Cargando datos del CRM...</div>
                </div>
            </div>
        </div>

        <style>
            .fade-in { animation: fadeIn 0.4s ease-out; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .nav-custom-pills .nav-link { border-radius: 12px; color: #6c757d; padding: 0.75rem 1.25rem; transition: all 0.2s; }
            .nav-custom-pills .nav-link:hover { background-color: #f8f9fa; }
            .nav-custom-pills .nav-link.active { background-color: #0d6efd; color: white; box-shadow: 0 4px 10px rgba(13,110,253,0.2); }
            .stat-card { transition: transform 0.2s, box-shadow 0.2s; border: none; border-radius: 16px; background: white; }
            .stat-card:hover { transform: translateY(-5px); box-shadow: 0 .5rem 1rem rgba(0,0,0,.08) !important; }
        </style>
    `;
    }

    async function loadData() {
        try {
            const access = _resolveAccess();
            if (!access.allowed) {
                throw new Error(access.message || 'Acceso no autorizado.');
            }

            if (currentTab === 'dashboard') {
                crmStats = await VocacionalService.getCRMStats();
                updateExportButtonState();
                await renderCurrentTab(crmStats);
                return;
            }

            if (currentTab === 'prospectos') {
                if (isInsideReportes && !access.admin) {
                    renderRestrictedTab(currentTab);
                    updateExportButtonState();
                    return;
                }
                if (!crmStats) {
                    crmStats = await VocacionalService.getCRMStats();
                }
                lastVisibleDoc = null;
                hasMoreAspirantes = true;
                const res = await VocacionalService.getAspirantes(50, null);
                aspirantesData = res.docs;
                lastVisibleDoc = res.lastVisible;
                if (res.docs.length < 50) hasMoreAspirantes = false;
                updateExportButtonState();
                await renderCurrentTab(crmStats);
                return;
            }

            if (currentTab === 'configuracion') {
                if (isInsideReportes && !access.admin) {
                    renderRestrictedTab(currentTab);
                    updateExportButtonState();
                    return;
                }
                if (!VocacionalService.VOCACIONAL_TEST_DATA || VocacionalService.VOCACIONAL_TEST_DATA.length === 0) {
                    await VocacionalService.initTestData();
                }
                if (!crmStats) {
                    try {
                        crmStats = await VocacionalService.getCRMStats();
                    } catch (statsError) {
                        console.warn('[AdminVocacional] No se pudieron refrescar stats para configuracion:', statsError);
                    }
                }
                updateExportButtonState();
                await renderCurrentTab(crmStats);
                return;
            }

            const stats = await VocacionalService.getCRMStats();
            // Load first page of table
            lastVisibleDoc = null;
            hasMoreAspirantes = true;
            const res = await VocacionalService.getAspirantes(50, null);
            aspirantesData = res.docs;
            lastVisibleDoc = res.lastVisible;
            if (res.docs.length < 50) hasMoreAspirantes = false;

            // Habilitar exportación
            const btnExport = document.getElementById('btn-export-csv');
            if (btnExport && aspirantesData.length > 0) {
                btnExport.disabled = false;
            }

            await renderCurrentTab(stats);
        } catch (e) {
            console.error(e);
            destroyDashboardCharts();
            let contentEl = document.getElementById('vocacional-content') || _ctx.container;
            if (contentEl) contentEl.innerHTML = `
            <div class="alert alert-danger shadow-sm"><i class="bi bi-exclamation-triangle me-2"></i>Error al cargar los datos del CRM.</div>
        `;
        }
    }

    async function renderCurrentTab(stats) {
        const content = document.getElementById('vocacional-content') || _ctx.container;
        destroyDashboardCharts();
        if (currentTab === 'dashboard') {
            renderDashboard(content, stats || crmStats || {
                totalAspirantes: 0,
                totalCompleted: 0,
                procedenciaPrepas: {},
                demandaCareers: {}
            });
        } else if (currentTab === 'prospectos') {
            renderTable(content);
        } else if (currentTab === 'configuracion') {
            await renderConfiguracion(content);
        }
    }

    function _renderDashboardLegacy(container, stats) {
        // Ordenar prepas para el top
        const sortPrepas = Object.entries(stats.procedenciaPrepas).sort((a, b) => b[1] - a[1]).slice(0, 5);
        // Ordenar carreras para el top
        const sortCareers = Object.entries(stats.demandaCareers).sort((a, b) => b[1] - a[1]);

        const cv = 100 * (stats.totalCompleted / (stats.totalAspirantes || 1));

        container.innerHTML = `
        <!-- KPIs Principales -->
        <div class="row g-4 mb-5">
            <div class="col-md-4">
                <div class="card stat-card shadow-sm h-100 p-4 border-bottom border-primary border-4">
                    <div class="d-flex align-items-center mb-3">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle p-3 me-3">
                            <i class="bi bi-person-lines-fill fs-3"></i>
                        </div>
                        <h6 class="text-muted fw-bold mb-0 text-uppercase">Total Registros</h6>
                    </div>
                    <h2 class="display-5 fw-bold text-dark mb-0">${stats.totalAspirantes}</h2>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card stat-card shadow-sm h-100 p-4 border-bottom border-success border-4">
                    <div class="d-flex align-items-center mb-3">
                        <div class="bg-success bg-opacity-10 text-success rounded-circle p-3 me-3">
                            <i class="bi bi-check-circle-fill fs-3"></i>
                        </div>
                        <h6 class="text-muted fw-bold mb-0 text-uppercase">Tests Completados</h6>
                    </div>
                    <h2 class="display-5 fw-bold text-dark mb-0">${stats.totalCompleted}</h2>
                    <div class="mt-2 text-muted fw-bold small">
                        Tasa de conversión: <span class="text-success">${cv.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card stat-card shadow-sm h-100 p-4 bg-primary text-white banner-crm">
                    <div class="position-relative z-1 d-flex flex-column justify-content-center h-100">
                        <h5 class="fw-bold mb-2"><i class="bi bi-megaphone-fill me-2"></i>Acción Rápida</h5>
                        <p class="mb-4 opacity-75 small">Envía invitaciones masivas a visitas guiadas para los prospectos más afines.</p>
                        <button class="btn btn-light fw-bold text-primary rounded-pill w-100 shadow-sm disabled">
                            <i class="bi bi-envelope-check me-2"></i>Crear Campaña (Próximamente)
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <!-- TOP CARRERAS -->
            <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="fw-bold text-dark"><i class="bi bi-bar-chart-fill text-primary me-2"></i>Demanda Proyectada (Top 1)</h5>
                        <p class="text-muted small">Carreras más recomendadas como primera opción.</p>
                    </div>
                    <div class="card-body">
                        ${sortCareers.length === 0 ? '<p class="text-muted text-center my-4">No hay datos suficientes.</p>' : ''}
                        ${sortCareers.map(([career, count], index) => `
                            <div class="d-flex align-items-center mb-3">
                                <div class="fw-bold text-muted me-3" style="width: 20px;">${index + 1}.</div>
                                <div class="flex-grow-1">
                                    <div class="d-flex justify-content-between mb-1">
                                        <span class="fw-bold text-dark">${career}</span>
                                        <span class="badge bg-primary rounded-pill">${count} aspirantes</span>
                                    </div>
                                    <div class="progress" style="height: 6px;">
                                        <div class="progress-bar bg-primary rounded-pill" style="width: ${Math.round((count / stats.totalCompleted) * 100)}%"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- TOP PREPARATORIAS -->
            <div class="col-lg-6">
                 <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="fw-bold text-dark"><i class="bi bi-bank border text-warning me-2 p-1 rounded"></i>Escuelas de Procedencia</h5>
                        <p class="text-muted small">Preparatorias con mayor interacción en el test.</p>
                    </div>
                    <div class="card-body">
                        ${sortPrepas.length === 0 ? '<p class="text-muted text-center my-4">No hay datos suficientes.</p>' : ''}
                        <ul class="list-group list-group-flush">
                        ${sortPrepas.map(([prepa, count]) => `
                            <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                                <span class="fw-bold text-secondary"><i class="bi bi-building me-2 text-muted"></i>${prepa}</span>
                                <span class="badge bg-warning text-dark rounded-pill px-3">${count} prospectos</span>
                            </li>
                        `).join('')}
                        </ul>
                    </div>
                 </div>
            </div>
        </div>
        
        <style>
            .banner-crm { position: relative; overflow: hidden; border: none; }
            .banner-crm::before {
                content: ''; position: absolute; top: -50%; right: -50%; width: 200%; height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%);
                transform: rotate(30deg);
            }
        </style>
    `;
    }

    // Helper para escapar HTML en caso de inyección
    function renderDashboard(container, stats) {
        const totalAspirantes = Number(stats?.totalAspirantes || 0);
        const totalCompleted = Number(stats?.totalCompleted || 0);
        const pendingAspirantes = Math.max(totalAspirantes - totalCompleted, 0);
        const conversion = totalAspirantes > 0 ? (100 * totalCompleted / totalAspirantes) : 0;
        const sortPrepas = Object.entries(stats?.procedenciaPrepas || {}).sort((a, b) => b[1] - a[1]);
        const sortCareers = Object.entries(stats?.demandaCareers || {}).sort((a, b) => b[1] - a[1]);
        const ofertaTotal = Array.isArray(stats?.ofertaEducativa) ? stats.ofertaEducativa.length : 0;
        const careersWithDemand = Object.keys(stats?.demandaCareers || {}).length;
        const topCareer = sortCareers[0] || null;
        const topPrepa = sortPrepas[0] || null;

        container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card shadow-sm h-100 p-4 border-start border-4 border-primary">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <span class="kpi-chip bg-primary bg-opacity-10 text-primary"><i class="bi bi-people-fill"></i></span>
                        <span class="text-muted small fw-semibold text-uppercase">Prospectos</span>
                    </div>
                    <h2 class="display-6 fw-bold text-dark mb-1">${totalAspirantes}</h2>
                    <p class="text-muted small mb-0">Registros acumulados en el CRM.</p>
                </div>
            </div>
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card shadow-sm h-100 p-4 border-start border-4 border-success">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <span class="kpi-chip bg-success bg-opacity-10 text-success"><i class="bi bi-check2-circle"></i></span>
                        <span class="text-muted small fw-semibold text-uppercase">Completados</span>
                    </div>
                    <h2 class="display-6 fw-bold text-dark mb-1">${totalCompleted}</h2>
                    <p class="text-muted small mb-0">Aspirantes con test finalizado.</p>
                </div>
            </div>
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card shadow-sm h-100 p-4 border-start border-4 border-warning">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <span class="kpi-chip bg-warning bg-opacity-10 text-warning"><i class="bi bi-hourglass-split"></i></span>
                        <span class="text-muted small fw-semibold text-uppercase">Pendientes</span>
                    </div>
                    <h2 class="display-6 fw-bold text-dark mb-1">${pendingAspirantes}</h2>
                    <p class="text-muted small mb-0">Sin resultado final registrado.</p>
                </div>
            </div>
            <div class="col-sm-6 col-xl-3">
                <div class="card stat-card shadow-sm h-100 p-4 border-start border-4 border-info">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <span class="kpi-chip bg-info bg-opacity-10 text-info"><i class="bi bi-graph-up-arrow"></i></span>
                        <span class="text-muted small fw-semibold text-uppercase">Conversion</span>
                    </div>
                    <h2 class="display-6 fw-bold text-dark mb-1">${conversion.toFixed(1)}%</h2>
                    <p class="text-muted small mb-0">Relacion entre captacion y cierre.</p>
                </div>
            </div>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-xl-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="fw-bold text-dark mb-1"><i class="bi bi-pie-chart-fill text-success me-2"></i>Estatus del test</h5>
                        <p class="text-muted small mb-0">Balance entre tests cerrados y pendientes.</p>
                    </div>
                    <div class="card-body pt-3">
                        <div class="voc-chart-wrap voc-chart-wrap-sm">
                            <canvas id="vocacional-funnel-chart"></canvas>
                        </div>
                        <div class="d-flex justify-content-between gap-3 small text-muted mt-3">
                            <span>Completados: <strong class="text-dark">${totalCompleted}</strong></span>
                            <span>Pendientes: <strong class="text-dark">${pendingAspirantes}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="fw-bold text-dark mb-1"><i class="bi bi-bullseye text-info me-2"></i>Cobertura de oferta</h5>
                        <p class="text-muted small mb-0">Carreras con al menos una recomendacion vs oferta total.</p>
                    </div>
                    <div class="card-body pt-3">
                        <div class="voc-chart-wrap voc-chart-wrap-sm">
                            <canvas id="vocacional-coverage-chart"></canvas>
                        </div>
                        <div class="d-flex justify-content-between gap-3 small text-muted mt-3">
                            <span>Oferta total: <strong class="text-dark">${ofertaTotal}</strong></span>
                            <span>Con demanda: <strong class="text-dark">${careersWithDemand}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-xl-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="fw-bold text-dark mb-1"><i class="bi bi-bar-chart-line-fill text-primary me-2"></i>Demanda proyectada</h5>
                        <p class="text-muted small mb-0">Top 1 de carreras mas recomendadas.</p>
                    </div>
                    <div class="card-body pt-3">
                        <div class="voc-chart-wrap voc-chart-wrap-lg">
                            <canvas id="vocacional-careers-chart"></canvas>
                        </div>
                        <div class="small text-muted mt-3">
                            Lider actual: <strong class="text-dark">${topCareer ? escapeHtml(topCareer[0]) : 'Sin datos'}</strong>
                            ${topCareer ? `<span class="ms-2">(${topCareer[1]} aspirantes)</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="fw-bold text-dark mb-1"><i class="bi bi-bank2 text-warning me-2"></i>Escuelas de procedencia</h5>
                        <p class="text-muted small mb-0">Preparatorias con mayor participacion en el test.</p>
                    </div>
                    <div class="card-body pt-3">
                        <div class="voc-chart-wrap voc-chart-wrap-lg">
                            <canvas id="vocacional-prepas-chart"></canvas>
                        </div>
                        <div class="small text-muted mt-3">
                            Lider actual: <strong class="text-dark">${topPrepa ? escapeHtml(topPrepa[0]) : 'Sin datos'}</strong>
                            ${topPrepa ? `<span class="ms-2">(${topPrepa[1]} prospectos)</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .kpi-chip {
                width: 44px;
                height: 44px;
                border-radius: 14px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
            }
            .voc-chart-wrap {
                position: relative;
                width: 100%;
            }
            .voc-chart-wrap-sm {
                min-height: 260px;
            }
            .voc-chart-wrap-lg {
                min-height: 320px;
            }
            .voc-chart-wrap canvas {
                width: 100% !important;
                height: 100% !important;
            }
        </style>
    `;

        renderDashboardCharts(stats);
    }

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderTable(container) {
        container.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="">
                            <tr>
                                <th class="text-uppercase small text-muted fw-bold py-3 px-4">Aspirante</th>
                                <th class="text-uppercase small text-muted fw-bold py-3">Contacto</th>
                                <th class="text-uppercase small text-muted fw-bold py-3">Procedencia</th>
                                <th class="text-uppercase small text-muted fw-bold py-3">Estado Test</th>
                                <th class="text-uppercase small text-muted fw-bold py-3">Resultados y Alertas</th>
                                <th class="text-uppercase small text-muted fw-bold py-3 text-end px-4">Fecha</th>
                            </tr>
                        </thead>
                        <tbody id="vocacional-table-body">
                            ${buildTableRows(aspirantesData)}
                        </tbody>
                    </table>
                </div>
            </div>
            ${hasMoreAspirantes ? `
            <div class="card-footer bg-white border-top-0 py-4 text-center">
                <button class="btn btn-outline-primary rounded-pill px-4 btn-sm fw-bold" id="btn-load-more">
                    Cargar más registros <i class="bi bi-chevron-down ms-1"></i>
                </button>
            </div>
            ` : ''}
        </div>
    `;

        if (hasMoreAspirantes) {
            document.getElementById('btn-load-more').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
                btn.disabled = true;

                try {
                    const res = await VocacionalService.getAspirantes(50, lastVisibleDoc);
                    if (res.docs.length > 0) {
                        aspirantesData = aspirantesData.concat(res.docs);
                        lastVisibleDoc = res.lastVisible;
                        document.getElementById('vocacional-table-body').insertAdjacentHTML('beforeend', buildTableRows(res.docs));
                    }
                    if (res.docs.length < 50) {
                        hasMoreAspirantes = false;
                        btn.parentElement.remove(); // Quitar footer de load more
                    } else {
                        btn.innerHTML = 'Cargar más registros <i class="bi bi-chevron-down ms-1"></i>';
                        btn.disabled = false;
                    }
                } catch (error) {
                    console.error(error);
                    btn.innerHTML = 'Error al cargar';
                }
            });
        }
    }

    function buildTableRows(dataArray) {
        if (dataArray.length === 0) {
            return '<tr><td colspan="6" class="text-center py-5 text-muted">No hay registros a mostrar.</td></tr>';
        }
        return dataArray.map(asp => {
            const pInfo = asp.personalInfo || {};
            const isCompleted = asp.testStatus === 'completed';
            const badgeColor = isCompleted ? 'bg-success' : 'bg-warning text-dark';
            const badgeTxt = isCompleted ? 'Completado' : `En Progreso (B${asp.currentBlock || 1})`;
            const top1 = isCompleted && asp.recommendedCareers && asp.recommendedCareers.length > 0 ? escapeHtml(asp.recommendedCareers[0].name) : '--';

            // Render Alerts
            let alertsHtml = '';
            if (isCompleted && asp.psychopedagogicalAlerts && asp.psychopedagogicalAlerts.length > 0) {
                // Extract string from objects and deduplicate alerts
                const normalizedAlerts = asp.psychopedagogicalAlerts.map(a => {
                    if (typeof a === 'string') {
                        try {
                            const parsed = JSON.parse(a);
                            return parsed.msg || parsed.message || parsed.texto || parsed.text || String(a);
                        } catch (e) {
                            return String(a);
                        }
                    }
                    if (typeof a === 'object' && a !== null) return a.msg || a.message || a.texto || a.text || JSON.stringify(a);
                    return String(a);
                });
                const uniqueAlerts = [...new Set(normalizedAlerts)];
                alertsHtml = `<div class="mt-2 text-danger small"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${uniqueAlerts.map(a => escapeHtml(a)).join(', ')}</div>`;
            }

            // Format date (safely fallback if serverTimestamp pending)
            let dateStr = '--';
            if (asp.createdAt) {
                const d = asp.createdAt.toDate ? asp.createdAt.toDate() : new Date();
                dateStr = d.toLocaleDateString();
            }

            return `
                <tr>
                    <td class="px-4 py-3">
                        <div class="fw-bold text-dark">${escapeHtml(pInfo.name) || 'Sin Nombre'}</div>
                    </td>
                    <td class="py-3">
                        <div class="text-muted small"><i class="bi bi-telephone me-1"></i>${escapeHtml(pInfo.phone) || '--'}</div>
                        ${pInfo.email ? `<div class="text-muted small"><i class="bi bi-envelope me-1"></i>${escapeHtml(pInfo.email)}</div>` : ''}
                    </td>
                    <td class="py-3">
                        <div class="fw-bold text-secondary text-truncate" style="max-width: 200px;" title="${escapeHtml(pInfo.highSchool)}">${escapeHtml(pInfo.highSchool) || '--'}</div>
                        ${pInfo.technicalCareer ? `<span class="badge bg-info bg-opacity-10 text-info fw-normal extra-small mt-1 d-inline-block text-truncate" style="max-width:180px;">Téc: ${escapeHtml(pInfo.technicalCareer)}</span>` : ''}
                    </td>
                    <td class="py-3">
                        <span class="badge ${badgeColor} rounded-pill">${badgeTxt}</span>
                    </td>
                    <td class="py-3">
                        <div class="fw-bold text-primary">${top1}</div>
                        ${alertsHtml}
                    </td>
                    <td class="py-3 text-end px-4 text-muted small">
                        ${dateStr}
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function renderConfiguracion(container) {
        // Mostrar cargador inicial
        container.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4 mb-4 fade-in">
            <div class="card-body text-center py-5">
                <div class="spinner-border text-primary"></div>
                <p class="text-muted mt-2 mb-0">Cargando base de datos de preguntas...</p>
            </div>
        </div>`;

        // Asegurarnos que la data ya esté en el sistema
        if (!VocacionalService.VOCACIONAL_TEST_DATA || VocacionalService.VOCACIONAL_TEST_DATA.length === 0) {
            try {
                await VocacionalService.initTestData();
            } catch (e) {
                console.error("Error cargando configuración:", e);
                container.innerHTML = '<div class="alert alert-danger m-4">Error cargando base de preguntas.</div>';
                return;
            }
        }

        // Clonamos los datos actuales para operar sobre ellos sin afectar global hasta guardar
        let testData = JSON.parse(JSON.stringify(VocacionalService.VOCACIONAL_TEST_DATA || []));

        // Contenedor principal
        container.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4 mb-4 fade-in">
            <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <h5 class="fw-bold text-dark mb-1">
                            <i class="bi bi-pencil-square text-primary me-2"></i>Editor Visual de Preguntas
                            <button class="btn btn-sm btn-outline-info ms-2 rounded-circle" id="btn-help-editor" title="Guía de uso" style="width: 28px; height: 28px; padding: 0; line-height: 1;"><i class="bi bi-question-lg"></i></button>
                        </h5>
                        <p class="text-muted small mb-0">Administra los bloques, preguntas y ponderaciones del test de manera intuitiva.</p>
                    </div>
                    <button class="btn btn-primary shadow-sm fw-bold px-4 rounded-pill text-nowrap" id="btn-save-test-data">
                        <i class="bi bi-save me-2"></i>Guardar Cambios
                    </button>
                </div>
            </div>

            <!-- Modal de Ayuda (Oculto por defecto) -->
            <div class="modal fade" id="helpEditorModal" tabindex="-1" aria-labelledby="helpEditorModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow">
                  <div class="modal-header  border-bottom-0">
                    <h5 class="modal-title fw-bold text-primary" id="helpEditorModalLabel"><i class="bi bi-info-circle-fill me-2"></i>Guía del Editor Vocacional</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body px-4 py-4">
                    <div class="mb-4">
                        <h6 class="fw-bold text-dark border-bottom pb-2">1. Estructura del Examen (Bloques)</h6>
                        <p class="small text-muted mb-2">El examen se divide en <strong>Bloques</strong>. Cada bloque agrupa un conjunto de preguntas que evalúan un área específica (ej. Intereses, Habilidades). Puedes crear nuevos bloques al final de la página.</p>
                    </div>
                    <div class="mb-4">
                        <h6 class="fw-bold text-dark border-bottom pb-2">2. Ponderaciones (Targets y Pesos)</h6>
                        <p class="small text-muted mb-2">Aquí defines a qué carrera le suma puntos cada pregunta. <br>
                        - <strong>Carrera:</strong> Escribe la clave exacta en mayúsculas (ej. <code>ISC</code>, <code>ADM</code>, <code>TUR</code>, <code>CP</code>, <code>CIVIL</code>, <code>GASTRO</code>, <code>ARQ</code>, <code>ELEC</code>).<br>
                        - <strong>Peso:</strong> Asigna el valor que suma. <code>1.0</code> significa puntaje completo, <code>0.5</code> es medio punto.</p>
                    </div>
                    <div class="mb-4">
                        <h6 class="fw-bold text-dark border-bottom pb-2">3. Tipos de Pregunta</h6>
                        <ul class="small text-muted mb-2 ps-3">
                            <li><strong>Escala Likert:</strong> Típica pregunta del 1 al 5 ("Totalmente en desacuerdo" a "Totalmente de acuerdo"). El peso se multiplica por el nivel elegido.</li>
                            <li><strong>Booleano:</strong> Opción binaria ("Sí" o "No").</li>
                        </ul>
                    </div>
                    <div>
                        <h6 class="fw-bold text-dark border-bottom pb-2">4. Alertas Psicopedagógicas (Opcional)</h6>
                        <p class="small text-muted mb-0">Si deseas que la elección de una pregunta dispare una alarma automática para los psicólogos (por ejemplo, si manifiestan no querer estudiar), escribe en la caja de 'ID Alerta' un texto breve en formato JSON, ej: <code>{"msg":"Desinterés crítico","type":"red"}</code></p>
                    </div>
                  </div>
                  <div class="modal-footer  border-top-0">
                    <button type="button" class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Entendido</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="card-body" id="visual-editor-container">
                <div id="json-editor-feedback" class="mb-3"></div>
                
                <div class="accordion" id="accordionBlocks">
                    <!-- Los bloques se renderizan aquí dinámicamente -->
                </div>
                
                <div class="mt-4 text-center">
                    <button class="btn btn-outline-secondary btn-sm rounded-pill" id="btn-add-block">
                        <i class="bi bi-plus-circle me-1"></i> Añadir Nuevo Bloque
                    </button>
                </div>
            </div>
        </div>
        `;

        const accordionContainer = document.getElementById('accordionBlocks');

        // Lógica del botón de Ayuda
        const btnHelp = document.getElementById('btn-help-editor');
        if (btnHelp) {
            btnHelp.addEventListener('click', () => {
                const helpModal = new bootstrap.Modal(document.getElementById('helpEditorModal'));
                helpModal.show();
            });
        }

        // Función para renderizar todo el editor basado en 'testData'
        function renderEditor() {
            accordionContainer.innerHTML = '';

            testData.forEach((block, bIndex) => {
                const blockId = `collapseBlock${bIndex}`;

                // HTML del Bloque (Acordeón)
                const blockHTML = `
                <div class="accordion-item border-0 mb-3 shadow-sm rounded-4 overflow-hidden" data-bindex="${bIndex}">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed  text-dark fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#${blockId}">
                            <i class="bi bi-collection me-2 text-primary"></i> ${escapeHtml(block.title || `Bloque ${bIndex + 1}`)}
                        </button>
                    </h2>
                    <div id="${blockId}" class="accordion-collapse collapse" data-bs-parent="#accordionBlocks">
                        <div class="accordion-body bg-white pt-4">
                            <!-- Metadatos del Bloque -->
                            <div class="row g-3 mb-4 p-3  rounded-3 border">
                                <div class="col-md-5">
                                    <label class="form-label small fw-bold text-muted">Título del Bloque</label>
                                    <input type="text" class="form-control form-control-sm block-title-input" value="${escapeHtml(block.title || '')}" placeholder="Ej. Bloque I: Intereses">
                                </div>
                                <div class="col-md-5">
                                    <label class="form-label small fw-bold text-muted">Subtítulo</label>
                                    <input type="text" class="form-control form-control-sm block-subtitle-input" value="${escapeHtml(block.subtitle || '')}" placeholder="Breve descripción">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small fw-bold text-muted">Peso Global</label>
                                    <input type="number" step="0.1" class="form-control form-control-sm block-weight-input" value="${block.weight || 1.0}">
                                </div>
                            </div>

                            <!-- Lista de Preguntas -->
                            <div class="questions-container" id="questions-container-${bIndex}">
                                ${renderQuestions(block.questions, bIndex)}
                            </div>

                            <!-- Controles del Bloque -->
                            <div class="d-flex justify-content-between mt-4 pt-3 border-top">
                                <button class="btn btn-sm btn-outline-primary btn-add-question" data-bindex="${bIndex}"><i class="bi bi-plus me-1"></i>Añadir Pregunta</button>
                                <button class="btn btn-sm btn-outline-danger btn-delete-block" data-bindex="${bIndex}"><i class="bi bi-trash me-1"></i>Eliminar Bloque</button>
                            </div>
                        </div>
                    </div>
                </div>
                `;
                accordionContainer.insertAdjacentHTML('beforeend', blockHTML);
            });

            attachEditorEventListeners();
        }

        function renderQuestions(questions, bIndex) {
            if (!questions || questions.length === 0) return '<p class="text-muted small text-center my-3">No hay preguntas en este bloque.</p>';

            return questions.map((q, qIndex) => {
                let targetsHtml = '';
                if (q.targets) {
                    targetsHtml = Object.entries(q.targets).map(([career, weight]) => `
                        <div class="input-group input-group-sm mb-2 target-row">
                            <span class="input-group-text bg-white small text-muted">Carrera</span>
                            <input type="text" class="form-control target-key text-uppercase" value="${escapeHtml(career)}" placeholder="Ej. ISC" required>
                            <span class="input-group-text bg-white small text-muted">Peso</span>
                            <input type="number" step="0.1" class="form-control target-value" value="${weight}" required style="max-width: 80px;">
                            <button class="btn btn-outline-danger btn-remove-target" type="button"><i class="bi bi-x"></i></button>
                        </div>
                    `).join('');
                }

                // Extraer el id de alerta si existe un condicional o mapeo complejo (Simplificado para esta vista)
                let alertInput = '';
                if (q.alertId || q.alertTrigger) {
                    alertInput = `<input type="text" class="form-control form-control-sm q-alert-input" value="${escapeHtml(q.alertId || q.alertTrigger)}" placeholder="ID de alerta (Opcional)">`;
                } else {
                    alertInput = `<input type="text" class="form-control form-control-sm q-alert-input" placeholder="ID de alerta (Opcional)">`;
                }

                return `
                <div class="card mb-3 border question-card shadow-sm" data-qindex="${qIndex}">
                    <div class="card-header  border-bottom d-flex justify-content-between align-items-center py-2">
                        <span class="badge bg-secondary">P${qIndex + 1}</span>
                        <button class="btn btn-sm text-danger btn-delete-question p-0" title="Eliminar Pregunta" data-bindex="${bIndex}" data-qindex="${qIndex}"><i class="bi bi-trash"></i></button>
                    </div>
                    <div class="card-body py-3">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-dark">Texto de la Pregunta</label>
                            <textarea class="form-control form-control-sm q-text-input shadow-none" rows="2" required>${escapeHtml(q.text || '')}</textarea>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-7 border-end">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <label class="form-label small fw-bold text-dark mb-0">Ponderaciones (Targets)</label>
                                    <button class="btn btn-sm btn-link text-decoration-none py-0 px-1 btn-add-target" data-bindex="${bIndex}" data-qindex="${qIndex}"><i class="bi bi-plus-circle me-1"></i>Añadir</button>
                                </div>
                                <div class="targets-container">
                                    ${targetsHtml || '<span class="text-muted extra-small">Sin ponderaciones...</span>'}
                                </div>
                            </div>
                            <div class="col-md-5 ps-3">
                                <label class="form-label small fw-bold text-dark mb-2">Configuración Extra</label>
                                <div class="mb-2">
                                    <label class="extra-small text-muted d-block mb-1">ID Alerta Psicopedagógica</label>
                                    ${alertInput}
                                </div>
                                <div>
                                    <label class="extra-small text-muted d-block mb-1">Tipo de Pregunta</label>
                                    <select class="form-select form-select-sm q-type-select">
                                        <option value="likert" ${q.type === 'likert' ? 'selected' : ''}>Escala Likert (5 Opciones)</option>
                                        <option value="boolean" ${q.type === 'boolean' ? 'selected' : ''}>Sí/No (Booleano)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }

        // --- Recolectar datos del DOM ---
        function collectDataFromDOM() {
            const newTestData = [];
            const blockElements = document.querySelectorAll('.accordion-item');

            blockElements.forEach((blockEl, bIndex) => {
                const title = blockEl.querySelector('.block-title-input').value.trim();
                const subtitle = blockEl.querySelector('.block-subtitle-input').value.trim();
                const weight = parseFloat(blockEl.querySelector('.block-weight-input').value) || 1.0;

                const questions = [];
                const qCards = blockEl.querySelectorAll('.question-card');

                qCards.forEach((qCard, qIndex) => {
                    const text = qCard.querySelector('.q-text-input').value.trim();
                    const type = qCard.querySelector('.q-type-select').value;
                    const alertId = qCard.querySelector('.q-alert-input').value.trim();

                    const targets = {};
                    const targetRows = qCard.querySelectorAll('.target-row');
                    targetRows.forEach(row => {
                        const key = row.querySelector('.target-key').value.trim().toUpperCase();
                        const val = parseFloat(row.querySelector('.target-value').value);
                        if (key && !isNaN(val)) {
                            targets[key] = val;
                        }
                    });

                    // ID dinámico basado en index
                    const qId = `B${bIndex + 1}_V${qIndex + 1}`;

                    const qObj = {
                        id: qId,
                        type: type,
                        text: text,
                    };
                    if (Object.keys(targets).length > 0) qObj.targets = targets;
                    if (alertId) qObj.alertId = alertId;

                    questions.push(qObj);
                });

                newTestData.push({
                    block: bIndex + 1,
                    title: title,
                    subtitle: subtitle,
                    weight: weight,
                    questions: questions
                });
            });

            return newTestData;
        }

        // --- Event Listeners Dinámicos del Editor ---
        function attachEditorEventListeners() {
            // Añadir Bloque
            const btnAddBlock = document.getElementById('btn-add-block');
            // Remove old listener to avoid duplicates if re-rendered
            const clonedBtn = btnAddBlock.cloneNode(true);
            btnAddBlock.parentNode.replaceChild(clonedBtn, btnAddBlock);

            clonedBtn.addEventListener('click', () => {
                // Sincronizar estado actual antes de redibujar
                testData = collectDataFromDOM();
                testData.push({ block: testData.length + 1, title: 'Nuevo Bloque', questions: [] });
                renderEditor();
                // Scroll to bottom
                setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
            });

            // Delegación de eventos para el acordeón (botones internos)
            accordionContainer.onclick = function (e) {
                const target = e.target.closest('button');
                if (!target) return;

                // Añadir Pregunta
                if (target.classList.contains('btn-add-question')) {
                    const bIndex = parseInt(target.getAttribute('data-bindex'));
                    testData = collectDataFromDOM(); // Guardar cambios de inputs
                    if (!testData[bIndex].questions) testData[bIndex].questions = [];
                    testData[bIndex].questions.push({ text: 'Nueva pregunta...', type: 'likert', targets: {} });
                    renderEditor();
                    // Open the block
                    const collapse = document.getElementById(`collapseBlock${bIndex}`);
                    if (!collapse.classList.contains('show') && window.bootstrap && window.bootstrap.Collapse) {
                        new bootstrap.Collapse(collapse, { toggle: true });
                    }
                }

                // Eliminar Pregunta
                else if (target.classList.contains('btn-delete-question')) {
                    if (!confirm('¿Estás seguro de eliminar esta pregunta?')) return;
                    const bIndex = parseInt(target.getAttribute('data-bindex'));
                    const qIndex = parseInt(target.getAttribute('data-qindex'));
                    testData = collectDataFromDOM();
                    testData[bIndex].questions.splice(qIndex, 1);
                    renderEditor();
                }

                // Eliminar Bloque
                else if (target.classList.contains('btn-delete-block')) {
                    if (!confirm('¿Eliminar este bloque completo y TODAS sus preguntas? Esta acción no se puede deshacer.')) return;
                    const bIndex = parseInt(target.getAttribute('data-bindex'));
                    testData = collectDataFromDOM();
                    testData.splice(bIndex, 1);
                    renderEditor();
                }

                // Añadir Target
                else if (target.classList.contains('btn-add-target')) {
                    const bIndex = parseInt(target.getAttribute('data-bindex'));
                    const qIndex = parseInt(target.getAttribute('data-qindex'));
                    testData = collectDataFromDOM();
                    if (!testData[bIndex].questions[qIndex].targets) testData[bIndex].questions[qIndex].targets = {};
                    testData[bIndex].questions[qIndex].targets['NUEVO'] = 1.0;
                    renderEditor();
                }

                // Eliminar Target
                else if (target.classList.contains('btn-remove-target')) {
                    const targetRow = target.closest('.target-row');
                    targetRow.remove(); // Eliminación visual directa (se guarda al recolectar)
                }
            };
        }

        // --- Render Inicial ---
        renderEditor();

        // --- Guardar en Firebase ---
        const btnSave = document.getElementById('btn-save-test-data');
        btnSave.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const feedback = document.getElementById('json-editor-feedback');
            feedback.innerHTML = '';

            // Recolectar datos actuales del DOM
            let finalData;
            try {
                finalData = collectDataFromDOM();
                if (finalData.length === 0) throw new Error("Debes tener al menos un bloque.");
            } catch (err) {
                feedback.innerHTML = `<div class="alert alert-danger py-2 shadow-sm border-0"><i class="bi bi-x-circle-fill me-2"></i>Error validando formulario: ${err.message}</div>`;
                return;
            }

            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
            btn.disabled = true;

            try {
                await VocacionalService.updateTestData(finalData);
                feedback.innerHTML = `<div class="alert alert-success py-2 shadow-sm border-0"><i class="bi bi-check-circle-fill me-2"></i>Cambios guardados correctamente en la base de datos. Test actualizado con éxito.</div>`;
                // Refrescar clon interno
                testData = JSON.parse(JSON.stringify(VocacionalService.VOCACIONAL_TEST_DATA));
            } catch (error) {
                console.error(error);
                feedback.innerHTML = `<div class="alert alert-danger py-2 shadow-sm border-0"><i class="bi bi-x-circle-fill me-2"></i>Error al guardar: ${error.message}</div>`;
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                window.scrollTo(0, 0);
            }
        });
    }

    function setupEventListeners() {
        const tabs = document.querySelectorAll('#vocacional-tabs .nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                tabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                currentTab = e.currentTarget.getAttribute('data-tab');

                // Save tab state
                localStorage.setItem('sia_vocacional_admin_tab', currentTab);

                // Re-render
                const content = document.getElementById('vocacional-content');
                content.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

                await loadData();
            });
        });

        const btnExport = document.getElementById('btn-export-csv');
        if (btnExport) {
            btnExport.addEventListener('click', exportToCSV);
        }
        updateExportButtonState();
    }

    function exportToCSV() {
        if (!aspirantesData || aspirantesData.length === 0) return;

        const headers = ['Fecha_Registro', 'Nombre', 'Telefono', 'Email', 'Preparatoria', 'Carrera_Tecnica', 'Estado_Test', 'Score_Top_1', 'Carrera_Top_1', 'Alertas_Psicopedagogicas'];

        const escapeCSV = (field) => {
            if (field === undefined || field === null) return '""';
            const str = field.toString();
            // Escape double quotes specifically for CSV by doubling them and wrapping in quotes
            return `"${str.replace(/"/g, '""')}"`;
        };

        const rows = aspirantesData.map(asp => {
            const pInfo = asp.personalInfo || {};
            const isCompleted = asp.testStatus === 'completed';
            const top1Score = isCompleted && asp.recommendedCareers && asp.recommendedCareers.length > 0 ? asp.recommendedCareers[0].score : '';
            const top1Name = isCompleted && asp.recommendedCareers && asp.recommendedCareers.length > 0 ? asp.recommendedCareers[0].name : '';

            let alertsText = '';
            if (isCompleted && asp.psychopedagogicalAlerts && asp.psychopedagogicalAlerts.length > 0) {
                const normalizedAlerts = asp.psychopedagogicalAlerts.map(a => {
                    if (typeof a === 'string') {
                        try {
                            const parsed = JSON.parse(a);
                            return parsed.msg || parsed.message || parsed.texto || parsed.text || String(a);
                        } catch (e) {
                            return String(a);
                        }
                    }
                    if (typeof a === 'object' && a !== null) return a.msg || a.message || a.texto || a.text || JSON.stringify(a);
                    return String(a);
                });
                alertsText = [...new Set(normalizedAlerts)].join('; ');
            }

            let dateStr = '';
            if (asp.createdAt && asp.createdAt.toDate) {
                dateStr = asp.createdAt.toDate().toISOString().split('T')[0];
            }

            return [
                escapeCSV(dateStr),
                escapeCSV(pInfo.name),
                escapeCSV(pInfo.phone),
                escapeCSV(pInfo.email),
                escapeCSV(pInfo.highSchool),
                escapeCSV(pInfo.technicalCareer),
                escapeCSV(asp.testStatus),
                escapeCSV(top1Score),
                escapeCSV(top1Name),
                escapeCSV(alertsText)
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `prospectos_vocacional_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Public API
    const API = {
        init,
        render: async function (container) {
            isInsideReportes = true;
            const state = window.Reportes.getState();
            currentTab = state.currentTab || 'dashboard';
            await init(state.ctx, container);
        }
    };

    if (window.Reportes) window.Reportes.Vocacional = API;
    return API;

})();
