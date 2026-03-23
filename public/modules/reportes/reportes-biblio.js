/**
 * Reportes - Módulo Biblioteca
 * Sub-módulo que renderiza dashboards específicos para el área de Biblioteca.
 * Tabs: Visitas, Préstamos, Catálogo
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-biblio.js cargado, window.Reportes keys:', Object.keys(window.Reportes));

window.Reportes.Biblio = (function () {
    'use strict';

    const H = () => Reportes.Charts;
    const S = () => Reportes.getState();
    const R = () => Reportes.getChartRegistry();

    // ============================
    // API pública
    // ============================

    /**
     * Devuelve las pestañas disponibles para Biblioteca
     * @returns {Array<{id:string, label:string, icon:string}>}
     */
    function getTabs() {
        return [
            { id: 'visitas', label: 'Visitas', icon: 'bi-door-open' },
            { id: 'prestamos', label: 'Préstamos', icon: 'bi-book' },
            { id: 'catalogo', label: 'Catálogo', icon: 'bi-collection' }
        ];
    }

    /**
     * Renderiza el contenido según la pestaña activa
     * @param {HTMLElement} container
     */
    function render(container) {
        const state = S();
        const tab = state.currentTab || 'visitas';

        switch (tab) {
            case 'prestamos': renderPrestamos(container, state.filteredData); break;
            case 'catalogo': renderCatalogo(container, state.filteredData); break;
            default: renderVisitas(container, state.filteredData); break;
        }
    }

    // ============================
    // Clasificación de motivos
    // ============================

    /**
     * Clasifica el motivo de visita a partir del registro
     * @param {Object} d - registro de visita
     * @returns {string}
     */
    function classifyVisitMotive(d) {
        const tipo = (d.tipo || '').toLowerCase();
        const detalle = (d.detalle || '').toLowerCase();
        if (tipo.includes('consulta') || detalle.includes('consulta')) return 'Consulta';
        if (tipo.includes('individual') || detalle.includes('individual')) return 'Trabajo Individual';
        if (tipo.includes('equipo') || detalle.includes('equipo')) return 'Trabajo en Equipo';
        if (tipo.includes('computadora') || detalle.includes('computadora')) return 'Uso de Computadora';
        return d.tipo || 'General';
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

    /** Agrupa registros por semana ISO */
    function groupByWeek(data) {
        const map = {};
        data.forEach(d => {
            const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
            if (isNaN(date)) return;
            const weekStart = new Date(date);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const year = weekStart.getFullYear();
            const month = String(weekStart.getMonth() + 1).padStart(2, '0');
            const day = String(weekStart.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            map[key] = map[key] || {};
            const status = d.status || 'Activo';
            map[key][status] = (map[key][status] || 0) + 1;
        });
        return map;
    }

    /** Calcula la duración promedio en minutos entre fecha y salida */
    function calcDuracionPromedio(data) {
        let total = 0, count = 0;
        data.forEach(d => {
            if (d.salida && d.fecha) {
                const entrada = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
                const salida = d.salida instanceof Date ? d.salida : new Date(d.salida);
                if (!isNaN(entrada) && !isNaN(salida)) {
                    const diff = (salida - entrada) / 60000; // minutos
                    if (diff > 0 && diff < 1440) { total += diff; count++; }
                }
            }
        });
        return count > 0 ? Math.round(total / count) : null;
    }

    /** Obtiene el día con más registros */
    function getPeakDay(dayMap) {
        let max = 0, peak = '';
        Object.entries(dayMap).forEach(([day, count]) => {
            if (count > max) { max = count; peak = day; }
        });
        if (!peak) return 'N/D';
        return new Date(peak + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
    }

    /** Obtiene la hora más frecuente */
    function getPeakHour(hours) {
        let max = 0, peak = 0;
        hours.forEach((count, h) => { if (count > max) { max = count; peak = h; } });
        return `${String(peak).padStart(2, '0')}:00`;
    }

    /** Calcula días distintos en el rango */
    function countDistinctDays(data) {
        const days = new Set();
        data.forEach(d => {
            const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
            if (!isNaN(date)) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                days.add(`${year}-${month}-${day}`);
            }
        });
        return Math.max(days.size, 1);
    }

    /** Formatea fecha para tabla */
    function fmtDate(d) {
        const date = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
        return isNaN(date) ? 'N/D' : date.toLocaleDateString('es-MX');
    }

    // ============================
    // Pestaña: Visitas
    // ============================

    /**
     * Renderiza el dashboard de visitas
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderVisitas(container, data) {
        const visits = data.filter(d => d.subarea === 'Visitas');
        const charts = H();
        const _charts = R();

        const dayMap = groupByDay(visits);
        const hours = groupByHour(visits);
        const total = visits.length;
        const days = countDistinctDays(visits);
        const avgDay = days > 0 ? (total / days).toFixed(1) : '0';
        const peakDay = getPeakDay(dayMap);
        const peakHour = getPeakHour(hours);
        const durProm = calcDuracionPromedio(visits);
        const durStr = durProm !== null ? `${durProm} min` : 'N/D';

        // Motivos
        const motiveMap = {};
        visits.forEach(d => {
            const m = classifyVisitMotive(d);
            motiveMap[m] = (motiveMap[m] || 0) + 1;
        });

        // Sparkline data
        const sortedDays = Object.keys(dayMap).sort();
        const sparkData = sortedDays.map(k => dayMap[k]);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Total Visitas',
            value: charts.formatNumber(total),
            icon: 'bi-door-open',
            color: 'warning',
            chartId: 'biblio-visit-spark-total'
        })}
                    ${charts.renderKPICard({
            title: 'Promedio Diario',
            value: avgDay,
            subtitle: 'Pico: ' + peakDay,
            icon: 'bi-graph-up',
            color: 'info'
        })}
                    ${charts.renderKPICard({
            title: 'Hora Pico',
            value: peakHour,
            icon: 'bi-clock',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Duración Promedio',
            value: durStr,
            icon: 'bi-hourglass-split',
            color: 'success'
        })}
                </div>

                <!-- Gráfico principal: Visitas por día -->
                <div class="row g-4">
                    <div class="col-12">
                        ${charts.renderChartCard('Visitas por Día', 'biblio-visit-line')}
                    </div>
                </div>

                <!-- Gráficos secundarios -->
                <div class="row g-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Distribución por Motivo', 'biblio-visit-motive-doughnut')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Visitas por Hora del Día', 'biblio-visit-hour-bar')}
                    </div>
                </div>

            </div>
        `;

        // Crear gráficos después de inyectar HTML
        setTimeout(() => {
            // Sparkline en KPI
            if (document.getElementById('biblio-visit-spark-total')) {
                _charts['biblio-visit-spark-total'] = charts.createSparkline(
                    'biblio-visit-spark-total', sparkData, charts.COLORS.warning
                );
            }

            // Línea principal
            const dayLabels = sortedDays.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));
            _charts['biblio-visit-line'] = charts.createLineChart('biblio-visit-line', {
                labels: dayLabels,
                datasets: [{
                    label: 'Visitas',
                    data: sparkData,
                    borderColor: charts.COLORS.warning,
                    backgroundColor: charts.COLORS.warning + '22',
                    fill: true, tension: 0.4
                }]
            });

            // Doughnut motivos
            const motiveLabels = Object.keys(motiveMap);
            const motiveData = Object.values(motiveMap);
            _charts['biblio-visit-motive-doughnut'] = charts.createDoughnutChart('biblio-visit-motive-doughnut', {
                labels: motiveLabels,
                data: motiveData
            });

            // Bar horas
            const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
            _charts['biblio-visit-hour-bar'] = charts.createBarChart('biblio-visit-hour-bar', {
                labels: hourLabels,
                datasets: [{
                    label: 'Visitas',
                    data: hours,
                    backgroundColor: charts.COLORS.info
                }]
            });
        }, 50);
    }

    /** Calcula la duración de un registro individual (minutos) */
    function calcDuracionRegistro(d) {
        if (!d.salida || !d.fecha) return 'N/D';
        const entrada = d.fecha instanceof Date ? d.fecha : new Date(d.fecha);
        const salida = d.salida instanceof Date ? d.salida : new Date(d.salida);
        if (isNaN(entrada) || isNaN(salida)) return 'N/D';
        const diff = Math.round((salida - entrada) / 60000);
        if (diff <= 0 || diff >= 1440) return 'N/D';
        return `${diff} min`;
    }

    // ============================
    // Pestaña: Préstamos
    // ============================

    /**
     * Renderiza el dashboard de préstamos
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderPrestamos(container, data) {
        const loans = data.filter(d => d.subarea === 'Préstamos');
        const charts = H();
        const _charts = R();

        const total = loans.length;
        const activos = loans.filter(d => d.status === 'Activo').length;
        const retrasos = loans.filter(d => d.status === 'Retraso' || d.status === 'Devuelto con multa').length;

        // Multas
        let montoMultas = 0;
        loans.forEach(d => {
            const multa = parseFloat(d.multaActual || d.montoDeuda || 0);
            if (!isNaN(multa)) montoMultas += multa;
        });
        const multaStr = '$' + charts.formatNumber(Math.round(montoMultas));

        // Top 10 libros
        const libroMap = {};
        loans.forEach(d => {
            const titulo = d.detalle || d.tituloLibro || 'Desconocido';
            libroMap[titulo] = (libroMap[titulo] || 0) + 1;
        });
        const topLibros = Object.entries(libroMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

        // Estado distribución
        const statusMap = {};
        loans.forEach(d => {
            const s = d.status || 'Activo';
            statusMap[s] = (statusMap[s] || 0) + 1;
        });

        // Semanas para stacked bar
        const weekMap = groupByWeek(loans);
        const weekKeys = Object.keys(weekMap).sort();
        const preferredStatuses = ['Activo', 'Pendiente', 'Devuelto', 'Devuelto con multa', 'Retraso', 'No recogido', 'Cancelado'];
        const statusOrder = [
            ...preferredStatuses.filter(status => statusMap[status] > 0),
            ...Object.keys(statusMap).filter(status => !preferredStatuses.includes(status))
        ];
        const statusColors = {
            'Activo': charts.COLORS.success,
            'Pendiente': charts.COLORS.warning,
            'Devuelto': charts.COLORS.info,
            'Devuelto con multa': charts.COLORS.purple,
            'Retraso': charts.COLORS.danger,
            'No recogido': charts.COLORS.secondary || '#6c757d',
            'Cancelado': '#9ca3af'
        };

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Total Préstamos',
            value: charts.formatNumber(total),
            icon: 'bi-book',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Activos',
            value: charts.formatNumber(activos),
            icon: 'bi-bookmark-check',
            color: 'success'
        })}
                    ${charts.renderKPICard({
            title: 'Adeudos / Retrasos',
            value: charts.formatNumber(retrasos),
            icon: 'bi-exclamation-triangle',
            color: 'danger',
            badgeColor: 'danger'
        })}
                    ${charts.renderKPICard({
            title: 'Monto Multas',
            value: multaStr,
            icon: 'bi-cash-coin',
            color: 'warning'
        })}
                </div>

                <!-- Gráfico principal: Préstamos por semana (stacked) -->
                <div class="row g-4">
                    <div class="col-12">
                        ${charts.renderChartCard('Préstamos por Semana', 'biblio-loan-stacked-bar')}
                    </div>
                </div>

                <!-- Gráficos secundarios -->
                <div class="row g-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Top 10 Libros Más Solicitados', 'biblio-loan-top-books')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Estado de Préstamos', 'biblio-loan-status-doughnut')}
                    </div>
                </div>

            </div>
        `;

        setTimeout(() => {
            // Stacked bar semanal
            const weekLabels = weekKeys.map(k =>
                new Date(k + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
            );
            _charts['biblio-loan-stacked-bar'] = charts.createBarChart('biblio-loan-stacked-bar', {
                labels: weekLabels,
                datasets: statusOrder.map(status => ({
                    label: status,
                    data: weekKeys.map(k => weekMap[k][status] || 0),
                    backgroundColor: statusColors[status] || charts.COLORS.primary
                }))
            }, { stacked: true });

            // Top libros (horizontal bar)
            _charts['biblio-loan-top-books'] = charts.createBarChart('biblio-loan-top-books', {
                labels: topLibros.map(([t]) => t.length > 40 ? t.substring(0, 37) + '...' : t),
                datasets: [{
                    label: 'Préstamos',
                    data: topLibros.map(([, c]) => c),
                    backgroundColor: charts.COLORS.primary
                }]
            }, { horizontal: true });

            // Doughnut estado
            _charts['biblio-loan-status-doughnut'] = charts.createDoughnutChart('biblio-loan-status-doughnut', {
                labels: statusOrder,
                data: statusOrder.map(status => statusMap[status] || 0),
                colors: statusOrder.map(status => statusColors[status] || charts.COLORS.primary)
            });
        }, 50);
    }

    // ============================
    // Pestaña: Catálogo
    // ============================

    /**
     * Renderiza el dashboard del catálogo bibliográfico
     * @param {HTMLElement} container
     * @param {Array} data
     */
    function renderCatalogo(container, data) {
        const state = S();
        const charts = H();
        const _charts = R();
        const catalogo = (state.extraData && state.extraData.catalogo) || null;

        if (!catalogo || !Array.isArray(catalogo) || catalogo.length === 0) {
            container.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-5">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="text-muted">Cargando datos del catálogo...</p>
                    </div>
                </div>
            `;
            return;
        }

        const totalTitulos = catalogo.length;
        const sinCopias = catalogo.filter(c => c.copiasDisponibles === 0).length;
        const categoriasSet = new Set(catalogo.map(c => c.categoria).filter(Boolean));
        const totalCats = categoriasSet.size;

        // Distribución por categoría
        const catMap = {};
        catalogo.forEach(c => {
            const cat = c.categoria || 'Sin categoría';
            catMap[cat] = (catMap[cat] || 0) + 1;
        });
        const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <!-- KPIs -->
                <div class="row g-3">
                    ${charts.renderKPICard({
            title: 'Total Títulos',
            value: charts.formatNumber(totalTitulos),
            icon: 'bi-collection',
            color: 'primary'
        })}
                    ${charts.renderKPICard({
            title: 'Sin Copias Disponibles',
            value: charts.formatNumber(sinCopias),
            icon: 'bi-x-circle',
            color: 'danger'
        })}
                    ${charts.renderKPICard({
            title: 'Categorías Únicas',
            value: charts.formatNumber(totalCats),
            icon: 'bi-tags',
            color: 'info'
        })}
                </div>

                <!-- Gráfico: Títulos por categoría -->
                <div class="row g-4">
                    <div class="col-12">
                        ${charts.renderChartCard('Títulos por Categoría', 'biblio-cat-bar')}
                    </div>
                </div>

            </div>
        `;

        setTimeout(() => {
            _charts['biblio-cat-bar'] = charts.createBarChart('biblio-cat-bar', {
                labels: sortedCats.map(([cat]) => cat),
                datasets: [{
                    label: 'Títulos',
                    data: sortedCats.map(([, c]) => c),
                    backgroundColor: charts.COLORS.primary
                }]
            });
        }, 50);
    }

    // ============================
    // Retorno público
    // ============================
    return { render, getTabs };

})();
