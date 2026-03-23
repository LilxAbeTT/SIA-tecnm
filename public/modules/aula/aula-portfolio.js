/* ============================================================
   AulaPortfolio — Portfolio del estudiante
   Estadisticas · Historial de entregas · Exportar PDF
   ============================================================ */
(function (global) {
  const AulaPortfolio = (function () {

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
    function toast(msg, type) { if (global.SIA?.toast) global.SIA.toast(msg, type); else if (global.showToast) global.showToast(msg, type); }

    // ══════════════════════════════════════════════════════════
    //  RENDER — Portfolio de una clase
    // ══════════════════════════════════════════════════════════

    async function render(ctx, claseId, uid) {
      const container = document.getElementById('aula-portfolio-container');
      if (!container) return;

      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

      try {
        AulaService.invalidateCache('entregas_est_');
        const { entregas, stats } = await AulaService.getPortfolioData(ctx, claseId, uid);
        const clase = await AulaService.getClase(ctx, claseId);

        container.innerHTML = `
          <!-- Stats Cards -->
          <div class="row g-3 mb-4">
            <div class="col-6 col-md-3">
              <div class="card border-0 bg-primary-subtle rounded-3 text-center p-3">
                <div class="fs-3 fw-bold text-primary">${stats.totalEntregas}</div>
                <div class="small text-muted">Entregas</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card border-0 bg-success-subtle rounded-3 text-center p-3">
                <div class="fs-3 fw-bold text-success">${stats.calificadas}</div>
                <div class="small text-muted">Calificadas</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card border-0 bg-info-subtle rounded-3 text-center p-3">
                <div class="fs-3 fw-bold text-info">${stats.promedio}</div>
                <div class="small text-muted">Promedio</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card border-0 bg-warning-subtle rounded-3 text-center p-3">
                <div class="fs-3 fw-bold text-warning">${stats.pctATiempo}%</div>
                <div class="small text-muted">A tiempo</div>
              </div>
            </div>
          </div>

          <!-- Export button -->
          <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3" id="aula-portfolio-export">
              <i class="bi bi-file-earmark-pdf me-1"></i>Exportar PDF
            </button>
          </div>

          <!-- Entregas list -->
          ${!entregas.length ? '<div class="text-center py-4 text-muted"><i class="bi bi-folder2 fs-2 d-block mb-2 opacity-50"></i>No hay entregas registradas.</div>' : `
          <div class="vstack gap-2" id="aula-portfolio-list">
            ${entregas.map(e => _renderEntregaItem(e)).join('')}
          </div>`}
        `;

        // Bind export
        document.getElementById('aula-portfolio-export')?.addEventListener('click', () => {
          _exportPDF(ctx, clase, entregas, stats);
        });

      } catch (err) {
        console.error('[AulaPortfolio] Render error:', err);
        container.innerHTML = '<div class="text-danger small text-center py-3">Error al cargar portfolio.</div>';
      }
    }

    function _renderEntregaItem(e) {
      const fecha = e.entregadoAt?.toDate?.()?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) || '';
      const estadoMap = {
        entregado: { badge: 'bg-primary-subtle text-primary', text: 'Entregado' },
        tarde: { badge: 'bg-warning-subtle text-warning', text: 'Tarde' },
        calificado: { badge: 'bg-success-subtle text-success', text: `${e.calificacion} pts` }
      };
      const estado = estadoMap[e.estado] || estadoMap.entregado;

      return `
        <div class="card border rounded-3 p-3">
          <div class="d-flex align-items-center gap-3">
            <div class="bg-primary-subtle rounded-3 p-2 text-primary"><i class="bi bi-file-earmark-check fs-5"></i></div>
            <div class="flex-grow-1">
              <div class="fw-semibold small">${esc(e.publicacionTitulo || 'Tarea sin título')}</div>
              <div class="d-flex gap-2 small text-muted mt-1">
                <span><i class="bi bi-calendar me-1"></i>${fecha}</span>
                ${(e.archivos || []).length ? `<span><i class="bi bi-paperclip me-1"></i>${e.archivos.length} archivos</span>` : ''}
                ${e.isGroupDelivery ? `<span><i class="bi bi-people-fill me-1"></i>${esc(e.grupoNombre || 'Entrega grupal')}</span>` : ''}
              </div>
            </div>
            <span class="badge ${estado.badge} rounded-pill">${estado.text}</span>
          </div>
          ${e.retroalimentacion ? `<div class="mt-2 small text-muted bg-light rounded-3 p-2"><i class="bi bi-chat-left-text me-1"></i>${esc(e.retroalimentacion)}</div>` : ''}
        </div>`;
    }

    // ══════════════════════════════════════════════════════════
    //  EXPORTAR PDF
    // ══════════════════════════════════════════════════════════

    async function _exportPDF(ctx, clase, entregas, stats) {
      try {
        if (!window.jspdf?.jsPDF) return toast('Exportador no disponible', 'warning');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        const profile = ctx.profile || {};
        const nombre = profile.displayName || ctx.auth.currentUser.displayName || 'Estudiante';
        const fechaGen = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        const rows = entregas.map((e, i) => {
          const fecha = e.entregadoAt?.toDate?.()?.toLocaleDateString('es-MX') || '';
          return [
            i + 1,
            (e.publicacionTitulo || 'Tarea sin título'),
            fecha,
            e.estado === 'calificado' ? `${e.calificacion} pts` : e.estado,
            e.retroalimentacion?.substring(0, 80) || ''
          ];
        });

        const config = {
          title: `Portfolio — ${clase?.titulo || 'Clase'}`,
          subtitle: `${nombre} | Promedio: ${stats.promedio} pts | Entregas: ${stats.totalEntregas}`,
          filename: `portfolio_${(clase?.titulo || 'clase').replace(/\s+/g, '_')}.pdf`
        };
        const data = {
          headers: ['#', 'Tarea', 'Fecha', 'Calificación', 'Retroalimentación'],
          rows
        };

        const filename = `portfolio_${(clase?.titulo || 'clase').replace(/\s+/g, '_')}.pdf`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`Portfolio - ${clase?.titulo || 'Clase'}`, 14, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(nombre, 14, 26);
        doc.text(`Fecha de exportacion: ${fechaGen}`, 14, 32);
        doc.text(`Promedio: ${stats.promedio} pts`, 14, 38);
        doc.text(`Entregas: ${stats.totalEntregas} | Calificadas: ${stats.calificadas} | A tiempo: ${stats.pctATiempo}%`, 14, 44);

        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: 52,
            head: [['#', 'Tarea', 'Fecha', 'Calificacion', 'Retroalimentacion']],
            body: rows,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 62 },
              2: { cellWidth: 24, halign: 'center' },
              3: { cellWidth: 24, halign: 'center' },
              4: { cellWidth: 72 }
            }
          });
        } else {
          let y = 54;
          rows.forEach(row => {
            doc.text(`${row[0]}. ${row[1]} | ${row[2]} | ${row[3]}`, 14, y);
            y += 7;
          });
        }

        doc.save(filename);
        toast('PDF generado', 'success');
      } catch (err) {
        console.error('[AulaPortfolio] PDF error:', err);
        toast('Error al generar PDF', 'danger');
      }
    }

    return { render };
  })();

  global.AulaPortfolio = AulaPortfolio;
})(window);
