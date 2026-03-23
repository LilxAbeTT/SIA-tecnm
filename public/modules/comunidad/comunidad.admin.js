// public/modules/comunidad/comunidad.admin.js
// Admin controller for Comunidad moderation workspace

if (!window.ComunidadModule) window.ComunidadModule = {};

if (!window.ComunidadModule.Admin) {
    window.ComunidadModule.Admin = (function () {
        function create() {
            const shared = window.ComunidadModule?.Shared;
            const service = window.ComunidadService;
            if (!shared || !service) throw new Error('[AdminComunidad] Dependencias no disponibles.');

            const state = {
                ctx: null,
                activeTab: 'reportes',
                reports: [],
                posts: [],
                userStates: [],
                reportsUnsub: null,
                postsUnsub: null,
                statesUnsub: null
            };
            const TAB_LABELS = Object.freeze({
                reportes: 'Moderacion: Reportes',
                contenido: 'Moderacion: Contenido',
                usuarios: 'Moderacion: Usuarios'
            });

            return {
                init,
                cleanup,
                switchTab,
                setReportStatus,
                togglePostHidden,
                togglePostComments,
                togglePostPinned,
                setUserStatus,
                openPost
            };

            async function init(ctx) {
                cleanup(false);
                state.ctx = ctx;
                state.activeTab = 'reportes';

                if (!window.Comunidad?.init) throw new Error('[AdminComunidad] Módulo base no disponible.');
                await window.Comunidad.init(ctx);

                ensureAdminHost();
                renderAdminPanel();
                syncBreadcrumb(state.activeTab);
                bindStreams();

                if (ctx?.ModuleManager?.addSubscription) ctx.ModuleManager.addSubscription(cleanup);
            }

            function cleanup(includeBaseCleanup = true) {
                if (state.reportsUnsub) { try { state.reportsUnsub(); } catch (_) { } }
                if (state.postsUnsub) { try { state.postsUnsub(); } catch (_) { } }
                if (state.statesUnsub) { try { state.statesUnsub(); } catch (_) { } }
                state.reportsUnsub = null;
                state.postsUnsub = null;
                state.statesUnsub = null;
                state.reports = [];
                state.posts = [];
                state.userStates = [];

                document.getElementById('comunidad-admin-panel')?.remove();

                if (includeBaseCleanup && window.Comunidad?.cleanup) window.Comunidad.cleanup();
            }

            function bindStreams() {
                state.reportsUnsub = service.streamAdminReports(state.ctx, { limit: 50 }, (reports) => {
                    state.reports = reports;
                    renderAdminPanel();
                }, () => shared.showToast('No fue posible cargar los reportes de Comunidad.', 'warning'));

                state.postsUnsub = service.streamAdminPosts(state.ctx, { limit: 60 }, (posts) => {
                    state.posts = posts;
                    renderAdminPanel();
                }, () => shared.showToast('No fue posible cargar el contenido moderable.', 'warning'));

                state.statesUnsub = service.streamAdminUserStates(state.ctx, { limit: 40 }, (userStates) => {
                    state.userStates = userStates;
                    renderAdminPanel();
                }, () => shared.showToast('No fue posible cargar los estados de usuarios.', 'warning'));
            }

            function ensureAdminHost() {
                const root = document.getElementById('view-comunidad');
                const shell = root?.querySelector('.comunidad-shell');
                const toolbar = root?.querySelector('.comunidad-toolbar');
                if (!root || !shell) return null;

                let host = document.getElementById('comunidad-admin-panel');
                if (!host) {
                    host = document.createElement('section');
                    host.id = 'comunidad-admin-panel';
                    host.className = 'comunidad-panel comunidad-panel--admin comunidad-admin-panel';
                    if (toolbar) toolbar.insertAdjacentElement('beforebegin', host);
                    else shell.prepend(host);
                }
                return host;
            }

            function switchTab(tab) {
                state.activeTab = ['reportes', 'contenido', 'usuarios'].includes(tab) ? tab : 'reportes';
                syncBreadcrumb(state.activeTab);
                renderAdminPanel();
            }

            function syncBreadcrumb(tab = state.activeTab) {
                const label = TAB_LABELS[tab] || TAB_LABELS.reportes;
                window.SIA?.setBreadcrumbSection?.('view-comunidad', label, { moduleClickable: false });
            }

            function renderAdminPanel() {
                const host = ensureAdminHost();
                if (!host) return;

                const openReports = state.reports.filter((item) => ['open', 'in_review'].includes(item.status || 'open')).length;
                const hiddenPosts = state.posts.filter((item) => item.hiddenByAdmin).length;
                const blockedUsers = state.userStates.filter((item) => item.status === 'blocked').length;
                const mutedUsers = state.userStates.filter((item) => item.status === 'muted').length;

                host.innerHTML = `
                    <div class="comunidad-admin-head">
                        <div>
                            <span class="comunidad-panel-kicker"><i class="bi bi-shield-check"></i>Moderación</span>
                            <h3 class="comunidad-section-title mb-1">Centro de control de Comunidad</h3>
                            <p class="comunidad-section-text mb-0">Administra reportes, visibilidad de publicaciones y estados de usuarios sin salir del módulo.</p>
                        </div>
                        <div class="comunidad-admin-stats">
                            <div class="comunidad-admin-stat"><span>Reportes abiertos</span><strong>${openReports}</strong></div>
                            <div class="comunidad-admin-stat"><span>Ocultas</span><strong>${hiddenPosts}</strong></div>
                            <div class="comunidad-admin-stat"><span>Silenciados</span><strong>${mutedUsers}</strong></div>
                            <div class="comunidad-admin-stat"><span>Bloqueados</span><strong>${blockedUsers}</strong></div>
                        </div>
                    </div>

                    <div class="comunidad-admin-tabs">
                        ${renderTabButton('reportes', 'Reportes', 'bi-flag-fill')}
                        ${renderTabButton('contenido', 'Contenido', 'bi-layout-text-window-reverse')}
                        ${renderTabButton('usuarios', 'Usuarios', 'bi-person-lock')}
                    </div>

                    <div class="comunidad-admin-body">
                        ${renderActiveTab()}
                    </div>
                `;
            }

            function renderTabButton(key, label, icon) {
                return `<button type="button" class="comunidad-admin-tab ${state.activeTab === key ? 'is-active' : ''}" onclick="AdminComunidad.switchTab('${key}')"><i class="bi ${icon}"></i>${label}</button>`;
            }

            function renderActiveTab() {
                if (state.activeTab === 'contenido') return renderContentTab();
                if (state.activeTab === 'usuarios') return renderUsersTab();
                return renderReportsTab();
            }

            function renderReportsTab() {
                if (!state.reports.length) {
                    return renderEmptyState('No hay reportes todavía', 'Cuando alguien reporte contenido dentro de Comunidad, aparecerá aquí para revisión.');
                }
                return `<div class="comunidad-admin-list">${state.reports.map(renderReportCard).join('')}</div>`;
            }

            function renderContentTab() {
                const posts = [...state.posts]
                    .sort((a, b) => getPostReportCount(b.id) - getPostReportCount(a.id) || compareDates(b.updatedAt, a.updatedAt))
                    .slice(0, 24);
                if (!posts.length) {
                    return renderEmptyState('No hay publicaciones moderables', 'Aquí verás publicaciones recientes con acciones administrativas.');
                }
                return `<div class="comunidad-admin-list">${posts.map(renderPostCard).join('')}</div>`;
            }

            function renderUsersTab() {
                if (!state.userStates.length) {
                    return renderEmptyState('No hay usuarios moderados', 'Los estados de Comunidad aparecerán aquí cuando se silencie o bloquee a alguien.');
                }
                return `<div class="comunidad-admin-list">${state.userStates.map(renderUserStateCard).join('')}</div>`;
            }

            function renderReportCard(report) {
                const post = report.targetType === 'post' ? getPost(report.targetId) : null;
                const userState = post?.authorId ? getUserState(post.authorId) : null;
                const reportStatus = report.status || 'open';
                const detail = report.details ? shared.escapeHtml(report.details) : 'Sin detalle adicional.';
                const reason = shared.escapeHtml(report.reason || 'otro');
                const reportCount = post ? getPostReportCount(post.id) : 0;
                const targetLabel = post ? `${shared.escapeHtml(post.authorName || 'Usuario')} · ${shared.escapeHtml(shared.getTypeCfg(post.type).label)}` : `Objetivo: ${shared.escapeHtml(report.targetType || 'post')} ${shared.escapeHtml(report.targetId || '')}`;
                const reportDate = shared.formatDate(report.createdAt || report.updatedAt);
                const moderationButtons = post ? renderPostModerationButtons(post) : '';
                const userButtons = post?.authorId ? renderUserButtons(post.authorId, userState?.status || 'active') : '';

                return `
                    <article class="comunidad-admin-card">
                        <div class="comunidad-admin-card-head">
                            <div>
                                <div class="comunidad-admin-title-row">
                                    <strong class="comunidad-admin-card-title">${targetLabel}</strong>
                                    <span class="comunidad-status-badge is-${reportStatus}">${formatReportStatus(reportStatus)}</span>
                                </div>
                                <div class="comunidad-admin-meta">
                                    <span><i class="bi bi-flag-fill"></i>${reason}</span>
                                    <span><i class="bi bi-clock-history"></i>${shared.escapeHtml(reportDate)}</span>
                                    <span><i class="bi bi-person"></i>${shared.escapeHtml(report.reportedBy || 'usuario')}</span>
                                </div>
                            </div>
                            <div class="comunidad-admin-actions">
                                <button type="button" class="comunidad-action-btn" onclick="AdminComunidad.setReportStatus('${report.id}', '${reportStatus === 'resolved' ? 'open' : 'resolved'}')"><i class="bi ${reportStatus === 'resolved' ? 'bi-arrow-counterclockwise' : 'bi-check2-circle'}"></i><span>${reportStatus === 'resolved' ? 'Reabrir' : 'Resolver'}</span></button>
                                <button type="button" class="comunidad-action-btn" onclick="AdminComunidad.setReportStatus('${report.id}', 'dismissed')"><i class="bi bi-x-circle"></i><span>Descartar</span></button>
                            </div>
                        </div>
                        <p class="comunidad-admin-card-text">${detail}</p>
                        ${post ? `<div class="comunidad-admin-meta"><span><i class="bi bi-heart-fill"></i>${post.reactionCount || 0} reacciones</span><span><i class="bi bi-chat-left-dots-fill"></i>${post.commentCount || 0} comentarios</span><span><i class="bi bi-megaphone-fill"></i>${reportCount} reportes</span></div>` : ''}
                        <div class="comunidad-admin-actions">
                            ${post ? `<button type="button" class="comunidad-action-btn" onclick="AdminComunidad.openPost('${post.id}')"><i class="bi bi-box-arrow-up-right"></i><span>Ver publicación</span></button>` : ''}
                            ${moderationButtons}
                            ${userButtons}
                        </div>
                    </article>
                `;
            }

            function renderPostCard(post) {
                const typeCfg = shared.getTypeCfg(post.type);
                const userState = getUserState(post.authorId);
                const reportCount = getPostReportCount(post.id);
                return `
                    <article class="comunidad-admin-card">
                        <div class="comunidad-admin-card-head">
                            <div>
                                <div class="comunidad-admin-title-row">
                                    <strong class="comunidad-admin-card-title">${shared.escapeHtml(post.title || post.authorName || 'Publicación sin título')}</strong>
                                    <span class="comunidad-type-badge comunidad-type-badge--${typeCfg.accent}"><i class="bi ${typeCfg.icon}"></i>${shared.escapeHtml(typeCfg.label)}</span>
                                </div>
                                <div class="comunidad-admin-meta">
                                    <span><i class="bi bi-person-circle"></i>${shared.escapeHtml(post.authorName || 'Usuario')}</span>
                                    <span><i class="bi bi-clock-history"></i>${shared.escapeHtml(shared.formatDate(post.updatedAt || post.createdAt))}</span>
                                    <span><i class="bi bi-eye-slash"></i>${post.hiddenByAdmin ? 'Oculta' : 'Visible'}</span>
                                    <span><i class="bi bi-megaphone-fill"></i>${reportCount} reportes</span>
                                </div>
                            </div>
                            <span class="comunidad-status-badge is-${post.hiddenByAdmin ? 'hidden' : 'active'}">${post.hiddenByAdmin ? 'Oculta' : 'Activa'}</span>
                        </div>
                        <p class="comunidad-admin-card-text">${shared.escapeHtml(buildPostPreview(post))}</p>
                        <div class="comunidad-admin-actions">
                            <button type="button" class="comunidad-action-btn" onclick="AdminComunidad.openPost('${post.id}')"><i class="bi bi-box-arrow-up-right"></i><span>Abrir</span></button>
                            ${renderPostModerationButtons(post)}
                            ${post.authorId ? renderUserButtons(post.authorId, userState?.status || 'active') : ''}
                        </div>
                    </article>
                `;
            }

            function renderUserStateCard(userState) {
                const post = state.posts.find((item) => item.authorId === userState.uid);
                const label = post?.authorName || userState.uid || 'Usuario';
                const meta = post?.authorCareer || post?.authorArea || userState.reason || 'Sin metadatos recientes';
                return `
                    <article class="comunidad-admin-card">
                        <div class="comunidad-admin-card-head">
                            <div>
                                <div class="comunidad-admin-title-row">
                                    <strong class="comunidad-admin-card-title">${shared.escapeHtml(label)}</strong>
                                    <span class="comunidad-status-badge is-${userState.status || 'active'}">${formatUserStatus(userState.status || 'active')}</span>
                                </div>
                                <div class="comunidad-admin-meta">
                                    <span><i class="bi bi-hash"></i>${shared.escapeHtml(userState.uid || '')}</span>
                                    <span><i class="bi bi-clock-history"></i>${shared.escapeHtml(shared.formatDate(userState.updatedAt || userState.createdAt))}</span>
                                </div>
                            </div>
                        </div>
                        <p class="comunidad-admin-card-text">${shared.escapeHtml(meta)}</p>
                        <div class="comunidad-admin-actions">
                            ${renderUserButtons(userState.uid, userState.status || 'active')}
                        </div>
                    </article>
                `;
            }

            function renderPostModerationButtons(post) {
                return [
                    `<button type="button" class="comunidad-action-btn" onclick="AdminComunidad.togglePostHidden('${post.id}')"><i class="bi ${post.hiddenByAdmin ? 'bi-eye' : 'bi-eye-slash'}"></i><span>${post.hiddenByAdmin ? 'Restaurar' : 'Ocultar'}</span></button>`,
                    `<button type="button" class="comunidad-action-btn" onclick="AdminComunidad.togglePostComments('${post.id}')"><i class="bi ${post.commentsEnabled === false ? 'bi-chat-left-dots-fill' : 'bi-chat-left-dots'}"></i><span>${post.commentsEnabled === false ? 'Abrir comentarios' : 'Cerrar comentarios'}</span></button>`,
                    `<button type="button" class="comunidad-action-btn" onclick="AdminComunidad.togglePostPinned('${post.id}')"><i class="bi ${post.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}"></i><span>${post.pinned ? 'Desfijar' : 'Fijar'}</span></button>`
                ].join('');
            }

            function renderUserButtons(uid, status) {
                return [
                    `<button type="button" class="comunidad-action-btn" onclick="AdminComunidad.setUserStatus('${uid}', 'active')"><i class="bi bi-person-check"></i><span>Activar</span></button>`,
                    `<button type="button" class="comunidad-action-btn ${status === 'muted' ? 'is-active' : ''}" onclick="AdminComunidad.setUserStatus('${uid}', 'muted')"><i class="bi bi-volume-mute"></i><span>Silenciar</span></button>`,
                    `<button type="button" class="comunidad-action-btn ${status === 'blocked' ? 'is-active' : ''}" onclick="AdminComunidad.setUserStatus('${uid}', 'blocked')"><i class="bi bi-slash-circle"></i><span>Bloquear</span></button>`
                ].join('');
            }

            function renderEmptyState(title, text) {
                return `<div class="comunidad-empty"><i class="bi bi-shield-check display-6 mb-3"></i><h4 class="fw-bold mb-2">${shared.escapeHtml(title)}</h4><p class="text-muted mb-0">${shared.escapeHtml(text)}</p></div>`;
            }

            function getPost(postId) {
                return state.posts.find((item) => item.id === postId) || null;
            }

            function getPostReportCount(postId) {
                if (!postId) return 0;
                return state.reports.filter((item) => item.targetType === 'post' && item.targetId === postId).length;
            }

            function getUserState(uid) {
                return state.userStates.find((item) => item.uid === uid) || null;
            }

            function compareDates(left, right) {
                const leftTime = shared.toDate(left)?.getTime?.() || 0;
                const rightTime = shared.toDate(right)?.getTime?.() || 0;
                return leftTime - rightTime;
            }

            function buildPostPreview(post) {
                const text = String(post?.text || (Array.isArray(post?.bullets) ? post.bullets.join(' · ') : '') || '').trim();
                if (!text) return 'Sin texto adicional.';
                return text.length > 170 ? `${text.slice(0, 169).trim()}…` : text;
            }

            function formatReportStatus(status) {
                return {
                    open: 'Abierto',
                    in_review: 'En revisión',
                    resolved: 'Resuelto',
                    dismissed: 'Descartado'
                }[status] || 'Abierto';
            }

            function formatUserStatus(status) {
                return {
                    active: 'Activo',
                    muted: 'Silenciado',
                    blocked: 'Bloqueado'
                }[status] || 'Activo';
            }

            async function setReportStatus(reportId, status) {
                const note = status === 'dismissed'
                    ? (window.prompt('Motivo o nota de descarte (opcional)') || '')
                    : '';
                try {
                    await service.updateReportStatus(state.ctx, reportId, { status, note });
                    shared.showToast('Reporte actualizado.', 'success');
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar el reporte.', 'danger');
                }
            }

            async function togglePostHidden(postId) {
                const post = getPost(postId);
                if (!post) return;
                const nextHidden = !post.hiddenByAdmin;
                const hiddenReason = nextHidden ? (window.prompt('Motivo breve para ocultar la publicación', post.hiddenReason || 'Contenido retirado por moderación.') || 'Contenido retirado por moderación.') : '';
                try {
                    await service.moderatePost(state.ctx, postId, { hiddenByAdmin: nextHidden, hiddenReason });
                    shared.showToast(nextHidden ? 'Publicación oculta.' : 'Publicación restaurada.', 'success');
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar la visibilidad.', 'danger');
                }
            }

            async function togglePostComments(postId) {
                const post = getPost(postId);
                if (!post) return;
                try {
                    await service.moderatePost(state.ctx, postId, { commentsEnabled: post.commentsEnabled === false });
                    shared.showToast(post.commentsEnabled === false ? 'Comentarios abiertos.' : 'Comentarios cerrados.', 'success');
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar comentarios.', 'danger');
                }
            }

            async function togglePostPinned(postId) {
                const post = getPost(postId);
                if (!post) return;
                try {
                    await service.moderatePost(state.ctx, postId, { pinned: !post.pinned });
                    shared.showToast(post.pinned ? 'Publicación desfijada.' : 'Publicación fijada.', 'success');
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar el pin.', 'danger');
                }
            }

            async function setUserStatus(uid, status) {
                const current = getUserState(uid)?.status || 'active';
                if (current === status) return;
                const reason = status === 'active' ? '' : (window.prompt(`Motivo para ${status === 'muted' ? 'silenciar' : 'bloquear'} al usuario`, '') || '');
                try {
                    await service.setUserState(state.ctx, uid, { status, reason });
                    shared.showToast('Estado de usuario actualizado.', 'success');
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible actualizar al usuario.', 'danger');
                }
            }

            function openPost(postId) {
                if (!postId) return;
                if (window.Comunidad?.focusPost) window.Comunidad.focusPost(postId, true);
            }
        }

        return { create };
    })();
}
