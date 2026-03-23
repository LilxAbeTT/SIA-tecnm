/* ============================================================
   AulaDeadlines — Widget de próximas entregas para el estudiante
   Muestra tareas de todas las clases inscritas, ordenadas por urgencia
   ============================================================ */
(function (global) {
  const AulaDeadlines = (function () {

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

    /**
     * Renderiza el widget de deadlines en el contenedor dado.
     * @param {object} ctx
     * @param {HTMLElement} containerEl - Contenedor donde inyectar el widget
     */
    async function render(ctx, containerEl) {
      if (!containerEl) return;
      containerEl.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4 mb-4">
          <div class="card-body p-4">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h6 class="fw-bold mb-0"><i class="bi bi-calendar-event me-2 text-primary"></i>Próximas Entregas</h6>
              <div class="spinner-border spinner-border-sm text-primary" id="aula-deadlines-spinner"></div>
            </div>
            <div id="aula-deadlines-list"></div>
          </div>
        </div>`;

      try {
        const items = await _loadDeadlines(ctx);
        _renderItems(items, containerEl);
      } catch (err) {
        console.error('[AulaDeadlines] error:', err);
        const list = containerEl.querySelector('#aula-deadlines-list');
        if (list) list.innerHTML = '<div class="text-muted small text-center py-2">No se pudo cargar entregas.</div>';
      } finally {
        containerEl.querySelector('#aula-deadlines-spinner')?.remove();
      }
    }

    /**
     * Carga todas las tareas de las clases del estudiante y su estado de entrega.
     * Cache de 5 minutos para no sobrecargar Firestore.
     * @param {object} ctx
     * @returns {Promise<Array>} items clasificados por urgencia
     */
    async function _loadDeadlines(ctx) {
      const uid = ctx.auth.currentUser.uid;
      const cacheKey = `deadlines_${uid}`;
      const cached = _cache[cacheKey];
      if (cached && Date.now() - cached.ts < 300000) return cached.data;

      // Obtener clases del estudiante
      const clases = await global.AulaService.getMisClases(ctx, uid, 20);
      if (!clases.length) {
        _cache[cacheKey] = { data: [], ts: Date.now() };
        return [];
      }

      const ahora = new Date();
      const todas = [];

      // Para cada clase (max 6 en paralelo), obtener tareas vía servicio
      const clasePromises = clases.map(async clase => {
        try {
          const [miGrupo, pubs] = await Promise.all([
            global.AulaService.getMiGrupo(ctx, clase.id, uid),
            // Traer más publicaciones para poder ordenar por fechaEntrega real en JS
            global.AulaService.getPublicaciones(ctx, clase.id, 'tarea', 30)
          ]);

          const tareaPromises = pubs.map(async pub => {
            if (pub.grupoId && pub.grupoId !== miGrupo?.id) return null;
            const fechaE = pub.fechaEntrega?.toDate ? pub.fechaEntrega.toDate()
              : (pub.fechaEntrega ? new Date(pub.fechaEntrega) : null);
            if (!fechaE) return null; // sin fecha, no mostrar

            let estado = 'pendiente';
            try {
              const entrega = await global.AulaService.getMiEntrega(ctx, pub.id, uid);
              if (entrega) {
                if (entrega.estado === 'calificado') estado = 'calificada';
                else if (entrega.estado === 'tarde') estado = 'tardia';
                else estado = 'entregada';
              }
            } catch (_) {}

            return {
              pubId:       pub.id,
              claseId:     clase.id,
              claseTitulo: clase.titulo,
              titulo:      pub.titulo,
              fechaE,
              estado,
              diffMs:      fechaE - ahora
            };
          });

          const tareas = await Promise.all(tareaPromises);
          todas.push(...tareas.filter(Boolean));
        } catch (err) {
          console.warn('[AulaDeadlines] skipped class:', clase.id, err?.code || err?.message || err);
        }
      });

      await Promise.all(clasePromises);

      // Ordenar: entregadas/calificadas al final, pendientes por fechaEntrega real (más urgentes primero)
      todas.sort((a, b) => {
        const aHecho = ['entregada', 'calificada', 'tardia'].includes(a.estado);
        const bHecho = ['entregada', 'calificada', 'tardia'].includes(b.estado);
        if (aHecho && !bHecho) return 1;
        if (!aHecho && bHecho) return -1;
        return a.fechaE - b.fechaE; // orden cronológico real (no por lote parcial)
      });

      const resultado = todas.slice(0, 10);
      _cache[cacheKey] = { data: resultado, ts: Date.now() };
      return resultado;
    }

    /**
     * Renderiza los items de deadline en el widget.
     * @param {Array} items
     * @param {HTMLElement} containerEl
     */
    function _renderItems(items, containerEl) {
      const list = containerEl.querySelector('#aula-deadlines-list');
      if (!list) return;

      if (!items.length) {
        list.innerHTML = '<div class="text-muted small text-center py-2"><i class="bi bi-check2-all me-1"></i>Sin entregas próximas. ¡Todo al día!</div>';
        return;
      }

      list.innerHTML = items.map(item => {
        const { clasico, icono, etiqueta } = _urgenciaConfig(item);
        // Deep-link directo a la tarea específica dentro de la clase
        const href = `/aula/clase/${esc(item.claseId)}/pub/${esc(item.pubId)}`;
        return `
          <div class="d-flex align-items-center gap-3 py-2 border-bottom deadline-item"
               role="button" style="cursor:pointer;"
               onclick="window.location.hash='${href}'"
               title="${esc(item.titulo)}">
            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                 style="width:34px;height:34px;background:${clasico}20;">
              <i class="bi ${icono}" style="color:${clasico};font-size:.85rem;"></i>
            </div>
            <div class="flex-grow-1 min-width-0">
              <div class="fw-semibold small text-truncate">${esc(item.titulo)}</div>
              <div class="small text-muted text-truncate">${esc(item.claseTitulo)}</div>
            </div>
            <span class="badge rounded-pill small flex-shrink-0" style="background:${clasico}18;color:${clasico};">
              ${etiqueta}
            </span>
          </div>`;
      }).join('') + `
        <div class="pt-2 text-end">
          <span class="small text-muted">${items.length} ${items.length === 1 ? 'entrega' : 'entregas'} próximas</span>
        </div>`;

      // Remover border del último item real
      list.querySelector('.deadline-item:last-of-type')?.classList.remove('border-bottom');
    }

    /**
     * Devuelve el color, icono y etiqueta según urgencia/estado.
     * @param {object} item
     * @returns {{ clasico: string, icono: string, etiqueta: string }}
     */
    function _urgenciaConfig(item) {
      const { estado, diffMs } = item;

      if (estado === 'calificada') {
        return { clasico: '#22c55e', icono: 'bi-check-circle-fill', etiqueta: 'Calificada ✓' };
      }
      if (estado === 'entregada') {
        return { clasico: '#6366f1', icono: 'bi-check-circle', etiqueta: 'Entregada ✓' };
      }
      if (estado === 'tardia') {
        return { clasico: '#f59e0b', icono: 'bi-exclamation-circle', etiqueta: 'Entregada tarde' };
      }
      if (diffMs < 0) {
        return { clasico: '#dc2626', icono: 'bi-exclamation-circle-fill', etiqueta: 'Vencida' };
      }
      if (diffMs < 86400000) { // menos de 24h
        return { clasico: '#ef4444', icono: 'bi-clock-fill', etiqueta: '¡Hoy!' };
      }
      if (diffMs < 172800000) { // menos de 48h
        const h = Math.floor(diffMs / 3600000);
        return { clasico: '#f97316', icono: 'bi-clock', etiqueta: `En ${h}h` };
      }
      const dias = Math.floor(diffMs / 86400000);
      if (dias <= 7) {
        return { clasico: '#22c55e', icono: 'bi-calendar-check', etiqueta: `En ${dias} días` };
      }
      const fecha = item.fechaE.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      return { clasico: '#6b7280', icono: 'bi-calendar', etiqueta: fecha };
    }

    // Cache interno simple
    const _cache = {};

    /**
     * Invalida el cache de deadlines para un usuario (o todos si no se pasa uid).
     * Llamar después de entregar o publicar una tarea para que el widget refresque.
     * @param {string} [uid]
     */
    function invalidate(uid) {
      if (uid) {
        delete _cache[`deadlines_${uid}`];
      } else {
        Object.keys(_cache).forEach(k => delete _cache[k]);
      }
    }

    return { render, invalidate };
  })();

  global.AulaDeadlines = AulaDeadlines;
})(window);
