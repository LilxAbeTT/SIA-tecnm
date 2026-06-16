import re

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\modules\\admin-biblio\\inventario.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement1 = """                                <div id="inventory-selection-card"></div>
                                <div class="mt-4 border-top pt-3 text-center">
                                    <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold" onclick="AdminBiblio.openOtherMaterialsModal()">
                                        <i class="bi bi-collection me-2"></i>Agregar otro material...
                                    </button>
                                </div>
                                <div id="inventory-missing-wrap" class="card border-0 shadow-sm rounded-4 d-none">"""

content = re.sub(r'                                <div id="inventory-selection-card"></div>\s*<div id="inventory-missing-wrap" class="card border-0 shadow-sm rounded-4 d-none">', replacement1, content)

replacement2 = """    async function openOtherMaterialsModal() {
        if (!_inventorySession?.id) return;
        document.getElementById('inventory-other-materials-modal')?.remove();
        
        _inventoryCategories = await BiblioService.getInventoryCategories(_ctx);
        const categoriesOptions = _inventoryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

        const modalHtml = `
            <div class="modal fade" id="inventory-other-materials-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <h6 class="mb-0 text-dark"><i class="bi bi-collection me-2"></i>Otro material</h6>
                                <div class="small text-muted">Contabiliza revistas, cds, tesis, etc.</div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <div class="d-grid gap-3">
                                <div>
                                    <label class="form-label small fw-semibold text-muted mb-1">Categoria / Tipo</label>
                                    <div class="input-group">
                                        <select class="form-select" id="inventory-other-category">
                                            <option value="">Selecciona...</option>
                                            ${categoriesOptions}
                                        </select>
                                        <button class="btn btn-outline-secondary" type="button" onclick="AdminBiblio.promptCreateInventoryCategory()"><i class="bi bi-plus"></i></button>
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label small fw-semibold text-muted mb-1">Nombre (Opcional)</label>
                                    <input type="text" class="form-control" id="inventory-other-name" placeholder="Ej. Revista Forbes">
                                </div>
                                <div>
                                    <label class="form-label small fw-semibold text-muted mb-1">Cantidad a sumar</label>
                                    <input type="number" class="form-control" id="inventory-other-qty" value="1" min="1">
                                </div>
                                <button type="button" class="btn btn-primary rounded-pill fw-bold" onclick="AdminBiblio.saveInventoryOtherMaterial()">
                                    Agregar al inventario
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-other-materials-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', () => { syncModalScrollLock(); });
        modalEl.addEventListener('hidden.bs.modal', () => { modalEl.remove(); syncModalScrollLock(); });
        syncModalScrollLock();
        modal.show();
    }

    async function saveInventoryOtherMaterial() {
        if (_inventorySaving || !_inventorySession?.id) return;
        
        const category = document.getElementById('inventory-other-category')?.value?.trim();
        const name = document.getElementById('inventory-other-name')?.value?.trim();
        const qty = parseInt(document.getElementById('inventory-other-qty')?.value) || 1;

        if (!category && !name) {
            showToast('Selecciona una categoria o escribe un nombre.', 'warning');
            return;
        }

        const displayName = name ? (category ? `${category}: ${name}` : name) : category;

        try {
            _inventorySaving = true;
            await BiblioService.registerInventoryMissing(_ctx, {
                sessionId: _inventorySession.id,
                nombre: displayName,
                query: 'MATERIAL',
                quantity: qty
            });
            
            const modalEl = document.getElementById('inventory-other-materials-modal');
            if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
            
            await refreshInventorySession(true);
            showToast(`${qty} '${displayName}' agregado(s) exitosamente.`, 'success');
        } catch (error) {
            showToast(error.message || 'Error al agregar material', 'danger');
        } finally {
            _inventorySaving = false;
        }
    }

    async function promptCreateInventoryCategory() {"""

content = re.sub(r'    async function promptCreateInventoryCategory\(\) \{', replacement2, content)

replacement3 = """        promptCreateInventoryCategory: withState(promptCreateInventoryCategory),
        openOtherMaterialsModal: withState(openOtherMaterialsModal),
        saveInventoryOtherMaterial: withState(saveInventoryOtherMaterial),
        saveInventoryManualBook: withState(saveInventoryManualBook),"""

content = re.sub(r'        promptCreateInventoryCategory: withState\(promptCreateInventoryCategory\),\s*saveInventoryManualBook: withState\(saveInventoryManualBook\),', replacement3, content)

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\modules\\admin-biblio\\inventario.js', 'w', encoding='utf-8') as f:
    f.write(content)
