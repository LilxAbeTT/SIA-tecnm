if (!window.AdminBiblio) window.AdminBiblio = {};

window.AdminBiblio.Buscador = (function () {
    const state = window.AdminBiblio.State;
    
    // Filtro activo actual (titulo, autor, adquisicion, clasificacion)
    let _activeFilter = 'titulo'; 

    function abrirBuscadorAvanzado() {
        const modalEl = document.getElementById('modal-admin-action');
        const body = document.getElementById('modal-admin-body');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        body.innerHTML = `
            <div class="modal-header border-0 bg-white p-4 pb-0 d-flex flex-column align-items-start position-relative">
                <button type="button" class="btn-close position-absolute top-0 end-0 m-3" data-bs-dismiss="modal" aria-label="Close"></button>
                <h4 class="fw-bold text-dark mb-3"><i class="bi bi-search me-2 text-primary"></i>Buscador Avanzado</h4>
                
                <div class="w-100 mb-3 d-flex gap-2 overflow-auto py-1" id="buscador-filtros">
                    <button class="btn btn-sm rounded-pill fw-medium ${ _activeFilter === 'titulo' ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-0 bg-light' }" onclick="AdminBiblio.Buscador.setFiltro('titulo')">
                        <i class="bi bi-fonts me-1"></i>Título
                    </button>
                    <button class="btn btn-sm rounded-pill fw-medium ${ _activeFilter === 'autor' ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-0 bg-light' }" onclick="AdminBiblio.Buscador.setFiltro('autor')">
                        <i class="bi bi-person me-1"></i>Autor
                    </button>
                    <button class="btn btn-sm rounded-pill fw-medium ${ _activeFilter === 'adquisicion' ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-0 bg-light' }" onclick="AdminBiblio.Buscador.setFiltro('adquisicion')">
                        <i class="bi bi-upc-scan me-1"></i>Adquisición
                    </button>
                    <button class="btn btn-sm rounded-pill fw-medium ${ _activeFilter === 'clasificacion' ? 'btn-primary shadow-sm' : 'btn-outline-secondary border-0 bg-light' }" onclick="AdminBiblio.Buscador.setFiltro('clasificacion')">
                        <i class="bi bi-tags me-1"></i>Clasificación
                    </button>
                </div>

                <div class="input-group input-group-lg shadow-sm rounded-pill overflow-hidden border mb-3 w-100">
                    <span class="input-group-text bg-white border-0 ps-4 text-muted"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control border-0 shadow-none fs-5 bg-white" id="buscador-input" placeholder="Buscar por ${_activeFilter}..." autocomplete="off" onkeydown="if(event.key === 'Enter') AdminBiblio.Buscador.buscar()">
                    <button class="btn btn-primary px-4 fw-bold" onclick="AdminBiblio.Buscador.buscar()">Buscar</button>
                </div>
            </div>
            
            <div class="modal-body p-4 bg-light" style="min-height: 400px;">
                <div id="buscador-resultados" class="d-flex flex-column gap-3">
                    <div class="text-center text-muted py-5 mt-4">
                        <i class="bi bi-journal-text display-3 mb-3 opacity-25 d-block"></i>
                        <h5 class="fw-bold">Ingresa tu búsqueda</h5>
                        <p class="small">Selecciona el tipo de búsqueda y presiona Enter.</p>
                    </div>
                </div>
            </div>
        `;

        const modalContent = modalEl.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.remove('overflow-hidden');
            modalContent.style.setProperty('overflow', 'visible', 'important');
            modalContent.style.position = 'relative';
            
            let sidePanel = document.getElementById('buscador-side-panel');
            if (!sidePanel) {
                sidePanel = document.createElement('div');
                sidePanel.id = 'buscador-side-panel';
                // Usamos d-none para ocultar inicialmente y flex-column para cuando se muestre
                sidePanel.className = 'bg-white rounded-4 shadow-lg d-none flex-column overflow-hidden position-absolute border';
                sidePanel.style.width = '320px';
                sidePanel.style.top = '0';
                sidePanel.style.bottom = '0'; // Obliga a tener la misma altura que modalContent
                sidePanel.style.left = '100%';
                sidePanel.style.marginLeft = '15px'; // Distancia de separacion a la derecha
                sidePanel.style.zIndex = '1050';
                modalContent.appendChild(sidePanel);
            } else {
                sidePanel.classList.remove('d-flex');
                sidePanel.classList.add('d-none');
            }

            sidePanel.innerHTML = `
                <div class="p-4 d-flex justify-content-between align-items-center border-bottom">
                    <div class="fw-bold text-muted text-uppercase small">Lista de Impresión</div>
                    <button class="btn btn-sm btn-outline-danger" onclick="AdminBiblio.clearLabelsQueue()">Limpiar Lista</button>
                </div>
                <div id="labels-queue-container" class="list-group list-group-flush mb-0 flex-grow-1 overflow-auto">
                    <div class="list-group-item text-center py-4 text-muted border-0 bg-transparent">La lista de impresión está vacía.</div>
                </div>
                <div class="p-4 border-top mt-auto bg-light">
                    <button class="btn btn-dark rounded-pill fw-bold w-100 p-3" id="btn-export-labels" onclick="AdminBiblio.exportLabelsPdf()" disabled>
                        <i class="bi bi-file-earmark-pdf me-2"></i>Exportar PDF
                    </button>
                </div>
            `;
        }

        if (!modalEl.classList.contains('show')) {
            modal.show();
        }

        setTimeout(() => {
            document.getElementById('buscador-input')?.focus();
            if (window.AdminBiblio && window.AdminBiblio.renderLabelsQueue) {
                window.AdminBiblio.renderLabelsQueue();
            } else if (window.AdminBiblio && window.AdminBiblio.Catalogo && window.AdminBiblio.Catalogo.renderLabelsQueue) {
                window.AdminBiblio.Catalogo.renderLabelsQueue();
            }
        }, 300);
    }

    function setFiltro(filtro) {
        _activeFilter = filtro;
        const container = document.getElementById('buscador-filtros');
        if (!container) return;

        // Actualizar UI de botones
        const buttons = container.querySelectorAll('button');
        buttons.forEach(btn => {
            const isMatch = btn.getAttribute('onclick').includes(filtro);
            if (isMatch) {
                btn.className = 'btn btn-sm rounded-pill fw-medium btn-primary shadow-sm';
            } else {
                btn.className = 'btn btn-sm rounded-pill fw-medium btn-outline-secondary border-0 bg-light';
            }
        });

        const input = document.getElementById('buscador-input');
        if (input) {
            input.placeholder = `Buscar por ${filtro}...`;
            input.focus();
        }
    }

    async function buscar() {
        const input = document.getElementById('buscador-input');
        const q = (input?.value || '').trim();
        const container = document.getElementById('buscador-resultados');
        if (!container) return;

        if (!q) {
            AdminBiblio.Shared.showToast("Ingresa un término de búsqueda", "warning");
            return;
        }

        container.innerHTML = '<div class="text-center text-muted py-5"><div class="spinner-border text-primary mb-3"></div><div class="fw-bold">Buscando...</div></div>';

        try {
            // Busqueda cacheada general
            let rawResults = await BiblioService.searchCatalogoAdmin(state.ctx, q, 100);
            
            // Si el filtro no es titulo/general, filtramos localmente los resultados para enfocar la búsqueda
            if (_activeFilter === 'adquisicion') {
                rawResults = rawResults.filter(b => b.adquisicion && b.adquisicion.toUpperCase().includes(q.toUpperCase()));
            } else if (_activeFilter === 'autor') {
                rawResults = rawResults.filter(b => b.autor && b.autor.toLowerCase().includes(q.toLowerCase()));
            } else if (_activeFilter === 'clasificacion') {
                rawResults = rawResults.filter(b => b.clasificacion && b.clasificacion.toLowerCase().includes(q.toLowerCase()));
            }

            if (rawResults.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5 mt-4">
                        <i class="bi bi-emoji-frown display-3 mb-3 opacity-25 d-block"></i>
                        <h5 class="fw-bold">No se encontraron resultados</h5>
                        <p class="small">Verifica que escribiste correctamente o intenta con otro filtro.</p>
                    </div>
                `;
                return;
            }

            // AGRUPAR POR TITULO Y AUTOR (Vista Enfocada)
            const grouped = {};
            const keysToFetch = [];
            for (const b of rawResults) {
                // Key combinada para asegurar que es la misma obra
                const key = `${(b.titulo || '').trim().toLowerCase()}||${(b.autor || '').trim().toLowerCase()}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        titulo: b.titulo,
                        autor: b.autor,
                        clasificacion: b.clasificacion || '',
                        portada: b.portada || null,
                        copies: []
                    };
                    keysToFetch.push({ key, titulo: b.titulo, autor: b.autor });
                }
            }

            // Consultas en paralelo usando la caché (evitando múltiples lecturas a Firestore)
            await Promise.all(keysToFetch.map(async (item) => {
                let allCopies = await BiblioService.getCopiesByTitleAndAuthorAdmin(state.ctx, item.titulo, item.autor);

                // Ordenar por createdAt o numero de adquisicion para determinar Original
                allCopies.sort((a, b) => {
                    if (a.createdAt && b.createdAt) {
                        const timeA = a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAtMs || 0);
                        const timeB = b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAtMs || 0);
                        if (timeA !== timeB) return timeA - timeB;
                    }
                    const adqA = a.adquisicion || '';
                    const adqB = b.adquisicion || '';
                    return adqA.localeCompare(adqB);
                });

                grouped[item.key].copies = allCopies;
            }));

            _currentResults = Object.values(grouped);
            _currentPage = 1;
            renderResultadosPaginados();

        } catch (error) {
            console.error("[Buscador] Error en búsqueda:", error);
            container.innerHTML = '<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Ocurrió un error al buscar.</div>';
        }
    }

    let _currentResults = [];
    let _currentPage = 1;
    const ITEMS_PER_PAGE = 10;

    function renderResultadosPaginados() {
        const container = document.getElementById('buscador-resultados');
        if (!container) return;

        const totalItems = _currentResults.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const startIndex = (_currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
        const currentSlice = _currentResults.slice(startIndex, endIndex);

        let html = '';
        currentSlice.forEach(group => {
            const original = group.copies[0] || {};
            const copiesCount = group.copies.length;
            const disponibilidades = group.copies.filter(c => c.active !== false && c.copiasDisponibles > 0).length;

            const portadaStyle = group.portada ? `background-image: url('${group.portada}'); background-size: cover; background-position: center;` : '';
            
            let copiesHtml = '';
            group.copies.forEach((c, idx) => {
                const isOriginal = idx === 0;
                const isAvailable = c.active !== false && c.copiasDisponibles > 0;
                const badgeEstado = !isAvailable ? '<span class="badge bg-warning text-dark"><i class="bi bi-bookmark-x me-1"></i>No Disponible</span>' : '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Disponible</span>';
                
                const inQueue = window.AdminBiblio.State && window.AdminBiblio.State.labelsPrintQueue && window.AdminBiblio.State.labelsPrintQueue.some(i => i.adquisicion === c.adquisicion);
                const btnClass = inQueue ? 'btn-danger' : 'btn-outline-primary';
                const btnIcon = inQueue ? 'bi-trash' : 'bi-tag';
                const btnText = inQueue ? 'Quitar Etiqueta' : 'Generar Etiqueta';
                const copyLabel = `ITES Ej. ${idx + 1}`;
                
                copiesHtml += `
                    <div class="d-flex align-items-center justify-content-between p-3 border-bottom bg-white">
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <span class="badge ${isOriginal ? 'bg-primary' : 'bg-secondary'}">${copyLabel}</span>
                                <span class="fw-bold text-dark">${c.adquisicion || 'S/N'}</span>
                                ${badgeEstado}
                            </div>
                            <div class="small text-muted">Clasificación: ${c.clasificacion || 'N/A'}</div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm ${btnClass} rounded-pill fw-medium" onclick="AdminBiblio.Buscador.onGenerarEtiquetaClick('${c.adquisicion}', '${c.clasificacion || ''}', '${copyLabel}')">
                                <i class="bi ${btnIcon} me-1"></i>${btnText}
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                    <div class="card-header bg-white border-bottom-0 p-4 d-flex align-items-start gap-3">
                        <div class="rounded bg-light d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm border" style="width: 70px; height: 95px; ${portadaStyle}">
                            ${!group.portada ? '<i class="bi bi-journal-text fs-1 text-muted opacity-50"></i>' : ''}
                        </div>
                        <div class="flex-grow-1">
                            <h5 class="fw-bold text-dark mb-1">${group.titulo}</h5>
                            <p class="text-muted small mb-2">${group.autor}</p>
                            <div class="d-flex gap-2 mb-3">
                                <span class="badge bg-light border text-dark">${copiesCount} Ejemplar(es) Total</span>
                                <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">${disponibilidades} Disponible(s)</span>
                            </div>
                            <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold shadow-sm" onclick="AdminBiblio.Buscador.promptAddCopy('${encodeURIComponent(JSON.stringify(group))}')">
                                <i class="bi bi-plus-lg me-1"></i>Agregar Copia
                            </button>
                        </div>
                    </div>
                    <div class="bg-light p-0 m-0">
                        ${copiesHtml}
                    </div>
                </div>
            `;
        });

        // Pagination controls
        if (totalPages > 1) {
            html += `
                <div class="d-flex align-items-center justify-content-between mt-4 pb-4">
                    <button class="btn btn-outline-secondary rounded-pill fw-medium" 
                            onclick="AdminBiblio.Buscador.cambiarPagina(-1)" 
                            ${_currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left me-1"></i> Anterior
                    </button>
                    <span class="text-muted small fw-bold">Página ${_currentPage} de ${totalPages}</span>
                    <button class="btn btn-outline-secondary rounded-pill fw-medium" 
                            onclick="AdminBiblio.Buscador.cambiarPagina(1)" 
                            ${_currentPage === totalPages ? 'disabled' : ''}>
                        Siguiente <i class="bi bi-chevron-right ms-1"></i>
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
        
        // Scroll to top of modal body gracefully
        const modalBody = container.parentElement;
        if(modalBody) {
            modalBody.scrollTop = 0;
        }
    }

    function cambiarPagina(direction) {
        _currentPage += direction;
        renderResultadosPaginados();
    }

    async function promptAddCopy(encodedGroup) {
        const group = JSON.parse(decodeURIComponent(encodedGroup));
        const original = group.copies[0];

        if (!original) {
            AdminBiblio.Shared.showToast("No se encontró el original para copiar.", "danger");
            return;
        }

        // Sugerir número de adquisición (Buscar el más alto y sumar 1)
        let maxAdq = 0;
        let prefix = '';
        group.copies.forEach(c => {
            const numMatch = (c.adquisicion || '').match(/^(\D*)(\d+)$/);
            if (numMatch) {
                prefix = numMatch[1];
                const num = parseInt(numMatch[2], 10);
                if (num > maxAdq) maxAdq = num;
            } else {
                // Si es puro número
                const num = parseInt(c.adquisicion, 10);
                if (!isNaN(num) && num > maxAdq) maxAdq = num;
            }
        });

        let suggestedAdq = '';
        if (maxAdq > 0) {
            const nextNum = maxAdq + 1;
            // Pad start to preserve length. Ex: 00001 -> 00002
            const len = original.adquisicion.replace(/\D/g, '').length || 5;
            suggestedAdq = prefix + nextNum.toString().padStart(len, '0');
        } else {
            // Fallback
            suggestedAdq = original.adquisicion + '-C1';
        }

        const confirmHtml = `
            <div class="text-start">
                <p class="small text-muted mb-3">Se creará un nuevo registro de copia basado en los datos originales.</p>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Título</label>
                    <input type="text" class="form-control bg-light" value="${original.titulo}" disabled>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">No. de Adquisición Sugerido para la Copia</label>
                    <input type="text" class="form-control fs-5 fw-bold" id="suggested-copy-adq" value="${suggestedAdq}">
                    <div class="form-text">Puedes editarlo si el libro tiene otro número asignado.</div>
                </div>
            </div>
        `;

        AdminBiblio.Shared.showConfirmModal({
            icon: 'plus-circle-fill',
            iconColor: '#0d6efd',
            title: 'Agregar Nueva Copia',
            message: confirmHtml,
            confirmText: 'Guardar Copia',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                const newAdq = document.getElementById('suggested-copy-adq').value.trim();
                if (!newAdq) {
                    AdminBiblio.Shared.showToast("Debes ingresar un número de adquisición", "warning");
                    return false; // Prevent close? Wait, standard showConfirmModal might not wait for false.
                }

                // Clonar datos pero quitar ids y ajustar disponibilidad
                const newBookData = { ...original };
                delete newBookData.id;
                newBookData.adquisicion = newAdq;
                newBookData.active = true;
                newBookData.copiasTotales = 1;
                newBookData.copiasDisponibles = 1;
                delete newBookData.estado;
                newBookData.createdAtMs = Date.now();
                newBookData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                newBookData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                try {
                    // Check si ya existe ese numero de adquisicion en general
                    const existSnap = await state.ctx.db.collection('biblio-catalogo').where('adquisicion', '==', newAdq).get();
                    if (!existSnap.empty) {
                        AdminBiblio.Shared.showToast(`El número de adquisición ${newAdq} ya existe en el sistema.`, "danger");
                        return false; 
                    }

                    const docRef = await state.ctx.db.collection('biblio-catalogo').add(newBookData);
                    AdminBiblio.Shared.showToast("Copia agregada correctamente", "success");
                    
                    // Agregar directamente al caché local para evitar recargar miles de libros
                    if (BiblioService.addBookToCacheLocal) {
                        BiblioService.addBookToCacheLocal(docRef.id, newBookData);
                    } else if (BiblioService.invalidateCatalogCache) {
                        BiblioService.invalidateCatalogCache();
                    }
                    
                    buscar();
                } catch (error) {
                    console.error("Error agregando copia:", error);
                    AdminBiblio.Shared.showToast("Error al guardar la copia", "danger");
                }
            }
        });
    }

    function onGenerarEtiquetaClick(adquisicion, clasificacion, copyTag) {
        const sidePanel = document.getElementById('buscador-side-panel');
        if (sidePanel && sidePanel.classList.contains('d-none')) {
            sidePanel.classList.remove('d-none');
            sidePanel.classList.add('d-flex');
            
            // Forzamos el renderizado inicial por si había etiquetas previas y no se había renderizado
            if (window.AdminBiblio && window.AdminBiblio.Catalogo && window.AdminBiblio.Catalogo.renderLabelsQueue) {
                window.AdminBiblio.Catalogo.renderLabelsQueue();
            }
        }
        
        const inQueue = window.AdminBiblio.State && window.AdminBiblio.State.labelsPrintQueue && window.AdminBiblio.State.labelsPrintQueue.some(i => i.adquisicion === adquisicion);
        
        if (inQueue) {
            const idx = window.AdminBiblio.State.labelsPrintQueue.findIndex(i => i.adquisicion === adquisicion);
            if (idx !== -1 && window.AdminBiblio.Catalogo && window.AdminBiblio.Catalogo.removeLabelFromQueue) {
                window.AdminBiblio.Catalogo.removeLabelFromQueue(idx);
            }
        } else {
            if (window.AdminBiblio && window.AdminBiblio.addLabelToQueue) {
                window.AdminBiblio.addLabelToQueue(adquisicion, clasificacion, copyTag);
            } else if (window.AdminBiblio && window.AdminBiblio.Catalogo) {
                window.AdminBiblio.Catalogo.addLabelToQueue(adquisicion, clasificacion, copyTag);
            }
        }
        
        // Actualizar visualmente los botones de inmediato
        renderResultadosPaginados();
    }

    return {
        abrirBuscadorAvanzado,
        setFiltro,
        buscar,
        promptAddCopy,
        cambiarPagina,
        onGenerarEtiquetaClick
    };
})();

// Expose on AdminBiblio
if (window.AdminBiblio) {
    window.AdminBiblio.abrirBuscadorAvanzado = window.AdminBiblio.Buscador.abrirBuscadorAvanzado;
}
