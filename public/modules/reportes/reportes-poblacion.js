/**
 * Reportes - Módulo Población SIA
 * Sub-módulo que renderiza dashboards demográficos, de salud y socioeconómicos.
 * Tabs: Demografía, Salud, Socioeconómico
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-poblacion.js cargado, window.Reportes keys:', Object.keys(window.Reportes));

window.Reportes.Poblacion = (function () {
    'use strict';

    const H = () => Reportes.Charts;
    const S = () => Reportes.getState();
    const R = () => Reportes.getChartRegistry();

    // ============================
    // API pública
    // ============================

    /**
     * Devuelve las pestañas disponibles para Población
     * @returns {Array<{id:string, label:string, icon:string}>}
     */
    function getTabs() {
        return [
            { id: 'demografia', label: 'Demografía', icon: 'bi-bar-chart' },
            { id: 'salud', label: 'Salud', icon: 'bi-hospital' },
            { id: 'socioeconomico', label: 'Socioeconómico', icon: 'bi-cash-stack' }
        ];
    }

    /**
     * Renderiza el contenido según la pestaña activa
     * @param {HTMLElement} container
     */
    function render(container) {
        const state = S();
        const tab = state.currentTab || 'demografia';

        switch (tab) {
            case 'salud': renderSalud(container, state.filteredData); break;
            case 'socioeconomico': renderSocioeconomico(container, state.filteredData); break;
            default: renderDemografia(container, state.filteredData); break;
        }
    }

    // ============================
    // Utilidades internas
    // ============================

    /** Formatea fecha para tabla */
    function fmtDate(d) {
        const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
        return isNaN(date) ? 'N/D' : date.toLocaleDateString('es-MX');
    }

    function splitListValue(value) {
        if (Array.isArray(value)) {
            return value.flatMap(splitListValue);
        }

        return String(value || '')
            .split(/[,;/]+/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function normalizeCategoryLabel(value) {
        const label = String(value || '').trim();
        if (!label) return '';
        return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    }

    // ============================
    // Pestaña: Demografía
    // ============================

    /**
     * Renderiza el dashboard demográfico
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderDemografia(container, data) {
        const charts = H();
        const _charts = R();

        const total = data.length;
        const estudiantes = data.filter(d => d.subarea === 'ESTUDIANTE').length;
        const docentes = data.filter(d => d.subarea === 'DOCENTE').length;
        const administrativos = data.filter(d => d.subarea === 'ADMINISTRATIVO').length;
        const adminsModulo = data.filter(d => d.subarea === 'ADMIN_MODULO').length;

        // Distribución por carrera (top 10)
        const carreraMap = {};
        data.forEach(d => {
            const c = d.carrera || 'No especificado';
            if (c !== 'N/A') carreraMap[c] = (carreraMap[c] || 0) + 1;
        });
        const topCarreras = Object.entries(carreraMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        // Distribución por género
        const generoMap = {};
        data.forEach(d => {
            const g = d.genero || 'No especificado';
            generoMap[g] = (generoMap[g] || 0) + 1;
        });

        // Distribución por generación
        const genMap = {};
        data.forEach(d => {
            const g = d.generacion || 'No especificado';
            genMap[g] = (genMap[g] || 0) + 1;
        });
        const sortedGen = Object.entries(genMap).sort((a, b) => {
            if (a[0] === 'No especificado') return 1;
            if (b[0] === 'No especificado') return -1;
            return String(b[0]).localeCompare(String(a[0]));
        });

        // Distribución por turno
        const turnoMap = {};
        data.forEach(d => {
            const t = d.turno || 'No especificado';
            turnoMap[t] = (turnoMap[t] || 0) + 1;
        });

        // Distribución por estado civil
        const civilMap = {};
        data.forEach(d => {
            const c = d.estadoCivil || 'No especificado';
            civilMap[c] = (civilMap[c] || 0) + 1;
        });

        // Distribución por dependientes
        const depMap = {};
        data.forEach(d => {
            let dep = d.dependientes || 'No';
            if (dep.startsWith('Sí')) dep = 'Sí';
            depMap[dep] = (depMap[dep] || 0) + 1;
        });

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Total Usuarios',
            value: charts.formatNumber(total),
            icon: 'bi-people-fill',
            color: 'success'
        })}
                    ${charts.renderKPICard({
            title: 'Estudiantes',
            value: charts.formatNumber(estudiantes),
            icon: 'bi-mortarboard',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Personal Académico',
            value: charts.formatNumber(docentes),
            icon: 'bi-person-workspace',
            color: 'info'
        })}
                    ${charts.renderKPICard({
            title: 'Personal Administrativo',
            value: charts.formatNumber(administrativos),
            icon: 'bi-building',
            color: 'warning'
        })}
                    ${charts.renderKPICard({
            title: 'Admins de Modulo',
            value: charts.formatNumber(adminsModulo),
            icon: 'bi-shield-check',
            color: 'secondary'
        })}
                </div>

                <!-- Gráfico principal: Por carrera (horizontal) -->
                <div class="row g-4">
                    <div class="col-12">
                        ${charts.renderChartCard('Distribución por Carrera (Top 10)', 'pob-demo-carrera-bar')}
                    </div>
                </div>

                <!-- Gráficos secundarios -->
                <div class="row g-4">
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Por Género', 'pob-demo-genero-doughnut')}
                    </div>
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Por Generación', 'pob-demo-generacion-bar')}
                    </div>
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Por Turno', 'pob-demo-turno-pie')}
                    </div>
                </div>

                <!-- Gráficos extra (Estado civil, Dependientes) -->
                <div class="row g-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Por Estado Civil', 'pob-demo-civil-pie')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Tiene Dependientes', 'pob-demo-dep-doughnut')}
                    </div>
                </div>

            </div>
        `;

        setTimeout(() => {
            // Bar carreras (horizontal)
            _charts['pob-demo-carrera-bar'] = charts.createBarChart('pob-demo-carrera-bar', {
                labels: topCarreras.map(([c]) => c.length > 40 ? c.substring(0, 37) + '...' : c),
                datasets: [{
                    label: 'Usuarios',
                    data: topCarreras.map(([, c]) => c),
                    backgroundColor: charts.COLORS.success
                }]
            }, { horizontal: true });

            // Doughnut género
            _charts['pob-demo-genero-doughnut'] = charts.createDoughnutChart('pob-demo-genero-doughnut', {
                labels: Object.keys(generoMap),
                data: Object.values(generoMap),
                colors: ['#ec35d0', '#4040e5', '#6366f1', '#8b5cf6']
            });

            // Bar generación
            _charts['pob-demo-generacion-bar'] = charts.createBarChart('pob-demo-generacion-bar', {
                labels: sortedGen.map(([g]) => String(g)),
                datasets: [{
                    label: 'Usuarios',
                    data: sortedGen.map(([, c]) => c),
                    backgroundColor: charts.COLORS.info
                }]
            });

            // Pie turno
            _charts['pob-demo-turno-pie'] = charts.createDoughnutChart('pob-demo-turno-pie', {
                labels: Object.keys(turnoMap),
                data: Object.values(turnoMap),
                colors: [charts.COLORS.warning, charts.COLORS.success, charts.COLORS.info]
            });

            // Pie estado civil
            _charts['pob-demo-civil-pie'] = charts.createDoughnutChart('pob-demo-civil-pie', {
                labels: Object.keys(civilMap),
                data: Object.values(civilMap),
                colors: [charts.COLORS.primary, '#6366f1', '#ec35d0', charts.COLORS.info]
            });

            // Doughnut dependientes
            _charts['pob-demo-dep-doughnut'] = charts.createDoughnutChart('pob-demo-dep-doughnut', {
                labels: Object.keys(depMap),
                data: Object.values(depMap),
                colors: [charts.COLORS.danger, charts.COLORS.success]
            });
        }, 50);
    }

    // ============================
    // Pestaña: Salud
    // ============================

    /**
     * Renderiza el dashboard de salud de la población
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderSalud(container, data) {
        const state = S();
        const charts = H();
        const _charts = R();

        // Discapacidades
        const conDiscapacidad = data.filter(d =>
            d.discapacidades && Array.isArray(d.discapacidades) && d.discapacidades.length > 0
        ).length;

        // Uso de lentes
        const usaLentes = data.filter(d => d.usaLentes === 'Sí').length;

        // Agrupar tipos de discapacidad
        const discapMap = {};
        data.forEach(d => {
            if (d.discapacidades && Array.isArray(d.discapacidades)) {
                d.discapacidades.forEach(disc => {
                    const name = normalizeCategoryLabel(disc);
                    if (name) discapMap[name] = (discapMap[name] || 0) + 1;
                });
            }
        });

        // Condiciones crónicas
        const condMap = {};
        data.forEach(d => {
            const ec = d.enfermedadCronica;
            if (!ec) return;

            // Handle comma separated values if entered that way
            const items = (typeof ec === 'string' && ec.includes(','))
                ? ec.split(',').map(s => s.trim())
                : [typeof ec === 'string' ? ec.trim() : ec];

            items.forEach(item => {
                const name = (item || '').trim();
                if (name && name.toLowerCase() !== 'ninguna' && name.toLowerCase() !== 'no' && name.toLowerCase() !== 'n/a' && name.toLowerCase() !== 'ninguno') {
                    const normalized = normalizeCategoryLabel(name);
                    condMap[normalized] = (condMap[normalized] || 0) + 1;
                }
            });
        });
        const topCondiciones = Object.entries(condMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        // Alergias
        const alergiaMap = {};
        data.forEach(d => {
            const a = d.alergia || 'Ninguna';
            splitListValue(a).forEach(item => {
                const normalized = normalizeCategoryLabel(item);
                const key = normalized.toLowerCase();
                if (!normalized || ['ninguna', 'no', 'n/a', 'ninguno', 'sin'].includes(key)) return;
                alergiaMap[normalized] = (alergiaMap[normalized] || 0) + 1;
            });
        });
        const topAlergias = Object.entries(alergiaMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        // Apoyo psicológico requerido
        const psicoMap = { 'Sí': 0, 'No': 0 };
        data.forEach(d => {
            const p = d.apoyoPsico || 'No';
            if (p === 'Sí' || p === 'Si') psicoMap['Sí']++;
            else psicoMap['No']++;
        });

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Con Discapacidad',
            value: charts.formatNumber(conDiscapacidad),
            icon: 'bi-universal-access',
            color: 'info'
        })}
                    ${charts.renderKPICard({
            title: 'Uso Lentes',
            value: charts.formatNumber(usaLentes),
            icon: 'bi-eyeglasses',
            color: 'warning'
        })}
                </div>

                <!-- Gráficos -->
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Tipos de Discapacidad', 'pob-salud-discap-doughnut')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Top Condiciones Crónicas', 'pob-salud-cond-bar')}
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Top Alergias', 'pob-salud-alergia-bar')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Requiere Apoyo Psicológico', 'pob-salud-psico-pie')}
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            // Doughnut discapacidades
            const discapLabels = Object.keys(discapMap);
            const discapData = Object.values(discapMap);
            if (discapLabels.length > 0) {
                _charts['pob-salud-discap-doughnut'] = charts.createDoughnutChart('pob-salud-discap-doughnut', {
                    labels: discapLabels,
                    data: discapData
                });
            }

            // Bar condiciones
            if (topCondiciones.length > 0) {
                _charts['pob-salud-cond-bar'] = charts.createBarChart('pob-salud-cond-bar', {
                    labels: topCondiciones.map(([n]) => n.length > 30 ? n.substring(0, 27) + '...' : n),
                    datasets: [{
                        label: 'Personas',
                        data: topCondiciones.map(([, c]) => c),
                        backgroundColor: charts.COLORS.danger
                    }]
                }, { horizontal: true });
            }

            // Bar alergias
            if (topAlergias.length > 0) {
                _charts['pob-salud-alergia-bar'] = charts.createBarChart('pob-salud-alergia-bar', {
                    labels: topAlergias.map(([n]) => n.length > 30 ? n.substring(0, 27) + '...' : n),
                    datasets: [{
                        label: 'Personas',
                        data: topAlergias.map(([, c]) => c),
                        backgroundColor: charts.COLORS.warning
                    }]
                }, { horizontal: true });
            }

            // Pie apoyo psicológico
            _charts['pob-salud-psico-pie'] = charts.createDoughnutChart('pob-salud-psico-pie', {
                labels: ['Sí Requiere', 'No Requiere'],
                data: [psicoMap['Sí'], psicoMap['No']],
                colors: [charts.COLORS.danger, charts.COLORS.success]
            });
        }, 50);
    }

    // ============================
    // Pestaña: Socioeconómico
    // ============================

    /**
     * Renderiza el dashboard socioeconómico
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderSocioeconomico(container, data) {
        const charts = H();
        const _charts = R();

        // KPIs
        const becados = data.filter(d => d.beca && d.beca !== 'No').length;
        const noBecados = data.length - becados;
        const trabajan = data.filter(d => d.trabaja === 'Sí' || d.trabaja === 'Si').length;
        const noTrabajan = data.length - trabajan;
        const idiomas = data.filter(d => d.idiomas && d.idiomas !== 'Ninguno').length;

        // Top 10 colonias
        const coloniaMap = {};
        data.forEach(d => {
            const col = (d.colonia || '').trim();
            if (col && col.toLowerCase() !== 'no especificada' && col.length > 3) {
                coloniaMap[col] = (coloniaMap[col] || 0) + 1;
            }
        });
        const topColonias = Object.entries(coloniaMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Becados',
            value: charts.formatNumber(becados),
            icon: 'bi-award',
            color: 'success'
        })}
                    ${charts.renderKPICard({
            title: 'Trabajan',
            value: charts.formatNumber(trabajan),
            icon: 'bi-briefcase',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Hablan Idioma Extra',
            value: charts.formatNumber(idiomas),
            icon: 'bi-translate',
            color: 'info'
        })}
                </div>

                <!-- Gráficos -->
                <div class="row g-4">
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Becados vs No Becados', 'pob-socio-beca-doughnut')}
                    </div>
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Top 10 Colonias', 'pob-socio-colonia-bar')}
                    </div>
                    <div class="col-lg-4">
                        ${charts.renderChartCard('Trabaja / No trabaja', 'pob-socio-trabaja-pie')}
                    </div>
                </div>

            </div>
        `;

        setTimeout(() => {
            // Doughnut becas
            _charts['pob-socio-beca-doughnut'] = charts.createDoughnutChart('pob-socio-beca-doughnut', {
                labels: ['Becados', 'No Becados'],
                data: [becados, noBecados],
                colors: [charts.COLORS.success, charts.COLORS.secondary || '#6c757d']
            });

            // Bar colonias (horizontal)
            if (topColonias.length > 0) {
                _charts['pob-socio-colonia-bar'] = charts.createBarChart('pob-socio-colonia-bar', {
                    labels: topColonias.map(([c]) => c.length > 30 ? c.substring(0, 27) + '...' : c),
                    datasets: [{
                        label: 'Personas',
                        data: topColonias.map(([, c]) => c),
                        backgroundColor: charts.COLORS.warning
                    }]
                }, { horizontal: true });
            }

            // Pie trabaja
            _charts['pob-socio-trabaja-pie'] = charts.createDoughnutChart('pob-socio-trabaja-pie', {
                labels: ['Trabaja', 'No trabaja'],
                data: [trabajan, noTrabajan],
                colors: [charts.COLORS.primary, charts.COLORS.secondary || '#6c757d']
            });
        }, 50);
    }

    // ============================
    // Retorno público
    // ============================
    return { render, getTabs };

})();
