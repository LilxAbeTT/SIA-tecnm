import re

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\modules\\admin-biblio\\inventario.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """async function openInventoryUnregisteredModal(acquisition = '') {
        const currentCode = normalizeInventoryAcquisitionCode(acquisition || document.getElementById('inventory-search-input')?.value || '');
        _inventoryUnregisteredMode = 'new';
        _inventoryUnregisteredCopyBase = null;
        document.getElementById('inventory-unregistered-modal')?.remove();

        _inventoryCategories = await BiblioService.getInventoryCategories(_ctx);
        const categoriesOptions = _inventoryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

        const modalHtml = `
            <div class="modal fade" id="inventory-unregistered-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <div class="small text-uppercase fw-bold text-warning">No registrado</div>
                                <h6 class="mb-0 text-dark">Posible copia, documento o libro nuevo</h6>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <div class="small text-muted mb-3">El codigo ${escapeHtml(currentCode || 'sin captura')} no existe en el sistema.</div>
                            <div class="d-flex gap-2 mb-3">
                                <button type="button" class="btn btn-primary rounded-pill fw-semibold flex-fill px-2" id="inventory-unregistered-mode-new" onclick="AdminBiblio.setInventoryUnregisteredMode('new')">Nuevo registro</button>
                                <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold flex-fill px-2" id="inventory-unregistered-mode-copy" onclick="AdminBiblio.setInventoryUnregisteredMode('copy')">Es copia</button>
                            </div>
                            <div class="d-grid gap-2">
                                <input type="text" class="form-control" value="${escapeHtml(currentCode)}" disabled>
                            </div>
                            <div id="inventory-unregistered-new-fields" class="d-grid gap-2 mt-2">
                                <div class="input-group">
                                    <select class="form-select" id="inventory-unregistered-category">
                                        <option value="">Categoria (Opcional)</option>
                                        ${categoriesOptions}
                                    </select>
                                    <button class="btn btn-outline-secondary" type="button" onclick="AdminBiblio.promptCreateInventoryCategory()"><i class="bi bi-plus"></i></button>
                                </div>
                                <input type="text" class="form-control" id="inventory-unregistered-title" placeholder="Nombre o Titulo">
                                <input type="text" class="form-control" id="inventory-unregistered-author" placeholder="Autor (Opcional)">
                                <input type="text" class="form-control" id="inventory-unregistered-classification" placeholder="Clasificacion (Opcional)">
                            </div>
                            <div id="inventory-unregistered-copy-fields" class="d-none mt-2">
                                <div class="input-group mb-2">
                                    <input type="search" class="form-control" id="inventory-unregistered-original-code" placeholder="Codigo del original" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.searchInventoryUnregisteredCopyBase(); }">
                                    <button type="button" class="btn btn-primary" onclick="AdminBiblio.searchInventoryUnregisteredCopyBase()">Buscar</button>
                                </div>
                                <div id="inventory-unregistered-copy-base"></div>
                            </div>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary rounded-pill fw-bold" id="inventory-unregistered-save-btn" onclick="AdminBiblio.saveInventoryManualBook()">
                                Agregar
                            </button>
                            <button type="button" class="btn btn-primary rounded-pill fw-bold d-none" id="inventory-unregistered-copy-btn" onclick="AdminBiblio.saveInventoryUnregisteredCopy()">
                                Asociar copia
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-unregistered-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', () => {
            syncModalScrollLock();
        }, { once: true });
        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
            syncModalScrollLock();
        }, { once: true });
        syncModalScrollLock();
        modal.show();
        setInventoryUnregisteredMode('new');

        setTimeout(() => {
            const titleInput = document.getElementById('inventory-unregistered-title');
            if (titleInput) titleInput.focus();
        }, 80);
    }"""

content = re.sub(r'function openInventoryUnregisteredModal\(acquisition = \'\'\) \{.*?const titleInput = document\.getElementById\(\'inventory-unregistered-title\'\);\s*if \(titleInput\) titleInput\.focus\(\);\s*\}, 80\);\s*\}', replacement, content, flags=re.DOTALL)

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\modules\\admin-biblio\\inventario.js', 'w', encoding='utf-8') as f:
    f.write(content)
