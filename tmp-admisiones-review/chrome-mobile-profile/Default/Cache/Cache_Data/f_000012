window.ReportesService = (function () {

    // Solo los módulos relevantes para Desarrollo Académico
    const MODULES = {
        'POBLACION': { name: 'Población SIA', color: '#0f766e', icon: 'bi-people-fill', gradient: 'linear-gradient(135deg, #0d9488, #0f766e)' },
        'BIBLIO': { name: 'Biblioteca', color: '#f59e0b', icon: 'bi-book-half', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
        'MEDICO': { name: 'Servicios Médicos', color: '#6366f1', icon: 'bi-heart-pulse-fill', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
        'PSICOPEDAGOGICO': { name: 'Atención Psicopedagógica', color: '#0ea5e9', icon: 'bi-chat-heart-fill', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }
    };

    const MODULE_VOCACIONAL = { name: 'Test Vocacional', color: '#0bacbe', icon: 'bi-journal-check', gradient: 'linear-gradient(135deg, #0dcaf0, #0bacbe)' };
    MODULES.VOCACIONAL = MODULE_VOCACIONAL;

    // Cache de usuarios para evitar re-fetches
    let _userCache = {};
    let _consultasCache = {}; // Cache para _enrichWithConsultaDetails
    const _userCacheTimes = {};
    const _consultasCacheTimes = {};

    // Cache transversal en memoria para evitar refetches caros sin persistir datos sensibles en disco
    const _memoryCache = new Map();
    const _pendingRequests = new Map();
    const CACHE_TTL_LANDING = 2 * 60 * 1000; // 2 minutos
    const CACHE_TTL_BIBLIO = 5 * 60 * 1000; // 5 minutos
    const CACHE_TTL_MEDICO = 5 * 60 * 1000; // 5 minutos
    const CACHE_TTL_USERS = 20 * 60 * 1000; // 20 minutos
    const CACHE_TTL_REPORT_DATA = 5 * 60 * 1000; // 5 minutos
    const CACHE_TTL_CONSULTAS = 15 * 60 * 1000; // 15 minutos
    const CACHE_TTL_POBLACION = 6 * 60 * 60 * 1000; // 6 horas
    const CACHE_TTL_EXPEDIENTES = 60 * 60 * 1000; // 1 hora

    function isFresh(ts, ttl) {
        return Number.isFinite(ts) && (Date.now() - ts) < ttl;
    }

    function cloneCacheValue(value) {
        if (value instanceof Date) return new Date(value.getTime());
        if (Array.isArray(value)) return value.map(cloneCacheValue);
        if (value && typeof value === 'object') {
            const clone = {};
            Object.keys(value).forEach((key) => {
                clone[key] = cloneCacheValue(value[key]);
            });
            return clone;
        }
        return value;
    }

    function normalizeCachePart(value) {
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(normalizeCachePart).join(',');
        if (value && typeof value === 'object') return JSON.stringify(value);
        return String(value ?? '');
    }

    function buildCacheKey(namespace, ...parts) {
        return [namespace, ...parts.map(normalizeCachePart)].join('::');
    }

    async function getFromMemoryCache(key, ttl, loader) {
        const cached = _memoryCache.get(key);
        if (cached && isFresh(cached.ts, ttl)) {
            return cloneCacheValue(cached.data);
        }

        if (_pendingRequests.has(key)) {
            return cloneCacheValue(await _pendingRequests.get(key));
        }

        const promise = Promise.resolve()
            .then(loader)
            .then((data) => {
                _memoryCache.set(key, { ts: Date.now(), data: cloneCacheValue(data) });
                return cloneCacheValue(data);
            })
            .finally(() => {
                _pendingRequests.delete(key);
            });

        _pendingRequests.set(key, promise);
        return cloneCacheValue(await promise);
    }

    function toDate(value) {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        if (typeof value?.toDate === 'function') {
            const date = value.toDate();
            return Number.isNaN(date?.getTime?.()) ? null : date;
        }
        if (typeof value?.seconds === 'number') {
            const date = new Date(value.seconds * 1000);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function normalizeLabel(value) {
        if (value === undefined || value === null) return null;
        const raw = typeof value === 'string' ? value.trim() : String(value).trim();
        return raw ? raw.replace(/\s+/g, ' ') : null;
    }

    function firstNonEmpty(...values) {
        for (const value of values) {
            if (Array.isArray(value)) {
                if (value.length > 0) return value;
                continue;
            }
            if (value === undefined || value === null) continue;
            if (typeof value === 'string') {
                if (value.trim()) return value.trim();
                continue;
            }
            return value;
        }
        return null;
    }

    function splitMultiValue(value) {
        if (Array.isArray(value)) {
            return value.flatMap((item) => splitMultiValue(item));
        }

        const label = normalizeLabel(value);
        if (!label) return [];

        return label
            .split(/[,;/]+/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function normalizeGenero(value) {
        const label = normalizeLabel(value);
        if (!label) return null;
        const norm = normalizeText(label);

        if (['m', 'masculino', 'masc', 'hombre', 'varon', 'male'].includes(norm)) return 'Masculino';
        if (['f', 'femenino', 'fem', 'mujer', 'female'].includes(norm)) return 'Femenino';
        if (['no binario', 'nobinario', 'no-binario', 'nb'].includes(norm)) return 'No binario';
        if (['otro', 'prefiero no decir', 'prefiero no especificar'].includes(norm)) return 'Otro';

        return label;
    }

    function normalizeTurno(value) {
        const label = normalizeLabel(value);
        if (!label) return null;
        const norm = normalizeText(label);

        if (norm.includes('matutin')) return 'Matutino';
        if (norm.includes('vespert')) return 'Vespertino';
        if (norm.includes('nocturn')) return 'Nocturno';
        if (norm.includes('mixt')) return 'Mixto';

        return label;
    }

    function normalizeCarrera(value) {
        const label = normalizeLabel(value);
        if (!label) return null;
        const norm = normalizeText(label);
        if (['n/a', 'na', 'sin carrera', 'no especificado', 'ninguna'].includes(norm)) return null;
        return /^[a-z0-9-]{2,10}$/i.test(label.replace(/\s+/g, '')) ? label.toUpperCase() : label;
    }

    function normalizeEstadoCivil(value) {
        const label = normalizeLabel(value);
        if (!label) return null;
        const norm = normalizeText(label);

        if (norm.includes('solter')) return 'Soltero(a)';
        if (norm.includes('casad')) return 'Casado(a)';
        if (norm.includes('union libre')) return 'Union libre';
        if (norm.includes('divorci')) return 'Divorciado(a)';
        if (norm.includes('viud')) return 'Viudo(a)';

        return label;
    }

    function normalizeYesNo(value, defaultValue = 'No') {
        const label = normalizeLabel(value);
        if (!label) return defaultValue;
        const norm = normalizeText(label);

        if (['si', 'sí', 's', 'true', '1', 'yes'].includes(norm) || norm.startsWith('si ') || norm.startsWith('sí ')) return 'Sí';
        if (['no', 'n', 'false', '0', 'ninguna', 'ninguno', 'n/a', 'na', 'sin'].includes(norm) || norm.startsWith('no ')) return 'No';

        return defaultValue;
    }

    function normalizeDependientes(value, qtyValue) {
        const qty = Number.parseInt(qtyValue, 10);
        if (Number.isFinite(qty)) return qty > 0 ? 'Sí' : 'No';

        const label = normalizeLabel(value);
        if (!label) return 'No';
        const norm = normalizeText(label);

        if (['no', '0', 'ninguno', 'ninguna', 'n/a', 'na'].includes(norm) || norm.startsWith('no ')) return 'No';
        if (norm.includes('si') || norm.includes('sí') || /\d+/.test(norm)) return 'Sí';

        return 'No';
    }

    function normalizeScholarship(value) {
        const label = normalizeLabel(value);
        if (!label) return 'No';
        const norm = normalizeText(label);
        if (['no', 'ninguna', 'ninguno', 'false', '0', 'n/a', 'na'].includes(norm)) return 'No';
        if (['si', 'sí', 'true', '1'].includes(norm)) return 'Sí';
        return label;
    }

    function normalizeDisabilityList(profile = {}) {
        const raw = firstNonEmpty(
            profile.healthData?.discapacidad,
            profile.discapacidad
        );

        const items = splitMultiValue(raw)
            .map((item) => normalizeLabel(item))
            .filter(Boolean)
            .filter((item) => !['ninguna', 'no', 'n/a', 'na'].includes(normalizeText(item)));

        return [...new Set(items)];
    }

    function detectUsesGlasses(profile = {}) {
        const explicitValue = firstNonEmpty(profile.usaLentes);
        if (explicitValue !== null) return normalizeYesNo(explicitValue);

        const supportValue = firstNonEmpty(
            profile.culturalData?.apoyoTecnico,
            profile.healthData?.apoyoTecnico,
            profile.apoyoTecnico,
            profile.appoyoTecnico
        );

        const norm = normalizeText(supportValue);
        if (norm && (norm.includes('lente') || norm.includes('anteojo') || norm.includes('gafa') || norm.includes('armazon'))) {
            return 'Sí';
        }

        return 'No';
    }

    function normalizeHealthText(value, fallback = 'Ninguna') {
        const parts = splitMultiValue(value)
            .map((item) => normalizeLabel(item))
            .filter(Boolean)
            .filter((item) => !['ninguna', 'no', 'ninguno', 'n/a', 'na', 'sin'].includes(normalizeText(item)));

        return parts.length ? parts.join(', ') : fallback;
    }

    function extractColonia(profile = {}) {
        const domicilio = normalizeLabel(firstNonEmpty(profile.domicilio, profile.personalData?.domicilio));
        if (!domicilio) return 'No especificada';

        const match = domicilio.match(/col(?:onia)?\.?\s+([^,;]+)/i);
        if (match && match[1]) return match[1].trim();

        return 'No especificada';
    }

    function resolveIdiomas(profile = {}) {
        const labels = [];

        const extraIdiomas = firstNonEmpty(
            profile.idiomasExtras,
            profile.culturalData?.idiomasExtra,
            profile.culturalData?.idiomasExtras
        );

        splitMultiValue(extraIdiomas).forEach((item) => {
            const label = normalizeLabel(item);
            if (!label) return;
            if (['ninguno', 'ninguna', 'no', 'n/a', 'na'].includes(normalizeText(label))) return;
            labels.push(label);
        });

        const lenguaIndigena = normalizeLabel(profile.culturalData?.lenguaIndigena);
        if (lenguaIndigena && !['no', 'ninguna', 'ninguno', 'n/a', 'na'].includes(normalizeText(lenguaIndigena))) {
            labels.push(lenguaIndigena);
        }

        if (normalizeYesNo(profile.culturalData?.lenguaSenas, '') === 'Sí') {
            labels.push('Lengua de señas');
        }

        const unique = [...new Set(labels)];
        return unique.length ? unique.join(', ') : 'Ninguno';
    }

    function resolveGeneracion(profile = {}, fallbackMatricula = null) {
        const explicit = Number.parseInt(firstNonEmpty(profile.generacion), 10);
        if (Number.isFinite(explicit) && explicit >= 2000 && explicit <= 2100) {
            return explicit;
        }

        const tipoUsuario = normalizeText(firstNonEmpty(profile.tipoUsuario, profile.category));
        const role = normalizeText(profile.role);
        const hasAcademicContext = Boolean(firstNonEmpty(
            profile.carrera,
            profile.academicData?.carrera,
            profile.turno,
            profile.institutionalContext?.turno
        ));
        const isStudentProfile = tipoUsuario === 'estudiante'
            || role === 'student'
            || role === 'estudiante'
            || hasAcademicContext;

        if (!isStudentProfile) return null;

        const matricula = normalizeLabel(firstNonEmpty(profile.matricula, fallbackMatricula));
        return extractGeneracion(matricula);
    }

    function resolvePopulationSubarea(profile = {}) {
        const role = normalizeText(profile.role);
        const tipoUsuario = normalizeText(profile.tipoUsuario);
        const allowedViews = Array.isArray(profile.allowedViews) ? profile.allowedViews : [];

        const isModuleAdminRole = [
            'superadmin',
            'department_admin',
            'biblio',
            'biblio_admin',
            'medi',
            'medico',
            'medico_oficial',
            'medico_psicologo',
            'psicologo',
            'aula_admin',
            'foro_admin'
        ].includes(role);

        const hasModuleViews = allowedViews.some((viewId) => [
            'view-biblio',
            'view-medi',
            'view-foro',
            'view-aula',
            'view-cafeteria',
            'view-reportes',
            'view-vocacional-admin'
        ].includes(viewId));

        if (isModuleAdminRole || hasModuleViews) return 'ADMIN_MODULO';
        if (tipoUsuario === 'estudiante' || role === 'student' || role === 'estudiante') return 'ESTUDIANTE';
        if (tipoUsuario === 'docente' || role === 'docente' || role === 'aula') return 'DOCENTE';
        if (tipoUsuario === 'administrativo' || tipoUsuario === 'operativo') return 'ADMINISTRATIVO';

        return 'ADMINISTRATIVO';
    }

    function buildNormalizedUserLookup(profile = {}, docId = '') {
        const matricula = normalizeLabel(firstNonEmpty(profile.matricula, profile.numeroControl));

        return {
            nombre: normalizeLabel(firstNonEmpty(
                profile.displayName,
                profile.nombre,
                profile.name,
                profile.personalData?.nombre,
                profile.emailInstitucional,
                profile.email,
                docId
            )),
            genero: normalizeGenero(firstNonEmpty(profile.genero, profile.personalData?.genero, profile.sexo)),
            carrera: normalizeCarrera(firstNonEmpty(profile.carrera, profile.academicData?.carrera)),
            matricula: matricula || null,
            turno: normalizeTurno(firstNonEmpty(
                profile.turno,
                profile.institutionalContext?.turno,
                profile.institutionalContext?.operativoTurno
            )),
            generacion: resolveGeneracion(profile, matricula)
        };
    }

    function cacheUserLookupEntry(cacheKey, lookup, ts = Date.now()) {
        if (!cacheKey || !lookup || typeof lookup !== 'object') return;
        _userCache[cacheKey] = lookup;
        _userCacheTimes[cacheKey] = ts;

        if (lookup.matricula) {
            const matriculaKey = `mat_${lookup.matricula}`;
            _userCache[matriculaKey] = lookup;
            _userCacheTimes[matriculaKey] = ts;
        }
    }

    /**
     * Extrae la generación a partir de la matrícula.
     * Ej: "22380123" → 2022, "19380456" → 2019
     */
    function extractGeneracion(matricula) {
        if (!matricula || matricula === 'N/A') return null;
        const cleanMatricula = String(matricula).replace(/\D/g, '');
        if (cleanMatricula.length < 8) return null;

        const prefix = cleanMatricula.substring(0, 2);
        const num = parseInt(prefix, 10);
        const maxPrefix = (new Date().getFullYear() % 100) + 1;
        if (isNaN(num) || num < 10 || num > maxPrefix) return null;
        return 2000 + num;
    }

    /**
     * Descarga todos los documentos de una query paginando por lotes.
     * Evita truncar reportes largos por un límite fijo de 500 registros.
     * @param {firebase.firestore.Query} baseQuery
     * @param {number} pageSize
     * @returns {Promise<Array>}
     */
    async function fetchAllDocs(baseQuery, pageSize = 500) {
        const docs = [];
        let lastDoc = null;

        while (true) {
            let query = baseQuery.limit(pageSize);
            if (lastDoc) query = query.startAfter(lastDoc);

            const snap = await query.get();
            docs.push(...snap.docs);

            if (snap.size < pageSize) break;
            lastDoc = snap.docs[snap.docs.length - 1];
        }

        return docs;
    }

    /**
     * Enriquece registros con datos demográficos del alumno (género, carrera, generación).
     * Hace un batch fetch de la colección `usuarios` por UIDs.
     */
    async function enrichWithUserData(ctx, records) {
        // Collect unique UIDs that need fetching
        const uidsToFetch = new Set();
        records.forEach(r => {
            if (r.area === 'Población SIA') return;
            if (r._uid && (!_userCache[r._uid] || !isFresh(_userCacheTimes[r._uid], CACHE_TTL_USERS))) {
                uidsToFetch.add(r._uid);
            }
        });

        // Batch fetch (Firestore 'in' query supports up to 30 at a time)
        const uidArray = [...uidsToFetch];
        for (let i = 0; i < uidArray.length; i += 30) {
            const batch = uidArray.slice(i, i + 30);
            try {
                const snap = await ctx.db.collection('usuarios').where('__name__', 'in', batch).get();
                const fetchedAt = Date.now();
                snap.docs.forEach(doc => {
                    const lookup = buildNormalizedUserLookup(doc.data(), doc.id);
                    cacheUserLookupEntry(doc.id, lookup, fetchedAt);
                });
            } catch (e) {
                console.warn('[ReportesService] Error fetching users batch:', e);
            }
        }

        // Also try fetching by matricula for records without UID
        const matsToFetch = new Set();
        records.forEach(r => {
            if (r.area === 'Población SIA') return;
            if (
                !r._uid &&
                r.matricula &&
                r.matricula !== 'N/A' &&
                !isFresh(_userCacheTimes[`mat_${r.matricula}`], CACHE_TTL_USERS)
            ) {
                matsToFetch.add(r.matricula);
            }
        });

        const matriculaArray = [...matsToFetch];
        for (let i = 0; i < matriculaArray.length; i += 30) {
            const batch = matriculaArray.slice(i, i + 30);
            try {
                const snap = await ctx.db.collection('usuarios').where('matricula', 'in', batch).get();
                const fetchedAt = Date.now();
                snap.docs.forEach(doc => {
                    const lookup = buildNormalizedUserLookup(doc.data(), doc.id);
                    cacheUserLookupEntry(doc.id, lookup, fetchedAt);
                });
                batch.forEach((mat) => {
                    const matriculaKey = `mat_${mat}`;
                    if (!isFresh(_userCacheTimes[matriculaKey], CACHE_TTL_USERS)) {
                        _userCache[matriculaKey] = _userCache[matriculaKey] || {};
                        _userCacheTimes[matriculaKey] = fetchedAt;
                    }
                });
            } catch (e) { /* silently skip */ }
        }

        // Enrich each record
        return records.map(r => {
            if (r.area === 'Población SIA') return r;

            const userData = r._uid
                ? (_userCache[r._uid] || {})
                : (_userCache[`mat_${r.matricula}`] || {});
            const resolvedGeneracion = userData.generacion ?? resolveGeneracion({
                generacion: r.generacion,
                matricula: userData.matricula || r.matricula,
                tipoUsuario: r.tipoUsuario,
                role: r.role,
                carrera: userData.carrera || r.carrera,
                turno: userData.turno || r.turno
            }, userData.matricula || r.matricula);

            if (userData.nombre && ['Usuario', 'Paciente', 'Visitante'].includes(r.usuario)) {
                r.usuario = userData.nombre;
            }
            r.genero = userData.genero || r.genero || null;
            r.carrera = userData.carrera || r.carrera || null;
            r.turno = userData.turno || r.turno || null;
            r.generacion = Number.isFinite(resolvedGeneracion) ? resolvedGeneracion : null;
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

        const requestedAreas = Array.isArray(filters.areas) ? [...new Set(filters.areas)].sort() : [];
        const cacheKey = buildCacheKey('report-data', requestedAreas, start, end);

        return getFromMemoryCache(cacheKey, CACHE_TTL_REPORT_DATA, async () => {
            let allData = [];

        if (requestedAreas.includes('BIBLIO')) {
            const [visitas, prestamos] = await Promise.all([
                fetchBiblioVisitas(ctx, start, end),
                fetchBiblioPrestamos(ctx, start, end)
            ]);
            allData = [...allData, ...visitas, ...prestamos];
        }

        if (requestedAreas.includes('MEDICO') || requestedAreas.includes('PSICOPEDAGOGICO')) {
            const citas = await fetchCitasMedi(ctx, start, end);
            const healthAreaSet = new Set(requestedAreas.filter((area) => area === 'MEDICO' || area === 'PSICOPEDAGOGICO'));
            allData = [...allData, ...citas.filter((item) => healthAreaSet.has(item.areaKey || 'MEDICO'))];
        }

        if (requestedAreas.includes('POBLACION')) {
            const poblacion = await fetchPoblacionData(ctx, start, end);
            allData = [...allData, ...poblacion];
        }

        // Enriquecimiento demográfico
        allData = await enrichWithUserData(ctx, allData);

            return allData.sort((a, b) => b.fecha - a.fecha);
        });
    }

    async function fetchVocacionalStats(ctx) {
        return getFromMemoryCache(buildCacheKey('vocacional-stats'), CACHE_TTL_LANDING, async () => {
            let cachedStats = null;

            try {
                const cacheSnap = await ctx.db.collection('reportes_cache').doc('vocacional_stats').get();
                if (cacheSnap.exists) {
                    cachedStats = cacheSnap.data()?.stats || null;
                }
            } catch (e) {
                console.warn('[ReportesService] No se pudo leer cache vocacional:', e);
            }

            if (cachedStats) {
                return cachedStats;
            }

            const getCountSafe = async (customQuery) => {
                try { return (await customQuery.count().get()).data().count; }
                catch (e) { return (await customQuery.get()).size; }
            };

            try {
                const [totalAspirantes, totalCompleted] = await Promise.all([
                    getCountSafe(ctx.db.collection('aspirantes-registros')),
                    getCountSafe(
                        ctx.db.collection('aspirantes-registros')
                            .where('testStatus', '==', 'completed')
                    )
                ]);

                return {
                    totalAspirantes,
                    totalCompleted,
                    demandaCareers: {},
                    procedenciaPrepas: {},
                    ofertaEducativa: []
                };
            } catch (e) {
                console.warn('[ReportesService] No se pudieron calcular estadisticas vocacionales en vivo:', e);
                return null;
            }
        });
    }

    async function fetchLandingKPIs(ctx) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const getCountSafe = async (customQuery) => {
            try { return (await customQuery.count().get()).data().count; }
            catch (e) { return (await customQuery.get()).size; }
        };

        return getFromMemoryCache(buildCacheKey('landing-kpis', today, todayEnd), CACHE_TTL_LANDING, async () => {
            const safeMetric = async (label, loader) => {
                try {
                    return await loader();
                } catch (e) {
                    console.warn(`[ReportesService] Error loading landing KPI (${label}):`, e);
                    return null;
                }
            };
            const getConsultasHoy = async () => {
                try {
                    return await getCountSafe(
                        ctx.db.collection('citas-medi')
                            .where('fechaHoraSlot', '>=', today)
                            .where('fechaHoraSlot', '<=', todayEnd)
                    );
                } catch (slotError) {
                    return getCountSafe(
                        ctx.db.collection('citas-medi')
                            .where('fechaSolicitud', '>=', today)
                            .where('fechaSolicitud', '<=', todayEnd)
                    );
                }
            };

            const [usuarios, visitasHoy, consultasHoy, vocacional] = await Promise.all([
                safeMetric('usuarios', () => getCountSafe(ctx.db.collection('usuarios'))),
                safeMetric('visitas', () => getCountSafe(
                    ctx.db.collection('biblio-visitas')
                        .where('fecha', '>=', today)
                        .where('fecha', '<=', todayEnd)
                )),
                safeMetric('consultas', getConsultasHoy),
                safeMetric('vocacional', () => fetchVocacionalStats(ctx))
            ]);

            const citasHoyRaw = await safeMetric('consultas-detalle', () => fetchCitasMedi(ctx, today, todayEnd));
            const citasHoy = Array.isArray(citasHoyRaw) ? citasHoyRaw : [];
            const consultasMedicasHoy = Array.isArray(citasHoy)
                ? citasHoy.filter((item) => item.areaKey === 'MEDICO').length
                : null;
            const consultasPsicopedagogicasHoy = Array.isArray(citasHoy)
                ? citasHoy.filter((item) => item.areaKey === 'PSICOPEDAGOGICO').length
                : null;

            return { usuarios, visitasHoy, consultasHoy, consultasMedicasHoy, consultasPsicopedagogicasHoy, vocacional };
        });
    }

    // ==================== FETCH FUNCTIONS ====================

    async function fetchBiblioVisitas(ctx, start, end) {
        const cacheKey = buildCacheKey('biblio-visitas', start, end);
        return getFromMemoryCache(cacheKey, CACHE_TTL_BIBLIO, async () => {
            try {
                const docs = await fetchAllDocs(
                    ctx.db.collection('biblio-visitas')
                        .where('fecha', '>=', start)
                        .where('fecha', '<=', end)
                        .orderBy('fecha', 'desc')
                );

                return docs.map(doc => {
                    const d = doc.data();
                    const entrada = toDate(d.fecha) || new Date();
                    const salida = toDate(d.salida);
                    let duracionMin = null;
                    if (salida && entrada) {
                        duracionMin = Math.round((salida - entrada) / 60000);
                        if (duracionMin < 0 || duracionMin > 1440) duracionMin = null;
                    }
                    return {
                        id: doc.id,
                        fecha: entrada,
                        usuario: d.studentName || d.nombre || 'Visitante',
                        matricula: d.matricula || 'N/A',
                        _uid: d.uid || d.studentId || null,
                        area: 'Biblioteca',
                        subarea: 'Visitas',
                        tipo: d.motivo || 'General',
                        detalle: Array.isArray(d.servicios) ? d.servicios.join(', ') : (d.motivo || 'Visita general'),
                        status: d.salida ? 'Completado' : 'En Curso',
                        hora: entrada.getHours(),
                        tipoUsuario: d.tipoUsuario || 'estudiante',
                        salida,
                        duracionMin,
                        esGrupal: Array.isArray(d.relatedUsers) && d.relatedUsers.length > 0,
                        cantidadGrupo: Array.isArray(d.relatedUsers) ? d.relatedUsers.length + 1 : 1
                    };
                });
            } catch (e) {
                console.warn('[ReportesService] Error fetching biblio-visitas:', e);
                return [];
            }
        });
    }

    async function fetchBiblioPrestamos(ctx, start, end) {
        const cacheKey = buildCacheKey('biblio-prestamos', start, end);
        return getFromMemoryCache(cacheKey, CACHE_TTL_BIBLIO, async () => {
        try {
            const docs = await fetchAllDocs(
                ctx.db.collection('prestamos-biblio')
                .where('fechaSolicitud', '>=', start)
                .where('fechaSolicitud', '<=', end)
                .orderBy('fechaSolicitud', 'desc')
            );

            return docs.map(doc => {
                const d = doc.data();
                const fecha = toDate(d.fechaSolicitud) || new Date();

                const rawStatus = normalizeText(d.estado);
                const fechaVencimiento = toDate(d.fechaVencimiento);
                const fechaDevReal = toDate(d.fechaDevolucionReal);
                const now = new Date();
                const multaActual = rawStatus === 'entregado' && fechaVencimiento && now > fechaVencimiento
                    ? Math.max(0, Math.floor((now - fechaVencimiento) / 86400000)) * 21
                    : 0;
                let finalStatus = 'Activo';

                if (rawStatus === 'finalizado' || rawStatus === 'devuelto') {
                    finalStatus = 'Devuelto';
                } else if (rawStatus === 'cobro_pendiente') {
                    finalStatus = 'Devuelto con multa';
                } else if (rawStatus === 'no_recogido') {
                    finalStatus = 'No recogido';
                } else if (rawStatus === 'cancelado') {
                    finalStatus = 'Cancelado';
                } else if (rawStatus === 'pendiente' || rawStatus === 'pendiente_entrega') {
                    finalStatus = 'Pendiente';
                } else if (rawStatus === 'entregado') {
                    finalStatus = fechaVencimiento && now > fechaVencimiento ? 'Retraso' : 'Activo';
                }

                return {
                    id: doc.id,
                    fecha,
                    usuario: d.studentName || d.nombre || 'Usuario',
                    matricula: d.matricula || d.studentId || 'N/A',
                    _uid: d.studentId || null,
                    area: 'Biblioteca',
                    subarea: 'Préstamos',
                    tipo: 'Préstamo',
                    detalle: d.titulo || d.bookTitle || d.tituloLibro || 'Material sin título',
                    status: finalStatus,
                    hora: fecha.getHours(),
                    extensiones: d.extensiones || 0,
                    multaActual,
                    montoDeuda: d.montoDeuda || 0,
                    perdonado: d.perdonado || false,
                    fechaVencimiento,
                    fechaDevolucionReal: fechaDevReal,
                    origenPrestamo: d.origenPrestamo || 'app'
                };
            });
        } catch (e) {
            console.warn('[ReportesService] Error fetching prestamos-biblio:', e);
            return [];
        }
        });
    }

    async function fetchCitasMedi(ctx, start, end) {
        const cacheKey = buildCacheKey('citas-medi', start, end);
        return getFromMemoryCache(cacheKey, CACHE_TTL_MEDICO, async () => {
        try {
            // Usar citas-medi (colección top-level) — no requiere índices especiales
            let docs = [];
            try {
                docs = await fetchAllDocs(
                    ctx.db.collection('citas-medi')
                        .where('fechaHoraSlot', '>=', start)
                        .where('fechaHoraSlot', '<=', end)
                        .orderBy('fechaHoraSlot', 'desc')
                );
            } catch (slotError) {
                docs = await fetchAllDocs(
                    ctx.db.collection('citas-medi')
                        .where('fechaSolicitud', '>=', start)
                        .where('fechaSolicitud', '<=', end)
                        .orderBy('fechaSolicitud', 'desc')
                );
            }

            const results = docs.map(doc => {
                const d = doc.data();
                const fecha = toDate(d.fechaHoraSlot) || toDate(d.fechaConfirmacion) || toDate(d.fechaSolicitud) || new Date();
                const tipoServicio = normalizeText(d.tipoServicio);
                const isPsico = tipoServicio.includes('psico');
                const statusCode = normalizeText(d.estado) || 'pendiente';

                return {
                    id: doc.id,
                    fecha,
                    usuario: d.studentName || d.pacienteNombre || 'Paciente',
                    matricula: d.matricula || 'N/A',
                    _uid: d.studentId || null,
                    areaKey: isPsico ? 'PSICOPEDAGOGICO' : 'MEDICO',
                    area: isPsico ? 'Atención Psicopedagógica' : 'Servicios Médicos',
                    subarea: isPsico ? 'Psicología' : 'Medicina General',
                    tipo: isPsico ? 'Consulta Psicopedagógica' : 'Consulta Médica',
                    detalle: d.motivo || d.motivoConsulta || 'Consulta general',
                    diagnostico: d.diagnostico || null,
                    status: d.estado || 'Pendiente',
                    statusCode,
                    profesional: d.profesionalName || d.autorName || null,
                    turno: d.profesionalShift || d.shift || null,
                    hora: fecha.getHours(),
                    duracion: d.duracion || null,
                    medicamentos: d.medicamentos || null,
                    tratamiento: d.tratamiento || null,
                    especialidad: d.medicoEspecialidad || null
                };
            }).filter((item) => !['cancelada', 'rechazada', 'borrador'].includes(item.statusCode));

            // Intentar enriquecer con datos de consultas finalizadas (subcollection)
            try {
                await _enrichWithConsultaDetails(ctx, results);
            } catch (enrichErr) {
                console.warn('[ReportesService] No se pudieron enriquecer diagnósticos (índice faltante?):', enrichErr.message);
            }

            return results;
        } catch (e) {
            console.warn('[ReportesService] Error fetching citas-medi:', e);
            return [];
        }
        });
    }

    /**
     * Intenta enriquecer citas con datos de consulta (diagnóstico, tratamiento).
     * Busca en expedientes-clinicos/{uid}/consultas por studentId.
     * Falla silenciosamente si no hay índices.
     * @private
     */
    async function _enrichWithConsultaDetails(ctx, records) {
        // Agrupar por studentId para hacer menos queries
        const byStudent = {};
        records.forEach(r => {
            if (r._uid && r.status && r.status.toLowerCase() === 'finalizada') {
                if (!byStudent[r._uid]) byStudent[r._uid] = [];
                byStudent[r._uid].push(r);
            }
        });

        const studentIds = Object.keys(byStudent).slice(0, 30); // Limitar a 30 pacientes

        await Promise.all(studentIds.map(async (uid) => {
            try {
                let consultasMap;
                if (_consultasCache[uid] && isFresh(_consultasCacheTimes[uid], CACHE_TTL_CONSULTAS)) {
                    consultasMap = _consultasCache[uid];
                } else {
                    const snap = await ctx.db.collection('expedientes-clinicos').doc(uid)
                        .collection('consultas')
                        .orderBy('createdAt', 'desc')
                        .limit(10)
                        .get();

                    consultasMap = {};
                    snap.docs.forEach(doc => {
                        const d = doc.data();
                        const ts = toDate(d.createdAt)?.getTime() || 0;
                        consultasMap[ts] = d;
                    });
                    _consultasCache[uid] = consultasMap;
                    _consultasCacheTimes[uid] = Date.now();
                }

                // Intentar matchear consultas con citas por fecha cercana (±2h)
                byStudent[uid].forEach(cita => {
                    const citaTs = cita.fecha.getTime();
                    let bestMatch = null, bestDiff = Infinity;
                    Object.entries(consultasMap).forEach(([ts, consulta]) => {
                        const diff = Math.abs(citaTs - Number(ts));
                        if (diff < bestDiff && diff < 7200000) { // 2 horas
                            bestDiff = diff;
                            bestMatch = consulta;
                        }
                    });
                    if (bestMatch) {
                        cita.diagnostico = bestMatch.diagnostico || cita.diagnostico;
                        cita.tratamiento = bestMatch.tratamiento || cita.tratamiento;
                        cita.medicamentos = bestMatch.medicamentos || cita.medicamentos;
                        cita.duracion = bestMatch.duracionMinutos || cita.duracion;
                    }
                });
            } catch (e) {
                // Silently skip individual failures
            }
        }));
    }

    function _filterPoblacionByRange(data, start, end) {
        if (!(start instanceof Date) && !(end instanceof Date)) return data;

        const startTs = start instanceof Date ? start.getTime() : null;
        const endTs = end instanceof Date ? end.getTime() : null;

        return data.filter(item => {
            const ts = item.fecha instanceof Date ? item.fecha.getTime() : new Date(item.fecha).getTime();
            if (Number.isNaN(ts)) return false;
            if (startTs !== null && ts < startTs) return false;
            if (endTs !== null && ts > endTs) return false;
            return true;
        });
    }

    function buildPoblacionRecord(doc) {
        const u = doc.data() || {};
        const lookup = buildNormalizedUserLookup(u, doc.id);
        const fecha = toDate(firstNonEmpty(u.fechaRegistro, u.createdAt)) || new Date();

        return {
            id: doc.id,
            fecha,
            usuario: lookup.nombre || doc.id,
            matricula: lookup.matricula || 'N/A',
            role: u.role || '',
            carrera: lookup.carrera || null,
            genero: lookup.genero || null,
            generacion: lookup.generacion || null,
            turno: lookup.turno || null,
            colonia: extractColonia(u),
            estadoCivil: normalizeEstadoCivil(firstNonEmpty(u.estadoCivil, u.personalData?.estadoCivil)) || 'No especificado',
            dependientes: normalizeDependientes(firstNonEmpty(u.dependientes, u.personalData?.dependientes), firstNonEmpty(u.dependientesQty, u.personalData?.dependientesQty)),
            beca: normalizeScholarship(firstNonEmpty(u.beca, u.personalData?.beca)),
            trabaja: normalizeYesNo(firstNonEmpty(u.trabaja, u.personalData?.trabaja)),
            idiomas: resolveIdiomas(u),
            usaLentes: detectUsesGlasses(u),
            discapacidades: normalizeDisabilityList(u),
            enfermedadCronica: normalizeHealthText(firstNonEmpty(
                u.healthData?.enfermedadCronica,
                u.condicionesCronicas,
                u.enfermedadCronica,
                u.healthData?.padecimientoFisico,
                u.healthData?.condicionSalud
            )),
            alergia: normalizeHealthText(firstNonEmpty(u.alergias, u.healthData?.alergia)),
            apoyoPsico: normalizeYesNo(u.healthData?.apoyoPsico),
            area: 'Población SIA',
            subarea: resolvePopulationSubarea(u)
        };
    }

    async function fetchPoblacionData(ctx, start = null, end = null) {
        if (!ctx.db) throw new Error("Firestore no inicializado");

        const minimalData = await getFromMemoryCache('poblacion-full', CACHE_TTL_POBLACION, async () => {
            console.log('[SIA] Reconstruyendo cache de poblacion en memoria...');
            try {
                const snapshot = await ctx.db.collection('usuarios').get();
                return snapshot.docs.map(buildPoblacionRecord);
            } catch (e) {
                console.error('[SIA] Error fallando query a usuarios:', e);
                throw e;
            }
        });

        return _filterPoblacionByRange(minimalData, start, end);
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
            if (filters.turno && item.turno !== filters.turno) return false;
            if (filters.generacion) {
                const selectedGeneration = Number.parseInt(filters.generacion, 10);
                if (Number.isFinite(selectedGeneration) && item.generacion !== selectedGeneration) return false;
            }
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
            turnos: new Set(),
            generaciones: new Set(),
            subareas: new Set()
        };
        data.forEach(item => {
            if (item.genero && normalizeText(item.genero) !== 'no especificado') opts.generos.add(item.genero);
            if (item.carrera && normalizeText(item.carrera) !== 'n/a') opts.carreras.add(item.carrera);
            if (item.turno && !['n/a', 'no especificado'].includes(normalizeText(item.turno))) opts.turnos.add(item.turno);
            if (Number.isFinite(item.generacion)) opts.generaciones.add(item.generacion);
            if (item.subarea) opts.subareas.add(item.subarea);
        });
        return {
            generos: [...opts.generos].sort(),
            carreras: [...opts.carreras].sort(),
            turnos: [...opts.turnos].sort(),
            generaciones: [...opts.generaciones].sort((a, b) => b - a),
            subareas: [...opts.subareas].sort()
        };
    }

    // ==================== FETCH EXTRAS (Catálogo, Activos, Expedientes) ====================

    /**
     * Obtiene el catálogo de libros de biblioteca utilizando caché local de 12h.
     * @param {Object} ctx - Contexto de la app
     * @returns {Promise<Array>}
     */
    async function fetchBiblioCatalogo(ctx) {
        const cacheKey = 'sia_reports_cache_biblio_catalogo';
        const metaKey = cacheKey + '_meta';
        const now = Date.now();
        const TTL = 12 * 60 * 60 * 1000; // 12 hours

        try {
            const localCache = localStorage.getItem(cacheKey);
            const localMeta = localStorage.getItem(metaKey);
            if (localCache && localMeta) {
                const meta = JSON.parse(localMeta);
                if (now - meta.updatedAt < TTL) {
                    console.log(`[ReportesService] Catálogo cargado de caché local. Reads: 0`);
                    return JSON.parse(localCache);
                }
            }
        } catch (e) {
            console.warn('[ReportesService] Error leyendo caché local del catálogo', e);
        }

        try {
            console.log(`[ReportesService] Descargando catálogo completo de BD...`);
            const snap = await ctx.db.collection('biblio-catalogo').get();
            const data = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    titulo: d.titulo || 'Sin título',
                    autor: d.autor || 'Desconocido',
                    categoria: d.categoria || 'General',
                    copiasDisponibles: d.copiasDisponibles ?? 0,
                    active: d.active !== false
                };
            });

            try {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                localStorage.setItem(metaKey, JSON.stringify({ updatedAt: now }));
            } catch (sf) {
                console.warn('[ReportesService] No se pudo guardar caché local del catálogo', sf);
            }
            return data;
        } catch (e) {
            console.warn('[ReportesService] Error fetching biblio-catalogo:', e);
            return [];
        }
    }

    /**
     * Obtiene el estado de los activos/equipos de biblioteca (Caché local de 5 min)
     * @param {Object} ctx - Contexto de la app
     * @returns {Promise<Array>}
     */
    async function fetchBiblioActivos(ctx) {
        const cacheKey = 'sia_reports_cache_biblio_activos';
        const metaKey = cacheKey + '_meta';
        const now = Date.now();
        const TTL = 5 * 60 * 1000; // 5 minutos

        try {
            const localCache = localStorage.getItem(cacheKey);
            const localMeta = localStorage.getItem(metaKey);
            if (localCache && localMeta) {
                const meta = JSON.parse(localMeta);
                if (now - meta.updatedAt < TTL) {
                    return JSON.parse(localCache);
                }
            }
        } catch (e) { }

        try {
            const snap = await ctx.db.collection('biblio-activos').get();
            const data = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    nombre: d.nombre || 'Equipo',
                    tipo: d.tipo || 'General',
                    status: d.status || 'disponible',
                    occupiedBy: d.occupiedBy || null,
                    occupiedAt: d.occupiedAt?.toDate ? d.occupiedAt.toDate() : null
                };
            });
            try {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                localStorage.setItem(metaKey, JSON.stringify({ updatedAt: now }));
            } catch (sf) { }
            return data;
        } catch (e) {
            console.warn('[ReportesService] Error fetching biblio-activos:', e);
            return [];
        }
    }

    /**
     * Obtiene estadísticas de expedientes clínicos para perfil de salud (Caché local 8h).
     * @param {Object} ctx - Contexto de la app
     * @returns {Promise<Array>}
     */
    async function fetchExpedientesStats(ctx) {
        return getFromMemoryCache('expedientes-stats', CACHE_TTL_EXPEDIENTES, async () => {
            try {
                console.log('[ReportesService] Descargando expedientes completos de BD...');
                const snap = await ctx.db.collection('expedientes-clinicos').get();
                return snap.docs.map(doc => {
                    const d = doc.data() || {};
                    return {
                        id: doc.id,
                        nombre: d.nombre || d.patientName || 'Paciente',
                        tipoSangre: firstNonEmpty(d.tipoSangre, d.healthData?.tipoSangre) || null,
                        enfermedadesCronicas: firstNonEmpty(d.enfermedadesCronicas, d.healthData?.enfermedadesCronicas) || null,
                        alergias: firstNonEmpty(d.alergias, d.healthData?.alergias) || null,
                        peso: d.peso || null,
                        altura: d.altura || null,
                        presion: d.presion || null,
                        frecuenciaCardiaca: d.frecuenciaCardiaca || null
                    };
                });
            } catch (e) {
                console.warn('[ReportesService] Error fetching expedientes-clinicos:', e);
                return [];
            }
        });
    }

    return {
        getReportData,
        generateStats,
        applyFilters,
        getFilterOptions,
        extractGeneracion,
        MODULES,
        fetchLandingKPIs,
        fetchVocacionalStats,
        fetchPoblacionData,
        fetchBiblioCatalogo,
        fetchBiblioActivos,
        fetchExpedientesStats
    };

})();

window.ReportesService = ReportesService;
