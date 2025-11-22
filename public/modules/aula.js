(function (global) {
  const AulaModule = (function () {
    const CURS = 'aula-cursos';
    const INSC = 'aula-inscripciones';
    let _ctx = null;
    const PROG = 'aula-progress';
    const CERT = 'aula-certificados';
    let _studentState = null;

    let _adminCourseCache = []; // Cache para el dropdown de reportes
    function wireOnce(id, type, handler) {
      const el = document.getElementById(id);
      if (!el || el.dataset.wired) return el;
      el.addEventListener(type, handler);
      el.dataset.wired = '1';
      return el;
    }

    // ===== STUDENT =====
    // ===== STUDENT =====
    async function initStudent(ctx) {
      _ctx = ctx;

      const uid = _ctx.auth && _ctx.auth.currentUser ? _ctx.auth.currentUser.uid : null;
      const root = document.getElementById('aula-student-home');
      if (!uid || !root) return;

      const AVISOS_SEED = [
        "📅 Las inscripciones a cursos de verano cierran el próximo viernes.",
        "🎓 Recuerda descargar tus constancias al finalizar cada curso.",
        "📢 Nuevo curso de 'Seguridad e Higiene' ya disponible para todos.",
        "🔧 Mantenimiento programado de la plataforma: Sábado 23:00 hrs.",
        "🏆 ¡Felicidades a los graduados de la generación 2025!"
      ];
      const RECOS_SEED = [
        "Completa al menos un curso este mes.",
        "Reserva un bloque de tiempo fijo para estudiar cada semana.",
        "Revisa los materiales adicionales en cada lección.",
        "Toma notas breves mientras ves cada módulo.",
        "Vuelve a repasar los temas clave antes del quiz final."
      ];

      const db = _ctx.db;
      const [cursosSnap, inscSnap, progSnap, certSnap] = await Promise.all([
        db.collection(CURS).get(),
        // Inscripciones -> studentId (así están las reglas y los docs)
        db.collection(INSC)
          .where('studentId', '==', uid)
          .get(),
        // Progreso -> uid (así está AulaService y las reglas)
        db.collection(PROG)
          .where('uid', '==', uid)
          .get(),
        // Certificados -> uid (así los crea AulaService.issueCertificate)
        db.collection(CERT)
          .where('uid', '==', uid)
          .get()
      ]);


      const cursos = [];
      cursosSnap.forEach(doc => {
        const data = doc.data() || {};

        // Sólo cursos publicados y visibles para estudiantes
        const publicado = data.publicado !== false;
        const publico = data.publico || 'todos';
        const visibleParaStudent = publico === 'todos' || publico === 'estudiantes';

        if (!publicado || !visibleParaStudent) return;

        cursos.push({
          id: doc.id,
          ...data
        });
      });

      const inscByCourse = {};
      inscSnap.forEach(doc => {
        const data = doc.data() || {};
        if (!data.cursoId) return;
        inscByCourse[data.cursoId] = {
          id: doc.id,
          ...data
        };
      });

      const progByCourse = {};
      progSnap.forEach(doc => {
        const data = doc.data() || {};
        if (!data.cursoId) return;
        progByCourse[data.cursoId] = {
          id: doc.id,
          ...data
        };
      });

      const certByCourse = {};
      certSnap.forEach(doc => {
        const data = doc.data() || {};
        if (!data.cursoId) return;
        certByCourse[data.cursoId] = {
          id: doc.id,
          ...data
        };
      });


      const recommended = [];
      const inProgress = [];
      const completed = [];

      cursos.forEach(curso => {
        const insc = inscByCourse[curso.id] || null;
        const prog = progByCourse[curso.id] || null;
        const cert = certByCourse[curso.id] || null;

        const progressPct = prog && typeof prog.progressPct === 'number' ? prog.progressPct : 0;
        const hasCertificate = !!cert;
        const isEnrolled = !!insc;
        const isCompleted = hasCertificate || progressPct >= 100;

        const viewModel = {
          id: curso.id,
          title: curso.titulo || '',
          description: curso.descripcion || '',
          hours: curso.duracionHoras || curso.horas || null,
          level: curso.nivel || null,
          progressPct,
          isEnrolled,
          isCompleted,
          certificateFolio: cert && (cert.folio || cert.folioId || cert.id),
          enrollmentId: insc ? insc.id : null
        };


        if (!isEnrolled) {
          recommended.push(viewModel);
        } else if (isCompleted) {
          completed.push(viewModel);
        } else {
          inProgress.push(viewModel);
        }
      });

      _studentState = {
        recommended,
        inProgress,
        completed,
        avisosSeed: AVISOS_SEED,
        recosSeed: RECOS_SEED
      };

      renderStudentHome(root, _studentState);
      bindStudentHomeEvents(root);
      bindSearchEvents();
    }

    // --- Lógica de Búsqueda y Filtrado (Fase 4) ---
    function bindSearchEvents() {
      const searchInput = document.getElementById('aula-search-input');
      const levelSelect = document.getElementById('aula-filter-level');

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          applyFilters(e.target.value, levelSelect?.value);
        });
      }

      if (levelSelect) {
        levelSelect.addEventListener('change', (e) => {
          applyFilters(searchInput?.value, e.target.value);
        });
      }
    }

    function applyFilters(text = '', level = 'all') {
      if (!_studentState) return;

      const term = text.toLowerCase().trim();
      const lvl = level === 'all' ? '' : level;

      // Función helper de filtrado
      const filterFn = (c) => {
        const matchText = (c.title || '').toLowerCase().includes(term) || 
                          (c.description || '').toLowerCase().includes(term);
        const matchLevel = !lvl || (c.level === lvl);
        return matchText && matchLevel;
      };

      // Creamos un estado temporal filtrado
      const filteredState = {
        ..._studentState,
        recommended: _studentState.recommended.filter(filterFn),
        inProgress: _studentState.inProgress.filter(filterFn),
        completed: _studentState.completed.filter(filterFn)
      };

      // Actualizamos contador
      const total = filteredState.recommended.length + filteredState.inProgress.length + filteredState.completed.length;
      const countEl = document.getElementById('aula-result-count');
      if (countEl) countEl.textContent = term || lvl ? `${total} resultados` : 'Mostrando todo';

      // Re-renderizamos solo las listas (el Hero y Stats no cambian)
      // Nota: Usamos la misma función de renderizado pero con los datos filtrados
      renderStudentGridsOnly(filteredState);
    }

    function renderStudentGridsOnly(state) {
      const sections = [
        { id: 'aula-student-recommended', list: state.recommended, mode: 'recommended' },
        { id: 'aula-student-inprogress', list: state.inProgress, mode: 'inprogress' }, // Renderizamos todos los filtrados
        { id: 'aula-student-completed', list: state.completed, mode: 'completed' }
      ];

      // Ocultar Hero si hay búsqueda activa para no distraer (opcional, aquí lo mantenemos simple)
      // const hero = document.getElementById('aula-student-hero');
      // if(hero) hero.classList.toggle('d-none', isSearching);

      sections.forEach(({ id, list, mode }) => {
        const section = document.getElementById(id);
        if (!section) return;

        const grid = section.querySelector('[data-role="course-grid"]');
        const emptyMsg = section.querySelector('[data-role="empty-msg"]');
        
        // Si estamos filtrando y no hay resultados en esta sección, mostramos vacío
        if (!list.length) {
          if(grid) grid.innerHTML = '';
          if(emptyMsg) {
             emptyMsg.classList.remove('d-none');
             // Cambiamos mensaje si es búsqueda vs vacío original
             if(document.getElementById('aula-search-input')?.value) {
                 emptyMsg.innerHTML = '<i class="bi bi-search me-2"></i>No hay coincidencias.';
             }
          }
          section.classList.add('d-none'); // Ocultar sección completa si vacía al filtrar
          return;
        }
        
        section.classList.remove('d-none');
        if(emptyMsg) emptyMsg.classList.add('d-none');
        if(grid) grid.innerHTML = list.map(c => renderCourseCard(c, mode)).join('');
      });
      
      // Caso especial: Si la búsqueda filtra el curso que estaba en el Hero, 
      // el Hero sigue visible (estático). Para hacerlo dinámico se requiere más lógica,
      // pero para UX es mejor dejar el Hero fijo como "acceso rápido" independiente de la búsqueda.
    }

    function escapeHtml(str) {
      return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function renderStudentHome(root, state) {
      if (!root) return;

      const recommended = state.recommended || [];
      const inProgress = state.inProgress || [];
      const completed = state.completed || [];

      // 1. Renderizar Stats (Logros)
      const statsBar = document.getElementById('aula-stats-bar');
      if (statsBar) {
        const totalHours = completed.reduce((acc, c) => acc + (Number(c.hours) || 0), 0);
        statsBar.innerHTML = `
          <div class="aula-stat-pill">
            <div class="rounded-circle bg-success-subtle text-success p-2"><i class="bi bi-award-fill"></i></div>
            <div class="lh-1">
              <div class="h5 fw-bold mb-0">${completed.length}</div>
              <span class="text-muted" style="font-size:0.7rem;">Certificados</span>
            </div>
          </div>
          <div class="aula-stat-pill">
            <div class="rounded-circle bg-warning-subtle text-warning p-2"><i class="bi bi-lightning-charge-fill"></i></div>
            <div class="lh-1">
              <div class="h5 fw-bold mb-0">${inProgress.length}</div>
              <span class="text-muted" style="font-size:0.7rem;">En curso</span>
            </div>
          </div>
        `;
      }

      // 2. Renderizar Hero (Curso principal)
      const heroContainer = document.getElementById('aula-student-hero');
      const inProgressSection = document.getElementById('aula-student-inprogress');

      let heroCourse = null;
      let remainingInProgress = [];

      if (inProgress.length > 0) {
        // Tomamos el primero como Hero
        heroCourse = inProgress[0];
        remainingInProgress = inProgress.slice(1);

        if (heroContainer) {
          const pct = Math.round(heroCourse.progressPct || 0);
          heroContainer.innerHTML = `
            <div class="aula-hero-card d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
              <div style="max-width: 600px; position: relative; z-index: 2;">
                <span class="badge bg-white bg-opacity-25 border border-white border-opacity-25 mb-3">
                  <i class="bi bi-play-circle-fill me-1"></i> Reanudar aprendizaje
                </span>
                <h2 class="display-6 fw-bold mb-2">${esc(heroCourse.title)}</h2>
                <p class="text-white-50 mb-4 text-truncate">${esc(heroCourse.description)}</p>
                
                <div class="d-flex align-items-center gap-3">
                  <button class="btn btn-lg aula-hero-btn rounded-pill px-4 shadow-sm" 
                          data-action="aula-open-course" data-course-id="${heroCourse.id}">
                    Continuar <i class="bi bi-arrow-right ms-2"></i>
                  </button>
                  <div class="flex-grow-1" style="max-width: 200px;">
                    <div class="d-flex justify-content-between small text-white-50 mb-1">
                      <span>Progreso</span>
                      <span>${pct}%</span>
                    </div>
                    <div class="progress bg-white bg-opacity-25" style="height: 6px;">
                      <div class="progress-bar bg-white" style="width: ${pct}%"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="d-none d-md-block text-white opacity-50" style="font-size: 8rem; line-height: 0; z-index: 1;">
                <i class="bi bi-mortarboard-fill"></i>
              </div>
            </div>
          `;
          heroContainer.classList.remove('d-none');
        }
      } else {
        if (heroContainer) heroContainer.classList.add('d-none');
      }

      // 3. Renderizar Grids (Listas)
      const sections = [
        { id: 'aula-student-recommended', list: recommended, mode: 'recommended' },
        { id: 'aula-student-inprogress', list: remainingInProgress, mode: 'inprogress' }, // Solo los restantes
        { id: 'aula-student-completed', list: completed, mode: 'completed' }
      ];

      // Mostrar/Ocultar sección "Otros en curso" según si hay restantes
      if (inProgressSection) {
        if (remainingInProgress.length > 0) inProgressSection.classList.remove('d-none');
        else inProgressSection.classList.add('d-none');
      }

      sections.forEach(({ id, list, mode }) => {
        const section = root.querySelector('#' + id);
        if (!section) return;

        const grid = section.querySelector('[data-role="course-grid"]');
        const emptyMsg = section.querySelector('[data-role="empty-msg"]');
        if (!grid) return;

        if (!list.length) {
          grid.innerHTML = '';
          if (emptyMsg) emptyMsg.classList.remove('d-none');
          return;
        }

        if (emptyMsg) emptyMsg.classList.add('d-none');
        grid.innerHTML = list.map(c => renderCourseCard(c, mode)).join('');
      });
    }

    function buildCourseCard(course, context) {
      const pctRaw = typeof course.progressPct === 'number' ? course.progressPct : 0;
      const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));

      let badgeText = '';
      let badgeClass = 'text-bg-secondary';
      let primaryBtn = '';

      const hours = course.hours ? course.hours + ' h' : '';
      const level = course.level || '';
      let meta = '';
      if (hours && level) meta = hours + ' • ' + level;
      else if (hours) meta = hours;
      else if (level) meta = level;

      if (context === 'recommended') {
        badgeText = 'Disponible';
        primaryBtn =
          '<button type="button" class="btn btn-sm btn-primary" ' +
          'data-aula-action="enroll" ' +
          'data-course-id="' + course.id + '" ' +
          'data-course-title="' + escapeHtml(course.title || '') + '">' +
          'Inscribirme</button>';
      } else if (context === 'inprogress') {
        badgeText = 'En curso';
        badgeClass = 'text-bg-info';
        primaryBtn =
          '<button type="button" class="btn btn-sm btn-primary" ' +
          'data-aula-action="continue" ' +
          'data-course-id="' + course.id + '">' +
          'Continuar</button>';
      } else if (context === 'completed') {
        badgeText = 'Completado';
        badgeClass = 'text-bg-success';

        if (course.certificateFolio) {
          secondaryAction = `
    <button type="button"
            class="btn btn-sm btn-success w-100 mt-2"
            data-action="aula-ver-constancia"
            data-course-id="${course.id}"
            data-course-title="${esc(course.title || '')}"
            data-cert-id="${course.certificateFolio}">
      <i class="bi bi-award-fill me-1"></i> Ver constancia
    </button>`;
        }

      }

      const hasProgressBar = context === 'inprogress' || context === 'completed';
      const progressBar = hasProgressBar
        ? '<div class="mb-2">' +
        '<div class="progress" style="height:5px;">' +
        '<div class="progress-bar" role="progressbar" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="d-flex justify-content-between align-items-center mt-1 small text-muted">' +
        '<span>' + pct + '% completado</span>' +
        (meta ? '<span>' + meta + '</span>' : '') +
        '</div>' +
        '</div>'
        : '';

      const metaFallback = !hasProgressBar && meta
        ? '<p class="small text-muted mb-0">' + meta + '</p>'
        : '';

      return (
        '<div class="col">' +
        '<article class="card h-100 shadow-sm border-0">' +
        '<div class="card-body d-flex flex-column">' +
        '<div class="d-flex justify-content-between align-items-start mb-2">' +
        '<div>' +
        '<h3 class="card-title h6 mb-1">' + escapeHtml(course.title || '') + '</h3>' +
        '<p class="card-text text-muted small mb-1">' + escapeHtml(course.description || '') + '</p>' +
        metaFallback +
        '</div>' +
        '<span class="badge rounded-pill ' + badgeClass + ' ms-2">' + badgeText + '</span>' +
        '</div>' +
        progressBar +
        '<div class="mt-auto d-flex gap-2">' +
        primaryBtn +
        '</div>' +
        '</div>' +
        '</article>' +
        '</div>'
      );
    }



    function onStudentHomeClick(ev) {
      const btn = ev.target.closest('[data-aula-action]');
      if (!btn) return;

      const action = btn.dataset.aulaAction;
      const courseId = btn.dataset.courseId;
      if (!action || !courseId) return;

      if (action === 'enroll') {
        const titulo = btn.dataset.courseTitle || '';
        inscribirse(courseId, titulo);
      } else if (action === 'continue') {
        openCourseFromStudent(courseId);
      } else if (action === 'certificate') {
        const titulo = btn.dataset.courseTitle || '';
        verConstancia(courseId, titulo);
      }
    }

    function openCourseFromStudent(courseId) {
      if (!_ctx || !courseId) return;

      if (typeof _ctx.showView === 'function') {
        _ctx.showView('view-aula-course');
      }

      if (global.AulaContent && typeof global.AulaContent.initCourse === 'function') {
        global.AulaContent.initCourse(_ctx, courseId);
      }
    }

    // === Helpers de render para Aula Student ===
    function esc(str) {
      return String(str || '').replace(/[&<>"']/g, function (ch) {
        switch (ch) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          default: return ch;
        }
      });
    }

    function truncate(str, max) {
      const s = String(str || '').trim();
      if (s.length <= max) return s;
      return s.slice(0, max - 1) + '…';
    }

    function renderStudentHome(root, state) {
      if (!root) return;

      const sections = [
        { id: 'aula-student-recommended', list: state.recommended || [], mode: 'recommended' },
        { id: 'aula-student-inprogress', list: state.inProgress || [], mode: 'inprogress' },
        { id: 'aula-student-completed', list: state.completed || [], mode: 'completed' }
      ];

      sections.forEach(({ id, list, mode }) => {
        const section = root.querySelector('#' + id);
        if (!section) return;

        const grid = section.querySelector('[data-role="course-grid"]');
        const emptyMsg = section.querySelector('[data-role="empty-msg"]');
        if (!grid || !emptyMsg) return;

        if (!list.length) {
          grid.innerHTML = '';
          emptyMsg.classList.remove('d-none');
          return;
        }

        emptyMsg.classList.add('d-none');
        grid.innerHTML = list.map(c => renderCourseCard(c, mode)).join('');
      });
    }

    function renderCourseCard(course, mode) {
      const title = esc(course.title || '(Sin título)');
      const desc = truncate(course.description || 'Sin descripción.', 80); // Descripción más corta
      const hours = course.hours || course.duracionHoras || null;
      const pct = Math.max(0, Math.min(100, Number(course.progressPct || 0)));

      let actionBtn = '';
      let statusIcon = '';

      if (mode === 'recommended') {
        statusIcon = '<i class="bi bi-plus-circle text-primary"></i>';
        actionBtn = `
          <button class="btn btn-sm btn-light border text-primary w-100 fw-bold"
                  data-action="aula-enroll" data-course-id="${course.id}" data-course-title="${title}">
            Inscribirme
          </button>`;
      } else if (mode === 'inprogress') {
        statusIcon = '<i class="bi bi-play-circle text-info"></i>';
        actionBtn = `
          <button class="btn btn-sm btn-primary w-100 fw-bold"
                  data-action="aula-open-course" data-course-id="${course.id}">
            Continuar
          </button>`;
      } else if (mode === 'completed') {
        statusIcon = '<i class="bi bi-check-circle-fill text-success"></i>';
        actionBtn = `
           <button class="btn btn-sm btn-outline-success w-100 fw-bold"
                  data-action="aula-ver-constancia" data-course-id="${course.id}" 
                  data-course-title="${title}" data-cert-id="${course.certificateFolio}">
            <i class="bi bi-award"></i> Constancia
          </button>`;
      }

      // Progress bar condicional
      const progressHTML = (mode !== 'recommended')
        ? `<div class="mt-3">
             <div class="d-flex justify-content-between extra-small text-muted mb-1">
               <span>Avance</span>
               <span>${pct}%</span>
             </div>
             <div class="progress" style="height:4px;">
               <div class="progress-bar ${mode === 'completed' ? 'bg-success' : 'bg-primary'}" style="width:${pct}%"></div>
             </div>
           </div>`
        : `<div class="mt-3 extra-small text-muted">
             <i class="bi bi-clock me-1"></i> ${hours ? hours + 'h contenido' : 'Duración variable'}
           </div>`;

      return `
        <div class="col">
          <div class="course-card-minimal h-100">
            <div class="d-flex justify-content-between align-items-start mb-3">
               <div class="course-icon-box rounded-3 bg-surface-muted text-primary">
                 <i class="bi bi-mortarboard-fill"></i>
               </div>
               ${statusIcon}
            </div>
            
            <h5 class="fw-bold mb-1 text-truncate" title="${title}">${title}</h5>
            <p class="text-muted small mb-0 flex-grow-1" style="line-height: 1.4;">${desc}</p>
            
            ${progressHTML}

            <div class="mt-3 pt-3 border-top">
              ${actionBtn}
            </div>
          </div>
        </div>`;
    }

    // --- Eventos en home de Aula (estudiante) ---
    function bindStudentHomeEvents(root) {
      // Usamos el contenedor raíz del home
      wireOnce('aula-student-home', 'click', (ev) => {
        const btn = ev.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const courseId = btn.dataset.courseId || null;

        // 1) Inscribirse
        if (action === 'aula-enroll' && courseId) {
          ev.preventDefault();
          const titulo = btn.dataset.courseTitle || '';
          inscribirse(courseId, titulo);
          return;
        }


        // 2) Abrir curso (ver / continuar)
        if (action === 'aula-open-course' && courseId) {
          ev.preventDefault();

          // Preferimos usar el router global de app.js
          if (typeof global.SIA_navToCourse === 'function') {
            global.SIA_navToCourse(courseId);
            return;
          }

          // Fallback por si no existe SIA_navToCourse (muy raro)
          if (global.AulaContent && typeof global.AulaContent.initCourse === 'function') {
            global.AulaContent.initCourse(_ctx, courseId);

            // Mostrar manualmente la vista del curso
            const views = document.querySelectorAll('.app-view');
            views.forEach(v => v.classList.add('d-none'));
            const courseView = document.getElementById('view-aula-course');
            if (courseView) courseView.classList.remove('d-none');
          } else {
            console.warn('[Aula] No se encontró manejador para abrir curso', courseId);
          }

          return;
        }

        if (action === 'aula-leave-course' && courseId) {
          ev.preventDefault();
          const enrollmentId = btn.dataset.enrollmentId || '';
          if (!enrollmentId) return;
          abandonarCurso(enrollmentId, courseId);
          return;
        }


        // 3) Ver constancia (si existe)
        if (action === 'aula-ver-constancia' && courseId) {
          ev.preventDefault();
          const titulo = btn.dataset.courseTitle || '';
          verConstancia(courseId, titulo);
        }
      });
    }



    async function inscribirse(cursoId, cursoTitulo) {
      if (_ctx.currentUserProfile?.role !== 'student') {
        showToast('Los administradores no pueden inscribirse.', 'warning');
        return;
      }
      const uid = _ctx.auth.currentUser.uid;
      const email = _ctx.auth.currentUser.email;
      const exists = await _ctx.db.collection(INSC).where('studentId', '==', uid).where('cursoId', '==', cursoId).limit(1).get();
      if (!exists.empty) { showToast('Ya estás inscrito', 'info'); return; }
      await _ctx.db.collection(INSC).add({ studentId: uid, studentEmail: email, cursoId, cursoTitulo, fechaInscripcion: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('Inscripción exitosa', 'success');
      
      if(window.Notify) {
         window.Notify.send(uid, {
            title: 'Inscripción Exitosa',
            message: `Bienvenido al curso "${cursoTitulo}". ¡Comienza a aprender ahora!`,
            type: 'aula',
            link: `/aula/curso/${cursoId}`
         });
      }
      await initStudent(_ctx); // ⬅️ refrescar home de Aula Student

    }

    async function abandonarCurso(enrollmentId, courseId) {
      if (!confirm('¿Abandonar curso? Se borrará el progreso.')) return;

      const uid = _ctx.auth.currentUser.uid;

      try {
        await AulaService.removeStudent(_ctx, enrollmentId, uid, courseId);
        showToast('Has abandonado el curso', 'info');
        await initStudent(_ctx); // ⬅️ volver a cargar cursos del alumno
      } catch (e) {
        console.error(e);
        showToast('Error al abandonar', 'danger');
      }
    }


    // ===== ADMIN (FASE 3) =====
    function initAdmin(ctx) {
      const AulaService = global.AulaService;

      _ctx = ctx;
      const myUid = _ctx.auth.currentUser.uid;

      // Contenedores del Dashboard
      const listCursos = document.getElementById('aula-adm-cursos');
      const kpiAlumnos = document.getElementById('kpi-total-alumnos');
      const kpiTasa = document.getElementById('kpi-tasa-finalizacion');
      const kpiPromedio = document.getElementById('kpi-promedio-general');
      const feedContainer = document.getElementById('aula-admin-feed');

      let _currentAdminCourseId = null;
      let _unsubAdminLessons = null, _unsubAdminQuizzes = null;
      _adminCourseCache = []; // Limpiar caché al iniciar

      // --- Carga Asíncrona del Dashboard (KPIs y Feed) ---
      async function loadDashboard() {
        // Cargar KPIs
        try {
          const stats = await AulaService.getAdminDashboardStats(_ctx, myUid);
          if (kpiAlumnos) kpiAlumnos.textContent = stats.totalAlumnos;
          if (kpiTasa) kpiTasa.textContent = `${stats.tasaFinalizacion}%`;
          if (kpiPromedio) kpiPromedio.textContent = `${stats.promedioGeneral}%`;
        } catch (e) { console.error("Error KPIs", e); }

        // Cargar Feed
        try {
          const feed = await AulaService.getAdminActivityFeed(_ctx, myUid);
          if (feedContainer) {
            if (feed.length === 0) {
              feedContainer.innerHTML = '<div class="list-group-item text-center p-4 text-muted small">No hay actividad reciente.</div>';
            } else {
              feedContainer.innerHTML = feed.map(item => {
                const icon = item.type === 'insc' ? 'bi-person-plus-fill text-primary' : 'bi-file-earmark-check-fill text-info';
                return `<div class="list-group-item d-flex gap-3 py-3">
                    <i class="bi ${icon} fs-5 mt-1"></i>
                    <div class="small">${item.text} <br><span class="text-muted" style="font-size: 0.8em;">${item.date.toLocaleString()}</span></div>
                  </div>`;
              }).join('');
            }
          }
        } catch (e) { console.error("Error Feed", e); }
      }
      loadDashboard(); // Ejecutar al inicio

      // --- Carga de "Mis Cursos" (Suscripción) ---
      const uCursos = _ctx.db.collection(CURS).where('creadoPor', '==', myUid).orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
          _adminCourseCache = snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo }));
          renderAdminTable(snap.docs);
          updateReportDropdown(); // Actualizar el <select> de reportes
        });
      _ctx.activeUnsubs.push(uCursos);

      function renderAdminTable(docs) {
        if (!listCursos) return;
        if (docs.length === 0) {
          listCursos.innerHTML = `
              <div class="text-center p-4 text-muted">
                <i class="bi bi-folder2-open mb-2 d-block fs-4"></i>
                No has creado cursos aún.
              </div>`;
          return;
        }

        listCursos.innerHTML = `
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Título</th>
                  <th>Público</th>
                  <th>Estado</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${docs.map(d => {
          const c = d.data();
          const publicoRaw = c.publico || 'todos';
          const publicoLabel = (() => {
            switch (publicoRaw) {
              case 'estudiantes': return 'Estudiantes';
              case 'docentes': return 'Docentes';
              case 'estudiantes_docentes': return 'Estudiantes y Docentes';
              default: return 'Todos';
            }
          })();

          const published = c.publicado !== false; // por defecto true
          const estadoBadge = published
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle">Publicado</span>'
            : '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Borrador</span>';

          const toggleLabel = published ? 'Ocultar' : 'Publicar';

          return `
                    <tr>
                      <td>${c.titulo || '(Sin título)'}</td>
                      <td>${publicoLabel}</td>
                      <td>${estadoBadge}</td>
                      <td class="text-end">
                        <div class="btn-group">
                          <button class="btn btn-outline-secondary btn-sm"
                                  title="${toggleLabel}"
                                  onclick="Aula.toggleCursoPublicado('${d.id}', ${published})">
                            <i class="bi ${published ? 'bi-eye-slash' : 'bi-eye'}"></i>
                          </button>
                          <button class="btn btn-outline-info btn-sm"
                                  title="Alumnos"
                                  onclick="Aula.openStudentsModal('${d.id}', '${(c.titulo || '').replace(/'/g, "\\'")}')">
                            <i class="bi bi-people"></i>
                          </button>
                          <button class="btn btn-outline-primary btn-sm"
                                  title="Editar contenido"
                                  onclick="Aula.openContentModal('${d.id}')">
                            <i class="bi bi-pencil-square"></i>
                          </button>
                          <button class="btn btn-outline-danger btn-sm"
                                  title="Borrar curso"
                                  onclick="Aula.eliminarCurso('${d.id}')">
                            <i class="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>`;
        }).join('')}
              </tbody>
            </table>`;
      }


      // --- Accesos Rápidos (Fase 3) ---
      wireOnce('btn-quick-create-course', 'click', (e) => {
        e.preventDefault();
        openCourseModal(null); // nuevo modal de curso
      });

      wireOnce('btn-quick-aviso', 'click', (e) => {
        e.preventDefault();
        const modalEl = document.getElementById('modalAulaAdmAviso');
        if (!modalEl || typeof bootstrap === 'undefined') return;

        const txt = document.getElementById('adm-aviso-text');
        const tipoSel = document.getElementById('adm-aviso-tipo');
        const durSel = document.getElementById('adm-aviso-duracion');
        if (txt) txt.value = '';
        if (tipoSel) tipoSel.value = 'aviso';
        if (durSel) durSel.value = '1440';

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      });

      // FAB de crear curso
      const fabAddCourse = document.getElementById('aula-add-course-fab');
      fabAddCourse?.addEventListener('click', (e) => {
        e.preventDefault();
        openCourseModal(null);
      });



      // --- Generador de Reportes (Fase 3) ---
      const reportForm = document.getElementById('aula-admin-report-form');
      const reportTypeSelect = document.getElementById('report-type-select');
      const reportCursoGroup = document.getElementById('report-curso-select-group');
      const reportCursoSelect = document.getElementById('report-curso-select');

      function updateReportDropdown() {
        if (!reportCursoSelect) return;
        reportCursoSelect.innerHTML = '<option value="">Todos mis cursos</option>' +
          _adminCourseCache.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
      }

      reportTypeSelect?.addEventListener('change', (e) => {
        const showCursoSelect = e.target.value === 'calificaciones_curso';
        reportCursoGroup?.classList.toggle('d-none', !showCursoSelect);
      });

      reportForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generando...';

        const type = reportTypeSelect.value;
        const cursoId = (type === 'calificaciones_curso') ? reportCursoSelect.value : null;

        try {
          const data = await AulaService.generateReportData(_ctx, myUid, type, cursoId || undefined);
          if (data.length === 0) {
            showToast('No se encontraron datos para este reporte', 'info');
          } else {
            // Usamos el helper global que definiremos fuera de esta función
            Aula.downloadCSV(data, `${type}_${cursoId || 'global'}.csv`);
          }
        } catch (err) {
          console.error("Error generando reporte", err);
          showToast('Error al generar el reporte', 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-download me-1"></i> Generar y Descargar (CSV)';
        }
      });

      // --- Gestión de Avisos (Fase 1 - Sin cambios) ---
      const listAvisos = document.getElementById('aula-adm-avisos-list');
      const uAvisos = AulaService.streamAvisos(_ctx, (snap) => {
        if (!listAvisos) return;
        if (snap.empty) {
          listAvisos.innerHTML = `
              <div class="p-3 text-muted small text-center">
                <i class="bi bi-bell-slash mb-2 d-block fs-5"></i>
                Sin avisos publicados.
              </div>`;
          return;
        }

        listAvisos.innerHTML = snap.docs.map(d => {
          const a = d.data();
          const createdAt = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : null;
          const hasta = a.activaHasta && a.activaHasta.toDate ? a.activaHasta.toDate() : null;
          const tipo = a.tipo || 'aviso';

          const dateStr = createdAt ? createdAt.toLocaleDateString() : 'Reciente';
          const expStr = hasta ? `Hasta ${hasta.toLocaleDateString()}` : 'Sin fecha de término';

          const badgeClass =
            tipo === 'urgente'
              ? 'badge bg-danger-subtle text-danger border border-danger-subtle'
              : tipo === 'recomendacion'
                ? 'badge bg-success-subtle text-success border border-success-subtle'
                : 'badge bg-light text-dark border';

          const label =
            tipo === 'urgente'
              ? 'Urgente'
              : tipo === 'recomendacion'
                ? 'Recomendación'
                : 'Aviso';

          return `
              <div class="list-group-item d-flex justify-content-between align-items-start p-2 small">
                <div class="me-3">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="${badgeClass}">${label}</span>
                    <span class="text-muted">${dateStr}</span>
                  </div>
                  <div class="lh-sm">${a.texto || ''}</div>
                  <div class="text-muted mt-1" style="font-size: .75rem;">${expStr}</div>
                </div>
                <button class="btn btn-sm text-danger p-0 ms-2"
                        title="Eliminar aviso"
                        onclick="Aula.borrarAviso('${d.id}')">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>`;
        }).join('');
      });
      _ctx.activeUnsubs.push(uAvisos);


      wireOnce('aula-adm-avisos-form', 'submit', async (e) => {
        e.preventDefault();
        const inp = document.getElementById('aula-adm-aviso-input');
        const txt = inp.value.trim();
        if (!txt) return;
        try { await AulaService.addAviso(_ctx, txt); showToast('Aviso publicado', 'success'); inp.value = ''; }
        catch (err) { showToast('Error', 'danger'); }
      });

      // Formulario del modal "Publicar aviso"
      wireOnce('aula-adm-aviso-modal-form', 'submit', async (e) => {
        e.preventDefault();
        const modalEl = document.getElementById('modalAulaAdmAviso');
        const txtEl = document.getElementById('adm-aviso-text');
        const tipoSel = document.getElementById('adm-aviso-tipo');
        const durSel = document.getElementById('adm-aviso-duracion');

        const mensaje = txtEl?.value.trim() || '';
        if (!mensaje) {
          showToast('Escribe un mensaje para el aviso.', 'warning');
          return;
        }

        const tipo = tipoSel?.value || 'aviso';
        const durMin = parseInt(durSel?.value || '0', 10) || 0;

        let prioridad = 2;
        if (tipo === 'urgente') prioridad = 1;
        else if (tipo === 'recomendacion') prioridad = 3;

        try {
          await AulaService.addAviso(_ctx, mensaje, {
            tipo,
            prioridad,
            modulo: 'global',
            duracionMin: durMin
          });
          showToast('Aviso publicado', 'success');
          if (modalEl && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getInstance(modalEl)?.hide();
          }
        } catch (err) {
          console.error('Error publicando aviso', err);
          showToast('Error al publicar el aviso', 'danger');
        }
      });

      // Formulario "Crear / editar curso"
      wireOnce('aula-course-form', 'submit', async (e) => {
        e.preventDefault();

        const form = e.target; // el <form id="aula-course-form">
        const idEl = form.querySelector('#aula-course-id');
        const titleEl = form.querySelector('#aula-course-title');
        const descEl = form.querySelector('#aula-course-desc');
        const hoursEl = form.querySelector('#aula-course-hours');
        const modalEl = document.getElementById('modalAulaCourse');

        if (!titleEl) {
          console.error('No se encontró #aula-course-title dentro del formulario');
          showToast('Error interno al leer el título.', 'danger');
          return;
        }

        const titulo = (titleEl.value || '').trim();
        const descripcion = (descEl?.value || '').trim();
        const horas = parseInt(hoursEl?.value || '1', 10) || 1;

        if (!titulo) {
          showToast('El curso debe tener un título.', 'warning');
          return;
        }

        const user = _ctx.auth.currentUser;
        if (!user) {
          showToast('Sesión no válida.', 'danger');
          return;
        }

        // === NUEVO: calcular "publico" a partir de los checkboxes ===
        const checked = form.querySelectorAll('#course-publico-group .course-publico-chk:checked');
        const values = Array.from(checked).map(el => el.value);

        let publico;
        if (values.length === 0) {
          publico = 'todos';
        } else if (values.includes('todos') || values.length > 1) {
          publico = 'todos';
        } else {
          publico = values[0];
        }

        const ahora = firebase.firestore.FieldValue.serverTimestamp();
        const baseData = {
          titulo,
          descripcion,
          duracionHoras: horas,
          publico,
        };

        try {
          if (!idEl.value) {
            // Crear curso nuevo
            await _ctx.db.collection(CURS).add({
              ...baseData,
              creadoPor: user.uid,
              creadoEmail: user.email || null,
              createdAt: ahora,
              updatedAt: ahora,
              publicado: true
            });
            showToast('Curso creado correctamente', 'success');
          } else {
            // Actualizar metadatos (posible uso futuro)
            await _ctx.db.collection(CURS).doc(idEl.value).update({
              ...baseData,
              updatedAt: ahora
            });
            showToast('Curso actualizado', 'success');
          }

        } catch (err) {
          console.error('Error guardando curso', err);
          showToast('No se pudo guardar el curso', 'danger');
        } finally {
          if (modalEl && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getInstance(modalEl)?.hide();
          }
        }
      });





      // --- Gestión de Contenido (Modals - Fase 2 - Sin cambios) ---
      const selCurso = document.getElementById('ac-curso-select');
      selCurso?.addEventListener('change', (e) => { loadAdminLessons(e.target.value); loadAdminQuizzes(e.target.value); });

      function loadAdminLessons(courseId) {
        _currentAdminCourseId = courseId;
        const host = document.getElementById('ac-lessons-list');
        resetLessonForm();
        if (_unsubAdminLessons) _unsubAdminLessons();
        if (!courseId) { if (host) host.innerHTML = '<div class="p-3 text-muted">Selecciona un curso.</div>'; return; }
        _unsubAdminLessons = AulaService.streamLessons(_ctx, courseId, snap => {
          if (!host) return;
          if (snap.empty) { host.innerHTML = '<div class="p-3 text-muted small">Sin lecciones aún.</div>'; return; }
          host.innerHTML = snap.docs.map(d => {
            const l = d.data(); const safeRes = encodeURIComponent(l.resource || '');
            return `<div class="list-group-item d-flex justify-content-between align-items-center"><div><span class="badge bg-secondary me-2">#${l.order}</span><span class="fw-semibold">${l.title}</span></div><div><button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="Aula.editLesson('${d.id}', '${l.title.replace(/'/g, "\\'")}', ${l.order}, '${encodeURIComponent(l.html || '')}', '${safeRes}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="Aula.deleteLesson('${d.id}')"><i class="bi bi-trash"></i></button></div></div>`;
          }).join('');
        }, err => console.error(err));
      }

      wireOnce('ac-save-lesson', 'click', async () => {
        if (!_currentAdminCourseId) return showToast('Selecciona un curso', 'warning');
        const lid = document.getElementById('ac-lesson-id').value;
        const data = { title: document.getElementById('ac-lesson-title').value.trim(), order: Number(document.getElementById('ac-lesson-order').value) || 1, text: document.getElementById('ac-lesson-text').value.trim(), resource: document.getElementById('ac-lesson-resource').value.trim() };
        data.html = data.text ? `<div class="prose"><p>${data.text.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>` : '';
        try { if (lid) await AulaService.updateLesson(_ctx, _currentAdminCourseId, lid, data); else await AulaService.addLesson(_ctx, _currentAdminCourseId, data); showToast('Lección guardada', 'success'); resetLessonForm(); }
        catch (e) { console.error(e); showToast('Error', 'danger'); }
      });

      wireOnce('ac-btn-cancel-edit', 'click', resetLessonForm);
      function resetLessonForm() { document.getElementById('ac-lesson-form').reset(); document.getElementById('ac-lesson-id').value = ''; document.getElementById('ac-lesson-resource').value = ''; document.getElementById('ac-btn-cancel-edit')?.classList.add('d-none'); }

      function loadAdminQuizzes(courseId) {
        const host = document.getElementById('ac-quizzes-list');
        resetQuizForm(); if (_unsubAdminQuizzes) _unsubAdminQuizzes();
        if (!courseId) { if (host) host.innerHTML = '<div class="p-3 text-muted">Selecciona un curso.</div>'; return; }
        _unsubAdminQuizzes = AulaService.streamQuizzes(_ctx, courseId, snap => {
          if (!host) return; if (snap.empty) { host.innerHTML = '<div class="p-3 text-muted small">Sin evaluaciones.</div>'; return; }
          host.innerHTML = snap.docs.map(d => {
            const q = d.data(); const safeJson = encodeURIComponent(JSON.stringify(q));
            return `<div class="list-group-item d-flex justify-content-between align-items-center p-2"><div><span class="fw-bold">${q.title}</span> <span class="badge bg-light text-dark border ms-2">${q.timeLimit || '∞'} min</span> <span class="badge bg-light text-dark border">${q.maxAttempts || 3} intentos</span></div><div><button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="Aula.editQuiz('${d.id}', '${safeJson}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="Aula.deleteQuiz('${d.id}')"><i class="bi bi-trash"></i></button></div></div>`;
          }).join('');
        });
      }

      wireOnce('ac-quiz-add', 'click', () => addQuizCard());
      function addQuizCard(data = null) {
        const host = document.getElementById('ac-quiz-items'); const idx = host.children.length;
        const enunciado = data ? data.enunciado : ''; const correcta = data ? data.correctaIndex : 0; const opts = data ? data.opciones : ['', '', '', ''];
        host.insertAdjacentHTML('beforeend', `<div class="card border-0 shadow-sm mb-2" id="qcard-${idx}"><div class="card-body position-relative"><button type="button" class="btn-close position-absolute top-0 end-0 m-2" onclick="this.closest('.card').remove()"></button><div class="mb-2"><label class="form-label small fw-bold">Enunciado</label><input class="form-control form-control-sm q-text" value="${enunciado.replace(/"/g, '&quot;')}"></div><div class="row g-2">${['A', 'B', 'C', 'D'].map((lbl, j) => `<div class="col-md-6"><div class="input-group input-group-sm"><div class="input-group-text"><input class="form-check-input mt-0 q-ok" type="radio" name="q${idx}-ok" value="${j}" ${Number(correcta) === j ? 'checked' : ''}></div><input class="form-control q-opt" placeholder="Opción ${lbl}" value="${opts[j].replace(/"/g, '&quot;')}"></div></div>`).join('')}</div></div></div>`);
      }

      wireOnce('ac-save-quiz', 'click', async () => {
        const courseId = document.getElementById('ac-curso-select').value; if (!courseId) return showToast('Selecciona un curso', 'warning');
        const qid = document.getElementById('ac-quiz-id').value;
        const items = [...document.getElementById('ac-quiz-items').children].map((card, i) => {
          const enunciado = card.querySelector('.q-text')?.value?.trim() || ''; const opciones = [...card.querySelectorAll('.q-opt')].map(inp => inp.value.trim()); const okEl = card.querySelector('.q-ok:checked'); const correctaIndex = okEl ? Number(okEl.value) : 0; return { enunciado, opciones, correctaIndex };
        }).filter(q => q.enunciado && q.opciones.some(o => o));
        if (items.length === 0) return showToast('Agrega preguntas válidas', 'warning');

        const quizData = {
          title: document.getElementById('ac-quiz-title').value.trim() || 'Quiz',
          minScore: Number(document.getElementById('ac-quiz-min').value) || 70,
          timeLimit: Number(document.getElementById('ac-quiz-time').value) || 0,
          maxAttempts: Number(document.getElementById('ac-quiz-tries').value) || 3,
          items
        };
        try { if (qid) await AulaService.updateQuiz(_ctx, courseId, qid, quizData); else await AulaService.addQuiz(_ctx, courseId, quizData); showToast('Quiz guardado', 'success'); resetQuizForm(); }
        catch (e) { console.error(e); showToast('Error', 'danger'); }
      });

      wireOnce('ac-btn-cancel-quiz', 'click', resetQuizForm);
      function resetQuizForm() { document.getElementById('ac-quiz-form').reset(); document.getElementById('ac-quiz-id').value = ''; document.getElementById('ac-quiz-items').innerHTML = ''; document.getElementById('ac-btn-cancel-quiz')?.classList.add('d-none'); }
    } // --- Fin de initAdmin ---

    // --- Modal de Curso (alta / edición básica) ---
    function openCourseModal(courseId) {
      const modalEl = document.getElementById('modalAulaCourse');
      if (!modalEl || typeof bootstrap === 'undefined') return;
      const publicoChecks = document.querySelectorAll('#course-publico-group .course-publico-chk');
      publicoChecks.forEach(chk => {
        chk.checked = (chk.value === 'todos');
      });
      const idEl = document.getElementById('aula-course-id');
      const titleEl = document.getElementById('aula-course-title');
      const descEl = document.getElementById('aula-course-desc');
      const hoursEl = document.getElementById('aula-course-hours');
      const publicoEl = document.getElementById('aula-course-publico');
      const titleModal = document.getElementById('aula-course-modal-title');

      if (idEl) idEl.value = courseId || '';

      // Por ahora sólo soportamos "nuevo curso" desde los accesos rápidos.
      // Si en el futuro queremos editar metadatos, aquí podríamos cargar el curso por ID.
      if (!courseId) {
        if (titleModal) titleModal.innerHTML = '<i class="bi bi-journal-plus me-2"></i> Crear curso';
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        if (hoursEl) hoursEl.value = '1';
        if (publicoEl) publicoEl.value = 'todos';
      }

      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    // --- Helpers Globales (Exportados) ---
    async function openContentModal(courseId) {
      // Llenamos el dropdown con el caché que ya tenemos
      const sel = document.getElementById('ac-curso-select');
      if (sel) {
        sel.innerHTML = '<option value="">Selecciona curso...</option>' +
          _adminCourseCache.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
      }
      // Si se pasó un ID (para editar), lo seleccionamos
      if (courseId && sel) {
        sel.value = courseId;
        sel.dispatchEvent(new Event('change')); // Disparamos el 'change' para cargar lecciones/quizzes
      }
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAulaContent')).show();
    }

    function editLesson(id, t, o, h, r) {
      document.getElementById('ac-lesson-id').value = id;
      document.getElementById('ac-lesson-title').value = t;
      document.getElementById('ac-lesson-order').value = o;
      document.getElementById('ac-lesson-resource').value = decodeURIComponent(r || '');
      const div = document.createElement('div'); div.innerHTML = decodeURIComponent(h);
      document.getElementById('ac-lesson-text').value = (div.innerText || div.textContent || "").trim();
      const btn = document.getElementById('ac-save-lesson'); btn.textContent = 'Actualizar lección'; btn.classList.replace('btn-success', 'btn-primary');
      document.getElementById('ac-btn-cancel-edit').classList.remove('d-none');
    }

    function editQuiz(id, json) {
      const q = JSON.parse(decodeURIComponent(json));
      document.getElementById('ac-quiz-id').value = id;
      document.getElementById('ac-quiz-title').value = q.title;
      document.getElementById('ac-quiz-min').value = q.minScore || 70;
      document.getElementById('ac-quiz-time').value = q.timeLimit || 20;
      document.getElementById('ac-quiz-tries').value = q.maxAttempts || 3;

      const host = document.getElementById('ac-quiz-items');
      host.innerHTML = '';
      (q.items || []).forEach((item, idx) => { // Re-usamos la lógica local de addQuizCard
        const en = item.enunciado; const op = item.opciones; const co = item.correctaIndex;
        host.insertAdjacentHTML('beforeend', `<div class="card border-0 shadow-sm mb-2" id="qcard-${idx}"><div class="card-body position-relative"><button type="button" class="btn-close position-absolute top-0 end-0 m-2" onclick="this.closest('.card').remove()"></button><div class="mb-2"><label class="form-label small fw-bold">Enunciado</label><input class="form-control form-control-sm q-text" value="${en.replace(/"/g, '&quot;')}"></div><div class="row g-2">${['A', 'B', 'C', 'D'].map((lbl, j) => `<div class="col-md-6"><div class="input-group input-group-sm"><div class="input-group-text"><input class="form-check-input mt-0 q-ok" type="radio" name="q${idx}-ok" value="${j}" ${Number(co) === j ? 'checked' : ''}></div><input class="form-control q-opt" placeholder="Opción ${lbl}" value="${opts[j].replace(/"/g, '&quot;')}"></div></div>`).join('')}</div></div></div>`);
      });

      const btn = document.getElementById('ac-save-quiz');
      btn.textContent = 'Actualizar quiz';
      btn.classList.replace('btn-success', 'btn-primary');
      document.getElementById('ac-btn-cancel-quiz').classList.remove('d-none');
    }

    async function deleteQuiz(id) { if (!confirm('¿Eliminar?')) return; const sel = document.getElementById('ac-curso-select'); try { await AulaService.deleteQuiz(_ctx, sel.value, id); showToast('Eliminado', 'info'); } catch (e) { showToast('Error', 'danger'); } }
    async function deleteLesson(id) { if (!confirm('¿Eliminar?')) return; const sel = document.getElementById('ac-curso-select'); try { await AulaService.deleteLesson(_ctx, sel.value, id); showToast('Eliminado', 'info'); } catch (e) { showToast('Error', 'danger'); } }
    async function eliminarCurso(id) {
      if (!confirm('¿Eliminar curso? Esta acción no se puede deshacer.')) return;

      try {
        // Verificamos si tiene alumnos inscritos
        const inscSnap = await _ctx.db.collection(INSC)
          .where('cursoId', '==', id)
          .limit(1)
          .get();

        if (!inscSnap.empty) {
          showToast('Este curso tiene alumnos inscritos. No se puede eliminar.', 'warning');
          return;
        }

        await _ctx.db.collection(CURS).doc(id).delete();
        showToast('Curso eliminado', 'success');
      } catch (e) {
        console.error('Error eliminando curso', e);
        showToast('Error al eliminar el curso', 'danger');
      }
    }
    async function toggleCursoPublicado(id, currentValue) {
      try {
        const nuevo = !currentValue;
        await _ctx.db.collection(CURS).doc(id).update({ publicado: nuevo });
        showToast(nuevo ? 'Curso publicado' : 'Curso marcado como borrador', 'info');
      } catch (e) {
        console.error('Error cambiando estado de publicación', e);
        showToast('No se pudo cambiar el estado del curso', 'danger');
      }
    }

    async function borrarAviso(id) { if (!confirm('¿Eliminar aviso?')) return; try { await AulaService.deleteAviso(_ctx, id); showToast('Aviso eliminado', 'info'); } catch (e) { showToast('Error', 'danger'); } }

    // ===== CONSTANCIA =====
    // ===== CONSTANCIA =====
    async function verConstancia(cursoId, cursoTituloRaw) {
      if (!_ctx || !_ctx.auth || !_ctx.db) {
        showToast('No se pudo generar la constancia (contexto inválido).', 'danger');
        return;
      }

      const user = _ctx.auth.currentUser;
      if (!user) {
        showToast('Debes iniciar sesión para ver la constancia.', 'warning');
        return;
      }

      // Helper para escapar HTML en cadenas dinámicas
      function esc(str) {
        return String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      try {
        showToast('Generando constancia...', 'info');

        const uid = user.uid;
        let cursoTitulo = cursoTituloRaw || '';
        const alumnoName =
          _ctx.currentUserProfile?.displayName ||
          user.displayName ||
          user.email ||
          'Alumno/a';

        const campus = 'TecNM Campus Los Cabos';
        const proyecto = 'Sistema de Integración Académico (SIA)';

        // 1) Intentar obtener certificado ya emitido
        let cert = await AulaService.getCertificate(_ctx, uid, cursoId);

        // Valores por defecto (borrador)
        let folio = 'BORRADOR';   // Texto que se muestra
        let folioId = null;         // ID real del doc (si existe)
        let issuedDate = new Date();
        let score = '—';
        let horas = null;
        let matricula = _ctx.currentUserProfile?.matricula || '';

        if (cert) {
          // Tomamos como folio principal el ID del documento (case-sensitive)
          folioId = (cert.id || cert.folio || '').toString();

          if (folioId) {
            folio = folioId;

            // Guardamos alias auxiliares (NO cambian lo que se muestra)
            try {
              await _ctx.db
                .collection('aula-certificados')
                .doc(folioId)
                .set(
                  {
                    folio: folioId,
                    folioUpper: folioId.toUpperCase()
                  },
                  { merge: true }
                );
            } catch (e) {
              console.warn('No se pudo actualizar folio/folioUpper en el certificado:', e);
            }
          }

          if (cert.issuedAt && typeof cert.issuedAt.toDate === 'function') {
            issuedDate = cert.issuedAt.toDate();
          }
          if (typeof cert.score !== 'undefined' && cert.score !== null) {
            score = cert.score;
          }
          if (cert.horas || cert.duracionHoras) {
            horas = cert.horas || cert.duracionHoras;
          }
          if (cert.matricula) {
            matricula = cert.matricula;
          }
        }

        // Si el certificado aún no tiene calificación,
        // intentamos obtener el MEJOR intento registrado del quiz
        if (score === '—') {
          try {
            const quiz = await AulaService.getFirstQuiz(_ctx, cursoId);
            if (quiz) {
              const attempts = await AulaService.getAttempts(_ctx, uid, cursoId, quiz.id);
              if (attempts.length) {
                const bestScore = attempts.reduce(
                  (max, a) => Math.max(max, a.score || 0),
                  0
                );
                if (bestScore > 0) {
                  score = bestScore;
                }
              }
            }
          } catch (e) {
            console.warn('No se pudo calcular la calificación para la constancia', e);
          }
        }


        // 2) Completar datos del curso desde Firestore
        try {
          const cursoSnap = await _ctx.db.collection('aula-cursos').doc(cursoId).get();
          if (cursoSnap.exists) {
            const cdata = cursoSnap.data();
            if (!cursoTitulo && cdata.titulo) cursoTitulo = cdata.titulo;
            if (!horas && cdata.duracionHoras) horas = cdata.duracionHoras;
          }
        } catch (e) {
          console.warn('No se pudo complementar datos del curso para la constancia', e);
        }

        const horasStr = horas ? `${horas} hora${horas === 1 ? '' : 's'}` : '—';
        const fechaStr = issuedDate.toLocaleDateString('es-MX');

        // 3) Construir URL del QR
        const isDraft = !cert || !folioId;

        const qrData = isDraft
          ? 'https://sia-tecnm.web.app/verify/BORRADOR'
          : `https://sia-tecnm.web.app/verify/${encodeURIComponent(folioId)}`;

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
          qrData
        )}`;

        // 4) HTML de la constancia
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Constancia - ${esc(cursoTitulo)}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    /* (el mismo CSS que ya tenías) */
    body {
      background: #f0f2f5;
      margin: 0;
      padding: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .diploma {
      background: #ffffff;
      width: 960px;
      max-width: 100%;
      padding: 48px 56px;
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
      position: relative;
      overflow: hidden;
    }
    .diploma::before {
      content: "";
      position: absolute;
      inset: 16px;
      border-radius: 20px;
      border: 2px solid rgba(15, 23, 42, 0.06);
      pointer-events: none;
    }
    .brand-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    .brand-title {
      font-size: 0.85rem;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .badge-folio {
      font-size: 0.75rem;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.5);
      color: #475569;
      background: rgba(248, 250, 252, 0.85);
      backdrop-filter: blur(6px);
    }
    .title-main {
      font-size: 2.25rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-bottom: .5rem;
    }
    .subtitle {
      text-align: center;
      color: #64748b;
      font-size: 0.95rem;
      margin-bottom: 2.5rem;
    }
    .student-name {
      font-size: 2rem;
      text-align: center;
      font-weight: 700;
      color: #0f172a;
      padding-bottom: .4rem;
      border-bottom: 2px solid #e5e7eb;
      display: inline-block;
      margin: 0 auto 0.5rem;
    }
    .student-block {
      text-align: center;
      margin-bottom: 2.25rem;
    }
    .student-meta {
      font-size: .9rem;
      color: #94a3b8;
    }
    .course-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: .25rem;
    }
    .course-meta {
      font-size: 0.9rem;
      color: #64748b;
      margin-bottom: 1rem;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: 0.25rem 0.8rem;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: #475569;
      background: #f8fafc;
    }
    .grid-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.5rem;
      margin: 2rem 0 2.5rem;
      font-size: 0.9rem;
      color: #0f172a;
    }
    .meta-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: .14em;
      color: #94a3b8;
      margin-bottom: 0.35rem;
    }
    .meta-value {
      font-weight: 600;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 2rem;
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: #64748b;
    }
    .sign-block {
      text-align: center;
      min-width: 220px;
    }
    .sign-line {
      border-top: 1px solid #e2e8f0;
      margin-bottom: 0.25rem;
    }
    .qr-block {
      text-align: center;
    }
    .qr-block img {
      border-radius: 12px;
      border: 3px solid #e5e7eb;
      background: white;
      padding: 4px;
    }
    .draft-badge {
      position: absolute;
      inset: auto auto 32px 32px;
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .25rem .75rem;
      border-radius: 999px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: .16em;
      background: rgba(248, 250, 252, 0.9);
      color: #f97316;
      border: 1px dashed rgba(249, 115, 22, 0.4);
    }
  </style>
</head>
<body>
  <div class="diploma">
    <div class="brand-bar">
      <div>
        <div class="brand-title">Sistema de Integración Académico</div>
        <div class="text-muted small">${esc(campus)}</div>
      </div>
      <div class="badge-folio">
        Folio: <strong>${esc(folio)}</strong>
      </div>
    </div>

    <h1 class="title-main">Constancia</h1>
    <p class="subtitle">
      Por medio de la presente se hace constar que la persona que se indica ha completado satisfactoriamente
      el siguiente curso de formación académica:
    </p>

    <div class="student-block">
      <div class="student-name">${esc(alumnoName)}</div>
      <div class="student-meta">
        ${matricula ? `Matrícula ${esc(matricula)} · ` : ''}${esc(campus)}
      </div>
    </div>

    <div class="text-center mb-3">
      <div class="course-title">${esc(cursoTitulo) || '(Curso sin título)'}</div>
      <div class="course-meta">
        Otorgado a través de ${esc(proyecto)}.
      </div>
      <span class="pill">
        Promedio final:
        <strong>${esc(score)}</strong>
      </span>
    </div>

    <div class="grid-meta">
      <div>
        <div class="meta-label">Duración estimada del curso</div>
        <div class="meta-value">${esc(horasStr)}</div>
      </div>
      <div>
        <div class="meta-label">Fecha de emisión</div>
        <div class="meta-value">${esc(fechaStr)}</div>
      </div>
      <div>
        <div class="meta-label">Verificación</div>
        <div class="meta-value">Escaneando el código QR o en línea</div>
      </div>
    </div>

    <div class="footer-row">
      <div class="qr-block">
        <img src="${qrUrl}" alt="QR Verificación">
        <div class="mt-2">
          <div class="small">Verificar en:</div>
          <div class="small text-primary">
            sia-tecnm.web.app/verify/${esc(folio)}
          </div>
        </div>
      </div>

      <div class="sign-block">
        <div class="sign-line"></div>
        <div class="fw-semibold">Coordinación de SIA</div>
        <div class="text-muted">TecNM Campus Los Cabos</div>
      </div>
    </div>

    ${isDraft ? `
    <div class="draft-badge">
      <span>Estado: Borrador (no verificable)</span>
    </div>` : ''}

  </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err) {
        console.error('Error generando constancia', err);
        showToast('No se pudo generar la constancia.', 'danger');
      }
    }






    async function openStudentsModal(cid, tit) { const m = new bootstrap.Modal(document.getElementById('modalAulaStudents')); document.getElementById('aula-students-course-title').textContent = tit; const lst = document.getElementById('aula-students-list'); const ldg = document.getElementById('aula-students-loading'); const emp = document.getElementById('aula-students-empty'); const tbl = document.getElementById('aula-students-table'); lst.innerHTML = ''; ldg.classList.remove('d-none'); emp.classList.add('d-none'); tbl.classList.add('d-none'); m.show(); try { const s = await AulaService.getCourseStudents(_ctx, cid); ldg.classList.add('d-none'); if (s.length === 0) { emp.classList.remove('d-none'); return; } tbl.classList.remove('d-none'); lst.innerHTML = s.map(x => `<tr><td class="ps-4">${x.email}</td><td>${x.date ? x.date.toDate().toLocaleDateString() : '-'}</td><td>${x.pct}%</td><td class="text-end pe-4"><button class="btn btn-sm btn-outline-danger" onclick="Aula.kickStudent('${x.enrollmentId}','${x.uid}','${cid}')">Baja</button></td></tr>`).join(''); } catch (e) { ldg.classList.add('d-none'); emp.innerHTML = 'Error'; emp.classList.remove('d-none'); } }
    async function kickStudent(eid, uid, cid) { if (!confirm('¿Baja?')) return; try { await AulaService.removeStudent(_ctx, eid, uid, cid); showToast('Baja exitosa', 'success'); bootstrap.Modal.getInstance(document.getElementById('modalAulaStudents')).hide(); } catch (e) { showToast('Error', 'danger'); } }

    // --- Helper CSV (Fase 3) ---
    function downloadCSV(data, filename) {
      if (!data || data.length === 0) return;

      const headers = Object.keys(data[0]);
      // Crear fila de cabecera
      const csvRows = [headers.join(',')];

      // Crear filas de datos
      for (const row of data) {
        const values = headers.map(header => {
          const escaped = ('' + (row[header] || '')).replace(/"/g, '""'); // Escapar comillas
          return `"${escaped}"`; // Envolver todo en comillas
        });
        csvRows.push(values.join(','));
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename || 'reporte.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    async function initSuperAdmin(ctx) {
      _ctx = ctx;
      const listEl = document.getElementById('aula-sa-list');
      
      try {
        // Obtener TODOS los cursos (sin filtrar por creador)
        const snap = await _ctx.db.collection(CURS).orderBy('createdAt', 'desc').get();
        const cursos = snap.docs.map(d => ({id: d.id, ...d.data()}));
        
        // Guardamos para exportar CSV
        window._saAulaData = cursos.map(c => ({
           ID: c.id,
           Titulo: c.titulo,
           Instructor: c.creadoEmail,
           Publicado: c.publicado ? 'SI' : 'NO',
           Fecha_Creacion: c.createdAt ? c.createdAt.toDate().toLocaleDateString() : '-'
        }));

        if(cursos.length === 0) {
           listEl.innerHTML = '<p class="text-center p-4">No hay cursos en la plataforma.</p>';
           return;
        }

        let html = `<table class="table table-hover align-middle"><thead class="table-light">
          <tr><th>Curso</th><th>Instructor</th><th>Estado</th><th>Fecha Creación</th></tr></thead><tbody>`;
        
        cursos.forEach(c => {
           const estado = c.publicado 
             ? '<span class="badge bg-success-subtle text-success">Publicado</span>' 
             : '<span class="badge bg-secondary-subtle text-secondary">Borrador</span>';
           
           html += `<tr>
             <td class="fw-bold">${c.titulo}</td>
             <td>${c.creadoEmail || 'Desconocido'}</td>
             <td>${estado}</td>
             <td class="text-muted small">${c.createdAt ? c.createdAt.toDate().toLocaleDateString() : '-'}</td>
           </tr>`;
        });
        html += '</tbody></table>';
        listEl.innerHTML = html;

      } catch(e) {
        console.error(e);
        listEl.innerHTML = '<div class="alert alert-danger m-3">Error cargando auditoría de cursos.</div>';
      }
    }

    return {
      initStudent,
      initAdmin,
      initSuperAdmin,
      inscribirse,
      eliminarCurso,
      toggleCursoPublicado,
      openCourseModal,
      openContentModal,
      verConstancia,
      editLesson,
      deleteLesson,
      editQuiz,
      deleteQuiz,
      abandonarCurso,
      openStudentsModal,
      kickStudent,
      borrarAviso,
      downloadCSV // Exportamos el helper de CSV
    };



  })();

  global.Aula = AulaModule;
})(window);