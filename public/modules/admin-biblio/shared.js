if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Shared = (function () {
    const state = window.AdminBiblio.State;
    const ACTIVE_LOAN_STATES = new Set(['pendiente', 'pendiente_entrega', 'entregado']);

    async function runNonCriticalTask(taskLabel, taskFn, warnings) {
        try {
            await taskFn();
        } catch (error) {
            console.warn(`[BiblioAdmin] ${taskLabel} failed:`, error);
            warnings.push(taskLabel);
        }
    }


    function isActiveLoanState(state) {
        return ACTIVE_LOAN_STATES.has(state);
    }


    function escapeHtml(value) {
        return (value == null ? '' : String(value))
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }


    function escapeJsString(value) {
        return (value == null ? '' : String(value))
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r?\n/g, ' ');
    }


    function encodeItemPayload(item) {
        return encodeURIComponent(JSON.stringify(item || {}));
    }


    function decodeItemPayload(payload) {
        try {
            return JSON.parse(decodeURIComponent(payload || ''));
        } catch (error) {
            console.warn('[BiblioAdmin] Invalid item payload:', error);
            return null;
        }
    }


    function parseDate(dateVal) {
        if (!dateVal) return null;
        if (dateVal.toDate) return dateVal.toDate(); // Original Firestore Timestamp
        if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
            // Serialized Firestore Timestamp
            return new Date(dateVal.seconds * 1000 + (dateVal.nanoseconds || 0) / 1000000);
        }
        if (typeof dateVal === 'number') return new Date(dateVal); // Milliseconds
        if (typeof dateVal === 'string') return new Date(dateVal); // Date string
        return null;
    }


    function showConfirmModal({ icon, iconColor, title, message, confirmText, confirmClass, onConfirm, sizeClass }) {
        // Remover modal previo si existe
        const prev = document.getElementById('mini-confirm-modal');
        if (prev) {
            const m = bootstrap.Modal.getInstance(prev);
            if (m) m.dispose();
            prev.remove();

            // Limpia backdrops huerfanos para evitar que la pantalla se onscurezca
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }

        const modalHtml = `
            <div class="modal fade" id="mini-confirm-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered ${sizeClass || 'modal-sm'}">
                    <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden">
                        <div class="modal-body text-center p-4">
                            <div class="mb-3">
                                <div class="d-inline-flex align-items-center justify-content-center rounded-circle p-3" style="background:${iconColor}15; width:70px; height:70px;">
                                    <i class="bi bi-${icon}" style="font-size:2rem; color:${iconColor};"></i>
                                </div>
                            </div>
                            <h5 class="fw-bold mb-2">${title}</h5>
                            <div class="text-muted small mb-0">${message}</div>
                        </div>
                        <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2">
                            <button class="btn btn-light flex-fill rounded-pill fw-bold" id="mini-confirm-cancel">Cancelar</button>
                            <button class="btn ${confirmClass} flex-fill rounded-pill fw-bold" id="mini-confirm-ok">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById('mini-confirm-modal');
        const modal = new bootstrap.Modal(modalEl);

        document.getElementById('mini-confirm-cancel').onclick = () => modal.hide();
        document.getElementById('mini-confirm-ok').onclick = async () => {
            const btn = document.getElementById('mini-confirm-ok');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            try {
                await onConfirm();
            } finally {
                modal.hide();
            }
        };

        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();

            // Limpiar remanentes de backdrop por si acaso
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

            // [FIX] Restore body class if another modal is open (nested modal fix)
            if (document.querySelector('.modal.show')) {
                document.body.classList.add('modal-open');
            } else {
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
            }
        }, { once: true });
        modal.show();
    }


    function showPromptModal({ icon, iconColor, title, message, placeholder, confirmText, confirmClass }) {
        return new Promise((resolve) => {
            const prev = document.getElementById('mini-prompt-modal');
            if (prev) {
                const m = bootstrap.Modal.getInstance(prev);
                if (m) m.dispose();
                prev.remove();
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
            }

            const modalHtml = `
                <div class="modal fade" id="mini-prompt-modal" tabindex="-1" data-bs-backdrop="static">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden">
                            <div class="modal-body text-center p-4">
                                <div class="mb-3">
                                    <div class="d-inline-flex align-items-center justify-content-center rounded-circle p-3" style="background:${iconColor}15; width:70px; height:70px;">
                                        <i class="bi bi-${icon}" style="font-size:2rem; color:${iconColor};"></i>
                                    </div>
                                </div>
                                <h5 class="fw-bold mb-2">${title}</h5>
                                <p class="text-muted small mb-3">${message}</p>
                                <textarea id="mini-prompt-input" class="form-control rounded-4 shadow-sm border-0 mb-1 bg-light" rows="3" placeholder="${placeholder}"></textarea>
                                <div id="mini-prompt-error" class="text-danger small d-none text-start ms-1">Por favor, ingresa un motivo.</div>
                            </div>
                            <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2">
                                <button class="btn btn-light flex-fill rounded-pill fw-bold" id="mini-prompt-cancel">Cancelar</button>
                                <button class="btn ${confirmClass} flex-fill rounded-pill fw-bold" id="mini-prompt-ok">${confirmText}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const modalEl = document.getElementById('mini-prompt-modal');
            const modal = new bootstrap.Modal(modalEl);
            const inputEl = document.getElementById('mini-prompt-input');
            const errorEl = document.getElementById('mini-prompt-error');

            document.getElementById('mini-prompt-cancel').onclick = () => {
                modal.hide();
                resolve(null);
            };

            document.getElementById('mini-prompt-ok').onclick = () => {
                const val = inputEl.value.trim();
                if (!val) {
                    errorEl.classList.remove('d-none');
                    return;
                }
                const btn = document.getElementById('mini-prompt-ok');
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                modal.hide();
                resolve(val);
            };

            modalEl.addEventListener('hidden.bs.modal', () => {
                modalEl.remove();
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                if (document.querySelector('.modal.show')) {
                    document.body.classList.add('modal-open');
                } else {
                    document.body.classList.remove('modal-open');
                    document.body.style.removeProperty('overflow');
                    document.body.style.removeProperty('padding-right');
                }
            }, { once: true });

            modal.show();
            setTimeout(() => inputEl.focus(), 500);
        });
    }


    function resetServiceSelection() {
        state.selectedAssetId = null;
        state.selectedTimeBlock = null;
        const confirmBtn = document.getElementById('btn-confirm-service');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = 'Confirmar Reserva';
        }
    }

    function cleanupBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
            backdrops.forEach((backdrop) => backdrop.remove());
            document.body.classList.remove('modal-open');
        }
    }

    return {
        runNonCriticalTask,
        isActiveLoanState,
        escapeHtml,
        escapeJsString,
        encodeItemPayload,
        decodeItemPayload,
        parseDate,
        showConfirmModal,
        showPromptModal,
        resetServiceSelection,
        cleanupBackdrop
    };
})();
