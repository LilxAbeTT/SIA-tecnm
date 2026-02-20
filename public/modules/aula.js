/* ============================================================
   Aula — Modulo principal · Vista Catalogo + Admin
   Mobile-first · Bootstrap 5 · Dark-mode compatible
   Modulos > Lecciones · Gamificacion basica
   ============================================================ */
(function (global) {
  const AulaModule = (function () {

    const CURS = 'aula-cursos';
    const INSC = 'aula-inscripciones';
    const PROG = 'aula-progress';
    const CERT = 'aula-certificados';

    let _ctx = null;
    let _studentState = null;
    let _adminCourseCache = [];

    // ── Helpers ──
    function esc(str) {
      return String(str || '').replace(/[&<>"']/g, ch => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return map[ch] || ch;
      });
    }
    function trunc(str, max) { const s = String(str || '').trim(); return s.length <= max ? s : s.slice(0, max - 1) + '\u2026'; }
    function $id(id) { return document.getElementById(id); }
    function wireOnce(id, type, handler) {
      const el = $id(id); if (!el || el.dataset.wired) return el;
      el.addEventListener(type, handler); el.dataset.wired = '1'; return el;
    }

    // ══════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════
    function _injectTemplate() {
      const root = $id('view-aula');
      if (!root) {
        console.warn('[Aula] Root element #view-aula not found');
        return;
      }

      const existing = $id('aula-student');
      if (existing) {
        // Template already injected - check if it's the correct one
        const hasTemplateMarker = root.hasAttribute('data-aula-injected');
        if (hasTemplateMarker) {
          console.log('[Aula] Template already injected');
          return;
        }
        // Wrong structure detected - force re-inject
        console.warn('[Aula] Detected old template structure - re-injecting...');
      }

      console.log('[Aula] Injecting UI Template...');
      root.innerHTML = ''; // Force clear
      root.setAttribute('data-aula-injected', 'true'); // Mark as injected
      root.innerHTML = `
        <!-- STUDENT VIEW -->
        <div id="aula-student" class="d-block">
          <div class="row mb-4 align-items-center">
             <div class="col">
               <h2 class="fw-bold mb-0">Aula Virtual</h2>
               <p class="text-muted small">Tus cursos y progreso</p>
             </div>
             <div class="col-auto d-flex gap-2">
               <div id="aula-streak-pill" class="d-none badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-3 d-flex align-items-center gap-2">
                 <i class="bi bi-fire"></i> <span id="aula-streak-count">0</span>
               </div>
               <div id="aula-badges-pill" class="d-none badge bg-info-subtle text-info border border-info-subtle rounded-pill px-3 d-flex align-items-center gap-2" role="button" data-action="aula-show-badges">
                 <i class="bi bi-award-fill"></i> <span id="aula-badges-count">0</span>
               </div>
             </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-md-6">
               <div class="input-group">
                 <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search"></i></span>
                 <input type="text" id="aula-search-input" class="form-control border-start-0 ps-0" placeholder="Buscar cursos...">
               </div>
            </div>
            <div class="col-md-3">
               <select id="aula-filter-level" class="form-select">
                 <option value="all">Todos los niveles</option>
                 <option value="General">General</option>
                 <option value="Principiante">Principiante</option>
                 <option value="Intermedio">Intermedio</option>
                 <option value="Avanzado">Avanzado</option>
               </select>
            </div>
          </div>

          <div id="aula-filter-tags" class="d-flex flex-wrap gap-2 mb-4"></div>
          <div id="aula-student-hero" class="mb-5 d-none"></div>

          <ul class="nav nav-pills mb-4" role="tablist">
            <li class="nav-item"><button class="nav-link active rounded-pill px-4" id="tab-aula-mis-cursos-btn" data-bs-toggle="pill" data-bs-target="#tab-aula-mis-cursos">En Progreso</button></li>
            <li class="nav-item"><button class="nav-link rounded-pill px-4" data-bs-toggle="pill" data-bs-target="#tab-aula-explorar">Explorar</button></li>
            <li class="nav-item"><button class="nav-link rounded-pill px-4" id="tab-aula-logros-btn" data-bs-toggle="pill" data-bs-target="#tab-aula-logros">Logros</button></li>
            <li class="nav-item"><button class="nav-link rounded-pill px-4" data-bs-toggle="pill" data-bs-target="#tab-aula-completados">Completados</button></li>
          </ul>

          <div class="tab-content">
            <div class="tab-pane fade show active" id="tab-aula-mis-cursos">
               <div id="aula-student-inprogress" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4"></div>
               <div id="aula-empty-inprogress" class="text-center py-5 text-muted d-none"><i class="bi bi-journal-x mb-2 fs-1 opacity-50"></i><p>No tienes cursos en curso.</p></div>
            </div>
            <div class="tab-pane fade" id="tab-aula-explorar">
               <div id="aula-student-recommended" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4"></div>
               <div id="aula-empty-recommended" class="text-center py-5 text-muted d-none"><p>No hay cursos nuevos.</p></div>
            </div>
            <div class="tab-pane fade" id="tab-aula-logros">
               <div id="aula-stats-bar" class="d-flex gap-3 mb-4 justify-content-center"></div>
               <div id="aula-badges-grid" class="d-flex flex-wrap gap-3 justify-content-center"></div>
               <div id="aula-badges-empty" class="text-center py-5 text-muted d-none"><p>Aún no has desbloqueado insignias.</p></div>
            </div>
            <div class="tab-pane fade" id="tab-aula-completados">
               <div class="bg-success-subtle text-success p-4 rounded-4 text-center mb-4"><h1 class="display-3 fw-bold mb-0" id="aula-cert-count-big">0</h1><p class="mb-0 fw-medium">Certificaciones</p><div class="d-none" id="aula-total-certs"></div></div>
               <div id="aula-student-completed" class="list-group list-group-flush rounded-4 overflow-hidden border"></div>
               <div id="aula-empty-completed" class="text-center py-5 text-muted d-none"><p>Sin completados.</p></div>
            </div>
          </div>
        </div>

        <!-- ADMIN VIEW -->
        <div id="aula-admin" class="d-none">
          <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="fw-bold">Gestión de Aula</h3>
            <button class="btn btn-primary rounded-pill shadow-sm" id="btn-quick-create-course"><i class="bi bi-plus-lg me-1"></i>Nuevo Curso</button>
          </div>
          <div class="row g-4 mb-4">
             <div class="col-md-4"><div class="card border-0 shadow-sm p-3 text-center h-100"><h2 class="fw-bold text-primary mb-0" id="kpi-total-alumnos">0</h2><small class="text-muted">Total Alumnos</small></div></div>
             <div class="col-md-4"><div class="card border-0 shadow-sm p-3 text-center h-100"><h2 class="fw-bold text-success mb-0" id="kpi-tasa-finalizacion">0%</h2><small class="text-muted">Tasa Finalización</small></div></div>
             <div class="col-md-4"><div class="card border-0 shadow-sm p-3 text-center h-100"><h2 class="fw-bold text-info mb-0" id="kpi-promedio-general">0%</h2><small class="text-muted">Promedio General</small></div></div>
          </div>
          <div class="row g-4">
            <div class="col-lg-8">
               <div class="card border-0 shadow-sm rounded-4 h-100">
                 <div class="card-header bg-white py-3 fw-bold">Mis Cursos</div>
                 <div class="card-body p-3"><div id="aula-adm-cursos"></div></div>
               </div>
            </div>
            <div class="col-lg-4">
               <div class="card border-0 shadow-sm rounded-4 h-100">
                 <div class="card-header bg-white py-3 fw-bold d-flex justify-content-between align-items-center"><span>Avisos</span><button class="btn btn-sm btn-light border py-0 px-2" id="btn-quick-aviso">+</button></div>
                 <div class="card-body p-0"><div id="aula-adm-avisos-list" class="list-group list-group-flush"></div></div>
                 <div class="card-footer bg-white border-top-0">
                    <div class="input-group input-group-sm">
                       <input class="form-control" id="aula-adm-aviso-input" placeholder="Aviso rápido...">
                       <button class="btn btn-outline-secondary" type="submit" form="aula-adm-avisos-form">Enviar</button>
                    </div>
                     <form id="aula-adm-avisos-form"></form>
                 </div>
               </div>
            </div>
          </div>
          <div class="card border-0 shadow-sm rounded-4 mt-4">
              <div class="card-header bg-white py-3 fw-bold">Reportes</div>
              <div class="card-body">
                 <form id="aula-admin-report-form" class="row g-3 align-items-end">
                     <div class="col-md-4"><label class="form-label small">Tipo</label><select id="report-type-select" class="form-select"><option value="calificaciones_curso">Calificaciones por Curso</option><option value="progreso_general">Progreso General</option></select></div>
                     <div class="col-md-5" id="report-curso-select-group"><label class="form-label small">Curso</label><select id="report-curso-select" class="form-select"></select></div>
                     <div class="col-md-3"><button type="submit" class="btn btn-outline-primary w-100"><i class="bi bi-download me-1"></i> Descargar CSV</button></div>
                 </form>
              </div>
          </div>
        </div>

        <!-- SUPERADMIN VIEW -->
        <div id="aula-superadmin" class="d-none">
          <div class="alert alert-info">Panel de Superadmin de Aula</div>
          <div id="aula-sa-list"></div>
        </div>
      `;
    }

    // ══════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════
    function init(ctx) {
      console.log('[Aula] init called', ctx);

      // [FIX] Ensure HTML Structure exists
      _injectTemplate();

      const profile = ctx?.profile || ctx?.currentUserProfile;
      console.log('[Aula] Profile:', profile);

      if (!ctx || !profile) {
        console.warn('[Aula] Missing context or profile', { ctx, profile });
        return;
      }
      _ctx = ctx;
      _ctx.profile = profile;
      const role = profile.role;
      console.log('[Aula] Role:', role);

      if (role === 'docente' || role === 'superadmin' || role === 'admin' || role === 'aula_admin' || role === 'aula') {
        console.log('[Aula] Initializing Admin View');
        initAdmin(ctx);
      } else {
        console.log('[Aula] Initializing Student View');
        initStudent(ctx).then(() => console.log('[Aula] initStudent finished'))
          .catch(e => console.error('[Aula] initStudent failed', e));
      }
    }

    // ══════════════════════════════════════════════════════════
    //  ESTUDIANTE
    // ══════════════════════════════════════════════════════════
    async function initStudent(ctx) {
      console.log('[Aula] initStudent started. CTX:', ctx);
      _ctx = ctx;
      const uid = ctx.auth.currentUser?.uid;
      const root = $id('view-aula');

      console.log('[Aula] Root element:', root, 'Classes:', root?.className);

      if (!uid || !root) {
        console.error('[Aula] initStudent aborted. UID or Root missing.', { uid, root });
        return;
      }

      const stuEl = $id('aula-student');
      const admEl = $id('aula-admin');
      const saEl = $id('aula-superadmin');

      console.log('[Aula] DOM Elements:', { stuEl, admEl, saEl });

      if (stuEl) {
        stuEl.className = 'd-block'; // FORCE RESET CLASSES
        stuEl.style.display = 'block'; // FORCE INLINE STYLE
      }
      if (admEl) admEl.classList.add('d-none');
      if (saEl) saEl.classList.add('d-none');

      const db = ctx.db;
      console.log('[Aula] Fetching data for UID:', uid);

      try {
        const [cursosSnap, inscSnap, progSnap, certSnap, badges] = await Promise.all([
          db.collection(CURS).where('publicado', '==', true).get(),
          db.collection(INSC).where('studentId', '==', uid).get(),
          db.collection(PROG).where('uid', '==', uid).get(),
          db.collection(CERT).where('uid', '==', uid).get(),
          AulaService.getUserBadges(ctx, uid)
        ]);

        console.log('[Aula] Data fetched.', {
          cursos: cursosSnap.size,
          inscripciones: inscSnap.size,
          progreso: progSnap.size,
          certificados: certSnap.size,
          badges: badges.length
        });

        const inscMap = new Map(inscSnap.docs.map(d => [d.data().cursoId, d.id]));
        const progMap = new Map(progSnap.docs.map(d => [d.data().cursoId, d.data()]));
        const certMap = new Map(certSnap.docs.map(d => [d.data().cursoId, d.data()]));

        let bestStreak = 0;
        progSnap.docs.forEach(d => {
          const s = d.data().streak;
          if (s && s.current > bestStreak) bestStreak = s.current;
        });

        const recommended = [], inProgress = [], completed = [];
        const allTags = new Set();

        cursosSnap.forEach(doc => {
          const c = doc.data(), cid = doc.id;
          const publico = c.publico || 'todos';
          if (publico !== 'todos' && publico !== 'estudiantes') return;
          if (Array.isArray(c.tags)) c.tags.forEach(t => allTags.add(t.toLowerCase()));

          const enrollmentId = inscMap.get(cid);
          const progData = progMap.get(cid);
          const certData = certMap.get(cid);
          const progressPct = progData?.progressPct ?? 0;

          const vm = {
            id: cid,
            title: c.titulo || '(Sin titulo)',
            description: c.descripcion || '',
            hours: c.duracionHoras || c.horas || null,
            level: c.nivel || 'General',
            tags: Array.isArray(c.tags) ? c.tags : [],
            imagen: c.imagen || '',
            progressPct,
            isEnrolled: !!enrollmentId,
            isCompleted: !!certData,
            certificateFolio: certData ? (certData.folio || certData.id) : null,
            enrollmentId,
            score: certData?.score ?? null
          };

          if (certData) completed.push(vm);
          else if (enrollmentId) inProgress.push(vm);
          else recommended.push(vm);
        });

        console.log('[Aula] Processed Courses:', {
          recommended: recommended.length,
          inProgress: inProgress.length,
          completed: completed.length
        });

        _studentState = { recommended, inProgress, completed, badges, allTags: Array.from(allTags), bestStreak };
        renderStudentGamification(_studentState);
        renderStudentTabs(_studentState);
        bindStudentEvents();

      } catch (err) {
        console.error('[Aula] Error fetching data:', err);
      }
    }

    // ── Gamification header ──
    function renderStudentGamification(state) {
      const streakPill = $id('aula-streak-pill');
      const streakCount = $id('aula-streak-count');
      if (streakPill && state.bestStreak > 0) {
        streakPill.classList.remove('d-none');
        if (streakCount) streakCount.textContent = state.bestStreak;
      } else if (streakPill) { streakPill.classList.add('d-none'); }

      const badgesPill = $id('aula-badges-pill');
      const badgesCount = $id('aula-badges-count');
      if (badgesPill && state.badges.length > 0) {
        badgesPill.classList.remove('d-none');
        if (badgesCount) badgesCount.textContent = state.badges.length;
      } else if (badgesPill) { badgesPill.classList.add('d-none'); }

      const statsEl = $id('aula-stats-bar');
      if (statsEl) {
        statsEl.innerHTML = `
          <span class="d-flex align-items-center gap-1 border rounded-pill px-2 py-1 shadow-sm small">
            <i class="bi bi-book-half text-primary"></i><strong>${state.inProgress.length}</strong> Activos
          </span>
          <span class="d-flex align-items-center gap-1 border rounded-pill px-2 py-1 shadow-sm small">
            <i class="bi bi-trophy-fill text-success"></i><strong>${state.completed.length}</strong> Logros
          </span>`;
      }

      renderBadgesGrid(state.badges);
      renderTagsFilter(state.allTags);
    }

    function renderBadgesGrid(userBadges) {
      const grid = $id('aula-badges-grid');
      const empty = $id('aula-badges-empty');
      if (!grid) return;
      const defs = AulaService.getBadgeDefs();
      const userTypes = new Set(userBadges.map(b => b.type));
      grid.innerHTML = defs.map(def => {
        const unlocked = userTypes.has(def.type);
        const cls = unlocked ? '' : 'aula-badge-locked';
        return `<div class="aula-badge-item ${cls}" style="border-color:${def.color};color:${def.color};background:${def.color}10;" title="${def.label}${unlocked ? ' (Desbloqueado)' : ' (Bloqueado)'}"><i class="bi ${def.icon}"></i></div>`;
      }).join('');
      if (empty) empty.classList.toggle('d-none', defs.length > 0);
    }

    function renderTagsFilter(allTags) {
      const container = $id('aula-filter-tags');
      if (!container || !allTags.length) return;
      container.innerHTML = allTags.slice(0, 8).map(t =>
        `<button class="aula-tag-pill border-0" data-action="aula-filter-tag" data-tag="${esc(t)}" style="cursor:pointer">${esc(t)}</button>`
      ).join('');
    }

    // ── Tabs render ──
    function renderStudentTabs(state) {
      const heroEl = $id('aula-student-hero');
      if (state.inProgress.length > 0 && heroEl) {
        heroEl.innerHTML = renderHero(state.inProgress[0]);
        heroEl.classList.remove('d-none');
      } else if (heroEl) { heroEl.classList.add('d-none'); }

      const ipGrid = $id('aula-student-inprogress');
      const ipEmpty = $id('aula-empty-inprogress');
      const others = state.inProgress.slice(state.inProgress.length > 0 ? 1 : 0);
      if (ipGrid) {
        ipGrid.innerHTML = others.map(c => renderCard(c, 'inprogress')).join('');
        ipEmpty?.classList.toggle('d-none', others.length > 0 || state.inProgress.length > 0);
      }

      const recGrid = $id('aula-student-recommended');
      const recEmpty = $id('aula-empty-recommended');
      if (recGrid) {
        recGrid.innerHTML = state.recommended.map(c => renderCard(c, 'recommended')).join('');
        recEmpty?.classList.toggle('d-none', state.recommended.length > 0);
      }

      const compList = $id('aula-student-completed');
      const compEmpty = $id('aula-empty-completed');
      const certBadge = $id('aula-total-certs');
      const certBig = $id('aula-cert-count-big');
      if (certBadge) certBadge.textContent = state.completed.length;
      if (certBig) certBig.textContent = state.completed.length;
      if (compList) {
        compList.innerHTML = state.completed.map(renderCompletedRow).join('');
        compEmpty?.classList.toggle('d-none', state.completed.length > 0);
      }
    }

    function renderHero(c) {
      const pct = Math.round(c.progressPct || 0);
      const label = pct >= 100 ? 'Realizar Quiz' : 'Continuar';
      const badge = pct >= 100 ? 'Examen Pendiente' : 'En Curso';
      const tags = c.tags.slice(0, 3).map(t => `<span class="aula-tag-pill" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.25);">${esc(t)}</span>`).join(' ');
      return `
        <div class="aula-hero-card position-relative">
          <div class="position-relative" style="z-index:1;">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <span class="badge bg-white bg-opacity-25 border border-white border-opacity-25 small">${badge}</span>
              ${tags}
            </div>
            <h3 class="fw-bold mb-1" style="font-size:clamp(1.2rem,4vw,1.8rem)">${esc(c.title)}</h3>
            <p class="text-white-50 mb-3 small text-truncate">${esc(c.description)}</p>
            <div class="d-flex flex-wrap align-items-center gap-3">
              <button class="btn aula-hero-btn btn-sm rounded-pill px-4 fw-bold shadow-sm" data-action="aula-open-course" data-course-id="${c.id}">
                <i class="bi bi-play-circle-fill me-1"></i> ${label}
              </button>
              <div class="flex-grow-1" style="max-width:200px;min-width:100px;">
                <div class="d-flex justify-content-between small text-white-50 mb-1"><span>Avance</span><span>${pct}%</span></div>
                <div class="progress bg-black bg-opacity-25 rounded-pill" style="height:6px;"><div class="progress-bar bg-warning rounded-pill" style="width:${pct}%"></div></div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function renderCard(c, mode) {
      const pct = Math.round(c.progressPct || 0);
      let btn = '', statusIcon = '';
      if (mode === 'recommended') {
        statusIcon = '<i class="bi bi-plus-circle text-primary"></i>';
        btn = `<button class="btn btn-sm btn-outline-primary w-100 rounded-pill fw-bold" data-action="aula-enroll" data-course-id="${c.id}" data-course-title="${esc(c.title)}">Inscribirme</button>`;
      } else {
        statusIcon = '<i class="bi bi-play-circle text-info"></i>';
        btn = `<button class="btn btn-sm btn-primary w-100 rounded-pill fw-bold" data-action="aula-open-course" data-course-id="${c.id}">Continuar</button>`;
      }
      const tags = c.tags.slice(0, 2).map(t => `<span class="aula-tag-pill">${esc(t)}</span>`).join(' ');
      const progress = mode !== 'recommended'
        ? `<div class="mt-2"><div class="d-flex justify-content-between small text-muted mb-1"><span>Avance</span><span>${pct}%</span></div><div class="progress rounded-pill" style="height:4px;"><div class="progress-bar rounded-pill" style="width:${pct}%"></div></div></div>`
        : `<div class="mt-2 small text-muted"><i class="bi bi-clock me-1"></i>${c.hours ? c.hours + 'h' : 'Variable'}${c.level !== 'General' ? ' <span class="badge bg-light text-dark border ms-1">' + esc(c.level) + '</span>' : ''}</div>`;
      return `
        <div class="col">
          <div class="card h-100 shadow-sm aula-course-card border-0 rounded-4 p-3 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="bg-primary-subtle text-primary rounded-3 p-2 d-inline-flex"><i class="bi bi-journal-text fs-5"></i></div>
              ${statusIcon}
            </div>
            <h6 class="fw-bold text-truncate mb-1" title="${esc(c.title)}">${esc(c.title)}</h6>
            <p class="text-muted small mb-1 flex-grow-1" style="line-height:1.4;">${esc(trunc(c.description, 70))}</p>
            <div class="d-flex gap-1 flex-wrap mb-1">${tags}</div>
            ${progress}
            <div class="mt-2 pt-2 border-top">${btn}</div>
          </div>
        </div>`;
    }

    function renderCompletedRow(c) {
      const safeTitle = esc(c.title).replace(/'/g, "\\'");
      return `
        <div class="list-group-item p-3 d-flex flex-column flex-sm-row align-items-center gap-3 border-0 border-bottom">
          <div class="bg-success-subtle text-success p-2 rounded-circle d-flex align-items-center justify-content-center" style="width:44px;height:44px;"><i class="bi bi-check-lg fs-5"></i></div>
          <div class="flex-grow-1 text-center text-sm-start">
            <h6 class="mb-0 fw-bold small">${esc(c.title)}</h6>
            <div class="small text-muted">
              <span class="me-2"><i class="bi bi-star-fill text-warning me-1"></i>${c.score || 'N/A'}%</span>
              <span><i class="bi bi-upc-scan me-1"></i>${c.certificateFolio || '---'}</span>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-success rounded-pill px-3" data-action="aula-ver-constancia" data-course-id="${c.id}" data-course-title="${safeTitle}">
            <i class="bi bi-file-earmark-pdf-fill me-1"></i>Descargar
          </button>
        </div>`;
    }

    // ── Student events ──
    function bindStudentEvents() {
      const home = $id('aula-student-home');
      const hero = $id('aula-student-hero');
      [home, hero].forEach(container => {
        if (!container || container.dataset.wired) return;
        container.dataset.wired = '1';
        container.addEventListener('click', handleStudentClick);
      });

      const searchInput = $id('aula-search-input');
      if (searchInput && !searchInput.dataset.wired) {
        searchInput.dataset.wired = '1';
        searchInput.addEventListener('input', filterExplore);
      }
      const levelFilter = $id('aula-filter-level');
      if (levelFilter && !levelFilter.dataset.wired) {
        levelFilter.dataset.wired = '1';
        levelFilter.addEventListener('change', filterExplore);
      }
      const tagsContainer = $id('aula-filter-tags');
      if (tagsContainer && !tagsContainer.dataset.wired) {
        tagsContainer.dataset.wired = '1';
        tagsContainer.addEventListener('click', e => {
          const btn = e.target.closest('[data-action="aula-filter-tag"]');
          if (!btn) return;
          btn.classList.toggle('active');
          btn.style.background = btn.classList.contains('active') ? 'var(--aula)' : '';
          btn.style.color = btn.classList.contains('active') ? '#fff' : '';
          filterExplore();
        });
      }
    }

    function filterExplore() {
      if (!_studentState) return;
      const term = ($id('aula-search-input')?.value || '').toLowerCase().trim();
      const level = $id('aula-filter-level')?.value || 'all';
      const activeTags = [];
      $id('aula-filter-tags')?.querySelectorAll('.active').forEach(b => activeTags.push(b.dataset.tag));

      const filter = c => {
        if (term && !c.title.toLowerCase().includes(term) && !c.description.toLowerCase().includes(term)) return false;
        if (level !== 'all' && c.level !== level) return false;
        if (activeTags.length && !activeTags.some(t => c.tags.map(x => x.toLowerCase()).includes(t))) return false;
        return true;
      };
      const filtered = { recommended: _studentState.recommended.filter(filter), inProgress: _studentState.inProgress, completed: _studentState.completed };
      renderStudentTabs(filtered);
    }

    function handleStudentClick(ev) {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      ev.preventDefault();
      const action = btn.dataset.action;
      const courseId = btn.dataset.courseId;
      if (action === 'aula-enroll' && courseId) inscribirse(courseId, btn.dataset.courseTitle || '');
      else if (action === 'aula-open-course' && courseId) openCourseFromStudent(courseId);
      else if (action === 'aula-ver-constancia' && courseId) verConstancia(courseId, btn.dataset.courseTitle || '');
      else if (action === 'aula-show-badges') { const tab = $id('tab-aula-logros-btn'); if (tab) new bootstrap.Tab(tab).show(); }
    }

    function openCourseFromStudent(courseId) {
      if (!_ctx || !courseId) return;
      if (typeof global.SIA_navToCourse === 'function') { global.SIA_navToCourse(courseId); return; }
      if (global.AulaContent) {
        global.AulaContent.initCourse(_ctx, courseId);
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('d-none'));
        $id('view-aula-course')?.classList.remove('d-none');
      }
    }

    // ── Inscripcion ──
    async function inscribirse(cursoId, cursoTitulo) {
      if (_ctx.profile?.role !== 'student') { showToast('Los administradores no pueden inscribirse.', 'warning'); return; }
      const uid = _ctx.auth.currentUser.uid;
      const email = _ctx.auth.currentUser.email;
      try {
        await AulaService.enroll(_ctx, uid, email, cursoId, cursoTitulo);
        showToast('Inscripcion exitosa!', 'success');
        if (window.Notify) window.Notify.send(uid, { title: 'Inscripcion Exitosa', message: `Bienvenido al curso "${cursoTitulo}".`, type: 'aula' });
        await initStudent(_ctx);
        const tabBtn = $id('tab-aula-mis-cursos-btn');
        if (tabBtn) new bootstrap.Tab(tabBtn).show();
      } catch (e) {
        if (e.message === 'YA_INSCRITO') showToast('Ya estas inscrito en este curso.', 'info');
        else { console.error(e); showToast('Error al inscribirse.', 'danger'); }
      }
    }

    async function abandonarCurso(enrollmentId, courseId) {
      if (!confirm('Abandonar curso? Se borrara el progreso.')) return;
      try {
        await AulaService.unenroll(_ctx, enrollmentId, _ctx.auth.currentUser.uid, courseId);
        showToast('Has abandonado el curso', 'info');
        await initStudent(_ctx);
      } catch (e) { console.error(e); showToast('Error al abandonar', 'danger'); }
    }

    // ══════════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════════
    function initAdmin(ctx) {
      _ctx = ctx;
      const myUid = ctx.auth.currentUser.uid;
      _adminCourseCache = [];

      const stuEl = $id('aula-student');
      const admEl = $id('aula-admin');
      const saEl = $id('aula-superadmin');
      if (stuEl) stuEl.classList.add('d-none');
      if (admEl) admEl.classList.remove('d-none');
      if (saEl) saEl.classList.add('d-none');

      const kpiAlumnos = $id('kpi-total-alumnos');
      const kpiTasa = $id('kpi-tasa-finalizacion');
      const kpiPromedio = $id('kpi-promedio-general');
      const feedContainer = $id('aula-admin-feed');

      (async () => {
        try {
          const stats = await AulaService.getAdminDashboardStats(_ctx, myUid);
          if (kpiAlumnos) kpiAlumnos.textContent = stats.totalAlumnos;
          if (kpiTasa) kpiTasa.textContent = `${stats.tasaFinalizacion}%`;
          if (kpiPromedio) kpiPromedio.textContent = `${stats.promedioGeneral}%`;
        } catch (_) { }
        try {
          const feed = await AulaService.getAdminActivityFeed(_ctx, myUid);
          if (feedContainer) {
            feedContainer.innerHTML = feed.length === 0
              ? '<div class="list-group-item text-center p-4 text-muted small">No hay actividad reciente.</div>'
              : feed.map(item => {
                const icon = item.type === 'insc' ? 'bi-person-plus-fill text-primary' : 'bi-file-earmark-check-fill text-info';
                return `<div class="list-group-item d-flex gap-3 py-3"><i class="bi ${icon} fs-5 mt-1"></i><div class="small">${item.text}<br><span class="text-muted" style="font-size:.8em;">${item.date.toLocaleString()}</span></div></div>`;
              }).join('');
          }
        } catch (_) { }
      })();

      const listCursos = $id('aula-adm-cursos');
      let _currentAdminCourseId = null;
      let _currentAdminModuleId = null;
      let _unsubAdminModules = null, _unsubAdminLessons = null, _unsubAdminQuizzes = null;

      const uCursos = _ctx.db.collection(CURS).where('creadoPor', '==', myUid).orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
          _adminCourseCache = snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo }));
          renderAdminCourses(snap.docs, listCursos);
          updateReportDropdown();
        });
      _ctx.activeUnsubs.push(uCursos);

      const listAvisos = $id('aula-adm-avisos-list');
      const uAvisos = AulaService.streamAvisos(_ctx, snap => {
        if (!listAvisos) return;
        if (snap.empty) { listAvisos.innerHTML = '<div class="p-3 text-muted small text-center"><i class="bi bi-bell-slash mb-2 d-block fs-5"></i>Sin avisos.</div>'; return; }
        listAvisos.innerHTML = snap.docs.map(d => {
          const a = d.data();
          const createdAt = a.createdAt?.toDate?.();
          const tipo = a.tipo || 'aviso';
          const badgeCls = tipo === 'urgente' ? 'bg-danger-subtle text-danger' : tipo === 'recomendacion' ? 'bg-success-subtle text-success' : 'bg-light text-dark';
          const label = tipo === 'urgente' ? 'Urgente' : tipo === 'recomendacion' ? 'Recomendacion' : 'Aviso';
          return `<div class="list-group-item d-flex justify-content-between align-items-start p-2 small"><div class="me-2"><div class="d-flex align-items-center gap-2 mb-1"><span class="badge ${badgeCls} border">${label}</span><span class="text-muted">${createdAt ? createdAt.toLocaleDateString() : ''}</span></div><div class="lh-sm">${a.texto || ''}</div></div><button class="btn btn-sm text-danger p-0 ms-2" onclick="Aula.borrarAviso('${d.id}')"><i class="bi bi-x-lg"></i></button></div>`;
        }).join('');
      });
      _ctx.activeUnsubs.push(uAvisos);

      wireOnce('btn-quick-create-course', 'click', e => { e.preventDefault(); openCourseModal(null); });
      wireOnce('btn-quick-aviso', 'click', e => {
        e.preventDefault();
        const m = $id('modalAulaAdmAviso'); if (!m) return;
        const txt = $id('adm-aviso-text'); if (txt) txt.value = '';
        const tip = $id('adm-aviso-tipo'); if (tip) tip.value = 'aviso';
        const dur = $id('adm-aviso-duracion'); if (dur) dur.value = '1440';
        bootstrap.Modal.getOrCreateInstance(m).show();
      });

      $id('aula-add-course-fab')?.addEventListener('click', e => { e.preventDefault(); openCourseModal(null); });

      const selCurso = $id('ac-curso-select');
      selCurso?.addEventListener('change', e => { _currentAdminCourseId = e.target.value; loadAdminModules(e.target.value); loadAdminQuizzes(e.target.value); });

      const selModulo = $id('ac-module-select');
      selModulo?.addEventListener('change', e => { _currentAdminModuleId = e.target.value; loadAdminLessons(_currentAdminCourseId, e.target.value); });

      wireOnce('aula-adm-avisos-form', 'submit', async e => {
        e.preventDefault();
        const inp = $id('aula-adm-aviso-input'); const txt = inp?.value.trim();
        if (!txt) return;
        try { await AulaService.addAviso(_ctx, txt); showToast('Aviso publicado', 'success'); if (inp) inp.value = ''; }
        catch (_) { showToast('Error', 'danger'); }
      });

      wireOnce('aula-adm-aviso-modal-form', 'submit', async e => {
        e.preventDefault();
        const mensaje = $id('adm-aviso-text')?.value.trim() || '';
        if (!mensaje) { showToast('Escribe un mensaje.', 'warning'); return; }
        const tipo = $id('adm-aviso-tipo')?.value || 'aviso';
        const durMin = parseInt($id('adm-aviso-duracion')?.value || '0', 10) || 0;
        let prioridad = tipo === 'urgente' ? 1 : tipo === 'recomendacion' ? 3 : 2;
        try {
          await AulaService.addAviso(_ctx, mensaje, { tipo, prioridad, modulo: 'global', duracionMin: durMin });
          showToast('Aviso publicado', 'success');
          bootstrap.Modal.getInstance($id('modalAulaAdmAviso'))?.hide();
        } catch (_) { showToast('Error al publicar', 'danger'); }
      });

      wireOnce('aula-course-form', 'submit', async e => {
        e.preventDefault();
        const form = e.target;
        const titulo = ($id('aula-modal-course-title')?.value || '').trim();
        if (!titulo) { showToast('El curso debe tener titulo.', 'warning'); return; }
        const checked = form.querySelectorAll('#course-publico-group .course-publico-chk:checked');
        const values = Array.from(checked).map(el => el.value);
        let publico = 'todos';
        if (values.length === 1 && !values.includes('todos')) publico = values[0];
        const rawTags = ($id('aula-modal-course-tags')?.value || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const data = { titulo, descripcion: ($id('aula-modal-course-desc')?.value || '').trim(), duracionHoras: parseInt($id('aula-modal-course-hours')?.value || '1', 10) || 1, nivel: $id('aula-modal-course-level')?.value || 'General', imagen: ($id('aula-modal-course-image')?.value || '').trim(), tags: rawTags, publico };
        try {
          const idEl = $id('aula-course-id');
          if (!idEl?.value) { await AulaService.createCourse(_ctx, data); showToast('Curso creado', 'success'); }
          else { await AulaService.updateCourse(_ctx, idEl.value, data); showToast('Curso actualizado', 'success'); }
        } catch (err) { console.error(err); showToast('Error guardando curso', 'danger'); }
        finally { bootstrap.Modal.getInstance($id('modalAulaCourse'))?.hide(); }
      });

      // Modulos
      wireOnce('ac-save-module', 'click', async () => {
        if (!_currentAdminCourseId) return showToast('Selecciona un curso', 'warning');
        const mid = $id('ac-module-id').value;
        const data = { titulo: $id('ac-module-title').value.trim(), descripcion: $id('ac-module-desc').value.trim(), order: Number($id('ac-module-order').value) || 1 };
        if (!data.titulo) return showToast('El modulo necesita titulo', 'warning');
        try {
          if (mid) await AulaService.updateModule(_ctx, _currentAdminCourseId, mid, data);
          else await AulaService.addModule(_ctx, _currentAdminCourseId, data);
          showToast('Modulo guardado', 'success'); resetModuleForm();
        } catch (_) { showToast('Error', 'danger'); }
      });
      wireOnce('ac-btn-cancel-module', 'click', resetModuleForm);

      // Lecciones
      wireOnce('ac-save-lesson', 'click', async () => {
        if (!_currentAdminCourseId || !_currentAdminModuleId) return showToast('Selecciona curso y modulo', 'warning');
        const lid = $id('ac-lesson-id').value;
        const text = $id('ac-lesson-text').value.trim();
        const html = text ? `<div class="prose"><p>${text.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>` : '';
        const resources = [];
        $id('ac-resources-list')?.querySelectorAll('.ac-resource-row').forEach(row => {
          const type = row.querySelector('select')?.value || 'link';
          const url = row.querySelector('input[type="url"]')?.value?.trim() || '';
          const lbl = row.querySelector('input[type="text"]')?.value?.trim() || '';
          if (url) resources.push({ type, url, label: lbl });
        });
        const data = { title: $id('ac-lesson-title').value.trim(), order: Number($id('ac-lesson-order').value) || 1, html, resources };
        try {
          if (lid) await AulaService.updateLesson(_ctx, _currentAdminCourseId, _currentAdminModuleId, lid, data);
          else await AulaService.addLesson(_ctx, _currentAdminCourseId, _currentAdminModuleId, data);
          showToast('Leccion guardada', 'success'); resetLessonForm();
        } catch (_) { showToast('Error', 'danger'); }
      });
      wireOnce('ac-btn-cancel-edit', 'click', resetLessonForm);
      wireOnce('ac-add-resource', 'click', () => addResourceRow());

      // Quizzes
      wireOnce('ac-quiz-add', 'click', () => addQuizCard());
      wireOnce('ac-save-quiz', 'click', async () => {
        const courseId = $id('ac-curso-select')?.value;
        if (!courseId) return showToast('Selecciona un curso', 'warning');
        const qid = $id('ac-quiz-id').value;
        const items = [...$id('ac-quiz-items').children].map(card => {
          const enunciado = card.querySelector('.q-text')?.value?.trim() || '';
          const opciones = [...card.querySelectorAll('.q-opt')].map(inp => inp.value.trim());
          const okEl = card.querySelector('.q-ok:checked');
          return { enunciado, opciones, correctaIndex: okEl ? Number(okEl.value) : 0 };
        }).filter(q => q.enunciado && q.opciones.some(o => o));
        if (!items.length) return showToast('Agrega preguntas validas', 'warning');
        const quizData = { title: $id('ac-quiz-title').value.trim() || 'Quiz', minScore: Number($id('ac-quiz-min').value) || 70, timeLimit: Number($id('ac-quiz-time').value) || 0, maxAttempts: Number($id('ac-quiz-tries').value) || 3, items };
        try {
          if (qid) await AulaService.updateQuiz(_ctx, courseId, qid, quizData);
          else await AulaService.addQuiz(_ctx, courseId, quizData);
          showToast('Quiz guardado', 'success'); resetQuizForm();
        } catch (_) { showToast('Error', 'danger'); }
      });
      wireOnce('ac-btn-cancel-quiz', 'click', resetQuizForm);

      // Reportes
      const reportTypeSelect = $id('report-type-select');
      const reportCursoGroup = $id('report-curso-select-group');
      reportTypeSelect?.addEventListener('change', e => { reportCursoGroup?.classList.toggle('d-none', e.target.value !== 'calificaciones_curso'); });
      $id('aula-admin-report-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generando...';
        const type = reportTypeSelect.value;
        const cursoId = type === 'calificaciones_curso' ? $id('report-curso-select')?.value : null;
        try {
          const data = await AulaService.generateReportData(_ctx, myUid, type, cursoId || undefined);
          if (!data.length) showToast('Sin datos', 'info');
          else downloadCSV(data, `${type}_${cursoId || 'global'}.csv`);
        } catch (_) { showToast('Error generando reporte', 'danger'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-download me-1"></i> Descargar CSV'; }
      });

      // ── Admin load helpers ──
      function loadAdminModules(courseId) {
        _currentAdminCourseId = courseId;
        const host = $id('ac-modules-list');
        const modSelect = $id('ac-module-select');
        resetModuleForm();
        if (_unsubAdminModules) _unsubAdminModules();
        if (!courseId) { if (host) host.innerHTML = '<div class="p-3 text-muted small">Selecciona un curso.</div>'; if (modSelect) modSelect.innerHTML = '<option value="">Selecciona modulo...</option>'; return; }
        _unsubAdminModules = AulaService.streamModules(_ctx, courseId, snap => {
          if (!host) return;
          if (snap.empty) host.innerHTML = '<div class="p-3 text-muted small">Sin modulos aun.</div>';
          else host.innerHTML = snap.docs.map(d => {
            const m = d.data();
            return `<div class="list-group-item d-flex justify-content-between align-items-center p-2"><div><span class="badge bg-secondary me-2">#${m.order}</span><span class="fw-semibold small">${m.titulo}</span></div><div><button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="Aula.editModule('${d.id}', '${(m.titulo || '').replace(/'/g, "\\'")}', ${m.order}, '${(m.descripcion || '').replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="Aula.deleteModule('${d.id}')"><i class="bi bi-trash"></i></button></div></div>`;
          }).join('');
          if (modSelect) modSelect.innerHTML = '<option value="">Selecciona modulo...</option>' + snap.docs.map(d => `<option value="${d.id}">${d.data().titulo}</option>`).join('');
        }, err => console.error(err));
      }

      function loadAdminLessons(courseId, moduleId) {
        const host = $id('ac-lessons-list');
        resetLessonForm();
        if (_unsubAdminLessons) _unsubAdminLessons();
        if (!courseId || !moduleId) { if (host) host.innerHTML = '<div class="p-3 text-muted small">Selecciona un modulo.</div>'; return; }
        _unsubAdminLessons = AulaService.streamLessons(_ctx, courseId, moduleId, snap => {
          if (!host) return;
          if (snap.empty) { host.innerHTML = '<div class="p-3 text-muted small">Sin lecciones.</div>'; return; }
          host.innerHTML = snap.docs.map(d => {
            const l = d.data();
            const resJson = encodeURIComponent(JSON.stringify(l.resources || []));
            return `<div class="list-group-item d-flex justify-content-between align-items-center p-2"><div><span class="badge bg-secondary me-2">#${l.order}</span><span class="fw-semibold small">${l.title}</span></div><div><button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="Aula.editLesson('${d.id}', '${(l.title || '').replace(/'/g, "\\'")}', ${l.order}, '${encodeURIComponent(l.html || '')}', '${resJson}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="Aula.deleteLesson('${d.id}')"><i class="bi bi-trash"></i></button></div></div>`;
          }).join('');
        }, err => console.error(err));
      }

      function loadAdminQuizzes(courseId) {
        const host = $id('ac-quizzes-list'); resetQuizForm();
        if (_unsubAdminQuizzes) _unsubAdminQuizzes();
        if (!courseId) { if (host) host.innerHTML = '<div class="p-3 text-muted">Selecciona un curso.</div>'; return; }
        _unsubAdminQuizzes = AulaService.streamQuizzes(_ctx, courseId, snap => {
          if (!host) return;
          if (snap.empty) { host.innerHTML = '<div class="p-3 text-muted small">Sin evaluaciones.</div>'; return; }
          host.innerHTML = snap.docs.map(d => {
            const q = d.data(); const safeJson = encodeURIComponent(JSON.stringify(q));
            return `<div class="list-group-item d-flex justify-content-between align-items-center p-2"><div><span class="fw-bold small">${q.title}</span> <span class="badge bg-light text-dark border ms-1">${q.timeLimit || '\u221E'} min</span></div><div><button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="Aula.editQuiz('${d.id}', '${safeJson}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="Aula.deleteQuiz('${d.id}')"><i class="bi bi-trash"></i></button></div></div>`;
          }).join('');
        });
      }

      function updateReportDropdown() {
        const sel = $id('report-curso-select');
        if (sel) sel.innerHTML = '<option value="">Todos mis cursos</option>' + _adminCourseCache.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
      }

      function resetModuleForm() {
        $id('ac-module-form')?.reset(); const mid = $id('ac-module-id'); if (mid) mid.value = '';
        $id('ac-btn-cancel-module')?.classList.add('d-none');
        const btn = $id('ac-save-module'); if (btn) { btn.innerHTML = '<i class="bi bi-plus-lg me-1"></i>Guardar Modulo'; btn.classList.remove('btn-primary'); btn.classList.add('btn-success'); }
      }

      function resetLessonForm() {
        $id('ac-lesson-form')?.reset(); const lid = $id('ac-lesson-id'); if (lid) lid.value = '';
        const rl = $id('ac-resources-list'); if (rl) rl.innerHTML = '';
        $id('ac-btn-cancel-edit')?.classList.add('d-none');
        const btn = $id('ac-save-lesson'); if (btn) { btn.textContent = 'Guardar Leccion'; btn.classList.remove('btn-primary'); btn.classList.add('btn-success'); }
      }

      function resetQuizForm() {
        $id('ac-quiz-form')?.reset(); const qid = $id('ac-quiz-id'); if (qid) qid.value = '';
        const items = $id('ac-quiz-items'); if (items) items.innerHTML = '';
        $id('ac-btn-cancel-quiz')?.classList.add('d-none');
        const btn = $id('ac-save-quiz'); if (btn) { btn.textContent = 'Guardar Quiz'; btn.classList.remove('btn-primary'); btn.classList.add('btn-success'); }
      }
    }

    // ── Admin courses render ──
    function renderAdminCourses(docs, host) {
      if (!host) return;
      if (!docs.length) { host.innerHTML = '<div class="text-center p-4 text-muted"><i class="bi bi-folder2-open mb-2 d-block fs-4"></i>No has creado cursos aun.</div>'; return; }
      host.innerHTML = docs.map(d => {
        const c = d.data(); const pub = c.publicado !== false;
        const pubLabel = { estudiantes: 'Estudiantes', docentes: 'Docentes' }[c.publico] || 'Todos';
        const tags = (c.tags || []).slice(0, 3).map(t => `<span class="aula-tag-pill">${esc(t)}</span>`).join(' ');
        const estadoBadge = pub ? '<span class="badge bg-success-subtle text-success border border-success-subtle">Publicado</span>' : '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Borrador</span>';
        return `<div class="card border-0 shadow-sm mb-2 rounded-3"><div class="card-body p-3 d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2"><div class="flex-grow-1"><h6 class="fw-bold mb-1 small">${c.titulo || '(Sin titulo)'}</h6><div class="d-flex flex-wrap gap-1 mb-1">${estadoBadge}<span class="badge bg-light text-dark border">${pubLabel}</span></div><div class="d-flex gap-1 flex-wrap">${tags}</div></div><div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" title="${pub ? 'Ocultar' : 'Publicar'}" onclick="Aula.toggleCursoPublicado('${d.id}', ${pub})"><i class="bi ${pub ? 'bi-eye-slash' : 'bi-eye'}"></i></button><button class="btn btn-outline-info" title="Alumnos" onclick="Aula.openStudentsModal('${d.id}', '${(c.titulo || '').replace(/'/g, "\\'")}')"><i class="bi bi-people"></i></button><button class="btn btn-outline-primary" title="Contenido" onclick="Aula.openContentModal('${d.id}')"><i class="bi bi-pencil-square"></i></button><button class="btn btn-outline-danger" title="Borrar" onclick="Aula.eliminarCurso('${d.id}')"><i class="bi bi-trash"></i></button></div></div></div>`;
      }).join('');
    }

    // ── Modals ──
    function openCourseModal(courseId) {
      const m = $id('modalAulaCourse'); if (!m) return;
      const checks = document.querySelectorAll('#course-publico-group .course-publico-chk');
      checks.forEach(chk => { chk.checked = chk.value === 'todos'; });
      const idEl = $id('aula-course-id'); if (idEl) idEl.value = courseId || '';
      const titleModal = $id('aula-course-modal-title');
      if (!courseId) {
        if (titleModal) titleModal.innerHTML = '<i class="bi bi-journal-plus me-2"></i>Crear curso';
        [$id('aula-modal-course-title'), $id('aula-modal-course-desc'), $id('aula-modal-course-tags'), $id('aula-modal-course-image')].forEach(el => { if (el) el.value = ''; });
        const h = $id('aula-modal-course-hours'); if (h) h.value = '1';
        const l = $id('aula-modal-course-level'); if (l) l.value = 'General';
      }
      bootstrap.Modal.getOrCreateInstance(m).show();
    }

    async function openContentModal(courseId) {
      const sel = $id('ac-curso-select');
      if (sel) {
        sel.innerHTML = '<option value="">Selecciona curso...</option>' + _adminCourseCache.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
        if (courseId) { sel.value = courseId; sel.dispatchEvent(new Event('change')); }
      }
      bootstrap.Modal.getOrCreateInstance($id('modalAulaContent')).show();
    }

    async function openStudentsModal(cid, tit) {
      const m = new bootstrap.Modal($id('modalAulaStudents'));
      $id('aula-students-course-title').textContent = tit;
      const lst = $id('aula-students-list'); const ldg = $id('aula-students-loading'); const emp = $id('aula-students-empty'); const tbl = $id('aula-students-table');
      if (lst) lst.innerHTML = ''; ldg?.classList.remove('d-none'); emp?.classList.add('d-none'); tbl?.classList.add('d-none');
      m.show();
      try {
        const s = await AulaService.getCourseStudents(_ctx, cid);
        ldg?.classList.add('d-none');
        if (!s.length) { emp?.classList.remove('d-none'); return; }
        tbl?.classList.remove('d-none');
        if (lst) lst.innerHTML = s.map(x => `<tr><td class="ps-3 small">${x.email}</td><td class="small">${x.date ? x.date.toDate().toLocaleDateString() : '-'}</td><td class="small">${x.pct}%</td><td class="text-end pe-3"><button class="btn btn-sm btn-outline-danger" onclick="Aula.kickStudent('${x.enrollmentId}','${x.uid}','${cid}')">Baja</button></td></tr>`).join('');
      } catch (_) { ldg?.classList.add('d-none'); if (emp) { emp.innerHTML = 'Error'; emp.classList.remove('d-none'); } }
    }

    async function kickStudent(eid, uid, cid) {
      if (!confirm('Dar de baja?')) return;
      try { await AulaService.unenroll(_ctx, eid, uid, cid); showToast('Baja exitosa', 'success'); bootstrap.Modal.getInstance($id('modalAulaStudents'))?.hide(); }
      catch (_) { showToast('Error', 'danger'); }
    }

    async function eliminarCurso(id) {
      if (!confirm('Eliminar curso?')) return;
      try { await AulaService.deleteCourse(_ctx, id); showToast('Curso eliminado', 'success'); }
      catch (e) { if (e.message === 'TIENE_ALUMNOS') showToast('Tiene alumnos inscritos.', 'warning'); else { console.error(e); showToast('Error al eliminar', 'danger'); } }
    }

    async function toggleCursoPublicado(id, current) {
      try { const n = await AulaService.togglePublished(_ctx, id, current); showToast(n ? 'Publicado' : 'Borrador', 'info'); }
      catch (_) { showToast('Error', 'danger'); }
    }

    async function borrarAviso(id) {
      if (!confirm('Eliminar aviso?')) return;
      try { await AulaService.deleteAviso(_ctx, id); showToast('Eliminado', 'info'); }
      catch (_) { showToast('Error', 'danger'); }
    }

    function editModule(id, t, o, desc) {
      $id('ac-module-id').value = id; $id('ac-module-title').value = t; $id('ac-module-order').value = o; $id('ac-module-desc').value = desc || '';
      const btn = $id('ac-save-module'); if (btn) { btn.textContent = 'Actualizar modulo'; btn.classList.replace('btn-success', 'btn-primary'); }
      $id('ac-btn-cancel-module')?.classList.remove('d-none');
    }

    async function deleteModule(id) {
      if (!confirm('Eliminar modulo y sus lecciones?')) return;
      try { await AulaService.deleteModule(_ctx, $id('ac-curso-select').value, id); showToast('Eliminado', 'info'); }
      catch (_) { showToast('Error', 'danger'); }
    }

    function editLesson(id, t, o, h, resJson) {
      $id('ac-lesson-id').value = id; $id('ac-lesson-title').value = t; $id('ac-lesson-order').value = o;
      const div = document.createElement('div'); div.innerHTML = decodeURIComponent(h);
      $id('ac-lesson-text').value = (div.innerText || div.textContent || '').trim();
      const rl = $id('ac-resources-list'); if (rl) rl.innerHTML = '';
      try { JSON.parse(decodeURIComponent(resJson || '[]')).forEach(r => addResourceRow(r)); } catch (_) { }
      const btn = $id('ac-save-lesson'); if (btn) { btn.textContent = 'Actualizar leccion'; btn.classList.replace('btn-success', 'btn-primary'); }
      $id('ac-btn-cancel-edit')?.classList.remove('d-none');
    }

    async function deleteLesson(id) {
      if (!confirm('Eliminar?')) return;
      const cid = $id('ac-curso-select')?.value; const mid = $id('ac-module-select')?.value;
      if (!cid || !mid) return;
      try { await AulaService.deleteLesson(_ctx, cid, mid, id); showToast('Eliminado', 'info'); }
      catch (_) { showToast('Error', 'danger'); }
    }

    function editQuiz(id, json) {
      const q = JSON.parse(decodeURIComponent(json));
      $id('ac-quiz-id').value = id; $id('ac-quiz-title').value = q.title; $id('ac-quiz-min').value = q.minScore || 70;
      $id('ac-quiz-time').value = q.timeLimit || 20; $id('ac-quiz-tries').value = q.maxAttempts || 3;
      const host = $id('ac-quiz-items'); host.innerHTML = '';
      (q.items || []).forEach(item => addQuizCard(item));
      const btn = $id('ac-save-quiz'); if (btn) { btn.textContent = 'Actualizar quiz'; btn.classList.replace('btn-success', 'btn-primary'); }
      $id('ac-btn-cancel-quiz')?.classList.remove('d-none');
    }

    async function deleteQuiz(id) {
      if (!confirm('Eliminar?')) return;
      try { await AulaService.deleteQuiz(_ctx, $id('ac-curso-select').value, id); showToast('Eliminado', 'info'); }
      catch (_) { showToast('Error', 'danger'); }
    }

    function addQuizCard(data) {
      const host = $id('ac-quiz-items'); const idx = host.children.length;
      const en = data?.enunciado || ''; const co = data?.correctaIndex ?? 0;
      const opts = data?.opciones || ['', '', '', ''];
      host.insertAdjacentHTML('beforeend', `<div class="card border-0 shadow-sm mb-2"><div class="card-body position-relative p-2"><button type="button" class="btn-close position-absolute top-0 end-0 m-2" onclick="this.closest('.card').remove()"></button><div class="mb-2"><label class="form-label small fw-bold">Enunciado</label><input class="form-control form-control-sm q-text" value="${en.replace(/"/g, '&quot;')}"></div><div class="row g-2">${['A', 'B', 'C', 'D'].map((lbl, j) => `<div class="col-6"><div class="input-group input-group-sm"><div class="input-group-text"><input class="form-check-input mt-0 q-ok" type="radio" name="q${idx}-ok" value="${j}" ${Number(co) === j ? 'checked' : ''}></div><input class="form-control q-opt" placeholder="${lbl}" value="${(opts[j] || '').replace(/"/g, '&quot;')}"></div></div>`).join('')}</div></div></div>`);
    }

    function addResourceRow(data) {
      const host = $id('ac-resources-list'); if (!host) return;
      const type = data?.type || 'youtube'; const url = data?.url || ''; const label = data?.label || '';
      host.insertAdjacentHTML('beforeend', `<div class="ac-resource-row"><select class="form-select form-select-sm"><option value="youtube" ${type === 'youtube' ? 'selected' : ''}>YouTube</option><option value="pdf" ${type === 'pdf' ? 'selected' : ''}>PDF</option><option value="image" ${type === 'image' ? 'selected' : ''}>Imagen</option><option value="slides" ${type === 'slides' ? 'selected' : ''}>Slides</option><option value="link" ${type === 'link' ? 'selected' : ''}>Enlace</option></select><input type="url" class="form-control form-control-sm flex-grow-1" placeholder="URL" value="${esc(url)}"><input type="text" class="form-control form-control-sm" style="width:120px" placeholder="Etiqueta" value="${esc(label)}"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.ac-resource-row').remove()"><i class="bi bi-x"></i></button></div>`);
    }

    // ══════════════════════════════════════════════════════════
    //  SUPERADMIN
    // ══════════════════════════════════════════════════════════
    async function initSuperAdmin(ctx) {
      _ctx = ctx;
      [$id('aula-student'), $id('aula-admin')].forEach(el => el?.classList.add('d-none'));
      $id('aula-superadmin')?.classList.remove('d-none');
      const listEl = $id('aula-sa-list');
      try {
        const snap = await ctx.db.collection(CURS).orderBy('createdAt', 'desc').get();
        const cursos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        window._saAulaData = cursos.map(c => ({ ID: c.id, Titulo: c.titulo, Instructor: c.creadoEmail, Publicado: c.publicado ? 'SI' : 'NO', Fecha: c.createdAt ? c.createdAt.toDate().toLocaleDateString() : '-' }));
        if (!cursos.length) { if (listEl) listEl.innerHTML = '<p class="text-center p-4">No hay cursos.</p>'; return; }
        if (listEl) listEl.innerHTML = `<div class="table-responsive"><table class="table table-hover align-middle mb-0 small"><thead class="table-light"><tr><th>Curso</th><th>Instructor</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${cursos.map(c => { const est = c.publicado ? '<span class="badge bg-success-subtle text-success">Publicado</span>' : '<span class="badge bg-secondary-subtle text-secondary">Borrador</span>'; return `<tr><td class="fw-bold">${c.titulo}</td><td>${c.creadoEmail || '?'}</td><td>${est}</td><td class="text-muted">${c.createdAt ? c.createdAt.toDate().toLocaleDateString() : '-'}</td></tr>`; }).join('')}</tbody></table></div>`;
      } catch (e) { console.error(e); if (listEl) listEl.innerHTML = '<div class="alert alert-danger m-3">Error.</div>'; }
    }

    // ══════════════════════════════════════════════════════════
    //  CONSTANCIA
    // ══════════════════════════════════════════════════════════
    async function verConstancia(cursoId, cursoTituloRaw) {
      if (!_ctx?.db) { showToast('Contexto invalido.', 'danger'); return; }
      const user = _ctx.auth.currentUser;
      if (!user) { showToast('Inicia sesion.', 'warning'); return; }
      try {
        showToast('Generando constancia...', 'info');
        const uid = user.uid;
        let cursoTitulo = cursoTituloRaw || '';
        const prof = _ctx.profile || _ctx.currentUserProfile || {};
        const alumnoName = prof.displayName || user.displayName || user.email || 'Alumno/a';
        const campus = 'TecNM Campus Los Cabos';
        let cert = await AulaService.getCertificate(_ctx, uid, cursoId);
        let folio = 'BORRADOR', folioId = null, issuedDate = new Date(), score = '\u2014', horas = null;
        let matricula = prof.matricula || '';
        if (cert) {
          folioId = (cert.id || cert.folio || '').toString(); if (folioId) folio = folioId;
          if (cert.issuedAt?.toDate) issuedDate = cert.issuedAt.toDate();
          if (cert.score != null) score = cert.score;
          if (cert.horas || cert.duracionHoras) horas = cert.horas || cert.duracionHoras;
          if (cert.matricula) matricula = cert.matricula;
        }
        if (score === '\u2014') {
          try { const quiz = await AulaService.getFirstQuiz(_ctx, cursoId); if (quiz) { const att = await AulaService.getAttempts(_ctx, uid, cursoId, quiz.id); if (att.length) { const best = att.reduce((m, a) => Math.max(m, a.score || 0), 0); if (best > 0) score = best; } } } catch (_) { }
        }
        try { const cs = await _ctx.db.collection('aula-cursos').doc(cursoId).get(); if (cs.exists) { const cd = cs.data(); if (!cursoTitulo && cd.titulo) cursoTitulo = cd.titulo; if (!horas && cd.duracionHoras) horas = cd.duracionHoras; } } catch (_) { }
        const horasStr = horas ? `${horas} hora${horas === 1 ? '' : 's'}` : '\u2014';
        const fechaStr = issuedDate.toLocaleDateString('es-MX');
        const isDraft = !cert || !folioId;
        const qrData = isDraft ? 'https://sia-tecnm.web.app/verify/BORRADOR' : `https://sia-tecnm.web.app/verify/${encodeURIComponent(folioId)}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
        const html = buildConstanciaHTML({ campus, folio, alumnoName, matricula, cursoTitulo, score, horasStr, fechaStr, qrUrl, isDraft });
        window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
      } catch (err) { console.error(err); showToast('Error generando constancia.', 'danger'); }
    }

    function buildConstanciaHTML(d) {
      return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Constancia - ${esc(d.cursoTitulo)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#f0f2f5;padding:1.5rem;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui,-apple-system,sans-serif}.diploma{background:#fff;width:960px;max-width:100%;padding:2.5rem;border-radius:1.5rem;box-shadow:0 24px 60px rgba(15,23,42,.25);position:relative;overflow:hidden}.diploma::before{content:"";position:absolute;inset:12px;border-radius:1.25rem;border:2px solid rgba(15,23,42,.06);pointer-events:none}.brand-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem}.brand-title{font-size:.8rem;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:600}.badge-folio{font-size:.7rem;border-radius:999px;padding:.3rem .8rem;border:1px solid rgba(148,163,184,.5);color:#475569;background:#f8fafc}.title-main{font-size:1.8rem;letter-spacing:.06em;text-transform:uppercase;font-weight:800;color:#0f172a;text-align:center;margin-bottom:.4rem}.subtitle{text-align:center;color:#64748b;font-size:.85rem;margin-bottom:2rem;line-height:1.5}.student-name{font-size:1.6rem;text-align:center;font-weight:700;color:#0f172a;padding-bottom:.3rem;border-bottom:2px solid #e5e7eb;display:inline-block;margin:0 auto .4rem}.student-block{text-align:center;margin-bottom:1.75rem}.student-meta{font-size:.85rem;color:#94a3b8}.course-title{font-size:1.15rem;font-weight:600;color:#0f172a;margin-bottom:.2rem}.pill{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .7rem;border-radius:999px;border:1px solid rgba(148,163,184,.45);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#475569;background:#f8fafc}.grid-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin:1.5rem 0 2rem;font-size:.85rem;color:#0f172a}.meta-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:.25rem}.meta-value{font-weight:600}.footer-row{display:flex;justify-content:space-between;align-items:flex-end;gap:1.5rem;margin-top:1.25rem;font-size:.78rem;color:#64748b;flex-wrap:wrap}.sign-block{text-align:center;min-width:180px}.sign-line{border-top:1px solid #e2e8f0;margin-bottom:.2rem}.qr-block{text-align:center}.qr-block img{border-radius:10px;border:3px solid #e5e7eb;background:#fff;padding:3px;max-width:100px}.draft-badge{position:absolute;bottom:1.5rem;left:1.5rem;display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .6rem;border-radius:999px;font-size:.7rem;text-transform:uppercase;letter-spacing:.14em;background:rgba(248,250,252,.9);color:#f97316;border:1px dashed rgba(249,115,22,.4)}@media(max-width:600px){.diploma{padding:1.25rem}.title-main{font-size:1.3rem}.student-name{font-size:1.2rem}.footer-row{flex-direction:column;align-items:center}}@media print{body{background:#fff;padding:0}.diploma{box-shadow:none;border-radius:0}}</style></head><body><div class="diploma"><div class="brand-bar"><div><div class="brand-title">Sistema de Integracion Academico</div><div style="font-size:.8rem;color:#94a3b8">${esc(d.campus)}</div></div><div class="badge-folio">Folio: <strong>${esc(d.folio)}</strong></div></div><h1 class="title-main">Constancia</h1><p class="subtitle">Por medio de la presente se hace constar que la persona indicada ha completado satisfactoriamente el siguiente curso de formacion academica:</p><div class="student-block"><div class="student-name">${esc(d.alumnoName)}</div><div class="student-meta">${d.matricula ? 'Matricula ' + esc(d.matricula) + ' &middot; ' : ''}${esc(d.campus)}</div></div><div style="text-align:center;margin-bottom:.75rem"><div class="course-title">${esc(d.cursoTitulo) || '(Curso sin titulo)'}</div><div style="font-size:.85rem;color:#64748b;margin-bottom:.75rem">Otorgado a traves del Sistema de Integracion Academico (SIA).</div><span class="pill">Promedio final: <strong>${esc(String(d.score))}</strong></span></div><div class="grid-meta"><div><div class="meta-label">Duracion</div><div class="meta-value">${esc(d.horasStr)}</div></div><div><div class="meta-label">Emision</div><div class="meta-value">${esc(d.fechaStr)}</div></div><div><div class="meta-label">Verificacion</div><div class="meta-value">Escanea el codigo QR</div></div></div><div class="footer-row"><div class="qr-block"><img src="${d.qrUrl}" alt="QR"><div style="margin-top:.4rem;font-size:.7rem">sia-tecnm.web.app/verify/${esc(d.folio)}</div></div><div class="sign-block"><div class="sign-line"></div><div style="font-weight:600">Coordinacion de SIA</div><div style="color:#94a3b8">TecNM Campus Los Cabos</div></div></div>${d.isDraft ? '<div class="draft-badge">Estado: Borrador (no verificable)</div>' : ''}</div></body></html>`;
    }

    // ── CSV ──
    function downloadCSV(data, filename) {
      if (!data?.length) return;
      const headers = Object.keys(data[0]);
      const rows = [headers.join(',')];
      for (const row of data) rows.push(headers.map(h => `"${('' + (row[h] || '')).replace(/"/g, '""')}"`).join(','));
      const link = document.createElement('a');
      link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
      link.download = filename || 'reporte.csv';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    return {
      init, initStudent, initAdmin, initSuperAdmin,
      inscribirse, abandonarCurso,
      eliminarCurso, toggleCursoPublicado,
      openCourseModal, openContentModal, openStudentsModal,
      verConstancia, kickStudent, borrarAviso,
      editModule, deleteModule,
      editLesson, deleteLesson,
      editQuiz, deleteQuiz,
      downloadCSV, addQuizCard, addResourceRow,
      renderStudentTabs, buildCourseCard: renderCard
    };

  })();

  global.Aula = AulaModule;
})(window);
