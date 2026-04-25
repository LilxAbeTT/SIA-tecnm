const BiblioService = (function () {
    const CAT_COLL = 'biblio-catalogo';
    const PRES_COLL = 'prestamos-biblio';
    const VISITAS_COLL = 'biblio-visitas';
    const ACTIVE_VISITS_COLL = 'biblio-visitas-activos';
    const SUG_COLL = 'biblio-solicitudes';
    const WISHLIST_COLL = 'biblio-wishlist';
    const USERS_COLL = 'usuarios';
    const BIBLIO_CONFIG_COLL = 'biblio-config';
    const HOLIDAY_CALENDAR_DOC_ID = 'loan-calendar';
    const INVENTORY_COLL = 'biblio-inventarios';
    const INVENTORY_META_DOC_ID = 'inventory-current';
    const INVENTORY_FOUND_SUBCOLL = 'encontrados';
    const INVENTORY_MISSING_SUBCOLL = 'faltantes';
    const CATALOG_STATE_DOC_ID = 'catalog-state';
    const CATALOG_STORAGE_KEY = 'sia_biblio_catalog';
    const CATALOG_META_STORAGE_KEY = 'sia_biblio_catalog_meta';
    const CATALOG_STATE_CHECK_TTL = 60 * 1000;
    const CATALOG_CACHE_MAX_AGE = 12 * 60 * 60 * 1000;

    const ACTIVE_LOAN_STATES = new Set(['pendiente', 'pendiente_entrega', 'entregado']);
    const CACHE_SCHEMA_VERSION = 2;
    const LOCAL_CACHE_TTL = 5 * 60 * 1000;
    const HOLIDAY_CACHE_TTL = 5 * 60 * 1000;
    const HOLIDAY_STORAGE_KEY = 'sia_biblio_holiday_calendar_v1';
    const SEARCH_TEXT_MIN_CHARS = 3;
    const PICKUP_WINDOW_MS = 24 * 60 * 60 * 1000;
    const ANON_DUPLICATE_WINDOW_MS = 45 * 1000;
    const ACTIVE_VISIT_AUTO_CLOSE_MS = 60 * 60 * 1000;
    const ACTIVE_VISIT_CLEANUP_TTL = 60 * 1000;
    const PENDING_LOAN_CLEANUP_TTL = 60 * 1000;
    const VISIT_SUMMARY_CACHE_TTL = 60 * 1000;
    const RECENT_OVERDUE_CACHE_TTL = 5 * 60 * 1000;
    const DEFAULT_LOAN_DAYS = 1;
    const LITERATURE_LOAN_DAYS = 7;
    const EXTENDED_LOAN_CATEGORIES = new Set([
        'literatura',
        'literatura / novela'
    ]);
    let _visitSummaryCache = null;
    let _visitSummaryCacheTime = 0;
    let _activeVisitCleanupTime = 0;
    let _activeVisitCleanupPromise = null;
    let _pendingLoanCleanupTime = 0;
    let _recentOverdueCache = null;
    let _recentOverdueCacheTime = 0;
    let _holidayCalendarCache = loadHolidayCalendarFromStorage();
    let _holidayCalendarCacheTime = _holidayCalendarCache?.updatedAtMs || 0;

    const COSTO_MULTA_DIARIA = 21;
    const LIMITE_BLOQUEO = 63; // 3 días de retraso

    // --- HELPERS LÓGICOS ---
    const norm = s => (s || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    function normalizeRoleText(value) {
        return norm(value || '');
    }

    function normalizeGeneroLabel(value) {
        const label = String(value || '').trim();
        const normalized = norm(label);
        if (!normalized) return null;
        if (['m', 'masculino', 'masc', 'hombre', 'varon', 'male'].includes(normalized)) return 'Masculino';
        if (['f', 'femenino', 'fem', 'mujer', 'female'].includes(normalized)) return 'Femenino';
        return null;
    }

    function normalizeTurnoLabel(value) {
        const label = String(value || '').trim();
        const normalized = norm(label);
        if (!normalized) return null;
        if (normalized.includes('matutin')) return 'Matutino';
        if (normalized.includes('vespert')) return 'Vespertino';
        return null;
    }

    function isLikelyControlNumber(value) {
        const raw = String(value || '').trim();
        if (!/^\d{8,10}$/.test(raw)) return false;
        return raw.slice(2, 4) === '38';
    }

    function isExternalStudentMatricula(value) {
        return /^b[\w-]+$/i.test(String(value || '').trim());
    }

    function isLikelyStudentIdentifier(value) {
        return isLikelyControlNumber(value) || isExternalStudentMatricula(value);
    }

    function isLikelyAcademicOrStaffProfile(profile) {
        const tipoUsuario = normalizeRoleText(profile?.tipoUsuario);
        const role = normalizeRoleText(profile?.role);
        const jobTitle = normalizeRoleText(profile?.originalJobTitle || profile?.jobTitle || profile?.puesto);

        if (['docente', 'personal academico', 'academico', 'profesor', 'maestro', 'catedratico', 'administrativo', 'personal'].includes(tipoUsuario)) {
            return true;
        }

        if (['aula', 'aula_admin', 'admin', 'superadmin', 'personal', 'docente'].includes(role)) {
            return true;
        }

        return /(docente|profesor|maestro|catedratic|academico|administrativ|personal)/.test(jobTitle);
    }

    function toDisplayLabel(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, (match) => match.toUpperCase());
    }

    function pickFirstFilled(...values) {
        for (const value of values) {
            const text = String(value || '').trim();
            if (text) return text;
        }
        return '';
    }

    function getAcademicInfo(profile = {}) {
        const tipoUsuario = normalizeRoleText(profile?.tipoUsuario);
        const role = normalizeRoleText(profile?.role);
        const isStudent = tipoUsuario === 'estudiante'
            || role === 'student'
            || (!isLikelyAcademicOrStaffProfile(profile) && isLikelyStudentIdentifier(profile?.matricula));

        if (isStudent) {
            const carrera = pickFirstFilled(
                profile?.carrera,
                profile?.career,
                profile?.programa,
                profile?.program,
                profile?.especialidad,
                profile?.specialty
            );
            return {
                kind: 'Carrera',
                label: carrera || 'Sin carrera registrada'
            };
        }

        const area = pickFirstFilled(
            profile?.area,
            profile?.areaAdscripcion,
            profile?.adscripcion,
            profile?.department,
            profile?.departamento,
            profile?.specialty,
            profile?.especialidad,
            profile?.originalJobTitle,
            profile?.jobTitle,
            profile?.puesto
        );

        return {
            kind: 'Área',
            label: toDisplayLabel(area || 'Sin área registrada')
        };
    }

    function getBorrowerPolicy(profile) {
        const matricula = String(profile?.matricula || '').trim();
        const isStudentLike = isLikelyStudentIdentifier(matricula);
        const isLikelyStaff = !isStudentLike && isLikelyAcademicOrStaffProfile(profile);
        return {
            matricula,
            isStudentLike,
            isLikelyStaff,
            requiresConfirmation: !isStudentLike,
            suggestedBorrowerKind: isLikelyStaff ? 'staff' : 'student',
            prompt: !isStudentLike
                ? 'Este usuario no parece alumno con numero de control regular. Confirma si el prestamo es para docente/personal.'
                : ''
        };
    }

    async function getQueryCountSafe(queryRef) {
        if (!queryRef) return null;
        if (typeof queryRef.count === 'function') {
            try {
                const snap = await queryRef.count().get();
                return snap?.data?.().count ?? snap?.data().count ?? null;
            } catch (error) {
                console.warn('[BIBLIO] No se pudo obtener conteo agregado.', error);
                return null;
            }
        }
        return null;
    }

    function getBookCategory(source) {
        if (!source) return '';
        if (typeof source === 'string') return source;
        return source.categoriaLibro ?? source.categoria ?? '';
    }

    function isWeeklyLoanCategory(category) {
        return EXTENDED_LOAN_CATEGORIES.has(norm(category).replace(/\s+/g, ' '));
    }

    function getLoanPolicy(source, options = {}) {
        const category = getBookCategory(source);
        const borrowerKind = String(
            options.borrowerKind
            || source?.borrowerKind
            || (options.staffLoan || source?.staffLoan || source?.lateFeeExempt ? 'staff' : 'student')
        ).trim().toLowerCase();
        const isWeekly = isWeeklyLoanCategory(category) || borrowerKind === 'staff';
        const lateFeeExempt = borrowerKind === 'staff' || options.lateFeeExempt === true || source?.lateFeeExempt === true;
        return {
            category,
            borrowerKind,
            durationDays: isWeekly ? LITERATURE_LOAN_DAYS : DEFAULT_LOAN_DAYS,
            isWeekly,
            lateFeeExempt,
            tracksLateWithoutCharge: lateFeeExempt,
            label: isWeekly ? '1 semana' : '1 dia habil',
            notice: isWeekly
                ? 'Este libro tiene un prestamo especial de 1 semana.'
                : 'Este libro tiene un prestamo de 1 dia habil.'
        };
    }

    function getLateInfo(source) {
        const loanPolicy = getLoanPolicy(source);
        const fechaVencimiento = source?.fechaVencimiento ?? source;
        const dueDate = toDateSafe(fechaVencimiento);
        if (!dueDate) {
            return { daysLate: 0, rawFine: 0, fine: 0, loanPolicy };
        }
        const now = new Date();
        if (now <= dueDate) {
            return { daysLate: 0, rawFine: 0, fine: 0, loanPolicy };
        }

        const daysLate = countBusinessLateDays(dueDate, now);
        const rawFine = daysLate > 0 ? daysLate * COSTO_MULTA_DIARIA : 0;
        return {
            daysLate,
            rawFine,
            fine: loanPolicy.lateFeeExempt ? 0 : rawFine,
            loanPolicy
        };
    }

    function getCaseVariants(value) {
        const base = (value || '').toString().trim();
        return [...new Set([base, base.toUpperCase(), base.toLowerCase()].filter(Boolean))];
    }

    function isLoanStillActive(loan) {
        return ACTIVE_LOAN_STATES.has(loan?.estado);
    }

    function buildWishlistDocId(uid, bookId) {
        return `${uid}__${bookId}`;
    }

    function getBookYear(data = {}) {
        return data.anio ?? data.año ?? data['año'] ?? null;
    }

    function formatDateKeyLocal(value) {
        const fecha = value instanceof Date ? value : toDateSafe(value);
        if (!fecha || Number.isNaN(fecha.getTime())) return '';
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDateKeyLocal(value) {
        const raw = String(value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
        const [year, month, day] = raw.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    function normalizeHolidayDateKey(value) {
        if (!value) return '';
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
            return value.trim();
        }
        return formatDateKeyLocal(value);
    }

    function normalizeHolidayDateList(values = []) {
        return [...new Set((Array.isArray(values) ? values : [])
            .map((value) => normalizeHolidayDateKey(value))
            .filter(Boolean))]
            .sort();
    }

    function createHolidayCalendarSnapshot(rawData = {}) {
        const holidayDates = normalizeHolidayDateList(rawData.holidayDates || rawData.diasInhabiles || []);
        const blockedDates = normalizeHolidayDateList(rawData.blockedDates || rawData.periodDates || rawData.rangoInhabilitado || []);
        const nonBusinessDates = [...new Set([...holidayDates, ...blockedDates])].sort();
        return {
            holidayDates,
            blockedDates,
            blockedDateSet: new Set(blockedDates),
            holidayDateSet: new Set(nonBusinessDates),
            updatedAt: rawData.updatedAt || null,
            updatedBy: rawData.updatedBy || '',
            updatedAtMs: rawData.updatedAtMs || null
        };
    }

    function persistHolidayCalendarToStorage(snapshot) {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify({
                holidayDates: snapshot?.holidayDates || [],
                blockedDates: snapshot?.blockedDates || [],
                updatedAtMs: snapshot?.updatedAtMs || Date.now(),
                updatedBy: snapshot?.updatedBy || ''
            }));
        } catch (error) {
            console.warn('[BIBLIO] No se pudo persistir calendario inhábil:', error);
        }
    }

    function loadHolidayCalendarFromStorage() {
        if (typeof window === 'undefined' || !window.localStorage) return createHolidayCalendarSnapshot();
        try {
            const raw = JSON.parse(window.localStorage.getItem(HOLIDAY_STORAGE_KEY) || 'null');
            if (!raw) return createHolidayCalendarSnapshot();
            return createHolidayCalendarSnapshot(raw);
        } catch (error) {
            console.warn('[BIBLIO] No se pudo leer calendario inhábil local:', error);
            return createHolidayCalendarSnapshot();
        }
    }

    function setHolidayCalendarCache(snapshot) {
        _holidayCalendarCache = createHolidayCalendarSnapshot(snapshot);
        _holidayCalendarCache.updatedAtMs = snapshot?.updatedAtMs || Date.now();
        _holidayCalendarCacheTime = Date.now();
        persistHolidayCalendarToStorage(_holidayCalendarCache);
        return _holidayCalendarCache;
    }

    function getHolidayCalendarSnapshot() {
        if (!_holidayCalendarCache) {
            _holidayCalendarCache = createHolidayCalendarSnapshot();
        }
        return _holidayCalendarCache;
    }

    async function ensureHolidayCalendarLoaded(ctx, { force = false } = {}) {
        const now = Date.now();
        if (!force && _holidayCalendarCache && (now - _holidayCalendarCacheTime) < HOLIDAY_CACHE_TTL) {
            return _holidayCalendarCache;
        }

        if (!ctx?.db) {
            return getHolidayCalendarSnapshot();
        }

        try {
            const doc = await ctx.db.collection(BIBLIO_CONFIG_COLL).doc(HOLIDAY_CALENDAR_DOC_ID).get();
            const data = doc.exists ? doc.data() || {} : {};
            return setHolidayCalendarCache({
                holidayDates: data.holidayDates || data.diasInhabiles || [],
                blockedDates: data.blockedDates || data.periodDates || [],
                updatedAt: data.updatedAt || null,
                updatedBy: data.updatedBy || '',
                updatedAtMs: now
            });
        } catch (error) {
            console.warn('[BIBLIO] No se pudo cargar calendario inhábil:', error);
            return getHolidayCalendarSnapshot();
        }
    }

    function isHolidayDate(fecha, calendar = getHolidayCalendarSnapshot()) {
        return calendar?.holidayDateSet?.has(formatDateKeyLocal(fecha)) === true;
    }

    function isBusinessDay(fecha, calendar = getHolidayCalendarSnapshot()) {
        const day = fecha.getDay();
        return day !== 0 && day !== 6 && !isHolidayDate(fecha, calendar);
    }

    function moveDueDateToBusinessDay(fecha, calendar = getHolidayCalendarSnapshot()) {
        fecha.setHours(12, 0, 0, 0);
        while (!isBusinessDay(fecha, calendar)) {
            fecha.setDate(fecha.getDate() + 1);
        }
        fecha.setHours(18, 0, 0, 0);
        return fecha;
    }

    function addBusinessDays(fechaInicio, businessDays, calendar = getHolidayCalendarSnapshot()) {
        const fecha = new Date(fechaInicio);
        fecha.setHours(12, 0, 0, 0);
        let remaining = Math.max(0, Number(businessDays) || 0);

        while (remaining > 0) {
            fecha.setDate(fecha.getDate() + 1);
            if (isBusinessDay(fecha, calendar)) {
                remaining -= 1;
            }
        }

        return moveDueDateToBusinessDay(fecha, calendar);
    }

    function countBusinessLateDays(fechaVencimiento, comparisonDate = new Date(), calendar = getHolidayCalendarSnapshot()) {
        const dueDate = toDateSafe(fechaVencimiento);
        const endDate = comparisonDate instanceof Date ? comparisonDate : toDateSafe(comparisonDate);
        if (!dueDate || !endDate || endDate <= dueDate) return 0;

        const cursor = new Date(dueDate);
        cursor.setHours(12, 0, 0, 0);
        cursor.setDate(cursor.getDate() + 1);

        const endKey = formatDateKeyLocal(endDate);
        let daysLate = 0;
        while (formatDateKeyLocal(cursor) <= endKey) {
            if (isBusinessDay(cursor, calendar)) {
                daysLate += 1;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return daysLate;
    }

    function toDateSafe(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value.toDate === 'function') return value.toDate();
        return null;
    }

    function toMillisSafe(value) {
        if (!value) return null;
        if (value instanceof Date) return value.getTime();
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (typeof value === 'number') return value;
        return null;
    }

    const BIBLIO_GAMIFICATION_VERSION = 2;
    const MAX_BIBLIO_RECENT_UNLOCKS = 6;
    const DEFAULT_BIBLIO_PERKS = Object.freeze({
        maxDailyReservations: 1,
        reservationLeadMinutes: 15,
        recommendationSlots: 3
    });
    const BIBLIO_LEVEL_TITLES = Object.freeze([
        { minLevel: 1, title: 'Curioso del Acervo', weight: 5 },
        { minLevel: 3, title: 'Lector en Marcha', weight: 15 },
        { minLevel: 5, title: 'Gran Lector', weight: 30 },
        { minLevel: 8, title: 'Maestro del Catalogo', weight: 45 },
        { minLevel: 10, title: 'Gran Archivero', weight: 60 }
    ]);
    const BIBLIO_ACHIEVEMENTS = Object.freeze([
        {
            id: 'welcome_reader',
            category: 'Inicio',
            tier: 'bronze',
            icon: 'bi-stars',
            title: 'Bienvenida al Acervo',
            description: 'Abre el modulo de Biblioteca por primera vez.',
            target: 1,
            xpReward: 50,
            rewardLabel: 'Titulo: Curioso del Acervo',
            unlocks: { title: 'Curioso del Acervo', titleWeight: 10 },
            getProgress: stats => stats.libraryLoaded
        },
        {
            id: 'loan_request_1',
            category: 'Lectura',
            tier: 'bronze',
            icon: 'bi-bookmark-check',
            title: 'Primer Apartado',
            description: 'Solicita tu primer libro desde la app.',
            target: 1,
            xpReward: 40,
            rewardLabel: '+40 XP',
            getProgress: stats => stats.loanRequests
        },
        {
            id: 'loan_request_5',
            category: 'Lectura',
            tier: 'silver',
            icon: 'bi-journal-bookmark-fill',
            title: 'Lector en Marcha',
            description: 'Acumula 5 solicitudes de libros.',
            target: 5,
            xpReward: 75,
            rewardLabel: 'Titulo: Lector en Marcha',
            unlocks: { title: 'Lector en Marcha', titleWeight: 20 },
            getProgress: stats => stats.loanRequests
        },
        {
            id: 'loan_request_12',
            category: 'Lectura',
            tier: 'gold',
            icon: 'bi-collection-fill',
            title: 'Coleccionista del Acervo',
            description: 'Llega a 12 solicitudes historicas de libros.',
            target: 12,
            xpReward: 140,
            rewardLabel: '+140 XP',
            getProgress: stats => stats.loanRequests
        },
        {
            id: 'loan_request_20',
            category: 'Lectura',
            tier: 'platinum',
            icon: 'bi-stack',
            title: 'Curador de Lecturas',
            description: 'Llega a 20 solicitudes historicas de libros.',
            target: 20,
            xpReward: 240,
            rewardLabel: 'Titulo: Curador de Lecturas',
            unlocks: { title: 'Curador de Lecturas', titleWeight: 52 },
            getProgress: stats => stats.loanRequests
        },
        {
            id: 'pickup_1',
            category: 'Lectura',
            tier: 'bronze',
            icon: 'bi-bag-check-fill',
            title: 'Libro en Mano',
            description: 'Recoge tu primer libro en mostrador.',
            target: 1,
            xpReward: 40,
            rewardLabel: '+40 XP',
            getProgress: stats => stats.pickups
        },
        {
            id: 'pickup_5',
            category: 'Lectura',
            tier: 'silver',
            icon: 'bi-journal-check',
            title: 'Recolector del Acervo',
            description: 'Recoge 5 libros en mostrador.',
            target: 5,
            xpReward: 90,
            rewardLabel: '+90 XP',
            getProgress: stats => stats.pickups
        },
        {
            id: 'pickup_12',
            category: 'Lectura',
            tier: 'gold',
            icon: 'bi-box2-heart-fill',
            title: 'Recolector Experto',
            description: 'Recoge 12 libros en mostrador.',
            target: 12,
            xpReward: 180,
            rewardLabel: 'Titulo: Recolector Experto',
            unlocks: { title: 'Recolector Experto', titleWeight: 34 },
            getProgress: stats => stats.pickups
        },
        {
            id: 'returns_3',
            category: 'Disciplina',
            tier: 'silver',
            icon: 'bi-arrow-return-left',
            title: 'Custodio Novato',
            description: 'Completa 3 devoluciones registradas.',
            target: 3,
            xpReward: 90,
            rewardLabel: '+90 XP',
            getProgress: stats => stats.completedReturns
        },
        {
            id: 'returns_8',
            category: 'Disciplina',
            tier: 'gold',
            icon: 'bi-shield-check',
            title: 'Custodio del Acervo',
            description: 'Completa 8 devoluciones registradas.',
            target: 8,
            xpReward: 160,
            rewardLabel: 'Titulo: Custodio del Acervo',
            unlocks: { title: 'Custodio del Acervo', titleWeight: 35 },
            getProgress: stats => stats.completedReturns
        },
        {
            id: 'returns_15',
            category: 'Disciplina',
            tier: 'platinum',
            icon: 'bi-shield-fill-check',
            title: 'Veterano del Acervo',
            description: 'Completa 15 devoluciones registradas.',
            target: 15,
            xpReward: 250,
            rewardLabel: 'Titulo: Veterano del Acervo',
            unlocks: { title: 'Veterano del Acervo', titleWeight: 58 },
            getProgress: stats => stats.completedReturns
        },
        {
            id: 'ontime_1',
            category: 'Puntualidad',
            tier: 'bronze',
            icon: 'bi-alarm',
            title: 'Entrega Puntual',
            description: 'Devuelve un libro a tiempo.',
            target: 1,
            xpReward: 60,
            rewardLabel: '+60 XP',
            getProgress: stats => stats.onTimeReturns
        },
        {
            id: 'ontime_5',
            category: 'Puntualidad',
            tier: 'silver',
            icon: 'bi-alarm-fill',
            title: 'Reloj Bibliotecario',
            description: 'Devuelve 5 libros a tiempo.',
            target: 5,
            xpReward: 120,
            rewardLabel: '+120 XP',
            getProgress: stats => stats.onTimeReturns
        },
        {
            id: 'ontime_streak_3',
            category: 'Puntualidad',
            tier: 'gold',
            icon: 'bi-lightning-charge-fill',
            title: 'Cronista Puntual',
            description: 'Mantiene una racha de 3 devoluciones puntuales.',
            target: 3,
            xpReward: 130,
            rewardLabel: 'Titulo: Cronista Puntual',
            unlocks: { title: 'Cronista Puntual', titleWeight: 40 },
            getProgress: stats => stats.onTimeStreak
        },
        {
            id: 'ontime_streak_6',
            category: 'Puntualidad',
            tier: 'platinum',
            icon: 'bi-hourglass-split',
            title: 'Guardian del Tiempo',
            description: 'Mantiene una racha de 6 devoluciones puntuales.',
            target: 6,
            xpReward: 220,
            rewardLabel: 'Titulo: Guardian del Tiempo',
            unlocks: { title: 'Guardian del Tiempo', titleWeight: 55 },
            getProgress: stats => stats.onTimeStreak
        },
        {
            id: 'early_return_1',
            category: 'Puntualidad',
            tier: 'silver',
            icon: 'bi-skip-backward-circle-fill',
            title: 'Entrega Anticipada',
            description: 'Devuelve un libro con al menos un dia de anticipacion.',
            target: 1,
            xpReward: 80,
            rewardLabel: '+80 XP',
            getProgress: stats => stats.earlyReturns
        },
        {
            id: 'early_return_4',
            category: 'Puntualidad',
            tier: 'gold',
            icon: 'bi-fast-forward-circle-fill',
            title: 'Navegante del Tiempo',
            description: 'Devuelve 4 libros con anticipacion.',
            target: 4,
            xpReward: 170,
            rewardLabel: 'Titulo: Navegante del Tiempo',
            unlocks: { title: 'Navegante del Tiempo', titleWeight: 60 },
            getProgress: stats => stats.earlyReturns
        },
        {
            id: 'categories_3',
            category: 'Exploracion',
            tier: 'silver',
            icon: 'bi-compass',
            title: 'Explorador de Estantes',
            description: 'Lee libros de 3 categorias diferentes.',
            target: 3,
            xpReward: 100,
            rewardLabel: 'Perk: 5 recomendaciones',
            unlocks: { perks: { recommendationSlots: 5 } },
            getProgress: stats => stats.uniqueCategories
        },
        {
            id: 'categories_5',
            category: 'Exploracion',
            tier: 'gold',
            icon: 'bi-globe-americas',
            title: 'Explorador Multidisciplinario',
            description: 'Lee libros de 5 categorias diferentes.',
            target: 5,
            xpReward: 180,
            rewardLabel: 'Titulo y perk: 6 recomendaciones',
            unlocks: {
                title: 'Explorador Multidisciplinario',
                titleWeight: 32,
                perks: { recommendationSlots: 6 }
            },
            getProgress: stats => stats.uniqueCategories
        },
        {
            id: 'categories_8',
            category: 'Exploracion',
            tier: 'platinum',
            icon: 'bi-map-fill',
            title: 'Cartografo del Acervo',
            description: 'Lee libros de 8 categorias diferentes.',
            target: 8,
            xpReward: 240,
            rewardLabel: 'Perk: 8 recomendaciones',
            unlocks: { perks: { recommendationSlots: 8 } },
            getProgress: stats => stats.uniqueCategories
        },
        {
            id: 'visits_3',
            category: 'Presencial',
            tier: 'bronze',
            icon: 'bi-geo-alt-fill',
            title: 'Visitante Frecuente',
            description: 'Registra 3 visitas a la biblioteca.',
            target: 3,
            xpReward: 60,
            rewardLabel: '+60 XP',
            getProgress: stats => stats.visits
        },
        {
            id: 'visits_10',
            category: 'Presencial',
            tier: 'gold',
            icon: 'bi-building-check',
            title: 'Habitante de Sala',
            description: 'Registra 10 visitas a la biblioteca.',
            target: 10,
            xpReward: 150,
            rewardLabel: 'Titulo: Habitante de Sala',
            unlocks: { title: 'Habitante de Sala', titleWeight: 28 },
            getProgress: stats => stats.visits
        },
        {
            id: 'visits_20',
            category: 'Presencial',
            tier: 'platinum',
            icon: 'bi-building-fill-check',
            title: 'Alma de Biblioteca',
            description: 'Registra 20 visitas a la biblioteca.',
            target: 20,
            xpReward: 240,
            rewardLabel: 'Titulo y perk: reserva con 10 min de anticipacion',
            unlocks: {
                title: 'Alma de Biblioteca',
                titleWeight: 46,
                perks: { reservationLeadMinutes: 10 }
            },
            getProgress: stats => stats.visits
        },
        {
            id: 'reservations_1',
            category: 'Digital',
            tier: 'bronze',
            icon: 'bi-pc-display',
            title: 'Operador Inicial',
            description: 'Haz tu primera reserva digital.',
            target: 1,
            xpReward: 50,
            rewardLabel: '+50 XP',
            getProgress: stats => stats.reservations
        },
        {
            id: 'reservations_4',
            category: 'Digital',
            tier: 'silver',
            icon: 'bi-display',
            title: 'Operador Digital',
            description: 'Acumula 4 reservas digitales.',
            target: 4,
            xpReward: 110,
            rewardLabel: 'Perk: 2 reservas por dia',
            unlocks: {
                title: 'Operador Digital',
                titleWeight: 25,
                perks: { maxDailyReservations: 2 }
            },
            getProgress: stats => stats.reservations
        },
        {
            id: 'reservations_10',
            category: 'Digital',
            tier: 'gold',
            icon: 'bi-cpu-fill',
            title: 'Arquitecto Digital',
            description: 'Acumula 10 reservas digitales.',
            target: 10,
            xpReward: 220,
            rewardLabel: 'Perk: reserva con 5 min de anticipacion',
            unlocks: {
                title: 'Arquitecto Digital',
                titleWeight: 50,
                perks: { reservationLeadMinutes: 5 }
            },
            getProgress: stats => stats.reservations
        },
        {
            id: 'reservations_20',
            category: 'Digital',
            tier: 'platinum',
            icon: 'bi-motherboard-fill',
            title: 'Comandante Digital',
            description: 'Acumula 20 reservas digitales.',
            target: 20,
            xpReward: 260,
            rewardLabel: 'Titulo y perk: 3 reservas por dia',
            unlocks: {
                title: 'Comandante Digital',
                titleWeight: 53,
                perks: { maxDailyReservations: 3 }
            },
            getProgress: stats => stats.reservations
        },
        {
            id: 'suggestion_1',
            category: 'Comunidad',
            tier: 'silver',
            icon: 'bi-chat-square-text-fill',
            title: 'Voz del Catalogo',
            description: 'Envia una sugerencia de compra.',
            target: 1,
            xpReward: 70,
            rewardLabel: '+70 XP',
            getProgress: stats => stats.suggestions
        },
        {
            id: 'suggestion_3',
            category: 'Comunidad',
            tier: 'gold',
            icon: 'bi-megaphone-fill',
            title: 'Curador Comunitario',
            description: 'Envia 3 sugerencias de compra.',
            target: 3,
            xpReward: 140,
            rewardLabel: 'Titulo y perk: 7 recomendaciones',
            unlocks: {
                title: 'Curador Comunitario',
                titleWeight: 37,
                perks: { recommendationSlots: 7 }
            },
            getProgress: stats => stats.suggestions
        },
        {
            id: 'extensions_1',
            category: 'Estrategia',
            tier: 'bronze',
            icon: 'bi-plus-circle-fill',
            title: 'Estratega del Tiempo',
            description: 'Utiliza una extension de prestamo.',
            target: 1,
            xpReward: 45,
            rewardLabel: '+45 XP',
            getProgress: stats => stats.extensionsUsed
        },
        {
            id: 'extensions_3',
            category: 'Estrategia',
            tier: 'silver',
            icon: 'bi-calendar2-plus-fill',
            title: 'Plan Maestro',
            description: 'Utiliza 3 extensiones de prestamo.',
            target: 3,
            xpReward: 120,
            rewardLabel: '+120 XP',
            getProgress: stats => stats.extensionsUsed
        },
        {
            id: 'clean_account_5',
            category: 'Disciplina',
            tier: 'gold',
            icon: 'bi-patch-check-fill',
            title: 'Cuenta Impecable',
            description: 'Completa 5 devoluciones y mantente sin adeudos.',
            target: 1,
            xpReward: 140,
            rewardLabel: 'Titulo: Cuenta Impecable',
            unlocks: { title: 'Cuenta Impecable', titleWeight: 42 },
            getProgress: stats => (stats.completedReturns >= 5 && stats.deudaTotal === 0 ? 1 : 0)
        },
        {
            id: 'clean_account_10',
            category: 'Disciplina',
            tier: 'platinum',
            icon: 'bi-stars',
            title: 'Credencial Impecable',
            description: 'Completa 10 devoluciones y mantente sin adeudos ni retrasos activos.',
            target: 1,
            xpReward: 220,
            rewardLabel: 'Titulo: Credencial Impecable',
            unlocks: { title: 'Credencial Impecable', titleWeight: 62 },
            getProgress: stats => (stats.completedReturns >= 10 && stats.deudaTotal === 0 && stats.overdueActiveLoans === 0 ? 1 : 0)
        },
        {
            id: 'level_5',
            category: 'Maestria',
            tier: 'gold',
            icon: 'bi-trophy-fill',
            title: 'Gran Lector',
            description: 'Alcanza el nivel 5 de biblioteca.',
            target: 5,
            xpReward: 200,
            rewardLabel: 'Titulo: Gran Lector',
            unlocks: { title: 'Gran Lector', titleWeight: 48 },
            getProgress: stats => stats.level
        },
        {
            id: 'level_10',
            category: 'Maestria',
            tier: 'platinum',
            icon: 'bi-award-fill',
            title: 'Gran Archivero',
            description: 'Alcanza el nivel 10 de biblioteca.',
            target: 10,
            xpReward: 400,
            rewardLabel: 'Titulo: Gran Archivero',
            unlocks: { title: 'Gran Archivero', titleWeight: 70 },
            getProgress: stats => stats.level
        },
        {
            id: 'level_15',
            category: 'Maestria',
            tier: 'platinum',
            icon: 'bi-gem',
            title: 'Leyenda del Acervo',
            description: 'Alcanza el nivel 15 de biblioteca.',
            target: 15,
            xpReward: 500,
            rewardLabel: 'Titulo: Leyenda del Acervo',
            unlocks: { title: 'Leyenda del Acervo', titleWeight: 90 },
            getProgress: stats => stats.level
        }
    ]);

    function computeBiblioLevel(xp = 0) {
        return Math.max(1, Math.floor(Math.max(0, Number(xp) || 0) / 500) + 1);
    }

    function getBiblioLevelBounds(level = 1) {
        const safeLevel = Math.max(1, Number(level) || 1);
        return {
            level: safeLevel,
            startXp: (safeLevel - 1) * 500,
            nextXp: safeLevel * 500
        };
    }

    function capAchievementProgress(progress, target) {
        const safeProgress = Math.max(0, Number(progress) || 0);
        const safeTarget = Math.max(1, Number(target) || 1);
        return Math.min(safeProgress, safeTarget);
    }

    function normalizeAchievementMap(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return value;
    }

    function mergeBiblioPerks(base = {}, extra = {}) {
        return {
            maxDailyReservations: Math.max(
                Number(base.maxDailyReservations) || DEFAULT_BIBLIO_PERKS.maxDailyReservations,
                Number(extra.maxDailyReservations) || 0
            ),
            reservationLeadMinutes: Math.min(
                Number(base.reservationLeadMinutes) || DEFAULT_BIBLIO_PERKS.reservationLeadMinutes,
                Number(extra.reservationLeadMinutes) || Number(base.reservationLeadMinutes) || DEFAULT_BIBLIO_PERKS.reservationLeadMinutes
            ),
            recommendationSlots: Math.max(
                Number(base.recommendationSlots) || DEFAULT_BIBLIO_PERKS.recommendationSlots,
                Number(extra.recommendationSlots) || 0
            )
        };
    }

    function isPickedUpLoan(loan = {}) {
        return ['entregado', 'finalizado', 'devuelto', 'cobro_pendiente'].includes(loan.estado);
    }

    function isReturnedLoan(loan = {}) {
        return ['finalizado', 'devuelto', 'cobro_pendiente'].includes(loan.estado);
    }

    function isOnTimeReturn(loan = {}) {
        if (!isReturnedLoan(loan)) return false;
        const dueDate = toDateSafe(loan.fechaVencimiento);
        const returnedDate = toDateSafe(loan.fechaDevolucionReal);
        if (!dueDate || !returnedDate) return loan.estado !== 'cobro_pendiente';
        return returnedDate.getTime() <= dueDate.getTime();
    }

    function isEarlyReturn(loan = {}) {
        if (!isReturnedLoan(loan)) return false;
        const dueDate = toDateSafe(loan.fechaVencimiento);
        const returnedDate = toDateSafe(loan.fechaDevolucionReal);
        if (!dueDate || !returnedDate) return false;
        return dueDate.getTime() - returnedDate.getTime() >= (24 * 60 * 60 * 1000);
    }

    function getOnTimeReturnStreak(loans = []) {
        const ordered = loans
            .filter(isReturnedLoan)
            .slice()
            .sort((a, b) => {
                const aTime = toMillisSafe(a.fechaDevolucionReal) || 0;
                const bTime = toMillisSafe(b.fechaDevolucionReal) || 0;
                return bTime - aTime;
            });

        let streak = 0;
        for (const loan of ordered) {
            if (!isOnTimeReturn(loan)) break;
            streak += 1;
        }
        return streak;
    }

    function isReservationActive(data = {}) {
        if (!data || data.status !== 'activa' || !data.date) return false;
        const hourBlock = data.hourBlock || '00:00';
        const end = new Date(`${data.date}T${hourBlock}:00`);
        if (Number.isNaN(end.getTime())) return false;
        end.setHours(end.getHours() + 1);
        return end.getTime() > Date.now();
    }

    async function loadCatalogBooksByIds(ctx, ids = []) {
        const uniqueIds = [...new Set((ids || []).filter(Boolean))];
        if (uniqueIds.length === 0) return new Map();

        const map = new Map();
        for (let i = 0; i < uniqueIds.length; i += 10) {
            const chunk = uniqueIds.slice(i, i + 10);
            const snap = await ctx.db.collection(CAT_COLL)
                .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            snap.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
        }
        return map;
    }

    function resolveAchievementTitle(level = 1, achievementList = []) {
        let winner = BIBLIO_LEVEL_TITLES[0];

        BIBLIO_LEVEL_TITLES.forEach(item => {
            if (level >= item.minLevel && item.weight >= winner.weight) {
                winner = item;
            }
        });

        achievementList.forEach(item => {
            if (!item.completed) return;
            const title = item.unlocks?.title;
            const weight = Number(item.unlocks?.titleWeight) || 0;
            if (title && weight >= winner.weight) {
                winner = { title, weight };
            }
        });

        return winner?.title || 'Curioso del Acervo';
    }

    function resolveAchievementPerks(achievementList = []) {
        return achievementList.reduce((acc, item) => {
            if (!item.completed || !item.unlocks?.perks) return acc;
            return mergeBiblioPerks(acc, item.unlocks.perks);
        }, { ...DEFAULT_BIBLIO_PERKS });
    }

    function sortAchievementsForUi(list = []) {
        return list.slice().sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            if (a.completed && b.completed) {
                return (b.completedAtMs || 0) - (a.completedAtMs || 0);
            }
            if ((b.progressPct || 0) !== (a.progressPct || 0)) return (b.progressPct || 0) - (a.progressPct || 0);
            return (b.xpReward || 0) - (a.xpReward || 0);
        });
    }

    function buildAchievementSummary(achievementList = [], xp = 0) {
        const completedCount = achievementList.filter(item => item.completed).length;
        const totalCount = achievementList.length || 1;
        const nextAchievements = sortAchievementsForUi(achievementList.filter(item => !item.completed)).slice(0, 3);
        const completedXp = achievementList
            .filter(item => item.completed)
            .reduce((total, item) => total + (Number(item.xpReward) || 0), 0);

        return {
            completedCount,
            totalCount,
            pendingCount: Math.max(totalCount - completedCount, 0),
            completionPct: Math.round((completedCount / totalCount) * 100),
            completedXp,
            nextAchievements,
            xp
        };
    }

    function createServiceError(code, message, extra = {}) {
        const error = new Error(message);
        error.code = code;
        Object.assign(error, extra);
        return error;
    }

    function isPermissionDeniedError(error) {
        if (!error) return false;
        return error.code === 'permission-denied'
            || error.name === 'FirebaseError' && /permission-denied/i.test(error.message || '')
            || /permission-denied/i.test(error.message || '');
    }

    function hasUsableMatricula(value) {
        const normalized = norm(value);
        return !!normalized && normalized !== 'sin_matricula' && normalized !== 'n/a';
    }

    function isVisitClosed(data = {}) {
        const status = norm(data.status || '');
        return status === 'finalizada' || status === 'cancelada' || !!data.salida;
    }

    function getVisitStartMs(data = {}) {
        return Number(data.createdAtMs) || toMillisSafe(data.fecha) || 0;
    }

    function getVisitAutoCloseMs(data = {}) {
        const explicitAutoClose = Number(data.autoCloseAtMs) || 0;
        if (explicitAutoClose > 0) return explicitAutoClose;

        const startMs = getVisitStartMs(data);
        return startMs > 0 ? startMs + ACTIVE_VISIT_AUTO_CLOSE_MS : 0;
    }

    function isVisitExpired(data = {}, nowMs = Date.now()) {
        if (isVisitClosed(data)) return false;
        const autoCloseMs = getVisitAutoCloseMs(data);
        return autoCloseMs > 0 && autoCloseMs <= nowMs;
    }

    function buildExpiredVisitUpdate(data = {}, nowMs = Date.now()) {
        const closeMs = getVisitAutoCloseMs(data) || nowMs;
        return {
            salida: firebase.firestore.Timestamp.fromMillis(closeMs),
            status: 'finalizada',
            autoClosed: true,
            autoClosedAtMs: nowMs,
            autoClosedReason: 'visit_timeout'
        };
    }

    function buildVisitLockKey({ uid = '', matricula = '' } = {}) {
        if (hasUsableMatricula(matricula)) {
            return `mat_${norm(matricula)}`;
        }
        if (uid && !String(uid).startsWith('unreg_')) {
            return `uid_${uid}`;
        }
        return null;
    }

    function buildVisitDuplicatePayload(id, data = {}, fallback = {}) {
        return {
            visitId: id || fallback.visitId || null,
            studentId: data.studentId || fallback.studentId || null,
            studentName: data.studentName || fallback.studentName || 'Visitante',
            matricula: data.matricula || fallback.matricula || 'S/N',
            motivo: data.motivo || fallback.motivo || 'Visita',
            visitorType: data.visitorType || fallback.visitorType || '',
            isUnregistered: data.isUnregistered === true || fallback.isUnregistered === true,
            createdAtMs: data.createdAtMs || toMillisSafe(data.fecha) || fallback.createdAtMs || Date.now(),
            lockKey: data.lockKey || fallback.lockKey || null
        };
    }

    function buildActiveVisitLockPayload(visitId, visitData, lockKey) {
        return {
            visitId,
            lockKey,
            studentId: visitData.studentId || null,
            studentName: visitData.studentName || 'Visitante',
            matricula: visitData.matricula || 'S/N',
            motivo: visitData.motivo || 'Visita',
            visitorType: visitData.visitorType || '',
            isUnregistered: visitData.isUnregistered === true,
            createdAtMs: visitData.createdAtMs || Date.now(),
            autoCloseAtMs: visitData.autoCloseAtMs || getVisitAutoCloseMs(visitData) || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    async function resolveExistingActiveVisit(ctx, transaction, lockKey, fallback = {}) {
        const lockRef = ctx.db.collection(ACTIVE_VISITS_COLL).doc(lockKey);
        const lockSnap = await transaction.get(lockRef);

        if (!lockSnap.exists) {
            return { lockRef, existingVisit: null };
        }

        const lockData = lockSnap.data() || {};
        const visitId = lockData.visitId || fallback.visitId || null;
        if (!visitId) {
            return {
                lockRef,
                existingVisit: buildVisitDuplicatePayload(null, {}, { ...fallback, ...lockData, lockKey })
            };
        }

        const visitRef = ctx.db.collection(VISITAS_COLL).doc(visitId);
        const visitSnap = await transaction.get(visitRef);

        const visitData = visitSnap.data() || {};
        if (!visitSnap.exists || isVisitClosed(visitData) || isVisitExpired(visitData)) {
            if (visitSnap.exists && isVisitExpired(visitData)) {
                transaction.update(visitRef, buildExpiredVisitUpdate(visitData));
            }
            transaction.delete(lockRef);
            return { lockRef, existingVisit: null };
        }

        return {
            lockRef,
            existingVisit: buildVisitDuplicatePayload(visitSnap.id, visitData, { ...fallback, ...lockData, lockKey })
        };
    }

    async function findRecentAnonymousDuplicate(ctx, data) {
        const signature = [
            norm(data.visitorType || ''),
            norm(data.motivo || ''),
            norm(data.gender || ''),
            String(Number(data.groupSize) || 1)
        ].join('|');

        const cutoff = Date.now() - ANON_DUPLICATE_WINDOW_MS;
        const snap = await ctx.db.collection(VISITAS_COLL)
            .where('createdAtMs', '>=', cutoff)
            .orderBy('createdAtMs', 'desc')
            .limit(5)
            .get();

        for (const doc of snap.docs) {
            const item = doc.data() || {};
            if (item.isUnregistered !== true) continue;
            if (hasUsableMatricula(item.matricula)) continue;

            const itemSignature = [
                norm(item.visitorType || ''),
                norm(item.motivo || ''),
                norm(item.gender || ''),
                String(Number(item.groupSize) || 1)
            ].join('|');

            if (itemSignature === signature) {
                return buildVisitDuplicatePayload(doc.id, item);
            }
        }

        return null;
    }

    async function findLegacyActiveVisit(ctx, { uid = '', matricula = '' } = {}) {
        const visitsMap = new Map();
        const queries = [];

        if (hasUsableMatricula(matricula)) {
            queries.push(ctx.db.collection(VISITAS_COLL).where('matricula', 'in', getCaseVariants(matricula)).get());
        }
        if (uid) {
            queries.push(ctx.db.collection(VISITAS_COLL).where('studentId', '==', uid).get());
        }

        if (queries.length === 0) return null;

        const snaps = await Promise.all(queries);
        snaps.forEach(snap => {
            snap.docs.forEach(doc => {
                if (visitsMap.has(doc.id)) return;
                const data = doc.data() || {};
                if (isVisitClosed(data)) return;
                if (isVisitExpired(data)) return;
                visitsMap.set(doc.id, buildVisitDuplicatePayload(doc.id, data));
            });
        });

        const visits = Array.from(visitsMap.values());
        visits.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        return visits[0] || null;
    }

    async function cleanupExpiredActiveVisits(ctx, { force = false } = {}) {
        const nowMs = Date.now();
        if (!force && _activeVisitCleanupPromise) {
            return _activeVisitCleanupPromise;
        }
        if (!force && (nowMs - _activeVisitCleanupTime) < ACTIVE_VISIT_CLEANUP_TTL) {
            return [];
        }

        _activeVisitCleanupPromise = (async () => {
            const snap = await ctx.db.collection(ACTIVE_VISITS_COLL)
                .where('autoCloseAtMs', '<=', nowMs)
                .limit(100)
                .get();

            if (snap.empty) {
                _activeVisitCleanupTime = Date.now();
                return [];
            }

            const batch = ctx.db.batch();
            const closedVisits = [];
            let hasWrites = false;

            snap.docs.forEach((doc) => {
                const data = doc.data() || {};
                if (!isVisitExpired(data, nowMs)) return;

                const visitId = String(data.visitId || '').trim();
                if (visitId) {
                    batch.update(ctx.db.collection(VISITAS_COLL).doc(visitId), buildExpiredVisitUpdate(data, nowMs));
                    hasWrites = true;
                    closedVisits.push({
                        id: visitId,
                        studentName: data.studentName || 'Visitante',
                        matricula: data.matricula || 'S/N'
                    });
                }

                batch.delete(doc.ref);
                hasWrites = true;
            });

            if (hasWrites) {
                await batch.commit();
                if (closedVisits.length > 0) {
                    console.log(`[BIBLIO] Visitas auto-cerradas: ${closedVisits.map((item) => `${item.studentName} (${item.matricula})`).join(', ')}`);
                }
            }

            _activeVisitCleanupTime = Date.now();
            return closedVisits;
        })();

        try {
            return await _activeVisitCleanupPromise;
        } finally {
            _activeVisitCleanupPromise = null;
        }
    }

    async function findBooksByAdquisicion(ctx, adq, limit = 5) {
        const variants = getCaseVariants(adq);
        if (variants.length === 0) return [];

        const snap = await ctx.db.collection(CAT_COLL)
            .where('adquisicion', 'in', variants)
            .limit(limit)
            .get();

        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async function resolveBookForAdminFlow(ctx, rawCode, allowSearchFallback = true) {
        const code = (rawCode || '').toString().trim();
        if (!code) return null;

        const directBook = await findBookByCode(ctx, code);
        if (directBook) return directBook;

        const bookByAdq = await getBookByAdquisicion(ctx, code);
        if (bookByAdq) return bookByAdq;

        if (!allowSearchFallback) return null;

        const searchResults = await searchCatalogo(ctx, code);
        return searchResults[0] || null;
    }

    async function ensureUniqueAdquisicion(ctx, adquisicion, excludeId = null) {
        const matches = await findBooksByAdquisicion(ctx, adquisicion, 10);
        const conflicts = matches.filter(book => book.id !== excludeId);

        if (conflicts.length > 0) {
            throw new Error(`Ya existe un libro con el No. de adquisicion ${adquisicion}.`);
        }
    }

    function normalizeInventoryQuantity(value) {
        const parsed = Math.floor(Number(value) || 0);
        return parsed > 0 ? parsed : 1;
    }

    function getInventoryMetaRef(ctx) {
        return ctx.db.collection(BIBLIO_CONFIG_COLL).doc(INVENTORY_META_DOC_ID);
    }

    function summarizeInventorySession(id, data = {}) {
        return {
            id,
            name: data.name || '',
            status: data.status || 'inactive',
            matchedItems: Number(data.matchedItems) || 0,
            missingItems: Number(data.missingItems) || 0,
            totalObserved: Number(data.totalObserved) || 0,
            startedAt: data.startedAt || null,
            pausedAt: data.pausedAt || null,
            finishedAt: data.finishedAt || null,
            updatedAt: data.updatedAt || null,
            startedBy: data.startedBy || '',
            updatedBy: data.updatedBy || '',
            notes: data.notes || '',
            lastEntry: data.lastEntry || null,
            summary: data.summary || null,
            catalogAdjustedAt: data.catalogAdjustedAt || null,
            catalogAdjustedBy: data.catalogAdjustedBy || '',
            catalogAdjustedAtMs: Number(data.catalogAdjustedAtMs) || 0
        };
    }

    function sumInventoryObserved(entries = []) {
        return (entries || []).reduce((total, entry) => total + (Number(entry?.totalObserved || entry?.cantidad || entry?.lastQuantity || 0) || 0), 0);
    }

    function buildInventorySessionSummary(session = {}, foundEntries = [], missingEntries = [], catalogSummary = null) {
        const systemTotal = Number(catalogSummary?.totalCopies) || 0;
        const registeredCatalog = sumInventoryObserved(foundEntries);
        const outsideCatalog = sumInventoryObserved(missingEntries);
        const totalCaptured = Number(session?.totalObserved) || (registeredCatalog + outsideCatalog);
        const estimatedMissing = Math.max(systemTotal - registeredCatalog, 0);
        const progress = systemTotal > 0
            ? Math.min(100, Math.max(0, Math.round((registeredCatalog / systemTotal) * 100)))
            : 0;

        return {
            systemTotal,
            registeredCatalog,
            outsideCatalog,
            totalCaptured,
            estimatedMissing,
            progress,
            matchedTitles: Array.isArray(foundEntries) ? foundEntries.length : 0,
            outsideTitles: Array.isArray(missingEntries) ? missingEntries.length : 0
        };
    }

    function getInventorySystemCopiesFromBook(book = {}) {
        const total = Number(book?.copiasTotales ?? book?.copiasDisponibles);
        return Number.isFinite(total) && total > 0 ? total : 1;
    }

    function buildInventoryGroupKey(book = {}) {
        const explicitKey = norm(book?.inventoryGroupKey || book?.groupKey || book?.obraKey);
        if (explicitKey) return explicitKey;

        const titleKey = book?.tituloSearch || norm(book?.titulo);
        const authorKey = book?.autorSearch || norm(book?.autor);
        const categoryKey = norm(book?.categoria);
        const classificationKey = norm(book?.clasificacion || book?.ubicacionCatalogo || book?.ubicacion);
        const yearKey = norm(getBookYear(book));
        const derivedKey = [titleKey, authorKey, categoryKey, classificationKey, yearKey]
            .filter(Boolean)
            .join('|');

        return derivedKey || `book:${String(book?.id || book?.adquisicion || '').trim()}`;
    }

    function sortInventoryEntriesByUpdatedAt(entries = []) {
        return [...entries].sort((left, right) => {
            const leftTime = toMillisSafe(left?.updatedAt) || Number(left?.updatedAtMs) || Number(left?.createdAtMs) || 0;
            const rightTime = toMillisSafe(right?.updatedAt) || Number(right?.updatedAtMs) || Number(right?.createdAtMs) || 0;
            return rightTime - leftTime;
        });
    }

    function buildInventoryMissingKey(value) {
        const normalized = norm(value || '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 120);
        return normalized || `sin-nombre-${Date.now()}`;
    }

    async function getInventorySessionDetails(ctx, sessionId, { includeLists = false } = {}) {
        const rawSessionId = String(sessionId || '').trim();
        if (!rawSessionId) return { session: null, foundEntries: [], missingEntries: [] };

        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(rawSessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            return { session: null, foundEntries: [], missingEntries: [] };
        }

        const session = summarizeInventorySession(sessionSnap.id, sessionSnap.data() || {});
        if (!includeLists) {
            return { session, foundEntries: [], missingEntries: [] };
        }

        const [foundSnap, missingSnap] = await Promise.all([
            sessionRef.collection(INVENTORY_FOUND_SUBCOLL).get(),
            sessionRef.collection(INVENTORY_MISSING_SUBCOLL).get()
        ]);

        const foundEntries = sortInventoryEntriesByUpdatedAt(
            foundSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        const missingEntries = sortInventoryEntriesByUpdatedAt(
            missingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );

        return { session, foundEntries, missingEntries };
    }

    async function getCurrentInventorySession(ctx, { includeLists = false } = {}) {
        const metaSnap = await getInventoryMetaRef(ctx).get();
        const sessionId = String(metaSnap.data()?.sessionId || '').trim();
        if (!sessionId) {
            return { session: null, foundEntries: [], missingEntries: [] };
        }

        const details = await getInventorySessionDetails(ctx, sessionId, { includeLists });
        if (!details.session || details.session.status === 'finished') {
            return { session: null, foundEntries: [], missingEntries: [] };
        }

        return details;
    }

    async function getLatestFinishedInventorySession(ctx, { includeLists = false } = {}) {
        const latestSnap = await ctx.db
            .collection(INVENTORY_COLL)
            .orderBy('finishedAtMs', 'desc')
            .limit(1)
            .get();

        if (latestSnap.empty) {
            return { session: null, foundEntries: [], missingEntries: [] };
        }

        const latestDoc = latestSnap.docs[0];
        return getInventorySessionDetails(ctx, latestDoc.id, { includeLists });
    }

    async function getInventoryClosurePreview(ctx, sessionId) {
        const details = await getInventorySessionDetails(ctx, sessionId, { includeLists: true });
        if (!details?.session) {
            return { session: null, summary: null, foundEntries: [], missingEntries: [] };
        }

        const catalogSummary = await getInventoryCatalogSummary(ctx);
        const summary = buildInventorySessionSummary(details.session, details.foundEntries, details.missingEntries, catalogSummary);
        return {
            session: details.session,
            summary,
            foundEntries: details.foundEntries,
            missingEntries: details.missingEntries
        };
    }

    async function applyFinishedInventoryToCatalog(ctx, sessionId) {
        const rawSessionId = String(sessionId || '').trim();
        if (!rawSessionId) throw new Error('No hay un inventario cerrado para ajustar.');

        const details = await getInventorySessionDetails(ctx, rawSessionId, { includeLists: true });
        if (!details?.session) throw new Error('La sesion de inventario no existe.');
        if (details.session.status !== 'finished') throw new Error('Primero cierra oficialmente el inventario.');

        const foundEntries = Array.isArray(details.foundEntries) ? details.foundEntries : [];
        const allBooks = await _loadCatalogCache(ctx);
        const groups = new Map();
        const foundByGroup = new Map();

        foundEntries.forEach((entry) => {
            const groupKey = String(entry?.groupKey || '').trim();
            if (groupKey) {
                foundByGroup.set(groupKey, {
                    totalObserved: Number(entry?.totalObserved) || 0,
                    observedAcquisitions: Array.isArray(entry?.observedAcquisitions)
                        ? entry.observedAcquisitions.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)
                        : []
                });
            }
        });

        allBooks.forEach((book) => {
            const groupKey = buildInventoryGroupKey(book);
            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey).push(book);
        });

        const actorId = ctx?.auth?.currentUser?.uid || '';
        const nowMs = Date.now();
        let adjustedGroups = 0;
        let activeCopies = 0;
        let inactiveCopies = 0;
        let forcedByLoans = 0;
        let batch = ctx.db.batch();
        let opCount = 0;
        const commitBatchIfNeeded = async (force = false) => {
            if (opCount >= 400 || (force && opCount > 0)) {
                await batch.commit();
                batch = ctx.db.batch();
                opCount = 0;
            }
        };

        for (const [groupKey, members] of groups.entries()) {
            const foundMeta = foundByGroup.get(groupKey) || { totalObserved: 0, observedAcquisitions: [] };
            const observedOrder = new Map(
                (foundMeta.observedAcquisitions || []).map((value, index) => [String(value || '').trim().toUpperCase(), index])
            );
            const sortedMembers = [...members].sort((left, right) => {
                const leftObservedIndex = observedOrder.has(String(left?.adquisicion || '').trim().toUpperCase())
                    ? observedOrder.get(String(left?.adquisicion || '').trim().toUpperCase())
                    : Number.MAX_SAFE_INTEGER;
                const rightObservedIndex = observedOrder.has(String(right?.adquisicion || '').trim().toUpperCase())
                    ? observedOrder.get(String(right?.adquisicion || '').trim().toUpperCase())
                    : Number.MAX_SAFE_INTEGER;
                if (leftObservedIndex !== rightObservedIndex) return leftObservedIndex - rightObservedIndex;
                const leftParent = left?.isCatalogCopy === true ? 1 : 0;
                const rightParent = right?.isCatalogCopy === true ? 1 : 0;
                if (leftParent !== rightParent) return leftParent - rightParent;
                return String(left?.adquisicion || left?.id || '').localeCompare(String(right?.adquisicion || right?.id || ''));
            });

            const targetCount = Math.max(0, Number(foundMeta.totalObserved) || 0);
            let remainingActive = targetCount;
            adjustedGroups += 1;

            for (const member of sortedMembers) {
                const activeLoans = await countActiveLoansForBook(ctx, member.id);
                const mustStayActive = activeLoans > 0;
                const shouldStayActive = mustStayActive || remainingActive > 0;

                if (remainingActive > 0) {
                    remainingActive -= 1;
                }

                if (mustStayActive && targetCount === 0) {
                    forcedByLoans += 1;
                }

                if (shouldStayActive) {
                    activeCopies += 1;
                } else {
                    inactiveCopies += 1;
                }

                batch.set(ctx.db.collection(CAT_COLL).doc(member.id), {
                    active: shouldStayActive,
                    inventoryGroupKey: groupKey,
                    copiasTotales: Math.max(1, activeLoans || 1),
                    copiasDisponibles: shouldStayActive ? Math.max(0, 1 - activeLoans) : 0,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                opCount += 1;
                await commitBatchIfNeeded();
            }
        }

        batch.set(ctx.db.collection(INVENTORY_COLL).doc(rawSessionId), {
            catalogAdjustedAt: firebase.firestore.FieldValue.serverTimestamp(),
            catalogAdjustedAtMs: nowMs,
            catalogAdjustedBy: actorId
        }, { merge: true });
        opCount += 1;
        await commitBatchIfNeeded(true);

        await markCatalogStructureChanged(ctx);

        return {
            session: {
                ...details.session,
                catalogAdjustedAtMs: nowMs,
                catalogAdjustedBy: actorId
            },
            adjustedGroups,
            activeCopies,
            inactiveCopies,
            forcedByLoans,
            summary: details.session.summary || buildInventorySessionSummary(details.session, details.foundEntries, details.missingEntries, await getInventoryCatalogSummary(ctx))
        };
    }

    async function searchCatalogoAdmin(ctx, term, limit = 10) {
        const rawTerm = (term || '').toString().trim();
        if (!rawTerm) return [];

        const normalizedTerm = norm(rawTerm);
        const results = [];
        const seen = new Set();

        const pushUnique = (items = []) => {
            items.forEach((item) => {
                if (!item?.id || seen.has(item.id)) return;
                seen.add(item.id);
                results.push(item);
            });
        };

        try {
            const exactDoc = await ctx.db.collection(CAT_COLL).doc(rawTerm).get();
            if (exactDoc.exists) {
                pushUnique([{ id: exactDoc.id, ...exactDoc.data() }]);
            }

            const byAcquisition = await findBooksByAdquisicion(ctx, rawTerm, limit);
            pushUnique(byAcquisition);

            if (normalizedTerm.length >= SEARCH_TEXT_MIN_CHARS) {
                const allBooks = await _loadCatalogCache(ctx);
                const words = normalizedTerm.split(/\s+/).filter((word) => word.length >= 2);

                const scored = allBooks
                    .map((book) => {
                        if (!book?.id || seen.has(book.id)) return null;

                        const tituloNorm = book.tituloSearch || norm(book.titulo);
                        const autorNorm = book.autorSearch || norm(book.autor);
                        const adquisicionNorm = norm(book.adquisicion);
                        let score = 0;

                        if (adquisicionNorm === normalizedTerm) score += 220;
                        else if (adquisicionNorm.includes(normalizedTerm)) score += 140;

                        if (tituloNorm.startsWith(normalizedTerm)) score += 120;
                        else if (tituloNorm.includes(normalizedTerm)) score += 70;

                        if (autorNorm.includes(normalizedTerm)) score += 45;

                        words.forEach((word) => {
                            if (tituloNorm.includes(word)) score += 15;
                            if (autorNorm.includes(word)) score += 8;
                        });

                        if (score <= 0) return null;
                        return { ...book, _score: score };
                    })
                    .filter(Boolean)
                    .sort((a, b) => {
                        if (b._score !== a._score) return b._score - a._score;
                        return norm(a.titulo).localeCompare(norm(b.titulo));
                    })
                    .slice(0, limit)
                    .map(({ _score, ...book }) => book);

                pushUnique(scored);
            }

            return results.slice(0, limit);
        } catch (error) {
            console.error('[BIBLIO] Error en busqueda admin:', error);
            return results.slice(0, limit);
        }
    }

    async function countActiveLoansForBook(ctx, bookId) {
        const snap = await ctx.db.collection(PRES_COLL)
            .where('libroId', '==', bookId)
            .get();

        return snap.docs.reduce((total, doc) => {
            const data = doc.data() || {};
            return total + (isLoanStillActive(data) ? 1 : 0);
        }, 0);
    }

    async function buildCatalogStockPayload(ctx, id, data) {
        const requestedTotal = Number(data.copiasTotales ?? data.copiasDisponibles);
        if (!Number.isFinite(requestedTotal) || requestedTotal < 1) {
            throw new Error("Las copias totales deben ser un número mayor o igual a 1.");
        }

        if (!id) {
            return {
                copiasTotales: requestedTotal,
                copiasDisponibles: requestedTotal
            };
        }

        const activeLoans = await countActiveLoansForBook(ctx, id);
        if (requestedTotal < activeLoans) {
            throw new Error(`No puedes dejar menos de ${activeLoans} copia(s) totales porque ya están prestadas.`);
        }

        return {
            copiasTotales: requestedTotal,
            copiasDisponibles: requestedTotal - activeLoans
        };
    }

    // Cálculo de fecha de devolución (Omitiendo Sábados y Domingos)
    // Cálculo de fecha de devolución (Regla Estricta: 1 día)
    // - Lun-Jue: Se entrega al día siguiente.
    // - Viernes: Se entrega el Lunes.
    // - Sab/Dom (Si aplica): Se entrega el Lunes.
    function recalcularFechaVencimientoPrestamo(loan) {
        const startDate = toDateSafe(loan?.fechaEntrega) || toDateSafe(loan?.fechaSolicitud) || new Date();
        let dueDate = calcularFechaVencimiento(startDate, loan);
        const extensions = Math.max(0, Number(loan?.extensiones) || 0);
        for (let index = 0; index < extensions; index += 1) {
            dueDate = addBusinessDays(dueDate, 1);
        }
        return dueDate;
    }

    function calcularFechaVencimiento(fechaInicio = new Date(), source = null) {
        const policy = getLoanPolicy(source);
        return addBusinessDays(fechaInicio, policy.durationDays);
    }

    function calcularFechaExpiracionRecoleccion(fechaInicio = new Date()) {
        return new Date(fechaInicio.getTime() + PICKUP_WINDOW_MS);
    }

    function puedeRecogerHoy(horaAprobacion) {
        // Regla:
        // - Aprobado < 12PM: Recoger HOY.
        // - Aprobado > 12PM: HOY o MAÑANA.
        const h = horaAprobacion.getHours();
        return h < 12; // true = solo hoy, false = hoy y mañana
    }

    // Calcular multa acumulada
    function calcularMulta(fechaVencimiento) {
        const lateInfo = getLateInfo(fechaVencimiento);
        if (lateInfo.loanPolicy) return lateInfo.fine;
        if (!fechaVencimiento?.toDate) return 0;
        const hoy = new Date();
        const venc = fechaVencimiento.toDate();
        if (hoy <= venc) return 0;

        const diffDias = countBusinessLateDays(venc, hoy);
        // Si hay diferencia positiva de días, cobramos.
        return diffDias > 0 ? diffDias * COSTO_MULTA_DIARIA : 0;
    }

    // --- MÉTODOS DE BÚSQUEDA AVANZADA (Matrícula/Email/Libro) ---

    async function findUserByQuery(ctx, query) {
        // query puede ser matricula (ej: 22380123) o correo (ej: hilda.19)
        if (!query) return null;
        const q = query.trim();
        const variants = getCaseVariants(q);

        try {
            // 1. Intentar buscar por Matrícula
            const snapMat = await ctx.db.collection(USERS_COLL)
                .where('matricula', 'in', variants)
                .limit(1)
                .get();

            if (!snapMat.empty) {
                return getPerfilBibliotecario(ctx, snapMat.docs[0].id);
            }

            // 2. Intentar buscar por correo (previo al @) o correo completo
            // Si el query no tiene @, asumimos que es el prefix y buscamos rango
            let snapEmail;
            if (q.includes('@')) {
                snapEmail = await ctx.db.collection(USERS_COLL)
                    .where('email', '==', q)
                    .limit(1)
                    .get();
            } else {
                snapEmail = await ctx.db.collection(USERS_COLL)
                    .where('email', '>=', q)
                    .where('email', '<=', q + '\uf8ff')
                    .limit(1) // Tomamos el primer match
                    .get();
            }

            if (!snapEmail.empty) {
                return getPerfilBibliotecario(ctx, snapEmail.docs[0].id);
            }

            // 3. Fallback: Intentar por UID directo (para escáneres viejos)
            const docRef = await ctx.db.collection(USERS_COLL).doc(q).get();
            if (docRef.exists) {
                return getPerfilBibliotecario(ctx, q);
            }

        } catch (e) {
            console.error("BiblioService.findUserByQuery error:", e);
        }
        return null; // No encontrado
    }

    async function findBookByCode(ctx, code) {
        try {
            const doc = await ctx.db.collection(CAT_COLL).doc(code).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (e) {
            console.error("Book not found", e);
            return null;
        }
    }

    // --- MÉTODOS PARA USUARIO ---

    // Cache local del catalogo para busqueda client-side
    let _catalogCache = null;
    let _catalogCacheTime = 0;
    let _catalogCacheVersion = '';
    let _inventoryLookupCache = null;
    let _inventoryLookupCacheTime = 0;
    let _catalogStateCache = null;
    let _catalogStateCacheTime = 0;
    const CACHE_TTL = LOCAL_CACHE_TTL;

    function getCatalogStateRef(ctx) {
        return ctx.db.collection(BIBLIO_CONFIG_COLL).doc(CATALOG_STATE_DOC_ID);
    }

    function normalizeCatalogState(data = {}) {
        const updatedAtMs = Number(data?.updatedAtMs) || 0;
        const versionTag = String(data?.versionTag || updatedAtMs || '').trim();
        return {
            versionTag,
            updatedAtMs,
            updatedBy: String(data?.updatedBy || '').trim()
        };
    }

    function readCatalogCacheFromStorage() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return { books: null, meta: null };
        }

        try {
            const rawBooks = window.localStorage.getItem(CATALOG_STORAGE_KEY);
            const rawMeta = window.localStorage.getItem(CATALOG_META_STORAGE_KEY);
            if (!rawBooks || !rawMeta) return { books: null, meta: null };

            const meta = JSON.parse(rawMeta);
            const schemaVersion = Number(meta?.schemaVersion ?? meta?.version ?? 0);
            if (schemaVersion !== CACHE_SCHEMA_VERSION) {
                return { books: null, meta: null };
            }

            const books = JSON.parse(rawBooks);
            if (!Array.isArray(books)) {
                return { books: null, meta: null };
            }

            return { books, meta };
        } catch (error) {
            console.warn('[BIBLIO] Error leyendo cache local del catálogo', error);
            return { books: null, meta: null };
        }
    }

    function persistCatalogCacheToStorage(books = [], meta = {}) {
        if (typeof window === 'undefined' || !window.localStorage) return;

        try {
            window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(Array.isArray(books) ? books : []));
            window.localStorage.setItem(CATALOG_META_STORAGE_KEY, JSON.stringify({
                schemaVersion: CACHE_SCHEMA_VERSION,
                version: CACHE_SCHEMA_VERSION,
                fetchedAtMs: Number(meta?.fetchedAtMs) || Date.now(),
                catalogVersion: String(meta?.catalogVersion || '').trim(),
                stateUpdatedAtMs: Number(meta?.stateUpdatedAtMs) || 0
            }));
        } catch (error) {
            console.warn('[BIBLIO] No se pudo guardar el catálogo en LocalStorage (posible exceso de cuota)', error);
        }
    }

    async function getCatalogStateSnapshot(ctx, { force = false } = {}) {
        const now = Date.now();
        if (!force && _catalogStateCache && (now - _catalogStateCacheTime) < CATALOG_STATE_CHECK_TTL) {
            return _catalogStateCache;
        }
        if (!ctx?.db) {
            return _catalogStateCache;
        }

        try {
            const snap = await getCatalogStateRef(ctx).get();
            _catalogStateCache = snap.exists ? normalizeCatalogState(snap.data() || {}) : null;
            _catalogStateCacheTime = now;
            return _catalogStateCache;
        } catch (error) {
            console.warn('[BIBLIO] No se pudo leer el estado del catálogo:', error);
            return _catalogStateCache;
        }
    }

    async function markCatalogStructureChanged(ctx) {
        invalidateCatalogCache();

        if (!ctx?.db) return null;

        const nowMs = Date.now();
        const payload = {
            versionTag: `${nowMs}:${Math.random().toString(36).slice(2, 8)}`,
            updatedAtMs: nowMs,
            updatedBy: ctx?.auth?.currentUser?.uid || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await getCatalogStateRef(ctx).set(payload, { merge: true });
            _catalogStateCache = normalizeCatalogState(payload);
            _catalogStateCacheTime = nowMs;
            return _catalogStateCache;
        } catch (error) {
            console.warn('[BIBLIO] No se pudo actualizar la versión del catálogo:', error);
            return _catalogStateCache;
        }
    }

    async function _loadCatalogCache(ctx) {
        const now = Date.now();
        if (_catalogCache && (now - _catalogCacheTime) < CACHE_TTL) return _catalogCache;

        const storageSnapshot = readCatalogCacheFromStorage();
        if (!_catalogCache && Array.isArray(storageSnapshot.books) && storageSnapshot.books.length > 0) {
            _catalogCache = storageSnapshot.books;
            _catalogCacheVersion = String(storageSnapshot.meta?.catalogVersion || '').trim();
        }

        const cachedBooks = Array.isArray(_catalogCache) ? _catalogCache : [];
        const cachedMeta = storageSnapshot.meta || {};
        const cachedVersion = String(_catalogCacheVersion || cachedMeta?.catalogVersion || '').trim();
        const cachedFetchedAt = Number(cachedMeta?.fetchedAtMs || 0);
        const hasCachedCatalog = cachedBooks.length > 0;
        const serverState = await getCatalogStateSnapshot(ctx, { force: !hasCachedCatalog });

        if (hasCachedCatalog) {
            const cacheIsFreshEnough = cachedFetchedAt > 0 && (now - cachedFetchedAt) < CATALOG_CACHE_MAX_AGE;
            const serverVersion = String(serverState?.versionTag || '').trim();

            if (serverVersion && cachedVersion && cachedVersion === serverVersion) {
                _catalogCacheTime = now;
                return cachedBooks;
            }

            if (!serverVersion && cacheIsFreshEnough) {
                _catalogCacheTime = now;
                return cachedBooks;
            }
        }

        console.log('[BIBLIO] Descargando catálogo completo de Firebase (reads: N)...');
        const snap = await ctx.db.collection(CAT_COLL).get();

        _catalogCache = snap.docs.map((d) => {
            const data = d.data();
            // Retornar solo lo vital para búsqueda para no saturar LocalStorage (límite de 5MB)
            return {
                id: d.id,
                titulo: data.titulo,
                autor: data.autor,
                adquisicion: data.adquisicion,
                inventoryGroupKey: data.inventoryGroupKey || '',
                catalogParentId: data.catalogParentId || '',
                isCatalogCopy: data.isCatalogCopy === true,
                copiasDisponibles: data.copiasDisponibles,
                copiasTotales: data.copiasTotales,
                active: data.active,
                categoria: data.categoria || '',
                clasificacion: data.clasificacion || '',
                anio: getBookYear(data),
                tituloSearch: data.tituloSearch || '',
                autorSearch: data.autorSearch || ''
            };
        });
        _catalogCacheVersion = String(serverState?.versionTag || `snapshot:${now}`).trim();
        _catalogCacheTime = now;

        persistCatalogCacheToStorage(_catalogCache, {
            fetchedAtMs: now,
            catalogVersion: _catalogCacheVersion,
            stateUpdatedAtMs: Number(serverState?.updatedAtMs) || 0
        });

        return _catalogCache;
    }

    function buildInventoryLookupCache(books = []) {
        const groups = new Map();

        books
            .filter((book) => book?.id && book.active !== false)
            .forEach((book) => {
                const groupKey = buildInventoryGroupKey(book);
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, []);
                }
                groups.get(groupKey).push(book);
            });

        const byDocId = new Map();
        const byAcquisition = new Map();
        const groupedBooks = [];
        let totalCopies = 0;

        groups.forEach((members, groupKey) => {
            const sortedMembers = [...members].sort((left, right) => {
                const leftKey = norm(left?.adquisicion || left?.id);
                const rightKey = norm(right?.adquisicion || right?.id);
                return leftKey.localeCompare(rightKey);
            });
            const representative = sortedMembers[0] || {};
            const systemTotal = sortedMembers.reduce((sum, member) => sum + getInventorySystemCopiesFromBook(member), 0);
            const availableTotal = sortedMembers.reduce((sum, member) => {
                const available = Number(member?.copiasDisponibles);
                return sum + (Number.isFinite(available) && available > 0 ? available : 0);
            }, 0);
            const aggregated = {
                id: representative.id,
                representativeId: representative.id,
                groupKey,
                titulo: representative.titulo || 'Sin titulo',
                autor: representative.autor || '',
                categoria: representative.categoria || '',
                clasificacion: representative.clasificacion || '',
                anio: getBookYear(representative),
                adquisicion: representative.adquisicion || '',
                systemTotal,
                availableTotal,
                groupSize: sortedMembers.length,
                memberIds: sortedMembers.map((member) => member.id).filter(Boolean),
                relatedAdquisiciones: sortedMembers
                    .map((member) => String(member.adquisicion || '').trim())
                    .filter(Boolean)
            };

            totalCopies += systemTotal;
            groupedBooks.push(aggregated);

            sortedMembers.forEach((member) => {
                byDocId.set(member.id, aggregated);
                getCaseVariants(member.adquisicion).forEach((variant) => {
                    byAcquisition.set(variant, aggregated);
                });
            });
        });

        return {
            byDocId,
            byAcquisition,
            groupedBooks,
            summary: {
                totalTitles: groupedBooks.length,
                totalCopies
            }
        };
    }

    async function getInventoryLookupCache(ctx) {
        const now = Date.now();
        if (_inventoryLookupCache && (now - _inventoryLookupCacheTime) < CACHE_TTL) {
            return _inventoryLookupCache;
        }

        const books = await _loadCatalogCache(ctx);
        _inventoryLookupCache = buildInventoryLookupCache(books);
        _inventoryLookupCacheTime = now;
        return _inventoryLookupCache;
    }

    async function preloadInventoryLookup(ctx) {
        await getInventoryLookupCache(ctx);
        return true;
    }

    async function getInventoryCatalogSummary(ctx) {
        const lookup = await getInventoryLookupCache(ctx);
        return { ...(lookup?.summary || { totalTitles: 0, totalCopies: 0 }) };
    }

    async function findInventoryBookByCode(ctx, { code, sessionId = '' } = {}) {
        const rawCode = String(code || '').trim();
        if (!rawCode) return null;

        const lookup = await getInventoryLookupCache(ctx);
        let match = lookup.byDocId.get(rawCode) || null;

        if (!match) {
            for (const variant of getCaseVariants(rawCode)) {
                match = lookup.byAcquisition.get(variant) || null;
                if (match) break;
            }
        }

        if (!match) return null;

        const result = {
            ...match,
            matchedAcquisition: rawCode,
            registeredObserved: 0
        };

        const rawSessionId = String(sessionId || '').trim();
        if (!rawSessionId) return result;

        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(rawSessionId);
        const directSnap = await sessionRef.collection(INVENTORY_FOUND_SUBCOLL).doc(match.id).get();
        if (directSnap.exists) {
            result.registeredObserved = Number(directSnap.data()?.totalObserved) || 0;
            return result;
        }

        if (!match.groupKey) return result;

        const groupedSnap = await sessionRef.collection(INVENTORY_FOUND_SUBCOLL)
            .where('groupKey', '==', match.groupKey)
            .limit(1)
            .get();

        if (!groupedSnap.empty) {
            result.registeredObserved = Number(groupedSnap.docs[0].data()?.totalObserved) || 0;
        }

        return result;
    }

    function invalidateCatalogCache() {
        _catalogCache = null;
        _catalogCacheTime = 0;
        _catalogCacheVersion = '';
        _inventoryLookupCache = null;
        _inventoryLookupCacheTime = 0;
        try {
            localStorage.removeItem(CATALOG_META_STORAGE_KEY);
            localStorage.removeItem(CATALOG_STORAGE_KEY);
        } catch (e) {
            console.warn('[BIBLIO] No se pudo invalidar cachÃ© local del catÃ¡logo', e);
        }
    }

    async function searchCatalogo(ctx, term) {
        const rawTerm = (term || '').toString().trim();
        if (!rawTerm) return [];
        const t = norm(rawTerm);

        try {
            // 1. Direct ID Search (Best for barcodes/ids)
            const idRef = ctx.db.collection(CAT_COLL).doc(rawTerm);
            const idSnap = await idRef.get();
            if (idSnap.exists && idSnap.data().active) {
                return [{ id: idSnap.id, ...idSnap.data() }];
            }

            // 2. Search by acquisition number
            const acqBooks = (await findBooksByAdquisicion(ctx, rawTerm, 5))
                .filter(book => book.active !== false);

            if (acqBooks.length > 0) {
                return acqBooks;
            }

            if (t.length < SEARCH_TEXT_MIN_CHARS) return [];

            // 3. Busqueda por titulo/autor usando cache local
            // Firestore no soporta busqueda "contains" - usamos cache client-side
            const allBooks = (await _loadCatalogCache(ctx))
                .filter(book => book.active !== false);
            const words = t.split(/\s+/).filter(w => w.length >= 2);

            const scored = allBooks
                .map(book => {
                    // Usar campos pre-indexados si existen, sino normalizar
                    const tNorm = book.tituloSearch || norm(book.titulo);
                    const aNorm = book.autorSearch || norm(book.autor);
                    let score = 0;

                    // Match exacto al inicio del titulo (mejor resultado)
                    if (tNorm.startsWith(t)) score += 100;
                    // Titulo contiene el termino completo
                    else if (tNorm.includes(t)) score += 50;
                    // Autor contiene el termino
                    if (aNorm.includes(t)) score += 30;

                    // Match por palabras individuales
                    words.forEach(w => {
                        if (tNorm.includes(w)) score += 10;
                        if (aNorm.includes(w)) score += 5;
                    });

                    return { ...book, _score: score };
                })
                .filter(b => b._score > 0)
                .sort((a, b) => {
                    if (b._score !== a._score) return b._score - a._score;
                    if ((b.copiasDisponibles || 0) !== (a.copiasDisponibles || 0)) {
                        return (b.copiasDisponibles || 0) - (a.copiasDisponibles || 0);
                    }
                    return norm(a.titulo).localeCompare(norm(b.titulo));
                })
                .slice(0, 15)
                .map(({ _score, ...clean }) => clean);

            return scored;
        } catch (e) {
            console.error("Error en busqueda:", e);
            return [];
        }
    }

    // [NEW] Obtener el último libro agregado manualmente
    async function getLastAddedBook(ctx) {
        try {
            const snap = await ctx.db.collection(CAT_COLL)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            if (snap.empty) return null;
            return { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) {
            console.error("Error fetching last book:", e);
            return null;
        }
    }

    // [NEW] Buscar solo por Adquisicion
    async function getBookByAdquisicion(ctx, adq) {
        const matches = await findBooksByAdquisicion(ctx, adq, 2);
        if (matches.length === 0) return null;
        if (matches.length > 1) {
            throw new Error(`Hay multiples libros con el No. de adquisicion ${adq}. Corrige el catalogo primero.`);
        }
        return matches[0];
    }

    async function cleanupExpiredPendingLoans(ctx, uid = null) {
        const nowMs = Date.now();
        if (!uid) {
            if ((nowMs - _pendingLoanCleanupTime) < PENDING_LOAN_CLEANUP_TTL) return 0;
            _pendingLoanCleanupTime = nowMs;
        }
        let query = ctx.db.collection(PRES_COLL)
            .where('estado', 'in', ['pendiente', 'pendiente_entrega'])
            .where('fechaExpiracionRecoleccion', '<=', new Date())
            .limit(100);

        if (uid) {
            query = query.where('studentId', '==', uid);
        }

        let snap = null;
        try {
            snap = await query.get();
        } catch (error) {
            if (error?.code !== 'failed-precondition') throw error;
            console.warn('[BIBLIO] Faltó índice para limpieza optimizada; usando fallback temporal.', error);
            let fallbackQuery = ctx.db.collection(PRES_COLL)
                .where('estado', 'in', ['pendiente', 'pendiente_entrega']);
            if (uid) fallbackQuery = fallbackQuery.where('studentId', '==', uid);
            snap = await fallbackQuery.get();
        }
        if (snap.empty) return 0;

        const now = new Date();
        let cleanedCount = 0;

        for (const doc of snap.docs) {
            const loan = doc.data() || {};
            const pickupExpiry = toDateSafe(loan.fechaExpiracionRecoleccion);
            if (!pickupExpiry || pickupExpiry > now) continue;

            try {
                await cancelPendingLoan(ctx, doc.id, {
                    reason: 'No recogido a tiempo',
                    cancelledBy: 'sistema',
                    allowExpired: true
                });
                cleanedCount += 1;
            } catch (error) {
                console.warn('[BIBLIO] No se pudo liberar solicitud expirada:', doc.id, error);
            }
        }

        if (!uid) _pendingLoanCleanupTime = Date.now();
        return cleanedCount;
    }

    async function getPerfilBibliotecario(ctx, uid) {
        await ensureHolidayCalendarLoaded(ctx);
        const userDoc = await ctx.db.collection(USERS_COLL).doc(uid).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data() || {};
        const nombreCompleto = userData.displayName || (userData.nombre ? `${userData.nombre} ${userData.apellido || ''}` : 'Usuario');
        const matricula = userData.matricula || 'S/N';

        await cleanupExpiredPendingLoans(ctx, uid);

        const loansSnap = await ctx.db.collection(PRES_COLL)
            .where('studentId', '==', uid).get();

        let deudaTotal = 0;
        const solicitados = [];
        const recogidos = [];
        const adeudos = [];
        const historial = [];

        loansSnap.forEach(doc => {
            const p = { id: doc.id, ...doc.data() };

            if (p.estado === 'pendiente' || p.estado === 'pendiente_entrega') {
                solicitados.push(p);
            }
            else if (p.estado === 'entregado') {
                const lateInfo = getLateInfo(p);
                p.multaActual = lateInfo.fine;
                p.multaReferencia = lateInfo.rawFine;
                p.diasRetraso = lateInfo.daysLate;
                p.retrasoRegistrado = lateInfo.daysLate > 0;
                p.sinCobroRetraso = lateInfo.loanPolicy.lateFeeExempt;
                if (lateInfo.fine > 0) deudaTotal += lateInfo.fine;
                recogidos.push(p);
            }
            else if (p.estado === 'cobro_pendiente') {
                deudaTotal += (p.montoDeuda || 0);
                adeudos.push(p);
            }
            else if (p.estado === 'cancelado') {
                if (p.motivoCancelacion === 'No recogido a tiempo') {
                    p.estado_simulado = 'no_recogido';
                }
                historial.push(p);
            }
            else if (p.estado === 'finalizado' || p.estado === 'devuelto') {
                historial.push(p);
            }
        });

        const sortByNewest = (a, b) => {
            const aDate = toDateSafe(a.fechaSolicitud) || toDateSafe(a.fechaEntrega) || toDateSafe(a.fechaDevolucionReal) || toDateSafe(a.fechaCancelacion) || new Date(0);
            const bDate = toDateSafe(b.fechaSolicitud) || toDateSafe(b.fechaEntrega) || toDateSafe(b.fechaDevolucionReal) || toDateSafe(b.fechaCancelacion) || new Date(0);
            return bDate.getTime() - aDate.getTime();
        };

        solicitados.sort(sortByNewest);
        recogidos.sort(sortByNewest);
        adeudos.sort(sortByNewest);
        historial.sort(sortByNewest);

        // Actualizar flag de bloqueo
        // NUEVA REGLA: Bloqueo solo si tiene préstamos vencidos NO devueltos (status: 'entregado' && vencido).
        const hoy = new Date();
        const tieneRetrasosActivos = recogidos.some(p => Number(p.multaActual) > 0);
        const shouldBlock = tieneRetrasosActivos || adeudos.length > 0;
        const academicInfo = getAcademicInfo(userData);

        if (shouldBlock !== (userData.biblioBlocked === true)) {
            ctx.db.collection(USERS_COLL).doc(uid).update({ biblioBlocked: shouldBlock });
            userData.biblioBlocked = shouldBlock;
        }

        return {
            uid: uid,
            nombre: nombreCompleto,
            matricula: matricula,
            email: userData.email,
            emailInstitucional: userData.emailInstitucional || '',
            role: userData.role || '',
            tipoUsuario: userData.tipoUsuario || '',
            carrera: userData.carrera || userData.programa || '',
            area: userData.area || userData.areaAdscripcion || userData.adscripcion || '',
            department: userData.department || userData.departamento || '',
            jobTitle: userData.originalJobTitle || userData.jobTitle || userData.puesto || '',
            academicInfoKind: academicInfo.kind,
            academicInfoLabel: academicInfo.label,
            xp: userData.biblioXP || 0,
            nivel: userData.biblioNivel || 1,
            deudaTotal: deudaTotal,
            estaBloqueado: userData.biblioBlocked === true,
            tituloBiblioteca: userData.biblioTitle || 'Curioso del Acervo',
            perksBiblioteca: userData.biblioPerks || { ...DEFAULT_BIBLIO_PERKS },
            gamificationSummary: userData.biblioAchievementSummary || null,
            recentUnlocks: Array.isArray(userData.biblioRecentUnlocks) ? userData.biblioRecentUnlocks : [],
            achievementCounters: {
                reservationCount: Number(userData.biblioReservationCount) || 0,
                suggestionCount: Number(userData.biblioSuggestionCount) || 0
            },
            solicitados,
            recogidos,
            adeudos,
            historial
        };
    }

    // --- MÉTODOS PARA ADMIN ---

    async function collectGamificationStats(ctx, uid, perfil = null) {
        const baseProfile = perfil || await getPerfilBibliotecario(ctx, uid);
        if (!baseProfile) return null;

        const loanMap = new Map();
        [baseProfile.solicitados, baseProfile.recogidos, baseProfile.adeudos, baseProfile.historial].forEach(list => {
            (list || []).forEach(item => {
                if (item?.id && !loanMap.has(item.id)) loanMap.set(item.id, item);
            });
        });

        const allLoans = Array.from(loanMap.values());
        const [visitsSnap, reservationsSnap, suggestionsUidSnap, suggestionsLegacySnap] = await Promise.all([
            ctx.db.collection(VISITAS_COLL).where('studentId', '==', uid).get().catch(() => ({ docs: [] })),
            ctx.db.collection('biblio-reservas').where('studentId', '==', uid).get().catch(() => ({ docs: [] })),
            ctx.db.collection(SUG_COLL).where('uid', '==', uid).get().catch(() => ({ docs: [] })),
            ctx.db.collection(SUG_COLL).where('by', '==', uid).get().catch(() => ({ docs: [] }))
        ]);

        const visits = visitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const reservations = reservationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const suggestionsMap = new Map();
        [suggestionsUidSnap, suggestionsLegacySnap].forEach(snap => {
            (snap.docs || []).forEach(doc => {
                if (!suggestionsMap.has(doc.id)) {
                    suggestionsMap.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
        });
        const suggestions = Array.from(suggestionsMap.values());
        const pickedUpLoans = allLoans.filter(isPickedUpLoan);
        const returnedLoans = allLoans.filter(isReturnedLoan);
        const onTimeReturns = returnedLoans.filter(isOnTimeReturn);
        const earlyReturns = returnedLoans.filter(isEarlyReturn);
        const catalogMap = await loadCatalogBooksByIds(ctx, pickedUpLoans.map(loan => loan.libroId).filter(Boolean));
        const categorySet = new Set();
        const historicalReservationCount = Math.max(
            reservations.length,
            Number(baseProfile.achievementCounters?.reservationCount) || 0
        );
        const historicalSuggestionCount = Math.max(
            suggestions.length,
            Number(baseProfile.achievementCounters?.suggestionCount) || 0
        );

        pickedUpLoans.forEach(loan => {
            const category = norm(catalogMap.get(loan.libroId)?.categoria || '');
            if (category) categorySet.add(category);
        });

        return {
            profile: baseProfile,
            stats: {
                libraryLoaded: 1,
                loanRequests: allLoans.length,
                pickups: pickedUpLoans.length,
                completedReturns: returnedLoans.length,
                onTimeReturns: onTimeReturns.length,
                earlyReturns: earlyReturns.length,
                onTimeStreak: getOnTimeReturnStreak(allLoans),
                visits: visits.length,
                reservations: historicalReservationCount,
                activeReservations: reservations.filter(isReservationActive).length,
                suggestions: historicalSuggestionCount,
                extensionsUsed: allLoans.filter(loan => Number(loan.extensiones) > 0).length,
                uniqueCategories: categorySet.size,
                categoryLabels: Array.from(categorySet.values()),
                debtTotal: Number(baseProfile.deudaTotal) || 0,
                overdueActiveLoans: (baseProfile.recogidos || []).filter(loan => Number(loan.multaActual) > 0).length
            }
        };
    }

    function evaluateAchievementCatalog(stats, storedAchievements = {}, nowMs = Date.now()) {
        const previous = normalizeAchievementMap(storedAchievements);
        const rawList = BIBLIO_ACHIEVEMENTS.map(def => {
            const prev = previous[def.id] || {};
            const rawProgress = Math.max(0, Number(def.getProgress(stats) || 0));
            const completed = prev.completed === true || rawProgress >= def.target;
            const progress = completed ? Math.max(1, Number(def.target) || 1) : capAchievementProgress(rawProgress, def.target);
            const completedAtMs = prev.completedAtMs || (completed ? nowMs : null);

            return {
                id: def.id,
                category: def.category,
                tier: def.tier,
                icon: def.icon,
                title: def.title,
                description: def.description,
                target: def.target,
                progress,
                rawProgress,
                progressPct: completed ? 100 : Math.round((progress / Math.max(1, def.target)) * 100),
                xpReward: def.xpReward,
                rewardLabel: def.rewardLabel,
                unlocks: def.unlocks || null,
                completed,
                completedAtMs,
                newlyUnlocked: completed && !prev.completed
            };
        });

        const map = {};
        rawList.forEach(item => {
            map[item.id] = {
                id: item.id,
                category: item.category,
                tier: item.tier,
                icon: item.icon,
                title: item.title,
                description: item.description,
                target: item.target,
                progress: item.progress,
                rawProgress: item.rawProgress,
                progressPct: item.progressPct,
                xpReward: item.xpReward,
                rewardLabel: item.rewardLabel,
                unlocks: item.unlocks || null,
                completed: item.completed,
                completedAtMs: item.completedAtMs
            };
        });

        return {
            list: sortAchievementsForUi(rawList),
            map,
            newUnlocks: rawList.filter(item => item.newlyUnlocked),
            completedCount: rawList.filter(item => item.completed).length,
            totalCount: rawList.length
        };
    }

    async function syncGamification(ctx, uid, perfil = null) {
        const collected = await collectGamificationStats(ctx, uid, perfil);
        if (!collected?.profile) return null;

        const userRef = ctx.db.collection(USERS_COLL).doc(uid);
        const nowMs = Date.now();
        let response = null;

        await ctx.db.runTransaction(async tx => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) return;

            const userData = userSnap.data() || {};
            let storedAchievements = { ...normalizeAchievementMap(userData.biblioAchievements) };
            let currentXp = Math.max(0, Number(userData.biblioXP) || 0);
            let allNewUnlocks = [];
            let evaluation = null;
            let runtimeStats = null;

            for (let attempt = 0; attempt < 5; attempt += 1) {
                runtimeStats = {
                    ...collected.stats,
                    xp: currentXp,
                    level: computeBiblioLevel(currentXp)
                };
                evaluation = evaluateAchievementCatalog(runtimeStats, storedAchievements, nowMs);
                const freshUnlocks = evaluation.newUnlocks.filter(item => !storedAchievements[item.id]?.completed);
                if (freshUnlocks.length === 0) break;

                freshUnlocks.forEach(item => {
                    storedAchievements[item.id] = {
                        ...evaluation.map[item.id],
                        completed: true,
                        completedAtMs: item.completedAtMs || nowMs
                    };
                });
                allNewUnlocks = allNewUnlocks.concat(freshUnlocks);
                currentXp += freshUnlocks.reduce((total, item) => total + (Number(item.xpReward) || 0), 0);
            }

            runtimeStats = {
                ...collected.stats,
                xp: currentXp,
                level: computeBiblioLevel(currentXp)
            };
            evaluation = evaluateAchievementCatalog(runtimeStats, storedAchievements, nowMs);

            const achievementList = evaluation.list.map(item => ({
                ...item,
                newlyUnlocked: allNewUnlocks.some(unlock => unlock.id === item.id)
            }));
            const currentTitle = resolveAchievementTitle(runtimeStats.level, achievementList);
            const perks = resolveAchievementPerks(achievementList);
            const levelBounds = getBiblioLevelBounds(runtimeStats.level);
            const xpIntoLevel = Math.max(0, currentXp - levelBounds.startXp);
            const xpRequired = Math.max(1, levelBounds.nextXp - levelBounds.startXp);
            const summary = buildAchievementSummary(achievementList, currentXp);
            const existingRecent = Array.isArray(userData.biblioRecentUnlocks) ? userData.biblioRecentUnlocks.filter(Boolean) : [];
            const freshRecent = allNewUnlocks.map(item => ({
                id: item.id,
                title: item.title,
                icon: item.icon,
                xpReward: item.xpReward,
                rewardLabel: item.rewardLabel,
                completedAtMs: item.completedAtMs || nowMs
            }));
            const recentUnlocks = freshRecent
                .concat(existingRecent.filter(item => !freshRecent.some(fresh => fresh.id === item.id)))
                .sort((a, b) => (Number(b.completedAtMs) || 0) - (Number(a.completedAtMs) || 0))
                .slice(0, MAX_BIBLIO_RECENT_UNLOCKS);

            const updateData = {
                biblioXP: currentXp,
                biblioNivel: runtimeStats.level,
                biblioTitle: currentTitle,
                biblioPerks: perks,
                biblioAchievements: evaluation.map,
                biblioAchievementStats: collected.stats,
                biblioAchievementSummary: {
                    ...summary,
                    levelProgressPct: Math.round((xpIntoLevel / xpRequired) * 100)
                },
                biblioRecentUnlocks: recentUnlocks,
                biblioGamificationVersion: BIBLIO_GAMIFICATION_VERSION,
                biblioLastSyncAt: nowMs
            };

            tx.set(userRef, updateData, { merge: true });

            response = {
                version: BIBLIO_GAMIFICATION_VERSION,
                xp: currentXp,
                level: runtimeStats.level,
                title: currentTitle,
                perks,
                stats: runtimeStats,
                achievements: achievementList,
                summary: {
                    ...summary,
                    levelProgressPct: Math.round((xpIntoLevel / xpRequired) * 100),
                    xpIntoLevel,
                    xpRequired,
                    nextLevelXp: levelBounds.nextXp
                },
                newUnlocks: freshRecent,
                recentUnlocks,
                profile: {
                    ...collected.profile,
                    xp: currentXp,
                    nivel: runtimeStats.level,
                    tituloBiblioteca: currentTitle,
                    perksBiblioteca: perks,
                    gamificationSummary: updateData.biblioAchievementSummary,
                    recentUnlocks
                }
            };
        });

        return response;
    }

    async function registrarVisita(ctx, data) {
        // data: { matricula, uid (opt), motivo, tipoUsuario (opt), relatedUsers: [], isUnregistered (opt), visitorType (opt), gender (opt) }

        if (data.isUnregistered) {
            const tempUid = 'unreg_' + Date.now();
            const createdAtMs = Date.now();
            const lockKey = buildVisitLockKey({ uid: tempUid, matricula: data.matricula });
            const visitData = {
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                matricula: data.matricula || 'N/A',
                motivo: data.motivo || 'Registro Entrada',
                studentId: tempUid,
                studentName: 'Visitante (' + (data.visitorType || 'Externo') + ')',
                tipoUsuario: data.visitorType || 'visitante_externo',
                visitorType: data.visitorType || 'Otro',
                gender: data.gender || 'No especificado',
                isUnregistered: true,
                groupSize: Number(data.groupSize) || 1,
                groupNotes: data.groupNotes || '',
                createdAtMs,
                autoCloseAtMs: createdAtMs + ACTIVE_VISIT_AUTO_CLOSE_MS,
                lockKey,
                status: 'en_curso'
            };

            if (lockKey) {
                try {
                    await ctx.db.runTransaction(async transaction => {
                        const { lockRef, existingVisit } = await resolveExistingActiveVisit(ctx, transaction, lockKey, visitData);
                        if (existingVisit) {
                            throw createServiceError(
                                'VISITA_DUPLICADA_ACTIVA',
                                'Esta persona ya tiene una visita activa registrada.',
                                { existingVisit }
                            );
                        }

                        const visitRef = ctx.db.collection(VISITAS_COLL).doc();
                        transaction.set(visitRef, visitData);
                        transaction.set(lockRef, buildActiveVisitLockPayload(visitRef.id, visitData, lockKey));
                    });
                } catch (error) {
                    if (!isPermissionDeniedError(error)) throw error;
                    console.warn('[BIBLIO] Lock de visitas no disponible por permisos; usando validacion legacy.', error);

                    const existingVisit = await findLegacyActiveVisit(ctx, { uid: tempUid, matricula: visitData.matricula });
                    if (existingVisit) {
                        throw createServiceError(
                            'VISITA_DUPLICADA_ACTIVA',
                            'Esta persona ya tiene una visita activa registrada.',
                            { existingVisit }
                        );
                    }

                    await ctx.db.collection(VISITAS_COLL).add(visitData);
                }
            } else {
                if (!data.forceDuplicateAnon) {
                    const recentDuplicate = await findRecentAnonymousDuplicate(ctx, visitData);
                    if (recentDuplicate) {
                        throw createServiceError(
                            'VISITA_ANONIMA_RECIENTE',
                            'Hace unos segundos ya registraste una visita similar.',
                            { existingVisit: recentDuplicate }
                        );
                    }
                }

                await ctx.db.collection(VISITAS_COLL).add(visitData);
            }

            return { uid: tempUid, nombre: visitData.studentName, matricula: visitData.matricula, tipo: visitData.tipoUsuario };
        }

        let uid = data.uid;
        let matricula = data.matricula;
        let name = '';
        let tipo = data.tipoUsuario || 'estudiante';
        let relatedUsers = data.relatedUsers || []; // Array of {matricula, name?}

        // 1. VALIDATE MAIN USER
        if (!uid && !matricula) throw new Error("Faltan datos de identificación.");

        if (!uid) {
            const userSnap = await ctx.db.collection(USERS_COLL).where('matricula', 'in', getCaseVariants(matricula)).limit(1).get();
            if (userSnap.empty) {
                throw new Error(`Usuario con matrícula ${matricula} NO REGISTRADO.`);
            }
            const u = userSnap.docs[0].data();
            uid = userSnap.docs[0].id;
            name = u.displayName || u.nombre || 'Estudiante';
            tipo = u.role || 'estudiante';
        } else {
            const userDoc = await ctx.db.collection(USERS_COLL).doc(uid).get();
            if (!userDoc.exists) throw new Error("Usuario no encontrado en base de datos.");
            const u = userDoc.data();
            name = u.displayName || u.nombre || 'Estudiante';
            matricula = u.matricula || matricula;
        }

        // 2. VALIDATE TEAM MEMBERS (If any)
        const validRelated = [];
        if (relatedUsers.length > 0) {
            for (const m of relatedUsers) {
                // Check if m is just matricula or object
                const mat = (typeof m === 'object') ? m.matricula : m;
                if (!mat) continue;

                const snap = await ctx.db.collection(USERS_COLL).where('matricula', 'in', getCaseVariants(mat)).limit(1).get();
                if (snap.empty) {
                    throw new Error(`Integrante con matrícula ${mat} NO REGISTRADO.`);
                }
                const d = snap.docs[0].data();
                validRelated.push({
                    uid: snap.docs[0].id,
                    matricula: mat,
                    nombre: d.displayName || d.nombre || 'Estudiante'
                });
            }
        }

        const createdAtMs = Date.now();
        const lockKey = buildVisitLockKey({ uid, matricula });
        const visitData = {
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            matricula: matricula,
            motivo: data.motivo || 'Registro Entrada',
            studentId: uid,
            studentName: name,
            tipoUsuario: tipo,
            relatedUsers: validRelated,
            groupSize: Number(data.groupSize) || (validRelated.length > 0 ? validRelated.length + 1 : 1),
            groupNotes: data.groupNotes || '',
            createdAtMs,
            autoCloseAtMs: createdAtMs + ACTIVE_VISIT_AUTO_CLOSE_MS,
            lockKey,
            status: 'en_curso'
        };

        try {
            await ctx.db.runTransaction(async transaction => {
                const { lockRef, existingVisit } = await resolveExistingActiveVisit(ctx, transaction, lockKey, visitData);
                if (existingVisit) {
                    throw createServiceError(
                        'VISITA_DUPLICADA_ACTIVA',
                        'Este usuario ya tiene una visita activa registrada.',
                        { existingVisit }
                    );
                }

                const visitRef = ctx.db.collection(VISITAS_COLL).doc();
                transaction.set(visitRef, visitData);
                transaction.set(lockRef, buildActiveVisitLockPayload(visitRef.id, visitData, lockKey));
            });
        } catch (error) {
            if (!isPermissionDeniedError(error)) throw error;
            console.warn('[BIBLIO] Lock de visitas no disponible por permisos; usando validacion legacy.', error);

            const existingVisit = await findLegacyActiveVisit(ctx, { uid, matricula });
            if (existingVisit) {
                throw createServiceError(
                    'VISITA_DUPLICADA_ACTIVA',
                    'Este usuario ya tiene una visita activa registrada.',
                    { existingVisit }
                );
            }

            await ctx.db.collection(VISITAS_COLL).add(visitData);
        }

        await procesarRecompensa(ctx, uid, 'visita_presencial');
        return { uid, nombre: name, matricula, tipo };
    }

    // --- NUEVOS HELPERS PARA MODALES ADMIN ---

    async function getPrestamoInfo(ctx, matricula, bookAdquisicion) {
        await ensureHolidayCalendarLoaded(ctx);
        // 1. Buscar Usuario
        const userProfile = await findUserByQuery(ctx, matricula);
        if (!userProfile) throw new Error("Usuario no encontrado.");

        // 2. Buscar Libro (por ID adquisicion o ID doc)
        const book = await resolveBookForAdminFlow(ctx, bookAdquisicion, true);
        if (!book) throw new Error("Libro no encontrado.");

        // 3. Validaciones
        const tieneBloqueoActivo = userProfile.estaBloqueado;
        const sinStock = book.copiasDisponibles < 1;
        const prestamoDuplicado = [...userProfile.solicitados, ...userProfile.recogidos]
            .some(loan => isLoanStillActive(loan) && loan.libroId === book.id);

        // 4. Calcular Fecha Vencimiento simulada
        const borrowerPolicy = getBorrowerPolicy(userProfile);
        const loanPolicy = getLoanPolicy(book);
        const staffLoanPolicy = getLoanPolicy(book, { borrowerKind: 'staff', staffLoan: true });
        const returnDate = calcularFechaVencimiento(new Date(), book);

        return {
            user: userProfile,
            book: book,
            returnDate: returnDate,
            loanPolicy: loanPolicy,
            borrowerPolicy: borrowerPolicy,
            staffReturnDate: calcularFechaVencimiento(new Date(), { ...book, borrowerKind: 'staff', staffLoan: true, lateFeeExempt: true }),
            staffLoanPolicy: staffLoanPolicy,
            canLoan: !tieneBloqueoActivo && !sinStock && !prestamoDuplicado,
            reason: tieneBloqueoActivo
                ? "Usuario con préstamo vencido o bloqueo activo."
                : (sinStock
                    ? "Libro sin stock."
                    : (prestamoDuplicado ? "El usuario ya tiene este libro en un prestamo activo." : "OK"))
        };
    }

    async function getDevolucionInfo(ctx, matricula, bookAdquisicion) {
        await ensureHolidayCalendarLoaded(ctx);
        // 1. Buscar Usuario
        const userProfile = await findUserByQuery(ctx, matricula);
        if (!userProfile) throw new Error("Usuario no encontrado.");

        // 2. Buscar Préstamo Activo (Entregado) para este libro y usuario
        // El 'bookAdquisicion' puede ser el ID del libro o el codigo de adquisicion. 
        // Primero intentamos buscar el libro para tener su ID real si es un codigo.
        const activeLoans = userProfile.recogidos.filter(loan => loan.estado === 'entregado');
        const book = await resolveBookForAdminFlow(ctx, bookAdquisicion, false);

        let matchingLoans = [];
        if (book) {
            matchingLoans = activeLoans.filter(loan => loan.libroId === book.id);
        } else {
            const normalizedInput = norm(bookAdquisicion);
            matchingLoans = activeLoans.filter(loan => norm(loan.tituloLibro) === normalizedInput);
        }

        if (matchingLoans.length === 0) {
            throw new Error("No se encontro un prestamo activo exacto para este libro y usuario.");
        }

        if (matchingLoans.length > 1) {
            throw new Error("Hay multiples prestamos activos para este libro. Usa la lista del usuario para elegir el correcto.");
        }

        const loan = matchingLoans[0];

        // 3. Calcular Deuda Simulada
        const lateInfo = getLateInfo(loan);

        return {
            user: userProfile,
            loan: loan,
            borrowerPolicy: getBorrowerPolicy(userProfile),
            loanPolicy: lateInfo.loanPolicy,
            daysLate: lateInfo.daysLate,
            fine: lateInfo.fine,
            referenceFine: lateInfo.rawFine,
            totalDebt: userProfile.deudaTotal + lateInfo.fine
        };
    }

    function getHistoricalLateDays(loan) {
        const dueDate = toDateSafe(loan?.fechaVencimiento);
        const returnDate = toDateSafe(loan?.fechaDevolucionReal);
        if (!dueDate || !returnDate || returnDate <= dueDate) {
            return Number(loan?.diasRetraso) || 0;
        }

        return countBusinessLateDays(dueDate, returnDate);
    }

    function buildCondonationRecord(loan, options = {}) {
        const isActiveLoan = loan.estado === 'entregado';
        const lateInfo = getLateInfo(loan);
        const historicalLateDays = getHistoricalLateDays(loan);
        const daysLate = isActiveLoan ? lateInfo.daysLate : historicalLateDays;
        const currentAmount = isActiveLoan ? lateInfo.fine : (Number(loan.montoDeuda) || 0);
        const referenceAmount = Number(loan.multaOriginal)
            || Number(loan.multaReferencia)
            || currentAmount
            || (daysLate > 0 ? lateInfo.rawFine : 0);
        const hadDebt = currentAmount > 0 || referenceAmount > 0;
        const hadDelay = daysLate > 0 || loan.retrasoRegistrado === true || loan.sinCobroRetraso === true;
        const condonable = isActiveLoan
            ? (daysLate > 0 && lateInfo.loanPolicy.lateFeeExempt !== true && loan.perdonado !== true)
            : (currentAmount > 0 && loan.perdonado !== true);

        const academicSource = {
            ...options.profileData,
            tipoUsuario: options.tipoUsuario || options.profileData?.tipoUsuario || loan.tipoUsuario,
            role: options.role || options.profileData?.role || loan.role,
            matricula: options.studentMatricula || options.profileData?.matricula || loan.studentMatricula || loan.matricula,
            carrera: options.carrera || options.profileData?.carrera || loan.carrera,
            programa: options.programa || options.profileData?.programa || loan.programa,
            especialidad: options.especialidad || options.profileData?.especialidad || loan.especialidad,
            specialty: options.specialty || options.profileData?.specialty || loan.specialty,
            area: options.area || options.profileData?.area || loan.area,
            areaAdscripcion: options.areaAdscripcion || options.profileData?.areaAdscripcion || loan.areaAdscripcion,
            adscripcion: options.adscripcion || options.profileData?.adscripcion || loan.adscripcion,
            department: options.department || options.profileData?.department || loan.department,
            departamento: options.departamento || options.profileData?.departamento || loan.departamento,
            originalJobTitle: options.originalJobTitle || options.profileData?.originalJobTitle || loan.originalJobTitle,
            jobTitle: options.jobTitle || options.profileData?.jobTitle || loan.jobTitle,
            puesto: options.puesto || options.profileData?.puesto || loan.puesto
        };
        const academicInfo = getAcademicInfo(academicSource);

        return {
            ...loan,
            studentName: options.studentName || loan.studentName || loan._resolvedStudentName || 'Usuario',
            studentMatricula: options.studentMatricula || loan.studentMatricula || loan._resolvedStudentMatricula || loan.matricula || loan.studentId || 'S/N',
            academicInfoKind: academicInfo.kind,
            academicInfoLabel: academicInfo.label,
            diasRetraso: daysLate,
            montoDeuda: currentAmount,
            montoReferencia: referenceAmount,
            hadDebt,
            hadDelay,
            condonable,
            isActiveLoan
        };
    }

    async function recalculateActiveLoanDueDates(ctx) {
        if (!ctx?.db) return { updatedCount: 0 };

        const snap = await ctx.db.collection(PRES_COLL)
            .where('estado', '==', 'entregado')
            .get();

        if (snap.empty) {
            _recentOverdueCache = null;
            _recentOverdueCacheTime = 0;
            return { updatedCount: 0 };
        }

        let updatedCount = 0;
        let batch = ctx.db.batch();
        let ops = 0;

        for (const doc of snap.docs) {
            const loan = { id: doc.id, ...doc.data() };
            const recalculatedDueDate = recalcularFechaVencimientoPrestamo(loan);
            const currentDueMs = toMillisSafe(loan.fechaVencimiento) || 0;
            const nextDueMs = recalculatedDueDate.getTime();
            if (currentDueMs === nextDueMs) continue;

            batch.update(doc.ref, {
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(recalculatedDueDate)
            });
            updatedCount += 1;
            ops += 1;

            if (ops >= 400) {
                await batch.commit();
                batch = ctx.db.batch();
                ops = 0;
            }
        }

        if (ops > 0) {
            await batch.commit();
        }

        _recentOverdueCache = null;
        _recentOverdueCacheTime = 0;
        return { updatedCount };
    }

    async function getHolidayCalendarConfig(ctx, { force = false } = {}) {
        const snapshot = await ensureHolidayCalendarLoaded(ctx, { force });
        return {
            holidayDates: [...(snapshot?.holidayDates || [])],
            blockedDates: [...(snapshot?.blockedDates || [])],
            updatedAt: snapshot?.updatedAt || null,
            updatedBy: snapshot?.updatedBy || ''
        };
    }

    async function saveHolidayCalendarConfig(ctx, payload = {}) {
        const holidayDates = normalizeHolidayDateList(payload.holidayDates || payload.diasInhabiles || []);
        const blockedDates = normalizeHolidayDateList(payload.blockedDates || payload.periodDates || []);
        const docRef = ctx.db.collection(BIBLIO_CONFIG_COLL).doc(HOLIDAY_CALENDAR_DOC_ID);
        await docRef.set({
            holidayDates,
            blockedDates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: ctx.auth?.currentUser?.uid || ''
        }, { merge: true });

        setHolidayCalendarCache({
            holidayDates,
            blockedDates,
            updatedAtMs: Date.now(),
            updatedBy: ctx.auth?.currentUser?.uid || ''
        });

        const adjustment = await recalculateActiveLoanDueDates(ctx);
        return {
            holidayDates,
            blockedDates,
            adjustedLoans: adjustment.updatedCount || 0
        };
    }

    async function getRecentOverdueLoans(ctx, limit = 25) {
        await ensureHolidayCalendarLoaded(ctx);
        const now = Date.now();
        if (_recentOverdueCache && (now - _recentOverdueCacheTime) < RECENT_OVERDUE_CACHE_TTL) {
            return _recentOverdueCache.slice(0, limit);
        }

        const fetchSize = Math.max(limit * 4, 60);
        const overdueSnap = await ctx.db.collection(PRES_COLL)
            .where('fechaVencimiento', '<', new Date())
            .orderBy('fechaVencimiento', 'desc')
            .limit(fetchSize)
            .get();

        const loans = overdueSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const usersById = await loadVisitUsersByIds(ctx, loans.map((loan) => loan.studentId));

        const records = loans
            .filter((loan) => loan.estado === 'entregado')
            .map((loan) => {
                const user = usersById[loan.studentId] || {};
                return buildCondonationRecord(loan, {
                    studentName: user.displayName || user.nombre || loan.studentName || 'Usuario',
                    studentMatricula: user.matricula || loan.studentMatricula || loan.studentId || 'S/N',
                    profileData: user
                });
            })
            .filter((loan) => loan.diasRetraso > 0 || loan.montoDeuda > 0)
            .sort((a, b) => {
                const aDate = toMillisSafe(a.fechaVencimiento) || 0;
                const bDate = toMillisSafe(b.fechaVencimiento) || 0;
                return bDate - aDate;
            });

        _recentOverdueCache = records;
        _recentOverdueCacheTime = now;
        return records.slice(0, limit);
    }

    async function getCondonacionInfo(ctx, query) {
        await ensureHolidayCalendarLoaded(ctx);
        const userProfile = await findUserByQuery(ctx, query);
        if (!userProfile) throw new Error("Usuario no encontrado.");

        const records = [...(userProfile.recogidos || []), ...(userProfile.adeudos || []), ...(userProfile.historial || [])]
            .map((loan) => buildCondonationRecord(loan, {
                studentName: userProfile.nombre,
                studentMatricula: userProfile.matricula,
                profileData: userProfile
            }))
            .filter((loan) => loan.hadDebt || loan.hadDelay)
            .sort((a, b) => {
                const aDate = toMillisSafe(a.fechaDevolucionReal) || toMillisSafe(a.fechaVencimiento) || toMillisSafe(a.fechaPago) || toMillisSafe(a.fechaSolicitud) || 0;
                const bDate = toMillisSafe(b.fechaDevolucionReal) || toMillisSafe(b.fechaVencimiento) || toMillisSafe(b.fechaPago) || toMillisSafe(b.fechaSolicitud) || 0;
                return bDate - aDate;
            });

        return {
            user: userProfile,
            records
        };
    }

    async function condonarRegistroPrestamo(ctx, loanId, justification = '') {
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        const loanSnap = await loanRef.get();
        if (!loanSnap.exists) throw new Error("El registro de préstamo ya no existe.");

        const loan = loanSnap.data() || {};
        const montoDeuda = Number(loan.montoDeuda) || 0;
        if (montoDeuda <= 0) {
            throw new Error("Este préstamo ya no tiene deuda por condonar.");
        }

        const daysLate = getHistoricalLateDays(loan);
        const referenceAmount = Number(loan.multaOriginal) || Number(loan.multaReferencia) || montoDeuda;

        await loanRef.update({
            estado: 'finalizado',
            montoDeuda: 0,
            perdonado: true,
            motivoPerdon: justification,
            perdonadoPor: ctx.auth.currentUser.uid,
            multaOriginal: referenceAmount,
            multaReferencia: referenceAmount,
            retrasoRegistrado: daysLate > 0,
            sinCobroRetraso: daysLate > 0,
            diasRetraso: daysLate,
            fechaPago: firebase.firestore.FieldValue.delete()
        });

        if (loan.studentId) {
            await getPerfilBibliotecario(ctx, loan.studentId).catch(() => null);
            if (window.Notify) {
                Notify.send(loan.studentId, {
                    title: 'Registro condonado',
                    message: `Se condono la deuda de "${loan.tituloLibro || 'tu libro'}". El retraso permanece solo como referencia administrativa.`,
                    type: 'biblio'
                });
            }
        }

        return {
            ...loan,
            id: loanSnap.id,
            montoDeuda: 0,
            perdonado: true,
            motivoPerdon: justification,
            multaOriginal: referenceAmount,
            multaReferencia: referenceAmount,
            retrasoRegistrado: daysLate > 0,
            sinCobroRetraso: daysLate > 0,
            diasRetraso: daysLate
        };
    }

    async function condonarRegistroPrestamoV2(ctx, loanId, justification = '') {
        await ensureHolidayCalendarLoaded(ctx);
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        const loanSnap = await loanRef.get();
        if (!loanSnap.exists) throw new Error("El registro de préstamo ya no existe.");

        const loan = loanSnap.data() || {};
        const lateInfo = getLateInfo(loan);
        const isActiveLoan = loan.estado === 'entregado';
        const currentDebt = isActiveLoan ? lateInfo.fine : (Number(loan.montoDeuda) || 0);
        if (currentDebt <= 0 && lateInfo.daysLate <= 0) {
            throw new Error("Este préstamo ya no tiene retraso o deuda por condonar.");
        }

        const daysLate = isActiveLoan ? lateInfo.daysLate : getHistoricalLateDays(loan);
        const referenceAmount = Number(loan.multaOriginal) || Number(loan.multaReferencia) || (isActiveLoan ? lateInfo.rawFine : currentDebt);
        const updateData = {
            perdonado: true,
            motivoPerdon: justification,
            perdonadoPor: ctx.auth.currentUser.uid,
            multaOriginal: referenceAmount,
            multaReferencia: referenceAmount,
            retrasoRegistrado: daysLate > 0,
            sinCobroRetraso: daysLate > 0,
            diasRetraso: daysLate
        };

        if (isActiveLoan) {
            updateData.lateFeeExempt = true;
            updateData.tracksLateWithoutCharge = true;
            updateData.montoDeuda = 0;
        } else {
            updateData.estado = 'finalizado';
            updateData.montoDeuda = 0;
            updateData.fechaPago = firebase.firestore.FieldValue.delete();
        }

        await loanRef.update(updateData);
        _recentOverdueCache = null;
        _recentOverdueCacheTime = 0;

        if (loan.studentId) {
            await getPerfilBibliotecario(ctx, loan.studentId).catch(() => null);
            if (window.Notify) {
                Notify.send(loan.studentId, {
                    title: 'Registro condonado',
                    message: `Se condono la deuda de "${loan.tituloLibro || 'tu libro'}". El retraso permanece solo como referencia administrativa.`,
                    type: 'biblio'
                });
            }
        }

        return {
            ...loan,
            id: loanSnap.id,
            estado: isActiveLoan ? loan.estado : 'finalizado',
            montoDeuda: 0,
            perdonado: true,
            motivoPerdon: justification,
            multaOriginal: referenceAmount,
            multaReferencia: referenceAmount,
            retrasoRegistrado: daysLate > 0,
            sinCobroRetraso: daysLate > 0,
            diasRetraso: daysLate,
            lateFeeExempt: isActiveLoan ? true : loan.lateFeeExempt,
            tracksLateWithoutCharge: isActiveLoan ? true : loan.tracksLateWithoutCharge
        };
    }

    async function registrarVisitaGrupo(ctx, listaMatriculas, motivo = 'Visita Grupal (Equipo)') {
        const unicos = [...new Set(listaMatriculas)]; // Eliminar duplicados

        // [FIX] Validar TODOS antes de escribir nada
        const validUsers = [];
        for (const mat of unicos) {
            const m = (mat || '').trim();
            if (!m || m.length < 3) continue;

            const snap = await ctx.db.collection(USERS_COLL).where('matricula', 'in', getCaseVariants(m)).limit(1).get();
            if (snap.empty) {
                throw new Error(`El integrante con matrícula ${m} NO está registrado.`);
            }

            const d = snap.docs[0].data();
            validUsers.push({
                uid: snap.docs[0].id,
                name: d.displayName || d.nombre || 'Estudiante',
                matricula: m,
                tipo: d.role || 'estudiante'
            });
        }

        const createdAtMs = Date.now();

        try {
            await ctx.db.runTransaction(async transaction => {
                const pendingWrites = [];

                for (const u of validUsers) {
                    const lockKey = buildVisitLockKey({ uid: u.uid, matricula: u.matricula });
                    const visitData = {
                        studentId: u.uid,
                        studentName: u.name,
                        matricula: u.matricula,
                        tipoUsuario: u.tipo,
                        fecha: firebase.firestore.FieldValue.serverTimestamp(),
                        motivo,
                        groupSize: validUsers.length,
                        createdAtMs,
                        autoCloseAtMs: createdAtMs + ACTIVE_VISIT_AUTO_CLOSE_MS,
                        lockKey,
                        status: 'en_curso'
                    };

                    const { lockRef, existingVisit } = await resolveExistingActiveVisit(ctx, transaction, lockKey, visitData);
                    if (existingVisit) {
                        throw createServiceError(
                            'VISITA_DUPLICADA_ACTIVA',
                            `${u.name} ya tiene una visita activa registrada.`,
                            { existingVisit, duplicatedMatricula: u.matricula, duplicatedUid: u.uid }
                        );
                    }

                    const visitRef = ctx.db.collection(VISITAS_COLL).doc();
                    pendingWrites.push({ visitRef, lockRef, visitData, lockKey });
                }

                pendingWrites.forEach(({ visitRef, lockRef, visitData, lockKey }) => {
                    transaction.set(visitRef, visitData);
                    transaction.set(lockRef, buildActiveVisitLockPayload(visitRef.id, visitData, lockKey));
                });
            });
        } catch (error) {
            if (!isPermissionDeniedError(error)) throw error;
            console.warn('[BIBLIO] Lock de visitas no disponible por permisos; usando validacion legacy para grupo.', error);

            for (const u of validUsers) {
                const existingVisit = await findLegacyActiveVisit(ctx, { uid: u.uid, matricula: u.matricula });
                if (existingVisit) {
                    throw createServiceError(
                        'VISITA_DUPLICADA_ACTIVA',
                        `${u.name} ya tiene una visita activa registrada.`,
                        { existingVisit, duplicatedMatricula: u.matricula, duplicatedUid: u.uid }
                    );
                }
            }

            const batch = ctx.db.batch();
            validUsers.forEach(u => {
                const visitRef = ctx.db.collection(VISITAS_COLL).doc();
                batch.set(visitRef, {
                    studentId: u.uid,
                    studentName: u.name,
                    matricula: u.matricula,
                    tipoUsuario: u.tipo,
                    fecha: firebase.firestore.FieldValue.serverTimestamp(),
                    motivo,
                    groupSize: validUsers.length,
                    createdAtMs,
                    autoCloseAtMs: createdAtMs + ACTIVE_VISIT_AUTO_CLOSE_MS,
                    lockKey: buildVisitLockKey({ uid: u.uid, matricula: u.matricula }),
                    status: 'en_curso'
                });
            });
            await batch.commit();
        }

        // Post-commit XP
        for (const u of validUsers) {
            procesarRecompensa(ctx, u.uid, 'visita_presencial');
        }

        return validUsers;
    }

    async function finalizarVisita(ctx, visitId, { uid = null, matricula = '' } = {}) {
        const visitRef = ctx.db.collection(VISITAS_COLL).doc(visitId);

        try {
            await ctx.db.runTransaction(async transaction => {
                const visitSnap = await transaction.get(visitRef);
                if (!visitSnap.exists) {
                    throw new Error('La visita ya no existe.');
                }

                const visitData = visitSnap.data() || {};
                const lockKey = visitData.lockKey || buildVisitLockKey({
                    uid: visitData.studentId || uid,
                    matricula: visitData.matricula || matricula
                });

                transaction.update(visitRef, {
                    salida: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'finalizada'
                });

                if (!lockKey) return;

                const lockRef = ctx.db.collection(ACTIVE_VISITS_COLL).doc(lockKey);
                const lockSnap = await transaction.get(lockRef);
                if (!lockSnap.exists) return;

                const lockData = lockSnap.data() || {};
                if (!lockData.visitId || lockData.visitId === visitId) {
                    transaction.delete(lockRef);
                }
            });
        } catch (error) {
            if (!isPermissionDeniedError(error)) throw error;
            console.warn('[BIBLIO] No se pudo liberar lock de visita por permisos; cerrando visita sin lock.', error);
            await visitRef.update({
                salida: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'finalizada'
            });
        }
    }

    async function loadVisitUsersByIds(ctx, userIds = []) {
        const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
        if (!uniqueIds.length) return {};

        const usersById = {};
        const chunkSize = 10;
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
            const chunk = uniqueIds.slice(i, i + chunkSize);
            const snap = await ctx.db.collection(USERS_COLL)
                .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                .get();

            snap.forEach((doc) => {
                usersById[doc.id] = doc.data() || {};
            });
        }

        return usersById;
    }

    async function getVisitSummaryStats(ctx) {
        const now = Date.now();
        if (_visitSummaryCache && (now - _visitSummaryCacheTime) < VISIT_SUMMARY_CACHE_TTL) {
            return _visitSummaryCache;
        }

        const nowDate = new Date();
        const startOfDay = new Date(nowDate);
        startOfDay.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(startOfDay);
        const weekDay = startOfWeek.getDay();
        const diffToMonday = weekDay === 0 ? 6 : weekDay - 1;
        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

        const startOfYear = new Date(nowDate.getFullYear(), 0, 1);

        const visitsRef = ctx.db.collection(VISITAS_COLL);
        const [totalDia, totalSemana, totalAnio] = await Promise.all([
            getQueryCountSafe(visitsRef.where('fecha', '>=', startOfDay).where('fecha', '<', new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000)))),
            getQueryCountSafe(visitsRef.where('fecha', '>=', startOfWeek)),
            getQueryCountSafe(visitsRef.where('fecha', '>=', startOfYear))
        ]);

        const summary = {
            totalDia: Number.isFinite(totalDia) ? totalDia : 0,
            totalSemana: Number.isFinite(totalSemana) ? totalSemana : 0,
            totalAnio: Number.isFinite(totalAnio) ? totalAnio : 0
        };

        _visitSummaryCache = summary;
        _visitSummaryCacheTime = now;
        return summary;
    }

    async function getDashboardStats(ctx) {
        await ensureHolidayCalendarLoaded(ctx);
        await cleanupExpiredPendingLoans(ctx);
        await cleanupExpiredActiveVisits(ctx);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const visitasHoyRef = ctx.db.collection(VISITAS_COLL)
            .where('fecha', '>=', hoy)
            .where('fecha', '<', manana);
        const prestamosHoyRef = ctx.db.collection(PRES_COLL)
            .where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado'])
            .where('fechaSolicitud', '>=', hoy)
            .where('fechaSolicitud', '<', manana);

        // Consultas independientes (paralelizables en Promise.all)
        const activosRef = ctx.db.collection('biblio-activos').where('status', '==', 'ocupado');
        const activosCountPromise = activosRef.count
            ? activosRef.count().get().then((snap) => snap.data().count).catch(() => null)
            : Promise.resolve(null);
        const [visitasSnap, visitasHoyCount, prestamosHoyCount, prestamosSnap, devolucionesSnap, activosSnap, activosCount, retrasosSnap] = await Promise.all([
            visitasHoyRef.orderBy('fecha', 'desc').limit(3).get(),
            getQueryCountSafe(visitasHoyRef),
            getQueryCountSafe(prestamosHoyRef),
            ctx.db.collection(PRES_COLL)
                .where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado'])
                .orderBy('fechaSolicitud', 'desc')
                .limit(3)
                .get(),
            ctx.db.collection(PRES_COLL)
                .where('estado', 'in', ['finalizado', 'cobro_pendiente'])
                .orderBy('fechaDevolucionReal', 'desc')
                .limit(3)
                .get(),
            activosRef.limit(3).get(),
            activosCountPromise,
            ctx.db.collection(PRES_COLL).where('estado', '==', 'entregado').where('fechaVencimiento', '<', new Date()).limit(20).get()
        ]);

        const ultimasVisitas = visitasSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }));
        const ultimosPrestamos = prestamosSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }));
        const ultimasDevoluciones = devolucionesSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }));

        // Resolve user names and book acquisitions
        const userIds = new Set();
        const bookIds = new Set();
        [...ultimosPrestamos, ...ultimasDevoluciones].forEach(item => {
            if (item.studentId) userIds.add(item.studentId);
            if (item.libroId) bookIds.add(item.libroId);
        });

        const usersMap = {};
        if (userIds.size > 0) {
            const userChunk = Array.from(userIds).slice(0, 10);
            const userSnaps = await ctx.db.collection('usuarios').where(firebase.firestore.FieldPath.documentId(), 'in', userChunk).get();
            userSnaps.forEach(doc => usersMap[doc.id] = doc.data());
        }

        const booksMap = {};
        if (bookIds.size > 0) {
            const bookChunk = Array.from(bookIds).slice(0, 10);
            const bookSnaps = await ctx.db.collection(CAT_COLL).where(firebase.firestore.FieldPath.documentId(), 'in', bookChunk).get();
            bookSnaps.forEach(doc => booksMap[doc.id] = doc.data());
        }

        const enrich = (item) => {
            if (item.studentId && usersMap[item.studentId]) {
                const user = usersMap[item.studentId];
                const academicInfo = getAcademicInfo(user);
                item._resolvedStudentName = user.displayName || user.nombre || 'Estudiante';
                item._resolvedStudentMatricula = user.matricula || item.studentId;
                item._academicInfoKind = academicInfo.kind;
                item._academicInfoLabel = academicInfo.label;
            }
            if (item.libroId && booksMap[item.libroId]) {
                item.adquisicion = booksMap[item.libroId].adquisicion || booksMap[item.libroId].numeroAdquisicion || booksMap[item.libroId].isbn || '--';
            }
            return item;
        };

        return {
            visitasHoy: Number.isFinite(visitasHoyCount) ? visitasHoyCount : visitasSnap.size,
            prestamosHoy: Number.isFinite(prestamosHoyCount) ? prestamosHoyCount : 0,
            activosOcupados: Number.isFinite(activosCount) ? activosCount : activosSnap.size,
            retrasos: retrasosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            ultimasVisitas: ultimasVisitas,
            ultimosPrestamos: ultimosPrestamos.map(enrich),
            ultimasDevoluciones: ultimasDevoluciones.map(enrich),
            pcsActivas: activosSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }))
        };
    }

    // GESTION EQUIPOS/ACTIVOS
    async function saveAsset(ctx, data) {
        const col = ctx.db.collection('biblio-activos');
        const clean = {
            nombre: data.nombre,
            tipo: data.tipo,
            status: data.status || 'disponible',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (data.id) {
            return col.doc(data.id).update(clean);
        } else {
            return col.add({ ...clean, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }

    async function deleteAsset(ctx, id) {
        return ctx.db.collection('biblio-activos').doc(id).delete();
    }

    async function asignarActivoManual(ctx, uid, assetId) {
        await ctx.db.collection('biblio-activos').doc(assetId).update({
            status: 'ocupado',
            occupiedBy: uid,
            occupiedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        procesarRecompensa(ctx, uid, 'uso_activo');
    }

    async function liberarActivo(ctx, assetId) {
        await ctx.db.collection('biblio-activos').doc(assetId).update({
            status: 'disponible',
            occupiedBy: firebase.firestore.FieldValue.delete(),
            occupiedAt: firebase.firestore.FieldValue.delete()
        });
    }

    // GESTION CATALOGO
    async function updateLibro(ctx, id, data) {
        const ref = ctx.db.collection(CAT_COLL).doc(id);
        const adquisicion = (data.adquisicion || '').toString().trim().toUpperCase();
        await ensureUniqueAdquisicion(ctx, adquisicion, id);
        const stockPayload = await buildCatalogStockPayload(ctx, id, data);
        const cleanData = {
            ...data,
            adquisicion,
            ...stockPayload,
            tituloSearch: norm(data.titulo),
            autorSearch: norm(data.autor),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await ref.update(cleanData);
        await markCatalogStructureChanged(ctx);
        return true;
    }

    async function addLibro(ctx, data) {
        const adquisicion = (data.adquisicion || '').toString().trim().toUpperCase();
        await ensureUniqueAdquisicion(ctx, adquisicion);
        const stockPayload = await buildCatalogStockPayload(ctx, null, data);
        const cleanData = {
            ...data,
            adquisicion,
            active: true,
            tituloSearch: norm(data.titulo),
            autorSearch: norm(data.autor),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...stockPayload
        };
        const ref = await ctx.db.collection(CAT_COLL).add(cleanData);
        await markCatalogStructureChanged(ctx);
        return ref;
    }

    async function registerInventoryManualBook(ctx, data = {}) {
        const sessionId = String(data.sessionId || '').trim();
        const acquisition = String(data.acquisition || data.adquisicion || '').trim().toUpperCase();
        const title = String(data.title || data.titulo || '').trim();
        const author = String(data.author || data.autor || '').trim();
        const classification = String(data.classification || data.clasificacion || '').trim();

        if (!sessionId) throw new Error('No hay una sesion de inventario activa.');
        if (!acquisition) throw new Error('Falta el numero de adquisicion.');
        if (!title) throw new Error('Escribe el nombre del libro.');

        await ensureUniqueAdquisicion(ctx, acquisition);
        const sessionSnap = await ctx.db.collection(INVENTORY_COLL).doc(sessionId).get();
        if (!sessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');
        if ((sessionSnap.data()?.status || '') === 'finished') {
            throw new Error('La sesion ya fue finalizada. Inicia una nueva para continuar.');
        }

        const newBookRef = await addLibro(ctx, {
            adquisicion: acquisition,
            titulo: title,
            autor: author,
            clasificacion: classification,
            categoria: '',
            ubicacion: 'Estanteria',
            copiasTotales: 1,
            copiasDisponibles: 1
        });

        return {
            bookId: newBookRef.id,
            acquisition
        };
    }

    async function registerInventoryAssociatedCopy(ctx, data = {}) {
        const sessionId = String(data.sessionId || '').trim();
        const baseBookId = String(data.baseBookId || '').trim();
        const acquisition = String(data.acquisition || data.adquisicion || '').trim().toUpperCase();
        const quantity = normalizeInventoryQuantity(data.quantity);

        if (!sessionId) throw new Error('No hay una sesion de inventario activa.');
        if (!baseBookId) throw new Error('Selecciona el libro base para asociar la copia.');
        if (!acquisition) throw new Error('Ingresa el numero de adquisicion de la copia.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(sessionId);
        const baseBookRef = ctx.db.collection(CAT_COLL).doc(baseBookId);
        const variants = getCaseVariants(acquisition);
        const duplicateQuery = variants.length > 0
            ? ctx.db.collection(CAT_COLL).where('adquisicion', 'in', variants).limit(1)
            : null;
        const newBookRef = ctx.db.collection(CAT_COLL).doc();

        await ctx.db.runTransaction(async (transaction) => {
            const reads = [
                transaction.get(sessionRef),
                transaction.get(baseBookRef)
            ];
            if (duplicateQuery) {
                reads.push(transaction.get(duplicateQuery));
            }

            const [sessionSnap, baseBookSnap, duplicateSnap] = await Promise.all(reads);

            if (!sessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');
            if (!baseBookSnap.exists) throw new Error('El libro base ya no existe en catalogo.');
            if (duplicateSnap && !duplicateSnap.empty) {
                throw new Error(`Ya existe un libro con el No. de adquisicion ${acquisition}.`);
            }

            const sessionData = sessionSnap.data() || {};
            if (sessionData.status === 'finished') {
                throw new Error('La sesion ya fue finalizada. Inicia una nueva para continuar.');
            }

            const baseBookData = baseBookSnap.data() || {};
            const groupKey = buildInventoryGroupKey({ id: baseBookId, ...baseBookData });
            const existingGroupSnap = await transaction.get(
                sessionRef.collection(INVENTORY_FOUND_SUBCOLL).where('groupKey', '==', groupKey).limit(1)
            );
            const existingFoundDoc = existingGroupSnap && !existingGroupSnap.empty ? existingGroupSnap.docs[0] : null;
            const foundRef = existingFoundDoc
                ? sessionRef.collection(INVENTORY_FOUND_SUBCOLL).doc(existingFoundDoc.id)
                : sessionRef.collection(INVENTORY_FOUND_SUBCOLL).doc(baseBookId);
            const previousEntry = existingFoundDoc ? (existingFoundDoc.data() || {}) : null;
            const cleanData = {
                adquisicion: acquisition,
                titulo: baseBookData.titulo || 'Sin titulo',
                autor: baseBookData.autor || '',
                anio: getBookYear(baseBookData) || '',
                categoria: baseBookData.categoria || '',
                clasificacion: baseBookData.clasificacion || '',
                ubicacion: baseBookData.ubicacion || 'Estanteria',
                active: true,
                inventoryGroupKey: groupKey,
                catalogParentId: baseBookId,
                parentAdquisicion: baseBookData.adquisicion || '',
                isCatalogCopy: true,
                tituloSearch: norm(baseBookData.titulo),
                autorSearch: norm(baseBookData.autor),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                copiasTotales: 1,
                copiasDisponibles: 1
            };

            transaction.set(newBookRef, cleanData);
            const previousObservedAcquisitions = Array.isArray(previousEntry?.observedAcquisitions)
                ? previousEntry.observedAcquisitions
                : [];
            const nextObservedAcquisitions = [...new Set([
                ...previousObservedAcquisitions,
                baseBookData.adquisicion || '',
                acquisition
            ].map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))];
            transaction.set(foundRef, {
                bookId: previousEntry?.bookId || baseBookId,
                representativeId: previousEntry?.representativeId || baseBookId,
                groupKey,
                titulo: previousEntry?.titulo || cleanData.titulo,
                autor: previousEntry?.autor || cleanData.autor,
                adquisicion: previousEntry?.adquisicion || baseBookData.adquisicion || acquisition,
                catalogAdquisicion: previousEntry?.catalogAdquisicion || baseBookData.adquisicion || '',
                categoria: previousEntry?.categoria || cleanData.categoria,
                clasificacion: previousEntry?.clasificacion || cleanData.clasificacion,
                active: true,
                systemTotal: Math.max(Number(previousEntry?.systemTotal) || 0, 1),
                groupSize: Math.max(Number(previousEntry?.groupSize) || 0, 1),
                totalObserved: (Number(previousEntry?.totalObserved) || 0) + quantity,
                observedAcquisitions: nextObservedAcquisitions,
                lastQuantity: quantity,
                lastQuery: acquisition,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                ...(previousEntry ? {} : {
                    createdBy: actorId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAtMs: nowMs
                })
            }, { merge: true });

            transaction.set(sessionRef, {
                status: 'active',
                matchedItems: (Number(sessionData.matchedItems) || 0) + (previousEntry ? 0 : 1),
                totalObserved: (Number(sessionData.totalObserved) || 0) + quantity,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                lastEntry: {
                    type: 'catalogo',
                    bookId: previousEntry?.bookId || baseBookId,
                    titulo: cleanData.titulo,
                    adquisicion: acquisition,
                    cantidad: quantity,
                    systemTotal: Math.max(Number(previousEntry?.systemTotal) || 0, 1),
                    query: acquisition,
                    atMs: nowMs
                }
            }, { merge: true });
        });

        await getInventoryMetaRef(ctx).set({
            sessionId,
            status: 'active',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        await markCatalogStructureChanged(ctx);
        return {
            bookId: newBookRef.id,
            acquisition,
            baseBookId
        };
    }

    async function syncInventoryCopyAcquisitions(ctx, data = {}) {
        const baseBookId = String(data.baseBookId || '').trim();
        const acquisitions = Array.isArray(data.acquisitions) ? data.acquisitions : [];
        if (!baseBookId) throw new Error('Falta el libro base para asociar copias.');

        const normalizedAcquisitions = [...new Set(
            acquisitions
                .map((value) => String(value || '').trim().toUpperCase())
                .filter(Boolean)
        )];

        if (!normalizedAcquisitions.length) {
            return { created: 0, linked: 0, skipped: 0 };
        }

        const baseBookSnap = await ctx.db.collection(CAT_COLL).doc(baseBookId).get();
        if (!baseBookSnap.exists) throw new Error('El libro base ya no existe en catalogo.');

        const baseBookData = baseBookSnap.data() || {};
        const baseAcquisition = String(baseBookData.adquisicion || '').trim().toUpperCase();
        const groupKey = buildInventoryGroupKey({ id: baseBookId, ...baseBookData });
        const actorNow = firebase.firestore.FieldValue.serverTimestamp();

        let created = 0;
        let linked = 0;
        let skipped = 0;

        for (const acquisition of normalizedAcquisitions) {
            if (!acquisition || acquisition === baseAcquisition) {
                skipped += 1;
                continue;
            }

            const matches = await findBooksByAdquisicion(ctx, acquisition, 2);
            if (matches.length > 1) {
                throw new Error(`Hay multiples libros con el No. de adquisicion ${acquisition}.`);
            }

            if (matches.length === 1) {
                const existing = matches[0];
                if (existing.id === baseBookId) {
                    skipped += 1;
                    continue;
                }

                await ctx.db.collection(CAT_COLL).doc(existing.id).set({
                    inventoryGroupKey: groupKey,
                    catalogParentId: baseBookId,
                    parentAdquisicion: baseBookData.adquisicion || '',
                    isCatalogCopy: true,
                    updatedAt: actorNow
                }, { merge: true });
                linked += 1;
                continue;
            }

            await addLibro(ctx, {
                adquisicion: acquisition,
                titulo: baseBookData.titulo || 'Sin titulo',
                autor: baseBookData.autor || '',
                anio: getBookYear(baseBookData) || '',
                categoria: baseBookData.categoria || '',
                clasificacion: baseBookData.clasificacion || '',
                ubicacion: baseBookData.ubicacion || 'Estanteria',
                inventoryGroupKey: groupKey,
                catalogParentId: baseBookId,
                parentAdquisicion: baseBookData.adquisicion || '',
                isCatalogCopy: true,
                copiasTotales: 1,
                copiasDisponibles: 1
            });
            created += 1;
        }

        if (created > 0 || linked > 0) {
            await markCatalogStructureChanged(ctx);
        }
        return { created, linked, skipped };
    }

    async function toggleLibroStatus(ctx, id, isActive) {
        await ctx.db.collection(CAT_COLL).doc(id).update({ active: isActive });
        await markCatalogStructureChanged(ctx);
        return true;
    }

    async function startInventorySession(ctx, options = {}) {
        const current = await getCurrentInventorySession(ctx);
        if (current.session) return current;

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc();
        const name = String(options.name || '').trim() || `Inventario ${new Date(nowMs).toLocaleDateString('es-MX')}`;
        const batch = ctx.db.batch();
        const sessionData = {
            name,
            status: 'active',
            matchedItems: 0,
            missingItems: 0,
            totalObserved: 0,
            notes: String(options.notes || '').trim(),
            startedBy: actorId,
            updatedBy: actorId,
            lastEntry: null,
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            startedAtMs: nowMs,
            updatedAtMs: nowMs
        };

        batch.set(sessionRef, sessionData);

        batch.set(getInventoryMetaRef(ctx), {
            sessionId: sessionRef.id,
            status: 'active',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        await batch.commit();
        return {
            session: summarizeInventorySession(sessionRef.id, sessionData),
            foundEntries: [],
            missingEntries: []
        };
    }

    async function pauseInventorySession(ctx, sessionId) {
        const rawSessionId = String(sessionId || '').trim();
        if (!rawSessionId) throw new Error('No hay una sesion activa para pausar.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(rawSessionId);

        await sessionRef.set({
            status: 'paused',
            pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
            pausedAtMs: nowMs,
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        await getInventoryMetaRef(ctx).set({
            sessionId: rawSessionId,
            status: 'paused',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        return {
            session: summarizeInventorySession(rawSessionId, {
                status: 'paused',
                pausedAtMs: nowMs,
                updatedBy: actorId,
                updatedAtMs: nowMs
            }),
            foundEntries: [],
            missingEntries: []
        };
    }

    async function resumeInventorySession(ctx, sessionId) {
        const rawSessionId = String(sessionId || '').trim();
        if (!rawSessionId) throw new Error('No hay una sesion para reanudar.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(rawSessionId);

        await sessionRef.set({
            status: 'active',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        await getInventoryMetaRef(ctx).set({
            sessionId: rawSessionId,
            status: 'active',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        return {
            session: summarizeInventorySession(rawSessionId, {
                status: 'active',
                updatedBy: actorId,
                updatedAtMs: nowMs
            }),
            foundEntries: [],
            missingEntries: []
        };
    }

    async function registerInventoryMatch(ctx, data = {}) {
        const sessionId = String(data.sessionId || '').trim();
        const bookId = String(data.bookId || '').trim();
        const query = String(data.query || '').trim();
        const groupKey = String(data.groupKey || '').trim();
        const matchedAcquisition = String(data.matchedAcquisition || query || '').trim();
        const observedAcquisitionsInput = Array.isArray(data.observedAcquisitions)
            ? [...new Set(data.observedAcquisitions.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))]
            : [];
        const systemTotal = normalizeInventoryQuantity(data.systemTotal);
        const groupSize = normalizeInventoryQuantity(data.groupSize);
        const quantity = normalizeInventoryQuantity(data.quantity);

        if (!sessionId) throw new Error('No hay una sesion de inventario activa.');
        if (!bookId) throw new Error('Selecciona un libro del catalogo antes de registrar.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(sessionId);
        const foundRef = sessionRef.collection(INVENTORY_FOUND_SUBCOLL).doc(bookId);
        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);
        let resultSession = null;
        let resultEntry = null;

        await ctx.db.runTransaction(async (transaction) => {
            const [sessionSnap, foundSnap, bookSnap] = await Promise.all([
                transaction.get(sessionRef),
                transaction.get(foundRef),
                transaction.get(bookRef)
            ]);

            if (!sessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');
            if (!bookSnap.exists) throw new Error('El libro seleccionado ya no existe en catalogo.');

            const sessionData = sessionSnap.data() || {};
            if (sessionData.status === 'finished') {
                throw new Error('La sesion ya fue finalizada. Inicia una nueva para continuar.');
            }

            const previousEntry = foundSnap.exists ? (foundSnap.data() || {}) : null;
            const bookData = bookSnap.data() || {};
            const nextTotal = (Number(previousEntry?.totalObserved) || 0) + quantity;
            const resolvedGroupKey = groupKey || buildInventoryGroupKey({ id: bookId, ...bookData });
            const displayAdquisicion = matchedAcquisition || bookData.adquisicion || query;
            const previousObservedAcquisitions = Array.isArray(previousEntry?.observedAcquisitions)
                ? previousEntry.observedAcquisitions
                : [];
            const nextObservedAcquisitions = [...new Set([
                ...previousObservedAcquisitions,
                ...observedAcquisitionsInput,
                displayAdquisicion || '',
                bookData.adquisicion || ''
            ].map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))];
            const nextMatchedItems = (Number(sessionData.matchedItems) || 0) + (previousEntry ? 0 : 1);
            const nextSessionTotal = (Number(sessionData.totalObserved) || 0) + quantity;
            const nextLastEntry = {
                type: 'catalogo',
                bookId,
                titulo: bookData.titulo || 'Sin titulo',
                adquisicion: displayAdquisicion || '',
                cantidad: quantity,
                systemTotal,
                query,
                atMs: nowMs
            };

            transaction.set(foundRef, {
                bookId,
                representativeId: bookId,
                groupKey: resolvedGroupKey,
                titulo: bookData.titulo || 'Sin titulo',
                autor: bookData.autor || '',
                adquisicion: displayAdquisicion || '',
                catalogAdquisicion: bookData.adquisicion || '',
                categoria: bookData.categoria || '',
                clasificacion: bookData.clasificacion || '',
                active: bookData.active !== false,
                systemTotal,
                groupSize,
                totalObserved: nextTotal,
                observedAcquisitions: nextObservedAcquisitions,
                lastQuantity: quantity,
                lastQuery: query,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                ...(previousEntry ? {} : {
                    createdBy: actorId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAtMs: nowMs
                })
            }, { merge: true });

            transaction.set(sessionRef, {
                status: 'active',
                matchedItems: nextMatchedItems,
                totalObserved: nextSessionTotal,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                lastEntry: nextLastEntry
            }, { merge: true });

            resultEntry = {
                id: bookId,
                bookId,
                representativeId: bookId,
                groupKey: resolvedGroupKey,
                titulo: bookData.titulo || 'Sin titulo',
                autor: bookData.autor || '',
                adquisicion: displayAdquisicion || '',
                catalogAdquisicion: bookData.adquisicion || '',
                categoria: bookData.categoria || '',
                clasificacion: bookData.clasificacion || '',
                active: bookData.active !== false,
                systemTotal,
                groupSize,
                totalObserved: nextTotal,
                observedAcquisitions: nextObservedAcquisitions,
                lastQuantity: quantity,
                lastQuery: query,
                updatedBy: actorId,
                updatedAtMs: nowMs
            };
            resultSession = {
                id: sessionId,
                ...sessionData,
                status: 'active',
                matchedItems: nextMatchedItems,
                totalObserved: nextSessionTotal,
                updatedBy: actorId,
                updatedAtMs: nowMs,
                lastEntry: nextLastEntry
            };
        });

        await getInventoryMetaRef(ctx).set({
            sessionId,
            status: 'active',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        return {
            session: resultSession,
            entry: resultEntry,
            foundEntries: [],
            missingEntries: []
        };
    }

    async function reviewInventoryFoundEntry(ctx, data = {}) {
        const sessionId = String(data.sessionId || '').trim();
        const entryId = String(data.entryId || '').trim();
        const nextQuantity = Math.max(0, Math.floor(Number(data.quantity) || 0));
        const addedAcquisitions = Array.isArray(data.addedAcquisitions)
            ? [...new Set(data.addedAcquisitions.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))]
            : [];
        const observedAcquisitions = Array.isArray(data.observedAcquisitions)
            ? [...new Set(data.observedAcquisitions.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))]
            : [];

        if (!sessionId) throw new Error('No hay una sesion de inventario activa.');
        if (!entryId) throw new Error('Selecciona un registro para revisar.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(sessionId);
        const foundRef = sessionRef.collection(INVENTORY_FOUND_SUBCOLL).doc(entryId);

        const [sessionSnap, foundSnap] = await Promise.all([
            sessionRef.get(),
            foundRef.get()
        ]);

        if (!sessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');
        if (!foundSnap.exists) throw new Error('El registro ya no existe en inventario.');
        if ((sessionSnap.data()?.status || '') === 'finished') {
            throw new Error('La sesion ya fue finalizada. Inicia una nueva para continuar.');
        }

        const previousEntry = foundSnap.data() || {};
        const baseBookId = String(previousEntry.representativeId || previousEntry.bookId || '').trim();
        const baseAcquisition = String(previousEntry.catalogAdquisicion || previousEntry.adquisicion || '').trim().toUpperCase();
        let syncResult = { created: 0, linked: 0, skipped: 0 };
        let resultSession = null;
        let resultEntry = null;
        let deleted = false;
        if (addedAcquisitions.length > 0) {
            syncResult = await syncInventoryCopyAcquisitions(ctx, {
                baseBookId,
                acquisitions: addedAcquisitions
            });
        }

        await ctx.db.runTransaction(async (transaction) => {
            const [liveSessionSnap, liveFoundSnap] = await Promise.all([
                transaction.get(sessionRef),
                transaction.get(foundRef)
            ]);

            if (!liveSessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');
            if (!liveFoundSnap.exists) throw new Error('El registro ya no existe en inventario.');

            const sessionData = liveSessionSnap.data() || {};
            const liveEntry = liveFoundSnap.data() || {};
            const previousTotal = Number(liveEntry.totalObserved) || 0;
            const delta = nextQuantity - previousTotal;
            const nextSystemTotal = Math.max(Number(liveEntry.systemTotal) || 0, 1) + Number(syncResult.created || 0) + Number(syncResult.linked || 0);
            const nextGroupSize = Math.max(Number(liveEntry.groupSize) || 0, 1) + Number(syncResult.created || 0) + Number(syncResult.linked || 0);
            const nextSessionTotal = Math.max(0, (Number(sessionData.totalObserved) || 0) + delta);
            const nextMatchedItems = Math.max(0, (Number(sessionData.matchedItems) || 0) + (nextQuantity <= 0 ? -1 : 0));
            const nextObservedAcquisitions = nextQuantity <= 0
                ? []
                : [...new Set([
                    ...(observedAcquisitions.length ? observedAcquisitions : (Array.isArray(liveEntry.observedAcquisitions) ? liveEntry.observedAcquisitions : [])),
                    baseAcquisition || ''
                ].map((value) => String(value || '').trim().toUpperCase()).filter(Boolean))];
            const nextLastEntry = {
                type: 'catalogo',
                bookId: String(liveEntry.bookId || baseBookId || ''),
                titulo: liveEntry.titulo || 'Sin titulo',
                adquisicion: liveEntry.adquisicion || liveEntry.catalogAdquisicion || '',
                cantidad: nextQuantity,
                systemTotal: nextSystemTotal,
                query: liveEntry.lastQuery || liveEntry.adquisicion || '',
                atMs: nowMs
            };

            if (nextQuantity <= 0) {
                transaction.delete(foundRef);
                deleted = true;
                resultEntry = null;
            } else {
                transaction.set(foundRef, {
                    totalObserved: nextQuantity,
                    observedAcquisitions: nextObservedAcquisitions,
                    lastQuantity: delta !== 0 ? Math.abs(delta) : Number(liveEntry.lastQuantity) || nextQuantity,
                    systemTotal: nextSystemTotal,
                    groupSize: nextGroupSize,
                    updatedBy: actorId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAtMs: nowMs
                }, { merge: true });
                resultEntry = {
                    id: entryId,
                    ...liveEntry,
                    totalObserved: nextQuantity,
                    observedAcquisitions: nextObservedAcquisitions,
                    lastQuantity: delta !== 0 ? Math.abs(delta) : Number(liveEntry.lastQuantity) || nextQuantity,
                    systemTotal: nextSystemTotal,
                    groupSize: nextGroupSize,
                    updatedAtMs: nowMs
                };
            }

            transaction.set(sessionRef, {
                totalObserved: nextSessionTotal,
                matchedItems: nextMatchedItems,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                lastEntry: nextLastEntry
            }, { merge: true });

            resultSession = {
                id: sessionId,
                ...sessionData,
                totalObserved: nextSessionTotal,
                matchedItems: nextMatchedItems,
                updatedAtMs: nowMs,
                lastEntry: nextLastEntry
            };
        });

        return {
            session: resultSession,
            entry: resultEntry,
            entryId,
            deleted
        };
    }

    async function registerInventoryMissing(ctx, data = {}) {
        const sessionId = String(data.sessionId || '').trim();
        const query = String(data.query || '').trim();
        const title = String(data.title || data.nombre || '').trim();
        const displayName = title || query;
        const quantity = normalizeInventoryQuantity(data.quantity);

        if (!sessionId) throw new Error('No hay una sesion de inventario activa.');
        if (!displayName) throw new Error('Escribe el nombre del libro faltante para guardarlo.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const entryId = buildInventoryMissingKey(displayName);
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(sessionId);
        const missingRef = sessionRef.collection(INVENTORY_MISSING_SUBCOLL).doc(entryId);
        let resultSession = null;
        let resultEntry = null;

        await ctx.db.runTransaction(async (transaction) => {
            const [sessionSnap, missingSnap] = await Promise.all([
                transaction.get(sessionRef),
                transaction.get(missingRef)
            ]);

            if (!sessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');

            const sessionData = sessionSnap.data() || {};
            if (sessionData.status === 'finished') {
                throw new Error('La sesion ya fue finalizada. Inicia una nueva para continuar.');
            }

            const previousEntry = missingSnap.exists ? (missingSnap.data() || {}) : null;
            const nextTotal = (Number(previousEntry?.totalObserved) || 0) + quantity;
            const nextMissingItems = (Number(sessionData.missingItems) || 0) + (previousEntry ? 0 : 1);
            const nextSessionTotal = (Number(sessionData.totalObserved) || 0) + quantity;
            const nextLastEntry = {
                type: 'faltante',
                titulo: displayName,
                cantidad: quantity,
                query,
                atMs: nowMs
            };

            transaction.set(missingRef, {
                displayName,
                normalizedName: norm(displayName),
                lastQuery: query,
                totalObserved: nextTotal,
                lastQuantity: quantity,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                ...(previousEntry ? {} : {
                    createdBy: actorId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAtMs: nowMs
                })
            }, { merge: true });

            transaction.set(sessionRef, {
                status: 'active',
                missingItems: nextMissingItems,
                totalObserved: nextSessionTotal,
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                lastEntry: nextLastEntry
            }, { merge: true });

            resultEntry = {
                id: entryId,
                displayName,
                normalizedName: norm(displayName),
                lastQuery: query,
                totalObserved: nextTotal,
                lastQuantity: quantity,
                updatedBy: actorId,
                updatedAtMs: nowMs
            };
            resultSession = {
                id: sessionId,
                ...sessionData,
                status: 'active',
                missingItems: nextMissingItems,
                totalObserved: nextSessionTotal,
                updatedBy: actorId,
                updatedAtMs: nowMs,
                lastEntry: nextLastEntry
            };
        });

        await getInventoryMetaRef(ctx).set({
            sessionId,
            status: 'active',
            updatedBy: actorId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAtMs: nowMs
        }, { merge: true });

        return {
            session: resultSession,
            entry: resultEntry,
            foundEntries: [],
            missingEntries: []
        };
    }

    async function finalizeInventorySession(ctx, sessionId) {
        const rawSessionId = String(sessionId || '').trim();
        if (!rawSessionId) throw new Error('No hay una sesion para finalizar.');

        const nowMs = Date.now();
        const actorId = ctx?.auth?.currentUser?.uid || '';
        const sessionRef = ctx.db.collection(INVENTORY_COLL).doc(rawSessionId);
        const metaRef = getInventoryMetaRef(ctx);
        const [details, catalogSummary] = await Promise.all([
            getInventorySessionDetails(ctx, rawSessionId, { includeLists: true }),
            getInventoryCatalogSummary(ctx)
        ]);
        const finalSummary = buildInventorySessionSummary(details?.session, details?.foundEntries, details?.missingEntries, catalogSummary);

        await ctx.db.runTransaction(async (transaction) => {
            const [sessionSnap, metaSnap] = await Promise.all([
                transaction.get(sessionRef),
                transaction.get(metaRef)
            ]);

            if (!sessionSnap.exists) throw new Error('La sesion de inventario ya no existe.');

            transaction.set(sessionRef, {
                status: 'finished',
                updatedBy: actorId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAtMs: nowMs,
                finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                finishedAtMs: nowMs,
                summary: finalSummary
            }, { merge: true });

            if (metaSnap.exists && String(metaSnap.data()?.sessionId || '').trim() === rawSessionId) {
                transaction.set(metaRef, {
                    sessionId: '',
                    status: 'idle',
                    updatedBy: actorId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAtMs: nowMs
                }, { merge: true });
            }
        });

        return getInventorySessionDetails(ctx, rawSessionId, { includeLists: true });
    }

    // EXTENDER / CANCELAR / PAGAR
    async function extenderPrestamo(ctx, loanId) {
        await ensureHolidayCalendarLoaded(ctx);
        const ref = ctx.db.collection(PRES_COLL).doc(loanId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(ref);
            if (!doc.exists) throw new Error("Préstamo no existe");
            const data = doc.data();

            if (data.studentId !== ctx.auth.currentUser.uid) {
                throw new Error("Solo puedes extender tus propios préstamos.");
            }
            if (data.estado !== 'entregado') {
                throw new Error("Solo puedes extender libros que ya recogiste.");
            }

            if (data.extensiones && data.extensiones > 0) {
                throw new Error("Ya se ha usado la extensión permitida.");
            }

            const currentVenc = toDateSafe(data.fechaVencimiento);
            if (!currentVenc) throw new Error("El préstamo no tiene fecha de vencimiento válida.");
            if (new Date() > currentVenc) {
                throw new Error("No puedes extender un préstamo vencido.");
            }
            const nuevaFecha = addBusinessDays(currentVenc, 1);

            t.update(ref, {
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(nuevaFecha),
                extensiones: 1
            });
        });

        await procesarRecompensa(ctx, ctx.auth.currentUser.uid, 'uso_activo');
    }

    async function addSuggestion(ctx, data) {
        const payload = {
            ...data,
            uid: data.uid || data.by || '',
            status: 'pendiente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const ref = await ctx.db.collection(SUG_COLL).add(payload);

        if (payload.uid) {
            try {
                await ctx.db.collection(USERS_COLL).doc(payload.uid).set({
                    biblioSuggestionCount: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });
            } catch (error) {
                console.warn('[BIBLIO] No se pudo actualizar contador de sugerencias:', error);
            }
        }

        return ref;
    }

    async function getWishlist(ctx, uid) {
        if (!uid) return [];

        try {
            const snap = await ctx.db.collection(WISHLIST_COLL)
                .where('uid', '==', uid)
                .get();

            if (snap.empty) return [];

            const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const catalogMap = await loadCatalogBooksByIds(ctx, entries.map(item => item.bookId).filter(Boolean));

            return entries
                .map(item => {
                    const catalogBook = catalogMap.get(item.bookId) || {};
                    return {
                        id: item.bookId || item.id,
                        wishlistDocId: item.id,
                        addedAt: item.createdAt || null,
                        titulo: catalogBook.titulo || item.titulo || 'Libro',
                        autor: catalogBook.autor || item.autor || 'Autor desconocido',
                        categoria: catalogBook.categoria || item.categoria || '',
                        clasificacion: catalogBook.clasificacion || item.clasificacion || '',
                        adquisicion: catalogBook.adquisicion || item.adquisicion || '',
                        anio: getBookYear(catalogBook) || item.anio || '',
                        copiasDisponibles: catalogBook.copiasDisponibles ?? item.copiasDisponibles ?? 0,
                        active: catalogBook.active !== false
                    };
                })
                .sort((a, b) => (toMillisSafe(b.addedAt) || 0) - (toMillisSafe(a.addedAt) || 0));
        } catch (error) {
            console.warn('[BIBLIO] No se pudo cargar wishlist:', error);
            return [];
        }
    }

    async function saveToWishlist(ctx, uid, book = {}) {
        if (!uid || !book?.id) throw new Error('No se pudo guardar este libro.');

        const ref = ctx.db.collection(WISHLIST_COLL).doc(buildWishlistDocId(uid, book.id));
        await ref.set({
            uid,
            bookId: book.id,
            titulo: book.titulo || '',
            autor: book.autor || '',
            categoria: book.categoria || '',
            clasificacion: book.clasificacion || '',
            adquisicion: book.adquisicion || '',
            anio: getBookYear(book) || '',
            copiasDisponibles: Number(book.copiasDisponibles) || 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    }

    async function removeFromWishlist(ctx, uid, bookId) {
        if (!uid || !bookId) return;
        await ctx.db.collection(WISHLIST_COLL).doc(buildWishlistDocId(uid, bookId)).delete();
    }

    async function isBookInWishlist(ctx, uid, bookId) {
        if (!uid || !bookId) return false;
        const snap = await ctx.db.collection(WISHLIST_COLL).doc(buildWishlistDocId(uid, bookId)).get();
        return snap.exists;
    }

    async function getMyWaitlist(ctx, uid) {
        if (!uid || typeof ctx.db.collectionGroup !== 'function') return [];

        try {
            const snap = await ctx.db.collectionGroup('waitlist')
                .where(firebase.firestore.FieldPath.documentId(), '==', uid)
                .get();

            if (snap.empty) return [];

            const entries = snap.docs.map(doc => {
                const parentBookId = doc.ref.parent?.parent?.id || '';
                return {
                    id: parentBookId,
                    joinedAt: doc.data()?.createdAt || null,
                    ...doc.data()
                };
            }).filter(item => item.id);

            const catalogMap = await loadCatalogBooksByIds(ctx, entries.map(item => item.id));

            return entries
                .map(item => {
                    const catalogBook = catalogMap.get(item.id) || {};
                    return {
                        id: item.id,
                        joinedAt: item.joinedAt,
                        titulo: catalogBook.titulo || item.titulo || 'Libro',
                        autor: catalogBook.autor || item.autor || 'Autor desconocido',
                        categoria: catalogBook.categoria || item.categoria || '',
                        clasificacion: catalogBook.clasificacion || item.clasificacion || '',
                        adquisicion: catalogBook.adquisicion || item.adquisicion || '',
                        anio: getBookYear(catalogBook) || item.anio || '',
                        copiasDisponibles: catalogBook.copiasDisponibles ?? item.copiasDisponibles ?? 0,
                        active: catalogBook.active !== false
                    };
                })
                .sort((a, b) => (toMillisSafe(b.joinedAt) || 0) - (toMillisSafe(a.joinedAt) || 0));
        } catch (error) {
            console.warn('[BIBLIO] No se pudo cargar la lista de espera:', error);
            return [];
        }
    }

    async function joinWaitlist(ctx, uid, book = {}) {
        if (!uid || !book?.id) throw new Error('No se pudo agregar a la lista de espera.');

        await ctx.db.collection(CAT_COLL).doc(book.id).collection('waitlist').doc(uid).set({
            userId: uid,
            bookId: book.id,
            titulo: book.titulo || '',
            autor: book.autor || '',
            categoria: book.categoria || '',
            adquisicion: book.adquisicion || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return true;
    }

    async function leaveWaitlist(ctx, uid, bookId) {
        if (!uid || !bookId) return;
        await ctx.db.collection(CAT_COLL).doc(bookId).collection('waitlist').doc(uid).delete();
    }

    async function isBookInWaitlist(ctx, uid, bookId) {
        if (!uid || !bookId) return false;
        const snap = await ctx.db.collection(CAT_COLL).doc(bookId).collection('waitlist').doc(uid).get();
        return snap.exists;
    }

    async function extenderPrestamoAdmin(ctx, loanId) {
        await ensureHolidayCalendarLoaded(ctx);
        const ref = ctx.db.collection(PRES_COLL).doc(loanId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(ref);
            if (!doc.exists) throw new Error("Préstamo no existe");
            const data = doc.data();

            const currentVenc = data.fechaVencimiento.toDate();
            const nuevaFecha = addBusinessDays(currentVenc, 1);

            t.update(ref, {
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(nuevaFecha),
                extensiones: (data.extensiones || 0) + 1
            });
        });
    }

    async function cancelPendingLoan(ctx, loanId, {
        reason = 'Cancelado por el usuario',
        cancelledBy = 'usuario',
        allowExpired = false
    } = {}) {
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);

        await ctx.db.runTransaction(async t => {
            const loanSnap = await t.get(loanRef);
            if (!loanSnap.exists) throw new Error("La solicitud ya no existe.");

            const loan = loanSnap.data() || {};
            if (!['pendiente', 'pendiente_entrega'].includes(loan.estado)) {
                throw new Error("Solo las solicitudes pendientes se pueden cancelar.");
            }

            const pickupExpiry = toDateSafe(loan.fechaExpiracionRecoleccion);
            if (!allowExpired && pickupExpiry && pickupExpiry <= new Date()) {
                throw new Error("La solicitud ya expiró y no puede cancelarse manualmente.");
            }

            t.update(loanRef, {
                estado: 'cancelado',
                fechaCancelacion: firebase.firestore.FieldValue.serverTimestamp(),
                motivoCancelacion: reason,
                canceladoPor: cancelledBy
            });

            if (loan.libroId) {
                const bookRef = ctx.db.collection(CAT_COLL).doc(loan.libroId);
                t.update(bookRef, { copiasDisponibles: firebase.firestore.FieldValue.increment(1) });
            }
        });

    }

    async function cancelarPrestamo(ctx, loanId, bookId) {
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);

        await ctx.db.runTransaction(async t => {
            const l = await t.get(loanRef);
            if (!l.exists) return;
            // Solo si está activo
            if (l.data().estado !== 'entregado') throw new Error("Solo préstamos activos se pueden cancelar");

            t.delete(loanRef);
            t.update(bookRef, { copiasDisponibles: firebase.firestore.FieldValue.increment(1) });
        });
    }

    async function cancelarSolicitud(ctx, loanId) {
        return cancelPendingLoan(ctx, loanId, {
            reason: 'Cancelado por el usuario',
            cancelledBy: 'usuario',
            allowExpired: false
        });
    }

    async function pagarDeudaMonitor(ctx, uid) {
        // Buscar prestamos con deuda
        const loansSnap = await ctx.db.collection(PRES_COLL)
            .where('studentId', '==', uid)
            .where('estado', '==', 'cobro_pendiente')
            .get();

        const batch = ctx.db.batch();
        loansSnap.forEach(doc => {
            batch.update(doc.ref, { estado: 'finalizado', fechaPago: firebase.firestore.FieldValue.serverTimestamp() });
        });

        // Desbloquear al usuario
        batch.update(ctx.db.collection(USERS_COLL).doc(uid), { biblioBlocked: false });

        await batch.commit();

        // 🔔 NOTIFICAR
        if (window.Notify) {
            Notify.send(uid, {
                title: 'Deuda Saldada',
                message: 'Tu pago ha sido registrado. Tu cuenta ha sido desbloqueada.',
                type: 'biblio'
            });
        }
    }

    async function recibirLibroAdmin(ctx, loanId, bookId, forgiveDebt = false, justification = '') {
        await ensureHolidayCalendarLoaded(ctx);
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        let loan = null;
        let lateInfo = null;
        let multa = 0;

        await ctx.db.runTransaction(async t => {
            const loanDoc = await t.get(loanRef);
            if (!loanDoc.exists) throw new Error("El préstamo ya no existe.");

            loan = loanDoc.data() || {};
            if (loan.estado !== 'entregado') throw new Error("El libro no está marcado como préstamo físico activo.");
            const effectiveBookId = loan.libroId || bookId;
            if (!effectiveBookId) throw new Error("El préstamo no tiene libro asociado.");

            lateInfo = getLateInfo(loan);
            multa = lateInfo.fine;
            let nuevoEstado = 'finalizado';

            if (forgiveDebt && multa > 0) {
                console.log(`[BIBLIO] Deuda de $${multa} perdonada. Motivo: ${justification}`);
                multa = 0;
            }

            if (multa > 0) {
                nuevoEstado = 'cobro_pendiente';
                t.update(loanRef, {
                    estado: nuevoEstado,
                    montoDeuda: multa,
                    diasRetraso: lateInfo.daysLate,
                    multaReferencia: lateInfo.rawFine,
                    fechaDevolucionReal: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const updateData = {
                    estado: nuevoEstado,
                    fechaDevolucionReal: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (lateInfo.daysLate > 0) {
                    updateData.retrasoRegistrado = true;
                    updateData.diasRetraso = lateInfo.daysLate;
                    updateData.multaReferencia = lateInfo.rawFine;
                    updateData.sinCobroRetraso = lateInfo.loanPolicy.lateFeeExempt === true;
                }

                if (forgiveDebt) {
                    updateData.perdonado = true;
                    updateData.motivoPerdon = justification;
                    updateData.perdonadoPor = ctx.auth.currentUser.uid;
                    updateData.multaOriginal = calcularMulta(loan.fechaVencimiento);
                }

                t.update(loanRef, updateData);
            }

            t.update(ctx.db.collection(CAT_COLL).doc(effectiveBookId), {
                copiasDisponibles: firebase.firestore.FieldValue.increment(1)
            });
        });

        if (multa === 0) {
            // Si fue perdonado, quizás no damos XP completa? O sí?
            // User rules didn't specify, we give standard return XP.
            procesarRecompensa(ctx, loan.studentId, 'devolucion_a_tiempo');

            // 🔔 NOTIFICAR (Éxito / Perdón)
            if (window.Notify) {
                const msg = lateInfo.loanPolicy.lateFeeExempt && lateInfo.daysLate > 0
                    ? `Libro devuelto. Se registraron ${lateInfo.daysLate} dia(s) de retraso sin generar cobro.`
                    : forgiveDebt
                    ? `Libro devuelto. La multa por retraso ha sido CONDONADA. Motivo: ${justification}`
                    : `Gracias por devolver "${loan.tituloLibro || 'tu libro'}" a tiempo. +50 XP`;

                const notifyTitle = lateInfo.loanPolicy.lateFeeExempt && lateInfo.daysLate > 0
                    ? 'Devolucion registrada'
                    : (forgiveDebt ? 'Devolucion (Multa Perdonada)' : 'Libro Devuelto');

                Notify.send(loan.studentId, {
                    title: notifyTitle,
                    message: msg,
                    type: 'biblio'
                });
            }
        } else {
            // 🔔 NOTIFICAR (Multa)
            if (window.Notify) {
                Notify.send(loan.studentId, {
                    title: 'Multa Generada',
                    message: `Se generó una multa de $${multa} por retraso en "${loan.tituloLibro}". Pasa a caja a regularizarte.`,
                    type: 'biblio'
                });
            }
        }

        return { multa, loanData: loan };
    }

    async function entregarApartado(ctx, loanId) {
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        const loanSnap = await loanRef.get(); // Get data for notify

        const ahora = new Date();
        const fechaVenc = calcularFechaVencimiento(ahora); // Nueva lógica interna

        // Logica de recolección limite (si era solicitud)
        // Ya calculamos vencimiento de prestamo.

        await loanRef.update({
            estado: 'entregado',
            fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
            fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc)
        });

        // 🔔 NOTIFICAR
        if (loanSnap.exists && window.Notify) {
            const data = loanSnap.data();
            Notify.send(data.studentId, {
                title: 'Solicitud Aprobada',
                message: `Tu solicitud para "${data.tituloLibro}" ha sido aprobada. Tienes 24h para recogerlo.`,
                type: 'biblio'
            });
        }
    }

    async function prestarLibroManual(ctx, uid, bookId, options = {}) {
        await ensureHolidayCalendarLoaded(ctx);
        const perfil = await getPerfilBibliotecario(ctx, uid);
        if (perfil.estaBloqueado) throw new Error("Usuario con préstamo vencido o bloqueo activo.");

        const duplicateLoan = [...perfil.solicitados, ...perfil.recogidos]
            .find(loan => isLoanStillActive(loan) && loan.libroId === bookId);
        if (duplicateLoan) {
            throw new Error("El usuario ya tiene este libro en un prestamo activo.");
        }

        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);
        let createdLoanId = null;
        await ctx.db.runTransaction(async t => {
            const bookSnap = await t.get(bookRef);
            if (!bookSnap.exists) throw new Error("Libro no encontrado.");

            const bData = bookSnap.data();
            if (bData.active === false) throw new Error("El libro está inactivo y no se puede prestar.");
            if (bData.copiasDisponibles < 1) throw new Error("Sin stock.");

            t.update(bookRef, { copiasDisponibles: bData.copiasDisponibles - 1 });

            const borrowerKind = options.staffLoan ? 'staff' : 'student';
            const loanPolicy = getLoanPolicy(bData, { borrowerKind, staffLoan: options.staffLoan });
            const fechaVenc = calcularFechaVencimiento(new Date(), { ...bData, borrowerKind, staffLoan: options.staffLoan, lateFeeExempt: loanPolicy.lateFeeExempt });
            const newLoanRef = ctx.db.collection(PRES_COLL).doc();
            createdLoanId = newLoanRef.id;

            t.set(newLoanRef, {
                studentId: uid,
                studentEmail: perfil.email || '',
                libroId: bookId,
                tituloLibro: bData.titulo,
                categoriaLibro: bData.categoria || '',
                borrowerKind,
                lateFeeExempt: loanPolicy.lateFeeExempt,
                tracksLateWithoutCharge: loanPolicy.tracksLateWithoutCharge,
                loanPolicyLabel: loanPolicy.label,
                libroAdquisicion: bData.adquisicion || null,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc),
                estado: 'entregado',
                extensiones: 0,
                origenPrestamo: 'admin_manual'
            });
        });

        return { loanId: createdLoanId };
    }

    async function autoPrestarLibro(ctx, { uid, email, bookId, titulo }) {
        const perfil = await getPerfilBibliotecario(ctx, uid);
        if (perfil.estaBloqueado) throw new Error("Tienes un préstamo vencido o un bloqueo activo. No puedes solicitar préstamos.");

        const duplicado = [...perfil.solicitados, ...perfil.recogidos].find(l => l.libroId === bookId);
        if (duplicado) throw new Error("Ya tienes un préstamo activo para este libro.");

        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(bookRef);
            const stock = doc.data().copiasDisponibles || 0;
            if (stock < 1) throw new Error("Sin stock disponible.");

            t.update(bookRef, { copiasDisponibles: stock - 1 });

            const fechaVenc = calcularFechaVencimiento();
            const newLoanRef = ctx.db.collection(PRES_COLL).doc();

            t.set(newLoanRef, {
                studentId: uid,
                studentEmail: email,
                libroId: bookId,
                tituloLibro: titulo,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc),
                estado: 'entregado',
                extensiones: 0,
                origenPrestamo: 'app_estudiante'
            });
        });

        // Registrar visita automática para estadísticas del admin
        try {
            await ctx.db.collection(VISITAS_COLL).add({
                studentId: uid,
                studentName: perfil.nombre || 'Estudiante',
                matricula: perfil.matricula || 'S/N',
                motivo: 'Préstamo Digital (App)',
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                tipoUsuario: 'estudiante',
                createdAtMs: Date.now(),
                status: 'en_curso'
            });
        } catch (e) { console.warn('No se pudo registrar visita automática:', e); }

        // XP por préstamo
        procesarRecompensa(ctx, uid, 'uso_activo');
    }

    async function entregarApartadoSeguro(ctx, loanId) {
        await ensureHolidayCalendarLoaded(ctx);
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        let loanData = null;
        let fechaVenc = null;

        await ctx.db.runTransaction(async t => {
            const loanSnap = await t.get(loanRef);
            if (!loanSnap.exists) throw new Error("La solicitud ya no existe.");

            const data = loanSnap.data() || {};
            if (!['pendiente', 'pendiente_entrega'].includes(data.estado)) {
                throw new Error("Este registro ya no está pendiente por recoger.");
            }

            const pickupExpiry = toDateSafe(data.fechaExpiracionRecoleccion);
            if (pickupExpiry && pickupExpiry <= new Date()) {
                throw new Error("La solicitud ya expiró. Debe generarse una nueva solicitud.");
            }

            let categoriaLibro = data.categoriaLibro || '';
            if (!categoriaLibro && data.libroId) {
                const bookSnap = await t.get(ctx.db.collection(CAT_COLL).doc(data.libroId));
                if (bookSnap.exists) categoriaLibro = bookSnap.data()?.categoria || '';
            }

            loanData = { id: loanSnap.id, ...data, categoriaLibro };
            fechaVenc = calcularFechaVencimiento(new Date(), { categoriaLibro });

            const updatePayload = {
                estado: 'entregado',
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc)
            };
            if (categoriaLibro && data.categoriaLibro !== categoriaLibro) {
                updatePayload.categoriaLibro = categoriaLibro;
            }

            t.update(loanRef, updatePayload);
        });

        if (loanData?.studentId && window.Notify) {
            Notify.send(loanData.studentId, {
                title: 'Libro Entregado',
                message: `Ya se registró la entrega de "${loanData.tituloLibro}". Vence el ${fechaVenc.toLocaleDateString('es-MX')}.`,
                type: 'biblio'
            });
        }

        if (loanData?.studentId) {
            procesarRecompensa(ctx, loanData.studentId, 'uso_activo');
        }

    }

    async function autoPrestarLibroSeguro(ctx, { uid, email, bookId, titulo }) {
        await ensureHolidayCalendarLoaded(ctx);
        const perfil = await getPerfilBibliotecario(ctx, uid);
        if (perfil.estaBloqueado) {
            throw new Error("Tienes un préstamo vencido o un bloqueo activo. No puedes solicitar préstamos.");
        }

        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);

        await ctx.db.runTransaction(async t => {
            const [bookSnap, activeLoansSnap] = await Promise.all([
                t.get(bookRef),
                t.get(ctx.db.collection(PRES_COLL)
                    .where('studentId', '==', uid)
                    .where('libroId', '==', bookId))
            ]);

            if (!bookSnap.exists) throw new Error("El libro ya no existe.");

            const bookData = bookSnap.data() || {};
            if (bookData.active === false) {
                throw new Error("Este libro ya no está disponible para préstamo.");
            }

            const hasDuplicate = activeLoansSnap.docs.some(loanDoc => isLoanStillActive(loanDoc.data()));
            if (hasDuplicate) {
                throw new Error("Ya tienes una solicitud o préstamo activo para este libro.");
            }

            const stock = bookData.copiasDisponibles || 0;
            if (stock < 1) throw new Error("Sin stock disponible.");

            t.update(bookRef, { copiasDisponibles: stock - 1 });

            const newLoanRef = ctx.db.collection(PRES_COLL).doc();
            t.set(newLoanRef, {
                studentId: uid,
                studentEmail: email,
                libroId: bookId,
                libroAdquisicion: bookData.adquisicion || null,
                tituloLibro: bookData.titulo || titulo,
                categoriaLibro: bookData.categoria || '',
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaExpiracionRecoleccion: firebase.firestore.Timestamp.fromDate(calcularFechaExpiracionRecoleccion()),
                estado: 'pendiente',
                extensiones: 0,
                origenPrestamo: 'app_estudiante'
            });
        });

    }

    async function checkInActivo(ctx, uid) {
        await procesarRecompensa(ctx, uid, 'uso_activo');
    }

    // --- GAMIFICACIÓN ---
    async function procesarRecompensa(ctx, uid, accion) {
        const premios = {
            'first_login': 50,
            'devolucion_a_tiempo': 50,
            'devolucion_anticipada': 75,
            'visita_presencial': 5,
            'uso_activo': 20
        };

        const puntos = premios[accion] || 0;
        if (puntos === 0) return;

        const userRef = ctx.db.collection(USERS_COLL).doc(uid);

        try {
            await ctx.db.runTransaction(async tx => {
                const user = await tx.get(userRef);
                if (!user.exists) return;

                const data = user.data() || {};
                const xpActual = data.biblioXP || 0;
                const nuevoXP = xpActual + puntos;
                const nuevoNivel = computeBiblioLevel(nuevoXP);

                tx.update(userRef, {
                    biblioXP: nuevoXP,
                    biblioNivel: nuevoNivel
                });
            });
        } catch (e) {
            console.warn("⚠️ No se pudo dar XP (Posible falta permisos rules):", e.message);
        }
    }

    // --- LIBROS POR CATEGORÍA ---
    const CATEGORY_KEYWORDS = {
        'Administración': ['administracion', 'gestion', 'empresa', 'negocios', 'finanzas', 'contabilidad', 'recursos humanos', 'mercadotecnia', 'liderazgo'],
        'Arquitectura': ['arquitectura', 'diseño', 'construccion', 'urbanismo', 'planos', 'estructuras'],
        'Ciencias Básicas': ['matematicas', 'fisica', 'quimica', 'biologia', 'calculo', 'algebra', 'estadistica', 'ciencias'],
        'Gastronomía': ['gastronomia', 'cocina', 'alimentos', 'nutricion', 'culinaria', 'recetas', 'bebidas'],
        'Literatura': ['literatura', 'novela', 'poesia', 'cuento', 'ensayo', 'teatro', 'narrativa', 'ficcion']
    };

    async function getBooksByCategory(ctx, category, limit = 10) {
        const keywords = CATEGORY_KEYWORDS[category];
        if (!keywords) return [];

        try {
            const allBooks = await _loadCatalogCache(ctx);
            const results = allBooks.filter(book => {
                if (book.active === false) return false;
                const t = norm(book.titulo);
                const a = norm(book.autor);
                const cat = norm(book.categoria || '');
                // Match by categoria field if exists, or by keyword in title/author
                if (cat && keywords.some(kw => cat.includes(kw))) return true;
                return keywords.some(kw => t.includes(kw) || a.includes(kw));
            });
            return results.slice(0, limit);
        } catch (e) {
            console.warn('[BIBLIO] Error buscando por categoría:', e);
            return [];
        }
    }

    // --- TOP LIBROS (mas prestados) ---
    let _topBooksCache = null;
    let _topBooksCacheTime = 0;

    async function getTopBooks(ctx, limit = 5) {
        const now = Date.now();
        if (_topBooksCache && (now - _topBooksCacheTime) < 10 * 60 * 1000) return _topBooksCache.slice(0, limit);

        try {
            // Contar prestamos por libroId (ultimos 200 prestamos)
            const snap = await ctx.db.collection(PRES_COLL)
                .orderBy('fechaSolicitud', 'desc')
                .limit(200)
                .get();

            const counts = {};
            snap.docs.forEach(d => {
                const data = d.data();
                const lid = data.libroId;
                if (!lid) return;
                if (!counts[lid]) counts[lid] = { libroId: lid, titulo: data.tituloLibro || '', count: 0 };
                counts[lid].count++;
            });

            // Ordenar por popularidad
            const ranked = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, limit);

            const rankedIds = ranked.map(item => item.libroId).filter(Boolean);
            const booksMap = {};

            for (let i = 0; i < rankedIds.length; i += 10) {
                const chunk = rankedIds.slice(i, i + 10);
                if (chunk.length === 0) continue;

                try {
                    const bookSnaps = await ctx.db.collection(CAT_COLL)
                        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                        .get();
                    bookSnaps.forEach(doc => {
                        booksMap[doc.id] = doc.data();
                    });
                } catch (e) {
                    console.warn('[BIBLIO] Error cargando lote de top books:', e);
                }
            }

            const results = ranked.map(item => {
                const bookData = booksMap[item.libroId];
                if (bookData && bookData.active !== false) {
                    return { id: item.libroId, ...bookData, _prestamos: item.count };
                }
                return { id: item.libroId, titulo: item.titulo, autor: '', copiasDisponibles: 0, _prestamos: item.count };
            });

            _topBooksCache = results;
            _topBooksCacheTime = now;
            return results.slice(0, limit);
        } catch (e) {
            console.warn('[BIBLIO] Error cargando top books:', e);
            return [];
        }
    }

    return {
        findUserByQuery,
        findBookByCode,
        searchCatalogo,
        searchCatalogoAdmin,
        getTopBooks,
        getBooksByCategory,
        getLoanPolicy,
        getPerfilBibliotecario,
        registrarVisita,
        registrarVisitaGrupo,
        finalizarVisita,
        cleanupExpiredActiveVisits,
        getDashboardStats,
        getVisitSummaryStats,
        saveAsset,
        deleteAsset,
        asignarActivoManual,
        liberarActivo,
        updateLibro,
        addLibro,
        toggleLibroStatus,
        entregarApartado: entregarApartadoSeguro,
        recibirLibroAdmin,
        prestarLibroManual,
        extenderPrestamo,
        cancelarPrestamo: cancelarSolicitud,
        cancelarSolicitud,
        pagarDeudaMonitor,
        apartarLibro: (ctx, data) => autoPrestarLibroSeguro(ctx, data),
        autoPrestarLibro: autoPrestarLibroSeguro,
        syncGamification,
        procesarRecompensa,
        checkInActivo,
        getPrestamoInfo,
        getDevolucionInfo,
        getCondonacionInfo,
        getRecentOverdueLoans,
        getHolidayCalendarConfig,
        saveHolidayCalendarConfig,
        condonarRegistroPrestamo: condonarRegistroPrestamoV2,
        extenderPrestamoAdmin,
        addSuggestion,
        getWishlist,
        saveToWishlist,
        removeFromWishlist,
        isBookInWishlist,
        getMyWaitlist,
        joinWaitlist,
        leaveWaitlist,
        isBookInWaitlist,
        preloadInventoryLookup,
        getInventoryCatalogSummary,
        findInventoryBookByCode,
        getCurrentInventorySession,
        getInventorySessionDetails,
        getLatestFinishedInventorySession,
        getInventoryClosurePreview,
        applyFinishedInventoryToCatalog,
        startInventorySession,
        pauseInventorySession,
        resumeInventorySession,
        registerInventoryMatch,
        reviewInventoryFoundEntry,
        registerInventoryManualBook,
        registerInventoryAssociatedCopy,
        syncInventoryCopyAcquisitions,
        registerInventoryMissing,
        finalizeInventorySession,
        getLastAddedBook, getBookByAdquisicion, // [NEW]
        invalidateCatalogCache
    };
})();
window.BiblioService = BiblioService;
