/* ============================================================
   AulaGrupos — Gestión de grupos de trabajo dentro de una clase
   Docente: crear, editar, eliminar grupos · Asignar miembros
   Estudiante: ver su grupo asignado
   ============================================================ */
(function (global) {
  const AulaGrupos = (function () {

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
    function toast(msg, type) { if (global.SIA?.toast) global.SIA.toast(msg, type); else if (global.showToast) global.showToast(msg, type); }

    /**
     * Renderiza la sección de grupos en el contenedor dado.
     * @param {object} ctx
     * @param {string} claseId
     * @param {HTMLElement} containerEl
     * @param {boolean} isDocente
     * @param {boolean} canManage - Controla si la UI docente puede gestionar grupos
     */
    async function render(ctx, claseId, containerEl, isDocente, canManage) {
      if (!containerEl) return;

      containerEl.innerHTML = `
        <div class="mt-4 pt-3 border-top">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="fw-bold mb-0 text-dark">
              <i class="bi bi-people-fill me-2 text-primary"></i>Grupos de Trabajo
            </h6>
            ${canManage ? `
              <button class="btn btn-sm btn-primary rounded-pill px-3" id="aula-grupos-nuevo-btn">
                <i class="bi bi-plus-lg me-1"></i>Nuevo Grupo
              </button>` : ''}
          </div>
          <div id="aula-grupos-lista">
            <div class="text-center py-2"><div class="spinner-border spinner-border-sm text-primary"></div></div>
          </div>
        </div>`;

      if (canManage) {
        containerEl.querySelector('#aula-grupos-nuevo-btn')?.addEventListener('click', () => {
          _openModalGrupo(ctx, claseId, null);
        });
      }

      await _loadGrupos(ctx, claseId, containerEl, isDocente, canManage);
    }

    /**
     * Carga y renderiza la lista de grupos.
     */
    async function _loadGrupos(ctx, claseId, containerEl, isDocente, canManage) {
      const lista = containerEl.querySelector('#aula-grupos-lista');
      if (!lista) return;
      try {
        const grupos = await global.AulaService.getGrupos(ctx, claseId);
        const uid    = ctx.auth.currentUser.uid;

        if (!grupos.length) {
          lista.innerHTML = `<div class="text-muted small text-center py-3">
            ${canManage ? 'No hay grupos creados aún.' : 'No estás asignado a ningún grupo.'}
          </div>`;
          return;
        }

        if (!isDocente) {
          // Estudiante: solo ver su propio grupo
          const miGrupo = grupos.find(g => g.miembroIds?.includes(uid));
          if (!miGrupo) {
            lista.innerHTML = '<div class="text-muted small text-center py-3">No estás asignado a ningún grupo.</div>';
            return;
          }
          lista.innerHTML = `
            <div class="card border-0 bg-primary-subtle rounded-4 p-3">
              <div class="fw-semibold mb-1"><i class="bi bi-people me-1 text-primary"></i>${esc(miGrupo.nombre)}</div>
              <div class="small text-muted">${miGrupo.miembroIds?.length || 0} miembros en tu grupo</div>
            </div>`;
          return;
        }

        // Docente: ver todos los grupos
        lista.innerHTML = grupos.map(g => `
          <div class="d-flex align-items-center gap-3 py-2 border-bottom">
            <div class="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                 style="width:38px;height:38px;">
              <i class="bi bi-people-fill text-primary" style="font-size:.85rem;"></i>
            </div>
            <div class="flex-grow-1 min-width-0">
              <div class="fw-semibold small">${esc(g.nombre)}</div>
              <div class="text-muted small">${g.miembroIds?.length || 0} miembros</div>
            </div>
            ${canManage ? `
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-2 aula-grupo-edit-btn" data-grupo-id="${g.id}" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger rounded-pill px-2 aula-grupo-del-btn" data-grupo-id="${g.id}" data-clase-id="${claseId}" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>` : ''}
          </div>`).join('');

        // Eventos editar/eliminar
        lista.querySelectorAll('.aula-grupo-edit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const g = grupos.find(x => x.id === btn.dataset.grupoId);
            if (g) _openModalGrupo(ctx, claseId, g);
          });
        });
        lista.querySelectorAll('.aula-grupo-del-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar este grupo? Las tareas asignadas al grupo no se verán afectadas.')) return;
            try {
              await global.AulaService.deleteGrupo(ctx, btn.dataset.grupoId, claseId);
              toast('Grupo eliminado', 'info');
              await _loadGrupos(ctx, claseId, containerEl, isDocente, canManage);
            } catch (_) { toast('Error al eliminar grupo', 'danger'); }
          });
        });

      } catch (err) {
        console.error('[AulaGrupos] loadGrupos error:', err);
        lista.innerHTML = '<div class="alert alert-danger small py-2">Error al cargar grupos.</div>';
      }
    }

    /**
     * Abre el modal para crear o editar un grupo.
     * @param {object} ctx
     * @param {string} claseId
     * @param {object|null} grupoExistente
     */
    async function _openModalGrupo(ctx, claseId, grupoExistente) {
      const MODAL_ID = 'aula-modal-grupo';
      document.getElementById(MODAL_ID)?.remove();

      // Cargar miembros para el selector
      let miembros = [];
      try {
        const todos = await global.AulaService.getMiembros(ctx, claseId, 100);
        miembros = todos.filter(m => m.rol !== 'docente');
      } catch (_) {}

      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="${MODAL_ID}" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 rounded-4 shadow">
              <div class="modal-header border-0 pb-0 px-4 pt-4">
                <h5 class="modal-title fw-bold">
                  <i class="bi bi-people-fill text-primary me-2"></i>${grupoExistente ? 'Editar Grupo' : 'Nuevo Grupo'}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body px-4 py-3">
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Nombre del grupo <span class="text-danger">*</span></label>
                  <input type="text" id="aula-grupo-nombre" class="form-control rounded-3"
                         placeholder="Ej: Equipo Alpha" maxlength="60"
                         value="${esc(grupoExistente?.nombre || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Selecciona miembros</label>
                  <div class="border rounded-3 p-2" style="max-height:200px;overflow-y:auto;">
                    ${miembros.length ? miembros.map(m => `
                      <div class="form-check py-1">
                        <input class="form-check-input aula-grupo-member-check" type="checkbox"
                               value="${m.userId}" id="gm_${m.userId}"
                               ${(grupoExistente?.miembroIds || []).includes(m.userId) ? 'checked' : ''}>
                        <label class="form-check-label small" for="gm_${m.userId}">
                          ${esc(m.userName)} ${m.matricula ? '· ' + esc(m.matricula) : ''}
                        </label>
                      </div>`).join('') : '<p class="text-muted small mb-0">No hay estudiantes en esta clase.</p>'}
                  </div>
                </div>
              </div>
              <div class="modal-footer border-0 px-4 pb-4 pt-0">
                <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary rounded-pill px-4" id="aula-grupo-save-btn">
                  <i class="bi bi-check-lg me-1"></i>${grupoExistente ? 'Guardar' : 'Crear Grupo'}
                </button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(div.firstElementChild);

      const modal = new bootstrap.Modal(document.getElementById(MODAL_ID));
      modal.show();

      document.getElementById('aula-grupo-save-btn')?.addEventListener('click', async () => {
        const nombre = document.getElementById('aula-grupo-nombre')?.value.trim();
        if (!nombre) { toast('El nombre del grupo es requerido', 'warning'); return; }

        const miembroIds = [...document.querySelectorAll('.aula-grupo-member-check:checked')].map(c => c.value);
        const btn = document.getElementById('aula-grupo-save-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';

        try {
          if (grupoExistente) {
            await global.AulaService.updateGrupo(ctx, grupoExistente.id, { nombre, miembroIds });
            toast('Grupo actualizado', 'success');
          } else {
            await global.AulaService.createGrupo(ctx, claseId, nombre, miembroIds);
            toast('Grupo creado', 'success');
          }
          modal.hide();
          // Recargar la sección de grupos en el tab Miembros
            const container = document.getElementById('aula-grupos-section');
            if (container) {
              const uid = ctx.auth.currentUser.uid;
              const clase = global.AulaService.getClase ? await global.AulaService.getClase(ctx, claseId) : {};
              const canManage = global.SIA?.canManageAulaClase
                ? global.SIA.canManageAulaClase(ctx.profile, clase, uid)
                : (clase?.docenteId === uid);
              render(ctx, claseId, container, true, canManage);
            }
        } catch (err) {
          console.error('[AulaGrupos] save error:', err);
          toast('Error al guardar grupo', 'danger');
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>' + (grupoExistente ? 'Guardar' : 'Crear Grupo');
        }
      });

      document.getElementById(MODAL_ID)?.addEventListener('hidden.bs.modal', () => {
        document.getElementById(MODAL_ID)?.remove();
      });
    }

    return { render };
  })();

  global.AulaGrupos = AulaGrupos;
})(window);
