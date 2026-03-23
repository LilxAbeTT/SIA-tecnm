/* ============================================================
   AulaEntregas — Entregas de tareas + Calificaciones
   Estudiante: entregar tarea · Docente: calificar + tabla
   Mejoras: validación de rango, filtros, copiar retroalimentación,
   contador dinámico, exportar CSV, filas en riesgo
   ============================================================ */
(function (global) {
  const AulaEntregas = (function () {

    const SUBMIT_MODAL = 'aula-entrega-modal';
    const GRADE_MODAL  = 'aula-grade-modal';
    const DEFAULT_RUBRICA_LEVELS = [
      { label: 'Excelente', pct: 100 },
      { label: 'Bien', pct: 75 },
      { label: 'Regular', pct: 50 },
      { label: 'Insuficiente', pct: 25 }
    ];

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
    function toast(msg, type) { if (global.SIA?.toast) global.SIA.toast(msg, type); else if (global.showToast) global.showToast(msg, type); }
    function _getRubricaLevels(criterio) {
      const levels = Array.isArray(criterio?.niveles) && criterio.niveles.length
        ? criterio.niveles
        : DEFAULT_RUBRICA_LEVELS;
      return levels.map(level => ({
        label: level?.label || level?.descripcion || 'Nivel',
        pct: Number.isFinite(Number(level?.pct)) ? Number(level.pct) : null
      }));
    }
    function _getActiveGradeFilter() {
      return document.querySelector('.aula-grade-filter.active')?.dataset.filter || 'todos';
    }
    function _applyGradeFilter(filter) {
      const list = document.getElementById('aula-grade-list');
      if (!list) return;
      list.querySelectorAll('.aula-entrega-card').forEach(card => {
        const estado = card.dataset.estado;
        let show = true;
        if (filter === 'pendientes') show = estado === 'entregado' || estado === 'tarde';
        if (filter === 'calificadas') show = estado === 'calificado';
        if (filter === 'tardias') show = estado === 'tarde';
        card.style.display = show ? '' : 'none';
      });
    }

    // ══════════════════════════════════════════════════════════
    //  ESTUDIANTE — Modal de entrega
    // ══════════════════════════════════════════════════════════

    async function openSubmitModal(ctx, claseId, pubId) {
      let pub = null;
      try {
        pub = await AulaService.getPublicacionForClase(ctx, claseId, pubId, ctx.auth.currentUser.uid);
      } catch (_) {}
      if (!pub) return toast('No tienes acceso a esta publicacion', 'warning');

      const uid = ctx.auth.currentUser.uid;
      let existing = null;
      let miGrupo = null;

      // Si la tarea es grupal, buscar si el grupo ya tiene una entrega
      if (pub.grupoId) {
        try {
          miGrupo = await AulaService.getMiGrupo(ctx, claseId, uid);
          if (!miGrupo || miGrupo.id !== pub.grupoId) {
            return toast('Esta tarea esta asignada a otro grupo.', 'warning');
          }
          // Resolver entrega compartida del grupo
          existing = await AulaService.getMiEntrega(ctx, pubId, uid);
        } catch (_) {}
      }

      if (!existing) existing = await AulaService.getMiEntrega(ctx, pubId, uid);
      _injectSubmitModal(pub, existing, miGrupo);
      _bindSubmitEvents(ctx, claseId, pub, existing, miGrupo);
      new bootstrap.Modal(document.getElementById(SUBMIT_MODAL)).show();
    }

    function _injectSubmitModal(pub, existing, miGrupo) {
      let el = document.getElementById(SUBMIT_MODAL);
      if (el) el.remove();

      const fechaE   = pub.fechaEntrega?.toDate ? pub.fechaEntrega.toDate() : (pub.fechaEntrega ? new Date(pub.fechaEntrega) : null);
      const vencida  = fechaE ? new Date() > fechaE : false;
      const fechaStr = fechaE ? fechaE.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';
      const isCalificado  = existing?.estado === 'calificado';
      const esTardia      = existing?.estado === 'tarde';
      const canEdit       = !isCalificado && (!vencida || pub.permiteEntregaTardia);
      const maxPts        = pub.puntajeMax || 100;

      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="${SUBMIT_MODAL}" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 rounded-4 shadow" style="position:relative;overflow:hidden;">
              <div class="modal-header border-0 pb-0 px-4 pt-4">
                <div>
                  <h5 class="modal-title fw-bold">${esc(pub.titulo)}</h5>
                  <div class="d-flex gap-2 mt-1 small flex-wrap">
                    <span class="${vencida ? 'text-danger' : 'text-muted'}"><i class="bi bi-clock me-1"></i>${fechaStr}</span>
                    <span class="text-muted"><i class="bi bi-star me-1"></i>${maxPts} pts</span>
                    ${esTardia ? '<span class="badge bg-warning-subtle text-warning rounded-pill">Entrega tardía</span>' : ''}
                    ${isCalificado ? `<span class="badge bg-success-subtle text-success rounded-pill">Calificado: ${existing.calificacion}/${maxPts}</span>` : ''}
                    ${existing && !isCalificado ? '<span class="badge bg-primary-subtle text-primary rounded-pill">Entregado</span>' : ''}
                  </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body px-4 pt-3 pb-4">
                ${miGrupo ? `
                  <div class="alert alert-primary rounded-3 mb-3 small py-2 d-flex align-items-center gap-2">
                    <i class="bi bi-people-fill text-primary"></i>
                    <span><strong>Tarea de grupo:</strong> Estás entregando como <strong>${esc(miGrupo.nombre)}</strong>. Cualquier miembro puede entregar por el grupo.</span>
                  </div>` : ''}
                ${vencida && !existing && pub.permiteEntregaTardia ? `
                  <div class="alert alert-danger rounded-3 mb-3 small py-2">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>
                    <strong>Entrega tardía:</strong> La fecha límite ya pasó. Verifica con tu docente si aún se acepta.
                  </div>` : ''}

                ${vencida && !pub.permiteEntregaTardia && !isCalificado ? `
                  <div class="alert alert-warning rounded-3 mb-3 small py-2">
                    <i class="bi bi-lock-fill me-1"></i>
                    <strong>Edicion bloqueada:</strong> La fecha limite ya paso y el docente no permite entregas tardias.
                  </div>` : ''}

                ${pub.contenido ? `<div class="rounded-3 p-3 mb-3 small" style="background:var(--aula-surface-muted,#f5f5ff);white-space:pre-line;">${esc(pub.contenido)}</div>` : ''}

                ${(pub.archivos || []).length ? `
                  <div class="mb-3">
                    <label class="form-label small fw-semibold text-muted">Material adjunto</label>
                    <div class="d-flex flex-wrap gap-2">
                      ${pub.archivos.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener" class="badge bg-light text-dark border text-decoration-none"><i class="bi bi-paperclip me-1"></i>${esc(a.nombre || 'Archivo')}</a>`).join('')}
                    </div>
                  </div>` : ''}

                ${(pub.rubrica || []).length && !isCalificado ? `
                  <div class="mb-3">
                    <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" type="button"
                            data-bs-toggle="collapse" data-bs-target="#aula-rubrica-orientacion">
                      <i class="bi bi-list-check me-1"></i>Ver criterios de evaluación
                    </button>
                    <div class="collapse mt-2" id="aula-rubrica-orientacion">
                      <div class="border rounded-3 overflow-hidden small">
                        <table class="table table-sm mb-0">
                          <thead class="table-light">
                            <tr>
                              <th>Criterio</th>
                              <th class="text-center">Excelente</th>
                              <th class="text-center">Bueno</th>
                              <th class="text-center">Regular</th>
                              <th class="text-center">Insuf.</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${pub.rubrica.map(c => `
                              <tr>
                                <td class="fw-semibold">${esc(c.criterio)} <span class="text-muted">(${c.peso}%)</span></td>
                                ${(c.niveles || []).map(n => `<td class="text-center text-muted">${esc(n.descripcion || n.label || (n.pct != null ? n.pct + '%' : ''))}</td>`).join('')}
                              </tr>`).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>` : ''}

                ${isCalificado && existing.retroalimentacion ? `
                  <div class="alert border-0 rounded-4 mb-3" style="background:linear-gradient(135deg,#22c55e15,#16a34a10);">
                    <div class="fw-semibold mb-1 small text-success"><i class="bi bi-chat-left-text-fill me-1"></i>Retroalimentación del docente</div>
                    <div class="small" style="white-space:pre-line;">${esc(existing.retroalimentacion)}</div>
                  </div>` : ''}

                <hr>

                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small fw-semibold text-muted mb-0">Tu entrega</label>
                  ${canEdit ? '<span class="small text-muted" id="aula-entrega-char-count">0 / 5000</span>' : ''}
                </div>
                <textarea class="form-control rounded-3 mb-3" id="aula-entrega-contenido" rows="4"
                  placeholder="Escribe tu respuesta o comentarios..." maxlength="5000"
                  ${!canEdit ? 'disabled' : ''}>${esc(existing?.contenido || '')}</textarea>

                <label class="form-label small fw-semibold text-muted">Archivos adjuntos</label>
                <div id="aula-entrega-archivos" class="vstack gap-2"></div>
                ${canEdit ? `
                  <div class="d-flex gap-2 mt-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" id="aula-entrega-add-archivo">
                      <i class="bi bi-link-45deg me-1"></i>Agregar enlace
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary rounded-pill" id="aula-entrega-upload-btn">
                      <i class="bi bi-paperclip me-1"></i>Subir archivo
                    </button>
                    <input type="file" id="aula-entrega-file-input" multiple class="d-none">
                  </div>
                  <div id="aula-entrega-upload-status" class="small text-muted mt-1"></div>` : ''}
              </div>

              <!-- Overlay de éxito (oculto hasta confirmar entrega) -->
              <div id="aula-entrega-success" class="d-none position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white rounded-4" style="z-index:10;">
                <div class="rounded-circle bg-success-subtle d-flex align-items-center justify-content-center mb-3" style="width:72px;height:72px;">
                  <i class="bi bi-check-lg text-success" style="font-size:2rem;"></i>
                </div>
                <div class="fw-bold fs-5 text-success">${existing ? '¡Actualizada!' : '¡Entregada!'}</div>
                <div class="small text-muted mt-1">La tarea fue enviada exitosamente</div>
              </div>

              ${canEdit ? `
              <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex align-items-center justify-content-between">
                <div id="aula-entrega-validacion" class="small text-danger" style="display:none;">
                  <i class="bi bi-exclamation-circle me-1"></i>Agrega contenido o al menos un archivo.
                </div>
                <div class="d-flex gap-2 ms-auto">
                  <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                  <button type="button" class="btn btn-primary rounded-pill px-4 shadow-sm" id="aula-entrega-submit">
                    <i class="bi bi-upload me-1"></i>${existing ? 'Actualizar entrega' : 'Entregar'}
                  </button>
                </div>
              </div>` : ''}
            </div>
          </div>
        </div>`;
      document.body.appendChild(div.firstElementChild);

      // Populate existing archivos
      if (existing?.archivos?.length) {
        existing.archivos.forEach(a => _addEntregaArchivoRow(a.nombre, a.url, !canEdit, true));
      }

      // Contador de caracteres
      if (canEdit) {
        const textarea = document.getElementById('aula-entrega-contenido');
        const counter  = document.getElementById('aula-entrega-char-count');
        if (textarea && counter) {
          counter.textContent = `${textarea.value.length} / 5000`;
          textarea.addEventListener('input', () => {
            counter.textContent = `${textarea.value.length} / 5000`;
          });
        }
      }
    }

    function _addEntregaArchivoRow(nombre, url, disabled, isUploaded) {
      const container = document.getElementById('aula-entrega-archivos');
      if (!container) return;
      const count = container.querySelectorAll('.aula-earchivo-row').length;
      if (count >= 10) return;
      const row = document.createElement('div');
      row.className = 'd-flex gap-2 align-items-center aula-earchivo-row';

      if (isUploaded) {
        // Chip visual para archivos subidos: miniatura + nombre + enlace
        const isImg = /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(nombre || url || '');
        row.innerHTML = `
          <div class="d-flex align-items-center gap-2 flex-grow-1 border rounded-3 px-2 py-1 bg-light" style="min-width:0;max-width:calc(100% - 2.5rem);">
            ${isImg
              ? `<img src="${esc(url)}" style="height:32px;width:32px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'">`
              : '<i class="bi bi-file-earmark-fill text-muted flex-shrink-0" style="font-size:1.25rem;"></i>'}
            <span class="small text-truncate flex-grow-1" title="${esc(nombre || 'Archivo')}">${esc(nombre || 'Archivo')}</span>
            <input type="hidden" class="aula-earchivo-nombre" value="${esc(nombre || '')}">
            <input type="hidden" class="aula-earchivo-url" value="${esc(url || '')}">
            <a href="${esc(url)}" target="_blank" rel="noopener" class="text-muted flex-shrink-0 ms-1" title="Abrir archivo">
              <i class="bi bi-box-arrow-up-right small"></i>
            </a>
          </div>
          ${!disabled ? `
          <button type="button" class="btn btn-sm btn-outline-danger rounded-circle flex-shrink-0 aula-earchivo-remove" style="width:2rem;height:2rem;padding:0;">
            <i class="bi bi-x"></i>
          </button>` : ''}`;
      } else {
        row.innerHTML = `
          <input type="text" class="form-control form-control-sm rounded-3 aula-earchivo-nombre" placeholder="Nombre" value="${esc(nombre || '')}" maxlength="100" style="max-width:180px;" ${disabled ? 'disabled' : ''}>
          <input type="url" class="form-control form-control-sm rounded-3 aula-earchivo-url" placeholder="https://..." value="${esc(url || '')}" ${disabled ? 'disabled' : ''}>
          ${!disabled ? '<button type="button" class="btn btn-sm btn-outline-danger rounded-circle aula-earchivo-remove"><i class="bi bi-x"></i></button>' : ''}`;
      }

      container.appendChild(row);
      row.querySelector('.aula-earchivo-remove')?.addEventListener('click', () => row.remove());
    }

    // Comprime una imagen con Canvas (max 1600px ancho, calidad 0.82)
    function _compressImage(file) {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = () => {
            const MAX = 1600;
            let w = img.width, h = img.height;
            if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(b => resolve(b), 'image/jpeg', 0.82);
          };
          img.onerror = () => resolve(null);
          img.src = ev.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    function _bindSubmitEvents(ctx, claseId, pub, existing, miGrupo) {
      document.getElementById('aula-entrega-add-archivo')?.addEventListener('click', () => _addEntregaArchivoRow('', '', false));

      // ── Subida de archivos reales ──
      document.getElementById('aula-entrega-upload-btn')?.addEventListener('click', () => {
        document.getElementById('aula-entrega-file-input')?.click();
      });

      document.getElementById('aula-entrega-file-input')?.addEventListener('change', async e => {
        const files = Array.from(e.target.files || []).slice(0, 5);
        if (!files.length) return;
        const uid = ctx.auth.currentUser.uid;
        const storage = ctx.storage || window.SIA?.storage;
        if (!storage) { toast('Storage no disponible', 'danger'); return; }
        const statusEl = document.getElementById('aula-entrega-upload-status');

        for (const file of files) {
          const isImg = file.type.startsWith('image/');
          if (!isImg && file.size > 15 * 1024 * 1024) {
            toast(`"${esc(file.name)}" supera el límite de 15 MB`, 'warning');
            continue;
          }
          const container = document.getElementById('aula-entrega-archivos');
          if (!container) continue;
          // Fila de progreso temporal
          const rowId = 'upload-' + Date.now() + Math.random().toString(36).slice(2, 6);
          const pRow = document.createElement('div');
          pRow.id = rowId;
          pRow.className = 'd-flex gap-2 align-items-center aula-earchivo-row';
          pRow.innerHTML = `
            <div class="flex-grow-1 border rounded-3 px-3 py-1 small bg-light">
              <i class="bi bi-file-earmark me-1 text-muted"></i>${esc(file.name)}
              <div class="progress mt-1" style="height:3px;">
                <div class="progress-bar bg-primary aula-upload-bar" style="width:0%;transition:width .2s;"></div>
              </div>
            </div>`;
          container.appendChild(pRow);
          if (statusEl) statusEl.textContent = 'Subiendo...';

          try {
            let uploadFile = file;
            if (isImg) {
              const compressed = await _compressImage(file);
              if (compressed) uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
            }
            const fname = `${Date.now()}_${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const ref = storage.ref().child(`aula-entregas/${uid}/${pub.id}/${fname}`);
            const task = ref.put(uploadFile);
            await new Promise((resolve, reject) => {
              task.on('state_changed',
                snap => {
                  const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                  const bar = document.getElementById(rowId)?.querySelector('.aula-upload-bar');
                  if (bar) bar.style.width = pct + '%';
                },
                reject,
                async () => {
                  const url = await ref.getDownloadURL();
                  document.getElementById(rowId)?.remove();
                  _addEntregaArchivoRow(file.name, url, false, true);
                  resolve();
                }
              );
            });
            if (statusEl) statusEl.textContent = '';
          } catch (err) {
            console.error('[AulaEntregas] upload error:', err);
            document.getElementById(rowId)?.remove();
            toast('Error al subir ' + file.name, 'danger');
            if (statusEl) statusEl.textContent = '';
          }
        }
        e.target.value = '';
      });

      document.getElementById('aula-entrega-submit')?.addEventListener('click', async () => {
        const btn = document.getElementById('aula-entrega-submit');
        if (!btn || btn.disabled) return;

        const contenido = document.getElementById('aula-entrega-contenido')?.value.trim();
        const archivos  = [];
        document.querySelectorAll('.aula-earchivo-row').forEach(row => {
          const nombre = row.querySelector('.aula-earchivo-nombre')?.value.trim();
          const url    = row.querySelector('.aula-earchivo-url')?.value.trim();
          if (url) archivos.push({ nombre: nombre || 'Archivo', url });
        });

        const validacionEl = document.getElementById('aula-entrega-validacion');
        if (!contenido && !archivos.length) {
          if (validacionEl) validacionEl.style.display = '';
          return;
        }
        if (validacionEl) validacionEl.style.display = 'none';

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enviando...';

        try {
          if (existing) {
            await AulaService.updateEntrega(ctx, existing.id, {
              contenido,
              archivos
            });
          } else {
            await AulaService.submitEntrega(ctx, {
              publicacionId: pub.id, claseId, contenido, archivos,
              fechaEntrega: pub.fechaEntrega,
              grupoId: pub.grupoId || null,
              grupoNombre: miGrupo?.nombre || pub.grupoNombre || null,
              grupoMiembroIds: miGrupo?.miembroIds || []
            });
          }
          toast(existing ? 'Entrega actualizada' : 'Tarea entregada', 'success');
          // Invalidar cache de deadlines para que el widget refleje el nuevo estado
          global.AulaDeadlines?.invalidate(ctx.auth.currentUser?.uid);
          AulaService.invalidateCache('entregas_');
          document.dispatchEvent(new CustomEvent('aula:entregaSuccess', { detail: { pubId: pub.id } }));
          // Mostrar overlay de éxito y cerrar
          const overlay = document.getElementById('aula-entrega-success');
          if (overlay) overlay.classList.remove('d-none');
          setTimeout(() => {
            const modalEl = document.getElementById(SUBMIT_MODAL);
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
          }, 1500);
        } catch (err) {
          console.error('[AulaEntregas] Submit error:', err);
          const msgs = {
            'YA_ENTREGADO': 'Ya entregaste esta tarea.',
            'FUERA_DE_TIEMPO': 'La fecha limite ya paso y el docente no permite entregas tardias.',
            'ENTREGA_CALIFICADA': 'Esta entrega ya fue calificada y no se puede modificar.',
            'NO_AUTORIZADO': 'No tienes permisos para modificar esta entrega.',
            'PUBLICACION_CLASE_INVALIDA': 'La publicacion no pertenece a esta clase.'
          };
          toast(msgs[err.message] || 'Error al entregar', 'danger');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-upload me-1"></i>' + (existing ? 'Actualizar entrega' : 'Entregar');
        }
      });

      document.getElementById(SUBMIT_MODAL)?.addEventListener('hidden.bs.modal', () => {
        document.getElementById(SUBMIT_MODAL)?.remove();
        if (!document.querySelector('.modal.show')) {
          document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
          document.body.classList.remove('modal-open');
          document.body.style.removeProperty('padding-right');
          document.body.style.removeProperty('overflow');
        }
      });
    }

    // ══════════════════════════════════════════════════════════
    //  DOCENTE — Ver entregas de una tarea
    // ══════════════════════════════════════════════════════════

    async function openGradeView(ctx, claseId, pubId) {
      try {
        const [pub, entregas, miembros, grupos] = await Promise.all([
          AulaService.getPublicacion(ctx, pubId),
          (AulaService.invalidateCache('entregas_pub_'), AulaService.getEntregasPorPublicacion(ctx, pubId)),
          AulaService.getMiembros(ctx, claseId, 120),
          AulaService.getGrupos(ctx, claseId)
        ]);
        if (!pub) return toast('Publicacion no encontrada', 'warning');

        const miembrosMap = {};
        miembros.forEach(miembro => { miembrosMap[miembro.userId] = miembro; });
        const gruposMap = {};
        grupos.forEach(grupo => { gruposMap[grupo.id] = grupo; });
        const entregasEnriquecidas = entregas.map(entrega => {
          if (!entrega.grupoId) return entrega;
          const grupo = gruposMap[entrega.grupoId];
          const grupoMiembroIds = entrega.grupoMiembroIds || grupo?.miembroIds || [];
          return {
            ...entrega,
            grupoNombre: entrega.grupoNombre || grupo?.nombre || 'Grupo',
            grupoMiembroIds,
            grupoMiembroNombres: grupoMiembroIds
              .map(id => miembrosMap[id]?.userName || miembrosMap[id]?.userEmail || '')
              .filter(Boolean)
          };
        });

        _injectGradeModal(pub, entregasEnriquecidas);
        _bindGradeEvents(ctx, pub);
        new bootstrap.Modal(document.getElementById(GRADE_MODAL)).show();
      } catch (err) {
        console.error('[AulaEntregas] openGradeView error:', err);
        const msgs = {
          NO_AUTORIZADO: 'No tienes permisos para revisar las entregas de esta tarea.',
          PUBLICACION_NO_ENCONTRADA: 'La tarea ya no existe o no fue encontrada.'
        };
        toast(msgs[err?.message] || 'No se pudieron cargar las entregas de esta tarea.', 'danger');
      }
    }

    function _injectGradeModal(pub, entregas) {
      let el = document.getElementById(GRADE_MODAL);
      if (el) el.remove();

      // Ordenar: pendientes primero, calificadas al final
      const ordenadas = [...entregas].sort((a, b) => {
        const peso = { entregado: 0, tarde: 1, calificado: 2 };
        return (peso[a.estado] || 0) - (peso[b.estado] || 0);
      });

      const total       = ordenadas.length;
      const calificadas = ordenadas.filter(e => e.estado === 'calificado').length;
      const tardias     = ordenadas.filter(e => e.estado === 'tarde').length;

      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="${GRADE_MODAL}" tabindex="-1">
          <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 rounded-4 shadow">
              <div class="modal-header border-0 pb-0 px-4 pt-4">
                <div class="flex-grow-1 min-width-0">
                  <h5 class="modal-title fw-bold text-truncate">${esc(pub.titulo)} — Entregas</h5>
                  <div class="d-flex gap-2 mt-1 flex-wrap small align-items-center">
                    <span class="badge bg-secondary-subtle text-secondary rounded-pill">${total} total</span>
                    <span class="badge bg-warning-subtle text-warning rounded-pill" id="aula-grade-count-pendientes">${total - calificadas} por calificar</span>
                    <span class="badge bg-success-subtle text-success rounded-pill" id="aula-grade-count-calificadas">${calificadas} calificadas</span>
                    ${tardias ? `<span class="badge bg-danger-subtle text-danger rounded-pill">${tardias} tardías</span>` : ''}
                  </div>
                </div>
                <button type="button" class="btn-close ms-3" data-bs-dismiss="modal"></button>
              </div>

              <!-- Filtros -->
              <div class="px-4 pt-3 pb-0 d-flex gap-2 flex-wrap">
                <button class="btn btn-sm btn-primary rounded-pill px-3 aula-grade-filter active" data-filter="todos">Todas</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 aula-grade-filter" data-filter="pendientes">Sin calificar</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 aula-grade-filter" data-filter="calificadas">Calificadas</button>
                ${tardias ? '<button class="btn btn-sm btn-outline-danger rounded-pill px-3 aula-grade-filter" data-filter="tardias">Tardías</button>' : ''}
              </div>

              <div class="modal-body px-4 pt-3 pb-4">
                ${!ordenadas.length ? '<div class="text-center py-4 text-muted"><i class="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i>No hay entregas aun.</div>' : `
                <div class="vstack gap-3" id="aula-grade-list">
                  ${ordenadas.map((e, idx) => _renderEntregaRow(e, pub, idx)).join('')}
                </div>`}
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(div.firstElementChild);
    }

    function _renderEntregaRow(e, pub, idx) {
      const fecha = e.entregadoAt?.toDate?.()?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) || '';
      const maxPts = pub.puntajeMax || 100;
      const isGroupDelivery = Boolean(e.grupoId);
      const tituloEntrega = isGroupDelivery ? (e.grupoNombre || 'Grupo') : e.estudianteNombre;
      const detalleEntrega = isGroupDelivery
        ? [
            e.entregadoPorNombre ? `Entrego ${e.entregadoPorNombre}` : '',
            (e.grupoMiembroNombres || []).length ? (e.grupoMiembroNombres || []).join(', ') : ''
          ].filter(Boolean).join(' · ')
        : (e.matricula || '');
      const estadoBadge = {
        entregado: '<span class="badge bg-primary-subtle text-primary rounded-pill small">Entregado</span>',
        tarde:     '<span class="badge bg-warning-subtle text-warning rounded-pill small">Tardía</span>',
        calificado: `<span class="badge bg-success-subtle text-success rounded-pill small aula-estado-badge" data-entrega-id="${e.id}">Calificado: ${e.calificacion}/${maxPts}</span>`
      };
      const archivosHTML = (e.archivos || []).map(a =>
        `<a href="${esc(a.url)}" target="_blank" rel="noopener" class="badge bg-light text-dark border text-decoration-none me-1"><i class="bi bi-paperclip me-1"></i>${esc(a.nombre || 'Archivo')}</a>`
      ).join('');
      const rubrica = Array.isArray(pub.rubrica) ? pub.rubrica : [];

      const yaCalificado = e.estado === 'calificado';

      return `
        <div class="card border rounded-3 p-3 aula-entrega-card" data-entrega-id="${e.id}" data-estado="${e.estado}">
          <div class="d-flex align-items-start gap-3">
            <div class="bg-secondary-subtle rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:40px;height:40px;">
              <i class="bi ${isGroupDelivery ? 'bi-people-fill' : 'bi-person-fill'} text-secondary"></i>
            </div>
            <div class="flex-grow-1 min-width-0">
              <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                <span class="fw-semibold small">${esc(tituloEntrega)}</span>
                ${detalleEntrega ? `<span class="text-muted small">${esc(detalleEntrega)}</span>` : ''}
                ${isGroupDelivery ? '<span class="badge bg-secondary-subtle text-secondary rounded-pill small"><i class="bi bi-people-fill me-1"></i>Entrega grupal</span>' : ''}
                ${estadoBadge[e.estado] || ''}
                <span class="text-muted small ms-auto">${fecha}</span>
              </div>

              ${e.contenido ? `<div class="small text-muted mb-2" style="white-space:pre-line;">${esc(e.contenido)}</div>` : ''}
              ${archivosHTML ? `<div class="mb-2">${archivosHTML}</div>` : ''}

              ${yaCalificado && e.retroalimentacion ? `
                <div class="small text-muted mb-2 fst-italic">
                  <i class="bi bi-chat-left me-1"></i>${esc(e.retroalimentacion)}
                </div>` : ''}

              <!-- Rúbrica (si la tarea la tiene) -->
              ${rubrica.length ? `
              <div class="border rounded-3 p-2 mb-2 small">
                <div class="fw-semibold text-muted mb-2"><i class="bi bi-list-check me-1"></i>Rúbrica</div>
                <div class="vstack gap-1 aula-rubrica-criterios" data-max="${maxPts}">
                  ${rubrica.map((c, ci) => {
                    const niveles = _getRubricaLevels(c);
                    return `
                    <div class="aula-criterio-eval" data-criterio-idx="${ci}" data-peso="${c.peso}">
                      <div class="d-flex justify-content-between mb-1">
                        <span class="fw-semibold">${esc(c.criterio)}</span>
                        <span class="text-muted">${c.peso}%</span>
                      </div>
                      <div class="d-flex gap-1 flex-wrap">
                        ${niveles.map((n, ni) => `
                          <button type="button" class="btn btn-sm rounded-pill aula-nivel-btn"
                            data-criterio="${ci}" data-nivel="${ni}" data-pct="${n.pct}"
                            style="border:1px solid #e2e8f0;font-size:.72rem;">
                            ${esc(n.label)}${n.pct != null ? ` (${n.pct}%)` : ''}
                          </button>`).join('')}
                      </div>
                    </div>`;
                  }).join('')}
                </div>
                <div class="text-end mt-1 small text-muted">Cal. calculada: <strong class="aula-rubrica-resultado">—</strong></div>
              </div>` : ''}

              <!-- Calificación inline -->
              <div class="d-flex align-items-center gap-2 mt-2 flex-wrap">
                <div class="input-group input-group-sm" style="max-width:170px;">
                  <span class="input-group-text small">Cal.</span>
                  <input type="number" class="form-control aula-cal-input" min="0" max="${maxPts}"
                    value="${e.calificacion != null ? e.calificacion : ''}"
                    placeholder="0–${maxPts}"
                    title="Rango válido: 0 a ${maxPts}">
                  <span class="input-group-text small text-muted">/${maxPts}</span>
                </div>
                <input type="text" class="form-control form-control-sm aula-retro-input"
                  placeholder="Retroalimentación (opcional)"
                  value="${esc(e.retroalimentacion || '')}"
                  style="max-width:260px;">
                ${idx > 0 ? `<button class="btn btn-sm btn-outline-secondary rounded-pill px-2 aula-copiar-retro" title="Copiar retroalimentación anterior">
                  <i class="bi bi-clipboard me-1"></i>Copiar
                </button>` : ''}
                <button class="btn btn-sm btn-primary rounded-pill px-3 aula-calificar-btn" data-entrega-id="${e.id}" data-max="${maxPts}">
                  <i class="bi bi-check-lg me-1"></i>${yaCalificado ? 'Actualizar' : 'Calificar'}
                </button>
              </div>

              <!-- Alerta de rango fuera -->
              <div class="aula-rango-error small text-danger mt-1" style="display:none;">
                <i class="bi bi-exclamation-triangle me-1"></i>La calificación debe estar entre 0 y ${maxPts}.
              </div>
            </div>
          </div>
        </div>`;
    }

    function _bindGradeEvents(ctx, pub) {
      const list = document.getElementById('aula-grade-list');
      if (!list) return;

      // Validación de rango en inputs de calificación
      list.addEventListener('input', e => {
        const input = e.target.closest('.aula-cal-input');
        if (!input) return;
        const card  = input.closest('.aula-entrega-card');
        const max   = parseFloat(input.getAttribute('max') || 100);
        const val   = parseFloat(input.value);
        const error = card?.querySelector('.aula-rango-error');
        const btn   = card?.querySelector('.aula-calificar-btn');
        const fueraDerango = !isNaN(val) && (val < 0 || val > max);
        if (error) error.style.display = fueraDerango ? '' : 'none';
        if (btn)   btn.disabled = fueraDerango;
        input.classList.toggle('is-invalid', fueraDerango);
      });

      // Selección de nivel en rúbrica → calcula calificación automáticamente
      list.addEventListener('click', e => {
        const nivelBtn = e.target.closest('.aula-nivel-btn');
        if (!nivelBtn) return;
        const card     = nivelBtn.closest('.aula-entrega-card');
        const ciIdx    = parseInt(nivelBtn.dataset.criterio);
        const pct      = parseFloat(nivelBtn.dataset.pct);
        const maxPts   = parseFloat(card?.querySelector('.aula-rubrica-criterios')?.dataset.max || 100);

        // Marcar nivel seleccionado en este criterio
        card?.querySelectorAll(`.aula-nivel-btn[data-criterio="${ciIdx}"]`).forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline-secondary');
          b.style.removeProperty('border');
        });
        nivelBtn.classList.remove('btn-outline-secondary');
        nivelBtn.classList.add('btn-primary');

        // Calcular calificación ponderada
        const criterios = card?.querySelectorAll('.aula-criterio-eval') || [];
        let totalPeso = 0, sumaAplicada = 0, todosSeleccionados = true;
        criterios.forEach(cEl => {
          const peso      = parseFloat(cEl.dataset.peso) || 0;
          const selected  = cEl.querySelector('.aula-nivel-btn.btn-primary');
          if (selected) {
            sumaAplicada += (parseFloat(selected.dataset.pct) / 100) * peso;
            totalPeso    += peso;
          } else {
            todosSeleccionados = false;
          }
        });

        const resultadoEl = card?.querySelector('.aula-rubrica-resultado');
        if (todosSeleccionados && totalPeso > 0) {
          const calCalc = Math.round((sumaAplicada / 100) * maxPts);
          if (resultadoEl) resultadoEl.textContent = calCalc;
          // Pre-rellenar el input de calificación
          const calInput = card?.querySelector('.aula-cal-input');
          if (calInput) { calInput.value = calCalc; calInput.dispatchEvent(new Event('input')); }
        } else {
          if (resultadoEl) resultadoEl.textContent = '—';
        }
      });

      // Botón copiar retroalimentación anterior
      list.addEventListener('click', e => {
        const copyBtn = e.target.closest('.aula-copiar-retro');
        if (copyBtn) {
          const cards  = list.querySelectorAll('.aula-entrega-card');
          const thisCard = copyBtn.closest('.aula-entrega-card');
          const idx    = Array.from(cards).indexOf(thisCard);
          if (idx > 0) {
            const prevRetro = cards[idx - 1]?.querySelector('.aula-retro-input')?.value;
            const thisRetro = thisCard.querySelector('.aula-retro-input');
            if (prevRetro && thisRetro) { thisRetro.value = prevRetro; toast('Retroalimentación copiada', 'info'); }
          }
        }
      });

      // Botón calificar
      list.addEventListener('click', async e => {
        const btn = e.target.closest('.aula-calificar-btn');
        if (!btn || btn.disabled) return;

        const entregaId = btn.dataset.entregaId;
        const card      = btn.closest('.aula-entrega-card');
        const cal       = parseFloat(card?.querySelector('.aula-cal-input')?.value);
        const maxPts    = parseFloat(btn.dataset.max || 100);
        const retro     = card?.querySelector('.aula-retro-input')?.value.trim() || '';

        if (isNaN(cal) || cal < 0 || cal > maxPts) return toast(`Calificación debe ser de 0 a ${maxPts}`, 'warning');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>';

        try {
          await AulaService.calificarEntrega(ctx, entregaId, cal, retro);

          // Actualizar badge de estado en la card
          const badge = card?.querySelector('.aula-estado-badge') || card?.querySelector('.badge');
          if (badge) {
            badge.className = 'badge bg-success-subtle text-success rounded-pill small aula-estado-badge';
            badge.dataset.entregaId = entregaId;
            badge.textContent = `Calificado: ${cal}/${maxPts}`;
          }
          card?.setAttribute('data-estado', 'calificado');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Actualizar';
          btn.classList.remove('btn-success');
          btn.classList.add('btn-primary');
          toast('Calificación guardada', 'success');

          // Actualizar contador del header
          _actualizarContadores();
          _applyGradeFilter(_getActiveGradeFilter());
        } catch (err) {
          console.error(err);
          toast('Error al calificar', 'danger');
          btn.disabled = false;
          btn.innerHTML = `<i class="bi bi-check-lg me-1"></i>${card?.dataset.estado === 'calificado' ? 'Actualizar' : 'Calificar'}`;
        }
      });

      // Filtros
      document.getElementById(GRADE_MODAL)?.addEventListener('click', e => {
        const filterBtn = e.target.closest('.aula-grade-filter');
        if (!filterBtn) return;
        const filter = filterBtn.dataset.filter;
        document.querySelectorAll('.aula-grade-filter').forEach(b => {
          b.classList.remove('btn-primary', 'btn-danger', 'active');
          b.classList.add('btn-outline-secondary');
        });
        filterBtn.classList.remove('btn-outline-secondary');
        filterBtn.classList.add('btn-primary', 'active');
        _applyGradeFilter(filter);
      });

      document.getElementById(GRADE_MODAL)?.addEventListener('hidden.bs.modal', () => {
        document.getElementById(GRADE_MODAL)?.remove();
      });
    }

    /** Actualiza los badges de conteo en el header del modal de calificación */
    function _actualizarContadores() {
      const list = document.getElementById('aula-grade-list');
      if (!list) return;
      const cards      = list.querySelectorAll('.aula-entrega-card');
      const calificadas = list.querySelectorAll('[data-estado="calificado"]').length;
      const pendientes  = cards.length - calificadas;
      const countPend   = document.getElementById('aula-grade-count-pendientes');
      const countCal    = document.getElementById('aula-grade-count-calificadas');
      if (countPend) countPend.textContent = `${pendientes} por calificar`;
      if (countCal)  countCal.textContent  = `${calificadas} calificadas`;
    }

    // ══════════════════════════════════════════════════════════
    //  TABLA DE CALIFICACIONES (tab Calificaciones)
    // ══════════════════════════════════════════════════════════

    async function renderGradeTable(ctx, claseId) {
      const container = document.getElementById('aula-calif-container');
      if (!container) return;

      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

      try {
        AulaService.invalidateCache('tabla_cal_');
        const { tareas, estudiantes, entregasMap } = await AulaService.getTablaCalificaciones(ctx, claseId);

        if (!tareas.length) {
          container.innerHTML = '<div class="text-center py-4 text-muted small">No hay tareas asignadas aún.</div>';
          return;
        }
        if (!estudiantes.length) {
          container.innerHTML = '<div class="text-center py-4 text-muted small">No hay estudiantes en la clase.</div>';
          return;
        }

        // Calcular datos para promedios de clase por tarea
        const promediosPorTarea = tareas.map(t => {
          const cals = estudiantes
            .map(est => {
              const entrega = entregasMap[`${est.userId}_${t.id}`];
              return entrega?.notApplicable ? null : entrega?.calificacion;
            })
            .filter(c => c != null);
          return cals.length ? Math.round(cals.reduce((s, c) => s + c, 0) / cals.length) : null;
        });

        // Calcular datos por estudiante
        const filas = estudiantes.map(est => {
          const cals = tareas.map(t => {
            const key = `${est.userId}_${t.id}`;
            return entregasMap[key] || null;
          });
          const aplicables  = cals.filter(e => !e?.notApplicable);
          const calNums     = aplicables.filter(e => e?.calificacion != null).map(e => e.calificacion);
          const promedio    = calNums.length ? Math.round(calNums.reduce((s, c) => s + c, 0) / calNums.length) : null;
          const entregadas  = aplicables.filter(e => e != null).length;
          const totalAplicables = aplicables.length;
          const enRiesgo    = totalAplicables > 0
            ? (promedio != null ? (promedio < 70) : (entregadas < totalAplicables * 0.5))
            : false;
          return { est, cals, promedio, entregadas, totalAplicables, enRiesgo };
        });

        container.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div class="small text-muted">
              <span class="badge bg-danger-subtle text-danger rounded-pill me-1">
                <i class="bi bi-exclamation-triangle me-1"></i>${filas.filter(f => f.enRiesgo).length} en riesgo
              </span>
              <span class="text-muted">(promedio &lt; 70 o &lt; 50% tareas aplicables entregadas)</span>
            </div>
            <button class="btn btn-sm btn-outline-success rounded-pill px-3" id="aula-exportar-csv">
              <i class="bi bi-download me-1"></i>Exportar CSV
            </button>
          </div>

          <div class="table-responsive rounded-3 border">
            <table class="table table-sm table-hover align-middle mb-0 small" id="aula-grade-table">
              <thead>
                <tr>
                  <th class="fw-semibold ps-3" style="min-width:200px; cursor:pointer;" data-sort="nombre">
                    Estudiante <i class="bi bi-arrow-down-up text-muted ms-1" style="font-size:.7rem;"></i>
                  </th>
                  ${tareas.map((t, i) => `
                    <th class="text-center fw-semibold" style="min-width:90px; cursor:pointer;" data-sort="tarea" data-tarea-idx="${i}" title="${esc(t.titulo)}">
                      ${esc(t.titulo?.substring(0, 12) || 'Tarea')}…
                      <div class="text-muted fw-normal" style="font-size:.65rem;">${promediosPorTarea[i] != null ? 'Prom: ' + promediosPorTarea[i] : '—'}</div>
                    </th>`).join('')}
                  <th class="text-center fw-semibold" style="min-width:80px;">Promedio</th>
                </tr>
              </thead>
              <tbody>
                ${filas.map(({ est, cals, promedio, enRiesgo }) => `
                  <tr class="${enRiesgo ? 'aula-fila-riesgo' : ''}">
                    <td class="ps-3">
                      <div class="d-flex align-items-center gap-2">
                        ${enRiesgo ? '<i class="bi bi-exclamation-triangle-fill text-danger flex-shrink-0" title="Estudiante en riesgo" style="font-size:.8rem;"></i>' : ''}
                        <div>
                          <div class="fw-semibold">${esc(est.userName)}</div>
                          <div class="text-muted" style="font-size:0.73rem;">${esc(est.matricula || est.userEmail)}</div>
                        </div>
                      </div>
                    </td>
                    ${cals.map((e, ti) => {
                      if (e?.notApplicable) {
                        return `<td class="text-center"><span class="badge bg-secondary-subtle text-secondary rounded-pill" title="Asignada a ${esc(e.grupoNombre || 'otro grupo')}">N/A</span></td>`;
                      }
                      if (!e) return `<td class="text-center text-muted" title="Sin entrega">—</td>`;
                      if (e.calificacion != null) {
                        const max   = tareas[ti]?.puntajeMax || 100;
                        const color = e.calificacion >= 70 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
                        const retro = e.retroalimentacion ? ` title="Retroalimentación: ${esc(e.retroalimentacion)}"` : '';
                        const label = `${e.isGroupDelivery ? '<i class="bi bi-people-fill me-1"></i>' : ''}${e.calificacion}/${max}`;
                        return `<td class="text-center"><span class="badge ${color} rounded-pill"${retro}>${label}</span></td>`;
                      }
                      return `<td class="text-center"><span class="badge bg-primary-subtle text-primary rounded-pill">${e?.isGroupDelivery ? '<i class="bi bi-people-fill me-1"></i>' : ''}Pend.</span></td>`;
                    }).join('')}
                    <td class="text-center fw-bold ${promedio != null ? (promedio >= 70 ? 'text-success' : 'text-danger') : 'text-muted'}">
                      ${promedio ?? '—'}
                    </td>
                  </tr>`).join('')}
              </tbody>
              <!-- Fila de promedios de clase -->
              <tfoot>
                <tr class="border-top">
                  <td class="ps-3 small text-muted fw-semibold">Promedio clase</td>
                  ${promediosPorTarea.map(p =>
                    `<td class="text-center small fw-semibold ${p != null ? (p >= 70 ? 'text-success' : 'text-warning') : 'text-muted'}">${p ?? '—'}</td>`
                  ).join('')}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>`;

        // Bind exportar CSV
        document.getElementById('aula-exportar-csv')?.addEventListener('click', () => {
          _exportarCSV(tareas, filas);
        });

        // Ordenar tabla por columna
        container.querySelectorAll('th[data-sort]').forEach(th => {
          th.addEventListener('click', () => _sortTable(th, filas, tareas));
        });

      } catch (err) {
        console.error('[AulaEntregas] GradeTable error:', err);
        container.innerHTML = '<div class="text-danger small text-center py-3">Error al cargar calificaciones.</div>';
      }
    }

    /**
     * Exporta la tabla de calificaciones a CSV
     * @param {Array} tareas - Lista de tareas
     * @param {Array} filas  - Filas con datos de estudiantes
     */
    function _exportarCSV(tareas, filas) {
      const encabezados = ['Nombre', 'Matrícula', ...tareas.map(t => t.titulo || 'Tarea'), 'Promedio'];
      const rows = filas.map(({ est, cals, promedio }) => [
        est.userName,
        est.matricula || est.userEmail,
        ...cals.map(e => e?.notApplicable ? 'N/A' : (e?.calificacion != null ? e.calificacion : '')),
        promedio ?? ''
      ]);

      const csvContent = [encabezados, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `calificaciones_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('Exportando CSV...', 'info');
    }

    /**
     * Ordena la tabla por columna (nombre o tarea específica)
     * @param {HTMLElement} th
     * @param {Array} filas
     * @param {Array} tareas
     */
    function _sortTable(th, filas, tareas) {
      const table = document.getElementById('aula-grade-table');
      if (!table) return;
      const tbody  = table.querySelector('tbody');
      const rows   = Array.from(tbody.querySelectorAll('tr'));
      const asc    = th.dataset.sortDir !== 'asc';
      th.dataset.sortDir = asc ? 'asc' : 'desc';

      rows.sort((a, b) => {
        let valA, valB;
        if (th.dataset.sort === 'nombre') {
          valA = a.querySelector('td')?.textContent.trim().toLowerCase() || '';
          valB = b.querySelector('td')?.textContent.trim().toLowerCase() || '';
          return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (th.dataset.sort === 'tarea') {
          const idx  = parseInt(th.dataset.tareaIdx) + 1; // +1 por col nombre
          valA = parseFloat(a.querySelectorAll('td')[idx]?.textContent) || -1;
          valB = parseFloat(b.querySelectorAll('td')[idx]?.textContent) || -1;
          return asc ? valA - valB : valB - valA;
        }
        return 0;
      });
      rows.forEach(r => tbody.appendChild(r));
    }

    return { openSubmitModal, openGradeView, renderGradeTable };
  })();

  global.AulaEntregas = AulaEntregas;
})(window);
