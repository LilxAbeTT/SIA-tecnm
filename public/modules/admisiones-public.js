if (!window.AdmisionesPublic) {
  window.AdmisionesPublic = (function () {
    const STORAGE_KEY = 'sia_admisiones_guest_v1';
    const STYLE_ID = 'sia-admisiones-public-style';
    const DATA_FILES = {
      admissions: '/data/admisiones-2026.json',
      content: '/data/evaluatec-2026-content.json'
    };

    let _ctx = null;
    let _root = null;
    let _resources = null;
    let _guest = null;
    let _ui = null;
    let _bound = false;

    function createDefaultGuest() {
      const now = new Date().toISOString();
      return {
        guestId: (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `guest-${Date.now()}`),
        selectedCareer: '',
        selectedAreas: [],
        progressByTopic: {},
        practiceResults: {
          scopes: {},
          topicStats: {},
          areaStats: {}
        },
        bookmarks: [],
        lastVisited: null,
        createdAt: now,
        updatedAt: now
      };
    }

    function defaultUiState() {
      return {
        screen: 'home',
        areaId: '',
        topicId: '',
        search: '',
        practiceScope: '',
        quizId: '',
        quizQuestions: [],
        quizAnswers: {},
        quizSubmitted: false,
        quizResult: null,
        quizIndex: 0,
        microAnswers: {}
      };
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const GuestStore = {
      load() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return createDefaultGuest();
          const parsed = JSON.parse(raw);
          return {
            ...createDefaultGuest(),
            ...parsed,
            progressByTopic: parsed?.progressByTopic || {},
            practiceResults: {
              scopes: parsed?.practiceResults?.scopes || {},
              topicStats: parsed?.practiceResults?.topicStats || {},
              areaStats: parsed?.practiceResults?.areaStats || {}
            },
            bookmarks: Array.isArray(parsed?.bookmarks) ? parsed.bookmarks : [],
            selectedAreas: Array.isArray(parsed?.selectedAreas) ? parsed.selectedAreas : []
          };
        } catch (error) {
          console.warn('[AdmisionesPublic] No se pudo leer el progreso local:', error);
          return createDefaultGuest();
        }
      },

      save(nextGuest) {
        _guest = {
          ...nextGuest,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_guest));
        return _guest;
      },

      patch(patch) {
        return this.save({ ..._guest, ...patch });
      },

      updateTopic(topicKey, patch) {
        const current = _guest.progressByTopic[topicKey] || {};
        return this.patch({
          progressByTopic: {
            ..._guest.progressByTopic,
            [topicKey]: {
              ...current,
              ...patch,
              updatedAt: new Date().toISOString()
            }
          }
        });
      },

      toggleBookmark(topicKey) {
        const bookmarks = new Set(_guest.bookmarks || []);
        if (bookmarks.has(topicKey)) bookmarks.delete(topicKey);
        else bookmarks.add(topicKey);
        return this.patch({ bookmarks: Array.from(bookmarks) });
      },

      reset() {
        const fresh = createDefaultGuest();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        _guest = fresh;
        return fresh;
      }
    };

    const ContentRepo = {
      async load() {
        if (_resources) return _resources;
        const [admissions, content] = await Promise.all([
          fetch(`${DATA_FILES.admissions}?v=${window.SIA_VERSION || Date.now()}`).then((res) => res.json()),
          fetch(`${DATA_FILES.content}?v=${window.SIA_VERSION || Date.now()}`).then((res) => res.json())
        ]);
        _resources = { admissions, content };
        return _resources;
      }
    };

    const CareerPlanner = {
      getCareer(careerId) {
        return _resources?.content?.careers?.find((career) => career.id === careerId) || null;
      },

      getAreasForCareer(careerId) {
        return this.getCareer(careerId)?.routeAreaIds || [];
      }
    };

    const PracticeEngine = {
      buildAreaQuiz(areaId) {
        const area = getArea(areaId);
        if (!area) return [];
        return area.topics.map((topic) => ({
          id: `${area.id}-${topic.id}`,
          areaId: area.id,
          areaTitle: area.title,
          topicId: topic.id,
          topicTitle: topic.title,
          question: topic.microPractice.question,
          options: topic.microPractice.options,
          correctIndex: topic.microPractice.correctIndex,
          explanation: topic.microPractice.explanation
        }));
      },

      buildCareerQuiz(careerId) {
        const areaIds = CareerPlanner.getAreasForCareer(careerId);
        const pool = [];
        areaIds.forEach((areaId) => {
          const areaQuestions = this.buildAreaQuiz(areaId);
          pool.push(...areaQuestions.slice(0, Math.min(2, areaQuestions.length)));
        });
        return pool.slice(0, 10);
      },

      grade(questions, answers) {
        let correct = 0;
        const items = questions.map((question, index) => {
          const selectedIndex = Number(answers[question.id]);
          const isCorrect = selectedIndex === question.correctIndex;
          if (isCorrect) correct += 1;
          return {
            ...question,
            selectedIndex,
            isCorrect,
            index
          };
        });

        return {
          correct,
          total: questions.length,
          percent: questions.length ? Math.round((correct / questions.length) * 100) : 0,
          items
        };
      }
    };

    function ensureRoot() {
      _root = document.getElementById('view-admisiones-public');
      return _root;
    }

    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const link = document.createElement('link');
      link.id = STYLE_ID;
      link.rel = 'stylesheet';
      link.href = `/styles/17-admisiones-public.css?v=${window.SIA_VERSION || Date.now()}`;
      document.head.appendChild(link);
    }

    function bindEvents() {
      if (_bound || !_root) return;
      _root.addEventListener('click', handleClick);
      _root.addEventListener('change', handleChange);
      _root.addEventListener('input', handleInput);
      _bound = true;
    }

    function getArea(areaId) {
      return _resources.content.areas.find((area) => area.id === areaId) || null;
    }

    function getTopic(areaId, topicId) {
      return getArea(areaId)?.topics?.find((topic) => topic.id === topicId) || null;
    }

    function getAllTopics() {
      return _resources.content.areas.flatMap((area) =>
        area.topics.map((topic) => ({
          ...topic,
          areaId: area.id,
          areaTitle: area.title,
          roleLabel: area.roleLabel
        }))
      );
    }

    function getTopicKey(areaId, topicId) {
      return `${areaId}::${topicId}`;
    }

    function getRouteAreaIds() {
      return CareerPlanner.getAreasForCareer(_guest.selectedCareer);
    }

    function getTopicProgress(areaId, topicId) {
      return _guest.progressByTopic[getTopicKey(areaId, topicId)] || {};
    }

    function getAreaProgress(areaId) {
      const area = getArea(areaId);
      if (!area) {
        return {
          totalTopics: 0,
          studiedCount: 0,
          studiedPercent: 0,
          averageScore: 0
        };
      }

      const studiedCount = area.topics.filter((topic) => getTopicProgress(area.id, topic.id).studied).length;
      const areaStats = _guest.practiceResults.areaStats?.[area.id];
      const averageScore = areaStats?.total ? Math.round((Number(areaStats.correct || 0) / Number(areaStats.total || 1)) * 100) : 0;

      return {
        totalTopics: area.topics.length,
        studiedCount,
        studiedPercent: area.topics.length ? Math.round((studiedCount / area.topics.length) * 100) : 0,
        averageScore
      };
    }

    function getOrderedAreas() {
      const selected = new Set(getRouteAreaIds());
      return [..._resources.content.areas].sort((a, b) => {
        const aSelected = selected.has(a.id) ? 0 : 1;
        const bSelected = selected.has(b.id) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        return a.title.localeCompare(b.title);
      });
    }

    function getPreferredAreaId() {
      const orderedAreas = getOrderedAreas();
      return getArea(_ui?.areaId)?.id || orderedAreas[0]?.id || '';
    }

    function ensureFocusArea() {
      if (!getArea(_ui.areaId)) {
        _ui.areaId = getPreferredAreaId();
      }
    }

    function hydrateSelectedAreas() {
      const selectedAreas = getRouteAreaIds();
      if (selectedAreas.length && JSON.stringify(selectedAreas) !== JSON.stringify(_guest.selectedAreas)) {
        GuestStore.patch({ selectedAreas });
      }
    }

    function setLastVisited(payload) {
      GuestStore.patch({ lastVisited: payload });
    }

    function applyLastVisited() {
      const lastVisited = _guest.lastVisited;
      if (!lastVisited) {
        _ui = defaultUiState();
        _ui.areaId = getPreferredAreaId();
        return;
      }

      if (lastVisited.kind === 'topic' && getTopic(lastVisited.areaId, lastVisited.topicId)) {
        _ui = {
          ...defaultUiState(),
          screen: 'topic',
          areaId: lastVisited.areaId,
          topicId: lastVisited.topicId
        };
        return;
      }

      if (lastVisited.kind === 'practice') {
        const questions = lastVisited.scope === 'career'
          ? PracticeEngine.buildCareerQuiz(_guest.selectedCareer)
          : PracticeEngine.buildAreaQuiz(lastVisited.areaId);
        _ui = {
          ...defaultUiState(),
          screen: 'practice',
          areaId: lastVisited.areaId || '',
          practiceScope: lastVisited.scope,
          quizId: `${lastVisited.scope}-${lastVisited.areaId || _guest.selectedCareer || 'mix'}`,
          quizQuestions: questions
        };
        ensureFocusArea();
        return;
      }

      _ui = defaultUiState();
      _ui.areaId = getPreferredAreaId();
    }

    function getNextRecommendedTopic(areaIds) {
      const orderedAreaIds = areaIds.length ? areaIds : getOrderedAreas().map((area) => area.id);
      for (let areaIndex = 0; areaIndex < orderedAreaIds.length; areaIndex += 1) {
        const area = getArea(orderedAreaIds[areaIndex]);
        if (!area) continue;
        const pending = area.topics.find((topic) => !getTopicProgress(area.id, topic.id).studied);
        if (pending) {
          return {
            ...pending,
            areaId: area.id,
            areaTitle: area.title,
            roleLabel: area.roleLabel
          };
        }
      }

      const firstArea = getArea(orderedAreaIds[0]);
      const firstTopic = firstArea?.topics?.[0];
      return firstArea && firstTopic ? {
        ...firstTopic,
        areaId: firstArea.id,
        areaTitle: firstArea.title,
        roleLabel: firstArea.roleLabel
      } : null;
    }

    function getTopicNeighbors(areaId, topicId) {
      const area = getArea(areaId);
      if (!area) return { previous: null, next: null };
      const index = area.topics.findIndex((topic) => topic.id === topicId);
      if (index === -1) return { previous: null, next: null };
      return {
        previous: index > 0 ? area.topics[index - 1] : null,
        next: index < area.topics.length - 1 ? area.topics[index + 1] : null
      };
    }

    function getBookmarkedTopics(limit = 4) {
      return (_guest.bookmarks || [])
        .map((topicKey) => {
          const [areaId, topicId] = String(topicKey).split('::');
          const area = getArea(areaId);
          const topic = getTopic(areaId, topicId);
          if (!area || !topic) return null;
          return {
            topicKey,
            areaId,
            topicId,
            areaTitle: area.title,
            title: topic.title,
            summary: topic.summary
          };
        })
        .filter(Boolean)
        .slice(0, limit);
    }

    function getScopeLabel(scopeResult) {
      if (!scopeResult) return '';
      if (scopeResult.scope === 'career') {
        const career = CareerPlanner.getCareer(scopeResult.careerId);
        return career ? `Practica mixta: ${career.shortName}` : 'Practica mixta por carrera';
      }
      const area = getArea(scopeResult.areaId);
      return area ? `Practica de ${area.title}` : 'Practica por area';
    }

    function computeMetrics() {
      const allTopics = getAllTopics();
      const routeAreaIds = getRouteAreaIds();
      const routeTopics = routeAreaIds.length ? allTopics.filter((topic) => routeAreaIds.includes(topic.areaId)) : allTopics;
      const studiedCount = allTopics.filter((topic) => getTopicProgress(topic.areaId, topic.id).studied).length;
      const routeStudiedCount = routeTopics.filter((topic) => getTopicProgress(topic.areaId, topic.id).studied).length;
      const topicStats = _guest.practiceResults.topicStats || {};

      const weakTopics = Object.entries(topicStats)
        .filter(([, stat]) => Number(stat.total || 0) > 0)
        .map(([topicKey, stat]) => {
          const [areaId, topicId] = topicKey.split('::');
          const area = getArea(areaId);
          const topic = getTopic(areaId, topicId);
          if (!area || !topic) return null;
          return {
            topicKey,
            areaId,
            topicId,
            areaTitle: area.title,
            title: topic.title,
            percent: Math.round((Number(stat.correct || 0) / Number(stat.total || 1)) * 100)
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.percent - b.percent)
        .slice(0, 4);

      const recentResults = Object.entries(_guest.practiceResults.scopes || {})
        .map(([id, stat]) => ({ ...stat, id }))
        .sort((a, b) => new Date(b.takenAt || 0) - new Date(a.takenAt || 0))
        .slice(0, 4)
        .map((item) => ({
          ...item,
          label: getScopeLabel(item)
        }));

      const averageScore = recentResults.length
        ? Math.round(recentResults.reduce((sum, item) => sum + Number(item.percent || 0), 0) / recentResults.length)
        : 0;

      const lastScore = recentResults[0] || null;
      const bookmarkedTopics = getBookmarkedTopics();
      const nextTopic = getNextRecommendedTopic(routeAreaIds);

      return {
        totalTopics: allTopics.length,
        studiedCount,
        studiedPercent: allTopics.length ? Math.round((studiedCount / allTopics.length) * 100) : 0,
        routeTopicCount: routeTopics.length,
        routeStudiedCount,
        routeStudiedPercent: routeTopics.length ? Math.round((routeStudiedCount / routeTopics.length) * 100) : 0,
        bookmarkedCount: (_guest.bookmarks || []).length,
        bookmarkedTopics,
        weakTopics,
        recentResults,
        averageScore,
        lastScore,
        nextTopic
      };
    }

    function getNavScreen() {
      if (_ui.screen === 'topic') return 'study';
      if (_ui.screen === 'practice') return 'practice';
      return _ui.screen;
    }

    function hasUnsubmittedPractice() {
      return _ui.screen === 'practice'
        && _ui.quizQuestions.length
        && !_ui.quizSubmitted
        && Object.keys(_ui.quizAnswers || {}).length > 0;
    }

    function confirmDiscardPracticeIfNeeded() {
      if (!hasUnsubmittedPractice()) return true;
      return window.confirm('La practica actual aun no se ha calificado. Si sales ahora, perderas tus respuestas. Deseas continuar?');
    }

    function goToScreen(screen, patch = {}) {
      if (screen !== 'practice' && !confirmDiscardPracticeIfNeeded()) return;
      _ui = {
        ...defaultUiState(),
        screen,
        areaId: patch.areaId || _ui.areaId || getPreferredAreaId(),
        topicId: patch.topicId || '',
        search: patch.search || ''
      };
      ensureFocusArea();
      render();
    }

    function renderPills(items, className = '') {
      return items.map((item) => `<span class="adm-pill ${className}">${escapeHtml(item)}</span>`).join('');
    }

    function renderHeader(metrics) {
      const exam = _resources.admissions.exam;
      const selectedCareer = CareerPlanner.getCareer(_guest.selectedCareer);
      return `
        <section class="adm-hero">
          <div class="adm-hero-top">
            <div class="adm-hero-copy">
              <span class="adm-eyebrow">${escapeHtml(_resources.admissions.hero.eyebrow)}</span>
              <h1 class="adm-title-xl">${escapeHtml(_resources.admissions.hero.title)}</h1>
              <p class="adm-lead">${escapeHtml(_resources.admissions.hero.summary)}</p>
              <div class="adm-action-row">
                <button class="adm-button is-primary" data-action="continue-progress">${_guest.lastVisited ? 'Continuar donde me quede' : 'Empezar a estudiar'}</button>
                <button class="adm-button is-secondary" data-action="go-screen" data-screen="info">Ver proceso 2026</button>
                <a class="adm-button is-ghost-light" href="#/test-vocacional">Test vocacional</a>
              </div>
            </div>
            <div class="adm-hero-summary">
              <div class="adm-hero-focus">
                <div class="adm-section-label is-light">Ruta actual</div>
                <h2>${selectedCareer ? escapeHtml(selectedCareer.name) : 'Aun no eliges carrera'}</h2>
                <p class="adm-copy is-light">${selectedCareer ? 'Tu temario y la practica mixta ya se ordenan segun esta carrera.' : 'Selecciona una carrera para priorizar areas y mostrar una ruta mas clara.'}</p>
                <div class="adm-inline-list">
                  <span class="adm-chip is-light">${escapeHtml(`${metrics.routeStudiedCount} de ${metrics.routeTopicCount} temas de ruta`)}</span>
                  <span class="adm-chip is-light">Ingles obligatorio / no pondera</span>
                </div>
              </div>
            </div>
          </div>
          <div class="adm-hero-stats">
            <article class="adm-stat-card is-hero">
              <div class="adm-stat-value">${escapeHtml(exam.reactives)}</div>
              <div class="adm-stat-label is-light">reactivos oficiales</div>
            </article>
            <article class="adm-stat-card is-hero">
              <div class="adm-stat-value">${escapeHtml(exam.duration)}</div>
              <div class="adm-stat-label is-light">duracion total</div>
            </article>
            <article class="adm-stat-card is-hero">
              <div class="adm-stat-value">${metrics.studiedPercent}%</div>
              <div class="adm-stat-label is-light">avance general</div>
            </article>
            <article class="adm-stat-card is-hero is-wide">
              <div class="adm-stat-label is-light">Lo importante del examen</div>
              <p class="adm-copy is-light">${escapeHtml(exam.englishPolicy)}</p>
            </article>
          </div>
        </section>
      `;
    }

    function renderTopNav() {
      const activeScreen = getNavScreen();
      const items = [
        { id: 'home', label: 'Inicio', helper: 'Tablero general' },
        { id: 'study', label: 'Estudiar', helper: 'Temario por areas' },
        { id: 'practice', label: 'Practicar', helper: 'Mini evaluaciones' },
        { id: 'info', label: 'Admisiones', helper: 'Fechas y registro' }
      ];

      return `
        <nav class="adm-nav">
          ${items.map((item) => `
            <button class="adm-nav-button ${activeScreen === item.id ? 'is-active' : ''}" data-action="go-screen" data-screen="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.helper)}</span>
            </button>
          `).join('')}
        </nav>
      `;
    }

    function renderSidebar(metrics) {
      const selectedCareer = CareerPlanner.getCareer(_guest.selectedCareer);
      const routeAreaIds = getRouteAreaIds();
      return `
        <aside class="adm-sidebar">
          <article class="adm-panel">
            <div class="adm-section-label">Tu ruta</div>
            <h3 class="adm-panel-title">${selectedCareer ? escapeHtml(selectedCareer.shortName) : 'Configura tu ruta'}</h3>
            <p class="adm-meta">${selectedCareer ? 'Tus areas recomendadas aparecen primero en estudiar y practicar.' : 'Elige una carrera para ordenar el modulo segun el examen que te corresponde.'}</p>
            ${selectedCareer ? `<div class="adm-pill-row">${routeAreaIds.map((areaId) => `<span class="adm-pill">${escapeHtml(getArea(areaId)?.title || areaId)}</span>`).join('')}</div>` : ''}
            <div class="adm-action-row">
              <button class="adm-button is-ghost" data-action="go-screen" data-screen="home">${selectedCareer ? 'Cambiar carrera' : 'Elegir carrera'}</button>
              ${selectedCareer ? '<button class="adm-button is-ghost" data-action="clear-career">Ver todo el temario</button>' : ''}
            </div>
          </article>

          <article class="adm-panel">
            <div class="adm-section-label">Avance</div>
            <div class="adm-metric-stack">
              <div>
                <div class="adm-stat-value">${metrics.studiedPercent}%</div>
                <div class="adm-stat-label">avance general</div>
              </div>
              <div>
                <div class="adm-progress-bar"><div class="adm-progress-fill" style="width:${metrics.routeStudiedPercent}%"></div></div>
                <div class="adm-note">${metrics.routeStudiedCount} de ${metrics.routeTopicCount} temas de tu ruta revisados</div>
              </div>
              <div class="adm-mini-metrics">
                <div><strong>${metrics.averageScore}%</strong><span>promedio en practica</span></div>
                <div><strong>${metrics.bookmarkedCount}</strong><span>temas guardados</span></div>
              </div>
              <div class="adm-action-row">
                <button class="adm-button is-ghost" data-action="reset-progress">Reiniciar progreso local</button>
              </div>
            </div>
          </article>

          <article class="adm-panel">
            <div class="adm-section-label">Siguiente paso</div>
            ${metrics.nextTopic ? `
              <div class="adm-sidebar-focus">
                <strong>${escapeHtml(metrics.nextTopic.title)}</strong>
                <p class="adm-meta">${escapeHtml(metrics.nextTopic.areaTitle)}</p>
                <p class="adm-note">${escapeHtml(metrics.nextTopic.summary)}</p>
                <div class="adm-action-row">
                  <button class="adm-button is-primary" data-action="open-topic" data-area-id="${escapeHtml(metrics.nextTopic.areaId)}" data-topic-id="${escapeHtml(metrics.nextTopic.id)}">Abrir tema</button>
                </div>
              </div>
            ` : '<div class="adm-empty-state compact">Tu siguiente recomendacion aparecera aqui conforme avances.</div>'}
          </article>

          <article class="adm-panel">
            <div class="adm-section-label">Guardados</div>
            ${metrics.bookmarkedTopics.length ? `
              <div class="adm-compact-list">
                ${metrics.bookmarkedTopics.map((topic) => `
                  <button class="adm-compact-link" data-action="open-topic" data-area-id="${escapeHtml(topic.areaId)}" data-topic-id="${escapeHtml(topic.topicId)}">
                    <strong>${escapeHtml(topic.title)}</strong>
                    <span>${escapeHtml(topic.areaTitle)}</span>
                  </button>
                `).join('')}
              </div>
            ` : '<div class="adm-empty-state compact">Todavia no guardas temas.</div>'}
          </article>

          <article class="adm-panel is-accent">
            <div class="adm-section-label">Recurso extra</div>
            <h3 class="adm-panel-title">Test vocacional</h3>
            <p class="adm-meta">Si aun no decides carrera, puedes tomar el test vocacional sin salir de SIA.</p>
            <a class="adm-button is-secondary-solid" href="#/test-vocacional">Ir al test</a>
          </article>
        </aside>
      `;
    }

    function renderHomeScreen(metrics) {
      const selectedCareer = CareerPlanner.getCareer(_guest.selectedCareer);
      const timeline = _resources.admissions.timeline;
      const weakTopicsHtml = metrics.weakTopics.length
        ? metrics.weakTopics.map((topic) => `
            <article class="adm-soft-card">
              <div class="adm-chip is-accent">${escapeHtml(topic.areaTitle)}</div>
              <h4>${escapeHtml(topic.title)}</h4>
              <p class="adm-meta">Rendimiento reciente: ${topic.percent}%</p>
              <button class="adm-button is-ghost" data-action="open-topic" data-area-id="${escapeHtml(topic.areaId)}" data-topic-id="${escapeHtml(topic.topicId)}">Reforzar tema</button>
            </article>
          `).join('')
        : '<div class="adm-empty-state">Tus temas debiles apareceran cuando completes practicas por area o por carrera.</div>';

      return `
        <section class="adm-screen">
          <div class="adm-screen-grid is-home">
            <article class="adm-panel">
              <div class="adm-section-label">Como usar este modulo</div>
              <h2 class="adm-panel-title">Empieza sin perderte</h2>
              <ol class="adm-steps-list">
                <li><strong>1.</strong><span>Elige tu carrera para activar una ruta recomendada.</span></li>
                <li><strong>2.</strong><span>Estudia un tema a la vez y marca tu avance solo cuando lo entiendas.</span></li>
                <li><strong>3.</strong><span>Haz practicas cortas por area y una practica mixta por carrera.</span></li>
                <li><strong>4.</strong><span>Regresa a tus temas debiles y guardados hasta sentirte seguro.</span></li>
              </ol>
              <div class="adm-action-row">
                <button class="adm-button is-primary" data-action="go-screen" data-screen="study">Ir a estudiar</button>
                <button class="adm-button is-ghost" data-action="go-screen" data-screen="practice">Ir a practicar</button>
              </div>
            </article>

            <article class="adm-panel">
              <div class="adm-section-label">Fechas clave</div>
              <h2 class="adm-panel-title">Proceso de admision 2026</h2>
              <div class="adm-compact-list">
                ${timeline.map((item) => `
                  <div class="adm-compact-item">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.date)}</span>
                  </div>
                `).join('')}
              </div>
              <div class="adm-action-row">
                <button class="adm-button is-ghost" data-action="go-screen" data-screen="info">Ver detalles del proceso</button>
              </div>
            </article>

            <article class="adm-panel">
              <div class="adm-section-label">Recomendado hoy</div>
              <h2 class="adm-panel-title">${metrics.nextTopic ? escapeHtml(metrics.nextTopic.title) : 'Configura tu ruta'}</h2>
              <p class="adm-meta">${metrics.nextTopic ? escapeHtml(metrics.nextTopic.summary) : 'Selecciona una carrera para que el sistema te sugiera por donde empezar.'}</p>
              ${metrics.nextTopic ? `<div class="adm-pill-row"><span class="adm-pill">${escapeHtml(metrics.nextTopic.areaTitle)}</span><span class="adm-pill">${escapeHtml(metrics.nextTopic.estimatedMinutes)} min</span></div>` : ''}
              <div class="adm-mini-metrics">
                <div><strong>${metrics.lastScore ? `${metrics.lastScore.percent}%` : '--'}</strong><span>ultimo resultado</span></div>
                <div><strong>${metrics.averageScore}%</strong><span>promedio reciente</span></div>
              </div>
              <div class="adm-action-row">
                ${metrics.nextTopic ? `<button class="adm-button is-primary" data-action="open-topic" data-area-id="${escapeHtml(metrics.nextTopic.areaId)}" data-topic-id="${escapeHtml(metrics.nextTopic.id)}">Seguir recomendacion</button>` : '<button class="adm-button is-primary" data-action="go-screen" data-screen="home">Elegir carrera</button>'}
              </div>
            </article>
          </div>

          <section class="adm-subsection">
            <div class="adm-section-header">
              <div>
                <div class="adm-kicker">Elige tu carrera</div>
                <h2>Activa una ruta clara desde el inicio</h2>
              </div>
              <div class="adm-note">${selectedCareer ? `Ruta activa: ${escapeHtml(selectedCareer.name)}` : 'Puedes estudiar todo el temario, pero la ruta por carrera te lo organiza mejor.'}</div>
            </div>
            <div class="adm-career-grid">
              ${_resources.content.careers.map((career) => {
                const isActive = career.id === _guest.selectedCareer;
                return `
                  <button class="adm-career-choice ${isActive ? 'is-active' : ''}" data-action="select-career" data-career-id="${escapeHtml(career.id)}">
                    <div class="adm-career-choice-top">
                      <span class="adm-chip">${escapeHtml(career.shortName)}</span>
                      ${isActive ? '<span class="adm-chip is-accent">Ruta activa</span>' : ''}
                    </div>
                    <strong>${escapeHtml(career.name)}</strong>
                    <p>${escapeHtml(career.routeAreaIds.map((areaId) => getArea(areaId)?.title || areaId).join(' | '))}</p>
                  </button>
                `;
              }).join('')}
            </div>
            ${selectedCareer ? `
              <div class="adm-action-row top-gap">
                <button class="adm-button is-ghost" data-action="clear-career">Quitar filtro de carrera</button>
                <button class="adm-button is-primary" data-action="go-screen" data-screen="study">Abrir mi ruta</button>
              </div>
            ` : ''}
          </section>

          ${selectedCareer ? `
            <section class="adm-subsection">
              <div class="adm-section-header">
                <div>
                  <div class="adm-kicker">Ruta recomendada</div>
                  <h2>Estas areas deberias priorizar primero</h2>
                </div>
                <button class="adm-button is-ghost" data-action="go-screen" data-screen="practice">Practicar esta ruta</button>
              </div>
              <div class="adm-route-grid">
                ${getRouteAreaIds().map((areaId) => {
                  const area = getArea(areaId);
                  const stats = getAreaProgress(areaId);
                  if (!area) return '';
                  return `
                    <article class="adm-route-card">
                      <span class="adm-chip">${escapeHtml(area.roleLabel)}</span>
                      <h3>${escapeHtml(area.title)}</h3>
                      <p class="adm-meta">${escapeHtml(area.summary)}</p>
                      <div class="adm-progress-bar"><div class="adm-progress-fill" style="width:${stats.studiedPercent}%"></div></div>
                      <div class="adm-note">${stats.studiedCount} de ${stats.totalTopics} temas revisados</div>
                      <div class="adm-action-row">
                        <button class="adm-button is-ghost" data-action="focus-area" data-area-id="${escapeHtml(area.id)}">Abrir area</button>
                      </div>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>
          ` : ''}

          <section class="adm-subsection">
            <div class="adm-section-header">
              <div>
                <div class="adm-kicker">Temas a reforzar</div>
                <h2>Vuelve primero a lo que mas te cuesta</h2>
              </div>
            </div>
            <div class="adm-card-grid">
              ${weakTopicsHtml}
            </div>
          </section>
        </section>
      `;
    }

    function renderStudyScreen() {
      ensureFocusArea();
      const routeAreaIds = new Set(getRouteAreaIds());
      const activeArea = getArea(_ui.areaId) || getOrderedAreas()[0];
      const search = String(_ui.search || '').trim().toLowerCase();
      const filteredTopics = activeArea
        ? activeArea.topics.filter((topic) => {
          if (!search) return true;
          const haystack = [
            topic.title,
            topic.summary,
            ...(topic.officialCoverage || [])
          ].join(' ').toLowerCase();
          return haystack.includes(search);
        })
        : [];
      const areaStats = activeArea ? getAreaProgress(activeArea.id) : null;
      const firstPending = activeArea?.topics.find((topic) => !getTopicProgress(activeArea.id, topic.id).studied) || activeArea?.topics?.[0] || null;

      return `
        <section class="adm-screen">
          <div class="adm-section-header">
            <div>
              <div class="adm-kicker">Estudiar</div>
              <h2>Temario adaptado por areas</h2>
              <p class="adm-note">Abre un area, estudia un tema a la vez y marca tu avance cuando de verdad lo domines.</p>
            </div>
            <div class="adm-search-field">
              <input class="adm-search-input" type="search" placeholder="Buscar tema o palabra clave" data-action="study-search" value="${escapeHtml(_ui.search || '')}">
              ${_ui.search ? '<button class="adm-button is-ghost" data-action="clear-search">Limpiar</button>' : ''}
            </div>
          </div>

          <div class="adm-area-tabs">
            ${getOrderedAreas().map((area) => {
              const stats = getAreaProgress(area.id);
              const isActive = activeArea && area.id === activeArea.id;
              return `
                <button class="adm-area-tab ${isActive ? 'is-active' : ''} ${routeAreaIds.has(area.id) ? 'is-route' : ''}" data-action="focus-area" data-area-id="${escapeHtml(area.id)}">
                  <strong>${escapeHtml(area.title)}</strong>
                  <span>${stats.studiedCount}/${stats.totalTopics} temas</span>
                </button>
              `;
            }).join('')}
          </div>

          ${activeArea ? `
            <div class="adm-study-layout">
              <article class="adm-panel">
                <div class="adm-section-label">${escapeHtml(activeArea.roleLabel)}</div>
                <h2 class="adm-panel-title">${escapeHtml(activeArea.title)}</h2>
                <p class="adm-meta">${escapeHtml(activeArea.summary)}</p>
                <div class="adm-progress-bar"><div class="adm-progress-fill" style="width:${areaStats.studiedPercent}%"></div></div>
                <div class="adm-note">${areaStats.studiedCount} de ${areaStats.totalTopics} temas revisados</div>
                <div class="adm-info-list top-gap">
                  <div><strong>Estrategia recomendada</strong><span>${escapeHtml(activeArea.strategy)}</span></div>
                  <div><strong>Cobertura oficial</strong><span>${escapeHtml(activeArea.officialCoverage.join(' | '))}</span></div>
                  ${activeArea.id === 'ingles' ? '<div><strong>Nota importante</strong><span>Es obligatorio y diagnostico, pero no suma al puntaje global.</span></div>' : ''}
                </div>
                <div class="adm-action-row top-gap">
                  ${firstPending ? `<button class="adm-button is-primary" data-action="open-topic" data-area-id="${escapeHtml(activeArea.id)}" data-topic-id="${escapeHtml(firstPending.id)}">Continuar en esta area</button>` : ''}
                  <button class="adm-button is-ghost" data-action="start-area-practice" data-area-id="${escapeHtml(activeArea.id)}">Practicar esta area</button>
                </div>
              </article>

              <div class="adm-topic-stack">
                ${filteredTopics.length ? filteredTopics.map((topic) => {
                  const topicKey = getTopicKey(activeArea.id, topic.id);
                  const progress = _guest.progressByTopic[topicKey] || {};
                  const bookmarked = (_guest.bookmarks || []).includes(topicKey);
                  return `
                    <article class="adm-topic-entry ${bookmarked ? 'is-bookmarked' : ''}">
                      <div class="adm-topic-entry-head">
                        <div>
                          <h3>${escapeHtml(topic.title)}</h3>
                          <p class="adm-meta">${escapeHtml(topic.summary)}</p>
                        </div>
                        <div class="adm-pill-row">
                          <span class="adm-pill">${escapeHtml(topic.estimatedMinutes)} min</span>
                          ${progress.studied ? '<span class="adm-pill is-success">Revisado</span>' : ''}
                        </div>
                      </div>
                      <div class="adm-pill-row">
                        ${renderPills((topic.officialCoverage || []).slice(0, 4))}
                      </div>
                      <div class="adm-action-row">
                        <button class="adm-button is-primary" data-action="open-topic" data-area-id="${escapeHtml(activeArea.id)}" data-topic-id="${escapeHtml(topic.id)}">Estudiar tema</button>
                        <button class="adm-button is-ghost" data-action="toggle-bookmark" data-area-id="${escapeHtml(activeArea.id)}" data-topic-id="${escapeHtml(topic.id)}">${bookmarked ? 'Quitar guardado' : 'Guardar tema'}</button>
                      </div>
                    </article>
                  `;
                }).join('') : '<div class="adm-empty-state">No hay temas que coincidan con esa busqueda dentro de esta area.</div>'}
              </div>
            </div>
          ` : ''}
        </section>
      `;
    }

    function renderTopicDetail() {
      const area = getArea(_ui.areaId);
      const topic = getTopic(_ui.areaId, _ui.topicId);
      if (!area || !topic) return '';

      const topicKey = getTopicKey(area.id, topic.id);
      const progress = _guest.progressByTopic[topicKey] || {};
      const microAnswer = _ui.microAnswers[topicKey];
      const microEvaluated = Number.isInteger(microAnswer);
      const microCorrect = microEvaluated && microAnswer === topic.microPractice.correctIndex;
      const { previous, next } = getTopicNeighbors(area.id, topic.id);

      return `
        <section class="adm-screen">
          <div class="adm-breadcrumbs">
            <button class="adm-breadcrumb-button" data-action="go-screen" data-screen="study">Temario</button>
            <span>/</span>
            <button class="adm-breadcrumb-button" data-action="focus-area" data-area-id="${escapeHtml(area.id)}">${escapeHtml(area.title)}</button>
            <span>/</span>
            <strong>${escapeHtml(topic.title)}</strong>
          </div>

          <div class="adm-section-header">
            <div>
              <div class="adm-kicker">Tema activo</div>
              <h2>${escapeHtml(topic.title)}</h2>
              <p class="adm-note">${escapeHtml(topic.summary)}</p>
            </div>
            <div class="adm-toolbar">
              <button class="adm-button is-ghost" data-action="toggle-bookmark" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}">${(_guest.bookmarks || []).includes(topicKey) ? 'Quitar guardado' : 'Guardar tema'}</button>
              <button class="adm-button is-primary" data-action="mark-topic-studied" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}">${progress.studied ? 'Mantener como revisado' : 'Marcar como revisado'}</button>
            </div>
          </div>

          <div class="adm-topic-detail-grid">
            <article class="adm-panel">
              <div class="adm-pill-row">
                <span class="adm-pill">${escapeHtml(area.title)}</span>
                <span class="adm-pill">${escapeHtml(area.roleLabel)}</span>
                <span class="adm-pill">${escapeHtml(topic.estimatedMinutes)} min</span>
                ${progress.studied ? '<span class="adm-pill is-success">Tema revisado</span>' : ''}
              </div>

              <div class="adm-topic-block">
                <div class="adm-section-label">Lo esencial</div>
                <p>${escapeHtml(topic.explanation)}</p>
              </div>

              <div class="adm-topic-block">
                <div class="adm-section-label">Lo que si entra de este tema</div>
                <div class="adm-pill-row">
                  ${renderPills(topic.officialCoverage || [])}
                </div>
              </div>

              <div class="adm-topic-block">
                <div class="adm-section-label">Ejemplo resuelto</div>
                <p><strong>Problema:</strong> ${escapeHtml(topic.solvedExample.problem)}</p>
                <ol class="adm-steps-list simple">
                  ${topic.solvedExample.steps.map((step, index) => `<li><strong>${index + 1}.</strong><span>${escapeHtml(step)}</span></li>`).join('')}
                </ol>
                <p><strong>Respuesta:</strong> ${escapeHtml(topic.solvedExample.answer)}</p>
              </div>

              <div class="adm-topic-block">
                <div class="adm-section-label">Errores comunes</div>
                <ul class="adm-checklist">
                  ${topic.commonMistakes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
              </div>
            </article>

            <aside class="adm-panel">
              <div class="adm-section-label">Micropractica</div>
              <h3 class="adm-panel-title">${escapeHtml(topic.microPractice.question)}</h3>
              <div class="adm-option-list">
                ${topic.microPractice.options.map((option, index) => {
                  let optionClass = '';
                  if (microEvaluated) {
                    if (index === topic.microPractice.correctIndex) optionClass = 'is-correct';
                    else if (index === microAnswer) optionClass = 'is-wrong';
                  }
                  return `
                    <label class="adm-option ${optionClass}">
                      <input type="radio" name="micro-${escapeHtml(topicKey)}" value="${index}" data-action="set-micro-answer" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}" ${microAnswer === index ? 'checked' : ''}>
                      <span>${escapeHtml(option)}</span>
                    </label>
                  `;
                }).join('')}
              </div>
              ${microEvaluated ? `<div class="adm-alert ${microCorrect ? 'is-success' : 'is-warning'}">${escapeHtml(topic.microPractice.explanation)}</div>` : ''}

              <div class="adm-topic-block">
                <div class="adm-section-label">Checkpoint</div>
                <p>${escapeHtml(topic.checkpoint.prompt)}</p>
                <ul class="adm-checklist">
                  ${topic.checkpoint.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
              </div>

              <div class="adm-action-row">
                <button class="adm-button is-ghost" data-action="start-area-practice" data-area-id="${escapeHtml(area.id)}">Practicar ${escapeHtml(area.title)}</button>
                <button class="adm-button is-ghost" data-action="focus-area" data-area-id="${escapeHtml(area.id)}">Volver al area</button>
              </div>
            </aside>
          </div>

          <div class="adm-pagination-row">
            ${previous ? `<button class="adm-button is-ghost" data-action="open-topic" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(previous.id)}">Tema anterior: ${escapeHtml(previous.title)}</button>` : '<span></span>'}
            ${next ? `<button class="adm-button is-primary" data-action="open-topic" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(next.id)}">Siguiente tema: ${escapeHtml(next.title)}</button>` : `<button class="adm-button is-primary" data-action="start-area-practice" data-area-id="${escapeHtml(area.id)}">Practicar esta area</button>`}
          </div>
        </section>
      `;
    }

    function renderPracticeHub(metrics) {
      const selectedCareer = CareerPlanner.getCareer(_guest.selectedCareer);
      const practiceAreas = getOrderedAreas();
      return `
        <section class="adm-screen">
          <div class="adm-section-header">
            <div>
              <div class="adm-kicker">Practicar</div>
              <h2>Mini evaluaciones y practica mixta</h2>
              <p class="adm-note">Aqui practicas una pregunta a la vez. La meta es detectar huecos y reforzar temas, no copiar el examen oficial.</p>
            </div>
            ${selectedCareer ? '<button class="adm-button is-primary" data-action="start-career-practice">Practica mixta de mi ruta</button>' : '<button class="adm-button is-ghost" data-action="go-screen" data-screen="home">Elegir carrera primero</button>'}
          </div>

          <div class="adm-screen-grid">
            <article class="adm-panel">
              <div class="adm-section-label">Como se recomienda usar</div>
              <h3 class="adm-panel-title">Haz practica corta, corrige y vuelve al tema</h3>
              <ol class="adm-steps-list simple">
                <li><strong>1.</strong><span>Practica una sola area cuando estes estudiando ese bloque.</span></li>
                <li><strong>2.</strong><span>Usa la practica mixta cuando ya tengas una carrera seleccionada.</span></li>
                <li><strong>3.</strong><span>Si fallas, abre el tema asociado y repasa antes de volver a intentar.</span></li>
              </ol>
            </article>

            <article class="adm-panel">
              <div class="adm-section-label">Resultados recientes</div>
              ${metrics.recentResults.length ? `
                <div class="adm-compact-list">
                  ${metrics.recentResults.map((item) => `
                    <div class="adm-compact-item">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${item.percent}%</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<div class="adm-empty-state compact">Aun no has calificado practicas.</div>'}
            </article>
          </div>

          <div class="adm-practice-grid">
            ${practiceAreas.map((area) => {
              const stats = getAreaProgress(area.id);
              const isRoute = getRouteAreaIds().includes(area.id);
              return `
                <article class="adm-practice-card ${isRoute ? 'is-route' : ''}">
                  <div class="adm-practice-card-top">
                    <span class="adm-chip">${escapeHtml(area.roleLabel)}</span>
                    ${isRoute ? '<span class="adm-chip is-accent">Ruta</span>' : ''}
                  </div>
                  <h3>${escapeHtml(area.title)}</h3>
                  <p class="adm-meta">${escapeHtml(area.strategy)}</p>
                  <div class="adm-mini-metrics">
                    <div><strong>${area.topics.length}</strong><span>reactivos base</span></div>
                    <div><strong>${stats.averageScore}%</strong><span>acierto por area</span></div>
                  </div>
                  <div class="adm-action-row">
                    <button class="adm-button is-primary" data-action="start-area-practice" data-area-id="${escapeHtml(area.id)}">Practicar area</button>
                    <button class="adm-button is-ghost" data-action="focus-area" data-area-id="${escapeHtml(area.id)}">Ver temario</button>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }

    function renderPracticeRun() {
      const currentQuestion = _ui.quizQuestions[_ui.quizIndex];
      if (!currentQuestion) return renderPracticeHub(computeMetrics());

      const answeredCount = _ui.quizQuestions.filter((question) => Object.prototype.hasOwnProperty.call(_ui.quizAnswers, question.id)).length;
      const questionResult = _ui.quizSubmitted && _ui.quizResult ? _ui.quizResult.items[_ui.quizIndex] : null;
      const allAnswered = answeredCount === _ui.quizQuestions.length;
      const currentArea = getArea(currentQuestion.areaId);

      return `
        <section class="adm-screen">
          <div class="adm-section-header">
            <div>
              <div class="adm-kicker">Practica activa</div>
              <h2>${escapeHtml(_ui.practiceScope === 'career' ? 'Practica mixta por carrera' : `Practica de ${currentQuestion.areaTitle}`)}</h2>
              <p class="adm-note">Avanza pregunta por pregunta y califica cuando completes todos los reactivos.</p>
            </div>
            <div class="adm-toolbar">
              <button class="adm-button is-ghost" data-action="go-screen" data-screen="practice">Volver a practicas</button>
              <button class="adm-button is-ghost" data-action="restart-practice">Reiniciar</button>
            </div>
          </div>

          <div class="adm-practice-run">
            <aside class="adm-panel">
              <div class="adm-section-label">Progreso</div>
              <div class="adm-stat-value">${answeredCount}/${_ui.quizQuestions.length}</div>
              <div class="adm-stat-label">preguntas respondidas</div>
              <div class="adm-progress-bar"><div class="adm-progress-fill" style="width:${Math.round((answeredCount / _ui.quizQuestions.length) * 100)}%"></div></div>
              <div class="adm-question-nav">
                ${_ui.quizQuestions.map((question, index) => `
                  <button class="adm-question-dot ${index === _ui.quizIndex ? 'is-active' : ''} ${Object.prototype.hasOwnProperty.call(_ui.quizAnswers, question.id) ? 'is-answered' : ''}" data-action="jump-question" data-question-index="${index}">${index + 1}</button>
                `).join('')}
              </div>
              ${_ui.quizSubmitted && _ui.quizResult ? `
                <div class="adm-result-card">
                  <div class="adm-score-pill">Resultado: ${_ui.quizResult.percent}%</div>
                  <p class="adm-note">${_ui.quizResult.correct} de ${_ui.quizResult.total} reactivos correctos.</p>
                  <button class="adm-button is-primary" data-action="open-topic" data-area-id="${escapeHtml(currentQuestion.areaId)}" data-topic-id="${escapeHtml(currentQuestion.topicId)}">Repasar este tema</button>
                </div>
              ` : `
                <div class="adm-note-box">
                  ${allAnswered ? 'Ya puedes calificar la practica.' : 'Te faltan respuestas antes de calificar.'}
                </div>
              `}
            </aside>

            <article class="adm-panel">
              <div class="adm-pill-row">
                <span class="adm-pill">Pregunta ${_ui.quizIndex + 1} de ${_ui.quizQuestions.length}</span>
                <span class="adm-pill">${escapeHtml(currentQuestion.areaTitle)}</span>
                ${currentArea?.id === 'ingles' ? '<span class="adm-pill">Diagnostico</span>' : ''}
              </div>
              <h3 class="adm-panel-title">${escapeHtml(currentQuestion.topicTitle)}</h3>
              <p>${escapeHtml(currentQuestion.question)}</p>

              <div class="adm-option-list">
                ${currentQuestion.options.map((option, optionIndex) => {
                  let optionClass = '';
                  if (_ui.quizSubmitted && questionResult) {
                    if (optionIndex === currentQuestion.correctIndex) optionClass = 'is-correct';
                    else if (Number(_ui.quizAnswers[currentQuestion.id]) === optionIndex) optionClass = 'is-wrong';
                  }
                  return `
                    <label class="adm-option ${optionClass}">
                      <input type="radio" name="practice-${escapeHtml(currentQuestion.id)}" value="${optionIndex}" data-action="practice-answer" data-question-id="${escapeHtml(currentQuestion.id)}" ${Number(_ui.quizAnswers[currentQuestion.id]) === optionIndex ? 'checked' : ''} ${_ui.quizSubmitted ? 'disabled' : ''}>
                      <span>${escapeHtml(option)}</span>
                    </label>
                  `;
                }).join('')}
              </div>

              ${_ui.quizSubmitted && questionResult ? `
                <div class="adm-alert ${questionResult.isCorrect ? 'is-success' : 'is-warning'}">
                  ${escapeHtml(currentQuestion.explanation)}
                </div>
              ` : ''}

              <div class="adm-toolbar top-gap">
                <button class="adm-button is-ghost" data-action="prev-question" ${_ui.quizIndex === 0 ? 'disabled' : ''}>Pregunta anterior</button>
                ${_ui.quizSubmitted
                  ? `<button class="adm-button is-primary" data-action="next-question" ${_ui.quizIndex === _ui.quizQuestions.length - 1 ? 'disabled' : ''}>Siguiente pregunta</button>`
                  : _ui.quizIndex === _ui.quizQuestions.length - 1
                    ? `<button class="adm-button is-primary" data-action="submit-practice">Calificar practica</button>`
                    : `<button class="adm-button is-primary" data-action="next-question">Siguiente pregunta</button>`}
              </div>
            </article>
          </div>
        </section>
      `;
    }

    function renderInfoScreen() {
      const admissions = _resources.admissions;
      return `
        <section class="adm-screen">
          <div class="adm-section-header">
            <div>
              <div class="adm-kicker">Admisiones 2026</div>
              <h2>Lo oficial que si necesitas para tu tramite</h2>
              <p class="adm-note">Aqui esta la parte informativa del proceso: fechas, registro, pago, requisitos y contacto.</p>
            </div>
            <a class="adm-button is-primary" href="${escapeHtml(admissions.platform.registrationUrl)}" target="_blank" rel="noopener">Ir al portal de registro</a>
          </div>

          <div class="adm-card-grid">
            <article class="adm-soft-card">
              <div class="adm-section-label">Fichas</div>
              <h3>09 febrero al 30 abril 2026</h3>
              <p class="adm-meta">Registro y pago del derecho de admision.</p>
            </article>
            <article class="adm-soft-card">
              <div class="adm-section-label">Examen</div>
              <h3>Sabado 16 mayo 2026</h3>
              <p class="adm-meta">Modalidad en linea. Duracion total: 3 horas.</p>
            </article>
            <article class="adm-soft-card">
              <div class="adm-section-label">Propedeutico</div>
              <h3>06 al 17 julio 2026</h3>
              <p class="adm-meta">Curso presencial para quienes sigan en el proceso.</p>
            </article>
            <article class="adm-soft-card">
              <div class="adm-section-label">Costo</div>
              <h3>${escapeHtml(admissions.payment.amount)}</h3>
              <p class="adm-meta">Incluye ficha, examen de admision y curso propedeutico.</p>
            </article>
          </div>

          <div class="adm-info-layout">
            <article class="adm-panel">
              <div class="adm-section-label">Pasos del proceso</div>
              <div class="adm-timeline">
                ${admissions.processSteps.map((step) => `
                  <div class="adm-timeline-item">
                    <div class="adm-timeline-dot"></div>
                    <div>
                      <strong>${escapeHtml(step.title)}</strong>
                      <div class="adm-chip">${escapeHtml(step.dateLabel)}</div>
                      <p class="adm-meta">${escapeHtml(step.description)}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </article>

            <article class="adm-panel">
              <div class="adm-section-label">Registro y soporte</div>
              <div class="adm-info-list">
                <div><strong>Pago</strong><span>${escapeHtml(admissions.payment.flow)}</span></div>
                <div><strong>Banco</strong><span>${escapeHtml(admissions.payment.bank)}</span></div>
                <div><strong>Correo</strong><span><a href="mailto:${escapeHtml(admissions.support.email)}">${escapeHtml(admissions.support.email)}</a></span></div>
                <div><strong>Telefonos</strong><span>${admissions.support.phones.map((phone) => escapeHtml(phone)).join('<br>')}</span></div>
                <div><strong>Horario</strong><span>${escapeHtml(admissions.support.hours)}</span></div>
              </div>
              <div class="adm-action-row top-gap">
                <a class="adm-button is-ghost" href="${escapeHtml(admissions.support.officialSite)}" target="_blank" rel="noopener">Sitio oficial</a>
                <a class="adm-button is-ghost" href="${escapeHtml(admissions.support.videoGuide)}" target="_blank" rel="noopener">Video guia</a>
              </div>
            </article>
          </div>

          <div class="adm-card-grid">
            <article class="adm-soft-card">
              <div class="adm-section-label">Requisitos</div>
              <ul class="adm-checklist">
                ${admissions.requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="adm-soft-card">
              <div class="adm-section-label">Antes del examen</div>
              <ul class="adm-checklist">
                ${admissions.examDay.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="adm-soft-card">
              <div class="adm-section-label">Preguntas frecuentes</div>
              <div class="adm-compact-list">
                ${admissions.faq.map((item) => `
                  <div class="adm-compact-item is-text">
                    <strong>${escapeHtml(item.question)}</strong>
                    <span>${escapeHtml(item.answer)}</span>
                  </div>
                `).join('')}
              </div>
            </article>
          </div>
        </section>
      `;
    }

    function renderActiveScreen(metrics) {
      if (_ui.screen === 'study') return renderStudyScreen();
      if (_ui.screen === 'topic') return renderTopicDetail();
      if (_ui.screen === 'practice') {
        return _ui.quizQuestions.length ? renderPracticeRun() : renderPracticeHub(metrics);
      }
      if (_ui.screen === 'info') return renderInfoScreen();
      return renderHomeScreen(metrics);
    }

    function render() {
      if (!_root) return;
      ensureFocusArea();
      const metrics = computeMetrics();
      _root.classList.add('admisiones-public-page');
      _root.innerHTML = `
        <div class="adm-shell">
          ${renderHeader(metrics)}
          <div class="adm-app-layout">
            <main class="adm-content">
              ${renderTopNav()}
              ${renderActiveScreen(metrics)}
            </main>
            ${renderSidebar(metrics)}
          </div>
          <p class="adm-footer-note">El contenido de estudio se basa en la guia oficial EVALUATEC 2026 y se organiza aqui para que puedas avanzar con una ruta mas clara dentro de SIA.</p>
        </div>
      `;
    }

    function handleClick(event) {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const areaId = target.dataset.areaId || '';
      const topicId = target.dataset.topicId || '';
      const careerId = target.dataset.careerId || '';
      const screen = target.dataset.screen || '';
      const questionIndex = Number(target.dataset.questionIndex);

      if (action === 'go-screen') {
        if (screen === 'practice') {
          if (!confirmDiscardPracticeIfNeeded()) return;
          _ui = { ...defaultUiState(), screen: 'practice', areaId: _ui.areaId || getPreferredAreaId() };
          ensureFocusArea();
          render();
          return;
        }
        goToScreen(screen || 'home', { areaId: _ui.areaId || getPreferredAreaId() });
        return;
      }

      if (action === 'select-career') {
        if (!confirmDiscardPracticeIfNeeded()) return;
        const routeAreaIds = CareerPlanner.getAreasForCareer(careerId);
        GuestStore.patch({ selectedCareer: careerId, selectedAreas: routeAreaIds });
        _ui = {
          ...defaultUiState(),
          screen: 'home',
          areaId: routeAreaIds[0] || getPreferredAreaId()
        };
        render();
        return;
      }

      if (action === 'clear-career') {
        if (!confirmDiscardPracticeIfNeeded()) return;
        GuestStore.patch({ selectedCareer: '', selectedAreas: [] });
        _ui = {
          ...defaultUiState(),
          screen: 'home',
          areaId: getOrderedAreas()[0]?.id || ''
        };
        render();
        return;
      }

      if (action === 'focus-area') {
        if (!confirmDiscardPracticeIfNeeded()) return;
        _ui = {
          ...defaultUiState(),
          screen: 'study',
          areaId
        };
        render();
        return;
      }

      if (action === 'clear-search') {
        _ui.search = '';
        render();
        return;
      }

      if (action === 'open-topic') {
        if (_ui.screen === 'practice' && !_ui.quizSubmitted && !confirmDiscardPracticeIfNeeded()) return;
        _ui = {
          ...defaultUiState(),
          screen: 'topic',
          areaId,
          topicId
        };
        setLastVisited({ kind: 'topic', areaId, topicId, title: getTopic(areaId, topicId)?.title || '' });
        render();
        return;
      }

      if (action === 'toggle-bookmark') {
        GuestStore.toggleBookmark(getTopicKey(areaId, topicId));
        render();
        return;
      }

      if (action === 'mark-topic-studied') {
        GuestStore.updateTopic(getTopicKey(areaId, topicId), { studied: true });
        setLastVisited({ kind: 'topic', areaId, topicId, title: getTopic(areaId, topicId)?.title || '' });
        render();
        return;
      }

      if (action === 'start-area-practice') {
        if (_ui.screen === 'practice' && !confirmDiscardPracticeIfNeeded()) return;
        const questions = PracticeEngine.buildAreaQuiz(areaId);
        _ui = {
          ...defaultUiState(),
          screen: 'practice',
          areaId,
          practiceScope: 'area',
          quizId: `area-${areaId}`,
          quizQuestions: questions,
          quizIndex: 0
        };
        setLastVisited({ kind: 'practice', scope: 'area', areaId });
        render();
        return;
      }

      if (action === 'start-career-practice') {
        if (!_guest.selectedCareer) {
          window.showToast?.('Selecciona una carrera primero para armar una practica mixta.', 'warning');
          return;
        }
        if (_ui.screen === 'practice' && !confirmDiscardPracticeIfNeeded()) return;
        const questions = PracticeEngine.buildCareerQuiz(_guest.selectedCareer);
        _ui = {
          ...defaultUiState(),
          screen: 'practice',
          practiceScope: 'career',
          quizId: `career-${_guest.selectedCareer}`,
          quizQuestions: questions,
          quizIndex: 0
        };
        setLastVisited({ kind: 'practice', scope: 'career', careerId: _guest.selectedCareer });
        render();
        return;
      }

      if (action === 'prev-question') {
        _ui.quizIndex = Math.max(0, _ui.quizIndex - 1);
        render();
        return;
      }

      if (action === 'next-question') {
        _ui.quizIndex = Math.min(_ui.quizQuestions.length - 1, _ui.quizIndex + 1);
        render();
        return;
      }

      if (action === 'jump-question') {
        if (!Number.isNaN(questionIndex)) {
          _ui.quizIndex = Math.max(0, Math.min(_ui.quizQuestions.length - 1, questionIndex));
          render();
        }
        return;
      }

      if (action === 'submit-practice') {
        const missing = _ui.quizQuestions.find((question) => !Object.prototype.hasOwnProperty.call(_ui.quizAnswers, question.id));
        if (missing) {
          window.showToast?.('Contesta todos los reactivos antes de calificar la practica.', 'warning');
          return;
        }
        _ui.quizSubmitted = true;
        _ui.quizResult = PracticeEngine.grade(_ui.quizQuestions, _ui.quizAnswers);
        persistPracticeResult();
        render();
        return;
      }

      if (action === 'restart-practice') {
        if (_ui.practiceScope === 'career') {
          _ui = {
            ...defaultUiState(),
            screen: 'practice',
            practiceScope: 'career',
            quizId: `career-${_guest.selectedCareer}`,
            quizQuestions: PracticeEngine.buildCareerQuiz(_guest.selectedCareer),
            quizIndex: 0
          };
        } else {
          _ui = {
            ...defaultUiState(),
            screen: 'practice',
            areaId: _ui.areaId,
            practiceScope: 'area',
            quizId: `area-${_ui.areaId}`,
            quizQuestions: PracticeEngine.buildAreaQuiz(_ui.areaId),
            quizIndex: 0
          };
        }
        render();
        return;
      }

      if (action === 'continue-progress') {
        window.AdmisionesPublic.resumeGuestProgress();
        return;
      }

      if (action === 'reset-progress') {
        const confirmed = window.confirm('Se reiniciara el progreso local del invitado. Deseas continuar?');
        if (confirmed) window.AdmisionesPublic.resetGuestProgress();
      }
    }

    function handleChange(event) {
      const target = event.target;
      if (!target || !target.dataset.action) return;

      if (target.dataset.action === 'set-micro-answer') {
        const topicKey = getTopicKey(target.dataset.areaId, target.dataset.topicId);
        const value = Number(target.value);
        _ui.microAnswers = { ..._ui.microAnswers, [topicKey]: value };
        const topic = getTopic(target.dataset.areaId, target.dataset.topicId);
        GuestStore.updateTopic(topicKey, { microPassed: value === topic.microPractice.correctIndex });
        render();
        return;
      }

      if (target.dataset.action === 'practice-answer') {
        _ui.quizAnswers = { ..._ui.quizAnswers, [target.dataset.questionId]: Number(target.value) };
      }
    }

    function handleInput(event) {
      const target = event.target;
      if (!target || !target.dataset.action) return;

      if (target.dataset.action === 'study-search') {
        _ui.search = target.value || '';
        if (_ui.screen !== 'study') _ui.screen = 'study';
        render();
      }
    }

    function persistPracticeResult() {
      if (!_ui.quizResult) return;

      const practiceResults = _guest.practiceResults || { scopes: {}, topicStats: {}, areaStats: {} };
      const takenAt = new Date().toISOString();
      const scopeId = _ui.quizId;
      const nextTopicStats = { ...practiceResults.topicStats };
      const nextAreaStats = { ...practiceResults.areaStats };
      const nextProgressByTopic = { ..._guest.progressByTopic };

      _ui.quizResult.items.forEach((item) => {
        const topicKey = getTopicKey(item.areaId, item.topicId);
        const currentTopic = nextTopicStats[topicKey] || { correct: 0, total: 0 };
        const currentArea = nextAreaStats[item.areaId] || { correct: 0, total: 0 };

        nextTopicStats[topicKey] = {
          correct: currentTopic.correct + (item.isCorrect ? 1 : 0),
          total: currentTopic.total + 1
        };
        nextAreaStats[item.areaId] = {
          correct: currentArea.correct + (item.isCorrect ? 1 : 0),
          total: currentArea.total + 1
        };

        nextProgressByTopic[topicKey] = {
          ...(nextProgressByTopic[topicKey] || {}),
          studied: item.isCorrect ? true : Boolean(nextProgressByTopic[topicKey]?.studied),
          updatedAt: takenAt
        };
      });

      GuestStore.patch({
        progressByTopic: nextProgressByTopic,
        practiceResults: {
          scopes: {
            ...practiceResults.scopes,
            [scopeId]: {
              percent: _ui.quizResult.percent,
              correct: _ui.quizResult.correct,
              total: _ui.quizResult.total,
              takenAt,
              scope: _ui.practiceScope,
              areaId: _ui.areaId || null,
              careerId: _guest.selectedCareer || null
            }
          },
          topicStats: nextTopicStats,
          areaStats: nextAreaStats
        }
      });
    }

    async function init(ctx, options = {}) {
      _ctx = ctx;
      ensureRoot();
      ensureStyles();
      _resources = await ContentRepo.load();
      _guest = GuestStore.load();
      hydrateSelectedAreas();
      _ui = defaultUiState();
      _ui.areaId = getPreferredAreaId();
      if (options.resume !== false) applyLastVisited();
      ensureFocusArea();
      bindEvents();
      render();
    }

    function resetGuestProgress() {
      _guest = GuestStore.reset();
      _ui = defaultUiState();
      _ui.areaId = getPreferredAreaId();
      render();
    }

    function resumeGuestProgress() {
      _guest = GuestStore.load();
      if (_guest.lastVisited) {
        applyLastVisited();
      } else {
        const nextTopic = getNextRecommendedTopic(getRouteAreaIds());
        if (nextTopic) {
          _ui = {
            ...defaultUiState(),
            screen: 'topic',
            areaId: nextTopic.areaId,
            topicId: nextTopic.id
          };
        } else {
          _ui = {
            ...defaultUiState(),
            screen: _guest.selectedCareer ? 'study' : 'home',
            areaId: getPreferredAreaId()
          };
        }
      }
      ensureFocusArea();
      render();
    }

    return {
      init,
      resetGuestProgress,
      resumeGuestProgress
    };
  })();
}
