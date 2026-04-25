// modules/cafeteria.js
// Modulo de Cafeteria - Vista Estudiante
// Menu, carrito, pedidos, resenas y seguimiento en tiempo real

if (!window.Cafeteria) {
    window.Cafeteria = (function () {
        let _ctx = null;
        let _profile = null;
        let _config = null;
        let _productos = [];
        let _categoriaActiva = 'Todos';
        let _busqueda = '';
        let _ordenamiento = 'default'; // default | az | precio_asc | precio_desc | rating
        let _pedidosLastDoc = null;
        let _pedidosHasMore = true;
        let _pedidosList = [];
        let _pedidosActivos = [];

        const CART_KEY = 'sia_cafeteria_cart';
        const NOTE_KEY = 'sia_cafeteria_last_note';
        const TAB_LABELS = Object.freeze({
            '#caf-tab-menu': 'Menu',
            '#caf-tab-carrito': 'Carrito',
            '#caf-tab-pedidos': 'Pedidos',
            '#caf-tab-resenas': 'Resenas'
        });

        // --- HELPERS ---
        function escapeHtml(t) {
            if (!t) return '';
            return t.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }
        function showToast(msg, type = 'info') { window.Notify?.show(msg, type) || alert(msg); }
        const formatMoney = n => `$${(Number(n) || 0).toFixed(2)}`;
        function timeAgo(date) {
            if (!date) return '';
            const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
            if (diff < 1) return 'Ahora mismo';
            if (diff < 60) return `Hace ${diff} min`;
            const h = Math.floor(diff / 60);
            return `Hace ${h}h ${diff % 60}min`;
        }
        function formatDate(date) {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        }
        function renderStars(r, size = '1rem') {
            const full = Math.floor(r), half = r - full >= 0.5 ? 1 : 0, empty = 5 - full - half;
            let h = '';
            for (let i = 0; i < full; i++) h += `<i class="bi bi-star-fill text-warning" style="font-size:${size}"></i>`;
            if (half) h += `<i class="bi bi-star-half text-warning" style="font-size:${size}"></i>`;
            for (let i = 0; i < empty; i++) h += `<i class="bi bi-star text-warning" style="font-size:${size}"></i>`;
            return h;
        }
        const STATUS_MAP = {
            pendiente: { label: 'Pendiente', cls: 'warning', icon: 'bi-clock', step: 0 },
            confirmado: { label: 'Confirmado', cls: 'info', icon: 'bi-check-circle', step: 1 },
            preparando: { label: 'Preparando', cls: 'primary', icon: 'bi-fire', step: 2 },
            listo: { label: 'Listo', cls: 'success', icon: 'bi-bag-check', step: 3 },
            entregado: { label: 'Entregado', cls: 'secondary', icon: 'bi-check2-all', step: 4 },
            cancelado: { label: 'Cancelado', cls: 'danger', icon: 'bi-x-circle', step: -1 }
        };
        function statusBadge(e) {
            const s = STATUS_MAP[e] || STATUS_MAP.pendiente;
            return `<span class="badge bg-${s.cls}"><i class="bi ${s.icon} me-1"></i>${s.label}</span>`;
        }

        // --- CARRITO ---
        function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}').items || []; } catch { return []; } }
        function saveCart(items) { localStorage.setItem(CART_KEY, JSON.stringify({ items, updatedAt: Date.now() })); updateCartBadge(); updateFab(); }
        function addToCart(producto) {
            const items = getCart();
            const ex = items.find(i => i.productoId === producto.id);
            const stockMax = producto.stock === -1 ? Infinity : (producto.stock || 0);
            if (ex) {
                if (ex.cantidad >= stockMax) return showToast(`Solo hay ${producto.stock} disponibles`, 'warning');
                ex.cantidad++;
            } else {
                if (stockMax <= 0) return showToast('Producto agotado', 'warning');
                items.push({ productoId: producto.id, titulo: producto.titulo, precio: producto.precio, cantidad: 1, fotoUrl: producto.fotoUrl || '', tiempoPreparacion: producto.tiempoPreparacion || 0 });
            }
            saveCart(items);
            showToast(`${escapeHtml(producto.titulo)} agregado al carrito`, 'success');
        }
        function addToCartById(pid) { const p = _productos.find(x => x.id === pid); if (p) addToCart(p); }
        function updateCartQty(pid, delta) {
            const items = getCart(), idx = items.findIndex(i => i.productoId === pid);
            if (idx === -1) return;
            const p = _productos.find(x => x.id === pid);
            const stockMax = p ? (p.stock === -1 ? Infinity : (p.stock || 0)) : Infinity;
            items[idx].cantidad += delta;
            if (items[idx].cantidad > stockMax) { items[idx].cantidad = stockMax; showToast('Stock máximo alcanzado', 'warning'); }
            if (items[idx].cantidad <= 0) items.splice(idx, 1);
            saveCart(items); renderCarrito();
        }
        function removeFromCart(pid) { saveCart(getCart().filter(i => i.productoId !== pid)); renderCarrito(); }
        function clearCart() { localStorage.removeItem(CART_KEY); updateCartBadge(); updateFab(); }
        function updateCartBadge() {
            const b = document.getElementById('caf-cart-badge');
            if (!b) return;
            const c = getCart().reduce((s, i) => s + i.cantidad, 0);
            b.textContent = c; b.classList.toggle('d-none', c === 0);
        }
        function updateFab() {
            const fab = document.getElementById('caf-fab');
            if (!fab) return;
            const c = getCart().reduce((s, i) => s + i.cantidad, 0);
            fab.classList.toggle('d-none', c === 0);
            const span = fab.querySelector('.caf-fab-count');
            if (span) span.textContent = c;
        }

        // --- INIT ---
        async function init(ctx) {
            _ctx = ctx; _profile = ctx.profile;
            _pedidosList = []; _pedidosLastDoc = null; _pedidosHasMore = true; _pedidosActivos = [];
            _categoriaActiva = 'Todos'; _busqueda = ''; _ordenamiento = 'default';

            const container = document.getElementById('view-cafeteria');
            if (!container) return;
            container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div><p class="mt-2 text-muted">Cargando cafetería...</p></div>';

            // Restaurar estado guardado
            const savedState = window.ModuleStateManager?.getState('view-cafeteria') || {};
            if (savedState.tab) _savedTab = savedState.tab;
            if (savedState.categoria) _categoriaActiva = savedState.categoria;
            if (savedState.busqueda) _busqueda = savedState.busqueda;
            if (savedState.orden) _ordenamiento = savedState.orden;

            try {
                [_config, _productos] = await Promise.all([
                    CafeteriaService.getConfig(ctx),
                    CafeteriaService.getProductos(ctx, { soloDisponibles: true })
                ]);
            } catch (err) {
                console.error('[Cafeteria] Error loading data:', err);
                _config = null; _productos = [];
            }

            // Verificar pedidos activos del usuario
            try {
                _pedidosActivos = await CafeteriaService.getPedidosActivosByUser(ctx, ctx.user.uid);
            } catch { _pedidosActivos = []; }

            container.innerHTML = renderLayout();
            updateCartBadge(); updateFab();
            bindEvents();
            renderMenu();
            syncBreadcrumb(_savedTab || '#caf-tab-menu');

            // Restaurar pestaña activa
            if (_savedTab) {
                const tabBtn = document.querySelector(`[data-bs-target="${_savedTab}"]`);
                if (tabBtn) { setTimeout(() => tabBtn.click(), 50); }
            }
        }

        let _savedTab = null;
        function saveState() {
            const activeTab = document.querySelector('#caf-app .nav-link.active');
            return {
                tab: activeTab ? activeTab.dataset.bsTarget : null,
                categoria: _categoriaActiva,
                busqueda: _busqueda,
                orden: _ordenamiento
            };
        }

        function restoreState(savedState) {
            if (!savedState) return;
            if (savedState.tab) _savedTab = savedState.tab;
            if (savedState.categoria) _categoriaActiva = savedState.categoria;
            if (savedState.busqueda) _busqueda = savedState.busqueda;
            if (savedState.orden) _ordenamiento = savedState.orden;
        }

        function _saveState() {
            window.ModuleStateManager?.saveState('view-cafeteria');
        }

        function syncBreadcrumb(tabTarget) {
            const currentTarget = tabTarget
                || document.querySelector('#caf-app .nav-link.active')?.dataset.bsTarget
                || '#caf-tab-menu';
            const label = TAB_LABELS[currentTarget] || TAB_LABELS['#caf-tab-menu'];
            window.SIA?.setBreadcrumbSection?.('view-cafeteria', label, { moduleClickable: false });
        }

        // --- LAYOUT ---
        function renderLayout() {
            const nombre = escapeHtml(_config?.nombre || 'Cafetería');
            const desc = escapeHtml(_config?.descripcion || 'Ordena y recoge tu comida fácilmente');
            const horarioHoy = getHorarioHoy();
            const recepcionActiva = _config?.recepcionActiva !== false;
            const bannerPedido = _pedidosActivos.length
                ? `<div class="alert alert-warning d-flex align-items-center gap-2 py-2 mb-3" id="caf-banner-activo">
                    <i class="bi bi-bicycle fs-5"></i>
                    <div class="flex-grow-1"><strong>¡Tienes un pedido en camino!</strong> <span class="ms-1">${statusBadge(_pedidosActivos[0].estado)}</span></div>
                    <button class="btn btn-sm btn-warning" onclick="document.querySelector('[data-bs-target=\'#caf-tab-pedidos\']').click()">Ver</button>
                   </div>` : '';

            const avisoSaturacion = !recepcionActiva
                ? `<div class="alert alert-danger text-center mb-3"><i class="bi bi-cone-striped me-2"></i><strong>La cafetería no está aceptando pedidos por el momento.</strong></div>`
                : '';

            return `
            <style>
                #caf-app{--caf:#f97316;--caf-light:#fb923c;--caf-dark:#ea580c;}
                #caf-app .caf-hero{background:linear-gradient(135deg,var(--caf) 0%,var(--caf-light) 100%);border-radius:1rem;color:#fff;}
                #caf-app .nav-pills .nav-link.active{background:var(--caf);color:#fff;}
                #caf-app .nav-pills .nav-link{color:var(--caf-dark);font-weight:500;}
                #caf-app .caf-product-card{transition:transform .15s;cursor:pointer;border:none;}
                #caf-app .caf-product-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(249,115,22,.15);}
                #caf-app .caf-product-img{height:140px;object-fit:cover;border-radius:.75rem .75rem 0 0;background:#f5f5f5;}
                #caf-app .caf-cat-pill.active{background:var(--caf)!important;color:#fff!important;}
                #caf-app .caf-cat-pill{background:#f3f4f6;color:#374151;border:none;font-size:.85rem;}
                #caf-app .caf-add-btn{background:var(--caf);border:none;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;}
                #caf-app .caf-add-btn:hover{background:var(--caf-dark);}
                #caf-app .caf-product-card.agotado{opacity:.55;filter:grayscale(.8);}
                #caf-app .caf-popular-ribbon{position:absolute;top:8px;left:8px;background:#f97316;color:#fff;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px;}
                #caf-app .caf-stepper .step{flex:1;text-align:center;font-size:.65rem;color:#aaa;position:relative;}
                #caf-app .caf-stepper .step.done{color:#16a34a;}
                #caf-app .caf-stepper .step.active-step{color:#f97316;font-weight:700;}
                #caf-app .caf-stepper .step::before{content:'';display:block;width:20px;height:20px;border-radius:50%;background:#e5e7eb;margin:0 auto 3px;}
                #caf-app .caf-stepper .step.done::before{background:#16a34a;}
                #caf-app .caf-stepper .step.active-step::before{background:#f97316;}
                .caf-fab{position:fixed;bottom:90px;right:18px;z-index:1045;background:#f97316;color:#fff;border:none;border-radius:50px;padding:10px 18px;font-weight:700;box-shadow:0 4px 15px rgba(249,115,22,.5);transition:transform .15s;}
                .caf-fab:hover{transform:scale(1.06);}
                @keyframes caf-success-pop{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
                .caf-success-anim{animation:caf-success-pop .4s ease forwards;}
            </style>
            <div id="caf-app">
                <!-- HERO -->
                <div class="caf-hero p-4 mb-3">
                    <span class="badge mb-2" style="background:rgba(255,255,255,.2)"><i class="bi bi-cup-hot-fill me-1"></i>Cafetería</span>
                    <h2 class="fw-bold mb-1">${nombre}</h2>
                    <p class="mb-1 opacity-75">${desc}</p>
                    ${horarioHoy ? `<small class="opacity-75"><i class="bi bi-clock me-1"></i>${horarioHoy}</small>` : ''}
                </div>
                ${avisoSaturacion}
                ${bannerPedido}
                <!-- TABS -->
                <ul class="nav nav-pills nav-fill p-1 bg-light rounded-pill mb-4">
                    <li class="nav-item"><button class="nav-link active rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-tab-menu"><i class="bi bi-grid me-1"></i>Menú</button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-tab-carrito"><i class="bi bi-cart3 me-1"></i>Carrito <span id="caf-cart-badge" class="badge bg-danger rounded-pill ms-1 d-none">0</span></button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-tab-pedidos"><i class="bi bi-receipt me-1"></i>Pedidos</button></li>
                    <li class="nav-item"><button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#caf-tab-resenas"><i class="bi bi-star me-1"></i>Reseñas</button></li>
                </ul>
                <div class="tab-content">
                    <!-- MENU -->
                    <div class="tab-pane fade show active" id="caf-tab-menu">
                        <div class="d-flex gap-2 mb-3">
                            <input type="search" id="caf-search" class="form-control rounded-pill" placeholder="Buscar producto..." value="${escapeHtml(_busqueda)}">
                            <select id="caf-orden-select" class="form-select form-select-sm rounded-pill" style="min-width:150px">
                                <option value="default" ${_ordenamiento === 'default' ? 'selected' : ''}>Orden</option>
                                <option value="az" ${_ordenamiento === 'az' ? 'selected' : ''}>A-Z</option>
                                <option value="precio_asc" ${_ordenamiento === 'precio_asc' ? 'selected' : ''}>Precio ↑</option>
                                <option value="precio_desc" ${_ordenamiento === 'precio_desc' ? 'selected' : ''}>Precio ↓</option>
                                <option value="rating" ${_ordenamiento === 'rating' ? 'selected' : ''}>Mejor calificados</option>
                            </select>
                        </div>
                        <div id="caf-categorias" class="d-flex gap-2 flex-wrap mb-3"></div>
                        <div id="caf-menu-grid" class="row g-3"></div>
                    </div>
                    <!-- CARRITO -->
                    <div class="tab-pane fade" id="caf-tab-carrito"><div id="caf-carrito-content"></div></div>
                    <!-- PEDIDOS -->
                    <div class="tab-pane fade" id="caf-tab-pedidos"><div id="caf-pedidos-list"></div></div>
                    <!-- RESENAS -->
                    <div class="tab-pane fade" id="caf-tab-resenas"><div id="caf-resenas-content"></div></div>
                </div>
            </div>
            <!-- FAB Carrito -->
            <button class="caf-fab d-none" id="caf-fab" onclick="document.querySelector('[data-bs-target=\'#caf-tab-carrito\']').click()">
                <i class="bi bi-cart3 me-1"></i> Ver Carrito (<span class="caf-fab-count">0</span>)
            </button>
            <!-- MODAL Detalle Producto -->
            <div class="modal fade" id="caf-modal-producto" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered"><div class="modal-content" id="caf-modal-producto-body"></div></div>
            </div>
            <!-- MODAL Reseña -->
            <div class="modal fade" id="caf-modal-resena" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header border-0"><h5 class="modal-title fw-bold">Escribir Reseña</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body">
                            <input type="hidden" id="caf-resena-tipo" value="cafeteria">
                            <input type="hidden" id="caf-resena-productoId" value="">
                            <input type="hidden" id="caf-resena-productoTitulo" value="">
                            <div class="text-center mb-3">
                                <label class="form-label">Tu calificación</label>
                                <div id="caf-resena-stars" class="d-flex justify-content-center gap-2">
                                    ${[1, 2, 3, 4, 5].map(n => `<i class="bi bi-star caf-star-select" data-rating="${n}" style="font-size:2rem;cursor:pointer;color:#f59e0b"></i>`).join('')}
                                </div>
                                <input type="hidden" id="caf-resena-rating" value="5">
                            </div>
                            <div class="mb-2"><label class="form-label">Comentario</label><textarea id="caf-resena-comentario" class="form-control" rows="3" maxlength="500" placeholder="Comparte tu experiencia..."></textarea></div>
                        </div>
                        <div class="modal-footer border-0">
                            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn text-white" style="background:#f97316" id="caf-resena-submit-btn">Publicar Reseña</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        function getHorarioHoy() {
            if (!_config?.horario) return '';
            const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const h = _config.horario[dias[new Date().getDay()]];
            if (!h || !h.activo) return 'Cerrado hoy';
            return `Hoy: ${h.abre} - ${h.cierra}`;
        }

        // --- BIND EVENTS ---
        function bindEvents() {
            document.getElementById('caf-search')?.addEventListener('input', e => {
                _busqueda = e.target.value.toLowerCase().trim();
                renderMenuGrid(); _saveState();
            });
            document.getElementById('caf-orden-select')?.addEventListener('change', e => {
                _ordenamiento = e.target.value; renderMenuGrid(); _saveState();
            });
            document.querySelector('[data-bs-target="#caf-tab-carrito"]')?.addEventListener('shown.bs.tab', () => renderCarrito());
            document.querySelector('[data-bs-target="#caf-tab-pedidos"]')?.addEventListener('shown.bs.tab', () => loadPedidos(true));
            document.querySelector('[data-bs-target="#caf-tab-resenas"]')?.addEventListener('shown.bs.tab', () => loadResenas());
            document.querySelectorAll('.nav-link[data-bs-target]').forEach(btn => {
                btn.addEventListener('shown.bs.tab', () => {
                    syncBreadcrumb(btn.dataset.bsTarget);
                    _saveState();
                });
            });
            document.querySelectorAll('.caf-star-select').forEach(star => {
                star.addEventListener('click', function () {
                    const r = parseInt(this.dataset.rating);
                    document.getElementById('caf-resena-rating').value = r;
                    document.querySelectorAll('.caf-star-select').forEach((s, i) => {
                        s.className = i < r ? 'bi bi-star-fill caf-star-select' : 'bi bi-star caf-star-select';
                    });
                });
            });
            document.getElementById('caf-resena-submit-btn')?.addEventListener('click', submitResena);
        }

        // --- MENU ---
        function renderMenu() { renderCategorias(); renderMenuGrid(); }

        function renderCategorias() {
            const container = document.getElementById('caf-categorias');
            if (!container) return;
            const cats = ['Todos'];
            if (_config?.categorias) cats.push(..._config.categorias);
            else cats.push(...[...new Set(_productos.map(p => p.categoria).filter(Boolean))]);
            container.innerHTML = cats.map(c => `<button class="btn btn-sm caf-cat-pill rounded-pill px-3 ${c === _categoriaActiva ? 'active' : ''}" onclick="Cafeteria.filterCategoria('${escapeHtml(c)}')">${escapeHtml(c)}</button>`).join('');
        }

        function filterCategoria(cat) { _categoriaActiva = cat; renderCategorias(); renderMenuGrid(); _saveState(); }

        function renderMenuGrid() {
            const container = document.getElementById('caf-menu-grid');
            if (!container) return;
            let filtered = [..._productos];
            if (_categoriaActiva !== 'Todos') filtered = filtered.filter(p => p.categoria === _categoriaActiva);
            if (_busqueda) filtered = filtered.filter(p => (p.titulo || '').toLowerCase().includes(_busqueda) || (p.descripcion || '').toLowerCase().includes(_busqueda));
            // Ordenamiento
            if (_ordenamiento === 'az') filtered.sort((a, b) => a.titulo.localeCompare(b.titulo));
            else if (_ordenamiento === 'precio_asc') filtered.sort((a, b) => a.precio - b.precio);
            else if (_ordenamiento === 'precio_desc') filtered.sort((a, b) => b.precio - a.precio);
            else if (_ordenamiento === 'rating') filtered.sort((a, b) => (b.promedioResenas || 0) - (a.promedioResenas || 0));

            if (!filtered.length) {
                container.innerHTML = '<div class="col-12 text-center py-5 text-muted"><i class="bi bi-search" style="font-size:2rem"></i><p class="mt-2">No se encontraron productos</p></div>';
                return;
            }
            container.innerHTML = filtered.map(p => {
                const agotado = p.stock !== undefined && p.stock !== -1 && p.stock <= 0;
                return `<div class="col-6 col-md-4 col-lg-3">
                    <div class="card caf-product-card shadow-sm h-100 ${agotado ? 'agotado' : ''}" onclick="Cafeteria.showProducto('${p.id}')" style="position:relative">
                        ${p.highlightPopular ? `<span class="caf-popular-ribbon">⭐ Popular</span>` : ''}
                        ${p.fotoUrl ? `<img src="${escapeHtml(p.fotoUrl)}" alt="${escapeHtml(p.titulo)}" class="caf-product-img w-100">` : `<div class="caf-product-img w-100 d-flex align-items-center justify-content-center"><i class="bi bi-cup-hot text-muted" style="font-size:2.5rem"></i></div>`}
                        <div class="card-body p-2 d-flex flex-column">
                            <h6 class="card-title mb-1 fw-semibold" style="font-size:.9rem">${escapeHtml(p.titulo)}</h6>
                            <small class="text-muted mb-1">${escapeHtml(p.cantidadPeso || '')}${p.kcal ? ` · <i class="bi bi-fire text-danger"></i>${p.kcal} kcal` : ''}</small>
                            ${p.totalResenas > 0 ? `<div class="mb-1">${renderStars(p.promedioResenas, '.75rem')} <small class="text-muted">(${p.totalResenas})</small></div>` : ''}
                            <div class="mt-auto d-flex align-items-center justify-content-between">
                                <span class="fw-bold" style="color:#f97316">${formatMoney(p.precio)}</span>
                                ${agotado
                        ? `<span class="badge bg-secondary">Agotado</span>`
                        : `<button class="caf-add-btn" onclick="event.stopPropagation();Cafeteria.addToCart('${p.id}')" title="Agregar"><i class="bi bi-plus"></i></button>`}
                            </div>
                            ${p.tiempoPreparacion > 0 ? `<small class="text-muted mt-1"><i class="bi bi-clock me-1"></i>${p.tiempoPreparacion} min</small>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        function showProducto(pid) {
            const p = _productos.find(x => x.id === pid);
            if (!p) return;
            const body = document.getElementById('caf-modal-producto-body');
            if (!body) return;
            const agotado = p.stock !== undefined && p.stock !== -1 && p.stock <= 0;
            body.innerHTML = `
                ${p.fotoUrl ? `<img src="${escapeHtml(p.fotoUrl)}" alt="${escapeHtml(p.titulo)}" class="w-100" style="max-height:280px;object-fit:cover;border-radius:.5rem .5rem 0 0">` : `<div class="w-100 d-flex align-items-center justify-content-center bg-light" style="height:180px;border-radius:.5rem .5rem 0 0"><i class="bi bi-cup-hot text-muted" style="font-size:4rem"></i></div>`}
                <div class="p-3">
                    <h4 class="fw-bold mb-1">${escapeHtml(p.titulo)}</h4>
                    <div class="d-flex flex-wrap gap-1 mb-2">
                        <span class="badge bg-light text-dark">${escapeHtml(p.categoria || 'General')}</span>
                        ${p.cantidadPeso ? `<span class="badge bg-light text-dark">${escapeHtml(p.cantidadPeso)}</span>` : ''}
                        ${p.tiempoPreparacion > 0 ? `<span class="badge bg-light text-dark"><i class="bi bi-clock me-1"></i>${p.tiempoPreparacion} min</span>` : ''}
                        ${p.kcal ? `<span class="badge bg-light text-dark"><i class="bi bi-fire me-1 text-danger"></i>${p.kcal} kcal</span>` : ''}
                        ${agotado ? `<span class="badge bg-danger">Agotado</span>` : p.stock > 0 ? `<span class="badge bg-success">${p.stock} disponibles</span>` : ''}
                    </div>
                    <p class="text-muted">${escapeHtml(p.descripcion || 'Sin descripción')}</p>
                    ${p.totalResenas > 0 ? `<div class="mb-2">${renderStars(p.promedioResenas)} <small class="text-muted">(${p.totalResenas} reseñas)</small></div>` : ''}
                    <div class="d-flex align-items-center justify-content-between mt-3">
                        <span class="fs-4 fw-bold" style="color:#f97316">${formatMoney(p.precio)}</span>
                        ${agotado
                    ? `<button class="btn btn-secondary px-4" disabled>Agotado</button>`
                    : `<button class="btn text-white px-4" style="background:#f97316" onclick="Cafeteria.addToCart('${p.id}');bootstrap.Modal.getInstance(document.getElementById('caf-modal-producto'))?.hide()"><i class="bi bi-cart-plus me-1"></i>Agregar</button>`}
                    </div>
                    <hr>
                    <button class="btn btn-outline-secondary btn-sm" onclick="Cafeteria.showProductoResenas('${p.id}','${escapeHtml(p.titulo)}')"><i class="bi bi-chat-dots me-1"></i>Ver Reseñas</button>
                </div>`;
            new bootstrap.Modal(document.getElementById('caf-modal-producto')).show();
        }

        // --- CARRITO ---
        function renderCarrito() {
            const container = document.getElementById('caf-carrito-content');
            if (!container) return;
            const items = getCart();
            if (!items.length) {
                container.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-cart-x" style="font-size:3rem"></i><p class="mt-2">Tu carrito está vacío</p><button class="btn btn-sm rounded-pill px-4 text-white" style="background:#f97316" onclick="document.querySelector('[data-bs-target=\'#caf-tab-menu\']').click()">Ver Menú</button></div>`;
                return;
            }
            const total = items.reduce((s, i) => s + (i.precio * i.cantidad), 0);
            const tiempoMax = Math.max(...items.map(i => i.tiempoPreparacion || 0));
            const pagoTransferencia = _config?.pagoTransferencia?.activo;
            const lastNote = localStorage.getItem(NOTE_KEY) || '';
            container.innerHTML = `
                <div class="list-group mb-3">
                    ${items.map(item => `
                    <div class="list-group-item d-flex align-items-center gap-3">
                        ${item.fotoUrl ? `<img src="${escapeHtml(item.fotoUrl)}" class="rounded" style="width:50px;height:50px;object-fit:cover">` : `<div class="rounded bg-light d-flex align-items-center justify-content-center" style="width:50px;height:50px"><i class="bi bi-cup-hot text-muted"></i></div>`}
                        <div class="flex-grow-1"><h6 class="mb-0 fw-semibold" style="font-size:.9rem">${escapeHtml(item.titulo)}</h6><small class="text-muted">${formatMoney(item.precio)} c/u</small></div>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-secondary rounded-circle" style="width:28px;height:28px;padding:0" onclick="Cafeteria.updateCartQty('${item.productoId}',-1)"><i class="bi bi-dash"></i></button>
                            <span class="fw-bold">${item.cantidad}</span>
                            <button class="btn btn-sm btn-outline-secondary rounded-circle" style="width:28px;height:28px;padding:0" onclick="Cafeteria.updateCartQty('${item.productoId}',1)"><i class="bi bi-plus"></i></button>
                        </div>
                        <span class="fw-bold" style="min-width:60px;text-align:right">${formatMoney(item.precio * item.cantidad)}</span>
                        <button class="btn btn-sm text-danger p-0" onclick="Cafeteria.removeFromCart('${item.productoId}')"><i class="bi bi-trash3"></i></button>
                    </div>`).join('')}
                </div>
                <div class="card shadow-sm mb-3"><div class="card-body">
                    <div class="d-flex justify-content-between mb-2"><span>Subtotal</span><span class="fw-bold">${formatMoney(total)}</span></div>
                    ${tiempoMax > 0 ? `<div class="d-flex justify-content-between text-muted mb-2"><span><i class="bi bi-clock me-1"></i>Tiempo estimado</span><span>~${tiempoMax} min</span></div>` : ''}
                    <hr><div class="d-flex justify-content-between fs-5"><span class="fw-bold">Total</span><span class="fw-bold" style="color:#f97316">${formatMoney(total)}</span></div>
                </div></div>
                <div class="card shadow-sm mb-3"><div class="card-body">
                    <h6 class="fw-bold mb-3">Método de pago</h6>
                    <div class="form-check mb-2"><input class="form-check-input" type="radio" name="caf-pago" id="caf-pago-efectivo" value="efectivo" checked><label class="form-check-label" for="caf-pago-efectivo"><i class="bi bi-cash me-1"></i>Efectivo al recoger</label></div>
                    ${pagoTransferencia ? `<div class="form-check mb-2"><input class="form-check-input" type="radio" name="caf-pago" id="caf-pago-transferencia" value="transferencia"><label class="form-check-label" for="caf-pago-transferencia"><i class="bi bi-bank me-1"></i>Transferencia</label></div>
                    <div id="caf-transferencia-info" class="d-none mt-3 p-3 bg-light rounded">
                        <small class="text-muted d-block mb-1"><strong>Banco:</strong> ${escapeHtml(_config.pagoTransferencia.banco || '')}</small>
                        <small class="text-muted d-block mb-1"><strong>CLABE:</strong> ${escapeHtml(_config.pagoTransferencia.clabe || '')}</small>
                        <small class="text-muted d-block mb-1"><strong>Titular:</strong> ${escapeHtml(_config.pagoTransferencia.titular || '')}</small>
                        ${_config.pagoTransferencia.instrucciones ? `<small class="text-muted d-block mb-2">${escapeHtml(_config.pagoTransferencia.instrucciones)}</small>` : ''}
                        <label class="form-label mt-2 fw-semibold">Comprobante de pago</label>
                        <input type="file" id="caf-comprobante-file" class="form-control form-control-sm" accept="image/*" capture="environment">
                    </div>`: ''}
                </div></div>
                <div class="mb-3"><label class="form-label fw-semibold">Nota para la cafetería (opcional)</label>
                    <textarea id="caf-pedido-nota" class="form-control" rows="2" maxlength="200" placeholder="Ej: Sin cebolla, extra salsa...">${escapeHtml(lastNote)}</textarea></div>
                <button id="caf-btn-ordenar" class="btn text-white w-100 py-3 fw-bold rounded-pill" style="background:#f97316;font-size:1.1rem" onclick="Cafeteria.realizarPedido()">
                    <i class="bi bi-bag-check me-2"></i>Realizar Pedido - ${formatMoney(total)}
                </button>`;

            const radioTransf = document.getElementById('caf-pago-transferencia');
            const transfInfo = document.getElementById('caf-transferencia-info');
            if (radioTransf && transfInfo) {
                radioTransf.addEventListener('change', () => transfInfo.classList.remove('d-none'));
                document.getElementById('caf-pago-efectivo').addEventListener('change', () => transfInfo.classList.add('d-none'));
            }
        }

        async function realizarPedido() {
            const items = getCart();
            if (!items.length) return showToast('El carrito está vacío', 'warning');
            const btn = document.getElementById('caf-btn-ordenar');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...'; }
            try {
                const metodoPago = document.querySelector('input[name="caf-pago"]:checked')?.value || 'efectivo';
                const nota = document.getElementById('caf-pedido-nota')?.value || '';
                // Guardar nota en memoria
                if (nota.trim()) localStorage.setItem(NOTE_KEY, nota.trim());

                let comprobanteUrl = '';
                if (metodoPago === 'transferencia') {
                    const file = document.getElementById('caf-comprobante-file')?.files?.[0];
                    if (file) {
                        comprobanteUrl = await CafeteriaService.uploadComprobante(_ctx, file);
                    }
                }
                await CafeteriaService.createPedido(_ctx, items, metodoPago, nota, comprobanteUrl);
                clearCart();
                // Animación de confirmación
                const carritoContent = document.getElementById('caf-carrito-content');
                if (carritoContent) {
                    carritoContent.innerHTML = `<div class="text-center py-5 caf-success-anim">
                        <div style="font-size:4rem">✅</div>
                        <h4 class="fw-bold mt-3 text-success">¡Pedido realizado!</h4>
                        <p class="text-muted">Te avisaremos cuando esté listo</p>
                        <button class="btn btn-outline-secondary rounded-pill px-4 mt-2" onclick="document.querySelector('[data-bs-target=\'#caf-tab-pedidos\']').click()">Ver mis pedidos</button>
                    </div>`;
                }
            } catch (err) {
                console.error('[Cafeteria] Error al crear pedido:', err);
                showToast(err.message || 'Error al realizar el pedido', 'danger');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-bag-check me-2"></i>Realizar Pedido'; }
            }
        }

        // --- PEDIDOS ---
        function renderStepper(estado) {
            if (estado === 'cancelado') return `<div class="badge bg-danger mt-1">Pedido cancelado</div>`;
            const steps = ['pendiente', 'confirmado', 'preparando', 'listo', 'entregado'];
            const currentStep = STATUS_MAP[estado]?.step ?? 0;
            return `<div class="d-flex caf-stepper mt-2 mb-1">
                ${steps.map((s, i) => {
                const cls = i < currentStep ? 'done' : i === currentStep ? 'active-step' : '';
                return `<div class="step ${cls}">${STATUS_MAP[s].label}</div>`;
            }).join('')}
            </div>`;
        }

        async function loadPedidos(reset = false) {
            if (reset) { _pedidosList = []; _pedidosLastDoc = null; _pedidosHasMore = true; }
            const container = document.getElementById('caf-pedidos-list');
            if (!container) return;
            if (!_pedidosList.length) container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></div>';
            try {
                const nuevos = await CafeteriaService.getPedidosByUser(_ctx, _ctx.user.uid, { limit: 20, lastDoc: _pedidosLastDoc });
                _pedidosList.push(...nuevos);
                _pedidosHasMore = nuevos.length === 20;
                if (nuevos.length) _pedidosLastDoc = nuevos[nuevos.length - 1]._doc;
            } catch (err) { console.error('[Cafeteria] Error loading pedidos:', err); }

            if (!_pedidosList.length) {
                container.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-receipt" style="font-size:3rem"></i><p class="mt-2">No tienes pedidos aún</p></div>`;
                return;
            }
            container.innerHTML = _pedidosList.map(p => `
                <div class="card shadow-sm mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div><small class="text-muted">${formatDate(p.createdAt)}</small> <small class="text-muted ms-2">${timeAgo(p.createdAt)}</small></div>
                            ${statusBadge(p.estado)}
                        </div>
                        ${renderStepper(p.estado)}
                        <div class="mb-2 mt-2">
                            ${(p.items || []).map(i => `<div class="d-flex justify-content-between"><span>${escapeHtml(i.titulo)} x${i.cantidad}</span><span>${formatMoney(i.subtotal)}</span></div>`).join('')}
                        </div>
                        <hr class="my-2">
                        <div class="d-flex justify-content-between fw-bold"><span>Total</span><span style="color:#f97316">${formatMoney(p.total)}</span></div>
                        ${p.metodoPago === 'transferencia' ? `<small class="text-muted"><i class="bi bi-bank me-1"></i>Transferencia ${p.pagoConfirmado ? '<span class="text-success">(Confirmado)</span>' : '<span class="text-warning">(Pendiente)</span>'}</small>` : ''}
                        ${p.respuestaAdmin ? `<div class="alert alert-info mt-2 mb-0 py-2 px-3"><small><i class="bi bi-chat-left-text me-1"></i>${escapeHtml(p.respuestaAdmin)}</small></div>` : ''}
                        <div class="d-flex gap-2 flex-wrap mt-2">
                            ${p.estado === 'pendiente' ? `<button class="btn btn-sm btn-outline-danger" onclick="Cafeteria.cancelarPedido('${p.id}')"><i class="bi bi-x-circle me-1"></i>Cancelar</button>` : ''}
                            ${p.estado === 'entregado' ? `<button class="btn btn-sm btn-outline-warning" onclick="Cafeteria.reorderPedido('${p.id}')"><i class="bi bi-arrow-repeat me-1"></i>Volver a pedir</button>` : ''}
                            ${p.estado === 'entregado' ? `<button class="btn btn-sm btn-outline-secondary" onclick="Cafeteria.openResenaModal('pedido','${p.id}')"><i class="bi bi-star me-1"></i>Reseñar</button>` : ''}
                        </div>
                    </div>
                </div>`).join('');
            if (_pedidosHasMore) container.innerHTML += `<button class="btn btn-outline-secondary w-100 rounded-pill" onclick="Cafeteria.loadMorePedidos()">Cargar más pedidos</button>`;
        }

        function loadMorePedidos() { loadPedidos(false); }

        async function cancelarPedido(pedidoId) {
            if (!confirm('¿Seguro que deseas cancelar este pedido?')) return;
            try {
                await CafeteriaService.cancelarPedido(_ctx, pedidoId);
                showToast('Pedido cancelado', 'success');
                loadPedidos(true);
            } catch (err) {
                showToast(err.message || 'No se pudo cancelar el pedido', 'danger');
            }
        }

        async function reorderPedido(pedidoId) {
            const pedido = _pedidosList.find(p => p.id === pedidoId);
            if (!pedido || !pedido.items?.length) return showToast('No se pudieron cargar los ítems del pedido', 'warning');
            let agregados = 0;
            pedido.items.forEach(item => {
                const prod = _productos.find(p => p.id === item.productoId);
                if (prod) {
                    for (let i = 0; i < item.cantidad; i++) addToCart(prod);
                    agregados++;
                }
            });
            if (agregados === 0) return showToast('No hay productos disponibles de ese pedido actualmente', 'warning');
            showToast('¡Productos agregados al carrito!', 'success');
            document.querySelector('[data-bs-target="#caf-tab-carrito"]')?.click();
        }

        // --- RESENAS ---
        async function loadResenas() {
            const container = document.getElementById('caf-resenas-content');
            if (!container) return;
            container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></div>';
            try {
                const resenas = await CafeteriaService.getResenasCafeteria(_ctx, { limit: 30 });
                container.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold mb-0">Reseñas de la Cafetería</h5>
                        <button class="btn btn-sm text-white rounded-pill px-3" style="background:#f97316" onclick="Cafeteria.openResenaModal('cafeteria')"><i class="bi bi-pencil me-1"></i>Escribir</button>
                    </div>
                    ${resenas.length ? resenas.map(r => renderResenaCard(r)).join('') : '<p class="text-muted text-center py-3">¡Sé el primero en compartir tu experiencia!</p>'}`;
            } catch (err) {
                container.innerHTML = '<p class="text-danger">Error al cargar reseñas</p>';
            }
        }

        function renderResenaCard(r) {
            return `<div class="card shadow-sm mb-2"><div class="card-body py-2 px-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div><strong style="font-size:.9rem">${escapeHtml(r.userName)}</strong>${r.productoTitulo ? `<small class="text-muted ms-2">sobre ${escapeHtml(r.productoTitulo)}</small>` : ''}</div>
                    <small class="text-muted">${formatDate(r.createdAt)}</small>
                </div>
                <div class="mb-1">${renderStars(r.rating, '.85rem')}</div>
                ${r.comentario ? `<p class="mb-0 text-muted" style="font-size:.9rem">${escapeHtml(r.comentario)}</p>` : ''}
            </div></div>`;
        }

        async function showProductoResenas(productoId, titulo) {
            bootstrap.Modal.getInstance(document.getElementById('caf-modal-producto'))?.hide();
            document.querySelector('[data-bs-target="#caf-tab-resenas"]')?.click();
            const container = document.getElementById('caf-resenas-content');
            if (!container) return;
            container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></div>';
            try {
                const resenas = await CafeteriaService.getResenasByProducto(_ctx, productoId, { limit: 30 });
                container.innerHTML = `
                    <button class="btn btn-sm btn-link mb-2" onclick="Cafeteria.loadResenas()"><i class="bi bi-arrow-left me-1"></i>Volver</button>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold mb-0">Reseñas: ${escapeHtml(titulo)}</h5>
                        <button class="btn btn-sm text-white rounded-pill px-3" style="background:#f97316" onclick="Cafeteria.openResenaModal('producto','${productoId}','${escapeHtml(titulo)}')"><i class="bi bi-pencil me-1"></i>Escribir</button>
                    </div>
                    ${resenas.length ? resenas.map(r => renderResenaCard(r)).join('') : '<p class="text-muted text-center py-3">Sin reseñas para este producto aún.</p>'}`;
            } catch { container.innerHTML = '<p class="text-danger">Error al cargar reseñas</p>'; }
        }

        function openResenaModal(tipo, productoIdOrPedidoId, titulo) {
            document.getElementById('caf-resena-tipo').value = tipo === 'producto' ? 'producto' : 'cafeteria';
            document.getElementById('caf-resena-productoId').value = tipo === 'producto' ? (productoIdOrPedidoId || '') : '';
            document.getElementById('caf-resena-productoTitulo').value = titulo || '';
            document.getElementById('caf-resena-comentario').value = '';
            document.getElementById('caf-resena-rating').value = '5';
            document.querySelectorAll('.caf-star-select').forEach((s, i) => { s.className = i < 5 ? 'bi bi-star-fill caf-star-select' : 'bi bi-star caf-star-select'; });
            new bootstrap.Modal(document.getElementById('caf-modal-resena')).show();
        }

        async function submitResena() {
            const btn = document.getElementById('caf-resena-submit-btn');
            const rating = parseInt(document.getElementById('caf-resena-rating').value) || 5;
            const comentario = document.getElementById('caf-resena-comentario').value.trim();
            const tipo = document.getElementById('caf-resena-tipo').value;
            const productoId = document.getElementById('caf-resena-productoId').value;
            const productoTitulo = document.getElementById('caf-resena-productoTitulo').value;
            if (!comentario) return showToast('Escribe un comentario', 'warning');
            if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }
            try {
                // Verificar duplicado
                const yaReseno = await CafeteriaService.checkUserResena(_ctx, tipo, productoId || null);
                if (yaReseno) { showToast('Ya escribiste una reseña para esto. Gracias por tu opinión.', 'info'); bootstrap.Modal.getInstance(document.getElementById('caf-modal-resena'))?.hide(); return; }
                await CafeteriaService.createResena(_ctx, { tipo, productoId: productoId || null, productoTitulo, rating, comentario });
                bootstrap.Modal.getInstance(document.getElementById('caf-modal-resena'))?.hide();
                showToast('¡Reseña publicada!', 'success');
                loadResenas();
            } catch (err) {
                showToast('Error al publicar reseña', 'danger');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Publicar Reseña'; }
            }
        }

        // --- PUBLIC API ---
        return {
            init,
            filterCategoria,
            showProducto,
            addToCart: addToCartById,
            updateCartQty,
            removeFromCart,
            realizarPedido,
            cancelarPedido,
            reorderPedido,
            loadMorePedidos,
            loadResenas,
            showProductoResenas,
            openResenaModal,
            saveState,
            restoreState
        };
    })();
}
