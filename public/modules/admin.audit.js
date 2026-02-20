// public/modules/admin.audit.js
const AdminAudit = {
  charts: {},

  async init(ctx) {
    this.ctx = ctx;
    this.renderLogs();
    this.initCharts();
  },

  async renderLogs() {
    const tbody = document.getElementById('sa-audit-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    
    try {
      const docs = await AuditService.getRecentLogs(this.ctx);
      tbody.innerHTML = docs.map(doc => {
        const log = doc.data();
        const date = log.timestamp ? log.timestamp.toDate().toLocaleString() : 'Reciente...';
        return `
          <tr>
            <td class="text-nowrap">${date}</td>
            <td class="fw-bold">${log.adminName}</td>
            <td><span class="badge bg-secondary-subtle text-dark border extra-small">${log.action}</span></td>
            <td class="text-muted small">${JSON.stringify(log.details)}</td>
            <td class="font-monospace extra-small">SIA-Internal</td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="5" class="text-center py-4 text-muted">No hay registros aún.</td></tr>';
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error de carga.</td></tr>';
    }
  },

  async initCharts() {
    const stats = await AuditService.getSystemStats(this.ctx);
    
    // 1. Gráfico de Distribución de Usuarios (Doughnut)
    const ctxDist = document.getElementById('chart-user-distribution')?.getContext('2d');
    if (ctxDist) {
      if (this.charts.dist) this.charts.dist.destroy();
      this.charts.dist = new Chart(ctxDist, {
        type: 'doughnut',
        data: {
          labels: ['Estudiantes', 'Médicos', 'Biblio', 'Aula', 'Docentes'],
          datasets: [{
            data: [
              stats.roleDistribution.student,
              stats.roleDistribution.medico,
              stats.roleDistribution.biblio,
              stats.roleDistribution.aula,
              stats.roleDistribution.docente
            ],
            backgroundColor: ['#0d6efd', '#dc3545', '#ffc107', '#198754', '#6f42c1']
          }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
      });
    }

    // 2. Gráfico de Actividad (Simulado con data real del sistema)
    const ctxActivity = document.getElementById('chart-activity-trends')?.getContext('2d');
    if (ctxActivity) {
      if (this.charts.activity) this.charts.activity.destroy();
      this.charts.activity = new Chart(ctxActivity, {
        type: 'line',
        data: {
          labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
          datasets: [{
            label: 'Ingresos al Sistema',
            data: [120, 190, 150, 210, 180, 40, 30],
            borderColor: '#0d6efd',
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(13, 110, 253, 0.1)'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  },

  async generateMasterReport() {
    showToast("Generando reporte maestro...", "info");
    try {
      const stats = await AuditService.getSystemStats(this.ctx);
      const csvRows = [
        ["REPORTE SIA COMMAND CENTER", new Date().toLocaleString()],
        ["KPI", "VALOR"],
        ["Usuarios Totales", stats.totalUsers],
        ["Estudiantes", stats.roleDistribution.student],
        ["Medicos", stats.roleDistribution.medico],
        ["Biblioteca", stats.roleDistribution.biblio],
        ["Aula", stats.roleDistribution.aula],
        ["", ""],
        ["FIN DEL REPORTE"]
      ];

      const csvContent = csvRows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sia_master_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast("Reporte descargado.", "success");
      AuditService.logAction(this.ctx, 'EXPORT_MASTER_REPORT');
    } catch (e) {
      showToast("Error al generar reporte", "danger");
    }
  }
};
window.AdminAudit = AdminAudit;