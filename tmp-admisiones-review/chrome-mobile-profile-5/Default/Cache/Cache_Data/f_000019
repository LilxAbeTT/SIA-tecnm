// modules/encuestas/encuestas-ui.js
// Renderers and modal UI helpers for Centro de Encuestas.

if (!window.Encuestas) window.Encuestas = {};

window.Encuestas.UI = (function () {
  function getShared() {
    const shared = window.Encuestas?.__getShared?.();
    if (!shared) throw new Error('[Encuestas.UI] Shared bridge unavailable.');
    return shared;
  }

  function renderPublicState(title, description, icon, tone) {
    const { helpers } = getShared();
    return `<div class="container py-5" style="max-width:620px;"><div class="card border-0 shadow-sm rounded-4 text-center p-5"><i class="bi ${icon} fs-1 text-${tone} mb-3"></i><h3 class="fw-bold mb-2">${helpers.esc(title)}</h3><p class="text-muted mb-0">${helpers.esc(description)}</p></div></div>`;
  }

  function renderAdminShell() {
    const { helpers } = getShared();
    return `
      <div id="enc-app" class="animate-fade-in">
        <section id="enc-admin-hero" class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
          <div class="p-4 p-lg-5" style="background:linear-gradient(135deg,#0f172a 0%,#1247c4 58%,#10b981 100%);color:white;">
            <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <span class="badge text-primary rounded-pill mb-3">Calidad · Centro de Encuestas</span>
                <h2 class="fw-bold mb-2 filter-white">Campañas claras, medibles y sin friccion</h2>
                <p class="mb-0 opacity-75" style="max-width:760px;">Administra encuestas institucionales, campañas que pueden bloquear acceso y sondeos por servicio desde un solo lugar. Todo con ayuda contextual para evitar errores de publicacion.</p>
              </div>
              <div class="d-flex flex-wrap align-items-start gap-2">
                <button class="btn btn-light rounded-pill fw-semibold" id="enc-admin-tour-btn" data-tour="tour-btn" onclick="Encuestas.launchAdminTutorial(true)"><i class="bi bi-play-circle-fill me-2"></i>Ver tutorial</button>
                <button class="btn btn-outline-light rounded-pill fw-semibold" onclick="Encuestas.showHelp('results')"><i class="bi bi-question-circle-fill me-2"></i>Guia rapida</button>
              </div>
            </div>
          </div>
        </section>
        <section class="row g-3 mb-4" id="enc-admin-kpis"><div class="col-12 text-center py-4 text-muted"><span class="spinner-border spinner-border-sm text-primary me-2"></span>Cargando metricas...</div></section>
        <section class="card border-0 shadow-sm rounded-4 mb-4">
          <div class="card-body p-3 p-lg-4">
            <div class="row g-3 align-items-start">
              <div class="col-lg-8">
                <div class="d-flex flex-wrap gap-2" id="enc-admin-tabs" data-tour="main-tabs">
                  <button class="btn btn-primary rounded-pill tab-btn active" data-tab="crear" onclick="Encuestas.switchTab('crear')"><i class="bi bi-pencil-square me-1"></i>Disenar</button>
                  <button class="btn btn-outline-primary rounded-pill tab-btn" data-tab="gestionar" onclick="Encuestas.switchTab('gestionar')"><i class="bi bi-kanban-fill me-1"></i>Campanas</button>
                  <button class="btn btn-outline-primary rounded-pill tab-btn" data-tab="resultados" onclick="Encuestas.switchTab('resultados')"><i class="bi bi-graph-up-arrow me-1"></i>Resultados</button>
                  <button class="btn btn-outline-primary rounded-pill tab-btn" data-tab="servicios" onclick="Encuestas.switchTab('servicios')"><i class="bi bi-heart-pulse-fill me-1"></i>Servicios</button>
                </div>
              </div>
              <div class="col-lg-4">
                <div class="rounded-4 p-3 bg-light-subtle border h-100">
                  <div class="d-flex align-items-center justify-content-between">
                    <div>
                      <div class="fw-bold small text-uppercase text-muted">Antes de publicar</div>
                      <div class="small text-muted">Revisa audiencia, obligatoriedad y vigencia. ${helpers.renderInfoButton('delivery', 'Abrir ayuda de publicacion')}</div>
                    </div>
                    <i class="bi bi-shield-check fs-3 text-primary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div id="enc-tab-content"></div>
      </div>`;
  }

  function renderCreateTab(container) {
    const { modules, constants, state, helpers } = getShared();
    const builderContext = modules.Forms.getBuilderSurveyContext();
    container.innerHTML = `
      <section class="card border-0 shadow-sm rounded-4 mb-4" data-tour="builder">
        <div class="card-body p-4 p-lg-5">
          <div class="d-flex flex-column flex-lg-row justify-content-between align-items-start gap-3 mb-4">
            <div>
              <span class="badge bg-primary-subtle text-primary rounded-pill mb-2">${builderContext.isEditing ? 'Editando encuesta' : 'Nueva campana'}</span>
              <h4 class="fw-bold mb-1">${builderContext.isEditing ? 'Actualiza la encuesta seleccionada' : 'Diseña la encuesta antes de publicarla'}</h4>
              <p class="text-muted mb-0">Cada decision importante tiene ayuda contextual para que el admin siempre sepa que esta haciendo.</p>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-secondary rounded-pill" onclick="Encuestas.resetBuilder()"><i class="bi bi-arrow-counterclockwise me-1"></i>Limpiar</button>
              <button class="btn btn-outline-primary rounded-pill" onclick="Encuestas.previewSurvey()"><i class="bi bi-eye-fill me-1"></i>Vista previa</button>
            </div>
          </div>

          <div class="row g-4">
            <div class="col-xl-7">
              <div class="mb-3"><label class="form-label fw-semibold">Titulo de la encuesta</label><input id="enc-title" class="form-control form-control-lg rounded-4" placeholder="Ej. Encuesta semestral de servicios"></div>
              <div class="mb-4"><label class="form-label fw-semibold">Descripcion</label><textarea id="enc-desc" class="form-control rounded-4" rows="3" placeholder="Explica que se evaluara y por que es importante responder."></textarea></div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div><h5 class="fw-bold mb-1">Preguntas</h5><p class="text-muted small mb-0">Construye el formulario en el orden en que lo vera el estudiante.</p></div>
                <button class="btn btn-primary rounded-pill" onclick="Encuestas.addQuestion()" data-tour="add-question"><i class="bi bi-plus-lg me-1"></i>Agregar pregunta</button>
              </div>
              <div id="enc-questions-builder" class="d-grid gap-3"></div>
            </div>

            <div class="col-xl-5">
              <div class="card border-0 bg-light-subtle rounded-4 mb-3" data-tour="audience">
                <div class="card-body p-4">
                  <div class="d-flex align-items-center justify-content-between mb-2"><h6 class="fw-bold mb-0">1. Audiencia</h6>${helpers.renderInfoButton('audience')}</div>
                  <div class="row g-2" id="enc-audience-chips">
                    ${constants.AUDIENCE_OPTIONS.map((option) => `<div class="col-sm-6"><label class="border rounded-4 p-3 d-flex align-items-center gap-2 w-100"><input class="form-check-input mt-0" type="checkbox" id="${option.id}" value="${option.value}"><span><i class="bi ${option.icon} me-1"></i>${option.label}</span></label></div>`).join('')}
                    <div class="col-12"><label class="border rounded-4 p-3 d-flex align-items-start gap-2 w-100"><input class="form-check-input mt-1" type="checkbox" id="aud-all" value="todos" onchange="Encuestas.toggleAllAudience(this)"><span><strong>Todos</strong><div class="small text-muted">Usa esta opcion para campañas amplias dentro de SIA.</div></span></label></div>
                  </div>
                  <div class="form-check form-switch mt-3 pt-3 border-top">
                    <input class="form-check-input" type="checkbox" id="enc-public" onchange="Encuestas.togglePublicMode(this)">
                    <label class="form-check-label fw-semibold" for="enc-public">Encuesta publica</label>
                    <div class="small text-muted">Activa enlace y QR sin iniciar sesion. ${helpers.renderInfoButton('public')}</div>
                  </div>
                </div>
              </div>

              <div class="card border-0 bg-light-subtle rounded-4 mb-3" data-tour="delivery">
                <div class="card-body p-4">
                  <div class="d-flex align-items-center justify-content-between mb-2"><h6 class="fw-bold mb-0">2. Entrega y prioridad</h6>${helpers.renderInfoButton('delivery')}</div>
                  <label class="form-label small fw-semibold">Modo de participacion</label>
                  <select id="enc-mandatory-mode" class="form-select rounded-4 mb-3">
                    <option value="optional">Opcional</option>
                    <option value="required">Respuesta requerida</option>
                    <option value="blocking">Bloquea acceso</option>
                  </select>
                  <div class="form-check form-switch mb-2">
                    <input class="form-check-input" type="checkbox" id="enc-show-stories" checked>
                    <label class="form-check-label fw-semibold" for="enc-show-stories">Mostrar en novedades del dashboard</label>
                    <div class="small text-muted">Ayuda a que el estudiante la vea tambien como story. ${helpers.renderInfoButton('stories')}</div>
                  </div>
                </div>
              </div>

              <div class="card border-0 bg-light-subtle rounded-4 mb-4" data-tour="schedule">
                <div class="card-body p-4">
                  <div class="d-flex align-items-center justify-content-between mb-2"><h6 class="fw-bold mb-0">3. Vigencia</h6>${helpers.renderInfoButton('schedule')}</div>
                  <div class="form-check mb-2"><input class="form-check-input" type="radio" name="enc-sched" id="sched-manual" value="manual" checked onchange="document.getElementById('enc-dates').classList.add('d-none')"><label class="form-check-label" for="sched-manual">Activar y desactivar manualmente</label></div>
                  <div class="form-check mb-2"><input class="form-check-input" type="radio" name="enc-sched" id="sched-timed" value="timed" onchange="document.getElementById('enc-dates').classList.toggle('d-none', !this.checked)"><label class="form-check-label" for="sched-timed">Programar por fechas</label></div>
                  <div class="row g-2 d-none mt-1" id="enc-dates">
                    <div class="col-md-6"><label class="form-label small">Inicio</label><input type="datetime-local" id="enc-start" class="form-control rounded-4"></div>
                    <div class="col-md-6"><label class="form-label small">Fin</label><input type="datetime-local" id="enc-end" class="form-control rounded-4"></div>
                  </div>
                </div>
              </div>

              <div class="d-flex flex-wrap gap-2">
                ${builderContext.isEditing
                  ? `<button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="Encuestas.saveSurvey('update')"><i class="bi bi-save me-1"></i>Guardar cambios</button>`
                  : `<button class="btn btn-outline-secondary rounded-pill px-4" onclick="Encuestas.saveSurvey('draft')"><i class="bi bi-save me-1"></i>Guardar borrador</button>
                <button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="Encuestas.saveSurvey('publish')"><i class="bi bi-send-fill me-1"></i>Publicar encuesta</button>`}
              </div>
            </div>
          </div>
        </div>
      </section>`;

    modules.Forms.applyBuilderSnapshot(state.builderSnapshot);
    if (!state.builderSnapshot) modules.Forms.resetBuilder();
    window.UI?.initTooltips?.();
  }

  function renderSurveyCard(survey) {
    const { helpers } = getShared();
    const status = helpers.statusMeta(survey);
    const responseCount = survey.analytics?.totalResponses || survey.responseCount || 0;
    const mandatoryLabel = getDeliveryModeLabel(survey.delivery?.mandatoryMode);
    const runtime = survey.runtimeStatus || survey.status;
    const canActivate = ['draft', 'paused', 'scheduled'].includes(runtime);

    return `<div class="col-md-6 col-xl-4"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-start gap-2 mb-3"><div class="d-flex flex-wrap gap-2"><span class="badge rounded-pill ${status.badge}">${status.label}</span>${survey.isPublic ? '<span class="badge bg-info-subtle text-info rounded-pill">Publica</span>' : ''}<span class="badge bg-warning-subtle text-warning rounded-pill">${helpers.esc(mandatoryLabel)}</span>${survey.delivery?.showInStories !== false ? '<span class="badge bg-secondary-subtle text-secondary rounded-pill">Stories</span>' : ''}${survey.delivery?.launchToken ? '<span class="badge bg-primary-subtle text-primary rounded-pill">Lanzada</span>' : ''}</div><div class="dropdown"><button class="btn btn-light rounded-circle border" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button><ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-4"><li><button class="dropdown-item" onclick="Encuestas.editSurvey('${survey.id}')"><i class="bi bi-pencil-square me-2"></i>Editar</button></li><li><button class="dropdown-item" onclick="Encuestas.duplicateSurvey('${survey.id}')"><i class="bi bi-copy me-2"></i>Duplicar</button></li><li><button class="dropdown-item" onclick="Encuestas.openResultsTab('${survey.id}')"><i class="bi bi-graph-up-arrow me-2"></i>Ver resultados</button></li><li><button class="dropdown-item text-primary" onclick="Encuestas.launchSurveyToAll('${survey.id}')"><i class="bi bi-broadcast-pin me-2"></i>Lanzar</button></li>${survey.isPublic ? `<li><button class="dropdown-item" onclick="Encuestas.showQR('${survey.id}')"><i class="bi bi-qr-code me-2"></i>QR / enlace</button></li>` : ''}<li><hr class="dropdown-divider"></li>${canActivate ? `<li><button class="dropdown-item text-success" onclick="Encuestas.toggleSurvey('${survey.id}','active')"><i class="bi bi-play-circle me-2"></i>Activar</button></li>` : ''}${runtime === 'active' ? `<li><button class="dropdown-item text-warning" onclick="Encuestas.toggleSurvey('${survey.id}','paused')"><i class="bi bi-pause-circle me-2"></i>Pausar</button></li>` : ''}${runtime !== 'archived' ? `<li><button class="dropdown-item text-danger" onclick="Encuestas.deleteSurvey('${survey.id}')"><i class="bi bi-archive me-2"></i>Archivar</button></li>` : ''}</ul></div></div><h5 class="fw-bold mb-1">${helpers.esc(survey.title)}</h5><p class="text-muted small mb-3">${helpers.esc(survey.description || 'Sin descripcion')}</p><div class="row g-2 mb-3"><div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Audiencia</div><div class="fw-semibold">${helpers.esc((survey.audience || []).join(', '))}</div></div></div><div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Respuestas</div><div class="fw-semibold">${responseCount}</div></div></div><div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Preguntas</div><div class="fw-semibold">${(survey.questions || []).length}</div></div></div><div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Vigencia</div><div class="fw-semibold">${survey.scheduling?.type === 'timed' && survey.scheduling?.endDate ? helpers.fmtDate(survey.scheduling.endDate, false) : 'Manual'}</div></div></div></div><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-primary rounded-pill" onclick="Encuestas.editSurvey('${survey.id}')"><i class="bi bi-pencil-square me-1"></i>Editar</button><button class="btn btn-outline-success rounded-pill" onclick="Encuestas.openResultsTab('${survey.id}')"><i class="bi bi-graph-up me-1"></i>Resultados</button><button class="btn btn-outline-primary rounded-pill" onclick="Encuestas.launchSurveyToAll('${survey.id}')"><i class="bi bi-broadcast-pin me-1"></i>Lanzar</button>${survey.isPublic ? `<button class="btn btn-outline-secondary rounded-pill" onclick="Encuestas.showQR('${survey.id}')"><i class="bi bi-link-45deg me-1"></i>Link</button>` : ''}</div></div></div></div>`;
  }

  function renderResultadosTab(container) {
    const { state, helpers } = getShared();
    if (!state.surveys.length) {
      container.innerHTML = '<div class="card border-0 shadow-sm rounded-4"><div class="card-body p-5 text-center text-muted">Aun no hay encuestas para analizar.</div></div>';
      return;
    }

    container.innerHTML = `<section class="card border-0 shadow-sm rounded-4 mb-4"><div class="card-body p-4"><div class="row g-3 align-items-end"><div class="col-lg-8"><label class="form-label small fw-semibold">Selecciona una encuesta</label><select id="enc-result-select" class="form-select rounded-4" onchange="Encuestas.loadResults()"><option value="">-- Seleccionar --</option>${state.surveys.map((survey) => `<option value="${survey.id}" ${survey.id === state.selectedResultsSurveyId ? 'selected' : ''}>${helpers.esc(survey.title)} (${survey.analytics?.totalResponses || survey.responseCount || 0})</option>`).join('')}</select></div><div class="col-lg-4 d-flex justify-content-lg-end"><button class="btn btn-outline-primary rounded-pill" onclick="Encuestas.showHelp('results')"><i class="bi bi-info-circle me-1"></i>Como leer resultados</button></div></div></div></section><div id="enc-results-container"></div>`;
    if (state.selectedResultsSurveyId) window.Encuestas.loadResults();
  }

  function renderQuestionResult(question, bucket) {
    const { helpers } = getShared();
    if (!bucket) return '';

    if (question.type === 'open') {
      const texts = bucket.textAnswers || [];
      return `<section class="card border-0 shadow-sm rounded-4 mb-3"><div class="card-body p-4"><h6 class="fw-bold mb-2">${helpers.esc(question.text)}</h6><div class="small text-muted mb-3">${texts.length} respuestas abiertas</div><div class="d-grid gap-2">${texts.length ? texts.slice(0, 20).map((answer) => `<div class="rounded-4 p-3 bg-light-subtle small">"${helpers.esc(answer)}"</div>`).join('') : '<div class="text-muted small">Sin respuestas abiertas aun.</div>'}</div></div></section>`;
    }
 
    if (question.type === 'scale') {
      const answers = bucket.answers || {};
      const total = Object.values(answers).reduce((sum, value) => sum + Number(value), 0);
      const bars = Object.entries(answers).map(([value, count]) => {
        const percentage = total ? Math.round((Number(count) / total) * 100) : 0;
        return `<div class="d-flex align-items-center gap-2 mb-2"><span class="fw-semibold text-muted" style="min-width:28px;">${helpers.esc(value)}</span><div class="progress flex-grow-1" style="height:8px;"><div class="progress-bar bg-info" style="width:${percentage}%"></div></div><span class="small text-muted" style="min-width:48px;">${percentage}%</span></div>`;
      }).join('');
      return `<section class="card border-0 shadow-sm rounded-4 mb-3"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-start gap-3"><div><h6 class="fw-bold mb-1">${helpers.esc(question.text)}</h6><div class="small text-muted">Promedio general</div></div><div class="fw-bold fs-3 text-info">${bucket.average || '-'}</div></div><div class="mt-3">${bars || '<div class="small text-muted">Aun no hay datos.</div>'}</div></div></section>`;
    }

    const chartId = `enc-chart-${question.id}`;
    const total = Object.values(bucket.answers || {}).reduce((sum, value) => sum + Number(value), 0);
    const rows = Object.entries(bucket.answers || {}).map(([answer, count]) => {
      const percentage = total ? Math.round((Number(count) / total) * 100) : 0;
      return `<div class="d-flex align-items-center gap-2 mb-2"><span class="text-truncate small" style="max-width:220px;">${helpers.esc(answer)}</span><div class="progress flex-grow-1" style="height:8px;"><div class="progress-bar bg-primary" style="width:${percentage}%"></div></div><span class="small text-muted">${count}</span></div>`;
    }).join('');
    return `<section class="card border-0 shadow-sm rounded-4 mb-3"><div class="card-body p-4"><div class="row g-3 align-items-center"><div class="col-lg-8"><h6 class="fw-bold mb-3">${helpers.esc(question.text)}</h6>${rows || '<div class="small text-muted">Aun no hay respuestas.</div>'}</div><div class="col-lg-4"><canvas id="${chartId}" style="max-width:180px;max-height:180px;" class="mx-auto d-block"></canvas></div></div></div></section>`;
  }

  function renderResultsPanel(container, survey, stats, responses) {
    const { state, helpers } = getShared();
    Object.values(state.chartInstances).forEach((chart) => chart?.destroy?.());
    state.chartInstances = {};

    const total = stats?.total || 0;
    const careers = Object.keys(stats?.byCareers || {}).length;
    const roles = Object.keys(stats?.byRole || {}).length;
    const sourceBadges = Object.entries(stats?.bySource || {}).map(([source, count]) => `<span class="badge bg-light text-dark border rounded-pill">${helpers.esc(source)} · ${count}</span>`).join('') || '<span class="text-muted small">Sin fuentes registradas</span>';
    container.innerHTML = `<section class="row g-3 mb-4"><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-4 text-center"><div class="text-muted small text-uppercase">Respuestas</div><div class="fw-bold fs-2">${total}</div></div></div></div><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-4 text-center"><div class="text-muted small text-uppercase">Carreras</div><div class="fw-bold fs-2">${careers}</div></div></div></div><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-4 text-center"><div class="text-muted small text-uppercase">Roles</div><div class="fw-bold fs-2">${roles}</div></div></div></div><div class="col-md-3"><div class="card border-0 shadow-sm rounded-4"><div class="card-body p-4 text-center"><div class="text-muted small text-uppercase">Modo</div><div class="fw-bold">${helpers.esc(getDeliveryModeLabel(survey.delivery?.mandatoryMode || 'optional'))}</div></div></div></div></section><section class="card border-0 shadow-sm rounded-4 mb-4"><div class="card-body p-4"><div class="d-flex flex-column flex-lg-row justify-content-between gap-3"><div><h5 class="fw-bold mb-1">${helpers.esc(survey.title)}</h5><p class="text-muted mb-0">${helpers.esc(survey.description || 'Sin descripcion')}</p></div><div class="d-flex flex-wrap gap-2 align-items-start justify-content-lg-end">${sourceBadges}<button class="btn btn-outline-success rounded-pill" onclick="Encuestas.exportCSV('${survey.id}')"><i class="bi bi-download me-1"></i>Exportar CSV</button></div></div></div></section>${(survey.questions || []).map((question) => renderQuestionResult(question, stats.byQuestion?.[question.id])).join('')}<section class="card border-0 shadow-sm rounded-4 mt-4"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-center mb-3"><h6 class="fw-bold mb-0">Respuestas individuales</h6><span class="small text-muted">Mostrando hasta ${Math.min(responses.length, 50)} registros</span></div><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Nombre</th><th>Rol</th><th>Fecha</th><th>Fuente</th><th></th></tr></thead><tbody>${responses.slice(0, 50).map((response) => `<tr><td>${helpers.esc(response.userName || 'Anonimo')}</td><td>${helpers.esc(response.userRole || '-')}</td><td>${helpers.fmtDate(response.submittedAt)}</td><td>${helpers.esc(response.source || '-')}</td><td><button class="btn btn-sm btn-light rounded-pill" onclick="Encuestas.viewResponse('${encodeURIComponent(JSON.stringify(response.answers || {}))}','${survey.id}')">Ver</button></td></tr>`).join('')}</tbody></table></div></div></section>`;

    setTimeout(() => renderCharts(survey, stats), 80);
  }

  function renderCharts(survey, stats) {
    const { state } = getShared();
    if (typeof Chart === 'undefined') return;

    const palette = ['#0d6efd', '#198754', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#6b7280'];
    (survey.questions || []).forEach((question) => {
      if (question.type === 'open' || question.type === 'scale') return;
      const bucket = stats.byQuestion?.[question.id];
      const canvas = document.getElementById(`enc-chart-${question.id}`);
      if (!bucket || !canvas) return;
      const labels = Object.keys(bucket.answers || {});
      const data = Object.values(bucket.answers || {});

      state.chartInstances[question.id] = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: labels.map((_, index) => palette[index % palette.length]), borderWidth: 0 }] },
        options: { plugins: { legend: { display: false } }, cutout: '58%', responsive: true, maintainAspectRatio: true }
      });
    });
  }

  function getDeliveryModeLabel(mode) {
    if (mode === 'blocking') return 'Bloquea acceso';
    if (mode === 'required') return 'Respuesta requerida';
    return 'Opcional';
  }

  function getStudentFilterOptions(feed) {
    const counts = feed?.counts || {};
    return [
      { id: 'pending', label: 'Pendientes', hint: 'Aun no las respondes', count: counts.pending || 0, tone: 'primary', icon: 'bi-hourglass-split' },
      { id: 'mandatory', label: 'Respuesta requerida', hint: 'Importantes, pero no bloquean acceso de inmediato', count: counts.mandatory || 0, tone: 'warning', icon: 'bi-exclamation-circle-fill' },
      { id: 'blocking', label: 'Debes responder ahora', hint: 'Estas si bloquean acceso hasta responder', count: counts.blocking || 0, tone: 'danger', icon: 'bi-shield-lock-fill' },
      { id: 'completed', label: 'Historial', hint: 'Encuestas ya respondidas', count: counts.completed || 0, tone: 'success', icon: 'bi-check2-circle' },
      { id: 'all', label: 'Todo', hint: 'Pendientes e historial en un solo lugar', count: counts.all || 0, tone: 'secondary', icon: 'bi-collection' }
    ];
  }

  function renderStudentPriorityBanner(feed) {
    const { helpers } = getShared();
    const blocking = feed?.blocking || [];
    const mandatory = feed?.mandatory || [];

    if (blocking.length) {
      const titles = blocking.slice(0, 3).map((survey) => `<span class="badge rounded-pill bg-danger-subtle text-danger">${helpers.esc(survey.title)}</span>`).join('');
      return `
        <section class="card border-0 shadow-sm rounded-4 mb-4 border border-danger border-opacity-25">
          <div class="card-body p-4">
            <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
              <div>
                <span class="badge bg-danger-subtle text-danger rounded-pill mb-2">Atencion inmediata</span>
                <h5 class="fw-bold mb-1">Tienes ${blocking.length} encuesta${blocking.length === 1 ? '' : 's'} que ${blocking.length === 1 ? 'bloquea' : 'bloquean'} acceso</h5>
                <p class="text-muted mb-2">Mientras sigan pendientes, SIA puede pedirte responderlas antes de continuar en otros flujos.</p>
                <div class="d-flex flex-wrap gap-2">${titles}</div>
              </div>
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-danger rounded-pill" onclick="Encuestas.openStudentSurvey('${blocking[0].id}')"><i class="bi bi-pencil-square me-1"></i>Responder la principal</button>
                <button class="btn btn-outline-danger rounded-pill" onclick="Encuestas.setStudentFilter('blocking')"><i class="bi bi-funnel me-1"></i>Ver todas</button>
              </div>
            </div>
          </div>
        </section>`;
    }

    if (mandatory.length) {
      return `
        <section class="card border-0 shadow-sm rounded-4 mb-4 border border-warning border-opacity-25">
          <div class="card-body p-4">
            <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
              <div>
                <span class="badge bg-warning-subtle text-warning rounded-pill mb-2">Seguimiento recomendado</span>
                <h5 class="fw-bold mb-1">Hay ${mandatory.length} encuesta${mandatory.length === 1 ? '' : 's'} con respuesta requerida</h5>
                <p class="text-muted mb-0">No bloquean de inmediato, pero conviene resolverlas pronto para mantener tu tablero al dia.</p>
              </div>
              <button class="btn btn-outline-warning rounded-pill" onclick="Encuestas.setStudentFilter('mandatory')"><i class="bi bi-list-check me-1"></i>Ver requeridas</button>
            </div>
          </div>
        </section>`;
    }

    return `
      <section class="card border-0 shadow-sm rounded-4 mb-4">
        <div class="card-body p-4 d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
          <div>
            <span class="badge bg-success-subtle text-success rounded-pill mb-2">Sin urgencias</span>
            <h5 class="fw-bold mb-1">No tienes encuestas que bloqueen acceso</h5>
            <p class="text-muted mb-0">Puedes revisar pendientes o consultar tu historial cuando lo necesites.</p>
          </div>
          <button class="btn btn-outline-success rounded-pill" onclick="Encuestas.setStudentFilter('pending')"><i class="bi bi-hourglass-split me-1"></i>Revisar pendientes</button>
        </div>
      </section>`;
  }

  function renderStudentShell() {
    return `
      <div id="enc-student-app" class="animate-fade-in">
        <section class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
          <div class="p-4 p-lg-5" style="background:linear-gradient(135deg,#064e3b 0%,#0891b2 60%,#0f766e 100%);color:white;">
            <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <span class="badge text-success rounded-pill mb-3">Centro de Encuestas</span>
                <h2 class="fw-bold mb-2 filter-white">Encuestas del campus</h2>
                <p class="mb-0 opacity-75" style="max-width:720px;">Aqui puedes ver las todas las encuestas que se realizan en ITES</p>
              </div>
              <div class="rounded-4 bg-opacity-10 p-3 align-self-start">
                <div class="small text-uppercase opacity-75">Resumen</div>
                <div class="fw-bold fs-5" id="enc-student-summary-label">Cargando...</div>
              </div>
            </div>
          </div>
        </section>
        <section class="row g-3 mb-4" id="enc-student-kpis">
          <div class="col-12 text-center py-4 text-muted"><span class="spinner-border spinner-border-sm text-primary me-2"></span>Cargando encuestas...</div>
        </section>
        <div id="enc-student-priority"></div>
        <section class="card border-0 shadow-sm rounded-4 mb-4">
          <div class="card-body p-3 p-lg-4">
            <div class="row g-3 align-items-start">
              <div class="col-lg-4">
                <label class="form-label small fw-semibold">Buscar encuesta</label>
                <div class="input-group">
                  <span class="input-group-text bg-transparent border-end-0 rounded-start-4"><i class="bi bi-search"></i></span>
                  <input id="enc-student-search" class="form-control border-start-0 rounded-end-4" placeholder="Titulo o descripcion" oninput="Encuestas.setStudentQuery(this.value)">
                </div>
                <div class="small text-muted mt-2">Usa palabras clave para encontrar una encuesta especifica en tus pendientes o historial.</div>
              </div>
              <div class="col-lg-8">
                <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <h5 class="fw-bold mb-1">Mis encuestas</h5>
                    <p class="text-muted small mb-0">Los filtros te dicen claramente si debes responder ahora, si solo es seguimiento o si ya quedo como historial.</p>
                  </div>
                </div>
                <div class="row g-2" id="enc-student-filters"></div>
              </div>
            </div>
          </div>
        </section>
        <div id="enc-student-list"></div>
      </div>`;
  }

  function renderStudentSurveyCard(survey) {
    const { helpers } = getShared();
    const status = survey.responded
      ? { label: 'Respondida', badge: 'bg-success-subtle text-success' }
      : survey.blocking
        ? { label: 'Debes responder ahora', badge: 'bg-danger-subtle text-danger' }
        : survey.isMandatory
          ? { label: 'Respuesta requerida', badge: 'bg-warning-subtle text-warning' }
          : { label: 'Disponible', badge: 'bg-primary-subtle text-primary' };
    const historyBadge = survey.responded && survey.runtimeStatus && survey.runtimeStatus !== 'active'
      ? (survey.runtimeStatus === 'closed' ? 'Cerrada' : (survey.runtimeStatus === 'archived' ? 'Archivada' : 'Historial'))
      : '';
    const hasDraft = !!Object.keys(helpers.loadDraftAnswers(survey.id) || {}).length;
    const dueTitle = survey.responded ? 'Respondida el' : 'Vigencia';
    const dueLabel = survey.responded
      ? helpers.fmtDate(survey.response?.submittedAt, false)
      : (survey.scheduling?.endDate ? helpers.fmtDate(survey.scheduling.endDate, false) : 'Sin fecha limite');
    const modeLabel = survey.responded ? 'Historial' : (survey.blocking ? 'Urgente' : (survey.isMandatory ? 'Requerida' : 'Opcional'));
    const urgencyCopy = survey.responded
      ? 'Esta respuesta queda guardada para consulta dentro de tu historial.'
      : survey.blocking
        ? 'Necesitas responderla para seguir usando ciertas acciones de SIA.'
        : survey.isMandatory
          ? 'Conviene responderla pronto para no dejar seguimiento pendiente.'
          : 'Puedes responderla cuando tengas un momento disponible.';
    const cta = survey.responded ? 'Abrir resumen' : (hasDraft ? 'Continuar borrador' : (survey.blocking ? 'Responder ahora' : 'Responder'));
    const buttonClass = survey.responded ? 'btn-outline-secondary' : (survey.blocking ? 'btn-danger' : 'btn-primary');

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card border-0 shadow-sm rounded-4 h-100 ${survey.blocking && !survey.responded ? 'border border-danger border-opacity-25' : ''}">
          <div class="card-body p-4 d-flex flex-column">
            <div class="d-flex flex-wrap gap-2 mb-3">
              <span class="badge rounded-pill ${status.badge}">${status.label}</span>
              ${historyBadge ? `<span class="badge bg-dark-subtle text-dark rounded-pill">${historyBadge}</span>` : ''}
              ${survey.delivery?.showInStories !== false ? '<span class="badge bg-secondary-subtle text-secondary rounded-pill">Novedades</span>' : ''}
              ${hasDraft && !survey.responded ? '<span class="badge bg-info-subtle text-info rounded-pill">Borrador</span>' : ''}
            </div>
            <h5 class="fw-bold mb-1">${helpers.esc(survey.title)}</h5>
            <p class="text-muted small mb-3">${helpers.esc(survey.description || 'Comparte tu experiencia en pocos minutos.')}</p>
            <div class="small mb-3 ${survey.blocking && !survey.responded ? 'text-danger-emphasis' : 'text-muted'}">
              <i class="bi ${survey.blocking && !survey.responded ? 'bi-shield-lock-fill' : 'bi-info-circle-fill'} me-1"></i>${helpers.esc(urgencyCopy)}
            </div>
            <div class="row g-2 mb-4">
              <div class="col-6 col-lg-4">
                <div class="rounded-4 bg-light-subtle p-3 h-100">
                  <div class="small text-muted">Preguntas</div>
                  <div class="fw-semibold">${(survey.questions || []).length}</div>
                </div>
              </div>
              <div class="col-6 col-lg-4">
                <div class="rounded-4 bg-light-subtle p-3 h-100">
                  <div class="small text-muted">${dueTitle}</div>
                  <div class="fw-semibold">${helpers.esc(dueLabel)}</div>
                </div>
              </div>
              <div class="col-12 col-lg-4">
                <div class="rounded-4 bg-light-subtle p-3 h-100">
                  <div class="small text-muted">Tipo</div>
                  <div class="fw-semibold">${helpers.esc(modeLabel)}</div>
                </div>
              </div>
            </div>
            <div class="mt-auto d-flex flex-wrap gap-2">
              <button class="btn ${buttonClass} rounded-pill flex-grow-1" onclick="Encuestas.openStudentSurvey('${survey.id}')">
                <i class="bi ${survey.responded ? 'bi-eye-fill' : 'bi-pencil-square'} me-1"></i>${cta}
              </button>
              ${hasDraft && !survey.responded ? `<button class="btn btn-light rounded-pill border" onclick="localStorage.removeItem('${helpers.getDraftKey(survey.id)}'); Encuestas.initStudentView();"><i class="bi bi-trash me-1"></i>Limpiar</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderStudentFeed() {
    const { state } = getShared();
    const list = document.getElementById('enc-student-list');
    const kpis = document.getElementById('enc-student-kpis');
    const priority = document.getElementById('enc-student-priority');
    const filters = document.getElementById('enc-student-filters');
    const searchInput = document.getElementById('enc-student-search');
    if (!list || !kpis || !priority || !filters) return;

    const feed = state.studentFeed || {
      all: [],
      pending: [],
      completed: [],
      mandatory: [],
      blocking: [],
      counts: { all: 0, pending: 0, completed: 0, mandatory: 0, blocking: 0 }
    };
    const counts = feed.counts || {};
    const query = String(state.studentQuery || '').trim().toLowerCase();
    const summaryLabel = document.getElementById('enc-student-summary-label');
    if (summaryLabel) {
      if (counts.blocking) summaryLabel.textContent = `${counts.blocking} urgentes · ${counts.pending} por responder`;
      else if (counts.mandatory) summaryLabel.textContent = `${counts.pending} por responder · ${counts.mandatory} requeridas`;
      else if (counts.pending) summaryLabel.textContent = `${counts.pending} por responder`;
      else summaryLabel.textContent = 'Sin pendientes';
    }

    const cards = [
      { label: 'Por responder', value: counts.pending || 0, tone: 'primary', icon: 'bi-hourglass-split' },
      { label: 'Requeridas', value: counts.mandatory || 0, tone: 'warning', icon: 'bi-exclamation-diamond-fill' },
      { label: 'Bloquean acceso', value: counts.blocking || 0, tone: 'danger', icon: 'bi-lock-fill' },
      { label: 'En historial', value: counts.completed || 0, tone: 'success', icon: 'bi-check2-circle' }
    ];
    kpis.innerHTML = cards.map((card) => `<div class="col-6 col-lg-3"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-3 text-center"><i class="bi ${card.icon} text-${card.tone} fs-4 d-block mb-2"></i><div class="fw-bold fs-3 mb-0">${card.value}</div><div class="extra-small text-muted text-uppercase">${card.label}</div></div></div></div>`).join('');
    priority.innerHTML = renderStudentPriorityBanner(feed);

    if (searchInput && searchInput.value !== state.studentQuery) {
      searchInput.value = state.studentQuery || '';
    }

    const filterOptions = getStudentFilterOptions(feed);
    filters.innerHTML = filterOptions.map((filter) => {
      const active = filter.id === state.studentFilter;
      const activeClass = active ? `btn-${filter.tone}` : 'btn-light';
      const textClass = active && filter.tone === 'warning' ? 'text-dark' : '';
      return `
        <div class="col-md-6 col-xl">
          <button class="btn ${activeClass} ${textClass} border rounded-4 w-100 h-100 text-start p-3 student-filter-btn shadow-sm" data-filter="${filter.id}" onclick="Encuestas.setStudentFilter('${filter.id}')">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
              <span class="fw-semibold"><i class="bi ${filter.icon} me-1"></i>${filter.label}</span>
              <span class="badge rounded-pill ${active ? 'bg-light text-dark' : `bg-${filter.tone}-subtle text-${filter.tone}`}">${filter.count}</span>
            </div>
            <div class="small ${active ? (filter.tone === 'warning' ? 'text-dark opacity-75' : 'text-white-50') : 'text-muted'}">${filter.hint}</div>
          </button>
        </div>`;
    }).join('');

    let surveys = [];
    if (state.studentFilter === 'all') surveys = feed.all || [];
    else if (state.studentFilter === 'completed') surveys = feed.completed || [];
    else if (state.studentFilter === 'mandatory') surveys = feed.mandatory || [];
    else if (state.studentFilter === 'blocking') surveys = feed.blocking || [];
    else surveys = feed.pending || [];

    if (query) {
      surveys = surveys.filter((survey) => `${survey.title || ''} ${survey.description || ''} ${survey.runtimeStatus || ''}`.toLowerCase().includes(query));
    }

    surveys = [...surveys].sort((left, right) => {
      const leftPriority = left.responded ? 3 : (left.blocking ? 0 : (left.isMandatory ? 1 : 2));
      const rightPriority = right.responded ? 3 : (right.blocking ? 0 : (right.isMandatory ? 1 : 2));
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftTime = left.responded
        ? (left.response?.submittedAt?.getTime?.() || left.updatedAt?.getTime?.() || left.createdAt?.getTime?.() || 0)
        : (left.createdAt?.getTime?.() || 0);
      const rightTime = right.responded
        ? (right.response?.submittedAt?.getTime?.() || right.updatedAt?.getTime?.() || right.createdAt?.getTime?.() || 0)
        : (right.createdAt?.getTime?.() || 0);
      return rightTime - leftTime;
    });

    if (!surveys.length) {
      const emptyLabel = {
        pending: 'No tienes encuestas por responder.',
        mandatory: 'No hay encuestas con respuesta requerida.',
        blocking: 'No hay encuestas que bloqueen acceso en este momento.',
        completed: 'Aun no has generado historial de encuestas.',
        all: 'No hay encuestas disponibles por ahora.'
      };
      const message = query
        ? `No encontramos encuestas que coincidan con "${state.studentQuery}".`
        : (emptyLabel[state.studentFilter] || emptyLabel.all);
      list.innerHTML = `<div class="card border-0 shadow-sm rounded-4"><div class="card-body p-5 text-center text-muted"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i><div>${message}</div></div></div>`;
      return;
    }

    list.innerHTML = `<div class="row g-3">${surveys.map((survey) => renderStudentSurveyCard(survey)).join('')}</div>`;
    window.UI?.initTooltips?.();
  }

  function renderServiceDashboard(surveyMap, stats, serviceTypes) {
    const { helpers } = getShared();
    return `
      <section class="card border-0 shadow-sm rounded-4 mb-4">
        <div class="card-body p-4">
          <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <div class="d-flex align-items-center gap-2 mb-2">
                <h5 class="fw-bold mb-0">Encuestas de servicio</h5>
                ${helpers.renderInfoButton('services')}
              </div>
              <p class="text-muted mb-0">Controla encuestas de satisfaccion para biblioteca, servicio medico y psicologia, incluyendo lanzamientos globales.</p>
            </div>
            <div class="rounded-4 bg-light-subtle p-3 border">
              <div class="small text-uppercase text-muted">Respuestas totales</div>
              <div class="fw-bold fs-4">${stats.totalResponses || 0}</div>
            </div>
          </div>
        </div>
      </section>
      <section class="row g-3 mb-4">
        <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-3 text-center"><div class="fw-bold fs-3">${stats.totalSurveys || 0}</div><div class="small text-muted">Configuradas</div></div></div></div>
        <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-3 text-center"><div class="fw-bold fs-3 text-success">${stats.enabled || 0}</div><div class="small text-muted">Habilitadas</div></div></div></div>
        <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-3 text-center"><div class="fw-bold fs-3 text-warning">${stats.disabled || 0}</div><div class="small text-muted">Deshabilitadas</div></div></div></div>
        <div class="col-6 col-lg-3"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-3 text-center"><div class="fw-bold fs-3 text-info">${serviceTypes.filter((type) => surveyMap[type]?.config?.showToAll).length}</div><div class="small text-muted">Globales activas</div></div></div></div>
      </section>
      <div class="row g-3">
        ${serviceTypes.map((serviceType) => {
          const survey = surveyMap[serviceType];
          const meta = helpers.getServiceMeta(serviceType);
          const totalResponses = survey?.analytics?.totalResponses || survey?.responseCount || 0;
          const notUsedCount = survey?.analytics?.notUsedCount || 0;
          const enabled = !!survey?.enabled;
          return `
            <div class="col-md-6 col-xl-4">
              <div class="card border-0 shadow-sm rounded-4 h-100">
                <div class="card-body p-4 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div class="d-flex gap-3">
                      <div class="rounded-circle bg-${meta.tone} bg-opacity-10 d-flex align-items-center justify-content-center" style="width:52px;height:52px;">
                        <i class="bi ${meta.icon} text-${meta.tone} fs-4"></i>
                      </div>
                      <div>
                        <h6 class="fw-bold mb-1">${meta.name}</h6>
                        <div class="small text-muted">${enabled ? 'Habilitada' : 'Deshabilitada'}${survey?.config?.showToAll ? ' · Global activa' : ''}</div>
                      </div>
                    </div>
                    <span class="badge rounded-pill ${enabled ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">${enabled ? 'Activa' : 'Pausada'}</span>
                  </div>
                  <p class="text-muted small mb-3">${helpers.esc(survey?.description || 'Aun no hay una configuracion personalizada para este servicio.')}</p>
                  <div class="row g-2 mb-4">
                    <div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Frecuencia</div><div class="fw-semibold">${helpers.esc(helpers.getFrequencyLabel(survey?.config?.frequency))}</div></div></div>
                    <div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Respuestas</div><div class="fw-semibold">${totalResponses}</div></div></div>
                    <div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">Preguntas</div><div class="fw-semibold">${(survey?.questions || []).length}</div></div></div>
                    <div class="col-6"><div class="rounded-4 bg-light-subtle p-3 h-100"><div class="small text-muted">No usado</div><div class="fw-semibold">${notUsedCount}</div></div></div>
                  </div>
                  <div class="d-flex flex-wrap gap-2 mt-auto">
                    <button class="btn btn-outline-${meta.tone} rounded-pill flex-grow-1" onclick="Encuestas.openServiceEditor('${serviceType}')"><i class="bi bi-sliders me-1"></i>${survey ? 'Editar' : 'Configurar'}</button>
                    ${survey ? `<button class="btn btn-outline-success rounded-pill" onclick="Encuestas.viewServiceResults('${serviceType}')"><i class="bi bi-graph-up me-1"></i>Resultados</button>` : ''}
                  </div>
                  <div class="d-flex flex-wrap gap-2 mt-2">
                    ${survey?.config?.showToAll
                      ? `<button class="btn btn-danger rounded-pill flex-grow-1" onclick="Encuestas.deactivateServiceSurveyToAll('${serviceType}')"><i class="bi bi-stop-circle me-1"></i>Detener global</button>`
                      : `<button class="btn btn-outline-warning rounded-pill flex-grow-1" onclick="Encuestas.triggerServiceSurveyToAll('${serviceType}')"><i class="bi bi-broadcast-pin me-1"></i>Lanzar global</button>`}
                    ${survey ? `<div class="form-check form-switch d-flex align-items-center ms-auto pt-2"><input class="form-check-input" type="checkbox" id="svc-toggle-${serviceType}" ${enabled ? 'checked' : ''} onchange="Encuestas.toggleServiceSurveyStatus('${serviceType}', this.checked)"><label class="form-check-label small ms-2" for="svc-toggle-${serviceType}">${enabled ? 'Habilitada' : 'Deshabilitada'}</label></div>` : ''}
                  </div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function showHelp(topic) {
    const { constants, helpers } = getShared();
    const help = constants.HELP_TOPICS[topic] || {
      title: 'Ayuda del modulo',
      body: 'Esta accion forma parte del flujo principal de administracion de encuestas.'
    };

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 rounded-4 shadow-lg">
            <div class="modal-header border-0 bg-light">
              <div>
                <span class="badge bg-info-subtle text-info rounded-pill mb-2">Ayuda contextual</span>
                <h5 class="fw-bold mb-0">${helpers.esc(help.title)}</h5>
              </div>
              <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-muted mb-0">${helpers.esc(help.body)}</p>
            </div>
            <div class="modal-footer border-0">
              <button class="btn btn-primary rounded-pill px-4" data-bs-dismiss="modal">Entendido</button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(wrapper);
    const modalEl = wrapper.querySelector('.modal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
  }

  return {
    renderPublicState,
    renderAdminShell,
    renderCreateTab,
    renderSurveyCard,
    renderResultadosTab,
    renderQuestionResult,
    renderResultsPanel,
    renderCharts,
    renderStudentShell,
    renderStudentSurveyCard,
    renderStudentFeed,
    renderServiceDashboard,
    showHelp
  };
})();
