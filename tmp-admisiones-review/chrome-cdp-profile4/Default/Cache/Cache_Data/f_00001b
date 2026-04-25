// modules/encuestas/encuestas-responses.js
// Response flows: public surveys, student answering and analytics exports.

if (!window.Encuestas) window.Encuestas = {};

window.Encuestas.Responses = (function () {
  function getShared() {
    const shared = window.Encuestas?.__getShared?.();
    if (!shared) throw new Error('[Encuestas.Responses] Shared bridge unavailable.');
    return shared;
  }

  async function initPublic(surveyId) {
    const { helpers, modules } = getShared();
    const container = document.getElementById('view-encuesta-publica');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-primary"></span></div>';
    try {
      const db = helpers.getPublicDb();
      const survey = await window.EncuestasService.getSurveyByIdPublic(db, surveyId);
      if (!survey) {
        container.innerHTML = modules.UI.renderPublicState('Encuesta no disponible', 'Esta encuesta no existe, no es publica o ya fue cerrada.', 'bi-exclamation-triangle-fill', 'warning');
        return;
      }

      const spamKey = `sia_enc_pub_${surveyId}`;
      if (localStorage.getItem(spamKey)) {
        container.innerHTML = modules.UI.renderPublicState('Ya participaste', 'Gracias por responder esta encuesta publica.', 'bi-check-circle-fill', 'success');
        return;
      }

      container.innerHTML = `
        <div class="container py-4" style="max-width:760px;">
          <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div class="p-4 p-lg-5 bg-info bg-opacity-10 border-bottom">
              <span class="badge bg-info-subtle text-info rounded-pill mb-2">Encuesta publica</span>
              <h2 class="fw-bold mb-2">${helpers.esc(survey.title)}</h2>
              <p class="text-muted mb-0">${helpers.esc(survey.description || 'Comparte tu opinion en pocos minutos.')}</p>
            </div>
            <div class="p-4 p-lg-5">
              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="form-label fw-semibold small">Nombre (opcional)</label>
                  <input id="pub-name" class="form-control rounded-3" placeholder="Tu nombre">
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold small">Correo (opcional)</label>
                  <input id="pub-email" class="form-control rounded-3" placeholder="correo@ejemplo.com">
                </div>
              </div>
              <div id="pub-questions"></div>
              <div class="d-flex justify-content-end mt-4">
                <button class="btn btn-primary rounded-pill px-5 fw-bold" id="pub-submit-btn" onclick="Encuestas.submitPublicSurvey('${survey.id}','${spamKey}')">
                  <i class="bi bi-send-fill me-2"></i>Enviar respuestas
                </button>
              </div>
            </div>
          </div>
        </div>`;
      document.getElementById('pub-questions').innerHTML = modules.Forms.renderQuestionsHTML(survey.questions, 'pub');
    } catch (error) {
      container.innerHTML = modules.UI.renderPublicState('No se pudo cargar', 'Ocurrio un problema al abrir la encuesta publica.', 'bi-x-octagon-fill', 'danger');
    }
  }

  async function submitPublicSurvey(surveyId, spamKey) {
    const { helpers, modules } = getShared();
    const btn = document.getElementById('pub-submit-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

    try {
      const db = helpers.getPublicDb();
      const survey = await window.EncuestasService.getSurveyByIdPublic(db, surveyId);
      if (!survey) throw new Error('Encuesta no disponible');
      const answers = modules.Forms.collectAnswers(survey.questions, 'pub-questions');
      if (!answers) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Enviar respuestas';
        return;
      }

      await window.EncuestasService.submitPublicResponse(db, surveyId, answers, {
        name: document.getElementById('pub-name')?.value?.trim() || '',
        email: document.getElementById('pub-email')?.value?.trim() || '',
        source: 'public_link'
      });
      localStorage.setItem(spamKey, '1');
      document.getElementById('view-encuesta-publica').innerHTML = modules.UI.renderPublicState('Gracias por participar', 'Tu respuesta ha sido registrada correctamente.', 'bi-check-circle-fill', 'success');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo enviar la encuesta', 'danger');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Enviar respuestas';
    }
  }

  async function loadResults() {
    const { state, modules, helpers } = getShared();
    const surveyId = document.getElementById('enc-result-select')?.value || state.selectedResultsSurveyId;
    const container = document.getElementById('enc-results-container');
    if (!surveyId || !container) {
      if (container) container.innerHTML = '';
      return;
    }

    state.selectedResultsSurveyId = surveyId;
    container.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
    try {
      const [survey, stats, responses] = await Promise.all([
        window.EncuestasService.getSurveyById(state.ctx, surveyId),
        window.EncuestasService.getSurveyStats(state.ctx, surveyId),
        window.EncuestasService.getResponses(state.ctx, surveyId)
      ]);
      modules.UI.renderResultsPanel(container, survey, stats, responses);
    } catch (error) {
      container.innerHTML = '<div class="alert alert-danger rounded-4">No se pudieron cargar los resultados.</div>';
    }
  }

  function viewResponse(answers, surveyId) {
    const { state, helpers } = getShared();
    const survey = state.surveys.find((item) => item.id === surveyId);
    if (!survey) return;

    let parsedAnswers = answers;
    if (typeof answers === 'string') {
      try {
        parsedAnswers = JSON.parse(decodeURIComponent(answers));
      } catch (error) {
        parsedAnswers = {};
      }
    }

    const rows = (survey.questions || []).map((question) => {
      const answer = parsedAnswers?.[question.id];
      return `<div class="mb-3"><div class="fw-semibold small">${helpers.esc(question.text)}</div><div class="text-muted">${helpers.esc(!helpers.isAnswerEmpty(answer) ? helpers.formatAnswerValue(answer) : '-')}</div></div>`;
    }).join('');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg"><div class="modal-header border-0"><h6 class="fw-bold mb-0">Respuesta individual</h6><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body p-4">${rows}</div></div></div></div>`;
    document.body.appendChild(wrapper);
    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
  }

  async function exportCSV(surveyId) {
    const { state, helpers } = getShared();
    const survey = state.surveys.find((item) => item.id === surveyId) || await window.EncuestasService.getSurveyById(state.ctx, surveyId);
    const responses = await window.EncuestasService.getResponses(state.ctx, surveyId);
    const headers = ['Nombre', 'Email', 'Carrera', 'Rol', 'Fuente', 'Fecha', ...survey.questions.map((question) => question.text)];
    const rows = responses.map((response) => [response.userName || '', response.userEmail || '', response.userCareer || '', response.userRole || '', response.source || '', helpers.fmtDate(response.submittedAt), ...survey.questions.map((question) => helpers.formatAnswerValue(response.answers?.[question.id]))]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `encuesta_${(survey.title || 'export').replace(/\s+/g, '_')}.csv`;
    link.click();
  }

  async function resolveStudentSurveyState(ctx, surveyId, fallbackSurvey = null) {
    const baseSurvey = fallbackSurvey || await window.EncuestasService.getSurveyById(ctx, surveyId);
    if (!baseSurvey) return null;

    if (!ctx?.user) {
      return {
        ...baseSurvey,
        responded: !!baseSurvey.responded,
        response: baseSurvey.response || null
      };
    }

    try {
      const responseMap = await window.EncuestasService.getResponseStateMap(ctx, [surveyId]);
      const response = responseMap[surveyId] || baseSurvey.response || null;
      return {
        ...baseSurvey,
        responded: !!response,
        response
      };
    } catch (error) {
      console.warn('[Encuestas] No se pudo refrescar el estado de la respuesta:', error);
      return {
        ...baseSurvey,
        responded: !!baseSurvey.responded,
        response: baseSurvey.response || null
      };
    }
  }

  async function openStudentSurvey(surveyId, options = {}) {
    const { state, helpers, modules } = getShared();
    const ctx = helpers.getCurrentCtx(options.ctx);
    const feedSurvey = state.studentFeed?.all?.find((item) => item.id === surveyId) || null;
    const survey = await resolveStudentSurveyState(ctx, surveyId, options.survey || feedSurvey);
    if (!survey) {
      helpers.toast('Encuesta no encontrada.', 'warning');
      return false;
    }

    if (survey.responded) {
      helpers.clearDraftAnswers(surveyId);
      if (feedSurvey && !feedSurvey.responded) {
        try {
          state.studentFeed = await window.EncuestasService.getStudentSurveyFeed(ctx);
          modules.UI.renderStudentFeed();
        } catch (error) {
          console.warn('[Encuestas] No se pudo sincronizar el feed del estudiante:', error);
        }
      }
    }

    const modalId = options.modalId || 'modalStudentSurvey';
    document.getElementById(modalId)?.remove();
    const lockModal = (!!options.lockModal || !!survey.blocking) && !survey.responded;
    const initialAnswers = survey.responded ? (survey.response?.answers || {}) : helpers.loadDraftAnswers(surveyId);
    const hasDraft = !!Object.keys(initialAnswers || {}).length;
    const reminderState = helpers.getReminderState(surveyId);
    const canRemindLater = !lockModal && !survey.responded && reminderState.used < reminderState.max;
    const startLabel = survey.responded ? 'Abrir resumen' : (hasDraft ? 'Continuar encuesta' : (lockModal ? 'Responder ahora' : 'Iniciar encuesta'));
    const introId = `${modalId}-intro`;
    const stageId = `${modalId}-stage`;
    const footerId = `${modalId}-footer`;
    const containerId = `${modalId}-questions`;
    const paginationId = `${modalId}-pagination`;
    const submitBtnId = `${modalId}-submit`;
    const progressFillId = `${modalId}-progress-fill`;
    const sectionMetaId = `${modalId}-section-meta`;
    const sectionHintId = `${modalId}-section-hint`;
    const answerCountId = `${modalId}-answer-count`;
    const wrapper = document.createElement('div');
    wrapper.id = modalId;
    wrapper.innerHTML = `
      <div class="modal fade enc-student-sheet" tabindex="-1" ${lockModal ? 'data-bs-backdrop="static" data-bs-keyboard="false"' : ''}>
        <div class="modal-dialog modal-dialog-centered enc-student-dialog">
          <div class="modal-content border-0 shadow-lg overflow-hidden enc-student-modal enc-student-modal--minimal ${lockModal ? 'is-blocking' : ''}">
            <div class="modal-header border-0 enc-student-modal__header">
              <div class="enc-student-header-copy">
                <div class="enc-student-modal__eyebrow">Encuesta</div>
                <h5 class="fw-bold mb-0">${helpers.esc(survey.title)}</h5>
              </div>
              ${lockModal ? '' : '<button class="btn-close enc-student-modal__close" data-bs-dismiss="modal" aria-label="Cerrar encuesta"></button>'}
            </div>
            <div class="modal-body enc-student-modal__body">
              <div id="${introId}" class="enc-survey-intro">
                <div class="d-flex flex-wrap gap-2 mb-3">
                  <span class="badge rounded-pill ${lockModal ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}">${lockModal ? 'Debes responder para seguir' : (survey.isMandatory ? 'Respuesta requerida' : 'Encuesta opcional')}</span>
                  ${hasDraft && !survey.responded ? '<span class="badge bg-info-subtle text-info rounded-pill">Borrador disponible</span>' : ''}
                </div>
                <p class="text-muted mb-3">${helpers.esc(survey.description || 'Responde esta encuesta en pocos minutos.')}</p>
                <div class="enc-survey-intro__stats">
                  <article class="enc-survey-intro__stat"><span>Preguntas</span><strong>${(survey.questions || []).length}</strong></article>
                  <article class="enc-survey-intro__stat"><span>Estado</span><strong>${helpers.esc(survey.responded ? 'Respondida' : (hasDraft ? 'En progreso' : 'Pendiente'))}</strong></article>
                </div>
                ${lockModal ? '<div class="enc-student-alert mt-3"><i class="bi bi-shield-lock-fill me-2"></i>Necesitas completarla para seguir usando la app. Este tipo de encuesta bloquea acceso mientras siga pendiente.</div>' : ''}
                <div class="enc-survey-intro__actions">
                  <button type="button" class="btn btn-primary rounded-pill fw-semibold" onclick="Encuestas.startStudentSurvey('${modalId}')">${startLabel}</button>
                  ${survey.responded ? '' : `<button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold" onclick="Encuestas.remindStudentSurveyLater('${modalId}')" ${canRemindLater ? '' : 'disabled'}>${lockModal ? 'Recordatorio no disponible' : `Recordar mas tarde (${reminderState.used}/${reminderState.max})`}</button>`}
                </div>
              </div>
              <div id="${stageId}" class="d-none">
                <div class="enc-student-progress">
                  <div class="enc-student-progress__meta">
                    <span id="${sectionMetaId}" class="fw-semibold">Pregunta 1</span>
                    <span id="${answerCountId}" class="text-muted">0/${(survey.questions || []).length} respondidas</span>
                  </div>
                  <div class="enc-student-progress__track"><span id="${progressFillId}" class="enc-student-progress__fill"></span></div>
                  <div id="${sectionHintId}" class="enc-student-progress__hint">Responde una pregunta por vez.</div>
                </div>
                <div id="${containerId}" class="enc-student-stage mt-3"></div>
              </div>
            </div>
            <div class="modal-footer border-0 enc-student-modal__footer d-none" id="${footerId}">
              <div id="${paginationId}" class="enc-student-modal__nav"></div>
              <div class="enc-student-modal__actions">
                <div class="d-flex gap-2 flex-wrap">
                  ${lockModal ? '' : '<button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cerrar</button>'}
                  ${survey.responded ? '' : `<button type="button" class="btn btn-outline-secondary rounded-pill" id="${modalId}-draft" onclick="Encuestas.saveStudentDraft('${surveyId}')"><i class="bi bi-save me-1"></i>Guardar borrador</button>`}
                </div>
                ${survey.responded ? '' : `<button type="button" class="btn ${lockModal ? 'btn-danger' : 'btn-success'} rounded-pill px-5 fw-bold d-none" id="${submitBtnId}" onclick="Encuestas.submitStudentSurvey('${surveyId}')"><i class="bi bi-send-fill me-2"></i>Finalizar</button>`}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper);

    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    wrapper._survey = survey;
    wrapper._source = options.source || 'module';
    wrapper._lockModal = lockModal;
    wrapper._containerId = containerId;
    wrapper._submitBtnId = submitBtnId;
    wrapper._onComplete = options.onComplete || null;
    wrapper._ctx = ctx;
    wrapper._introId = introId;
    wrapper._stageId = stageId;
    wrapper._footerId = footerId;
    wrapper._resumePage = helpers.getResumePage(survey.questions || [], initialAnswers || {});
    window._activeStudentSurveyModal = wrapper;

    modules.Forms.initSurveyPagination(survey.questions, containerId, paginationId, submitBtnId, wrapper, {
      initialAnswers,
      readOnly: !!survey.responded,
      onProgress: (answers) => {
        if (!survey.responded) helpers.saveDraftAnswers(surveyId, answers);
      },
      progressFillId,
      sectionMetaId,
      sectionHintId,
      answerCountId
    });

    modal.show();
    if (options.autoStart) startStudentSurvey(modalId, { force: true });
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (!survey.responded && wrapper._paginator) {
        wrapper._paginator.saveCurrentPage();
        helpers.saveDraftAnswers(surveyId, wrapper._paginator.answers);
      }
      if (window._activeStudentSurveyModal === wrapper) {
        window._activeStudentSurveyModal = null;
      }
      wrapper.remove();
    });

    return true;
  }

  function startStudentSurvey(modalId, options = {}) {
    const modal = document.getElementById(modalId) || window._activeStudentSurveyModal;
    if (!modal) return;
    const intro = document.getElementById(modal._introId);
    const stage = document.getElementById(modal._stageId);
    const footer = document.getElementById(modal._footerId);
    if (intro) intro.classList.add('d-none');
    if (stage) stage.classList.remove('d-none');
    if (footer) footer.classList.remove('d-none');
    modal._paginator?.renderPage(options.page || modal._resumePage || 1);
  }

  function remindStudentSurveyLater(modalId) {
    const { helpers } = getShared();
    const modal = document.getElementById(modalId) || window._activeStudentSurveyModal;
    if (!modal?._survey || modal._lockModal || modal._survey.responded) return;
    const state = helpers.useReminder(modal._survey.id);
    bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
    helpers.toast(`Te la recordaremos despues. Uso ${state.used}/${state.max}.`, 'info');
  }

  function saveStudentDraft(surveyId) {
    const { helpers } = getShared();
    const modal = window._activeStudentSurveyModal;
    if (!modal?._paginator) return;
    modal._paginator.saveCurrentPage();
    helpers.saveDraftAnswers(surveyId, modal._paginator.answers);
    helpers.toast('Borrador guardado.', 'success');
  }

  async function submitStudentSurvey(surveyId, meta = {}) {
    const { state, helpers, modules } = getShared();
    const modal = meta.modal || window._activeStudentSurveyModal;
    const survey = modal?._survey;
    if (!survey) return;

    const answers = modules.Forms.collectAnswers(survey.questions, modal._containerId, modal._paginator);
    if (!answers) return;

    const btn = document.getElementById(modal._submitBtnId);
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

    try {
      await window.EncuestasService.submitResponse(modal._ctx || state.ctx, surveyId, answers, {
        source: meta.source || modal._source || 'module'
      });
      helpers.clearDraftAnswers(surveyId);
      state.studentFeed = await window.EncuestasService.getStudentSurveyFeed(modal._ctx || state.ctx);

      const body = modal.querySelector('.modal-body');
      if (body) {
        body.innerHTML = `<div class="text-center py-5 animate-fade-in"><i class="bi bi-check-circle-fill text-success fs-1 d-block mb-3"></i><h4 class="fw-bold mb-2">Gracias por responder</h4><p class="text-muted mb-0">Tus respuestas se registraron correctamente.</p></div>`;
      }
      const footer = modal.querySelector('.modal-footer');
      if (footer) {
        footer.innerHTML = '<div class="w-100 text-center"><button type="button" class="btn btn-primary rounded-pill px-5" data-bs-dismiss="modal">Cerrar</button></div>';
      }
      modules.UI.renderStudentFeed();
      helpers.toast('Encuesta enviada correctamente.', 'success');
      if (typeof modal._onComplete === 'function') {
        try { modal._onComplete(); } catch (error) { console.warn(error); }
      }
      setTimeout(() => bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide(), 1200);
    } catch (error) {
      helpers.toast(error.message || 'No se pudo enviar la encuesta.', 'danger');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Enviar respuestas';
    }
  }

  async function checkAndShowBlockingSurvey(ctxOrNull) {
    const { helpers } = getShared();
    const ctx = helpers.getCurrentCtx(ctxOrNull);
    if (!ctx?.user || helpers.isAdminProfile(ctx.profile)) return false;
    if (document.getElementById('modalStudentBlockingSurvey')) return true;
    if (window.__encuestasBlockingCheckInFlight) return false;

    window.__encuestasBlockingCheckInFlight = true;
    try {
      const survey = await window.EncuestasService.getBlockingSurveyForUser(ctx);
      if (!survey) return false;
      await openStudentSurvey(survey.id, {
        ctx,
        survey,
        lockModal: true,
        source: 'blocking_gate',
        modalId: 'modalStudentBlockingSurvey'
      });
      return true;
    } catch (error) {
      console.error('[Encuestas] Error showing blocking survey:', error);
      return false;
    } finally {
      window.__encuestasBlockingCheckInFlight = false;
    }
  }

  async function checkAndShowLaunchedSurvey(ctxOrNull) {
    const { helpers } = getShared();
    const ctx = helpers.getCurrentCtx(ctxOrNull);
    if (!ctx?.user || helpers.isAdminProfile(ctx.profile)) return false;
    if (document.getElementById('modalStudentLaunchSurvey')) return true;

    try {
      const survey = await window.EncuestasService.getLaunchSurveyForUser(ctx);
      if (!survey) return false;
      await window.EncuestasService.markLaunchSeen(ctx, survey.id, survey.delivery?.launchToken);
      await openStudentSurvey(survey.id, {
        ctx,
        survey,
        lockModal: false,
        source: 'launched_campaign',
        modalId: 'modalStudentLaunchSurvey'
      });
      return true;
    } catch (error) {
      console.error('[Encuestas] Error showing launched survey:', error);
      return false;
    }
  }

  async function viewServiceResults(serviceType) {
    const { state, helpers, modules } = getShared();
    try {
      const [survey, stats, responses] = await Promise.all([
        window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType),
        window.EncuestasServicioService.getServiceSurveyStats(state.ctx, serviceType),
        window.EncuestasServicioService.getServiceSurveyResponses(state.ctx, serviceType)
      ]);
      if (!survey || !stats) {
        helpers.toast('No hay resultados para este servicio.', 'warning');
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg"><div class="modal-header border-0 bg-light"><div><h5 class="fw-bold mb-1">${helpers.esc(survey.title)}</h5><p class="text-muted small mb-0">${helpers.esc(survey.description || 'Resultados de encuesta de servicio')}</p></div><div class="d-flex gap-2"><button class="btn btn-outline-success rounded-pill" onclick="Encuestas.exportServiceCSV('${serviceType}')"><i class="bi bi-download me-1"></i>Exportar CSV</button><button class="btn-close" data-bs-dismiss="modal"></button></div></div><div class="modal-body p-4"><section class="row g-3 mb-4"><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-3 text-center"><div class="small text-muted">Respuestas</div><div class="fw-bold fs-3">${stats.total || 0}</div></div></div></div><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-3 text-center"><div class="small text-muted">Carreras</div><div class="fw-bold fs-3">${Object.keys(stats.byCareers || {}).length}</div></div></div></div><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-3 text-center"><div class="small text-muted">Roles</div><div class="fw-bold fs-3">${Object.keys(stats.byRole || {}).length}</div></div></div></div><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-3 text-center"><div class="small text-muted">Sin uso</div><div class="fw-bold fs-3">${survey.analytics?.notUsedCount || 0}</div></div></div></div></section>${(survey.questions || []).map((question) => modules.UI.renderQuestionResult(question, stats.byQuestion?.[question.id])).join('')}<section class="card border-0 shadow-sm rounded-4 mt-4"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-center mb-3"><h6 class="fw-bold mb-0">Respuestas individuales</h6><span class="small text-muted">Mostrando hasta ${Math.min(responses.length, 50)} registros</span></div><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Nombre</th><th>Rol</th><th>Fecha</th><th>Fuente</th><th></th></tr></thead><tbody>${responses.slice(0, 50).map((response) => `<tr><td>${helpers.esc(response.userName || 'Anonimo')}</td><td>${helpers.esc(response.userRole || '-')}</td><td>${helpers.fmtDate(response.submittedAt)}</td><td>${helpers.esc(response.source || '-')}</td><td><button class="btn btn-sm btn-light rounded-pill" onclick="Encuestas.viewServiceResponse('${encodeURIComponent(JSON.stringify(response.answers || {}))}','${serviceType}')">Ver</button></td></tr>`).join('')}</tbody></table></div></div></section></div></div></div></div>`;
      document.body.appendChild(wrapper);
      const modalEl = wrapper.querySelector('.modal');
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
    } catch (error) {
      helpers.toast(error.message || 'No se pudieron cargar los resultados.', 'danger');
    }
  }

  async function viewServiceResponse(serializedAnswers, serviceType) {
    const { state, helpers } = getShared();
    const survey = await window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType);
    if (!survey) return;
    let answers = {};
    try {
      answers = typeof serializedAnswers === 'string' ? JSON.parse(decodeURIComponent(serializedAnswers)) : (serializedAnswers || {});
    } catch (error) {
      answers = {};
    }

    const rows = (survey.questions || []).map((question) => {
      const answer = answers?.[question.id];
      return `<div class="mb-3"><div class="fw-semibold small">${helpers.esc(question.text)}</div><div class="text-muted">${helpers.esc(!helpers.isAnswerEmpty(answer) ? helpers.formatAnswerValue(answer) : '-')}</div></div>`;
    }).join('');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg"><div class="modal-header border-0"><h6 class="fw-bold mb-0">Respuesta individual</h6><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body p-4">${rows}</div></div></div></div>`;
    document.body.appendChild(wrapper);
    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
  }

  async function exportServiceCSV(serviceType) {
    const { state, helpers } = getShared();
    const [survey, responses] = await Promise.all([
      window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType),
      window.EncuestasServicioService.getServiceSurveyResponses(state.ctx, serviceType)
    ]);
    if (!survey) return;

    const headers = ['Nombre', 'Email', 'Carrera', 'Rol', 'Fuente', 'Fecha', ...survey.questions.map((question) => question.text)];
    const rows = responses.map((response) => [
      response.userName || '',
      response.userEmail || '',
      response.userCareer || '',
      response.userRole || '',
      response.source || '',
      helpers.fmtDate(response.submittedAt),
      ...survey.questions.map((question) => helpers.formatAnswerValue(response.answers?.[question.id]))
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `encuesta_servicio_${serviceType}.csv`;
    link.click();
  }

  async function checkAndShowServiceSurvey(serviceType, ctxOrNull) {
    const { helpers } = getShared();
    const ctx = helpers.getCurrentCtx(ctxOrNull);
    if (!ctx?.profile?.uid) return false;
    if (document.getElementById('modalServiceSurvey')) return true;
    try {
      const pending = await window.EncuestasServicioService.checkPendingSurvey(ctx, serviceType);
      if (!pending) return false;
      renderServiceSurveyModal(pending, ctx);
      return true;
    } catch (error) {
      console.error('[Encuestas] Error checking service survey:', error);
      return false;
    }
  }

  function renderServiceSurveyModal(survey, ctxOrNull) {
    const { helpers, modules } = getShared();
    document.getElementById('modalServiceSurvey')?.remove();
    const ctx = helpers.getCurrentCtx(ctxOrNull);
    const canSkip = !survey.isMandatory;
    const allowNotUsed = canSkip && !survey.config?.showToAll;
    const meta = helpers.getServiceMeta(survey.serviceType);
    const wrapper = document.createElement('div');
    wrapper.id = 'modalServiceSurvey';
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1" ${canSkip ? '' : 'data-bs-backdrop="static" data-bs-keyboard="false"'}><div class="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden"><div class="modal-header border-0 bg-${meta.tone} bg-opacity-10"><div class="d-flex align-items-start gap-3"><div class="rounded-circle shadow-sm d-flex align-items-center justify-content-center" style="width:48px;height:48px;"><i class="bi ${meta.icon} text-${meta.tone} fs-4"></i></div><div><div class="d-flex flex-wrap gap-2 mb-2"><span class="badge rounded-pill ${survey.isMandatory ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'}">${survey.isMandatory ? 'Obligatoria' : 'Satisfaccion del servicio'}</span></div><h5 class="fw-bold mb-1">${helpers.esc(survey.title)}</h5><p class="text-muted small mb-0">${helpers.esc(survey.description || 'Tu opinion ayuda a mejorar el servicio.')}</p></div></div>${canSkip ? '<button class="btn-close" data-bs-dismiss="modal"></button>' : ''}</div><div class="modal-body p-4">${survey.isMandatory ? '<div class="alert alert-warning rounded-4 border-0"><i class="bi bi-exclamation-circle-fill me-2"></i>Necesitamos tu respuesta antes de continuar.</div>' : ''}${allowNotUsed ? `<div class="rounded-4 border p-3 mb-4 d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-center"><div><div class="fw-semibold mb-1">No he usado este servicio</div><div class="small text-muted">Si lo confirmas, ya no volvera a aparecer hasta detectar un uso futuro.</div></div><button class="btn btn-outline-danger rounded-pill" onclick="Encuestas.skipServiceSurveyNotUsed('${survey.serviceType}')">Marcar como no usado</button></div>` : ''}<div id="service-survey-qs"></div></div><div class="modal-footer border-0 d-flex flex-column gap-3"><div id="service-survey-pagination" class="d-flex justify-content-center gap-2 flex-wrap align-items-center"></div><div class="d-flex justify-content-between gap-2 flex-wrap w-100"><div>${canSkip ? `<button class="btn btn-light rounded-pill" onclick="Encuestas.skipServiceSurvey('${survey.serviceType}')">Recordar despues</button>` : ''}</div><button class="btn btn-primary rounded-pill px-5 fw-bold d-none" id="svc-submit-btn" onclick="Encuestas.submitServiceSurvey('${survey.serviceType}')"><i class="bi bi-send-fill me-2"></i>Enviar respuestas</button></div></div></div></div></div>`;
    document.body.appendChild(wrapper);

    wrapper._survey = survey;
    wrapper._ctx = ctx;
    window._activeServiceSurveyModal = wrapper;

    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('shown.bs.modal', () => {
      window.EncuestasServicioService.markSurveyShown(ctx, survey.serviceType).catch((error) => console.warn(error));
    });
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (window._activeServiceSurveyModal === wrapper) window._activeServiceSurveyModal = null;
      wrapper.remove();
    });

    modules.Forms.initSurveyPagination(survey.questions, 'service-survey-qs', 'service-survey-pagination', 'svc-submit-btn', wrapper);
  }

  async function submitServiceSurvey(serviceType) {
    const { state, helpers, modules } = getShared();
    const modal = window._activeServiceSurveyModal;
    const survey = modal?._survey;
    if (!survey) return;

    const answers = modules.Forms.collectAnswers(survey.questions, 'service-survey-qs', modal._paginator);
    if (!answers) return;

    const btn = document.getElementById('svc-submit-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

    try {
      await window.EncuestasServicioService.submitServiceSurveyResponse(modal._ctx || state.ctx, serviceType, answers, {
        source: 'service_modal'
      });
      const body = modal.querySelector('.modal-body');
      if (body) {
        body.innerHTML = '<div class="text-center py-5 animate-fade-in"><i class="bi bi-check-circle-fill text-success fs-1 d-block mb-3"></i><h4 class="fw-bold mb-2">Gracias por tu opinion</h4><p class="text-muted mb-0">La respuesta fue registrada correctamente.</p></div>';
      }
      const footer = modal.querySelector('.modal-footer');
      if (footer) footer.remove();
      helpers.toast('Encuesta enviada.', 'success');
      setTimeout(() => bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide(), 1400);
    } catch (error) {
      helpers.toast(error.message || 'No se pudo enviar la encuesta.', 'danger');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Enviar respuestas';
    }
  }

  async function skipServiceSurvey(serviceType) {
    const { state, helpers } = getShared();
    const modal = window._activeServiceSurveyModal;
    if (!modal) return;
    try {
      await window.EncuestasServicioService.recordSurveySkip(modal._ctx || state.ctx, serviceType);
      bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
    } catch (error) {
      helpers.toast(error.message || 'No se pudo posponer la encuesta.', 'danger');
    }
  }

  function skipServiceSurveyNotUsed(serviceType) {
    const modal = window._activeServiceSurveyModal;
    if (!modal || modal._survey?.isMandatory) return;
    modal._originalBodyHTML = modal.querySelector('.modal-body')?.innerHTML || '';
    modal._originalFooterHTML = modal.querySelector('.modal-footer')?.innerHTML || '';
    modal.querySelector('.modal-body').innerHTML = `<div class="text-center py-5 animate-fade-in"><i class="bi bi-patch-question-fill text-warning fs-1 d-block mb-3"></i><h4 class="fw-bold mb-2">Confirmar "no he usado este servicio"</h4><p class="text-muted mb-0">Se cerrara la encuesta actual y no volvera a mostrarse hasta detectar un nuevo uso del servicio.</p></div>`;
    modal.querySelector('.modal-footer').innerHTML = `<div class="d-flex justify-content-end gap-2 w-100"><button class="btn btn-light rounded-pill" onclick="Encuestas.cancelSkipServiceSurvey()">Volver</button><button class="btn btn-danger rounded-pill px-4" id="confirm-skip-btn" onclick="Encuestas.confirmSkipServiceSurvey('${serviceType}')">Confirmar</button></div>`;
  }

  function cancelSkipServiceSurvey() {
    const { modules } = getShared();
    const modal = window._activeServiceSurveyModal;
    if (!modal) return;
    modal.querySelector('.modal-body').innerHTML = modal._originalBodyHTML || '';
    modal.querySelector('.modal-footer').innerHTML = modal._originalFooterHTML || '';
    modules.Forms.initSurveyPagination(modal._survey.questions, 'service-survey-qs', 'service-survey-pagination', 'svc-submit-btn', modal);
  }

  async function confirmSkipServiceSurvey(serviceType) {
    const { state, helpers } = getShared();
    const modal = window._activeServiceSurveyModal;
    const btn = document.getElementById('confirm-skip-btn');
    if (!modal || !btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrando...';

    try {
      await window.EncuestasServicioService.markSurveyNotUsed(modal._ctx || state.ctx, serviceType);
      modal.querySelector('.modal-body').innerHTML = '<div class="text-center py-5 animate-fade-in"><i class="bi bi-check-circle-fill text-success fs-1 d-block mb-3"></i><h4 class="fw-bold mb-2">Estado registrado</h4><p class="text-muted mb-0">Tomaremos esta encuesta como no aplicable por ahora.</p></div>';
      modal.querySelector('.modal-footer').remove();
      setTimeout(() => bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide(), 1200);
    } catch (error) {
      helpers.toast(error.message || 'No se pudo registrar la exencion.', 'danger');
      btn.disabled = false;
      btn.textContent = 'Confirmar';
    }
  }

  return {
    initPublic,
    submitPublicSurvey,
    loadResults,
    viewResponse,
    exportCSV,
    openStudentSurvey,
    startStudentSurvey,
    remindStudentSurveyLater,
    saveStudentDraft,
    submitStudentSurvey,
    checkAndShowBlockingSurvey,
    checkAndShowLaunchedSurvey,
    viewServiceResults,
    viewServiceResponse,
    exportServiceCSV,
    checkAndShowServiceSurvey,
    renderServiceSurveyModal,
    submitServiceSurvey,
    skipServiceSurvey,
    skipServiceSurveyNotUsed,
    cancelSkipServiceSurvey,
    confirmSkipServiceSurvey
  };
})();
