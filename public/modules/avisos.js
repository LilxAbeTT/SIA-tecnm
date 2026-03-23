if (!window.Avisos) {
    window.Avisos = (function () {
        let _ctx = null;
        let _root = null;
        let _eventsBound = false;
        let _loading = false;
        let _saving = false;

        const DEFAULT_FORM = () => ({
            title: '',
            type: 'mixed',
            priority: 'normal',
            audience: 'all',
            status: 'active',
            imageUrl: '',
            body: '',
            displayDuration: 8,
            startDate: '',
            endDate: ''
        });

        const state = {
            canManage: false,
            adminView: 'panel',
            studentFilter: 'all',
            adminFilters: {
                search: '',
                status: 'all',
                priority: 'all',
                type: 'all'
            },
            allAvisos: [],
            userViews: {},
            editingId: null,
            form: DEFAULT_FORM()
        };

        function esc(value) {
            if (window.escapeHtml) return window.escapeHtml(value);
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function canTrackStudentViews() {
            return !state.canManage || state.adminView !== 'student';
        }

        function getPreviewProfile() {
            if (state.canManage && state.adminView === 'student') {
                return { role: 'student' };
            }
            return _ctx?.profile || {};
        }

        function syncBreadcrumb() {
            if (!state.canManage) return;
            const sectionLabel = state.adminView === 'student' ? 'Vista Estudiante' : 'Panel';
            window.SIA?.setBreadcrumbSection?.('view-avisos', sectionLabel, { moduleClickable: false });
        }

        function toLocalInputValue(value) {
            const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
            if (!date || Number.isNaN(date.getTime())) return '';
            const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
            return localDate.toISOString().slice(0, 16);
        }

        function formatDate(value, withTime) {
            const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
            if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
            return date.toLocaleString('es-MX', withTime ? {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            } : {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }

        function formatAudience(audience) {
            return {
                all: 'Toda la comunidad',
                students: 'Solo estudiantes',
                staff: 'Solo personal',
                admins: 'Solo admins'
            }[audience || 'all'] || 'Toda la comunidad';
        }

        function getStatusMeta(status) {
            return {
                active: { label: 'Activo', cls: 'success' },
                scheduled: { label: 'Programado', cls: 'info' },
                paused: { label: 'Pausado', cls: 'warning text-dark' },
                expired: { label: 'Vencido', cls: 'secondary' },
                draft: { label: 'Borrador', cls: 'dark' },
                archived: { label: 'Archivado', cls: 'secondary' }
            }[status] || { label: status || 'Sin estado', cls: 'secondary' };
        }

        function getTypeLabel(type) {
            return {
                image: 'Imagen',
                text: 'Texto',
                mixed: 'Mixto'
            }[type] || 'Aviso';
        }

        function isRead(avisoId) {
            return !!state.userViews[avisoId] || window.AvisosService?.hasSeenLocal?.(_ctx, avisoId);
        }

        function buildTemporaryAviso(form) {
            return {
                id: state.editingId || `preview-${Date.now()}`,
                title: form.title,
                type: form.type,
                imageUrl: form.imageUrl,
                body: form.body,
                priority: form.priority,
                displayDuration: Number(form.displayDuration) || 8
            };
        }

        function getVisibleStudentAvisos() {
            const profile = getPreviewProfile();
            const base = state.allAvisos.filter((aviso) => {
                const active = window.AvisosService?.resolveStatus?.(aviso) === 'active';
                const allowed = window.AvisosService?.matchesAudience?.(aviso, profile);
                return active && allowed;
            });

            const sorted = base.sort((a, b) => {
                const unreadDelta = Number(isRead(a.id)) - Number(isRead(b.id));
                if (unreadDelta !== 0) return unreadDelta;
                if ((a.priority === 'urgent') !== (b.priority === 'urgent')) {
                    return a.priority === 'urgent' ? -1 : 1;
                }
                const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return bTime - aTime;
            });

            if (state.studentFilter === 'unread') return sorted.filter((aviso) => !isRead(aviso.id));
            if (state.studentFilter === 'read') return sorted.filter((aviso) => isRead(aviso.id));
            if (state.studentFilter === 'urgent') return sorted.filter((aviso) => aviso.priority === 'urgent');
            return sorted;
        }

        function getFilteredAdminAvisos() {
            return state.allAvisos.filter((aviso) => {
                const status = window.AvisosService?.resolveStatus?.(aviso) || aviso.status;
                const haystack = `${aviso.title || ''} ${aviso.body || ''}`.toLowerCase();
                const matchesSearch = !state.adminFilters.search || haystack.includes(state.adminFilters.search.toLowerCase());
                const matchesStatus = state.adminFilters.status === 'all' || status === state.adminFilters.status;
                const matchesPriority = state.adminFilters.priority === 'all' || (aviso.priority || 'normal') === state.adminFilters.priority;
                const matchesType = state.adminFilters.type === 'all' || (aviso.type || 'text') === state.adminFilters.type;
                return matchesSearch && matchesStatus && matchesPriority && matchesType;
            });
        }

        function getAdminStats() {
            const totalViews = state.allAvisos.reduce((sum, aviso) => sum + Number(aviso.analytics?.totalViews || aviso.viewCount || 0), 0);
            const uniqueViewers = state.allAvisos.reduce((sum, aviso) => sum + Number(aviso.analytics?.uniqueViewers || 0), 0);
            const completedViews = state.allAvisos.reduce((sum, aviso) => sum + Number(aviso.analytics?.completedViews || 0), 0);
            const active = state.allAvisos.filter((aviso) => window.AvisosService?.resolveStatus?.(aviso) === 'active').length;
            const scheduled = state.allAvisos.filter((aviso) => window.AvisosService?.resolveStatus?.(aviso) === 'scheduled').length;
            const expired = state.allAvisos.filter((aviso) => window.AvisosService?.resolveStatus?.(aviso) === 'expired').length;
            return { totalViews, uniqueViewers, completedViews, active, scheduled, expired };
        }

        function syncFormFromAviso(aviso) {
            state.editingId = aviso?.id || null;
            state.form = aviso ? {
                title: aviso.title || '',
                type: aviso.type || 'mixed',
                priority: aviso.priority || 'normal',
                audience: aviso.audience || 'all',
                status: aviso.status || 'active',
                imageUrl: aviso.imageUrl || '',
                body: aviso.body || '',
                displayDuration: aviso.displayDuration || 8,
                startDate: toLocalInputValue(aviso.startDate),
                endDate: toLocalInputValue(aviso.endDate)
            } : DEFAULT_FORM();
        }

        function updateFormField(field, value) {
            state.form = { ...state.form, [field]: value };
        }

        function renderOptions(currentValue, entries) {
            return entries.map(([value, label]) => `<option value="${value}" ${currentValue === value ? 'selected' : ''}>${label}</option>`).join('');
        }

        function openPreview(aviso, source, track) {
            if (!aviso) return;
            if (typeof window.showAvisoFullscreen === 'function') {
                window.showAvisoFullscreen([aviso], 0, {
                    source: source || 'center',
                    track: !!track,
                    ctx: _ctx
                });
            }
        }

        async function compressImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxWidth = 1400;
                        const scale = Math.min(1, maxWidth / img.width);
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        const ctx2d = canvas.getContext('2d');
                        ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/jpeg', 0.78));
                    };
                    img.onerror = reject;
                };
                reader.onerror = reject;
            });
        }

        function bindEvents() {
            if (_eventsBound || !_root) return;
            _eventsBound = true;

            _root.addEventListener('input', (event) => {
                const target = event.target;
                if (target.dataset.field) {
                    updateFormField(target.dataset.field, target.value);
                    if (target.dataset.field === 'type') render();
                }
            });

            _root.addEventListener('change', async (event) => {
                const target = event.target;

                if (target.dataset.adminFilter) {
                    state.adminFilters[target.dataset.adminFilter] = target.value;
                    render();
                    return;
                }

                if (target.matches('[data-student-filter]')) {
                    state.studentFilter = target.dataset.studentFilter;
                    render();
                    return;
                }

                if (target.id === 'avisos-image-file' && target.files?.[0]) {
                    try {
                        const encoded = await compressImage(target.files[0]);
                        updateFormField('imageUrl', encoded);
                        render();
                    } catch (error) {
                        console.error('[Avisos] Error processing image:', error);
                        window.showToast?.('No se pudo procesar la imagen', 'danger');
                    }
                }
            });

            _root.addEventListener('click', async (event) => {
                const studentFilterBtn = event.target.closest('[data-student-filter]');
                if (studentFilterBtn) {
                    state.studentFilter = studentFilterBtn.dataset.studentFilter;
                    render();
                    return;
                }

                const trigger = event.target.closest('[data-action]');
                if (!trigger) return;

                const action = trigger.dataset.action;
                const avisoId = trigger.dataset.id;

                if (action === 'set-admin-view') {
                    state.adminView = trigger.dataset.mode || 'panel';
                    syncBreadcrumb();
                    render();
                    return;
                }

                if (action === 'new-aviso') {
                    syncFormFromAviso(null);
                    render();
                    return;
                }

                if (action === 'edit-aviso') {
                    const aviso = state.allAvisos.find((item) => item.id === avisoId);
                    if (aviso) {
                        syncFormFromAviso(aviso);
                        render();
                    }
                    return;
                }

                if (action === 'open-student-aviso') {
                    const aviso = state.allAvisos.find((item) => item.id === avisoId);
                    if (aviso) {
                        openPreview(aviso, state.canManage && state.adminView === 'student' ? 'preview' : 'center', canTrackStudentViews());
                    }
                    return;
                }

                if (action === 'preview-aviso') {
                    const aviso = state.allAvisos.find((item) => item.id === avisoId);
                    if (aviso) openPreview(aviso, 'preview', false);
                    return;
                }

                if (action === 'preview-form') {
                    openPreview(buildTemporaryAviso(state.form), 'preview', false);
                    return;
                }

                if (action === 'toggle-aviso') {
                    await runAdminAction(async () => {
                        await window.AvisosService.toggleAviso(_ctx, avisoId);
                    }, 'Estado actualizado');
                    return;
                }

                if (action === 'duplicate-aviso') {
                    await runAdminAction(async () => {
                        const newId = await window.AvisosService.duplicateAviso(_ctx, avisoId);
                        const latest = await window.AvisosService.getAllAvisos(_ctx, { limit: 120 });
                        const cloned = latest.find((item) => item.id === newId);
                        if (cloned) syncFormFromAviso(cloned);
                    }, 'Aviso duplicado');
                    return;
                }

                if (action === 'archive-aviso') {
                    await runAdminAction(async () => {
                        await window.AvisosService.archiveAviso(_ctx, avisoId);
                    }, 'Aviso archivado');
                    return;
                }

                if (action === 'delete-aviso') {
                    if (!window.confirm('Se eliminara este aviso. Deseas continuar?')) return;
                    await runAdminAction(async () => {
                        await window.AvisosService.deleteAviso(_ctx, avisoId);
                        if (state.editingId === avisoId) syncFormFromAviso(null);
                    }, 'Aviso eliminado');
                    return;
                }

                if (action === 'save-form') {
                    await saveForm();
                }
            });
        }

        async function runAdminAction(fn, successMessage) {
            if (_saving) return;

            try {
                _saving = true;
                render();
                await fn();
                await refresh();
                window.showToast?.(successMessage, 'success');
            } catch (error) {
                console.error('[Avisos] Admin action error:', error);
                window.showToast?.(error.message || 'No se pudo completar la accion', 'danger');
            } finally {
                _saving = false;
                render();
            }
        }

        async function saveForm() {
            const form = { ...state.form };

            if (!form.title.trim()) {
                window.showToast?.('Ingresa un titulo para el aviso', 'warning');
                return;
            }
            if (form.type === 'image' && !form.imageUrl.trim()) {
                window.showToast?.('Agrega una imagen para el aviso', 'warning');
                return;
            }
            if (form.type === 'text' && !form.body.trim()) {
                window.showToast?.('Agrega el contenido del aviso', 'warning');
                return;
            }
            if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
                window.showToast?.('La fecha final debe ser posterior al inicio', 'warning');
                return;
            }

            await runAdminAction(async () => {
                const payload = {
                    title: form.title.trim(),
                    type: form.type,
                    priority: form.priority,
                    audience: form.audience,
                    status: form.status,
                    imageUrl: form.imageUrl.trim(),
                    body: form.body.trim(),
                    displayDuration: Number(form.displayDuration) || 8,
                    startDate: form.startDate || null,
                    endDate: form.endDate || null
                };

                if (state.editingId) {
                    await window.AvisosService.updateAviso(_ctx, state.editingId, payload);
                } else {
                    await window.AvisosService.createAviso(_ctx, payload);
                }

                syncFormFromAviso(null);
            }, state.editingId ? 'Aviso actualizado' : 'Aviso creado');
        }

        function renderStudentCards(previewMode) {
            const avisos = getVisibleStudentAvisos();
            if (!avisos.length) {
                return `
                    <div class="avs-empty card border-0 shadow-sm rounded-4 p-5 text-center">
                        <i class="bi bi-megaphone fs-1 opacity-25 mb-3"></i>
                        <h4 class="fw-bold mb-2">Sin avisos activos</h4>
                        <p class="text-muted mb-0">Cuando Difusion publique un aviso institucional aparecera aqui.</p>
                    </div>
                `;
            }

            return `
                <div class="row g-3">
                    ${avisos.map((aviso) => {
                        const read = isRead(aviso.id);
                        const status = getStatusMeta(window.AvisosService?.resolveStatus?.(aviso));
                        const viewData = state.userViews[aviso.id] || {};
                        return `
                            <div class="col-12 col-xl-6">
                                <article class="avs-card card border-0 shadow-sm rounded-4 h-100 overflow-hidden ${read ? 'avs-card--read' : 'avs-card--new'}">
                                    <div class="row g-0 h-100">
                                        <div class="col-md-4 ${aviso.imageUrl ? '' : 'd-flex align-items-center justify-content-center avs-thumb--empty'}">
                                            ${aviso.imageUrl
                                                ? `<img src="${esc(aviso.imageUrl)}" alt="${esc(aviso.title)}" class="avs-thumb-img">`
                                                : `<i class="bi bi-megaphone-fill fs-1 text-success opacity-50"></i>`}
                                        </div>
                                        <div class="col-md-8">
                                            <div class="card-body p-4 d-flex flex-column h-100">
                                                <div class="d-flex flex-wrap gap-2 mb-3">
                                                    <span class="badge rounded-pill text-bg-${status.cls}">${status.label}</span>
                                                    <span class="badge rounded-pill ${aviso.priority === 'urgent' ? 'text-bg-danger' : 'text-bg-light border'}">${aviso.priority === 'urgent' ? 'Urgente' : 'Normal'}</span>
                                                    <span class="badge rounded-pill text-bg-light border">${getTypeLabel(aviso.type)}</span>
                                                    <span class="badge rounded-pill ${read ? 'text-bg-secondary' : 'text-bg-primary'}">${read ? 'Leido' : 'Nuevo'}</span>
                                                </div>
                                                <h3 class="h5 fw-bold mb-2">${esc(aviso.title)}</h3>
                                                <p class="text-muted mb-3 avs-card-copy">${esc(aviso.body || 'Aviso institucional disponible para consulta.')}</p>
                                                <div class="mt-auto d-flex flex-wrap justify-content-between align-items-end gap-2">
                                                    <div class="small text-muted">
                                                        <div><i class="bi bi-calendar3 me-1"></i>${formatDate(aviso.createdAt)}</div>
                                                        <div><i class="bi bi-eye me-1"></i>${Number(aviso.analytics?.totalViews || aviso.viewCount || 0)} aperturas</div>
                                                        ${viewData.lastSeenAt ? `<div><i class="bi bi-check2-circle me-1"></i>Ultima vez: ${formatDate(viewData.lastSeenAt, true)}</div>` : ''}
                                                    </div>
                                                    <button class="btn btn-primary rounded-pill px-4 fw-semibold" data-action="open-student-aviso" data-id="${aviso.id}">
                                                        ${previewMode ? 'Previsualizar' : 'Abrir aviso'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function renderStudentSection(previewMode) {
            const avisos = getVisibleStudentAvisos();
            const unreadCount = avisos.filter((aviso) => !isRead(aviso.id)).length;
            const urgentCount = avisos.filter((aviso) => aviso.priority === 'urgent').length;

            return `
                <section class="avs-surface card border-0 shadow-sm rounded-5 overflow-hidden">
                    <div class="avs-hero p-4 p-lg-5">
                        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
                            <div>
                                <span class="avs-eyebrow">Centro de Avisos</span>
                                <h1 class="display-6 fw-bold mb-2 filter-white">Lee lo importante sin perder tiempo</h1>
                                <p class="mb-0 text-white-50">${previewMode ? 'Vista previa para revisar exactamente lo que recibe un estudiante.' : 'Todos los avisos institucionales activos en un solo lugar.'}</p>
                            </div>
                            <div class="d-flex gap-2 flex-wrap">
                                <div class="avs-kpi">
                                    <span class="avs-kpi__label">Activos</span>
                                    <strong>${avisos.length}</strong>
                                </div>
                                <div class="avs-kpi">
                                    <span class="avs-kpi__label">Nuevos</span>
                                    <strong>${unreadCount}</strong>
                                </div>
                                <div class="avs-kpi">
                                    <span class="avs-kpi__label">Urgentes</span>
                                    <strong>${urgentCount}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card-body p-4 p-lg-5">
                        <div class="d-flex flex-wrap gap-2 mb-4">
                            <button class="btn rounded-pill ${state.studentFilter === 'all' ? 'btn-primary' : 'btn-light border'}" data-student-filter="all">Todos</button>
                            <button class="btn rounded-pill ${state.studentFilter === 'unread' ? 'btn-primary' : 'btn-light border'}" data-student-filter="unread">Nuevos</button>
                            <button class="btn rounded-pill ${state.studentFilter === 'urgent' ? 'btn-primary' : 'btn-light border'}" data-student-filter="urgent">Urgentes</button>
                            <button class="btn rounded-pill ${state.studentFilter === 'read' ? 'btn-primary' : 'btn-light border'}" data-student-filter="read">Leidos</button>
                        </div>
                        ${renderStudentCards(previewMode)}
                    </div>
                </section>
            `;
        }

        function renderAdminPanel() {
            const stats = getAdminStats();
            const avisos = getFilteredAdminAvisos();
            const showImageFields = state.form.type !== 'text';
            const showBodyField = state.form.type !== 'image';

            return `
                <section class="avs-surface card border-0 shadow-sm rounded-5 overflow-hidden">
                    <div class="avs-hero p-4 p-lg-5">
                        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
                            <div>
                                <span class="avs-eyebrow">Gestion</span>
                                <h1 class="display-6 fw-bold mb-2 filter-white">Publica, programa y mide avisos</h1>
                                <p class="mb-0 text-white-50">La gestion se hace en pagina completa para mantener filtros, estados y vista previa sin modales.</p>
                            </div>
                            <div class="btn-group avs-mode-toggle">
                                <button class="btn btn-light fw-semibold ${state.adminView === 'panel' ? 'active' : ''}" data-action="set-admin-view" data-mode="panel">Panel</button>
                                <button class="btn btn-light fw-semibold ${state.adminView === 'student' ? 'active' : ''}" data-action="set-admin-view" data-mode="student">Como estudiante</button>
                            </div>
                        </div>
                    </div>

                    <div class="card-body p-4 p-lg-5">
                        <div class="row g-3 mb-4">
                            <div class="col-6 col-xl-3"><div class="avs-stat-card"><span>Activos</span><strong>${stats.active}</strong></div></div>
                            <div class="col-6 col-xl-3"><div class="avs-stat-card"><span>Programados</span><strong>${stats.scheduled}</strong></div></div>
                            <div class="col-6 col-xl-3"><div class="avs-stat-card"><span>Lecturas</span><strong>${stats.totalViews}</strong></div></div>
                            <div class="col-6 col-xl-3"><div class="avs-stat-card"><span>Usuarios unicos</span><strong>${stats.uniqueViewers}</strong></div></div>
                        </div>

                        <div class="row g-4">
                            <div class="col-12 col-xl-5">
                                <div class="avs-panel card border rounded-4 h-100">
                                    <div class="card-body p-4">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h3 class="h5 fw-bold mb-1">Biblioteca de avisos</h3>
                                                <p class="text-muted small mb-0">${avisos.length} resultado(s)</p>
                                            </div>
                                            <button class="btn btn-outline-primary rounded-pill" data-action="new-aviso">Nuevo</button>
                                        </div>

                                        <div class="row g-2 mb-3">
                                            <div class="col-12">
                                                <input type="search" class="form-control rounded-4" placeholder="Buscar por titulo o contenido" data-admin-filter="search" value="${esc(state.adminFilters.search)}">
                                            </div>
                                            <div class="col-md-4">
                                                <select class="form-select rounded-4" data-admin-filter="status">
                                                    ${renderOptions(state.adminFilters.status, [['all', 'Todos'], ['active', 'Activos'], ['scheduled', 'Programados'], ['paused', 'Pausados'], ['expired', 'Vencidos'], ['draft', 'Borradores'], ['archived', 'Archivados']])}
                                                </select>
                                            </div>
                                            <div class="col-md-4">
                                                <select class="form-select rounded-4" data-admin-filter="priority">
                                                    ${renderOptions(state.adminFilters.priority, [['all', 'Prioridad'], ['normal', 'Normal'], ['urgent', 'Urgente']])}
                                                </select>
                                            </div>
                                            <div class="col-md-4">
                                                <select class="form-select rounded-4" data-admin-filter="type">
                                                    ${renderOptions(state.adminFilters.type, [['all', 'Tipo'], ['mixed', 'Mixto'], ['text', 'Texto'], ['image', 'Imagen']])}
                                                </select>
                                            </div>
                                        </div>

                                        <div class="avs-list">
                                            ${avisos.length ? avisos.map((aviso) => {
                                                const status = getStatusMeta(window.AvisosService?.resolveStatus?.(aviso));
                                                const isEditing = state.editingId === aviso.id;
                                                return `
                                                    <article class="avs-admin-item ${isEditing ? 'is-active' : ''}">
                                                        <div class="d-flex gap-3 align-items-start">
                                                            <div class="avs-admin-thumb">
                                                                ${aviso.imageUrl ? `<img src="${esc(aviso.imageUrl)}" alt="${esc(aviso.title)}">` : '<i class="bi bi-megaphone-fill"></i>'}
                                                            </div>
                                                            <div class="flex-grow-1">
                                                                <div class="d-flex flex-wrap gap-2 mb-2">
                                                                    <span class="badge rounded-pill text-bg-${status.cls}">${status.label}</span>
                                                                    <span class="badge rounded-pill ${aviso.priority === 'urgent' ? 'text-bg-danger' : 'text-bg-light border'}">${aviso.priority === 'urgent' ? 'Urgente' : 'Normal'}</span>
                                                                    <span class="badge rounded-pill text-bg-light border">${formatAudience(aviso.audience)}</span>
                                                                </div>
                                                                <h4 class="h6 fw-bold mb-1">${esc(aviso.title)}</h4>
                                                                <p class="text-muted small mb-2 avs-line-clamp">${esc(aviso.body || 'Aviso sin texto adicional.')}</p>
                                                                <div class="small text-muted d-flex flex-wrap gap-3 mb-3">
                                                                    <span><i class="bi bi-calendar3 me-1"></i>${formatDate(aviso.createdAt)}</span>
                                                                    <span><i class="bi bi-eye me-1"></i>${Number(aviso.analytics?.totalViews || aviso.viewCount || 0)} lecturas</span>
                                                                    <span><i class="bi bi-people me-1"></i>${Number(aviso.analytics?.uniqueViewers || 0)} unicos</span>
                                                                </div>
                                                                <div class="d-flex flex-wrap gap-2">
                                                                    <button class="btn btn-sm btn-primary rounded-pill" data-action="edit-aviso" data-id="${aviso.id}">Editar</button>
                                                                    <button class="btn btn-sm btn-outline-secondary rounded-pill" data-action="preview-aviso" data-id="${aviso.id}">Preview</button>
                                                                    <button class="btn btn-sm btn-outline-${aviso.status === 'active' ? 'warning' : 'success'} rounded-pill" data-action="toggle-aviso" data-id="${aviso.id}">${aviso.status === 'active' ? 'Pausar' : 'Activar'}</button>
                                                                    <button class="btn btn-sm btn-outline-info rounded-pill" data-action="duplicate-aviso" data-id="${aviso.id}">Duplicar</button>
                                                                    <button class="btn btn-sm btn-outline-dark rounded-pill" data-action="archive-aviso" data-id="${aviso.id}">Archivar</button>
                                                                    <button class="btn btn-sm btn-outline-danger rounded-pill" data-action="delete-aviso" data-id="${aviso.id}">Eliminar</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </article>
                                                `;
                                            }).join('') : `
                                                <div class="text-center py-5 text-muted">
                                                    <i class="bi bi-megaphone fs-1 opacity-25 d-block mb-3"></i>
                                                    <p class="mb-0">No hay avisos con esos filtros.</p>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-12 col-xl-7">
                                <div class="avs-panel card border rounded-4 h-100">
                                    <div class="card-body p-4">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h3 class="h5 fw-bold mb-1">${state.editingId ? 'Editar aviso' : 'Nuevo aviso'}</h3>
                                                <p class="text-muted small mb-0">Configura contenido, vigencia y experiencia de lectura.</p>
                                            </div>
                                            ${state.editingId ? '<span class="badge text-bg-primary rounded-pill">Modo edicion</span>' : ''}
                                        </div>

                                        <div class="row g-3">
                                            <div class="col-md-4">
                                                <label class="form-label small fw-semibold">Tipo</label>
                                                <select class="form-select rounded-4" data-field="type">
                                                    ${renderOptions(state.form.type, [['mixed', 'Imagen + texto'], ['text', 'Solo texto'], ['image', 'Solo imagen']])}
                                                </select>
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small fw-semibold">Prioridad</label>
                                                <select class="form-select rounded-4" data-field="priority">
                                                    ${renderOptions(state.form.priority, [['normal', 'Normal'], ['urgent', 'Urgente']])}
                                                </select>
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small fw-semibold">Estado</label>
                                                <select class="form-select rounded-4" data-field="status">
                                                    ${renderOptions(state.form.status, [['active', 'Activo'], ['paused', 'Pausado'], ['draft', 'Borrador'], ['archived', 'Archivado']])}
                                                </select>
                                            </div>

                                            <div class="col-md-7">
                                                <label class="form-label small fw-semibold">Titulo</label>
                                                <input type="text" class="form-control rounded-4" data-field="title" value="${esc(state.form.title)}" placeholder="Ej. Convocatoria 2026">
                                            </div>
                                            <div class="col-md-5">
                                                <label class="form-label small fw-semibold">Audiencia</label>
                                                <select class="form-select rounded-4" data-field="audience">
                                                    ${renderOptions(state.form.audience, [['all', 'Toda la comunidad'], ['students', 'Solo estudiantes'], ['staff', 'Solo personal'], ['admins', 'Solo admins']])}
                                                </select>
                                            </div>

                                            ${showImageFields ? `
                                                <div class="col-12">
                                                    <label class="form-label small fw-semibold">Imagen</label>
                                                    <div class="row g-2">
                                                        <div class="col-md-8">
                                                            <input type="url" class="form-control rounded-4" data-field="imageUrl" value="${esc(state.form.imageUrl)}" placeholder="https://... o base64">
                                                        </div>
                                                        <div class="col-md-4">
                                                            <input type="file" class="form-control rounded-4" id="avisos-image-file" accept="image/*">
                                                        </div>
                                                    </div>
                                                    <div class="form-text">Puedes pegar una URL o subir una imagen para convertirla automaticamente.</div>
                                                    ${state.form.imageUrl ? `<div class="avs-image-preview mt-3"><img src="${esc(state.form.imageUrl)}" alt="Preview"></div>` : ''}
                                                </div>
                                            ` : ''}

                                            ${showBodyField ? `
                                                <div class="col-12">
                                                    <label class="form-label small fw-semibold">Contenido</label>
                                                    <textarea class="form-control rounded-4" rows="5" data-field="body" placeholder="Escribe el mensaje del aviso...">${esc(state.form.body)}</textarea>
                                                </div>
                                            ` : ''}

                                            <div class="col-md-4">
                                                <label class="form-label small fw-semibold">Duracion (seg)</label>
                                                <input type="number" min="3" max="60" class="form-control rounded-4" data-field="displayDuration" value="${esc(state.form.displayDuration)}">
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small fw-semibold">Inicio</label>
                                                <input type="datetime-local" class="form-control rounded-4" data-field="startDate" value="${esc(state.form.startDate)}">
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small fw-semibold">Fin</label>
                                                <input type="datetime-local" class="form-control rounded-4" data-field="endDate" value="${esc(state.form.endDate)}">
                                            </div>

                                            <div class="col-12 d-flex flex-wrap gap-2 pt-2">
                                                <button class="btn btn-primary rounded-pill px-4" data-action="save-form" ${_saving ? 'disabled' : ''}>
                                                    ${_saving ? '<span class="spinner-border spinner-border-sm me-2"></span>Guardando' : '<i class="bi bi-check2-circle me-2"></i>Guardar aviso'}
                                                </button>
                                                <button class="btn btn-outline-secondary rounded-pill px-4" data-action="preview-form">Preview</button>
                                                <button class="btn btn-outline-dark rounded-pill px-4" data-action="new-aviso">Limpiar</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }

        function render() {
            if (!_root) return;

            if (_loading) {
                _root.innerHTML = `
                    <div class="avs-loading card border-0 shadow-sm rounded-5 p-5 text-center">
                        <div class="spinner-border text-primary mb-3"></div>
                        <h3 class="h5 fw-bold mb-2">Cargando avisos</h3>
                        <p class="text-muted mb-0">Preparando el centro de avisos y la gestion administrativa.</p>
                    </div>
                `;
                return;
            }

            _root.innerHTML = `
                <div class="container-fluid px-0">
                    ${state.canManage && state.adminView === 'panel'
                        ? renderAdminPanel()
                        : renderStudentSection(state.canManage && state.adminView === 'student')}
                </div>
            `;
        }

        async function refresh() {
            if (!window.AvisosService) return;
            _loading = true;
            render();

            try {
                const [avisos, userViews] = await Promise.all([
                    state.canManage
                        ? window.AvisosService.getAllAvisos(_ctx, { limit: 120 })
                        : window.AvisosService.getActiveAvisos(_ctx, { limit: 80 }),
                    window.AvisosService.getUserViewsMap(_ctx, 120)
                ]);

                state.allAvisos = avisos || [];
                state.userViews = userViews || {};

                if (state.editingId) {
                    const updated = state.allAvisos.find((aviso) => aviso.id === state.editingId);
                    if (updated) syncFormFromAviso(updated);
                }
            } catch (error) {
                console.error('[Avisos] Refresh error:', error);
                window.showToast?.('No se pudieron cargar los avisos', 'danger');
            } finally {
                _loading = false;
                render();
            }
        }

        async function init(ctx) {
            _ctx = ctx;
            _root = document.getElementById('view-avisos');
            if (!_root) return;

            state.canManage = !!window.AvisosService?.canManage?.(ctx);
            syncBreadcrumb();
            bindEvents();
            await refresh();
        }

        return {
            init,
            refresh
        };
    })();
}
