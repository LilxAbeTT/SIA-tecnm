const AdminBiblio = (function () {
    let _ctx = null;
    let _searchDebounce = null;
    let _adminStatsInterval = null;

    function init(ctx) {
        _ctx = ctx;

        // 1. Check for Simulated Profile (Dev Mode)
        const isDevMode = localStorage.getItem('sia_dev_mode') === 'true';
        const simProfileJson = localStorage.getItem('sia_simulated_profile');
        let role = _ctx.profile?.role || 'student';

        if (isDevMode && simProfileJson) {
            try {
                const sim = JSON.parse(simProfileJson);
                if (sim.role) role = sim.role;
                // Merge permissions if needed
                if (!_ctx.profile) _ctx.profile = sim; // Force context if missing
                console.log(`[Biblio] ⚡ Dev Mode Detectado: Rol ${role}`);
            } catch (e) { console.error(e); }
        }

        // 2. Fallback if profile is missing
        if (!_ctx.profile && _ctx.auth.currentUser && !isDevMode) {
            _ctx.db.collection('usuarios').doc(_ctx.auth.currentUser.uid).get().then(doc => {
                const fetchedRole = doc.data()?.role || 'biblio';
                if (!_ctx.profile) _ctx.profile = { role: fetchedRole };
                initAdmin();
            });
        } else {
            initAdmin();
        }
    }

    async function terminarVisita(visitId, uid, matricula) {
        if (!confirm("¿Registrar salida del usuario? Se liberarán sus espacios asignados.")) return;
        try {
            // 1. Release Assets
            let msgDetails = "";
            if (uid) {
                const freed = await BiblioAssetsService.liberarActivoDeUsuario(_ctx, uid);
                if (freed) msgDetails = ` (Liberado: ${freed})`;
            }

            // 2. We could update the 'listing' status if we had one, but currently we just track valid visits.
            // Maybe update 'biblio-visitas' doc to add 'exitTime'?
            await _ctx.db.collection('biblio-visitas').doc(visitId).update({
                salida: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'finalizada'
            });

            showToast(`Salida registrada.${msgDetails}`, "success");
            loadAdminStats(); // Refresh list

        } catch (e) { showToast(e.message, "danger"); }
    }


    // ============================================
    //              VISTA ADMIN 3.0 (MEGA INTUITIVE)
    // ============================================

    function initAdmin() {
        const container = document.getElementById('view-biblio');

        container.innerHTML = `
            <!-- HEADER -->
            <div class="d-flex justify-content-between align-items-center mb-5 animate__animated animate__fadeIn">
                <div class="d-flex align-items-center gap-4">
                     <div class="bg-white p-3 rounded-4 shadow-sm text-center" style="min-width: 100px;">
                        <img src="./images/logo-sia-mob.png" class="img-fluid" style="max-height: 60px;" onerror="this.style.display='none'">
                        <img src="./images/logo-ites.png" class="img-fluid" style="max-height: 80px;" onerror="this.style.display='none'">
                     </div>
                     <div>
                        <h2 class="fw-bold text-dark mb-0">Biblioteca Escolar</h2>
                        <p class="text-muted mb-0">Panel de Administración</p>
                     </div>
                </div>
                <div class="text-end">
                    <h3 class="fw-bold text-dark mb-0 font-monospace" id="admin-clock-time">--:--:--</h3>
                    <p class="text-muted mb-0 small text-capitalize" id="admin-clock-date">Cargando fecha...</p>
                </div>
            </div>

            <!-- DASHBOARD CONTENT -->
            <div id="admin-dashboard-content" class="container-fluid px-4 py-4">
                
                <!-- ACTIONS ROW -->
                <div class="row g-4 mb-4 row-cols-1 row-cols-md-5 justify-content-center">
                    <!-- 1. REGISTRAR VISITA -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalVisita()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-primary-subtle p-4 rounded-circle mb-4 text-primary">
                                    <i class="bi bi-person-check-fill display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Registrar Visita</h4>
                                <p class="text-muted small mb-0">Consulta, Individual o Equipo</p>
                            </div>
                        </div>
                    </div>

                    <!-- 2. PRESTAR LIBRO -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalPrestamo()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-warning-subtle p-4 rounded-circle mb-4 text-warning">
                                    <i class="bi bi-book-half display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Prestar Libro</h4>
                                <p class="text-muted small mb-0">Salida de material</p>
                            </div>
                        </div>
                    </div>

                    <!-- 3. DEVOLVER LIBRO -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalDevolucion()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-success-subtle p-4 rounded-circle mb-4 text-success">
                                    <i class="bi bi-box-arrow-in-down display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Devolver Libro</h4>
                                <p class="text-muted small mb-0">Reingreso y cobros</p>
                            </div>
                        </div>
                    </div>

                    <!-- 4. COMPUTADORAS -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalComputadoras()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-info-subtle p-4 rounded-circle mb-4 text-info">
                                    <i class="bi bi-pc-display display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Computadoras</h4>
                                <p class="text-muted small mb-0">PC y sala de lectura</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 5. GESTION LIBROS (NEW) -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalGestionLibros()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-dark-subtle p-4 rounded-circle mb-4 text-dark">
                                    <i class="bi bi-journal-album display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Gestión Libros</h4>
                                <p class="text-muted small mb-0">Altas y Edición</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                 <!-- CONFIG BUTTON ROW -->
                 <div class="col-12 text-center mt-2 mb-4">
                    <button class="btn btn-light rounded-pill px-4 text-muted small shadow-sm border" onclick="AdminBiblio.abrirModalConfig()">
                        <i class="bi bi-gear-fill me-2"></i>Configuración de Espacios
                    </button>
                 </div>
            </div>

            <!-- STATS CARDS -->
            <div class="row g-4 mt-2 animate__animated animate__fadeInUp" style="animation-delay:0.2s;">
                <!-- Stats Visitas -->
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8f4fd 0%, #f8fbff 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-primary bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-person-check-fill text-primary"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Visitas</span>
                                </div>
                                <span class="badge bg-primary rounded-pill" id="stat-visitas-count">0</span>
                            </div>
                            <div id="stat-visitas-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Stats Préstamos -->
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, rgba(255,210,77,0.08) 0%, rgba(255,210,77,0.03) 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-warning bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-book-half text-warning"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Préstamos</span>
                                </div>
                                <span class="badge bg-warning text-dark rounded-pill" id="stat-prestamos-count">0</span>
                            </div>
                            <div id="stat-prestamos-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Stats Devoluciones -->
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8faf0 0%, #f5fdf9 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-success bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-box-arrow-in-down text-success"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Devoluciones</span>
                                </div>
                                <span class="badge bg-success rounded-pill" id="stat-devol-count">0</span>
                            </div>
                            <div id="stat-devol-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Stats PCs -->
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8f8fd 0%, #f3fcff 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="bg-info bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-pc-display text-info"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Pc's y Mesas</span>
                                </div>
                                <span class="badge bg-info rounded-pill" id="stat-pcs-count">0</span>
                            </div>
                            <div id="stat-pcs-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- STATS ROW -->
            </div>

            <!-- MODAL GENERICO ADMIN -->
            <div class="modal fade" id="modal-admin-action" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden" id="modal-admin-body">
                        <!-- Content Injected -->
                    </div>
                </div>
            </div>
        `;

        startClock();
        loadAdminStats();


        // Refrescar stats cada 60 segundos
        if (_adminStatsInterval) clearInterval(_adminStatsInterval);
        _adminStatsInterval = setInterval(() => {
            loadAdminStats();
            // Auto-check for expired assets globaly while Admin is open
            BiblioAssetsService.liberarActivosExpirados(_ctx).then(freed => {
                if (freed.length > 0) showToast(`🔄 Mesas/PC liberadas: ${freed.join(', ')}`, 'info');
            });
        }, 60000);
    }

    let _clockInterval;
    function startClock() {
        const update = () => {
            const now = new Date();
            const time = document.getElementById('admin-clock-time');
            const date = document.getElementById('admin-clock-date');
            if (time) time.innerText = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (date) date.innerText = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        };
        update();
        if (_clockInterval) clearInterval(_clockInterval);
        _clockInterval = setInterval(update, 1000);
    }

    // --- STATS CARDS LOADER ---
    let _currentAdminStats = null;

    async function loadAdminStats() {
        try {
            const stats = await BiblioService.getDashboardStats(_ctx);
            _currentAdminStats = stats;

            // ---- VISITAS ----
            const visitasEl = document.getElementById('stat-visitas-list');
            const visitasCount = document.getElementById('stat-visitas-count');
            if (visitasCount) visitasCount.innerText = stats.visitasHoy;
            if (visitasEl) {
                if (stats.ultimasVisitas.length === 0) {
                    visitasEl.innerHTML = '<p class="text-muted small text-center mb-0">Sin visitas hoy</p>';
                } else {
                    visitasEl.innerHTML = stats.ultimasVisitas.map(v => {
                        const hora = v.fecha?.toDate ? v.fecha.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('visita', '${v.id}')">
                                <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-person-fill text-primary" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${v.studentName || 'Estudiante'}</div>
                                    <div class="text-muted" style="font-size:0.68rem;">${v.matricula} &bull; ${v.motivo}</div>
                                </div>
                                <span class="text-muted" style="font-size:0.65rem; white-space:nowrap;">${hora}</span>
                            </div>`;
                    }).join('');
                }
            }

            // ---- PRÉSTAMOS ----
            const prestEl = document.getElementById('stat-prestamos-list');
            const prestCount = document.getElementById('stat-prestamos-count');
            if (prestCount) prestCount.innerText = stats.prestamosHoy;
            if (prestEl) {
                if (stats.ultimosPrestamos.length === 0) {
                    prestEl.innerHTML = '<p class="text-muted small text-center mb-0">Sin préstamos activos</p>';
                } else {
                    prestEl.innerHTML = stats.ultimosPrestamos.map(p => {
                        const venc = p.fechaVencimiento?.toDate ? p.fechaVencimiento.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '--';
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('prestamo', '${p.id}')">
                                <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-book text-warning" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${p.tituloLibro || 'Libro'}</div>
                                    <div class="text-muted" style="font-size:0.68rem;">Vence: ${venc}</div>
                                </div>
                                <span class="badge bg-warning-subtle text-warning" style="font-size:0.6rem;">Activo</span>
                            </div>`;
                    }).join('');
                }
            }

            // ---- DEVOLUCIONES ----
            const devolEl = document.getElementById('stat-devol-list');
            const devolCount = document.getElementById('stat-devol-count');
            if (devolCount) devolCount.innerText = stats.ultimasDevoluciones.length;
            if (devolEl) {
                if (stats.ultimasDevoluciones.length === 0) {
                    devolEl.innerHTML = '<p class="text-muted small text-center mb-0">Sin devoluciones recientes</p>';
                } else {
                    devolEl.innerHTML = stats.ultimasDevoluciones.map(d => {
                        const fecha = d.fechaDevolucionReal?.toDate ? d.fechaDevolucionReal.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '--';
                        const multa = d.montoDeuda || 0;
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('devolucion', '${d.id}')">
                                <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-check-circle text-success" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${d.tituloLibro || 'Libro'}</div>
                                    <div class="text-muted" style="font-size:0.68rem;">${fecha}</div>
                                </div>
                                ${multa > 0
                                ? `<span class="badge bg-danger-subtle text-danger" style="font-size:0.6rem;">$${multa}</span>`
                                : `<span class="badge bg-success-subtle text-success" style="font-size:0.6rem;">A tiempo</span>`}
                            </div>`;
                    }).join('');
                }
            }

            // ---- PCS ACTIVAS ----
            const pcsEl = document.getElementById('stat-pcs-list');
            const pcsCount = document.getElementById('stat-pcs-count');
            if (pcsCount) pcsCount.innerText = stats.activosOcupados;
            if (pcsEl) {
                if (stats.pcsActivas.length === 0) {
                    pcsEl.innerHTML = '<p class="text-muted small text-center mb-0">Todas disponibles</p>';
                } else {
                    pcsEl.innerHTML = stats.pcsActivas.map(pc => {
                        let timeLabel = '';
                        if (pc.expiresAt) {
                            const expMs = pc.expiresAt.toMillis ? pc.expiresAt.toMillis() : pc.expiresAt;
                            const remainMs = expMs - Date.now();
                            timeLabel = remainMs <= 0 ? 'Expirado' : `${Math.ceil(remainMs / 60000)} min`;
                        }
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('pc', '${pc.id}')">
                                <div class="bg-info bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-pc-display text-info" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${pc.nombre}</div>
                                    <div class="text-muted" style="font-size:0.68rem;">${pc.occupiedByMatricula || 'En uso'}</div>
                                </div>
                                <span class="badge ${timeLabel === 'Expirado' ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info'}" style="font-size:0.6rem;">${timeLabel || 'Ocupado'}</span>
                            </div>`;
                    }).join('');
                }
            }

        } catch (e) {
            console.warn('[ADMIN STATS] Error loading:', e);
        }
    }

    function showAdminItemDetail(type, id) {
        if (!_currentAdminStats) return;

        let item = null;
        let title = '';
        let content = '';
        let icon = '';
        let color = '';

        if (type === 'visita') {
            item = _currentAdminStats.ultimasVisitas.find(v => v.id === id);
            if (!item) return;
            icon = 'person-check-fill';
            color = 'primary';
            title = 'Detalle de Visita';
            const horaIn = item.fecha?.toDate ? item.fecha.toDate().toLocaleTimeString() : '--';
            const horaOut = item.salida?.toDate ? item.salida.toDate().toLocaleTimeString() : 'En curso';

            let related = '';
            if (item.relatedUsers && item.relatedUsers.length > 0) {
                related = `<div class="mt-3 pt-2 border-top">
                    <small class="text-muted fw-bold d-block mb-1">ACOMPAÑANTES:</small>
                    ${item.relatedUsers.map(r => `<span class="badge bg-light text-dark border me-1 mb-1">${r.matricula}</span>`).join('')}
                </div>`;
            }

            content = `
                <div class="text-center mb-3">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-person-badge fs-1 text-primary"></i>
                    </div>
                    <h5 class="fw-bold mb-0">${item.studentName || 'Estudiante'}</h5>
                    <p class="text-muted mb-0">${item.matricula}</p>
                </div>
                <div class="bg-light rounded-3 p-3 small">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Motivo:</span>
                        <span class="fw-bold text-dark">${item.motivo}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Entrada:</span>
                        <span class="fw-bold text-dark">${horaIn}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Salida:</span>
                        <span class="fw-bold ${horaOut === 'En curso' ? 'text-success' : 'text-dark'}">${horaOut}</span>
                    </div>
                    ${related}
                </div>
            `;

        } else if (type === 'prestamo') {
            item = _currentAdminStats.ultimosPrestamos.find(p => p.id === id);
            if (!item) return;
            icon = 'book-half';
            color = 'warning';
            title = 'Detalle de Préstamo';
            const fSol = item.fechaSolicitud?.toDate ? item.fechaSolicitud.toDate().toLocaleString() : '--';
            const fVenc = item.fechaVencimiento?.toDate ? item.fechaVencimiento.toDate().toLocaleDateString() : '--';

            content = `
                <div class="text-center mb-3">
                    <div class="bg-warning bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-book fs-1 text-warning"></i>
                    </div>
                    <h5 class="fw-bold mb-0 text-truncate px-3">${item.tituloLibro}</h5>
                    <p class="text-muted small mb-0">ID: ${item.libroId}</p>
                </div>
                <div class="bg-light rounded-3 p-3 small">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Usuario:</span>
                        <span class="fw-bold text-dark">${item.studentEmail || item.studentId}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Solicitado:</span>
                        <span class="fw-bold text-dark">${fSol}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Vence:</span>
                        <span class="fw-bold text-danger">${fVenc}</span>
                    </div>
                </div>
            `;

        } else if (type === 'devolucion') {
            item = _currentAdminStats.ultimasDevoluciones.find(d => d.id === id);
            if (!item) return;
            icon = 'box-arrow-in-down';
            color = 'success';
            title = 'Detalle de Devolución';
            const fDev = item.fechaDevolucionReal?.toDate ? item.fechaDevolucionReal.toDate().toLocaleString() : '--';
            const multa = item.montoDeuda || 0;
            const perdonado = item.perdonado ? `<span class="badge bg-info text-white">Multa Perdonada</span>` : '';

            content = `
                <div class="text-center mb-3">
                    <div class="bg-success bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-check-lg fs-1 text-success"></i>
                    </div>
                    <h5 class="fw-bold mb-0 text-truncate px-3">${item.tituloLibro}</h5>
                    <p class="text-muted small mb-0">${perdonado}</p>
                </div>
                <div class="bg-light rounded-3 p-3 small">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Devuelto el:</span>
                        <span class="fw-bold text-dark">${fDev}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Multa / Deuda:</span>
                        <span class="fw-bold ${multa > 0 ? 'text-danger' : 'text-dark'}">$${multa}</span>
                    </div>
                    ${item.perdonado ? `<div class="mt-2 pt-2 border-top text-muted fst-italic">"${item.motivoPerdon}"</div>` : ''}
                </div>
            `;

        } else if (type === 'pc') {
            item = _currentAdminStats.pcsActivas.find(p => p.id === id);
            if (!item) return;
            icon = 'pc-display';
            color = 'info';
            title = 'Detalle de Equipo';
            const ocupadoDesde = item.occupiedAt?.toDate ? item.occupiedAt.toDate().toLocaleTimeString() : '--';
            let expLabel = '--';
            if (item.expiresAt) {
                const expMs = item.expiresAt.toMillis ? item.expiresAt.toMillis() : item.expiresAt;
                expLabel = new Date(expMs).toLocaleTimeString();
            }

            content = `
                <div class="text-center mb-3">
                    <div class="bg-info bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-pc-display fs-1 text-info"></i>
                    </div>
                    <h5 class="fw-bold mb-0">${item.nombre}</h5>
                    <p class="text-muted small mb-0">${item.occupiedByMatricula || 'Ocupado'}</p>
                </div>
                <div class="bg-light rounded-3 p-3 small">
                     <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Inicio:</span>
                        <span class="fw-bold text-dark">${ocupadoDesde}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Expira:</span>
                        <span class="fw-bold text-dark">${expLabel}</span>
                    </div>
                </div>
                <div class="mt-3">
                     <button class="btn btn-outline-danger w-100 rounded-pill btn-sm" onclick="AdminBiblio.handleAssetClick('${item.id}', '${item.nombre}', 'ocupado', '')">
                        Liberar Ahora
                    </button>
                </div>
            `;
        }

        showConfirmModal({
            icon: icon,
            iconColor: `var(--bs-${color})`,
            title: title,
            message: content,
            confirmText: 'Cerrar',
            confirmClass: `btn-${color}`,
            onConfirm: async () => { }
        });

        setTimeout(() => {
            const cancelBtn = document.getElementById('mini-confirm-cancel');
            if (cancelBtn) cancelBtn.style.display = 'none';
        }, 50);
    }

    // --- 1. MODAL REGISTRAR VISITA (STREAMLINED) ---
    // Single Screen Logic
    let _visitUser = null;

    function abrirModalVisita() {
        _visitUser = null;
        renderVisitModalContent();
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => {
            const input = document.getElementById('visita-input-matricula');
            if (input) input.focus();
        }, 500);
    }

    function renderVisitModalContent() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-person-badge me-3"></i>Registrar Entrada</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                <!-- STEP 1: INPUT -->
                <div class="d-flex justify-content-center mb-4">
                    <input type="text" class="form-control form-control-lg rounded-pill fs-2 fw-bold font-monospace text-center border-3 border-primary shadow-sm" 
                           style="max-width: 400px;"
                           id="visita-input-matricula" placeholder="Matrícula" autofocus 
                           onkeyup="if(event.key==='Enter') AdminBiblio.verificarUsuarioVisita()">
                </div>
                
                <div id="visit-options-container" class="d-none animate__animated animate__fadeInUp">
                     <!-- USER INFO HEADER -->
                     <div class="text-center mb-4">
                        <div class="d-flex justify-content-center mb-2">
                            <div id="v-user-photo" class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style="width:64px;height:64px;overflow:hidden;">
                                <i class="bi bi-person-fill text-primary fs-2"></i>
                            </div>
                        </div>
                        <h4 class="fw-bold text-dark mb-0" id="v-user-name">-</h4>
                        <span class="badge bg-primary rounded-pill mb-3" id="v-user-mat">-</span>
                        <p class="text-muted small">Selecciona motivo para registrar INMEDIATAMENTE:</p>
                     </div>

                     <!-- DIRECT ACTIONS -->
                     <div class="row g-3">
                        <div class="col-md-4">
                             <button class="btn btn-outline-success w-100 p-3 rounded-4 shadow-sm hover-scale h-100" onclick="AdminBiblio.confirmarVisitaDirecta('Consulta')">
                                <i class="bi bi-search fs-1 d-block mb-2"></i>
                                <span class="fw-bold">Consulta</span>
                             </button>
                        </div>
                        <div class="col-md-4">
                             <button class="btn btn-outline-primary w-100 p-3 rounded-4 shadow-sm hover-scale h-100" onclick="AdminBiblio.confirmarVisitaDirecta('Trabajo Individual')">
                                <i class="bi bi-person fs-1 d-block mb-2"></i>
                                <span class="fw-bold">Individual</span>
                             </button>
                        </div>
                        <div class="col-md-4">
                             <button class="btn btn-outline-warning w-100 p-3 rounded-4 shadow-sm hover-scale h-100" onclick="AdminBiblio.toggleTeamForm()">
                                <i class="bi bi-people fs-1 d-block mb-2"></i>
                                <span class="fw-bold">Equipo...</span>
                             </button>
                        </div>
                     </div>

                     <!-- TEAM FORM (Hidden by default) -->
                     <div id="v-team-form" class="mt-3 p-3 bg-white rounded-4 border shadow-sm d-none">
                        <h6 class="fw-bold text-muted border-bottom pb-2 mb-2">Integrantes del Equipo</h6>
                        <div id="v-team-inputs">
                            <input type="text" class="form-control mb-2 font-monospace team-member-input" placeholder="Matrícula 2">
                            <input type="text" class="form-control mb-2 font-monospace team-member-input" placeholder="Matrícula 3">
                        </div>
                        <button class="btn btn-sm btn-outline-secondary rounded-pill w-100 mb-3" id="btn-add-team-member" onclick="AdminBiblio.addTeamMember()">
                            <i class="bi bi-plus-circle me-1"></i>Añadir otro integrante
                        </button>
                        <button class="btn btn-warning w-100 fw-bold rounded-pill" onclick="AdminBiblio.confirmarVisitaDirecta('Trabajo en Equipo')">
                            CONFIRMAR EQUIPO
                        </button>
                     </div>
                </div>

                <div id="visit-error-msg" class="alert alert-danger fw-bold mt-3 text-center d-none"></div>

                <!-- NEW: UNREGISTERED VISITOR FORM -->
                <div id="visit-unregistered-container" class="d-none animate__animated animate__fadeInUp mt-3">
                    <div class="alert alert-warning mb-4">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>El usuario no está en nuestra base de datos.
                    </div>
                    
                    <h5 class="fw-bold mb-3"><i class="bi bi-person-fill-add me-2"></i>Registrar Visita Externa / Sin Cuenta</h5>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-12 col-md-6">
                            <label class="form-label small fw-bold">Tipo de Visitante</label>
                            <select class="form-select" id="unreg-tipo">
                                <option value="Estudiante Local (Sin acceso)">Estudiante Local (Olvido de credenciales)</option>
                                <option value="Profesional Externo">Profesional / Egresado / Externo</option>
                                <option value="Personal Docente">Docente Institucional</option>
                                <option value="Personal Administrativo">Personal Administrativo</option>
                                <option value="Otro">Otro Visitante</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6">
                            <label class="form-label small fw-bold">Género</label>
                            <select class="form-select" id="unreg-genero">
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                            </select>
                        </div>
                    </div>
                    
                    <p class="text-muted small mb-2">Selecciona el motivo de su visita:</p>
                    <div class="row g-2">
                        <div class="col-4">
                             <button class="btn btn-outline-success w-100 p-2 rounded-3 text-center" onclick="AdminBiblio.confirmarVisitaUnregistered('Consulta')">
                                <i class="bi bi-search d-block mb-1"></i><small class="fw-bold">Consulta</small>
                             </button>
                        </div>
                        <div class="col-4">
                             <button class="btn btn-outline-primary w-100 p-2 rounded-3 text-center" onclick="AdminBiblio.confirmarVisitaUnregistered('Trabajo Individual')">
                                <i class="bi bi-person d-block mb-1"></i><small class="fw-bold">Individual</small>
                             </button>
                        </div>
                        <div class="col-4">
                             <button class="btn btn-outline-warning w-100 p-2 rounded-3 text-center" onclick="AdminBiblio.confirmarVisitaUnregistered('Trabajo en Equipo')">
                                <i class="bi bi-people d-block mb-1"></i><small class="fw-bold">Equipo...</small>
                             </button>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }

    // Validate User & Show Options
    async function verificarUsuarioVisita() {
        const input = document.getElementById('visita-input-matricula');
        if (input.value.trim().length < 3) return;

        input.disabled = true;
        document.getElementById('visit-error-msg').classList.add('d-none');
        document.getElementById('visit-unregistered-container').classList.add('d-none');
        document.getElementById('visit-options-container').classList.add('d-none');

        try {
            const user = await BiblioService.findUserByQuery(_ctx, input.value.trim());
            if (!user) throw new Error("Estudiante NO encontrado.");

            _visitUser = user;

            // Show first name + first last name
            const parts = (user.nombre || 'Estudiante').split(' ');
            let displayName = parts[0];
            if (parts.length >= 2) displayName += ' ' + parts[1];
            document.getElementById('v-user-name').innerText = displayName;
            document.getElementById('v-user-mat').innerText = user.matricula;

            // Profile photo
            const photoContainer = document.getElementById('v-user-photo');
            if (photoContainer) {
                // Try to get photoURL from user doc
                try {
                    const userDoc = await _ctx.db.collection('usuarios').doc(user.uid).get();
                    const photoURL = userDoc.data()?.photoURL;
                    if (photoURL) {
                        photoContainer.innerHTML = `<img src="${photoURL}" class="rounded-circle" style="width:64px;height:64px;object-fit:cover;">`;
                    }
                } catch (e) { /* keep default icon */ }
            }

            document.getElementById('visit-options-container').classList.remove('d-none');
        } catch (e) {
            // No se encontro usuario
            document.getElementById('visit-unregistered-container').classList.remove('d-none');
            input.disabled = false;
        }
    }

    function toggleTeamForm() {
        document.getElementById('v-team-form').classList.toggle('d-none');
    }

    // Dynamic team member add (max 4 extras = 5 total)
    function addTeamMember() {
        const container = document.getElementById('v-team-inputs');
        const existing = container.querySelectorAll('.team-member-input').length;
        if (existing >= 4) {
            const btn = document.getElementById('btn-add-team-member');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Máximo alcanzado'; }
            return;
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control mb-2 font-monospace team-member-input animate__animated animate__fadeInDown';
        input.placeholder = `Matrícula ${existing + 2}`;
        container.appendChild(input);
        input.focus();

        if (existing + 1 >= 4) {
            const btn = document.getElementById('btn-add-team-member');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Máximo alcanzado'; }
        }
    }

    // Single Logic for all
    async function confirmarVisitaDirecta(motivo) {
        if (!_visitUser) return;

        try {
            const params = { uid: _visitUser.uid, matricula: _visitUser.matricula, motivo };

            // Validar Equipo
            if (motivo === 'Trabajo en Equipo') {
                const inputs = document.querySelectorAll('.team-member-input');
                const mates = [];
                inputs.forEach(i => { if (i.value.trim()) mates.push(i.value.trim()); });
                if (mates.length === 0) throw new Error("Ingresa integrantes para el equipo.");
                params.relatedUsers = mates;
            }

            // Register
            await BiblioService.registrarVisita(_ctx, params);

            // [ENCUESTAS] Registrar uso (Admin Trigger)
            if (window.EncuestasServicioService) {
                await EncuestasServicioService.registerServiceUsage(
                    _ctx,
                    'biblioteca',
                    { action: 'visita_admin', studentId: params.uid },
                    params.uid // Target UID
                );
            }

            // Table Assign?
            if (motivo === 'Trabajo Individual' || motivo === 'Trabajo en Equipo') {
                try {
                    const mesa = await BiblioAssetsService.asignarMesaAutomatica(_ctx, _visitUser.uid, _visitUser.matricula);
                    // Close admin modal first
                    bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
                    // Show mesa confirmation mini-modal
                    const now = new Date();
                    const expTime = new Date(now.getTime() + 60 * 60 * 1000);
                    const timeStr = expTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    showConfirmModal({
                        icon: 'table',
                        iconColor: '#0d6efd',
                        title: `Mesa Asignada: ${mesa.nombre}`,
                        message: `Bienvenido(a). Se asignó <strong>${mesa.nombre}</strong>.<br>Disponible hasta las <strong>${timeStr}</strong> (1 hora).`,
                        confirmText: 'Entendido',
                        confirmClass: 'btn-primary',
                        onConfirm: async () => { /* just close */ }
                    });
                } catch (err) {
                    bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
                    showToast(`✅ Bienvenido. (Sin mesa: ${err.message})`, "warning");
                }
            } else {
                showToast(`✅ Bienvenido.`, "success");
                bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
            }

            await loadAdminStats();

        } catch (e) {
            alert("Error: " + e.message);
        }
    }

    // --- LOGICA SIN REGISTRO ---
    async function confirmarVisitaUnregistered(motivo) {
        const tipo = document.getElementById('unreg-tipo').value;
        const genero = document.getElementById('unreg-genero').value;
        const matriculaOriginalInput = document.getElementById('visita-input-matricula').value.trim();

        try {
            const params = {
                isUnregistered: true,
                matricula: matriculaOriginalInput || 'SIN_MATRICULA',
                motivo: motivo,
                visitorType: tipo,
                gender: genero
            };

            // Register
            await BiblioService.registrarVisita(_ctx, params);

            showToast(`✅ Visita Externa/Sin Cuenta registrada.`, "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
            await loadAdminStats();

        } catch (e) {
            alert("Error registrando visita externa: " + e.message);
        }
    }

    // --- 2. MODAL PRESTAR LIBRO ---
    function abrirModalPrestamo() {
        _currentPrestamoData = null;
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-warning text-dark p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-book-half me-3"></i>Prestar Libro</h3>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                 <div class="row g-3 mb-4">
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-mortarboard-fill me-1 text-warning"></i>Estudiante</label>
                        <div class="input-group">
                            <span class="input-group-text bg-warning bg-opacity-10 border-0"><i class="bi bi-person-vcard-fill text-warning"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="prestamo-user" placeholder="Ej: 22380123" autofocus
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarPrestamo()">
                        </div>
                   </div>
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-journal-bookmark-fill me-1 text-warning"></i>Libro</label>
                        <div class="input-group">
                            <span class="input-group-text bg-warning bg-opacity-10 border-0"><i class="bi bi-upc-scan text-warning"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="prestamo-book" placeholder="Ej: B-001"
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarPrestamo()">
                        </div>
                   </div>
                </div>
                
                <div class="d-grid mb-4">
                    <button class="btn btn-warning rounded-pill border-0 fw-bold shadow-sm py-2" onclick="AdminBiblio.consultarPrestamo()">
                        <i class="bi bi-search me-2"></i>Verificar Disponibilidad
                    </button>
                </div>

                <!-- Preview Area -->
                <div id="prestamo-preview" class="d-none animate__animated animate__fadeIn">
                     <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                        <div class="card-body bg-white p-4">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted small fw-bold">USUARIO</span>
                                <span class="fw-bold text-dark" id="prev-p-user">-</span>
                            </div>
                             <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted small fw-bold">LIBRO</span>
                                <span class="fw-bold text-dark" id="prev-p-book">-</span>
                            </div>
                             <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted small fw-bold">ENTREGA ESPERADA</span>
                                <span class="fw-bold text-dark" id="prev-p-date">-</span>
                            </div>
                            <div class="mt-3 pt-3 border-top" id="prev-p-alert-box">
                                <!-- Status here -->
                            </div>
                        </div>
                     </div>
                     <button class="btn btn-warning btn-lg w-100 rounded-pill py-3 fw-bold shadow" id="btn-conf-prestamo" onclick="AdminBiblio.confirmarPrestamo()" disabled>
                        CONFIRMAR PRÉSTAMO
                     </button>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('prestamo-user').focus(), 500);
    }

    let _currentPrestamoData = null;

    async function consultarPrestamo() {
        const u = document.getElementById('prestamo-user').value.trim();
        const b = document.getElementById('prestamo-book').value.trim();
        if (!u || !b) return showToast("Ingresa ambos datos", "warning");

        try {
            const info = await BiblioService.getPrestamoInfo(_ctx, u, b);
            _currentPrestamoData = info;

            document.getElementById('prev-p-user').innerText = `${info.user.nombre} (${info.user.matricula})`;
            document.getElementById('prev-p-book').innerText = info.book.titulo;
            document.getElementById('prev-p-date').innerText = info.returnDate.toLocaleDateString();

            const alertBox = document.getElementById('prev-p-alert-box');
            const confirmBtn = document.getElementById('btn-conf-prestamo');

            let htmlContent = '';

            // ⚠️ WARNING: PENDIENTES
            if (info.user.recogidos && info.user.recogidos.length > 0) {
                htmlContent += `
                    <div class="alert alert-warning d-flex align-items-center gap-2 small p-2 mb-2">
                        <i class="bi bi-exclamation-triangle-fill fs-4"></i>
                        <div>
                            <strong>¡Atención!</strong>
                            <div class="mb-0">El usuario tiene <strong>${info.user.recogidos.length}</strong> préstamos pendientes sin devolver.</div>
                        </div>
                    </div>`;
            }

            if (info.canLoan) {
                htmlContent += `<div class="text-success small fw-bold"><i class="bi bi-check-circle me-1"></i> Todo en orden.</div>`;
                confirmBtn.disabled = false;
            } else {
                htmlContent += `<div class="text-danger fw-bold"><i class="bi bi-x-circle me-1"></i> NO SE PUEDE PRESTAR: ${info.reason}</div>`;
                confirmBtn.disabled = true;
            }

            alertBox.innerHTML = htmlContent;

            document.getElementById('prestamo-preview').classList.remove('d-none');
        } catch (e) {
            showToast(e.message, "danger");
            document.getElementById('prestamo-preview').classList.add('d-none');
        }
    }

    async function confirmarPrestamo() {
        if (!_currentPrestamoData) return;
        const btn = document.getElementById('btn-conf-prestamo');
        btn.disabled = true;
        btn.innerText = "Procesando...";

        try {
            await BiblioService.prestarLibroManual(_ctx, _currentPrestamoData.user.uid, _currentPrestamoData.book.id);
            // Auto Register Visit
            await BiblioService.registrarVisita(_ctx, { uid: _currentPrestamoData.user.uid, matricula: _currentPrestamoData.user.matricula, motivo: 'Prestamo Libro' });

            // [ENCUESTAS] Registrar uso (Admin Trigger)
            if (window.EncuestasServicioService) {
                await EncuestasServicioService.registerServiceUsage(
                    _ctx,
                    'biblioteca',
                    { action: 'prestamo_admin', bookId: _currentPrestamoData.book.id, studentId: _currentPrestamoData.user.uid },
                    _currentPrestamoData.user.uid // Target
                );
            }

            showToast("Préstamo realizado exitosamente.", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "Confirmar Préstamo";
        }
    }


    // --- 3. MODAL DEVOLVER LIBRO ---
    function abrirModalDevolucion() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-success text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-box-arrow-in-down me-3"></i>Devolver Libro</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                 <div class="row g-3 mb-4">
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-mortarboard-fill me-1 text-success"></i>Estudiante</label>
                        <div class="input-group">
                            <span class="input-group-text bg-success bg-opacity-10 border-0"><i class="bi bi-person-vcard-fill text-success"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="devol-user" placeholder="Ej: 22380123" autofocus
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarDevolucion()">
                        </div>
                   </div>
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-journal-bookmark-fill me-1 text-success"></i>Libro</label>
                        <div class="input-group">
                            <span class="input-group-text bg-success bg-opacity-10 border-0"><i class="bi bi-upc-scan text-success"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="devol-book" placeholder="Ej: B-001"
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarDevolucion()">
                        </div>
                   </div>
                </div>
                
                <div class="d-grid mb-4">
                    <button class="btn btn-success rounded-pill border-0 fw-bold shadow-sm py-2" onclick="AdminBiblio.consultarDevolucion()">
                        <i class="bi bi-eye me-2"></i>Calcular Deuda y Estado
                    </button>
                </div>

                <!-- Preview Area -->
                <div id="devol-preview" class="d-none animate__animated animate__fadeIn">
                     <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                        <div class="card-body bg-white p-4">
                            <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">ESTUDIANTE</span>
                                <span class="fw-bold text-dark" id="prev-d-user">-</span>
                            </div>
                            <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">LIBRO</span>
                                <span class="fw-bold text-dark" id="prev-d-book">-</span>
                            </div>
                             <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">SOLICITADO EL</span>
                                <span class="fw-bold text-dark" id="prev-d-reqdate">-</span>
                            </div>
                            <div class="d-flex justify-content-between mb-3 pb-3">
                                <span class="text-muted small fw-bold">DIAS DE RETRASO</span>
                                <span class="fw-bold text-danger" id="prev-d-days">0</span>
                            </div>
                            <div class="bg-light rounded-3 p-3 d-flex justify-content-between align-items-center mb-3">
                                <span class="fw-bold text-muted">TOTAL A PAGAR</span>
                                <span class="display-6 fw-bold text-danger" id="prev-d-debt">$0.00</span>
                            </div>
                            <!-- Actions Injection -->
                            <div id="devol-preview-actions"></div>
                        </div>
                     </div>
                     <button class="btn btn-success btn-lg w-100 rounded-pill py-3 fw-bold shadow" id="btn-conf-devol" onclick="AdminBiblio.confirmarDevolucion()">
                        CONFIRMAR DEVOLUCIÓN
                     </button>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('devol-user').focus(), 500);
    }

    let _currentDevolData = null;

    async function consultarDevolucion() {
        const u = document.getElementById('devol-user').value.trim();
        const b = document.getElementById('devol-book').value.trim();
        if (!u || !b) return showToast("Ingresa datos", "warning");

        try {
            const info = await BiblioService.getDevolucionInfo(_ctx, u, b);
            _currentDevolData = info;

            document.getElementById('prev-d-user').innerText = `${info.user.nombre} (${info.user.matricula})`;
            document.getElementById('prev-d-book').innerText = info.loan.tituloLibro;
            document.getElementById('prev-d-reqdate').innerText = info.loan.fechaSolicitud.toDate().toLocaleDateString() + ' ' + info.loan.fechaSolicitud.toDate().toLocaleTimeString();
            document.getElementById('prev-d-days').innerText = info.daysLate > 0 ? info.daysLate : 'Ninguno';
            document.getElementById('prev-d-debt').innerText = `$${info.fine.toFixed(2)}`;

            let actionsHtml = '';

            // ⚠️ WARNING: OTROS PENDIENTES
            if (info.user.recogidos && info.user.recogidos.length > 0) {
                // El usuario tiene préstamos activos. 
                // Asumimos que la lista incluye el actual. Verificamos si hay > 1.
                // O si por alguna razon el servicio ya lo filtro (poco probable), seria > 0.
                // Mensaje seguro: "X libro(s) pendiente(s)"
                const total = info.user.recogidos.length;
                const others = total - 1;
                if (others > 0) {
                    actionsHtml += `
                        <div class="alert alert-warning d-flex align-items-center gap-2 small p-2 mb-3">
                            <i class="bi bi-info-circle-fill fs-4"></i>
                            <div>
                                <strong>¡Ojo!</strong>
                                <div class="mb-0">El estudiante aún conserva <strong>${others}</strong> libro(s) más.</div>
                            </div>
                        </div>`;
                }
            }

            if (info.daysLate > 0) {
                // Show Forgive Option
                actionsHtml += `
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" id="check-perdonar" onchange="AdminBiblio.togglePerdonar(this.checked)">
                        <label class="form-check-label fw-bold text-primary" for="check-perdonar">
                            <i class="bi bi-shield-check me-1"></i>Perdonar Multa (Justificar)
                        </label>
                    </div>
                    <div id="div-justificacion" class="d-none mb-3 animate__animated animate__fadeIn">
                        <label class="small text-muted fw-bold">Motivo de Condonación (Obligatorio)</label>
                        <textarea class="form-control" id="txt-justificacion" rows="2" placeholder="Ej: Certificado médico presentado..."></textarea>
                    </div>
                `;
            }

            document.getElementById('devol-preview-actions').innerHTML = actionsHtml;

            document.getElementById('devol-preview').classList.remove('d-none');
            // Reset state
            AdminBiblio.togglePerdonar(false);

        } catch (e) {
            showToast(e.message, "danger");
            document.getElementById('devol-preview').classList.add('d-none');
        }
    }

    function togglePerdonar(checked) {
        const div = document.getElementById('div-justificacion');
        const btn = document.getElementById('btn-conf-devol');

        if (checked) {
            if (div) div.classList.remove('d-none');
            if (btn) {
                btn.classList.remove('btn-success');
                btn.classList.add('btn-info', 'text-white');
                btn.innerHTML = 'CONFIRMAR CON PERDÓN';
            }
        } else {
            if (div) div.classList.add('d-none');
            if (btn) {
                btn.classList.remove('btn-info', 'text-white');
                btn.classList.add('btn-success');
                btn.innerHTML = 'CONFIRMAR DEVOLUCIÓN';
            }
        }
    }

    async function confirmarDevolucion() {
        if (!_currentDevolData) return;

        const isForgiven = document.getElementById('check-perdonar')?.checked;
        const justification = document.getElementById('txt-justificacion')?.value.trim();

        if (isForgiven && !justification) {
            return showToast("Debes escribir una justificación para perdonar la multa.", "warning");
        }

        const btn = document.getElementById('btn-conf-devol');
        btn.disabled = true;
        btn.innerText = "Procesando...";

        try {
            await BiblioService.recibirLibroAdmin(_ctx,
                _currentDevolData.loan.id,
                _currentDevolData.loan.libroId,
                isForgiven,
                justification
            );

            // Auto Register Visit
            await BiblioService.registrarVisita(_ctx, { uid: _currentDevolData.user.uid, matricula: _currentDevolData.user.matricula, motivo: 'Devolucion Libro' });

            // [ENCUESTAS] Registrar uso (Admin Trigger)
            if (window.EncuestasServicioService) {
                await EncuestasServicioService.registerServiceUsage(
                    _ctx,
                    'biblioteca',
                    { action: 'devolucion_admin', loanId: _currentDevolData.loan.id, studentId: _currentDevolData.user.uid },
                    _currentDevolData.user.uid // Target
                );
            }

            showToast("Libro recibido correctamente.", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = isForgiven ? "CONFIRMAR CON PERDÓN" : "CONFIRMAR DEVOLUCIÓN";
        }
    }


    // --- 4. COMPUTADORAS Y SALA ---

    function abrirModalComputadoras() {
        // ... (existing modal code) ...
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-info text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-pc-display me-3"></i>Computadoras y Sala</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                 <label class="form-label small fw-bold text-muted"><i class="bi bi-person-badge-fill me-1 text-info"></i>Número de Control del Estudiante</label>
                 <div class="input-group mb-4">
                    <span class="input-group-text bg-info bg-opacity-10 border-0"><i class="bi bi-person-vcard-fill text-info"></i></span>
                    <input type="text" class="form-control rounded-end fs-4 fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="pc-matricula" placeholder="Ej: 22380123" autofocus>
                 </div>
                
                <h6 class="fw-bold text-muted mb-3 text-uppercase ls-1">Selecciona Equipo</h6>
                <div class="row g-3" id="admin-pc-grid">
                    <div class="text-center w-100 py-3"><span class="spinner-border"></span></div>
                </div>
            </div>
         `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('pc-matricula').focus(), 500);

        // Grid load
        loadPCGrid();

        // Force one cleanup check now (interval is already running in initAdmin)
        BiblioAssetsService.liberarActivosExpirados(_ctx).then(freed => {
            if (freed.length > 0) showToast(`🔄 Liberadas: ${freed.join(', ')}`, 'info');
        });
    }

    function loadPCGrid() {
        BiblioAssetsService.streamAssetsAdmin(_ctx, (assets) => {
            const grid = document.getElementById('admin-pc-grid');
            if (!grid) return;

            // Filter only PCs and Sala
            const computers = assets.filter(a => a.tipo === 'pc' || a.tipo === 'sala').sort((a, b) => a.nombre.localeCompare(b.nombre));

            grid.innerHTML = computers.map(pc => {
                const isBusy = pc.status === 'ocupado';
                let timeInfo = '';
                if (isBusy && pc.expiresAt) {
                    const expiresMs = pc.expiresAt.toMillis ? pc.expiresAt.toMillis() : pc.expiresAt;
                    const remainMs = expiresMs - Date.now();
                    if (remainMs <= 0) {
                        timeInfo = `<span class="badge bg-warning text-dark mt-1" style="font-size:0.65rem;">⏰ EXPIRADO</span>`;
                    } else {
                        const mins = Math.ceil(remainMs / 60000);
                        timeInfo = `<span class="badge bg-white text-info mt-1" style="font-size:0.65rem;">⏱ ${mins} min</span>`;
                    }
                }
                const occupantLabel = isBusy && pc.occupiedByMatricula
                    ? `<span class="d-block small text-white-50 mt-1" style="font-size:0.7rem;">${pc.occupiedByMatricula}</span>`
                    : '';

                return `
                    <div class="col-md-3 col-6">
                        <button class="btn ${isBusy ? 'btn-danger' : 'btn-outline-primary bg-white'} w-100 h-100 p-3 rounded-4 shadow-sm position-relative" 
                                onclick="AdminBiblio.handleAssetClick('${pc.id}', '${pc.nombre}', '${pc.status}', '${pc.occupiedBy || ''}')">
                            <i class="bi bi-${pc.tipo === 'sala' ? 'people' : 'pc-display'} fs-2 mb-2 d-block"></i>
                            <span class="fw-bold small d-block">${pc.nombre}</span>
                            ${isBusy
                        ? `<span class="badge bg-white text-danger mt-2">OCUPADO</span>${occupantLabel}${timeInfo}`
                        : `<span class="badge bg-primary-subtle text-primary mt-2">DISPONIBLE</span>`}
                        </button>
                    </div>
                `;
            }).join('');
        });
    }

    // --- MINI-MODAL CONFIRM (reemplaza confirm() nativo) ---
    function showConfirmModal({ icon, iconColor, title, message, confirmText, confirmClass, onConfirm }) {
        // Remover modal previo si existe
        const prev = document.getElementById('mini-confirm-modal');
        if (prev) prev.remove();

        const modalHtml = `
            <div class="modal fade" id="mini-confirm-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden">
                        <div class="modal-body text-center p-4">
                            <div class="mb-3">
                                <div class="d-inline-flex align-items-center justify-content-center rounded-circle p-3" style="background:${iconColor}15; width:70px; height:70px;">
                                    <i class="bi bi-${icon}" style="font-size:2rem; color:${iconColor};"></i>
                                </div>
                            </div>
                            <h5 class="fw-bold mb-2">${title}</h5>
                            <p class="text-muted small mb-0">${message}</p>
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
            // [FIX] Restore body class if another modal is open (nested modal fix)
            if (document.querySelector('.modal.show')) {
                document.body.classList.add('modal-open');
            }
        }, { once: true });
        modal.show();
    }

    async function asignarPC(id, nombre) {
        const mat = document.getElementById('pc-matricula').value.trim();
        if (mat.length < 3) return showToast("Ingresa matrícula primero", "warning");

        // Calculate time
        const now = new Date();
        const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 Hour
        const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        showConfirmModal({
            icon: 'pc-display',
            iconColor: '#0dcaf0',
            title: `Asignar ${nombre}`,
            message: `Se asignará a <strong>${mat}</strong>.<br>Se liberará automáticamente a las <strong>${timeStr}</strong>.`,
            confirmText: 'Asignar',
            confirmClass: 'btn-info text-white',
            onConfirm: async () => {
                try {
                    const visit = await BiblioService.registrarVisita(_ctx, { matricula: mat, motivo: `Uso ${nombre}` });
                    const uid = visit?.uid || 'anonimo';
                    await BiblioAssetsService.asignarActivoManual(_ctx, uid, id);
                    await _ctx.db.collection('biblio-activos').doc(id).update({ occupiedByMatricula: mat });

                    showToast(`✅ ${nombre} asignado a ${mat}. Expira: ${timeStr}`, "success");
                    bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
                } catch (e) { showToast(e.message, "danger"); }
            }
        });
    }

    // [FIX] Helper to handle PC clicks (Assign or Release)
    async function handleAssetClick(id, nombre, status, occupiedBy) {
        if (status === 'ocupado') {
            showConfirmModal({
                icon: 'unlock-fill',
                iconColor: '#dc3545',
                title: `Liberar ${nombre}`,
                message: `¿Deseas liberar este equipo?<br>El equipo quedará <strong>disponible</strong> para otros usuarios.`,
                confirmText: 'Liberar Equipo',
                confirmClass: 'btn-danger',
                onConfirm: async () => {
                    try {
                        await BiblioAssetsService.liberarActivo(_ctx, id);
                        showToast(`✅ ${nombre} liberado`, "success");
                        loadPCGrid();
                    } catch (e) { showToast(e.message, "danger"); }
                }
            });
        } else {
            asignarPC(id, nombre);
        }
    }

    // --- 6. GESTION DE LIBROS (NUEVO) ---

    function abrirModalGestionLibros() {
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
            <div class="modal-body p-5 bg-light text-center">
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
            <div class="modal-body p-4 bg-light">
                <form id="book-form" onsubmit="event.preventDefault(); AdminBiblio.saveBook('${bookToEdit?.id || ''}')">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label small fw-bold text-muted">No. Adquisición *</label>
                            <input type="text" class="form-control rounded-3" id="bf-adq" required value="${bookToEdit?.adquisicion || ''}" ${isEdit ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-8">
                            <label class="form-label small fw-bold text-muted">Título del Libro *</label>
                            <input type="text" class="form-control rounded-3" id="bf-titulo" required value="${(bookToEdit?.titulo || '').replace(/"/g, '&quot;')}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Autor *</label>
                            <input type="text" class="form-control rounded-3" id="bf-autor" required value="${(bookToEdit?.autor || '').replace(/"/g, '&quot;')}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-bold text-muted">Año</label>
                            <input type="text" class="form-control rounded-3" id="bf-anio" value="${bookToEdit?.año || ''}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-bold text-muted">Copias *</label>
                            <input type="number" class="form-control rounded-3" id="bf-copias" required min="1" value="${bookToEdit?.copiasDisponibles || 1}">
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
                            <input type="text" class="form-control rounded-3" id="bf-clasif" placeholder="Ej: HM251 W46" value="${bookToEdit?.clasificacion || ''}">
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
            adquisicion: document.getElementById('bf-adq').value.trim(),
            titulo: document.getElementById('bf-titulo').value.trim(),
            autor: document.getElementById('bf-autor').value.trim(),
            año: document.getElementById('bf-anio').value.trim(),
            copiasDisponibles: parseInt(document.getElementById('bf-copias').value),
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
            <div class="modal-body p-4 bg-light">
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

        // Escape quotes for onclick params
        const safeJson = JSON.stringify(book).replace(/"/g, '&quot;');

        container.innerHTML = `
            <div class="card-body d-flex align-items-center gap-3 p-3">
                <div class="bg-warning bg-opacity-10 p-3 rounded-3 text-warning">
                    <i class="bi bi-book fs-3"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="badge bg-dark text-white mb-1">${book.adquisicion || 'S/N'}</div>
                    <h6 class="fw-bold mb-1 text-truncate">${book.titulo}</h6>
                    <small class="text-muted d-block text-truncate">${book.autor}</small>
                </div>
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" onclick='AdminBiblio.renderBookForm(${safeJson})'>
                    Modificar <i class="bi bi-arrow-right ms-1"></i>
                </button>
            </div>
        `;
    }


    // --- 5. CONFIGURACION ---
    function abrirModalConfig() {
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
            <div class="modal-body p-0 bg-light">
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
        BiblioAssetsService.streamAssetsAdmin(_ctx, (assets) => {
            const renderCard = (a) => `
                <div class="col-md-6 col-lg-6">
                    <div class="card h-100 shadow-sm border-0">
                        <div class="card-body d-flex align-items-center justify-content-between p-3">
                            <div class="d-flex align-items-center gap-3">
                                 <div class="bg-light rounded-circle p-2 text-muted">
                                    <i class="bi bi-${a.tipo === 'pc' ? 'pc-display' : (a.tipo === 'mesa' ? 'table' : 'people')} fs-5"></i>
                                 </div>
                                 <div class="lh-sm">
                                     <div class="fw-bold text-dark">${a.nombre}</div>
                                     <small class="text-muted text-uppercase" style="font-size:0.65rem;">${a.status}</small>
                                 </div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" title="Habilitar/Deshabilitar" 
                                           ${a.status !== 'mantenimiento' ? 'checked' : ''} 
                                           onchange="AdminBiblio.toggleAssetStatus('${a.id}', this.checked)">
                                </div>
                                <button class="btn btn-sm text-danger opacity-50 hover-opacity-100" title="Eliminar definitivamente"
                                        onclick="AdminBiblio.confirmDeleteAsset('${a.id}', '${a.nombre}')">
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
        if (!confirm(`¿Estás seguro de ELIMINAR "${nombre}"?\nEsta acción es irreversible.`)) return;
        try {
            await BiblioAssetsService.deleteAsset(_ctx, id);
            showToast("Espacio eliminado", "info");
        } catch (e) { showToast(e.message, "danger"); }
    }

    async function toggleAssetStatus(id, active) {
        try {
            await BiblioAssetsService.saveAsset(_ctx, id, { status: active ? 'disponible' : 'mantenimiento' });
            // showToast("Estado actualizado", "success"); // Too noisy
        } catch (e) { showToast("Error al actualizar", "danger"); }
    }

    // --- SERVICIOS DIGITALES (PC / SALAS) ---

    let _currentServiceType = null;
    let _selectedAssetId = null;
    let _selectedTimeBlock = null;

    function abrirModalServicio(type) {
        _currentServiceType = type;
        const title = type === 'pc' ? 'Reservar Computadora' : 'Reservar Sala de Estudio';
        const modalContent = document.getElementById('servicio-reserva-content');

        // Date Default: Today
        const today = new Date().toISOString().split('T')[0];

        modalContent.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white">
                <h5 class="fw-bold mb-0"><i class="bi bi-${type === 'pc' ? 'pc-display' : 'people'} me-2"></i>${title}</h5>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                <label class="small fw-bold text-muted mb-2">1. Elige una fecha</label>
                <input type="date" id="service-date-picker" class="form-control rounded-pill mb-4 shadow-sm" value="${today}" min="${today}" onchange="AdminBiblio.renderAvailabilityGrid()">
                
                <label class="small fw-bold text-muted mb-2">2. Disponibilidad</label>
                <div id="service-availability-grid" class="d-flex flex-column gap-2" style="max-height: 300px; overflow-y: auto;">
                    <div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm"></span> Cargando horarios...</div>
                </div>
            </div>
            <div class="modal-footer border-0 p-3">
                <button class="btn btn-primary w-100 rounded-pill shadow" id="btn-confirm-service" disabled onclick="AdminBiblio.confirmarReserva()">
                    Confirmar Reserva
                </button>
            </div>
        `;

        new bootstrap.Modal(document.getElementById('modal-servicio-reserva')).show();
        setTimeout(renderAvailabilityGrid, 500); // Allow render
    }

    async function renderAvailabilityGrid() {
        const date = document.getElementById('service-date-picker').value;
        const container = document.getElementById('service-availability-grid');
        const type = _currentServiceType;

        container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>'; // Clear & Load

        try {
            // 1. Get Assets of Type
            const allAssets = await new Promise(resolve => {
                // Hack: use existing stream or fetch once.
                const unsub = BiblioAssetsService.streamAssets(_ctx, (list) => {
                    resolve(list.filter(a => a.tipo === type && (a.status === 'disponible' || !a.status))); // Filter active only
                    unsub(); // Unsub immediately
                });
            });

            // 2. Get Occupied Slots
            const occupiedMap = await BiblioAssetsService.getAvailability(_ctx, date, type);

            // 3. Render
            if (allAssets.length === 0) {
                container.innerHTML = `<div class="alert alert-secondary small">No hay equipos disponibles en este momento.</div>`;
                return;
            }

            container.innerHTML = '';

            // Generate Time Blocks (e.g. 8AM to 6PM)
            const hours = [];
            for (let i = 8; i <= 18; i++) hours.push(`${i.toString().padStart(2, '0')}:00`);

            allAssets.forEach(asset => {
                const assetRow = document.createElement('div');
                assetRow.className = 'bg-white p-3 rounded-3 shadow-sm mb-2';

                const occupiedHours = occupiedMap[asset.id] || [];

                let slotsHtml = `<div class="d-flex gap-2 overflow-auto pb-1" style="scrollbar-width:thin;">`;
                hours.forEach(h => {
                    const isTaken = occupiedHours.includes(h);
                    // Disable past hours if today
                    const now = new Date();
                    const isToday = new Date().toISOString().split('T')[0] === date;
                    const isPast = isToday && parseInt(h) <= now.getHours();

                    const disabled = isTaken || isPast;
                    const styleClass = isTaken ? 'bg-danger-subtle text-danger border-danger' :
                        (isPast ? 'bg-light text-muted border-light' : 'btn-outline-primary');

                    if (disabled) {
                        slotsHtml += `<button class="btn btn-sm ${styleClass} rounded-pill px-3" disabled style="min-width: 70px;">${h}</button>`;
                    } else {
                        slotsHtml += `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" style="min-width: 70px;" 
                                        onclick="AdminBiblio.selectSlot(this, '${asset.id}', '${h}')">${h}</button>`;
                    }
                });
                slotsHtml += `</div>`;

                assetRow.innerHTML = `
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-${type === 'pc' ? 'pc-display' : 'table'} text-muted me-2"></i>
                        <span class="fw-bold small text-dark">${asset.nombre}</span>
                    </div>
                    ${slotsHtml}
                `;
                container.appendChild(assetRow);
            });

        } catch (e) {
            container.innerHTML = `<div class="text-danger small">Error: ${e.message}</div>`;
        }
    }

    function selectSlot(btn, assetId, time) {
        // Clear previous selection
        document.querySelectorAll('#service-availability-grid button').forEach(b => {
            if (!b.disabled) {
                b.classList.remove('btn-primary', 'text-white');
                b.classList.add('btn-outline-primary');
            }
        });

        // Highlight new
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'text-white');

        _selectedAssetId = assetId;
        _selectedTimeBlock = time;

        document.getElementById('btn-confirm-service').disabled = false;
    }

    async function confirmarReserva() {
        const date = document.getElementById('service-date-picker').value;
        if (!_selectedAssetId || !_selectedTimeBlock || !date) return;

        const btn = document.getElementById('btn-confirm-service');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Reservando...';

        try {
            await BiblioAssetsService.reservarEspacio(_ctx, {
                studentId: _ctx.auth.currentUser.uid,
                assetId: _selectedAssetId,
                hourBlock: _selectedTimeBlock,
                date: date,
                tipo: _currentServiceType
            });
            showToast("Reserva exitosa", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-servicio-reserva')).hide();

            // [ENCUESTAS] Registrar uso
            if (window.EncuestasServicioService) {
                EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: 'reserva_espacio', type: _currentServiceType });
            }
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "Reintentar";
        }
    }

    return {
        init,
        abrirModalVisita, confirmarVisitaDirecta, verificarUsuarioVisita, toggleTeamForm, addTeamMember, terminarVisita, showAdminItemDetail,
        confirmarVisitaUnregistered,
        abrirModalPrestamo, consultarPrestamo, confirmarPrestamo,
        abrirModalDevolucion, consultarDevolucion, confirmarDevolucion, togglePerdonar,
        abrirModalComputadoras, asignarPC, handleAssetClick,
        abrirModalConfig, toggleAssetStatus, openAddAssetModal, createAsset, confirmDeleteAsset,
        abrirModalGestionLibros, renderBookForm, saveBook, renderBookEditSearch, handleEditSearch
    };
})();
window.AdminBiblio = AdminBiblio;
