/**
 * Reportes - Modulo de Servicios Medicos / Atencion Psicopedagogica
 * Soporta ambas areas a partir de Reportes.getState().currentArea.
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-medico.js cargado, window.Reportes keys:', Object.keys(window.Reportes));

window.Reportes.Medico = (function () {
    'use strict';

    const H = () => Reportes.Charts;
    const S = () => Reportes.getState();
    const R = () => Reportes.getChartRegistry();
    const CROSS_MODAL_ID = 'reportesMedicalCrossModal';
    const CROSS_PERIODS = [
        { id: 'current', label: 'Periodo actual' },
        { id: 'daily', label: 'Hoy' },
        { id: 'monthly', label: 'Mes' },
        { id: 'quarterly', label: 'Trimestre' },
        { id: 'custom', label: 'Entre fechas' }
    ];
    const AREA_CONFIG = {
        MEDICO: {
            label: 'Servicios Medicos',
            fullLabel: 'Servicios Medicos',
            tabLabel: 'medicas',
            subarea: 'Medicina General',
            type: 'Consulta Médica',
            icon: 'bi-heart-pulse-fill',
            accent: '#4f46e5',
            accentSoft: '#eef2ff',
            heroHint: 'Atencion medica, diagnósticos y lectura detallada de registros.'
        },
        PSICOPEDAGOGICO: {
            label: 'Atencion Psicopedagogica',
            fullLabel: 'Atencion Psicopedagogica',
            tabLabel: 'psicopedagogicas',
            subarea: 'Psicología',
            type: 'Consulta Psicopedagógica',
            icon: 'bi-chat-heart-fill',
            accent: '#0284c7',
            accentSoft: '#f0f9ff',
            heroHint: 'Acompañamiento psicopedagogico, diagnósticos y cruces listos para exportar.'
        }
    };
    const CROSS_FIELD_CATALOG = {
        consultas: [
            { key: 'carrera', label: 'Carrera' },
            { key: 'genero', label: 'Genero' },
            { key: 'turno', label: 'Turno' },
            { key: 'status', label: 'Estado' },
            { key: 'profesional', label: 'Profesional' },
            { key: 'horaBloque', label: 'Horario' },
            { key: 'fechaCorte', label: 'Fecha' }
        ],
        diagnosticos: [
            { key: 'categoria', label: 'Motivo agrupado' },
            { key: 'carrera', label: 'Carrera' },
            { key: 'genero', label: 'Genero' },
            { key: 'turno', label: 'Turno' },
            { key: 'status', label: 'Estado' },
            { key: 'profesional', label: 'Profesional' },
            { key: 'fechaCorte', label: 'Fecha' }
        ]
    };
    const CROSS_DEFAULTS = {
        consultas: { primary: 'carrera', secondary: 'genero', tertiary: 'status' },
        diagnosticos: { primary: 'categoria', secondary: 'carrera', tertiary: 'genero' }
    };
    let _crossState = {
        selections: {},
        periods: {},
        periodMeta: {},
        matrix: null,
        exportPayload: null,
        dateStart: null,
        dateEnd: null,
        periodLabel: 'Periodo actual',
        activeScope: '',
        previewCache: new Map()
    };

    function getCurrentAreaKey() {
        return S().currentArea === 'PSICOPEDAGOGICO' ? 'PSICOPEDAGOGICO' : 'MEDICO';
    }

    function getAreaConfig(area = getCurrentAreaKey()) {
        return AREA_CONFIG[area] || AREA_CONFIG.MEDICO;
    }

    function getTabs() {
        return getCurrentAreaKey() === 'PSICOPEDAGOGICO'
            ? [
                { id: 'consultas', label: 'Consultas', icon: 'bi-clipboard2-pulse' },
                { id: 'diagnosticos', label: 'Diagnosticos', icon: 'bi-activity' }
            ]
            : [
                { id: 'consultas', label: 'Consultas', icon: 'bi-clipboard2-pulse' },
                { id: 'diagnosticos', label: 'Diagnosticos', icon: 'bi-activity' },
                { id: 'perfil', label: 'Perfil Clinico', icon: 'bi-heart-pulse' }
            ];
    }

    function render(container) {
        const state = S();
        const tab = state.currentTab || 'consultas';
        const area = getCurrentAreaKey();

        if (tab === 'perfil' && area !== 'MEDICO') {
            renderUnavailable(container, 'El perfil clinico permanece solo en Servicios Medicos.');
            return;
        }

        switch (tab) {
            case 'diagnosticos':
                renderDiagnosticos(container, state.filteredData);
                break;
            case 'perfil':
                renderPerfil(container);
                break;
            default:
                renderConsultas(container, state.filteredData);
                break;
        }
    }

    function categorizeSimilar(diagnostico) {
        if (!diagnostico) return 'General';
        const lower = String(diagnostico).toLowerCase();

        if (lower.includes('estrés') || lower.includes('estres') || lower.includes('ansiedad') || lower.includes('urgencia')) return 'Ansiedad y Estres';
        if (lower.includes('depresión') || lower.includes('depresion') || lower.includes('trist') || lower.includes('suicidio') || lower.includes('animo')) return 'Depresion y Estado de Animo';
        if (lower.includes('pareja') || lower.includes('ruptura') || lower.includes('novio') || lower.includes('relacion')) return 'Problemas de Pareja';
        if (lower.includes('familia') || lower.includes('padres') || lower.includes('duelo') || lower.includes('muerte')) return 'Problemas Familiares / Duelo';
        if (lower.includes('academico') || lower.includes('escuela') || lower.includes('calificacion') || lower.includes('reprob')) return 'Estres Academico';
        if (lower.includes('autoestima') || lower.includes('inseguridad') || lower.includes('identidad')) return 'Autoestima / Personalidad';
        if (lower.includes('tdah') || lower.includes('atencion') || lower.includes('aprendizaje')) return 'Aprendizaje / TDAH';
        if (lower.includes('psicoterapia') || lower.includes('terapia')) return 'Atencion Terapeutica General';

        if (lower.includes('grip') || lower.includes('resfriad') || lower.includes('tos') || lower.includes('faring') || lower.includes('garganta')) return 'Infeccion Respiratoria / Gripe';
        if (lower.includes('estomag') || lower.includes('gastr') || lower.includes('colitis') || lower.includes('diarrea') || lower.includes('vomito') || lower.includes('nausea')) return 'Gastrointestinal';
        if (lower.includes('cabeza') || lower.includes('cefalea') || lower.includes('migraña') || lower.includes('migra')) return 'Cefalea / Migraña';
        if (lower.includes('golpe') || lower.includes('trauma') || lower.includes('contusion') || lower.includes('esguince') || lower.includes('luxacion') || lower.includes('caida') || lower.includes('herida') || lower.includes('corte')) return 'Traumatismos y Heridas';
        if (lower.includes('dolor') || lower.includes('mialgia') || lower.includes('espalda') || lower.includes('muscu') || lower.includes('articul')) return 'Dolor Muscular / Articular';
        if (lower.includes('presion') || lower.includes('hiperten') || lower.includes('hipoten') || lower.includes('mareo') || lower.includes('desmayo') || lower.includes('lipotimia')) return 'Alteraciones de Presion / Desmayos';
        if (lower.includes('alergi') || lower.includes('urticaria') || lower.includes('dermatitis') || lower.includes('piel')) return 'Alergias y Dermatologia';
        if (lower.includes('certificado') || lower.includes('justificante') || lower.includes('receta')) return 'Tramites Administrativos / Recetas';

        return toTitleCase(diagnostico);
    }

    function toTitleCase(value) {
        return String(value || 'Sin dato')
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Sin dato';
    }

    function normalizeGeneroLabel(value) {
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return 'Sin dato';
        if (lower.startsWith('m')) return 'Mujer';
        if (lower.startsWith('h')) return 'Hombre';
        if (lower.includes('nb')) return 'No binario';
        return toTitleCase(value);
    }

    function normalizeTurnoLabel(value) {
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return 'Sin dato';
        if (lower.includes('mat')) return 'Matutino';
        if (lower.includes('vesp')) return 'Vespertino';
        if (lower.includes('noch')) return 'Nocturno';
        if (lower.includes('mixt')) return 'Mixto';
        return toTitleCase(value);
    }

    function normalizeCarreraLabel(value) {
        const label = String(value || '').trim();
        return label && label !== 'N/A' ? label : 'Sin dato';
    }

    function chartsSafeNumber(value) {
        return Number(value || 0).toLocaleString('es-MX');
    }

    function hexToRgba(hex, alpha) {
        const normalized = String(hex || '#000000').replace('#', '');
        const full = normalized.length === 3
            ? normalized.split('').map((char) => char + char).join('')
            : normalized.padEnd(6, '0').slice(0, 6);
        const intValue = Number.parseInt(full, 16);
        const r = (intValue >> 16) & 255;
        const g = (intValue >> 8) & 255;
        const b = intValue & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeFilename(value) {
        return String(value || 'Cruce_Medico')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') || 'Cruce_Medico';
    }

    function padNumber(value) {
        return String(value).padStart(2, '0');
    }

    function toDateInputValue(value) {
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
        return `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(value.getDate())}`;
    }

    function parseDateInput(value, endOfDay = false) {
        const safe = String(value || '').trim();
        if (!safe) return null;
        const date = new Date(`${safe}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '--';
        return value.toLocaleDateString('es-MX');
    }

    function getCurrentMonthRef() {
        const now = new Date();
        return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}`;
    }

    function getCurrentQuarterMeta() {
        const now = new Date();
        return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
    }

    function getScopeKey(area = getCurrentAreaKey(), tab = S().currentTab || 'consultas') {
        return `${area}:${tab}`;
    }

    function getFieldOptions(tab) {
        return CROSS_FIELD_CATALOG[tab] || CROSS_FIELD_CATALOG.consultas;
    }

    function getFieldLabel(fieldKey, tab) {
        return getFieldOptions(tab).find((field) => field.key === fieldKey)?.label || fieldKey;
    }

    function getCrossSelection(area = getCurrentAreaKey(), tab = S().currentTab || 'consultas') {
        const scopeKey = getScopeKey(area, tab);
        if (!_crossState.selections[scopeKey]) {
            _crossState.selections[scopeKey] = { ...(CROSS_DEFAULTS[tab] || CROSS_DEFAULTS.consultas) };
        }
        return _crossState.selections[scopeKey];
    }

    function setCrossSelection(area, tab, selection) {
        _crossState.selections[getScopeKey(area, tab)] = {
            ...(CROSS_DEFAULTS[tab] || CROSS_DEFAULTS.consultas),
            ...(selection || {})
        };
    }

    function getCrossPeriod(area = getCurrentAreaKey(), tab = S().currentTab || 'consultas') {
        return _crossState.periods[getScopeKey(area, tab)] || 'current';
    }

    function setCrossPeriod(area, tab, period) {
        _crossState.periods[getScopeKey(area, tab)] = period || 'current';
    }

    function getCrossPeriodMeta(area = getCurrentAreaKey(), tab = S().currentTab || 'consultas') {
        const scopeKey = getScopeKey(area, tab);
        if (!_crossState.periodMeta[scopeKey]) {
            const quarterMeta = getCurrentQuarterMeta();
            _crossState.periodMeta[scopeKey] = {
                monthRef: getCurrentMonthRef(),
                quarterYear: quarterMeta.year,
                quarterNumber: quarterMeta.quarter,
                customStart: toDateInputValue(S().dateStart),
                customEnd: toDateInputValue(S().dateEnd)
            };
        }
        return _crossState.periodMeta[scopeKey];
    }

    function setCrossPeriodMeta(area, tab, meta = {}) {
        const scopeKey = getScopeKey(area, tab);
        _crossState.periodMeta[scopeKey] = {
            ...getCrossPeriodMeta(area, tab),
            ...(meta || {})
        };
    }

    function getCurrentContext() {
        const area = getCurrentAreaKey();
        const config = getAreaConfig(area);
        const tabs = getTabs();
        const tab = S().currentTab || tabs[0].id;
        const tabLabel = tabs.find((item) => item.id === tab)?.label || tabs[0]?.label || 'Consultas';
        return {
            area,
            config,
            tab,
            tabLabel,
            supported: tab !== 'perfil',
            records: filterAreaRecords(S().filteredData, area)
        };
    }

    function filterAreaRecords(records, area = getCurrentAreaKey()) {
        return (Array.isArray(records) ? records : []).filter((item) => {
            if ((item.areaKey || '').toUpperCase() === area) return true;
            return String(item.subarea || '').trim() === getAreaConfig(area).subarea;
        });
    }

    function applyCurrentDemoFilters(records) {
        const filters = S().demoFilters || {};
        return (Array.isArray(records) ? records : []).filter((item) => {
            if (filters.carrera && item.carrera !== filters.carrera) return false;
            if (filters.turno && item.turno !== filters.turno) return false;
            if (filters.genero && item.genero !== filters.genero) return false;
            if (filters.generacion && Number(item.generacion) !== Number.parseInt(filters.generacion, 10)) return false;
            return true;
        });
    }

    function getActiveDemoBadges() {
        const filters = S().demoFilters || {};
        const badges = [];
        if (filters.carrera) badges.push(`Carrera: ${normalizeCarreraLabel(filters.carrera)}`);
        if (filters.turno) badges.push(`Turno: ${normalizeTurnoLabel(filters.turno)}`);
        if (filters.genero) badges.push(`Genero: ${normalizeGeneroLabel(filters.genero)}`);
        if (filters.generacion) badges.push(`Generacion: ${filters.generacion}`);
        return badges;
    }

    function getPeriodLabel(period) {
        return CROSS_PERIODS.find((item) => item.id === period)?.label || 'Periodo actual';
    }

    function getYearOptions() {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 8 }, (_, index) => currentYear - index);
    }

    function renderPeriodDetailControls(area, tab, period) {
        const meta = getCrossPeriodMeta(area, tab);

        if (period === 'monthly') {
            return `
                <div class="col-xl-3 col-md-6">
                    <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-month">Mes</label>
                    <input type="month" class="form-control form-control-sm rounded-4" id="medico-cross-month" value="${escapeHtml(meta.monthRef || getCurrentMonthRef())}">
                </div>
            `;
        }

        if (period === 'quarterly') {
            return `
                <div class="col-xl-2 col-md-4">
                    <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-quarter-year">Ano</label>
                    <select class="form-select form-select-sm rounded-4" id="medico-cross-quarter-year">
                        ${getYearOptions().map((year) => `<option value="${year}" ${Number(meta.quarterYear) === Number(year) ? 'selected' : ''}>${year}</option>`).join('')}
                    </select>
                </div>
                <div class="col-xl-2 col-md-4">
                    <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-quarter-number">Trimestre</label>
                    <select class="form-select form-select-sm rounded-4" id="medico-cross-quarter-number">
                        ${[1, 2, 3, 4].map((quarter) => `<option value="${quarter}" ${Number(meta.quarterNumber) === quarter ? 'selected' : ''}>T${quarter}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        if (period === 'custom') {
            return `
                <div class="col-xl-3 col-md-6">
                    <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-custom-start">Desde</label>
                    <input type="date" class="form-control form-control-sm rounded-4" id="medico-cross-custom-start" value="${escapeHtml(meta.customStart || '')}">
                </div>
                <div class="col-xl-3 col-md-6">
                    <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-custom-end">Hasta</label>
                    <input type="date" class="form-control form-control-sm rounded-4" id="medico-cross-custom-end" value="${escapeHtml(meta.customEnd || '')}">
                </div>
            `;
        }

        return '';
    }

    function readPeriodMeta(period) {
        if (period === 'monthly') {
            return { monthRef: document.getElementById('medico-cross-month')?.value || getCurrentMonthRef() };
        }
        if (period === 'quarterly') {
            const currentQuarter = getCurrentQuarterMeta();
            return {
                quarterYear: Number.parseInt(document.getElementById('medico-cross-quarter-year')?.value, 10) || currentQuarter.year,
                quarterNumber: Number.parseInt(document.getElementById('medico-cross-quarter-number')?.value, 10) || currentQuarter.quarter
            };
        }
        if (period === 'custom') {
            return {
                customStart: document.getElementById('medico-cross-custom-start')?.value || '',
                customEnd: document.getElementById('medico-cross-custom-end')?.value || ''
            };
        }
        return {};
    }

    function validatePeriodMeta(period, meta = {}) {
        if (period !== 'custom') return '';
        const start = parseDateInput(meta.customStart);
        const end = parseDateInput(meta.customEnd, true);
        if (!start || !end) return 'Selecciona ambas fechas para consultar un lapso personalizado.';
        if (start > end) return 'La fecha inicial debe ser anterior o igual a la fecha final.';
        return '';
    }

    function onCrossPeriodChange() {
        const context = getCurrentContext();
        const period = document.getElementById('medico-cross-period')?.value || 'current';
        const wrapper = document.getElementById('medico-cross-period-detail-wrap');
        if (wrapper) wrapper.innerHTML = renderPeriodDetailControls(context.area, context.tab, period);
    }

    function getCrossRange(period, meta = {}) {
        const state = S();
        if (period === 'current') {
            return { period, label: 'Periodo actual', start: state.dateStart, end: state.dateEnd };
        }
        if (period === 'monthly') {
            const match = String(meta.monthRef || getCurrentMonthRef()).trim().match(/^(\d{4})-(\d{2})$/);
            if (match) {
                const year = Number.parseInt(match[1], 10);
                const monthIndex = Number.parseInt(match[2], 10) - 1;
                const start = new Date(year, monthIndex, 1);
                const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
                return { period, label: `Mes: ${start.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`, start, end };
            }
        }
        if (period === 'quarterly') {
            const year = Number.parseInt(meta.quarterYear, 10) || getCurrentQuarterMeta().year;
            const quarterNumber = Number.parseInt(meta.quarterNumber, 10) || getCurrentQuarterMeta().quarter;
            const startMonth = (Math.min(Math.max(quarterNumber, 1), 4) - 1) * 3;
            const start = new Date(year, startMonth, 1);
            const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
            return { period, label: `Trimestre T${Math.floor(startMonth / 3) + 1} ${year}`, start, end };
        }
        if (period === 'custom') {
            const start = parseDateInput(meta.customStart);
            const end = parseDateInput(meta.customEnd, true);
            if (start && end && start <= end) {
                return { period, label: `Entre ${formatDate(start)} y ${formatDate(end)}`, start, end };
            }
        }
        const filtersModule = window.Reportes?.Filters;
        const range = filtersModule?.getDateRange ? filtersModule.getDateRange(period) : { start: state.dateStart, end: state.dateEnd };
        return { period, label: getPeriodLabel(period), start: range?.start || state.dateStart, end: range?.end || state.dateEnd };
    }

    async function resolveCrossDataset(context, period, meta = {}) {
        const range = getCrossRange(period, meta);
        if (period === 'current') {
            return {
                period: range.period,
                periodLabel: range.label,
                dateStart: range.start,
                dateEnd: range.end,
                records: context.records
            };
        }

        if (!window.ReportesService) {
            return {
                period: range.period,
                periodLabel: range.label,
                dateStart: range.start,
                dateEnd: range.end,
                records: []
            };
        }

        const allData = await window.ReportesService.getReportData(S().ctx, {
            start: range.start,
            end: range.end,
            areas: [context.area]
        });

        return {
            period: range.period,
            periodLabel: range.label,
            dateStart: range.start,
            dateEnd: range.end,
            records: applyCurrentDemoFilters(filterAreaRecords(allData, context.area))
        };
    }

    function normalizeCrossValue(record, fieldKey) {
        switch (fieldKey) {
            case 'carrera':
                return normalizeCarreraLabel(record?.carrera);
            case 'genero':
                return normalizeGeneroLabel(record?.genero);
            case 'turno':
                return normalizeTurnoLabel(record?.turno);
            case 'status':
                return toTitleCase(record?.status || 'Sin dato');
            case 'profesional':
                return String(record?.profesional || 'Sin asignar').trim() || 'Sin asignar';
            case 'horaBloque': {
                const hour = Number.parseInt(record?.hora, 10);
                if (!Number.isFinite(hour)) return 'Sin hora';
                if (hour < 10) return '07:00-09:59';
                if (hour < 13) return '10:00-12:59';
                if (hour < 16) return '13:00-15:59';
                if (hour < 19) return '16:00-18:59';
                return '19:00+';
            }
            case 'fechaCorte': {
                const date = record?.fecha instanceof Date ? record.fecha : new Date(record?.fecha);
                if (Number.isNaN(date.getTime())) return 'Sin fecha';
                return formatDate(date);
            }
            case 'categoria':
                return categorizeSimilar(record?.diagnostico || record?.detalle || 'General');
            default:
                return toTitleCase(record?.[fieldKey] || 'Sin dato');
        }
    }

    function compareValues(fieldKey, left, right) {
        const a = String(left || '').trim();
        const b = String(right || '').trim();
        const isMissingA = !a || a === 'Sin dato' || a === 'Sin fecha' || a === 'Sin hora';
        const isMissingB = !b || b === 'Sin dato' || b === 'Sin fecha' || b === 'Sin hora';
        if (isMissingA && !isMissingB) return 1;
        if (!isMissingA && isMissingB) return -1;

        const ordered = {
            genero: ['Hombre', 'Mujer', 'No binario', 'Otro', 'Sin dato'],
            turno: ['Matutino', 'Vespertino', 'Nocturno', 'Mixto', 'Sin dato'],
            status: ['Completada', 'Finalizada', 'Confirmada', 'Pendiente', 'Sin dato'],
            horaBloque: ['07:00-09:59', '10:00-12:59', '13:00-15:59', '16:00-18:59', '19:00+', 'Sin hora']
        }[fieldKey];

        if (ordered) {
            const idxA = ordered.indexOf(a);
            const idxB = ordered.indexOf(b);
            const safeA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
            const safeB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
            if (safeA !== safeB) return safeA - safeB;
        }

        if (fieldKey === 'fechaCorte') {
            const dateA = parseDateInput(a.split('/').reverse().join('-'));
            const dateB = parseDateInput(b.split('/').reverse().join('-'));
            if (dateA && dateB && dateA.getTime() !== dateB.getTime()) return dateB - dateA;
        }

        return a.localeCompare(b, 'es', { sensitivity: 'base' });
    }

    function sortEntries(fieldKey, entries) {
        return [...(entries || [])].sort((left, right) => compareValues(fieldKey, left, right));
    }

    function sortSummaryRows(rows, primaryDimension) {
        const safeRows = Array.isArray(rows) ? [...rows] : [];
        safeRows.sort((left, right) => {
            const semanticComparison = compareValues(primaryDimension, left.label, right.label);
            if (['genero', 'turno', 'status', 'horaBloque', 'fechaCorte'].includes(primaryDimension) && semanticComparison !== 0) {
                return semanticComparison;
            }
            if (left.count !== right.count) return right.count - left.count;
            return semanticComparison;
        });
        return safeRows;
    }

    function sortPivotRows(entries, rowDimensions) {
        const safeEntries = Array.isArray(entries) ? [...entries] : [];
        safeEntries.sort((left, right) => {
            const primaryComparison = compareValues(rowDimensions[0], left.rowValues[0], right.rowValues[0]);
            if (primaryComparison !== 0) return primaryComparison;
            if (left.total !== right.total) return right.total - left.total;
            for (let index = 1; index < rowDimensions.length; index += 1) {
                const comparison = compareValues(rowDimensions[index], left.rowValues[index], right.rowValues[index]);
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

    function buildCrossMatrix(records, dimensions, tab, area) {
        const selectedDimensions = Array.from(new Set((dimensions || []).filter(Boolean)));
        const safeRecords = Array.isArray(records) ? records : [];
        if (!selectedDimensions.length) return null;

        if (selectedDimensions.length === 1) {
            const primaryDimension = selectedDimensions[0];
            const counts = {};
            safeRecords.forEach((record) => {
                const label = normalizeCrossValue(record, primaryDimension, tab, area);
                counts[label] = (counts[label] || 0) + 1;
            });
            const orderedRows = sortSummaryRows(
                Object.keys(counts).map((label) => ({ label, count: counts[label] || 0 })),
                primaryDimension
            );
            const dataRows = orderedRows.map((item) => ({ type: 'data', cells: [item.label, item.count] }));
            const totalRow = { type: 'total', cells: ['Total general', safeRecords.length] };

            return {
                type: 'summary',
                selectedDimensions,
                dimensionPath: selectedDimensions.map((key) => getFieldLabel(key, tab)).join(' > '),
                headers: [getFieldLabel(primaryDimension, tab), 'Cantidad'],
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
        const rowMap = new Map();
        const columnValueSet = new Set();

        safeRecords.forEach((record) => {
            const rowValues = rowDimensions.map((dimension) => normalizeCrossValue(record, dimension, tab, area));
            const columnValue = normalizeCrossValue(record, columnDimension, tab, area);
            const rowKey = rowValues.join('||');
            if (!rowMap.has(rowKey)) {
                rowMap.set(rowKey, { rowValues, counts: {}, total: 0 });
            }
            const current = rowMap.get(rowKey);
            current.counts[columnValue] = (current.counts[columnValue] || 0) + 1;
            current.total += 1;
            columnValueSet.add(columnValue);
        });

        const columnValues = sortEntries(columnDimension, Array.from(columnValueSet));
        const rowEntries = sortPivotRows(Array.from(rowMap.values()), rowDimensions);
        const columnTotals = createEmptyCountMap(columnValues);
        const renderRows = [];
        const exportRows = [];
        const primaryTotals = rowEntries.reduce((acc, entry) => {
            acc[entry.rowValues[0]] = (acc[entry.rowValues[0]] || 0) + entry.total;
            return acc;
        }, {});
        let currentGroup = null;
        let groupAccumulator = createEmptyCountMap(columnValues);
        let groupTotal = 0;

        rowEntries.forEach((entry) => {
            const primaryLabel = entry.rowValues[0];
            const isNewGroup = primaryLabel !== currentGroup;

            if (rowDimensions.length > 1 && currentGroup !== null && isNewGroup) {
                const subtotalCells = [`Subtotal ${currentGroup}`, ...new Array(rowDimensions.length - 1).fill(''), ...columnValues.map((label) => groupAccumulator[label] || 0), groupTotal];
                renderRows.push({ type: 'subtotal', cells: subtotalCells });
                exportRows.push(subtotalCells);
                groupAccumulator = createEmptyCountMap(columnValues);
                groupTotal = 0;
            }

            if (rowDimensions.length > 1 && isNewGroup) {
                renderRows.push({
                    type: 'group',
                    colspan: rowDimensions.length + columnValues.length + 1,
                    label: `${getFieldLabel(rowDimensions[0], tab)}: ${primaryLabel}`,
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

            const exportCells = [...entry.rowValues, ...columnValues.map((label) => entry.counts[label] || 0), entry.total];
            const renderCells = [...(rowDimensions.length > 1 ? ['', ...entry.rowValues.slice(1)] : entry.rowValues), ...columnValues.map((label) => entry.counts[label] || 0), entry.total];
            renderRows.push({ type: 'data', cells: renderCells });
            exportRows.push(exportCells);
        });

        if (rowDimensions.length > 1 && currentGroup !== null) {
            const subtotalCells = [`Subtotal ${currentGroup}`, ...new Array(rowDimensions.length - 1).fill(''), ...columnValues.map((label) => groupAccumulator[label] || 0), groupTotal];
            renderRows.push({ type: 'subtotal', cells: subtotalCells });
            exportRows.push(subtotalCells);
        }

        const totalCells = ['Total general', ...new Array(rowDimensions.length - 1).fill(''), ...columnValues.map((label) => columnTotals[label] || 0), safeRecords.length];
        renderRows.push({ type: 'total', cells: totalCells });
        exportRows.push(totalCells);

        return {
            type: 'pivot',
            selectedDimensions,
            dimensionPath: selectedDimensions.map((key) => getFieldLabel(key, tab)).join(' > '),
            headers: rowDimensions.map((dimension) => getFieldLabel(dimension, tab)).concat(columnValues, 'Total'),
            renderRows,
            exportRows,
            primaryDimension: rowDimensions[0],
            primarySummary: sortSummaryRows(
                Object.keys(primaryTotals).map((label) => ({ label, count: primaryTotals[label] || 0 })),
                rowDimensions[0]
            ).map((item) => ({ label: item.label, count: item.count })),
            columnDimension,
            columnValues,
            columnSummary: columnValues.map((label) => ({ label, count: columnTotals[label] || 0 })),
            numericStartIndex: rowDimensions.length,
            baseRecords: safeRecords.length,
            combinations: rowEntries.length
        };
    }

    function buildExportPayload(matrix, context) {
        const badges = getActiveDemoBadges();
        return {
            kind: 'generic',
            title: `Cruce ajustable - ${context.config.label}`,
            subtitle: `${context.tabLabel} - ${matrix.dimensionPath}`,
            filenameBase: sanitizeFilename(`Cruce_${context.area}_${context.tab}_${matrix.selectedDimensions.join('_')}`),
            recordCount: matrix.baseRecords,
            summary: [
                ['Area', context.config.label],
                ['Pestana', context.tabLabel],
                ['Lapso solicitado', context.periodLabel || 'Periodo actual'],
                ['Cruce solicitado', matrix.dimensionPath],
                ['Registros base', matrix.baseRecords],
                ['Combinaciones visibles', matrix.combinations],
                ['Rango', `${formatDate(context.dateStart)} a ${formatDate(context.dateEnd)}`],
                ['Filtros activos', badges.length ? badges.join(' | ') : 'Sin filtros demograficos adicionales']
            ],
            highlights: [
                { label: 'Registros analizados', value: matrix.baseRecords.toLocaleString('es-MX'), hint: 'Subset visible del area actual.' },
                { label: 'Filas comparativas', value: matrix.combinations.toLocaleString('es-MX'), hint: 'Combinaciones unicas generadas en la tabla.' }
            ],
            dataTitle: 'Vista ajustable solicitada',
            detailSheetName: 'CruceMedico',
            columns: matrix.headers,
            rows: matrix.exportRows,
            pdfRows: matrix.exportRows.slice(0, 90),
            notes: [
                'La exportacion incluye solo la vista filtrada generada desde este modal.',
                'Respeta el area activa, el lapso elegido y los filtros demograficos visibles.'
            ],
            pdfOptions: {
                showDetailTable: true
            }
        };
    }

    function setCrossFeedback(message = '', tone = 'warning') {
        const feedbackEl = document.getElementById('medico-cross-feedback');
        if (!feedbackEl) return;
        if (!message) {
            feedbackEl.className = 'alert alert-warning rounded-4 d-none';
            feedbackEl.textContent = '';
            return;
        }
        feedbackEl.className = `alert alert-${tone} rounded-4`;
        feedbackEl.textContent = message;
    }

    function setCrossExportEnabled(enabled) {
        ['medico-cross-export-excel', 'medico-cross-export-pdf'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.disabled = !enabled;
        });
    }

    function renderCrossLauncher(config, tabLabel) {
        return `
            <div class="card border-0 shadow-sm rounded-4 reportes-medico-cross-hero" style="background:linear-gradient(135deg, ${hexToRgba(config.accent, 0.98)}, ${hexToRgba(config.accent, 0.82)});">
                <div class="card-body p-4">
                    <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
                        <div class="text-white">
                            <div class="small fw-bold text-uppercase mb-2 opacity-75">Vista ajustable visible</div>
                            <h5 class="fw-bold mb-2">${escapeHtml(config.label)} · ${escapeHtml(tabLabel)}</h5>
                            <p class="mb-0 opacity-90">${escapeHtml(config.heroHint)}</p>
                        </div>
                        <div class="d-flex flex-column align-items-lg-end gap-2">
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <span class="badge rounded-pill text-bg-light border">Carrera</span>
                                <span class="badge rounded-pill text-bg-light border">Genero</span>
                                <span class="badge rounded-pill text-bg-light border">Estado</span>
                            </div>
                            <button class="btn btn-light btn-lg rounded-pill px-4 fw-bold shadow-sm" onclick="Reportes.Medico.openCrossModal()">
                                <i class="bi bi-sliders2 me-2"></i>Seleccionar vista
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCrossModal(context) {
        const selection = getCrossSelection(context.area, context.tab);
        const options = getFieldOptions(context.tab);
        const selectedPeriod = getCrossPeriod(context.area, context.tab);
        const badges = getActiveDemoBadges();
        const renderSelectOptions = (selectedValue) => [
            '<option value="">Sin usar</option>',
            ...options.map((field) => `<option value="${escapeHtml(field.key)}" ${selectedValue === field.key ? 'selected' : ''}>${escapeHtml(field.label)}</option>`)
        ].join('');

        return `
            <div class="modal fade" id="${CROSS_MODAL_ID}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content border-0 shadow rounded-4">
                        <div class="modal-header border-0 pb-2">
                            <div>
                                <h5 class="modal-title fw-bold mb-1">Vista ajustable de ${escapeHtml(context.config.label)}</h5>
                                <div class="text-muted small">${escapeHtml(context.tabLabel)} - La lectura respeta el periodo y los filtros visibles.</div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body pt-0 reportes-medico-cross-modal-body">
                            <div class="rounded-4 border p-3 mb-3 reportes-medico-cross-filter-panel">
                                <div class="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3">
                                    <div>
                                        <div class="fw-semibold text-dark">Selecciona el lapso y el cruce a comparar</div>
                                        <div class="small text-muted">Pensado para lectura ordenada y exportacion puntual.</div>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        <button class="btn btn-primary btn-sm rounded-pill px-4" onclick="Reportes.Medico.applyCrossConfig()">
                                            <i class="bi bi-funnel me-2"></i>Actualizar vista
                                        </button>
                                        <button class="btn btn-outline-secondary btn-sm rounded-pill px-4" onclick="Reportes.Medico.resetCrossConfig()">
                                            <i class="bi bi-arrow-counterclockwise me-2"></i>Restablecer
                                        </button>
                                    </div>
                                </div>
                                <div class="row g-2 align-items-end">
                                    <div class="col-xl-3 col-md-6">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-period">Lapso</label>
                                        <select class="form-select form-select-sm rounded-4" id="medico-cross-period" onchange="Reportes.Medico.onCrossPeriodChange()">
                                            ${CROSS_PERIODS.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedPeriod === item.id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div id="medico-cross-period-detail-wrap" class="contents">
                                        ${renderPeriodDetailControls(context.area, context.tab, selectedPeriod)}
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-primary">Primero</label>
                                        <select class="form-select form-select-sm rounded-4" id="medico-cross-primary">
                                            ${options.map((field) => `<option value="${escapeHtml(field.key)}" ${selection.primary === field.key ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-secondary">Luego</label>
                                        <select class="form-select form-select-sm rounded-4" id="medico-cross-secondary">
                                            ${renderSelectOptions(selection.secondary)}
                                        </select>
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="medico-cross-tertiary">Columnas</label>
                                        <select class="form-select form-select-sm rounded-4" id="medico-cross-tertiary">
                                            ${renderSelectOptions(selection.tertiary)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="medico-cross-feedback" class="alert alert-warning rounded-4 d-none"></div>

                            <div class="d-flex flex-wrap gap-2 mb-3">
                                ${badges.length
                ? badges.map((badge) => `<span class="badge rounded-pill text-bg-light border">${escapeHtml(badge)}</span>`).join('')
                : '<span class="badge rounded-pill text-bg-light border">Sin filtros demograficos adicionales</span>'}
                            </div>

                            <div id="medico-cross-preview"></div>
                        </div>
                        <div class="modal-footer border-0 pt-0 d-flex justify-content-between flex-wrap gap-2">
                            <div class="small text-muted">Exporta solo la vista generada desde este modal.</div>
                            <div class="d-flex flex-wrap gap-2">
                                <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">
                                    <i class="bi bi-x-circle me-2"></i>Salir
                                </button>
                                <button class="btn btn-outline-success rounded-pill px-4" id="medico-cross-export-excel" onclick="Reportes.Medico.exportCross('excel')">
                                    <i class="bi bi-file-earmark-excel me-2"></i>Excel
                                </button>
                                <button class="btn btn-outline-danger rounded-pill px-4" id="medico-cross-export-pdf" onclick="Reportes.Medico.exportCross('pdf')">
                                    <i class="bi bi-file-earmark-pdf me-2"></i>PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCrossPreview(matrix, context, periodLabel = 'Periodo actual', dateStart = null, dateEnd = null) {
        const previewEl = document.getElementById('medico-cross-preview');
        if (!previewEl) return;

        if (!matrix) {
            previewEl.innerHTML = `
                <div class="rounded-4 border border-dashed p-4 text-center text-muted">
                    Configura al menos un cruce para ver la tabla comparativa.
                </div>
            `;
            return;
        }

        const renderTableRow = (row) => {
            if (row.colspan) {
                return `
                    <tr class="reportes-medico-cross-row-${escapeHtml(row.type)}">
                        <td colspan="${row.colspan}">
                            <div class="reportes-medico-cross-group-row">
                                <span class="reportes-medico-cross-group-title">${escapeHtml(row.label)}</span>
                                <span class="reportes-medico-cross-group-meta">${escapeHtml(row.meta || '')}</span>
                            </div>
                        </td>
                    </tr>
                `;
            }

            const cellsHtml = row.cells.map((cell, index) => {
                const numericClass = index >= matrix.numericStartIndex ? 'text-end fw-semibold' : '';
                const emptyClass = cell === '' ? 'reportes-medico-cross-empty-cell' : '';
                return `<td class="${numericClass} ${emptyClass}">${escapeHtml(cell)}</td>`;
            }).join('');

            return `<tr class="reportes-medico-cross-row-${escapeHtml(row.type)}">${cellsHtml}</tr>`;
        };

        previewEl.innerHTML = `
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-0">
                    <div class="d-flex flex-column gap-3 p-4 pb-3">
                        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                            <div>
                                <h5 class="fw-bold mb-1">Matriz comparativa solicitada</h5>
                                <div class="text-muted small">${escapeHtml(context.config.label)} · ${escapeHtml(periodLabel)}</div>
                                <div class="small text-muted mt-1">${escapeHtml(formatDate(dateStart))} a ${escapeHtml(formatDate(dateEnd))}</div>
                            </div>
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <span class="badge rounded-pill text-bg-light border">${escapeHtml(matrix.dimensionPath)}</span>
                                <span class="badge rounded-pill text-bg-light border">${escapeHtml(chartsSafeNumber(matrix.baseRecords))} registros</span>
                            </div>
                        </div>
                        <div class="d-flex flex-wrap gap-2">
                            ${(matrix.columnSummary || []).length
                ? matrix.columnSummary.map((item) => `<span class="badge rounded-pill" style="background:${hexToRgba(context.config.accent, 0.12)}; color:${context.config.accent};">${escapeHtml(item.label)}: ${escapeHtml(chartsSafeNumber(item.count))}</span>`).join('')
                : `<span class="text-muted small">Lectura resumida sin columnas comparativas adicionales.</span>`}
                        </div>
                    </div>
                    <div class="table-responsive reportes-medico-cross-table-wrap">
                        <table class="table table-sm align-middle mb-0 reportes-medico-cross-table">
                            <thead>
                                <tr>${matrix.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                            </thead>
                            <tbody>
                                ${matrix.renderRows.map((row) => renderTableRow(row)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    async function applyCrossConfig() {
        const context = getCurrentContext();
        const previewEl = document.getElementById('medico-cross-preview');
        if (!previewEl) return;

        if (!context.supported) {
            setCrossFeedback('La vista ajustable no aplica en esta pestaña.');
            renderCrossPreview(null, context);
            setCrossExportEnabled(false);
            _crossState.matrix = null;
            _crossState.exportPayload = null;
            return;
        }

        const primary = document.getElementById('medico-cross-primary')?.value || '';
        const secondary = document.getElementById('medico-cross-secondary')?.value || '';
        const tertiary = document.getElementById('medico-cross-tertiary')?.value || '';
        const period = document.getElementById('medico-cross-period')?.value || 'current';
        const periodMeta = readPeriodMeta(period);
        const validationMessage = validatePeriodMeta(period, periodMeta);
        const selected = [primary, secondary, tertiary].filter(Boolean);

        if (!primary) {
            setCrossFeedback('Selecciona al menos el agrupador principal para construir la tabla.');
            renderCrossPreview(null, context);
            setCrossExportEnabled(false);
            return;
        }

        if (new Set(selected).size !== selected.length) {
            setCrossFeedback('Cada nivel del cruce debe usar una dimension distinta.');
            renderCrossPreview(null, context);
            setCrossExportEnabled(false);
            return;
        }

        if (validationMessage) {
            setCrossFeedback(validationMessage);
            renderCrossPreview(null, context);
            setCrossExportEnabled(false);
            return;
        }

        setCrossSelection(context.area, context.tab, { primary, secondary, tertiary });
        setCrossPeriod(context.area, context.tab, period);
        setCrossPeriodMeta(context.area, context.tab, periodMeta);
        _crossState.activeScope = getScopeKey(context.area, context.tab);
        previewEl.innerHTML = `
            <div class="rounded-4 border p-4 text-center text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Preparando vista ajustable para ${escapeHtml(getPeriodLabel(period).toLowerCase())}...
            </div>
        `;
        setCrossExportEnabled(false);

        const cacheKey = JSON.stringify({
            scope: _crossState.activeScope,
            selected,
            period,
            periodMeta,
            demoFilters: S().demoFilters || {},
            dateStart: S().dateStart ? S().dateStart.toISOString() : null,
            dateEnd: S().dateEnd ? S().dateEnd.toISOString() : null
        });
        const cached = _crossState.previewCache.get(cacheKey);
        if (cached) {
            _crossState.matrix = cached.matrix;
            _crossState.exportPayload = cached.exportPayload;
            _crossState.dateStart = cached.dateStart;
            _crossState.dateEnd = cached.dateEnd;
            _crossState.periodLabel = cached.periodLabel;
            setCrossFeedback('');
            renderCrossPreview(cached.matrix, context, cached.periodLabel, cached.dateStart, cached.dateEnd);
            setCrossExportEnabled(!!cached.exportPayload);
            return;
        }

        try {
            const dataset = await resolveCrossDataset(context, period, periodMeta);
            if (!dataset.records.length) {
                setCrossFeedback('No hay registros visibles para construir el cruce con la configuracion actual.', 'info');
                renderCrossPreview(null, context, dataset.periodLabel, dataset.dateStart, dataset.dateEnd);
                _crossState.matrix = null;
                _crossState.exportPayload = null;
                _crossState.dateStart = dataset.dateStart;
                _crossState.dateEnd = dataset.dateEnd;
                _crossState.periodLabel = dataset.periodLabel;
                return;
            }

            const exportContext = { ...context, periodLabel: dataset.periodLabel, dateStart: dataset.dateStart, dateEnd: dataset.dateEnd };
            const matrix = buildCrossMatrix(dataset.records, selected, context.tab, context.area);
            const exportPayload = matrix ? buildExportPayload(matrix, exportContext) : null;
            _crossState.matrix = matrix;
            _crossState.exportPayload = exportPayload;
            _crossState.dateStart = dataset.dateStart;
            _crossState.dateEnd = dataset.dateEnd;
            _crossState.periodLabel = dataset.periodLabel;
            _crossState.previewCache.set(cacheKey, {
                matrix,
                exportPayload,
                dateStart: dataset.dateStart,
                dateEnd: dataset.dateEnd,
                periodLabel: dataset.periodLabel
            });
            setCrossFeedback('');
            renderCrossPreview(matrix, context, dataset.periodLabel, dataset.dateStart, dataset.dateEnd);
            setCrossExportEnabled(!!exportPayload);
        } catch (error) {
            console.error('[Reportes.Medico] Error generando vista ajustable:', error);
            setCrossFeedback('No se pudo cargar el lapso solicitado para esta vista.', 'danger');
            renderCrossPreview(null, context, getPeriodLabel(period));
            _crossState.matrix = null;
            _crossState.exportPayload = null;
        }
    }

    function resetCrossConfig() {
        const context = getCurrentContext();
        if (!context.supported) return;
        const defaults = { ...(CROSS_DEFAULTS[context.tab] || CROSS_DEFAULTS.consultas) };
        setCrossSelection(context.area, context.tab, defaults);
        setCrossPeriod(context.area, context.tab, 'current');
        setCrossPeriodMeta(context.area, context.tab, {
            monthRef: getCurrentMonthRef(),
            quarterYear: getCurrentQuarterMeta().year,
            quarterNumber: getCurrentQuarterMeta().quarter,
            customStart: toDateInputValue(S().dateStart),
            customEnd: toDateInputValue(S().dateEnd)
        });

        const primary = document.getElementById('medico-cross-primary');
        const secondary = document.getElementById('medico-cross-secondary');
        const tertiary = document.getElementById('medico-cross-tertiary');
        const period = document.getElementById('medico-cross-period');
        if (primary) primary.value = defaults.primary;
        if (secondary) secondary.value = defaults.secondary;
        if (tertiary) tertiary.value = defaults.tertiary;
        if (period) period.value = 'current';
        onCrossPeriodChange();
        void applyCrossConfig();
    }

    function openCrossModal() {
        const context = getCurrentContext();
        if (!context.supported) {
            alert('La vista ajustable no aplica en esta pestaña.');
            return;
        }
        const modal = document.getElementById(CROSS_MODAL_ID);
        if (!modal) return;

        const selection = getCrossSelection(context.area, context.tab);
        const period = getCrossPeriod(context.area, context.tab);
        const primary = document.getElementById('medico-cross-primary');
        const secondary = document.getElementById('medico-cross-secondary');
        const tertiary = document.getElementById('medico-cross-tertiary');
        const periodSelect = document.getElementById('medico-cross-period');
        if (primary) primary.value = selection.primary;
        if (secondary) secondary.value = selection.secondary;
        if (tertiary) tertiary.value = selection.tertiary;
        if (periodSelect) periodSelect.value = period;
        onCrossPeriodChange();
        void applyCrossConfig();
        new bootstrap.Modal(modal).show();
    }

    async function exportCross(format) {
        const payload = _crossState.exportPayload;
        const context = getCurrentContext();
        if (!payload || !_crossState.matrix) {
            alert('Primero genera una vista valida dentro del modal.');
            return;
        }

        const selectedPeriod = getCrossPeriod(context.area, context.tab);
        const config = {
            period: selectedPeriod === 'current' ? (S().presetPeriod || 'current') : selectedPeriod,
            dateStart: _crossState.dateStart,
            dateEnd: _crossState.dateEnd
        };

        if (format === 'pdf') {
            await window.ExportUtils.generatePDF(config, payload, context.area);
        } else {
            window.ExportUtils.generateExcel(config, payload, context.area);
        }
    }

    function groupByDay(data) {
        const map = {};
        (Array.isArray(data) ? data : []).forEach((item) => {
            const date = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
            if (Number.isNaN(date.getTime())) return;
            const key = `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
            map[key] = (map[key] || 0) + 1;
        });
        return map;
    }

    function groupByHour(data) {
        const hours = new Array(24).fill(0);
        (Array.isArray(data) ? data : []).forEach((item) => {
            const hour = Number.parseInt(item.hora, 10);
            if (Number.isFinite(hour) && hour >= 0 && hour < 24) hours[hour] += 1;
        });
        return hours;
    }

    function countBy(data, getter) {
        const counts = {};
        (Array.isArray(data) ? data : []).forEach((item) => {
            const label = getter(item);
            counts[label] = (counts[label] || 0) + 1;
        });
        return counts;
    }

    function getTopEntry(map, fallback = 'Sin dato') {
        return Object.entries(map || {}).sort((left, right) => right[1] - left[1])[0]?.[0] || fallback;
    }

    function renderUnavailable(container, message) {
        container.innerHTML = `
            <div class="alert alert-info rounded-4 shadow-sm">
                <i class="bi bi-info-circle me-2"></i>${escapeHtml(message)}
            </div>
        `;
    }

    function renderConsultas(container, data) {
        const charts = H();
        const chartRegistry = R();
        const area = getCurrentAreaKey();
        const config = getAreaConfig(area);
        const tabLabel = getTabs().find((item) => item.id === 'consultas')?.label || 'Consultas';
        const records = filterAreaRecords(data, area);
        const closedStatuses = new Set(['finalizada', 'finalizado', 'completada', 'cerrada', 'confirmada']);
        const uniquePatients = new Set(records.map((item) => item._uid || item.matricula).filter(Boolean)).size;
        const completed = records.filter((item) => closedStatuses.has(String(item.statusCode || item.status || '').toLowerCase())).length;
        const dayMap = groupByDay(records);
        const allDays = Object.keys(dayMap).sort();
        const hours = groupByHour(records);
        const statusMap = countBy(records, (item) => toTitleCase(item.status || 'Sin dato'));
        const professionalMap = countBy(records, (item) => String(item.profesional || 'Sin asignar').trim() || 'Sin asignar');
        const topProfessional = getTopEntry(professionalMap, 'Sin asignar');

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                ${renderCrossLauncher(config, tabLabel)}

                <div class="row g-3">
                    ${charts.renderKPICard({ title: 'Total consultas', value: charts.formatNumber(records.length), icon: config.icon, color: area === 'MEDICO' ? 'primary' : 'info' })}
                    ${charts.renderKPICard({ title: 'Pacientes unicos', value: charts.formatNumber(uniquePatients), icon: 'bi-people', color: 'success' })}
                    ${charts.renderKPICard({ title: 'Completadas', value: charts.formatNumber(completed), icon: 'bi-check2-circle', color: 'warning' })}
                    ${charts.renderKPICard({ title: 'Profesional con mas carga', value: escapeHtml(topProfessional), icon: 'bi-person-badge', color: 'secondary' })}
                </div>

                <div class="row g-4">
                    <div class="col-12">
                        ${charts.renderChartCard(`Tendencia diaria de ${config.tabLabel}`, 'medico-consult-line')}
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Estado de atenciones', 'medico-consult-status-pie')}
                    </div>
                    <div class="col-lg-6">
                        ${charts.renderChartCard('Consultas por hora del dia', 'medico-consult-hour-bar')}
                    </div>
                </div>

                ${renderCrossModal(getCurrentContext())}
                ${renderSharedStyles()}
            </div>
        `;

        setTimeout(() => {
            chartRegistry['medico-consult-line'] = charts.createLineChart('medico-consult-line', {
                labels: allDays.map((day) => new Date(`${day}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })),
                datasets: [{
                    label: config.label,
                    data: allDays.map((day) => dayMap[day] || 0),
                    borderColor: config.accent,
                    backgroundColor: `${config.accent}22`,
                    fill: true,
                    tension: 0.35
                }]
            });

            chartRegistry['medico-consult-status-pie'] = charts.createDoughnutChart('medico-consult-status-pie', {
                labels: Object.keys(statusMap),
                data: Object.values(statusMap),
                colors: [config.accent, charts.COLORS.success, charts.COLORS.warning, charts.COLORS.secondary || '#64748b']
            });

            chartRegistry['medico-consult-hour-bar'] = charts.createBarChart('medico-consult-hour-bar', {
                labels: Array.from({ length: 24 }, (_, index) => `${padNumber(index)}:00`),
                datasets: [{
                    label: 'Atenciones',
                    data: hours,
                    backgroundColor: config.accent
                }]
            });
        }, 50);
    }

    function renderRankedItem(position, name, count, total, tone, detailType = '') {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        const interactiveAttrs = detailType
            ? ` role="button" tabindex="0" style="cursor:pointer;" data-diagnostico="${escapeHtml(name)}" data-detail-type="${escapeHtml(detailType)}" onclick="Reportes.openDiagnosticoDetail(this.dataset.diagnostico, this.dataset.detailType)" onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();Reportes.openDiagnosticoDetail(this.dataset.diagnostico, this.dataset.detailType);}"`
            : '';
        return `
            <div class="list-group-item border-0 px-0 py-2 d-flex align-items-center gap-3"${interactiveAttrs}>
                <span class="badge bg-${tone} bg-opacity-10 text-${tone} rounded-circle d-flex align-items-center justify-content-center" style="width: 28px; height: 28px; font-size: 0.75rem;">${position}</span>
                <div class="flex-grow-1">
                    <div class="small fw-semibold">${escapeHtml(name)}</div>
                    <div class="progress mt-1" style="height: 4px;">
                        <div class="progress-bar bg-${tone}" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="text-end">
                    <span class="fw-bold small">${escapeHtml(count)}</span>
                    <span class="text-muted small ms-1">(${escapeHtml(pct)}%)</span>
                </div>
            </div>
        `;
    }

    function renderDiagnosticos(container, data) {
        const charts = H();
        const chartRegistry = R();
        const area = getCurrentAreaKey();
        const config = getAreaConfig(area);
        const tabLabel = getTabs().find((item) => item.id === 'diagnosticos')?.label || 'Diagnosticos';
        const records = filterAreaRecords(data, area).filter((item) => {
            const status = String(item.statusCode || item.status || '').toLowerCase();
            return ['finalizada', 'finalizado', 'completada', 'cerrada'].includes(status);
        });
        const diagnosisMap = {};

        records.forEach((item) => {
            const diagnosis = categorizeSimilar(item.diagnostico || item.detalle || '');
            if (!diagnosis || diagnosis === 'General') return;
            diagnosisMap[diagnosis] = (diagnosisMap[diagnosis] || 0) + 1;
        });

        const topDiagnoses = Object.entries(diagnosisMap).sort((left, right) => right[1] - left[1]).slice(0, 12);
        const total = topDiagnoses.reduce((sum, [, count]) => sum + count, 0);
        const detailType = area === 'MEDICO' ? 'meddiag' : 'psicodiag';

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                ${renderCrossLauncher(config, tabLabel)}

                <div class="row g-4">
                    <div class="col-lg-7">
                        ${charts.renderChartCard(`Top motivos de ${config.tabLabel}`, 'medico-diag-main-bar')}
                    </div>
                    <div class="col-lg-5">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <div class="d-flex align-items-center justify-content-between mb-3">
                                    <h6 class="fw-bold mb-0">Ranking priorizado</h6>
                                    <span class="badge rounded-pill text-bg-light border">${escapeHtml(chartsSafeNumber(records.length))} registros</span>
                                </div>
                                <div class="list-group list-group-flush">
                                    ${topDiagnoses.length
                ? topDiagnoses.map(([name, count], index) => renderRankedItem(index + 1, name, count, total, area === 'MEDICO' ? 'primary' : 'info', detailType)).join('')
                : '<p class="text-muted small mb-0">Sin diagnosticos cerrados disponibles.</p>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                ${renderCrossModal(getCurrentContext())}
                ${renderSharedStyles()}
            </div>
        `;

        setTimeout(() => {
            if (topDiagnoses.length > 0) {
                chartRegistry['medico-diag-main-bar'] = charts.createBarChart('medico-diag-main-bar', {
                    labels: topDiagnoses.map(([name]) => name.length > 35 ? `${name.substring(0, 32)}...` : name),
                    datasets: [{
                        label: 'Casos',
                        data: topDiagnoses.map(([, count]) => count),
                        backgroundColor: config.accent
                    }]
                }, { horizontal: true });
            }
        }, 50);
    }

    function renderPerfil(container) {
        const charts = H();
        const chartRegistry = R();
        const expedientes = Array.isArray(S().extraData?.expedientes) ? S().extraData.expedientes : [];

        if (!expedientes.length) {
            container.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-5">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-3" role="status"><span class="visually-hidden">Cargando...</span></div>
                        <p class="text-muted">Cargando datos de expedientes clinicos...</p>
                    </div>
                </div>
            `;
            return;
        }

        const bloodMap = countBy(expedientes, (item) => item.tipoSangre || 'No especificado');
        const cronicasMap = {};
        const alergiasMap = {};
        expedientes.forEach((item) => {
            const cronicas = Array.isArray(item.enfermedadesCronicas) ? item.enfermedadesCronicas : [item.enfermedadesCronicas];
            cronicas.filter(Boolean).forEach((name) => {
                const safe = String(name).trim();
                if (safe && safe.toLowerCase() !== 'ninguna') cronicasMap[safe] = (cronicasMap[safe] || 0) + 1;
            });

            const alergias = Array.isArray(item.alergias) ? item.alergias : [item.alergias];
            alergias.filter(Boolean).forEach((name) => {
                const safe = String(name).trim();
                if (safe && safe.toLowerCase() !== 'ninguna') alergiasMap[safe] = (alergiasMap[safe] || 0) + 1;
            });
        });
        const topCronicas = Object.entries(cronicasMap).sort((left, right) => right[1] - left[1]).slice(0, 10);
        const topAlergias = Object.entries(alergiasMap).sort((left, right) => right[1] - left[1]).slice(0, 10);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                <div class="row g-3">
                    ${charts.renderKPICard({ title: 'Total expedientes', value: charts.formatNumber(expedientes.length), icon: 'bi-folder2-open', color: 'primary' })}
                    ${charts.renderKPICard({ title: 'Con condiciones cronicas', value: charts.formatNumber(Object.values(cronicasMap).reduce((sum, value) => sum + value, 0)), icon: 'bi-heart-pulse', color: 'warning' })}
                </div>
                <div class="row g-4">
                    <div class="col-lg-4">${charts.renderChartCard('Tipo de sangre', 'medico-perfil-blood-doughnut')}</div>
                    <div class="col-lg-4">${charts.renderChartCard('Enfermedades cronicas', 'medico-perfil-cronicas-bar')}</div>
                    <div class="col-lg-4">${charts.renderChartCard('Alergias principales', 'medico-perfil-alergias-bar')}</div>
                </div>
                ${renderSharedStyles()}
            </div>
        `;

        setTimeout(() => {
            chartRegistry['medico-perfil-blood-doughnut'] = charts.createDoughnutChart('medico-perfil-blood-doughnut', {
                labels: Object.keys(bloodMap),
                data: Object.values(bloodMap)
            });
            if (topCronicas.length) {
                chartRegistry['medico-perfil-cronicas-bar'] = charts.createBarChart('medico-perfil-cronicas-bar', {
                    labels: topCronicas.map(([name]) => name.length > 25 ? `${name.substring(0, 22)}...` : name),
                    datasets: [{ label: 'Pacientes', data: topCronicas.map(([, count]) => count), backgroundColor: charts.COLORS.warning }]
                }, { horizontal: true });
            }
            if (topAlergias.length) {
                chartRegistry['medico-perfil-alergias-bar'] = charts.createBarChart('medico-perfil-alergias-bar', {
                    labels: topAlergias.map(([name]) => name.length > 25 ? `${name.substring(0, 22)}...` : name),
                    datasets: [{ label: 'Pacientes', data: topAlergias.map(([, count]) => count), backgroundColor: charts.COLORS.danger }]
                }, { horizontal: true });
            }
        }, 50);
    }

    function renderSharedStyles() {
        return `
            <style>
                .reportes-medico-cross-hero { overflow: hidden; }
                .reportes-medico-cross-modal-body { overflow: hidden; }
                .reportes-medico-cross-filter-panel {
                    background:
                        radial-gradient(circle at top right, ${hexToRgba('#0ea5e9', 0.08)}, transparent 38%),
                        linear-gradient(180deg, #fbfdff 0%, #f8fbff 100%);
                    border-color: #bfdbfe !important;
                }
                .reportes-medico-cross-filter-panel .form-select,
                .reportes-medico-cross-filter-panel .form-control {
                    border-color: #bfdbfe;
                    background-color: rgba(255, 255, 255, 0.98);
                }
                .reportes-medico-cross-filter-panel .form-select:focus,
                .reportes-medico-cross-filter-panel .form-control:focus {
                    border-color: #0ea5e9;
                    box-shadow: 0 0 0 0.2rem rgba(14, 165, 233, 0.14);
                }
                .contents { display: contents; }
                .reportes-medico-cross-table-wrap {
                    max-height: none;
                    overflow-x: auto;
                    overflow-y: hidden;
                }
                .reportes-medico-cross-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    background: #eff6ff;
                    color: #0c4a6e;
                    border-bottom-width: 1px;
                    white-space: nowrap;
                }
                .reportes-medico-cross-table tbody td {
                    white-space: nowrap;
                    vertical-align: middle;
                    border-color: #e2e8f0;
                    padding-top: 0.7rem;
                    padding-bottom: 0.7rem;
                }
                .reportes-medico-cross-table tbody tr.reportes-medico-cross-row-data:nth-child(even) td { background: #fbfdff; }
                .reportes-medico-cross-table tbody tr.reportes-medico-cross-row-data:hover td { background: #f5fbff; }
                .reportes-medico-cross-empty-cell { color: transparent; }
                .reportes-medico-cross-row-group td {
                    background: linear-gradient(90deg, #eff6ff 0%, #f8fbff 100%);
                    border-top: 2px solid #7dd3fc;
                    border-bottom: 1px solid #bae6fd;
                    padding-top: 0.8rem;
                    padding-bottom: 0.8rem;
                }
                .reportes-medico-cross-group-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }
                .reportes-medico-cross-group-title {
                    font-weight: 800;
                    color: #0c4a6e;
                    letter-spacing: 0.01em;
                }
                .reportes-medico-cross-group-meta {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.2rem 0.7rem;
                    border-radius: 999px;
                    background: rgba(14, 165, 233, 0.08);
                    color: #0369a1;
                    font-size: 0.8rem;
                    font-weight: 700;
                }
                .reportes-medico-cross-row-subtotal td {
                    background: #eff6ff;
                    font-weight: 700;
                    color: #0c4a6e;
                    border-top: 1px dashed #7dd3fc;
                }
                .reportes-medico-cross-row-total td {
                    background: linear-gradient(90deg, #dbeafe 0%, #eff6ff 100%);
                    font-weight: 700;
                    color: #1d4ed8;
                    border-top: 2px solid #60a5fa;
                }
                @media (max-width: 991.98px) {
                    .reportes-medico-cross-filter-panel .btn { width: 100%; }
                }
            </style>
        `;
    }

    return {
        render,
        getTabs,
        categorizeSimilar,
        openCrossModal,
        onCrossPeriodChange,
        applyCrossConfig,
        resetCrossConfig,
        exportCross
    };
})();
