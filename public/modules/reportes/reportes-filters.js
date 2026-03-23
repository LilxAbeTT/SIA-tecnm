/**
 * ============================================================
 *  Reportes.Filters — Sub-módulo de Filtros para Reportes SIA
 * ============================================================
 *  Maneja la barra de filtros: período de tiempo y filtros
 *  demográficos (carrera, turno, género, generación).
 *
 *  @version 4.0.0
 *  @requires Reportes (módulo padre)
 * ============================================================
 */
if (!window.Reportes) window.Reportes = {};
console.log('[SIA] reportes-filters.js cargado');

window.Reportes.Filters = (function () {
    'use strict';

    // ==================== CONFIGURACIÓN ====================

    /** Definiciones de períodos disponibles */
    const PERIODS = [
        { id: 'daily', label: 'Hoy' },
        { id: 'weekly', label: 'Semana' },
        { id: 'monthly', label: 'Mes' },
        { id: 'quarterly', label: 'Trimestre' },
        { id: 'semester', label: 'Semestre' },
        { id: 'annual', label: 'Año' },
        { id: 'custom', label: 'Personalizado' }
    ];

    // ==================== RENDERIZADO ====================

    /**
     * Renderiza la barra de filtros dentro del contenedor indicado.
     * Incluye pills de período + filtros demográficos.
     * @param {string} containerId - ID del elemento contenedor
     */
    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const state = Reportes.getState();
        const currentPeriod = state.presetPeriod || 'monthly';

        container.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4 mb-0">
            <div class="card-body py-2 px-3">
                <!-- Fila 1: Filtros de Fecha -->
                <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                    <span class="text-muted small fw-bold me-1">
                        <i class="bi bi-calendar3 me-1"></i>Periodo:
                    </span>
                    <div class="btn-group btn-group-sm" role="group">
                        ${PERIODS.map(p => `
                        <button type="button"
                                class="btn btn-sm rounded-pill px-3 border-0 fw-bold ${currentPeriod === p.id ? 'btn-primary' : 'btn-outline-secondary'}"
                                onclick="Reportes.Filters.setPeriod('${p.id}')">
                            ${p.label}
                        </button>
                        `).join('')}
                    </div>
                    <!-- Rango personalizado (oculto por defecto) -->
                    <div id="custom-date-range" class="${currentPeriod === 'custom' ? 'd-flex' : 'd-none'} align-items-center gap-1">
                        <input type="date" class="form-control form-control-sm" id="rep-date-start"
                               style="max-width:140px;"
                               value="${state.dateStart ? _formatDateInput(state.dateStart) : ''}">
                        <span class="text-muted small">a</span>
                        <input type="date" class="form-control form-control-sm" id="rep-date-end"
                               style="max-width:140px;"
                               value="${state.dateEnd ? _formatDateInput(state.dateEnd) : ''}">
                        <button class="btn btn-primary btn-sm rounded-pill" onclick="Reportes.Filters.applyCustomDate()">
                            <i class="bi bi-funnel-fill"></i>
                        </button>
                    </div>
                </div>
                <!-- Fila 2: Filtros Demográficos -->
                <div class="d-flex align-items-center gap-2 flex-wrap" id="demo-filters-row">
                    <span class="text-muted small fw-bold me-1">
                        <i class="bi bi-funnel me-1"></i>Filtros:
                    </span>
                    <select class="form-select form-select-sm" id="filter-carrera"
                            style="max-width:180px;" onchange="Reportes.Filters.onDemoFilterChange()">
                        <option value="">Todas las carreras</option>
                    </select>
                    <select class="form-select form-select-sm" id="filter-turno"
                            style="max-width:130px;" onchange="Reportes.Filters.onDemoFilterChange()">
                        <option value="">Todos los turnos</option>
                    </select>
                    <select class="form-select form-select-sm" id="filter-genero"
                            style="max-width:140px;" onchange="Reportes.Filters.onDemoFilterChange()">
                        <option value="">Todos los generos</option>
                    </select>
                    <select class="form-select form-select-sm" id="filter-generacion"
                            style="max-width:140px;" onchange="Reportes.Filters.onDemoFilterChange()">
                        <option value="">Todas las generaciones</option>
                    </select>
                </div>
            </div>
        </div>`;
    }

    // ==================== PERÍODOS ====================

    /**
     * Cambia el período activo, actualiza el estado del padre y recarga datos.
     * @param {string} period - ID del período ('daily', 'weekly', etc.)
     */
    function setPeriod(period) {
        // Actualizar estado en el módulo padre
        Reportes.setState({ presetPeriod: period });

        // Mostrar/ocultar inputs de fecha personalizada
        const customRange = document.getElementById('custom-date-range');
        if (customRange) {
            customRange.classList.toggle('d-none', period !== 'custom');
            customRange.classList.toggle('d-flex', period === 'custom');
        }

        // Actualizar visual de pills
        _updatePeriodPills(period);

        // Si no es personalizado, recargar datos inmediatamente
        if (period !== 'custom') {
            Reportes.loadData();
        }
    }

    /**
     * Aplica el rango de fechas personalizado y recarga datos.
     */
    function applyCustomDate() {
        const startInput = document.getElementById('rep-date-start');
        const endInput = document.getElementById('rep-date-end');

        if (!startInput || !endInput) return;

        const startVal = startInput.value;
        const endVal = endInput.value;

        if (!startVal || !endVal) {
            alert('Por favor selecciona ambas fechas.');
            return;
        }

        const start = new Date(startVal + 'T00:00:00');
        const end = new Date(endVal + 'T23:59:59');

        if (start > end) {
            alert('La fecha de inicio debe ser anterior a la fecha final.');
            return;
        }

        // Guardar fechas en el estado del padre
        Reportes.setState({
            dateStart: start,
            dateEnd: end,
            presetPeriod: 'custom'
        });

        Reportes.loadData();
    }

    /**
     * Calcula el rango de fechas {start, end} para un período dado.
     * @param {string} period - ID del período
     * @returns {{start: Date, end: Date}}
     */
    function getDateRange(period) {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        // Para período personalizado, usar las fechas guardadas
        if (period === 'custom') {
            const state = Reportes.getState();
            if (state.dateStart && state.dateEnd) {
                return { start: state.dateStart, end: state.dateEnd };
            }
            // Fallback a mes actual si no hay fechas
            period = 'monthly';
        }

        switch (period) {
            case 'daily':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'weekly': {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            }
            case 'monthly':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'quarterly': {
                const q = Math.floor((now.getMonth() + 3) / 3);
                start = new Date(now.getFullYear(), (q - 1) * 3, 1);
                end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
                break;
            }
            case 'semester': {
                const s = now.getMonth() < 6 ? 0 : 6;
                start = new Date(now.getFullYear(), s, 1);
                end = new Date(now.getFullYear(), s + 6, 0, 23, 59, 59);
                break;
            }
            case 'annual':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;
        }

        return { start, end };
    }

    // ==================== FILTROS DEMOGRÁFICOS ====================

    /**
     * Puebla las opciones de los dropdowns a partir de los datos cargados.
     * @param {Array} data - Datos con campos carrera, turno, genero, generacion
     */
    function populateFilterOptions(data) {
        const opts = {
            carreras: new Set(),
            turnos: new Set(),
            generos: new Set(),
            generaciones: new Set()
        };

        data.forEach(item => {
            const carrera = String(item.carrera || '').trim();
            const turno = String(item.turno || '').trim();
            const genero = String(item.genero || '').trim();
            const generacion = Number.parseInt(item.generacion, 10);

            if (carrera && !['n/a', 'no especificado'].includes(carrera.toLowerCase())) opts.carreras.add(carrera);
            if (turno && !['n/a', 'no especificado'].includes(turno.toLowerCase())) opts.turnos.add(turno);
            if (genero && genero.toLowerCase() !== 'no especificado') opts.generos.add(genero);
            if (Number.isFinite(generacion)) opts.generaciones.add(generacion);
        });

        // Obtener estado actual para preservar selecciones
        const state = Reportes.getState();
        const filters = state.demoFilters || {};

        _populateSelect('filter-carrera', 'Todas las carreras',
            [...opts.carreras].sort(), filters.carrera);
        _populateSelect('filter-turno', 'Todos los turnos',
            [...opts.turnos].sort(), filters.turno);
        _populateSelect('filter-genero', 'Todos los generos',
            [...opts.generos].sort(), filters.genero);
        _populateSelect('filter-generacion', 'Todas las generaciones',
            [...opts.generaciones].sort((a, b) => b - a), filters.generacion);
    }

    /**
     * Lee los valores de todos los dropdowns y aplica los filtros demográficos.
     */
    function onDemoFilterChange() {
        const carrera = document.getElementById('filter-carrera')?.value || null;
        const turno = document.getElementById('filter-turno')?.value || null;
        const genero = document.getElementById('filter-genero')?.value || null;
        const generacion = document.getElementById('filter-generacion')?.value || null;

        Reportes.setState({
            demoFilters: {
                carrera: carrera || null,
                turno: turno || null,
                genero: genero || null,
                generacion: generacion || null
            }
        });

        Reportes.applyDemoFilters();
    }

    // ==================== UTILIDADES PRIVADAS ====================

    /**
     * Actualiza el estado visual de los pills de período.
     * @param {string} activePeriod
     * @private
     */
    function _updatePeriodPills(activePeriod) {
        const btnGroup = document.querySelector('#reportes-filter-bar .btn-group');
        if (!btnGroup) return;

        btnGroup.querySelectorAll('button').forEach(btn => {
            const periodId = PERIODS.find(p => btn.textContent.trim() === p.label)?.id;
            if (periodId === activePeriod) {
                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-primary');
            } else {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline-secondary');
            }
        });
    }

    /**
     * Puebla un <select> con opciones y preserva la selección actual.
     * @param {string} selectId - ID del select
     * @param {string} defaultLabel - Texto de la opción por defecto
     * @param {Array} options - Lista de valores
     * @param {string|null} currentValue - Valor actualmente seleccionado
     * @private
     */
    function _populateSelect(selectId, defaultLabel, options, currentValue) {
        const select = document.getElementById(selectId);
        if (!select) return;

        let html = `<option value="">${defaultLabel}</option>`;
        options.forEach(opt => {
            const selected = (currentValue && String(currentValue) === String(opt)) ? 'selected' : '';
            html += `<option value="${opt}" ${selected}>${opt}</option>`;
        });
        select.innerHTML = html;
    }

    /**
     * Formatea una fecha para el input type="date" (YYYY-MM-DD).
     * @param {Date} date
     * @returns {string}
     * @private
     */
    function _formatDateInput(date) {
        if (!(date instanceof Date)) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ==================== API PÚBLICA ====================

    return {
        render,
        getDateRange,
        populateFilterOptions,
        setPeriod,
        applyCustomDate,
        onDemoFilterChange
    };

})();
