// modules/admin.cafeteria.js
// Modulo de Cafeteria - Vista Admin (Concesionaria)
// Dashboard, pedidos, productos, resenas, configuracion

if (!window.AdminCafeteria) {
    window.AdminCafeteria = (function () {
        let _ctx = null;
        let _profile = null;
        let _config = null;
        let _productos = [];
        let _unsubPedidos = null;

        let _pedidosLastDoc = null;
        let _pedidosHasMore = true;
        let _pedidosList = [];

        // --- HELPERS ---
        function escapeHtml(text) {
            if (!text) return '';
            return text.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function showToast(msg, type = 'info') {
            if (window.Notify && window.Notify.show) window.Notify.show(msg, type);
            else alert(msg);
        }

        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
        };

        const formatMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

        const STATUS_MAP = {
            pendiente: { label: 'Pendiente', cls: 'warning', icon: 'bi-clock' },
            confirmado: { label: 'Confirmado', cls: 'info', icon: 'bi-check-circle' },
            preparando: { label: 'Preparando', cls: 'primary', icon: 'bi-fire' },
            listo: { label: 'Listo', cls: 'success', icon: 'bi-bag-check' },
            entregado: { label: 'Entregado', cls: 'secondary', icon: 'bi-check2-all' },
            cancelado: { label: 'Cancelado', cls: 'danger', icon: 'bi-x-circle' }
        };
        const TAB_LABELS = Object.freeze({
            '#caf-admin-dashboard': 'Panel',
            '#caf-admin-pedidos': 'Pedidos',
            '#caf-admin-productos': 'Productos',
            '#caf-admin-resenas': 'Resenas',
            '#caf-admin-config': 'Configuracion'
        });

        function statusBadge(estado) {
            const s = STATUS_MAP[estado] || STATUS_MAP.pendiente;
            return `<span class="badge bg-${s.cls}"><i class="bi ${s.icon} me-1"></i>${s.label}</span>`;
        }

        function renderStars(rating, size = '1rem') {
            const full = Math.floor(rating);
            const half = rating - full >= 0.5 ? 1 : 0;
            const empty = 5 - full - half;
            let html = '';
            for (let i = 0; i < full; i++) html += `<i class="bi bi-star-fill text-warning" style="font-size:${size}"></i>`;
            if (half) html += `<i class="bi bi-star-half text-warning" style="font-size:${size}"></i>`;
            for (let i = 0; i < empty; i++) html += `<i class="bi bi-star text-warning" style="font-size:${size}"></i>`;
            return html;
        }

        // ============================================
        //                  INIT
        // ============================================
        async function init(ctx) {
            _ctx = ctx;
            _profile = ctx.profile;
            _pedidosList = [];
            _pedidosLastDoc = null;
            _pedidosHasMore = true;

            // Limpiar listener anterior
            if (_unsubPedidos) { _unsubPedidos(); _unsubPedidos = null; }

            const container = document.getElementById('view-cafeteria');
            if (!container) return;

            container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div><p class="mt-2 text-muted">Cargando panel de administracion...</p></div>';

            try {
                _config = await CafeteriaService.getConfig(_ctx);
                _productos = await CafeteriaService.getProductos(_ctx, { limit: 100 });
            } catch (err) {
                console.error('[AdminCafeteria] Error loading data:', err);
                _config = null;
                _productos = [];
            }

            container.innerHTML = renderLayout();
            bindEvents();
            loadDashboard();
            syncBreadcrumb('#caf-admin-dashboard');
        }

        function syncBreadcrumb(tabTarget) {
            const currentTarget = tabTarget
                || document.querySelector('#caf-admin .nav-link.active')?.dataset.bsTarget
                || '#caf-admin-dashboard';
            const label = TAB_LABELS[currentTarget] || TAB_LABELS['#caf-admin-dashboard'];
            window.SIA?.setBreadcrumbSection?.('view-cafeteria', label, { moduleClickable: false });
        }

        // ============================================
        //                LAYOUT
        // ============================================
        function renderLayout() {
            const nombre = escapeHtml(_config?.nombre || 'Cafeteria');

            return `
            <style>
                #caf-admin { --caf: #f97316; --caf-light: #fb923c; --caf-dark: #ea580c; }
                #caf-admin .caf-hero { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 1rem; color: #fff; }
                #caf-admin .nav-pills .nav-link.active { background: var(--caf); color: #fff; }
                #caf-admin .nav-pills .nav-link { color: var(--caf-dark); font-weight: 500; }
                #caf-admin .stat-card { border: none; border-radius: 1rem; }
                #caf-admin .stat-card .stat-value { font-size: 1.8rem; font-weight: 700; }
                #caf-admin .caf-order-card { border-left: 4px solid var(--caf); }
            </style>
            <div id="caf-admin">
                <!-- HERO -->
                <div class="caf-hero p-4 mb-4">
                    <span class="badge mb-2" style="background:rgba(249,115,22,.3)"><i class="bi bi-cup-hot-fill me-1"></i>Admin Cafeteria</span>
                    <h2 class="fw-bold mb-1">${nombre}</h2>
                    <p class="mb-0 opacity-75">Panel de administracion de la cafeteria</p>
                </div>

                <!-- TABS -->
                <ul class="nav nav-pills nav-fill p-1 bg-light rounded-pill mb-4" role="tablist">
                    <li class="nav-item"><button class="nav-link active rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-admin-dashboard"><i class="bi bi-speedometer2 me-1"></i>Panel</button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-admin-pedidos"><i class="bi bi-receipt me-1"></i>Pedidos</button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-admin-productos"><i class="bi bi-box me-1"></i>Productos</button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-admin-resenas"><i class="bi bi-star me-1"></i>Reseñas</button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-admin-config"><i class="bi bi-gear me-1"></i>Config</button></li>
                </ul>

                <div class="tab-content">
                    <!-- DASHBOARD -->
                    <div class="tab-pane fade show active" id="caf-admin-dashboard">
                        <div id="caf-stats-row" class="row g-3 mb-4"></div>
                        <h5 class="fw-bold mb-3"><i class="bi bi-broadcast me-2 text-danger"></i>Pedidos Activos</h5>
                        <div id="caf-realtime-feed"></div>
                    </div>

                    <!-- PEDIDOS -->
                    <div class="tab-pane fade" id="caf-admin-pedidos">
                        <div class="d-flex gap-2 mb-3 flex-wrap">
                            <select id="caf-pedidos-filter" class="form-select form-select-sm" style="max-width:200px">
                                <option value="todos">Todos</option>
                                <option value="pendiente">Pendientes</option>
                                <option value="confirmado">Confirmados</option>
                                <option value="preparando">Preparando</option>
                                <option value="listo">Listos</option>
                                <option value="entregado">Entregados</option>
                                <option value="cancelado">Cancelados</option>
                            </select>
                            <button class="btn btn-sm btn-outline-secondary" onclick="AdminCafeteria.loadPedidosAdmin(true)"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                        <div id="caf-admin-pedidos-list"></div>
                    </div>

                    <!-- PRODUCTOS -->
                    <div class="tab-pane fade" id="caf-admin-productos">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="fw-bold mb-0">Menu de Productos</h5>
                            <button class="btn btn-sm text-white rounded-pill px-3" style="background:#f97316" onclick="AdminCafeteria.openProductoModal()">
                                <i class="bi bi-plus-lg me-1"></i>Nuevo Producto
                            </button>
                        </div>
                        <div id="caf-admin-productos-list"></div>
                    </div>

                    <!-- RESENAS -->
                    <div class="tab-pane fade" id="caf-admin-resenas">
                        <h5 class="fw-bold mb-3">Reseñas</h5>
                        <div id="caf-admin-resenas-list"></div>
                    </div>

                    <!-- CONFIGURACION -->
                    <div class="tab-pane fade" id="caf-admin-config">
                        <h5 class="fw-bold mb-3">Configuracion de la Cafeteria</h5>
                        <div id="caf-config-form"></div>
                    </div>
                </div>
            </div>

            <!-- MODAL: Producto -->
            <div class="modal fade" id="caf-modal-edit-producto" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content" id="caf-modal-edit-producto-content"></div>
                </div>
            </div>

            <!-- MODAL: Responder Pedido -->
            <div class="modal fade" id="caf-modal-responder" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header border-0">
                            <h5 class="modal-title fw-bold">Responder Pedido</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="caf-responder-pedidoId">
                            <input type="hidden" id="caf-responder-estado">
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Mensaje predefinido</label>
                                <select id="caf-responder-preset" class="form-select" onchange="document.getElementById('caf-responder-msg').value = this.value">
                                    <option value="">-- Seleccionar --</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Mensaje personalizado</label>
                                <textarea id="caf-responder-msg" class="form-control" rows="3" maxlength="300"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn text-white" style="background:#f97316" onclick="AdminCafeteria.submitResponder()">Enviar</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        // ============================================
        //                BIND EVENTS
        // ============================================
        function bindEvents() {
            document.querySelectorAll('#caf-admin .nav-link[data-bs-target]').forEach((btn) => {
                btn.addEventListener('shown.bs.tab', () => syncBreadcrumb(btn.dataset.bsTarget));
            });

            // Tab listeners
            const pedidosTab = document.querySelector('[data-bs-target="#caf-admin-pedidos"]');
            if (pedidosTab) pedidosTab.addEventListener('shown.bs.tab', () => loadPedidosAdmin(true));

            const productosTab = document.querySelector('[data-bs-target="#caf-admin-productos"]');
            if (productosTab) productosTab.addEventListener('shown.bs.tab', () => renderProductosList());

            const resenasTab = document.querySelector('[data-bs-target="#caf-admin-resenas"]');
            if (resenasTab) resenasTab.addEventListener('shown.bs.tab', () => loadResenasAdmin());

            const configTab = document.querySelector('[data-bs-target="#caf-admin-config"]');
            if (configTab) configTab.addEventListener('shown.bs.tab', () => renderConfigForm());

            // Filter change
            const filter = document.getElementById('caf-pedidos-filter');
            if (filter) filter.addEventListener('change', () => loadPedidosAdmin(true));
        }

        // ============================================
        //                DASHBOARD
        // ============================================
        async function loadDashboard() {
            const statsRow = document.getElementById('caf-stats-row');
            if (!statsRow) return;

            try {
                const stats = await CafeteriaService.getStats(_ctx);
                statsRow.innerHTML = `
                    <div class="col-6 col-md-3"><div class="card stat-card shadow-sm p-3 text-center"><div class="stat-value text-primary">${stats.pedidosHoy}</div><small class="text-muted">Pedidos hoy</small></div></div>
                    <div class="col-6 col-md-3"><div class="card stat-card shadow-sm p-3 text-center"><div class="stat-value" style="color:#f97316">${formatMoney(stats.ingresosHoy)}</div><small class="text-muted">Ingresos hoy</small></div></div>
                    <div class="col-6 col-md-3"><div class="card stat-card shadow-sm p-3 text-center"><div class="stat-value text-warning">${stats.pendientes}</div><small class="text-muted">Pendientes</small></div></div>
                    <div class="col-6 col-md-3"><div class="card stat-card shadow-sm p-3 text-center"><div class="stat-value text-success">${renderStars(stats.ratingPromedio, '1.2rem')}</div><small class="text-muted">${stats.ratingPromedio}/5 (${stats.totalResenas})</small></div></div>`;
            } catch (err) {
                console.error('[AdminCafeteria] Stats error:', err);
                statsRow.innerHTML = '<div class="col-12"><div class="alert alert-warning">Error al cargar estadisticas</div></div>';
            }

            // Real-time feed
            startRealtimeFeed();
        }

        function startRealtimeFeed() {
            const feed = document.getElementById('caf-realtime-feed');
            if (!feed) return;
            feed.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></div>';

            if (_unsubPedidos) _unsubPedidos();

            _unsubPedidos = CafeteriaService.onPedidosRealtime(_ctx, { estadoActivos: true, limit: 30 }, (pedidos) => {
                if (!pedidos.length) {
                    feed.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-inbox" style="font-size:2rem"></i><p class="mt-2">Sin pedidos activos</p></div>';
                    return;
                }
                feed.innerHTML = pedidos.map(p => renderPedidoCard(p, true)).join('');
            });

            _ctx.ModuleManager.addSubscription(_unsubPedidos);
        }

        // ============================================
        //           PEDIDOS ADMIN
        // ============================================
        async function loadPedidosAdmin(reset = false) {
            if (reset) {
                _pedidosList = [];
                _pedidosLastDoc = null;
                _pedidosHasMore = true;
            }

            const container = document.getElementById('caf-admin-pedidos-list');
            if (!container) return;

            if (!_pedidosList.length) {
                container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></div>';
            }

            const filtro = document.getElementById('caf-pedidos-filter')?.value || 'todos';

            try {
                const nuevos = await CafeteriaService.getAllPedidos(_ctx, { estado: filtro }, {
                    limit: 30,
                    lastDoc: _pedidosLastDoc
                });
                _pedidosList.push(...nuevos);
                _pedidosHasMore = nuevos.length === 30;
                if (nuevos.length) _pedidosLastDoc = nuevos[nuevos.length - 1]._doc;
            } catch (err) {
                console.error('[AdminCafeteria] Error loading pedidos:', err);
            }

            if (!_pedidosList.length) {
                container.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-receipt" style="font-size:2rem"></i><p class="mt-2">Sin pedidos</p></div>';
                return;
            }

            container.innerHTML = _pedidosList.map(p => renderPedidoCard(p, false)).join('');
            if (_pedidosHasMore) {
                container.innerHTML += `<button class="btn btn-outline-secondary w-100 rounded-pill mt-2" onclick="AdminCafeteria.loadMorePedidos()">Cargar mas</button>`;
            }
        }

        function loadMorePedidos() { loadPedidosAdmin(false); }

        function renderPedidoCard(p, isRealtime) {
            const statusActions = [];
            if (p.estado === 'pendiente') statusActions.push({ estado: 'confirmado', label: 'Confirmar', cls: 'info' }, { estado: 'cancelado', label: 'Cancelar', cls: 'danger' });
            if (p.estado === 'confirmado') statusActions.push({ estado: 'preparando', label: 'Preparando', cls: 'primary' });
            if (p.estado === 'preparando') statusActions.push({ estado: 'listo', label: 'Listo!', cls: 'success' });
            if (p.estado === 'listo') statusActions.push({ estado: 'entregado', label: 'Entregado', cls: 'secondary' });

            return `
                <div class="card caf-order-card shadow-sm mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h6 class="fw-bold mb-0">${escapeHtml(p.userName)}</h6>
                                <small class="text-muted">${escapeHtml(p.matricula || p.userEmail)} | ${formatDate(p.createdAt)}</small>
                            </div>
                            ${statusBadge(p.estado)}
                        </div>
                        <div class="mb-2">
                            ${(p.items || []).map(i =>
                                `<div class="d-flex justify-content-between"><span>${escapeHtml(i.titulo)} x${i.cantidad}</span><span>${formatMoney(i.subtotal)}</span></div>`
                            ).join('')}
                        </div>
                        <hr class="my-2">
                        <div class="d-flex justify-content-between fw-bold mb-2">
                            <span>Total</span><span style="color:#f97316">${formatMoney(p.total)}</span>
                        </div>
                        ${p.metodoPago === 'transferencia' ? `
                            <div class="d-flex align-items-center gap-2 mb-2">
                                <small class="text-muted"><i class="bi bi-bank me-1"></i>Transferencia ${p.pagoConfirmado ? '<span class="text-success">(Confirmado)</span>' : ''}</small>
                                ${p.comprobanteUrl ? `<a href="${escapeHtml(p.comprobanteUrl)}" target="_blank" class="btn btn-sm btn-outline-info"><i class="bi bi-image me-1"></i>Ver comprobante</a>` : ''}
                            </div>` : ''}
                        ${p.nota ? `<div class="alert alert-light py-1 px-2 mb-2"><small><i class="bi bi-chat-left me-1"></i>${escapeHtml(p.nota)}</small></div>` : ''}
                        ${p.respuestaAdmin ? `<div class="alert alert-info py-1 px-2 mb-2"><small><i class="bi bi-reply me-1"></i>${escapeHtml(p.respuestaAdmin)}</small></div>` : ''}
                        <div class="d-flex gap-2 flex-wrap">
                            ${statusActions.map(a =>
                                `<button class="btn btn-sm btn-${a.cls}" onclick="AdminCafeteria.updatePedidoStatus('${p.id}', '${a.estado}')">${a.label}</button>`
                            ).join('')}
                            <button class="btn btn-sm btn-outline-secondary" onclick="AdminCafeteria.openResponder('${p.id}', '${p.estado}')"><i class="bi bi-chat-dots me-1"></i>Responder</button>
                        </div>
                    </div>
                </div>`;
        }

        async function updatePedidoStatus(pedidoId, nuevoEstado) {
            try {
                await CafeteriaService.updatePedidoStatus(_ctx, pedidoId, nuevoEstado);
                showToast(`Pedido actualizado a: ${STATUS_MAP[nuevoEstado]?.label || nuevoEstado}`, 'success');
                loadPedidosAdmin(true);
            } catch (err) {
                showToast('Error al actualizar pedido', 'danger');
            }
        }

        function openResponder(pedidoId, estadoActual) {
            document.getElementById('caf-responder-pedidoId').value = pedidoId;
            document.getElementById('caf-responder-estado').value = estadoActual;
            document.getElementById('caf-responder-msg').value = '';

            // Llenar presets
            const select = document.getElementById('caf-responder-preset');
            const mensajes = _config?.mensajesPredefinidos || [
                'Tu pedido esta listo para recoger.',
                'Estamos preparando tu pedido.',
                'Producto agotado, contactanos para cambiar tu pedido.'
            ];
            select.innerHTML = '<option value="">-- Seleccionar --</option>' +
                mensajes.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');

            new bootstrap.Modal(document.getElementById('caf-modal-responder')).show();
        }

        async function submitResponder() {
            const pedidoId = document.getElementById('caf-responder-pedidoId').value;
            const estado = document.getElementById('caf-responder-estado').value;
            const msg = document.getElementById('caf-responder-msg').value.trim();

            if (!msg) return showToast('Escribe un mensaje', 'warning');

            try {
                await CafeteriaService.updatePedidoStatus(_ctx, pedidoId, estado, msg);
                bootstrap.Modal.getInstance(document.getElementById('caf-modal-responder'))?.hide();
                showToast('Respuesta enviada', 'success');
                loadPedidosAdmin(true);
            } catch (err) {
                showToast('Error al enviar respuesta', 'danger');
            }
        }

        // ============================================
        //           PRODUCTOS ADMIN
        // ============================================
        function renderProductosList() {
            const container = document.getElementById('caf-admin-productos-list');
            if (!container) return;

            if (!_productos.length) {
                container.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-box" style="font-size:2rem"></i><p class="mt-2">Sin productos. Agrega el primer producto al menu.</p></div>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Producto</th>
                                <th>Precio</th>
                                <th>Categoria</th>
                                <th>Tiempo</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${_productos.map(p => `
                                <tr class="${!p.disponible ? 'table-secondary' : ''}">
                                    <td>
                                        <div class="d-flex align-items-center gap-2">
                                            ${p.fotoUrl
                                                ? `<img src="${escapeHtml(p.fotoUrl)}" class="rounded" style="width:40px;height:40px;object-fit:cover">`
                                                : `<div class="rounded bg-light d-flex align-items-center justify-content-center" style="width:40px;height:40px"><i class="bi bi-cup-hot text-muted"></i></div>`
                                            }
                                            <div>
                                                <strong>${escapeHtml(p.titulo)}</strong>
                                                ${p.totalResenas > 0 ? `<br><small>${renderStars(p.promedioResenas, '.7rem')} (${p.totalResenas})</small>` : ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="fw-bold" style="color:#f97316">${formatMoney(p.precio)}</td>
                                    <td><span class="badge bg-light text-dark">${escapeHtml(p.categoria || '-')}</span></td>
                                    <td>${p.tiempoPreparacion > 0 ? p.tiempoPreparacion + ' min' : 'Listo'}</td>
                                    <td>
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" ${p.disponible ? 'checked' : ''}
                                                onchange="AdminCafeteria.toggleDisponible('${p.id}', this.checked)">
                                        </div>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary me-1" onclick="AdminCafeteria.openProductoModal('${p.id}')"><i class="bi bi-pencil"></i></button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="AdminCafeteria.deleteProducto('${p.id}', '${escapeHtml(p.titulo)}')"><i class="bi bi-trash3"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        async function toggleDisponible(productoId, disponible) {
            try {
                await CafeteriaService.updateProducto(_ctx, productoId, { disponible });
                const p = _productos.find(x => x.id === productoId);
                if (p) p.disponible = disponible;
                showToast(disponible ? 'Producto activado' : 'Producto desactivado', 'success');
            } catch (err) {
                showToast('Error al actualizar', 'danger');
            }
        }

        function openProductoModal(productoId) {
            const modal = document.getElementById('caf-modal-edit-producto-content');
            if (!modal) return;

            const p = productoId ? _productos.find(x => x.id === productoId) : null;
            const isEdit = !!p;
            const categorias = _config?.categorias || ['Desayuno', 'Comida', 'Snacks', 'Bebidas', 'Postres'];

            modal.innerHTML = `
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-bold">${isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="caf-prod-id" value="${productoId || ''}">
                    <div class="row g-3">
                        <div class="col-12">
                            <label class="form-label fw-semibold">Titulo *</label>
                            <input type="text" id="caf-prod-titulo" class="form-control" value="${escapeHtml(p?.titulo || '')}" maxlength="100" required>
                        </div>
                        <div class="col-12">
                            <label class="form-label fw-semibold">Descripcion</label>
                            <textarea id="caf-prod-desc" class="form-control" rows="2" maxlength="500">${escapeHtml(p?.descripcion || '')}</textarea>
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-semibold">Precio *</label>
                            <input type="number" id="caf-prod-precio" class="form-control" value="${p?.precio || ''}" min="0" step="0.5">
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-semibold">Categoria</label>
                            <select id="caf-prod-categoria" class="form-select">
                                ${categorias.map(c => `<option value="${escapeHtml(c)}" ${p?.categoria === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-semibold">Cantidad / Peso</label>
                            <input type="text" id="caf-prod-peso" class="form-control" value="${escapeHtml(p?.cantidadPeso || '')}" placeholder="Ej: 250g, 1 pieza">
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-semibold">Tiempo prep. (min)</label>
                            <input type="number" id="caf-prod-tiempo" class="form-control" value="${p?.tiempoPreparacion || 0}" min="0">
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-semibold">Stock (-1 = ilimitado)</label>
                            <input type="number" id="caf-prod-stock" class="form-control" value="${p?.stock != null ? p.stock : -1}" min="-1">
                        </div>
                        <div class="col-6">
                            <label class="form-label fw-semibold">Orden</label>
                            <input type="number" id="caf-prod-orden" class="form-control" value="${p?.orden || 0}" min="0">
                        </div>
                        <div class="col-12">
                            <label class="form-label fw-semibold">Foto del producto</label>
                            <div class="d-flex gap-2 align-items-center mb-2">
                                <input type="file" id="caf-prod-foto-file" class="form-control form-control-sm" accept="image/*" capture="environment">
                            </div>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">URL</span>
                                <input type="text" id="caf-prod-foto-url" class="form-control" value="${escapeHtml(p?.fotoUrl || '')}" placeholder="O pega una URL de imagen">
                            </div>
                            ${p?.fotoUrl ? `<img src="${escapeHtml(p.fotoUrl)}" class="rounded mt-2" style="max-height:100px">` : ''}
                        </div>
                        <div class="col-12">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="caf-prod-disponible" ${p?.disponible !== false ? 'checked' : ''}>
                                <label class="form-check-label" for="caf-prod-disponible">Disponible</label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button class="btn text-white" style="background:#f97316" id="caf-prod-save-btn" onclick="AdminCafeteria.saveProducto()">
                        <i class="bi bi-check-lg me-1"></i>${isEdit ? 'Guardar Cambios' : 'Crear Producto'}
                    </button>
                </div>`;

            new bootstrap.Modal(document.getElementById('caf-modal-edit-producto')).show();
        }

        async function saveProducto() {
            const btn = document.getElementById('caf-prod-save-btn');
            const id = document.getElementById('caf-prod-id').value;
            const titulo = document.getElementById('caf-prod-titulo').value.trim();
            const precio = parseFloat(document.getElementById('caf-prod-precio').value);

            if (!titulo) return showToast('El titulo es obligatorio', 'warning');
            if (isNaN(precio) || precio < 0) return showToast('El precio no es valido', 'warning');

            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'; }

            try {
                // Handle foto
                let fotoUrl = document.getElementById('caf-prod-foto-url').value.trim();
                const fotoFile = document.getElementById('caf-prod-foto-file')?.files?.[0];
                if (fotoFile) {
                    fotoUrl = await CafeteriaService.uploadProductoFoto(_ctx, fotoFile);
                }

                const data = {
                    titulo,
                    descripcion: document.getElementById('caf-prod-desc').value.trim(),
                    precio,
                    categoria: document.getElementById('caf-prod-categoria').value,
                    cantidadPeso: document.getElementById('caf-prod-peso').value.trim(),
                    tiempoPreparacion: parseInt(document.getElementById('caf-prod-tiempo').value) || 0,
                    stock: parseInt(document.getElementById('caf-prod-stock').value),
                    orden: parseInt(document.getElementById('caf-prod-orden').value) || 0,
                    fotoUrl,
                    disponible: document.getElementById('caf-prod-disponible').checked
                };

                if (id) {
                    await CafeteriaService.updateProducto(_ctx, id, data);
                    showToast('Producto actualizado', 'success');
                } else {
                    await CafeteriaService.createProducto(_ctx, data);
                    showToast('Producto creado', 'success');
                }

                bootstrap.Modal.getInstance(document.getElementById('caf-modal-edit-producto'))?.hide();
                // Refresh list
                _productos = await CafeteriaService.getProductos(_ctx, { limit: 100 });
                renderProductosList();
            } catch (err) {
                console.error('[AdminCafeteria] Save producto error:', err);
                showToast('Error al guardar producto: ' + err.message, 'danger');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Guardar'; }
            }
        }

        async function deleteProducto(productoId, titulo) {
            if (!confirm(`Eliminar "${titulo}"? Esta accion no se puede deshacer.`)) return;
            try {
                await CafeteriaService.deleteProducto(_ctx, productoId);
                _productos = _productos.filter(p => p.id !== productoId);
                renderProductosList();
                showToast('Producto eliminado', 'success');
            } catch (err) {
                showToast('Error al eliminar', 'danger');
            }
        }

        // ============================================
        //           RESENAS ADMIN
        // ============================================
        async function loadResenasAdmin() {
            const container = document.getElementById('caf-admin-resenas-list');
            if (!container) return;

            container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></div>';

            try {
                const resenas = await CafeteriaService.getAllResenas(_ctx, { limit: 50 });

                if (!resenas.length) {
                    container.innerHTML = '<p class="text-muted text-center py-3">Sin resenas aun</p>';
                    return;
                }

                container.innerHTML = resenas.map(r => `
                    <div class="card shadow-sm mb-2 ${!r.visible ? 'border-danger' : ''}">
                        <div class="card-body py-2 px-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <div>
                                    <strong style="font-size:.9rem">${escapeHtml(r.userName)}</strong>
                                    <span class="badge bg-light text-dark ms-2">${escapeHtml(r.tipo)}</span>
                                    ${r.productoTitulo ? `<small class="text-muted ms-1">${escapeHtml(r.productoTitulo)}</small>` : ''}
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <small class="text-muted">${formatDate(r.createdAt)}</small>
                                    <div class="form-check form-switch mb-0">
                                        <input class="form-check-input" type="checkbox" ${r.visible ? 'checked' : ''}
                                            onchange="AdminCafeteria.toggleResena('${r.id}', this.checked)" title="Visibilidad">
                                    </div>
                                </div>
                            </div>
                            <div class="mb-1">${renderStars(r.rating, '.85rem')}</div>
                            ${r.comentario ? `<p class="mb-0 text-muted" style="font-size:.9rem">${escapeHtml(r.comentario)}</p>` : ''}
                            ${!r.visible ? '<small class="text-danger"><i class="bi bi-eye-slash me-1"></i>Oculta</small>' : ''}
                        </div>
                    </div>
                `).join('');
            } catch (err) {
                console.error('[AdminCafeteria] Resenas error:', err);
                container.innerHTML = '<p class="text-danger">Error al cargar resenas</p>';
            }
        }

        async function toggleResena(resenaId, visible) {
            try {
                await CafeteriaService.toggleResenaVisibility(_ctx, resenaId, visible);
                showToast(visible ? 'Resena visible' : 'Resena oculta', 'success');
            } catch (err) {
                showToast('Error al actualizar resena', 'danger');
            }
        }

        // ============================================
        //           CONFIGURACION
        // ============================================
        function renderConfigForm() {
            const container = document.getElementById('caf-config-form');
            if (!container) return;

            const c = _config || {};
            const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
            const horario = c.horario || {};
            const pago = c.pagoTransferencia || {};
            const mensajes = c.mensajesPredefinidos || [];
            const categorias = c.categorias || ['Desayuno', 'Comida', 'Snacks', 'Bebidas', 'Postres'];

            container.innerHTML = `
                <div class="row g-4">
                    <!-- Info general -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="fw-bold mb-3"><i class="bi bi-info-circle me-2"></i>Informacion General</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Nombre de la Cafeteria</label>
                                        <input type="text" id="cfg-nombre" class="form-control" value="${escapeHtml(c.nombre || '')}" maxlength="60">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Logo (URL)</label>
                                        <input type="text" id="cfg-logo" class="form-control" value="${escapeHtml(c.logo || '')}" placeholder="URL de logo">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Descripcion</label>
                                        <textarea id="cfg-desc" class="form-control" rows="2" maxlength="200">${escapeHtml(c.descripcion || '')}</textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Horario -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="fw-bold mb-3"><i class="bi bi-clock me-2"></i>Horario</h6>
                                ${dias.map(d => {
                                    const h = horario[d] || { abre: '07:00', cierra: '15:00', activo: d !== 'sabado' && d !== 'domingo' };
                                    return `
                                    <div class="row align-items-center mb-2 g-2">
                                        <div class="col-3 col-md-2"><strong class="text-capitalize">${d}</strong></div>
                                        <div class="col-2 col-md-1">
                                            <div class="form-check form-switch">
                                                <input class="form-check-input cfg-dia-activo" type="checkbox" data-dia="${d}" ${h.activo ? 'checked' : ''}>
                                            </div>
                                        </div>
                                        <div class="col-3 col-md-2"><input type="time" class="form-control form-control-sm cfg-dia-abre" data-dia="${d}" value="${h.abre || '07:00'}"></div>
                                        <div class="col-1 text-center">-</div>
                                        <div class="col-3 col-md-2"><input type="time" class="form-control form-control-sm cfg-dia-cierra" data-dia="${d}" value="${h.cierra || '15:00'}"></div>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Pago Transferencia -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="fw-bold mb-3"><i class="bi bi-bank me-2"></i>Pago por Transferencia</h6>
                                <div class="form-check form-switch mb-3">
                                    <input class="form-check-input" type="checkbox" id="cfg-pago-activo" ${pago.activo ? 'checked' : ''}>
                                    <label class="form-check-label" for="cfg-pago-activo">Habilitar pago por transferencia</label>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-6"><label class="form-label">Banco</label><input type="text" id="cfg-pago-banco" class="form-control" value="${escapeHtml(pago.banco || '')}"></div>
                                    <div class="col-md-6"><label class="form-label">Titular</label><input type="text" id="cfg-pago-titular" class="form-control" value="${escapeHtml(pago.titular || '')}"></div>
                                    <div class="col-md-6"><label class="form-label">CLABE</label><input type="text" id="cfg-pago-clabe" class="form-control" value="${escapeHtml(pago.clabe || '')}" maxlength="20"></div>
                                    <div class="col-md-6"><label class="form-label">Referencia</label><input type="text" id="cfg-pago-referencia" class="form-control" value="${escapeHtml(pago.referencia || '')}"></div>
                                    <div class="col-12"><label class="form-label">Instrucciones</label><textarea id="cfg-pago-instrucciones" class="form-control" rows="2">${escapeHtml(pago.instrucciones || '')}</textarea></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Categorias -->
                    <div class="col-md-6">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="fw-bold mb-3"><i class="bi bi-tags me-2"></i>Categorias</h6>
                                <div id="cfg-categorias-list" class="d-flex flex-wrap gap-2 mb-2">
                                    ${categorias.map(c => `<span class="badge bg-light text-dark border px-2 py-1">${escapeHtml(c)} <button class="btn-close btn-close-sm ms-1" onclick="this.parentElement.remove()"></button></span>`).join('')}
                                </div>
                                <div class="input-group input-group-sm">
                                    <input type="text" id="cfg-cat-new" class="form-control" placeholder="Nueva categoria" maxlength="30">
                                    <button class="btn btn-outline-secondary" onclick="AdminCafeteria.addCategoria()"><i class="bi bi-plus"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Mensajes Predefinidos -->
                    <div class="col-md-6">
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h6 class="fw-bold mb-3"><i class="bi bi-chat-dots me-2"></i>Mensajes Predefinidos</h6>
                                <div id="cfg-mensajes-list" class="mb-2">
                                    ${mensajes.map(m => `<div class="d-flex align-items-center gap-2 mb-1"><span class="flex-grow-1 small">${escapeHtml(m)}</span><button class="btn btn-sm text-danger p-0" onclick="this.parentElement.remove()"><i class="bi bi-x-lg"></i></button></div>`).join('')}
                                </div>
                                <div class="input-group input-group-sm">
                                    <input type="text" id="cfg-msg-new" class="form-control" placeholder="Nuevo mensaje" maxlength="200">
                                    <button class="btn btn-outline-secondary" onclick="AdminCafeteria.addMensaje()"><i class="bi bi-plus"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Guardar -->
                    <div class="col-12">
                        <button id="cfg-save-btn" class="btn text-white w-100 py-2 fw-bold rounded-pill" style="background:#f97316" onclick="AdminCafeteria.saveConfig()">
                            <i class="bi bi-check-lg me-2"></i>Guardar Configuracion
                        </button>
                    </div>
                </div>`;
        }

        function addCategoria() {
            const input = document.getElementById('cfg-cat-new');
            const val = input?.value.trim();
            if (!val) return;
            const list = document.getElementById('cfg-categorias-list');
            if (list) {
                list.innerHTML += `<span class="badge bg-light text-dark border px-2 py-1">${escapeHtml(val)} <button class="btn-close btn-close-sm ms-1" onclick="this.parentElement.remove()"></button></span>`;
            }
            input.value = '';
        }

        function addMensaje() {
            const input = document.getElementById('cfg-msg-new');
            const val = input?.value.trim();
            if (!val) return;
            const list = document.getElementById('cfg-mensajes-list');
            if (list) {
                list.innerHTML += `<div class="d-flex align-items-center gap-2 mb-1"><span class="flex-grow-1 small">${escapeHtml(val)}</span><button class="btn btn-sm text-danger p-0" onclick="this.parentElement.remove()"><i class="bi bi-x-lg"></i></button></div>`;
            }
            input.value = '';
        }

        async function saveConfig() {
            const btn = document.getElementById('cfg-save-btn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'; }

            try {
                const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
                const horario = {};
                dias.forEach(d => {
                    const activo = document.querySelector(`.cfg-dia-activo[data-dia="${d}"]`)?.checked || false;
                    const abre = document.querySelector(`.cfg-dia-abre[data-dia="${d}"]`)?.value || '07:00';
                    const cierra = document.querySelector(`.cfg-dia-cierra[data-dia="${d}"]`)?.value || '15:00';
                    horario[d] = { activo, abre, cierra };
                });

                // Recoger categorias del DOM
                const catEls = document.querySelectorAll('#cfg-categorias-list .badge');
                const categorias = Array.from(catEls).map(el => {
                    // Get text without the X button text
                    return el.childNodes[0].textContent.trim();
                });

                // Recoger mensajes del DOM
                const msgEls = document.querySelectorAll('#cfg-mensajes-list > div');
                const mensajesPredefinidos = Array.from(msgEls).map(el => {
                    return el.querySelector('span')?.textContent.trim() || '';
                }).filter(Boolean);

                const data = {
                    nombre: document.getElementById('cfg-nombre').value.trim(),
                    logo: document.getElementById('cfg-logo').value.trim(),
                    descripcion: document.getElementById('cfg-desc').value.trim(),
                    horario,
                    pagoTransferencia: {
                        activo: document.getElementById('cfg-pago-activo').checked,
                        banco: document.getElementById('cfg-pago-banco').value.trim(),
                        titular: document.getElementById('cfg-pago-titular').value.trim(),
                        clabe: document.getElementById('cfg-pago-clabe').value.trim(),
                        referencia: document.getElementById('cfg-pago-referencia').value.trim(),
                        instrucciones: document.getElementById('cfg-pago-instrucciones').value.trim()
                    },
                    categorias,
                    mensajesPredefinidos
                };

                await CafeteriaService.updateConfig(_ctx, data);
                _config = { ..._config, ...data };
                showToast('Configuracion guardada', 'success');
            } catch (err) {
                console.error('[AdminCafeteria] Save config error:', err);
                showToast('Error al guardar: ' + err.message, 'danger');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Guardar Configuracion'; }
            }
        }

        // ============================================
        //                PUBLIC API
        // ============================================
        return {
            init,
            // Pedidos
            loadPedidosAdmin,
            loadMorePedidos,
            updatePedidoStatus,
            openResponder,
            submitResponder,
            // Productos
            openProductoModal,
            saveProducto,
            deleteProducto,
            toggleDisponible,
            // Resenas
            toggleResena,
            // Config
            addCategoria,
            addMensaje,
            saveConfig
        };
    })();
}
