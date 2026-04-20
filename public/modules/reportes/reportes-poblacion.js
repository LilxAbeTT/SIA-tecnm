/**
 * Reportes - Modulo Poblacion SIA
 * Incluye dashboards y una vista ajustable tipo Biblioteca.
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-poblacion.js cargado, window.Reportes keys:', Object.keys(window.Reportes));

window.Reportes.Poblacion = (function () {
    'use strict';

    const H = () => Reportes.Charts;
    const S = () => Reportes.getState();
    const R = () => Reportes.getChartRegistry();
    const CROSS_MODAL_ID = 'reportesPoblacionCrossModal';
    const CROSS_PERIODS = [
        { id: 'current', label: 'Periodo actual' },
        { id: 'daily', label: 'Hoy' },
        { id: 'monthly', label: 'Mes' },
        { id: 'quarterly', label: 'Trimestre' },
        { id: 'custom', label: 'Entre fechas' }
    ];
    const CROSS_FIELDS = {
        demografia: [
            { key: 'subarea', label: 'Tipo de perfil' },
            { key: 'carrera', label: 'Carrera' },
            { key: 'genero', label: 'Genero' },
            { key: 'turno', label: 'Turno' },
            { key: 'generacion', label: 'Generacion' },
            { key: 'estadoCivil', label: 'Estado civil' }
        ],
        salud: [
            { key: 'subarea', label: 'Tipo de perfil' },
            { key: 'carrera', label: 'Carrera' },
            { key: 'genero', label: 'Genero' },
            { key: 'turno', label: 'Turno' },
            { key: 'apoyoPsico', label: 'Requiere apoyo psico' },
            { key: 'usaLentes', label: 'Usa lentes' },
            { key: 'discapacidadFlag', label: 'Tiene discapacidad' }
        ],
        socioeconomico: [
            { key: 'subarea', label: 'Tipo de perfil' },
            { key: 'carrera', label: 'Carrera' },
            { key: 'genero', label: 'Genero' },
            { key: 'turno', label: 'Turno' },
            { key: 'beca', label: 'Beca' },
            { key: 'trabaja', label: 'Trabaja' },
            { key: 'idiomaFlag', label: 'Idioma extra' }
        ]
    };
    const CROSS_DEFAULTS = {
        demografia: { primary: 'subarea', secondary: 'carrera', tertiary: 'genero' },
        salud: { primary: 'apoyoPsico', secondary: 'carrera', tertiary: 'genero' },
        socioeconomico: { primary: 'beca', secondary: 'carrera', tertiary: 'genero' }
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
        activeTab: 'demografia',
        previewCache: new Map()
    };

    function getTabs() {
        return [
            { id: 'demografia', label: 'Demografia', icon: 'bi-bar-chart' },
            { id: 'salud', label: 'Salud', icon: 'bi-hospital' },
            { id: 'socioeconomico', label: 'Socioeconomico', icon: 'bi-cash-stack' }
        ];
    }

    function render(container) {
        const state = S();
        const tab = state.currentTab || 'demografia';

        switch (tab) {
            case 'salud':
                renderSalud(container, state.filteredData);
                break;
            case 'socioeconomico':
                renderSocioeconomico(container, state.filteredData);
                break;
            default:
                renderDemografia(container, state.filteredData);
                break;
        }
    }

    function toTitleCase(value) {
        return String(value || 'Sin dato')
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Sin dato';
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function chartsSafeNumber(value) {
        return Number(value || 0).toLocaleString('es-MX');
    }

    function hexToRgba(hex, alpha) {
        const normalized = String(hex || '#0f766e').replace('#', '');
        const full = normalized.length === 3
            ? normalized.split('').map((char) => char + char).join('')
            : normalized.padEnd(6, '0').slice(0, 6);
        const intValue = Number.parseInt(full, 16);
        const r = (intValue >> 16) & 255;
        const g = (intValue >> 8) & 255;
        const b = intValue & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

    function sanitizeFilename(value) {
        return String(value || 'Cruce_Poblacion')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') || 'Cruce_Poblacion';
    }

    function normalizeGeneroLabel(value) {
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return 'Sin dato';
        if (lower.startsWith('m')) return 'Mujer';
        if (lower.startsWith('h')) return 'Hombre';
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

    function normalizeSubareaLabel(value) {
        const map = {
            ESTUDIANTE: 'Estudiante',
            DOCENTE: 'Docente',
            ADMINISTRATIVO: 'Administrativo',
            ADMIN_MODULO: 'Admin de modulo'
        };
        return map[String(value || '').trim().toUpperCase()] || toTitleCase(value);
    }

    function normalizeYesNo(value, defaultValue = 'No') {
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return defaultValue;
        if (['si', 'sí', 'yes', 'true'].includes(lower)) return 'Si';
        if (['no', 'false'].includes(lower)) return 'No';
        return toTitleCase(value);
    }

    function splitListValue(value) {
        if (Array.isArray(value)) return value.flatMap(splitListValue);
        return String(value || '')
            .split(/[,;/]+/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function normalizeCategoryLabel(value) {
        const label = String(value || '').trim();
        if (!label) return '';
        return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    }

    function getCurrentMonthRef() {
        const now = new Date();
        return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}`;
    }

    function getCurrentQuarterMeta() {
        const now = new Date();
        return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
    }

    function getFieldOptions(tab = S().currentTab || 'demografia') {
        return CROSS_FIELDS[tab] || CROSS_FIELDS.demografia;
    }

    function getFieldLabel(fieldKey, tab) {
        return getFieldOptions(tab).find((field) => field.key === fieldKey)?.label || fieldKey;
    }

    function getSelection(tab = S().currentTab || 'demografia') {
        if (!_crossState.selections[tab]) {
            _crossState.selections[tab] = { ...(CROSS_DEFAULTS[tab] || CROSS_DEFAULTS.demografia) };
        }
        return _crossState.selections[tab];
    }

    function setSelection(tab, selection) {
        _crossState.selections[tab] = {
            ...(CROSS_DEFAULTS[tab] || CROSS_DEFAULTS.demografia),
            ...(selection || {})
        };
    }

    function getPeriod(tab = S().currentTab || 'demografia') {
        return _crossState.periods[tab] || 'current';
    }

    function setPeriod(tab, period) {
        _crossState.periods[tab] = period || 'current';
    }

    function getPeriodMeta(tab = S().currentTab || 'demografia') {
        if (!_crossState.periodMeta[tab]) {
            const quarterMeta = getCurrentQuarterMeta();
            _crossState.periodMeta[tab] = {
                monthRef: getCurrentMonthRef(),
                quarterYear: quarterMeta.year,
                quarterNumber: quarterMeta.quarter,
                customStart: toDateInputValue(S().dateStart),
                customEnd: toDateInputValue(S().dateEnd)
            };
        }
        return _crossState.periodMeta[tab];
    }

    function setPeriodMeta(tab, meta = {}) {
        _crossState.periodMeta[tab] = {
            ...getPeriodMeta(tab),
            ...(meta || {})
        };
    }

    function getCurrentContext() {
        const tabs = getTabs();
        const tab = S().currentTab || tabs[0].id;
        const tabLabel = tabs.find((item) => item.id === tab)?.label || tabs[0]?.label || 'Demografia';
        return {
            tab,
            tabLabel,
            records: Array.isArray(S().filteredData) ? S().filteredData : []
        };
    }

    function getPeriodLabel(period) {
        return CROSS_PERIODS.find((item) => item.id === period)?.label || 'Periodo actual';
    }

    function getYearOptions() {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 8 }, (_, index) => currentYear - index);
    }

    function renderPeriodDetailControls(tab, period) {
        const meta = getPeriodMeta(tab);

        if (period === 'monthly') {
            return `
                <div class="col-xl-3 col-md-6">
                    <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-month">Mes</label>
                    <input type="month" class="form-control form-control-sm rounded-4" id="pob-cross-month" value="${escapeHtml(meta.monthRef || getCurrentMonthRef())}">
                </div>
            `;
        }

        if (period === 'quarterly') {
            return `
                <div class="col-xl-2 col-md-4">
                    <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-quarter-year">Ano</label>
                    <select class="form-select form-select-sm rounded-4" id="pob-cross-quarter-year">
                        ${getYearOptions().map((year) => `<option value="${year}" ${Number(meta.quarterYear) === Number(year) ? 'selected' : ''}>${year}</option>`).join('')}
                    </select>
                </div>
                <div class="col-xl-2 col-md-4">
                    <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-quarter-number">Trimestre</label>
                    <select class="form-select form-select-sm rounded-4" id="pob-cross-quarter-number">
                        ${[1, 2, 3, 4].map((quarter) => `<option value="${quarter}" ${Number(meta.quarterNumber) === quarter ? 'selected' : ''}>T${quarter}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        if (period === 'custom') {
            return `
                <div class="col-xl-3 col-md-6">
                    <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-custom-start">Desde</label>
                    <input type="date" class="form-control form-control-sm rounded-4" id="pob-cross-custom-start" value="${escapeHtml(meta.customStart || '')}">
                </div>
                <div class="col-xl-3 col-md-6">
                    <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-custom-end">Hasta</label>
                    <input type="date" class="form-control form-control-sm rounded-4" id="pob-cross-custom-end" value="${escapeHtml(meta.customEnd || '')}">
                </div>
            `;
        }

        return '';
    }

    function readPeriodMeta(period) {
        if (period === 'monthly') return { monthRef: document.getElementById('pob-cross-month')?.value || getCurrentMonthRef() };
        if (period === 'quarterly') {
            const currentQuarter = getCurrentQuarterMeta();
            return {
                quarterYear: Number.parseInt(document.getElementById('pob-cross-quarter-year')?.value, 10) || currentQuarter.year,
                quarterNumber: Number.parseInt(document.getElementById('pob-cross-quarter-number')?.value, 10) || currentQuarter.quarter
            };
        }
        if (period === 'custom') {
            return {
                customStart: document.getElementById('pob-cross-custom-start')?.value || '',
                customEnd: document.getElementById('pob-cross-custom-end')?.value || ''
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
        const period = document.getElementById('pob-cross-period')?.value || 'current';
        const wrapper = document.getElementById('pob-cross-period-detail-wrap');
        if (wrapper) wrapper.innerHTML = renderPeriodDetailControls(context.tab, period);
    }

    function getCrossRange(period, meta = {}) {
        const state = S();
        if (period === 'current') return { period, label: 'Periodo actual', start: state.dateStart, end: state.dateEnd };

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

    async function resolveCrossDataset(context, period, meta = {}) {
        const range = getCrossRange(period, meta);
        if (period === 'current') {
            return { period: range.period, periodLabel: range.label, dateStart: range.start, dateEnd: range.end, records: context.records };
        }

        const allData = await window.ReportesService.getReportData(S().ctx, {
            start: range.start,
            end: range.end,
            areas: ['POBLACION']
        });
        return {
            period: range.period,
            periodLabel: range.label,
            dateStart: range.start,
            dateEnd: range.end,
            records: applyCurrentDemoFilters(allData)
        };
    }

    function normalizeCrossValue(record, fieldKey) {
        switch (fieldKey) {
            case 'subarea':
                return normalizeSubareaLabel(record?.subarea);
            case 'carrera':
                return String(record?.carrera || 'Sin dato').trim() || 'Sin dato';
            case 'genero':
                return normalizeGeneroLabel(record?.genero);
            case 'turno':
                return normalizeTurnoLabel(record?.turno);
            case 'generacion':
                return record?.generacion ? String(record.generacion) : 'Sin dato';
            case 'estadoCivil':
                return toTitleCase(record?.estadoCivil || 'Sin dato');
            case 'apoyoPsico':
                return normalizeYesNo(record?.apoyoPsico, 'No');
            case 'usaLentes':
                return normalizeYesNo(record?.usaLentes, 'No');
            case 'discapacidadFlag':
                return Array.isArray(record?.discapacidades) && record.discapacidades.length ? 'Si' : 'No';
            case 'beca':
                return String(record?.beca || 'No').trim() || 'No';
            case 'trabaja':
                return normalizeYesNo(record?.trabaja, 'No');
            case 'idiomaFlag':
                return record?.idiomas && record.idiomas !== 'Ninguno' ? 'Si' : 'No';
            default:
                return toTitleCase(record?.[fieldKey] || 'Sin dato');
        }
    }

    function compareValues(fieldKey, left, right) {
        const a = String(left || '').trim();
        const b = String(right || '').trim();
        const isMissingA = !a || a === 'Sin dato';
        const isMissingB = !b || b === 'Sin dato';
        if (isMissingA && !isMissingB) return 1;
        if (!isMissingA && isMissingB) return -1;

        const ordered = {
            genero: ['Hombre', 'Mujer', 'No binario', 'Otro', 'Sin dato'],
            turno: ['Matutino', 'Vespertino', 'Nocturno', 'Mixto', 'Sin dato'],
            apoyoPsico: ['Si', 'No', 'Sin dato'],
            usaLentes: ['Si', 'No', 'Sin dato'],
            discapacidadFlag: ['Si', 'No', 'Sin dato'],
            trabaja: ['Si', 'No', 'Sin dato'],
            idiomaFlag: ['Si', 'No', 'Sin dato']
        }[fieldKey];

        if (ordered) {
            const idxA = ordered.indexOf(a);
            const idxB = ordered.indexOf(b);
            const safeA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
            const safeB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
            if (safeA !== safeB) return safeA - safeB;
        }

        if (fieldKey === 'generacion') {
            const numA = Number.parseInt(a, 10);
            const numB = Number.parseInt(b, 10);
            if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numB - numA;
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
            if (['genero', 'turno', 'apoyoPsico', 'usaLentes', 'discapacidadFlag', 'trabaja', 'idiomaFlag', 'generacion'].includes(primaryDimension) && semanticComparison !== 0) {
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

    function buildCrossMatrix(records, dimensions, tab) {
        const selectedDimensions = Array.from(new Set((dimensions || []).filter(Boolean)));
        const safeRecords = Array.isArray(records) ? records : [];
        if (!selectedDimensions.length) return null;

        if (selectedDimensions.length === 1) {
            const primaryDimension = selectedDimensions[0];
            const counts = {};
            safeRecords.forEach((record) => {
                const label = normalizeCrossValue(record, primaryDimension, tab);
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
            const rowValues = rowDimensions.map((dimension) => normalizeCrossValue(record, dimension, tab));
            const columnValue = normalizeCrossValue(record, columnDimension, tab);
            const rowKey = rowValues.join('||');
            if (!rowMap.has(rowKey)) rowMap.set(rowKey, { rowValues, counts: {}, total: 0 });
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

    function getActiveDemoBadges() {
        const filters = S().demoFilters || {};
        const badges = [];
        if (filters.carrera) badges.push(`Carrera: ${filters.carrera}`);
        if (filters.turno) badges.push(`Turno: ${normalizeTurnoLabel(filters.turno)}`);
        if (filters.genero) badges.push(`Genero: ${normalizeGeneroLabel(filters.genero)}`);
        if (filters.generacion) badges.push(`Generacion: ${filters.generacion}`);
        return badges;
    }

    function buildExportPayload(matrix, context) {
        const badges = getActiveDemoBadges();
        return {
            kind: 'generic',
            title: 'Cruce ajustable - Poblacion SIA',
            subtitle: `${context.tabLabel} - ${matrix.dimensionPath}`,
            filenameBase: sanitizeFilename(`Cruce_Poblacion_${context.tab}_${matrix.selectedDimensions.join('_')}`),
            recordCount: matrix.baseRecords,
            summary: [
                ['Area', 'Poblacion SIA'],
                ['Pestana', context.tabLabel],
                ['Lapso solicitado', context.periodLabel || 'Periodo actual'],
                ['Cruce solicitado', matrix.dimensionPath],
                ['Registros base', matrix.baseRecords],
                ['Combinaciones visibles', matrix.combinations],
                ['Rango', `${formatDate(context.dateStart)} a ${formatDate(context.dateEnd)}`],
                ['Filtros activos', badges.length ? badges.join(' | ') : 'Sin filtros demograficos adicionales']
            ],
            highlights: [
                { label: 'Registros analizados', value: matrix.baseRecords.toLocaleString('es-MX'), hint: 'Subset visible de poblacion.' },
                { label: 'Filas comparativas', value: matrix.combinations.toLocaleString('es-MX'), hint: 'Combinaciones unicas generadas en la tabla.' }
            ],
            dataTitle: 'Vista ajustable solicitada',
            detailSheetName: 'CrucePoblacion',
            columns: matrix.headers,
            rows: matrix.exportRows,
            pdfRows: matrix.exportRows.slice(0, 90),
            notes: [
                'La exportacion incluye solo la vista filtrada generada desde este modal.',
                'Respeta el periodo elegido y los filtros demograficos visibles.'
            ],
            pdfOptions: {
                showDetailTable: true
            }
        };
    }

    function setCrossFeedback(message = '', tone = 'warning') {
        const feedbackEl = document.getElementById('pob-cross-feedback');
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
        ['pob-cross-export-excel', 'pob-cross-export-pdf'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.disabled = !enabled;
        });
    }

    function renderCrossLauncher(tabLabel) {
        return `
            <div class="card border-0 shadow-sm rounded-4 reportes-poblacion-cross-hero" style="background:linear-gradient(135deg, ${hexToRgba('#0f766e', 0.98)}, ${hexToRgba('#0d9488', 0.82)});">
                <div class="card-body p-4">
                    <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
                        <div class="text-white">
                            <div class="small fw-bold text-uppercase mb-2 opacity-75">Vista ajustable visible</div>
                            <h5 class="fw-bold mb-2">Poblacion SIA · ${escapeHtml(tabLabel)}</h5>
                            <p class="mb-0 opacity-90">Cruza perfiles, genero, carrera, generacion y variables sociales o de salud en una sola tabla exportable.</p>
                        </div>
                        <div class="d-flex flex-column align-items-lg-end gap-2">
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <span class="badge rounded-pill text-bg-light border">Perfil</span>
                                <span class="badge rounded-pill text-bg-light border">Carrera</span>
                                <span class="badge rounded-pill text-bg-light border">Genero</span>
                            </div>
                            <button class="btn btn-light btn-lg rounded-pill px-4 fw-bold shadow-sm" onclick="Reportes.Poblacion.openCrossModal()">
                                <i class="bi bi-sliders2 me-2"></i>Seleccionar vista
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCrossModal(context) {
        const selection = getSelection(context.tab);
        const options = getFieldOptions(context.tab);
        const badges = getActiveDemoBadges();
        const selectedPeriod = getPeriod(context.tab);
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
                                <h5 class="modal-title fw-bold mb-1">Vista ajustable de Poblacion SIA</h5>
                                <div class="text-muted small">${escapeHtml(context.tabLabel)} - La vista respeta el periodo y los filtros visibles.</div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body pt-0 reportes-poblacion-cross-modal-body">
                            <div class="rounded-4 border p-3 mb-3 reportes-poblacion-cross-filter-panel">
                                <div class="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3">
                                    <div>
                                        <div class="fw-semibold text-dark">Selecciona el lapso y el cruce a comparar</div>
                                        <div class="small text-muted">Ideal para revisar composicion poblacional con mas orden.</div>
                                    </div>
                                    <div class="d-flex flex-wrap gap-2">
                                        <button class="btn btn-primary btn-sm rounded-pill px-4" onclick="Reportes.Poblacion.applyCrossConfig()">
                                            <i class="bi bi-funnel me-2"></i>Actualizar vista
                                        </button>
                                        <button class="btn btn-outline-secondary btn-sm rounded-pill px-4" onclick="Reportes.Poblacion.resetCrossConfig()">
                                            <i class="bi bi-arrow-counterclockwise me-2"></i>Restablecer
                                        </button>
                                    </div>
                                </div>
                                <div class="row g-2 align-items-end">
                                    <div class="col-xl-3 col-md-6">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-period">Lapso</label>
                                        <select class="form-select form-select-sm rounded-4" id="pob-cross-period" onchange="Reportes.Poblacion.onCrossPeriodChange()">
                                            ${CROSS_PERIODS.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedPeriod === item.id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div id="pob-cross-period-detail-wrap" class="contents">
                                        ${renderPeriodDetailControls(context.tab, selectedPeriod)}
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-primary">Primero</label>
                                        <select class="form-select form-select-sm rounded-4" id="pob-cross-primary">
                                            ${options.map((field) => `<option value="${escapeHtml(field.key)}" ${selection.primary === field.key ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-secondary">Luego</label>
                                        <select class="form-select form-select-sm rounded-4" id="pob-cross-secondary">
                                            ${renderSelectOptions(selection.secondary)}
                                        </select>
                                    </div>
                                    <div class="col-xl-2 col-md-4">
                                        <label class="form-label small text-muted fw-semibold mb-1" for="pob-cross-tertiary">Columnas</label>
                                        <select class="form-select form-select-sm rounded-4" id="pob-cross-tertiary">
                                            ${renderSelectOptions(selection.tertiary)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="pob-cross-feedback" class="alert alert-warning rounded-4 d-none"></div>

                            <div class="d-flex flex-wrap gap-2 mb-3">
                                ${badges.length
                ? badges.map((badge) => `<span class="badge rounded-pill text-bg-light border">${escapeHtml(badge)}</span>`).join('')
                : '<span class="badge rounded-pill text-bg-light border">Sin filtros demograficos adicionales</span>'}
                            </div>

                            <div id="pob-cross-preview"></div>
                        </div>
                        <div class="modal-footer border-0 pt-0 d-flex justify-content-between flex-wrap gap-2">
                            <div class="small text-muted">Exporta solo la vista generada desde este modal.</div>
                            <div class="d-flex flex-wrap gap-2">
                                <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">
                                    <i class="bi bi-x-circle me-2"></i>Salir
                                </button>
                                <button class="btn btn-outline-success rounded-pill px-4" id="pob-cross-export-excel" onclick="Reportes.Poblacion.exportCross('excel')">
                                    <i class="bi bi-file-earmark-excel me-2"></i>Excel
                                </button>
                                <button class="btn btn-outline-danger rounded-pill px-4" id="pob-cross-export-pdf" onclick="Reportes.Poblacion.exportCross('pdf')">
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
        const previewEl = document.getElementById('pob-cross-preview');
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
                    <tr class="reportes-poblacion-cross-row-${escapeHtml(row.type)}">
                        <td colspan="${row.colspan}">
                            <div class="reportes-poblacion-cross-group-row">
                                <span class="reportes-poblacion-cross-group-title">${escapeHtml(row.label)}</span>
                                <span class="reportes-poblacion-cross-group-meta">${escapeHtml(row.meta || '')}</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
            const cellsHtml = row.cells.map((cell, index) => {
                const numericClass = index >= matrix.numericStartIndex ? 'text-end fw-semibold' : '';
                const emptyClass = cell === '' ? 'reportes-poblacion-cross-empty-cell' : '';
                return `<td class="${numericClass} ${emptyClass}">${escapeHtml(cell)}</td>`;
            }).join('');
            return `<tr class="reportes-poblacion-cross-row-${escapeHtml(row.type)}">${cellsHtml}</tr>`;
        };

        previewEl.innerHTML = `
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-0">
                    <div class="d-flex flex-column gap-3 p-4 pb-3">
                        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                            <div>
                                <h5 class="fw-bold mb-1">Matriz comparativa solicitada</h5>
                                <div class="text-muted small">Poblacion SIA · ${escapeHtml(periodLabel)}</div>
                                <div class="small text-muted mt-1">${escapeHtml(formatDate(dateStart))} a ${escapeHtml(formatDate(dateEnd))}</div>
                            </div>
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <span class="badge rounded-pill text-bg-light border">${escapeHtml(matrix.dimensionPath)}</span>
                                <span class="badge rounded-pill text-bg-light border">${escapeHtml(chartsSafeNumber(matrix.baseRecords))} registros</span>
                            </div>
                        </div>
                    </div>
                    <div class="table-responsive reportes-poblacion-cross-table-wrap">
                        <table class="table table-sm align-middle mb-0 reportes-poblacion-cross-table">
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
        const previewEl = document.getElementById('pob-cross-preview');
        if (!previewEl) return;

        const primary = document.getElementById('pob-cross-primary')?.value || '';
        const secondary = document.getElementById('pob-cross-secondary')?.value || '';
        const tertiary = document.getElementById('pob-cross-tertiary')?.value || '';
        const period = document.getElementById('pob-cross-period')?.value || 'current';
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

        setSelection(context.tab, { primary, secondary, tertiary });
        setPeriod(context.tab, period);
        setPeriodMeta(context.tab, periodMeta);
        _crossState.activeTab = context.tab;
        previewEl.innerHTML = `
            <div class="rounded-4 border p-4 text-center text-muted">
                <div class="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                Preparando vista ajustable para ${escapeHtml(getPeriodLabel(period).toLowerCase())}...
            </div>
        `;
        setCrossExportEnabled(false);

        const cacheKey = JSON.stringify({
            tab: context.tab,
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
            const matrix = buildCrossMatrix(dataset.records, selected, context.tab);
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
            console.error('[Reportes.Poblacion] Error generando vista ajustable:', error);
            setCrossFeedback('No se pudo cargar el lapso solicitado para esta vista.', 'danger');
            renderCrossPreview(null, context, getPeriodLabel(period));
            _crossState.matrix = null;
            _crossState.exportPayload = null;
        }
    }

    function resetCrossConfig() {
        const context = getCurrentContext();
        const defaults = { ...(CROSS_DEFAULTS[context.tab] || CROSS_DEFAULTS.demografia) };
        setSelection(context.tab, defaults);
        setPeriod(context.tab, 'current');
        setPeriodMeta(context.tab, {
            monthRef: getCurrentMonthRef(),
            quarterYear: getCurrentQuarterMeta().year,
            quarterNumber: getCurrentQuarterMeta().quarter,
            customStart: toDateInputValue(S().dateStart),
            customEnd: toDateInputValue(S().dateEnd)
        });

        const primary = document.getElementById('pob-cross-primary');
        const secondary = document.getElementById('pob-cross-secondary');
        const tertiary = document.getElementById('pob-cross-tertiary');
        const period = document.getElementById('pob-cross-period');
        if (primary) primary.value = defaults.primary;
        if (secondary) secondary.value = defaults.secondary;
        if (tertiary) tertiary.value = defaults.tertiary;
        if (period) period.value = 'current';
        onCrossPeriodChange();
        void applyCrossConfig();
    }

    function openCrossModal() {
        const context = getCurrentContext();
        const modal = document.getElementById(CROSS_MODAL_ID);
        if (!modal) return;

        const selection = getSelection(context.tab);
        const selectedPeriod = getPeriod(context.tab);
        const primary = document.getElementById('pob-cross-primary');
        const secondary = document.getElementById('pob-cross-secondary');
        const tertiary = document.getElementById('pob-cross-tertiary');
        const period = document.getElementById('pob-cross-period');
        if (primary) primary.value = selection.primary;
        if (secondary) secondary.value = selection.secondary;
        if (tertiary) tertiary.value = selection.tertiary;
        if (period) period.value = selectedPeriod;
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

        const selectedPeriod = getPeriod(context.tab);
        const config = {
            period: selectedPeriod === 'current' ? (S().presetPeriod || 'current') : selectedPeriod,
            dateStart: _crossState.dateStart,
            dateEnd: _crossState.dateEnd
        };

        if (format === 'pdf') {
            await window.ExportUtils.generatePDF(config, payload, 'POBLACION');
        } else {
            window.ExportUtils.generateExcel(config, payload, 'POBLACION');
        }
    }

    function countBy(data, getter) {
        const counts = {};
        (Array.isArray(data) ? data : []).forEach((item) => {
            const label = getter(item);
            counts[label] = (counts[label] || 0) + 1;
        });
        return counts;
    }

    function renderDemografia(container, data) {
        const charts = H();
        const chartRegistry = R();
        const total = data.length;
        const estudiantes = data.filter((item) => item.subarea === 'ESTUDIANTE').length;
        const docentes = data.filter((item) => item.subarea === 'DOCENTE').length;
        const administrativos = data.filter((item) => item.subarea === 'ADMINISTRATIVO').length;
        const adminsModulo = data.filter((item) => item.subarea === 'ADMIN_MODULO').length;
        const carreraMap = countBy(data.filter((item) => item.carrera && item.carrera !== 'N/A'), (item) => item.carrera);
        const topCarreras = Object.entries(carreraMap).sort((left, right) => right[1] - left[1]).slice(0, 10);
        const generoMap = countBy(data, (item) => item.genero || 'No especificado');
        const genMap = countBy(data, (item) => item.generacion || 'No especificado');
        const sortedGen = Object.entries(genMap).sort((left, right) => {
            if (left[0] === 'No especificado') return 1;
            if (right[0] === 'No especificado') return -1;
            return String(right[0]).localeCompare(String(left[0]));
        });
        const turnoMap = countBy(data, (item) => item.turno || 'No especificado');
        const civilMap = countBy(data, (item) => item.estadoCivil || 'No especificado');
        const depMap = countBy(data, (item) => String(item.dependientes || 'No').startsWith('Si') || String(item.dependientes || '').startsWith('Sí') ? 'Si' : 'No');

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                ${renderCrossLauncher('Demografia')}

                <div class="row g-3">
                    ${charts.renderKPICard({ title: 'Total usuarios', value: charts.formatNumber(total), icon: 'bi-people-fill', color: 'success' })}
                    ${charts.renderKPICard({ title: 'Estudiantes', value: charts.formatNumber(estudiantes), icon: 'bi-mortarboard', color: 'primary' })}
                    ${charts.renderKPICard({ title: 'Personal academico', value: charts.formatNumber(docentes), icon: 'bi-person-workspace', color: 'info' })}
                    ${charts.renderKPICard({ title: 'Personal administrativo', value: charts.formatNumber(administrativos), icon: 'bi-building', color: 'warning' })}
                    ${charts.renderKPICard({ title: 'Admins de modulo', value: charts.formatNumber(adminsModulo), icon: 'bi-shield-check', color: 'secondary' })}
                </div>

                <div class="row g-4">
                    <div class="col-12">${charts.renderChartCard('Distribucion por carrera (Top 10)', 'pob-demo-carrera-bar')}</div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-4">${charts.renderChartCard('Por genero', 'pob-demo-genero-doughnut')}</div>
                    <div class="col-lg-4">${charts.renderChartCard('Por generacion', 'pob-demo-generacion-bar')}</div>
                    <div class="col-lg-4">${charts.renderChartCard('Por turno', 'pob-demo-turno-pie')}</div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-6">${charts.renderChartCard('Por estado civil', 'pob-demo-civil-pie')}</div>
                    <div class="col-lg-6">${charts.renderChartCard('Tiene dependientes', 'pob-demo-dep-doughnut')}</div>
                </div>

                ${renderCrossModal(getCurrentContext())}
                ${renderSharedStyles()}
            </div>
        `;

        setTimeout(() => {
            chartRegistry['pob-demo-carrera-bar'] = charts.createBarChart('pob-demo-carrera-bar', {
                labels: topCarreras.map(([career]) => career.length > 40 ? `${career.substring(0, 37)}...` : career),
                datasets: [{ label: 'Usuarios', data: topCarreras.map(([, count]) => count), backgroundColor: charts.COLORS.success }]
            }, { horizontal: true });
            chartRegistry['pob-demo-genero-doughnut'] = charts.createDoughnutChart('pob-demo-genero-doughnut', {
                labels: Object.keys(generoMap),
                data: Object.values(generoMap),
                colors: ['#ec35d0', '#4040e5', '#6366f1', '#8b5cf6']
            });
            chartRegistry['pob-demo-generacion-bar'] = charts.createBarChart('pob-demo-generacion-bar', {
                labels: sortedGen.map(([value]) => String(value)),
                datasets: [{ label: 'Usuarios', data: sortedGen.map(([, count]) => count), backgroundColor: charts.COLORS.info }]
            });
            chartRegistry['pob-demo-turno-pie'] = charts.createDoughnutChart('pob-demo-turno-pie', {
                labels: Object.keys(turnoMap),
                data: Object.values(turnoMap),
                colors: [charts.COLORS.warning, charts.COLORS.success, charts.COLORS.info]
            });
            chartRegistry['pob-demo-civil-pie'] = charts.createDoughnutChart('pob-demo-civil-pie', {
                labels: Object.keys(civilMap),
                data: Object.values(civilMap),
                colors: [charts.COLORS.primary, '#6366f1', '#ec35d0', charts.COLORS.info]
            });
            chartRegistry['pob-demo-dep-doughnut'] = charts.createDoughnutChart('pob-demo-dep-doughnut', {
                labels: Object.keys(depMap),
                data: Object.values(depMap),
                colors: [charts.COLORS.danger, charts.COLORS.success]
            });
        }, 50);
    }

    function renderSalud(container, data) {
        const charts = H();
        const chartRegistry = R();
        const conDiscapacidad = data.filter((item) => Array.isArray(item.discapacidades) && item.discapacidades.length > 0).length;
        const usaLentes = data.filter((item) => normalizeYesNo(item.usaLentes, 'No') === 'Si').length;
        const discapMap = {};
        data.forEach((item) => {
            (Array.isArray(item.discapacidades) ? item.discapacidades : []).forEach((discapacidad) => {
                const name = normalizeCategoryLabel(discapacidad);
                if (name) discapMap[name] = (discapMap[name] || 0) + 1;
            });
        });
        const condMap = {};
        data.forEach((item) => {
            splitListValue(item.enfermedadCronica).forEach((condition) => {
                const name = normalizeCategoryLabel(condition);
                const key = name.toLowerCase();
                if (!name || ['ninguna', 'no', 'n/a', 'ninguno', 'sin'].includes(key)) return;
                condMap[name] = (condMap[name] || 0) + 1;
            });
        });
        const topCondiciones = Object.entries(condMap).sort((left, right) => right[1] - left[1]).slice(0, 10);
        const alergiaMap = {};
        data.forEach((item) => {
            splitListValue(item.alergia || 'Ninguna').forEach((allergy) => {
                const name = normalizeCategoryLabel(allergy);
                const key = name.toLowerCase();
                if (!name || ['ninguna', 'no', 'n/a', 'ninguno', 'sin'].includes(key)) return;
                alergiaMap[name] = (alergiaMap[name] || 0) + 1;
            });
        });
        const topAlergias = Object.entries(alergiaMap).sort((left, right) => right[1] - left[1]).slice(0, 10);
        const psicoMap = countBy(data, (item) => normalizeYesNo(item.apoyoPsico, 'No'));

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                ${renderCrossLauncher('Salud')}

                <div class="row g-3">
                    ${charts.renderKPICard({ title: 'Con discapacidad', value: charts.formatNumber(conDiscapacidad), icon: 'bi-universal-access', color: 'info' })}
                    ${charts.renderKPICard({ title: 'Uso lentes', value: charts.formatNumber(usaLentes), icon: 'bi-eyeglasses', color: 'warning' })}
                </div>
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">${charts.renderChartCard('Tipos de discapacidad', 'pob-salud-discap-doughnut')}</div>
                    <div class="col-lg-6">${charts.renderChartCard('Top condiciones cronicas', 'pob-salud-cond-bar')}</div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-6">${charts.renderChartCard('Top alergias', 'pob-salud-alergia-bar')}</div>
                    <div class="col-lg-6">${charts.renderChartCard('Requiere apoyo psicologico', 'pob-salud-psico-pie')}</div>
                </div>

                ${renderCrossModal(getCurrentContext())}
                ${renderSharedStyles()}
            </div>
        `;

        setTimeout(() => {
            if (Object.keys(discapMap).length) {
                chartRegistry['pob-salud-discap-doughnut'] = charts.createDoughnutChart('pob-salud-discap-doughnut', {
                    labels: Object.keys(discapMap),
                    data: Object.values(discapMap)
                });
            }
            if (topCondiciones.length) {
                chartRegistry['pob-salud-cond-bar'] = charts.createBarChart('pob-salud-cond-bar', {
                    labels: topCondiciones.map(([name]) => name.length > 30 ? `${name.substring(0, 27)}...` : name),
                    datasets: [{ label: 'Personas', data: topCondiciones.map(([, count]) => count), backgroundColor: charts.COLORS.danger }]
                }, { horizontal: true });
            }
            if (topAlergias.length) {
                chartRegistry['pob-salud-alergia-bar'] = charts.createBarChart('pob-salud-alergia-bar', {
                    labels: topAlergias.map(([name]) => name.length > 30 ? `${name.substring(0, 27)}...` : name),
                    datasets: [{ label: 'Personas', data: topAlergias.map(([, count]) => count), backgroundColor: charts.COLORS.warning }]
                }, { horizontal: true });
            }
            chartRegistry['pob-salud-psico-pie'] = charts.createDoughnutChart('pob-salud-psico-pie', {
                labels: ['Si requiere', 'No requiere'],
                data: [psicoMap['Si'] || 0, psicoMap['No'] || 0],
                colors: [charts.COLORS.danger, charts.COLORS.success]
            });
        }, 50);
    }

    function renderSocioeconomico(container, data) {
        const charts = H();
        const chartRegistry = R();
        const becados = data.filter((item) => item.beca && item.beca !== 'No').length;
        const noBecados = data.length - becados;
        const trabajan = data.filter((item) => normalizeYesNo(item.trabaja, 'No') === 'Si').length;
        const noTrabajan = data.length - trabajan;
        const idiomas = data.filter((item) => item.idiomas && item.idiomas !== 'Ninguno').length;
        const coloniaMap = {};
        data.forEach((item) => {
            const colonia = String(item.colonia || '').trim();
            if (colonia && colonia.toLowerCase() !== 'no especificada' && colonia.length > 3) {
                coloniaMap[colonia] = (coloniaMap[colonia] || 0) + 1;
            }
        });
        const topColonias = Object.entries(coloniaMap).sort((left, right) => right[1] - left[1]).slice(0, 10);

        container.innerHTML = `
            <div class="d-flex flex-column gap-4 pb-5">
                ${renderCrossLauncher('Socioeconomico')}

                <div class="row g-3">
                    ${charts.renderKPICard({ title: 'Becados', value: charts.formatNumber(becados), icon: 'bi-award', color: 'success' })}
                    ${charts.renderKPICard({ title: 'Trabajan', value: charts.formatNumber(trabajan), icon: 'bi-briefcase', color: 'primary' })}
                    ${charts.renderKPICard({ title: 'Hablan idioma extra', value: charts.formatNumber(idiomas), icon: 'bi-translate', color: 'info' })}
                </div>
                <div class="row g-4">
                    <div class="col-lg-4">${charts.renderChartCard('Becados vs No becados', 'pob-socio-beca-doughnut')}</div>
                    <div class="col-lg-4">${charts.renderChartCard('Top 10 colonias', 'pob-socio-colonia-bar')}</div>
                    <div class="col-lg-4">${charts.renderChartCard('Trabaja / No trabaja', 'pob-socio-trabaja-pie')}</div>
                </div>

                ${renderCrossModal(getCurrentContext())}
                ${renderSharedStyles()}
            </div>
        `;

        setTimeout(() => {
            chartRegistry['pob-socio-beca-doughnut'] = charts.createDoughnutChart('pob-socio-beca-doughnut', {
                labels: ['Becados', 'No becados'],
                data: [becados, noBecados],
                colors: [charts.COLORS.success, charts.COLORS.secondary || '#6c757d']
            });
            if (topColonias.length) {
                chartRegistry['pob-socio-colonia-bar'] = charts.createBarChart('pob-socio-colonia-bar', {
                    labels: topColonias.map(([name]) => name.length > 30 ? `${name.substring(0, 27)}...` : name),
                    datasets: [{ label: 'Personas', data: topColonias.map(([, count]) => count), backgroundColor: charts.COLORS.warning }]
                }, { horizontal: true });
            }
            chartRegistry['pob-socio-trabaja-pie'] = charts.createDoughnutChart('pob-socio-trabaja-pie', {
                labels: ['Trabaja', 'No trabaja'],
                data: [trabajan, noTrabajan],
                colors: [charts.COLORS.primary, charts.COLORS.secondary || '#6c757d']
            });
        }, 50);
    }

    function renderSharedStyles() {
        return `
            <style>
                .reportes-poblacion-cross-hero { overflow: hidden; }
                .reportes-poblacion-cross-modal-body { overflow: hidden; }
                .reportes-poblacion-cross-filter-panel {
                    background:
                        radial-gradient(circle at top right, ${hexToRgba('#10b981', 0.08)}, transparent 38%),
                        linear-gradient(180deg, #fbfffd 0%, #f8fffb 100%);
                    border-color: #a7f3d0 !important;
                }
                .reportes-poblacion-cross-filter-panel .form-select,
                .reportes-poblacion-cross-filter-panel .form-control {
                    border-color: #a7f3d0;
                    background-color: rgba(255, 255, 255, 0.98);
                }
                .reportes-poblacion-cross-filter-panel .form-select:focus,
                .reportes-poblacion-cross-filter-panel .form-control:focus {
                    border-color: #10b981;
                    box-shadow: 0 0 0 0.2rem rgba(16, 185, 129, 0.14);
                }
                .contents { display: contents; }
                .reportes-poblacion-cross-table-wrap {
                    max-height: none;
                    overflow-x: auto;
                    overflow-y: hidden;
                }
                .reportes-poblacion-cross-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    background: #ecfdf5;
                    color: #065f46;
                    border-bottom-width: 1px;
                    white-space: nowrap;
                }
                .reportes-poblacion-cross-table tbody td {
                    white-space: nowrap;
                    vertical-align: middle;
                    border-color: #d1fae5;
                    padding-top: 0.7rem;
                    padding-bottom: 0.7rem;
                }
                .reportes-poblacion-cross-table tbody tr.reportes-poblacion-cross-row-data:nth-child(even) td { background: #fbfffd; }
                .reportes-poblacion-cross-table tbody tr.reportes-poblacion-cross-row-data:hover td { background: #f3fff8; }
                .reportes-poblacion-cross-empty-cell { color: transparent; }
                .reportes-poblacion-cross-row-group td {
                    background: linear-gradient(90deg, #ecfdf5 0%, #f7fffb 100%);
                    border-top: 2px solid #6ee7b7;
                    border-bottom: 1px solid #a7f3d0;
                    padding-top: 0.8rem;
                    padding-bottom: 0.8rem;
                }
                .reportes-poblacion-cross-group-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }
                .reportes-poblacion-cross-group-title {
                    font-weight: 800;
                    color: #065f46;
                    letter-spacing: 0.01em;
                }
                .reportes-poblacion-cross-group-meta {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.2rem 0.7rem;
                    border-radius: 999px;
                    background: rgba(16, 185, 129, 0.08);
                    color: #047857;
                    font-size: 0.8rem;
                    font-weight: 700;
                }
                .reportes-poblacion-cross-row-subtotal td {
                    background: #ecfdf5;
                    font-weight: 700;
                    color: #065f46;
                    border-top: 1px dashed #6ee7b7;
                }
                .reportes-poblacion-cross-row-total td {
                    background: linear-gradient(90deg, #d1fae5 0%, #ecfdf5 100%);
                    font-weight: 700;
                    color: #065f46;
                    border-top: 2px solid #34d399;
                }
                @media (max-width: 991.98px) {
                    .reportes-poblacion-cross-filter-panel .btn { width: 100%; }
                }
            </style>
        `;
    }

    return {
        render,
        getTabs,
        openCrossModal,
        onCrossPeriodChange,
        applyCrossConfig,
        resetCrossConfig,
        exportCross
    };
})();
