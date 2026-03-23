// admin.medi.ui.js
if (!window.AdminMedi) window.AdminMedi = {};
if (!window.AdminMedi._patientCache) window.AdminMedi._patientCache = new Map();
window.AdminMedi.Ui = (function () {
  // Sub-module ui
  const getOperationalContext = () => AdminMedi.getOperationalContext ? AdminMedi.getOperationalContext() : {
    role: AdminMedi.State.myRole,
    shift: AdminMedi.State.currentShift || null,
    profileId: AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null,
    ownerUid: AdminMedi.State.myUid
  };
  const normalizeSigns = (exp = {}) => {
    const src = exp.signos || {};
    return {
      temp: src.temp ?? exp.temp ?? null,
      presion: src.presion ?? exp.presion ?? null,
      peso: src.peso ?? exp.peso ?? null,
      talla: src.talla ?? exp.talla ?? null,
    };
  };
  const isAnonymousRecord = (exp = {}) => !!(exp.isAnonymous || (typeof exp.studentId === 'string' && exp.studentId.startsWith('anon_')));

  async function _resolvePrivateConsultationNotes(exp = {}) {
    const inlineNotes = String(exp?.notasPrivadas || '').trim();
    const scope = getOperationalContext();
    if (inlineNotes) {
      if (exp.studentId && exp.id && MediService?.migrateLegacyPrivateConsultaNote) {
        MediService.migrateLegacyPrivateConsultaNote(AdminMedi.State.ctx, exp.studentId, exp.id, inlineNotes, exp).catch(() => { });
      }
      return inlineNotes;
    }

    if (!exp.studentId || !exp.id || !MediService?.getPrivateConsultaNote) return '';
    return MediService.getPrivateConsultaNote(AdminMedi.State.ctx, exp.studentId, exp.id, scope, exp);
  }

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

  function _showPatientInContext(student) {
    _switchContextTab('patient');
    const container = document.getElementById('medi-patient-context');
    if (!container) return;

    // Cache patient data by uid to avoid inline JSON serialization (XSS prevention)
    const patientKey = student.id || student.uid;
    if (patientKey) window.AdminMedi._patientCache.set(patientKey, student);

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
        ${age != null ? `<div class="col-4 text-center"><div class=" rounded-3 p-2"><div class="extra-small text-muted">Edad</div><div class="fw-bold small">${age}</div></div></div>` : ''}
        ${student.tipoSangre ? `<div class="col-4 text-center"><div class=" rounded-3 p-2"><div class="extra-small text-muted">Sangre</div><div class="fw-bold small text-danger">${escapeHtml(student.tipoSangre)}</div></div></div>` : ''}
        ${student.genero ? `<div class="col-4 text-center"><div class=" rounded-3 p-2"><div class="extra-small text-muted">Género</div><div class="fw-bold small">${escapeHtml(student.genero)}</div></div></div>` : ''}
      </div>
      ${student.alergias ? `<div class="alert alert-danger border-0 py-2 px-3 small mb-3"><i class="bi bi-exclamation-triangle-fill me-1"></i><strong>Alergias:</strong> ${escapeHtml(student.alergias)}</div>` : ''}
      <div class="d-grid gap-2">
        <button class="btn btn-sm btn-primary rounded-pill fw-bold" onclick="AdminMedi.startWalkIn('${escapeHtml(patientKey)}')">
            <i class="bi bi-lightning-charge-fill me-1"></i>Atender Ahora
        </button>
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-dark flex-fill rounded-pill fw-bold" onclick="AdminMedi.showFullRecord('${escapeHtml(patientKey)}')">
              <i class="bi bi-folder2-open me-1"></i>Expediente
            </button>
            <button class="btn btn-sm btn-outline-primary flex-fill rounded-pill" onclick="AdminMedi.openManualBooking('${escapeHtml(patientKey)}')" title="Reservar Cita">
              <i class="bi bi-calendar-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary flex-fill rounded-pill" onclick="AdminMedi.startChatWithStudent('${escapeHtml(patientKey)}', '${escapeHtml(student.displayName || student.email)}')">
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
      const profId = AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null;
      const history = await MediService.getExpedienteHistory(AdminMedi.State.ctx, uid, AdminMedi.State.myRole, AdminMedi.State.myUid, AdminMedi.State.currentShift, profId);
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
          <span class="badge  text-muted border" style="font-size:.6rem;">${escapeHtml(h.tipoServicio || '')}</span>
        </div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = '<div class="text-danger extra-small">Error cargando historial</div>';
    }
  }

  function _selectWaitingPatient(cardEl, encodedStudent) {
    // Highlight selected card
    document.querySelectorAll('.medi-wait-card.selected').forEach(el => el.classList.remove('selected'));
    cardEl.classList.add('selected');

    try {
      const student = JSON.parse(decodeURIComponent(encodedStudent));
      // Fetch full profile from Firestore for complete data
      AdminMedi.State.ctx.db.collection('usuarios').doc(student.uid).get().then(snap => {
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
                       <div id="medi-time-msg" class="p-4  rounded-4 text-center text-muted small border border-dashed">
                          <i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero
                       </div>
                       <input type="hidden" id="medi-cita-hora" required>
                       <div id="medi-time-grid" class="d-none gap-2 flex-wrap mt-2"></div>
                    </div>
                  </div>

                  <div class="col-12 mt-3">
                    <label class="form-label small fw-bold text-muted">Motivo / Síntomas (Opcional)</label>
                    <textarea class="form-control border-0  rounded-3" id="medi-cita-motivo" rows="2" placeholder="Describe brevemente cómo te sientes..."></textarea>
                  </div>
                </div>
                
                <!-- CONFIRMATION DETAILS BLOCK -->
                <div id="medi-booking-summary" class="mt-4 p-3 rounded-4  d-none slide-up-anim">
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
            <div class="card-body p-3 -subtle">
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
                              <div id="resched-time-msg" class="p-3  rounded-3 text-center text-muted small border border-dashed">
                                <i class="bi bi-calendar-check d-block mb-1"></i> Selecciona un d\u00eda primero
                              </div>
                              <div id="resched-time-grid" class="d-none d-flex flex-wrap gap-2 justify-content-center mt-2 p-2"></div>
                            </div>

                            <div id="resched-summary" class="d-none mt-3 p-3 rounded-4 ">
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
             <div class="card-body p-3 ">
                <div id="medi-stu-consultas" class="scroll-container" style="max-height: 400px;">
                    <div class="text-center py-3 text-muted small">Sin consultas registradas.</div>
                </div>
             </div>
          </div>

             <div class="card border-0 shadow-sm rounded-4 mt-3 mb-3">
               <div class="card-header bg-white py-3">
                 <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-clock-history me-2 text-primary"></i>Actividad Reciente</h6>
               </div>
               <div class="card-body p-0">
                  <div id="medi-stu-recent-list" class="list-group list-group-flush">
                     <div class="text-center p-3 text-muted small">
                        <span class="spinner-border spinner-border-sm me-2"></span>Cargando historial...
                     </div>
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
               <h6 class="fw-bold mb-0" id="medi-service-status-title">Tu agenda está deshabilitada</h6>
               <p class="mb-0 small opacity-75" id="medi-service-status-text">Los alumnos no pueden agendar contigo en este momento.</p>
           </div>
           <button id="medi-service-status-action" class="btn btn-sm btn-light text-danger fw-bold ms-auto rounded-pill" onclick="AdminMedi.showAdminConfigModal()">Configurar</button>
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
           
           <div class="text-end d-flex align-items-center gap-2">
              <button id="medi-tutorial-fab" onclick="(document.querySelector('admin-medi-tour') || document.body.appendChild(document.createElement('admin-medi-tour'))).open()" class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold shadow-sm d-none d-md-inline-block" title="Abrir tutorial del panel">
                  <i class="bi bi-lightbulb-fill me-1 text-warning"></i>Tutorial
              </button>
              
              <!-- [NEW] Mensajes Button (Desktop) -->
              <button onclick="AdminMedi.openMessagesModal()" class="btn btn-sm text-white rounded-pill px-3 fw-bold shadow-sm d-none d-md-inline-flex align-items-center gap-2" style="background: linear-gradient(135deg, #6f42c1 0%, #a855f7 100%); border: none;" title="Abrir Mensajes">
                  <i class="bi bi-chat-dots-fill"></i>Mensajes
                  <span id="badge-unread-msgs" class="badge bg-danger rounded-pill d-none ms-1">0</span>
              </button>

              <!-- [NEW] Mensajes Button (Mobile) -->
              <button onclick="AdminMedi.openMessagesModal()" class="btn btn-sm text-white rounded-circle shadow-sm d-md-none bg-purple position-relative" style="width: 38px; height: 38px; padding: 0; background: linear-gradient(135deg, #6f42c1 0%, #a855f7 100%); border: none;" title="Abrir Mensajes">
                  <i class="bi bi-chat-dots-fill fs-5"></i>
                  <span id="badge-unread-msgs-mobile" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" style="font-size: 0.6rem;">0</span>
              </button>

              <button onclick="(document.querySelector('admin-medi-tour') || document.body.appendChild(document.createElement('admin-medi-tour'))).open()" class="btn btn-sm btn-outline-primary rounded-circle shadow-sm d-md-none border-0 bg-white" style="width: 38px; height: 38px; padding: 0;" title="Abrir tutorial">
                  <i class="bi bi-lightbulb-fill fs-5 text-warning"></i>
              </button>
              <div class="text-end ms-3">
                  <h3 class="fw-bold text-dark mb-0 font-monospace" id="admin-clock-time">--:--:--</h3>
                  <p class="text-muted mb-0 small text-capitalize" id="admin-clock-date">Cargando fecha...</p>
              </div>
          </div>
       </div>
       <input type="hidden" id="medi-pro-cedula" value="">

       <div class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.05s;">
          <div class="col-12">
             <div id="medi-active-session-context" class="alert alert-primary border-0 rounded-4 shadow-sm d-none mb-0"></div>
          </div>
          <div id="medi-quick-pause-source" class="col-12">
             <div id="medi-quick-pause-card" class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-3">
                   <div class="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center gap-3">
                      <div class="flex-fill">
                         <div class="fw-bold text-dark">Pausa rápida de agenda</div>
                         <div class="small text-muted">Pausa las citas nuevas sin entrar a configuración.</div>
                         <div id="medi-quick-pause-status" class="small text-muted mt-1">Agenda activa para citas nuevas.</div>
                      </div>
                      <div class="d-flex flex-wrap justify-content-xl-end align-items-center gap-2 flex-shrink-0">
                         <button class="btn btn-sm btn-outline-dark rounded-pill px-3 fw-bold" onclick="AdminMedi.pauseScheduleFor(30)">30 min</button>
                         <button class="btn btn-sm btn-outline-dark rounded-pill px-3 fw-bold" onclick="AdminMedi.pauseScheduleFor(60)">1 h</button>
                         <button class="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold" onclick="AdminMedi.clearQuickPause()">Reanudar</button>
                         <button class="btn btn-sm btn-light rounded-pill px-3" onclick="AdminMedi.showAdminConfigModal()">
                            <i class="bi bi-sliders me-1"></i>Ver más
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       <!-- ============================================ -->
       <!--          ACTION CARDS (Biblio-style)         -->
       <!-- ============================================ -->
       <div id="admin-dashboard-content" class="container-fluid px-0 animate__animated animate__fadeInUp">

           <!-- ACTION CARDS ROW (v5 Gradientes + iconos ilustrativos) -->
           <div class="row g-3 mb-4 row-cols-2 row-cols-md-3 justify-content-center">

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
                             <h6 class="fw-bold mb-0 text-white">Atender Ahora</h6>
                             <span class="small opacity-75">Walk-in directo</span>
                          </div>
                       </div>
                       <i class="bi bi-clipboard2-pulse-fill position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

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
                             <h6 class="fw-bold mb-0 text-white">Reservar Cita</h6>
                             <span class="small opacity-75">Crear cita manual</span>
                          </div>
                       </div>
                       <i class="bi bi-calendar2-plus-fill position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

              <div class="col">
                 <div class="card border-0 shadow h-100 cursor-pointer rounded-4 overflow-hidden position-relative" onclick="AdminMedi.openMessagesModal()"
                      style="background: linear-gradient(135deg, #6f42c1 0%, #a855f7 100%); transition: transform 0.2s, box-shadow 0.2s;"
                      onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 28px rgba(111,66,193,.35)'"
                      onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body p-4 text-white d-flex flex-column align-items-start justify-content-between" style="min-height:140px;">
                       <div class="d-flex align-items-center gap-3 mb-2">
                          <div class="bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                             <i class="bi bi-chat-dots-fill fs-3 text-white"></i>
                          </div>
                          <div>
                             <h6 class="fw-bold mb-0 text-white">Mensajes</h6>
                             <span class="small opacity-75">Chat con estudiantes</span>
                          </div>
                       </div>
                       <span class="badge bg-opacity-25 text-white rounded-pill px-3 mt-auto" style="font-size:1rem;"><span id="badge-unread-msgs-card">0</span> sin leer</span>
                       <i class="bi bi-chat-dots-fill position-absolute opacity-10" style="font-size:5rem;bottom:-10px;right:-5px;"></i>
                    </div>
                 </div>
              </div>

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
                             <span class="small opacity-75">Horarios, pausa y cédula</span>
                          </div>
                       </div>
                       <span class="badge bg-opacity-25 text-white rounded-pill px-3 mt-auto" id="badge-sala-espera" style="font-size:1rem;">0 en espera</span>
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
                <div class="card border-0 shadow-sm rounded-4 h-100 cursor-pointer"
                     onclick="AdminMedi.openFollowUpsModal()"
                     style="background: linear-gradient(135deg, #fce8f4 0%, #fdf5fa 100%); cursor:pointer;">
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

          <div id="medi-row-operational-panels" class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.22s;">
             <div class="col-xl-4">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center gap-2">
                         <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                            <i class="bi bi-calendar-check text-primary" style="font-size:.9rem;"></i>
                         </div>
                         <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size:.9rem;">Agenda del Día</h6>
                            <div class="text-muted" style="font-size:.68rem;">
                               <span id="medi-agenda-count" class="fw-bold text-primary">0</span> citas para hoy
                            </div>
                         </div>
                      </div>
                      <button class="btn btn-sm btn-light rounded-pill px-3 d-flex align-items-center gap-1" onclick="AdminMedi.refreshAdmin()" style="font-size:.7rem;">
                         <i class="bi bi-arrow-clockwise"></i>
                         <span class="d-none d-sm-inline">Actualizar</span>
                      </button>
                   </div>
                   <div class="card-body p-3" style="max-height: 390px; overflow-y: auto; scrollbar-width: thin;">
                      <div id="medi-agenda-list">
                         <div class="medi-empty-state">
                            <i class="bi bi-calendar-x"></i>
                            <p>Sin citas para hoy</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
             <div class="col-xl-4">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center gap-2">
                         <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                            <i class="bi bi-calendar3 text-warning" style="font-size:.9rem;"></i>
                         </div>
                         <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size:.9rem;">Próximas Citas</h6>
                            <div class="text-muted" style="font-size:.68rem;">
                               <span id="medi-upcoming-count" class="fw-bold text-warning">0</span> agendadas para otros días
                            </div>
                         </div>
                      </div>
                      <button class="btn btn-sm btn-light rounded-pill px-3 d-flex align-items-center gap-1" onclick="AdminMedi.openMiAgendaModal()" style="font-size:.7rem;">
                         <i class="bi bi-calendar-week"></i>
                         <span class="d-none d-sm-inline">Abrir agenda</span>
                      </button>
                   </div>
                   <div class="card-body p-3" style="max-height: 390px; overflow-y: auto; scrollbar-width: thin;">
                      <div id="medi-upcoming-list">
                         <div class="medi-empty-state">
                            <i class="bi bi-calendar2-week"></i>
                            <p>Sin citas en días posteriores</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
             <div class="col-xl-4">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center gap-2">
                         <div class="bg-danger bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                            <i class="bi bi-people-fill text-danger" style="font-size:.9rem;"></i>
                         </div>
                         <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size:.9rem;">Sala de Espera</h6>
                            <div class="text-muted" style="font-size:.68rem;">
                               <span id="medi-waiting-room-count" class="fw-bold text-danger">0</span> pacientes pendientes
                            </div>
                         </div>
                      </div>
                      <button class="btn btn-sm btn-light rounded-pill px-3 d-flex align-items-center gap-1" onclick="AdminMedi.openWaitingRoomModal()" style="font-size:.7rem;">
                         <i class="bi bi-layout-text-sidebar-reverse"></i>
                         <span class="d-none d-sm-inline">Ver sala</span>
                      </button>
                   </div>
                   <div class="card-body p-3" style="max-height: 390px; overflow-y: auto; scrollbar-width: thin;">
                      <div id="medi-waiting-room-list">
                         <div class="medi-empty-state">
                            <i class="bi bi-cup-hot"></i>
                            <p>Sala vacía por ahora</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div id="medi-row-recent-activity" class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.26s;">
             <div class="col-12">
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
                   <div class="card-body p-3" style="max-height: 390px; overflow-y: auto; scrollbar-width: thin;">
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

          <div id="medi-row-summary" class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.3s;">
             <div class="col-12">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3">
                      <h6 class="fw-bold mb-0 text-dark">Resumen operativo</h6>
                      <div class="text-muted" style="font-size:.72rem;">Métricas clínicas y de flujo del día.</div>
                   </div>
                   <div class="card-body p-3" id="medi-day-stats">
                      <div class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span></div>
                   </div>
                </div>
             </div>
          </div>

          <div id="medi-row-priority" class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.34s;">
             <div class="col-12">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                      <div>
                         <h6 class="fw-bold mb-0 text-dark">Centro de acciones del día</h6>
                         <div class="text-muted" style="font-size:.72rem;">Siguiente turno, seguimientos y mensajes en una sola vista.</div>
                      </div>
                      <div class="d-flex gap-2">
                         <button class="btn btn-sm btn-light rounded-pill px-3" onclick="AdminMedi.openMessagesModal()">
                            <i class="bi bi-chat-dots me-1"></i>Mensajes
                         </button>
                         <button class="btn btn-sm btn-light rounded-pill px-3" onclick="AdminMedi.refreshAdmin()">
                            <i class="bi bi-arrow-clockwise me-1"></i>Actualizar
                         </button>
                      </div>
                   </div>
                   <div class="card-body p-3" id="medi-priority-actions">
                      <div class="medi-empty-state">
                         <i class="bi bi-list-check"></i>
                         <p>Cargando acciones prioritarias...</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div id="medi-row-patient-insights" class="row g-3 mb-4 animate__animated animate__fadeInUp" style="animation-delay:0.38s;">
             <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3">
                      <h6 class="fw-bold mb-0 text-dark">Pacientes recientes</h6>
                      <div class="text-muted" style="font-size:.72rem;">Últimos alumnos atendidos con acciones directas.</div>
                   </div>
                   <div class="card-body p-3" id="medi-patients-recent">
                      <div class="medi-empty-state">
                         <i class="bi bi-clock-history"></i>
                         <p>Cargando pacientes recientes...</p>
                      </div>
                   </div>
                </div>
             </div>
             <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                   <div class="card-header bg-white border-0 py-3">
                      <h6 class="fw-bold mb-0 text-dark">Pacientes frecuentes</h6>
                      <div class="text-muted" style="font-size:.72rem;">Quienes vuelven más seguido a consulta.</div>
                   </div>
                   <div class="card-body p-3" id="medi-patients-frequent">
                      <div class="medi-empty-state">
                         <i class="bi bi-stars"></i>
                         <p>Cargando pacientes frecuentes...</p>
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
          <div id="medi-agenda-all-list"></div>
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
                      <p class="mb-0 small opacity-75">Citas programadas</p>
                   </div>
                   <button type="button" class="btn-close bg-light btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                   <div id="modal-agenda-list" class="p-3 -subtle" style="min-height: 200px;">
                      <div class="text-center py-5 opacity-50">
                         <i class="bi bi-calendar-x display-4 d-block mb-2"></i>
                         <p class="fw-bold">Sin citas programadas</p>
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
                   <button type="button" class="btn-close bg-light btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                   <!-- Filters -->
                   <div class="px-4 py-3  border-bottom sticky-top" style="z-index:1020;">
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
                   <button type="button" class="btn-close bg-light btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                   <div class="p-3 border-bottom bg-light">
                      <div class="input-group">
                         <input type="text" id="msg-search-input" class="form-control rounded-start-pill" placeholder="Buscar alumno para iniciar chat..." onkeydown="if(event.key==='Enter'){event.preventDefault();AdminMedi.searchAndChat();}">
                         <button class="btn btn-primary rounded-end-pill px-4" type="button" onclick="AdminMedi.searchAndChat()">
                            <i class="bi bi-search"></i>
                         </button>
                      </div>
                      <div id="msg-search-result" class="mt-2"></div>
                   </div>
                   <div id="modal-chat-panel" class="position-relative" style="height: calc(65vh - 86px); min-height: 394px;">
                      <!-- LIST VIEW -->
                      <div id="medi-chat-list" class="h-100 overflow-auto bg-light">
                          <div class="text-center py-5 text-muted small">
                             <span class="spinner-border spinner-border-sm mb-2 text-primary"></span>
                             <p>Cargando área de mensajes...</p>
                          </div>
                      </div>

                      <!-- CONVERSATION VIEW (Hidden originally) -->
                      <div id="medi-chat-conversation" class="d-none h-100 d-flex flex-column bg-white position-absolute top-0 start-0 w-100" style="z-index: 10;">
                        <div class="p-3 border-bottom bg-white shadow-sm">
                          <div class="d-flex justify-content-between align-items-start gap-2">
                            <button class="btn btn-sm btn-light rounded-circle" onclick="AdminMedi.closeAdminConversation()" style="width:36px;height:36px;"><i class="bi bi-arrow-left"></i></button>
                            <div class="flex-fill text-center text-md-start">
                              <div class="fw-bold fs-6 text-truncate" id="medi-chat-header-name">Chat</div>
                              <div id="medi-chat-header-meta" class="small text-muted"></div>
                            </div>
                            <div class="d-flex gap-2">
                              <button id="medi-chat-record-btn" class="btn btn-sm btn-outline-dark rounded-pill px-3" disabled>
                                <i class="bi bi-folder2-open me-1"></i>Expediente
                              </button>
                              <button id="medi-chat-book-btn" class="btn btn-sm btn-outline-primary rounded-pill px-3" disabled>
                                <i class="bi bi-calendar-plus me-1"></i>Cita
                              </button>
                            </div>
                          </div>
                        </div>
                        <div id="medi-chat-msgs-admin" class="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2" style="background-color: #f8f9fa;"></div>
                        <div class="p-3 border-top bg-white shadow-sm">
                          <form onsubmit="event.preventDefault(); AdminMedi.sendAdminMessage()">
                            <div class="input-group input-group-lg">
                              <input type="text" id="medi-chat-input-admin" class="form-control rounded-pill px-4" placeholder="Escribe un mensaje..." autocomplete="off">
                              <button class="btn btn-primary rounded-pill ms-2 px-4 shadow-sm" type="submit"><i class="bi bi-send-fill"></i></button>
                            </div>
                          </form>
                        </div>
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
                   <button type="button" class="btn-close bg-light btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                   <div class="input-group mb-3">
                      <input type="text" id="modal-search-input" class="form-control form-control-lg border-0  rounded-start-pill" placeholder="Matrícula o nombre..." onkeydown="if(event.key==='Enter'){event.preventDefault();AdminMedi.buscarPacienteModal();}">
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
          <div class="modal-body  p-0">
             <div class="row g-0 h-100">
                <div class="col-md-7 p-4 border-end" style="max-height: 80vh; overflow-auto;">
                   <form id="form-soap">
                      <input type="hidden" id="soap-cita-id">
                      <input type="hidden" id="soap-student-id">
                      <input type="hidden" id="soap-student-email">

                      <div id="soap-precheck-summary" class="mb-3"></div>
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
          <div class="modal-header  border-0 py-3">
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
                    <div class="p-3 rounded-4  d-flex justify-content-around text-center border">
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
                    <p class="small text-muted  p-2 rounded-3 border-start border-3 border-primary" id="detail-subjetivo"></p>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-info small mb-1"><i class="bi bi-clipboard2-pulse me-1"></i> Diagnóstico (A)</h6>
                    <p class="small text-dark fw-bold  p-2 rounded-3 border-start border-3 border-info" id="detail-diagnosis"></p>
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
          <div class="modal-footer  border-0 justify-content-between p-3">
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
                    <div class="mb-4">
                        <label class="form-label extra-small fw-bold text-muted text-uppercase d-block text-center mb-2">
                            <i class="bi bi-person-badge me-1"></i>Perfiles disponibles
                        </label>
                        <div id="medi-pin-profiles-list" class="d-grid gap-2"></div>
                    </div>
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
                <div class=" p-2 text-center border-top" style="font-size: 0.65rem;">
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
            
            <div class="card  border-0 mb-4 p-3 rounded-3 text-start">
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
            <button type="button" class="btn-close bg-light btn-close-white" data-bs-dismiss="modal"></button>
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
                         class="form-control border-0  fw-semibold"
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
                       class="text-center small text-muted fst-italic py-3  rounded-3 border">
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
                  <select class="form-select border-0  fw-semibold mb-2 rounded-3" id="adm-book-category">
                    <option value="Consulta General">🩺 Consulta General</option>
                    <option value="Urgencia Menor">⚡ Urgencia Menor</option>
                    <option value="Seguimiento">🔄 Seguimiento</option>
                    <option value="Certificado Médico">📋 Certificado Médico</option>
                    <option value="Salud Mental">💬 Salud Mental (Psicología)</option>
                  </select>
                  <textarea id="adm-book-reason" class="form-control border-0  rounded-3"
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

  async function loadPatientSidebarWait(student) {
    const profileDiv = document.getElementById('soap-patient-profile');
    profileDiv.innerHTML = '<div class="text-center p-2"><span class="spinner-border spinner-border-sm"></span> Cargando datos...</div>';

    // 1. Fetch Last Visit (Consulta más reciente con signos vitales)
    let lastVitals = null;
    try {
      // Pass AdminMedi.State.myRole so we get all relevant history (Medical + My Psych if applicable)
      const hist = await MediService.getExpedienteHistory(AdminMedi.State.ctx, student.uid, AdminMedi.State.myRole, AdminMedi.State.myUid, AdminMedi.State.currentShift, AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null);
      if (hist && hist.length > 0) {
        // Prioritize Medical Vitals if available (Physical health source of truth)
        let found = hist.find(h => h.tipoServicio === 'Médico' && h.signos && (h.signos.peso || h.signos.presion));

        // Fallback: If no Medical vitals, take any available (e.g. from Psych if they took them)
        if (!found) found = hist.find(h => h.signos && (h.signos.peso || h.signos.presion));

        if (found) lastVitals = { date: found.safeDate, ...found.signos };
      }
    } catch (e) { console.error("Error fetching last vitals", e); }

    profileDiv.innerHTML = `
  <div class="p-3 bg-white rounded-4 shadow-sm border mb-3">
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
            </div>

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

  async function showFullRecord(uid) {
    // 1. Prepare Modal Container (Large)
    let modalEl = document.getElementById('modalFullRecord');
    if (!modalEl) {
      const div = document.createElement('div');
      div.id = 'modalFullRecord';
      div.className = 'modal fade';
      div.setAttribute('tabindex', '-1');
      document.body.appendChild(div);
      modalEl = div;
    }

    // Always refresh inner context to prevent stale data / DOM issues
    modalEl.innerHTML = `
  <div class="modal-dialog modal-xl modal-dialog-scrollable">
    <div class="modal-content rounded-4 border-0 shadow-lg" style="height: 90vh;">
      <div class="modal-header bg-dark text-white py-2">
        <div class="d-flex align-items-center gap-3">
          <h5 class="modal-title filter-white fw-bold mb-0">Expediente Clínico</h5>
          <span class="badge bg-white text-dark rounded-pill" id="full-record-badge">--</span>
        </div>
        <button type="button" class="btn-close bg-light btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-0 ">
        <div class="row g-0 h-100">
          <div class="col-lg-4 border-end bg-white h-100 overflow-auto" id="full-record-sidebar">
            <div class="text-center p-5"><span class="spinner-border text-primary"></span></div>
          </div>
          <div class="col-lg-8 h-100 overflow-auto " id="full-record-content">
            <div class="d-flex flex-column justify-content-center align-items-center h-100 text-muted opacity-50">
              <i class="bi bi-arrow-left-circle display-1 mb-3"></i>
              <p class="fw-bold">Selecciona una consulta para ver detalles</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) modal = new bootstrap.Modal(modalEl);
    modal.show();

    // 2. Fetch Data
    const sidebar = document.getElementById('full-record-sidebar');
    const content = document.getElementById('full-record-content');

    try {
      const [userSnap, history] = await Promise.all([
        AdminMedi.State.ctx.db.collection('usuarios').doc(uid).get(),
        MediService.getExpedienteHistory(AdminMedi.State.ctx, uid, AdminMedi.State.myRole, AdminMedi.State.myUid, AdminMedi.State.currentShift, AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null)
      ]);

      if (!userSnap.exists) {
        sidebar.innerHTML = '<div class="p-3 text-danger">Usuario no encontrado.</div>';
        return;
      }
      const u = userSnap.data();
      AdminMedi.State.selectedRecordStudent = { id: uid, uid, ...u };

      // Update Header Badge
      document.getElementById('full-record-badge').textContent = u.matricula || 'S/M';

      // Update Header Badge with avatar
      const uInitial = (u.displayName || u.email || 'P')[0].toUpperCase();
      const UCOLORS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'], ['#fce7f3', '#9d174d']];
      const [ubg, ufg] = UCOLORS[uInitial.charCodeAt(0) % UCOLORS.length];
      document.getElementById('full-record-badge').textContent = u.matricula || 'S/M';

      // RENDER SIDEBAR
      sidebar.innerHTML = `
        <!-- MINI PROFILE con avatar -->
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

        <!-- HISTORY LIST -->
        <div class="p-3">
          <div class="d-flex align-items-center justify-content-between mb-3 px-1">
            <span class="text-uppercase text-muted fw-bold" style="font-size:.65rem;letter-spacing:.5px;">Historial de Visitas</span>
            <span class="badge text-muted border" id="fr-visit-count" style="font-size:.65rem;"></span>
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
        renderGeneralFile(content, u, history);
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
  <button class="fr-history-item ${isPsico ? 'psico' : ''} w-100 text-start bg-white border-0 p-3 mb-2 rounded-3 shadow-sm fade-slide-in"
onclick="AdminMedi.renderConsultationDetail(this,'${safeItem}')">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge border fw-bold" style="font-size:.58rem;${isPsico ? 'background:rgba(124,58,237,.1);color:#7c3aed;' : 'background:rgba(13,110,253,.1);color:#0d6efd;'}">
                  ${isPsico ? '<i class="bi bi-chat-heart-fill me-1"></i>Psicología' : '<i class="bi bi-bandaid-fill me-1"></i>Medicina'}
                </span>
                <span class="text-muted" style="font-size:.65rem;">${timeAgo}</span>
              </div>
              <div class="fw-bold text-dark text-truncate mb-1" style="font-size:.82rem;">${item.diagnostico || 'Sin diagnostico'}</div>
              <div class="text-muted text-truncate" style="font-size:.7rem;">${item.subjetivo || 'Sin detalles...'}</div>
            </button>`;
        }).join('');

        renderGeneralFile(content, u, history);
      }
    } catch (e) {
      console.error(e);
      const sidebar = document.getElementById('full-record-sidebar');
      if (sidebar) sidebar.innerHTML = `<div class="alert alert-danger m-3">Error cargando datos: ${e.message}</div>`;
    }
  }

  function renderGeneralFile(container, u, history = []) {
    const lastConsult = Array.isArray(history) && history.length ? history[0] : null;
    const noShowCount = Array.isArray(history)
      ? history.filter((item) => item?.noShow === true || /no asist/i.test(String(item?.motivoCancelacion || ''))).length
      : 0;
    const pendingFollow = Array.isArray(history)
      ? history.find((item) => item?.followUp?.required)
      : null;

    container.innerHTML = `
  <div class="p-4 fade-slide-in">
        <div class="d-flex align-items-center justify-content-between mb-4">
          <h5 class="fw-bold text-dark mb-0">
            <i class="bi bi-person-vcard text-primary me-2"></i>Ficha General
          </h5>
          <span class="badge bg-primary-subtle text-primary border">Vista General</span>
        </div>

        <div class="row g-3 mb-3">
          <div class="col-md-3 col-6">
            <div class="card border-0 shadow-sm rounded-4 h-100">
              <div class="card-body p-3">
                <div class="small text-muted">Última atención</div>
                <div class="fw-bold text-dark">${lastConsult?.safeDate ? new Date(lastConsult.safeDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin registros'}</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="card border-0 shadow-sm rounded-4 h-100">
              <div class="card-body p-3">
                <div class="small text-muted">Último diagnóstico</div>
                <div class="fw-bold text-dark text-truncate">${lastConsult ? escapeHtml(lastConsult.diagnostico || lastConsult.motivo || 'General') : 'Sin registros'}</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="card border-0 shadow-sm rounded-4 h-100">
              <div class="card-body p-3">
                <div class="small text-muted">No-show</div>
                <div class="fw-bold text-dark">${noShowCount}</div>
              </div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="card border-0 shadow-sm rounded-4 h-100">
              <div class="card-body p-3">
                <div class="small text-muted">Seguimiento</div>
                <div class="fw-bold ${pendingFollow ? 'text-warning' : 'text-success'}">${pendingFollow?.followUp?.date ? new Date(pendingFollow.followUp.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : (pendingFollow ? 'Pendiente' : 'Al corriente')}</div>
              </div>
            </div>
          </div>
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
      </div>
  `;
  }

  function renderConsultationDetail(btnEl, encodedItem) {
    // 1. UI Selection State
    const list = document.getElementById('fr-history-list');
    if (list) {
      list.querySelectorAll('.fr-history-item').forEach(el => {
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
    const signs = normalizeSigns(exp);
    exp.signos = signs;
    const doctorLabel = exp.profesionalName || exp.autorEmail || 'Autor desconocido';

    const isPsicologo = exp.tipoServicio === 'Psicologo' || exp.tipoServicio === 'Psicologico';
    const isMédico = !isPsicologo; // Assume Médico default

    // --- TEMPLATE COMPONENTS ---

    // A. Vitals (Médico Only)
    const vitalsHTML = (isMédico && (signs.temp || signs.presion || signs.peso || signs.talla)) ? `
  <div class="card border-0 shadow-sm mb-4 ">
    <div class="card-body py-3">
      <div class="row text-center g-2">
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">TEMP</small>
          <span class="fw-bold text-dark">${signs.temp || '--'}°C</span>
        </div>
        <div class="vr opacity-25"></div>
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">PRESIÓN</small>
          <span class="fw-bold text-dark">${signs.presion || '--'}</span>
        </div>
        <div class="vr opacity-25"></div>
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">PESO</small>
          <span class="fw-bold text-dark">${signs.peso || '--'}kg</span>
        </div>
        <div class="vr opacity-25"></div>
        <div class="col">
          <small class="d-block text-muted extra-small fw-bold">TALLA</small>
          <span class="fw-bold text-dark">${signs.talla || '--'}cm</span>
        </div>
      </div>
    </div>
        </div>` : '';

    // B. Psych Header (Psych Only)
    const psychHeaderHTML = isPsicologo ? `
  <div class="row g-3 mb-4">
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
        </div>
  ` : '';

    // C. Padecimiento Actual (Private - Médico Only - Middle)
    // Only visible if viewer is Médico (or Admin/Same Role)
    const showPrivateNotesMédico = isMédico && (AdminMedi.State.myRole === 'Médico');
    const padecimientoMédicoHTML = showPrivateNotesMédico ? `
  <div class="col-12 d-none" id="full-record-private-med"></div>` : '';

    // D. Private Notes (Psych Only - Bottom)
    // Only visible if viewer is Psicologo
    const showPrivateNotesPsych = isPsicologo && (AdminMedi.State.myRole === 'Psicologo');
    const notasPsychHTML = showPrivateNotesPsych ? `
  <div class="col-12 mt-2 d-none" id="full-record-private-psych"></div>` : '';


    // 3. Render Detail View
    container.innerHTML = `
  <div class="p-4 animate-in">
            <!--HEADER -->
  <div class="d-flex justify-content-between align-items-start mb-4 pb-3 border-bottom">
    <div>
      <span class="badge ${isPsicologo ? 'bg-purple-subtle text-purple' : 'bg-primary-subtle text-primary'} mb-2 border">
        ${exp.tipoServicio || 'Consulta Genérica'}
      </span>
      <h4 class="fw-bold mb-0 text-dark">Detalle de Consulta</h4>
      <small class="text-muted">${dateObj.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las ${dateObj.toLocaleTimeString()}</small>
    </div>
    <div class="text-end">
      <div class="small fw-bold text-dark">${doctorLabel}</div>
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

    _resolvePrivateConsultationNotes(exp).then((privateNotes) => {
      const medContainer = document.getElementById('full-record-private-med');
      const psychContainer = document.getElementById('full-record-private-psych');

      if (medContainer) {
        if (privateNotes) {
          medContainer.innerHTML = `
            <h6 class="fw-bold text-danger small mb-2"><i class="bi bi-lock-fill me-2"></i>Padecimiento Actual (Privado)</h6>
            <div class="bg-danger-subtle p-3 rounded-3 border border-danger-subtle text-dark" style="white-space: pre-line;">
              ${escapeHtml(privateNotes)}
            </div>`;
          medContainer.classList.remove('d-none');
        } else {
          medContainer.classList.add('d-none');
          medContainer.innerHTML = '';
        }
      }

      if (psychContainer) {
        if (privateNotes) {
          psychContainer.innerHTML = `
            <div class="p-3 bg-warning-subtle border border-warning rounded-4 dashed-border">
              <h6 class="fw-bold text-dark extra-small mb-2"><i class="bi bi-shield-lock-fill me-1"></i> NOTAS PRIVADAS (Confidencial)</h6>
              <p class="mb-0 small text-dark" style="white-space: pre-line;">${escapeHtml(privateNotes)}</p>
            </div>`;
          psychContainer.classList.remove('d-none');
        } else {
          psychContainer.classList.add('d-none');
          psychContainer.innerHTML = '';
        }
      }
    }).catch((error) => {
      console.warn('[AdminMedi] No se pudieron cargar las notas privadas del expediente:', error);
    });
  }

  function printRecetaFromDetail(encodedItem) {
    const exp = JSON.parse(decodeURIComponent(encodedItem));
    const signs = normalizeSigns(exp);
    const cachedStudent = AdminMedi.State.selectedRecordStudent;
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();

    const renderPrescription = (student) => {
      const studentAge = student?.fechaNacimiento ? MediService.calculateAge(student.fechaNacimiento) : (student?.edad || exp.edad || '');
      PDFGenerator.generateProfessionalPrescription({
        doctor: {
          name: exp.profesionalName || exp.autorEmail || AdminMedi.State.ctx.auth.currentUser.email,
          specialty: exp.profesionalSpecialty || exp.tipoServicio,
          email: exp.profesionalEmail || exp.autorEmail || AdminMedi.State.ctx.auth.currentUser.email,
          phone: exp.profesionalPhone || '',
          cedula: exp.cedula || '',
          cedulaLabel: exp.profesionalCedulaLabel || ''
        },
        student: {
          name: student?.displayName || student?.email || exp.studentName || exp.patientName || 'Paciente',
          matricula: student?.matricula || exp.studentId || '--',
          carrera: student?.carrera || '--',
          age: studentAge || '',
          allergies: student?.alergias || exp.alergias || ''
        },
        consultation: {
          date: dateObj,
          signs,
          diagnosis: exp.diagnostico,
          treatment: exp.plan || exp.meds
        }
      });
    };

    if (cachedStudent && (cachedStudent.uid === exp.studentId || cachedStudent.id === exp.studentId)) {
      renderPrescription(cachedStudent);
      return;
    }

    if (isAnonymousRecord(exp) || !exp.studentId) {
      renderPrescription({
        displayName: exp.patientName || exp.studentName || exp.studentEmail || 'Paciente Anónimo',
        matricula: exp.studentId || 'EXT',
        carrera: '--'
      });
      return;
    }

    AdminMedi.State.ctx.db.collection('usuarios').doc(exp.studentId).get().then((snap) => {
      if (!snap.exists) {
        renderPrescription({
          displayName: exp.studentName || exp.patientName || exp.studentEmail || 'Paciente',
          matricula: exp.studentId || '--',
          carrera: '--'
        });
        return;
      }
      renderPrescription({ id: snap.id, uid: snap.id, ...snap.data() });
    }).catch(() => {
      showToast("Error al obtener datos del alumno", "danger");
    });
  }

  function printReceta() {
    if (!AdminMedi.State.lastConsultaData || !window.PDFGenerator) return;

    // Obtener datos del perfil actual para el medico
    const docName = AdminMedi.State.lastConsultaData.doctorName || AdminMedi.State.ctx.profile.displayName || AdminMedi.State.ctx.auth.currentUser.email;

    window.PDFGenerator.generateReceta({
      doctor: {
        name: docName,
        specialty: AdminMedi.State.lastConsultaData.doctorSpecialty || AdminMedi.State.myRole,
        email: AdminMedi.State.lastConsultaData.doctorEmail || AdminMedi.State.ctx.auth.currentUser.email,
        phone: AdminMedi.State.lastConsultaData.doctorPhone || '',
        cedula: AdminMedi.State.lastConsultaData.cedula || '',
        cedulaLabel: AdminMedi.State.lastConsultaData.doctorCedulaLabel || ''
      },
      student: {
        name: AdminMedi.State.lastConsultaData.studentName || AdminMedi.State.lastConsultaData.studentEmail || 'Paciente',
        matricula: AdminMedi.State.lastConsultaData.studentId || '--',
        carrera: '--',
        age: AdminMedi.State.lastConsultaData.studentAge || '',
        allergies: AdminMedi.State.lastConsultaData.studentAllergies || ''
      },
      consultation: {
        date: new Date(),
        signs: normalizeSigns(AdminMedi.State.lastConsultaData),
        diagnosis: AdminMedi.State.lastConsultaData.diagnostico,
        treatment: AdminMedi.State.lastConsultaData.meds || AdminMedi.State.lastConsultaData.plan
      }
    });
  }

  function sendToPatient() {
    if (!AdminMedi.State.lastConsultaData || !window.Notify) return;
    window.Notify.send(AdminMedi.State.lastConsultaData.studentId, {
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
        name: exp.profesionalName || exp.autorEmail || 'Profesional',
        specialty: exp.profesionalSpecialty || exp.tipoServicio || 'General',
        email: exp.profesionalEmail || exp.autorEmail || AdminMedi.State.ctx.auth.currentUser.email,
        phone: exp.profesionalPhone || '',
        cedula: exp.cedula || '',
        cedulaLabel: exp.profesionalCedulaLabel || ''
      },
      student: {
        name: exp.studentName || 'Estudiante (Historial)',
        matricula: exp.studentId || '--',
        carrera: '--'
      },
      consultation: {
        date: dateObj,
        signs: normalizeSigns(exp),
        diagnosis: exp.diagnostico,
        treatment: exp.meds || exp.plan
      }
    });
  }

  async function verHistorialRapido(uid) {
    if (!uid) return;
    showFullRecord(uid);
  }

  function openMiAgendaModal() {
    const source = document.getElementById('medi-agenda-all-list') || document.getElementById('medi-agenda-list');
    const target = document.getElementById('modal-agenda-list');
    if (source && target) {
      target.innerHTML = source.innerHTML || '<div class="text-center py-5 opacity-50"><i class="bi bi-calendar-x display-4 d-block mb-2"></i><p class="fw-bold">Sin citas programadas</p></div>';
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
        const results = document.getElementById('modal-search-results');
        if (results) {
          results.innerHTML = `
      <div class="text-center py-4 text-muted small opacity-50">
         <i class="bi bi-person-lines-fill display-6 d-block mb-2"></i>
         <p>Ingresa matrícula o nombre para buscar</p>
      </div>`;
        }
        if (input) input.value = '';
        if (input) input.focus();
      }, 400);
    }
  }

  function buscarPacienteModal() {
    const input = document.getElementById('modal-search-input');
    if (!input || !input.value.trim()) return;
    // Reuse existing search logic
    if (AdminMedi && AdminMedi.Tools) {
      AdminMedi.Tools.buscarPaciente(input.value.trim());
    }
  }

  function updateCedula(val) {
    AdminMedi.State.profesionalCedula = val;
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

  function testSound() {
    if (window.Notify) window.Notify.playSound();
  }

  function searchCIE10(term) {
    const list = document.getElementById('cie10-results');
    if (!term || term.length < 2) { list.classList.add('d-none'); return; }

    const source = window.AdminMedi?.CIE10_DB || [];
    const match = source.filter(i => i.d.toLowerCase().includes(term.toLowerCase()) || i.c.toLowerCase().includes(term.toLowerCase()));

    if (match.length === 0) { list.classList.add('d-none'); return; }

    list.innerHTML = match.map(i => `
  <button type="button" class="list-group-item list-group-item-action small" onclick="AdminMedi.selectCIE10('${i.c} - ${i.d}')">
    <span class="fw-bold text-primary">${i.c}</span> ${i.d}
         </button>
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
      const isAnon = isAnonymousRecord(c);
      const name = c.patientName || c.studentEmail || 'Estudiante';
      const initial = name[0].toUpperCase();
      const signs = normalizeSigns(c);
      c.signos = signs;

      const COLORS = [['#dbeafe', '#1d4ed8'], ['#d1fae5', '#065f46'], ['#ede9fe', '#5b21b6'],
      ['#fce7f3', '#9d174d'], ['#fef3c7', '#92400e'], ['#fee2e2', '#991b1b']];
      const [bgC, fgC] = COLORS[initial.charCodeAt(0) % COLORS.length];

      const isPsico = (c.tipoServicio || '').toLowerCase().includes('psico');
      const gradientHdr = isPsico
        ? 'linear-gradient(135deg,#7c3aed,#a855f7)'
        : 'linear-gradient(135deg,#1d4ed8,#3b82f6)';

      const vitalsHtml = (signs.temp || signs.presion || signs.peso || signs.talla) ? `
  <div class="d-flex gap-2 flex-wrap mb-3">
    ${c.signos.temp ? `<div class="soap-vital-pill"><label>Temp</label><div class="fw-bold text-primary">${c.signos.temp}°C</div></div>` : ''}
          ${c.signos.presion ? `<div class="soap-vital-pill"><label>Presion</label><div class="fw-bold text-primary">${c.signos.presion}</div></div>` : ''}
          ${c.signos.peso ? `<div class="soap-vital-pill"><label>Peso</label><div class="fw-bold text-primary">${c.signos.peso}kg</div></div>` : ''}
          ${c.signos.talla ? `<div class="soap-vital-pill"><label>Talla</label><div class="fw-bold text-primary">${c.signos.talla}cm</div></div>` : ''}
        </div>` : '';

      const soapRow = (label, badgeColor, value) => value ? `
  <div class="d-flex gap-2 mb-2 align-items-start">
          <span class="badge rounded-pill text-white fw-bold flex-shrink-0 mt-1"
                style="font-size:.6rem;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:${badgeColor};">${label}</span>
          <div class="small text-dark" style="line-height:1.4;">${escapeHtml(value)}</div>
        </div>` : '';

      const html = `
  <div class="modal fade" id="${modalId}" tabindex="-1" style="z-index:1065;">
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
            ${!isAnon && c.studentId ? `
                    <button class="btn btn-primary rounded-pill fw-bold"
                            onclick="AdminMedi.showFullRecord('${c.studentId}');
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
    _switchWorkTab: _switchWorkTab,
    _switchContextTab: _switchContextTab,
    _showPatientInContext: _showPatientInContext,
    _loadPatientQuickHistory: _loadPatientQuickHistory,
    _selectWaitingPatient: _selectWaitingPatient,
    renderStructure: renderStructure,
    loadPatientSidebarWait: loadPatientSidebarWait,
    showFullRecord: showFullRecord,
    renderGeneralFile: renderGeneralFile,
    renderConsultationDetail: renderConsultationDetail,
    printRecetaFromDetail: printRecetaFromDetail,
    printReceta: printReceta,
    sendToPatient: sendToPatient,
    printRecetaFromHistory: printRecetaFromHistory,
    verHistorialRapido: verHistorialRapido,
    openMiAgendaModal: openMiAgendaModal,
    openWaitingRoomModal: openWaitingRoomModal,
    openSearchModal: openSearchModal,
    buscarPacienteModal: buscarPacienteModal,
    updateCedula: updateCedula,
    editarTarjeta: editarTarjeta,
    cancelarEdicionTarjeta: cancelarEdicionTarjeta,
    toggleSOS: toggleSOS,
    testSound: testSound,
    searchCIE10: searchCIE10,
    selectCIE10: selectCIE10,
    showConsultationQuickDetail: showConsultationQuickDetail,
  };
})();
