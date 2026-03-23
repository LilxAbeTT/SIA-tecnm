// public/modules/comunidad/comunidad.student.js
// Student controller for Comunidad

if (!window.ComunidadModule) window.ComunidadModule = {};

if (!window.ComunidadModule.Student) {
    window.ComunidadModule.Student = (function () {
        function create() {
            const shared = window.ComunidadModule?.Shared;
            const service = window.ComunidadService;
            const chatService = window.ComunidadChatService;
            if (!shared || !service || !chatService) throw new Error('[Comunidad] Dependencias no disponibles.');

            const state = {
                ctx: null,
                profile: null,
                posts: [],
                loading: true,
                feedUnsub: null,
                commentsUnsubs: {},
                commentsByPost: {},
                commentDraftByPost: {},
                replyTargetByPost: {},
                activeTab: 'novedades',
                activeType: 'all',
                activeScope: 'all',
                hasCareerScope: false,
                composerMode: 'plain',
                editingPostId: null,
                myReactions: {},
                highlightPostId: null,
                pendingFocusPostId: null,
                pendingOpenComments: false,
                composerModal: null,
                postModal: null,
                activePostId: null,
                conversations: [],
                conversationsLoading: true,
                conversationsUnsub: null,
                pendingConversationId: null,
                messageUnsub: null,
                activeConversationId: null,
                activeConversationPeer: null,
                activeMessages: [],
                unreadConversationCount: 0,
                chatModal: null,
                reportModal: null,
                mediaModal: null,
                reportDraft: null,
                mediaViewer: null
            };
            const TAB_LABELS = Object.freeze({
                novedades: 'Novedades',
                tendencias: 'Tendencias',
                explorar: 'Explorar',
                mensajes: 'Mensajes'
            });

            const REPORT_REASONS = [
                { value: 'spam', label: 'Spam' },
                { value: 'acoso', label: 'Acoso' },
                { value: 'fraude', label: 'Fraude' },
                { value: 'inapropiado', label: 'Inapropiado' },
                { value: 'otro', label: 'Otro' }
            ];

            return {
                init, switchTab, setTypeFilter, setScopeFilter, focusPost, exploreType, jumpToFeed,
                openComposerModal, closeComposerModal, setComposerType, setComposerMode, submitPost,
                startEditPost, cancelEditPost, deletePost, toggleComments,
                setReplyTarget, clearReplyTarget, submitComment, toggleReaction,
                reportPost, closeReportDialog, selectReportReason, submitReport, sharePost, openMessages, openConversation, openConversationWithPostAuthor, sendMessage,
                openMediaViewer, closeMediaViewer, zoomMediaViewer, stepMediaViewer, focusCommentComposer,
                replayTutorial, cleanup
            };

            async function init(ctx) {
                cleanup();
                state.ctx = ctx;
                state.profile = ctx?.profile || null;
                state.posts = [];
                state.commentsByPost = {};
                state.commentDraftByPost = {};
                state.replyTargetByPost = {};
                state.activeTab = readRequestedTab();
                state.activeType = 'all';
                state.activeScope = 'all';
                state.hasCareerScope = !!shared.getCareerLabel(state.profile);
                state.composerMode = 'plain';
                state.editingPostId = null;
                state.loading = true;
                state.myReactions = {};
                state.highlightPostId = readRequestedPostId();
                state.pendingFocusPostId = state.highlightPostId;
                state.pendingOpenComments = !!state.highlightPostId;
                state.composerModal = null;
                state.postModal = null;
                state.activePostId = null;
                state.conversations = [];
                state.conversationsLoading = true;
                state.conversationsUnsub = null;
                state.pendingConversationId = readRequestedConversationId();
                state.messageUnsub = null;
                state.activeConversationId = null;
                state.activeConversationPeer = null;
                state.activeMessages = [];
                state.unreadConversationCount = 0;
                state.chatModal = null;
                state.reportModal = null;
                state.mediaModal = null;
                state.reportDraft = null;
                state.mediaViewer = null;

                const root = document.getElementById('view-comunidad');
                if (!root || !state.profile) return;
                syncGlobalBugFab(false);
                root.innerHTML = renderLayout();
                setupComposerModal();
                setupPostModal();
                setupChatModal();
                setupReportModal();
                setupMediaModal();
                renderCurrentTab();
                syncBreadcrumb(state.activeTab);
                if (ctx?.ModuleManager?.addSubscription) ctx.ModuleManager.addSubscription(cleanup);

                state.feedUnsub = service.streamFeed(state.ctx, { limit: 40 }, async (posts) => {
                    state.posts = posts;
                    state.loading = false;
                    state.myReactions = await service.loadUserPostReactions(state.ctx, posts.map((item) => item.id)).catch(() => state.myReactions);
                    renderCurrentTab();
                    maybeFocusRequestedPost();
                }, () => {
                    state.loading = false;
                    renderCurrentTab();
                    shared.showToast('No fue posible cargar Comunidad.', 'warning');
                });

                state.conversationsUnsub = chatService.streamConversations(state.ctx, { limit: 40 }, (conversations) => {
                    state.conversations = conversations;
                    state.conversationsLoading = false;
                    state.unreadConversationCount = conversations.reduce((acc, item) => acc + getUnreadCount(item), 0);
                    syncActiveConversation();
                    renderCurrentTab();
                    renderActiveConversationModal();
                    maybeOpenRequestedConversation();
                }, () => {
                    state.conversationsLoading = false;
                    renderCurrentTab();
                    shared.showToast('No fue posible cargar tus mensajes de Comunidad.', 'warning');
                });

                maybeLaunchTutorial();
            }

            function cleanup() {
                if (state.feedUnsub) { try { state.feedUnsub(); } catch (_) { } }
                state.feedUnsub = null;
                if (state.conversationsUnsub) { try { state.conversationsUnsub(); } catch (_) { } }
                state.conversationsUnsub = null;
                stopMessageStream();
                Object.values(state.commentsUnsubs).forEach((fn) => { try { fn(); } catch (_) { } });
                state.commentsUnsubs = {};
                state.commentDraftByPost = {};
                state.composerModal = null;
                state.postModal = null;
                state.chatModal = null;
                state.reportModal = null;
                state.mediaModal = null;
                state.activePostId = null;
                state.reportDraft = null;
                state.mediaViewer = null;
                syncModalScrollLock();
                syncGlobalBugFab(shared.normalizeText(state.profile?.role) !== 'superadmin');
            }

            function syncGlobalBugFab(shouldShow) {
                const bugFab = document.getElementById('btn-report-problem');
                if (!bugFab) return;
                bugFab.classList.toggle('d-none', !shouldShow);
            }

            function renderLayout() {
                const identityCfg = shared.determineIdentity(state.profile);
                const careerLabel = shared.getCareerLabel(state.profile);
                const areaLabel = shared.getAreaLabel(state.profile);
                return `
                    <section class="comunidad-shell fade-up-entry">
                        <section class="comunidad-hero mb-3">
                            <div>
                                <span class="comunidad-kicker"><i class="bi bi-people-fill"></i>Comunidad del campus</span>
                                <h2 class="comunidad-title">Explora lo que está pasando en tu campus</h2>
                                <p class="comunidad-text">Novedades, preguntas, avisos, ventas y objetos perdidos en una vista más clara. Publicar ahora vive en un modal, no en la entrada del módulo.</p>
                                <div class="comunidad-hero-meta">
                                    <span class="comunidad-hero-pill ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span>
                                    ${careerLabel ? `<span class="comunidad-hero-pill"><i class="bi bi-mortarboard-fill"></i>${shared.escapeHtml(careerLabel)}</span>` : ''}
                                    ${!careerLabel && areaLabel ? `<span class="comunidad-hero-pill"><i class="bi bi-buildings-fill"></i>${shared.escapeHtml(areaLabel)}</span>` : ''}
                                </div>
                                <div class="comunidad-hero-actions">
                                    <button type="button" class="btn comunidad-btn comunidad-btn--primary" id="comunidad-quick-publish" onclick="Comunidad.openComposerModal()"><i class="bi bi-plus-circle-fill me-2"></i>Nueva publicación</button>
                                    <button type="button" class="btn comunidad-btn comunidad-btn--secondary" onclick="Comunidad.switchTab('tendencias'); Comunidad.jumpToFeed();"><i class="bi bi-fire me-2"></i>Ver tendencias</button>
                                    <button type="button" class="btn comunidad-btn comunidad-btn--ghost" onclick="Comunidad.switchTab('explorar'); Comunidad.jumpToFeed();"><i class="bi bi-compass-fill me-2"></i>Explorar tipos</button>
                                </div>
                            </div>
                        </section>

                        <section class="comunidad-panel comunidad-panel--toolbar comunidad-toolbar">
                            <div class="comunidad-tabbar comunidad-chip-scroll" id="comunidad-tabbar">${renderTabButtons()}</div>
                            <div class="comunidad-filter-strip" id="comunidad-type-strip">
                                <span class="comunidad-filter-label">Tipos</span>
                                <div id="comunidad-type-chips" class="comunidad-chip-scroll">${renderTypeFilters()}</div>
                            </div>
                            <div class="comunidad-filter-strip" id="comunidad-scope-strip">
                                <span class="comunidad-filter-label">Alcance</span>
                                <div class="comunidad-chip-scroll">
                                    <div id="comunidad-scope-chips" class="comunidad-chip-cluster">${renderScopeFilters()}</div>
                                    <button class="btn comunidad-btn comunidad-btn--toolbar" type="button" id="comunidad-btn-tutorial" onclick="Comunidad.replayTutorial()"><i class="bi bi-signpost-split me-1"></i>Recorrido</button>
                                </div>
                            </div>
                        </section>

                        <div id="comunidad-tab-content"></div>
                    </section>
                    ${renderComposerModal()}
                    ${renderPostModal()}
                    ${renderChatModal()}
                    ${renderReportModal()}
                    ${renderMediaModal()}
                    <div class="comunidad-fab-stack">
                        <button type="button" class="comunidad-fab comunidad-fab--soft" onclick="Comunidad.switchTab('explorar'); Comunidad.jumpToFeed();"><i class="bi bi-compass-fill"></i><span>Tipos</span></button>
                        <button type="button" class="comunidad-fab comunidad-fab--soft" onclick="Comunidad.switchTab('tendencias'); Comunidad.jumpToFeed();"><i class="bi bi-fire"></i><span>Tendencias</span></button>
                        <button type="button" class="comunidad-fab comunidad-fab--primary" id="comunidad-fab-publish" onclick="Comunidad.openComposerModal()"><i class="bi bi-plus-lg"></i><span>Publicar</span></button>
                    </div>
                `;
            }

            function renderPostModal() {
                return `
                    <div class="modal fade" id="modalComunidadPost" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable comunidad-post-view-dialog">
                            <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden comunidad-post-view-modal">
                                <div class="modal-header border-0 comunidad-post-view-header">
                                    <div>
                                        <div class="comunidad-compose-kicker">Publicación completa</div>
                                        <h5 class="fw-bold mb-1 filter-white">Vista detallada</h5>
                                    </div>
                                    <button class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                </div>
                                <div class="modal-body comunidad-post-view-body" id="comunidad-post-modal-body"></div>
                                <div class="modal-footer border-0 comunidad-post-view-footer" id="comunidad-post-modal-footer"></div>
                            </div>
                        </div>
                    </div>
                `;
            }

            function renderReportModal() {
                return `
                    <div class="modal fade" id="modalComunidadReport" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered comunidad-mini-dialog">
                            <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden comunidad-mini-modal">
                                <div class="modal-header border-0 comunidad-mini-header">
                                    <div>
                                        <div class="comunidad-compose-kicker">Reporte rápido</div>
                                        <h5 class="fw-bold mb-1 filter-white">Ayúdanos a revisar esta publicación</h5>
                                    </div>
                                    <button class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                </div>
                                <div class="modal-body" id="comunidad-report-modal-body"></div>
                            </div>
                        </div>
                    </div>
                `;
            }

            function renderMediaModal() {
                return `
                    <div class="modal fade" id="modalComunidadMedia" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered comunidad-media-dialog comunidad-media-dialog--plain">
                            <div class="modal-content border-0 shadow-none overflow-hidden comunidad-media-modal comunidad-media-modal--plain">
                                <button class="btn-close btn-close-white comunidad-media-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                <div class="modal-body comunidad-media-body comunidad-media-body--plain" id="comunidad-media-modal-body"></div>
                            </div>
                        </div>
                    </div>
                `;
            }

            function renderTabButtons() {
                const tabs = [
                    { key: 'novedades', label: 'Novedades', icon: 'bi-stars', badge: 0 },
                    { key: 'tendencias', label: 'Tendencias', icon: 'bi-fire', badge: 0 },
                    { key: 'explorar', label: 'Explorar', icon: 'bi-compass-fill', badge: 0 },
                    { key: 'mensajes', label: 'Mensajes', icon: 'bi-chat-dots-fill', badge: state.unreadConversationCount }
                ];
                return tabs.map((tab) => `<button type="button" class="comunidad-tab-btn ${state.activeTab === tab.key ? 'is-active' : ''}" onclick="Comunidad.switchTab('${tab.key}')"><i class="bi ${tab.icon}"></i>${tab.label}${tab.badge ? `<span class="comunidad-tab-btn-badge">${tab.badge > 99 ? '99+' : tab.badge}</span>` : ''}</button>`).join('');
            }

            function renderChatModal() {
                return `
                    <div class="modal fade" id="modalComunidadChat" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable comunidad-chat-dialog">
                            <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden comunidad-chat-modal">
                                <div class="modal-header border-0 comunidad-chat-header">
                                    <div class="d-flex align-items-center gap-3 min-w-0">
                                        <div class="comunidad-chat-header-avatar" id="comunidad-chat-header-avatar">C</div>
                                        <div class="min-w-0">
                                            <div class="comunidad-compose-kicker" id="comunidad-chat-header-kicker">Mensajeria privada</div>
                                            <h5 class="fw-bold mb-1 text-white text-truncate" id="comunidad-chat-header-title">Selecciona una conversacion</h5>
                                            <div class="comunidad-chat-header-meta" id="comunidad-chat-header-meta">Abre un hilo desde una publicacion o desde tu bandeja.</div>
                                        </div>
                                    </div>
                                    <button class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                </div>
                                <div class="modal-body comunidad-chat-body" id="comunidad-chat-modal-body"></div>
                                <div class="modal-footer border-0 comunidad-chat-footer">
                                    <div class="input-group comunidad-chat-compose">
                                        <textarea class="form-control comunidad-chat-input" id="comunidad-chat-input" rows="1" maxlength="1600" placeholder="Escribe un mensaje privado..." onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); Comunidad.sendMessage(); }"></textarea>
                                        <button type="button" class="btn btn-primary rounded-pill px-4 fw-semibold" id="comunidad-chat-send-btn" onclick="Comunidad.sendMessage()"><i class="bi bi-send-fill me-1"></i>Enviar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            function renderComposerModal() {
                return `
                    <div class="modal fade" id="modalComunidadComposer" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable comunidad-compose-dialog">
                            <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden comunidad-compose-modal comunidad-compose-modal--general" id="comunidad-compose-modal">
                                <div class="modal-header border-0 comunidad-compose-header">
                                    <div>
                                        <div class="comunidad-compose-kicker" id="comunidad-composer-title">Publicación general</div>
                                        <h5 class="fw-bold mb-1">Publicar en Comunidad</h5>
                                        <p class="mb-0 comunidad-compose-description" id="comunidad-compose-description">Elige el tipo de publicación para adaptar el formulario.</p>
                                    </div>
                                    <button class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                </div>
                                <div class="modal-body comunidad-compose-body">
                                    <input type="hidden" id="comunidad-post-type" value="general">
                                    <div class="comunidad-compose-type-grid" id="comunidad-compose-type-grid"></div>
                                    <div class="comunidad-compose-tip" id="comunidad-compose-tip"></div>
                                    <div class="mb-3"><label class="form-label small fw-semibold">Alcance</label><select class="form-select" id="comunidad-post-scope"><option value="global">Global</option>${state.hasCareerScope ? '<option value="career">Mi carrera</option>' : ''}</select></div>
                                    <div class="mb-3"><label class="form-label small fw-semibold" id="comunidad-post-title-label">Título opcional</label><input type="text" class="form-control" id="comunidad-post-title" maxlength="120" placeholder="¿Qué quieres compartir?"></div>
                                    <div class="d-flex flex-wrap gap-2 mb-3" id="comunidad-compose-mode-wrap"><button type="button" class="comunidad-mode-btn is-active" id="comunidad-mode-plain" onclick="Comunidad.setComposerMode('plain')">Texto</button><button type="button" class="comunidad-mode-btn" id="comunidad-mode-bullets" onclick="Comunidad.setComposerMode('bullets')">Viñetas</button></div>
                                    <div class="mb-3" id="comunidad-text-wrap"><label class="form-label small fw-semibold" id="comunidad-post-text-label">Contenido</label><textarea class="form-control" id="comunidad-post-text" rows="4" maxlength="2400" placeholder="Comparte una idea o actualización con la comunidad."></textarea></div>
                                    <div class="mb-3 d-none" id="comunidad-bullets-wrap"><label class="form-label small fw-semibold" id="comunidad-post-bullets-label">Viñetas rápidas</label><div class="d-grid gap-2"><input type="text" class="form-control comunidad-bullet-input" placeholder="Idea principal" maxlength="160"><input type="text" class="form-control comunidad-bullet-input" placeholder="Detalle importante" maxlength="160"><input type="text" class="form-control comunidad-bullet-input" placeholder="Dato extra" maxlength="160"></div></div>
                                    <div class="mb-3"><label class="form-label small fw-semibold">Imágenes</label><input type="file" class="form-control" id="comunidad-post-media" accept="image/*" multiple><div class="form-text" id="comunidad-media-help">Hasta 3 imágenes por publicación.</div></div>
                                    <div class="alert alert-light border rounded-4 py-2 px-3 small d-none" id="comunidad-edit-alert">Estás editando una publicación existente. Las imágenes actuales se conservarán.</div>
                                </div>
                                <div class="modal-footer border-0 comunidad-compose-footer">
                                    <button type="button" class="btn btn-light rounded-pill fw-semibold" onclick="Comunidad.cancelEditPost()">Cancelar</button>
                                    <button type="button" class="btn btn-primary rounded-pill fw-semibold px-4" id="comunidad-submit-btn" onclick="Comunidad.submitPost()"><i class="bi bi-send-fill me-1"></i>Publicar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            function renderTypeFilters() { return [btnType('all', 'Todo', 'bi-grid-3x3-gap-fill')].concat(Object.entries(shared.TYPE_CONFIG).map(([key, cfg]) => btnType(key, cfg.label, cfg.icon))).join(''); }
            function renderScopeFilters() {
                return [
                    btnScope('all', 'Todos los alcances', 'bi-funnel-fill'),
                    btnScope('global', 'Global', 'bi-globe-americas'),
                    state.hasCareerScope ? btnScope('career', 'Mi carrera', 'bi-mortarboard-fill') : ''
                ].join('');
            }
            function btnType(value, label, icon) { return `<button type="button" class="comunidad-chip ${state.activeType === value ? 'is-active' : ''}" onclick="Comunidad.setTypeFilter('${value}')"><i class="bi ${icon}"></i>${shared.escapeHtml(label)}</button>`; }
            function btnScope(value, label, icon) { return `<button type="button" class="comunidad-chip ${state.activeScope === value ? 'is-active' : ''}" onclick="Comunidad.setScopeFilter('${value}')"><i class="bi ${icon}"></i>${shared.escapeHtml(label)}</button>`; }

            function applyComposerModeUi() {
                const isBullets = state.composerMode === 'bullets';
                document.getElementById('comunidad-mode-plain')?.classList.toggle('is-active', !isBullets);
                document.getElementById('comunidad-mode-bullets')?.classList.toggle('is-active', isBullets);
                document.getElementById('comunidad-text-wrap')?.classList.toggle('d-none', isBullets);
                document.getElementById('comunidad-bullets-wrap')?.classList.toggle('d-none', !isBullets);
            }

            function setComposerMode(mode) { state.composerMode = mode === 'bullets' ? 'bullets' : 'plain'; applyComposerModeUi(); }
            function switchTab(tab) { state.activeTab = ['novedades', 'tendencias', 'explorar', 'mensajes'].includes(tab) ? tab : 'novedades'; syncBreadcrumb(state.activeTab); renderCurrentTab(); }
            function openMessages() { state.activeTab = 'mensajes'; syncBreadcrumb(state.activeTab); renderCurrentTab(); }
            function setTypeFilter(value) { state.activeType = value || 'all'; renderCurrentTab(); }
            function setScopeFilter(value) { state.activeScope = value || 'all'; renderCurrentTab(); }
            function jumpToFeed() { document.getElementById('comunidad-feed-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            function exploreType(type) { state.activeTab = 'explorar'; state.activeType = type; syncBreadcrumb(state.activeTab); renderCurrentTab(); jumpToFeed(); }

            function syncBreadcrumb(tab = state.activeTab) {
                if (window.SIA?.canAdminComunidad?.(state.profile)) return;
                const label = TAB_LABELS[tab] || TAB_LABELS.novedades;
                window.SIA?.setBreadcrumbSection?.('view-comunidad', label, { moduleClickable: false });
            }

            function renderCurrentTab() {
                const host = document.getElementById('comunidad-tab-content');
                if (!host) return;

                document.getElementById('comunidad-tabbar').innerHTML = renderTabButtons();
                document.getElementById('comunidad-type-chips').innerHTML = renderTypeFilters();
                document.getElementById('comunidad-scope-chips').innerHTML = renderScopeFilters();
                document.getElementById('comunidad-type-strip')?.classList.toggle('d-none', state.activeTab === 'mensajes');
                document.getElementById('comunidad-scope-strip')?.classList.toggle('d-none', state.activeTab === 'mensajes');

                const posts = getFilteredPosts();

                if (state.activeTab === 'mensajes') {
                    host.innerHTML = `
                        <section class="comunidad-panel comunidad-panel--messages comunidad-section">
                            ${renderSectionHead('Mensajeria privada', 'Tu bandeja de Comunidad', messageDescription(), messageMeta())}
                            <div class="comunidad-chat-shell">
                                <div class="comunidad-chat-list">${renderConversationList()}</div>
                                <aside class="comunidad-chat-aside">
                                    <div class="comunidad-chat-stat">
                                        <span class="comunidad-panel-kicker">Conversaciones activas</span>
                                        <strong>${state.conversations.length}</strong>
                                        <p>${state.unreadConversationCount ? `${state.unreadConversationCount} mensaje${state.unreadConversationCount === 1 ? '' : 's'} sin leer.` : 'Tu bandeja esta al dia.'}</p>
                                    </div>
                                    <div class="comunidad-chat-callout">
                                        <h4>Como iniciar</h4>
                                        <p>Abre una publicacion, toca "Mensaje privado" y el hilo aparecera aqui sin saturar el feed.</p>
                                        <button type="button" class="btn btn-light rounded-pill fw-semibold" onclick="Comunidad.switchTab('novedades')"><i class="bi bi-arrow-left-circle me-1"></i>Volver al feed</button>
                                    </div>
                                </aside>
                            </div>
                        </section>
                    `;
                    renderActiveConversationModal();
                    return;
                }

                if (state.loading) {
                    host.innerHTML = `<section class="comunidad-panel comunidad-panel--feed comunidad-section"><div class="comunidad-spotlight-grid">${Array.from({ length: 3 }, () => '<div class="comunidad-card comunidad-card-skeleton"></div>').join('')}</div></section>`;
                    renderActivePostModal();
                    renderActiveConversationModal();
                    return;
                }

                if (state.activeTab === 'tendencias') {
                    const trendPosts = sortPosts(posts, 'trending');
                    const lead = trendPosts[0];
                    const rest = trendPosts.slice(1, 3);
                    host.innerHTML = `
                        <section class="comunidad-panel comunidad-panel--trend comunidad-section">
                            ${renderSectionHead('Pulso del campus', 'Lo que más se mueve ahora', 'Las publicaciones se ordenan por interacción reciente, comentarios y reacciones.', 'Ordenado por tendencia')}
                            <div class="comunidad-trend-grid">
                                ${lead ? renderTrendLead(lead) : renderEmptyState('Todavía no hay tendencias claras', 'Cuando empiece la interacción, aquí se verá lo más activo del campus.')}
                                <div class="comunidad-spotlight-grid">${rest.length ? rest.map((post, index) => renderSpotlightCard(post, index + 2, 'Subiendo')).join('') : '<div class="text-muted small">Aún no hay más publicaciones destacadas.</div>'}</div>
                            </div>
                        </section>
                        <section class="comunidad-panel comunidad-panel--feed comunidad-section" id="comunidad-feed-panel">
                            ${renderSectionHead('Ranking social', 'Feed en tendencia', feedDescription(), visibleCount(trendPosts.length))}
                            <div id="comunidad-feed" class="d-grid gap-3"></div>
                        </section>
                    `;
                    renderFeed(trendPosts);
                    renderActivePostModal();
                    renderActiveConversationModal();
                    return;
                }

                if (state.activeTab === 'explorar') {
                    host.innerHTML = `
                        <section class="comunidad-panel comunidad-panel--explore comunidad-section">
                            ${renderSectionHead('Explorar por tipo', 'Ubica el contenido por intención', 'Cada tipo cambia de color y lenguaje para que se entienda rápido qué se publicó.', 'Filtra o publica desde aquí')}
                            <div class="comunidad-type-grid">${Object.entries(shared.TYPE_CONFIG).map(([type, cfg]) => renderTypeTile(type, cfg)).join('')}</div>
                        </section>
                        <section class="comunidad-panel comunidad-panel--feed comunidad-section" id="comunidad-feed-panel">
                            ${renderSectionHead('Exploración activa', state.activeType === 'all' ? 'Todo el contenido visible' : `Explorando: ${shared.getTypeCfg(state.activeType).label}`, feedDescription(), visibleCount(posts.length))}
                            <div id="comunidad-feed" class="d-grid gap-3"></div>
                        </section>
                    `;
                    renderFeed(sortPosts(posts, 'latest'));
                    renderActivePostModal();
                    renderActiveConversationModal();
                    return;
                }

                const latestPosts = sortPosts(posts, 'latest');
                host.innerHTML = `
                    <section class="comunidad-panel comunidad-panel--spotlight comunidad-section">
                        ${renderSectionHead('Novedades', 'Lo más reciente de la comunidad', 'Primero ves lo nuevo del campus y luego decides si quieres participar.', 'Ordenado por fecha de publicación')}
                        <div class="comunidad-spotlight-grid">${latestPosts.length ? latestPosts.slice(0, 3).map((post, index) => renderSpotlightCard(post, index + 1, 'Nuevo')).join('') : renderEmptyState('Aún no hay publicaciones', 'Cuando alguien comparta algo, aparecerá aquí.')}</div>
                    </section>
                    <section class="comunidad-panel comunidad-panel--feed comunidad-section" id="comunidad-feed-panel">
                        ${renderSectionHead('Feed principal', 'Últimas publicaciones', feedDescription(), visibleCount(latestPosts.length))}
                        <div id="comunidad-feed" class="d-grid gap-3"></div>
                    </section>
                `;
                renderFeed(latestPosts);
                renderActivePostModal();
                renderActiveConversationModal();
            }

            function renderSectionHead(kicker, title, text, meta) {
                return `<div class="comunidad-section-head"><div><span class="comunidad-panel-kicker">${shared.escapeHtml(kicker)}</span><h3 class="comunidad-section-title">${shared.escapeHtml(title)}</h3><p class="comunidad-section-text">${shared.escapeHtml(text)}</p></div><span class="comunidad-section-meta">${shared.escapeHtml(meta)}</span></div>`;
            }

            function renderSpotlightCard(post, rank, badge) {
                const typeCfg = shared.getTypeCfg(post.type);
                const identityCfg = shared.getIdentityCfg(post.authorRoleKind);
                return `<article class="comunidad-spotlight-card comunidad-spotlight-card--${typeCfg.accent}"><div class="comunidad-spotlight-top"><span class="comunidad-spotlight-rank">0${rank}</span><span class="comunidad-type-badge comunidad-type-badge--${typeCfg.accent}"><i class="bi ${typeCfg.icon}"></i>${shared.escapeHtml(typeCfg.label)}</span></div><div class="comunidad-spotlight-badge">${shared.escapeHtml(badge)}</div><h4 class="comunidad-spotlight-title">${shared.escapeHtml(post.title || excerpt(post, 72))}</h4><p class="comunidad-spotlight-text">${shared.escapeHtml(excerpt(post, 140))}</p><div class="comunidad-spotlight-meta"><span><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span><span><i class="bi bi-clock-history"></i>${shared.escapeHtml(shared.formatRelativeTime(post.createdAt || post.lastActivityAt))}</span></div><button type="button" class="btn btn-light rounded-pill fw-semibold" onclick="Comunidad.focusPost('${post.id}')"><i class="bi bi-arrow-down-right-circle me-1"></i>Ver publicación</button></article>`;
            }

            function renderTrendLead(post) {
                const typeCfg = shared.getTypeCfg(post.type);
                return `<article class="comunidad-trend-lead comunidad-trend-lead--${typeCfg.accent}"><div class="comunidad-trend-head"><span class="comunidad-trend-pill"><i class="bi bi-fire"></i>#1 en tendencia</span><div class="comunidad-trend-metrics"><span><i class="bi bi-heart-fill"></i>${post.reactionCount || 0}</span><span><i class="bi bi-chat-left-text-fill"></i>${post.commentCount || 0}</span></div></div><h3 class="comunidad-trend-title">${shared.escapeHtml(post.title || excerpt(post, 84))}</h3><p class="comunidad-trend-text">${shared.escapeHtml(excerpt(post, 180))}</p><div class="comunidad-trend-footer"><span class="comunidad-type-badge comunidad-type-badge--${typeCfg.accent}"><i class="bi ${typeCfg.icon}"></i>${shared.escapeHtml(typeCfg.label)}</span><span class="text-muted small"><i class="bi bi-clock-history me-1"></i>${shared.escapeHtml(shared.formatRelativeTime(post.lastActivityAt || post.createdAt))}</span></div><div class="comunidad-trend-actions"><button type="button" class="btn btn-light rounded-pill fw-semibold" onclick="Comunidad.focusPost('${post.id}', true)"><i class="bi bi-chat-left-dots me-1"></i>Abrir conversación</button><button type="button" class="btn btn-outline-light rounded-pill fw-semibold" onclick="Comunidad.sharePost('${post.id}')"><i class="bi bi-link-45deg me-1"></i>Copiar enlace</button></div></article>`;
            }

            function renderTypeTile(type, cfg) {
                const count = getFilteredPosts({ ignoreType: true }).filter((post) => post.type === type).length;
                return `<article class="comunidad-type-tile comunidad-type-tile--${cfg.accent} ${state.activeType === type ? 'is-active' : ''}"><div class="comunidad-type-tile-head"><div class="comunidad-type-tile-icon"><i class="bi ${cfg.icon}"></i></div><div><h4>${shared.escapeHtml(cfg.label)}</h4><p>${shared.escapeHtml(cfg.description || 'Explora este tipo de publicación.')}</p></div></div><div class="comunidad-type-tile-meta"><span>${count} ${count === 1 ? 'publicación' : 'publicaciones'}</span>${state.activeType === type ? '<span class="comunidad-type-tile-badge">Filtro activo</span>' : ''}</div><div class="comunidad-type-tile-actions"><button type="button" class="btn btn-light rounded-pill fw-semibold" onclick="Comunidad.exploreType('${type}')"><i class="bi bi-funnel-fill me-1"></i>Ver publicaciones</button><button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold" onclick="Comunidad.openComposerModal('${type}')"><i class="bi bi-plus-circle me-1"></i>Publicar</button></div></article>`;
            }

            function getFilteredPosts(options = {}) {
                const type = options.ignoreType ? 'all' : state.activeType;
                const scope = options.ignoreScope ? 'all' : state.activeScope;
                return state.posts.filter((post) => (type === 'all' || post.type === type) && (scope === 'all' || (post.scope || 'global') === scope));
            }

            function sortPosts(posts, mode) {
                const sorted = [...posts];
                if (mode === 'trending') return sorted.sort((a, b) => getTrendScore(b) - getTrendScore(a) || activityTime(b) - activityTime(a));
                return sorted.sort((a, b) => createdTime(b) - createdTime(a));
            }

            function getTrendScore(post) {
                const comments = Number(post?.commentCount) || 0;
                const reactions = Number(post?.reactionCount) || 0;
                const created = shared.toDate(post?.createdAt || post?.lastActivityAt);
                const ageHours = created ? Math.max(1, (Date.now() - created.getTime()) / 3600000) : 48;
                return (comments * 3) + (reactions * 2) + (Math.max(0, 72 - ageHours) / 8) + (post?.pinned ? 6 : 0);
            }

            function createdTime(post) { return shared.toDate(post?.createdAt || post?.lastActivityAt)?.getTime?.() || 0; }
            function activityTime(post) { return shared.toDate(post?.lastActivityAt || post?.createdAt)?.getTime?.() || 0; }
            function visibleCount(count) { return `${count} ${count === 1 ? 'publicación visible' : 'publicaciones visibles'}`; }
            function excerpt(post, limit) { const text = String(post?.text || (Array.isArray(post?.bullets) ? post.bullets.join(' · ') : '') || '').trim(); return !text ? 'Sin texto adicional.' : (text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text); }
            function feedDescription() { return state.activeType === 'all' && state.activeScope === 'all' ? 'Estas son las publicaciones según los filtros activos.' : `Vista filtrada por ${(state.activeType === 'all' ? 'todos los tipos' : shared.getTypeCfg(state.activeType).label)} · ${(state.activeScope === 'all' ? 'todos los alcances' : shared.getScopeCfg(state.activeScope).label)}.`; }

            function renderFeed(posts) {
                const feed = document.getElementById('comunidad-feed');
                if (!feed) return;
                if (!posts.length) { feed.innerHTML = renderEmptyState('Aún no hay publicaciones para este filtro', 'Prueba otro tipo, otro alcance o crea la primera publicación de esta categoría.'); return; }
                feed.innerHTML = posts.map(renderPostCard).join('');
            }

            function renderEmptyState(title, text) {
                return `<div class="comunidad-empty"><i class="bi bi-chat-left-text display-6 mb-3"></i><h4 class="fw-bold mb-2">${shared.escapeHtml(title)}</h4><p class="text-muted mb-3">${shared.escapeHtml(text)}</p><button type="button" class="btn btn-primary rounded-pill fw-semibold" onclick="Comunidad.openComposerModal()"><i class="bi bi-plus-circle me-1"></i>Crear publicación</button></div>`;
            }

            function messageDescription() {
                if (state.conversationsLoading) return 'Estamos cargando tu bandeja privada.';
                if (!state.conversations.length) return 'Todavia no tienes conversaciones privadas en Comunidad.';
                return 'Abre un hilo existente o inicia uno nuevo desde cualquier publicacion del feed.';
            }

            function messageMeta() {
                if (state.conversationsLoading) return 'Sincronizando mensajes';
                if (!state.conversations.length) return 'Bandeja vacia';
                return `${state.conversations.length} conversacion${state.conversations.length === 1 ? '' : 'es'} · ${state.unreadConversationCount} sin leer`;
            }

            function renderConversationList() {
                if (state.conversationsLoading) {
                    return Array.from({ length: 4 }, () => '<div class="comunidad-chat-card comunidad-card-skeleton"></div>').join('');
                }
                if (!state.conversations.length) {
                    return `<div class="comunidad-empty"><i class="bi bi-chat-dots display-6 mb-3"></i><h4 class="fw-bold mb-2">Todavia no hay mensajes privados</h4><p class="text-muted mb-3">Cuando quieras escribirle a alguien, abre su publicacion y toca "Mensaje privado".</p><button type="button" class="btn btn-primary rounded-pill fw-semibold" onclick="Comunidad.switchTab('novedades')"><i class="bi bi-stars me-1"></i>Ir al feed</button></div>`;
                }
                return state.conversations.map(renderConversationCard).join('');
            }

            function renderConversationCard(conversation) {
                const peer = getConversationPeer(conversation);
                const identityCfg = shared.getIdentityCfg(peer.roleKind);
                const unread = getUnreadCount(conversation);
                const preview = truncateText(conversation.lastMessage || 'Sin mensajes todavia.', 84);
                const meta = peer.career || peer.area || 'Comunidad';
                return `
                    <article class="comunidad-chat-card ${state.activeConversationId === conversation.id ? 'is-active' : ''}" onclick="Comunidad.openConversation('${conversation.id}')">
                        <div class="d-flex gap-3 align-items-start">
                            <div class="comunidad-avatar comunidad-chat-avatar">${peer.photoURL ? `<img src="${shared.escapeAttr(peer.photoURL)}" alt="${shared.escapeAttr(peer.name)}">` : `<span>${shared.escapeHtml((peer.name || 'C').charAt(0).toUpperCase())}</span>`}</div>
                            <div class="min-w-0 flex-grow-1">
                                <div class="comunidad-chat-card-top">
                                    <div class="min-w-0">
                                        <strong class="comunidad-chat-card-name text-truncate d-block">${shared.escapeHtml(peer.name || 'Usuario')}</strong>
                                        <div class="d-flex flex-wrap gap-2 mt-1">
                                            <span class="comunidad-identity-badge ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span>
                                        </div>
                                    </div>
                                    <div class="text-end">
                                        <div class="comunidad-chat-card-time">${shared.escapeHtml(shared.formatRelativeTime(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt))}</div>
                                        ${unread ? `<span class="comunidad-chat-unread">${unread > 99 ? '99+' : unread}</span>` : ''}
                                    </div>
                                </div>
                                <div class="comunidad-chat-card-meta">${shared.escapeHtml(meta)}</div>
                                <p class="comunidad-chat-card-preview">${shared.escapeHtml(preview)}</p>
                                <div class="comunidad-chat-card-hint">Toca para abrir el hilo</div>
                            </div>
                        </div>
                    </article>
                `;
            }

            function getUnreadCount(conversation) {
                const uid = shared.getUserUid(state.ctx, state.profile);
                return Number(conversation?.unreadBy?.[uid]) || 0;
            }

            function getConversationPeer(conversation) {
                return chatService.getConversationPeer(conversation, shared.getUserUid(state.ctx, state.profile));
            }

            function truncateText(value, limit = 72) {
                const text = String(value || '').trim();
                if (!text) return '';
                return text.length > limit ? `${text.slice(0, limit - 1).trim()}...` : text;
            }

            function syncActiveConversation() {
                if (!state.activeConversationId) return;
                const current = state.conversations.find((item) => item.id === state.activeConversationId);
                if (!current) return;
                state.activeConversationPeer = getConversationPeer(current);
            }

            function renderPersonAvatar(name, photoURL, extraClass = '') {
                const classes = ['comunidad-avatar', extraClass].filter(Boolean).join(' ');
                return `<div class="${classes}">${photoURL ? `<img src="${shared.escapeAttr(photoURL)}" alt="${shared.escapeAttr(name || 'Usuario')}">` : `<span>${shared.escapeHtml((name || 'U').charAt(0).toUpperCase())}</span>`}</div>`;
            }

            function renderPostCard(post) {
                const typeCfg = shared.getTypeCfg(post.type);
                const identityCfg = shared.getIdentityCfg(post.authorRoleKind);
                const scopeCfg = shared.getScopeCfg(post.scope);
                const isOwner = post.authorId === shared.getUserUid(state.ctx, state.profile);
                const isLiked = !!state.myReactions[post.id];
                const preview = excerpt(post, Array.isArray(post.media) && post.media.length ? 110 : 150);
                const hasPreview = preview && preview !== 'Sin texto adicional.';
                return `
                    <article class="comunidad-card comunidad-card--${typeCfg.accent} ${state.highlightPostId === post.id ? 'is-highlighted' : ''}" id="comunidad-post-${post.id}" onclick="Comunidad.focusPost('${post.id}')">
                        <div class="d-flex justify-content-between gap-3 mb-2">
                            <div class="d-flex gap-3 min-w-0">
                                ${renderPersonAvatar(post.authorName, post.authorPhotoURL)}
                                <div class="min-w-0">
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-1"><strong class="comunidad-author-name">${shared.escapeHtml(post.authorName || 'Usuario')}</strong><span class="comunidad-identity-badge ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span><span class="comunidad-type-badge comunidad-type-badge--${typeCfg.accent}"><i class="bi ${typeCfg.icon}"></i>${shared.escapeHtml(typeCfg.label)}</span></div>
                                    <div class="comunidad-meta-line">${post.authorCareer ? `<span><i class="bi bi-mortarboard-fill"></i>${shared.escapeHtml(post.authorCareer)}</span>` : ''}${post.authorArea ? `<span><i class="bi bi-buildings-fill"></i>${shared.escapeHtml(post.authorArea)}</span>` : ''}<span><i class="bi ${scopeCfg.icon}"></i>${shared.escapeHtml(scopeCfg.label)}</span><span><i class="bi bi-clock-history"></i>${shared.escapeHtml(shared.formatRelativeTime(post.lastActivityAt || post.createdAt))}</span></div>
                                </div>
                            </div>
                            ${isOwner ? `<div class="dropdown" onclick="event.stopPropagation()"><button class="btn btn-sm btn-light rounded-pill" data-bs-toggle="dropdown" onclick="event.stopPropagation()"><i class="bi bi-three-dots"></i></button><div class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-4"><button class="dropdown-item" onclick="Comunidad.startEditPost('${post.id}')"><i class="bi bi-pencil-square me-2"></i>Editar</button><button class="dropdown-item text-danger" onclick="Comunidad.deletePost('${post.id}')"><i class="bi bi-trash3 me-2"></i>Eliminar</button></div></div>` : ''}
                        </div>
                        <div class="comunidad-card-copy">
                            ${post.title ? `<h4 class="comunidad-post-title mb-2">${shared.escapeHtml(post.title)}</h4>` : ''}
                            ${hasPreview ? `<p class="comunidad-card-excerpt">${shared.escapeHtml(preview)}</p>` : ''}
                        </div>
                        ${renderCardMedia(post.media)}
                        <div class="comunidad-card-stats"><span><i class="bi bi-heart-fill"></i>${post.reactionCount || 0} ${(post.reactionCount || 0) === 1 ? 'reacción' : 'reacciones'}</span><span><i class="bi bi-chat-left-dots-fill"></i>${post.commentCount || 0} ${(post.commentCount || 0) === 1 ? 'comentario' : 'comentarios'}</span></div>
                        <div class="comunidad-actions comunidad-actions--compact">
                            <button type="button" class="comunidad-action-btn ${isLiked ? 'is-active' : ''}" onclick="event.stopPropagation(); Comunidad.toggleReaction('${post.id}')"><i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i><span>Me gusta</span><strong>${post.reactionCount || 0}</strong></button>
                            <button type="button" class="comunidad-action-btn" onclick="event.stopPropagation(); Comunidad.toggleComments('${post.id}')"><i class="bi bi-chat-left-dots"></i><span>Comentarios</span><strong>${post.commentCount || 0}</strong></button>
                            <button type="button" class="comunidad-action-btn" onclick="event.stopPropagation(); Comunidad.sharePost('${post.id}')"><i class="bi bi-share"></i><span>Compartir</span></button>
                        </div>
                    </article>
                `;
            }

            function renderCardMedia(media) {
                if (!Array.isArray(media) || !media.length) return '';
                const item = media[0];
                const extra = media.length > 1 ? `<span class="comunidad-card-media-badge">+${media.length - 1}</span>` : '';
                return `<figure class="comunidad-card-media">${extra}<img src="${shared.escapeAttr(item.url)}" alt="${shared.escapeAttr(item.name || 'Imagen de publicación')}" loading="lazy"></figure>`;
            }

            function renderMedia(postId, media, options = {}) {
                if (!Array.isArray(media) || !media.length) return '';
                if (options.expanded) {
                    const [lead, ...rest] = media;
                    return `
                        <div class="comunidad-media-stage">
                            <button type="button" class="comunidad-media-stage-main" onclick="Comunidad.openMediaViewer('${postId}', 0)">
                                <img src="${shared.escapeAttr(lead.url)}" alt="${shared.escapeAttr(lead.name || 'Imagen de la publicación')}" loading="lazy">
                                <span class="comunidad-media-stage-hint"><i class="bi bi-arrows-fullscreen"></i>Toca para ampliar</span>
                            </button>
                            ${rest.length ? `<div class="comunidad-media-thumb-row">${rest.map((item, index) => `<button type="button" class="comunidad-media-thumb" onclick="Comunidad.openMediaViewer('${postId}', ${index + 1})"><img src="${shared.escapeAttr(item.url)}" alt="${shared.escapeAttr(item.name || `Imagen ${index + 2}`)}" loading="lazy"></button>`).join('')}</div>` : ''}
                        </div>
                    `;
                }
                return `<div class="comunidad-media-grid">${media.slice(0, 3).map((item, index) => `<button type="button" class="comunidad-media-item" onclick="Comunidad.openMediaViewer('${postId}', ${index})"><img src="${shared.escapeAttr(item.url)}" alt="${shared.escapeAttr(item.name || 'Imagen de la publicación')}" loading="lazy"></button>`).join('')}</div>`;
            }

            function renderComments(postId) {
                const comments = state.commentsByPost[postId] || [];
                const roots = comments.filter((item) => !item.parentCommentId);
                const repliesByParent = comments.reduce((acc, item) => { if (item.parentCommentId) { if (!acc[item.parentCommentId]) acc[item.parentCommentId] = []; acc[item.parentCommentId].push(item); } return acc; }, {});
                const commentCount = comments.length;
                return `
                    <div class="comunidad-comments">
                        <div class="comunidad-post-section-head">
                            <div>
                                <span class="comunidad-panel-kicker">Comentarios</span>
                                <h4 class="comunidad-post-section-title">Conversación abierta</h4>
                            </div>
                            <span class="comunidad-section-meta">${commentCount} ${commentCount === 1 ? 'comentario' : 'comentarios'}</span>
                        </div>
                        <div class="comunidad-comments-list" id="comunidad-comments-list-${postId}">
                            ${roots.length ? roots.map((comment) => renderCommentItem(postId, comment, repliesByParent[comment.id] || [])).join('') : '<div class="comunidad-comment-empty">Todavía no hay comentarios. Sé la primera persona en participar.</div>'}
                        </div>
                    </div>
                `;
            }

            function renderCommentItem(postId, comment, replies) {
                const identityCfg = shared.getIdentityCfg(comment.authorRoleKind);
                return `
                    <article class="comunidad-comment-thread">
                        <div class="comunidad-comment-item">
                            ${renderPersonAvatar(comment.authorName, comment.authorPhotoURL, 'comunidad-avatar--comment')}
                            <div class="comunidad-comment-stack">
                                <div class="comunidad-comment-bubble">
                                    <div class="comunidad-comment-head-main">
                                        <strong>${shared.escapeHtml(comment.authorName || 'Usuario')}</strong>
                                        <span class="comunidad-identity-badge ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span>
                                    </div>
                                    <p class="comunidad-comment-text">${shared.escapeHtml(comment.text || '')}</p>
                                </div>
                                <div class="comunidad-comment-meta">
                                    <span>${shared.escapeHtml(shared.formatRelativeTime(comment.createdAt))}</span>
                                    <button type="button" class="btn btn-sm border-0 p-0 text-muted" onclick="Comunidad.setReplyTarget('${postId}', '${comment.id}')">Responder</button>
                                </div>
                            </div>
                        </div>
                        ${replies.length ? `<div class="comunidad-replies">${replies.map((reply) => renderReplyItem(postId, reply, comment.authorName)).join('')}</div>` : ''}
                    </article>
                `;
            }

            function renderReplyItem(postId, reply, parentAuthorName = '') {
                const identityCfg = shared.getIdentityCfg(reply.authorRoleKind);
                return `
                    <div class="comunidad-reply-item">
                        ${renderPersonAvatar(reply.authorName, reply.authorPhotoURL, 'comunidad-avatar--comment comunidad-avatar--reply')}
                        <div class="comunidad-comment-stack">
                            ${parentAuthorName ? `<div class="comunidad-comment-replying"><i class="bi bi-reply-fill"></i>Respondiendo a <strong>${shared.escapeHtml(parentAuthorName)}</strong></div>` : ''}
                            <div class="comunidad-comment-bubble comunidad-comment-bubble--reply">
                                <div class="comunidad-comment-head-main">
                                    <strong>${shared.escapeHtml(reply.authorName || 'Usuario')}</strong>
                                    <span class="comunidad-identity-badge ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span>
                                </div>
                                <p class="comunidad-comment-text">${shared.escapeHtml(reply.text || '')}</p>
                            </div>
                            <div class="comunidad-comment-meta">
                                <span>${shared.escapeHtml(shared.formatRelativeTime(reply.createdAt))}</span>
                                <button type="button" class="btn btn-sm border-0 p-0 text-muted" onclick="Comunidad.setReplyTarget('${postId}', '${reply.id}')">Responder</button>
                            </div>
                        </div>
                    </div>
                `;
            }

            function syncModalScrollLock() {
                const hasVisibleModal = !!document.querySelector('#view-comunidad .modal.show');
                document.documentElement.classList.toggle('comunidad-modal-lock', hasVisibleModal);
                document.body.classList.toggle('comunidad-modal-lock', hasVisibleModal);
            }

            function bindManagedModal(modalEl, onHidden) {
                if (!modalEl || !window.bootstrap?.Modal) return null;
                const instance = window.bootstrap.Modal.getOrCreateInstance ? window.bootstrap.Modal.getOrCreateInstance(modalEl) : new window.bootstrap.Modal(modalEl);
                modalEl.addEventListener('shown.bs.modal', () => syncModalScrollLock());
                modalEl.addEventListener('hidden.bs.modal', () => {
                    onHidden?.();
                    setTimeout(syncModalScrollLock, 0);
                });
                return instance;
            }

            function setupComposerModal() {
                const modalEl = document.getElementById('modalComunidadComposer');
                state.composerModal = bindManagedModal(modalEl, () => resetComposer());
                syncComposerUi();
            }

            function setupPostModal() {
                const modalEl = document.getElementById('modalComunidadPost');
                state.postModal = bindManagedModal(modalEl, () => {
                    state.activePostId = null;
                    state.highlightPostId = null;
                    renderCurrentTab();
                });
                renderActivePostModal();
            }

            function setupChatModal() {
                const modalEl = document.getElementById('modalComunidadChat');
                state.chatModal = bindManagedModal(modalEl, () => {
                    stopMessageStream();
                    state.activeMessages = [];
                    renderCurrentTab();
                    renderActiveConversationModal();
                });
                renderActiveConversationModal();
            }

            function setupReportModal() {
                const modalEl = document.getElementById('modalComunidadReport');
                state.reportModal = bindManagedModal(modalEl, () => {
                    state.reportDraft = null;
                    renderReportModalState();
                });
                renderReportModalState();
            }

            function setupMediaModal() {
                const modalEl = document.getElementById('modalComunidadMedia');
                state.mediaModal = bindManagedModal(modalEl, () => {
                    state.mediaViewer = null;
                    renderMediaViewer();
                });
                renderMediaViewer();
            }

            function openComposerModal(type = null) {
                if (type) document.getElementById('comunidad-post-type').value = type;
                syncComposerUi();
                state.composerModal?.show();
            }

            function closeComposerModal() {
                if (state.composerModal) state.composerModal.hide();
                else resetComposer();
            }

            function setComposerType(type) {
                document.getElementById('comunidad-post-type').value = type;
                if (!shared.getTypeComposerCfg(type).supportsBullets) state.composerMode = 'plain';
                syncComposerUi();
            }

            function renderActivePostModal() {
                const body = document.getElementById('comunidad-post-modal-body');
                const footer = document.getElementById('comunidad-post-modal-footer');
                if (!body) return;
                const post = state.posts.find((item) => item.id === state.activePostId);
                if (!post) {
                    body.innerHTML = '<div class="text-muted">Selecciona una publicación para verla completa.</div>';
                    if (footer) footer.innerHTML = '';
                    return;
                }

                const typeCfg = shared.getTypeCfg(post.type);
                const identityCfg = shared.getIdentityCfg(post.authorRoleKind);
                const scopeCfg = shared.getScopeCfg(post.scope);
                const isOwner = post.authorId === shared.getUserUid(state.ctx, state.profile);
                const isLiked = !!state.myReactions[post.id];
                body.innerHTML = `
                    <div class="comunidad-post-view-shell">
                        <article class="comunidad-post-view-card comunidad-post-view-card--${typeCfg.accent}">
                            <div class="comunidad-post-view-label-row">
                                <span class="comunidad-panel-kicker">Publicación</span>
                                <span class="comunidad-section-meta">${shared.escapeHtml(shared.formatRelativeTime(post.lastActivityAt || post.createdAt))}</span>
                            </div>
                            <div class="comunidad-post-view-top">
                                <div class="d-flex gap-3 min-w-0">
                                    ${renderPersonAvatar(post.authorName, post.authorPhotoURL)}
                                    <div class="min-w-0">
                                        <div class="d-flex flex-wrap align-items-center gap-2 mb-1"><strong class="comunidad-author-name">${shared.escapeHtml(post.authorName || 'Usuario')}</strong><span class="comunidad-identity-badge ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span><span class="comunidad-type-badge comunidad-type-badge--${typeCfg.accent}"><i class="bi ${typeCfg.icon}"></i>${shared.escapeHtml(typeCfg.label)}</span></div>
                                        <div class="comunidad-meta-line">${post.authorCareer ? `<span><i class="bi bi-mortarboard-fill"></i>${shared.escapeHtml(post.authorCareer)}</span>` : ''}${post.authorArea ? `<span><i class="bi bi-buildings-fill"></i>${shared.escapeHtml(post.authorArea)}</span>` : ''}<span><i class="bi ${scopeCfg.icon}"></i>${shared.escapeHtml(scopeCfg.label)}</span><span><i class="bi bi-clock-history"></i>${shared.escapeHtml(shared.formatDate(post.createdAt || post.lastActivityAt))}</span></div>
                                    </div>
                                </div>
                                <div class="comunidad-post-view-top-actions">
                                    ${!isOwner ? `<button type="button" class="comunidad-inline-chip" onclick="Comunidad.openConversationWithPostAuthor('${post.id}')"><i class="bi bi-send"></i><span>Mensaje privado</span></button>` : ''}
                                    ${isOwner ? `<div class="dropdown"><button class="btn btn-sm btn-light rounded-pill" data-bs-toggle="dropdown"><i class="bi bi-three-dots"></i></button><div class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-4"><button class="dropdown-item" onclick="Comunidad.startEditPost('${post.id}')"><i class="bi bi-pencil-square me-2"></i>Editar</button><button class="dropdown-item text-danger" onclick="Comunidad.deletePost('${post.id}')"><i class="bi bi-trash3 me-2"></i>Eliminar</button></div></div>` : ''}
                                </div>
                            </div>
                            <div class="comunidad-post-view-content">
                                <div class="comunidad-post-view-copy">${shared.renderPostBody(post)}</div>
                                ${renderMedia(post.id, post.media, { expanded: true })}
                            </div>
                            <div class="comunidad-card-stats"><span><i class="bi bi-heart-fill"></i>${post.reactionCount || 0} ${(post.reactionCount || 0) === 1 ? 'reacción' : 'reacciones'}</span><span><i class="bi bi-chat-left-dots-fill"></i>${post.commentCount || 0} ${(post.commentCount || 0) === 1 ? 'comentario' : 'comentarios'}</span></div>
                            <div class="comunidad-post-view-actions">
                                <button type="button" class="comunidad-action-btn ${isLiked ? 'is-active' : ''}" onclick="Comunidad.toggleReaction('${post.id}')"><i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i><span>Me gusta</span><strong>${post.reactionCount || 0}</strong></button>
                                <button type="button" class="comunidad-action-btn" onclick="Comunidad.focusCommentComposer('${post.id}')"><i class="bi bi-chat-left-dots"></i><span>Comentar</span><strong>${post.commentCount || 0}</strong></button>
                                <button type="button" class="comunidad-action-btn" onclick="Comunidad.sharePost('${post.id}')"><i class="bi bi-share"></i><span>Compartir</span></button>
                                <button type="button" class="comunidad-action-btn text-danger-emphasis" onclick="Comunidad.reportPost('${post.id}')"><i class="bi bi-flag"></i><span>Reportar</span></button>
                            </div>
                        </article>
                        <section class="comunidad-post-view-comments" id="comunidad-comments-section-${post.id}">
                            ${renderComments(post.id)}
                        </section>
                    </div>
                `;
                renderPostModalFooter(post.id);
            }

            function renderPostModalFooter(postId) {
                const footer = document.getElementById('comunidad-post-modal-footer');
                if (!footer) return;
                const post = state.posts.find((item) => item.id === postId);
                if (!post) {
                    footer.innerHTML = '';
                    return;
                }
                const comments = state.commentsByPost[postId] || [];
                const replyTargetId = state.replyTargetByPost[postId];
                const replyComment = replyTargetId ? comments.find((item) => item.id === replyTargetId) : null;
                const draftText = state.commentDraftByPost[postId] || '';
                footer.innerHTML = `
                    <div class="comunidad-comment-compose-card comunidad-comment-compose-card--footer">
                        ${replyComment ? `<div class="comunidad-reply-tag comunidad-reply-tag--footer">Respondiendo a <strong>${shared.escapeHtml(replyComment.authorName || 'comentario')}</strong><button type="button" onclick="Comunidad.clearReplyTarget('${postId}')">Cancelar</button></div>` : ''}
                        <div class="comunidad-comment-compose comunidad-comment-compose--footer">
                            ${renderPersonAvatar(state.profile?.displayName || state.profile?.nombre || 'Tú', state.profile?.photoURL, 'comunidad-avatar--comment')}
                            <input type="text" class="form-control comunidad-comment-input comunidad-comment-input--inline" id="comunidad-comment-input-${postId}" maxlength="800" value="${shared.escapeAttr(draftText)}" placeholder="Escribe un comentario..." onkeydown="if(event.key==='Enter'){ event.preventDefault(); Comunidad.submitComment('${postId}'); }">
                            <button class="btn btn-primary comunidad-comment-send comunidad-comment-send--inline" type="button" onclick="Comunidad.submitComment('${postId}')"><i class="bi bi-send-fill"></i></button>
                        </div>
                    </div>
                `;
                const input = document.getElementById(`comunidad-comment-input-${postId}`);
                input?.addEventListener('input', () => { state.commentDraftByPost[postId] = input.value || ''; });
            }

            function ensureReportDraft(postId = null) {
                if (!state.reportDraft) {
                    state.reportDraft = {
                        postId: postId || null,
                        reason: REPORT_REASONS[0].value,
                        details: '',
                        busy: false,
                        submitted: false,
                        error: ''
                    };
                }
                if (postId) state.reportDraft.postId = postId;
                return state.reportDraft;
            }

            function renderReportModalState() {
                const body = document.getElementById('comunidad-report-modal-body');
                if (!body) return;
                const draft = ensureReportDraft();
                const post = state.posts.find((item) => item.id === draft.postId);
                const targetLabel = post ? (post.title || post.authorName || 'Publicación') : 'Publicación seleccionada';
                if (draft.submitted) {
                    body.innerHTML = `
                        <div class="comunidad-mini-state is-success">
                            <i class="bi bi-check2-circle"></i>
                            <h4>Reporte enviado</h4>
                            <p>Gracias. El equipo de Comunidad revisará esta publicación.</p>
                            <button type="button" class="btn btn-primary rounded-pill px-4 fw-semibold" onclick="Comunidad.closeReportDialog()">Listo</button>
                        </div>
                    `;
                    return;
                }
                body.innerHTML = `
                    <div class="comunidad-mini-copy">
                        <p class="mb-2">Reportarás: <strong>${shared.escapeHtml(targetLabel)}</strong></p>
                        <p class="text-muted small mb-0">Selecciona el motivo principal y agrega contexto solo si hace falta.</p>
                    </div>
                    <div class="comunidad-report-reasons">
                        ${REPORT_REASONS.map((item) => `<button type="button" class="comunidad-report-reason ${draft.reason === item.value ? 'is-active' : ''}" onclick="Comunidad.selectReportReason('${item.value}')">${shared.escapeHtml(item.label)}</button>`).join('')}
                    </div>
                    <label class="form-label fw-semibold mt-3" for="comunidad-report-details">Detalles opcionales</label>
                    <textarea class="form-control rounded-4" id="comunidad-report-details" rows="4" maxlength="300" placeholder="Agrega contexto para moderación">${shared.escapeHtml(draft.details || '')}</textarea>
                    ${draft.error ? `<div class="alert alert-danger border-0 rounded-4 py-2 px-3 small mt-3 mb-0">${shared.escapeHtml(draft.error)}</div>` : ''}
                    <div class="d-flex justify-content-end gap-2 mt-3">
                        <button type="button" class="btn btn-light rounded-pill px-4" onclick="Comunidad.closeReportDialog()">Cancelar</button>
                        <button type="button" class="btn btn-primary rounded-pill px-4 fw-semibold" ${draft.busy ? 'disabled' : ''} onclick="Comunidad.submitReport()"><i class="bi bi-flag-fill me-1"></i>${draft.busy ? 'Enviando...' : 'Enviar reporte'}</button>
                    </div>
                `;
            }

            function renderMediaViewer() {
                const body = document.getElementById('comunidad-media-modal-body');
                if (!body) return;
                const viewer = state.mediaViewer;
                if (!viewer?.items?.length) {
                    body.innerHTML = '<div class="comunidad-mini-state"><i class="bi bi-image"></i><h4>Sin imagen seleccionada</h4><p>Abre una publicación con imagen para verla aquí con más detalle.</p></div>';
                    return;
                }
                const current = viewer.items[viewer.index] || viewer.items[0];
                body.innerHTML = `
                    <div class="comunidad-media-viewer-shell">
                        <div class="comunidad-media-viewer-toolbar">
                            <span class="comunidad-section-meta">Imagen ${viewer.index + 1} de ${viewer.items.length}</span>
                            <div class="comunidad-media-viewer-controls">
                                <button type="button" class="comunidad-icon-btn" onclick="Comunidad.zoomMediaViewer(-0.25)" aria-label="Alejar"><i class="bi bi-zoom-out"></i></button>
                                <button type="button" class="comunidad-icon-btn" onclick="Comunidad.zoomMediaViewer(0.25)" aria-label="Acercar"><i class="bi bi-zoom-in"></i></button>
                                <button type="button" class="comunidad-icon-btn" onclick="Comunidad.zoomMediaViewer(0, true)" aria-label="Restablecer"><i class="bi bi-aspect-ratio"></i></button>
                            </div>
                        </div>
                        <div class="comunidad-media-viewer-stage">
                            <img src="${shared.escapeAttr(current.url)}" alt="${shared.escapeAttr(current.name || 'Imagen de la publicación')}" class="comunidad-media-viewer-image" style="transform: scale(${viewer.zoom || 1});">
                        </div>
                        ${viewer.items.length > 1 ? `<div class="comunidad-media-viewer-strip">${viewer.items.map((item, index) => `<button type="button" class="comunidad-media-thumb ${index === viewer.index ? 'is-active' : ''}" onclick="Comunidad.stepMediaViewer(${index})"><img src="${shared.escapeAttr(item.url)}" alt="${shared.escapeAttr(item.name || `Imagen ${index + 1}`)}"></button>`).join('')}</div>` : ''}
                    </div>
                `;
            }

            function renderActiveConversationModal() {
                const body = document.getElementById('comunidad-chat-modal-body');
                const titleEl = document.getElementById('comunidad-chat-header-title');
                const metaEl = document.getElementById('comunidad-chat-header-meta');
                const avatarEl = document.getElementById('comunidad-chat-header-avatar');
                const input = document.getElementById('comunidad-chat-input');
                const sendBtn = document.getElementById('comunidad-chat-send-btn');
                if (!body || !titleEl || !metaEl || !avatarEl || !input || !sendBtn) return;

                if (!state.activeConversationId || !state.activeConversationPeer) {
                    titleEl.textContent = 'Selecciona una conversacion';
                    metaEl.textContent = 'Abre un hilo desde una publicacion o desde tu bandeja.';
                    avatarEl.classList.remove('has-photo');
                    avatarEl.textContent = 'C';
                    body.innerHTML = '<div class="comunidad-chat-empty-thread"><i class="bi bi-chat-dots"></i><h4>Mensajeria de Comunidad</h4><p>Usa la pestaña de mensajes o abre una publicacion para iniciar una conversacion privada.</p></div>';
                    input.value = '';
                    input.disabled = true;
                    input.placeholder = 'Selecciona una conversacion...';
                    sendBtn.disabled = true;
                    return;
                }

                const peer = state.activeConversationPeer;
                const identityCfg = shared.getIdentityCfg(peer.roleKind);
                titleEl.textContent = peer.name || 'Conversacion privada';
                metaEl.innerHTML = `<span class="comunidad-identity-badge ${identityCfg.className}"><i class="bi ${identityCfg.icon}"></i>${shared.escapeHtml(identityCfg.label)}</span>${peer.career ? `<span>${shared.escapeHtml(peer.career)}</span>` : ''}${!peer.career && peer.area ? `<span>${shared.escapeHtml(peer.area)}</span>` : ''}`;
                if (peer.photoURL) {
                    avatarEl.classList.add('has-photo');
                    avatarEl.innerHTML = `<img src="${shared.escapeAttr(peer.photoURL)}" alt="${shared.escapeAttr(peer.name || 'Contacto')}">`;
                } else {
                    avatarEl.classList.remove('has-photo');
                    avatarEl.textContent = (peer.name || 'C').charAt(0).toUpperCase();
                }

                const messages = Array.isArray(state.activeMessages) ? state.activeMessages : [];
                if (!messages.length) {
                    body.innerHTML = `<div class="comunidad-chat-empty-thread"><i class="bi bi-envelope-open-heart"></i><h4>Conversacion lista</h4><p>Escribe el primer mensaje para abrir un canal directo con ${shared.escapeHtml(peer.name || 'este usuario')}.</p></div>`;
                } else {
                    body.innerHTML = `<div class="comunidad-chat-thread">${messages.map(renderConversationMessage).join('')}</div>`;
                    requestAnimationFrame(scrollConversationToBottom);
                }

                input.disabled = false;
                input.placeholder = `Mensaje para ${peer.name || 'tu contacto'}...`;
                sendBtn.disabled = false;
            }

            function renderConversationMessage(message) {
                const currentUid = shared.getUserUid(state.ctx, state.profile);
                const isSelf = message?.senderId === currentUid;
                const text = shared.escapeHtml(message?.text || '').replace(/\r?\n/g, '<br>');
                return `
                    <div class="comunidad-chat-row ${isSelf ? 'is-self' : 'is-other'}">
                        <div class="comunidad-chat-bubble ${isSelf ? 'is-self' : 'is-other'}">
                            ${!isSelf ? `<div class="comunidad-chat-bubble-name">${shared.escapeHtml(message?.senderName || state.activeConversationPeer?.name || 'Usuario')}</div>` : ''}
                            <div class="comunidad-chat-bubble-text">${text || '<span class="text-muted">Sin contenido</span>'}</div>
                            <div class="comunidad-chat-bubble-time">${shared.escapeHtml(formatMessageClock(message?.createdAt))}</div>
                        </div>
                    </div>
                `;
            }

            function formatMessageClock(value) {
                const date = shared.toDate(value);
                if (!date) return 'Ahora';
                return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            }

            function scrollConversationToBottom() {
                const body = document.getElementById('comunidad-chat-modal-body');
                if (!body) return;
                body.scrollTop = body.scrollHeight;
            }

            function stopMessageStream() {
                if (state.messageUnsub) { try { state.messageUnsub(); } catch (_) { } }
                state.messageUnsub = null;
            }

            function startMessageStream(conversationId) {
                stopMessageStream();
                state.activeMessages = [];
                renderActiveConversationModal();
                state.messageUnsub = chatService.streamMessages(state.ctx, conversationId, (messages) => {
                    state.activeMessages = messages;
                    renderActiveConversationModal();
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage && lastMessage.senderId !== shared.getUserUid(state.ctx, state.profile)) {
                        chatService.markAsRead(state.ctx, conversationId).catch(() => null);
                    }
                }, () => shared.showToast('No fue posible cargar este hilo privado.', 'warning'));
            }

            async function openConversationRecord(conversation) {
                if (!conversation?.id) return;
                state.activeTab = 'mensajes';
                syncBreadcrumb(state.activeTab);
                state.activeConversationId = conversation.id;
                state.activeConversationPeer = getConversationPeer(conversation);
                const input = document.getElementById('comunidad-chat-input');
                if (input) input.value = '';
                renderCurrentTab();
                renderActiveConversationModal();
                startMessageStream(conversation.id);
                state.chatModal?.show();
                await chatService.markAsRead(state.ctx, conversation.id).catch(() => null);
            }

            async function openConversation(conversationId) {
                const conversation = state.conversations.find((item) => item.id === conversationId);
                if (!conversation) return;
                await openConversationRecord(conversation);
            }

            async function openConversationWithPostAuthor(postId) {
                const post = state.posts.find((item) => item.id === postId);
                if (!post) return;
                const currentUid = shared.getUserUid(state.ctx, state.profile);
                if (post.authorId === currentUid) {
                    shared.showToast('No puedes abrir una conversacion contigo.', 'info');
                    return;
                }
                try {
                    const conversation = await chatService.getOrCreateConversation(state.ctx, {
                        uid: post.authorId,
                        displayName: post.authorName,
                        photoURL: post.authorPhotoURL,
                        authorRoleKind: post.authorRoleKind,
                        authorRoleLabel: post.authorRoleLabel,
                        authorCareer: post.authorCareer,
                        authorArea: post.authorArea
                    });
                    const foundIndex = state.conversations.findIndex((item) => item.id === conversation.id);
                    if (foundIndex >= 0) state.conversations[foundIndex] = { ...state.conversations[foundIndex], ...conversation };
                    else state.conversations = [{ ...conversation }, ...state.conversations];
                    state.unreadConversationCount = state.conversations.reduce((acc, item) => acc + getUnreadCount(item), 0);
                    if (state.activePostId === postId) state.postModal?.hide();
                    const conversationDraft = {
                        ...conversation,
                        participants: conversation.participants || [currentUid, post.authorId],
                        participantProfiles: conversation.participantProfiles || {
                            [currentUid]: {
                                uid: currentUid,
                                name: state.profile?.displayName || state.profile?.nombre || 'Tu',
                                photoURL: state.profile?.photoURL || '',
                                roleKind: shared.determineIdentity(state.profile).kind,
                                roleLabel: shared.determineIdentity(state.profile).label,
                                career: shared.getCareerLabel(state.profile),
                                area: shared.getAreaLabel(state.profile)
                            },
                            [post.authorId]: {
                                uid: post.authorId,
                                name: post.authorName,
                                photoURL: post.authorPhotoURL,
                                roleKind: post.authorRoleKind,
                                roleLabel: post.authorRoleLabel,
                                career: post.authorCareer,
                                area: post.authorArea
                            }
                        }
                    };
                    await openConversationRecord(conversationDraft);
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible abrir el mensaje privado.', 'danger');
                }
            }

            async function sendMessage() {
                const input = document.getElementById('comunidad-chat-input');
                const sendBtn = document.getElementById('comunidad-chat-send-btn');
                if (!state.activeConversationId || !input || !sendBtn) return;
                sendBtn.disabled = true;
                try {
                    await chatService.sendMessage(state.ctx, state.activeConversationId, input.value || '');
                    input.value = '';
                    input.focus();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible enviar el mensaje.', 'danger');
                } finally {
                    sendBtn.disabled = false;
                }
            }

            function ensureCommentsStream(postId) {
                if (state.commentsUnsubs[postId]) return;
                state.commentsUnsubs[postId] = service.streamComments(state.ctx, postId, (comments) => {
                    state.commentsByPost[postId] = comments;
                    if (state.activePostId === postId) {
                        const commentsHost = document.getElementById(`comunidad-comments-section-${postId}`);
                        if (commentsHost) commentsHost.innerHTML = renderComments(postId);
                        renderPostModalFooter(postId);
                    }
                }, () => shared.showToast('No fue posible cargar los comentarios.', 'warning'));
            }

            function openPostModal(postId, focusCommentBox = false) {
                state.activePostId = postId;
                state.highlightPostId = postId;
                ensureCommentsStream(postId);
                renderActivePostModal();
                state.postModal?.show();
                if (focusCommentBox) setTimeout(() => focusCommentComposer(postId), 220);
            }

            function syncComposerUi() {
                const type = document.getElementById('comunidad-post-type')?.value || 'general';
                const cfg = shared.getTypeComposerCfg(type);
                const typeCfg = shared.getTypeCfg(type);
                document.getElementById('comunidad-composer-title').textContent = state.editingPostId ? 'Editar publicación' : cfg.kicker;
                document.getElementById('comunidad-compose-description').textContent = state.editingPostId ? 'Haz ajustes y guarda los cambios sin saturar la vista principal.' : cfg.helper;
                document.getElementById('comunidad-post-title-label').textContent = cfg.titleLabel;
                document.getElementById('comunidad-post-text-label').textContent = cfg.textLabel;
                document.getElementById('comunidad-post-bullets-label').textContent = cfg.bulletLabel || 'Viñetas rápidas';
                document.getElementById('comunidad-post-title').placeholder = cfg.titlePlaceholder || 'Escribe un título';
                document.getElementById('comunidad-post-text').placeholder = cfg.textPlaceholder || 'Escribe aquí';
                document.getElementById('comunidad-compose-type-grid').innerHTML = Object.entries(shared.TYPE_CONFIG).map(([key, item]) => `<button type="button" class="comunidad-compose-type ${type === key ? 'is-active' : ''} comunidad-compose-type--${item.accent}" onclick="Comunidad.setComposerType('${key}')"><i class="bi ${item.icon}"></i><strong>${shared.escapeHtml(item.label)}</strong><span>${shared.escapeHtml(item.description || '')}</span></button>`).join('');
                document.getElementById('comunidad-compose-tip').innerHTML = `<i class="bi ${typeCfg.icon}"></i><div><strong>${shared.escapeHtml(typeCfg.label)}</strong><span>${shared.escapeHtml(cfg.helper)}</span></div>`;
                document.getElementById('comunidad-compose-mode-wrap').classList.toggle('d-none', !cfg.supportsBullets);
                document.querySelectorAll('#comunidad-bullets-wrap .comunidad-bullet-input').forEach((input, index) => { input.placeholder = cfg.bulletPlaceholders?.[index] || `Punto ${index + 1}`; });
                document.getElementById('comunidad-compose-modal').className = `modal-content border-0 shadow-lg rounded-5 overflow-hidden comunidad-compose-modal comunidad-compose-modal--${typeCfg.accent}`;
                document.getElementById('comunidad-submit-btn').innerHTML = state.editingPostId ? '<i class="bi bi-check2-circle me-1"></i>Guardar cambios' : '<i class="bi bi-send-fill me-1"></i>Publicar';
                applyComposerModeUi();
            }

            async function submitPost() {
                const button = document.getElementById('comunidad-submit-btn');
                if (button) button.disabled = true;
                try {
                    const payload = {
                        title: document.getElementById('comunidad-post-title')?.value || '',
                        text: document.getElementById('comunidad-post-text')?.value || '',
                        type: document.getElementById('comunidad-post-type')?.value || 'general',
                        scope: document.getElementById('comunidad-post-scope')?.value || 'global',
                        contentMode: state.composerMode,
                        bullets: Array.from(document.querySelectorAll('#comunidad-bullets-wrap .comunidad-bullet-input')).map((input) => input.value || ''),
                        files: document.getElementById('comunidad-post-media')?.files || []
                    };
                    if (state.editingPostId) await service.updatePost(state.ctx, state.editingPostId, payload);
                    else await service.createPost(state.ctx, payload);
                    shared.showToast(state.editingPostId ? 'Publicación actualizada.' : 'Publicación creada.', 'success');
                    closeComposerModal();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible guardar la publicación.', 'danger');
                } finally {
                    if (button) button.disabled = false;
                }
            }

            function resetComposer() {
                state.editingPostId = null;
                state.composerMode = 'plain';
                document.getElementById('comunidad-post-type').value = 'general';
                document.getElementById('comunidad-post-scope').value = 'global';
                document.getElementById('comunidad-post-title').value = '';
                document.getElementById('comunidad-post-text').value = '';
                document.querySelectorAll('#comunidad-bullets-wrap .comunidad-bullet-input').forEach((input) => { input.value = ''; });
                const fileInput = document.getElementById('comunidad-post-media');
                if (fileInput) {
                    fileInput.value = '';
                    fileInput.disabled = false;
                }
                const mediaHelp = document.getElementById('comunidad-media-help');
                if (mediaHelp) mediaHelp.textContent = 'Hasta 3 imágenes por publicación.';
                document.getElementById('comunidad-edit-alert')?.classList.add('d-none');
                syncComposerUi();
            }

            function startEditPost(postId) {
                const post = state.posts.find((item) => item.id === postId);
                if (!post) return;
                if (state.activePostId === postId) state.postModal?.hide();
                state.editingPostId = postId;
                state.composerMode = post.contentMode === 'bullets' ? 'bullets' : 'plain';
                document.getElementById('comunidad-post-type').value = post.type || 'general';
                document.getElementById('comunidad-post-scope').value = post.scope || 'global';
                document.getElementById('comunidad-post-title').value = post.title || '';
                document.getElementById('comunidad-post-text').value = post.text || '';
                document.querySelectorAll('#comunidad-bullets-wrap .comunidad-bullet-input').forEach((input, index) => { input.value = (post.bullets || [])[index] || ''; });
                const fileInput = document.getElementById('comunidad-post-media');
                if (fileInput) {
                    fileInput.value = '';
                    fileInput.disabled = true;
                }
                const mediaHelp = document.getElementById('comunidad-media-help');
                if (mediaHelp) mediaHelp.textContent = 'Las imágenes actuales se conservarán. La edición de imágenes llegará más adelante.';
                document.getElementById('comunidad-edit-alert')?.classList.remove('d-none');
                syncComposerUi();
                openComposerModal();
            }

            function cancelEditPost() { closeComposerModal(); }
            async function deletePost(postId) { if (!window.confirm('Esta publicación dejará de verse en el feed. ¿Deseas continuar?')) return; try { await service.deletePost(state.ctx, postId); shared.showToast('Publicación eliminada.', 'success'); if (state.editingPostId === postId) closeComposerModal(); if (state.activePostId === postId) { state.postModal?.hide(); state.activePostId = null; state.highlightPostId = null; } } catch (error) { shared.showToast(error?.message || 'No fue posible eliminar la publicación.', 'danger'); } }

            function focusPost(postId, openComments = false) {
                state.pendingFocusPostId = null;
                state.pendingOpenComments = false;
                openPostModal(postId, openComments);
            }

            function toggleComments(postId) { openPostModal(postId, true); }

            function focusCommentComposer(postId) {
                if (state.activePostId !== postId) {
                    openPostModal(postId, true);
                    return;
                }
                setTimeout(() => document.getElementById(`comunidad-comment-input-${postId}`)?.focus(), 80);
            }

            function setReplyTarget(postId, commentId) {
                state.replyTargetByPost[postId] = commentId;
                if (state.activePostId === postId) renderPostModalFooter(postId);
                setTimeout(() => focusCommentComposer(postId), 50);
            }

            function clearReplyTarget(postId) {
                delete state.replyTargetByPost[postId];
                if (state.activePostId === postId) renderPostModalFooter(postId);
            }

            async function submitComment(postId) {
                const input = document.getElementById(`comunidad-comment-input-${postId}`);
                try {
                    await service.createComment(state.ctx, { postId, text: input?.value || '', parentCommentId: state.replyTargetByPost[postId] || null });
                    state.commentDraftByPost[postId] = '';
                    if (input) input.value = '';
                    clearReplyTarget(postId);
                    if (state.activePostId === postId) renderPostModalFooter(postId);
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible enviar el comentario.', 'danger');
                }
            }

            async function toggleReaction(postId) {
                try {
                    const result = await service.toggleReaction(state.ctx, 'post', postId);
                    state.myReactions[postId] = result.active;
                    const target = state.posts.find((item) => item.id === postId);
                    if (target) target.reactionCount = result.count;
                    renderCurrentTab();
                } catch (error) {
                    shared.showToast(error?.message || 'No fue posible registrar tu reacción.', 'danger');
                }
            }

            async function reportPost(postId) {
                state.reportDraft = {
                    postId,
                    reason: REPORT_REASONS[0].value,
                    details: '',
                    busy: false,
                    submitted: false,
                    error: ''
                };
                renderReportModalState();
                state.reportModal?.show();
            }

            function closeReportDialog() {
                state.reportModal?.hide();
            }

            function selectReportReason(reason) {
                const draft = ensureReportDraft();
                draft.reason = REPORT_REASONS.some((item) => item.value === reason) ? reason : REPORT_REASONS[0].value;
                renderReportModalState();
            }

            async function submitReport() {
                const draft = ensureReportDraft();
                const detailsInput = document.getElementById('comunidad-report-details');
                draft.details = detailsInput?.value || '';
                draft.error = '';
                draft.busy = true;
                renderReportModalState();
                try {
                    await service.reportContent(state.ctx, 'post', draft.postId, draft.reason, draft.details || '');
                    draft.submitted = true;
                } catch (error) {
                    draft.error = error?.message || 'No fue posible enviar el reporte.';
                } finally {
                    draft.busy = false;
                    renderReportModalState();
                }
            }

            function openMediaViewer(postId, index = 0) {
                const post = state.posts.find((item) => item.id === postId);
                const items = Array.isArray(post?.media) ? post.media.filter((item) => item?.url) : [];
                if (!items.length) return;
                state.mediaViewer = {
                    postId,
                    items,
                    index: Math.max(0, Math.min(items.length - 1, Number(index) || 0)),
                    zoom: 1
                };
                renderMediaViewer();
                state.mediaModal?.show();
            }

            function closeMediaViewer() {
                state.mediaModal?.hide();
            }

            function zoomMediaViewer(delta = 0, reset = false) {
                if (!state.mediaViewer) return;
                const currentZoom = Number(state.mediaViewer.zoom) || 1;
                state.mediaViewer.zoom = reset ? 1 : Math.max(1, Math.min(3.5, Number((currentZoom + delta).toFixed(2))));
                renderMediaViewer();
            }

            function stepMediaViewer(index) {
                if (!state.mediaViewer?.items?.length) return;
                state.mediaViewer.index = Math.max(0, Math.min(state.mediaViewer.items.length - 1, Number(index) || 0));
                state.mediaViewer.zoom = 1;
                renderMediaViewer();
            }

            function renderMediaViewer() {
                const body = document.getElementById('comunidad-media-modal-body');
                if (!body) return;
                const viewer = state.mediaViewer;
                if (!viewer?.items?.length) {
                    body.innerHTML = '<div class="comunidad-media-plain-stage"><div class="comunidad-media-plain-empty">Sin imagen seleccionada</div></div>';
                    return;
                }
                const current = viewer.items[viewer.index] || viewer.items[0];
                body.innerHTML = `
                    <div class="comunidad-media-plain-stage">
                        <img src="${shared.escapeAttr(current.url)}" alt="${shared.escapeAttr(current.name || 'Imagen de la publicación')}" class="comunidad-media-plain-image">
                    </div>
                `;
            }

            async function sharePost(postId) {
                const link = `${window.location.origin}/comunidad?post=${encodeURIComponent(postId)}`;
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(link);
                        shared.showToast('Enlace copiado.', 'success');
                        return;
                    }
                } catch (_) { }
                window.prompt('Copia este enlace interno', link);
            }

            async function maybeLaunchTutorial() {
                const uid = shared.getUserUid(state.ctx, state.profile);
                if (!uid) return;
                try {
                    if (window.SIA?.getUserPreferences) {
                        const prefs = await window.SIA.getUserPreferences(uid);
                        if (prefs === null) return;
                        if (prefs?.comunidad_tour_v1) return;
                    }
                } catch (_) { return; }
                const key = `sia_comunidad_tour_v1_${uid}`;
                if (localStorage.getItem(key)) return;
                setTimeout(() => launchTutorial(uid, key), 800);
            }

            function replayTutorial() {
                const uid = shared.getUserUid(state.ctx, state.profile);
                if (!uid) return;
                const key = `sia_comunidad_tour_v1_${uid}`;
                localStorage.removeItem(key);
                if (window.SIA?.updateUserPreferences) window.SIA.updateUserPreferences(uid, { comunidad_tour_v1: false }).catch(() => null);
                launchTutorial(uid, key);
            }

            function launchTutorial(uid, key) {
                let tour = document.querySelector('sia-onboarding-tour.comunidad-tour');
                if (!tour) { tour = document.createElement('sia-onboarding-tour'); tour.className = 'comunidad-tour'; document.body.appendChild(tour); }
                const originalSteps = tour._steps;
                const originalComplete = tour._complete;
                const originalSkip = tour._skip;
                tour._steps = [
                    { target: null, title: 'Bienvenido a Comunidad', description: 'Ahora primero exploras lo que pasa en el campus y luego publicas si hace falta.', position: 'center' },
                    { target: '#comunidad-tabbar', title: 'Pestañas claras', description: 'Cambia entre novedades, tendencias y exploración por tipo sin perder el contexto.', position: 'bottom' },
                    { target: '#comunidad-type-chips', title: 'Filtros rápidos', description: 'Usa el tipo y el alcance para enfocar el feed sin ruido.', position: 'bottom' },
                    { target: '#comunidad-quick-publish', title: 'Publicar sin saturar', description: 'Crear una publicación ahora vive en un modal más guiado y más ligero.', position: 'bottom' },
                    { target: '#comunidad-tab-content', title: 'Feed social', description: 'Aquí ves lo nuevo, lo que sube y la exploración organizada por tipo.', position: 'top' }
                ];
                const markDone = async () => {
                    localStorage.setItem(key, 'true');
                    if (window.SIA?.updateUserPreferences) await window.SIA.updateUserPreferences(uid, { comunidad_tour_v1: true });
                };
                const restore = () => { tour._steps = originalSteps; tour._complete = originalComplete; tour._skip = originalSkip; };
                tour._complete = () => { markDone().catch(() => null); restore(); if (originalComplete) originalComplete.call(tour); };
                tour._skip = () => { markDone().catch(() => null); restore(); if (originalSkip) originalSkip.call(tour); };
                requestAnimationFrame(() => tour.start());
            }

            function readRequestedTab() {
                try {
                    const tab = new URLSearchParams(window.location.search).get('tab') || '';
                    return ['novedades', 'tendencias', 'explorar', 'mensajes'].includes(tab) ? tab : 'novedades';
                } catch (_) {
                    return 'novedades';
                }
            }

            function readRequestedPostId() {
                try {
                    return new URLSearchParams(window.location.search).get('post') || null;
                } catch (_) {
                    return null;
                }
            }

            function readRequestedConversationId() {
                try {
                    return new URLSearchParams(window.location.search).get('conversation') || null;
                } catch (_) {
                    return null;
                }
            }

            function maybeFocusRequestedPost() {
                const postId = state.pendingFocusPostId;
                if (!postId) return;
                const post = state.posts.find((item) => item.id === postId);
                if (!post) return;

                state.pendingFocusPostId = null;
                openPostModal(postId, state.pendingOpenComments);
                state.pendingOpenComments = false;
            }

            function maybeOpenRequestedConversation() {
                const conversationId = state.pendingConversationId;
                if (!conversationId) return;
                const exists = state.conversations.find((item) => item.id === conversationId);
                if (!exists) return;
                state.pendingConversationId = null;
                openConversation(conversationId).catch(() => null);
            }
        }

        return { create };
    })();
}
