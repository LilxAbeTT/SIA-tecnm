/* ============================================================
   AulaClase — Vista individual de clase
   Feed real-time · Tabs en header · Modal detalle + comentarios
   ============================================================ */
(function (global) {
  const AulaClase = (function () {

    let _ctx = null, _claseId = null, _claseData = null, _rolEnClase = null, _miGrupo = null;
    let _unsubFeed = null, _unsubComments = null;
    let _rootClickHandler = null, _entregaSuccessHandler = null, _boundRoot = null;
    let _deadlineCountdown = null; // setInterval para el countdown del modal de tarea
    let _initRunId = 0;
    let _pubDetailState = 'idle';
    let _activePubDetailId = null;

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
    function $id(id) { return document.getElementById(id); }
    function normalizeText(value) {
      return global.AulaSubjectCatalog?.normalizeText
        ? global.AulaSubjectCatalog.normalizeText(value)
        : String(value || '').trim().toLowerCase();
    }
    function toast(msg, type) { if (global.SIA?.toast) global.SIA.toast(msg, type); else if (global.showToast) global.showToast(msg, type); }
    function _getCareerLabel(clase) { return clase?.carreraNombre || clase?.carrera || ''; }
    function _getSemesterLabel(clase) { return clase?.semestreLabel || clase?.semestre || ''; }
    function _shouldShowMateria(clase) {
      const titleNorm = normalizeText(clase?.titulo);
      const materiaNorm = normalizeText(clase?.materia);
      const derivedTitle = normalizeText(global.AulaClassForm?.buildDefaultTitle?.(clase?.materia || '', clase?.turno || '') || '');
      return Boolean(clase?.materia) && titleNorm !== materiaNorm && titleNorm !== derivedTitle;
    }
    function _getRoot() {
      const courseRoot = $id('view-aula-course');
      if (courseRoot && !courseRoot.classList.contains('d-none')) return courseRoot;
      return $id('view-aula');
    }

    const TYPE_CFG = {
      tarea:     { icon: 'bi-file-earmark-text', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#3b82f6', label: 'Tarea' },
      material:  { icon: 'bi-folder2-open',      grad: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#8b5cf6', label: 'Material' },
      aviso:     { icon: 'bi-megaphone',          grad: 'linear-gradient(135deg,#f97316,#c2410c)', color: '#f97316', label: 'Aviso' },
      encuesta:  { icon: 'bi-bar-chart',          grad: 'linear-gradient(135deg,#22c55e,#15803d)', color: '#22c55e', label: 'Encuesta' },
      discusion: { icon: 'bi-chat-dots',          grad: 'linear-gradient(135deg,#06b6d4,#0e7490)', color: '#06b6d4', label: 'Discusion' }
    };

    // ══════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════

    /**
     * Inicializa la vista de una clase.
     * @param {object} ctx
     * @param {string} claseId
     * @param {string|null} [autoOpenPubId] - Si se pasa, abre automáticamente el modal de esa publicación
     */
    async function init(ctx, claseId, autoOpenPubId) {
      const runId = ++_initRunId;
      _ctx = ctx;
      _claseId = claseId;
      _cleanup();
      const root = _getRoot();
      if (!root) return;

      root.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

      try {
        const [clase, rol] = await Promise.all([
          AulaService.getClase(ctx, claseId),
          AulaService.getRolEnClase(ctx, claseId, ctx.auth.currentUser.uid)
        ]);
        if (runId !== _initRunId) return;
        if (!clase) { root.innerHTML = '<div class="alert alert-warning m-3">Clase no encontrada.</div>'; return; }
        if (!rol)   { root.innerHTML = '<div class="alert alert-warning m-3">No eres miembro de esta clase.</div>'; return; }

        _claseData = clase;
        _rolEnClase = rol;
        const isDocente = rol === 'docente';
        _miGrupo = isDocente ? null : await AulaService.getMiGrupo(ctx, claseId, ctx.auth.currentUser.uid);
        if (runId !== _initRunId) return;

        _renderTemplate(root, clase, isDocente);
        _bindEvents(ctx, clase, isDocente);
        _startFeedStream(ctx, claseId);
        // Stats del header y badges en tabs (async, no bloquea render)
        if (isDocente) {
          _loadHeaderStats(ctx, clase);
        } else {
          _loadStudentHeaderStats(ctx);
        }
        _loadTabBadges(ctx, clase, isDocente);

        // Deep-link: abrir automáticamente el modal de una publicación específica
        if (autoOpenPubId) {
          setTimeout(async () => {
            if (runId !== _initRunId) return;
            try {
              const pub = await _getAccessiblePub(ctx, autoOpenPubId);
              if (runId !== _initRunId) return;
              if (pub) _openPubDetail(ctx, pub);
              else toast('No tienes acceso a esa publicacion', 'warning');
            } catch (_) { toast('No se pudo abrir la publicacion', 'danger'); }
          }, 700);
        }
      } catch (err) {
        console.error('[AulaClase] init error:', err);
        const root = _getRoot();
        if (root) root.innerHTML = '<div class="alert alert-danger m-3">Error al cargar la clase.</div>';
      }
    }

    function _cleanup() {
      if (_unsubFeed)       { _unsubFeed();       _unsubFeed = null; }
      if (_unsubComments)   { _unsubComments();   _unsubComments = null; }
      if (_deadlineCountdown) { clearInterval(_deadlineCountdown); _deadlineCountdown = null; }
      if (_boundRoot && _rootClickHandler) {
        _boundRoot.removeEventListener('click', _rootClickHandler);
        _rootClickHandler = null;
      }
      _boundRoot = null;
      if (_entregaSuccessHandler) {
        document.removeEventListener('aula:entregaSuccess', _entregaSuccessHandler);
        _entregaSuccessHandler = null;
      }
      _miGrupo = null;
      _pubDetailState = 'idle';
      _activePubDetailId = null;
      _cleanupPubDetailModal(document.getElementById('aula-pub-detail-modal'));
    }

    async function _getAccessiblePub(ctx, pubId) {
      return AulaService.getPublicacionForClase(ctx, _claseId, pubId, ctx.auth.currentUser.uid);
    }

    function _isImageUrl(url) {
      if (!url) return false;
      return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url) ||
             /firebasestorage\.googleapis\.com.*(?:jpg|jpeg|png|gif|webp)/i.test(url);
    }

    function _cleanupModalArtifacts() {
      if (document.querySelector('.modal.show')) return;
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
      document.body.style.removeProperty('overflow');
    }

    function _cleanupPubDetailModal(modalEl) {
      if (_unsubComments) { _unsubComments(); _unsubComments = null; }
      if (_deadlineCountdown) { clearInterval(_deadlineCountdown); _deadlineCountdown = null; }
      try { bootstrap.Modal.getInstance(modalEl)?.dispose(); } catch (_) {}
      if (modalEl?.isConnected) modalEl.remove();
      _pubDetailState = 'idle';
      _activePubDetailId = null;
      _cleanupModalArtifacts();
    }

    function _formatDateTime(value) {
      const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
      if (!date || Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('es-MX', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }, { once: true });
    }

    function _renderMiEntregaResumen(container, entrega, maxPts) {
      if (!container) return;
      if (!entrega) {
        container.classList.add('d-none');
        container.innerHTML = '';
        return;
      }

      const fechaEntrega = _formatDateTime(entrega.entregadoAt || entrega.updatedAt || entrega.createdAt);
      const estadoMap = {
        calificado: {
          className: 'bg-success-subtle text-success',
          label: entrega.calificacion != null ? `Calificada: ${entrega.calificacion}/${maxPts}` : 'Calificada'
        },
        tarde: {
          className: 'bg-warning-subtle text-warning',
          label: 'Entrega tardía'
        },
        entregado: {
          className: 'bg-primary-subtle text-primary',
          label: 'Entregada'
        }
      };
      const estado = estadoMap[entrega.estado] || estadoMap.entregado;
      const archivos = Array.isArray(entrega.archivos) ? entrega.archivos.filter(a => a?.url) : [];

      container.classList.remove('d-none');
      container.innerHTML = `
        <div class="border rounded-4 p-3 aula-entrega-summary-card">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <div class="fw-semibold text-dark">
              <i class="bi bi-folder-check text-success me-1"></i>Tu entrega
            </div>
            <span class="badge rounded-pill ${estado.className}">${estado.label}</span>
            ${entrega.isGroupDelivery ? '<span class="badge rounded-pill bg-secondary-subtle text-secondary"><i class="bi bi-people-fill me-1"></i>Grupal</span>' : ''}
            ${fechaEntrega ? `<span class="small text-muted ms-auto"><i class="bi bi-clock me-1"></i>${fechaEntrega}</span>` : ''}
          </div>
          ${entrega.contenido
            ? `<div class="small text-muted mt-2" style="white-space:pre-line;line-height:1.5;">${esc(entrega.contenido)}</div>`
            : '<div class="small text-muted mt-2">Tu entrega no incluye texto adicional.</div>'}
          ${archivos.length ? `
            <div class="small fw-semibold text-muted mt-3 mb-2">Archivos enviados</div>
            <div class="d-flex flex-wrap gap-2">
              ${archivos.map(a => `
                <a href="${esc(a.url)}" target="_blank" rel="noopener"
                   class="btn btn-sm btn-light border rounded-pill px-3 text-decoration-none">
                  <i class="bi bi-paperclip me-1"></i>${esc(a.nombre || 'Archivo')}
                </a>`).join('')}
            </div>` : ''}
          ${entrega.retroalimentacion ? `
            <div class="mt-3 rounded-3 px-3 py-2 small aula-entrega-summary-feedback">
              <div class="fw-semibold text-success mb-1"><i class="bi bi-chat-left-text-fill me-1"></i>Retroalimentación</div>
              <div style="white-space:pre-line;">${esc(entrega.retroalimentacion)}</div>
            </div>` : ''}
        </div>`;
    }

    // ══════════════════════════════════════════════════════════
    //  TEMPLATE
    // ══════════════════════════════════════════════════════════

    function _renderTemplate(root, clase, isDocente) {
      const color   = clase.color || '#6366f1';
      const grad    = `linear-gradient(135deg, ${color}ff 0%, ${color}cc 50%, ${color}88 100%)`;
      const isOwner = isDocente && clase.docenteId === _ctx?.auth?.currentUser?.uid;
      const canManageClase = global.SIA?.canManageAulaClase
        ? global.SIA.canManageAulaClase(_ctx?.profile, clase, _ctx?.auth?.currentUser?.uid)
        : isOwner;
      const metaParts = [];
      if (_shouldShowMateria(clase)) metaParts.push(esc(clase.materia));
      if (_getCareerLabel(clase)) metaParts.push(esc(_getCareerLabel(clase)));
      if (_getSemesterLabel(clase)) metaParts.push(esc(_getSemesterLabel(clase)));
      if (clase.turno) metaParts.push(esc(clase.turno));

      root.innerHTML = `
        <!-- ── Encabezado con gradiente y tabs ── -->
        <div class="aula-clase-header rounded-4 mb-0" style="background:${grad}; overflow:hidden; position:relative;">
          <!-- Orbs decorativos -->
          <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:rgba(255,255,255,0.1);border-radius:50%;pointer-events:none;"></div>
          <div style="position:absolute;bottom:-80px;left:-40px;width:180px;height:180px;background:rgba(255,255,255,0.06);border-radius:50%;pointer-events:none;"></div>

          <div class="p-4">
            <!-- Barra superior -->
            <div class="d-flex align-items-start gap-3 mb-3">
              <button class="btn btn-white-glass rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                      id="aula-clase-back" style="width:40px;height:40px;">
                <i class="bi bi-arrow-left text-white"></i>
              </button>
              <div class="flex-grow-1 text-white min-width-0">
                <h3 class="fw-bold mb-0 text-truncate">${esc(clase.titulo)}</h3>
                <p class="mb-0 opacity-75 small">
                  ${metaParts.join(' · ')}
                </p>
              </div>
              ${isDocente ? `
                <div class="d-flex gap-2 flex-shrink-0 flex-wrap justify-content-end">
                  <!-- Código de acceso con feedback animado -->
                  <button class="btn btn-white-glass rounded-pill px-3 small" id="aula-clase-code-btn"
                          title="Clic para copiar código de acceso">
                    <i class="bi bi-key me-1"></i>
                    <span id="aula-code-label" class="fw-bold">${esc(clase.codigoAcceso)}</span>
                  </button>
                  ${canManageClase ? `
                  <button class="btn btn-white-glass rounded-circle p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                          id="aula-clase-config-btn" title="Configurar clase" style="width:40px;height:40px;">
                    <i class="bi bi-gear text-white"></i>
                  </button>` : ''}
                  <button class="btn btn-white-glass rounded-pill px-3" id="aula-clase-publicar-btn">
                    <i class="bi bi-plus-lg me-1"></i><span class="small fw-semibold">Publicar</span>
                  </button>
                </div>` : ''}
            </div>

            <!-- Profesor (solo para estudiantes) -->
            ${!isDocente ? `
              <div class="d-flex align-items-center gap-2 mb-3">
                <div class="rounded-circle d-flex align-items-center justify-content-center bg-opacity-20"
                     style="width:28px;height:28px;flex-shrink:0;">
                  <i class="bi bi-person-fill text-white" style="font-size:.75rem;"></i>
                </div>
                <span class="text-white opacity-75 small">${esc(clase.docenteNombre || '')}</span>
              </div>` : ''}

            <!-- Stats de actividad (se llenan async) -->
            <div class="d-flex gap-2 flex-wrap mb-3" id="aula-clase-stats-row">
              ${isDocente ? `
                <div class="aula-stat-glass small" id="aula-stat-miembros">
                  <i class="bi bi-people me-1 opacity-75"></i>
                  <span>${clase.miembrosCount || 0}</span> miembros
                </div>
                <div class="aula-stat-glass small d-none" id="aula-stat-sin-calificar">
                  <i class="bi bi-clock-fill me-1 opacity-75 text-warning"></i>
                  <span id="aula-stat-sin-cal-num">0</span> por calificar
                </div>
                <div class="aula-stat-glass small d-none" id="aula-stat-ultima-pub">
                  <i class="bi bi-activity me-1 opacity-75"></i>
                  <span id="aula-stat-ultima-pub-txt">—</span>
                </div>` : `
                <div class="aula-stat-glass small" id="aula-stat-promedio">
                  <i class="bi bi-graph-up me-1 opacity-75"></i>Promedio: <span id="aula-stat-promedio-val">—</span>
                </div>
                <div class="aula-stat-glass small d-none" id="aula-stat-pendientes-est">
                  <i class="bi bi-clock-fill me-1 opacity-75 text-warning"></i>
                  <span id="aula-stat-pendientes-val">0</span> pendientes
                </div>`}
            </div>

            <!-- Tabs dentro del banner -->
            <div class="aula-header-tabs-wrap">
            <ul class="nav aula-header-tabs flex-nowrap" id="aula-clase-tabs" role="tablist">
              <li class="nav-item">
                <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-clase-feed" role="tab">
                  <i class="bi bi-rss me-1"></i>Feed
                </button>
              </li>
              <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-clase-tareas" role="tab">
                  <i class="bi bi-file-earmark-text me-1"></i>Tareas
                  <span class="aula-tab-badge aula-tab-badge--primary" id="aula-tab-badge-tareas" style="display:none;"></span>
                </button>
              </li>
              ${!isDocente ? `
              <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-clase-portfolio" role="tab">
                  <i class="bi bi-briefcase me-1"></i>Mi Portfolio
                </button>
              </li>` : ''}
              <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-clase-miembros" role="tab">
                  <i class="bi bi-people me-1"></i>${isDocente ? 'Miembros' : 'Participantes'}
                  <span class="aula-tab-badge aula-tab-badge--neutral" id="aula-tab-badge-miembros" style="display:none;"></span>
                </button>
              </li>
              ${isDocente ? `
              <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-clase-calificaciones" role="tab">
                  <i class="bi bi-graph-up me-1"></i>Calificaciones
                  <span class="aula-tab-badge aula-tab-badge--danger" id="aula-tab-badge-cal" style="display:none;"></span>
                </button>
              </li>
              <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-clase-analytics" role="tab">
                  <i class="bi bi-bar-chart-line me-1"></i>Analíticas
                </button>
              </li>` : ''}
            </ul>
            </div>
          </div>
        </div>

        <!-- ── Contenido de tabs ── -->
        <div class="tab-content mt-4">

          <!-- FEED -->
          <div class="tab-pane fade show active" id="tab-clase-feed" role="tabpanel">
            <div id="aula-feed-list" class="vstack gap-3"></div>
            <div id="aula-feed-empty" class="text-center py-5 text-muted d-none">
              <i class="bi bi-chat-square-text fs-1 opacity-40 d-block mb-3"></i>
              <p class="mb-0">${isDocente ? 'Publica algo para comenzar.' : 'No hay publicaciones aun.'}</p>
            </div>
          </div>

          <!-- TAREAS -->
          <div class="tab-pane fade" id="tab-clase-tareas" role="tabpanel">
            <div id="aula-tareas-list" class="vstack gap-3"></div>
            <div id="aula-tareas-empty" class="text-center py-5 text-muted d-none">
              <i class="bi bi-file-earmark-text fs-1 opacity-40 d-block mb-3"></i>
              <p class="mb-0">No hay tareas asignadas.</p>
            </div>
          </div>

          <!-- PORTFOLIO (estudiante) -->
          ${!isDocente ? `
          <div class="tab-pane fade" id="tab-clase-portfolio" role="tabpanel">
            <div id="aula-portfolio-container"></div>
          </div>` : ''}

          <!-- MIEMBROS -->
          <div class="tab-pane fade" id="tab-clase-miembros" role="tabpanel">
            ${isDocente ? `
              <!-- Agregar estudiante por matrícula -->
              <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
                <div class="input-group rounded-pill overflow-hidden border shadow-sm" style="max-width:340px;">
                  <span class="input-group-text bg-opacity-20 border-0"><i class="bi bi-search text-muted"></i></span>
                  <input type="text" id="aula-add-matricula" class="form-control border-0" placeholder="Agregar estudiante por matrícula...">
                  <button class="btn btn-primary border-0 px-3" id="aula-add-miembro-btn" title="Agregar estudiante">
                    <i class="bi bi-person-plus"></i>
                  </button>
                </div>
                ${canManageClase ? `
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" id="aula-toggle-codocente-section">
                  <i class="bi bi-person-fill-gear me-1"></i>Agregar co-docente
                </button>` : ''}
              </div>
              <!-- Sección agregar co-docente (colapsable) -->
              ${canManageClase ? `
              <div id="aula-codocente-form" class="mb-3 p-3 border rounded-3" style="display:none;">
                <div class="small fw-semibold mb-2"><i class="bi bi-person-fill-gear me-1 text-primary"></i>Agregar co-docente</div>
                <div class="small text-muted mb-2">Solo se puede agregar a usuarios registrados como docentes en el sistema.</div>
                <div class="input-group rounded-pill overflow-hidden border" style="max-width:400px;">
                  <span class="input-group-text bg-opacity-20 border-0"><i class="bi bi-person-badge text-muted"></i></span>
                  <input type="text" id="aula-add-codocente-input" class="form-control border-0" placeholder="Matrícula o email del docente...">
                  <button class="btn btn-primary border-0 px-3 rounded-pill" id="aula-add-codocente-btn">
                    <i class="bi bi-plus-lg"></i>
                  </button>
                </div>
              </div>` : ''}
            ` : ''}
            <!-- Co-docentes (separados de estudiantes) -->
            <div id="aula-codocentes-list" class="mb-3" style="display:none;">
              <div class="small fw-semibold text-muted mb-2 d-flex align-items-center gap-2">
                <i class="bi bi-person-fill-gear text-primary"></i>Co-docentes
              </div>
              <div id="aula-codocentes-items" class="list-group list-group-flush rounded-4 overflow-hidden border shadow-sm mb-3"></div>
            </div>
            <!-- Estudiantes -->
            <div class="small fw-semibold text-muted mb-2 d-flex align-items-center gap-2" id="aula-estudiantes-label" style="display:none;">
              <i class="bi bi-people text-success"></i>Estudiantes
            </div>
            <div id="aula-miembros-list" class="list-group list-group-flush rounded-4 overflow-hidden border shadow-sm"></div>
            <!-- Sección grupos de trabajo -->
            <div id="aula-grupos-section"></div>
          </div>

          <!-- CALIFICACIONES (docente) -->
          ${isDocente ? `
          <div class="tab-pane fade" id="tab-clase-calificaciones" role="tabpanel">
            <div id="aula-calif-container"></div>
          </div>
          <!-- ANALÍTICAS (docente) -->
          <div class="tab-pane fade" id="tab-clase-analytics" role="tabpanel">
            <div id="aula-analytics-container"></div>
          </div>` : ''}
        </div>
      `;
    }

    // ══════════════════════════════════════════════════════════
    //  FEED — Real-time stream
    // ══════════════════════════════════════════════════════════

    function _startFeedStream(ctx, claseId) {
      const feedList = $id('aula-feed-list');
      if (!feedList) return;

      _unsubFeed = AulaService.streamPublicaciones(ctx, claseId, snap => {
        const feedEmpty = $id('aula-feed-empty');
        if (snap.empty) {
          feedList.innerHTML = '';
          feedEmpty?.classList.remove('d-none');
          return;
        }
        feedEmpty?.classList.add('d-none');

        const pubs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(pub => {
            if (_rolEnClase === 'docente') return true;
            if (pub.tipo !== 'tarea' || !pub.grupoId) return true;
            return _miGrupo?.id === pub.grupoId;
          });
        if (!pubs.length) {
          feedList.innerHTML = '';
          feedEmpty?.classList.remove('d-none');
          const tareasList = $id('aula-tareas-list');
          if (tareasList) {
            tareasList.innerHTML = '';
            $id('aula-tareas-empty')?.classList.remove('d-none');
          }
          return;
        }
        feedEmpty?.classList.add('d-none');

        pubs.sort((a, b) => {
          if (a.fijada && !b.fijada) return -1;
          if (!a.fijada && b.fijada) return 1;
          return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
        });

        feedList.innerHTML = pubs.map(p => _renderPubCard(p)).join('');

        // Actualizar tab Tareas
        const tareasList = $id('aula-tareas-list');
        if (tareasList) {
          const tareas = pubs.filter(p => p.tipo === 'tarea');
          $id('aula-tareas-empty')?.classList.toggle('d-none', tareas.length > 0);
          tareasList.innerHTML = tareas.map(p => _renderTareaCard(p)).join('');
          // Cargar estado/progreso de entregas en background
          const tareaIds = tareas.map(t => t.id);
          if (tareaIds.length) {
            if (_rolEnClase === 'docente') {
              _loadEntregaProgreso(_ctx, tareas, _claseData);
            } else {
              _loadEntregaStatus(_ctx, tareaIds);
            }
          }
        }
      }, { limit: 50 });

      ctx.activeUnsubs.push(_unsubFeed);
    }

    // ══════════════════════════════════════════════════════════
    //  TARJETAS — Feed y Tareas
    // ══════════════════════════════════════════════════════════

    function _renderPubCard(p) {
      const cfg = TYPE_CFG[p.tipo] || TYPE_CFG.aviso;
      const isDocente = _rolEnClase === 'docente';
      const fecha = p.createdAt?.toDate?.()?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) || '';
      const hora  = p.createdAt?.toDate?.()?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || '';

      // Deadline badge
      let deadlineHTML = '';
      if (p.tipo === 'tarea' && p.fechaEntrega) {
        const fechaE = p.fechaEntrega.toDate ? p.fechaEntrega.toDate() : new Date(p.fechaEntrega);
        const vencida = new Date() > fechaE;
        const fechaStr = fechaE.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        deadlineHTML = `<span class="badge rounded-pill small ${vencida ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info'}">
          <i class="bi bi-clock me-1"></i>${vencida ? 'Vencida' : 'Entrega'}: ${fechaStr}
        </span>`;
      }

      // Imagen miniatura (primer archivo imagen)
      const firstImg = (p.archivos || []).find(a => _isImageUrl(a.url));
      const imgHTML = firstImg ? `
        <div class="mt-2 rounded-3 overflow-hidden" style="max-height:150px;">
          <img src="${esc(firstImg.url)}" class="w-100" loading="lazy"
               style="object-fit:cover;max-height:150px;display:block;"
               alt="${esc(firstImg.nombre || 'Imagen')}" onerror="this.closest('div').remove()">
        </div>` : '';

      // Archivos no-imagen
      const otrosFiles = (p.archivos || []).filter(a => !_isImageUrl(a.url));
      const filesHTML = otrosFiles.map(a =>
        `<a href="${esc(a.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"
            class="badge bg-light text-dark border text-decoration-none me-1 py-1 px-2 small">
          <i class="bi bi-paperclip me-1"></i>${esc(a.nombre || 'Archivo')}
        </a>`
      ).join('');

      return `
        <div class="aula-pub-card card border-0 shadow-sm rounded-4 overflow-hidden" data-pub-id="${p.id}" role="button" style="cursor:pointer;">
          <div style="height:3px;background:${cfg.grad};"></div>
          <div class="card-body p-3">
            <div class="d-flex align-items-start gap-3">
              <!-- Icono tipo -->
              <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                   style="background:${cfg.grad};width:44px;height:44px;box-shadow:0 4px 12px ${cfg.color}40;">
                <i class="bi ${cfg.icon} text-white fs-5"></i>
              </div>
              <div class="flex-grow-1 min-width-0">
                <!-- Header row -->
                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span class="badge rounded-pill small fw-semibold" style="background:${cfg.color}15;color:${cfg.color};">${cfg.label}</span>
                  ${p.fijada ? '<span class="badge bg-warning-subtle text-warning rounded-pill small"><i class="bi bi-pin-angle-fill me-1"></i>Fijada</span>' : ''}
                  ${p.tipo === 'tarea' && p.grupoId ? `<span class="badge bg-secondary-subtle text-secondary rounded-pill small"><i class="bi bi-people-fill me-1"></i>${esc(p.grupoNombre || 'Grupo asignado')}</span>` : ''}
                  <span class="text-muted small ms-auto">${fecha} ${hora}</span>
                </div>
                ${p.titulo ? `<h6 class="fw-bold mb-1">${esc(p.titulo)}</h6>` : ''}
                ${p.contenido ? `<p class="text-muted small mb-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line;">${esc(p.contenido)}</p>` : ''}
                ${imgHTML}
                ${filesHTML ? `<div class="mt-1">${filesHTML}</div>` : ''}
                ${deadlineHTML ? `<div class="mt-2">${deadlineHTML}</div>` : ''}
                <!-- Footer -->
                <div class="d-flex align-items-center gap-2 mt-2 small">
                  <i class="bi bi-person text-muted"></i>
                  <span class="text-muted text-truncate">${esc(p.autorNombre)}</span>
                  <span class="text-muted ms-auto opacity-50"><i class="bi bi-chat-left me-1"></i>Ver mas</span>
                  ${p.tipo === 'tarea' && !isDocente ? `
                    <button class="btn btn-sm rounded-pill px-3 text-white fw-semibold aula-entregar-btn ms-1"
                            style="background:${cfg.grad};" data-pub-id="${p.id}">
                      <i class="bi bi-upload me-1"></i>Entregar
                    </button>` : ''}
                  ${p.tipo === 'tarea' && isDocente ? `
                    <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 aula-ver-entregas-btn ms-1"
                            data-pub-id="${p.id}">
                      <i class="bi bi-list-check me-1"></i>Entregas
                    </button>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function _renderTareaCard(p) {
      const cfg = TYPE_CFG.tarea;
      const isDocente = _rolEnClase === 'docente';
      const fechaE = p.fechaEntrega?.toDate ? p.fechaEntrega.toDate() : (p.fechaEntrega ? new Date(p.fechaEntrega) : null);
      const now = new Date();

      // Countdown dinámico por urgencia
      let countdownHTML = '<span class="text-muted"><i class="bi bi-clock me-1"></i>Sin fecha límite</span>';
      if (fechaE) {
        const diffMs   = fechaE - now;
        const diffDias = Math.floor(diffMs / 86400000);
        const diffHoras = Math.floor(diffMs / 3600000);
        if (diffMs < 0) {
          const diasVenc = Math.abs(diffDias);
          countdownHTML = `<span class="text-danger"><i class="bi bi-clock me-1"></i>Vencida hace ${diasVenc > 0 ? diasVenc + (diasVenc === 1 ? ' día' : ' días') : 'hoy'}</span>`;
        } else if (diffHoras < 24) {
          countdownHTML = `<span class="text-danger fw-semibold"><i class="bi bi-clock-fill me-1"></i>¡Vence hoy!</span>`;
        } else if (diffDias <= 2) {
          countdownHTML = `<span class="text-warning fw-semibold"><i class="bi bi-clock me-1"></i>Vence en ${diffDias} ${diffDias === 1 ? 'día' : 'días'}</span>`;
        } else if (diffDias <= 7) {
          countdownHTML = `<span class="text-success"><i class="bi bi-clock me-1"></i>Vence en ${diffDias} días</span>`;
        } else {
          const fechaStr = fechaE.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
          countdownHTML = `<span class="text-muted"><i class="bi bi-clock me-1"></i>${fechaStr}</span>`;
        }
      }

      return `
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden aula-pub-card" data-pub-id="${p.id}" role="button" style="cursor:pointer;">
          <div style="height:3px;background:${cfg.grad};"></div>
          <div class="p-3 d-flex align-items-center gap-3">
            <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                 style="background:${cfg.grad};width:44px;height:44px;box-shadow:0 4px 12px ${cfg.color}40;">
              <i class="bi bi-file-earmark-text text-white fs-5"></i>
            </div>
            <div class="flex-grow-1 min-width-0">
              <h6 class="fw-bold mb-0 small text-truncate">${esc(p.titulo)}</h6>
              <div class="d-flex gap-2 small mt-1 flex-wrap">
                ${countdownHTML}
                <span class="text-muted"><i class="bi bi-star me-1"></i>${p.puntajeMax || 100} pts</span>
                ${p.grupoId ? `<span class="text-muted"><i class="bi bi-people-fill me-1"></i>${esc(p.grupoNombre || 'Grupo asignado')}</span>` : ''}
                ${isDocente ? `<span class="text-muted small" data-progreso-pub="${p.id}"></span>` : ''}
              </div>
              ${!isDocente ? `<div class="mt-1" data-entrega-status="${p.id}"></div>` : ''}
            </div>
            ${!isDocente ? `
              <button class="btn btn-sm rounded-pill px-3 text-white fw-semibold aula-entregar-btn flex-shrink-0"
                      style="background:${cfg.grad};" data-pub-id="${p.id}">
                <i class="bi bi-upload me-1"></i>Entregar
              </button>` : ''}
            ${isDocente ? `
              <button class="btn btn-sm btn-outline-primary rounded-pill px-3 aula-ver-entregas-btn flex-shrink-0"
                      data-pub-id="${p.id}">
                <i class="bi bi-list-check me-1"></i>Entregas
              </button>` : ''}
          </div>
        </div>`;
    }

    // ══════════════════════════════════════════════════════════
    //  MODAL DETALLE DE PUBLICACION + COMENTARIOS
    // ══════════════════════════════════════════════════════════

    async function _openPubDetail(ctx, pub) {
      const cfg = TYPE_CFG[pub.tipo] || TYPE_CFG.aviso;
      const isDocente = _rolEnClase === 'docente';
      const modalId = 'aula-pub-detail-modal';
      const existingEl = document.getElementById(modalId);

      // Un solo flujo de apertura por publicación; evita reentradas que rompen Bootstrap
      if (existingEl && _pubDetailState === 'opening') {
      }
      if (existingEl && _activePubDetailId === pub.id && _pubDetailState === 'open') {
        return;
      }
      
      if (existingEl) {
        _cleanupPubDetailModal(existingEl);
      }

      _activePubDetailId = pub.id;
      _pubDetailState = 'opening';


      const imagenes = (pub.archivos || []).filter(a => _isImageUrl(a.url));
      const otros    = (pub.archivos || []).filter(a => !_isImageUrl(a.url));

      const fechaCreacion = pub.createdAt?.toDate?.()?.toLocaleString('es-MX', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      }) || '';

      let tareaInfoHTML = '';
      if (pub.tipo === 'tarea' && pub.fechaEntrega) {
        const fechaE = pub.fechaEntrega.toDate ? pub.fechaEntrega.toDate() : new Date(pub.fechaEntrega);
        const vencida = new Date() > fechaE;
        const fechaStr = fechaE.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        const horaStr  = fechaE.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const grad     = vencida
          ? 'linear-gradient(135deg,#dc2626,#991b1b)'
          : 'linear-gradient(135deg,#3b82f6,#1d4ed8)';

        tareaInfoHTML = `
          <div class="rounded-4 mb-3 overflow-hidden" style="background:${grad};">
            <div class="p-3 text-white">
              <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <div>
                  <div class="small opacity-75 mb-1"><i class="bi bi-calendar-event me-1"></i>${vencida ? 'Venció el' : 'Entrega el'}</div>
                  <div class="fw-bold">${fechaStr}</div>
                  <div class="small opacity-90">${horaStr}</div>
                </div>
                <div class="text-center">
                  <div class="small opacity-75 mb-1">${vencida ? 'Tiempo vencido' : 'Tiempo restante'}</div>
                  <div class="fw-bold fs-5 font-monospace" id="aula-deadline-countdown" style="letter-spacing:.05em;">
                    ${vencida ? '—' : '...'}
                  </div>
                </div>
                <div class="text-center">
                  <div class="rounded-3 px-3 py-2" style="background:rgba(255,255,255,0.18);">
                    <div class="small opacity-75">Puntos</div>
                    <div class="fw-bold fs-5">${pub.puntajeMax || 100}</div>
                  </div>
                </div>
              </div>
              ${pub.permiteEntregaTardia ? '<div class="mt-2 small opacity-90"><i class="bi bi-check-circle me-1"></i>Entrega tardía permitida</div>' : ''}
            </div>
          </div>`;
      }

      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <!-- Header con gradiente -->
              <div style="background:${cfg.grad}; padding:1.5rem 1.5rem 1.25rem;">
                <div class="d-flex align-items-start gap-3">
                  <div class="bg-opacity-25 rounded-3 p-2 flex-shrink-0">
                    <i class="bi ${cfg.icon} text-white fs-4"></i>
                  </div>
                  <div class="flex-grow-1 min-width-0">
                    <div class="d-flex gap-2 mb-1 flex-wrap">
                      <span class="badge bg-opacity-25 text-white small">${cfg.label}</span>
                      ${pub.fijada ? '<span class="badge bg-opacity-25 text-white small"><i class="bi bi-pin-angle-fill me-1"></i>Fijada</span>' : ''}
                    </div>
                    <h5 class="text-white fw-bold mb-0">${esc(pub.titulo || '(Sin titulo)')}</h5>
                  </div>
                  <button type="button" class="btn-close btn-close-white flex-shrink-0" data-bs-dismiss="modal"></button>
                </div>
                <div class="d-flex gap-3 mt-2 small text-white opacity-75 flex-wrap">
                  <span><i class="bi bi-person me-1"></i>${esc(pub.autorNombre)}</span>
                  <span><i class="bi bi-clock me-1"></i>${fechaCreacion}</span>
                </div>
              </div>

              <div class="modal-body p-4">
                ${tareaInfoHTML}
                ${pub.contenido ? `<div class="mb-3" style="white-space:pre-line;line-height:1.6;">${esc(pub.contenido)}</div>` : ''}

                <!-- Galeria de imagenes -->
                ${imagenes.length ? `
                  <div class="row g-2 mb-3">
                    ${imagenes.map((a, i) => `
                      <div class="${imagenes.length === 1 ? 'col-12' : 'col-6'}">
                        <a href="${esc(a.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                          <img src="${esc(a.url)}" class="w-100 rounded-3 img-fluid"
                               style="object-fit:cover;max-height:${imagenes.length === 1 ? '400px' : '200px'};width:100%;"
                               alt="${esc(a.nombre || 'Imagen ' + (i+1))}" loading="lazy"
                               onerror="this.closest('a').parentElement.remove()">
                        </a>
                      </div>`).join('')}
                  </div>` : ''}

                <!-- Otros archivos -->
                ${otros.length ? `
                  <div class="d-flex flex-wrap gap-2 mb-3">
                    ${otros.map(a => `
                      <a href="${esc(a.url)}" target="_blank" rel="noopener"
                         class="btn btn-sm btn-light border rounded-pill px-3 text-decoration-none">
                        <i class="bi bi-paperclip me-1"></i>${esc(a.nombre || 'Archivo')}
                      </a>`).join('')}
                  </div>` : ''}

                <!-- Encuesta -->
                ${pub.tipo === 'encuesta' && Array.isArray(pub.opciones) ? `
                  <div class="mb-3 vstack gap-2" id="aula-poll-container">
                    <div class="small fw-semibold text-muted mb-1"><i class="bi bi-bar-chart me-1"></i>Opciones</div>
                    ${pub.opciones.map((op, i) => `
                      <button class="btn btn-outline-secondary text-start rounded-pill px-4 aula-vote-btn"
                              data-pub-id="${pub.id}" data-option="${i}">
                        ${esc(op)}
                      </button>`).join('')}
                  </div>` : ''}

                ${!isDocente && pub.tipo === 'tarea' ? `
                  <div id="aula-detail-entrega-summary" class="mb-3 d-none"></div>` : ''}

                <!-- Entregar (estudiante, tarea) -->
                ${!isDocente && pub.tipo === 'tarea' ? `
                  <div class="d-grid mb-3">
                    <button class="btn rounded-pill py-2 text-white fw-semibold aula-entregar-btn"
                            style="background:${cfg.grad};box-shadow:0 4px 12px ${cfg.color}40;"
                            data-pub-id="${pub.id}">
                      <i class="bi bi-upload me-1"></i>Entregar tarea
                    </button>
                  </div>` : ''}

                <!-- Comentarios: lista dentro del body scrollable -->
                <div class="border-top pt-3 mt-1">
                  <div class="small fw-semibold text-uppercase text-muted mb-3" style="letter-spacing:.05em;">
                    <i class="bi bi-chat-left me-1"></i>Comentarios
                  </div>
                  <div id="aula-detail-comments" class="vstack gap-2"
                       style="max-height:240px;overflow-y:auto;scroll-behavior:smooth;"></div>
                </div>
              </div>

              <!-- Footer fijo: input siempre visible + botones docente -->
              <div class="modal-footer flex-column align-items-stretch gap-0 px-4 pb-3 pt-2 border-top">
                <!-- Indicador de respuesta (oculto por defecto) -->
                <div id="aula-reply-indicator" class="d-none d-flex align-items-center gap-2 py-1 px-2 mb-1 rounded-2"
                     style="background:rgba(99,102,241,0.08);font-size:.82rem;">
                  <i class="bi bi-reply-fill text-primary" style="font-size:.85rem;"></i>
                  <span class="text-muted flex-grow-1">Respondiendo a <strong id="aula-reply-name"></strong></span>
                  <button type="button" class="btn-close btn-sm p-0" id="aula-reply-cancel" style="font-size:.65rem;"></button>
                </div>
                <div class="d-flex gap-2 align-items-center pt-1">
                  <div class="aula-comment-avatar flex-shrink-0" id="aula-my-avatar" style="cursor:default;">
                    <i class="bi bi-person-fill"></i>
                  </div>
                  <input type="text" id="aula-detail-comment-input"
                         class="form-control rounded-pill border bg-light"
                         placeholder="Escribe un comentario..." maxlength="500">
                  <button class="btn rounded-pill px-3 flex-shrink-0" id="aula-detail-comment-send"
                          style="background:${cfg.grad};border:none;color:white;">
                    <i class="bi bi-send-fill"></i>
                  </button>
                </div>
                ${isDocente ? `
                <div class="d-flex gap-2 pt-1">
                  <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" id="aula-detail-pin-btn">
                    <i class="bi bi-pin${pub.fijada ? '-angle-fill' : ''} me-1"></i>${pub.fijada ? 'Desfijar' : 'Fijar'}
                  </button>
                  <button class="btn btn-sm btn-outline-primary rounded-pill px-3" id="aula-detail-edit-btn">
                    <i class="bi bi-pencil me-1"></i>Editar
                  </button>
                  <button class="btn btn-sm btn-outline-danger rounded-pill px-3 ms-auto" id="aula-detail-delete-btn">
                    <i class="bi bi-trash me-1"></i>Eliminar
                  </button>
                </div>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      const modalEl = div.firstElementChild;
      document.body.appendChild(modalEl);

      // ── Countdown timer para tareas ──
      if (pub.tipo === 'tarea' && pub.fechaEntrega) {
        const fechaE = pub.fechaEntrega.toDate ? pub.fechaEntrega.toDate() : new Date(pub.fechaEntrega);
        const countdownEl = modalEl.querySelector('#aula-deadline-countdown');
        if (countdownEl) {
          const _tick = () => {
            if (!document.body.contains(countdownEl)) { clearInterval(_deadlineCountdown); return; }
            const diff = fechaE - new Date();
            if (diff <= 0) { countdownEl.textContent = 'Vencida'; clearInterval(_deadlineCountdown); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            countdownEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
          };
          _tick();
          _deadlineCountdown = setInterval(_tick, 1000);
        }
      }

      // ── Avatar del usuario actual ──
      const myAvatarEl = modalEl.querySelector('#aula-my-avatar');
      if (myAvatarEl) {
        const myPhoto = ctx.profile?.photoURL || ctx.auth.currentUser?.photoURL || '';
        if (myPhoto) {
          myAvatarEl.innerHTML = `<img src="${esc(myPhoto)}" class="rounded-circle" style="width:32px;height:32px;object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'bi bi-person-fill\\'></i>'">`;
        }
      }

      // ── Comentarios real-time ──
      modalEl.addEventListener('shown.bs.modal', () => {
        if (_activePubDetailId === pub.id) _pubDetailState = 'open';
      }, { once: true });

      const commentsDiv = modalEl.querySelector('#aula-detail-comments');
      if (_unsubComments) { _unsubComments(); _unsubComments = null; }

      const EMOJIS = ['👍', '❤️', '😮', '🤔', '😂'];

      // Estado de respuesta (reply-to)
      let _replyingTo = null; // { id, autorNombre }
      const replyIndicator = modalEl.querySelector('#aula-reply-indicator');
      const replyName      = modalEl.querySelector('#aula-reply-name');
      const replyCancel    = modalEl.querySelector('#aula-reply-cancel');
      const commentInputEl = modalEl.querySelector('#aula-detail-comment-input');

      function _setReply(comment) {
        _replyingTo = comment;
        if (replyName) replyName.textContent = comment.autorNombre || 'usuario';
        replyIndicator?.classList.remove('d-none');
        commentInputEl?.focus();
      }
      function _clearReply() {
        _replyingTo = null;
        replyIndicator?.classList.add('d-none');
        if (replyName) replyName.textContent = '';
      }
      replyCancel?.addEventListener('click', _clearReply);

      _unsubComments = AulaService.streamComentarios(ctx, pub.id, snap => {
        if (!commentsDiv || !document.body.contains(commentsDiv)) return; // stale listener guard
        if (snap.empty) {
          commentsDiv.innerHTML = '<p class="text-muted small text-center py-2 mb-0">Aun no hay comentarios.</p>';
          return;
        }
        const myUid = ctx.auth?.currentUser?.uid || '';
        commentsDiv.innerHTML = snap.docs.map(d => {
          const c = d.data();
          const comentarioId = d.id;
          const hora = c.createdAt?.toDate?.()?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || '';
          // Resaltar @menciones en el contenido
          const contenidoHtml = esc(c.contenido || '').replace(/@(\w[\w\s]*?)(?=\s|$|[,.])/g,
            '<span class="badge bg-primary-subtle text-primary fw-normal">@$1</span>');

          // Avatar: foto real o inicial
          const nombreAutor = c.autorNombre || '';
          const inicial = nombreAutor ? nombreAutor.charAt(0).toUpperCase() : '?';
          const fotoUrl = c.autorFoto || '';
          const avatarHTML = fotoUrl
            ? `<img src="${esc(fotoUrl)}" class="rounded-circle flex-shrink-0"
                    style="width:32px;height:32px;object-fit:cover;margin-top:4px;"
                    onerror="this.outerHTML='<div class=\\'rounded-circle d-flex align-items-center justify-content-center bg-secondary text-white flex-shrink-0\\' style=\\'width:32px;height:32px;font-size:.9rem;margin-top:4px;\\'>${inicial}</div>'">`
            : `<div class="rounded-circle d-flex align-items-center justify-content-center bg-secondary text-white flex-shrink-0"
                    style="width:32px;height:32px;font-size:.9rem;margin-top:4px;">${inicial}</div>`;

          // Hilo de respuesta (si aplica)
          const replyHTML = c.replyTo?.autorNombre
            ? `<div class="small text-muted mb-1 px-1" style="font-size:.76rem;border-left:2px solid #6366f1;padding-left:6px;">
                 <i class="bi bi-reply-fill me-1" style="font-size:.7rem;"></i>Respondiendo a <strong>${esc(c.replyTo.autorNombre || '')}</strong>
               </div>`
            : '';

          return `
            <div class="d-flex align-items-start gap-2 w-100" data-comentario-id="${comentarioId}">
              ${avatarHTML}
              <div class="d-flex flex-column flex-grow-1" style="min-width:0;">
                ${replyHTML}
                <div class="rounded-4 px-3 py-2 bg-light text-dark shadow-sm">
                  <div class="small fw-bold text-dark mb-1 lh-sm">${esc(nombreAutor)}</div>
                  <div class="small" style="line-height:1.4;word-wrap:break-word;">${contenidoHtml}</div>
                </div>
                <div class="d-flex align-items-center gap-2 mt-1 ms-1 flex-wrap">
                  <span class="text-muted" style="font-size:.74rem;">${hora}</span>
                  <button class="btn btn-sm border-0 p-0 text-muted aula-reply-btn" data-cid="${comentarioId}"
                          data-autor="${esc(nombreAutor)}"
                          style="font-size:.74rem;opacity:.6;transition:opacity .15s;"
                          title="Responder">
                    <i class="bi bi-reply me-1"></i>Responder
                  </button>
                  <div class="d-flex align-items-center gap-1" data-reactions-for="${comentarioId}">
                    ${EMOJIS.map(em => `<button class="btn btn-sm border-0 p-0 aula-emoji-btn" data-emoji="${em}" data-cid="${comentarioId}"
                              style="font-size:.95rem;line-height:1;opacity:.4;transition:opacity .15s;"
                              title="Reaccionar con ${em}">${em}</button>`).join('')}
                  </div>
                </div>
              </div>
            </div>`;
        }).join('');
        commentsDiv.scrollTop = commentsDiv.scrollHeight;

        // Cargar conteos de reacciones en background
        _loadAllReacciones(ctx, snap.docs.map(d => d.id));
      }, 50);
      const _myUnsub = _unsubComments; // captura local para evitar race condition en hidden.bs.modal
      ctx.activeUnsubs?.push(_unsubComments);

      // ── Click en emoji → toggle reacción ──
      commentsDiv.addEventListener('click', async e => {
        // Botón Responder
        const replyBtn = e.target.closest('.aula-reply-btn');
        if (replyBtn) {
          _setReply({ id: replyBtn.dataset.cid, autorNombre: replyBtn.dataset.autor });
          return;
        }
        const btn = e.target.closest('.aula-emoji-btn');
        if (!btn) return;
        const emoji = btn.dataset.emoji;
        const cid   = btn.dataset.cid;
        try {
          await AulaService.toggleReaccion(ctx, cid, emoji);
          const reacciones = await AulaService.getReacciones(ctx, cid);
          _renderReaccionesRow(cid, reacciones);
        } catch (_) {}
      });

      // ── @Menciones en el input ──
      const commentInput = modalEl.querySelector('#aula-detail-comment-input');
      let _miembrosCache = null;
      let _mentionDropdown = null;

      if (commentInput) {
        commentInput.addEventListener('keyup', async e => {
          const val   = commentInput.value;
          const caret = commentInput.selectionStart;
          // Detectar @ justo antes del cursor
          const antes = val.slice(0, caret);
          const match = antes.match(/@(\w*)$/);

          if (match) {
            const query = match[1].toLowerCase();
            // Cargar miembros si aún no se tienen
            if (!_miembrosCache) {
              try { _miembrosCache = await AulaService.getMiembros(ctx, _claseId, 100); } catch (_) { _miembrosCache = []; }
            }
            const filtrados = _miembrosCache.filter(m =>
              m.userName?.toLowerCase().includes(query) || m.matricula?.toLowerCase().includes(query)
            ).slice(0, 5);
            _showMentionDropdown(commentInput, filtrados, match[0]);
          } else {
            _hideMentionDropdown();
          }
        });
        commentInput.addEventListener('blur', () => setTimeout(_hideMentionDropdown, 200));
      }

      function _showMentionDropdown(input, miembros, matched) {
        _hideMentionDropdown();
        if (!miembros.length) return;
        const dd = document.createElement('ul');
        dd.id = 'aula-mention-dropdown';
        dd.className = 'list-group shadow border-0 rounded-3 position-absolute';
        dd.style.cssText = 'z-index:9999;min-width:200px;max-width:320px;bottom:calc(100% + 4px);left:0;';
        dd.innerHTML = miembros.map(m => `
          <li class="list-group-item list-group-item-action py-2 px-3 border-0 small"
              data-nombre="${esc(m.userName)}" style="cursor:pointer;">
            <i class="bi bi-person me-1 text-muted"></i>${esc(m.userName)}
          </li>`).join('');
        const wrapper = input.parentElement;
        wrapper.style.position = 'relative';
        wrapper.appendChild(dd);
        _mentionDropdown = dd;
        dd.addEventListener('mousedown', e => {
          const li = e.target.closest('li[data-nombre]');
          if (!li) return;
          e.preventDefault();
          const nombre = li.dataset.nombre;
          const val = input.value;
          const caret = input.selectionStart;
          const antes = val.slice(0, caret);
          const nuevo = antes.replace(/@(\w*)$/, `@${nombre} `) + val.slice(caret);
          input.value = nuevo;
          _hideMentionDropdown();
          input.focus();
        });
      }

      function _hideMentionDropdown() {
        if (_mentionDropdown) { _mentionDropdown.remove(); _mentionDropdown = null; }
      }

      // ── Enviar comentario ──
      function sendComment() {
        const input = modalEl.querySelector('#aula-detail-comment-input');
        const text = input?.value.trim();
        if (!text) return;
        _hideMentionDropdown();
        input.value = '';
        const replyTo = _replyingTo ? { id: _replyingTo.id || '', autorNombre: _replyingTo.autorNombre || '' } : null;
        _clearReply();
        AulaService.addComentario(ctx, pub.id, text, replyTo).catch(err => {
          console.error(err); toast('Error al comentar', 'danger');
        });
      }
      modalEl.querySelector('#aula-detail-comment-send')?.addEventListener('click', sendComment);
      modalEl.querySelector('#aula-detail-comment-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); }
      });

      // ── Acciones docente ──
      const bsModalElement = modalEl;
      const modalInstance = new bootstrap.Modal(bsModalElement);
      let detailModalCleaned = false;
      const closeDetailModal = (next) => {
        if (typeof next === 'function') {
          bsModalElement.addEventListener('hidden.bs.modal', () => next(), { once: true });
        }
        const instance = bootstrap.Modal.getInstance(bsModalElement);
        if (!instance) {
          if (!detailModalCleaned) {
            detailModalCleaned = true;
            if (_myUnsub) { _myUnsub(); if (_unsubComments === _myUnsub) _unsubComments = null; }
            if (_deadlineCountdown) { clearInterval(_deadlineCountdown); _deadlineCountdown = null; }
            try { bootstrap.Modal.getInstance(bsModalElement)?.dispose(); } catch (_) {}
            if (bsModalElement.isConnected) bsModalElement.remove();
            _cleanupModalArtifacts();
          }
          if (typeof next === 'function') next();
          return;
        }
        instance.hide();
      };

      if (isDocente) {
        modalEl.querySelector('#aula-detail-pin-btn')?.addEventListener('click', async () => {
          try {
            await AulaService.toggleFijada(ctx, pub.id, !pub.fijada);
            toast(pub.fijada ? 'Publicacion desfijada' : 'Publicacion fijada', 'success');
            closeDetailModal();
          } catch (_) { toast('Error', 'danger'); }
        });
        modalEl.querySelector('#aula-detail-edit-btn')?.addEventListener('click', () => {
          closeDetailModal(() => {
            if (global.AulaPublicar?.openModal) global.AulaPublicar.openModal(ctx, _claseId, pub);
          });
        });
        modalEl.querySelector('#aula-detail-delete-btn')?.addEventListener('click', async () => {
          if (!confirm('¿Eliminar esta publicacion?')) return;
          try {
            await AulaService.deletePublicacion(ctx, pub.id);
            toast('Publicacion eliminada', 'success');
            closeDetailModal();
          } catch (_) { toast('Error al eliminar', 'danger'); }
        });
      }

      // ── Acciones dentro del modal (entregar, votar) ──
      modalEl.addEventListener('click', e => {
        const entBtn = e.target.closest('.aula-entregar-btn');
        if (entBtn) {
          closeDetailModal(() => {
            if (global.AulaEntregas?.openSubmitModal) global.AulaEntregas.openSubmitModal(ctx, _claseId, pub.id);
          });
          return;
        }
        const voteBtn = e.target.closest('.aula-vote-btn');
        if (voteBtn) _handleVote(ctx, voteBtn.dataset.pubId, parseInt(voteBtn.dataset.option), voteBtn);
      });

      // ── Limpiar al cerrar ──
      bsModalElement.addEventListener('hidden.bs.modal', () => {
        if (detailModalCleaned) return;
        detailModalCleaned = true;
        if (_myUnsub) { _myUnsub(); if (_unsubComments === _myUnsub) _unsubComments = null; }
        // Detener countdown timer
        if (_deadlineCountdown) { clearInterval(_deadlineCountdown); _deadlineCountdown = null; }
        if (_activePubDetailId === pub.id) {
          _activePubDetailId = null;
          _pubDetailState = 'idle';
        }
        try { bootstrap.Modal.getInstance(bsModalElement)?.dispose(); } catch (_) {}
        if (bsModalElement.isConnected) bsModalElement.remove();
        _cleanupModalArtifacts();
      }, { once: true });

      modalInstance.show();

      // Async: si el estudiante ya entregó esta tarea, actualizar el botón en el modal
      if (!isDocente && pub.tipo === 'tarea') {
        AulaService.getMiEntrega(ctx, pub.id, ctx.auth.currentUser.uid).then(entrega => {
          if (!document.body.contains(modalEl)) return;
          _renderMiEntregaResumen(modalEl.querySelector('#aula-detail-entrega-summary'), entrega, pub.puntajeMax || 100);
          if (!entrega) return;
          const btn = modalEl.querySelector('.aula-entregar-btn');
          if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Modificar entrega';
            btn.style.background = '#198754';
            btn.style.boxShadow = '0 4px 12px #19875440';
          }
        }).catch(() => {});
      }

      // Async: cargar resultados y estado del voto si es encuesta
      if (pub.tipo === 'encuesta' && Array.isArray(pub.opciones)) {
        AulaService.getResultados(ctx, pub.id).then(({ totals, miVoto, total }) => {
          _renderPollResultados(modalEl, pub, totals, miVoto, total);
        }).catch(() => {});
      }
    }

    /**
     * Actualiza el contenedor de opciones de encuesta mostrando resultados y el voto actual del usuario.
     * Si nadie ha votado aún y el usuario tampoco, mantiene los botones de voto originales.
     * @param {HTMLElement} modalEl - El elemento del modal
     * @param {object} pub - Publicación de tipo encuesta
     * @param {object} totals - Mapa de índice → conteo de votos
     * @param {number|null} miVoto - Índice de la opción que votó el usuario, o null si no ha votado
     * @param {number} total - Total de votos registrados
     */
    function _renderPollResultados(modalEl, pub, totals, miVoto, total) {
      const container = modalEl.querySelector('#aula-poll-container');
      if (!container) return;

      const yaVoto = miVoto !== null;

      // Si no hay votos y el usuario tampoco ha votado: mantener botones originales (no sobreescribir)
      if (total === 0 && !yaVoto) return;

      const opcionesHTML = pub.opciones.map((op, i) => {
        const count = totals[i] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const esMiVoto = miVoto === i;
        const barColor = esMiVoto ? 'var(--bs-primary, #0d6efd)' : '#9ca3af';

        return `
          <div class="mb-2">
            <div class="d-flex align-items-center gap-2 mb-1">
              <i class="bi ${esMiVoto ? 'bi-check-circle-fill text-primary' : 'bi-circle text-muted'}" style="font-size:.8rem;flex-shrink:0;"></i>
              <span class="small flex-grow-1 ${esMiVoto ? 'fw-semibold text-primary' : ''}">${esc(op)}</span>
              <span class="small text-muted flex-shrink-0">${count} ${count === 1 ? 'voto' : 'votos'} (${pct}%)</span>
            </div>
            <div class="progress" style="height:5px;border-radius:99px;background:#e5e7eb;">
              <div class="progress-bar" role="progressbar"
                   style="width:${pct}%;background:${barColor};border-radius:99px;transition:width .4s ease;"
                   aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            ${!yaVoto ? `
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 mt-1 aula-vote-btn"
                      data-pub-id="${esc(pub.id)}" data-option="${i}" style="font-size:.78rem;">
                Votar
              </button>` : ''}
          </div>`;
      }).join('');

      container.innerHTML = `
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-bar-chart-fill text-primary" style="font-size:.9rem;"></i>
          <span class="small fw-semibold text-muted">${total} ${total === 1 ? 'voto registrado' : 'votos registrados'}</span>
          ${yaVoto ? '<span class="badge bg-success-subtle text-success rounded-pill ms-auto" style="font-size:.72rem;"><i class="bi bi-check2 me-1"></i>Votaste</span>' : ''}
        </div>
        ${opcionesHTML}`;
    }

    // ══════════════════════════════════════════════════════════
    //  EVENTOS
    // ══════════════════════════════════════════════════════════

    function _bindEvents(ctx, clase, isDocente) {
      const root = _getRoot();
      if (_boundRoot && _rootClickHandler) {
        _boundRoot.removeEventListener('click', _rootClickHandler);
      }

      // Back
      $id('aula-clase-back')?.addEventListener('click', () => global.Aula?.navigateBack?.());

      // Copiar código con feedback animado en el botón
      $id('aula-clase-code-btn')?.addEventListener('click', () => {
        const label = $id('aula-code-label');
        navigator.clipboard?.writeText(clase.codigoAcceso)
          .then(() => {
            toast('Código copiado', 'success');
            if (label) {
              const original = label.textContent;
              label.textContent = '¡Copiado!';
              setTimeout(() => { label.textContent = original; }, 2000);
            }
          })
          .catch(() => toast('Código de acceso: ' + clase.codigoAcceso, 'info'));
      });

      // Botón configurar clase (solo owner) → abre modal de editar en AdminAula
      $id('aula-clase-config-btn')?.addEventListener('click', () => {
        _openClaseSettingsModal(ctx, _claseData || clase);
      });

      // Publicar (docente)
      $id('aula-clase-publicar-btn')?.addEventListener('click', () => {
        if (global.AulaPublicar?.openModal) global.AulaPublicar.openModal(ctx, _claseId);
      });

      // Eventos delegados sobre la vista
      _rootClickHandler = e => {
        // Click en pub card → modal detalle (ignorar clics en botones/links)
        const pubCard = e.target.closest('.aula-pub-card');
        if (pubCard && !e.target.closest('button, a, .aula-entregar-btn, .aula-ver-entregas-btn, .aula-vote-btn')) {
          const pubId = pubCard.dataset.pubId;
          if (pubId) {
            _getAccessiblePub(ctx, pubId)
              .then(pub => { if (pub) _openPubDetail(ctx, pub); })
              .catch(err => console.error('[AulaClase] getPublicacion error:', err));
          }
          return;
        }
        // Entregar tarea
        const entBtn = e.target.closest('.aula-entregar-btn');
        if (entBtn) {
          if (global.AulaEntregas?.openSubmitModal) {
            global.AulaEntregas.openSubmitModal(ctx, _claseId, entBtn.dataset.pubId);
          } else {
            console.warn('[AulaClase] AulaEntregas.openSubmitModal no disponible');
            toast('No se pudo abrir el formulario de entrega', 'danger');
          }
          return;
        }
        // Ver entregas (docente)
        const verBtn = e.target.closest('.aula-ver-entregas-btn');
        if (verBtn) {
          if (global.AulaEntregas?.openGradeView) {
            global.AulaEntregas.openGradeView(ctx, _claseId, verBtn.dataset.pubId)
              .catch(err => {
                console.error('[AulaClase] openGradeView error:', err);
                toast('No se pudieron abrir las entregas de esta tarea', 'danger');
              });
          } else {
            console.warn('[AulaClase] AulaEntregas.openGradeView no disponible');
            toast('El modulo de entregas no esta disponible en este momento', 'danger');
          }
          return;
        }
        // Votar encuesta
        const voteBtn = e.target.closest('.aula-vote-btn');
        if (voteBtn) _handleVote(ctx, voteBtn.dataset.pubId, parseInt(voteBtn.dataset.option), voteBtn);
      };
      root?.addEventListener('click', _rootClickHandler);
      _boundRoot = root || null;

      // Tab lazy-load
      $id('aula-clase-tabs')?.addEventListener('shown.bs.tab', e => {
        const target = e.target.dataset.bsTarget;
        if (target === '#tab-clase-miembros') {
          _loadMiembros(ctx, clase);
          // Cargar sección de grupos
          const gruposEl = $id('aula-grupos-section');
          if (gruposEl && global.AulaGrupos?.render) {
            const canManageClase = global.SIA?.canManageAulaClase
              ? global.SIA.canManageAulaClase(ctx.profile, clase, ctx.auth.currentUser.uid)
              : (isDocente && clase.docenteId === ctx.auth.currentUser.uid);
            global.AulaGrupos.render(ctx, _claseId, gruposEl, isDocente, canManageClase);
          }
        }
        if (target === '#tab-clase-portfolio' && !isDocente) {
          if (global.AulaPortfolio?.render) global.AulaPortfolio.render(ctx, _claseId, ctx.auth.currentUser.uid);
        }
        if (target === '#tab-clase-calificaciones' && isDocente) {
          if (global.AulaEntregas?.renderGradeTable) global.AulaEntregas.renderGradeTable(ctx, _claseId);
        }
        if (target === '#tab-clase-analytics' && isDocente) {
          if (global.AulaAnalytics?.render) global.AulaAnalytics.render(ctx, _claseId);
        }
      });

      // Cargar stats del header de clase en background (solo docente)
      if (isDocente) _loadHeaderStats(ctx, clase);

      // Actualizar botones de feed cuando el estudiante entrega exitosamente
      _entregaSuccessHandler = e => {
        const pubId = e.detail?.pubId;
        if (!pubId) return;
        document.querySelectorAll(`.aula-entregar-btn[data-pub-id="${pubId}"]`).forEach(btn => {
          btn.innerHTML = '<i class="bi bi-eye me-1"></i>Ver entrega';
          btn.disabled = false;
          btn.style.background = '#198754';
        });
      };
      document.addEventListener('aula:entregaSuccess', _entregaSuccessHandler);

      // Toggle sección agregar co-docente
      $id('aula-toggle-codocente-section')?.addEventListener('click', () => {
        const form = $id('aula-codocente-form');
        if (form) form.style.display = form.style.display === 'none' ? '' : 'none';
      });

      // Agregar co-docente
      $id('aula-add-codocente-btn')?.addEventListener('click', async () => {
        const input = $id('aula-add-codocente-input');
        const id    = input?.value.trim();
        if (!id) return;
        try {
          await AulaService.addCoDocente(ctx, _claseId, id);
          toast('Co-docente agregado', 'success');
          input.value = '';
          $id('aula-codocente-form').style.display = 'none';
          AulaService.invalidateCache('miembros_');
          _loadMiembros(ctx, clase);
        } catch (err) {
          const msgs = {
            'USUARIO_NO_ENCONTRADO': 'No se encontró usuario con esa matrícula o email.',
            'YA_ES_MIEMBRO':        'Ya es miembro de esta clase.',
            'NO_ES_DOCENTE':        'El usuario no tiene rol de docente en el sistema.'
          };
          toast(msgs[err.message] || 'Error al agregar co-docente', 'warning');
        }
      });
      $id('aula-add-codocente-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') $id('aula-add-codocente-btn')?.click();
      });

      // Agregar miembro por matricula
      $id('aula-add-miembro-btn')?.addEventListener('click', async () => {
        const input = $id('aula-add-matricula');
        const mat = input?.value.trim();
        if (!mat) return;
        try {
          await AulaService.addMiembroByMatricula(ctx, _claseId, mat);
          toast('Miembro agregado', 'success');
          input.value = '';
          AulaService.invalidateCache('miembros_');
          _loadMiembros(ctx, clase);
        } catch (err) {
          const msgs = { 'USUARIO_NO_ENCONTRADO': 'No se encontro usuario con esa matricula.', 'YA_ES_MIEMBRO': 'Ya es miembro de esta clase.' };
          toast(msgs[err.message] || 'Error al agregar', 'warning');
        }
      });
      $id('aula-add-matricula')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') $id('aula-add-miembro-btn')?.click();
      });
    }

    // ══════════════════════════════════════════════════════════
    //  MIEMBROS
    // ══════════════════════════════════════════════════════════

    async function _loadMiembros(ctx, clase) {
      const list = $id('aula-miembros-list');
      if (!list) return;
      list.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
      try {
        const miembros = await AulaService.getMiembros(ctx, _claseId, 100);
        const canManageClase = global.SIA?.canManageAulaClase
          ? global.SIA.canManageAulaClase(ctx.profile, clase, ctx.auth.currentUser.uid)
          : (clase.docenteId === ctx.auth.currentUser.uid);
        const isDocente = _rolEnClase === 'docente';

        const docentes    = miembros.filter(m => m.rol === 'docente');
        const estudiantes = miembros.filter(m => m.rol !== 'docente');

        // ── Co-docentes ──
        const coDocentesList  = $id('aula-codocentes-list');
        const coDocentesItems = $id('aula-codocentes-items');
        if (coDocentesList && coDocentesItems) {
          if (docentes.length) {
            coDocentesList.style.display = '';
            coDocentesItems.innerHTML = docentes.map(m => {
              const esOwner = m.userId === clase.docenteId;
              return `
                <div class="list-group-item d-flex align-items-center gap-3 py-2 px-3">
                  <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white"
                       style="width:38px;height:38px;background:linear-gradient(135deg,#667eea,#764ba2);">
                    <i class="bi bi-person-fill-gear" style="font-size:.8rem;"></i>
                  </div>
                  <div class="flex-grow-1 min-width-0">
                    <div class="fw-semibold small text-truncate">${esc(m.userName)}</div>
                    <div class="text-muted small text-truncate">${esc(m.userEmail)}${m.matricula ? ' · ' + esc(m.matricula) : ''}</div>
                  </div>
                  ${esOwner ? '<span class="badge bg-primary-subtle text-primary rounded-pill small">Owner</span>'
                            : '<span class="badge bg-secondary-subtle text-secondary rounded-pill small">Co-docente</span>'}
                  ${canManageClase && !esOwner ? `
                    <button class="btn btn-sm btn-outline-danger rounded-pill aula-remove-miembro" data-miembro-id="${m.id}" title="Remover co-docente">
                      <i class="bi bi-x-lg"></i>
                    </button>` : ''}
                </div>`;
            }).join('');
          } else {
            coDocentesList.style.display = 'none';
          }
        }

        // ── Estudiantes ──
        const estudiantesLabel = $id('aula-estudiantes-label');
        if (estudiantesLabel) estudiantesLabel.style.display = estudiantes.length ? '' : 'none';

        if (!estudiantes.length) {
          list.innerHTML = '<div class="list-group-item text-muted small text-center py-3">No hay estudiantes aún.</div>';
        } else {
          list.innerHTML = estudiantes.map(m => `
            <div class="list-group-item d-flex align-items-center gap-3 py-2 px-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white"
                   style="width:38px;height:38px;background:linear-gradient(135deg,#22c55e,#15803d);">
                <i class="bi bi-person-fill" style="font-size:.8rem;"></i>
              </div>
              <div class="flex-grow-1 min-width-0">
                <div class="fw-semibold small text-truncate">${esc(m.userName)}</div>
                <div class="text-muted small text-truncate">${esc(m.userEmail)}${m.matricula ? ' · ' + esc(m.matricula) : ''}</div>
              </div>
              <span class="badge bg-success-subtle text-success rounded-pill small">Estudiante</span>
              ${isDocente ? `
                <button class="btn btn-sm btn-outline-danger rounded-pill aula-remove-miembro" data-miembro-id="${m.id}">
                  <i class="bi bi-x-lg"></i>
                </button>` : ''}
            </div>`).join('');
        }

        // Bind remover miembro
        document.querySelectorAll('.aula-remove-miembro').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar a este miembro de la clase?')) return;
            try {
              await AulaService.removeMiembro(ctx, btn.dataset.miembroId, _claseId);
              toast('Miembro eliminado', 'info');
              AulaService.invalidateCache('miembros_');
              _loadMiembros(ctx, clase);
            } catch (_) { toast('Error al eliminar', 'danger'); }
          });
        });
      } catch (err) {
        console.error('[AulaClase] loadMiembros error:', err);
        list.innerHTML = '<div class="list-group-item text-danger small py-3">Error al cargar miembros.</div>';
      }
    }

    // ══════════════════════════════════════════════════════════
    //  VOTOS
    // ══════════════════════════════════════════════════════════

    async function _handleVote(ctx, pubId, option, btn) {
      try {
        await AulaService.votar(ctx, pubId, option);
        AulaService.invalidateCache('votos_');
        toast('Voto registrado', 'success');
        const container = btn.closest('#aula-poll-container') || btn.closest('.aula-pub-card');
        container?.querySelectorAll('.aula-vote-btn').forEach(b => {
          b.disabled = true;
          b.classList.remove('btn-outline-secondary');
          b.classList.add(parseInt(b.dataset.option) === option ? 'btn-primary' : 'btn-light');
        });
      } catch (err) {
        console.error('[AulaClase] vote error:', err);
        toast('Error al votar', 'danger');
      }
    }

    // ══════════════════════════════════════════════════════════
    //  REACCIONES EN COMENTARIOS
    // ══════════════════════════════════════════════════════════

    /**
     * Carga las reacciones de todos los comentarios visibles y actualiza la UI.
     * @param {object} ctx
     * @param {Array<string>} comentarioIds
     */
    async function _loadAllReacciones(ctx, comentarioIds) {
      if (!comentarioIds.length) return;
      try {
        await Promise.all(comentarioIds.map(async cid => {
          try {
            const reacciones = await AulaService.getReacciones(ctx, cid);
            _renderReaccionesRow(cid, reacciones);
          } catch (_) {}
        }));
      } catch (_) {}
    }

    /**
     * Actualiza la fila de reacciones de un comentario en el DOM.
     * @param {string} comentarioId
     * @param {Array} reacciones - [{ emoji, count, miReaccion }]
     */
    function _renderReaccionesRow(comentarioId, reacciones) {
      const row = document.querySelector(`[data-reactions-for="${comentarioId}"]`);
      if (!row) return;
      // Construir map para acceso rápido
      const map = {};
      reacciones.forEach(r => { map[r.emoji] = r; });
      // Actualizar botones existentes
      row.querySelectorAll('.aula-emoji-btn').forEach(btn => {
        const emoji = btn.dataset.emoji;
        const r = map[emoji];
        if (r && r.count > 0) {
          btn.textContent = `${emoji} ${r.count}`;
          btn.style.opacity = '1';
          btn.classList.toggle('text-primary', r.miReaccion);
          btn.style.fontWeight = r.miReaccion ? '700' : '';
        } else {
          btn.textContent = emoji;
          btn.style.opacity = '.4';
          btn.classList.remove('text-primary');
          btn.style.fontWeight = '';
        }
      });
    }

    // ══════════════════════════════════════════════════════════
    //  STATS DEL HEADER (docente)
    // ══════════════════════════════════════════════════════════

    /**
     * Carga en background las stats de actividad de la clase para el header del docente.
     * @param {object} ctx
     * @param {object} clase
     */
    async function _loadHeaderStats(ctx, clase) {
      try {
        // Entregas pendientes de calificar
        const snapEntregas = await ctx.db.collection('aula-entregas')
          .where('claseId', '==', _claseId)
          .where('estado', 'in', ['entregado', 'tarde'])
          .limit(99)
          .get();

        const sinCalificar = snapEntregas.size;
        const elSinCal = $id('aula-stat-sin-calificar');
        const elSinCalNum = $id('aula-stat-sin-cal-num');
        if (elSinCalNum) elSinCalNum.textContent = sinCalificar;
        if (elSinCal && sinCalificar > 0) elSinCal.classList.remove('d-none');

        // Badge en tab Calificaciones
        _setTabBadge('aula-tab-badge-cal', sinCalificar, 'aula-tab-badge--danger');

        // Última publicación (usando el stream ya activo — tomamos del DOM)
        const primeraCard = document.querySelector('.aula-pub-card');
        if (primeraCard) {
          const elUltima = $id('aula-stat-ultima-pub');
          const elUltimaTxt = $id('aula-stat-ultima-pub-txt');
          const fechaEl = primeraCard.querySelector('.text-muted.small.ms-auto');
          if (elUltimaTxt && fechaEl) {
            elUltimaTxt.textContent = fechaEl.textContent.trim() || 'Reciente';
            if (elUltima) elUltima.classList.remove('d-none');
          }
        }
      } catch (err) {
        console.warn('[AulaClase] _loadHeaderStats error:', err);
      }
    }

    function _openClaseSettingsModal(ctx, clase) {
      if (!clase) return toast('Clase no encontrada', 'warning');

      const modalId = 'aula-clase-settings-modal';
      document.getElementById(modalId)?.remove();
      const formMarkup = global.AulaClassForm?.buildMarkup
        ? global.AulaClassForm.buildMarkup('settings')
        : '<div class="alert alert-warning mb-0">No se pudo cargar el formulario de clases.</div>';

      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div class="modal-content aula-class-modal-content rounded-4 border-0 shadow-lg">
              <div class="modal-header border-0 pb-0 px-4 pt-4">
                <div>
                  <div class="small text-muted fw-semibold">Configuracion de la clase</div>
                  <h5 class="modal-title fw-bold mb-0">Editar clase</h5>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <form id="aula-clase-settings-form" class="aula-class-modal-form">
                <div class="modal-body aula-class-modal-body px-4 pt-3 pb-2">
                  ${formMarkup}
                  <div class="border rounded-3 p-3 mt-4">
                    <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                      <div>
                        <label class="form-label small fw-semibold mb-1 d-block">Codigo de acceso</label>
                        <span class="form-control rounded-3 fw-semibold font-monospace" id="aula-clase-settings-code">${esc(clase.codigoAcceso || '')}</span>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3 flex-shrink-0" id="aula-clase-settings-regenerate">
                        <i class="bi bi-arrow-repeat me-1"></i>Regenerar
                      </button>
                    </div>
                  </div>
                </div>
                <div class="modal-footer aula-class-modal-footer border-0 px-4 pb-4 pt-2">
                  <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                  <button type="submit" class="btn btn-primary rounded-pill px-4 shadow-sm" id="aula-clase-settings-submit">
                    <i class="bi bi-check-lg me-1"></i>Guardar cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>`;

      document.body.appendChild(wrap.firstElementChild);
      const modalEl = document.getElementById(modalId);
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      const formController = global.AulaClassForm?.createController('settings') || null;
      let currentCode = clase.codigoAcceso || '';
      formController?.setData?.(clase);

      modalEl.querySelector('#aula-clase-settings-regenerate')?.addEventListener('click', async e => {
        const btn = e.currentTarget;
        if (btn.disabled) return;
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generando';
        try {
          const nuevoCodigo = await AulaService.generateJoinCode(ctx);
          await AulaService.updateClase(ctx, clase.id, { codigoAcceso: nuevoCodigo });
          currentCode = nuevoCodigo;
          _claseData = { ..._claseData, codigoAcceso: nuevoCodigo };
          modalEl.querySelector('#aula-clase-settings-code').textContent = nuevoCodigo;
          const codeLabel = $id('aula-code-label');
          if (codeLabel) codeLabel.textContent = nuevoCodigo;
          toast('Codigo regenerado', 'success');
        } catch (err) {
          console.error('[AulaClase] regenerateJoinCode error:', err);
          toast('No se pudo regenerar el codigo', 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });

      modalEl.querySelector('#aula-clase-settings-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const submitBtn = modalEl.querySelector('#aula-clase-settings-submit');
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando';

        try {
          const payload = formController?.getPayload ? formController.getPayload() : null;
          if (!payload) throw new Error('No se pudo preparar el formulario de la clase.');
          payload.codigoAcceso = currentCode;
          await AulaService.updateClase(ctx, clase.id, payload);
          _claseData = { ..._claseData, ...payload };
          modal.hide();
          toast('Clase actualizada', 'success');
          await init(ctx, _claseId);
        } catch (err) {
          console.error('[AulaClase] updateClase error:', err);
          toast(err?.message || 'No se pudo actualizar la clase', 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Guardar cambios';
        }
      });

      modalEl.addEventListener('hidden.bs.modal', () => {
        try { bootstrap.Modal.getInstance(modalEl)?.dispose(); } catch (_) {}
        modalEl.remove();
        _cleanupModalArtifacts();
      }, { once: true });

      modal.show();
    }

    // ══════════════════════════════════════════════════════════
    //  STATS DEL HEADER (estudiante)
    // ══════════════════════════════════════════════════════════

    /**
     * Carga en background el promedio y tareas pendientes del estudiante para el header.
     * @param {object} ctx
     */
    async function _loadStudentHeaderStats(ctx) {
      try {
        const uid = ctx.auth.currentUser.uid;
        // Promedio desde portfolio
        const { stats } = await AulaService.getPortfolioData(ctx, _claseId, uid);
        const elPromedio = $id('aula-stat-promedio-val');
        if (elPromedio) {
          elPromedio.textContent = stats.calificadas > 0 ? stats.promedio + ' pts' : '—';
        }

        // Contar tareas activas sin entrega
        const snap = await ctx.db.collection('aula-publicaciones')
          .where('claseId', '==', _claseId)
          .where('tipo', '==', 'tarea')
          .limit(30)
          .get();
        const ahora = new Date();
        let pendientes = 0;
        const checks = snap.docs.map(async d => {
          const data = d.data();
          if (data.grupoId && data.grupoId !== _miGrupo?.id) return;
          const fechaE = data.fechaEntrega?.toDate ? data.fechaEntrega.toDate() : (data.fechaEntrega ? new Date(data.fechaEntrega) : null);
          if (fechaE && fechaE < ahora) return; // ya vencida, no contar
          try {
            const e = await AulaService.getMiEntrega(ctx, d.id, uid);
            if (!e) pendientes++;
          } catch (_) {}
        });
        await Promise.all(checks);

        if (pendientes > 0) {
          const elPend = $id('aula-stat-pendientes-est');
          const elNum  = $id('aula-stat-pendientes-val');
          if (elNum) elNum.textContent = pendientes;
          if (elPend) elPend.classList.remove('d-none');
        }
      } catch (err) {
        console.warn('[AulaClase] _loadStudentHeaderStats error:', err);
      }
    }

    // ══════════════════════════════════════════════════════════
    //  BADGES EN TABS
    // ══════════════════════════════════════════════════════════

    /**
     * Carga en background los contadores de las tabs.
     * @param {object} ctx
     * @param {object} clase
     * @param {boolean} isDocente
     */
    function _setTabBadge(badgeOrId, count, variantClass) {
      const badge = typeof badgeOrId === 'string' ? $id(badgeOrId) : badgeOrId;
      if (!badge) return;
      badge.classList.remove(
        'aula-tab-badge--primary',
        'aula-tab-badge--neutral',
        'aula-tab-badge--danger',
        'aula-tab-badge--alert'
      );
      if (variantClass) badge.classList.add(variantClass);
      if (!count || count <= 0) {
        badge.textContent = '';
        badge.style.display = 'none';
        return;
      }
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'inline-flex';
    }

    async function _loadTabBadges(ctx, clase, isDocente) {
      try {
        // Badge miembros (siempre)
        const count = clase.miembrosCount || 0;
        _setTabBadge('aula-tab-badge-miembros', count, 'aula-tab-badge--neutral');

        if (isDocente) {
          // Badge tareas: contar entregas pendientes de calificar en las últimas 5 tareas
          const snapTareas = await ctx.db.collection('aula-publicaciones')
            .where('claseId', '==', _claseId)
            .where('tipo', '==', 'tarea')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

          const promises = snapTareas.docs.map(async d => {
            try {
              const snap = await ctx.db.collection('aula-entregas')
                .where('publicacionId', '==', d.id)
                .where('estado', 'in', ['entregado', 'tarde'])
                .limit(20).get();
              return snap.size;
            } catch (_) { return 0; }
          });
          const counts = await Promise.all(promises);
          const totalPendientes = counts.reduce((s, n) => s + n, 0);

          _setTabBadge('aula-tab-badge-tareas', totalPendientes, 'aula-tab-badge--alert');
        } else {
          // Estudiante: contar tareas activas pendientes de entregar
          const snapTareas = await ctx.db.collection('aula-publicaciones')
            .where('claseId', '==', _claseId)
            .where('tipo', '==', 'tarea')
            .limit(30).get();
          const ahora = new Date();
          const uid = ctx.auth.currentUser.uid;
          const promises = snapTareas.docs.map(async d => {
            const data = d.data();
            if (data.grupoId && data.grupoId !== _miGrupo?.id) return 0;
            const fechaE = data.fechaEntrega?.toDate ? data.fechaEntrega.toDate() : (data.fechaEntrega ? new Date(data.fechaEntrega) : null);
            if (fechaE && fechaE < ahora) return 0;
            try {
              const e = await AulaService.getMiEntrega(ctx, d.id, uid);
              return e ? 0 : 1;
            } catch (_) { return 0; }
          });
          const counts = await Promise.all(promises);
          const pendientes = counts.reduce((s, n) => s + n, 0);

          _setTabBadge('aula-tab-badge-tareas', pendientes, 'aula-tab-badge--primary');
        }
      } catch (err) {
        console.warn('[AulaClase] _loadTabBadges error:', err);
      }
    }

    // ══════════════════════════════════════════════════════════
    //  ESTADO ENTREGA EN CARDS (estudiante y docente)
    // ══════════════════════════════════════════════════════════

    /**
     * Llena los placeholders de estado de entrega del estudiante en las cards de tarea.
     * @param {object} ctx
     * @param {Array<string>} pubIds
     */
    async function _loadEntregaStatus(ctx, pubIds) {
      if (!pubIds.length) return;
      const uid = ctx.auth.currentUser.uid;
      try {
        await Promise.all(pubIds.map(async pubId => {
          try {
            const entrega = await AulaService.getMiEntrega(ctx, pubId, uid);
            const el = document.querySelector(`[data-entrega-status="${pubId}"]`);
            if (!el) return;
            if (entrega) {
              const yaCalificado = entrega.estado === 'calificado';
              const tieneRetro   = yaCalificado && entrega.retroalimentacion?.trim();
              let estadoBadge;
              if (yaCalificado && tieneRetro) {
                estadoBadge = `<span class="badge bg-success-subtle text-success rounded-pill small"><i class="bi bi-chat-left-check-fill me-1"></i>Calificada · ${entrega.calificacion} pts · Comentarios</span>`;
              } else if (yaCalificado) {
                estadoBadge = `<span class="badge bg-success-subtle text-success rounded-pill small"><i class="bi bi-check-circle-fill me-1"></i>Calificada — ${entrega.calificacion} pts</span>`;
              } else if (entrega.estado === 'tarde') {
                estadoBadge = `<span class="badge bg-warning-subtle text-warning rounded-pill small"><i class="bi bi-clock-history me-1"></i>Entregada (tarde)</span>`;
              } else {
                estadoBadge = `<span class="badge bg-info-subtle text-info rounded-pill small"><i class="bi bi-check-circle me-1"></i>Entregada ✓</span>`;
              }
              el.innerHTML = estadoBadge;
              // Actualizar botón entregar a "Modificar" o "Ver"
              const btn = document.querySelector(`.aula-entregar-btn[data-pub-id="${pubId}"]`);
              if (btn) {
                btn.innerHTML = yaCalificado
                  ? '<i class="bi bi-eye me-1"></i>Ver'
                  : '<i class="bi bi-pencil me-1"></i>Modificar';
                btn.style.background = yaCalificado ? '#198754' : '#6366f1';
              }
            }
          } catch (_) {}
        }));
      } catch (err) {
        console.warn('[AulaClase] _loadEntregaStatus error:', err);
      }
    }

    /**
     * Llena los placeholders de progreso de entregas en las cards de tarea del docente.
     * @param {object} ctx
     * @param {Array<object>} tareas
     * @param {object} clase
     */
    async function _loadEntregaProgreso(ctx, tareas, clase) {
      const total = clase?.miembrosCount || 0;
      if (!tareas.length) return;
      try {
        await Promise.all(tareas.map(async tarea => {
          try {
            const snap = await ctx.db.collection('aula-entregas')
              .where('publicacionId', '==', tarea.id)
              .limit(100).get();
            const count = snap.size;
            const el = document.querySelector(`[data-progreso-pub="${tarea.id}"]`);
            if (el && count > 0) {
              const objetivo = tarea.grupoId ? 1 : total;
              const label = tarea.grupoId ? 'grupo' : 'entregaron';
              el.innerHTML = `<i class="bi bi-people me-1"></i>${count}${objetivo ? '/' + objetivo : ''} ${label}`;
            }
          } catch (_) {}
        }));
      } catch (err) {
        console.warn('[AulaClase] _loadEntregaProgreso error:', err);
      }
    }

    return { init };
  })();

  global.AulaClase = AulaClase;
})(window);
