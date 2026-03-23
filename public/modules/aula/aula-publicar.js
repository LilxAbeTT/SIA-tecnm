/* ============================================================
   AulaPublicar - Modal para crear/editar publicaciones
   ============================================================ */
(function (global) {
  const AulaPublicar = (function () {
    let _ctx = null;
    let _claseId = null;
    let _editPub = null;
    let _currentStep = 1;

    const MODAL_ID = 'aula-publicar-modal';
    const URL_MODAL_ID = 'aula-publicar-url-modal';
    const MAX_ATTACHMENTS = 10;
    const MAX_UPLOAD_FILES = 5;

    const TYPE_META = {
      tarea: { icon: 'bi-file-earmark-text', color: '#2563eb', bg: '#dbeafe', title: 'Tarea', desc: 'Fecha, puntaje, entregas y rubrica' },
      material: { icon: 'bi-folder2-open', color: '#7c3aed', bg: '#ede9fe', title: 'Material', desc: 'Recursos, guias o lecturas de apoyo' },
      aviso: { icon: 'bi-megaphone', color: '#ea580c', bg: '#ffedd5', title: 'Aviso', desc: 'Mensajes rapidos y comunicados importantes' },
      encuesta: { icon: 'bi-bar-chart', color: '#16a34a', bg: '#dcfce7', title: 'Encuesta', desc: 'Votacion o sondeo corto para el grupo' },
      discusion: { icon: 'bi-chat-dots', color: '#0891b2', bg: '#cffafe', title: 'Discusion', desc: 'Conversacion guiada para participar' }
    };

    const TYPE_COPY = {
      tarea: ['Titulo de la tarea', 'Ej. Ensayo 1: analisis del articulo principal', 'Instrucciones para tus estudiantes', 'Describe que deben entregar, formato y criterios importantes.'],
      material: ['Titulo del material', 'Ej. Presentacion de la unidad 3', 'Descripcion o instrucciones', 'Explica para que sirve este material y como deben usarlo.'],
      aviso: ['Titulo del aviso', 'Ej. Cambio de horario del laboratorio', 'Mensaje principal', 'Escribe el aviso con el contexto y la accion esperada.'],
      encuesta: ['Titulo de la encuesta', 'Ej. Retroalimentacion de la practica', 'Contexto para responder', 'Cuenta para que sirve la encuesta y que esperas obtener.'],
      discusion: ['Titulo de la discusion', 'Ej. Debate sobre energias renovables', 'Pregunta detonadora', 'Plantea el tema o pregunta que quieres discutir con la clase.']
    };

    function esc(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    function toast(msg, type) {
      if (global.SIA?.toast) global.SIA.toast(msg, type);
      else if (global.showToast) global.showToast(msg, type);
    }

    function $id(id) {
      return document.getElementById(id);
    }

    function pad(value) {
      return String(value || 0).padStart(2, '0');
    }

    function formatDateInput(date) {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function formatTimeInput(date) {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function getModalEl() {
      return $id(MODAL_ID);
    }

    function getSelectedTipo() {
      if (_editPub?.tipo) return _editPub.tipo;
      return document.querySelector('input[name="aula-pub-tipo"]:checked')?.value || 'tarea';
    }

    function readBool(name, fallback) {
      const input = document.querySelector(`input[name="${name}"]:checked`);
      return input ? input.value === 'true' : fallback;
    }

    function setBool(name, value) {
      const input = document.querySelector(`input[name="${name}"][value="${value ? 'true' : 'false'}"]`);
      if (input) input.checked = true;
    }

    function openModal(ctx, claseId, editPub) {
      _ctx = ctx;
      _claseId = claseId;
      _editPub = editPub || null;
      _currentStep = 1;

      _injectModal();
      _bindModalEvents();

      if (_editPub) _populateEdit(_editPub);
      else _renderTypeSections('tarea');

      _syncStepUI();
      _updateCounters();
      _updateDueSummary();
      _updatePuntajePresets();
      _refreshAttachmentEmptyState();

      bootstrap.Modal.getOrCreateInstance(getModalEl()).show();
    }

    function _injectModal() {
      $id(MODAL_ID)?.remove();
      $id(URL_MODAL_ID)?.remove();

      const isEdit = Boolean(_editPub);
      const selectedType = _editPub?.tipo || 'tarea';
      const typeCard = TYPE_META[selectedType] || TYPE_META.tarea;
      const copy = TYPE_COPY[selectedType] || TYPE_COPY.tarea;

      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="${MODAL_ID}" tabindex="-1">
          <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable aula-publicar-dialog">
            <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden aula-pub-modal">
              <div class="modal-header border-0 px-4 pt-4 pb-3">
                <div class="min-width-0">
                  <div class="aula-pub-eyebrow">${isEdit ? 'Editar publicacion' : 'Nueva publicacion'}</div>
                  <h5 class="modal-title fw-bold mb-1">${isEdit ? 'Ajusta la publicacion' : 'Publica algo para tu clase'}</h5>
                  <div class="small text-muted">Configuracion rapida, rubrica separada y adjuntos claros para docentes.</div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>

              <div class="modal-body px-4 pt-0 pb-4">
                <div class="aula-pub-stepper mb-4">
                  <div class="aula-pub-step is-active" data-step="1">
                    <span class="aula-pub-step-num">1</span>
                    <div><div class="fw-semibold small">Configuracion</div><div class="text-muted small">Tipo, titulo e instrucciones</div></div>
                  </div>
                  <div class="aula-pub-step" data-step="2">
                    <span class="aula-pub-step-num">2</span>
                    <div><div class="fw-semibold small">Rubrica y archivos</div><div class="text-muted small">Adjuntos y revision final</div></div>
                  </div>
                </div>

                <div class="aula-pub-toolbar mb-4">
                  ${!isEdit ? `
                    <button type="button" class="aula-pub-tool-card" id="aula-pub-cargar-plantilla">
                      <span class="aula-pub-tool-icon"><i class="bi bi-collection"></i></span>
                      <span><span class="d-block fw-semibold">Usar plantilla</span><span class="d-block text-muted small">Carga una estructura ya guardada</span></span>
                    </button>` : ''}
                  <button type="button" class="aula-pub-tool-card" id="aula-pub-guardar-plantilla">
                    <span class="aula-pub-tool-icon"><i class="bi bi-bookmark-plus"></i></span>
                    <span><span class="d-block fw-semibold">Guardar como plantilla</span><span class="d-block text-muted small">Reutiliza esta configuracion mas adelante</span></span>
                  </button>
                </div>

                <div id="aula-pub-template-zone"></div>

                <section id="aula-pub-step-1">
                  ${!isEdit ? _renderTypeSelector(selectedType) : `
                    <div class="aula-pub-section">
                      <div class="aula-pub-section-head">
                        <div><h6 class="fw-bold mb-1">Tipo de publicacion</h6><p class="text-muted small mb-0">En modo edicion se conserva el tipo actual.</p></div>
                      </div>
                      <div class="aula-type-summary">
                        <span class="aula-type-summary-icon" style="background:${typeCard.bg};color:${typeCard.color};"><i class="bi ${typeCard.icon}"></i></span>
                        <div><div class="fw-semibold">${typeCard.title}</div><div class="small text-muted">${typeCard.desc}</div></div>
                      </div>
                    </div>`}

                  <div class="aula-pub-section">
                    <div class="aula-pub-section-head">
                      <div><h6 class="fw-bold mb-1" id="aula-pub-title-label">${copy[0]}</h6><p class="text-muted small mb-0">Usa un nombre corto y facil de reconocer para el docente y el estudiante.</p></div>
                      <span class="aula-pub-counter" id="aula-pub-titulo-count">0 / 200</span>
                    </div>
                    <input type="text" class="form-control form-control-lg rounded-4" id="aula-pub-titulo" maxlength="200" placeholder="${esc(copy[1])}">
                  </div>

                  <div class="aula-pub-section">
                    <div class="aula-pub-section-head">
                      <div><h6 class="fw-bold mb-1" id="aula-pub-content-label">${copy[2]}</h6><p class="text-muted small mb-0">Llena solo lo necesario. Mientras mas claro quede aqui, menos dudas habra despues.</p></div>
                      <span class="aula-pub-counter" id="aula-pub-contenido-count">0 / 5000</span>
                    </div>
                    <textarea class="form-control rounded-4 aula-pub-textarea" id="aula-pub-contenido" rows="6" maxlength="5000" placeholder="${esc(copy[3])}"></textarea>
                  </div>

                  <div id="aula-pub-dynamic"></div>
                </section>

                <section id="aula-pub-step-2" class="d-none">
                  <div id="aula-pub-rubrica-wrapper"></div>

                  <div class="aula-pub-section">
                    <div class="aula-pub-section-head">
                      <div><h6 class="fw-bold mb-1">Archivos y enlaces</h6><p class="text-muted small mb-0">Agrega una URL o sube un archivo para que quede claro lo que compartiste.</p></div>
                    </div>
                    <div class="d-flex gap-2 flex-wrap mb-3">
                      <button type="button" class="btn btn-outline-secondary rounded-pill px-3" id="aula-pub-add-url"><i class="bi bi-link-45deg me-1"></i>URL</button>
                      <button type="button" class="btn btn-outline-primary rounded-pill px-3" id="aula-pub-upload-btn"><i class="bi bi-paperclip me-1"></i>Subir archivo</button>
                      <input type="file" id="aula-pub-file-input" class="d-none" multiple>
                    </div>
                    <div id="aula-pub-upload-status" class="small text-muted mb-2"></div>
                    <div id="aula-pub-attachments-empty" class="aula-pub-empty-state">
                      <div class="aula-pub-empty-icon"><i class="bi bi-paperclip"></i></div>
                      <div><div class="fw-semibold">Todavia no hay adjuntos</div><div class="small text-muted">Cada recurso quedara con nombre claro y accion para abrirlo.</div></div>
                    </div>
                    <div id="aula-pub-attachments" class="aula-attachment-grid"></div>
                  </div>
                </section>
              </div>

              <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex flex-wrap justify-content-between gap-2">
                <div class="small text-muted" id="aula-pub-footer-hint">Paso 1 de 2. Completa la configuracion principal.</div>
                <div class="d-flex gap-2 ms-auto">
                  <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                  <button type="button" class="btn btn-outline-secondary rounded-pill px-4 d-none" id="aula-pub-back"><i class="bi bi-arrow-left me-1"></i>Atras</button>
                  <button type="button" class="btn btn-primary rounded-pill px-4 shadow-sm" id="aula-pub-next">Siguiente<i class="bi bi-arrow-right ms-1"></i></button>
                  <button type="button" class="btn btn-primary rounded-pill px-4 shadow-sm d-none" id="aula-pub-submit"><i class="bi bi-send me-1"></i>${isEdit ? 'Guardar' : 'Publicar'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      document.body.appendChild(div.firstElementChild);
    }

    function _renderTypeSelector(selectedType) {
      return `
        <div class="aula-pub-section">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Tipo de publicacion</h6><p class="text-muted small mb-0">Elige la opcion que mas se parezca a lo que quieres comunicar.</p></div>
          </div>
          <div class="aula-type-grid">
            ${Object.entries(TYPE_META).map(([key, meta]) => `
              <input type="radio" class="btn-check" name="aula-pub-tipo" id="aula-pub-tipo-${key}" value="${key}" ${selectedType === key ? 'checked' : ''}>
              <label class="aula-type-card" for="aula-pub-tipo-${key}">
                <span class="aula-type-card-icon" style="background:${meta.bg};color:${meta.color};"><i class="bi ${meta.icon}"></i></span>
                <span class="fw-semibold d-block">${meta.title}</span>
                <span class="small text-muted d-block">${meta.desc}</span>
              </label>`).join('')}
          </div>
        </div>`;
    }

    function _renderTypeSections(tipo) {
      const dynamic = $id('aula-pub-dynamic');
      const rubricaWrapper = $id('aula-pub-rubrica-wrapper');
      const copy = TYPE_COPY[tipo] || TYPE_COPY.tarea;
      if (!dynamic || !rubricaWrapper) return;

      if ($id('aula-pub-title-label')) $id('aula-pub-title-label').textContent = copy[0];
      if ($id('aula-pub-titulo')) $id('aula-pub-titulo').placeholder = copy[1];
      if ($id('aula-pub-content-label')) $id('aula-pub-content-label').textContent = copy[2];
      if ($id('aula-pub-contenido')) $id('aula-pub-contenido').placeholder = copy[3];

      dynamic.innerHTML = tipo === 'tarea' ? _renderTaskFields() : (tipo === 'encuesta' ? _renderEncuestaFields() : _renderGenericHint(tipo));
      rubricaWrapper.innerHTML = tipo === 'tarea' ? _renderRubricaSection() : _renderSecondStepHint(tipo);

      if (tipo === 'tarea') {
        _setActiveDatePreset(($id('aula-pub-fecha-date')?.value || '') ? 'custom' : 'none');
        if ($id('aula-pub-puntaje') && !$id('aula-pub-puntaje').value) $id('aula-pub-puntaje').value = '100';
        _loadGroupOptions();
        _syncRubricaMode();
        _updatePuntajePresets();
      }
    }

    function _renderTaskFields() {
      return `
        <div class="aula-pub-section">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Fecha de entrega</h6><p class="text-muted small mb-0">Usa una opcion rapida o ajusta fecha y hora manualmente.</p></div>
            <span class="aula-pub-summary" id="aula-pub-fecha-preview">Sin fecha limite</span>
          </div>
          <div class="aula-pub-presets mb-3">
            <button type="button" class="btn btn-light rounded-pill aula-pub-date-preset" data-preset="none">Sin fecha</button>
            <button type="button" class="btn btn-light rounded-pill aula-pub-date-preset" data-preset="tomorrow">Mañana</button>
            <button type="button" class="btn btn-light rounded-pill aula-pub-date-preset" data-preset="week">En una semana</button>
            <button type="button" class="btn btn-light rounded-pill aula-pub-date-preset" data-preset="custom">Elegir fecha</button>
          </div>
          <div class="row g-2">
            <div class="col-md-7"><input type="date" class="form-control rounded-4" id="aula-pub-fecha-date"></div>
            <div class="col-md-5"><input type="time" class="form-control rounded-4" id="aula-pub-fecha-time" value="23:59"></div>
          </div>
        </div>

        <div class="aula-pub-section">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Puntos totales</h6><p class="text-muted small mb-0">Escoge un valor comun o escribe uno personalizado.</p></div>
          </div>
          <div class="aula-pub-presets mb-3">
            ${[10, 20, 50, 100].map(points => `<button type="button" class="btn btn-light rounded-pill aula-pub-points-preset" data-points="${points}">${points} pts</button>`).join('')}
          </div>
          <div class="input-group input-group-lg">
            <span class="input-group-text bg-white">Puntos</span>
            <input type="number" class="form-control" id="aula-pub-puntaje" min="1" max="1000" value="100">
            <span class="input-group-text bg-white">max.</span>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-md-6">${_renderChoiceField('aula-pub-tardia', 'Entrega tardia', 'Define si la tarea se puede enviar despues de la fecha limite.', [
            ['false', 'No permitir', 'La tarea se cierra al vencer.'],
            ['true', 'Permitir', 'Se acepta despues de la fecha limite.']
          ])}</div>
          <div class="col-md-6">${_renderChoiceField('aula-pub-visible-carrera', 'Visibilidad en comunidad', 'Aclara si tambien aparecera para estudiantes de la misma carrera.', [
            ['false', 'Solo esta clase', 'La ven solo los miembros del grupo.'],
            ['true', 'Compartir con la carrera', 'Se muestra en comunidad y tareas calificadas.']
          ])}</div>
        </div>

        <div class="aula-pub-section mb-0">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Asignar a</h6><p class="text-muted small mb-0">Elige si la tarea es para toda la clase o para un grupo en particular.</p></div>
          </div>
          <select class="form-select rounded-4" id="aula-pub-grupo-select"><option value="">Toda la clase</option></select>
        </div>`;
    }

    function _renderChoiceField(name, title, copy, options) {
      return `
        <div class="aula-pub-section h-100 mb-0">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">${title}</h6><p class="text-muted small mb-0">${copy}</p></div>
          </div>
          <div class="aula-choice-grid aula-choice-grid--compact">
            ${options.map(([value, label, desc], index) => `
              <input type="radio" class="btn-check" name="${name}" id="${name}-${index}" value="${value}" ${index === 0 ? 'checked' : ''}>
              <label class="aula-choice-card" for="${name}-${index}">
                <span class="fw-semibold d-block">${label}</span>
                <span class="small text-muted d-block">${desc}</span>
              </label>`).join('')}
          </div>
        </div>`;
    }

    function _renderEncuestaFields() {
      return `
        <div class="aula-pub-section">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Opciones de la encuesta</h6><p class="text-muted small mb-0">Agrega al menos dos opciones y mantenlas faciles de leer.</p></div>
          </div>
          <div id="aula-pub-opciones" class="vstack gap-2 mb-3">
            <input type="text" class="form-control rounded-4 aula-opcion-input" placeholder="Opcion 1" maxlength="200">
            <input type="text" class="form-control rounded-4 aula-opcion-input" placeholder="Opcion 2" maxlength="200">
          </div>
          <button type="button" class="btn btn-outline-secondary rounded-pill px-3" id="aula-pub-add-opcion"><i class="bi bi-plus me-1"></i>Agregar opcion</button>
        </div>

        <div class="aula-pub-section mb-0">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Resultados visibles</h6><p class="text-muted small mb-0">Elige si los votantes pueden ver el resultado acumulado.</p></div>
          </div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="aula-pub-resultados-visibles" checked>
            <label class="form-check-label small" for="aula-pub-resultados-visibles">Mostrar resultados a los votantes</label>
          </div>
        </div>`;
    }

    function _renderGenericHint(tipo) {
      const meta = TYPE_META[tipo] || TYPE_META.aviso;
      return `<div class="aula-pub-section mb-0"><div class="aula-type-summary"><span class="aula-type-summary-icon" style="background:${meta.bg};color:${meta.color};"><i class="bi ${meta.icon}"></i></span><div><div class="fw-semibold">${meta.title}</div><div class="small text-muted">${meta.desc}. En el siguiente paso podras adjuntar archivos o enlaces.</div></div></div></div>`;
    }

    function _renderSecondStepHint(tipo) {
      const meta = TYPE_META[tipo] || TYPE_META.aviso;
      return `<div class="aula-pub-section aula-pub-section--soft"><div class="aula-type-summary"><span class="aula-type-summary-icon" style="background:${meta.bg};color:${meta.color};"><i class="bi ${meta.icon}"></i></span><div><div class="fw-semibold">${meta.title} sin rubrica</div><div class="small text-muted">Para este tipo de publicacion solo necesitas revisar adjuntos y despues publicar.</div></div></div></div>`;
    }

    function _renderRubricaSection() {
      return `
        <div class="aula-pub-section">
          <div class="aula-pub-section-head">
            <div><h6 class="fw-bold mb-1">Rubrica de evaluacion</h6><p class="text-muted small mb-0">Activa la rubrica si quieres calificar por criterios y pesos.</p></div>
            <span class="aula-pub-summary" id="aula-pub-rubrica-summary">Opcional</span>
          </div>
          ${_renderChoiceField('aula-pub-rubrica-enabled', 'Modo de evaluacion', 'Puedes seguir sin rubrica o apoyarte en criterios.', [
            ['false', 'Sin rubrica', 'Calificacion directa con puntaje total.'],
            ['true', 'Usar rubrica', 'Criterios con pesos para calificar mejor.']
          ])}
          <div id="aula-pub-rubrica-section" class="d-none">
            <div class="aula-rubrica-note mb-3"><i class="bi bi-info-circle me-1"></i>Los niveles seran: Excelente 100%, Bien 75%, Regular 50% e Insuficiente 25%.</div>
            <div id="aula-pub-criterios" class="vstack gap-2 mb-3"></div>
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div class="d-flex gap-2 flex-wrap">
                <button type="button" class="btn btn-outline-secondary rounded-pill px-3" id="aula-pub-add-criterio"><i class="bi bi-plus me-1"></i>Agregar criterio</button>
                <button type="button" class="btn btn-outline-primary rounded-pill px-3" id="aula-pub-rubrica-sugerida"><i class="bi bi-stars me-1"></i>Usar rubrica basica</button>
              </div>
              <span class="aula-pub-summary" id="aula-pub-rubrica-peso-total">Total: <strong id="aula-pub-peso-num">0</strong>% / 100%</span>
            </div>
            <div id="aula-pub-rubrica-error" class="small text-danger mt-2 d-none"><i class="bi bi-exclamation-triangle me-1"></i>Los pesos deben sumar exactamente 100%.</div>
          </div>
        </div>`;
    }

    function _bindModalEvents() {
      const modalEl = getModalEl();
      if (!modalEl) return;

      modalEl.addEventListener('click', async event => {
        const target = event.target;

        if (target.closest('#aula-pub-next')) { _currentStep = 2; _syncStepUI(); return; }
        if (target.closest('#aula-pub-back')) { _currentStep = 1; _syncStepUI(); return; }
        if (target.closest('#aula-pub-submit')) { await _handleSubmit(); return; }
        if (target.closest('#aula-pub-cargar-plantilla')) { await _openPlantillasPanel(); return; }
        if (target.closest('#aula-pub-guardar-plantilla')) { await _handleSaveTemplate(); return; }
        if (target.closest('#aula-pub-add-url')) { _openUrlModal(); return; }
        if (target.closest('#aula-pub-upload-btn')) { $id('aula-pub-file-input')?.click(); return; }
        if (target.closest('#aula-pub-add-opcion')) { _addOpcionInput(); return; }
        if (target.closest('#aula-pub-add-criterio')) { _addCriterioRow('', 0); _updateRubricaTotals(); return; }
        if (target.closest('#aula-pub-rubrica-sugerida')) { _applyBasicRubrica(true); return; }
        if (target.closest('.aula-criterio-remove')) { target.closest('.aula-criterio-row')?.remove(); _updateRubricaTotals(); return; }
        if (target.closest('.aula-attachment-remove')) { target.closest('.aula-attachment-card')?.remove(); _refreshAttachmentEmptyState(); }

        const datePreset = target.closest('.aula-pub-date-preset');
        if (datePreset) { _applyDatePreset(datePreset.dataset.preset); return; }

        const pointsPreset = target.closest('.aula-pub-points-preset');
        if (pointsPreset) {
          const input = $id('aula-pub-puntaje');
          if (input) input.value = pointsPreset.dataset.points;
          _updatePuntajePresets();
        }
      });

      modalEl.addEventListener('input', event => {
        const target = event.target;
        if (target.id === 'aula-pub-titulo' || target.id === 'aula-pub-contenido') _updateCounters();
        if (target.id === 'aula-pub-fecha-date' || target.id === 'aula-pub-fecha-time') {
          _setActiveDatePreset('custom');
          _updateDueSummary();
        }
        if (target.id === 'aula-pub-puntaje') _updatePuntajePresets();
        if (target.classList.contains('aula-criterio-peso')) _updateRubricaTotals();
      });

      modalEl.addEventListener('change', async event => {
        const target = event.target;
        if (target.name === 'aula-pub-tipo') _renderTypeSections(target.value);
        if (target.name === 'aula-pub-rubrica-enabled') _syncRubricaMode();
        if (target.id === 'aula-pub-file-input') await _handleFileUpload(event);
      });

      modalEl.addEventListener('hidden.bs.modal', () => {
        bootstrap.Modal.getInstance($id(URL_MODAL_ID))?.hide();
        $id(URL_MODAL_ID)?.remove();
        modalEl.remove();
        _editPub = null;
        _currentStep = 1;
      }, { once: true });
    }

    function _syncStepUI() {
      $id('aula-pub-step-1')?.classList.toggle('d-none', _currentStep !== 1);
      $id('aula-pub-step-2')?.classList.toggle('d-none', _currentStep !== 2);
      $id('aula-pub-next')?.classList.toggle('d-none', _currentStep !== 1);
      $id('aula-pub-back')?.classList.toggle('d-none', _currentStep !== 2);
      $id('aula-pub-submit')?.classList.toggle('d-none', _currentStep !== 2);
      if ($id('aula-pub-footer-hint')) {
        $id('aula-pub-footer-hint').textContent = _currentStep === 1
          ? 'Paso 1 de 2. Completa la configuracion principal.'
          : 'Paso 2 de 2. Revisa rubrica, adjuntos y publica cuando este listo.';
      }
      document.querySelectorAll('.aula-pub-step').forEach(el => {
        const step = parseInt(el.dataset.step, 10);
        el.classList.toggle('is-active', step === _currentStep);
        el.classList.toggle('is-done', step < _currentStep);
      });
    }

    function _updateCounters() {
      if ($id('aula-pub-titulo-count')) $id('aula-pub-titulo-count').textContent = `${($id('aula-pub-titulo')?.value || '').length} / 200`;
      if ($id('aula-pub-contenido-count')) $id('aula-pub-contenido-count').textContent = `${($id('aula-pub-contenido')?.value || '').length} / 5000`;
    }

    function _applyDatePreset(preset) {
      const dateInput = $id('aula-pub-fecha-date');
      const timeInput = $id('aula-pub-fecha-time');
      if (!dateInput || !timeInput) return;
      const now = new Date();
      let target = null;
      if (preset === 'tomorrow') {
        target = new Date(now);
        target.setDate(target.getDate() + 1);
        target.setHours(23, 59, 0, 0);
      } else if (preset === 'week') {
        target = new Date(now);
        target.setDate(target.getDate() + 7);
        target.setHours(23, 59, 0, 0);
      } else if (preset === 'custom') {
        dateInput.showPicker?.();
        dateInput.focus();
        _setActiveDatePreset('custom');
        return;
      }

      if (preset === 'none') {
        dateInput.value = '';
        timeInput.value = '23:59';
      } else if (target) {
        dateInput.value = formatDateInput(target);
        timeInput.value = formatTimeInput(target);
      }
      _setActiveDatePreset(preset);
      _updateDueSummary();
    }

    function _setActiveDatePreset(preset) {
      document.querySelectorAll('.aula-pub-date-preset').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
    }

    function _getDueDate() {
      const dateVal = $id('aula-pub-fecha-date')?.value || '';
      const timeVal = $id('aula-pub-fecha-time')?.value || '23:59';
      return dateVal ? new Date(`${dateVal}T${timeVal}:00`) : null;
    }

    function _updateDueSummary() {
      const el = $id('aula-pub-fecha-preview');
      if (!el) return;
      const due = _getDueDate();
      el.textContent = due && !Number.isNaN(due.getTime())
        ? `${due.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · ${due.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sin fecha limite';
    }

    function _updatePuntajePresets() {
      const value = parseInt($id('aula-pub-puntaje')?.value || '0', 10);
      document.querySelectorAll('.aula-pub-points-preset').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.points, 10) === value));
    }

    async function _loadGroupOptions(selectedId) {
      const select = $id('aula-pub-grupo-select');
      if (!select || !_ctx || !_claseId) return;
      select.innerHTML = '<option value="">Toda la clase</option>';
      try {
        const grupos = await global.AulaService.getGrupos(_ctx, _claseId);
        grupos.forEach(grupo => {
          const option = document.createElement('option');
          option.value = grupo.id;
          option.textContent = grupo.nombre;
          select.appendChild(option);
        });
        if (selectedId) select.value = selectedId;
      } catch (_) {}
    }

    function _addOpcionInput() {
      const wrap = $id('aula-pub-opciones');
      if (!wrap) return;
      const count = wrap.querySelectorAll('.aula-opcion-input').length;
      if (count >= 10) return toast('Maximo 10 opciones', 'warning');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control rounded-4 aula-opcion-input';
      input.maxLength = 200;
      input.placeholder = `Opcion ${count + 1}`;
      wrap.appendChild(input);
    }

    function _syncRubricaMode() {
      const enabled = readBool('aula-pub-rubrica-enabled', false);
      $id('aula-pub-rubrica-section')?.classList.toggle('d-none', !enabled);
      if ($id('aula-pub-rubrica-summary')) $id('aula-pub-rubrica-summary').textContent = enabled ? 'Rubrica activa' : 'Opcional';
      if (enabled && !$id('aula-pub-criterios')?.children.length) _applyBasicRubrica(false);
      _updateRubricaTotals();
    }

    function _applyBasicRubrica(reset) {
      const wrap = $id('aula-pub-criterios');
      if (!wrap) return;
      const on = document.querySelector('input[name="aula-pub-rubrica-enabled"][value="true"]');
      if (on && !on.checked) on.checked = true;
      if (reset) wrap.innerHTML = '';
      if (!wrap.children.length) {
        _addCriterioRow('Contenido', 60);
        _addCriterioRow('Presentacion', 40);
      }
      _syncRubricaMode();
    }

    function _addCriterioRow(nombre, peso) {
      const wrap = $id('aula-pub-criterios');
      if (!wrap) return;
      const row = document.createElement('div');
      row.className = 'aula-criterio-row';
      row.innerHTML = `
        <div class="aula-criterio-head">
          <div class="flex-grow-1">
            <label class="small fw-semibold text-muted d-block mb-1">Criterio</label>
            <input type="text" class="form-control rounded-4 aula-criterio-nombre" maxlength="80" placeholder="Ej. Contenido, claridad, organizacion" value="${esc(nombre || '')}">
          </div>
          <div class="aula-criterio-weight">
            <label class="small fw-semibold text-muted d-block mb-1">Peso</label>
            <div class="input-group"><input type="number" class="form-control aula-criterio-peso" min="0" max="100" value="${peso || 0}"><span class="input-group-text">%</span></div>
          </div>
          <button type="button" class="btn btn-outline-danger rounded-circle aula-criterio-remove" title="Eliminar criterio"><i class="bi bi-x"></i></button>
        </div>
        <div class="aula-criterio-levels">
          <span class="badge bg-success-subtle text-success">Excelente 100%</span>
          <span class="badge bg-primary-subtle text-primary">Bien 75%</span>
          <span class="badge bg-warning-subtle text-warning">Regular 50%</span>
          <span class="badge bg-danger-subtle text-danger">Insuficiente 25%</span>
        </div>`;
      wrap.appendChild(row);
    }

    function _updateRubricaTotals() {
      const enabled = readBool('aula-pub-rubrica-enabled', false);
      const total = Array.from(document.querySelectorAll('.aula-criterio-peso')).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
      if ($id('aula-pub-peso-num')) $id('aula-pub-peso-num').textContent = String(total);
      $id('aula-pub-rubrica-error')?.classList.toggle('d-none', !enabled || total === 100 || !document.querySelectorAll('.aula-criterio-peso').length);
    }

    function _getRubrica() {
      if (!readBool('aula-pub-rubrica-enabled', false)) return null;
      const criterios = Array.from(document.querySelectorAll('.aula-criterio-row')).map(row => {
        const criterio = row.querySelector('.aula-criterio-nombre')?.value.trim() || '';
        const peso = parseFloat(row.querySelector('.aula-criterio-peso')?.value || '0') || 0;
        if (!criterio || peso <= 0) return null;
        return {
          criterio,
          peso,
          niveles: [
            { label: 'Excelente', pct: 100 },
            { label: 'Bien', pct: 75 },
            { label: 'Regular', pct: 50 },
            { label: 'Insuficiente', pct: 25 }
          ]
        };
      }).filter(Boolean);
      if (!criterios.length) return null;
      const total = criterios.reduce((sum, criterio) => sum + criterio.peso, 0);
      if (Math.round(total) !== 100) {
        toast('Los pesos de la rubrica deben sumar 100%', 'warning');
        return undefined;
      }
      return criterios;
    }

    function _attachmentCards() {
      return Array.from(document.querySelectorAll('.aula-attachment-card[data-ready="true"]'));
    }

    function _attachmentCount(all) {
      return all ? document.querySelectorAll('.aula-attachment-card').length : _attachmentCards().length;
    }

    function _normalizeAttachment(resource) {
      const rawUrl = String(resource?.url || '').trim();
      const info = _inferLinkDetails(rawUrl);
      const rawTipo = String(resource?.tipo || resource?.tipoAdjunto || '').trim().toLowerCase();
      const tipo = rawTipo
        ? (rawTipo === 'url' ? 'url' : 'file')
        : ((resource?.origen === 'upload' || resource?.mime || resource?.mimeType) ? 'file' : 'url');
      const mime = String(resource?.mime || resource?.mimeType || '').trim();
      const subtitulo = String(
        resource?.subtitulo
        || resource?.subtitle
        || (tipo === 'file' ? 'Archivo subido a Aula' : info?.subtitle || '')
      ).trim();
      const rawNombre = String(resource?.nombre || resource?.titulo || '').trim();
      return {
        nombre: rawNombre || info?.title || 'Adjunto',
        url: info?.url || rawUrl,
        tipo,
        mime,
        subtitulo
      };
    }

    function _collectAttachments() {
      return _attachmentCards().map(card => {
        const nombre = card.querySelector('.aula-attachment-name')?.value.trim() || '';
        const url = card.querySelector('.aula-attachment-url')?.value.trim() || '';
        const tipo = card.querySelector('.aula-attachment-kind')?.value || 'url';
        const mime = card.querySelector('.aula-attachment-mime')?.value || '';
        const subtitulo = card.querySelector('.aula-attachment-subtitle')?.value.trim() || '';
        if (!url) return null;
        return _normalizeAttachment({ nombre, url, tipo, mime, subtitulo });
      }).filter(Boolean);
    }

    function _inferLinkDetails(rawUrl) {
      try {
        const normalized = /^https?:\/\//i.test(String(rawUrl || '').trim()) ? String(rawUrl).trim() : `https://${String(rawUrl || '').trim()}`;
        const url = new URL(normalized);
        const host = url.hostname.replace(/^www\./i, '');
        const pieces = url.pathname.split('/').filter(Boolean);
        let title = host;
        if (/youtube\.com|youtu\.be/i.test(host)) title = 'Video de YouTube';
        else if (/drive\.google\.com/i.test(host)) title = 'Archivo de Google Drive';
        else if (/docs\.google\.com/i.test(host)) title = 'Documento de Google';
        else if (pieces.length) {
          const last = decodeURIComponent(pieces[pieces.length - 1]).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
          if (last) title = last.charAt(0).toUpperCase() + last.slice(1);
        }
        return { url: url.toString(), title, subtitle: `${host}${url.pathname && url.pathname !== '/' ? ` · ${url.pathname}` : ''}` };
      } catch (_) {
        return null;
      }
    }

    function _openUrlModal() {
      if (_attachmentCount(true) >= MAX_ATTACHMENTS) return toast(`Maximo ${MAX_ATTACHMENTS} adjuntos`, 'warning');
      $id(URL_MODAL_ID)?.remove();

      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="${URL_MODAL_ID}" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content rounded-4 border-0 shadow-lg">
              <div class="modal-header border-0 px-4 pt-4 pb-2">
                <div><div class="aula-pub-eyebrow">Agregar URL</div><h6 class="modal-title fw-bold mb-0">Enlace externo</h6></div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body px-4 pt-2 pb-4">
                <div class="mb-3"><label class="form-label small fw-semibold text-muted">URL</label><input type="url" class="form-control rounded-4" id="aula-pub-url-input" placeholder="https://..."></div>
                <div class="mb-3"><label class="form-label small fw-semibold text-muted">Nombre visible</label><input type="text" class="form-control rounded-4" id="aula-pub-url-title" maxlength="120" placeholder="Se intentara detectar automaticamente"></div>
                <div id="aula-pub-url-preview" class="aula-link-preview d-none"></div>
              </div>
              <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="aula-pub-url-submit">Agregar URL</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(div.firstElementChild);

      const urlModal = $id(URL_MODAL_ID);
      const urlInput = $id('aula-pub-url-input');
      const titleInput = $id('aula-pub-url-title');
      const preview = $id('aula-pub-url-preview');

      const syncPreview = () => {
        const info = _inferLinkDetails(urlInput?.value || '');
        if (!info) return preview?.classList.add('d-none');
        if (titleInput && (!titleInput.dataset.touched || !titleInput.value.trim())) titleInput.value = info.title;
        if (preview) {
          preview.classList.remove('d-none');
          preview.innerHTML = `<div class="aula-link-preview-icon"><i class="bi bi-link-45deg"></i></div><div class="min-width-0"><div class="fw-semibold text-truncate">${esc(titleInput?.value.trim() || info.title)}</div><div class="small text-muted text-truncate">${esc(info.subtitle)}</div></div>`;
        }
      };

      urlInput?.addEventListener('input', syncPreview);
      titleInput?.addEventListener('input', () => { titleInput.dataset.touched = titleInput.value.trim() ? 'true' : ''; syncPreview(); });
      urlModal?.querySelector('#aula-pub-url-submit')?.addEventListener('click', () => {
        const info = _inferLinkDetails(urlInput?.value || '');
        if (!info) return toast('Ingresa una URL valida', 'warning');
        _addAttachmentCard({ nombre: titleInput?.value.trim() || info.title, url: info.url, tipo: 'url', subtitulo: info.subtitle });
        bootstrap.Modal.getInstance(urlModal)?.hide();
      });
      urlModal?.addEventListener('hidden.bs.modal', () => { bootstrap.Modal.getInstance(urlModal)?.dispose(); urlModal.remove(); }, { once: true });
      bootstrap.Modal.getOrCreateInstance(urlModal).show();
    }

    function _addAttachmentCard(resource) {
      const container = $id('aula-pub-attachments');
      if (!container) return;
      if (_attachmentCount(true) >= MAX_ATTACHMENTS) return toast(`Maximo ${MAX_ATTACHMENTS} adjuntos`, 'warning');
      const attachment = _normalizeAttachment(resource);
      if (!attachment.url) return;
      const info = _inferLinkDetails(attachment.url);
      const isImage = /^image\//i.test(attachment.mime || '') || /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(attachment.url || '');
      const card = document.createElement('div');
      card.className = 'aula-attachment-card';
      card.dataset.ready = 'true';
      card.innerHTML = `
        <div class="aula-attachment-thumb">${isImage ? `<img src="${esc(attachment.url)}" alt="${esc(attachment.nombre || 'Adjunto')}" loading="lazy">` : `<i class="bi ${attachment.tipo === 'file' ? 'bi-file-earmark-arrow-up' : 'bi-link-45deg'}"></i>`}</div>
        <div class="min-width-0 flex-grow-1">
          <div class="fw-semibold text-truncate">${esc(attachment.nombre || info?.title || 'Adjunto')}</div>
          <div class="small text-muted text-truncate">${esc(attachment.subtitulo || info?.subtitle || (attachment.tipo === 'file' ? 'Archivo subido a Aula' : 'Enlace externo'))}</div>
        </div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <a href="${esc(attachment.url)}" target="_blank" rel="noopener" class="btn btn-sm btn-light border rounded-pill px-3 text-decoration-none">Abrir</a>
          <button type="button" class="btn btn-sm btn-outline-danger rounded-circle aula-attachment-remove" title="Quitar adjunto"><i class="bi bi-x"></i></button>
        </div>
        <input type="hidden" class="aula-attachment-name" value="${esc(attachment.nombre || info?.title || 'Adjunto')}">
        <input type="hidden" class="aula-attachment-url" value="${esc(attachment.url || '')}">
        <input type="hidden" class="aula-attachment-kind" value="${esc(attachment.tipo)}">
        <input type="hidden" class="aula-attachment-mime" value="${esc(attachment.mime || '')}">
        <input type="hidden" class="aula-attachment-subtitle" value="${esc(attachment.subtitulo || '')}">`;
      container.appendChild(card);
      _refreshAttachmentEmptyState();
    }

    function _refreshAttachmentEmptyState() {
      $id('aula-pub-attachments-empty')?.classList.toggle('d-none', _attachmentCards().length > 0);
    }

    function _compressImage(file) {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > 1600) { height = Math.round(height * 1600 / width); width = 1600; }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.82);
          };
          img.onerror = () => resolve(null);
          img.src = ev.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    async function _handleFileUpload(event) {
      const input = event.target;
      const files = Array.from(input?.files || []).slice(0, MAX_UPLOAD_FILES);
      if (!files.length) return;
      if (!global.AulaService?.uploadPublicacionArchivo) { toast('Servicio de archivos no disponible', 'danger'); input.value = ''; return; }
      if (_attachmentCount(true) + files.length > MAX_ATTACHMENTS) { toast(`Solo puedes tener ${MAX_ATTACHMENTS} adjuntos`, 'warning'); input.value = ''; return; }

      const container = $id('aula-pub-attachments');
      const statusEl = $id('aula-pub-upload-status');

      for (const file of files) {
        if (!file.type.startsWith('image/') && file.size > 15 * 1024 * 1024) { toast(`"${file.name}" supera el limite de 15 MB`, 'warning'); continue; }
        const row = document.createElement('div');
        row.className = 'aula-attachment-card aula-attachment-card--uploading';
        row.dataset.ready = 'false';
        row.innerHTML = `<div class="aula-attachment-thumb"><i class="bi bi-cloud-upload"></i></div><div class="min-width-0 flex-grow-1"><div class="fw-semibold text-truncate">${esc(file.name)}</div><div class="progress mt-2" style="height:4px;"><div class="progress-bar bg-primary aula-upload-bar" style="width:0%;"></div></div></div>`;
        container?.appendChild(row);
        if (statusEl) statusEl.textContent = 'Subiendo archivo...';
        try {
          let uploadFile = file;
          if (file.type.startsWith('image/')) {
            const compressed = await _compressImage(file);
            if (compressed) uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          }
          const uploaded = await global.AulaService.uploadPublicacionArchivo(_ctx, _claseId, uploadFile, {
            onProgress(percent) {
              row.querySelector('.aula-upload-bar')?.style.setProperty('width', `${percent}%`);
            }
          });
          row.remove();
          _addAttachmentCard({
            nombre: file.name,
            url: uploaded?.url,
            tipo: uploaded?.tipo || 'file',
            mime: uploaded?.mime || uploadFile.type || file.type,
            subtitulo: 'Archivo subido a Aula'
          });
        } catch (err) {
          console.error('[AulaPublicar] upload error:', err);
          row.remove();
          toast(`No se pudo subir "${file.name}"`, 'danger');
        }
      }

      if (statusEl) statusEl.textContent = '';
      input.value = '';
      _refreshAttachmentEmptyState();
    }

    function _buildPayload() {
      const tipo = getSelectedTipo();
      const titulo = $id('aula-pub-titulo')?.value.trim() || '';
      const contenido = $id('aula-pub-contenido')?.value.trim() || '';
      const archivos = _collectAttachments();
      if (!titulo && !contenido && !archivos.length) { toast('Agrega un titulo, instrucciones o al menos un adjunto', 'warning'); return null; }
      const data = { claseId: _claseId, tipo, titulo, contenido, archivos };

      if (tipo === 'tarea') {
        data.fechaEntrega = _getDueDate();
        data.puntajeMax = parseInt($id('aula-pub-puntaje')?.value || '100', 10) || 100;
        data.permiteEntregaTardia = readBool('aula-pub-tardia', false);
        data.visibleCarrera = readBool('aula-pub-visible-carrera', false);
        data.grupoId = $id('aula-pub-grupo-select')?.value || null;
        data.grupoNombre = data.grupoId ? $id('aula-pub-grupo-select')?.options?.[$id('aula-pub-grupo-select').selectedIndex]?.text || null : null;
        const rubrica = _getRubrica();
        if (rubrica === undefined) return null;
        data.rubrica = rubrica || null;
      }

      if (tipo === 'encuesta') {
        const opciones = Array.from(document.querySelectorAll('.aula-opcion-input')).map(input => input.value.trim()).filter(Boolean);
        if (opciones.length < 2) { toast('Agrega al menos 2 opciones', 'warning'); return null; }
        data.opciones = opciones;
        data.resultadosVisibles = $id('aula-pub-resultados-visibles')?.checked !== false;
      }

      return data;
    }

    async function _handleSaveTemplate() {
      const data = _buildPayload();
      if (!data) return;
      try {
        await global.AulaService.guardarPlantilla(_ctx, {
          tipo: data.tipo,
          titulo: data.titulo,
          contenido: data.contenido,
          archivos: data.archivos,
          rubrica: data.rubrica || null,
          puntajeMax: data.puntajeMax || 100,
          permiteEntregaTardia: Boolean(data.permiteEntregaTardia),
          visibleCarrera: Boolean(data.visibleCarrera)
        });
        toast('Plantilla guardada', 'success');
      } catch (err) {
        toast(err.message === 'LIMITE_PLANTILLAS' ? 'Limite de 20 plantillas alcanzado. Elimina una para guardar otra.' : 'Error al guardar plantilla', 'danger');
      }
    }

    async function _handleSubmit() {
      const btn = $id('aula-pub-submit');
      if (!btn || btn.disabled) return;
      const data = _buildPayload();
      if (!data) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Publicando...';
      try {
        if (_editPub) {
          await global.AulaService.updatePublicacion(_ctx, _editPub.id, data);
          toast('Publicacion actualizada', 'success');
        } else {
          await global.AulaService.createPublicacion(_ctx, data);
          toast('Publicado correctamente', 'success');
        }
        global.AulaService.invalidateCache('comunidad_recientes_');
        if (data.tipo === 'tarea') {
          global.AulaService.invalidateCache('pubs_');
          global.AulaService.invalidateCache('community_');
        }
        bootstrap.Modal.getInstance(getModalEl())?.hide();
      } catch (err) {
        console.error('[AulaPublicar] Error:', err);
        toast('Error al publicar', 'danger');
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-send me-1"></i>${_editPub ? 'Guardar' : 'Publicar'}`;
      }
    }

    async function _openPlantillasPanel() {
      const zone = $id('aula-pub-template-zone');
      if (!zone) return;
      if (zone.childElementCount) { zone.innerHTML = ''; return; }
      zone.innerHTML = '<div id="aula-plantillas-panel" class="aula-template-panel"><div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div></div>';
      const panel = $id('aula-plantillas-panel');
      try {
        const plantillas = await global.AulaService.getPlantillas(_ctx);
        if (!plantillas.length) return panel.innerHTML = '<div class="small text-muted text-center py-3">No tienes plantillas guardadas.</div>';
        panel.innerHTML = `
          <div class="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap"><div><div class="fw-semibold">Mis plantillas</div><div class="small text-muted">Selecciona una para precargar titulo, instrucciones, rubrica y adjuntos.</div></div></div>
          <div class="aula-template-grid">
            ${plantillas.map(plantilla => {
              const meta = TYPE_META[plantilla.tipo] || TYPE_META.tarea;
              return `
                <div class="aula-template-card">
                  <div class="d-flex align-items-start gap-3">
                    <span class="aula-type-summary-icon flex-shrink-0" style="background:${meta.bg};color:${meta.color};"><i class="bi ${meta.icon}"></i></span>
                    <div class="min-width-0 flex-grow-1"><div class="fw-semibold text-truncate">${esc(plantilla.titulo || 'Sin titulo')}</div><div class="small text-muted">${esc(meta.title)} · ${plantilla.usos || 0} usos</div></div>
                  </div>
                  <div class="small text-muted mt-3 aula-template-copy">${esc((plantilla.contenido || 'Sin descripcion').slice(0, 140))}</div>
                  <div class="d-flex flex-wrap gap-2 mt-3">
                    ${plantilla.puntajeMax ? `<span class="badge bg-light text-dark border">${plantilla.puntajeMax} pts</span>` : ''}
                    ${Array.isArray(plantilla.rubrica) && plantilla.rubrica.length ? '<span class="badge bg-light text-dark border">Con rubrica</span>' : ''}
                    ${Array.isArray(plantilla.archivos) && plantilla.archivos.length ? `<span class="badge bg-light text-dark border">${plantilla.archivos.length} adjuntos</span>` : ''}
                  </div>
                  <div class="d-flex gap-2 mt-3">
                    <button type="button" class="btn btn-primary rounded-pill px-3 aula-usar-plantilla" data-id="${plantilla.id}">Usar</button>
                    <button type="button" class="btn btn-outline-danger rounded-pill px-3 aula-borrar-plantilla" data-id="${plantilla.id}">Eliminar</button>
                  </div>
                </div>`;
            }).join('')}
          </div>`;
        panel.addEventListener('click', async event => {
          const useBtn = event.target.closest('.aula-usar-plantilla');
          const deleteBtn = event.target.closest('.aula-borrar-plantilla');
          if (useBtn) {
            const plantilla = plantillas.find(item => item.id === useBtn.dataset.id);
            if (!plantilla) return;
            _applyTemplate(plantilla);
            await global.AulaService.registrarUsoPlantilla(_ctx, plantilla.id).catch(() => {});
            zone.innerHTML = '';
            return;
          }
          if (deleteBtn) {
            if (!confirm('¿Eliminar esta plantilla?')) return;
            try {
              await global.AulaService.eliminarPlantilla(_ctx, deleteBtn.dataset.id);
              deleteBtn.closest('.aula-template-card')?.remove();
              toast('Plantilla eliminada', 'info');
            } catch (_) {
              toast('Error al eliminar la plantilla', 'danger');
            }
          }
        });
      } catch (err) {
        console.error('[AulaPublicar] getPlantillas error:', err);
        panel.innerHTML = '<div class="small text-danger text-center py-3">Error al cargar plantillas.</div>';
      }
    }

    function _applyTemplate(plantilla) {
      if (!_editPub) {
        const input = document.querySelector(`input[name="aula-pub-tipo"][value="${plantilla.tipo || 'tarea'}"]`);
        if (input) input.checked = true;
      }
      _renderTypeSections(_editPub?.tipo || plantilla.tipo || 'tarea');
      if ($id('aula-pub-titulo')) $id('aula-pub-titulo').value = plantilla.titulo || '';
      if ($id('aula-pub-contenido')) $id('aula-pub-contenido').value = plantilla.contenido || '';
      if ($id('aula-pub-puntaje') && plantilla.puntajeMax) $id('aula-pub-puntaje').value = plantilla.puntajeMax;
      if ($id('aula-pub-attachments')) $id('aula-pub-attachments').innerHTML = '';
      (plantilla.archivos || []).forEach(archivo => _addAttachmentCard({
        nombre: archivo.nombre,
        url: archivo.url,
        tipo: archivo.tipo || archivo.tipoAdjunto || (archivo.origen === 'upload' ? 'file' : 'url'),
        mime: archivo.mime || archivo.mimeType || '',
        subtitulo: archivo.subtitulo || archivo.subtitle || ''
      }));
      if (document.querySelector('input[name="aula-pub-tardia"]')) setBool('aula-pub-tardia', Boolean(plantilla.permiteEntregaTardia));
      if (document.querySelector('input[name="aula-pub-visible-carrera"]')) setBool('aula-pub-visible-carrera', Boolean(plantilla.visibleCarrera));
      if (Array.isArray(plantilla.rubrica) && plantilla.rubrica.length) {
        setBool('aula-pub-rubrica-enabled', true);
        _syncRubricaMode();
        if ($id('aula-pub-criterios')) $id('aula-pub-criterios').innerHTML = '';
        plantilla.rubrica.forEach(criterio => _addCriterioRow(criterio.criterio, criterio.peso));
      }
      _currentStep = 1;
      _syncStepUI();
      _updateCounters();
      _updatePuntajePresets();
      _updateRubricaTotals();
      _refreshAttachmentEmptyState();
      toast('Plantilla cargada', 'success');
    }

    function _populateEdit(pub) {
      _renderTypeSections(pub.tipo);
      if ($id('aula-pub-titulo')) $id('aula-pub-titulo').value = pub.titulo || '';
      if ($id('aula-pub-contenido')) $id('aula-pub-contenido').value = pub.contenido || '';

      if (pub.tipo === 'tarea') {
        const due = pub.fechaEntrega?.toDate ? pub.fechaEntrega.toDate() : (pub.fechaEntrega ? new Date(pub.fechaEntrega) : null);
        if (due && !Number.isNaN(due.getTime())) {
          if ($id('aula-pub-fecha-date')) $id('aula-pub-fecha-date').value = formatDateInput(due);
          if ($id('aula-pub-fecha-time')) $id('aula-pub-fecha-time').value = formatTimeInput(due);
          _setActiveDatePreset('custom');
        } else {
          _setActiveDatePreset('none');
        }
        if ($id('aula-pub-puntaje')) $id('aula-pub-puntaje').value = pub.puntajeMax || 100;
        setBool('aula-pub-tardia', Boolean(pub.permiteEntregaTardia));
        setBool('aula-pub-visible-carrera', Boolean(pub.visibleCarrera));
        _loadGroupOptions(pub.grupoId || '');
        if (Array.isArray(pub.rubrica) && pub.rubrica.length) {
          setBool('aula-pub-rubrica-enabled', true);
          _syncRubricaMode();
          if ($id('aula-pub-criterios')) $id('aula-pub-criterios').innerHTML = '';
          pub.rubrica.forEach(criterio => _addCriterioRow(criterio.criterio, criterio.peso));
        }
      }

      if (pub.tipo === 'encuesta' && Array.isArray(pub.opciones) && $id('aula-pub-opciones')) {
        $id('aula-pub-opciones').innerHTML = pub.opciones.map((opcion, idx) => `<input type="text" class="form-control rounded-4 aula-opcion-input" placeholder="Opcion ${idx + 1}" maxlength="200" value="${esc(opcion)}">`).join('');
        if ($id('aula-pub-resultados-visibles')) $id('aula-pub-resultados-visibles').checked = pub.resultadosVisibles !== false;
      }

      if ($id('aula-pub-attachments')) $id('aula-pub-attachments').innerHTML = '';
      (pub.archivos || []).forEach(archivo => _addAttachmentCard({
        nombre: archivo.nombre,
        url: archivo.url,
        tipo: archivo.tipo || archivo.tipoAdjunto || (archivo.origen === 'upload' ? 'file' : 'url'),
        mime: archivo.mime || archivo.mimeType || '',
        subtitulo: archivo.subtitulo || archivo.subtitle || ''
      }));

      _updateCounters();
      _updateDueSummary();
      _updatePuntajePresets();
      _updateRubricaTotals();
      _refreshAttachmentEmptyState();
    }

    return { openModal };
  })();

  global.AulaPublicar = AulaPublicar;
})(window);
