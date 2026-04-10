// modules/medi/student-experience.js
window.Medi = window.Medi || {};
window.Medi.Factories = window.Medi.Factories || {};

window.Medi.Factories.studentExperience = function(scope) {
  with (scope) {
  function _ensureStudentArray(items, label = 'items') {
    if (Array.isArray(items)) return items;
    if (items == null) return [];
    console.warn(`[Medi] ${label} llego con formato inesperado en experiencia estudiante:`, items);
    return [];
  }

  async function _loadQueuePosition(citaId, tipoServicio, citaDate, targetElId) {
    try {
      const el = document.getElementById(targetElId || ('queue-pos-' + citaId));
      if (!el) return;

      const queue = await MediService.getQueueForSlot(_ctx, citaDate, _normalizeStudentServiceType(tipoServicio));
      const total = queue.length;
      const pos = queue.findIndex((cita) => cita.id === citaId) + 1;
      if (pos <= 0 || total === 0) {
        el.innerHTML = '';
        return;
      }
      const estWait = pos * 15; // ~15 min avg per patient

      el.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-primary-subtle text-primary"><i class="bi bi-people-fill me-1"></i>Posicion: #${pos}/${total}</span>
          <span class="badge text-muted border"><i class="bi bi-clock me-1"></i>~${estWait} min</span>
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
        const allCitas = _ensureStudentArray(items.data, 'citas');
        _lastCitasFull = allCitas;
        _currentBookingLock = _getCurrentBlockingAppointment(allCitas);
        _refreshStudentBookingLock();

        // [E4] Real-time State Change Detection
        const newlyConfirmed = new Set();

        allCitas.forEach(c => {
          const oldState = _lastStates[c.id];
          if (oldState && oldState === 'pendiente') {
            if (c.estado === 'confirmada') {
              newlyConfirmed.add(c.id);
              if (window.showToast) showToast(`¡Tu cita ha sido confirmada!`, 'success');
              // Si el usuario está en la pestaña Citas, llevarlos a Confirmadas
              const citasPane = document.getElementById('medi-tab-citas');
              if (citasPane && citasPane.classList.contains('show', 'active')) {
                setTimeout(() => {
                  const tabConf = document.getElementById('tab-confirmadas');
                  if (tabConf) tabConf.click();
                }, 600);
              }
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

        // [NEW] Hero next appointment badge
        const now2 = new Date();
        const upcomingAll = activas
          .filter(c => c.safeDate && c.safeDate > now2)
          .sort((a, b) => a.safeDate - b.safeDate);
        _renderHeroNextAppointment(upcomingAll.length > 0 ? upcomingAll[0] : null);

        // [NEW] Queue card on Tab Inicio — show first pending
        const firstPending = allCitas
          .filter(c => c.estado === 'pendiente' && c.safeDate && c.safeDate > now2)
          .sort((a, b) => a.safeDate - b.safeDate)[0];
        _renderQueueCard(firstPending || null);

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
                <div class="medi-next-appt-actions flex-shrink-0">
                  ${next.estado === 'confirmada' ? `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="Medi._addToCalendar('${encoded}')">
                    <i class="bi bi-calendar-plus me-1"></i>Calendario
                  </button>` : ''}
                  ${next.profesionalId ? (() => {
                const bannerCtx = encodeURIComponent(`Conversación iniciada desde tu próxima cita · ${dateCap} · ${timeText} · ${next.tipoServicio || 'Consulta'}`);
                return `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="Medi.startChatWithProfessional('${next.profesionalId}', '${next.profesionalName || 'Doctor'}', '${next.profesionalProfileId || ''}', decodeURIComponent('${bannerCtx}'))">
                      <i class="bi bi-chat-dots me-1"></i>Contactar
                    </button>`;
              })() : ''}
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

        // Actualizar stats y badges de conteo
        const _updStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        _updStat('stat-citas-pend', pending.length);
        _updStat('stat-citas-conf', confirmed.length);
        _updStat('stat-citas-canc', cancelled.length);
        _updStat('badge-pend', pending.length);
        _updStat('badge-conf', confirmed.length);

        // Helper Render Function — tarjetas verticales completas
        const renderCarousel = (container, list, type, highlights = new Set()) => {

          if (list.length === 0) {
            const emptyConfig = {
              pendientes: {
                icon: 'bi-hourglass',
                msg: 'Sin citas en espera',
                sub: '¿Necesitas atención médica o psicológica?',
                cta: { label: 'Agendar cita', tab: 'medi-tab-agendar', color: 'btn-primary' }
              },
              confirmadas: {
                icon: 'bi-calendar-check',
                msg: 'Sin citas confirmadas',
                sub: 'Tus citas aprobadas aparecerán aquí.',
                cta: null
              },
              canceladas: {
                icon: 'bi-calendar-x',
                msg: 'Historial limpio',
                sub: 'No tienes citas canceladas.',
                cta: null
              }
            };
            const cfg = emptyConfig[type] || emptyConfig.pendientes;
            const ctaHtml = cfg.cta
              ? `<button class="btn btn-sm ${cfg.cta.color} rounded-pill mt-2 px-3" ${cfg.cta.tab ? `onclick="Medi._switchMediTab('${cfg.cta.tab}')"` : ''}>
                   <i class="bi bi-calendar-plus me-1"></i>${cfg.cta.label}
                 </button>`
              : '';
            container.innerHTML = `
              <div class="medi-empty-state">
                <i class="bi ${cfg.icon} medi-empty-icon"></i>
                <div class="fw-bold text-muted small mb-1">${cfg.msg}</div>
                <div class="text-muted" style="font-size:0.78rem;">${cfg.sub}</div>
                ${ctaHtml}
              </div>`;
            return;
          }

          container.innerHTML = list.map(c => {
            const fecha = c.safeDate || new Date();
            const now = new Date();
            const dayName = fecha.toLocaleDateString('es-MX', { weekday: 'long' });
            const dayNum = fecha.getDate();
            const monthName = fecha.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase();
            const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const diffMs = fecha - now;
            const diffDays = Math.ceil(diffMs / 86400000);
            const countdown = diffMs > 0
              ? (diffDays === 0 ? '¡Hoy!' : diffDays === 1 ? 'Mañana' : `En ${diffDays} días`)
              : 'Pasada';
            const encoded = encodeURIComponent(JSON.stringify(c));
            const citaCtx = encodeURIComponent(`Conversación desde cita · ${dayName} ${dayNum} · ${timeStr} · ${c.tipoServicio || 'Consulta'}`);
            const isPsi = c.tipoServicio === 'Psicologo';
            const serviceLabel = isPsi ? 'Psicología' : 'Médico General';
            const serviceIcon = isPsi ? 'bi-chat-heart-fill' : 'bi-bandaid-fill';
            const serviceColor = isPsi ? '#6f42c1' : '#0d6efd';
            const motivoClean = escapeHtml(c.motivo?.replace(/^\[[^\]]+\]\s*/, '') || 'Consulta General');

            if (type === 'pendientes') {
              const queueId = 'queue-pos-' + c.id;
              _loadQueuePosition(c.id, c.tipoServicio, c.safeDate);
              return `
              <div class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div class="d-flex">
                  <!-- Bloque fecha lateral -->
                  <div class="d-flex flex-column align-items-center justify-content-center px-3 py-3 flex-shrink-0 text-white" style="background:linear-gradient(180deg,#f59e0b,#d97706);min-width:64px;">
                    <div class="fw-bold" style="font-size:.6rem;letter-spacing:1px;opacity:.85;">${dayName.slice(0, 3).toUpperCase()}</div>
                    <div class="fw-black" style="font-size:1.8rem;line-height:1;">${dayNum}</div>
                    <div style="font-size:.6rem;opacity:.85;">${monthName}</div>
                  </div>
                  <!-- Contenido -->
                  <div class="flex-grow-1 p-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <div>
                        <span class="badge bg-warning text-dark rounded-pill" style="font-size:.65rem;"><i class="bi bi-clock-history me-1"></i>Pendiente</span>
                        <span class="badge ms-1 rounded-pill" style="background:${serviceColor}15;color:${serviceColor};font-size:.65rem;"><i class="bi ${serviceIcon} me-1"></i>${serviceLabel}</span>
                      </div>
                      <div class="dropdown">
                        <button class="btn btn-sm btn-light rounded-circle p-1" style="width:28px;height:28px;" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical" style="font-size:.75rem;"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                          <li><a class="dropdown-item small" href="#" onclick="Medi.prepararEdicion('${encoded}');return false;"><i class="bi bi-pencil me-2 text-primary"></i>Re-agendar</a></li>
                          <li><a class="dropdown-item small text-danger" href="#" onclick="Medi.solicitarCancelacion('${c.id}');return false;"><i class="bi bi-x-circle me-2"></i>Cancelar</a></li>
                        </ul>
                      </div>
                    </div>
                    <div class="fw-bold text-dark">${timeStr} hrs <span class="badge rounded-pill text-white ms-1" style="background:${diffMs > 0 ? '#10b981' : '#6c757d'};font-size:.6rem;">${countdown}</span></div>
                    <div class="small text-muted text-truncate mb-2" style="max-width:200px;">${motivoClean}</div>
                    <div id="${queueId}" style="font-size:.72rem;"></div>
                    ${c.profesionalName ? `<div class="small text-muted mt-1"><i class="bi bi-person-fill me-1" style="color:${serviceColor};"></i>${escapeHtml(c.profesionalName)}</div>` : ''}
                    <div class="d-flex gap-2 mt-2">
                      <button class="btn btn-outline-secondary btn-sm rounded-pill flex-fill py-1 fw-bold" style="font-size:.75rem;" onclick="Medi.prepararEdicion('${encoded}')"><i class="bi bi-pencil me-1"></i>Re-agendar</button>
                      ${c.profesionalId ? `<button class="btn btn-outline-primary btn-sm rounded-pill flex-fill py-1 fw-bold" style="font-size:.75rem;" onclick="Medi.startChatWithProfessional('${c.profesionalId}','${escapeHtml(c.profesionalName || 'Doctor')}','${c.profesionalProfileId || ''}',decodeURIComponent('${citaCtx}'))"><i class="bi bi-chat-dots me-1"></i>Contactar</button>` : ''}
                    </div>
                  </div>
                </div>
              </div>`;
            } else if (type === 'confirmadas') {
              const docName = c.profesionalName || (c.profesionalEmail ? c.profesionalEmail.split('@')[0] : 'Especialista');
              const docInitial = (docName || 'D')[0].toUpperCase();
              const isNew = highlights.has(c.id);
              const encodedCita = encodeURIComponent(JSON.stringify(c));
              return `
              <div class="card border-0 shadow-sm rounded-4 overflow-hidden ${isNew ? 'medi-card-confirmada' : ''}">
                <div class="d-flex">
                  <!-- Bloque fecha lateral -->
                  <div class="d-flex flex-column align-items-center justify-content-center px-3 py-3 flex-shrink-0 text-white" style="background:linear-gradient(180deg,#198754,#10b981);min-width:64px;">
                    <div class="fw-bold" style="font-size:.6rem;letter-spacing:1px;opacity:.85;">${dayName.slice(0, 3).toUpperCase()}</div>
                    <div class="fw-black" style="font-size:1.8rem;line-height:1;">${dayNum}</div>
                    <div style="font-size:.6rem;opacity:.85;">${monthName}</div>
                  </div>
                  <!-- Contenido -->
                  <div class="flex-grow-1 p-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <div>
                        <span class="badge bg-success rounded-pill" style="font-size:.65rem;"><i class="bi bi-check-circle me-1"></i>Confirmada</span>
                        <span class="badge ms-1 rounded-pill" style="background:${serviceColor}15;color:${serviceColor};font-size:.65rem;"><i class="bi ${serviceIcon} me-1"></i>${serviceLabel}</span>
                      </div>
                      <button class="btn btn-sm rounded-circle p-1 text-danger" style="width:28px;height:28px;background:rgba(220,53,69,0.08);" title="Cancelar" onclick="Medi.solicitarCancelacion('${c.id}')"><i class="bi bi-x" style="font-size:.85rem;"></i></button>
                    </div>
                    <div class="fw-bold text-dark">${timeStr} hrs <span class="badge rounded-pill text-white ms-1" style="background:${diffMs > 0 ? '#198754' : '#6c757d'};font-size:.6rem;">${countdown}</span></div>
                    <div class="small text-muted text-truncate mb-1" style="max-width:200px;">${motivoClean}</div>
                    <!-- Profesional -->
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0" style="width:26px;height:26px;background:${serviceColor};font-size:.7rem;">${docInitial}</div>
                      <div class="small fw-bold text-truncate" style="color:${serviceColor};">${escapeHtml(docName)}</div>
                    </div>
                    <!-- Recordatorio -->
                    ${diffMs > 0 ? `<div class="rounded-2 px-2 py-1 mb-2 d-flex align-items-center gap-1" style="background:#fffbeb;font-size:.68rem;color:#92400e;"><i class="bi bi-alarm-fill me-1"></i>Llega 10 min antes · trae tu credencial</div>` : ''}
                    <div class="d-flex gap-2">
                      ${c.profesionalId ? `<button class="btn btn-success btn-sm rounded-pill flex-fill py-1 fw-bold" style="font-size:.75rem;" onclick="Medi.startChatWithProfessional('${c.profesionalId}','${escapeHtml(docName)}','${c.profesionalProfileId || ''}',decodeURIComponent('${citaCtx}'))"><i class="bi bi-chat-dots-fill me-1"></i>Chat</button>` : ''}
                      <button class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1" style="font-size:.75rem;" title="Añadir al calendario" onclick="Medi._addToCalendar('${encodedCita}')"><i class="bi bi-calendar-plus"></i></button>
                    </div>
                  </div>
                </div>
              </div>`;
            } else { // Canceladas
              const isNoShow = !!c.noShow || /no asist/i.test(String(c.motivoCancelacion || ''));
              const cancelador = isNoShow
                ? 'No asistio'
                : (c.canceladoPor === 'admin' || c.canceladoPor === 'servicio' ? 'Por el servicio' : 'Por ti');
              return `
              <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div class="d-flex">
                  <div class="d-flex flex-column align-items-center justify-content-center px-3 py-3 flex-shrink-0 text-white" style="background:linear-gradient(180deg,#dc3545,#b91c1c);min-width:64px;opacity:.7;">
                    <div class="fw-bold" style="font-size:.6rem;letter-spacing:1px;">${dayName.slice(0, 3).toUpperCase()}</div>
                    <div class="fw-black" style="font-size:1.8rem;line-height:1;">${dayNum}</div>
                    <div style="font-size:.6rem;">${monthName}</div>
                  </div>
                  <div class="flex-grow-1 p-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <span class="badge bg-danger bg-opacity-75 rounded-pill" style="font-size:.65rem;">Cancelada</span>
                      <span class="badge bg-secondary bg-opacity-25 text-secondary rounded-pill" style="font-size:.6rem;"><i class="bi ${serviceIcon} me-1"></i>${serviceLabel}</span>
                    </div>
                    <div class="fw-bold text-muted text-decoration-line-through">${timeStr} hrs</div>
                    <div class="small text-muted text-truncate mb-1">${motivoClean}</div>
                    <div class="d-flex align-items-center gap-2 mt-1">
                      <span class="badge rounded-pill ${isNoShow ? 'bg-warning-subtle text-warning-emphasis' : 'bg-light text-secondary'}" style="font-size:.65rem;"><i class="bi bi-${isNoShow ? 'person-x' : 'person'} me-1"></i>${cancelador}</span>
                      ${c.motivoCancelacion ? `<span class="small text-danger fst-italic text-truncate" style="max-width:150px;">${escapeHtml(c.motivoCancelacion)}</span>` : ''}
                    </div>
                    <button class="btn btn-outline-primary btn-sm rounded-pill mt-2 px-3 fw-bold" style="font-size:.75rem;" onclick="Medi._switchMediTab('medi-tab-agendar')"><i class="bi bi-arrow-repeat me-1"></i>Reagendar</button>
                  </div>
                </div>
              </div>`;
            }
          }).join('');

          if (type === 'canceladas') {
            const cards = Array.from(container.children);
            const hiddenCards = cards.slice(5);
            hiddenCards.forEach((card) => card.classList.add('d-none', 'medi-cancelled-extra'));

            const oldToggle = container.parentElement?.querySelector('[data-medi-cancelled-toggle="true"]');
            if (oldToggle) oldToggle.remove();

            if (hiddenCards.length > 0 && container.parentElement) {
              const toggleWrap = document.createElement('div');
              toggleWrap.className = 'text-center mt-3';
              toggleWrap.dataset.mediCancelledToggle = 'true';
              toggleWrap.innerHTML = `
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3">
                  Ver ${hiddenCards.length} cancelada${hiddenCards.length === 1 ? '' : 's'} mas
                </button>`;
              const toggleBtn = toggleWrap.querySelector('button');
              toggleBtn?.addEventListener('click', () => {
                const expanded = toggleBtn.dataset.expanded === 'true';
                hiddenCards.forEach((card) => card.classList.toggle('d-none', expanded));
                toggleBtn.dataset.expanded = expanded ? 'false' : 'true';
                toggleBtn.textContent = expanded
                  ? `Ver ${hiddenCards.length} cancelada${hiddenCards.length === 1 ? '' : 's'} mas`
                  : 'Ver menos';
              });
              container.parentElement.appendChild(toggleWrap);
            }
          }
        };

        renderCarousel(cPend, pending, 'pendientes');
        renderCarousel(cConf, confirmed, 'confirmadas', newlyConfirmed);

        renderCarousel(cCanc, cancelled, 'canceladas');
      }

      // 2. MEDICAL RECORDS (Expedientes)
      if (items.type === 'expedientes') {
        const expedientes = _ensureStudentArray(items.data, 'expedientes');

        // Guardar para modal de historial completo y filtros
        _lastConsultasFull = expedientes;

        // Follow-up banner (M8)
        _renderFollowUpBanner(expedientes);
        _renderDocumentsPanel(expedientes);

        // Stats personales en pestaña Historial (N4)
        _renderHistoryStats(expedientes);

        // Render timeline con filtro activo (M2)
        const filtered = _historialFilterActivo === 'todos' ? _lastConsultasFull
          : _lastConsultasFull.filter((e) => _normalizeStudentServiceType(e.tipoServicio) === _normalizeStudentServiceType(_historialFilterActivo));
        _renderHistorialList(filtered);

        // Encuesta post-consulta (N8) — primer renderizado tras recibir datos
        _initPostConsultSurvey();
      } // if (expedientes)
    }); // callback
  } // function



  // E3: Render follow-up banner for student — delega a la versión completa (M8)
  function _renderFollowUpBanner(expedientes) {
    _renderFollowUpBannerComplete(_ensureStudentArray(expedientes, 'expedientes'));
  }

  // ============================================================
  // NEW FUNCTIONS — Hero, Quick Actions, Tab Switch, Queue, Tour
  // ============================================================

  /** Personaliza el hero banner con nombre del usuario */
  function _updateHeroGreeting(user) {
    const greetEl = document.getElementById('medi-hero-greeting');
    const subEl = document.getElementById('medi-hero-subtitle');
    if (!greetEl) return;

    const hour = new Date().getHours();
    let saludo = 'Buenos dias';
    if (hour >= 12 && hour < 18) saludo = 'Buenas tardes';
    else if (hour >= 18) saludo = 'Buenas noches';

    const nombre = (user.displayName || '').split(' ')[0] || 'Estudiante';
    greetEl.textContent = `${saludo}, ${nombre}`;

    if (subEl) {
      const frases = [
        'Tu salud es lo más importante.',
        'Estamos aqui para cuidarte.',
        'Agenda tu cita en segundos.'
      ];
      subEl.textContent = frases[Math.floor(Math.random() * frases.length)];
    }
  }

  /** Badge en hero mostrando proxima cita con countdown preciso o CTA si no hay cita */
  function _renderHeroNextAppointment(cita) {
    const badge = document.getElementById('medi-hero-next-badge');
    if (!badge) return;

    if (!cita || !cita.safeDate) {
      badge.innerHTML = `
        <button class="btn btn-sm bg-opacity-20 text-white border-white border-opacity-25 rounded-pill px-3 mt-1"
          onclick="Medi._switchMediTab('medi-tab-agendar')" style="font-size:.75rem;">
          <i class="bi bi-calendar-plus me-1"></i>¿Te sientes mal? Agenda ahora →
        </button>`;
      badge.classList.remove('d-none');
      return;
    }

    const now = new Date();
    const diffMs = cita.safeDate - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let label = '';
    let labelClass = '';
    if (diffMins < 0) { label = 'En curso'; labelClass = 'text-success'; }
    else if (diffMins < 60) { label = `En ${diffMins} min`; labelClass = 'text-warning'; }
    else if (diffHours < 24) { label = `Hoy, en ${diffHours}h`; labelClass = 'text-primary'; }
    else if (diffDays === 1) { label = 'Mañana'; labelClass = 'text-primary'; }
    else { label = `En ${diffDays} días`; labelClass = 'text-muted'; }

    const timeStr = cita.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const icon = cita.tipoServicio === 'Psicologo' ? 'chat-heart' : 'bandaid';
    const servicio = cita.tipoServicio === 'Psicologo' ? 'Psicología' : 'Médico';

    badge.innerHTML = `
      <span class="badge bg-white shadow-sm rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2" style="font-size:0.75rem;">
        <i class="bi bi-${icon}-fill text-primary"></i>
        <span class="text-dark"><strong class="${labelClass}">${label}</strong> · ${timeStr} · ${servicio}</span>
      </span>`;
    badge.classList.remove('d-none');
  }

  /** Card en Tab Inicio con posicion en cola y tiempo estimado */
  function _renderQueueCard(pendingCita) {
    const container = document.getElementById('medi-queue-card');
    if (!container) return;

    if (!pendingCita) {
      container.classList.add('d-none');
      container.innerHTML = '';
      return;
    }

    const fecha = pendingCita.safeDate || new Date();
    const dateStr = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const encoded = encodeURIComponent(JSON.stringify(pendingCita));

    container.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4 medi-queue-live" style="border-left: 4px solid #f59e0b !important;">
        <div class="card-body p-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="badge bg-warning text-dark rounded-pill">
              <i class="bi bi-hourglass-split me-1"></i>En Sala de Espera
            </span>
            <div id="queue-pos-home-${pendingCita.id}" class="small"></div>
          </div>
          <div class="fw-bold text-dark mb-1">${dateStr}</div>
          <div class="d-flex align-items-center gap-3 text-muted small mb-2">
            <span><i class="bi bi-clock me-1"></i>${timeStr}</span>
            <span><i class="bi bi-${pendingCita.tipoServicio === 'Psicologo' ? 'chat-heart' : 'bandaid'} me-1"></i>${pendingCita.tipoServicio}</span>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-warning rounded-pill flex-fill fw-bold" onclick="Medi.prepararEdicion('${encoded}')">
              <i class="bi bi-pencil me-1"></i>Re-agendar
            </button>
            <button class="btn btn-sm btn-outline-danger rounded-pill flex-fill fw-bold" onclick="Medi.solicitarCancelacion('${pendingCita.id}')">
              <i class="bi bi-x-lg me-1"></i>Cancelar
            </button>
          </div>
        </div>
      </div>`;
    container.classList.remove('d-none');

    // Load queue position into the home card too
    _loadQueuePosition(pendingCita.id, pendingCita.tipoServicio, pendingCita.safeDate, `queue-pos-home-${pendingCita.id}`);
  }

  /** Grid 2x3 de acciones rapidas */
  function _renderQuickActions() {
    const container = document.getElementById('medi-quick-actions');
    if (!container) return;

    const actions = [
      { icon: 'calendar-plus-fill', label: 'Nueva Cita', color: '#0d6efd', bg: 'rgba(13,110,253,0.08)', tab: 'medi-tab-agendar' },
      { icon: 'calendar-week', label: 'Mis Citas', color: '#0dcaf0', bg: 'rgba(13,202,240,0.08)', tab: 'medi-tab-citas' },
      { icon: 'chat-dots-fill', label: 'Mensajes', color: '#6f42c1', bg: 'rgba(111,66,193,0.08)', action: 'chat' },
      { icon: 'clipboard2-pulse-fill', label: 'Expediente', color: '#198754', bg: 'rgba(25,135,84,0.08)', tab: 'medi-tab-historial' },
      { icon: 'person-heart', label: 'Mi Salud', color: '#e91e8c', bg: 'rgba(233,30,140,0.08)', action: 'health' },
      { icon: 'heart-pulse-fill', label: 'Urgencias', color: '#dc3545', bg: 'rgba(220,53,69,0.08)', action: 'sos' }
    ];

    container.innerHTML = actions.map(a => {
      let onclick;
      if (a.action === 'chat') onclick = `Medi.openStudentChat()`;
      else if (a.action === 'health') onclick = `Medi._showHealthProfileModal()`;
      else if (a.action === 'sos') onclick = `Medi._showSOSModal()`;
      else onclick = `Medi._switchMediTab('${a.tab}')`;
      return `
      <div class="col-4">
        <div class="medi-quick-card card border-0 shadow-sm rounded-4 text-center p-2" onclick="${onclick}">
          <div class="mx-auto mb-1 d-flex align-items-center justify-content-center rounded-circle" style="width:38px;height:38px;background:${a.bg};">
            <i class="bi bi-${a.icon}" style="font-size:1.05rem;color:${a.color};"></i>
          </div>
          <div class="fw-bold text-dark" style="font-size:.72rem;">${a.label}</div>
        </div>
      </div>`;
    }).join('');
  }

  /** Cambio programatico de tab principal */
  function _switchMediTab(tabPaneId) {
    const tabsContainer = document.getElementById('medi-student-tabs');
    if (!tabsContainer) return;

    const targetBtn = tabsContainer.querySelector(`[data-bs-target="#${tabPaneId}"]`);
    if (targetBtn && window.bootstrap) {
      const tab = new bootstrap.Tab(targetBtn);
      tab.show();
      if (tabPaneId === 'medi-tab-agendar') {
        setTimeout(() => { _refreshStudentBookingLock(true); }, 120);
      }
      // Scroll to top of tabs area
      const app = document.getElementById('medi-student-app');
      if (app) app.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /** Badge de mensajes no leidos en Quick Actions */
  function _updateChatBadgeOnTab(count) {
    // Update the quick action card for messages
    const quickActions = document.getElementById('medi-quick-actions');
    if (!quickActions) return;
    const msgBadge = quickActions.querySelector('.medi-chat-badge-qa');
    if (count > 0 && !msgBadge) {
      const msgCard = quickActions.querySelectorAll('.medi-quick-card')[2];
      if (msgCard) {
        const badge = document.createElement('span');
        badge.className = 'medi-chat-badge-qa position-absolute top-0 end-0 translate-middle badge rounded-pill bg-danger';
        badge.style.fontSize = '0.6rem';
        badge.textContent = count > 9 ? '9+' : count;
        msgCard.style.position = 'relative';
        msgCard.appendChild(badge);
      }
    } else if (msgBadge) {
      if (count === 0) msgBadge.remove();
      else msgBadge.textContent = count > 9 ? '9+' : count;
    }
  }

  /** Helper: timestamp relativo ("hace 5 min", "ayer", etc.) */
  function _relativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    if (diff < 172800) return 'ayer';
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  /** Verifica db y localStorage y lanza tutorial en primera visita */
  async function initMediTutorial(uid) {
    // Restringir el tutorial solo a estudiantes
    const profile = window.Store?.userProfile || window.SIA?.currentUserProfile;
    if (profile && profile.role && profile.role !== 'student') return;

    // Usamos la misma clave que usa internamente el componente sia-onboarding-tour (_markCompleted)
    // para que no reaparezca tras haber sido completado.
    const SIA_TOUR_VERSION = window.SIA_TOUR_VERSION || 'v8';
    const componentKey = `sia_tutorial_done_${SIA_TOUR_VERSION}_${uid}`;
    // Clave adicional especifica del modulo medico
    const mediKey = `sia_medi_tour_v2_${uid}`;

    // Preferir DB primero
    try {
      if (uid && window.SIA?.getUserPreferences) {
        const prefs = await window.SIA.getUserPreferences(uid);
        if (prefs === null) return;
        if (prefs && (prefs[`tour_${SIA_TOUR_VERSION}`] || prefs[`medi_tour_v2`])) {
          return;
        }
      }
    } catch (e) {
      console.warn("Error check medi tutorial DB prefs", e);
      return;
    }

    if (localStorage.getItem(componentKey) || localStorage.getItem(mediKey)) return;
    // Delay para que el DOM este listo
    setTimeout(() => launchMediTutorial(), 800);
  }

  /** Crea instancia de sia-onboarding-tour con pasos del modulo medico */
  function launchMediTutorial() {
    const uid = _ctx && _ctx.user ? _ctx.user.uid : '';
    const mediKey = `sia_medi_tour_v2_${uid}`;

    // Remove existing tour if any
    const existing = document.querySelector('sia-onboarding-tour.medi-tour');
    if (existing) existing.remove();

    // Pasos del tutorial del modulo medico
    const mediSteps = [
      {
        target: null,
        title: 'Bienvenido al Servicio Médico',
        description: 'Aquí puedes agendar citas médicas y de psicología, revisar tu historial, dar seguimiento a tu bienestar y chatear con profesionales de salud.',
        position: 'center'
      },
      {
        target: '#medi-hero',
        title: 'Tu dashboard médico',
        description: 'Este panel resume tu estado actual, accesos rápidos y la información más importante de tu atención.',
        position: 'bottom'
      },
      {
        target: '#medi-emergency-chip',
        title: 'Datos de emergencia',
        description: 'Mantén actualizados tu tipo de sangre, alergias y contacto de emergencia. Toca "Editar" para actualizarlos.',
        position: 'bottom'
      },
      {
        target: '#medi-quick-actions',
        title: 'Acciones rápidas',
        description: 'Desde aquí puedes ir directo a agendar, revisar tus citas, abrir mensajes o consultar tu expediente.',
        position: 'top'
      },
      {
        target: '#medi-availability-card',
        title: 'Disponibilidad del servicio',
        description: 'Aquí ves si Medicina o Psicología están disponibles, el horario activo y la próxima apertura.',
        position: 'bottom'
      },
      {
        target: '#medi-checkin-widget',
        title: 'Chequeo de bienestar',
        description: 'Registra cómo te sientes cada día y revisa tu historial reciente con promedios, racha y tendencia.',
        position: 'top'
      },
      {
        target: '[data-bs-target="#medi-tab-agendar"]',
        title: 'Agendar una cita',
        description: 'Selecciona el tipo de servicio, revisa los horarios disponibles y confirma tu reservación.',
        position: 'bottom'
      },
      {
        target: '[data-bs-target="#medi-tab-citas"]',
        title: 'Tus citas activas',
        description: 'Aquí puedes ver si tu cita está pendiente, confirmada o cancelada, además de cambiarla, cancelarla o contactar al profesional.',
        position: 'bottom'
      },
      {
        target: '[data-bs-target="#medi-tab-historial"]',
        title: 'Tu historial médico',
        description: 'Consulta tu expediente, revisa diagnósticos, tratamientos y abre tus documentos recientes desde la misma sección.',
        position: 'bottom'
      },
      {
        target: '#medi-chat-float-btn',
        title: 'Mensajes de seguimiento',
        description: 'Usa este botón para abrir tus conversaciones y resolver dudas breves sobre tu cita, receta o seguimiento.',
        position: 'bottom'
      },
      {
        target: null,
        title: 'Todo listo',
        description: 'Ya conoces las herramientas del Servicio Médico. Si necesitas ayuda, toca el botón "Tutorial" en cualquier momento.',
        position: 'center'
      }
    ];

    const tour = document.createElement('sia-onboarding-tour');
    tour.className = 'medi-tour';

    // IMPORTANTE: appendChild dispara connectedCallback → _defineSteps() que sobreescribe _steps.
    // Por eso asignamos los steps DESPUES de insertar en el DOM.
    document.body.appendChild(tour);

    // Ahora sobrescribimos los steps del dashboard con los del modulo medico
    tour._steps = mediSteps;

    // Parchamos _markCompleted para que guarde tambien nuestra clave de modulo
    const _origMarkCompleted = tour._markCompleted.bind(tour);
    tour._markCompleted = async function () {
      await _origMarkCompleted();

      try {
        if (uid && window.SIA?.updateUserPreferences) {
          await window.SIA.updateUserPreferences(uid, { medi_tour_v2: true });
        } else {
          localStorage.setItem(mediKey, 'done');
        }
      } catch (e) {
        localStorage.setItem(mediKey, 'done');
      }
    };

    // Start tour
    if (typeof tour.start === 'function') {
      tour.start();
    }
  }

  // === BANCO COMPLETO DE TIPS (25+) ===
  const _ALL_TIPS = [
    // Hidratación
    { icon: 'cup-hot', title: 'Hidratación diaria', text: 'Bebe al menos 2L de agua al día para mantener tu concentración y energía.', color: 'info', cat: 'Hidratación' },
    { icon: 'droplet-fill', title: 'Agua en clases', text: 'Lleva una botella reutilizable a clases. La deshidratación leve reduce el rendimiento cognitivo.', color: 'info', cat: 'Hidratación' },
    { icon: 'cup-straw', title: 'Hidratación al despertar', text: 'Toma un vaso de agua al levantarte antes de desayunar para reactivar tu metabolismo.', color: 'info', cat: 'Hidratación' },
    // Sueño
    { icon: 'brightness-high', title: 'Sueño reparador', text: 'Dormir 7-8 horas mejora la memoria, el estado de ánimo y reduce el estrés académico.', color: 'warning', cat: 'Sueño' },
    { icon: 'moon-stars', title: 'Rutina de sueño', text: 'Duerme y despierta a la misma hora. Un horario regular programa tu reloj biológico.', color: 'warning', cat: 'Sueño' },
    { icon: 'phone-flip', title: 'Desconéctate antes de dormir', text: 'Evita pantallas 30 minutos antes de dormir. La luz azul dificulta conciliar el sueño.', color: 'warning', cat: 'Sueño' },
    // Nutrición
    { icon: 'apple', title: 'Come bien, rinde más', text: 'Incluye frutas y verduras en cada comida. Evita el exceso de comida chatarra.', color: 'success', cat: 'Nutrición' },
    { icon: 'egg-fried', title: 'Desayuno obligatorio', text: 'Nunca saltes el desayuno: es el combustible para tus primeras clases y mejora la concentración.', color: 'success', cat: 'Nutrición' },
    { icon: 'basket2', title: 'Snacks saludables', text: 'Prefiere nueces, fruta o yogurt como snack. Evita bebidas energéticas y ultraprocesados.', color: 'success', cat: 'Nutrición' },
    { icon: 'cookie', title: 'Azúcar con moderación', text: 'El exceso de azúcar causa picos de energía y bajones. Mejor carbohidratos complejos.', color: 'success', cat: 'Nutrición' },
    // Ejercicio
    { icon: 'activity', title: 'Muévete cada día', text: 'Camina 30 minutos al día. ¡Usa las canchas del Tec o el camino al campus!', color: 'danger', cat: 'Ejercicio' },
    { icon: 'bicycle', title: 'Estiramientos en clase', text: 'Cada hora de estudio, toma 5 minutos para estirar. Reduce la tensión muscular y mejora la circulación.', color: 'danger', cat: 'Ejercicio' },
    { icon: 'person-arms-up', title: 'Ejercicio y estrés', text: 'El ejercicio libera endorfinas que reducen el estrés y mejoran el estado de ánimo.', color: 'danger', cat: 'Ejercicio' },
    // Salud Mental
    { icon: 'emoji-smile', title: 'Pide ayuda', text: 'Si sientes ansiedad o estrés constante, no lo cargues solo. Agenda con psicología, es confidencial.', color: 'primary', cat: 'Salud Mental' },
    { icon: 'journal-heart', title: 'Escribe cómo te sientes', text: 'Llevar un diario emocional ayuda a procesar el estrés y organizar tus pensamientos.', color: 'primary', cat: 'Salud Mental' },
    { icon: 'wind', title: 'Respiración profunda', text: 'En momentos de estrés: inhala 4 seg, sostén 4, exhala 4. Repite 3 veces para calmarte.', color: 'primary', cat: 'Salud Mental' },
    { icon: 'people-fill', title: 'Socializa y conéctate', text: 'El aislamiento agrava el estrés. Comparte tiempo con compañeros, aunque sea 15 minutos.', color: 'primary', cat: 'Salud Mental' },
    // Prevención
    { icon: 'eye', title: 'Regla 20-20-20', text: 'Cada 20 min de pantalla, mira algo a 20 pies por 20 segundos. Previene fatiga visual.', color: 'secondary', cat: 'Prevención' },
    { icon: 'hand-thumbs-up', title: 'Lávate las manos', text: 'Lavar las manos por 20 segundos con jabón previene el 80% de infecciones respiratorias.', color: 'secondary', cat: 'Prevención' },
    { icon: 'shield-check', title: 'Vacúnate', text: 'Mantén tus vacunas al día. Pregunta en el servicio médico sobre el esquema de vacunación.', color: 'secondary', cat: 'Prevención' },
    { icon: 'thermometer-sun', title: 'Protección solar', text: 'En Los Cabos el sol es intenso. Usa protector solar, lentes y sombrero en exteriores.', color: 'secondary', cat: 'Prevención' },
    { icon: 'heart-pulse', title: 'Revisiones preventivas', text: 'No esperes a estar enfermo para venir. Las consultas preventivas detectan problemas a tiempo.', color: 'secondary', cat: 'Prevención' },
    { icon: 'lungs', title: 'Postura correcta', text: 'Ajusta tu silla para que los pies toquen el suelo y la pantalla esté a la altura de los ojos.', color: 'secondary', cat: 'Prevención' },
    // Extra
    { icon: 'music-note', title: 'Música y estudio', text: 'La música instrumental o lofi sin letra puede mejorar tu concentración al estudiar.', color: 'info', cat: 'Bienestar' },
    { icon: 'tree', title: 'Tiempo al aire libre', text: '15 minutos al día en espacios abiertos reduce el cortisol y mejora el estado de ánimo.', color: 'success', cat: 'Bienestar' },
  ];

  function loadWellnessFeed() {
    const container = document.getElementById('medi-wellness-tips');
    if (!container) return;

    // Mostrar 3 tips aleatorios (diferentes en cada sesión)
    const shuffled = [..._ALL_TIPS].sort(() => 0.5 - Math.random()).slice(0, 3);

    container.innerHTML = shuffled.map(t => `
      <div class="d-flex align-items-start gap-3 p-2 mb-2 border rounded-3 bg-white shadow-sm">
        <div class="bg-${t.color} bg-opacity-10 p-2 rounded-3 text-${t.color} flex-shrink-0">
          <i class="bi bi-${t.icon}"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-bold small text-dark">${t.title}</div>
          <p class="text-muted mb-0" style="font-size:0.75rem;">${t.text}</p>
          <span class="badge bg-light text-muted border" style="font-size:.6rem; margin-top:2px;">${t.cat}</span>
        </div>
      </div>
    `).join('');
  }

  /** Abre modal con todos los tips organizados por categoría */
  function _openWellnessTipsModal() {
    const modalId = 'modalMediTips';
    let modal = document.getElementById(modalId);
    if (modal) { new bootstrap.Modal(modal).show(); return; }

    const cats = [...new Set(_ALL_TIPS.map(t => t.cat))];
    const colorMap = { 'Hidratación': 'info', 'Sueño': 'warning', 'Nutrición': 'success', 'Ejercicio': 'danger', 'Salud Mental': 'primary', 'Prevención': 'secondary', 'Bienestar': 'info' };

    const catBtns = cats.map((c, i) =>
      `<button class="btn btn-sm btn-outline-secondary rounded-pill medi-tip-cat-btn ${i === 0 ? 'active' : ''}" onclick="Medi._filterTipsModal('${c}', this)">${c}</button>`
    ).join('');

    const tipsList = (cat) => _ALL_TIPS.filter(t => t.cat === cat).map(t => `
      <div class="d-flex align-items-start gap-3 p-2 mb-2 border rounded-3 bg-white shadow-sm medi-tip-item" data-cat="${t.cat}">
        <div class="bg-${colorMap[t.cat] || 'secondary'} bg-opacity-10 p-2 rounded-3 text-${colorMap[t.cat] || 'secondary'} flex-shrink-0"><i class="bi bi-${t.icon}"></i></div>
        <div><div class="fw-bold small text-dark">${t.title}</div><p class="text-muted mb-0" style="font-size:.75rem;">${t.text}</p></div>
      </div>`).join('');

    const allTipsHtml = cats.map(c => tipsList(c)).join('');

    const d = document.createElement('div');
    d.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content border-0 shadow-lg rounded-4">
            <div class="modal-header border-0 pb-0">
              <div><h5 class="fw-bold mb-1"><i class="bi bi-lightbulb-fill text-warning me-2"></i>Todos los Tips de Salud</h5>
              <p class="text-muted small mb-0">${_ALL_TIPS.length} consejos para tu bienestar</p></div>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body pt-2">
              <div class="d-flex gap-2 flex-wrap mb-3">${catBtns}</div>
              <div id="medi-tips-list">${allTipsHtml}</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
    modal = document.getElementById(modalId);
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    new bootstrap.Modal(modal).show();
  }

  /** Filtra tips en el modal por categoría */
  function _filterTipsModal(cat, btn) {
    document.querySelectorAll('.medi-tip-cat-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
    btn.classList.add('active');
    const items = document.querySelectorAll('.medi-tip-item');
    const showAll = cat === 'Todos';
    items.forEach(el => {
      el.classList.toggle('d-none', !showAll && el.dataset.cat !== cat);
    });
  }

  // ============================================================
  // N1: CHECK-IN DE BIENESTAR DIARIO
  // ============================================================

  const _CHECKIN_OPTIONS = [
    { val: 1, emoji: '😫', label: 'Muy mal', color: '#dc3545' },
    { val: 2, emoji: '😕', label: 'Mal', color: '#fd7e14' },
    { val: 3, emoji: '😐', label: 'Regular', color: '#ffc107' },
    { val: 4, emoji: '🙂', label: 'Bien', color: '#20c997' },
    { val: 5, emoji: '😁', label: 'Excelente', color: '#198754' }
  ];

  function _getCheckinTodayIso() {
    const dNow = new Date();
    return `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
  }

  function _getCheckinHistoryKey(uid) {
    return `medi_checkin_hist_${uid}`;
  }

  function _getCheckinExpandedKey(uid) {
    return `medi_checkin_hist_open_${uid}`;
  }

  function _getCheckinDayKey(uid, isoDate) {
    return `medi_checkin_${uid}_${isoDate}`;
  }

  function _getCheckinHistory(uid) {
    let raw = {};
    try {
      raw = JSON.parse(localStorage.getItem(_getCheckinHistoryKey(uid)) || '{}') || {};
    } catch (e) {
      raw = {};
    }

    const normalized = {};
    Object.entries(raw).forEach(([isoDate, value]) => {
      if (!isoDate) return;
      if (value && typeof value === 'object') {
        const score = parseInt(value.score ?? value.value ?? 0, 10);
        if (score >= 1 && score <= 5) normalized[isoDate] = { score, savedAt: value.savedAt || null };
        return;
      }
      const score = parseInt(value, 10);
      if (score >= 1 && score <= 5) normalized[isoDate] = { score, savedAt: null };
    });
    return normalized;
  }

  function _saveCheckinHistory(uid, history) {
    localStorage.setItem(_getCheckinHistoryKey(uid), JSON.stringify(history));
  }

  function _getCheckinEntries(uid) {
    return Object.entries(_getCheckinHistory(uid))
      .map(([isoDate, entry]) => ({ isoDate, score: entry.score, savedAt: entry.savedAt || null }))
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }

  function _getCheckinStreak(history, todayIso) {
    const cursor = new Date(`${todayIso}T12:00:00`);
    if (!history[todayIso]) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (true) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!history[isoDate]) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function _getCheckinTrendText(entries) {
    if ((entries || []).length < 3) return 'Sigue registrando tu bienestar para ver una tendencia más clara.';
    const recent = entries.slice(0, 3).map((entry) => entry.score);
    const previous = entries.slice(3, 6).map((entry) => entry.score);
    if (previous.length === 0) return 'Ya tienes varios registros. En unos días más podrás comparar tu progreso.';
    const avgRecent = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const avgPrevious = previous.reduce((sum, value) => sum + value, 0) / previous.length;
    const diff = avgRecent - avgPrevious;
    if (diff >= 0.5) return 'Tu bienestar va en mejora en los últimos días.';
    if (diff <= -0.5) return 'Se observa una baja reciente; si lo necesitas, agenda apoyo o escríbenos por chat.';
    return 'Tu bienestar se mantiene estable esta semana.';
  }

  function _toggleCheckinHistory(uid) {
    const key = _getCheckinExpandedKey(uid);
    const isOpen = localStorage.getItem(key) === '1';
    localStorage.setItem(key, isOpen ? '0' : '1');
    _renderDailyCheckin(uid);
  }

  function _renderDailyCheckinV2(uid) {
    const container = document.getElementById('medi-checkin-widget');
    if (!container) return;

    const today = _getCheckinTodayIso();
    const todayValue = parseInt(localStorage.getItem(_getCheckinDayKey(uid, today)) || '0', 10);
    const history = _getCheckinHistory(uid);
    const entries = _getCheckinEntries(uid);
    const todayEntry = history[today] || (todayValue ? { score: todayValue } : null);
    const expanded = localStorage.getItem(_getCheckinExpandedKey(uid)) === '1';

    if (todayEntry && (!history[today] || history[today].score !== todayEntry.score)) {
      history[today] = { score: todayEntry.score, savedAt: Date.now() };
      _saveCheckinHistory(uid, history);
    }

    const chartDays = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      chartDays.push({ isoDate, label: d.toLocaleDateString('es-MX', { weekday: 'short' }).slice(0, 2), dayNum: d.getDate() });
    }

    const entries30 = entries.slice(0, 30);
    const lastSevenScores = chartDays.slice(-7).map((day) => history[day.isoDate]?.score || 0).filter(Boolean);
    const avgSeven = lastSevenScores.length ? (lastSevenScores.reduce((sum, value) => sum + value, 0) / lastSevenScores.length).toFixed(1) : '--';
    const avgThirty = entries30.length ? (entries30.reduce((sum, entry) => sum + entry.score, 0) / entries30.length).toFixed(1) : '--';
    const streak = _getCheckinStreak(history, today);
    const trendText = _getCheckinTrendText(entries30);
    const totalRecords = entries.length;
    const modeMap = {};
    entries30.forEach((entry) => { modeMap[entry.score] = (modeMap[entry.score] || 0) + 1; });
    const dominantScore = Object.keys(modeMap).sort((a, b) => modeMap[b] - modeMap[a])[0] || null;
    const dominantOption = _CHECKIN_OPTIONS.find((option) => option.val === parseInt(dominantScore || '0', 10)) || null;

    const chartHtml = chartDays.map((day) => {
      const score = history[day.isoDate]?.score || 0;
      const option = _CHECKIN_OPTIONS[score - 1] || null;
      const height = score ? 18 + (score * 12) : 8;
      return `
        <div class="d-flex flex-column align-items-center gap-1" style="flex:1;min-width:0;">
          <div style="height:84px;display:flex;align-items:flex-end;">
            <div style="width:18px;height:${height}px;background:${option ? option.color : '#e9ecef'};border-radius:6px 6px 0 0;min-height:6px;" title="${option ? `${option.label} · ${day.isoDate}` : `Sin registro · ${day.isoDate}`}"></div>
          </div>
          <div style="font-size:.58rem;color:#94a3b8;line-height:1;">${day.label}</div>
          <div style="font-size:.58rem;color:#cbd5e1;line-height:1;">${day.dayNum}</div>
        </div>`;
    }).join('');

    const historyHtml = entries30.length === 0
      ? '<div class="text-muted small text-center py-3">Empieza hoy para construir tu historial de bienestar.</div>'
      : entries30.map((entry) => {
        const option = _CHECKIN_OPTIONS[entry.score - 1] || _CHECKIN_OPTIONS[2];
        const dateLabel = new Date(`${entry.isoDate}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
        return `
          <div class="medi-checkin-entry px-3 py-2 d-flex align-items-center justify-content-between gap-3">
            <div>
              <div class="fw-bold small text-dark">${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</div>
              <div class="text-muted" style="font-size:.7rem;">Registro diario guardado</div>
            </div>
            <span class="badge rounded-pill" style="background:${option.color};">${option.emoji} ${option.label}</span>
          </div>`;
      }).join('');

    const todayBadge = todayEntry
      ? (() => {
        const option = _CHECKIN_OPTIONS[todayEntry.score - 1] || _CHECKIN_OPTIONS[2];
        return `<span class="badge rounded-pill" style="background:${option.color};">${option.emoji} Hoy: ${option.label}</span>`;
      })()
      : '<span class="badge bg-light text-primary border rounded-pill">Pendiente de hoy</span>';

    container.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4" style="background:linear-gradient(135deg,#f8fbff,#eef6ff);">
        <div class="card-body p-3">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
            <div>
              <h6 class="fw-bold mb-1 small" style="color:var(--medi);"><i class="bi bi-heart-pulse me-2"></i>Chequeo de bienestar</h6>
              <div class="text-muted" style="font-size:.72rem;">Registra cómo te sientes hoy y consulta tu avance reciente.</div>
            </div>
            ${todayBadge}
          </div>

          ${todayEntry ? `
            <div class="medi-checkin-summary-card mb-3">
              <div class="fw-bold small text-dark mb-1">Ya registraste tu día de hoy</div>
              <div class="text-muted" style="font-size:.72rem;">Tu historial se conserva y puedes revisarlo cuando quieras. Vuelve mañana para actualizarlo.</div>
            </div>`
        : `
            <div class="mb-3">
              <div class="text-dark fw-bold small mb-2">¿Cómo te sientes hoy?</div>
              <div class="medi-checkin-options">
                ${_CHECKIN_OPTIONS.map((option) => `
                  <div class="medi-checkin-opt text-center" onclick="Medi._submitCheckin(${option.val}, '${uid}')" title="${option.label}">
                    <div style="font-size:1.8rem;">${option.emoji}</div>
                    <div style="font-size:.66rem;color:#64748b;margin-top:2px;">${option.label}</div>
                  </div>`).join('')}
              </div>
            </div>`}

          <div class="row g-2 mb-3">
            <div class="col-4">
              <div class="medi-checkin-summary-card h-100">
                <div class="text-muted text-uppercase fw-bold" style="font-size:.6rem;letter-spacing:.4px;">Racha</div>
                <div class="fw-bold text-dark" style="font-size:1.1rem;">${streak || 0}</div>
                <div class="text-muted" style="font-size:.68rem;">día${streak === 1 ? '' : 's'} seguidos</div>
              </div>
            </div>
            <div class="col-4">
              <div class="medi-checkin-summary-card h-100">
                <div class="text-muted text-uppercase fw-bold" style="font-size:.6rem;letter-spacing:.4px;">Promedio</div>
                <div class="fw-bold text-dark" style="font-size:1.1rem;">${avgSeven}</div>
                <div class="text-muted" style="font-size:.68rem;">últimos 7 días</div>
              </div>
            </div>
            <div class="col-4">
              <div class="medi-checkin-summary-card h-100">
                <div class="text-muted text-uppercase fw-bold" style="font-size:.6rem;letter-spacing:.4px;">Registros</div>
                <div class="fw-bold text-dark" style="font-size:1.1rem;">${totalRecords}</div>
                <div class="text-muted" style="font-size:.68rem;">acumulados</div>
              </div>
            </div>
          </div>

          <div class="medi-checkin-summary-card mb-3">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
              <div class="fw-bold small text-dark">Últimos 14 días</div>
              <div class="text-muted" style="font-size:.68rem;">Promedio 30 días: ${avgThirty}</div>
            </div>
            <div class="d-flex gap-1 align-items-end" style="height:102px;">${chartHtml}</div>
            <div class="text-muted mt-2" style="font-size:.7rem;">
              <i class="bi bi-graph-up-arrow me-1"></i>${trendText}
              ${dominantOption ? `<span class="ms-2">Resultado más frecuente: <strong>${dominantOption.label.toLowerCase()}</strong>.</span>` : ''}
            </div>
          </div>

          <div class="d-flex align-items-center justify-content-between gap-2">
            <div class="text-muted" style="font-size:.7rem;">
              <i class="bi bi-journal-text me-1"></i>${entries30.length > 0 ? 'Puedes revisar tus últimos 30 registros.' : 'Aún no hay historial suficiente.'}
            </div>
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="Medi._toggleCheckinHistory('${uid}')">
              <i class="bi bi-${expanded ? 'chevron-up' : 'chevron-down'} me-1"></i>${expanded ? 'Ocultar historial' : 'Ver últimos 30 días'}
            </button>
          </div>

          ${expanded ? `<div class="medi-checkin-history-list d-grid gap-2 mt-3">${historyHtml}</div>` : ''}
        </div>
      </div>`;
  }

  function _submitCheckinV2(val, uid) {
    const today = _getCheckinTodayIso();
    localStorage.setItem(_getCheckinDayKey(uid, today), val);
    const history = _getCheckinHistory(uid);
    history[today] = { score: val, savedAt: Date.now() };
    _saveCheckinHistory(uid, history);
    if (val <= 2) showToast('Recuerda que puedes agendar con Psicología o escribir por chat si necesitas apoyo.', 'info');
    else showToast('Gracias por registrar cómo te sientes hoy.', 'success');
    _renderDailyCheckinV2(uid);
  }

  /** Renderiza el widget de check-in diario (localStorage, sin Firebase) */
  function _renderDailyCheckin(uid) {
    return _renderDailyCheckinV2(uid);
    const container = document.getElementById('medi-checkin-widget');
    if (!container) return;

    const dNow = new Date();
    const today = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
    const storageKey = `medi_checkin_${uid}_${today}`;
    const histKey = `medi_checkin_hist_${uid}`;
    const done = localStorage.getItem(storageKey);

    const opts = [
      { val: 1, emoji: '😫', label: 'Muy mal', color: '#dc3545' },
      { val: 2, emoji: '😔', label: 'Mal', color: '#fd7e14' },
      { val: 3, emoji: '😐', label: 'Regular', color: '#ffc107' },
      { val: 4, emoji: '🙂', label: 'Bien', color: '#20c997' },
      { val: 5, emoji: '😁', label: 'Excelente', color: '#198754' }
    ];

    if (done) {
      // Mostrar mini-gráfica de los últimos 7 días
      const hist = JSON.parse(localStorage.getItem(histKey) || '{}');
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        days.push({ iso: dIso, label: d.toLocaleDateString('es-MX', { weekday: 'short' }) });
      }
      const maxH = 100;
      const bars = days.map(d => {
        const v = hist[d.iso] || 0;
        const pct = v ? Math.round((v / 5) * maxH) : 4;
        const color = ['', '#dc3545', '#fd7e14', '#ffc107', '#20c997', '#198754'][v] || '#e9ecef';
        return `<div class="d-flex flex-column align-items-center gap-1" style="flex:1;">
          <div style="height:${maxH}px;display:flex;align-items:flex-end;">
            <div style="width:22px;height:${pct}px;background:${color};border-radius:4px 4px 0 0;min-height:4px;" title="${v ? opts[v - 1].label : 'Sin datos'}"></div>
          </div>
          <div style="font-size:.6rem;color:#94a3b8;">${d.label.slice(0, 2)}</div>
        </div>`;
      }).join('');

      const todayVal = parseInt(done);
      const todayOpt = opts[todayVal - 1] || opts[2];
      container.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4">
          <div class="card-body p-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="fw-bold mb-0 small" style="color:var(--medi);"><i class="bi bi-activity me-2"></i>Tu Bienestar</h6>
              <span class="badge rounded-pill" style="background:${todayOpt.color};">${todayOpt.emoji} Hoy: ${todayOpt.label}</span>
            </div>
            <div class="d-flex gap-1 align-items-end" style="height:110px;">${bars}</div>
            <div class="text-muted" style="font-size:.65rem;margin-top:4px;"><i class="bi bi-info-circle me-1"></i>Últimos 7 días · Regresa mañana para actualizar</div>
          </div>
        </div>`;
      return;
    }

    // Mostrar opciones de check-in
    container.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);">
        <div class="card-body p-3">
          <h6 class="fw-bold mb-1 small" style="color:var(--medi);"><i class="bi bi-heart-pulse me-2"></i>¿Cómo te sientes hoy?</h6>
          <p class="text-muted mb-2" style="font-size:.75rem;">Toca una opción para registrar tu bienestar diario.</p>
          <div class="d-flex justify-content-around">
            ${opts.map(o => `
              <div class="medi-checkin-opt text-center" onclick="Medi._submitCheckin(${o.val}, '${uid}')" title="${o.label}">
                <div style="font-size:1.8rem;">${o.emoji}</div>
                <div style="font-size:.6rem;color:#64748b;margin-top:2px;">${o.label}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  /** Guarda el check-in y muestra mensaje de apoyo si el ánimo es bajo */
  function _submitCheckin(val, uid) {
    return _submitCheckinV2(val, uid);
    const dNow = new Date();
    const today = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
    const storageKey = `medi_checkin_${uid}_${today}`;
    const histKey = `medi_checkin_hist_${uid}`;
    localStorage.setItem(storageKey, val);
    const hist = JSON.parse(localStorage.getItem(histKey) || '{}');
    hist[today] = val;
    localStorage.setItem(histKey, JSON.stringify(hist));

    if (val <= 2) {
      showToast('Recuerda que puedes agendar con Psicología si lo necesitas. ¡No estás solo/a!', 'info');
    } else {
      showToast('¡Gracias por compartir cómo te sientes!', 'success');
    }
    _renderDailyCheckin(uid);
  }

  // ============================================================
  // N2: INDICADOR DE DISPONIBILIDAD DEL SERVICIO
  // ============================================================

  /** Renderiza el card de disponibilidad usando el config cargado */
  function _renderServiceAvailability() {
    const container = document.getElementById('medi-availability-card');
    if (!container) return;

    const cfg = _ctx.config?.medi || {};
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const start = cfg.slotStart || 8;
    const end = cfg.slotEnd || 20;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const isOpenMed = !isWeekend && _isShiftEnabledForService(cfg, 'Medico') && h >= start && h < end;
    const currentPsychologyShift = MediService.normalizeShiftTag
      ? MediService.normalizeShiftTag(now, now)
      : (now.getHours() < 15 ? 'Matutino' : 'Vespertino');
    const psiMorningEnabled = _isShiftEnabledForService(cfg, 'Psicologo', 'Matutino');
    const psiEveningEnabled = _isShiftEnabledForService(cfg, 'Psicologo', 'Vespertino');
    const isOpenPsi = !isWeekend && _isShiftEnabledForService(cfg, 'Psicologo', currentPsychologyShift) && h >= start && h < end;
    const closingSoon = (end - h) < 0.75 && h < end;

    let statusDot = 'closed';
    let statusText = 'Servicio cerrado';
    let statusColor = 'text-danger';
    if (isOpenMed || isOpenPsi) {
      statusDot = closingSoon ? 'closing' : 'open';
      statusText = closingSoon ? 'Cierra pronto' : 'Servicio abierto';
      statusColor = closingSoon ? 'text-warning' : 'text-success';
    }

    let nextOpen = '';
    if (isWeekend) {
      nextOpen = `Reabre el lunes a las ${pad(start)}:00`;
    } else if (!isOpenMed && !isOpenPsi && !_isShiftEnabledForService(cfg, 'Medico') && !psiMorningEnabled && !psiEveningEnabled) {
      nextOpen = 'Agenda no disponible por el momento';
    } else if (!isOpenMed && !isOpenPsi && h < 15 && psiEveningEnabled && !psiMorningEnabled) {
      nextOpen = 'PsicologÃ­a disponible desde las 15:00';
    } else if (h >= end) {
      nextOpen = now.getDay() === 5
        ? `Reabre el lunes a las ${pad(start)}:00`
        : `Reabre maÃ±ana a las ${pad(start)}:00`;
    } else if (h < start) {
      nextOpen = `Abre hoy a las ${pad(start)}:00`;
    }

    container.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4">
        <div class="card-body p-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <span class="medi-avail-dot ${statusDot}"></span>
              <span class="fw-bold small ${statusColor}">${statusText}</span>
            </div>
            <div class="d-flex gap-2 align-items-center">
              ${isOpenMed ? '<span class="badge bg-info-subtle text-info border" style="font-size:.65rem;"><i class="bi bi-bandaid me-1"></i>MÃ©dico</span>' : ''}
              ${isOpenPsi ? '<span class="badge bg-primary-subtle text-primary border" style="font-size:.65rem;"><i class="bi bi-chat-heart me-1"></i>PsicologÃ­a</span>' : ''}
            </div>
          </div>
          <div class="text-muted mt-1" style="font-size:.7rem;">
            <i class="bi bi-clock me-1"></i>Horario: ${pad(start)}:00 - ${pad(end)}:00
            ${nextOpen ? `<span class="ms-2 fw-bold">${nextOpen}</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  // ============================================================
  // N4: ESTADÍSTICAS PERSONALES EN HISTORIAL
  // ============================================================

  /** Renderiza 3 mini-stats cards en la pestaña Historial */
  function _renderDocumentsPanel(expedientes) {
    const container = document.getElementById('medi-documents-panel');
    if (!container) return;

    const safeExpedientes = _ensureStudentArray(expedientes, 'expedientes');
    const recentDocs = safeExpedientes.filter(Boolean).slice(0, 3);
    if (recentDocs.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div>
          <div class="fw-bold text-dark small"><i class="bi bi-file-earmark-medical me-1 text-primary"></i>Documentos recientes</div>
          <div class="text-muted" style="font-size:.72rem;">Resumen rapido de tus ultimas consultas.</div>
        </div>
        ${safeExpedientes.length > 3 ? `<button class="btn btn-sm btn-link text-decoration-none px-0 fw-bold" onclick="Medi.showFullHistory()">Ver todo</button>` : ''}
      </div>
      <div class="row g-3">
        ${recentDocs.map((exp) => {
        const encoded = encodeURIComponent(JSON.stringify(exp));
        const isPsi = _normalizeStudentServiceType(exp.tipoServicio) === 'Psicologo';
        const dateObj = exp.safeDate ? new Date(exp.safeDate) : null;
        const dateStr = dateObj
          ? dateObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
          : '--';
        const serviceLabel = _getStudentServiceLabel(exp.tipoServicio);
        const serviceClass = isPsi ? 'bg-primary-subtle text-primary border-primary-subtle' : 'bg-info-subtle text-info border-info-subtle';
        const snippetRaw = exp.plan || exp.meds || exp.objetivo || exp.subjetivo || 'Sin resumen disponible.';
        const professional = _getProfessionalDisplayName(exp);
        return `
          <div class="col-12 col-md-4">
            <div class="card border-0 shadow-sm rounded-4 h-100 medi-doc-card">
              <div class="card-body p-3 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <span class="badge ${serviceClass} border" style="font-size:.65rem;">
                    <i class="bi bi-${isPsi ? 'chat-heart' : 'bandaid'} me-1"></i>${serviceLabel}
                  </span>
                  <span class="text-muted" style="font-size:.68rem;">${dateStr}</span>
                </div>
                <div class="fw-bold text-dark small mb-1 text-truncate">${escapeHtml(exp.diagnostico || 'Consulta general')}</div>
                <div class="doc-meta text-muted mb-2">
                  <i class="bi bi-person-badge me-1"></i>${escapeHtml(professional)}
                </div>
                <div class="doc-snippet flex-grow-1">${escapeHtml(snippetRaw)}</div>
                <div class="d-flex gap-2 mt-3">
                  <button class="btn btn-sm btn-outline-primary rounded-pill flex-fill fw-bold" onclick="Medi.showConsultationDetails('${encoded}')">
                    <i class="bi bi-eye me-1"></i>Ver detalle
                  </button>
                  <button class="btn btn-sm btn-outline-secondary rounded-pill flex-fill fw-bold" onclick="Medi._downloadConsultationPrescription('${encoded}')">
                    <i class="bi bi-file-earmark-arrow-down me-1"></i>Receta
                  </button>
                </div>
              </div>
            </div>
          </div>`;
      }).join('')}
      </div>`;
  }

  function _renderHistoryStats(expedientes) {
    const container = document.getElementById('medi-history-stats');
    if (!container) return;
    const safeExpedientes = _ensureStudentArray(expedientes, 'expedientes');
    if (safeExpedientes.length === 0) { container.innerHTML = ''; return; }

    const total = safeExpedientes.length;
    const byMed = safeExpedientes.filter((e) => _normalizeStudentServiceType(e.tipoServicio) !== 'Psicologo').length;
    const byPsi = safeExpedientes.filter((e) => _normalizeStudentServiceType(e.tipoServicio) === 'Psicologo').length;
    const lastVisit = safeExpedientes[0]?.safeDate;
    const daysSince = lastVisit ? Math.floor((new Date() - lastVisit) / 86400000) : null;

    const stats = [
      { icon: 'clipboard2-pulse', label: 'Consultas totales', value: total, color: 'primary' },
      { icon: 'bandaid', label: `Médico / Psico`, value: `${byMed} / ${byPsi}`, color: 'info' },
      { icon: 'calendar-check', label: daysSince === 0 ? 'Última: hoy' : daysSince === 1 ? 'Última: ayer' : `Última: hace ${daysSince ?? '--'} días`, value: lastVisit ? lastVisit.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '--', color: 'success' }
    ];

    container.innerHTML = stats.map(s => `
      <div class="col-4">
        <div class="medi-stat-mini bg-${s.color} bg-opacity-10 border border-${s.color} border-opacity-25 text-center">
          <i class="bi bi-${s.icon} text-${s.color} mb-1 d-block"></i>
          <div class="fw-bold" style="font-size:.9rem;">${s.value}</div>
          <div class="text-muted" style="font-size:.6rem;">${s.label}</div>
        </div>
      </div>`).join('');
  }

  // ============================================================
  // M2: FILTRO DE HISTORIAL POR TIPO
  // ============================================================
  let _historialFilterActivo = 'todos';

  /** Filtra el historial médico por tipo de servicio */
  function _filterHistory(tipo, btn) {
    _historialFilterActivo = tipo;
    // Actualizar botones
    const btns = document.querySelectorAll('#medi-history-filter-btns button');
    btns.forEach(b => {
      b.className = b.className.replace(/btn-primary|btn-info|btn-outline-info|btn-outline-primary/g, 'btn-outline-secondary');
    });
    btn.className = btn.className.replace('btn-outline-secondary', tipo === 'todos' ? 'btn-primary' : tipo === 'Médico' ? 'btn-info' : 'btn-primary');

    // Re-renderizar con filtro
    if (!_lastConsultasFull || _lastConsultasFull.length === 0) return;
    const filtered = tipo === 'todos'
      ? _lastConsultasFull
      : _lastConsultasFull.filter((e) => _normalizeStudentServiceType(e.tipoServicio) === _normalizeStudentServiceType(tipo));
    _renderHistorialList(filtered);
  }

  /** Renderiza la lista del historial con vista timeline */
  function _renderHistorialList(expedientes) {
    const expList = document.getElementById('medi-stu-consultas');
    if (!expList) return;

    if (!expedientes || expedientes.length === 0) {
      expList.innerHTML = `<div class="medi-empty-state">
        <i class="bi bi-folder2-open medi-empty-icon"></i>
        <div class="fw-bold text-muted small mb-1">Sin consultas registradas</div>
        <div class="text-muted mb-2" style="font-size:0.78rem;">Tu historial clínico aparecerá aquí después de tu primera visita.</div>
        <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="Medi._switchMediTab('medi-tab-agendar')">
          <i class="bi bi-calendar-plus me-1"></i>Agendar primera cita
        </button>
      </div>`;
      return;
    }

    const visible = expedientes.slice(0, 5);
    const hiddenCount = expedientes.length - 5;

    let html = `<div class="medi-timeline">`;
    html += visible.map(e => {
      const isPsi = _normalizeStudentServiceType(e.tipoServicio) === 'Psicologo';
      const dateStr = e.safeDate ? e.safeDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
      const timeStr = e.safeDate ? e.safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="medi-timeline-item ${isPsi ? 'psico' : ''}">
          <div class="card border-0 shadow-sm rounded-3 mb-1">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <span class="badge ${isPsi ? 'bg-primary-subtle text-primary' : 'bg-info-subtle text-info'} border" style="font-size:.6rem;">
                  <i class="bi bi-${isPsi ? 'chat-heart' : 'bandaid'} me-1"></i>${isPsi ? 'Psicología' : 'Médico General'}
                </span>
                <span class="text-muted" style="font-size:.65rem;"><i class="bi bi-calendar3 me-1"></i>${dateStr} ${timeStr}</span>
              </div>
              <div class="fw-bold small text-dark text-truncate">${escapeHtml(e.diagnostico || 'Consulta general')}</div>
              <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-light">
                <div class="text-muted extra-small text-truncate" style="max-width:65%;">${escapeHtml(e.plan || 'Sin indicaciones')}</div>
                <button class="btn btn-xs btn-outline-primary rounded-pill py-0 px-2 fw-bold" style="font-size:.65rem;"
                  onclick="Medi.showConsultationDetails('${encodeURIComponent(JSON.stringify(e))}')">
                  Ver más <i class="bi bi-chevron-right ms-1"></i>
                </button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
    html += `</div>`;

    if (hiddenCount > 0) {
      html += `<div class="text-center mt-2">
        <button class="btn btn-sm btn-link text-decoration-none fw-bold" onclick="Medi.showFullHistory()">
          Ver historial completo (${hiddenCount} más) <i class="bi bi-arrow-right"></i>
        </button>
      </div>`;
    }
    expList.innerHTML = html;
  }

  // ============================================================
  // N5: AÑADIR CITA AL CALENDARIO
  // ============================================================

  /** Genera link de Google Calendar y opción de descarga ICS */
  function _addToCalendar(encodedCita) {
    const cita = JSON.parse(decodeURIComponent(encodedCita));
    const start = cita.safeDate ? new Date(cita.safeDate) : null;
    if (!start) return showToast('Fecha de cita no disponible', 'warning');

    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h
    const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = encodeURIComponent(`Cita ${cita.tipoServicio || 'Médica'} – ITES Los Cabos`);
    const details = encodeURIComponent(`Servicio: ${cita.tipoServicio || 'Médico General'}\nProfesional: ${cita.profesionalName || 'Asignado'}\nMotivo: ${cita.motivo || ''}`);
    const loc = encodeURIComponent('ITES Los Cabos – Servicio Médico');

    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${loc}`;

    const icsContent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SIA-ITES//ES',
      'BEGIN:VEVENT',
      `UID:medi-${cita.id || Date.now()}@sia-ites`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:Cita ${cita.tipoServicio || 'Médica'} – ITES`,
      `DESCRIPTION:Profesional: ${cita.profesionalName || 'Asignado'}`,
      `LOCATION:ITES Los Cabos – Servicio Médico`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    // Modal de opciones
    const d = document.createElement('div');
    d.innerHTML = `
      <div class="modal fade" id="modalAddCalendar" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 shadow rounded-4">
            <div class="modal-header border-0 pb-0">
              <h6 class="fw-bold"><i class="bi bi-calendar-plus me-2 text-primary"></i>Añadir al Calendario</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body d-grid gap-2">
              <a href="${gcal}" target="_blank" rel="noopener" class="btn btn-outline-primary rounded-pill fw-bold" data-bs-dismiss="modal">
                <i class="bi bi-google me-2"></i>Google Calendar
              </a>
              <button class="btn btn-outline-secondary rounded-pill fw-bold" id="btn-dl-ics" data-bs-dismiss="modal">
                <i class="bi bi-download me-2"></i>Descargar .ics (Apple / Outlook)
              </button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
    const modal = document.getElementById('modalAddCalendar');
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    document.getElementById('btn-dl-ics').onclick = () => {
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cita-medica.ics';
      a.click(); URL.revokeObjectURL(url);
    };
    new bootstrap.Modal(modal).show();
  }

  // ============================================================
  // N3: MODAL MI PERFIL DE SALUD
  // ============================================================

  /** Muestra modal con tarjeta de salud digital del estudiante */
  function _showHealthProfileModal() {
    const p = _ctx.profile || {};
    const hd = p.healthData || {};
    const contacts = Array.isArray(hd.contactos) ? hd.contactos : [];
    const primaryContact = contacts[0] || {};
    const allergiesValue = p.alergias || hd.alergia || 'Ninguna registrada';
    const emergencyName = p.contactoEmergenciaName || primaryContact.nombre || hd.contactoEmergencia || '';
    const emergencyTel = p.contactoEmergenciaTel || primaryContact.telefono || hd.contactoEmergenciaTel || '';
    const total = _lastConsultasFull ? _lastConsultasFull.length : 0;
    const lastVisit = _lastConsultasFull?.[0]?.safeDate;
    const daysSince = lastVisit ? Math.floor((new Date() - lastVisit) / 86400000) : null;
    const lastConsultation = _lastConsultasFull?.[0] || null;
    const lastProf = lastConsultation ? _getProfessionalDisplayName(lastConsultation) : null;

    // IMC si hay datos del expediente
    let imcHtml = '';
    const lastWithSignos = (_lastConsultasFull || []).find((e) => {
      const signos = e.signos || {};
      return (e.peso ?? signos.peso) && (e.talla ?? signos.talla);
    });
    if (lastWithSignos) {
      const signos = lastWithSignos.signos || {};
      const peso = parseFloat(lastWithSignos.peso ?? signos.peso);
      const talla = parseFloat(lastWithSignos.talla ?? signos.talla) / 100;
      const imc = talla > 0 ? (peso / (talla * talla)).toFixed(1) : null;
      if (imc) {
        const cat = imc < 18.5 ? 'Bajo peso' : imc < 25 ? 'Normal' : imc < 30 ? 'Sobrepeso' : 'Obesidad';
        const col = imc < 18.5 ? 'info' : imc < 25 ? 'success' : imc < 30 ? 'warning' : 'danger';
        imcHtml = `<div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-${col} bg-opacity-10 mb-2">
          <span class="small fw-bold">IMC estimado</span>
          <span class="fw-bold text-${col}">${imc} <small class="fw-normal">(${cat})</small></span>
        </div>`;
      }
    }

    const d = document.createElement('div');
    d.innerHTML = `
      <div class="modal fade" id="modalHealthProfile" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg rounded-4">
            <div class="modal-header border-0 pb-0" style="background:linear-gradient(135deg,#1B396A,#0d6efd);border-radius:1rem 1rem 0 0;">
              <div class="text-white">
                <h5 class="fw-bold mb-0"><i class="bi bi-person-heart me-2"></i>Mi Perfil de Salud</h5>
                <p class="mb-0 small opacity-75">${escapeHtml(p.displayName || _ctx.user?.email || '')}</p>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <!-- Datos vitales -->
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="p-3 rounded-3 text-center bg-danger bg-opacity-10">
                    <i class="bi bi-droplet-fill text-danger d-block mb-1 fs-5"></i>
                    <div class="fw-bold fs-4 text-danger">${escapeHtml(p.tipoSangre || hd.tipoSangre || '--')}</div>
                    <div class="text-muted" style="font-size:.65rem;">Tipo de Sangre</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-3 rounded-3 text-center bg-warning bg-opacity-10">
                    <i class="bi bi-exclamation-triangle-fill text-warning d-block mb-1 fs-5"></i>
                    <div class="fw-bold small text-warning text-truncate">${escapeHtml(allergiesValue)}</div>
                    <div class="text-muted" style="font-size:.65rem;">Alergias</div>
                  </div>
                </div>
              </div>
              ${imcHtml}
              <!-- Stats de visitas -->
              <div class="border rounded-3 p-3 mb-3">
                <div class="d-flex justify-content-between mb-2">
                  <span class="small text-muted">Total de consultas</span>
                  <span class="fw-bold text-primary">${total}</span>
                </div>
                ${daysSince !== null ? `<div class="d-flex justify-content-between mb-2">
                  <span class="small text-muted">Última visita</span>
                  <span class="fw-bold">${daysSince === 0 ? 'Hoy' : daysSince === 1 ? 'Ayer' : `Hace ${daysSince} días`}</span>
                </div>` : ''}
                ${lastProf ? `<div class="d-flex justify-content-between">
                  <span class="small text-muted">Última atención</span>
                  <span class="fw-bold">${escapeHtml(lastProf)}</span>
                </div>` : ''}
              </div>
              <!-- Contacto emergencia -->
              ${emergencyName ? `<div class="alert alert-danger border-0 p-2 rounded-3 mb-0 small">
                <i class="bi bi-telephone-fill me-2"></i><strong>Emergencia:</strong> ${escapeHtml(emergencyName)}
                ${emergencyTel ? `<a href="tel:${escapeHtml(emergencyTel)}" class="ms-2 btn btn-sm btn-danger rounded-pill px-2 py-0" style="font-size:.7rem;"><i class="bi bi-telephone me-1"></i>${escapeHtml(emergencyTel)}</a>` : ''}
              </div>` : ''}
            </div>
            <div class="modal-footer border-0 pt-0">
              <button class="btn btn-outline-primary rounded-pill w-100 fw-bold" data-bs-dismiss="modal" onclick="Medi._switchMediTab('medi-tab-historial')">
                <i class="bi bi-folder2-open me-2"></i>Ver Expediente Completo
              </button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
    const modal = document.getElementById('modalHealthProfile');
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    new bootstrap.Modal(modal).show();
  }

  /**
   * Re-carga los slots de hora cuando el tipo de servicio cambia y ya había
   * una fecha seleccionada. Llamado desde los botones de servicio en el HTML.
   */
  function _refreshSlotsOnTypeChange() {
    if (_currentBookingLock) {
      _refreshStudentBookingLock();
      return;
    }
    const dateInput = document.getElementById('medi-cita-fecha');
    const timeInput = document.getElementById('medi-cita-hora');
    const prevDate = dateInput?.value;
    if (!prevDate) return;
    // Reset hora seleccionada
    if (timeInput) timeInput.value = '';
    document.getElementById('medi-booking-summary')?.classList.add('d-none');
    const btnConf = document.getElementById('btn-medi-confirm');
    if (btnConf) btnConf.disabled = true;
    // Re-click la tarjeta de fecha para disparar la carga de slots
    const card = document.querySelector(`.date-option[data-date="${prevDate}"]`);
    if (card) card.click();
  }

  /**
   * Muestra modal de confirmación de cita con resumen e indicaciones.
   * @param {Object} params - Datos de la cita recién agendada
   */
  function _showBookingConfirmModalLegacy({ tipo, dateText, timeText, profName, profId, profProfileId, replaceId }) {
    // Eliminar modal previo si existe
    document.getElementById('modalBookingConfirm')?.remove();
    const isPsi = tipo === 'Psicología';
    const d = document.createElement('div');
    d.innerHTML = `
      <div class="modal fade" id="modalBookingConfirm" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <div class="modal-header border-0 pb-1 pt-0 px-0">
              <div class="w-100 px-4 pt-4 pb-3 text-white text-center" style="background:linear-gradient(135deg,#198754,#20c997);">
                <div class="mb-2" style="font-size:2.5rem;">✅</div>
                <h5 class="fw-bold mb-1">${replaceId ? 'Cita reprogramada' : '¡Cita agendada!'}</h5>
                <div class="small opacity-75">${replaceId ? 'Tu cita ha sido actualizada exitosamente' : 'Tu solicitud fue enviada correctamente'}</div>
              </div>
            </div>
            <div class="modal-body p-4">
              <div class="d-flex gap-3 mb-3">
                <div class="rounded-3 p-2 flex-shrink-0 text-center" style="background:#f0fdf4;min-width:48px;">
                  <i class="bi bi-${isPsi ? 'chat-heart-fill' : 'bandaid-fill'}" style="font-size:1.4rem;color:${isPsi ? '#6f42c1' : '#0d6efd'};"></i>
                </div>
                <div>
                  <div class="extra-small text-muted">Servicio</div>
                  <div class="fw-bold">${escapeHtml(tipo)}</div>
                  ${profName ? `<div class="small text-muted">${escapeHtml(profName)}</div>` : ''}
                </div>
              </div>
              <div class="d-flex gap-3 mb-3">
                <div class="rounded-3 p-2 flex-shrink-0 text-center" style="background:#f0fdf4;min-width:48px;">
                  <i class="bi bi-calendar-event-fill" style="font-size:1.4rem;color:#198754;"></i>
                </div>
                <div>
                  <div class="extra-small text-muted">Fecha y hora</div>
                  <div class="fw-bold">${escapeHtml(dateText)}</div>
                  <div class="small text-muted">${escapeHtml(timeText)} hrs</div>
                </div>
              </div>
              <div class="rounded-3 p-3 mb-3" style="background:#fffbeb;border-left:4px solid #f59e0b;">
                <div class="fw-bold small mb-1" style="color:#92400e;"><i class="bi bi-lightbulb-fill me-1"></i>Indicaciones</div>
                <ul class="mb-0 small ps-3" style="color:#78350f;">
                  <li>Llega <b>10 minutos antes</b> de tu cita.</li>
                  <li>Trae tu <b>credencial de estudiante</b>.</li>
                  <li>Si no puedes asistir, <b>cancela con anticipación</b>.</li>
                  <li>Tu cita queda <b>pendiente de confirmación</b>.</li>
                </ul>
              </div>
              <div class="rounded-3 p-2 mb-3" style="background:#f8f9fa;font-size:0.7rem;color:#6c757d;">
                <i class="bi bi-shield-check me-1"></i>Tu información es confidencial y protegida bajo la normativa del TEC.
              </div>
              ${profId ? `<button class="btn btn-outline-primary w-100 rounded-pill btn-sm mb-2 fw-bold" onclick="Medi.startChatWithProfessional('${profId}','${escapeHtml(profName || 'Profesional')}','${profProfileId || ''}');bootstrap.Modal.getInstance(document.getElementById('modalBookingConfirm'))?.hide()"><i class="bi bi-chat-dots-fill me-1"></i>Contactar al profesional</button>` : ''}
              <button class="btn btn-success w-100 rounded-pill fw-bold" data-bs-dismiss="modal"><i class="bi bi-calendar-week me-1"></i>Ver mis citas</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
    const modalEl = document.getElementById('modalBookingConfirm');
    modalEl.addEventListener('hidden.bs.modal', () => {
      modalEl.remove();
      _switchMediTab('medi-tab-citas');
      const tabPend = document.getElementById('tab-pendientes');
      if (tabPend) tabPend.click();
    });
    const m = new bootstrap.Modal(modalEl, { backdrop: true });
    m.show();
  }

  function _showBookingConfirmModal({ tipo, dateText, timeText, replaceId, finalStatus, queuePosition = 0, calendarCita = null }) {
    document.getElementById('modalBookingConfirm')?.remove();

    const isConfirmed = finalStatus === 'confirmada';
    const encodedCalendar = calendarCita ? encodeURIComponent(JSON.stringify(calendarCita)) : '';
    const headerBg = isConfirmed
      ? 'linear-gradient(135deg,#198754,#20c997)'
      : 'linear-gradient(135deg,#0d6efd,#38bdf8)';
    const statusBadge = isConfirmed
      ? '<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3 py-2">Confirmada en agenda</span>'
      : '<span class="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle px-3 py-2">Sala de espera</span>';
    const statusText = isConfirmed
      ? 'Tu cita quedó confirmada correctamente y ya aparece en la pestaña Confirmadas.'
      : `Tu solicitud quedó en sala de espera${queuePosition > 0 ? ` con lugar #${queuePosition}` : ''}. La verás en la pestaña Pendientes.`;

    const d = document.createElement('div');
    d.innerHTML = `
      <div class="modal fade" id="modalBookingConfirm" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <div class="px-4 pt-4 pb-3 text-white text-center" style="background:${headerBg};">
              <div class="mb-2" style="font-size:2.2rem;">${isConfirmed ? '✅' : '🕓'}</div>
              <h5 class="fw-bold mb-1">${replaceId ? 'Cita reprogramada' : 'Cita agendada'}</h5>
              <div class="small opacity-75">${isConfirmed ? 'Confirmada correctamente' : 'Registrada correctamente'}</div>
            </div>
            <div class="modal-body p-4 text-center">
              <div class="mb-3">${statusBadge}</div>
              <div class="fw-bold text-dark mb-1">${escapeHtml(tipo)}</div>
              <div class="small text-muted mb-3">${escapeHtml(dateText)} • ${escapeHtml(timeText)} hrs</div>
              <p class="small text-muted mb-4">${escapeHtml(statusText)}</p>
              ${isConfirmed && calendarCita ? `<button class="btn btn-outline-secondary w-100 rounded-pill fw-bold mb-2" onclick="bootstrap.Modal.getInstance(document.getElementById('modalBookingConfirm'))?.hide(); setTimeout(()=>Medi._addToCalendar('${encodedCalendar}'), 120)">
                <i class="bi bi-calendar-plus me-1"></i>Añadir al calendario
              </button>` : ''}
              <button class="btn btn-primary w-100 rounded-pill fw-bold" data-bs-dismiss="modal">
                <i class="bi bi-calendar-week me-1"></i>Ver mis citas
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(d.firstElementChild);
    const modalEl = document.getElementById('modalBookingConfirm');
    modalEl.addEventListener('hidden.bs.modal', () => {
      modalEl.remove();
      _redirectToAppointmentsTab(finalStatus);
    }, { once: true });
    new bootstrap.Modal(modalEl, { backdrop: true }).show();
  }

  // ============================================================
  // N6: PANEL SOS / URGENCIAS
  // ============================================================

  /** Inyecta botón flotante SOS en el DOM (solo una vez) */
  function _renderSOSButton() {
    if (document.getElementById('medi-sos-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'medi-sos-btn';
    btn.className = 'position-fixed';
    btn.style.cssText = 'bottom:90px;left:16px;z-index:1999;';
    btn.innerHTML = `
      <button class="btn btn-danger rounded-circle shadow-lg d-flex align-items-center justify-content-center"
        style="width:52px;height:52px;" onclick="Medi._showSOSModal()" title="Urgencias / SOS">
        <i class="bi bi-heart-pulse-fill" style="font-size:1.4rem;"></i>
      </button>`;
    document.body.appendChild(btn);
  }

  /** Muestra modal SOS con contactos de emergencia */
  function _showSOSModal() {
    const p = _ctx.profile || {};
    const hd = p.healthData || {};
    const contacts = Array.isArray(hd.contactos) ? hd.contactos : [];
    const primaryContact = contacts[0] || {};
    const tel = p.contactoEmergenciaTel || primaryContact.telefono || hd.contactoEmergenciaTel || '';
    const nombre = p.contactoEmergenciaName || primaryContact.nombre || hd.contactoEmergencia || '';

    const d = document.createElement('div');
    d.innerHTML = `
      <div class="modal fade" id="modalMediSOS" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 shadow-lg rounded-4">
            <div class="modal-header border-0 pb-1" style="background:linear-gradient(135deg,#dc3545,#c0392b);border-radius:1rem 1rem 0 0;">
              <div class="text-white"><h5 class="fw-bold mb-0"><i class="bi bi-heart-pulse-fill me-2"></i>Urgencias</h5></div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-3">
              ${nombre || tel ? `
              <div class="mb-3">
                <div class="fw-bold small text-muted mb-2"><i class="bi bi-person-fill me-1"></i>Mi Contacto de Emergencia</div>
                <div class="d-flex align-items-center justify-content-between p-2 border rounded-3">
                  <span class="fw-bold small">${escapeHtml(nombre || 'Sin nombre')}</span>
                  ${tel ? `<a href="tel:${escapeHtml(tel)}" class="btn btn-danger btn-sm rounded-pill px-3 fw-bold"><i class="bi bi-telephone-fill me-1"></i>Llamar</a>` : ''}
                </div>
              </div>` : `<div class="alert alert-warning small rounded-3 mb-3">
                <i class="bi bi-exclamation-triangle me-1"></i>No tienes contacto de emergencia registrado.
                <button class="btn btn-sm btn-warning rounded-pill mt-1 w-100" data-bs-toggle="modal" data-bs-target="#modalMediEditCard" data-bs-dismiss="modal">Agregar ahora</button>
              </div>`}
              <div class="fw-bold small text-muted mb-2"><i class="bi bi-building-fill-cross me-1"></i>Números de Emergencia</div>
              <div class="d-grid gap-2 mb-3">
                <a href="tel:911" class="btn btn-outline-danger rounded-pill fw-bold btn-sm">
                  <i class="bi bi-telephone-fill me-2"></i>911 – Emergencias Nacionales
                </a>
                <a href="tel:8002900024" class="btn btn-outline-primary rounded-pill fw-bold btn-sm">
                  <i class="bi bi-brain me-2"></i>800-290-0024 – Crisis Salud Mental
                </a>
              </div>
              <div class="fw-bold small text-muted mb-2"><i class="bi bi-chat-square-heart me-1"></i>Mensaje Urgente al Médico</div>
              <button class="btn btn-danger w-100 rounded-pill fw-bold" data-bs-dismiss="modal" onclick="Medi.openStudentChat(true)">
                <i class="bi bi-chat-dots-fill me-2"></i>Abrir Chat Ahora
              </button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
    const modal = document.getElementById('modalMediSOS');
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    new bootstrap.Modal(modal).show();
  }

  // ============================================================
  // M8: FOLLOW-UP BANNER COMPLETADO
  // ============================================================

  /** Renderiza banner de seguimiento con notas del médico y acceso directo a agendar */
  function _renderFollowUpBannerComplete(expedientes) {
    const banner = document.getElementById('medi-followup-banner');
    if (!banner) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const withFollowUp = _ensureStudentArray(expedientes, 'expedientes')
      .filter((exp) => exp.followUp?.required)
      .filter((exp) => exp.followUp?.created !== true)
      .filter((exp) => !_isFollowUpDismissed(exp.id))
      .map((exp) => ({
        ...exp,
        followUpDateResolved: safeDate(exp.followUp?.date) || exp.safeDate || null
      }))
      .sort((a, b) => {
        const aTime = a.followUpDateResolved ? a.followUpDateResolved.getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.followUpDateResolved ? b.followUpDateResolved.getTime() : Number.MAX_SAFE_INTEGER;
        const aOverdue = a.followUpDateResolved && a.followUpDateResolved < today ? 0 : 1;
        const bOverdue = b.followUpDateResolved && b.followUpDateResolved < today ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return aTime - bTime;
      });

    if (withFollowUp.length === 0) {
      _activeFollowUpBannerId = null;
      banner.dataset.followupId = '';
      banner.classList.add('d-none');
      banner.innerHTML = '';
      return;
    }

    const latest = withFollowUp[0];
    const fDate = latest.followUpDateResolved;
    const isOverdue = fDate && fDate < today;
    const daysDiff = fDate ? Math.floor((today - fDate) / 86400000) : 0;
    const dateStr = fDate ? fDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : 'pronto';
    const notes = latest.followUp?.notes || '';
    const tipo = _normalizeStudentServiceType(latest.tipoServicio);
    _activeFollowUpBannerId = latest.id || null;
    banner.dataset.followupId = latest.id || '';

    banner.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4 ${isOverdue ? 'border-danger border-start border-4' : 'border-warning border-start border-4'}">
        <div class="card-body p-3">
          <div class="d-flex align-items-start gap-2 mb-2">
            <i class="bi bi-${isOverdue ? 'exclamation-triangle-fill text-danger' : 'calendar-check text-warning'} fs-5 flex-shrink-0 mt-1"></i>
            <div class="flex-grow-1">
              <div class="fw-bold small ${isOverdue ? 'text-danger' : 'text-warning'}">
                ${isOverdue ? `Seguimiento vencido hace ${daysDiff} dia${daysDiff !== 1 ? 's' : ''}` : `Seguimiento recomendado para el ${dateStr}`}
              </div>
              <div class="text-muted" style="font-size:.75rem;">Tu profesional recomendo una cita de ${_getStudentServiceLabel(tipo)}</div>
              ${notes ? `<blockquote class="blockquote mb-0 mt-2 ps-2 border-start border-2 border-secondary">
                <p class="mb-0 text-muted" style="font-size:.75rem;font-style:italic;">"${escapeHtml(notes)}"</p>
              </blockquote>` : ''}
            </div>
          </div>
          <button class="btn btn-sm ${isOverdue ? 'btn-danger' : 'btn-warning'} rounded-pill w-100 fw-bold mt-1"
            onclick="Medi._switchMediTab('medi-tab-agendar'); setTimeout(()=>{ Medi._selectStudentService('${tipo}'); const motivo=document.getElementById('medi-cita-motivo'); if(motivo && !motivo.value){ motivo.value='Seguimiento: ${escapeHtml(notes || '').replace(/'/g, '&#39;')}'; } }, 200);">
            <i class="bi bi-calendar-plus me-1"></i>Agendar seguimiento ahora
          </button>
          <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-secondary rounded-pill flex-grow-1" style="font-size:.7rem;" onclick="Medi._dismissFollowUp('later')">
              <i class="bi bi-clock-history me-1"></i>Recordar despuÃ©s
            </button>
            <button class="btn btn-sm btn-outline-secondary rounded-pill flex-grow-1" style="font-size:.7rem;" onclick="Medi._dismissFollowUp('forever')">
              <i class="bi bi-x-circle me-1"></i>No volver a mostrar
            </button>
          </div>
        </div>
      </div>`;
    banner.classList.remove('d-none');
  }

  /** Oculta el banner de seguimiento temporalmente o por siempre */
  function _dismissFollowUp(type) {
    const banner = document.getElementById('medi-followup-banner');
    const consultaId = _activeFollowUpBannerId || banner?.dataset.followupId || null;
    if (!consultaId) {
      if (banner) {
        banner.classList.add('d-none');
        banner.innerHTML = '';
      }
      return;
    }

    const dismissKey = _buildFollowUpDismissKey(consultaId);
    if (type === 'forever') {
      localStorage.setItem(dismissKey, JSON.stringify({ forever: true }));
    } else if (type === 'later') {
      localStorage.setItem(dismissKey, JSON.stringify({ until: new Date().getTime() + 12 * 60 * 60 * 1000 }));
    }
    if (banner) {
      banner.dataset.followupId = '';
      banner.classList.add('d-none');
      banner.innerHTML = '';
    }
    _activeFollowUpBannerId = null;
  }

  // ============================================================
  // N8: ENCUESTA DE SATISFACCIÓN POST-CONSULTA
  // ============================================================

  /** Verifica si hay consulta reciente (48h) sin encuesta y muestra banner */
  async function _initPostConsultSurvey() {
    const container = document.getElementById('medi-postconsult-survey');
    if (!container) return;
    container.classList.add('d-none');
    container.innerHTML = '';
    delete container.dataset.surveyKey;
    if (!_lastConsultasFull || _lastConsultasFull.length === 0) return;

    const recent = _lastConsultasFull[0];
    if (!recent || !recent.safeDate) return;
    if ((new Date() - recent.safeDate) > 48 * 3600 * 1000) return;

    const surveyKey = `medi_survey_${recent.id || recent.safeDate?.getTime()}`;
    if (localStorage.getItem(surveyKey)) return;

    const profName = _getProfessionalDisplayName(recent);
    const serviceType = _normalizeStudentServiceType(recent.tipoServicio) === 'Psicologo' ? 'psicologia' : 'servicio-medico';
    let pendingSurvey = null;
    try {
      if (window.EncuestasServicioService?.checkPendingSurvey) {
        pendingSurvey = await EncuestasServicioService.checkPendingSurvey(_buildStudentSurveyContext(), serviceType);
      }
      if (!pendingSurvey) return;
    } catch (error) {
      console.warn('[Medi Survey] No se pudo validar encuesta pendiente:', error);
      return;
    }

    container.dataset.surveyKey = surveyKey;
    container.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4 border-start border-4 border-success">
        <div class="card-body p-3">
          <div class="fw-bold small mb-1"><i class="bi bi-star-fill text-warning me-2"></i>Â¿CÃ³mo fue tu consulta con ${escapeHtml(profName)}?</div>
          <p class="text-muted mb-2" style="font-size:.75rem;">Tu opiniÃ³n nos ayuda a mejorar el servicio.</p>
          <div class="d-flex gap-2 mb-2" id="medi-survey-stars">
            ${[1, 2, 3, 4, 5].map((n) => `<i class="bi bi-star-fill medi-star" data-val="${n}" onclick="Medi._setSurveyRating(${n})" id="medi-star-${n}"></i>`).join('')}
          </div>
          <textarea class="form-control form-control-sm rounded-3 mb-2" id="medi-survey-comment" rows="2" placeholder="Comentario opcional..."></textarea>
          <div class="d-flex gap-2">
            <button class="btn btn-success btn-sm rounded-pill fw-bold flex-fill" onclick="Medi._submitSurvey('${surveyKey}', '${serviceType}', '${encodeURIComponent(profName)}', '${encodeURIComponent(recent.tipoServicio || '')}')">
              <i class="bi bi-send me-1"></i>Enviar
            </button>
            <button class="btn btn-outline-secondary btn-sm rounded-pill" onclick="Medi._skipSurvey('${surveyKey}', '${serviceType}')">Omitir</button>
          </div>
        </div>
      </div>`;
    container.classList.remove('d-none');

    setTimeout(() => {
      document.querySelectorAll('.medi-star').forEach((star) => {
        star.addEventListener('mouseover', () => {
          const value = parseInt(star.dataset.val, 10);
          document.querySelectorAll('.medi-star').forEach((item) => item.classList.toggle('lit', parseInt(item.dataset.val, 10) <= value));
        });
        star.addEventListener('mouseleave', () => {
          const selected = parseInt(document.getElementById('medi-survey-stars')?.dataset.selected || 0, 10);
          document.querySelectorAll('.medi-star').forEach((item) => item.classList.toggle('lit', parseInt(item.dataset.val, 10) <= selected));
        });
      });
    }, 100);
  }

  function _setSurveyRating(val) {
    const starsContainer = document.getElementById('medi-survey-stars');
    if (starsContainer) starsContainer.dataset.selected = val;
    document.querySelectorAll('.medi-star').forEach((st) => st.classList.toggle('lit', parseInt(st.dataset.val, 10) <= val));
  }

  function _enableStudentFloatingStack() {
    const reportBtn = document.getElementById('btn-report-problem');
    const role = _ctx?.profile?.role || _ctx?.user?.role || 'student';
    const isAdmin = ['superadmin', 'department_admin'].includes(role);
    if (reportBtn && !isAdmin) {
      reportBtn.classList.remove('d-none');
    }
    document.body.classList.add('medi-student-floating-stack');
  }

  function _disableStudentFloatingStack() {
    document.body.classList.remove('medi-student-floating-stack');
  }

  async function _skipSurvey(storageKey, serviceType) {
    try {
      if (window.EncuestasServicioService?.recordSurveySkip) {
        await EncuestasServicioService.recordSurveySkip(_buildStudentSurveyContext(), serviceType);
      }
    } catch (error) {
      console.warn('[Medi Survey] No se pudo registrar omision:', error);
    }

    localStorage.setItem(storageKey, 'skip');
    const container = document.getElementById('medi-postconsult-survey');
    if (container) {
      container.classList.add('d-none');
      container.innerHTML = '';
      delete container.dataset.surveyKey;
    }
  }

  async function _submitSurvey(storageKey, serviceTypeOrProfName, profNameEncoded, tipoServicioEncoded = '') {
    const rating = parseInt(document.getElementById('medi-survey-stars')?.dataset.selected || 0, 10);
    if (!rating) return showToast('Selecciona una calificaciÃ³n con las estrellas', 'warning');

    const comment = document.getElementById('medi-survey-comment')?.value || '';
    const hasLegacySignature = typeof tipoServicioEncoded === 'undefined' || tipoServicioEncoded === '';
    const serviceType = hasLegacySignature ? 'servicio-medico' : serviceTypeOrProfName;
    const profName = decodeURIComponent(hasLegacySignature ? serviceTypeOrProfName : (profNameEncoded || ''));
    const tipoServicio = decodeURIComponent(hasLegacySignature ? (profNameEncoded || '') : (tipoServicioEncoded || ''));

    try {
      if (window.EncuestasServicioService?.submitServiceSurveyResponse) {
        await EncuestasServicioService.submitServiceSurveyResponse(_buildStudentSurveyContext(), serviceType, {
          rating,
          comment,
          profesional: profName,
          tipoServicio
        }, {
          source: 'medi_inline_post_consult'
        });
      } else if (window.EncuestasServicioService?.registrarRespuesta) {
        await EncuestasServicioService.registrarRespuesta(_ctx, {
          servicio: serviceType,
          subservicio: tipoServicio,
          calificacion: rating,
          comentario: comment,
          profesional: profName,
          uid: _ctx.user?.uid
        });
      }
    } catch (error) {
      console.warn('[Medi Survey] Error al guardar la encuesta en Firestore, usando localStorage:', error);
    }

    localStorage.setItem(storageKey, JSON.stringify({ rating, comment, date: new Date().toISOString(), serviceType }));
    document.getElementById('medi-postconsult-survey')?.classList.add('d-none');
    showToast('Gracias por tu calificaciÃ³n.', 'success');
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
                  <span class="badge  text-dark border-0 shadow-none" style="font-size: 0.65rem;">${e.tipoServicio}</span>
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


    return {
      _loadQueuePosition,
      loadStudentHistory,
      _renderFollowUpBanner,
      _updateHeroGreeting,
      _renderHeroNextAppointment,
      _renderQueueCard,
      _renderQuickActions,
      _switchMediTab,
      _updateChatBadgeOnTab,
      _relativeTime,
      initMediTutorial,
      launchMediTutorial,
      loadWellnessFeed,
      _openWellnessTipsModal,
      _filterTipsModal,
      _getCheckinTodayIso,
      _getCheckinHistoryKey,
      _getCheckinExpandedKey,
      _getCheckinDayKey,
      _getCheckinHistory,
      _saveCheckinHistory,
      _getCheckinEntries,
      _getCheckinStreak,
      _getCheckinTrendText,
      _toggleCheckinHistory,
      _renderDailyCheckinV2,
      _submitCheckinV2,
      _renderDailyCheckin,
      _submitCheckin,
      _renderServiceAvailability,
      _renderDocumentsPanel,
      _renderHistoryStats,
      _filterHistory,
      _renderHistorialList,
      _addToCalendar,
      _showHealthProfileModal,
      _refreshSlotsOnTypeChange,
      _showBookingConfirmModalLegacy,
      _showBookingConfirmModal,
      _renderSOSButton,
      _showSOSModal,
      _renderFollowUpBannerComplete,
      _dismissFollowUp,
      _initPostConsultSurvey,
      _setSurveyRating,
      _enableStudentFloatingStack,
      _disableStudentFloatingStack,
      _skipSurvey,
      _submitSurvey,
      showFullHistory
    };
  }
};
