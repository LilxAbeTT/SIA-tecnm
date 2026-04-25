// services/cafeteria-service.js
// Servicio para el Modulo de Cafeteria
// Gestiona config, productos, pedidos y resenas.

if (!window.CafeteriaService) {
    window.CafeteriaService = (function () {
        const C_CONFIG = 'cafeteria-config';
        const C_PRODUCTOS = 'cafeteria-productos';
        const C_PEDIDOS = 'cafeteria-pedidos';
        const C_RESENAS = 'cafeteria-resenas';

        // --- CACHE ---
        let _configCache = null;
        let _configCacheTime = 0;
        const CONFIG_TTL = 10 * 60 * 1000;

        let _productosCache = null;
        let _productosCacheTime = 0;
        const PRODUCTOS_TTL = 5 * 60 * 1000;

        // --- HELPERS PRIVADOS ---

        /**
         * Verifica si el perfil tiene permisos de admin de cafeteria
         * @param {Object} profile
         * @returns {boolean}
         */
        function _isCafeteriaAdmin(profile) {
            if (!profile) return false;
            if (profile.role === 'superadmin') return true;
            return profile.role === 'department_admin' &&
                profile.permissions && profile.permissions.cafeteria;
        }

        /**
         * Comprime una imagen antes de subirla a Storage
         * @param {File|Blob} file
         * @param {number} maxWidth
         * @param {number} quality
         * @returns {Promise<Blob>}
         */
        function _compressImage(file, maxWidth = 800, quality = 0.7) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = new Image();
                    img.onload = function () {
                        const canvas = document.createElement('canvas');
                        let w = img.width;
                        let h = img.height;
                        if (w > maxWidth) {
                            h = Math.round(h * maxWidth / w);
                            w = maxWidth;
                        }
                        canvas.width = w;
                        canvas.height = h;
                        const ctx2d = canvas.getContext('2d');
                        ctx2d.drawImage(img, 0, 0, w, h);
                        canvas.toBlob(
                            blob => blob ? resolve(blob) : reject(new Error('Error al comprimir imagen')),
                            'image/jpeg',
                            quality
                        );
                    };
                    img.onerror = () => reject(new Error('Error al cargar imagen'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsDataURL(file);
            });
        }

        // ===================== CONFIG =====================

        /**
         * Obtiene la configuracion de la cafeteria (cached)
         * @param {Object} ctx
         * @returns {Promise<Object|null>}
         */
        async function getConfig(ctx) {
            const now = Date.now();
            if (_configCache && (now - _configCacheTime) < CONFIG_TTL) {
                return _configCache;
            }
            const doc = await ctx.db.collection(C_CONFIG).doc('main').get();
            _configCache = doc.exists ? { id: doc.id, ...doc.data() } : null;
            _configCacheTime = now;
            return _configCache;
        }

        /**
         * Actualiza la configuracion de la cafeteria (solo admin)
         * @param {Object} ctx
         * @param {Object} data
         */
        async function updateConfig(ctx, data) {
            await ctx.db.collection(C_CONFIG).doc('main').set({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: ctx.user.uid
            }, { merge: true });
            _configCache = null; // Invalidar cache
            return { success: true };
        }

        /**
         * Cambia el estado de recepcion de pedidos (abierto/cerrado)
         * @param {Object} ctx
         * @param {boolean} activo - true para abrir, false para cerrar/pausar
         */
        async function setRecepcionActiva(ctx, activo) {
            await ctx.db.collection(C_CONFIG).doc('main').set({
                recepcionActiva: activo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            _configCache = null;
            return { success: true };
        }

        // ===================== PRODUCTOS =====================

        /**
         * Obtiene productos con filtros opcionales y paginacion
         * @param {Object} ctx
         * @param {Object} options - { soloDisponibles, categoria, lastDoc, limit }
         */
        async function getProductos(ctx, options = {}) {
            // Cache simple para vista estudiante (solo disponibles sin filtro)
            if (options.soloDisponibles && !options.categoria && !options.lastDoc) {
                const now = Date.now();
                if (_productosCache && (now - _productosCacheTime) < PRODUCTOS_TTL) {
                    return _productosCache;
                }
            }

            let q = ctx.db.collection(C_PRODUCTOS);

            if (options.soloDisponibles) {
                q = q.where('disponible', '==', true);
            }
            if (options.categoria) {
                q = q.where('categoria', '==', options.categoria);
            }

            q = q.orderBy('orden', 'asc');

            if (options.lastDoc) {
                q = q.startAfter(options.lastDoc);
            }

            const limit = options.limit || 50;
            const snap = await q.limit(limit).get();

            const productos = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                _doc: d
            }));

            // Cachear solo la consulta por defecto (disponibles sin filtro)
            if (options.soloDisponibles && !options.categoria && !options.lastDoc) {
                _productosCache = productos;
                _productosCacheTime = Date.now();
            }

            return productos;
        }

        /**
         * Obtiene un producto por ID
         * @param {Object} ctx
         * @param {string} productoId
         */
        async function getProductoById(ctx, productoId) {
            const doc = await ctx.db.collection(C_PRODUCTOS).doc(productoId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        }

        /**
         * Crea un nuevo producto (solo admin)
         * @param {Object} ctx
         * @param {Object} data
         */
        async function createProducto(ctx, data) {
            const producto = {
                titulo: data.titulo,
                descripcion: data.descripcion || '',
                precio: Number(data.precio) || 0,
                categoria: data.categoria || 'General',
                fotoUrl: data.fotoUrl || '',
                cantidadPeso: data.cantidadPeso || '',
                tiempoPreparacion: Number(data.tiempoPreparacion) || 0,
                disponible: data.disponible !== false,
                stock: data.stock != null ? Number(data.stock) : -1,
                orden: Number(data.orden) || 0,
                kcal: data.kcal ? Number(data.kcal) : null,
                highlightPopular: data.highlightPopular || false,
                promedioResenas: 0,
                totalResenas: 0,
                totalPedidos: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const ref = await ctx.db.collection(C_PRODUCTOS).add(producto);
            _productosCache = null;
            return { id: ref.id, ...producto };
        }

        /**
         * Actualiza un producto existente (solo admin)
         * @param {Object} ctx
         * @param {string} productoId
         * @param {Object} data
         */
        async function updateProducto(ctx, productoId, data) {
            const updateData = { ...data };
            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            // No permitir sobreescribir campos de resenas desde aqui
            delete updateData.promedioResenas;
            delete updateData.totalResenas;
            delete updateData.createdAt;

            await ctx.db.collection(C_PRODUCTOS).doc(productoId).update(updateData);
            _productosCache = null;
            return { success: true };
        }

        /**
         * Elimina un producto (solo admin)
         * @param {Object} ctx
         * @param {string} productoId
         */
        async function deleteProducto(ctx, productoId) {
            await ctx.db.collection(C_PRODUCTOS).doc(productoId).delete();
            _productosCache = null;
            return { success: true };
        }

        /**
         * Sube foto de producto a Storage con compresion
         * @param {Object} ctx
         * @param {File} file
         */
        async function uploadProductoFoto(ctx, file) {
            if (!file) return null;
            const storage = ctx.storage || (window.SIA && window.SIA.storage);
            if (!storage) throw new Error('Storage no disponible');

            const compressed = await _compressImage(file, 800, 0.7);
            const filename = `${Date.now()}_producto.jpg`;
            const ref = storage.ref().child(`cafeteria/productos/${filename}`);
            const snapshot = await ref.put(compressed, { contentType: 'image/jpeg' });
            return await snapshot.ref.getDownloadURL();
        }

        /**
         * Duplica un producto existente como nuevo (solo admin)
         * @param {Object} ctx
         * @param {string} productoId
         */
        async function duplicarProducto(ctx, productoId) {
            const original = await getProductoById(ctx, productoId);
            if (!original) throw new Error('Producto no encontrado');
            const copia = { ...original };
            delete copia.id;
            delete copia._doc;
            copia.titulo = `Copia de ${original.titulo}`;
            copia.disponible = false;
            copia.promedioResenas = 0;
            copia.totalResenas = 0;
            copia.totalPedidos = 0;
            copia.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            copia.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            const ref = await ctx.db.collection(C_PRODUCTOS).add(copia);
            _productosCache = null;
            return { id: ref.id, ...copia };
        }

        // ===================== PEDIDOS =====================

        /**
         * Crea un nuevo pedido (estudiante)
         * Valida que la cafeteria este abierta y que haya stock suficiente.
         * @param {Object} ctx
         * @param {Array} cartItems
         * @param {string} metodoPago
         * @param {string} nota
         */
        async function createPedido(ctx, cartItems, metodoPago, nota, comprobanteUrl = '') {
            if (!ctx.user) throw new Error('Usuario no identificado');
            if (!cartItems || !cartItems.length) throw new Error('Carrito vacío');

            const functions = ctx.functions || window.SIA?.functions || firebase.functions();
            if (!functions?.httpsCallable) {
                throw new Error('Servicio de pedidos no disponible.');
            }

            const createPedidoFn = functions.httpsCallable('cafeteriaCreatePedido');
            const result = await createPedidoFn({
                items: cartItems.map(item => ({
                    productoId: item.productoId,
                    cantidad: Number(item.cantidad)
                })),
                metodoPago: metodoPago || 'efectivo',
                nota: nota || '',
                comprobanteUrl: comprobanteUrl || ''
            });
            _productosCache = null;
            return result.data;
        }

        /**
         * Obtiene pedidos de un estudiante, paginados
         * @param {Object} ctx
         * @param {string} userId
         * @param {Object} options - { limit, lastDoc }
         */
        async function getPedidosByUser(ctx, userId, options = {}) {
            let q = ctx.db.collection(C_PEDIDOS)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc');

            if (options.lastDoc) q = q.startAfter(options.lastDoc);
            const limit = options.limit || 20;
            const snap = await q.limit(limit).get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                updatedAt: d.data().updatedAt?.toDate(),
                _doc: d
            }));
        }

        /**
         * Obtiene los pedidos activos del usuario (pendiente, confirmado, preparando, listo)
         * @param {Object} ctx
         * @param {string} userId
         */
        async function getPedidosActivosByUser(ctx, userId) {
            const snap = await ctx.db.collection(C_PEDIDOS)
                .where('userId', '==', userId)
                .where('estado', 'in', ['pendiente', 'confirmado', 'preparando', 'listo'])
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                _doc: d
            }));
        }

        /**
         * Obtiene todos los pedidos (admin), con filtros opcionales
         * @param {Object} ctx
         * @param {Object} filters - { estado, busqueda }
         * @param {Object} options - { limit, lastDoc }
         */
        async function getAllPedidos(ctx, filters = {}, options = {}) {
            let q = ctx.db.collection(C_PEDIDOS);

            if (filters.estado && filters.estado !== 'todos') {
                q = q.where('estado', '==', filters.estado);
            }

            q = q.orderBy('createdAt', 'desc');

            if (options.lastDoc) q = q.startAfter(options.lastDoc);
            const limit = options.limit || 50;
            const snap = await q.limit(limit).get();

            let resultados = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                updatedAt: d.data().updatedAt?.toDate(),
                _doc: d
            }));

            // Filtro por busqueda (nombre o matricula) en cliente
            if (filters.busqueda) {
                const b = filters.busqueda.toLowerCase();
                resultados = resultados.filter(p =>
                    (p.userName || '').toLowerCase().includes(b) ||
                    (p.matricula || '').toLowerCase().includes(b) ||
                    (p.userEmail || '').toLowerCase().includes(b)
                );
            }

            return resultados;
        }

        /**
         * Actualiza el estado de un pedido (admin)
         * @param {Object} ctx
         * @param {string} pedidoId
         * @param {string} nuevoEstado
         * @param {string} [mensaje]
         */
        async function updatePedidoStatus(ctx, pedidoId, nuevoEstado, mensaje) {
            const updateData = {
                estado: nuevoEstado,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (mensaje) {
                updateData.respuestaAdmin = mensaje;
                updateData.history = firebase.firestore.FieldValue.arrayUnion({
                    estado: nuevoEstado,
                    mensaje,
                    fecha: new Date().toISOString(),
                    autor: 'admin'
                });
            } else {
                updateData.history = firebase.firestore.FieldValue.arrayUnion({
                    estado: nuevoEstado,
                    fecha: new Date().toISOString(),
                    autor: 'admin'
                });
            }
            await ctx.db.collection(C_PEDIDOS).doc(pedidoId).update(updateData);
            return { success: true };
        }

        /**
         * Solicita cancelacion de un pedido (estudiante, solo si estado es "pendiente")
         * @param {Object} ctx
         * @param {string} pedidoId
         */
        async function cancelarPedido(ctx, pedidoId) {
            const doc = await ctx.db.collection(C_PEDIDOS).doc(pedidoId).get();
            if (!doc.exists) throw new Error('Pedido no encontrado');
            if (doc.data().estado !== 'pendiente') throw new Error('Solo puedes cancelar pedidos pendientes.');
            await ctx.db.collection(C_PEDIDOS).doc(pedidoId).update({
                estado: 'cancelado',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                history: firebase.firestore.FieldValue.arrayUnion({
                    estado: 'cancelado',
                    mensaje: 'Cancelado por el alumno',
                    fecha: new Date().toISOString(),
                    autor: 'alumno'
                })
            });
            return { success: true };
        }

        /**
         * Confirma el pago por transferencia de un pedido (admin)
         * @param {Object} ctx
         * @param {string} pedidoId
         */
        async function confirmarPagoTransferencia(ctx, pedidoId) {
            await ctx.db.collection(C_PEDIDOS).doc(pedidoId).update({
                pagoConfirmado: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        /**
         * Sube comprobante de pago (estudiante)
         * @param {Object} ctx
         * @param {File} file
         */
        async function uploadComprobante(ctx, file) {
            if (!file) return null;
            const storage = ctx.storage || (window.SIA && window.SIA.storage);
            if (!storage) throw new Error('Storage no disponible');

            const compressed = await _compressImage(file, 800, 0.7);
            const filename = `${Date.now()}_comprobante.jpg`;
            const ref = storage.ref().child(`cafeteria/comprobantes/${ctx.user.uid}/${filename}`);
            const snapshot = await ref.put(compressed, { contentType: 'image/jpeg' });
            return await snapshot.ref.getDownloadURL();
        }

        /**
         * Agrega URL de comprobante al pedido
         * @param {Object} ctx
         * @param {string} pedidoId
         * @param {string} url
         */
        async function attachComprobante(ctx, pedidoId, url) {
            await ctx.db.collection(C_PEDIDOS).doc(pedidoId).update({
                comprobanteUrl: url,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        /**
         * Listener real-time para pedidos activos (admin)
         * @param {Object} ctx
         * @param {Object} filters - { estadoActivos, estado, limit }
         * @param {Function} callback
         * @returns {Function} unsubscribe
         */
        function onPedidosRealtime(ctx, filters, callback) {
            let q = ctx.db.collection(C_PEDIDOS);

            if (filters.estadoActivos) {
                q = q.where('estado', 'in', ['pendiente', 'confirmado', 'preparando', 'listo']);
            } else if (filters.estado && filters.estado !== 'todos') {
                q = q.where('estado', '==', filters.estado);
            }

            q = q.orderBy('createdAt', 'desc').limit(filters.limit || 50);

            return q.onSnapshot(snap => {
                const pedidos = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate(),
                    updatedAt: d.data().updatedAt?.toDate(),
                    _doc: d
                }));
                callback(pedidos, snap);
            }, err => {
                console.error('[CafeteriaService] onPedidosRealtime error:', err);
            });
        }

        // ===================== RESENAS =====================

        /**
         * Crea una resena (estudiante, no anonima)
         * @param {Object} ctx
         * @param {Object} data - { tipo, productoId, productoTitulo, rating, comentario, fotoUrl }
         */
        async function createResena(ctx, data) {
            if (!ctx.user) throw new Error('Usuario no identificado');

            const resena = {
                userId: ctx.user.uid,
                userName: ctx.profile.displayName || 'Estudiante',
                userEmail: ctx.user.email,
                tipo: data.tipo || 'cafeteria',
                productoId: data.productoId || null,
                productoTitulo: data.productoTitulo || '',
                rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
                comentario: data.comentario || '',
                fotoUrl: data.fotoUrl || '',
                visible: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const ref = await ctx.db.collection(C_RESENAS).add(resena);

            // Actualizar promedio del producto si aplica
            if (data.tipo === 'producto' && data.productoId) {
                await _recalcPromedioResenas(ctx, data.productoId);
            }

            return { id: ref.id, ...resena };
        }

        /**
         * Verifica si el usuario ya realizó una reseña para el tipo/producto dado
         * @param {Object} ctx
         * @param {string} tipo - "cafeteria" o "producto"
         * @param {string|null} productoId
         * @returns {Promise<boolean>}
         */
        async function checkUserResena(ctx, tipo, productoId) {
            if (!ctx.user) return false;
            let q = ctx.db.collection(C_RESENAS)
                .where('userId', '==', ctx.user.uid)
                .where('tipo', '==', tipo);
            if (tipo === 'producto' && productoId) {
                q = q.where('productoId', '==', productoId);
            }
            const snap = await q.limit(1).get();
            return !snap.empty;
        }

        /**
         * Recalcula promedio de resenas de un producto (transaccion)
         * @param {Object} ctx
         * @param {string} productoId
         */
        async function _recalcPromedioResenas(ctx, productoId) {
            try {
                const snap = await ctx.db.collection(C_RESENAS)
                    .where('productoId', '==', productoId)
                    .where('visible', '==', true)
                    .orderBy('createdAt', 'desc')
                    .limit(100)
                    .get();

                if (snap.empty) return;

                let sum = 0;
                snap.docs.forEach(d => { sum += d.data().rating || 0; });
                const promedio = Math.round((sum / snap.size) * 10) / 10;

                await ctx.db.collection(C_PRODUCTOS).doc(productoId).update({
                    promedioResenas: promedio,
                    totalResenas: snap.size
                });
            } catch (err) {
                console.error('[CafeteriaService] Error recalculando promedio:', err);
            }
        }

        /**
         * Obtiene resenas de un producto, paginadas
         * @param {Object} ctx
         * @param {string} productoId
         * @param {Object} options - { limit, lastDoc }
         */
        async function getResenasByProducto(ctx, productoId, options = {}) {
            let q = ctx.db.collection(C_RESENAS)
                .where('productoId', '==', productoId)
                .where('visible', '==', true)
                .orderBy('createdAt', 'desc');

            if (options.lastDoc) q = q.startAfter(options.lastDoc);
            const limit = options.limit || 20;
            const snap = await q.limit(limit).get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                _doc: d
            }));
        }

        /**
         * Obtiene resenas generales de la cafeteria, paginadas
         * @param {Object} ctx
         * @param {Object} options - { limit, lastDoc }
         */
        async function getResenasCafeteria(ctx, options = {}) {
            let q = ctx.db.collection(C_RESENAS)
                .where('tipo', '==', 'cafeteria')
                .where('visible', '==', true)
                .orderBy('createdAt', 'desc');

            if (options.lastDoc) q = q.startAfter(options.lastDoc);
            const limit = options.limit || 20;
            const snap = await q.limit(limit).get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                _doc: d
            }));
        }

        /**
         * Obtiene todas las resenas (admin, incluye ocultas)
         * @param {Object} ctx
         * @param {Object} options - { limit, lastDoc }
         */
        async function getAllResenas(ctx, options = {}) {
            let q = ctx.db.collection(C_RESENAS)
                .orderBy('createdAt', 'desc');

            if (options.lastDoc) q = q.startAfter(options.lastDoc);
            const limit = options.limit || 50;
            const snap = await q.limit(limit).get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                _doc: d
            }));
        }

        /**
         * Toggle visibilidad de una resena (admin)
         * @param {Object} ctx
         * @param {string} resenaId
         * @param {boolean} visible
         */
        async function toggleResenaVisibility(ctx, resenaId, visible) {
            await ctx.db.collection(C_RESENAS).doc(resenaId).update({ visible });
            // Recalcular promedio si es resena de producto
            const doc = await ctx.db.collection(C_RESENAS).doc(resenaId).get();
            if (doc.exists && doc.data().productoId) {
                await _recalcPromedioResenas(ctx, doc.data().productoId);
            }
            return { success: true };
        }

        /**
         * Elimina una resena permanentemente (solo admin)
         * @param {Object} ctx
         * @param {string} resenaId
         */
        async function deleteResena(ctx, resenaId) {
            const doc = await ctx.db.collection(C_RESENAS).doc(resenaId).get();
            const productoId = doc.exists ? doc.data().productoId : null;
            await ctx.db.collection(C_RESENAS).doc(resenaId).delete();
            if (productoId) {
                await _recalcPromedioResenas(ctx, productoId);
            }
            return { success: true };
        }

        /**
         * Obtiene estadisticas para dashboard admin
         * @param {Object} ctx
         * @param {string} rango - "hoy" | "semana" | "mes"
         */
        async function getStats(ctx, rango = 'hoy') {
            const ahora = new Date();
            let desde = new Date();
            if (rango === 'hoy') {
                desde.setHours(0, 0, 0, 0);
            } else if (rango === 'semana') {
                desde.setDate(ahora.getDate() - 7);
                desde.setHours(0, 0, 0, 0);
            } else if (rango === 'mes') {
                desde.setDate(1);
                desde.setHours(0, 0, 0, 0);
            }

            const pedidosSnap = await ctx.db.collection(C_PEDIDOS)
                .where('createdAt', '>=', desde)
                .limit(500)
                .get();

            let ingresos = 0;
            let pendientes = 0;
            const productoCount = {};
            const productoNombres = {};

            pedidosSnap.docs.forEach(d => {
                const data = d.data();
                ingresos += data.total || 0;
                if (['pendiente', 'confirmado', 'preparando'].includes(data.estado)) {
                    pendientes++;
                }
                // Conteo de productos más pedidos
                (data.items || []).forEach(item => {
                    productoCount[item.productoId] = (productoCount[item.productoId] || 0) + item.cantidad;
                    productoNombres[item.productoId] = item.titulo;
                });
            });

            // Producto más vendido
            let topProductoId = null, topProductoQty = 0;
            for (const [pid, qty] of Object.entries(productoCount)) {
                if (qty > topProductoQty) { topProductoId = pid; topProductoQty = qty; }
            }

            // Rating promedio general
            const resenasSnap = await ctx.db.collection(C_RESENAS)
                .where('tipo', '==', 'cafeteria')
                .where('visible', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            let ratingSum = 0;
            resenasSnap.docs.forEach(d => { ratingSum += d.data().rating || 0; });
            const ratingPromedio = resenasSnap.size > 0
                ? Math.round((ratingSum / resenasSnap.size) * 10) / 10
                : 0;

            return {
                pedidosTotal: pedidosSnap.size,
                ingresos: Math.round(ingresos * 100) / 100,
                pendientes,
                ratingPromedio,
                totalResenas: resenasSnap.size,
                topProducto: topProductoId ? { id: topProductoId, titulo: productoNombres[topProductoId], cantidad: topProductoQty } : null
            };
        }

        // ===================== API PUBLICA =====================
        return {
            // Helpers
            isCafeteriaAdmin: _isCafeteriaAdmin,
            compressImage: _compressImage,
            // Config
            getConfig,
            updateConfig,
            setRecepcionActiva,
            // Productos
            getProductos,
            getProductoById,
            createProducto,
            updateProducto,
            deleteProducto,
            uploadProductoFoto,
            duplicarProducto,
            // Pedidos
            createPedido,
            getPedidosByUser,
            getPedidosActivosByUser,
            getAllPedidos,
            updatePedidoStatus,
            cancelarPedido,
            confirmarPagoTransferencia,
            uploadComprobante,
            attachComprobante,
            onPedidosRealtime,
            // Resenas
            createResena,
            checkUserResena,
            getResenasByProducto,
            getResenasCafeteria,
            getAllResenas,
            toggleResenaVisibility,
            deleteResena,
            // Stats
            getStats
        };
    })();
}
