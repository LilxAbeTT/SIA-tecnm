// modules/medi.js
// Sistema Profesional de Gestión Médica (v4.0 - Consolidado)

var Medi = (function () {
  // --- CONSTANTES & CONFIG ---
  // --- CONSTANTES & CONFIG ---
  // Config se carga dinámicamente de Firestore via MediService
  let SLOT_START = 8, SLOT_END = 22, SLOT_STEP = 30;





  let _ctx = null;
  let _myRole = null;
  let _myUid = null;
  let _isSaving = false; // Prevent double clicks
  let _unsubs = {};  // Named listeners: { wall, agenda, studentHistory, ... }
  function _cleanupListeners() {
    Object.values(_unsubs).forEach(fn => { if (typeof fn === 'function') fn(); });
    _unsubs = {};
  }
  let _lastCount = 0;
  let _lastConsultaData = null;
  let _currentShift = null; // Mantiene el turno 'legacy' para filtrado
  let _currentProfile = null; // [NEW] Objeto del perfil autenticado
  let _profesionalCedula = null;
  const C_CITAS = 'citas-medi';

  // --- B3: Inline Consultation State ---
  let _consultaTimer = null;       // setInterval for chronometer
  let _consultaStartTime = null;   // Date when consultation started
  let _consultaActive = false;     // Whether a consultation is in progress



  // --- HELPERS UI ---
  const pad = MediService.pad;
  const toISO = MediService.toISO;
  const slotIdFromDate = MediService.slotIdFromDate;
  const safeDate = MediService.safeDate;
  const isWeekday = (d) => { const day = d.getDay(); return day !== 0 && day !== 6; };

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- 3-ZONE LAYOUT TAB HELPERS ---
  let _waitingRoomFilter = 'all'; // Moved here for scope visibility

  function _switchWorkTab(tab) {
    const agendaPanel = document.getElementById('medi-work-agenda');
    const consultaPanel = document.getElementById('medi-work-consulta');
    if (!agendaPanel || !consultaPanel) return;

    // Update tab buttons
    document.querySelectorAll('#medi-workarea-tabs .nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    agendaPanel.classList.toggle('d-none', tab !== 'agenda');
    consultaPanel.classList.toggle('d-none', tab !== 'consulta');
  }

  function _switchContextTab(ctx) {
    const panels = ['metrics', 'patient', 'messages', 'recent'];
    panels.forEach(p => {
      const el = document.getElementById(`medi-ctx-${p}`);
      if (el) el.classList.toggle('d-none', p !== ctx);
    });

    // Update tab buttons
    document.querySelectorAll('#medi-context-tabs .nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ctx === ctx);
    });
  }

  // Show patient info in Zona C
  function _showPatientInContext(student) {
    _switchContextTab('patient');
    const container = document.getElementById('medi-patient-context');
    if (!container) return;

    const age = MediService.calculateAge(student.fechaNacimiento);
    container.innerHTML = `
      <div class="text-center mb-3">
        <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style="width:56px;height:56px;">
          <span class="fw-bold text-primary fs-5">${escapeHtml((student.displayName || 'E')[0])}</span>
        </div>
        <h6 class="fw-bold mb-0">${escapeHtml(student.displayName || student.email)}</h6>
        <span class="badge text-muted border small">${escapeHtml(student.matricula || student.email)}</span>
      </div>
      <div class="row g-2 mb-3">
        ${age != null ? `<div class="col-4 text-center"><div class="bg-light rounded-3 p-2"><div class="extra-small text-muted">Edad</div><div class="fw-bold small">${age}</div></div></div>` : ''}
        ${student.tipoSangre ? `<div class="col-4 text-center"><div class="bg-light rounded-3 p-2"><div class="extra-small text-muted">Sangre</div><div class="fw-bold small text-danger">${escapeHtml(student.tipoSangre)}</div></div></div>` : ''}
        ${student.genero ? `<div class="col-4 text-center"><div class="bg-light rounded-3 p-2"><div class="extra-small text-muted">Género</div><div class="fw-bold small">${escapeHtml(student.genero)}</div></div></div>` : ''}
      </div>
      ${student.alergias ? `<div class="alert alert-danger border-0 py-2 px-3 small mb-3"><i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Alergias:</strong> ${escapeHtml(student.alergias)}</div>` : ''}
      <div class="d-grid gap-2">
        <button class="btn btn-sm btn-primary rounded-pill fw-bold" onclick="Medi.startWalkIn('${encodeURIComponent(JSON.stringify(student))}')">
            <i class="bi bi-lightning-charge-fill me-1"></i>Atender Ahora
        </button>
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-dark flex-fill rounded-pill fw-bold" onclick="Medi.showFullRecord('${student.id || student.uid}')">
              <i class="bi bi-folder2-open me-1"></i>Expediente
            </button>
            <button class="btn btn-sm btn-outline-primary flex-fill rounded-pill" onclick="Medi.openManualBooking('book','${encodeURIComponent(JSON.stringify(student))}')" title="Reservar Cita">
              <i class="bi bi-calendar-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary flex-fill rounded-pill" onclick="Medi.startChatWithStudent('${student.id || student.uid}', '${escapeHtml(student.displayName || student.email)}')">
              <i class="bi bi-chat-dots"></i>
            </button>
        </div>
      </div>
      <hr class="my-3">
      <h6 class="fw-bold small text-muted mb-2">Historial Rápido</h6>
      <div id="medi-patient-quick-history" class="small">
        <div class="text-center text-muted extra-small py-2"><span class="spinner-border spinner-border-sm"></span></div>
      </div>
    `;

    // Load quick history
    _loadPatientQuickHistory(student.id || student.uid);
  }

  async function _loadPatientQuickHistory(uid) {
    const container = document.getElementById('medi-patient-quick-history');
    if (!container) return;
    try {
      const profId = _currentProfile ? _currentProfile.id : null;
      const history = await MediService.getExpedienteHistory(_ctx, uid, _myRole, _myUid, _currentShift, profId);
      if (history.length === 0) {
        container.innerHTML = '<div class="text-muted extra-small text-center py-2">Sin consultas previas</div>';
        return;
      }
      container.innerHTML = history.slice(0, 5).map(h => {
        const d = h.safeDate || new Date();
        return `<div class="d-flex justify-content-between align-items-center py-1 border-bottom">
          <div>
            <div class="fw-bold extra-small">${escapeHtml(h.diagnostico || h.motivo || 'General')}</div>
            <div class="text-muted" style="font-size:.65rem;">${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
          <span class="badge bg-light text-muted border" style="font-size:.6rem;">${escapeHtml(h.tipoServicio || '')}</span>
        </div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = '<div class="text-danger extra-small">Error cargando historial</div>';
    }
  }

  // Select patient from waiting room → show in Zona C
  function _selectWaitingPatient(cardEl, encodedStudent) {
    // Highlight selected card
    document.querySelectorAll('.medi-wait-card.selected').forEach(el => el.classList.remove('selected'));
    cardEl.classList.add('selected');

    try {
      const student = JSON.parse(decodeURIComponent(encodedStudent));
      // Fetch full profile from Firestore for complete data
      _ctx.db.collection('usuarios').doc(student.uid).get().then(snap => {
        if (snap.exists) {
          _showPatientInContext({ id: snap.id, ...snap.data() });
        } else {
          _showPatientInContext(student);
        }
      }).catch(() => _showPatientInContext(student));
    } catch (e) {
      console.error('[Medi] Error parsing patient data:', e);
    }
  }

  function buildSlotsForDate(d) {
    const out = [];
    for (let h = SLOT_START; h <= SLOT_END; h++) {
      for (let m = 0; m < 60; m += SLOT_STEP) {
        if (h === SLOT_END && m > 0) continue;
        out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0));
      }
    }
    return out;
  }



  // ==========================================================
  //                 STRUCTURE RENDERER (FIX)
  // ==========================================================
  function renderStructure(container) {
    // Avoid re-rendering if complete structure exists
    if (document.getElementById('medi-student') && document.getElementById('modalPinLogin')) return;

    // Explicit cleanup to avoid duplicates if partial state
    container.innerHTML = '';

    container.innerHTML = `
    <style>
      #medi-citas-tabs .nav-link {
        color: #6c757d;
        border-bottom: 3px solid transparent;
        border-radius: 0;
        transition: all 0.2s ease;
      }
      #medi-citas-tabs .nav-link:hover {
        color: #0d6efd;
        background: rgba(13, 202, 240, 0.05);
      }
      #medi-citas-tabs .nav-link.active {
        color: #0d6efd !important;
        border-bottom-color: #0d6efd;
        background: transparent !important;
      }
    </style>
    <section id="medi-student" class="d-none">
      <div class="row g-4">
        <!-- MAIN COLUMN (Left/Top on Mobile) -->
        <div class="col-lg-8">
          
          <!-- 1. HEADER BANNER -->
          <div class="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden text-white"
            style="background: linear-gradient(135deg, #0dcaf0 0%, #0d6efd 100%);">
            <div class="card-body p-4 position-relative">
              <div class="d-flex justify-content-between align-items-center position-relative z-1">
                <div>
                  <h2 class="fw-bold mb-1">Servicio Médico</h2>
                  <p class="mb-0 opacity-75">Tu salud es lo más importante.</p>
                </div>
                <i class="bi bi-heart-pulse-fill display-1 opacity-25 position-absolute end-0 top-50 translate-middle-y me-3"></i>
              </div>
            </div>
          </div>

          <!-- 2. EMERGENCY DATA (Moved here, Compacted) -->
          <div class="card border-0 shadow-sm rounded-4 mb-3 shadow-lg" 
               style="background-color: #dc3545 !important; color: #ffffff !important;">
             <div class="card-header border-0 bg-transparent py-2 d-flex justify-content-between align-items-center">
                <h6 class="fw-bold mb-0" style="color: #ffffff !important; font-size: 0.9rem;">
                    <i class="bi bi-file-medical-fill me-2"></i>Datos de Emergencia
                </h6>
                <button type="button" class="btn btn-xs btn-outline-light rounded-pill border-white border-opacity-50" 
                        style="font-size: 0.7rem; padding: 0.1rem 0.5rem; color: #ffffff !important;"
                        data-bs-toggle="modal" data-bs-target="#modalMediEditCard">
                   Editar
                </button>
             </div>
             <div class="card-body pt-0 pb-3">
                <div class="row g-2 align-items-center medi-emergency-row">
                   <div class="col-auto border-end border-white border-opacity-25 pe-3">
                      <div class="fw-bold" style="font-size:0.6rem; letter-spacing: 0.5px; opacity: 0.8 !important;">TIPO SANGRE</div>
                      <div class="fw-bolder fs-5" id="view-sangre" style="color: #ffffff !important;">--</div>
                   </div>
                   <div class="col-auto border-end border-white border-opacity-25 pe-3">
                      <div class="fw-bold" style="font-size:0.6rem; letter-spacing: 0.5px; opacity: 0.8 !important;">ALERGIAS</div>
                      <div class="fw-bold text-truncate small" id="view-alergias" style="color: #ffffff !important; max-width: 150px;">Ninguna</div>
                   </div>
                   <div class="col ps-2">
                       <div class="fw-bold" style="font-size:0.6rem; letter-spacing: 0.5px; opacity: 0.8 !important;">CONTACTO</div>
                       <div class="d-flex flex-column" style="line-height:1.1;">
                          <span class="fw-bold text-truncate small" id="view-contacto-nombre" style="color: #ffffff !important;">--</span>
                          <span class="font-monospace extra-small" id="view-contacto-tel" style="color: rgba(255,255,255,0.9) !important;">--</span>
                       </div>
                   </div>
                </div>
             </div>
          </div>

          <!-- 2.5 NEXT APPOINTMENT BANNER (Dynamic) -->
          <div id="medi-next-appointment" class="d-none mb-3"></div>
          <!-- E3: Follow-up Banner -->
          <div id="medi-followup-banner" class="d-none mb-3"></div>

          <!-- 3. BOOKING FORM -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white py-3">
              <h6 class="fw-bold mb-0 text-primary"><i class="bi bi-calendar-plus me-2"></i>Agendar Nueva Cita</h6>
            </div>
            <div class="card-body p-4">
              <!-- Success State (hidden by default) -->
              <div id="medi-booking-success" class="d-none text-center py-4 medi-booking-success">
                <div class="bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style="width: 72px; height: 72px;">
                  <i class="bi bi-check-circle-fill text-success" style="font-size: 2.5rem;"></i>
                </div>
                <h5 class="fw-bold text-dark mb-2">Cita Registrada</h5>
                <div id="medi-success-details" class="mb-3"></div>
              </div>
              <form id="form-medi-nueva-cita">
                <div class="row g-3">
                  <div class="col-md-12">
                    <label class="form-label small fw-bold text-muted mb-2">¿Con quién deseas atenderte?</label>
                    <div class="d-flex flex-column flex-sm-row gap-3 medi-service-btns">
                        <!-- Botón Médico -->
                        <button type="button" class="btn btn-outline-light flex-fill p-3 border rounded-4 text-start position-relative overflow-hidden service-btn shadow-sm"
                            style="border-color: rgba(255,255,255,0.1);"
                            onclick="
                                document.getElementById('medi-cita-categoria').value='Medicina General'; 
                                document.getElementById('medi-cita-tipo').value='Medico'; 
                                window._selectedServiceDuration = 'Medico'; // Hint for slot generation 
                                
                                // Reset styles
                                document.querySelectorAll('.service-btn').forEach(b => {
                                    b.classList.remove('active', 'border-info', 'border-primary', 'bg-info-subtle', 'bg-primary-subtle');
                                    b.classList.add('btn-outline-light');
                                    b.style.borderColor = 'rgba(255,255,255,0.1)';
                                });

                                // Apply active style
                                this.classList.remove('btn-outline-light');
                                this.classList.add('active', 'bg-info-subtle', 'border-info');
                                this.style.borderColor = ''; // Let bootstarp handle it

                                document.getElementById('medi-date-container').classList.remove('d-none');
                                document.getElementById('summary-service').textContent = 'Médico General';
                                document.getElementById('summary-service-icon').className = 'bi bi-bandaid-fill text-info';
                            ">
                            <div class="d-flex align-items-center">
                                <div class="bg-white rounded-circle p-2 shadow-sm me-3 text-info">
                                    <i class="bi bi-bandaid-fill fs-4"></i>
                                </div>
                                <div>
                                    <h6 class="fw-bold text-body mb-0">Médico General</h6>
                                    <span class="extra-small text-muted">Malestar, chequeo, salud física</span>
                                </div>
                            </div>
                        </button>
                        
                        <!-- Botón Psicólogo -->
                        <button type="button" class="btn btn-outline-light flex-fill p-3 border rounded-4 text-start position-relative overflow-hidden service-btn shadow-sm"
                            style="border-color: rgba(255,255,255,0.1);"
                            onclick="
                                document.getElementById('medi-cita-categoria').value='Salud Mental'; 
                                document.getElementById('medi-cita-tipo').value='Psicologo';
                                window._selectedServiceDuration = 'Psicologo'; // Hint for slot generation

                                // Reset styles
                                document.querySelectorAll('.service-btn').forEach(b => {
                                    b.classList.remove('active', 'border-info', 'border-primary', 'bg-info-subtle', 'bg-primary-subtle');
                                    b.classList.add('btn-outline-light');
                                    b.style.borderColor = 'rgba(255,255,255,0.1)';
                                });

                                // Apply active style
                                this.classList.remove('btn-outline-light');
                                this.classList.add('active', 'bg-primary-subtle', 'border-primary');
                                this.style.borderColor = ''; 

                                document.getElementById('medi-date-container').classList.remove('d-none');
                                document.getElementById('summary-service').textContent = 'Psicología';
                                document.getElementById('summary-service-icon').className = 'bi bi-chat-heart-fill text-primary';
                            ">
                            <div class="d-flex align-items-center">
                                <div class="bg-white rounded-circle p-2 shadow-sm me-3 text-primary">
                                    <i class="bi bi-chat-heart-fill fs-4"></i>
                                </div>
                                <div>
                                    <h6 class="fw-bold text-body mb-0">Psicología</h6>
                                    <span class="extra-small text-muted">Apoyo emocional, estrés</span>
                                </div>
                            </div>
                        </button>
                    </div>
                    <input type="hidden" id="medi-cita-categoria" required>
                    <input type="hidden" id="medi-cita-tipo" value="Medico">
                  </div>

                  <div class="col-12 mt-4 d-none" id="medi-date-container">
                    <label class="form-label small fw-bold text-muted mb-3">Selecciona el día de tu cita</label>
                    <div id="medi-date-selector" class="d-flex gap-2 overflow-auto pb-3 medi-date-scroll" style="scrollbar-width: none; -ms-overflow-style: none;">
                    </div>
                    <input type="hidden" id="medi-cita-fecha" required>
                  
                    <div class="mt-2">
                       <label class="form-label small fw-bold text-muted">Horarios Disponibles</label>
                       <div id="medi-time-msg" class="p-4 bg-light rounded-4 text-center text-muted small border border-dashed">
                          <i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero
                       </div>
                       <input type="hidden" id="medi-cita-hora" required>
                       <div id="medi-time-grid" class="d-none gap-2 flex-wrap mt-2"></div>
                    </div>
                  </div>

                  <div class="col-12 mt-3">
                    <label class="form-label small fw-bold text-muted">Motivo / Síntomas (Opcional)</label>
                    <textarea class="form-control border-0 bg-light rounded-3" id="medi-cita-motivo" rows="2" placeholder="Describe brevemente cómo te sientes..."></textarea>
                  </div>
                </div>
                
                <!-- CONFIRMATION DETAILS BLOCK -->
                <div id="medi-booking-summary" class="mt-4 p-3 rounded-4 bg-light d-none slide-up-anim">
                     <h6 class="fw-bold small text-muted mb-3">RESUMEN DE RESERVA</h6>
                     <div class="d-flex align-items-center mb-2">
                        <i id="summary-service-icon" class="bi bi-bandaid-fill text-muted me-2"></i>
                        <span id="summary-service" class="fw-bold text-dark small">--</span>
                     </div>
                     <div class="d-flex align-items-center">
                        <i class="bi bi-clock-history text-muted me-2"></i>
                        <span id="summary-datetime" class="fw-bold text-dark small">--</span>
                     </div>
                </div>

                <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                   <div id="medi-cita-disponibilidad" class="small fw-bold text-primary"></div>
                   <button type="submit" class="btn btn-primary rounded-pill px-5 fw-bold shadow-sm" id="btn-medi-confirm" disabled>
                     <i class="bi bi-check-lg me-2"></i>Confirmar
                   </button>
                </div>
              </form>
            </div>
          </div>

          <!-- 4. APPOINTMENTS (Moved here) -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white py-3 border-0">
              <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="fw-bold mb-0"><i class="bi bi-calendar-week me-2"></i>Mi Agenda</h6>
              </div>
              <ul class="nav nav-pills d-flex gap-3 flex-nowrap overflow-auto pb-0" id="medi-citas-tabs" role="tablist" style="scrollbar-width: none;">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active rounded-pill fw-bold small px-3 py-1 text-nowrap" id="tab-pendientes" data-bs-toggle="tab" data-bs-target="#pills-pendientes" type="button" role="tab">
                    Pendientes
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link rounded-pill fw-bold small px-3 py-1 text-nowrap" id="tab-confirmadas" data-bs-toggle="tab" data-bs-target="#pills-confirmadas" type="button" role="tab">
                    Confirmadas
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link rounded-pill fw-bold small px-3 py-1 text-nowrap" id="tab-canceladas" data-bs-toggle="tab" data-bs-target="#pills-canceladas" type="button" role="tab">
                    Canceladas
                  </button>
                </li>
              </ul>
            </div>
            <div class="card-body p-3 bg-light-subtle">
              <div class="tab-content" id="medi-citas-content">
                <!-- Pendientes -->
                <div class="tab-pane fade show active" id="pills-pendientes" role="tabpanel">
                    <div id="carousel-pendientes" class="d-flex overflow-auto gap-3 pb-2 custom-scroll medi-cita-carousel" style="scroll-behavior: smooth;">
                        <div class="text-center w-100 py-4 text-muted small"><i class="bi bi-inbox me-2"></i>No hay citas pendientes.</div>
                    </div>
                </div>
                <!-- Confirmadas -->
                <div class="tab-pane fade" id="pills-confirmadas" role="tabpanel">
                     <div id="carousel-confirmadas" class="d-flex overflow-auto gap-3 pb-2 custom-scroll medi-cita-carousel" style="scroll-behavior: smooth;">
                        <div class="text-center w-100 py-4 text-muted small"><i class="bi bi-journal-check me-2"></i>No hay citas confirmadas.</div>
                     </div>
                </div>
                <!-- Canceladas -->
                <div class="tab-pane fade" id="pills-canceladas" role="tabpanel">
                     <div id="carousel-canceladas" class="d-flex overflow-auto gap-3 pb-2 custom-scroll medi-cita-carousel" style="scroll-behavior: smooth;">
                        <div class="text-center w-100 py-4 text-muted small">Historial limpio.</div>
                     </div>
                </div>
              </div>
            </div>
          </div>
          


           <!-- MODALS -->
          <div class="modal fade" id="modalMediReschedule" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content rounded-4 border-0 shadow-lg">
                    <div class="modal-header border-0 pb-0">
                        <h6 class="modal-title fw-bold"><i class="bi bi-calendar2-week me-2 text-primary"></i>Re-agendar Cita</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <form id="form-medi-reschedule">
                            <input type="hidden" id="resched-cita-id">
                            <input type="hidden" id="resched-old-slot">
                            <input type="hidden" id="resched-tipo">
                            <input type="hidden" id="resched-date">
                            <input type="hidden" id="resched-time">

                            <label class="form-label small fw-bold text-muted mb-2">Selecciona nueva fecha</label>
                            <div id="resched-date-selector" class="d-flex gap-2 overflow-auto pb-3 medi-date-scroll medi-resched-dates" style="scrollbar-width: none;"></div>

                            <div id="resched-time-container" class="mt-2">
                              <label class="form-label small fw-bold text-muted">Horarios Disponibles</label>
                              <div id="resched-time-msg" class="p-3 bg-light rounded-3 text-center text-muted small border border-dashed">
                                <i class="bi bi-calendar-check d-block mb-1"></i> Selecciona un d\u00eda primero
                              </div>
                              <div id="resched-time-grid" class="d-none d-flex flex-wrap gap-2 justify-content-center mt-2 p-2"></div>
                            </div>

                            <div id="resched-summary" class="d-none mt-3 p-3 rounded-4 bg-light">
                              <div class="d-flex align-items-center gap-2">
                                <i class="bi bi-arrow-right-circle text-primary"></i>
                                <span class="fw-bold small text-dark" id="resched-summary-text">--</span>
                              </div>
                            </div>

                            <div class="d-grid mt-3">
                                <button type="submit" class="btn btn-primary rounded-pill fw-bold" id="btn-resched-confirm" disabled>Guardar Cambios</button>
                            </div>
                         </form>
                    </div>
                </div>
            </div>
          </div>

          <div class="modal fade" id="modalMediCancelParams" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content rounded-4 border-0 shadow-lg">
                    <div class="modal-header border-0 pb-0">
                        <h6 class="modal-title fw-bold text-danger">Cancelar Cita</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <p class="small text-muted mb-3">¿Podrías decirnos el motivo? Esto nos ayuda a mejorar.</p>
                         <form id="form-medi-cancel-reason">
                            <input type="hidden" id="cancel-cita-id">
                            <div class="d-grid gap-2 mb-3">
                                <button type="button" class="btn btn-outline-secondary btn-sm text-start" onclick="document.getElementById('cancel-other').value='Conflicto de horario'; this.form.dispatchEvent(new Event('submit'))">📅 Conflicto de horario</button>
                                <button type="button" class="btn btn-outline-secondary btn-sm text-start" onclick="document.getElementById('cancel-other').value='Ya me siento mejor'; this.form.dispatchEvent(new Event('submit'))">😊 Ya me siento mejor</button>
                                <button type="button" class="btn btn-outline-secondary btn-sm text-start" onclick="document.getElementById('cancel-other').value='Emergencia personal'; this.form.dispatchEvent(new Event('submit'))">🚨 Emergencia personal</button>
                            </div>
                            <input type="text" class="form-control form-control-sm mb-3" id="cancel-other" placeholder="Otro motivo..." required>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-danger rounded-pill fw-bold">Cancelar Cita</button>
                            </div>
                         </form>
                    </div>
                </div>
            </div>
          </div>

        </div>

        <!-- 6. SECONDARY COLUMN (Right on Desktop, Bottom on Mobile) -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm rounded-4">
             <div class="card-header bg-white py-3">
               <h6 class="fw-bold mb-0"><i class="bi bi-folder2-open me-2"></i>Expediente Médico</h6>
             </div>
             <div class="card-body p-3 bg-light">
                <div id="medi-stu-consultas" class="scroll-container" style="max-height: 400px;">
                    <div class="text-center py-3 text-muted small">Sin consultas registradas.</div>
                </div>
             </div>
          </div>

          <!-- WELLNESS TIPS -->
          <div class="card border-0 shadow-sm rounded-4 mt-3">
             <div class="card-header bg-white py-3">
               <h6 class="fw-bold mb-0"><i class="bi bi-lightbulb me-2 text-warning"></i>Tips de Salud</h6>
             </div>
             <div class="card-body p-3" id="medi-wellness-tips">
                <div class="text-center py-3 text-muted small">Cargando tips...</div>
             </div>
          </div>
        </div>
      </div>
    </section>

    <section id="medi-admin" class="d-none"> <!-- MARKER -->

       <!-- GLOBAL STATUS BANNER (Dynamic) -->
       <div id="medi-service-status" class="alert alert-danger border-0 rounded-4 shadow-sm mb-3 d-none align-items-center animate-pulse">
           <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
           <div>
               <h6 class="fw-bold mb-0">Tu Agenda está Deshabilitada</h6>
               <p class="mb-0 small opacity-75">Los alumnos no pueden agendar contigo en este momento.</p>
           </div>
           <button class="btn btn-sm btn-light text-danger fw-bold ms-auto rounded-pill" onclick="Medi.showAdminConfigModal()">Configurar</button>
       </div>

       <!-- COMPACT HEADER BAR -->
       <div class="d-flex align-items-center justify-content-between mb-3 px-1">
          <div class="d-flex align-items-center gap-2">
             <div class="bg-primary bg-opacity-10 p-2 rounded-circle text-primary position-relative" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
                <i class="bi bi-person-badge-fill"></i>
                <span class="position-absolute bottom-0 end-0 p-1 bg-success border border-2 border-white rounded-circle" style="width:10px;height:10px;"></span>
             </div>
             <div>
                <h6 class="fw-bold mb-0 text-dark lh-1" id="medi-pro-name">Bienvenido</h6>
                <div class="d-flex align-items-center gap-1 mt-1">
                    <span class="badge bg-primary bg-opacity-10 text-primary border-0 small" id="medi-pro-esp">Cargando...</span>
                    <span class="badge text-muted border small d-none" id="medi-shift-badge"></span>
                </div>
             </div>
          </div>
          <!-- Search + Actions -->
          <div class="d-flex align-items-center gap-2">
              <div class="input-group input-group-sm" style="max-width:280px;">
                  <span class="input-group-text text-dark text-bold bg-transparent border-end-0">Buscar:</span>
                  <input type="text" id="medi-search-paciente" class="form-control border-start-0 bg-transparent"
                         placeholder="Buscar paciente..." onkeydown="if(event.key==='Enter'){event.preventDefault();Medi.buscarPaciente();}">
              </div>
              <button class="btn btn-sm btn-light border rounded-pill px-2" onclick="Medi.refreshAdmin()" title="Actualizar">
                  <i class="bi bi-arrow-clockwise"></i>
              </button>
              <button class="btn btn-sm btn-light border rounded-pill px-2" onclick="Medi.showAdminConfigModal()" title="Configuración">
                  <i class="bi bi-gear-fill"></i>
              </button>
              <button id="btn-shift-selector" class="btn btn-sm btn-dark rounded-pill px-2 d-none" onclick="Medi.setShift(null)" title="Cambiar Turno">
                 <i class="bi bi-arrow-repeat"></i>
              </button>
          </div>
       </div>
       <input type="hidden" id="medi-pro-cedula" value="">

       <!-- 3-ZONE DASHBOARD GRID -->
       <div class="row g-3 medi-admin-grid">

          <!-- ZONA A: SALA DE ESPERA (25%) -->
          <div class="col-lg-3">
             <div class="card border-0 shadow-sm rounded-4 d-flex flex-column medi-admin-col">
                <div class="card-header bg-transparent py-2 border-0 d-flex justify-content-between align-items-center px-3 pt-3">
                   <div class="d-flex align-items-center gap-2">
                       <i class="bi bi-people-fill text-primary"></i>
                       <h6 class="fw-bold mb-0 small">Sala de Espera</h6>
                   </div>
                   <span class="badge bg-danger rounded-pill px-2" id="badge-sala-espera">0</span>
                </div>

                <!-- Filters -->
                <div class="px-3 py-1 border-bottom">
                    <div class="d-flex gap-1">
                        <button class="btn btn-xs btn-dark rounded-pill px-2 active" onclick="Medi.filterWaitingRoom('all')" style="font-size:.7rem;">Todos</button>
                        <button class="btn btn-xs btn-light rounded-pill px-2 text-muted" onclick="Medi.filterWaitingRoom('new')" style="font-size:.7rem;">Nuevos</button>
                        <button class="btn btn-xs btn-light rounded-pill px-2 text-muted" onclick="Medi.filterWaitingRoom('returned')" style="font-size:.7rem;">Devueltos</button>
                    </div>
                </div>

                <div class="card-body p-0 flex-grow-1 overflow-auto custom-scroll">
                   <div id="medi-muro-list" class="list-group list-group-flush p-2">
                       <div class="text-center py-5 opacity-50">
                           <i class="bi bi-cup-hot display-6 d-block mb-2"></i>
                           <p class="extra-small fw-bold">Sala vacía</p>
                       </div>
                   </div>
                </div>
             </div>
          </div>

          <!-- ZONA B: AREA DE TRABAJO (45%) -->
          <div class="col-lg-5">
             <div class="card border-0 shadow-sm rounded-4 d-flex flex-column medi-admin-col">
                <!-- Tabs: Agenda / Consulta activa -->
                <div class="card-header bg-transparent py-2 border-0 px-3 pt-3">
                   <div class="d-flex justify-content-between align-items-center">
                       <ul class="nav nav-pills nav-pills-sm gap-1" id="medi-workarea-tabs">
                           <li class="nav-item">
                               <button class="nav-link active btn-sm py-1 px-3 rounded-pill" data-tab="agenda" onclick="Medi._switchWorkTab('agenda')" style="font-size:.8rem;">
                                   <i class="bi bi-calendar-check me-1"></i>Agenda
                               </button>
                           </li>
                           <li class="nav-item">
                               <button class="nav-link btn-sm py-1 px-3 rounded-pill" data-tab="consulta" onclick="Medi._switchWorkTab('consulta')" style="font-size:.8rem;" id="tab-btn-consulta" disabled>
                                   <i class="bi bi-clipboard2-pulse me-1"></i>Consulta
                               </button>
                           </li>
                       </ul>
                       <button class="btn btn-outline-primary rounded-pill px-3 btn-sm fw-bold shadow-sm me-1" onclick="Medi.nuevaConsultaWalkIn()" style="font-size:.75rem;">
                           <i class="bi bi-lightning-charge-fill me-1"></i>Consulta Rápida
                       </button>
                       <button class="btn btn-primary rounded-pill px-3 btn-sm fw-bold shadow-sm" onclick="Medi.openManualBooking()" style="font-size:.75rem;">
                           <i class="bi bi-plus-lg me-1"></i>Nueva Cita
                       </button>
                   </div>
                </div>

                <div class="card-body p-0 flex-grow-1 overflow-auto custom-scroll">
                   <!-- Agenda Tab -->
                   <div id="medi-work-agenda" class="p-3">
                       <div id="medi-agenda-list"></div>
                   </div>
                   <!-- Consulta Tab (hidden by default, shown when attending patient) -->
                   <div id="medi-work-consulta" class="p-3 d-none">
                       <div id="medi-inline-consulta"></div>
                   </div>
                </div>
             </div>
          </div>

          <!-- ZONA C: PANEL CONTEXTUAL (30%) -->
          <div class="col-lg-4">
             <div class="card border-0 shadow-sm rounded-4 d-flex flex-column medi-admin-col">
                <!-- Context Tabs -->
                <div class="card-header bg-transparent py-2 border-0 px-3 pt-3">
                    <ul class="nav nav-pills nav-pills-sm gap-1" id="medi-context-tabs">
                        <li class="nav-item">
                            <button class="nav-link active btn-sm py-1 px-2 rounded-pill" data-ctx="metrics" onclick="Medi._switchContextTab('metrics')" style="font-size:.75rem;">
                                <i class="bi bi-graph-up me-1"></i>Resumen
                            </button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link btn-sm py-1 px-2 rounded-pill" data-ctx="patient" onclick="Medi._switchContextTab('patient')" style="font-size:.75rem;">
                                <i class="bi bi-person me-1"></i>Paciente
                            </button>
                        </li>
                        <li class="nav-item d-none" id="medi-tab-messages">
                            <button class="nav-link btn-sm py-1 px-2 rounded-pill" data-ctx="messages" onclick="Medi._switchContextTab('messages')" style="font-size:.75rem;">
                                <i class="bi bi-chat-dots me-1"></i>Mensajes <span class="badge bg-danger rounded-pill ms-1 d-none" id="badge-unread-msgs">0</span>
                            </button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link btn-sm py-1 px-2 rounded-pill" data-ctx="recent" onclick="Medi._switchContextTab('recent')" style="font-size:.75rem;">
                                <i class="bi bi-clock-history me-1"></i>Recientes
                            </button>
                        </li>
                    </ul>
                </div>

                <div class="card-body p-0 flex-grow-1 overflow-auto custom-scroll">
                   <!-- Metrics (Default) -->
                   <div id="medi-ctx-metrics" class="p-3">
                       <div id="medi-day-stats">
                           <div class="text-center py-4 text-muted small">
                               <i class="bi bi-bar-chart-line display-6 d-block mb-2 opacity-25"></i>
                               <p class="extra-small">Métricas del día</p>
                           </div>
                       </div>
                   </div>
                   <!-- Patient Info -->
                   <div id="medi-ctx-patient" class="p-3 d-none">
                       <div id="medi-patient-context">
                           <div class="text-center py-4 text-muted small">
                               <i class="bi bi-person-dash display-6 d-block mb-2 opacity-25"></i>
                               <p class="extra-small">Selecciona un paciente</p>
                           </div>
                       </div>
                   </div>
                   <!-- Messages / Chat -->
                   <div id="medi-ctx-messages" class="p-3 d-none">
                       <div id="medi-chat-panel">
                           <div class="text-center py-4 text-muted small">
                               <i class="bi bi-chat-square-dots display-6 d-block mb-2 opacity-25"></i>
                               <p class="extra-small">Sin conversaciones activas</p>
                           </div>
                       </div>
                   </div>
                   <!-- Recent Activity -->
                   <div id="medi-ctx-recent" class="p-3 d-none">
                       <div id="medi-recent-list" class="list-group list-group-flush">
                           <div class="text-center py-4 text-muted small opacity-50">Esperando datos...</div>
                       </div>
                   </div>
                </div>
             </div>
          </div>

       </div>
    </section>

    <div class="modal fade" id="modalConsulta" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header bg-primary text-white border-0 py-2 align-items-center">
             <div class="d-flex align-items-center gap-3">
                 <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                 <div>
                    <h5 class="fw-bold mb-0" id="soap-patient-name" style="font-size: 1rem;">Consulta</h5>
                    <div id="soap-patient-meta" class="extra-small opacity-75"></div>
                 </div>
             </div>
             <div class="d-flex gap-2">

                 <button type="button" class="btn btn-sm btn-light text-primary rounded-pill px-3 fw-bold shadow-sm" onclick="Medi.confirmarFinalizacion()">
                    <i class="bi bi-check-circle-fill me-1"></i> Finalizar Consulta
                 </button>
             </div>
          </div>
          <div class="modal-body bg-light p-0">
             <div class="row g-0 h-100">
                <div class="col-md-7 p-4 border-end" style="max-height: 80vh; overflow-auto;">
                   <form id="form-soap">
                      <input type="hidden" id="soap-cita-id">
                      <input type="hidden" id="soap-student-id">
                      <input type="hidden" id="soap-student-email">

                      <div id="soap-fields-container" class="row g-3"></div>

                      <!-- Botones movidos al header -->
                       <div class="mt-4 pt-3 border-top text-center text-muted small">
                          <i class="bi bi-info-circle me-1"></i> Recuerda guardar tus cambios al finalizar.
                       </div>
                   </form>
                </div>
                <div class="col-md-5 p-4 bg-white" style="max-height: 80vh; overflow-auto;">
                   <h6 class="fw-bold text-muted mb-3">Información del Paciente</h6>
                   <div id="soap-patient-profile" class="mb-4"></div>
                   <h6 class="fw-bold text-muted mb-3 border-top pt-3">Consultas Previas</h6>
                   <div id="soap-history-list" class="list-group list-group-flush small"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modalMediEditCard" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4 border-0 shadow">
          <div class="modal-body p-4">
             <h6 class="fw-bold mb-3">Actualizar Datos Médicos</h6>
             <form id="medi-card-form">
                <div class="mb-2">
                   <label class="small text-muted fw-bold">Tipo de Sangre</label>
                   <select class="form-select" id="edit-sangre">
                      <option value="">Seleccionar...</option>
                      <option value="O+">O+</option><option value="O-">O-</option>
                      <option value="A+">A+</option><option value="A-">A-</option>
                      <option value="B+">B+</option><option value="B-">B-</option>
                      <option value="AB+">AB+</option><option value="AB-">AB-</option>
                   </select>
                </div>
                <div class="mb-2">
                   <label class="small text-muted fw-bold">Alergias</label>
                   <input type="text" class="form-control" id="edit-alergias" placeholder="Ninguna">
                </div>
                <hr>
                <div class="mb-2">
                   <label class="small text-muted fw-bold">Contacto Emergencia</label>
                   <input type="text" class="form-control mb-2" id="edit-contacto-nombre" placeholder="Nombre completo">
                   <input type="tel" class="form-control" id="edit-contacto-tel" placeholder="Teléfono">
                </div>
                <button type="submit" class="btn btn-primary w-100 mt-3 rounded-pill fw-bold">Guardar Cambios</button>
             </form>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modalCancelCita" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow rounded-4">
          <div class="modal-body p-4 text-center">
            <div class="text-danger mb-3"><i class="bi bi-exclamation-octagon fs-1"></i></div>
            <h6 class="fw-bold">¿Cancelar cita?</h6>
            <p class="small text-muted">Cuéntanos brevemente por qué para mejorar nuestro servicio.</p>
            <textarea id="cancel-reason" class="form-control form-control-sm mb-3" rows="2" placeholder="Ej. Contratiempo personal..."></textarea>
            <div class="d-grid gap-2">
              <button id="btn-confirm-cancel" class="btn btn-danger rounded-pill fw-bold">Confirmar Cancelación</button>
              <button class="btn btn-light rounded-pill btn-sm" data-bs-dismiss="modal">Regresar</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modalEditCita" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-0 pb-0"><h5 class="fw-bold">Re-programar Cita</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body p-4">
             <form id="form-edit-cita">
                <input type="hidden" id="edit-cita-id">
                <div id="edit-cita-selector-container"></div>
                <div class="mt-4 text-end">
                  <button type="submit" class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">Guardar Cambios</button>
                </div>
             </form>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modalDetalleConsulta" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header bg-light border-0 py-3">
            <div class="d-flex align-items-center">
                <div class="bg-primary-subtle p-2 rounded-3 me-3 text-primary">
                    <i class="bi bi-file-earmark-medical fs-4"></i>
                </div>
                <div>
                    <h5 class="fw-bold mb-0">Resumen de Consulta</h5>
                    <small class="text-muted" id="detail-date-header"></small>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4 pt-2">
             <div class="row g-4">
                <div class="col-12">
                    <div class="p-3 rounded-4 bg-light d-flex justify-content-around text-center border">
                        <div>
                            <div class="extra-small text-muted fw-bold">Presión</div>
                            <div class="fw-bold text-dark" id="detail-presion">--</div>
                        </div>
                        <div class="vr opacity-10"></div>
                        <div>
                            <div class="extra-small text-muted fw-bold">Temp.</div>
                            <div class="fw-bold text-dark" id="detail-temp">--</div>
                        </div>
                        <div class="vr opacity-10"></div>
                        <div>
                            <div class="extra-small text-muted fw-bold">Peso</div>
                            <div class="fw-bold text-dark" id="detail-peso">--</div>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <h6 class="fw-bold text-primary small mb-1"><i class="bi bi-person-heart me-1"></i> Motivo / Subjetivo</h6>
                    <p class="small text-muted bg-light p-2 rounded-3 border-start border-3 border-primary" id="detail-subjetivo"></p>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-info small mb-1"><i class="bi bi-clipboard2-pulse me-1"></i> Diagnóstico (A)</h6>
                    <p class="small text-dark fw-bold bg-light p-2 rounded-3 border-start border-3 border-info" id="detail-diagnosis"></p>
                </div>

                <div class="col-12">
                    <h6 class="fw-bold text-success small mb-1"><i class="bi bi-capsule me-1"></i> Tratamiento y Medicamentos (Plan)</h6>
                    <div class="p-3 rounded-4 border bg-white shadow-sm" style="min-height: 80px;">
                        <p class="mb-0 text-dark" style="white-space: pre-line;" id="detail-plan"></p>
                    </div>
                </div>

                <div class="col-12 mt-4 text-center">
                    <div class="small text-muted italic mb-2">Atendido por: <span id="detail-doctor" class="fw-bold"></span></div>
                </div>
             </div>
          </div>
          <div class="modal-footer bg-light border-0 justify-content-between p-3">
            <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>
            <button type="button" class="btn btn-primary rounded-pill px-4 fw-bold shadow" id="btn-print-receta">
                <i class="bi bi-printer me-2"></i>Descargar Receta
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
    
    <!-- MODAL PIN LOGIN (Redesigned - Visual & Intuitive) -->
    <div class="modal fade" id="modalPinLogin" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 380px;">
            <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <!-- Gradient Header -->
                <div class="text-center py-4" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
                    <div class="d-inline-flex align-items-center justify-content-center bg-white bg-opacity-25 rounded-circle mb-3" style="width: 72px; height: 72px;">
                        <i class="bi bi-fingerprint" style="font-size: 2.2rem;"></i>
                    </div>
                    <h5 class="fw-bold text-white mb-1">Identificación de Turno</h5>
                    <p class="text-white-50 small mb-0 px-4">Ingresa tu PIN para acceder a tu turno.<br>Esto separa la información de cada profesional.</p>
                </div>

                <div class="modal-body px-4 pt-4 pb-3 bg-white">
                    <form onsubmit="event.preventDefault(); Medi.handlePinLogin();">
                        <!-- PIN Input with dot indicators -->
                        <div class="mb-4">
                            <label class="form-label small fw-bold text-muted text-uppercase text-center d-block mb-2">Tu PIN de 4 dígitos</label>
                            <div class="position-relative">
                                <input type="password" id="medi-login-pin" 
                                       class="form-control form-control-lg text-center fw-bold border-2 rounded-3" 
                                       maxlength="4" placeholder="• • • •" autocomplete="off" inputmode="numeric" required
                                       style="font-size: 2rem; letter-spacing: 0.8rem; padding-left: 1.5rem;">
                            </div>
                        </div>

                        <!-- Persistence Toggle (Simplified) -->
                        <div class="mb-4">
                            <label class="form-label extra-small fw-bold text-muted text-uppercase d-block text-center mb-2">
                                <i class="bi bi-clock-history me-1"></i>Recordar sesión
                            </label>
                            <div class="d-flex gap-2 justify-content-center" id="medi-pin-persistence-group">
                                <button type="button" class="btn btn-sm rounded-pill px-3 fw-bold btn-primary" data-val="">
                                    <i class="bi bi-shield-lock me-1"></i>Pedir siempre
                                </button>
                                <button type="button" class="btn btn-sm rounded-pill px-3 fw-bold btn-outline-secondary" data-val="8h">
                                    <i class="bi bi-sun me-1"></i>Todo el día
                                </button>
                            </div>
                            <input type="hidden" id="medi-pin-persistence" value="">
                        </div>

                        <!-- Submit -->
                        <div class="d-grid mb-2">
                            <button type="submit" class="btn btn-lg rounded-pill fw-bold shadow-sm" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; border: none;">
                                Acceder <i class="bi bi-arrow-right-short"></i>
                            </button>
                        </div>
                        <div id="medi-pin-error" class="text-danger small mt-2 d-none text-center fw-bold">
                            <i class="bi bi-x-circle me-1"></i>PIN incorrecto. Intenta de nuevo.
                        </div>
                    </form>
                </div>
                <div class="bg-light p-2 text-center border-top" style="font-size: 0.65rem;">
                    <span class="text-muted"><i class="bi bi-info-circle me-1"></i>Cada turno (matutino/vespertino) tiene su propio PIN</span>
                </div>
            </div>
        </div>
    </div>
    <!-- MODAL CONFIRM FINALIZAR -->
    <div class="modal fade" id="modalConfirmEnd" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow rounded-4">
          <div class="modal-body p-4 text-center">
            <div class="mb-3 text-success">
               <i class="bi bi-check-circle-fill display-3"></i>
            </div>
            <h5 class="fw-bold mb-2">¿Finalizar Consulta?</h5>
            <p class="small text-muted mb-4">La consulta se guardará en el expediente y no podrá editarse después.</p>
            <div class="d-grid gap-2">
              <button class="btn btn-success rounded-pill fw-bold" onclick="Medi.saveConsultation(null, true)">
                 <i class="bi bi-check-lg me-1"></i> Confirmar
              </button>
              <button class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL CONFIRM REPLACE (NEW) -->
    <div class="modal fade" id="modalConfirmReplace" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-body p-4 text-center">
            <div class="mb-3 text-primary">
               <i class="bi bi-calendar-range-fill display-3"></i>
            </div>
            <h5 class="fw-bold mb-2">Re-agendar Cita</h5>
            <p class="text-muted small mb-4">
               Ya tienes una cita programada. <br>
               ¿Deseas <b>cancelar la actual</b> y confirmar este nuevo horario?
            </p>
            
            <div class="card bg-light border-0 mb-4 p-3 rounded-3 text-start">
               <div class="d-flex justify-content-between mb-2">
                  <span class="small text-muted">Cita Actual:</span>
                  <span class="badg bg-secondary-subtle text-secondary rounded-pill px-2" id="replace-old-date">--</span>
               </div>
               <div class="d-flex justify-content-between">
                   <span class="small text-primary fw-bold">Nueva Cita:</span>
                   <span class="fw-bold text-primary" id="replace-new-date">--</span>
               </div>
            </div>

            <div class="d-grid gap-2">
              <button class="btn btn-primary rounded-pill fw-bold shadow-sm" id="btn-do-replace">
                 <i class="bi bi-arrow-repeat me-2"></i>Sí, Cambiar Cita
              </button>
              <button class="btn btn-light rounded-pill" data-bs-dismiss="modal">No, mantener actual</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL SUCCESS + PRINT -->
    <div class="modal fade" id="modalSuccessConsulta" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-body p-5 text-center">
             <div class="mb-4 text-primary">
                <i class="bi bi-printer-fill display-1"></i>
             </div>
             <h4 class="fw-bold text-dark">¡Consulta Guardada!</h4>
             <p class="text-muted">El expediente ha sido actualizado correctamente.</p>
             
             <div class="d-flex justify-content-center gap-3 mt-4">
                <button class="btn btn-light rounded-pill px-4" onclick="Medi.cerrarSuccessModal()">
                   <i class="bi bi-x-lg me-1"></i> Cerrar
                </button>
                <button class="btn btn-primary rounded-pill px-4 fw-bold shadow hover-scale" onclick="Medi.printReceta()">
                   <i class="bi bi-printer me-2"></i> Imprimir Receta
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL PATIENT FOUND (Mini Profile) -->
    <div class="modal fade" id="modalPatientFound" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow rounded-4 overflow-hidden">
           <div class="modal-body p-4" id="found-patient-content">
               <!-- Dynamic Content -->
               <div class="text-center py-4">
                   <div class="spinner-border text-primary" role="status"></div>
               </div>
           </div>
        </div>
      </div>
    </div>

    <!-- MODAL ADMIN BOOKING (Manual) -->
    <div class="modal fade" id="modalAdminBooking" tabindex="-1">
       <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow rounded-4">
             <div class="modal-header border-0">
                <h6 class="fw-bold"><i class="bi bi-calendar-plus-fill me-2 text-primary"></i>Nueva Cita (Manual)</h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
             </div>
             <div class="modal-body p-4 pt-0">
                 <form id="adm-book-form" onsubmit="event.preventDefault(); Medi.confirmAdminBooking();">
                     <!-- STEP 1: Search (Hidden if student pre-filled) -->
                     <div id="adm-book-step-1" class="animate-in">
                         <div class="mb-3">
                             <label class="form-label small fw-bold text-muted">Buscar Estudiante</label>
                             <div class="input-group">
                                 <input type="text" id="adm-book-matricula" class="form-control bg-light border-0" placeholder="Matrícula...">
                                 <button class="btn btn-primary" type="button" onclick="Medi.searchStudentForBooking()">
                                     <i class="bi bi-search"></i>
                                 </button>
                             </div>
                         <div id="adm-student-result" class="mb-3"></div>
                     </div>

                     <!-- STEP 2: Details (Hidden until student found) -->
                     <div id="adm-book-step-2" class="d-none animate-in">
                         <hr class="border-light my-3">
                         <div class="row g-2 mb-3">
                             <div class="col-12">
                                 <label class="form-label small fw-bold text-muted">Seleccionar Fecha</label>
                                 <div id="adm-book-dates" class="d-flex gap-2 overflow-auto pb-2" style="scrollbar-width: thin;"></div>
                                 <input type="hidden" id="adm-book-date" required>
                             </div>
                             <div class="col-12 mt-2">
                                 <label class="form-label small fw-bold text-muted">Seleccionar Hora</label>
                                 <div id="adm-book-time-msg" class="text-center small text-muted fst-italic py-2 bg-light rounded-3 border border-dashed">
                                    <i class="bi bi-calendar-event me-2"></i>Selecciona un día primero
                                 </div>
                                 <div id="adm-book-times" class="d-flex flex-wrap gap-2 justify-content-center d-none p-2"></div>
                                 <input type="hidden" id="adm-book-time" required>
                             </div>
                         </div>
                         <div class="mb-3">
                             <label class="form-label small fw-bold text-muted">Motivo</label>
                             <select class="form-select bg-light border-0 mb-2" id="adm-book-category">
                                 <option value="Consulta General">Consulta General</option>
                                 <option value="Urgencia Menor">Urgencia Menor</option>
                                 <option value="Seguimiento">Seguimiento</option>
                                 <option value="Certificado Médico">Certificado Médico</option>
                             </select>
                             <textarea id="adm-book-reason" class="form-control bg-light border-0" rows="2" placeholder="Detalles adicionales..."></textarea>
                         </div>
                         <div class="d-grid">
                             <button type="submit" class="btn btn-primary rounded-pill fw-bold shadow-sm">
                                 <i class="bi bi-check-lg me-2"></i>Agendar Cita
                             </button>
                         </div>
                     </div>
                 </form>
             </div>
          </div>
       </div>
    </div>
    `;
  }

  // --- GESTIÓN DE CONFIGURACIÓN ---

  // [NEW] ADMIN CONFIG MODAL (Consolidated)
  async function showAdminConfigModal() {
    // Load current values safely
    let currentDuration = 60;
    try {
      const cfg = await MediService.loadConfig(_ctx);
      if (cfg.slotDuration) currentDuration = cfg.slotDuration;
    } catch (e) { console.warn("Error loading config for modal:", e); }

    // Fallback to global if set
    if (typeof SLOT_DURATION !== 'undefined') currentDuration = SLOT_DURATION;

    const isEnabled = (typeof _ctx.config?.medi?.available !== 'undefined') ? _ctx.config.medi.available : true;

    const html = `
      <div class="modal fade" id="modalAdminConfig" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content rounded-4 border-0 shadow">
            <div class="modal-header border-0 pb-0">
                <h5 class="fw-bold"><i class="bi bi-gear-fill me-2 text-secondary"></i>Configuración de Agenda</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <!-- 1. Habilitar Servicio -->
                <!-- 1. Habilitar Servicio (Role Specific) -->
                ${_myRole === 'Medico' ? `
                <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 mb-3">
                    <div>
                        <div class="fw-bold text-dark">Habilitar Agenda Médica</div>
                        <div class="small text-muted">Permitir reservas para medicina general</div>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input fs-4" type="checkbox" id="cfg-available-medico" ${(_ctx.config && _ctx.config.medi && _ctx.config.medi.availableMedico !== false) ? 'checked' : ''}>
                    </div>
                </div>` : ''}

                ${_myRole === 'Psicologo' ? `
                <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 mb-3">
                    <div>
                        <div class="fw-bold text-dark">Habilitar Agenda Psicología</div>
                        <div class="small text-muted">Permitir reservas para psicología</div>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input fs-4" type="checkbox" id="cfg-available-psicologo" ${(_ctx.config && _ctx.config.medi && _ctx.config.medi.availablePsicologo !== false) ? 'checked' : ''}>
                    </div>
                </div>` : ''}

                <!-- 2. Duración de Citas -->
                <label class="form-label fw-bold small text-uppercase text-muted">Duración de Citas</label>
                <div class="d-flex gap-2 mb-4">
                    <div class="nav nav-pills w-100" id="duration-pills">
                        <input type="radio" class="btn-check" name="slotDur" id="dur60" value="60" ${currentDuration === 60 ? 'checked' : ''}>
                        <label class="btn btn-outline-primary flex-fill rounded-start-pill fw-bold" for="dur60">1 Hora</label>

                        <input type="radio" class="btn-check" name="slotDur" id="dur45" value="45" ${currentDuration === 45 ? 'checked' : ''}>
                        <label class="btn btn-outline-primary flex-fill rounded-end-pill fw-bold" for="dur45">45 Minutos</label>
                    </div>
                </div>

                <div class="alert alert-info border-0 small mb-0">
                    <i class="bi bi-info-circle me-1"></i> Los cambios afectarán la generación de horario para estudiantes de inmediato.
                </div>
            </div>
            <div class="modal-footer border-0 pt-0">
                <button class="btn btn-primary w-100 rounded-pill fw-bold py-2" id="btn-save-cfg">Guardar Cambios</button>
            </div>
          </div>
        </div>
      </div>
      `;

    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.appendChild(d.firstElementChild);

    const modalEl = document.getElementById('modalAdminConfig');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    document.getElementById('btn-save-cfg').onclick = async function () {
      const btn = this;
      const valDuration = document.querySelector('input[name="slotDur"]:checked').value;
      const chkMedico = document.getElementById('cfg-available-medico');
      const chkPsicologo = document.getElementById('cfg-available-psicologo');



      const updateData = {};
      // [FIX] Save specific duration for role
      if (_myRole) {
        updateData['slotDuration_' + _myRole] = parseInt(valDuration);
      } else {
        updateData.slotDuration = parseInt(valDuration);
      }

      // Only update what is visible/editable
      if (chkMedico) updateData.availableMedico = chkMedico.checked;
      if (chkPsicologo) updateData.availablePsicologo = chkPsicologo.checked;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        // Update Config in Firestore
        await MediService.updateConfig(_ctx, updateData);

        // Update Locals
        SLOT_DURATION = parseInt(valDuration);

        // Update local context config to reflect changes immediately
        if (!_ctx.config) _ctx.config = {};
        if (!_ctx.config.medi) _ctx.config.medi = {};
        Object.assign(_ctx.config.medi, updateData);

        // [FIX] Update Banner Immediately
        const banner = document.getElementById('medi-service-status');
        if (banner) {
          let isEnabled = true;
          if (_myRole === 'Medico' && updateData.availableMedico === false) isEnabled = false;
          else if (_myRole === 'Psicologo' && updateData.availablePsicologo === false) isEnabled = false;

          if (!isEnabled) {
            banner.classList.remove('d-none');
            banner.classList.add('d-flex');
          } else {
            banner.classList.add('d-none');
            banner.classList.remove('d-flex');
          }
        }

        showToast('Configuración actualizada', 'success');
        modal.hide();
        // Note: 'hidden.bs.modal' listener will handle removal.
      } catch (e) {
        console.error(e);
        showToast('Error al guardar', 'danger');
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
      }
    };
  }

  // --- MANUAL BOOKING LOGIC ---
  let _studentForBooking = null;

  function openManualBooking(encodedStudent = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalAdminBooking'));

    // Reset Form & UI
    document.getElementById('adm-book-form').reset();
    document.getElementById('adm-student-result').innerHTML = '';
    document.getElementById('adm-book-step-2').classList.add('d-none');
    document.getElementById('adm-book-step-1').classList.remove('d-none'); // Default show

    // Reset Date/Time Pickers
    // Reset Date/Time Pickers
    document.getElementById('adm-book-dates').innerHTML = '';
    document.getElementById('adm-book-times').innerHTML = '';
    document.getElementById('adm-book-times').classList.add('d-none');

    // Set explicit message
    const tmMsg = document.getElementById('adm-book-time-msg');
    tmMsg.classList.remove('d-none');
    tmMsg.innerHTML = '<i class="bi bi-calendar-event me-2"></i>Selecciona un día primero';

    document.getElementById('adm-book-date').value = '';
    document.getElementById('adm-book-time').value = '';

    _studentForBooking = null;

    // Logic for Pre-filled Student (from Search Result)
    if (encodedStudent) {
      try {
        let student = null;
        if (encodedStudent === 'found') {
          student = _foundPatient;
        } else {
          student = typeof encodedStudent === 'string' ? JSON.parse(decodeURIComponent(encodedStudent)) : encodedStudent;
        }

        if (student) {
          _studentForBooking = student;
          // Continue logic...
        } else {
          throw new Error("Invalid student data");
        }

        // Hide Search INPUT, but show Result
        document.getElementById('adm-book-step-1').classList.add('d-none');

        // Better strategy: We skip Step 1 visual entirely and inject a "Patient Header" in Step 2 or above it.
        // But for minimal HTML change, let's just unhide Step 2 and Hide Step 1 completely, 
        // and inject a mini-header in Step 2 for context.

        const step2 = document.getElementById('adm-book-step-2');
        step2.classList.remove('d-none');

        // Inject Patient Info at top of Step 2
        let infoDiv = document.getElementById('adm-book-patient-info');
        if (!infoDiv) {
          infoDiv = document.createElement('div');
          infoDiv.id = 'adm-book-patient-info';
          step2.insertBefore(infoDiv, step2.firstChild);
        }

        infoDiv.innerHTML = `
           <div class="alert alert-primary border-0 small d-flex align-items-center mb-3">
               <i class="bi bi-person-circle fs-4 me-2"></i>
               <div class="flex-grow-1">
                   <div class="fw-bold">${student.displayName}</div>
                   <div class="extra-small opacity-75">${student.matricula}</div>
               </div>
               <button type="button" class="btn btn-sm btn-light text-primary fw-bold" onclick="Medi.openManualBooking()">Cambiar</button>
           </div>
        `;

        renderAdminBookingDates(); // Initialize Date Picker

      } catch (e) { console.error("Error decoding student", e); }
    } else {
      // Normal Mode: Remove injected header if any
      const infoDiv = document.getElementById('adm-book-patient-info');
      if (infoDiv) infoDiv.remove();

      // Render Dates anyway (can pick date while searching?)
      // Better wait until student found? No, can pick anytime.
      renderAdminBookingDates();
    }

    modal.show();
  }

  async function searchStudentForBooking() {
    const mat = document.getElementById('adm-book-matricula').value.trim();
    const resContainer = document.getElementById('adm-student-result');

    if (mat.length < 4) { showToast('Ingresa al menos 4 dígitos', 'warning'); return; }

    resContainer.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

    try {
      const q = await _ctx.db.collection('usuarios').where('matricula', '==', mat).limit(1).get();
      if (q.empty) {
        resContainer.innerHTML = '<div class="alert alert-danger border-0 small py-2 mb-0"><i class="bi bi-x-circle me-1"></i>No encontrado</div>';
        _studentForBooking = null;
        document.getElementById('adm-book-step-2').classList.add('d-none');
      } else {
        const s = q.docs[0].data();
        s.uid = q.docs[0].id;
        _studentForBooking = s;

        resContainer.innerHTML = `
                  <div class="alert alert-success border-0 small mb-0 d-flex align-items-center">
                      <i class="bi bi-person-check-fill fs-5 me-2"></i> 
                      <div>
                          <div class="fw-bold">${s.displayName}</div>
                          <div class="extra-small opacity-75">${s.carrera || 'Sin carrera'} • ${s.matricula}</div>
                      </div>
                  </div>
              `;
        document.getElementById('adm-book-step-2').classList.remove('d-none');
      }
    } catch (e) {
      console.error(e);
      resContainer.innerHTML = '<div class="text-danger small">Error de búsqueda</div>';
    }
  }

  async function confirmAdminBooking() {
    if (!_studentForBooking) return;

    const dateVal = document.getElementById('adm-book-date').value;
    const timeVal = document.getElementById('adm-book-time').value;
    const cat = document.getElementById('adm-book-category').value;
    const reason = document.getElementById('adm-book-reason').value;

    if (!dateVal || !timeVal) { showToast('Selecciona fecha y hora', 'warning'); return; }

    const [y, m, d] = dateVal.split('-').map(Number);
    const [hh, mm] = timeVal.split(':').map(Number);
    const targetDate = new Date(y, m - 1, d, hh, mm);

    // Slot ID Generator (Local Re-implementation)
    const pad = n => String(n).padStart(2, '0');
    // [FIX] Append Type to ID
    const baseId = `${y}-${pad(m)}-${pad(d)}_${pad(hh)}:${pad(mm)}`;
    // Determine type based on category or _myRole if admin
    // In manual booking, category gives context. If category is 'Salud Mental' -> Psicologo?
    // Let's infer type from category logic
    let typeForSlot = 'Medico';
    if (cat === 'Salud Mental' || cat === 'Psicología' || _myRole === 'Psicologo') typeForSlot = 'Psicologo';

    const slotId = `${baseId}_${typeForSlot}`;

    const btn = document.querySelector('#adm-book-form button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Agendando...';

    try {
      // [FIX] Use reservarCitaAdmin (not reservarCita) to include shift + profile
      await MediService.reservarCitaAdmin(_ctx, {
        student: _studentForBooking,
        date: targetDate,
        slotId: slotId,
        tipo: _myRole,
        shift: _currentShift,
        profileData: _currentProfile,
        motivo: `[MANUAL: ${cat}] ${reason}`
      });

      showToast('Cita Agendada Correctamente', 'success');
      bootstrap.Modal.getInstance(document.getElementById('modalAdminBooking')).hide();
      refreshAdmin();
    } catch (e) {
      console.error(e);
      showToast(e.message || "Error al agendar. Verifica disponibilidad.", 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // --- ADMIN SLOT RENDERING ---
  function renderAdminBookingDates() {
    const container = document.getElementById('adm-book-dates');
    if (!container) return;

    const days = [];
    let curr = new Date();
    // Start from tomorrow? Or today? Admin might want today.
    // Let's start today.

    while (days.length < 10) {
      if (isWeekday(curr)) days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    container.innerHTML = days.map(d => {
      const isoDate = MediService.toISO(d);
      const isSelected = false;
      return `
            <div class="adm-date-card p-2 text-center border rounded-3 bg-white shadow-sm flex-shrink-0" 
                 style="min-width: 70px; cursor: pointer; user-select: none;" 
                 onclick="Medi.selectAdminDate(this, '${isoDate}')">
                <div class="extra-small text-muted mb-0 text-uppercase">${d.toLocaleDateString('es-MX', { weekday: 'short' })}</div>
                <div class="fw-bold fs-5 lh-1">${d.getDate()}</div>
                <div class="extra-small text-primary fw-bold">${d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase()}</div>
            </div>`;
    }).join('');
  }

  function selectAdminDate(el, dateStr) {
    // Validar input
    document.getElementById('adm-book-date').value = dateStr;

    // UI Update
    document.querySelectorAll('.adm-date-card').forEach(c => {
      c.classList.remove('border-primary', 'bg-primary-subtle');
      c.classList.add('border', 'bg-white');
    });
    el.classList.remove('border', 'bg-white');
    el.classList.add('border-primary', 'bg-primary-subtle');

    // Grid Logic
    const grid = document.getElementById('adm-book-times');
    const msg = document.getElementById('adm-book-time-msg');
    const timeInp = document.getElementById('adm-book-time');

    timeInp.value = ''; // Reset time
    grid.classList.add('d-none');
    msg.classList.remove('d-none');
    msg.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando horarios...';

    // Generate Slots
    // Use local build since we can't find the other one easily
    // SLOT_START, SLOT_END, SLOT_STEP are global

    setTimeout(() => { // Simulate async/render delay
      const slots = [];
      const startMin = (SLOT_START || 8) * 60;
      const endMin = (SLOT_END || 22) * 60;
      const step = SLOT_DURATION || 60; // [FIX] Use Duration

      for (let m = startMin; m < endMin; m += step) {
        const hh = Math.floor(m / 60);
        const mm = m % 60;
        const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        slots.push(timeStr);
      }

      grid.innerHTML = slots.map(t => `
            <button type="button" class="btn btn-outline-primary btn-sm rounded-pill fw-bold" 
                    style="font-size: 0.8rem; width: 60px;"
                    onclick="Medi.selectAdminTime(this, '${t}')">
                ${t}
            </button>
          `).join('');

      msg.classList.add('d-none');
      grid.classList.remove('d-none');
    }, 100);
  }

  function selectAdminTime(el, timeStr) {
    document.getElementById('adm-book-time').value = timeStr;

    const grid = document.getElementById('adm-book-times');
    grid.querySelectorAll('button').forEach(b => {
      b.classList.remove('btn-primary', 'text-white');
      b.classList.add('btn-outline-primary');
    });

    el.classList.remove('btn-outline-primary');
    el.classList.add('btn-primary', 'text-white');
  }

  async function initStudent(ctx) {
    _ctx = ctx;
    const user = _ctx.user; // Usar el usuario del Store/Context
    const profile = _ctx.profile;

    const container = document.getElementById('view-medi');
    if (!container) return;

    // Renderizado Garantizado: Limpiamos y renderizamos la estructura base
    // Esto evita pantallas en blanco si el HTML inicial tenía basura o placeholders
    renderStructure(container);

    // Mostrar vista de estudiante y asegurar limpieza de la admin
    const vStu = document.getElementById('medi-student');
    const vAdm = document.getElementById('medi-admin');

    if (vStu) vStu.classList.remove('d-none');
    if (vAdm) vAdm.classList.add('d-none');

    console.log("[Medi] Cargando datos para Estudiante:", user.email);

    try {
      // Cargar configuración de horarios desde el servicio
      const cfg = await MediService.loadConfig(_ctx);

      // [FIX] Sync config to Context so it can be used by Appointment Form
      if (!_ctx.config) _ctx.config = {};
      _ctx.config.medi = cfg;

      SLOT_START = cfg.slotStart || 8;
      SLOT_END = cfg.slotEnd || 22;
      SLOT_START = cfg.slotStart || 8;
      SLOT_END = cfg.slotEnd || 22;
      SLOT_STEP = cfg.slotStep || 30; // Legacy visual step
      SLOT_DURATION = cfg.slotDuration || 60; // [NEW] Actual logic duration

      // Inicializar componentes
      loadEmergencyCard(user);
      setupAppointmentForm();
      loadStudentHistory(user.uid);
      loadWellnessFeed();

      // [NEW] Student Chat
      renderStudentChat(user.uid, user.displayName || user.email);

      // [ENCUESTAS] Verificar encuesta de servicio (Médico o Psicología)
      if (window.Encuestas && window.Encuestas.checkAndShowServiceSurvey) {
        // Check both, start with medico. The internal logic handles if one is pending.
        // Or we can randomize? Let's check 'servicio-medico' first.
        setTimeout(() => window.Encuestas.checkAndShowServiceSurvey('servicio-medico'), 1500);
        setTimeout(() => window.Encuestas.checkAndShowServiceSurvey('psicologia'), 5000);
      }

    } catch (err) {
      console.error("[Medi] Error en initStudent async:", err);
    }
  }


  function loadEmergencyCard(user) {
    // CORRECCIÓN: Usar _ctx.profile que es la propiedad estándar en SIA
    const p = _ctx.profile || {};

    // Render Vista - Actualizamos los elementos con los datos del perfil
    const elSangre = document.getElementById('view-sangre');
    if (elSangre) elSangre.textContent = p.tipoSangre || '--';

    const elAlergias = document.getElementById('view-alergias');
    if (elAlergias) elAlergias.textContent = p.alergias || 'Ninguna';

    const elContNom = document.getElementById('view-contacto-nombre');
    if (elContNom) elContNom.textContent = p.contactoEmergenciaName || '--';

    const elContTel = document.getElementById('view-contacto-tel');
    if (elContTel) elContTel.textContent = p.contactoEmergenciaTel || '--';

    // Render Form - Precargar el formulario con lo que ya existe
    const inpSangre = document.getElementById('edit-sangre');
    if (inpSangre) inpSangre.value = p.tipoSangre || '';

    const inpAlergias = document.getElementById('edit-alergias');
    if (inpAlergias) inpAlergias.value = p.alergias || '';

    const inpContNom = document.getElementById('edit-contacto-nombre');
    if (inpContNom) inpContNom.value = p.contactoEmergenciaName || '';

    const inpContTel = document.getElementById('edit-contacto-tel');
    if (inpContTel) inpContTel.value = p.contactoEmergenciaTel || '';

    // Handler de guardado
    const form = document.getElementById('medi-card-form');
    if (form) {
      // Evitar duplicidad de listeners
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = newForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

        const data = {
          tipoSangre: document.getElementById('edit-sangre').value,
          alergias: document.getElementById('edit-alergias').value,
          contactoEmergenciaName: document.getElementById('edit-contacto-nombre').value,
          contactoEmergenciaTel: document.getElementById('edit-contacto-tel').value
        };

        try {
          // Guardar en la colección usuarios del alumno
          await _ctx.db.collection('usuarios').doc(user.uid).update(data);

          // CORRECCIÓN: Actualizar el perfil en el contexto local de forma segura
          if (_ctx.profile) {
            Object.assign(_ctx.profile, data);
          } else {
            _ctx.profile = data;
          }

          loadEmergencyCard(user); // Refrescar vista

          const modal = bootstrap.Modal.getInstance(document.getElementById('modalMediEditCard'));
          if (modal) modal.hide();

          showToast('Datos de emergencia actualizados', 'success');
        } catch (err) {
          console.error("[Medi] Error al guardar datos medicos:", err);
          showToast('Error al guardar: ' + err.message, 'danger');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar Cambios';
        }
      });
    }
  }

  function cancelarEdicionTarjeta() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalMediEditCard'));
    if (modal) modal.hide();
  }

  // Helper function for setupAppointmentForm
  function setupAppointmentForm() {
    const form = document.getElementById('form-medi-nueva-cita');
    if (!form) return;

    const dateSelector = document.getElementById('medi-date-selector');
    const dateInput = document.getElementById('medi-cita-fecha');
    const timeGrid = document.getElementById('medi-time-grid');
    const msg = document.getElementById('medi-time-msg');
    const availDiv = document.getElementById('medi-cita-disponibilidad');
    const timeInput = document.getElementById('medi-cita-hora');

    // Reset visual
    if (timeGrid) { timeGrid.innerHTML = ''; timeGrid.classList.add('d-none'); }
    if (msg) { msg.classList.remove('d-none'); msg.innerHTML = '<i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero'; }
    if (availDiv) availDiv.textContent = '';
    dateInput.value = ""; timeInput.value = "";

    // Generar 10 días hábiles (INCLUYENDO HOY)
    const days = [];
    let curr = new Date();
    // [FIX] Removed curr.setDate(curr.getDate() + 1); to allow Today

    while (days.length < 10) {
      if (isWeekday(curr)) days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    if (dateSelector) {
      dateSelector.innerHTML = days.map(d => {
        const isoDate = MediService.toISO(d);
        const isToday = d.getDate() === new Date().getDate();
        const displayDay = isToday ? 'HOY' : d.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();

        return `
                <div class="date-option p-3 text-center border rounded-4 bg-white shadow-sm position-relative overflow-hidden" 
                     style="min-width: 85px; cursor: pointer; transition: all 0.2s ease;" data-date="${isoDate}">
                    <div class="small text-muted mb-1 date-label">${displayDay}</div>
                    <div class="fw-bold fs-4 date-num">${d.getDate()}</div>
                    <div class="small text-primary fw-bold date-month">${d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase()}</div>
                </div>`;
      }).join('');

      dateSelector.querySelectorAll('.date-option').forEach(card => {
        card.addEventListener('click', async () => {
          // [UI] Stronger Selection Style
          dateSelector.querySelectorAll('.date-option').forEach(c => {
            c.classList.remove('bg-primary', 'text-white', 'shadow', 'border-primary', 'scale-105');
            c.classList.add('bg-white', 'text-dark');
            c.querySelector('.date-label').classList.remove('text-white-50');
            c.querySelector('.date-label').classList.add('text-muted');
            c.querySelector('.date-month').classList.remove('text-white');
            c.querySelector('.date-month').classList.add('text-primary');
          });

          card.classList.remove('bg-white', 'text-dark');
          card.classList.add('bg-primary', 'text-white', 'shadow', 'border-primary', 'scale-105');
          card.querySelector('.date-label').classList.remove('text-muted');
          card.querySelector('.date-label').classList.add('text-white-50');
          card.querySelector('.date-month').classList.remove('text-primary');
          card.querySelector('.date-month').classList.add('text-white');

          dateInput.value = card.dataset.date;
          timeInput.value = "";

          // [NEW] Reset Confirmation State
          document.getElementById('medi-booking-summary').classList.add('d-none');
          document.getElementById('btn-medi-confirm').disabled = true;

          msg.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Buscando disponibilidad...';
          timeGrid.classList.add('d-none');
          msg.classList.remove('d-none');

          // [NEW] Check Availability Config
          const selectedType = document.getElementById('medi-cita-tipo').value || 'Medico';
          const cfg = _ctx.config?.medi || {};

          let isServiceAvailable = true;
          if (selectedType === 'Medico' && cfg.availableMedico === false) isServiceAvailable = false;
          if (selectedType === 'Psicologo' && cfg.availablePsicologo === false) isServiceAvailable = false;

          if (!isServiceAvailable) {
            msg.innerHTML = `<i class="bi bi-cone-striped me-2"></i> La agenda de <b>${selectedType === 'Medico' ? 'Medicina' : 'Psicología'}</b> no está disponible por el momento.`;
            msg.classList.remove('d-none');
            return;
          }

          // Fetch Occupied Slots
          const targetDate = new Date(card.dataset.date + 'T12:00:00');
          const slots = buildSlotsForDate(targetDate);
          let occupied = [];

          try {
            const currentType = document.getElementById('medi-cita-tipo').value || 'Medico';
            occupied = await MediService.getOccupiedSlots(_ctx, targetDate, currentType);
          } catch (e) { console.error("Error fetching occupied:", e); }

          // Render Time Grid
          timeGrid.classList.remove('d-none');
          timeGrid.className = 'd-flex overflow-auto gap-2 py-2 px-1 mb-3 no-scrollbar';
          timeGrid.innerHTML = '';

          const validSlots = slots.map(slot => {
            const tStr = `${slot.getHours().toString().padStart(2, '0')}:${slot.getMinutes().toString().padStart(2, '0')}`;
            const currentType = document.getElementById('medi-cita-tipo').value || 'Medico';
            const baseId = MediService.slotIdFromDate(slot);
            const slotId = `${baseId}_${currentType}`;
            const isTaken = occupied.includes(slotId);

            return {
              tStr, isTaken
            };
          });

          if (validSlots.length === 0) {
            timeGrid.innerHTML = '<div class="text-muted small w-100 text-center fst-italic">No hay horarios.</div>';
          } else {
            validSlots.forEach(({ tStr, isTaken }) => {
              const btn = document.createElement('div');
              const isDisabled = isTaken;

              btn.className = `flex-shrink-0 text-center border rounded-3 shadow-sm p-3 time-slot-card ${isDisabled ? 'bg-light text-muted opacity-50 pe-none' : 'bg-white cursor-pointer hover-lift'}`;
              btn.style.width = '85px';

              btn.innerHTML = `
                     <div class="fw-bold fs-5 lh-1 mb-1 ${isDisabled ? 'text-decoration-line-through' : 'text-dark'}">${tStr}</div>
                     <div class="extra-small text-uppercase fw-bold ${isDisabled ? 'text-muted' : 'text-success'}">${isDisabled ? 'Ocupado' : 'Libre'}</div>
                 `;

              if (!isDisabled) {
                btn.onclick = () => {
                  timeGrid.querySelectorAll('.time-slot-card').forEach(b => {
                    b.classList.remove('border-primary', 'bg-primary-subtle', 'ring-2');
                    b.classList.add('border', 'bg-white');
                  });
                  btn.classList.remove('border', 'bg-white');
                  btn.classList.add('border-primary', 'bg-primary-subtle');

                  timeInput.value = tStr;

                  // [NEW] Update Summary & Resume
                  const dParts = dateInput.value.split('-');
                  const dateObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
                  const dateText = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                  const dateCap = dateText.charAt(0).toUpperCase() + dateText.slice(1);

                  // Update UI Summary
                  const sumDiv = document.getElementById('medi-booking-summary');
                  if (sumDiv) {
                    sumDiv.classList.remove('d-none');
                    document.getElementById('summary-datetime').textContent = `${dateCap} • ${tStr} hrs`;
                  }

                  // Enable Confirm Button
                  const btnConf = document.getElementById('btn-medi-confirm');
                  if (btnConf) {
                    btnConf.disabled = false;
                    // Scroll to bottom subtly
                    sumDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                };
              }
              timeGrid.appendChild(btn);
            });
          }
          msg.classList.add('d-none');
        });
      });
    } if (window.Medi && typeof window.Medi.renderFollowUpBanner === 'function') window.Medi.renderFollowUpBanner(_ctx.user.uid);

    if (!form.dataset.listenerAttached) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (form.dataset.submitting === 'true') return; // [FIX] Prevent double submission

        const submitBtn = form.querySelector('button[type="submit"]');

        if (!dateInput.value || !timeInput.value) {
          showToast('Selecciona fecha y hora', 'warning'); return;
        }

        form.dataset.submitting = 'true';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';

        try {
          const [y, m, d] = dateInput.value.split('-').map(Number);
          const [hh, mm] = timeInput.value.split(':').map(Number);
          const localDate = new Date(y, m - 1, d, hh, mm);
          // [FIX] Generate Type-Specific ID for Booking
          const selectedType = document.getElementById('medi-cita-tipo').value || 'Medico'; // Should match value set by buttons
          const baseSlotId = MediService.slotIdFromDate(localDate);
          const newSlotId = `${baseSlotId}_${selectedType}`;

          // [NEW] STRICT CHECK: One active appointment
          const activeAppt = await MediService.checkActiveAppointment(_ctx, _ctx.user.uid);
          let replaceId = null;

          if (activeAppt) {
            const activeDate = activeAppt.safeDate;
            if (activeDate.getTime() <= localDate.getTime()) {
              throw new Error(`Ya tienes una cita programada para el ${activeDate.toLocaleString()}. Debes asistir o cancelarla antes.`);
            } else {
              // [NEW] Visual Modal for Replace
              const modal = new bootstrap.Modal(document.getElementById('modalConfirmReplace'));
              document.getElementById('replace-old-date').textContent = activeDate.toLocaleString();
              document.getElementById('replace-new-date').textContent = localDate.toLocaleString();

              const confirmBtn = document.getElementById('btn-do-replace');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Confirmar'; // Reset
              form.dataset.submitting = 'false';

              modal.show();

              confirmBtn.onclick = async () => {
                modal.hide();
                // Re-lock
                form.dataset.submitting = 'true';
                submitBtn.disabled = true;
                await executeBooking(localDate, newSlotId, activeAppt.id);
              };
              return;
            }
          }

          // Normal Flow
          await executeBooking(localDate, newSlotId, null);

        } catch (err) {
          showToast(err.message, 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Confirmar';
          form.dataset.submitting = 'false';
        }
      });
      form.dataset.listenerAttached = "true";
    }

    // Independent Executor
    async function executeBooking(localDate, newSlotId, replaceId) {
      const form = document.getElementById('form-medi-nueva-cita'); // re-grab
      const submitBtn = form.querySelector('button[type="submit"]');

      // Ensure state is locked
      form.dataset.submitting = 'true';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Agendando...';

      try {
        // [NEW] Resolve Professional (Strict Logic)
        const tipo = (form.querySelector('#medi-cita-categoria').value === 'Salud Mental') ? 'Psicologo' : 'Medico';

        let profData = await MediService.resolveProfessionalForBooking(_ctx, tipo, localDate);

        // Fallback (should ideally not happen if DB is correct)
        if (!profData) {
          profData = {
            id: null,
            displayName: tipo === 'Psicologo' ? 'Atención Psicopedagógica' : 'Atención Médica',
            email: null,
            profileId: null
          };
        }

        const profId = profData.id;
        const profName = profData.displayName;
        const profProfileId = profData.profileId;

        await MediService.reservarCita(_ctx, {
          user: _ctx.user,
          date: localDate,
          slotId: newSlotId,
          tipo: tipo,
          motivo: `[${form.querySelector('#medi-cita-categoria').value}] ${form.querySelector('#medi-cita-motivo').value}`,
          replaceCitaId: replaceId,
          // Pass resolved info
          profesionalId: profId,
          profesionalName: profName,
          profesionalProfileId: profProfileId
        });

        showToast(replaceId ? '\u00a1Cita actualizada correctamente!' : '\u00a1Cita agendada correctamente!', 'success');

        // Show success state

        const successEl = document.getElementById('medi-booking-success');
        const detailsEl = document.getElementById('medi-success-details');
        if (successEl && detailsEl) {
          const tipo = (form.querySelector('#medi-cita-categoria').value === 'Salud Mental') ? 'Psicolog\u00eda' : 'M\u00e9dico General';
          const dateText = localDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
          const timeText = localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateCap = dateText.charAt(0).toUpperCase() + dateText.slice(1);

          detailsEl.innerHTML = `
              <div class="bg-light rounded-4 p-3 d-inline-block text-start">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-calendar-check text-primary"></i>
                  <span class="fw-bold text-dark small">${dateCap}</span>
                </div>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-clock text-primary"></i>
                  <span class="fw-bold text-dark small">${timeText} hrs</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-${tipo === 'Psicolog\u00eda' ? 'chat-heart' : 'bandaid'} text-primary"></i>
                  <span class="fw-bold text-dark small">${tipo}</span>
                </div>
                ${profId ? `
                <div class="mt-3 pt-3 border-top">
                   <button class="btn btn-primary btn-sm w-100 rounded-pill fw-bold shadow-sm" onclick="Medi.startChatWithProfessional('${profId}', '${profName || 'Profesional'}', '${profProfileId || ''}')">
                      <i class="bi bi-chat-dots-fill me-1"></i>Contactar Ahora
                   </button>
                </div>` : ''}
              </div>
              <div class="mt-2 small text-muted">Estado: <span class="fw-bold text-warning">Pendiente de confirmaci\u00f3n</span></div>`;

          form.classList.add('d-none');
          successEl.classList.remove('d-none'); // Ensure visible

          // [FIX] Scroll to success message to ensure context
          setTimeout(() => {
            successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);

          // [FIX] Immediate Refresh of Dashboard (Banner + Agenda)
          // Listener should handle this automatically. Manual restart caused race conditions.
          // if (typeof loadStudentHistory === 'function') {
          //   loadStudentHistory(_ctx.user.uid);
          // }
        }

        form.reset();
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Confirmar';
      }
    }
  } // End setupAppointmentForm

  // Helper to build slots dynamically (Global Scope Helper)
  function buildSlotsForDate(dateObj) {
    const slots = [];
    const startHour = SLOT_START || 8;
    const endHour = SLOT_END || 22;
    const duration = SLOT_DURATION || 60;

    let curr = new Date(dateObj);
    curr.setHours(startHour, 0, 0, 0);

    const endLimit = new Date(dateObj);
    endLimit.setHours(endHour, 0, 0, 0);

    const now = new Date();

    while (curr < endLimit) {
      if (dateObj.getDate() === now.getDate() && curr < now) {
        // Past time, skip
      } else {
        slots.push(new Date(curr));
      }
      curr.setMinutes(curr.getMinutes() + duration);
    }
    return slots;
  }

  // E2: Load queue position for a pending appointment (async, updates DOM)
  async function _loadQueuePosition(citaId, tipoServicio, citaDate) {
    try {
      const el = document.getElementById('queue-pos-' + citaId);
      if (!el) return;

      // Count pending citas of same type with earlier fechaSolicitud
      const snap = await _ctx.db.collection(C_CITAS)
        .where('estado', '==', 'pendiente')
        .where('tipoServicio', '==', tipoServicio)
        .orderBy('fechaSolicitud', 'asc')
        .get();

      let pos = 1;
      for (const doc of snap.docs) {
        if (doc.id === citaId) break;
        pos++;
      }
      const total = snap.size;
      const estWait = pos * 15; // ~15 min avg per patient

      el.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-primary-subtle text-primary"><i class="bi bi-people-fill me-1"></i>Posicion: #${pos}/${total}</span>
          <span class="badge bg-light text-muted border"><i class="bi bi-clock me-1"></i>~${estWait} min</span>
        </div>`;
    } catch (e) {
      // Silently fail - index might not exist
      console.warn('Queue position unavailable:', e.message);
    }
  }

  function loadStudentHistory(uid) {
    let _lastStates = {}; // [E4] State tracking

    // New Containers for Tabbed Carousel
    const cPend = document.getElementById('carousel-pendientes');
    const cConf = document.getElementById('carousel-confirmadas');
    const cCanc = document.getElementById('carousel-canceladas');

    // Legacy/Existing container for Medical Record
    const expList = document.getElementById('medi-stu-consultas');

    // If critical containers missing, abort (UI not ready)
    if (!cPend || !cConf || !cCanc || !expList) return;

    // [FIX] Listener Management
    if (_unsubs.studentHistory && typeof _unsubs.studentHistory === 'function') {
      _unsubs.studentHistory();
    }

    _unsubs.studentHistory = MediService.streamStudentHistory(_ctx, uid, (items) => {
      // 1. APPOINTMENTS (Citas)
      if (items.type === 'citas') {
        const allCitas = items.data || [];

        // [E4] Real-time State Change Detection
        const newlyConfirmed = new Set();

        allCitas.forEach(c => {
          const oldState = _lastStates[c.id];
          if (oldState && oldState === 'pendiente') {
            if (c.estado === 'confirmada') {
              newlyConfirmed.add(c.id);
              if (window.showToast) showToast(`¡Tu cita ha sido confirmada!`, 'success');
            } else if (c.estado === 'rechazada') {
              if (window.showToast) showToast(`Cita rechazada: ${c.motivoRechazo || ''}`, 'danger');
            }
          }
          _lastStates[c.id] = c.estado;
        });


        // Update global counter (Active interactions)
        const activas = allCitas.filter(c => ['pendiente', 'confirmada'].includes(c.estado));
        const countEl = document.getElementById('cita-count');
        if (countEl) countEl.textContent = activas.length;

        // Categorize
        const pending = allCitas.filter(c => c.estado === 'pendiente');
        const confirmed = allCitas.filter(c => c.estado === 'confirmada');
        const cancelled = allCitas.filter(c => ['cancelada', 'rechazada'].includes(c.estado));

        // NEXT APPOINTMENT BANNER
        const bannerEl = document.getElementById('medi-next-appointment');
        if (bannerEl) {
          const now = new Date();
          const upcoming = activas
            .filter(c => c.safeDate && c.safeDate > now)
            .sort((a, b) => a.safeDate - b.safeDate);

          if (upcoming.length > 0) {
            const next = upcoming[0];
            console.log("[Medi] Next Appointment Data:", next); // DEBUG
            const dateText = next.safeDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeText = next.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateCap = dateText.charAt(0).toUpperCase() + dateText.slice(1);
            const statusBadge = next.estado === 'confirmada'
              ? '<span class="badge bg-success rounded-pill">Confirmada</span>'
              : '<span class="badge bg-warning text-dark rounded-pill">Pendiente</span>';
            const encoded = encodeURIComponent(JSON.stringify(next));

            bannerEl.innerHTML = `
              <div class="medi-next-appt p-3 d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-3">
                <div class="flex-grow-1">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-bell-fill text-primary"></i>
                    <span class="fw-bold small text-primary">Tu pr\u00f3xima cita</span>
                    ${statusBadge}
                  </div>
                  <div class="fw-bold text-dark">${dateCap}</div>
                  <div class="d-flex align-items-center gap-3 text-muted small">
                    <span><i class="bi bi-clock me-1"></i>${timeText}</span>
                    <span><i class="bi bi-${next.tipoServicio === 'Psicologo' ? 'chat-heart' : 'bandaid'} me-1"></i>${next.tipoServicio === 'Psicologo' ? 'Psicolog\u00eda' : 'M\u00e9dico General'}</span>
                  </div>
                </div>
                <div class="d-flex gap-2 flex-shrink-0">
                  ${next.profesionalId ? `
                  <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="Medi.startChatWithProfessional('${next.profesionalId}', '${next.profesionalName || 'Doctor'}', '${next.profesionalProfileId || ''}')">
                    <i class="bi bi-chat-dots me-1"></i>Contactar
                  </button>` : ''}
                  <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="Medi.prepararEdicion('${encoded}')">
                    <i class="bi bi-pencil me-1"></i>Cambiar
                  </button>
                  <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="Medi.solicitarCancelacion('${next.id}')">
                    <i class="bi bi-x-lg me-1"></i>Cancelar
                  </button>
                </div>
              </div>`;
            bannerEl.classList.remove('d-none');
          } else {
            bannerEl.classList.add('d-none');
            bannerEl.innerHTML = '';
          }
        }

        // Helper Render Function
        const renderCarousel = (container, list, type, highlights = new Set()) => {

          if (list.length === 0) {
            container.innerHTML = `
            <div class="text-center w-100 py-4 text-muted small">
              <i class="bi bi-inbox me-2"></i>No hay citas ${type}.
            </div>`;
            return;
          }

          // Limit to 5 for carousel view
          const visible = list.slice(0, 5);
          const hasMore = list.length > 5;

          container.innerHTML = visible.map(c => {
            const fecha = c.safeDate || new Date();
            const dateStr = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
            const encoded = encodeURIComponent(JSON.stringify(c));

            // Card Design based on Type
            if (type === 'pendientes') {
              // E2: Queue position placeholder (async loaded)
              const queueId = 'queue-pos-' + c.id;
              _loadQueuePosition(c.id, c.tipoServicio, c.safeDate);

              return `
              <div class="card border-0 shadow-sm rounded-4 flex-shrink-0 bg-white medi-cita-card" style="width: 280px; scroll-snap-align: start;">
                <div class="card-body p-3">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="bg-warning bg-opacity-10 text-warning px-2 py-1 rounded-3">
                      <i class="bi bi-clock-history me-1"></i><span class="fw-bold small">Pendiente</span>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-light rounded-circle" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                        <ul class="dropdown-menu shadow-sm border-0">
                             <li><a class="dropdown-item small" href="#" onclick="Medi.prepararEdicion('${encoded}')"><i class="bi bi-pencil me-2"></i>Re-agendar</a></li>
                             <li><a class="dropdown-item small text-danger" href="#" onclick="Medi.solicitarCancelacion('${c.id}')"><i class="bi bi-x-circle me-2"></i>Cancelar Solicitud</a></li>
                        </ul>
                    </div>
                  </div>
                  <h5 class="fw-bold text-dark mb-0">${dateStr}</h5>
                  <div class="fs-4 fw-bold text-dark mb-1">${timeStr}</div>
                  <div class="small text-muted mb-1">${c.tipoServicio}</div>
                  <div id="${queueId}" class="mb-2" style="font-size:.75rem;"></div>

                  <div class="d-flex gap-2">
                     <button class="btn btn-light btn-sm flex-fill rounded-pill fw-bold py-1 text-secondary" style="font-size: 0.8rem; background-color: #f8f9fa;" onclick="Medi.prepararEdicion('${encoded}')">
                        <i class="bi bi-pencil me-1"></i>Editar
                     </button>
                     <button class="btn btn-light btn-sm flex-fill rounded-pill fw-bold py-1 text-danger" style="font-size: 0.8rem; background-color: #fff5f5;" onclick="Medi.solicitarCancelacion('${c.id}')">
                        <i class="bi bi-x-lg me-1"></i>Cancelar
                     </button>
                  </div>
                  ${c.profesionalId ? `
                  <button class="btn btn-sm btn-outline-secondary w-100 rounded-pill mt-2 py-1" style="font-size:0.8rem;" onclick="Medi.startChatWithProfessional('${c.profesionalId}', '${c.profesionalName || 'Doctor'}', '${c.profesionalProfileId || ''}')">
                    <i class="bi bi-chat-dots me-1"></i>Contactar
                  </button>` : ''}
                </div>
              </div>`;
            } else if (type === 'confirmadas') {
              const docName = c.profesionalEmail ? c.profesionalEmail.split('@')[0] : 'Especialista';
              const isNew = highlights.has(c.id);
              const animClass = isNew ? 'medi-card-confirmada' : '';
              return `
              <div class="card border-0 shadow-sm rounded-4 flex-shrink-0 medi-cita-card ${animClass}" style="width: 280px; scroll-snap-align: start; background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border-left: 4px solid #198754;">
                <div class="card-body p-3">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-success shadow-sm">Confirmada</span>
                     <button class="btn btn-sm btn-light text-danger rounded-circle shadow-sm" data-bs-toggle="tooltip" title="Cancelar Cita" onclick="Medi.solicitarCancelacion('${c.id}')">
                        <i class="bi bi-x-lg"></i>
                     </button>
                  </div>
                  <h5 class="fw-bold text-dark mb-0">${dateStr}</h5>
                  <div class="display-6 fw-bold text-dark mb-2 lh-1">${timeStr}</div>
                  
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="bg-white rounded-circle p-1 text-success shadow-sm"><i class="bi bi-person-fill"></i></div>
                    <span class="small fw-bold text-success-emphasis text-truncate">Dr(a). ${docName}</span>
                  </div>
                  <div class="small text-muted fst-italic text-truncate mb-2">${c.motivo || 'Consulta General'}</div>
                  
                  <button class="btn btn-sm btn-light w-100 rounded-pill text-success fw-bold" onclick="Medi.startChatWithProfessional('${c.profesionalId}', '${docName}', '${c.profesionalProfileId || ''}')">
                    <i class="bi bi-chat-dots-fill me-1"></i>Mensaje
                  </button>
                </div>
              </div>`;
            } else { // Canceladas
              return `
              <div class="card border-0 shadow-sm rounded-4 flex-shrink-0 medi-cita-card" style="width: 280px; scroll-snap-align: start; background-color: rgba(220, 53, 69, 0.08); border-left: 4px solid #dc3545;">
                <div class="card-body p-3">
                  <div class="d-flex justify-content-between mb-2">
                     <span class="badge bg-danger bg-opacity-75">Cancelada</span>
                     <small class="text-muted fw-bold">${dateStr}</small>
                  </div>
                  <div class="fw-bold text-muted mb-1 text-decoration-line-through fs-5">${timeStr}</div>
                  <div class="small text-danger text-truncate fst-italic"><i class="bi bi-info-circle me-1"></i>${c.motivoCancelacion || 'Sin motivo'}</div>
                </div>
              </div>`;
            }
          }).join('');

          // "View All" Card
          if (hasMore) {
            container.innerHTML += `
               <div class="card border-0 shadow-none bg-transparent flex-shrink-0 d-flex align-items-center justify-content-center" style="width: 100px; scroll-snap-align: start;">
                  <button class="btn btn-outline-primary rounded-circle p-3 shadow-sm hover-scale" onclick="alert('Historial completo disponible próximamente')">
                    <i class="bi bi-arrow-right fs-4"></i>
                  </button>
                  <small class="text-muted mt-2 fw-bold">Ver más</small>
               </div>
             `;
          }
        };

        renderCarousel(cPend, pending, 'pendientes');
        renderCarousel(cConf, confirmed, 'confirmadas', newlyConfirmed);

        renderCarousel(cCanc, cancelled, 'canceladas');
      }

      // 2. MEDICAL RECORDS (Expedientes) - Keep vertical list
      if (items.type === 'expedientes') {
        // [NEW] Store for full history modal
        _lastConsultasFull = items.data || [];

        // E3: Check for follow-up recommendations
        _renderFollowUpBanner(items.data);

        if (items.data.length === 0) {
          expList.innerHTML = '<div class="text-center p-4 text-muted small"><i class="bi bi-folder2-open d-block fs-2 mb-2"></i>Tu expediente está vacío.</div>';
        } else {
          // [MOD] Show only last 3
          const visible = items.data.slice(0, 3);
          const hiddenCount = items.data.length - 3;

          let html = visible.map(e => `
              <div class="card mb-2 border-0 shadow-sm border-start border-3 border-info card-hover-effect">
                 <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                       <span class="fw-bold text-primary small">${e.safeDate ? e.safeDate.toLocaleDateString() : '-'}</span>
                       <span class="badge bg-light text-dark border-0 shadow-none" style="font-size: 0.65rem;">${e.tipoServicio}</span>
                    </div>
                    <div class="small text-dark fw-bold text-truncate">${e.diagnostico || 'Consulta general'}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-light">
                       <div class="text-muted extra-small text-truncate" style="max-width: 70%;">${e.plan || 'Sin indicaciones...'}</div>
                       <button class="btn btn-xs btn-outline-primary rounded-pill py-0 px-2 fw-bold" 
                               style="font-size: 0.65rem;"
                               onclick="Medi.showConsultationDetails('${encodeURIComponent(JSON.stringify(e))}')">
                          Ver más <i class="bi bi-chevron-right ms-1"></i>
                       </button>
                    </div>
                 </div>
              </div>
            `).join('');

          if (hiddenCount > 0) {
            html += `
                <div class="text-center mt-2">
                    <button class="btn btn-sm btn-link text-decoration-none fw-bold" onclick="Medi.showFullHistory()">
                        Ver historial completo (${hiddenCount} más) <i class="bi bi-arrow-right"></i>
                    </button>
                </div>`;
          }

          expList.innerHTML = html;
        } // else
      } // if (expedientes)
    }); // callback
  } // function



  // E3: Render follow-up banner for student
  function _renderFollowUpBanner(expedientes) {
    const banner = document.getElementById('medi-followup-banner');
    if (!banner) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find most recent consultation with followUp.required
    const withFollowUp = (expedientes || []).filter(e => e.followUp && e.followUp.required);
    if (withFollowUp.length === 0) { banner.classList.add('d-none'); return; }

    const latest = withFollowUp[0]; // Already sorted newest first
    const fDate = latest.followUp.date ? new Date(latest.followUp.date) : null;
    const isOverdue = fDate && fDate < today;
    const dateStr = fDate ? fDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : 'pronto';

    const bgClass = isOverdue ? 'bg-danger-subtle border-danger' : 'bg-warning-subtle border-warning';
    const iconClass = isOverdue ? 'bi-exclamation-triangle-fill text-danger' : 'bi-calendar-check text-warning';
    const label = isOverdue ? 'Seguimiento pendiente vencido' : 'Seguimiento recomendado';

    banner.innerHTML = `
      <div class="${bgClass} border rounded-4 p-3">
        <div class="d-flex align-items-center gap-3">
          <i class="bi ${iconClass} fs-4"></i>
          <div class="flex-grow-1">
            <div class="fw-bold small text-dark">${label}</div>
            <div class="text-muted" style="font-size:.75rem;">
              Tu profesional recomendo seguimiento para el <strong>${dateStr}</strong>.
              ${latest.followUp.notes ? '<br>' + escapeHtml(latest.followUp.notes) : ''}
            </div>
          </div>
          <button class="btn btn-sm ${isOverdue ? 'btn-danger' : 'btn-warning'} rounded-pill px-3 fw-bold flex-shrink-0" onclick="document.getElementById('medi-booking-section')?.scrollIntoView({behavior:'smooth'})">
            <i class="bi bi-calendar-plus me-1"></i>Agendar
          </button>
        </div>
      </div>`;
    banner.classList.remove('d-none');
  }

  function loadWellnessFeed() {
    const container = document.getElementById('medi-wellness-tips');
    if (!container) return;

    const tips = [
      { icon: 'cup-hot', title: 'Hidrataci\u00f3n', text: 'Bebe al menos 2L de agua al d\u00eda para mantener tu rendimiento acad\u00e9mico.', color: 'info' },
      { icon: 'brightness-high', title: 'Descanso', text: 'Dormir 7-8 horas mejora tu memoria y reduce el estr\u00e9s.', color: 'warning' },
      { icon: 'apple', title: 'Nutrici\u00f3n', text: 'Come frutas y verduras. Evita el exceso de comida chatarra.', color: 'success' },
      { icon: 'activity', title: 'Actividad', text: 'Camina 30 mins al d\u00eda. \u00a1Usa las canchas del tec!', color: 'danger' },
      { icon: 'eye', title: 'Vista', text: 'Cada 20 min de pantalla, mira 20 seg algo a 20 pies de distancia.', color: 'primary' },
      { icon: 'emoji-smile', title: 'Bienestar', text: 'Si sientes ansiedad o estr\u00e9s, no dudes en agendar con psicolog\u00eda.', color: 'primary' }
    ];

    // Show 3 random tips
    const shuffled = tips.sort(() => 0.5 - Math.random()).slice(0, 3);

    container.innerHTML = shuffled.map(t => `
        <div class="d-flex align-items-start gap-3 p-2 mb-2 border rounded-3 bg-white shadow-sm">
             <div class="bg-${t.color} bg-opacity-10 p-2 rounded-3 text-${t.color} flex-shrink-0">
               <i class="bi bi-${t.icon}"></i>
             </div>
             <div>
                <div class="fw-bold small text-dark">${t.title}</div>
                <p class="text-muted mb-0" style="font-size: 0.75rem;">${t.text}</p>
             </div>
        </div>
      `).join('');
  }

  function showFullHistory() {
    // Re-use logic or fetch again? 
    // We can use the same stream data if we store it, or just use the DOM logic?
    // Better: Show a simple modal with the full list.
    // Since we don't have the full list in a variable easily accessible without dirty global scopes,
    // let's grab it from the stream callback if we had stored it.
    // Alternative: The stream callback updates the UI.
    // Let's modify the stream callback to store 'allCitas' or 'allExpedientes' in a module-level variable.

    // For now, let's assume we can fetch it or we change the UI to "Expanded Mode".
    // Simplest: Change the CSS/DOM to unhide the hidden items? 
    // But we sliced them.

    // OK, let's make the stream callback store the data in _lastConsultasFull

    if (!_lastConsultasFull || _lastConsultasFull.length === 0) return;

    const html = _lastConsultasFull.map(e => `
            <div class="list-group-item border-0 border-bottom p-3">
               <div class="d-flex justify-content-between align-items-start mb-1">
                  <span class="fw-bold text-primary small">${e.safeDate ? e.safeDate.toLocaleDateString() : '-'}</span>
                  <span class="badge bg-light text-dark border-0 shadow-none" style="font-size: 0.65rem;">${e.tipoServicio}</span>
               </div>
               <div class="small text-dark fw-bold">${e.diagnostico || 'Consulta general'}</div>
               <div class="text-muted extra-small mt-1">${e.plan || 'Sin indicaciones...'}</div>
               <div class="text-end mt-2">
                   <button class="btn btn-xs btn-outline-primary rounded-pill py-0 px-2 fw-bold" 
                           onclick="bootstrap.Modal.getInstance(document.getElementById('modalFullHistory')).hide(); Medi.showConsultationDetails('${encodeURIComponent(JSON.stringify(e))}')">
                      Ver detalle
                   </button>
               </div>
            </div>
      `).join('');

    // Create modal on the fly if not exists
    let modal = document.getElementById('modalFullHistory');
    if (!modal) {
      const d = document.createElement('div');
      d.innerHTML = `
            <div class="modal fade" id="modalFullHistory" tabindex="-1">
              <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                  <div class="modal-header border-0 pb-0">
                    <h5 class="fw-bold">Historial Completo</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                  </div>
                  <div class="modal-body p-0">
                     <div class="list-group list-group-flush" id="full-history-list"></div>
                  </div>
                </div>
              </div>
            </div>`;
      document.body.appendChild(d.firstElementChild);
      modal = document.getElementById('modalFullHistory');
    }

    document.getElementById('full-history-list').innerHTML = html;
    new bootstrap.Modal(modal).show();
  }
  let _lastConsultasFull = [];


  // --- E1: STUDENT CHAT UI ---
  function renderStudentChat(uid, name) {
    if (!window.MediChatService) return;

    // 1. Inject Floating Button
    if (!document.getElementById('medi-chat-float-btn')) {
      const btn = document.createElement('div');
      btn.id = 'medi-chat-float-btn';
      // [FIX] Increased bottom margin/position to avoid Mobile Navbar overlap (approx 60-80px)
      // Was: bottom-0 m-4 (~24px). Now: bottom-0 style="bottom: 80px; right: 20px;"
      btn.className = 'position-fixed';
      btn.style.bottom = '90px'; // Clear standard navbar
      btn.style.right = '20px';
      btn.style.zIndex = '2000';
      btn.innerHTML = `
        <button class="btn btn-primary rounded-circle shadow-lg d-flex align-items-center justify-content-center position-relative" style="width: 60px; height: 60px;" onclick="Medi.toggleStudentChat()">
            <i class="bi bi-chat-dots-fill fs-4"></i>
            <span id="stu-chat-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light d-none">
                0
            </span>
        </button>
      `;
      document.body.appendChild(btn);
    }

    // 2. Inject Chat Modal/Panel
    if (!document.getElementById('medi-student-chat-panel')) {
      const panel = document.createElement('div');
      panel.id = 'medi-student-chat-panel';
      // [FIX] Adjusted position to match button and ensure height fits viewport
      panel.className = 'position-fixed bg-white shadow-lg rounded-4 d-none overflow-hidden d-flex flex-column';
      panel.style.bottom = '100px'; // Above the button slightly or same level
      panel.style.right = '20px';
      panel.style.width = '350px';
      // Responsive height: max 70vh to ensure keyboard doesn't hide input on mobile
      panel.style.height = 'auto'; // Let flex grow
      panel.style.maxHeight = '65vh'; // Safety limit
      panel.style.minHeight = '400px';
      panel.style.zIndex = '2001'; // Above detail modal and everything

      panel.innerHTML = `
        <div class="bg-primary text-white p-3 d-flex justify-content-between align-items-center flex-shrink-0">
            <div class="fw-bold"><i class="bi bi-chat-dots me-2"></i>Mis Mensajes</div>
            <button class="btn btn-sm btn-link text-white p-0" onclick="Medi.toggleStudentChat()"><i class="bi bi-x-lg"></i></button>
        </div>
            
            <!-- List View -->
            <div id="stu-chat-list" class="flex-grow-1 overflow-auto p-2">
                <div class="text-center py-5 text-muted small"><span class="spinner-border spinner-border-sm"></span></div>
            </div>

            <!-- Thread View (Hidden by default) -->
  <div id="stu-chat-thread" class="flex-grow-1 d-none d-flex flex-column h-100 bg-white position-absolute top-0 start-0 w-100" style="z-index:2;">
    <div class="bg-light border-bottom p-2 d-flex align-items-center gap-2 flex-shrink-0">
      <button class="btn btn-sm btn-light rounded-circle" onclick="document.getElementById('stu-chat-thread').classList.add('d-none')"><i class="bi bi-arrow-left"></i></button>
      <div class="fw-bold text-truncate small flex-grow-1" id="stu-chat-pro-name">Profesional</div>
    </div>
    <div id="stu-chat-msgs" class="flex-grow-1 overflow-auto p-2 bg-light bg-opacity-10"></div>
    <div class="p-2 border-top bg-white">
      <div class="input-group input-group-sm">
        <input type="text" id="stu-chat-input" class="form-control rounded-pill" placeholder="Escribe un mensaje..." onkeypress="if(event.key==='Enter')Medi.sendStudentMessage()">
          <button class="btn btn-primary rounded-circle ms-1" onclick="Medi.sendStudentMessage()" style="width:30px;height:30px;padding:0;"><i class="bi bi-send-fill" style="font-size:0.7rem"></i></button>
      </div>
    </div>
  </div>
`;
      document.body.appendChild(panel);
    }

    // 3. Subscription for Unread & List
    MediChatService.streamConversations(_ctx, uid, 'student', null, (convs) => {
      _renderStudentConvList(convs);

      // Update total unread
      const total = convs.reduce((acc, c) => acc + (c.unreadByStudent || 0), 0);
      const badge = document.getElementById('stu-chat-badge');
      if (badge) {
        badge.textContent = total;
        badge.classList.toggle('d-none', total === 0);
      }
    });
  }

  function _renderStudentConvList(convs) {
    const list = document.getElementById('stu-chat-list');
    if (!list) return;

    if (convs.length === 0) {
      list.innerHTML = `<div class="text-center py-5 text-muted small px-3">
          <i class="bi bi-chat-square-text display-4 opacity-25 mb-3 d-block"></i>
          Aún no tienes mensajes.<br> Inicia un chat desde tus citas o espera a que te contacten.
        </div>`;
      return;
    }

    list.innerHTML = convs.map(c => {
      const unread = c.unreadByStudent || 0;
      const time = c.lastMessageAt ? (typeof c.lastMessageAt.toDate === 'function' ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)) : null;
      const timeStr = time ? time.toLocaleDateString() : '';

      return `
        <div class="card border-0 shadow-sm mb-2 cursor-pointer hover-bg-light transition-all" onclick="Medi.openStudentThread('${c.id}', '${escapeHtml(c.profesionalName)}', '${c.profesionalId}')">
            <div class="card-body p-2 d-flex align-items-center gap-2">
            <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0" style="width:40px;height:40px;">
                ${(c.profesionalName || 'P')[0]}
            </div>
            <div class="flex-grow-1" style="min-width:0;">
                <div class="d-flex justify-content-between align-items-start">
                <h6 class="mb-0 fw-bold small text-truncate">${escapeHtml(c.profesionalName)}</h6>
                <small class="text-muted" style="font-size:0.6rem;">${timeStr}</small>
                </div>
                <div class="d-flex justify-content-between align-items-end mt-1">
                <div class="text-muted text-truncate small" style="max-width: 160px; font-size: 0.75rem;">${escapeHtml(c.lastMessage || '...')}</div>
                ${unread > 0 ? `<span class="badge bg-danger rounded-pill" style="font-size:0.6rem;">${unread}</span>` : ''}
                </div>
            </div>
            </div>
        </div>
  `;
    }).join('');
  }

  let _activeStudentConvId = null;
  let _stuMsgsUnsub = null;

  function toggleStudentChat() {
    const panel = document.getElementById('medi-student-chat-panel');
    if (panel) panel.classList.toggle('d-none');
  }

  function openStudentThread(convId, proName, proId) {
    _activeStudentConvId = convId;
    document.getElementById('stu-chat-pro-name').textContent = proName;
    document.getElementById('stu-chat-thread').classList.remove('d-none');

    // Subscribe to messages
    if (_stuMsgsUnsub) _stuMsgsUnsub();
    _stuMsgsUnsub = MediChatService.streamMessages(_ctx, convId, (msgs) => {
      const container = document.getElementById('stu-chat-msgs');
      if (!container) return;

      container.innerHTML = msgs.map(m => {
        const isMe = m.senderRole === 'student';
        const time = m.createdAt ? (typeof m.createdAt.toDate === 'function' ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
        return `
  < div class="d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'} mb-2" >
    <div class="px-3 py-2 rounded-4 ${isMe ? 'bg-primary text-white rounded-bottom-end-0' : 'bg-white shadow-sm border rounded-bottom-start-0'}"
      style="max-width:85%; font-size: 0.85rem;">
      <div>${escapeHtml(m.text)}</div>
      <div class="${isMe ? 'text-white-50' : 'text-muted'} text-end" style="font-size:0.6rem;">${time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
    </div>
                </div >
  `;
      }).join('');
      container.scrollTop = container.scrollHeight;
    });

    MediChatService.markAsRead(_ctx, convId, 'student');
  }

  async function sendStudentMessage() {
    const input = document.getElementById('stu-chat-input');
    const text = input.value.trim();
    if (!text || !_activeStudentConvId) return;

    input.value = '';
    const name = _ctx.profile.displayName || _ctx.user.email;

    try {
      await MediChatService.sendMessage(_ctx, _activeStudentConvId, _ctx.user.uid, name, 'student', text);
    } catch (e) {
      console.error(e);
      showToast('Error al enviar', 'danger');
    }
  }

  async function startChatWithProfessional(profId, profName, profileIdOverride = null) {
    if (!window.MediChatService) return;

    // Open panel first
    const panel = document.getElementById('medi-student-chat-panel');
    if (panel && panel.classList.contains('d-none')) panel.classList.remove('d-none');

    try {
      const student = _ctx.user;
      // [FIX] Use profileIdOverride if provided to enforce distinct conversations (e.g. Medico vs Psicologo)
      // even if they share the same Admin UID.
      const targetProfileId = profileIdOverride || profId;

      const conv = await MediChatService.getOrCreateConversation(
        _ctx,
        student.uid,
        student.displayName || student.email,
        profId, // profesionalId (User ID)
        profName,
        'student',
        targetProfileId // [FIX] Pass as profileId too
      );
      openStudentThread(conv.id, profName, profId);
    } catch (e) {
      console.error("Error starting chat:", e);
      showToast("Error al iniciar chat", "danger");
    }
  }

  // [NEW] Recent Activity Renderer
  function _loadRecentActivity() {
    const list = document.getElementById('medi-recent-list');
    if (!list) return;

    const profId = _currentProfile ? _currentProfile.id : null;
    const uid = _myUid;

    // Unsubscribe previous if exists? (Not tracking strict unsubs for this one yet, assuming refresh)
    // Ideally add to _unsubs

    MediService.streamRecentActivity(_ctx, _myRole, uid, profId, 10, (docs) => {
      if (docs.length === 0) {
        list.innerHTML = '<div class="text-center py-4 text-muted small opacity-50">Sin actividad reciente</div>';
        return;
      }

      list.innerHTML = docs.map(d => {
        const time = d.safeDate ? d.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
        const date = d.safeDate ? d.safeDate.toLocaleDateString() : '--';
        const statusColor = d.estado === 'finalizada' ? 'success' : (d.estado === 'borrador' ? 'warning' : 'secondary');

        return `
  < div class="list-group-item list-group-item-action border-0 mb-1 rounded-3 px-3 py-2 cursor-pointer" onclick = "Medi.showConsultationDetails('${encodeURIComponent(JSON.stringify(d))}')" >
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <h6 class="mb-0 small fw-bold text-truncate" style="max-width: 180px;">${d.patientName}</h6>
                    <small class="text-muted" style="font-size:0.65rem;">${date} ${time}</small>
                </div>
                <div class="d-flex w-100 justify-content-between align-items-end mt-1">
                    <span class="badge text-${statusColor} bg-${statusColor}-subtle border border-${statusColor} rounded-pill px-2" style="font-size:0.6rem;">
                        ${d.estado.toUpperCase()}
                    </span>
                    <small class="text-muted extra-small">${d.tipoServicio || ''}</small>
                </div>
            </div > `;
      }).join('');
    });
  }

  // Admin Helper
  async function startChatWithStudent(studentUid, studentName) {
    if (!window.MediChatService) return;

    try {
      let profId = _currentProfile ? _currentProfile.id : _myUid;
      const profName = _currentProfile ? _currentProfile.displayName : (_ctx.user.displayName || 'Profesional');

      // [FIX] Admin Context Alignment
      // If we are operating as 'Medico' or 'Psicologo' but distinct from the base user ID context,
      // we must use the Composite Profile ID to match what the Student sees.
      // E.g. If I am 'Medico', I should use 'UID_Medico' as my profileId if I don't have a specific Shift Profile.
      // This ensures the student sees 'Atención Médica' chat, not 'Admin' chat.

      let profileContextId = _currentProfile ? _currentProfile.id : null;

      if (!profileContextId && (_myRole === 'Medico' || _myRole === 'Psicologo')) {
        profileContextId = `${_myUid}_${_myRole} `;
        profId = _myUid; // Keep original UID as owner
      }

      const conv = await MediChatService.getOrCreateConversation(
        _ctx,
        profId,
        profName,
        studentUid,
        studentName,
        'profesional', // My Role
        profileContextId // Profile Context (Real or Composite)
      );

      // Force UI Switch
      const tab = document.getElementById('medi-tab-messages');
      if (tab) tab.classList.remove('d-none');
      _switchContextTab('messages');

      // Ensure the chat list is visible (it might be hidden by conversation view)
      const list = document.getElementById('medi-chat-list');
      const panel = document.getElementById('medi-chat-conversation');
      // Reset state so openAdminConversation transitions cleanly
      if (list) list.classList.remove('d-none');
      if (panel) panel.classList.add('d-none');

      // Use requestAnimationFrame to ensure DOM paint/layout update before opening
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log(`[Medi] Opening admin conversation for ${studentName}(convId: ${conv.id})`);
          openConversation(conv.id, studentName);
        });
      });

    } catch (e) {
      console.error("Error starting chat with student:", e);
      showToast("Error al iniciar chat", "danger");
    }
  }


  // --- RECENT ACTIVITY MODALS ---

  // 1. Show All Recent (Modal with Filters)
  let _recentUnsub = null;
  let _recentFilter = 'all'; // all, registered, anonymous

  function showAllRecentModal() {
    const modalId = 'modalAllRecent';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const html = `
  < div class= "modal fade" id = "${modalId}" tabindex = "-1" aria - hidden="true" >
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
      <div class="modal-content rounded-4 border-0 shadow-lg">
        <div class="modal-header border-bottom-0 pb-0">
          <div>
            <h5 class="modal-title fw-bold text-dark mb-0"><i class="bi bi-clock-history text-primary me-2"></i>Historial Reciente</h5>
            <p class="text-muted small mb-0">Consultas finalizadas</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>

        <div class="modal-body p-0">
          <!-- Filtros -->
          <div class="px-4 py-3 bg-light border-bottom sticky-top" style="z-index:1020;">
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-dark rounded-pill px-3 fw-bold filter-btn active" onclick="Medi._setRecentFilter('all', this)">Todas</button>
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold filter-btn" onclick="Medi._setRecentFilter('registered', this)">Registradas</button>
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold filter-btn" onclick="Medi._setRecentFilter('anonymous', this)">Anónimas</button>
            </div>
          </div>

          <!-- Lista -->
          <div id="all-recent-list" class="list-group list-group-flush p-2">
            <div class="text-center py-5"><span class="spinner-border text-primary"></span></div>
          </div>
        </div>
      </div>
    </div>
      </div >
  `;

    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.appendChild(d.firstElementChild);

    const m = new bootstrap.Modal(document.getElementById(modalId));
    m.show();

    // Initial Load
    _loadAllRecentItems();

    // Cleanup on hide
    document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
      if (_recentUnsub) _recentUnsub();
      document.getElementById(modalId).remove();
    });
  }

  function _setRecentFilter(type, btn) {
    _recentFilter = type;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.remove('btn-dark', 'active', 'text-white');
      b.classList.add('btn-outline-secondary');
    });
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('btn-dark', 'active', 'text-white');

    _loadAllRecentItems();
  }

  function _loadAllRecentItems() {
    const list = document.getElementById('all-recent-list');
    if (!list) return;

    list.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-primary spinner-border-sm"></span> Cargando...</div>';

    if (_recentUnsub) _recentUnsub();

    const profId = _currentProfile ? _currentProfile.id : null;
    const uidToUse = _myUid || _ctx.user.uid;

    // Fetch 50 items
    _recentUnsub = MediService.streamRecentConsultations(_ctx, _myRole, uidToUse, profId, 50, (docs) => {
      if (!document.getElementById('all-recent-list')) return;

      let filtered = docs;
      if (_recentFilter === 'registered') {
        filtered = docs.filter(d => !d.uid || !d.uid.startsWith('anon_'));
      } else if (_recentFilter === 'anonymous') {
        filtered = docs.filter(d => d.uid && d.uid.startsWith('anon_'));
      }

      if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted small fst-italic">No se encontraron consultas con este filtro.</div>';
        return;
      }

      list.innerHTML = filtered.map(c => {
        const fecha = c.safeDate || new Date();
        const dateStr = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const encoded = encodeURIComponent(JSON.stringify(c));
        const isAnon = c.uid && c.uid.startsWith('anon_');

        return `
  < div class="list-group-item list-group-item-action border-0 border-bottom p-3 rounded-3 mb-1 cursor-pointer hover-shadow transition-all"
onclick = "Medi.showConsultationQuickDetail('${encoded}')" >
                    <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                        <div class="d-flex align-items-center gap-2">
                             <span class="badge ${isAnon ? 'bg-warning text-dark' : 'bg-success-subtle text-success'} rounded-pill" style="font-size:0.6rem;">
                                ${isAnon ? 'ANÓNIMO' : 'REGISTRADO'}
                             </span>
                             <h6 class="mb-0 fw-bold text-dark">${escapeHtml(c.patientName || c.studentEmail || 'Estudiante')}</h6>
                        </div>
                        <small class="text-muted fw-bold" style="font-size:0.7rem;">${dateStr} ${timeStr}</small>
                    </div>
                    <div class="d-flex justify-content-between align-items-end">
                        <div class="text-muted small text-truncate" style="max-width: 70%;">
                            <span class="fw-bold text-primary">${escapeHtml(c.diagnostico || 'Consulta General')}</span>
                            <span class="mx-1">•</span>
                            ${escapeHtml(c.subjetivo || c.motivo || 'Sin detalles...')}
                        </div>
                        <button class="btn btn-sm btn-light rounded-pill text-primary fw-bold" style="font-size:0.75rem;">
                            Ver Detalle <i class="bi bi-chevron-right ms-1"></i>
                        </button>
                    </div>
                </div >
  `;
      }).join('');
    });
  }

  // 2. Quick Detail Modal
  function showConsultationQuickDetail(encoded) {
    try {
      console.log("[QuickDetail] Opening...");
      const c = JSON.parse(decodeURIComponent(encoded));
      const modalId = 'modalQuickDetail';

      // 1. Dispose existing instance properly
      const existingEl = document.getElementById(modalId);
      if (existingEl) {
        const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
        if (bs && bs.Modal) {
          const instance = bs.Modal.getInstance(existingEl);
          if (instance) instance.dispose();
        }
        existingEl.remove();
      }

      const fecha = c.safeDate || new Date();
      const dateStr = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isAnon = c.uid && c.uid.startsWith('anon_');

      // 2. Build HTML without leading/trailing whitespace issues
      let html = `
    <div class="modal fade" id="${modalId}" tabindex="-1" style="z-index: 1065;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <div>
              <span class="badge ${isAnon ? 'bg-warning text-dark' : 'bg-success-subtle text-success'} mb-2 border">
                ${isAnon ? 'PACIENTE ANÓNIMO' : 'ALUMNO REGISTRADO'}
              </span>
              <h5 class="modal-title fw-bold text-dark">Detalle de Consulta</h5>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <!-- Header Info -->
            <div class="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded-3 border">
              <div class="rounded-circle bg-white shadow-sm d-flex align-items-center justify-content-center text-primary fw-bold fs-4" style="width:50px; height:50px;">
                ${(c.patientName || 'E')[0].toUpperCase()}
              </div>
              <div>
                <h6 class="fw-bold text-dark mb-0">${escapeHtml(c.patientName || c.studentEmail)}</h6>
                <div class="small text-muted">${dateStr} • ${timeStr}</div>
              </div>
            </div>

            <!-- Clinical Data -->
            <div class="mb-3">
              <label class="d-block extra-small text-muted fw-bold mb-1">MOTIVO / DIAGNÓSTICO</label>
              <div class="fw-bold text-dark fs-5">${escapeHtml(c.diagnostico || c.motivo || 'No registrado')}</div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-6">
                <div class="p-2 border rounded bg-white">
                  <label class="d-block extra-small text-muted fw-bold">SUBJETIVO</label>
                  <div class="small text-dark text-truncate">${escapeHtml(c.subjetivo || '--')}</div>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 border rounded bg-white">
                  <label class="d-block extra-small text-muted fw-bold">PLAN / TRAT.</label>
                  <div class="small text-dark text-truncate">${escapeHtml(c.plan || c.meds || '--')}</div>
                </div>
              </div>
            </div>

            ${c.signos ? `
                      <div class="d-flex gap-2 justify-content-between text-center bg-light-subtle p-2 rounded border mb-4">
                          <div><small class="d-block extra-small text-muted fw-bold">TEMP</small><span class="fw-bold small">${c.signos.temp || '--'}</span></div>
                          <div><small class="d-block extra-small text-muted fw-bold">PRESION</small><span class="fw-bold small">${c.signos.presion || '--'}</span></div>
                          <div><small class="d-block extra-small text-muted fw-bold">PESO</small><span class="fw-bold small">${c.signos.peso || '--'}</span></div>
                      </div>` : ''}

            <!-- Actions -->
            <div class="d-grid gap-2">
              ${!isAnon ? `
                          <button class="btn btn-primary rounded-pill fw-bold shadow-sm" onclick="Medi.showFullRecord('${c.studentId || c.uid}'); bootstrap.Modal.getInstance(document.getElementById('${modalId}')).hide();">
                              <i class="bi bi-folder2-open me-2"></i> Ver Expediente Completo
                          </button>` : ''}

              <button class="btn btn-outline-secondary rounded-pill fw-bold" onclick="Medi.renderConsultationDetail(null, '${encoded}'); bootstrap.Modal.getInstance(document.getElementById('${modalId}')).hide(); Medi.showFullRecord('${c.studentId || c.uid}');">
                <i class="bi bi-file-text me-2"></i> Ver Nota Completa
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>`;

      // 3. Insert into DOM safely
      document.body.insertAdjacentHTML('beforeend', html);

      // 4. Initialize Modal with Delay to prevent 'backdrop' error
      setTimeout(() => {
        const modalEl = document.getElementById(modalId);
        if (modalEl) {
          const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
          if (bs && bs.Modal) {
            const modal = new bs.Modal(modalEl, {
              backdrop: true,
              keyboard: true,
              focus: true
            });
            modal.show();
          } else {
            console.error("[QuickDetail] Bootstrap not found");
          }
        } else {
          console.error("[QuickDetail] Modal element not found after insert");
        }
      }, 50);

    } catch (err) {
      console.error("Error showing quick detail:", err);
      showToast("Error al abrir detalle rápido", "danger");
    }
  }



  return {
    initStudent,
    _switchWorkTab,
    _switchContextTab,
    _selectWaitingPatient,
    showAdminConfigModal,
    openManualBooking,
    searchStudentForBooking,
    confirmAdminBooking,
    renderAdminBookingDates,
    selectAdminDate,
    selectAdminTime,
    cancelarEdicionTarjeta,
    showFullHistory,
    renderStudentChat,
    toggleStudentChat,
    openStudentThread,
    sendStudentMessage,
    startChatWithProfessional,
    startChatWithStudent,
    showAllRecentModal,
    showConsultationQuickDetail,
    saveState,
    restoreState
  };


  function saveState() {
    const state = {
      timestamp: Date.now(),
      formData: {},
      selectedValues: {},
      scrollPosition: window.pageYOffset || document.documentElement.scrollTop
    };

    const forms = [
      'form-medi-nueva-cita',
      'form-medi-consulta',
      'form-buscar-paciente'
    ];

    forms.forEach(formId => {
      const form = document.getElementById(formId);
      if (form) {
        const formData = new FormData(form);
        state.formData[formId] = {};
        for (let [key, value] of formData.entries()) {
          state.formData[formId][key] = value;
        }
      }
    });

    // Guardar selecciones de fecha/hora (inputs hidden)
    const dateInput = document.getElementById('medi-cita-fecha');
    const timeInput = document.getElementById('medi-cita-hora');
    if (dateInput) state.selectedValues.date = dateInput.value;
    if (timeInput) state.selectedValues.time = timeInput.value;

    // Guardar tab activo si hay pestañas
    const activeTab = document.querySelector('#medi-citas-tabs .nav-link.active');
    if (activeTab) {
      state.activeTab = activeTab.getAttribute('data-bs-target');
    }

    // Guardar qué sección está visible
    const sections = ['medi-student', 'medi-medico', 'medi-psicologo', 'medi-admin'];
    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section && !section.classList.contains('d-none')) {
        state.activeSection = sectionId;
      }
    });

    console.log('[Medi] Estado guardado:', state);
    return state;
  }

  /**
   * Restaura el estado previo del módulo
   * @param {object} state - Estado previamente guardado
   */

  function restoreState(state) {
    if (!state) return;

    console.log('[Medi] Restaurando estado:', state);

    // Restaurar valores de formularios
    if (state.formData) {
      Object.keys(state.formData).forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
          Object.keys(state.formData[formId]).forEach(fieldName => {
            const field = form.elements[fieldName];
            if (field) {
              field.value = state.formData[formId][fieldName];
            }
          });
        }
      });
    }

    // Restaurar selecciones de fecha/hora
    if (state.selectedValues) {
      const dateInput = document.getElementById('medi-cita-fecha');
      const timeInput = document.getElementById('medi-cita-hora');

      if (dateInput && state.selectedValues.date) {
        dateInput.value = state.selectedValues.date;

        // Re-trigger date selection to load time slots
        const dateBtn = document.querySelector(`[data - date="${state.selectedValues.date}"]`);
        if (dateBtn) {
          setTimeout(() => dateBtn.click(), 100);
        }
      }

      if (timeInput && state.selectedValues.time) {
        timeInput.value = state.selectedValues.time;

        // Re-select time slot visually
        setTimeout(() => {
          const timeBtn = document.querySelector(`[data - time= "${state.selectedValues.time}"]`);
          if (timeBtn) timeBtn.click();
        }, 200);
      }
    }

    // Restaurar tab activo
    if (state.activeTab) {
      const tabButton = document.querySelector(`[data - bs - target= "${state.activeTab}"]`);
      if (tabButton) {
        setTimeout(() => {
          const tab = new bootstrap.Tab(tabButton);
          tab.show();
        }, 300);
      }
    }

    // Restaurar scroll position (inmediato + con delay para asegurar)
    if (state.scrollPosition) {
      // Restauración inmediata
      window.scrollTo(0, state.scrollPosition);
      document.documentElement.scrollTop = state.scrollPosition;
      document.body.scrollTop = state.scrollPosition;

      // Backup después del render (por si el DOM aún no está listo)
      requestAnimationFrame(() => {
        window.scrollTo(0, state.scrollPosition);
      });

      // Final backup después de que se carguen tabs/contenido dinámico
      setTimeout(() => {
        window.scrollTo(0, state.scrollPosition);
      }, 150);
    }

    console.log('[Medi] Estado restaurado exitosamente');
  }

})();

window.Medi = Medi;
console.log("[Medi] Module Loaded & Globalized");
