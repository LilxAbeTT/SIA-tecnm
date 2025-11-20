(function (global) {
  const AulaContent = (function () {
    const AulaService = global.AulaService;

    let _ctx = null, _courseId = null, _uid = null, _courseData = null;
    let _lessons = [], _current = -1, _unsubProg = null, _unsubLessons = null;
    let _completed = new Set(), _lastViewedIndex = null, _lastLessonId = null, _hasShownInitial = false;
    let _timerInterval = null; // Nuevo para el timer

    function $id(id) { return document.getElementById(id); }

    function getYoutubeId(url) {
      if (!url) return null;

      try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');

        if (host === 'youtu.be') {
          const id = u.pathname.replace('/', '');
          return id || null;
        }

        if (host === 'youtube.com' || host === 'm.youtube.com') {
          const v = u.searchParams.get('v');
          if (v) return v;

          const parts = u.pathname.split('/');
          const last = parts[parts.length - 1] || '';
          if (parts.includes('embed') && last) return last;
          if (parts.includes('shorts') && last) return last;
        }
      } catch (e) { }

      if (url.includes('youtu.be/')) {
        const after = url.split('youtu.be/')[1] || '';
        return after.split(/[?&]/)[0] || null;
      }

      if (url.includes('v=')) {
        const after = url.split('v=')[1] || '';
        return after.split('&')[0] || null;
      }

      const frag = (url.split('/').pop() || '').split(/[?&]/)[0];
      return frag || null;
    }

    function triggerQuizConfetti() {
      const colors = ['#00D0FF', '#C3FF00', '#4e1bda', '#ffb400', '#ff4d4d'];
      const pieces = 80;

      for (let i = 0; i < pieces; i++) {
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



    function getResumeIndex() {
      if (!_lessons.length) return null;

      // 1) Buscar la primera lección NO completada
      const pendingIdx = _lessons.findIndex(L => !_completed.has(L.id));
      if (pendingIdx >= 0) return pendingIdx;

      // 2) Si todas están completadas, usar la última
      return _lessons.length - 1;
    }



    function rewire() {
      ['aula-lesson-prev',
        'aula-lesson-next',
        'aula-lesson-complete',
        'aula-course-open-quiz',
        'aula-course-resume'
      ].forEach(id => {
        const old = $id(id);
        if (!old) return;
        const neo = old.cloneNode(true);
        old.replaceWith(neo);
      });

      $id('aula-lesson-prev')?.addEventListener('click', () => show(_current - 1));
      $id('aula-lesson-next')?.addEventListener('click', () => show(_current + 1));
      $id('aula-lesson-complete')?.addEventListener('click', onComplete);
      $id('aula-course-open-quiz')?.addEventListener('click', openQuiz);

      // 🔹 Botón "Reanudar en..."
      $id('aula-course-resume')?.addEventListener('click', () => {
        const idx = getResumeIndex();
        if (idx != null) {
          show(idx);
        }
      });
    }




    function setProgress(p) {
      const pct = Math.max(0, Math.min(100, Number(p || 0)));
      const bar = $id('aula-course-progress');
      if (bar) {
        bar.style.width = `${pct}%`;
        bar.textContent = `${pct}%`;
      }
      const lbl = $id('aula-course-progress-label');
      if (lbl) {
        lbl.textContent = `${pct}% completado`;
      }
    }

    function getResumeIndex() {
      if (!_lessons.length) return null;

      const done = _completed || new Set();

      // 1) Primera lección NO completada
      const pendingIdx = _lessons.findIndex(L => !done.has(L.id));
      if (pendingIdx >= 0) return pendingIdx;

      // 2) Si todas están completas → la última
      return _lessons.length - 1;
    }


    function updateResumeButton() {
      const btn = $id('aula-course-resume');
      if (!btn) return;

      const resumeIndex = getResumeIndex();
      if (resumeIndex == null) {
        btn.disabled = true;
        btn.textContent = 'Reanudar última lección';
        return;
      }

      // Si ya estoy en la lección "a reanudar", no tiene sentido el botón
      if (_current === resumeIndex) {
        btn.disabled = true;
        btn.textContent = 'Reanudar última lección';
        return;
      }

      const L = _lessons[resumeIndex];
      btn.disabled = false;
      btn.textContent = `Reanudar en: ${L.title || ('Lección ' + (resumeIndex + 1))}`;
    }


    function renderList() {
      const host = $id('aula-course-lessons');
      if (!host) return;

      host.innerHTML = _lessons.map((L, i) => {
        const isActive = i === _current;
        const isDone = _completed && _completed.has(L.id);
        const icon = isDone ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted';
        const badge = isActive ? '<span class="badge bg-primary ms-2">En curso</span>' : '';
        const baseClasses = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        const activeClass = isActive ? ' active' : '';

        return `
      <button type="button"
              class="${baseClasses}${activeClass}"
              onclick="AulaContent._go(${i})">
        <span><i class="bi ${icon} me-2"></i>${L.title || ('Lección ' + (i + 1))}</span>
        ${badge}
      </button>`;
      }).join('');
    }

    function updateResumeButton() {
      const btn = $id('aula-course-resume');
      if (!btn) return;

      const resumeIndex = getResumeIndex();
      if (resumeIndex == null) {
        btn.disabled = true;
        btn.textContent = 'Reanudar última lección';
        return;
      }

      // Si ya estoy justo en la lección a reanudar, no tiene sentido el botón
      if (_current === resumeIndex) {
        btn.disabled = true;
        btn.textContent = 'Reanudar última lección';
        return;
      }

      const L = _lessons[resumeIndex];
      btn.disabled = false;
      btn.textContent = `Reanudar en: ${L.title || ('Lección ' + (resumeIndex + 1))}`;
    }



    function ensureInitialLesson() {
      if (_hasShownInitial) return;
      if (!_lessons.length) return;

      let targetIndex = 0;

      const resumeIndex = getResumeIndex();
      if (resumeIndex != null) {
        targetIndex = resumeIndex;
      }

      _hasShownInitial = true;
      show(targetIndex, false);
    }



    function show(idx, saveToDb = true) {
      if (_lessons.length === 0) return;

      const target = Math.max(0, Math.min(idx, _lessons.length - 1));
      _current = target;

      renderList();
      updateResumeButton();

      const L = _lessons[_current];
      const box = $id('aula-lesson-container');

      if (box) {
        let contentHtml = L.html || '<div class="text-muted">Sin contenido.</div>';

        if (L.resource) {
          if (L.resource.includes('youtu')) {
            const videoId = getYoutubeId(L.resource);

            let src;
            if (videoId && /^[\w-]{6,20}$/.test(videoId)) {
              src = `https://www.youtube.com/embed/${videoId}`;
            } else {
              src = L.resource;
            }

            contentHtml += `
              <div class="ratio ratio-16x9 mt-3 mb-3">
                <iframe src="${src}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
              </div>`;
          } else {
            contentHtml += `
              <div class="mt-3 border-top pt-3">
                <a href="${L.resource}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm">
                  Ver Recurso
                </a>
              </div>`;
          }
        }

        box.innerHTML = contentHtml;
      }

      const prev = $id('aula-lesson-prev');
      const next = $id('aula-lesson-next');

      if (prev) prev.disabled = _current <= 0;
      if (next) next.disabled = _current >= _lessons.length - 1;

      if (saveToDb && _courseId && _uid) {
        AulaService.updateLastViewed(_ctx, _uid, _courseId, _current, L.id).catch(() => { });
      }
    }



    async function onComplete() {
      if (_current < 0) return;
      await AulaService.markLessonComplete(_ctx, _uid, _courseId, _lessons[_current].id, _lessons.length);
      showToast('Completada', 'success');
    }

    // ===== LÓGICA DE QUIZ PRO (Fase 2) =====
    async function openQuiz() {
      const modalEl = $id('aulaQuizModal');
      const titleEl = $id('aula-quiz-title');
      const bodyEl = $id('aula-quiz-body');
      const btnSubmit = $id('aula-quiz-submit');

      // Limpieza previa
      if (_timerInterval) clearInterval(_timerInterval);
      titleEl.textContent = 'Cargando...';
      bodyEl.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary"></div></div>';
      btnSubmit.classList.add('d-none');
      bootstrap.Modal.getOrCreateInstance(modalEl).show();

      try {
        const quiz = await AulaService.getFirstQuiz(_ctx, _courseId);
        if (!quiz) {
          bodyEl.innerHTML = '<div class="alert alert-info">No hay evaluación asignada.</div>';
          return;
        }

        // 1. Validar Intentos
        const attempts = await AulaService.getAttempts(_ctx, _uid, _courseId, quiz.id);
        const maxTries = quiz.maxAttempts || 3;
        const usedTries = attempts.length;
        const bestScore = attempts.reduce((acc, curr) => Math.max(acc, curr.score || 0), 0);
        const passed = attempts.some(a => a.approved);

        if (usedTries >= maxTries && !passed) {
          titleEl.textContent = 'Intentos Agotados';
          bodyEl.innerHTML = `
            <div class="text-center py-4">
              <div class="display-1 text-danger mb-3"><i class="bi bi-x-circle"></i></div>
              <h4>Has agotado tus ${maxTries} intentos.</h4>
              <p class="text-muted">Mejor calificación obtenida: <strong>${bestScore}%</strong></p>
              <div class="alert alert-warning d-inline-block">Contacta a tu docente para solicitar desbloqueo.</div>
            </div>`;
          return;
        }

        if (passed) {
          const courseTitle =
            (_courseData && (_courseData.titulo || _courseData.title)) || '';

          titleEl.textContent = '¡Curso Aprobado!';

          bodyEl.innerHTML = `
            <div class="text-center py-4">
              <div class="display-1 text-success mb-3">
                <i class="bi bi-award"></i>
              </div>
              <h4 class="fw-bold mb-2">Ya aprobaste esta evaluación.</h4>
              <p class="text-muted mb-3">
                Calificación final registrada: <strong>${bestScore}%</strong>
              </p>
              <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center mt-2">
                <button type="button" class="btn btn-outline-primary flex-fill" id="quiz-btn-view-cert">
                  Ver constancia
                </button>
                <button type="button" class="btn btn-primary flex-fill" id="quiz-btn-exit-aula">
                  Salir a Aula
                </button>
              </div>
            </div>
          `;

          if (typeof triggerQuizConfetti === 'function') {
            triggerQuizConfetti();
          }

          const btnView = $id('quiz-btn-view-cert');
          if (btnView && global.Aula && typeof global.Aula.verConstancia === 'function') {
            btnView.addEventListener('click', () => {
              global.Aula.verConstancia(_courseId, courseTitle);
            });
          }

          const btnExit = $id('quiz-btn-exit-aula');
          if (btnExit) {
            btnExit.addEventListener('click', () => {
              const m = bootstrap.Modal.getInstance(modalEl);
              if (m) m.hide();
              if (window.SIA_navToAula) {
                window.SIA_navToAula();
              } else {
                window.location.href = '/aula';
              }
            });
          }

          btnSubmit.classList.add('d-none');
          return;
        }


        // 2. Pantalla de "Start"
        const timeLimit = quiz.timeLimit || 0; // 0 = infinito
        titleEl.textContent = quiz.title;

        bodyEl.innerHTML = `
          <div class="text-center py-4">
            <h5 class="fw-bold mb-3">Información de la Prueba</h5>
            <div class="row g-3 justify-content-center mb-4">
              <div class="col-auto text-center border px-4 py-2 rounded mx-1">
                <div class="small text-muted text-uppercase">Tiempo</div>
                <div class="fw-bold fs-5">${timeLimit > 0 ? timeLimit + ' min' : 'Sin límite'}</div>
              </div>
              <div class="col-auto text-center border px-4 py-2 rounded mx-1">
                <div class="small text-muted text-uppercase">Intentos</div>
                <div class="fw-bold fs-5">${usedTries} / ${maxTries}</div>
              </div>
              <div class="col-auto text-center border px-4 py-2 rounded mx-1">
                <div class="small text-muted text-uppercase">Mínimo</div>
                <div class="fw-bold fs-5">${quiz.minScore || 70}%</div>
              </div>
            </div>
            <button id="btn-start-quiz" class="btn btn-primary btn-lg px-5 rounded-pill shadow">
              Comenzar Evaluación
            </button>
          </div>
        `;

        $id('btn-start-quiz').onclick = () => startQuizFlow(quiz);

      } catch (err) {
        console.error(err);
        bodyEl.innerHTML = '<div class="alert alert-danger">Error al cargar evaluación.</div>';
      }
    }

        function startQuizFlow(quiz) {
      const titleEl = $id('aula-quiz-title');
      const bodyEl = $id('aula-quiz-body');
      const btnSubmit = $id('aula-quiz-submit');
      const modalEl = $id('aulaQuizModal');

      const total = Array.isArray(quiz.items) ? quiz.items.length : 0;
      if (!total) {
        bodyEl.innerHTML = '<div class="alert alert-info">Esta evaluación todavía no tiene reactivos.</div>';
        btnSubmit.classList.add('d-none');
        return;
      }

      let currentIndex = 0;
      let hasSubmitted = false;
      const flags = new Set();
      let timeLeftSec = (quiz.timeLimit || 0) * 60;

      if (_timerInterval) clearInterval(_timerInterval);

      // ==== Layout base del quiz (cabecera + slides + controles) ====
      bodyEl.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="small text-muted">
            Pregunta <span id="quiz-current">1</span> de ${total}
          </div>
          <div class="small text-muted">
            Respondidas: <span id="quiz-answered">0</span> / ${total}
          </div>
        </div>

        <div id="quiz-slide-container"></div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <div>
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" id="quiz-btn-prev">
              <i class="bi bi-chevron-left"></i> Anterior
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="quiz-btn-next">
              Siguiente <i class="bi bi-chevron-right"></i>
            </button>
          </div>
          <button type="button" class="btn btn-outline-warning btn-sm" id="quiz-toggle-flag">
            <i class="bi bi-flag"></i> Marcar para revisar
          </button>
        </div>

        <div class="mt-3 border-top pt-2 d-flex flex-wrap justify-content-between align-items-center">
          <div class="small">
            <strong>Preguntas marcadas:</strong>
            <span id="quiz-flag-summary" class="ms-1 text-muted">Ninguna</span>
          </div>
          <button type="button" class="btn btn-link btn-sm p-0" id="quiz-review-flags">
            Revisar marcadas
          </button>
        </div>
      `;

      const slidesHost = $id('quiz-slide-container');

      // ==== Render de todas las preguntas como "slides" ====
      slidesHost.innerHTML = quiz.items.map((q, i) => {
        const opciones = Array.isArray(q.opciones) ? q.opciones : [];
        const tipo = q.tipo || (opciones.length === 2 ? 'vf' : 'mc'); // sólo para info visual

        return `
          <div class="quiz-slide" data-index="${i}">
            <div class="card border-0 shadow-sm mb-2 quiz-item-card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <h6 class="fw-bold mb-0">
                    ${i + 1}. ${q.enunciado || 'Reactivo sin enunciado'}
                  </h6>
                  <span class="badge bg-light text-muted ms-2">
                    ${tipo === 'vf' ? 'Verdadero / Falso' : 'Opción múltiple'}
                  </span>
                </div>

                <div class="quiz-options-group mt-2">
                  ${opciones.map((op, j) => `
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="radio"
                             name="q${i}" id="q${i}_${j}" value="${j}">
                      <label class="form-check-label" for="q${i}_${j}">
                        ${op}
                      </label>
                    </div>
                  `).join('')}
                </div>

                <div class="mt-2">
                  <span class="badge bg-warning-subtle text-warning d-none" data-flag-indicator="${i}">
                    <i class="bi bi-flag-fill"></i> Marcada para revisar
                  </span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      const btnPrev = $id('quiz-btn-prev');
      const btnNext = $id('quiz-btn-next');
      const btnFlag = $id('quiz-toggle-flag');
      const btnReviewFlags = $id('quiz-review-flags');

      // Clonar boton de enviar para evitar listeners viejos
      const neoBtn = btnSubmit.cloneNode(true);
      btnSubmit.replaceWith(neoBtn);
      neoBtn.textContent = 'Enviar evaluación';
      neoBtn.classList.remove('d-none');
      neoBtn.disabled = false;
      bodyEl.style.opacity = '1';

      // ==== Helpers internos ====

      function getSlide(i) {
        return document.querySelector(`.quiz-slide[data-index="${i}"]`);
      }

      function getAnswerIndex(i) {
        const checked = document.querySelector(`input[name="q${i}"]:checked`);
        return checked ? Number(checked.value) : -1;
      }

      function getAnsweredCount() {
        let count = 0;
        for (let i = 0; i < total; i++) {
          if (getAnswerIndex(i) >= 0) count++;
        }
        return count;
      }

      function updateCounters() {
        const answered = getAnsweredCount();
        const answeredLabel = $id('quiz-answered');
        const currentLabel = $id('quiz-current');
        if (answeredLabel) answeredLabel.textContent = answered;
        if (currentLabel) currentLabel.textContent = currentIndex + 1;

        const flagSummary = $id('quiz-flag-summary');
        if (flagSummary) {
          if (!flags.size) {
            flagSummary.textContent = 'Ninguna';
          } else {
            const nums = Array.from(flags).map(i => i + 1).sort((a, b) => a - b);
            flagSummary.textContent = nums.join(', ');
          }
        }
      }

      function updateFlagUI() {
        const flagged = flags.has(currentIndex);

        if (btnFlag) {
          if (flagged) {
            btnFlag.classList.remove('btn-outline-warning');
            btnFlag.classList.add('btn-warning');
            btnFlag.innerHTML = '<i class="bi bi-flag-fill"></i> Marcada';
          } else {
            btnFlag.classList.add('btn-outline-warning');
            btnFlag.classList.remove('btn-warning');
            btnFlag.innerHTML = '<i class="bi bi-flag"></i> Marcar para revisar';
          }
        }

        const indicator = document.querySelector(`[data-flag-indicator="${currentIndex}"]`);
        if (indicator) {
          indicator.classList.toggle('d-none', !flagged);
        }
      }

      function showQuestion(idx) {
        if (idx < 0 || idx >= total) return;
        currentIndex = idx;

        document.querySelectorAll('.quiz-slide').forEach(slide => {
          slide.classList.add('d-none');
        });

        const active = getSlide(currentIndex);
        if (active) active.classList.remove('d-none');

        if (btnPrev) btnPrev.disabled = currentIndex <= 0;
        if (btnNext) btnNext.disabled = currentIndex >= total - 1;

        updateCounters();
        updateFlagUI();
      }

      function collectAnswers() {
        return quiz.items.map((_, i) => getAnswerIndex(i));
      }

      function firstUnansweredFrom(startIdx) {
        for (let i = startIdx; i < total; i++) {
          if (getAnswerIndex(i) < 0) return i;
        }
        return -1;
      }

      function handleSend(auto) {
        if (hasSubmitted) return;

        const answers = collectAnswers();
        const unanswered = answers
          .map((ans, idx) => (ans < 0 ? idx : -1))
          .filter(idx => idx >= 0);
        const flaggedUnanswered = unanswered.filter(idx => flags.has(idx));

        if (!auto) {
          if (flaggedUnanswered.length) {
            const niceList = flaggedUnanswered.map(i => i + 1).join(', ');
            const go = confirm(
              `Tienes ${flaggedUnanswered.length} pregunta(s) marcadas sin responder: ${niceList}.\n\n` +
              `¿Ir a la primera antes de enviar?`
            );
            if (go) {
              showQuestion(flaggedUnanswered[0]);
              return;
            }
          } else if (unanswered.length) {
            const go = confirm(
              `Tienes ${unanswered.length} pregunta(s) sin responder.\n\n` +
              `¿Enviar de todos modos?`
            );
            if (!go) {
              showQuestion(unanswered[0]);
              return;
            }
          }
        }

        submitToServer(auto, answers);
      }

      async function submitToServer(auto, answers) {
        if (hasSubmitted) return;
        hasSubmitted = true;
        if (_timerInterval) clearInterval(_timerInterval);

        neoBtn.disabled = true;
        bodyEl.style.opacity = '0.6';

        try {
          const res = AulaService.evaluateQuiz(quiz, answers);
          let certId = null;

          await AulaService.saveAttempt(_ctx, _uid, _courseId, quiz, res, answers);

          if (res.approved) {
            try {
              certId = await AulaService.issueCertificate(_ctx, _uid, _courseId, res.score);
            } catch (e) {
              console.error(e);
            }

            // --- AGREGAR ESTO AQUÍ ---
            // Notificación de Logro Desbloqueado
            if(window.Notify && _uid) {
                // Obtenemos el título del curso del contexto global o variable _courseData
                const cursoTitulo = _courseData ? (_courseData.titulo || 'Curso') : 'Curso';
                
                window.Notify.send(_uid, {
                    title: '¡Curso Aprobado!',
                    message: `Felicidades, has aprobado "${cursoTitulo}" con ${res.score}%. Tu constancia está lista.`,
                    type: 'aula',
                    link: '/aula'
                });
            }
            // -------------------------
          }

          renderResultScreen(res, certId);
        } catch (e) {
          console.error(e);
          hasSubmitted = false;
          bodyEl.style.opacity = '1';
          neoBtn.disabled = false;
          if (typeof showToast === 'function') {
            showToast('Error enviando respuestas', 'danger');
          }
        }
      }

      function renderResultScreen(res, certId) {
        const passed = res.approved;
        const icon = passed ? 'bi-patch-check-fill text-success' : 'bi-emoji-frown-fill text-warning';
        const msgTitle = passed ? '¡Felicidades, aprobaste!' : 'Intento registrado';
        const msgBody = passed
          ? 'Has alcanzado la calificación mínima requerida para este curso.'
          : 'No alcanzaste la calificación mínima. Puedes volver a intentarlo si aún tienes intentos.';

        if (passed && typeof triggerQuizConfetti === 'function') {
          triggerQuizConfetti();
        }

        const courseTitle =
          (_courseData && (_courseData.titulo || _courseData.title)) || '';

        bodyEl.style.opacity = '1';
        bodyEl.innerHTML = `
          <div class="text-center py-4">
            <div class="display-1 mb-3">
              <i class="bi ${icon}"></i>
            </div>
            <h4 class="fw-bold mb-2">${msgTitle}</h4>
            <p class="text-muted mb-3">${msgBody}</p>

            <div class="d-inline-flex flex-column flex-sm-row gap-2 align-items-center justify-content-center mb-3">
              <div class="badge bg-light text-dark px-3 py-2">
                <div class="small text-muted text-uppercase">Calificación</div>
                <div class="fw-bold fs-4">${res.score}%</div>
              </div>
              <div class="badge bg-light text-dark px-3 py-2">
                <div class="small text-muted text-uppercase">Aciertos</div>
                <div class="fw-bold fs-5">${res.ok} / ${res.total}</div>
              </div>
            </div>
          </div>
        `;

        const footer = modalEl.querySelector('.modal-footer');
        if (footer) {
          footer.innerHTML = '';

          if (passed) {
            const btnVerConst = document.createElement('button');
            btnVerConst.type = 'button';
            btnVerConst.className = 'btn btn-outline-primary flex-fill me-2';
            btnVerConst.textContent = 'Ver constancia';
            btnVerConst.onclick = () => {
              if (global.Aula && typeof global.Aula.verConstancia === 'function') {
                global.Aula.verConstancia(_courseId, courseTitle);
              }
            };

            const btnSalir = document.createElement('button');
            btnSalir.type = 'button';
            btnSalir.className = 'btn btn-primary flex-fill';
            btnSalir.textContent = 'Salir a Aula';
            btnSalir.onclick = () => {
              const m = bootstrap.Modal.getInstance(modalEl);
              if (m) m.hide();

              if (window.SIA_navToAula) {
                window.SIA_navToAula();
              } else {
                window.location.href = '/aula';
              }
            };

            footer.appendChild(btnVerConst);
            footer.appendChild(btnSalir);
          } else {
            const btnCerrar = document.createElement('button');
            btnCerrar.type = 'button';
            btnCerrar.className = 'btn btn-secondary w-100';
            btnCerrar.textContent = 'Cerrar';
            btnCerrar.onclick = () => {
              const m = bootstrap.Modal.getInstance(modalEl);
              if (m) m.hide();
            };
            footer.appendChild(btnCerrar);
          }
        }

        if (typeof showToast === 'function') {
          if (passed) showToast('¡Aprobado! Intento registrado.', 'success');
          else showToast('Intento registrado, pero no aprobado.', 'warning');
        }
      }

      // ==== Listeners de navegación ====
      showQuestion(0);

      if (btnPrev) {
        btnPrev.addEventListener('click', () => {
          showQuestion(currentIndex - 1);
        });
      }

      if (btnNext) {
        btnNext.addEventListener('click', () => {
          const currentAnswered = getAnswerIndex(currentIndex) >= 0;
          if (currentAnswered) {
            const nextUnanswered = firstUnansweredFrom(currentIndex + 1);
            if (nextUnanswered >= 0) {
              showQuestion(nextUnanswered);
              return;
            }
          }
          if (currentIndex < total - 1) {
            showQuestion(currentIndex + 1);
          } else if (typeof showToast === 'function') {
            showToast(
              'Llegaste al final. Puedes revisar las marcadas o enviar la evaluación.',
              'info'
            );
          }
        });
      }

      if (btnFlag) {
        btnFlag.addEventListener('click', () => {
          if (flags.has(currentIndex)) {
            flags.delete(currentIndex);
          } else {
            flags.add(currentIndex);
          }
          updateFlagUI();
          updateCounters();
        });
      }

      if (btnReviewFlags) {
        btnReviewFlags.addEventListener('click', () => {
          if (!flags.size) {
            if (typeof showToast === 'function') {
              showToast('No tienes preguntas marcadas.', 'info');
            }
            return;
          }
          let target = null;
          for (let i = currentIndex + 1; i < total; i++) {
            if (flags.has(i)) { target = i; break; }
          }
          if (target == null) {
            target = Math.min(...Array.from(flags));
          }
          showQuestion(target);
        });
      }

      neoBtn.onclick = () => handleSend(false);

      // ==== Timer en el título ====
      if (timeLeftSec > 0) {
        _timerInterval = setInterval(() => {
          timeLeftSec--;
          const m = Math.floor(timeLeftSec / 60);
          const s = timeLeftSec % 60;
          const color = timeLeftSec < 60 ? 'text-danger' : 'text-primary';
          titleEl.innerHTML = `
            <div class="d-flex justify-content-between w-100 align-items-center">
              <span>${quiz.title}</span>
              <span class="${color} fw-bold font-monospace">
                <i class="bi bi-stopwatch"></i> ${m}:${s < 10 ? '0' + s : s}
              </span>
            </div>
          `;

          if (timeLeftSec <= 0) {
            clearInterval(_timerInterval);
            if (typeof showToast === 'function') {
              showToast('¡Tiempo agotado! Enviando...', 'warning');
            }
            handleSend(true);
          }
        }, 1000);
      } else {
        titleEl.textContent = quiz.title;
      }
    }


    async function initCourse(ctx, courseId) {
      _ctx = ctx;
      _courseId = courseId;
      _uid = ctx.auth.currentUser.uid;
      _courseData = null;
      _lessons = [];
      _current = -1;
      _completed = new Set();
      _lastViewedIndex = null;
      _lastLessonId = null;
      _hasShownInitial = false;

      rewire();

      // 🔹 Limpiar player al cambiar de curso
      const lessonBox = $id('aula-lesson-container');
      if (lessonBox) {
        lessonBox.innerHTML = '<div class="text-muted">Selecciona una lección para comenzar.</div>';
      }
      const prev = $id('aula-lesson-prev');
      const next = $id('aula-lesson-next');
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      const resumeBtn = $id('aula-course-resume');
      if (resumeBtn) {
        resumeBtn.disabled = true;
        resumeBtn.textContent = 'Reanudar última lección';
      }

      const listContainer = $id('aula-course-lessons');
      if (listContainer) listContainer.innerHTML = 'Cargando...';


      try {
        const C = await AulaService.getCourse(ctx, courseId);
        _courseData = C;

        if ($id('aula-course-title')) $id('aula-course-title').textContent = C.titulo || 'Curso sin título';
        if ($id('aula-course-desc')) $id('aula-course-desc').textContent = C.descripcion || 'Sin descripción disponible.';
        if ($id('aula-course-meta')) {
          const horas = C.duracionHoras || C.horas;
          const nivel = C.nivel;
          const parts = [];
          if (horas) parts.push(`${horas} h`);
          if (nivel) parts.push(`Nivel: ${nivel}`);
          $id('aula-course-meta').textContent = parts.join(' • ');
        }

        await AulaService.ensureProgress(ctx, _uid, courseId);

        _unsubProg && _unsubProg();
        _unsubProg = AulaService.streamProgress(ctx, _uid, courseId, s => {
          const data = s.data() || {};
          setProgress(data.progressPct || 0);

          _completed = new Set(Array.isArray(data.completed) ? data.completed : []);
          _lastViewedIndex = typeof data.lastViewed === 'number' ? data.lastViewed : null;
          _lastLessonId = data.lastLessonId || null;

          renderList();
          updateResumeButton();

          // Habilitar Quiz solo si 100%
          const btnQuiz = $id('aula-course-open-quiz');
          if (btnQuiz) {
            if ((data.progressPct || 0) >= 100) {
              btnQuiz.disabled = false;
              btnQuiz.classList.replace('btn-secondary', 'btn-primary');
            } else {
              btnQuiz.disabled = true;
            }
          }

          ensureInitialLesson();
        });

        _unsubLessons && _unsubLessons();
        _unsubLessons = AulaService.streamLessons(ctx, courseId, s => {
          _lessons = s.docs.map(d => ({ id: d.id, ...d.data() }));
          renderList();
          updateResumeButton();

          const box = $id('aula-lesson-container');
          const prev = $id('aula-lesson-prev');
          const next = $id('aula-lesson-next');

          // 🔹 Si no hay lecciones, mostramos un mensaje y desactivamos navegación
          if (!_lessons.length) {
            if (box) {
              box.innerHTML = '<div class="text-muted">Este curso aún no tiene lecciones.</div>';
            }
            if (prev) prev.disabled = true;
            if (next) next.disabled = true;
            return;
          }

          ensureInitialLesson();
        });


        ctx.activeUnsubs.push(_unsubProg, _unsubLessons);

      } catch (e) { console.error(e); }
    }


    function _go(i) { show(i); }
    return { initCourse, _go };
  })();

  global.AulaContent = AulaContent;
})(window);