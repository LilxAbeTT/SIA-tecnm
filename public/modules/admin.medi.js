// modules/admin.medi.js
// Sistema Profesional de Gestión Médica (v4.0 - Admin Context)

window.AdminMedi = Object.assign(window.AdminMedi || {}, (function () {
  // --- CONSTANTES & CONFIG ---
  // --- CONSTANTES & CONFIG ---
  // Config se carga dinámicamente de Firestore via MediService
  let SLOT_START = 8, SLOT_END = 22, SLOT_STEP = 30, SLOT_DURATION = 60;





  let _ctx = null;
  let _myRole = null;
  let _myUid = null;
  let _isSaving = false;
  let _studentForBooking = null;
  let _recentUnsub = null;
  let _recentFilter = 'all';
  let _selectedRecordStudent = null;
  let _dashboardStatsInterval = null;
  let _initInFlight = null;
  let _isDashboardBooted = false;
  let _lastInitUid = null;
  let _cleanupRegisteredCtx = null;

  // --- ADMIN MEDI STATE BRIDGE ---
  if (!window.AdminMedi) window.AdminMedi = {};
  window.AdminMedi.State = {
    get ctx() { return _ctx; }, set ctx(v) { _ctx = v; },
    get myRole() { return _myRole; }, set myRole(v) { _myRole = v; },
    get myUid() { return _myUid; }, set myUid(v) { _myUid = v; },
    get isSaving() { return _isSaving; }, set isSaving(v) { _isSaving = v; },
    get unsubs() { return _unsubs; }, set unsubs(v) { _unsubs = v; },
    get lastCount() { return _lastCount; }, set lastCount(v) { _lastCount = v; },
    get lastConsultaData() { return _lastConsultaData; }, set lastConsultaData(v) { _lastConsultaData = v; },
    get currentShift() { return _currentShift; }, set currentShift(v) { _currentShift = v; },
    get currentProfile() { return _currentProfile; }, set currentProfile(v) { _currentProfile = v; },
    get profesionalCedula() { return _profesionalCedula; }, set profesionalCedula(v) { _profesionalCedula = v; },
    get consultaTimer() { return _consultaTimer; }, set consultaTimer(v) { _consultaTimer = v; },
    get consultaStartTime() { return _consultaStartTime; }, set consultaStartTime(v) { _consultaStartTime = v; },
    get consultaActive() { return _consultaActive; }, set consultaActive(v) { _consultaActive = v; },
    get waitingRoomFilter() { return _waitingRoomFilter; }, set waitingRoomFilter(v) { _waitingRoomFilter = v; },
    get chatUnsub() { return _chatUnsub; }, set chatUnsub(v) { _chatUnsub = v; },
    get activeConvId() { return _activeConvId; }, set activeConvId(v) { _activeConvId = v; },
    get foundPatient() { return _foundPatient; }, set foundPatient(v) { _foundPatient = v; },
    get chatMsgsUnsub() { return _chatMsgsUnsub; }, set chatMsgsUnsub(v) { _chatMsgsUnsub = v; },
    get chatUnreadUnsub() { return _chatUnreadUnsub; }, set chatUnreadUnsub(v) { _chatUnreadUnsub = v; },
    get slotStart() { return SLOT_START; }, set slotStart(v) { SLOT_START = v; },
    get slotEnd() { return SLOT_END; }, set slotEnd(v) { SLOT_END = v; },
    get slotStep() { return SLOT_STEP; }, set slotStep(v) { SLOT_STEP = v; },
    get slotDuration() { return SLOT_DURATION; }, set slotDuration(v) { SLOT_DURATION = v; },
    get bookingStudent() { return _studentForBooking; }, set bookingStudent(v) { _studentForBooking = v; },
    get recentUnsub() { return _recentUnsub; }, set recentUnsub(v) { _recentUnsub = v; },
    get recentFilter() { return _recentFilter; }, set recentFilter(v) { _recentFilter = v; },
    get selectedRecordStudent() { return _selectedRecordStudent; }, set selectedRecordStudent(v) { _selectedRecordStudent = v; },
    get availableProfiles() { return _availableProfiles; }, set availableProfiles(v) { _availableProfiles = v; },
    get agendaItems() { return _agendaItems; }, set agendaItems(v) { _agendaItems = v; },
    get agendaTodayItems() { return _agendaTodayItems; }, set agendaTodayItems(v) { _agendaTodayItems = v; },
    get agendaFutureItems() { return _agendaFutureItems; }, set agendaFutureItems(v) { _agendaFutureItems = v; },
    get waitingRoomItems() { return _waitingRoomItems; }, set waitingRoomItems(v) { _waitingRoomItems = v; },
    get followUpItems() { return _followUpItems; }, set followUpItems(v) { _followUpItems = v; },
    get adminChatUnsub() { return _unsubAdminChat; }, set adminChatUnsub(v) { _unsubAdminChat = v; },
    get activeAdminConvId() { return _activeAdminConvId; }, set activeAdminConvId(v) { _activeAdminConvId = v; },
    get adminMsgsUnsub() { return _unsubAdminMsgs; }, set adminMsgsUnsub(v) { _unsubAdminMsgs = v; }
  };

  function _resolveAdminRole(perfil = _ctx?.profile || {}) {
    const rawRole = String(perfil.role || '').toLowerCase();
    if (rawRole.includes('psic')) return 'Psicologo';
    if (rawRole.includes('med')) return 'Médico';

    const permMedi = String(perfil.permissions?.medi || '').toLowerCase();
    const espDoc = String(perfil.especialidad || perfil.specialty || '').toLowerCase();
    const identity = `${permMedi} ${espDoc}`;
    if (identity.includes('psic')) return 'Psicologo';
    return 'Médico';
  }

  function getOperationalContext() {
    const role = window.MediService?.normalizeServiceRole
      ? MediService.normalizeServiceRole(_myRole || _resolveAdminRole())
      : _resolveAdminRole();
    const profile = _currentProfile || null;
    const shift = window.MediService?.normalizeShiftTag
      ? MediService.normalizeShiftTag(profile?.legacyShift || _currentShift)
      : (profile?.legacyShift || _currentShift || null);
    const ownerUid = _myUid || _ctx?.user?.uid || _ctx?.auth?.currentUser?.uid || null;
    const config = _ctx?.config?.medi || {};
    const resolvedProfessional = window.MediService?.resolveProfessionalIdentity
      ? MediService.resolveProfessionalIdentity({
        ...(profile || {}),
        cedula: profile?.cedula || _profesionalCedula || ''
      }, role, shift)
      : null;
    const profileId = resolvedProfessional?.profileId || profile?.id || null;
    const professionalName = resolvedProfessional?.displayName || profile?.displayName || _ctx?.profile?.displayName || _ctx?.user?.displayName || _ctx?.auth?.currentUser?.email || 'Profesional';
    const cedula = resolvedProfessional?.cedula || profile?.cedula || _profesionalCedula || _ctx?.profile?.cedula || '';
    const specialty = resolvedProfessional?.specialty || (role === 'Psicologo' ? 'Psicologia' : 'Medico General U.A.G');
    const professionalPhone = resolvedProfessional?.phone || '';
    const professionalEmail = resolvedProfessional?.email || _ctx?.auth?.currentUser?.email || '';
    const cedulaLabel = resolvedProfessional?.cedulaLabel || (cedula ? `CP ${cedula}` : '');
    const slotDuration = window.MediService?.getSlotDurationForContext
      ? MediService.getSlotDurationForContext(config, role, shift, profileId)
      : (config['slotDuration_' + role] || config.slotDuration || SLOT_DURATION || 60);
    const disabledHours = window.MediService?.getDisabledHoursForContext
      ? MediService.getDisabledHoursForContext(config, role, shift, profileId)
      : (config[`disabledHours_${role}`] || []);
    const availabilityKey = window.MediService?.getAvailabilityKeyForContext
      ? MediService.getAvailabilityKeyForContext(role, shift)
      : (role === 'Psicologo'
        ? (shift === 'Matutino' ? 'availablePsicologoMatutino' : shift === 'Vespertino' ? 'availablePsicologoVespertino' : 'availablePsicologo')
        : 'availableMédico');
    const pauseUntil = window.MediService?.getPauseUntilForContext
      ? MediService.getPauseUntilForContext(config, role, shift, profileId)
      : null;
    const isEnabled = window.MediService?.isServiceEnabledForContext
      ? MediService.isServiceEnabledForContext(config, role, shift, profileId)
      : config?.[availabilityKey] !== false;

    return {
      role,
      ownerUid,
      profile,
      profileId,
      shift,
      professionalName,
      cedula,
      specialty,
      professionalPhone,
      professionalEmail,
      cedulaLabel,
      config,
      slotDuration,
      disabledHours,
      availabilityKey,
      pauseUntil,
      isEnabled
    };
  }

  function _applyScheduleConfig(cfg = _ctx?.config?.medi || {}) {
    const operational = getOperationalContext();
    SLOT_DURATION = operational.slotDuration || SLOT_DURATION || 60;
    SLOT_START = cfg.slotStart || 8;
    SLOT_END = cfg.slotEnd || 22;
    SLOT_STEP = cfg.slotStep || SLOT_STEP;
  }

  // Modulos mapper function
  const modMap = {};
  const categoriesMap = {
    "chat": [
      "initAdminChat",
      "startAdminChatStream",
      "openAdminConversation",
      "closeAdminConversation",
      "sendAdminMessage",
      "_renderConversationList",
      "openConversation",
      "_renderMessages",
      "sendChatMessage",
      "closeChatConversation",
      "startChatWith",
      "openMessagesModal",
      "searchAndChat",
      "startChatWithStudent"
    ],
    "agenda": [
      "loadMyAgenda",
      "validarAcompañamiento",
      "togglePrioridad",
      "tomarPaciente",
      "rechazarCita",
      "cancelarCitaAdmin",
      "buildSlotsForDate",
      "renderAdminBookingDates",
      "selectAdminDate",
      "selectAdminTime",
      "openManualBooking",
      "searchStudentForBooking",
      "confirmAdminBooking",
      "showBookingModal",
      "solicitarCancelacion",
      "prepararEdicion",
      "_reschedSelectDate"
    ],
    "consultas": [
      "iniciarConsulta",
      "renderInlineConsultationUI",
      "_startConsultaTimer",
      "_stopConsultaTimer",
      "_getConsultaDurationMinutes",
      "_cleanupConsultation",
      "saveConsultation",
      "confirmarFinalizacion",
      "cerrarSuccessModal",
      "showConsultationDetails"
    ],
    "tools": [
      "loadWall",
      "filterWaitingRoom",
      "buscarPaciente",
      "showPatientFoundModal",
      "startWalkIn",
      "loadDayMetrics",
      "loadPatientInsights",
      "_loadFollowUps",
      "showAdminConfigModal",
      "saveConfig",
      "toggleAvailability",
      "pauseScheduleFor",
      "clearQuickPause",
      "renderQuickPauseStatus",
      "renderPriorityActions",
      "setShift",
      "showShiftSetupModal",
      "updateDashboardStats",
      "startClock",
      "renderFollowUpBanner",
      "_loadRecentActivity",
      "showAllRecentModal",
      "_setRecentFilter",
      "_loadAllRecentItems"
    ],
    "ui": [
      "_switchWorkTab",
      "_switchContextTab",
      "_showPatientInContext",
      "_loadPatientQuickHistory",
      "_selectWaitingPatient",
      "renderStructure",
      "loadPatientSidebarWait",
      "showFullRecord",
      "renderGeneralFile",
      "renderConsultationDetail",
      "printRecetaFromDetail",
      "printReceta",
      "sendToPatient",
      "printRecetaFromHistory",
      "verHistorialRapido",
      "openMiAgendaModal",
      "openWaitingRoomModal",
      "openSearchModal",
      "buscarPacienteModal",
      "updateCedula",
      "editarTarjeta",
      "cancelarEdicionTarjeta",
      "toggleSOS",
      "testSound",
      "searchCIE10",
      "selectCIE10",
      "showConsultationQuickDetail"
    ]
  };

  Object.keys(categoriesMap).forEach(cat => {
    categoriesMap[cat].forEach(fn => modMap[fn] = cat);
  });
  window.AdminMedi.getModuleFor = function (fn) {
    let cat = modMap[fn];
    if (cat && window.AdminMedi[cat.charAt(0).toUpperCase() + cat.slice(1)]) {
      return window.AdminMedi[cat.charAt(0).toUpperCase() + cat.slice(1)];
    }
    console.error('Submodule not found for', fn);
    return null;
  };
  // Prevent double clicks
  let _unsubs = {};  // Named listeners: { wall, agenda, studentHistory, ... }
  function _cleanupListeners() {
    Object.values(_unsubs).forEach(fn => { if (typeof fn === 'function') fn(); });
    _unsubs = {};
  }
  function _cleanupRuntime() {
    _cleanupListeners();
    _cleanupRegisteredCtx = null;

    if (window.AdminMedi?.Chat?.cleanupChatRuntime) {
      try { window.AdminMedi.Chat.cleanupChatRuntime(); } catch (error) { console.warn('[AdminMedi] Error cleaning chat runtime:', error); }
    }

    if (_recentUnsub) {
      _recentUnsub();
      _recentUnsub = null;
    }
    if (_unsubRecent) {
      _unsubRecent();
      _unsubRecent = null;
    }
    if (_dashboardStatsInterval) {
      clearInterval(_dashboardStatsInterval);
      _dashboardStatsInterval = null;
    }
    if (_chatUnsub) {
      _chatUnsub();
      _chatUnsub = null;
    }
    if (_chatUnreadUnsub) {
      _chatUnreadUnsub();
      _chatUnreadUnsub = null;
    }
    if (_chatMsgsUnsub) {
      _chatMsgsUnsub();
      _chatMsgsUnsub = null;
    }
    if (_unsubAdminChat) {
      _unsubAdminChat();
      _unsubAdminChat = null;
    }
    if (_unsubAdminMsgs) {
      _unsubAdminMsgs();
      _unsubAdminMsgs = null;
    }
    _activeAdminConvId = null;
    _activeConvId = null;
    _agendaItems = [];
    _agendaTodayItems = [];
    _agendaFutureItems = [];
    _waitingRoomItems = [];
    _followUpItems = [];
    _isDashboardBooted = false;
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

  function _switchWorkTab(...args) { return AdminMedi.Ui['_switchWorkTab'](...args); }


  function _switchContextTab(...args) { return AdminMedi.Ui['_switchContextTab'](...args); }


  // Show patient info in Zona C
  function _showPatientInContext(...args) { return AdminMedi.Ui['_showPatientInContext'](...args); }


  function _loadPatientQuickHistory(...args) { return AdminMedi.Ui['_loadPatientQuickHistory'](...args); }


  // Select patient from waiting room → show in Zona C
  function _selectWaitingPatient(...args) { return AdminMedi.Ui['_selectWaitingPatient'](...args); }


  function buildSlotsForDate(...args) { return AdminMedi.Agenda['buildSlotsForDate'](...args); }




  // ==========================================================
  //                 STRUCTURE RENDERER (FIX)
  // ==========================================================
  function renderStructure(...args) { return AdminMedi.Ui['renderStructure'](...args); }


  // --- GESTIÓN DE CONFIGURACIÓN ---

  // [NEW] ADMIN CONFIG MODAL (Consolidated)
  function showAdminConfigModal(...args) { return AdminMedi.Tools['showAdminConfigModal'](...args); }
  function openFollowUpsModal(...args) { return AdminMedi.Tools['openFollowUpsModal'](...args); }


  // --- MANUAL BOOKING LOGIC ---

  function _openLegacyAdminBookingStatic(encodedStudent = null) {
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

  function searchStudentForBooking(...args) { return AdminMedi.Agenda['searchStudentForBooking'](...args); }


  function confirmAdminBooking(...args) { return AdminMedi.Agenda['confirmAdminBooking'](...args); }


  // --- ADMIN SLOT RENDERING ---
  function renderAdminBookingDates(...args) { return AdminMedi.Agenda['renderAdminBookingDates'](...args); }


  function selectAdminDate(...args) { return AdminMedi.Agenda['selectAdminDate'](...args); }


  function selectAdminTime(...args) { return AdminMedi.Agenda['selectAdminTime'](...args); }


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
    _myRole = window.MediService?.normalizeServiceRole
      ? MediService.normalizeServiceRole(_resolveAdminRole(perfil))
      : _resolveAdminRole(perfil);

    console.log(`[Medi] Area Identificada: ${_myRole} `);

    try {
      const cfg = await MediService.loadConfig(_ctx);

      // [FIX] Sync config to Context
      if (!_ctx.config) _ctx.config = {};
      _ctx.config.medi = cfg;

      _applyScheduleConfig(cfg);
      _syncServiceStatusBanner(cfg);

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
            _availableProfiles = profiles;
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
          _availableProfiles = await MediService.getProfiles(_ctx, _myUid);

          // Show PIN Modal
          const modalEl = document.getElementById('modalPinLogin');
          if (modalEl) {
            // Ensure instance
            let m = bootstrap.Modal.getInstance(modalEl);
            if (!m) m = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
            _renderPinProfilesHint();
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
    const operational = getOperationalContext();

    if (elName) elName.textContent = operational.professionalName;
    if (elEsp) elEsp.textContent = 'Psicología';
    _profesionalCedula = operational.cedula || _currentProfile.cedula || _profesionalCedula || '';
    if (elCed) elCed.value = _profesionalCedula;
    if (elEsp) elEsp.textContent = operational.specialty || elEsp.textContent || 'Psicologia';

    // Show shift badge
    if (shiftBadge) {
      shiftBadge.textContent = _currentProfile.legacyShift || '';
      shiftBadge.classList.remove('d-none');
    }

    if (btnShift) btnShift.classList.remove('d-none'); // Show Logout button

    _applyScheduleConfig(_ctx?.config?.medi || {});
    _syncServiceStatusBanner(_ctx?.config?.medi || {});
    _renderActiveSessionContext();
    _startAdminDashboard();
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

    startAdminChatStream();
  }

  function startAdminChatStream(...args) { return AdminMedi.Chat['startAdminChatStream'](...args); }


  function openAdminConversation(...args) { return AdminMedi.Chat['openAdminConversation'](...args); }


  function closeAdminConversation(...args) { return AdminMedi.Chat['closeAdminConversation'](...args); }


  function sendAdminMessage(...args) { return AdminMedi.Chat['sendAdminMessage'](...args); }


  // ============================================
  //   DASHBOARD MODAL OPENERS (NEW)
  // ============================================

  function openMiAgendaModal(...args) { return AdminMedi.Ui['openMiAgendaModal'](...args); }


  function openWaitingRoomModal(...args) { return AdminMedi.Ui['openWaitingRoomModal'](...args); }


  function openSearchModal(...args) { return AdminMedi.Ui['openSearchModal'](...args); }


  function buscarPacienteModal(...args) { return AdminMedi.Ui['buscarPacienteModal'](...args); }


  function openMessagesModal(...args) { return AdminMedi.Chat['openMessagesModal'](...args); }


  function searchAndChat(...args) { return AdminMedi.Chat['searchAndChat'](...args); }


  // ============================================
  //   DASHBOARD CLOCK (Biblio-style)
  // ============================================
  let _clockInterval = null;
  function startClock(...args) { return AdminMedi.Tools['startClock'](...args); }


  // ============================================
  //   DASHBOARD STATS UPDATER
  // ============================================
  function updateDashboardStats(...args) { return AdminMedi.Tools['updateDashboardStats'](...args); }

  function _isCurrentServiceEnabled(cfg = {}) {
    const operational = getOperationalContext();
    if (window.MediService?.isServiceEnabledForContext) {
      return MediService.isServiceEnabledForContext(cfg, operational.role, operational.shift, operational.profileId);
    }
    if (operational.role === 'Psicologo') {
      if (operational.shift === 'Matutino') return cfg.availablePsicologoMatutino !== false;
      if (operational.shift === 'Vespertino') return cfg.availablePsicologoVespertino !== false;
      return cfg.availablePsicologo !== false;
    }
    return cfg.availableMédico !== false;
  }

  function _syncServiceStatusBanner(cfg = _ctx?.config?.medi || {}) {
    const banner = document.getElementById('medi-service-status');
    if (!banner) return;

    const operational = getOperationalContext();
    const isEnabled = _isCurrentServiceEnabled(cfg);
    banner.classList.toggle('d-none', isEnabled);
    banner.classList.toggle('d-flex', !isEnabled);

    const titleEl = document.getElementById('medi-service-status-title');
    const textEl = document.getElementById('medi-service-status-text');
    const actionBtn = document.getElementById('medi-service-status-action');
    const pauseUntil = operational.pauseUntil;

    if (titleEl) {
      titleEl.textContent = pauseUntil ? 'Agenda pausada temporalmente' : 'Tu Agenda está deshabilitada';
    }
    if (textEl) {
      textEl.textContent = pauseUntil
        ? `Las reservas están pausadas hasta las ${pauseUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : 'Los alumnos no pueden agendar contigo en este momento.';
    }
    if (actionBtn) {
      actionBtn.textContent = pauseUntil ? 'Reanudar ahora' : 'Configurar';
      actionBtn.onclick = pauseUntil
        ? () => AdminMedi.clearQuickPause?.()
        : () => AdminMedi.showAdminConfigModal();
    }
  }

  function _renderPinProfilesHint() {
    const container = document.getElementById('medi-pin-profiles-list');
    if (!container) return;

    if (!_availableProfiles.length) {
      container.innerHTML = '<div class="small text-muted text-center">Sin perfiles configurados.</div>';
      return;
    }

    container.innerHTML = _availableProfiles.map((profile) => `
      <div class="border rounded-3 px-3 py-2 bg-light">
        <div class="fw-bold text-dark">${escapeHtml(profile.shortName || profile.displayName || 'Perfil')}</div>
        <div class="small text-muted">${escapeHtml(profile.legacyShift || 'Turno')} · ${escapeHtml(profile.cedula || 'Sin cédula')}</div>
      </div>
    `).join('');
  }

  function _renderActiveSessionContext() {
    const badge = document.getElementById('medi-active-session-context');
    if (!badge) return;

    if (_myRole !== 'Psicologo' || !_currentProfile) {
      badge.classList.add('d-none');
      badge.textContent = '';
      return;
    }

    badge.classList.remove('d-none');
    badge.textContent = `Perfil activo: ${_currentProfile.shortName || _currentProfile.displayName || 'Psicología'} · ${_currentProfile.legacyShift || 'Turno'}`;
  }

  function _startAdminDashboard() {
    _cleanupRuntime();
    startClock();
    refreshAdmin();
    setTimeout(updateDashboardStats, 2000);
    _dashboardStatsInterval = setInterval(updateDashboardStats, 15000);

    if (window.AdminMedi?.Chat?.initAdminChat) AdminMedi.Chat.initAdminChat();
    _isDashboardBooted = true;
  }


  function finishInit() {
    // Common init steps for non-profile users (Médico)
    const perfil = _ctx.profile || {};
    const elName = document.getElementById('medi-pro-name');
    const elEsp = document.getElementById('medi-pro-esp');

    // Load Cedula
    const savedCedula = localStorage.getItem('medi_cedula');
    _profesionalCedula = perfil.cedula || savedCedula || _profesionalCedula || '';
    const operational = getOperationalContext();
    _profesionalCedula = operational.cedula || _profesionalCedula || '';
    const cedInput = document.getElementById('medi-pro-cedula');
    if (cedInput) cedInput.value = _profesionalCedula;

    if (elName) elName.textContent = operational.professionalName || perfil.displayName || _ctx.user.email;
    if (elEsp) elEsp.textContent = operational.specialty || perfil.tipoServicio || 'Servicio Medico';

    _applyScheduleConfig(_ctx?.config?.medi || {});
    _syncServiceStatusBanner(_ctx?.config?.medi || {});
    _renderActiveSessionContext();
    _startAdminDashboard();

    // [NEW] Launch Admin Tutorial if needed
    setTimeout(() => {
      let tourEl = document.querySelector('admin-medi-tour');
      if (!tourEl) {
        tourEl = document.createElement('admin-medi-tour');
        document.body.appendChild(tourEl);
      }
      setTimeout(() => {
        if (typeof tourEl.shouldShow === 'function' && tourEl.shouldShow()) {
          tourEl.open();
        }
      }, 50);
    }, 1000);
  }

  // [REMOVED] First refreshAdmin definition — see canonical version below (~line 4482)

  // --- NUEVAS FUNCIONES DOCTOR VIEW ---

  // [NEW] DASHBOARD: RECENT ACTIVITY
  let _unsubRecent = null;

  async function loadRecentActivity() {
    return AdminMedi.Tools['_loadRecentActivity']();
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
  function filterWaitingRoom(...args) { return AdminMedi.Tools['filterWaitingRoom'](...args); }


  // 4. Buscar Paciente (Unified)
  let _foundPatient = null; // Store for modal actions
  let _availableProfiles = [];
  let _agendaItems = [];
  let _agendaTodayItems = [];
  let _agendaFutureItems = [];
  let _waitingRoomItems = [];
  let _followUpItems = [];

  function buscarPaciente(...args) { return AdminMedi.Tools['buscarPaciente'](...args); }


  function showPatientFoundModal(...args) { return AdminMedi.Tools['showPatientFoundModal'](...args); }


  function startWalkIn(...args) { return AdminMedi.Tools['startWalkIn'](...args); }


  // --- UI ADMIN MEJORADA ---

  function loadWall(...args) { return AdminMedi.Tools['loadWall'](...args); }


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


  function loadMyAgenda(...args) { return AdminMedi.Agenda['loadMyAgenda'](...args); }





  // --- ACCIONES ---

  // C3: Toggle priority cycle: normal -> urgente -> seguimiento -> normal
  function togglePrioridad(...args) { return AdminMedi.Agenda['togglePrioridad'](...args); }


  function tomarPaciente(...args) { return AdminMedi.Agenda['tomarPaciente'](...args); }



  function rechazarCita(...args) { return AdminMedi.Agenda['rechazarCita'](...args); }


  // Cancelación inteligente (>24h muro, <24h cancelada)
  function cancelarCitaAdmin(...args) { return AdminMedi.Agenda['cancelarCitaAdmin'](...args); }
  function registrarNoAsistencia(...args) { return AdminMedi.Agenda['registrarNoAsistencia'](...args); }



  function iniciarConsulta(...args) { return AdminMedi.Consultas['iniciarConsulta'](...args); }



  // --- B3: INLINE CONSULTATION (Zona B) ---

  function renderInlineConsultationUI(...args) { return AdminMedi.Consultas['renderInlineConsultationUI'](...args); }


  // --- CONSULTATION TIMER ---
  function _startConsultaTimer(...args) { return AdminMedi.Consultas['_startConsultaTimer'](...args); }


  function _stopConsultaTimer(...args) { return AdminMedi.Consultas['_stopConsultaTimer'](...args); }


  function _getConsultaDurationMinutes(...args) { return AdminMedi.Consultas['_getConsultaDurationMinutes'](...args); }




  // --- C4: TEMPLATES REMOVED ---


  // --- CLEANUP CONSULTATION ---
  function _cleanupConsultation(...args) { return AdminMedi.Consultas['_cleanupConsultation'](...args); }


  // --- C5: CHAT SYSTEM (Admin Side - Zona C Messages Tab) ---
  let _chatUnsub = null;
  let _chatMsgsUnsub = null;
  let _chatUnreadUnsub = null;
  let _activeConvId = null;

  function initAdminChat(...args) { return AdminMedi.Chat['initAdminChat'](...args); }


  function _renderConversationList(...args) { return AdminMedi.Chat['_renderConversationList'](...args); }


  function openConversation(...args) { return AdminMedi.Chat['openConversation'](...args); }


  function _renderMessages(...args) { return AdminMedi.Chat['_renderMessages'](...args); }


  function sendChatMessage(...args) { return AdminMedi.Chat['sendChatMessage'](...args); }


  function closeChatConversation(...args) { return AdminMedi.Chat['closeChatConversation'](...args); }


  // Start chat with a specific student (from search, waiting room, etc.)
  function startChatWith(...args) { return AdminMedi.Chat['startChatWith'](...args); }


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
  <div class="list-group-item px-0 py-2 border-bottom-0">
                    <div class="d-flex w-100 justify-content-between">
                        <strong class="text-primary" style="font-size:0.75rem;">${d.safeDate ? d.safeDate.toLocaleDateString() : 'N/D'}</strong>
                        <small class="badge  text-dark border scale-75">${d.tipoServicio?.substring(0, 3)}</small>
                    </div>
                    <p class="mb-0 text-truncate text-muted" style="font-size: 0.75rem;">${d.diagnostico || '...'}</p>
                </div>
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
  <div class="card mb-2 shadow-sm ${borderClass} card-hover-effect"
onclick="AdminMedi.showConsultationDetails('${safeExp}')"
style="cursor: pointer;">
  <div class="card-body p-2">
    <div class="d-flex justify-content-between small mb-1">
      <span class="fw-bold">${fecha}</span>
      <span class="badge  text-dark border">${exp.tipoServicio}</span>
    </div>
    <div class="small text-muted fst-italic mb-1 text-truncate">
      ${exp.diagnostico || 'Sin diagnóstico'}
    </div>
    <div class="text-end mt-1">
      <small class="text-primary fw-bold" style="font-size: 0.75rem;">Ver detalles <i class="bi bi-chevron-right"></i></small>
    </div>
  </div>
           </div>`;
      }).join('');
    } catch (e) {
      console.error("Error historial:", e);
      list.innerHTML = '<div class="alert alert-warning small p-2">Error cargando historial.</div>';
    }
  }


  function confirmarFinalizacion(...args) { return AdminMedi.Consultas['confirmarFinalizacion'](...args); }




  function saveConsultation(...args) { return AdminMedi.Consultas['saveConsultation'](...args); }


  function cerrarSuccessModal(...args) { return AdminMedi.Consultas['cerrarSuccessModal'](...args); }


  /* Legacy buscarPaciente removed (Unified in Doctor View) */




  // --- SIDEBAR HELPER (ÚLTIMA VISITA + EXPEDIENTE) ---
  function loadPatientSidebarWait(...args) { return AdminMedi.Ui['loadPatientSidebarWait'](...args); }


  // --- FULL RECORD MODAL (MASTER-DETAIL) ---
  function showFullRecord(...args) { return AdminMedi.Ui['showFullRecord'](...args); }


  // --- RENDERIZADORES INTERNOS (Nuevos Helpers) ---

  function renderGeneralFile(...args) { return AdminMedi.Ui['renderGeneralFile'](...args); }


  function renderConsultationDetail(...args) { return AdminMedi.Ui['renderConsultationDetail'](...args); }



  // --- PRINT HELPER FOR DETAIL VIEW ---
  function printRecetaFromDetail(...args) { return AdminMedi.Ui['printRecetaFromDetail'](...args); }


  // --- SHIFT LOGIC ---
  function setShift(...args) { return AdminMedi.Tools['setShift'](...args); }


  function showShiftSetupModal(...args) { return AdminMedi.Tools['showShiftSetupModal'](...args); }


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

  <div class=" rounded-4 p-3 border animate-fade-in">
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
  function verHistorialRapido(...args) { return AdminMedi.Ui['verHistorialRapido'](...args); }


  // --- MANUAL BOOKING (ADMIN) ---
  function openManualBooking(...args) { return AdminMedi.Agenda['openManualBooking'](...args); }


  function showBookingModal(...args) { return AdminMedi.Agenda['showBookingModal'](...args); }



  // --- HELPERS UI EXPORTADOS ---
  function updateCedula(...args) { return AdminMedi.Ui['updateCedula'](...args); }


  function editarTarjeta(...args) { return AdminMedi.Ui['editarTarjeta'](...args); }

  function cancelarEdicionTarjeta(...args) { return AdminMedi.Ui['cancelarEdicionTarjeta'](...args); }

  function toggleSOS(...args) { return AdminMedi.Ui['toggleSOS'](...args); }

  // --- C1: DAY METRICS DASHBOARD (Zona C default) ---
  function loadDayMetrics(...args) { return AdminMedi.Tools['loadDayMetrics'](...args); }


  // C7: Load pending follow-ups for dashboard
  function _loadFollowUps(...args) { return AdminMedi.Tools['_loadFollowUps'](...args); }


  function loadPatientInsights(...args) { return AdminMedi.Tools['loadPatientInsights'](...args); }


  function pauseScheduleFor(...args) { return AdminMedi.Tools['pauseScheduleFor'](...args); }


  function clearQuickPause(...args) { return AdminMedi.Tools['clearQuickPause'](...args); }


  function renderQuickPauseStatus(...args) { return AdminMedi.Tools['renderQuickPauseStatus'](...args); }


  function renderPriorityActions(...args) { return AdminMedi.Tools['renderPriorityActions'](...args); }


  function _reorderDashboardPanels() {
    const pauseSource = document.getElementById('medi-quick-pause-source');
    const pauseCard = document.getElementById('medi-quick-pause-card');
    const legacyPauseRow = document.getElementById('medi-row-quick-pause');

    if (legacyPauseRow) legacyPauseRow.remove();
    if (pauseSource && pauseCard && pauseCard.parentElement !== pauseSource) {
      pauseSource.appendChild(pauseCard);
    }
  }


  function refreshAdmin() {
    _reorderDashboardPanels();
    _syncServiceStatusBanner(_ctx?.config?.medi || {});
    _renderActiveSessionContext();
    loadWall();
    loadMyAgenda();
    loadRecentActivity();
    loadDayMetrics();
    loadPatientInsights();
    updateDashboardStats();
    renderQuickPauseStatus();
    renderPriorityActions();
  }

  // --- CONFIGURACIÓN ---
  function saveConfig(...args) { return AdminMedi.Tools['saveConfig'](...args); }


  function toggleAvailability(...args) { return AdminMedi.Tools['toggleAvailability'](...args); }


  function testSound(...args) { return AdminMedi.Ui['testSound'](...args); }


  // --- NUEVAS FUNCIONES WORKFLOW ---
  function printReceta(...args) { return AdminMedi.Ui['printReceta'](...args); }


  function sendToPatient(...args) { return AdminMedi.Ui['sendToPatient'](...args); }


  function printRecetaFromHistory(...args) { return AdminMedi.Ui['printRecetaFromHistory'](...args); }


  function showConsultationDetails(...args) { return AdminMedi.Consultas['showConsultationDetails'](...args); }


  function solicitarCancelacion(...args) { return AdminMedi.Agenda['solicitarCancelacion'](...args); }


  function prepararEdicion(...args) { return AdminMedi.Agenda['prepararEdicion'](...args); }


  // Reschedule helpers (called from onclick in modal)
  function _reschedSelectDate(...args) { return AdminMedi.Agenda['_reschedSelectDate'](...args); }


  function _legacyInit(ctx) {
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

  function init(ctx, options = {}) {
    if (!ctx || !ctx.profile || !ctx.user?.uid) return Promise.resolve();

    if (ctx.ModuleManager?.addSubscription && _cleanupRegisteredCtx !== ctx) {
      _cleanupRegisteredCtx = ctx;
      ctx.ModuleManager.addSubscription(() => {
        _cleanupRuntime();
        if (_cleanupRegisteredCtx === ctx) _cleanupRegisteredCtx = null;
      });
    }

    const force = !!options.force;
    if (!force && _initInFlight) return _initInFlight;
    if (!force && _isDashboardBooted && _lastInitUid === ctx.user.uid) return Promise.resolve();

    _lastInitUid = ctx.user.uid;
    _initInFlight = (async () => {
      await initAdmin(ctx);

      if (window.ModuleStateManager) {
        ModuleStateManager.restoreState('view-medi');
      }
    })().finally(() => {
      _initInFlight = null;
    }, _currentShift);

    return _initInFlight;
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
  window.AdminMedi.CIE10_DB = _CIE10_DB;

  function searchCIE10(...args) { return AdminMedi.Ui['searchCIE10'](...args); }


  function selectCIE10(...args) { return AdminMedi.Ui['selectCIE10'](...args); }




  // --- E3: FOLLOW-UP BANNER (Student) ---
  function renderFollowUpBanner(...args) { return AdminMedi.Tools['renderFollowUpBanner'](...args); }




  // [NEW] Recent Activity Renderer
  function _loadRecentActivity(...args) { return AdminMedi.Tools['_loadRecentActivity'](...args); }


  // Admin Helper
  function startChatWithStudent(...args) { return AdminMedi.Chat['startChatWithStudent'](...args); }



  // --- RECENT ACTIVITY MODALS ---

  // 1. Show All Recent (Modal with Filters)

  function showAllRecentModal(...args) { return AdminMedi.Tools['showAllRecentModal'](...args); }


  function _setRecentFilter(...args) { return AdminMedi.Tools['_setRecentFilter'](...args); }


  function _loadAllRecentItems(...args) { return AdminMedi.Tools['_loadAllRecentItems'](...args); }


  // 2. Quick Detail Modal
  // 2. Quick Detail Modal
  function showConsultationQuickDetail(...args) { return AdminMedi.Ui['showConsultationQuickDetail'](...args); }





  // --- EXPORT BRIDGE PARA HTML ONCLICK ---
  let modExports = {};
  if (window.AdminMedi && window.AdminMedi.Ui) Object.assign(modExports, window.AdminMedi.Ui);
  if (window.AdminMedi && window.AdminMedi.Agenda) Object.assign(modExports, window.AdminMedi.Agenda);
  if (window.AdminMedi && window.AdminMedi.Chat) Object.assign(modExports, window.AdminMedi.Chat);
  if (window.AdminMedi && window.AdminMedi.Consultas) Object.assign(modExports, window.AdminMedi.Consultas);
  if (window.AdminMedi && window.AdminMedi.Tools) Object.assign(modExports, window.AdminMedi.Tools);

  // Mezclar métodos al export global

  Object.assign(modExports, {
    init,
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
    openFollowUpsModal,
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
    loadPatientInsights,
    loadWall,
    validarAcompañamiento,
    loadMyAgenda,
    togglePrioridad,
    tomarPaciente,
    rechazarCita,
    cancelarCitaAdmin,
    registrarNoAsistencia,
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
    _onProfTyping: function(...args) { return AdminMedi.Chat['_onProfTyping']?.(...args); },
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
    pauseScheduleFor,
    clearQuickPause,
    renderQuickPauseStatus,
    renderPriorityActions,
  });

  // Mezclar métodos al export global mantieniendo lo que ya existe en window.AdminMedi 
  Object.assign(modExports, {
    init,
    refreshAdmin,
    getOperationalContext,
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
  });

  return Object.assign(window.AdminMedi || {}, modExports);


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
        const dateBtn = document.querySelector(`[data-date="${state.selectedValues.date}"]`);
        if (dateBtn) {
          setTimeout(() => dateBtn.click(), 100);
        }
      }

      if (timeInput && state.selectedValues.time) {
        timeInput.value = state.selectedValues.time;

        // Re-select time slot visually
        setTimeout(() => {
          const timeBtn = document.querySelector(`[data-time="${state.selectedValues.time}"]`);
          if (timeBtn) timeBtn.click();
        }, 200);
      }
    }

    // Restaurar tab activo
    if (state.activeTab) {
      const tabButton = document.querySelector(`[data-bs-target="${state.activeTab}"]`);
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

})());

console.log("[AdminMedi] Admin Module Loaded & Globalized");
