if (!window.AdminBiblio) window.AdminBiblio = {};

window.AdminBiblio.BuscadorUsuarios = (function () {
    const state = window.AdminBiblio.State;
    let _activeFilter = 'nombre o matrícula';

    function abrirBuscadorUsuarios() {
        const modalEl = document.getElementById('modal-admin-action');
        const body = document.getElementById('modal-admin-body');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        body.innerHTML = `
            <div class="modal-header border-0 bg-white p-4 pb-0 d-flex flex-column align-items-start position-relative">
                <button type="button" class="btn-close position-absolute top-0 end-0 m-3" data-bs-dismiss="modal" aria-label="Close"></button>
                <h4 class="fw-bold text-dark mb-3"><i class="bi bi-person-bounding-box me-2 text-info"></i>Buscador de Usuarios</h4>
                
                <div class="input-group input-group-lg shadow-sm rounded-pill overflow-hidden border mb-3 w-100">
                    <span class="input-group-text bg-white border-0 ps-4 text-muted"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control border-0 shadow-none fs-5 bg-white" id="buscador-usuarios-input" placeholder="Buscar por ${ _activeFilter }..." autocomplete="off" onkeydown="if(event.key === 'Enter') AdminBiblio.abrirBuscadorUsuarios.buscar()">
                    <button class="btn btn-info text-white px-4 fw-bold" onclick="AdminBiblio.abrirBuscadorUsuarios.buscar()">Buscar</button>
                </div>
            </div>
            
            <div class="modal-body p-4 bg-light" style="min-height: 400px; max-height: 70vh; overflow-y: auto;">
                <div id="buscador-usuarios-resultados" class="d-flex flex-column gap-3">
                    <div class="text-center text-muted py-5 mt-4">
                        <i class="bi bi-people display-3 mb-3 opacity-25 d-block"></i>
                        <h5 class="fw-bold">Busca a un usuario</h5>
                        <p class="small">Ingresa su nombre, correo o matrícula y presiona Enter.</p>
                    </div>
                </div>
            </div>
        `;

        if (!modalEl.classList.contains('show')) {
            modal.show();
        }

        setTimeout(() => {
            document.getElementById('buscador-usuarios-input')?.focus();
        }, 300);
    }

    async function buscar() {
        const input = document.getElementById('buscador-usuarios-input');
        const q = (input?.value || '').trim();
        const container = document.getElementById('buscador-usuarios-resultados');
        if (!container) return;

        if (!q) {
            AdminBiblio.Shared.showToast("Ingresa un término de búsqueda", "warning");
            return;
        }

        container.innerHTML = '<div class="text-center text-muted py-5"><div class="spinner-border text-info mb-3"></div><div class="fw-bold">Buscando usuarios...</div></div>';

        try {
            const results = await BiblioService.searchUsuariosAdmin(state.ctx, q, 30);

            if (results.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5 mt-4">
                        <i class="bi bi-emoji-frown display-3 mb-3 opacity-25 d-block"></i>
                        <h5 class="fw-bold">No se encontraron usuarios</h5>
                        <p class="small">Verifica la escritura de su nombre o número de control.</p>
                    </div>
                `;
                return;
            }

            _currentResults = results;
            _currentPage = 1;
            renderResultadosPaginados();

        } catch (error) {
            console.error("[Buscador Usuarios] Error:", error);
            container.innerHTML = '<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Ocurrió un error al buscar.</div>';
        }
    }

    let _currentResults = [];
    let _currentPage = 1;
    const ITEMS_PER_PAGE = 8;

    function renderResultadosPaginados() {
        const container = document.getElementById('buscador-usuarios-resultados');
        if (!container) return;

        const totalItems = _currentResults.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const startIndex = (_currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
        const currentSlice = _currentResults.slice(startIndex, endIndex);

        let html = '';
        currentSlice.forEach(user => {
            const avatarHtml = user.profile_pic 
                ? `<img src="${user.profile_pic}" alt="avatar" class="rounded-circle object-fit-cover shadow-sm border" style="width: 50px; height: 50px;">`
                : `<div class="rounded-circle bg-info bg-opacity-10 text-info d-flex align-items-center justify-content-center shadow-sm border" style="width: 50px; height: 50px;"><i class="bi bi-person-fill fs-3"></i></div>`;

            html += `
                <div class="card border-0 shadow-sm rounded-4 mb-2 hover-scale cursor-pointer" onclick="AdminBiblio.abrirBuscadorUsuarios.verPerfil('${user.id}')">
                    <div class="card-body p-3 d-flex align-items-center gap-3">
                        ${avatarHtml}
                        <div class="flex-grow-1">
                            <h6 class="fw-bold text-dark mb-0">${user.nombre}</h6>
                            <div class="d-flex flex-wrap gap-2 mt-1">
                                <span class="badge bg-light text-dark border">${user.matricula || 'S/N'}</span>
                                <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">${user.tipoUsuario}</span>
                                ${user.carrera ? `<span class="small text-muted">${user.carrera}</span>` : ''}
                            </div>
                        </div>
                        <i class="bi bi-chevron-right text-muted opacity-50"></i>
                    </div>
                </div>
            `;
        });

        if (totalPages > 1) {
            html += `
                <div class="d-flex align-items-center justify-content-between mt-3 pb-2">
                    <button class="btn btn-outline-secondary rounded-pill fw-medium btn-sm" 
                            onclick="AdminBiblio.abrirBuscadorUsuarios.cambiarPagina(-1)" 
                            ${_currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <span class="text-muted small fw-bold">Pág. ${_currentPage} de ${totalPages}</span>
                    <button class="btn btn-outline-secondary rounded-pill fw-medium btn-sm" 
                            onclick="AdminBiblio.abrirBuscadorUsuarios.cambiarPagina(1)" 
                            ${_currentPage === totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    function cambiarPagina(direction) {
        _currentPage += direction;
        renderResultadosPaginados();
    }

    async function verPerfil(uid) {
        const container = document.getElementById('buscador-usuarios-resultados');
        if (!container) return;

        container.innerHTML = '<div class="text-center text-muted py-5"><div class="spinner-border text-info mb-3"></div><div class="fw-bold">Cargando perfil...</div></div>';

        try {
            const perfil = await BiblioService.getPerfilBibliotecario(state.ctx, uid);
            if (!perfil) {
                container.innerHTML = '<div class="alert alert-danger">No se encontró el perfil del usuario.</div>';
                return;
            }

            const avatarHtml = perfil.profile_pic 
                ? `<img src="${perfil.profile_pic}" alt="avatar" class="rounded-circle object-fit-cover shadow-sm border border-3 border-white" style="width: 80px; height: 80px;">`
                : `<div class="rounded-circle bg-info text-white d-flex align-items-center justify-content-center shadow-sm border border-3 border-white" style="width: 80px; height: 80px;"><i class="bi bi-person-fill display-5"></i></div>`;

            // Evaluar KPIs
            const prestamosActivosList = [...(perfil.solicitados || []), ...(perfil.recogidos || [])];
            const prestamosActivos = prestamosActivosList.length;
            const devolucionesTotales = (perfil.historial || []).filter(h => h.estado === 'devuelto' || h.estado === 'finalizado').length;
            const condonaciones = (perfil.historial || []).filter(h => h.sinCobroRetraso && h.retrasoRegistrado).length;

            let adeudosHtml = '';
            if (perfil.deudaTotal > 0) {
                adeudosHtml = `<div class="badge bg-danger p-2 fs-6 mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>Adeudo total: $${perfil.deudaTotal}</div>`;
            } else {
                adeudosHtml = `<div class="badge bg-success p-2 mb-2"><i class="bi bi-check-circle-fill me-1"></i>Sin adeudos</div>`;
            }

            let historialActivoHtml = '';
            if (prestamosActivos > 0) {
                historialActivoHtml += `<h6 class="fw-bold mt-4 mb-3 text-dark">Préstamos Activos (${prestamosActivos})</h6><div class="list-group mb-3">`;
                prestamosActivosList.forEach(p => {
                    const isOverdue = p.estado === 'entregado' && BiblioService.getLateInfo && BiblioService.getLateInfo(p).daysLate > 0;
                    historialActivoHtml += `
                        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center bg-white border-0 shadow-sm mb-2 rounded-3">
                            <div>
                                <div class="fw-bold">${p.tituloLibro || 'Libro'}</div>
                                <div class="small text-muted">${p.adquisicion || ''}</div>
                            </div>
                            ${isOverdue ? '<span class="badge bg-danger rounded-pill">Vencido</span>' : '<span class="badge bg-primary rounded-pill">En curso</span>'}
                        </div>
                    `;
                });
                historialActivoHtml += `</div>`;
            }

            let historialRecienteHtml = '';
            const devolucionesRecientes = (perfil.historial || []).slice(0, 3);
            if (devolucionesRecientes.length > 0) {
                historialRecienteHtml += `<h6 class="fw-bold mt-4 mb-3 text-dark">Devoluciones Recientes</h6><div class="list-group mb-3">`;
                devolucionesRecientes.forEach(p => {
                    const condonadoLabel = (p.sinCobroRetraso && p.retrasoRegistrado) ? '<span class="badge bg-info text-dark ms-2"><i class="bi bi-shield-check me-1"></i>Condonado</span>' : '';
                    historialRecienteHtml += `
                        <div class="list-group-item bg-light border-0 mb-2 rounded-3">
                            <div class="fw-bold small">${p.tituloLibro || 'Libro'} ${condonadoLabel}</div>
                            <div class="text-muted" style="font-size: 0.75rem;">${p.estado === 'cancelado' ? 'Cancelado el' : 'Devuelto el'} ${
                                (() => {
                                    const d = p.fechaDevolucionReal || p.fechaCancelacion || p.fechaDevolucion;
                                    return d ? new Date(d.toDate ? d.toDate() : d).toLocaleDateString() : 'N/A';
                                })()
                            }</div>
                        </div>
                    `;
                });
                historialRecienteHtml += `</div>`;
            }

            container.innerHTML = `
                <button class="btn btn-sm btn-link text-decoration-none text-muted p-0 mb-3" onclick="AdminBiblio.abrirBuscadorUsuarios.renderResultadosPaginados()">
                    <i class="bi bi-arrow-left me-1"></i> Volver a resultados
                </button>
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="bg-info bg-gradient" style="height: 60px;"></div>
                    <div class="card-body px-4 pb-4 position-relative pt-0">
                        <div class="d-flex justify-content-between align-items-end" style="margin-top: -40px; margin-bottom: 1rem;">
                            ${avatarHtml}
                            <div class="text-end pb-2">
                                ${adeudosHtml}
                            </div>
                        </div>
                        <h4 class="fw-bold text-dark mb-0">${perfil.nombre}</h4>
                        <p class="text-muted mb-3">${perfil.matricula} ${perfil.emailInstitucional ? '• ' + perfil.emailInstitucional : ''}</p>
                        
                        <div class="d-flex flex-wrap gap-2 mb-4">
                            <span class="badge bg-light text-dark border"><i class="bi bi-person-badge me-1"></i>${perfil.tipoUsuario}</span>
                            ${perfil.carrera ? `<span class="badge bg-light text-dark border"><i class="bi bi-mortarboard me-1"></i>${perfil.carrera}</span>` : ''}
                            ${perfil.turno ? `<span class="badge bg-light text-dark border"><i class="bi bi-clock me-1"></i>${perfil.turno}</span>` : ''}
                        </div>

                        <div class="row g-2 mb-2 text-center">
                            <div class="col-4">
                                <div class="bg-light rounded-3 p-2 border shadow-sm">
                                    <div class="fw-bold fs-4 text-primary">${prestamosActivos}</div>
                                    <div class="small text-muted" style="font-size: 0.7rem; text-transform: uppercase;">Préstamos</div>
                                </div>
                            </div>
                            <div class="col-4">
                                <div class="bg-light rounded-3 p-2 border shadow-sm">
                                    <div class="fw-bold fs-4 text-success">${perfil.totalVisitas || 0}</div>
                                    <div class="small text-muted" style="font-size: 0.7rem; text-transform: uppercase;">Visitas</div>
                                </div>
                            </div>
                            <div class="col-4">
                                <div class="bg-light rounded-3 p-2 border shadow-sm">
                                    <div class="fw-bold fs-4 text-info">${condonaciones}</div>
                                    <div class="small text-muted" style="font-size: 0.7rem; text-transform: uppercase;">Perdones</div>
                                </div>
                            </div>
                        </div>

                        ${historialActivoHtml}
                        ${historialRecienteHtml}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error("[Buscador Usuarios] Error cargando perfil:", error);
            container.innerHTML = '<div class="alert alert-danger"><i class="bi bi-x-circle me-2"></i>Error al cargar los detalles del usuario.</div>';
        }
    }

    return {
        abrirBuscadorUsuarios,
        buscar,
        cambiarPagina,
        renderResultadosPaginados,
        verPerfil
    };
})();

// Expose on AdminBiblio
if (window.AdminBiblio) {
    window.AdminBiblio.abrirBuscadorUsuarios = window.AdminBiblio.BuscadorUsuarios.abrirBuscadorUsuarios;
    window.AdminBiblio.abrirBuscadorUsuarios.buscar = window.AdminBiblio.BuscadorUsuarios.buscar;
    window.AdminBiblio.abrirBuscadorUsuarios.cambiarPagina = window.AdminBiblio.BuscadorUsuarios.cambiarPagina;
    window.AdminBiblio.abrirBuscadorUsuarios.renderResultadosPaginados = window.AdminBiblio.BuscadorUsuarios.renderResultadosPaginados;
    window.AdminBiblio.abrirBuscadorUsuarios.verPerfil = window.AdminBiblio.BuscadorUsuarios.verPerfil;
}
