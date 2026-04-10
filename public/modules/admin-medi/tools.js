// admin.medi.tools.js
if (!window.AdminMedi) window.AdminMedi = {};
window.AdminMedi.Tools = (function () {
  // Sub-module tools
  let _profesionalName = '';
  const isAnonymousConsultation = (item) => !!(item?.isAnonymous || (typeof item?.studentId === 'string' && item.studentId.startsWith('anon_')));
  const getRecentUnsub = () => AdminMedi.State.recentUnsub;
  const setRecentUnsub = (fn) => { AdminMedi.State.recentUnsub = fn; };
  const getRecentFilter = () => AdminMedi.State.recentFilter || 'all';
  const setRecentFilterState = (value) => { AdminMedi.State.recentFilter = value; };
  const resetFollowUpsStat = (value = 0) => {
    const statSeg = document.getElementById('stat-seguimientos');
    if (statSeg) statSeg.textContent = value;
  };
  const resetPatientSearchResults = () => {
    const input = document.getElementById('modal-search-input');
    const results = document.getElementById('modal-search-results');
    if (input) input.value = '';
    if (results) {
      results.innerHTML = `
  <div class="text-center py-4 text-muted small opacity-50">
    <i class="bi bi-person-lines-fill display-6 d-block mb-2"></i>
    <p>Ingresa matrícula o nombre para buscar</p>
  </div>`;
    }
  };
  const hideModalIfOpen = (modalId) => {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    const instance = bootstrap.Modal.getInstance(modalEl);
    if (instance) instance.hide();
  };
  const getOperationalContext = () => AdminMedi.getOperationalContext ? AdminMedi.getOperationalContext() : {
    role: AdminMedi.State.myRole,
    shift: AdminMedi.State.currentShift || null,
    profileId: AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null,
    slotDuration: AdminMedi.State.slotDuration || 60,
    disabledHours: AdminMedi.State.ctx?.config?.medi?.[`disabledHours_${AdminMedi.State.myRole}`] || [],
    availabilityKey: AdminMedi.State.myRole === 'Psicologo'
      ? (AdminMedi.State.currentShift === 'Matutino'
        ? 'availablePsicologoMatutino'
        : (AdminMedi.State.currentShift === 'Vespertino' ? 'availablePsicologoVespertino' : 'availablePsicologo'))
      : 'availableMédico',
    isEnabled: true,
    ownerUid: AdminMedi.State.myUid
  };

  async function enrichStudentData(student) {
    if (!student) return student;

    const uid = student.id || student.uid;
    if (!uid || uid.startsWith('anon_')) return student;

    try {
      const snap = await AdminMedi.State.ctx.db.collection('usuarios').doc(uid).get();
      if (!snap.exists) return student;
      return { ...snap.data(), ...student, id: uid, uid };
    } catch (err) {
      console.warn('Error fetching full patient profile:', err);
      return student;
    }
  }

  function formatShortDate(value, withTime = false) {
    if (!value) return 'Sin fecha';
    const date = MediService.safeDate ? MediService.safeDate(value) : new Date(value);
    if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
    const opts = withTime
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-MX', opts);
  }

  function renderQuickPauseStatus() {
    const el = document.getElementById('medi-quick-pause-status');
    if (!el) return;

    const operational = getOperationalContext();
    const pauseUntil = operational.pauseUntil || MediService.getPauseUntilForContext(
      AdminMedi.State.ctx?.config?.medi || {},
      operational.role,
      operational.shift,
      operational.profileId
    );

    if (pauseUntil) {
      el.innerHTML = `<span class="text-warning fw-bold"><i class="bi bi-pause-circle me-1"></i>Pausada hasta ${pauseUntil.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>`;
      return;
    }

    el.innerHTML = '<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Agenda activa para citas nuevas.</span>';
  }

  async function pauseScheduleFor(minutes) {
    const operational = getOperationalContext();
    const duration = parseInt(minutes, 10);
    if (!duration || duration <= 0) return;

    try {
      const key = MediService.getPauseUntilKeyForContext(operational.role, operational.shift, operational.profileId);
      const pauseUntil = new Date(Date.now() + duration * 60000);
      const updateData = { [key]: pauseUntil.toISOString() };

      await MediService.updateConfig(AdminMedi.State.ctx, updateData);

      if (!AdminMedi.State.ctx.config) AdminMedi.State.ctx.config = {};
      if (!AdminMedi.State.ctx.config.medi) AdminMedi.State.ctx.config.medi = {};
      Object.assign(AdminMedi.State.ctx.config.medi, updateData);

      showToast(`Agenda pausada por ${duration} min.`, 'warning');
      renderQuickPauseStatus();
      AdminMedi.refreshAdmin?.();
    } catch (err) {
      console.error(err);
      showToast('No se pudo pausar la agenda.', 'danger');
    }
  }

  async function clearQuickPause() {
    const operational = getOperationalContext();

    try {
      const key = MediService.getPauseUntilKeyForContext(operational.role, operational.shift, operational.profileId);
      const updateData = { [key]: null };

      await MediService.updateConfig(AdminMedi.State.ctx, updateData);

      if (!AdminMedi.State.ctx.config) AdminMedi.State.ctx.config = {};
      if (!AdminMedi.State.ctx.config.medi) AdminMedi.State.ctx.config.medi = {};
      Object.assign(AdminMedi.State.ctx.config.medi, updateData);

      showToast('Agenda reanudada.', 'success');
      renderQuickPauseStatus();
      AdminMedi.refreshAdmin?.();
    } catch (err) {
      console.error(err);
      showToast('No se pudo reanudar la agenda.', 'danger');
    }
  }

  function renderPriorityActions() {
    const container = document.getElementById('medi-priority-actions');
    if (!container) return;

    const waiting = Array.isArray(AdminMedi.State.waitingRoomItems) ? AdminMedi.State.waitingRoomItems.slice() : [];
    const agenda = Array.isArray(AdminMedi.State.agendaItems) ? AdminMedi.State.agendaItems.slice() : [];
    const followUps = Array.isArray(AdminMedi.State.followUpItems) ? AdminMedi.State.followUpItems.slice() : [];
    const unread = parseInt(document.getElementById('badge-unread-msgs')?.textContent || '0', 10) || 0;

    waiting.sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0));
    agenda.sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0));
    followUps.sort((a, b) => {
      const dateA = MediService.safeDate ? MediService.safeDate(a.followUpDate) : new Date(a.followUpDate || 0);
      const dateB = MediService.safeDate ? MediService.safeDate(b.followUpDate) : new Date(b.followUpDate || 0);
      return (dateA || 0) - (dateB || 0);
    });

    const nextAgenda = agenda.find((item) => item?.id);
    const nextWaiting = waiting[0] || null;
    const nextFollowUp = followUps[0] || null;
    const items = [];

    if (nextWaiting) {
      items.push({
        icon: 'bi-person-raised-hand',
        color: 'danger',
        title: nextWaiting.studentName || 'Paciente en espera',
        meta: `${formatShortDate(nextWaiting.safeDate, true)} · Sala de espera`,
        detail: nextWaiting.motivo || 'Pendiente por atender',
        primary: `<button class="btn btn-sm btn-danger rounded-pill px-3 fw-bold" onclick="AdminMedi.tomarPaciente('${nextWaiting.id}')"><i class="bi bi-play-fill me-1"></i>Tomar turno</button>`,
        secondary: nextWaiting.studentId ? `<button class="btn btn-sm btn-outline-dark rounded-pill px-3" onclick="AdminMedi.showFullRecord('${nextWaiting.studentId}')">Expediente</button>` : ''
      });
    }

    if (nextAgenda) {
      const citaEnc = encodeURIComponent(JSON.stringify(nextAgenda));
      items.push({
        icon: 'bi-calendar-check',
        color: 'primary',
        title: nextAgenda.studentName || 'Siguiente consulta',
        meta: `${formatShortDate(nextAgenda.safeDate, true)} · Agenda`,
        detail: nextAgenda.motivo || 'Consulta programada',
        primary: `<button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="AdminMedi.iniciarConsulta('${citaEnc}')"><i class="bi bi-play-fill me-1"></i>Iniciar consulta</button>`,
        secondary: nextAgenda.studentId ? `<button class="btn btn-sm btn-outline-dark rounded-pill px-3" onclick="AdminMedi.showFullRecord('${nextAgenda.studentId}')">Expediente</button>` : ''
      });
    }

    if (nextFollowUp) {
      const encodedStudent = encodeURIComponent(JSON.stringify({
        uid: nextFollowUp.studentId,
        id: nextFollowUp.studentId,
        email: nextFollowUp.studentEmail || '',
        displayName: nextFollowUp.studentName || 'Paciente'
      }));
      items.push({
        icon: 'bi-arrow-repeat',
        color: 'warning',
        title: nextFollowUp.studentName || 'Seguimiento pendiente',
        meta: `${formatShortDate(nextFollowUp.followUpDate)} · Seguimiento`,
        detail: nextFollowUp.followUpNotes || nextFollowUp.diagnostico || 'Revisar seguimiento',
        primary: nextFollowUp.studentId ? `<button class="btn btn-sm btn-warning rounded-pill px-3 fw-bold" onclick="AdminMedi.showFullRecord('${nextFollowUp.studentId}')"><i class="bi bi-eye me-1"></i>Revisar</button>` : '',
        secondary: nextFollowUp.studentId ? `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="AdminMedi.openManualBooking(null, '${encodedStudent}')">Reservar cita</button>` : ''
      });
    }

    if (unread > 0) {
      items.push({
        icon: 'bi-chat-dots',
        color: 'secondary',
        title: `${unread} mensaje${unread === 1 ? '' : 's'} sin leer`,
        meta: 'Mensajes',
        detail: 'Revisa conversaciones pendientes con estudiantes.',
        primary: `<button class="btn btn-sm btn-dark rounded-pill px-3 fw-bold" onclick="AdminMedi.openMessagesModal()"><i class="bi bi-chat-dots me-1"></i>Abrir mensajes</button>`,
        secondary: ''
      });
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="medi-empty-state py-4">
          <i class="bi bi-check2-circle"></i>
          <p>No hay acciones urgentes por ahora.</p>
        </div>`;
      return;
    }

    container.innerHTML = items.slice(0, 4).map((item) => `
      <div class="border rounded-4 p-3 mb-3 bg-white shadow-sm">
        <div class="d-flex align-items-start gap-3">
          <div class="rounded-circle d-flex align-items-center justify-content-center bg-${item.color}-subtle text-${item.color}" style="width:42px;height:42px;">
            <i class="bi ${item.icon}"></i>
          </div>
          <div class="flex-fill">
            <div class="fw-bold text-dark">${escapeHtml(item.title)}</div>
            <div class="small text-muted mb-1">${escapeHtml(item.meta)}</div>
            <div class="small text-dark">${escapeHtml(item.detail)}</div>
            <div class="d-flex flex-wrap gap-2 mt-3">
              ${item.primary}
              ${item.secondary}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderWaitingRoomDashboardPanel(items = AdminMedi.State.waitingRoomItems || []) {
    const container = document.getElementById('medi-waiting-room-list');
    const countEl = document.getElementById('medi-waiting-room-count');
    if (countEl) countEl.textContent = items.length;
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="medi-empty-state py-4">
          <i class="bi bi-cup-hot"></i>
          <p>Sala vacía por ahora.</p>
        </div>`;
      return;
    }

    container.innerHTML = items.map((c, idx) => {
      const fecha = c.safeDate || new Date();
      const timeStr = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const dayStr = formatShortDate(fecha, false);
      const prioridad = c.prioridad || 'normal';
      const priorityBadge = prioridad === 'urgente'
        ? '<span class="badge bg-danger" style="font-size:.6rem;">URGENTE</span>'
        : (prioridad === 'seguimiento'
          ? '<span class="badge bg-warning text-dark" style="font-size:.6rem;">SEGUIMIENTO</span>'
          : '<span class="badge bg-light text-secondary border" style="font-size:.6rem;">EN ESPERA</span>');
      const reentryBadge = c.reentrada ? '<span class="badge bg-info text-dark" style="font-size:.6rem;">Reagendada</span>' : '';

      let rawMotivo = c.motivo || 'Consulta general';
      rawMotivo = rawMotivo.replace(/^\[.*?\]\s*/, '');

      return `
        <div class="border rounded-4 p-3 mb-2 bg-white shadow-sm">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
            <div>
              <div class="fw-bold text-dark">${escapeHtml(c.studentName || 'Estudiante')}</div>
              <div class="small text-muted">${escapeHtml(dayStr)} · ${escapeHtml(timeStr)}</div>
            </div>
            <div class="d-flex flex-wrap gap-1 justify-content-end">
              ${priorityBadge}
              ${reentryBadge}
            </div>
          </div>
          <div class="small text-dark mb-3">${escapeHtml(rawMotivo.substring(0, 60))}</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold" onclick="AdminMedi.showFullRecord('${escapeHtml(c.studentId || '')}')">
              <i class="bi bi-folder2-open me-1"></i>Expediente
            </button>
            <button class="btn btn-sm btn-danger rounded-pill px-3 fw-bold" onclick="AdminMedi.tomarPaciente('${c.id}')">
              <i class="bi bi-play-fill me-1"></i>Tomar turno
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function renderInsightList(containerId, items, mode = 'recent') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div class="medi-empty-state py-4">
          <i class="bi bi-person-lines-fill"></i>
          <p>Sin datos suficientes todavía.</p>
        </div>`;
      return;
    }

    container.innerHTML = items.map((item) => {
      const patientKey = item.uid || item.id;
      if (patientKey) window.AdminMedi._patientCache.set(patientKey, { ...item, id: patientKey, uid: patientKey });

      const meta = mode === 'frequent'
        ? `${item.totalVisits || 1} consulta${(item.totalVisits || 1) === 1 ? '' : 's'} · ${formatShortDate(item.lastDate)}`
        : `${formatShortDate(item.lastDate)} · ${item.matricula || 'Sin matrícula'}`;

      return `
        <div class="border rounded-4 p-3 mb-3 bg-white shadow-sm">
          <div class="d-flex align-items-start gap-3">
            <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:42px;height:42px;">
              <span class="fw-bold text-primary">${escapeHtml((item.displayName || 'E')[0])}</span>
            </div>
            <div class="flex-fill" style="min-width:0;">
              <div class="fw-bold text-dark text-truncate">${escapeHtml(item.displayName || item.email || 'Paciente')}</div>
              <div class="small text-muted text-truncate mb-1">${escapeHtml(meta)}</div>
              <div class="small text-dark text-truncate">${escapeHtml(item.diagnosis || 'Sin diagnóstico reciente')}</div>
              <div class="d-flex flex-wrap gap-2 mt-3">
                <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="AdminMedi.startWalkIn('${patientKey}')"><i class="bi bi-lightning-charge me-1"></i>Atender</button>
                <button class="btn btn-sm btn-outline-dark rounded-pill px-3" onclick="AdminMedi.showFullRecord('${patientKey}')">Expediente</button>
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="AdminMedi.openManualBooking('${patientKey}')">Reservar cita</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadPatientInsights() {
    const operational = getOperationalContext();
    const recentEl = document.getElementById('medi-patients-recent');
    const frequentEl = document.getElementById('medi-patients-frequent');
    if (!recentEl && !frequentEl) return;

    try {
      const insights = await MediService.getPatientInsights(
        AdminMedi.State.ctx,
        operational.role,
        operational.ownerUid,
        operational.profileId,
        operational.shift,
        5
      );

      renderInsightList('medi-patients-recent', insights.recent || [], 'recent');
      renderInsightList('medi-patients-frequent', insights.frequent || [], 'frequent');
    } catch (err) {
      console.warn('Error loading patient insights:', err);
      if (recentEl) recentEl.innerHTML = '<div class="text-muted small text-center py-4">No se pudieron cargar pacientes recientes.</div>';
      if (frequentEl) frequentEl.innerHTML = '<div class="text-muted small text-center py-4">No se pudieron cargar pacientes frecuentes.</div>';
    }
  }

  function renderSearchResultCard(student) {
    const safeStudent = { ...student, uid: student.uid || student.id, id: student.id || student.uid };
    const encoded = encodeURIComponent(JSON.stringify(safeStudent));
    const patientKey = safeStudent.id || safeStudent.uid;
    if (patientKey) window.AdminMedi._patientCache.set(patientKey, safeStudent);

    return `
      <div class="list-group-item border-0 rounded-4 mb-2 p-3 shadow-sm bg-white">
        <div class="d-flex align-items-center gap-3">
          <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:42px;height:42px;">
            <span class="fw-bold text-primary">${escapeHtml((safeStudent.displayName || 'E')[0].toUpperCase())}</span>
          </div>
          <div class="flex-fill" style="min-width:0;">
            <h6 class="fw-bold mb-0 text-dark text-truncate">${escapeHtml(safeStudent.displayName || safeStudent.email)}</h6>
            <small class="text-muted text-truncate d-block">${escapeHtml(safeStudent.matricula || '')} • ${escapeHtml(safeStudent.carrera || '')}</small>
          </div>
          <button class="btn btn-sm btn-light rounded-pill px-3" onclick="AdminMedi.showPatientFoundModal(JSON.parse(decodeURIComponent('${encoded}')))">Ver</button>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="bootstrap.Modal.getInstance(document.getElementById('modalSearchPatient'))?.hide(); setTimeout(() => AdminMedi.startWalkIn('${patientKey}'), 120);">
            <i class="bi bi-lightning-charge me-1"></i>Atender
          </button>
          <button class="btn btn-sm btn-outline-dark rounded-pill px-3" onclick="bootstrap.Modal.getInstance(document.getElementById('modalSearchPatient'))?.hide(); setTimeout(() => AdminMedi.showFullRecord('${patientKey}'), 120);">
            Expediente
          </button>
          <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="bootstrap.Modal.getInstance(document.getElementById('modalSearchPatient'))?.hide(); setTimeout(() => AdminMedi.openManualBooking('${patientKey}'), 120);">
            Reservar cita
          </button>
        </div>
      </div>
    `;
  }

  function loadWall() {
    const list = document.getElementById('medi-muro-list');
    if (!list) return;

    // Filter Logic in Stream Callback or Post-Process?
    // Stream returns all for role. We accept that for realsies.

    // Cleanup previous listener to prevent duplicates
    if (AdminMedi.State.unsubs.wall) AdminMedi.State.unsubs.wall();

    const operational = getOperationalContext();
    const unsub = MediService.streamSalaEspera(AdminMedi.State.ctx, operational.role, operational.shift, (docs) => {

      // Client-Side Filter if needed
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // 1. Descartar cualquier cita "Pendiente" de días anteriores a HOY (expiaración a medianoche)
      docs = docs.filter(d => {
        if (!d.safeDate) return false;
        const fDate = new Date(d.safeDate);
        fDate.setHours(0, 0, 0, 0);
        return fDate >= now; // Solo hoy o futuros
      });

      if (AdminMedi.State.waitingRoomFilter !== 'all') {
        if (AdminMedi.State.waitingRoomFilter === 'new') {
          docs = docs.filter(d => !d.reentrada);
        } else if (AdminMedi.State.waitingRoomFilter === 'returned') {
          docs = docs.filter(d => d.reentrada);
        }
      }

      const badge = document.getElementById('badge-sala-espera');
      if (badge) badge.textContent = `${docs.length} en espera`;

      const modalUpdateSync = () => {
        const modalTarget = document.getElementById('modal-muro-list');
        const modalEl = document.getElementById('modalWaitingRoom');
        if (modalTarget && modalEl && modalEl.classList.contains('show')) {
          modalTarget.innerHTML = list.innerHTML;
        }
      };

      if (docs.length === 0) {
        AdminMedi.State.waitingRoomItems = [];
        renderPriorityActions();
        renderWaitingRoomDashboardPanel([]);
        list.innerHTML = '<div class="text-center py-5 text-muted small"><i class="bi bi-cup-hot display-4 d-block mb-2"></i>Sin pacientes en espera.</div>';
        modalUpdateSync();
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
      AdminMedi.State.waitingRoomItems = docs.slice();
      renderPriorityActions();
      renderWaitingRoomDashboardPanel(docs);

      const nowExact = new Date();
      list.innerHTML = docs.map((c, idx) => {
        const fecha = c.safeDate || new Date();
        const esReentrada = c.reentrada === true;
        const isLactario = c.linkedLactarioId || c.sourceModule === 'lactario' || (c.motivo && (c.motivo.includes('Lactancia') || c.motivo.includes('Lactario')));
        const prio = c.prioridad || 'normal';

        const timeStr = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const diffMinutes = (fecha - nowExact) / 60000;
        const dateISO = MediService.toISO(fecha);
        const todayISO = MediService.toISO(nowExact);

        // Clean Prefix
        let rawMotivo = c.motivo || 'Consulta General';
        rawMotivo = rawMotivo.replace(/^\[.*?\]\s*/, '');
        const motivoPreview = escapeHtml(rawMotivo.substring(0, 60));

        let lastDateLabel = '';
        let dateLabel = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
        if (dateISO === todayISO) dateLabel = 'Hoy';
        else if (dateISO === MediService.toISO(new Date(now.getTime() + 86400000))) dateLabel = 'Ma\u00f1ana';

        let timeRemaining = '';
        if (diffMinutes > 0) {
          const m = Math.floor(diffMinutes);
          if (m > 1440) timeRemaining = `Faltan ${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
          else if (m > 60) timeRemaining = `Faltan ${Math.floor(m / 60)}h ${m % 60}m`;
          else timeRemaining = `Faltan ${m}m`;
        } else if (diffMinutes < -1) {
          const m = Math.abs(Math.floor(diffMinutes));
          if (m > 60) timeRemaining = `Retrasada ${Math.floor(m / 60)}h ${m % 60}m`;
          else timeRemaining = `Retrasada ${m}m`;
        } else {
          timeRemaining = `En Turno`;
        }

        // Priority styling
        let accentColor = '#0d6efd'; // blue default
        let accentBg = 'bg-primary-subtle';
        let prioLabel = '';
        if (prio === 'urgente') { accentColor = '#dc3545'; accentBg = 'bg-danger-subtle'; prioLabel = '<span class="badge bg-danger ms-2" style="font-size:.6rem;">URGENTE</span>'; }
        else if (prio === 'seguimiento') { accentColor = '#ffc107'; accentBg = 'bg-warning-subtle'; prioLabel = '<span class="badge bg-warning text-dark ms-2" style="font-size:.6rem;">SEGUIMIENTO</span>'; }
        if (esReentrada) prioLabel += '<span class="badge bg-info text-dark ms-1" style="font-size:.6rem;">Reagendada</span>';
        if (isLactario) prioLabel = '<span class="badge bg-danger text-white ms-2" style="font-size:.6rem;">LACTARIO</span>';

        // Encode data
        const studentData = encodeURIComponent(JSON.stringify({
          uid: c.studentId, email: c.studentEmail, displayName: c.studentName,
          tipoSangre: c.tipoSangre, alergias: c.alergias
        }));

        let timeBadgeClass = diffMinutes < -15 ? 'bg-danger-subtle text-danger border-danger-subtle' :
          diffMinutes <= 15 ? 'bg-success-subtle text-success border-success-subtle' :
            ' text-secondary border-secondary-subtle';

        return `
  <div class="card border-0 shadow-sm rounded-4 mb-2 overflow-hidden bg-white" style = "border-left: 4px solid ${accentColor} !important;" >
    <div class="card-body p-3">
      <div class="d-flex align-items-start gap-3">
        <!-- Time Block -->
        <div class="d-flex flex-column align-items-center flex-shrink-0" style="min-width:60px;">
          <div class="fw-bold text-dark" style="font-size:1.1rem;line-height:1;">${timeStr}</div>
          <div class="text-muted fw-semibold" style="font-size:0.75rem;">${dateLabel}</div>
        </div>

        <!-- Info -->
        <div class="flex-grow-1" style="min-width:0; padding-left: 10px; border-left: 1px solid #eee;">
          <div class="d-flex align-items-center mb-1">
            <h6 class="fw-bold text-dark mb-0 text-truncate" style="font-size: 0.95rem;">${escapeHtml(c.studentName || 'Estudiante')}</h6>
            ${prioLabel}
          </div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="text-dark small flex-fill text-truncate" style="font-size: 0.85rem;">${motivoPreview}</span>
          </div>
          <div class="d-flex align-items-center gap-1">
            <span class="badge border px-2 ${timeBadgeClass}" style="font-size: 0.65rem;">
                <i class="bi bi-clock me-1"></i>${timeRemaining}
            </span>
            <span class="text-muted small fw-bold opacity-50 ms-auto">#${idx + 1}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="d-flex flex-wrap gap-2 mt-3 pt-3 border-top justify-content-between">
        <button class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center" onclick="AdminMedi.rechazarCita('${c.id}')" title="Rechazar" style="font-size: 0.75rem;">
          <i class="bi bi-x-circle me-1"></i>Rechazar
        </button>
        <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center" style="font-size: 0.75rem;" onclick="AdminMedi.showPatientFoundModal(JSON.parse(decodeURIComponent('${studentData}')))" title="Ver perfil">
              <i class="bi bi-person-lines-fill me-1"></i>Perfil
            </button>
            ${isLactario ? `
              <button class="btn btn-danger btn-sm rounded-pill px-3 fw-bold shadow-sm d-flex align-items-center" style="font-size: 0.75rem;" onclick="AdminMedi.validarAcompañamiento('${c.id}')">
                <i class="bi bi-check-circle-fill me-1"></i>Validar
              </button>
            ` : `
              <button class="btn btn-primary btn-sm rounded-pill px-3 fw-bold shadow-sm d-flex align-items-center" style="font-size: 0.75rem;" onclick="AdminMedi.tomarPaciente('${c.id}')">
                <i class="bi bi-calendar-check me-1"></i>Tomar turno
              </button>
            `}
        </div>
      </div>
    </div>
  </div>`;
      }).join('');

      modalUpdateSync();
    });
    AdminMedi.State.unsubs.wall = unsub;
  }

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
    AdminMedi.State.waitingRoomFilter = filter;
    loadWall(); // Trigger re-render
  }

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
      const found = await MediService.buscarPaciente(AdminMedi.State.ctx, query);

      if (!found) {
        // Also try a broader name search (case-insensitive workaround)
        let nameResults = [];
        try {
          // Prefix range queries — max 4 Firestore reads, no bulk collection download
          // Replace previous limit(150) approach that exposed all user data to the client.
          const prefixSnap = await AdminMedi.State.ctx.db.collection('usuarios')
              .where('displayName', '>=', query)
              .where('displayName', '<=', query + '\uf8ff')
              .limit(5)
              .get();
          nameResults = prefixSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));

          // Attempt B: Title Case if no results ('juan' → 'Juan')
          if (nameResults.length === 0) {
            const titleQ = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
            if (titleQ !== query) {
              const titleSnap = await AdminMedi.State.ctx.db.collection('usuarios')
                  .where('displayName', '>=', titleQ)
                  .where('displayName', '<=', titleQ + '\uf8ff')
                  .limit(5)
                  .get();
              nameResults = titleSnap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
            }
          }

        } catch (e) { console.warn('Name search error:', e); }

        if (nameResults.length > 0) {
          // Show multiple results
          if (modalResults) {
            modalResults.innerHTML = nameResults.map(renderSearchResultCard).join('');
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
        AdminMedi.State.foundPatient = found;
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

  async function showPatientFoundModal(student) {
    student = await enrichStudentData(student);

    hideModalIfOpen('modalSearchPatient');
    resetPatientSearchResults();

    // Cache patient for safe onclick references
    const patientKey = student.id || student.uid;
    if (patientKey) window.AdminMedi._patientCache.set(patientKey, student);

    const _esc = typeof escapeHtml === 'function' ? escapeHtml : (s => String(s || '--').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));

    // Extractor helpers for deep data
    const getDeep = (obj, path, fallback = '--') => {
      let current = obj;
      for (let key of path.split('.')) {
        if (current == null) return fallback;
        current = current[key];
      }
      return current != null && current !== '' ? current : fallback;
    };

    const telefono = getDeep(student, 'telefono') !== '--' ? getDeep(student, 'telefono') : getDeep(student, 'personalData.telefono', '--');
    const emergencia = getDeep(student, 'emergencia') !== '--' ? getDeep(student, 'emergencia') : getDeep(student, 'personalData.telefonoEmergencia', '--');

    const profilePic = student.photoURL
      ? `<img src="${_esc(student.photoURL)}" class="rounded-circle shadow-sm" style="width:100px; height:100px; object-fit:cover; border: 4px solid white;">`
      : `<div class="rounded-circle shadow-sm d-flex align-items-center justify-content-center mx-auto" style="width: 100px; height: 100px; font-size: 2.5rem; border: 4px solid white; background:#f0f2f5; color:#6c757d;">${student.displayName ? _esc(student.displayName.charAt(0).toUpperCase()) : '?'}</div>`;

    let html = `
  <div class="modal-dialog modal-dialog-centered modal-lg" >
    <div class="modal-content rounded-4 shadow-lg border-0">
      <div class="modal-header border-0 pb-0">
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-4 pt-0">
        <!-- HEADER CONTEXTO -->
        <div class="text-center mb-4">
          <div class="position-relative d-inline-block mx-auto mb-3">
            ${profilePic}
          </div>
          <h4 class="fw-bold text-dark mb-1">${_esc(student.displayName)}</h4>
          <div class="text-muted small">${_esc(student.matricula || student.email)}</div>
        </div>

        <!-- CONTACTO EXTRA -->
        <div class="d-flex justify-content-center gap-4 mb-4 small">
            <div class="text-center text-muted"><i class="bi bi-telephone-fill me-1"></i> Tel: <span class="fw-semibold text-dark">${_esc(telefono)}</span></div>
            <div class="text-center text-muted"><i class="bi bi-heart-pulse-fill me-1 text-danger"></i> SOS: <span class="fw-semibold text-dark">${_esc(emergencia)}</span></div>
        </div>

        <!-- GRID DE DATOS -->
        <div class="row g-3 mb-4">
          <div class="col-md-3 col-6">
            <div class="p-3 shadow-none rounded-4 text-center border h-100" style="background:#f8f9fa;">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Edad</div>
              <div class="fw-bold fs-5 text-dark">${_esc(student.edad || MediService.calculateAge(student.fechaNacimiento) || '--')}</div>
              <div class="extra-small text-muted">años</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="p-3 shadow-none rounded-4 text-center border h-100" style="background:#f8f9fa;">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Sangre</div>
              <div class="fw-bold fs-5 text-danger">${_esc(student.tipoSangre || getDeep(student, 'personalData.tipoSangre') || '--')}</div>
              <div class="extra-small text-muted">Tipo</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="p-3 shadow-none rounded-4 text-center border h-100" style="background:#f8f9fa;">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Género</div>
              <div class="fw-bold fs-5 text-dark">${_esc((student.genero || getDeep(student, 'personalData.genero') || student.sexo || '-').charAt(0))}</div>
              <div class="extra-small text-muted text-truncate">${_esc(student.genero || getDeep(student, 'personalData.genero') || student.sexo || '--')}</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="p-3 shadow-none rounded-4 text-center border h-100" style="background:#f8f9fa;">
              <div class="extra-small fw-bold text-muted text-uppercase mb-1">Carrera</div>
              <div class="fw-bold fs-5 text-primary"><i class="bi bi-mortarboard-fill"></i></div>
              <div class="extra-small text-muted text-truncate" title="${_esc(student.carrera || getDeep(student, 'academicData.carrera') || 'General')}">${_esc(student.carrera || getDeep(student, 'academicData.carrera') || 'General')}</div>
            </div>
          </div>
        </div>
        
        <!-- ESTADISTICAS -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-lg-3">
             <div class="p-2 pt-3 rounded-4 border text-center position-relative h-100">
                <div class="text-muted extra-small fw-bold text-uppercase mb-1">Consultas Previas</div>
                <div class="fs-4 fw-bold text-dark" id="modal-patient-consultas-count"><span class="spinner-border spinner-border-sm text-muted"></span></div>
             </div>
          </div>
          <div class="col-6 col-lg-3">
             <div class="p-2 pt-3 rounded-4 border text-center position-relative h-100">
                <div class="text-muted extra-small fw-bold text-uppercase mb-1">Citas Activas</div>
                <div class="fs-4 fw-bold text-dark" id="modal-patient-citas-count"><span class="spinner-border spinner-border-sm text-muted"></span></div>
             </div>
          </div>
          <div class="col-6 col-lg-3">
             <div class="p-2 pt-3 rounded-4 border text-center position-relative h-100">
                <div class="text-muted extra-small fw-bold text-uppercase mb-1">Ultima Atencion</div>
                <div class="fw-bold text-dark" id="modal-patient-last-visit"><span class="spinner-border spinner-border-sm text-muted"></span></div>
                <div class="extra-small text-muted mt-1" id="modal-patient-last-visit-meta">Sin datos</div>
             </div>
          </div>
          <div class="col-6 col-lg-3">
             <div class="p-2 pt-3 rounded-4 border text-center position-relative h-100">
                <div class="text-muted extra-small fw-bold text-uppercase mb-1">Inasistencias</div>
                <div class="fs-4 fw-bold text-dark" id="modal-patient-noshow-count"><span class="spinner-border spinner-border-sm text-muted"></span></div>
             </div>
          </div>
        </div>

        <!-- ALERTAS -->
        ${(student.alergias || getDeep(student, 'personalData.alergias')) && (student.alergias || getDeep(student, 'personalData.alergias')).toLowerCase() !== 'ninguna' && (student.alergias || getDeep(student, 'personalData.alergias')).toLowerCase() !== 'no' && (student.alergias || getDeep(student, 'personalData.alergias')).toLowerCase() !== 'sin alergias' ? `
        <div class="py-2 px-3 alert-danger border-0 rounded-pill d-flex align-items-center mb-4 text-center justify-content-center small shadow-sm">
          <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
          <span class="fw-bold text-danger me-2">Alergias:</span> 
          <span class="text-dark text-truncate" style="max-width: 250px;" title="${_esc(student.alergias || getDeep(student, 'personalData.alergias'))}">${_esc(student.alergias || getDeep(student, 'personalData.alergias'))}</span>
        </div>` : ''}

        <!-- ACCIONES -->
        <div class="row g-2">
          <div class="col-12 mb-2">
            <button class="btn btn-primary w-100 rounded-pill py-3 fw-bold fs-5 shadow-sm hover-scale"
              onclick="if(AdminMedi && AdminMedi.startWalkIn) AdminMedi.startWalkIn('${_esc(patientKey)}')">
              <i class="bi bi-lightning-charge-fill me-2"></i>Atender Ahora
            </button>
          </div>
          <div class="col-md-6">
            <button class="btn btn-outline-dark w-100 rounded-pill py-2 fw-bold" onclick="AdminMedi.showFullRecord('${_esc(patientKey)}')">
               <i class="bi bi-folder2-open me-2"></i>Expediente
            </button>
          </div>
          <div class="col-md-6">
            <button class="btn btn-outline-primary w-100 rounded-pill py-2 fw-bold"
              onclick="bootstrap.Modal.getInstance(document.getElementById('modalPatientFound')).hide(); AdminMedi.openManualBooking('${_esc(patientKey)}')">
              <i class="bi bi-calendar-plus me-2"></i>Reservar Cita
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;

    const modalEl = document.getElementById('modalPatientFound');
    if (!modalEl) return;
    modalEl.innerHTML = html;

    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    // Async Fetch Statistics
    _fetchPatientStats(patientKey);
  }

  async function _fetchPatientStats(uid) {
    if (!uid) return;
    try {
      // Consultas (From 'expedientes' collection -> 'consultas' subcollection)
      const expSnap = await AdminMedi.State.ctx.db.collection('expedientes-clinicos').doc(uid).collection('consultas').get();
      const consCount = document.getElementById('modal-patient-consultas-count');
      if (consCount) consCount.innerHTML = expSnap.empty ? '0' : expSnap.size;

      const sortedConsultas = expSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), safeDate: MediService.safeDate(doc.data().createdAt || doc.data().fechaConsulta) }))
        .sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));

      const lastVisit = sortedConsultas[0] || null;
      const lastVisitEl = document.getElementById('modal-patient-last-visit');
      const lastVisitMetaEl = document.getElementById('modal-patient-last-visit-meta');
      if (lastVisitEl) {
        lastVisitEl.innerHTML = lastVisit?.safeDate
          ? lastVisit.safeDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          : '--';
      }
      if (lastVisitMetaEl) {
        lastVisitMetaEl.textContent = lastVisit?.safeDate
          ? `${lastVisit.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${lastVisit.profesionalName || lastVisit.tipoServicio || 'Consulta'}`
          : 'Sin consultas';
      }

      // Citas activas/agendadas (exclude old canceled/finalized records)
      const citasSnap = await AdminMedi.State.ctx.db.collection('citas-medi').where('studentId', '==', uid).get();
      const citasCount = document.getElementById('modal-patient-citas-count');
      const noShowCountEl = document.getElementById('modal-patient-noshow-count');
      if (citasCount) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const activeCount = citasSnap.docs.filter((doc) => {
          const data = doc.data();
          if (!['pendiente', 'confirmada', 'en_proceso'].includes(data.estado)) return false;
          const slotDate = MediService.safeDate(data.fechaHoraSlot || data.fechaSolicitud);
          return !slotDate || slotDate >= startOfDay;
        }).length;
        citasCount.innerHTML = String(activeCount);
      }

      if (noShowCountEl) {
        const noShowCount = citasSnap.docs.filter((doc) => {
          const data = doc.data() || {};
          return data.noShow === true || /no asist/i.test(String(data.motivoCancelacion || ''));
        }).length;
        noShowCountEl.innerHTML = String(noShowCount);
      }

    } catch (e) {
      console.warn("Error fetching patient stats", e);
      const consCount = document.getElementById('modal-patient-consultas-count');
      const citasCount = document.getElementById('modal-patient-citas-count');
      const lastVisitEl = document.getElementById('modal-patient-last-visit');
      const lastVisitMetaEl = document.getElementById('modal-patient-last-visit-meta');
      const noShowCountEl = document.getElementById('modal-patient-noshow-count');
      if (consCount) consCount.innerHTML = '--';
      if (citasCount) citasCount.innerHTML = '--';
      if (lastVisitEl) lastVisitEl.innerHTML = '--';
      if (lastVisitMetaEl) lastVisitMetaEl.textContent = 'Sin datos';
      if (noShowCountEl) noShowCountEl.innerHTML = '--';
    }
  }

  function startWalkIn(encodedStudent) {
    let student;
    // Try cache first, then fallback to encoded JSON
    if (window.AdminMedi._patientCache && window.AdminMedi._patientCache.has(encodedStudent)) {
      student = window.AdminMedi._patientCache.get(encodedStudent);
    } else {
      student = JSON.parse(decodeURIComponent(encodedStudent));
    }

    // Attempt to close search modals if they exist
    const modalEl = document.getElementById('modalPatientFound');
    if (modalEl) {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
    }

    // [FIX] Forward to Consultas namespace correctly
    if (AdminMedi && AdminMedi.Consultas && AdminMedi.Consultas.iniciarConsulta) {
      AdminMedi.Consultas.iniciarConsulta(null, encodeURIComponent(JSON.stringify(student)));
    } else {
      console.error("AdminMedi.Consultas.iniciarConsulta is not defined");
      showToast('Error interno: Módulo de consultas no disponible.', 'danger');
    }
  }

  async function loadDayMetrics() {
    const container = document.getElementById('medi-day-stats');
    if (!container) return;

    resetFollowUpsStat(0);
    renderQuickPauseStatus();
    container.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

    try {
      const operational = getOperationalContext();
      const stats = await MediService.getDayStats(
        AdminMedi.State.ctx,
        operational.role,
        operational.ownerUid,
        operational.profileId,
        operational.shift
      );

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
  <div class="row g-2 mb-3">
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
        </div>

        <!--Top Diagnoses-->
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
      renderPriorityActions();
    } catch (err) {
      console.warn('[medi] loadDayMetrics error:', err);
      resetFollowUpsStat(0);
      container.innerHTML = '<div class="text-center py-3 text-muted small">No se pudieron cargar metricas</div>';
    }
  }

  async function _loadFollowUps() {
    const container = document.getElementById('medi-followups-list');
    if (!container) return;
    try {
      const operational = getOperationalContext();
      const followUps = await MediService.getFollowUps(
        AdminMedi.State.ctx,
        operational.role,
        operational.ownerUid,
        operational.profileId,
        operational.shift
      );
      AdminMedi.State.followUpItems = followUps.slice();
      if (followUps.length === 0) {
        resetFollowUpsStat(0);
        container.innerHTML = '';
        renderPriorityActions();
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pending = followUps
        .slice()
        .sort((a, b) => {
          const dateA = a.followUpDate ? new Date(a.followUpDate).getTime() : 0;
          const dateB = b.followUpDate ? new Date(b.followUpDate).getTime() : 0;
          return dateA - dateB;
        })
        .slice(0, 5);

      if (pending.length === 0) {
        resetFollowUpsStat(0);
        container.innerHTML = '';
        renderPriorityActions();
        return;
      }

      // [NEW] Update stat-seguimientos card
      resetFollowUpsStat(followUps.length);

      container.innerHTML = `
  <h6 class="text-muted fw-bold text-uppercase mb-2" style="font-size:.7rem;"><i class="bi bi-calendar-check me-1"></i>Seguimientos pendientes</h6>
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
      renderPriorityActions();
    } catch (e) {
      AdminMedi.State.followUpItems = [];
      resetFollowUpsStat(0);
      console.warn('Follow-ups load error:', e);
    }
  }

  async function openFollowUpsModal() {
    const modalId = 'modalFollowUpsAdmin';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const d = document.createElement('div');
    d.innerHTML = `
  <div class="modal fade" id="${modalId}" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
      <div class="modal-content rounded-4 border-0 shadow-lg">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title fw-bold text-dark mb-0"><i class="bi bi-arrow-repeat text-danger me-2"></i>Seguimientos</h5>
            <p class="text-muted small mb-0">Pendientes próximos y vencidos</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-2" id="followups-modal-body">
          <div class="text-center py-5"><span class="spinner-border text-primary"></span></div>
        </div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(d.firstElementChild);

    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    const body = document.getElementById('followups-modal-body');
    if (!body) return;

    try {
      const operational = getOperationalContext();
      const followUps = await MediService.getFollowUps(
        AdminMedi.State.ctx,
        operational.role,
        operational.ownerUid,
        operational.profileId,
        operational.shift
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pending = followUps
        .slice()
        .sort((a, b) => {
          const aTime = a.followUpDate ? new Date(a.followUpDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.followUpDate ? new Date(b.followUpDate).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });

      if (pending.length === 0) {
        body.innerHTML = `
  <div class="text-center py-5 text-muted">
    <i class="bi bi-calendar-check display-5 d-block mb-3 opacity-50"></i>
    <p class="fw-bold mb-1">No hay seguimientos pendientes</p>
    <small>Todo lo próximo ya quedó atendido o sin fecha activa.</small>
  </div>`;
        return;
      }

      const buckets = {
        all: pending.length,
        overdue: pending.filter((f) => f.followUpDate && new Date(f.followUpDate) < today).length,
        upcoming: pending.filter((f) => f.followUpDate && new Date(f.followUpDate) >= today).length,
        nodate: pending.filter((f) => !f.followUpDate).length
      };

      body.innerHTML = `
        <div class="row g-2 mb-3">
          <div class="col-4">
            <div class="rounded-4 border bg-danger-subtle text-center p-3 h-100">
              <div class="fw-bold text-danger fs-4">${buckets.overdue}</div>
              <div class="small text-muted">Vencidos</div>
            </div>
          </div>
          <div class="col-4">
            <div class="rounded-4 border bg-warning-subtle text-center p-3 h-100">
              <div class="fw-bold text-warning-emphasis fs-4">${buckets.upcoming}</div>
              <div class="small text-muted">Proximos</div>
            </div>
          </div>
          <div class="col-4">
            <div class="rounded-4 border bg-light text-center p-3 h-100">
              <div class="fw-bold text-dark fs-4">${buckets.nodate}</div>
              <div class="small text-muted">Sin fecha</div>
            </div>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" data-followups-filter="all">Todos (${buckets.all})</button>
          <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" data-followups-filter="overdue">Vencidos</button>
          <button type="button" class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" data-followups-filter="upcoming">Proximos</button>
          <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" data-followups-filter="nodate">Sin fecha</button>
        </div>
        <div id="followups-modal-list">
      ${pending.map((f) => {
        const dueDate = f.followUpDate ? new Date(f.followUpDate) : null;
        const isOverdue = dueDate ? dueDate < today : false;
        const dateStr = dueDate
          ? dueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Sin fecha';
        const studentLabel = escapeHtml(f.studentName || f.studentEmail || 'Estudiante');
        const canOpenFullRecord = !!(f.studentId && !String(f.studentId).startsWith('anon_'));
        const encodedStudent = encodeURIComponent(JSON.stringify({
          uid: f.studentId,
          id: f.studentId,
          email: f.studentEmail,
          displayName: f.studentName || f.studentEmail || 'Estudiante'
        }));

        return `
  <div class="border rounded-4 p-3 mb-2 ${isOverdue ? 'bg-danger-subtle border-danger-subtle' : 'bg-light'}" data-followup-kind="${isOverdue ? 'overdue' : dueDate ? 'upcoming' : 'nodate'}">
    <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
      <div style="min-width:0;">
        <div class="fw-bold text-dark text-truncate">${studentLabel}</div>
        <div class="small text-muted text-truncate">${escapeHtml(f.diagnostico || 'Consulta de seguimiento')}</div>
        ${f.followUpNotes ? `<div class="small text-muted mt-1">${escapeHtml(f.followUpNotes)}</div>` : ''}
      </div>
      <div class="text-end flex-shrink-0">
        <div class="small fw-bold ${isOverdue ? 'text-danger' : 'text-warning-emphasis'}">${dateStr}</div>
        <span class="badge ${isOverdue ? 'bg-danger' : dueDate ? 'bg-warning text-dark' : 'bg-secondary'} rounded-pill">${isOverdue ? 'Vencido' : dueDate ? 'Pendiente' : 'Sin fecha'}</span>
      </div>
    </div>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-sm btn-outline-dark rounded-pill fw-bold"
        ${canOpenFullRecord ? '' : 'disabled'}
        onclick="bootstrap.Modal.getInstance(document.getElementById('${modalId}'))?.hide(); setTimeout(() => AdminMedi.showFullRecord('${f.studentId}'), 150);">
        <i class="bi bi-folder2-open me-1"></i>Expediente
      </button>
      <button class="btn btn-sm btn-primary rounded-pill fw-bold"
        ${canOpenFullRecord ? '' : 'disabled'}
        onclick="bootstrap.Modal.getInstance(document.getElementById('${modalId}'))?.hide(); setTimeout(() => AdminMedi.openManualBooking(null, '${encodedStudent}'), 150);">
        <i class="bi bi-calendar-plus me-1"></i>Reservar cita
      </button>
    </div>
  </div>`;
      }).join('')}
      </div>`;

      const listEl = document.getElementById('followups-modal-list');
      const renderFilteredFollowUps = (filterKey = 'all') => {
        if (!listEl) return;
        const rows = Array.from(listEl.querySelectorAll('[data-followup-kind]'));
        let visible = 0;
        rows.forEach((row) => {
          const show = filterKey === 'all' || row.dataset.followupKind === filterKey;
          row.classList.toggle('d-none', !show);
          if (show) visible += 1;
        });

        const emptyStateId = 'followups-filter-empty';
        let emptyState = document.getElementById(emptyStateId);
        if (!visible) {
          if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.id = emptyStateId;
            emptyState.className = 'text-center py-4 text-muted small';
            emptyState.textContent = 'No hay seguimientos en este filtro.';
            listEl.appendChild(emptyState);
          }
        } else if (emptyState) {
          emptyState.remove();
        }
      };

      body.querySelectorAll('[data-followups-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          body.querySelectorAll('[data-followups-filter]').forEach((item) => {
            item.classList.remove('btn-primary', 'text-white', 'btn-outline-danger', 'btn-outline-warning', 'btn-outline-secondary');
            if (item.dataset.followupsFilter === 'overdue') item.classList.add('btn-outline-danger');
            else if (item.dataset.followupsFilter === 'upcoming') item.classList.add('btn-outline-warning');
            else item.classList.add('btn-outline-secondary');
          });
          btn.classList.remove('btn-outline-danger', 'btn-outline-warning', 'btn-outline-secondary');
          btn.classList.add('btn-primary', 'text-white');
          renderFilteredFollowUps(btn.dataset.followupsFilter || 'all');
        });
      });

      renderFilteredFollowUps('all');
    } catch (err) {
      console.warn('Follow-ups modal error:', err);
      body.innerHTML = '<div class="text-center py-4 text-muted">No se pudo cargar la lista de seguimientos.</div>';
    }
  }

  async function showAdminConfigModal() {
    try {
      const cfg = await MediService.loadConfig(AdminMedi.State.ctx);
      if (!AdminMedi.State.ctx.config) AdminMedi.State.ctx.config = {};
      AdminMedi.State.ctx.config.medi = cfg;
    } catch (e) {
      console.warn("Error loading config for modal:", e);
    }

    const operational = getOperationalContext();
    const currentDuration = operational.slotDuration || AdminMedi.State.slotDuration || 60;
    const disabledHoursArr = Array.isArray(operational.disabledHours) ? operational.disabledHours : [];

    let startHour = 8;
    let endHour = 21;
    if (operational.role === 'Psicologo') {
      if (operational.shift === 'Matutino') endHour = 14;
      if (operational.shift === 'Vespertino') startHour = 15;
    }

    let hoursHtml = '';
    for (let m = startHour * 60; m <= endHour * 60; m += currentDuration) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const isChecked = disabledHoursArr.includes(timeStr) ? 'checked' : '';
      hoursHtml += `
        <div class="col-4 col-md-3 mb-2">
          <div class="form-check custom-checkbox">
            <input class="form-check-input cfg-disabled-hour shadow-sm" type="checkbox" value="${timeStr}" id="chk-dh-${hh}-${mm}" ${isChecked}>
            <label class="form-check-label small" for="chk-dh-${hh}-${mm}">${timeStr}</label>
          </div>
        </div>`;
    }

    const availabilityTitle = operational.role === 'Psicologo'
      ? `Turno ${escapeHtml(operational.shift || 'Psicologia')}`
      : 'Servicio Medico';
    const availabilityDesc = operational.role === 'Psicologo'
      ? 'Controla la disponibilidad del turno activo sin afectar el otro perfil.'
      : 'Habilita o deshabilita la recepcion de reservas medicas.';
    const scopeCaption = operational.role === 'Psicologo'
      ? `Espacio actual: Psicologia ${escapeHtml(operational.shift || '')}`
      : 'Espacio actual: Medicina';
    const pinConfigHtml = operational.role === 'Psicologo' && AdminMedi.State.currentProfile?.id
      ? `
              <div class="alert alert-warning border-0 small d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mt-4 mb-0">
                <div>
                  <div class="fw-bold text-dark mb-1"><i class="bi bi-key-fill me-1"></i>Acceso por PIN del perfil actual</div>
                  <div class="text-muted">Puedes cambiar el PIN del turno activo sin alterar citas, consultas, seguimientos ni el historial del perfil.</div>
                </div>
                <button class="btn btn-outline-dark rounded-pill fw-bold flex-shrink-0" type="button" onclick="AdminMedi.showChangePinModal()">
                  <i class="bi bi-pencil-square me-1"></i>Cambiar PIN
                </button>
              </div>`
      : '';

    const html = `
      <div class="modal fade" id="modalAdminConfig" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content rounded-4 border-0 shadow">
            <div class="modal-header border-0 pb-0">
              <h5 class="fw-bold"><i class="bi bi-gear-fill me-2 text-secondary"></i>Configuracion de Agenda</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex justify-content-between align-items-center p-3 rounded-4 mb-4 border bg-light">
                <div>
                  <div class="fw-bold text-dark fs-5"><i class="bi bi-power text-primary me-2"></i>${availabilityTitle}</div>
                  <div class="small text-muted">${availabilityDesc}</div>
                  <div class="small fw-bold text-primary mt-1">${scopeCaption}</div>
                </div>
                <div class="form-check form-switch">
                  <input class="form-check-input" style="width: 3rem; height: 1.5rem;" type="checkbox" id="cfg-available-current" ${operational.isEnabled ? 'checked' : ''}>
                </div>
              </div>

              <label class="form-label fw-bold small text-uppercase text-muted"><i class="bi bi-lock-fill me-1"></i>Bloquear Horas Especificas</label>
              <div class="alert alert-secondary border-0 small mb-3">
                Selecciona las horas que deseas deshabilitar para este espacio operativo.
              </div>
              <div class="row g-1 mb-4">
                ${hoursHtml}
              </div>

              <label class="form-label fw-bold small text-uppercase text-muted">Duracion de Citas</label>
              <div class="d-flex gap-2 mb-4">
                <div class="nav nav-pills w-100" id="duration-pills">
                  <input type="radio" class="btn-check" name="slotDur" id="dur60" value="60" ${currentDuration === 60 ? 'checked' : ''}>
                  <label class="btn btn-outline-primary flex-fill rounded-start-pill fw-bold" for="dur60">1 Hora</label>

                  <input type="radio" class="btn-check" name="slotDur" id="dur45" value="45" ${currentDuration === 45 ? 'checked' : ''}>
                  <label class="btn btn-outline-primary flex-fill rounded-end-pill fw-bold" for="dur45">45 Minutos</label>
                </div>
              </div>

              <div class="alert alert-info border-0 small mb-0">
                <i class="bi bi-info-circle me-1"></i> Los cambios se aplican al dashboard admin y a la disponibilidad visible para estudiantes.
              </div>
              ${pinConfigHtml}
            </div>
            <div class="modal-footer border-0 pt-0">
              <button class="btn btn-primary w-100 rounded-pill fw-bold py-2" id="btn-save-cfg">Guardar Cambios</button>
            </div>
          </div>
        </div>
      </div>`;

    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.appendChild(d.firstElementChild);

    const modalEl = document.getElementById('modalAdminConfig');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    document.getElementById('btn-save-cfg').onclick = async function () {
      const btn = this;
      const valDuration = parseInt(document.querySelector('input[name="slotDur"]:checked').value, 10);
      const availabilityToggle = document.getElementById('cfg-available-current');
      const checkedHours = Array.from(document.querySelectorAll('.cfg-disabled-hour:checked')).map(cb => cb.value);
      const updateData = {};

      updateData['slotDuration_' + operational.role] = valDuration;
      const disabledHoursKey = operational.shift
        ? `disabledHours_${operational.role}_${operational.shift}`
        : `disabledHours_${operational.role}`;
      updateData[disabledHoursKey] = checkedHours;

      if (availabilityToggle) {
        updateData[operational.availabilityKey] = availabilityToggle.checked;
      }

      if (operational.role === 'Psicologo') {
        const currentCfg = AdminMedi.State.ctx.config?.medi || {};
        const matEnabled = operational.availabilityKey === 'availablePsicologoMatutino'
          ? availabilityToggle.checked
          : (currentCfg.availablePsicologoMatutino !== false);
        const vespEnabled = operational.availabilityKey === 'availablePsicologoVespertino'
          ? availabilityToggle.checked
          : (currentCfg.availablePsicologoVespertino !== false);
        updateData.availablePsicologo = matEnabled || vespEnabled;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        await MediService.updateConfig(AdminMedi.State.ctx, updateData);

        AdminMedi.State.slotDuration = valDuration;
        if (!AdminMedi.State.ctx.config) AdminMedi.State.ctx.config = {};
        if (!AdminMedi.State.ctx.config.medi) AdminMedi.State.ctx.config.medi = {};
        Object.assign(AdminMedi.State.ctx.config.medi, updateData);

        const banner = document.getElementById('medi-service-status');
        if (banner) {
          const nowEnabled = MediService.isServiceEnabledForContext(
            AdminMedi.State.ctx.config.medi,
            operational.role,
            operational.shift,
            operational.profileId
          );
          banner.classList.toggle('d-none', nowEnabled);
          banner.classList.toggle('d-flex', !nowEnabled);
        }

        if (typeof AdminMedi.refreshAdmin === 'function') {
          AdminMedi.refreshAdmin();
        }

        showToast('Configuracion actualizada', 'success');
        modal.hide();
      } catch (e) {
        console.error(e);
        showToast('Error al guardar', 'danger');
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
      }
    };
  }

  function showChangePinModal() {
    const currentProfile = AdminMedi.State.currentProfile;
    if (!currentProfile?.id) {
      showToast('Selecciona primero un perfil de Psicologia.', 'warning');
      return;
    }

    const modalId = 'modalChangeProfilePin';
    document.getElementById(modalId)?.remove();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content rounded-4 border-0 shadow">
            <div class="modal-header border-0 pb-0">
              <h5 class="fw-bold mb-0"><i class="bi bi-key-fill text-warning me-2"></i>Cambiar PIN de acceso</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-secondary border-0 small">
                Perfil actual: <b>${escapeHtml(currentProfile.displayName || currentProfile.shortName || currentProfile.id)}</b><br>
                El perfil se conserva. Solo cambiará la clave de acceso.
              </div>
              <div class="form-floating mb-3">
                <input type="password" class="form-control rounded-3" id="medi-pin-current" placeholder="PIN actual" maxlength="24">
                <label for="medi-pin-current">PIN actual</label>
              </div>
              <div class="form-floating mb-3">
                <input type="password" class="form-control rounded-3" id="medi-pin-new" placeholder="Nuevo PIN" maxlength="24">
                <label for="medi-pin-new">Nuevo PIN</label>
              </div>
              <div class="form-floating">
                <input type="password" class="form-control rounded-3" id="medi-pin-confirm" placeholder="Confirmar PIN" maxlength="24">
                <label for="medi-pin-confirm">Confirmar nuevo PIN</label>
              </div>
              <div class="small text-danger mt-2 d-none fw-bold" id="medi-pin-change-error"></div>
            </div>
            <div class="modal-footer border-0">
              <button class="btn btn-primary w-100 rounded-pill fw-bold" id="btn-save-profile-pin">
                Guardar nuevo PIN
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(wrapper.firstElementChild);
    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    document.getElementById('btn-save-profile-pin').onclick = async function () {
      const btn = this;
      const currentPin = document.getElementById('medi-pin-current').value.trim();
      const newPin = document.getElementById('medi-pin-new').value.trim();
      const confirmPin = document.getElementById('medi-pin-confirm').value.trim();
      const errEl = document.getElementById('medi-pin-change-error');

      errEl.classList.add('d-none');
      errEl.textContent = '';

      if (!currentPin || !newPin || !confirmPin) {
        errEl.textContent = 'Completa los tres campos.';
        errEl.classList.remove('d-none');
        return;
      }
      if (newPin !== confirmPin) {
        errEl.textContent = 'La confirmacion del nuevo PIN no coincide.';
        errEl.classList.remove('d-none');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

      try {
        await MediService.updateProfilePin(
          AdminMedi.State.ctx,
          AdminMedi.State.myUid,
          currentProfile.id,
          currentPin,
          newPin
        );
        showToast('PIN actualizado correctamente.', 'success');
        modal.hide();
      } catch (error) {
        errEl.textContent = error.message || 'No se pudo actualizar el PIN.';
        errEl.classList.remove('d-none');
        btn.disabled = false;
        btn.textContent = 'Guardar nuevo PIN';
      }
    };
  }

  async function saveConfig() {
    const start = document.getElementById('cfg-hora-inicio').value;
    const end = document.getElementById('cfg-hora-fin').value;
    const duration = document.querySelector('input[name="cfg-duracion"]:checked').value;

    try {
      const updateData = {
        slotStart: parseInt(start),
        slotEnd: parseInt(end),
        slotStep: parseInt(duration)
      };
      await MediService.updateConfig(AdminMedi.State.ctx, updateData);
      if (!AdminMedi.State.ctx.config) AdminMedi.State.ctx.config = {};
      if (!AdminMedi.State.ctx.config.medi) AdminMedi.State.ctx.config.medi = {};
      Object.assign(AdminMedi.State.ctx.config.medi, updateData);
      AdminMedi.refreshAdmin?.();

      showToast('Configuración guardada. Se aplicará en nuevas cargas.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error guardando configuración', 'danger');
    }
  }

  async function _legacyToggleAvailability(enabled) {
    // Logic refactored to use role-based config
    if (!AdminMedi.State.myRole) return;

    const key = AdminMedi.State.myRole === 'Médico' ? 'availableMédico' : 'availablePsicologo';
    // If 'enabled' arg is passed, use it, otherwise toggle
    const currentVal = (AdminMedi.State.ctx.config.medi && AdminMedi.State.ctx.config.medi[key] !== undefined) ? AdminMedi.State.ctx.config.medi[key] : true;
    const newVal = (enabled !== undefined) ? enabled : !currentVal;

    try {
      await MediService.updateConfig(AdminMedi.State.ctx, { [key]: newVal });

      // Update local
      if (!AdminMedi.State.ctx.config.medi) AdminMedi.State.ctx.config.medi = {};
      AdminMedi.State.ctx.config.medi[key] = newVal;

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

  async function toggleAvailability(enabled) {
    if (!AdminMedi.State.myRole) return;

    const operational = getOperationalContext();
    const config = AdminMedi.State.ctx.config?.medi || {};
    const key = operational.availabilityKey || (operational.role === 'Psicologo' ? 'availablePsicologo' : 'availableM\u00e9dico');

    const currentVal = config[key] !== undefined ? config[key] : true;
    const newVal = (enabled !== undefined) ? enabled : !currentVal;

    try {
      const updateData = { [key]: newVal };
      if (operational.role === 'Psicologo') {
        const mat = key === 'availablePsicologoMatutino' ? newVal : (config.availablePsicologoMatutino !== false);
        const vesp = key === 'availablePsicologoVespertino' ? newVal : (config.availablePsicologoVespertino !== false);
        updateData.availablePsicologo = mat || vesp;
      }

      await MediService.updateConfig(AdminMedi.State.ctx, updateData);

      if (!AdminMedi.State.ctx.config) AdminMedi.State.ctx.config = {};
      if (!AdminMedi.State.ctx.config.medi) AdminMedi.State.ctx.config.medi = {};
      Object.assign(AdminMedi.State.ctx.config.medi, updateData);

      const status = newVal ? 'HABILITADO' : 'DESHABILITADO';
      showToast(`Agenda ${status} `, newVal ? 'success' : 'warning');

      const banner = document.getElementById('medi-service-status');
      if (banner) {
        const nowEnabled = MediService.isServiceEnabledForContext(
          AdminMedi.State.ctx.config.medi,
          operational.role,
          operational.shift,
          operational.profileId
        );
        banner.classList.toggle('d-none', nowEnabled);
        banner.classList.toggle('d-flex', !nowEnabled);
      }
      AdminMedi.refreshAdmin?.();
    } catch (e) {
      console.error(e);
      showToast('Error actualizando disponibilidad', 'danger');
    }
  }

  async function setShift(shift) {
    AdminMedi.State.currentShift = shift;
    // SAVE PREFERENCE
    localStorage.setItem('medi_shift_pref', shift);

    const m = bootstrap.Modal.getInstance(document.getElementById('modalShiftSelector'));
    if (m) m.hide();

    // UPDATE UI BADGE
    const elEsp = document.getElementById('medi-pro-esp');
    if (elEsp) elEsp.textContent = `${AdminMedi.State.myRole} (${AdminMedi.State.currentShift})`;

    // --- CHECK SHIFT PROFILE ---
    // Only for Médico/Psicologo
    if (AdminMedi.State.myRole === 'Médico' || AdminMedi.State.myRole === 'Psicologo') {
      try {
        const profile = await MediService.getShiftProfile(AdminMedi.State.ctx, AdminMedi.State.myRole, AdminMedi.State.currentShift);
        if (profile && profile.name) {
          // PROFILE EXISTS -> LOAD IT
          console.log(`[Medi] Loaded Shift Profile: ${profile.name} `);
          _profesionalName = profile.name;
          AdminMedi.State.profesionalCedula = profile.cedula;
          AdminMedi.State.currentProfile = {
            ...(AdminMedi.State.currentProfile || {}),
            ...profile,
            id: AdminMedi.State.currentProfile?.id || profile.id || null,
            displayName: profile.displayName || profile.name || _profesionalName,
            legacyShift: profile.legacyShift || AdminMedi.State.currentShift
          };

          // Update UI Greetings
          const nameEl = document.getElementById('medi-pro-name');
          if (nameEl) nameEl.textContent = _profesionalName;

          const cedEl = document.getElementById('medi-pro-cedula'); // Hidden input if any
          if (cedEl) cedEl.value = AdminMedi.State.profesionalCedula;

          showToast(`Bienvenid @, ${_profesionalName} `, 'success');
        } else {
          // PROFILE MISSING -> FORCE SETUP
          console.warn("[Medi] No profile for this shift. Prompting setup...");
          showShiftSetupModal(AdminMedi.State.myRole, AdminMedi.State.currentShift);
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
    AdminMedi.init(AdminMedi.State.ctx, { force: true });
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
        const savedProfile = await MediService.updateShiftProfile(AdminMedi.State.ctx, role, shift, {
          name,
          displayName: name,
          cedula,
          ownerUid: AdminMedi.State.myUid,
          linkedProfileId: AdminMedi.State.currentProfile?.id || null
        });
        showToast("Perfil de turno guardado correctamente.", "success");
        modal.hide();

        // Set values locally immediately
        _profesionalName = name;
        AdminMedi.State.profesionalCedula = cedula;
        AdminMedi.State.currentProfile = {
          ...(AdminMedi.State.currentProfile || {}),
          ...(savedProfile || {}),
          id: AdminMedi.State.currentProfile?.id || savedProfile?.linkedProfileId || savedProfile?.id || null,
          displayName: name,
          name,
          cedula,
          legacyShift: shift
        };

        // Update UI Greetings
        const nameEl = document.getElementById('medi-pro-name');
        if (nameEl) nameEl.textContent = _profesionalName;

        // Resume Init
        AdminMedi.init(AdminMedi.State.ctx, { force: true });

      } catch (err) {
        console.error(err);
        showToast("Error al guardar perfil: " + err.message, "danger");
        btn.disabled = false;
        btn.innerHTML = 'Reintentar';
      }
    };
  }

  function updateDashboardStats() {
    // Read badge value set by loadWall stream (authoritative source)
    const badge = document.getElementById('badge-sala-espera');
    const waitCount = badge ? parseInt(badge.textContent) || 0 : 0;
    const unread = parseInt(document.getElementById('badge-unread-msgs')?.textContent || '0', 10) || 0;
    const unreadCard = document.getElementById('badge-unread-msgs-card');
    if (unreadCard) unreadCard.textContent = unread;

    // Update stat card: En Espera (use badge, which is set by stream)
    const statEspera = document.getElementById('stat-en-espera');
    if (statEspera) statEspera.textContent = waitCount;

    // Update stat card: Agenda (count confirmed agenda items)
    const statAgenda = document.getElementById('stat-agenda');
    if (statAgenda) {
      statAgenda.textContent = Array.isArray(AdminMedi.State.agendaTodayItems)
        ? AdminMedi.State.agendaTodayItems.length
        : 0;
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

    renderQuickPauseStatus();
  }

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
      const docs = await MediService.getStudentFollowUps(AdminMedi.State.ctx, uid);

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
  <div class="alert ${isLate ? 'alert-danger border-danger' : 'alert-warning border-warning'} border-start border-4 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 animate-fade-in">
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
        </div>
  `;

    } catch (e) {
      console.error('Error rendering follow-up banner:', e);
    }
  }

  function _loadRecentActivity() {
    const list = document.getElementById('medi-recent-list');
    if (!list) return;

    if (getRecentUnsub()) {
      getRecentUnsub()();
      setRecentUnsub(null);
    }

    const operational = getOperationalContext();
    const profId = operational.profileId;
    const uid = operational.ownerUid;
    list.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success" role="status"></div></div>';

    const unsub = MediService.streamRecentActivity(AdminMedi.State.ctx, operational.role, uid, profId, 10, (docs) => {
      if (getRecentUnsub() !== unsub) return;
      if (docs.length === 0) {
        list.innerHTML = '<div class="text-center py-4 text-muted small opacity-50">Sin actividad reciente</div>';
        return;
      }

      list.innerHTML = docs.map(d => {
        const time = d.safeDate ? d.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
        const date = d.safeDate ? d.safeDate.toLocaleDateString() : '--';
        const statusColor = d.estado === 'finalizada' ? 'success' : (d.estado === 'borrador' ? 'warning' : 'secondary');

        return `
  <div class="list-group-item list-group-item-action border-0 mb-1 rounded-3 px-3 py-2 cursor-pointer" onclick="AdminMedi.showConsultationDetails('${encodeURIComponent(JSON.stringify(d))}')">
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
    }, operational.shift);

    setRecentUnsub(unsub);
  }

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
      </div>
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
      if (getRecentUnsub()) getRecentUnsub()();
      document.getElementById(modalId).remove();
    });
  }

  function _setRecentFilter(type, btn) {
    setRecentFilterState(type);

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

    if (getRecentUnsub()) getRecentUnsub()();

    const operational = getOperationalContext();
    const profId = operational.profileId;
    const uidToUse = operational.ownerUid || AdminMedi.State.ctx.user.uid;

    // Fetch 50 items
    setRecentUnsub(MediService.streamRecentConsultations(AdminMedi.State.ctx, operational.role, uidToUse, profId, 50, (docs) => {
      if (!document.getElementById('all-recent-list')) return;

      let filtered = docs;
      if (getRecentFilter() === 'registered') {
        filtered = docs.filter(d => !isAnonymousConsultation(d));
      } else if (getRecentFilter() === 'anonymous') {
        filtered = docs.filter(d => isAnonymousConsultation(d));
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
        const isAnon = isAnonymousConsultation(c);

        return `
  <div class="list-group-item list-group-item-action border-0 border-bottom p-3 rounded-3 mb-1 cursor-pointer"
onclick="AdminMedi.showConsultationQuickDetail('${encoded}')">
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
        </div>
  `;
      }).join('');
    }, operational.shift));
  }

  return {
    loadWall: loadWall,
    filterWaitingRoom: filterWaitingRoom,
    buscarPaciente: buscarPaciente,
    showPatientFoundModal: showPatientFoundModal,
    startWalkIn: startWalkIn,
    loadDayMetrics: loadDayMetrics,
    loadPatientInsights: loadPatientInsights,
    _loadFollowUps: _loadFollowUps,
    openFollowUpsModal: openFollowUpsModal,
    showAdminConfigModal: showAdminConfigModal,
    showChangePinModal: showChangePinModal,
    saveConfig: saveConfig,
    toggleAvailability: toggleAvailability,
    pauseScheduleFor: pauseScheduleFor,
    clearQuickPause: clearQuickPause,
    renderQuickPauseStatus: renderQuickPauseStatus,
    renderPriorityActions: renderPriorityActions,
    renderWaitingRoomDashboardPanel: renderWaitingRoomDashboardPanel,
    setShift: setShift,
    showShiftSetupModal: showShiftSetupModal,
    updateDashboardStats: updateDashboardStats,
    startClock: startClock,
    renderFollowUpBanner: renderFollowUpBanner,
    _loadRecentActivity: _loadRecentActivity,
    showAllRecentModal: showAllRecentModal,
    _setRecentFilter: _setRecentFilter,
    _loadAllRecentItems: _loadAllRecentItems,
  };
})();
