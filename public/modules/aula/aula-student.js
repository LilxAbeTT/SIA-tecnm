/* ============================================================
   Aula Student — Módulo para estudiantes
   ============================================================ */
(function (global) {
    const AulaStudent = (function () {

        let _ctx = null;
        let _unsubMembres = null;

        function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
        function $id(id) { return document.getElementById(id); }
        function toDate(value) {
            if (!value) return null;
            if (typeof value.toDate === 'function') return value.toDate();
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        function toast(msg, type) {
            if (global.SIA?.toast) return global.SIA.toast(msg, type);
            if (global.showToast) return global.showToast(msg, type);
        }
        const timeAgo = (dateStr) => {
            const date = toDate(dateStr);
            if (!date) return '';
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " años";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " meses";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " d";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " h";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " min";
            return "ahora";
        };

        async function init(ctx) {
            _ctx = ctx;
            if (!ctx?.profile) return;
            await _renderMainView(ctx);
        }

        async function _renderMainView(ctx) {
            if (_unsubMembres) { _unsubMembres(); _unsubMembres = null; }

            const root = $id('view-aula');
            if (!root) return;

            const nombre = (ctx.profile?.displayName || ctx.auth.currentUser?.displayName || 'usuario').split(' ')[0];
            const carrera = ctx.profile?.carrera || '';

            root.innerHTML = `
        <!-- ── Hero Banner ── -->
        <div class="aula-main-hero rounded-4 mb-3">
          <div class="p-4 p-md-5 pb-4">
            <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
              <div class="d-flex align-items-center gap-3">
                <div class="aula-hero-avatar">
                  <i class="bi bi-mortarboard-fill text-white fs-4"></i>
                </div>
                <div class="text-white">
                  <h4 class="fw-bold mb-0 filter-white">¡Hola, ${esc(nombre)}!</h4>
                  <p class="mb-0 small" style="opacity:0.72;">Estudiante · Tu espacio de aprendizaje</p>
                </div>
              </div>
              <button class="btn btn-white-glass rounded-pill px-3" id="aula-btn-unirse">
                <i class="bi bi-plus-lg me-1"></i>Unirse a Clase
              </button>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <div class="aula-stat-glass"><i class="bi bi-grid-3x3-gap me-1 opacity-75"></i><span id="aula-stat-clases">—</span> clases</div>
              ${carrera ? `<div class="aula-stat-glass"><i class="bi bi-mortarboard me-1 opacity-75"></i>${esc(carrera)}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- ── Nav bar (tabs + búsqueda) ── -->
        <div class="aula-nav-bar mb-4">
          <ul class="nav aula-header-tabs flex-nowrap" id="aula-main-tabs" role="tablist">
            <li class="nav-item">
              <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-aula-clases" role="tab">
                <i class="bi bi-grid-3x3-gap me-1"></i>Mis Clases
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-aula-comunidad" role="tab" id="aula-tab-comunidad">
                <i class="bi bi-globe me-1"></i>Comunidad
              </button>
            </li>
          </ul>
          <div class="aula-nav-search input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input type="text" id="aula-search" class="form-control" placeholder="Buscar clase...">
          </div>
        </div>

        <!-- ── Tab content ── -->
        <div class="tab-content">
          <div class="tab-pane fade show active" id="tab-aula-clases" role="tabpanel">
            <!-- Widget de próximas entregas -->
            <div id="aula-deadlines-widget"></div>
            <div id="aula-clases-grid" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4"></div>
            <div id="aula-clases-empty" class="text-center py-5 d-none">
              <div class="aula-empty-icon mx-auto mb-3">
                <i class="bi bi-easel2 fs-1 text-muted opacity-50"></i>
              </div>
              <p class="text-muted mb-3">Aun no estas inscrito en ninguna clase.</p>
              <button class="btn btn-primary rounded-pill px-4 shadow-sm" id="aula-empty-action">
                <i class="bi bi-plus-lg me-1"></i>Unirme a mi primera clase
              </button>
            </div>
          </div>
          
          <div class="tab-pane fade" id="tab-aula-comunidad" role="tabpanel">
             <div class="row gx-4">
               <div class="col-lg-8">
                 <div class="d-flex align-items-center justify-content-between mb-3">
                   <h5 class="fw-bold mb-0 text-dark">Tareas publicas de tu carrera</h5>
                   <button class="btn btn-sm btn-light rounded-pill" id="aula-refresh-comunidad"><i class="bi bi-arrow-clockwise me-1"></i>Refrescar</button>
                 </div>
                 <div id="aula-comunidad-feed" class="d-flex flex-column gap-3">
                   <div class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div></div>
                 </div>
               </div>
               <div class="col-lg-4 d-none d-lg-block">
                 <div class="card border-0 shadow-sm rounded-4">
                   <div class="card-body p-4">
                     <h6 class="fw-bold mb-3">Sobre la Comunidad</h6>
                     <p class="small text-muted mb-0">Aqui se muestran las tareas que los docentes marcaron como visibles para la comunidad de tu carrera, aunque no pertenezcan a tus clases.</p>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </div>

        ${_buildModalsHTML()}
      `;

            await _loadClases(ctx);
            _bindMainEvents(ctx);
            _startMembresStream(ctx);
            await _refreshStudentWidgets(ctx);

            $id('aula-tab-comunidad')?.addEventListener('shown.bs.tab', () => _loadComunidad(ctx));
        }

        async function _refreshStudentWidgets(ctx) {
            const uid = ctx.auth.currentUser.uid;
            global.AulaService?.invalidateCache('community_');
            global.AulaDeadlines?.invalidate(uid);

            const deadlinesEl = $id('aula-deadlines-widget');
            if (deadlinesEl && global.AulaDeadlines?.render) {
                if ($id('aula-clases-empty')?.classList.contains('d-none')) {
                    deadlinesEl.classList.remove('d-none');
                    await global.AulaDeadlines.render(ctx, deadlinesEl);
                } else {
                    deadlinesEl.classList.add('d-none');
                    deadlinesEl.innerHTML = '';
                }
            }

            const comunidadPane = $id('tab-aula-comunidad');
            if (comunidadPane?.classList.contains('show') && comunidadPane.classList.contains('active')) {
                await _loadComunidad(ctx);
            }
        }

        function _startMembresStream(ctx) {
            _unsubMembres = global.AulaService.streamMisClasesMembres(
                ctx, ctx.auth.currentUser.uid,
                async () => {
                    if (global.AulaService) global.AulaService.invalidateCache('clases_');
                    await _loadClases(ctx);
                    await _refreshStudentWidgets(ctx);
                }
            );
            if (ctx.activeUnsubs) ctx.activeUnsubs.push(_unsubMembres);
        }

        async function _loadComunidad(ctx) {
            const feed = $id('aula-comunidad-feed');
            if (!feed) return;
            try {
                feed.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div></div>';
                const carrera = String(ctx.profile?.carrera || ctx.profile?.career || '').trim().toUpperCase();
                if (!carrera) {
                    feed.innerHTML = '<div class="text-center py-5 text-muted small"><i class="bi bi-mortarboard fs-2 mb-2 d-block opacity-50"></i>Tu perfil no tiene carrera asignada, por eso no podemos cargar las tareas publicas.</div>';
                    return;
                }

                const [tareas, misClases] = await Promise.all([
                    global.AulaService.getCommunityTasks(ctx, carrera, 12),
                    global.AulaService.getMisClases(ctx, ctx.auth.currentUser.uid, 60).catch(() => [])
                ]);
                const misClasesIds = new Set((misClases || []).map(clase => clase.id));

                if (!tareas.length) {
                    feed.innerHTML = '<div class="text-center py-5 text-muted small"><i class="bi bi-inbox fs-2 mb-2 d-block opacity-50"></i>No hay tareas publicas disponibles para tu carrera por ahora.</div>';
                    return;
                }

                feed.innerHTML = tareas.map(p => {
                    // aviso y anuncio son semánticamente equivalentes en el sistema
                    const color = p.claseColor || '#6366f1';
                    const fechaEntrega = toDate(p.fechaEntrega);
                    const fechaEntregaTxt = fechaEntrega
                        ? fechaEntrega.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Sin fecha limite';
                    const esMiClase = misClasesIds.has(p.claseId);
                    return `
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
              <div class="card-body p-4">
                <div class="d-flex gap-3 mb-3">
                   <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:40px;height:40px;background:${color}18;color:${color};">
                     <i class="bi bi-file-earmark-text-fill"></i>
                   </div>
                   <div>
                     <h6 class="fw-bold mb-0">${esc(p.autorNombre || 'Docente')}</h6>
                     <div class="small text-muted d-flex align-items-center gap-2">
                       <span>${esc(p.claseTitulo || 'Clase')}</span> &bull; <span>${timeAgo(p.createdAt)}</span>
                     </div>
                   </div>
                </div>
                <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span class="badge rounded-pill small" style="background:${color}15;color:${color};border:1px solid ${color}30;">Tarea publica</span>
                  <span class="badge bg-info-subtle text-info rounded-pill small"><i class="bi bi-clock me-1"></i>${esc(fechaEntregaTxt)}</span>
                  <span class="badge bg-secondary-subtle text-secondary rounded-pill small"><i class="bi bi-mortarboard me-1"></i>${esc(carrera)}</span>
                </div>
                <h6 class="fw-bold text-dark mb-2">${esc(p.titulo || 'Tarea sin titulo')}</h6>
                ${p.contenido ? `<p class="text-muted small mb-0">${esc(p.contenido).substring(0, 150)}${p.contenido.length > 150 ? '...' : ''}</p>` : ''}
              </div>
              <div class="card-footer border-0 px-4 py-2 text-end" style="background:var(--aula-surface-muted,#f0f0ff);">
                ${esMiClase
                    ? `<button class="btn btn-link btn-sm text-decoration-none px-0" onclick="window.location.hash='/aula/clase/${p.claseId}'">Ir a la clase <i class="bi bi-arrow-right ms-1"></i></button>`
                    : '<span class="small text-muted">Visible para tu carrera</span>'}
              </div>
            </div>`;
                }).join('');
            } catch (err) {
                console.error(err);
                feed.innerHTML = '<div class="alert alert-danger small">Error cargando comunidad.</div>';
            }
        }

        async function _loadClases(ctx) {
            const grid = $id('aula-clases-grid');
            const empty = $id('aula-clases-empty');
            const deadlinesEl = $id('aula-deadlines-widget');
            if (!grid) return;
            if (!grid.children.length) {
                grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';
            }
            try {
                const clases = await global.AulaService.getMisClases(ctx, ctx.auth.currentUser.uid, 30);
                const statEl = $id('aula-stat-clases');
                if (statEl) statEl.textContent = clases.length;

                if (!clases.length) {
                    grid.innerHTML = '';
                    deadlinesEl?.classList.add('d-none');
                    empty?.classList.remove('d-none');
                    return;
                }
                deadlinesEl?.classList.remove('d-none');
                empty?.classList.add('d-none');
                grid.innerHTML = clases.map(c => _renderClaseCard(c, ctx)).join('');
            } catch (err) {
                console.error('[AulaStudent] loadClases error:', err);
                grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error al cargar clases.</div></div>';
            }
        }

        function _getClaseSubtitle(clase) {
            const parts = [];
            const titleNorm = String(clase?.titulo || '').trim().toLowerCase();
            const materiaNorm = String(clase?.materia || '').trim().toLowerCase();
            const derivedTitle = String(window.AulaClassForm?.buildDefaultTitle?.(clase?.materia || '', clase?.turno || '') || '').trim().toLowerCase();
            if (clase?.materia && titleNorm !== materiaNorm && titleNorm !== derivedTitle) parts.push(clase.materia);
            return parts.join(' · ');
        }

        function _getClaseCareerBadge(clase) {
            return clase?.carreraNombre || clase?.carrera || '';
        }

        function _getClaseSemesterBadge(clase) {
            return clase?.semestreLabel || clase?.semestre || '';
        }

        function _renderClaseCard(c, ctx) {
            const color = c.color || '#6366f1';
            const grad = `linear-gradient(135deg, ${color}ff 0%, ${color}bb 60%, ${color}77 100%)`;
            const subtitle = _getClaseSubtitle(c);
            const careerBadge = _getClaseCareerBadge(c);

            return `
        <div class="col">
          <div class="aula-clase-card rounded-4 overflow-hidden shadow-sm h-100" data-action="aula-open-clase" data-clase-id="${c.id}">
            <div class="aula-clase-card-banner" style="background:${grad}; min-height:115px; position:relative; overflow:hidden;">
              <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;pointer-events:none;"></div>
              <div class="d-flex justify-content-between align-items-start p-3">
                <div class="aula-clase-card-icon">
                  <i class="bi ${esc(c.icono || 'bi-book')} text-white fs-4"></i>
                </div>
              </div>
              <div class="px-3 pb-3">
                <h5 class="text-white fw-bold mb-0 text-truncate" title="${esc(c.titulo)}">${esc(c.titulo)}</h5>
                ${subtitle ? `<p class="text-white opacity-75 small mb-0 text-truncate">${esc(subtitle)}</p>` : ''}
              </div>
            </div>
            <div class="p-3 ">
              <div class="d-flex align-items-center gap-2 mb-2">
                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;background:${color}18;color:${color};">
                  <i class="bi bi-person-fill" style="font-size:0.75rem;"></i>
                </div>
                <span class="small text-muted text-truncate">${esc(c.docenteNombre || '')}</span>
              </div>
              <div class="d-flex flex-wrap gap-1 align-items-center">
                ${careerBadge ? `<span class="badge rounded-pill small" style="background:${color}15;color:${color};border:1px solid ${color}30;">${esc(careerBadge)}</span>` : ''}
                ${_getClaseSemesterBadge(c) ? `<span class="badge bg-secondary-subtle text-secondary rounded-pill small">${esc(_getClaseSemesterBadge(c))}</span>` : ''}
                ${c.turno ? `<span class="badge bg-light text-dark rounded-pill small border">${esc(c.turno)}</span>` : ''}
                <span class="ms-auto small text-muted"><i class="bi bi-people me-1"></i>${c.miembrosCount || 0}</span>
              </div>
              ${c.descripcion ? `<p class="text-muted small mt-2 mb-0" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:0.78rem;">${esc(c.descripcion)}</p>` : ''}
            </div>
          </div>
        </div>`;
        }

        function _buildModalsHTML() {
            return `
        <!-- Modal: Unirse -->
        <div class="modal fade" id="modalAulaUnirse" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content rounded-4 border-0 shadow-lg" style="overflow:hidden;">
              <div class="p-4" style="background:linear-gradient(135deg,#e0e7ff,#ede9fe);">
                <div class="d-flex justify-content-end">
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="text-center mb-3">
                  <div class="d-inline-flex align-items-center justify-content-center rounded-circle bg-white shadow-sm mb-3" style="width:64px;height:64px;">
                    <i class="bi bi-person-plus-fill fs-2 text-primary"></i>
                  </div>
                  <h4 class="fw-bold text-dark mb-1">Unirse a Clase</h4>
                  <p class="text-muted small mb-0">Pide a tu profesor el codigo de acceso (6 caracteres).</p>
                </div>
              </div>
              <form id="aula-unirse-form" class="p-4">
                <div class="mb-4">
                  <input type="text" id="aula-unirse-codigo" class="form-control form-control-lg text-center fw-bold fs-3 tracking-widest bg-light" placeholder="A1B2C3" required maxlength="6" style="letter-spacing:0.5rem; text-transform:uppercase;">
                  <div id="aula-unirse-error" class="text-danger small text-center mt-2 d-none fw-semibold"><i class="bi bi-exclamation-circle me-1"></i>Codigo inválido o clase no encontrada.</div>
                </div>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-light rounded-pill flex-grow-1" data-bs-dismiss="modal">Cancelar</button>
                  <button type="submit" class="btn btn-primary rounded-pill flex-grow-1 shadow-sm" id="aula-unirse-submit">Unirme</button>
                </div>
              </form>
            </div>
          </div>
        </div>`;
        }

        function _bindMainEvents(ctx) {
            $id('aula-clases-grid')?.addEventListener('click', e => {
                const card = e.target.closest('[data-action="aula-open-clase"]');
                if (card?.dataset.claseId) _navigateToClase(card.dataset.claseId);
            });

            $id('aula-btn-unirse')?.addEventListener('click', () => {
                _resetJoinModal();
                bootstrap.Modal.getOrCreateInstance($id('modalAulaUnirse')).show();
            });
            $id('aula-empty-action')?.addEventListener('click', () => $id('aula-btn-unirse')?.click());

            $id('aula-unirse-form')?.addEventListener('submit', async e => {
                e.preventDefault();
                const input = $id('aula-unirse-codigo');
                const code = input.value.trim().toUpperCase();
                if (code.length < 6) return;

                const btn = $id('aula-unirse-submit');
                const errEl = $id('aula-unirse-error');
                btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                errEl.classList.add('d-none');

                try {
                    await global.AulaService.joinClase(ctx, code);
                    bootstrap.Modal.getInstance($id('modalAulaUnirse'))?.hide();
                    toast('¡Te has unido a la clase exitosamente!', 'success');
                    global.AulaService.invalidateCache('clases_');
                    await _loadClases(ctx);
                    await _refreshStudentWidgets(ctx);
                } catch (err) {
                    console.error(err);
                    const msg = err.message === 'YA_ES_MIEMBRO'
                        ? 'Ya eres miembro de esta clase.'
                        : 'Código inválido o clase no encontrada.';
                    errEl.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>${msg}`;
                    errEl.classList.remove('d-none');
                } finally {
                    btn.disabled = false; btn.textContent = 'Unirme';
                }
            });

            $id('aula-refresh-comunidad')?.addEventListener('click', async e => {
                const btn = e.currentTarget;
                const original = btn?.innerHTML;
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Refrescando';
                }
                global.AulaService?.invalidateCache('community_');
                try {
                    await _loadComunidad(ctx);
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = original || '<i class="bi bi-arrow-clockwise me-1"></i>Refrescar';
                    }
                }
            });

            $id('aula-search')?.addEventListener('input', e => {
                const term = e.target.value.toLowerCase().trim();
                $id('aula-clases-grid')?.querySelectorAll('.col').forEach(col => {
                    col.style.display = col.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            });
        }

        function _resetJoinModal() {
            const input = $id('aula-unirse-codigo');
            if (input) input.value = '';
            const errEl = $id('aula-unirse-error');
            if (errEl) {
                errEl.innerHTML = '<i class="bi bi-exclamation-circle me-1"></i>Código inválido o clase no encontrada.';
                errEl.classList.add('d-none');
            }
            if (input) setTimeout(() => input.focus(), 500);
        }

        function _navigateToClase(claseId) { window.location.hash = `/aula/clase/${claseId}`; }

        // Make _loadComunidad available globally for the "Refresh" button onclick
        return { init, _loadComunidad };
    })();

    global.AulaStudent = AulaStudent;
})(window);
