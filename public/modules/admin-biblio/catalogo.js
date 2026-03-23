if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Catalogo = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _configAssetsUnsub = null;

    function syncFromState() {
        _ctx = state.ctx;
        _configAssetsUnsub = state.configAssetsUnsub;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.configAssetsUnsub = _configAssetsUnsub;
    }

    function withState(fn) {
        return function (...args) {
            syncFromState();
            try {
                const result = fn.apply(this, args);
                if (result && typeof result.then === 'function') {
                    return result.finally(() => {
                        syncToState();
                    });
                }
                syncToState();
                return result;
            } catch (error) {
                syncToState();
                throw error;
            }
        };
    }

    const shared = window.AdminBiblio.Shared || {};

    function escapeHtml(...args) { return shared.escapeHtml(...args); }
    function escapeJsString(...args) { return shared.escapeJsString(...args); }
    function encodeItemPayload(...args) { return shared.encodeItemPayload(...args); }
    function decodeItemPayload(...args) { return shared.decodeItemPayload(...args); }
    function parseDate(...args) { return shared.parseDate(...args); }
    function showConfirmModal(...args) { return shared.showConfirmModal(...args); }
    function showPromptModal(...args) { return shared.showPromptModal(...args); }
    function runNonCriticalTask(...args) { return shared.runNonCriticalTask(...args); }
    function isActiveLoanState(...args) { return shared.isActiveLoanState(...args); }
    function resetServiceSelection(...args) { return shared.resetServiceSelection(...args); }
    function clearLiveAssetStreams() {
        if (state.pcGridUnsub) {
            try { state.pcGridUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing PC stream:', error); }
            state.pcGridUnsub = null;
        }

        if (_configAssetsUnsub) {
            try { _configAssetsUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing config stream:', error); }
            _configAssetsUnsub = null;
        }

        state.configAssetsUnsub = null;
    }

    function cleanupRuntime(...args) { return window.AdminBiblio.cleanupRuntime(...args); }
    function init(...args) { return window.AdminBiblio.init(...args); }
    function terminarVisita(...args) { return window.AdminBiblio.terminarVisita(...args); }
    function initAdmin(...args) { return window.AdminBiblio.initAdmin(...args); }
    function forzarRecargaCache(...args) { return window.AdminBiblio.forzarRecargaCache(...args); }
    function startClock(...args) { return window.AdminBiblio.startClock(...args); }
    function loadAdminStats(...args) { return window.AdminBiblio.loadAdminStats(...args); }
    function showAdminItemDetail(...args) { return window.AdminBiblio.showAdminItemDetail(...args); }
    function confirmarEntregaApartado(...args) { return window.AdminBiblio.confirmarEntregaApartado(...args); }
    function registrarPagoDeuda(...args) { return window.AdminBiblio.registrarPagoDeuda(...args); }
    function abrirModalHistorial(...args) { return window.AdminBiblio.abrirModalHistorial(...args); }
    function cargarHistorial(...args) { return window.AdminBiblio.cargarHistorial(...args); }
    function generarItemHistorial(...args) { return window.AdminBiblio.generarItemHistorial(...args); }
    function abrirModalVisita(...args) { return window.AdminBiblio.abrirModalVisita(...args); }
    function renderVisitModalContent(...args) { return window.AdminBiblio.renderVisitModalContent(...args); }
    function verificarUsuarioVisita(...args) { return window.AdminBiblio.verificarUsuarioVisita(...args); }
    function toggleTeamForm(...args) { return window.AdminBiblio.toggleTeamForm(...args); }
    function mostrarRegistroAnonimo(...args) { return window.AdminBiblio.mostrarRegistroAnonimo(...args); }
    function addTeamMember(...args) { return window.AdminBiblio.addTeamMember(...args); }
    function confirmarVisitaDirecta(...args) { return window.AdminBiblio.confirmarVisitaDirecta(...args); }
    function confirmarVisitaUnregistered(...args) { return window.AdminBiblio.confirmarVisitaUnregistered(...args); }
    function abrirModalPrestamo(...args) { return window.AdminBiblio.abrirModalPrestamo(...args); }
    function consultarPrestamo(...args) { return window.AdminBiblio.consultarPrestamo(...args); }
    function confirmarPrestamo(...args) { return window.AdminBiblio.confirmarPrestamo(...args); }
    function abrirModalDevolucion(...args) { return window.AdminBiblio.abrirModalDevolucion(...args); }
    function consultarDevolucion(...args) { return window.AdminBiblio.consultarDevolucion(...args); }
    function perdonarRetrasoModal(...args) { return window.AdminBiblio.perdonarRetrasoModal(...args); }
    function confirmarDevolucion(...args) { return window.AdminBiblio.confirmarDevolucion(...args); }
    function abrirModalComputadoras(...args) { return window.AdminBiblio.abrirModalComputadoras(...args); }
    function forzarLimpiezaPCs(...args) { return window.AdminBiblio.forzarLimpiezaPCs(...args); }
    function loadPCGrid(...args) { return window.AdminBiblio.loadPCGrid(...args); }
    function asignarPC(...args) { return window.AdminBiblio.asignarPC(...args); }
    function handleAssetClick(...args) { return window.AdminBiblio.handleAssetClick(...args); }
    function mostrarLibrosUsuario(...args) { return window.AdminBiblio.mostrarLibrosUsuario(...args); }
    function confirmarRenovacion(...args) { return window.AdminBiblio.confirmarRenovacion(...args); }
    function confirmarRecibirSinLibro(...args) { return window.AdminBiblio.confirmarRecibirSinLibro(...args); }
    function abrirModalServicio(...args) { return window.AdminBiblio.abrirModalServicio(...args); }
    function renderAvailabilityGrid(...args) { return window.AdminBiblio.renderAvailabilityGrid(...args); }
    function selectSlot(...args) { return window.AdminBiblio.selectSlot(...args); }
    function confirmarReserva(...args) { return window.AdminBiblio.confirmarReserva(...args); }

    function abrirModalGestionLibros() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');

        // [FIX] Ensure unique modal handling
        // We are using the MAIN admin modal (modal-admin-action)
        // If we are replacing content, we don't need to re-show if it's already shown.
        // But if we come from another 'modal' (which are just replaced content), it's fine.
        // The issue 'keeps dark' usually implies multiple backdrops.
        // We will force remove backdrops if we are re-initializing, BUT
        // the best way with Bootstrap is to use the existing instance.

        const modalEl = document.getElementById('modal-admin-action');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        body.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-book-half me-3"></i>Gestión de Libros</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-5  text-center">
                <div class="row g-4 justify-content-center">
                    <div class="col-md-5">
                        <button class="btn btn-white w-100 p-4 shadow-sm rounded-4 border hover-lift" onclick="AdminBiblio.renderBookForm()">
                            <div class="bg-success bg-opacity-10 rounded-circle p-3 d-inline-block mb-3">
                                <i class="bi bi-plus-lg fs-1 text-success"></i>
                            </div>
                            <h5 class="fw-bold text-dark">Agregar Nuevo</h5>
                            <p class="text-muted small mb-0">Registrar un nuevo libro en el catálogo.</p>
                        </button>
                    </div>
                    <div class="col-md-5">
                        <button class="btn btn-white w-100 p-4 shadow-sm rounded-4 border hover-lift" onclick="AdminBiblio.renderBookEditSearch()">
                            <div class="bg-warning bg-opacity-10 rounded-circle p-3 d-inline-block mb-3">
                                <i class="bi bi-pencil-fill fs-1 text-warning"></i>
                            </div>
                            <h5 class="fw-bold text-dark">Modificar Existente</h5>
                            <p class="text-muted small mb-0">Buscar y actualizar datos de un libro.</p>
                        </button>
                    </div>
                </div>
            </div>
         `;

        // Show if not shown
        if (!modalEl.classList.contains('show')) {
            modal.show();
        }

        // Listen for hidden to cleanup backdrop just in case
        modalEl.removeEventListener('hidden.bs.modal', _cleanupBackdrop); // Avoid dups
        modalEl.addEventListener('hidden.bs.modal', _cleanupBackdrop);
    }


    function _cleanupBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
            backdrops.forEach(b => b.remove());
            document.body.classList.remove('modal-open');
        }
    }


    async function renderBookForm(bookToEdit = null) {
        // Validation: If adding new, fields empty. If editing, pre-fill.
        const isEdit = !!bookToEdit;
        const title = isEdit ? 'Modificar Libro' : 'Agregar Nuevo Libro';
        const btnText = isEdit ? 'Actualizar Libro' : 'Guardar Libro';
        const btnColor = isEdit ? 'btn-warning' : 'btn-success';

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 ${isEdit ? 'bg-warning' : 'bg-success'} text-white px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi ${isEdit ? 'bi-pencil-square' : 'bi-plus-circle'} me-2"></i>${title}</h5>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 ">
                <form id="book-form" onsubmit="event.preventDefault(); AdminBiblio.saveBook('${bookToEdit?.id || ''}')">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label small fw-bold text-muted">No. Adquisición *</label>
                            <input type="text" class="form-control rounded-3" id="bf-adq" required value="${escapeHtml(bookToEdit?.adquisicion || '')}" ${isEdit ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-8">
                            <label class="form-label small fw-bold text-muted">Título del Libro *</label>
                            <input type="text" class="form-control rounded-3" id="bf-titulo" required value="${escapeHtml(bookToEdit?.titulo || '')}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Autor *</label>
                            <input type="text" class="form-control rounded-3" id="bf-autor" required value="${escapeHtml(bookToEdit?.autor || '')}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-bold text-muted">Año</label>
                            <input type="text" class="form-control rounded-3" id="bf-anio" value="${escapeHtml(bookToEdit?.año || '')}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-bold text-muted">Copias Totales *</label>
                            <input type="number" class="form-control rounded-3" id="bf-copias" required min="1" value="${bookToEdit?.copiasTotales ?? bookToEdit?.copiasDisponibles ?? 1}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Categoría *</label>
                            <select class="form-select rounded-3" id="bf-cat" required>
                                <option value="">Selecciona...</option>
                                <option value="Administración">Administración</option>
                                <option value="Arquitectura">Arquitectura</option>
                                <option value="Ciencias Básicas">Ciencias Básicas</option>
                                <option value="Gastronomía">Gastronomía</option>
                                <option value="Literatura">Literatura</option>
                                <option value="General">General</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Clasificación / Ubicación</label>
                            <input type="text" class="form-control rounded-3" id="bf-clasif" placeholder="Ej: HM251 W46" value="${escapeHtml(bookToEdit?.clasificacion || '')}">
                        </div>
                    </div>
                    <div class="d-grid mt-4">
                        <button type="submit" class="btn ${btnColor} py-2 rounded-pill fw-bold shadow-sm">
                            <i class="bi bi-check-lg me-2"></i>${btnText}
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Retrieve and set category if editing
        if (bookToEdit?.categoria) {
            const sel = document.getElementById('bf-cat');
            if (sel) sel.value = bookToEdit.categoria;
        }
    }


    async function saveBook(editId) {
        const data = {
            adquisicion: document.getElementById('bf-adq').value.trim().toUpperCase(),
            titulo: document.getElementById('bf-titulo').value.trim(),
            autor: document.getElementById('bf-autor').value.trim(),
            año: document.getElementById('bf-anio').value.trim(),
            copiasTotales: parseInt(document.getElementById('bf-copias').value, 10),
            categoria: document.getElementById('bf-cat').value,
            clasificacion: document.getElementById('bf-clasif').value.trim(),
            ubicacion: 'Estantería' // Default
        };

        if (!data.adquisicion || !data.titulo || !data.autor || !data.categoria) {
            return showToast("Completa los campos obligatorios (*)", "warning");
        }

        try {
            if (editId) {
                await BiblioService.updateLibro(_ctx, editId, data);
                showToast("Libro actualizado correctamente", "success");
            } else {
                // Check dup adquisicion? usually service handles or just allow.
                await BiblioService.addLibro(_ctx, data);
                showToast("Libro registrado exitosamente", "success");
            }
            AdminBiblio.abrirModalGestionLibros(); // Go back
        } catch (e) {
            showToast("Error al guardar: " + e.message, "danger");
        }
    }


    async function renderBookEditSearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-warning text-dark px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-search me-2"></i>Buscar para Modificar</h5>
                <button class="btn-close" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 ">
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="edit-search-input" placeholder="Ingresa No. Adquisición (Ej: 00001)">
                    <button class="btn btn-warning px-4 fw-bold" onclick="AdminBiblio.handleEditSearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                
                <h6 class="fw-bold text-muted small mb-3 text-uppercase ls-1">Último Agregado / Resultado</h6>
                <div id="edit-search-result" class="card border-0 shadow-sm">
                    <div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando último registro...</div>
                </div>
            </div>
        `;

        // Load default (last added)
        try {
            const lastBook = await BiblioService.getLastAddedBook(_ctx);
            renderEditBookCard(lastBook);
        } catch (e) { console.error(e); }
    }


    async function handleEditSearch() {
        const q = document.getElementById('edit-search-input').value.trim();
        if (!q) return showToast("Ingresa un número de adquisición", "warning");

        const container = document.getElementById('edit-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando...</div>';

        try {
            const book = await BiblioService.getBookByAdquisicion(_ctx, q);
            renderEditBookCard(book, true);
        } catch (e) {
            container.innerHTML = `<div class="p-4 text-center text-danger">Error: ${e.message}</div>`;
        }
    }


    function renderEditBookCard(book, isSearch = false) {
        const container = document.getElementById('edit-search-result');
        if (!book) {
            container.innerHTML = `<div class="p-4 text-center text-muted opacity-75">${isSearch ? 'No se encontró el libro.' : 'No hay libros registrados manualmente aún.'}</div>`;
            return;
        }

        const bookPayload = encodeItemPayload(book);
        const adquisicion = escapeHtml(book.adquisicion || 'S/N');
        const titulo = escapeHtml(book.titulo || 'Sin título');
        const autor = escapeHtml(book.autor || 'Desconocido');

        container.innerHTML = `
            <div class="card-body d-flex align-items-center gap-3 p-3">
                <div class="bg-warning bg-opacity-10 p-3 rounded-3 text-warning">
                    <i class="bi bi-book fs-3"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="badge bg-dark text-white mb-1">${adquisicion}</div>
                    <h6 class="fw-bold mb-1 text-truncate">${titulo}</h6>
                    <small class="text-muted d-block text-truncate">${autor}</small>
                </div>
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('${bookPayload}'))">
                    Modificar <i class="bi bi-arrow-right ms-1"></i>
                </button>
            </div>
        `;
    }

    // --- 5. CONFIGURACION ---

    function abrirModalConfig() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-dark text-white p-4">
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-opacity-10 p-3 rounded-circle">
                         <i class="bi bi-gear-fill fs-3 text-white"></i>
                    </div>
                    <div>
                        <h3 class="fw-bold mb-0">Configuración de Espacios</h3>
                        <p class="small text-white-50 mb-0">Gestiona mesas y computadoras activas</p>
                    </div>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0 ">
                 <div class="d-flex justify-content-between p-3 bg-white border-bottom">
                    <ul class="nav nav-pills gap-2" role="tablist">
                        <li class="nav-item"><button class="nav-link active rounded-pill small fw-bold" data-bs-toggle="pill" data-bs-target="#tab-conf-mesas">Mesas</button></li>
                        <li class="nav-item"><button class="nav-link rounded-pill small fw-bold" data-bs-toggle="pill" data-bs-target="#tab-conf-pcs">PCs</button></li>
                        <li class="nav-item"><button class="nav-link rounded-pill small fw-bold" data-bs-toggle="pill" data-bs-target="#tab-conf-salas">Sala</button></li>
                    </ul>
                    <button class="btn btn-warning btn-sm rounded-pill fw-bold shadow-sm" onclick="AdminBiblio.openAddAssetModal()">
                        <i class="bi bi-plus-lg me-1"></i>Agregar
                    </button>
                 </div>
                 
                 <div class="tab-content p-4">
                    <div class="tab-pane fade show active" id="tab-conf-mesas"><div id="list-mesas" class="row g-3"></div></div>
                    <div class="tab-pane fade" id="tab-conf-pcs"><div id="list-pcs" class="row g-3"></div></div>
                    <div class="tab-pane fade" id="tab-conf-salas"><div id="list-salas" class="row g-3"></div></div>
                 </div>
            </div>
         `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();

        loadConfigAssets();
    }


    function loadConfigAssets() {
        if (_configAssetsUnsub) {
            _configAssetsUnsub();
            _configAssetsUnsub = null;
        }

        _configAssetsUnsub = BiblioAssetsService.streamAssetsAdmin(_ctx, (assets) => {
            const renderCard = (a) => `
                <div class="col-md-6 col-lg-6">
                    <div class="card h-100 shadow-sm border-0">
                        <div class="card-body d-flex align-items-center justify-content-between p-3">
                            <div class="d-flex align-items-center gap-3">
                                 <div class=" rounded-circle p-2 text-muted">
                                    <i class="bi bi-${a.tipo === 'pc' ? 'pc-display' : (a.tipo === 'mesa' ? 'table' : 'people')} fs-5"></i>
                                 </div>
                                 <div class="lh-sm">
                                     <div class="fw-bold text-dark">${escapeHtml(a.nombre || 'Activo')}</div>
                                     <small class="text-muted text-uppercase" style="font-size:0.65rem;">${escapeHtml(a.status || 'disponible')}</small>
                                 </div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" title="Habilitar/Deshabilitar" 
                                           ${a.status !== 'mantenimiento' ? 'checked' : ''} 
                                           onchange="AdminBiblio.toggleAssetStatus('${a.id}', this.checked)">
                                </div>
                                <button class="btn btn-sm text-danger opacity-50 hover-opacity-100" title="Eliminar definitivamente"
                                        onclick="AdminBiblio.confirmDeleteAsset('${escapeJsString(a.id)}', '${escapeJsString(a.nombre)}')">
                                    <i class="bi bi-trash-fill"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Separate lists
            const mesas = assets.filter(a => a.tipo === 'mesa').sort((a, b) => a.nombre.localeCompare(b.nombre));
            const pcs = assets.filter(a => a.tipo === 'pc').sort((a, b) => a.nombre.localeCompare(b.nombre));
            const salas = assets.filter(a => a.tipo === 'sala').sort((a, b) => a.nombre.localeCompare(b.nombre));

            const elM = document.getElementById('list-mesas');
            const elP = document.getElementById('list-pcs');
            const elS = document.getElementById('list-salas');

            if (elM) elM.innerHTML = mesas.length ? mesas.map(renderCard).join('') : '<div class="text-muted small text-center w-100">Sin mesas registradas</div>';
            if (elP) elP.innerHTML = pcs.length ? pcs.map(renderCard).join('') : '<div class="text-muted small text-center w-100">Sin PCs registradas</div>';
            if (elS) elS.innerHTML = salas.length ? salas.map(renderCard).join('') : '<div class="text-muted small text-center w-100">Sin salas registradas</div>';
        });
    }


    async function openAddAssetModal() {
        // Modal para seleccionar tipo
        const body = document.getElementById('modal-admin-body');
        // Save previous content to restore later? No, usually config is main. 
        // We can just re-render config on close or just show a modal on top.
        // Let's use the valid approach: A new modal on top or replace content temporarily.
        // Better: Use a small SweetAlert-style custom modal overlay like showConfirmModal

        const modalHtml = `
            <div class="modal fade" id="modal-add-asset" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="fw-bold">Agregar Nuevo Espacio</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4 text-center">
                            <p class="text-muted small mb-4">Selecciona el tipo de espacio a crear. El sistema asignará un nombre automáticamente (ej. MESA-09).</p>
                            <div class="row g-3 justify-content-center">
                                <div class="col-4">
                                    <button class="btn btn-outline-primary w-100 py-3 rounded-4 hover-scale" onclick="AdminBiblio.createAsset('mesa')">
                                        <i class="bi bi-table fs-1 d-block mb-2"></i>
                                        <span class="fw-bold small">Mesa</span>
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-info w-100 py-3 rounded-4 hover-scale" onclick="AdminBiblio.createAsset('pc')">
                                        <i class="bi bi-pc-display fs-1 d-block mb-2"></i>
                                        <span class="fw-bold small">PC</span>
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-success w-100 py-3 rounded-4 hover-scale" onclick="AdminBiblio.createAsset('sala')">
                                        <i class="bi bi-people fs-1 d-block mb-2"></i>
                                        <span class="fw-bold small">Sala</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove prev if exists
        document.getElementById('modal-add-asset')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById('modal-add-asset');
        const modal = new bootstrap.Modal(modalEl);

        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
            if (document.querySelector('.modal.show')) document.body.classList.add('modal-open');
        });

        modal.show();
    }


    async function createAsset(type) {
        // 1. Get current assets to calculate name
        // Close modal first to avoid double interaction or keep it? Close it.
        const modalEl = document.getElementById('modal-add-asset');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        try {
            const assets = await BiblioAssetsService.getAssetsOnce(_ctx);
            // Filter by type
            const sameType = assets.filter(a => a.tipo === type);

            // Generate Name: "MESA-01" -> extract number
            // Regex to find max number
            let maxNum = 0;
            const prefix = type === 'pc' ? 'PC' : (type === 'mesa' ? 'MESA' : 'SALA');

            sameType.forEach(a => {
                const parts = a.nombre.match(/(\d+)$/);
                if (parts) {
                    const num = parseInt(parts[0], 10);
                    if (num > maxNum) maxNum = num;
                }
            });

            const nextNum = maxNum + 1;
            const newName = `${type === 'mesa' ? 'Mesa' : (type === 'pc' ? 'PC' : 'Sala')} ${nextNum}`; // Display Name "Mesa 9"

            // Confirm creation? User said "Solo que confirme que se agregara".
            // Let's just do it and show toast, or standard confirm? 
            // "Show a mini modal asking type... Just allow... confirm that it will be added"

            showConfirmModal({
                icon: type === 'pc' ? 'pc-display' : (type === 'mesa' ? 'table' : 'people'),
                iconColor: '#0dcaf0',
                title: 'Crear Espacio',
                message: `¿Crear <strong>${newName}</strong>?`,
                confirmText: 'Sí, Crear',
                confirmClass: 'btn-success',
                onConfirm: async () => {
                    await BiblioAssetsService.saveAsset(_ctx, null, { nombre: newName, tipo: type });
                    showToast("✅ Espacio creado: " + newName, "success");
                }
            });

        } catch (e) {
            showToast("Error: " + e.message, "danger");
        }
    }


    async function confirmDeleteAsset(id, nombre) {
        showConfirmModal({
            icon: 'trash-fill',
            iconColor: '#dc3545',
            title: 'Eliminar Espacio',
            message: `¿Estás seguro de eliminar <strong>${escapeHtml(nombre)}</strong>?<br>Esta acción es irreversible.`,
            confirmText: 'Eliminar',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                try {
                    await BiblioAssetsService.deleteAsset(_ctx, id);
                    showToast("Espacio eliminado", "info");
                } catch (e) {
                    showToast(e.message, "danger");
                }
            }
        });
    }


    async function toggleAssetStatus(id, active) {
        try {
            await BiblioAssetsService.saveAsset(_ctx, id, { status: active ? 'disponible' : 'mantenimiento' });
            // showToast("Estado actualizado", "success"); // Too noisy
        } catch (e) { showToast(e.message || "Error al actualizar", "danger"); }
    }

    // --- SERVICIOS DIGITALES (PC / SALAS) ---



    return {
        abrirModalGestionLibros: withState(abrirModalGestionLibros),
        _cleanupBackdrop: withState(_cleanupBackdrop),
        renderBookForm: withState(renderBookForm),
        saveBook: withState(saveBook),
        renderBookEditSearch: withState(renderBookEditSearch),
        handleEditSearch: withState(handleEditSearch),
        renderEditBookCard: withState(renderEditBookCard),
        abrirModalConfig: withState(abrirModalConfig),
        loadConfigAssets: withState(loadConfigAssets),
        openAddAssetModal: withState(openAddAssetModal),
        createAsset: withState(createAsset),
        confirmDeleteAsset: withState(confirmDeleteAsset),
        toggleAssetStatus: withState(toggleAssetStatus)
    };
})();
