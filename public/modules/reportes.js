var Reportes = (function () {
    let _ctx = null;
    let _currentView = 'landing'; // 'landing' | 'detail'
    let _currentArea = null;      // 'BIBLIO' | 'MEDICO'
    let _currentPeriod = 'daily'; // 'daily', 'weekly', 'monthly', 'quarterly', 'semester', 'annual'

    let _rawData = [];
    let _filteredData = [];
    let _charts = {};
    let _modalCharts = {};
    let _cardFilters = {};

    function init(ctx) {
        _ctx = ctx;
        if (!isAuthorized()) return;
        render();
    }

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

    function render() {
        const container = document.getElementById('view-reportes');
        if (!container) return;

        // Cleanup charts before rendering new view
        destroyAllCharts();

        if (_currentView === 'landing') {
            renderLanding(container);
        } else {
            renderDetail(container);
        }
    }

    function destroyAllCharts() {
        Object.keys(_charts).forEach(key => {
            if (_charts[key]) {
                _charts[key].destroy();
            }
        });
        _charts = {};

        Object.keys(_modalCharts).forEach(key => {
            if (_modalCharts[key]) {
                _modalCharts[key].destroy();
            }
        });
        _modalCharts = {};
    }

    // ================= LANDING PAGE =================
    function renderLanding(container) {
        container.innerHTML = `
            <div class="container-fluid p-4">
                <div class="d-flex justify-content-between align-items-center mb-5">
                    <div>
                        <h2 class="fw-bold mb-1">Centro de Reportes</h2>
                        <p class="text-muted">Selecciona un área para visualizar sus indicadores.</p>
                    </div>
                </div>

                <div class="row g-4 justify-content-center">
                    <!-- Card Biblioteca -->
                    <div class="col-md-5 col-lg-4">
                        <div class="card h-100 border-0 shadow-sm hover-scale cursor-pointer" onclick="Reportes.navigateTo('BIBLIO')">
                            <div class="card-body p-5 text-center">
                                <div class="icon-circle bg-warning bg-opacity-10 text-warning mb-4 mx-auto" style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                    <i class="bi bi-book-half display-4"></i>
                                </div>
                                <h3 class="fw-bold mb-3">Biblioteca</h3>
                                <p class="text-muted mb-0">Gestión de visitas, préstamos de libros, uso de computadoras y salas de estudio.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Card Servicios Médicos -->
                    <div class="col-md-5 col-lg-4">
                        <div class="card h-100 border-0 shadow-sm hover-scale cursor-pointer" onclick="Reportes.navigateTo('MEDICO')">
                            <div class="card-body p-5 text-center">
                                <div class="icon-circle bg-primary bg-opacity-10 text-primary mb-4 mx-auto" style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                    <i class="bi bi-heart-pulse-fill display-4"></i>
                                </div>
                                <h3 class="fw-bold mb-3">Servicios Médicos</h3>
                                <p class="text-muted mb-0">Atención médica, consultas psicológicas y seguimiento de pacientes.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .hover-scale { transition: transform 0.2s ease-in-out; }
                .hover-scale:hover { transform: translateY(-5px); }
            </style>
        `;
    }

    function navigateTo(area) {
        _currentArea = area;
        _currentView = 'detail';
        render();
        loadData(); // Cargar datos al entrar
    }

    function goBack() {
        _currentView = 'landing';
        _currentArea = null;
        render();
    }

    // ================= DETAIL VIEW =================
    function renderDetail(container) {
        const areaName = _currentArea === 'BIBLIO' ? 'Biblioteca' : 'Servicios Médicos y Psicopedagógicos';

        container.innerHTML = `
            <div class="container-fluid p-4">
                <!-- Header -->
                <div class="d-flex align-items-center mb-4">
                    <button class="btn btn-light rounded-circle me-3 shadow-sm" onclick="Reportes.goBack()">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <div class="flex-grow-1">
                        <div class="badge bg-primary bg-opacity-10 text-primary mb-1">DESARROLLO ACADÉMICO</div>
                        <h3 class="fw-bold mb-0">${areaName}</h3>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                         <div class="btn-group shadow-sm rounded-pill p-1" role="group" id="period-selector"
                              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                            ${renderPeriodPills()}
                        </div>
                        <div class="border-start mx-2" style="height: 32px; opacity: 0.2;"></div>
                        <button class="btn btn-outline-success rounded-pill px-3 shadow-sm d-flex align-items-center gap-2" onclick="Reportes.showExportModal('excel')">
                            <i class="bi bi-file-earmark-excel-fill"></i>
                            <span class="d-none d-md-inline">Excel</span>
                        </button>
                        <button class="btn btn-outline-danger rounded-pill px-3 shadow-sm d-flex align-items-center gap-2" onclick="Reportes.showExportModal('pdf')">
                            <i class="bi bi-file-earmark-pdf-fill"></i>
                            <span class="d-none d-md-inline">PDF</span>
                        </button>
                    </div>
                </div>

                <!-- Main Content Loader -->
                <div id="reportes-content" class="position-relative" style="min-height: 400px;">
                    <div class="d-flex justify-content-center align-items-center h-100 pt-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Export Configuration Modal -->
            ${renderExportModal()}

            <!-- Detail Modal (for individual card drill-down) -->
            ${renderDetailModal()}
        `;
    }

    function renderPeriodPills() {
        const periods = [
            { id: 'daily', label: 'Día' },
            { id: 'weekly', label: 'Semana' },
            { id: 'monthly', label: 'Mes' },
            { id: 'quarterly', label: 'Trimestre' },
            { id: 'semester', label: 'Semestre' },
            { id: 'annual', label: 'Año' }
        ];

        return periods.map(p => `
            <button type="button"
                class="btn btn-sm rounded-pill px-3 border-0 fw-bold ${_currentPeriod === p.id ? 'btn-primary' : 'text-muted'}"
                style="${_currentPeriod !== p.id ? 'background: transparent;' : ''}"
                onclick="Reportes.setPeriod('${p.id}')">
                ${p.label}
            </button>
        `).join('');
    }

    function setPeriod(p) {
        _currentPeriod = p;
        render(); // Re-render header to update active pill
        loadData(); // Reload data
    }

    // ================= EXPORT MODAL =================
    function renderExportModal() {
        return `
        <div class="modal fade" id="exportConfigModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title fw-bold">Configurar Exportación</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body pt-2">
                        <div class="mb-4">
                            <label class="form-label fw-bold small text-muted">PERÍODO</label>
                            <select class="form-select" id="export-period">
                                <option value="daily">Día Actual</option>
                                <option value="weekly">Semana Actual</option>
                                <option value="monthly" selected>Mes Actual</option>
                                <option value="quarterly">Trimestre Actual</option>
                                <option value="semester">Semestre Actual</option>
                                <option value="annual">Año Actual</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold small text-muted">INCLUIR EN EL REPORTE</label>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="exportScope" id="export-all" value="all" checked>
                                <label class="form-check-label" for="export-all">
                                    Todo (Todos los tipos y filtros)
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="exportScope" id="export-custom" value="custom">
                                <label class="form-check-label" for="export-custom">
                                    Personalizado
                                </label>
                            </div>
                        </div>

                        <div id="custom-export-options" class="d-none ps-4 mb-3">
                            <label class="form-label small fw-bold">Selecciona los tipos a incluir:</label>
                            <div id="export-types-checkboxes">
                                <!-- Se llenará dinámicamente según el área -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="confirm-export-btn">
                            <i class="bi bi-download me-1"></i>Generar Reporte
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    function showExportModal(format) {
        const modal = document.getElementById('exportConfigModal');
        if (!modal) return;

        // Fill checkboxes based on current area
        const checkboxContainer = document.getElementById('export-types-checkboxes');
        if (checkboxContainer) {
            if (_currentArea === 'BIBLIO') {
                checkboxContainer.innerHTML = `
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Consulta" id="exp-consulta" checked><label class="form-check-label" for="exp-consulta">Consulta</label></div>
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Trabajo Individual" id="exp-individual" checked><label class="form-check-label" for="exp-individual">Trabajo Individual</label></div>
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Trabajo en Equipo" id="exp-equipo" checked><label class="form-check-label" for="exp-equipo">Trabajo en Equipo</label></div>
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Uso de Computadora" id="exp-computadora" checked><label class="form-check-label" for="exp-computadora">Uso de Computadora</label></div>
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Préstamo" id="exp-prestamo" checked><label class="form-check-label" for="exp-prestamo">Préstamos</label></div>
                `;
            } else {
                checkboxContainer.innerHTML = `
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Consulta Médica" id="exp-medica" checked><label class="form-check-label" for="exp-medica">Consulta Médica</label></div>
                    <div class="form-check"><input class="form-check-input" type="checkbox" value="Consulta Psicológica" id="exp-psico" checked><label class="form-check-label" for="exp-psico">Consulta Psicológica</label></div>
                `;
            }
        }

        // Setup listeners
        document.querySelectorAll('input[name="exportScope"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const customOptions = document.getElementById('custom-export-options');
                if (customOptions) {
                    customOptions.classList.toggle('d-none', e.target.value === 'all');
                }
            });
        });

        const confirmBtn = document.getElementById('confirm-export-btn');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                executeExport(format);
            };
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    function executeExport(format) {
        const period = document.getElementById('export-period')?.value || 'monthly';
        const scope = document.querySelector('input[name="exportScope"]:checked')?.value || 'all';

        let selectedTypes = [];
        if (scope === 'custom') {
            document.querySelectorAll('#export-types-checkboxes input:checked').forEach(cb => {
                selectedTypes.push(cb.value);
            });
        }

        const config = { period, scope, selectedTypes };

        if (format === 'pdf') {
            exportToPDF(config);
        } else {
            exportToExcel(config);
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('exportConfigModal'));
        if (modal) modal.hide();
    }

    // ================= DETAIL MODAL (for individual cards) =================
    function renderDetailModal() {
        return `
        <div class="modal fade" id="cardDetailModal" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header border-0">
                        <div class="flex-grow-1">
                            <h5 class="modal-title fw-bold mb-1" id="detail-modal-title">Detalle</h5>
                            <p class="text-muted small mb-0" id="detail-modal-subtitle">--</p>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Filtros -->
                        <div class="d-flex gap-2 mb-4 flex-wrap" id="detail-modal-filters">
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="genero">
                                <i class="bi bi-gender-ambiguous me-1"></i>Género
                            </button>
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="carrera">
                                <i class="bi bi-mortarboard me-1"></i>Carrera
                            </button>
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="turno">
                                <i class="bi bi-clock me-1"></i>Turno
                            </button>
                            <button class="btn btn-sm btn-outline-primary rounded-pill active" data-filter="generacion">
                                <i class="bi bi-calendar-event me-1"></i>Generación
                            </button>
                        </div>

                        <!-- Charts Grid -->
                        <div class="row g-4" id="detail-modal-charts">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    <div class="modal-footer border-0 bg-light bg-opacity-10">
                        <button class="btn btn-outline-success me-2" onclick="Reportes.exportModalData('excel')">
                            <i class="bi bi-file-earmark-excel me-1"></i>Exportar Excel
                        </button>
                        <button class="btn btn-outline-danger" onclick="Reportes.exportModalData('pdf')">
                            <i class="bi bi-file-earmark-pdf me-1"></i>Exportar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    function openCardDetailModal(category, data) {
        const modal = document.getElementById('cardDetailModal');
        if (!modal) return;

        // Set title
        const title = document.getElementById('detail-modal-title');
        const subtitle = document.getElementById('detail-modal-subtitle');
        if (title) title.textContent = category;
        if (subtitle) subtitle.textContent = `${data.length} registros totales`;

        // Setup filter toggles
        const filterBtns = modal.querySelectorAll('#detail-modal-filters button');
        const activeFilters = new Set(['genero', 'carrera', 'turno', 'generacion']);

        filterBtns.forEach(btn => {
            btn.onclick = () => {
                const filter = btn.dataset.filter;
                if (activeFilters.has(filter)) {
                    activeFilters.delete(filter);
                    btn.classList.remove('active');
                } else {
                    activeFilters.add(filter);
                    btn.classList.add('active');
                }
                renderDetailCharts(category, data, activeFilters);
            };
        });

        // Render charts
        renderDetailCharts(category, data, activeFilters);

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    function renderDetailCharts(category, data, activeFilters) {
        const container = document.getElementById('detail-modal-charts');
        if (!container) return;

        // Clear existing modal charts
        Object.keys(_modalCharts).forEach(key => {
            if (_modalCharts[key]) _modalCharts[key].destroy();
        });
        _modalCharts = {};

        let html = '';

        if (activeFilters.has('genero')) {
            html += `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3"><i class="bi bi-gender-ambiguous text-primary me-2"></i>Por Género</h6>
                        <canvas id="chart-modal-genero" style="max-height: 180px;"></canvas>
                    </div>
                </div>
            </div>`;
        }

        if (activeFilters.has('carrera')) {
            html += `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3"><i class="bi bi-mortarboard text-primary me-2"></i>Por Carrera</h6>
                        <canvas id="chart-modal-carrera" style="max-height: 180px;"></canvas>
                    </div>
                </div>
            </div>`;
        }

        if (activeFilters.has('turno')) {
            html += `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3"><i class="bi bi-clock text-primary me-2"></i>Por Turno</h6>
                        <canvas id="chart-modal-turno" style="max-height: 180px;"></canvas>
                    </div>
                </div>
            </div>`;
        }

        if (activeFilters.has('generacion')) {
            html += `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3"><i class="bi bi-calendar-event text-primary me-2"></i>Por Generación</h6>
                        <canvas id="chart-modal-generacion" style="max-height: 180px;"></canvas>
                    </div>
                </div>
            </div>`;
        }

        container.innerHTML = html;

        // Render charts after DOM update
        setTimeout(() => {
            if (activeFilters.has('genero')) renderGeneroChart(data);
            if (activeFilters.has('carrera')) renderCarreraChart(data);
            if (activeFilters.has('turno')) renderTurnoChart(data);
            if (activeFilters.has('generacion')) renderGeneracionChart(data);
        }, 50);
    }

    function renderGeneroChart(data) {
        const ctx = document.getElementById('chart-modal-genero');
        if (!ctx) return;

        const counts = {};
        data.forEach(d => {
            const g = d.genero || 'No especificado';
            counts[g] = (counts[g] || 0) + 1;
        });

        _modalCharts['genero'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: ['#ec35d0ff', '#4040e5ff', '#6366f1', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    function renderCarreraChart(data) {
        const ctx = document.getElementById('chart-modal-carrera');
        if (!ctx) return;

        const counts = {};
        data.forEach(d => {
            const c = d.carrera || 'No especificado';
            counts[c] = (counts[c] || 0) + 1;
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

        _modalCharts['carrera'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([k]) => k),
                datasets: [{
                    label: 'Registros',
                    data: sorted.map(([, v]) => v),
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function renderTurnoChart(data) {
        const ctx = document.getElementById('chart-modal-turno');
        if (!ctx) return;

        const counts = {};
        data.forEach(d => {
            const t = d.turno || 'No especificado';
            counts[t] = (counts[t] || 0) + 1;
        });

        _modalCharts['turno'] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: ['#f59e0b', '#10b981', '#6366f1']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    function renderGeneracionChart(data) {
        const ctx = document.getElementById('chart-modal-generacion');
        if (!ctx) return;

        const counts = {};
        data.forEach(d => {
            const g = d.generacion || 'No especificado';
            counts[g] = (counts[g] || 0) + 1;
        });

        const sorted = Object.entries(counts).sort((a, b) => {
            if (a[0] === 'No especificado') return 1;
            if (b[0] === 'No especificado') return -1;
            return b[0] - a[0];
        });

        _modalCharts['generacion'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([k]) => k),
                datasets: [{
                    label: 'Registros',
                    data: sorted.map(([, v]) => v),
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function exportModalData(format) {
        alert(`Exportar datos del modal en formato ${format.toUpperCase()} (funcionalidad en construcción)`);
    }

    // ================= DATA LOADING =================
    async function loadData() {
        const container = document.getElementById('reportes-content');
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center h-100 pt-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
            </div>`;

        try {
            const dateRange = getDateRange(_currentPeriod);
            _rawData = await ReportesService.getReportData(_ctx, {
                start: dateRange.start,
                end: dateRange.end,
                areas: [_currentArea]
            });
            _filteredData = [..._rawData];

            renderDashboardContent(container);
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar datos: ${e.message}</div>`;
        }
    }

    function getDateRange(period) {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case 'daily':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'weekly':
                const day = now.getDay();
                const diff = now.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'quarterly':
                const q = Math.floor((now.getMonth() + 3) / 3);
                start = new Date(now.getFullYear(), (q - 1) * 3, 1);
                end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
                break;
            case 'semester':
                const s = now.getMonth() < 6 ? 0 : 6;
                start = new Date(now.getFullYear(), s, 1);
                end = new Date(now.getFullYear(), s + 6, 0, 23, 59, 59);
                break;
            case 'annual':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;
        }
        return { start, end };
    }

    // ================= DASHBOARD CONTENT =================
    function renderDashboardContent(container) {
        if (_currentArea === 'BIBLIO') {
            renderBiblioDashboard(container);
        } else {
            renderMedicoDashboard(container);
        }
    }

    function renderBiblioDashboard(container) {
        // Group data
        const visits = _rawData.filter(d => d.subarea === 'Visitas');
        const loans = _rawData.filter(d => d.subarea === 'Préstamos');

        container.innerHTML = `
            <div class="d-flex flex-column gap-5 pb-5">
                ${renderSection('Reportes por Visitas', visits, ['Consulta', 'Trabajo Individual', 'Trabajo en Equipo', 'Uso de Computadora'])}
                ${renderSection('Reporte por Préstamos', loans, ['Préstamo'])}
            </div>
        `;

        // Render charts after HTML injection
        renderChartsForSection(visits, 'Visitas');
        renderChartsForSection(loans, 'Préstamos');
    }

    function renderMedicoDashboard(container) {
        const medical = _rawData;

        // Categorizar diagnósticos
        const diagnosticos = categorizeDiagnosticos(medical);
        const topMedicos = diagnosticos.medicos.slice(0, 3);
        const topPsico = diagnosticos.psicologicos.slice(0, 3);

        container.innerHTML = `
             <div class="d-flex flex-column gap-5 pb-5">
                ${renderSection('Consultas por Tipo', medical, ['Consulta Médica', 'Consulta Psicológica'])}
                ${renderDiagnosticosSection('Diagnósticos Médicos Frecuentes', topMedicos, 'medico')}
                ${renderDiagnosticosSection('Diagnósticos Psicológicos Frecuentes', topPsico, 'psico')}
            </div>
        `;

        renderChartsForSection(medical, 'Servicios Médicos');
        renderDiagnosticoCharts(topMedicos, 'medico');
        renderDiagnosticoCharts(topPsico, 'psico');
    }

    function categorizeDiagnosticos(data) {
        const medicos = {};
        const psicologicos = {};

        data.forEach(d => {
            if (!d.diagnostico) return;

            // Categorizar similar diagnósticos
            let diag = categorizeSimilar(d.diagnostico);

            if (d.tipo === 'Consulta Psicológica' || d.subarea === 'Psicología') {
                psicologicos[diag] = (psicologicos[diag] || 0) + 1;
            } else {
                medicos[diag] = (medicos[diag] || 0) + 1;
            }
        });

        return {
            medicos: Object.entries(medicos).sort((a, b) => b[1] - a[1]),
            psicologicos: Object.entries(psicologicos).sort((a, b) => b[1] - a[1])
        };
    }

    function categorizeSimilar(diagnostico) {
        const lower = diagnostico.toLowerCase();

        // Golpes/Traumas
        if (lower.includes('golpe') || lower.includes('trauma') || lower.includes('contusión')) {
            return 'Golpes y Traumas';
        }
        // Dolores
        if (lower.includes('dolor')) {
            if (lower.includes('cabeza')) return 'Dolor de Cabeza';
            if (lower.includes('estómago') || lower.includes('estomago')) return 'Dolor de Estómago';
            return 'Dolor General';
        }
        // Gripe/Resfriado
        if (lower.includes('gripe') || lower.includes('resfriado') || lower.includes('tos')) {
            return 'Gripe y Resfriado';
        }
        // Estrés/Ansiedad
        if (lower.includes('estrés') || lower.includes('estres') || lower.includes('ansiedad')) {
            return 'Estrés y Ansiedad';
        }
        // Depresión
        if (lower.includes('depresión') || lower.includes('depresion')) {
            return 'Depresión';
        }

        return diagnostico;
    }

    function renderDiagnosticosSection(title, diagnosticos, tipo) {
        if (!diagnosticos || diagnosticos.length === 0) {
            return `
            <div>
                <h5 class="fw-bold mb-3 ps-2 border-start border-4 border-${tipo === 'medico' ? 'primary' : 'info'}">${title}</h5>
                <p class="text-muted">No hay datos suficientes</p>
            </div>`;
        }

        return `
            <div>
                <h5 class="fw-bold mb-3 ps-2 border-start border-4 border-${tipo === 'medico' ? 'primary' : 'info'}">${title}</h5>
                <div class="row g-3">
                    ${diagnosticos.map(([diag, count], idx) => renderDiagnosticoCard(diag, count, tipo, idx)).join('')}
                </div>
            </div>
        `;
    }

    function renderDiagnosticoCard(diagnostico, count, tipo, index) {
        const color = tipo === 'medico' ? 'primary' : 'info';
        const chartId = `diag-chart-${tipo}-${index}`;

        return `
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-4 cursor-pointer hover-scale"
                     onclick="Reportes.openDiagnosticoDetail('${diagnostico.replace(/'/g, "\\'")}', '${tipo}')">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="flex-grow-1">
                                <h6 class="fw-bold mb-1">${diagnostico}</h6>
                                <p class="text-muted small mb-0">${count} casos</p>
                            </div>
                            <div class="badge bg-${color} bg-opacity-10 text-${color} rounded-pill px-3">
                                ${tipo === 'medico' ? 'Médico' : 'Psicológico'}
                            </div>
                        </div>
                        <div style="height: 60px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderDiagnosticoCharts(diagnosticos, tipo) {
        setTimeout(() => {
            diagnosticos.forEach(([diag, count], idx) => {
                const chartId = `diag-chart-${tipo}-${idx}`;
                const ctx = document.getElementById(chartId);
                if (!ctx) return;

                // Simple bar representation
                _charts[chartId] = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: [''],
                        datasets: [{
                            data: [count],
                            backgroundColor: tipo === 'medico' ? '#3b82f6' : '#0ea5e9',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { display: false },
                            y: { display: false, beginAtZero: true }
                        }
                    }
                });
            });
        }, 50);
    }

    function openDiagnosticoDetail(diagnostico, tipo) {
        // Filtrar datos por diagnóstico categorizado
        const data = _rawData.filter(d => {
            if (!d.diagnostico) return false;
            const categorized = categorizeSimilar(d.diagnostico);
            return categorized === diagnostico;
        });

        openCardDetailModal(diagnostico, data);
    }

    function renderSection(title, data, categories) {
        return `
            <div>
                <h5 class="fw-bold mb-3 ps-2 border-start border-4 border-primary">${title}</h5>
                <div class="row g-3">
                    ${categories.map((cat, index) => renderMetricCard(cat, data, index)).join('')}
                </div>
            </div>
        `;
    }

    function renderMetricCard(category, allData, index) {
        // 1. Filter global data for this category
        let catData = allData.filter(d => {
            if (category === 'Consulta') return d.tipo.toLowerCase().includes('consulta') || d.detalle.toLowerCase().includes('consulta');
            if (category === 'Trabajo Individual') return d.tipo.toLowerCase().includes('individual') || d.detalle.toLowerCase().includes('individual');
            if (category === 'Trabajo en Equipo') return d.tipo.toLowerCase().includes('equipo') || d.detalle.toLowerCase().includes('equipo');
            if (category === 'Uso de Computadora') return d.tipo.toLowerCase().includes('computadora') || d.detalle.toLowerCase().includes('computadora');
            return d.tipo === category;
        });

        const total = catData.length;
        const chartId = `mini-chart-${index}-${category.replace(/\s+/g, '')}`;

        // Calculate Trend
        const trendData = calculateTrend(catData);
        const trendPercentage = calculateTrendPercentage(trendData);

        return `
            <div class="col-lg-3 col-md-4 col-sm-6">
                <div class="card border-0 shadow-sm rounded-4 h-100 cursor-pointer hover-scale"
                     onclick="Reportes.openCardDetail('${category.replace(/'/g, "\\'")}', ${index})">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h6 class="fw-bold text-muted mb-1 text-uppercase small" style="font-size: 0.75rem; letter-spacing: 0.05em;">${category}</h6>
                                <h2 class="fw-bold mb-0">${total}</h2>
                            </div>
                        </div>

                        <div style="height: 80px; position: relative;">
                            <canvas id="${chartId}"></canvas>
                        </div>

                        <div class="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
                            <small class="text-muted fw-bold" style="font-size: 0.75rem;">TENDENCIA</small>
                            <span class="badge ${trendPercentage >= 0 ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${trendPercentage >= 0 ? 'text-success' : 'text-danger'} rounded-pill fw-bold">
                                <i class="bi ${trendPercentage >= 0 ? 'bi-arrow-up' : 'bi-arrow-down'} me-1"></i>${Math.abs(trendPercentage)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function openCardDetail(category, index) {
        // Filter data for this category
        let catData = _rawData.filter(d => {
            if (category === 'Consulta') return d.tipo.toLowerCase().includes('consulta') || d.detalle.toLowerCase().includes('consulta');
            if (category === 'Trabajo Individual') return d.tipo.toLowerCase().includes('individual') || d.detalle.toLowerCase().includes('individual');
            if (category === 'Trabajo en Equipo') return d.tipo.toLowerCase().includes('equipo') || d.detalle.toLowerCase().includes('equipo');
            if (category === 'Uso de Computadora') return d.tipo.toLowerCase().includes('computadora') || d.detalle.toLowerCase().includes('computadora');
            return d.tipo === category;
        });

        openCardDetailModal(category, catData);
    }

    function renderChartsForSection(data, sectionName) {
        setTimeout(() => {
            if (sectionName === 'Visitas') {
                ['Consulta', 'Trabajo Individual', 'Trabajo en Equipo', 'Uso de Computadora'].forEach((cat, idx) => {
                    renderSparkline(cat, data, idx);
                });
            } else if (sectionName === 'Préstamos') {
                ['Préstamo'].forEach((cat, idx) => {
                    renderSparkline(cat, data, idx);
                });
            } else if (sectionName === 'Servicios Médicos') {
                ['Consulta Médica', 'Consulta Psicológica'].forEach((cat, idx) => {
                    renderSparkline(cat, data, idx);
                });
            }
        }, 50);
    }

    function renderSparkline(category, allData, index) {
        const chartId = `mini-chart-${index}-${category.replace(/\s+/g, '')}`;
        const ctx = document.getElementById(chartId);
        if (!ctx) return;

        let catData = allData.filter(d => {
            if (category === 'Consulta') return d.tipo.toLowerCase().includes('consulta') || d.detalle.toLowerCase().includes('consulta');
            if (category === 'Trabajo Individual') return d.tipo.toLowerCase().includes('individual') || d.detalle.toLowerCase().includes('individual');
            if (category === 'Trabajo en Equipo') return d.tipo.toLowerCase().includes('equipo') || d.detalle.toLowerCase().includes('equipo');
            if (category === 'Uso de Computadora') return d.tipo.toLowerCase().includes('computadora') || d.detalle.toLowerCase().includes('computadora');
            return d.tipo === category;
        });

        const trendData = calculateTrend(catData);
        const labels = Object.keys(trendData).sort();
        const dataPoints = labels.map(l => trendData[l]);

        if (_charts[chartId]) {
            _charts[chartId].destroy();
        }

        _charts[chartId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints,
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 80);
                        gradient.addColorStop(0, 'rgba(99,102,241,0.2)');
                        gradient.addColorStop(1, 'rgba(99,102,241,0)');
                        return gradient;
                    },
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } },
                scales: {
                    x: { display: false },
                    y: { display: false, min: 0 }
                },
                layout: { padding: 0 }
            }
        });
    }

    function calculateTrend(data) {
        const counts = {};
        data.forEach(d => {
            const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
            const key = date.toISOString().split('T')[0];
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }

    function calculateTrendPercentage(trendData) {
        const values = Object.values(trendData);
        if (values.length < 2) return 0;

        const mid = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0);
        const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0);

        if (firstHalf === 0) return 100;
        return Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
    }

    // ================= EXPORT FUNCTIONS =================
    async function exportToExcel(config) {
        try {
            // Filtrar datos según configuración
            let dataToExport = [..._rawData];

            if (config.scope === 'custom' && config.selectedTypes.length > 0) {
                dataToExport = dataToExport.filter(d => {
                    return config.selectedTypes.some(type => {
                        if (type === 'Consulta') return d.tipo.toLowerCase().includes('consulta');
                        if (type === 'Trabajo Individual') return d.tipo.toLowerCase().includes('individual');
                        if (type === 'Trabajo en Equipo') return d.tipo.toLowerCase().includes('equipo');
                        if (type === 'Uso de Computadora') return d.tipo.toLowerCase().includes('computadora');
                        return d.tipo === type;
                    });
                });
            }

            if (!window.ExportUtils) {
                alert('Error: Utilidades de exportación no disponibles');
                return;
            }

            window.ExportUtils.generateExcel(config, dataToExport, _currentArea);
        } catch (error) {
            console.error('Error al generar Excel:', error);
            alert('Error al generar el archivo Excel. Por favor, intenta de nuevo.');
        }
    }

    async function exportToPDF(config) {
        try {
            console.log('Exportando PDF con config:', config);

            // Filtrar datos según configuración
            let dataToExport = [..._rawData];

            if (config.scope === 'custom' && config.selectedTypes.length > 0) {
                dataToExport = dataToExport.filter(d => {
                    return config.selectedTypes.some(type => {
                        if (type === 'Consulta') return d.tipo.toLowerCase().includes('consulta');
                        if (type === 'Trabajo Individual') return d.tipo.toLowerCase().includes('individual');
                        if (type === 'Trabajo en Equipo') return d.tipo.toLowerCase().includes('equipo');
                        if (type === 'Uso de Computadora') return d.tipo.toLowerCase().includes('computadora');
                        return d.tipo === type;
                    });
                });
            }

            console.log('Datos a exportar:', dataToExport.length, 'registros');

            if (!window.ExportUtils) {
                alert('Error: Utilidades de exportación no disponibles');
                return;
            }

            await window.ExportUtils.generatePDF(config, dataToExport, _currentArea);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            console.error('Stack trace:', error.stack);
            alert(`Error al generar el archivo PDF: ${error.message || 'Error desconocido'}\n\nRevisa la consola para más detalles.`);
        }
    }

    return {
        init,
        navigateTo,
        goBack,
        setPeriod,
        showExportModal,
        openCardDetail,
        openDiagnosticoDetail,
        exportModalData
    };

})();

window.Reportes = Reportes;
