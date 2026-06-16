if (!window.AdmisionesPublic) {
  window.AdmisionesPublic = (function () {
    const STORAGE_KEY = 'sia_admisiones_guest_v2';
    const LEGACY_STORAGE_KEY = 'sia_admisiones_guest_v1';
    const STYLE_ID = 'sia-admisiones-public-style';
    const DATA_FILES = {
      admissions: '/data/admisiones-2026.json',
      content: '/data/evaluatec-2026-content.json'
    };
    const VOCACIONAL_STORAGE_KEY = 'sia_vocacional_id';

    const AREA_ICONS = {
      matematicas: 'bi-calculator',
      administracion: 'bi-briefcase',
      'comprension-lectora': 'bi-book',
      'estructura-lenguaje': 'bi-pencil-square',
      fisica: 'bi-lightning-charge',
      quimica: 'bi-droplet-half',
      arquitectura: 'bi-buildings',
      tics: 'bi-laptop',
      ingles: 'bi-translate'
    };

    const CAREER_ICONS = {
      iadm: 'bi-diagram-3',
      cp: 'bi-cash-coin',
      arq: 'bi-rulers',
      gastro: 'bi-cup-hot',
      tur: 'bi-compass',
      isc: 'bi-cpu',
      civil: 'bi-cone-striped',
      electro: 'bi-gear'
    };

    const NAV_ITEMS = [
      { screen: 'welcome', label: 'Inicio', icon: 'bi-house-door', hint: 'Bienvenida' },
      { screen: 'route', label: 'Ruta', icon: 'bi-signpost-split', hint: 'Carrera' },
      { screen: 'learn', label: 'Temas', icon: 'bi-journal-bookmark', hint: 'Estudia' },
      { screen: 'practice', label: 'Práctica', icon: 'bi-ui-checks-grid', hint: 'Reactivos' },
      { screen: 'exam', label: 'Proceso', icon: 'bi-calendar-check', hint: 'Fechas' }
    ];

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
        progressByTopic: {},
        practiceResults: {
          scopes: {},
          topicStats: {},
          areaStats: {}
        },
        bookmarks: [],
        tourSeen: false,
        lastVisited: null,
        createdAt: now,
        updatedAt: now
      };
    }

    function defaultUiState() {
      return {
        screen: 'welcome',
        areaId: '',
        topicId: '',
        quizMode: '',
        quizTitle: '',
        quizDescription: '',
        quizId: '',
        quizQuestions: [],
        quizAnswers: {},
        quizSubmitted: false,
        quizResult: null,
        quizIndex: 0,
        microAnswers: {},
        pendingCareerId: '',
        sourceInfoOpen: false,
        simulatorAccepted: false,
        simulatorStartTime: null
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

    function icon(name) {
      return `<i class="bi ${escapeHtml(name)}" aria-hidden="true"></i>`;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function formatPercent(value) {
      return `${Math.round(Number(value || 0))}%`;
    }

    function hasVocacionalSession() {
      try {
        return Boolean(localStorage.getItem(VOCACIONAL_STORAGE_KEY));
      } catch (error) {

        return false;
      }
    }

    function openVocacionalEntry() {
      window.location.hash = hasVocacionalSession() ? '#/vocacional/test' : '#/test-vocacional';
    }

    function shuffleList(items) {
      const next = [...items];
      for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      }
      return next;
    }

    function normalizeOption(value) {
      return String(value ?? '').trim();
    }

    function addUniqueOption(list, value) {
      const option = normalizeOption(value);
      if (!option || list.includes(option)) return;
      list.push(option);
    }

    function buildOptions(correct, distractors = [], fallbackDistractors = []) {
      const correctOption = normalizeOption(correct) || 'Respuesta correcta';
      const unique = [];
      [...(distractors || []), ...(fallbackDistractors || [])].forEach((item) => {
        const option = normalizeOption(item);
        if (!option || option === correctOption) return;
        addUniqueOption(unique, option);
      });

      const selectedDistractors = shuffleList(unique).slice(0, 3);
      [
        'No corresponde con los datos del reactivo',
        'Contradice el procedimiento correcto',
        'Confunde este tema con otro bloque',
        'No responde la consigna planteada'
      ].forEach((fallback) => {
        if (selectedDistractors.length < 3) addUniqueOption(selectedDistractors, fallback);
      });

      const options = shuffleList([correctOption, ...selectedDistractors.slice(0, 3)]);
      const correctIndex = options.findIndex((item) => item === correct);
      return {
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : options.findIndex((item) => item === correctOption)
      };
    }

    const GuestStore = {
      load() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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
            bookmarks: Array.isArray(parsed?.bookmarks) ? parsed.bookmarks : []
          };
        } catch (error) {

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
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        _guest = fresh;
        return fresh;
      }
    };

    const ContentRepo = {
      async load() {
        if (_resources) return _resources;
        const version = window.SIA_VERSION || Date.now();
        const [admissions, content] = await Promise.all([
          fetch(`${DATA_FILES.admissions}?v=${version}`).then((res) => res.json()),
          fetch(`${DATA_FILES.content}?v=${version}`).then((res) => res.json())
        ]);
        _resources = { admissions, content };
        return _resources;
      }
    };

    function ensureRoot() {
      _root = document.getElementById('view-admisiones-public');
      if (!_root) {
        throw new Error('No existe el contenedor view-admisiones-public.');
      }
      _root.classList.add('admisiones-public-page');
    }

    function ensureStyles() {
      const href = `/styles/17-admisiones-public.css?v=${window.SIA_VERSION || Date.now()}`;
      let link = document.getElementById(STYLE_ID);
      if (!link) {
        link = document.createElement('link');
        link.id = STYLE_ID;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = href;
    }

    function bindEvents() {
      if (_bound || !_root) return;
      _root.addEventListener('click', handleClick);
      _root.addEventListener('change', handleChange);
      _bound = true;
    }

    function getCareers() {
      return _resources?.content?.careers || [];
    }

    function getSelectedCareer() {
      return getCareers().find((career) => career.id === _guest?.selectedCareer) || null;
    }

    function getCareer(careerId) {
      return getCareers().find((career) => career.id === careerId) || null;
    }

    function getArea(areaId) {
      return (_resources?.content?.areas || []).find((area) => area.id === areaId) || null;
    }

    function getTopic(areaId, topicId) {
      return getArea(areaId)?.topics?.find((topic) => topic.id === topicId) || null;
    }

    function getAllTopics() {
      return (_resources?.content?.areas || []).flatMap((area) =>
        (area.topics || []).map((topic) => ({
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

    function getCareerAreaIds(career = getSelectedCareer()) {
      return career?.routeAreaIds || [];
    }

    function getRouteAreaIds() {
      return getCareerAreaIds();
    }

    function getRouteAreas(career = getSelectedCareer()) {
      const areaIds = getCareerAreaIds(career);
      return areaIds.map((areaId) => getArea(areaId)).filter(Boolean);
    }

    function getRouteTopics(career = getSelectedCareer()) {
      return getRouteAreas(career).flatMap((area) =>
        (area.topics || []).map((topic) => ({
          ...topic,
          areaId: area.id,
          areaTitle: area.title,
          roleLabel: area.roleLabel
        }))
      );
    }

    function getCareerTopicKeys(career = getSelectedCareer()) {
      return new Set(getRouteTopics(career).map((topic) => getTopicKey(topic.areaId, topic.id)));
    }

    function topicBelongsToCareer(areaId, topicId, career = getSelectedCareer()) {
      if (!career) return true;
      return getCareerTopicKeys(career).has(getTopicKey(areaId, topicId));
    }

    function getTopicProgress(areaId, topicId) {
      return _guest?.progressByTopic?.[getTopicKey(areaId, topicId)] || {};
    }

    function getAreaProgress(areaId) {
      const area = getArea(areaId);
      const topics = area?.topics || [];
      const studied = topics.filter((topic) => getTopicProgress(areaId, topic.id).studied).length;
      const stats = _guest?.practiceResults?.areaStats?.[areaId] || { correct: 0, total: 0 };
      return {
        total: topics.length,
        studied,
        studiedPercent: topics.length ? Math.round((studied / topics.length) * 100) : 0,
        practicePercent: stats.total ? Math.round((stats.correct / stats.total) * 100) : null
      };
    }

    function getRouteProgress() {
      const topics = getRouteTopics();
      const studied = topics.filter((topic) => getTopicProgress(topic.areaId, topic.id).studied).length;
      const total = topics.length;
      return {
        total,
        studied,
        percent: total ? Math.round((studied / total) * 100) : 0
      };
    }

    function getNextTopic() {
      const topics = getRouteTopics();
      return topics.find((topic) => !getTopicProgress(topic.areaId, topic.id).studied) || topics[0] || null;
    }

    function getBookmarkedTopics() {
      const marks = new Set(_guest?.bookmarks || []);
      return getRouteTopics().filter((topic) => marks.has(getTopicKey(topic.areaId, topic.id)));
    }

    function getWeakTopics() {
      const stats = _guest?.practiceResults?.topicStats || {};
      const routeKeys = getCareerTopicKeys();
      return Object.entries(stats)
        .map(([key, value]) => {
          const [areaId, topicId] = key.split('::');
          const topic = getTopic(areaId, topicId);
          const area = getArea(areaId);
          if (!topic || !area || !value?.total) return null;
          return {
            areaId,
            topicId,
            areaTitle: area.title,
            topicTitle: topic.title,
            percent: Math.round((value.correct / value.total) * 100)
          };
        })
        .filter(Boolean)
        .filter((item) => routeKeys.has(getTopicKey(item.areaId, item.topicId)))
        .filter((item) => item.percent < 75)
        .sort((a, b) => a.percent - b.percent)
        .slice(0, 3);
    }

    function computeMetrics() {
      const career = getSelectedCareer();
      const route = getRouteProgress();
      const practiceScopes = Object.values(_guest?.practiceResults?.scopes || {})
        .filter((scope) => !career || scope.careerId === career.id || topicBelongsToCareer(scope.areaId, scope.topicId, career));
      const lastPractice = practiceScopes
        .slice()
        .sort((a, b) => String(b.takenAt || '').localeCompare(String(a.takenAt || '')))[0] || null;
      const nextTopic = getNextTopic();
      const weakTopics = getWeakTopics();

      return {
        career,
        route,
        nextTopic,
        weakTopics,
        bookmarks: getBookmarkedTopics(),
        lastPractice,
        practiceLabel: lastPractice ? `${lastPractice.percent}% último intento` : 'Sin intento'
      };
    }

    function getPoolFromOtherTopics(topicKey, extractor, limit = 12) {
      const sourceTopics = getSelectedCareer() ? getRouteTopics() : getAllTopics();
      return shuffleList(
        sourceTopics
          .filter((topic) => getTopicKey(topic.areaId, topic.id) !== topicKey)
          .flatMap((topic) => extractor(topic) || [])
          .filter(Boolean)
      ).slice(0, limit);
    }

    function getTopicExamples(topic) {
      const examples = Array.isArray(topic.solvedExamples) ? topic.solvedExamples : [];
      if (examples.length) return examples.filter((example) => example?.problem);
      return topic.solvedExample?.problem ? [topic.solvedExample] : [];
    }

    function getTopicPracticeQuestions(topic) {
      const questions = Array.isArray(topic.practiceQuestions) ? topic.practiceQuestions : [];
      if (questions.length) return questions.filter((question) => question?.question);
      return topic.microPractice?.question ? [topic.microPractice] : [];
    }

    function buildPracticeContext(area, topic, practice) {
      if (practice?.context || practice?.stimulus) return practice.context || practice.stimulus;
      if (practice?.source === 'ejemplo') {
        const example = getTopicExamples(topic)[0];
        if (example?.problem) return `Ejemplo base de ${topic.title}: ${example.problem}`;
      }
      if (practice?.source === 'cobertura') {
        return `Temario oficial de ${area.title} para ${topic.title}: ${(topic.officialCoverage || []).join(', ')}.`;
      }
      if (practice?.source === 'habilidad') {
        return `${topic.checkpoint?.prompt || 'Habilidades esperadas:'} ${(topic.checkpoint?.items || []).join(' ')}`;
      }
      if (practice?.source === 'error común') {
        return `Errores comunes al estudiar ${topic.title}: ${(topic.commonMistakes || []).join(' ')}`;
      }
      return topic.explanation || topic.summary || '';
    }

    function createTopicQuestion(area, topic, practice, index = 0) {
      const rawOptions = Array.isArray(practice?.options) ? practice.options.map(normalizeOption).filter(Boolean) : [];
      const rawCorrectIndex = Number(practice?.correctIndex);
      const safeCorrectIndex = Number.isInteger(rawCorrectIndex) && rawCorrectIndex >= 0 && rawCorrectIndex < rawOptions.length
        ? rawCorrectIndex
        : 0;
      const correct = rawOptions[safeCorrectIndex] || practice?.answer || 'Respuesta correcta';
      const built = rawOptions.length
        ? buildOptions(correct, rawOptions.filter((_, optionIndex) => optionIndex !== safeCorrectIndex))
        : buildOptions(correct, []);

      return {
        id: `${area.id}-${topic.id}-practice-${index}`,
        areaId: area.id,
        areaTitle: area.title,
        topicId: topic.id,
        topicTitle: topic.title,
        difficulty: practice?.difficulty || 'básico',
        question: practice?.question || `Repaso de ${topic.title}`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: practice?.explanation || topic.summary || '',
        context: buildPracticeContext(area, topic, practice),
        source: practice?.source || ''
      };
    }

    function getExampleAnswerPool(topicKey) {
      const sourceTopics = getSelectedCareer() ? getRouteTopics() : getAllTopics();
      return shuffleList(
        sourceTopics
          .filter((topic) => getTopicKey(topic.areaId, topic.id) !== topicKey)
          .flatMap((topic) => getTopicExamples(topic).map((example) => example.answer))
          .filter(Boolean)
      );
    }

    function createExampleQuestion(area, topic, example, index = 0) {
      const topicKey = getTopicKey(area.id, topic.id);
      const sameTopicDistractors = getTopicExamples(topic)
        .filter((candidate) => candidate !== example)
        .map((candidate) => candidate.answer)
        .filter(Boolean);
      const built = buildOptions(example?.answer, sameTopicDistractors, getExampleAnswerPool(topicKey));

      return {
        id: `${area.id}-${topic.id}-example-${index}`,
        areaId: area.id,
        areaTitle: area.title,
        topicId: topic.id,
        topicTitle: topic.title,
        difficulty: example?.level || 'básico',
        question: example?.problem || `Ejemplo de ${topic.title}`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: `${example?.answer ? `Respuesta: ${example.answer}. ` : ''}${(example?.steps || []).join(' ') || topic.summary || ''}`.trim(),
        context: `Ejercicio de repaso basado en la lección de ${topic.title}.`,
        formula: example?.formula,
        diagramText: example?.diagramText,
        table: example?.table,
        source: 'ejemplo-sia'
      };
    }

    function getTopicQuestionPool(area, topic) {
      const manualQuestions = getTopicPracticeQuestions(topic).map((practice, index) => createTopicQuestion(area, topic, practice, index));
      const exampleQuestions = getTopicExamples(topic).map((example, index) => createExampleQuestion(area, topic, example, index));
      return [...manualQuestions, ...exampleQuestions];
    }

    function createMistakeQuestion(area, topic) {
      const topicKey = getTopicKey(area.id, topic.id);
      const correct = topic.commonMistakes?.[0] || 'Responder sin revisar la consigna completa';
      const distractors = getPoolFromOtherTopics(topicKey, (candidate) => candidate.commonMistakes);
      const built = buildOptions(correct, distractors);
      return {
        id: `${area.id}-${topic.id}-mistake`,
        areaId: area.id,
        areaTitle: area.title,
        topicId: topic.id,
        topicTitle: topic.title,
        question: `¿Qué error debes evitar al resolver ${topic.title}?`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: `${correct} es un error frecuente en ${topic.title}; revisar la consigna y el procedimiento reduce ese riesgo.`,
        context: `Errores comunes: ${(topic.commonMistakes || []).join(' ')}`,
        source: 'error-comun-sia'
      };
    }

    function createSummaryQuestion(area, topic) {
      const topicKey = getTopicKey(area.id, topic.id);
      const correct = topic.summary || topic.explanation || topic.title;
      const distractors = getPoolFromOtherTopics(topicKey, (candidate) => [candidate.summary || candidate.explanation]);
      const built = buildOptions(correct, distractors);
      return {
        id: `${area.id}-${topic.id}-summary`,
        areaId: area.id,
        areaTitle: area.title,
        topicId: topic.id,
        topicTitle: topic.title,
        question: `¿Qué descripción corresponde mejor a ${topic.title}?`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: correct,
        context: topic.lesson?.conceptIntro || topic.summary || '',
        source: 'resumen-sia'
      };
    }

    function getGeneratedTopicQuestions(area, topic) {
      return [
        createCoverageQuestion(area, topic),
        createCheckpointQuestion(area, topic),
        createMistakeQuestion(area, topic),
        createSummaryQuestion(area, topic)
      ];
    }

    function getAreaQuestionPool(areaId, includeGenerated = false) {
      const area = getArea(areaId);
      if (!area) return [];
      const pool = [];
      (area.topics || []).forEach((topic) => {
        const questions = getTopicQuestionPool(area, topic);
        pool.push(...questions);
        if (includeGenerated || questions.length < 5) {
          pool.push(...getGeneratedTopicQuestions(area, topic));
        }
      });
      return pool;
    }

    function getCareerBankMetrics(career = getSelectedCareer()) {
      if (!career) return { topics: 0, examples: 0, questions: 0 };
      const routeAreas = getRouteAreas(career);
      return routeAreas.reduce((metrics, area) => {
        (area.topics || []).forEach((topic) => {
          const topicQuestions = getTopicQuestionPool(area, topic);
          metrics.topics += 1;
          metrics.examples += getTopicExamples(topic).length;
          metrics.questions += topicQuestions.length + (topicQuestions.length < 5 ? getGeneratedTopicQuestions(area, topic).length : 0);
        });
        return metrics;
      }, { topics: 0, examples: 0, questions: 0 });
    }

    function hasGuestActivity() {
      const progressCount = Object.keys(_guest?.progressByTopic || {}).length;
      const scopesCount = Object.keys(_guest?.practiceResults?.scopes || {}).length;
      const marksCount = (_guest?.bookmarks || []).length;
      return Boolean(progressCount || scopesCount || marksCount || _guest?.lastVisited);
    }

    function filterGuestForCareer(career) {
      const routeKeys = getCareerTopicKeys(career);
      const routeAreaIds = new Set(getCareerAreaIds(career));
      const progressByTopic = Object.fromEntries(
        Object.entries(_guest?.progressByTopic || {}).filter(([key]) => routeKeys.has(key))
      );
      const topicStats = Object.fromEntries(
        Object.entries(_guest?.practiceResults?.topicStats || {}).filter(([key]) => routeKeys.has(key))
      );
      const areaStats = Object.fromEntries(
        Object.entries(_guest?.practiceResults?.areaStats || {}).filter(([areaId]) => routeAreaIds.has(areaId))
      );
      const scopes = Object.fromEntries(
        Object.entries(_guest?.practiceResults?.scopes || {}).filter(([, scope]) => {
          if (scope?.careerId === career.id) return true;
          if (scope?.topicId) return topicBelongsToCareer(scope.areaId, scope.topicId, career);
          return scope?.areaId ? routeAreaIds.has(scope.areaId) : false;
        })
      );
      const bookmarks = (_guest?.bookmarks || []).filter((key) => routeKeys.has(key));
      const lastVisited = _guest?.lastVisited?.kind === 'topic'
        && routeKeys.has(getTopicKey(_guest.lastVisited.areaId, _guest.lastVisited.topicId))
        ? _guest.lastVisited
        : null;

      return {
        progressByTopic,
        practiceResults: { scopes, topicStats, areaStats },
        bookmarks,
        lastVisited
      };
    }

    function applyCareerSelection(career, mode = 'keep') {
      if (!career) return;
      if (mode === 'reset') {
        const fresh = createDefaultGuest();
        GuestStore.save({
          ...fresh,
          guestId: _guest?.guestId || fresh.guestId,
          selectedCareer: career.id,
          tourSeen: _guest?.tourSeen || false
        });
      } else {
        GuestStore.patch({
          selectedCareer: career.id,
          ...filterGuestForCareer(career)
        });
      }
      _ui = {
        ...defaultUiState(),
        screen: 'route',
        areaId: career.routeAreaIds?.[0] || ''
      };
      render();
    }

    function requestCareerSelection(career) {
      const currentCareer = getSelectedCareer();
      if (!currentCareer || currentCareer.id === career.id || !hasGuestActivity()) {
        applyCareerSelection(career, 'keep');
        return;
      }
      _ui.pendingCareerId = career.id;
      render();
    }

    function createCoverageQuestion(area, topic) {
      const topicKey = getTopicKey(area.id, topic.id);
      const correct = topic.officialCoverage?.[0] || topic.title;
      const distractors = getPoolFromOtherTopics(topicKey, (candidate) => candidate.officialCoverage);
      const built = buildOptions(correct, distractors);
      return {
        id: `${area.id}-${topic.id}-coverage`,
        areaId: area.id,
        areaTitle: area.title,
        topicId: topic.id,
        topicTitle: topic.title,
        question: `¿Qué apartado pertenece a ${topic.title}?`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: `${correct} forma parte del bloque ${topic.title}.`,
        context: `Temario oficial de ${area.title}: ${(topic.officialCoverage || []).join(', ')}.`,
        source: 'temario-oficial'
      };
    }

    function createCheckpointQuestion(area, topic) {
      const topicKey = getTopicKey(area.id, topic.id);
      const correct = topic.checkpoint?.items?.[0] || topic.summary || topic.title;
      const distractors = getPoolFromOtherTopics(topicKey, (candidate) => candidate.checkpoint?.items);
      const built = buildOptions(correct, distractors);
      return {
        id: `${area.id}-${topic.id}-checkpoint`,
        areaId: area.id,
        areaTitle: area.title,
        topicId: topic.id,
        topicTitle: topic.title,
        question: `Para dominar ${topic.title}, ¿qué debes poder hacer?`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: correct,
        context: `${topic.checkpoint?.prompt || 'Antes de cerrar el tema, verifica:'} ${(topic.checkpoint?.items || []).join(' ')}`,
        source: 'checkpoint-sia'
      };
    }

    const PracticeEngine = {
      topicQuiz(areaId, topicId) {
        const area = getArea(areaId);
        const topic = getTopic(areaId, topicId);
        if (!area || !topic) return [];
        const questions = getTopicQuestionPool(area, topic);
        const pool = [...questions, ...getGeneratedTopicQuestions(area, topic)];
        return shuffleList(pool).slice(0, 5);
      },

      areaQuiz(areaId, limit = 12) {
        return shuffleList(getAreaQuestionPool(areaId)).slice(0, limit);
      },

      routeQuiz(limit = 15) {
        const pool = getRouteAreas().flatMap((area) => getAreaQuestionPool(area.id));
        return shuffleList(pool).slice(0, limit);
      },

      simulator(limit = 25) {
        const pool = getRouteAreas().flatMap((area) => getAreaQuestionPool(area.id));
        return shuffleList(pool).slice(0, limit);
      },

      grade(questions, answers) {
        const items = questions.map((question) => {
          const selectedIndex = Number(answers[question.id]);
          const isCorrect = selectedIndex === Number(question.correctIndex);
          return { ...question, selectedIndex, isCorrect };
        });
        const correct = items.filter((item) => item.isCorrect).length;
        const total = items.length;
        return {
          correct,
          total,
          percent: total ? Math.round((correct / total) * 100) : 0,
          items
        };
      }
    };

    function setLastVisited(patch) {
      GuestStore.patch({
        lastVisited: {
          ...patch,
          updatedAt: new Date().toISOString()
        }
      });
    }

    function goToScreen(screen) {
      _ui = {
        ...defaultUiState(),
        screen,
        areaId: _ui.areaId || getRouteAreaIds()[0] || ''
      };
      render();
      _root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function openTopic(areaId, topicId) {
      if (!topicBelongsToCareer(areaId, topicId)) {
        window.showToast?.('Ese tema no pertenece a la carrera activa. Cambia de carrera para verlo.', 'warning');
        return;
      }
      _ui = {
        ...defaultUiState(),
        screen: 'topic',
        areaId,
        topicId,
        microAnswers: _ui.microAnswers || {}
      };
      setLastVisited({ kind: 'topic', areaId, topicId });
      render();
      _root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function startQuiz({ mode, title, description, questions, quizId, areaId = '', topicId = '' }) {
      if (!questions.length) {
        window.showToast?.('Primero elige carrera o tema para generar tu práctica.', 'warning');
        return;
      }
      _ui = {
        ...defaultUiState(),
        screen: 'quiz',
        areaId,
        topicId,
        quizMode: mode,
        quizTitle: title,
        quizDescription: description,
        quizId,
        quizQuestions: questions,
        quizAnswers: {},
        quizSubmitted: false,
        quizResult: null,
        quizIndex: 0,
        simulatorAccepted: mode !== 'simulator',
        simulatorStartTime: mode === 'simulator' ? Date.now() : null
      };
      setLastVisited({ kind: 'quiz', mode, quizId, areaId, topicId });
      render();
      _root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function persistPracticeResult() {
      if (!_ui.quizResult) return;

      const practiceResults = _guest.practiceResults || { scopes: {}, topicStats: {}, areaStats: {} };
      const takenAt = new Date().toISOString();
      const nextTopicStats = { ...practiceResults.topicStats };
      const nextAreaStats = { ...practiceResults.areaStats };
      const nextProgressByTopic = { ..._guest.progressByTopic };

      _ui.quizResult.items.forEach((item) => {
        const key = getTopicKey(item.areaId, item.topicId);
        const topicStats = nextTopicStats[key] || { correct: 0, total: 0 };
        const areaStats = nextAreaStats[item.areaId] || { correct: 0, total: 0 };

        nextTopicStats[key] = {
          correct: topicStats.correct + (item.isCorrect ? 1 : 0),
          total: topicStats.total + 1
        };
        nextAreaStats[item.areaId] = {
          correct: areaStats.correct + (item.isCorrect ? 1 : 0),
          total: areaStats.total + 1
        };

        nextProgressByTopic[key] = {
          ...(nextProgressByTopic[key] || {}),
          practiced: true,
          studied: item.isCorrect ? true : Boolean(nextProgressByTopic[key]?.studied),
          updatedAt: takenAt
        };
      });

      GuestStore.patch({
        progressByTopic: nextProgressByTopic,
        practiceResults: {
          scopes: {
            ...practiceResults.scopes,
            [_ui.quizId]: {
              percent: _ui.quizResult.percent,
              correct: _ui.quizResult.correct,
              total: _ui.quizResult.total,
              mode: _ui.quizMode,
              areaId: _ui.areaId || null,
              topicId: _ui.topicId || null,
              careerId: _guest.selectedCareer || null,
              takenAt
            }
          },
          topicStats: nextTopicStats,
          areaStats: nextAreaStats
        }
      });
    }

    function renderAppBar() {
      return `
        <header class="adm-appbar">
          <button class="adm-icon-button" type="button" data-action="back-landing" aria-label="Regresar al inicio de SIA">
            ${icon('bi-arrow-left')}
          </button>
          <div class="adm-brand-lockup">
            <img src="/images/logo-ites.png" alt="ITES Los Cabos">
            <span>Admisiones</span>
          </div>
          <button class="adm-icon-button" type="button" data-action="go-screen" data-screen="tour" aria-label="Ver tour">
            ${icon('bi-info-circle')}
          </button>
        </header>
      `;
    }

    function renderNav() {
      return `
        <nav class="adm-tabbar" aria-label="Secciones de admisiones">
          ${NAV_ITEMS.map((item) => {
            const active = _ui.screen === item.screen
              || (item.screen === 'practice' && _ui.screen === 'quiz')
              || (item.screen === 'learn' && _ui.screen === 'topic');
            return `
              <button class="adm-tab ${active ? 'is-active' : ''}" type="button" data-action="go-screen" data-screen="${escapeHtml(item.screen)}" ${active ? 'aria-current="page"' : ''}>
                ${icon(item.icon)}
                <span>${escapeHtml(item.label)}</span>
              </button>
            `;
          }).join('')}
        </nav>
      `;
    }

    function renderProgressStrip(metrics) {
      const career = metrics.career;
      return `
        <div class="adm-compact-alert is-info">
          <div>
            <strong>${icon('bi-map')} ${career ? escapeHtml(career.name) : 'Aún no eliges carrera'}</strong>
            <span>${formatPercent(metrics.route.percent)} ruta · ${escapeHtml(metrics.practiceLabel)}</span>
          </div>
          ${career ? `<button class="adm-icon-button" type="button" data-action="go-screen" data-screen="route" aria-label="Cambiar carrera">${icon('bi-pencil')}</button>` : `<button class="adm-button is-soft" type="button" data-action="go-screen" data-screen="route">Elegir</button>`}
        </div>
      `;
    }

    function renderSourceNotice() {
      const admissions = _resources?.admissions || {};
      const guideUrl = admissions.exam?.officialGuideUrl || 'https://www.itesloscabos.edu.mx/wp-content/uploads/2026/01/GUIA-EVALUATEC-2026-.pdf';
      return `
        <div class="adm-compact-alert is-warning">
          <div>
            <strong>${icon('bi-patch-check')} Basado en la Guía EVALUATEC 2026</strong>
            <span>Preguntas de práctica didácticas de SIA. No oficiales.</span>
          </div>
          <a class="adm-icon-button" href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Ver guía original">${icon('bi-box-arrow-up-right')}</a>
        </div>
      `;
    }

    function renderVocacionalShortcut(metrics) {
      const hasSession = hasVocacionalSession();
      const title = hasSession ? 'Test vocacional en pausa' : '¿Dudas con tu carrera?';
      const body = hasSession ? 'Retoma tu sesión.' : 'Haz el test para descubrir tu afinidad.';
      
      return `
        <div class="adm-compact-alert is-success">
          <div>
            <strong>${icon('bi-compass')} ${escapeHtml(title)}</strong>
            <span>${escapeHtml(body)}</span>
          </div>
          <button class="adm-button is-primary" type="button" data-action="open-vocacional">${icon(hasSession ? 'bi-arrow-repeat' : 'bi-stars')} ${hasSession ? 'Continuar' : 'Hacer test'}</button>
        </div>
      `;
    }

    function renderWelcome(metrics) {
      const next = metrics.nextTopic;
      return `
        ${renderProgressStrip(metrics)}
        ${renderSourceNotice()}
        ${renderVocacionalShortcut(metrics)}

        <section class="adm-welcome">
          <div class="adm-welcome-copy">
            <span class="adm-eyebrow">${icon('bi-stars')} Nuevo ingreso 2026</span>
            <h1>Bienvenido aspirante</h1>
            <p>Este módulo te ayuda a ubicar qué estudiar, practicar por tu carrera y consultar el proceso de admisión sin crear cuenta.</p>
            <div class="adm-cta-row">
              <button class="adm-button is-primary" type="button" data-action="go-screen" data-screen="tour">${icon('bi-play-circle')} Ver tour rápido</button>
              <button class="adm-button is-soft" type="button" data-action="go-screen" data-screen="route">${icon('bi-signpost')} Elegir carrera</button>
            </div>
          </div>
          <figure class="adm-visual">
            <img src="/images/logo-sia-mob.png" alt="SIA móvil">
            <figcaption>
              <strong>Ruta, práctica y fechas en un solo lugar.</strong>
              <span>Tu avance se guarda en este dispositivo.</span>
            </figcaption>
          </figure>
        </section>

        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Qué puedes hacer aquí</span>
            <h2>Simple, guiado y por carrera</h2>
          </div>
          <div class="adm-feature-grid">
            ${renderFeature('bi-compass', 'Ubicar tu ruta', 'Selecciona carrera y verás sólo los bloques que te corresponden.')}
            ${renderFeature('bi-journal-check', 'Aprender por tema', 'Cada tema tiene idea clave, ejemplo y cierre rápido.')}
            ${renderFeature('bi-ui-checks', 'Practicar con ayuda', 'Recibe explicación y detecta qué reforzar antes del simulador.')}
            ${renderFeature('bi-calendar2-check', 'Consultar fechas', 'Ten claro registro, examen, propedéutico y soporte.')}
          </div>
        </section>

        <section class="adm-action-panel">
          <div>
            <span class="adm-kicker">Siguiente paso</span>
            <h2>${next ? escapeHtml(next.title) : 'Activa tu ruta'}</h2>
            <p>${next ? `Continúa en ${escapeHtml(next.areaTitle)} según tu carrera.` : 'Elige tu carrera para ordenar temas, práctica y simulador.'}</p>
          </div>
          <button class="adm-button is-primary" type="button" ${next ? `data-action="open-topic" data-area-id="${escapeHtml(next.areaId)}" data-topic-id="${escapeHtml(next.id)}"` : 'data-action="go-screen" data-screen="route"'}>
            ${next ? `${icon('bi-arrow-right-circle')} Continuar` : `${icon('bi-mortarboard')} Elegir carrera`}
          </button>
        </section>
      `;
    }

    function renderFeature(iconName, title, body) {
      return `
        <article class="adm-feature">
          <span class="adm-feature-icon">${icon(iconName)}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `;
    }

    function renderTour() {
      const steps = [
        ['bi-person-check', '1. Elige carrera', 'La ruta se filtra para mostrar sólo los bloques que aplican a tu rumbo.'],
        ['bi-map', '2. Sigue el orden', 'Empieza por el primer tema pendiente y avanza por bloques cortos.'],
        ['bi-patch-question', '3. Práctica guiada', 'Usa práctica guiada para aprender de tus errores sin saturarte.'],
        ['bi-stopwatch', '4. Simula', 'Cuando ya tengas base, mide tu nivel sin ayudas y refuerza lo débil.']
      ];

      return `
        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Tour rápido</span>
            <h1>Cómo usar este módulo</h1>
            <p>Son cuatro pasos. No necesitas iniciar sesión y puedes volver al inicio de SIA cuando quieras.</p>
          </div>
          <div class="adm-tour-list">
            ${steps.map(([iconName, title, body]) => `
              <article class="adm-tour-step">
                <span>${icon(iconName)}</span>
                <div>
                  <strong>${escapeHtml(title)}</strong>
                  <p>${escapeHtml(body)}</p>
                </div>
              </article>
            `).join('')}
          </div>
          <div class="adm-cta-row">
            <button class="adm-button is-primary" type="button" data-action="finish-tour">${icon('bi-check-circle')} Entendido, elegir carrera</button>
            <button class="adm-button is-ghost" type="button" data-action="go-screen" data-screen="welcome">Volver</button>
          </div>
        </section>
      `;
    }

    function renderCareerPicker() {
      const isExpanded = !_guest.selectedCareer || _ui.careerPickerExpanded;

      if (!isExpanded) {
        const career = getCareer(_guest.selectedCareer);
        const areaCount = career?.routeAreaIds?.length || 0;
        return `
          <div class="adm-career-list">
            <button class="adm-career-card is-active" type="button" data-action="toggle-career-picker" style="justify-content: space-between;">
              <div style="display:flex; align-items:center; gap:1rem;">
                <span class="adm-career-icon">${icon(CAREER_ICONS[career.id] || 'bi-mortarboard')}</span>
                <span style="text-align: left;">
                  <strong>${escapeHtml(career.shortName || career.name)}</strong>
                  <small>${escapeHtml(areaCount)} bloques académicos</small>
                </span>
              </div>
              <span style="font-size:0.875rem; color:var(--primary); display:flex; align-items:center; gap:0.25rem;">Cambiar ${icon('bi-chevron-expand')}</span>
            </button>
          </div>
        `;
      }

      return `
        <div class="adm-career-list">
          ${getCareers().map((career) => {
            const active = _guest.selectedCareer === career.id;
            const areaCount = career.routeAreaIds?.length || 0;
            return `
              <button class="adm-career-card ${active ? 'is-active' : ''}" type="button" data-action="set-career" data-career-id="${escapeHtml(career.id)}">
                <span class="adm-career-icon">${icon(CAREER_ICONS[career.id] || 'bi-mortarboard')}</span>
                <span>
                  <strong>${escapeHtml(career.shortName || career.name)}</strong>
                  <small>${escapeHtml(areaCount)} bloques académicos</small>
                </span>
                ${active ? icon('bi-check-circle-fill') : icon('bi-chevron-right')}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderRoute(metrics) {
      const career = metrics.career;
      const areas = getRouteAreas();

      return `
        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Ruta personalizada</span>
            <h1>${career ? escapeHtml(career.name) : 'Primero elige tu carrera'}</h1>
            <p>${career ? 'Estos son los bloques académicos asociados a tu carrera. Inglés es diagnóstico y también debes presentarlo.' : 'El temario se ordena mejor cuando SIA sabe hacia qué carrera vas.'}</p>
          </div>
          ${renderCareerPicker()}
        </section>

        ${career ? `
          <section class="adm-section">
            <div class="adm-section-head is-row">
              <div>
                <span class="adm-kicker">Tu mapa de estudio</span>
                <h2>${metrics.route.studied} de ${metrics.route.total} temas revisados</h2>
              </div>
              <button class="adm-button is-soft" type="button" data-action="start-route-practice">${icon('bi-ui-checks')} Practicar ruta</button>
            </div>
            <div class="adm-route-list">
              ${areas.map((area) => renderAreaRouteCard(area)).join('')}
            </div>
          </section>
        ` : renderEmptyGuide('bi-mortarboard', 'Selecciona una carrera', 'Después verás tus bloques, temas sugeridos y prácticas acordes a tu rumbo.')}
      `;
    }

    function renderAreaRouteCard(area) {
      const progress = getAreaProgress(area.id);
      const firstPending = (area.topics || []).find((topic) => !getTopicProgress(area.id, topic.id).studied) || area.topics?.[0];
      const iconName = AREA_ICONS[area.id] || 'bi-journal';

      return `
        <article class="adm-route-item">
          <div class="adm-route-main">
            <span class="adm-area-icon">${icon(iconName)}</span>
            <div>
              <strong>${escapeHtml(area.title)}</strong>
              <p>${escapeHtml(area.summary)}</p>
              <div class="adm-mini-progress" aria-label="Avance ${progress.studiedPercent}%">
                <span style="width:${progress.studiedPercent}%"></span>
              </div>
              <small>${progress.studied}/${progress.total} temas vistos${progress.practicePercent !== null ? ` · ${progress.practicePercent}% práctica` : ''}</small>
            </div>
          </div>
          <div class="adm-compact-actions">
            ${firstPending ? `<button class="adm-button is-primary" type="button" data-action="open-topic" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(firstPending.id)}">Abrir tema</button>` : ''}
            <button class="adm-button is-ghost" type="button" data-action="start-area-practice" data-area-id="${escapeHtml(area.id)}">Practicar</button>
          </div>
        </article>
      `;
    }

    function renderLearn(metrics) {
      const career = metrics.career;
      if (!career) {
        return renderSectionPrompt('bi-signpost-split', 'Temas por carrera', 'Elige carrera para ver un temario claro y sin ruido.', 'Elegir carrera', 'route');
      }

      const activeAreaId = _ui.areaId && getRouteAreaIds().includes(_ui.areaId) ? _ui.areaId : getRouteAreaIds()[0];
      const activeArea = getArea(activeAreaId);
      _ui.areaId = activeAreaId;

      return `
        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Temario guiado</span>
            <h1>Estudia lo que aplica a ${escapeHtml(career.shortName || career.name)}</h1>
            <p>Elige un bloque y abre un tema. Cada microlección es corta para que puedas avanzar desde el celular.</p>
          </div>
          <div class="adm-area-tabs">
            ${getRouteAreas().map((area) => {
              const progress = getAreaProgress(area.id);
              return `
                <button class="adm-area-tab ${activeAreaId === area.id ? 'is-active' : ''}" type="button" data-action="focus-area" data-area-id="${escapeHtml(area.id)}">
                  ${icon(AREA_ICONS[area.id] || 'bi-journal')}
                  <span>${escapeHtml(area.title)}</span>
                  <small>${progress.studied}/${progress.total}</small>
                </button>
              `;
            }).join('')}
          </div>
        </section>

        ${activeArea ? `
          <section class="adm-section">
            <div class="adm-section-head is-row">
              <div>
                <span class="adm-kicker">${escapeHtml(activeArea.roleLabel || 'Bloque')}</span>
                <h2>${escapeHtml(activeArea.title)}</h2>
                <p>${escapeHtml(activeArea.strategy || activeArea.summary)}</p>
              </div>
              <button class="adm-button is-soft" type="button" data-action="start-area-practice" data-area-id="${escapeHtml(activeArea.id)}">${icon('bi-ui-checks')} Practicar</button>
            </div>
            <div class="adm-topic-list">
              ${(activeArea.topics || []).map((topic) => renderTopicRow(activeArea, topic)).join('')}
            </div>
          </section>
        ` : ''}
      `;
    }

    function renderTopicRow(area, topic) {
      const progress = getTopicProgress(area.id, topic.id);
      const key = getTopicKey(area.id, topic.id);
      const marked = (_guest.bookmarks || []).includes(key);
      const isLearned = progress.studied;
      const isMastered = isLearned && progress.practiced;
      let stateIcon = 'bi-circle';
      if (isMastered) stateIcon = 'bi-check2-all';
      else if (isLearned) stateIcon = 'bi-check2';

      return `
        <article class="adm-topic-row">
          <div>
            <span class="adm-topic-state ${isLearned ? 'is-done' : ''}">${icon(stateIcon)}</span>
          </div>
          <div class="adm-topic-content">
            <strong>${escapeHtml(topic.title)}</strong>
            <p>${escapeHtml(topic.summary)}</p>
            <small>${escapeHtml(topic.estimatedMinutes || 20)} min · ${escapeHtml(area.title)}</small>
          </div>
          <div class="adm-topic-actions">
            <button class="adm-icon-button" type="button" data-action="toggle-bookmark" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}" aria-label="${marked ? 'Quitar guardado' : 'Guardar tema'}">${icon(marked ? 'bi-bookmark-fill' : 'bi-bookmark')}</button>
            <button class="adm-button is-primary" type="button" data-action="open-topic" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}">Estudiar</button>
          </div>
        </article>
      `;
    }

    function renderTopicDetail() {
      const area = getArea(_ui.areaId);
      const topic = getTopic(_ui.areaId, _ui.topicId);
      if (!area || !topic) return renderSectionPrompt('bi-journal', 'Tema no encontrado', 'Vuelve al temario para elegir otro tema.', 'Ver temas', 'learn');
      const progress = getTopicProgress(area.id, topic.id);
      const topicKey = getTopicKey(area.id, topic.id);
      const practiceQuestions = getTopicQuestionPool(area, topic);
      const examples = getTopicExamples(topic);
      
      const allExamples = [...examples];
      
      const inlineQuestions = practiceQuestions.slice(0, 3);
      const correctInlineCount = inlineQuestions.filter((q, i) => _ui.microAnswers?.[`${topicKey}-${i}`] === Number(q.correctIndex)).length;
      const isLearned = progress.studied || correctInlineCount >= 2;

      return `
        <div class="adm-topic-container">
          <section class="adm-topic-hero">
            <button class="adm-back-link" type="button" data-action="go-screen" data-screen="learn">${icon('bi-arrow-left')} Temario</button>
            <span class="adm-kicker">${escapeHtml(area.title)}</span>
            <h1>${escapeHtml(topic.title)}</h1>
            <p>${escapeHtml(topic.summary)}</p>
            <div class="adm-cta-row">
              <button class="adm-button is-primary" type="button" data-action="mark-topic" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}">${icon(isLearned ? 'bi-check-circle-fill' : 'bi-check-circle')} ${isLearned ? 'Tema aprendido' : 'Marcar como aprendido'}</button>
              <button class="adm-button is-soft" type="button" data-action="start-topic-practice" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}">${icon('bi-ui-checks')} Práctica completa</button>
            </div>
          </section>

          <div class="adm-topic-phases">
            ${renderTopicPhase1(topic)}
            ${renderTopicLesson(topic)}
            ${renderTopicPhase2(topic)}
            ${renderTopicPhase3(allExamples)}
            ${inlineQuestions.length ? renderTopicPhase4(area, topic, inlineQuestions) : ''}
            ${renderTopicPhase5(topic)}
          </div>
        </div>
      `;
    }

    function renderTopicPhase1(topic) {
      const intro = topic.lesson?.intro || topic.learning?.intro || topic.introduction || '';
      const coverage = topic.officialCoverage || [];
      return `
        <article class="adm-lesson-card is-phase1">
          <span class="adm-feature-icon">${icon('bi-journal-text')}</span>
          <strong>Qué vas a aprender</strong>
          <p>${escapeHtml(intro)}</p>
          ${coverage.length ? `
            <div class="adm-coverage-pills">
              ${coverage.map(c => `<span class="adm-pill">${escapeHtml(c)}</span>`).join('')}
            </div>
          ` : ''}
        </article>
      `;
    }

    function renderTopicLesson(topic) {
      const lesson = topic.lesson || {};
      const subtopics = Array.isArray(lesson.subtopics) ? lesson.subtopics : [];
      const rules = Array.isArray(lesson.rules) ? lesson.rules : [];
      const applications = Array.isArray(lesson.applications) ? lesson.applications : [];
      if (!subtopics.length && !rules.length && !applications.length) return '';

      return `
        <article class="adm-lesson-card is-course">
          <span class="adm-feature-icon">${icon('bi-easel2')}</span>
          <strong>Clase rápida</strong>
          ${subtopics.length ? `
            <div class="adm-subtopic-list">
              ${subtopics.map((item) => `
                <section class="adm-subtopic-card">
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.detail)}</p>
                  ${Array.isArray(item.examples) && item.examples.length ? `
                    <ul>
                      ${item.examples.map((example) => `<li>${escapeHtml(example)}</li>`).join('')}
                    </ul>
                  ` : ''}
                </section>
              `).join('')}
            </div>
          ` : ''}
          ${rules.length ? `
            <div class="adm-rule-box">
              <strong>${icon('bi-braces-asterisk')} Reglas, fórmulas o ideas esenciales</strong>
              <ul>${rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${applications.length ? `
            <div class="adm-application-box">
              <strong>${icon('bi-compass')} Dónde se aplica</strong>
              <ul>${applications.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </article>
      `;
    }

    function renderTopicPhase2(topic) {
      const concepts = topic.learning?.keyConcepts || topic.concepts || [];
      const explanation = topic.lesson?.conceptIntro || topic.summary || topic.explanation || '';
      return `
        <article class="adm-lesson-card is-phase2">
          <span class="adm-feature-icon">${icon('bi-lightbulb')}</span>
          <strong>Conceptos clave</strong>
          <p>${escapeHtml(explanation)}</p>
          ${concepts.length ? `
            <div class="adm-concept-cards">
              ${concepts.map(c => `<div class="adm-concept-card">${escapeHtml(c)}</div>`).join('')}
            </div>
          ` : ''}
        </article>
      `;
    }

    function renderTopicPhase3(examples) {
      if (!examples.length) return '';
      return `
        <article class="adm-lesson-card is-phase3">
          <span class="adm-feature-icon">${icon('bi-card-checklist')}</span>
          <strong>Ejemplos resueltos</strong>
          <div class="adm-examples-carousel">
            ${examples.map((ex, i) => `
              <div class="adm-example-item">
                <span class="adm-example-index">Ejemplo ${i + 1} de ${examples.length}</span>
                ${ex.level ? `<small class="adm-mini-label">${escapeHtml(ex.level)}</small>` : ''}
                ${renderStimulus(ex)}
                <p><strong>${escapeHtml(ex.problem)}</strong></p>
                <ol>
                  ${(ex.steps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
                </ol>
                <div class="adm-example-answer">Respuesta: ${escapeHtml(ex.answer)}</div>
              </div>
            `).join('')}
          </div>
        </article>
      `;
    }

    function renderTopicPhase4(area, topic, questions) {
      const topicKey = getTopicKey(area.id, topic.id);
      return `
        <article class="adm-lesson-card is-phase4">
          <span class="adm-feature-icon">${icon('bi-patch-question')}</span>
          <strong>Verifica lo aprendido</strong>
          <p>Responde estos reactivos rápidos para comprobar tu comprensión del tema.</p>
          <div class="adm-inline-practice">
            ${questions.map((q, i) => {
              const answer = _ui.microAnswers?.[`${topicKey}-${i}`];
              const evaluated = typeof answer === 'number';
              const correct = evaluated && answer === Number(q.correctIndex);
              return `
                <div class="adm-inline-question">
                  <p><strong>${escapeHtml(q.question)}</strong></p>
                  <div class="adm-option-list">
                    ${(q.options || []).map((option, index) => `
                      <label class="adm-option ${evaluated && index === Number(q.correctIndex) ? 'is-correct' : ''} ${evaluated && answer === index && !correct ? 'is-wrong' : ''}">
                        <input type="radio" name="micro-${escapeHtml(topicKey)}-${i}" value="${index}" data-action="micro-answer-v2" data-area-id="${escapeHtml(area.id)}" data-topic-id="${escapeHtml(topic.id)}" data-q-index="${i}" ${answer === index ? 'checked' : ''}>
                        <span>${escapeHtml(option)}</span>
                      </label>
                    `).join('')}
                  </div>
                  ${evaluated ? `<div class="adm-result ${correct ? 'is-good' : 'is-bad'}">${correct ? 'Bien. ' : 'Repasa esta parte. '}${escapeHtml(q.explanation)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </article>
      `;
    }

    function renderTopicPhase5(topic) {
      const mistakes = topic.commonMistakes || [];
      const checklist = topic.checkpoint?.items || [];
      return `
        <article class="adm-lesson-card is-phase5">
          <span class="adm-feature-icon">${icon('bi-flag')}</span>
          <strong>Cierre del tema</strong>
          ${mistakes.length ? `
            <div class="adm-mistakes-box">
              <strong><i class="bi bi-exclamation-triangle"></i> Errores comunes a evitar:</strong>
              <ul>${mistakes.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${checklist.length ? `
            <div class="adm-checkpoint-box">
              <strong>${escapeHtml(topic.checkpoint?.prompt || 'Cierra el tema si puedes:')}</strong>
              <ul class="adm-checklist">
                ${checklist.map(item => `<li><i class="bi bi-check2-square"></i> ${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </article>
      `;
    }

    function renderPractice(metrics) {
      const career = metrics.career;
      if (!career) {
        return renderSectionPrompt('bi-ui-checks-grid', 'Práctica personalizada', 'Primero elige carrera para generar reactivos de tus bloques.', 'Elegir carrera', 'route');
      }
      const weakTopics = metrics.weakTopics;
      const bank = getCareerBankMetrics(career);

      return `
        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Práctica guiada</span>
            <h1>Entrena con retroalimentación</h1>
            <p>Usa esta sección para detectar qué tema reforzar antes de hacer un simulador. Tu ruta tiene ${bank.questions} reactivos y ${bank.examples} ejemplos disponibles.</p>
          </div>
          <div class="adm-practice-grid">
            ${renderPracticeCard('bi-signpost-split', 'Mi ruta', '15 reactivos aleatorios con los bloques de tu carrera.', 'start-route-practice', '', 'Comenzar')}
            ${renderPracticeCard('bi-bullseye', 'Tema débil', weakTopics[0] ? `${weakTopics[0].topicTitle}: ${weakTopics[0].percent}%` : 'Aparecerá cuando tengas intentos calificados.', weakTopics[0] ? 'start-topic-practice' : 'go-screen', weakTopics[0] ? `data-area-id="${escapeHtml(weakTopics[0].areaId)}" data-topic-id="${escapeHtml(weakTopics[0].topicId)}"` : 'data-screen="learn"', weakTopics[0] ? 'Reforzar' : 'Ver temas')}
            ${renderPracticeCard('bi-stopwatch', 'Simulador', '25 reactivos sin ayuda, con revisión al final.', 'start-simulator', '', 'Abrir')}
          </div>
        </section>

        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Practicar por bloque</span>
            <h2>Elige un área de tu carrera</h2>
          </div>
          <div class="adm-route-list">
            ${getRouteAreas().map((area) => renderPracticeArea(area)).join('')}
          </div>
        </section>
      `;
    }

    function renderPracticeCard(iconName, title, body, action, extraAttrs, buttonText) {
      return `
        <article class="adm-practice-card">
          <span class="adm-feature-icon">${icon(iconName)}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(body)}</p>
          <button class="adm-button is-primary" type="button" data-action="${escapeHtml(action)}" ${extraAttrs || ''}>${escapeHtml(buttonText)}</button>
        </article>
      `;
    }

    function renderPracticeArea(area) {
      const progress = getAreaProgress(area.id);
      const questionCount = getAreaQuestionPool(area.id, false).length;
      return `
        <article class="adm-route-item">
          <div class="adm-route-main">
            <span class="adm-area-icon">${icon(AREA_ICONS[area.id] || 'bi-journal')}</span>
            <div>
              <strong>${escapeHtml(area.title)}</strong>
              <p>${escapeHtml(area.strategy || area.summary)}</p>
              <small>${progress.total} temas · ${questionCount} reactivos · ${progress.practicePercent === null ? 'sin intento' : `${progress.practicePercent}% práctica`}</small>
            </div>
          </div>
          <button class="adm-button is-soft" type="button" data-action="start-area-practice" data-area-id="${escapeHtml(area.id)}">Practicar bloque</button>
        </article>
      `;
    }

    function renderQuiz() {
      const question = _ui.quizQuestions[_ui.quizIndex];
      if (!question) return renderSectionPrompt('bi-ui-checks', 'Práctica vacía', 'Vuelve a elegir un bloque o tema.', 'Practicar', 'practice');
      const answer = _ui.quizAnswers[question.id];
      const resultItem = _ui.quizResult?.items?.find((item) => item.id === question.id);
      const total = _ui.quizQuestions.length;
      const answered = Object.keys(_ui.quizAnswers || {}).length;
      const isSimulator = _ui.quizMode === 'simulator';

      return `
        <section class="adm-quiz-shell">
          <button class="adm-back-link" type="button" data-action="go-screen" data-screen="practice">${icon('bi-arrow-left')} Salir</button>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="adm-kicker">${escapeHtml(isSimulator ? 'Simulacro SIA — No es el examen oficial' : 'Práctica')}</span>
            ${isSimulator && !_ui.quizSubmitted ? `<span class="adm-timer" style="color:var(--text-secondary); font-variant-numeric: tabular-nums;">${icon('bi-clock')} 60:00 (ref)</span>` : ''}
          </div>
          <h1>${escapeHtml(_ui.quizTitle)}</h1>
          <p>${escapeHtml(_ui.quizDescription)}</p>

          ${_ui.quizSubmitted ? renderQuizResult() : `
            <div class="adm-mini-progress" aria-label="${answered} de ${total} respondidas">
              <span style="width:${total ? Math.round((answered / total) * 100) : 0}%"></span>
            </div>
            <small>${answered}/${total} respondidas</small>
          `}

          <article class="adm-question-card">
            <span class="adm-question-index">${_ui.quizIndex + 1} de ${total}</span>
            ${renderQuestionContext(question)}
            <h2>${escapeHtml(question.question)}</h2>
            <div class="adm-option-list">
              ${(question.options || []).map((option, index) => {
                const isChosen = Number(answer) === index;
                const isCorrect = _ui.quizSubmitted && Number(question.correctIndex) === index;
                const isWrong = _ui.quizSubmitted && isChosen && !isCorrect;
                return `
                  <label class="adm-option ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}">
                    <input type="radio" name="quiz-${escapeHtml(question.id)}" value="${index}" data-action="quiz-answer" data-question-id="${escapeHtml(question.id)}" ${isChosen ? 'checked' : ''} ${_ui.quizSubmitted ? 'disabled' : ''}>
                    <span>${escapeHtml(option)}</span>
                  </label>
                `;
              }).join('')}
            </div>
            ${_ui.quizSubmitted && resultItem && !isSimulator ? `<div class="adm-result ${resultItem.isCorrect ? 'is-good' : 'is-bad'}">${escapeHtml(question.explanation)}</div>` : ''}
            ${_ui.quizSubmitted && resultItem && isSimulator ? `<div class="adm-result ${resultItem.isCorrect ? 'is-good' : 'is-bad'}">${resultItem.isCorrect ? 'Correcto' : 'Incorrecto'}. ${escapeHtml(question.explanation)}</div>` : ''}
          </article>

          <div class="adm-quiz-actions">
            <button class="adm-button is-ghost" type="button" data-action="prev-question" ${_ui.quizIndex === 0 ? 'disabled' : ''}>Anterior</button>
            ${_ui.quizIndex < total - 1 ? `<button class="adm-button is-primary" type="button" data-action="next-question">Siguiente</button>` : ''}
            ${!_ui.quizSubmitted ? `<button class="adm-button is-primary" type="button" data-action="submit-quiz" ${answered < total ? 'disabled' : ''}>Calificar ${answered}/${total}</button>` : `<button class="adm-button is-soft" type="button" data-action="go-screen" data-screen="practice">Volver a práctica</button>`}
          </div>
        </section>
      `;
    }

    function renderQuestionContext(question) {
      const stimulus = renderStimulus(question);
      if (!question?.context && !stimulus) return '';
      const sourceLabel = question.source === 'temario-oficial'
        ? 'Temario oficial'
        : question.source
          ? `Material SIA: ${question.source}`
          : 'Contexto del reactivo';
      return `
        <aside class="adm-question-context">
          <span>${icon('bi-info-circle')} ${escapeHtml(sourceLabel)}</span>
          ${question.context ? `<p>${escapeHtml(question.context)}</p>` : ''}
          ${stimulus}
        </aside>
      `;
    }

    function renderStimulus(item) {
      if (!item) return '';
      const parts = [];
      if (item.formula) {
        parts.push(`<div class="adm-stimulus-line"><strong>Fórmula:</strong> ${escapeHtml(item.formula)}</div>`);
      }
      if (item.diagramText) {
        parts.push(`<pre class="adm-stimulus-diagram">${escapeHtml(item.diagramText)}</pre>`);
      }
      if (Array.isArray(item.table) && item.table.length) {
        parts.push(`
          <div class="adm-stimulus-table-wrap">
            <table class="adm-stimulus-table">
              <tbody>
                ${item.table.map((row) => `<tr>${(row || []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </div>
        `);
      }
      return parts.length ? `<div class="adm-stimulus">${parts.join('')}</div>` : '';
    }

    function renderQuizResult() {
      const result = _ui.quizResult;
      if (!result) return '';
      const label = result.percent >= 80 ? 'Vas muy bien' : result.percent >= 60 ? 'Vas avanzando' : 'Conviene reforzar';
      
      let breakdown = '';
      if (_ui.quizMode === 'simulator') {
        const byArea = {};
        result.items.forEach(item => {
          if (!byArea[item.areaId]) byArea[item.areaId] = { correct: 0, total: 0, title: item.areaTitle };
          byArea[item.areaId].total++;
          if (item.isCorrect) byArea[item.areaId].correct++;
        });
        
        breakdown = `
          <div class="adm-score-breakdown" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem; text-align:left;">
            <strong>Desglose por área:</strong>
            <ul style="list-style:none; padding:0; margin-top:0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
              ${Object.values(byArea).map(a => `
                <li style="display:flex; justify-content:space-between; font-size:0.875rem;">
                  <span>${escapeHtml(a.title)}</span>
                  <strong>${a.correct}/${a.total} (${Math.round((a.correct/a.total)*100)}%)</strong>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
      
      return `
        <div class="adm-score-card">
          <strong>${result.percent}%</strong>
          <span>${label}</span>
          <small>${result.correct} de ${result.total} correctas</small>
          ${breakdown}
        </div>
      `;
    }

    function renderExam() {
      const admissions = _resources.admissions;
      return `
        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Admisión 2026</span>
            <h1>Fechas y proceso</h1>
            <p>Consulta lo esencial para no perderte: ficha, pago, examen, propedéutico y soporte.</p>
          </div>
          <div class="adm-date-grid">
            ${(admissions.timeline || []).map((item) => `
              <article class="adm-date-card">
                <span>${escapeHtml(item.status)}</span>
                <strong>${escapeHtml(item.label)}</strong>
                <p>${escapeHtml(item.date)}</p>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Pasos oficiales</span>
            <h2>Proceso sin vueltas</h2>
          </div>
          <div class="adm-process-list">
            ${(admissions.processSteps || []).map((step, index) => `
              <article class="adm-process-step">
                <span>${index + 1}</span>
                <div>
                  <strong>${escapeHtml(step.title)}</strong>
                  <small>${escapeHtml(step.dateLabel)}</small>
                  <p>${escapeHtml(step.description)}</p>
                </div>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="adm-section">
          <div class="adm-info-grid">
            <article class="adm-info-card">
              <span class="adm-feature-icon">${icon('bi-credit-card')}</span>
              <strong>Pago</strong>
              <p>${escapeHtml(admissions.payment?.amount || '')} en ${escapeHtml(admissions.payment?.bank || '')}. Incluye ficha, examen y curso propedéutico.</p>
            </article>
            <article class="adm-info-card">
              <span class="adm-feature-icon">${icon('bi-envelope')}</span>
              <strong>Soporte</strong>
              <p>${escapeHtml(admissions.support?.email || '')}</p>
              <small>${escapeHtml(admissions.support?.hours || '')}</small>
            </article>
          </div>
          <div class="adm-cta-row">
            <a class="adm-button is-primary" href="${escapeHtml(admissions.platform?.registrationUrl || '#')}" target="_blank" rel="noopener noreferrer">${icon('bi-box-arrow-up-right')} Portal de registro</a>
            <a class="adm-button is-soft" href="${escapeHtml(admissions.support?.officialSite || '#')}" target="_blank" rel="noopener noreferrer">${icon('bi-globe2')} Sitio oficial</a>
          </div>
        </section>

        <section class="adm-section">
          <div class="adm-section-head">
            <span class="adm-kicker">Preguntas frecuentes</span>
            <h2>Dudas comunes</h2>
          </div>
          <div class="adm-faq-list">
            ${(admissions.faq || []).map((item) => `
              <details>
                <summary>${escapeHtml(item.question)}</summary>
                <p>${escapeHtml(item.answer)}</p>
              </details>
            `).join('')}
          </div>
        </section>
      `;
    }

    function renderSectionPrompt(iconName, title, body, actionLabel, screen) {
      return `
        <section class="adm-empty">
          <span class="adm-feature-icon">${icon(iconName)}</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(body)}</p>
          <button class="adm-button is-primary" type="button" data-action="go-screen" data-screen="${escapeHtml(screen)}">${escapeHtml(actionLabel)}</button>
        </section>
      `;
    }

    function renderEmptyGuide(iconName, title, body) {
      return `
        <section class="adm-empty">
          <span class="adm-feature-icon">${icon(iconName)}</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
        </section>
      `;
    }

    function renderCareerChangeModal() {
      if (!_ui.pendingCareerId) return '';
      const nextCareer = getCareer(_ui.pendingCareerId);
      const currentCareer = getSelectedCareer();
      if (!nextCareer) return '';
      return `
        <div class="adm-modal-backdrop" role="presentation">
          <section class="adm-mini-modal" role="dialog" aria-modal="true" aria-labelledby="adm-career-modal-title">
            <span class="adm-feature-icon">${icon('bi-arrow-left-right')}</span>
            <div>
              <span class="adm-kicker">Cambiar carrera</span>
              <h2 id="adm-career-modal-title">¿Cómo quieres cambiar a ${escapeHtml(nextCareer.shortName || nextCareer.name)}?</h2>
              <p>Vienes de ${escapeHtml(currentCareer?.shortName || currentCareer?.name || 'otra ruta')}. Puedes conservar los temas ya superados que también existan en la nueva ruta, o reiniciar todo tu avance local y empezar de cero.</p>
            </div>
            <div class="adm-modal-actions">
              <button class="adm-button is-primary" type="button" data-action="confirm-career-change" data-mode="keep">${icon('bi-check2-circle')} Conservar compatibles</button>
              <button class="adm-button is-soft" type="button" data-action="confirm-career-change" data-mode="reset">${icon('bi-arrow-counterclockwise')} Reiniciar todo</button>
              <button class="adm-link-button" type="button" data-action="cancel-career-change">Cancelar</button>
            </div>
          </section>
        </div>
      `;
    }

    function renderActiveScreen(metrics) {
      if (_ui.screen === 'tour') return renderTour();
      if (_ui.screen === 'route') return renderRoute(metrics);
      if (_ui.screen === 'learn') return renderLearn(metrics);
      if (_ui.screen === 'topic') return renderTopicDetail();
      if (_ui.screen === 'practice') return renderPractice(metrics);
      if (_ui.screen === 'quiz') return renderQuiz();
      if (_ui.screen === 'exam') return renderExam();
      return renderWelcome(metrics);
    }

    function renderError(error) {
      _root.innerHTML = `
        <div class="adm-shell">
          ${renderAppBar()}
          <section class="adm-empty">
            <span class="adm-feature-icon">${icon('bi-exclamation-triangle')}</span>
            <h1>No se pudo cargar admisiones</h1>
            <p>${escapeHtml(error?.message || 'Intenta recargar la página.')}</p>
            <button class="adm-button is-primary" type="button" data-action="back-landing">Regresar a SIA</button>
          </section>
        </div>
      `;
    }

    function render() {
      if (!_root || !_resources || !_guest || !_ui) return;
      const metrics = computeMetrics();
      _root.innerHTML = `
        <div class="adm-shell">
          ${renderAppBar()}
          ${renderNav()}
          <main class="adm-main">
            ${renderActiveScreen(metrics)}
          </main>
          <footer class="adm-footer">
            <button class="adm-link-button" type="button" data-action="back-landing">${icon('bi-arrow-left-circle')} Regresar al inicio de SIA</button>
            <button class="adm-link-button" type="button" data-action="reset-progress">${icon('bi-arrow-counterclockwise')} Reiniciar avance local</button>
          </footer>
          ${renderCareerChangeModal()}
          ${renderSimulatorModal()}
        </div>
      `;
    }

    function renderSimulatorModal() {
      if (_ui.screen !== 'quiz' || _ui.quizMode !== 'simulator' || _ui.simulatorAccepted) return '';
      return `
        <div class="adm-modal-backdrop" role="presentation">
          <section class="adm-mini-modal" role="dialog" aria-modal="true" aria-labelledby="adm-simulator-modal-title">
            <span class="adm-feature-icon" style="color:var(--danger)">${icon('bi-exclamation-triangle')}</span>
            <div>
              <span class="adm-kicker">Antes de comenzar</span>
              <h2 id="adm-simulator-modal-title">Este es un simulacro de práctica</h2>
              <p>Ninguno de los reactivos que verás corresponde al examen EVALUATEC oficial.</p>
              <p>El simulador está basado en el temario de la Guía EVALUATEC 2026, pero los reactivos son material didáctico de SIA creado para ayudarte a estudiar.</p>
              <p>El examen real puede tener cualquier formato y contenido diferente.</p>
            </div>
            <div class="adm-modal-actions">
              <button class="adm-button is-primary" type="button" data-action="accept-simulator">${icon('bi-check-circle')} Entendido, comenzar</button>
              <button class="adm-button is-ghost" type="button" data-action="go-screen" data-screen="practice">Cancelar</button>
            </div>
          </section>
        </div>
      `;
    }

    function handleBackLanding() {
      const router = window.SIA?._router || window.SIA_CORE?.router;
      if (router?.navigate) {
        router.navigate('landing', true, true);
        return;
      }
      window.location.hash = '#/';
    }

    function handleClick(event) {
      const target = event.target.closest('[data-action]');
      if (!target || !_root.contains(target)) return;
      const action = target.dataset.action;
      const screen = target.dataset.screen;
      const areaId = target.dataset.areaId;
      const topicId = target.dataset.topicId;

      if (action === 'back-landing') {
        handleBackLanding();
        return;
      }

      if (action === 'open-vocacional') {
        openVocacionalEntry();
        return;
      }

      if (action === 'go-screen') {
        goToScreen(screen || 'welcome');
        return;
      }

      if (action === 'finish-tour') {
        GuestStore.patch({ tourSeen: true });
        goToScreen('route');
        return;
      }

      if (action === 'set-career') {
        const career = getCareer(target.dataset.careerId);
        if (!career) return;
        requestCareerSelection(career);
        return;
      }

      if (action === 'toggle-career-picker') {
        _ui.careerPickerExpanded = true;
        render();
        return;
      }

      if (action === 'accept-simulator') {
        _ui.simulatorAccepted = true;
        _ui.simulatorStartTime = Date.now();
        render();
        return;
      }

      if (action === 'cancel-career-change') {
        _ui.pendingCareerId = '';
        _ui.careerPickerExpanded = false;
        render();
        return;
      }

      if (action === 'confirm-career-change') {
        const career = getCareer(_ui.pendingCareerId);
        const mode = target.dataset.mode === 'reset' ? 'reset' : 'keep';
        _ui.pendingCareerId = '';
        applyCareerSelection(career, mode);
        return;
      }

      if (action === 'focus-area') {
        _ui.areaId = areaId || '';
        _ui.screen = 'learn';
        render();
        return;
      }

      if (action === 'open-topic') {
        openTopic(areaId, topicId);
        return;
      }

      if (action === 'mark-topic') {
        GuestStore.updateTopic(getTopicKey(areaId, topicId), { studied: true });
        render();
        return;
      }

      if (action === 'toggle-bookmark') {
        GuestStore.toggleBookmark(getTopicKey(areaId, topicId));
        render();
        return;
      }

      if (action === 'start-topic-practice') {
        startQuiz({
          mode: 'practice',
          title: 'Práctica por tema',
          description: 'Cinco reactivos para reforzar este subtema.',
          questions: PracticeEngine.topicQuiz(areaId, topicId),
          quizId: `topic-${areaId}-${topicId}`,
          areaId,
          topicId
        });
        return;
      }

      if (action === 'start-area-practice') {
        const area = getArea(areaId);
        startQuiz({
          mode: 'practice',
          title: area ? `Práctica de ${area.title}` : 'Práctica por bloque',
          description: 'Reactivos guiados con explicación al calificar.',
          questions: PracticeEngine.areaQuiz(areaId),
          quizId: `area-${areaId}`,
          areaId
        });
        return;
      }

      if (action === 'start-route-practice') {
        startQuiz({
          mode: 'practice',
          title: 'Práctica de mi ruta',
          description: 'Quince reactivos aleatorios con los bloques de tu carrera.',
          questions: PracticeEngine.routeQuiz(15),
          quizId: `route-${_guest.selectedCareer || 'general'}`
        });
        return;
      }

      if (action === 'start-simulator') {
        startQuiz({
          mode: 'simulator',
          title: 'Simulador EVALUATEC',
          description: 'Veinticinco reactivos sin ayuda. La revisión aparece al final.',
          questions: PracticeEngine.simulator(25),
          quizId: `simulator-${_guest.selectedCareer || 'general'}`
        });
        return;
      }

      if (action === 'prev-question') {
        _ui.quizIndex = clamp(_ui.quizIndex - 1, 0, _ui.quizQuestions.length - 1);
        render();
        return;
      }

      if (action === 'next-question') {
        _ui.quizIndex = clamp(_ui.quizIndex + 1, 0, _ui.quizQuestions.length - 1);
        render();
        return;
      }

      if (action === 'submit-quiz') {
        const missing = _ui.quizQuestions.some((question) => !Object.prototype.hasOwnProperty.call(_ui.quizAnswers, question.id));
        if (missing) {
          window.showToast?.('Responde todos los reactivos antes de calificar.', 'warning');
          return;
        }
        _ui.quizSubmitted = true;
        _ui.quizResult = PracticeEngine.grade(_ui.quizQuestions, _ui.quizAnswers);
        persistPracticeResult();
        render();
        return;
      }

      if (action === 'reset-progress') {
        const confirmed = window.confirm('Se reiniciará sólo el avance local de este dispositivo. ¿Deseas continuar?');
        if (!confirmed) return;
        _guest = GuestStore.reset();
        _ui = defaultUiState();
        render();
      }
    }

    function handleChange(event) {
      const target = event.target;
      if (!target || !target.dataset.action) return;

      if (target.dataset.action === 'quiz-answer') {
        _ui.quizAnswers = {
          ..._ui.quizAnswers,
          [target.dataset.questionId]: Number(target.value)
        };
        render();
        return;
      }

      if (target.dataset.action === 'micro-answer-v2') {
        const areaId = target.dataset.areaId;
        const topicId = target.dataset.topicId;
        const qIndex = target.dataset.qIndex;
        const topicKey = getTopicKey(areaId, topicId);
        const value = Number(target.value);
        
        _ui.microAnswers = { ...(_ui.microAnswers || {}), [`${topicKey}-${qIndex}`]: value };
        
        const topic = getTopic(areaId, topicId);
        const area = getArea(areaId);
        if (area && topic) {
          const inlineQuestions = getTopicQuestionPool(area, topic).slice(0, 3);
          const correctCount = inlineQuestions.filter((q, i) => _ui.microAnswers?.[`${topicKey}-${i}`] === Number(q.correctIndex)).length;
          if (correctCount >= 2) {
            GuestStore.updateTopic(topicKey, { practiced: true, studied: true });
          } else {
            GuestStore.updateTopic(topicKey, { practiced: true });
          }
        }
        render();
        return;
      }
    }

    function applyInitialState(options = {}) {
      _ui = defaultUiState();
      const firstArea = getRouteAreaIds()[0] || '';
      _ui.areaId = firstArea;

      if (options.resume !== false && _guest?.lastVisited?.kind === 'topic') {
        const { areaId, topicId } = _guest.lastVisited;
        if (getTopic(areaId, topicId) && topicBelongsToCareer(areaId, topicId)) {
          _ui.screen = 'topic';
          _ui.areaId = areaId;
          _ui.topicId = topicId;
          return;
        }
      }

      _ui.screen = _guest?.tourSeen ? 'welcome' : 'welcome';
    }

    async function init(ctx, options = {}) {
      _ctx = ctx;
      try {
        ensureRoot();
        ensureStyles();
        _resources = await ContentRepo.load();
        _guest = GuestStore.load();
        applyInitialState(options);
        bindEvents();
        render();
      } catch (error) {
        console.error('[AdmisionesPublic] Error al iniciar:', error);
        if (_root) renderError(error);
      }
    }

    function resetGuestProgress() {
      _guest = GuestStore.reset();
      _ui = defaultUiState();
      render();
    }

    function resumeGuestProgress() {
      _guest = GuestStore.load();
      applyInitialState({ resume: true });
      render();
    }

    return {
      init,
      resetGuestProgress,
      resumeGuestProgress
    };
  })();
}
