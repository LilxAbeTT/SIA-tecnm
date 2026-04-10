// admin.medi.agenda.js
if (!window.AdminMedi) window.AdminMedi = {};
window.AdminMedi.Agenda = (function () {
  // Sub-module agenda
  const C_CITAS = 'citas-medi';
  const isWeekday = (date) => {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  };
  const getSlotStart = () => AdminMedi.State.slotStart || 8;
  const getSlotEnd = () => AdminMedi.State.slotEnd || 22;
  const getSlotStep = () => AdminMedi.State.slotStep || 30;
  const getSlotDuration = () => AdminMedi.State.slotDuration || 60;
  const getBookingStudent = () => AdminMedi.State.bookingStudent;
  const setBookingStudent = (student) => { AdminMedi.State.bookingStudent = student; return student; };
  const buildSlotId = (date, tipo) => `${MediService.slotIdFromDate(date)}_${tipo}`;
  const refreshDashboard = () => AdminMedi.refreshAdmin?.();
  const getOperationalContext = () => AdminMedi.getOperationalContext ? AdminMedi.getOperationalContext() : {
    role: AdminMedi.State.myRole,
    shift: AdminMedi.State.currentShift || null,
    profileId: AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null,
    ownerUid: AdminMedi.State.myUid,
    disabledHours: AdminMedi.State.ctx?.config?.medi?.[`disabledHours_${AdminMedi.State.myRole}`] || []
  };
  const getScopedDisabledHours = () => {
    const operational = getOperationalContext();
    return Array.isArray(operational.disabledHours) ? operational.disabledHours : [];
  };
  const normalizeShift = (value, fallbackDate = null) => MediService.normalizeShiftTag
    ? MediService.normalizeShiftTag(value, fallbackDate)
    : (value || null);
  const matchesCurrentScope = (data, operational) => {
    if (!data || !operational) return false;

    const normalizedRole = MediService.normalizeServiceRole
      ? MediService.normalizeServiceRole(operational.role)
      : operational.role;
    const effectiveShift = normalizeShift(
      data.shift || data.profesionalShift,
      data.fechaHoraSlot || data.safeDate || null
    );

    if (normalizedRole === 'Psicologo') {
      if (operational.ownerUid && data.profesionalId && data.profesionalId !== operational.ownerUid) return false;
      if (operational.profileId && data.profesionalProfileId) return data.profesionalProfileId === operational.profileId;
      if (operational.shift && effectiveShift) return effectiveShift === normalizeShift(operational.shift);
      return true;
    }

    if (operational.ownerUid && data.profesionalId && data.profesionalId !== operational.ownerUid) return false;
    if (operational.profileId && data.profesionalProfileId && data.profesionalProfileId !== operational.profileId) return false;
    if (operational.shift && effectiveShift && effectiveShift !== normalizeShift(operational.shift)) return false;
    return true;
  };

  function getAgendaDateLabel(date, todayISO, tomorrowISO) {
    const iso = MediService.toISO(date);
    if (iso === todayISO) return 'Hoy';
    if (iso === tomorrowISO) return 'Mañana';
    return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function buildAgendaDashboardCard(c, scope = 'today') {
    const fecha = c.safeDate || new Date();
    const now = new Date();
    const todayISO = MediService.toISO(now);
    const tomorrowISO = MediService.toISO(new Date(now.getTime() + 86400000));
    const dateISO = MediService.toISO(fecha);
    const timeStr = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const dayLabel = getAgendaDateLabel(fecha, todayISO, tomorrowISO);
    const diffMinutes = Math.round((fecha - now) / 60000);
    const citaEnc = encodeURIComponent(JSON.stringify(c));

    let rawMotivo = c.motivo || 'Consulta general';
    rawMotivo = rawMotivo.replace(/^\[.*?\]\s*/, '');
    const motivo = escapeHtml(rawMotivo.substring(0, 60));

    let badgeClass = 'bg-light text-secondary border';
    let badgeText = scope === 'today' ? 'Programada' : dayLabel;

    if (scope === 'today') {
      if (diffMinutes < -15) {
        badgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
        badgeText = 'Retrasada';
      } else if (diffMinutes <= 15 && diffMinutes >= -60) {
        badgeClass = 'bg-success-subtle text-success border border-success-subtle';
        badgeText = 'Lista';
      } else if (diffMinutes > 15) {
        badgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
        badgeText = `En ${Math.floor(diffMinutes / 60) > 0 ? `${Math.floor(diffMinutes / 60)}h ` : ''}${diffMinutes % 60}m`;
      }
    } else if (dateISO === tomorrowISO) {
      badgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      badgeText = 'Mañana';
    }

    const secondaryAction = scope === 'today'
      ? `<button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="AdminMedi.iniciarConsulta('${citaEnc}')"><i class="bi bi-play-fill me-1"></i>Iniciar</button>`
      : `<button class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold" onclick="AdminMedi.openMiAgendaModal()"><i class="bi bi-calendar-week me-1"></i>Ver agenda</button>`;

    return `
      <div class="border rounded-4 p-3 mb-2 bg-white shadow-sm">
        <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
          <div>
            <div class="fw-bold text-dark">${escapeHtml(c.studentName || 'Estudiante')}</div>
            <div class="small text-muted">${scope === 'today' ? 'Hoy' : escapeHtml(dayLabel)} · ${escapeHtml(timeStr)}</div>
          </div>
          <span class="badge ${badgeClass}" style="font-size:.65rem;">${escapeHtml(badgeText)}</span>
        </div>
        <div class="small text-dark mb-3">${motivo}</div>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold" onclick="AdminMedi.showFullRecord('${escapeHtml(c.studentId || '')}')">
            <i class="bi bi-folder2-open me-1"></i>Expediente
          </button>
          ${secondaryAction}
        </div>
      </div>`;
  }

  function renderAgendaDashboardPanels(todayDocs, futureDocs) {
    const todayList = document.getElementById('medi-agenda-list');
    const futureList = document.getElementById('medi-upcoming-list');
    const todayCount = document.getElementById('medi-agenda-count');
    const futureCount = document.getElementById('medi-upcoming-count');

    if (todayCount) todayCount.textContent = todayDocs.length;
    if (futureCount) futureCount.textContent = futureDocs.length;

    if (todayList) {
      todayList.innerHTML = todayDocs.length
        ? todayDocs.map((item) => buildAgendaDashboardCard(item, 'today')).join('')
        : `<div class="medi-empty-state"><i class="bi bi-calendar-x"></i><p>Sin citas para hoy</p></div>`;
    }

    if (futureList) {
      futureList.innerHTML = futureDocs.length
        ? futureDocs.map((item) => buildAgendaDashboardCard(item, 'future')).join('')
        : `<div class="medi-empty-state"><i class="bi bi-calendar2-week"></i><p>Sin citas en días posteriores</p></div>`;
    }
  }

  function loadMyAgenda() {
    const fullList = document.getElementById('medi-agenda-all-list');
    if (!fullList && !document.getElementById('medi-agenda-list')) return;

    // Avatar color pool [bg, text]
    const AVATAR_COLORS = [
      ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef9c3', '#a16207'],
      ['#fce7f3', '#be185d'], ['#ede9fe', '#6d28d9'], ['#ffedd5', '#c2410c']
    ];
    const avatarColors = (name) => {
      const i = (name || '?').charCodeAt(0) % AVATAR_COLORS.length;
      return AVATAR_COLORS[i];
    };

    if (AdminMedi.State.unsubs.agenda) AdminMedi.State.unsubs.agenda();

    const operational = getOperationalContext();
    const unsub = MediService.streamAgenda(AdminMedi.State.ctx, operational.role, operational.ownerUid, operational.shift, operational.profileId, (docs) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayISO = MediService.toISO(now);

      const filterEl = document.getElementById('adm-agenda-filter');
      const filterVal = filterEl ? filterEl.value : 'todas';

      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (7 - now.getDay())); // Until Sunday

      // Filter docs based on selection
      docs = docs.filter(d => {
        const fecha = d.safeDate;
        if (!fecha) return false;

        // No mostrar pasadas del dia anterior
        const fDate = new Date(fecha);
        fDate.setHours(0, 0, 0, 0);
        if (fDate < now) return false;

        if (filterVal === 'hoy') {
          return MediService.toISO(fecha) === todayISO;
        } else if (filterVal === 'semana') {
          return fecha <= endOfWeek;
        }
        return true; // "todas"
      });

      const kpiPend = document.getElementById('kpi-pendientes-hoy');
      const badgeAgendaCard = document.getElementById('badge-agenda-card');

      const modalUpdateSync = () => {
        const modalTarget = document.getElementById('modal-agenda-list');
        const modalEl = document.getElementById('modalMiAgenda');
        if (modalTarget && modalEl && modalEl.classList.contains('show')) {
          modalTarget.innerHTML = (fullList && fullList.innerHTML) || '<div class="text-center py-5 opacity-50"><i class="bi bi-calendar-x display-4 d-block mb-2"></i><p class="fw-bold">Sin citas programadas</p></div>';
        }
      };

      if (docs.length === 0) {
        if (kpiPend) kpiPend.textContent = '0';
        if (badgeAgendaCard) badgeAgendaCard.textContent = '0 citas';
        AdminMedi.State.agendaItems = [];
        AdminMedi.State.agendaTodayItems = [];
        AdminMedi.State.agendaFutureItems = [];
        AdminMedi.Tools?.renderPriorityActions?.();
        renderAgendaDashboardPanels([], []);
        if (fullList) {
          fullList.innerHTML = `<div class="text-center py-5 opacity-50"><i class="bi bi-calendar-x display-4 d-block mb-2"></i><p class="fw-bold">No tienes citas agendadas</p></div>`;
        }
        modalUpdateSync();
        return;
      }
      docs.sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0));
      const todayDocs = docs.filter((item) => MediService.toISO(item.safeDate || new Date()) === todayISO);
      const futureDocs = docs.filter((item) => MediService.toISO(item.safeDate || new Date()) !== todayISO);
      if (kpiPend) kpiPend.textContent = todayDocs.length;
      if (badgeAgendaCard) badgeAgendaCard.textContent = `${todayDocs.length} citas`;
      AdminMedi.State.agendaItems = docs.slice();
      AdminMedi.State.agendaTodayItems = todayDocs.slice();
      AdminMedi.State.agendaFutureItems = futureDocs.slice();
      renderAgendaDashboardPanels(todayDocs, futureDocs);
      AdminMedi.Tools?.renderPriorityActions?.();

      const now_real = new Date();
      const tomorrowISO = MediService.toISO(new Date(now_real.getTime() + 86400000));
      const nextIdx = docs.findIndex(c => (c.safeDate || new Date()) >= new Date(now_real.getTime() - 15 * 60000) && MediService.toISO(c.safeDate || new Date()) === todayISO);
      let lastDateLabel = '';
      let html = '';

      docs.forEach((c, idx) => {
        const fecha = c.safeDate || new Date();
        const dateISO = MediService.toISO(fecha);
        const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const diffMinutes = (fecha - now_real) / 60000;

        let isLate = false, canAttend = false, isNext = false;

        if (dateISO === todayISO) {
          isLate = diffMinutes < -15;
          canAttend = diffMinutes <= 15 && diffMinutes >= -60; // Hasta una hora atras
          isNext = idx === nextIdx;
        }

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

        // Old badge logic removed to fix redeclaration

        // 1. Clean Service Tag from Motivo (e.g. "[Medicina General] Dolor")
        let rawMotivo = c.motivo || 'Consulta General';
        rawMotivo = rawMotivo.replace(/^\[.*?\]\s*/, '');
        const motivo = escapeHtml(rawMotivo.substring(0, 55));
        const isLactario = c.linkedLactarioId || c.sourceModule === 'lactario' || (c.motivo && c.motivo.includes('Lactario'));

        let statusBadge = '';
        if (isLate) {
          const m = Math.abs(Math.floor(diffMinutes));
          const timeText = m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
          statusBadge = `<span class="badge bg-danger-subtle text-danger px-2 border border-danger-subtle" style="font-size:.6rem;"><i class="bi bi-exclamation-circle-fill me-1"></i>Retrasada por ${timeText}</span>`;
        } else if (isNext) {
          statusBadge = `<span class="badge bg-primary-subtle text-primary px-2 border border-primary-subtle" style="font-size:.6rem;"><i class="bi bi-lightning-charge-fill me-1"></i>Siguiente en turno</span>`;
        } else if (canAttend) {
          statusBadge = `<span class="badge bg-success-subtle text-success px-2 border border-success-subtle" style="font-size:.6rem;"><i class="bi bi-check-circle-fill me-1"></i>A Tiempo</span>`;
        } else {
          // Calculate time remaining for future appointments
          let timeRemaining = '';
          if (diffMinutes > 0) {
            const m = Math.floor(diffMinutes);
            if (m > 1440) { // More than a day
              const days = Math.floor(m / 1440);
              const hrs = Math.floor((m % 1440) / 60);
              timeRemaining = `Faltan ${days}d ${hrs}h`;
            } else if (m > 60) {
              const hrs = Math.floor(m / 60);
              const mins = m % 60;
              timeRemaining = `Faltan ${hrs}h ${mins}m`;
            } else {
              timeRemaining = `Faltan ${m}m`;
            }
          }
          statusBadge = `<span class="badge text-muted border px-2 border-secondary-subtle" style="font-size:.6rem;"><i class="bi bi-clock me-1"></i>Programada ${timeRemaining ? '(' + timeRemaining + ')' : ''}</span>`;
        }

        const name = c.studentName || 'Estudiante';
        const initial = name.charAt(0).toUpperCase();
        const [bgC, fgC] = avatarColors(name);
        const citaEnc = encodeURIComponent(JSON.stringify(c));

        html += `
          <div class="medi-agenda-card ${cardMod} p-3 mb-2 rounded-4 shadow-sm border bg-white" style="animation-delay:${idx * 0.05}s;">
            <div class="d-flex align-items-start gap-3">
              <div class="d-flex flex-column align-items-center gap-1 flex-shrink-0" style="min-width:44px;">
                <div class="fw-bold text-primary" style="font-size:.8rem;line-height:1;">${escapeHtml(timeStr)}</div>
                <div class="medi-avatar rounded-circle d-flex align-items-center justify-content-center fw-bold" style="background:${bgC};color:${fgC};width:40px;height:40px;font-size:1.1rem;">${initial}</div>
              </div>
              <div class="flex-fill" style="min-width:0;">
                <div class="d-flex flex-wrap gap-1 align-items-center mb-1">
                  <div class="fw-bold text-dark text-truncate" style="font-size:.9rem;max-width:220px;">${escapeHtml(name)}</div>
                  ${isLactario ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size:.6rem;">LACTARIO</span>' : ''}
                </div>
                <div class="text-muted text-truncate mb-1" style="font-size:.78rem;">${motivo}</div>
                <div class="d-flex flex-wrap gap-1 align-items-center">
                  ${statusBadge}
                  <span id="prev-count-${c.id}" class="badge  text-secondary border px-2" style="font-size:.6rem;"><i class="spinner-border spinner-border-sm" style="width:0.5rem;height:0.5rem;border-width:0.1em;"></i></span>
                </div>
              </div>
            </div>
            
            <div class="d-flex flex-wrap gap-2 mt-3 pt-3 border-top justify-content-between" style="margin-left:54px;">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold d-flex align-items-center"
                        style="font-size:.75rem;"
                        onclick="AdminMedi.cancelarCitaAdmin('${c.id}', true)">
                  <i class="bi bi-x-circle me-1"></i>Cancelar
                </button>
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-semibold d-flex align-items-center"
                        style="font-size:.75rem;"
                        onclick="AdminMedi.registrarNoAsistencia('${c.id}')">
                  <i class="bi bi-person-x me-1"></i>No asistio
                </button>
              </div>
              
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold d-flex align-items-center" 
                        style="font-size:.75rem;" title="Ver Expediente"
                        onclick="AdminMedi.showFullRecord('${escapeHtml(c.studentId)}')">
                  <i class="bi bi-folder2-open me-1"></i>Expediente
                </button>
                <button class="btn btn-sm btn-primary rounded-pill shadow-sm px-3 fw-bold d-flex align-items-center"
                        style="font-size:.75rem;"
                        onclick="AdminMedi.iniciarConsulta('${citaEnc}')">
                  <i class="bi bi-play-fill me-1"></i>Iniciar consulta
                </button>
              </div>
            </div>
          </div>`;

        // Asynchronously fetch previous history count
        if (c.studentId) {
          MediService.getExpedienteHistory(
            AdminMedi.State.ctx,
            c.studentId,
            operational.role,
            operational.ownerUid,
            operational.shift,
            operational.profileId
          )
            .then(history => {
              const el = document.getElementById(`prev-count-${c.id}`);
              if (el) {
                if (history && history.length > 0) {
                  el.innerHTML = `<i class="bi bi-clock-history me-1"></i>${history.length} previas`;
                  el.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2';
                } else {
                  el.innerHTML = '<i class="bi bi-star me-1"></i>Nuevo ingreso';
                  el.className = 'badge bg-info-subtle text-info-emphasis border border-info-subtle px-2';
                }
              }
            }).catch(err => {
              const el = document.getElementById(`prev-count-${c.id}`);
              if (el) el.style.display = 'none';
            });
        }
      });

      if (fullList) fullList.innerHTML = html;
      modalUpdateSync();
    });
    AdminMedi.State.unsubs.agenda = unsub;
  }

  async function togglePrioridad(citaId, currentPrio) {
    const cycle = { normal: 'urgente', urgente: 'seguimiento', seguimiento: 'normal' };
    const next = cycle[currentPrio] || 'urgente';
    try {
      await AdminMedi.State.ctx.db.collection(C_CITAS).doc(citaId).update({ prioridad: next });
      showToast('Prioridad: ' + next, next === 'urgente' ? 'danger' : next === 'seguimiento' ? 'warning' : 'info');
    } catch (e) {
      console.error(e);
      showToast('Error al cambiar prioridad', 'danger');
    }
  }

  async function tomarPaciente(citaId) {
    try {
      const operational = getOperationalContext();
      const cita = await MediService.tomarPaciente(
        AdminMedi.State.ctx,
        citaId,
        operational.ownerUid,
        AdminMedi.State.ctx.auth.currentUser.email,
        operational.shift,
        AdminMedi.State.currentProfile
      );
      showToast('Paciente asignado exitosamente', 'success');
    } catch (e) {
      if (e.message && e.message.includes('Este horario ya fue ocupado')) {
        // Lanza modal de reemplazo
        const htmlObj = document.createElement('div');
        htmlObj.innerHTML = `
          <div class="modal fade" id="modalReplaceConfirm" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm">
              <div class="modal-content border-0 rounded-4 shadow">
                <div class="modal-body p-4 text-center">
                  <i class="bi bi-arrow-left-right text-primary display-4 mb-3"></i>
                  <h5 class="fw-bold mb-3">¿Reemplazar Cita?</h5>
                  <p class="text-muted small mb-4">Este horario está ocupado. Si aceptas, la cita actual regresará a sala de espera con etiqueta de reagendada y tomarás a este paciente en su lugar.</p>
                  <div class="d-grid gap-2">
                    <button type="button" class="btn btn-primary rounded-pill fw-bold" id="confirmReplaceBtn">Sí, Reemplazar</button>
                    <button type="button" class="btn btn-light rounded-pill text-secondary mt-1" data-bs-dismiss="modal">Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(htmlObj.firstElementChild);
        const modalConfirmEl = document.getElementById('modalReplaceConfirm');
        const modalConfirmObj = new bootstrap.Modal(modalConfirmEl);

        modalConfirmEl.addEventListener('hidden.bs.modal', () => modalConfirmEl.remove());

        document.getElementById('confirmReplaceBtn').addEventListener('click', async () => {
          document.getElementById('confirmReplaceBtn').disabled = true;
          document.getElementById('confirmReplaceBtn').innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';
          try {
            await reemplazarCitaAdmin(citaId);
            modalConfirmObj.hide();
            showToast('Cita reemplazada correctamente', 'success');
          } catch (err) {
            console.error(err);
            modalConfirmObj.hide();
            showToast('Error al reemplazar', 'danger');
          }
        });
        modalConfirmObj.show();
      } else {
        showToast(e.message || 'Error al agendar', 'danger');
      }
    }
  }

  async function reemplazarCitaAdmin(nuevaCitaId) {
    // 1. Conseguir la cita nueva para saber la fecha
    const nuevaRef = AdminMedi.State.ctx.db.collection('citas-medi').doc(nuevaCitaId);
    const nuevaSnap = await nuevaRef.get();
    if (!nuevaSnap.exists) throw new Error("La nueva cita ya no existe");

    const fechaConflicto = nuevaSnap.data().fechaHoraSlot;
    const operational = getOperationalContext();

    // 2. Buscar la cita confirmada actual en ese horario (filtro por rol)
    const conflictQuery = await AdminMedi.State.ctx.db.collection('citas-medi')
      .where('tipoServicio', '==', operational.role)
      .where('estado', '==', 'confirmada')
      .where('fechaHoraSlot', '==', fechaConflicto)
      .get();
    const conflicts = conflictQuery.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((data) => matchesCurrentScope(data, operational));

    if (conflictQuery.empty || conflicts.length === 0) {
      throw new Error(`No se encontro la cita conflictiva en la agenda de ${operational.role}.`);
    }

    if (conflicts.length > 1) {
      console.warn('[Medi] Se detectaron varias citas confirmadas en el mismo horario para el mismo espacio operativo.', conflicts);
    }
    const antiguaCitaId = conflicts[0]?.id || null;

    // 3. Ejecutar el retorno a fila (Devolver) de la antigua
    await MediService.cancelarCitaAdmin(AdminMedi.State.ctx, antiguaCitaId, "Reagendada por el profesional", (operational.shift || true));

    // 4. Tomar la nueva normalmente ahora que el slot está libre
    await MediService.tomarPaciente(
      AdminMedi.State.ctx,
      nuevaCitaId,
      operational.ownerUid,
      AdminMedi.State.ctx.auth.currentUser.email,
      operational.shift,
      AdminMedi.State.currentProfile
    );
  }

  function rechazarCita(citaId) {
    // Wrapper for generic cancel with "No Show" implication
    cancelarCitaAdmin(citaId, false); // False = Finalize/Cancel, True = Return to Queue
  }

  async function cancelarCitaAdmin(citaId, returnToQueue = false) {
    // Text differences depending on if it's a Return or a Rejection
    const title = returnToQueue ? "¿Cancelar y Devolver?" : "¿Rechazar Cita?";
    const desc = returnToQueue
      ? "Esta acción devolverá al paciente a la fila de espera y le notificará el movimiento."
      : "Esta acción CANCELARÁ definitivamente la cita. El paciente será notificado de que no pudiste atenderlo.";
    const btnText = returnToQueue ? "Sí, devolver a fila" : "Sí, rechazar";
    const btnIcon = returnToQueue ? "bi-arrow-counterclockwise" : "bi-x-circle";

    const htmlObj = document.createElement('div');
    htmlObj.innerHTML = `
      <div class="modal fade" id="modalDevolverConfirm" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 rounded-4 shadow">
            <div class="modal-body p-4 text-center">
              <i class="bi bi-exclamation-triangle-fill text-danger display-4 mb-3"></i>
              <h5 class="fw-bold mb-3">${title}</h5>
              <p class="text-muted small mb-4">${desc}</p>
              <div class="d-grid gap-2">
                <button type="button" class="btn btn-danger rounded-pill fw-bold" id="confirmDevolverBtn"><i class="bi ${btnIcon} me-1"></i>${btnText}</button>
                <button type="button" class="btn btn-light rounded-pill text-secondary mt-1" data-bs-dismiss="modal">Mantener cita</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(htmlObj.firstElementChild);
    const modalConfirmEl = document.getElementById('modalDevolverConfirm');
    const modalConfirmObj = new bootstrap.Modal(modalConfirmEl);

    modalConfirmEl.addEventListener('hidden.bs.modal', function () {
      modalConfirmEl.remove();
    });

    document.getElementById('confirmDevolverBtn').addEventListener('click', async () => {
      // Disable button to prevent double clicks
      document.getElementById('confirmDevolverBtn').disabled = true;
      document.getElementById('confirmDevolverBtn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';

      try {
        const returnArg = returnToQueue ? (AdminMedi.State.currentShift || true) : false;
        await MediService.cancelarCitaAdmin(AdminMedi.State.ctx, citaId, "Regresado por el profesional", returnArg);

        // Hide modal
        modalConfirmObj.hide();
        // [FIX] Removed the subsequent collection('citas') fetch that threw 'missing permissions' errors.
        // MediService already triggers notifications securely. 
      } catch (e) {
        console.error("Error cancelarCitaAdmin:", e);
        if (window.showToast) showToast('Error al procesar la devolución', 'danger');
        modalConfirmObj.hide();
      }
    });

    modalConfirmObj.show();
  }

  async function registrarNoAsistencia(citaId) {
    const modalId = 'modalNoShowConfirm';
    document.getElementById(modalId)?.remove();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 rounded-4 shadow">
            <div class="modal-body p-4 text-center">
              <i class="bi bi-person-x-fill text-warning display-4 mb-3"></i>
              <h5 class="fw-bold mb-2">¿Marcar inasistencia?</h5>
              <p class="text-muted small mb-4">La cita se movera a canceladas con motivo "Paciente no asistio" y contara para el historial operativo.</p>
              <div class="d-grid gap-2">
                <button type="button" class="btn btn-warning rounded-pill fw-bold" id="btn-confirm-noshow">
                  <i class="bi bi-check2-circle me-1"></i>Si, marcar
                </button>
                <button type="button" class="btn btn-light rounded-pill text-secondary" data-bs-dismiss="modal">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(wrapper.firstElementChild);
    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });

    document.getElementById('btn-confirm-noshow')?.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

      try {
        await MediService.cancelarCitaAdmin(AdminMedi.State.ctx, citaId, 'Paciente no asistio', false);
        await AdminMedi.State.ctx.db.collection(C_CITAS).doc(citaId).set({
          noShow: true,
          canceladoPor: 'servicio',
          fechaNoShow: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        showToast('La cita se marco como no asistio.', 'success');
        modal.hide();
        refreshDashboard();
      } catch (error) {
        console.error('Error registrando no asistencia:', error);
        showToast('No se pudo marcar la inasistencia.', 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Si, marcar';
      }
    }, { once: true });
  }

  function buildSlotsForDate(d) {
    const out = [];
    const slotStart = getSlotStart();
    const slotEnd = getSlotEnd();
    const slotStep = getSlotStep();

    for (let h = slotStart; h <= slotEnd; h++) {
      for (let m = 0; m < 60; m += slotStep) {
        if (h === slotEnd && m > 0) continue;
        out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0));
      }
    }
    return out;
  }

  function renderAdminBookingDates() {
    const container = document.getElementById('adm-book-dates');
    if (!container) return;

    // Mostrar turno en header del modal
    const shiftLabelEl = document.getElementById('adm-book-shift-label');
    if (shiftLabelEl) {
      if (AdminMedi.State.currentShift === 'Matutino') shiftLabelEl.textContent = '☀️ Matutino (08:00-14:00)';
      else if (AdminMedi.State.currentShift === 'Vespertino') shiftLabelEl.textContent = '🌙 Vespertino (15:00-21:00)';
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
    let slotStartH = getSlotStart();
    let slotEndH = getSlotEnd();
    if (AdminMedi.State.currentShift === 'Matutino') { slotStartH = 8; slotEndH = 14; }
    if (AdminMedi.State.currentShift === 'Vespertino') { slotStartH = 15; slotEndH = 21; }

    const step = getSlotDuration();
    const shiftIcon = AdminMedi.State.currentShift === 'Matutino' ? '☀️' : AdminMedi.State.currentShift === 'Vespertino' ? '🌙' : '⏰';
    const shiftLabel = AdminMedi.State.currentShift ? `${shiftIcon} Turno ${AdminMedi.State.currentShift}` : '⏰ Horario completo';
    const rangeLabel = `${String(slotStartH).padStart(2, '0')}:00 - ${String(slotEndH).padStart(2, '0')}:00`;

    const operational = getOperationalContext();
    const disabledHours = getScopedDisabledHours();

    MediService.getOccupiedSlots(AdminMedi.State.ctx, operational.role, dateStr).then(occupied => {
      const slots = [];
      for (let m = slotStartH * 60; m < slotEndH * 60; m += step) {
        const hh = Math.floor(m / 60);
        const mm = m % 60;
        const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        const isDisabledHour = disabledHours.includes(timeStr);
        const isTaken = isDisabledHour || (Array.isArray(occupied) && occupied.some(s => s.includes(timeStr)));
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
      const disabledHoursFallback = getScopedDisabledHours();
      for (let m = slotStartH * 60; m < slotEndH * 60; m += step) {
        const hh = Math.floor(m / 60);
        const t = `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const isTakenFallback = disabledHoursFallback.includes(t);
        html += `<button type="button" class="adm-time-pill btn btn-sm fw-bold ${isTakenFallback ? 'btn-secondary opacity-40' : 'btn-outline-primary'}" ${isTakenFallback ? 'disabled' : `onclick="AdminMedi.selectAdminTime(this,'${t}')"`}>${t}</button>`;
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

  function openManualBooking(mode, encodedStudent) {
    let student = null;

    // 1. Pre-selected Student (from Search Card or cache)
    const lookupKey = encodedStudent || mode;
    if (lookupKey && window.AdminMedi._patientCache && window.AdminMedi._patientCache.has(lookupKey)) {
      student = window.AdminMedi._patientCache.get(lookupKey);
      showBookingModal(student);
      return;
    }
    if (encodedStudent) {
      student = JSON.parse(decodeURIComponent(encodedStudent));
      showBookingModal(student);
      return;
    }

    // 2. Search Mode (Generic)
    // Reuse WalkIn Modal logic but for Booking
    const mHtml = `
  <div class="modal fade" id="modalSearchBooking" tabindex="-1">
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
      </div>`;

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
        const found = await MediService.buscarPaciente(AdminMedi.State.ctx, mat);
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

  async function searchStudentForBooking() {
    const mat = document.getElementById('adm-book-matricula').value.trim();
    const resContainer = document.getElementById('adm-student-result');

    if (mat.length < 4) { showToast('Ingresa al menos 4 dígitos', 'warning'); return; }

    resContainer.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

    try {
      const q = await AdminMedi.State.ctx.db.collection('usuarios').where('matricula', '==', mat).limit(1).get();
      if (q.empty) {
        resContainer.innerHTML = '<div class="alert alert-danger border-0 small py-2 mb-0"><i class="bi bi-x-circle me-1"></i>No encontrado</div>';
        setBookingStudent(null);
        document.getElementById('adm-book-step-2').classList.add('d-none');
      } else {
        const s = q.docs[0].data();
        s.uid = q.docs[0].id;
        setBookingStudent(s);

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
    const studentForBooking = getBookingStudent();
    if (!studentForBooking) return;

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
    const baseId = `${y}-${MediService.pad(m)}-${MediService.pad(d)}_${MediService.pad(hh)}:${MediService.pad(mm)}`;
    // Determine type based on category or AdminMedi.State.myRole if admin
    // In manual booking, category gives context. If category is 'Salud Mental' -> Psicologo?
    // Let's infer type from category logic
    let typeForSlot = 'Médico';
    const operational = getOperationalContext();
    if (cat === 'Salud Mental' || cat === 'Psicología' || operational.role === 'Psicologo') typeForSlot = 'Psicologo';

    const slotId = `${baseId}_${typeForSlot}`;

    const btn = document.querySelector('#adm-book-form button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Agendando...';

    try {
      // [FIX] Use reservarCitaAdmin (not reservarCita) to include shift + profile
      await MediService.reservarCitaAdmin(AdminMedi.State.ctx, {
        student: studentForBooking,
        date: targetDate,
        slotId: slotId,
        tipo: operational.role,
        shift: operational.shift,
        profileData: AdminMedi.State.currentProfile,
        motivo: `[MANUAL: ${cat}] ${reason}`
      });

      bootstrap.Modal.getInstance(document.getElementById('modalAdminBooking')).hide();
      refreshDashboard();
    } catch (e) {
      console.error(e);
      showToast(e.message || "Error al agendar. Verifica disponibilidad.", 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  function showBookingModal(student) {
    // Dynamic Modal for Admin Booking
    const modalId = 'modalAdminBooking';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    // Use default motive suggestions
    const motiveOptions = [
      "Seguimiento",
      "Chequeo General",
      "Malestar General",
      "Primera vez",
      "Urgencia Menor",
      "Otro..."
    ];

    const html = `
  <div class="modal fade" id="${modalId}" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content shadow rounded-4 border-0">
        <div class="modal-header border-bottom-0 pb-0">
          <div>
            <h5 class="modal-title fw-bold text-dark"><i class="bi bi-calendar-check-fill me-2 text-primary"></i>Agendar Cita</h5>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>

        <!-- STUDENT HEADER (Compact) -->
        <div class="bg-light px-4 py-3 border-bottom mt-2">
          <div class="d-flex align-items-center gap-3">
            ${student.photoURL
        ? `<img src="${escapeHtml(student.photoURL)}" class="rounded-circle shadow-sm" style="width:48px; height:48px; object-fit:cover;">`
        : `<div class="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width:48px;height:48px;font-size:1.2rem;">
                  ${student.displayName ? student.displayName.charAt(0).toUpperCase() : '?'}
                 </div>`
      }
            <div class="flex-grow-1 min-w-0">
              <h6 class="fw-bold text-dark mb-0 text-truncate">${escapeHtml(student.displayName || 'Estudiante')}</h6>
              <div class="small text-muted d-flex flex-wrap gap-2 mt-1">
                <span><i class="bi bi-person-badge fw-bold text-secondary me-1"></i>${escapeHtml(student.matricula || 'Sin matrícula')}</span>
                ${student.carrera ? `<span><i class="bi bi-mortarboard-fill text-secondary me-1"></i>${escapeHtml(student.carrera)}</span>` : ''}
              </div>
              <div class="small fw-bold mt-1" id="booking-last-visit">
                  <span class="spinner-border spinner-border-sm text-secondary me-1" role="status" style="width: 0.7rem; height: 0.7rem;"></span> Buscando historial...
              </div>
            </div>
          </div>
        </div>

        <div class="modal-body p-4">
          <!-- Date Scroller -->
          <div class="mb-4">
            <label class="d-block small fw-bold text-dark mb-2">1. Selecciona el Día</label>
            <div id="admin-date-scroller" class="d-flex gap-2 overflow-auto pb-2" style="scrollbar-width: none;">
              <!-- Days injected here -->
            </div>
          </div>

          <!-- Available Slots -->
          <div class="mb-4">
            <label class="d-block small fw-bold text-dark mb-2">2. Selecciona la Hora</label>

            <div id="admin-booking-loader" class="text-center py-4 d-none">
              <div class="spinner-border text-primary mb-2" role="status"></div>
              <div class="small text-muted">Verificando disponibilidad...</div>
            </div>

            <div id="admin-booking-slots" class="d-flex flex-wrap gap-2 d-none justify-content-start">
              <!-- Time buttons injected here -->
            </div>

            <div id="admin-booking-msg" class="text-center py-4 bg-light text-muted rounded-3 border">
              <i class="bi bi-calendar-event fs-4 d-block mb-1 opacity-50"></i>
              <span class="small">Selecciona una fecha ver horarios</span>
            </div>
          </div>

          <!-- Motivo -->
          <div class="mb-2">
            <label class="form-label small fw-bold text-dark">3. Motivo de Consulta</label>
            <div class="input-group input-group-sm mb-2">
              <span class="input-group-text bg-white text-muted border-end-0"><i class="bi bi-card-text"></i></span>
              <select id="admin-booking-reason-sel" class="form-select border-start-0 text-dark fw-semibold" onchange="
                if(this.value === 'Otro...'){ 
                    document.getElementById('admin-booking-reason-other').classList.remove('d-none');
                    document.getElementById('admin-booking-reason-other').focus();
                } else {
                    document.getElementById('admin-booking-reason-other').classList.add('d-none');
                }
              ">
                ${motiveOptions.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
            <input type="text" id="admin-booking-reason-other" class="form-control form-control-sm d-none" placeholder="Especifique el motivo...">
          </div>

          <!-- SUMMARY BLOCK -->
          <div id="booking-summary-block" class="d-none mt-3 animate-fade-in">
            <div class="alert alert-primary border-0 bg-primary bg-opacity-10 d-flex align-items-center gap-3 py-2 px-3 mb-0 rounded-3">
              <i class="bi bi-info-circle-fill text-primary fs-5"></i>
              <div class="small fw-semibold text-dark lh-1">
                Resumen: Cita para el <strong id="summary-date" class="text-primary">--</strong> a las <strong id="summary-time" class="text-primary">--</strong>.
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
          <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" id="btn-confirm-admin-booking" disabled>
            Confirmar Cita
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Re-Confirmation Modal (Nested) -->
  <div class="modal fade" id="modalBookingConfirmStep2" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered modal-sm">
      <div class="modal-content shadow border-0 rounded-4">
        <div class="modal-body p-4 text-center">
          <i class="bi bi-question-circle-fill text-primary display-4 mb-3"></i>
          <h5 class="fw-bold text-dark mb-2">¿Confirmar Cita?</h5>
          <p class="text-muted small mb-4" id="confirm-step2-text">Se agendará a Estudiante para el ...</p>
          <div class="d-grid gap-2">
            <button type="button" class="btn btn-primary rounded-pill fw-bold" id="btn-final-confirm">Sí, Agendar</button>
            <button type="button" class="btn btn-light rounded-pill text-secondary mt-1" data-bs-dismiss="modal">Revisar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;

    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.appendChild(d);

    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => { d.remove(); document.querySelectorAll('.modal-backdrop').forEach(b => b.remove()); });

    // Try to get last consultation data asynchronously
    if (student.uid || student.id) {
      MediService.getExpedienteHistory(AdminMedi.State.ctx, student.uid || student.id, AdminMedi.State.myRole, AdminMedi.State.myUid, AdminMedi.State.currentShift, AdminMedi.State.currentProfile ? AdminMedi.State.currentProfile.id : null)
        .then(rows => {
          const labelEl = document.getElementById('booking-last-visit');
          if (!labelEl) return;
          if (rows && rows.length > 0) {
            const last = rows[0];
            const dStr = (last.safeDate || new Date()).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
            labelEl.className = 'small fw-bold mt-1 text-primary';
            labelEl.innerHTML = `<i class="bi bi-clock-history me-1"></i>Última consulta: ${dStr}`;
          } else {
            labelEl.className = 'small fw-bold mt-1 text-success';
            labelEl.innerHTML = `<i class="bi bi-star-fill me-1"></i>Primera consulta`;
          }
        }).catch(() => {
          const labelEl = document.getElementById('booking-last-visit');
          if (labelEl) labelEl.innerHTML = '';
        });
    }

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
  <div class="date-card p-2 text-center border rounded-3 bg-white cursor-pointer transition-all flex-shrink-0"
data-iso="${iso}"
style="min-width: 60px; user-select:none;">
                 <div class="small fw-semibold text-secondary mb-0">${dayName}</div>
                 <div class="h5 fw-bolder text-dark mb-0 lh-1 mt-1">${dayNum}</div>
                 <div class="extra-small text-secondary fw-semibold mt-1">${monthName}</div>
            </div>
  `;
    }).join('');

    // Select Date Helper
    const handleDateSelect = async (isoDate, cardEl) => {
      // Styles
      dateContainer.querySelectorAll('.date-card').forEach(c => {
        c.classList.remove('border-primary', 'bg-primary-subtle');
        c.classList.add('border');
      });
      cardEl.classList.remove('border');
      cardEl.classList.add('border-primary', 'bg-primary-subtle');

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
        const operational = getOperationalContext();
        const blockedSlots = await MediService.getOccupiedSlots(AdminMedi.State.ctx, isoDate, operational.role);

        // Turn Validation Logic (Ignorando SLOT_END global si de casualidad está en 13 o 14 en firestore)
        let start = 8;
        let end = 20;

        // Apply Shift Logic specially for Psychologists that might work Morning/Afternoon
        if (operational.role === 'Psicologo') {
          if (operational.shift === 'Matutino') { start = 8; end = 14; }
          else if (operational.shift === 'Vespertino') { start = 15; end = 21; }
        } else {
          // Si es Médico o Admin General, dar rango completo por defecto
          start = 8;
          end = 20;
        }

        const duration = getSlotDuration();

        const slots = [];
        let currMins = start * 60;
        const endMins = end * 60;

        // Adjust for "Today" - don't show past slots
        const now = new Date();
        const isToday = (isoDate === now.toISOString().split('T')[0]);
        const currentMinsReal = now.getHours() * 60 + now.getMinutes();

        while (currMins <= endMins) {
          // If Today, skip past times
          if (isToday && currMins < currentMinsReal) {
            currMins += duration;
            continue;
          }

          const h = Math.floor(currMins / 60);
          const m = currMins % 60;

          const [Zy, Zm, Zd] = isoDate.split('-').map(Number);
          const slotDate = new Date(Zy, Zm - 1, Zd, h, m, 0);

          const tStr = slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const slotId = buildSlotId(slotDate, operational.role);

          // Check availability
          const isBlocked = blockedSlots.includes(slotId);

          // Also check explicit disabled hours globally
          const disabledHours = getScopedDisabledHours();
          const formTimeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const isHardDisabled = disabledHours.includes(formTimeString);

          slots.push({ date: slotDate, label: tStr, occupied: isBlocked || isHardDisabled });
          currMins += duration;
        }

        loader.classList.add('d-none');
        slotsContainer.classList.remove('d-none');

        // Render ONLY available slots + occupied logic (grayed out or hidden). We show them grayed out usually.
        if (slots.length === 0) {
          slotsContainer.innerHTML = '<div class="alert alert-light w-100 text-center text-muted small border">No hay horarios disponibles para este turno.</div>';
        } else {
          // Compact UI buttons
          slotsContainer.innerHTML = slots.map((s, i) => `
  <button type="button"
class="adm-time-pill btn btn-sm ${s.occupied ? 'btn-light text-secondary border' : 'btn-outline-primary fw-bold'} rounded-pill"
style="min-width:70px; ${s.occupied ? 'opacity:0.5; text-decoration:line-through; cursor:not-allowed;' : ''}"
                        ${s.occupied ? 'disabled title="No disponible"' : ''}
data-idx="${i}">
  ${s.label}
                </button>
  `).join('');

          AdminMedi._currentSlots = slots;
          slotsContainer.querySelectorAll('button[data-idx]').forEach((btn) => {
            btn.addEventListener('click', () => selectAdminSlot(Number(btn.dataset.idx)));
          });
        }

      } catch (e) {
        console.error(e);
        loader.classList.add('d-none');
        slotsContainer.innerHTML = '<div class="text-danger small w-100 text-center">Error cargando disponibilidad.</div>';
        slotsContainer.classList.remove('d-none');
      }
    };

    // Select Slot Helper (Fix Bug)
    const selectAdminSlot = (idx) => {
      const slot = AdminMedi._currentSlots[idx];
      if (!slot) return;

      // UI
      slotsContainer.querySelectorAll('button').forEach(b => {
        b.classList.remove('btn-primary', 'text-white');
        if (!b.disabled) b.classList.add('btn-outline-primary', 'text-primary');
      });

      // FIX applied here (Selector syntax error resolved)
      const btn = slotsContainer.querySelector(`button[data-idx="${idx}"]`);
      if (btn) {
        btn.classList.remove('btn-outline-primary', 'text-primary');
        btn.classList.add('btn-primary', 'text-white');
      }

      selectedSlotId = slot.date; // The Date object to book

      // Show Summary
      summaryBlock.classList.remove('d-none');
      document.getElementById('summary-date').textContent = slot.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      document.getElementById('summary-time').textContent = slot.label;

      confirmBtn.disabled = false;
    };

    dateContainer.querySelectorAll('.date-card').forEach((card) => {
      card.addEventListener('click', () => handleDateSelect(card.dataset.iso, card));
    });


    confirmBtn.onclick = () => {
      const selReason = document.getElementById('admin-booking-reason-sel').value;
      const customReason = document.getElementById('admin-booking-reason-other').value.trim();
      const reason = (selReason === 'Otro...' ? customReason : selReason) || 'Consulta Agendada';

      if (!selectedSlotId) return;

      // Show confirmation modal
      const confirmModalEl = document.getElementById('modalBookingConfirmStep2');
      const confirmModal = new bootstrap.Modal(confirmModalEl);

      const dtx = selectedSlotId.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
      const htx = selectedSlotId.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      document.getElementById('confirm-step2-text').innerHTML =
        `Se agendará a <strong class="text-dark">${escapeHtml(student.displayName.split(' ')[0])}</strong> para el <strong>${dtx}</strong> a las <strong>${htx}</strong>.`;

      const btnFinal = document.getElementById('btn-final-confirm');

      // Remove previous listeners if any (clone node trick)
      const newBtnFinal = btnFinal.cloneNode(true);
      btnFinal.parentNode.replaceChild(newBtnFinal, btnFinal);

      newBtnFinal.onclick = async () => {
        confirmModal.hide();
        const operational = getOperationalContext();

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Agendando...';

        try {
          await MediService.reservarCitaAdmin(AdminMedi.State.ctx, {
            student: student,
            date: selectedSlotId,
            slotId: buildSlotId(selectedSlotId, operational.role),
            tipo: operational.role,
            motivo: reason,
            shift: operational.shift,
            profileData: AdminMedi.State.currentProfile
          });

          showToast('Cita agendada exitosamente', 'success');
          modal.hide();
          refreshDashboard();

        } catch (e) {
          console.error(e);
          showToast(e.message || 'Error al agendar', 'danger');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirmar Cita';
        }
      };

      confirmModal.show();
    };
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
        await MediService.cancelarCitaEstudiante(AdminMedi.State.ctx, citaId, reason);
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
      <div class="date-option p-2 text-center border rounded-3 bg-white shadow-sm flex-shrink-0"
    style="min-width: 70px; cursor: pointer;" data-date="${isoDate}"
    onclick="AdminMedi._reschedSelectDate(this, '${isoDate}')">
          <div class="small text-muted mb-0">${displayDay}</div>
          <div class="fw-bold fs-5">${d.getDate()}</div>
          <div class="small text-primary fw-bold">${d.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase()}</div>
        </div>`;
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

        await MediService.modificarCita(AdminMedi.State.ctx, cita.id, {
          date: newDate,
          slotId: buildSlotId(newDate, tipo),
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
      occupied = await MediService.getOccupiedSlots(AdminMedi.State.ctx, dateStr, tipo);
    } catch (e) { console.error("Error fetching slots for reschedule:", e); }

    timeGrid.innerHTML = '';
    slots.forEach(slot => {
      const tStr = `${slot.getHours().toString().padStart(2, '0')}:${slot.getMinutes().toString().padStart(2, '0')}`;
      const slotId = buildSlotId(slot, tipo);
      const isTaken = occupied.includes(slotId);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn-sm rounded-pill fw-bold ${isTaken ? 'btn-light text-muted pe-none opacity-50' : 'btn-outline-primary'}`;
      btn.style.cssText = 'min-width: 70px;';
      btn.textContent = tStr;
      if (isTaken) btn.innerHTML = `<s>${tStr}</s>`;

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

  return {
    loadMyAgenda: loadMyAgenda,
    togglePrioridad: togglePrioridad,
    tomarPaciente: tomarPaciente,
    rechazarCita: rechazarCita,
    cancelarCitaAdmin: cancelarCitaAdmin,
    registrarNoAsistencia: registrarNoAsistencia,
    buildSlotsForDate: buildSlotsForDate,
    renderAdminBookingDates: renderAdminBookingDates,
    selectAdminDate: selectAdminDate,
    selectAdminTime: selectAdminTime,
    openManualBooking: openManualBooking,
    searchStudentForBooking: searchStudentForBooking,
    confirmAdminBooking: confirmAdminBooking,
    showBookingModal: showBookingModal,
    solicitarCancelacion: solicitarCancelacion,
    prepararEdicion: prepararEdicion,
    _reschedSelectDate: _reschedSelectDate,
  };
})();
