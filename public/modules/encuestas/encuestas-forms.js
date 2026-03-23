// modules/encuestas/encuestas-forms.js
// Survey builders, answer collection and pagination helpers.

if (!window.Encuestas) window.Encuestas = {};

window.Encuestas.Forms = (function () {
  function getShared() {
    const shared = window.Encuestas?.__getShared?.();
    if (!shared) throw new Error('[Encuestas.Forms] Shared bridge unavailable.');
    return shared;
  }

  function getBuilderSurveyContext() {
    const { state } = getShared();
    const survey = state.builderSnapshot || null;
    return {
      survey,
      isEditing: !!(state.editingSurveyId || survey?.id),
      status: survey?.status || 'draft'
    };
  }

  function resetBuilder() {
    const { state } = getShared();
    state.editingSurveyId = null;
    state.builderSnapshot = null;
    state.questionCounter = 0;

    const title = document.getElementById('enc-title');
    if (!title) return;
    title.value = '';
    document.getElementById('enc-desc').value = '';
    document.getElementById('enc-public').checked = false;
    document.getElementById('enc-mandatory-mode').value = 'optional';
    document.getElementById('enc-show-stories').checked = true;
    document.getElementById('sched-manual').checked = true;
    document.getElementById('enc-dates').classList.add('d-none');
    document.getElementById('enc-start').value = '';
    document.getElementById('enc-end').value = '';
    document.querySelectorAll('#enc-audience-chips input').forEach((input) => {
      input.disabled = false;
      input.checked = input.id === 'aud-est';
    });

    const builder = document.getElementById('enc-questions-builder');
    if (!builder) return;
    builder.innerHTML = '';
    addQuestion();
  }

  function applyBuilderSnapshot(survey) {
    const { state, helpers } = getShared();
    if (!survey) return;

    state.editingSurveyId = survey.id || null;
    state.questionCounter = 0;
    document.getElementById('enc-title').value = survey.title || '';
    document.getElementById('enc-desc').value = survey.description || '';
    document.getElementById('enc-public').checked = !!survey.isPublic;
    document.getElementById('enc-mandatory-mode').value = survey.delivery?.mandatoryMode || 'optional';
    document.getElementById('enc-show-stories').checked = survey.delivery?.showInStories !== false;
    togglePublicMode(document.getElementById('enc-public'));
    document.querySelectorAll('#enc-audience-chips input').forEach((input) => { input.checked = false; });
    (survey.audience || ['estudiantes']).forEach((aud) => {
      const target = document.querySelector(`#enc-audience-chips input[value="${aud}"]`);
      if (target) target.checked = true;
    });

    const allBox = document.getElementById('aud-all');
    if (allBox) {
      allBox.checked = (survey.audience || []).includes('todos');
      toggleAllAudience(allBox);
    }

    if (survey.scheduling?.type === 'timed') {
      document.getElementById('sched-timed').checked = true;
      document.getElementById('enc-dates').classList.remove('d-none');
      document.getElementById('enc-start').value = survey.scheduling.startDate ? helpers.toLocalDateTimeValue(survey.scheduling.startDate) : '';
      document.getElementById('enc-end').value = survey.scheduling.endDate ? helpers.toLocalDateTimeValue(survey.scheduling.endDate) : '';
    } else {
      document.getElementById('sched-manual').checked = true;
      document.getElementById('enc-dates').classList.add('d-none');
    }

    const builder = document.getElementById('enc-questions-builder');
    if (!builder) return;
    builder.innerHTML = '';
    (survey.questions || []).forEach((question) => addQuestionToBuilder('enc-questions-builder', question));
    if (!(survey.questions || []).length) addQuestion();
  }

  function collectSurveyBuilderData() {
    const { helpers } = getShared();
    const title = document.getElementById('enc-title')?.value.trim();
    const description = document.getElementById('enc-desc')?.value.trim() || '';
    if (!title) {
      helpers.toast('Ingresa un titulo para la encuesta.', 'warning');
      return null;
    }

    const items = document.querySelectorAll('#enc-questions-builder .q-builder-item');
    if (!items.length) {
      helpers.toast('Agrega al menos una pregunta.', 'warning');
      return null;
    }

    const questions = [];
    for (const item of items) {
      const domId = item.dataset.qid;
      const text = item.querySelector(`#qt_${domId}`)?.value.trim();
      const type = item.querySelector(`#qtype_${domId}`)?.value || 'open';
      const required = item.querySelector(`#qreq_${domId}`)?.checked ?? true;
      if (!text) {
        helpers.toast('No dejes preguntas sin texto.', 'warning');
        return null;
      }

      const question = { id: `q${questions.length}`, type, text, required };
      if (helpers.questionUsesOptions(type)) {
        const options = [...item.querySelectorAll(`#qopts_${domId} input.form-control`)].map((input) => input.value.trim()).filter(Boolean);
        if (options.length < 2) {
          helpers.toast(`La pregunta "${text}" necesita al menos dos opciones.`, 'warning');
          return null;
        }
        question.options = options;
      }

      if (type === 'scale') {
        const min = Number(item.querySelector(`#qmin_${domId}`)?.value || 1);
        const max = Number(item.querySelector(`#qmax_${domId}`)?.value || 10);
        if (min >= max) {
          helpers.toast(`La escala de "${text}" debe tener un maximo mayor al minimo.`, 'warning');
          return null;
        }
        question.min = min;
        question.max = max;
      }

      questions.push(question);
    }

    const isPublic = document.getElementById('enc-public').checked;
    let audience = [];
    if (isPublic) audience = ['todos'];
    else {
      document.querySelectorAll('#enc-audience-chips input:checked').forEach((input) => audience.push(input.value));
      if (!audience.length) audience = ['estudiantes'];
    }

    const mandatoryMode = document.getElementById('enc-mandatory-mode').value || 'optional';
    const showInStories = document.getElementById('enc-show-stories').checked;
    const schedulingType = document.querySelector('input[name="enc-sched"]:checked')?.value || 'manual';
    const scheduling = { type: schedulingType };

    if (schedulingType === 'timed') {
      const startValue = document.getElementById('enc-start').value;
      const endValue = document.getElementById('enc-end').value;
      scheduling.startDate = startValue ? new Date(startValue) : null;
      scheduling.endDate = endValue ? new Date(endValue) : null;
      if (scheduling.startDate && scheduling.endDate && scheduling.endDate <= scheduling.startDate) {
        helpers.toast('La fecha final debe ser posterior al inicio.', 'warning');
        return null;
      }
    }

    return {
      title,
      description,
      questions,
      audience,
      isPublic,
      scheduling,
      delivery: {
        mandatoryMode,
        blocking: mandatoryMode === 'blocking',
        showInStories
      }
    };
  }

  function collectServiceSurveyEditorData(modal) {
    const { helpers } = getShared();
    if (!modal) return null;

    const title = modal.querySelector('#svc-title')?.value.trim();
    const description = modal.querySelector('#svc-desc')?.value.trim() || '';
    if (!title) {
      helpers.toast('Ingresa un titulo para la encuesta de servicio.', 'warning');
      return null;
    }

    const questions = [];
    const items = modal.querySelectorAll('.q-builder-item');
    for (const item of items) {
      const domId = item.dataset.qid;
      const text = item.querySelector(`#qt_${domId}`)?.value.trim();
      const type = item.querySelector(`#qtype_${domId}`)?.value || 'open';
      if (!text) continue;

      const question = {
        id: `q${questions.length}`,
        type,
        text,
        required: item.querySelector(`#qreq_${domId}`)?.checked ?? true
      };
      if (helpers.questionUsesOptions(type)) {
        const options = [...item.querySelectorAll(`#qopts_${domId} .option-list input.form-control`)].map((input) => input.value.trim()).filter(Boolean);
        if (options.length < 2) {
          helpers.toast(`La pregunta "${text}" necesita al menos dos opciones.`, 'warning');
          return null;
        }
        question.options = options;
      }

      if (type === 'scale') {
        question.min = Number(item.querySelector(`#qmin_${domId}`)?.value || 1);
        question.max = Number(item.querySelector(`#qmax_${domId}`)?.value || 10);
        if (question.min >= question.max) {
          helpers.toast(`La escala de "${text}" debe tener un maximo mayor al minimo.`, 'warning');
          return null;
        }
      }

      questions.push(question);
    }

    if (!questions.length) {
      helpers.toast('Agrega al menos una pregunta.', 'warning');
      return null;
    }

    const frequency = modal.querySelector('input[name="svc-freq"]:checked')?.value || 'per-use';
    return {
      title,
      description,
      questions,
      enabled: modal.querySelector('#svc-enabled')?.checked ?? true,
      config: {
        frequency,
        customDays: frequency === 'custom' ? Number(modal.querySelector('#svc-custom-days')?.value || 7) : null,
        showToAll: modal.querySelector('#svc-show-to-all')?.checked ?? false,
        maxSkips: Number(modal.querySelector('#svc-max-skips')?.value || 2)
      }
    };
  }

  function addQuestion() {
    addQuestionToBuilder('enc-questions-builder');
  }

  function addQuestionToBuilder(containerId, data = null) {
    const { state, constants } = getShared();
    const builder = document.getElementById(containerId);
    if (!builder) return;
    const normalizedData = data || {};

    state.questionCounter += 1;
    const domId = `q_${state.questionCounter}`;
    const defaultType = normalizedData.type || (containerId === 'svc-questions-builder' ? 'scale' : 'multiple');
    const required = normalizedData.required !== false;
    const card = document.createElement('div');
    card.className = 'card border-0 bg-light-subtle rounded-4 q-builder-item';
    card.dataset.qid = domId;
    card.innerHTML = `
      <div class="card-body p-3">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="badge bg-primary-subtle text-primary rounded-pill">Pregunta</span>
          <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="this.closest('.q-builder-item').remove()" style="width:34px;height:34px;padding:0;"><i class="bi bi-trash"></i></button>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-semibold">Texto de la pregunta</label>
          <input id="qt_${domId}" class="form-control rounded-4" placeholder="Ej. Como calificas el servicio?" value="${getShared().helpers.esc(normalizedData.text || '')}">
        </div>
        <div class="row g-3 align-items-start">
          <div class="col-md-7">
            <label class="form-label small fw-semibold">Tipo</label>
            <select id="qtype_${domId}" class="form-select rounded-4" onchange="Encuestas.onTypeChange('${domId}')">
              ${constants.QUESTION_TYPES.map((type) => `<option value="${type.id}" ${type.id === defaultType ? 'selected' : ''}>${type.label}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-5">
            <label class="form-label small fw-semibold">Obligatoria</label>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="qreq_${domId}" ${required ? 'checked' : ''}>
              <label class="form-check-label" for="qreq_${domId}">Si</label>
            </div>
          </div>
        </div>
        <div id="qopts_${domId}" class="mt-3">${renderQuestionOptions(domId, defaultType, normalizedData)}</div>
      </div>`;
    builder.appendChild(card);
  }

  function renderQuestionOptions(domId, type, data = {}) {
    const { helpers } = getShared();
    data = data || {};
    if (helpers.questionUsesOptions(type)) {
      const options = (data.options || ['', '']).length >= 2 ? (data.options || ['', '']) : ['', ''];
      const typeHelp = {
        multiple: 'El usuario podra elegir una sola opcion.',
        checkboxes: 'El usuario podra seleccionar varias opciones al mismo tiempo.',
        select: 'Las opciones se mostraran dentro de un menu desplegable.'
      };
      return `
        <label class="form-label small fw-semibold">Opciones</label>
        <div class="option-list d-grid gap-2">
          ${options.map((option) => `<div class="input-group"><input class="form-control rounded-start-4" value="${helpers.esc(option || '')}" placeholder="Texto de la opcion"><button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()"><i class="bi bi-x-lg"></i></button></div>`).join('')}
        </div>
        <div class="small text-muted mt-2">${typeHelp[type] || ''}</div>
        <button type="button" class="btn btn-sm btn-outline-primary rounded-pill mt-2" onclick="Encuestas.addOption('${domId}')"><i class="bi bi-plus-lg me-1"></i>Agregar opcion</button>`;
    }

    if (type === 'scale') {
      return `
        <label class="form-label small fw-semibold">Rango</label>
        <div class="row g-2">
          <div class="col-6"><input type="number" id="qmin_${domId}" class="form-control rounded-4" value="${Number(data.min || 1)}" min="0"><div class="small text-muted mt-1">Minimo</div></div>
          <div class="col-6"><input type="number" id="qmax_${domId}" class="form-control rounded-4" value="${Number(data.max || 10)}" min="1"><div class="small text-muted mt-1">Maximo</div></div>
        </div>`;
    }

    if (type === 'boolean') return '<div class="small text-muted">Se mostraran dos opciones fijas: Si / No.</div>';
    if (type === 'date') return '<div class="small text-muted">La respuesta se capturara como una fecha en formato calendario.</div>';
    return '<div class="small text-muted">La respuesta se capturara como texto libre.</div>';
  }

  function onTypeChange(domId) {
    const type = document.getElementById(`qtype_${domId}`)?.value || 'open';
    const target = document.getElementById(`qopts_${domId}`);
    if (!target) return;
    target.innerHTML = renderQuestionOptions(domId, type, {});
  }

  function addOption(domId) {
    const target = document.querySelector(`#qopts_${domId} .option-list`);
    if (!target) return;
    const row = document.createElement('div');
    row.className = 'input-group';
    row.innerHTML = '<input class="form-control rounded-start-4" placeholder="Nueva opcion"><button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()"><i class="bi bi-x-lg"></i></button>';
    target.appendChild(row);
  }

  function toggleAllAudience(input) {
    const otherInputs = [...document.querySelectorAll('#enc-audience-chips input:not(#aud-all)')];
    if (input.checked) {
      otherInputs.forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = true;
      });
      return;
    }

    otherInputs.forEach((checkbox) => { checkbox.disabled = false; });
    if (!otherInputs.some((checkbox) => checkbox.checked)) {
      document.getElementById('aud-est').checked = true;
    }
  }

  function togglePublicMode(input) {
    const all = document.getElementById('aud-all');
    const others = [...document.querySelectorAll('#enc-audience-chips input:not(#aud-all)')];
    if (input.checked) {
      if (all) {
        all.checked = true;
        toggleAllAudience(all);
        all.disabled = true;
      }
      return;
    }

    if (all) {
      all.disabled = false;
      all.checked = false;
    }
    others.forEach((checkbox) => { checkbox.disabled = false; });
    if (!others.some((checkbox) => checkbox.checked)) {
      document.getElementById('aud-est').checked = true;
    }
  }

  function renderQuestionsHTML(questions, prefix = 'q', options = {}) {
    const { helpers } = getShared();
    return (questions || []).map((question, index) => {
      const visualIndex = Number(options.startIndex || 0) + index + 1;
      let input = '';
      if (question.type === 'multiple') {
        input = (question.options || []).map((option, optionIndex) => `
          <label class="enc-choice mb-2">
            <input class="enc-choice__input" type="radio" name="${prefix}_${question.id}" id="${prefix}_${question.id}_${optionIndex}" value="${helpers.esc(option)}">
            <span class="enc-choice__surface">
              <span class="enc-choice__check"><i class="bi bi-check2"></i></span>
              <span class="enc-choice__copy">${helpers.esc(option)}</span>
            </span>
          </label>`).join('');
      } else if (question.type === 'checkboxes') {
        input = `<div class="enc-binary-grid">${(question.options || []).map((option, optionIndex) => `
          <label class="enc-choice">
            <input class="enc-choice__input" type="checkbox" name="${prefix}_${question.id}" id="${prefix}_${question.id}_${optionIndex}" value="${helpers.esc(option)}">
            <span class="enc-choice__surface">
              <span class="enc-choice__check"><i class="bi bi-check2-square"></i></span>
              <span class="enc-choice__copy">${helpers.esc(option)}</span>
            </span>
          </label>`).join('')}</div><div class="small text-muted mt-2">Puedes seleccionar varias opciones.</div>`;
      } else if (question.type === 'select') {
        input = `<select id="${prefix}_${question.id}_input" class="form-select rounded-4"><option value="">Selecciona una opcion</option>${(question.options || []).map((option) => `<option value="${helpers.esc(option)}">${helpers.esc(option)}</option>`).join('')}</select>`;
      } else if (question.type === 'boolean') {
        input = `<div class="enc-binary-grid"><label class="enc-choice enc-choice--binary"><input type="radio" class="enc-choice__input" name="${prefix}_${question.id}" id="${prefix}_${question.id}_yes" value="true" autocomplete="off"><span class="enc-choice__surface"><span class="enc-choice__check"><i class="bi bi-hand-thumbs-up-fill"></i></span><span class="enc-choice__copy">Si</span></span></label><label class="enc-choice enc-choice--binary"><input type="radio" class="enc-choice__input" name="${prefix}_${question.id}" id="${prefix}_${question.id}_no" value="false" autocomplete="off"><span class="enc-choice__surface"><span class="enc-choice__check"><i class="bi bi-hand-thumbs-down-fill"></i></span><span class="enc-choice__copy">No</span></span></label></div>`;
      } else if (question.type === 'scale') {
        const min = Number(question.min || 1);
        const max = Number(question.max || 10);
        input = `<input type="hidden" id="${prefix}_${question.id}_input" value=""><div class="enc-scale-grid mb-2">${Array.from({ length: max - min + 1 }, (_, offset) => { const value = min + offset; return `<button type="button" class="btn enc-scale-btn" data-val="${value}" onclick="Encuestas.pickScaleValue(this,'${prefix}','${question.id}',${value})">${value}</button>`; }).join('')}</div><div class="enc-scale-meta"><span>${min} = menor valor</span><strong id="${prefix}_${question.id}_val">Sin seleccionar</strong><span>${max} = mayor valor</span></div>`;
      } else if (question.type === 'date') {
        input = `<input type="date" id="${prefix}_${question.id}_input" class="form-control rounded-4">`;
      } else {
        input = `<textarea id="${prefix}_${question.id}_input" class="form-control rounded-4 enc-open-answer" rows="4" placeholder="Escribe tu respuesta"></textarea>`;
      }

      return `<section class="enc-question-card enc-question-card--${helpers.esc(question.type)} animate-fade-in-up"><div class="enc-question-card__head"><div class="enc-question-card__index">${visualIndex}</div><div class="flex-grow-1"><div class="enc-question-card__title">${helpers.esc(question.text)}</div><div class="enc-question-card__hint ${question.required ? 'is-required' : ''}">${question.required ? 'Respuesta obligatoria' : 'Respuesta opcional'}</div></div></div><div class="enc-question-card__body">${input}</div></section>`;
    }).join('');
  }

  function pickScaleValue(button, prefix, questionId, value) {
    const group = button.parentElement;
    group.querySelectorAll('.enc-scale-btn').forEach((item) => {
      item.classList.remove('is-active');
    });
    button.classList.add('is-active');
    const input = document.getElementById(`${prefix}_${questionId}_input`);
    if (input) input.value = String(value);
    const label = document.getElementById(`${prefix}_${questionId}_val`);
    if (label) label.textContent = String(value);
  }

  function collectAnswers(questions, containerId, paginator = null) {
    const { helpers } = getShared();
    if (paginator) {
      paginator.saveCurrentPage();
      const answers = { ...(paginator.answers || {}) };
      const invalid = (questions || []).find((question) => {
        if (!question.required) return false;
        return helpers.isAnswerEmpty(answers[question.id]);
      });
      if (invalid) {
        if (typeof paginator.goToQuestion === 'function') paginator.goToQuestion(invalid.id);
        helpers.toast('Responde todas las preguntas obligatorias antes de enviar.', 'warning');
        return null;
      }
      return answers;
    }

    const container = document.getElementById(containerId);
    if (!container) return null;

    const answers = {};
    let invalid = false;
    (questions || []).forEach((question) => {
      const value = helpers.collectQuestionAnswer(question, container, containerId);
      if (helpers.isAnswerEmpty(value)) {
        if (question.required) invalid = true;
        return;
      }
      answers[question.id] = value;
    });

    if (invalid) {
      helpers.toast('Responde todas las preguntas obligatorias.', 'warning');
      return null;
    }
    return answers;
  }

  function initSurveyPagination(questions, containerId, paginationId, submitBtnId, modalInstance, options = {}) {
    const { helpers } = getShared();
    const sections = helpers.buildSurveySections(questions);
    const totalPages = Math.max(1, sections.length);
    let currentPage = 1;
    const answers = { ...(options.initialAnswers || {}) };

    function currentPrefix(page) {
      return `pag_${containerId}_${page}`;
    }

    function currentSection() {
      return sections[currentPage - 1] || sections[0];
    }

    function saveCurrentPage() {
      const container = document.getElementById(containerId);
      if (!container) return;
      const pageQuestions = currentSection().questions;
      const prefix = currentPrefix(currentPage);

      pageQuestions.forEach((question) => {
        const value = helpers.collectQuestionAnswer(question, container, prefix);
        if (!helpers.isAnswerEmpty(value)) answers[question.id] = value;
        else if (!options.readOnly) delete answers[question.id];
      });

      if (typeof options.onProgress === 'function') {
        options.onProgress({ ...answers }, currentPage, totalPages);
      }
    }

    function restoreCurrentPage() {
      const container = document.getElementById(containerId);
      if (!container) return;
      const pageQuestions = currentSection().questions;
      const prefix = currentPrefix(currentPage);

      pageQuestions.forEach((question) => {
        helpers.restoreQuestionAnswer(question, container, prefix, answers[question.id]);
      });

      if (options.readOnly) {
        container.querySelectorAll('input, textarea, button, select').forEach((element) => {
          element.disabled = true;
        });
      }
    }

    function updateProgress() {
      const answered = helpers.countAnsweredQuestions(questions, answers);
      const percent = questions.length ? Math.max(8, Math.round((answered / questions.length) * 100)) : 100;
      const progressFill = document.getElementById(options.progressFillId);
      const sectionMeta = document.getElementById(options.sectionMetaId);
      const sectionHint = document.getElementById(options.sectionHintId);
      const answerCount = document.getElementById(options.answerCountId);
      const section = currentSection();

      if (progressFill) progressFill.style.width = `${percent}%`;
      if (sectionMeta) sectionMeta.textContent = `${section.title} de ${totalPages}`;
      if (sectionHint) sectionHint.textContent = section.subtitle;
      if (answerCount) answerCount.textContent = `${answered}/${questions.length} respondidas`;
    }

    function renderControls() {
      const pagination = document.getElementById(paginationId);
      if (!pagination) return;
      const submitBtn = document.getElementById(submitBtnId);
      const isFirst = currentPage === 1;
      const isLast = currentPage === totalPages;

      pagination.innerHTML = `<div class="enc-student-nav__cluster"><button type="button" class="btn btn-outline-secondary rounded-pill" ${isFirst ? 'disabled' : ''} onclick="window._activeSurveyPaginator.renderPage(${currentPage - 1})"><i class="bi bi-arrow-left me-1"></i>Anterior</button><button type="button" class="btn btn-outline-primary rounded-pill" ${isLast ? 'disabled' : ''} onclick="window._activeSurveyPaginator.renderPage(${currentPage + 1})">Siguiente<i class="bi bi-arrow-right ms-1"></i></button></div><div class="enc-student-nav__status"><span class="enc-student-nav__counter">Pregunta ${currentPage} de ${totalPages}</span></div>`;
      if (submitBtn) {
        if (isLast && !options.readOnly) submitBtn.classList.remove('d-none');
        else submitBtn.classList.add('d-none');
      }
      updateProgress();
    }

    const paginator = {
      answers,
      saveCurrentPage,
      goToQuestion(questionId) {
        const pageIndex = sections.findIndex((section) => section.questionIds.includes(questionId));
        if (pageIndex >= 0) this.renderPage(pageIndex + 1);
      },
      renderPage(page) {
        saveCurrentPage();
        currentPage = Math.min(Math.max(page, 1), totalPages);
        const section = currentSection();
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = renderQuestionsHTML(section.questions, currentPrefix(currentPage), {
          startIndex: Math.max(0, section.from - 1)
        });
        restoreCurrentPage();
        renderControls();
      }
    };

    modalInstance._paginator = paginator;
    window._activeSurveyPaginator = paginator;
    paginator.renderPage(1);
    return paginator;
  }

  return {
    getBuilderSurveyContext,
    resetBuilder,
    applyBuilderSnapshot,
    collectSurveyBuilderData,
    collectServiceSurveyEditorData,
    addQuestion,
    addQuestionToBuilder,
    renderQuestionOptions,
    onTypeChange,
    addOption,
    toggleAllAudience,
    togglePublicMode,
    renderQuestionsHTML,
    pickScaleValue,
    collectAnswers,
    initSurveyPagination
  };
})();
