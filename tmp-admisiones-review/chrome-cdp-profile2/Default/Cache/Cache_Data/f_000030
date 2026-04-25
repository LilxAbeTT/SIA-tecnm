// public/modules/lactario/lactario.admin.js
// Admin controller for Lactario

if (!window.LactarioModule) window.LactarioModule = {};

if (!window.LactarioModule.Admin) {
    window.LactarioModule.Admin = (function () {
        function create(shared, state) {
            const service = window.LactarioService;
            const ADMIN_TAB_LABELS = Object.freeze({
                overview: 'Resumen',
                agenda: 'Agenda',
                spaces: 'Cubiculos',
                fridges: 'Refrigeradores',
                config: 'Configuracion',
                stats: 'Estadisticas'
            });
            if (!shared || !service) throw new Error('[Lactario] Dependencias de administración no disponibles.');

            return {
                render,
                init,
                cleanup,
                switchAdminTab,
                refreshAdminOverview,
                setOverviewDate,
                loadAdminAgenda,
                setAgendaDate,
                setAgendaStatusFilter,
                setAgendaTypeFilter,
                adminSetBookingStatus,
                addSpacePrompt,
                editSpace,
                toggleSpace,
                deleteSpace,
                printQR,
                addFridgePrompt,
                editFridge,
                toggleFridge,
                deleteFridge,
                saveAdminConfig,
                loadAdminStats,
                exportReport
            };

            function render() {
                const today = state.admin.overviewDate || shared.getDateBounds().today;
                const config = state.config || {};

                return `
                    <section class="card lactario-hero border-0 shadow-sm mb-4">
                        <div class="card-body p-4 p-lg-5">
                            <div class="d-flex flex-column flex-xl-row justify-content-between gap-4 align-items-xl-center">
                                <div>
                                    <span class="badge rounded-pill bg-white text-maternal fw-semibold border border-maternal-soft mb-3">
                                        <i class="bi bi-shield-check me-2"></i>Calidad · Lactario
                                    </span>
                                    <h2 class="fw-bold lactario-hero-title mb-2">Centro operativo de Lactario</h2>
                                    <p class="text-muted mb-0">Agenda, ocupación, frigobar, configuración y estadísticas desde un orquestador más pequeño y estable.</p>
                                </div>
                                <div class="lactario-quick-grid flex-grow-1">
                                    <div class="lactario-kpi">
                                        <strong id="admin-hero-open">${shared.safeText(String(config.openHour ?? 8))}:00</strong>
                                        <span>Apertura</span>
                                    </div>
                                    <div class="lactario-kpi">
                                        <strong id="admin-hero-close">${shared.safeText(String(config.closeHour ?? 20))}:00</strong>
                                        <span>Cierre</span>
                                    </div>
                                    <div class="lactario-kpi">
                                        <strong id="admin-hero-usage">${shared.safeText(String(config.usageTime ?? 30))} min</strong>
                                        <span>Uso estimado</span>
                                    </div>
                                    <div class="lactario-kpi">
                                        <strong id="admin-hero-date">${shared.safeText(today)}</strong>
                                        <span>Fecha operativa</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-3">
                            <div class="d-flex flex-wrap gap-2" id="lactario-admin-tabs">
                                ${renderTabButton('overview', 'Resumen', 'bi-speedometer2', true)}
                                ${renderTabButton('agenda', 'Agenda', 'bi-calendar-week', false)}
                                ${renderTabButton('spaces', 'Cubículos', 'bi-door-closed', false)}
                                ${renderTabButton('fridges', 'Refrigeradores', 'bi-snow2', false)}
                                ${renderTabButton('config', 'Configuración', 'bi-sliders', false)}
                                ${renderTabButton('stats', 'Estadísticas', 'bi-bar-chart', false)}
                            </div>
                        </div>
                    </section>

                    <div id="pane-overview" class="lactario-admin-pane">
                        <div class="row g-4">
                            <div class="col-xl-8">
                                <section class="card border-0 shadow-sm mb-4">
                                    <div class="card-body p-4">
                                        <div class="lactario-filter-row mb-4">
                                            <div>
                                                <label class="form-label small fw-semibold text-muted">Fecha de operación</label>
                                                <input type="date" class="form-control rounded-pill" id="admin-overview-date" value="${shared.safeAttr(today)}" onchange="Lactario.setOverviewDate(this.value)">
                                            </div>
                                            <div>
                                                <button type="button" class="btn btn-outline-maternal rounded-pill" onclick="Lactario.refreshAdminOverview()">
                                                    <i class="bi bi-arrow-repeat me-2"></i>Actualizar resumen
                                                </button>
                                            </div>
                                        </div>
                                        <div id="admin-overview-summary" class="lactario-quick-grid">
                                            <div class="lactario-kpi"><strong>...</strong><span>Cargando</span></div>
                                        </div>
                                    </div>
                                </section>
                                <section class="card border-0 shadow-sm">
                                    <div class="card-body p-4">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h5 class="fw-bold text-maternal mb-1">Próximos movimientos</h5>
                                                <p class="text-muted small mb-0">Reservas del día con foco en entradas, retrasos y seguimiento médico.</p>
                                            </div>
                                        </div>
                                        <div id="admin-overview-bookings" class="lactario-mini-list">
                                            <div class="lactario-empty">Cargando agenda operativa...</div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div class="col-xl-4">
                                <section class="card border-0 shadow-sm mb-4">
                                    <div class="card-body p-4">
                                        <h6 class="fw-bold text-maternal mb-1">Frigobar en uso</h6>
                                        <p class="text-muted small mb-3">Contenedores pendientes de retiro.</p>
                                        <div id="admin-overview-fridges">
                                            <div class="lactario-empty">Cargando refrigeradores activos...</div>
                                        </div>
                                    </div>
                                </section>
                                <section class="card border-0 shadow-sm">
                                    <div class="card-body p-4">
                                        <h6 class="fw-bold text-maternal mb-1">Reglas activas</h6>
                                        <p class="text-muted small mb-3">Vista rápida de la configuración vigente.</p>
                                        <div id="admin-overview-rules" class="lactario-mini-list"></div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>

                    <div id="pane-agenda" class="lactario-admin-pane d-none">
                        <section class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
                                    <div>
                                        <h5 class="fw-bold text-maternal mb-1">Agenda operativa</h5>
                                        <p class="text-muted small mb-0">Filtra por fecha, estado y tipo de visita. Desde aquí puedes marcar entradas, cierres o incidencias.</p>
                                    </div>
                                    <button type="button" class="btn btn-outline-maternal rounded-pill" onclick="Lactario.loadAdminAgenda()">
                                        <i class="bi bi-arrow-repeat me-2"></i>Recargar agenda
                                    </button>
                                </div>
                                <div class="lactario-filter-row mb-4">
                                    <div>
                                        <label class="form-label small fw-semibold text-muted">Fecha</label>
                                        <input type="date" class="form-control rounded-pill" id="admin-agenda-date" value="${shared.safeAttr(state.admin.agendaDate || today)}" onchange="Lactario.setAgendaDate(this.value)">
                                    </div>
                                    <div>
                                        <label class="form-label small fw-semibold text-muted">Estado</label>
                                        <select class="form-select rounded-pill" id="admin-agenda-status" onchange="Lactario.setAgendaStatusFilter(this.value)">
                                            ${renderSelectOptions([
                    { value: 'all', label: 'Todos' },
                    { value: 'confirmed', label: 'Confirmadas' },
                    { value: 'checked-in', label: 'En curso' },
                    { value: 'completed', label: 'Completadas' },
                    { value: 'cancelled', label: 'Canceladas' },
                    { value: 'no-show', label: 'No-show' }
                ], state.admin.agendaStatus || 'all')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="form-label small fw-semibold text-muted">Tipo</label>
                                        <select class="form-select rounded-pill" id="admin-agenda-type" onchange="Lactario.setAgendaTypeFilter(this.value)">
                                            ${renderSelectOptions([
                    { value: 'all', label: 'Todos' },
                    { value: 'Lactancia', label: 'Lactancia' },
                    { value: 'Extracción', label: 'Extracción' }
                ], state.admin.agendaType || 'all')}
                                        </select>
                                    </div>
                                </div>
                                <div id="admin-agenda-list" class="lactario-mini-list">
                                    <div class="lactario-empty">Cargando agenda...</div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div id="pane-spaces" class="lactario-admin-pane d-none">
                        <section class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <div class="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                                    <div>
                                        <h5 class="fw-bold text-maternal mb-1">Cubículos</h5>
                                        <p class="text-muted small mb-0">Administra nombres, activación y QR por espacio.</p>
                                    </div>
                                    <button type="button" class="btn btn-maternal rounded-pill" onclick="Lactario.addSpacePrompt()">
                                        <i class="bi bi-plus-circle me-2"></i>Nuevo cubículo
                                    </button>
                                </div>
                                <div id="admin-spaces-list" class="lactario-mini-list">
                                    <div class="lactario-empty">Cargando cubículos...</div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div id="pane-fridges" class="lactario-admin-pane d-none">
                        <section class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <div class="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                                    <div>
                                        <h5 class="fw-bold text-maternal mb-1">Refrigeradores</h5>
                                        <p class="text-muted small mb-0">Capacidad, estado operativo y contenedores pendientes.</p>
                                    </div>
                                    <button type="button" class="btn btn-maternal rounded-pill" onclick="Lactario.addFridgePrompt()">
                                        <i class="bi bi-plus-circle me-2"></i>Nuevo refrigerador
                                    </button>
                                </div>
                                <div class="row g-4">
                                    <div class="col-xl-7">
                                        <div id="admin-fridges-list" class="lactario-mini-list">
                                            <div class="lactario-empty">Cargando refrigeradores...</div>
                                        </div>
                                    </div>
                                    <div class="col-xl-5">
                                        <div class="card border bg-light-subtle">
                                            <div class="card-body p-3">
                                                <h6 class="fw-bold text-maternal mb-1">Resguardos activos</h6>
                                                <p class="text-muted small mb-3">Pendientes de retiro.</p>
                                                <div id="admin-fridge-items" class="lactario-mini-list"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div id="pane-config" class="lactario-admin-pane d-none">
                        <section class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
                                    <div>
                                        <h5 class="fw-bold text-maternal mb-1">Configuración</h5>
                                        <p class="text-muted small mb-0">Horarios, duración de sesión, tolerancia y estado general del servicio.</p>
                                    </div>
                                    <button type="button" class="btn btn-maternal rounded-pill" onclick="Lactario.saveAdminConfig()">Guardar cambios</button>
                                </div>
                                <form id="form-lactario-config">
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label small fw-semibold text-muted">Hora de apertura</label>
                                            <input type="number" min="0" max="23" class="form-control rounded-4" id="lac-openHour" value="${shared.safeAttr(String(config.openHour ?? 8))}">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-semibold text-muted">Hora de cierre</label>
                                            <input type="number" min="1" max="23" class="form-control rounded-4" id="lac-closeHour" value="${shared.safeAttr(String(config.closeHour ?? 20))}">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-semibold text-muted">Duración del slot</label>
                                            <input type="number" min="15" max="180" class="form-control rounded-4" id="lac-slotDuration" value="${shared.safeAttr(String(config.slotDuration ?? 60))}">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-semibold text-muted">Tiempo de uso</label>
                                            <input type="number" min="10" max="180" class="form-control rounded-4" id="lac-usageTime" value="${shared.safeAttr(String(config.usageTime ?? 30))}">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-semibold text-muted">Tolerancia de entrada</label>
                                            <input type="number" min="0" max="120" class="form-control rounded-4" id="lac-tolerance" value="${shared.safeAttr(String(config.tolerance ?? 20))}">
                                        </div>
                                        <div class="col-md-4 d-flex align-items-end">
                                            <div class="form-check p-3 border rounded-4 w-100">
                                                <input class="form-check-input" type="checkbox" id="lac-enabled" ${config.enabled === false ? '' : 'checked'}>
                                                <label class="form-check-label ms-2 fw-semibold" for="lac-enabled">Servicio habilitado</label>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </section>
                    </div>

                    <div id="pane-stats" class="lactario-admin-pane d-none">
                        <section class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
                                    <div>
                                        <h5 class="fw-bold text-maternal mb-1">Estadísticas</h5>
                                        <p class="text-muted small mb-0">Tendencias operativas y distribución de uso sin depender del archivo grande anterior.</p>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        <div class="lactario-pill-toggle">
                                            <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill active" id="stats-range-7days" onclick="Lactario.loadAdminStats('7days')">7 días</button>
                                            <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" id="stats-range-30days" onclick="Lactario.loadAdminStats('30days')">30 días</button>
                                            <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" id="stats-range-all" onclick="Lactario.loadAdminStats('all')">Todo</button>
                                        </div>
                                        <button type="button" class="btn btn-outline-maternal rounded-pill" onclick="Lactario.exportReport('csv')">
                                            <i class="bi bi-filetype-csv me-2"></i>CSV
                                        </button>
                                        <button type="button" class="btn btn-outline-maternal rounded-pill" onclick="Lactario.exportReport('doc')">
                                            <i class="bi bi-file-earmark-word me-2"></i>DOC
                                        </button>
                                    </div>
                                </div>
                                <div id="admin-stats-summary" class="lactario-quick-grid mb-4">
                                    <div class="lactario-kpi"><strong>...</strong><span>Cargando</span></div>
                                </div>
                                <div class="row g-4">
                                    <div class="col-lg-6">
                                        <div class="card border bg-light-subtle">
                                            <div class="card-body p-3">
                                                <h6 class="fw-bold text-maternal mb-3">Uso por día</h6>
                                                <div id="admin-stats-dates" class="lactario-mini-list"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-lg-6">
                                        <div class="card border bg-light-subtle">
                                            <div class="card-body p-3">
                                                <h6 class="fw-bold text-maternal mb-3">Uso por hora y tipo</h6>
                                                <div id="admin-stats-hours" class="lactario-mini-list"></div>
                                                <div id="admin-stats-types" class="lactario-mini-list mt-4"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                `;
            }

            async function init(ctx) {
                state.ctx = ctx;
                state.profile = ctx?.profile || null;
                state.config = await service.loadConfig(ctx);
                syncHeroConfig();
                await switchAdminTab(state.admin.activeTab || 'overview');
            }

            function cleanup() {
                state.admin.overview = null;
                state.admin.agendaBookings = [];
                state.admin.spaces = [];
                state.admin.fridges = [];
                state.admin.fridgeItems = [];
                state.admin.currentStats = null;
            }

            async function switchAdminTab(tabId = 'overview') {
                const validTabs = ['overview', 'agenda', 'spaces', 'fridges', 'config', 'stats'];
                state.admin.activeTab = validTabs.includes(tabId) ? tabId : 'overview';
                syncBreadcrumb(state.admin.activeTab);

                Array.from(document.querySelectorAll('#lactario-admin-tabs .btn')).forEach((button) => {
                    button.classList.toggle('active', button.dataset.tab === state.admin.activeTab);
                });
                Array.from(document.querySelectorAll('.lactario-admin-pane')).forEach((pane) => {
                    pane.classList.toggle('d-none', pane.id !== `pane-${state.admin.activeTab}`);
                });

                if (state.admin.activeTab === 'overview') await refreshAdminOverview();
                if (state.admin.activeTab === 'agenda') await loadAdminAgenda();
                if (state.admin.activeTab === 'spaces') await loadAdminSpaces();
                if (state.admin.activeTab === 'fridges') await loadAdminFridges();
                if (state.admin.activeTab === 'config') loadAdminConfig();
                if (state.admin.activeTab === 'stats') await loadAdminStats(state.admin.currentRange || '7days');
            }

            function syncBreadcrumb(tabId = state.admin.activeTab) {
                const label = ADMIN_TAB_LABELS[tabId] || ADMIN_TAB_LABELS.overview;
                window.SIA?.setBreadcrumbSection?.('view-lactario', label, { moduleClickable: false });
            }

            async function refreshAdminOverview() {
                const host = shared.getEl('admin-overview-summary');
                if (host) host.innerHTML = '<div class="lactario-empty">Cargando resumen...</div>';

                state.admin.overview = await service.getAdminDashboardSnapshot(state.ctx, state.admin.overviewDate);
                const { summary, bookings, activeFridgeItems } = state.admin.overview;

                if (host) {
                    host.innerHTML = `
                        ${renderKpi(summary.total, 'Reservas del día')}
                        ${renderKpi(summary.upcoming, 'Próximas entradas')}
                        ${renderKpi(summary.checkedIn, 'Sesiones en curso')}
                        ${renderKpi(summary.delayedCheckins, 'Entradas retrasadas')}
                        ${renderKpi(summary.medicalSupport, 'Con apoyo médico')}
                        ${renderKpi(summary.fridgesInUse, 'Frigobar ocupado')}
                    `;
                }

                const bookingsHost = shared.getEl('admin-overview-bookings');
                if (bookingsHost) {
                    const relevant = bookings
                        .filter((item) => ['confirmed', 'checked-in'].includes(item.status))
                        .slice(0, 8);

                    bookingsHost.innerHTML = relevant.length
                        ? relevant.map((item) => renderBookingCard(item, true)).join('')
                        : '<div class="lactario-empty">No hay movimientos relevantes para esta fecha.</div>';
                }

                const fridgeHost = shared.getEl('admin-overview-fridges');
                if (fridgeHost) {
                    fridgeHost.innerHTML = activeFridgeItems.length
                        ? activeFridgeItems.map((item) => `
                            <article class="lactario-booking-card">
                                <div class="fw-semibold text-dark mb-1">${shared.safeText(item.userName || 'Estudiante')}</div>
                                <div class="small text-muted mb-1">${shared.safeText(item.fridgeId || 'Refrigerador')}</div>
                                <div class="small text-muted">${shared.safeText(shared.formatDateTime(item.fridgeTime || item.date))}</div>
                            </article>
                        `).join('')
                        : '<div class="lactario-empty">No hay resguardos activos.</div>';
                }

                renderRulesSummary();
            }

            async function setOverviewDate(dateStr) {
                state.admin.overviewDate = dateStr || shared.getDateBounds().today;
                shared.setText('admin-hero-date', state.admin.overviewDate);
                await refreshAdminOverview();
            }

            async function loadAdminAgenda() {
                const host = shared.getEl('admin-agenda-list');
                if (host) host.innerHTML = '<div class="lactario-empty">Cargando agenda...</div>';

                const bookings = await service.getAdminBookings(state.ctx, {
                    dateStr: state.admin.agendaDate,
                    status: state.admin.agendaStatus,
                    type: state.admin.agendaType
                });
                state.admin.agendaBookings = bookings;

                if (!host) return;
                host.innerHTML = bookings.length
                    ? bookings.map((item) => renderBookingCard(item, false)).join('')
                    : '<div class="lactario-empty">No hay reservas para ese filtro.</div>';
            }

            async function setAgendaDate(dateStr) {
                state.admin.agendaDate = dateStr || shared.getDateBounds().today;
                await loadAdminAgenda();
            }

            async function setAgendaStatusFilter(status) {
                state.admin.agendaStatus = status || 'all';
                await loadAdminAgenda();
            }

            async function setAgendaTypeFilter(type) {
                state.admin.agendaType = type || 'all';
                await loadAdminAgenda();
            }

            async function adminSetBookingStatus(bookingId, status) {
                if (!bookingId || !status) return;
                let reason = '';
                if (status === 'cancelled') {
                    reason = prompt('Motivo de cancelación:', 'Cancelada por administración') || 'Cancelada por administración';
                }
                if (status === 'no-show') {
                    reason = prompt('Motivo para marcar no-show:', 'No-show validado por administración') || 'No-show validado por administración';
                }

                try {
                    await service.adminUpdateBookingStatus(state.ctx, bookingId, { status, reason });
                    shared.showToast('Estado actualizado.', 'success');
                    await Promise.all([
                        refreshAdminOverview(),
                        loadAdminAgenda(),
                        loadAdminStats(state.admin.currentRange || '7days')
                    ]);
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar la reserva.', 'danger');
                }
            }
            function addSpacePrompt() {
                showModalForm('Nuevo cubículo', [
                    { id: 'space-name', label: 'Nombre', value: '' }
                ], async (values) => {
                    const name = String(values['space-name'] || '').trim();
                    if (!name) throw new Error('El nombre del cubículo es obligatorio.');
                    await service.addSpace(state.ctx, name);
                    await loadAdminSpaces();
                });
            }

            function editSpace(id, name) {
                showModalForm('Editar cubículo', [
                    { id: 'space-name', label: 'Nombre', value: name || '' }
                ], async (values) => {
                    const nextName = String(values['space-name'] || '').trim();
                    if (!nextName) throw new Error('El nombre del cubículo es obligatorio.');
                    await service.updateSpace(state.ctx, id, { name: nextName });
                    await loadAdminSpaces();
                });
            }

            async function toggleSpace(id, active) {
                try {
                    await service.toggleSpace(state.ctx, id, !!active);
                    await loadAdminSpaces();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar el cubículo.', 'danger');
                }
            }

            async function deleteSpace(id) {
                if (!confirm('¿Eliminar este cubículo permanentemente?')) return;
                try {
                    await service.deleteSpace(state.ctx, id);
                    await loadAdminSpaces();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible eliminar el cubículo.', 'danger');
                }
            }

            function printQR(id, name) {
                const w = window.open('', '_blank');
                if (!w) {
                    shared.showToast('El navegador bloqueó la ventana de impresión.', 'warning');
                    return;
                }

                const safeName = shared.safeText(name || id);
                const safeId = shared.safeText(id);
                const qrText = JSON.stringify(String(id ?? ''));
                w.document.write(`
                    <html>
                        <body style="text-align:center; font-family: sans-serif; padding: 24px;">
                            <div id="qrcode" style="display:inline-block; margin-bottom:20px;"></div>
                            <h1 style="margin:0; font-size: 2em;">${safeName}</h1>
                            <p style="color:gray; font-size:1.1em;">${safeId}</p>
                            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
                            <script>
                                new QRCode(document.getElementById("qrcode"), { text: ${qrText}, width: 280, height: 280 });
                                setTimeout(function () { window.print(); }, 800);
                            <\/script>
                        </body>
                    </html>
                `);
                w.document.close();
            }

            function addFridgePrompt() {
                showModalForm('Nuevo refrigerador', [
                    { id: 'fridge-name', label: 'Nombre', value: '' },
                    { id: 'fridge-limit', label: 'Capacidad', type: 'number', value: '10' }
                ], async (values) => {
                    const name = String(values['fridge-name'] || '').trim();
                    const limit = Number(values['fridge-limit']);
                    if (!name) throw new Error('El nombre del refrigerador es obligatorio.');
                    if (!Number.isFinite(limit) || limit <= 0) throw new Error('La capacidad debe ser mayor a cero.');
                    await service.addFridge(state.ctx, name, limit);
                    await loadAdminFridges();
                });
            }

            function editFridge(id, name, limit) {
                showModalForm('Editar refrigerador', [
                    { id: 'fridge-name', label: 'Nombre', value: name || '' },
                    { id: 'fridge-limit', label: 'Capacidad', type: 'number', value: String(limit || 10) }
                ], async (values) => {
                    const nextName = String(values['fridge-name'] || '').trim();
                    const nextLimit = Number(values['fridge-limit']);
                    if (!nextName) throw new Error('El nombre del refrigerador es obligatorio.');
                    if (!Number.isFinite(nextLimit) || nextLimit <= 0) throw new Error('La capacidad debe ser mayor a cero.');
                    await service.updateFridge(state.ctx, id, { name: nextName, limit: nextLimit });
                    await loadAdminFridges();
                });
            }

            async function toggleFridge(id, active) {
                try {
                    await service.toggleFridge(state.ctx, id, !!active);
                    await loadAdminFridges();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar el refrigerador.', 'danger');
                }
            }

            async function deleteFridge(id) {
                if (!confirm('¿Eliminar este refrigerador permanentemente?')) return;
                try {
                    await service.deleteFridge(state.ctx, id);
                    await loadAdminFridges();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible eliminar el refrigerador.', 'danger');
                }
            }

            async function saveAdminConfig() {
                const openHour = Number(shared.getEl('lac-openHour')?.value);
                const closeHour = Number(shared.getEl('lac-closeHour')?.value);
                const slotDuration = Number(shared.getEl('lac-slotDuration')?.value);
                const usageTime = Number(shared.getEl('lac-usageTime')?.value);
                const tolerance = Number(shared.getEl('lac-tolerance')?.value);
                const enabled = !!shared.getEl('lac-enabled')?.checked;

                if (!Number.isFinite(openHour) || !Number.isFinite(closeHour) || openHour >= closeHour) {
                    shared.showToast('La hora de apertura debe ser menor a la de cierre.', 'warning');
                    return;
                }
                if (!Number.isFinite(slotDuration) || slotDuration < 15) {
                    shared.showToast('La duración del slot debe ser de al menos 15 minutos.', 'warning');
                    return;
                }
                if (!Number.isFinite(usageTime) || usageTime <= 0 || usageTime > slotDuration) {
                    shared.showToast('El tiempo de uso debe ser mayor a cero y no exceder el slot.', 'warning');
                    return;
                }
                if (!Number.isFinite(tolerance) || tolerance < 0) {
                    shared.showToast('La tolerancia debe ser un número válido.', 'warning');
                    return;
                }

                try {
                    state.config = await service.updateConfig(state.ctx, {
                        openHour,
                        closeHour,
                        slotDuration,
                        usageTime,
                        tolerance,
                        enabled
                    });
                    syncHeroConfig();
                    renderRulesSummary();
                    shared.showToast('Configuración actualizada.', 'success');
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible guardar la configuración.', 'danger');
                }
            }

            async function loadAdminStats(range = '7days') {
                state.admin.currentRange = range;
                setActiveStatsRange(range);

                const stats = await service.getStats(state.ctx, range);
                state.admin.currentStats = stats;

                const summaryHost = shared.getEl('admin-stats-summary');
                if (summaryHost) {
                    summaryHost.innerHTML = `
                        ${renderKpi(stats.total || 0, 'Reservas registradas')}
                        ${renderKpi(stats.statusCounts?.completed || 0, 'Completadas')}
                        ${renderKpi(stats.statusCounts?.cancelled || 0, 'Canceladas')}
                        ${renderKpi(stats.statusCounts?.['no-show'] || 0, 'No-show')}
                        ${renderKpi(stats.averageDuration || 0, 'Minutos promedio')}
                        ${renderKpi(stats.peakHour || '-', 'Hora pico')}
                    `;
                }

                renderStatList('admin-stats-dates', stats.visitsByDate, 'visitas');
                renderStatList('admin-stats-hours', stats.visitsByHour, 'visitas');
                renderStatList('admin-stats-types', stats.visitsByReason, 'sesiones');
            }

            function exportReport(type = 'csv') {
                const stats = state.admin.currentStats;
                if (!stats) {
                    shared.showToast('Primero carga las estadísticas que deseas exportar.', 'warning');
                    return;
                }

                const rows = [
                    ['Métrica', 'Valor'],
                    ['Rango', state.admin.currentRange || '7days'],
                    ['Reservas registradas', stats.total || 0],
                    ['Completadas', stats.statusCounts?.completed || 0],
                    ['Canceladas', stats.statusCounts?.cancelled || 0],
                    ['No-show', stats.statusCounts?.['no-show'] || 0],
                    ['Confirmadas', stats.statusCounts?.confirmed || 0],
                    ['Duración promedio', stats.averageDuration || 0],
                    ['Hora pico', stats.peakHour || '-']
                ];

                if (type === 'doc') {
                    const html = `
                        <html>
                            <body style="font-family: Arial, sans-serif; padding: 24px;">
                                <h1>Reporte de Lactario</h1>
                                <p>Rango: ${shared.safeText(state.admin.currentRange || '7days')}</p>
                                <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; width: 100%;">
                                    ${rows.map((row) => `<tr>${row.map((cell) => `<td>${shared.safeText(String(cell))}</td>`).join('')}</tr>`).join('')}
                                </table>
                            </body>
                        </html>
                    `;
                    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
                    downloadBlob(blob, `Reporte_Lactario_${Date.now()}.doc`);
                    return;
                }

                const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
                const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
                downloadBlob(blob, `Reporte_Lactario_${Date.now()}.csv`);
            }

            async function loadAdminSpaces() {
                const host = shared.getEl('admin-spaces-list');
                if (host) host.innerHTML = '<div class="lactario-empty">Cargando cubículos...</div>';
                const spaces = await service.getSpaces(state.ctx);
                state.admin.spaces = spaces;

                if (!host) return;
                host.innerHTML = spaces.length
                    ? spaces.map((space) => `
                        <article class="lactario-booking-card">
                            <div class="d-flex justify-content-between align-items-start gap-3">
                                <div>
                                    <div class="fw-semibold text-dark mb-1">${shared.safeText(space.name)}</div>
                                    <div class="small text-muted mb-1">ID: ${shared.safeText(space.id)}</div>
                                    <span class="badge rounded-pill ${space.active !== false ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}">
                                        ${space.active !== false ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <div class="lactario-actions-cluster">
                                    <div class="form-check form-switch mt-1">
                                        <input class="form-check-input" type="checkbox" ${space.active !== false ? 'checked' : ''} onchange="Lactario.toggleSpace('${shared.safeJsString(space.id)}', this.checked)">
                                    </div>
                                    <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" onclick="Lactario.editSpace('${shared.safeJsString(space.id)}', '${shared.safeJsString(space.name)}')">Editar</button>
                                    <button type="button" class="btn btn-sm btn-outline-dark rounded-pill" onclick="Lactario.printQR('${shared.safeJsString(space.id)}', '${shared.safeJsString(space.name)}')">QR</button>
                                    <button type="button" class="btn btn-sm btn-outline-danger rounded-pill" onclick="Lactario.deleteSpace('${shared.safeJsString(space.id)}')">Eliminar</button>
                                </div>
                            </div>
                        </article>
                    `).join('')
                    : '<div class="lactario-empty">No hay cubículos registrados.</div>';
            }

            async function loadAdminFridges() {
                const [fridges, activeItems] = await Promise.all([
                    service.getFridges(state.ctx),
                    service.getActiveFridgeItems(state.ctx)
                ]);

                state.admin.fridges = fridges;
                state.admin.fridgeItems = activeItems;

                const fridgesHost = shared.getEl('admin-fridges-list');
                const itemsHost = shared.getEl('admin-fridge-items');

                if (fridgesHost) {
                    fridgesHost.innerHTML = fridges.length
                        ? fridges.map((fridge) => `
                            <article class="lactario-booking-card">
                                <div class="d-flex justify-content-between align-items-start gap-3">
                                    <div>
                                        <div class="fw-semibold text-dark mb-1">${shared.safeText(fridge.name)}</div>
                                        <div class="small text-muted mb-1">Capacidad: ${shared.safeText(String(fridge.limit || 10))} espacios</div>
                                        <span class="badge rounded-pill ${fridge.active !== false ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}">
                                            ${fridge.active !== false ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <div class="lactario-actions-cluster">
                                        <div class="form-check form-switch mt-1">
                                            <input class="form-check-input" type="checkbox" ${fridge.active !== false ? 'checked' : ''} onchange="Lactario.toggleFridge('${shared.safeJsString(fridge.id)}', this.checked)">
                                        </div>
                                        <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill" onclick="Lactario.editFridge('${shared.safeJsString(fridge.id)}', '${shared.safeJsString(fridge.name)}', ${Number(fridge.limit || 10)})">Editar</button>
                                        <button type="button" class="btn btn-sm btn-outline-dark rounded-pill" onclick="Lactario.printQR('${shared.safeJsString(fridge.id)}', '${shared.safeJsString(fridge.name)}')">QR</button>
                                        <button type="button" class="btn btn-sm btn-outline-danger rounded-pill" onclick="Lactario.deleteFridge('${shared.safeJsString(fridge.id)}')">Eliminar</button>
                                    </div>
                                </div>
                            </article>
                        `).join('')
                        : '<div class="lactario-empty">No hay refrigeradores registrados.</div>';
                }

                if (itemsHost) {
                    itemsHost.innerHTML = activeItems.length
                        ? activeItems.map((item) => `
                            <article class="lactario-booking-card">
                                <div class="fw-semibold text-dark mb-1">${shared.safeText(item.userName || 'Estudiante')}</div>
                                <div class="small text-muted mb-1">${shared.safeText(item.fridgeId || 'Refrigerador')}</div>
                                <div class="small text-muted mb-1">${shared.safeText(shared.formatDateTime(item.fridgeTime || item.date))}</div>
                                <div class="small text-muted">${shared.safeText(item.spaceName || item.spaceId || 'Cubículo')}</div>
                            </article>
                        `).join('')
                        : '<div class="lactario-empty">Sin resguardos activos.</div>';
                }
            }

            function loadAdminConfig() {
                if (!state.config) return;
                if (shared.getEl('lac-openHour')) shared.getEl('lac-openHour').value = String(state.config.openHour ?? 8);
                if (shared.getEl('lac-closeHour')) shared.getEl('lac-closeHour').value = String(state.config.closeHour ?? 20);
                if (shared.getEl('lac-slotDuration')) shared.getEl('lac-slotDuration').value = String(state.config.slotDuration ?? 60);
                if (shared.getEl('lac-usageTime')) shared.getEl('lac-usageTime').value = String(state.config.usageTime ?? 30);
                if (shared.getEl('lac-tolerance')) shared.getEl('lac-tolerance').value = String(state.config.tolerance ?? 20);
                if (shared.getEl('lac-enabled')) shared.getEl('lac-enabled').checked = state.config.enabled !== false;
            }

            function showModalForm(title, inputs, onSave) {
                const titleEl = shared.getEl('lacModalTitle');
                const formEl = shared.getEl('lacModalForm');
                const saveBtn = shared.getEl('lacModalSave');
                const modalEl = shared.getEl('modalLactarioAdmin');
                if (!titleEl || !formEl || !saveBtn || !modalEl || typeof bootstrap === 'undefined') return;

                titleEl.textContent = title;
                formEl.innerHTML = inputs.map((input) => `
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted">${shared.safeText(input.label)}</label>
                        <input type="${shared.safeAttr(input.type || 'text')}" class="form-control rounded-4" id="${shared.safeAttr(input.id)}" value="${shared.safeAttr(input.value || '')}">
                    </div>
                `).join('');

                const nextSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(nextSaveBtn, saveBtn);
                nextSaveBtn.addEventListener('click', async () => {
                    const values = {};
                    inputs.forEach((input) => {
                        values[input.id] = shared.getEl(input.id)?.value;
                    });

                    nextSaveBtn.disabled = true;
                    nextSaveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando';

                    try {
                        await onSave(values);
                        bootstrap.Modal.getInstance(modalEl)?.hide();
                    } catch (error) {
                        shared.showToast(error?.message || 'No fue posible guardar.', 'danger');
                    } finally {
                        nextSaveBtn.disabled = false;
                        nextSaveBtn.textContent = 'Guardar';
                    }
                });

                new bootstrap.Modal(modalEl).show();
            }

            function renderTabButton(tab, label, icon, active) {
                return `
                    <button type="button" class="btn btn-sm btn-outline-maternal rounded-pill ${active ? 'active' : ''}" data-tab="${shared.safeAttr(tab)}" onclick="Lactario.switchAdminTab('${shared.safeJsString(tab)}')">
                        <i class="bi ${icon} me-2"></i>${shared.safeText(label)}
                    </button>
                `;
            }

            function renderSelectOptions(options, selectedValue) {
                return options.map((option) => `
                    <option value="${shared.safeAttr(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${shared.safeText(option.label)}</option>
                `).join('');
            }

            function renderKpi(value, label) {
                return `
                    <div class="lactario-kpi">
                        <strong>${shared.safeText(String(value))}</strong>
                        <span>${shared.safeText(label)}</span>
                    </div>
                `;
            }

            function renderBookingCard(item, compact) {
                return `
                    <article class="lactario-booking-card lactario-admin-booking">
                        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                            <div>
                                <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                                    ${shared.renderStatusBadge(item.status)}
                                    ${item.medicalSupportRequested ? shared.renderSupportBadge(item.medicalSupportStatus || 'pendiente') : ''}
                                    ${item.fridgeStatus === 'stored' ? '<span class="badge rounded-pill bg-info-subtle text-info border border-info-subtle">Frigobar activo</span>' : ''}
                                </div>
                                <div class="fw-semibold text-dark">${shared.safeText(item.userName || 'Estudiante')}</div>
                                <div class="small text-muted mb-1">${shared.safeText(item.userEmail || 'Sin correo visible')}</div>
                                <div class="small text-muted mb-1">${shared.safeText(shared.formatDateTime(item.date))}</div>
                                <div class="small text-muted mb-1">${shared.safeText(item.type || 'Lactancia')} · ${shared.safeText(item.spaceName || item.spaceId || 'Cubículo')}</div>
                                ${item.medicalSupportProfessionalName ? `<div class="small text-muted"><i class="bi bi-stethoscope me-1"></i>${shared.safeText(item.medicalSupportProfessionalName)}</div>` : ''}
                            </div>
                            <div class="lactario-admin-actions ${compact ? '' : 'text-lg-end'}">
                                ${renderActionButtons(item)}
                            </div>
                        </div>
                    </article>
                `;
            }

            function renderActionButtons(item) {
                const buttons = [];
                if (item.status === 'confirmed') {
                    buttons.push(actionButton(item.id, 'checked-in', 'Entrada', 'btn-outline-success'));
                    buttons.push(actionButton(item.id, 'completed', 'Cerrar', 'btn-outline-primary'));
                    buttons.push(actionButton(item.id, 'cancelled', 'Cancelar', 'btn-outline-danger'));
                    buttons.push(actionButton(item.id, 'no-show', 'No-show', 'btn-outline-dark'));
                } else if (item.status === 'checked-in') {
                    buttons.push(actionButton(item.id, 'completed', 'Cerrar', 'btn-outline-primary'));
                    buttons.push(actionButton(item.id, 'cancelled', 'Cancelar', 'btn-outline-danger'));
                } else {
                    buttons.push('<span class="small text-muted">Sin acciones rápidas</span>');
                }
                return buttons.join('');
            }

            function actionButton(id, status, label, className) {
                return `<button type="button" class="btn btn-sm ${className} rounded-pill" onclick="Lactario.adminSetBookingStatus('${shared.safeJsString(id)}', '${shared.safeJsString(status)}')">${shared.safeText(label)}</button>`;
            }

            function renderRulesSummary() {
                const host = shared.getEl('admin-overview-rules');
                if (!host || !state.config) return;

                host.innerHTML = `
                    <article class="lactario-booking-card">
                        <div class="fw-semibold text-dark mb-2">Operación diaria</div>
                        <div class="small text-muted mb-1">Horario: ${shared.safeText(String(state.config.openHour ?? 8))}:00 a ${shared.safeText(String(state.config.closeHour ?? 20))}:00</div>
                        <div class="small text-muted mb-1">Slot total: ${shared.safeText(String(state.config.slotDuration ?? 60))} min</div>
                        <div class="small text-muted mb-1">Uso estimado: ${shared.safeText(String(state.config.usageTime ?? 30))} min</div>
                        <div class="small text-muted">Tolerancia: ${shared.safeText(String(state.config.tolerance ?? 20))} min</div>
                    </article>
                    <article class="lactario-booking-card">
                        <div class="fw-semibold text-dark mb-2">Estado del servicio</div>
                        <span class="badge rounded-pill ${state.config.enabled === false ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">
                            ${state.config.enabled === false ? 'Deshabilitado' : 'Habilitado'}
                        </span>
                    </article>
                `;
            }

            function syncHeroConfig() {
                shared.setText('admin-hero-open', `${state.config?.openHour ?? 8}:00`);
                shared.setText('admin-hero-close', `${state.config?.closeHour ?? 20}:00`);
                shared.setText('admin-hero-usage', `${state.config?.usageTime ?? 30} min`);
                shared.setText('admin-hero-date', state.admin.overviewDate || shared.getDateBounds().today);
            }

            function setActiveStatsRange(range) {
                ['7days', '30days', 'all'].forEach((value) => {
                    const button = shared.getEl(`stats-range-${value}`);
                    button?.classList.toggle('active', value === range);
                });
            }

            function renderStatList(hostId, dataMap, suffix) {
                const host = shared.getEl(hostId);
                if (!host) return;

                const entries = Object.entries(dataMap || {});
                if (!entries.length) {
                    host.innerHTML = '<div class="lactario-empty">Sin datos suficientes.</div>';
                    return;
                }

                const max = Math.max(...entries.map(([, value]) => Number(value) || 0), 1);
                host.innerHTML = entries
                    .sort((a, b) => compareMetricLabels(a[0], b[0]))
                    .map(([label, value]) => `
                        <article class="lactario-booking-card">
                            <div class="d-flex justify-content-between small text-muted mb-2">
                                <span>${shared.safeText(String(label))}</span>
                                <span>${shared.safeText(String(value))} ${shared.safeText(suffix)}</span>
                            </div>
                            <div class="lactario-metric-bar">
                                <span style="width:${Math.max(8, Math.round((Number(value) || 0) / max * 100))}%"></span>
                            </div>
                        </article>
                    `).join('');
            }

            function escapeCsv(value) {
                const text = String(value ?? '');
                return `"${text.replace(/"/g, '""')}"`;
            }

            function downloadBlob(blob, filename) {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                window.URL.revokeObjectURL(url);
            }

            function compareMetricLabels(a, b) {
                const numA = Number(a);
                const numB = Number(b);
                if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
                return String(a).localeCompare(String(b));
            }
        }

        return { create };
    })();
}
