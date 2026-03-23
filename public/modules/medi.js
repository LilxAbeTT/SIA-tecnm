// modules/medi.js
// Sistema Profesional de Gestión Médica (v4.0 - Consolidado)

window.Medi = window.Medi || {};
window.Medi.Factories = window.Medi.Factories || {};

var Medi = (function () {
  // --- CONSTANTES & CONFIG ---
  // --- CONSTANTES & CONFIG ---
  // Config se carga dinámicamente de Firestore via MediService
  let SLOT_START = 8, SLOT_END = 22, SLOT_STEP = 30;





  let _ctx = null;
  let _myRole = null;
  let _myUid = null;
  let _isSaving = false; // Prevent double clicks
  const _patientCache = new Map(); // Cache patients by uid to avoid inline JSON in onclick
  let _unsubs = {};  // Named listeners: { wall, agenda, studentHistory, ... }
  function _cleanupListeners() {
    Object.values(_unsubs).forEach(fn => { if (typeof fn === 'function') fn(); });
    _unsubs = {};
  }
  let _lastCount = 0;
  let _lastConsultaData = null;
  let _activeFollowUpBannerId = null;
  let _currentBookingLock = null;
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

  function _normalizeStudentServiceType(rawType) {
    return String(rawType || '').toLowerCase().includes('psic') ? 'Psicologo' : 'M\u00e9dico';
  }

  function _getStudentServiceLabel(rawType) {
    return _normalizeStudentServiceType(rawType) === 'Psicologo' ? 'Psicolog\u00eda' : 'M\u00e9dico General';
  }

  function _getStudentServiceCategory(rawType) {
    return _normalizeStudentServiceType(rawType) === 'Psicologo' ? 'Salud Mental' : 'Medicina General';
  }

  function _getStudentServiceIconClass(rawType) {
    return _normalizeStudentServiceType(rawType) === 'Psicologo'
      ? 'bi bi-chat-heart-fill text-primary'
      : 'bi bi-bandaid-fill text-info';
  }

  function _getProfessionalDisplayName(data = {}) {
    if (data.profesionalName) return data.profesionalName;
    if (data.autorName) return data.autorName;
    if (data.displayName) return data.displayName;
    if (data.autorEmail) return String(data.autorEmail).split('@')[0];
    if (data.profesionalEmail) return String(data.profesionalEmail).split('@')[0];
    return 'Profesional de Salud';
  }

  function _buildCalendarAppointmentPayload(cita = {}) {
    const safeSlotDate = cita?.safeDate ? new Date(cita.safeDate) : safeDate(cita?.fechaHoraSlot);
    if (!safeSlotDate) return null;
    return {
      id: cita.id || `medi_${safeSlotDate.getTime()}`,
      safeDate: safeSlotDate.toISOString(),
      tipoServicio: _normalizeStudentServiceType(cita.tipoServicio || cita.tipo || 'Medico'),
      profesionalName: cita.profesionalName || cita.profName || null,
      motivo: cita.motivo || ''
    };
  }

  function _buildConsultationPrescriptionPayload(exp = {}) {
    const dateObj = exp.safeDate ? new Date(exp.safeDate) : new Date();
    const professionalEmail = exp.profesionalEmail || exp.autorEmail || '';
    const signs = exp.signos || {};
    const studentProfile = _ctx?.profile || {};
    const age = studentProfile.fechaNacimiento ? MediService.calculateAge(studentProfile.fechaNacimiento) : (studentProfile.edad || exp.edad || '');
    const allergies = studentProfile.alergias || studentProfile.healthData?.alergia || exp.alergias || '';
    return {
      doctor: {
        name: _getProfessionalDisplayName(exp) || 'Profesional de Salud',
        specialty: exp.profesionalSpecialty || _getStudentServiceLabel(exp.tipoServicio),
        email: professionalEmail,
        phone: exp.profesionalPhone || '',
        cedula: exp.cedula || '',
        cedulaLabel: exp.profesionalCedulaLabel || ''
      },
      student: {
        name: studentProfile.displayName || exp.studentName || _ctx?.user?.email || 'Paciente',
        matricula: studentProfile.matricula || exp.studentId || '--',
        carrera: studentProfile.carrera || '--',
        age: age || '',
        allergies
      },
      consultation: {
        date: dateObj,
        signs: {
          temp: exp.temp ?? signs.temp ?? null,
          presion: exp.presion ?? signs.presion ?? null,
          peso: exp.peso ?? signs.peso ?? null,
          talla: exp.talla ?? signs.talla ?? null
        },
        diagnosis: exp.diagnostico,
        treatment: exp.plan || exp.meds
      }
    };
  }

  function _downloadConsultationPrescription(encodedExp) {
    if (!window.PDFGenerator?.generateProfessionalPrescription) {
      showToast('La descarga de receta no está disponible en este momento.', 'warning');
      return;
    }

    try {
      const exp = JSON.parse(decodeURIComponent(encodedExp));
      PDFGenerator.generateProfessionalPrescription(_buildConsultationPrescriptionPayload(exp));
    } catch (error) {
      console.error('[Medi] Error generando receta desde historial:', error);
      showToast('No se pudo generar la receta.', 'danger');
    }
  }

  function _isShiftEnabledForService(cfg = {}, serviceType, shiftTag = null) {
    const normalizedType = _normalizeStudentServiceType(serviceType);
    if (normalizedType === 'Psicologo') {
      const globalEnabled = cfg.availablePsicologo !== false;
      if (!shiftTag) {
        return globalEnabled
          && (cfg.availablePsicologoMatutino !== false || cfg.availablePsicologoVespertino !== false);
      }
      const normalizedShift = String(shiftTag || '').toLowerCase().includes('vesp') ? 'Vespertino' : 'Matutino';
      const shiftEnabled = normalizedShift === 'Vespertino'
        ? cfg.availablePsicologoVespertino !== false
        : cfg.availablePsicologoMatutino !== false;
      return globalEnabled && shiftEnabled;
    }

    if (window.MediService?.isServiceEnabledForContext) {
      return MediService.isServiceEnabledForContext(cfg, normalizedType);
    }
    return cfg.availableMédico !== false && cfg.availableMedico !== false;
  }

  function _isServiceEnabledForBookingDate(cfg = {}, serviceType, targetDate = null) {
    const normalizedType = _normalizeStudentServiceType(serviceType);
    if (normalizedType !== 'Psicologo') {
      return _isShiftEnabledForService(cfg, normalizedType);
    }

    const date = safeDate(targetDate) || new Date();
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const canUseMorning = _isShiftEnabledForService(cfg, normalizedType, 'Matutino') && (!isToday || now.getHours() < 15);
    const canUseEvening = _isShiftEnabledForService(cfg, normalizedType, 'Vespertino');
    return canUseMorning || canUseEvening;
  }

  function _hasRemainingSlotsForDate(dateObj, serviceType = null, cfg = (_ctx?.config?.medi || {})) {
    const targetDate = new Date(dateObj);
    if (serviceType) {
      return _getStudentBookableSlotsForDate(targetDate, serviceType, cfg).length > 0;
    }
    return buildSlotsForDate(targetDate).length > 0;
  }

  function _buildStudentSurveyContext() {
    return {
      ..._ctx,
      profile: {
        ...(_ctx?.profile || {}),
        uid: _ctx?.profile?.uid || _ctx?.user?.uid,
        email: _ctx?.profile?.email || _ctx?.user?.email || null,
        displayName: _ctx?.profile?.displayName || _ctx?.user?.displayName || _ctx?.user?.email || 'Alumno',
        name: _ctx?.profile?.name || _ctx?.profile?.displayName || _ctx?.user?.displayName || _ctx?.user?.email || 'Alumno'
      }
    };
  }

  function _buildFollowUpDismissKey(consultaId) {
    const uid = _ctx?.user?.uid || 'anon';
    return `medi_followup_dismiss_${uid}_${consultaId}`;
  }

  function _isFollowUpDismissed(consultaId) {
    if (!consultaId) return false;
    const dismissStateStr = localStorage.getItem(_buildFollowUpDismissKey(consultaId));
    if (!dismissStateStr) return false;
    try {
      const dismissState = JSON.parse(dismissStateStr);
      if (dismissState.forever) return true;
      return !!(dismissState.until && Date.now() < dismissState.until);
    } catch (error) {
      return false;
    }
  }

  function _isBlockingStudentAppointment(cita = {}) {
    return ['confirmada', 'en_proceso'].includes(String(cita?.estado || '').toLowerCase());
  }

  function _getCurrentBlockingAppointment(citas = _lastCitasFull || []) {
    const now = new Date();
    const blocking = (Array.isArray(citas) ? citas : [])
      .filter((cita) => _isBlockingStudentAppointment(cita))
      .filter((cita) => cita.safeDate instanceof Date && !Number.isNaN(cita.safeDate.getTime()));

    if (blocking.length === 0) return null;

    const upcoming = blocking
      .filter((cita) => cita.safeDate >= now)
      .sort((a, b) => a.safeDate - b.safeDate);
    if (upcoming.length > 0) return upcoming[0];

    return blocking.sort((a, b) => b.safeDate - a.safeDate)[0] || null;
  }

  function _getStudentBookingLockBanner() {
    let banner = document.getElementById('medi-booking-lock');
    if (banner) return banner;

    const dateContainer = document.getElementById('medi-date-container');
    if (!dateContainer?.parentNode) return null;

    banner = document.createElement('div');
    banner.id = 'medi-booking-lock';
    banner.className = 'alert alert-warning border-0 shadow-sm rounded-4 mb-3 d-none';
    dateContainer.parentNode.insertBefore(banner, dateContainer);
    return banner;
  }

  function _isStudentSlotBookable(slot, serviceType, cfg = {}) {
    const normalizedType = _normalizeStudentServiceType(serviceType);
    const shiftTag = MediService.normalizeShiftTag ? MediService.normalizeShiftTag(null, slot) : (slot.getHours() < 15 ? 'Matutino' : 'Vespertino');

    if (normalizedType === 'Psicologo' && !_isShiftEnabledForService(cfg, normalizedType, shiftTag)) {
      return false;
    }

    const timeStr = `${String(slot.getHours()).padStart(2, '0')}:${String(slot.getMinutes()).padStart(2, '0')}`;
    const disabledHours = MediService.getDisabledHoursForContext
      ? MediService.getDisabledHoursForContext(cfg, normalizedType, shiftTag)
      : (cfg[`disabledHours_${normalizedType}`] || []);

    return !disabledHours.includes(timeStr);
  }

  function _getStudentBookableSlotsForDate(dateObj, serviceType, cfg = (_ctx?.config?.medi || {})) {
    const normalizedType = _normalizeStudentServiceType(serviceType);
    const targetDate = safeDate(dateObj);
    if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) return [];
    const now = new Date();

    const slotDuration = MediService.getSlotDurationForContext
      ? MediService.getSlotDurationForContext(cfg, normalizedType)
      : (cfg[`slotDuration_${normalizedType}`] || cfg.slotDuration || SLOT_DURATION || 60);

    const slots = [];
    for (let mins = (SLOT_START || 8) * 60; mins < (SLOT_END || 22) * 60; mins += slotDuration) {
      const slot = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        Math.floor(mins / 60),
        mins % 60,
        0,
        0
      );

      const isPastToday = slot.toDateString() === now.toDateString() && slot < now;
      if (!isPastToday && _isStudentSlotBookable(slot, normalizedType, cfg)) {
        slots.push(slot);
      }
    }

    return slots;
  }

  async function _refreshStudentBookingLock(forceRemote = false) {
    let blockingAppointment = _getCurrentBlockingAppointment();

    if (!blockingAppointment && forceRemote && _ctx?.user?.uid) {
      try {
        blockingAppointment = await MediService.checkActiveAppointment(_ctx, _ctx.user.uid);
      } catch (error) {
        console.warn('[Medi] No se pudo validar la cita activa del alumno:', error);
      }
    }

    _currentBookingLock = blockingAppointment || null;
    const banner = _getStudentBookingLockBanner();
    const dateContainer = document.getElementById('medi-date-container');
    const timeGrid = document.getElementById('medi-time-grid');
    const timeMsg = document.getElementById('medi-time-msg');
    const timeInput = document.getElementById('medi-cita-hora');
    const dateInput = document.getElementById('medi-cita-fecha');
    const summary = document.getElementById('medi-booking-summary');
    const confirmBtn = document.getElementById('btn-medi-confirm');

    if (_currentBookingLock && banner) {
      const cita = _currentBookingLock;
      const dateLabel = cita.safeDate
        ? cita.safeDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'fecha pendiente';
      const timeLabel = cita.safeDate
        ? cita.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      const serviceLabel = _getStudentServiceLabel(cita.tipoServicio);
      banner.innerHTML = `
        <div class="d-flex flex-column flex-md-row gap-3 align-items-start align-items-md-center justify-content-between">
          <div>
            <div class="fw-bold mb-1"><i class="bi bi-shield-lock me-2"></i>Ya tienes una cita activa</div>
            <div class="small text-dark">
              Tu ${escapeHtml(serviceLabel)} del ${escapeHtml(dateLabel)} a las ${escapeHtml(timeLabel)} sigue ${escapeHtml(cita.estado)}.
              Debes atenderla, cancelarla o reprogramarla desde <b>Mis Citas</b> antes de reservar otra.
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-outline-dark rounded-pill fw-bold" onclick="Medi._switchMediTab('medi-tab-citas')">
              <i class="bi bi-calendar-week me-1"></i>Ver mis citas
            </button>
            ${cita.profesionalId ? `<button type="button" class="btn btn-sm btn-outline-primary rounded-pill fw-bold" onclick="Medi.startChatWithProfessional('${escapeHtml(cita.profesionalId)}', '${escapeHtml(cita.profesionalName || 'Profesional de salud')}', '${escapeHtml(cita.profesionalProfileId || '')}', 'Conversación iniciada desde bloqueo de agenda')">
              <i class="bi bi-chat-dots me-1"></i>Contactar
            </button>` : ''}
          </div>
        </div>`;
      banner.classList.remove('d-none');

      if (dateContainer) dateContainer.classList.add('d-none');
      if (timeGrid) {
        timeGrid.innerHTML = '';
        timeGrid.classList.add('d-none');
      }
      if (timeMsg) {
        timeMsg.classList.remove('d-none');
        timeMsg.innerHTML = '<i class="bi bi-lock-fill fs-4 d-block mb-2"></i>La agenda está bloqueada mientras tengas una cita activa.';
      }
      if (timeInput) timeInput.value = '';
      if (dateInput) dateInput.value = '';
      if (summary) summary.classList.add('d-none');
      if (confirmBtn) confirmBtn.disabled = true;
      _updateBookingStatusPreview();
      return _currentBookingLock;
    }

    if (banner) {
      banner.classList.add('d-none');
      banner.innerHTML = '';
    }

    const categoryInput = document.getElementById('medi-cita-categoria');
    if (categoryInput?.value && dateContainer) {
      dateContainer.classList.remove('d-none');
    }

    return null;
  }

  function _findRelevantStudentAppointment(profId, profileId = null) {
    return (_lastCitasFull || [])
      .filter((cita) => ['pendiente', 'confirmada'].includes(cita.estado))
      .filter((cita) => cita.profesionalId === profId || (profileId && cita.profesionalProfileId === profileId))
      .sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0))[0] || null;
  }

  function _resolveStudentChatServiceLabel(profId, profileId = null, appointmentContext = null) {
    const contextText = String(appointmentContext || '');
    if (/psic/i.test(contextText)) return 'Psicología';
    if (/m[eé]d|medic/i.test(contextText)) return 'Médico General';
    const relatedAppointment = _findRelevantStudentAppointment(profId, profileId);
    return relatedAppointment ? _getStudentServiceLabel(relatedAppointment.tipoServicio) : 'Servicio Médico';
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const _mediScope = {};
  Object.defineProperties(_mediScope, {
    _ctx: { get: () => _ctx, set: (v) => { _ctx = v; } },
    _myRole: { get: () => _myRole, set: (v) => { _myRole = v; } },
    _myUid: { get: () => _myUid, set: (v) => { _myUid = v; } },
    _isSaving: { get: () => _isSaving, set: (v) => { _isSaving = v; } },
    _patientCache: { get: () => _patientCache },
    _unsubs: { get: () => _unsubs, set: (v) => { _unsubs = v; } },
    _lastCount: { get: () => _lastCount, set: (v) => { _lastCount = v; } },
    _lastConsultaData: { get: () => _lastConsultaData, set: (v) => { _lastConsultaData = v; } },
    _activeFollowUpBannerId: { get: () => _activeFollowUpBannerId, set: (v) => { _activeFollowUpBannerId = v; } },
    _currentBookingLock: { get: () => _currentBookingLock, set: (v) => { _currentBookingLock = v; } },
    _currentShift: { get: () => _currentShift, set: (v) => { _currentShift = v; } },
    _currentProfile: { get: () => _currentProfile, set: (v) => { _currentProfile = v; } },
    _profesionalCedula: { get: () => _profesionalCedula, set: (v) => { _profesionalCedula = v; } },
    _consultaTimer: { get: () => _consultaTimer, set: (v) => { _consultaTimer = v; } },
    _consultaStartTime: { get: () => _consultaStartTime, set: (v) => { _consultaStartTime = v; } },
    _consultaActive: { get: () => _consultaActive, set: (v) => { _consultaActive = v; } },
    _lastConsultasFull: { get: () => _lastConsultasFull, set: (v) => { _lastConsultasFull = v; } },
    _lastCitasFull: { get: () => _lastCitasFull, set: (v) => { _lastCitasFull = v; } },
    _activeStudentConvId: { get: () => _activeStudentConvId, set: (v) => { _activeStudentConvId = v; } },
    _stuMsgsUnsub: { get: () => _stuMsgsUnsub, set: (v) => { _stuMsgsUnsub = v; } },
    _stuConvUnsub: { get: () => _stuConvUnsub, set: (v) => { _stuConvUnsub = v; } },
    _activeConvData: { get: () => _activeConvData, set: (v) => { _activeConvData = v; } },
    _chatTypingTimer: { get: () => _chatTypingTimer, set: (v) => { _chatTypingTimer = v; } },
    _prevUnreadTotal: { get: () => _prevUnreadTotal, set: (v) => { _prevUnreadTotal = v; } }
  });
  Object.assign(_mediScope, {
    _cleanupListeners,
    _normalizeStudentServiceType,
    _getStudentServiceLabel,
    _getStudentServiceCategory,
    _getStudentServiceIconClass,
    _getProfessionalDisplayName,
    _buildCalendarAppointmentPayload,
    _buildConsultationPrescriptionPayload,
    _downloadConsultationPrescription,
    _isShiftEnabledForService,
    _isServiceEnabledForBookingDate,
    _hasRemainingSlotsForDate,
    _buildStudentSurveyContext,
    _buildFollowUpDismissKey,
    _isFollowUpDismissed,
    _isBlockingStudentAppointment,
    _getCurrentBlockingAppointment,
    _getStudentBookingLockBanner,
    _isStudentSlotBookable,
    _getStudentBookableSlotsForDate,
    _refreshStudentBookingLock,
    _findRelevantStudentAppointment,
    _resolveStudentChatServiceLabel,
    escapeHtml,
    pad,
    toISO,
    slotIdFromDate,
    safeDate,
    isWeekday,
    showToast,
    _switchMediTab,
    _switchContextTab,
    _selectStudentService,
    _updateChatBadgeOnTab,
    _relativeTime
  });
  const _studentExperience = window.Medi.Factories?.studentExperience
    ? window.Medi.Factories.studentExperience(_mediScope)
    : {};
  Object.assign(_mediScope, {
    _showBookingConfirmModal: (...args) => _studentExperience._showBookingConfirmModal?.(...args)
  });
  const _studentChat = window.Medi.Factories?.studentChat
    ? window.Medi.Factories.studentChat(_mediScope)
    : {};
  const _studentAppointments = window.Medi.Factories?.studentAppointments
    ? window.Medi.Factories.studentAppointments(_mediScope)
    : {};
  window.Medi.StudentExperience = _studentExperience;
  window.Medi.StudentChat = _studentChat;
  window.Medi.StudentAppointments = _studentAppointments;

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

    // Cache patient data by uid to avoid inline JSON serialization (XSS prevention)
    const patientKey = student.id || student.uid;
    if (patientKey) _patientCache.set(patientKey, student);

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
        <button class="btn btn-sm btn-primary rounded-pill fw-bold" onclick="Medi.startWalkIn('${escapeHtml(student.id || student.uid)}')">
            <i class="bi bi-lightning-charge-fill me-1"></i>Atender Ahora
        </button>
        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-dark flex-fill rounded-pill fw-bold" onclick="Medi.showFullRecord('${escapeHtml(student.id || student.uid)}')">
              <i class="bi bi-folder2-open me-1"></i>Expediente
            </button>
            <button class="btn btn-sm btn-outline-primary flex-fill rounded-pill" onclick="Medi.openManualBooking('${escapeHtml(student.id || student.uid)}')" title="Reservar Cita">
              <i class="bi bi-calendar-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary flex-fill rounded-pill" onclick="Medi.startChatWithStudent('${escapeHtml(student.id || student.uid)}', '${escapeHtml(student.displayName || student.email)}')">
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
          <span class="badge text-muted border" style="font-size:.6rem;">${escapeHtml(h.tipoServicio || '')}</span>
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
      /* === MEDI STUDENT APP — Mobile First === */
      #medi-student-app { --medi: #0d6efd; --medi-teal: #0dcaf0; --medi-purple: #6f42c1; --medi-surface: #f8fafb; --medi-text: #1e293b; }
      #medi-student-app .nav-pills .nav-link.active { background-color: var(--medi) !important; color: #fff !important; font-weight: 700; }
      #medi-student-app .nav-pills .nav-link { color: #64748b; transition: all 0.2s; font-size: 0.85rem; }
      #medi-student-app .medi-card-stripe-success { border-left: 4px solid #198754; }
      #medi-student-app .medi-card-stripe-warning { border-left: 4px solid #f59e0b; }
      #medi-student-app .medi-card-stripe-danger  { border-left: 4px solid #dc3545; }
      #medi-student-app .medi-card-stripe-info    { border-left: 4px solid var(--medi-teal); }
      #medi-student-app .medi-card-stripe-purple  { border-left: 4px solid var(--medi-purple); }
      #medi-student-app .medi-card-stripe-secondary { border-left: 4px solid #6c757d; }
      @keyframes medi-queue-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,193,7,0.4);} 50%{box-shadow:0 0 0 8px rgba(255,193,7,0);} }
      .medi-queue-live { animation: medi-queue-pulse 2s ease-in-out infinite; }
      #medi-student-app .medi-quick-card { transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; }
      #medi-student-app .medi-quick-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important; }
      #medi-citas-tabs .nav-link { color: #6c757d; border-bottom: 3px solid transparent; border-radius: 0; transition: all 0.2s ease; }
      #medi-citas-tabs .nav-link:hover { color: #0d6efd; background: rgba(13,202,240,0.05); }
      #medi-citas-tabs .nav-link.active { color: #0d6efd !important; border-bottom-color: #0d6efd; background: transparent !important; }
      @media (max-width: 768px) {
        #medi-student-app .medi-hero { padding: 1.25rem !important; }
        #medi-student-app .medi-hero h2 { font-size: 1.3rem; }
        #medi-student-app .medi-hero-icon { display: none !important; }
        #medi-student-app .nav-pills .nav-link { font-size: 0.72rem; padding: 0.35rem 0.5rem; }
      }
      /* Chat float button pulse (new message notification) */
      @keyframes medi-chat-btn-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,0.45);} 60%{box-shadow:0 0 0 10px rgba(37,211,102,0);} }
      .medi-chat-pulse { animation: medi-chat-btn-pulse 1.4s ease-in-out infinite !important; }
      /* Typing indicator dots */
      @keyframes stu-typing-bounce { 0%,80%,100%{transform:translateY(0);} 40%{transform:translateY(-5px);} }
      .stu-typing-dot { display:inline-block; width:5px; height:5px; border-radius:50%; background:#6c757d; margin:0 1px; animation:stu-typing-bounce 1.2s ease-in-out infinite; }
      .stu-typing-dot:nth-child(2){animation-delay:.15s;}
      .stu-typing-dot:nth-child(3){animation-delay:.3s;}
      /* Chat empty state with CTA */
      .medi-empty-state { padding: 2rem 1rem; text-align: center; }
      .medi-empty-state .medi-empty-icon { font-size: 2.5rem; opacity: 0.25; display: block; margin-bottom: .75rem; }
      /* Check-in de bienestar */
      .medi-checkin-opt { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; border-radius: 12px; padding: 0.5rem; }
      .medi-checkin-opt:hover, .medi-checkin-opt.selected { transform: scale(1.18); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
      .medi-checkin-bar { height: 28px; border-radius: 6px; background: linear-gradient(90deg,#0d6efd,#0dcaf0); min-width: 4px; transition: width 0.4s; display: flex; align-items: center; justify-content: center; font-size: 0.55rem; color: #fff; font-weight: 700; }
      /* Disponibilidad servicio */
      @keyframes medi-avail-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
      .medi-avail-dot { width:10px; height:10px; border-radius:50%; display:inline-block; flex-shrink:0; }
      .medi-avail-dot.open { background:#198754; animation:medi-avail-pulse 2s ease-in-out infinite; }
      .medi-avail-dot.closing { background:#f59e0b; animation:medi-avail-pulse 1s ease-in-out infinite; }
      .medi-avail-dot.closed { background:#dc3545; }
      /* SOS btn */
      #medi-sos-btn { transition: transform 0.2s, box-shadow 0.2s; }
      #medi-sos-btn:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(220,53,69,0.4) !important; }
      @keyframes medi-sos-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,53,69,0.5);} 60%{box-shadow:0 0 0 12px rgba(220,53,69,0);} }
      .medi-sos-pulse { animation: medi-sos-pulse 2s ease-in-out infinite; }
      body.medi-student-floating-stack #btn-report-problem,
      body.medi-student-floating-stack #medi-sos-btn button,
      body.medi-student-floating-stack #medi-chat-float-btn button {
        transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
      }
      body.medi-student-floating-stack #btn-report-problem:hover,
      body.medi-student-floating-stack #medi-sos-btn button:hover,
      body.medi-student-floating-stack #medi-chat-float-btn button:hover {
        transform: scale(1.08);
      }
      body.medi-student-floating-stack #btn-report-problem {
        background: #f97316 !important;
        border-color: #f97316 !important;
        color: #fff !important;
      }
      body.medi-student-floating-stack #medi-sos-btn button {
        background: #dc2626 !important;
        border-color: #dc2626 !important;
        color: #fff !important;
      }
      body.medi-student-floating-stack #medi-chat-float-btn button {
        background: #25d366 !important;
        border-color: #25d366 !important;
        color: #fff !important;
      }
      @media (max-width: 767.98px) {
        body.medi-student-floating-stack #btn-report-problem,
        body.medi-student-floating-stack #medi-sos-btn,
        body.medi-student-floating-stack #medi-chat-float-btn {
          left: auto !important;
          right: 14px !important;
          z-index: 2000 !important;
        }
        body.medi-student-floating-stack #btn-report-problem,
        body.medi-student-floating-stack #medi-sos-btn button,
        body.medi-student-floating-stack #medi-chat-float-btn button {
          width: 46px !important;
          height: 46px !important;
          border-radius: 50% !important;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18) !important;
        }
        body.medi-student-floating-stack #btn-report-problem {
          bottom: 90px !important;
          font-size: 1rem !important;
        }
        body.medi-student-floating-stack #medi-chat-float-btn { bottom: 148px !important; }
        body.medi-student-floating-stack #medi-sos-btn { bottom: 206px !important; }
        body.medi-student-floating-stack #btn-report-problem i,
        body.medi-student-floating-stack #medi-sos-btn button i,
        body.medi-student-floating-stack #medi-chat-float-btn button i {
          font-size: 1.1rem !important;
        }
        body.medi-student-floating-stack #stu-chat-badge {
          font-size: 0.52rem !important;
          padding: 0.2em 0.38em !important;
        }
      }
      /* Slot progress bar */
      .medi-slot-bar { height: 4px; border-radius: 2px; background: #e9ecef; overflow: hidden; margin-top: 3px; }
      .medi-slot-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
      /* Timeline historial */
      .medi-timeline { padding-left: 1.25rem; position: relative; }
      .medi-timeline-item { position: relative; padding-bottom: 0.75rem; }
      .medi-timeline-item::before { content:''; position:absolute; left:-1.25rem; top:6px; width:10px; height:10px; border-radius:50%; background:var(--medi); border:2px solid #fff; box-shadow:0 0 0 2px var(--medi); }
      .medi-timeline-item::after { content:''; position:absolute; left:calc(-1.25rem + 4px); top:16px; width:2px; bottom:0; background:rgba(13,110,253,0.15); }
      .medi-timeline-item:last-child::after { display:none; }
      .medi-timeline-item.psico::before { background:var(--medi-purple); box-shadow:0 0 0 2px var(--medi-purple); }
      /* Stars survey */
      .medi-star { font-size:1.6rem; cursor:pointer; color:#dee2e6; transition:color 0.12s; }
      .medi-star.lit { color:#f59e0b; }
      /* Stat mini cards */
      .medi-stat-mini { border-radius:14px; padding:0.6rem 0.75rem; }
      .medi-slot-legend-item { border: 1px solid rgba(15,23,42,0.08); background:#fff; }
      .medi-doc-card { border: 1px solid rgba(15,23,42,0.08); background:linear-gradient(180deg,#ffffff 0%, #f8fbff 100%); }
      .medi-doc-card .doc-snippet { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .medi-doc-card .doc-meta { font-size:.7rem; color:#6c757d; }
      .medi-tab-label { display:inline-block; min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; vertical-align:bottom; }
      .medi-next-appt-actions { display:flex; flex-wrap:wrap; gap:.5rem; }
      .medi-next-appt-actions .btn { min-width:0; }
      .medi-checkin-summary-card { border:1px solid rgba(15,23,42,0.08); border-radius:14px; background:#fff; padding:.7rem .8rem; }
      .medi-checkin-history-list { max-height:190px; overflow:auto; }
      .medi-checkin-entry { border:1px solid rgba(15,23,42,0.08); border-radius:12px; background:#fff; }
      .medi-chat-card { border:1px solid rgba(15,23,42,0.08); background:linear-gradient(180deg,#ffffff 0%, #f8fbff 100%); }
      .medi-chat-chip { display:inline-flex; align-items:center; gap:.3rem; border-radius:999px; padding:.16rem .5rem; font-size:.62rem; font-weight:700; background:rgba(13,110,253,0.08); color:#0d6efd; }
      .medi-chat-thread-intro { border:1px solid rgba(13,110,253,0.12); background:linear-gradient(135deg, rgba(13,110,253,0.08), rgba(13,202,240,0.08)); }
      /* FAQ */
      #medi-faq-section .accordion-button { font-size:0.82rem; }
      #medi-faq-section .accordion-button:not(.collapsed) { color:var(--medi); background:rgba(13,110,253,0.04); box-shadow:none; }
      #medi-faq-section .accordion-button:focus { box-shadow:none; }
      /* Wellness tips modal categories */
      .medi-tip-cat-btn.active { background:var(--medi) !important; color:#fff !important; }
      @media (max-width: 767.98px) {
        #medi-student-tabs { overflow:visible; flex-wrap:nowrap !important; gap:.15rem; }
        #medi-student-tabs .nav-item { flex:1 1 0 !important; min-width:0; }
        #medi-student-tabs .nav-link {
          white-space:nowrap;
          padding:.58rem .35rem;
          font-size:.74rem;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:.25rem;
        }
        #medi-student-tabs .nav-link i { margin:0 !important; font-size:.95rem; }
        #medi-quick-actions .col-4 { width:50%; }
        #medi-booking-actions { flex-direction:column; align-items:stretch !important; gap:.75rem; }
        #medi-booking-actions #btn-medi-confirm { width:100%; }
        #medi-next-appointment .medi-next-appt { gap:.75rem !important; }
        #medi-next-appointment .medi-next-appt-actions { width:100%; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        #medi-next-appointment .medi-next-appt-actions .btn { width:100%; padding-inline:.55rem; font-size:.78rem; }
        #medi-checkin-widget .medi-checkin-options { display:flex; flex-wrap:wrap; gap:.5rem; }
        #medi-checkin-widget .medi-checkin-opt { flex:1 1 calc(33.333% - .5rem); }
      }
      @media (max-width: 420px) {
        #medi-student-tabs .nav-link { font-size:.68rem; padding:.52rem .2rem; gap:.2rem; }
        #medi-student-tabs .nav-link i { font-size:.88rem; }
        #medi-student-chat-panel {
          left:12px !important;
          right:12px !important;
          width:auto !important;
          max-width:none !important;
          bottom:84px !important;
          height:min(72vh, 560px) !important;
        }
      }
    </style>
    <section id="medi-student" class="d-none">
      <div id="medi-student-app">

        <!-- HERO BANNER -->
        <div id="medi-hero" class="medi-hero shadow-sm mb-3" style="background: linear-gradient(135deg, #1B396A 0%, #0d6efd 60%, #0dcaf0 100%); border-radius: 1rem; padding: 1.5rem; position: relative; overflow: hidden;">
          <div class="position-relative z-1">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge bg-white text-dark mb-2 fw-bold shadow-sm" style="font-size: 0.7rem; color: #0d6efd !important;">
                <i class="bi bi-heart-pulse-fill me-1"></i>Servicio Médico ITES
              </span>
              <button class="btn btn-sm bg-opacity-25 text-white border-0 rounded-pill px-3" id="medi-tutorial-btn" onclick="Medi.launchMediTutorial()" title="Ver tutorial">
                <i class="bi bi-play-circle me-1"></i>Tutorial
              </button>
            </div>
            <h2 class="fw-bold mb-1 text-white filter-white" id="medi-hero-greeting" style="font-size: 1.5rem;">Servicio Médico</h2>
            <p class="small mb-2 text-white" id="medi-hero-subtitle" style="max-width: 70%; opacity: 0.85;">Tu salud es lo más importante.</p>
            <div id="medi-hero-next-badge" class="d-none"></div>
          </div>
          <i class="bi bi-heart-pulse-fill medi-hero-icon position-absolute end-0 top-50 translate-middle-y me-3 text-white" style="font-size: 6rem; opacity: 0.08;"></i>
        </div>

        <!-- EMERGENCY COMPACT CHIP — Carnet Médico -->
        <div id="medi-emergency-chip" class="rounded-4 mb-3 overflow-hidden shadow-sm" style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 60%, #ef4444 100%); color: white;">
          <div class="px-3 pt-2 pb-1 d-flex align-items-center justify-content-between" style="background:rgba(0,0,0,0.15);">
            <span class="fw-bold" style="font-size:0.6rem; letter-spacing:2px; opacity:0.85;">CARNET MÉDICO DE EMERGENCIA</span>
            <button type="button" class="btn btn-sm btn-link text-white p-0 opacity-75"
                    style="font-size: 0.65rem;"
                    data-bs-toggle="modal" data-bs-target="#modalMediEditCard">
              <i class="bi bi-pencil-fill me-1"></i>Editar
            </button>
          </div>
          <div class="p-3 pt-1">
            <div class="d-flex align-items-center gap-3 overflow-hidden">
              <!-- Tipo de sangre prominente -->
              <div class="text-center flex-shrink-0">
                <div class="fw-black text-white" style="font-size:1.8rem; line-height:1; font-weight:900;" id="view-sangre">--</div>
                <div style="font-size:0.55rem; opacity:0.75; letter-spacing:1px;">SANGRE</div>
              </div>
              <div class="vr opacity-25" style="height:36px;"></div>
              <!-- Alergias con alerta visual -->
              <div class="flex-grow-1 text-truncate">
                <div style="font-size:0.58rem; letter-spacing:0.5px; opacity:0.8;" class="fw-bold">⚠ ALERGIAS</div>
                <div class="fw-bold text-truncate" id="view-alergias" style="font-size:0.75rem;">Ninguna</div>
                <div id="view-condiciones" class="text-truncate" style="font-size:0.65rem; opacity:0.8;"></div>
              </div>
              <div class="vr opacity-25 d-none d-sm-block" style="height:36px;"></div>
              <!-- Contacto de emergencia -->
              <div class="text-truncate d-none d-sm-block" style="min-width:0; max-width:130px;">
                <div style="font-size:0.58rem; letter-spacing:0.5px; opacity:0.8;" class="fw-bold">CONTACTO SOS</div>
                <div class="fw-bold text-truncate" id="view-contacto-nombre" style="font-size:0.75rem;">--</div>
                <span class="font-monospace d-none" id="view-contacto-tel" style="font-size:0.65rem;opacity:0.8;">--</span>
              </div>
            </div>
            <!-- Advertencia crítica de alergias -->
            <div id="view-alergia-warning" class="d-none mt-2 rounded-2 px-2 py-1 d-flex align-items-center gap-1" style="background:rgba(0,0,0,0.25); font-size:0.65rem;">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              <span>Advertencia: paciente con alergias registradas</span>
            </div>
          </div>
        </div>

        <!-- NAV PILLS (4 tabs) -->
        <ul class="nav nav-pills nav-fill p-1 rounded-pill shadow-sm mb-4" id="medi-student-tabs" role="tablist" style="background: var(--medi-surface);">
          <li class="nav-item" role="presentation">
            <button class="nav-link active rounded-pill" data-bs-toggle="pill" data-bs-target="#medi-tab-inicio" type="button" role="tab">
              <i class="bi bi-house"></i><span class="medi-tab-label">Inicio</span>
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#medi-tab-agendar" type="button" role="tab">
              <i class="bi bi-calendar-plus"></i><span class="medi-tab-label">Agendar</span>
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#medi-tab-citas" type="button" role="tab">
              <i class="bi bi-calendar-week"></i><span class="medi-tab-label">Citas</span>
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#medi-tab-historial" type="button" role="tab">
              <i class="bi bi-clock-history"></i><span class="medi-tab-label">Historial</span>
            </button>
          </li>
        </ul>

        <!-- TAB CONTENT -->
        <div class="tab-content">

          <!-- TAB 1: INICIO -->
          <div class="tab-pane fade show active" id="medi-tab-inicio" role="tabpanel">
            <!-- Encuesta post-consulta -->
            <div id="medi-postconsult-survey" class="d-none mb-3"></div>
            <!-- Follow-up Banner -->
            <div id="medi-followup-banner" class="d-none mb-3"></div>
            <!-- Next Appointment -->
            <div id="medi-next-appointment" class="d-none mb-3"></div>
            <!-- Queue Card -->
            <div id="medi-queue-card" class="d-none mb-3"></div>
            <!-- Quick Actions -->
            <div id="medi-quick-actions" class="row g-2 mb-3"></div>
            <!-- Disponibilidad del servicio -->
            <div id="medi-availability-card" class="mb-3"></div>
            <!-- Check-in de bienestar diario -->
            <div id="medi-checkin-widget" class="mb-3"></div>
            <!-- Wellness Tips -->
            <div class="card border-0 shadow-sm rounded-4 mb-3">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="fw-bold mb-0 small" style="color: var(--medi);">
                    <i class="bi bi-lightbulb me-2 text-warning"></i>Tips de Salud
                  </h6>
                  <button class="btn btn-outline-primary rounded-pill px-2 py-0" style="font-size:.7rem;" onclick="Medi._openWellnessTipsModal()">
                    Ver todos <i class="bi bi-chevron-right ms-1"></i>
                  </button>
                </div>
                <div id="medi-wellness-tips">
                  <div class="text-center py-3 text-muted small">Cargando tips...</div>
                </div>
              </div>
            </div>
            <!-- FAQ Preguntas Frecuentes -->
            <div class="card border-0 shadow-sm rounded-4 mb-3" id="medi-faq-section">
              <div class="card-body p-3">
                <h6 class="fw-bold mb-3 small text-muted">
                  <i class="bi bi-question-circle me-2"></i>Preguntas Frecuentes
                </h6>
                <div class="accordion accordion-flush" id="mediAccordionFAQ">
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq1"><i class="bi bi-heart me-2 text-danger"></i>¿Médico General o Psicología?</button></h2>
                    <div id="faq1" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">Elige <strong>Médico General</strong> para dolores físicos, fiebre, malestares o lesiones. Elige <strong>Psicología</strong> para estrés, ansiedad, problemas emocionales o académicos. Si no estás seguro/a, el médico puede orientarte.</div></div>
                  </div>
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq2"><i class="bi bi-lock me-2 text-primary"></i>¿Son confidenciales mis consultas?</button></h2>
                    <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">Sí. Toda tu información médica es <strong>estrictamente confidencial</strong>. Solo el profesional de salud que te atiende tiene acceso a tu expediente, de acuerdo a la NOM-024-SSA3-2012.</div></div>
                  </div>
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq3"><i class="bi bi-calendar-x me-2 text-warning"></i>¿Puedo cancelar mi cita?</button></h2>
                    <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">Sí, puedes cancelar desde la pestaña <strong>Citas</strong>. Por favor hazlo con al menos 1 hora de anticipación para liberar el espacio a otro estudiante que lo necesite.</div></div>
                  </div>
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq4"><i class="bi bi-bag me-2 text-success"></i>¿Qué llevar a mi cita?</button></h2>
                    <div id="faq4" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">Lleva tu <strong>credencial del ITES</strong>. Si tienes medicamentos actuales o estudios previos, tráelos también. Para psicología no necesitas preparar nada especial.</div></div>
                  </div>
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq5"><i class="bi bi-clock me-2 text-info"></i>¿Cuánto dura una consulta?</button></h2>
                    <div id="faq5" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3"><strong>Médico General:</strong> ~20-30 min. <strong>Psicología:</strong> 45-60 min por sesión.</div></div>
                  </div>
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq6"><i class="bi bi-hourglass me-2 text-warning"></i>¿Cuánto tarda en confirmarse mi cita?</button></h2>
                    <div id="faq6" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">Si eres el primero en ese horario, se confirma <strong>automáticamente</strong>. Si hay alguien más, entras a cola y el profesional confirma en orden de llegada.</div></div>
                  </div>
                  <div class="accordion-item border-bottom border-0 border-light">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq7"><i class="bi bi-chat-dots me-2 text-primary"></i>¿Puedo chatear con mi médico?</button></h2>
                    <div id="faq7" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">Sí. En la pestaña <strong>Citas</strong>, toca "Chatear" en tu cita confirmada. También está disponible en el botón <i class="bi bi-chat-dots-fill text-primary"></i> de acciones rápidas.</div></div>
                  </div>
                  <div class="accordion-item border-0">
                    <h2 class="accordion-header"><button class="accordion-button collapsed py-2 px-0 bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq8"><i class="bi bi-people me-2 text-secondary"></i>¿Quiénes me pueden atender?</button></h2>
                    <div id="faq8" class="accordion-collapse collapse" data-bs-parent="#mediAccordionFAQ"><div class="accordion-body small text-muted px-0 pt-1 pb-3">El ITES cuenta con <strong>médico general</strong> y <strong>psicólogos</strong> (turno matutino y vespertino). El sistema asigna al profesional disponible según el horario que elijas.</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: AGENDAR -->
          <div class="tab-pane fade" id="medi-tab-agendar" role="tabpanel">
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-body p-4">
                <!-- Success State -->
                <div id="medi-booking-success" class="d-none text-center py-4 medi-booking-success">
                  <div class="bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style="width: 72px; height: 72px;">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 2.5rem;"></i>
                  </div>
                  <h5 class="fw-bold text-dark mb-2">Cita registrada</h5>
                  <div id="medi-success-details" class="mb-3"></div>
                  <button class="btn btn-outline-primary rounded-pill px-4 fw-bold mt-2" onclick="Medi._switchMediTab('medi-tab-citas')">
                    <i class="bi bi-calendar-week me-1"></i>Ver mis citas
                  </button>
                </div>
                <form id="form-medi-nueva-cita">
                  <div class="row g-3">
                    <div class="col-12" id="medi-service-container">
                      <label class="form-label small fw-bold text-muted mb-2">Tipo de servicio</label>
                      <div class="d-flex flex-column flex-sm-row gap-3 medi-service-btns">
                        <button type="button" class="btn btn-outline-light flex-fill p-3 border rounded-4 text-start position-relative overflow-hidden service-btn shadow-sm"
                            style="border-color: rgba(255,255,255,0.1);"
                            data-service-type="M\u00e9dico"
                            onclick="Medi._selectStudentService('M\u00e9dico', this)">
                            <div class="d-flex align-items-center">
                              <div class="bg-white rounded-circle p-2 shadow-sm me-3 text-info"><i class="bi bi-bandaid-fill fs-4"></i></div>
                              <div>
                                <h6 class="fw-bold text-body mb-0">Médico General</h6>
                                <span class="extra-small text-muted">Malestar, chequeo, salud física</span>
                              </div>
                            </div>
                        </button>
                        <button type="button" class="btn btn-outline-light flex-fill p-3 border rounded-4 text-start position-relative overflow-hidden service-btn shadow-sm"
                            style="border-color: rgba(255,255,255,0.1);"
                            data-service-type="Psicologo"
                            onclick="Medi._selectStudentService('Psicologo', this)">
                            <div class="d-flex align-items-center">
                              <div class="bg-white rounded-circle p-2 shadow-sm me-3 text-primary"><i class="bi bi-chat-heart-fill fs-4"></i></div>
                              <div>
                                <h6 class="fw-bold text-body mb-0">Psicología</h6>
                                <span class="extra-small text-muted">Apoyo emocional, estrés</span>
                              </div>
                            </div>
                        </button>
                      </div>
                      <input type="hidden" id="medi-cita-categoria" required>
                      <input type="hidden" id="medi-cita-tipo" value="M\u00e9dico">
                    </div>
                    <div class="col-12 mt-4 d-none" id="medi-date-container">
                      <label class="form-label small fw-bold text-muted mb-3">Selecciona el día</label>
                      <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-light btn-sm rounded-circle flex-shrink-0 d-none d-md-flex align-items-center justify-content-center" style="width:32px;height:32px;" onclick="(function(){const el=document.getElementById('medi-date-selector');el.scrollBy({left:-180,behavior:'smooth'})})()"><i class="bi bi-chevron-left" style="font-size:.7rem;"></i></button>
                        <div id="medi-date-selector" class="d-flex gap-2 overflow-auto pb-2 flex-grow-1" style="scrollbar-width: thin; scrollbar-color: #dee2e6 transparent;"></div>
                        <button type="button" class="btn btn-light btn-sm rounded-circle flex-shrink-0 d-none d-md-flex align-items-center justify-content-center" style="width:32px;height:32px;" onclick="(function(){const el=document.getElementById('medi-date-selector');el.scrollBy({left:180,behavior:'smooth'})})()"><i class="bi bi-chevron-right" style="font-size:.7rem;"></i></button>
                      </div>
                      <input type="hidden" id="medi-cita-fecha" required>
                      <div class="mt-2" id="medi-time-container">
                        <label class="form-label small fw-bold text-muted">Horarios disponibles</label>
                        <div id="medi-time-msg" class="p-4  rounded-4 text-center text-muted small border border-dashed">
                          <i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero
                        </div>
                        <input type="hidden" id="medi-cita-hora" required>
                        <div id="medi-time-grid" class="d-none gap-2 flex-wrap mt-2" style="max-height: 260px; overflow-y: auto; scrollbar-width: thin;"></div>
                        <div class="row g-2 mt-2" id="medi-slot-legend">
                          <div class="col-6 col-lg-3">
                            <div class="medi-slot-legend-item rounded-3 px-2 py-2 h-100 d-flex align-items-center gap-2">
                              <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Libre</span>
                              <span class="small text-muted">Confirmación inmediata</span>
                            </div>
                          </div>
                          <div class="col-6 col-lg-3">
                            <div class="medi-slot-legend-item rounded-3 px-2 py-2 h-100 d-flex align-items-center gap-2">
                              <span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill">Cola</span>
                              <span class="small text-muted">Hay alguien antes</span>
                            </div>
                          </div>
                          <div class="col-6 col-lg-3">
                            <div class="medi-slot-legend-item rounded-3 px-2 py-2 h-100 d-flex align-items-center gap-2">
                              <span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">Lleno</span>
                              <span class="small text-muted">Sin espacio disponible</span>
                            </div>
                          </div>
                          <div class="col-6 col-lg-3">
                            <div class="medi-slot-legend-item rounded-3 px-2 py-2 h-100 d-flex align-items-center gap-2">
                              <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill">Turno</span>
                              <span class="small text-muted">Horario no habilitado</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="col-12 mt-3" id="medi-motivo-container">
                      <label class="form-label small fw-bold text-muted mb-2"><i class="bi bi-chat-left-text me-1 text-primary"></i>¿Cómo te sientes? <span class="fw-normal text-muted">(Opcional)</span></label>
                      <div class="rounded-3 border p-2" style="background:#f8f9ff;">
                        <textarea class="form-control border-0 bg-transparent" id="medi-cita-motivo" rows="2" placeholder="Describe brevemente tus síntomas o motivo de consulta..." style="resize:none; font-size:0.85rem;"></textarea>
                        <div class="d-flex flex-wrap gap-1 mt-2 pt-1 border-top">
                          <span class="badge rounded-pill text-muted fw-normal border" style="background:#fff;cursor:pointer;font-size:.7rem;" onclick="(function(){var t=document.getElementById('medi-cita-motivo');t.value=(t.value?t.value+' ':'')+'Dolor de cabeza';t.focus()})()">🤕 Dolor de cabeza</span>
                          <span class="badge rounded-pill text-muted fw-normal border" style="background:#fff;cursor:pointer;font-size:.7rem;" onclick="(function(){var t=document.getElementById('medi-cita-motivo');t.value=(t.value?t.value+' ':'')+'Fiebre';t.focus()})()">🌡️ Fiebre</span>
                          <span class="badge rounded-pill text-muted fw-normal border" style="background:#fff;cursor:pointer;font-size:.7rem;" onclick="(function(){var t=document.getElementById('medi-cita-motivo');t.value=(t.value?t.value+' ':'')+'Tos o gripa';t.focus()})()">🤧 Tos/Gripa</span>
                          <span class="badge rounded-pill text-muted fw-normal border" style="background:#fff;cursor:pointer;font-size:.7rem;" onclick="(function(){var t=document.getElementById('medi-cita-motivo');t.value=(t.value?t.value+' ':'')+'Dolor de estómago';t.focus()})()">🤢 Estómago</span>
                          <span class="badge rounded-pill text-muted fw-normal border" style="background:#fff;cursor:pointer;font-size:.7rem;" onclick="(function(){var t=document.getElementById('medi-cita-motivo');t.value=(t.value?t.value+' ':'')+'Estrés o ansiedad';t.focus()})()">😰 Estrés</span>
                          <span class="badge rounded-pill text-muted fw-normal border" style="background:#fff;cursor:pointer;font-size:.7rem;" onclick="(function(){var t=document.getElementById('medi-cita-motivo');t.value=(t.value?t.value+' ':'')+'Revisión general';t.focus()})()">🩺 Revisión general</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div id="medi-booking-summary" class="mt-4 d-none slide-up-anim rounded-4 overflow-hidden shadow-sm border">
                    <div class="px-3 py-2 d-flex align-items-center gap-2" style="background:linear-gradient(135deg,#1B396A,#0d6efd);color:white;">
                      <i class="bi bi-clipboard2-check-fill"></i>
                      <span class="fw-bold small">Resumen de tu cita</span>
                    </div>
                    <div class="p-3 bg-white">
                      <div class="d-flex align-items-center gap-3 mb-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:36px;height:36px;background:#e8f0fe;">
                          <i id="summary-service-icon" class="bi bi-bandaid-fill text-primary"></i>
                        </div>
                        <div>
                          <div class="extra-small text-muted">Servicio</div>
                          <div class="fw-bold small text-dark" id="summary-service">--</div>
                        </div>
                      </div>
                      <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:36px;height:36px;background:#e8f0fe;">
                          <i class="bi bi-calendar-check-fill text-primary"></i>
                        </div>
                        <div>
                          <div class="extra-small text-muted">Fecha y hora</div>
                          <div class="fw-bold small text-dark" id="summary-datetime">--</div>
                        </div>
                      </div>
                      <div class="mt-2 pt-2 border-top d-flex align-items-center gap-1" style="font-size:0.7rem;color:#888;">
                        <i class="bi bi-info-circle me-1"></i> Estado esperado:
                        <span class="text-muted fw-bold ms-1" id="summary-status-text">Se definirá al confirmar</span>
                      </div>
                    </div>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top" id="medi-booking-actions">
                    <div id="medi-cita-disponibilidad" class="small fw-bold text-primary"></div>
                    <button type="submit" class="btn btn-primary rounded-pill px-5 fw-bold shadow-sm" id="btn-medi-confirm" disabled>
                      <i class="bi bi-check-lg me-2"></i>Confirmar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <!-- TAB 3: MIS CITAS -->
          <div class="tab-pane fade" id="medi-tab-citas" role="tabpanel">
            <!-- Stats rápidas -->
            <div class="row g-2 mb-3" id="medi-citas-stats-row">
              <div class="col-4">
                <div class="rounded-4 p-3 text-center border shadow-sm bg-white">
                  <div class="fw-bold fs-5 text-warning" id="stat-citas-pend">--</div>
                  <div class="extra-small text-muted">Pendientes</div>
                </div>
              </div>
              <div class="col-4">
                <div class="rounded-4 p-3 text-center border shadow-sm bg-white">
                  <div class="fw-bold fs-5 text-success" id="stat-citas-conf">--</div>
                  <div class="extra-small text-muted">Confirmadas</div>
                </div>
              </div>
              <div class="col-4">
                <div class="rounded-4 p-3 text-center border shadow-sm bg-white">
                  <div class="fw-bold fs-5 text-danger" id="stat-citas-canc">--</div>
                  <div class="extra-small text-muted">Canceladas</div>
                </div>
              </div>
            </div>
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-header bg-white py-3 border-0">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="fw-bold mb-0"><i class="bi bi-calendar-week me-2" style="color:var(--medi);"></i>Mi Agenda</h6>
                  <button class="btn btn-primary btn-sm rounded-pill px-3 fw-bold shadow-sm" onclick="Medi._switchMediTab('medi-tab-agendar')">
                    <i class="bi bi-plus-lg me-1"></i>Nueva cita
                  </button>
                </div>
                <ul class="nav-custom-pills-2 d-flex gap-3 flex-nowrap overflow-auto pb-0" id="medi-citas-tabs" role="tablist" style="scrollbar-width: none;">
                  <li class="nav-item" role="presentation">
                    <button class="nav-link active rounded-pill fw-bold small px-3 py-1 text-nowrap" id="tab-pendientes" data-bs-toggle="tab" data-bs-target="#pills-pendientes" type="button" role="tab">
                      Pendientes <span class="badge bg-warning text-dark ms-1" id="badge-pend" style="font-size:.6rem;">0</span>
                    </button>
                  </li>
                  <li class="nav-item" role="presentation">
                    <button class="nav-link rounded-pill fw-bold small px-3 py-1 text-nowrap" id="tab-confirmadas" data-bs-toggle="tab" data-bs-target="#pills-confirmadas" type="button" role="tab">
                      Confirmadas <span class="badge bg-success ms-1" id="badge-conf" style="font-size:.6rem;">0</span>
                    </button>
                  </li>
                  <li class="nav-item" role="presentation">
                    <button class="nav-link rounded-pill fw-bold small px-3 py-1 text-nowrap" id="tab-canceladas" data-bs-toggle="tab" data-bs-target="#pills-canceladas" type="button" role="tab">Canceladas</button>
                  </li>
                </ul>
              </div>
              <div class="card-body p-3">
                <div class="tab-content" id="medi-citas-content">
                  <div class="tab-pane fade show active" id="pills-pendientes" role="tabpanel">
                    <div id="carousel-pendientes" class="d-flex flex-column gap-3">
                      <div class="text-center w-100 py-4 text-muted small"><i class="bi bi-inbox me-2"></i>No hay citas pendientes.</div>
                    </div>
                  </div>
                  <div class="tab-pane fade" id="pills-confirmadas" role="tabpanel">
                    <div id="carousel-confirmadas" class="d-flex flex-column gap-3">
                      <div class="text-center w-100 py-4 text-muted small"><i class="bi bi-journal-check me-2"></i>No hay citas confirmadas.</div>
                    </div>
                  </div>
                  <div class="tab-pane fade" id="pills-canceladas" role="tabpanel">
                    <div id="carousel-canceladas" class="d-flex flex-column gap-3">
                      <div class="text-center w-100 py-4 text-muted small">Historial limpio.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 4: HISTORIAL -->
          <div class="tab-pane fade" id="medi-tab-historial" role="tabpanel">
            <div id="medi-documents-panel" class="mb-3"></div>
            <!-- Estadísticas personales -->
            <div id="medi-history-stats" class="row g-2 mb-3"></div>
            <div class="card border-0 shadow-sm rounded-4">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="fw-bold mb-0" style="color: var(--medi);">
                    <i class="bi bi-folder2-open me-2"></i>Mi Expediente
                  </h6>
                  <div class="d-flex gap-1" id="medi-history-filter-btns">
                    <button class="btn btn-primary rounded-pill px-2 py-0" style="font-size:.7rem;" onclick="Medi._filterHistory('todos', this)">Todos</button>
                    <button class="btn btn-outline-info rounded-pill px-2 py-0" style="font-size:.7rem;" onclick="Medi._filterHistory('Médico', this)"><i class="bi bi-bandaid me-1"></i>Médico</button>
                    <button class="btn btn-outline-primary rounded-pill px-2 py-0 text-purple" style="font-size:.7rem;" onclick="Medi._filterHistory('Psicologo', this)"><i class="bi bi-chat-heart me-1"></i>Psico</button>
                  </div>
                </div>
                <div id="medi-stu-consultas" class="d-flex flex-column gap-2">
                  <div class="text-center py-4 text-muted rounded-4" style="background: var(--medi-surface);">
                    <i class="bi bi-folder2-open fs-1 d-block mb-2 opacity-50"></i>
                    <p class="mb-0 small">Tu expediente esta vacio.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div><!-- /tab-content -->

        <!-- MODALS (Student) -->
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
                    <label class="form-label small fw-bold text-muted">Horarios disponibles</label>
                    <div id="resched-time-msg" class="p-3  rounded-3 text-center text-muted small border border-dashed">
                      <i class="bi bi-calendar-check d-block mb-1"></i> Selecciona un día primero
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
                <p class="small text-muted mb-3">Cuentanos el motivo. Esto nos ayuda a mejorar.</p>
                <form id="form-medi-cancel-reason">
                  <input type="hidden" id="cancel-cita-id">
                  <div class="d-grid gap-2 mb-3">
                    <button type="button" class="btn btn-outline-secondary btn-sm text-start" onclick="document.getElementById('cancel-other').value='Conflicto de horario'; this.form.dispatchEvent(new Event('submit'))"><i class="bi bi-calendar-x me-2"></i>Conflicto de horario</button>
                    <button type="button" class="btn btn-outline-secondary btn-sm text-start" onclick="document.getElementById('cancel-other').value='Ya me siento mejor'; this.form.dispatchEvent(new Event('submit'))"><i class="bi bi-emoji-smile me-2"></i>Ya me siento mejor</button>
                    <button type="button" class="btn btn-outline-secondary btn-sm text-start" onclick="document.getElementById('cancel-other').value='Emergencia personal'; this.form.dispatchEvent(new Event('submit'))"><i class="bi bi-exclamation-triangle me-2"></i>Emergencia personal</button>
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

      </div><!-- /medi-student-app -->
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
                   <div id="medi-ctx-messages" class="p-2 d-none" style="overflow:hidden;">
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
          <div class="modal-body  p-0">
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
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content rounded-4 border-0 shadow">
          <div class="modal-header border-0 pb-0 pt-4 px-4">
            <div class="d-flex align-items-center gap-2">
              <div class="bg-danger bg-opacity-10 p-2 rounded-3 text-danger"><i class="bi bi-heart-pulse-fill fs-5"></i></div>
              <div>
                <h6 class="fw-bold mb-0">Ficha de Emergencia</h6>
                <small class="text-muted">Tu información médica esencial</small>
              </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4 pt-2">
             <form id="medi-card-form">
                <!-- Sección: Datos Clínicos -->
                <p class="small fw-bold text-muted text-uppercase letter-spacing-1 mb-2 mt-2" style="font-size:0.65rem; letter-spacing:1px;">Datos Clínicos</p>
                <div class="mb-3">
                   <label class="small text-muted fw-bold">Tipo de Sangre</label>
                   <select class="form-select" id="edit-sangre">
                      <option value="">Seleccionar...</option>
                      <option value="O+">O+</option><option value="O-">O-</option>
                      <option value="A+">A+</option><option value="A-">A-</option>
                      <option value="B+">B+</option><option value="B-">B-</option>
                      <option value="AB+">AB+</option><option value="AB-">AB-</option>
                   </select>
                </div>
                <div class="mb-3">
                   <label class="small text-muted fw-bold">Alergias conocidas</label>
                   <input type="text" class="form-control" id="edit-alergias" placeholder="Ej: Penicilina, Mariscos... o Ninguna">
                </div>
                <!-- Sección: Condiciones Crónicas -->
                <div class="mb-3">
                  <label class="small text-muted fw-bold d-block mb-1">Condiciones Crónicas</label>
                  <div class="d-flex flex-wrap gap-2">
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="cond-diabetes" value="Diabetes">
                      <label class="form-check-label small" for="cond-diabetes">Diabetes</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="cond-hipertension" value="Hipertensión">
                      <label class="form-check-label small" for="cond-hipertension">Hipertensión</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="cond-asma" value="Asma">
                      <label class="form-check-label small" for="cond-asma">Asma</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="cond-otra" value="Otra">
                      <label class="form-check-label small" for="cond-otra">Otra</label>
                    </div>
                  </div>
                  <input type="text" class="form-control form-control-sm mt-2 d-none" id="cond-otra-detalle" placeholder="Especifica la condición...">
                </div>
                <!-- Sección: Medicamentos -->
                <div class="mb-3">
                  <label class="small text-muted fw-bold">Medicamentos Actuales</label>
                  <textarea class="form-control form-control-sm" id="edit-medicamentos" rows="2" placeholder="Ej: Metformina 850mg, Losartan 50mg... o Ninguno"></textarea>
                </div>
                <hr class="my-3">
                <!-- Sección: Contacto de Emergencia -->
                <p class="small fw-bold text-muted text-uppercase mb-2" style="font-size:0.65rem; letter-spacing:1px;">Contacto de Emergencia</p>
                <div class="mb-3">
                   <input type="text" class="form-control mb-2" id="edit-contacto-nombre" placeholder="Nombre completo">
                   <input type="tel" class="form-control" id="edit-contacto-tel" placeholder="Teléfono">
                </div>
                <button type="submit" class="btn btn-danger w-100 mt-1 rounded-pill fw-bold">
                  <i class="bi bi-shield-check me-2"></i>Guardar Ficha Médica
                </button>
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
                        <div class="vr opacity-10"></div>
                        <div>
                            <div class="extra-small text-muted fw-bold">Talla</div>
                            <div class="fw-bold text-dark" id="detail-talla">--</div>
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
                                 <input type="text" id="adm-book-matricula" class="form-control  border-0" placeholder="Matrícula...">
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
                                 <div id="adm-book-time-msg" class="text-center small text-muted fst-italic py-2  rounded-3 border border-dashed">
                                    <i class="bi bi-calendar-event me-2"></i>Selecciona un día primero
                                 </div>
                                 <div id="adm-book-times" class="d-flex flex-wrap gap-2 justify-content-center d-none p-2"></div>
                                 <input type="hidden" id="adm-book-time" required>
                             </div>
                         </div>
                         <div class="mb-3">
                             <label class="form-label small fw-bold text-muted">Motivo</label>
                             <select class="form-select  border-0 mb-2" id="adm-book-category">
                                 <option value="Consulta General">Consulta General</option>
                                 <option value="Urgencia Menor">Urgencia Menor</option>
                                 <option value="Seguimiento">Seguimiento</option>
                                 <option value="Certificado Médico">Certificado Médico</option>
                             </select>
                             <textarea id="adm-book-reason" class="form-control  border-0" rows="2" placeholder="Detalles adicionales..."></textarea>
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
                ${_myRole === 'Médico' ? `
                <div class="d-flex justify-content-between align-items-center p-3  rounded-3 mb-3">
                    <div>
                        <div class="fw-bold text-dark">Habilitar Agenda Médica</div>
                        <div class="small text-muted">Permitir reservas para medicina general</div>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input fs-4" type="checkbox" id="cfg-available-medico" ${(_ctx.config && _ctx.config.medi && _ctx.config.medi.availableMédico !== false) ? 'checked' : ''}>
                    </div>
                </div>` : ''}

                ${_myRole === 'Psicologo' ? `
                <div class="d-flex justify-content-between align-items-center p-3  rounded-3 mb-3">
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

    // Logic for Pre-filled Student (from Search Result or cache)
    if (encodedStudent) {
      try {
        let student = null;
        if (encodedStudent === 'found') {
          student = _foundPatient;
        } else if (_patientCache.has(encodedStudent)) {
          student = _patientCache.get(encodedStudent);
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
    _enableStudentFloatingStack();

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
      SLOT_STEP = cfg.slotStep || 30;
      SLOT_DURATION = cfg.slotDuration || 60;

      // Hero personalizado
      _updateHeroGreeting(user);

      // Quick Actions grid (6 acciones)
      _renderQuickActions();

      // Indicador de disponibilidad del servicio
      _renderServiceAvailability();

      // Check-in de bienestar diario
      _renderDailyCheckin(user.uid);

      // Inicializar componentes principales
      loadEmergencyCard(user);
      setupAppointmentForm();
      loadStudentHistory(user.uid);
      loadWellnessFeed();

      // Botón SOS flotante
      _renderSOSButton();

      // Student Chat
      renderStudentChat(user.uid, user.displayName || user.email);

      // Tutorial en primera visita
      initMediTutorial(user.uid);

    } catch (err) {
      console.error("[Medi] Error en initStudent async:", err);
    }
  }


  function loadEmergencyCard(user) {
    // CORRECCIÓN: Usar _ctx.profile que es la propiedad estándar en SIA
    const p = _ctx.profile || {};
    const hd = p.healthData || {};
    const contacts = Array.isArray(hd.contactos) ? hd.contactos : [];
    const primaryContact = contacts[0] || {};
    const bloodType = p.tipoSangre || hd.tipoSangre || '';
    const allergyValue = p.alergias || hd.alergia || '';
    const medsValue = p.medicamentosActuales || hd.tratamientoMédico || hd.medicamentoActual || '';
    const emergencyName = p.contactoEmergenciaName || primaryContact.nombre || hd.contactoEmergencia || '';
    const emergencyTel = p.contactoEmergenciaTel || primaryContact.telefono || hd.contactoEmergenciaTel || '';
    const savedConds = Array.isArray(p.condicionesCronicas)
      ? p.condicionesCronicas
      : String(hd.enfermedadCronica || hd.padecimientoFisico || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    // Render Vista — Carnet médico de emergencia
    const elSangre = document.getElementById('view-sangre');
    if (elSangre) elSangre.textContent = bloodType || '--';

    const elAlergias = document.getElementById('view-alergias');
    if (elAlergias) elAlergias.textContent = allergyValue || 'Ninguna';

    // Condiciones crónicas en el carnet
    const elCondiciones = document.getElementById('view-condiciones');
    if (elCondiciones) {
      const conds = savedConds.join(', ');
      elCondiciones.textContent = conds ? `Condiciones: ${conds}` : '';
      elCondiciones.classList.toggle('d-none', !conds);
    }

    // Advertencia crítica si tiene alergias registradas (distintas de "Ninguna" / vacías)
    const warning = document.getElementById('view-alergia-warning');
    if (warning) {
      const hasAllergy = allergyValue && allergyValue.toLowerCase() !== 'ninguna';
      warning.classList.toggle('d-none', !hasAllergy);
    }

    const elContNom = document.getElementById('view-contacto-nombre');
    const tel = emergencyTel || '';
    if (elContNom) {
      const nombre = emergencyName || '--';
      elContNom.innerHTML = tel
        ? `<a href="tel:${escapeHtml(tel)}" class="text-white text-decoration-none fw-bold" title="Llamar: ${escapeHtml(tel)}"><i class="bi bi-telephone-fill me-1" style="font-size:0.6rem;"></i>${escapeHtml(nombre)}</a>`
        : escapeHtml(nombre);
    }

    const elContTel = document.getElementById('view-contacto-tel');
    if (elContTel) {
      if (tel) {
        elContTel.innerHTML = `<a href="tel:${escapeHtml(tel)}" class="text-white-50 text-decoration-none">${escapeHtml(tel)}</a>`;
        elContTel.classList.remove('d-none');
      } else {
        elContTel.textContent = '';
        elContTel.classList.add('d-none');
      }
    }

    // Render Form — Precargar el formulario con lo que ya existe
    const inpSangre = document.getElementById('edit-sangre');
    if (inpSangre) inpSangre.value = bloodType;

    const inpAlergias = document.getElementById('edit-alergias');
    if (inpAlergias) inpAlergias.value = allergyValue;

    const inpMeds = document.getElementById('edit-medicamentos');
    if (inpMeds) inpMeds.value = medsValue;

    // Precargar checkboxes de condiciones crónicas
    ['diabetes', 'hipertension', 'asma', 'otra'].forEach(c => {
      const cb = document.getElementById(`cond-${c}`);
      if (cb) cb.checked = savedConds.includes(cb.value);
    });
    const otraDetalle = document.getElementById('cond-otra-detalle');
    const otraCb = document.getElementById('cond-otra');
    if (otraDetalle && otraCb) {
      otraDetalle.classList.toggle('d-none', !otraCb.checked);
      otraDetalle.value = p.otraCondicionDetalle || hd.otraCondicionDetalle || '';
      otraCb.addEventListener('change', () => otraDetalle.classList.toggle('d-none', !otraCb.checked));
    }

    const inpContNom = document.getElementById('edit-contacto-nombre');
    if (inpContNom) inpContNom.value = emergencyName;

    const inpContTel = document.getElementById('edit-contacto-tel');
    if (inpContTel) inpContTel.value = emergencyTel;

    // Handler de guardado
    const form = document.getElementById('medi-card-form');
    if (form) {
      // Evitar duplicidad de listeners
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      // Re-bind change listener for "Otra" checkbox after clone
      const otraCbNew = newForm.querySelector('#cond-otra');
      const otraDetNew = newForm.querySelector('#cond-otra-detalle');
      if (otraCbNew && otraDetNew) {
        otraCbNew.addEventListener('change', () => otraDetNew.classList.toggle('d-none', !otraCbNew.checked));
      }

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = newForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

        // Recopilar condiciones crónicas seleccionadas
        const condiciones = [];
        ['cond-diabetes', 'cond-hipertension', 'cond-asma', 'cond-otra'].forEach(id => {
          const cb = document.getElementById(id);
          if (cb && cb.checked) condiciones.push(cb.value);
        });

        const bloodTypeValue = document.getElementById('edit-sangre').value.trim();
        const allergyText = document.getElementById('edit-alergias').value.trim();
        const medsText = document.getElementById('edit-medicamentos').value.trim();
        const emergencyNameValue = document.getElementById('edit-contacto-nombre').value.trim();
        const emergencyTelValue = document.getElementById('edit-contacto-tel').value.trim();
        const otherConditionDetail = condiciones.includes('Otra') ? (document.getElementById('cond-otra-detalle').value || '').trim() : '';
        const conditionsText = condiciones.join(', ');
        const contactList = emergencyNameValue
          ? [{
            nombre: emergencyNameValue,
            parentesco: primaryContact.parentesco || '',
            telefono: emergencyTelValue
          }]
          : [];

        const data = {
          tipoSangre: bloodTypeValue,
          alergias: allergyText,
          condicionesCronicas: condiciones,
          otraCondicionDetalle: otherConditionDetail,
          medicamentosActuales: medsText,
          contactoEmergenciaName: emergencyNameValue,
          contactoEmergenciaTel: emergencyTelValue,
          'healthData.alergia': allergyText,
          'healthData.enfermedadCronica': conditionsText,
          'healthData.padecimientoFisico': conditionsText,
          'healthData.otraCondicionDetalle': otherConditionDetail,
          'healthData.tratamientoMédico': medsText,
          'healthData.medicamentoActual': medsText,
          'healthData.contactoEmergencia': emergencyNameValue,
          'healthData.contactoEmergenciaTel': emergencyTelValue,
          'healthData.contactos': contactList
        };

        try {
          // Guardar en la colección usuarios del alumno
          await _ctx.db.collection('usuarios').doc(user.uid).update(data);

          // CORRECCIÓN: Actualizar el perfil en el contexto local de forma segura
          if (!_ctx.profile) _ctx.profile = {};
          Object.assign(_ctx.profile, {
            tipoSangre: bloodTypeValue,
            alergias: allergyText,
            condicionesCronicas: condiciones,
            otraCondicionDetalle: otherConditionDetail,
            medicamentosActuales: medsText,
            contactoEmergenciaName: emergencyNameValue,
            contactoEmergenciaTel: emergencyTelValue
          });
          if (!_ctx.profile.healthData || typeof _ctx.profile.healthData !== 'object') {
            _ctx.profile.healthData = {};
          }
          _ctx.profile.healthData.alergia = allergyText;
          _ctx.profile.healthData.enfermedadCronica = conditionsText;
          _ctx.profile.healthData.padecimientoFisico = conditionsText;
          _ctx.profile.healthData.otraCondicionDetalle = otherConditionDetail;
          _ctx.profile.healthData['tratamientoM\u00E9dico'] = medsText;
          _ctx.profile.healthData.medicamentoActual = medsText;
          _ctx.profile.healthData.contactoEmergencia = emergencyNameValue;
          _ctx.profile.healthData.contactoEmergenciaTel = emergencyTelValue;
          _ctx.profile.healthData.contactos = contactList;

          loadEmergencyCard(user); // Refrescar vista

          const modal = bootstrap.Modal.getInstance(document.getElementById('modalMediEditCard'));
          if (modal) modal.hide();

          window.dispatchEvent(new CustomEvent('sia-profile-ready', { detail: _ctx.profile }));
          showToast('Ficha médica actualizada', 'success');
        } catch (err) {
          console.error("[Medi] Error al guardar datos medicos:", err);
          showToast('Error al guardar: ' + err.message, 'danger');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Guardar Ficha Médica';
        }
      });
    }
  }

  function cancelarEdicionTarjeta() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalMediEditCard'));
    if (modal) modal.hide();
  }

  function _scrollBookingTargetIntoView(target, block = 'center') {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });
    });
  }

  function _focusBookingSection(section) {
    const map = {
      service: 'medi-service-container',
      date: 'medi-date-container',
      time: 'medi-time-container',
      motivo: 'medi-motivo-container',
      summary: 'medi-booking-summary',
      confirm: 'medi-booking-actions'
    };
    const targetId = map[section] || section;
    _scrollBookingTargetIntoView(targetId, section === 'confirm' ? 'nearest' : 'center');
  }

  function _selectStudentService(serviceType, btn = null, options = {}) {
    const normalizedType = _normalizeStudentServiceType(serviceType);
    const isPsi = normalizedType === 'Psicologo';
    const category = _getStudentServiceCategory(normalizedType);
    const summaryLabel = _getStudentServiceLabel(normalizedType);
    const summaryIconClass = _getStudentServiceIconClass(normalizedType);
    const serviceButtons = document.querySelectorAll('.service-btn');

    const categoryInput = document.getElementById('medi-cita-categoria');
    const typeInput = document.getElementById('medi-cita-tipo');
    if (categoryInput) categoryInput.value = category;
    if (typeInput) typeInput.value = normalizedType;
    window._selectedServiceDuration = normalizedType;

    serviceButtons.forEach((button) => {
      const buttonType = _normalizeStudentServiceType(button.dataset.serviceType);
      button.classList.remove('active', 'border-info', 'border-primary', 'bg-info-subtle', 'bg-primary-subtle');
      button.classList.add('btn-outline-light');
      button.style.borderColor = 'rgba(255,255,255,0.1)';
      if (buttonType === normalizedType) {
        button.classList.remove('btn-outline-light');
        button.classList.add('active', isPsi ? 'bg-primary-subtle' : 'bg-info-subtle', isPsi ? 'border-primary' : 'border-info');
        button.style.borderColor = '';
      }
    });

    document.getElementById('medi-date-container')?.classList.remove('d-none');
    const summaryService = document.getElementById('summary-service');
    if (summaryService) summaryService.textContent = summaryLabel;
    const summaryIcon = document.getElementById('summary-service-icon');
    if (summaryIcon) summaryIcon.className = summaryIconClass;

    if (_currentBookingLock) {
      _refreshStudentBookingLock();
      return;
    }

    if (!options.skipRefresh) {
      _refreshSlotsOnTypeChange();
    }
    if (!options.skipFocus) {
      setTimeout(() => _focusBookingSection('date'), 120);
    }
  }

  function _updateBookingStatusPreview(status = 'neutral', queuePosition = 0) {
    const statusEl = document.getElementById('summary-status-text');
    if (!statusEl) return;

    statusEl.classList.remove('text-muted', 'text-warning', 'text-success');

    if (status === 'confirmada') {
      statusEl.classList.add('text-success');
      statusEl.textContent = 'Se confirmará al instante';
      return;
    }

    if (status === 'pendiente') {
      statusEl.classList.add('text-warning');
      statusEl.textContent = queuePosition > 0
        ? `Sala de espera (${queuePosition} antes)`
        : 'Pendiente de confirmación';
      return;
    }

    statusEl.classList.add('text-muted');
    statusEl.textContent = 'Se definirá al confirmar';
  }

  function _redirectToAppointmentsTab(status = 'pendiente') {
    _switchMediTab('medi-tab-citas');
    setTimeout(() => {
      const tabId = status === 'confirmada' ? 'tab-confirmadas' : 'tab-pendientes';
      document.getElementById(tabId)?.click();
    }, 180);
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
    const motivoInput = document.getElementById('medi-cita-motivo');

    // Reset visual
    if (timeGrid) { timeGrid.innerHTML = ''; timeGrid.classList.add('d-none'); }
    if (msg) { msg.classList.remove('d-none'); msg.innerHTML = '<i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero'; }
    if (availDiv) availDiv.textContent = '';
    dateInput.value = ""; timeInput.value = "";
    _updateBookingStatusPreview();
    _refreshStudentBookingLock(true);

    function resetBookingFlow() {
      form.reset();
      dateInput.value = '';
      timeInput.value = '';
      if (availDiv) availDiv.textContent = '';
      if (msg) {
        msg.classList.remove('d-none');
        msg.innerHTML = '<i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero';
      }
      if (timeGrid) {
        timeGrid.innerHTML = '';
        timeGrid.className = 'd-none gap-2 flex-wrap mt-2';
      }
      document.getElementById('medi-date-container')?.classList.add('d-none');
      document.getElementById('medi-booking-summary')?.classList.add('d-none');
      document.getElementById('summary-datetime').textContent = '--';
      document.getElementById('summary-service').textContent = '--';
      document.getElementById('summary-service-icon').className = 'bi bi-bandaid-fill text-primary';
      document.getElementById('medi-cita-categoria').value = '';
      document.getElementById('medi-cita-tipo').value = 'Médico';
      document.querySelectorAll('.service-btn').forEach(b => {
        b.classList.remove('active', 'border-info', 'border-primary', 'bg-info-subtle', 'bg-primary-subtle');
        b.classList.add('btn-outline-light');
        b.style.borderColor = 'rgba(255,255,255,0.1)';
      });
      dateSelector?.querySelectorAll('.date-option').forEach(c => {
        c.classList.remove('bg-primary', 'text-white', 'shadow', 'border-primary', 'scale-105');
        c.classList.add('bg-white', 'text-dark');
        c.querySelector('.date-label')?.classList.remove('text-white-50');
        c.querySelector('.date-label')?.classList.add('text-muted');
        c.querySelector('.date-month')?.classList.remove('text-white');
        c.querySelector('.date-month')?.classList.add('text-primary');
      });
      if (motivoInput) motivoInput.value = '';
      const btnConf = document.getElementById('btn-medi-confirm');
      if (btnConf) btnConf.disabled = true;
      _updateBookingStatusPreview();
    }

    // [NEW] Bind category change to hidden type input
    const catSelect = document.getElementById('medi-cita-categoria');
    const typeInput = document.getElementById('medi-cita-tipo');
    if (catSelect && typeInput) {
      catSelect.addEventListener('change', (e) => {
        const prevDate = dateInput.value;
        const val = e.target.value;
        typeInput.value = (val === 'Salud Mental') ? 'Psicologo' : 'Médico';

        typeInput.value = _normalizeStudentServiceType(typeInput.value);

        // Reset child selections
        dateInput.value = "";
        timeInput.value = "";
        _updateBookingStatusPreview();
        dateSelector.querySelectorAll('.date-option').forEach(c => {
          c.classList.remove('bg-primary', 'text-white', 'shadow', 'border-primary', 'scale-105');
          c.classList.add('bg-white', 'text-dark');
          c.querySelector('.date-label').classList.remove('text-white-50');
          c.querySelector('.date-label').classList.add('text-muted');
          c.querySelector('.date-month').classList.remove('text-white');
          c.querySelector('.date-month').classList.add('text-primary');
        });
        if (timeGrid) { timeGrid.innerHTML = ''; timeGrid.classList.add('d-none'); }
        document.getElementById('medi-booking-summary')?.classList.add('d-none');
        const btnConf = document.getElementById('btn-medi-confirm');
        if (btnConf) btnConf.disabled = true;

        // Si ya había una fecha seleccionada, recargar horarios automáticamente
        if (prevDate) {
          const selectedCard = dateSelector.querySelector(`.date-option[data-date="${prevDate}"]`);
          if (selectedCard) {
            selectedCard.click();
          } else {
            if (msg) { msg.classList.remove('d-none'); msg.innerHTML = '<i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero'; }
          }
        } else {
          if (msg) { msg.classList.remove('d-none'); msg.innerHTML = '<i class="bi bi-calendar-check fs-4 d-block mb-2"></i> Selecciona un día primero'; }
        }
      });
    }

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
          _updateBookingStatusPreview();

          // [NEW] Reset Confirmation State
          document.getElementById('medi-booking-summary').classList.add('d-none');
          document.getElementById('btn-medi-confirm').disabled = true;

          if (_currentBookingLock) {
            await _refreshStudentBookingLock();
            return;
          }

          msg.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Buscando disponibilidad...';
          timeGrid.classList.add('d-none');
          msg.classList.remove('d-none');

          // [NEW] Check Availability Config
          const targetDate = new Date(card.dataset.date + 'T12:00:00');
          const selectedType = document.getElementById('medi-cita-tipo').value || 'Médico';
          const cfg = _ctx.config?.medi || {};
          const normalizedSelectedType = _normalizeStudentServiceType(document.getElementById('medi-cita-tipo').value || selectedType || 'Medico');

          const isServiceAvailable = _isServiceEnabledForBookingDate(cfg, normalizedSelectedType, targetDate);

          if (!isServiceAvailable) {
            msg.innerHTML = `<i class="bi bi-cone-striped me-2"></i> La agenda de <b>${selectedType === 'Médico' ? 'Medicina' : 'Psicología'}</b> no está disponible por el momento.`;
            msg.innerHTML = `<i class="bi bi-cone-striped me-2"></i> La agenda de <b>${normalizedSelectedType === 'Psicologo' ? 'Psicología' : 'Medicina'}</b> no está disponible por el momento.`;
            msg.classList.remove('d-none');
            return;
          }

          // Fetch Occupied Slots
          const currentType = document.getElementById('medi-cita-tipo').value || 'Médico';
          const cfgMed = _ctx.config?.medi || {};
          const slots = _getStudentBookableSlotsForDate(targetDate, currentType, cfgMed);
          let occupied = [];

          try {
            occupied = await MediService.getOccupiedSlots(_ctx, card.dataset.date, currentType);
          } catch (e) { console.error("Error fetching occupied:", e); }

          // Render Time Grid
          timeGrid.classList.remove('d-none');
          timeGrid.className = 'd-flex flex-wrap gap-2 py-2 px-1 mb-3';
          timeGrid.innerHTML = '';

          // [NEW] Slot counts for queue badges
          const slotCounts = occupied._slotCounts || {};
          const validSlots = slots.map(slot => {
            const tStr = `${slot.getHours().toString().padStart(2, '0')}:${slot.getMinutes().toString().padStart(2, '0')}`;
            const baseId = MediService.slotIdFromDate(slot);
            const slotId = `${baseId}_${currentType}`;
            const isTaken = occupied.includes(slotId);
            const count = slotCounts[slotId] || 0;

            return { tStr, isTaken, count, slotId };
          });

          // Determinar el slot con menor ocupación para badge "Mejor opción"
          const availableSlots = validSlots.filter(s => !s.isTaken);
          let bestSlotTime = null;
          if (availableSlots.length > 0) {
            bestSlotTime = availableSlots.reduce((a, b) => a.count <= b.count ? a : b).tStr;
          }

          if (validSlots.length === 0) {
            timeGrid.innerHTML = '<div class="text-muted small w-100 text-center fst-italic">No hay horarios habilitados para ese día.</div>';
          } else {
            validSlots.forEach(({ tStr, isTaken, count, slotId }) => {
              const btn = document.createElement('div');
              const isDisabled = isTaken;
              const MAX_PER_SLOT = 4;
              const isBest = !isDisabled && tStr === bestSlotTime && count === 0;

              // Queue badge logic
              let statusLabel, statusClass, barColor;
              if (isDisabled) {
                statusLabel = 'Lleno'; statusClass = 'text-danger'; barColor = '#dc3545';
              } else if (count > 0) {
                const waitMins = count * 15;
                statusLabel = `Cola ${count} (~${waitMins}min)`; statusClass = 'text-warning'; barColor = '#f59e0b';
              } else {
                statusLabel = 'Libre'; statusClass = 'text-success'; barColor = '#198754';
              }
              const fillPct = Math.round((Math.min(count, MAX_PER_SLOT) / MAX_PER_SLOT) * 100);

              btn.className = `flex-shrink-0 text-center border rounded-3 shadow-sm p-2 time-slot-card position-relative ${isDisabled ? 'text-muted opacity-50 pe-none' : 'bg-white cursor-pointer hover-lift'}`;
              btn.style.width = '90px';
              btn.dataset.time = tStr;
              btn.dataset.date = dateInput.value;
              btn.dataset.slotId = slotId;

              btn.innerHTML = `
                ${isBest ? '<span class="position-absolute top-0 start-50 translate-middle badge bg-success rounded-pill" style="font-size:.55rem;padding:2px 5px;">★ Mejor</span>' : ''}
                <div class="fw-bold fs-6 lh-1 mb-1 ${isDisabled ? 'text-decoration-line-through' : 'text-dark'}" style="margin-top:${isBest ? '8px' : '0'}">${tStr}</div>
                <div class="extra-small text-uppercase fw-bold ${statusClass}" style="font-size:.6rem;">${statusLabel}</div>
                <div class="medi-slot-bar mt-1">
                  <div class="medi-slot-bar-fill" style="width:${fillPct}%;background:${barColor};"></div>
                </div>`;

              if (!isDisabled) {
                btn.onclick = () => {
                  timeGrid.querySelectorAll('.time-slot-card').forEach(b => {
                    b.classList.remove('border-primary', 'bg-primary-subtle', 'ring-2');
                    b.classList.add('border', 'bg-white');
                  });
                  btn.classList.remove('border', 'bg-white');
                  btn.classList.add('border-primary', 'bg-primary-subtle');

                  timeInput.value = tStr;
                  _updateBookingStatusPreview(count === 0 ? 'confirmada' : 'pendiente', count);

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
                  }

                  setTimeout(() => {
                    const nextSection = (motivoInput?.value || '').trim() ? 'summary' : 'motivo';
                    _focusBookingSection(nextSection);
                  }, 120);
                };
              }
              timeGrid.appendChild(btn);
            });
          }
          msg.classList.add('d-none');
          setTimeout(() => _focusBookingSection('time'), 120);
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

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';

        try {
          const [y, m, d] = dateInput.value.split('-').map(Number);
          const [hh, mm] = timeInput.value.split(':').map(Number);
          const localDate = new Date(y, m - 1, d, hh, mm);
          const selectedType = document.getElementById('medi-cita-tipo').value || 'Médico';
          const baseSlotId = MediService.slotIdFromDate(localDate);
          const newSlotId = `${baseSlotId}_${selectedType}`;

          const activeAppt = _currentBookingLock || await MediService.checkActiveAppointment(_ctx, _ctx.user.uid);

          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Confirmar';

          if (activeAppt) {
            _currentBookingLock = activeAppt;
            await _refreshStudentBookingLock();
            const activeDate = activeAppt.safeDate instanceof Date ? activeAppt.safeDate.toLocaleString() : 'tu cita activa';
            throw new Error(`Ya tienes una cita activa (${activeDate}). Debes atenderla, cancelarla o reprogramarla antes de agendar otra.`);
          }

          // Mostrar modal de revisión ANTES de guardar
          _showPreConfirmModal(localDate, newSlotId, null, form, submitBtn);

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
    /** Muestra modal de revisión PRE-guardado. Al confirmar llama executeBooking. */
    function _showPreConfirmModal(localDate, newSlotId, replaceId, form, submitBtn) {
      const categoria = form.querySelector('#medi-cita-categoria').value || 'Médico';
      const tipo = categoria === 'Salud Mental' ? 'Psicología' : 'Médico General';
      const isPsi = tipo === 'Psicología';
      const motivo = form.querySelector('#medi-cita-motivo').value || '';
      const dateText = localDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeText = localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateCap = dateText.charAt(0).toUpperCase() + dateText.slice(1);

      document.getElementById('modalPreConfirm')?.remove();
      const d = document.createElement('div');
      d.innerHTML = `
        <div class="modal fade" id="modalPreConfirm" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div class="px-4 pt-4 pb-3 text-white" style="background:linear-gradient(135deg,#1B396A 0%,#0d6efd 100%);">
                <h5 class="fw-bold mb-1 filter-white"><i class="bi bi-clipboard2-check me-2"></i>Revisar y confirmar</h5>
                <div class="small opacity-75">Verifica los datos antes de agendar</div>
              </div>
              <div class="modal-body p-4">
                <div class="d-flex gap-3 mb-3">
                  <div class="rounded-3 p-2 flex-shrink-0 text-center" style="background:#eff6ff;min-width:48px;">
                    <i class="bi bi-${isPsi ? 'chat-heart-fill' : 'bandaid-fill'}" style="font-size:1.4rem;color:${isPsi ? '#6f42c1' : '#0d6efd'};"></i>
                  </div>
                  <div>
                    <div class="extra-small text-muted">Servicio</div>
                    <div class="fw-bold">${escapeHtml(tipo)}</div>
                  </div>
                </div>
                <div class="d-flex gap-3 mb-3">
                  <div class="rounded-3 p-2 flex-shrink-0 text-center" style="background:#eff6ff;min-width:48px;">
                    <i class="bi bi-calendar-event-fill" style="font-size:1.4rem;color:#0d6efd;"></i>
                  </div>
                  <div>
                    <div class="extra-small text-muted">Fecha y hora</div>
                    <div class="fw-bold">${escapeHtml(dateCap)}</div>
                    <div class="small text-muted">${escapeHtml(timeText)} hrs</div>
                  </div>
                </div>
                ${motivo ? `<div class="d-flex gap-3 mb-3">
                  <div class="rounded-3 p-2 flex-shrink-0 text-center" style="background:#eff6ff;min-width:48px;">
                    <i class="bi bi-chat-left-text-fill" style="font-size:1.1rem;color:#0d6efd;"></i>
                  </div>
                  <div>
                    <div class="extra-small text-muted">Motivo</div>
                    <div class="small text-dark">${escapeHtml(motivo)}</div>
                  </div>
                </div>` : ''}
                <div class="rounded-3 p-3 mb-3" style="background:#fffbeb;border-left:4px solid #f59e0b;">
                  <div class="fw-bold small mb-1" style="color:#92400e;"><i class="bi bi-lightbulb-fill me-1"></i>Indicaciones</div>
                  <ul class="mb-0 small ps-3" style="color:#78350f;">
                    <li>Llega <b>10 minutos antes</b> de tu cita.</li>
                    <li>Trae tu <b>credencial de estudiante</b>.</li>
                    <li>Si no puedes asistir, <b>cancela con anticipación</b>.</li>
                  </ul>
                </div>
                <div class="rounded-3 p-2 mb-4" style="background:#f8f9fa;font-size:0.7rem;color:#6c757d;">
                  <i class="bi bi-shield-check me-1"></i>Tu información es confidencial bajo la normativa del TEC.
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-light rounded-pill flex-fill fw-bold" data-bs-dismiss="modal">Regresar</button>
                  <button class="btn btn-primary rounded-pill flex-fill fw-bold" id="btn-pre-confirm-ok">
                    <i class="bi bi-check-lg me-1"></i>${replaceId ? 'Reprogramar' : 'Agendar cita'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(d.firstElementChild);
      const modalEl = document.getElementById('modalPreConfirm');
      const m = new bootstrap.Modal(modalEl, { backdrop: 'static' });
      m.show();

      let _confirmed = false;
      document.getElementById('btn-pre-confirm-ok').onclick = () => {
        _confirmed = true;
        m.hide();
      };
      modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
        if (_confirmed) {
          executeBooking(localDate, newSlotId, replaceId);
        } else {
          // Usuario canceló: restaurar botón
          if (form) form.dataset.submitting = 'false';
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Confirmar'; }
        }
      }, { once: true });
    }

    async function executeBooking(localDate, newSlotId, replaceId) {
      const form = document.getElementById('form-medi-nueva-cita'); // re-grab
      const submitBtn = form.querySelector('button[type="submit"]');

      // Ensure state is locked
      form.dataset.submitting = 'true';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Agendando...';

      try {
        // [NEW] Resolve Professional (Strict Logic)
        const tipo = (form.querySelector('#medi-cita-categoria').value === 'Salud Mental') ? 'Psicologo' : 'Médico';

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

        const bookingResult = await MediService.reservarCita(_ctx, {
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
        const tipoLabel = (form.querySelector('#medi-cita-categoria').value === 'Salud Mental') ? 'Psicología' : 'Médico General';
        const dateText = localDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeText = localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateCap = dateText.charAt(0).toUpperCase() + dateText.slice(1);
        const finalStatus = bookingResult?.isQueued ? 'pendiente' : 'confirmada';
        const calendarCita = finalStatus === 'confirmada'
          ? _buildCalendarAppointmentPayload({
            id: bookingResult?.citaId || replaceId || `medi_${localDate.getTime()}`,
            safeDate: localDate,
            tipoServicio: tipo,
            profesionalName: profName,
            motivo: `[${form.querySelector('#medi-cita-categoria').value}] ${form.querySelector('#medi-cita-motivo').value}`
          })
          : null;

        resetBookingFlow();
        _showBookingConfirmModal({
          tipo: tipoLabel,
          dateText: dateCap,
          timeText,
          replaceId,
          finalStatus,
          queuePosition: bookingResult?.queuePosition || 0,
          calendarCita
        });

        // 🔔 Notificación in-app de cita agendada
        if (window.Notify && _ctx.user?.uid) {
          const statusTxt = finalStatus === 'confirmada' ? 'Confirmada ✅' : 'En lista de espera ⏳';
          Notify.send(_ctx.user.uid, {
            tipo: 'medi',
            titulo: `Cita ${replaceId ? 'Reprogramada' : 'Agendada'} — ${tipoLabel}`,
            mensaje: `${dateCap} a las ${timeText}. Estado: ${statusTxt}`,
            link: '/medi'
          });
        }
        return;

        // Show success state (no toast here — modal will appear instead)
        const successEl = document.getElementById('medi-booking-success');
        const detailsEl = document.getElementById('medi-success-details');
        if (successEl && detailsEl) {
          const tipo = (form.querySelector('#medi-cita-categoria').value === 'Salud Mental') ? 'Psicolog\u00eda' : 'M\u00e9dico General';
          const dateText = localDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
          const timeText = localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateCap = dateText.charAt(0).toUpperCase() + dateText.slice(1);

          detailsEl.innerHTML = `
              <div class=" rounded-4 p-3 d-inline-block text-start">
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
          successEl.classList.remove('d-none');
          setTimeout(() => { successEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);

          // Mostrar modal de confirmación con indicaciones
          _showBookingConfirmModal({
            tipo: tipo,
            dateText: dateCap,
            timeText,
            profName,
            profId,
            profProfileId,
            replaceId
          });

          // Auto-navigate a "Mis Citas" tras 4s (el listener real-time decide Pendientes vs Confirmadas)
          setTimeout(() => {
            _switchMediTab('medi-tab-citas');
            // Ir a Pendientes inicialmente; el listener cambiará a Confirmadas si auto-confirma
            const tabPend = document.getElementById('tab-pendientes');
            if (tabPend) tabPend.click();
            form.classList.remove('d-none');
            successEl.classList.add('d-none');
          }, 4000);

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
        form.dataset.submitting = 'false';
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
  function _loadQueuePosition(...args) { return _studentExperience._loadQueuePosition?.(...args); }
  function loadStudentHistory(...args) { return _studentExperience.loadStudentHistory?.(...args); }
  function renderFollowUpBanner(...args) { return _studentExperience._renderFollowUpBanner?.(...args); }
  function _updateHeroGreeting(...args) { return _studentExperience._updateHeroGreeting?.(...args); }
  function _renderHeroNextAppointment(...args) { return _studentExperience._renderHeroNextAppointment?.(...args); }
  function _renderQueueCard(...args) { return _studentExperience._renderQueueCard?.(...args); }
  function _renderQuickActions(...args) { return _studentExperience._renderQuickActions?.(...args); }
  function _switchMediTab(...args) { return _studentExperience._switchMediTab?.(...args); }
  function _updateChatBadgeOnTab(...args) { return _studentExperience._updateChatBadgeOnTab?.(...args); }
  function _relativeTime(...args) { return _studentExperience._relativeTime?.(...args); }
  function initMediTutorial(...args) { return _studentExperience.initMediTutorial?.(...args); }
  function launchMediTutorial(...args) { return _studentExperience.launchMediTutorial?.(...args); }
  function loadWellnessFeed(...args) { return _studentExperience.loadWellnessFeed?.(...args); }
  function _openWellnessTipsModal(...args) { return _studentExperience._openWellnessTipsModal?.(...args); }
  function _filterTipsModal(...args) { return _studentExperience._filterTipsModal?.(...args); }
  function _toggleCheckinHistory(...args) { return _studentExperience._toggleCheckinHistory?.(...args); }
  function _renderDailyCheckin(...args) { return _studentExperience._renderDailyCheckin?.(...args); }
  function _submitCheckin(...args) { return _studentExperience._submitCheckin?.(...args); }
  function _showHealthProfileModal(...args) { return _studentExperience._showHealthProfileModal?.(...args); }
  function _refreshSlotsOnTypeChange(...args) { return _studentExperience._refreshSlotsOnTypeChange?.(...args); }
  function _showBookingConfirmModalLegacy(...args) { return _studentExperience._showBookingConfirmModalLegacy?.(...args); }
  function _showBookingConfirmModal(...args) { return _studentExperience._showBookingConfirmModal?.(...args); }
  function _renderSOSButton(...args) { return _studentExperience._renderSOSButton?.(...args); }
  function _showSOSModal(...args) { return _studentExperience._showSOSModal?.(...args); }
  function _dismissFollowUp(...args) { return _studentExperience._dismissFollowUp?.(...args); }
  function _setSurveyRating(...args) { return _studentExperience._setSurveyRating?.(...args); }
  function _enableStudentFloatingStack(...args) { return _studentExperience._enableStudentFloatingStack?.(...args); }
  function _disableStudentFloatingStack(...args) { return _studentExperience._disableStudentFloatingStack?.(...args); }
  function _renderServiceAvailability(...args) { return _studentExperience._renderServiceAvailability?.(...args); }
  function _renderFollowUpBannerComplete(...args) { return _studentExperience._renderFollowUpBannerComplete?.(...args); }
  function _initPostConsultSurvey(...args) { return _studentExperience._initPostConsultSurvey?.(...args); }
  function _skipSurvey(...args) { return _studentExperience._skipSurvey?.(...args); }
  function _submitSurvey(...args) { return _studentExperience._submitSurvey?.(...args); }
  function _addToCalendar(...args) { return _studentExperience._addToCalendar?.(...args); }
  function _filterHistory(...args) { return _studentExperience._filterHistory?.(...args); }
  function showFullHistory(...args) { return _studentExperience.showFullHistory?.(...args); }

  let _lastConsultasFull = [];
  let _lastCitasFull = [];
  let _activeStudentConvId = null;
  let _stuMsgsUnsub = null;
  let _stuConvUnsub = null;
  let _activeConvData = {};
  let _chatTypingTimer = null;
  let _prevUnreadTotal = 0;


  function renderStudentChat(...args) { return _studentChat.renderStudentChat?.(...args); }
  function toggleStudentChat(...args) { return _studentChat.toggleStudentChat?.(...args); }
  function openStudentChat(...args) { return _studentChat.openStudentChat?.(...args); }
  function openStudentThread(...args) { return _studentChat.openStudentThread?.(...args); }
  function _insertQuickReply(...args) { return _studentChat._insertQuickReply?.(...args); }
  function _onChatInputChange(...args) { return _studentChat._onChatInputChange?.(...args); }
  function _closeChatThread(...args) { return _studentChat._closeChatThread?.(...args); }
  function sendStudentMessage(...args) { return _studentChat.sendStudentMessage?.(...args); }
  function startChatWithProfessional(...args) { return _studentChat.startChatWithProfessional?.(...args); }
  function startChatWithStudent(...args) { return _studentChat.startChatWithStudent?.(...args); }
  function showConsultationDetails(...args) { return _studentAppointments.showConsultationDetails?.(...args); }
  function solicitarCancelacion(...args) { return _studentAppointments.solicitarCancelacion?.(...args); }
  function prepararEdicion(...args) { return _studentAppointments.prepararEdicion?.(...args); }
  function _reschedSelectDate(...args) { return _studentAppointments._reschedSelectDate?.(...args); }
  function saveState(...args) { return _studentAppointments.saveState?.(...args); }
  function restoreState(...args) { return _studentAppointments.restoreState?.(...args); }

  // --- MISSING STUDENT FUNCTIONS IMPORTED FROM ADMIN.MEDI.JS ---

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
            <div class="list-group-item list-group-item-action border-0 mb-1 rounded-3 px-3 py-2 cursor-pointer" onclick="Medi.showConsultationDetails('${encodeURIComponent(JSON.stringify(d))}')">
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
            </div>`;
      }).join('');
    });
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
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
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
            <div class="px-4 py-3  border-bottom sticky-top" style="z-index:1020;">
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
    </div>`;

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
            <div class="d-flex align-items-center gap-3 mb-4 p-3  rounded-3 border">
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
                      <div class="d-flex gap-2 justify-content-between text-center -subtle p-2 rounded border mb-4">
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



  // --- CLEANUP / DESTROY ---
  /** Elimina elementos flotantes globales (chat btn, SOS btn, chat panel) */
  function _cleanupGlobalElements() {
    ['medi-chat-float-btn', 'medi-student-chat-panel', 'medi-sos-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    const badge = document.querySelector('.medi-chat-badge-qa');
    if (badge) badge.remove();
    _disableStudentFloatingStack();
  }

  /**
   * Limpia todos los recursos del módulo: listeners, timers y elementos del DOM global.
   * El router llama a Medi.destroy?.() antes de cambiar de vista.
   */
  function destroy() {
    _cleanupListeners();
    _cleanupGlobalElements();
    if (_stuMsgsUnsub) { _stuMsgsUnsub(); _stuMsgsUnsub = null; }
    if (_stuConvUnsub) { _stuConvUnsub(); _stuConvUnsub = null; }
    if (_chatTypingTimer) { clearTimeout(_chatTypingTimer); _chatTypingTimer = null; }
    if (_activeStudentConvId && window.MediChatService?.setTyping) {
      try { MediChatService.setTyping(_ctx, _activeStudentConvId, 'student', false); } catch (_) { }
    }
    _activeStudentConvId = null;
    _activeConvData = {};
  }

  // Escuchar cambios de vista para limpiar elementos globales inmediatamente
  window.addEventListener('sia-view-changed', (e) => {
    if (e.detail && e.detail.viewId !== 'view-medi') {
      _cleanupGlobalElements();
      if (_unsubs.studentChatStream) {
        _unsubs.studentChatStream();
        _unsubs.studentChatStream = null;
      }
      if (_unsubs.studentHistory) {
        _unsubs.studentHistory();
        _unsubs.studentHistory = null;
      }
      if (_stuMsgsUnsub) { _stuMsgsUnsub(); _stuMsgsUnsub = null; }
      if (_stuConvUnsub) { _stuConvUnsub(); _stuConvUnsub = null; }
      if (_chatTypingTimer) { clearTimeout(_chatTypingTimer); _chatTypingTimer = null; }
      if (_activeStudentConvId && window.MediChatService?.setTyping) {
        try { MediChatService.setTyping(_ctx, _activeStudentConvId, 'student', false); } catch (_) { }
      }
      _activeStudentConvId = null;
      _activeConvData = {};
    }
  });

  return {
    initStudent,
    destroy,
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
    openStudentChat,
    openStudentThread,
    sendStudentMessage,
    startChatWithProfessional,
    startChatWithStudent,
    showAllRecentModal,
    showConsultationQuickDetail,
    saveState,
    prepararEdicion,
    solicitarCancelacion,
    showConsultationDetails,
    _reschedSelectDate,
    restoreState,
    // Exported for onclick handlers
    _switchMediTab,
    launchMediTutorial,
    _filterHistory,
    _openWellnessTipsModal,
    _filterTipsModal,
    _focusBookingSection,
    _selectStudentService,
    _refreshSlotsOnTypeChange,
    _showSOSModal,
    _showHealthProfileModal,
    _addToCalendar,
    _submitCheckin,
    _toggleCheckinHistory,
    _dismissFollowUp,
    _setSurveyRating,
    _skipSurvey,
    _submitSurvey,
    _downloadConsultationPrescription,
    renderFollowUpBanner,
    // Chat helpers (used from inline onclick)
    _insertQuickReply,
    _onChatInputChange,
    _closeChatThread
  };


})();

window.Medi = Object.assign(window.Medi || {}, Medi);
console.log("[Medi] Module Loaded & Globalized");
