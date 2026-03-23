// modules/superadmin.js
// Módulo SuperAdmin — Panel de Control Completo
// Orquestador principal: renderiza sidebar + 5 sub-paneles dinámicamente.

if (!window.SuperAdmin) {
    window.SuperAdmin = (function () {
        'use strict';

        let _ctx = null;
        let _profile = null;
        let _charts = {};

        // Paginación state
        let _usersLastDoc = null;
        let _usersHasMore = true;
        let _usersLoading = false;
        let _usersSearchTimeout = null;
        let _usersSearchTerm = '';
        let _usersRoleFilter = 'all';

        let _logsLastDoc = null;
        let _logsHasMore = true;
        let _logsLoading = false;

        let _ticketsLastDoc = null;
        let _ticketsHasMore = true;
        let _ticketsLoading = false;
        let _ticketsFilter = 'all';
        let _ticketsClientCache = [];
        let _ticketSearchTerm = '';
        let _ticketCategoryFilter = 'all';
        let _ticketPriorityFilter = 'all';

        let _activeTab = 'dashboard';
        let _activeTicket = null;

        /** @type {string[]} Lista de todas las vistas del sistema */
        const ALL_VIEWS = [
            'view-dashboard', 'view-aula', 'view-biblio', 'view-medi',
            'view-foro', 'view-profile', 'view-lactario', 'view-quejas',
            'view-encuestas', 'view-reportes', 'view-vocacional-admin',
            'view-cafeteria', 'view-avisos', 'view-superadmin-dashboard'
        ];

        const ALL_ROLES = [
            { value: 'student', label: 'Estudiante' },
            { value: 'docente', label: 'Docente' },
            { value: 'personal', label: 'Personal' },
            { value: 'admin', label: 'Admin' },
            { value: 'medico', label: 'Médico' },
            { value: 'psicologo', label: 'Psicólogo' },
            { value: 'medico_psicologo', label: 'Psicología Legacy' },
            { value: 'biblio', label: 'Bibliotecario' },
            { value: 'biblio_admin', label: 'Admin Biblioteca Legacy' },
            { value: 'aula', label: 'Admin Aula' },
            { value: 'aula_admin', label: 'Admin Aula Legacy' },
            { value: 'foro_admin', label: 'Admin Foro Legacy' },
            { value: 'department_admin', label: 'Admin Departamento' },
            { value: 'superadmin', label: 'SuperAdmin' }
        ];

        const USER_ACCESS_PRESETS = {
            alumno: {
                label: 'Alumno',
                role: 'student',
                tipoUsuario: 'estudiante',
                allowedViews: [],
                permissions: {}
            },
            docente_general: {
                label: 'Docente',
                role: 'personal',
                tipoUsuario: 'docente',
                allowedViews: [],
                permissions: {}
            },
            docente_aula: {
                label: 'Docente en Aula',
                role: 'docente',
                tipoUsuario: 'docente',
                allowedViews: [],
                permissions: { aula: 'docente' }
            },
            administrativo: {
                label: 'Administrativo',
                role: 'personal',
                tipoUsuario: 'administrativo',
                allowedViews: [],
                permissions: {}
            },
            operativo: {
                label: 'Operativo',
                role: 'personal',
                tipoUsuario: 'operativo',
                allowedViews: [],
                permissions: {}
            },
            admin_biblioteca: {
                label: 'Admin Biblioteca',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'biblioteca',
                allowedViews: ['view-biblio'],
                permissions: { biblio: 'biblio' }
            },
            admin_medi_medico: {
                label: 'Admin Médico',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'servicios_medicos',
                specialty: 'medico',
                especialidad: 'medico',
                allowedViews: ['view-medi'],
                permissions: { medi: 'medico' }
            },
            admin_medi_psicologia: {
                label: 'Admin Psicología',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'servicios_medicos',
                specialty: 'psicologo',
                especialidad: 'psicologo',
                allowedViews: ['view-medi'],
                permissions: { medi: 'psicologo' }
            },
            admin_calidad: {
                label: 'Admin Calidad',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'calidad',
                allowedViews: ['view-lactario', 'view-quejas', 'view-encuestas'],
                permissions: { lactario: 'admin', quejas: 'admin', encuestas: 'admin' }
            },
            admin_difusion: {
                label: 'Admin Difusion',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'difusion',
                allowedViews: ['view-foro', 'view-avisos', 'view-vocacional-admin'],
                permissions: { foro: 'superadmin', avisos: 'admin', vocacional: 'admin' }
            },
            admin_foro: {
                label: 'Admin Foro',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'foro',
                allowedViews: ['view-foro'],
                permissions: { foro: 'admin' }
            },
            admin_cafeteria: {
                label: 'Admin Cafeteria',
                role: 'department_admin',
                tipoUsuario: 'administrativo',
                department: 'cafeteria',
                allowedViews: ['view-cafeteria'],
                permissions: { cafeteria: 'admin' }
            }
        };

        const STATUS_BADGES = {
            pendiente: '<span class="badge bg-warning text-dark">Pendiente</span>',
            'en-proceso': '<span class="badge bg-info text-white">En Proceso</span>',
            en_proceso: '<span class="badge bg-info text-white">En Proceso</span>',
            resuelto: '<span class="badge bg-success">Resuelto</span>',
            rechazado: '<span class="badge bg-danger">Rechazado</span>'
        };

        const PRIORITY_BADGES = {
            normal: '<span class="badge bg-secondary-subtle text-dark">Normal</span>',
            alta: '<span class="badge bg-warning-subtle text-dark">Alta</span>',
            critica: '<span class="badge bg-danger text-white">Critica</span>'
        };

        const CATEGORY_LABELS = {
            general: 'General',
            dashboard: 'Dashboard',
            aula: 'Aula Virtual',
            biblio: 'Biblioteca',
            medi: 'Servicio Médico',
            foro: 'Foro',
            cafeteria: 'Cafeteria',
            encuestas: 'Encuestas',
            quejas: 'Quejas',
            lactario: 'Lactario',
            perfil: 'Mi Perfil',
            reportes: 'Reportes',
            vocacional: 'Vocacional'
        };

        const SEVERITY_BADGES = {
            info: 'bg-secondary-subtle text-dark',
            warning: 'bg-warning-subtle text-dark',
            critical: 'bg-danger text-white',
            success: 'bg-success-subtle text-dark'
        };

        function esc(str) {
            return typeof escapeHtml === 'function' ? escapeHtml(String(str || '')) : String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        // =============================================
        // INIT
        // =============================================

        /**
         * Inicializa el módulo SuperAdmin
         * @param {Object} ctx - Contexto del router
         */
        async function init(ctx) {
            _ctx = ctx;
            _profile = ctx.profile || {};

            // Validación de acceso
            if (_profile.role !== 'superadmin' && _profile.uid !== 'G7HRuNnlePNLYr26z9ad5jBgHA82') {
                const container = document.getElementById('view-superadmin-dashboard');
                if (container) container.innerHTML = '<div class="d-flex align-items-center justify-content-center min-vh-100"><h3 class="text-danger"><i class="bi bi-shield-lock me-2"></i>Acceso Denegado</h3></div>';
                return;
            }

            renderShell();
            switchTab('dashboard');
        }

        // =============================================
        // SHELL (Sidebar + Content Area)
        // =============================================

        function renderShell() {
            const container = document.getElementById('view-superadmin-dashboard');
            if (!container) return;

            container.innerHTML = `
            <div class="d-flex flex-column flex-lg-row min-vh-100">
                <aside class="sa-sidebar" id="sa-sidebar">
                    <div class="sa-sidebar-header">
                        <img src="/images/logo-sia.png" width="40" class="filter-white mb-2">
                        <h6 class="fw-bold mb-0 text-white">SIA COMMAND</h6>
                        <small class="sa-godmode-badge">SUPERADMIN</small>
                    </div>
                    <nav class="sa-nav" id="sa-nav">
                        <button class="sa-nav-item active" data-tab="dashboard" onclick="SuperAdmin.switchTab('dashboard')">
                            <i class="bi bi-speedometer2"></i><span>Dashboard</span>
                        </button>
                        <button class="sa-nav-item" data-tab="auditoria" onclick="SuperAdmin.switchTab('auditoria')">
                            <i class="bi bi-journal-text"></i><span>Auditoría</span>
                        </button>
                        <button class="sa-nav-item" data-tab="usuarios" onclick="SuperAdmin.switchTab('usuarios')">
                            <i class="bi bi-people-fill"></i><span>Usuarios</span>
                        </button>
                        <button class="sa-nav-item" data-tab="tickets" onclick="SuperAdmin.switchTab('tickets')">
                            <i class="bi bi-ticket-detailed"></i><span>Soporte</span>
                            <span class="sa-badge-count d-none" id="sa-tickets-badge">0</span>
                        </button>
                        <button class="sa-nav-item" data-tab="config" onclick="SuperAdmin.switchTab('config')">
                            <i class="bi bi-gear-wide-connected"></i><span>Configuración</span>
                        </button>
                    </nav>
                    <div class="sa-sidebar-footer">
                        <div class="d-flex align-items-center gap-2 mb-1 small">
                            <span class="sa-dot bg-success"></span>
                            <span class="text-white-50">Firebase: Online</span>
                        </div>
                        <small class="text-white-50">SIA v3.0 — ${esc(_profile.displayName || _profile.email || 'Admin')}</small>
                    </div>
                </aside>
                <main class="sa-main" id="sa-main-content">
                    <div class="d-flex align-items-center justify-content-center h-100">
                        <div class="spinner-border text-primary"></div>
                    </div>
                </main>
            </div>`;
        }

        /**
         * Cambia el panel activo del sidebar
         * @param {string} tab - Nombre del tab
         */
        function switchTab(tab) {
            _activeTab = tab;

            // Update nav active state
            document.querySelectorAll('.sa-nav-item').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });

            const main = document.getElementById('sa-main-content');
            if (!main) return;

            main.innerHTML = '<div class="d-flex align-items-center justify-content-center py-5"><div class="spinner-border text-primary"></div></div>';

            switch (tab) {
                case 'dashboard': renderDashboard(main); break;
                case 'auditoria': renderAuditoria(main); break;
                case 'usuarios': renderUsuarios(main); break;
                case 'tickets': renderTickets(main); break;
                case 'config': renderConfig(main); break;
            }
        }

        // =============================================
        // PANEL 1: DASHBOARD
        // =============================================

        async function renderDashboard(main) {
            main.innerHTML = `
            <div class="sa-panel-header">
                <h4 class="fw-bold mb-1"><i class="bi bi-speedometer2 me-2 text-primary"></i>Dashboard</h4>
                <p class="text-muted mb-0 small">Resumen general del sistema SIA</p>
            </div>
            <div class="row g-3 mb-4" id="sa-kpi-row">
                <div class="col-6 col-lg-3"><div class="sa-kpi-card sa-kpi-blue"><div class="sa-kpi-icon"><i class="bi bi-people-fill"></i></div><div class="sa-kpi-value" id="kpi-users">—</div><div class="sa-kpi-label">Usuarios</div></div></div>
                <div class="col-6 col-lg-3"><div class="sa-kpi-card sa-kpi-orange"><div class="sa-kpi-icon"><i class="bi bi-ticket-detailed"></i></div><div class="sa-kpi-value" id="kpi-tickets">—</div><div class="sa-kpi-label">Tickets Abiertos</div></div></div>
                <div class="col-6 col-lg-3"><div class="sa-kpi-card sa-kpi-green"><div class="sa-kpi-icon"><i class="bi bi-journal-check"></i></div><div class="sa-kpi-value" id="kpi-logs">—</div><div class="sa-kpi-label">Logs (7 días)</div></div></div>
                <div class="col-6 col-lg-3"><div class="sa-kpi-card sa-kpi-purple"><div class="sa-kpi-icon"><i class="bi bi-grid-fill"></i></div><div class="sa-kpi-value" id="kpi-modules">6</div><div class="sa-kpi-label">Módulos Activos</div></div></div>
            </div>
            <div class="row g-3">
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm rounded-4">
                        <div class="card-header bg-white border-0 py-3"><h6 class="fw-bold mb-0"><i class="bi bi-pie-chart-fill text-primary me-2"></i>Distribución de Usuarios</h6></div>
                        <div class="card-body" style="height:300px"><canvas id="sa-chart-dist"></canvas></div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm rounded-4 h-100">
                        <div class="card-header bg-white border-0 py-3"><h6 class="fw-bold mb-0"><i class="bi bi-ticket-detailed text-warning me-2"></i>Tickets Recientes</h6></div>
                        <div class="card-body p-0" id="sa-dash-tickets"><p class="text-muted text-center py-4 small">Cargando...</p></div>
                    </div>
                </div>
            </div>`;

            // Load data in parallel
            try {
                const [userStats, ticketStats] = await Promise.all([
                    SuperAdminService.getUserStats(_ctx),
                    SuperAdminService.getTicketStats(_ctx).catch(() => ({ total: 0, pendiente: 0, lastWeek: 0 }))
                ]);

                // KPIs
                const kpiUsers = document.getElementById('kpi-users');
                const kpiTickets = document.getElementById('kpi-tickets');
                const kpiLogs = document.getElementById('kpi-logs');
                if (kpiUsers) kpiUsers.textContent = userStats.totalUsers.toLocaleString();
                if (kpiTickets) kpiTickets.textContent = ticketStats.pendiente + (ticketStats.en_proceso || 0);
                if (kpiLogs) kpiLogs.textContent = ticketStats.lastWeek || '—';

                // Distribution chart — lazy load Chart.js
                const ctxChart = document.getElementById('sa-chart-dist')?.getContext('2d');
                if (ctxChart) {
                    // Load Chart.js from CDN if not available
                    if (typeof Chart === 'undefined') {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
                            s.onload = resolve;
                            s.onerror = reject;
                            document.head.appendChild(s);
                        });
                    }
                    if (_charts.dist) _charts.dist.destroy();
                    const dist = userStats.roleDistribution;
                    _charts.dist = new Chart(ctxChart, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(dist).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
                            datasets: [{
                                data: Object.values(dist),
                                backgroundColor: ['#4f46e5', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1']
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } } } }
                    });
                }

                // Recent tickets
                const ticketContainer = document.getElementById('sa-dash-tickets');
                if (ticketContainer) {
                    const recent = await SuperAdminService.getSupportTickets(_ctx, {}, { limit: 5 });
                    if (recent.length === 0) {
                        ticketContainer.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i><small>Sin tickets de soporte</small></div>';
                    } else {
                        ticketContainer.innerHTML = '<div class="list-group list-group-flush">' + recent.map(t => `
                            <div class="list-group-item border-0 px-3 py-2">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="small"><span class="fw-bold">${esc(t.userName)}</span><br><span class="text-muted extra-small">${esc(t.descripcion?.substring(0, 60) || '')}</span></div>
                                    ${STATUS_BADGES[t.status] || '<span class="badge bg-secondary">?</span>'}
                                </div>
                            </div>`).join('') + '</div>';
                    }
                }
            } catch (e) {
                console.error('[SuperAdmin] Error loading dashboard:', e);
            }
        }

        // =============================================
        // PANEL 2: AUDITORÍA
        // =============================================

        async function renderAuditoria(main) {
            _logsLastDoc = null;
            _logsHasMore = true;

            main.innerHTML = `
            <div class="sa-panel-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <h4 class="fw-bold mb-1"><i class="bi bi-journal-text me-2 text-primary"></i>Bitácora de Auditoría</h4>
                    <p class="text-muted mb-0 small">Registro de todas las acciones administrativas</p>
                </div>
                <button class="btn btn-outline-success btn-sm rounded-pill" onclick="SuperAdmin.exportLogs()"><i class="bi bi-download me-1"></i>Exportar CSV</button>
            </div>
            <div class="sa-filter-bar mb-3">
                <select class="form-select form-select-sm" id="sa-log-module" style="max-width:160px"><option value="all">Todos los módulos</option><option value="users">Usuarios</option><option value="config">Configuración</option><option value="tickets">Tickets</option><option value="superadmin">SuperAdmin</option><option value="system">Sistema</option></select>
                <select class="form-select form-select-sm" id="sa-log-action" style="max-width:160px"><option value="all">Todas las acciones</option><option value="UPDATE_USER">Editar usuario</option><option value="UPDATE_CONFIG">Config cambio</option><option value="CREATE_GLOBAL_NOTICE">Crear aviso</option><option value="UPDATE_TICKET_STATUS">Ticket cambio</option><option value="ENABLE_MODULE">Habilitar módulo</option><option value="DISABLE_MODULE">Deshabilitar módulo</option></select>
                <input type="date" class="form-control form-control-sm" id="sa-log-from" style="max-width:150px" title="Desde">
                <input type="date" class="form-control form-control-sm" id="sa-log-to" style="max-width:150px" title="Hasta">
                <button class="btn btn-primary btn-sm rounded-pill px-3" onclick="SuperAdmin.filterLogs()"><i class="bi bi-search"></i></button>
            </div>
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="table-responsive" style="max-height:65vh">
                    <table class="table table-sm table-hover align-middle mb-0 sa-table">
                        <thead class="table-light small fw-bold text-muted text-uppercase sticky-top">
                            <tr><th>Fecha</th><th>Admin</th><th>Acción</th><th>Módulo</th><th>Detalles</th></tr>
                        </thead>
                        <tbody id="sa-logs-body"></tbody>
                    </table>
                </div>
                <div class="card-footer bg-white text-center py-2" id="sa-logs-footer"></div>
            </div>`;

            await loadLogs(false);
        }

        async function loadLogs(append) {
            if (_logsLoading) return;
            _logsLoading = true;

            const tbody = document.getElementById('sa-logs-body');
            const footer = document.getElementById('sa-logs-footer');
            if (!tbody) { _logsLoading = false; return; }

            if (!append) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
                _logsLastDoc = null;
                _logsHasMore = true;
            }

            const filters = {
                module: document.getElementById('sa-log-module')?.value || 'all',
                action: document.getElementById('sa-log-action')?.value || 'all',
                dateFrom: document.getElementById('sa-log-from')?.value || null,
                dateTo: document.getElementById('sa-log-to')?.value || null
            };

            try {
                const logs = await SuperAdminService.getLogs(_ctx, filters, { limit: 30, lastDoc: _logsLastDoc });
                _logsLoading = false;

                if (logs.length < 30) _logsHasMore = false;
                if (logs.length > 0) _logsLastDoc = logs[logs.length - 1]._doc;

                const html = logs.map(log => {
                    const date = log.timestamp ? log.timestamp.toLocaleString() : 'Reciente...';
                    const sevClass = SEVERITY_BADGES[log.severity] || SEVERITY_BADGES.info;
                    const details = log.details ? JSON.stringify(log.details) : '';
                    const shortDetails = details.length > 80 ? details.substring(0, 80) + '...' : details;
                    return `<tr>
                        <td class="text-nowrap small">${esc(date)}</td>
                        <td class="fw-bold small">${esc(log.adminName)}</td>
                        <td><span class="badge ${sevClass} extra-small">${esc(log.action)}</span></td>
                        <td class="small text-muted">${esc(log.module)}</td>
                        <td class="small text-muted" title="${esc(details)}">${esc(shortDetails)}</td>
                    </tr>`;
                }).join('');

                if (!append) {
                    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center py-4 text-muted">No hay registros.</td></tr>';
                } else {
                    tbody.insertAdjacentHTML('beforeend', html);
                }

                if (footer) {
                    footer.innerHTML = _logsHasMore
                        ? '<button class="btn btn-outline-primary btn-sm rounded-pill" onclick="SuperAdmin.loadMoreLogs()"><i class="bi bi-arrow-down-circle me-1"></i>Cargar más</button>'
                        : '<small class="text-muted">Fin de los registros</small>';
                }
            } catch (e) {
                _logsLoading = false;
                console.error('[SuperAdmin] Error loading logs:', e);
                if (!append) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error al cargar logs.</td></tr>';
            }
        }

        function filterLogs() { loadLogs(false); }
        function loadMoreLogs() { loadLogs(true); }
        async function exportLogs() {
            if (typeof showToast === 'function') showToast('Generando CSV...', 'info');
            try {
                const filters = {
                    module: document.getElementById('sa-log-module')?.value || 'all',
                    action: document.getElementById('sa-log-action')?.value || 'all',
                    dateFrom: document.getElementById('sa-log-from')?.value || null,
                    dateTo: document.getElementById('sa-log-to')?.value || null
                };
                await SuperAdminService.exportLogsCSV(_ctx, filters);
                if (typeof showToast === 'function') showToast('CSV descargado', 'success');
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error al exportar', 'danger');
            }
        }

        // =============================================
        // PANEL 3: USUARIOS
        // =============================================

        async function renderUsuarios(main) {
            _usersLastDoc = null;
            _usersHasMore = true;
            _usersSearchTerm = '';
            _usersRoleFilter = 'all';

            main.innerHTML = `
            <div class="sa-panel-header">
                <h4 class="fw-bold mb-1"><i class="bi bi-people-fill me-2 text-primary"></i>Gestión de Usuarios</h4>
                <p class="text-muted mb-0 small">Administra roles, permisos y vistas permitidas</p>
            </div>
            <div class="sa-filter-bar mb-3">
                <input type="text" class="form-control form-control-sm" id="sa-user-search" placeholder="Buscar por nombre o matrícula..." style="max-width:280px">
                <select class="form-select form-select-sm" id="sa-user-role-filter" style="max-width:180px" onchange="SuperAdmin.filterUsers()">
                    <option value="all">Todos los roles</option>
                    ${ALL_ROLES.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
                </select>
            </div>
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="table-responsive" style="max-height:65vh">
                    <table class="table table-hover align-middle mb-0 sa-table">
                        <thead class="table-light small fw-bold text-muted text-uppercase sticky-top">
                            <tr><th>Usuario</th><th>Matrícula</th><th>Rol</th><th>Estado</th><th>Vistas</th><th>Acciones</th></tr>
                        </thead>
                        <tbody id="sa-users-body"></tbody>
                    </table>
                </div>
                <div class="card-footer bg-white text-center py-2" id="sa-users-footer"></div>
            </div>`;

            // Search debounce
            const searchInput = document.getElementById('sa-user-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    clearTimeout(_usersSearchTimeout);
                    _usersSearchTimeout = setTimeout(() => {
                        _usersSearchTerm = searchInput.value;
                        loadUsers(false);
                    }, 400);
                });
            }

            await loadUsers(false);
        }

        async function loadUsers(append) {
            if (_usersLoading) return;
            _usersLoading = true;

            const tbody = document.getElementById('sa-users-body');
            const footer = document.getElementById('sa-users-footer');
            if (!tbody) { _usersLoading = false; return; }

            if (!append) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
                _usersLastDoc = null;
                _usersHasMore = true;
            }

            try {
                const users = await SuperAdminService.getUsers(_ctx, {
                    limit: 30,
                    lastDoc: _usersLastDoc,
                    searchTerm: _usersSearchTerm,
                    roleFilter: _usersRoleFilter
                });
                _usersLoading = false;

                if (users.length < 30) _usersHasMore = false;
                if (users.length > 0) _usersLastDoc = users[users.length - 1]._doc;

                const html = users.map(u => {
                    const roleBadge = getRoleBadge(u.role);
                    const tipoUsuario = u.tipoUsuario ? `<div class="extra-small text-muted mt-1 text-capitalize">${esc(u.tipoUsuario)}</div>` : '';
                    const departmentMeta = u.department ? `<div class="extra-small text-muted">${esc(u.department)}</div>` : '';
                    const statusBadge = u.status === 'suspended'
                        ? '<span class="badge bg-danger rounded-pill">Suspendido</span>'
                        : '<span class="badge bg-success rounded-pill">Activo</span>';
                    const effectiveViews = window.SIA?.getEffectiveAllowedViews ? window.SIA.getEffectiveAllowedViews(u) : (u.allowedViews || []);
                    const viewsCount = effectiveViews.length;
                    const viewsLabel = viewsCount > 0 ? `<span class="badge bg-primary-subtle text-primary extra-small">${viewsCount} vistas</span>` : '<span class="extra-small text-muted">Sin restricción</span>';

                    return `<tr>
                        <td><div class="fw-bold small">${esc(u.displayName || 'Sin nombre')}</div><div class="extra-small text-muted">${esc(u.email || '')}</div>${departmentMeta}</td>
                        <td class="font-monospace small">${esc(u.matricula || '---')}</td>
                        <td>${roleBadge}${tipoUsuario}</td>
                        <td>${statusBadge}</td>
                        <td>${viewsLabel}</td>
                        <td><button class="btn btn-light btn-sm rounded-circle border shadow-sm" onclick="SuperAdmin.openUserModal('${u.id}')"><i class="bi bi-pencil-square"></i></button></td>
                    </tr>`;
                }).join('');

                if (!append) {
                    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron usuarios.</td></tr>';
                } else {
                    tbody.insertAdjacentHTML('beforeend', html);
                }

                if (footer) {
                    footer.innerHTML = _usersHasMore
                        ? '<button class="btn btn-outline-primary btn-sm rounded-pill" onclick="SuperAdmin.loadMoreUsers()"><i class="bi bi-arrow-down-circle me-1"></i>Cargar más</button>'
                        : '<small class="text-muted">Fin del directorio</small>';
                }
            } catch (e) {
                _usersLoading = false;
                console.error('[SuperAdmin] Error loading users:', e);
                if (!append) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar usuarios.</td></tr>';
            }
        }

        function filterUsers() {
            _usersRoleFilter = document.getElementById('sa-user-role-filter')?.value || 'all';
            loadUsers(false);
        }
        function loadMoreUsers() { loadUsers(true); }

        function getRoleBadge(role) {
            const map = { superadmin: 'bg-dark', admin: 'bg-dark', medico: 'bg-danger', medico_psicologo: 'bg-danger-subtle text-danger', psicologo: 'bg-pink', biblio: 'bg-warning text-dark', biblio_admin: 'bg-warning text-dark', student: 'bg-secondary-subtle text-dark', aula: 'bg-success', aula_admin: 'bg-success', foro_admin: 'bg-info', docente: 'bg-primary', personal: 'bg-primary-subtle text-primary', department_admin: 'bg-info text-dark' };
            return `<span class="badge ${map[role] || 'bg-secondary'} rounded-pill">${esc((role || 'student').toUpperCase())}</span>`;
        }

        function inferUserPreset(user) {
            const role = user.role || 'student';
            const tipoUsuario = (user.tipoUsuario || '').toLowerCase();
            const department = (user.department || '').toLowerCase();
            const specialty = (user.specialty || user.especialidad || '').toLowerCase();
            const permissions = user.permissions || {};

            if (role === 'student') return 'alumno';
            if (role === 'docente' || permissions.aula === 'docente') return 'docente_aula';
            if (role === 'personal' && tipoUsuario === 'docente') return 'docente_general';
            if (role === 'personal' && tipoUsuario === 'operativo') return 'operativo';
            if (role === 'personal') return 'administrativo';
            if (role === 'department_admin' && (permissions.biblio === 'biblio' || permissions.biblio === 'admin')) return 'admin_biblioteca';
            if (role === 'department_admin' && specialty === 'medico') return 'admin_medi_medico';
            if (role === 'department_admin' && specialty === 'psicologo') return 'admin_medi_psicologia';
            if (role === 'department_admin' && department === 'calidad') return 'admin_calidad';
            if (role === 'department_admin' && department === 'difusion') return 'admin_difusion';
            if (role === 'department_admin' && permissions.cafeteria === 'admin') return 'admin_cafeteria';
            if (role === 'department_admin' && permissions.foro) return 'admin_foro';
            return 'custom';
        }

        function setModalViews(views) {
            const viewSet = new Set(Array.isArray(views) ? views : []);
            document.querySelectorAll('.sa-view-check').forEach((check) => {
                check.checked = viewSet.has(check.value);
            });
        }

        function setModalPermissions(permissions) {
            const container = document.getElementById('sa-edit-perms');
            if (!container) return;

            const entries = Object.entries(permissions || {});
            container.innerHTML = entries.map(([k, v]) => `
                <div class="input-group input-group-sm">
                    <input class="form-control sa-perm-key" value="${esc(k)}" placeholder="Módulo o clave (ej. aula, medi)">
                    <input class="form-control sa-perm-val" value="${esc(v)}" placeholder="Nivel (ej. admin, docente, medico)">
                    <button class="btn btn-outline-danger" onclick="this.closest('.input-group').remove(); SuperAdmin.handleUserConfigChange()"><i class="bi bi-x"></i></button>
                </div>`).join('');
        }

        function applyUserPreset() {
            const presetKey = document.getElementById('sa-edit-preset')?.value || 'custom';
            if (presetKey === 'custom') return;

            const preset = USER_ACCESS_PRESETS[presetKey];
            if (!preset) return;

            const roleEl = document.getElementById('sa-edit-role');
            const tipoUsuarioEl = document.getElementById('sa-edit-tipo-usuario');
            const departmentEl = document.getElementById('sa-edit-department');
            const specialtyEl = document.getElementById('sa-edit-specialty');

            if (roleEl) roleEl.value = preset.role || 'student';
            if (tipoUsuarioEl) tipoUsuarioEl.value = preset.tipoUsuario || '';
            if (departmentEl) departmentEl.value = preset.department || '';
            if (specialtyEl) specialtyEl.value = preset.specialty || preset.especialidad || '';

            setModalViews(preset.allowedViews || []);
            setModalPermissions(preset.permissions || {});
            updateUserEditSummary();
        }

        function getViewLabel(viewId) {
            const labels = {
                'view-dashboard': 'Dashboard',
                'view-aula': 'Aula',
                'view-biblio': 'Biblioteca',
                'view-medi': 'Servicios Médicos',
                'view-foro': 'Eventos',
                'view-lactario': 'Lactario',
                'view-quejas': 'Quejas',
                'view-encuestas': 'Encuestas',
                'view-reportes': 'Reportes',
                'view-vocacional-admin': 'Vocacional',
                'view-cafeteria': 'Cafeteria',
                'view-avisos': 'Avisos',
                'view-profile': 'Perfil',
                'view-superadmin-dashboard': 'SuperAdmin'
            };
            return labels[viewId] || viewId;
        }

        function markUserPresetAsCustom() {
            const presetEl = document.getElementById('sa-edit-preset');
            if (presetEl && presetEl.value !== 'custom') presetEl.value = 'custom';
        }

        function handleUserConfigChange() {
            markUserPresetAsCustom();
            updateUserEditSummary();
        }

        function updateUserEditSummary() {
            const summaryEl = document.getElementById('sa-edit-summary');
            if (!summaryEl) return;

            const presetKey = document.getElementById('sa-edit-preset')?.value || 'custom';
            const role = document.getElementById('sa-edit-role')?.value || 'student';
            const tipoUsuario = document.getElementById('sa-edit-tipo-usuario')?.value || '';
            const department = document.getElementById('sa-edit-department')?.value?.trim() || '';
            const specialty = document.getElementById('sa-edit-specialty')?.value || '';
            const allowedViews = Array.from(document.querySelectorAll('.sa-view-check:checked')).map((check) => check.value);
            const permissions = {};

            document.querySelectorAll('#sa-edit-perms .input-group').forEach((row) => {
                const key = row.querySelector('.sa-perm-key')?.value?.trim();
                const value = row.querySelector('.sa-perm-val')?.value?.trim() || '';
                if (key) permissions[key] = value;
            });

            const effectiveViews = window.SIA?.getEffectiveAllowedViews
                ? window.SIA.getEffectiveAllowedViews({ role, tipoUsuario, department, specialty, especialidad: specialty, allowedViews, permissions })
                : allowedViews;

            const lines = [];
            if (presetKey !== 'custom' && USER_ACCESS_PRESETS[presetKey]) {
                lines.push(`<div class="fw-bold text-dark mb-1">${esc(USER_ACCESS_PRESETS[presetKey].label)}</div>`);
            } else {
                lines.push('<div class="fw-bold text-dark mb-1">Configuración manual</div>');
            }

            if (role === 'student') lines.push('Entrara como alumno con acceso general.');
            else if (role === 'docente') lines.push('Entrara como docente y podra usar Aula en modo profesor.');
            else if (role === 'department_admin') lines.push('Entrara como administrador de departamento.');
            else if (role === 'superadmin') lines.push('Tendra control total del sistema.');
            else lines.push(`Entrara como ${esc(tipoUsuario || role)}.`);

            if (specialty === 'medico') lines.push('Servicios Médicos quedará en modo Médico.');
            if (specialty === 'psicologo') lines.push('Servicios Médicos quedará en modo Psicología.');
            if (permissions.aula === 'docente') lines.push('Aula tendra acceso docente.');
            if (permissions.biblio) lines.push('Biblioteca quedara en modo administracion.');
            if (permissions.foro) lines.push('Eventos quedara en modo administracion.');
            if (permissions.cafeteria) lines.push('Cafeteria quedara en modo administracion.');
            if (permissions.avisos) lines.push('Podra publicar avisos institucionales.');
            if (department) lines.push(`Departamento asignado: ${esc(department)}.`);

            if (effectiveViews.length) {
                lines.push(`Vera: ${effectiveViews.map(getViewLabel).join(', ')}.`);
            }

            summaryEl.innerHTML = lines.map((line) => `<div class="small text-muted">${line}</div>`).join('');
        }

        /**
         * Abre el modal de edición avanzada de usuario
         * @param {string} uid - UID del usuario
         */
        async function openUserModal(uid) {
            const user = await SuperAdminService.getUserDetail(_ctx, uid);
            if (!user) { if (typeof showToast === 'function') showToast('Usuario no encontrado', 'danger'); return; }

            const allowedViews = user.allowedViews || [];
            const permissions = user.permissions || {};
            const inferredPreset = inferUserPreset(user);

            // Create/show modal
            let modal = document.getElementById('sa-modal-edit-user');
            if (modal) modal.remove();

            const modalHtml = `
            <div class="modal fade" id="sa-modal-edit-user" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content rounded-4 border-0 shadow-lg">
                <div class="modal-header bg-dark text-white border-0 p-4">
                    <div>
                        <h5 class="fw-bold mb-0">Editar Usuario</h5>
                        <small class="text-white-50">${esc(user.displayName)} — ${esc(user.email)}</small>
                    </div>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <input type="hidden" id="sa-edit-uid" value="${uid}">
                    <div class="row g-3">
                        <div class="col-12">
                            <label class="form-label small fw-bold">Perfil de Acceso</label>
                            <select class="form-select" id="sa-edit-preset" onchange="SuperAdmin.applyUserPreset()">
                                <option value="custom" ${inferredPreset === 'custom' ? 'selected' : ''}>Configuración manual</option>
                                ${Object.entries(USER_ACCESS_PRESETS).map(([key, preset]) => `<option value="${key}" ${inferredPreset === key ? 'selected' : ''}>${preset.label}</option>`).join('')}
                            </select>
                            <div class="form-text">Aplica una configuración estándar y luego ajusta detalles si hace falta.</div>
                        </div>
                        <div class="col-12">
                            <div class="rounded-4 border bg-light p-3">
                                <div class="small fw-bold text-dark mb-2">Resumen del acceso</div>
                                <div id="sa-edit-summary" class="vstack gap-1"></div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">Rol técnico</label>
                            <select class="form-select" id="sa-edit-role">
                                ${ALL_ROLES.map(r => `<option value="${r.value}" ${user.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">Estado</label>
                            <select class="form-select" id="sa-edit-status">
                                <option value="active" ${user.status !== 'suspended' ? 'selected' : ''}>Activo</option>
                                <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspendido</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">Tipo de usuario real</label>
                            <select class="form-select" id="sa-edit-tipo-usuario">
                                <option value="">Sin definir</option>
                                <option value="estudiante" ${user.tipoUsuario === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                                <option value="docente" ${user.tipoUsuario === 'docente' ? 'selected' : ''}>Docente</option>
                                <option value="administrativo" ${user.tipoUsuario === 'administrativo' ? 'selected' : ''}>Administrativo</option>
                                <option value="operativo" ${user.tipoUsuario === 'operativo' ? 'selected' : ''}>Operativo</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">Departamento</label>
                            <input class="form-control" id="sa-edit-department" value="${esc(user.department || '')}" placeholder="biblioteca, calidad, difusion...">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">Especialidad</label>
                            <select class="form-select" id="sa-edit-specialty">
                                <option value="">Sin especialidad</option>
                                <option value="medico" ${(user.specialty || user.especialidad) === 'medico' ? 'selected' : ''}>Médico</option>
                                <option value="psicologo" ${(user.specialty || user.especialidad) === 'psicologo' ? 'selected' : ''}>Psicólogo</option>
                            </select>
                        </div>
                        <div class="col-12">
                            <details class="rounded-4 border p-3 bg-white">
                                <summary class="fw-bold small text-dark">Configuración avanzada</summary>
                                <div class="form-text mt-2 mb-3">Solo usa esta sección si el perfil rápido no te alcanza.</div>
                            <label class="form-label small fw-bold">Vistas visibles</label>
                            <p class="extra-small text-muted mb-2">Si no seleccionas ninguna, el usuario tendrá acceso según su rol.</p>
                            <div class="row g-2" id="sa-edit-views">
                                ${ALL_VIEWS.map(v => `<div class="col-6 col-md-4"><div class="form-check"><input class="form-check-input sa-view-check" type="checkbox" value="${v}" id="chk-${v}" ${allowedViews.includes(v) ? 'checked' : ''}><label class="form-check-label extra-small" for="chk-${v}">${v.replace('view-', '')}</label></div></div>`).join('')}
                            </div>
                            <label class="form-label small fw-bold">Permisos técnicos por módulo</label>
                            <p class="extra-small text-muted mb-2">Ejemplos: aula = docente, medi = medico, foro = admin, avisos = admin.</p>
                            <div id="sa-edit-perms" class="vstack gap-2">
                                ${Object.entries(permissions).map(([k, v]) => `<div class="input-group input-group-sm"><input class="form-control sa-perm-key" value="${esc(k)}" placeholder="Módulo o clave (ej. aula, medi)"><input class="form-control sa-perm-val" value="${esc(v)}" placeholder="Nivel (ej. admin, docente, medico)"><button class="btn btn-outline-danger" onclick="this.closest('.input-group').remove(); SuperAdmin.handleUserConfigChange()"><i class="bi bi-x"></i></button></div>`).join('')}
                            </div>
                            <button class="btn btn-outline-secondary btn-sm mt-2 rounded-pill" onclick="SuperAdmin.addPermRow()"><i class="bi bi-plus me-1"></i>Agregar permiso técnico</button>
                            </details>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0 p-4 pt-0">
                    <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-dark rounded-pill px-4 shadow-sm" onclick="SuperAdmin.saveUser()">Guardar Cambios</button>
                </div>
            </div></div></div>`;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalEl = document.getElementById('sa-modal-edit-user');
            updateUserEditSummary();

            const syncSummary = (event) => {
                const target = event?.target;
                if (!target || target.id === 'sa-edit-preset' || target.id === 'sa-edit-status') return;
                markUserPresetAsCustom();
                updateUserEditSummary();
            };

            modalEl?.addEventListener('input', syncSummary);
            modalEl?.addEventListener('change', syncSummary);

            const bsModal = new bootstrap.Modal(modalEl);
            bsModal.show();
        }

        async function saveUser() {
            const uid = document.getElementById('sa-edit-uid')?.value;
            if (!uid) return;

            const newRole = document.getElementById('sa-edit-role')?.value;
            const newStatus = document.getElementById('sa-edit-status')?.value;
            const tipoUsuario = document.getElementById('sa-edit-tipo-usuario')?.value?.trim() || '';
            const department = document.getElementById('sa-edit-department')?.value?.trim() || '';
            const specialty = document.getElementById('sa-edit-specialty')?.value?.trim() || '';

            // Collect allowedViews
            const checks = document.querySelectorAll('.sa-view-check:checked');
            const allowedViews = Array.from(checks).map(c => c.value);

            // Collect permissions
            const permKeys = document.querySelectorAll('.sa-perm-key');
            const permVals = document.querySelectorAll('.sa-perm-val');
            const permissions = {};
            permKeys.forEach((k, i) => {
                if (k.value.trim()) permissions[k.value.trim()] = permVals[i]?.value || '';
            });

            const updates = { role: newRole, status: newStatus };
            if (allowedViews.length > 0) updates.allowedViews = allowedViews;
            else updates.allowedViews = firebase.firestore.FieldValue.delete();
            if (Object.keys(permissions).length > 0) updates.permissions = permissions;
            else updates.permissions = firebase.firestore.FieldValue.delete();
            if (tipoUsuario) updates.tipoUsuario = tipoUsuario;
            else updates.tipoUsuario = firebase.firestore.FieldValue.delete();
            if (department) updates.department = department;
            else updates.department = firebase.firestore.FieldValue.delete();
            if (specialty) {
                updates.specialty = specialty;
                updates.especialidad = specialty;
            } else {
                updates.specialty = firebase.firestore.FieldValue.delete();
                updates.especialidad = firebase.firestore.FieldValue.delete();
            }

            try {
                await SuperAdminService.updateUser(_ctx, uid, updates);
                if (typeof showToast === 'function') showToast('Usuario actualizado', 'success');
                bootstrap.Modal.getInstance(document.getElementById('sa-modal-edit-user'))?.hide();
                loadUsers(false);
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error: ' + e.message, 'danger');
            }
        }

        // =============================================
        // PANEL 4: TICKETS DE SOPORTE
        // =============================================

        function _ticketActivityDate(ticket) {
            return ticket.lastActivityAt || ticket.updatedAt || ticket.createdAt || null;
        }

        function _ticketDateLabel(date) {
            return date ? new Date(date).toLocaleString() : '---';
        }

        function _ticketSearchBlob(ticket) {
            return [
                ticket.id,
                ticket.userName,
                ticket.userEmail,
                ticket.titulo,
                ticket.descripcion,
                ticket.categoria,
                ticket.tipo
            ].join(' ').toLowerCase();
        }

        function _filterLoadedTickets() {
            const term = (_ticketSearchTerm || '').trim().toLowerCase();
            return _ticketsClientCache.filter(ticket => {
                if (_ticketCategoryFilter !== 'all' && (ticket.categoria || 'general') !== _ticketCategoryFilter) return false;
                if (_ticketPriorityFilter !== 'all' && (ticket.priority || 'normal') !== _ticketPriorityFilter) return false;
                if (term && !_ticketSearchBlob(ticket).includes(term)) return false;
                return true;
            }).sort((a, b) => {
                const aTime = _ticketActivityDate(a)?.getTime() || 0;
                const bTime = _ticketActivityDate(b)?.getTime() || 0;
                return bTime - aTime;
            });
        }

        function _renderTicketRows() {
            const tbody = document.getElementById('sa-tickets-body');
            if (!tbody) return;

            const tickets = _filterLoadedTickets();
            if (!tickets.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No hay tickets que coincidan con los filtros activos.</td></tr>';
                return;
            }

            tbody.innerHTML = tickets.map(ticket => {
                const shortId = ticket.id.substring(0, 6).toUpperCase();
                const dateLabel = _ticketDateLabel(_ticketActivityDate(ticket));
                const responseCount = Number(ticket.responsesCount || 0);
                return `<tr>
                    <td class="font-monospace small fw-bold">#${shortId}</td>
                    <td class="small">
                        <div class="fw-bold">${esc(ticket.userName || 'Usuario')}</div>
                        <div class="extra-small text-muted">${esc(ticket.userEmail || '')}</div>
                    </td>
                    <td class="small">
                        <div class="fw-bold">${esc(ticket.titulo || `${ticket.tipo || 'bug'} en ${ticket.categoria || 'general'}`)}</div>
                        <div class="text-muted extra-small">${esc(CATEGORY_LABELS[ticket.categoria] || ticket.categoria || 'General')} • ${esc(ticket.tipo || 'bug')}</div>
                        <div class="text-muted extra-small">${esc((ticket.descripcion || '').substring(0, 90))}</div>
                    </td>
                    <td>${PRIORITY_BADGES[ticket.priority || 'normal'] || PRIORITY_BADGES.normal}</td>
                    <td>${STATUS_BADGES[ticket.status] || '<span class="badge bg-secondary">?</span>'}</td>
                    <td class="small text-nowrap">
                        <div>${esc(dateLabel)}</div>
                        <div class="extra-small text-muted">${responseCount} respuesta(s)</div>
                    </td>
                    <td><button class="btn btn-light btn-sm rounded-circle border" onclick="SuperAdmin.openTicketModal('${ticket.id}')"><i class="bi bi-eye"></i></button></td>
                </tr>`;
            }).join('');
        }

        async function renderTicketsPanel(main) {
            _ticketsLastDoc = null;
            _ticketsHasMore = true;
            _ticketsLoading = false;
            _ticketsFilter = 'all';
            _ticketsClientCache = [];
            _ticketSearchTerm = '';
            _ticketCategoryFilter = 'all';
            _ticketPriorityFilter = 'all';

            main.innerHTML = `
            <div class="sa-panel-header">
                <h4 class="fw-bold mb-1"><i class="bi bi-ticket-detailed me-2 text-primary"></i>Centro de Soporte Tecnico</h4>
                <p class="text-muted mb-0 small">Mesa de seguimiento para los reportes enviados desde el FAB de soporte.</p>
            </div>
            <div class="row g-3 mb-4" id="sa-ticket-stats">
                <div class="col-4 col-lg"><div class="sa-stat-pill"><span class="fw-bold" id="ts-total">-</span><span class="extra-small text-muted">Total</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-warning"><span class="fw-bold text-warning" id="ts-pend">-</span><span class="extra-small text-muted">Pendientes</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-info"><span class="fw-bold text-info" id="ts-proc">-</span><span class="extra-small text-muted">En Proceso</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-success"><span class="fw-bold text-success" id="ts-done">-</span><span class="extra-small text-muted">Resueltos</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-danger"><span class="fw-bold text-danger" id="ts-rej">-</span><span class="extra-small text-muted">Rechazados</span></div></div>
            </div>
            <div class="sa-filter-bar mb-3 d-flex flex-wrap gap-2 align-items-center">
                <select class="form-select form-select-sm" id="sa-ticket-filter" style="max-width:180px" onchange="SuperAdmin.filterTickets()">
                    <option value="all">Todos los estados</option>
                    <option value="pendiente">Pendientes</option>
                    <option value="en-proceso">En Proceso</option>
                    <option value="resuelto">Resueltos</option>
                    <option value="rechazado">Rechazados</option>
                </select>
                <select class="form-select form-select-sm" id="sa-ticket-category-filter" style="max-width:180px" onchange="SuperAdmin.filterTickets()">
                    <option value="all">Todos los módulos</option>
                    ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                </select>
                <select class="form-select form-select-sm" id="sa-ticket-priority-filter" style="max-width:180px" onchange="SuperAdmin.filterTickets()">
                    <option value="all">Todas las prioridades</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Critica</option>
                </select>
                <input class="form-control form-control-sm" id="sa-ticket-search" style="max-width:260px" placeholder="Buscar por folio, usuario o texto..." oninput="SuperAdmin.filterTickets()">
            </div>
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="table-responsive" style="max-height:55vh">
                    <table class="table table-hover align-middle mb-0 sa-table">
                        <thead class="table-light small fw-bold text-muted text-uppercase sticky-top">
                            <tr><th>ID</th><th>Usuario</th><th>Ticket</th><th>Prioridad</th><th>Estado</th><th>Ult. actividad</th><th></th></tr>
                        </thead>
                        <tbody id="sa-tickets-body"></tbody>
                    </table>
                </div>
                <div class="card-footer bg-white text-center py-2" id="sa-tickets-footer"></div>
            </div>`;

            try {
                const stats = await SuperAdminService.getTicketStats(_ctx);
                const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
                setValue('ts-total', stats.total);
                setValue('ts-pend', stats.pendiente);
                setValue('ts-proc', stats.en_proceso);
                setValue('ts-done', stats.resuelto);
                setValue('ts-rej', stats.rechazado);
            } catch (e) { }

            await loadTicketsData(false);
        }

        async function loadTicketsData(append) {
            if (_ticketsLoading) return;
            _ticketsLoading = true;

            const tbody = document.getElementById('sa-tickets-body');
            const footer = document.getElementById('sa-tickets-footer');
            if (!tbody) {
                _ticketsLoading = false;
                return;
            }

            if (!append) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
                _ticketsLastDoc = null;
                _ticketsHasMore = true;
                _ticketsClientCache = [];
            }

            try {
                const filter = document.getElementById('sa-ticket-filter')?.value || 'all';
                const tickets = await SuperAdminService.getSupportTickets(_ctx, { status: filter }, { limit: 40, lastDoc: _ticketsLastDoc });

                if (tickets.length < 40) _ticketsHasMore = false;
                if (tickets.length > 0) _ticketsLastDoc = tickets[tickets.length - 1]._doc;

                _ticketsClientCache = append ? _ticketsClientCache.concat(tickets) : tickets;
                _renderTicketRows();

                if (footer) {
                    footer.innerHTML = _ticketsHasMore
                        ? '<button class="btn btn-outline-primary btn-sm rounded-pill" onclick="SuperAdmin.loadMoreTickets()"><i class="bi bi-arrow-down-circle me-1"></i>Cargar más</button>'
                        : '<small class="text-muted">Fin de tickets</small>';
                }
            } catch (e) {
                if (!append) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar tickets.</td></tr>';
            } finally {
                _ticketsLoading = false;
            }
        }

        function filterTicketsData() {
            const nextStatus = document.getElementById('sa-ticket-filter')?.value || 'all';
            _ticketCategoryFilter = document.getElementById('sa-ticket-category-filter')?.value || 'all';
            _ticketPriorityFilter = document.getElementById('sa-ticket-priority-filter')?.value || 'all';
            _ticketSearchTerm = document.getElementById('sa-ticket-search')?.value || '';

            if (nextStatus !== _ticketsFilter) {
                _ticketsFilter = nextStatus;
                loadTicketsData(false);
                return;
            }

            _renderTicketRows();
        }

        function _renderAdminTicketHistory(ticket) {
            return (ticket.history || []).map(entry => {
                const isInternal = entry.type === 'internal';
                const isStatus = entry.type === 'status_change';
                const accent = isInternal ? 'warning' : (entry.role === 'admin' ? 'primary' : 'secondary');
                const label = isInternal ? 'Nota interna' : isStatus ? 'Cambio de estado' : entry.role === 'admin' ? 'Respuesta soporte' : 'Usuario';

                return `
                    <div class="d-flex gap-2 mb-3">
                        <div class="bg-${accent}-subtle rounded-circle p-1 px-2 small fw-bold">${isInternal ? 'N' : entry.role === 'admin' ? 'A' : 'U'}</div>
                        <div class="flex-grow-1">
                            <div class="small fw-bold">${esc(entry.author || label)} <span class="text-muted fw-normal extra-small">${entry.date ? new Date(entry.date).toLocaleString() : ''}</span></div>
                            <div class="extra-small text-muted text-uppercase mb-1">${label}</div>
                            <div class="small">${esc(entry.message || '')}</div>
                        </div>
                    </div>`;
            }).join('') || '<p class="text-muted small text-center">Sin historial</p>';
        }

        async function openTicketDetailModal(ticketId) {
            const ticket = await SuperAdminService.getSupportTicketDetail(_ctx, ticketId);
            if (!ticket) return;
            _activeTicket = ticket;

            let modal = document.getElementById('sa-modal-ticket');
            if (modal) modal.remove();

            const history = _renderAdminTicketHistory(ticket);
            const context = ticket.context || {};

            const modalHtml = `
            <div class="modal fade" id="sa-modal-ticket" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"><div class="modal-content rounded-4 border-0 shadow-lg">
                <div class="modal-header bg-dark text-white border-0 p-4">
                    <div>
                        <h5 class="fw-bold mb-0">${esc(ticket.titulo || `Ticket #${ticketId.substring(0, 6).toUpperCase()}`)}</h5>
                        <small class="text-white-50">${esc(ticket.userName || 'Usuario')} - ${esc(ticket.userEmail || '')}</small>
                    </div>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="row g-3 mb-4">
                        <div class="col-md-3"><div class="rounded-4 border p-3 h-100"><span class="extra-small text-muted d-block mb-1">Estado</span>${STATUS_BADGES[ticket.status] || ''}</div></div>
                        <div class="col-md-3"><div class="rounded-4 border p-3 h-100"><span class="extra-small text-muted d-block mb-1">Prioridad</span>${PRIORITY_BADGES[ticket.priority || 'normal'] || PRIORITY_BADGES.normal}</div></div>
                        <div class="col-md-3"><div class="rounded-4 border p-3 h-100"><span class="extra-small text-muted d-block mb-1">Modulo</span><span class="small">${esc(CATEGORY_LABELS[ticket.categoria] || ticket.categoria || 'General')}</span></div></div>
                        <div class="col-md-3"><div class="rounded-4 border p-3 h-100"><span class="extra-small text-muted d-block mb-1">Ult. actividad</span><span class="small">${esc(_ticketDateLabel(_ticketActivityDate(ticket)))}</span></div></div>
                    </div>
                    <div class="mb-3"><span class="extra-small text-muted d-block mb-1">Descripcion</span><div class="p-3 bg-light rounded-4 small">${esc(ticket.descripcion || '')}</div></div>
                    ${(ticket.pasos || ticket.esperado || ticket.actual) ? `
                        <div class="row g-3 mb-3">
                            <div class="col-lg-4"><span class="extra-small text-muted d-block mb-1">Pasos</span><div class="p-3 bg-light rounded-4 small">${esc(ticket.pasos || 'No capturados')}</div></div>
                            <div class="col-lg-4"><span class="extra-small text-muted d-block mb-1">Esperado</span><div class="p-3 bg-light rounded-4 small">${esc(ticket.esperado || 'No capturado')}</div></div>
                            <div class="col-lg-4"><span class="extra-small text-muted d-block mb-1">Actual</span><div class="p-3 bg-light rounded-4 small">${esc(ticket.actual || 'No capturado')}</div></div>
                        </div>` : ''}
                    <div class="row g-3 mb-3">
                        <div class="col-lg-6">
                            <div class="rounded-4 border p-3 h-100">
                                <span class="extra-small text-muted d-block mb-2">Contexto técnico</span>
                                <div class="small mb-1"><strong>Vista:</strong> ${esc(context.currentView || 'No disponible')}</div>
                                <div class="small mb-1"><strong>Ruta:</strong> ${esc((context.routePath || '') + (context.hash || '')) || 'No disponible'}</div>
                                <div class="small mb-1"><strong>Plataforma:</strong> ${esc(context.platform || 'Web')}</div>
                                <div class="small mb-1"><strong>Viewport:</strong> ${esc(context.viewport || 'No disponible')}</div>
                                <div class="small"><strong>Idioma:</strong> ${esc(context.language || 'No disponible')}</div>
                            </div>
                        </div>
                        <div class="col-lg-6">
                            ${ticket.evidenciaUrl ? `
                                <div class="rounded-4 border p-3 h-100">
                                    <span class="extra-small text-muted d-block mb-2">Evidencia</span>
                                    <a href="${esc(ticket.evidenciaUrl)}" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill mb-3"><i class="bi bi-box-arrow-up-right me-1"></i>Abrir adjunto</a>
                                    <img src="${esc(ticket.evidenciaUrl)}" class="img-fluid rounded-4 border" style="max-height:220px; object-fit:cover;">
                                </div>
                            ` : '<div class="rounded-4 border p-3 h-100 text-muted small">Sin evidencia adjunta.</div>'}
                        </div>
                    </div>
                    <hr>
                    <h6 class="small fw-bold mb-3">Historial</h6>
                    <div class="sa-ticket-history">${history}</div>
                    <hr>
                    <div class="row g-3 align-items-end mb-3">
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">Estado</label>
                            <select class="form-select form-select-sm" id="sa-ticket-new-status">
                                <option value="pendiente" ${ticket.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="en-proceso" ${ticket.status === 'en-proceso' ? 'selected' : ''}>En Proceso</option>
                                <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                                <option value="rechazado" ${ticket.status === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">Prioridad</label>
                            <select class="form-select form-select-sm" id="sa-ticket-new-priority">
                                <option value="normal" ${(ticket.priority || 'normal') === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="alta" ${ticket.priority === 'alta' ? 'selected' : ''}>Alta</option>
                                <option value="critica" ${ticket.priority === 'critica' ? 'selected' : ''}>Critica</option>
                            </select>
                        </div>
                        <div class="col-md-4 d-grid">
                            <button class="btn btn-outline-dark rounded-pill" onclick="SuperAdmin.saveTicketMeta('${ticketId}')"><i class="bi bi-save me-1"></i>Guardar cambios</button>
                        </div>
                    </div>
                    <div class="card border-0 bg-light rounded-4">
                        <div class="card-body p-3">
                            <label class="form-label small fw-bold">Nueva entrada</label>
                            <textarea class="form-control form-control-sm" id="sa-ticket-reply" rows="3" placeholder="Escribe una respuesta para el usuario o una nota interna..."></textarea>
                            <div class="form-check form-switch mt-3">
                                <input class="form-check-input" type="checkbox" id="sa-ticket-internal-note">
                                <label class="form-check-label small text-muted" for="sa-ticket-internal-note">Guardar como nota interna (solo visible para superadmin)</label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0 p-4 pt-0">
                    <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>
                    <button class="btn btn-dark rounded-pill px-4 shadow-sm" onclick="SuperAdmin.respondTicket('${ticketId}')">Agregar entrada</button>
                </div>
            </div></div></div>`;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            new bootstrap.Modal(document.getElementById('sa-modal-ticket')).show();
        }

        async function saveTicketMeta(ticketId) {
            const newStatus = document.getElementById('sa-ticket-new-status')?.value || _activeTicket?.status || 'pendiente';
            const newPriority = document.getElementById('sa-ticket-new-priority')?.value || _activeTicket?.priority || 'normal';
            const updates = {};

            if (_activeTicket && newStatus !== _activeTicket.status) updates.status = newStatus;
            if (_activeTicket && newPriority !== (_activeTicket.priority || 'normal')) updates.priority = newPriority;

            if (!Object.keys(updates).length) {
                if (typeof showToast === 'function') showToast('No hay cambios por guardar.', 'info');
                return;
            }

            try {
                await SuperAdminService.updateTicketMeta(_ctx, ticketId, updates);
                if (typeof showToast === 'function') showToast('Cambios guardados.', 'success');
                await loadTicketsData(false);
                await openTicketDetailModal(ticketId);
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error: ' + e.message, 'danger');
            }
        }

        async function respondTicketEnhanced(ticketId) {
            const reply = document.getElementById('sa-ticket-reply')?.value?.trim();
            const isInternal = !!document.getElementById('sa-ticket-internal-note')?.checked;
            const profile = _profile || {};

            if (!reply) {
                if (typeof showToast === 'function') showToast('Escribe un mensaje antes de enviarlo.', 'warning');
                return;
            }

            try {
                await SuperAdminService.addTicketResponse(
                    _ctx,
                    ticketId,
                    reply,
                    profile.displayName || 'SuperAdmin',
                    { type: isInternal ? 'internal' : 'response', role: 'admin' }
                );
                if (typeof showToast === 'function') showToast(isInternal ? 'Nota interna agregada.' : 'Respuesta enviada.', 'success');
                await loadTicketsData(false);
                await openTicketDetailModal(ticketId);
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error: ' + e.message, 'danger');
            }
        }

        async function renderTickets(main) {
            return renderTicketsPanel(main);
            _ticketsLastDoc = null;
            _ticketsHasMore = true;
            _ticketsFilter = 'all';

            main.innerHTML = `
            <div class="sa-panel-header">
                <h4 class="fw-bold mb-1"><i class="bi bi-ticket-detailed me-2 text-primary"></i>Centro de Soporte Técnico</h4>
                <p class="text-muted mb-0 small">Tickets de problemas reportados por usuarios del sistema</p>
            </div>
            <div class="row g-3 mb-4" id="sa-ticket-stats">
                <div class="col-4 col-lg"><div class="sa-stat-pill"><span class="fw-bold" id="ts-total">—</span><span class="extra-small text-muted">Total</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-warning"><span class="fw-bold text-warning" id="ts-pend">—</span><span class="extra-small text-muted">Pendientes</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-info"><span class="fw-bold text-info" id="ts-proc">—</span><span class="extra-small text-muted">En Proceso</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-success"><span class="fw-bold text-success" id="ts-done">—</span><span class="extra-small text-muted">Resueltos</span></div></div>
                <div class="col-4 col-lg"><div class="sa-stat-pill border-danger"><span class="fw-bold text-danger" id="ts-rej">—</span><span class="extra-small text-muted">Rechazados</span></div></div>
            </div>
            <div class="sa-filter-bar mb-3">
                <select class="form-select form-select-sm" id="sa-ticket-filter" style="max-width:180px" onchange="SuperAdmin.filterTickets()">
                    <option value="all">Todos</option><option value="pendiente">Pendientes</option><option value="en-proceso">En Proceso</option><option value="resuelto">Resueltos</option><option value="rechazado">Rechazados</option>
                </select>
            </div>
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="table-responsive" style="max-height:55vh">
                    <table class="table table-hover align-middle mb-0 sa-table">
                        <thead class="table-light small fw-bold text-muted text-uppercase sticky-top">
                            <tr><th>ID</th><th>Usuario</th><th>Tipo</th><th>Descripción</th><th>Estado</th><th>Fecha</th><th></th></tr>
                        </thead>
                        <tbody id="sa-tickets-body"></tbody>
                    </table>
                </div>
                <div class="card-footer bg-white text-center py-2" id="sa-tickets-footer"></div>
            </div>`;

            // Load stats
            try {
                const stats = await SuperAdminService.getTicketStats(_ctx);
                const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
                el('ts-total', stats.total);
                el('ts-pend', stats.pendiente);
                el('ts-proc', stats.en_proceso);
                el('ts-done', stats.resuelto);
                el('ts-rej', stats.rechazado);
            } catch (e) { /* stats failed silently */ }

            await loadTickets(false);
        }

        async function loadTickets(append) {
            return loadTicketsData(append);
            if (_ticketsLoading) return;
            _ticketsLoading = true;

            const tbody = document.getElementById('sa-tickets-body');
            const footer = document.getElementById('sa-tickets-footer');
            if (!tbody) { _ticketsLoading = false; return; }

            if (!append) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
                _ticketsLastDoc = null;
                _ticketsHasMore = true;
            }

            try {
                const filter = document.getElementById('sa-ticket-filter')?.value || 'all';
                const tickets = await SuperAdminService.getSupportTickets(_ctx, { status: filter }, { limit: 30, lastDoc: _ticketsLastDoc });
                _ticketsLoading = false;

                if (tickets.length < 30) _ticketsHasMore = false;
                if (tickets.length > 0) _ticketsLastDoc = tickets[tickets.length - 1]._doc;

                const html = tickets.map(t => {
                    const shortId = t.id.substring(0, 6).toUpperCase();
                    const date = t.createdAt ? t.createdAt.toLocaleDateString() : '---';
                    const desc = (t.descripcion || '').substring(0, 50);
                    return `<tr>
                        <td class="font-monospace small fw-bold">#${shortId}</td>
                        <td class="small">${esc(t.userName)}<br><span class="extra-small text-muted">${esc(t.userEmail)}</span></td>
                        <td><span class="badge bg-secondary-subtle text-dark extra-small">${esc(t.tipo || 'bug')}</span></td>
                        <td class="small text-muted">${esc(desc)}</td>
                        <td>${STATUS_BADGES[t.status] || '<span class="badge bg-secondary">?</span>'}</td>
                        <td class="small text-nowrap">${esc(date)}</td>
                        <td><button class="btn btn-light btn-sm rounded-circle border" onclick="SuperAdmin.openTicketModal('${t.id}')"><i class="bi bi-eye"></i></button></td>
                    </tr>`;
                }).join('');

                if (!append) {
                    tbody.innerHTML = html || '<tr><td colspan="7" class="text-center py-4 text-muted">No hay tickets.</td></tr>';
                } else {
                    tbody.insertAdjacentHTML('beforeend', html);
                }

                if (footer) {
                    footer.innerHTML = _ticketsHasMore
                        ? '<button class="btn btn-outline-primary btn-sm rounded-pill" onclick="SuperAdmin.loadMoreTickets()"><i class="bi bi-arrow-down-circle me-1"></i>Cargar más</button>'
                        : '<small class="text-muted">Fin de tickets</small>';
                }
            } catch (e) {
                _ticketsLoading = false;
                if (!append) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar tickets.</td></tr>';
            }
        }

        function filterTickets() { return filterTicketsData(); _ticketsFilter = document.getElementById('sa-ticket-filter')?.value || 'all'; loadTickets(false); }
        function loadMoreTickets() { loadTickets(true); }

        async function openTicketModal(ticketId) {
            return openTicketDetailModal(ticketId);
            // Get fresh data
            const doc = await _ctx.db.collection('tickets-soporte').doc(ticketId).get();
            if (!doc.exists) return;
            const ticket = { id: doc.id, ...doc.data() };
            _activeTicket = ticket;

            let modal = document.getElementById('sa-modal-ticket');
            if (modal) modal.remove();

            const history = (ticket.history || []).map(h => `
                <div class="d-flex gap-2 mb-2">
                    <div class="bg-${h.role === 'admin' ? 'primary' : 'secondary'}-subtle rounded-circle p-1 px-2 small fw-bold">${h.role === 'admin' ? 'A' : 'U'}</div>
                    <div class="flex-grow-1"><div class="small fw-bold">${esc(h.author)} <span class="text-muted fw-normal extra-small">${h.date ? new Date(h.date).toLocaleString() : ''}</span></div><div class="small">${esc(h.message)}</div></div>
                </div>`).join('') || '<p class="text-muted small text-center">Sin historial</p>';

            const modalHtml = `
            <div class="modal fade" id="sa-modal-ticket" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content rounded-4 border-0 shadow-lg">
                <div class="modal-header bg-dark text-white border-0 p-4">
                    <div><h5 class="fw-bold mb-0">Ticket #${ticketId.substring(0, 6).toUpperCase()}</h5><small class="text-white-50">${esc(ticket.userName)} — ${esc(ticket.userEmail)}</small></div>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="row g-3 mb-3">
                        <div class="col-sm-4"><span class="extra-small text-muted d-block">Tipo</span><span class="badge bg-secondary-subtle text-dark">${esc(ticket.tipo || 'bug')}</span></div>
                        <div class="col-sm-4"><span class="extra-small text-muted d-block">Categoría</span><span class="small">${esc(ticket.categoria || 'general')}</span></div>
                        <div class="col-sm-4"><span class="extra-small text-muted d-block">Estado</span>${STATUS_BADGES[ticket.status] || ''}</div>
                    </div>
                    <div class="mb-3"><span class="extra-small text-muted d-block mb-1">Descripción</span><div class="p-3 bg-light rounded-3 small">${esc(ticket.descripcion)}</div></div>
                    ${ticket.evidenciaUrl ? `<div class="mb-3"><span class="extra-small text-muted d-block mb-1">Evidencia</span><a href="${esc(ticket.evidenciaUrl)}" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill"><i class="bi bi-image me-1"></i>Ver adjunto</a></div>` : ''}
                    <hr>
                    <h6 class="small fw-bold mb-3">Historial</h6>
                    <div class="sa-ticket-history">${history}</div>
                    <hr>
                    <div class="row g-2">
                        <div class="col-md-4">
                            <select class="form-select form-select-sm" id="sa-ticket-new-status">
                                <option value="pendiente" ${ticket.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="en-proceso" ${ticket.status === 'en-proceso' ? 'selected' : ''}>En Proceso</option>
                                <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                                <option value="rechazado" ${ticket.status === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                            </select>
                        </div>
                        <div class="col-md-8"><textarea class="form-control form-control-sm" id="sa-ticket-reply" rows="2" placeholder="Escribe una respuesta..."></textarea></div>
                    </div>
                </div>
                <div class="modal-footer border-0 p-4 pt-0">
                    <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>
                    <button class="btn btn-dark rounded-pill px-4 shadow-sm" onclick="SuperAdmin.respondTicket('${ticketId}')">Enviar Respuesta</button>
                </div>
            </div></div></div>`;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            new bootstrap.Modal(document.getElementById('sa-modal-ticket')).show();
        }

        async function respondTicket(ticketId) {
            return respondTicketEnhanced(ticketId);
            const newStatus = document.getElementById('sa-ticket-new-status')?.value;
            const reply = document.getElementById('sa-ticket-reply')?.value?.trim();
            const profile = _profile || {};

            try {
                if (newStatus) {
                    await SuperAdminService.updateTicketStatus(_ctx, ticketId, newStatus, reply || `Estado cambiado a ${newStatus}`);
                }
                if (reply && !newStatus) {
                    await SuperAdminService.addTicketResponse(_ctx, ticketId, reply, profile.displayName || 'SuperAdmin');
                }
                if (typeof showToast === 'function') showToast('Ticket actualizado', 'success');
                bootstrap.Modal.getInstance(document.getElementById('sa-modal-ticket'))?.hide();
                loadTickets(false);
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error: ' + e.message, 'danger');
            }
        }

        // =============================================
        // PANEL 5: CONFIGURACIÓN
        // =============================================

        async function renderConfig(main) {
            main.innerHTML = `
            <div class="sa-panel-header">
                <h4 class="fw-bold mb-1"><i class="bi bi-gear-wide-connected me-2 text-primary"></i>Configuración Global</h4>
                <p class="text-muted mb-0 small">Kill switches, avisos del sistema y ajustes de módulos</p>
            </div>
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="card border-0 shadow-sm rounded-4 h-100">
                        <div class="card-header bg-white border-0 py-3"><h6 class="fw-bold mb-0"><i class="bi bi-toggle-on text-danger me-2"></i>Interruptores Maestros</h6></div>
                        <div class="card-body" id="sa-kill-switches">
                            <p class="extra-small text-muted mb-3">Deshabilitar un módulo bloquea el acceso a todos los usuarios.</p>
                            ${['medi', 'aula', 'biblio', 'foro', 'quejas', 'encuestas', 'lactario'].map(m => `
                                <div class="d-flex justify-content-between align-items-center p-2 rounded-3 mb-2 bg-light">
                                    <div><div class="fw-bold small">${m.charAt(0).toUpperCase() + m.slice(1)}</div></div>
                                    <div class="form-check form-switch"><input class="form-check-input sa-module-switch" type="checkbox" data-module="${m}" checked onchange="SuperAdmin.toggleModuleSwitch('${m}', this.checked)"></div>
                                </div>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card border-0 shadow-sm rounded-4">
                        <div class="card-header bg-white border-0 py-3"><h6 class="fw-bold mb-0"><i class="bi bi-broadcast text-primary me-2"></i>Avisos del Sistema</h6></div>
                        <div class="card-body p-4">
                            <form id="sa-form-notice" onsubmit="SuperAdmin.createNotice(event)">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Tipo</label>
                                    <select id="sa-notice-type" class="form-select form-select-sm" required>
                                        <option value="info">📢 Informativo</option>
                                        <option value="mantenimiento">⚙️ Mantenimiento</option>
                                        <option value="emergencia">🚨 Emergencia</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Mensaje</label>
                                    <textarea id="sa-notice-text" class="form-control form-control-sm" rows="3" required placeholder="Escribe el mensaje..."></textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Duración</label>
                                    <select id="sa-notice-duration" class="form-select form-select-sm">
                                        <option value="60">1 hora</option>
                                        <option value="1440" selected>24 horas</option>
                                        <option value="10080">1 semana</option>
                                        <option value="0">Permanente</option>
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary btn-sm w-100 rounded-pill fw-bold">Publicar Aviso</button>
                            </form>
                            <hr>
                            <h6 class="small fw-bold text-muted mb-2">Avisos Activos</h6>
                            <div id="sa-active-notices" class="list-group list-group-flush"></div>
                        </div>
                    </div>
                </div>
            </div>`;

            // Load config + stream notices
            try {
                const config = await SuperAdminService.getGlobalConfig(_ctx, 'modules');
                if (config) {
                    document.querySelectorAll('.sa-module-switch').forEach(sw => {
                        const mod = sw.dataset.module;
                        if (config[mod] !== undefined) sw.checked = config[mod];
                    });
                }
            } catch (e) { /* config load failed */ }

            // Stream notices
            const unsubNotices = SuperAdminService.streamGlobalNotices(_ctx, (snap) => {
                const list = document.getElementById('sa-active-notices');
                if (!list) return;
                list.innerHTML = snap.docs.map(doc => {
                    const a = doc.data();
                    const date = a.createdAt?.toDate()?.toLocaleString() || '---';
                    return `<div class="list-group-item px-0 bg-transparent border-0 border-bottom small d-flex justify-content-between align-items-center">
                        <div><span class="badge ${a.tipo === 'emergencia' ? 'bg-danger' : 'bg-primary'} extra-small me-2">${esc(a.tipo)}</span>${esc(a.texto)}<div class="extra-small text-muted">${date}</div></div>
                        <button class="btn btn-link text-danger btn-sm p-0" onclick="SuperAdmin.deleteNotice('${doc.id}')"><i class="bi bi-trash"></i></button>
                    </div>`;
                }).join('') || '<p class="text-center text-muted small py-3">No hay avisos</p>';
            });

            if (_ctx.ModuleManager) _ctx.ModuleManager.addSubscription(unsubNotices);
        }

        async function toggleModuleSwitch(moduleId, isEnabled) {
            try {
                await SuperAdminService.toggleModule(_ctx, moduleId, isEnabled);
                if (typeof showToast === 'function') showToast(`${moduleId.toUpperCase()} ${isEnabled ? 'habilitado' : 'deshabilitado'}`, isEnabled ? 'success' : 'warning');
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error al cambiar módulo', 'danger');
            }
        }

        async function createNotice(e) {
            e.preventDefault();
            try {
                await SuperAdminService.createGlobalNotice(_ctx, {
                    texto: document.getElementById('sa-notice-text').value,
                    tipo: document.getElementById('sa-notice-type').value,
                    duration: parseInt(document.getElementById('sa-notice-duration').value)
                });
                if (typeof showToast === 'function') showToast('Aviso publicado', 'success');
                document.getElementById('sa-form-notice')?.reset();
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error al publicar', 'danger');
            }
        }

        async function deleteNotice(noticeId) {
            try {
                await SuperAdminService.deleteNotice(_ctx, noticeId);
                if (typeof showToast === 'function') showToast('Aviso eliminado', 'success');
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error al eliminar', 'danger');
            }
        }

        function addPermRow() {
            const container = document.getElementById('sa-edit-perms');
            if (!container) return;
            const row = document.createElement('div');
            row.className = 'input-group input-group-sm mt-1';
            row.innerHTML = '<input class="form-control sa-perm-key" placeholder="Módulo o clave (ej. aula, medi)"><input class="form-control sa-perm-val" placeholder="Nivel (ej. admin, docente, medico)"><button class="btn btn-outline-danger" type="button"><i class="bi bi-x"></i></button>';
            row.querySelector('button').addEventListener('click', () => {
                row.remove();
                markUserPresetAsCustom();
                updateUserEditSummary();
            });
            container.appendChild(row);
            markUserPresetAsCustom();
            updateUserEditSummary();
        }

        return {
            init,
            switchTab,
            // Audit
            filterLogs, loadMoreLogs, exportLogs,
            // Users
            filterUsers, loadMoreUsers, openUserModal, saveUser, addPermRow, applyUserPreset, handleUserConfigChange,
            // Tickets
            filterTickets, loadMoreTickets, openTicketModal, respondTicket, saveTicketMeta,
            // Config
            toggleModuleSwitch, createNotice, deleteNotice
        };
    })();
}
