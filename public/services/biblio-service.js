const BiblioService = (function () {
    const CAT_COLL = 'biblio-catalogo';
    const PRES_COLL = 'prestamos-biblio';
    const VISITAS_COLL = 'biblio-visitas';
    const SUG_COLL = 'biblio-solicitudes';
    const USERS_COLL = 'usuarios';

    const COSTO_MULTA_DIARIA = 21;
    const LIMITE_BLOQUEO = 63; // 3 días de retraso

    // --- HELPERS LÓGICOS ---
    const norm = s => (s || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

    function puedeRecogerHoy(horaAprobacion) {
        // Regla:
        // - Aprobado < 12PM: Recoger HOY.
        // - Aprobado > 12PM: HOY o MAÑANA.
        const h = horaAprobacion.getHours();
        return h < 12; // true = solo hoy, false = hoy y mañana
    }

    // Calcular multa acumulada
    function calcularMulta(fechaVencimiento) {
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

        try {
            // 1. Intentar buscar por Matrícula
            const snapMat = await ctx.db.collection(USERS_COLL)
                .where('matricula', '==', q)
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
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    async function _loadCatalogCache(ctx) {
        const now = Date.now();
        if (_catalogCache && (now - _catalogCacheTime) < CACHE_TTL) return _catalogCache;

        const snap = await ctx.db.collection(CAT_COLL)
            .where('active', '==', true)
            .get();

        _catalogCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _catalogCacheTime = now;
        console.log(`[BIBLIO] Cache catalogo cargado: ${_catalogCache.length} libros`);
        return _catalogCache;
    }

    async function searchCatalogo(ctx, term) {
        if (!term) return [];
        const t = norm(term);

        try {
            // 1. Direct ID Search (Best for barcodes/ids)
            const idRef = ctx.db.collection(CAT_COLL).doc(term);
            const idSnap = await idRef.get();
            if (idSnap.exists && idSnap.data().active) {
                return [{ id: idSnap.id, ...idSnap.data() }];
            }

            // 2. Search by acquisition number
            const acqSnap = await ctx.db.collection(CAT_COLL)
                .where('adquisicion', '==', term)
                .limit(5)
                .get();

            if (!acqSnap.empty) {
                return acqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // 3. Busqueda por titulo/autor usando cache local
            // Firestore no soporta busqueda "contains" - usamos cache client-side
            const allBooks = await _loadCatalogCache(ctx);
            const words = t.split(/\s+/).filter(w => w.length >= 2);

            const scored = allBooks
                .map(book => {
                    const tNorm = norm(book.titulo);
                    const aNorm = norm(book.autor);
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
                .sort((a, b) => b._score - a._score);

            // Agrupar copias del mismo titulo+autor
            const agrupados = new Map();
            scored.forEach(book => {
                const key = norm(book.titulo + book.autor);
                if (agrupados.has(key)) {
                    agrupados.get(key).copiasDisponibles += (book.copiasDisponibles || 0);
                } else {
                    const { _score, ...clean } = book;
                    agrupados.set(key, { ...clean });
                }
            });

            return Array.from(agrupados.values()).slice(0, 15);
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
        try {
            const snap = await ctx.db.collection(CAT_COLL)
                .where('adquisicion', '==', adq)
                .limit(1)
                .get();
            if (snap.empty) return null;
            return { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { return null; }
    }

    async function getPerfilBibliotecario(ctx, uid) {
        const userDoc = await ctx.db.collection(USERS_COLL).doc(uid).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data() || {};
        const nombreCompleto = userData.displayName || (userData.nombre ? `${userData.nombre} ${userData.apellido || ''}` : 'Usuario');
        const matricula = userData.matricula || 'S/N';

        const loansSnap = await ctx.db.collection(PRES_COLL)
            .where('studentId', '==', uid).get();

        let deudaTotal = 0;
        const solicitados = [];
        const recogidos = [];
        const adeudos = [];
        const historial = [];

        loansSnap.forEach(doc => {
            const p = { id: doc.id, ...doc.data() };

            if (p.estado === 'pendiente') {
                const exp = p.fechaExpiracionRecoleccion.toDate();
                if (new Date() > exp) {
                    p.estado_simulado = 'no_recogido';
                    historial.push(p);
                } else {
                    solicitados.push(p);
                }
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
            else if (p.estado === 'finalizado' || p.estado === 'devuelto') {
                historial.push(p);
            }
        });

        if (deudaTotal >= LIMITE_BLOQUEO && !userData.biblioBlocked) {
            ctx.db.collection(USERS_COLL).doc(uid).update({ biblioBlocked: true });
            userData.biblioBlocked = true;
        } else if (deudaTotal < LIMITE_BLOQUEO && userData.biblioBlocked) {
            ctx.db.collection(USERS_COLL).doc(uid).update({ biblioBlocked: false });
            userData.biblioBlocked = false;
        }

        // Actualizar flag de bloqueo
        // NUEVA REGLA: Bloqueo solo si tiene préstamos vencidos NO devueltos (status: 'entregado' && vencido).
        const tieneRetrasosActivos = recogidos.some(p => {
            const venc = p.fechaVencimiento.toDate();
            const hoy = new Date();
            return hoy > venc;
        });

        if (tieneRetrasosActivos && !userData.biblioBlocked) {
            ctx.db.collection(USERS_COLL).doc(uid).update({ biblioBlocked: true });
            userData.biblioBlocked = true;
        } else if (!tieneRetrasosActivos && userData.biblioBlocked) {
            ctx.db.collection(USERS_COLL).doc(uid).update({ biblioBlocked: false });
            userData.biblioBlocked = false;
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
            solicitados,
            recogidos,
            adeudos,
            historial
        };
    }

    // --- MÉTODOS PARA ADMIN ---

    async function registrarVisita(ctx, data) {
        // data: { matricula, uid (opt), motivo, tipoUsuario (opt), relatedUsers: [], isUnregistered (opt), visitorType (opt), gender (opt) }

        if (data.isUnregistered) {
            const tempUid = 'unreg_' + Date.now();
            const visitData = {
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                matricula: data.matricula || 'N/A',
                motivo: data.motivo || 'Registro Entrada',
                studentId: tempUid,
                studentName: 'Visitante (' + (data.visitorType || 'Externo') + ')',
                tipoUsuario: data.visitorType || 'visitante_externo',
                visitorType: data.visitorType || 'Otro',
                gender: data.gender || 'No especificado',
                isUnregistered: true
            };
            await ctx.db.collection(VISITAS_COLL).add(visitData);
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
            const userSnap = await ctx.db.collection(USERS_COLL).where('matricula', '==', matricula).limit(1).get();
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

                const snap = await ctx.db.collection(USERS_COLL).where('matricula', '==', mat).limit(1).get();
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

        const visitData = {
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            matricula: matricula,
            motivo: data.motivo || 'Registro Entrada',
            studentId: uid,
            studentName: name,
            tipoUsuario: tipo,
            relatedUsers: validRelated
        };

        await ctx.db.collection(VISITAS_COLL).add(visitData);

        await procesarRecompensa(ctx, uid, 'visita_presencial');
        return { uid, nombre: name, matricula, tipo };
    }

    // --- NUEVOS HELPERS PARA MODALES ADMIN ---

    async function getPrestamoInfo(ctx, matricula, bookAdquisicion) {
        // 1. Buscar Usuario
        const userProfile = await findUserByQuery(ctx, matricula);
        if (!userProfile) throw new Error("Usuario no encontrado.");

        // 2. Buscar Libro (por ID adquisicion o ID doc)
        const book = (await searchCatalogo(ctx, bookAdquisicion))[0]; // Reutilizamos search logic
        if (!book) throw new Error("Libro no encontrado.");

        // 3. Validaciones
        const tieneDeuda = userProfile.deudaTotal > 0 || userProfile.estaBloqueado;
        const sinStock = book.copiasDisponibles < 1;

        // 4. Calcular Fecha Vencimiento simulada
        const returnDate = calcularFechaVencimiento();

        return {
            user: userProfile,
            book: book,
            returnDate: returnDate,
            canLoan: !tieneDeuda && !sinStock,
            reason: tieneDeuda ? "Usuario con adeudos/bloqueo." : (sinStock ? "Libro sin stock." : "OK")
        };
    }

    async function getDevolucionInfo(ctx, matricula, bookAdquisicion) {
        // 1. Buscar Usuario
        const userProfile = await findUserByQuery(ctx, matricula);
        if (!userProfile) throw new Error("Usuario no encontrado.");

        // 2. Buscar Préstamo Activo (Entregado) para este libro y usuario
        // El 'bookAdquisicion' puede ser el ID del libro o el codigo de adquisicion. 
        // Primero intentamos buscar el libro para tener su ID real si es un codigo.
        let bookId = bookAdquisicion;
        const book = (await searchCatalogo(ctx, bookAdquisicion))[0];
        if (book) bookId = book.id;

        const loans = userProfile.recogidos.filter(l => l.libroId === bookId || l.tituloLibro.includes(bookAdquisicion)); // Loose match fallback

        if (loans.length === 0) throw new Error("No se encontró un préstamo activo de este libro para este usuario.");

        const loan = loans[0]; // Tomamos el primero si hay duplicados raros

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

    async function registrarVisitaGrupo(ctx, listaMatriculas) {
        const batch = ctx.db.batch();
        const results = [];
        const unicos = [...new Set(listaMatriculas)]; // Eliminar duplicados

        // [FIX] Validar TODOS antes de escribir nada
        const validUsers = [];
        for (const mat of unicos) {
            const m = (mat || '').trim();
            if (!m || m.length < 3) continue;

            const snap = await ctx.db.collection(USERS_COLL).where('matricula', '==', m).limit(1).get();
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

        for (const u of validUsers) {
            const ref = ctx.db.collection(VISITAS_COLL).doc();
            batch.set(ref, {
                studentId: u.uid,
                studentName: u.name,
                matricula: u.matricula,
                tipoUsuario: u.tipo,
                fecha: firebase.firestore.FieldValue.serverTimestamp(),
                motivo: 'Visita Grupal (Equipo)'
            });
            // XP for each? Yes.
            // Note: We cannot await inside batch easily for XP transaction, 
            // but we can fire and forget or do it separately.
            // For now, let's focus on the visit record. XP logic is usually separate.
            // We'll call procesarRecompensa individually after batch? or separately.
            // The original code called it inside loop (which awaited).
            // Awaiting inside loop is fine if we are okay with serial. 
            // But strict validation requirement means we shouldn't partial save?
            // The batch handles the visit records atomically.
            // XP updates are transactions, so they can't be in the same batch easily if using helpers.
            // We will do XP updates after commit.
        }

        await batch.commit();

        // Post-commit XP
        for (const u of validUsers) {
            procesarRecompensa(ctx, u.uid, 'visita_presencial');
        }

        return validUsers;
    }

    async function getDashboardStats(ctx) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        // Consultas independientes (paralelizables en Promise.all)
        const [visitasSnap, prestamosSnap, devolucionesSnap, activosSnap, retrasosSnap] = await Promise.all([
            ctx.db.collection(VISITAS_COLL).where('fecha', '>=', hoy).where('fecha', '<', manana).orderBy('fecha', 'desc').limit(50).get(),
            ctx.db.collection(PRES_COLL).where('estado', '==', 'entregado').orderBy('fechaSolicitud', 'desc').limit(50).get(),
            ctx.db.collection(PRES_COLL).where('estado', 'in', ['finalizado', 'cobro_pendiente']).orderBy('fechaDevolucionReal', 'desc').limit(10).get(),
            ctx.db.collection('biblio-activos').where('status', '==', 'ocupado').get(),
            ctx.db.collection(PRES_COLL).where('estado', '==', 'entregado').where('fechaVencimiento', '<', new Date()).limit(20).get()
        ]);

        // Filtrar préstamos de hoy para el conteo
        const prestamosHoyDocs = prestamosSnap.docs.filter(d => {
            const f = d.data().fechaSolicitud;
            return f && f.toDate() >= hoy && f.toDate() < manana;
        });

        return {
            visitasHoy: visitasSnap.size,
            prestamosHoy: prestamosHoyDocs.length,
            activosOcupados: activosSnap.size,
            retrasos: retrasosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            // Últimos 3 registros para stats cards
            ultimasVisitas: visitasSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() })),
            ultimosPrestamos: prestamosSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() })),
            ultimasDevoluciones: devolucionesSnap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() })),
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
        const cleanData = {
            ...data,
            tituloSearch: norm(data.titulo),
            autorSearch: norm(data.autor),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return ref.update(cleanData);
    }

    async function addLibro(ctx, data) {
        const cleanData = {
            ...data,
            active: true,
            tituloSearch: norm(data.titulo),
            autorSearch: norm(data.autor),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            copiasDisponibles: Number(data.copiasDisponibles)
        };
        return ctx.db.collection(CAT_COLL).add(cleanData);
    }

    async function toggleLibroStatus(ctx, id, isActive) {
        return ctx.db.collection(CAT_COLL).doc(id).update({ active: isActive });
    }

    // EXTENDER / CANCELAR / PAGAR
    async function extenderPrestamo(ctx, loanId) {
        const ref = ctx.db.collection(PRES_COLL).doc(loanId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(ref);
            if (!doc.exists) throw new Error("Préstamo no existe");
            const data = doc.data();

            if (data.extensiones && data.extensiones > 0) {
                throw new Error("Ya se ha usado la extensión permitida.");
            }

            // Validar si el libro se solicitó en viernes (usuario dijo: viernes no hay extensión)
            // Esto es complejo si solo tenemos fechaVencimiento actual. 
            // Si la fecha actual de vencimiento es Lunes, significa que se pidió Viernes (probablemente).
            // Simplificación: Si hoy es Domingo o estamos fuera de rango, validar. 
            // REGLA: "si se solicita en viernes... no pueden pedir un dia mas (solo de lunes a jueves)"
            // Revisamos fechaSolicitud
            const fechaSolicitud = data.fechaSolicitud.toDate();
            if (fechaSolicitud.getDay() === 5) { // Viernes
                throw new Error("Préstamos de fin de semana no son extendibles.");
            }

            const currentVenc = data.fechaVencimiento.toDate();
            const nuevaFecha = new Date(currentVenc);

            // Extension siempre +1 dia, saltando finds
            let daysToAdd = 1;
            if (nuevaFecha.getDay() === 5) daysToAdd = 3; // Si vence viernes, pasa a Lunes (aunque regla dice que vie no extension, cubrimos el caso lun->mar->mie->jue->vie)

            nuevaFecha.setDate(nuevaFecha.getDate() + daysToAdd);

            t.update(ref, {
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(nuevaFecha),
                extensiones: 1 // Flag usada
            });
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
        if (perfil.estaBloqueado) throw new Error("Usuario bloqueado por adeudos.");

        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);
        await ctx.db.runTransaction(async t => {
            const bData = (await t.get(bookRef)).data();
            if (bData.copiasDisponibles < 1) throw new Error("Sin stock.");

            t.update(bookRef, { copiasDisponibles: bData.copiasDisponibles - 1 });

            const fechaVenc = calcularFechaVencimiento(); // Auto hoy
            const newLoanRef = ctx.db.collection(PRES_COLL).doc();

            t.set(newLoanRef, {
                studentId: uid,
                studentEmail: perfil.email || '',
                libroId: bookId,
                tituloLibro: bData.titulo,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(fechaVenc),
                estado: 'entregado',
                extensiones: 0
            });
        });
    }

    async function apartarLibro(ctx, { uid, email, bookId, titulo }) {
        const perfil = await getPerfilBibliotecario(ctx, uid);
        if (perfil.estaBloqueado) throw new Error("Adeudos pendientes. No puedes apartar.");
        if (perfil.deudaTotal > 0) throw new Error("Regulariza tu situación antes de solicitar.");

        const duplicado = [...perfil.solicitados, ...perfil.recogidos].find(l => l.libroId === bookId);
        if (duplicado) throw new Error("Ya tienes una solicitud activa para este libro.");

        const bookRef = ctx.db.collection(CAT_COLL).doc(bookId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(bookRef);
            const stock = doc.data().copiasDisponibles || 0;
            if (stock < 1) throw new Error("Sin stock disponible.");

            t.update(bookRef, { copiasDisponibles: stock - 1 });

            // Lógica de expiración de recolección (Pickup)
            const hoy = new Date();
            const esTarde = hoy.getHours() >= 12;
            const fechaLimitePickup = new Date();

            if (esTarde) {
                // Si es después de las 12 PM, tienen hoy Y mañana
                fechaLimitePickup.setDate(fechaLimitePickup.getDate() + 1);
            }
            if (fechaLimitePickup.getDay() === 0) fechaLimitePickup.setDate(fechaLimitePickup.getDate() + 1); // Si cae dom, pasa lun

            fechaLimitePickup.setHours(20, 0, 0, 0); // Fin del día

            const newLoanRef = ctx.db.collection(PRES_COLL).doc();

            t.set(newLoanRef, {
                studentId: uid,
                studentEmail: email,
                libroId: bookId,
                tituloLibro: titulo,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaExpiracionRecoleccion: firebase.firestore.Timestamp.fromDate(fechaLimitePickup),
                estado: 'pendiente'
            });
        });
    }

    async function checkInActivo(ctx, uid) {
        await procesarRecompensa(ctx, uid, 'uso_activo');
    }

    // --- GAMIFICACIÓN ---
    async function procesarRecompensa(ctx, uid, accion) {
        const premios = {
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
                const nuevoNivel = Math.floor(nuevoXP / 500) + 1;

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

            // Enriquecer con datos del catalogo
            const results = [];
            for (const item of ranked) {
                try {
                    const doc = await ctx.db.collection(CAT_COLL).doc(item.libroId).get();
                    if (doc.exists && doc.data().active) {
                        results.push({ id: doc.id, ...doc.data(), _prestamos: item.count });
                    } else {
                        results.push({ id: item.libroId, titulo: item.titulo, autor: '', copiasDisponibles: 0, _prestamos: item.count });
                    }
                } catch (e) {
                    results.push({ id: item.libroId, titulo: item.titulo, autor: '', copiasDisponibles: 0, _prestamos: item.count });
                }
            }

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
        getDashboardStats,
        saveAsset,
        deleteAsset,
        asignarActivoManual,
        liberarActivo,
        updateLibro,
        addLibro,
        toggleLibroStatus,
        entregarApartado,
        recibirLibroAdmin,
        prestarLibroManual,
        extenderPrestamo,
        cancelarPrestamo,
        pagarDeudaMonitor,
        apartarLibro,
        procesarRecompensa,
        checkInActivo,
        getPrestamoInfo,
        getDevolucionInfo,
        addSuggestion: (ctx, data) => ctx.db.collection(SUG_COLL).add({ ...data, status: 'pendiente', createdAt: firebase.firestore.FieldValue.serverTimestamp() }),
        getLastAddedBook, getBookByAdquisicion // [NEW]
    };
})();
window.BiblioService = BiblioService;