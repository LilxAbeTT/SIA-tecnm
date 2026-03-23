/**
 * ============================================================
 *  Reportes.Charts — Utilidades compartidas de gráficas SIA
 * ============================================================
 *  Provee funciones reutilizables para crear gráficas con
 *  Chart.js, tarjetas KPI, tablas de datos y utilidades de
 *  formato para todos los sub-módulos de Reportes.
 *
 *  @version 4.0.0
 *  @requires Chart.js 4+, Bootstrap 5.3
 * ============================================================
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-charts.js cargado');

window.Reportes.Charts = (function () {
    'use strict';

    // ==================== PALETA DE COLORES SIA ====================

    /** Paleta de colores del sistema */
    const COLORS = {
        primary: '#6366f1',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#0ea5e9',
        purple: '#8b5cf6',
        pink: '#ec4899',
        teal: '#14b8a6',
        palette: [
            '#6366f1', '#10b981', '#f59e0b', '#0ea5e9',
            '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444',
            '#f97316', '#06b6d4'
        ]
    };

    // ==================== CREACIÓN DE GRÁFICAS ====================

    /**
     * Crea una gráfica de línea temporal con estilo SIA.
     * Incluye relleno con gradiente, curva suave y sin puntos visibles.
     *
     * @param {string} canvasId - ID del elemento <canvas>
     * @param {string[]} labels - Etiquetas del eje X
     * @param {Object[]} datasets - Arreglo de datasets de Chart.js. Cada uno puede tener:
     *   {label, data, borderColor, backgroundColor}. Si no se especifican colores, se asignan automáticamente.
     * @param {Object} [options={}] - Opciones adicionales:
     *   {string} title, {boolean} showLegend, {string} xLabel, {string} yLabel
     * @param {Object} [registry=null] - Registro de gráficas para limpieza automática
     * @returns {Chart|null} Instancia de Chart o null si falla
     */
    function createLineChart(canvasId, arg2, arg3, arg4, arg5) {
        // Acepta: (id, {labels, datasets}, options?) O (id, labels[], datasets[], options?, registry?)
        let labels, datasets, options = {}, registry = null;
        if (arg2 && typeof arg2 === 'object' && !Array.isArray(arg2) && arg2.labels) {
            labels = arg2.labels;
            datasets = arg2.datasets || [];
            options = (typeof arg3 === 'object' && arg3) ? arg3 : {};
            registry = arg4 || null;
        } else {
            labels = arg2; datasets = arg3; options = arg4 || {}; registry = arg5 || null;
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        if (!datasets || !Array.isArray(datasets)) return null;

        // Sanitizar labels a strings
        labels = (labels || []).map(l => l == null ? 'N/A' : String(l));

        // Preparar datasets con estilo SIA
        const styledDatasets = datasets.map((ds, i) => {
            const color = ds.borderColor || COLORS.palette[i % COLORS.palette.length];
            return {
                label: ds.label || `Serie ${i + 1}`,
                data: ds.data,
                borderColor: color,
                borderWidth: 2,
                backgroundColor: ds.backgroundColor || ((context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height || 200);
                    gradient.addColorStop(0, _hexToRgba(color, 0.25));
                    gradient.addColorStop(1, _hexToRgba(color, 0));
                    return gradient;
                }),
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: color,
                ...ds
            };
        });

        const chart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: styledDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: options.showLegend !== false && datasets.length > 1,
                        position: 'top',
                        labels: { usePointStyle: true, padding: 15 }
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#d1d5db',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        display: options.showAxes !== false,
                        grid: { display: false },
                        ticks: { maxTicksLimit: 10, font: { size: 11 } },
                        title: options.xLabel ? { display: true, text: options.xLabel } : {}
                    },
                    y: {
                        display: options.showAxes !== false,
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { font: { size: 11 } },
                        title: options.yLabel ? { display: true, text: options.yLabel } : {}
                    }
                },
                layout: { padding: 0 }
            }
        });

        // Registrar para limpieza
        if (registry) registry[canvasId] = chart;
        return chart;
    }

    /**
     * Crea una gráfica de barras (vertical u horizontal).
     *
     * @param {string} canvasId - ID del <canvas>
     * @param {string[]} labels - Etiquetas
     * @param {number[]} data - Valores
     * @param {Object} [options={}] - {boolean} horizontal, {string} color, {string} label
     * @param {Object} [registry=null] - Registro para limpieza
     * @returns {Chart|null}
     */
    function createBarChart(canvasId, arg2, arg3, arg4, arg5) {
        // Acepta: (id, {labels, datasets}, options?) O (id, labels[], data[], options?, registry?)
        let labels, datasets, options = {}, registry = null;
        if (arg2 && typeof arg2 === 'object' && !Array.isArray(arg2) && arg2.labels) {
            labels = arg2.labels;
            datasets = arg2.datasets || null;
            options = (typeof arg3 === 'object' && arg3) ? arg3 : {};
            registry = arg4 || null;
        } else {
            labels = arg2; datasets = null; options = arg4 || {}; registry = arg5 || null;
            // legacy: data array as 3rd arg
            if (Array.isArray(arg3)) {
                datasets = [{ data: arg3 }];
            }
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        // Sanitizar labels a strings
        labels = (labels || []).map(l => l == null ? 'N/A' : String(l));

        // Si datasets tiene items, usarlos directamente; si no, crear uno genérico
        const chartDatasets = (datasets && datasets.length > 0)
            ? datasets.map(ds => ({
                label: ds.label || options.label || 'Cantidad',
                data: ds.data,
                backgroundColor: ds.backgroundColor || options.color || COLORS.primary,
                borderRadius: 6,
                maxBarThickness: 40,
                ...ds
            }))
            : [{ label: 'Cantidad', data: [], backgroundColor: COLORS.primary, borderRadius: 6, maxBarThickness: 40 }];

        const stacked = options.stacked || false;

        const chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: chartDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: options.horizontal ? 'y' : 'x',
                plugins: {
                    legend: { display: chartDatasets.length > 1 },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        cornerRadius: 8,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        stacked: stacked,
                        beginAtZero: true,
                        grid: { display: options.horizontal ? true : false, color: 'rgba(255,255,255,0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        stacked: stacked,
                        beginAtZero: true,
                        grid: { display: options.horizontal ? false : true, color: 'rgba(255,255,255,0.05)' },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });

        if (registry) registry[canvasId] = chart;
        return chart;
    }

    /**
     * Crea una gráfica de dona (doughnut).
     *
     * @param {string} canvasId - ID del <canvas>
     * @param {string[]} labels - Etiquetas
     * @param {number[]} data - Valores
     * @param {Object} [options={}] - {string[]} colors, {string} legendPosition
     * @param {Object} [registry=null] - Registro para limpieza
     * @returns {Chart|null}
     */
    function createDoughnutChart(canvasId, arg2, arg3, arg4, arg5) {
        // Acepta: (id, {labels, data, colors?}, options?) O (id, labels[], data[], options?, registry?)
        let labels, data, options = {}, registry = null;
        if (arg2 && typeof arg2 === 'object' && !Array.isArray(arg2) && arg2.labels) {
            labels = arg2.labels;
            data = arg2.data || [];
            // colors puede venir en el config o en options
            options = (typeof arg3 === 'object' && arg3) ? arg3 : {};
            if (arg2.colors) options.colors = arg2.colors;
            registry = arg4 || null;
        } else {
            labels = arg2; data = arg3; options = arg4 || {}; registry = arg5 || null;
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        // Sanitizar labels a strings
        labels = (labels || []).map(l => l == null ? 'N/A' : String(l));
        const colors = options.colors || COLORS.palette.slice(0, labels.length);

        const chart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        display: true,
                        position: options.legendPosition || 'bottom',
                        labels: { usePointStyle: true, padding: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        cornerRadius: 8,
                        padding: 10,
                        callbacks: {
                            label: function (ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return `${ctx.label}: ${formatNumber(ctx.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        if (registry) registry[canvasId] = chart;
        return chart;
    }

    /**
     * Crea una gráfica de barras apiladas.
     *
     * @param {string} canvasId - ID del <canvas>
     * @param {string[]} labels - Etiquetas del eje X
     * @param {Object[]} datasets - [{label, data, backgroundColor}]
     * @param {Object} [options={}] - Opciones adicionales
     * @param {Object} [registry=null] - Registro para limpieza
     * @returns {Chart|null}
     */
    function createStackedBarChart(canvasId, labels, datasets, options = {}, registry = null) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const styledDatasets = datasets.map((ds, i) => ({
            label: ds.label || `Serie ${i + 1}`,
            data: ds.data,
            backgroundColor: ds.backgroundColor || COLORS.palette[i % COLORS.palette.length],
            borderRadius: 4,
            maxBarThickness: 40,
            ...ds
        }));

        const chart = new Chart(canvas, {
            type: 'bar',
            data: { labels, datasets: styledDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { usePointStyle: true, padding: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        cornerRadius: 8,
                        mode: 'index'
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });

        if (registry) registry[canvasId] = chart;
        return chart;
    }

    /**
     * Crea un sparkline compacto para tarjetas KPI.
     * Sin ejes, sin leyenda, solo la línea con gradiente.
     *
     * @param {string} canvasId - ID del <canvas>
     * @param {number[]} dataPoints - Valores a graficar
     * @param {Object} [options={}] - {string} color
     * @param {Object} [registry=null] - Registro para limpieza
     * @returns {Chart|null}
     */
    function createSparkline(canvasId, dataPoints, optionsOrColor, registry = null) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        // Acepta color string directo o options object
        const options = (typeof optionsOrColor === 'string')
            ? { color: optionsOrColor }
            : (optionsOrColor || {});
        const color = options.color || COLORS.primary;

        const chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: dataPoints.map((_, i) => i),
                datasets: [{
                    data: dataPoints,
                    borderColor: color,
                    borderWidth: 2,
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const h = context.chart.height || 50;
                        const gradient = ctx.createLinearGradient(0, 0, 0, h);
                        gradient.addColorStop(0, _hexToRgba(color, 0.2));
                        gradient.addColorStop(1, _hexToRgba(color, 0));
                        return gradient;
                    },
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true, mode: 'index', intersect: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false, min: 0 }
                },
                layout: { padding: 0 }
            }
        });

        if (registry) registry[canvasId] = chart;
        return chart;
    }

    // ==================== GESTIÓN DE GRÁFICAS ====================

    /**
     * Destruye una gráfica específica del registro.
     * @param {string} chartId - ID de la gráfica
     * @param {Object} registry - Registro de gráficas
     */
    function destroyChart(chartId, registry) {
        if (registry && registry[chartId]) {
            registry[chartId].destroy();
            delete registry[chartId];
        }
    }

    /**
     * Destruye todas las gráficas en un registro.
     * @param {Object} registry - Registro de gráficas
     */
    function destroyAll(registry) {
        if (!registry) return;
        Object.keys(registry).forEach(key => {
            if (registry[key]) {
                registry[key].destroy();
                delete registry[key];
            }
        });
    }

    /**
     * Captura un canvas como imagen PNG en base64.
     * @param {string} canvasId - ID del <canvas>
     * @returns {string|null} Data URL en formato PNG
     */
    function captureAsImage(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        try {
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.warn('[Reportes.Charts] Error capturando imagen:', e);
            return null;
        }
    }

    // ==================== COMPONENTES HTML ====================

    /**
     * Genera el HTML de una tarjeta KPI con mini-gráfica y tendencia.
     *
     * @param {Object} params - Parámetros de la tarjeta:
     *   @param {string} params.title - Título del indicador
     *   @param {string|number} params.value - Valor principal
     *   @param {string} [params.subtitle] - Subtítulo descriptivo
     *   @param {string} params.icon - Clase del ícono Bootstrap (ej: 'bi-people')
     *   @param {string} params.color - Color Bootstrap (ej: 'primary', 'success')
     *   @param {string} [params.chartId] - ID del canvas para sparkline
     *   @param {number} [params.trend] - Porcentaje de tendencia
     *   @param {string} [params.trendLabel] - Texto de la tendencia
     *   @param {string} [params.onclick] - Handler de click
     * @returns {string} HTML de la tarjeta
     */
    function renderKPICard(params) {
        const {
            title = '', value = 0, subtitle = '', icon = 'bi-graph-up',
            color = 'primary', chartId = '', trend, trendLabel = 'vs periodo anterior',
            onclick = ''
        } = params;

        const clickAttr = onclick ? `onclick="${onclick}" style="cursor:pointer;"` : '';

        return `
        <div class="col-lg-3 col-md-6">
            <div class="card border-0 shadow-sm rounded-4 h-100 ${onclick ? 'hover-scale' : ''}" ${clickAttr}>
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <div class="text-muted small fw-bold text-uppercase" style="font-size:0.7rem;letter-spacing:0.05em;">${title}</div>
                            <div class="fs-3 fw-bold mt-1">${value}</div>
                            ${subtitle ? `<div class="text-muted small">${subtitle}</div>` : ''}
                        </div>
                        <div class="rounded-3 bg-${color} bg-opacity-10 p-2">
                            <i class="bi ${icon} text-${color} fs-5"></i>
                        </div>
                    </div>
                    ${chartId ? `<div style="height:50px;" class="mt-2"><canvas id="${chartId}"></canvas></div>` : ''}
                    ${trend !== undefined ? `
                    <div class="mt-2 pt-2 border-top">
                        <span class="badge ${trend >= 0 ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${trend >= 0 ? 'text-success' : 'text-danger'} rounded-pill small">
                            <i class="bi ${trend >= 0 ? 'bi-arrow-up' : 'bi-arrow-down'} me-1"></i>${Math.abs(trend)}%
                        </span>
                        <span class="text-muted small ms-1">${trendLabel}</span>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
    }

    /**
     * Genera el HTML de una tarjeta contenedora para gráficas.
     *
     * @param {string} title - Título de la gráfica
     * @param {string} canvasId - ID del <canvas>
     * @param {number} [height=250] - Altura en píxeles
     * @param {string} [colClass='col-lg-6'] - Clase CSS de columna
     * @returns {string} HTML de la tarjeta
     */
    function renderChartCard(title, canvasId, height, colClass) {
        return `
        <div class="${colClass || 'col-lg-6'}">
            <div class="card border-0 shadow-sm rounded-4 h-100">
                <div class="card-body">
                    <h6 class="fw-bold mb-3">${title}</h6>
                    <div style="height:${height || 250}px;position:relative;">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Genera el HTML de una tabla de datos colapsable con paginación cliente.
     * Muestra 25 registros por página con botones anterior/siguiente.
     *
     * @param {Object[]} columns - Definición de columnas [{key, label}]
     * @param {Object[]} rows - Datos a mostrar (arreglo de objetos)
     * @param {string} tableId - ID único para la tabla
     * @returns {string} HTML completo con collapse y tabla
     */
    function renderDataTable(columnsOrObj, rowsParam, tableIdParam) {
        // Soporta 2 formatos de llamada:
        // 1. renderDataTable({id, columns, rows})  — columns es array de strings, rows es array de arrays
        // 2. renderDataTable(columns, rows, tableId) — columns es array de {key, label}
        let columns, rows, tableId;

        if (columnsOrObj && typeof columnsOrObj === 'object' && !Array.isArray(columnsOrObj)) {
            // Formato objeto: {id, columns: ['Col1','Col2'], rows: [['val1','val2'], ...]}
            tableId = columnsOrObj.id;
            columns = (columnsOrObj.columns || []).map((c, i) => typeof c === 'string' ? { key: String(i), label: c } : c);
            rows = (columnsOrObj.rows || []).map(r => {
                if (Array.isArray(r)) {
                    const obj = {};
                    columns.forEach((col, i) => { obj[col.key] = r[i] || ''; });
                    return obj;
                }
                return r;
            });
        } else {
            // Formato posicional
            columns = (columnsOrObj || []).map(c => typeof c === 'string' ? { key: c, label: c } : c);
            rows = rowsParam || [];
            tableId = tableIdParam || 'table-' + Date.now();
        }

        const PAGE_SIZE = 25;
        const totalPages = Math.ceil(rows.length / PAGE_SIZE);
        const collapseId = `collapse-${tableId}`;
        const firstPageRows = rows.slice(0, PAGE_SIZE);

        return `
        <div class="table-responsive">
            <table class="table table-hover table-sm mb-0" id="${tableId}">
                <thead class="table-light">
                    <tr>
                        ${columns.map(col => `<th class="small fw-bold text-muted text-uppercase" style="font-size:0.7rem;letter-spacing:0.05em;">${col.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody id="${tableId}-body">
                    ${firstPageRows.map(row => `
                    <tr>
                        ${columns.map(col => `<td class="small">${_escapeHtml(String(row[col.key] ?? '--'))}</td>`).join('')}
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
        ${totalPages > 1 ? `
        <div class="d-flex justify-content-between align-items-center p-2 border-top">
            <span class="text-muted small">Mostrando ${Math.min(PAGE_SIZE, rows.length)} de ${rows.length} registros</span>
        </div>` : `
        <div class="p-2 border-top">
            <span class="text-muted small">${rows.length} registros</span>
        </div>`}`;
    }

    // ==================== UTILIDADES DE DATOS ====================

    /**
     * Formatea un número con separadores de miles en formato mexicano.
     * @param {number} n - Número a formatear
     * @returns {string}
     */
    function formatNumber(n) {
        if (n === null || n === undefined) return '0';
        return Number(n).toLocaleString('es-MX');
    }

    /**
     * Calcula la tendencia de un conjunto de datos agrupados por fecha.
     * Compara la segunda mitad del período contra la primera mitad.
     *
     * @param {Array} data - Arreglo de objetos con campo fecha
     * @param {string} [dateField='fecha'] - Nombre del campo de fecha
     * @returns {{counts: Object, percentage: number}}
     *   counts: {fecha_string: cantidad}
     *   percentage: cambio porcentual (segunda mitad vs primera mitad)
     */
    function calculateTrend(data, dateField) {
        const field = dateField || 'fecha';
        const counts = {};

        data.forEach(d => {
            const date = d[field] instanceof Date ? d[field] : new Date(d[field]);
            if (isNaN(date.getTime())) return;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        // Calcular porcentaje de tendencia
        const sortedKeys = Object.keys(counts).sort();
        const values = sortedKeys.map(k => counts[k]);
        let percentage = 0;

        if (values.length >= 2) {
            const mid = Math.floor(values.length / 2);
            const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0);
            const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0);

            if (firstHalf > 0) {
                percentage = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
            } else if (secondHalf > 0) {
                percentage = 100;
            }
        }

        return { counts, percentage };
    }

    // ==================== UTILIDADES PRIVADAS ====================

    /**
     * Convierte un color hexadecimal a rgba.
     * @param {string} hex - Color en formato #RRGGBB
     * @param {number} alpha - Opacidad (0-1)
     * @returns {string} Color en formato rgba()
     * @private
     */
    function _hexToRgba(hex, alpha) {
        if (!hex || typeof hex !== 'string') return `rgba(99, 102, 241, ${alpha})`;
        const cleaned = hex.replace('#', '');
        const r = parseInt(cleaned.substring(0, 2), 16) || 0;
        const g = parseInt(cleaned.substring(2, 4), 16) || 0;
        const b = parseInt(cleaned.substring(4, 6), 16) || 0;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Escapa caracteres HTML para prevenir XSS en tablas.
     * @param {string} str - Texto a escapar
     * @returns {string}
     * @private
     */
    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ==================== API PÚBLICA ====================

    return {
        // Creación de gráficas
        createLineChart,
        createBarChart,
        createDoughnutChart,
        createStackedBarChart,
        createSparkline,

        // Gestión de gráficas
        destroyChart,
        destroyAll,
        captureAsImage,

        // Componentes HTML
        renderKPICard,
        renderChartCard,
        renderDataTable,

        // Utilidades
        formatNumber,
        calculateTrend,

        // Paleta de colores
        COLORS
    };

})();
