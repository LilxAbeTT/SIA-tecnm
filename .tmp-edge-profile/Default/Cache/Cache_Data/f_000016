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
        const tipo = normalizeKey(d.tipo || '');
        const detalle = normalizeKey(d.detalle || '');
        const joined = `${tipo} ${detalle}`.trim();
        if (joined.includes('consulta')) return 'Consulta';
        if (/(prestamo.*libro|libro.*prestamo)/.test(joined)) return 'Prestamo de libro';
        if (/(devolucion.*libro|libro.*devolucion)/.test(joined)) return 'Devolucion de libro';
        if (joined.includes('individual')) return 'Trabajo individual';
        if (joined.includes('equipo') || joined.includes('grupal')) return 'Trabajo en equipo';
        if (/(uso\s*pc|pc\s*\d+|computadora|equipo de computo)/.test(joined)) return 'Uso de PC';
        if (/(mesa\s*\d+|uso de mesa|mesa individual|mesa de trabajo)/.test(joined)) return 'Uso de mesa';
        if (/(sala\s*\d+|uso de sala|cubiculo|espacio de sala)/.test(joined)) return 'Uso de sala';
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

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeKey(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function toTitleCase(value) {
        return String(value || '')
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    function normalizeGeneroLabel(value) {
        const key = normalizeKey(value);
        if (!key) return 'Sin dato';
        if (['masculino', 'masc', 'm', 'hombre', 'varon', 'male'].includes(key)) return 'Hombre';
        if (['femenino', 'fem', 'f', 'mujer', 'female'].includes(key)) return 'Mujer';
        if (['no binario', 'nobinario', 'no-binario', 'nb'].includes(key)) return 'No binario';
        if (['otro', 'prefiero no decir', 'prefiero no especificar'].includes(key)) return 'Otro';
        return toTitleCase(value);
    }

    function normalizeTurnoLabel(value) {
        const key = normalizeKey(value);
        if (!key) return 'Sin dato';
        if (key.includes('matutin')) return 'Matutino';
        if (key.includes('vespert')) return 'Vespertino';
        if (key.includes('nocturn')) return 'Nocturno';
        if (key.includes('mixt')) return 'Mixto';
        return toTitleCase(value);
    }

    function normalizeTipoUsuarioLabel(value) {
        const key = normalizeKey(value);
        if (!key) return 'Sin dato';
        if (/(docente|profesor|maestro|catedratic|academico)/.test(key)) return 'Docente';
        if (/(administrativ|operativ|personal)/.test(key)) return 'Personal';
        if (/(visitante|extern)/.test(key)) return 'Externo';
        if (/(estudiante|alumno)/.test(key)) return 'Estudiante';
        return toTitleCase(value);
    }

    function normalizeCarreraLabel(value) {
        const raw = String(value || '').trim();
        if (!raw || normalizeKey(raw) === 'n/a') return 'Sin dato';
        return raw;
    }

    function normalizeGeneracionLabel(value) {
        const numeric = Number.parseInt(value, 10);
        if (Number.isFinite(numeric)) return String(numeric).slice(-2);
        const raw = String(value || '').trim();
        return raw || 'Sin dato';
    }

    function hexToRgba(hex, alpha) {
        const clean = String(hex || '').replace('#', '').trim();
        if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return `rgba(99, 102, 241, ${alpha})`;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function formatHourLabel(hour) {
        const numeric = Number.parseInt(hour, 10);
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 23) return 'N/D';
        return `${String(numeric).padStart(2, '0')}:00`;
    }

    function buildCountEntries(data, getter, options = {}) {
        const {
            normalizer = (value) => value,
            includeMissing = false,
            missingLabel = 'Sin dato',
            sort = 'count'
        } = options;
        const counts = {};

        (data || []).forEach((item) => {
            const rawValue = getter(item);
            const normalized = normalizer(rawValue);
            const label = (normalized == null || normalized === '') ? missingLabel : String(normalized).trim();
            if (!includeMissing && label === missingLabel) return;
            counts[label] = (counts[label] || 0) + 1;
        });

        const entries = Object.entries(counts).map(([label, count]) => ({ label, count }));
        if (sort === 'alpha') {
            entries.sort((a, b) => a.label.localeCompare(b.label, 'es'));
        } else if (sort === 'generation') {
            entries.sort((a, b) => Number.parseInt(b.label, 10) - Number.parseInt(a.label, 10));
        } else {
            entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
        }
        return entries;
    }

    function buildDayHourRows(data) {
        const grouped = {};

        (data || []).forEach((item) => {
            const date = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
            if (isNaN(date)) return;

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            const hourLabel = formatHourLabel(Number.isFinite(Number.parseInt(item.hora, 10)) ? item.hora : date.getHours());

            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    date,
                    total: 0,
                    hours: {}
                };
            }

            grouped[dateKey].total += 1;
            grouped[dateKey].hours[hourLabel] = (grouped[dateKey].hours[hourLabel] || 0) + 1;
        });

        return Object.entries(grouped)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
            .map(([dateKey, value]) => ({
                dateKey,
                dateLabel: value.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }),
                total: value.total,
                hours: Object.entries(value.hours)
                    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
                    .map(([label, count]) => ({ label, count }))
            }));
    }

    function resolveVisibleWeekSlice(data, state = {}) {
        const safeData = Array.isArray(data) ? data : [];
        if (!safeData.length) {
            return {
                records: [],
                subtitle: 'Sin visitas en la semana visible.'
            };
        }

        const referenceDate = state.dateEnd instanceof Date
            ? new Date(state.dateEnd)
            : new Date(Math.max(...safeData.map((item) => {
                const date = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
                return isNaN(date) ? 0 : date.getTime();
            })));

        if (isNaN(referenceDate)) {
            return {
                records: safeData,
                subtitle: 'Semana visible actual.'
            };
        }

        const start = new Date(referenceDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        const records = safeData.filter((item) => {
            const date = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
            if (isNaN(date)) return false;
            return date >= start && date <= end;
        });

        return {
            records,
            subtitle: `Semana visible: ${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} al ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
        };
    }

    function chartsSafeNumber(value) {
        const charts = H();
        return charts && typeof charts.formatNumber === 'function'
            ? charts.formatNumber(value)
            : String(value ?? 0);
    }

    function renderMetricCard({ title, value, subtitle = '', icon = 'bi-bar-chart', accent = '#6366f1', canvasId = '', colClass = 'col-xl-4 col-md-6' }) {
        return `
            <div class="${colClass}">
                <div class="card border-0 shadow-sm rounded-4 h-100 reportes-biblio-metric-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start gap-3">
                            <div class="min-w-0">
                                <div class="text-muted small fw-bold text-uppercase reportes-biblio-kicker">${escapeHtml(title)}</div>
                                <div class="display-6 fw-bold text-dark mb-1 reportes-biblio-metric-value">${escapeHtml(value)}</div>
                                ${subtitle ? `<div class="text-muted small">${escapeHtml(subtitle)}</div>` : ''}
                            </div>
                            <div class="reportes-biblio-icon-wrap" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">
                                <i class="bi ${escapeHtml(icon)} fs-5"></i>
                            </div>
                        </div>
                        ${canvasId ? `<div class="reportes-biblio-sparkline mt-3"><canvas id="${escapeHtml(canvasId)}"></canvas></div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderBreakdownCard({ title, value, subtitle = '', icon = 'bi-list-ul', accent = '#6366f1', rows = [], emptyText = 'Sin datos en el periodo.' }) {
        const safeRows = Array.isArray(rows) ? rows : [];
        return `
            <div class="col-xl-3 col-md-6">
                <div class="card border-0 shadow-sm rounded-4 h-100 reportes-biblio-summary-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                            <div class="min-w-0">
                                <div class="text-muted small fw-bold text-uppercase reportes-biblio-kicker">${escapeHtml(title)}</div>
                                <div class="fs-3 fw-bold text-dark mb-1">${escapeHtml(value)}</div>
                                ${subtitle ? `<div class="text-muted small">${escapeHtml(subtitle)}</div>` : ''}
                            </div>
                            <div class="reportes-biblio-icon-wrap" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">
                                <i class="bi ${escapeHtml(icon)} fs-5"></i>
                            </div>
                        </div>
                        <div class="d-flex flex-column gap-2">
                            ${safeRows.length ? safeRows.map((row) => `
                                <div class="reportes-biblio-mini-row">
                                    <span class="text-muted small">${escapeHtml(row.label)}</span>
                                    <span class="badge rounded-pill" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">${escapeHtml(row.value)}</span>
                                </div>
                            `).join('') : `<div class="text-muted small">${escapeHtml(emptyText)}</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderRankListCard({ title, subtitle = '', icon = 'bi-table', accent = '#6366f1', rows = [], emptyText = 'Sin datos en el periodo.', colClass = 'col-lg-6' }) {
        const safeRows = Array.isArray(rows) ? rows : [];
        const maxCount = safeRows.reduce((current, row) => Math.max(current, row.count || 0), 0) || 1;

        return `
            <div class="${colClass}">
                <div class="card border-0 shadow-sm rounded-4 h-100 reportes-biblio-list-card">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                            <div class="min-w-0">
                                <h6 class="fw-bold mb-1">${escapeHtml(title)}</h6>
                                ${subtitle ? `<div class="text-muted small">${escapeHtml(subtitle)}</div>` : ''}
                            </div>
                            <div class="reportes-biblio-icon-wrap reportes-biblio-icon-wrap-sm" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">
                                <i class="bi ${escapeHtml(icon)}"></i>
                            </div>
                        </div>
                        <div class="reportes-biblio-list-scroll pe-1">
                            ${safeRows.length ? safeRows.map((row, index) => {
            const pct = row.total > 0 ? ((row.count / row.total) * 100) : 0;
            const width = Math.max(8, Math.round((row.count / maxCount) * 100));
            return `
                                    <div class="reportes-biblio-rank-row">
                                        <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
                                            <div class="min-w-0">
                                                <div class="fw-semibold text-dark">${escapeHtml(row.label)}</div>
                                                <div class="text-muted small">${escapeHtml(chartsSafeNumber(row.count))} visitas · ${pct.toFixed(1)}%</div>
                                            </div>
                                            <span class="badge rounded-pill" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">#${index + 1}</span>
                                        </div>
                                        <div class="progress reportes-biblio-progress">
                                            <div class="progress-bar" role="progressbar" style="width:${width}%; background:${accent};"></div>
                                        </div>
                                    </div>
                                `;
        }).join('') : `<div class="text-muted small">${escapeHtml(emptyText)}</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderDayHourCard({ title, subtitle = '', icon = 'bi-clock-history', accent = '#6366f1', rows = [], emptyText = 'Sin registros de visitas para mostrar.' }) {
        const safeRows = Array.isArray(rows) ? rows : [];
        return `
            <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100 reportes-biblio-list-card">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                            <div class="min-w-0">
                                <h6 class="fw-bold mb-1">${escapeHtml(title)}</h6>
                                ${subtitle ? `<div class="text-muted small">${escapeHtml(subtitle)}</div>` : ''}
                            </div>
                            <div class="reportes-biblio-icon-wrap reportes-biblio-icon-wrap-sm" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">
                                <i class="bi ${escapeHtml(icon)}"></i>
                            </div>
                        </div>
                        <div class="reportes-biblio-list-scroll pe-1">
                            ${safeRows.length ? safeRows.map((row) => `
                                <div class="reportes-biblio-day-row">
                                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                                        <div class="min-w-0">
                                            <div class="fw-semibold text-dark text-capitalize">${escapeHtml(row.dateLabel)}</div>
                                            <div class="text-muted small">${escapeHtml(row.hours.length)} horas con registro</div>
                                        </div>
                                        <span class="badge rounded-pill" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">${escapeHtml(chartsSafeNumber(row.total))} visitas</span>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        ${row.hours.map((hourRow) => `
                                            <span class="reportes-biblio-hour-chip" style="background:${hexToRgba(accent, 0.08)}; border-color:${hexToRgba(accent, 0.16)};">
                                                <strong>${escapeHtml(hourRow.label)}</strong>
                                                <span>${escapeHtml(chartsSafeNumber(hourRow.count))}</span>
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('') : `<div class="text-muted small">${escapeHtml(emptyText)}</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBadgeGroupCard({ title, subtitle = '', icon = 'bi-calendar-week', accent = '#6366f1', rows = [], emptyText = 'Sin datos para mostrar.' }) {
        const safeRows = Array.isArray(rows) ? rows : [];
        return `
            <div class="col-lg-6">
                <div class="card border-0 shadow-sm rounded-4 h-100 reportes-biblio-list-card">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                            <div class="min-w-0">
                                <h6 class="fw-bold mb-1">${escapeHtml(title)}</h6>
                                ${subtitle ? `<div class="text-muted small">${escapeHtml(subtitle)}</div>` : ''}
                            </div>
                            <div class="reportes-biblio-icon-wrap reportes-biblio-icon-wrap-sm" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">
                                <i class="bi ${escapeHtml(icon)}"></i>
                            </div>
                        </div>
                        <div class="reportes-biblio-list-scroll pe-1">
                            ${safeRows.length ? safeRows.map((row) => `
                                <div class="reportes-biblio-day-row">
                                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                                        <div class="min-w-0">
                                            <div class="fw-semibold text-dark">${escapeHtml(row.label)}</div>
                                            ${row.meta ? `<div class="text-muted small">${escapeHtml(row.meta)}</div>` : ''}
                                        </div>
                                        <span class="badge rounded-pill" style="background:${hexToRgba(accent, 0.14)}; color:${accent};">${escapeHtml(chartsSafeNumber(row.total || 0))}</span>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        ${(row.badges || []).map((badge) => `
                                            <span class="reportes-biblio-hour-chip" style="background:${hexToRgba(accent, 0.08)}; border-color:${hexToRgba(accent, 0.16)};">
                                                <strong>${escapeHtml(badge.label)}</strong>
                                                <span>${escapeHtml(chartsSafeNumber(badge.value))}</span>
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('') : `<div class="text-muted small">${escapeHtml(emptyText)}</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBiblioSharedStyles() {
        return `
            <style>
                .reportes-biblio-kicker {
                    font-size: 0.72rem;
                    letter-spacing: 0.05em;
                }

                .reportes-biblio-metric-card,
                .reportes-biblio-summary-card,
                .reportes-biblio-list-card {
                    background: linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%);
                }

                .reportes-biblio-metric-value {
                    line-height: 1;
                }

                .reportes-biblio-icon-wrap {
                    width: 46px;
                    height: 46px;
                    border-radius: 16px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .reportes-biblio-icon-wrap-sm {
                    width: 40px;
                    height: 40px;
                    border-radius: 14px;
                }

                .reportes-biblio-sparkline {
                    height: 54px;
                }

                .reportes-biblio-mini-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.7rem 0.8rem;
                    border-radius: 16px;
                    background: #f8fafc;
                }

                .reportes-biblio-list-scroll {
                    max-height: 460px;
                    overflow: auto;
                }

                .reportes-biblio-rank-row,
                .reportes-biblio-day-row {
                    padding: 0.95rem 0;
                }

                .reportes-biblio-rank-row + .reportes-biblio-rank-row,
                .reportes-biblio-day-row + .reportes-biblio-day-row {
                    border-top: 1px solid #eef2f7;
                }

                .reportes-biblio-progress {
                    height: 8px;
                    border-radius: 999px;
                    background: #eef2f7;
                }

                .reportes-biblio-hour-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.55rem;
                    padding: 0.45rem 0.7rem;
                    border: 1px solid transparent;
                    border-radius: 999px;
                    font-size: 0.83rem;
                    color: #334155;
                }

                .reportes-biblio-hour-chip strong {
                    font-weight: 700;
                    color: #0f172a;
                }

                @media (max-width: 991.98px) {
                    .reportes-biblio-list-scroll {
                        max-height: none;
                    }
                }
            </style>
        `;
    }

    function renderVisitasLayout({
        charts,
        total,
        days,
        avgDay,
        peakDay,
        peakHour,
        peakHourCount,
        generoEntries,
        turnoEntries,
        docenteCount,
        personalCount,
        otherProfiles,
        topCarreras,
        topCarrerasTotal,
        weekSubtitle,
        dayHourRows,
        motiveRows,
        carreraRows,
        generacionRows
    }) {
        const generoTotal = generoEntries.reduce((sum, item) => sum + item.count, 0);
        const turnoTotal = turnoEntries.reduce((sum, item) => sum + item.count, 0);

        return `
            <div class="d-flex flex-column gap-4 pb-5">
                <div class="row g-3">
                    ${renderMetricCard({
            title: 'Total visitas',
            value: chartsSafeNumber(total),
            subtitle: `${chartsSafeNumber(days)} dias con registros`,
            icon: 'bi-door-open',
            accent: charts.COLORS.warning,
            canvasId: 'biblio-visit-spark-total'
        })}
                    ${renderMetricCard({
            title: 'Promedio diario',
            value: avgDay,
            subtitle: peakDay !== 'N/D' ? `Dia mas alto: ${peakDay}` : 'Sin suficiente historial',
            icon: 'bi-graph-up-arrow',
            accent: charts.COLORS.info
        })}
                    ${renderMetricCard({
            title: 'Hora pico',
            value: peakHour,
            subtitle: peakHourCount > 0 ? `${chartsSafeNumber(peakHourCount)} visitas en esa hora` : 'Sin suficiente historial',
            icon: 'bi-clock-history',
            accent: charts.COLORS.primary
        })}
                </div>

                <div class="row g-3">
                    ${renderBreakdownCard({
            title: 'Visitas por genero',
            value: chartsSafeNumber(generoTotal),
            subtitle: 'Registros con genero identificado',
            icon: 'bi-gender-ambiguous',
            accent: charts.COLORS.pink,
            rows: generoEntries.slice(0, 4).map((item) => ({ label: item.label, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Visitas por turno',
            value: chartsSafeNumber(turnoTotal),
            subtitle: 'Turnos detectados en el periodo',
            icon: 'bi-sunrise',
            accent: charts.COLORS.teal,
            rows: turnoEntries.slice(0, 4).map((item) => ({ label: item.label, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Docente / personal',
            value: chartsSafeNumber(docenteCount + personalCount),
            subtitle: 'Docentes y personal academico/administrativo',
            icon: 'bi-people',
            accent: charts.COLORS.primary,
            rows: [
                { label: 'Docentes', value: chartsSafeNumber(docenteCount) },
                { label: 'Personal', value: chartsSafeNumber(personalCount) },
                ...(otherProfiles > 0 ? [{ label: 'Otros perfiles', value: chartsSafeNumber(otherProfiles) }] : [])
            ]
        })}
                    ${renderBreakdownCard({
            title: 'Carreras top 3',
            value: chartsSafeNumber(topCarrerasTotal),
            subtitle: 'Las carreras con mas visitas',
            icon: 'bi-mortarboard',
            accent: charts.COLORS.warning,
            rows: topCarreras.map((item, index) => ({ label: `${index + 1}. ${item.label}`, value: chartsSafeNumber(item.count) })),
            emptyText: 'Sin carreras identificadas en el periodo.'
        })}
                </div>

                <div class="row g-4">
                    ${renderDayHourCard({
            title: 'Visitas por dia y hora',
            subtitle: weekSubtitle || 'Cada fecha muestra solo las horas en las que si hubo actividad.',
            icon: 'bi-calendar-week',
            accent: charts.COLORS.warning,
            rows: dayHourRows
        })}
                    ${renderRankListCard({
            title: 'Distribucion por motivo',
            subtitle: 'Listado ordenado de mayor a menor numero de visitas.',
            icon: 'bi-list-check',
            accent: charts.COLORS.primary,
            rows: motiveRows
        })}
                    ${renderRankListCard({
            title: 'Distribucion de carreras',
            subtitle: 'Todas las carreras con visitas registradas en el periodo.',
            icon: 'bi-collection',
            accent: charts.COLORS.teal,
            rows: carreraRows
        })}
                    ${renderRankListCard({
            title: 'Distribucion de generaciones',
            subtitle: 'Generaciones detectadas en el rango actual.',
            icon: 'bi-calendar-range',
            accent: charts.COLORS.info,
            rows: generacionRows
        })}
                </div>

                ${renderBiblioSharedStyles()}
            </div>
        `;
    }

    function renderPrestamosLayout({
        charts,
        total,
        activos,
        retrasos,
        deudaTotal,
        uniqueTitles,
        pendientes,
        topCarreras,
        weekRows,
        topBookRows,
        statusRows,
        carreraRows,
        origenRows
    }) {
        return `
            <div class="d-flex flex-column gap-4 pb-5">
                <div class="row g-3">
                    ${renderMetricCard({ title: 'Total prestamos', value: chartsSafeNumber(total), subtitle: 'Movimientos registrados en el periodo', icon: 'bi-book', accent: charts.COLORS.primary, colClass: 'col-xl-3 col-md-6' })}
                    ${renderMetricCard({ title: 'Activos', value: chartsSafeNumber(activos), subtitle: 'Prestamos vigentes o pendientes', icon: 'bi-bookmark-check', accent: charts.COLORS.success, colClass: 'col-xl-3 col-md-6' })}
                    ${renderMetricCard({ title: 'Adeudos / retrasos', value: chartsSafeNumber(retrasos), subtitle: 'Con atraso o multa detectada', icon: 'bi-exclamation-triangle', accent: charts.COLORS.danger, colClass: 'col-xl-3 col-md-6' })}
                    ${renderMetricCard({ title: 'Deuda estimada', value: `$${chartsSafeNumber(deudaTotal.toFixed ? deudaTotal.toFixed(2) : deudaTotal)}`, subtitle: 'Monto acumulado de multas y adeudos', icon: 'bi-cash-coin', accent: charts.COLORS.warning, colClass: 'col-xl-3 col-md-6' })}
                </div>

                <div class="row g-3">
                    ${renderBreakdownCard({
            title: 'Titulos unicos',
            value: chartsSafeNumber(uniqueTitles),
            subtitle: 'Material distinto solicitado',
            icon: 'bi-collection',
            accent: charts.COLORS.info,
            rows: topBookRows.slice(0, 3).map((item, index) => ({ label: `${index + 1}. ${item.label}`, value: chartsSafeNumber(item.count) })),
            emptyText: 'Sin prestamos registrados.'
        })}
                    ${renderBreakdownCard({
            title: 'Pendientes y no recogidos',
            value: chartsSafeNumber(pendientes),
            subtitle: 'Seguimiento operativo pendiente',
            icon: 'bi-hourglass-split',
            accent: charts.COLORS.warning,
            rows: statusRows.filter((item) => ['Pendiente', 'No recogido', 'Cancelado'].includes(item.label)).map((item) => ({ label: item.label, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Carreras top 3',
            value: chartsSafeNumber(topCarreras.reduce((sum, item) => sum + item.count, 0)),
            subtitle: 'Mayor demanda de prestamos',
            icon: 'bi-mortarboard',
            accent: charts.COLORS.primary,
            rows: topCarreras.map((item, index) => ({ label: `${index + 1}. ${item.label}`, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Origen del prestamo',
            value: chartsSafeNumber(origenRows.reduce((sum, item) => sum + item.count, 0)),
            subtitle: 'Canales usados para solicitar material',
            icon: 'bi-diagram-3',
            accent: charts.COLORS.teal,
            rows: origenRows.slice(0, 4).map((item) => ({ label: item.label, value: chartsSafeNumber(item.count) }))
        })}
                </div>

                <div class="row g-4">
                    ${renderBadgeGroupCard({
            title: 'Prestamos por semana y estado',
            subtitle: 'Cada semana resume los estados que si tuvieron movimiento.',
            icon: 'bi-calendar-range',
            accent: charts.COLORS.primary,
            rows: weekRows,
            emptyText: 'Sin semanas con movimientos.'
        })}
                    ${renderRankListCard({
            title: 'Top libros mas solicitados',
            subtitle: 'Titulos con mayor demanda acumulada.',
            icon: 'bi-journal-bookmark',
            accent: charts.COLORS.info,
            rows: topBookRows
        })}
                    ${renderRankListCard({
            title: 'Estado de prestamos',
            subtitle: 'Panorama de la cartera actual del periodo.',
            icon: 'bi-kanban',
            accent: charts.COLORS.warning,
            rows: statusRows
        })}
                    ${renderRankListCard({
            title: 'Carreras con mas prestamos',
            subtitle: 'Distribucion academica de la demanda.',
            icon: 'bi-people',
            accent: charts.COLORS.teal,
            rows: carreraRows
        })}
                </div>

                ${renderBiblioSharedStyles()}
            </div>
        `;
    }

    function renderCatalogoLayout({
        charts,
        totalTitulos,
        sinCopias,
        totalCategorias,
        activosCatalogo,
        categoriasTop,
        autoresTop,
        disponibilidadRows,
        categoriasRows,
        autoresRows,
        activosRows
    }) {
        return `
            <div class="d-flex flex-column gap-4 pb-5">
                <div class="row g-3">
                    ${renderMetricCard({ title: 'Total titulos', value: chartsSafeNumber(totalTitulos), subtitle: 'Acervo bibliografico cargado', icon: 'bi-collection', accent: charts.COLORS.primary, colClass: 'col-xl-3 col-md-6' })}
                    ${renderMetricCard({ title: 'Sin copias disponibles', value: chartsSafeNumber(sinCopias), subtitle: 'Titulos agotados en este momento', icon: 'bi-x-circle', accent: charts.COLORS.danger, colClass: 'col-xl-3 col-md-6' })}
                    ${renderMetricCard({ title: 'Categorias unicas', value: chartsSafeNumber(totalCategorias), subtitle: 'Clasificaciones detectadas', icon: 'bi-tags', accent: charts.COLORS.info, colClass: 'col-xl-3 col-md-6' })}
                    ${renderMetricCard({ title: 'Titulos activos', value: chartsSafeNumber(activosCatalogo), subtitle: 'Disponibles para operacion normal', icon: 'bi-check2-circle', accent: charts.COLORS.success, colClass: 'col-xl-3 col-md-6' })}
                </div>

                <div class="row g-3">
                    ${renderBreakdownCard({
            title: 'Categorias top 3',
            value: chartsSafeNumber(categoriasTop.reduce((sum, item) => sum + item.count, 0)),
            subtitle: 'Mayor volumen editorial',
            icon: 'bi-stack',
            accent: charts.COLORS.primary,
            rows: categoriasTop.map((item, index) => ({ label: `${index + 1}. ${item.label}`, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Autores top 3',
            value: chartsSafeNumber(autoresTop.reduce((sum, item) => sum + item.count, 0)),
            subtitle: 'Autores con mas titulos',
            icon: 'bi-person-vcard',
            accent: charts.COLORS.info,
            rows: autoresTop.map((item, index) => ({ label: `${index + 1}. ${item.label}`, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Disponibilidad',
            value: chartsSafeNumber(disponibilidadRows.reduce((sum, item) => sum + item.count, 0)),
            subtitle: 'Situacion general del catalogo',
            icon: 'bi-book-half',
            accent: charts.COLORS.warning,
            rows: disponibilidadRows.map((item) => ({ label: item.label, value: chartsSafeNumber(item.count) }))
        })}
                    ${renderBreakdownCard({
            title: 'Activos de biblioteca',
            value: chartsSafeNumber(activosRows.reduce((sum, item) => sum + item.count, 0)),
            subtitle: 'Estado operativo de equipos y espacios',
            icon: 'bi-pc-display',
            accent: charts.COLORS.teal,
            rows: activosRows.slice(0, 4).map((item) => ({ label: item.label, value: chartsSafeNumber(item.count) })),
            emptyText: 'Sin estado de activos disponible.'
        })}
                </div>

                <div class="row g-4">
                    ${renderRankListCard({
            title: 'Distribucion de categorias',
            subtitle: 'Categorias ordenadas por volumen de titulos.',
            icon: 'bi-diagram-2',
            accent: charts.COLORS.primary,
            rows: categoriasRows
        })}
                    ${renderRankListCard({
            title: 'Autores con mas titulos',
            subtitle: 'Concentracion de autores en el acervo.',
            icon: 'bi-person-lines-fill',
            accent: charts.COLORS.info,
            rows: autoresRows
        })}
                    ${renderRankListCard({
            title: 'Disponibilidad del catalogo',
            subtitle: 'Titulos con y sin copias para prestamo.',
            icon: 'bi-bookmark',
            accent: charts.COLORS.warning,
            rows: disponibilidadRows
        })}
                    ${renderRankListCard({
            title: 'Estado de activos',
            subtitle: 'Resumen de activos tecnologicos y espacios.',
            icon: 'bi-cpu',
            accent: charts.COLORS.teal,
            rows: activosRows
        })}
                </div>

                ${renderBiblioSharedStyles()}
            </div>
        `;
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
        const state = S();
        const visits = data.filter(d => d.subarea === 'Visitas');
        const charts = H();
        const _charts = R();

        const dayMap = groupByDay(visits);
        const hours = groupByHour(visits);
        const total = visits.length;
        const days = total > 0 ? countDistinctDays(visits) : 0;
        const avgDay = days > 0 ? (total / days).toFixed(1) : '0';
        const peakDay = total > 0 ? getPeakDay(dayMap) : 'N/D';
        const peakHour = total > 0 ? getPeakHour(hours) : 'N/D';
        const durProm = calcDuracionPromedio(visits);
        const durStr = durProm !== null ? `${durProm} min` : 'N/D';

        const peakHourCount = Math.max(...hours, 0);
        const sparkDayKeys = Object.keys(dayMap).sort();
        const sparklineData = sparkDayKeys.map(k => dayMap[k]);
        const generoEntries = buildCountEntries(visits, (item) => item.genero, { normalizer: normalizeGeneroLabel });
        const turnoEntries = buildCountEntries(visits, (item) => item.turno, { normalizer: normalizeTurnoLabel });
        const tipoUsuarioEntries = buildCountEntries(visits, (item) => item.tipoUsuario, {
            normalizer: normalizeTipoUsuarioLabel,
            includeMissing: true
        });
        const motiveEntries = buildCountEntries(visits, (item) => classifyVisitMotive(item), { includeMissing: true });
        const carreraEntries = buildCountEntries(visits, (item) => item.carrera, { normalizer: normalizeCarreraLabel });
        const generacionEntries = buildCountEntries(visits, (item) => item.generacion, {
            normalizer: normalizeGeneracionLabel,
            sort: 'generation'
        });
        const visibleWeek = resolveVisibleWeekSlice(visits, state);
        const dayHourRows = buildDayHourRows(visibleWeek.records);
        const docenteCount = tipoUsuarioEntries.find((item) => item.label === 'Docente')?.count || 0;
        const personalCount = tipoUsuarioEntries.find((item) => item.label === 'Personal')?.count || 0;
        const topCarreras = carreraEntries.slice(0, 3);
        const topCarrerasTotal = topCarreras.reduce((sum, item) => sum + item.count, 0);
        const otherProfiles = tipoUsuarioEntries
            .filter((item) => !['Docente', 'Personal'].includes(item.label))
            .reduce((sum, item) => sum + item.count, 0);
        const totalForLists = total || 1;
        const motiveRows = motiveEntries.map((item) => ({ ...item, total: totalForLists }));
        const carreraRows = carreraEntries.map((item) => ({ ...item, total: totalForLists }));
        const generacionRows = generacionEntries.map((item) => ({ ...item, total: totalForLists }));

        container.innerHTML = renderVisitasLayout({
            charts,
            total,
            days,
            avgDay,
            peakDay,
            peakHour,
            peakHourCount,
            generoEntries,
            turnoEntries,
            docenteCount,
            personalCount,
            otherProfiles,
            topCarreras,
            topCarrerasTotal,
            weekSubtitle: visibleWeek.subtitle,
            dayHourRows,
            motiveRows,
            carreraRows,
            generacionRows
        });

        setTimeout(() => {
            if (document.getElementById('biblio-visit-spark-total')) {
                _charts['biblio-visit-spark-total'] = charts.createSparkline(
                    'biblio-visit-spark-total', sparklineData, charts.COLORS.warning
                );
            }
        }, 50);

        return;

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

        const topBookRows = topLibros.map(([label, count]) => ({ label, count, total: total || 1 }));
        const statusRows = statusOrder.map((label) => ({ label, count: statusMap[label] || 0, total: total || 1 }));
        const carreraRows = buildCountEntries(loans, (item) => item.carrera, { normalizer: normalizeCarreraLabel })
            .map((item) => ({ ...item, total: total || 1 }));
        const origenRows = buildCountEntries(loans, (item) => item.origenPrestamo || 'Sin dato', { includeMissing: true })
            .map((item) => ({ ...item, total: total || 1 }));
        const weekRows = weekKeys
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map((key) => {
                const currentWeek = weekMap[key] || {};
                const totalWeek = Object.values(currentWeek).reduce((sum, value) => sum + value, 0);
                return {
                    label: `Semana del ${new Date(key + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`,
                    meta: `${Object.keys(currentWeek).length} estados con movimiento`,
                    total: totalWeek,
                    badges: statusOrder
                        .filter((status) => currentWeek[status] > 0)
                        .map((status) => ({ label: status, value: currentWeek[status] }))
                };
            });
        const uniqueTitles = new Set(loans.map((item) => item.detalle || item.tituloLibro).filter(Boolean)).size;
        const pendientes = (statusMap['Pendiente'] || 0) + (statusMap['No recogido'] || 0) + (statusMap['Cancelado'] || 0);

        container.innerHTML = renderPrestamosLayout({
            charts,
            total,
            activos,
            retrasos,
            deudaTotal: montoMultas,
            uniqueTitles,
            pendientes,
            topCarreras: carreraRows.slice(0, 3),
            weekRows,
            topBookRows,
            statusRows,
            carreraRows,
            origenRows
        });

        return;

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
        const activosBiblioteca = Array.isArray(state.extraData?.activos) ? state.extraData.activos : [];
        const activosCatalogo = catalogo.filter((item) => item.active !== false).length;
        const categoriasRows = sortedCats.map(([label, count]) => ({ label, count, total: totalTitulos || 1 }));
        const autoresRows = buildCountEntries(catalogo, (item) => item.autor || 'Desconocido', { includeMissing: true })
            .map((item) => ({ ...item, total: totalTitulos || 1 }));
        const disponibilidadRows = [
            { label: 'Con disponibilidad', count: catalogo.filter((item) => Number(item.copiasDisponibles || 0) > 0).length, total: totalTitulos || 1 },
            { label: 'Sin copias', count: sinCopias, total: totalTitulos || 1 },
            { label: 'Inactivos', count: catalogo.filter((item) => item.active === false).length, total: totalTitulos || 1 }
        ];
        const activosRows = buildCountEntries(activosBiblioteca, (item) => item.status || 'Sin estado', { includeMissing: true })
            .map((item) => ({ ...item, total: activosBiblioteca.length || 1 }));

        container.innerHTML = renderCatalogoLayout({
            charts,
            totalTitulos,
            sinCopias,
            totalCategorias: totalCats,
            activosCatalogo,
            categoriasTop: categoriasRows.slice(0, 3),
            autoresTop: autoresRows.slice(0, 3),
            disponibilidadRows,
            categoriasRows,
            autoresRows,
            activosRows
        });

        return;

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
