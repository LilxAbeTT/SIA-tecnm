(function (global) {
  const AdminAula = (function () {
    let _ctx = null;
    let _clases = [];
    let _crearForm = null;
    let _editarForm = null;
    let _unsubMembres = null;

    function esc(value) {
      const div = document.createElement('div');
      div.textContent = value || '';
      return div.innerHTML;
    }

    function $id(id) { return document.getElementById(id); }

    function toast(msg, type) {
      if (global.SIA?.toast) return global.SIA.toast(msg, type);
      if (global.showToast) return global.showToast(msg, type);
    }

    function normalize(value) {
      return global.AulaSubjectCatalog?.normalizeText
        ? global.AulaSubjectCatalog.normalizeText(value)
        : String(value || '').trim().toLowerCase();
    }

    function titleFor(clase) {
      return clase?.titulo || clase?.materia || 'Nueva clase';
    }

    function careerFor(clase) {
      return clase?.carreraNombre || clase?.carrera || '';
    }

    function semesterFor(clase) {
      return clase?.semestreLabel || clase?.semestre || '';
    }

    function subtitleFor(clase) {
      const titleNorm = normalize(clase?.titulo);
      const materiaNorm = normalize(clase?.materia);
      const parts = [];
      if (clase?.materia && titleNorm !== materiaNorm) parts.push(clase.materia);
      if (careerFor(clase)) parts.push(careerFor(clase));
      if (semesterFor(clase)) parts.push(semesterFor(clase));
      if (clase?.turno) parts.push(clase.turno);
      return parts.join(' · ');
    }

    function canManage(clase) {
      return global.SIA?.canManageAulaClase
        ? global.SIA.canManageAulaClase(_ctx?.profile, clase, _ctx?.auth?.currentUser?.uid)
        : Boolean(clase && _ctx?.auth?.currentUser?.uid && clase.docenteId === _ctx.auth.currentUser.uid);
    }

    async function init(ctx) {
      _ctx = ctx;
      renderShell();
      bindStaticEvents();
      await loadClases();
      if (_unsubMembres) _unsubMembres();
      _unsubMembres = global.AulaService?.streamMisClasesMembres
        ? global.AulaService.streamMisClasesMembres(ctx, ctx.auth.currentUser.uid, async () => {
            global.AulaService.invalidateCache('clases_');
            await loadClases();
          })
        : null;
    }

    function renderShell() {
      const root = $id('view-aula');
      if (!root) return;
      const nombre = (_ctx.profile?.displayName || _ctx.auth.currentUser?.displayName || 'usuario').split(' ')[0];
      const crearMarkup = global.AulaClassForm?.buildMarkup ? global.AulaClassForm.buildMarkup('crear') : '<div class="alert alert-warning mb-0">No se pudo cargar el formulario.</div>';
      const editarMarkup = global.AulaClassForm?.buildMarkup ? global.AulaClassForm.buildMarkup('editar') : '<div class="alert alert-warning mb-0">No se pudo cargar el formulario.</div>';

      root.innerHTML = `
        <div class="aula-main-hero rounded-4 mb-3">
          <div class="p-4 p-md-5 pb-4">
            <div class="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
              <div class="d-flex align-items-center gap-3">
                <div class="aula-hero-avatar"><i class="bi bi-mortarboard-fill text-white fs-4"></i></div>
                <div class="text-white">
                  <h4 class="fw-bold mb-0 filter-white">Hola, ${esc(nombre)}!</h4>
                  <p class="mb-0 small" style="opacity:.72;">Aula admin · crea, organiza y edita tus clases</p>
                </div>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-white-glass rounded-pill px-3" id="aula-btn-unirse-docente"><i class="bi bi-person-plus me-1"></i>Unirme como co-docente</button>
                <button class="btn btn-light rounded-pill px-3 shadow-sm" id="aula-btn-crear"><i class="bi bi-plus-lg me-1"></i>Crear Clase</button>
              </div>
            </div>
            <div class="aula-nav-search">
              <div class="input-group">
                <span class="input-group-text bg-white border-0"><i class="bi bi-search"></i></span>
                <input type="text" id="aula-search" class="form-control border-0" placeholder="Buscar clase, materia o semestre...">
              </div>
            </div>
          </div>
        </div>

        <section class="mb-4"><div class="d-flex align-items-center justify-content-between mb-2"><h5 class="fw-bold mb-0">Mis clases</h5><span class="small text-muted" id="aula-count-own">0</span></div><div id="aula-grid-own" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4"></div><div id="aula-empty-own" class="text-center py-5 d-none text-muted">Aun no tienes clases creadas.</div></section>
        <section class="mb-4"><div class="d-flex align-items-center justify-content-between mb-2"><h5 class="fw-bold mb-0">Co-docencia</h5><span class="small text-muted" id="aula-count-co">0</span></div><div id="aula-grid-co" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4"></div><div id="aula-empty-co" class="text-center py-5 d-none text-muted">No estas asignado como co-docente.</div></section>
        <section><div class="d-flex align-items-center justify-content-between mb-2"><h5 class="fw-bold mb-0">Archivadas</h5><span class="small text-muted" id="aula-count-arch">0</span></div><div id="aula-grid-arch" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4"></div><div id="aula-empty-arch" class="text-center py-5 d-none text-muted">No tienes clases archivadas.</div></section>

        <div class="modal fade" id="modalAulaUnirseDocente" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow-lg" style="overflow:hidden;"><div class="p-4" style="background:linear-gradient(135deg,#dbeafe,#ecfeff);"><div class="d-flex justify-content-end"><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="text-center mb-3"><div class="d-inline-flex align-items-center justify-content-center rounded-circle bg-white shadow-sm mb-3" style="width:64px;height:64px;"><i class="bi bi-person-fill-gear fs-2 text-primary"></i></div><h4 class="fw-bold text-dark mb-1">Unirme como co-docente</h4><p class="text-muted small mb-0">Ingresa el codigo de la clase.</p></div></div><form id="aula-unirse-docente-form" class="p-4"><div class="mb-4"><input type="text" id="aula-unirse-docente-codigo" class="form-control form-control-lg text-center fw-bold fs-3 tracking-widest bg-light" placeholder="A1B2C3" required maxlength="6" style="letter-spacing:.5rem; text-transform:uppercase;"><div id="aula-unirse-docente-error" class="text-danger small text-center mt-2 d-none fw-semibold"><i class="bi bi-exclamation-circle me-1"></i>Codigo invalido o acceso no disponible.</div></div><div class="d-flex gap-2"><button type="button" class="btn btn-light rounded-pill flex-grow-1" data-bs-dismiss="modal">Cancelar</button><button type="submit" class="btn btn-primary rounded-pill flex-grow-1 shadow-sm" id="aula-unirse-docente-submit">Unirme</button></div></form></div></div></div>

        <div class="modal fade" id="modalAulaCrearClase" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable"><div class="modal-content aula-class-modal-content rounded-4 border-0 shadow-lg"><div class="modal-header border-0 pb-0 px-4 pt-4"><h5 class="modal-title fw-bold"><i class="bi bi-plus-circle-fill text-primary me-2"></i>Crear Clase</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form id="aula-crear-form" class="aula-class-modal-form"><div class="modal-body aula-class-modal-body px-4 pb-2">${crearMarkup}</div><div class="modal-footer aula-class-modal-footer border-0 px-4 pb-4 pt-2"><button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button><button type="submit" class="btn btn-primary rounded-pill px-4 shadow-sm" id="aula-crear-submit"><i class="bi bi-check-lg me-1"></i>Crear Clase</button></div></form></div></div></div>

        <div class="modal fade" id="modalAulaEditarClase" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable"><div class="modal-content aula-class-modal-content rounded-4 border-0 shadow-lg"><div class="modal-header border-0 pb-0 px-4 pt-4"><h5 class="modal-title fw-bold"><i class="bi bi-pencil-fill text-warning me-2"></i>Editar Clase</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form id="aula-editar-form" class="aula-class-modal-form"><input type="hidden" id="aula-editar-clase-id"><div class="modal-body aula-class-modal-body px-4 pb-2">${editarMarkup}<div class="border rounded-3 p-3 mt-4"><div class="d-flex justify-content-between align-items-center gap-3 flex-wrap"><div><div class="small fw-semibold">Codigo de acceso</div><div class="small text-muted">Codigo actual: <span id="aula-editar-codigo-actual" class="fw-bold font-monospace text-primary"></span></div></div><button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" id="aula-regenerar-codigo"><i class="bi bi-arrow-repeat me-1"></i>Regenerar</button></div></div></div><div class="modal-footer aula-class-modal-footer border-0 px-4 pb-4 pt-2 d-flex justify-content-between align-items-center"><div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" id="aula-editar-archivar-btn"><i class="bi bi-archive me-1"></i><span id="aula-editar-archivar-label">Archivar</span></button><button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" id="aula-editar-eliminar-btn"><i class="bi bi-trash me-1"></i>Eliminar</button></div><div class="d-flex gap-2"><button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button><button type="submit" class="btn btn-warning rounded-pill px-4 shadow-sm text-white" id="aula-editar-submit"><i class="bi bi-check-lg me-1"></i>Guardar</button></div></div></form></div></div></div>
      `;

      _crearForm = global.AulaClassForm?.createController('crear') || null;
      _editarForm = global.AulaClassForm?.createController('editar') || null;
    }

    function bindStaticEvents() {
      $id('aula-btn-crear')?.addEventListener('click', () => bootstrap.Modal.getOrCreateInstance($id('modalAulaCrearClase')).show());
      $id('aula-btn-unirse-docente')?.addEventListener('click', () => bootstrap.Modal.getOrCreateInstance($id('modalAulaUnirseDocente')).show());
      $id('aula-search')?.addEventListener('input', applySearch);
      $id('aula-grid-own')?.addEventListener('click', handleCardClick);
      $id('aula-grid-co')?.addEventListener('click', handleCardClick);
      $id('aula-grid-arch')?.addEventListener('click', handleCardClick);

      $id('aula-unirse-docente-form')?.addEventListener('submit', submitJoin);
      $id('aula-crear-form')?.addEventListener('submit', submitCreate);
      $id('aula-editar-form')?.addEventListener('submit', submitEdit);
      $id('aula-editar-archivar-btn')?.addEventListener('click', toggleArchiveFromModal);
      $id('aula-editar-eliminar-btn')?.addEventListener('click', deleteFromModal);
      $id('aula-regenerar-codigo')?.addEventListener('click', regenerateCode);
      $id('modalAulaCrearClase')?.addEventListener('hidden.bs.modal', () => _crearForm?.reset?.());
      $id('modalAulaEditarClase')?.addEventListener('hidden.bs.modal', () => { _editarForm?.reset?.(); if ($id('aula-editar-clase-id')) $id('aula-editar-clase-id').value = ''; });
    }

    async function loadClases() {
      const uid = _ctx.auth.currentUser.uid;
      _clases = await global.AulaService.getMisClases(_ctx, uid, 60, { includeArchived: true });
      const own = _clases.filter(c => c.docenteId === uid && !c.archivada);
      const co = _clases.filter(c => c.docenteId !== uid && !c.archivada);
      const arch = _clases.filter(c => c.docenteId === uid && c.archivada);
      renderList('own', own, true);
      renderList('co', co, false);
      renderList('arch', arch, true);
    }

    function renderList(key, items, isOwner) {
      $id(`aula-count-${key}`)?.replaceChildren(document.createTextNode(String(items.length)));
      const grid = $id(`aula-grid-${key}`);
      const empty = $id(`aula-empty-${key}`);
      if (!grid || !empty) return;
      empty.classList.toggle('d-none', items.length > 0);
      grid.innerHTML = items.map(item => renderCard(item, isOwner)).join('');
      applySearch();
    }

    function renderCard(clase, isOwner) {
      const color = clase.color || '#6366f1';
      const grad = `linear-gradient(135deg, ${color}ff 0%, ${color}bb 60%, ${color}77 100%)`;
      const subtitle = subtitleFor(clase);
      const career = careerFor(clase);
      const semester = semesterFor(clase);
      const turn = clase.turno || '';
      const menu = canManage(clase) ? `
        <li><button type="button" class="dropdown-item small" data-action="edit" data-id="${clase.id}"><i class="bi bi-pencil me-2 text-primary"></i>Editar clase</button></li>
        <li><button type="button" class="dropdown-item small" data-action="code" data-code="${esc(clase.codigoAcceso)}"><i class="bi bi-key me-2 text-info"></i>Copiar codigo</button></li>
        <li><button type="button" class="dropdown-item small" data-action="duplicate" data-id="${clase.id}"><i class="bi bi-copy me-2 text-secondary"></i>Duplicar clase</button></li>
        <li><hr class="dropdown-divider"></li>
        <li><button type="button" class="dropdown-item small ${clase.archivada ? 'text-success' : 'text-warning'}" data-action="archive" data-id="${clase.id}" data-archivada="${clase.archivada}"><i class="bi bi-${clase.archivada ? 'arrow-counterclockwise' : 'archive'} me-2"></i>${clase.archivada ? 'Restaurar clase' : 'Archivar clase'}</button></li>
        <li><button type="button" class="dropdown-item small text-danger" data-action="delete" data-id="${clase.id}"><i class="bi bi-trash me-2"></i>Eliminar clase</button></li>
      ` : `<li><button type="button" class="dropdown-item small text-muted" data-action="code" data-code="${esc(clase.codigoAcceso)}"><i class="bi bi-key me-2"></i>Ver codigo</button></li>`;

      return `<div class="col"><div class="aula-clase-card rounded-4 shadow-sm h-100 position-relative" role="button" data-open-clase="${clase.id}"><div class="aula-clase-card-banner" style="background:${grad};min-height:115px;position:relative;"><div class="aula-clase-card-banner-art"><div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.12);border-radius:50%;pointer-events:none;"></div></div><div class="d-flex justify-content-between align-items-start p-3"><div class="aula-clase-card-icon"><i class="bi ${esc(clase.icono || 'bi-book')} text-white fs-4"></i></div><div class="d-flex align-items-center gap-2">${isOwner ? '<span class="badge bg-opacity-25 text-white fw-normal small"><i class="bi bi-person-fill-gear me-1"></i>Lider</span>' : '<span class="badge bg-opacity-25 text-white fw-normal small"><i class="bi bi-people-fill me-1"></i>Co-Docente</span>'}<div class="dropdown aula-clase-card-dropdown"><button class="btn btn-white-glass btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center border-0" style="width:32px;height:32px;" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical text-white" style="font-size:.85rem;"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-3">${menu}</ul></div></div></div><div class="px-3 pb-3"><h5 class="text-white fw-bold mb-0 text-truncate" title="${esc(titleFor(clase))}">${esc(titleFor(clase))}</h5>${subtitle ? `<p class="text-white opacity-75 small mb-0 text-truncate">${esc(subtitle)}</p>` : ''}</div></div><div class="p-3"><div class="d-flex align-items-center gap-2 mb-2"><div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px;height:28px;background:${color}18;color:${color};"><i class="bi bi-person-fill" style="font-size:.75rem;"></i></div><span class="small text-muted text-truncate">${esc(clase.docenteNombre || '')}</span></div><div class="d-flex flex-wrap gap-1 align-items-center">${career ? `<span class="badge rounded-pill small" style="background:${color}15;color:${color};border:1px solid ${color}30;">${esc(career)}</span>` : ''}${semester ? `<span class="badge bg-secondary-subtle text-secondary rounded-pill small">${esc(semester)}</span>` : ''}${turn ? `<span class="badge bg-light text-dark rounded-pill small border">${esc(turn)}</span>` : ''}<span class="ms-auto small text-muted"><i class="bi bi-people me-1"></i>${clase.miembrosCount || 0}</span></div>${clase.descripcion ? `<p class="text-muted small mt-2 mb-0" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.78rem;">${esc(clase.descripcion)}</p>` : ''}</div></div></div>`;
    }

    function applySearch() {
      const term = ($id('aula-search')?.value || '').toLowerCase().trim();
      document.querySelectorAll('[data-open-clase]').forEach(card => {
        card.closest('.col').style.display = !term || card.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    }

    function handleCardClick(e) {
      const action = e.target.closest('[data-action]');
      if (action) {
        e.preventDefault();
        const id = action.dataset.id;
        if (action.dataset.action === 'edit') return openEdit(id);
        if (action.dataset.action === 'code') return copyCode(action.dataset.code);
        if (action.dataset.action === 'duplicate') return duplicateClase(id);
        if (action.dataset.action === 'archive') return toggleArchive(id, action.dataset.archivada === 'true');
        if (action.dataset.action === 'delete') return deleteClase(id, false);
        return;
      }
      const card = e.target.closest('[data-open-clase]');
      if (card && !e.target.closest('.dropdown, .dropdown-menu')) window.location.hash = `/aula/clase/${card.dataset.openClase}`;
    }

    function openEdit(id) {
      const clase = _clases.find(item => item.id === id);
      if (!clase) return toast('Clase no encontrada', 'warning');
      if (!canManage(clase)) return toast('No tienes permisos para editar esta clase', 'warning');
      $id('aula-editar-clase-id').value = id;
      $id('aula-editar-codigo-actual').textContent = clase.codigoAcceso || '';
      $id('aula-editar-archivar-label').textContent = clase.archivada ? 'Restaurar' : 'Archivar';
      _editarForm?.setData?.(clase);
      bootstrap.Modal.getOrCreateInstance($id('modalAulaEditarClase')).show();
    }

    function payloadFrom(clase) {
      return {
        titulo: clase.titulo || '',
        tituloPersonalizado: Boolean(clase.tituloPersonalizado),
        descripcion: clase.descripcion || '',
        materia: clase.materia || '',
        materiaId: clase.materiaId || '',
        materiaOriginal: clase.materiaOriginal || '',
        materiaManual: Boolean(clase.materiaManual),
        materiaPersonalizada: Boolean(clase.materiaPersonalizada),
        carrera: clase.carrera || '',
        carreraNombre: clase.carreraNombre || '',
        carreraId: clase.carreraId || '',
        semestre: clase.semestre || '',
        semestreLabel: clase.semestreLabel || '',
        semestreNumero: clase.semestreNumero || null,
        turno: clase.turno || '',
        turnoId: clase.turnoId || '',
        color: clase.color || '#6366f1',
        catalogVersion: clase.catalogVersion || ''
      };
    }

    function copyCode(code) {
      if (!code) return;
      navigator.clipboard?.writeText(code).then(() => toast(`Codigo copiado: ${code}`, 'success')).catch(() => toast(`Codigo de acceso: ${code}`, 'info'));
    }

    async function submitJoin(e) {
      e.preventDefault();
      const code = ($id('aula-unirse-docente-codigo')?.value || '').trim().toUpperCase();
      if (code.length < 6) return;
      try {
        await global.AulaService.joinClaseAsDocente(_ctx, code);
        bootstrap.Modal.getInstance($id('modalAulaUnirseDocente'))?.hide();
        toast('Ahora eres co-docente de la clase', 'success');
        await loadClases();
      } catch (err) {
        $id('aula-unirse-docente-error')?.classList.remove('d-none');
        toast(err?.message || 'No fue posible unirte a la clase.', 'danger');
      }
    }

    async function submitCreate(e) {
      e.preventDefault();
      const btn = $id('aula-crear-submit');
      if (!btn) return;
      btn.disabled = true;
      try {
        const payload = _crearForm?.getPayload?.();
        await global.AulaService.createClase(_ctx, payload);
        bootstrap.Modal.getInstance($id('modalAulaCrearClase'))?.hide();
        _crearForm?.reset?.();
        toast('Clase creada', 'success');
        await loadClases();
      } catch (err) {
        toast(err?.message || 'Error al crear clase', 'danger');
      } finally {
        btn.disabled = false;
      }
    }

    async function submitEdit(e) {
      e.preventDefault();
      const id = $id('aula-editar-clase-id')?.value;
      const btn = $id('aula-editar-submit');
      if (!id || !btn) return;
      btn.disabled = true;
      try {
        const payload = _editarForm?.getPayload?.();
        await global.AulaService.updateClase(_ctx, id, payload);
        bootstrap.Modal.getInstance($id('modalAulaEditarClase'))?.hide();
        toast('Clase actualizada', 'success');
        await loadClases();
      } catch (err) {
        toast(err?.message || 'Error al actualizar', 'danger');
      } finally {
        btn.disabled = false;
      }
    }

    async function toggleArchiveFromModal() {
      const id = $id('aula-editar-clase-id')?.value;
      const clase = _clases.find(item => item.id === id);
      if (!clase) return;
      await toggleArchive(id, Boolean(clase.archivada), true);
    }

    async function toggleArchive(id, archived, closeModal) {
      if (!confirm(archived ? 'Restaurar esta clase?' : 'Archivar esta clase?')) return;
      await global.AulaService.archivarClase(_ctx, id, !archived);
      if (closeModal) bootstrap.Modal.getInstance($id('modalAulaEditarClase'))?.hide();
      toast(archived ? 'Clase restaurada' : 'Clase archivada', 'success');
      await loadClases();
    }

    async function regenerateCode() {
      const id = $id('aula-editar-clase-id')?.value;
      if (!id || !confirm('Generar un nuevo codigo? El anterior quedara invalido.')) return;
      const nuevoCodigo = await global.AulaService.generateJoinCode(_ctx);
      await global.AulaService.updateClase(_ctx, id, { codigoAcceso: nuevoCodigo });
      $id('aula-editar-codigo-actual').textContent = nuevoCodigo;
      const clase = _clases.find(item => item.id === id);
      if (clase) clase.codigoAcceso = nuevoCodigo;
      toast('Codigo regenerado', 'success');
    }

    async function duplicateClase(id) {
      const clase = _clases.find(item => item.id === id);
      if (!clase || !confirm(`Crear una copia de "${clase.titulo}"?`)) return;
      await global.AulaService.createClase(_ctx, { ...payloadFrom(clase), titulo: `${clase.titulo || clase.materia || 'Clase'} (Copia)` });
      toast('Clase duplicada', 'success');
      await loadClases();
    }

    async function deleteFromModal() {
      const id = $id('aula-editar-clase-id')?.value;
      if (!id) return;
      await deleteClase(id, true);
    }

    async function deleteClase(id, closeModal) {
      const clase = _clases.find(item => item.id === id);
      if (!clase || !confirm(`Eliminar "${clase.titulo || clase.materia}"?\n\nSe borraran miembros, publicaciones, entregas y grupos relacionados.`)) return;
      await global.AulaService.deleteClase(_ctx, id);
      if (closeModal) bootstrap.Modal.getInstance($id('modalAulaEditarClase'))?.hide();
      toast('Clase eliminada', 'success');
      await loadClases();
    }

    return { init };
  })();

  global.AdminAula = AdminAula;
})(window);
