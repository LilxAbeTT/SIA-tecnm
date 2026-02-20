// modules/quejas.js
// Módulo de Quejas y Sugerencias - SIA
// Vista Principal

if (!window.Quejas) {
    window.Quejas = (function () {
        let _ctx = null;
        let _profile = null;
        let _isAdmin = false;
        // ... (rest of the module) ...
        const show = (el) => el?.classList.remove('d-none');
        const hide = (el) => el?.classList.add('d-none');
        const formatDate = (date) => {
            if (!date) return '-';
            return new Date(date).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
        };

        const CANNED_RESPONSES = {
            'queja': [
                "Tu reporte ha sido recibido. Iniciaremos la investigación correspondiente.",
                "Gracias por informarnos. Canalizaremos esto al área responsable.",
                "Necesitamos más detalles para proceder. Por favor, acude a la oficina de Calidad."
            ],
            'sugerencia': [
                "¡Excelente propuesta! La tendremos en cuenta para futuras mejoras.",
                "Gracias por tu sugerencia. Analizaremos su viabilidad.",
                "Agradecemos tu interés en mejorar el Tec. Lo revisaremos en la próxima junta."
            ],
            'felicitacion': [
                "¡Muchas gracias! Haremos llegar tus felicitaciones al personal.",
                "Nos alegra saber que estás satisfecho con el servicio.",
                "Gracias por tomarte el tiempo de reconocer el buen trabajo."
            ],
            'general': [
                "Recibido, lo estamos revisando.",
                "Por favor acude a Servicios Escolares.",
                "Gracias, estamos trabajando en ello."
            ]
        };

        // --- INIT ---
        async function init(ctx) {
            console.log("[Quejas] Init started", ctx);
            _ctx = ctx;
            _profile = ctx.profile;

            const container = document.getElementById('view-quejas');
            if (!container) {
                console.error("[Quejas] Container #view-quejas not found!");
                return;
            }

            // 1. Check Permissions
            _isAdmin = _profile.permissions?.quejas === 'admin' || _profile.email === 'calidad@loscabos.tecnm.mx';

            // 2. Render Layout
            renderLayout(container);

            // 3. Load Data
            if (_isAdmin) {
                initAdminView();
            } else {
                initStudentView();
            }
        }

        // --- CAMERA & COMPRESSION HELPERS ---
        let _cameraStream = null;
        let _capturedBlob = null;

        async function startCamera() {
            const video = document.getElementById('camera-preview');
            const container = document.getElementById('camera-container');
            const ui = document.getElementById('evidence-ui');

            if (!video) return;

            try {
                _cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                video.srcObject = _cameraStream;
                video.play();

                container.classList.remove('d-none');
                ui.classList.add('d-none');
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("No se pudo acceder a la cámara. Por favor verifica los permisos.");
            }
        }

        function stopCamera() {
            if (_cameraStream) {
                _cameraStream.getTracks().forEach(track => track.stop());
                _cameraStream = null;
            }
            document.getElementById('camera-container')?.classList.add('d-none');
            document.getElementById('evidence-ui')?.classList.remove('d-none');
        }

        function takePhoto() {
            const video = document.getElementById('camera-preview');
            const canvas = document.createElement('canvas');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(blob => {
                _capturedBlob = blob;

                // Show Preview
                const previewImg = document.getElementById('evidence-preview-img');
                const previewCont = document.getElementById('evidence-preview-container');
                const fileInput = document.getElementById('q-file');

                if (previewImg) {
                    previewImg.src = URL.createObjectURL(blob);
                    previewImg.onload = () => URL.revokeObjectURL(previewImg.src);
                }

                previewCont.classList.remove('d-none');
                fileInput.value = ''; // Clear file input if photo taken

                stopCamera();
            }, 'image/jpeg', 0.8);
        }

        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Clear any previous camera blob
            _capturedBlob = null;

            // Show Preview
            const previewImg = document.getElementById('evidence-preview-img');
            const previewCont = document.getElementById('evidence-preview-container');

            if (previewImg) {
                previewImg.src = URL.createObjectURL(file);
                previewImg.onload = () => URL.revokeObjectURL(previewImg.src);
            }
            previewCont.classList.remove('d-none');

            // Hide camera UI if open
            stopCamera();
        }

        function clearEvidence() {
            _capturedBlob = null;
            const fileInput = document.getElementById('q-file');
            if (fileInput) fileInput.value = '';
            document.getElementById('evidence-preview-container')?.classList.add('d-none');
            stopCamera();
        }

        async function compressImage(fileOrBlob) {
            // Max size target: 2MB for safety options
            const MAX_SIZE_MB = 2;
            const MAX_WIDTH = 1280;
            const MAX_HEIGHT = 1280;

            if (fileOrBlob.size / 1024 / 1024 < MAX_SIZE_MB) {
                return fileOrBlob; // No need to compress
            }

            console.log(`[Compression] Original: ${(fileOrBlob.size / 1024 / 1024).toFixed(2)}MB`);

            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = URL.createObjectURL(fileOrBlob);
                img.onload = () => {
                    URL.revokeObjectURL(img.src);

                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Export compressed
                    canvas.toBlob(blob => {
                        console.log(`[Compression] Compressed: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                        resolve(blob);
                    }, 'image/jpeg', 0.7);
                };
                img.onerror = reject;
            });
        }


        function renderLayout(container) {
            container.innerHTML = `
                <div id="quejas-app" class="animate-fade-in">
                    ${_isAdmin ? renderAdminStructure() : renderStudentStructure()}
                </div>
                
                <!-- Modal Detalle Ticket (Compartido) -->
                <div class="modal fade" id="modalQuejaDetail" tabindex="-1">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow">
                            <div class="modal-header border-0 pb-0">
                                <h5 class="fw-bold">Detalle del Ticket</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body p-4" id="modal-queja-body">
                                <!-- Dynamic Content -->
                                <div class="text-center py-5"><span class="spinner-border text-primary"></span></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // ==========================================
        // STUDENT VIEW
        // ==========================================

        function renderStudentStructure() {
            return `
                <style>
                    /* Custom Radio Styles for Quejas */
                    #quejas-app .btn-card-select {
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        border: 2px solid transparent;
                    }
                    #quejas-app .btn-check:checked + .btn-card-select {
                        background-color: #f3e8ff !important; /* Purple-ish light */
                        border-color: #6f42c1 !important;
                        color: #59359a !important;
                        transform: scale(0.98);
                        box-shadow: 0 4px 12px rgba(111, 66, 193, 0.15) !important;
                    }
                    #quejas-app .btn-check:checked + .btn-card-select i {
                        transform: scale(1.1);
                        transition: transform 0.2s;
                    }
                </style>

                <div class="hero-banner-v2 shadow-sm mb-4" style="background: linear-gradient(135deg, #6610f2 0%, #6f42c1 100%);">
                    <div class="hero-content-v2 text-white">
                        <span class="badge bg-white text-primary mb-2 fw-bold"><i class="bi bi-chat-heart-fill me-1"></i>Tu voz cuenta</span>
                        <h2 class="fw-bold mb-2">Quejas y Sugerencias</h2>
                        <p class="small opacity-75 mb-0">Ayúdanos a mejorar el campus. Tus comentarios son confidenciales para el departamento de Calidad.</p>
                    </div>
                    <i class="bi bi-inbox-fill hero-bg-icon-v2 text-white opacity-25"></i>
                </div>
    
                <div class="row g-4">
                    <!-- FORMULARIO -->
                    <div class="col-lg-5">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white py-3 border-0">
                                <h6 class="fw-bold mb-0 text-primary"><i class="bi bi-pencil-square me-2"></i>Nueva Solicitud</h6>
                            </div>
                            <div class="card-body p-4">
                                <form id="form-queja-new" onsubmit="event.preventDefault(); Quejas.askForConfirmation()">
                                    
                                    <!-- 1. TIPO (Visual Radio Cards) -->
                                    <div class="mb-4">
                                        <label class="form-label small fw-bold text-muted mb-2">¿Qué deseas enviar?</label>
                                        <div class="d-flex gap-2">
                                            <input type="radio" class="btn-check" name="q-tipo" id="t-queja" value="queja" checked>
                                            <label class="btn btn-outline-light text-dark border-0 bg-light flex-grow-1 shadow-sm rounded-3 py-3 btn-card-select" for="t-queja">
                                                <i class="bi bi-exclamation-triangle-fill d-block fs-4 mb-1 text-warning"></i>
                                                <span class="small fw-bold">Queja</span>
                                            </label>

                                            <input type="radio" class="btn-check" name="q-tipo" id="t-sugerencia" value="sugerencia">
                                            <label class="btn btn-outline-light text-dark border-0 bg-light flex-grow-1 shadow-sm rounded-3 py-3 btn-card-select" for="t-sugerencia">
                                                <i class="bi bi-lightbulb-fill d-block fs-4 mb-1 text-info"></i>
                                                <span class="small fw-bold">Sugerencia</span>
                                            </label>

                                            <input type="radio" class="btn-check" name="q-tipo" id="t-felicitacion" value="felicitacion">
                                            <label class="btn btn-outline-light text-dark border-0 bg-light flex-grow-1 shadow-sm rounded-3 py-3 btn-card-select" for="t-felicitacion">
                                                <i class="bi bi-heart-fill d-block fs-4 mb-1 text-danger"></i>
                                                <span class="small fw-bold">Felicitación</span>
                                            </label>
                                        </div>
                                    </div>

                                    <!-- 2. CATEGORIA (Grid) -->
                                    <div class="mb-4">
                                        <label class="form-label small fw-bold text-muted mb-2">Categoría</label>
                                        <div class="d-grid gap-2" style="grid-template-columns: 1fr 1fr;">
                                            <input type="radio" class="btn-check" name="q-cat" id="c-infra" value="infraestructura" checked>
                                            <label class="btn btn-outline-light text-start text-dark border-0 bg-light shadow-sm rounded-3 p-3 btn-card-select" for="c-infra">
                                                <i class="bi bi-building-fill me-2 text-secondary"></i>Infraestructura
                                            </label>

                                            <input type="radio" class="btn-check" name="q-cat" id="c-serv" value="servicios">
                                            <label class="btn btn-outline-light text-start text-dark border-0 bg-light shadow-sm rounded-3 p-3 btn-card-select" for="c-serv">
                                                <i class="bi bi-router-fill me-2 text-secondary"></i>Servicios
                                            </label>

                                            <input type="radio" class="btn-check" name="q-cat" id="c-doc" value="docentes">
                                            <label class="btn btn-outline-light text-start text-dark border-0 bg-light shadow-sm rounded-3 p-3 btn-card-select" for="c-doc">
                                                <i class="bi bi-book-half me-2 text-secondary"></i>Docentes
                                            </label>

                                            <input type="radio" class="btn-check" name="q-cat" id="c-adm" value="administrativo">
                                            <label class="btn btn-outline-light text-start text-dark border-0 bg-light shadow-sm rounded-3 p-3 btn-card-select" for="c-adm">
                                                <i class="bi bi-file-earmark-text-fill me-2 text-secondary"></i>Trámites
                                            </label>

                                            <input type="radio" class="btn-check" name="q-cat" id="c-limp" value="limpieza">
                                            <label class="btn btn-outline-light text-start text-dark border-0 bg-light shadow-sm rounded-3 p-3 btn-card-select" for="c-limp">
                                                <i class="bi bi-stars me-2 text-secondary"></i>Limpieza
                                            </label>

                                            <input type="radio" class="btn-check" name="q-cat" id="c-otro" value="otro">
                                            <label class="btn btn-outline-light text-start text-dark border-0 bg-light shadow-sm rounded-3 p-3 btn-card-select" for="c-otro">
                                                <i class="bi bi-three-dots me-2 text-secondary"></i>Otro
                                            </label>
                                        </div>
                                    </div>

                                    <div class="mb-4">
                                        <label class="form-label small fw-bold text-muted">Descripción</label>
                                        <textarea class="form-control border-0 bg-light shadow-inner" id="q-desc" rows="4" required placeholder="Describe la situación con el mayor detalle posible..."></textarea>
                                    </div>

                                    <!-- 3. EVIDENCIA (Mobile Optimized) -->
                                    <div class="mb-4">
                                        <label class="form-label small fw-bold text-muted mb-2">Evidencia (Opcional)</label>
                                        
                                        <div id="evidence-ui" class="d-flex gap-2">
                                            <input type="file" id="q-file" accept="image/*" class="d-none" onchange="Quejas.handleFileSelect(event)">
                                            
                                            <button type="button" class="btn btn-light border border-dashed text-muted fw-bold flex-grow-1 py-3 rounded-4 shadow-sm" onclick="document.getElementById('q-file').click()">
                                                <i class="bi bi-image me-2 fs-5 align-middle"></i>
                                                <span class="align-middle">Galería</span>
                                            </button>

                                            <button type="button" class="btn btn-light border border-dashed text-muted fw-bold flex-grow-1 py-3 rounded-4 shadow-sm" onclick="Quejas.startCamera()">
                                                <i class="bi bi-camera-fill me-2 fs-5 align-middle"></i>
                                                <span class="align-middle">Cámara</span>
                                            </button>
                                        </div>

                                        <!-- Preview -->
                                        <div id="evidence-preview-container" class="position-relative mt-3 d-none animate-fade-in">
                                            <div class="ratio ratio-16x9 rounded-4 overflow-hidden border shadow-sm bg-light">
                                                <img id="evidence-preview-img" class="object-fit-cover w-100 h-100" alt="Vista previa">
                                            </div>
                                            <button type="button" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2 shadow" onclick="Quejas.clearEvidence()" style="width: 32px; height: 32px; z-index: 10;">
                                                <i class="bi bi-x-lg"></i>
                                            </button>
                                            <div class="text-center mt-1">
                                                <small class="text-success fw-bold extra-small"><i class="bi bi-check-circle-fill me-1"></i>Imagen lista</small>
                                            </div>
                                        </div>

                                        <!-- Camera -->
                                        <div id="camera-container" class="d-none mt-3 bg-black rounded-4 overflow-hidden position-relative shadow-lg border border-dark" style="aspect-ratio: 9/16; max-height: 500px;">
                                            <video id="camera-preview" class="w-100 h-100 object-fit-cover" autoplay playsinline></video>
                                            <div class="position-absolute bottom-0 w-100 p-4 bg-gradient-to-t-black text-center">
                                                <div class="d-flex justify-content-center align-items-center gap-4">
                                                    <button type="button" class="btn btn-outline-light rounded-circle p-2 border-0 bg-black bg-opacity-25 backdrop-blur" onclick="Quejas.stopCamera()">
                                                        <i class="bi bi-x-lg fs-4"></i>
                                                    </button>
                                                    <button type="button" class="btn btn-light rounded-circle p-1 border-4 border-white bg-transparent shadow" onclick="Quejas.takePhoto()" style="width: 72px; height: 72px;">
                                                        <div class="bg-white rounded-circle w-100 h-100"></div>
                                                    </button>
                                                    <div style="width: 44px;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mb-4">
                                        <div class="form-check form-switch p-3 bg-light rounded-3">
                                            <input class="form-check-input ms-0 me-2" type="checkbox" id="q-anon" style="float: none;">
                                            <label class="form-check-label small fw-bold text-muted" for="q-anon">
                                                Enviar como Anónimo <i class="bi bi-info-circle-fill ms-1" title="Tu reporte será tratado con discreción."></i>
                                            </label>
                                        </div>
                                    </div>

                                    <div class="d-grid">
                                        <button type="submit" class="btn btn-primary rounded-pill fw-bold py-3 shadow-sm" id="btn-queja-submit">
                                            Revisar y Enviar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
    
                    <!-- LISTA -->
                    <div class="col-lg-7">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-muted mb-0">Mis Tickets Recientes</h6>
                            <button class="btn btn-sm btn-light rounded-pill" onclick="Quejas.initStudentView()"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                        <div id="student-tickets-list" class="d-flex flex-column gap-3">
                            <div class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando...</div>
                        </div>
                    </div>
                </div>

                <!-- CONFIRMATION MODAL -->
                <div class="modal fade" id="modalConfirmSubmit" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered modal-sm">
                        <div class="modal-content rounded-4 border-0 shadow">
                            <div class="modal-body p-4 text-center">
                                <i class="bi bi-exclamation-circle text-primary fs-1 mb-3 d-block"></i>
                                <h5 class="fw-bold mb-2">¿Estás seguro?</h5>
                                <p class="small text-muted mb-4">Una vez enviado, el ticket <strong>no podrá ser editado ni eliminado</strong> para garantizar el seguimiento.</p>
                                <div class="d-grid gap-2">
                                    <button type="button" class="btn btn-primary rounded-pill fw-bold" onclick="Quejas.submitTicket()">Sí, Enviar</button>
                                    <button type="button" class="btn btn-light rounded-pill text-muted" data-bs-dismiss="modal">Cancelar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function askForConfirmation() {
            const desc = document.getElementById('q-desc').value;
            if (desc.trim().length < 10) {
                alert("Por favor detalla un poco más la descripción.");
                return;
            }
            const modal = new bootstrap.Modal(document.getElementById('modalConfirmSubmit'));
            modal.show();
        }

        async function submitTicket() {
            // Hide Modal first
            const modalEl = document.getElementById('modalConfirmSubmit');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            const btn = document.getElementById('btn-queja-submit');
            // Get values from Radios
            const tipo = document.querySelector('input[name="q-tipo"]:checked').value;
            const cat = document.querySelector('input[name="q-cat"]:checked').value;
            const desc = document.getElementById('q-desc').value;

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';


            try {
                // 1. Upload Evidence if exists
                let evidenceUrl = '';
                const fileInput = document.getElementById('q-file');
                let fileToUpload = null;

                if (_capturedBlob) {
                    fileToUpload = _capturedBlob; // Use camera capture
                } else if (fileInput.files.length > 0) {
                    fileToUpload = fileInput.files[0]; // Use file input
                }

                if (fileToUpload) {
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Optimizando...';
                    const compressed = await compressImage(fileToUpload);

                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Subiendo...';
                    evidenceUrl = await QuejasService.uploadEvidence(_ctx, compressed);
                }

                // 2. Submit Ticket
                const isAnon = document.getElementById('q-anon').checked;
                await QuejasService.createTicket(_ctx, {
                    tipo,
                    categoria: cat,
                    descripcion: desc,
                    evidenciaUrl: evidenceUrl, // Fixed typo from 'evidenceUrl' (check previous logs if variable mismatch)
                    isAnonymous: isAnon
                });

                // Reset & Reload
                document.getElementById('form-queja-new').reset();
                clearEvidence(); // Reset helper
                showToast('Solicitud enviada correctamente.', 'success');
                initStudentView(); // Refresh list

            } catch (e) {
                showToast(e.message, 'danger');
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Revisar y Enviar';
            }
        }

        async function initStudentView() {
            const list = document.getElementById('student-tickets-list');
            // Check if list exists (might not if we are in admin view or weird state)
            if (!list) return;

            try {
                const tickets = await QuejasService.getTicketsByUser(_ctx, _ctx.user.uid);
                renderTicketList(tickets, list);
            } catch (e) {
                console.error(e);
                list.innerHTML = `<div class="alert alert-danger border-0 small">Error al cargar tickets.</div>`;
            }
        }

        function renderTicketList(tickets, container) {
            container.innerHTML = '';
            if (tickets.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-5 text-muted bg-light rounded-4 border border-dashed">
                        <i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
                        <p class="small mb-0">No has enviado ninguna solicitud aún.</p>
                    </div>
                `;
                return;
            }

            tickets.forEach(t => {
                const statusColors = {
                    'pendiente': 'bg-warning text-dark',
                    'en-proceso': 'bg-info text-white',
                    'resuelto': 'bg-success text-white',
                    'rechazado': 'bg-danger text-white'
                };
                const badge = statusColors[t.status] || 'bg-secondary text-white';
                const statusLabel = t.status.replace('-', ' ').toUpperCase();

                const card = document.createElement('div');
                card.className = 'card border-0 shadow-sm rounded-4 hover-scale cursor-pointer';
                card.onclick = () => openDetailModal(t);
                card.innerHTML = `
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge ${badge} rounded-pill shadow-sm">${statusLabel}</span>
                            <small class="text-muted fw-bold">${formatDate(t.createdAt)}</small>
                        </div>
                        <h6 class="fw-bold text-dark mb-1 text-truncate">${t.tipo.toUpperCase()}: ${t.categoria}</h6>
                        <p class="small text-muted mb-0 text-truncate">${t.descripcion}</p>
                        ${t.history?.length > 0 ? `<div class="mt-2 extra-small text-primary fw-bold"><i class="bi bi-chat-dots me-1"></i>${t.history.length} respuesta(s)</div>` : ''}
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // ==========================================
        // ADMIN VIEW
        // ==========================================

        function renderAdminStructure() {
            return `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h3 class="fw-bold text-dark mb-0">Gestión de Calidad</h3>
                        <p class="text-muted small mb-0">Administración de Quejas y Sugerencias</p>
                    </div>
                    <button class="btn btn-outline-dark btn-sm rounded-pill" onclick="Quejas.initAdminView()"><i class="bi bi-arrow-clockwise me-2"></i>Actualizar</button>
                </div>
    
                <!-- KPIS -->
                <div class="row g-3 mb-4" id="admin-kpis">
                    <!-- Filled via JS -->
                     <div class="col-12"><span class="spinner-border spinner-border-sm"></span> Cargando estadísticas...</div>
                </div>
    
                <!-- TICKET TABLE -->
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h6 class="fw-bold mb-0">Buzón de Entrada</h6>
                        <div class="d-flex gap-2">
                             <button class="btn btn-sm btn-outline-success rounded-pill fw-bold" onclick="Quejas.downloadCSV()">
                                <i class="bi bi-file-earmark-spreadsheet me-1"></i> Exportar
                             </button>
                             <select class="form-select form-select-sm rounded-pill bg-light border-0 fw-bold" id="admin-filter-status" onchange="Quejas.initAdminView()">
                                <option value="all">Todos los estados</option>
                                <option value="pendiente">Pendientes</option>
                                <option value="en-proceso">En Proceso</option>
                                <option value="resuelto">Resueltos</option>
                            </select>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table align-middle table-hover mb-0">
                            <thead class="bg-light small text-muted text-uppercase">
                                <tr>
                                    <th class="ps-4">Folio/Fecha</th>
                                    <th>Usuario</th>
                                    <th>Tipo/Cat</th>
                                    <th>Estado</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody id="admin-ticket-table">
                                <tr><td colspan="5" class="text-center py-4">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        async function initAdminView() {
            const filter = document.getElementById('admin-filter-status')?.value || 'all';

            // 1. Load Stats
            QuejasService.getStats(_ctx).then(renderAdminStats);

            // 2. Load Tickets
            const tbody = document.getElementById('admin-ticket-table');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span></td></tr>';

            try {
                const tickets = await QuejasService.getAllTickets(_ctx, { status: filter });
                renderAdminTable(tickets, tbody);
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error cargando datos.</td></tr>';
            }
        }

        function renderAdminStats(stats) {
            const container = document.getElementById('admin-kpis');
            if (!container) return;

            container.innerHTML = `
                <div class="col-6 col-md-3">
                    <div class="card border-0 bg-warning bg-opacity-10 h-100 rounded-4">
                        <div class="card-body text-center p-3">
                            <h2 class="fw-bold text-warning mb-0 display-4">${stats.pendiente}</h2>
                            <span class="small fw-bold text-muted text-uppercase">Pendientes</span>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-0 bg-info bg-opacity-10 h-100 rounded-4">
                        <div class="card-body text-center p-3">
                            <h2 class="fw-bold text-info mb-0 display-4">${stats.en_proceso}</h2>
                            <span class="small fw-bold text-muted text-uppercase">En Proceso</span>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-0 bg-success bg-opacity-10 h-100 rounded-4">
                        <div class="card-body text-center p-3">
                            <h2 class="fw-bold text-success mb-0 display-4">${stats.resuelto}</h2>
                            <span class="small fw-bold text-muted text-uppercase">Resueltos</span>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-0 bg-light h-100 rounded-4">
                        <div class="card-body text-center p-3">
                            <h2 class="fw-bold text-dark mb-0 display-4">${stats.total}</h2>
                            <span class="small fw-bold text-muted text-uppercase">Total Histórico</span>
                        </div>
                    </div>
                </div>
            `;
        }

        function renderAdminTable(tickets, tbody) {
            tbody.innerHTML = '';
            if (tickets.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron tickets.</td></tr>';
                return;
            }

            tickets.forEach(t => {
                const tr = document.createElement('tr');
                tr.onclick = () => openDetailModal(t);
                tr.style.cursor = 'pointer';

                const badgeClass = {
                    'pendiente': 'bg-warning text-dark',
                    'en-proceso': 'bg-info text-white',
                    'resuelto': 'bg-success text-white',
                    'rechazado': 'bg-danger text-white'
                }[t.status] || 'bg-light text-dark';

                // Find latest internal note
                const lastInternal = (t.history || []).filter(h => h.type === 'internal').pop();

                tr.innerHTML = `
                    <td class="ps-4">
                        <div class="fw-bold text-dark">#${t.id.slice(0, 6)}</div>
                        <div class="extra-small text-muted">${formatDate(t.createdAt)}</div>
                    </td>
                    <td>
                        <div class="small fw-bold text-dark">
                            ${t.userName} 
                            ${t.isAnonymous ? '<span class="badge bg-dark ms-1"><i class="bi bi-incognito"></i></span>' : ''}
                        </div>
                        <div class="extra-small text-muted">${t.matricula || 'N/A'}</div>
                    </td>
                    <td>
                        <div class="badge bg-light text-dark mb-1 border">${t.tipo}</div>
                        <div class="small text-muted">${t.categoria}</div>
                        ${lastInternal ? `
                            <div class="mt-1 p-1 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-2 d-inline-block" style="max-width: 200px;">
                                <div class="d-flex align-items-center text-warning-emphasis extra-small fw-bold">
                                    <i class="bi bi-lock-fill me-1"></i> Nota Interna
                                </div>
                                <div class="text-truncate extra-small text-dark opacity-75">${lastInternal.message}</div>
                            </div>
                        ` : ''}
                    </td>
                    <td><span class="badge ${badgeClass} rounded-pill">${t.status}</span></td>
                    <td><button class="btn btn-sm btn-light rounded-circle shadow-sm"><i class="bi bi-chevron-right"></i></button></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // ==========================================
        // DETAIL MODAL (SHARED)
        // ==========================================
        let _activeTicket = null;

        function openDetailModal(ticket) {
            _activeTicket = ticket;
            const modalEl = document.getElementById('modalQuejaDetail');
            const modalBody = document.getElementById('modal-queja-body');

            // Re-use instance if exists, otherwise create
            let bsModal = bootstrap.Modal.getInstance(modalEl);
            if (!bsModal) bsModal = new bootstrap.Modal(modalEl);

            const badgeClass = {
                'pendiente': 'bg-warning text-dark',
                'en-proceso': 'bg-info text-white',
                'resuelto': 'bg-success text-white',
                'rechazado': 'bg-danger text-white'
            }[ticket.status];

            // Render History
            const historyHtml = (ticket.history || []).map(h => {
                // INTERNAL NOTE LOGIC
                if (h.type === 'internal') {
                    if (!_isAdmin) return ''; // Hide from student
                    return `
                        <div class="d-flex mb-3 justify-content-center">
                            <div class="card border-0 shadow-sm rounded-4 bg-warning bg-opacity-10 border-warning border-opacity-25" style="width: 85%;">
                                <div class="card-body p-2">
                                    <div class="d-flex align-items-center mb-1 text-warning-emphasis">
                                        <i class="bi bi-lock-fill me-2"></i>
                                        <strong class="extra-small">Nota Interna (${h.author})</strong>
                                        <span class="extra-small ms-auto opacity-75">${formatDate(h.date)}</span>
                                    </div>
                                    <p class="small mb-0 text-dark opacity-75 fst-italic">${h.message}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }

                // NORMAL MESSAGE
                // Logic: "Me" goes to the Right. "Them" goes to the Left.
                // If I am Admin: Admin msgs => Right, User msgs => Left
                // If I am Student: User msgs => Right, Admin msgs => Left
                const isMe = (_isAdmin && h.role === 'admin') || (!_isAdmin && h.role !== 'admin');

                const alignment = isMe ? 'justify-content-end' : 'justify-content-start';
                // Styles: "Me" gets a distinct color (e.g., Primary/Light Blue), "Them" gets Gray/White
                const cardBg = isMe ? 'bg-primary bg-opacity-10 border-primary border-opacity-10' : 'bg-light';
                const textColor = 'text-dark';

                return `
                <div class="d-flex mb-3 ${alignment}">
                    <div class="card border-0 shadow-sm rounded-4 ${cardBg}" style="max-width: 85%;">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <strong class="extra-small ${isMe ? 'text-primary' : 'text-muted'}">${h.author}</strong>
                                <span class="extra-small text-muted ms-3">${formatDate(h.date)}</span>
                            </div>
                            <p class="small mb-0 ${textColor}">${h.message}</p>
                        </div>
                    </div>
                </div>
            `;
            }).join('');

            // Admin Controls
            let adminControls = '';
            let cannedResponsesHtml = '';

            if (_isAdmin) {
                // Populate Canned Responses based on type
                const opts = (CANNED_RESPONSES[ticket.tipo] || CANNED_RESPONSES['general']).concat(CANNED_RESPONSES['general']);
                const uniqueOpts = [...new Set(opts)]; // dedup

                cannedResponsesHtml = `
                    <div class="mb-2">
                        <select class="form-select form-select-sm bg-light border-0 text-muted" onchange="document.getElementById('detail-reply-input').value = this.value; this.value='';">
                            <option value="">⚡ Respuestas Rápidas...</option>
                            ${uniqueOpts.map(r => `<option value="${r}">${r.substring(0, 50)}...</option>`).join('')}
                        </select>
                    </div>
                `;

                adminControls = `
                <hr class="my-4">
                <h6 class="fw-bold small mb-3">Administrar Ticket</h6>
                <div class="row g-2 mb-3">
                    <div class="col-auto">
                        <select class="form-select form-select-sm" id="detail-new-status">
                            <option value="pendiente" ${ticket.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="en-proceso" ${ticket.status === 'en-proceso' ? 'selected' : ''}>En Proceso</option>
                            <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                            <option value="rechazado" ${ticket.status === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                        </select>
                    </div>
                    <div class="col">
                         <button class="btn btn-sm btn-dark w-100" onclick="Quejas.updateTicketStatus()">Actualizar Estado</button>
                    </div>
                </div>
                `;
            }

            // Render
            modalBody.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h5 class="fw-bold mb-0">Ticket #${ticket.id.slice(0, 6)}</h5>
                    <span class="badge ${badgeClass} rounded-pill px-3">${ticket.status.toUpperCase()}</span>
                </div>
                
                <div class="bg-light p-3 rounded-4 mb-4">
                    <div class="d-flex justify-content-between mb-2">
                        <div class="row g-2 w-100">
                            <div class="col-6"><small class="text-muted fw-bold d-block">Categoría</small><span class="text-dark small">${ticket.categoria}</span></div>
                            <div class="col-6"><small class="text-muted fw-bold d-block">Tipo</small><span class="text-dark small">${ticket.tipo}</span></div>
                        </div>
                    </div>
                    
                    ${ticket.isAnonymous ? `<div class="badge bg-dark bg-opacity-75 mb-2"><i class="bi bi-incognito me-1"></i>Reporte Anónimo</div>` : ''}

                    <small class="text-muted fw-bold d-block">Descripción Original</small>
                    <p class="text-dark small mb-0 mt-1 text-break">${ticket.descripcion}</p>

                    ${ticket.evidenciaUrl ? `
                        <div class="mt-3">
                            <small class="text-muted fw-bold d-block mb-1">Evidencia Adjunta</small>
                            <a href="${ticket.evidenciaUrl}" target="_blank">
                                <img src="${ticket.evidenciaUrl}" class="img-fluid rounded-3 border shadow-sm" style="max-height: 200px; object-fit: cover;">
                            </a>
                        </div>
                    ` : ''}
                </div>
    
                <h6 class="fw-bold small mb-3">Seguimiento y Respuestas</h6>
                <div class="history-container mb-3 px-1" id="history-scroll-area" style="max-height: 300px; overflow-y: auto;">
                    ${historyHtml.length ? historyHtml : '<p class="text-muted extra-small text-center fst-italic py-4">No hay respuestas aún.</p>'}
                </div>
    
                ${adminControls}
    
                <!-- Reply Form (Both) -->
                ${_isAdmin ? cannedResponsesHtml : ''}
                <div class="card bg-light border-0 rounded-4 mt-3">
                    <div class="card-body p-2">
                        <div class="input-group mb-2">
                            <textarea class="form-control border-0 bg-transparent shadow-none small" id="detail-reply-input" rows="2" placeholder="Escribe una respuesta..."></textarea>
                            <button class="btn btn-primary rounded-3 shadow-sm ms-2" style="width: 40px;" onclick="Quejas.sendReply()">
                                <i class="bi bi-send-fill text-white small"></i>
                            </button>
                        </div>
                        ${_isAdmin ? `
                        <div class="form-check form-switch ms-1">
                            <input class="form-check-input" type="checkbox" id="detail-internal-check">
                            <label class="form-check-label extra-small fw-bold text-muted" for="detail-internal-check"><i class="bi bi-lock-fill me-1"></i>Nota Interna (Solo Admin)</label>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            bsModal.show();

            // Scroll to bottom
            setTimeout(() => {
                const area = document.getElementById('history-scroll-area');
                if (area) area.scrollTop = area.scrollHeight;
            }, 200);
        }

        async function updateTicketStatus() {
            const newStatus = document.getElementById('detail-new-status').value;
            if (newStatus === _activeTicket.status) return;

            try {
                await QuejasService.updateStatus(_ctx, _activeTicket.id, newStatus, `Estado actualizado a ${newStatus.toUpperCase()}`);
                showToast('Estado actualizado', 'success');
                // Refresh
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalQuejaDetail'));
                modal.hide();
                initAdminView();
            } catch (e) {
                showToast("Error actualizando", "danger");
            }
        }

        async function sendReply() {
            const input = document.getElementById('detail-reply-input');
            const msg = input.value.trim();
            if (!msg) return;

            const role = _isAdmin ? 'admin' : 'student';
            const name = _isAdmin ? 'Administración' : (_profile.displayName.split(' ')[0]);

            // Internal Note Check
            const isInternal = _isAdmin && document.getElementById('detail-internal-check')?.checked;
            const type = isInternal ? 'internal' : 'public';

            const newEntry = {
                author: name,
                message: msg,
                role: role,
                type: type,
                date: new Date().toISOString()
            };

            try {
                // 1. Send to Backend
                await QuejasService.addResponse(_ctx, _activeTicket.id, msg, name, role, type);
                input.value = '';

                // 2. Optimistic Update (Append to view immediately)
                _activeTicket.history = _activeTicket.history || [];
                _activeTicket.history.push(newEntry);

                const area = document.getElementById('history-scroll-area');
                if (area) {
                    // Remove "No responses" message if it exists
                    if (area.querySelector('.text-center.fst-italic')) {
                        area.innerHTML = '';
                    }

                    // Render buble (Internal or Public)
                    const div = document.createElement('div');

                    if (isInternal) {
                        div.className = `d-flex mb-3 justify-content-center animate-fade-in`;
                        div.innerHTML = `
                            <div class="card border-0 shadow-sm rounded-4 bg-warning bg-opacity-10 border-warning border-opacity-25" style="width: 85%;">
                                <div class="card-body p-2">
                                    <div class="d-flex align-items-center mb-1 text-warning-emphasis">
                                        <i class="bi bi-lock-fill me-2"></i>
                                        <strong class="extra-small">Nota Interna (${newEntry.author})</strong>
                                        <span class="extra-small ms-auto opacity-75">Ahora</span>
                                    </div>
                                    <p class="small mb-0 text-dark opacity-75 fst-italic">${newEntry.message}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        // Public message
                        div.className = `d-flex mb-3 justify-content-end animate-fade-in`;
                        div.innerHTML = `
                            <div class="card border-0 shadow-sm rounded-4 bg-primary bg-opacity-10 border-primary border-opacity-10" style="max-width: 85%;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <strong class="extra-small text-primary">${newEntry.author}</strong>
                                        <span class="extra-small text-muted ms-3">Ahora</span>
                                    </div>
                                    <p class="small mb-0 text-dark">${newEntry.message}</p>
                                </div>
                            </div>
                        `;
                    }


                    area.appendChild(div);
                    area.scrollTop = area.scrollHeight;
                }

                showToast('Respuesta enviada', 'success');

                // 3. Background Refresh of List (to keep counts updated)
                if (_isAdmin) QuejasService.getAllTickets(_ctx);

            } catch (e) {
                showToast("Error enviando respuesta", "danger");
            }
        }

        async function downloadCSV() {
            try {
                const tickets = await QuejasService.getAllTickets(_ctx); // Get all, ignore filters for export? Or use current filter? Let's export ALL for report.

                if (!tickets.length) {
                    showToast('No hay datos para exportar', 'warning');
                    return;
                }

                let csvContent = "data:text/csv;charset=utf-8,";
                // Header
                csvContent += "ID,Fecha,Usuario,Matricula,Tipo,Categoria,Estado,Descripcion,Ultimo_Comentario_Interno\n";

                tickets.forEach(t => {
                    const date = formatDate(t.createdAt).replace(',', '');
                    const lastInternal = (t.history || []).filter(h => h.type === 'internal').pop();
                    const internalMsg = lastInternal ? lastInternal.message.replace(/,/g, ' ') : '';

                    const row = [
                        t.id,
                        date,
                        t.isAnonymous ? 'ANONIMO' : (t.userName || '').replace(/,/g, ''),
                        (t.matricula || '').replace(/,/g, ''),
                        t.tipo,
                        t.categoria,
                        t.status,
                        (t.descripcion || '').replace(/,/g, ' ').replace(/\n/g, ' '),
                        internalMsg
                    ].join(",");
                    csvContent += row + "\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `reporte_quejas_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

            } catch (e) {
                console.error(e);
                showToast('Error generando reporte', 'danger');
            }
        }

        return {
            init,
            submitTicket,
            initStudentView,
            initAdminView,
            updateTicketStatus,
            sendReply,
            downloadCSV,
            // Camera & Evidence Helpers
            startCamera,
            stopCamera,
            takePhoto,
            clearEvidence,
            handleFileSelect,
            askForConfirmation
        };
    })();
}

window.Quejas = Quejas;
