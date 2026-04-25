import { Store } from './core/state.js';
import { UiManager } from './core/ui.js';
import { Router } from './core/router.js';
import { Breadcrumbs } from './core/breadcrumbs.js';

// AuthManager deshabilitado: app.js ya maneja onAuthStateChanged y loginWithMicrosoft.

const ui = new UiManager();
const router = new Router(ui);

window.SIA_CORE = {
    Store,
    ui,
    router,
    breadcrumbs: Breadcrumbs
};

window.SIA = window.SIA || {};
window.SIA._router = router;

document.addEventListener('DOMContentLoaded', () => {
    const SUPPORT_CATEGORY_LABELS = {
        general: 'General',
        dashboard: 'Dashboard',
        aula: 'Aula Virtual',
        biblio: 'Biblioteca',
        medi: 'Servicio Medico',
        foro: 'Foro',
        cafeteria: 'Cafeteria',
        encuestas: 'Encuestas',
        quejas: 'Quejas',
        lactario: 'Lactario',
        perfil: 'Mi Perfil',
        reportes: 'Reportes',
        vocacional: 'Vocacional'
    };

    const SUPPORT_STATUS_LABELS = {
        pendiente: 'Pendiente',
        'en-proceso': 'En proceso',
        resuelto: 'Resuelto',
        rechazado: 'Rechazado'
    };

    const SUPPORT_PRIORITY_LABELS = {
        normal: 'Normal',
        alta: 'Alta',
        critica: 'Critica'
    };

    const supportState = {
        servicePromise: null,
        activeTab: 'report',
        myTickets: [],
        myTicketsLastDoc: null,
        myTicketsHasMore: true,
        myTicketsLoading: false,
        selectedTicketId: '',
        evidenceFile: null,
        currentContext: null
    };

    const reportModalEl = document.getElementById('modalReportProblem');
    const reportBtn = document.getElementById('btn-report-problem');
    const reportForm = document.getElementById('form-report-problem');
    const reportCategoryInput = document.getElementById('report-categoria');
    const reportPriorityInput = document.getElementById('report-priority');
    const reportTitleInput = document.getElementById('report-titulo');
    const reportDescriptionInput = document.getElementById('report-descripcion');
    const evidenceInput = document.getElementById('report-evidence');
    const evidencePreviewWrap = document.getElementById('report-evidence-preview');
    const evidencePreviewImg = document.getElementById('report-evidence-preview-img');
    const clearEvidenceBtn = document.getElementById('btn-report-evidence-clear');
    const myTicketsList = document.getElementById('support-my-tickets-list');
    const myTicketsFooter = document.getElementById('support-my-tickets-footer');
    const myTicketDetail = document.getElementById('support-my-ticket-detail');
    const myTicketDetailEmpty = document.getElementById('support-ticket-detail-empty');

    function escapeSupportHtml(value) {
        if (typeof escapeHtml === 'function') return escapeHtml(String(value || ''));
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    async function ensureSuperAdminService() {
        if (window.SuperAdminService) return window.SuperAdminService;

        if (!supportState.servicePromise) {
            supportState.servicePromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-support-service="true"]');
                if (existing) {
                    existing.addEventListener('load', () => resolve(window.SuperAdminService));
                    existing.addEventListener('error', () => reject(new Error('No se pudo cargar el servicio de soporte.')));
                    return;
                }

                const script = document.createElement('script');
                script.src = '/services/superadmin-service.js';
                script.dataset.supportService = 'true';
                script.onload = () => resolve(window.SuperAdminService);
                script.onerror = () => reject(new Error('No se pudo cargar el servicio de soporte.'));
                document.head.appendChild(script);
            });
        }

        return await supportState.servicePromise;
    }

    function getSupportCtx() {
        return {
            db: window.SIA?.db,
            auth: window.SIA?.auth,
            storage: window.SIA?.storage,
            user: window.SIA?.auth?.currentUser || null,
            profile: window.SIA?.currentUserProfile || {}
        };
    }

    function formatSupportDate(date) {
        if (!date) return 'Sin fecha';
        return new Date(date).toLocaleString('es-MX', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function formatSupportRelative(date) {
        if (!date) return 'Sin actividad';

        const diffMs = Date.now() - new Date(date).getTime();
        const diffMin = Math.round(diffMs / 60000);
        if (diffMin < 1) return 'Hace un momento';
        if (diffMin < 60) return `Hace ${diffMin} min`;

        const diffHours = Math.round(diffMin / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;

        const diffDays = Math.round(diffHours / 24);
        return `Hace ${diffDays} d`;
    }

    function getStatusBadgeClass(status) {
        return {
            pendiente: 'bg-warning text-dark',
            'en-proceso': 'bg-info text-white',
            resuelto: 'bg-success text-white',
            rechazado: 'bg-danger text-white'
        }[status] || 'bg-secondary text-white';
    }

    function getPriorityBadgeClass(priority) {
        return {
            normal: 'bg-secondary-subtle text-dark',
            alta: 'bg-warning-subtle text-dark',
            critica: 'bg-danger text-white'
        }[priority] || 'bg-secondary-subtle text-dark';
    }

    function getCurrentViewId() {
        return document.querySelector('.app-view:not(.d-none)')?.id || Store.currentView || '';
    }

    function inferSupportCategory() {
        const currentView = getCurrentViewId();
        const path = (window.location.pathname || '').toLowerCase();
        const hash = (window.location.hash || '').toLowerCase();
        const source = `${currentView} ${path} ${hash}`;

        const map = [
            ['aula', 'aula'],
            ['biblio', 'biblio'],
            ['medi', 'medi'],
            ['foro', 'foro'],
            ['cafeteria', 'cafeteria'],
            ['encuestas', 'encuestas'],
            ['quejas', 'quejas'],
            ['lactario', 'lactario'],
            ['profile', 'perfil'],
            ['reportes', 'reportes'],
            ['vocacional', 'vocacional'],
            ['dashboard', 'dashboard']
        ];

        const match = map.find(([needle]) => source.includes(needle));
        return match ? match[1] : 'general';
    }

    function buildSupportContext() {
        const currentView = getCurrentViewId();
        const category = inferSupportCategory();
        const context = {
            source: 'bug_fab',
            currentView,
            category,
            routePath: window.location.pathname || '/',
            hash: window.location.hash || '',
            userAgent: navigator.userAgent || '',
            platform: navigator.userAgentData?.platform || navigator.platform || 'Web',
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language || 'es-MX',
            online: navigator.onLine,
            reportedAtClient: new Date().toISOString()
        };

        supportState.currentContext = context;
        return context;
    }

    function hydrateSupportContext() {
        const context = buildSupportContext();
        if (reportCategoryInput) reportCategoryInput.value = context.category;
        if (reportPriorityInput && !reportPriorityInput.value) reportPriorityInput.value = 'normal';

        const moduleEl = document.getElementById('support-context-module');
        const viewEl = document.getElementById('support-context-view');
        const routeEl = document.getElementById('support-context-route');
        const deviceEl = document.getElementById('support-context-device');

        if (moduleEl) moduleEl.textContent = SUPPORT_CATEGORY_LABELS[context.category] || 'General';
        if (viewEl) viewEl.textContent = context.currentView || 'Sin vista detectada';
        if (routeEl) routeEl.textContent = `${context.routePath}${context.hash || ''}`;
        if (deviceEl) deviceEl.textContent = `${context.platform} • ${context.viewport}`;
    }

    function setSupportTab(tabName) {
        supportState.activeTab = tabName;

        document.querySelectorAll('[data-support-tab]').forEach(button => {
            button.classList.toggle('active', button.dataset.supportTab === tabName);
        });

        document.querySelectorAll('[data-support-panel]').forEach(panel => {
            panel.classList.toggle('d-none', panel.dataset.supportPanel !== tabName);
        });

        if (tabName === 'tickets') {
            loadMyTickets(false);
        } else {
            hydrateSupportContext();
        }
    }

    function renderEvidencePreview(file) {
        if (!evidencePreviewWrap || !evidencePreviewImg || !clearEvidenceBtn) return;

        if (!file) {
            evidencePreviewWrap.classList.add('d-none');
            evidencePreviewImg.src = '';
            clearEvidenceBtn.classList.add('d-none');
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        evidencePreviewImg.src = previewUrl;
        evidencePreviewImg.onload = () => URL.revokeObjectURL(previewUrl);
        evidencePreviewWrap.classList.remove('d-none');
        clearEvidenceBtn.classList.remove('d-none');
    }

    function clearSupportEvidence() {
        supportState.evidenceFile = null;
        if (evidenceInput) evidenceInput.value = '';
        renderEvidencePreview(null);
    }

    function resetSupportForm() {
        reportForm?.reset();
        clearSupportEvidence();
        hydrateSupportContext();
        if (reportPriorityInput) reportPriorityInput.value = 'normal';
    }

    function renderSupportHistory(ticket) {
        const visibleHistory = (ticket.history || []).filter(entry => entry.type !== 'internal');
        if (!visibleHistory.length) {
            return '<p class="text-muted text-center small mb-0 py-4">Aun no hay respuestas registradas.</p>';
        }

        return visibleHistory.map(entry => {
            const role = entry.type === 'status_change'
                ? 'status'
                : (entry.role === 'admin' ? 'admin' : 'user');

            const entryClass = role === 'status'
                ? 'support-history-entry support-history-entry-status'
                : role === 'admin'
                    ? 'support-history-entry support-history-entry-admin'
                    : 'support-history-entry';

            const label = role === 'status'
                ? 'Cambio de estado'
                : entry.role === 'admin'
                    ? 'Soporte'
                    : 'Usuario';

            return `
                <div class="${entryClass}">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
                        <strong class="small">${escapeSupportHtml(entry.author || label)}</strong>
                        <span class="extra-small text-muted">${escapeSupportHtml(formatSupportDate(entry.date))}</span>
                    </div>
                    <div class="extra-small text-uppercase fw-bold text-muted mb-1">${escapeSupportHtml(label)}</div>
                    <p class="small mb-0">${escapeSupportHtml(entry.message || '')}</p>
                </div>
            `;
        }).join('');
    }

    function renderMyTicketDetail(ticket) {
        if (!myTicketDetail || !myTicketDetailEmpty) return;

        myTicketDetailEmpty.classList.add('d-none');
        myTicketDetail.classList.remove('d-none');
        myTicketDetail.innerHTML = `
            <div class="support-ticket-user-detail rounded-4 p-4 shadow-sm">
                <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                    <div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                            <span class="badge ${getStatusBadgeClass(ticket.status)} rounded-pill px-3">
                                ${escapeSupportHtml(SUPPORT_STATUS_LABELS[ticket.status] || ticket.status || 'Pendiente')}
                            </span>
                            <span class="badge ${getPriorityBadgeClass(ticket.priority)} rounded-pill px-3">
                                ${escapeSupportHtml(SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority || 'Normal')}
                            </span>
                        </div>
                        <h5 class="fw-bold mb-1">${escapeSupportHtml(ticket.titulo || 'Ticket sin titulo')}</h5>
                        <p class="text-muted small mb-0">
                            Ticket #${escapeSupportHtml(ticket.id.slice(0, 8).toUpperCase())} • Ultima actividad ${escapeSupportHtml(formatSupportRelative(ticket.lastActivityAt || ticket.updatedAt || ticket.createdAt))}
                        </p>
                    </div>
                    <div class="text-muted small text-end">
                        <div>Creado: ${escapeSupportHtml(formatSupportDate(ticket.createdAt))}</div>
                        <div>Actualizado: ${escapeSupportHtml(formatSupportDate(ticket.updatedAt || ticket.createdAt))}</div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-sm-4">
                        <div class="rounded-4 border p-3 h-100">
                            <small class="text-muted fw-bold d-block mb-1">Modulo</small>
                            <div class="small">${escapeSupportHtml(SUPPORT_CATEGORY_LABELS[ticket.categoria] || ticket.categoria || 'General')}</div>
                        </div>
                    </div>
                    <div class="col-sm-4">
                        <div class="rounded-4 border p-3 h-100">
                            <small class="text-muted fw-bold d-block mb-1">Tipo</small>
                            <div class="small">${escapeSupportHtml(ticket.tipo || 'bug')}</div>
                        </div>
                    </div>
                    <div class="col-sm-4">
                        <div class="rounded-4 border p-3 h-100">
                            <small class="text-muted fw-bold d-block mb-1">Vista reportada</small>
                            <div class="small">${escapeSupportHtml(ticket.context?.currentView || 'No disponible')}</div>
                        </div>
                    </div>
                </div>

                <div class="mb-3">
                    <small class="text-muted fw-bold d-block mb-1">Descripcion</small>
                    <div class="rounded-4 border p-3 small">${escapeSupportHtml(ticket.descripcion || '')}</div>
                </div>

                ${(ticket.pasos || ticket.esperado || ticket.actual) ? `
                    <div class="row g-3 mb-3">
                        <div class="col-lg-4">
                            <small class="text-muted fw-bold d-block mb-1">Pasos</small>
                            <div class="rounded-4 border p-3 small">${escapeSupportHtml(ticket.pasos || 'No capturados')}</div>
                        </div>
                        <div class="col-lg-4">
                            <small class="text-muted fw-bold d-block mb-1">Esperado</small>
                            <div class="rounded-4 border p-3 small">${escapeSupportHtml(ticket.esperado || 'No capturado')}</div>
                        </div>
                        <div class="col-lg-4">
                            <small class="text-muted fw-bold d-block mb-1">Actual</small>
                            <div class="rounded-4 border p-3 small">${escapeSupportHtml(ticket.actual || 'No capturado')}</div>
                        </div>
                    </div>
                ` : ''}

                ${ticket.evidenciaUrl ? `
                    <div class="mb-4">
                        <small class="text-muted fw-bold d-block mb-2">Evidencia adjunta</small>
                        <a href="${escapeSupportHtml(ticket.evidenciaUrl)}" target="_blank" rel="noopener noreferrer">
                            <img src="${escapeSupportHtml(ticket.evidenciaUrl)}" class="img-fluid rounded-4 border shadow-sm" style="max-height:260px; object-fit:cover;">
                        </a>
                    </div>
                ` : ''}

                <div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="fw-bold mb-0">Seguimiento</h6>
                        <span class="text-muted extra-small">${escapeSupportHtml(String((ticket.history || []).filter(entry => entry.type !== 'internal').length))} eventos</span>
                    </div>
                    <div class="support-ticket-history d-flex flex-column gap-2">
                        ${renderSupportHistory(ticket)}
                    </div>
                </div>
            </div>
        `;
    }

    function renderMyTicketsList() {
        if (!myTicketsList) return;

        if (!supportState.myTickets.length) {
            myTicketsList.innerHTML = `
                <div class="text-center py-5 text-muted rounded-4 border border-dashed">
                    <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                    <h6 class="fw-bold mb-2">Sin tickets registrados</h6>
                    <p class="small mb-0">Cuando envies un reporte, aparecera aqui con su seguimiento.</p>
                </div>
            `;
            if (myTicketsFooter) myTicketsFooter.innerHTML = '';
            if (myTicketDetail) myTicketDetail.classList.add('d-none');
            if (myTicketDetailEmpty) myTicketDetailEmpty.classList.remove('d-none');
            return;
        }

        myTicketsList.innerHTML = supportState.myTickets.map(ticket => `
            <div class="support-ticket-user-card rounded-4 p-3 shadow-sm ${ticket.id === supportState.selectedTicketId ? 'is-active' : ''}" data-support-ticket-id="${escapeSupportHtml(ticket.id)}">
                <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
                    <span class="badge ${getStatusBadgeClass(ticket.status)} rounded-pill">
                        ${escapeSupportHtml(SUPPORT_STATUS_LABELS[ticket.status] || ticket.status || 'Pendiente')}
                    </span>
                    <span class="extra-small text-muted">${escapeSupportHtml(formatSupportRelative(ticket.lastActivityAt || ticket.updatedAt || ticket.createdAt))}</span>
                </div>
                <h6 class="fw-bold mb-1">${escapeSupportHtml(ticket.titulo || 'Ticket sin titulo')}</h6>
                <div class="small text-muted mb-2">
                    ${escapeSupportHtml(SUPPORT_CATEGORY_LABELS[ticket.categoria] || ticket.categoria || 'General')} • ${escapeSupportHtml(ticket.tipo || 'bug')}
                </div>
                <p class="small text-muted mb-2">${escapeSupportHtml((ticket.descripcion || '').slice(0, 120) || 'Sin descripcion')}</p>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="badge ${getPriorityBadgeClass(ticket.priority)} rounded-pill px-3">
                        ${escapeSupportHtml(SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority || 'Normal')}
                    </span>
                    <span class="extra-small text-muted">${escapeSupportHtml(formatSupportDate(ticket.updatedAt || ticket.createdAt))}</span>
                </div>
            </div>
        `).join('');

        myTicketsList.querySelectorAll('[data-support-ticket-id]').forEach(card => {
            card.addEventListener('click', () => {
                supportState.selectedTicketId = card.dataset.supportTicketId || '';
                renderMyTicketsList();
            });
        });

        if (myTicketsFooter) {
            myTicketsFooter.innerHTML = supportState.myTicketsHasMore
                ? '<button type="button" class="btn btn-outline-dark btn-sm rounded-pill" id="btn-support-load-more"><i class="bi bi-arrow-down-circle me-2"></i>Cargar mas</button>'
                : '<small class="text-muted">Fin del historial</small>';

            const loadMoreBtn = document.getElementById('btn-support-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', () => loadMyTickets(true));
            }
        }

        const selectedTicket = supportState.myTickets.find(ticket => ticket.id === supportState.selectedTicketId)
            || supportState.myTickets[0];

        if (selectedTicket) {
            supportState.selectedTicketId = selectedTicket.id;
            renderMyTicketDetail(selectedTicket);
        }
    }

    async function loadMyTickets(append = false) {
        if (!myTicketsList || supportState.myTicketsLoading) return;

        const ctx = getSupportCtx();
        if (!ctx.user) return;

        supportState.myTicketsLoading = true;
        if (!append) {
            supportState.myTicketsLastDoc = null;
            supportState.myTicketsHasMore = true;
            myTicketsList.innerHTML = '<div class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando...</div>';
            if (myTicketsFooter) myTicketsFooter.innerHTML = '';
        }

        try {
            const service = await ensureSuperAdminService();
            const batch = await service.getMyTickets(ctx, {
                limit: 12,
                lastDoc: append ? supportState.myTicketsLastDoc : null
            });

            supportState.myTickets = append ? supportState.myTickets.concat(batch) : batch;
            supportState.myTicketsHasMore = batch.length === 12;
            supportState.myTicketsLastDoc = batch.length ? batch[batch.length - 1]._doc : (append ? supportState.myTicketsLastDoc : null);

            if (!supportState.selectedTicketId && supportState.myTickets.length) {
                supportState.selectedTicketId = supportState.myTickets[0].id;
            }

            renderMyTicketsList();
        } catch (error) {
            console.error('[Support] Error loading my tickets:', error);
            myTicketsList.innerHTML = `<div class="alert alert-danger border-0 small mb-0">${escapeSupportHtml(error.message || 'No se pudieron cargar tus tickets.')}</div>`;
            if (myTicketsFooter) myTicketsFooter.innerHTML = '';
        } finally {
            supportState.myTicketsLoading = false;
        }
    }

    Store.on('user-changed', async (user) => {
        if (!user) return;

        let showLactario = false;
        const LactarioService = window.LactarioService;

        if (LactarioService) {
            const acc = await LactarioService.checkAccess(user.profile || user);
            showLactario = acc.allowed;
        } else {
            console.warn('[SIA Main] LactarioService not loaded yet.');
        }

        const btnLactario = document.getElementById('smart-card-lactario-wrapper');
        if (btnLactario) {
            if (showLactario) btnLactario.classList.remove('d-none');
            else btnLactario.classList.add('d-none');
        }

        const moduleMap = {
            'view-aula': '.smart-card[onclick*="view-aula"]',
            'view-comunidad': '.smart-card[onclick*="view-comunidad"]',
            'view-medi': '.smart-card[onclick*="view-medi"]',
            'view-biblio': '.smart-card[onclick*="view-biblio"]',
            'view-foro': '.smart-card[onclick*="view-foro"]',
            'view-quejas': '.smart-card[onclick*="view-quejas"]',
            'view-profile': '.smart-card[onclick*="view-profile"]'
        };

        const toggleModule = (key, show) => {
            const card = document.querySelector(moduleMap[key]);
            if (!card) return;
            const col = card.closest('.col-6');
            if (!col) return;
            if (show) col.classList.remove('d-none');
            else col.classList.add('d-none');
        };

        const profile = user?.profile || user?.userProfile || user || {};
        if (profile.allowedViews && Array.isArray(profile.allowedViews)) {
            Object.keys(moduleMap).forEach(key => toggleModule(key, false));
            profile.allowedViews.forEach(view => toggleModule(view, true));

            const elLact = document.getElementById('smart-card-lactario-wrapper');
            if (profile.allowedViews.includes('view-lactario') && elLact) elLact.classList.remove('d-none');
        } else {
            Object.keys(moduleMap).forEach(key => toggleModule(key, true));
        }

        if (reportBtn) {
            const role = profile.role || 'student';
            if (role === 'superadmin') reportBtn.classList.add('d-none');
            else reportBtn.classList.remove('d-none');
        }
    });

    if (reportForm) {
        reportForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const titulo = reportTitleInput?.value?.trim() || '';
            const descripcion = reportDescriptionInput?.value?.trim() || '';
            const pasos = document.getElementById('report-steps')?.value?.trim() || '';
            const esperado = document.getElementById('report-expected')?.value?.trim() || '';
            const actual = document.getElementById('report-actual')?.value?.trim() || '';

            if (titulo.length < 6) {
                if (typeof showToast === 'function') showToast('Agrega un resumen corto y claro del problema.', 'warning');
                return;
            }

            if (descripcion.length < 12) {
                if (typeof showToast === 'function') showToast('Describe un poco mas el problema para poder revisarlo.', 'warning');
                return;
            }

            const submitBtn = reportForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enviando...';
            }

            try {
                const service = await ensureSuperAdminService();
                const ctx = getSupportCtx();
                const context = supportState.currentContext || buildSupportContext();

                let evidenciaUrl = '';
                if (supportState.evidenceFile) {
                    if (submitBtn) submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Subiendo evidencia...';
                    evidenciaUrl = await service.uploadSupportEvidence(ctx, supportState.evidenceFile);
                }

                if (submitBtn) submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creando ticket...';

                const created = await service.createSupportTicket(ctx, {
                    titulo,
                    tipo: document.getElementById('report-tipo')?.value || 'bug',
                    categoria: reportCategoryInput?.value || context.category || 'general',
                    priority: reportPriorityInput?.value || 'normal',
                    descripcion,
                    pasos,
                    esperado,
                    actual,
                    evidenciaUrl,
                    context
                });

                supportState.selectedTicketId = created.id;
                resetSupportForm();
                setSupportTab('tickets');

                if (typeof showToast === 'function') {
                    showToast(`Reporte enviado. Folio #${created.id.slice(0, 8).toUpperCase()}`, 'success');
                }
            } catch (error) {
                console.error('[Support] Error sending report:', error);
                if (typeof showToast === 'function') {
                    showToast('Error al enviar reporte: ' + error.message, 'danger');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-send-fill me-1"></i>Enviar reporte';
                }
            }
        });
    }

    document.querySelectorAll('[data-support-tab]').forEach(button => {
        button.addEventListener('click', () => setSupportTab(button.dataset.supportTab || 'report'));
    });

    document.getElementById('btn-support-refresh')?.addEventListener('click', () => loadMyTickets(false));
    document.getElementById('btn-report-evidence')?.addEventListener('click', () => evidenceInput?.click());
    clearEvidenceBtn?.addEventListener('click', clearSupportEvidence);

    evidenceInput?.addEventListener('change', event => {
        const input = event.target;
        const file = input && input.files ? input.files[0] : null;
        if (!file) {
            clearSupportEvidence();
            return;
        }

        if (!file.type.startsWith('image/')) {
            if (typeof showToast === 'function') showToast('Solo se permiten imagenes.', 'warning');
            clearSupportEvidence();
            return;
        }

        supportState.evidenceFile = file;
        renderEvidencePreview(file);
    });

    reportModalEl?.addEventListener('show.bs.modal', () => {
        hydrateSupportContext();
        if (supportState.activeTab === 'tickets') {
            loadMyTickets(false);
        }
    });

    reportModalEl?.addEventListener('hidden.bs.modal', () => {
        setSupportTab('report');
        resetSupportForm();
    });

    hydrateSupportContext();
});

window.navigate = (view) => router.navigate(view);
