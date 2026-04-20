/**
 * Reportes - Módulo Servicios Médicos
 * Sub-módulo que renderiza dashboards específicos para el área Médica/Psicológica.
 * Tabs: Consultas, Diagnósticos, Perfil Clínico
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-medico.js cargado, window.Reportes keys:', Object.keys(window.Reportes));

window.Reportes.Medico = (function () {
    'use strict';

    const H = () => Reportes.Charts;
    const S = () => Reportes.getState();
    const R = () => Reportes.getChartRegistry();

    // ============================
    // API pública
    // ============================

    /**
     * Devuelve las pestañas disponibles para Servicios Médicos
     * @returns {Array<{id:string, label:string, icon:string}>}
     */
    function getTabs() {
        return [
            { id: 'consultas', label: 'Consultas', icon: 'bi-clipboard2-pulse' },
            { id: 'diagnosticos', label: 'Diagnósticos', icon: 'bi-activity' },
            { id: 'perfil', label: 'Perfil Clínico', icon: 'bi-heart-pulse' }
        ];
    }

    /**
     * Renderiza el contenido según la pestaña activa
     * @param {HTMLElement} container
     */
    function render(container) {
        const state = S();
        const tab = state.currentTab || 'consultas';

        switch (tab) {
            case 'diagnosticos': renderDiagnosticos(container, state.filteredData); break;
            case 'perfil': renderPerfil(container, state.filteredData); break;
            default: renderConsultas(container, state.filteredData); break;
        }
    }

    // ============================
    // Categorización de diagnósticos
    // ============================

    /**
     * Categoriza diagnósticos similares en grupos legibles
     * @param {string} diagnostico
     * @returns {string}
     */
    function categorizeSimilar(diagnostico) {
        if (!diagnostico) return 'General';
        const lower = diagnostico.toLowerCase();

        // Psicológicos
        if (lower.includes('estrés') || lower.includes('estres') || lower.includes('ansiedad') || lower.includes('urgencia')) return 'Ansiedad y Estrés';
        if (lower.includes('depresión') || lower.includes('depresion') || lower.includes('trist') || lower.includes('suicidio') || lower.includes('animo')) return 'Depresión y Estado de Ánimo';
        if (lower.includes('pareja') || lower.includes('ruptura') || lower.includes('novio') || lower.includes('relacion')) return 'Problemas de Pareja';
        if (lower.includes('familia') || lower.includes('padres') || lower.includes('duelo') || lower.includes('muerte')) return 'Problemas Familiares / Duelo';
        if (lower.includes('academico') || lower.includes('escuela') || lower.includes('calificacion') || lower.includes('reprob')) return 'Estrés Académico';
        if (lower.includes('autoestima') || lower.includes('inseguridad') || lower.includes('identidad')) return 'Autoestima / Personalidad';
        if (lower.includes('tdah') || lower.includes('atencion') || lower.includes('aprendizaje')) return 'Aprendizaje / TDAH';
        if (lower.includes('psicoterapia') || lower.includes('terapia')) return 'Atención Terapéutica General';

        // Médicos
        if (lower.includes('grip') || lower.includes('resfriad') || lower.includes('tos') || lower.includes('faring') || lower.includes('garganta')) return 'Infección Respiratoria / Gripe';
        if (lower.includes('estomag') || lower.includes('gastr') || lower.includes('colitis') || lower.includes('diarrea') || lower.includes('vomito') || lower.includes('nausea')) return 'Gastrointestinal';
        if (lower.includes('cabeza') || lower.includes('cefalea') || lower.includes('migraña')) return 'Cefalea / Migraña';
        if (lower.includes('golpe') || lower.includes('trauma') || lower.includes('contusion') || lower.includes('esguince') || lower.includes('luxacion') || lower.includes('caida') || lower.includes('herida') || lower.includes('corte')) return 'Traumatismos y Heridas';
        if (lower.includes('dolor') || lower.includes('mialgia') || lower.includes('espalda') || lower.includes('muscu') || lower.includes('articul')) return 'Dolor Muscular / Articular';
        if (lower.includes('presion') || lower.includes('hiperten') || lower.includes('hipoten') || lower.includes('mareo') || lower.includes('desmayo') || lower.includes('lipotimia')) return 'Alteraciones Presión / Desmayos';
        if (lower.includes('alergi') || lower.includes('urticaria') || lower.includes('dermatitis') || lower.includes('piel')) return 'Alergias y Dermatología';
        if (lower.includes('ojo') || lower.includes('conjuntivi') || lower.includes('vista')) return 'Problemas Oculares';
        if (lower.includes('oido') || lower.includes('otitis')) return 'Problemas Óticos';
        if (lower.includes('menstrua') || lower.includes('colico') || lower.includes('embarazo')) return 'Ginecología (Cólicos, etc.)';
        if (lower.includes('diabet') || lower.includes('azucar') || lower.includes('glucosa')) return 'Endocrino / Glucosa';
        if (lower.includes('certificado') || lower.includes('justificante') || lower.includes('receta')) return 'Trámites Administrativos / Recetas';

        return diagnostico.charAt(0).toUpperCase() + diagnostico.slice(1);
    }

    // ============================
    // Utilidades internas
    // ============================

    /** Agrupa registros por día (clave ISO) */
    function groupByDay(data) {
        const map = {};
        data.forEach(d => {
            const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
            if (isNaN(date)) return;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            map[key] = (map[key] || 0) + 1;
        });
        return map;
    }

    /** Agrupa registros por hora (0-23) */
    function groupByHour(data) {
        const hours = new Array(24).fill(0);
        data.forEach(d => {
            const h = parseInt(d.hora, 10);
            if (!isNaN(h) && h >= 0 && h < 24) hours[h]++;
        });
        return hours;
    }

    /** Formatea fecha para tabla */
    function fmtDate(d) {
        const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
        return isNaN(date) ? 'N/D' : date.toLocaleDateString('es-MX');
    }

    function isClosedMedicalRecord(record) {
        const status = String(record?.statusCode || record?.status || '').toLowerCase();
        return ['finalizada', 'finalizado', 'completada', 'cerrada'].includes(status);
    }

    // ============================
    // Pestaña: Consultas
    // ============================

    /**
     * Renderiza el dashboard de consultas médicas y psicológicas
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderConsultas(container, data) {
        const charts = H();
        const _charts = R();

        const total = data.length;
        const medicas = data.filter(d => d.subarea === 'Medicina General');
        const psico = data.filter(d => d.subarea === 'Psicología');

        // Pacientes únicos
        const uidSet = new Set();
        data.forEach(d => {
            const uid = d._uid || d.matricula;
            if (uid && uid !== 'N/A') uidSet.add(uid);
        });
        const pacientesUnicos = uidSet.size;

        // Datos por día para series duales
        const dayMapMed = groupByDay(medicas);
        const dayMapPsi = groupByDay(psico);
        const allDaysSet = new Set([...Object.keys(dayMapMed), ...Object.keys(dayMapPsi)]);
        const allDays = [...allDaysSet].sort();

        // Distribución por hora
        const hours = groupByHour(data);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Total Consultas',
            value: charts.formatNumber(total),
            icon: 'bi-clipboard2-pulse',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Consultas Médicas',
            value: charts.formatNumber(medicas.length),
            icon: 'bi-heart-pulse',
            color: 'danger'
        })}
                    ${charts.renderKPICard({
            title: 'Consultas Psicológicas',
            value: charts.formatNumber(psico.length),
            icon: 'bi-chat-heart',
            color: 'info'
        })}
                    ${charts.renderKPICard({
            title: 'Pacientes Únicos',
            value: charts.formatNumber(pacientesUnicos),
            icon: 'bi-people',
            color: 'success'
        })}
                </div>

                <!-- Gráfico principal: Consultas por día (dual line) -->
                <div class="row g-4">
                    <div class="col-12">
                        ${charts.renderChartCard('Consultas por Día', 'medico-consult-line')}
                    </div>
                </div>

                <!-- Gráficos secundarios -->
                <div class="row g-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Proporción Médicas vs Psicológicas', 'medico-consult-pie')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Consultas por Hora del Día', 'medico-consult-hour-bar')}
                    </div>
                </div>

            </div>
        `;

        setTimeout(() => {
            // Línea dual
            const dayLabels = allDays.map(d =>
                new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
            );
            _charts['medico-consult-line'] = charts.createLineChart('medico-consult-line', {
                labels: dayLabels,
                datasets: [
                    {
                        label: 'Médicas',
                        data: allDays.map(d => dayMapMed[d] || 0),
                        borderColor: charts.COLORS.danger,
                        backgroundColor: charts.COLORS.danger + '22',
                        fill: true, tension: 0.4
                    },
                    {
                        label: 'Psicológicas',
                        data: allDays.map(d => dayMapPsi[d] || 0),
                        borderColor: charts.COLORS.info,
                        backgroundColor: charts.COLORS.info + '22',
                        fill: true, tension: 0.4
                    }
                ]
            });

            // Pie proporción
            _charts['medico-consult-pie'] = charts.createDoughnutChart('medico-consult-pie', {
                labels: ['Médicas', 'Psicológicas'],
                data: [medicas.length, psico.length],
                colors: [charts.COLORS.danger, charts.COLORS.info]
            });

            // Bar horas
            const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
            _charts['medico-consult-hour-bar'] = charts.createBarChart('medico-consult-hour-bar', {
                labels: hourLabels,
                datasets: [{
                    label: 'Consultas',
                    data: hours,
                    backgroundColor: charts.COLORS.primary
                }]
            });
        }, 50);
    }

    // ============================
    // Pestaña: Diagnósticos
    // ============================

    /**
     * Renderiza las listas de diagnósticos más frecuentes
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderDiagnosticos(container, data) {
        const charts = H();
        const _charts = R();
        const closedData = (Array.isArray(data) ? data : []).filter(isClosedMedicalRecord);

        // Separar y categorizar
        const medicosMap = {};
        const psicoMap = {};

        closedData.forEach(d => {
            const desc = d.diagnostico || d.detalle || '';
            if (!desc || desc.toLowerCase() === 'consulta general') return;
            const diag = categorizeSimilar(desc);

            if (d.tipo === 'Consulta Psicológica' || d.subarea === 'Psicología') {
                psicoMap[diag] = (psicoMap[diag] || 0) + 1;
            } else {
                medicosMap[diag] = (medicosMap[diag] || 0) + 1;
            }
        });

        const topMedicos = Object.entries(medicosMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topPsico = Object.entries(psicoMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        const totalMed = topMedicos.reduce((s, [, c]) => s + c, 0);
        const totalPsi = topPsico.reduce((s, [, c]) => s + c, 0);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- Médicos -->
                <div>
                    <h5 class="fw-bold mb-3 ps-2 border-start border-4 border-danger">
                        <i class="bi bi-heart-pulse me-2"></i>Motivos Médicos Más Frecuentes
                    </h5>
                    <div class="row g-4">
                        <div class="col-lg-7">
                            ${charts.renderChartCard('Top 10 Diagnósticos Médicos', 'medico-diag-med-bar')}
                        </div>
                        <div class="col-lg-5">
                            <div class="card border-0 shadow-sm rounded-4 h-100">
                                <div class="card-body">
                                    <h6 class="fw-bold mb-3">Ranking</h6>
                                    <div class="list-group list-group-flush">
                                        ${topMedicos.map(([name, count], i) => renderRankedItem(i + 1, name, count, totalMed, 'danger', 'meddiag')).join('')}
                                        ${topMedicos.length === 0 ? '<p class="text-muted small">Sin datos disponibles</p>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Psicológicos -->
                <div>
                    <h5 class="fw-bold mb-3 ps-2 border-start border-4 border-info">
                        <i class="bi bi-chat-heart me-2"></i>Motivos Psicológicos Más Frecuentes
                    </h5>
                    <div class="row g-4">
                        <div class="col-lg-7">
                            ${charts.renderChartCard('Top 10 Diagnósticos Psicológicos', 'medico-diag-psi-bar')}
                        </div>
                        <div class="col-lg-5">
                            <div class="card border-0 shadow-sm rounded-4 h-100">
                                <div class="card-body">
                                    <h6 class="fw-bold mb-3">Ranking</h6>
                                    <div class="list-group list-group-flush">
                                        ${topPsico.map(([name, count], i) => renderRankedItem(i + 1, name, count, totalPsi, 'info', 'psicodiag')).join('')}
                                        ${topPsico.length === 0 ? '<p class="text-muted small">Sin datos disponibles</p>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            // Bar médicos (horizontal)
            if (topMedicos.length > 0) {
                _charts['medico-diag-med-bar'] = charts.createBarChart('medico-diag-med-bar', {
                    labels: topMedicos.map(([n]) => n.length > 35 ? n.substring(0, 32) + '...' : n),
                    datasets: [{
                        label: 'Casos',
                        data: topMedicos.map(([, c]) => c),
                        backgroundColor: charts.COLORS.danger
                    }]
                }, { horizontal: true });
            }

            // Bar psicológicos (horizontal)
            if (topPsico.length > 0) {
                _charts['medico-diag-psi-bar'] = charts.createBarChart('medico-diag-psi-bar', {
                    labels: topPsico.map(([n]) => n.length > 35 ? n.substring(0, 32) + '...' : n),
                    datasets: [{
                        label: 'Casos',
                        data: topPsico.map(([, c]) => c),
                        backgroundColor: charts.COLORS.info
                    }]
                }, { horizontal: true });
            }
        }, 50);
    }

    /**
     * Renderiza un elemento de ranking
     * @param {number} pos - posición
     * @param {string} name - nombre del diagnóstico
     * @param {number} count - cantidad
     * @param {number} total - total para porcentaje
     * @param {string} color - clase de color Bootstrap
     * @returns {string} HTML
     */
    function _escapeAttr(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderRankedItem(pos, name, count, total, color, detailType = '') {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        const interactiveAttrs = detailType
            ? ` role="button" tabindex="0" style="cursor:pointer;" data-diagnostico="${_escapeAttr(name)}" data-detail-type="${_escapeAttr(detailType)}" onclick="Reportes.openDiagnosticoDetail(this.dataset.diagnostico, this.dataset.detailType)" onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();Reportes.openDiagnosticoDetail(this.dataset.diagnostico, this.dataset.detailType);}"`
            : '';
        return `
            <div class="list-group-item border-0 px-0 py-2 d-flex align-items-center gap-3"${interactiveAttrs}>
                <span class="badge bg-${color} bg-opacity-10 text-${color} rounded-circle d-flex align-items-center justify-content-center"
                      style="width: 28px; height: 28px; font-size: 0.75rem;">${pos}</span>
                <div class="flex-grow-1">
                    <div class="small fw-semibold">${name}</div>
                    <div class="progress mt-1" style="height: 4px;">
                        <div class="progress-bar bg-${color}" style="width: ${pct}%"></div>
                    </div>
                </div>
                <div class="text-end">
                    <span class="fw-bold small">${count}</span>
                    <span class="text-muted small ms-1">(${pct}%)</span>
                </div>
            </div>
        `;
    }

    // ============================
    // Pestaña: Perfil Clínico
    // ============================

    /**
     * Renderiza el dashboard de perfil clínico basado en expedientes
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderPerfil(container, data) {
        const state = S();
        const charts = H();
        const _charts = R();
        const expedientes = (state.extraData && state.extraData.expedientes) || null;

        if (!expedientes || !Array.isArray(expedientes) || expedientes.length === 0) {
            container.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-5">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="text-muted">Cargando datos de expedientes clínicos...</p>
                    </div>
                </div>
            `;
            return;
        }

        const totalExp = expedientes.length;
        const conCronicas = expedientes.filter(e =>
            e.enfermedadesCronicas && (
                (Array.isArray(e.enfermedadesCronicas) && e.enfermedadesCronicas.length > 0) ||
                (typeof e.enfermedadesCronicas === 'string' && e.enfermedadesCronicas.trim() !== '' && e.enfermedadesCronicas.toLowerCase() !== 'ninguna')
            )
        ).length;

        // Distribución de tipo de sangre
        const bloodMap = {};
        expedientes.forEach(e => {
            const ts = e.tipoSangre || 'No especificado';
            bloodMap[ts] = (bloodMap[ts] || 0) + 1;
        });

        // Enfermedades crónicas
        const cronicasMap = {};
        expedientes.forEach(e => {
            const ec = e.enfermedadesCronicas;
            if (!ec) return;
            const items = Array.isArray(ec) ? ec : [ec];
            items.forEach(item => {
                const name = (item || '').trim();
                if (name && name.toLowerCase() !== 'ninguna' && name.toLowerCase() !== 'no') {
                    cronicasMap[name] = (cronicasMap[name] || 0) + 1;
                }
            });
        });
        const topCronicas = Object.entries(cronicasMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        // Alergias
        const alergiasMap = {};
        expedientes.forEach(e => {
            const al = e.alergias;
            if (!al) return;
            const items = Array.isArray(al) ? al : [al];
            items.forEach(item => {
                const name = (item || '').trim();
                if (name && name.toLowerCase() !== 'ninguna' && name.toLowerCase() !== 'no') {
                    alergiasMap[name] = (alergiasMap[name] || 0) + 1;
                }
            });
        });
        const topAlergias = Object.entries(alergiasMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Total Expedientes',
            value: charts.formatNumber(totalExp),
            icon: 'bi-folder2-open',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Con Condiciones Crónicas',
            value: charts.formatNumber(conCronicas),
            icon: 'bi-heart-pulse',
            color: 'warning'
        })}
                </div>

                <!-- Gráficos -->
                <div class="row g-4">
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Tipo de Sangre', 'medico-perfil-blood-doughnut')}
                    </div>
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Enfermedades Crónicas', 'medico-perfil-cronicas-bar')}
                    </div>
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Alergias Principales', 'medico-perfil-alergias-bar')}
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            // Doughnut tipo de sangre
            _charts['medico-perfil-blood-doughnut'] = charts.createDoughnutChart('medico-perfil-blood-doughnut', {
                labels: Object.keys(bloodMap),
                data: Object.values(bloodMap)
            });

            // Bar enfermedades crónicas
            if (topCronicas.length > 0) {
                _charts['medico-perfil-cronicas-bar'] = charts.createBarChart('medico-perfil-cronicas-bar', {
                    labels: topCronicas.map(([n]) => n.length > 25 ? n.substring(0, 22) + '...' : n),
                    datasets: [{
                        label: 'Pacientes',
                        data: topCronicas.map(([, c]) => c),
                        backgroundColor: charts.COLORS.warning
                    }]
                }, { horizontal: true });
            }

            // Bar alergias
            if (topAlergias.length > 0) {
                _charts['medico-perfil-alergias-bar'] = charts.createBarChart('medico-perfil-alergias-bar', {
                    labels: topAlergias.map(([n]) => n.length > 25 ? n.substring(0, 22) + '...' : n),
                    datasets: [{
                        label: 'Pacientes',
                        data: topAlergias.map(([, c]) => c),
                        backgroundColor: charts.COLORS.danger
                    }]
                }, { horizontal: true });
            }
        }, 50);
    }

    // ============================
    // Retorno público
    // ============================
    return { render, getTabs, categorizeSimilar };

})();
