/* ============================================================
   AulaContent — Player de Curso · Módulos > Lecciones + Quiz
   Multimedia expandido · Streaks · Badges · Mobile-first
   ============================================================ */
(function (global) {
  const AulaContent = (function () {
    const AulaService = global.AulaService;

    let _ctx = null, _courseId = null, _uid = null, _courseData = null;
    let _modules = [], _lessons = [], _current = -1, _totalLessons = 0;
    let _completed = new Set(), _completedModules = new Set();
    let _hasShownInitial = false, _timerInterval = null;
    let _unsubProg = null;
    let _streakCurrent = 0;

    function $id(id) { return document.getElementById(id); }

    // ── YouTube helper ──
    function getYoutubeId(url) {
      if (!url) return null;
      try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        if (host === 'youtu.be') return u.pathname.replace('/', '') || null;
        if (host === 'youtube.com' || host === 'm.youtube.com') {
          const v = u.searchParams.get('v'); if (v) return v;
          const parts = u.pathname.split('/');
          const last = parts[parts.length - 1] || '';
          if ((parts.includes('embed') || parts.includes('shorts')) && last) return last;
        }
      } catch (_) {}
      if (url.includes('youtu.be/')) return (url.split('youtu.be/')[1] || '').split(/[?&]/)[0] || null;
      if (url.includes('v=')) return (url.split('v=')[1] || '').split('&')[0] || null;
      return null;
    }

    // ── Confetti ──
    function triggerConfetti() {
      const colors = ['#00D0FF', '#C3FF00', '#4e1bda', '#ffb400', '#ff4d4d'];
      for (let i = 0; i < 60; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-confetti-piece';
        el.style.left = (Math.random() * 100) + 'vw';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDelay = (Math.random() * 0.5) + 's';
        el.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1800);
      }
    }

    // ── Escape HTML ──
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    }

    // ══════════════════════════════════════════════════════════
    //  SIDEBAR — Accordion de Módulos
    // ══════════════════════════════════════════════════════════
    function renderAccordion() {
      const host = $id('aula-course-modules');
      if (!host) return;

      if (!_modules.length) {
        host.innerHTML = '<div class="text-muted small p-3">Sin contenido disponible.</div>';
        return;
      }

      const countLabel = $id('aula-course-lesson-count');
      if (countLabel) countLabel.textContent = `${_totalLessons} lecciones`;

      host.innerHTML = _modules.map((mod, mi) => {
        const modLessons = _lessons.filter(l => l.moduleId === mod.id);
        const doneLessons = modLessons.filter(l => _completed.has(l.id));
        const modDone = modLessons.length > 0 && doneLessons.length === modLessons.length;
        const modPct = modLessons.length > 0 ? Math.round((doneLessons.length / modLessons.length) * 100) : 0;
        const isExpanded = modLessons.some((l, li) => _lessons.indexOf(l) === _current);

        return `
          <div class="accordion-item border-0">
            <h2 class="accordion-header">
              <button class="accordion-button aula-module-header ${isExpanded ? '' : 'collapsed'} small fw-bold py-2 px-3"
                      type="button" data-bs-toggle="collapse" data-bs-target="#aula-mod-${mi}">
                <span class="d-flex align-items-center gap-2 w-100">
                  ${modDone
                    ? '<i class="bi bi-check-circle-fill text-success"></i>'
                    : '<i class="bi bi-folder2-open text-primary opacity-75"></i>'}
                  <span class="flex-grow-1 text-truncate">${esc(mod.titulo || 'Modulo ' + (mi + 1))}</span>
                  <span class="badge bg-secondary-subtle text-secondary rounded-pill" style="font-size:.65rem">${doneLessons.length}/${modLessons.length}</span>
                </span>
              </button>
            </h2>
            <div id="aula-mod-${mi}" class="accordion-collapse collapse ${isExpanded ? 'show' : ''}">
              <div class="accordion-body p-0">
                <div class="aula-module-progress mx-3 my-1">
                  <div class="progress rounded-pill" style="height:4px;">
                    <div class="progress-bar bg-aula rounded-pill" style="width:${modPct}%"></div>
                  </div>
                </div>
                <div class="list-group list-group-flush">
                  ${modLessons.map(l => {
                    const gIdx = _lessons.indexOf(l);
                    const active = gIdx === _current;
                    const done = _completed.has(l.id);
                    const icon = done
                      ? 'bi-check-circle-fill text-success'
                      : (active ? 'bi-play-circle-fill text-primary' : 'bi-circle text-muted');
                    return `
                      <button type="button"
                        class="list-group-item list-group-item-action aula-lesson-item d-flex align-items-center gap-2 py-2 px-3 small border-0 ${active ? 'aula-lesson-active' : ''} ${done ? 'aula-lesson-done' : ''}"
                        onclick="AulaContent._go(${gIdx})">
                        <i class="bi ${icon}" style="font-size:.85rem"></i>
                        <span class="text-truncate flex-grow-1">${esc(l.title || 'Leccion')}</span>
                        ${active ? '<span class="badge bg-primary rounded-pill" style="font-size:.6rem">Actual</span>' : ''}
                      </button>`;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    // ══════════════════════════════════════════════════════════
    //  CONTENIDO MULTIMEDIA
    // ══════════════════════════════════════════════════════════
    function renderResourceHTML(res) {
      if (!res || !res.url) return '';
      const label = esc(res.label || res.url);
      const url = res.url;

      switch (res.type) {
        case 'youtube': {
          const vid = getYoutubeId(url);
          if (vid && /^[\w-]{6,20}$/.test(vid)) {
            return `<div class="ratio ratio-16x9 mt-3 mb-3 rounded-3 overflow-hidden shadow-sm">
              <iframe src="https://www.youtube.com/embed/${vid}" allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin" loading="lazy" style="border:0"></iframe>
            </div>
            ${label !== url ? `<p class="text-muted small mt-1"><i class="bi bi-play-btn me-1"></i>${label}</p>` : ''}`;
          }
          return `<a href="${esc(url)}" target="_blank" rel="noopener" class="btn btn-outline-danger btn-sm rounded-pill mt-2">
            <i class="bi bi-youtube me-1"></i>${label}</a>`;
        }

        case 'pdf':
          return `<div class="aula-resource-pdf mt-3 mb-3 rounded-3 overflow-hidden shadow-sm" style="height:500px;">
            <iframe src="${esc(url)}" style="width:100%;height:100%;border:0;" loading="lazy"></iframe>
          </div>
          <p class="text-muted small"><i class="bi bi-file-earmark-pdf me-1"></i>${label}
            <a href="${esc(url)}" target="_blank" rel="noopener" class="ms-2 text-decoration-none">
              <i class="bi bi-box-arrow-up-right"></i> Abrir
            </a>
          </p>`;

        case 'slides':
          return `<div class="aula-resource-slides mt-3 mb-3 rounded-3 overflow-hidden shadow-sm" style="height:450px;">
            <iframe src="${esc(url)}" style="width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe>
          </div>
          <p class="text-muted small"><i class="bi bi-easel me-1"></i>${label}</p>`;

        case 'image':
          return `<div class="aula-resource-image mt-3 mb-3 text-center">
            <img src="${esc(url)}" alt="${label}" class="img-fluid rounded-3 shadow-sm" style="max-height:500px;cursor:zoom-in"
              onclick="window.open('${esc(url)}','_blank')">
            <p class="text-muted small mt-1"><i class="bi bi-image me-1"></i>${label}</p>
          </div>`;

        case 'link':
        default:
          return `<div class="mt-2 mb-2">
            <a href="${esc(url)}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm rounded-pill">
              <i class="bi bi-link-45deg me-1"></i>${label}
            </a>
          </div>`;
      }
    }

    // ══════════════════════════════════════════════════════════
    //  MOSTRAR LECCIÓN
    // ══════════════════════════════════════════════════════════
    function getResumeIndex() {
      if (!_lessons.length) return null;
      const idx = _lessons.findIndex(L => !_completed.has(L.id));
      return idx >= 0 ? idx : _lessons.length - 1;
    }

    function setProgress(p) {
      const pct = Math.max(0, Math.min(100, Number(p || 0)));
      const bar = $id('aula-course-progress');
      if (bar) { bar.style.width = `${pct}%`; bar.textContent = `${pct}%`; }
      const lbl = $id('aula-course-progress-label');
      if (lbl) lbl.textContent = `${pct}% completado`;
    }

    function updateResumeButton() {
      const btn = $id('aula-course-resume');
      if (!btn) return;
      const idx = getResumeIndex();
      if (idx == null || _current === idx) {
        btn.disabled = true;
        btn.textContent = 'Reanudar leccion';
        return;
      }
      const L = _lessons[idx];
      btn.disabled = false;
      btn.textContent = `Reanudar: ${L.title || 'Leccion'}`;
    }

    function updateStreakDisplay(streakData) {
      const badge = $id('aula-course-streak');
      const count = $id('aula-course-streak-count');
      if (!badge || !count) return;
      const current = (streakData && streakData.current) || _streakCurrent;
      _streakCurrent = current;
      if (current > 0) {
        badge.classList.remove('d-none');
        count.textContent = current;
      } else {
        badge.classList.add('d-none');
      }
    }

    function show(idx, saveToDb = true) {
      if (!_lessons.length) return;
      _current = Math.max(0, Math.min(idx, _lessons.length - 1));

      renderAccordion();
      updateResumeButton();

      const L = _lessons[_current];
      const box = $id('aula-lesson-container');

      if (box) {
        let html = L.html || '';
        if (!html && (!L.resources || !L.resources.length)) {
          html = '<div class="text-muted">Sin contenido.</div>';
        }

        // Render resources array
        const resources = Array.isArray(L.resources) ? L.resources : [];
        let resourcesHTML = '';
        for (const res of resources) {
          resourcesHTML += renderResourceHTML(res);
        }

        // Fallback: single resource field (backward compat)
        if (!resources.length && L.resource) {
          resourcesHTML += renderResourceHTML(
            L.resource.includes('youtu')
              ? { type: 'youtube', url: L.resource, label: 'Video' }
              : { type: 'link', url: L.resource, label: 'Ver Recurso' }
          );
        }

        box.innerHTML = `
          <h5 class="fw-bold text-primary mb-3">${esc(L.title || 'Leccion')}</h5>
          <div class="aula-lesson-content">${html}</div>
          ${resourcesHTML ? '<hr class="my-3">' + resourcesHTML : ''}
        `;
      }

      const prev = $id('aula-lesson-prev');
      const next = $id('aula-lesson-next');
      if (prev) prev.disabled = _current <= 0;
      if (next) next.disabled = _current >= _lessons.length - 1;

      if (saveToDb && _courseId && _uid) {
        AulaService.updateLastViewed(_ctx, _uid, _courseId, L.moduleId || null, L.id).catch(() => {});
      }
    }

    function ensureInitialLesson() {
      if (_hasShownInitial || !_lessons.length) return;
      _hasShownInitial = true;
      show(getResumeIndex() ?? 0, false);
    }

    // ══════════════════════════════════════════════════════════
    //  COMPLETAR LECCIÓN
    // ══════════════════════════════════════════════════════════
    async function onComplete() {
      if (_current < 0 || !_lessons[_current]) return;
      const L = _lessons[_current];
      try {
        await AulaService.markLessonComplete(_ctx, _uid, _courseId, L.id, _totalLessons);

        // Check if module is now complete
        if (L.moduleId) {
          const modLessons = _lessons.filter(l => l.moduleId === L.moduleId);
          const newCompleted = new Set(_completed);
          newCompleted.add(L.id);
          const allDone = modLessons.every(l => newCompleted.has(l.id));
          if (allDone) {
            AulaService.markModuleComplete(_ctx, _uid, _courseId, L.moduleId).catch(() => {});
          }
        }

        // Update streak
        try {
          const newStreak = await AulaService.updateStreak(_ctx, _uid, _courseId);
          if (newStreak) {
            updateStreakDisplay(newStreak);
            if (newStreak.current > 1) {
              const badge = $id('aula-course-streak');
              if (badge) {
                badge.classList.add('aula-streak-pulse');
                setTimeout(() => badge.classList.remove('aula-streak-pulse'), 600);
              }
            }
            // Check streak badge
            AulaService.checkAndAwardBadges(_ctx, _uid, {
              type: 'streak_update',
              streak: newStreak.current,
              cursoId: _courseId
            }).catch(() => {});
          }
        } catch (_) {}

        showToast('Leccion completada', 'success');

        // Auto-advance if not last
        if (_current < _lessons.length - 1) {
          setTimeout(() => show(_current + 1), 400);
        }
      } catch (e) {
        console.error('Error marking complete:', e);
        showToast('Error al completar', 'danger');
      }
    }

    function showToast(msg, type) {
      if (global.SIA?.toast) return global.SIA.toast(msg, type);
      if (global.showToast) return global.showToast(msg, type);
    }

    // ── Rewire buttons ──
    function rewire() {
      ['aula-lesson-prev', 'aula-lesson-next', 'aula-lesson-complete',
       'aula-course-open-quiz', 'aula-course-resume', 'aula-course-back'].forEach(id => {
        const old = $id(id); if (!old) return;
        const neo = old.cloneNode(true); old.replaceWith(neo);
      });
      $id('aula-lesson-prev')?.addEventListener('click', () => show(_current - 1));
      $id('aula-lesson-next')?.addEventListener('click', () => show(_current + 1));
      $id('aula-lesson-complete')?.addEventListener('click', onComplete);
      $id('aula-course-open-quiz')?.addEventListener('click', openQuiz);
      $id('aula-course-resume')?.addEventListener('click', () => {
        const idx = getResumeIndex();
        if (idx != null) show(idx);
      });
      $id('aula-course-back')?.addEventListener('click', () => {
        cleanup();
        if (window.SIA_navToAula) window.SIA_navToAula();
        else if (global.SIA?.showView) global.SIA.showView('view-aula');
      });
    }

    function cleanup() {
      if (_unsubProg) { _unsubProg(); _unsubProg = null; }
      if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    }

    // ══════════════════════════════════════════════════════════
    //  QUIZ — Evaluación
    // ══════════════════════════════════════════════════════════
    async function openQuiz() {
      const modalEl = $id('aulaQuizModal');
      const titleEl = $id('aula-quiz-title');
      const bodyEl = $id('aula-quiz-body');
      const btnSubmit = $id('aula-quiz-submit');

      if (_timerInterval) clearInterval(_timerInterval);
      titleEl.textContent = 'Cargando...';
      bodyEl.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary"></div></div>';
      btnSubmit.classList.add('d-none');
      bootstrap.Modal.getOrCreateInstance(modalEl).show();

      try {
        const quiz = await AulaService.getFirstQuiz(_ctx, _courseId);
        if (!quiz) { bodyEl.innerHTML = '<div class="alert alert-info">No hay evaluacion asignada.</div>'; return; }

        const attempts = await AulaService.getAttempts(_ctx, _uid, _courseId, quiz.id);
        const maxTries = quiz.maxAttempts || 3;
        const usedTries = attempts.length;
        const bestScore = attempts.reduce((acc, a) => Math.max(acc, a.score || 0), 0);
        const passed = attempts.some(a => a.approved);

        // Attempts exhausted
        if (usedTries >= maxTries && !passed) {
          titleEl.textContent = 'Intentos Agotados';
          bodyEl.innerHTML = `<div class="text-center py-4">
            <div class="display-1 text-danger mb-3"><i class="bi bi-x-circle"></i></div>
            <h5>Has agotado tus ${maxTries} intentos.</h5>
            <p class="text-muted">Mejor calificacion: <strong>${bestScore}%</strong></p>
            <div class="alert alert-warning d-inline-block small">Contacta a tu docente para desbloqueo.</div>
          </div>`;
          return;
        }

        // Already passed
        if (passed) {
          const courseTitle = (_courseData?.titulo || _courseData?.title) || '';
          titleEl.textContent = 'Curso Aprobado!';
          bodyEl.innerHTML = `<div class="text-center py-4">
            <div class="display-1 text-success mb-3"><i class="bi bi-award"></i></div>
            <h5 class="fw-bold mb-2">Ya aprobaste esta evaluacion.</h5>
            <p class="text-muted mb-3">Calificacion final: <strong>${bestScore}%</strong></p>
            <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center">
              <button type="button" class="btn btn-outline-primary flex-fill" id="quiz-btn-view-cert">Ver constancia</button>
              <button type="button" class="btn btn-primary flex-fill" id="quiz-btn-exit-aula">Salir a Aula</button>
            </div>
          </div>`;
          triggerConfetti();
          $id('quiz-btn-view-cert')?.addEventListener('click', () => {
            if (global.Aula?.verConstancia) global.Aula.verConstancia(_courseId, courseTitle);
          });
          $id('quiz-btn-exit-aula')?.addEventListener('click', () => {
            bootstrap.Modal.getInstance(modalEl)?.hide();
            if (window.SIA_navToAula) window.SIA_navToAula(); else if (global.SIA?.showView) global.SIA.showView('view-aula');
          });
          btnSubmit.classList.add('d-none');
          return;
        }

        // Start screen
        titleEl.textContent = quiz.title;
        bodyEl.innerHTML = `<div class="text-center py-4">
          <h6 class="fw-bold mb-3">Informacion de la Prueba</h6>
          <div class="d-flex flex-wrap justify-content-center gap-3 mb-4">
            <div class="border rounded-3 px-3 py-2 text-center"><div class="small text-muted text-uppercase">Tiempo</div><div class="fw-bold">${quiz.timeLimit > 0 ? quiz.timeLimit + ' min' : 'Sin limite'}</div></div>
            <div class="border rounded-3 px-3 py-2 text-center"><div class="small text-muted text-uppercase">Intentos</div><div class="fw-bold">${usedTries} / ${maxTries}</div></div>
            <div class="border rounded-3 px-3 py-2 text-center"><div class="small text-muted text-uppercase">Minimo</div><div class="fw-bold">${quiz.minScore || 70}%</div></div>
          </div>
          <button id="btn-start-quiz" class="btn btn-primary btn-lg rounded-pill px-5 shadow">Comenzar Evaluacion</button>
        </div>`;
        $id('btn-start-quiz').onclick = () => startQuizFlow(quiz);

      } catch (err) {
        console.error(err);
        bodyEl.innerHTML = '<div class="alert alert-danger">Error al cargar evaluacion.</div>';
      }
    }

    // ── Quiz Flow ──
    function startQuizFlow(quiz) {
      const titleEl = $id('aula-quiz-title');
      const bodyEl = $id('aula-quiz-body');
      const btnSubmit = $id('aula-quiz-submit');
      const modalEl = $id('aulaQuizModal');

      const total = Array.isArray(quiz.items) ? quiz.items.length : 0;
      if (!total) { bodyEl.innerHTML = '<div class="alert alert-info">Sin reactivos.</div>'; btnSubmit.classList.add('d-none'); return; }

      let currentQ = 0, hasSubmitted = false;
      const flags = new Set();
      if (_timerInterval) clearInterval(_timerInterval);
      let timeLeft = (quiz.timeLimit || 0) * 60;

      bodyEl.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2 small text-muted">
          <div>Pregunta <span id="quiz-current">1</span> de ${total}</div>
          <div>Respondidas: <span id="quiz-answered">0</span> / ${total}</div>
        </div>
        <div id="quiz-slide-container" style="min-height:250px;"></div>
        <div class="d-flex justify-content-between align-items-center mt-3 border-top pt-3">
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="quiz-btn-prev"><i class="bi bi-chevron-left"></i></button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="quiz-btn-next"><i class="bi bi-chevron-right"></i></button>
          </div>
          <button type="button" class="btn btn-outline-warning btn-sm" id="quiz-toggle-flag"><i class="bi bi-flag"></i> Marcar</button>
        </div>
        <div class="mt-2 d-flex justify-content-between align-items-center small text-muted">
          <div>Marcadas: <span id="quiz-flag-summary">Ninguna</span></div>
          <button type="button" class="btn btn-link btn-sm p-0" id="quiz-review-flags">Ir a marcadas</button>
        </div>`;

      const slidesHost = $id('quiz-slide-container');

      slidesHost.innerHTML = quiz.items.map((q, i) => {
        const opts = Array.isArray(q.opciones) ? q.opciones : [];
        return `<div class="quiz-slide fade-in d-none" data-index="${i}">
          <div class="card border-0 shadow-sm mb-2">
            <div class="card-body p-3">
              <h6 class="fw-bold mb-3">${i + 1}. ${q.enunciado || 'Pregunta'}</h6>
              <div class="d-flex flex-column gap-2">
                ${opts.map((op, j) => `
                  <div class="form-check p-3 border rounded-3" style="cursor:pointer;transition:background .15s;min-height:48px;"
                       onclick="this.querySelector('input').click()">
                    <input class="form-check-input" type="radio" name="q${i}" id="q${i}_${j}" value="${j}" style="cursor:pointer">
                    <label class="form-check-label w-100 ms-2" for="q${i}_${j}" style="cursor:pointer;user-select:none">${op}</label>
                  </div>`).join('')}
              </div>
              <div class="mt-2 text-center d-none" data-flag-indicator="${i}">
                <span class="badge bg-warning text-dark small"><i class="bi bi-flag-fill"></i> Marcada</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

      const btnPrev = $id('quiz-btn-prev');
      const btnNext = $id('quiz-btn-next');
      const btnFlag = $id('quiz-toggle-flag');
      const btnReview = $id('quiz-review-flags');

      const neoBtn = btnSubmit.cloneNode(true);
      btnSubmit.replaceWith(neoBtn);
      neoBtn.textContent = 'Finalizar y Enviar';
      neoBtn.classList.remove('d-none');
      neoBtn.disabled = false;

      slidesHost.querySelectorAll('input[type=radio]').forEach(radio => {
        radio.addEventListener('change', e => {
          const slide = e.target.closest('.quiz-slide');
          slide.querySelectorAll('.form-check').forEach(div => div.classList.remove('border-primary', 'bg-primary-subtle'));
          e.target.closest('.form-check')?.classList.add('border-primary', 'bg-primary-subtle');
          updateCounters();
        });
      });

      function getAnswer(i) { const c = slidesHost.querySelector(`input[name="q${i}"]:checked`); return c ? Number(c.value) : -1; }

      function updateCounters() {
        let count = 0;
        for (let i = 0; i < total; i++) if (getAnswer(i) >= 0) count++;
        const ans = $id('quiz-answered'); if (ans) ans.textContent = count;
        const cur = $id('quiz-current'); if (cur) cur.textContent = currentQ + 1;
        const fs = $id('quiz-flag-summary');
        if (fs) fs.textContent = flags.size ? Array.from(flags).map(i => i + 1).sort((a, b) => a - b).join(', ') : 'Ninguna';
      }

      function updateFlagUI() {
        const flagged = flags.has(currentQ);
        if (btnFlag) {
          btnFlag.classList.toggle('btn-warning', flagged);
          btnFlag.classList.toggle('btn-outline-warning', !flagged);
          btnFlag.innerHTML = flagged ? '<i class="bi bi-flag-fill"></i> Marcada' : '<i class="bi bi-flag"></i> Marcar';
        }
        const ind = slidesHost.querySelector(`.quiz-slide[data-index="${currentQ}"] [data-flag-indicator]`);
        if (ind) ind.classList.toggle('d-none', !flagged);
      }

      function showQuestion(idx) {
        if (idx < 0 || idx >= total) return;
        currentQ = idx;
        slidesHost.querySelectorAll('.quiz-slide').forEach(s => s.classList.add('d-none'));
        const active = slidesHost.querySelector(`.quiz-slide[data-index="${currentQ}"]`);
        if (active) active.classList.remove('d-none');
        if (btnPrev) btnPrev.disabled = currentQ <= 0;
        if (btnNext) btnNext.disabled = currentQ >= total - 1;
        updateCounters();
        updateFlagUI();
      }

      function collectAnswers() { return quiz.items.map((_, i) => getAnswer(i)); }

      // Result screen
      function renderResult(res) {
        const icon = res.approved ? 'bi-patch-check-fill text-success' : 'bi-emoji-frown-fill text-warning';
        const title = res.approved ? 'Felicidades, aprobaste!' : 'Intento registrado';
        const msg = res.approved
          ? 'Has alcanzado la calificacion minima. Tu constancia ha sido generada.'
          : 'No alcanzaste la calificacion minima. Puedes intentarlo de nuevo.';
        const courseTitle = (_courseData?.title || _courseData?.titulo) || 'Curso';

        bodyEl.style.opacity = '1';
        bodyEl.innerHTML = `<div class="text-center py-4 fade-in">
          <div class="display-1 mb-3"><i class="bi ${icon}"></i></div>
          <h5 class="fw-bold mb-2">${title}</h5>
          <p class="text-muted mb-3">${msg}</p>
          <div class="d-inline-flex flex-wrap gap-2 justify-content-center mb-4">
            <div class="badge bg-light text-dark px-3 py-2 border"><div class="small text-muted text-uppercase">Calificacion</div><div class="fw-bold fs-5">${res.score}%</div></div>
            <div class="badge bg-light text-dark px-3 py-2 border"><div class="small text-muted text-uppercase">Aciertos</div><div class="fw-bold fs-5">${res.ok} / ${res.total}</div></div>
          </div>
          <div class="d-grid gap-2 col-8 mx-auto">
            ${res.approved ? '<button type="button" class="btn btn-outline-primary" id="btn-res-cert"><i class="bi bi-file-earmark-pdf-fill me-2"></i>Ver Constancia</button>' : ''}
            <button type="button" class="btn btn-primary" id="btn-res-exit">Volver al Aula</button>
          </div>
        </div>`;

        $id('btn-res-cert')?.addEventListener('click', () => {
          if (global.Aula?.verConstancia) global.Aula.verConstancia(_courseId, courseTitle);
        });
        $id('btn-res-exit')?.addEventListener('click', () => {
          bootstrap.Modal.getInstance(modalEl)?.hide();
          if (window.SIA_navToAula) window.SIA_navToAula();
          else if (global.SIA?.showView) global.SIA.showView('view-aula');
        });
        neoBtn.classList.add('d-none');
      }

      // Submit
      async function submitQuiz(auto, answers) {
        if (hasSubmitted) return;
        hasSubmitted = true;
        if (_timerInterval) clearInterval(_timerInterval);
        neoBtn.disabled = true;
        neoBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';
        bodyEl.style.opacity = '0.6';

        try {
          const res = AulaService.evaluateQuiz(quiz, answers);
          await AulaService.saveAttempt(_ctx, _uid, _courseId, quiz, res, answers);

          if (res.approved) {
            try { await AulaService.issueCertificate(_ctx, _uid, _courseId, res.score); } catch (_) {}
            triggerConfetti();

            // Badge checks for course completion and perfect score
            try {
              await AulaService.checkAndAwardBadges(_ctx, _uid, {
                type: 'course_complete', cursoId: _courseId
              });
              if (res.score === 100) {
                await AulaService.checkAndAwardBadges(_ctx, _uid, {
                  type: 'quiz_perfect', score: 100, cursoId: _courseId
                });
              }
            } catch (_) {}

            if (window.Notify) {
              const cTitle = _courseData?.title || _courseData?.titulo || 'Curso';
              window.Notify.send(_uid, {
                title: 'Curso Aprobado!',
                message: `Felicidades, aprobaste "${cTitle}" con ${res.score}%.`,
                type: 'aula'
              });
            }
          }

          renderResult(res);
        } catch (e) {
          console.error(e);
          hasSubmitted = false;
          bodyEl.style.opacity = '1';
          neoBtn.disabled = false;
          neoBtn.textContent = 'Reintentar Envio';
          alert('Error enviando respuestas. Verifica tu conexion.');
        }
      }

      // Listeners
      if (btnPrev) btnPrev.onclick = () => showQuestion(currentQ - 1);
      if (btnNext) btnNext.onclick = () => showQuestion(currentQ + 1);
      if (btnFlag) btnFlag.onclick = () => { flags.has(currentQ) ? flags.delete(currentQ) : flags.add(currentQ); updateFlagUI(); updateCounters(); };
      if (btnReview) btnReview.onclick = () => {
        let t = -1;
        for (let i = currentQ + 1; i < total; i++) if (flags.has(i)) { t = i; break; }
        if (t === -1) for (let i = 0; i < total; i++) if (flags.has(i)) { t = i; break; }
        if (t !== -1) showQuestion(t); else alert('No hay preguntas marcadas.');
      };

      neoBtn.onclick = () => {
        if (hasSubmitted) return;
        let missing = 0;
        for (let i = 0; i < total; i++) if (getAnswer(i) < 0) missing++;
        if (missing > 0) { if (!confirm(`Faltan ${missing} preguntas. Enviar?`)) return; }
        else { if (!confirm('Finalizar evaluacion?')) return; }
        submitQuiz(false, collectAnswers());
      };

      // Timer
      if (timeLeft > 0) {
        _timerInterval = setInterval(() => {
          timeLeft--;
          const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
          titleEl.innerHTML = `<span class="font-monospace ${timeLeft < 60 ? 'text-danger fw-bold' : ''}"><i class="bi bi-stopwatch"></i> ${m}:${s < 10 ? '0' + s : s}</span> - ${quiz.title}`;
          if (timeLeft <= 0) { clearInterval(_timerInterval); alert('Tiempo agotado! Enviando...'); submitQuiz(true, collectAnswers()); }
        }, 1000);
      } else {
        titleEl.textContent = quiz.title;
      }

      showQuestion(0);
    }

    // ══════════════════════════════════════════════════════════
    //  INIT COURSE
    // ══════════════════════════════════════════════════════════
    async function initCourse(ctx, courseId) {
      _ctx = ctx;
      _courseId = courseId;
      _uid = ctx.auth.currentUser.uid;
      _courseData = null;
      _modules = [];
      _lessons = [];
      _current = -1;
      _totalLessons = 0;
      _completed = new Set();
      _completedModules = new Set();
      _hasShownInitial = false;
      _streakCurrent = 0;

      cleanup();
      rewire();

      // Reset UI
      const box = $id('aula-lesson-container');
      if (box) box.innerHTML = `<div class="text-center text-muted mt-5">
        <i class="bi bi-journal-text fs-1 opacity-25 d-block mb-3"></i>
        Selecciona una leccion para comenzar.
      </div>`;
      const prev = $id('aula-lesson-prev'), next = $id('aula-lesson-next');
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      const resume = $id('aula-course-resume');
      if (resume) { resume.disabled = true; resume.textContent = 'Reanudar leccion'; }
      const modHost = $id('aula-course-modules');
      if (modHost) modHost.innerHTML = '<div class="text-muted small p-3"><div class="spinner-border spinner-border-sm me-2"></div>Cargando...</div>';

      try {
        // Fetch course data
        const C = await AulaService.getCourse(ctx, courseId);
        _courseData = C;
        if ($id('aula-course-title')) $id('aula-course-title').textContent = C.titulo || 'Curso sin titulo';
        if ($id('aula-course-desc')) $id('aula-course-desc').textContent = C.descripcion || '';
        if ($id('aula-course-meta')) {
          const parts = [];
          if (C.duracionHoras || C.horas) parts.push(`${C.duracionHoras || C.horas} h`);
          if (C.nivel) parts.push(`Nivel: ${C.nivel}`);
          if (C.totalModulos) parts.push(`${C.totalModulos} modulos`);
          if (C.totalLecciones) parts.push(`${C.totalLecciones} lecciones`);
          $id('aula-course-meta').textContent = parts.join(' \u2022 ');
        }

        // Fetch modules + all lessons
        _modules = await AulaService.getModules(ctx, courseId);
        _lessons = await AulaService.getAllLessons(ctx, courseId);
        _totalLessons = _lessons.length;

        renderAccordion();

        if (!_lessons.length) {
          if (box) box.innerHTML = '<div class="text-muted small p-3">Este curso aun no tiene lecciones.</div>';
          return;
        }

        // Ensure progress doc exists
        await AulaService.ensureProgress(ctx, _uid, courseId);

        // Stream progress
        _unsubProg = AulaService.streamProgress(ctx, _uid, courseId, snap => {
          const data = snap.data() || {};
          setProgress(data.progressPct || 0);
          _completed = new Set(Array.isArray(data.completedLessons) ? data.completedLessons : []);
          _completedModules = new Set(Array.isArray(data.completedModules) ? data.completedModules : []);

          // Streak
          if (data.streak) updateStreakDisplay(data.streak);

          renderAccordion();
          updateResumeButton();

          // Quiz button
          const btnQuiz = $id('aula-course-open-quiz');
          if (btnQuiz) {
            if ((data.progressPct || 0) >= 100) {
              btnQuiz.disabled = false;
              btnQuiz.classList.remove('btn-secondary');
              btnQuiz.classList.add('btn-primary');
            } else {
              btnQuiz.disabled = true;
              btnQuiz.classList.remove('btn-primary');
              btnQuiz.classList.add('btn-secondary');
            }
          }

          ensureInitialLesson();
        });

        ctx.activeUnsubs.push(_unsubProg);

        // Resume from last viewed
        ensureInitialLesson();

      } catch (e) {
        console.error('AulaContent init error:', e);
        if (box) box.innerHTML = '<div class="alert alert-danger m-3">Error al cargar el curso.</div>';
      }
    }

    function _go(i) { show(i); }

    return { initCourse, _go };
  })();

  global.AulaContent = AulaContent;
})(window);
