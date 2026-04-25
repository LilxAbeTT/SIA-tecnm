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
    const ACADEMIC_CROSS_MODAL_ID = 'biblioAcademicCrossModal';
    const ACADEMIC_CROSS_FIELDS = [
        { key: 'generacion', label: 'Generacion' },
        { key: 'carrera', label: 'Carrera' },
        { key: 'genero', label: 'Genero' },
        { key: 'turno', label: 'Turno' },
        { key: 'tipoUsuario', label: 'Tipo de usuario' }
    ];
    const ACADEMIC_CROSS_PERIODS = [
        { id: 'current', label: 'Periodo actual' },
        { id: 'daily', label: 'Hoy' },
        { id: 'monthly', label: 'Mes' },
        { id: 'quarterly', label: 'Trimestre' },
        { id: 'custom', label: 'Entre fechas' }
    ];
    const ACADEMIC_CROSS_DEFAULTS = {
        visitas: { primary: 'generacion', secondary: 'carrera', tertiary: 'genero' },
        prestamos: { primary: 'generacion', secondary: 'carrera', tertiary: 'genero' }
    };
    let _academicCrossState = {
        selections: {
            visitas: { ...ACADEMIC_CROSS_DEFAULTS.visitas },
            prestamos: { ...ACADEMIC_CROSS_DEFAULTS.prestamos }
        },
        periodByTab: {
            visitas: 'current',
            prestamos: 'current'
        },
        periodMetaByTab: {
            visitas: null,
            prestamos: null
        },
        matrix: null,
        exportPayload: null,
        dateStart: null,
        dateEnd: null,
        periodLabel: 'Periodo actual',
        activeTab: 'visitas'
    };

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

    function getAcademicCrossFields(tab) {
        if (tab === 'prestamos') {
            return ACADEMIC_CROSS_FIELDS.filter((field) => field.key !== 'tipoUsuario');
        }
        return ACADEMIC_CROSS_FIELDS;
    }

    function getAcademicCrossFieldLabel(key, tab) {
        return getAcademicCrossFields(tab).find((field) => field.key === key)?.label || key;
    }

    function getCurrentBiblioTabContext() {
        const state = S();
        const tab = state.currentTab || 'visitas';
        const tabMeta = (state.areas?.BIBLIO?.tabs || getTabs()).find((item) => item.id === tab) || getTabs()[0];
        const source = Array.isArray(state.filteredData) ? state.filteredData : [];

        if (tab === 'visitas') {
            return {
                tab,
                tabLabel: tabMeta?.label || 'Visitas',
                supported: true,
                records: source.filter((item) => item.subarea === 'Visitas')
            };
        }

        if (tab === 'prestamos') {
            return {
                tab,
                tabLabel: tabMeta?.label || 'Prestamos',
                supported: true,
                records: source.filter((item) => item.subarea === 'PrÃ©stamos')
            };
        }

        return {
            tab,
            tabLabel: tabMeta?.label || 'Catalogo',
            supported: false,
            records: []
        };
    }

    async function resolveAcademicCrossDataset(context, period, periodMeta = {}) {
        const range = getAcademicCrossRange(period, periodMeta);
        const state = S();

        if (period === 'current') {
            return {
                period: range.period,
                periodLabel: range.label,
                dateStart: range.start,
                dateEnd: range.end,
                records: context.records
            };
        }

        if (!window.ReportesService || !state.ctx) {
            return {
                period: range.period,
                periodLabel: range.label,
                dateStart: range.start,
                dateEnd: range.end,
                records: []
            };
        }

        const allData = await window.ReportesService.getReportData(state.ctx, {
            start: range.start,
            end: range.end,
            areas: ['BIBLIO']
        });
        const filtered = applyCurrentDemoFilters(allData);
        const tabRecords = context.tab === 'visitas'
            ? filtered.filter((item) => item.subarea === 'Visitas')
            : filtered.filter((item) => item.subarea === 'PrÃ©stamos');

        return {
            period: range.period,
            periodLabel: range.label,
            dateStart: range.start,
            dateEnd: range.end,
            records: tabRecords
        };
    }

    function getAcademicCrossSelection(tab) {
        if (!_academicCrossState.selections[tab]) {
            _academicCrossState.selections[tab] = { ...(ACADEMIC_CROSS_DEFAULTS[tab] || ACADEMIC_CROSS_DEFAULTS.visitas) };
        }
        return _academicCrossState.selections[tab];
    }

    function setAcademicCrossSelection(tab, selection) {
        _academicCrossState.selections[tab] = {
            ...(ACADEMIC_CROSS_DEFAULTS[tab] || ACADEMIC_CROSS_DEFAULTS.visitas),
            ...(selection || {})
        };
    }

    function sanitizeFilename(value) {
        return String(value || 'Cruce_Biblioteca')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') || 'Cruce_Biblioteca';
    }

    function padAcademicNumber(value) {
        return String(value).padStart(2, '0');
    }

    function toAcademicDateInputValue(value) {
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
        return `${value.getFullYear()}-${padAcademicNumber(value.getMonth() + 1)}-${padAcademicNumber(value.getDate())}`;
    }

    function parseAcademicDateInput(value, endOfDay = false) {
        const safeValue = String(value || '').trim();
        if (!safeValue) return null;
        const isoValue = `${safeValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`;
        const parsed = new Date(isoValue);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function getCurrentMonthRef() {
        const now = new Date();
        return `${now.getFullYear()}-${padAcademicNumber(now.getMonth() + 1)}`;
    }

    function getCurrentQuarterMeta() {
        const now = new Date();
        return {
            year: now.getFullYear(),
            quarter: Math.floor(now.getMonth() / 3) + 1
        };
    }

    function getAcademicCrossPeriodMeta(tab) {
        if (!_academicCrossState.periodMetaByTab[tab]) {
            const quarterMeta = getCurrentQuarterMeta();
            const state = S();
            _academicCrossState.periodMetaByTab[tab] = {
                monthRef: getCurrentMonthRef(),
                quarterYear: quarterMeta.year,
                quarterNumber: quarterMeta.quarter,
                customStart: toAcademicDateInputValue(state.dateStart),
                customEnd: toAcademicDateInputValue(state.dateEnd)
            };
        }
        return _academicCrossState.periodMetaByTab[tab];
    }

    function setAcademicCrossPeriodMeta(tab, meta = {}) {
        const current = getAcademicCrossPeriodMeta(tab);
        _academicCrossState.periodMetaByTab[tab] = {
            ...current,
            ...(meta || {})
        };
    }

    function formatAcademicDate(value) {
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '--';
        return value.toLocaleDateString('es-MX');
    }

    function getAcademicCrossPeriod(tab) {
        return _academicCrossState.periodByTab[tab] || 'current';
    }

    function setAcademicCrossPeriod(tab, period) {
        _academicCrossState.periodByTab[tab] = period || 'current';
    }

    function getAcademicCrossPeriodLabel(period) {
        return ACADEMIC_CROSS_PERIODS.find((item) => item.id === period)?.label || 'Periodo actual';
    }

    function getAcademicCrossYearOptions() {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 8 }, (_, index) => currentYear - index);
    }

    function renderAcademicCrossPeriodDetailControls(tab, period) {
        const meta = getAcademicCrossPeriodMeta(tab);

        if (period === 'monthly') {
            return `
                <div class="col-xl-3 col-md-6" id="biblio-cross-period-month-wrap">
                    <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-month">Mes</label>
                    <input type="month" class="form-control form-control-sm rounded-4" id="biblio-cross-month" value="${escapeHtml(meta.monthRef || getCurrentMonthRef())}">
                </div>
            `;
        }

        if (period === 'quarterly') {
            return `
                <div class="col-xl-2 col-md-4" id="biblio-cross-period-quarter-wrap">
                    <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-quarter-year">Ano</label>
                    <select class="form-select form-select-sm rounded-4" id="biblio-cross-quarter-year">
                        ${getAcademicCrossYearOptions().map((year) => `<option value="${year}" ${Number(meta.quarterYear) === Number(year) ? 'selected' : ''}>${year}</option>`).join('')}
                    </select>
                </div>
                <div class="col-xl-2 col-md-4" id="biblio-cross-period-quarter-number-wrap">
                    <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-quarter-number">Trimestre</label>
                    <select class="form-select form-select-sm rounded-4" id="biblio-cross-quarter-number">
                        ${[1, 2, 3, 4].map((quarter) => `<option value="${quarter}" ${Number(meta.quarterNumber) === quarter ? 'selected' : ''}>T${quarter}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        if (period === 'custom') {
            return `
                <div class="col-xl-3 col-md-6" id="biblio-cross-period-custom-start-wrap">
                    <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-custom-start">Desde</label>
                    <input type="date" class="form-control form-control-sm rounded-4" id="biblio-cross-custom-start" value="${escapeHtml(meta.customStart || '')}">
                </div>
                <div class="col-xl-3 col-md-6" id="biblio-cross-period-custom-end-wrap">
                    <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-custom-end">Hasta</label>
                    <input type="date" class="form-control form-control-sm rounded-4" id="biblio-cross-custom-end" value="${escapeHtml(meta.customEnd || '')}">
                </div>
            `;
        }

        return '';
    }

    function readAcademicCrossPeriodMeta(period) {
        if (period === 'monthly') {
            return {
                monthRef: document.getElementById('biblio-cross-month')?.value || getCurrentMonthRef()
            };
        }

        if (period === 'quarterly') {
            const currentQuarter = getCurrentQuarterMeta();
            return {
                quarterYear: Number.parseInt(document.getElementById('biblio-cross-quarter-year')?.value, 10) || currentQuarter.year,
                quarterNumber: Number.parseInt(document.getElementById('biblio-cross-quarter-number')?.value, 10) || currentQuarter.quarter
            };
        }

        if (period === 'custom') {
            return {
                customStart: document.getElementById('biblio-cross-custom-start')?.value || '',
                customEnd: document.getElementById('biblio-cross-custom-end')?.value || ''
            };
        }

        return {};
    }

    function validateAcademicCrossPeriodMeta(period, meta = {}) {
        if (period !== 'custom') return '';
        const start = parseAcademicDateInput(meta.customStart);
        const end = parseAcademicDateInput(meta.customEnd, true);
        if (!start || !end) {
            return 'Selecciona ambas fechas para consultar un lapso personalizado.';
        }
        if (start > end) {
            return 'La fecha inicial debe ser anterior o igual a la fecha final.';
        }
        return '';
    }

    function onAcademicCrossPeriodChange() {
        const context = getCurrentBiblioTabContext();
        if (!context.supported) return;
        const period = document.getElementById('biblio-cross-period')?.value || 'current';
        const wrapper = document.getElementById('biblio-cross-period-detail-wrap');
        if (wrapper) {
            wrapper.innerHTML = renderAcademicCrossPeriodDetailControls(context.tab, period);
        }
    }

    function getAcademicCrossRange(period, meta = {}) {
        const state = S();
        if (period === 'current') {
            return {
                period: 'current',
                label: 'Periodo actual',
                start: state.dateStart,
                end: state.dateEnd
            };
        }

        if (period === 'monthly') {
            const monthRef = String(meta.monthRef || getCurrentMonthRef()).trim();
            const match = monthRef.match(/^(\d{4})-(\d{2})$/);
            if (match) {
                const year = Number.parseInt(match[1], 10);
                const monthIndex = Number.parseInt(match[2], 10) - 1;
                const start = new Date(year, monthIndex, 1);
                const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
                const label = start.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
                return {
                    period,
                    label: `Mes: ${label}`,
                    start,
                    end
                };
            }
        }

        if (period === 'quarterly') {
            const year = Number.parseInt(meta.quarterYear, 10) || getCurrentQuarterMeta().year;
            const quarterNumber = Number.parseInt(meta.quarterNumber, 10) || getCurrentQuarterMeta().quarter;
            const quarterIndex = Math.min(Math.max(quarterNumber, 1), 4) - 1;
            const startMonth = quarterIndex * 3;
            const start = new Date(year, startMonth, 1);
            const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
            return {
                period,
                label: `Trimestre T${quarterIndex + 1} ${year}`,
                start,
                end
            };
        }

        if (period === 'custom') {
            const start = parseAcademicDateInput(meta.customStart);
            const end = parseAcademicDateInput(meta.customEnd, true);
            if (start && end && start <= end) {
                return {
                    period,
                    label: `Entre ${formatAcademicDate(start)} y ${formatAcademicDate(end)}`,
                    start,
                    end
                };
            }
        }

        const filtersModule = window.Reportes?.Filters;
        const range = filtersModule?.getDateRange
            ? filtersModule.getDateRange(period)
            : { start: state.dateStart, end: state.dateEnd };

        return {
            period,
            label: getAcademicCrossPeriodLabel(period),
            start: range?.start || state.dateStart,
            end: range?.end || state.dateEnd
        };
    }

    function applyCurrentDemoFilters(records) {
        const filters = S().demoFilters || {};
        return (Array.isArray(records) ? records : []).filter((item) => {
            if (filters.carrera && item.carrera !== filters.carrera) return false;
            if (filters.turno && item.turno !== filters.turno) return false;
            if (filters.genero && item.genero !== filters.genero) return false;
            if (filters.generacion && item.generacion !== Number.parseInt(filters.generacion, 10)) return false;
            return true;
        });
    }

    function getActiveAcademicFilterBadges() {
        const state = S();
        const entries = [];
        if (state.demoFilters?.carrera) entries.push(`Carrera: ${normalizeCarreraLabel(state.demoFilters.carrera)}`);
        if (state.demoFilters?.turno) entries.push(`Turno: ${normalizeTurnoLabel(state.demoFilters.turno)}`);
        if (state.demoFilters?.genero) entries.push(`Genero: ${normalizeGeneroLabel(state.demoFilters.genero)}`);
        if (state.demoFilters?.generacion) entries.push(`Generacion: ${normalizeGeneracionLabel(state.demoFilters.generacion)}`);
        return entries;
    }

    function normalizeAcademicValue(record, fieldKey) {
        switch (fieldKey) {
            case 'genero':
                return normalizeGeneroLabel(record?.genero);
            case 'carrera':
                return normalizeCarreraLabel(record?.carrera);
            case 'generacion':
                return normalizeGeneracionLabel(record?.generacion);
            case 'turno':
                return normalizeTurnoLabel(record?.turno);
            case 'tipoUsuario':
                return normalizeTipoUsuarioLabel(record?.tipoUsuario);
            default:
                return toTitleCase(record?.[fieldKey] || 'Sin dato');
        }
    }

    function compareAcademicValues(fieldKey, left, right) {
        const a = String(left || '').trim();
        const b = String(right || '').trim();
        const isMissingA = !a || a === 'Sin dato';
        const isMissingB = !b || b === 'Sin dato';
        if (isMissingA && !isMissingB) return 1;
        if (!isMissingA && isMissingB) return -1;

        if (fieldKey === 'generacion') {
            const numA = Number.parseInt(a, 10);
            const numB = Number.parseInt(b, 10);
            if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numB - numA;
        }

        const ordered = {
            genero: ['Hombre', 'Mujer', 'No binario', 'Otro', 'Sin dato'],
            turno: ['Matutino', 'Vespertino', 'Nocturno', 'Mixto', 'Sin dato'],
            tipoUsuario: ['Estudiante', 'Docente', 'Personal', 'Externo', 'Sin dato']
        }[fieldKey];

        if (ordered) {
            const idxA = ordered.indexOf(a);
            const idxB = ordered.indexOf(b);
            if (idxA !== idxB) {
                const safeA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
                const safeB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
                return safeA - safeB;
            }
        }

        return a.localeCompare(b, 'es', { sensitivity: 'base' });
    }

    function sortAcademicEntries(fieldKey, entries) {
        return [...(entries || [])].sort((left, right) => compareAcademicValues(fieldKey, left, right));
    }

    function shouldUseSemanticPrimaryOrder(fieldKey) {
        return ['turno', 'genero', 'tipoUsuario', 'generacion'].includes(fieldKey);
    }

    function sortAcademicCrossSummaryRows(rows, primaryDimension) {
        const safeRows = Array.isArray(rows) ? [...rows] : [];

        safeRows.sort((left, right) => {
            if (shouldUseSemanticPrimaryOrder(primaryDimension)) {
                const labelComparison = compareAcademicValues(primaryDimension, left.label, right.label);
                if (labelComparison !== 0) return labelComparison;
                return right.count - left.count;
            }

            if (left.count !== right.count) return right.count - left.count;
            return compareAcademicValues(primaryDimension, left.label, right.label);
        });

        return safeRows;
    }

    function sortAcademicCrossPivotRows(entries, rowDimensions) {
        const safeEntries = Array.isArray(entries) ? [...entries] : [];

        safeEntries.sort((left, right) => {
            const primaryComparison = compareAcademicValues(rowDimensions[0], left.rowValues[0], right.rowValues[0]);
            if (primaryComparison !== 0) return primaryComparison;

            if (left.total !== right.total) return right.total - left.total;

            for (let index = 1; index < rowDimensions.length; index += 1) {
                const comparison = compareAcademicValues(rowDimensions[index], left.rowValues[index], right.rowValues[index]);
                if (comparison !== 0) return comparison;
            }
            return 0;
        });

        return safeEntries;
    }

    function createEmptyCountMap(labels) {
        return labels.reduce((acc, label) => {
            acc[label] = 0;
            return acc;
        }, {});
    }

    function buildAcademicCrossMatrix(records, dimensions, tab) {
        const selectedDimensions = Array.from(new Set((dimensions || []).filter(Boolean)));
        const safeRecords = Array.isArray(records) ? records : [];
        if (!selectedDimensions.length) return null;

        if (selectedDimensions.length === 1) {
            const primaryDimension = selectedDimensions[0];
            const counts = {};
            safeRecords.forEach((record) => {
                const label = normalizeAcademicValue(record, primaryDimension);
                counts[label] = (counts[label] || 0) + 1;
            });

            const orderedRows = sortAcademicCrossSummaryRows(
                Object.keys(counts).map((label) => ({ label, count: counts[label] || 0 })),
                primaryDimension
            );
            const dataRows = orderedRows.map((item) => ({
                type: 'data',
                cells: [item.label, item.count, safeRecords.length > 0 ? `${((item.count / safeRecords.length) * 100).toFixed(1)}%` : '0.0%']
            }));

            const totalRow = {
                type: 'total',
                cells: ['Total general', safeRecords.length, safeRecords.length > 0 ? '100.0%' : '0.0%']
            };

            return {
                type: 'summary',
                selectedDimensions,
                dimensionPath: selectedDimensions.map((key) => getAcademicCrossFieldLabel(key, tab)).join(' > '),
                headers: [getAcademicCrossFieldLabel(primaryDimension, tab), 'Cantidad', '%'],
                renderRows: [...dataRows, totalRow],
                exportRows: [...dataRows.map((row) => row.cells), totalRow.cells],
                primaryDimension,
                primarySummary: orderedRows.map((item) => ({ label: item.label, count: item.count })),
                columnDimension: null,
                columnValues: [],
                numericStartIndex: 1,
                baseRecords: safeRecords.length,
                combinations: dataRows.length
            };
        }

        const rowDimensions = selectedDimensions.slice(0, selectedDimensions.length - 1);
        const columnDimension = selectedDimensions[selectedDimensions.length - 1];
        const columnValueSet = new Set();
        const rowMap = new Map();

        safeRecords.forEach((record) => {
            const rowValues = rowDimensions.map((dimension) => normalizeAcademicValue(record, dimension));
            const columnValue = normalizeAcademicValue(record, columnDimension);
            const rowKey = rowValues.join('||');
            if (!rowMap.has(rowKey)) {
                rowMap.set(rowKey, {
                    rowValues,
                    counts: {},
                    total: 0
                });
            }
            const current = rowMap.get(rowKey);
            current.counts[columnValue] = (current.counts[columnValue] || 0) + 1;
            current.total += 1;
            columnValueSet.add(columnValue);
        });

        const columnValues = sortAcademicEntries(columnDimension, Array.from(columnValueSet));
        const rowEntries = sortAcademicCrossPivotRows(Array.from(rowMap.values()), rowDimensions);
        const columnTotals = createEmptyCountMap(columnValues);
        const renderRows = [];
        const exportRows = [];
        const primaryTotals = rowEntries.reduce((acc, entry) => {
            const primaryLabel = entry.rowValues[0];
            acc[primaryLabel] = (acc[primaryLabel] || 0) + entry.total;
            return acc;
        }, {});

        let currentGroup = null;
        let groupAccumulator = createEmptyCountMap(columnValues);
        let groupTotal = 0;

        rowEntries.forEach((entry) => {
            const primaryLabel = entry.rowValues[0];
            const isNewGroup = primaryLabel !== currentGroup;

            if (rowDimensions.length > 1 && currentGroup !== null && isNewGroup) {
                const subtotalCells = [
                    `Subtotal ${currentGroup}`,
                    ...new Array(rowDimensions.length - 1).fill(''),
                    ...columnValues.map((label) => groupAccumulator[label] || 0),
                    groupTotal
                ];
                renderRows.push({ type: 'subtotal', cells: subtotalCells });
                exportRows.push(subtotalCells);
                groupAccumulator = createEmptyCountMap(columnValues);
                groupTotal = 0;
            }

            if (rowDimensions.length > 1 && isNewGroup) {
                renderRows.push({
                    type: 'group',
                    colspan: rowDimensions.length + columnValues.length + 1,
                    label: `${getAcademicCrossFieldLabel(rowDimensions[0], tab)}: ${primaryLabel}`,
                    meta: `${chartsSafeNumber(primaryTotals[primaryLabel] || 0)} registros`
                });
            }

            currentGroup = primaryLabel;
            columnValues.forEach((label) => {
                const count = entry.counts[label] || 0;
                columnTotals[label] = (columnTotals[label] || 0) + count;
                groupAccumulator[label] = (groupAccumulator[label] || 0) + count;
            });
            groupTotal += entry.total;

            const exportCells = [
                ...entry.rowValues,
                ...columnValues.map((label) => entry.counts[label] || 0),
                entry.total
            ];
            const renderCells = [
                ...(rowDimensions.length > 1 ? ['', ...entry.rowValues.slice(1)] : entry.rowValues),
                ...columnValues.map((label) => entry.counts[label] || 0),
                entry.total
            ];
            renderRows.push({ type: 'data', cells: renderCells });
            exportRows.push(exportCells);
        });

        if (rowDimensions.length > 1 && currentGroup !== null) {
            const subtotalCells = [
                `Subtotal ${currentGroup}`,
                ...new Array(rowDimensions.length - 1).fill(''),
                ...columnValues.map((label) => groupAccumulator[label] || 0),
                groupTotal
            ];
            renderRows.push({ type: 'subtotal', cells: subtotalCells });
            exportRows.push(subtotalCells);
        }

        const totalCells = [
            'Total general',
            ...new Array(rowDimensions.length - 1).fill(''),
            ...columnValues.map((label) => columnTotals[label] || 0),
            safeRecords.length
        ];
        renderRows.push({ type: 'total', cells: totalCells });
        exportRows.push(totalCells);

        return {
            type: 'pivot',
            selectedDimensions,
            dimensionPath: selectedDimensions.map((key) => getAcademicCrossFieldLabel(key, tab)).join(' > '),
            headers: rowDimensions.map((dimension) => getAcademicCrossFieldLabel(dimension, tab)).concat(columnValues, 'Total'),
            renderRows,
            exportRows,
            primaryDimension: rowDimensions[0],
            primarySummary: sortAcademicCrossSummaryRows(
                Object.keys(primaryTotals).map((label) => ({ label, count: primaryTotals[label] || 0 })),
                rowDimensions[0]
            ).map((item) => ({
                label: item.label,
                count: item.count
            })),
            columnDimension,
            columnValues,
            columnSummary: columnValues.map((label) => ({ label, count: columnTotals[label] || 0 })),
            numericStartIndex: rowDimensions.length,
            baseRecords: safeRecords.length,
            combinations: rowEntries.length
        };
    }

    function renderAcademicCrossLauncher({ accent = '#f59e0b', enabled = true, tabLabel = 'Visitas' } = {}) {
        const actionButton = enabled
            ? `<button class="btn btn-light btn-lg rounded-pill px-4 fw-bold shadow-sm" onclick="Reportes.Biblio.openAcademicCrossModal()">
                    <i class="bi bi-sliders2 me-2"></i>Seleccionar cruce
               </button>`
            : `<button class="btn btn-outline-secondary btn-lg rounded-pill px-4 fw-bold" disabled>
                    <i class="bi bi-lock me-2"></i>Disponible en Visitas y Prestamos
               </button>`;

        const helperText = enabled
            ? 'Combina genero, carrera, generacion y turno en una sola matriz comparativa lista para exportar.'
            : 'El cruce academico se habilita cuando la pestana tiene registros demograficos comparables.';

        return `
            <div class="card border-0 shadow-sm rounded-4 reportes-biblio-cross-hero" style="background:linear-gradient(135deg, ${hexToRgba(accent, 0.98)}, ${hexToRgba(accent, 0.82)});">
                <div class="card-body p-4">
                    <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
                        <div class="text-white">
                            <div class="small fw-bold text-uppercase mb-2 opacity-75">Cruce academico visible</div>
                            <h5 class="fw-bold mb-2">Explora ${escapeHtml(tabLabel)} con combinaciones reales de datos</h5>
                            <p class="mb-0 opacity-90">${escapeHtml(helperText)}</p>
                        </div>
                        <div class="d-flex flex-column align-items-lg-end gap-2">
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <span class="badge rounded-pill text-bg-light border">Genero</span>
                                <span class="badge rounded-pill text-bg-light border">Carrera</span>
                                <span class="badge rounded-pill text-bg-light border">Generacion</span>
                            </div>
                            ${actionButton}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderAcademicCrossModal(tab, tabLabel) {
        const selection = getAcademicCrossSelection(tab);
        const options = getAcademicCrossFields(tab);
        const activeFilterBadges = getActiveAcademicFilterBadges();
        const selectedPeriod = getAcademicCrossPeriod(tab);
        const renderSelectOptions = (selectedValue) => [
            '<option value="">Sin usar</option>',
            ...options.map((field) => `<option value="${escapeHtml(field.key)}" ${selectedValue === field.key ? 'selected' : ''}>${escapeHtml(field.label)}</option>`)
        ].join('');

        return `
            <div class="modal fade" id="${ACADEMIC_CROSS_MODAL_ID}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content border-0 shadow rounded-4">
                        <div class="modal-header border-0 pb-2">
                            <div>
                                <h5 class="modal-title fw-bold mb-1">Cruce academico de Biblioteca</h5>
                                <div class="text-muted small">${escapeHtml(tabLabel)} - La vista respeta el periodo y los filtros visibles.</div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body pt-0 reportes-biblio-cross-modal-body">
                            <div class="rounded-4 border p-3 mb-3 reportes-biblio-cross-filter-panel">
                                <div class="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3">
                                    <div>
                                        <div class="fw-semibold text-dark">Selecciona el lapso y el tipo de cruce</div>
                                        <div class="small text-muted">Compacta el filtro arriba y deja la matriz lista para lectura y exportacion.</div>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        <button class="btn btn-primary btn-sm rounded-pill px-4" onclick="Reportes.Biblio.applyAcademicCrossConfig()">
                                            <i class="bi bi-funnel me-2"></i>Actualizar vista
                                        </button>
                                        <button class="btn btn-outline-secondary btn-sm rounded-pill px-4" onclick="Reportes.Biblio.resetAcademicCrossConfig()">
                                            <i class="bi bi-arrow-counterclockwise me-2"></i>Restablecer
                                        </button>
                                    </div>
                                </div>

                                <div class="row g-2 align-items-end">
                                    <div class="col-xl-3 col-md-6">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-period">Lapso</label>
                                        <select class="form-select form-select-sm rounded-4" id="biblio-cross-period" onchange="Reportes.Biblio.onAcademicCrossPeriodChange()">
                                            ${ACADEMIC_CROSS_PERIODS.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedPeriod === item.id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div id="biblio-cross-period-detail-wrap" class="contents">
                                        ${renderAcademicCrossPeriodDetailControls(tab, selectedPeriod)}
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-primary">Primero</label>
                                        <select class="form-select form-select-sm rounded-4" id="biblio-cross-primary">
                                            ${options.map((field) => `<option value="${escapeHtml(field.key)}" ${selection.primary === field.key ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-secondary">Luego</label>
                                        <select class="form-select form-select-sm rounded-4" id="biblio-cross-secondary">
                                            ${renderSelectOptions(selection.secondary)}
                                        </select>
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="biblio-cross-tertiary">Columnas</label>
                                        <select class="form-select form-select-sm rounded-4" id="biblio-cross-tertiary">
                                            ${renderSelectOptions(selection.tertiary)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="biblio-cross-feedback" class="alert alert-warning rounded-4 d-none"></div>

                            <div class="d-flex flex-wrap gap-2 mb-3">
                                ${activeFilterBadges.length
                ? activeFilterBadges.map((badge) => `<span class="badge rounded-pill text-bg-light border">${escapeHtml(badge)}</span>`).join('')
                : '<span class="badge rounded-pill text-bg-light border">Sin filtros demograficos adicionales</span>'}
                            </div>

                            <div id="biblio-cross-preview"></div>
                        </div>
                        <div class="modal-footer border-0 pt-0 d-flex justify-content-between flex-wrap gap-2">
                            <div class="small text-muted">Exporta solo la matriz generada desde este modal.</div>
                            <div class="d-flex flex-wrap gap-2">
                                <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">
                                    <i class="bi bi-x-circle me-2"></i>Salir
                                </button>
                                <button class="btn btn-outline-success rounded-pill px-4" id="biblio-cross-export-excel" onclick="Reportes.Biblio.exportAcademicCross('excel')">
                                    <i class="bi bi-file-earmark-excel me-2"></i>Excel
                                </button>
                                <button class="btn btn-outline-danger rounded-pill px-4" id="biblio-cross-export-pdf" onclick="Reportes.Biblio.exportAcademicCross('pdf')">
                                    <i class="bi bi-file-earmark-pdf me-2"></i>PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function setAcademicCrossFeedback(message = '', tone = 'warning') {
        const feedbackEl = document.getElementById('biblio-cross-feedback');
        if (!feedbackEl) return;

        if (!message) {
            feedbackEl.className = 'alert alert-warning rounded-4 d-none';
            feedbackEl.textContent = '';
            return;
        }

        feedbackEl.className = `alert alert-${tone} rounded-4`;
        feedbackEl.textContent = message;
    }

    function setAcademicCrossExportEnabled(enabled) {
        ['biblio-cross-export-excel', 'biblio-cross-export-pdf'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.disabled = !enabled;
        });
    }

    function renderAcademicCrossPreview(matrix, tabLabel, periodLabel = 'Periodo actual', dateStart = null, dateEnd = null) {
        const previewEl = document.getElementById('biblio-cross-preview');
        if (!previewEl) return;

        if (!matrix) {
            previewEl.innerHTML = `
                <div class="rounded-4 border border-dashed p-4 text-center text-muted">
                    Configura al menos un cruce para ver la matriz comparativa.
                </div>
            `;
            return;
        }

        const columnSummaryHtml = matrix.columnSummary?.length
            ? matrix.columnSummary.map((item) => `
                <span class="badge rounded-pill" style="background:${hexToRgba('#f59e0b', 0.12)}; color:#92400e;">
                    ${escapeHtml(item.label)}: ${escapeHtml(chartsSafeNumber(item.count))}
                </span>
            `).join('')
            : '<span class="text-muted small">Sin columnas comparativas adicionales.</span>';
        const renderTableRow = (row) => {
            if (row.colspan) {
                return `
                    <tr class="reportes-biblio-cross-row-${escapeHtml(row.type)}">
                        <td colspan="${row.colspan}">
                            <div class="reportes-biblio-cross-group-row">
                                <span class="reportes-biblio-cross-group-title">${escapeHtml(row.label)}</span>
                                ${row.meta ? `<span class="reportes-biblio-cross-group-meta">${escapeHtml(row.meta)}</span>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }

            return `
                <tr class="reportes-biblio-cross-row-${escapeHtml(row.type)}">
                    ${row.cells.map((cell, index) => {
                const alignClass = index >= (matrix.numericStartIndex || 0) ? 'text-end fw-semibold' : '';
                const emptyClass = cell === '' ? 'reportes-biblio-cross-empty-cell' : '';
                return `<td class="${alignClass} ${emptyClass}">${escapeHtml(cell)}</td>`;
            }).join('')}
                </tr>
            `;
        };

        previewEl.innerHTML = `
            <div class="d-flex flex-column gap-3">
                <div class="row g-3">
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Registros analizados</div>
                                <div class="display-6 fw-bold text-dark mb-1">${escapeHtml(chartsSafeNumber(matrix.baseRecords))}</div>
                                <div class="small text-muted">${escapeHtml(tabLabel)} visible para ${escapeHtml(periodLabel.toLowerCase())}.</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Cruce activo</div>
                                <div class="fw-bold text-dark mb-2">${escapeHtml(matrix.dimensionPath)}</div>
                                <div class="small text-muted">${escapeHtml(chartsSafeNumber(matrix.combinations))} combinaciones visibles en la matriz.</div>
                                <div class="small text-muted mt-1">${escapeHtml(formatAcademicDate(dateStart))} a ${escapeHtml(formatAcademicDate(dateEnd))}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <div class="text-muted small fw-bold text-uppercase mb-1">Columnas comparadas</div>
                                <div class="d-flex flex-wrap gap-2">${columnSummaryHtml}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body">
                        <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2 mb-3">
                            <div>
                                <h6 class="fw-bold mb-1">Matriz comparativa solicitada</h6>
                                <div class="small text-muted">Cuando una combinacion se aprecia mejor en tabla, esta vista prioriza lectura y exportacion.</div>
                            </div>
                            <span class="badge rounded-pill text-bg-light border">${escapeHtml(matrix.dimensionPath)}</span>
                        </div>
                        <div class="table-responsive reportes-biblio-cross-table-wrap">
                            <table class="table table-sm align-middle mb-0 reportes-biblio-cross-table">
                                <thead>
                                    <tr>
                                        ${matrix.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${matrix.renderRows.map((row) => renderTableRow(row)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildAcademicCrossExportPayload(matrix, context) {
        const activeFilters = getActiveAcademicFilterBadges();
        const primarySectionRows = (matrix.primarySummary || []).map((item) => [item.label, item.count]);
        const columnSectionRows = (matrix.columnSummary || []).map((item) => [item.label, item.count]);
        const safeTabLabel = context?.tabLabel || 'Biblioteca';
        const filenameBase = sanitizeFilename(`Cruce_Biblioteca_${context?.tab || 'tab'}_${matrix.selectedDimensions.join('_')}`);

        return {
            kind: 'generic',
            title: 'Cruce academico - Biblioteca',
            subtitle: `${safeTabLabel} - ${matrix.dimensionPath}`,
            filenameBase,
            recordCount: matrix.baseRecords,
            summary: [
                ['Pestana', safeTabLabel],
                ['Lapso solicitado', context?.periodLabel || 'Periodo actual'],
                ['Cruce solicitado', matrix.dimensionPath],
                ['Registros base', matrix.baseRecords],
                ['Combinaciones visibles', matrix.combinations],
                ['Rango', `${formatAcademicDate(context?.dateStart)} a ${formatAcademicDate(context?.dateEnd)}`],
                ['Filtros activos', activeFilters.length ? activeFilters.join(' | ') : 'Sin filtros demograficos adicionales']
            ],
            highlights: [
                { label: 'Registros analizados', value: matrix.baseRecords.toLocaleString('es-MX'), hint: 'Subset visible de la pestana actual.' },
                { label: 'Filas comparativas', value: matrix.combinations.toLocaleString('es-MX'), hint: 'Combinaciones unicas generadas en la tabla.' },
                { label: 'Columnas activas', value: (matrix.columnValues?.length || 0).toLocaleString('es-MX'), hint: matrix.columnDimension ? `Distribuidas por ${getAcademicCrossFieldLabel(matrix.columnDimension, context?.tab)}` : 'Vista resumida sin columnas cruzadas.' }
            ],
            sections: [
                primarySectionRows.length ? {
                    title: `Totales por ${getAcademicCrossFieldLabel(matrix.primaryDimension, context?.tab)}`,
                    headers: [getAcademicCrossFieldLabel(matrix.primaryDimension, context?.tab), 'Cantidad'],
                    rows: primarySectionRows,
                    tone: 'warning'
                } : null,
                columnSectionRows.length && matrix.columnDimension ? {
                    title: `Totales por ${getAcademicCrossFieldLabel(matrix.columnDimension, context?.tab)}`,
                    headers: [getAcademicCrossFieldLabel(matrix.columnDimension, context?.tab), 'Cantidad'],
                    rows: columnSectionRows,
                    tone: 'primary'
                } : null
            ].filter(Boolean),
            dataTitle: 'Matriz comparativa solicitada',
            detailSheetName: 'CruceBiblioteca',
            columns: matrix.headers,
            rows: matrix.exportRows,
            pdfRows: matrix.exportRows.slice(0, 90),
            notes: [
                'Esta exportacion contiene solo la matriz solicitada desde el cruce academico.',
                'El contenido respeta la pestana activa, el periodo visible y los filtros demograficos ya aplicados.'
            ],
            pdfOptions: {
                showDetailTable: true
            }
        };
    }

    async function applyAcademicCrossConfig() {
        const context = getCurrentBiblioTabContext();
        const previewEl = document.getElementById('biblio-cross-preview');
        if (!previewEl) return;

        if (!context.supported) {
            setAcademicCrossFeedback('El cruce academico esta disponible solo en las pestanas de Visitas y Prestamos.');
            renderAcademicCrossPreview(null, context.tabLabel);
            setAcademicCrossExportEnabled(false);
            _academicCrossState.matrix = null;
            _academicCrossState.exportPayload = null;
            return;
        }

        const primary = document.getElementById('biblio-cross-primary')?.value || '';
        const secondary = document.getElementById('biblio-cross-secondary')?.value || '';
        const tertiary = document.getElementById('biblio-cross-tertiary')?.value || '';
        const period = document.getElementById('biblio-cross-period')?.value || 'current';
        const periodMeta = readAcademicCrossPeriodMeta(period);
        const selected = [primary, secondary, tertiary].filter(Boolean);
        const uniqueSelected = new Set(selected);
        const periodValidationError = validateAcademicCrossPeriodMeta(period, periodMeta);

        if (!primary) {
            setAcademicCrossFeedback('Selecciona al menos el agrupador principal para construir la matriz.');
            renderAcademicCrossPreview(null, context.tabLabel);
            setAcademicCrossExportEnabled(false);
            return;
        }

        if (uniqueSelected.size !== selected.length) {
            setAcademicCrossFeedback('Cada nivel del cruce debe usar una dimension distinta para evitar duplicados.');
            renderAcademicCrossPreview(null, context.tabLabel);
            setAcademicCrossExportEnabled(false);
            return;
        }

        if (periodValidationError) {
            setAcademicCrossFeedback(periodValidationError);
            renderAcademicCrossPreview(null, context.tabLabel);
            setAcademicCrossExportEnabled(false);
            return;
        }

        setAcademicCrossSelection(context.tab, { primary, secondary, tertiary });
        setAcademicCrossPeriod(context.tab, period);
        setAcademicCrossPeriodMeta(context.tab, periodMeta);
        _academicCrossState.activeTab = context.tab;
        previewEl.innerHTML = `
            <div class="rounded-4 border p-4 text-center text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Preparando cruce academico para ${escapeHtml(getAcademicCrossPeriodLabel(period).toLowerCase())}...
            </div>
        `;
        setAcademicCrossExportEnabled(false);

        try {
            const dataset = await resolveAcademicCrossDataset(context, period, periodMeta);
            if (!dataset.records.length) {
                setAcademicCrossFeedback('No hay registros visibles en esta pestana para construir el cruce con la configuracion actual.', 'info');
                renderAcademicCrossPreview(null, context.tabLabel, dataset.periodLabel, dataset.dateStart, dataset.dateEnd);
                _academicCrossState.matrix = null;
                _academicCrossState.exportPayload = null;
                _academicCrossState.dateStart = dataset.dateStart;
                _academicCrossState.dateEnd = dataset.dateEnd;
                _academicCrossState.periodLabel = dataset.periodLabel;
                return;
            }

            const exportContext = {
                ...context,
                period: dataset.period,
                periodLabel: dataset.periodLabel,
                dateStart: dataset.dateStart,
                dateEnd: dataset.dateEnd
            };
            const matrix = buildAcademicCrossMatrix(dataset.records, selected, context.tab);
            _academicCrossState.matrix = matrix;
            _academicCrossState.exportPayload = matrix ? buildAcademicCrossExportPayload(matrix, exportContext) : null;
            _academicCrossState.dateStart = dataset.dateStart;
            _academicCrossState.dateEnd = dataset.dateEnd;
            _academicCrossState.periodLabel = dataset.periodLabel;
            setAcademicCrossFeedback('');
            renderAcademicCrossPreview(matrix, context.tabLabel, dataset.periodLabel, dataset.dateStart, dataset.dateEnd);
            setAcademicCrossExportEnabled(!!_academicCrossState.exportPayload);
        } catch (error) {
            console.error('[Reportes.Biblio] Error generando cruce academico:', error);
            setAcademicCrossFeedback('No se pudo cargar el lapso solicitado para el cruce academico.', 'danger');
            renderAcademicCrossPreview(null, context.tabLabel, getAcademicCrossPeriodLabel(period));
            _academicCrossState.matrix = null;
            _academicCrossState.exportPayload = null;
        }
    }

    function resetAcademicCrossConfig() {
        const context = getCurrentBiblioTabContext();
        if (!context.supported) return;
        const defaults = { ...(ACADEMIC_CROSS_DEFAULTS[context.tab] || ACADEMIC_CROSS_DEFAULTS.visitas) };
        setAcademicCrossSelection(context.tab, defaults);
        setAcademicCrossPeriod(context.tab, 'current');
        setAcademicCrossPeriodMeta(context.tab, {
            monthRef: getCurrentMonthRef(),
            quarterYear: getCurrentQuarterMeta().year,
            quarterNumber: getCurrentQuarterMeta().quarter,
            customStart: toAcademicDateInputValue(S().dateStart),
            customEnd: toAcademicDateInputValue(S().dateEnd)
        });

        const primarySelect = document.getElementById('biblio-cross-primary');
        const secondarySelect = document.getElementById('biblio-cross-secondary');
        const tertiarySelect = document.getElementById('biblio-cross-tertiary');
        const periodSelect = document.getElementById('biblio-cross-period');
        if (primarySelect) primarySelect.value = defaults.primary;
        if (secondarySelect) secondarySelect.value = defaults.secondary;
        if (tertiarySelect) tertiarySelect.value = defaults.tertiary;
        if (periodSelect) periodSelect.value = 'current';
        onAcademicCrossPeriodChange();

        void applyAcademicCrossConfig();
    }

    function openAcademicCrossModal() {
        const context = getCurrentBiblioTabContext();
        if (!context.supported) {
            alert('El cruce academico esta disponible solo en las pestanas de Visitas y Prestamos.');
            return;
        }

        const modal = document.getElementById(ACADEMIC_CROSS_MODAL_ID);
        if (!modal) return;

        const selection = getAcademicCrossSelection(context.tab);
        const selectedPeriod = getAcademicCrossPeriod(context.tab);
        const primarySelect = document.getElementById('biblio-cross-primary');
        const secondarySelect = document.getElementById('biblio-cross-secondary');
        const tertiarySelect = document.getElementById('biblio-cross-tertiary');
        const periodSelect = document.getElementById('biblio-cross-period');
        if (primarySelect) primarySelect.value = selection.primary;
        if (secondarySelect) secondarySelect.value = selection.secondary;
        if (tertiarySelect) tertiarySelect.value = selection.tertiary;
        if (periodSelect) periodSelect.value = selectedPeriod;
        onAcademicCrossPeriodChange();

        void applyAcademicCrossConfig();
        new bootstrap.Modal(modal).show();
    }

    async function exportAcademicCross(format) {
        if (!window.ExportUtils) {
            alert('Las utilidades de exportacion no estan disponibles.');
            return;
        }

        const context = getCurrentBiblioTabContext();
        const payload = _academicCrossState.exportPayload;
        if (!payload || !_academicCrossState.matrix || !context.supported) {
            alert('Primero genera una matriz valida dentro del cruce academico.');
            return;
        }

        const selectedPeriod = getAcademicCrossPeriod(_academicCrossState.activeTab || context.tab);
        const config = {
            period: selectedPeriod === 'current' ? (S().presetPeriod || 'current') : selectedPeriod,
            dateStart: _academicCrossState.dateStart,
            dateEnd: _academicCrossState.dateEnd
        };

        if (format === 'pdf') {
            await window.ExportUtils.generatePDF(config, payload, 'BIBLIO');
        } else {
            window.ExportUtils.generateExcel(config, payload, 'BIBLIO');
        }
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

                .reportes-biblio-cross-hero {
                    overflow: hidden;
                }

                .reportes-biblio-cross-modal-body {
                    overflow: hidden;
                }

                .reportes-biblio-cross-filter-panel {
                    background:
                        radial-gradient(circle at top right, rgba(245, 158, 11, 0.08), transparent 38%),
                        linear-gradient(180deg, #fffdf9 0%, #fffaf3 100%);
                    border-color: #fed7aa !important;
                }

                .reportes-biblio-cross-filter-panel .form-label {
                    letter-spacing: 0.01em;
                }

                .reportes-biblio-cross-filter-panel .form-select,
                .reportes-biblio-cross-filter-panel .form-control {
                    border-color: #fed7aa;
                    background-color: rgba(255, 255, 255, 0.96);
                }

                .reportes-biblio-cross-filter-panel .form-select:focus,
                .reportes-biblio-cross-filter-panel .form-control:focus {
                    border-color: #f59e0b;
                    box-shadow: 0 0 0 0.2rem rgba(245, 158, 11, 0.15);
                }

                .contents {
                    display: contents;
                }

                .reportes-biblio-cross-table-wrap {
                    max-height: none;
                    overflow-x: auto;
                    overflow-y: hidden;
                }

                .reportes-biblio-cross-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    background: #fff7ed;
                    color: #9a3412;
                    border-bottom-width: 1px;
                    white-space: nowrap;
                }

                .reportes-biblio-cross-table tbody td {
                    white-space: nowrap;
                    vertical-align: middle;
                    border-color: #f1f5f9;
                    padding-top: 0.7rem;
                    padding-bottom: 0.7rem;
                }

                .reportes-biblio-cross-table tbody tr.reportes-biblio-cross-row-data:nth-child(even) td {
                    background: #fcfcfd;
                }

                .reportes-biblio-cross-table tbody tr.reportes-biblio-cross-row-data:hover td {
                    background: #fffaf2;
                }

                .reportes-biblio-cross-empty-cell {
                    color: transparent;
                }

                .reportes-biblio-cross-row-group td {
                    background: linear-gradient(90deg, #fff7ed 0%, #fffbf5 100%);
                    border-top: 2px solid #fdba74;
                    border-bottom: 1px solid #fed7aa;
                    padding-top: 0.8rem;
                    padding-bottom: 0.8rem;
                }

                .reportes-biblio-cross-group-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .reportes-biblio-cross-group-title {
                    font-weight: 800;
                    color: #9a3412;
                    letter-spacing: 0.01em;
                }

                .reportes-biblio-cross-group-meta {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.2rem 0.7rem;
                    border-radius: 999px;
                    background: rgba(154, 52, 18, 0.08);
                    color: #9a3412;
                    font-size: 0.8rem;
                    font-weight: 700;
                }

                .reportes-biblio-cross-row-subtotal td {
                    background: #fff7ed;
                    font-weight: 700;
                    color: #9a3412;
                    border-top: 1px dashed #fdba74;
                }

                .reportes-biblio-cross-row-total td {
                    background: linear-gradient(90deg, #fef3c7 0%, #fff7ed 100%);
                    font-weight: 700;
                    color: #78350f;
                    border-top: 2px solid #f59e0b;
                }

                @media (max-width: 991.98px) {
                    .reportes-biblio-list-scroll {
                        max-height: none;
                    }

                    .reportes-biblio-cross-table-wrap {
                        max-height: none;
                    }

                    .reportes-biblio-cross-filter-panel .btn {
                        width: 100%;
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
                ${renderAcademicCrossLauncher({ accent: charts.COLORS.warning, enabled: true, tabLabel: 'Visitas' })}

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

                ${renderAcademicCrossModal('visitas', 'Visitas')}
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
                ${renderAcademicCrossLauncher({ accent: charts.COLORS.primary, enabled: true, tabLabel: 'Prestamos' })}

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

                ${renderAcademicCrossModal('prestamos', 'Prestamos')}
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
                ${renderAcademicCrossLauncher({ accent: charts.COLORS.info, enabled: false, tabLabel: 'Catalogo' })}

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
    return {
        render,
        getTabs,
        openAcademicCrossModal,
        onAcademicCrossPeriodChange,
        applyAcademicCrossConfig,
        resetAcademicCrossConfig,
        exportAcademicCross
    };

})();
