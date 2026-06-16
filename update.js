const fs = require('fs');

const filePath = 'c:/Users/larr_/Documents/SIA-tecnm-main/public/modules/admin-biblio/catalogo.js';
let code = fs.readFileSync(filePath, 'utf8');
let lines = code.split('\n');

const newCode = `    function abrirModalGestionLibros() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');
        const modalEl = document.getElementById('modal-admin-action');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        body.innerHTML = \`
            <div class="modal-header border-0 bg-primary text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-book-half me-3"></i>Gestion de Libros</h3>
                    <div class="small text-white-50">Elige primero el flujo que necesitas.</div>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-3 p-md-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                
                <div class="row g-4">
                    <div class="col-12 col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100" style="cursor: pointer;" onclick="AdminBiblio.abrirSubmodalGestionarLibros()">
                            <div class="card-body p-4 text-center">
                                <div class="bg-success bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-journals fs-3 text-success"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-2">Gestionar libros</h5>
                                <p class="small text-muted mb-0">Agregar, editar o dar de baja ejemplares en el catalogo.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100" style="cursor: pointer;" onclick="AdminBiblio.abrirSubmodalEtiquetas()">
                            <div class="card-body p-4 text-center">
                                <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-tags fs-3 text-primary"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-2">Generar etiquetas</h5>
                                <p class="small text-muted mb-0">Impresion de codigos de barras y lomos.</p>
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100 bg-danger-subtle">
                            <div class="card-body p-4 text-center">
                                <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center text-danger shadow-sm mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-clipboard2-data fs-3"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-3">Inventario Semestral</h5>
                                <button class="btn btn-danger rounded-pill fw-bold w-100 mb-3" type="button" onclick="AdminBiblio.abrirModalInventario()">
                                    <i class="bi bi-play-circle me-2"></i>Abrir inventario
                                </button>
                                <div class="small fw-bold text-muted text-uppercase mb-2 text-start">Sesion actual</div>
                                <div id="gestion-libros-inventory-status" class="rounded-4 border bg-white p-3 text-muted small text-start">
                                    <span class="spinner-border spinner-border-sm me-2"></span>Revisando estado...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
         \`;

        if (!modalEl.classList.contains('show')) {
            modal.show();
        }

        modalEl.removeEventListener('hidden.bs.modal', _cleanupBackdrop);
        modalEl.addEventListener('hidden.bs.modal', _cleanupBackdrop);

        void refreshGestionLibrosInventoryStatus();
    }

    function abrirSubmodalEtiquetas() {
        showToast('Generador de etiquetas en construccion', 'info');
    }

    function abrirSubmodalGestionarLibros() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = \`
            <div class="modal-header border-0 bg-success text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-journals me-3"></i>Gestionar libros</h3>
                    <div class="small text-white-50">Administra el catalogo de ejemplares.</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="d-flex flex-column gap-3 mb-4">
                    <button class="btn btn-white border shadow-sm rounded-pill p-3 text-start d-flex align-items-center" onclick="AdminBiblio.renderBookForm()">
                        <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;">
                            <i class="bi bi-plus-lg text-success"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">Agregar nuevo libro</div>
                            <div class="small text-muted">Registrar un ejemplar que no existe en el sistema.</div>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </button>
                    
                    <button class="btn btn-white border shadow-sm rounded-pill p-3 text-start d-flex align-items-center" onclick="AdminBiblio.renderBookEditSearch()">
                        <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;">
                            <i class="bi bi-pencil-square text-warning"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">Modificar libro</div>
                            <div class="small text-muted">Editar informacion de un ejemplar existente.</div>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </button>

                    <button class="btn btn-white border shadow-sm rounded-pill p-3 text-start d-flex align-items-center" onclick="AdminBiblio.renderBookStatusSearch()">
                        <div class="bg-danger bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;">
                            <i class="bi bi-power text-danger"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">Habilitar / Deshabilitar</div>
                            <div class="small text-muted">Dar de baja ejemplares o reactivarlos.</div>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </button>
                </div>

                <div class="small fw-bold text-muted text-uppercase mb-2">Ultimo agregado</div>
                <div id="gestion-libros-last-book" class="rounded-4 border bg-white shadow-sm p-3 text-muted small">
                    <span class="spinner-border spinner-border-sm me-2"></span>Cargando referencia...
                </div>
            </div>
        \`;

        void (async () => {
            try {
                const lastBook = await BiblioService.getLastAddedBook(_ctx);
                const lastBookEl = document.getElementById('gestion-libros-last-book');
                if (lastBookEl) {
                    if (!lastBook) {
                        lastBookEl.innerHTML = 'Aun no hay libros registrados manualmente.';
                    } else {
                        lastBookEl.innerHTML = \`
                            <div class="fw-semibold text-dark text-truncate">\${escapeHtml(lastBook.titulo || 'Sin titulo')}</div>
                            <div class="small text-muted text-truncate">\${escapeHtml(lastBook.autor || 'Autor no registrado')}</div>
                            <div class="mt-2"><span class="badge bg-dark text-white">\${escapeHtml(lastBook.adquisicion || 'S/N')}</span></div>
                        \`;
                    }
                }
            } catch (error) {
                console.error(error);
            }
        })();
    }

    function _cleanupBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
            backdrops.forEach(b => b.remove());
            document.body.classList.remove('modal-open');
        }
    }

    async function getNextSequentialAdquisicion(baseAdq) {
        if (!baseAdq) return String(Math.floor(10000 + Math.random() * 90000));
        
        const match = baseAdq.match(/^([a-zA-Z\\-]*)(\\d+)$/);
        if (match) {
            const prefix = match[1];
            let numStr = match[2];
            let num = parseInt(numStr, 10);
            
            let exists = true;
            let attempts = 0;
            while (exists && attempts < 20) {
                num++;
                let newNumStr = String(num).padStart(numStr.length, '0');
                let newAdq = prefix + newNumStr;
                try {
                    const book = await BiblioService.getBookByAdquisicion(_ctx, newAdq);
                    exists = !!book;
                    if (!exists) return newAdq;
                } catch (e) { exists = true; }
                attempts++;
            }
        }
        
        return String(Math.floor(10000 + Math.random() * 90000));
    }

    async function generateRandomAdquisicion(inputId, inputElement = null) {
        const el = inputElement || document.getElementById(inputId);
        if (!el) return;
        
        el.disabled = true;
        const originalValue = el.value;
        el.value = 'Generando...';
        
        try {
            let baseAdq = '';
            const mainInput = document.getElementById('bf-adq');
            if (mainInput && mainInput.value && mainInput.value !== 'Generando...' && mainInput !== el) {
                baseAdq = mainInput.value.trim();
            } else if (originalValue) {
                baseAdq = originalValue.trim();
            }

            let adq = await getNextSequentialAdquisicion(baseAdq);
            el.value = adq;
        } catch (e) {
            el.value = originalValue;
            showToast('Error autogenerando numero.', 'danger');
        } finally {
            el.disabled = false;
        }
    }

    function addCopyRow() {
        const container = document.getElementById('copies-container');
        const id = 'copy-' + Date.now();
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 copy-row align-items-center mb-2';
        div.id = id;
        div.innerHTML = \`
            <div class="input-group input-group-sm">
                <span class="input-group-text bg-light text-muted">Copia</span>
                <input type="text" class="form-control copy-adq-input" required placeholder="No. Adquisicion">
                <button class="btn btn-outline-secondary" type="button" onclick="AdminBiblio.generateRandomAdquisicion(null, this.previousElementSibling)" title="Generar numero secuencial">
                    <i class="bi bi-magic"></i>
                </button>
            </div>
            <button class="btn btn-outline-danger btn-sm" type="button" onclick="document.getElementById('\${id}').remove()">
                <i class="bi bi-trash"></i>
            </button>
        \`;
        container.appendChild(div);
        
        const allInputs = container.querySelectorAll('.copy-adq-input');
        if (allInputs.length > 0) {
            const input = allInputs[allInputs.length - 1];
            AdminBiblio.generateRandomAdquisicion(null, input);
        }
    }

    function renderCopySearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = \`
            <div class="modal-header border-0 bg-primary text-white px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-files me-2"></i>Agregar Copia Existente</h5>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.renderBookForm()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="small text-muted mb-3">Busca el libro original por su numero de adquisicion para copiar sus datos.</div>
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="copy-search-input" placeholder="Ingresa No. Adquisicion del libro original (Ej: 00001)">
                    <button class="btn btn-primary px-4 fw-bold" onclick="AdminBiblio.handleCopySearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                <div id="copy-search-result" class="card border-0 shadow-sm">
                    <div class="text-center py-4 text-muted"><i class="bi bi-info-circle mb-2 fs-3 d-block"></i>Ingresa un codigo para buscar.</div>
                </div>
            </div>
        \`;
    }

    async function handleCopySearch() {
        const q = document.getElementById('copy-search-input').value.trim();
        if (!q) return showToast("Ingresa un numero de adquisicion", "warning");

        const container = document.getElementById('copy-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando...</div>';

        try {
            const snap = await _ctx.db.collection('biblio-catalogo')
                .where('adquisicion', '==', q.toUpperCase())
                .limit(1).get();
                
            if (snap.empty) {
                container.innerHTML = '<div class="p-4 text-center text-muted">No se encontro el libro original.</div>';
                return;
            }
            
            const book = { id: snap.docs[0].id, ...snap.docs[0].data() };
            const bookPayload = encodeItemPayload(book);
            const titulo = escapeHtml(book.titulo || 'Sin titulo');
            const autor = escapeHtml(book.autor || 'Desconocido');

            const nextAdq = await getNextSequentialAdquisicion(book.adquisicion);
            book.adquisicion = nextAdq; 
            const nextPayload = encodeItemPayload(book);

            container.innerHTML = \`
                <div class="card-body p-4">
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="bg-primary bg-opacity-10 p-3 rounded-3 text-primary">
                            <i class="bi bi-book fs-3"></i>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="fw-bold mb-1 text-truncate">\${titulo}</h6>
                            <small class="text-muted d-block text-truncate">\${autor}</small>
                        </div>
                    </div>
                    <div class="alert alert-info py-2 px-3 small d-flex flex-column gap-2 mb-0">
                        <span>Sugerencia autogenerada para la nueva copia: <strong>\${nextAdq}</strong></span>
                        <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold w-100" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('\${nextPayload}'), true)">
                            Usar datos y continuar <i class="bi bi-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            \`;
        } catch (e) {
            container.innerHTML = \`<div class="p-4 text-center text-danger">Error: \${e.message}</div>\`;
        }
    }

    async function renderBookForm(bookToEdit = null, isCopyMode = false) {
        const isEdit = !!bookToEdit && !isCopyMode;
        const title = isEdit ? 'Modificar Libro' : (isCopyMode ? 'Agregar Copia' : 'Agregar Nuevo Libro');
        const btnText = isEdit ? 'Actualizar Libro' : (isCopyMode ? 'Guardar Copia' : 'Guardar Libro(s)');
        const btnColor = isEdit ? 'btn-warning' : 'btn-success';

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = \`
            <div class="modal-header border-0 \${isEdit ? 'bg-warning' : 'bg-success'} text-white px-4 py-3">
                <div>
                    <h5 class="fw-bold mb-1"><i class="bi \${isEdit ? 'bi-pencil-square' : 'bi-plus-circle'} me-2"></i>\${title}</h5>
                    <div class="small \${isEdit ? 'text-dark-emphasis' : 'text-white-50'}">\${isEdit ? 'Ajusta el registro localizado antes de guardar.' : 'Captura los datos para darlo de alta en el catalogo.'}</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirSubmodalGestionarLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                \${!isEdit && !isCopyMode ? \`
                    <div class="d-flex justify-content-end mb-3">
                        <button class="btn btn-outline-primary btn-sm rounded-pill fw-bold" onclick="AdminBiblio.renderCopySearch()">
                            <i class="bi bi-files me-1"></i>Agregar una copia existente
                        </button>
                    </div>
                \` : ''}
                
                <div class="alert alert-light border rounded-4 shadow-sm mb-4">
                    <div class="small text-muted mb-0">\${isEdit ? 'El numero de adquisicion permanece fijo para evitar cambiar la referencia del ejemplar.' : (isCopyMode ? 'Se copiaron los detalles del libro original. Confirma el numero de adquisicion nuevo y guarda.' : 'Llena los campos para el libro principal. Podras agregar copias extra al final si lo deseas.')}</div>
                </div>
                <form id="book-form" onsubmit="event.preventDefault(); AdminBiblio.saveBook('\${isEdit ? (bookToEdit?.id || '') : ''}', \${isCopyMode})">
                    <div class="row g-3">
                        <div class="col-md-5">
                            <label class="form-label small fw-bold text-muted">No. Adquisicion *</label>
                            <div class="input-group">
                                <input type="text" class="form-control rounded-start" id="bf-adq" required placeholder="Ej. 01542" value="\${escapeHtml(bookToEdit?.adquisicion || '')}" \${isEdit ? 'readonly' : ''}>
                                \${!isEdit ? \`
                                <button class="btn btn-secondary" type="button" onclick="AdminBiblio.generateRandomAdquisicion('bf-adq')" title="Generar numero secuencial">
                                    <i class="bi bi-magic"></i>
                                </button>
                                \` : ''}
                            </div>
                        </div>
                        <div class="col-md-7">
                            <label class="form-label small fw-bold text-muted">Titulo del Libro *</label>
                            <input type="text" class="form-control rounded-3" id="bf-titulo" required placeholder="Nombre del libro" value="\${escapeHtml(bookToEdit?.titulo || '')}" \${isCopyMode ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Autor *</label>
                            <input type="text" class="form-control rounded-3" id="bf-autor" required placeholder="Autor principal" value="\${escapeHtml(bookToEdit?.autor || '')}" \${isCopyMode ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Anio</label>
                            <input type="text" class="form-control rounded-3" id="bf-anio" placeholder="2024" value="\${escapeHtml(bookToEdit?.anio ?? bookToEdit?.['año'] ?? '')}" \${isCopyMode ? 'readonly' : ''}>
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Categoria *</label>
                            <select class="form-select rounded-3" id="bf-cat" required \${isCopyMode ? 'disabled' : ''}>
                                <option value="">Selecciona...</option>
                                <option value="Administracion">Administracion</option>
                                <option value="Arquitectura">Arquitectura</option>
                                <option value="Ciencias Basicas">Ciencias Basicas</option>
                                <option value="Gastronomia">Gastronomia</option>
                                <option value="Literatura">Literatura</option>
                                <option value="General">General</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Clasificacion / Ubicacion</label>
                            <input type="text" class="form-control rounded-3" id="bf-clasif" placeholder="Ej: HM251 W46" value="\${escapeHtml(bookToEdit?.clasificacion || '')}" \${isCopyMode ? 'readonly' : ''}>
                        </div>
                    </div>
                    
                    \${!isEdit && !isCopyMode ? \`
                    <div class="mt-4 pt-3 border-top">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <label class="form-label small fw-bold text-muted mb-0">¿Este libro viene con copias extra?</label>
                            <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" onclick="AdminBiblio.addCopyRow()">
                                <i class="bi bi-plus-lg me-1"></i> Agregar copia
                            </button>
                        </div>
                        <div id="copies-container" class="d-flex flex-column gap-2">
                        </div>
                    </div>
                    \` : ''}

                    <div class="d-grid mt-4">
                        <button type="submit" class="btn \${btnColor} py-2 rounded-pill fw-bold shadow-sm" id="btn-save-book">
                            <i class="bi bi-check-lg me-2"></i>\${btnText}
                        </button>
                    </div>
                </form>
            </div>
        \`;

        if (bookToEdit?.categoria) {
            const sel = document.getElementById('bf-cat');
            if (sel) sel.value = bookToEdit.categoria;
        }
    }

    async function saveBook(editId, isCopyMode = false) {
        const adqInput = document.getElementById('bf-adq');
        const adqBase = adqInput ? adqInput.value.trim().toUpperCase() : '';
        const titulo = document.getElementById('bf-titulo').value.trim();
        const autor = document.getElementById('bf-autor').value.trim();
        const anio = document.getElementById('bf-anio').value.trim();
        const catInput = document.getElementById('bf-cat');
        const categoria = catInput ? catInput.value : '';
        const clasificacion = document.getElementById('bf-clasif').value.trim();

        if (!adqBase || !titulo || !autor || (!isCopyMode && !categoria)) {
            return showToast("Completa los campos obligatorios (*)", "warning");
        }

        const btnSave = document.getElementById('btn-save-book');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
        }

        try {
            const dataBase = {
                adquisicion: adqBase,
                titulo,
                autor,
                anio,
                copiasTotales: 1, 
                categoria: isCopyMode && catInput && catInput.disabled && catInput.querySelector('option[selected]') ? catInput.querySelector('option[selected]').value : categoria,
                clasificacion,
                ubicacion: 'Estanteria'
            };
            
            // Si estaba disabled, categoria no agarra el value bien. Vamos a forzarlo.
            if (isCopyMode && !dataBase.categoria) {
                // we have to get it from the bookToEdit if possible. Wait, the select maintains its value even if disabled, but let's be safe.
                if (catInput) dataBase.categoria = catInput.value;
            }

            if (editId) {
                await BiblioService.updateLibro(_ctx, editId, dataBase);
                showToast("Libro actualizado correctamente", "success");
            } else {
                await BiblioService.addLibro(_ctx, dataBase);
                let savedCount = 1;

                if (!isCopyMode) {
                    const copiesContainer = document.getElementById('copies-container');
                    if (copiesContainer) {
                        const copyInputs = copiesContainer.querySelectorAll('.copy-adq-input');
                        const copiesData = [];
                        copyInputs.forEach(input => {
                            const val = input.value.trim().toUpperCase();
                            if (val && val !== adqBase) {
                                copiesData.push({ ...dataBase, adquisicion: val });
                            }
                        });

                        for (const copyData of copiesData) {
                            try {
                                await BiblioService.addLibro(_ctx, copyData);
                                savedCount++;
                            } catch (err) {
                                console.error('Error saving copy', copyData.adquisicion, err);
                                showToast(\`Error al guardar copia \${copyData.adquisicion}\`, 'danger');
                            }
                        }
                    }
                }
                showToast(\`Se \${savedCount === 1 ? 'guardo 1 ejemplar' : 'guardaron ' + savedCount + ' ejemplares'} exitosamente\`, "success");
            }
            AdminBiblio.abrirSubmodalGestionarLibros(); 
        } catch (e) {
            showToast("Error al guardar: " + e.message, "danger");
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="bi bi-check-lg me-2"></i>Guardar';
            }
        }
    }

    async function renderBookEditSearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = \`
            <div class="modal-header border-0 bg-warning text-dark px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-search me-2"></i>Buscar para Modificar</h5>
                <button class="btn-close" onclick="AdminBiblio.abrirSubmodalGestionarLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="edit-search-input" placeholder="Ingresa No. Adquisicion (Ej: 00001)">
                    <button class="btn btn-warning px-4 fw-bold" onclick="AdminBiblio.handleEditSearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                
                <h6 class="fw-bold text-muted small mb-3 text-uppercase ls-1">Ultimo Agregado / Resultado</h6>
                <div id="edit-search-result" class="card border-0 shadow-sm">
                    <div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando ultimo registro...</div>
                </div>
            </div>
        \`;

        try {
            const lastBook = await BiblioService.getLastAddedBook(_ctx);
            renderEditBookCard(lastBook);
        } catch (e) { console.error(e); }
    }

    async function handleEditSearch() {
        const q = document.getElementById('edit-search-input').value.trim();
        if (!q) return showToast("Ingresa un numero de adquisicion", "warning");

        const container = document.getElementById('edit-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando...</div>';

        try {
            const snap = await _ctx.db.collection('biblio-catalogo')
                .where('adquisicion', '==', q.toUpperCase())
                .limit(1).get();
            
            if (snap.empty) {
                container.innerHTML = '<div class="p-4 text-center text-muted">No se encontro el libro.</div>';
                return;
            }
            const book = { id: snap.docs[0].id, ...snap.docs[0].data() };
            
            if (book.active === false) {
                container.innerHTML = \`
                    <div class="p-4 text-center">
                        <i class="bi bi-exclamation-circle text-danger fs-3 d-block mb-2"></i>
                        <h6 class="fw-bold text-dark">Libro Dado de Baja</h6>
                        <p class="small text-muted mb-3">Este ejemplar se encuentra deshabilitado en el sistema.</p>
                        <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('\${encodeItemPayload(book)}'))">
                            Modificar de todos modos
                        </button>
                    </div>
                \`;
                return;
            }
            
            renderEditBookCard(book, true);
        } catch (e) {
            container.innerHTML = \`<div class="p-4 text-center text-danger">Error: \${e.message}</div>\`;
        }
    }

    function renderEditBookCard(book, isSearch = false) {
        const container = document.getElementById('edit-search-result');
        if (!book) {
            container.innerHTML = \`<div class="p-4 text-center text-muted opacity-75">\${isSearch ? 'No se encontro el libro.' : 'No hay libros registrados manualmente aun.'}</div>\`;
            return;
        }

        const bookPayload = encodeItemPayload(book);
        const adquisicion = escapeHtml(book.adquisicion || 'S/N');
        const titulo = escapeHtml(book.titulo || 'Sin titulo');
        const autor = escapeHtml(book.autor || 'Desconocido');

        container.innerHTML = \`
            <div class="card-body d-flex align-items-center gap-3 p-3">
                <div class="bg-warning bg-opacity-10 p-3 rounded-3 text-warning">
                    <i class="bi bi-book fs-3"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="badge bg-dark text-white mb-1">\${adquisicion}</div>
                    <h6 class="fw-bold mb-1 text-truncate">\${titulo}</h6>
                    <small class="text-muted d-block text-truncate">\${autor}</small>
                </div>
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('\${bookPayload}'))">
                    Modificar <i class="bi bi-arrow-right ms-1"></i>
                </button>
            </div>
        \`;
    }

    function renderBookStatusSearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = \`
            <div class="modal-header border-0 bg-danger text-white px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-power me-2"></i>Habilitar / Deshabilitar</h5>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirSubmodalGestionarLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="status-search-input" placeholder="Ingresa No. Adquisicion (Ej: 00001)">
                    <button class="btn btn-danger px-4 fw-bold" onclick="AdminBiblio.handleStatusSearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                
                <h6 class="fw-bold text-muted small mb-3 text-uppercase ls-1">Resultado de busqueda</h6>
                <div id="status-search-result" class="card border-0 shadow-sm">
                    <div class="text-center py-4 text-muted"><i class="bi bi-info-circle mb-2 fs-3 d-block"></i>Busca un libro para cambiar su estado.</div>
                </div>
            </div>
        \`;
    }

    async function handleStatusSearch() {
        const q = document.getElementById('status-search-input').value.trim();
        if (!q) return showToast("Ingresa un numero de adquisicion", "warning");

        const container = document.getElementById('status-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando...</div>';

        try {
            const snap = await _ctx.db.collection('biblio-catalogo')
                .where('adquisicion', '==', q.toUpperCase())
                .limit(1).get();
                
            if (snap.empty) {
                container.innerHTML = '<div class="p-4 text-center text-muted">No se encontro el libro.</div>';
                return;
            }
            
            const book = { id: snap.docs[0].id, ...snap.docs[0].data() };
            renderStatusBookCard(book);
        } catch (e) {
            container.innerHTML = \`<div class="p-4 text-center text-danger">Error: \${e.message}</div>\`;
        }
    }

    function renderStatusBookCard(book) {
        const container = document.getElementById('status-search-result');
        if (!book) return;

        const isActive = book.active !== false;
        const adquisicion = escapeHtml(book.adquisicion || 'S/N');
        const titulo = escapeHtml(book.titulo || 'Sin titulo');
        const autor = escapeHtml(book.autor || 'Desconocido');
        const statusBadge = isActive 
            ? '<span class="badge bg-success mb-1">Activo</span>' 
            : '<span class="badge bg-danger mb-1">Dado de baja</span>';
            
        const btnAction = isActive 
            ? \`<button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold mt-2" onclick="AdminBiblio.toggleBookStatusFromSearch('\${book.id}', false)"><i class="bi bi-x-circle me-1"></i>Dar de baja</button>\`
            : \`<button class="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold mt-2" onclick="AdminBiblio.toggleBookStatusFromSearch('\${book.id}', true)"><i class="bi bi-check-circle me-1"></i>Reactivar</button>\`;

        container.innerHTML = \`
            <div class="card-body p-4 text-center">
                <div class="mb-3">
                    \${statusBadge}
                    <div class="badge bg-dark text-white mb-1 ms-1">\${adquisicion}</div>
                </div>
                <h5 class="fw-bold mb-1">\${titulo}</h5>
                <p class="text-muted small mb-3">\${autor}</p>
                \${btnAction}
            </div>
        \`;
    }

    async function toggleBookStatusFromSearch(bookId, isActive) {
        try {
            await BiblioService.toggleLibroStatus(_ctx, bookId, isActive);
            showToast(isActive ? 'Libro reactivado' : 'Libro dado de baja', 'success');
            AdminBiblio.handleStatusSearch();
        } catch (e) {
            showToast("Error al cambiar estado: " + e.message, "danger");
        }
    }\n`;

lines.splice(466, 762 - 466, newCode);

// now insert exports
let exportIndex = lines.findIndex(l => l.includes('abrirModalConfig: withState(abrirModalConfig)'));

const newExports = `        abrirSubmodalEtiquetas: withState(abrirSubmodalEtiquetas),
        abrirSubmodalGestionarLibros: withState(abrirSubmodalGestionarLibros),
        addCopyRow: withState(addCopyRow),
        generateRandomAdquisicion: withState(generateRandomAdquisicion),
        renderCopySearch: withState(renderCopySearch),
        handleCopySearch: withState(handleCopySearch),
        renderBookStatusSearch: withState(renderBookStatusSearch),
        handleStatusSearch: withState(handleStatusSearch),
        toggleBookStatusFromSearch: withState(toggleBookStatusFromSearch),`;

lines.splice(exportIndex, 0, newExports);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done!');
