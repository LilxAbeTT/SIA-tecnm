// modules/admin.medi.js
// Sistema Profesional de Gestión Médica (v4.0 - Admin Context)

var AdminMedi = (function () {
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
        <button class="btn btn-sm btn-primary rounded-pill fw-bold" onclick="AdminMedi.startWalkIn('${encodeURIComponent(JSON.stringify(student))}')">
            <i class="bi bi-lightning-charge-fill me-1"></i>Atender Ahora
        </button>
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-dark flex-fill rounded-pill fw-bold" onclick="AdminMedi.showFullRecord('${student.id || student.uid}')">
              <i class="bi bi-folder2-open me-1"></i>Expediente
            </button>
            <button class="btn btn-sm btn-outline-primary flex-fill rounded-pill" onclick="AdminMedi.openManualBooking('book','${encodeURIComponent(JSON.stringify(student))}')" title="Reservar Cita">
              <i class="bi bi-calendar-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary flex-fill rounded-pill" onclick="AdminMedi.startChatWithStudent('${student.id || student.uid}', '${escapeHtml(student.displayName || student.email)}')">
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

      /* ── Agenda del Día: card por cita ── */
      .medi-agenda-card {
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,.07);
        margin-bottom: 10px;
        border-left: 4px solid #dee2e6;
        transition: transform .15s ease, box-shadow .15s ease;
        overflow: hidden;
      }
      .medi-agenda-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,.13);
      }
      .medi-agenda-card.is-next  { border-left-color: #0d6efd; background: #f0f7ff; }
      .medi-agenda-card.is-late  { border-left-color: #dc3545; background: #fff5f5; }
      .medi-agenda-card.can-attend { border-left-color: #198754; }

      /* ── Actividad Reciente: card por consulta ── */
      .medi-recent-card {
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,.06);
        margin-bottom: 8px;
        transition: transform .15s ease, box-shadow .15s ease;
      }
      .medi-recent-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,.11);
      }

      /* ── Avatar circular inicial ── */
      .medi-avatar {
        width: 38px; height: 38px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: .95rem;
        flex-shrink: 0;
      }

      /* ── Animación fade-in escalonada ── */
      .medi-agenda-card, .medi-recent-card {
        animation: medi-fadein .25s ease both;
      }
      @keyframes medi-fadein {
        from { opacity:0; transform: translateY(6px); }
        to   { opacity:1; transform: translateY(0); }
      }

      /* ── Sección vacía ilustrada ── */
      .medi-empty-state {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 2rem 1rem; color: #adb5bd;
      }
      .medi-empty-state i { font-size: 2.5rem; margin-bottom: .75rem; }
      .medi-empty-state p { font-size: .8rem; margin: 0; }

      /* ── Modal Consulta: pills de signos vitales ── */
      .soap-vital-pill {
        background: #f0f7ff; border-radius: 12px;
        padding: .6rem .5rem; text-align: center; flex: 1;
        min-width: 52px;
      }
      .soap-vital-pill label { font-size: .58rem; color: #6c757d; font-weight: 700;
        text-transform: uppercase; display: block; margin-bottom: 4px; }
      .soap-vital-pill input { background: transparent; border: none; text-align: center;
        font-weight: 700; font-size: .85rem; color: #1d4ed8; width: 100%; padding: 0; }
      .soap-vital-pill input:focus { outline: none; }

      /* ── Modal Agendar: date/time cards ── */
      .adm-date-card { cursor: pointer; transition: all .15s ease; min-width: 68px;
        border-radius: 12px; }
      .adm-date-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
      .adm-date-card.selected { background: #eff6ff !important; border-color: #0d6efd !important; }
      .adm-date-card.selected .day-num { color: #0d6efd; }

      .adm-time-pill { min-width: 68px; font-size: .8rem; transition: all .12s ease;
        border-radius: 20px !important; }

      .shift-banner { background: linear-gradient(135deg,#f0f7ff,#e8f4fd);
        border-radius: 12px; border: 1px solid #bfdbfe; }

      /* ── Expediente: sidebar items ── */
      .fr-history-item { border-left: 3px solid #dee2e6; transition: all .15s ease;
        border-radius: 0 8px 8px 0; }
      .fr-history-item:hover { border-left-color: #93c5fd; background: #f8faff; }
      .fr-history-item.active { border-left-color: #0d6efd; background: #eff6ff; }
      .fr-history-item.psico { border-left-color: #c4b5fd; }
      .fr-history-item.psico.active { border-left-color: #7c3aed; background: #f3f0ff; }

      /* ── Animación global ── */
      .fade-slide-in { animation: medi-fadein .22s ease both; }
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
                                document.getElementById('medi-cita-tipo').value='Médico'; 
                                window._selectedServiceDuration = 'Médico'; // Hint for slot generation 
                                
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
                    <input type="hidden" id="medi-cita-tipo" value="Médico">
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
           <button class="btn btn-sm btn-light text-danger fw-bold ms-auto rounded-pill" onclick="AdminMedi.showAdminConfigModal()">Configurar</button>
       </div>

       <!-- ============================================ -->
       <!--          DASHBOARD HEADER                    -->
       <!-- ============================================ -->
       <div class="d-flex justify-content-between align-items-center mb-4 animate__animated animate__fadeIn">
          <div class="d-flex align-items-center gap-3">
             <div class="bg-white p-3 rounded-4 shadow-sm text-center" style="min-width: 60px;">
                <i class="bi bi-heart-pulse-fill text-primary display-6"></i>
             </div>
             <div>
                <h3 class="fw-bold text-dark mb-0" id="medi-pro-name">Bienvenido</h3>
                <div class="d-flex align-items-center gap-2 mt-1">
                    <span class="badge bg-primary bg-opacity-10 text-primary border-0" id="medi-pro-esp">Cargando...</span>
                    <span class="badge text-muted border d-none" id="medi-shift-badge"></span>
                    <button id="btn-shift-selector" class="btn btn-xs btn-dark rounded-pill px-2 d-none" onclick="AdminMedi.setShift(null)" title="Cambiar Turno" style="font-size:.65rem;">
                       <i class="bi bi-arrow-repeat me-1"></i>Turno
                    </button>
                </div>
             </div>
          </div>
          <div class="text-end">
              <h3 class="fw-bold text-dark mb-0 font-monospace" id="admin-clock-time">--:--:--</h3>
              <p class="text-muted mb-0 small text-capitalize" id="admin-clock-date">Cargando fecha...</p>
          </div>
       </div>
       <input type="hidden" id="medi-pro-cedula" value="">

       <!-- ============================================ -->
       <!--          ACTION CARDS (Biblio-style)         -->
       <!-- ============================================ -->
       <div id="admin-dashboard-content" class="container-fluid px-0 animate__animated animate__fadeInUp">

           <!-- ACTION CARDS ROW (v5 Gradientes + iconos ilustrativos) -->
           <div class="row g-3 mb-4 row-cols-2 row-cols-md-3 justify-content-center">

              <!-- 1. CONSULTA RAPIDA -->
              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" onclick="AdminMedi.nuevaConsultaWalkIn()"
                      style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(0,184,148,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class=" bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-clipboard2-pulse-fill fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Consulta Rápida</h6>
                             <span class="small opacity-75">Walk-in directo</span>
                          </div>
                       </div>
                       <i class="bi bi-clipboard2-pulse-fill position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

              <!-- 2. MI AGENDA (Prioridad visual) -->
              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" 
onclick="AdminMedi.openMiAgendaModal()"
                      style="background: linear-gradient(135deg, #0984e3 0%, #6c5ce7 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(9,132,227,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class=" bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-journal-medical fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Mi Agenda</h6>
                             <span class="small opacity-75">Citas del día</span>
                          </div>
                       </div>
                       <span class="badge bg-opacity-25 text-white rounded-pill px-3 mt-auto" id="badge-agenda-card" style="font-size:1.5rem;">0 citas</span>
                       <i class="bi bi-journal-medical position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

              <!-- 3. SALA DE ESPERA -->
              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" onclick="AdminMedi.openWaitingRoomModal()"
                      style="background: linear-gradient(135deg, #e17055 0%, #d63031 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(214,48,49,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class=" bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-person-raised-hand fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Sala de Espera</h6>
                             <span class="small opacity-75">Cola de pacientes</span>
                          </div>
                       </div>
                       <span class="badge bg-opacity-25 text-white rounded-pill px-3 mt-auto" id="badge-sala-espera" style="font-size:1.5rem;">0 en espera</span>
                       <i class="bi bi-person-raised-hand position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

              <!-- 4. BUSCAR PACIENTE -->
              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" onclick="AdminMedi.openSearchModal()"
                      style="background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(0,180,216,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class="bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-person-vcard-fill fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Buscar Paciente</h6>
                             <span class="small opacity-75">Expediente e historial</span>
                          </div>
                       </div>
                       <i class="bi bi-person-vcard-fill position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

              <!-- 5. AGENDAR CITA -->
              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" onclick="AdminMedi.openManualBooking()"
                      style="background: linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(243,156,18,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class="bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-calendar2-plus-fill fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Agendar Cita</h6>
                             <span class="small opacity-75">Crear cita manual</span>
                          </div>
                       </div>
                       <i class="bi bi-calendar2-plus-fill position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

              <!-- 6. CONFIGURACION -->
              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" onclick="AdminMedi.showAdminConfigModal()"
                      style="background: linear-gradient(135deg, #636e72 0%, #2d3436 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(45,52,54,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class="bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-sliders fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Configuración</h6>
                             <span class="small opacity-75">Horarios y cédula</span>
                          </div>
                       </div>
                       <i class="bi bi-sliders position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

           </div>


          <!-- ============================================ -->
          <!--          STATS CARDS (Live)                  -->
          <!-- ============================================ -->
          <div class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.15s;">

             <!-- Stat: Atendidos Hoy -->
             <div class="col-6 col-lg-3">
                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8faf0 0%, #f5fdf9 100%);">
                   <div class="card-body p-3">
                      <div class="d-flex align-items-center gap-2 mb-2">
                         <div class="bg-success bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:32px;height:32px;"><i class="bi bi-check-circle-fill text-success"></i></div>
                         <span class="fw-bold small text-dark">Atendidos</span>
                      </div>
                      <h2 class="fw-bold text-dark mb-0" id="stat-atendidos">0</h2>
                      <p class="text-muted mb-0" style="font-size:.65rem;">consultas hoy</p>
                   </div>
                </div>
             </div>

             <!-- Stat: En Espera -->
             <div class="col-6 col-lg-3">
                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8f4fd 0%, #f8fbff 100%);">
                   <div class="card-body p-3">
                      <div class="d-flex align-items-center gap-2 mb-2">
                         <div class="bg-primary bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:32px;height:32px;"><i class="bi bi-hourglass-split text-primary"></i></div>
                         <span class="fw-bold small text-dark">En Espera</span>
                      </div>
                      <h2 class="fw-bold text-dark mb-0" id="stat-en-espera">0</h2>
                      <p class="text-muted mb-0" style="font-size:.65rem;">pacientes pendientes</p>
                   </div>
                </div>
             </div>

             <!-- Stat: Agenda Hoy -->
             <div class="col-6 col-lg-3">
                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, rgba(255,210,77,0.08) 0%, rgba(255,210,77,0.03) 100%);">
                   <div class="card-body p-3">
                      <div class="d-flex align-items-center gap-2 mb-2">
                         <div class="bg-warning bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:32px;height:32px;"><i class="bi bi-calendar-check text-warning"></i></div>
                         <span class="fw-bold small text-dark">Agenda</span>
                      </div>
                      <h2 class="fw-bold text-dark mb-0" id="stat-agenda">0</h2>
                      <p class="text-muted mb-0" style="font-size:.65rem;">citas programadas</p>
                   </div>
                </div>
             </div>

             <!-- Stat: Seguimientos -->
             <div class="col-6 col-lg-3">
                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #fce8f4 0%, #fdf5fa 100%);">
                   <div class="card-body p-3">
                      <div class="d-flex align-items-center gap-2 mb-2">
                         <div class="bg-danger bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:32px;height:32px;"><i class="bi bi-arrow-repeat text-danger"></i></div>
                         <span class="fw-bold small text-dark">Seguimientos</span>
                      </div>
                      <h2 class="fw-bold text-dark mb-0" id="stat-seguimientos">0</h2>
                      <p class="text-muted mb-0" style="font-size:.65rem;">pendientes</p>
                   </div>
                </div>
             </div>

          </div>

          <!-- ============================================ -->
          <!--          RECENT ACTIVITY + QUICK AGENDA      -->
          <!-- ============================================ -->
          <div class="row g-3 animate__animated animate__fadeInUp" style="animation-delay:0.3s;">

             <!-- Agenda del Día -->
             <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center gap-2">
                         <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                            <i class="bi bi-calendar-check text-primary" style="font-size:.9rem;"></i>
                         </div>
                         <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size:.9rem;">Agenda del Día</h6>
                            <div class="text-muted" style="font-size:.68rem;">
                               <span id="medi-agenda-count" class="fw-bold text-primary">0</span> citas programadas
                            </div>
                         </div>
                      </div>
                      <button class="btn btn-sm btn-light rounded-pill px-3 d-flex align-items-center gap-1" onclick="AdminMedi.refreshAdmin()" style="font-size:.7rem;">
                         <i class="bi bi-arrow-clockwise"></i>
                         <span class="d-none d-sm-inline">Actualizar</span>
                      </button>
                   </div>
                   <div class="card-body p-3" style="max-height: 370px; overflow-y: auto; scrollbar-width: thin;">
                      <div id="medi-agenda-list">
                         <div class="medi-empty-state">
                            <i class="bi bi-calendar-x"></i>
                            <p>Sin citas programadas por hoy</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             <!-- Actividad Reciente -->
             <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center gap-2">
                         <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                            <i class="bi bi-clock-history text-success" style="font-size:.9rem;"></i>
                         </div>
                         <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size:.9rem;">Actividad Reciente</h6>
                            <div class="text-muted" style="font-size:.68rem;">Últimas consultas registradas</div>
                         </div>
                      </div>
                      <button class="btn btn-sm btn-light rounded-pill px-3 d-flex align-items-center gap-1" onclick="AdminMedi.showAllRecentModal()" style="font-size:.7rem;">
                         <i class="bi bi-layout-text-sidebar-reverse"></i>
                         <span class="d-none d-sm-inline">Ver todo</span>
                      </button>
                   </div>
                   <div class="card-body p-3" style="max-height: 370px; overflow-y: auto; scrollbar-width: thin;">
                      <div id="medi-recent-list">
                         <div class="medi-empty-state">
                            <i class="bi bi-clock"></i>
                            <p>Cargando actividad reciente...</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

          </div>

       </div>

       <!-- ============================================ -->
       <!--   HIDDEN DATA CONTAINERS (for JS compat)    -->
       <!-- ============================================ -->
       <!-- These hold data loaded by existing functions but are rendered into modals/cards -->
       <div class="d-none">
          <div id="medi-muro-list"></div>
          <div id="medi-day-stats"></div>
          <div id="medi-inline-consulta"></div>
          <div id="medi-patient-context"></div>
          <div id="medi-chat-panel"></div>
          <div id="medi-search-paciente-hidden"></div>
       </div>

       <!-- ============================================ -->
       <!--   MODAL: MI AGENDA (Full)                   -->
       <!-- ============================================ -->
       <div class="modal fade" id="modalMiAgenda" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
             <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header border-0 text-white py-3" style="background: linear-gradient(135deg, #0984e3 0%, #6c5ce7 100%);">
                   <div>
                      <h5 class="fw-bold mb-0"><i class="bi bi-calendar-week-fill me-2"></i>Mi Agenda</h5>
                      <p class="mb-0 small opacity-75">Citas programadas para hoy</p>
                   </div>
                   <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                   <div id="modal-agenda-list" class="p-3 bg-light-subtle" style="min-height: 200px;">
                      <div class="text-center py-5 opacity-50">
                         <i class="bi bi-calendar-x display-4 d-block mb-2"></i>
                         <p class="fw-bold">Sin citas programadas por hoy</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       <!-- ============================================ -->
       <!--   MODAL: SALA DE ESPERA (Full)              -->
       <!-- ============================================ -->
       <div class="modal fade" id="modalWaitingRoom" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
             <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header border-0 bg-primary text-white py-3">
                   <div>
                      <h5 class="fw-bold mb-0"><i class="bi bi-people-fill me-2"></i>Sala de Espera</h5>
                      <p class="mb-0 small opacity-75">Pacientes esperando ser atendidos</p>
                   </div>
                   <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                   <!-- Filters -->
                   <div class="px-4 py-3 bg-light border-bottom sticky-top" style="z-index:1020;">
                      <div class="d-flex gap-2">
                         <button class="btn btn-sm btn-dark rounded-pill px-3 fw-bold" onclick="AdminMedi.filterWaitingRoom('all')">Todos</button>
                         <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" onclick="AdminMedi.filterWaitingRoom('new')">Nuevos</button>
                         <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" onclick="AdminMedi.filterWaitingRoom('returned')">Devueltos</button>
                      </div>
                   </div>
                   <div id="modal-muro-list" class="list-group list-group-flush p-3">
                      <div class="text-center py-5 opacity-50">
                         <i class="bi bi-cup-hot display-4 d-block mb-2"></i>
                         <p class="fw-bold">Sala vacía</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       <!-- ============================================ -->
       <!--   MODAL: MENSAJES (Full)                    -->
       <!-- ============================================ -->
       <div class="modal fade" id="modalMessages" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
             <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header border-0 bg-dark text-white py-3">
                   <div>
                      <h5 class="fw-bold mb-0"><i class="bi bi-chat-dots-fill me-2"></i>Mensajes</h5>
                      <p class="mb-0 small opacity-75">Conversaciones con estudiantes</p>
                   </div>
                   <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                   <div id="modal-chat-panel">
                      <div class="text-center py-5 text-muted small">
                         <i class="bi bi-chat-square-dots display-4 d-block mb-2 opacity-25"></i>
                         <p>Sin conversaciones activas</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       <!-- ============================================ -->
       <!--   MODAL: BÚSQUEDA DE PACIENTE               -->
       <!-- ============================================ -->
       <div class="modal fade" id="modalSearchPatient" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
             <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header border-0 bg-info text-white py-3">
                   <h5 class="fw-bold mb-0"><i class="bi bi-search me-2"></i>Buscar Paciente</h5>
                   <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                   <div class="input-group mb-3">
                      <input type="text" id="modal-search-input" class="form-control form-control-lg border-0 bg-light rounded-start-pill" placeholder="Matrícula o nombre..." onkeydown="if(event.key==='Enter'){event.preventDefault();AdminMedi.buscarPacienteModal();}">
                      <button class="btn btn-info text-white rounded-end-pill px-4" type="button" onclick="AdminMedi.buscarPacienteModal()">
                         <i class="bi bi-search"></i>
                      </button>
                   </div>
                   <div id="modal-search-results">
                      <div class="text-center py-4 text-muted small opacity-50">
                         <i class="bi bi-person-lines-fill display-6 d-block mb-2"></i>
                         <p>Ingresa matrícula o nombre para buscar</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       <!-- ============================================ -->
       <!--   ZONA B CONSULTA (hidden, for inline SOAP) -->
       <!-- ============================================ -->
       <div id="medi-work-consulta" class="d-none">
          <div id="medi-work-agenda" class="d-none"></div>
       </div>

       <!-- Workarea tabs reference (hidden, for JS compat) -->
       <ul class="d-none" id="medi-workarea-tabs">
          <li><button data-tab="agenda"></button></li>
          <li><button data-tab="consulta" id="tab-btn-consulta"></button></li>
       </ul>
       <ul class="d-none" id="medi-context-tabs"></ul>
       <div class="d-none" id="medi-ctx-metrics"></div>
       <div class="d-none" id="medi-ctx-patient"></div>
       <div class="d-none" id="medi-ctx-messages"></div>
       <div class="d-none" id="medi-ctx-recent"></div>
       <div class="d-none" id="medi-tab-messages"></div>

    </section>

    <div class="modal fade" id="modalConsulta" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
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

                 <button type="button" class="btn btn-sm btn-light text-primary rounded-pill px-3 fw-bold shadow-sm" onclick="AdminMedi.confirmarFinalizacion()">
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
                    <form onsubmit="event.preventDefault(); AdminMedi.handlePinLogin();">
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
              <button id="btn-finalizar-consulta" class="btn btn-success rounded-pill fw-bold" onclick="AdminMedi.saveConsultation(null, true)">
                 <i class="bi bi-check-lg me-1"></i> Confirmar
              </button>
              <button id="btn-cancelar-finalizar" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
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
                <button class="btn btn-light rounded-pill px-4" onclick="AdminMedi.cerrarSuccessModal()">
                   <i class="bi bi-x-lg me-1"></i> Cerrar
                </button>
                <button class="btn btn-primary rounded-pill px-4 fw-bold shadow hover-scale" onclick="AdminMedi.printReceta()">
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
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">

          <!-- Header con gradiente + info de turno -->
          <div class="modal-header border-0 pb-2" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);">
            <div>
              <h6 class="fw-bold text-white mb-0">
                <i class="bi bi-calendar-plus-fill me-2"></i>Agendar Cita
              </h6>
              <div class="text-white-50" style="font-size:.7rem;" id="adm-book-shift-hint">
                Turno: <span id="adm-book-shift-label" class="fw-bold text-white">Seleccionando...</span>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body p-0">
            <form id="adm-book-form" onsubmit="event.preventDefault(); AdminMedi.confirmAdminBooking();">

              <!-- STEP 1: Búsqueda de paciente -->
              <div id="adm-book-step-1" class="p-4 pb-3">
                <div class="d-flex align-items-center gap-2 mb-3">
                  <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;">
                    <span class="fw-bold text-primary" style="font-size:.75rem;">1</span>
                  </div>
                  <span class="fw-bold text-dark" style="font-size:.85rem;">Buscar Paciente</span>
                </div>
                <div class="input-group rounded-3 overflow-hidden shadow-sm">
                  <input type="text" id="adm-book-matricula"
                         class="form-control border-0 bg-light fw-semibold"
                         placeholder="Matrícula del estudiante..."
                         onkeydown="if(event.key==='Enter'){event.preventDefault();AdminMedi.searchStudentForBooking();}">
                  <button class="btn btn-primary px-3" type="button" onclick="AdminMedi.searchStudentForBooking()">
                    <i class="bi bi-search"></i>
                  </button>
                </div>
                <div id="adm-student-result" class="mt-2"></div>
              </div>

              <!-- STEP 2: Fecha, hora y motivo -->
              <div id="adm-book-step-2" class="d-none">
                <div class="border-top"></div>

                <!-- Fecha -->
                <div class="p-4 pb-2">
                  <div class="d-flex align-items-center gap-2 mb-3">
                    <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;">
                      <span class="fw-bold text-success" style="font-size:.75rem;">2</span>
                    </div>
                    <span class="fw-bold text-dark" style="font-size:.85rem;">Seleccionar Fecha</span>
                  </div>
                  <div id="adm-book-dates" class="d-flex gap-2 overflow-auto pb-2" style="scrollbar-width:thin;"></div>
                  <input type="hidden" id="adm-book-date" required>
                </div>

                <!-- Hora -->
                <div class="p-4 pt-2 pb-2">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;">
                      <span class="fw-bold text-warning" style="font-size:.75rem;">3</span>
                    </div>
                    <span class="fw-bold text-dark" style="font-size:.85rem;">Seleccionar Hora</span>
                  </div>
                  <div id="adm-book-time-msg"
                       class="text-center small text-muted fst-italic py-3 bg-light rounded-3 border">
                    <i class="bi bi-calendar-event me-1"></i>Selecciona un día primero
                  </div>
                  <div id="adm-book-times" class="d-flex flex-wrap gap-2 d-none pt-2"></div>
                  <input type="hidden" id="adm-book-time" required>
                </div>

                <!-- Motivo -->
                <div class="p-4 pt-2 pb-3 border-top">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <div class="bg-danger bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;">
                      <span class="fw-bold text-danger" style="font-size:.75rem;">4</span>
                    </div>
                    <span class="fw-bold text-dark" style="font-size:.85rem;">Motivo de la Cita</span>
                  </div>
                  <select class="form-select border-0 bg-light fw-semibold mb-2 rounded-3" id="adm-book-category">
                    <option value="Consulta General">🩺 Consulta General</option>
                    <option value="Urgencia Menor">⚡ Urgencia Menor</option>
                    <option value="Seguimiento">🔄 Seguimiento</option>
                    <option value="Certificado Médico">📋 Certificado Médico</option>
                    <option value="Salud Mental">💬 Salud Mental (Psicología)</option>
                  </select>
                  <textarea id="adm-book-reason" class="form-control border-0 bg-light rounded-3"
                            rows="2" placeholder="Notas adicionales (opcional)..."></textarea>
                </div>

                <!-- Botón confirmar -->
                <div class="p-4 pt-0">
                  <button type="submit" class="btn btn-primary w-100 rounded-pill fw-bold py-2 shadow-sm">
                    <i class="bi bi-check-circle-fill me-2"></i>Confirmar Cita
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
                ${_myRole === 'Médico' ? `
                <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 mb-3">
                    <div>
                        <div class="fw-bold text-dark">Habilitar Agenda Médica</div>
                        <div class="small text-muted">Permitir reservas para medicina general</div>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input fs-4" type="checkbox" id="cfg-available-medico" ${(_ctx.config && _ctx.config.medi && _ctx.config.medi.availableMédico !== false) ? 'checked' : ''}>
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
      const chkMédico = document.getElementById('cfg-available-medico');
      const chkPsicologo = document.getElementById('cfg-available-psicologo');



      const updateData = {};
      // [FIX] Save specific duration for role
      if (_myRole) {
        updateData['slotDuration_' + _myRole] = parseInt(valDuration);
      } else {
        updateData.slotDuration = parseInt(valDuration);
      }

      // Only update what is visible/editable
      if (chkMédico) updateData.availableMédico = chkMédico.checked;
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
          if (_myRole === 'Médico' && updateData.availableMédico === false) isEnabled = false;
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

        infoDiv.innerHTML = (() => {
          const nm = student.displayName || student.email || 'P';
          const ini = nm[0].toUpperCase();
          const COLS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'], ['#fce7f3', '#9d174d']];
          const [bg, fg] = COLS[ini.charCodeAt(0) % COLS.length];
          return `
            <div class="d-flex align-items-center gap-3 p-3 mb-3 rounded-3 border"
                 style="background:linear-gradient(135deg,#f0f7ff,#e8f4fd);">
              <div class="medi-avatar flex-shrink-0"
                   style="background:${bg};color:${fg};width:42px;height:42px;font-size:1.1rem;">${ini}</div>
              <div class="flex-fill">
                <div class="fw-bold text-dark" style="font-size:.88rem;">${escapeHtml(nm)}</div>
                <div class="text-muted" style="font-size:.72rem;">${escapeHtml(student.matricula || student.email || '')}</div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill"
                      onclick="AdminMedi.openManualBooking()">
                <i class="bi bi-arrow-left-short"></i> Cambiar
              </button>
            </div>`;
        })();


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
    let typeForSlot = 'Médico';
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

    // Mostrar turno en header del modal
    const shiftLabelEl = document.getElementById('adm-book-shift-label');
    if (shiftLabelEl) {
      if (_currentShift === 'Matutino') shiftLabelEl.textContent = '☀️ Matutino (08:00-14:00)';
      else if (_currentShift === 'Vespertino') shiftLabelEl.textContent = '🌙 Vespertino (15:00-21:00)';
      else shiftLabelEl.textContent = '⏰ Todo el dia';
    }

    const days = [];
    let curr = new Date();
    while (days.length < 10) {
      if (isWeekday(curr)) days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const TODAY = MediService.toISO(new Date());
    container.innerHTML = days.map(d => {
      const isoDate = MediService.toISO(d);
      const isToday = isoDate === TODAY;
      const weekday = d.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
      const dayNum = d.getDate();
      const month = d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase();
      return `
        <div class="adm-date-card p-2 text-center border bg-white shadow-sm flex-shrink-0"
             style="min-width:72px;user-select:none;"
             onclick="AdminMedi.selectAdminDate(this,'${isoDate}')">
          <div class="text-muted fw-bold" style="font-size:.6rem;">${weekday}</div>
          <div class="day-num fw-bold lh-1 my-1" style="font-size:1.4rem;color:${isToday ? '#0d6efd' : '#1e293b'};">${dayNum}</div>
          <div style="font-size:.62rem;color:${isToday ? '#0d6efd' : '#6c757d'};font-weight:600;">${month}</div>
          ${isToday ? `<div class="bg-primary rounded-pill mx-auto mt-1" style="width:18px;height:3px;"></div>` : ''}
        </div>`;
    }).join('');
  }

  function selectAdminDate(el, dateStr) {
    document.getElementById('adm-book-date').value = dateStr;

    // UI: destacar card seleccionada
    document.querySelectorAll('.adm-date-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    const grid = document.getElementById('adm-book-times');
    const msg = document.getElementById('adm-book-time-msg');
    const timeInp = document.getElementById('adm-book-time');

    timeInp.value = '';
    grid.classList.add('d-none');
    msg.classList.remove('d-none');
    msg.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Cargando horarios...';

    // Restriccion de horarios por turno
    let slotStartH = SLOT_START || 8;
    let slotEndH = SLOT_END || 22;
    if (_currentShift === 'Matutino') { slotStartH = 8; slotEndH = 14; }
    if (_currentShift === 'Vespertino') { slotStartH = 15; slotEndH = 21; }

    const step = SLOT_DURATION || 60;
    const shiftIcon = _currentShift === 'Matutino' ? '☀️' : _currentShift === 'Vespertino' ? '🌙' : '⏰';
    const shiftLabel = _currentShift ? `${shiftIcon} Turno ${_currentShift}` : '⏰ Horario completo';
    const rangeLabel = `${String(slotStartH).padStart(2, '0')}:00 - ${String(slotEndH).padStart(2, '0')}:00`;

    MediService.getOccupiedSlots(_ctx, _myRole, dateStr).then(occupied => {
      const slots = [];
      for (let m = slotStartH * 60; m < slotEndH * 60; m += step) {
        const hh = Math.floor(m / 60);
        const mm = m % 60;
        const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        const isTaken = Array.isArray(occupied) && occupied.some(s => s.includes(timeStr));
        slots.push({ timeStr, isTaken });
      }

      if (slots.length === 0) {
        msg.classList.remove('d-none');
        msg.innerHTML = '<i class="bi bi-calendar-x me-1"></i>No hay horarios disponibles para este turno.';
        return;
      }

      grid.innerHTML = `
        <div class="shift-banner w-100 p-2 mb-3 d-flex align-items-center justify-content-between">
          <span class="fw-bold text-primary" style="font-size:.8rem;">${shiftLabel}</span>
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:.68rem;">
            <i class="bi bi-clock me-1"></i>${rangeLabel}
          </span>
        </div>
        ${slots.map(({ timeStr, isTaken }) => `
          <button type="button" class="adm-time-pill btn btn-sm fw-bold ${isTaken ? 'btn-secondary opacity-40' : 'btn-outline-primary'}"
                  ${isTaken ? `disabled title="Ocupado"` : `onclick="AdminMedi.selectAdminTime(this,'${timeStr}')"`}>
            ${timeStr}
          </button>
        `).join('')}
      `;

      msg.classList.add('d-none');
      grid.classList.remove('d-none');

    }).catch(err => {
      console.warn('Fallback slots sin verificacion:', err);
      let html = `
        <div class="shift-banner w-100 p-2 mb-3">
          <span class="fw-bold text-warning" style="font-size:.8rem;">${shiftLabel} - ${rangeLabel}</span>
          <span class="badge bg-warning-subtle text-warning ms-2" style="font-size:.65rem;">Sin verificacion</span>
        </div>`;
      for (let m = slotStartH * 60; m < slotEndH * 60; m += step) {
        const hh = Math.floor(m / 60);
        const t = `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        html += `<button type="button" class="adm-time-pill btn btn-outline-primary btn-sm fw-bold" onclick="AdminMedi.selectAdminTime(this,'${t}')">${t}</button>`;
      }
      grid.innerHTML = html;
      msg.classList.add('d-none');
      grid.classList.remove('d-none');
    });
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

  // ==========================================================
  //                 ZONA ADMINISTRATIVA (FASE 3 + 3.5)
  // ==========================================================

  async function initAdmin(ctx) {
    _ctx = ctx;
    _myUid = _ctx.user.uid;
    const perfil = _ctx.profile || {};

    const container = document.getElementById('view-medi');
    if (!container) return;

    renderStructure(container);

    const vStu = document.getElementById('medi-student');
    const vAdm = document.getElementById('medi-admin');
    if (vStu) vStu.classList.add('d-none');
    if (vAdm) vAdm.classList.remove('d-none');

    // --- DETECCIÓN MAESTRA DE ROL ---
    const permMedi = perfil.permissions?.medi || '';
    const espDoc = perfil.especialidad || perfil.specialty || '';
    const identity = (permMedi + espDoc).toLowerCase();

    _myRole = identity.includes('psicologo') ? 'Psicologo' : 'Médico';

    console.log(`[Medi] Area Identificada: ${_myRole} `);

    try {
      const cfg = await MediService.loadConfig(_ctx);

      // [FIX] Sync config to Context
      if (!_ctx.config) _ctx.config = {};
      _ctx.config.medi = cfg;

      // [FIX] Load specific duration
      if (cfg['slotDuration_' + _myRole]) {
        SLOT_DURATION = cfg['slotDuration_' + _myRole];
      } else if (cfg.slotDuration) {
        SLOT_DURATION = cfg.slotDuration;
      }

      SLOT_START = cfg.slotStart || 8;
      SLOT_END = 22; // [FIX] Force 10 PM close

      // Status Banner Check (Role Specific)
      const isMyServiceEnabled = (_myRole === 'Médico')
        ? (cfg.availableMédico !== false)
        : (cfg.availablePsicologo !== false);

      const banner = document.getElementById('medi-service-status');
      if (banner) {
        if (!isMyServiceEnabled) {
          banner.classList.remove('d-none');
          banner.classList.add('d-flex');
        } else {
          banner.classList.add('d-none');
          banner.classList.remove('d-flex');
        }
      }

      // Personalización visual
      const titleEl = document.getElementById('medi-pro-name');

      // Mostrar Botón de Cambio SOLO si es Psicólogo (Logout de perfil)
      const btnShift = document.getElementById('btn-shift-selector');

      if (_myRole === 'Psicologo') {
        if (titleEl) titleEl.textContent = 'Panel Psicopedagógico';

        // 0. CONFIGURE BUTTON FIRST (Hidden by default)
        if (btnShift) {
          btnShift.classList.add('d-none');
          btnShift.innerHTML = '<i class="bi bi-box-arrow-left me-2"></i>Cambiar Perfil';
          btnShift.onclick = () => {
            _currentProfile = null;
            _currentShift = null;
            localStorage.removeItem('medi_last_profile_id');
            localStorage.removeItem('medi_session_expiry');
            location.reload();
          };
        }

        // [MOVED] Config Button is now integrated in the standard UI, not injected here.
        // Legacy injection removed to fix ReferenceError and duplicates.

        // 1. CHECK PERSISTENCE
        const lastProfileId = localStorage.getItem('medi_last_profile_id');
        const sessionExpiry = localStorage.getItem('medi_session_expiry');
        let restored = false;

        if (lastProfileId && sessionExpiry && parseInt(sessionExpiry) > Date.now()) {
          try {
            // We need to fetch profiles to restore the object
            const profiles = await MediService.getProfiles(_ctx, _myUid);
            const saved = profiles.find(p => p.id === lastProfileId);

            if (saved) {
              _currentProfile = saved;
              _currentShift = saved.legacyShift;
              // showToast(`Sesión restaurada: ${ saved.displayName } `, 'info');
              finishProfileSetup();
              restored = true;
            }
          } catch (e) { console.error("Error restoring profile", e); }
        }

        if (!restored) {
          // 2. IF NOT RESTORED -> SHOW LOGIN

          // Clear invalid session if any
          localStorage.removeItem('medi_last_profile_id');
          localStorage.removeItem('medi_session_expiry');

          // Ensure profiles exist (First run logic)
          await MediService.seedInitialProfiles(_ctx, _myUid);

          // Show PIN Modal
          const modalEl = document.getElementById('modalPinLogin');
          if (modalEl) {
            // Ensure instance
            let m = bootstrap.Modal.getInstance(modalEl);
            if (!m) m = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
            m.show();

            setTimeout(() => {
              const input = document.getElementById('medi-login-pin');
              if (input) input.focus();

              // [NEW] Persistence toggle button logic
              const group = document.getElementById('medi-pin-persistence-group');
              const hiddenInput = document.getElementById('medi-pin-persistence');
              if (group) {
                group.querySelectorAll('button').forEach(btn => {
                  btn.addEventListener('click', () => {
                    group.querySelectorAll('button').forEach(b => {
                      b.className = 'btn btn-sm rounded-pill px-3 fw-bold btn-outline-secondary';
                    });
                    btn.className = 'btn btn-sm rounded-pill px-3 fw-bold btn-primary';
                    if (hiddenInput) hiddenInput.value = btn.dataset.val;
                  });
                });
              }
            }, 500);
          } else {
            console.error("[Medi] Modal PIN not found");
          }
        }

        const vitalsRow = document.querySelector('#soap-temp')?.closest('.col-12');
        if (vitalsRow) vitalsRow.classList.add('d-none');

        const lactarioCard = document.getElementById('smart-card-lactario-wrapper');
        if (lactarioCard) lactarioCard.classList.add('d-none', 'force-hide');

        const lactarioNav = document.getElementById('nav-btn-view-lactario');
        if (lactarioNav) lactarioNav.classList.add('d-none');

        return; // Halt render until login (Handled by modal or finishProfileSetup)
      } else {
        // MEDICO FLOW (Standard)
        if (titleEl) titleEl.textContent = `Dr(a).${perfil.displayName?.split(' ')[0] || 'Médico'} `;
        if (btnShift) btnShift.classList.add('d-none');

        _currentShift = null;

        const elEsp = document.getElementById('medi-pro-esp');
        if (elEsp) elEsp.textContent = perfil.tipoServicio || 'Servicio Médico';

        finishInit(); // Continue normal flow
      }
    } catch (e) {
      console.error("[Medi] Error en initAdmin:", e);
    }
  }

  async function handlePinLogin() {
    const pinInput = document.getElementById('medi-login-pin');
    const errDiv = document.getElementById('medi-pin-error');
    const pin = pinInput.value.trim();

    if (!pin) return;

    const profile = await MediService.verifyPin(_ctx, _myUid, pin);

    if (profile) {
      _currentProfile = profile;
      _currentShift = profile.legacyShift; // For compatibility

      // PERSISTENCE LOGIC
      const persistenceVal = document.getElementById('medi-pin-persistence').value;
      let durationMs = 0;
      if (persistenceVal === '1h') durationMs = 3600 * 1000;
      if (persistenceVal === '4h') durationMs = 4 * 3600 * 1000;
      if (persistenceVal === '8h') durationMs = 8 * 3600 * 1000;

      if (durationMs > 0) {
        localStorage.setItem('medi_last_profile_id', profile.id);
        localStorage.setItem('medi_session_expiry', (Date.now() + durationMs).toString());
      } else {
        localStorage.removeItem('medi_last_profile_id');
        localStorage.removeItem('medi_session_expiry');
      }

      const modalEl = document.getElementById('modalPinLogin');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();

      // Force backdrop removal (Brute force for sticky backdrop issues)
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style = '';

      pinInput.value = '';
      errDiv.classList.add('d-none');

      finishProfileSetup();
    } else {
      errDiv.classList.remove('d-none');
      pinInput.value = '';
      pinInput.focus();
    }
  }

  function finishProfileSetup() {
    // Update UI with Profile Info
    const elName = document.getElementById('medi-pro-name');
    const elEsp = document.getElementById('medi-pro-esp');
    const elCed = document.getElementById('medi-pro-cedula');
    const btnShift = document.getElementById('btn-shift-selector');
    const shiftBadge = document.getElementById('medi-shift-badge');

    if (elName) elName.textContent = _currentProfile.displayName;
    if (elEsp) elEsp.textContent = 'Psicología';
    if (elCed) elCed.value = _currentProfile.cedula || '';

    // Show shift badge
    if (shiftBadge) {
      shiftBadge.textContent = _currentProfile.legacyShift || '';
      shiftBadge.classList.remove('d-none');
    }

    if (btnShift) btnShift.classList.remove('d-none'); // Show Logout button

    refreshAdmin();
    startClock();
    setTimeout(updateDashboardStats, 2000);
    // [NEW] Ensure Chat Init for Profile Users
    if (typeof initAdminChat === 'function') initAdminChat();
  }

  // [NEW] Admin Chat Logic
  let _unsubAdminChat = null;
  let _activeAdminConvId = null;
  let _unsubAdminMsgs = null;

  function initAdminChat() {
    if (!window.MediChatService) {
      console.warn("MediChatService not verified");
      return;
    }

    // 1. Inject Tab if not exists
    const tabs = document.getElementById('medi-context-tabs');
    if (tabs && !document.getElementById('tab-ctx-messages')) {
      const li = document.createElement('li');
      li.className = 'nav-item';
      li.innerHTML = `<button class="nav-link py-1 px-2" id = "tab-ctx-messages" data - ctx="messages" onclick = "AdminMedi._switchContextTab('messages')" > <i class="bi bi-chat-dots"></i></button> `;
      // Insert before the last item (Recent) or explicitly at index 2
      // Default tabs: Metrics (0), Patient (1), Recent (2).
      // Let's insert before Recent.
      if (tabs.children.length > 2) tabs.insertBefore(li, tabs.children[2]);
      else tabs.appendChild(li);
    }

    // 2. Inject Panel if not exists
    const content = document.getElementById('medi-context-content');
    if (content && !document.getElementById('medi-ctx-messages')) {
      const div = document.createElement('div');
      div.id = 'medi-ctx-messages';
      div.className = 'd-none h-100 d-flex flex-column position-relative';
      div.innerHTML = `
        <div class="p-2 border-bottom d-flex justify-content-between align-items-center bg-light" >
                <span class="fw-bold small">Mensajes</span>
                <span class="badge bg-danger rounded-pill d-none" id="medi-chat-badge-total">0</span>
            </div>
            <div id="medi-chat-list" class="flex-grow-1 overflow-auto bg-white">
                <div class="text-center py-4 text-muted small">Cargando conversaciones...</div>
            </div>
            
            <!--Conversation View Overlay-- >
  <div id="medi-chat-conversation" class="d-none h-100 d-flex flex-column bg-white position-absolute top-0 start-0 w-100" style="z-index:10;">
    <div class="p-2 border-bottom d-flex justify-content-between align-items-center bg-white">
      <button class="btn btn-sm btn-light" onclick="AdminMedi.closeAdminConversation()"><i class="bi bi-arrow-left"></i></button>
      <span class="fw-bold small text-truncate" id="medi-chat-header-name">Chat</span>
      <div style="width:24px;"></div>
    </div>
    <div id="medi-chat-msgs-admin" class="flex-grow-1 overflow-auto p-2 bg-light d-flex flex-column gap-2"></div>
    <div class="p-2 border-top bg-white">
      <form onsubmit="event.preventDefault(); AdminMedi.sendAdminMessage()">
        <div class="input-group input-group-sm">
          <input type="text" id="medi-chat-input-admin" class="form-control rounded-pill bg-light" placeholder="Escribe..." autocomplete="off">
            <button class="btn btn-primary rounded-pill ms-1" type="submit"><i class="bi bi-send-fill"></i></button>
        </div>
      </form>
    </div>
  </div>
`;
      content.appendChild(div);
    }

    startAdminChatStream();
  }

  function startAdminChatStream() {
    if (_unsubAdminChat) _unsubAdminChat();

    const profId = _currentProfile ? _currentProfile.id : null;
    const uidToUse = _myUid;

    _unsubAdminChat = MediChatService.streamConversations(_ctx, uidToUse, _myRole === 'Médico' ? 'profesional' : 'profesional', profId, (convs) => {
      const list = document.getElementById('medi-chat-list');
      if (!list) return;

      if (convs.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted small"><i class="bi bi-chat-square-text opacity-25 d-block fs-1"></i>Sin mensajes recientes</div>';
        return;
      }

      list.innerHTML = convs.map(c => {
        const unread = (c.unreadByProfesional || 0);
        const date = c.lastMessageAt ? (c.lastMessageAt.toDate ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)) : new Date();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
  <div class="p-2 border-bottom hover-bg-light cursor-pointer ${unread > 0 ? 'bg-primary bg-opacity-10' : ''}" onclick = "AdminMedi.openAdminConversation('${c.id}', '${escapeHtml(c.studentName)}')" >
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold small text-truncate" style="max-width:120px;">${escapeHtml(c.studentName)}</span>
                        <span class="extra-small text-muted">${time}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted small text-truncate d-block" style="max-width:140px; font-size:0.75rem;">${escapeHtml(c.lastMessage || '')}</span>
                        ${unread > 0 ? `<span class="badge bg-danger rounded-pill">${unread}</span>` : ''}
                    </div>
                </div>
  `;
      }).join('');
    });
  }

  function openAdminConversation(convId, studentName) {
    _activeAdminConvId = convId;
    const panel = document.getElementById('medi-chat-conversation');
    const list = document.getElementById('medi-chat-list');

    if (list) list.classList.add('d-none'); // Hide list
    if (panel) panel.classList.remove('d-none'); // Show Conversation

    // [FIX] Ensure parent tab is visible (in case it wasn't)
    const msgsTab = document.getElementById('medi-ctx-messages');
    if (msgsTab && msgsTab.classList.contains('d-none')) {
      _switchContextTab('messages');
    }

    const header = document.getElementById('medi-chat-header-name');
    if (header) header.textContent = studentName;

    if (_unsubAdminMsgs) _unsubAdminMsgs();
    _unsubAdminMsgs = MediChatService.streamMessages(_ctx, convId, (msgs) => {
      const container = document.getElementById('medi-chat-msgs-admin');
      if (!container) return;

      container.innerHTML = msgs.map(m => {
        const isMe = m.senderRole === 'profesional';
        const time = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : null;

        return `
  <div class="d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'}" >
    <div class="px-3 py-2 rounded-4 ${isMe ? 'bg-primary text-white rounded-bottom-end-0' : 'bg-white shadow-sm border rounded-bottom-start-0'}" style="max-width:85%; font-size:0.85rem;">
      <div>${escapeHtml(m.text)}</div>
      <div class="${isMe ? 'text-white-50' : 'text-muted'} text-end" style="font-size:0.6rem;">${time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
    </div>
                </div>
  `;
      }).join('');
      container.scrollTop = container.scrollHeight;
    });

    MediChatService.markAsRead(_ctx, convId, 'profesional');
  }

  function closeAdminConversation() {
    const panel = document.getElementById('medi-chat-conversation');
    const list = document.getElementById('medi-chat-list');

    if (panel) panel.classList.add('d-none');
    if (list) list.classList.remove('d-none');

    if (_unsubAdminMsgs) _unsubAdminMsgs();
    _activeAdminConvId = null;
  }

  async function sendAdminMessage() {
    const input = document.getElementById('medi-chat-input-admin');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !_activeAdminConvId) return;

    input.value = '';
    const name = _currentProfile ? _currentProfile.displayName : (_ctx.user.displayName || 'Profesional');

    try {
      await MediChatService.sendMessage(_ctx, _activeAdminConvId, _myUid, name, 'profesional', text);
    } catch (e) { console.error(e); }
  }

  // ============================================
  //   DASHBOARD MODAL OPENERS (NEW)
  // ============================================

  function openMiAgendaModal() {
    const source = document.getElementById('medi-agenda-list');
    const target = document.getElementById('modal-agenda-list');
    if (source && target) {
      target.innerHTML = source.innerHTML || '<div class="text-center py-5 opacity-50"><i class="bi bi-calendar-x display-4 d-block mb-2"></i><p class="fw-bold">Sin citas programadas por hoy</p></div>';
    }
    const modalEl = document.getElementById('modalMiAgenda');
    if (modalEl) {
      let instance = bootstrap.Modal.getInstance(modalEl);
      if (!instance) instance = new bootstrap.Modal(modalEl);
      instance.show();
    }
  }

  function openWaitingRoomModal() {
    // Always sync fresh data from the hidden muro list
    const source = document.getElementById('medi-muro-list');
    const target = document.getElementById('modal-muro-list');
    if (source && target) {
      target.innerHTML = source.innerHTML || '<div class="text-center py-5 opacity-50"><i class="bi bi-cup-hot display-4 d-block mb-2"></i><p class="fw-bold">Sala vacía</p></div>';
    }
    const modalEl = document.getElementById('modalWaitingRoom');
    if (modalEl) {
      let instance = bootstrap.Modal.getInstance(modalEl);
      if (!instance) instance = new bootstrap.Modal(modalEl);
      instance.show();
    }
  }

  function openSearchModal() {
    const modalEl = document.getElementById('modalSearchPatient');
    if (modalEl) {
      const m = new bootstrap.Modal(modalEl);
      m.show();
      setTimeout(() => {
        const input = document.getElementById('modal-search-input');
        if (input) input.focus();
      }, 400);
    }
  }

  function buscarPacienteModal() {
    const input = document.getElementById('modal-search-input');
    if (!input || !input.value.trim()) return;
    // Reuse existing search logic
    buscarPaciente(input.value.trim());
  }

  function openMessagesModal() {
    // Build the modal content with a search bar for new conversations
    const target = document.getElementById('modal-chat-panel');
    if (target) {
      // Add search/start conversation UI at top
      const chatSource = document.getElementById('medi-chat-panel');
      const chatContent = chatSource ? chatSource.innerHTML : '';
      target.innerHTML = `
  <div class="p-3 bg-light border-bottom" >
          <div class="input-group">
            <input type="text" id="msg-search-input" class="form-control border-0 bg-white rounded-start-pill" 
                   placeholder="Buscar alumno para iniciar chat..." 
                   onkeydown="if(event.key==='Enter'){event.preventDefault();AdminMedi.searchAndChat();}">
            <button class="btn btn-dark rounded-end-pill px-3" type="button" onclick="AdminMedi.searchAndChat()">
               <i class="bi bi-chat-plus-fill"></i>
            </button>
          </div>
          <div id="msg-search-result" class="mt-2"></div>
        </div>
  <div class="p-3">${chatContent || '<div class="text-center py-4 text-muted small"><i class="bi bi-chat-square-dots display-5 d-block mb-2 opacity-25"></i><p>Sin conversaciones activas</p></div>'}</div>
`;
    }
    const modalEl = document.getElementById('modalMessages');
    if (modalEl) {
      let instance = bootstrap.Modal.getInstance(modalEl);
      if (!instance) instance = new bootstrap.Modal(modalEl);
      instance.show();
    }
  }

  async function searchAndChat() {
    const input = document.getElementById('msg-search-input');
    const resultDiv = document.getElementById('msg-search-result');
    if (!input || !resultDiv) return;
    const query = input.value.trim();
    if (!query || query.length < 2) return;

    resultDiv.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm"></span></div>';

    try {
      const found = await MediService.buscarPaciente(_ctx, query);
      if (found) {
        found.uid = found.id;
        resultDiv.innerHTML = `
  <div class="d-flex align-items-center gap-3 p-2 bg-white rounded-3 shadow-sm" >
            <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:38px;height:38px;">
              <span class="fw-bold text-primary">${(found.displayName || 'E')[0].toUpperCase()}</span>
            </div>
            <div class="flex-grow-1">
              <h6 class="fw-bold mb-0 small">${escapeHtml(found.displayName || found.email)}</h6>
              <small class="text-muted">${escapeHtml(found.matricula || '')}</small>
            </div>
            <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="AdminMedi.startChatWithStudent('${found.id}', '${escapeHtml(found.displayName || found.email)}'); bootstrap.Modal.getInstance(document.getElementById('modalMessages')).hide();">
              <i class="bi bi-chat-dots me-1"></i>Chatear
            </button>
          </div> `;
      } else {
        resultDiv.innerHTML = '<div class="text-muted small text-center py-1"><i class="bi bi-person-x me-1"></i>No encontrado</div>';
      }
    } catch (e) {
      console.error(e);
      resultDiv.innerHTML = '<div class="text-danger small">Error al buscar</div>';
    }
  }

  // ============================================
  //   DASHBOARD CLOCK (Biblio-style)
  // ============================================
  let _clockInterval = null;
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

  // ============================================
  //   DASHBOARD STATS UPDATER
  // ============================================
  function updateDashboardStats() {
    // Read badge value set by loadWall stream (authoritative source)
    const badge = document.getElementById('badge-sala-espera');
    const waitCount = badge ? parseInt(badge.textContent) || 0 : 0;

    // Update stat card: En Espera (use badge, which is set by stream)
    const statEspera = document.getElementById('stat-en-espera');
    if (statEspera) statEspera.textContent = waitCount;

    // Update stat card: Agenda (count confirmed agenda items)
    const agendaList = document.getElementById('medi-agenda-list');
    const statAgenda = document.getElementById('stat-agenda');
    if (agendaList && statAgenda) {
      // Count distinct date-header items minus the header dividers
      const agendaCards = agendaList.querySelectorAll('.list-group-item, .medi-wait-card');
      statAgenda.textContent = agendaCards.length;
    }

    // Also sync the hidden muro list into the modal if it's open
    const source = document.getElementById('medi-muro-list');
    const target = document.getElementById('modal-muro-list');
    if (source && target) {
      const modalEl = document.getElementById('modalWaitingRoom');
      if (modalEl && modalEl.classList.contains('show')) {
        target.innerHTML = source.innerHTML;
      }
    }
  }

  function finishInit() {
    // Common init steps for non-profile users (Médico)
    const perfil = _ctx.profile || {};
    const elName = document.getElementById('medi-pro-name');

    // Load Cedula
    const savedCedula = localStorage.getItem('medi_cedula');
    if (savedCedula) {
      _profesionalCedula = savedCedula;
      const cedInput = document.getElementById('medi-pro-cedula');
      if (cedInput) cedInput.value = savedCedula;
    }

    if (elName) elName.textContent = perfil.displayName || _ctx.user.email;

    // Start dashboard clock
    startClock();

    refreshAdmin();

    // Update dashboard stats periodically
    setTimeout(updateDashboardStats, 2000);
    setInterval(updateDashboardStats, 15000);

    // [NEW] Init Admin Chat
    if (typeof initAdminChat === 'function') initAdminChat();
  }

  // [REMOVED] First refreshAdmin definition — see canonical version below (~line 4482)

  // --- NUEVAS FUNCIONES DOCTOR VIEW ---

  // [NEW] DASHBOARD: RECENT ACTIVITY
  let _unsubRecent = null;

  async function loadRecentActivity() {
    console.log("[medi] loadRecentActivity called (v5 - Visual Cards)");

    // Avatar color pool [bg, text]
    const RECENT_COLORS = [
      ['#e0f2fe', '#0369a1'], ['#d1fae5', '#065f46'], ['#fef3c7', '#92400e'],
      ['#fce7f3', '#9d174d'], ['#ede9fe', '#5b21b6'], ['#fee2e2', '#991b1b']
    ];
    const recentAvatar = (name) => {
      const i = (name || '?').charCodeAt(0) % RECENT_COLORS.length;
      return RECENT_COLORS[i];
    };

    // Tiempo relativo legible
    const timeAgo = (date) => {
      const d = Math.floor((new Date() - date) / 86400000);
      if (d === 0) return 'Hoy';
      if (d === 1) return 'Ayer';
      if (d < 7) return `Hace ${d} d\u00edas`;
      return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    let list = document.getElementById('medi-recent-list');
    if (list) {
      list.innerHTML = `<div class="medi-empty-state" >
        <span class="spinner-border spinner-border-sm text-success mb-2"></span>
        <p>Cargando actividad...</p>
      </div> `;
    }

    if (_unsubRecent) { _unsubRecent(); _unsubRecent = null; }

    if (_myRole === 'Psicologo' && !_currentProfile) {
      console.warn("[medi] Actividad reciente omitida: Falta perfil");
      if (list) list.innerHTML = `<div class="medi-empty-state" ><i class="bi bi-person-badge"></i><p>Selecciona un perfil para continuar</p></div> `;
      return;
    }

    const profId = _currentProfile ? _currentProfile.id : null;
    const uidToUse = _myUid || _ctx.user.uid;
    console.log("[medi] Subscribing stream...", { role: _myRole, uid: uidToUse, profId });

    // Badge de tipo de servicio
    const serviceBadge = (c) => {
      if (c.uid && c.uid.startsWith('anon_'))
        return `<span class="badge bg-warning-subtle text-warning border border-warning" style = "font-size:.58rem;" > Walk -in</span> `;
      const tipo = (c.tipoServicio || c.categoria || '').toLowerCase();
      if (tipo.includes('psico') || tipo.includes('mental'))
        return `<span class="badge bg-primary-subtle text-primary" style = "font-size:.58rem;" > <i class="bi bi-chat-heart-fill me-1"></i>Psicolog\u00eda</span> `;
      if (tipo.includes('medic') || tipo.includes('general'))
        return `<span class="badge bg-info-subtle text-info" style = "font-size:.58rem;" > <i class="bi bi-bandaid-fill me-1"></i>Medicina</span> `;
      return `<span class="badge bg-secondary-subtle text-secondary" style = "font-size:.58rem;" > Consulta</span> `;
    };

    const safetyTimer = setTimeout(() => {
      const el = document.getElementById('medi-recent-list');
      if (el && el.querySelector('.spinner-border')) {
        el.innerHTML = `<div class="medi-empty-state text-danger" >
          <i class="bi bi-wifi-off"></i>
          <p>Tiempo de espera agotado. <button class="btn btn-link btn-sm p-0" onclick="AdminMedi.loadRecentActivity()">Reintentar</button></p>
        </div> `;
      }
    }, 8000);

    _unsubRecent = MediService.streamRecentConsultations(_ctx, _myRole, uidToUse, profId, 3, (docs) => {
      clearTimeout(safetyTimer);
      const currentList = document.getElementById('medi-recent-list');
      if (!currentList) return;

      if (docs.length === 0) {
        currentList.innerHTML = `<div class="medi-empty-state" >
          <i class="bi bi-clipboard-x"></i>
          <p>Sin actividad reciente registrada</p>
        </div> `;
        return;
      }

      currentList.innerHTML = docs.map((c, idx) => {
        const fecha = c.safeDate || new Date();
        const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const relDate = timeAgo(fecha);
        const encoded = encodeURIComponent(JSON.stringify(c));
        const name = c.patientName || c.studentEmail || 'Estudiante';
        const initial = name.charAt(0).toUpperCase();
        const [bgC, fgC] = recentAvatar(name);
        const diag = escapeHtml(c.diagnostico || c.motivo || 'General');

        return `
  <div class="medi-recent-card p-3" style = "animation-delay:${idx * 0.07}s;" >
    <div class="d-flex align-items-start gap-3">
      <div class="medi-avatar flex-shrink-0" style="background:${bgC};color:${fgC};">${initial}</div>
      <div class="flex-fill" style="min-width:0;">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div class="fw-bold text-dark text-truncate" style="font-size:.85rem;">${escapeHtml(name)}</div>
          <div class="text-muted flex-shrink-0 text-end" style="font-size:.65rem;line-height:1.2;">
            <div>${escapeHtml(relDate)}</div>
            <div>${escapeHtml(timeStr)}</div>
          </div>
        </div>
        <div class="fw-semibold text-primary text-truncate mb-1" style="font-size:.78rem;">${diag}</div>
        <div class="d-flex align-items-center justify-content-between gap-2">
          ${serviceBadge(c)}
          <button class="btn btn-xs btn-primary rounded-pill px-3 fw-bold flex-shrink-0"
            style="font-size:.65rem;"
            onclick="AdminMedi.showConsultationQuickDetail('${encoded}')">
            <i class="bi bi-eye me-1"></i>Ver
          </button>
        </div>
      </div>
    </div>
          </div> `;
      }).join('');

      const btnDiv = document.createElement('div');
      btnDiv.className = "text-center pt-2";
      btnDiv.innerHTML = `
  <button class="btn btn-link btn-sm text-decoration-none fw-bold small text-success" onclick = "AdminMedi.showAllRecentModal()" >
    Ver todo el historial <i class="bi bi-arrow-right-short" ></i>
        </button> `;
      currentList.appendChild(btnDiv);
    });
  }

  // 1. Toggle Service
  function toggleServiceAvailability(forceEnable = false) {
    MediService.loadConfig(_ctx).then(cfg => {
      const newState = forceEnable ? true : !cfg.available;
      MediService.updateConfig(_ctx, { available: newState }).then(() => {
        showToast(newState ? 'Servicio Habilitado' : 'Servicio Deshabilitado', newState ? 'success' : 'warning');
        const banner = document.getElementById('medi-service-status');
        if (newState) {
          banner.classList.add('d-none');
          banner.classList.remove('d-flex');
        } else {
          banner.classList.remove('d-none');
          banner.classList.add('d-flex');
        }
      });
    });
  }

  // 2. Open Manual Booking


  // 3. Filter Waiting Room
  function filterWaitingRoom(filter) {
    // Visual feedback on buttons
    const btns = document.querySelectorAll('[onclick^="AdminMedi.filterWaitingRoom"]');
    btns.forEach(b => b.classList.replace('btn-dark', 'btn-light'));
    btns.forEach(b => b.classList.remove('active')); // if using active class

    // Find clicked button style update (approximated)
    // Actual logic:
    // reloadWall with filter param? Or client side filter?
    // Let's do client side filtering on the stream for responsiveness or just re-request.
    // Ideally MediService.streamSalaEspera supports filtering, but for now we filter the DOM or re-render.
    // Since streamSalaEspera is persistent, let's store the current filter in a variable and re-render.
    _waitingRoomFilter = filter;
    loadWall(); // Trigger re-render
  }

  // 4. Buscar Paciente (Unified)
  let _foundPatient = null; // Store for modal actions

  async function buscarPaciente(termOrEvent) {
    // Determine input source: passed string or DOM input
    let query = "";
    if (typeof termOrEvent === 'string') {
      query = termOrEvent;
    } else {
      const input = document.getElementById('modal-search-input');
      query = input ? input.value.trim() : "";
    }

    if (!query) return;

    if (query.length < 2) {
      showToast('Ingresa al menos 2 caracteres para buscar.', 'warning');
      return;
    }

    // Show searching state
    const modalResults = document.getElementById('modal-search-results');
    if (modalResults) {
      modalResults.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
    }
    document.body.style.cursor = 'wait';

    try {
      // Use MediService.buscarPaciente which searches matrícula, email, and name
      const found = await MediService.buscarPaciente(_ctx, query);

      if (!found) {
        // Also try a broader name search (case-insensitive workaround)
        let nameResults = [];
        try {
          const upperQuery = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
          const nameSnap = await _ctx.db.collection('usuarios')
            .where('displayName', '>=', upperQuery)
            .where('displayName', '<=', upperQuery + '\uf8ff')
            .limit(5)
            .get();
          nameResults = nameSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
        } catch (e) { console.warn('Name search error:', e); }

        if (nameResults.length > 0) {
          // Show multiple results
          if (modalResults) {
            modalResults.innerHTML = nameResults.map(s => `
  <div class="list-group-item list-group-item-action border-0 rounded-3 mb-2 p-3 shadow-sm cursor-pointer"
onclick = "AdminMedi.showPatientFoundModal(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(s))}')))" >
  <div class="d-flex align-items-center gap-3">
    <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:42px;height:42px;">
      <span class="fw-bold text-primary">${(s.displayName || 'E')[0].toUpperCase()}</span>
    </div>
    <div>
      <h6 class="fw-bold mb-0 text-dark">${escapeHtml(s.displayName || s.email)}</h6>
      <small class="text-muted">${escapeHtml(s.matricula || '')} • ${escapeHtml(s.carrera || '')}</small>
    </div>
    <i class="bi bi-chevron-right ms-auto text-muted"></i>
  </div>
            </div>
  `).join('');
          } else {
            showPatientFoundModal(nameResults[0]);
          }
        } else {
          if (modalResults) {
            modalResults.innerHTML = `
  <div class="text-center py-4" >
              <div class="bg-warning bg-opacity-10 d-inline-flex rounded-circle p-3 mb-2"><i class="bi bi-person-x-fill text-warning display-5"></i></div>
              <h6 class="fw-bold">No se encontró</h6>
              <p class="text-muted small">No hay resultados para "<strong>${escapeHtml(query)}</strong>"</p>
            </div> `;
          } else {
            showToast('No se encontró ningún alumno.', 'info');
          }
        }
      } else {
        found.uid = found.id;
        _foundPatient = found;
        // [FIX] Clear search results (stop spinner) before showing patient modal
        if (modalResults) {
          modalResults.innerHTML = `
  <div class="text-center py-3 text-success" >
              <i class="bi bi-check-circle-fill fs-2 d-block mb-1"></i>
              <small class="fw-bold">Paciente encontrado</small>
            </div> `;
        }
        // Close search modal and show patient modal
        const searchModalEl = document.getElementById('modalSearchPatient');
        if (searchModalEl) {
          const searchInst = bootstrap.Modal.getInstance(searchModalEl);
          if (searchInst) searchInst.hide();
        }
        showPatientFoundModal(found);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al buscar paciente.', 'danger');
    } finally {
      document.body.style.cursor = 'default';
    }
  }

  function showPatientFoundModal(student) {
    // REDISEÑO TARJETA PACIENTE (PREMIUM)
    const html = `
  <div class="modal-dialog modal-dialog-centered modal-lg" >
    <div class="modal-content rounded-4 shadow-lg border-0">
      <div class="modal-header border-0 pb-0">
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-4 pt-0">

        <!-- HEADER CONTEXTO -->
        <div class="text-center mb-4">
          <div class="position-relative d-inline-block">
            <div class="rounded-circle bg-light shadow-sm d-flex align-items-center justify-content-center mx-auto mb-3"
              style="width: 100px; height: 100px; font-size: 2.5rem; border: 4px solid white;">
              ${student.displayName ? student.displayName.charAt(0).toUpperCase() : '?'}
            </div>
            <span class="position-absolute bottom-0 end-0 badge rounded-pill bg-dark border border-white">
              ${student.matricula || 'Ext'}
            </span>
          </div>
          <h4 class="fw-bold text-dark mb-1">${student.displayName}</h4>
          <div class="text-muted small">${student.email}</div>
        </div>

        <!-- GRID DE DATOS -->
        <div class="row g-3 mb-4">
          <div class="col-md-3 col-6">
            <div class="p-3 bg-light-subtle rounded-4 text-center border h-100">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Edad</div>
              <div class="fw-bold fs-5 text-dark">${student.edad || MediService.calculateAge(student.fechaNacimiento) || '--'}</div>
              <div class="extra-small text-muted">años</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="p-3 bg-light-subtle rounded-4 text-center border h-100">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Sangre</div>
              <div class="fw-bold fs-5 text-danger">${student.tipoSangre || '--'}</div>
              <div class="extra-small text-muted">A+</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="p-3 bg-light-subtle rounded-4 text-center border h-100">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Género</div>
              <div class="fw-bold fs-5 text-dark">${(student.genero || (student.personalData && student.personalData.genero) || student.sexo || '--').charAt(0)}</div>
              <div class="extra-small text-muted">${student.genero || (student.personalData && student.personalData.genero) || student.sexo || '--'}</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="p-3 bg-light-subtle rounded-4 text-center border h-100">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Carrera</div>
              <div class="fw-bold fs-5 text-primary"><i class="bi bi-mortarboard-fill"></i></div>
              <div class="extra-small text-muted text-truncate">${student.carrera || 'General'}</div>
            </div>
          </div>
        </div>

        <!-- ALERTAS -->
        <div class="alert alert-warning border-0 rounded-4 d-flex align-items-center mb-4 shadow-sm">
          <div class="fs-4 me-3 text-warning"><i class="bi bi-exclamation-triangle-fill"></i></div>
          <div>
            <div class="fw-bold text-dark">Alergias Detectadas</div>
            <div class="small text-muted">${student.alergias || 'Ninguna registrada en el sistema.'}</div>
          </div>
        </div>

        <!-- ACCIONES -->
        <div class="row g-2">
          <div class="col-12 mb-2">
            <button class="btn btn-primary w-100 rounded-pill py-3 fw-bold fs-5 shadow-sm hover-scale"
              onclick="AdminMedi.startWalkIn('${encodeURIComponent(JSON.stringify(student))}')">
              <i class="bi bi-lightning-charge-fill me-2"></i>Atender Ahora
            </button>
          </div>
          <div class="col-md-6">
            <div class="d-flex gap-2">
              <button class="btn btn-outline-dark w-100 rounded-pill py-2 fw-bold" onclick='AdminMedi.showFullRecord("${student.uid}")'>
                <i class="bi bi-folder2-open me-2"></i>Expediente
              </button>
              <button class="btn btn-outline-secondary rounded-pill py-2 fw-bold" onclick='AdminMedi.verHistorialRapido("${student.uid}")' data-bs-toggle="tooltip" title="Historial Rápido">
                <i class="bi bi-clock-history"></i>
              </button>
            </div>
          </div>
          <div class="col-md-6">
            <button class="btn btn-outline-primary w-100 rounded-pill py-2 fw-bold"
              onclick="bootstrap.Modal.getInstance(document.getElementById('modalPatientFound')).hide(); AdminMedi.openManualBooking('found', '${encodeURIComponent(JSON.stringify(student))}')">
              <i class="bi bi-calendar-plus me-2"></i>Reservar Cita
            </button>
          </div>
        </div>
      </div>
    </div>
      </div>
  `;

    // Inject into existing modal container if checking structure, or replace innerHTML
    const modalEl = document.getElementById('modalPatientFound');
    modalEl.innerHTML = html;

    new bootstrap.Modal(modalEl).show();
  }

  function startWalkIn(encodedStudent) {
    const student = JSON.parse(decodeURIComponent(encodedStudent));

    // Attempt to close search modals if they exist
    const modalEl = document.getElementById('modalPatientFound');
    if (modalEl) {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
    }

    iniciarConsulta(null, encodeURIComponent(JSON.stringify(student)));
  }

  // --- UI ADMIN MEJORADA ---

  function loadWall() {
    const list = document.getElementById('medi-muro-list');
    if (!list) return;

    // Filter Logic in Stream Callback or Post-Process?
    // Stream returns all for role. We accept that for realsies.

    // Cleanup previous listener to prevent duplicates
    if (_unsubs.wall) _unsubs.wall();

    const unsub = MediService.streamSalaEspera(_ctx, _myRole, _currentShift, (docs) => {

      // Client-Side Filter if needed
      if (_waitingRoomFilter !== 'all') {
        const now = new Date();
        if (_waitingRoomFilter === 'new') {
          docs = docs.filter(d => !d.reentrada);
        } else if (_waitingRoomFilter === 'returned') {
          docs = docs.filter(d => d.reentrada);
        }
      }

      const badge = document.getElementById('badge-sala-espera');
      if (badge) badge.textContent = docs.length; // Sync badge with actual filtered count

      if (docs.length === 0) {
        list.innerHTML = '<div class="text-center py-5 text-muted small">Sin pacientes en espera.</div>';
        return;
      }

      // Sort: priority first (urgente > seguimiento > normal), then oldest first
      const prioOrder = { urgente: 0, seguimiento: 1, normal: 2 };
      docs.sort((a, b) => {
        const pa = prioOrder[a.prioridad] !== undefined ? prioOrder[a.prioridad] : 2;
        const pb = prioOrder[b.prioridad] !== undefined ? prioOrder[b.prioridad] : 2;
        if (pa !== pb) return pa - pb;
        return (a.safeDate || 0) - (b.safeDate || 0);
      });

      const now = new Date();
      list.innerHTML = docs.map((c, idx) => {
        const fecha = c.safeDate || new Date();
        const esReentrada = c.reentrada === true;
        const isLactario = c.linkedLactarioId || (c.motivo && c.motivo.includes('Lactancia'));
        const prio = c.prioridad || 'normal';

        const timeStr = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const isToday = fecha.toDateString() === now.toDateString();
        const dateLabel = isToday ? 'Hoy' : fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

        // Priority styling
        let accentColor = '#0d6efd'; // blue default
        let accentBg = 'bg-primary-subtle';
        let prioLabel = '';
        if (prio === 'urgente') { accentColor = '#dc3545'; accentBg = 'bg-danger-subtle'; prioLabel = '<span class="badge bg-danger ms-2" style="font-size:.6rem;">URGENTE</span>'; }
        else if (prio === 'seguimiento') { accentColor = '#ffc107'; accentBg = 'bg-warning-subtle'; prioLabel = '<span class="badge bg-warning text-dark ms-2" style="font-size:.6rem;">SEGUIMIENTO</span>'; }
        if (esReentrada) prioLabel += '<span class="badge bg-info text-white ms-1" style="font-size:.6rem;">Reingreso</span>';
        if (isLactario) prioLabel = '<span class="badge bg-danger text-white ms-2" style="font-size:.6rem;">LACTARIO</span>';

        const motivoPreview = (c.motivo || 'Sin motivo').substring(0, 60);

        // Encode data
        const studentData = encodeURIComponent(JSON.stringify({
          uid: c.studentId, email: c.studentEmail, displayName: c.studentName,
          tipoSangre: c.tipoSangre, alergias: c.alergias
        }));

        return `
  <div class="card border-0 shadow-sm rounded-4 mb-2 overflow-hidden" style = "border-left: 4px solid ${accentColor} !important;" >
    <div class="card-body p-3">
      <div class="d-flex align-items-start gap-3">

        <!-- Avatar -->
        <div class="${accentBg} rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm" style="width:44px;height:44px;">
          <span class="fw-bold" style="color:${accentColor};font-size:1.1rem;">${escapeHtml((c.studentName || 'E')[0].toUpperCase())}</span>
        </div>

        <!-- Info -->
        <div class="flex-grow-1" style="min-width:0;">
          <div class="d-flex align-items-center mb-1">
            <h6 class="fw-bold text-dark mb-0 text-truncate">${escapeHtml(c.studentName || 'Estudiante')}</h6>
            ${prioLabel}
          </div>
          <div class="d-flex align-items-center gap-2 text-muted small mb-1">
            <span><i class="bi bi-clock me-1"></i>${dateLabel} ${timeStr}</span>
            <span class="text-truncate opacity-75">• ${escapeHtml(motivoPreview)}</span>
          </div>
        </div>

        <!-- Quick number -->
        <div class="text-muted small fw-bold opacity-50 flex-shrink-0">#${idx + 1}</div>
      </div>

      <!-- Actions -->
      <div class="d-flex gap-2 mt-2 pt-2 border-top">
        ${isLactario ? `
                  <button class="btn btn-danger btn-sm rounded-pill flex-grow-1 fw-bold" onclick="AdminMedi.validarAcompañamiento('${c.id}')">
                    <i class="bi bi-check-circle-fill me-1"></i>Validar Acompañamiento
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm rounded-pill flex-grow-1 fw-bold" onclick="AdminMedi.tomarPaciente('${c.id}')">
                    <i class="bi bi-calendar-check me-1"></i>Agendar
                  </button>
                `}
        <button class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="AdminMedi.showPatientFoundModal(JSON.parse(decodeURIComponent('${studentData}')))" title="Ver perfil">
          <i class="bi bi-person-lines-fill"></i>
        </button>
        <button class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="AdminMedi.rechazarCita('${c.id}')" title="Rechazar">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    </div>
          </div>
  `;
      }).join('');

      // Also update the modal if it's open
      const modalTarget = document.getElementById('modal-muro-list');
      const modalEl = document.getElementById('modalWaitingRoom');
      if (modalTarget && modalEl && modalEl.classList.contains('show')) {
        modalTarget.innerHTML = list.innerHTML;
      }
    });
    _unsubs.wall = unsub;
  }

  // --- ACCOMPANIMENT ACTION ---
  async function validarAcompañamiento(citaId) {
    if (!confirm('¿Confirmar que se brindó el acompañamiento?')) return;

    try {
      // Just cancel/close it in Medi system. 
      // We treat it as "resolved" without generating a full medical consultation record?
      // Or we can create a simplified entry.
      // For now, let's close the appointment slot.
      // We can use cancelarCitaAdmin but with a "Completed" reason/status.
      // Or strictly update to 'finalizada'.
      // Let's manually update to finalizada.
      await _ctx.db.collection('citas-medi').doc(citaId).update({
        estado: 'finalizada',
        terminadaAt: firebase.firestore.FieldValue.serverTimestamp(),
        resultado: 'Acompañamiento completado'
      });
      showToast('Acompañamiento registrado', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al validar', 'danger');
    }
  }


  function loadMyAgenda() {
    const list = document.getElementById('medi-agenda-list');
    if (!list) return;

    // Avatar color pool [bg, text]
    const AVATAR_COLORS = [
      ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef9c3', '#a16207'],
      ['#fce7f3', '#be185d'], ['#ede9fe', '#6d28d9'], ['#ffedd5', '#c2410c']
    ];
    const avatarColors = (name) => {
      const i = (name || '?').charCodeAt(0) % AVATAR_COLORS.length;
      return AVATAR_COLORS[i];
    };

    if (_unsubs.agenda) _unsubs.agenda();

    const unsub = MediService.streamAgenda(_ctx, _myUid, _currentShift, _currentProfile ? _currentProfile.id : null, (docs) => {
      const kpiPend = document.getElementById('kpi-pendientes-hoy');
      const countEl = document.getElementById('medi-agenda-count');
      if (kpiPend) kpiPend.textContent = docs.length;
      if (countEl) countEl.textContent = docs.length;

      const now = new Date();
      const todayISO = toISO(now);

      // Filter docs for today only
      docs = docs.filter(d => {
        const fecha = d.safeDate;
        return fecha && toISO(fecha) === todayISO;
      });

      if (docs.length === 0) {
        list.innerHTML = `<div class="medi-empty-state" >
          <i class="bi bi-calendar-x"></i>
          <p>No tienes citas agendadas por hoy</p>
        </div> `;
        return;
      }

      docs.sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0));

      const tomorrowISO = toISO(new Date(now.getTime() + 86400000));
      const nextIdx = docs.findIndex(c => (c.safeDate || new Date()) >= new Date(now.getTime() - 15 * 60000));
      let lastDateLabel = '';
      let html = '';

      docs.forEach((c, idx) => {
        const fecha = c.safeDate || new Date();
        const dateISO = toISO(fecha);
        const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const diffMinutes = (fecha - now) / 60000;
        const isLate = diffMinutes < -15;
        const canAttend = diffMinutes <= 15;
        const isNext = idx === nextIdx;

        // Separador de fecha
        let dateLabel = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
        if (dateISO === todayISO) dateLabel = 'Hoy';
        else if (dateISO === tomorrowISO) dateLabel = 'Ma\u00f1ana';

        if (dateLabel !== lastDateLabel) {
          html += `
  <div class="d-flex align-items-center gap-2 px-1 pt-2 pb-1 ${lastDateLabel ? 'mt-2 border-top' : ''}" >
              <span class="badge bg-secondary bg-opacity-10 text-secondary fw-bold text-uppercase" style="font-size:.6rem;letter-spacing:.4px;">${escapeHtml(dateLabel)}</span>
              <hr class="flex-fill m-0" style="border-color:#e9ecef;">
            </div>`;
          lastDateLabel = dateLabel;
        }

        // Clase visual de la card seg\u00fan estado
        const cardMod = isNext ? 'is-next' : isLate ? 'is-late' : canAttend ? 'can-attend' : '';

        let statusBadge = '';
        if (isLate)
          statusBadge = `<span class="badge bg-danger-subtle text-danger px-2" style = "font-size:.6rem;" > <i class="bi bi-exclamation-circle-fill me-1"></i>Retrasada</span> `;
        else if (isNext)
          statusBadge = `<span class="badge bg-primary-subtle text-primary px-2" style = "font-size:.6rem;" > <i class="bi bi-lightning-charge-fill me-1"></i>Siguiente</span> `;
        else if (canAttend)
          statusBadge = `<span class="badge bg-success-subtle text-success px-2" style = "font-size:.6rem;" > <i class="bi bi-check-circle-fill me-1"></i>A Tiempo</span> `;
        else
          statusBadge = `<span class="badge bg-light text-muted border px-2" style = "font-size:.6rem;" > <i class="bi bi-clock me-1"></i>Programada</span> `;

        const name = c.studentName || 'Estudiante';
        const initial = name.charAt(0).toUpperCase();
        const [bgC, fgC] = avatarColors(name);
        const motivo = escapeHtml((c.motivo || 'Consulta General').substring(0, 55));
        const citaEnc = encodeURIComponent(JSON.stringify(c));

        html += `
  <div class="medi-agenda-card ${cardMod} p-3" style = "animation-delay:${idx * 0.05}s;" >
            <div class="d-flex align-items-start gap-3">
              <div class="d-flex flex-column align-items-center gap-1 flex-shrink-0" style="min-width:44px;">
                <div class="fw-bold text-primary" style="font-size:.8rem;line-height:1;">${escapeHtml(timeStr)}</div>
                <div class="medi-avatar" style="background:${bgC};color:${fgC};width:34px;height:34px;font-size:.85rem;">${initial}</div>
              </div>
              <div class="flex-fill" style="min-width:0;">
                <div class="fw-bold text-dark text-truncate" style="font-size:.88rem;">${escapeHtml(name)}</div>
                <div class="text-muted text-truncate mb-1" style="font-size:.72rem;">${motivo}</div>
                <div class="d-flex flex-wrap gap-1">${statusBadge}</div>
              </div>
              <button class="btn btn-xs btn-link text-muted p-0 flex-shrink-0" title="Ver Expediente"
                      onclick="AdminMedi.showFullRecord('${escapeHtml(c.studentId)}')">
                <i class="bi bi-folder2-open" style="font-size:1.05rem;"></i>
              </button>
            </div>
            <div class="d-flex gap-2 mt-2 pt-2 border-top" style="margin-left:54px;">
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold"
                      style="font-size:.72rem;"
                      onclick="AdminMedi.cancelarCitaAdmin('${c.id}', true)">
                <i class="bi bi-arrow-counterclockwise me-1"></i>Devolver
              </button>
              <button class="btn btn-sm ${canAttend ? 'btn-primary shadow-sm' : 'btn-outline-secondary'} rounded-pill px-3 fw-bold"
                      style="font-size:.72rem;"
                      ${canAttend ? '' : 'disabled'}
                      onclick="AdminMedi.iniciarConsulta('${citaEnc}')">
                <i class="bi bi-${canAttend ? 'lightning-charge-fill' : 'hourglass-split'} me-1"></i>${canAttend ? 'Atender Ahora' : 'Esperar'}
              </button>
            </div>
          </div> `;
      });

      list.innerHTML = html;

      // Also update the modal if it's open
      const modalTarget = document.getElementById('modal-agenda-list');
      const modalEl = document.getElementById('modalMiAgenda');
      if (modalTarget && modalEl && modalEl.classList.contains('show')) {
        modalTarget.innerHTML = list.innerHTML;
      }
    });
    _unsubs.agenda = unsub;
  }




  // --- ACCIONES ---

  // C3: Toggle priority cycle: normal -> urgente -> seguimiento -> normal
  async function togglePrioridad(citaId, currentPrio) {
    const cycle = { normal: 'urgente', urgente: 'seguimiento', seguimiento: 'normal' };
    const next = cycle[currentPrio] || 'urgente';
    try {
      await _ctx.db.collection(C_CITAS).doc(citaId).update({ prioridad: next });
      showToast('Prioridad: ' + next, next === 'urgente' ? 'danger' : next === 'seguimiento' ? 'warning' : 'info');
    } catch (e) {
      console.error(e);
      showToast('Error al cambiar prioridad', 'danger');
    }
  }

  async function tomarPaciente(citaId) {
    try {
      const cita = await MediService.tomarPaciente(_ctx, citaId, _myUid, _ctx.auth.currentUser.email, _currentShift, _currentProfile);
      // showToast('Paciente asignado', 'success');

      /*
      if (window.Notify && cita.studentId) {
        window.Notify.send(cita.studentId, {
          title: 'Cita Asignada',
          message: `Tu cita ha sido tomada por el profesional.`,
          type: 'medi', link: '/medi'
        });
      }
      */
    } catch (e) { console.error(e); showToast(e.message || 'Error al tomar', 'danger'); }
  }


  function rechazarCita(citaId) {
    // Wrapper for generic cancel with "No Show" implication
    cancelarCitaAdmin(citaId, false); // False = Finalize/Cancel, True = Return to Queue
  }

  // Cancelación inteligente (>24h muro, <24h cancelada)
  async function cancelarCitaAdmin(citaId, returnToQueue = false) {
    if (!confirm("¿Seguro que deseas devolver este paciente a la sala de espera?")) return;

    try {
      // Pass _currentShift if explicitly set (Psicologo), else just true/false
      const returnArg = returnToQueue ? (_currentShift || true) : false;
      await MediService.cancelarCitaAdmin(_ctx, citaId, "Regresado por el profesional", returnArg);
      // showToast('Cita regresada a sala de espera', 'info');

      // Notificar al estudiante que su cita se movió (Ahora funcionará por las nuevas reglas)
      const citaSnap = await _ctx.db.collection(C_CITAS).doc(citaId).get();
      const citaData = citaSnap.data();

      // Commented out to prevent double notification (MediService usually handles this)
      /* 
      Notify.send(citaData.studentId, {
        title: "Actualización de Cita",
        message: "Tu cita ha sido regresada a la sala de espera por el profesional.",
        type: "medi"
      }); 
      */

    } catch (e) {
      console.error(e);
      showToast('Error al procesar', 'danger');
    }
  }


  async function iniciarConsulta(encodedCita, encodedStudent) {
    let cita = {};
    let student = {};

    if (encodedCita && encodedCita !== "null") {
      cita = JSON.parse(decodeURIComponent(encodedCita));
      const studentSnap = await _ctx.db.collection('usuarios').doc(cita.studentId).get();
      student = studentSnap.exists ? studentSnap.data() : {};

    } else if (encodedStudent) {
      const s = JSON.parse(decodeURIComponent(encodedStudent));

      // [FIX] Ensure Anonymous/Walk-in data is captured correctly
      student = {
        uid: s.uid,
        email: s.email,
        displayName: s.displayName || s.email,
        matricula: s.matricula,
        // IMPORTANT: Capture Gender for Reports
        genero: s.genero || (s.personalData ? s.personalData.genero : 'Desconocido'),
        sexo: s.genero || (s.personalData ? s.personalData.genero : 'Desconocido'), // fallback
        edad: s.edad
      };

      // Also carry over personalData object if it exists (for robustness)
      if (s.personalData) student.personalData = s.personalData;

      cita = {
        id: 'walkin_' + Date.now(),
        studentId: s.uid,
        studentEmail: s.email,
        tipoServicio: _myRole,
        // Persist basic demog for report generation if student doesn't adhere to standard profile
        pacienteNombre: student.displayName,
        pacienteGenero: student.genero,
        pacienteMatricula: student.matricula
      };

      // Try to fetch real profile if it's a real UID (not anon)
      if (!s.uid.startsWith('anon_')) {
        const studentSnap = await _ctx.db.collection('usuarios').doc(s.uid).get();
        if (studentSnap.exists) {
          const realData = studentSnap.data();
          student = { ...student, ...realData };
          // Prefer real data if available
          if (realData.genero) student.genero = realData.genero;
        }
      }

    }

    // Store consultation data
    _lastConsultaData = { cita, studentId: cita.studentId };
    _consultaActive = true;

    // Render SOAP form in the modal
    renderInlineConsultationUI(student, cita);

    // Open the SOAP modal (fullscreen-like)
    const soapModal = document.getElementById('modalConsulta');
    if (soapModal) {
      // Update modal header with patient info
      const nameEl = document.getElementById('soap-patient-name');
      const metaEl = document.getElementById('soap-patient-meta');
      if (nameEl) nameEl.textContent = student.displayName || student.email || 'Paciente';
      if (metaEl) metaEl.textContent = `${student.matricula || ''} • ${_myRole} `;

      const modal = new bootstrap.Modal(soapModal);
      modal.show();
    }

    // [FIX] Populate hidden form inputs so saveConsultation can read studentId/email/citaId
    const hidStudentId = document.getElementById('soap-student-id');
    const hidStudentEmail = document.getElementById('soap-student-email');
    const hidCitaId = document.getElementById('soap-cita-id');
    if (hidStudentId) hidStudentId.value = student.uid || cita.studentId || '';
    if (hidStudentEmail) hidStudentEmail.value = student.email || cita.studentEmail || '';
    if (hidCitaId) hidCitaId.value = cita.id || '';

    // Populate Right Panel (Patient Info & Previous Consultations)
    const profileEl = document.getElementById('soap-patient-profile');
    if (profileEl) {
      const age = student.fechaNacimiento ? MediService.calculateAge(student.fechaNacimiento) : (student.edad || '--');
      profileEl.innerHTML = `
        <div class="row g-2 mb-3">
          <div class="col-4 text-center"><div class="bg-light rounded-3 p-2"><div class="extra-small text-muted">Edad</div><div class="fw-bold small">${age}</div></div></div>
          <div class="col-4 text-center"><div class="bg-light rounded-3 p-2"><div class="extra-small text-muted">Sangre</div><div class="fw-bold small text-danger">${escapeHtml(student.tipoSangre || '--')}</div></div></div>
          <div class="col-4 text-center"><div class="bg-light rounded-3 p-2"><div class="extra-small text-muted">Género</div><div class="fw-bold small">${escapeHtml(student.genero || '--')}</div></div></div>
        </div>
        ${student.alergias ? `<div class="alert alert-danger border-0 py-2 px-3 small mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Alergias:</strong> ${escapeHtml(student.alergias)}</div>` : ''}
      `;
    }

    const historyEl = document.getElementById('soap-history-list');
    if (historyEl) {
      historyEl.innerHTML = '<div class="text-center text-muted extra-small py-2"><span class="spinner-border spinner-border-sm"></span></div>';
      const profId = _currentProfile ? _currentProfile.id : null;
      MediService.getExpedienteHistory(_ctx, student.uid || cita.studentId, _myRole, _myUid, _currentShift, profId)
        .then(history => {
          if (!history || history.length === 0) {
            historyEl.innerHTML = '<div class="text-muted extra-small py-2 text-center">Sin consultas previas</div>';
            return;
          }
          historyEl.innerHTML = history.slice(0, 5).map(h => {
            const d = h.safeDate || new Date();
            return `<div class="list-group-item list-group-item-action px-0 py-2 border-bottom border-light bg-transparent">
               <div class="d-flex w-100 justify-content-between mb-1">
                 <h6 class="mb-0 fw-bold small text-truncate" style="max-width: 70%;">${escapeHtml(h.diagnostico || h.motivo || 'General')}</h6>
                 <small class="text-muted" style="font-size: 0.65rem;">${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
               </div>
               <div class="mb-0 small text-muted text-truncate">${escapeHtml(h.tipoServicio || '')}</div>
             </div>`;
          }).join('');
        })
        .catch(e => {
          historyEl.innerHTML = '<div class="text-danger extra-small py-2">Error cargando historial</div>';
        });
    }

    // Start consultation timer
    _startConsultaTimer();


  }


  // --- B3: INLINE CONSULTATION (Zona B) ---

  function renderInlineConsultationUI(u, cita) {
    const container = document.getElementById('soap-fields-container') || document.getElementById('medi-inline-consulta');
    if (!container) return;

    const safeName = escapeHtml(u.displayName || u.email || '');
    const safeMatricula = escapeHtml(u.matricula || 'Ext');
    const initial = (u.displayName || u.email || 'P')[0].toUpperCase();
    const COLORS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'],
    ['#fce7f3', '#9d174d'], ['#fef3c7', '#92400e'], ['#fee2e2', '#991b1b']];
    const [bgC, fgC] = COLORS[initial.charCodeAt(0) % COLORS.length];

    // --- HEADER DEL PACIENTE ---
    const patientHeader = `
        <div class="d-flex align-items-center gap-3 p-3 mb-3 rounded-3 border-0"
             style="background:linear-gradient(135deg,#f0f7ff,#e8f4fd);">
        <div class="medi-avatar flex-shrink-0" style="background:${bgC};color:${fgC};width:44px;height:44px;font-size:1.1rem;">${initial}</div>
        <div class="flex-fill">
          <div class="fw-bold text-dark" style="font-size:.9rem;">${safeName}</div>
          <div class="text-muted" style="font-size:.7rem;">${safeMatricula}</div>
        </div>
        <div class="text-end">
          <div class="text-muted fw-bold" style="font-size:.75rem;">
            ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} <br>
            <span style="font-size:.65rem; font-weight:normal;">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>`;

    let formContent = '';

    if (_myRole === 'Médico') {
      formContent = `
        <div class="mb-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="badge bg-primary-subtle text-primary border" style="font-size:.62rem;">
              <i class="bi bi-activity me-1"></i>SIGNOS VITALES
            </span>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <div class="soap-vital-pill">
              <label for="soap-temp">Temp °C</label>
              <input type="number" id="soap-temp" placeholder="--" step="0.1">
            </div>
            <div class="soap-vital-pill">
              <label for="soap-presion">Presion</label>
              <input type="text" id="soap-presion" placeholder="000/00">
            </div>
            <div class="soap-vital-pill">
              <label for="soap-peso">Peso kg</label>
              <input type="number" id="soap-peso" placeholder="--" step="0.1">
            </div>
            <div class="soap-vital-pill">
              <label for="soap-talla">Talla cm</label>
              <input type="number" id="soap-talla" placeholder="--">
            </div>
          </div>
        </div>

        <!-- S - Subjetivo -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-primary text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">S</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Subjetivo — Motivo</label>
          </div>
          <textarea class="form-control form-control-sm bg-light border-0 rounded-3"
                    id="soap-subjetivo" rows="2" placeholder="Motivo de consulta segun el paciente..."></textarea>
        </div>

        <!-- O - Objetivo -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-success text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">O</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Objetivo — Exploracion</label>
          </div>
          <textarea class="form-control form-control-sm bg-light border-0 rounded-3"
                    id="soap-objetivo" rows="2" placeholder="Hallazgos clinicos, exploracion fisica..."></textarea>
        </div>

        <!-- Padecimiento Privado -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-danger text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;"><i class="bi bi-lock-fill" style="font-size:.5rem;"></i></span>
            <label class="fw-bold text-danger mb-0" style="font-size:.78rem;">Padecimiento Actual (Privado)</label>
          </div>
          <textarea class="form-control form-control-sm bg-danger-subtle border-danger-subtle rounded-3"
                    id="soap-private-notes" rows="2" placeholder="Notas privadas del padecimiento..."></textarea>
        </div>

        <!-- A - Diagnostico -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill bg-warning text-dark fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">A</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Diagnostico (Assessment)</label>
          </div>
          <input type="text" class="form-control form-control-sm fw-bold rounded-3 border-0 bg-light"
                 id="soap-diagnóstico" placeholder="Diagnostico principal...">
        </div>

        <!--P - Plan-- >
  <div class="mb-2">
    <div class="d-flex align-items-center gap-2 mb-1">
      <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#0f766e;">P</span>
      <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Plan de Tratamiento</label>
    </div>
    <textarea class="form-control form-control-sm bg-success-subtle border-success-subtle rounded-3"
      id="soap-plan" rows="3" placeholder="Indicaciones, medicamentos, referencias..."></textarea>
  </div>
`;
    } else {
      // VISTA PSICOLOGO
      formContent = `
        <div class="mb-3 p-3 rounded-3 border-0" style="background:rgba(124,58,237,.06);">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="badge border fw-bold" style="font-size:.62rem;background:rgba(124,58,237,.1);color:#7c3aed;">
              <i class="bi bi-brain me-1"></i>EVALUACION PSICOLOGICA
            </span>
          </div>
          <div class="row g-2">
            <div class="col-6">
              <label class="d-block fw-bold mb-1" style="font-size:.68rem;color:#7c3aed;">Estado Emocional</label>
              <select id="soap-estado-emocional" class="form-select form-select-sm border-0 fw-bold rounded-3">
                <option value="">Seleccionar...</option>
                <option value="Estable">Estable</option>
                <option value="Ansioso/a">Ansioso/a</option>
                <option value="Deprimido/a">Deprimido/a</option>
                <option value="Agitado/a">Agitado/a</option>
                <option value="En crisis">En crisis</option>
                <option value="Inestable">Inestable</option>
                <option value="Recuperacion">En recuperacion</option>
              </select>
            </div>
            <div class="col-6">
              <label class="d-block fw-bold mb-1" style="font-size:.68rem;color:#7c3aed;">Tipo de Intervencion</label>
              <select id="soap-tipo-intervencion" class="form-select form-select-sm border-0 fw-bold rounded-3">
                <option value="">Seleccionar...</option>
                <option value="Orientación">Orientación</option>
                <option value="Apoyo emocional">Apoyo emocional</option>
                <option value="Psicoterapia breve">Psicoterapia breve</option>
                <option value="Crisis">Intervencion en crisis</option>
                <option value="Referencia">Referencia externa</option>
              </select>
            </div>
          </div>
        </div>

        <!-- S -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#7c3aed;">S</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Subjetivo — Motivo de consulta</label>
          </div>
          <textarea class="form-control form-control-sm bg-light border-0 rounded-3"
                    id="soap-subjetivo" rows="2" placeholder="Motivo segun el paciente..."></textarea>
        </div>

        <!--O -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#0891b2;">O</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Objetivo — Observaciones</label>
          </div>
          <textarea class="form-control form-control-sm bg-light border-0 rounded-3"
                    id="soap-objetivo" rows="2" placeholder="Comportamiento observado, lenguaje corporal..."></textarea>
        </div>

        <!--A -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-dark fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#fbbf24;">A</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Diagnostico / Evaluacion</label>
          </div>
          <input type="text" class="form-control form-control-sm fw-bold rounded-3 border-0 bg-light"
                 id="soap-diagn\u00f3stico" placeholder="Diagnostico o impresion clinica...">
        </div>

        <!--P -->
        <div class="mb-2">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#0f766e;">P</span>
            <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Plan de Intervencion</label>
          </div>
          <textarea class="form-control form-control-sm bg-success-subtle border-success-subtle rounded-3"
                    id="soap-plan" rows="2" placeholder="Acciones, seguimiento, derivacion..."></textarea>
        </div>

        <!--Notas Privadas-- >
  <div class="mb-2">
    <div class="d-flex align-items-center gap-2 mb-1">
      <span class="badge rounded-pill text-white fw-bold" style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#dc2626;"><i class="bi bi-shield-lock-fill" style="font-size:.5rem;"></i></span>
      <label class="fw-bold text-dark mb-0" style="font-size:.78rem;">Notas Privadas (Confidencial)</label>
    </div>
    <textarea class="form-control form-control-sm border-warning bg-warning-subtle rounded-3"
      id="soap-private-notes" rows="2" placeholder="Notas confidenciales del psicologo..."></textarea>
  </div>
`;
    }

    container.innerHTML = patientHeader + formContent;
  }

  // --- CONSULTATION TIMER ---
  function _startConsultaTimer() {
    _stopConsultaTimer();
    _consultaStartTime = new Date();
    const timerEl = document.getElementById('consulta-timer');
    _consultaTimer = setInterval(() => {
      if (!timerEl) return;
      const elapsed = Math.floor((Date.now() - _consultaStartTime.getTime()) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      timerEl.textContent = mins + ':' + secs;
      // Color change after 20 min
      if (elapsed > 1200) timerEl.classList.replace('bg-dark', 'bg-warning');
    }, 1000);
  }

  function _stopConsultaTimer() {
    if (_consultaTimer) { clearInterval(_consultaTimer); _consultaTimer = null; }
  }

  function _getConsultaDurationMinutes() {
    if (!_consultaStartTime) return 0;
    return Math.round((Date.now() - _consultaStartTime.getTime()) / 60000);
  }



  // --- C4: TEMPLATES REMOVED ---


  // --- CLEANUP CONSULTATION ---
  function _cleanupConsultation() {
    _stopConsultaTimer();
    _consultaActive = false;
    _consultaStartTime = null;

    // Reset Zona B to agenda
    const tabBtn = document.getElementById('tab-btn-consulta');
    if (tabBtn) { tabBtn.disabled = true; tabBtn.classList.remove('text-danger'); }
    _switchWorkTab('agenda');

    // Clear inline container
    const container = document.getElementById('medi-inline-consulta');
    if (container) container.innerHTML = '';
  }

  // --- C5: CHAT SYSTEM (Admin Side - Zona C Messages Tab) ---
  let _chatUnsub = null;
  let _chatMsgsUnsub = null;
  let _chatUnreadUnsub = null;
  let _activeConvId = null;

  function initAdminChat() {
    if (!window.MediChatService) return;

    // Stream conversations list
    if (_chatUnsub) _chatUnsub();
    _chatUnsub = MediChatService.streamConversations(
      _ctx, _myUid, 'profesional', _currentProfile ? _currentProfile.id : null,
      (convs) => { _renderConversationList(convs); }
    );

    // Stream unread badge
    if (_chatUnreadUnsub) _chatUnreadUnsub();
    _chatUnreadUnsub = MediChatService.streamUnreadCount(
      _ctx, _myUid, 'profesional', _currentProfile ? _currentProfile.id : null,
      (count) => {
        const badge = document.getElementById('badge-unread-msgs');
        if (badge) {
          badge.textContent = count;
          badge.classList.toggle('d-none', count === 0);
        }
      }
    );
  }

  function _renderConversationList(convs) {
    const panel = document.getElementById('medi-chat-panel');
    const tab = document.getElementById('medi-tab-messages');

    // Show/Hide Tab based on activity
    if (tab) {
      if (convs.length > 0) tab.classList.remove('d-none');
      // We don't hide it automatically if 0, to avoid UI jumping if they just deleted one? 
      // Or yes, hide if 0? Business rule: "Solo cuando...". So yes if 0, hide.
      // BUT if I am currently IN the tab, hiding it would remain blank content.
      // Let's safe check: if active tab is messages, don't hide immediately? 
      // Or just leave it visible once shown? Plan said "Solo cuando hay...".
      // Let's stick to simple:
      tab.classList.toggle('d-none', convs.length === 0);
    }

    if (!panel) return;

    if (convs.length === 0) {
      panel.innerHTML = `< div class="text-center py-4 text-muted small" >
        <i class="bi bi-chat-square-dots display-6 d-block mb-2 opacity-25"></i>
        <p style="font-size:.75rem;">Sin conversaciones activas</p>
      </div > `;
      return;
    }

    // If we have an active conversation open, don't replace the chat view
    if (_activeConvId) return;
    // Extra safety: If DOM shows we are in chat view, abort list render
    if (document.getElementById('chat-messages-list')) return;

    panel.innerHTML = `
  < div class="list-group list-group-flush" >
    ${convs.map(c => {
      const unread = c.unreadByProfesional || 0;
      const lastTime = c.lastMessageAt ? (typeof c.lastMessageAt.toDate === 'function' ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt)) : null;
      const timeStr = lastTime ? lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
            <div class="list-group-item border-0 border-bottom px-2 py-2 cursor-pointer" style="cursor:pointer;"
                 onclick="AdminMedi.openConversation('${c.id}', '${escapeHtml(c.studentName)}')">
              <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2" style="min-width:0;">
                  <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;">
                    <span class="fw-bold text-primary" style="font-size:.7rem;">${escapeHtml((c.studentName || 'E')[0])}</span>
                  </div>
                  <div style="min-width:0;">
                    <div class="fw-bold text-truncate" style="font-size:.8rem;">${escapeHtml(c.studentName || 'Estudiante')}</div>
                    <div class="text-muted text-truncate" style="font-size:.65rem;">${escapeHtml(c.lastMessage || '')}</div>
                  </div>
                </div>
                <div class="text-end flex-shrink-0">
                  <div class="text-muted" style="font-size:.6rem;">${timeStr}</div>
                  ${unread > 0 ? '<span class="badge bg-danger rounded-pill" style="font-size:.6rem;">' + unread + '</span>' : ''}
                </div>
              </div>
            </div>`;
    }).join('')
      }
      </div > `;
  }

  function openConversation(convId, studentName) {
    _activeConvId = convId;
    const panel = document.getElementById('medi-chat-panel');
    if (!panel) return;

    panel.innerHTML = `
  < div class="d-flex flex-column h-100" style = "max-height:calc(100vh - 260px);" >
        <div class="d-flex align-items-center gap-2 pb-2 border-bottom mb-2">
          <button class="btn btn-sm btn-light rounded-circle" onclick="AdminMedi.closeChatConversation()"><i class="bi bi-arrow-left"></i></button>
          <div class="fw-bold" style="font-size:.85rem;">${escapeHtml(studentName || 'Estudiante')}</div>
        </div>
        <div id="chat-messages-list" class="flex-grow-1 overflow-auto mb-2" style="min-height:0;"></div>
        <div class="d-flex gap-1">
          <input type="text" id="chat-input" class="form-control form-control-sm rounded-pill" placeholder="Escribe un mensaje..."
                 onkeypress="if(event.key==='Enter')AdminMedi.sendChatMessage()">
          <button class="btn btn-sm btn-primary rounded-circle flex-shrink-0" onclick="AdminMedi.sendChatMessage()" style="width:32px;height:32px;">
            <i class="bi bi-send-fill" style="font-size:.7rem;"></i>
          </button>
        </div>
      </div > `;

    // Stream messages
    if (_chatMsgsUnsub) _chatMsgsUnsub();
    _chatMsgsUnsub = MediChatService.streamMessages(_ctx, convId, (msgs) => {
      _renderMessages(msgs);
    });

    // Mark as read
    MediChatService.markAsRead(_ctx, convId, 'profesional');
  }

  function _renderMessages(msgs) {
    const container = document.getElementById('chat-messages-list');
    if (!container) return;

    if (msgs.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4" style="font-size:.75rem;">Inicia la conversacion</div>';
      return;
    }

    container.innerHTML = msgs.map(m => {
      const isMe = m.senderRole === 'profesional';
      const time = m.createdAt ? (typeof m.createdAt.toDate === 'function' ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
      const timeStr = time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
  < div class="d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'} mb-1" >
    <div class="px-2 py-1 rounded-3 ${isMe ? 'bg-primary text-white' : 'bg-light'}" style="max-width:80%;font-size:.75rem;">
      <div>${escapeHtml(m.text)}</div>
      <div class="${isMe ? 'text-white-50' : 'text-muted'} text-end" style="font-size:.55rem;">${timeStr}</div>
    </div>
        </div > `;
    }).join('');

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim() || !_activeConvId) return;

    const text = input.value.trim();
    input.value = '';

    try {
      const senderName = _currentProfile ? _currentProfile.displayName : (_ctx.profile.displayName || _ctx.auth.currentUser.email);
      await MediChatService.sendMessage(_ctx, _activeConvId, _myUid, senderName, 'profesional', text);
    } catch (e) {
      console.error('Send message error:', e);
      showToast('Error al enviar mensaje', 'danger');
    }
  }

  function closeChatConversation() {
    _activeConvId = null;
    if (_chatMsgsUnsub) { _chatMsgsUnsub(); _chatMsgsUnsub = null; }

    // Clear the panel so _renderConversationList doesn't think we are still in chat view
    const panel = document.getElementById('medi-chat-panel');
    if (panel) panel.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-primary"></span></div>';
    // Re-render conversation list
    if (_chatUnsub) _chatUnsub();
    _chatUnsub = MediChatService.streamConversations(
      _ctx, _myUid, 'profesional', _currentProfile ? _currentProfile.id : null,
      (convs) => { _renderConversationList(convs); }
    );
  }

  // Start chat with a specific student (from search, waiting room, etc.)
  async function startChatWith(studentId, studentName) {
    if (!window.MediChatService) { showToast('Chat no disponible', 'warning'); return; }

    try {
      const profName = _currentProfile ? _currentProfile.displayName : (_ctx.profile.displayName || _ctx.auth.currentUser.email);
      const conv = await MediChatService.getOrCreateConversation(
        _ctx, _myUid, profName, studentId, studentName, _myRole,
        _currentProfile ? _currentProfile.id : null
      );

      // Switch to messages tab and open conversation
      const tab = document.getElementById('medi-tab-messages');
      if (tab) tab.classList.remove('d-none');
      _switchContextTab('messages');
      openConversation(conv.id, studentName);
    } catch (e) {
      console.error(e);
      showToast('Error al iniciar chat', 'danger');
    }
  }

  async function loadMiniHistorySidebar(uid) {
    const w = document.getElementById('mini-history-widget');
    try {
      // Fetch last 5, limit to 3 in UI
      // FIX: Pass _currentProfile.id
      const docs = await MediService.getExpedienteHistory(_ctx, uid, _myRole, _myUid, _currentShift, _currentProfile ? _currentProfile.id : null);
      if (docs.length === 0) {
        w.innerHTML = '<div class="text-center text-muted fst-italic py-2">Sin historial previo.</div>';
        return;
      }

      w.innerHTML = docs.slice(0, 3).map(d => `
  < div class="list-group-item px-0 py-2 border-bottom-0" >
                    <div class="d-flex w-100 justify-content-between">
                        <strong class="text-primary" style="font-size:0.75rem;">${d.safeDate ? d.safeDate.toLocaleDateString() : 'N/D'}</strong>
                        <small class="badge bg-light text-dark border scale-75">${d.tipoServicio?.substring(0, 3)}</small>
                    </div>
                    <p class="mb-0 text-truncate text-muted" style="font-size: 0.75rem;">${d.diagnostico || '...'}</p>
                </div >
  `).join('');

    } catch (e) {
      console.error(e);
      w.innerHTML = '<div class="text-danger extra-small">Error al cargar.</div>';
    }
  }

  // Carga Historial con Mix de Permisos (Reconstruida)
  async function loadHistory(uid) {
    const list = document.getElementById('soap-history-list');
    list.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></div>';

    try {
      // FIX: Pass _currentProfile.id to allow filtering by profile
      const docs = await MediService.getExpedienteHistory(_ctx, uid, _myRole, _myUid, _currentShift, _currentProfile ? _currentProfile.id : null);

      if (docs.length === 0) {
        list.innerHTML = '<div class="text-muted small text-center mt-4">Sin historial visible.</div>';
        return;
      }

      list.innerHTML = docs.map(exp => {
        const fecha = exp.safeDate ? exp.safeDate.toLocaleDateString() : '-';
        const isPsico = exp.tipoServicio === 'Psicologico' || exp.tipoServicio === 'Psicologo';
        const borderClass = isPsico ? 'border-start border-4 border-purple' : 'border-start border-4 border-info';

        const safeExp = encodeURIComponent(JSON.stringify(exp));

        return `
  < div class="card mb-2 shadow-sm ${borderClass} card-hover-effect"
onclick = "AdminMedi.showConsultationDetails('${safeExp}')"
style = "cursor: pointer;" >
  <div class="card-body p-2">
    <div class="d-flex justify-content-between small mb-1">
      <span class="fw-bold">${fecha}</span>
      <span class="badge bg-light text-dark border">${exp.tipoServicio}</span>
    </div>
    <div class="small text-muted fst-italic mb-1 text-truncate">
      ${exp.diagnostico || 'Sin diagnóstico'}
    </div>
    <div class="text-end mt-1">
      <small class="text-primary fw-bold" style="font-size: 0.75rem;">Ver detalles <i class="bi bi-chevron-right"></i></small>
    </div>
  </div>
           </div > `;
      }).join('');
    } catch (e) {
      console.error("Error historial:", e);
      list.innerHTML = '<div class="alert alert-warning small p-2">Error cargando historial.</div>';
    }
  }


  function confirmarFinalizacion() {
    // Validaciones eliminadas a peticion del usuario (16-Feb-2026)
    // Mostrar modal confirmación directamente
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmEnd'));
    modal.show();
  }



  async function saveConsultation(e, isFinal = true, statusOverride = null) {
    if (e) e.preventDefault();
    if (_isSaving) return; // Block duplicate calls
    if (document.activeElement) document.activeElement.blur();

    // Manejo de UI: Spinner y deshabilitar botones
    const btnFinalizar = document.getElementById('btn-finalizar-consulta');
    const btnCancelarF = document.getElementById('btn-cancelar-finalizar');

    if (isFinal) {
      if (btnFinalizar) {
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
      }
      if (btnCancelarF) btnCancelarF.disabled = true;
      // Retrasamos el cierre del modal hasta que se complete (ver try/catch abajo)
    }

    const studentIdEl = document.getElementById('soap-student-id');
    if (!studentIdEl) return; // No active consultation

    const studentId = studentIdEl.value;
    const studentEmail = document.getElementById('soap-student-email').value;
    const citaId = document.getElementById('soap-cita-id').value;

    let status = 'finalizada'; // Always final if saving
    if (!isFinal) return;

    _isSaving = true; // Lock

    const payload = {
      studentId, studentEmail,
      autorId: _myUid,
      autorEmail: _ctx.auth.currentUser.email,
      tipoServicio: _myRole === 'Psicologo' ? 'Psicologico' : _myRole,
      shift: _currentShift,
      profesionalProfileId: _currentProfile ? _currentProfile.id : null,
      profesionalName: _currentProfile ? _currentProfile.displayName : null,
      cedula: _profesionalCedula || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      estado: status,
      duracionMinutos: _getConsultaDurationMinutes(),
      visiblePaciente: true,

      // SOAP FIELDS
      subjetivo: document.getElementById('soap-subjetivo')?.value || '',
      objetivo: document.getElementById('soap-objetivo')?.value || '',
      diagnostico: document.getElementById('soap-diagnóstico')?.value || '',
      plan: document.getElementById('soap-plan')?.value || '',
      // Capturamos Notas Privadas del ID unificado (está presente en ambos templates con el mismo ID)
      notasPrivadas: document.getElementById('soap-private-notes')?.value || ''
    };

    // Role-specific fields
    if (_myRole === 'Médico') {
      payload.temp = document.getElementById('soap-temp')?.value || null;
      payload.presion = document.getElementById('soap-presion')?.value || null;
      payload.peso = document.getElementById('soap-peso')?.value || null;
      payload.talla = document.getElementById('soap-talla')?.value || null;
    } else {
      // Psicologo fields
      payload.estadoEmocional = document.getElementById('soap-estado-emocional')?.value || null;
      payload.tipoIntervencion = document.getElementById('soap-tipo-intervencion')?.value || null;
      // Instrumentos removed
    }

    // Auto-Booking Logic for Follow-Up (Psicologo Only)
    const followUpCheck = document.getElementById('soap-followup-check');
    let followUpSuccess = false;

    if (followUpCheck && followUpCheck.checked) {
      const fDate = document.getElementById('soap-followup-date')?.value;
      const fTime = document.getElementById('soap-followup-time')?.value;
      const fNotes = document.getElementById('soap-followup-notes')?.value || 'Seguimiento';

      if (fDate && fTime) {
        try {
          // Construct Date Object
          const [year, month, day] = fDate.split('-').map(Number);
          const [hours, minutes] = fTime.split(':').map(Number);
          const appointmentDate = new Date(year, month - 1, day, hours, minutes);

          if (appointmentDate < new Date()) {
            showToast('La fecha de seguimiento no puede ser en el pasado.', 'warning');
            // Proceed saving consultation but warn? Or abort? User said "create appointment".
            // Let's assume we proceed but skip appointment creation to avoid error?
            // Or better: Let's try to book it.
          }

          // Compute slotId (Helpers available in Medi module scope?)
          // We need to call MediService helper or construct it manually.
          // medi-service.js: slotIdFromDate
          const pad = (n) => String(n).padStart(2, '0');
          const slotId = `${year} -${pad(month)} -${pad(day)}_${pad(hours)}:${pad(minutes)}_${_myRole} `;

          // Create User Object for booking
          const studentObj = {
            uid: studentId,
            email: studentEmail,
            displayName: document.querySelector('#medi-inline-consulta .fw-bold.text-dark')?.textContent || studentEmail
          };

          // Call Service
          await MediService.reservarCita(_ctx, {
            user: studentObj,
            date: appointmentDate,
            slotId: slotId,
            tipo: _myRole === 'Psicologo' ? 'Psicologo' : _myRole,
            motivo: fNotes,
            profesionalId: _myUid,
            profesionalName: _currentProfile ? _currentProfile.displayName : (_ctx.profile.displayName || _ctx.auth.currentUser.email),
            profesionalProfileId: _currentProfile ? _currentProfile.id : null
          });

          followUpSuccess = true;
          payload.followUp = { created: true, date: appointmentDate.toISOString(), notes: fNotes };
          showToast('Cita de seguimiento agendada correctamente', 'success');

        } catch (bookingErr) {
          console.error("Error booking follow-up:", bookingErr);
          showToast('No se pudo agendar el seguimiento: ' + bookingErr.message, 'warning');
          // Start save anyway, but mark failed
          payload.followUp = { created: false, error: bookingErr.message };
        }
      } else {
        // Marked checked but missing data
        showToast('Falta fecha u hora para el seguimiento. No se agendó.', 'warning');
      }
    }

    try {
      await MediService.saveConsulta(_ctx, payload, citaId);

      _lastConsultaData = {
        ...payload,
        doctorName: _ctx.profile.displayName || _ctx.auth.currentUser.email,
        cedula: _ctx.profile.cedula || ''
      };

      if (isFinal && status === 'finalizada') {
        const confirmModal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmEnd'));
        if (confirmModal) confirmModal.hide();

        // Reset botones por si se reabre
        if (btnFinalizar) {
          btnFinalizar.disabled = false;
          btnFinalizar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar';
        }
        if (btnCancelarF) btnCancelarF.disabled = false;

        // Cleanup inline consultation
        _cleanupConsultation();

        // [ENCUESTAS] Registrar uso
        // [ENCUESTAS] Registrar uso
        if (window.EncuestasServicioService) {
          await EncuestasServicioService.registerServiceUsage(
            _ctx,
            _myRole === 'Psicologo' ? 'psicologia' : 'servicio-medico',
            {
              action: 'consulta_finalizada',
              studentId: studentId
            },
            studentId // <--- CRITICAL FIX: Target UID (Student)
          );

          // Trigger Survey Check Immediately
          if (window.Encuestas && window.Encuestas.checkAndShowServiceSurvey) {
            setTimeout(() => {
              window.Encuestas.checkAndShowServiceSurvey(_myRole === 'Psicologo' ? 'psicologia' : 'servicio-medico');
            }, 1500);
          }
        }

        // Close any lingering modal
        const modalConsulta = bootstrap.Modal.getInstance(document.getElementById('modalConsulta'));
        if (modalConsulta) modalConsulta.hide();

        // Show success/print modal
        setTimeout(() => {
          new bootstrap.Modal(document.getElementById('modalSuccessConsulta')).show();
        }, 200);
      }

    } catch (err) {
      console.error(err);
      showToast('Error al guardar consulta: ' + err.message, 'danger');
      if (isFinal) {
        if (btnFinalizar) {
          btnFinalizar.disabled = false;
          btnFinalizar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar';
        }
        if (btnCancelarF) btnCancelarF.disabled = false;
      }
    } finally {
      _isSaving = false; // Unlock
    }
  }

  function cerrarSuccessModal() {
    const m = bootstrap.Modal.getInstance(document.getElementById('modalSuccessConsulta'));
    if (m) m.hide();
    refreshAdmin(); // Actualizar lista de espera/agenda
  }

  /* Legacy buscarPaciente removed (Unified in Doctor View) */




  // --- SIDEBAR HELPER (ÚLTIMA VISITA + EXPEDIENTE) ---
  async function loadPatientSidebarWait(student) {
    const profileDiv = document.getElementById('soap-patient-profile');
    profileDiv.innerHTML = '<div class="text-center p-2"><span class="spinner-border spinner-border-sm"></span> Cargando datos...</div>';

    // 1. Fetch Last Visit (Consulta más reciente con signos vitales)
    let lastVitals = null;
    try {
      // Pass _myRole so we get all relevant history (Medical + My Psych if applicable)
      const hist = await MediService.getExpedienteHistory(_ctx, student.uid, _myRole, _myUid, _currentShift, _currentProfile ? _currentProfile.id : null);
      if (hist && hist.length > 0) {
        // Prioritize Medical Vitals if available (Physical health source of truth)
        let found = hist.find(h => h.tipoServicio === 'Médico' && h.signos && (h.signos.peso || h.signos.presion));

        // Fallback: If no Medical vitals, take any available (e.g. from Psych if they took them)
        if (!found) found = hist.find(h => h.signos && (h.signos.peso || h.signos.presion));

        if (found) lastVitals = { date: found.safeDate, ...found.signos };
      }
    } catch (e) { console.error("Error fetching last vitals", e); }

    profileDiv.innerHTML = `
  < div class="p-3 bg-white rounded-4 shadow-sm border mb-3" >
                 <h6 class="fw-bold text-dark small mb-2 text-uppercase ls-1">Datos Médicos Clave</h6>
                 <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                    <span class="text-muted small">Tipo Sangre</span>
                    <span class="fw-bold text-danger">${student.tipoSangre || '--'}</span>
                 </div>
                 <div class="mb-2">
                    <span class="text-muted small d-block">Alergias</span>
                    <span class="fw-bold text-dark small">${student.alergias || 'Ninguna'}</span>
                 </div>
                 <div>
                    <span class="text-muted small d-block">Condiciones / Crónicos</span>
                    <span class="fw-bold text-dark small">${student.discapacidad || 'Ninguna'}</span>
                 </div>
            </div >

            <div class="p-3 bg-primary-subtle rounded-4 border border-primary-subtle mb-3">
                 <h6 class="fw-bold text-primary small mb-2 text-uppercase ls-1"><i class="bi bi-clock-history me-1"></i> Última Visita</h6>
                 ${lastVitals ? `
                    <div class="row g-2 text-center">
                        <div class="col-4">
                            <div class="bg-white rounded-3 p-1 shadow-sm">
                                <span class="d-block extra-small text-muted fw-bold">PESO</span>
                                <span class="fw-bold text-dark small">${lastVitals.peso || '--'} kg</span>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="bg-white rounded-3 p-1 shadow-sm">
                                <span class="d-block extra-small text-muted fw-bold">TALLA</span>
                                <span class="fw-bold text-dark small">${lastVitals.talla || '--'} cm</span>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="bg-white rounded-3 p-1 shadow-sm">
                                <span class="d-block extra-small text-muted fw-bold">P/A</span>
                                <span class="fw-bold text-dark small">${lastVitals.presion || '--'}</span>
                            </div>
                        </div>
                        <div class="col-12 mt-2">
                             <small class="extra-small text-muted fst-italic">Registrado: ${lastVitals.date ? lastVitals.date.toLocaleDateString() : 'Anterior'}</small>
                        </div>
                    </div>
                 ` : '<div class="text-center small text-muted fst-italic py-2">Sin registros previos de signos vitales.</div>'}
            </div>

            <button class="btn btn-outline-dark btn-sm w-100 rounded-pill fw-bold" onclick="AdminMedi.showFullRecord('${student.uid}')">
                <i class="bi bi-folder2-open me-2"></i> Ver Expediente Completo
            </button>
`;
  }

  // --- FULL RECORD MODAL (MASTER-DETAIL) ---
  async function showFullRecord(uid) {
    // 1. Prepare Modal Container (Large)
    let modalEl = document.getElementById('modalFullRecord');
    if (!modalEl) {
      const div = document.createElement('div');
      div.id = 'modalFullRecord';
      div.className = 'modal fade';
      // Added modal-xl for more space
      div.innerHTML = `
  < div class="modal-dialog modal-xl modal-dialog-scrollable" >
    <div class="modal-content rounded-4 border-0 shadow-lg" style="height: 90vh;">
      <div class="modal-header bg-dark text-white py-2">
        <div class="d-flex align-items-center gap-3">
          <h5 class="modal-title filter-white fw-bold mb-0">Expediente Clínico</h5>
          <span class="badge bg-white text-dark rounded-pill" id="full-record-badge">--</span>
        </div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-0 bg-light">
        <div class="row g-0 h-100">
          <!-- LEFT SIDEBAR: LIST & SUMMARY (35%) -->
          <div class="col-lg-4 border-end bg-white h-100 overflow-auto" id="full-record-sidebar">
            <div class="text-center p-5"><span class="spinner-border text-primary"></span></div>
          </div>

          <!-- RIGHT CONTENT: DETAILS (65%) -->
          <div class="col-lg-8 h-100 overflow-auto bg-light" id="full-record-content">
            <div class="d-flex flex-column justify-content-center align-items-center h-100 text-muted opacity-50">
              <i class="bi bi-arrow-left-circle display-1 mb-3"></i>
              <p class="fw-bold">Selecciona una consulta para ver detalles</p>
            </div>
          </div>
        </div>
      </div>
    </div>
                </div >
  `;
      document.body.appendChild(div);
      modalEl = div;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // 2. Fetch Data
    const sidebar = document.getElementById('full-record-sidebar');
    const content = document.getElementById('full-record-content');

    try {
      const [userSnap, history] = await Promise.all([
        _ctx.db.collection('usuarios').doc(uid).get(),
        MediService.getExpedienteHistory(_ctx, uid, _myRole, _myUid, _currentShift, _currentProfile ? _currentProfile.id : null)
      ]);

      if (!userSnap.exists) {
        sidebar.innerHTML = '<div class="p-3 text-danger">Usuario no encontrado.</div>';
        return;
      }
      const u = userSnap.data();

      // Update Header Badge
      document.getElementById('full-record-badge').textContent = u.matricula || 'S/M';

      // Update Header Badge with avatar
      const uInitial = (u.displayName || u.email || 'P')[0].toUpperCase();
      const UCOLORS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'], ['#fce7f3', '#9d174d']];
      const [ubg, ufg] = UCOLORS[uInitial.charCodeAt(0) % UCOLORS.length];
      document.getElementById('full-record-badge').textContent = u.matricula || 'S/M';

      // RENDER SIDEBAR
      sidebar.innerHTML = `
  < !--MINI PROFILE con avatar-- >
        <div class="p-4 border-bottom" style="background:linear-gradient(135deg,#f8faff,#f0f7ff);">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="medi-avatar flex-shrink-0" style="background:${ubg};color:${ufg};width:48px;height:48px;font-size:1.25rem;">${uInitial}</div>
            <div>
              <div class="fw-bold text-dark" style="font-size:.9rem;">${u.displayName}</div>
              <div class="text-muted" style="font-size:.72rem;">${u.email}</div>
            </div>
          </div>
          <div class="d-flex gap-2 mb-3">
            <div class="flex-fill text-center p-2 rounded-3 border bg-white">
              <div class="fw-bold text-danger" style="font-size:.95rem;">${u.tipoSangre || '--'}</div>
              <div class="text-muted" style="font-size:.6rem;font-weight:600;">SANGRE</div>
            </div>
            <div class="flex-fill text-center p-2 rounded-3 border bg-white">
              <div class="fw-bold text-dark" style="font-size:.95rem;">${u.edad || MediService.calculateAge(u.fechaNacimiento) || '--'}</div>
              <div class="text-muted" style="font-size:.6rem;font-weight:600;">EDAD</div>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2 p-2 rounded-3" style="background:rgba(220,38,38,.07);">
            <i class="bi bi-exclamation-circle-fill text-danger flex-shrink-0"></i>
            <div class="small"><span class="fw-bold text-muted">Alergias: </span>${u.alergias || 'Ninguna'}</div>
          </div>
        </div>

        <!--HISTORY LIST-- >
  <div class="p-3">
    <div class="d-flex align-items-center justify-content-between mb-3 px-1">
      <span class="text-uppercase text-muted fw-bold" style="font-size:.65rem;letter-spacing:.5px;">Historial de Visitas</span>
      <span class="badge bg-light text-muted border" id="fr-visit-count" style="font-size:.65rem;"></span>
    </div>
    <div id="fr-history-list"></div>
  </div>
`;

      // RENDER HISTORY ITEMS
      const listContainer = document.getElementById('fr-history-list');
      const visitBadge = document.getElementById('fr-visit-count');

      if (history.length === 0) {
        listContainer.innerHTML = '<div class="medi-empty-state py-4"><i class="bi bi-clipboard-x"></i><p>Sin historial disponible</p></div>';
        if (visitBadge) visitBadge.textContent = '0 visitas';
        renderGeneralFile(content, u);
      } else {
        if (visitBadge) visitBadge.textContent = `${history.length} visitas`;
        listContainer.innerHTML = history.map((item, index) => {
          const dateObj = item.safeDate ? new Date(item.safeDate) : new Date();
          const isPsico = (item.tipoServicio || '').toLowerCase().includes('psico');
          const safeItem = encodeURIComponent(JSON.stringify(item));
          const timeAgo = (() => {
            const d = Math.floor((new Date() - dateObj) / 86400000);
            if (d === 0) return 'Hoy'; if (d === 1) return 'Ayer';
            if (d < 7) return `Hace ${d} dias`;
            return dateObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
          })();

          return `
  < button class="fr-history-item ${isPsico ? 'psico' : ''} w-100 text-start bg-white border-0 p-3 mb-2 rounded-3 shadow-sm fade-slide-in"
onclick = "AdminMedi.renderConsultationDetail(this,'${safeItem}')" >
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge border fw-bold" style="font-size:.58rem;${isPsico ? 'background:rgba(124,58,237,.1);color:#7c3aed;' : 'background:rgba(13,110,253,.1);color:#0d6efd;'}">
                  ${isPsico ? '<i class="bi bi-chat-heart-fill me-1"></i>Psicología' : '<i class="bi bi-bandaid-fill me-1"></i>Medicina'}
                </span>
                <span class="text-muted" style="font-size:.65rem;">${timeAgo}</span>
              </div>
              <div class="fw-bold text-dark text-truncate mb-1" style="font-size:.82rem;">${item.diagnostico || 'Sin diagnostico'}</div>
              <div class="text-muted text-truncate" style="font-size:.7rem;">${item.subjetivo || 'Sin detalles...'}</div>
            </button > `;
        }).join('');

        renderGeneralFile(content, u);
      }
    } catch (e) {
      console.error(e);
      const sidebar = document.getElementById('full-record-sidebar');
      if (sidebar) sidebar.innerHTML = `< div class="alert alert-danger m-3" > Error cargando datos: ${e.message}</div > `;
    }
  }

  // --- RENDERIZADORES INTERNOS (Nuevos Helpers) ---

  function renderGeneralFile(container, u) {
    container.innerHTML = `
  < div class="p-4 fade-slide-in" >
        <div class="d-flex align-items-center justify-content-between mb-4">
          <h5 class="fw-bold text-dark mb-0">
            <i class="bi bi-person-vcard text-primary me-2"></i>Ficha General
          </h5>
          <span class="badge bg-primary-subtle text-primary border">Vista General</span>
        </div>

        <div class="row g-3">
          <!-- Info Personal -->
          <div class="col-md-6">
            <div class="card border-0 shadow-sm h-100 rounded-4">
              <div class="card-header bg-white border-0 py-3">
                <span class="fw-bold small" style="color:#1d4ed8;">
                  <i class="bi bi-person-fill me-1"></i>Información Personal
                </span>
              </div>
              <div class="card-body pt-0">
                <ul class="list-unstyled small mb-0 d-flex flex-column gap-2">
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Nombre</span><b>${u.displayName}</b></li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Matricula</span><span class="font-monospace">${u.matricula || '--'}</span></li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Carrera</span>${u.carrera || '--'}</li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Genero</span>${u.genero || (u.personalData && u.personalData.genero) || u.sexo || '--'}</li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Nacimiento</span>${u.fechaNacimiento || '--'}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Antecedentes -->
          <div class="col-md-6">
            <div class="card border-0 shadow-sm h-100 rounded-4" style="border-left:3px solid #dc3545 !important;">
              <div class="card-header bg-white border-0 py-3">
                <span class="fw-bold small text-danger">
                  <i class="bi bi-heart-pulse-fill me-1"></i>Antecedentes Médicos
                </span>
              </div>
              <div class="card-body pt-0">
                <ul class="list-unstyled small mb-0 d-flex flex-column gap-2">
                  <li class="d-flex gap-2">
                    <span class="text-muted" style="min-width:90px;">Tipo Sangre</span>
                    <b class="text-danger">${u.tipoSangre || '--'}</b>
                  </li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Alergias</span><b>${u.alergias || 'Ninguna'}</b></li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Discapacidad</span>${u.discapacidad || 'Ninguna'}</li>
                  <li class="d-flex gap-2"><span class="text-muted" style="min-width:90px;">Enf. Cronicas</span>${u.enfermedades || 'No'}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Contacto Emergencia -->
          <div class="col-12">
            <div class="card border-0 shadow-sm rounded-4">
              <div class="card-header bg-white border-0 py-3">
                <span class="fw-bold small text-warning">
                  <i class="bi bi-telephone-fill me-1"></i>Contacto de Emergencia
                </span>
              </div>
              <div class="card-body pt-0">
                <div class="row g-3">
                  <div class="col-md-6">
                    <small class="text-muted d-block">Nombre</small>
                    <b>${u.contactoEmergenciaName || u.contactoEmergencia || '--'}</b>
                  </div>
                  <div class="col-md-6">
                    <small class="text-muted d-block">Telefono</small>
                    <b>${u.contactoEmergenciaTel || u.telefonoEmergencia || '--'}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 text-center">
          <p class="text-muted small">Selecciona una consulta del panel izquierdo para ver los detalles clinicos.</p>
        </div>
      </div >
  `;
  }

  function renderConsultationDetail(btnEl, encodedItem) {
    // 1. UI Selection State
    const list = document.getElementById('fr-history-list');
    if (list) {
      list.querySelectorAll('.list-group-item').forEach(el => {
        el.classList.remove('bg-primary-subtle', 'border-primary', 'active-item');
        el.classList.add('border-bottom');
      });
    }
    if (btnEl) {
      btnEl.classList.add('bg-primary-subtle', 'border-primary', 'active-item');
      btnEl.classList.remove('border-bottom');
    }

    // 2. Decode Data
    const exp = JSON.parse(decodeURIComponent(encodedItem));
    const container = document.getElementById('full-record-content');
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();

    const isPsicologo = exp.tipoServicio === 'Psicologo' || exp.tipoServicio === 'Psicologico';
    const isMédico = !isPsicologo; // Assume Médico default

    // --- TEMPLATE COMPONENTS ---

    // A. Vitals (Médico Only)
    const vitalsHTML = (isMédico && exp.signos) ? `
  < div class="card border-0 shadow-sm mb-4 bg-light" >
    <div class="card-body py-3">
      <div class="row text-center g-2">
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">TEMP</small>
          <span class="fw-bold text-dark">${exp.signos.temp || '--'}°C</span>
        </div>
        <div class="vr opacity-25"></div>
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">PRESIÓN</small>
          <span class="fw-bold text-dark">${exp.signos.presion || '--'}</span>
        </div>
        <div class="vr opacity-25"></div>
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">PESO</small>
          <span class="fw-bold text-dark">${exp.signos.peso || '--'}kg</span>
        </div>
        <div class="vr opacity-25"></div>
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">TALLA</small>
          <span class="fw-bold text-dark">${exp.signos.talla || '--'}cm</span>
        </div>
      </div>
    </div>
        </div > ` : '';

    // B. Psych Header (Psych Only)
    const psychHeaderHTML = isPsicologo ? `
  < div class="row g-3 mb-4" >
             <div class="col-md-6">
                <div class="p-3 bg-purple-subtle rounded-3 border border-purple">
                    <small class="d-block text-purple fw-bold mb-1" style="font-size:0.7rem;">ESTADO EMOCIONAL</small>
                    <span class="fw-bold text-dark">${exp.estadoEmocional || 'No registrado'}</span>
                </div>
             </div>
             <div class="col-md-6">
                <div class="p-3 bg-white rounded-3 border shadow-sm">
                    <small class="d-block text-muted fw-bold mb-1" style="font-size:0.7rem;">INTERVENCIÓN</small>
                    <span class="fw-bold text-dark">${exp.tipoIntervencion || 'No registrado'}</span>
                </div>
             </div>
        </div >
  ` : '';

    // C. Padecimiento Actual (Private - Médico Only - Middle)
    // Only visible if viewer is Médico (or Admin/Same Role)
    const showPrivateNotesMédico = isMédico && exp.notasPrivadas && (_myRole === 'Médico');
    const padecimientoMédicoHTML = showPrivateNotesMédico ? `
  < div class="col-12" >
            <h6 class="fw-bold text-danger small mb-2"><i class="bi bi-lock-fill me-2"></i>Padecimiento Actual (Privado)</h6>
                <div class="bg-danger-subtle p-3 rounded-3 border border-danger-subtle text-dark">
                ${exp.notasPrivadas}
            </div>
        </div > ` : '';

    // D. Private Notes (Psych Only - Bottom)
    // Only visible if viewer is Psicologo
    const showPrivateNotesPsych = isPsicologo && exp.notasPrivadas && (_myRole === 'Psicologo');
    const notasPsychHTML = showPrivateNotesPsych ? `
  < div class="col-12 mt-2" >
    <div class="p-3 bg-warning-subtle border border-warning rounded-4 dashed-border">
      <h6 class="fw-bold text-dark extra-small mb-2"><i class="bi bi-shield-lock-fill me-1"></i> NOTAS PRIVADAS (Confidencial)</h6>
      <p class="mb-0 small text-dark" style="white-space: pre-line;">${exp.notasPrivadas}</p>
    </div>
        </div > ` : '';


    // 3. Render Detail View
    container.innerHTML = `
  < div class="p-4 animate-in" >
            < !--HEADER -->
  <div class="d-flex justify-content-between align-items-start mb-4 pb-3 border-bottom">
    <div>
      <span class="badge ${isPsicologo ? 'bg-purple-subtle text-purple' : 'bg-primary-subtle text-primary'} mb-2 border">
        ${exp.tipoServicio || 'Consulta Genérica'}
      </span>
      <h4 class="fw-bold mb-0 text-dark">Detalle de Consulta</h4>
      <small class="text-muted">${dateObj.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las ${dateObj.toLocaleTimeString()}</small>
    </div>
    <div class="text-end">
      <div class="small fw-bold text-dark">${exp.autorEmail || 'Autor desconocido'}</div>
      <div class="extra-small text-muted">Cédula: ${exp.cedula || '--'}</div>
    </div>
  </div>

            ${vitalsHTML}
            ${psychHeaderHTML}

            <!-- SOAP CONTENT -->
            <div class="row g-4">
                <div class="col-12">
                    <h6 class="fw-bold text-primary small mb-2"><i class="bi bi-person-lines-fill me-2"></i>Subjetivo / Motivo</h6>
                    <div class="bg-white p-3 rounded-3 border shadow-sm text-dark">
                        ${exp.subjetivo || '<span class="text-muted fst-italic">No registrado</span>'}
                    </div>
                </div>
                
                <div class="col-12">
                    <h6 class="fw-bold text-info small mb-2"><i class="bi bi-search me-2"></i>Objetivo / Exploración</h6>
                     <div class="bg-white p-3 rounded-3 border shadow-sm text-dark">
                        ${exp.objetivo || '<span class="text-muted fst-italic">No registrado</span>'}
                    </div>
                </div>

                ${padecimientoMédicoHTML}

                <div class="col-12">
                    <h6 class="fw-bold text-dark small mb-2"><i class="bi bi-clipboard-pulse me-2"></i>${isPsicologo ? 'Impresión Diagnóstica' : 'Diagnóstico'}</h6>
                     <div class="bg-primary-subtle p-3 rounded-3 border border-primary-subtle text-dark fw-bold">
                        ${exp.diagnostico || 'Sin diagnóstico'}
                    </div>
                </div>

                <div class="col-12">
                    <h6 class="fw-bold text-success small mb-2"><i class="bi bi-capsule me-2"></i>${isPsicologo ? 'Plan / Acuerdos' : 'Plan / Tratamiento'}</h6>
                     <div class="bg-white p-3 rounded-3 border shadow-sm text-dark" style="white-space: pre-line;">
                        ${exp.plan || exp.meds || '<span class="text-muted fst-italic">Sin indicaciones</span>'}
                    </div>
                </div>

                ${notasPsychHTML}

            </div>

            <!-- FOOTER ACTIONS -->
            <div class="mt-5 pt-3 border-top d-flex justify-content-end">
                <button class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onclick="AdminMedi.printRecetaFromDetail('${encodedItem}')">
                    <i class="bi bi-printer-fill me-2"></i>Imprimir Receta / Nota
                </button>
            </div>
        </div>`;
  }


  // --- PRINT HELPER FOR DETAIL VIEW ---
  function printRecetaFromDetail(encodedItem) {
    const exp = JSON.parse(decodeURIComponent(encodedItem));
    const studentProfile = _ctx.profile || {}; // Note: This might be the user profile, not the student's. 
    // ERROR: _ctx.profile is the LOGGED IN DOCTOR. We need the STUDENT profile.
    // But we are in a detail view, maybe we don't have the student profile handy in 'exp'.
    // However, showFullRecord fetched 'u' (user) but didn't pass it to renderConsultationDetail directly.
    // FIX: We rely on the fact that we can re-fetch or pass it. 
    // BETTER: showFullRecord already fetched 'u'. We can store it globally or pass it.
    // Let's do a quick fetch for safety or store in a temp variable when showFullRecord runs?
    // _studentForBooking is not reliable.
    // Let's execute a quick fetch using studentId from exp.

    MediService.buscarPaciente(_ctx, exp.studentId).then(stu => {
      if (!stu) { showToast("Error al obtener datos del alumno", "error"); return; }

      const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();

      PDFGenerator.generateProfessionalPrescription({
        doctor: {
          name: exp.autorEmail.split('@')[0].toUpperCase(),
          specialty: exp.tipoServicio,
          email: exp.autorEmail,
          cedula: exp.cedula || ''
        },
        student: {
          name: stu.displayName || stu.email,
          matricula: stu.matricula || '--',
          carrera: stu.carrera || '--'
        },
        consultation: {
          date: dateObj,
          signs: exp.signos,
          diagnosis: exp.diagnostico,
          treatment: exp.plan || exp.meds
        }
      });
    });
  }

  // --- SHIFT LOGIC ---
  async function setShift(shift) {
    _currentShift = shift;
    // SAVE PREFERENCE
    localStorage.setItem('medi_shift_pref', shift);

    const m = bootstrap.Modal.getInstance(document.getElementById('modalShiftSelector'));
    if (m) m.hide();

    // UPDATE UI BADGE
    const elEsp = document.getElementById('medi-pro-esp');
    if (elEsp) elEsp.textContent = `${_myRole} (${_currentShift})`;

    // --- CHECK SHIFT PROFILE ---
    // Only for Médico/Psicologo
    if (_myRole === 'Médico' || _myRole === 'Psicologo') {
      try {
        const profile = await MediService.getShiftProfile(_ctx, _myRole, _currentShift);
        if (profile && profile.name) {
          // PROFILE EXISTS -> LOAD IT
          console.log(`[Medi] Loaded Shift Profile: ${profile.name} `);
          _profesionalName = profile.name;
          _profesionalCedula = profile.cedula;

          // Update UI Greetings
          const nameEl = document.getElementById('medi-pro-name');
          if (nameEl) nameEl.textContent = _profesionalName;

          const cedEl = document.getElementById('medi-pro-cedula'); // Hidden input if any
          if (cedEl) cedEl.value = _profesionalCedula;

          showToast(`Bienvenid @, ${_profesionalName} `, 'success');
        } else {
          // PROFILE MISSING -> FORCE SETUP
          console.warn("[Medi] No profile for this shift. Prompting setup...");
          showShiftSetupModal(_myRole, _currentShift);
          return; // STOP INIT until setup is done
        }
      } catch (e) { console.error(e); }
    }

    // INIT HELPERS (If we continue)
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Resume init
    initAdmin(_ctx);
  }

  function showShiftSetupModal(role, shift) {
    const modalId = 'modalShiftSetup';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const html = `
  <div class="modal fade" id="${modalId}" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg rounded-4">
        <div class="modal-body p-5 text-center">
          <div class="mb-4 text-primary animate-bounce">
            <i class="bi bi-person-badge-fill display-1"></i>
          </div>
          <h3 class="fw-bold mb-2">Configuración de Turno</h3>
          <p class="text-muted mb-4">
            Es la primera vez que se accede al turno <b>${shift}</b> de <b>${role}</b>.<br>
              Por favor, ingresa los datos del responsable.
          </p>

          <form id="form-shift-setup" onsubmit="return false;">
            <div class="form-floating mb-3 text-start">
              <input type="text" class="form-control rounded-3" id="shift-setup-name" placeholder="Nombre" required minlength="5">
                <label for="shift-setup-name">Nombre Completo del Responsable</label>
            </div>
            <div class="form-floating mb-4 text-start">
              <input type="text" class="form-control rounded-3" id="shift-setup-cedula" placeholder="Cédula" required minlength="4">
                <label for="shift-setup-cedula">Cédula Profesional</label>
            </div>
            <button type="submit" class="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm" id="btn-save-shift-setup">
              Guardar y Acceder <i class="bi bi-arrow-right-short ms-1"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>`;

    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.appendChild(d.firstElementChild);

    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('form-shift-setup').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-shift-setup');
      const name = document.getElementById('shift-setup-name').value.trim();
      const cedula = document.getElementById('shift-setup-cedula').value.trim();

      if (!name || !cedula) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

      try {
        await MediService.updateShiftProfile(_ctx, role, shift, { name, cedula });
        showToast("Perfil de turno guardado correctamente.", "success");
        modal.hide();

        // Set values locally immediately
        _profesionalName = name;
        _profesionalCedula = cedula;

        // Update UI Greetings
        const nameEl = document.getElementById('medi-pro-name');
        if (nameEl) nameEl.textContent = _profesionalName;

        // Resume Init
        initAdmin(_ctx);

      } catch (err) {
        console.error(err);
        showToast("Error al guardar perfil: " + err.message, "danger");
        btn.disabled = false;
        btn.innerHTML = 'Reintentar';
      }
    };
  }

  // --- WORKFLOW: CONSULTA EXPRESS / WALK-IN ---
  async function nuevaConsultaWalkIn() {
    // If modal already exists, clean it up to prevent DOM stacking issues
    const existingOldModal = document.getElementById('modalWalkIn');
    if (existingOldModal) {
      existingOldModal.remove();
    }

    // Use Bootstrap Modal instead of prompt
    const mHtml = `
  <div class="modal fade" id="modalWalkIn" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content rounded-4 shadow">
        <div class="modal-header border-0 pb-0">
          <h5 class="fw-bold text-primary"><i class="bi bi-lightning-charge-fill me-2"></i>Consulta Express</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body transition-all" id="walkin-body-container">
          <!-- step content injected here -->
        </div>
        <div class="modal-footer border-0 pt-0" id="walkin-footer-container">
          <!-- step footer injected here -->
        </div>
      </div>
    </div>
  </div>`;

    // Inject temporary modal
    const d = document.createElement('div');
    d.innerHTML = mHtml;
    document.body.appendChild(d);

    const el = document.getElementById('modalWalkIn');
    const modal = new bootstrap.Modal(el);
    modal.show();

    el.addEventListener('hidden.bs.modal', () => d.remove());

    const btnBox = document.getElementById('walkin-footer-container');
    const bodyBox = document.getElementById('walkin-body-container');

    // RENDER STEP 1: Search or Anonymous
    const renderStep1 = () => {
      bodyBox.innerHTML = `
        <div id="walkin-step-1" class="animate-fade-in">
          <p class="text-muted small mb-3">Ingresa la matrícula del estudiante para iniciar una consulta sin cita previa.</p>
          <input type="text" id="walkin-input" class="form-control form-control-lg text-center fw-bold mb-4 shadow-sm" placeholder="ej. 12345678" autocomplete="off">
          
          <div class="d-grid mt-2 pt-3 border-top position-relative">
             <span class="position-absolute top-0 start-50 translate-middle bg-white px-2 extra-small text-muted fw-bold">O</span>
             <button class="btn btn-outline-secondary rounded-pill py-2 fw-bold" type="button" id="btn-walkin-anon-direct">
               <i class="bi bi-incognito me-2"></i>Continuar como Anónimo
             </button>
             <div class="text-center mt-1"><small class="text-muted" style="font-size: 0.65rem;">(Para emergencias o pacientes externos)</small></div>
          </div>
        </div>
      `;
      btnBox.innerHTML = `
        <button class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
        <button class="btn btn-primary rounded-pill px-4" id="btn-walkin-go">
          <i class="bi bi-search me-1"></i>Buscar
        </button>
      `;

      // Setup Events for Step 1
      const input = document.getElementById('walkin-input');
      document.getElementById('btn-walkin-go').onclick = performSearch;
      document.getElementById('btn-walkin-anon-direct').onclick = () => renderNotFoundUI('Anónimo');

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          performSearch();
        }
      };

      setTimeout(() => input.focus(), 200);
    };

    // SEARCH FUNCTION
    const performSearch = async () => {
      const input = document.getElementById('walkin-input');
      const mat = input.value.trim();
      if (!mat) return;

      const btn = document.getElementById('btn-walkin-go');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
      }

      try {
        const found = await MediService.buscarPaciente(_ctx, mat);

        if (found) {
          modal.hide();
          const safe = encodeURIComponent(JSON.stringify(found));
          iniciarConsulta(null, safe);
          showToast(`Paciente identificado: ${found.displayName || found.email}`, 'success');
        } else {
          // NOT FOUND - SWITCH UI IN-PLACE
          renderNotFoundUI(mat);
        }
      } catch (e) {
        console.error(e);
        showToast("Error de conexión", "danger");
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-search me-1"></i>Buscar';
        }
      }
    };

    // RENDER NOT FOUND/ANONYMOUS FORM
    const renderNotFoundUI = (mat) => {
      const isAnonMode = mat === 'Anónimo';
      const title = isAnonMode ? 'Consulta Anónima / Externa' : 'Matrícula no encontrada';
      const desc = isAnonMode
        ? 'Ingresa los datos del paciente para continuar con la consulta de forma manual.'
        : `No se encontró el alumno con matrícula <strong>${escapeHtml(mat)}</strong>.<br>Puedes continuar registrando los datos manualmente.`;

      const iconHtml = isAnonMode
        ? '<i class="bi bi-incognito text-primary display-4"></i>'
        : '<i class="bi bi-person-x-fill text-warning display-4"></i>';

      const iconBgClass = isAnonMode ? 'bg-primary' : 'bg-warning';

      bodyBox.innerHTML = `
        <div class="text-center mb-3 animate-fade-in">
                <div class="${iconBgClass} bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                    ${iconHtml}
                </div>
                <h5 class="fw-bold text-dark">${title}</h5>
                <p class="text-muted small">${desc}</p>
        </div>

  <div class="bg-light rounded-4 p-3 border animate-fade-in">
    <div class="mb-3">
      <label class="form-label extra-small fw-bold text-uppercase text-muted">Nombre del Paciente (Opcional)</label>
      <input type="text" id="anon-name" class="form-control" placeholder="Nombre completo">
    </div>
    <div class="mb-0">
      <label class="form-label extra-small fw-bold text-uppercase text-muted">Género *</label>
      <select id="anon-gender" class="form-select">
        <option value="M">Masculino</option>
        <option value="F">Femenino</option>
        <option value="O">Otro</option>
      </select>
    </div>
  </div>
`;

      btnBox.innerHTML = `
        <button class="btn btn-light rounded-pill" id="btn-walkin-back">
          <i class="bi bi-arrow-left me-1"></i>Regresar
        </button>
  <button class="btn btn-warning rounded-pill px-4 fw-bold shadow-sm" id="btn-anon-go">
    Continuar como Anónimo <i class="bi bi-arrow-right ms-1"></i>
  </button>
`;

      document.getElementById('btn-walkin-back').onclick = renderStep1;

      // Focus Name
      setTimeout(() => {
        const n = document.getElementById('anon-name');
        if (n) n.focus();
      }, 200);

      document.getElementById('btn-anon-go').onclick = () => {
        const nameInput = document.getElementById('anon-name');
        const genderInput = document.getElementById('anon-gender');

        const name = nameInput.value.trim() || 'Paciente Anónimo';
        const gender = genderInput.value;

        const anon = {
          uid: 'anon_' + Date.now(),
          email: 'anonimo@tecnm.mx',
          displayName: name,
          matricula: (isAnonMode ? 'EXT' : mat),
          genero: gender,
          personalData: { genero: gender }
        };

        modal.hide();
        iniciarConsulta(null, encodeURIComponent(JSON.stringify(anon)));
      };
    };

    // Initialize the Modal with Step 1
    renderStep1();
  }



  // --- HISTORIAL RÁPIDO (REDIRECCIONADO A FULL RECORD) ---
  async function verHistorialRapido(uid) {
    if (!uid) return;
    showFullRecord(uid);
  }

  // --- MANUAL BOOKING (ADMIN) ---
  function openManualBooking(mode, encodedStudent) {
    let student = null;

    // 1. Pre-selected Student (from Search Card)
    if (encodedStudent) {
      student = JSON.parse(decodeURIComponent(encodedStudent));
      showBookingModal(student);
      return;
    }

    // 2. Search Mode (Generic)
    // Reuse WalkIn Modal logic but for Booking
    const mHtml = `
  < div class="modal fade" id = "modalSearchBooking" tabindex = "-1" >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content rounded-4 shadow">
        <div class="modal-header border-0 pb-0">
          <h5 class="fw-bold text-primary">Nueva Cita</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p class="text-muted small">Ingresa la matrícula del estudiante para agendar una cita.</p>
          <input type="text" id="booking-search-input" class="form-control form-control-lg text-center fw-bold" placeholder="ej. 12345678">
        </div>
        <div class="modal-footer border-0 pt-0">
          <button class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
          <button class="btn btn-primary rounded-pill px-4" id="btn-booking-search-go">Buscar</button>
        </div>
      </div>
    </div>
      </div > `;

    const d = document.createElement('div');
    d.innerHTML = mHtml;
    document.body.appendChild(d);

    const el = document.getElementById('modalSearchBooking');
    const modal = new bootstrap.Modal(el);
    modal.show();

    el.addEventListener('hidden.bs.modal', () => d.remove());

    document.getElementById('btn-booking-search-go').onclick = async () => {
      const mat = document.getElementById('booking-search-input').value.trim();
      if (!mat) return;

      const btn = document.getElementById('btn-booking-search-go');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
      btn.disabled = true;

      try {
        const found = await MediService.buscarPaciente(_ctx, mat);
        if (found) {
          modal.hide();
          showBookingModal(found); // Proceed to booking
        } else {
          showToast("Estudiante no encontrado", "warning");
        }
      } catch (e) { console.error(e); }
      finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    };

    // [NEW] Enter Key Support (Search Booking)
    document.getElementById('booking-search-input').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-booking-search-go').click();
      }
    };

    setTimeout(() => document.getElementById('booking-search-input').focus(), 500);
  }

  function showBookingModal(student) {
    // Dynamic Modal for Admin Booking
    const modalId = 'modalAdminBooking';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const html = `
  < div class="modal fade" id = "${modalId}" tabindex = "-1" >
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content shadow rounded-4 border-0">
        <div class="modal-header border-bottom-0 pb-0">
          <div>
            <h5 class="modal-title fw-bold text-primary"><i class="bi bi-calendar-check-fill me-2"></i>Agendar Cita</h5>
            <div class="small text-muted">Estudiante: <b>${student.displayName || student.email}</b></div>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>

        <!-- STUDENT HEADER -->
        <div class="bg-primary-subtle px-4 py-3 border-bottom mt-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width:48px;height:48px;font-size:1.2rem;">
              ${student.displayName ? student.displayName.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h6 class="fw-bold text-dark mb-0">${escapeHtml(student.displayName || 'Estudiante')}</h6>
              <div class="small text-primary-emphasis opacity-75">
                <i class="bi bi-person-badge me-1"></i>${escapeHtml(student.matricula || 'Sin matrícula')}
                ${student.carrera ? `<span class="mx-1">&bull;</span> ${escapeHtml(student.carrera)}` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-body p-4">
          <!-- Date Scroller -->
          <div class="mb-4">
            <label class="d-block extra-small fw-bold text-muted text-uppercase mb-2">1. Selecciona el Día</label>
            <div id="admin-date-scroller" class="d-flex gap-2 overflow-auto pb-2" style="scrollbar-width: thin;">
              <!-- Days injected here -->
            </div>
          </div>

          <!-- Available Slots -->
          <div class="mb-4">
            <label class="d-block extra-small fw-bold text-muted text-uppercase mb-2">2. Selecciona la Hora</label>

            <div id="admin-booking-loader" class="text-center py-4 d-none">
              <div class="spinner-border text-primary mb-2" role="status"></div>
              <div class="small text-muted">Verificando disponibilidad...</div>
            </div>

            <div id="admin-booking-slots" class="d-flex flex-wrap gap-2 d-none justify-content-start">
              <!-- Time buttons injected here -->
            </div>

            <div id="admin-booking-msg" class="text-center py-5 text-muted bg-light rounded-3 border border-dashed">
              <i class="bi bi-calendar-event fs-4 d-block mb-1 opacity-25"></i>
              Selecciona una fecha ver horarios
            </div>
          </div>

          <!-- Motivo (Optional) -->
          <div class="mb-2">
            <label class="form-label extra-small fw-bold text-muted text-uppercase">3. Motivo de Consulta <span class="fw-normal text-muted">(Opcional)</span></label>
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white text-muted border-end-0"><i class="bi bi-chat-text"></i></span>
              <input type="text" id="admin-booking-reason" class="form-control border-start-0" placeholder="Ej. Seguimiento, Primera vez...">
            </div>
          </div>

          <!-- SUMMARY BLOCK -->
          <div id="booking-summary-block" class="d-none mt-3 animate-fade-in">
            <div class="alert alert-primary border-primary border-opacity-25 bg-primary-subtle d-flex align-items-center gap-3 py-2 px-3 mb-0 rounded-3">
              <i class="bi bi-info-circle-fill text-primary fs-5"></i>
              <div class="small text-dark lh-1">
                Resumen: Cita para el <strong id="summary-date">--</strong> a las <strong id="summary-time">--</strong>.
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
          <button type="button" class="btn btn-light rounded-pill px-3" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" id="btn-confirm-admin-booking" disabled>
            Confirmar Cita
          </button>
        </div>
      </div>
    </div>
        </div >
  `;

    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.appendChild(d.firstElementChild);

    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    // LOGIC: DATE SCROLLER
    const dateContainer = document.getElementById('admin-date-scroller');
    const slotsContainer = document.getElementById('admin-booking-slots');
    const loader = document.getElementById('admin-booking-loader');
    const msg = document.getElementById('admin-booking-msg');
    const confirmBtn = document.getElementById('btn-confirm-admin-booking');
    const summaryBlock = document.getElementById('booking-summary-block');

    let selectedDate = null;
    let selectedSlotId = null; // Will store Date object actually used for booking

    // Generate 14 days
    const days = [];
    let curr = new Date();
    if (curr.getHours() >= 20) curr.setDate(curr.getDate() + 1);

    while (days.length < 14) {
      if (curr.getDay() !== 0 && curr.getDay() !== 6) { // Skip weekends
        days.push(new Date(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }

    dateContainer.innerHTML = days.map(d => {
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase().replace('.', '');
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase().replace('.', '');

      // Compact Card Design
      return `
  < div class="date-card p-2 text-center border rounded-3 bg-white cursor-pointer transition-all flex-shrink-0"
onclick = "AdminMedi.selectAdminDate('${iso}', this)"
style = "min-width: 70px; user-select:none;" >
                 <div class="extra-small text-muted fw-bold mb-0">${dayName}</div>
                 <div class="h5 fw-bold text-dark mb-0 ls-1">${dayNum}</div>
                 <div class="extra-small text-muted">${monthName}</div>
            </div >
  `;
    }).join('');

    // Select Date Helper
    AdminMedi.selectAdminDate = async (isoDate, cardEl) => {
      // Styles
      dateContainer.querySelectorAll('.date-card').forEach(c => {
        c.classList.remove('border-primary', 'bg-primary-subtle', 'ring-2');
        c.classList.add('border');
      });
      cardEl.classList.remove('border');
      cardEl.classList.add('border-primary', 'bg-primary-subtle', 'ring-2');

      // Reset
      msg.classList.add('d-none');
      slotsContainer.classList.add('d-none');
      slotsContainer.innerHTML = '';
      summaryBlock.classList.add('d-none');
      loader.classList.remove('d-none');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = 'Confirmar Cita';

      selectedDate = new Date(isoDate + 'T12:00:00'); // Noon base

      try {
        // [MOD] 1. Get Occupied Slots for this day
        // Pass _myRole to allow cross-checking if we separate resources later, 
        // or null to block if ANYONE is busy (Single Room/Resource).
        // Let's assume Resource Sharing: Medic/Psych share same room/schedule? 
        // If yes, use _myRole. If no, use null.
        // Assuming Single Resource for now as per "getOccupiedSlots" logic.
        const blockedSlots = await MediService.getOccupiedSlots(_ctx, null, isoDate);

        // 2. Generate Slots
        const start = (typeof SLOT_START !== 'undefined') ? SLOT_START : 8;
        const end = (typeof SLOT_END !== 'undefined') ? SLOT_END : 20;
        const duration = (typeof SLOT_DURATION !== 'undefined') ? SLOT_DURATION : 60; // Minutes

        const slots = [];
        let currMins = start * 60;
        const endMins = end * 60;

        // Adjust for "Today" - don't show past slots
        const now = new Date();
        const isToday = (isoDate === now.toISOString().split('T')[0]);
        const currentMinsReal = now.getHours() * 60 + now.getMinutes();

        while (currMins < endMins) {
          // If Today, skip past times
          if (isToday && currMins < currentMinsReal) {
            currMins += duration;
            continue;
          }

          const h = Math.floor(currMins / 60);
          const m = currMins % 60;

          // Construct Date Object
          const s = new Date(isoDate);
          s.setHours(h, m, 0, 0); // Local time construction from ISO String usage? 
          // Better: s = new Date(year, month, day, h, m)... to avoid timezone confusion with ISO
          // Let's stick to safe parsing:
          const [Zy, Zm, Zd] = isoDate.split('-').map(Number);
          const slotDate = new Date(Zy, Zm - 1, Zd, h, m, 0);

          const tStr = slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isoSlot = slotDate.toISOString();

          // Check availability
          // Simple string match on ISO (up to minutes) or range
          // getOccupiedSlots returns full ISO strings.
          const isBlocked = blockedSlots.some(bs => {
            // Fuzzy match within 1 minute
            const bDate = new Date(bs);
            return Math.abs(bDate - slotDate) < 60000;
          });

          slots.push({ date: slotDate, label: tStr, occupied: isBlocked });
          currMins += duration;
        }

        loader.classList.add('d-none');
        slotsContainer.classList.remove('d-none');

        if (slots.length === 0) {
          slotsContainer.innerHTML = '<div class="alert alert-light w-100 text-center text-muted small">No hay horarios disponibles para este día.</div>';
        } else {
          // Render Buttons
          slotsContainer.innerHTML = slots.map((s, i) => `
  < button type = "button"
class="btn btn-sm ${s.occupied ? 'btn-light text-muted border-0' : 'btn-outline-primary'} rounded-pill px-3 py-2 fw-bold" 
                        ${s.occupied ? 'disabled style="opacity:0.6; text-decoration:line-through;"' : `onclick="AdminMedi.selectAdminSlot(${i})"`}
data - idx="${i}" >
  ${s.occupied ? '' : '<i class="bi bi-clock me-1"></i>'}${s.label}
                </button >
  `).join('');

          // Store slots in DOM or Closure for Click Handler
          AdminMedi._currentSlots = slots;
        }

      } catch (e) {
        console.error(e);
        loader.classList.add('d-none');
        slotsContainer.innerHTML = '<div class="text-danger small">Error cargando disponibilidad.</div>';
        slotsContainer.classList.remove('d-none');
      }
    };

    // Select Slot Helper
    AdminMedi.selectAdminSlot = (idx) => {
      const slot = AdminMedi._currentSlots[idx];
      if (!slot) return;

      // UI
      slotsContainer.querySelectorAll('button').forEach(b => {
        b.classList.remove('btn-primary', 'text-white');
        if (!b.disabled) b.classList.add('btn-outline-primary');
      });
      const btn = slotsContainer.querySelector(`button[data - idx= "${idx}"]`);
      if (btn) {
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'text-white');
      }

      selectedSlotId = slot.date; // The Date object to book

      // Show Summary
      summaryBlock.classList.remove('d-none');
      document.getElementById('summary-date').textContent = slot.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      document.getElementById('summary-time').textContent = slot.label;

      confirmBtn.disabled = false;
    };


    confirmBtn.onclick = async () => {
      const motivo = document.getElementById('admin-booking-reason').value.trim() || 'Consulta Agendada';

      if (!selectedSlotId) return;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Agendando...';

      try {
        await MediService.reservarCitaAdmin(_ctx, {
          student: student,
          date: selectedSlotId,
          slotId: 'admin_override_' + Date.now(), // Admin bypasses strict slot ID requirement usually
          tipo: _myRole,
          motivo: motivo,
          shift: _currentShift,
          profileData: _currentProfile
        });

        showToast('Cita agendada exitosamente', 'success');
        modal.hide();

        // Refresh? _loadAgenda() happens via stream usually
      } catch (e) {
        console.error(e);
        showToast(e.message || 'Error al agendar', 'danger');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Cita';
      }
    };
  }


  // --- HELPERS UI EXPORTADOS ---
  function updateCedula(val) {
    _profesionalCedula = val;
    localStorage.setItem('medi_cedula', val);
    showToast('Cédula actualizada localmente', 'success');
  }

  function editarTarjeta() {
    document.getElementById('medi-card-view').classList.add('d-none');
    document.getElementById('medi-card-form').classList.remove('d-none');
  }
  function cancelarEdicionTarjeta() {
    document.getElementById('medi-card-form').reset();
    document.getElementById('medi-card-view').classList.remove('d-none');
    document.getElementById('medi-card-form').classList.add('d-none');
  }
  function toggleSOS() {
    new bootstrap.Modal(document.getElementById('modalSOS')).show();
  }
  // --- C1: DAY METRICS DASHBOARD (Zona C default) ---
  async function loadDayMetrics() {
    const container = document.getElementById('medi-day-stats');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

    try {
      const stats = await MediService.getDayStats(_ctx, _myRole, _myUid, _currentProfile ? _currentProfile.id : null);

      // [NEW] Feed dashboard stat cards with authoritative service data
      const statAtendidos = document.getElementById('stat-atendidos');
      if (statAtendidos) statAtendidos.textContent = stats.totalAtendidos || 0;
      const statEspera = document.getElementById('stat-en-espera');
      if (statEspera) statEspera.textContent = stats.enEspera || 0;

      const diagBadges = stats.topDiagnosticos.length > 0
        ? stats.topDiagnosticos.map(d =>
          '<span class="badge  text-dark border me-1 mb-1" style="font-size:.7rem;">' +
          escapeHtml(d.diagnostico) + ' <span class="text-primary fw-bold">(' + d.count + ')</span></span>'
        ).join('')
        : '<span class="text-muted" style="font-size:.7rem;">Sin datos aun</span>';

      container.innerHTML = `
  < div class="row g-2 mb-3" >
          <div class="col-6">
            <div class="card border-0 bg-primary-subtle rounded-3 text-center p-2">
              <div class="fw-bold text-primary" style="font-size:1.5rem;">${stats.totalAtendidos}</div>
              <div class="text-muted" style="font-size:.65rem;">Atendidos hoy</div>
            </div>
          </div>
          <div class="col-6">
            <div class="card border-0 bg-warning-subtle rounded-3 text-center p-2">
              <div class="fw-bold text-warning" style="font-size:1.5rem;">${stats.enEspera}</div>
              <div class="text-muted" style="font-size:.65rem;">En espera</div>
            </div>
          </div>
          <div class="col-6">
            <div class="card border-0 bg-success-subtle rounded-3 text-center p-2">
              <div class="fw-bold text-success" style="font-size:1.3rem;">${stats.avgDuracion > 0 ? stats.avgDuracion + ' min' : '--'}</div>
              <div class="text-muted" style="font-size:.65rem;">Duracion promedio</div>
            </div>
          </div>
          <div class="col-6">
            <div class="card border-0 bg-info-subtle rounded-3 text-center p-2">
              <div class="fw-bold text-info" style="font-size:1.3rem;">${stats.avgEspera > 0 ? stats.avgEspera + ' min' : '--'}</div>
              <div class="text-muted" style="font-size:.65rem;">Espera promedio</div>
            </div>
          </div>
        </div >

        < !--Top Diagnoses-- >
        <div class="mb-3">
          <h6 class="text-muted fw-bold text-uppercase mb-2" style="font-size:.7rem;"><i class="bi bi-tag me-1"></i>Diagnosticos frecuentes</h6>
          <div class="d-flex flex-wrap">${diagBadges}</div>
        </div>

        <!--Mini Progress Bar(visual flair)-- >
        <div class="mb-2">
          <div class="d-flex justify-content-between mb-1">
            <span class="text-muted" style="font-size:.65rem;">Productividad del dia</span>
            <span class="fw-bold text-primary" style="font-size:.65rem;">${stats.totalAtendidos} consultas</span>
          </div>
          <div class="progress" style="height:6px;">
            <div class="progress-bar bg-primary rounded-pill" style="width:${Math.min(stats.totalAtendidos * 10, 100)}%"></div>
          </div>
        </div>

        <!--C7: Follow - ups pending-- >
        <div id="medi-followups-list" class="mb-2"></div>

        <!--Timestamp -->
  <div class="text-end mt-3">
    <small class="text-muted" style="font-size:.6rem;">Actualizado: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
  </div>
`;

      // Load follow-ups async
      _loadFollowUps();
    } catch (err) {
      console.warn('[medi] loadDayMetrics error:', err);
      container.innerHTML = '<div class="text-center py-3 text-muted small">No se pudieron cargar metricas</div>';
    }
  }

  // C7: Load pending follow-ups for dashboard
  async function _loadFollowUps() {
    const container = document.getElementById('medi-followups-list');
    if (!container) return;
    try {
      const followUps = await MediService.getFollowUps(_ctx, _myRole, _myUid, _currentProfile ? _currentProfile.id : null);
      if (followUps.length === 0) { container.innerHTML = ''; return; }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pending = followUps.filter(f => {
        if (!f.followUpDate) return true;
        const fDate = new Date(f.followUpDate);
        return fDate <= new Date(today.getTime() + 7 * 86400000); // Next 7 days
      }).slice(0, 5);

      if (pending.length === 0) { container.innerHTML = ''; return; }

      // [NEW] Update stat-seguimientos card
      const statSeg = document.getElementById('stat-seguimientos');
      if (statSeg) statSeg.textContent = pending.length;

      container.innerHTML = `
  < h6 class="text-muted fw-bold text-uppercase mb-2" style = "font-size:.7rem;" > <i class="bi bi-calendar-check me-1"></i>Seguimientos pendientes</h6 >
    ${pending.map(f => {
        const isOverdue = f.followUpDate && new Date(f.followUpDate) < today;
        const dateStr = f.followUpDate ? new Date(f.followUpDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha';
        return `<div class="d-flex align-items-center gap-2 mb-1 p-1 rounded ${isOverdue ? 'bg-danger-subtle' : 'bg-warning-subtle'}" style="font-size:.7rem;">
            <i class="bi bi-${isOverdue ? 'exclamation-triangle text-danger' : 'clock text-warning'}"></i>
            <div class="flex-grow-1 text-truncate">
              <span class="fw-bold">${escapeHtml(f.diagnostico || 'Consulta')}</span>
              <span class="text-muted ms-1">${dateStr}</span>
            </div>
            ${isOverdue ? '<span class="badge bg-danger" style="font-size:.55rem;">Vencido</span>' : ''}
          </div>`;
      }).join('')
        } `;
    } catch (e) { console.warn('Follow-ups load error:', e); }
  }

  function refreshAdmin() { loadWall(); loadMyAgenda(); loadRecentActivity(); loadDayMetrics(); updateDashboardStats(); }

  // --- CONFIGURACIÓN ---
  async function saveConfig() {
    const start = document.getElementById('cfg-hora-inicio').value;
    const end = document.getElementById('cfg-hora-fin').value;
    const duration = document.querySelector('input[name="cfg-duracion"]:checked').value;

    try {
      await _ctx.db.collection('config').doc('medi').set({
        slotStart: parseInt(start),
        slotEnd: parseInt(end),
        slotStep: parseInt(duration)
      }, { merge: true });

      showToast('Configuración guardada. Se aplicará en nuevas cargas.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error guardando configuración', 'danger');
    }
  }

  async function toggleAvailability(enabled) {
    // Logic refactored to use role-based config
    if (!_myRole) return;

    const key = _myRole === 'Médico' ? 'availableMédico' : 'availablePsicologo';
    // If 'enabled' arg is passed, use it, otherwise toggle
    const currentVal = (_ctx.config.medi && _ctx.config.medi[key] !== undefined) ? _ctx.config.medi[key] : true;
    const newVal = (enabled !== undefined) ? enabled : !currentVal;

    try {
      await MediService.updateConfig(_ctx, { [key]: newVal });

      // Update local
      if (!_ctx.config.medi) _ctx.config.medi = {};
      _ctx.config.medi[key] = newVal;

      const status = newVal ? 'HABILITADO' : 'DESHABILITADO';
      showToast(`Agenda ${status} `, newVal ? 'success' : 'warning');

      // Update Banner
      const banner = document.getElementById('medi-service-status');
      if (banner) {
        if (!newVal) {
          banner.classList.remove('d-none');
          banner.classList.add('d-flex');
        } else {
          banner.classList.add('d-none');
          banner.classList.remove('d-flex');
        }
      }
    } catch (e) {
      console.error(e);
      showToast('Error actualizando disponibilidad', 'danger');
    }
  }

  function testSound() {
    if (window.Notify) window.Notify.playSound();
  }

  // --- NUEVAS FUNCIONES WORKFLOW ---
  function printReceta() {
    if (!_lastConsultaData || !window.PDFGenerator) return;

    // Obtener datos del perfil actual para el medico
    const docName = (_ctx.profile.displayName || _ctx.auth.currentUser.email).split('@')[0].toUpperCase();

    window.PDFGenerator.generateReceta({
      doctor: {
        name: docName,
        specialty: _myRole,
        email: _ctx.auth.currentUser.email,
        cedula: _lastConsultaData.cedula || ''
      },
      student: {
        name: _lastConsultaData.studentEmail, // Fallback si no hay nombre
        matricula: _lastConsultaData.studentId || '--',
        carrera: '--'
      },
      consultation: {
        date: new Date(),
        signs: _lastConsultaData.signos || {},
        diagnosis: _lastConsultaData.diagnostico,
        treatment: _lastConsultaData.meds || _lastConsultaData.plan
      }
    });
  }

  function sendToPatient() {
    if (!_lastConsultaData || !window.Notify) return;
    window.Notify.send(_lastConsultaData.studentId, {
      title: 'Nueva Consulta',
      message: 'Tienes una nueva consulta y receta disponible en tu historial.',
      type: 'medi', link: '/medi'
    });
    showToast('Notificación enviada', 'success');
  }

  function printRecetaFromHistory(jsonExp) {
    // Helper interno, ahora usado por el modal
    const exp = typeof jsonExp === 'string' ? JSON.parse(decodeURIComponent(jsonExp)) : jsonExp;
    if (!window.PDFGenerator) return;

    // Fix date string
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();

    window.PDFGenerator.generateReceta({
      doctor: {
        name: exp.autorEmail.split('@')[0].toUpperCase(),
        specialty: exp.tipoServicio || 'General',
        email: exp.autorEmail,
        cedula: exp.cedula || ''
      },
      student: {
        name: 'Estudiante (Historial)', // No tenemos nombre si viene de exp
        matricula: exp.studentId || '--',
        carrera: '--'
      },
      consultation: {
        date: dateObj,
        signs: exp.signos || {},
        diagnosis: exp.diagnostico,
        treatment: exp.meds || exp.plan
      }
    });
  }

  function showConsultationDetails(jsonExp) {
    const exp = JSON.parse(decodeURIComponent(jsonExp));

    // Header y Doctor
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();
    document.getElementById('detail-date-header').textContent = `${exp.tipoServicio} • ${dateObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} `;
    document.getElementById('detail-doctor').textContent = exp.autorEmail || 'Profesional de Salud';

    // Signos Vitales — data is stored flat: exp.temp, exp.presion, exp.peso, exp.talla
    document.getElementById('detail-temp').textContent = exp.temp ? `${exp.temp}°C` : '--';
    document.getElementById('detail-presion').textContent = exp.presion || '--';
    document.getElementById('detail-peso').textContent = exp.peso ? `${exp.peso} kg` : '--';

    // Contenido SOAP
    document.getElementById('detail-subjetivo').textContent = exp.subjetivo || 'No registrado';
    document.getElementById('detail-diagnosis').textContent = exp.diagnostico || 'No registrado';
    document.getElementById('detail-plan').textContent = exp.plan || (exp.meds ? exp.meds : 'Seguir indicaciones generales.');

    // Acción del Botón Imprimir
    const btnPrint = document.getElementById('btn-print-receta');
    const newBtn = btnPrint.cloneNode(true);
    btnPrint.parentNode.replaceChild(newBtn, btnPrint);

    newBtn.onclick = () => {
      // Obtenemos perfil del alumno para la receta
      const studentProfile = _ctx.profile || {};

      // Llamada al generador profesional
      PDFGenerator.generateProfessionalPrescription({
        doctor: {
          name: exp.autorEmail.split('@')[0].toUpperCase(),
          specialty: exp.tipoServicio,
          email: exp.autorEmail,
          cedula: exp.cedula || '' // Usar la cedula guardada en el doc
        },
        student: {
          name: studentProfile.displayName || _ctx.user.email,
          matricula: studentProfile.matricula || '--',
          carrera: studentProfile.carrera || '--'
        },
        consultation: {
          date: dateObj,
          signs: exp.signos,
          diagnosis: exp.diagnostico,
          treatment: exp.plan || exp.meds
        }
      });
    };

    // Z-INDEX FIX: Ensure Details Modal is above Full Record
    // Note: DetailModal is 1055 default context. If full record is open, we need to handle stacking.
    const detailModalEl = document.getElementById('modalDetalleConsulta');
    detailModalEl.style.zIndex = "1061"; // Higher than standard modal (1055) + Full Record (1060?)
    const backdrop = document.querySelector('.modal-backdrop');
    // We can't easily control backdrop z-index globally without affecting others.
    // Bootstrap 5 handles stacked modals but sometimes needs help.


    const dSubjetivo = document.getElementById('detail-subjetivo');
    const dDiagnosis = document.getElementById('detail-diagnosis');
    const dPlan = document.getElementById('detail-plan');
    const dDate = document.getElementById('detail-date-header');

    // Update Vitals (If exist)
    if (exp.signos) {
      document.getElementById('detail-presion').textContent = exp.signos.presion || '--';
      document.getElementById('detail-temp').textContent = exp.signos.temp ? exp.signos.temp + '°C' : '--';
      document.getElementById('detail-peso').textContent = exp.signos.peso ? exp.signos.peso + 'kg' : '--';
    } else {
      // [FIX] Also check flat fields (data saved by saveConsultation is flat)
      document.getElementById('detail-presion').textContent = exp.presion || '--';
      document.getElementById('detail-temp').textContent = exp.temp ? exp.temp + '°C' : '--';
      document.getElementById('detail-peso').textContent = exp.peso ? exp.peso + ' kg' : '--';
    }

    dDate.innerHTML = `< i class="bi bi-calendar-event me-1" ></i > ${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} `;
    dSubjetivo.textContent = exp.subjetivo || "Sin detalles subjetivos.";
    dDiagnosis.textContent = exp.diagnostico || "Sin diagnóstico registrado.";
    dPlan.textContent = exp.plan || "Sin plan de tratamiento.";

    // SHOW PRIVATE NOTES IF ADMIN/DOCTOR
    let pNotesEl = document.getElementById('detail-private-notes-container');
    if (!pNotesEl) {
      // Inject if missing
      const modalBodyRow = dPlan.closest('.row'); // find parent row
      const div = document.createElement('div');
      div.id = 'detail-private-notes-container';
      div.className = 'col-12 mt-3 d-none';
      div.innerHTML = `
  < div class="p-3 bg-warning-subtle border border-warning rounded-4 dashed-border" >
                <h6 class="fw-bold text-dark extra-small mb-1"><i class="bi bi-eye-slash-fill me-1"></i> NOTAS PRIVADAS</h6>
                <p class="mb-0 small text-dark" id="detail-private-notes-text"></p>
            </div >
  `;
      modalBodyRow.appendChild(div);
      pNotesEl = div;
    }

    if (exp.notasPrivadas && (_myRole === 'Médico' || _myRole === 'Psicologo')) {
      pNotesEl.classList.remove('d-none');
      document.getElementById('detail-private-notes-text').textContent = exp.notasPrivadas;
    } else {
      pNotesEl.classList.add('d-none');
    }

    if (document.getElementById('detail-doctor')) {
      document.getElementById('detail-doctor').textContent = `${exp.autorEmail} (${exp.tipoServicio || 'General'})`;
    }

    new bootstrap.Modal(document.getElementById('modalDetalleConsulta')).show();
  }

  function solicitarCancelacion(citaId) {
    const modalEl = document.getElementById('modalMediCancelParams');
    const modal = new bootstrap.Modal(modalEl);

    document.getElementById('cancel-cita-id').value = citaId;
    document.getElementById('cancel-other').value = "";

    const form = document.getElementById('form-medi-cancel-reason');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const reason = document.getElementById('cancel-other').value.trim();
      if (!reason) return showToast("Indica un motivo", "warning");

      const btn = form.querySelector('button[type="submit"]');
      const org = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        await MediService.cancelarCitaEstudiante(_ctx, citaId, reason);
        showToast("Cita cancelada", "success");
        modal.hide();
      } catch (err) {
        console.error(err);
        showToast("Error cancelando", "danger");
      } finally {
        btn.disabled = false;
        btn.innerHTML = org;
      }
    };

    modal.show();
  }

  function prepararEdicion(jsonCita) {
    const cita = JSON.parse(decodeURIComponent(jsonCita));
    const modalEl = document.getElementById('modalMediReschedule');
    const modal = new bootstrap.Modal(modalEl);

    // Fill hidden inputs
    document.getElementById('resched-cita-id').value = cita.id;
    document.getElementById('resched-old-slot').value = cita.slotId;
    document.getElementById('resched-tipo').value = cita.tipoServicio || 'Médico';
    document.getElementById('resched-date').value = '';
    document.getElementById('resched-time').value = '';

    // Reset UI
    const btnConfirm = document.getElementById('btn-resched-confirm');
    if (btnConfirm) btnConfirm.disabled = true;
    const summaryEl = document.getElementById('resched-summary');
    if (summaryEl) summaryEl.classList.add('d-none');
    const timeGrid = document.getElementById('resched-time-grid');
    if (timeGrid) { timeGrid.innerHTML = ''; timeGrid.classList.add('d-none'); }
    const timeMsg = document.getElementById('resched-time-msg');
    if (timeMsg) { timeMsg.classList.remove('d-none'); timeMsg.innerHTML = '<i class="bi bi-calendar-check d-block mb-1"></i> Selecciona un d\u00eda primero'; }

    // Render date cards
    const dateSelector = document.getElementById('resched-date-selector');
    const days = [];
    let curr = new Date();
    while (days.length < 10) {
      if (isWeekday(curr)) days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    dateSelector.innerHTML = days.map(d => {
      const isoDate = MediService.toISO(d);
      const isToday = d.getDate() === new Date().getDate() && d.getMonth() === new Date().getMonth();
      const displayDay = isToday ? 'HOY' : d.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
      return `
  < div class="date-option p-2 text-center border rounded-3 bg-white shadow-sm flex-shrink-0"
style = "min-width: 70px; cursor: pointer;" data - date="${isoDate}"
onclick = "AdminMedi._reschedSelectDate(this, '${isoDate}')" >
          <div class="small text-muted mb-0">${displayDay}</div>
          <div class="fw-bold fs-5">${d.getDate()}</div>
          <div class="small text-primary fw-bold">${d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase()}</div>
        </div > `;
    }).join('');

    // Form submit handler
    const form = document.getElementById('form-medi-reschedule');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newDateStr = document.getElementById('resched-date').value;
      const newTimeStr = document.getElementById('resched-time').value;

      if (!newDateStr || !newTimeStr) return showToast("Selecciona fecha y hora", "warning");

      const btn = document.getElementById('btn-resched-confirm');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        const [y, m, day] = newDateStr.split('-').map(Number);
        const [hh, mm] = newTimeStr.split(':').map(Number);
        const newDate = new Date(y, m - 1, day, hh, mm);
        const tipo = document.getElementById('resched-tipo').value || cita.tipoServicio;

        await MediService.modificarCita(_ctx, cita.id, {
          date: newDate,
          slotId: `${MediService.slotIdFromDate(newDate)}_${tipo} `,
          tipo: tipo,
          motivo: cita.motivo
        });
        showToast("Cita re-agendada con \u00e9xito", "success");
        modal.hide();
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error al reagendar", "danger");
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    };

    modal.show();
  }

  // Reschedule helpers (called from onclick in modal)
  async function _reschedSelectDate(el, dateStr) {
    // Update hidden input
    document.getElementById('resched-date').value = dateStr;
    document.getElementById('resched-time').value = '';
    document.getElementById('btn-resched-confirm').disabled = true;
    document.getElementById('resched-summary').classList.add('d-none');

    // Visual selection
    el.closest('.medi-resched-dates').querySelectorAll('.date-option').forEach(c => {
      c.classList.remove('bg-primary', 'text-white', 'border-primary');
      c.classList.add('bg-white');
    });
    el.classList.remove('bg-white');
    el.classList.add('bg-primary', 'text-white', 'border-primary');

    // Load slots
    const timeGrid = document.getElementById('resched-time-grid');
    const timeMsg = document.getElementById('resched-time-msg');
    timeGrid.classList.add('d-none');
    timeMsg.classList.remove('d-none');
    timeMsg.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Buscando disponibilidad...';

    const targetDate = new Date(dateStr + 'T12:00:00');
    const slots = buildSlotsForDate(targetDate);
    const tipo = document.getElementById('resched-tipo').value || 'Médico';
    let occupied = [];

    try {
      occupied = await MediService.getOccupiedSlots(_ctx, targetDate, tipo);
    } catch (e) { console.error("Error fetching slots for reschedule:", e); }

    timeGrid.innerHTML = '';
    slots.forEach(slot => {
      const tStr = `${slot.getHours().toString().padStart(2, '0')}:${slot.getMinutes().toString().padStart(2, '0')} `;
      const baseId = MediService.slotIdFromDate(slot);
      const slotId = `${baseId}_${tipo} `;
      const isTaken = occupied.includes(slotId);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn - sm rounded - pill fw - bold ${isTaken ? 'btn-light text-muted pe-none opacity-50' : 'btn-outline-primary'} `;
      btn.style.cssText = 'min-width: 70px;';
      btn.textContent = tStr;
      if (isTaken) btn.innerHTML = `< s > ${tStr}</s > `;

      if (!isTaken) {
        btn.onclick = () => {
          timeGrid.querySelectorAll('button').forEach(b => {
            b.classList.remove('btn-primary', 'text-white');
            b.classList.add('btn-outline-primary');
          });
          btn.classList.remove('btn-outline-primary');
          btn.classList.add('btn-primary', 'text-white');

          document.getElementById('resched-time').value = tStr;
          document.getElementById('btn-resched-confirm').disabled = false;

          // Update summary
          const dParts = dateStr.split('-');
          const dateObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
          const dateTextFull = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
          const sumText = document.getElementById('resched-summary-text');
          sumText.textContent = `${dateTextFull.charAt(0).toUpperCase() + dateTextFull.slice(1)} \u2022 ${tStr} hrs`;
          document.getElementById('resched-summary').classList.remove('d-none');
        };
      }
      timeGrid.appendChild(btn);
    });

    if (slots.length === 0) {
      timeGrid.innerHTML = '<div class="text-muted small w-100 text-center py-2">No hay horarios disponibles.</div>';
    }

    timeMsg.classList.add('d-none');
    timeGrid.classList.remove('d-none');
  }

  function init(ctx) {
    if (!ctx || !ctx.profile) return;

    // Leemos el rol y la especialidad (ambos nombres)
    const role = ctx.profile.role;
    const specialty = (ctx.profile.especialidad || ctx.profile.specialty || '').toLowerCase();

    // Si eres médico O si tu especialidad es psicólogo, vas a la vista profesional
    if (role === 'medico' || role === 'psicologo' || specialty === 'psicologo' || specialty === 'medico') {
      initAdmin(ctx);
    } else {
      initStudent(ctx);
    }

    // Intentar restaurar estado previo (State Persistence)
    if (window.ModuleStateManager) {
      const savedState = ModuleStateManager.restoreState('view-medi');
      // restoreState() se encarga de aplicar el estado si existe
    }
  }

  // --- CIE-10 HELPER ---
  const _CIE10_DB = [
    { c: 'J00', d: 'Rinofaringitis aguda (Resfriado común)' },
    { c: 'J01', d: 'Sinusitis aguda' },
    { c: 'J02', d: 'Faringitis aguda' },
    { c: 'J03', d: 'Amigdalitis aguda' },
    { c: 'R51', d: 'Cefalea' },
    { c: 'K29', d: 'Gastritis y duodenitis' },
    { c: 'A09', d: 'Diarrea y gastroenteritis de presunto origen infeccioso' },
    { c: 'N39.0', d: 'Infección de vías urinarias, sitio no especificado' },
    { c: 'M54.5', d: 'Lumbago no especificado' },
    { c: 'R10.4', d: 'Otros dolores abdominales y los no especificados (Colicos)' }
  ];

  function searchCIE10(term) {
    const list = document.getElementById('cie10-results');
    if (!term || term.length < 2) { list.classList.add('d-none'); return; }

    const match = _CIE10_DB.filter(i => i.d.toLowerCase().includes(term.toLowerCase()) || i.c.toLowerCase().includes(term.toLowerCase()));

    if (match.length === 0) { list.classList.add('d-none'); return; }

    list.innerHTML = match.map(i => `
  < button type = "button" class="list-group-item list-group-item-action small" onclick = "AdminMedi.selectCIE10('${i.c} - ${i.d}')" >
    <span class="fw-bold text-primary">${i.c}</span> ${i.d}
         </button >
  `).join('');
    list.classList.remove('d-none');
  }

  function selectCIE10(val) {
    const txt = document.getElementById('soap-a');
    const search = document.getElementById('soap-cie10-search');
    const list = document.getElementById('cie10-results');

    // Append if text exists, else set
    txt.value = txt.value ? txt.value + '; ' + val : val;
    search.value = '';
    list.classList.add('d-none');
  }



  // --- E3: FOLLOW-UP BANNER (Student) ---
  async function renderFollowUpBanner(uid) {
    const container = document.getElementById('medi-followup-banner');
    if (!container) {
      // Create container if it doesn't exist (inject after greeting)
      const greeting = document.querySelector('.welcome-banner'); // Adjust selector as needed
      if (greeting) {
        const div = document.createElement('div');
        div.id = 'medi-followup-banner';
        div.className = 'mb-4';
        greeting.parentNode.insertBefore(div, greeting.nextSibling);
      } else {
        return;
      }
    }

    try {
      // Reusing logic from getFollowUps but for specific student
      // Ideally we should have a specific service method, but we can query 'consultas' directly
      // Or better, let's add getStudentPendingFollowUps to MediService
      const docs = await MediService.getStudentFollowUps(_ctx, uid);

      const banner = document.getElementById('medi-followup-banner');
      if (docs.length === 0) {
        banner.innerHTML = '';
        return;
      }

      // Show the most urgent/recent one
      const f = docs[0];
      const dateObj = f.followUpDate ? new Date(f.followUpDate + 'T12:00:00') : new Date(); // Approximate
      const dateStr = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      const isLate = new Date() > dateObj;

      banner.innerHTML = `
  < div class="alert ${isLate ? 'alert-danger border-danger' : 'alert-warning border-warning'} border-start border-4 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 animate-fade-in" >
          <div>
            <div class="fw-bold"><i class="bi bi-exclamation-circle-fill me-2"></i>Seguimiento Recomendado</div>
            <div class="small">
              Tu profesional indic\u00f3 una cita de seguimiento para el operiodo: <strong>${dateStr}</strong>.
              ${f.followUpNotes ? `<br><span class="fst-italic text-muted">Nota: ${escapeHtml(f.followUpNotes)}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-sm ${isLate ? 'btn-danger' : 'btn-warning'} fw-bold" 
                  onclick="document.getElementById('medi-cita-motivo').value = 'Seguimiento: ${escapeHtml(f.followUpNotes || '')}'; document.querySelector('#form-medi-nueva-cita').scrollIntoView({behavior:'smooth'}); document.getElementById('medi-cita-motivo').focus();">
            <i class="bi bi-calendar-event me-1"></i>Agendar Ahora
          </button>
        </div >
  `;

    } catch (e) {
      console.error('Error rendering follow-up banner:', e);
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
  < div class="list-group-item list-group-item-action border-0 mb-1 rounded-3 px-3 py-2 cursor-pointer" onclick = "AdminMedi.showConsultationDetails('${encodeURIComponent(JSON.stringify(d))}')" >
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
      // If we are operating as 'Médico' or 'Psicologo' but distinct from the base user ID context,
      // we must use the Composite Profile ID to match what the Student sees.
      // E.g. If I am 'Médico', I should use 'UID_Médico' as my profileId if I don't have a specific Shift Profile.
      // This ensures the student sees 'Atención Médica' chat, not 'Admin' chat.

      let profileContextId = _currentProfile ? _currentProfile.id : null;

      if (!profileContextId && (_myRole === 'Médico' || _myRole === 'Psicologo')) {
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
              <button class="btn btn-sm btn-dark rounded-pill px-3 fw-bold filter-btn active" onclick="AdminMedi._setRecentFilter('all', this)">Todas</button>
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold filter-btn" onclick="AdminMedi._setRecentFilter('registered', this)">Registradas</button>
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold filter-btn" onclick="AdminMedi._setRecentFilter('anonymous', this)">Anónimas</button>
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
        let fecha = c.safeDate || c.createdAt || new Date();
        if (typeof fecha === 'string' || typeof fecha === 'number') fecha = new Date(fecha);
        if (fecha && typeof fecha.toDate === 'function') fecha = fecha.toDate();
        if (!(fecha instanceof Date) || isNaN(fecha)) fecha = new Date();
        const dateStr = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const encoded = encodeURIComponent(JSON.stringify(c));
        const isAnon = c.uid && c.uid.startsWith('anon_');

        return `
  < div class="list-group-item list-group-item-action border-0 border-bottom p-3 rounded-3 mb-1 cursor-pointer"
onclick = "AdminMedi.showConsultationQuickDetail('${encoded}')" >
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
  // 2. Quick Detail Modal
  function showConsultationQuickDetail(encoded) {
    try {
      const c = JSON.parse(decodeURIComponent(encoded));
      const modalId = 'modalQuickDetail';

      const existingEl = document.getElementById(modalId);
      if (existingEl) {
        const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
        if (bs && bs.Modal) { const inst = bs.Modal.getInstance(existingEl); if (inst) inst.dispose(); }
        existingEl.remove();
      }

      let fecha = c.safeDate || c.createdAt || new Date();
      if (typeof fecha === 'string' || typeof fecha === 'number') fecha = new Date(fecha);
      if (fecha && typeof fecha.toDate === 'function') fecha = fecha.toDate();
      if (!(fecha instanceof Date) || isNaN(fecha)) fecha = new Date();

      const dateStr = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isAnon = c.uid && c.uid.startsWith('anon_');
      const name = c.patientName || c.studentEmail || 'Estudiante';
      const initial = name[0].toUpperCase();

      const COLORS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'],
      ['#fce7f3', '#9d174d'], ['#fef3c7', '#92400e'], ['#fee2e2', '#991b1b']];
      const [bgC, fgC] = COLORS[initial.charCodeAt(0) % COLORS.length];

      const isPsico = (c.tipoServicio || '').toLowerCase().includes('psico');
      const gradientHdr = isPsico
        ? 'linear-gradient(135deg,#7c3aed,#a855f7)'
        : 'linear-gradient(135deg,#1d4ed8,#3b82f6)';

      const vitalsHtml = c.signos ? `
  < div class="d-flex gap-2 flex-wrap mb-3" >
    ${c.signos.temp ? `<div class="soap-vital-pill"><label>Temp</label><div class="fw-bold text-primary">${c.signos.temp}°C</div></div>` : ''}
          ${c.signos.presion ? `<div class="soap-vital-pill"><label>Presion</label><div class="fw-bold text-primary">${c.signos.presion}</div></div>` : ''}
          ${c.signos.peso ? `<div class="soap-vital-pill"><label>Peso</label><div class="fw-bold text-primary">${c.signos.peso}kg</div></div>` : ''}
          ${c.signos.talla ? `<div class="soap-vital-pill"><label>Talla</label><div class="fw-bold text-primary">${c.signos.talla}cm</div></div>` : ''}
        </div > ` : '';

      const soapRow = (label, badgeColor, value) => value ? `
  < div class="d-flex gap-2 mb-2 align-items-start" >
          <span class="badge rounded-pill text-white fw-bold flex-shrink-0 mt-1"
                style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:${badgeColor};">${label}</span>
          <div class="small text-dark" style="line-height:1.4;">${escapeHtml(value)}</div>
        </div > ` : '';

      const html = `
  < div class="modal fade" id = "${modalId}" tabindex = "-1" style = "z-index:1065;" >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">

        <!-- Header con gradiente -->
        <div class="modal-header border-0 p-4 pb-3" style="background:${gradientHdr};">
          <div class="d-flex align-items-center gap-3 w-100">
            <div class="medi-avatar flex-shrink-0" style="background:rgba(255,255,255,.2);color:#fff;width:48px;height:48px;font-size:1.2rem;">${initial}</div>
            <div class="flex-fill">
              <div class="fw-bold text-white" style="font-size:.95rem;">${escapeHtml(name)}</div>
              <div class="text-white-75" style="font-size:.7rem;opacity:.8;">${dateStr} &bull; ${timeStr}</div>
              <div class="mt-1">
                <span class="badge bg-opacity-20 text-white border border-white border-opacity-30" style="font-size:.6rem;">
                  ${isAnon ? 'Walk-in / Anonimo' : (isPsico ? '<i class="bi bi-chat-heart-fill me-1"></i>Psicología' : '<i class="bi bi-bandaid-fill me-1"></i>Medicina')}
                </span>
              </div>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white flex-shrink-0" data-bs-dismiss="modal"></button>
        </div>

        <div class="modal-body p-4">
          <!-- Diagnostico -->
          <div class="mb-3 p-3 rounded-3" style="background:#f0f7ff;">
            <div class="text-muted fw-bold mb-1" style="font-size:.65rem;text-transform:uppercase;letter-spacing:.5px;">Diagnostico / Motivo</div>
            <div class="fw-bold text-dark" style="font-size:1rem;">${escapeHtml(c.diagnostico || c.motivo || 'No registrado')}</div>
          </div>

          ${vitalsHtml}

          <!-- SOAP chips -->
          <div class="mb-3">
            ${soapRow('S', '#1d4ed8', c.subjetivo)}
            ${soapRow('O', '#059669', c.objetivo)}
            ${soapRow('P', '#0f766e', c.plan || c.meds)}
          </div>

          <!-- Acciones -->
          <div class="d-grid gap-2">
            ${!isAnon ? `
                    <button class="btn btn-primary rounded-pill fw-bold"
                            onclick="AdminMedi.showFullRecord('${c.studentId || c.uid}');
                                     bootstrap.Modal.getInstance(document.getElementById('${modalId}')).hide();">
                      <i class="bi bi-folder2-open me-2"></i>Ver Expediente Completo
                    </button>` : ''}
            <button class="btn btn-outline-secondary rounded-pill fw-bold"
              onclick="bootstrap.Modal.getInstance(document.getElementById('${modalId}')).hide();">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
        </div>`;

      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div.firstElementChild);
      const modal = new bootstrap.Modal(document.getElementById(modalId));
      modal.show();
      document.getElementById(modalId).addEventListener('hidden.bs.modal', e => { try { e.target.remove(); } catch (_) { } });
    } catch (err) {
      console.error('[QuickDetail] Error:', err);
      showToast('Error al abrir detalle', 'danger');
    }
  }



  return {
    init: initAdmin,
    initAdmin,
    setShift,
    _switchWorkTab,
    _switchContextTab,
    _showPatientInContext,
    _loadPatientQuickHistory,
    _selectWaitingPatient,
    buildSlotsForDate,
    renderStructure,
    showAdminConfigModal,
    openManualBooking,
    searchStudentForBooking,
    confirmAdminBooking,
    renderAdminBookingDates,
    selectAdminDate,
    selectAdminTime,
    handlePinLogin,
    finishProfileSetup,
    initAdminChat,
    startAdminChatStream,
    openAdminConversation,
    closeAdminConversation,
    sendAdminMessage,
    finishInit,
    loadRecentActivity,
    toggleServiceAvailability,
    filterWaitingRoom,
    buscarPaciente,
    showPatientFoundModal,
    startWalkIn,
    loadWall,
    validarAcompañamiento,
    loadMyAgenda,
    togglePrioridad,
    tomarPaciente,
    rechazarCita,
    cancelarCitaAdmin,
    iniciarConsulta,
    renderInlineConsultationUI,
    _startConsultaTimer,
    _stopConsultaTimer,
    _getConsultaDurationMinutes,
    _cleanupConsultation,
    _renderConversationList,
    openConversation,
    _renderMessages,
    sendChatMessage,
    closeChatConversation,
    startChatWith: startChatWithStudent,
    startChatWithStudent,
    loadMiniHistorySidebar,
    loadHistory,
    confirmarFinalizacion,
    saveConsultation,
    cerrarSuccessModal,
    loadPatientSidebarWait,
    showFullRecord,
    renderGeneralFile,
    renderConsultationDetail,
    printRecetaFromDetail,
    showShiftSetupModal,
    nuevaConsultaWalkIn,
    verHistorialRapido,
    showBookingModal,
    updateCedula,
    editarTarjeta,
    cancelarEdicionTarjeta,
    toggleSOS,
    loadDayMetrics,
    _loadFollowUps,
    refreshAdmin,
    saveConfig,
    toggleAvailability,
    testSound,
    printReceta,
    sendToPatient,
    printRecetaFromHistory,
    showConsultationDetails,
    solicitarCancelacion,
    prepararEdicion,
    _reschedSelectDate,
    searchCIE10,
    selectCIE10,
    renderFollowUpBanner,
    _loadRecentActivity,
    showAllRecentModal,
    _setRecentFilter,
    _loadAllRecentItems,
    showConsultationQuickDetail,
    openMiAgendaModal,
    openWaitingRoomModal,
    openSearchModal,
    buscarPacienteModal,
    openMessagesModal,
    searchAndChat,
    startClock,
    updateDashboardStats,
    saveState,
    restoreState,
    cancelarConsultaActiva: async () => {
      if (!confirm('¿Seguro que deseas cancelar esta consulta?\n\nSe perderán los cambios no guardados.')) return;
      // No hay borrador remoto que borrar; solo limpiamos el estado local
      _cleanupConsultation();
      const soapModal = document.getElementById('modalConsulta');
      if (soapModal) {
        const inst = bootstrap.Modal.getInstance(soapModal);
        if (inst) inst.hide();
      }
      showToast('Consulta cancelada.', 'info');
    }
  };


  function saveState() {
    const state = {
      timestamp: Date.now(),
      formData: {},
      selectedValues: {},
      scrollPosition: window.pageYOffset || document.documentElement.scrollTop
    };

    // Guardar valores de formularios principales
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
    }

    console.log('[AdminMedi] Estado restaurado exitosamente');
  }

})();

window.AdminMedi = AdminMedi;
console.log("[AdminMedi] Admin Module Loaded & Globalized");
