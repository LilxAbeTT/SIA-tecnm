window.ReportesService = (function () {

    // Solo los módulos relevantes para Desarrollo Académico
    const MODULES = {
        'BIBLIO': { name: 'Biblioteca', color: '#f59e0b', icon: 'bi-book-half', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
        'MEDICO': { name: 'Servicio Médico / Psicología', color: '#6366f1', icon: 'bi-heart-pulse-fill', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' }
    };

    // Cache de usuarios para evitar re-fetches
    let _userCache = {};

    /**
     * Extrae la generación a partir de la matrícula.
     * Ej: "22380123" → 2022, "19380456" → 2019
     */
    function extractGeneracion(matricula) {
        if (!matricula || matricula === 'N/A' || matricula.length < 2) return null;
        const prefix = matricula.substring(0, 2);
        const num = parseInt(prefix, 10);
        if (isNaN(num)) return null;
        return 2000 + num; // Asume 20XX
    }

    /**
     * Enriquece registros con datos demográficos del alumno (género, carrera, generación).
     * Hace un batch fetch de la colección `usuarios` por UIDs.
     */
    async function enrichWithUserData(ctx, records) {
        // Collect unique UIDs that need fetching
        const uidsToFetch = new Set();
        records.forEach(r => {
            if (r._uid && !_userCache[r._uid]) uidsToFetch.add(r._uid);
        });

        // Batch fetch (Firestore 'in' query supports up to 30 at a time)
        const uidArray = [...uidsToFetch];
        for (let i = 0; i < uidArray.length; i += 30) {
            const batch = uidArray.slice(i, i + 30);
            try {
                const snap = await ctx.db.collection('usuarios').where('__name__', 'in', batch).get();
                snap.docs.forEach(doc => {
                    const d = doc.data();
                    _userCache[doc.id] = {
                        genero: d.genero || (d.personalData && d.personalData.genero) || null,
                        carrera: d.carrera || null,
                        matricula: d.matricula || null,
                        turno: d.turno || null
                    };
                });
            } catch (e) {
                console.warn('[ReportesService] Error fetching users batch:', e);
            }
        }

        // Also try fetching by matricula for records without UID
        const matsToFetch = new Set();
        records.forEach(r => {
            if (!r._uid && r.matricula && r.matricula !== 'N/A' && !Object.values(_userCache).find(u => u.matricula === r.matricula)) {
                matsToFetch.add(r.matricula);
            }
        });

        for (const mat of matsToFetch) {
            try {
                const snap = await ctx.db.collection('usuarios').where('matricula', '==', mat).limit(1).get();
                if (!snap.empty) {
                    const doc = snap.docs[0];
                    const d = doc.data();
                    _userCache[`mat_${mat}`] = {
                        genero: d.genero || (d.personalData && d.personalData.genero) || null,
                        carrera: d.carrera || null,
                        matricula: d.matricula || null,
                        turno: d.turno || null
                    };
                }
            } catch (e) { /* silently skip */ }
        }

        // Enrich each record
        return records.map(r => {
            const userData = r._uid
                ? (_userCache[r._uid] || {})
                : (_userCache[`mat_${r.matricula}`] || {});

            r.genero = userData.genero || null;
            r.carrera = userData.carrera || null;
            r.generacion = extractGeneracion(userData.matricula || r.matricula);
            if (!r.matricula || r.matricula === 'N/A') r.matricula = userData.matricula || 'N/A';
            return r;
        });
    }

    /**
     * Obtiene datos consolidados para el reporte.
     * @param {Object} filters { start, end, areas: ['BIBLIO','MEDICO'] }
     */
    async function getReportData(ctx, filters) {
        const start = filters.start || new Date();
        const end = new Date(filters.end || new Date());
        end.setHours(23, 59, 59, 999);

        let allData = [];

        if (filters.areas.includes('BIBLIO')) {
            const [visitas, prestamos] = await Promise.all([
                fetchBiblioVisitas(ctx, start, end),
                fetchBiblioPrestamos(ctx, start, end)
            ]);
            allData = [...allData, ...visitas, ...prestamos];
        }

        if (filters.areas.includes('MEDICO')) {
            const citas = await fetchCitasMedi(ctx, start, end);
            allData = [...allData, ...citas];
        }

        // Enriquecimiento demográfico
        allData = await enrichWithUserData(ctx, allData);

        return allData.sort((a, b) => b.fecha - a.fecha);
    }

    // ==================== FETCH FUNCTIONS ====================

    async function fetchBiblioVisitas(ctx, start, end) {
        try {
            const snap = await ctx.db.collection('biblio-visitas')
                .where('fecha', '>=', start)
                .where('fecha', '<=', end)
                .orderBy('fecha', 'desc')
                .limit(2000)
                .get();

            return snap.docs.map(doc => {
                const d = doc.data();
                const entrada = d.fecha?.toDate ? d.fecha.toDate() : new Date();
                return {
                    id: doc.id,
                    fecha: entrada,
                    usuario: d.studentName || d.nombre || 'Visitante',
                    matricula: d.matricula || 'N/A',
                    _uid: d.uid || d.studentId || null,
                    area: 'Biblioteca',
                    subarea: 'Visitas',
                    tipo: d.motivo || 'General',
                    detalle: d.servicios ? d.servicios.join(', ') : (d.motivo || 'Visita general'),
                    status: d.salida ? 'Completado' : 'En Curso',
                    hora: entrada.getHours()
                };
            });
        } catch (e) {
            console.warn('[ReportesService] Error fetching biblio-visitas:', e);
            return [];
        }
    }

    async function fetchBiblioPrestamos(ctx, start, end) {
        try {
            const snap = await ctx.db.collection('prestamos-biblio')
                .where('fechaPrestamo', '>=', start)
                .where('fechaPrestamo', '<=', end)
                .orderBy('fechaPrestamo', 'desc')
                .limit(2000)
                .get();

            return snap.docs.map(doc => {
                const d = doc.data();
                const fecha = d.fechaPrestamo?.toDate ? d.fechaPrestamo.toDate() : new Date();
                return {
                    id: doc.id,
                    fecha,
                    usuario: d.studentName || d.nombre || 'Usuario',
                    matricula: d.matricula || d.studentId || 'N/A',
                    _uid: d.studentId || null,
                    area: 'Biblioteca',
                    subarea: 'Préstamos',
                    tipo: 'Préstamo',
                    detalle: d.titulo || d.bookTitle || 'Material sin título',
                    status: d.estado || 'Activo',
                    hora: fecha.getHours()
                };
            });
        } catch (e) {
            console.warn('[ReportesService] Error fetching prestamos-biblio:', e);
            return [];
        }
    }

    async function fetchCitasMedi(ctx, start, end) {
        try {
            const snap = await ctx.db.collection('citas-medi')
                .where('fechaHora', '>=', start)
                .where('fechaHora', '<=', end)
                .orderBy('fechaHora', 'desc')
                .limit(2000)
                .get();

            return snap.docs.map(doc => {
                const d = doc.data();
                const fecha = d.fechaHora?.toDate ? d.fechaHora.toDate() : new Date();
                const isPsico = d.servicio === 'psicologia' ||
                    d.tipoServicio === 'Psicologico' ||
                    d.doctorName?.toLowerCase().includes('psic') ||
                    d.consultorio === 'PSICOLOGIA';

                return {
                    id: doc.id,
                    fecha,
                    usuario: d.studentName || 'Paciente',
                    matricula: d.studentId || d.matricula || 'N/A',
                    _uid: d.studentId || null,
                    area: 'Servicios Médicos',
                    subarea: isPsico ? 'Psicología' : 'Medicina General',
                    tipo: d.tipoServicio || (isPsico ? 'Consulta Psicológica' : 'Consulta Médica'),
                    detalle: d.motivo || 'Consulta general',
                    diagnostico: d.diagnostico || null,
                    status: d.estado || 'Pendiente',
                    profesional: d.profesionalName || d.doctorName || null,
                    turno: d.profesionalShift || d.turno || null,
                    hora: fecha.getHours()
                };
            });
        } catch (e) {
            console.warn('[ReportesService] Error fetching citas-medi:', e);
            return [];
        }
    }

    // ==================== STATS ====================

    /**
     * Genera estadísticas con soporte de filtros demográficos.
     * @param {Array} data - datos (ya filtrados por el caller)
     */
    function generateStats(data) {
        const stats = {
            total: data.length,
            byArea: {},
            bySubarea: {},
            byDay: {},
            byHour: {},
            byStatus: {},
            byTipo: {},
            byGenero: {},
            byCarrera: {},
            byGeneracion: {},
            byDiagnostico: {},
            topUsers: {}
        };

        data.forEach(item => {
            stats.byArea[item.area] = (stats.byArea[item.area] || 0) + 1;
            stats.bySubarea[item.subarea] = (stats.bySubarea[item.subarea] || 0) + 1;

            const dayKey = item.fecha.toISOString().split('T')[0];
            stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + 1;

            if (item.hora !== undefined) {
                const hourKey = `${String(item.hora).padStart(2, '0')}:00`;
                stats.byHour[hourKey] = (stats.byHour[hourKey] || 0) + 1;
            }

            stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
            stats.byTipo[item.tipo] = (stats.byTipo[item.tipo] || 0) + 1;

            if (item.genero) stats.byGenero[item.genero] = (stats.byGenero[item.genero] || 0) + 1;
            if (item.carrera) stats.byCarrera[item.carrera] = (stats.byCarrera[item.carrera] || 0) + 1;
            if (item.generacion) stats.byGeneracion[item.generacion] = (stats.byGeneracion[item.generacion] || 0) + 1;
            if (item.diagnostico) stats.byDiagnostico[item.diagnostico] = (stats.byDiagnostico[item.diagnostico] || 0) + 1;

            const userKey = item.matricula !== 'N/A' ? item.matricula : item.usuario;
            stats.topUsers[userKey] = (stats.topUsers[userKey] || 0) + 1;
        });

        // Derived
        const days = Object.keys(stats.byDay).length || 1;
        stats.avgDaily = Math.round(stats.total / days * 10) / 10;

        // Peak hour
        let peakHour = '--', peakCount = 0;
        Object.entries(stats.byHour).forEach(([h, c]) => { if (c > peakCount) { peakCount = c; peakHour = h; } });
        stats.peakHour = peakHour;

        // Top diagnóstico
        stats.topDiagnosticos = Object.entries(stats.byDiagnostico)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // Top tipo
        let topTipo = '--', topTipoCount = 0;
        Object.entries(stats.byTipo).forEach(([t, c]) => { if (c > topTipoCount) { topTipoCount = c; topTipo = t; } });
        stats.topTipo = topTipo;

        // Completion rate
        const completed = Object.entries(stats.byStatus)
            .filter(([s]) => {
                const sl = s.toLowerCase();
                return sl.includes('completado') || sl.includes('finaliz') || sl.includes('devuelto') || sl.includes('emitido') || sl === 'entregado';
            })
            .reduce((sum, [, c]) => sum + c, 0);
        stats.completionRate = stats.total > 0 ? Math.round(completed / stats.total * 100) : 0;

        return stats;
    }

    /**
     * Aplica filtros demográficos a los datos.
     */
    function applyFilters(data, filters) {
        return data.filter(item => {
            if (filters.genero && item.genero !== filters.genero) return false;
            if (filters.carrera && item.carrera !== filters.carrera) return false;
            if (filters.generacion && item.generacion !== parseInt(filters.generacion)) return false;
            if (filters.subarea && item.subarea !== filters.subarea) return false;
            return true;
        });
    }

    /**
     * Extrae las opciones únicas de filtro de los datos.
     */
    function getFilterOptions(data) {
        const opts = {
            generos: new Set(),
            carreras: new Set(),
            generaciones: new Set(),
            subareas: new Set()
        };
        data.forEach(item => {
            if (item.genero) opts.generos.add(item.genero);
            if (item.carrera) opts.carreras.add(item.carrera);
            if (item.generacion) opts.generaciones.add(item.generacion);
            if (item.subarea) opts.subareas.add(item.subarea);
        });
        return {
            generos: [...opts.generos].sort(),
            carreras: [...opts.carreras].sort(),
            generaciones: [...opts.generaciones].sort((a, b) => b - a),
            subareas: [...opts.subareas].sort()
        };
    }

    return {
        getReportData,
        generateStats,
        applyFilters,
        getFilterOptions,
        extractGeneracion,
        MODULES
    };

})();

window.ReportesService = ReportesService;
