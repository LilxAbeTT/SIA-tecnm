const BiblioService = (function () {
    const CAT_COLL = 'biblio-catalogo';
    const PRES_COLL = 'prestamos-biblio';
    const VISITAS_COLL = 'biblio-visitas';
    const ACTIVE_VISITS_COLL = 'biblio-visitas-activos';
    const SUG_COLL = 'biblio-solicitudes';
    const WISHLIST_COLL = 'biblio-wishlist';
    const USERS_COLL = 'usuarios';

    const ACTIVE_LOAN_STATES = new Set(['pendiente', 'pendiente_entrega', 'entregado']);
    const CACHE_SCHEMA_VERSION = 2;
    const LOCAL_CACHE_TTL = 5 * 60 * 1000;
    const SEARCH_TEXT_MIN_CHARS = 3;
    const PICKUP_WINDOW_MS = 24 * 60 * 60 * 1000;
    const ANON_DUPLICATE_WINDOW_MS = 45 * 1000;

    const COSTO_MULTA_DIARIA = 21;
    const LIMITE_BLOQUEO = 63; // 3 días de retraso

    // --- HELPERS LÓGICOS ---
    const norm = s => (s || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

        if (!visitSnap.exists || isVisitClosed(visitSnap.data() || {})) {
            transaction.delete(lockRef);
            return { lockRef, existingVisit: null };
        }

        return {
            lockRef,
            existingVisit: buildVisitDuplicatePayload(visitSnap.id, visitSnap.data(), { ...fallback, ...lockData, lockKey })
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
                visitsMap.set(doc.id, buildVisitDuplicatePayload(doc.id, data));
            });
        });

        const visits = Array.from(visitsMap.values());
        visits.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        return visits[0] || null;
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
    function calcularFechaVencimiento(fechaInicio = new Date()) {
        const fecha = new Date(fechaInicio);
        const diaSemana = fecha.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab

        // Lógica de adición de días
        let diasAgregados = 1; // Default

        if (diaSemana === 5) { // Viernes -> Lunes (+3)
            diasAgregados = 3;
        } else if (diaSemana === 6) { // Sábado -> Lunes (+2)
            diasAgregados = 2;
        } else if (diaSemana === 0) { // Domingo -> Lunes (+1)
            diasAgregados = 1;
        }

        fecha.setDate(fecha.getDate() + diasAgregados);

        // Ajustar hora de vencimiento a las 23:59 del día de entrega o inicio de día
        // El usuario mencionó "si se debe entregar ese día... pasadas las 3pm mostrar aviso".
        // Asumimos vencimiento al final del día operativo, pero el aviso es visual a las 3pm.
        fecha.setHours(18, 0, 0, 0); // Vence a las 6 PM (ejemplo)

        return fecha;
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
        if (!fechaVencimiento?.toDate) return 0;
        const hoy = new Date();
        const venc = fechaVencimiento.toDate();
        if (hoy <= venc) return 0;

        const diffMs = hoy - venc;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
    const CACHE_TTL = LOCAL_CACHE_TTL;

    async function _loadCatalogCache(ctx) {
        const now = Date.now();
        if (_catalogCache && (now - _catalogCacheTime) < CACHE_TTL) return _catalogCache;

        // Intentar leer de LocalStorage primero
        try {
            const localCache = localStorage.getItem('sia_biblio_catalog');
            const localMeta = localStorage.getItem('sia_biblio_catalog_meta');
            if (localCache && localMeta) {
                const meta = JSON.parse(localMeta);
                if (meta.version === CACHE_SCHEMA_VERSION && now - meta.updatedAt < LOCAL_CACHE_TTL) {
                    _catalogCache = JSON.parse(localCache);
                    _catalogCacheTime = now;
                    console.log(`[BIBLIO] Catálogo cargado desde caché local (${_catalogCache.length} libros). Cero lecturas facturadas.`);
                    return _catalogCache;
                }
            }
        } catch (e) {
            console.warn('[BIBLIO] Error leyendo cache local del catálogo', e);
        }

        console.log('[BIBLIO] Descargando catálogo completo de Firebase (reads: N)...');
        const snap = await ctx.db.collection(CAT_COLL).get();

        _catalogCache = snap.docs.map(d => {
            const data = d.data();
            // Retornar solo lo vital para búsqueda para no saturar LocalStorage (límite de 5MB)
            return {
                id: d.id,
                titulo: data.titulo,
                autor: data.autor,
                adquisicion: data.adquisicion,
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
        _catalogCacheTime = now;

        // Guardar en LocalStorage
        try {
            localStorage.setItem('sia_biblio_catalog', JSON.stringify(_catalogCache));
            localStorage.setItem('sia_biblio_catalog_meta', JSON.stringify({ updatedAt: now, version: CACHE_SCHEMA_VERSION }));
        } catch (e) {
            console.warn('[BIBLIO] No se pudo guardar el catálogo en LocalStorage (posible exceso de cuota)', e);
        }

        return _catalogCache;
    }

    function invalidateCatalogCache() {
        _catalogCache = null;
        _catalogCacheTime = 0;
        try {
            localStorage.removeItem('sia_biblio_catalog_meta');
            localStorage.removeItem('sia_biblio_catalog');
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
        let query = ctx.db.collection(PRES_COLL)
            .where('estado', 'in', ['pendiente', 'pendiente_entrega']);

        if (uid) {
            query = query.where('studentId', '==', uid);
        }

        const snap = await query.get();
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

        return cleanedCount;
    }

    async function getPerfilBibliotecario(ctx, uid) {
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
                const multa = calcularMulta(p.fechaVencimiento);
                p.multaActual = multa;
                if (multa > 0) deudaTotal += multa;
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
        const tieneRetrasosActivos = recogidos.some(p => {
            const venc = toDateSafe(p.fechaVencimiento);
            return venc ? hoy > venc : false;
        });
        const shouldBlock = tieneRetrasosActivos || adeudos.length > 0;

        if (shouldBlock !== (userData.biblioBlocked === true)) {
            ctx.db.collection(USERS_COLL).doc(uid).update({ biblioBlocked: shouldBlock });
            userData.biblioBlocked = shouldBlock;
        }

        return {
            uid: uid,
            nombre: nombreCompleto,
            matricula: matricula,
            email: userData.email,
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
        const returnDate = calcularFechaVencimiento();

        return {
            user: userProfile,
            book: book,
            returnDate: returnDate,
            canLoan: !tieneBloqueoActivo && !sinStock && !prestamoDuplicado,
            reason: tieneBloqueoActivo
                ? "Usuario con préstamo vencido o bloqueo activo."
                : (sinStock
                    ? "Libro sin stock."
                    : (prestamoDuplicado ? "El usuario ya tiene este libro en un prestamo activo." : "OK"))
        };
    }

    async function getDevolucionInfo(ctx, matricula, bookAdquisicion) {
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
        const multa = calcularMulta(loan.fechaVencimiento);

        return {
            user: userProfile,
            loan: loan,
            daysLate: multa / COSTO_MULTA_DIARIA,
            fine: multa,
            totalDebt: userProfile.deudaTotal + multa
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

    async function getDashboardStats(ctx) {
        await cleanupExpiredPendingLoans(ctx);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        // Consultas independientes (paralelizables en Promise.all)
        const [visitasSnap, prestamosSnap, devolucionesSnap, activosSnap, retrasosSnap] = await Promise.all([
            ctx.db.collection(VISITAS_COLL).where('fecha', '>=', hoy).where('fecha', '<', manana).orderBy('fecha', 'desc').get(),
            ctx.db.collection(PRES_COLL).where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado']).orderBy('fechaSolicitud', 'desc').get(),
            ctx.db.collection(PRES_COLL).where('estado', 'in', ['finalizado', 'cobro_pendiente']).orderBy('fechaDevolucionReal', 'desc').limit(10).get(),
            ctx.db.collection('biblio-activos').where('status', '==', 'ocupado').get(),
            ctx.db.collection(PRES_COLL).where('estado', '==', 'entregado').where('fechaVencimiento', '<', new Date()).limit(20).get()
        ]);

        // Filtrar préstamos de hoy para el conteo
        const prestamosHoyDocs = prestamosSnap.docs.filter(d => {
            const f = d.data().fechaSolicitud;
            return f && f.toDate() >= hoy && f.toDate() < manana;
        });

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
                item._resolvedStudentName = usersMap[item.studentId].displayName || usersMap[item.studentId].nombre || 'Estudiante';
                item._resolvedStudentMatricula = usersMap[item.studentId].matricula || item.studentId;
            }
            if (item.libroId && booksMap[item.libroId]) {
                item.adquisicion = booksMap[item.libroId].adquisicion || booksMap[item.libroId].numeroAdquisicion || booksMap[item.libroId].isbn || '--';
            }
            return item;
        };

        return {
            visitasHoy: visitasSnap.size,
            prestamosHoy: prestamosHoyDocs.length,
            activosOcupados: activosSnap.size,
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
        invalidateCatalogCache();
        return ref.update(cleanData);
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
        invalidateCatalogCache();
        return ctx.db.collection(CAT_COLL).add(cleanData);
    }

    async function toggleLibroStatus(ctx, id, isActive) {
        invalidateCatalogCache();
        return ctx.db.collection(CAT_COLL).doc(id).update({ active: isActive });
    }

    // EXTENDER / CANCELAR / PAGAR
    async function extenderPrestamo(ctx, loanId) {
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
            const nuevaFecha = new Date(currentVenc);

            // Añadir 1 día hábil (si cae viernes → lunes, sáb → lunes, dom → lunes)
            let daysToAdd = 1;
            const diaVenc = nuevaFecha.getDay(); // día actual de vencimiento
            if (diaVenc === 5) daysToAdd = 3; // Viernes → Lunes
            else if (diaVenc === 6) daysToAdd = 2; // Sábado → Lunes
            // Domingo: +1 = Lunes (ok)

            nuevaFecha.setDate(nuevaFecha.getDate() + daysToAdd);

            t.update(ref, {
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(nuevaFecha),
                extensiones: 1
            });
        });

        invalidateCatalogCache();
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
        const ref = ctx.db.collection(PRES_COLL).doc(loanId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(ref);
            if (!doc.exists) throw new Error("Préstamo no existe");
            const data = doc.data();

            const currentVenc = data.fechaVencimiento.toDate();
            const nuevaFecha = new Date(currentVenc);

            // Añadir 1 día hábil (si cae viernes → lunes, sáb → lunes, dom → lunes)
            let daysToAdd = 1;
            const diaVenc = nuevaFecha.getDay(); // día actual de vencimiento
            if (diaVenc === 5) daysToAdd = 3; // Viernes → Lunes
            else if (diaVenc === 6) daysToAdd = 2; // Sábado → Lunes

            nuevaFecha.setDate(nuevaFecha.getDate() + daysToAdd);

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

        invalidateCatalogCache();
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
        const loanRef = ctx.db.collection(PRES_COLL).doc(loanId);
        const loanDoc = await loanRef.get();
        const loan = loanDoc.data();

        if (loan.estado !== 'entregado') throw new Error("El libro no está marcado como prestado físico.");

        let multa = calcularMulta(loan.fechaVencimiento);
        let nuevoEstado = 'finalizado';

        // Lógica de Perdón
        if (forgiveDebt && multa > 0) {
            console.log(`[BIBLIO] Deuda de $${multa} perdonada. Motivo: ${justification}`);
            multa = 0; // Force 0 debt
        }

        const batch = ctx.db.batch();

        if (multa > 0) {
            nuevoEstado = 'cobro_pendiente';
            batch.update(loanRef, {
                estado: nuevoEstado,
                montoDeuda: multa,
                fechaDevolucionReal: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Sin multa o Perdonada
            const updateData = {
                estado: nuevoEstado,
                fechaDevolucionReal: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (forgiveDebt) {
                updateData.perdonado = true;
                updateData.motivoPerdon = justification;
                updateData.perdonadoPor = ctx.auth.currentUser.uid;
                // Guardamos cuanto debía originalmente para reportes
                updateData.multaOriginal = calcularMulta(loan.fechaVencimiento);
            }

            batch.update(loanRef, updateData);
        }

        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);
        batch.update(bookRef, { copiasDisponibles: firebase.firestore.FieldValue.increment(1) });

        await batch.commit();

        if (multa === 0) {
            // Si fue perdonado, quizás no damos XP completa? O sí?
            // User rules didn't specify, we give standard return XP.
            procesarRecompensa(ctx, loan.studentId, 'devolucion_a_tiempo');

            // 🔔 NOTIFICAR (Éxito / Perdón)
            if (window.Notify) {
                const msg = forgiveDebt
                    ? `Libro devuelto. La multa por retraso ha sido CONDONADA. Motivo: ${justification}`
                    : `Gracias por devolver "${loan.tituloLibro || 'tu libro'}" a tiempo. +50 XP`;

                Notify.send(loan.studentId, {
                    title: forgiveDebt ? 'Devolución (Multa Perdonada)' : 'Libro Devuelto',
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

    async function prestarLibroManual(ctx, uid, bookId) {
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

            const fechaVenc = calcularFechaVencimiento(); // Auto hoy
            const newLoanRef = ctx.db.collection(PRES_COLL).doc();
            createdLoanId = newLoanRef.id;

            t.set(newLoanRef, {
                studentId: uid,
                studentEmail: perfil.email || '',
                libroId: bookId,
                tituloLibro: bData.titulo,
                libroAdquisicion: bData.adquisicion || null,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc),
                estado: 'entregado',
                extensiones: 0,
                origenPrestamo: 'admin_manual'
            });
        });

        invalidateCatalogCache();
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

            loanData = { id: loanSnap.id, ...data };
            fechaVenc = calcularFechaVencimiento(new Date());

            t.update(loanRef, {
                estado: 'entregado',
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc)
            });
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

        invalidateCatalogCache();
    }

    async function autoPrestarLibroSeguro(ctx, { uid, email, bookId, titulo }) {
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
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaExpiracionRecoleccion: firebase.firestore.Timestamp.fromDate(calcularFechaExpiracionRecoleccion()),
                estado: 'pendiente',
                extensiones: 0,
                origenPrestamo: 'app_estudiante'
            });
        });

        invalidateCatalogCache();
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
        getTopBooks,
        getBooksByCategory,
        getPerfilBibliotecario,
        registrarVisita,
        registrarVisitaGrupo,
        finalizarVisita,
        getDashboardStats,
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
        getLastAddedBook, getBookByAdquisicion, // [NEW]
        invalidateCatalogCache
    };
})();
window.BiblioService = BiblioService;
