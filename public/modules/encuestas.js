// modules/encuestas.js - Módulo de Encuestas (Calidad)
console.log("✅ [LOAD] modules/encuestas.js loaded");

if (!window.Encuestas) {
  window.Encuestas = (function () {
    let _ctx = null, _profile = null, _isAdmin = false, _surveys = [], _currentTab = 'crear';
    const show = el => el?.classList.remove('d-none');
    const hide = el => el?.classList.add('d-none');
    const fmtDate = d => { if (!d) return '-'; const dt = d.toDate ? d.toDate() : new Date(d); return isNaN(dt) ? '-' : dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
    const QUESTION_TYPES = [
      { id: 'multiple', label: 'Opción Múltiple', icon: 'bi-list-check', color: 'text-primary' },
      { id: 'open', label: 'Texto Abierto', icon: 'bi-chat-text', color: 'text-success' },
      { id: 'boolean', label: 'Verdadero / Falso', icon: 'bi-toggle-on', color: 'text-warning' },
      { id: 'scale', label: 'Escala Numérica', icon: 'bi-speedometer2', color: 'text-info' }
    ];
    let _questionCounter = 0;
    let _chartInstances = {};

    // ========== INIT ==========
    async function init(ctx) {
      console.log("[Encuestas] init", ctx);
      _ctx = ctx; _profile = ctx.profile;
      _isAdmin = _profile.permissions?.encuestas === 'admin' || _profile.email === 'calidad@loscabos.tecnm.mx';
      const container = document.getElementById('view-encuestas');
      if (!container) return;
      container.innerHTML = _isAdmin ? renderAdminShell() : renderStudentShell();
      _isAdmin ? initAdminView() : initStudentView();
    }

    // ========== PUBLIC SURVEY INIT (no auth) ==========
    async function initPublic(surveyId) {
      console.log("[Encuestas] initPublic", surveyId);
      const container = document.getElementById('view-encuesta-publica');
      if (!container) return;
      container.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-primary"></span></div>';
      try {
        const db = firebase.firestore();
        const survey = await EncuestasService.getSurveyByIdPublic(db, surveyId);
        if (!survey) { container.innerHTML = renderPublicError(); return; }
        const spamKey = 'sia_enc_pub_' + surveyId;
        if (localStorage.getItem(spamKey)) { container.innerHTML = renderPublicAlreadyDone(); return; }
        renderPublicSurvey(container, survey, spamKey);
      } catch (e) { container.innerHTML = renderPublicError(); }
    }

    function renderPublicError() {
      return `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-center">
    <i class="bi bi-exclamation-triangle fs-1 text-warning mb-3"></i>
    <h4 class="fw-bold">Encuesta no disponible</h4>
    <p class="text-muted">Esta encuesta no existe o ya fue cerrada.</p></div>`;
    }
    function renderPublicAlreadyDone() {
      return `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-center">
    <i class="bi bi-check-circle fs-1 text-success mb-3"></i>
    <h4 class="fw-bold">¡Ya participaste!</h4>
    <p class="text-muted">Gracias por responder esta encuesta.</p></div>`;
    }

    function renderPublicSurvey(container, survey, spamKey) {
      container.innerHTML = `
    <div class="container py-4" style="max-width:700px">
      <div class="text-center mb-4">
        <img src="/assets/logo_tecnm.webp" alt="TecNM" style="height:50px" class="mb-2" onerror="this.style.display='none'">
        <h3 class="fw-bold">${survey.title}</h3>
        <p class="text-muted">${survey.description || ''}</p>
        <span class="badge bg-success-subtle text-success">Encuesta Pública</span>
      </div>
      <div class="card border-0 shadow rounded-4 p-4 mb-3">
        <div class="mb-3"><label class="form-label small fw-bold">Nombre (opcional)</label>
          <input class="form-control rounded-3" id="pub-name" placeholder="Tu nombre"></div>
        <div class="mb-4"><label class="form-label small fw-bold">Correo (opcional)</label>
          <input class="form-control rounded-3" id="pub-email" placeholder="correo@ejemplo.com"></div>
        <hr>
        <div id="pub-questions">${renderQuestionsHTML(survey.questions)}</div>
      </div>
      <div class="d-grid"><button class="btn btn-primary btn-lg rounded-pill fw-bold py-3" id="pub-submit-btn" onclick="Encuestas.submitPublicSurvey('${survey.id}','${spamKey}')">
        <i class="bi bi-send me-2"></i>Enviar Respuestas</button></div>
    </div>`;
    }

    async function submitPublicSurvey(surveyId, spamKey) {
      const btn = document.getElementById('pub-submit-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
      try {
        const db = firebase.firestore();
        const survey = await EncuestasService.getSurveyByIdPublic(db, surveyId);
        const answers = collectAnswers(survey.questions, 'pub-questions');
        if (!answers) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Enviar Respuestas'; return; }
        await EncuestasService.submitPublicResponse(db, surveyId, answers, {
          name: document.getElementById('pub-name')?.value || '',
          email: document.getElementById('pub-email')?.value || ''
        });
        localStorage.setItem(spamKey, '1');
        document.getElementById('view-encuesta-publica').innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center py-5 text-center animate-fade-in">
        <div class="mb-3" style="font-size:4rem">🎉</div>
        <h3 class="fw-bold">¡Gracias por participar!</h3>
        <p class="text-muted">Tu respuesta ha sido registrada exitosamente.</p></div>`;
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Enviar Respuestas'; }
    }

    // ========== RENDER QUESTIONS HTML (shared) ==========
    function renderQuestionsHTML(questions, prefix) {
      prefix = prefix || 'q';
      return questions.map((q, i) => {
        let input = '';
        if (q.type === 'multiple') {
          input = (q.options || []).map((o, j) => `
        <div class="form-check custom-option-card mb-2 p-0 position-relative">
            <input class="form-check-input position-absolute top-50 start-0 translate-middle-y ms-3" type="radio" name="${prefix}_${q.id}" id="${prefix}_${q.id}_${j}" value="${o}" style="z-index:1;">
            <label class="form-check-label d-block p-3 ps-5 rounded-3 border bg-white hover-bg-light cursor-pointer transition-all" for="${prefix}_${q.id}_${j}">
                ${o}
            </label>
        </div>`).join('');
        } else if (q.type === 'boolean') {
          input = `<div class="d-flex gap-3">
        <div class="flex-fill">
            <input type="radio" class="btn-check" name="${prefix}_${q.id}" id="${prefix}_${q.id}_t" value="true" autocomplete="off">
            <label class="btn btn-outline-success w-100 rounded-pill py-2 fw-medium" for="${prefix}_${q.id}_t"><i class="bi bi-hand-thumbs-up me-2"></i>Verdadero / Pasó</label>
        </div>
        <div class="flex-fill">
            <input type="radio" class="btn-check" name="${prefix}_${q.id}" id="${prefix}_${q.id}_f" value="false" autocomplete="off">
            <label class="btn btn-outline-danger w-100 rounded-pill py-2 fw-medium" for="${prefix}_${q.id}_f"><i class="bi bi-hand-thumbs-down me-2"></i>Falso / No pasó</label>
        </div>
        </div>`;
        } else if (q.type === 'scale') {
          const min = q.min || 1, max = q.max || 10;
          const mid = Math.ceil((max - min) / 2) + min;
          const steps = [];
          for (let v = min; v <= max; v++) {
            // Gradient color generation could be cool but keep it simple for now
            steps.push(`<button type="button" class="btn btn-outline-primary flex-fill scale-btn rounded-3 py-2 fw-bold" data-val="${v}" onclick="this.parentNode.querySelectorAll('.scale-btn').forEach(b=>b.classList.remove('btn-primary','active'));this.classList.add('btn-primary','active');this.classList.remove('btn-outline-primary');document.getElementById('${prefix}_${q.id}_input').value=${v};document.getElementById('${prefix}_${q.id}_val').textContent=${v}">${v}</button>`);
          }
          input = `<input type="hidden" id="${prefix}_${q.id}_input" value="${mid}">
          <div class="d-flex gap-1 mb-3 bg-light p-2 rounded-3">${steps.join('')}</div>
          <div class="d-flex justify-content-between text-muted extra-small">
              <span>Peor calificación</span>
              <span class="fw-bold text-primary fs-5" id="${prefix}_${q.id}_val">${mid}</span>
              <span>Mejor calificación</span>
          </div>`;
        } else {
          input = `<textarea class="form-control rounded-3 bg-light border-0" id="${prefix}_${q.id}_input" rows="3" placeholder="Escribe tu respuesta aquí..."></textarea>`;
        }

        return `<div class="card border-0 shadow-sm rounded-4 mb-4 animate-fade-in" data-qid="${q.id}">
        <div class="card-body p-4">
            <div class="d-flex align-items-center mb-3">
                 <span class="badge bg-primary bg-gradient rounded-circle shadow-sm me-3 fs-5" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
                 <h5 class="fw-bold mb-0 text-dark">${q.text}</h5>
                 ${q.required ? '<span class="text-danger ms-2 fs-5" title="Requerida">*</span>' : ''}
            </div>
            <div class="ms-lg-5">${input}</div>
        </div>
        </div>`;
      }).join('');
    }

    function collectAnswers(questions, containerId, paginator = null) {
      if (paginator) {
        // Guardar las respuestas de la página actual antes de recolectar todo
        paginator.saveCurrentPage();

        // Verificar validez (si required no está en answers)
        let valid = true;
        questions.forEach(q => {
          if (q.required) {
            const val = paginator.answers[q.id];
            if (val === undefined || val === null || val === '') valid = false;
          }
        });
        if (!valid) {
          alert('Por favor responde todas las preguntas obligatorias antes de enviar.');
          return null;
        }
        return paginator.answers;
      }

      // Fallback para recolectar directo del DOM si no se usa paginador
      const c = document.getElementById(containerId);
      const answers = {};
      let valid = true;
      questions.forEach(q => {
        if (q.type === 'multiple' || q.type === 'boolean') {
          const sel = c.querySelector(`input[name$="_${q.id}"]:checked`);
          if (sel) { answers[q.id] = q.type === 'boolean' ? sel.value === 'true' : sel.value; }
          else if (q.required) { valid = false; }
        } else if (q.type === 'scale') {
          const el = c.querySelector(`[id$="_${q.id}_input"]`);
          answers[q.id] = el ? Number(el.value) : null;
        } else {
          const el = c.querySelector(`[id$="_${q.id}_input"]`);
          const val = el?.value?.trim() || '';
          if (q.required && !val) valid = false;
          answers[q.id] = val;
        }
      });
      if (!valid) { alert('Por favor responde todas las preguntas obligatorias.'); return null; }
      return answers;
    }

    // ========== ADMIN SHELL ==========
    function renderAdminShell() {
      return `<style>
    #enc-app .tab-btn{transition:all .2s;border-bottom:3px solid transparent;color:#6c757d}
    #enc-app .tab-btn.active{color:#0d6efd;border-bottom-color:#0d6efd;font-weight:700}
    #enc-app .tab-btn:hover{color:#0d6efd}
    #enc-app .enc-card{transition:all .2s;cursor:pointer}#enc-app .enc-card:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.1)!important}
    #enc-app .q-builder-item{animation:fadeIn .3s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  </style>
  <div id="enc-app" class="animate-fade-in">
    <div class="hero-banner-v2 shadow-sm mb-4" style="background:linear-gradient(135deg,#0d6efd 0%,#6610f2 100%)">
      <div class="hero-content-v2 text-white">
        <span class="badge bg-white text-primary mb-2 fw-bold"><i class="bi bi-clipboard-data me-1"></i>Calidad</span>
        <h2 class="fw-bold mb-1">Centro de Encuestas</h2>
        <p class="small opacity-75 mb-0">Crea, gestiona y analiza encuestas institucionales</p>
      </div><i class="bi bi-clipboard2-check-fill hero-bg-icon-v2 text-white opacity-25"></i>
    </div>
    <div class="row g-3 mb-4" id="enc-admin-kpis"><div class="col-12 text-center py-3 text-muted"><span class="spinner-border spinner-border-sm"></span></div></div>
    <div class="d-flex gap-3 mb-4 border-bottom overflow-auto pb-0">
      <button class="btn btn-link tab-btn active text-decoration-none px-3 py-2" data-tab="crear" onclick="Encuestas.switchTab('crear')"><i class="bi bi-plus-circle me-1"></i>Crear</button>
      <button class="btn btn-link tab-btn text-decoration-none px-3 py-2" data-tab="gestionar" onclick="Encuestas.switchTab('gestionar')"><i class="bi bi-kanban me-1"></i>Mis Encuestas</button>
      <button class="btn btn-link tab-btn text-decoration-none px-3 py-2" data-tab="resultados" onclick="Encuestas.switchTab('resultados')"><i class="bi bi-graph-up me-1"></i>Resultados</button>
      <button class="btn btn-link tab-btn text-decoration-none px-3 py-2" data-tab="servicios" onclick="Encuestas.switchTab('servicios')"><i class="bi bi-heart-pulse me-1"></i>Encuestas de Servicio</button>
    </div>
    <div id="enc-tab-content"></div>
  </div>
  ${renderCreateModal()}
  ${renderQRModal()}`;
    }

    function switchTab(tab) {
      _currentTab = tab;
      document.querySelectorAll('#enc-app .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      const content = document.getElementById('enc-tab-content');
      if (tab === 'crear') renderCrearTab(content);
      else if (tab === 'gestionar') renderGestionarTab(content);
      else if (tab === 'resultados') renderResultadosTab(content);
      else if (tab === 'servicios') renderEncuestasServicioTab(content);
    }

    async function initAdminView() {
      loadAdminKPIs();
      switchTab('crear');
    }

    async function loadAdminKPIs() {
      try {
        const stats = await EncuestasService.getOverviewStats(_ctx);
        const c = document.getElementById('enc-admin-kpis');
        if (!c) return;
        c.innerHTML = [
          { v: stats.total, l: 'Total', bg: 'bg-primary', ic: 'bi-clipboard2-data' },
          { v: stats.active, l: 'Activas', bg: 'bg-success', ic: 'bi-broadcast' },
          { v: stats.totalResponses, l: 'Respuestas', bg: 'bg-info', ic: 'bi-people' },
          { v: stats.draft + stats.paused, l: 'Borradores', bg: 'bg-secondary', ic: 'bi-pencil-square' }
        ].map(k => `<div class="col-6 col-md-3"><div class="card border-0 ${k.bg} bg-opacity-10 h-100 rounded-4">
      <div class="card-body text-center p-3"><i class="bi ${k.ic} fs-4 ${k.bg.replace('bg-', 'text-')} mb-1 d-block"></i>
      <h2 class="fw-bold ${k.bg.replace('bg-', 'text-')} mb-0">${k.v}</h2><span class="extra-small fw-bold text-muted text-uppercase">${k.l}</span></div></div></div>`).join('');
      } catch (e) { console.error(e); }
    }

    // ========== TAB: CREAR ==========
    function renderCrearTab(c) {
      c.innerHTML = `<div class="text-center py-5">
    <div class="mb-3"><i class="bi bi-plus-circle-dotted" style="font-size:4rem;color:#0d6efd;opacity:.5"></i></div>
    <h5 class="fw-bold mb-2">Nueva Encuesta</h5>
    <p class="text-muted small mb-4">Diseña una encuesta con diferentes tipos de preguntas</p>
    <button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow" onclick="Encuestas.openCreateModal()">
      <i class="bi bi-plus-lg me-2"></i>Crear Encuesta</button></div>`;
    }

    // ========== TAB: GESTIONAR ==========
    async function renderGestionarTab(c) {
      c.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
      try {
        _surveys = await EncuestasService.getAllSurveys(_ctx);
        if (_surveys.length === 0) {
          c.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i><p>No has creado encuestas aún.</p></div>`;
          return;
        }
        c.innerHTML = `<div class="row g-3">${_surveys.map(s => renderSurveyCard(s)).join('')}</div>`;
      } catch (e) { c.innerHTML = '<div class="alert alert-danger">Error cargando encuestas.</div>'; }
    }

    function renderSurveyCard(s) {
      const statusMap = { draft: { bg: 'bg-secondary', lbl: 'Borrador' }, active: { bg: 'bg-success', lbl: 'Activa' }, paused: { bg: 'bg-warning text-dark', lbl: 'Pausada' }, closed: { bg: 'bg-dark', lbl: 'Cerrada' } };
      const st = statusMap[s.status] || statusMap.draft;
      const audTxt = s.isPublic ? '🌐 Pública' : (s.audience || []).join(', ');
      return `<div class="col-md-6 col-lg-4"><div class="card border-0 shadow-sm rounded-4 enc-card h-100">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <span class="badge ${st.bg} rounded-pill">${st.lbl}</span>
        <div class="dropdown"><button class="btn btn-sm btn-light rounded-circle" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
          <ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-3">
            ${s.status === 'active' ? `<li><a class="dropdown-item" href="#" onclick="event.preventDefault();Encuestas.toggleSurvey('${s.id}','paused')"><i class="bi bi-pause-circle me-2 text-warning"></i>Pausar</a></li>` : ''}
            ${s.status !== 'active' ? `<li><a class="dropdown-item" href="#" onclick="event.preventDefault();Encuestas.toggleSurvey('${s.id}','active')"><i class="bi bi-play-circle me-2 text-success"></i>Activar</a></li>` : ''}
            <li><a class="dropdown-item" href="#" onclick="event.preventDefault();Encuestas.showQR('${s.id}')"><i class="bi bi-qr-code me-2 text-primary"></i>Ver QR</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item text-danger" href="#" onclick="event.preventDefault();Encuestas.deleteSurvey('${s.id}')"><i class="bi bi-trash me-2"></i>Eliminar</a></li>
          </ul>
        </div>
      </div>
      <h6 class="fw-bold mb-1">${s.title}</h6>
      <p class="text-muted extra-small mb-2 text-truncate">${s.description || 'Sin descripción'}</p>
      <div class="d-flex gap-2 flex-wrap mb-2">
        <span class="badge bg-light text-dark border"><i class="bi bi-people me-1"></i>${audTxt}</span>
        <span class="badge bg-light text-dark border"><i class="bi bi-chat-square-text me-1"></i>${(s.questions || []).length} preg.</span>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <span class="extra-small text-muted">${fmtDate(s.createdAt)}</span>
        <span class="badge bg-primary bg-opacity-10 text-primary fw-bold"><i class="bi bi-people-fill me-1"></i>${s.responseCount || 0}</span>
      </div>
    </div></div></div>`;
    }

    // ========== TAB: RESULTADOS ==========
    async function renderResultadosTab(c) {
      c.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
      try {
        _surveys = _surveys.length ? _surveys : await EncuestasService.getAllSurveys(_ctx);
        if (!_surveys.length) { c.innerHTML = '<div class="text-center py-5 text-muted"><p>No hay encuestas para analizar.</p></div>'; return; }
        c.innerHTML = `<div class="mb-4"><label class="form-label fw-bold">Selecciona una encuesta</label>
      <select class="form-select rounded-3" id="enc-result-select" onchange="Encuestas.loadResults()">
      <option value="">-- Seleccionar --</option>
      ${_surveys.map(s => `<option value="${s.id}">${s.title} (${s.responseCount || 0} resp.)</option>`).join('')}
      </select></div><div id="enc-results-container"></div>`;
      } catch (e) { c.innerHTML = '<div class="alert alert-danger">Error.</div>'; }
    }

    async function loadResults() {
      const id = document.getElementById('enc-result-select')?.value;
      const c = document.getElementById('enc-results-container');
      if (!id || !c) return;
      c.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
      try {
        const [stats, survey, responses] = await Promise.all([
          EncuestasService.getSurveyStats(_ctx, id),
          EncuestasService.getSurveyById(_ctx, id),
          EncuestasService.getResponses(_ctx, id)
        ]);
        renderResultsPanel(c, stats, survey, responses);
      } catch (e) { c.innerHTML = '<div class="alert alert-danger">Error cargando resultados.</div>'; }
    }

    function renderResultsPanel(c, stats, survey, responses) {
      // Destroy old charts
      Object.values(_chartInstances).forEach(ch => ch.destroy?.());
      _chartInstances = {};

      const careers = Object.entries(stats.byCareers).sort((a, b) => b[1] - a[1]);
      c.innerHTML = `
    <div class="row g-3 mb-4">
      <div class="col-4"><div class="card border-0 bg-primary bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-primary mb-0">${stats.total}</h3><span class="extra-small text-muted">Respuestas</span></div></div>
      <div class="col-4"><div class="card border-0 bg-success bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-success mb-0">${careers.length}</h3><span class="extra-small text-muted">Carreras</span></div></div>
      <div class="col-4"><div class="card border-0 bg-info bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-info mb-0">${Object.keys(stats.byRole).length}</h3><span class="extra-small text-muted">Roles</span></div></div>
    </div>
    ${survey.questions.map(q => renderQuestionResult(q, stats.byQuestion[q.id], stats.total)).join('')}
    <div class="card border-0 shadow-sm rounded-4 mt-4"><div class="card-body p-4">
      <h6 class="fw-bold mb-3"><i class="bi bi-table me-2"></i>Respuestas Individuales</h6>
      <div class="table-responsive"><table class="table table-hover table-sm align-middle">
        <thead class="bg-light"><tr><th>Nombre</th><th>Carrera</th><th>Fecha</th><th>Acciones</th></tr></thead>
        <tbody>${responses.slice(0, 50).map(r => `<tr><td class="fw-bold">${r.userName || 'Anónimo'}</td><td>${r.userCareer || '-'}</td>
          <td class="text-muted small">${fmtDate(r.submittedAt)}</td><td><button class="btn btn-sm btn-light rounded-pill" onclick='Encuestas.viewResponse(${JSON.stringify(r.answers).replace(/'/g, "&#39;")}, "${survey.id}")'>Ver</button></td></tr>`).join('')}
        </tbody></table></div>
      <div class="d-flex justify-content-end mt-2"><button class="btn btn-outline-success btn-sm rounded-pill" onclick="Encuestas.exportCSV('${survey.id}')"><i class="bi bi-download me-1"></i>Exportar CSV</button></div>
    </div></div>`;

      // Render charts after DOM is ready
      setTimeout(() => renderCharts(survey, stats), 100);
    }

    function renderQuestionResult(q, qStats, total) {
      if (!qStats) return '';
      const chartId = 'chart_' + q.id;
      if (q.type === 'open') {
        const texts = qStats.textAnswers || [];
        return `<div class="card border-0 shadow-sm rounded-4 mb-3"><div class="card-body p-4">
      <h6 class="fw-bold mb-2"><i class="bi bi-chat-text me-2 text-success"></i>${q.text}</h6>
      <p class="extra-small text-muted">${texts.length} respuestas de texto</p>
      <div style="max-height:200px;overflow-y:auto" class="bg-light rounded-3 p-3">
      ${texts.slice(0, 20).map(t => `<div class="border-bottom pb-2 mb-2 small">"${t}"</div>`).join('')}
      </div></div></div>`;
      }
      if (q.type === 'scale') {
        const answers = qStats.answers || {};
        const scaleLabels = Object.keys(answers);
        const scaleTotal = Object.values(answers).reduce((a, b) => a + b, 0);
        const scaleBars = scaleLabels.map(lbl => {
          const count = answers[lbl];
          const pct = scaleTotal > 0 ? Math.round((count / scaleTotal) * 100) : 0;
          return `<div class="d-flex align-items-center gap-2 mb-1">
                      <span class="extra-small fw-bold text-muted" style="min-width:24px">${lbl}</span>
                      <div class="progress flex-grow-1" style="height:6px"><div class="progress-bar bg-info" style="width:${pct}%"></div></div>
                      <span class="extra-small text-muted" style="min-width:32px">${pct}%</span>
                    </div>`;
        }).join('');
        return `<div class="card border-0 shadow-sm rounded-4 mb-3"><div class="card-body p-3">
      <h6 class="fw-bold mb-2 small"><i class="bi bi-speedometer2 me-2 text-info"></i>${q.text}</h6>
      <div class="d-flex align-items-center gap-3 mb-2"><h3 class="fw-bold text-info mb-0">${qStats.average || '-'}</h3><span class="text-muted extra-small">promedio</span></div>
      <div>${scaleBars}</div></div></div>`;
      }
      // Multiple / Boolean - Layout compacto 2 columnas
      const answers = qStats.answers || {};
      const labels = Object.keys(answers);
      const ansTotal = Object.values(answers).reduce((a, b) => a + b, 0);
      const colors = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0'];
      const barsHtml = labels.map((lbl, i) => {
        const count = answers[lbl];
        const pct = ansTotal > 0 ? Math.round((count / ansTotal) * 100) : 0;
        const color = colors[i % colors.length];
        return `<div class="d-flex align-items-center gap-2 mb-2">
                  <span class="extra-small text-truncate" style="min-width:0;max-width:120px" title="${lbl}">${lbl}</span>
                  <div class="progress flex-grow-1" style="height:8px"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div>
                  <span class="extra-small fw-bold text-muted text-nowrap">${count} (${pct}%)</span>
                </div>`;
      }).join('');
      const iconClass = q.type === 'boolean' ? 'bi-toggle-on text-warning' : 'bi-list-check text-primary';
      return `<div class="card border-0 shadow-sm rounded-4 mb-3"><div class="card-body p-3">
    <h6 class="fw-bold mb-3 small"><i class="bi ${iconClass} me-2"></i>${q.text}
      <span class="badge bg-light text-muted fw-normal ms-2">${ansTotal} resp.</span></h6>
    <div class="row align-items-center g-2">
      <div class="col-7 col-md-8">${barsHtml}</div>
      <div class="col-5 col-md-4 d-flex justify-content-center"><canvas id="${chartId}" style="max-width:150px;max-height:150px"></canvas></div>
    </div></div></div>`;
    }

    function renderCharts(survey, stats) {
      if (typeof Chart === 'undefined') return;
      survey.questions.forEach(q => {
        const qStats = stats.byQuestion[q.id];
        if (!qStats || q.type === 'open' || q.type === 'scale') return;
        const canvasEl = document.getElementById('chart_' + q.id);
        if (!canvasEl) return;
        const labels = Object.keys(qStats.answers);
        const data = Object.values(qStats.answers);
        const colors = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0'];
        _chartInstances[q.id] = new Chart(canvasEl, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: '55%',
            plugins: { legend: { display: false } }
          }
        });
      });
    }

    function viewResponse(answers, surveyId) {
      const survey = _surveys.find(s => s.id === surveyId);
      if (!survey) return;
      let html = survey.questions.map(q => `<div class="mb-3"><strong class="small">${q.text}</strong><div class="text-muted">${answers[q.id] !== undefined ? answers[q.id] : '-'}</div></div>`).join('');
      const modal = document.createElement('div');
      modal.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow">
    <div class="modal-header border-0"><h6 class="fw-bold">Respuesta Individual</h6><button class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body">${html}</div></div></div></div>`;
      document.body.appendChild(modal);
      const m = new bootstrap.Modal(modal.querySelector('.modal'));
      m.show();
      modal.querySelector('.modal').addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async function exportCSV(surveyId) {
      const survey = _surveys.find(s => s.id === surveyId) || await EncuestasService.getSurveyById(_ctx, surveyId);
      const responses = await EncuestasService.getResponses(_ctx, surveyId);
      const headers = ['Nombre', 'Email', 'Carrera', 'Rol', 'Fecha', ...survey.questions.map(q => q.text)];
      const rows = responses.map(r => [r.userName, r.userEmail, r.userCareer || '', r.userRole, fmtDate(r.submittedAt), ...survey.questions.map(q => r.answers?.[q.id] ?? '')]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `encuesta_${survey.title.replace(/\s+/g, '_')}.csv`; a.click();
    }

    // ========== CREATE MODAL ==========
    function renderCreateModal() {
      return `<div class="modal fade" id="modalCreateSurvey" tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-xl modal-fullscreen-md-down modal-dialog-scrollable">
  <div class="modal-content border-0 rounded-4 shadow-lg">
    <div class="modal-header border-0 bg-primary bg-opacity-10 rounded-top-4 py-3">
      <div><h5 class="fw-bold mb-0"><i class="bi bi-clipboard-plus me-2"></i>Nueva Encuesta</h5>
      <span class="extra-small text-muted">Diseña tu encuesta paso a paso</span></div>
      <button class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body p-4">
      <div class="mb-4"><label class="form-label fw-bold">Título de la Encuesta *</label>
        <input class="form-control form-control-lg rounded-3 border-0 bg-light" id="enc-title" placeholder="Ej: Encuesta de Satisfacción 2026" required></div>
      <div class="mb-4"><label class="form-label fw-bold">Descripción / Propósito</label>
        <textarea class="form-control rounded-3 border-0 bg-light" id="enc-desc" rows="2" placeholder="¿Cuál es el objetivo de esta encuesta?"></textarea></div>
      <hr>
      <h6 class="fw-bold mb-3"><i class="bi bi-list-check me-2 text-primary"></i>Preguntas</h6>
      <div id="enc-questions-builder"></div>
      <button class="btn btn-outline-primary rounded-pill w-100 py-2 fw-bold mt-2" onclick="Encuestas.addQuestion()"><i class="bi bi-plus-lg me-2"></i>Agregar Pregunta</button>
      <hr class="my-4">
      <h6 class="fw-bold mb-3"><i class="bi bi-people me-2 text-primary"></i>¿Para quién es la encuesta?</h6>
      <div class="row g-2 mb-3" id="enc-audience-chips">
        <div class="col-6 col-md-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="aud-est" value="estudiantes" checked><label class="form-check-label" for="aud-est">🎓 Estudiantes</label></div></div>
        <div class="col-6 col-md-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="aud-doc" value="docentes"><label class="form-check-label" for="aud-doc">👨‍🏫 Docentes</label></div></div>
        <div class="col-6 col-md-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="aud-adm" value="administrativos"><label class="form-check-label" for="aud-adm">💼 Administrativos</label></div></div>
        <div class="col-6 col-md-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="aud-op" value="operativos"><label class="form-check-label" for="aud-op">🔧 Operativos</label></div></div>
        <div class="col-6 col-md-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="aud-all" value="todos" onchange="Encuestas.toggleAllAudience(this)"><label class="form-check-label" for="aud-all">✅ Todos</label></div></div>
      </div>
      <div class="card border-2 border-primary bg-primary bg-opacity-10 rounded-4 p-3 mb-4">
        <div class="form-check form-switch d-flex align-items-center gap-3">
          <input class="form-check-input fs-4" type="checkbox" id="enc-public" onchange="Encuestas.togglePublicMode(this)">
          <div><label class="form-check-label fw-bold fs-5" for="enc-public">🌐 Encuesta Pública</label>
          <p class="mb-0 small text-muted">Cualquier persona podrá responder sin necesidad de tener cuenta en SIA. Se genera un link y QR compartible.</p></div>
        </div>
      </div>
      <h6 class="fw-bold mb-3"><i class="bi bi-calendar-check me-2 text-primary"></i>Duración</h6>
      <div class="mb-4">
        <div class="form-check mb-2"><input class="form-check-input" type="radio" name="enc-sched" id="sched-manual" value="manual" checked><label class="form-check-label" for="sched-manual">Activar/desactivar manualmente</label></div>
        <div class="form-check mb-2"><input class="form-check-input" type="radio" name="enc-sched" id="sched-timed" value="timed" onchange="document.getElementById('enc-dates').classList.toggle('d-none',!this.checked)"><label class="form-check-label" for="sched-timed">Programar fechas</label></div>
        <div id="enc-dates" class="d-none mt-2 row g-2">
          <div class="col-6"><label class="form-label small">Inicio</label><input type="datetime-local" class="form-control rounded-3" id="enc-start"></div>
          <div class="col-6"><label class="form-label small">Fin</label><input type="datetime-local" class="form-control rounded-3" id="enc-end"></div>
        </div>
      </div>
    </div>
    <div class="modal-footer border-0 gap-2">
      <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
      <button class="btn btn-outline-primary rounded-pill px-4" onclick="Encuestas.saveSurvey('draft')"><i class="bi bi-save me-1"></i>Guardar Borrador</button>
      <button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="Encuestas.saveSurvey('active')"><i class="bi bi-send me-1"></i>Publicar</button>
    </div>
  </div></div></div>`;
    }

    function renderQRModal() {
      return `<div class="modal fade" id="modalSurveyQR" tabindex="-1"><div class="modal-dialog modal-sm modal-dialog-centered">
  <div class="modal-content border-0 rounded-4 shadow text-center"><div class="modal-header border-0 pb-0"><h6 class="fw-bold">Código QR</h6><button class="btn-close" data-bs-dismiss="modal"></button></div>
  <div class="modal-body p-4"><div id="enc-qr-container" class="d-flex justify-content-center mb-3"></div>
  <input class="form-control form-control-sm rounded-pill text-center bg-light" id="enc-qr-link" readonly>
  <button class="btn btn-sm btn-outline-primary rounded-pill mt-2 w-100" onclick="navigator.clipboard.writeText(document.getElementById('enc-qr-link').value);this.innerHTML='<i class=\\'bi bi-check\\' ></i> Copiado!'"><i class="bi bi-clipboard me-1"></i>Copiar Link</button>
  </div></div></div></div>`;
    }

    function openCreateModal() {
      _questionCounter = 0;
      document.getElementById('enc-title').value = '';
      document.getElementById('enc-desc').value = '';
      document.getElementById('enc-questions-builder').innerHTML = '';
      document.getElementById('enc-public').checked = false;
      document.querySelectorAll('#enc-audience-chips input').forEach(i => { i.checked = i.id === 'aud-est'; i.disabled = false; });
      addQuestion(); // Start with one
      const m = new bootstrap.Modal(document.getElementById('modalCreateSurvey'));
      m.show();
    }

    function addQuestion() {
      addQuestionToBuilder('enc-questions-builder');
    }

    function addQuestionToBuilder(containerId, data = null) {
      _questionCounter++;
      const id = 'nq_' + _questionCounter; // unique DOM id
      const builder = document.getElementById(containerId);
      if (!builder) return;

      const div = document.createElement('div');
      div.className = 'card border-0 bg-light rounded-4 p-3 mb-3 q-builder-item animate-fade-in';
      div.id = 'q_item_' + id;

      const qText = data?.text || '';
      const qType = data?.type || 'scale'; // Default to scale for services as it's common, or open
      const qReq = data?.required !== undefined ? data.required : true;
      const qMin = data?.min || 1;
      const qMax = data?.max || 10;

      // Render Options if multiple
      let optionsHtml = '';
      if (data?.type === 'multiple' && data.options) {
        optionsHtml = data.options.map(opt =>
          `<div class="input-group input-group-sm mb-1"><input class="form-control rounded-3" value="${opt}"><button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button></div>`
        ).join('');
        optionsHtml += `<button class="btn btn-sm btn-outline-primary rounded-pill mt-1" onclick="Encuestas.addOption('${id}')"><i class="bi bi-plus"></i> Opción</button>`;
      } else if (data?.type === 'scale') {
        optionsHtml = `<div class="d-flex gap-2"><div><label class="form-label extra-small">Min</label><input type="number" class="form-control form-control-sm" id="qmin_${id}" value="${qMin}"></div>
      <div><label class="form-label extra-small">Max</label><input type="number" class="form-control form-control-sm" id="qmax_${id}" value="${qMax}"></div></div>`;
      }

      div.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="badge bg-primary rounded-pill">Pregunta</span>
      <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="this.closest('.q-builder-item').remove()" style="width:30px;height:30px;padding:0"><i class="bi bi-trash"></i></button>
    </div>
    <div class="mb-2"><input class="form-control rounded-3 fw-bold" id="qt_${id}" placeholder="Escribe la pregunta..." value="${qText}" required></div>
    <div class="mb-2"><select class="form-select form-select-sm rounded-3" id="qtype_${id}" onchange="Encuestas.onTypeChange('${id}')">
      ${QUESTION_TYPES.map(t => `<option value="${t.id}" ${t.id === qType ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
    <div id="qopts_${id}">
      ${optionsHtml}
    </div>
    <div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" id="qreq_${id}" ${qReq ? 'checked' : ''}><label class="form-check-label small" for="qreq_${id}">Requerida</label></div>`;

      builder.appendChild(div);

      // If type was NOT handled in the initial HTML generation (e.g. if it was 'multiple' but no options provided, or default 'open'), trigger change to set default view
      if (!data && qType !== 'scale') { // If new question, trigger default view
        // Actually onTypeChange handles empty state for open/boolean.
        // Multiple needs input fields.
        if (qType === 'multiple') Encuestas.onTypeChange(id);
      }
    }

    function onTypeChange(id) {
      const type = document.getElementById('qtype_' + id).value;
      const optsDiv = document.getElementById('qopts_' + id);
      if (type === 'multiple') {
        optsDiv.innerHTML = `<div class="input-group input-group-sm mb-1"><input class="form-control rounded-3" placeholder="Opción 1"><button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button></div>
      <div class="input-group input-group-sm mb-1"><input class="form-control rounded-3" placeholder="Opción 2"><button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button></div>
      <button class="btn btn-sm btn-outline-primary rounded-pill mt-1" onclick="Encuestas.addOption('${id}')"><i class="bi bi-plus"></i> Opción</button>`;
      } else if (type === 'scale') {
        optsDiv.innerHTML = `<div class="d-flex gap-2"><div><label class="form-label extra-small">Min</label><input type="number" class="form-control form-control-sm" id="qmin_${id}" value="1"></div>
      <div><label class="form-label extra-small">Max</label><input type="number" class="form-control form-control-sm" id="qmax_${id}" value="10"></div></div>`;
      } else { optsDiv.innerHTML = ''; }
    }

    function addOption(id) {
      const optsDiv = document.getElementById('qopts_' + id);
      const btn = optsDiv.querySelector('button:last-child');
      const ig = document.createElement('div');
      ig.className = 'input-group input-group-sm mb-1';
      ig.innerHTML = `<input class="form-control rounded-3" placeholder="Opción"><button class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button>`;
      optsDiv.insertBefore(ig, btn);
    }

    function toggleAllAudience(checkbox) {
      document.querySelectorAll('#enc-audience-chips input:not(#aud-all)').forEach(i => { i.checked = false; i.disabled = checkbox.checked; });
    }

    function togglePublicMode(checkbox) {
      const audChips = document.getElementById('enc-audience-chips');
      audChips.querySelectorAll('input').forEach(i => { i.disabled = checkbox.checked; if (checkbox.checked) i.checked = false; });
    }

    async function saveSurvey(status) {
      const title = document.getElementById('enc-title').value.trim();
      if (!title) { alert('Ingresa un título para la encuesta.'); return; }
      const items = document.querySelectorAll('.q-builder-item');
      if (!items.length) { alert('Agrega al menos una pregunta.'); return; }
      const questions = [];
      for (const item of items) {
        const id = item.id.replace('q_item_', '');
        const text = document.getElementById('qt_' + id)?.value.trim();
        if (!text) { alert('Una de las preguntas está vacía.'); return; }
        const type = document.getElementById('qtype_' + id)?.value || 'open';
        const q = { id: 'q' + questions.length, type, text, required: document.getElementById('qreq_' + id)?.checked ?? true };
        if (type === 'multiple') {
          const opts = [...item.querySelectorAll('#qopts_' + id + ' input[type="text"], #qopts_' + id + ' input:not([type])')].map(i => i.value.trim()).filter(Boolean);
          if (opts.length < 2) { alert(`La pregunta "${text}" necesita al menos 2 opciones.`); return; }
          q.options = opts;
        } else if (type === 'scale') {
          q.min = parseInt(document.getElementById('qmin_' + id)?.value) || 1;
          q.max = parseInt(document.getElementById('qmax_' + id)?.value) || 10;
        }
        questions.push(q);
      }
      const isPublic = document.getElementById('enc-public').checked;
      let audience = [];
      if (isPublic) { audience = ['todos']; }
      else {
        document.querySelectorAll('#enc-audience-chips input:checked').forEach(i => audience.push(i.value));
        if (!audience.length) audience = ['estudiantes'];
      }
      const schedType = document.querySelector('input[name="enc-sched"]:checked')?.value || 'manual';
      const scheduling = { type: schedType };
      if (schedType === 'timed') {
        scheduling.startDate = document.getElementById('enc-start')?.value ? new Date(document.getElementById('enc-start').value) : null;
        scheduling.endDate = document.getElementById('enc-end')?.value ? new Date(document.getElementById('enc-end').value) : null;
      }
      try {
        await EncuestasService.createSurvey(_ctx, { title, description: document.getElementById('enc-desc').value.trim(), questions, audience, isPublic, status, scheduling });
        bootstrap.Modal.getInstance(document.getElementById('modalCreateSurvey'))?.hide();
        showToast(status === 'active' ? '¡Encuesta publicada!' : 'Borrador guardado.', 'success');
        loadAdminKPIs();
        switchTab('gestionar');
      } catch (e) { alert('Error: ' + e.message); }
    }

    async function toggleSurvey(id, status) {
      try { await EncuestasService.toggleStatus(_ctx, id, status); showToast('Estado actualizado.', 'success'); loadAdminKPIs(); switchTab('gestionar'); } catch (e) { alert(e.message); }
    }
    async function deleteSurvey(id) {
      if (!confirm('¿Eliminar esta encuesta permanentemente?')) return;
      try { await EncuestasService.deleteSurvey(_ctx, id); showToast('Encuesta eliminada.', 'success'); loadAdminKPIs(); switchTab('gestionar'); } catch (e) { alert(e.message); }
    }

    function showQR(surveyId) {
      const survey = _surveys.find(s => s.id === surveyId);
      const isPublic = survey?.isPublic;
      const base = window.location.origin;
      const link = isPublic ? `${base}/#/encuesta-publica/${surveyId}` : `${base}/#/encuestas`;
      document.getElementById('enc-qr-link').value = link;
      const qrC = document.getElementById('enc-qr-container');
      qrC.innerHTML = '';
      if (typeof QRCode !== 'undefined') new QRCode(qrC, { text: link, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.H });
      const m = new bootstrap.Modal(document.getElementById('modalSurveyQR'));
      m.show();
    }

    // ========== STUDENT VIEW ==========
    function renderStudentShell() {
      return `<div id="enc-app" class="animate-fade-in">
    <div class="hero-banner-v2 shadow-sm mb-4" style="background:linear-gradient(135deg,#20c997 0%,#0dcaf0 100%)">
      <div class="hero-content-v2 text-white">
        <span class="badge bg-white text-success mb-2 fw-bold"><i class="bi bi-clipboard-check me-1"></i>Participa</span>
        <h2 class="fw-bold mb-1">Encuestas</h2>
        <p class="small opacity-75 mb-0">Tu opinión ayuda a mejorar el TecNM. ¡Responde las encuestas disponibles!</p>
      </div><i class="bi bi-ui-checks-grid hero-bg-icon-v2 text-white opacity-25"></i>
    </div>
    <div id="enc-student-list"><div class="text-center py-5"><span class="spinner-border text-primary"></span></div></div>
  </div>`;
    }

    async function initStudentView() {
      const c = document.getElementById('enc-student-list');
      if (!c) return;
      try {
        const role = _profile?.role || 'student';
        let aud = 'estudiantes';
        if (role === 'docente') aud = 'docentes'; else if (role === 'department_admin') aud = 'administrativos';
        const surveys = await EncuestasService.getActiveSurveys(_ctx, aud);
        if (!surveys.length) {
          c.innerHTML = `<div class="text-center py-5 text-muted bg-light rounded-4 border border-dashed"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i><p>No hay encuestas disponibles por el momento.</p></div>`;
          return;
        }
        // Check responded status
        const cards = [];
        for (const s of surveys) {
          if (s.isPublic) continue;
          const responded = await EncuestasService.hasUserResponded(_ctx, s.id);
          cards.push(renderStudentSurveyCard(s, responded));
        }
        c.innerHTML = `<div class="row g-3">${cards.join('')}</div>`;
      } catch (e) { c.innerHTML = '<div class="alert alert-danger">Error cargando encuestas.</div>'; }
    }

    function renderStudentSurveyCard(s, responded) {
      const isNew = s.createdAt && (Date.now() - new Date(s.createdAt).getTime()) < 3 * 24 * 60 * 60 * 1000;
      return `<div class="col-md-6"><div class="card border-0 shadow-sm rounded-4 enc-card h-100 ${responded ? 'opacity-75' : ''}">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between mb-2">
        ${isNew && !responded ? '<span class="badge bg-danger rounded-pill"><i class="bi bi-star-fill me-1"></i>Nueva</span>' : '<span></span>'}
        ${responded ? '<span class="badge bg-success rounded-pill"><i class="bi bi-check-circle me-1"></i>Completada</span>' : ''}
      </div>
      <h5 class="fw-bold mb-1">${s.title}</h5>
      <p class="text-muted small mb-3">${s.description || ''}</p>
      <div class="d-flex gap-2 mb-3">
        <span class="badge  text-dark border"><i class="bi bi-chat-square-text me-1"></i>${(s.questions || []).length} preguntas</span>
        ${s.scheduling?.endDate ? `<span class="badge bg-warning-subtle text-warning border"><i class="bi bi-clock me-1"></i>Hasta ${fmtDate(s.scheduling.endDate)}</span>` : ''}
      </div>
      ${!responded ? `<button class="btn btn-primary rounded-pill w-100 fw-bold" onclick="Encuestas.openStudentSurvey('${s.id}')"><i class="bi bi-pencil-square me-2"></i>Responder</button>`
          : '<button class="btn btn-light rounded-pill w-100 text-muted" disabled>Ya respondiste</button>'}
    </div></div></div>`;
    }

    async function openStudentSurvey(surveyId) {
      const survey = await EncuestasService.getSurveyById(_ctx, surveyId);
      if (!survey) { alert('Encuesta no encontrada.'); return; }
      const modal = document.createElement('div');
      modal.innerHTML = `<div class="modal fade" tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-lg modal-fullscreen-md-down modal-dialog-scrollable">
  <div class="modal-content border-0 rounded-4 shadow-lg">
    <div class="modal-header border-0 bg-success bg-opacity-10 py-3">
      <div><h5 class="fw-bold mb-0">${survey.title}</h5><span class="extra-small text-muted">${survey.description || ''}</span></div>
      <button class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body p-4"><div id="student-survey-qs"></div></div>
    <div class="modal-footer border-0 d-flex justify-content-between pb-5 pb-md-3">
      <div id="student-survey-pagination" class="d-flex gap-2 align-items-center"></div>
      <button class="btn btn-success rounded-pill px-5 fw-bold d-none" id="student-submit-btn" onclick="Encuestas.submitStudentSurvey('${surveyId}')">
      <i class="bi bi-send me-2"></i>Enviar</button>
    </div>
  </div></div></div>`;
      document.body.appendChild(modal);
      const m = new bootstrap.Modal(modal.querySelector('.modal'));
      m.show();
      modal.querySelector('.modal').addEventListener('hidden.bs.modal', () => modal.remove());
      // Store survey for answer collection
      modal._survey = survey;
      window._activeStudentSurveyModal = modal;

      // Init pagination
      initSurveyPagination(survey.questions, 'student-survey-qs', 'student-survey-pagination', 'student-submit-btn', modal);
    }

    async function submitStudentSurvey(surveyId) {
      const modal = window._activeStudentSurveyModal;
      const survey = modal?._survey;
      if (!survey) return;

      const answers = collectAnswers(survey.questions, 'student-survey-qs', modal._paginator);
      if (!answers) return;
      const btn = document.getElementById('student-submit-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
      try {
        await EncuestasService.submitResponse(_ctx, surveyId, answers);
        bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
        showToast('¡Gracias por responder la encuesta!', 'success');
        initStudentView();
      } catch (e) { alert(e.message); btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Enviar'; }
    }

    function showToast(msg, type) {
      if (window.showToast) window.showToast(msg, type);
      else if (window.SIA?.showToast) window.SIA.showToast(msg, type);
      else console.log('[Toast]', msg);
    }

    // ========== TAB: ENCUESTAS DE SERVICIO ==========
    async function renderEncuestasServicioTab(c) {
      c.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
      try {
        const [surveys, stats] = await Promise.all([
          EncuestasServicioService.getAllServiceSurveys(_ctx),
          EncuestasServicioService.getOverviewStats(_ctx)
        ]);
        const availableServices = [
          { type: 'biblioteca', name: 'Biblioteca', icon: 'bi-book', color: 'primary' },
          { type: 'servicio-medico', name: 'Servicio Médico', icon: 'bi-heart-pulse', color: 'danger' },
          { type: 'psicologia', name: 'Psicología', icon: 'bi-brain', color: 'info' }
        ];
        const surveyMap = {};
        surveys.forEach(s => { surveyMap[s.serviceType] = s; });
        c.innerHTML = `
      <div class="mb-4"><div class="d-flex justify-content-between align-items-center mb-3"><div>
        <h5 class="fw-bold mb-1"><i class="bi bi-heart-pulse me-2"></i>Encuestas de Servicio</h5>
        <p class="text-muted small mb-0">Gestiona las encuestas predeterminadas para cada servicio institucional</p></div></div>
        <div class="row g-3 mb-3">
          <div class="col-6 col-md-3"><div class="card border-0 bg-primary bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-primary mb-0">${stats.totalSurveys}</h3><span class="extra-small text-muted">Servicios</span></div></div>
          <div class="col-6 col-md-3"><div class="card border-0 bg-success bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-success mb-0">${stats.enabled}</h3><span class="extra-small text-muted">Habilitadas</span></div></div>
          <div class="col-6 col-md-3"><div class="card border-0 bg-info bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-info mb-0">${stats.totalResponses}</h3><span class="extra-small text-muted">Respuestas</span></div></div>
          <div class="col-6 col-md-3"><div class="card border-0 bg-warning bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-warning mb-0">${stats.disabled}</h3><span class="extra-small text-muted">Deshabilitadas</span></div></div>
        </div></div>
      <div class="row g-3">${availableServices.map(svc => renderServiceSurveyCard(svc, surveyMap[svc.type])).join('')}</div>`;
      } catch (e) {
        console.error('[Encuestas] Error rendering service tab:', e);
        c.innerHTML = `<div class="alert alert-danger">Error cargando encuestas de servicio: ${e.message}</div>`;
      }
    }

    function renderServiceSurveyCard(serviceInfo, survey) {
      const exists = !!survey;
      const enabled = survey?.enabled || false;
      const responseCount = survey?.responseCount || 0;
      const showToAll = survey?.config?.showToAll || false;

      const statusBadge = enabled ? '<span class="badge bg-success rounded-pill"><i class="bi bi-check-circle me-1"></i>Habilitada</span>' : '<span class="badge bg-secondary rounded-pill"><i class="bi bi-pause-circle me-1"></i>Deshabilitada</span>';

      return `<div class="col-md-6 col-lg-4"><div class="card border-0 shadow-sm rounded-4 enc-card h-100"><div class="card-body p-4">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div class="d-flex align-items-center gap-2"><div class="rounded-circle bg-${serviceInfo.color} bg-opacity-10 p-2"><i class="bi ${serviceInfo.icon} fs-4 text-${serviceInfo.color}"></i></div>
          <div><h6 class="fw-bold mb-0">${serviceInfo.name}</h6><span class="extra-small text-muted">${serviceInfo.type}</span></div></div>
        ${exists ? statusBadge : '<span class="badge bg-light text-dark border">No configurada</span>'}
      </div>
      ${exists ? `<div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2"><span class="small text-muted">Respuestas</span><span class="badge bg-${serviceInfo.color} bg-opacity-10 text-${serviceInfo.color} fw-bold">${responseCount}</span></div>
        <div class="d-flex justify-content-between align-items-center mb-2"><span class="small text-muted">Preguntas</span><span class="badge  text-dark">${(survey.questions || []).length}</span></div>
        <div class="d-flex justify-content-between align-items-center"><span class="small text-muted">Frecuencia</span><span class="badge  text-dark">${getFrequencyLabel(survey.config?.frequency)}</span></div>
      </div>
      <div class="d-flex gap-2 mb-2"><button class="btn btn-sm btn-outline-${serviceInfo.color} rounded-pill flex-fill" onclick="Encuestas.openServiceEditor('${serviceInfo.type}')"><i class="bi bi-gear me-1"></i>Editar</button>
        ${responseCount > 0 ? `<button class="btn btn-sm btn-${serviceInfo.color} rounded-pill flex-fill" onclick="Encuestas.viewServiceResults('${serviceInfo.type}')"><i class="bi bi-graph-up me-1"></i>Resultados</button>` : ''}
      </div>
      <div>
          ${showToAll
            ? `<button class="btn btn-sm btn-danger rounded-pill w-100" onclick="Encuestas.deactivateServiceSurveyToAll('${serviceInfo.type}')"><i class="bi bi-stop-circle me-1"></i>Detener "Global"</button>`
            : `<button class="btn btn-sm btn-outline-warning rounded-pill w-100" onclick="Encuestas.triggerServiceSurveyToAll('${serviceInfo.type}')" title="Mostrar encuesta a todos los usuarios ahora mismo"><i class="bi bi-broadcast me-1"></i>Lanzar a Todos</button>`
          }
      </div>
      <div class="form-check form-switch mt-3 pt-3 border-top"><input class="form-check-input" type="checkbox" id="toggle-${serviceInfo.type}" ${enabled ? 'checked' : ''} onchange="Encuestas.toggleServiceSurveyStatus('${serviceInfo.type}', this.checked)">
        <label class="form-check-label small fw-bold" for="toggle-${serviceInfo.type}">${enabled ? 'Encuesta habilitada' : 'Encuesta deshabilitada'}</label></div>` :
          `<p class="text-muted small mb-3">Esta encuesta aún no ha sido configurada.</p><button class="btn btn-sm btn-outline-${serviceInfo.color} rounded-pill w-100" onclick="Encuestas.createDefaultServiceSurvey('${serviceInfo.type}')"><i class="bi bi-magic me-1"></i>Inicializar Configuración</button>`}
    </div></div></div>`;
    }

    function getFrequencyLabel(freq) { return { 'per-use': 'Cada uso', 'weekly': 'Semanal', 'monthly': 'Mensual', 'custom': 'Personalizado' }[freq] || 'No configurado'; }
    function getQuestionTypeLabel(type) { return { 'multiple': 'Opción múltiple', 'open': 'Texto abierto', 'boolean': 'Verdadero/Falso', 'scale': 'Escala numérica' }[type] || type; }

    async function createDefaultServiceSurvey(serviceType) {
      const defaults = {
        'biblioteca': {
          title: 'Encuesta de Satisfacción - Biblioteca', description: 'Ayúdanos a mejorar los servicios de la biblioteca', questions: [
            { id: 'q0', type: 'multiple', text: '¿El personal de Biblioteca le brindó atención amable y respetuosa?', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q1', type: 'multiple', text: '¿Recibió apoyo oportuno para localizar material o resolver dudas?', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo', 'No aplica'] },
            { id: 'q2', type: 'multiple', text: '¿El material bibliográfico (libros, revistas, recursos digitales) fue suficiente y adecuado?', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
            { id: 'q3', type: 'multiple', text: '¿Las instalaciones de la Biblioteca estaban limpias y en buen estado?', required: true, options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas'] },
            { id: 'q4', type: 'multiple', text: '¿El equipo de cómputo y áreas de estudio funcionaba correctamente?', required: true, options: ['Muy bien', 'Bien', 'Regular', 'Mal', 'Muy mal', 'No aplica'] },
            { id: 'q5', type: 'multiple', text: '¿Encontró disponibilidad de espacios o recursos cuando los necesitó?', required: true, options: ['Siempre', 'Casi siempre', 'A veces', 'Rara vez', 'Nunca'] },
            { id: 'q6', type: 'multiple', text: '¿Qué tan satisfecho(a) está con los servicios de la Biblioteca?', required: true, options: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Nada satisfecho'] },
            { id: 'q7', type: 'open', text: '¿Qué aspecto de la Biblioteca consideras que puede mejorar?', required: false },
            { id: 'q8', type: 'open', text: '¿Deseas agregar algún comentario adicional?', required: false }
          ]
        },
        'servicio-medico': {
          title: 'Encuesta de Satisfacción - Servicio Médico', description: 'Ayúdanos a mejorar la calidad de nuestro servicio médico', questions: [
            { id: 'q0', type: 'multiple', text: '¿Con qué frecuencia utilizas el Servicio Médico?', required: true, options: ['Primera vez', 'Ocasionalmente', 'Frecuentemente'] },
            { id: 'q1', type: 'multiple', text: 'El horario del Servicio Médico es adecuado.', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
            { id: 'q2', type: 'multiple', text: 'La ubicación y señalización del consultorio son claras.', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q3', type: 'multiple', text: 'El tiempo de espera para ser atendido fue razonable.', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
            { id: 'q4', type: 'multiple', text: 'El personal médico mostró trato respetuoso y amable.', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
            { id: 'q5', type: 'multiple', text: 'El personal generó confianza durante la atención.', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q6', type: 'multiple', text: 'Las explicaciones brindadas sobre mi estado de salud fueron claras.', required: true, options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas'] },
            { id: 'q7', type: 'multiple', text: 'Las instalaciones se encontraban limpias y en condiciones adecuadas.', required: true, options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas'] },
            { id: 'q8', type: 'multiple', text: 'El consultorio cuenta con privacidad suficiente para la atención.', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q9', type: 'multiple', text: 'La atención recibida resolvió mi necesidad médica.', required: true, options: ['Totalmente', 'Parcialmente', 'No'] },
            { id: 'q10', type: 'multiple', text: 'En caso de canalización externa, la orientación proporcionada fue clara.', required: false, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala', 'No aplica'] },
            { id: 'q11', type: 'multiple', text: 'En general, estoy satisfecho(a) con el Servicio Médico del ITES.', required: true, options: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Nada satisfecho'] },
            { id: 'q12', type: 'multiple', text: 'Recomendaría el Servicio Médico a otros miembros de la comunidad.', required: true, options: ['Sí', 'Tal vez', 'No'] },
            { id: 'q13', type: 'open', text: '¿Qué aspecto del Servicio Médico consideras que puede mejorar?', required: false },
            { id: 'q14', type: 'open', text: '¿Deseas agregar algún comentario adicional?', required: false }
          ]
        },
        'psicologia': {
          title: 'Encuesta de Satisfacción - Atención Psicopedagógica', description: 'Tu opinión nos ayuda a mejorar el servicio de apoyo psicopedagógico', questions: [
            { id: 'q0', type: 'multiple', text: '¿Con qué frecuencia utilizas el Servicio de Psicología?', required: true, options: ['Primera vez', 'Ocasionalmente', 'Frecuentemente'] },
            { id: 'q1', type: 'multiple', text: 'El horario del servicio es adecuado.', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
            { id: 'q2', type: 'multiple', text: 'La ubicación y señalización del consultorio son claras.', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q3', type: 'multiple', text: 'El tiempo de espera para ser atendido fue razonable.', required: true, options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
            { id: 'q4', type: 'multiple', text: '¿La atención proporcionada fue respetuosa y profesional?', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q5', type: 'multiple', text: '¿Se sintió escuchado(a) durante la sesión?', required: true, options: ['Totalmente', 'Parcialmente', 'No'] },
            { id: 'q6', type: 'multiple', text: '¿El apoyo recibido le ayudó a aclarar o mejorar la situación que planteó?', required: true, options: ['Totalmente', 'Parcialmente', 'No'] },
            { id: 'q7', type: 'multiple', text: '¿El personal psicopedagógico brindó herramientas o recomendaciones útiles?', required: true, options: ['Muy útiles', 'Útiles', 'Poco útiles', 'No útiles'] },
            { id: 'q8', type: 'multiple', text: '¿El proceso para solicitar el servicio fue sencillo?', required: true, options: ['Muy sencillo', 'Sencillo', 'Complicado', 'Muy complicado'] },
            { id: 'q9', type: 'multiple', text: '¿Sintió que su información fue tratada con confidencialidad?', required: true, options: ['Totalmente', 'Parcialmente', 'No'] },
            { id: 'q10', type: 'multiple', text: 'Las instalaciones se encontraban limpias y en condiciones adecuadas.', required: true, options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas'] },
            { id: 'q11', type: 'multiple', text: 'El consultorio cuenta con privacidad suficiente para la atención.', required: true, options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala'] },
            { id: 'q12', type: 'multiple', text: '¿Qué tan satisfecho(a) está con el servicio de apoyo psicopedagógico?', required: true, options: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Nada satisfecho'] },
            { id: 'q13', type: 'multiple', text: 'Recomendaría el servicio a otros miembros de la comunidad.', required: true, options: ['Sí', 'Tal vez', 'No'] },
            { id: 'q14', type: 'open', text: '¿Qué aspecto del servicio consideras que puede mejorar?', required: false },
            { id: 'q15', type: 'open', text: '¿Deseas agregar algún comentario adicional?', required: false }
          ]
        }
      };

      const data = defaults[serviceType] || { title: 'Encuesta de Servicio', description: 'Por favor responde esta encuesta', questions: [] };

      try {
        await EncuestasServicioService.createServiceSurvey(_ctx, serviceType, {
          ...data,
          enabled: true,
          config: { frequency: 'per-use', showToAll: false, maxSkips: 2 }
        });
        showToast('Encuesta inicializada correctamente', 'success');
      } catch (e) {
        console.error(e);
        alert('Error creando encuesta: ' + e.message);
      }
    }

    async function openServiceConfig(serviceType) {
      // Re-route to Editor
      openServiceEditor(serviceType);
    }

    async function openServiceEditor(serviceType) {
      console.log('[Encuestas] Opening Editor for:', serviceType);
      const modalId = 'modalServiceEditor';
      document.getElementById(modalId)?.remove(); // Cleanup previous

      try {
        let survey = await EncuestasServicioService.getServiceSurvey(_ctx, serviceType);
        if (!survey) {
          if (confirm('Esta encuesta no existe. ¿Deseas inicializarla ahora?')) {
            await createDefaultServiceSurvey(serviceType);
            survey = await EncuestasServicioService.getServiceSurvey(_ctx, serviceType);
          } else { return; }
        }

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.innerHTML = `<div class="modal fade" tabindex="-1" data-bs-backdrop="static"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content border-0 rounded-4 shadow-lg">
        <div class="modal-header border-0 bg-primary bg-opacity-10 py-3">
            <div><h5 class="fw-bold mb-0"><i class="bi bi-pencil-square me-2"></i>Editar Encuesta de Servicio</h5><span class="extra-small text-muted">${serviceType}</span></div>
            <button class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body p-4">
            <div class="row g-4">
                <div class="col-lg-8">
                    <h6 class="fw-bold mb-3"><i class="bi bi-ui-checks me-2 text-primary"></i>Contenido</h6>
                    <div class="mb-3">
                        <label class="form-label small fw-bold">Título</label>
                        <input class="form-control rounded-3 fw-bold" id="svc-title" value="${survey.title || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-bold">Descripción</label>
                        <textarea class="form-control rounded-3 small" id="svc-desc" rows="2">${survey.description || ''}</textarea>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="fw-bold mb-0">Preguntas</h6>
                        <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="Encuestas.addQuestionToBuilder('svc-questions-builder')"><i class="bi bi-plus-lg me-1"></i>Agregar</button>
                    </div>
                    <div id="svc-questions-builder" class="bg-light rounded-4 p-3" style="min-height:200px"></div>
                </div>
                <div class="col-lg-4 border-start">
                     <h6 class="fw-bold mb-3"><i class="bi bi-gear me-2 text-primary"></i>Configuración</h6>
                     
                     <div class="mb-4">
                        <label class="form-label small fw-bold">Frecuencia</label>
                        <div class="card border-0 bg-light rounded-3 p-2">
                             <div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="freq-per-use" value="per-use" ${survey.config.frequency === 'per-use' ? 'checked' : ''}><label class="form-check-label small" for="freq-per-use">Cada uso (Recomendado)</label></div>
                             <div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="freq-weekly" value="weekly" ${survey.config.frequency === 'weekly' ? 'checked' : ''}><label class="form-check-label small" for="freq-weekly">Semanal</label></div>
                             <div class="form-check mb-2"><input class="form-check-input" type="radio" name="svc-freq" id="freq-monthly" value="monthly" ${survey.config.frequency === 'monthly' ? 'checked' : ''}><label class="form-check-label small" for="freq-monthly">Mensual</label></div>
                             <div class="form-check"><input class="form-check-input" type="radio" name="svc-freq" id="freq-custom" value="custom" ${survey.config.frequency === 'custom' ? 'checked' : ''} onchange="document.getElementById('custom-days-input').classList.toggle('d-none', !this.checked)"><label class="form-check-label small" for="freq-custom">Personalizado</label></div>
                             <div id="custom-days-input" class="mt-2 ${survey.config.frequency === 'custom' ? '' : 'd-none'}"><input type="number" class="form-control form-control-sm rounded-3" id="custom-days" value="${survey.config.customDays || 7}" placeholder="Días"></div>
                        </div>
                     </div>

                     <div class="mb-4">
                        <label class="form-label small fw-bold">Comportamiento</label>
                        <div class="form-check form-switch mb-2">
                            <input class="form-check-input" type="checkbox" id="show-to-all" ${survey.config.showToAll ? 'checked' : ''}>
                            <label class="form-check-label small" for="show-to-all"><strong>Mostrar a TODOS</strong><br><span class="text-muted extra-small">Fuerza la encuesta incluso si no usan el servicio.</span></label>
                        </div>
                         <div class="form-check form-switch mb-2">
                            <input class="form-check-input" type="checkbox" id="svc-enabled" ${survey.enabled ? 'checked' : ''}>
                            <label class="form-check-label small" for="svc-enabled">Encuesta Habilitada</label>
                        </div>
                     </div>
                     
                     <div class="mb-3">
                         <label class="form-label small fw-bold">Permitir saltar (veces)</label>
                         <input type="number" class="form-control rounded-3" id="max-skips" value="${survey.config.maxSkips || 2}" min="0">
                     </div>
                </div>
            </div>
        </div>
        <div class="modal-footer border-0 gap-2"><button type="button" class="btn btn-outline-secondary rounded-pill px-4 me-auto" onclick="Encuestas.restoreDefaultServiceSurvey('${serviceType}')"><i class="bi bi-arrow-counterclockwise me-1"></i>Restaurar Original</button><button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary rounded-pill px-4 fw-bold shadow" onclick="Encuestas.saveServiceEditor('${serviceType}')"><i class="bi bi-save me-1"></i>Guardar Cambios</button></div>
        </div></div></div>`;

        document.body.appendChild(modal);

        // Populate Questions
        if (survey.questions && survey.questions.length > 0) {
          survey.questions.forEach(q => addQuestionToBuilder('svc-questions-builder', q));
        } else {
          addQuestionToBuilder('svc-questions-builder');
        }

        const m = new bootstrap.Modal(modal.querySelector('.modal'));
        m.show();
        modal.querySelector('.modal').addEventListener('hidden.bs.modal', () => modal.remove());
        window._activeServiceEditorModal = modal;

      } catch (e) {
        console.error(e);
        alert('Error abriendo editor: ' + e.message);
      }
    }

    async function saveServiceEditor(serviceType) {
      const modal = window._activeServiceEditorModal;
      if (!modal) return;

      const title = modal.querySelector('#svc-title').value.trim();
      const description = modal.querySelector('#svc-desc').value.trim();

      // Extract Questions
      const items = modal.querySelectorAll('.q-builder-item');
      const questions = [];

      for (const item of items) {
        const id = item.id.replace('q_item_', '');
        const text = item.querySelector(`[id^="qt_"]`)?.value.trim();
        if (!text) continue; // Skip empty

        const type = item.querySelector(`[id^="qtype_"]`)?.value || 'open';
        const q = { id: 'q' + questions.length, type, text, required: item.querySelector(`[id^="qreq_"]`)?.checked ?? true };

        if (type === 'multiple') {
          const opts = [...item.querySelectorAll('#qopts_' + id + ' input.form-control')].map(i => i.value.trim()).filter(Boolean);
          if (opts.length < 2) q.options = ['Sí', 'No']; // Fallback
          else q.options = opts;
        } else if (type === 'scale') {
          q.min = parseInt(modal.querySelector('#qmin_' + id)?.value) || 1;
          q.max = parseInt(modal.querySelector('#qmax_' + id)?.value) || 10;
        }
        questions.push(q);
      }

      if (questions.length === 0) { alert('Agrega al menos una pregunta.'); return; }

      try {
        await EncuestasServicioService.updateServiceSurvey(_ctx, serviceType, {
          title,
          description,
          questions,
          enabled: modal.querySelector('#svc-enabled').checked,
          config: {
            frequency: modal.querySelector('input[name="svc-freq"]:checked')?.value || 'per-use',
            customDays: parseInt(modal.querySelector('#custom-days')?.value) || 7,
            showToAll: modal.querySelector('#show-to-all')?.checked || false,
            maxSkips: parseInt(modal.querySelector('#max-skips')?.value) || 2
          }
        });

        // If showToAll was just turned on, set triggerTimestamp
        if (modal.querySelector('#show-to-all')?.checked) {
          // Note: Ideally check if it WAS false before, but setting it again harmless
          await EncuestasServicioService.updateServiceSurvey(_ctx, serviceType, {
            config: { triggerTimestamp: firebase.firestore.Timestamp.now() } // Merge this in
          });
        }

        bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
        showToast('Encuesta de servicio guardada.', 'success');
        switchTab('servicios');
      } catch (e) {
        alert('Error guardando: ' + e.message);
      }
    }

    async function toggleServiceSurveyStatus(serviceType, enabled) {
      try { await EncuestasServicioService.toggleServiceSurvey(_ctx, serviceType, enabled); showToast(enabled ? 'Habilitada' : 'Deshabilitada', 'success'); } catch (e) { alert(e.message); document.getElementById(`toggle-${serviceType}`).checked = !enabled; }
    }

    async function triggerServiceSurveyToAll(serviceType) {
      if (!confirm(`¿ACTIVAR MODO GLOBAL?\n\nLa encuesta aparecerá para TODOS los estudiantes inmediatamente.\nÚsalo con precaución.`)) return;

      try {
        await EncuestasServicioService.updateServiceSurvey(_ctx, serviceType, {
          config: {
            showToAll: true,
            triggerTimestamp: firebase.firestore.Timestamp.now()
          }
        });
        showToast('🚀 Modo Global ACTIVADO.', 'success');
        switchTab('servicios'); // Refresh UI
      } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
      }
    }

    async function deactivateServiceSurveyToAll(serviceType) {
      if (!confirm(`¿DESACTIVAR MODO GLOBAL?\n\nLa encuesta dejará de aparecer forzosamente a todos.`)) return;
      try {
        // We need to fetch current config first to preserve other keys? 
        // updateServiceSurvey merges at root level, so 'config' object might replace entire config if not careful?
        // EncuestasServicioService.updateServiceSurvey implementation: db.doc().update(updateData). 
        // Firestore update merges nested fields if using Dot Notation, but if we pass object it might replace?
        // Actually, Firestore `update({ config: { ... } })` replaces the map "config". 
        // To update partial nested field we need dot notation `update({ "config.showToAll": false })`.
        // But EncuestasServicioService structure is simple spread. 
        // Safer way: Get, patch, update.

        const current = await EncuestasServicioService.getServiceSurvey(_ctx, serviceType);
        if (!current) return;

        const newConfig = { ...current.config, showToAll: false, triggerTimestamp: null };

        await EncuestasServicioService.updateServiceSurvey(_ctx, serviceType, {
          config: newConfig
        });

        showToast('⏹️ Modo Global DESACTIVADO.', 'success');
        switchTab('servicios');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function viewServiceResults(serviceType) {
      const c = document.getElementById('enc-tab-content');
      c.innerHTML = '<div class="text-center py-4"><span class="spinner-border text-primary"></span></div>';
      try {
        const [survey, stats, responses] = await Promise.all([EncuestasServicioService.getServiceSurvey(_ctx, serviceType), EncuestasServicioService.getServiceSurveyStats(_ctx, serviceType), EncuestasServicioService.getServiceSurveyResponses(_ctx, serviceType)]);
        Object.values(_chartInstances).forEach(ch => ch.destroy?.()); _chartInstances = {};
        const careers = Object.entries(stats.byCareers || {}).sort((a, b) => b[1] - a[1]);
        c.innerHTML = `<div class="mb-3"><button class="btn btn-sm btn-outline-secondary rounded-pill" onclick="Encuestas.switchTab('servicios')"><i class="bi bi-arrow-left me-1"></i>Volver</button></div>
        <div class="card border-0 shadow-sm rounded-4 mb-4"><div class="card-body p-4"><h5 class="fw-bold mb-1"><i class="bi bi-graph-up me-2 text-primary"></i>${survey.title}</h5></div></div>
        <div class="row g-3 mb-4">
          <div class="col-4"><div class="card border-0 bg-primary bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-primary mb-0">${stats.total || 0}</h3><span class="extra-small text-muted">Respuestas</span></div></div>
          <div class="col-4"><div class="card border-0 bg-success bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-success mb-0">${careers.length}</h3><span class="extra-small text-muted">Carreras</span></div></div>
          <div class="col-4"><div class="card border-0 bg-info bg-opacity-10 rounded-4 p-3 text-center"><h3 class="fw-bold text-info mb-0">${Object.keys(stats.byRole || {}).length}</h3><span class="extra-small text-muted">Roles</span></div></div>
        </div>
        ${survey.questions.map(q => renderQuestionResult(q, (stats.byQuestion || {})[q.id], stats.total || 0)).join('')}
        <div class="card border-0 shadow-sm rounded-4 mt-4"><div class="card-body p-4"><h6 class="fw-bold mb-3">Respuestas Individuales</h6>
        <div class="table-responsive"><table class="table table-hover table-sm"><thead><tr><th>Nombre</th><th>Fecha</th><th>Ver</th></tr></thead><tbody>${responses.slice(0, 50).map(r => `<tr><td>${r.userName}</td><td>${fmtDate(r.submittedAt)}</td><td><button class="btn btn-sm btn-light rounded-pill" onclick='Encuestas.viewServiceResponse(${JSON.stringify(r.answers).replace(/'/g, "&#39;")}, "${serviceType}")'>Ver</button></td></tr>`).join('')}</tbody></table></div>
        <div class="d-flex justify-content-end mt-2"><button class="btn btn-outline-success btn-sm rounded-pill" onclick="Encuestas.exportServiceCSV('${serviceType}')"><i class="bi bi-download me-1"></i>Exportar CSV</button></div></div></div>`;
        setTimeout(() => renderCharts(survey, stats), 100);
      } catch (e) {
        console.error(e);
        c.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
      }
    }

    function viewServiceResponse(answers, serviceType) {
      EncuestasServicioService.getServiceSurvey(_ctx, serviceType).then(survey => {
        if (!survey) return;
        let html = survey.questions.map(q => `<div class="mb-3"><strong class="small">${q.text}</strong><div class="text-muted">${answers[q.id] !== undefined ? answers[q.id] : '-'}</div></div>`).join('');
        const modal = document.createElement('div');
        modal.innerHTML = `<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow"><div class="modal-header border-0"><h6 class="fw-bold">Respuesta</h6><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${html}</div></div></div></div>`;
        document.body.appendChild(modal);
        new bootstrap.Modal(modal.querySelector('.modal')).show();
      });
    }

    async function exportServiceCSV(serviceType) {
      const survey = await EncuestasServicioService.getServiceSurvey(_ctx, serviceType);
      const responses = await EncuestasServicioService.getServiceSurveyResponses(_ctx, serviceType);
      const headers = ['Nombre', 'Email', 'Carrera', 'Rol', 'Fecha', ...survey.questions.map(q => q.text)];
      const rows = responses.map(r => [r.userName, r.userEmail, r.userCareer || '', r.userRole, fmtDate(r.submittedAt), ...survey.questions.map(q => r.answers?.[q.id] ?? '')]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `encuesta_servicio_${serviceType}_${Date.now()}.csv`; a.click();
    }

    async function checkAndShowServiceSurvey(serviceType, ctxOrNull) {
      const ctx = ctxOrNull || _ctx;
      if (!ctx) {
        console.warn('[Encuestas] checkAndShowServiceSurvey called without context and module not initialized.');
        return false;
      }
      console.log('[Encuestas] Checking for:', serviceType);
      try {
        const pending = await EncuestasServicioService.checkPendingSurvey(ctx, serviceType);
        if (pending) {
          console.log('[Encuestas] Pending survey found, rendering...');
          renderServiceSurveyModal(pending);
          return true;
        } else {
          console.log('[Encuestas] No pending survey for:', serviceType);
          return false;
        }
      } catch (e) {
        console.error('Error checking service survey:', e);
        return false;
      }
    }

    function renderServiceSurveyModal(survey) {
      // Remover modal previo si existe
      document.getElementById('modalServiceSurvey')?.remove();

      const canSkip = !survey.isMandatory;
      const modal = document.createElement('div');
      modal.id = 'modalServiceSurvey';
      modal.innerHTML = `<div class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          <div class="modal-header border-0 bg-primary bg-opacity-10 py-3">
            <div class="d-flex align-items-center gap-3">
              <div class="rounded-circle bg-white p-2 shadow-sm"><i class="bi bi-clipboard-data fs-4 text-primary"></i></div>
              <div><h5 class="fw-bold mb-0">${survey.title}</h5><p class="text-muted small mb-0">${survey.description || 'Tu opinión es muy importante para nosotros'}</p></div>
            </div>
            ${canSkip ? `<button type="button" class="btn-close" aria-label="Close" onclick="Encuestas.skipServiceSurvey('${survey.serviceType}')"></button>` : ''}
          </div>
          <div class="modal-body p-4 bg-light">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-center bg-white p-3 rounded-4 shadow-sm mb-4 border border-danger border-opacity-25">
               <div class="d-flex align-items-center gap-3 mb-3 mb-md-0">
                  <div class="bg-danger bg-opacity-10 text-danger p-2 rounded-circle"><i class="bi bi-info-circle fs-5"></i></div>
                  <div>
                    <h6 class="fw-bold mb-0 text-danger">¿No has utilizado este servicio?</h6>
                    <span class="small text-muted">Aviso: Si marcas esto, no se te volverá a mostrar la encuesta.</span>
                  </div>
               </div>
               <button type="button" class="btn btn-outline-danger rounded-pill px-4 fw-bold" onclick="Encuestas.skipServiceSurveyNotUsed('${survey.serviceType}')">
                 Omitir Encuesta
               </button>
            </div>
            ${survey.isMandatory ? '<div class="alert alert-warning border-0 shadow-sm mb-4"><i class="bi bi-exclamation-circle-fill me-2"></i><strong>Encuesta obligatoria.</strong> Por favor responde para continuar.</div>' : ''}
            <div id="service-survey-qs"></div>
          </div>
          <div class="modal-footer border-0 bg-white py-3 pb-5 pb-md-3 d-flex flex-wrap gap-2 justify-content-between">
            <div id="service-survey-pagination" class="d-flex gap-2 w-100 justify-content-center mb-2 align-items-center"></div>
            <div class="d-flex w-100 justify-content-between align-items-center">
              ${canSkip ? `<button type="button" class="btn btn-light rounded-pill px-4" onclick="Encuestas.skipServiceSurvey('${survey.serviceType}')">Recordar después</button>` : '<div></div>'}
              <button type="button" class="btn btn-primary rounded-pill px-5 fw-bold d-none" id="svc-submit-btn" onclick="Encuestas.submitServiceSurvey('${survey.serviceType}')">
                <i class="bi bi-send me-2"></i>Enviar Respuestas
              </button>
            </div>
          </div>
        </div>
      </div></div>`;

      document.body.appendChild(modal);
      const m = new bootstrap.Modal(modal.querySelector('.modal'));
      m.show();
      modal._survey = survey;
      window._activeServiceSurveyModal = modal;

      initSurveyPagination(survey.questions, 'service-survey-qs', 'service-survey-pagination', 'svc-submit-btn', modal);
    }

    async function submitServiceSurvey(serviceType) {
      const modal = window._activeServiceSurveyModal;
      const survey = modal?._survey;
      if (!survey) return;

      const answers = collectAnswers(survey.questions, 'service-survey-qs', modal._paginator);
      if (!answers) return;

      const btn = document.getElementById('svc-submit-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
      const ctx = _ctx || (window.SIA && window.SIA.getCtx ? window.SIA.getCtx() : null);

      try {
        await EncuestasServicioService.submitServiceSurveyResponse(ctx, serviceType, answers);

        // Mostrar agradecimiento y cerrar
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = `<div class="text-center py-5 animate-fade-in"><div class="mb-3" style="font-size:4rem">🎉</div><h3 class="fw-bold">¡Gracias por tu opinión!</h3><p class="text-muted">Tus respuestas nos ayudan a mejorar el servicio.</p></div>`;
        modal.querySelector('.modal-footer').remove();

        setTimeout(() => {
          bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
          modal.remove();
        }, 2000);

      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Enviar Respuestas';
      }
    }

    async function skipServiceSurvey(serviceType) {
      const modal = window._activeServiceSurveyModal;
      const ctx = _ctx || (window.SIA && window.SIA.getCtx ? window.SIA.getCtx() : null);
      try {
        await EncuestasServicioService.recordSurveySkip(ctx, serviceType);
        bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
        modal.remove();
      } catch (e) { console.error(e); }
    }

    async function skipServiceSurveyNotUsed(serviceType) {
      const modal = window._activeServiceSurveyModal;
      if (!modal) return;

      const modalBody = modal.querySelector('.modal-body');
      const originalBodyHTML = modalBody.innerHTML;
      const modalFooter = modal.querySelector('.modal-footer');
      const originalFooterHTML = modalFooter.innerHTML;

      modal._originalBodyHTML = originalBodyHTML;
      modal._originalFooterHTML = originalFooterHTML;

      modalBody.innerHTML = `
        <div class="text-center py-5 animate-fade-in">
          <div class="mb-3 text-warning" style="font-size:4rem"><i class="bi bi-patch-question"></i></div>
          <h4 class="fw-bold mb-3">¿Confirmas que NO has usado el servicio?</h4>
          <p class="text-muted px-3">Si confirmas esto, la encuesta se cerrará y no volverá a aparecer al menos que detectemos que usaste el servicio en el futuro.</p>
        </div>
      `;
      modalFooter.innerHTML = `
        <button type="button" class="btn btn-light rounded-pill px-4" onclick="Encuestas.cancelSkipServiceSurvey()">Volver a la encuesta</button>
        <button type="button" class="btn btn-danger rounded-pill px-4 fw-bold shadow-sm" id="confirm-skip-btn" onclick="Encuestas.confirmSkipServiceSurvey('${serviceType}')">Sí, confirmar</button>
      `;
    }

    function cancelSkipServiceSurvey() {
      const modal = window._activeServiceSurveyModal;
      if (!modal) return;
      modal.querySelector('.modal-body').innerHTML = modal._originalBodyHTML;
      modal.querySelector('.modal-footer').innerHTML = modal._originalFooterHTML;
    }

    async function confirmSkipServiceSurvey(serviceType) {
      const modal = window._activeServiceSurveyModal;
      const btn = document.getElementById('confirm-skip-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrando...'; }

      const ctx = _ctx || (window.SIA && window.SIA.getCtx ? window.SIA.getCtx() : null);

      try {
        await EncuestasServicioService.submitServiceSurveyResponse(ctx, serviceType, {
          skip_reason: 'not_used'
        });

        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = `<div class="text-center py-5 animate-fade-in"><div class="mb-3" style="font-size:4rem">👋</div><h3 class="fw-bold">Encuesta omitida</h3><p class="text-muted">Hemos registrado que no has hecho uso de este servicio aún.</p></div>`;
        modal.querySelector('.modal-footer').remove();

        setTimeout(() => {
          bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
          modal.remove();
        }, 2000);
      } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
        if (btn) { btn.disabled = false; btn.innerHTML = 'Sí, confirmar'; }
      }
    }

    async function restoreDefaultServiceSurvey(serviceType) {
      if (!confirm('¿Deseas reemplazar las preguntas personalizadas por las predeterminadas? Se perderán las preguntas actuales. (Esta acción también guardará la encuesta y actualizará la base de datos).')) return;
      try {
        const modal = window._activeServiceEditorModal;
        if (modal) {
          bootstrap.Modal.getInstance(modal.querySelector('.modal'))?.hide();
          modal.remove();
        }
        await createDefaultServiceSurvey(serviceType);
        showToast('Encuesta restaurada a sus valores por defecto.', 'success');
        setTimeout(() => { openServiceEditor(serviceType); }, 500); // reload modal slowly after close
      } catch (e) {
        alert('Error restaurando: ' + e.message);
      }
    }

    // ========== PAGINATION HELPER ==========
    function initSurveyPagination(questions, containerId, paginationId, submitBtnId, modalInstance) {
      const itemsPerPage = 1;
      const totalPages = Math.ceil(questions.length / itemsPerPage);
      let currentPage = 1;
      const answers = {};

      const paginator = {
        answers,
        saveCurrentPage: () => {
          const start = (currentPage - 1) * itemsPerPage;
          const end = start + itemsPerPage;
          const currentQs = questions.slice(start, end);

          const c = document.getElementById(containerId);
          if (!c) return;

          currentQs.forEach(q => {
            if (q.type === 'multiple' || q.type === 'boolean') {
              const sel = c.querySelector(`input[name$="_${q.id}"]:checked`);
              if (sel) { answers[q.id] = q.type === 'boolean' ? sel.value === 'true' : sel.value; }
            } else if (q.type === 'scale') {
              const el = c.querySelector(`[id$="_${q.id}_input"]`);
              if (el) answers[q.id] = Number(el.value);
            } else {
              const el = c.querySelector(`[id$="_${q.id}_input"]`);
              if (el) answers[q.id] = el.value.trim() || '';
            }
          });
        },
        restoreCurrentPage: () => {
          const c = document.getElementById(containerId);
          if (!c) return;
          Object.entries(answers).forEach(([id, val]) => {
            // Try check radio
            const radio = c.querySelector(`input[name$="_${id}"][value="${val}"]`);
            if (radio) {
              radio.checked = true;
              if (radio.onchange) radio.onchange(); // trigger style
            }
            // Try filling others
            const el = c.querySelector(`[id$="_${id}_input"]`);
            if (el && radio === null) {
              el.value = val;
            }
          });
        },
        renderPage: (page) => {
          paginator.saveCurrentPage();
          currentPage = page;
          const start = (page - 1) * itemsPerPage;
          const end = start + itemsPerPage;
          const qsToRender = questions.slice(start, end);

          const container = document.getElementById(containerId);
          container.innerHTML = renderQuestionsHTML(qsToRender, 'pag_q_' + page);
          container.scrollTop = 0; // scroll top

          setTimeout(() => {
            paginator.restoreCurrentPage();
          }, 50);

          renderControls();
        }
      };

      function renderControls() {
        const p = document.getElementById(paginationId);
        if (!p) return;

        const isFirst = currentPage === 1;
        const isLast = currentPage === totalPages;

        p.innerHTML = `
          <button type="button" class="btn btn-outline-secondary rounded-pill fw-bold btn-sm" ${isFirst ? 'disabled' : ''} onclick="window._activeSurveyPaginator.renderPage(${currentPage - 1})">
            <i class="bi bi-arrow-left me-1"></i>Anterior
          </button>
          <span class="d-flex align-items-center text-muted small fw-bold mx-2">
             ${currentPage} / ${totalPages}
          </span>
          <button type="button" class="btn btn-primary rounded-pill fw-bold btn-sm" ${isLast ? 'disabled d-none' : ''} onclick="window._activeSurveyPaginator.renderPage(${currentPage + 1})">
            Siguiente<i class="bi bi-arrow-right ms-1"></i>
          </button>
        `;

        const submitBtn = document.getElementById(submitBtnId);
        if (submitBtn) {
          if (isLast) { submitBtn.classList.remove('d-none'); }
          else { submitBtn.classList.add('d-none'); }
        }
      }

      window._activeSurveyPaginator = paginator;
      modalInstance._paginator = paginator;
      paginator.renderPage(1);
    }

    // ========== PUBLIC API ==========
    return {
      init, initPublic, switchTab, openCreateModal, addQuestion, addQuestionToBuilder, onTypeChange, addOption,
      toggleAllAudience, togglePublicMode, saveSurvey, toggleSurvey, deleteSurvey, showQR,
      openStudentSurvey, submitStudentSurvey, submitPublicSurvey, loadResults, viewResponse,
      exportCSV, initStudentView, initAdminView,
      renderEncuestasServicioTab, openServiceConfig, openServiceEditor, saveServiceEditor, toggleServiceSurveyStatus,
      triggerServiceSurveyToAll, deactivateServiceSurveyToAll, createDefaultServiceSurvey,
      viewServiceResults, viewServiceResponse, exportServiceCSV,
      checkAndShowServiceSurvey, skipServiceSurvey, submitServiceSurvey, skipServiceSurveyNotUsed, cancelSkipServiceSurvey, confirmSkipServiceSurvey, restoreDefaultServiceSurvey
    };
  })();
}
window.Encuestas = Encuestas;
