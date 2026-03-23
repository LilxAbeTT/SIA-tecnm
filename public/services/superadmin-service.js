// services/superadmin-service.js
// Servicio unificado para el Módulo SuperAdmin
// Gestiona auditoría, usuarios, tickets de soporte y configuración global.
// TODAS las consultas usan .limit() + paginación por cursor.

if (!window.SuperAdminService) {
    window.SuperAdminService = (function () {

        const C_LOGS = 'system-logs';
        const C_USERS = 'usuarios';
        const C_TICKETS = 'tickets-soporte';
        const C_CONFIG = 'config';
        const C_AVISOS = 'avisos';
        const C_CACHE = 'reportes_cache';

        // =============================================
        // AUDITORÍA / BITÁCORA
        // =============================================

        /**
         * Registra una acción administrativa en la bitácora
         * @param {Object} ctx - Contexto del módulo
         * @param {string} action - Nombre de la acción (ej: 'UPDATE_USER_ROLE')
         * @param {Object} details - Detalles adicionales
         */
        async function logAction(ctx, action, details = {}) {
            try {
                const profile = ctx.profile || ctx.currentUserProfile || {};
                await ctx.db.collection(C_LOGS).add({
                    adminId: profile.uid || (ctx.user ? ctx.user.uid : 'unknown'),
                    adminName: profile.displayName || profile.email || 'Admin',
                    adminEmail: profile.email || '',
                    action: action,
                    details: details,
                    module: details.module || 'superadmin',
                    severity: details.severity || 'info',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.warn('[SuperAdminService] Error al registrar log:', e);
            }
        }

        /**
         * Obtiene logs de auditoría paginados con filtros
         * @param {Object} ctx - Contexto
         * @param {Object} filters - { module, action, dateFrom, dateTo }
         * @param {Object} options - { limit, lastDoc }
         * @returns {Array} Array de documentos de log
         */
        async function getLogs(ctx, filters = {}, options = {}) {
            let query = ctx.db.collection(C_LOGS);

            // Filtro por módulo
            if (filters.module && filters.module !== 'all') {
                query = query.where('module', '==', filters.module);
            }

            // Filtro por acción
            if (filters.action && filters.action !== 'all') {
                query = query.where('action', '==', filters.action);
            }

            // Orden cronológico descendente
            query = query.orderBy('timestamp', 'desc');

            // Filtro por fecha (después de aplicar orderBy)
            if (filters.dateFrom) {
                const from = new Date(filters.dateFrom);
                from.setHours(0, 0, 0, 0);
                query = query.where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(from));
            }

            if (filters.dateTo) {
                const to = new Date(filters.dateTo);
                to.setHours(23, 59, 59, 999);
                query = query.where('timestamp', '<=', firebase.firestore.Timestamp.fromDate(to));
            }

            // Paginación por cursor
            if (options.lastDoc) {
                query = query.startAfter(options.lastDoc);
            }

            const limit = options.limit || 30;
            const snap = await query.limit(limit).get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate() || null,
                _doc: d
            }));
        }

        /**
         * Exporta logs filtrados como CSV (en lotes de 100)
         * @param {Object} ctx - Contexto
         * @param {Object} filters - Filtros activos
         */
        async function exportLogsCSV(ctx, filters = {}) {
            const allLogs = [];
            let lastDoc = null;
            let hasMore = true;

            // Descargar en lotes de 100 (máximo 1000 logs)
            while (hasMore && allLogs.length < 1000) {
                const batch = await getLogs(ctx, filters, { limit: 100, lastDoc });
                allLogs.push(...batch);
                if (batch.length < 100) {
                    hasMore = false;
                } else {
                    lastDoc = batch[batch.length - 1]._doc;
                }
            }

            const csvRows = [
                ['Fecha', 'Admin', 'Email', 'Acción', 'Módulo', 'Severidad', 'Detalles'].join(','),
                ...allLogs.map(log => [
                    log.timestamp ? log.timestamp.toLocaleString() : '---',
                    `"${(log.adminName || '').replace(/"/g, '""')}"`,
                    log.adminEmail || '',
                    log.action || '',
                    log.module || '',
                    log.severity || 'info',
                    `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
                ].join(','))
            ];

            const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM para UTF-8
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sia_audit_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        // =============================================
        // GESTIÓN DE USUARIOS
        // =============================================

        /**
         * Obtiene usuarios paginados con búsqueda
         * @param {Object} ctx - Contexto
         * @param {Object} options - { limit, lastDoc, searchTerm, roleFilter }
         * @returns {Array} Array de documentos de usuario
         */
        async function getUsers(ctx, options = {}) {
            let query = ctx.db.collection(C_USERS);

            if (options.searchTerm) {
                const search = options.searchTerm.trim();
                if (!isNaN(search) && search.length > 0) {
                    // Búsqueda por matrícula exacta
                    query = query.where('matricula', '==', search);
                } else {
                    // Búsqueda por prefijo de nombre
                    query = query.where('displayName', '>=', search)
                        .where('displayName', '<=', search + '\uf8ff');
                }
            } else if (options.roleFilter && options.roleFilter !== 'all') {
                query = query.where('role', '==', options.roleFilter)
                    .orderBy('createdAt', 'desc');
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            if (options.lastDoc) {
                query = query.startAfter(options.lastDoc);
            }

            const limit = options.limit || 30;
            const snap = await query.limit(limit).get();

            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                _doc: d
            }));
        }

        /**
         * Obtiene detalle completo de un usuario (1 lectura)
         * @param {Object} ctx - Contexto
         * @param {string} uid - UID del usuario
         * @returns {Object} Datos del usuario
         */
        async function getUserDetail(ctx, uid) {
            const doc = await ctx.db.collection(C_USERS).doc(uid).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        }

        /**
         * Actualiza datos de un usuario (rol, status, allowedViews, permissions)
         * Registra cambio en auditoría automáticamente.
         * @param {Object} ctx - Contexto
         * @param {string} uid - UID del usuario
         * @param {Object} updates - Campos a actualizar
         */
        async function updateUser(ctx, uid, updates) {
            const cleanUpdates = {
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                modifiedBy: ctx.user ? ctx.user.uid : 'superadmin'
            };

            await ctx.db.collection(C_USERS).doc(uid).update(cleanUpdates);

            // Registro de auditoría automático
            await logAction(ctx, 'UPDATE_USER', {
                targetUid: uid,
                changes: Object.keys(updates),
                newRole: updates.role || undefined,
                newStatus: updates.status || undefined,
                module: 'users'
            });
        }

        /**
         * Obtiene estadísticas de usuarios desde caché (1 lectura)
         * @param {Object} ctx - Contexto
         * @returns {Object} { totalUsers, roleDistribution }
         */
        async function getUserStats(ctx) {
            const distribution = { student: 0, medico: 0, biblio: 0, aula: 0, docente: 0, superadmin: 0, psicologo: 0, department_admin: 0 };
            let totalUsers = 0;

            try {
                const cacheDoc = await ctx.db.collection(C_CACHE).doc('poblacion').get();
                if (cacheDoc.exists) {
                    const data = JSON.parse(cacheDoc.data().payload);
                    totalUsers = data.length;
                    data.forEach(u => {
                        const role = u.role || 'student';
                        if (distribution[role] !== undefined) distribution[role]++;
                        else distribution[role] = (distribution[role] || 0) + 1;
                    });
                    return { totalUsers, roleDistribution: distribution };
                }
            } catch (e) {
                console.warn('[SuperAdminService] Caché no disponible, usando fallback limitado:', e);
            }

            // Fallback: conteo limitado (nunca iterar toda la colección)
            const snap = await ctx.db.collection(C_USERS).orderBy('createdAt', 'desc').limit(500).get();
            totalUsers = snap.size;
            snap.forEach(doc => {
                const role = doc.data().role || 'student';
                if (distribution[role] !== undefined) distribution[role]++;
                else distribution[role] = 1;
            });

            return { totalUsers, roleDistribution: distribution };
        }

        // =============================================
        // TICKETS DE SOPORTE TÉCNICO
        // =============================================

        /**
         * Crea un ticket de soporte técnico (desde estudiante)
         * @param {Object} ctx - Contexto
         * @param {Object} data - { tipo, categoria, descripcion, evidenciaUrl }
         * @returns {Object} Ticket creado
         */
        /**
         * Convierte un documento Firestore de ticket a un objeto util para la UI.
         * @param {firebase.firestore.QueryDocumentSnapshot|firebase.firestore.DocumentSnapshot} doc
         * @returns {Object}
         */
        function _normalizeTicketDoc(doc) {
            const data = doc.data() || {};
            const history = Array.isArray(data.history)
                ? data.history.slice().sort((a, b) => {
                    const aTime = a && a.date ? new Date(a.date).getTime() : 0;
                    const bTime = b && b.date ? new Date(b.date).getTime() : 0;
                    return aTime - bTime;
                })
                : [];

            return {
                id: doc.id,
                ...data,
                titulo: data.titulo || `${data.tipo || 'ticket'} en ${data.categoria || 'general'}`,
                descripcion: data.descripcion || '',
                pasos: data.pasos || '',
                esperado: data.esperado || '',
                actual: data.actual || '',
                priority: data.priority || 'normal',
                context: data.context || {},
                createdAt: data.createdAt?.toDate() || null,
                updatedAt: data.updatedAt?.toDate() || null,
                lastActivityAt: data.lastActivityAt?.toDate() || data.updatedAt?.toDate() || data.createdAt?.toDate() || null,
                lastPublicResponseAt: data.lastPublicResponseAt?.toDate() || null,
                history: history,
                _doc: doc
            };
        }

        /**
         * Calcula el peso temporal de un ticket para ordenarlo por actividad.
         * @param {Object} ticket
         * @returns {number}
         */
        function _ticketSortWeight(ticket) {
            return ticket.lastActivityAt?.getTime()
                || ticket.updatedAt?.getTime()
                || ticket.createdAt?.getTime()
                || 0;
        }

        /**
         * Comprime una imagen antes de subirla a Storage.
         * @param {File|Blob} file
         * @param {number} maxWidth
         * @param {number} quality
         * @returns {Promise<File|Blob>}
         */
        function _compressImage(file, maxWidth = 1440, quality = 0.78) {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                return Promise.reject(new Error('El adjunto debe ser una imagen.'));
            }

            if (file.size <= 1.8 * 1024 * 1024) {
                return Promise.resolve(file);
            }

            return new Promise((resolve, reject) => {
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);

                img.onload = () => {
                    URL.revokeObjectURL(objectUrl);

                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx2d = canvas.getContext('2d');
                    if (!ctx2d) {
                        reject(new Error('No se pudo preparar la imagen.'));
                        return;
                    }

                    ctx2d.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => {
                        if (!blob) {
                            reject(new Error('No se pudo comprimir la imagen.'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };

                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('No se pudo leer la imagen seleccionada.'));
                };

                img.src = objectUrl;
            });
        }

        /**
         * Sube evidencia de soporte tecnico a Storage.
         * @param {Object} ctx - Contexto
         * @param {File|Blob} file - Imagen a subir
         * @returns {Promise<string>} URL de descarga
         */
        async function uploadSupportEvidence(ctx, file) {
            if (!file) return '';

            const storage = ctx.storage || (window.SIA && window.SIA.storage);
            if (!storage) throw new Error('Storage no disponible');

            const prepared = await _compressImage(file);
            const filename = `${Date.now()}_support.jpg`;
            const ref = storage.ref().child(`support-tickets/${ctx.user.uid}/${filename}`);
            const snapshot = await ref.put(prepared, { contentType: 'image/jpeg' });
            return await snapshot.ref.getDownloadURL();
        }

        async function createSupportTicket(ctx, data) {
            if (!ctx.user) throw new Error('Usuario no identificado');

            const profile = ctx.profile || {};
            const serverNow = firebase.firestore.FieldValue.serverTimestamp();
            const context = data.context || {};
            const ticket = {
                userId: ctx.user.uid,
                userEmail: ctx.user.email || profile.email || '',
                userName: profile.displayName || 'Usuario',
                matricula: profile.matricula || '',
                titulo: data.titulo || `${data.tipo || 'bug'} en ${data.categoria || 'general'}`,
                tipo: data.tipo || 'bug',
                categoria: data.categoria || 'general',
                descripcion: data.descripcion || '',
                pasos: data.pasos || '',
                esperado: data.esperado || '',
                actual: data.actual || '',
                evidenciaUrl: data.evidenciaUrl || '',
                status: 'pendiente',
                priority: data.priority || 'normal',
                responsesCount: 0,
                internalNotesCount: 0,
                createdAt: serverNow,
                updatedAt: serverNow,
                lastActivityAt: serverNow,
                lastActivityBy: 'user',
                lastActivityType: 'created',
                context: {
                    source: context.source || 'bug_fab',
                    routePath: context.routePath || '',
                    hash: context.hash || '',
                    currentView: context.currentView || '',
                    userAgent: context.userAgent || '',
                    platform: context.platform || '',
                    viewport: context.viewport || '',
                    language: context.language || '',
                    online: typeof context.online === 'boolean' ? context.online : true,
                    reportedAtClient: context.reportedAtClient || new Date().toISOString()
                },
                history: []
            };

            const ref = await ctx.db.collection(C_TICKETS).add(ticket);
            return { id: ref.id, ...ticket };
        }

        /**
         * Obtiene tickets de soporte paginados con filtros
         * @param {Object} ctx - Contexto
         * @param {Object} filters - { status }
         * @param {Object} options - { limit, lastDoc }
         * @returns {Array} Tickets
         */
        async function getSupportTickets(ctx, filters = {}, options = {}) {
            let query = ctx.db.collection(C_TICKETS);

            if (filters.status && filters.status !== 'all') {
                query = query.where('status', '==', filters.status);
            }

            query = query.orderBy('createdAt', 'desc');

            if (options.lastDoc) {
                query = query.startAfter(options.lastDoc);
            }

            const limit = options.limit || 30;
            const snap = await query.limit(limit).get();
            return snap.docs.map(_normalizeTicketDoc).sort((a, b) => _ticketSortWeight(b) - _ticketSortWeight(a));
        }

        /**
         * Obtiene el detalle de un ticket de soporte.
         * @param {Object} ctx - Contexto
         * @param {string} ticketId - ID del ticket
         * @returns {Object|null} Ticket o null si no existe
         */
        async function getSupportTicketDetail(ctx, ticketId) {
            const doc = await ctx.db.collection(C_TICKETS).doc(ticketId).get();
            return doc.exists ? _normalizeTicketDoc(doc) : null;
        }

        /**
         * Actualiza campos administrativos del ticket sin mezclar respuestas.
         * @param {Object} ctx - Contexto
         * @param {string} ticketId - ID del ticket
         * @param {Object} updates - Campos modificables
         * @returns {Object} Resultado
         */
        async function updateTicketMeta(ctx, ticketId, updates = {}) {
            const cleanUpdates = {};
            const changedKeys = [];

            if (typeof updates.status === 'string' && updates.status.trim()) {
                cleanUpdates.status = updates.status.trim();
                changedKeys.push('status');
            }

            if (typeof updates.priority === 'string' && updates.priority.trim()) {
                cleanUpdates.priority = updates.priority.trim();
                changedKeys.push('priority');
            }

            if (!changedKeys.length) {
                return { success: false, changedKeys: [] };
            }

            const profile = ctx.profile || {};
            const updateData = {
                ...cleanUpdates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivityBy: 'admin',
                lastActivityType: changedKeys.includes('status') ? 'status_change' : 'meta_update'
            };

            if (cleanUpdates.status === 'resuelto') {
                updateData.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            if (changedKeys.includes('status')) {
                updateData.history = firebase.firestore.FieldValue.arrayUnion({
                    author: profile.displayName || 'SuperAdmin',
                    message: `Estado actualizado a ${cleanUpdates.status}`,
                    role: 'admin',
                    type: 'status_change',
                    newStatus: cleanUpdates.status,
                    date: new Date().toISOString()
                });
            }

            await ctx.db.collection(C_TICKETS).doc(ticketId).update(updateData);

            await logAction(ctx, 'UPDATE_TICKET_META', {
                ticketId,
                changedKeys,
                module: 'tickets'
            });

            return { success: true, changedKeys };
        }

        /**
         * Actualiza el estado de un ticket de soporte
         * @param {Object} ctx - Contexto
         * @param {string} ticketId - ID del ticket
         * @param {string} newStatus - Nuevo estado
         * @param {string} adminNote - Nota del admin
         */
        async function updateTicketStatus(ctx, ticketId, newStatus, adminNote) {
            const result = await updateTicketMeta(ctx, ticketId, { status: newStatus });
            if (adminNote) {
                const profile = ctx.profile || {};
                await addTicketResponse(ctx, ticketId, adminNote, profile.displayName || 'SuperAdmin');
            }
            return result;
        }

        /**
         * Agrega respuesta a un ticket de soporte
         * @param {Object} ctx - Contexto
         * @param {string} ticketId - ID del ticket
         * @param {string} message - Mensaje
         * @param {string} authorName - Nombre del autor
         */
        async function addTicketResponse(ctx, ticketId, message, authorName, options = {}) {
            const cleanMessage = String(message || '').trim();
            if (!cleanMessage) throw new Error('Escribe un mensaje antes de enviarlo.');

            const entryType = options.type || 'response';
            const role = options.role || 'admin';
            const isInternal = entryType === 'internal';
            const actor = authorName || (ctx.profile || {}).displayName || 'SuperAdmin';

            const updateData = {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivityBy: role,
                lastActivityType: isInternal ? 'internal_note' : 'response',
                history: firebase.firestore.FieldValue.arrayUnion({
                    author: actor,
                    message: cleanMessage,
                    role: role,
                    type: entryType,
                    date: new Date().toISOString()
                })
            };

            if (isInternal) {
                updateData.internalNotesCount = firebase.firestore.FieldValue.increment(1);
            } else {
                updateData.responsesCount = firebase.firestore.FieldValue.increment(1);
                updateData.lastPublicResponseAt = firebase.firestore.FieldValue.serverTimestamp();
                updateData.lastPublicResponseBy = actor;
            }

            await ctx.db.collection(C_TICKETS).doc(ticketId).update(updateData);

            await logAction(ctx, isInternal ? 'TICKET_INTERNAL_NOTE' : 'TICKET_RESPONSE', {
                ticketId, module: 'tickets'
            });

            return { success: true };
        }

        /**
         * Obtiene estadísticas de tickets (limitado a 500)
         * @param {Object} ctx - Contexto
         * @returns {Object} Stats
         */
        async function getTicketStats(ctx) {
            const snap = await ctx.db.collection(C_TICKETS)
                .orderBy('createdAt', 'desc')
                .limit(500)
                .get();

            const stats = {
                total: snap.size,
                pendiente: 0,
                en_proceso: 0,
                resuelto: 0,
                rechazado: 0,
                byType: {},
                byPriority: { normal: 0, alta: 0, critica: 0 },
                lastWeek: 0
            };

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            snap.docs.forEach(d => {
                const data = d.data();
                const st = data.status === 'en-proceso' ? 'en_proceso' : (data.status || 'pendiente');
                if (stats[st] !== undefined) stats[st]++;

                const tipo = data.tipo || 'otro';
                stats.byType[tipo] = (stats.byType[tipo] || 0) + 1;

                const priority = data.priority || 'normal';
                if (stats.byPriority[priority] !== undefined) stats.byPriority[priority]++;

                const created = data.createdAt?.toDate();
                if (created && created > oneWeekAgo) {
                    stats.lastWeek++;
                }
            });

            return stats;
        }

        /**
         * Obtiene tickets del usuario actual
         * @param {Object} ctx - Contexto
         * @param {Object} options - { limit, lastDoc }
         * @returns {Array} Tickets del usuario
         */
        async function getMyTickets(ctx, options = {}) {
            if (!ctx.user) return [];

            let query = ctx.db.collection(C_TICKETS)
                .where('userId', '==', ctx.user.uid)
                .orderBy('createdAt', 'desc');

            if (options.lastDoc) {
                query = query.startAfter(options.lastDoc);
            }

            const limit = options.limit || 20;
            const snap = await query.limit(limit).get();
            return snap.docs.map(_normalizeTicketDoc).sort((a, b) => _ticketSortWeight(b) - _ticketSortWeight(a));
        }

        // =============================================
        // CONFIGURACIÓN GLOBAL
        // =============================================

        /**
         * Lee la configuración global de un path
         * @param {Object} ctx - Contexto
         * @param {string} path - Documento de config (ej: 'modules')
         * @returns {Object|null} Datos de configuración
         */
        async function getGlobalConfig(ctx, path) {
            const doc = await ctx.db.collection(C_CONFIG).doc(path).get();
            return doc.exists ? doc.data() : null;
        }

        /**
         * Guarda configuración global con merge
         * @param {Object} ctx - Contexto
         * @param {string} path - Documento de config
         * @param {Object} data - Datos a guardar
         */
        async function setGlobalConfig(ctx, path, data) {
            await ctx.db.collection(C_CONFIG).doc(path).set({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: ctx.user ? ctx.user.uid : 'superadmin'
            }, { merge: true });

            await logAction(ctx, 'UPDATE_CONFIG', {
                path, module: 'config'
            });
        }

        /**
         * Crea un aviso global para todo el sistema
         * @param {Object} ctx - Contexto
         * @param {Object} notice - { texto, tipo, duration }
         */
        async function createGlobalNotice(ctx, notice) {
            const expiresAt = notice.duration > 0
                ? new Date(Date.now() + notice.duration * 60000)
                : null;

            const noticeData = {
                texto: notice.texto,
                tipo: notice.tipo,
                modulo: 'global',
                prioridad: notice.tipo === 'emergencia' ? 1 : 2,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                activaDesde: firebase.firestore.FieldValue.serverTimestamp(),
                activaHasta: expiresAt ? firebase.firestore.Timestamp.fromDate(expiresAt) : null,
                createdBy: ctx.user ? ctx.user.uid : 'superadmin'
            };

            const ref = await ctx.db.collection(C_AVISOS).add(noticeData);

            await logAction(ctx, 'CREATE_GLOBAL_NOTICE', {
                noticeId: ref.id, type: notice.tipo, module: 'config'
            });

            return ref;
        }

        /**
         * Stream de avisos globales en tiempo real (limit 10)
         * @param {Object} ctx - Contexto
         * @param {Function} callback - Callback con snapshot
         * @returns {Function} Unsubscribe function
         */
        function streamGlobalNotices(ctx, callback) {
            return ctx.db.collection(C_AVISOS)
                .where('modulo', '==', 'global')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .onSnapshot(callback);
        }

        /**
         * Elimina un aviso global
         * @param {Object} ctx - Contexto
         * @param {string} noticeId - ID del aviso
         */
        async function deleteNotice(ctx, noticeId) {
            await ctx.db.collection(C_AVISOS).doc(noticeId).delete();
            await logAction(ctx, 'DELETE_NOTICE', {
                noticeId, module: 'config'
            });
        }

        /**
         * Cambia el estado de un módulo (kill switch)
         * @param {Object} ctx - Contexto
         * @param {string} moduleId - ID del módulo
         * @param {boolean} isEnabled - Habilitado/deshabilitado
         */
        async function toggleModule(ctx, moduleId, isEnabled) {
            await setGlobalConfig(ctx, 'modules', { [moduleId]: isEnabled });
            await logAction(ctx, isEnabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE', {
                moduleId, module: 'config'
            });
        }

        // =============================================
        // EXPORTACIONES PÚBLICAS
        // =============================================

        return {
            // Auditoría
            logAction,
            getLogs,
            exportLogsCSV,
            // Usuarios
            getUsers,
            getUserDetail,
            updateUser,
            getUserStats,
            // Tickets
            createSupportTicket,
            uploadSupportEvidence,
            getSupportTickets,
            getSupportTicketDetail,
            updateTicketMeta,
            updateTicketStatus,
            addTicketResponse,
            getTicketStats,
            getMyTickets,
            // Config
            getGlobalConfig,
            setGlobalConfig,
            createGlobalNotice,
            streamGlobalNotices,
            deleteNotice,
            toggleModule
        };

    })();
}
