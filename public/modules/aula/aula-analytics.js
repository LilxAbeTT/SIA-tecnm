/* ============================================================
   AulaAnalytics — Tab de Analíticas para el docente
   Reutiliza getTablaCalificaciones para calcular métricas
   localmente sin queries adicionales.
   ============================================================ */
(function (global) {
  const AulaAnalytics = (function () {

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
    function toast(msg, type) { if (global.SIA?.toast) global.SIA.toast(msg, type); else if (global.showToast) global.showToast(msg, type); }
    async function _exportAnalyticsPDF(claseId, metrics) {
      if (!window.jspdf?.jsPDF) {
        toast('Exportador no disponible', 'warning');
        return;
      }

      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Analiticas de Aula', 14, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Clase: ${claseId}`, 14, 26);
        doc.text(`Fecha de exportacion: ${fecha}`, 14, 32);
        doc.text(`Promedio del grupo: ${metrics.promGrupo != null ? metrics.promGrupo.toFixed(1) : '—'}`, 14, 40);
        doc.text(`Tasa de entrega: ${metrics.tasaEntrega}%`, 14, 46);
        doc.text(`Estudiantes en riesgo: ${metrics.enRiesgo.length}`, 14, 52);

        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: 60,
            head: [['Tarea', 'Entregas', 'Avance']],
            body: metrics.tasasPorTarea.map(({ tarea, entregas, aplicables, pct }) => [
              tarea.titulo || 'Tarea',
              `${entregas}/${aplicables}`,
              `${pct}%`
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246] }
          });

          doc.autoTable({
            startY: doc.lastAutoTable.finalY + 8,
            head: [['Rango', 'Estudiantes']],
            body: [
              ['90-100', metrics.dist.A],
              ['80-89', metrics.dist.B],
              ['70-79', metrics.dist.C],
              ['60-69', metrics.dist.D],
              ['<60', metrics.dist.F]
            ],
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [34, 197, 94] }
          });

          if (metrics.enRiesgo.length) {
            doc.autoTable({
              startY: doc.lastAutoTable.finalY + 8,
              head: [['Estudiante', 'Entregadas', 'Promedio']],
              body: metrics.enRiesgo.map(({ est, entregadas, totalAplicables, promedio }) => [
                est.userName || est.userEmail || 'Estudiante',
                `${entregadas}/${totalAplicables}`,
                promedio != null ? promedio.toFixed(1) : '—'
              ]),
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [239, 68, 68] }
            });
          }
        }

        doc.save(`Analiticas_${claseId}.pdf`);
        toast('PDF generado', 'success');
      } catch (err) {
        console.error('[AulaAnalytics] PDF error:', err);
        toast('Error al generar PDF', 'danger');
      }
    }

    /**
     * Renderiza el panel de analíticas en el contenedor del tab.
     * @param {object} ctx - Contexto SIA
     * @param {string} claseId
     */
    async function render(ctx, claseId) {
      const container = document.getElementById('aula-analytics-container');
      if (!container) return;

      container.dataset.claseLoaded = claseId;

      container.innerHTML = '<div class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

      try {
        global.AulaService.invalidateCache('tabla_cal_');
        const { tareas, estudiantes, entregasMap } = await global.AulaService.getTablaCalificaciones(ctx, claseId);

        if (!tareas.length || !estudiantes.length) {
          container.innerHTML = `
            <div class="text-center py-5 text-muted">
              <i class="bi bi-bar-chart-line fs-1 d-block mb-3 opacity-30"></i>
              <p>No hay suficientes datos para generar analíticas.</p>
              <small>Se necesitan tareas y estudiantes con entregas.</small>
            </div>`;
          return;
        }

        // ── Calcular métricas ──
        const totalTareas = tareas.length;
        const totalEst    = estudiantes.length;

        const filas = estudiantes.map(est => {
          const cals = tareas.map(t => entregasMap[`${est.userId}_${t.id}`] || null);
          const aplicables = cals.filter(e => !e?.notApplicable);
          const calNums   = aplicables.filter(e => e?.calificacion != null).map(e => e.calificacion);
          const entregadas = aplicables.filter(e => e != null).length;
          const totalAplicables = aplicables.length;
          const promedio  = calNums.length ? (calNums.reduce((s, c) => s + c, 0) / calNums.length) : null;
          const enRiesgo  = totalAplicables > 0
            ? (promedio != null ? (promedio < 70) : (entregadas < totalAplicables * 0.5))
            : false;
          return { est, cals, aplicables, calNums, entregadas, totalAplicables, promedio, enRiesgo };
        });

        // Tasa de entrega global
        const totalEntregas  = filas.reduce((s, f) => s + f.entregadas, 0);
        const maxEntregas    = filas.reduce((s, f) => s + f.totalAplicables, 0);
        const tasaEntrega    = maxEntregas > 0 ? Math.round((totalEntregas / maxEntregas) * 100) : 0;

        // Promedio general del grupo
        const todasCals  = filas.flatMap(f => f.calNums);
        const promGrupo  = todasCals.length ? Math.round(todasCals.reduce((s, c) => s + c, 0) / todasCals.length) : null;

        // Estudiantes en riesgo
        const enRiesgo = filas.filter(f => f.enRiesgo);

        // Tasa de entrega por tarea
        const tasasPorTarea = tareas.map(t => {
          const aplicables = estudiantes.filter(est => !entregasMap[`${est.userId}_${t.id}`]?.notApplicable).length;
          const entregas = estudiantes.filter(est => {
            const entrega = entregasMap[`${est.userId}_${t.id}`];
            return entrega != null && !entrega?.notApplicable;
          }).length;
          return { tarea: t, entregas, aplicables, pct: aplicables > 0 ? Math.round((entregas / aplicables) * 100) : 0 };
        });

        // Distribución de promedios
        const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        filas.forEach(f => {
          if (f.promedio == null) return;
          if (f.promedio >= 90) dist.A++;
          else if (f.promedio >= 80) dist.B++;
          else if (f.promedio >= 70) dist.C++;
          else if (f.promedio >= 60) dist.D++;
          else dist.F++;
        });
        const maxDist = Math.max(...Object.values(dist), 1);
        const analyticsMetrics = { promGrupo, tasaEntrega, enRiesgo, tasasPorTarea, dist };

        // ── Render ──
        container.innerHTML = `
          <!-- STATS GENERALES -->
          <div class="row g-3 mb-4">
            ${_statCard(promGrupo != null ? promGrupo.toFixed(1) : '—', 'Promedio grupo', 'bi-graph-up', '#3b82f6', promGrupo != null ? (promGrupo >= 70 ? '#22c55e' : '#ef4444') : '#94a3b8')}
            ${_statCard(tasaEntrega + '%', 'Tasa de entrega', 'bi-send-check', '#8b5cf6', tasaEntrega >= 70 ? '#22c55e' : '#f97316')}
            ${_statCard(enRiesgo.length, 'Estudiantes en riesgo', 'bi-exclamation-triangle', '#ef4444', enRiesgo.length > 0 ? '#ef4444' : '#22c55e')}
            ${_statCard(totalEst, 'Total estudiantes', 'bi-people', '#06b6d4', '#06b6d4')}
          </div>

          <!-- TASA DE ENTREGA POR TAREA -->
          <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
            <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill me-2 text-primary"></i>Tasa de entrega por tarea</h6>
            <div class="vstack gap-2">
              ${tasasPorTarea.map(({ tarea, entregas, aplicables, pct }) => `
                <div>
                  <div class="d-flex justify-content-between small mb-1">
                    <span class="text-truncate" style="max-width:60%;" title="${esc(tarea.titulo)}">${esc(tarea.titulo?.substring(0, 30) || 'Tarea')}${tarea.titulo?.length > 30 ? '…' : ''}</span>
                    <span class="fw-semibold">${pct}% <span class="text-muted fw-normal">(${entregas}/${aplicables})</span></span>
                  </div>
                  <div class="rounded-pill overflow-hidden" style="height:10px;background:rgba(59,130,246,0.12);">
                    <div class="rounded-pill h-100" style="width:${pct}%;background:linear-gradient(90deg,#3b82f6,#6366f1);transition:width .6s ease;"></div>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          <!-- DISTRIBUCIÓN DE CALIFICACIONES -->
          <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
            <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill me-2 text-success"></i>Distribución de calificaciones</h6>
            <div class="vstack gap-2">
              ${_distBar('Sobresaliente', '90–100', dist.A, maxDist, '#22c55e')}
              ${_distBar('Bien',          '80–89',  dist.B, maxDist, '#3b82f6')}
              ${_distBar('Regular',       '70–79',  dist.C, maxDist, '#f59e0b')}
              ${_distBar('Bajo',          '60–69',  dist.D, maxDist, '#f97316')}
              ${_distBar('Reprobado',     '<60',    dist.F, maxDist, '#ef4444')}
            </div>
          </div>

          <!-- ESTUDIANTES EN RIESGO -->
          ${enRiesgo.length ? `
          <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
            <h6 class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-2 text-danger"></i>Estudiantes en riesgo</h6>
            <p class="small text-muted mb-3">Promedio menor a 70 o menos del 50% de tareas entregadas.</p>
            <div class="table-responsive">
              <table class="table table-sm align-middle small mb-0">
                <thead>
                  <tr>
                    <th class="fw-semibold">Estudiante</th>
                    <th class="fw-semibold text-center">Entregadas</th>
                    <th class="fw-semibold text-center">Promedio</th>
                    <th class="fw-semibold">Situación</th>
                  </tr>
                </thead>
                <tbody>
                  ${enRiesgo.map(({ est, entregadas, totalAplicables, promedio }) => `
                    <tr>
                      <td>
                        <div class="fw-semibold">${esc(est.userName)}</div>
                        <div class="text-muted" style="font-size:.72rem;">${esc(est.matricula || est.userEmail)}</div>
                      </td>
                      <td class="text-center">
                        <span class="badge ${entregadas === 0 ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning'} rounded-pill">
                          ${entregadas}/${totalAplicables}
                        </span>
                      </td>
                      <td class="text-center">
                        ${promedio != null ? `<span class="fw-bold text-danger">${promedio.toFixed(1)}</span>` : '<span class="text-muted">—</span>'}
                      </td>
                      <td class="small text-muted">
                        ${promedio != null && promedio < 70 ? 'Promedio bajo' : ''}
                        ${entregadas < totalAplicables * 0.5 ? (promedio != null && promedio < 70 ? ' · ' : '') + 'Poca participación' : ''}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>` : `
          <div class="alert border-0 rounded-4 mb-4" style="background:linear-gradient(135deg,#22c55e10,#16a34a08);">
            <i class="bi bi-check-circle-fill text-success me-2"></i>
            <span class="small fw-semibold text-success">¡Sin estudiantes en riesgo!</span>
            <span class="small text-muted ms-1">Todos tienen buen desempeño.</span>
          </div>`}

          <!-- Botón exportar reporte -->
          <div class="text-end mb-2">
            <button class="btn btn-outline-primary rounded-pill px-4" id="aula-analytics-exportar">
              <i class="bi bi-file-earmark-pdf me-1"></i>Exportar reporte PDF
            </button>
          </div>`;

        // Bind exportar
        document.getElementById('aula-analytics-exportar')?.addEventListener('click', () => {
          _exportAnalyticsPDF(claseId, analyticsMetrics);
        });

      } catch (err) {
        console.error('[AulaAnalytics] render error:', err);
        container.innerHTML = '<div class="text-danger small text-center py-4">Error al cargar analíticas.</div>';
        container.dataset.claseLoaded = ''; // permitir reintentar
      }
    }

    /**
     * Genera una tarjeta de stat
     * @param {string|number} valor
     * @param {string} label
     * @param {string} icon - clase bootstrap-icons
     * @param {string} iconColor
     * @param {string} accentColor
     */
    function _statCard(valor, label, icon, iconColor, accentColor) {
      return `
        <div class="col-6 col-md-3">
          <div class="card border-0 shadow-sm rounded-4 p-3 text-center h-100">
            <div class="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2"
                 style="width:44px;height:44px;background:${iconColor}15;">
              <i class="bi ${icon}" style="color:${iconColor};font-size:1.2rem;"></i>
            </div>
            <div class="fw-bold fs-4" style="color:${accentColor};">${esc(String(valor))}</div>
            <div class="small text-muted">${esc(label)}</div>
          </div>
        </div>`;
    }

    /**
     * Genera una barra de distribución de calificaciones
     * @param {string} label
     * @param {string} rango
     * @param {number} count
     * @param {number} maxCount
     * @param {string} color
     */
    function _distBar(label, rango, count, maxCount, color) {
      const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
      return `
        <div class="d-flex align-items-center gap-3">
          <div style="min-width:110px;" class="small">
            <span class="fw-semibold">${esc(label)}</span>
            <span class="text-muted ms-1">(${esc(rango)})</span>
          </div>
          <div class="flex-grow-1 rounded-pill overflow-hidden" style="height:12px;background:${color}20;">
            <div class="rounded-pill h-100" style="width:${pct}%;background:${color};transition:width .6s ease;"></div>
          </div>
          <div class="small fw-semibold" style="min-width:24px;color:${color};">${count}</div>
        </div>`;
    }

    return { render };
  })();

  global.AulaAnalytics = AulaAnalytics;
})(window);
