// services/biblio-service.js
// Servicio de Datos para Módulo Biblio
// Separa la lógica de Firestore y IoT de la UI

const BiblioService = (function () {
    const CAT_COLL = 'biblio-catalogo';
    const PRES_COLL = 'prestamos-biblio';
    const API_URL = "https://script.google.com/macros/s/AKfycbz4Wy-pzC7nCjnK6TLg5WgxWNEPEJ_lzOVlm1n-boQX49UQZQSB1WG3ITxChME6NIS9Wg/exec";

    // --- HELPERS ---
    const norm = s => (s || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // --- STUDENT METHODS ---

    function streamStudentPrestamos(ctx, uid, onSuccess, onError) {
        return ctx.db.collection(PRES_COLL)
            .where('studentId', '==', uid)
            .orderBy('fechaSolicitud', 'desc')
            .onSnapshot(
                snap => onSuccess(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                err => onError(err)
            );
    }

    function streamCatalogo(ctx, onSuccess, onError) {
        // Nota: En producción idealmente se paginaría o limitaría
        return ctx.db.collection(CAT_COLL).orderBy('titulo', 'asc').onSnapshot(
            snap => onSuccess(snap.docs),
            err => onError(err)
        );
    }

    async function solicitarLibro(ctx, { user, libroId, titulo }) {
        // Validar duplicados activos (regla de negocio)
        // Nota: Esto requiere leer los préstamos actuales. 
        // Idealmente el UI ya lo validó, pero el servicio podría hacer un check extra si se desea robustez.
        // Por eficiencia, confiamos en la validación de UI + Reglas de Seguridad (Fase 1).

        const nuevo = {
            studentId: user.uid,
            studentEmail: user.email,
            libroId,
            tituloLibro: titulo,
            fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
            estado: 'pendiente'
        };
        return ctx.db.collection(PRES_COLL).add(nuevo);
    }

    // --- ADMIN METHODS ---

    function streamPrestamosByState(ctx, estado, onSuccess, onError) {
        return ctx.db.collection(PRES_COLL)
            .where('estado', '==', estado)
            .onSnapshot(snap => onSuccess(snap.docs), onError);
    }

    // Alta inteligente de libros (evita duplicados por ISBN o Título+Autor)
    async function addOrUpdateLibro(ctx, { titulo, autor, isbn, add }) {
        const tituloSearch = norm(titulo);
        const autorSearch = norm(autor);
        let existing = null;

        // 1. Buscar por ISBN
        if (isbn) {
            const q = await ctx.db.collection(CAT_COLL).where('isbn', '==', isbn).limit(1).get();
            if (!q.empty) existing = { id: q.docs[0].id, data: q.docs[0].data() };
        }
        // 2. Buscar por Título+Autor si no hay ISBN match
        if (!existing) {
            const q2 = await ctx.db.collection(CAT_COLL).where('tituloSearch', '==', tituloSearch).limit(20).get();
            q2.forEach(d => {
                if (!existing && norm(d.data().autor) === autorSearch) existing = { id: d.id, data: d.data() };
            });
        }

        if (existing) {
            // Update stock
            const ref = ctx.db.collection(CAT_COLL).doc(existing.id);
            return ctx.db.runTransaction(async tx => {
                const snap = await tx.get(ref);
                const prev = Number(snap.data().copiasDisponibles) || 0;
                tx.update(ref, { copiasDisponibles: prev + add });
                return { action: 'updated', id: existing.id };
            });
        } else {
            // Create new
            const docRef = await ctx.db.collection(CAT_COLL).add({
                titulo, autor,
                isbn: isbn || null,
                tituloSearch, autorSearch,
                copiasDisponibles: add,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { action: 'created', id: docRef.id };
        }
    }

    async function eliminarLibro(ctx, id) {
        return ctx.db.collection(CAT_COLL).doc(id).delete();
    }

    // --- WORKFLOW TRANSACCIONAL ---

    async function aprobarPrestamo(ctx, id) {
        return ctx.db.collection(PRES_COLL).doc(id).update({
            estado: 'aprobado',
            fechaAprobacion: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function rechazarPrestamo(ctx, id) {
        return ctx.db.collection(PRES_COLL).doc(id).update({ estado: 'rechazado' });
    }

    async function entregarPrestamo(ctx, prestamoId, libroId) {
        const catRef = ctx.db.collection(CAT_COLL).doc(libroId);
        const presRef = ctx.db.collection(PRES_COLL).doc(prestamoId);

        return ctx.db.runTransaction(async tx => {
            const cat = await tx.get(catRef);
            if (!cat.exists) throw new Error('Libro no encontrado en catálogo');

            const disp = Number(cat.data().copiasDisponibles) || 0;
            if (disp <= 0) throw new Error('Sin copias físicas disponibles');

            tx.update(catRef, { copiasDisponibles: disp - 1 });

            const venc = new Date();
            venc.setDate(venc.getDate() + 14); // 2 semanas de préstamo

            tx.update(presRef, {
                estado: 'entregado',
                fechaEntrega: firebase.firestore.FieldValue.serverTimestamp(),
                fechaVencimiento: firebase.firestore.Timestamp.fromDate(venc)
            });
        });
    }

    async function devolverPrestamo(ctx, prestamoId, libroId) {
        const catRef = ctx.db.collection(CAT_COLL).doc(libroId);
        const presRef = ctx.db.collection(PRES_COLL).doc(prestamoId);

        return ctx.db.runTransaction(async tx => {
            const cat = await tx.get(catRef);
            // Si el libro fue borrado del catálogo, permitimos devolver el préstamo sin actualizar stock
            // o lanzamos error. Asumimos que existe o se recrea.
            let disp = 0;
            if (cat.exists) disp = Number(cat.data().copiasDisponibles) || 0;

            if (cat.exists) {
                tx.update(catRef, { copiasDisponibles: disp + 1 });
            }

            tx.update(presRef, {
                estado: 'devuelto',
                fechaDevolucion: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    }

    // --- SUPER ADMIN & IOT ---

    async function getFirebaseStats(ctx) {
        // Nota: Esto puede ser costoso en lecturas. Usar con moderación o contadores distribuidos.
        const catSnap = await ctx.db.collection(CAT_COLL).get();
        let totalLibros = 0;
        catSnap.forEach(d => totalLibros += (Number(d.data().copiasDisponibles) || 0));
        return { totalLibros };
    }

    function streamAllPrestamos(ctx, limit, callback) {
        return ctx.db.collection(PRES_COLL)
            .orderBy('fechaSolicitud', 'desc')
            .limit(limit)
            .onSnapshot(callback);
    }

    async function fetchBiblopData() {
        const url = `${API_URL}?mode=list&limit=1000`;
        const response = await fetch(url);
        const text = await response.text();

        // Limpieza robusta del JSONP/Raw text
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            const jsonString = text.substring(firstOpen, lastClose + 1);
            return JSON.parse(jsonString);
        }
        throw new Error("Respuesta BiBlop inválida");
    }

    // --- DIGITAL & GAMIFICATION ---

    async function getDigitalBooks() {
        // En producción, esto vendría de una colección 'biblio-digital'
        // Simulamos respuesta rápida para MVP
        return [
            { id: 'd1', titulo: 'Introducción a la Programación', autor: 'OpenLibra', url: '#', cat: 'Sistemas', cover: 'https://via.placeholder.com/150?text=Code' },
            { id: 'd2', titulo: 'Historia de la Arquitectura', autor: 'Biblioteca Nacional', url: '#', cat: 'Arquitectura', cover: 'https://via.placeholder.com/150?text=Arch' },
            { id: 'd3', titulo: 'Manual de Primeros Auxilios', autor: 'Cruz Roja', url: '#', cat: 'Salud', cover: 'https://via.placeholder.com/150?text=Salud' },
            { id: 'd4', titulo: 'Tesis: Inteligencia Artificial', autor: 'Repositorio TecNM', url: '#', cat: 'Tesis', cover: 'https://via.placeholder.com/150?text=Tesis' }
        ];
    }

    async function checkAchievements(ctx, uid) {
        // Calculamos logros en tiempo real basados en el historial
        const prestamosSnap = await ctx.db.collection(PRES_COLL)
            .where('studentId', '==', uid)
            .where('estado', '==', 'devuelto')
            .get();

        const totalLeidos = prestamosSnap.size;
        const logros = [];

        // Reglas de Gamificación
        if (totalLeidos >= 1) logros.push({ id: 'l1', icon: 'bi-book', title: 'Primeros Pasos', desc: 'Leíste tu primer libro' });
        if (totalLeidos >= 5) logros.push({ id: 'l2', icon: 'bi-eyeglasses', title: 'Lector Constante', desc: '5 libros completados' });
        if (totalLeidos >= 10) logros.push({ id: 'l3', icon: 'bi-trophy-fill', title: 'Ratón de Biblioteca', desc: '10 libros completados' });

        // Verificar puntualidad (mock logic)
        // En real: checar fechaDevolucion <= fechaVencimiento
        const puntual = true;
        if (totalLeidos > 0 && puntual) logros.push({ id: 'l4', icon: 'bi-clock-history', title: 'Siempre a Tiempo', desc: 'Sin retrasos registrados' });

        return { totalLeidos, logros };
    }

    // --- WISHLIST & DISCOVERY ---

    async function toggleWishlist(ctx, uid, bookId) {
        const ref = ctx.db.collection('biblio-wishlist').doc(`${uid}_${bookId}`);
        const doc = await ref.get();
        
        if (doc.exists) {
            await ref.delete();
            return false; // Removido
        } else {
            await ref.set({
                uid, bookId, 
                addedAt: firebase.firestore.FieldValue.serverTimestamp() 
            });
            return true; // Agregado
        }
    }

    function streamWishlist(ctx, uid, callback) {
        return ctx.db.collection('biblio-wishlist')
            .where('uid', '==', uid)
            .onSnapshot(snap => {
                const ids = new Set(snap.docs.map(d => d.data().bookId));
                callback(ids);
            });
    }

    // Helper para organizar libros en categorías "Netflix"
    function categorizeBooks(books) {
        // En un sistema real, esto usaría tags de la BD.
        // Aquí simulamos categorías basadas en palabras clave del título o autor
        // para que se vea lleno y bonito desde el inicio.
        
        const cats = {
            trending: [],
            new: [],
            tech: [],
            general: []
        };

        books.forEach(b => {
            // Simulamos "Tendencias" (libros con poco stock o populares)
            if (b.copiasDisponibles < 3) cats.trending.push(b);
            
            // Simulamos "Recién Llegados" (creados recientemente o random para demo)
            // Si tienes campo createdAt úsalo, si no, aleatorio para demo visual
            if (b.createdAt || Math.random() > 0.7) cats.new.push(b);

            // Categoría Temática (Ej. Tecnología/Ingeniería)
            const txt = (b.titulo + ' ' + b.autor).toLowerCase();
            if (txt.includes('programacion') || txt.includes('sistemas') || txt.includes('calculo') || txt.includes('quimica')) {
                cats.tech.push(b);
            } else {
                cats.general.push(b);
            }
        });

        return cats;
    }

    return {
        norm,
        streamStudentPrestamos,
        streamCatalogo,
        solicitarLibro,
        streamPrestamosByState,
        addOrUpdateLibro,
        eliminarLibro,
        aprobarPrestamo,
        rechazarPrestamo,
        entregarPrestamo,
        devolverPrestamo,
        getFirebaseStats,
        streamAllPrestamos,
        fetchBiblopData,
        getDigitalBooks, checkAchievements,
        toggleWishlist, streamWishlist, categorizeBooks,
    };

})();

window.BiblioService = BiblioService;