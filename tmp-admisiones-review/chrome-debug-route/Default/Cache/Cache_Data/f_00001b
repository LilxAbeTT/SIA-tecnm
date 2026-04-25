// modules/encuestas/encuestas-nav.js
// Internal navigation, admin actions and service editor flows for Encuestas.

if (!window.Encuestas) window.Encuestas = {};

window.Encuestas.Nav = (function () {
  const ADMIN_TAB_LABELS = Object.freeze({
    crear: 'Diseno',
    gestionar: 'Campanas',
    resultados: 'Resultados',
    servicios: 'Servicios'
  });

  function getShared() {
    const shared = window.Encuestas?.__getShared?.();
    if (!shared) throw new Error('[Encuestas.Nav] Shared bridge unavailable.');
    return shared;
  }

  function syncAdminBreadcrumb(tab) {
    const label = ADMIN_TAB_LABELS[tab] || ADMIN_TAB_LABELS.crear;
    window.SIA?.setBreadcrumbSection?.('view-encuestas', label, { moduleClickable: false });
  }

  function resolveSaveSurveyConfig(mode) {
    if (mode === 'publish') {
      return { status: 'active', successMessage: 'Encuesta publicada correctamente.' };
    }
    if (mode === 'update') {
      const builderContext = window.Encuestas.Forms.getBuilderSurveyContext();
      return {
        status: builderContext.status,
        successMessage: 'Cambios guardados correctamente.'
      };
    }
    return { status: 'draft', successMessage: 'Borrador guardado.' };
  }

  async function initAdminView() {
    const { state } = getShared();
    await loadAdminKPIs();
    await switchTab(state.currentTab);
    maybeLaunchAdminTour();
  }

  async function loadAdminKPIs() {
    const { state } = getShared();
    const container = document.getElementById('enc-admin-kpis');
    if (!container) return;
    try {
      const stats = await window.EncuestasService.getOverviewStats(state.ctx);
      const cards = [
        { label: 'Total', value: stats.total, icon: 'bi-collection', tone: 'primary' },
        { label: 'Activas', value: stats.active, icon: 'bi-broadcast-pin', tone: 'success' },
        { label: 'Bloquean acceso', value: stats.blocking, icon: 'bi-lock-fill', tone: 'danger' },
        { label: 'Obligatorias', value: stats.mandatory, icon: 'bi-star-fill', tone: 'warning' },
        { label: 'Programadas', value: stats.scheduled, icon: 'bi-calendar-check-fill', tone: 'info' },
        { label: 'Respuestas', value: stats.totalResponses, icon: 'bi-people-fill', tone: 'secondary' }
      ];
      container.innerHTML = cards.map((card) => `<div class="col-6 col-lg-2"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-3 text-center"><i class="bi ${card.icon} text-${card.tone} fs-4 d-block mb-2"></i><div class="fw-bold fs-3 mb-0">${card.value}</div><div class="extra-small text-muted text-uppercase">${card.label}</div></div></div></div>`).join('');
    } catch (error) {
      container.innerHTML = '<div class="col-12"><div class="alert alert-danger rounded-4 mb-0">No se pudieron cargar las metricas del modulo.</div></div>';
    }
  }

  async function switchTab(tab) {
    const { state, modules } = getShared();
    state.currentTab = tab;
    syncAdminBreadcrumb(tab);
    document.querySelectorAll('#enc-admin-tabs .tab-btn').forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('btn-primary', active);
      button.classList.toggle('btn-outline-primary', !active);
    });
    const container = document.getElementById('enc-tab-content');
    if (!container) return;
    if (tab === 'crear') return modules.UI.renderCreateTab(container);
    if (tab === 'gestionar') return renderGestionarTab(container);
    if (tab === 'resultados') return modules.UI.renderResultadosTab(container);
    if (tab === 'servicios') return renderEncuestasServicioTab(container);
  }

  async function saveSurvey(mode = 'draft') {
    const { state, helpers } = getShared();
    const payload = window.Encuestas.Forms.collectSurveyBuilderData();
    if (!payload) return;
    const saveConfig = resolveSaveSurveyConfig(mode);
    const action = state.editingSurveyId
      ? window.EncuestasService.updateSurvey(state.ctx, state.editingSurveyId, { ...payload, status: saveConfig.status })
      : window.EncuestasService.createSurvey(state.ctx, { ...payload, status: saveConfig.status });
    try {
      await action;
      helpers.toast(saveConfig.successMessage, 'success');
      await loadAdminKPIs();
      state.builderSnapshot = null;
      state.editingSurveyId = null;
      await switchTab('gestionar');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo guardar la encuesta.', 'danger');
    }
  }

  async function previewSurvey() {
    const { helpers } = getShared();
    const draft = window.Encuestas.Forms.collectSurveyBuilderData();
    if (!draft) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg"><div class="modal-header border-0 bg-primary bg-opacity-10"><div><span class="badge bg-primary-subtle text-primary rounded-pill mb-2">Vista previa del estudiante</span><h5 class="fw-bold mb-0">${helpers.esc(draft.title)}</h5></div><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body p-4"><div class="d-flex flex-wrap gap-2 mb-3">${draft.isPublic ? '<span class="badge bg-info-subtle text-info rounded-pill">Publica</span>' : ''}<span class="badge bg-warning-subtle text-warning rounded-pill">${helpers.esc(draft.delivery.mandatoryMode === 'blocking' ? 'Bloquea acceso' : (draft.delivery.mandatoryMode === 'required' ? 'Respuesta requerida' : 'Opcional'))}</span><span class="badge bg-secondary-subtle text-secondary rounded-pill">${draft.questions.length} preguntas</span></div><p class="text-muted">${helpers.esc(draft.description || 'Sin descripcion')}</p><div id="enc-preview-questions"></div></div></div></div></div>`;
    document.body.appendChild(wrapper);
    wrapper.querySelector('#enc-preview-questions').innerHTML = window.Encuestas.Forms.renderQuestionsHTML(draft.questions, 'preview');
    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
  }

  async function editSurvey(surveyId) {
    const { state, helpers } = getShared();
    const survey = await window.EncuestasService.getSurveyById(state.ctx, surveyId);
    if (!survey) {
      helpers.toast('Encuesta no encontrada.', 'warning');
      return;
    }
    state.builderSnapshot = survey;
    await switchTab('crear');
    helpers.toast('Editando encuesta seleccionada.', 'info');
  }

  async function duplicateSurvey(surveyId) {
    const { state, helpers } = getShared();
    try {
      await window.EncuestasService.duplicateSurvey(state.ctx, surveyId);
      helpers.toast('Se creo una copia en borrador.', 'success');
      await loadAdminKPIs();
      await switchTab('gestionar');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo duplicar la encuesta.', 'danger');
    }
  }

  async function renderGestionarTab(container) {
    const { state } = getShared();
    container.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
    try {
      state.surveys = await window.EncuestasService.getAllSurveys(state.ctx, { includeArchived: true });
      container.innerHTML = '<section class="card border-0 shadow-sm rounded-4 mb-4"><div class="card-body p-4"><div class="row g-3 align-items-end"><div class="col-lg-6"><label class="form-label small fw-semibold">Buscar campana</label><input id="enc-filter-query" class="form-control rounded-4" placeholder="Titulo o descripcion" oninput="Encuestas.applyCampaignFilters()"></div><div class="col-lg-3"><label class="form-label small fw-semibold">Estado</label><select id="enc-filter-status" class="form-select rounded-4" onchange="Encuestas.applyCampaignFilters()"><option value="all">Todos</option><option value="active">Activas</option><option value="scheduled">Programadas</option><option value="paused">Pausadas</option><option value="draft">Borrador</option><option value="closed">Cerradas</option><option value="archived">Archivadas</option></select></div><div class="col-lg-3 d-flex justify-content-lg-end"><button class="btn btn-outline-primary rounded-pill w-100 w-lg-auto" onclick="Encuestas.openCreateModal()"><i class="bi bi-plus-circle-fill me-1"></i>Nueva encuesta</button></div></div></div></section><div id="enc-campaigns-list" class="row g-3" data-tour="campaign-list"></div>';
      applyCampaignFilters();
    } catch (error) {
      container.innerHTML = '<div class="alert alert-danger rounded-4">No se pudieron cargar las campanas.</div>';
    }
  }

  function applyCampaignFilters() {
    const { state, modules } = getShared();
    const list = document.getElementById('enc-campaigns-list');
    if (!list) return;
    const query = document.getElementById('enc-filter-query')?.value?.trim().toLowerCase() || '';
    const status = document.getElementById('enc-filter-status')?.value || 'all';
    let surveys = [...state.surveys];
    if (status !== 'all') surveys = surveys.filter((survey) => (survey.runtimeStatus || survey.status) === status || survey.status === status);
    if (query) surveys = surveys.filter((survey) => `${survey.title} ${survey.description}`.toLowerCase().includes(query));
    if (!surveys.length) {
      list.innerHTML = '<div class="col-12"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-5 text-center text-muted"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>No hay encuestas que coincidan con los filtros.</div></div></div>';
      return;
    }
    list.innerHTML = surveys.map((survey) => modules.UI.renderSurveyCard(survey)).join('');
    window.UI?.initTooltips?.();
  }

  function openCreateModal() {
    const { state } = getShared();
    state.builderSnapshot = null;
    state.editingSurveyId = null;
    switchTab('crear');
  }

  async function toggleSurvey(id, status) {
    const { state, helpers } = getShared();
    try {
      await window.EncuestasService.toggleStatus(state.ctx, id, status);
      helpers.toast('Estado actualizado.', 'success');
      await loadAdminKPIs();
      await switchTab('gestionar');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo actualizar el estado.', 'danger');
    }
  }

  async function launchSurveyToAll(id) {
    const { state, helpers } = getShared();
    try {
      await window.EncuestasService.launchSurveyToAll(state.ctx, id);
      helpers.toast('Campana lanzada. Se mostrara una vez por usuario.', 'success');
      await loadAdminKPIs();
      await switchTab('gestionar');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo lanzar la encuesta.', 'danger');
    }
  }

  async function deleteSurvey(id) {
    const { state, helpers } = getShared();
    if (!confirm('La encuesta se archivara para conservar historico y evitar respuestas huerfanas. Continuar?')) return;
    try {
      await window.EncuestasService.deleteSurvey(state.ctx, id);
      helpers.toast('Encuesta archivada.', 'success');
      await loadAdminKPIs();
      await switchTab('gestionar');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo archivar la encuesta.', 'danger');
    }
  }

  function showQR(surveyId) {
    const { state, helpers } = getShared();
    const survey = state.surveys.find((item) => item.id === surveyId);
    if (!survey) return;
    const link = survey.isPublic ? `${window.location.origin}/#/encuesta-publica/${surveyId}` : `${window.location.origin}/#/encuestas`;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-sm modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg"><div class="modal-header border-0"><h6 class="fw-bold mb-0">QR y enlace</h6><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body text-center p-4"><div id="enc-qr-container" class="d-flex justify-content-center mb-3"></div><input class="form-control rounded-pill text-center mb-2" value="${helpers.esc(link)}" readonly id="enc-qr-link"><button class="btn btn-outline-primary rounded-pill w-100" onclick="navigator.clipboard.writeText(document.getElementById('enc-qr-link').value); this.innerHTML='<i class=&quot;bi bi-check-lg me-1&quot;></i>Copiado';"><i class="bi bi-clipboard me-1"></i>Copiar enlace</button></div></div></div></div>`;
    document.body.appendChild(wrapper);
    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('shown.bs.modal', () => {
      const qrContainer = wrapper.querySelector('#enc-qr-container');
      if (typeof QRCode !== 'undefined' && qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, { text: link, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.H });
      }
    });
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
  }

  async function openResultsTab(surveyId) {
    const { state } = getShared();
    state.selectedResultsSurveyId = surveyId;
    await switchTab('resultados');
  }

  async function initStudentView() {
    const { state } = getShared();
    const list = document.getElementById('enc-student-list');
    const kpis = document.getElementById('enc-student-kpis');
    if (!list || !kpis) return;
    list.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-primary"></span></div>';
    try {
      state.studentFeed = await window.EncuestasService.getStudentSurveyFeed(state.ctx);
      window.Encuestas.UI.renderStudentFeed();
    } catch (error) {
      kpis.innerHTML = '';
      list.innerHTML = '<div class="alert alert-danger rounded-4">No se pudo cargar tu centro de encuestas.</div>';
    }
  }

  function setStudentFilter(filter) {
    const { state } = getShared();
    state.studentFilter = filter;
    window.Encuestas.UI.renderStudentFeed();
  }

  function setStudentQuery(query) {
    const { state } = getShared();
    state.studentQuery = String(query || '');
    window.Encuestas.UI.renderStudentFeed();
  }

  async function renderEncuestasServicioTab(container) {
    const { state, modules } = getShared();
    container.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
    try {
      const [surveys, stats] = await Promise.all([
        window.EncuestasServicioService.getAllServiceSurveys(state.ctx),
        window.EncuestasServicioService.getOverviewStats(state.ctx)
      ]);
      const surveyMap = {};
      surveys.forEach((survey) => { surveyMap[survey.serviceType] = survey; });
      const serviceTypes = Object.keys(getShared().constants.SERVICE_DEFAULTS);
      container.innerHTML = modules.UI.renderServiceDashboard(surveyMap, stats, serviceTypes);
    } catch (error) {
      container.innerHTML = '<div class="alert alert-danger rounded-4">No se pudieron cargar las encuestas de servicio.</div>';
    }
  }

  async function createDefaultServiceSurvey(serviceType) {
    const { state, constants, helpers } = getShared();
    const base = constants.SERVICE_DEFAULTS[serviceType];
    if (!base) {
      helpers.toast('Servicio no reconocido.', 'warning');
      return;
    }
    try {
      await window.EncuestasServicioService.createServiceSurvey(state.ctx, serviceType, {
        title: base.title,
        description: base.description,
        questions: base.questions,
        enabled: false,
        config: {
          frequency: 'per-use',
          customDays: null,
          showToAll: false,
          maxSkips: 2,
          triggerTimestamp: null
        }
      });
      helpers.toast('Configuracion inicial creada.', 'success');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo inicializar la encuesta.', 'danger');
    }
  }

  function openServiceConfig(serviceType) {
    return openServiceEditor(serviceType);
  }

  async function openServiceEditor(serviceType) {
    const { state, helpers } = getShared();
    let survey = await window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType);
    if (!survey) {
      await createDefaultServiceSurvey(serviceType);
      survey = await window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType);
    }
    if (!survey) {
      helpers.toast('No se pudo abrir la configuracion del servicio.', 'danger');
      return;
    }

    document.getElementById('modalServiceEditor')?.remove();
    const meta = helpers.getServiceMeta(serviceType);
    const wrapper = document.createElement('div');
    wrapper.id = 'modalServiceEditor';
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered"><div class="modal-content border-0 rounded-4 shadow-lg"><div class="modal-header border-0 bg-light"><div><div class="d-flex align-items-center gap-2 mb-2"><span class="badge bg-${meta.tone}-subtle text-${meta.tone} rounded-pill">${meta.name}</span>${helpers.renderInfoButton('services')}</div><h5 class="fw-bold mb-1">Configuracion de encuesta de servicio</h5><p class="text-muted small mb-0">Ajusta preguntas, frecuencia y el comportamiento obligatorio antes de lanzarla.</p></div><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body p-4"><div class="row g-4"><div class="col-lg-8"><div class="mb-3"><label class="form-label fw-semibold">Titulo</label><input id="svc-title" class="form-control rounded-4" value="${helpers.esc(survey.title || '')}"></div><div class="mb-4"><label class="form-label fw-semibold">Descripcion</label><textarea id="svc-desc" class="form-control rounded-4" rows="3">${helpers.esc(survey.description || '')}</textarea></div><div class="d-flex justify-content-between align-items-center mb-3"><div><h6 class="fw-bold mb-1">Preguntas</h6><p class="text-muted small mb-0">Puedes usar escalas, opcion multiple y texto abierto.</p></div><button class="btn btn-outline-primary rounded-pill" onclick="Encuestas.addQuestionToBuilder('svc-questions-builder')"><i class="bi bi-plus-lg me-1"></i>Agregar pregunta</button></div><div id="svc-questions-builder" class="d-grid gap-3"></div></div><div class="col-lg-4"><div class="card border-0 bg-light-subtle rounded-4 mb-3"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold mb-0">Frecuencia</h6>${helpers.renderInfoButton('services', 'Explicar frecuencia')}</div><div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="svc-freq-per-use" value="per-use" ${survey.config?.frequency === 'per-use' ? 'checked' : ''}><label class="form-check-label" for="svc-freq-per-use">Cada uso</label></div><div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="svc-freq-weekly" value="weekly" ${survey.config?.frequency === 'weekly' ? 'checked' : ''}><label class="form-check-label" for="svc-freq-weekly">Semanal</label></div><div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="svc-freq-monthly" value="monthly" ${survey.config?.frequency === 'monthly' ? 'checked' : ''}><label class="form-check-label" for="svc-freq-monthly">Mensual</label></div><div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="svc-freq-custom" value="custom" ${survey.config?.frequency === 'custom' ? 'checked' : ''} onchange="document.getElementById('svc-custom-days-wrap').classList.toggle('d-none', !this.checked)"><label class="form-check-label" for="svc-freq-custom">Cada cierto numero de dias</label></div><div id="svc-custom-days-wrap" class="${survey.config?.frequency === 'custom' ? '' : 'd-none'}"><label class="form-label small fw-semibold mt-2">Dias</label><input id="svc-custom-days" type="number" min="1" class="form-control rounded-4" value="${survey.config?.customDays || 7}"></div></div></div><div class="card border-0 bg-light-subtle rounded-4"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold mb-0">Comportamiento</h6>${helpers.renderInfoButton('delivery', 'Ayuda sobre obligatoriedad')}</div><div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="svc-enabled" ${survey.enabled ? 'checked' : ''}><label class="form-check-label" for="svc-enabled">Encuesta habilitada</label></div><div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="svc-show-to-all" ${survey.config?.showToAll ? 'checked' : ''}><label class="form-check-label" for="svc-show-to-all">Disponible para lanzamiento global</label><div class="small text-muted mt-1">Al activarla manualmente desde la tarjeta del servicio se mostrara a todos los usuarios.</div></div><div class="mb-3"><label class="form-label fw-semibold">Saltos permitidos</label><input id="svc-max-skips" type="number" min="0" class="form-control rounded-4" value="${survey.config?.maxSkips ?? 2}"><div class="small text-muted mt-1">Cuando llegue al limite, la siguiente vez se tratara como obligatoria.</div></div><div class="small text-muted">Consejo: para evitar respuestas vacias, usa 1 o 2 saltos como maximo.</div></div></div></div></div></div><div class="modal-footer border-0 gap-2"><button class="btn btn-outline-secondary rounded-pill me-auto" onclick="Encuestas.restoreDefaultServiceSurvey('${serviceType}')"><i class="bi bi-arrow-counterclockwise me-1"></i>Restaurar base</button><button class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="Encuestas.saveServiceEditor('${serviceType}')"><i class="bi bi-save me-1"></i>Guardar cambios</button></div></div></div></div>`;
    document.body.appendChild(wrapper);

    const builder = wrapper.querySelector('#svc-questions-builder');
    builder.innerHTML = '';
    state.questionCounter = 0;
    (survey.questions || []).forEach((question) => window.Encuestas.Forms.addQuestionToBuilder('svc-questions-builder', question));
    if (!(survey.questions || []).length) window.Encuestas.Forms.addQuestionToBuilder('svc-questions-builder');

    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
    window._activeServiceEditorModal = wrapper;
    window.UI?.initTooltips?.();
  }

  async function saveServiceEditor(serviceType) {
    const { state, helpers } = getShared();
    const modal = window._activeServiceEditorModal;
    if (!modal) return;

    const payload = window.Encuestas.Forms.collectServiceSurveyEditorData(modal);
    if (!payload) return;

    try {
      const current = await window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType);
      if (current) await window.EncuestasServicioService.updateServiceSurvey(state.ctx, serviceType, payload);
      else await window.EncuestasServicioService.createServiceSurvey(state.ctx, serviceType, payload);
      helpers.toast('Encuesta de servicio guardada.', 'success');
      bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
      await switchTab('servicios');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo guardar la encuesta de servicio.', 'danger');
    }
  }

  async function toggleServiceSurveyStatus(serviceType, enabled) {
    const { state, helpers } = getShared();
    try {
      await window.EncuestasServicioService.toggleServiceSurvey(state.ctx, serviceType, enabled);
      helpers.toast(enabled ? 'Encuesta habilitada.' : 'Encuesta deshabilitada.', 'success');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo actualizar el estado.', 'danger');
    }
  }

  async function triggerServiceSurveyToAll(serviceType) {
    const { state, helpers } = getShared();
    if (!confirm('Se lanzara esta encuesta a todos los usuarios. Continuar?')) return;
    try {
      const survey = await window.EncuestasServicioService.getServiceSurvey(state.ctx, serviceType);
      if (!survey) await createDefaultServiceSurvey(serviceType);
      await window.EncuestasServicioService.triggerSurveyToAll(state.ctx, serviceType);
      helpers.toast('Lanzamiento global activado.', 'success');
      await switchTab('servicios');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo activar el lanzamiento global.', 'danger');
    }
  }

  async function deactivateServiceSurveyToAll(serviceType) {
    const { state, helpers } = getShared();
    try {
      await window.EncuestasServicioService.stopGlobalSurvey(state.ctx, serviceType);
      helpers.toast('Lanzamiento global detenido.', 'success');
      await switchTab('servicios');
    } catch (error) {
      helpers.toast(error.message || 'No se pudo detener el lanzamiento global.', 'danger');
    }
  }

  async function restoreDefaultServiceSurvey(serviceType) {
    const { helpers } = getShared();
    if (!confirm('Se restaurara la estructura base del servicio. Continuar?')) return;
    const modal = window._activeServiceEditorModal;
    try {
      await createDefaultServiceSurvey(serviceType);
      bootstrap.Modal.getInstance(modal?.querySelector('.modal'))?.hide();
      setTimeout(() => openServiceEditor(serviceType), 250);
    } catch (error) {
      helpers.toast(error.message || 'No se pudo restaurar la encuesta base.', 'danger');
    }
  }

  async function maybeLaunchAdminTour() {
    const { state } = getShared();
    const uid = state.ctx?.user?.uid || state.profile?.uid;
    if (!state.isAdmin || !uid) return;
    const storageKey = `sia_enc_admin_tour_v1_${uid}`;
    if (localStorage.getItem(storageKey) === 'true') return;

    try {
      const prefs = await window.SIA?.getUserPreferences?.(uid);
      if (prefs === null) return;
      if (prefs?.encuestas_admin_tour_v1) {
        localStorage.setItem(storageKey, 'true');
        return;
      }
    } catch (error) {
      console.warn('[Encuestas] No se pudieron leer preferencias del tutorial:', error);
      return;
    }

    setTimeout(() => launchAdminTutorial(), 800);
  }

  async function launchAdminTutorial(force = false) {
    const { state, helpers } = getShared();
    if (!state.isAdmin) return;
    if (state.currentTab !== 'crear') await switchTab('crear');

    const uid = state.ctx?.user?.uid || state.profile?.uid || 'admin';
    const storageKey = `sia_enc_admin_tour_v1_${uid}`;
    if (!force && localStorage.getItem(storageKey) === 'true') return;

    const existing = document.querySelector('sia-onboarding-tour.encuestas-admin-tour');
    if (existing) existing.remove();

    const tour = document.createElement('sia-onboarding-tour');
    tour.className = 'encuestas-admin-tour';
    document.body.appendChild(tour);
    tour._steps = [
      { target: null, title: 'Centro de Encuestas', description: 'Desde aqui administras campanas institucionales, encuestas que pueden bloquear acceso y sondeos por servicio sin salir del mismo modulo.', position: 'center' },
      { target: '#enc-admin-tour-btn', title: 'Repetir tutorial', description: 'Usa este boton cuando quieras repasar el flujo del modulo o capacitar a otro admin.', position: 'bottom' },
      { target: '#enc-admin-tabs', title: 'Secciones principales', description: 'Disenar, Campanas, Resultados y Servicios concentran todo el ciclo de trabajo del modulo.', position: 'bottom' },
      { target: '[data-tour="builder"]', title: 'Editor principal', description: 'Aqui construyes la encuesta, defines preguntas y preparas la publicacion.', position: 'top' },
      { target: '[data-tour="add-question"]', title: 'Agregar preguntas', description: 'Puedes combinar opcion multiple, escalas, booleanas y texto abierto.', position: 'bottom' },
      { target: '[data-tour="audience"]', title: 'Audiencia y modo publico', description: 'Selecciona a quien va dirigida la encuesta o conviertela en publica con enlace y QR.', position: 'left' },
      { target: '[data-tour="delivery"]', title: 'Prioridad y obligatoriedad', description: 'Define si sera opcional, de respuesta requerida o si bloqueara acceso antes de publicarla.', position: 'left' },
      { target: '[data-tour="schedule"]', title: 'Vigencia', description: 'Programa fechas cuando quieras automatizar inicio y cierre de la campana.', position: 'left' },
      { target: null, title: 'Apoyo contextual', description: 'Los iconos de informacion junto a cada seccion explican el impacto de la accion antes de guardar.', position: 'center' }
    ];

    const markDone = async () => {
      localStorage.setItem(storageKey, 'true');
      try {
        await window.SIA?.updateUserPreferences?.(uid, { encuestas_admin_tour_v1: true });
      } catch (error) {
        console.warn('[Encuestas] No se pudieron guardar preferencias del tutorial:', error);
      }
    };

    const originalMarkCompleted = tour._markCompleted?.bind(tour);
    tour._markCompleted = async function () {
      if (originalMarkCompleted) await originalMarkCompleted();
      await markDone();
    };

    const originalSkip = tour._skip?.bind(tour);
    tour._skip = async function () {
      await markDone();
      if (originalSkip) await originalSkip();
    };

    requestAnimationFrame(() => tour.start());
  }

  function showHelp(topic) {
    return window.Encuestas.UI.showHelp(topic);
  }

  return {
    initAdminView,
    loadAdminKPIs,
    switchTab,
    saveSurvey,
    previewSurvey,
    editSurvey,
    duplicateSurvey,
    renderGestionarTab,
    applyCampaignFilters,
    openCreateModal,
    toggleSurvey,
    launchSurveyToAll,
    deleteSurvey,
    showQR,
    openResultsTab,
    initStudentView,
    setStudentFilter,
    setStudentQuery,
    renderEncuestasServicioTab,
    createDefaultServiceSurvey,
    openServiceConfig,
    openServiceEditor,
    saveServiceEditor,
    toggleServiceSurveyStatus,
    triggerServiceSurveyToAll,
    deactivateServiceSurveyToAll,
    restoreDefaultServiceSurvey,
    maybeLaunchAdminTour,
    launchAdminTutorial,
    showHelp
  };
})();
