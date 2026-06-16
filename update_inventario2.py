import re

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\modules\\admin-biblio\\inventario.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement1 = """    async function promptCreateInventoryCategory() {
        const result = await window.AdminBiblio.Catalogo.showPromptModal('Nueva Categoria', 'Escribe el nombre de la categoria (ej. Revistas, CD-ROMs, Tesis)', 'Guardar', 'text');
        if (!result) return;
        try {
            _inventoryCategories = await BiblioService.addInventoryCategory(_ctx, result);
            const selectEl = document.getElementById('inventory-unregistered-category');
            if (selectEl) {
                const options = _inventoryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
                selectEl.innerHTML = `<option value="">Categoria (Opcional)</option>${options}`;
                selectEl.value = result;
            }
            showToast('Categoria creada y seleccionada', 'success');
        } catch (error) {
            showToast(error.message || 'Error al crear categoria', 'danger');
        }
    }

    async function saveInventoryManualBook() {"""

content = re.sub(r'    async function saveInventoryManualBook\(\) \{', replacement1, content)

replacement3 = """    async function saveInventoryManualBook() {
        if (_inventorySaving || !_inventorySession?.id) return;

        const acquisition = normalizeInventoryAcquisitionCode(document.getElementById('inventory-search-input')?.value || '');
        const title = String(document.getElementById('inventory-unregistered-title')?.value || '').trim();
        const author = String(document.getElementById('inventory-unregistered-author')?.value || '').trim();
        const classification = String(document.getElementById('inventory-unregistered-classification')?.value || '').trim();
        const category = String(document.getElementById('inventory-unregistered-category')?.value || '').trim();

        if (!acquisition) {
            showToast('Primero captura el numero de adquisicion.', 'warning');
            return;
        }
        if (!title) {
            showToast('Escribe el nombre del documento o libro.', 'warning');
            return;
        }

        const saveBtn = document.getElementById('inventory-unregistered-save-btn');

        try {
            _inventorySaving = true;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando...';
            }

            const details = await BiblioService.registerInventoryManualBook(_ctx, {
                sessionId: _inventorySession.id,
                acquisition,
                title,
                author,
                classification,
                categoria: category
            });"""

content = re.sub(r'    async function saveInventoryManualBook\(\) \{.*?sessionId: _inventorySession\.id,\s*acquisition,\s*title,\s*author,\s*classification\s*\}\);', replacement3, content, flags=re.DOTALL)

replacement4 = """        promptCreateInventoryCategory: withState(promptCreateInventoryCategory),
        saveInventoryManualBook: withState(saveInventoryManualBook),"""

content = re.sub(r'        saveInventoryManualBook: withState\(saveInventoryManualBook\),', replacement4, content)

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\modules\\admin-biblio\\inventario.js', 'w', encoding='utf-8') as f:
    f.write(content)
