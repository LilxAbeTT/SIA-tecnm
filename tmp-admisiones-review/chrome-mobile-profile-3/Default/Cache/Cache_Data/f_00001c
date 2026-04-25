// modules/encuestas.js
// Orquestador del Centro de Encuestas.

(function () {
  const root = window.Encuestas || {};

  const state = {
    ctx: null,
    profile: null,
    isAdmin: false,
    currentTab: 'crear',
    studentFilter: 'pending',
    studentQuery: '',
    questionCounter: 0,
    surveys: [],
    selectedResultsSurveyId: '',
    editingSurveyId: null,
    builderSnapshot: null,
    studentFeed: null,
    chartInstances: {}
  };

  const QUESTION_TYPES = [
    { id: 'multiple', label: 'Opcion multiple', icon: 'bi-list-check' },
    { id: 'checkboxes', label: 'Seleccion multiple', icon: 'bi-ui-checks-grid' },
    { id: 'select', label: 'Lista desplegable', icon: 'bi-menu-button-wide' },
    { id: 'open', label: 'Texto abierto', icon: 'bi-chat-text' },
    { id: 'boolean', label: 'Verdadero / Falso', icon: 'bi-toggle-on' },
    { id: 'scale', label: 'Escala numerica', icon: 'bi-speedometer2' },
    { id: 'date', label: 'Fecha', icon: 'bi-calendar-event' }
  ];

  const AUDIENCE_OPTIONS = [
    { id: 'aud-est', value: 'estudiantes', label: 'Estudiantes', icon: 'bi-mortarboard-fill' },
    { id: 'aud-doc', value: 'docentes', label: 'Docentes', icon: 'bi-person-workspace' },
    { id: 'aud-adm', value: 'administrativos', label: 'Administrativos', icon: 'bi-briefcase-fill' },
    { id: 'aud-op', value: 'operativos', label: 'Operativos', icon: 'bi-tools' }
  ];

  const HELP_TOPICS = {
    delivery: {
      title: 'Prioridad de respuesta',
      body: 'Usa "Opcional" para campañas informativas, "Obligatoria" para seguimiento prioritario y "Bloquea acceso" cuando deba responderse antes de continuar en la app.'
    },
    audience: {
      title: 'Audiencia',
      body: 'La audiencia define a quien se asigna la encuesta. Si marcas "Encuesta publica", se ignora la audiencia y el enlace podra compartirse fuera de SIA.'
    },
    schedule: {
      title: 'Vigencia',
      body: 'Con fechas programadas puedes lanzar o cerrar una campaña sin volver a entrar al modulo. Fuera de vigencia la encuesta ya no se mostrara a estudiantes.'
    },
    stories: {
      title: 'Stories y novedades',
      body: 'Si mantienes activado "Mostrar en novedades", la encuesta tambien aparecera en la franja de novedades del dashboard del estudiante.'
    },
    public: {
      title: 'Encuesta publica',
      body: 'Las encuestas publicas son para enlaces y QR compartibles. Solo las campañas marcadas como publicas podran verse sin iniciar sesion.'
    },
    services: {
      title: 'Encuestas de servicio',
      body: 'Estas encuestas se activan por uso de modulo o por lanzamiento global. Sirven para biblioteca, servicio medico y psicologia.'
    },
    results: {
      title: 'Resultados',
      body: 'Desde resultados puedes revisar analitica, respuestas individuales y exportar CSV. Las metricas se alimentan con triggers del lado de Firebase.'
    }
  };

  const SERVICE_DEFAULTS = {
    biblioteca: {
      title: 'Encuesta de satisfaccion - Biblioteca',
      description: 'Tu opinion ayuda a mejorar atencion, espacios y recursos de biblioteca.',
      questions: [
        { id: 'q0', type: 'multiple', text: 'Como calificas la atencion del personal?', required: true, options: ['Excelente', 'Buena', 'Regular', 'Mala'] },
        { id: 'q1', type: 'multiple', text: 'Encontraste el recurso o apoyo que necesitabas?', required: true, options: ['Si, completamente', 'Parcialmente', 'No'] },
        { id: 'q2', type: 'scale', text: 'Califica tu experiencia general en biblioteca', required: true, min: 1, max: 10 },
        { id: 'q3', type: 'open', text: 'Que deberiamos mejorar?', required: false }
      ]
    },
    'servicio-medico': {
      title: 'Encuesta de satisfaccion - Servicio medico',
      description: 'Queremos saber si el servicio fue oportuno, claro y digno.',
      questions: [
        { id: 'q0', type: 'multiple', text: 'El tiempo de espera fue razonable?', required: true, options: ['Si', 'Mas o menos', 'No'] },
        { id: 'q1', type: 'multiple', text: 'Recibiste explicaciones claras sobre tu atencion?', required: true, options: ['Si', 'Parcialmente', 'No'] },
        { id: 'q2', type: 'boolean', text: 'Te sentiste tratado con respeto?', required: true },
        { id: 'q3', type: 'scale', text: 'Califica tu experiencia general', required: true, min: 1, max: 10 },
        { id: 'q4', type: 'open', text: 'Comentario adicional', required: false }
      ]
    },
    psicologia: {
      title: 'Encuesta de satisfaccion - Psicologia',
      description: 'Tu experiencia nos ayuda a fortalecer el acompanamiento psicopedagogico.',
      questions: [
        { id: 'q0', type: 'multiple', text: 'Te sentiste escuchado(a) durante la atencion?', required: true, options: ['Si, totalmente', 'Parcialmente', 'No'] },
        { id: 'q1', type: 'multiple', text: 'El proceso para solicitar el servicio fue sencillo?', required: true, options: ['Muy sencillo', 'Sencillo', 'Complicado'] },
        { id: 'q2', type: 'scale', text: 'Califica la utilidad del apoyo recibido', required: true, min: 1, max: 10 },
        { id: 'q3', type: 'open', text: 'Que sugerencia dejarias al servicio?', required: false }
      ]
    }
  };

  function esc(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value == null ? '' : String(value));
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(message, type = 'info') {
    if (window.showToast) window.showToast(message, type);
    else console.log('[Encuestas]', type, message);
  }

  function fmtDate(value, withTime = true) {
    const date = value ? (value.toDate ? value.toDate() : new Date(value)) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-MX', withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getCurrentCtx(ctxOrNull) {
    const base = ctxOrNull || state.ctx || (window.SIA?.getCtx ? window.SIA.getCtx() : null);
    if (!base) return null;
    if (!base.user && base.auth?.currentUser) {
      return { ...base, user: base.auth.currentUser };
    }
    return base;
  }

  function isAdminProfile(profile) {
    return !!window.EncuestasService?.isSurveyAdmin?.(profile);
  }

  function renderInfoButton(topic, label = 'Mas info') {
    return `<button type="button" class="btn btn-sm btn-link text-decoration-none p-0 align-baseline" onclick="Encuestas.showHelp('${topic}')" data-bs-toggle="tooltip" title="${esc(label)}"><i class="bi bi-info-circle-fill"></i></button>`;
  }

  function statusMeta(survey) {
    const runtime = survey.runtimeStatus || survey.status || 'draft';
    const map = {
      draft: { label: 'Borrador', badge: 'bg-secondary-subtle text-secondary' },
      active: { label: 'Activa', badge: 'bg-success-subtle text-success' },
      scheduled: { label: 'Programada', badge: 'bg-primary-subtle text-primary' },
      paused: { label: 'Pausada', badge: 'bg-warning-subtle text-warning' },
      closed: { label: 'Cerrada', badge: 'bg-dark-subtle text-dark' },
      archived: { label: 'Archivada', badge: 'bg-secondary bg-opacity-25 text-secondary' }
    };
    return map[runtime] || map.draft;
  }

  function getDraftKey(surveyId) {
    const uid = state.ctx?.user?.uid || 'anon';
    return `sia_encuesta_draft_v2_${uid}_${surveyId}`;
  }

  function saveDraftAnswers(surveyId, answers) {
    try {
      localStorage.setItem(getDraftKey(surveyId), JSON.stringify({ answers, updatedAt: Date.now() }));
    } catch (error) {
      console.warn('[Encuestas] No se pudo guardar borrador:', error);
    }
  }

  function loadDraftAnswers(surveyId) {
    try {
      const raw = localStorage.getItem(getDraftKey(surveyId));
      if (!raw) return {};
      return JSON.parse(raw)?.answers || {};
    } catch (error) {
      return {};
    }
  }

  function clearDraftAnswers(surveyId) {
    try {
      localStorage.removeItem(getDraftKey(surveyId));
    } catch (error) {
      console.warn('[Encuestas] No se pudo limpiar borrador:', error);
    }
  }

  function getReminderKey(surveyId) {
    const uid = state.ctx?.user?.uid || 'anon';
    return `sia_encuesta_remind_v1_${uid}_${surveyId}`;
  }

  function getReminderState(surveyId) {
    try {
      const raw = localStorage.getItem(getReminderKey(surveyId));
      const parsed = raw ? JSON.parse(raw) : {};
      const used = Math.max(0, Math.min(3, Number(parsed.used || 0)));
      return { used, max: 3 };
    } catch (error) {
      return { used: 0, max: 3 };
    }
  }

  function useReminder(surveyId) {
    const reminder = getReminderState(surveyId);
    const next = Math.min(reminder.max, reminder.used + 1);
    try {
      localStorage.setItem(getReminderKey(surveyId), JSON.stringify({ used: next, updatedAt: Date.now() }));
    } catch (error) {
      console.warn('[Encuestas] No se pudo actualizar recordatorio:', error);
    }
    return { used: next, max: reminder.max };
  }

  function questionUsesOptions(type) {
    return ['multiple', 'checkboxes', 'select'].includes(type);
  }

  function isAnswerEmpty(value) {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || value === '';
  }

  function formatAnswerValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    return value == null ? '' : String(value);
  }

  function collectQuestionAnswer(question, container, prefix) {
    if (!container || !question) return undefined;

    if (question.type === 'multiple' || question.type === 'boolean') {
      const selected = container.querySelector(`input[name="${prefix}_${question.id}"]:checked`) || container.querySelector(`input[name$="_${question.id}"]:checked`);
      if (!selected) return undefined;
      return question.type === 'boolean' ? selected.value === 'true' : selected.value;
    }

    if (question.type === 'checkboxes') {
      return [...container.querySelectorAll(`input[name="${prefix}_${question.id}"]:checked, input[name$="_${question.id}"]:checked`)]
        .map((input) => input.value)
        .filter(Boolean);
    }

    if (question.type === 'scale') {
      const input = container.querySelector(`#${prefix}_${question.id}_input`) || container.querySelector(`[id$="_${question.id}_input"]`);
      const value = input?.value;
      if (value === '' || value == null) return undefined;
      return Number(value);
    }

    const field = container.querySelector(`#${prefix}_${question.id}_input`) || container.querySelector(`[id$="_${question.id}_input"]`);
    const value = field?.value?.trim?.() || '';
    return value || undefined;
  }

  function restoreQuestionAnswer(question, container, prefix, value) {
    if (!container || !question || isAnswerEmpty(value)) return;

    if (question.type === 'multiple') {
      const radio = [...container.querySelectorAll(`input[name="${prefix}_${question.id}"]`)].find((item) => item.value === String(value));
      if (radio) radio.checked = true;
      return;
    }

    if (question.type === 'boolean') {
      const radio = container.querySelector(`input[name="${prefix}_${question.id}"][value="${value ? 'true' : 'false'}"]`);
      if (radio) radio.checked = true;
      return;
    }

    if (question.type === 'checkboxes') {
      const values = Array.isArray(value) ? value.map(String) : [String(value)];
      container.querySelectorAll(`input[name="${prefix}_${question.id}"]`).forEach((input) => {
        input.checked = values.includes(String(input.value));
      });
      return;
    }

    if (question.type === 'scale') {
      const button = [...container.querySelectorAll('button.enc-scale-btn[data-val]')].find((item) => Number(item.dataset.val) === Number(value));
      if (button) window.Encuestas.pickScaleValue(button, prefix, question.id, Number(value));
      return;
    }

    const field = container.querySelector(`#${prefix}_${question.id}_input`);
    if (field) field.value = String(value);
  }

  function getResumePage(questions = [], answers = {}) {
    const firstPendingIndex = (questions || []).findIndex((question) => isAnswerEmpty(answers?.[question.id]));
    return firstPendingIndex >= 0 ? firstPendingIndex + 1 : 1;
  }

  function buildSurveySections(questions = []) {
    const normalized = Array.isArray(questions) ? questions : [];
    const sections = normalized.map((question, index) => ({
      index: index + 1,
      from: index + 1,
      to: index + 1,
      questions: [question],
      questionIds: [question.id],
      title: `Pregunta ${index + 1}`,
      subtitle: `Pregunta ${index + 1} de ${normalized.length}`
    }));
    return sections.length ? sections : [{
      index: 1,
      from: 0,
      to: 0,
      questions: [],
      questionIds: [],
      title: 'Pregunta 1',
      subtitle: 'Sin preguntas'
    }];
  }

  function countAnsweredQuestions(questions = [], answers = {}) {
    return (questions || []).reduce((count, question) => {
      if (isAnswerEmpty(answers?.[question.id])) return count;
      return count + 1;
    }, 0);
  }

  function getFrequencyLabel(freq) {
    return {
      'per-use': 'Cada uso',
      weekly: 'Semanal',
      monthly: 'Mensual',
      custom: 'Personalizada'
    }[freq] || 'No configurada';
  }

  function getServiceMeta(serviceType) {
    return {
      biblioteca: { name: 'Biblioteca', icon: 'bi-book-half', tone: 'primary' },
      'servicio-medico': { name: 'Servicio medico', icon: 'bi-heart-pulse-fill', tone: 'danger' },
      psicologia: { name: 'Psicologia', icon: 'bi-brain', tone: 'info' }
    }[serviceType] || { name: serviceType, icon: 'bi-clipboard-data', tone: 'secondary' };
  }

  function toLocalDateTimeValue(dateValue) {
    const date = dateValue ? (dateValue.toDate ? dateValue.toDate() : new Date(dateValue)) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - (offset * 60000));
    return local.toISOString().slice(0, 16);
  }

  function getPublicDb() {
    return window.SIA?.db || state.ctx?.db || firebase.firestore();
  }

  function getShared() {
    return {
      state,
      constants: {
        QUESTION_TYPES,
        AUDIENCE_OPTIONS,
        HELP_TOPICS,
        SERVICE_DEFAULTS
      },
      helpers: {
        esc,
        toast,
        fmtDate,
        getCurrentCtx,
        isAdminProfile,
        renderInfoButton,
        statusMeta,
        getDraftKey,
        saveDraftAnswers,
        loadDraftAnswers,
        clearDraftAnswers,
        getReminderState,
        useReminder,
        questionUsesOptions,
        isAnswerEmpty,
        formatAnswerValue,
        collectQuestionAnswer,
        restoreQuestionAnswer,
        getResumePage,
        buildSurveySections,
        countAnsweredQuestions,
        getFrequencyLabel,
        getServiceMeta,
        toLocalDateTimeValue,
        getPublicDb
      },
      modules: {
        UI: root.UI,
        Forms: root.Forms,
        Responses: root.Responses,
        Nav: root.Nav
      }
    };
  }

  root.__getShared = getShared;

  function requireModule(name) {
    const module = root[name];
    if (!module) throw new Error(`Encuestas.${name} no esta disponible.`);
    return module;
  }

  async function init(ctx) {
    state.ctx = ctx;
    state.profile = ctx.profile;
    state.isAdmin = isAdminProfile(state.profile);

    const container = document.getElementById('view-encuestas');
    if (!container) return;
    container.innerHTML = state.isAdmin ? requireModule('UI').renderAdminShell() : requireModule('UI').renderStudentShell();
    if (state.isAdmin) await requireModule('Nav').initAdminView();
    else await requireModule('Nav').initStudentView();
    window.UI?.initTooltips?.();
  }

  const api = {
    init,
    initPublic: (...args) => requireModule('Responses').initPublic(...args),
    initAdminView: (...args) => requireModule('Nav').initAdminView(...args),
    initStudentView: (...args) => requireModule('Nav').initStudentView(...args),
    submitPublicSurvey: (...args) => requireModule('Responses').submitPublicSurvey(...args),
    switchTab: (...args) => requireModule('Nav').switchTab(...args),
    renderEncuestasServicioTab: (...args) => requireModule('Nav').renderEncuestasServicioTab(...args),
    loadResults: (...args) => requireModule('Responses').loadResults(...args),
    openResultsTab: (...args) => requireModule('Nav').openResultsTab(...args),
    showHelp: (...args) => requireModule('Nav').showHelp(...args),
    launchAdminTutorial: (...args) => requireModule('Nav').launchAdminTutorial(...args),
    resetBuilder: (...args) => requireModule('Forms').resetBuilder(...args),
    previewSurvey: (...args) => requireModule('Nav').previewSurvey(...args),
    addQuestion: (...args) => requireModule('Forms').addQuestion(...args),
    addQuestionToBuilder: (...args) => requireModule('Forms').addQuestionToBuilder(...args),
    onTypeChange: (...args) => requireModule('Forms').onTypeChange(...args),
    addOption: (...args) => requireModule('Forms').addOption(...args),
    toggleAllAudience: (...args) => requireModule('Forms').toggleAllAudience(...args),
    togglePublicMode: (...args) => requireModule('Forms').togglePublicMode(...args),
    saveSurvey: (...args) => requireModule('Nav').saveSurvey(...args),
    applyCampaignFilters: (...args) => requireModule('Nav').applyCampaignFilters(...args),
    openCreateModal: (...args) => requireModule('Nav').openCreateModal(...args),
    editSurvey: (...args) => requireModule('Nav').editSurvey(...args),
    duplicateSurvey: (...args) => requireModule('Nav').duplicateSurvey(...args),
    launchSurveyToAll: (...args) => requireModule('Nav').launchSurveyToAll(...args),
    toggleSurvey: (...args) => requireModule('Nav').toggleSurvey(...args),
    deleteSurvey: (...args) => requireModule('Nav').deleteSurvey(...args),
    showQR: (...args) => requireModule('Nav').showQR(...args),
    viewResponse: (...args) => requireModule('Responses').viewResponse(...args),
    exportCSV: (...args) => requireModule('Responses').exportCSV(...args),
    setStudentFilter: (...args) => requireModule('Nav').setStudentFilter(...args),
    setStudentQuery: (...args) => requireModule('Nav').setStudentQuery(...args),
    openStudentSurvey: (...args) => requireModule('Responses').openStudentSurvey(...args),
    startStudentSurvey: (...args) => requireModule('Responses').startStudentSurvey(...args),
    remindStudentSurveyLater: (...args) => requireModule('Responses').remindStudentSurveyLater(...args),
    saveStudentDraft: (...args) => requireModule('Responses').saveStudentDraft(...args),
    submitStudentSurvey: (...args) => requireModule('Responses').submitStudentSurvey(...args),
    checkAndShowLaunchedSurvey: (...args) => requireModule('Responses').checkAndShowLaunchedSurvey(...args),
    checkAndShowBlockingSurvey: (...args) => requireModule('Responses').checkAndShowBlockingSurvey(...args),
    openServiceConfig: (...args) => requireModule('Nav').openServiceConfig(...args),
    openServiceEditor: (...args) => requireModule('Nav').openServiceEditor(...args),
    saveServiceEditor: (...args) => requireModule('Nav').saveServiceEditor(...args),
    toggleServiceSurveyStatus: (...args) => requireModule('Nav').toggleServiceSurveyStatus(...args),
    triggerServiceSurveyToAll: (...args) => requireModule('Nav').triggerServiceSurveyToAll(...args),
    deactivateServiceSurveyToAll: (...args) => requireModule('Nav').deactivateServiceSurveyToAll(...args),
    viewServiceResults: (...args) => requireModule('Responses').viewServiceResults(...args),
    viewServiceResponse: (...args) => requireModule('Responses').viewServiceResponse(...args),
    exportServiceCSV: (...args) => requireModule('Responses').exportServiceCSV(...args),
    createDefaultServiceSurvey: (...args) => requireModule('Nav').createDefaultServiceSurvey(...args),
    checkAndShowServiceSurvey: (...args) => requireModule('Responses').checkAndShowServiceSurvey(...args),
    submitServiceSurvey: (...args) => requireModule('Responses').submitServiceSurvey(...args),
    skipServiceSurvey: (...args) => requireModule('Responses').skipServiceSurvey(...args),
    skipServiceSurveyNotUsed: (...args) => requireModule('Responses').skipServiceSurveyNotUsed(...args),
    cancelSkipServiceSurvey: (...args) => requireModule('Responses').cancelSkipServiceSurvey(...args),
    confirmSkipServiceSurvey: (...args) => requireModule('Responses').confirmSkipServiceSurvey(...args),
    restoreDefaultServiceSurvey: (...args) => requireModule('Nav').restoreDefaultServiceSurvey(...args),
    pickScaleValue: (...args) => requireModule('Forms').pickScaleValue(...args)
  };

  window.Encuestas = Object.assign(root, api);
})();
